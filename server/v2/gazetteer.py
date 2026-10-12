"""Tier-1 search index over the bundled Delhi gazetteer + OSM corpus.

This is the pure-Python fallback for T1 (docs/plan/04 §2): the C++
`alive_core` index and `alive_core_ref` are used instead when importable
(search.py picks the best at import). Two data sources are merged:

- Mobile/assets/delhi-gazetteer.json — the app's bundled 26.5k places
  ({n, c, lat, lon, w, k}: name, category, position, weight, popularity)
- server/data/corpus/*.jsonl — the OSM Delhi-NCR extract
  ({id, display, aliases, category, lat, lon, popularity}); entry
  aliases become extra match tokens, never the display name.

Scoring mirrors alive_core_ref's contract: per query token a group of
alternatives (the token itself + alias phrases from
server/data/aliases.json, wrapped {"aliases": {...}} format); a token is
covered when some alternative's atoms all match entry tokens
(prefix -> len/len quality, fuzzy -> DL within bound sharing a padded
trigram). Score = pq + coverage + popularity + name-precision
+ kind boost - log1p(distance_km); the lead query token must be covered
and >= half the tokens must cover. Kind boosts are intent-gated
(station/mall/university words in the query boost the matching kinds;
otherwise locality kinds get a small default boost).
"""
import bisect
import gzip
import json
import math
import os
import re
import sys
import time as _time
from typing import Optional

_SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_REPO = os.path.dirname(_SERVER_DIR)
GAZETTEER_PATHS = [
    os.environ.get("ALIVE_GAZETTEER", ""),
    os.path.join(_REPO, "Mobile", "assets", "delhi-gazetteer.json"),
    os.path.join(_SERVER_DIR, "data", "delhi-gazetteer.json"),
]
CORPUS_PATHS = [
    os.environ.get("ALIVE_CORPUS", ""),
    os.path.join(_SERVER_DIR, "data", "corpus", "delhi-corpus.jsonl"),
    os.path.join(_SERVER_DIR, "data", "corpus",
                 "delhi-corpus.jsonl.gz"),
    os.path.join(_SERVER_DIR, "data", "corpus",
                 "delhi-corpus-sample.jsonl"),
]
ALIAS_PATHS = [
    os.environ.get("ALIVE_ALIASES", ""),
    os.path.join(_SERVER_DIR, "data", "aliases.json"),
]

# score weights — same shape as alive_core_ref
W_PQ = 1.0        # mean per-group best pair quality
W_COV = 1.0       # matched query tokens / query tokens
W_POP = 0.5       # curated gazetteer popularity (corpus rows are 0)
W_PREC = 0.5      # fraction of display tokens the query explains
W_DIST = 0.15     # -log1p(distance_km)
MIN_COV = 0.5     # at least half the query tokens must cover
KIND_BOOST = 0.30

# popularity is a 0..1 weight — but geonames corpus rows carry raw
# population. Same guard as alive_core_ref._norm_popularity: unbounded
# sources log-map into (0,1] so the term stays a tiebreaker.
_POP_LOG_CEIL = math.log1p(20_000_000.0)


def _norm_popularity(p: float) -> float:
    if p <= 1.0:
        return p
    return min(1.0, math.log1p(p) / _POP_LOG_CEIL)

# intent -> kind substrings; fires only when an intent word is among the
# expanded query atoms (so "vaishali metro" boosts stations but
# "sarojni nagar" does not).
_INTENT_KINDS = {
    ("metro", "station", "stn", "railway", "rly", "isbt", "airport",
     "bus"): ("station", "metro", "train", "railway", "airport", "bus"),
    ("mall", "market", "mkt", "bazar", "bazaar", "cinema", "pvr",
     "shopping", "mart", "store"): ("mall", "market", "cinema",
                                    "shopping", "bazaar", "store",
                                    "mart"),
    ("university", "univ", "college", "institute", "school",
     "iit", "dtu", "jnu", "nsut", "dce"): ("university", "college",
                                          "institute", "school"),
    ("hospital", "medical", "clinic", "hosp"): ("hospital", "clinic",
                                               "medical"),
}
# default boost (no intent word): named places over POI noise
_LOCALITY_KINDS = ("locality", "neighborhood", "macrohood", "place",
                   "suburb", "district", "addr:place")
_LOCALITY_BOOST = 0.25

# Hinglish/abbrev normalization (docs/plan/04 §2). Phrase-level aliases
# are applied before token-level ones.
PHRASE_ALIASES = {
    "cp": "connaught place",
    "gk": "greater kailash",
    "gk 1": "greater kailash 1",
    "gk 2": "greater kailash 2",
    "karol bagh mkt": "karol bagh market",
    "igi": "indira gandhi",
    "ndls": "new delhi railway station",
    "isbt": "inter state bus terminal",
    "chandni chok": "chandni chowk",
    "hkv": "hauz khas village",
    "old fort": "purana qila",
}
TOKEN_ALIASES = {
    "chok": "chowk",
    "sec": "sector",
    "stn": "station",
    "rd": "road",
    "mkt": "market",
    "nr": "near",
    "extn": "extension",
    "ext": "extension",
    "enclave": "enclave",
    "ngr": "nagar",
    "colny": "colony",
    "marg": "marg",
    "intl": "international",
}

# roman <-> arabic equivalences — query-side alternatives and one-level
# index expansion only; normalize() itself never rewrites numerals.
_ROMAN = {
    "1": ["i", "one"], "i": ["1", "one"],
    "2": ["ii", "two"], "ii": ["2", "two"],
    "3": ["iii", "three"], "iii": ["3", "three"],
    "4": ["iv", "four"], "iv": ["4", "four"],
    "5": ["v", "five"], "v": ["5", "five"],
    "6": ["vi", "six"], "vi": ["6", "six"],
    "7": ["vii", "seven"], "vii": ["7", "seven"],
    "8": ["viii", "eight"], "viii": ["8", "eight"],
    "9": ["ix", "nine"], "ix": ["9", "nine"],
    "10": ["x", "ten"], "x": ["10", "ten"],
}

_NON_ALNUM = re.compile(r"[^a-z0-9 ]+")
_WS = re.compile(r"\s+")


def normalize(s: str) -> str:
    """Lowercase, punctuation-free, alias-expanded — the dedupe key."""
    s = (s or "").lower().replace("&", " and ")
    s = _NON_ALNUM.sub(" ", s)
    s = _WS.sub(" ", s).strip()
    if s in PHRASE_ALIASES:
        s = PHRASE_ALIASES[s]
    toks = [TOKEN_ALIASES.get(t, t) for t in s.split()]
    return " ".join(toks)


# cooked kinds that are accessories of a parent landmark — an 'AIIMS'
# metro platform must not inherit the landmark's alias from a same-cell
# loser, or the accessory outranks its own landmark.
_ACCESSORY_CATS = frozenset({
    "platform", "stop", "stop_position", "bus_stop", "tram_stop",
    "entrance", "subway_entrance", "depot", "ticket_validator",
})


def _union_aliases(a: list, b: list) -> list:
    """Case-insensitive union of two alias lists (first-seen casing kept)."""
    out = []
    seen = set()
    for lst in (a or [], b or []):
        for s in lst:
            k = s.lower()
            if k not in seen:
                seen.add(k)
                out.append(s)
    return out


_ALIAS_TABLE: Optional[dict] = None

# Cities outside Delhi NCR whose names leak onto Delhi rows — upstream
# Overture/Wikidata join artifacts ('Srinagar Railway Station' pinned
# at NDLS, 'Heathrow International Airport London' in Chhatarpur, 687
# such rows in the bundled gazetteer). A row that also names an NCR
# place is kept honest ('Patna Rajdhani Express New Delhi Railway
# Station' really is at NDLS); and when the QUERY carries the city the
# row stays too ('jaipur column' is a real Delhi landmark — the user
# asked for it, the name just contains the token).
ELSEWHERE_TOKENS = frozenset("""
srinagar jammu howrah kolkata calcutta mumbai bombay chennai madras
bengaluru bangalore banglore hyderabad secunderabad jaipur udaipur
jodhpur
lucknow kanpur patna amritsar ludhiana jalandhar nagpur pune surat
indore bhopal ahmedabad vadodara rajkot nashik aurangabad varanasi
allahabad prayagraj guwahati kochi thiruvananthapuram trivandrum
coimbatore madurai vijayawada visakhapatnam gwalior jabalpur mysuru
mysore dehradun shimla ranchi raipur bhubaneswar cuttack agartala
imphal gangtok aizawl itanagar kohima dimapur siliguri asansol
durgapur agra mathura vrindavan haridwar rishikesh nainital mussoorie
gorakhpur gorkhpur muzaffarpur bareilly moradabad aligarh saharanpur
jhansi faizabad ayodhya firozabad ghazipur ballia azamgarh deoria
basti gonda barabanki sitapur hardoi shahjahanpur rampur etawah
mainpuri kannauj farrukhabad unnao sultanpur pratapgarh jaunpur
mirzapur bijnor amroha sambhal chandausi hathras etah kasganj badaun
rewa satna katni sagar damoh khajuraho tikamgarh panna morena bhind
guna shivpuri datia chhindwara seoni balaghat betul hoshangabad
khandwa khargone burhanpur ratlam ujjain dewas mandsaur shajapur
rajgarh vidisha sehore raisen dhanbad bokaro jamshedpur hazaribagh
giridih koderma deoghar dumka sahibganj pakur godda kharagpur
purulia bankura bardhaman burdwan hooghly nadia murshidabad malda
jalpaiguri darjeeling kalimpong bhagalpur gaya nawada jehanabad
sheikhpura lakhisarai jamui begusarai khagaria samastipur darbhanga
madhubani supaul araria kishanganj purnia katihar madhepura saharsa
sitamarhi sheohar motihari bettiah chhapra siwan gopalganj vaishali
hajipur nellore tirupati kurnool anantapur kadapa ongole guntur
rajahmundry kakinada eluru warangal karimnagar nizamabad khammam
nalgonda adilabad belagavi hubli dharwad mangalore udupi shimoga
tumkur bellary hospet bidar gulbarga kalaburagi raichur kolar
chitradurga davangere hassan mandya madikeri salem erode tirunelveli
tuticorin thoothukudi trichy tiruchirappalli thanjavur vellore
kanchipuram cuddalore villupuram nagercoil kanyakumari karur
dindigul pudukkottai namakkal krishnagiri dharmapuri kollam
alappuzha pathanamthitta kottayam thrissur palakkad malappuram
kozhikode calicut kannur kasaragod ernakulam panaji margao mapusa
shirdi nanded solapur kolhapur sangli satara ratnagiri amravati
akola yavatmal wardha chandrapur gondia bhandara buldhana washim
hingoli parbhani jalna beed latur osmanabad dhule jalgaon nandurbar
bhavnagar jamnagar junagadh porbandar amreli surendranagar morbi
gandhidham bhuj ankleshwar bharuch navsari valsad vapi silvassa
daman gandhinagar mehsana palanpur himatnagar nadiad anand godhra
dahod kota bundi baran jhalawar chittorgarh bhilwara rajsamand
banswara dungarpur sikar churu jhunjhunu nagaur pali barmer
jaisalmer bikaner hanumangarh dholpur karauli ajmer beawar
kishangarh makrana london dubai dhabi singapore bangkok kathmandu
colombo dhaka karachi lahore paris berlin tokyo beijing shanghai
toronto sydney melbourne amsterdam vienna zurich geneva frankfurt
munich hamburg madrid barcelona rome milan venice istanbul cairo
riyadh jeddah doha muscat manama
""".split())

# Delhi NCR + towns the field actually reaches — a name containing one
# is a legitimate regional row, never a contradiction.
NCR_TOKENS = frozenset("""
delhi ncr noida gurugram gurgaon ghaziabad faridabad meerut baghpat
sonipat panipat rohtak jhajjar rewari palwal nuh sohna manesar
bhiwadi dharuhera bahadurgarh kundli loni hapur bulandshahr bulandshahar
khurja modinagar muradnagar pilkhuwa dasna dadri narela bawana
kanjhawala mundka alipur sampla ganaur baraut jind bhiwani hisar
karnal kurukshetra jewar tapukara neemrana behror
""".split())


# kinds that cannot travel: a station/airport/monument named after a
# far city but pinned in Delhi is a join artifact, never a real place.
# Businesses/institutions named after cities ('Kolkata Biryani House',
# 'Agra Sweets') are everyday Delhi reality — those stay untouched.
_IMMOBILE_KIND_SUBSTR = ("station", "rail", "airport", "platform",
                        "ferry", "terminal", "monument", "memorial",
                        "historic", "fort", "museum")


def name_says_elsewhere(name: str, qn: str = "",
                        kind: str = "") -> Optional[str]:
    """Far-city token contradicting a Delhi row, or None when clean.

    Only fires on immobile kinds (station/airport/monument/…) — a name
    can reference a far city legitimately everywhere else.
    qn = normalized query (may be '' for reverse/label checks)."""
    k = (kind or "").lower()
    if kind and not any(s in k for s in _IMMOBILE_KIND_SUBSTR):
        return None
    toks = set(normalize(name).split())
    if toks & NCR_TOKENS:
        return None
    qtoks = set(qn.split()) if qn else set()
    for t in toks & ELSEWHERE_TOKENS:
        if t not in qtoks:
            return t
    return None


def alias_table() -> dict:
    """{token: [[tok, ...], ...]} — builtins + roman + aliases.json.

    The file uses the wrapped {"comment": ..., "aliases": {...}} shape;
    phrases may be multi-token (each phrase is one alternative). File
    entries extend builtins, never remove.
    """
    global _ALIAS_TABLE
    if _ALIAS_TABLE is not None:
        return _ALIAS_TABLE
    table: dict = {}

    def _raw_norm(s: str) -> list:
        """Case/punct fold WITHOUT alias application — alias keys must
        not migrate under their own expansions ('cp' stays 'cp')."""
        s = _WS.sub(" ", _NON_ALNUM.sub(" ", (s or "").lower())).strip()
        return s.split()

    def add(key: str, phrase: str) -> None:
        ktoks = _raw_norm(key)
        if len(ktoks) != 1:
            return
        ptoks = _raw_norm(phrase)
        if not ptoks:
            return
        alts = table.setdefault(ktoks[0], [])
        if ptoks not in alts:
            alts.append(ptoks)

    for k, v in TOKEN_ALIASES.items():
        add(k, v)
    for k, v in PHRASE_ALIASES.items():
        if len(k.split()) == 1:
            add(k, v)
    for k, phrases in _ROMAN.items():
        for p in phrases:
            add(k, p)
    for path in ALIAS_PATHS:
        if not path or not os.path.exists(path):
            continue
        try:
            with open(path, encoding="utf-8") as fh:
                raw = json.load(fh)
        except (OSError, ValueError):
            continue
        if isinstance(raw, dict):
            raw = raw.get("aliases", raw)
        if not isinstance(raw, dict):
            continue
        for key, phrases in raw.items():
            if isinstance(phrases, str):
                phrases = [phrases]
            for p in phrases or []:
                if isinstance(p, str):
                    add(key, p)
        break  # first readable file wins
    _ALIAS_TABLE = table
    return table


def _lev_bound(a: str, b: str, bound: int) -> int:
    """Plain Levenshtein with a length cutoff — <=bound or bound+1."""
    la, lb = len(a), len(b)
    if abs(la - lb) > bound:
        return bound + 1
    prev = list(range(lb + 1))
    for i in range(1, la + 1):
        cur = [i] + [0] * lb
        row_min = i
        for j in range(1, lb + 1):
            cur[j] = min(prev[j] + 1, cur[j - 1] + 1,
                         prev[j - 1] + (a[i - 1] != b[j - 1]))
            if cur[j] < row_min:
                row_min = cur[j]
        if row_min > bound:
            return bound + 1
        prev = cur
    return prev[lb]


def _trigrams(tok: str) -> set:
    p = "  " + tok + "  "
    return {p[i:i + 3] for i in range(len(p) - 2)}


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000.0 * math.asin(math.sqrt(h))


def _query_groups(qn: str, aliases: dict) -> list:
    """Per query token: [(atom,...), ...] — literal token + alias phrases."""
    groups = []
    for t in qn.split():
        alts = [(t,)]
        for phrase in aliases.get(t, ()):
            tup = tuple(phrase)
            if tup and tup not in alts:
                alts.append(tup)
        groups.append(alts)
    return groups


def _pair_quality(atom: str, tok: str) -> float:
    """atom vs entry token: prefix -> len/len; fuzzy (len>=4, DL<=bound)
    -> 1 - d/max(len). Mirrors alive_core_ref's pair rules."""
    if not atom or not tok:
        return 0.0
    if tok.startswith(atom):
        return len(atom) / len(tok)
    la = len(atom)
    if la >= 4:
        bound = 1 if la < 8 else 2
        d = _lev_bound(atom, tok, bound)
        if d <= bound:
            return 1.0 - d / max(la, len(tok))
    return 0.0


def _eval_groups(groups: list, match_tokens: list, display_tokens: list):
    """Score one entry against the query groups.

    Returns (pq, coverage, precision, fuzzy_flag): pq is the mean over
    groups of the best alternative quality (an alternative scores the
    min quality of its atoms); coverage is matched groups / groups;
    precision is the share of display tokens any atom matches.
    """
    G = len(groups)
    if not G:
        return 0.0, 0.0, 0.0, False
    toks = match_tokens or display_tokens
    sum_q = 0.0
    matched = 0
    fuzzy_used = False
    all_atoms = []
    for alts in groups:
        gq = 0.0
        for alt in alts:
            if not alt:
                continue
            # an alternative scores the min over its atoms of each
            # atom's best pair quality against the entry tokens
            aq = min(max((_pair_quality(a, t) for t in toks), default=0.0)
                     for a in alt)
            if aq > gq:
                gq = aq
        if gq > 0:
            matched += 1
            for alt in alts:
                for a in alt:
                    if a not in all_atoms:
                        all_atoms.append(a)
            if not any(t.startswith(a)
                       for alt in alts for a in alt for t in toks):
                fuzzy_used = True
        sum_q += gq
    prec = 0.0
    if display_tokens:
        hit = sum(1 for t in display_tokens
                  if any(_pair_quality(a, t) > 0 for a in all_atoms))
        prec = hit / len(display_tokens)
    return sum_q / G, matched / G, prec, fuzzy_used


def classify(query_norm: str, name_norm: str) -> int:
    """0 exact-prefix | 1 token-prefix | 2 fuzzy | 3 no match.

    Same contract as before but alias-aware: each query token also tries
    its alias phrases (aliases.json), so 'gk 2' token-prefixes
    'greater kailash ii'. Partial coverage is still class 3 here —
    scored partials surface through Gazetteer.search instead.
    """
    if not query_norm or not name_norm:
        return 3
    if name_norm.startswith(query_norm):
        return 0
    groups = _query_groups(query_norm, alias_table())
    ntoks = name_norm.split()
    pq, cov, _prec, fuzzy = _eval_groups(groups, ntoks, ntoks)
    if cov < 1.0:
        return 3
    return 2 if fuzzy else 1


class Gazetteer:
    """In-memory index over the gazetteer + corpus — load once, reuse."""

    def __init__(self, paths=None, corpus_paths=None):
        self._paths = paths if paths is not None else GAZETTEER_PATHS
        self._corpus_paths = (corpus_paths if corpus_paths is not None
                              else CORPUS_PATHS)
        self._rows: Optional[list] = None
        self._vocab: Optional[list] = None
        self._postings: Optional[dict] = None
        self._tri: Optional[dict] = None

    # --- loading -------------------------------------------------------------
    def _match_tokens(self, norm: str, aliases: list) -> list:
        """norm tokens + alias expansions — the bag the index posts on.
        Built lazily per row inside _ensure_index (see _load note)."""
        match = norm.split()
        seen = set(match)
        for al in aliases or []:
            for t in normalize(al).split():
                if t not in seen:
                    seen.add(t)
                    match.append(t)
        # one-level alias expansion (bag semantics, index side)
        table = alias_table()
        for t in list(match):
            for alt in table.get(t, ()):
                for a in alt:
                    if a not in seen:
                        seen.add(a)
                        match.append(a)
        return match

    def _add_row(self, rows: list, idx, name: str, kind: str,
                 lat, lon, pop: float, aliases: list) -> None:
        norm = normalize(name)
        if not norm or lat is None or lon is None:
            return
        row = {
            "idx": idx,
            "name": name,
            "norm": norm,
            "kind": kind or "place",
            "lat": float(lat), "lon": float(lon),
            "pop": _norm_popularity(float(pop or 0.0)),
        }
        # corpus aliases feed match_tokens only inside _ensure_index —
        # keeping the raw list (~a few short strings per corpus row)
        # is far cheaper than expanding every row eagerly.
        if aliases:
            row["_raw_aliases"] = list(aliases)
        rows.append(row)

    def _load(self) -> list:
        if self._rows is not None:
            return self._rows
        rows: list = []

        for p in self._paths:
            if not p or not os.path.exists(p):
                continue
            try:
                with open(p, "r", encoding="utf-8") as fh:
                    data = json.load(fh)
            except (OSError, ValueError):
                continue
            for i, e in enumerate(data):
                self._add_row(rows, i, e.get("n") or "",
                              e.get("c") or "place",
                              e.get("lat"), e.get("lon"),
                              e.get("k") or 0.0, [])
            break  # first readable gazetteer file wins

        for p in self._corpus_paths:
            if not p or not os.path.exists(p):
                continue
            try:
                fh = (gzip.open(p, "rt", encoding="utf-8")
                      if p.endswith(".gz")
                      else open(p, "r", encoding="utf-8"))
            except OSError:
                continue
            with fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        e = json.loads(line)
                    except ValueError:
                        continue
                    self._add_row(rows, e.get("id"),
                                  e.get("display") or "",
                                  e.get("category") or "place",
                                  e.get("lat"), e.get("lon"),
                                  e.get("popularity") or 0.0,
                                  (e.get("aliases") or []) +
                                  (e.get("gen_aliases") or []))
            break  # first readable corpus file wins

        # dedupe: same normalized name inside a ~110 m cell keeps the
        # most popular row (corpus ships near-duplicate place rows)
        best: dict = {}
        for r in rows:
            key = (r["norm"], round(r["lat"], 3), round(r["lon"], 3))
            prev = best.get(key)
            if prev is None or r["pop"] > prev["pop"]:
                if prev is not None and r.get("c") not in _ACCESSORY_CATS:
                    r["_raw_aliases"] = _union_aliases(
                        r.get("_raw_aliases"), prev.get("_raw_aliases"))
                best[key] = r
            else:
                if prev.get("c") not in _ACCESSORY_CATS:
                    prev["_raw_aliases"] = _union_aliases(
                        prev.get("_raw_aliases"), r.get("_raw_aliases"))
        rows = list(best.values())

        self._rows = rows
        return self._rows

    def _ensure_index(self) -> None:
        """Materialize the search structures — postings/vocab/trigram
        plus per-row match/display token bags.

        Split out of _load() on purpose (lowram lane): the postings
        side costs ~3× the slim rows in resident memory (~150 MB of
        token lists over 120 k rows) and is only read by search()
        — the last-resort T1 fallback that never fires when the C++ /
        ref index is up. Naming readers (_name_rows, _gaz_nearest,
        by_index, classify) only need the slim rows, so a prod task
        never pays for an index it never queries. If search() is ever
        hit, it builds the structures once and behaves exactly as
        before."""
        if self._postings is not None:
            return
        rows = self._load()
        postmap: dict = {}
        for i, r in enumerate(rows):
            if "match_tokens" not in r:
                r["match_tokens"] = self._match_tokens(
                    r["norm"], r.get("_raw_aliases") or [])
            for t in set(r["match_tokens"]):
                postmap.setdefault(t, []).append(i)
        self._vocab = sorted(postmap)
        self._postings = postmap
        tri: dict = {}
        for vid, tok in enumerate(self._vocab):
            for key in _trigrams(tok):
                tri.setdefault(key, []).append(vid)
        self._tri = tri

    def count(self) -> int:
        return len(self._load())

    def by_index(self, idx) -> Optional[dict]:
        for r in self._load():
            if r["idx"] == idx:
                return r
        return None

    # --- query ---------------------------------------------------------------
    def _candidates(self, groups: list) -> dict:
        """{row_i: {atom: quality}} — prefix scan + trigram-gated fuzzy."""
        self._ensure_index()
        atom_best: dict = {}
        vocab = self._vocab
        seen_atoms: set = set()
        atoms = [a for g in groups for alt in g for a in alt]
        for a in atoms:
            if a in seen_atoms:
                continue
            seen_atoms.add(a)
            scored: dict = {}
            lo = bisect.bisect_left(vocab, a)
            vid = lo
            while vid < len(vocab) and vocab[vid].startswith(a):
                scored[vid] = len(a) / len(vocab[vid])
                vid += 1
            la = len(a)
            if la >= 4:
                bound = 1 if la < 8 else 2
                for key in _trigrams(a):
                    for cvid in self._tri.get(key, ()):
                        if cvid in scored:
                            continue
                        t = vocab[cvid]
                        if abs(len(t) - la) > bound:
                            continue
                        d = _lev_bound(a, t, bound)
                        if d <= bound:
                            scored[cvid] = 1.0 - d / max(la, len(t))
            for vid2, qv in scored.items():
                for ri in self._postings[vocab[vid2]]:
                    row = atom_best.get(ri)
                    if row is None:
                        atom_best[ri] = {a: qv}
                    elif qv > row.get(a, 0.0):
                        row[a] = qv
        return atom_best

    def _kind_boost(self, atoms: set, kind: str) -> float:
        k = (kind or "").lower()
        for words, kinds in _INTENT_KINDS.items():
            if atoms & set(words):
                if any(s in k for s in kinds):
                    return KIND_BOOST
        else:
            if any(s in k for s in _LOCALITY_KINDS):
                return _LOCALITY_BOOST
        return 0.0

    _ADMIN_KINDS = ("district", "administrative")

    @staticmethod
    def _collapse_same_named(scored: list) -> list:
        """Same-named-place collapse — mirrors the client's sameNamedPlace
        (Mobile/src/search/client.ts): identical normalized names within
        75 m are one row; within 400 m when either side is an admin-area
        kind (a district/administrative row names the place it contains —
        the OSM 'Connaught Place' district centroid sits 117 m off the
        macrohood and used to double the row). Input is score-sorted; an
        earlier row wins, except an admin row hands its slot to a
        non-admin row of the same name (the actionable one)."""
        kept = []
        for cand in scored:
            cr = cand[2]
            dup = -1
            for i, k in enumerate(kept):
                if k[2]["norm"] != cr["norm"]:
                    continue
                dd = _haversine_m(k[2]["lat"], k[2]["lon"],
                                  cr["lat"], cr["lon"])
                if (dd < 75 or
                        (dd < 400 and (k[2]["kind"] in Gazetteer._ADMIN_KINDS
                                       or cr["kind"] in Gazetteer._ADMIN_KINDS))):
                    dup = i
                    break
            if dup < 0:
                kept.append(cand)
            elif (kept[dup][2]["kind"] in Gazetteer._ADMIN_KINDS
                  and cr["kind"] not in Gazetteer._ADMIN_KINDS):
                kept[dup] = cand
        return kept

    def search(self, q: str, lat: Optional[float] = None,
               lon: Optional[float] = None, limit: int = 8) -> list:
        rows = self._load()
        qn = normalize(q)
        self._ensure_index()
        if not rows or not qn or limit <= 0:
            return []
        blat = lat if lat is not None else 28.6139
        blon = lon if lon is not None else 77.2090

        groups = _query_groups(qn, alias_table())
        atom_best = self._candidates(groups)
        atoms_set = {a for g in groups for alt in g for a in alt}
        need = max(1, math.ceil(len(groups) * MIN_COV))

        scored = []
        for ri, amap in atom_best.items():
            r = rows[ri]
            # group quality: best fully-matched alternative (min atom
            # quality within the alternative)
            sum_q = 0.0
            matched = 0
            fuzzy = False
            for alts in groups:
                gq = 0.0
                for alt in alts:
                    aq = min(amap.get(a, 0.0) for a in alt)
                    if aq > gq:
                        gq = aq
                if gq > 0:
                    matched += 1
                    if not any(t.startswith(a)
                               for alt in alts for a in alt
                               for t in r["match_tokens"]):
                        fuzzy = True
                sum_q += gq
            if matched < need or matched == 0:
                continue
            # lead query token must be covered — kills the
            # 'X + locality-tail' noise ('haldiram chandni' must be a
            # haldiram hit, not any chandni hit)
            lead_alts = groups[0]
            if max((min(amap.get(a, 0.0) for a in alt)
                    for alt in lead_alts), default=0.0) <= 0:
                continue
            G = len(groups)
            pq, cov = sum_q / G, matched / G
            disp = r["norm"].split()
            # display precision — prefix either direction (cheap: the
            # term only breaks score ties between same-coverage rows)
            prec = (sum(1 for t in disp
                        if any(t.startswith(a) or a.startswith(t)
                               for a in atoms_set)) / len(disp)
                    if disp else 0.0)
            d = _haversine_m(blat, blon, r["lat"], r["lon"])
            score = (W_PQ * pq + W_COV * cov + W_POP * r["pop"]
                     + W_PREC * prec
                     + self._kind_boost(atoms_set, r["kind"])
                     - W_DIST * math.log1p(d / 1000.0))
            scored.append((score, d, r, cov, fuzzy))
        scored.sort(key=lambda t: (-t[0], t[1], t[2]["name"]))

        kept = self._collapse_same_named(scored)

        out = []
        for score, d, r, cov, fuzzy in kept[:limit]:
            if cov >= 1.0:
                cls = 0 if r["norm"].startswith(qn) else (2 if fuzzy else 1)
            else:
                cls = 3
            out.append({
                "id": (f"gaz:{r['idx']}" if isinstance(r["idx"], int)
                       else f"cor:{r['idx']}"),
                "name": r["name"],
                "subtitle": r["kind"],
                "lat": r["lat"], "lon": r["lon"],
                "kind": r["kind"],
                "match": ("exact-prefix" if cls == 0 else
                          "token-prefix" if cls == 1 else
                          "fuzzy" if cls == 2 else "other"),
                "match_rank": cls,
                "score": round(score, 4),
                "distance_m": round(d),
                "source": ("gazetteer" if isinstance(r["idx"], int)
                           else "corpus"),
                "sources": ["t1"],
            })
        return out


GAZ = Gazetteer()


# ===========================================================================
# /v2/ac — pure in-memory PREFIX type-ahead + load-time junk purge
# (lane X, oct11; docs/lanes/search-index-oct11.md)
#
# Never touches the network, never blocks a keystroke: the index is built
# once (background thread at import, double-checked lock), then every
# query is a bounded scan over pre-sorted postings (row id order == prior
# order, so caps keep the best rows). Earlier query tokens match WHOLE
# name tokens (or alias phrases), the LAST token matches as a prefix;
# the lead query token must be in the NAME (kind words like 'bakery'
# only boost matching categories, they never pick the row), and trailing
# words may be satisfied by the row's surrounding locality names.
#
# Junk purge = mechanisms, never per-name lists:
#  (a) far-named hubs: airport/rail/bus/station rows whose name names a
#      place >50 km from the row (world-places.json + the gazetteer's own
#      city/town rows) and names no locality within 25 km -> dropped
#  (b) hub category/name mismatch: an 'airport' row with no airport word
#      ('Fedex Gurgaon', Epson dealers) -> generic 'business' kind
#  (c) exact duplicates (same name+kind at the same ~11 m point)
#  (d) dispersed same-name rail/air hubs: copies >5 km apart keep only
#      the copies with the most same-name support nearby
# ===========================================================================
import heapq as _heapq
import logging as _logging
import threading as _threading

_log = _logging.getLogger("alive.ac")

WORLD_PLACES_PATHS = [
    os.environ.get("ALIVE_WORLD_PLACES", ""),
    os.path.join(_SERVER_DIR, "data", "world-places.json"),
]
# GeoNames rows for the outskirts ring the gazetteer stops short of
# (it is clipped to 28.0-29.07N / 76.6-78.02E: Panipat had 0 rows)
OUTSKIRTS_PATHS = [
    os.environ.get("ALIVE_OUTSKIRTS", ""),
    os.path.join(_SERVER_DIR, "data", "outskirts-geonames.json"),
]

_HUB_AIR = frozenset(("airport", "aerodrome", "heliport", "airstrip",
                      "airfield"))
_HUB_RAIL = frozenset(("train_station", "railway", "railway_station",
                       "station", "halt", "subway_station",
                       "metro_station", "light_rail_station", "terminal"))
_HUB_BUS = frozenset(("bus_station", "bus_terminal"))
_LODGING_KINDS = frozenset(("hotel", "resort", "guest_house", "guesthouse",
                            "hostel", "motel", "lodging", "homestay"))


def hub_class(kind: str) -> Optional[str]:
    """'air' | 'rail' | 'bus' | None for a gazetteer/corpus category."""
    k = (kind or "").lower().rsplit(":", 1)[-1]
    if k in _HUB_AIR:
        return "air"
    if k in _HUB_RAIL:
        return "rail"
    if k in _HUB_BUS:
        return "bus"
    return None


_AIR_WORDS = frozenset((
    "airport", "airports", "aerodrome", "heliport", "helipad", "airstrip",
    "airfield", "terminal", "arrival", "arrivals", "departure",
    "departures", "igi", "igia", "airforce", "hangar"))
_AIR_BIGRAMS = (("air", "port"), ("air", "force"), ("air", "strip"))
_RAIL_WORDS = frozenset((
    "station", "stn", "railway", "railways", "rail", "junction", "jn",
    "metro", "halt", "terminal", "terminus", "cantt", "cantonment",
    "platform", "isbt", "bus", "depot", "stand", "adda"))
# words that mark a business listing, not a hub — used only on hub rows
# whose name carries no hub word at all
_BIZ_WORDS = frozenset((
    "pvt", "ltd", "llp", "limited", "private", "inc", "bank", "finance",
    "store", "showroom", "office", "concepts", "solutions", "services",
    "enterprises", "industries", "corporation", "oyo", "hotel", "travels",
    "travel", "tours", "agency", "dealer", "reseller", "certified"))
# tokens that never make a locality phrase 'local evidence' on their own
_GENERIC_TOKS = frozenset((
    "station", "railway", "rail", "metro", "airport", "terminal", "road",
    "marg", "colony", "market", "nagar", "vihar", "enclave", "block",
    "sector", "phase", "village", "city", "new", "old", "east", "west",
    "north", "south", "main", "gate", "park", "the", "of", "bus", "stand",
    "depot", "halt", "junction", "cantt", "extension", "part", "pocket"))

_LOCAL_KINDS = frozenset((
    "locality", "neighborhood", "neighbourhood", "suburb", "village",
    "town", "city", "district", "administrative", "macrohood", "quarter",
    "sector", "hamlet", "borough", "residential", "county",
    "localadmin", "region", "state"))
# kinds that merely NAME a place rather than mark a feature on it —
# 'place'/'political' rows join the same-name collapse in query()
_AC_AREA_NAME_KINDS = _LOCAL_KINDS | {"place", "political"}
_AC_ADMIN_KINDS = frozenset(("district", "administrative", "county",
                             "localadmin", "region", "state"))
_CITY_KINDS = frozenset(("city", "town", "district", "administrative",
                         "county", "localadmin"))
# context radius (in 0.01-degree cells) a locality name lends to nearby
# rows: colony ~1 km, suburb/district ~2 km, town/city ~6.5 km
_AREA_RADIUS = {"city": 6, "town": 6, "county": 6, "localadmin": 4,
                "district": 2, "administrative": 2, "suburb": 2,
                "macrohood": 2, "borough": 2}
_LABEL_KINDS = frozenset(("locality", "neighborhood", "neighbourhood",
                          "suburb", "village", "macrohood", "quarter",
                          "sector", "town", "city", "hamlet"))

# hub-name words that don't identify WHICH station (dropped to get the
# station's core name for the dispersion check)
_HUB_CORE_DROP = frozenset((
    "station", "railway", "rail", "way", "stn", "junction", "jn", "metro",
    "terminal", "platform", "airport", "international", "domestic",
    "gate", "main", "no", "number", "entry", "exit", "parking", "the",
    "of", "and", "side", "halt", "india"))

# common toponym words — never a 'far city' on their own
_TOPO_GENERIC = frozenset("""
mandi khera khurd kalan haryana pradesh uttar rajasthan punjab nagar pur
ganj garh abad colony vihar enclave sector village delhi new old city
town cantt cantonment bazar bazaar chowk gaon basti
""".split())
# the gazetteer's own coverage — city/locality evidence only exists here
_CORE_BBOX = (28.0, 29.07, 76.6, 78.02)   # lat_min, lat_max, lon_min, lon_max


def _in_core(lat: float, lon: float) -> bool:
    return (_CORE_BBOX[0] <= lat <= _CORE_BBOX[1]
            and _CORE_BBOX[2] <= lon <= _CORE_BBOX[3])


FAR_KM = 50.0
LOCAL_KM = 25.0
DISPERSE_KM = 5.0
SUPPORT_KM = 1.5

_KIND_LABELS = {
    "train_station": "railway station", "station": "station",
    "bus_station": "bus station", "airport": "airport",
    "hindu_place_of_worship": "temple", "muslim_place_of_worship":
    "mosque", "christian_place_of_worship": "church",
    "sikh_place_of_worship": "gurdwara", "place_of_worship":
    "place of worship", "place_of_learning": "school",
    "college_university": "college", "historic_site": "historic site",
    "primary": "road", "secondary": "road", "tertiary": "road",
    "trunk": "road", "motorway": "road", "residential": "residential area",
    "locality": "area", "neighborhood": "area", "neighbourhood": "area",
    "suburb": "area", "macrohood": "area", "administrative": "district",
    "district": "district", "address": "address", "named": "place",
    "casual_eatery": "eatery", "fast_food_restaurant": "fast food",
    "shopping_mall": "mall", "bank_or_credit_union": "bank",
    "pharmacy_and_drug_store": "pharmacy", "gas_station": "petrol pump",
}

# query kind words -> category substrings they boost. A kind word is
# matched by the NAME first; otherwise a row whose category fits counts
# it as covered ('pawan bakery' -> a 'Pawan …' row filed as bakery).
_AC_KIND_WORDS = {
    "station": ("station", "rail", "halt", "terminal"),
    "railway": ("train_station", "railway", "rail"),
    "rail": ("train_station", "railway", "rail"),
    "junction": ("train_station", "railway"),
    "metro": ("station", "subway", "metro"),
    "airport": ("airport", "aerodrome"),
    "terminal": ("airport", "terminal", "bus_station", "train_station"),
    "bus": ("bus_station",), "isbt": ("bus_station",),
    "depot": ("bus_station",),
    "hospital": ("hospital", "clinic", "health", "medical"),
    "clinic": ("clinic", "health", "medical", "dental"),
    "temple": ("hindu_place_of_worship", "temple", "place_of_worship"),
    "mandir": ("hindu_place_of_worship", "temple", "place_of_worship"),
    "masjid": ("muslim_place_of_worship", "mosque"),
    "mosque": ("muslim_place_of_worship", "mosque"),
    "church": ("christian_place_of_worship", "church"),
    "gurudwara": ("sikh", "gurdwara", "place_of_worship"),
    "gurdwara": ("sikh", "gurdwara", "place_of_worship"),
    "school": ("school", "place_of_learning", "education"),
    "college": ("college", "university", "place_of_learning"),
    "university": ("college", "university"),
    "mall": ("shopping_mall", "mall"),
    "market": ("market", "shopping", "bazaar"),
    "bazar": ("market", "shopping", "bazaar"),
    "bazaar": ("market", "shopping", "bazaar"),
    "bakery": ("bakery", "bakeries", "cake", "confection", "sweet"),
    "sweets": ("sweet", "confection", "bakery"),
    "restaurant": ("restaurant", "eatery", "food", "dhaba"),
    "dhaba": ("restaurant", "eatery", "food", "dhaba"),
    "cafe": ("cafe", "coffee"),
    "hotel": ("hotel", "lodging", "resort", "guest"),
    "park": ("park", "garden"),
    "bank": ("bank", "financial"),
    "atm": ("atm",),
    "pharmacy": ("pharmacy", "drug", "chemist"),
    "chemist": ("pharmacy", "drug", "chemist"),
    "petrol": ("gas_station", "fuel"),
    "pump": ("gas_station", "fuel"),
    "gym": ("gym", "fitness"),
    "stadium": ("stadium", "sport"),
    "museum": ("museum",),
    "cinema": ("cinema", "theatre", "theater", "movie"),
    "police": ("police",),
}
_AC_STOP = frozenset("""
of the near opp opposite in at and to from behind beside front next
ke ki ka wala wali wale se
""".split())
# optional context: never required, never penalised when unmatched
_AC_NEUTRAL = frozenset(("delhi", "ncr", "india", "nct", "dilli"))

# score weights
AC_W_COV = 2.0
AC_W_LEAD = 0.6
AC_W_SEQ = 0.3
AC_W_PREC = 0.5
AC_W_PQ = 0.3
AC_W_KIND = 0.45
AC_W_PRIOR = 0.9
AC_W_DIST = 0.12
AC_AREA_CREDIT = 0.85
AC_KIND_CREDIT = 0.9
AC_LEAD_CAP = 1200      # whole-token lead postings evaluated (prior order)
AC_PREFIX_CAP = 1200    # prefix-lead candidates evaluated (prior order)
AC_EXTRA_CAP = 2500     # rarer-token rows checked for the lead
AC_SHORT_TOP = 600      # precomputed top rows for 1-2 char prefixes


def _hub_mismatch(toks: list, hc: Optional[str]) -> bool:
    """Mechanism (b): a hub-category row whose name is not a hub —
    'airport' rows with no airport word; rail/bus rows that read as a
    business listing and carry no station word."""
    if hc is None:
        return False
    tset = set(toks)
    if hc == "air":
        bigr = set(zip(toks, toks[1:]))
        return not (tset & _AIR_WORDS) and not any(
            b in bigr for b in _AIR_BIGRAMS)
    return not (tset & _RAIL_WORDS) and bool(tset & _BIZ_WORDS)


def hub_reclass(name: str, kind: str) -> Optional[str]:
    """'business' when a hub-category row's name is not a hub, else None
    (for rows coming from other engines)."""
    return "business" if _hub_mismatch(normalize(name).split(),
                                       hub_class(kind)) else None


def _cell(lat: float, lon: float) -> tuple:
    return (int(math.floor(lat * 100.0)), int(math.floor(lon * 100.0)))


def _fast_km(lat1, lon1, lat2, lon2) -> float:
    """Equirectangular distance — <0.5% error at NCR scale, ~5x cheaper
    than haversine in the hot loop."""
    x = math.radians(lon2 - lon1) * math.cos(math.radians((lat1 + lat2)
                                                           * 0.5))
    y = math.radians(lat2 - lat1)
    return 6371.0 * math.sqrt(x * x + y * y)


def _ngrams(toks: list, nmax: int = 4):
    n = len(toks)
    for i in range(n):
        for j in range(i + 1, min(n, i + nmax) + 1):
            yield i, j, tuple(toks[i:j])


def _load_world_places() -> dict:
    out: dict = {}
    for p in WORLD_PLACES_PATHS:
        if not p or not os.path.exists(p):
            continue
        try:
            with open(p, encoding="utf-8") as fh:
                raw = json.load(fh)
        except (OSError, ValueError):
            continue
        for item in (raw.get("places") if isinstance(raw, dict) else raw) \
                or []:
            try:
                name, lat, lon = item[0], float(item[1]), float(item[2])
            except (TypeError, ValueError, IndexError):
                continue
            toks = tuple(normalize(name).split())
            if toks:
                out.setdefault(toks, []).append((lat, lon))
        break
    return out


class AcIndex:
    """Prefix type-ahead over the bundled gazetteer — see section notes."""

    def __init__(self, paths=None):
        self._paths = paths if paths is not None else GAZETTEER_PATHS
        self._lock = _threading.Lock()
        self._ready = False
        self._building = False
        self.error: Optional[str] = None
        self.stats: dict = {}
        self.junk_keys: frozenset = frozenset()

    # --- build -------------------------------------------------------------
    @property
    def ready(self) -> bool:
        return self._ready

    def ensure(self) -> bool:
        """Build once (thread-safe). Returns readiness."""
        if self._ready:
            return True
        with self._lock:
            if self._ready:
                return True
            self._building = True
            try:
                self._build()
                self._ready = True
            except Exception as exc:  # never take the app down
                self.error = f"{type(exc).__name__}: {exc}"
                _log.exception("ac index build failed")
            finally:
                self._building = False
        return self._ready

    def warm_async(self) -> None:
        if self._ready or self._building:
            return
        t = _threading.Thread(target=self.ensure, name="alive-ac-build",
                              daemon=True)
        t.start()

    def _read_outskirts(self) -> list:
        for p in OUTSKIRTS_PATHS:
            if not p or not os.path.exists(p):
                continue
            try:
                with open(p, encoding="utf-8") as fh:
                    raw = json.load(fh)
            except (OSError, ValueError):
                continue
            rows = raw.get("rows") if isinstance(raw, dict) else raw
            return rows if isinstance(rows, list) else []
        return []

    def _read_rows(self) -> tuple:
        for p in self._paths:
            if not p or not os.path.exists(p):
                continue
            try:
                with open(p, "r", encoding="utf-8") as fh:
                    return json.load(fh), p
            except (OSError, ValueError):
                continue
        return [], None

    def _build(self) -> None:
        t0 = _time.perf_counter()
        data, path = self._read_rows()
        n_in = len(data)
        # ---- slim rows -------------------------------------------------
        recs = []   # [idx, name, toks(tuple), kind, lat, lon, prior]
        for i, e in enumerate(data):
            name = e.get("n") or ""
            lat, lon = e.get("lat"), e.get("lon")
            if not name or lat is None or lon is None:
                continue
            toks = tuple(sys.intern(t) for t in normalize(name).split())
            if not toks:
                continue   # non-latin-only names can't be typed here
            try:
                w = float(e.get("w") or 2.0)
                k = float(e.get("k") or 0.0)
                lat, lon = float(lat), float(lon)
            except (TypeError, ValueError):
                continue
            prior = max(0.0, min(1.0, 0.5 * (w - 2.0) / 10.0
                                 + 0.5 * min(1.0, max(0.0, k))))
            recs.append([i, name, toks, sys.intern(e.get("c") or "place"),
                         lat, lon, prior])
        del data
        n_typed = len(recs)

        # ---- locality evidence (phrase -> coords) -----------------------
        local_ph: dict = {}
        city_ph: dict = {}
        for r in recs:
            kind = r[3].lower()
            if kind not in _LOCAL_KINDS:
                continue
            toks = r[2]
            if all(t in _GENERIC_TOKS or t.isdigit() for t in toks):
                continue
            local_ph.setdefault(toks, []).append((r[4], r[5]))
            if kind in ("city", "town") and len(toks) <= 3 and not (
                    len(toks) == 1 and (toks[0] in _TOPO_GENERIC
                                        or len(toks[0]) < 4)):
                city_ph.setdefault(toks, []).append((r[4], r[5]))
        world = _load_world_places()

        def _near(coords, lat, lon, km):
            return any(_fast_km(lat, lon, a, b) <= km for a, b in coords)

        # ---- (a) far-named hubs + (b) category/name mismatch ------------
        dropped_far = 0
        reclass = 0
        far_examples = []
        junk_keys: set = set()
        keep = []
        for r in recs:
            hc = hub_class(r[3])
            # lodging named after a far city at a Delhi point ("Radisson
            # Hotel Shimla" on Lodhi Road) is the same junk as a far-named
            # station: a sales desk or a bad source pin, never the hotel
            lodging = (r[3] or "").lower().rsplit(":", 1)[-1] in _LODGING_KINDS
            if hc is None and not lodging:
                keep.append(r)
                continue
            toks = list(r[2])
            lat, lon = r[4], r[5]
            far_hit = None
            local_hit = False
            use_city = _in_core(lat, lon)
            for i, j, g in _ngrams(toks, 3):
                if g in world and not _near(world[g], lat, lon, FAR_KM):
                    far_hit = far_hit or " ".join(g)
                elif use_city and g in city_ph and not _near(
                        city_ph[g], lat, lon, FAR_KM):
                    far_hit = far_hit or " ".join(g)
            if far_hit:
                for i, j, g in _ngrams(toks, 4):
                    if g in local_ph and " ".join(g) != far_hit \
                            and _near(local_ph[g], lat, lon, LOCAL_KM):
                        local_hit = True
                        break
                if not local_hit:
                    dropped_far += 1
                    junk_keys.add((r[2], round(lat, 3), round(lon, 3)))
                    if len(far_examples) < 12:
                        far_examples.append(r[1])
                    continue
            if hc is not None and _hub_mismatch(toks, hc):
                # the hub category's weight was the only thing lifting
                # it — a business keeps just its own popularity
                r[3] = "business"
                r[6] = round(0.5 * r[6] if r[6] > 0.5 else r[6], 4)
                reclass += 1
            keep.append(r)
        recs = keep

        # ---- (c) exact duplicates ----------------------------------------
        best: dict = {}
        for r in recs:
            key = (r[2], r[3], round(r[4], 4), round(r[5], 4))
            prev = best.get(key)
            if prev is None or r[6] > prev[6]:
                best[key] = r
        n_before = len(recs)
        recs = list(best.values())
        dropped_dupe = n_before - len(recs)

        # ---- (d) dispersed same-name rail/air hubs ------------------------
        # a station has ONE place: copies of the same station core
        # ('new delhi' for 'New Delhi Railway Station', '… (NDLS)',
        # 'New Delhi Rail Way Station') >5 km apart keep only the copies
        # the most same-core hub rows corroborate within 1.5 km
        groups: dict = {}
        for r in recs:
            if hub_class(r[3]) in ("rail", "air"):
                core = tuple(dict.fromkeys(
                    t for t in r[2] if t not in _HUB_CORE_DROP))
                if len(core) >= 2:
                    groups.setdefault(core, []).append(r)
        dropped_disp = 0
        drop_ids = set()
        for core, members in groups.items():
            if len(members) < 2:
                continue
            spread = max(_fast_km(a[4], a[5], b[4], b[5])
                         for a in members for b in members)
            if spread <= DISPERSE_KM:
                continue
            sup = [sum(1 for o in members
                       if _fast_km(m[4], m[5], o[4], o[5]) <= SUPPORT_KM)
                   for m in members]
            top = max(sup)
            if top < 2:
                continue
            for m, s in zip(members, sup):
                # only uncorroborated copies go — two real terminals of
                # one airport both keep their own clusters
                if s == 1:
                    drop_ids.add(id(m))
        if drop_ids:
            n_before = len(recs)
            for r in recs:
                if id(r) in drop_ids:
                    junk_keys.add((r[2], round(r[4], 3), round(r[5], 3)))
            recs = [r for r in recs if id(r) not in drop_ids]
            dropped_disp = n_before - len(recs)
        self.junk_keys = frozenset(junk_keys)

        # evidence kept for junk_reason() (rows from other engines)
        self._ev = (world, city_ph, local_ph)

        # ---- outskirts rows (GeoNames, widened bbox) ----------------------
        # added AFTER the purge so they never act as junk 'evidence';
        # a row the gazetteer already names within 2 km is skipped
        n_geo = 0
        geo_rows = self._read_outskirts()
        if geo_rows:
            have: dict = {}
            for r in recs:
                have.setdefault(r[2], []).append((r[4], r[5]))
            for e in geo_rows:
                try:
                    name = e["n"]
                    lat, lon = float(e["lat"]), float(e["lon"])
                    w = float(e.get("w") or 2.0)
                    k = float(e.get("k") or 0.0)
                except (KeyError, TypeError, ValueError):
                    continue
                toks = tuple(sys.intern(t) for t in normalize(name).split())
                if not toks:
                    continue
                # a row the purge already judged junk never sneaks back in
                # through the outskirts file (same name at the same point)
                if (toks, round(lat, 3), round(lon, 3)) in self.junk_keys:
                    continue
                if any(_fast_km(lat, lon, a, b) <= 2.0
                       for a, b in have.get(toks, ())):
                    continue
                prior = max(0.0, min(1.0, 0.5 * (w - 2.0) / 10.0
                                     + 0.5 * min(1.0, max(0.0, k))))
                recs.append([f"geo:{e.get('g')}", name, toks,
                             sys.intern(e.get("c") or "place"), lat, lon,
                             prior])
                n_geo += 1

        # ---- order by prior (row id == prior rank) ------------------------
        recs.sort(key=lambda r: (-r[6], r[1]))
        n = len(recs)
        self.idx = [r[0] for r in recs]
        self.names = [r[1] for r in recs]
        self.toks = [r[2] for r in recs]
        self.kinds = [r[3] for r in recs]
        self.lat = [r[4] for r in recs]
        self.lon = [r[5] for r in recs]
        self.prior = [r[6] for r in recs]

        # ---- postings + sorted vocab ---------------------------------------
        post: dict = {}
        for rid, toks in enumerate(self.toks):
            for t in set(toks):
                lst = post.get(t)
                if lst is None:
                    post[sys.intern(t)] = [rid]
                else:
                    lst.append(rid)
        self.post = post
        self.vocab = sorted(post)
        # top rows for 1-2 char prefixes (the only ranges too fat to
        # merge per keystroke)
        short: dict = {}
        for t, lst in post.items():
            for L in (1, 2):
                if len(t) >= L:
                    short.setdefault(t[:L], []).append(lst)
        self.short = {}
        for p, lists in short.items():
            out = []
            seen = set()
            for rid in _heapq.merge(*lists):
                if rid in seen:
                    continue
                seen.add(rid)
                out.append(rid)
                if len(out) >= AC_SHORT_TOP:
                    break
            self.short[p] = out

        # ---- area context: locality postings (token -> locality rows) ----
        # a trailing query word is 'context' when a locality carrying it
        # covers the candidate's cell; per query we turn each context
        # token into a cell set once (cached), so the hot loop is one
        # set lookup per candidate
        lpost: dict = {}
        lrad = bytearray(n)
        label_cells: dict = {}
        for rid in range(n):
            kind = self.kinds[rid].lower()
            if kind not in _LOCAL_KINDS:
                continue
            toks = self.toks[rid]
            if all(t in _GENERIC_TOKS or t.isdigit() for t in toks):
                continue
            lrad[rid] = _AREA_RADIUS.get(kind, 1)
            for t in set(toks):
                lpost.setdefault(t, []).append(rid)
            if kind in _LABEL_KINDS:
                label_cells.setdefault(_cell(self.lat[rid], self.lon[rid]),
                                       []).append(rid)
        self.lpost = lpost
        self.lvocab = sorted(lpost)
        self.lrad = lrad
        self._ctx_cache: dict = {}
        self.label_cells = label_cells
        self.source_path = path
        alias_table()   # first keystroke must not pay the file read

        self.stats = {
            "rows_in": n_in, "rows_typed": n_typed, "rows_indexed": n,
            "dropped_far_named_hubs": dropped_far,
            "reclassified_hub_mismatch": reclass,
            "dropped_exact_duplicates": dropped_dupe,
            "dropped_dispersed_hub_copies": dropped_disp,
            "outskirts_rows_added": n_geo,
            "far_examples": far_examples,
            "vocab": len(self.vocab), "locality_tokens": len(self.lvocab),
            "build_s": round(_time.perf_counter() - t0, 2),
            "source": os.path.basename(path or ""),
        }
        _log.warning("ac index: %s", {k: v for k, v in self.stats.items()
                                      if k != "far_examples"})

    # --- query -------------------------------------------------------------
    def _prefix_rows(self, p: str, cap: int) -> list:
        """Row ids having a name token starting with p, best prior
        first, at most cap."""
        if len(p) <= 2:
            return self.short.get(p, [])[:cap]
        vocab = self.vocab
        lo = bisect.bisect_left(vocab, p)
        hi = bisect.bisect_left(vocab, p + "\uffff")
        if lo >= hi:
            return []
        if hi - lo == 1:
            return self.post[vocab[lo]][:cap]
        lists = [self.post[vocab[i]] for i in range(lo, hi)]
        total = sum(len(x) for x in lists)
        if total <= cap:
            return sorted(set().union(*lists))
        out = []
        seen = set()
        for rid in _heapq.merge(*lists):
            if rid in seen:
                continue
            seen.add(rid)
            out.append(rid)
            if len(out) >= cap:
                break
        return out

    def _whole_rows(self, alts: list, cap: int) -> list:
        """Rows whose name holds any alternative phrase (all atoms)."""
        out = set()
        for alt in alts:
            if len(alt) == 1:
                lst = self.post.get(alt[0])
                if lst:
                    out.update(lst[:cap])
                continue
            lists = [self.post.get(a) for a in alt]
            if not all(lists):
                continue
            base = min(lists, key=len)
            for rid in base[:cap * 2]:
                toks = self.toks[rid]
                if all(a in toks for a in alt):
                    out.add(rid)
        return sorted(out)[:cap] if len(out) > cap else sorted(out)

    def _ctx_cells(self, t: str, prefix: bool) -> frozenset:
        """Cells a locality carrying token t (or a token starting with t
        when prefix) lends context to. Cached per (token, mode)."""
        key = (t, prefix)
        hit = self._ctx_cache.get(key)
        if hit is not None:
            return hit
        rows: list = []
        if prefix:
            if len(t) >= 3:
                lv = self.lvocab
                lo = bisect.bisect_left(lv, t)
                hi = bisect.bisect_left(lv, t + "\uffff")
                for i in range(lo, min(hi, lo + 400)):
                    rows.extend(self.lpost[lv[i]])
        else:
            rows = self.lpost.get(t, [])
        cells = set()
        lat_l, lon_l, lrad = self.lat, self.lon, self.lrad
        for rid in rows[:6000]:
            r = lrad[rid]
            ci, cj = _cell(lat_l[rid], lon_l[rid])
            for di in range(-r, r + 1):
                for dj in range(-r, r + 1):
                    cells.add((ci + di, cj + dj))
        fs = frozenset(cells)
        if len(self._ctx_cache) > 2048:
            self._ctx_cache.clear()
        self._ctx_cache[key] = fs
        return fs

    def _label(self, rid: int) -> str:
        """Nearest locality name (3x3 cells) for a subtitle, or ''."""
        lat, lon = self.lat[rid], self.lon[rid]
        ci, cj = _cell(lat, lon)
        best = None
        for di in (-1, 0, 1):
            for dj in (-1, 0, 1):
                for lid in self.label_cells.get((ci + di, cj + dj), ()):
                    if lid == rid:
                        continue
                    d = _fast_km(lat, lon, self.lat[lid], self.lon[lid])
                    if d <= 1.6 and (best is None or d < best[0]):
                        best = (d, lid)
        return self.names[best[1]] if best else ""

    def query(self, q: str, lat: Optional[float] = None,
              lon: Optional[float] = None, limit: int = 10) -> list:
        if not self.ensure():
            return []
        qn = normalize(q)
        qtoks = qn.split()
        if not qtoks or limit <= 0:
            return []
        n_q = len(qtoks)
        last_i = n_q - 1
        table = alias_table()
        # alias alternatives per token (whole-token semantics)
        alts = []
        for t in qtoks:
            a = [(t,)]
            for ph in table.get(t, ()):
                tup = tuple(ph)
                if tup and tup not in a:
                    a.append(tup)
            alts.append(a)
        is_kind = [t in _AC_KIND_WORDS for t in qtoks]
        # a prefix of a kind word counts as that kind word for boosting
        kind_subs = []
        for i, t in enumerate(qtoks):
            if is_kind[i]:
                kind_subs.extend(_AC_KIND_WORDS[t])
            elif i == last_i and len(t) >= 3:
                for kw, subs in _AC_KIND_WORDS.items():
                    if kw.startswith(t):
                        kind_subs.extend(subs)
        # the lead = first token that names the place
        lead = None
        for i, t in enumerate(qtoks):
            if t in _AC_STOP:
                continue
            if is_kind[i] and n_q > 1 and any(
                    not is_kind[j] and qtoks[j] not in _AC_STOP
                    for j in range(n_q)):
                continue
            lead = i
            break
        if lead is None:
            lead = 0
        lead_tok = qtoks[lead]
        # ---- candidates ------------------------------------------------
        if lead == last_i:
            cands = self._prefix_rows(lead_tok, AC_PREFIX_CAP)
            if len(lead_tok) <= 2:
                cands = list(cands)
            # alias phrase of a complete short key ('cp')
            if len(alts[lead]) > 1:
                cands = sorted(set(cands) | set(
                    self._whole_rows(alts[lead][1:], AC_LEAD_CAP)))
        else:
            cands = self._whole_rows(alts[lead], AC_LEAD_CAP)
            cset = None
            # strict rows beyond the cap: rarer tokens that also carry
            # the lead ('sector 62': the '62' postings holding 'sector')
            for i, t in enumerate(qtoks):
                if i == lead or t in _AC_STOP:
                    continue
                if i == last_i:
                    extra = self._prefix_rows(t, AC_EXTRA_CAP) \
                        if len(t) >= 3 else []
                else:
                    extra = self.post.get(t, [])
                    if len(extra) > AC_EXTRA_CAP:
                        continue
                if not extra:
                    continue
                if cset is None:
                    cset = set(cands)
                for rid in extra:
                    if rid not in cset:
                        toks = self.toks[rid]
                        if any(all(a in toks for a in alt)
                               for alt in alts[lead]):
                            cset.add(rid)
            if cset is not None:
                cands = cset
        if not cands:
            return []
        blat = lat if lat is not None else 28.6139
        blon = lon if lon is not None else 77.2090
        has_bias = lat is not None and lon is not None
        # 1-2 typed chars say little about the name: nearby matters more
        w_dist = AC_W_DIST * (1.0 if has_bias else 0.5) * (
            2.0 if len(qn) <= 2 else 1.0)
        # a query made only of kind words ('airport', 'metro station')
        # names no place — no 'name starts with' bonus for any row
        kind_only = all(is_kind[i] or qtoks[i] in _AC_STOP
                        for i in range(n_q)) or (
            n_q == 1 and len(qtoks[0]) >= 3 and any(
                kw.startswith(qtoks[0]) for kw in _AC_KIND_WORDS))
        last = qtoks[last_i]
        name_q = [i for i in range(n_q) if qtoks[i] not in _AC_STOP]
        denom_base = len(name_q)
        scored = []
        toks_l, kinds_l, lat_l, lon_l, prior_l = (
            self.toks, self.kinds, self.lat, self.lon, self.prior)
        # context cell sets per non-lead token (lazy: only built when a
        # candidate misses the token in its name)
        ctx: dict = {}

        def _ctx_for(i: int) -> frozenset:
            cs = ctx.get(i)
            if cs is None:
                t = qtoks[i]
                cs = self._ctx_cells(t, i == last_i)
                for alt in alts[i][1:]:
                    if len(alt) == 1:
                        cs = cs | self._ctx_cells(alt[0], False)
                ctx[i] = cs
            return cs

        for rid in cands:
            toks = toks_l[rid]
            # lead must be a NAME hit
            if lead == last_i:
                lead_ok = any(t.startswith(lead_tok) for t in toks) or (
                    len(alts[lead]) > 1 and any(
                        all(a in toks for a in alt)
                        for alt in alts[lead][1:]))
            else:
                lead_ok = any(all(a in toks for a in alt)
                              for alt in alts[lead])
            if not lead_ok:
                continue
            rlat, rlon = lat_l[rid], lon_l[rid]
            area = None
            kind_l = None
            got = 0.0
            denom = denom_base
            name_hits = 0
            pq = 0.0
            matched_name_toks = set()
            for i in name_q:
                t = qtoks[i]
                hit = False
                if i == last_i:
                    bestlen = 0
                    for nt in toks:
                        if nt.startswith(t):
                            if bestlen == 0 or len(nt) < bestlen:
                                bestlen = len(nt)
                            matched_name_toks.add(nt)
                    if bestlen:
                        hit = True
                        pq = len(t) / bestlen
                    elif len(alts[i]) > 1:
                        for alt in alts[i][1:]:
                            if all(a in toks for a in alt):
                                hit = True
                                pq = 1.0
                                matched_name_toks.update(alt)
                                break
                else:
                    for alt in alts[i]:
                        if all(a in toks for a in alt):
                            hit = True
                            matched_name_toks.update(alt)
                            break
                if hit:
                    got += 1.0
                    name_hits += 1
                    continue
                # kind word satisfied by the row's category
                if is_kind[i]:
                    if kind_l is None:
                        kind_l = kinds_l[rid].lower()
                    if any(s in kind_l for s in _AC_KIND_WORDS[t]):
                        got += AC_KIND_CREDIT
                        continue
                # locality context around the row
                if i != lead:
                    if area is None:
                        area = _cell(rlat, rlon)
                    if area in _ctx_for(i):
                        got += AC_AREA_CREDIT
                        continue
                if t in _AC_NEUTRAL:
                    denom -= 1
            cov = got / denom if denom > 0 else 1.0
            lead_bonus = 0.0 if kind_only else AC_W_LEAD if (
                toks[0].startswith(lead_tok) if lead == last_i
                else toks[0] == lead_tok) else 0.0
            seq = 0.0
            if lead == 0 and n_q > 1 and len(toks) >= n_q:
                if all(toks[k] == qtoks[k] for k in range(last_i)) and \
                        toks[last_i].startswith(last):
                    seq = AC_W_SEQ
            prec = len(matched_name_toks & set(toks)) / len(toks)
            kb = 0.0
            if kind_subs:
                if kind_l is None:
                    kind_l = kinds_l[rid].lower()
                if any(s in kind_l for s in kind_subs):
                    kb = AC_W_KIND
            d_km = _fast_km(blat, blon, rlat, rlon)
            score = (AC_W_COV * cov + lead_bonus + seq
                     + (0.0 if kind_only else AC_W_PREC * prec)
                     + AC_W_PQ * pq + kb + AC_W_PRIOR * prior_l[rid]
                     - w_dist * math.log1p(d_km))
            scored.append((score, rid, d_km, cov, name_hits))
        if not scored:
            return []
        top = _heapq.nlargest(limit * 4, scored)
        out = []
        kept = []
        for score, rid, d_km, cov, name_hits in top:
            norm = " ".join(toks_l[rid])
            # a name with no letters is a pincode or a '00' house-name
            if not re.search(r"[a-z]", norm):
                continue
            dup = -1
            for ki, k_rid in enumerate(kept):
                if " ".join(toks_l[k_rid]) != norm:
                    continue
                dd = _fast_km(lat_l[rid], lon_l[rid], lat_l[k_rid],
                              lon_l[k_rid])
                # 300 m for any same-name pair; unconditionally when
                # both rows merely NAME an area ('saket' returned 8
                # rows — macrohood, locality, place and the admin
                # centroids all naming one place, and the typeahead
                # shows no subtitle that could tell them apart anyway)
                if (dd < 0.3 or
                        (kinds_l[rid].lower() in _AC_AREA_NAME_KINDS and
                         kinds_l[k_rid].lower() in _AC_AREA_NAME_KINDS)):
                    dup = ki
                    break
            if dup >= 0:
                # an admin row names the place it contains — a locality
                # row of the same name is the actionable one and takes
                # the slot (mirrors Gazetteer._collapse_same_named)
                k_rid = kept[dup]
                if (kinds_l[k_rid].lower() in _AC_ADMIN_KINDS and
                        kinds_l[rid].lower() not in _AC_ADMIN_KINDS):
                    kept[dup] = rid
                continue
            kept.append(rid)
            if norm.startswith(qn):
                mr = 0
            elif name_hits >= denom_base and cov >= 0.999:
                mr = 1
            else:
                mr = 3
            kind = kinds_l[rid]
            label = _KIND_LABELS.get(kind, kind.replace("_", " "))
            area_name = "" if kind.lower() in _LOCAL_KINDS else \
                self._label(rid)
            if area_name and normalize(area_name) in norm:
                area_name = ""
            sub = f"{label} · {area_name}" if area_name else label
            ridx = self.idx[rid]
            geo = isinstance(ridx, str)
            out.append({
                "id": ridx if geo else f"gaz:{ridx}",
                "name": self.names[rid],
                "subtitle": sub,
                "kind": kind,
                "lat": lat_l[rid], "lon": lon_l[rid],
                "distance_m": round(d_km * 1000.0),
                "match_rank": mr,
                "match": ("exact-prefix" if mr == 0 else
                          "token-prefix" if mr == 1 else "other"),
                "score": round(score, 4),
                "source": "geonames" if geo else "gazetteer",
                "sources": ["ac"],
            })
            if len(out) >= limit:
                break
        return out

    # --- junk verdict for rows that come from other engines -------------
    def junk_reason(self, name: str, kind: str, lat: float,
                    lon: float) -> Optional[str]:
        """Why a T1/T3 row from another engine is junk under the same
        mechanisms the index applies at load ((a) far-named hub, (d)
        uncorroborated hub copy), or None when clean / not ready."""
        if not self._ready or hub_class(kind) is None:
            return None
        try:
            lat, lon = float(lat), float(lon)
        except (TypeError, ValueError):
            return None
        toks = normalize(name).split()
        if (tuple(toks), round(lat, 3), round(lon, 3)) in self.junk_keys:
            return "junk-row"
        far = self._far_verdict(toks, lat, lon)
        return f"far:{far}" if far else None

    def by_id(self, pid: str) -> Optional[dict]:
        """Resolve a /v2/ac id ('gaz:<idx>' / 'geo:<geonameid>') without
        touching the heavy corpus loader. None when unknown/not ready."""
        if not self._ready or not pid:
            return None
        pos = getattr(self, "_id_pos", None)
        if pos is None:
            pos = {}
            for rid, ridx in enumerate(self.idx):
                pos[ridx if isinstance(ridx, str) else f"gaz:{ridx}"] = rid
            self._id_pos = pos
        rid = pos.get(pid)
        if rid is None:
            return None
        kind = self.kinds[rid]
        return {"id": pid, "name": self.names[rid],
                "subtitle": _KIND_LABELS.get(kind, kind.replace("_", " ")),
                "lat": self.lat[rid], "lon": self.lon[rid], "kind": kind,
                "source": "geonames" if pid.startswith("geo:")
                else "gazetteer"}

    def is_locality_phrase(self, toks) -> bool:
        """A locality row is named exactly these tokens."""
        if not self._ready or not toks:
            return False
        toks = tuple(toks)
        for rid in self.lpost.get(toks[0], ()):
            if self.toks[rid] == toks:
                return True
        return False

    def _far_verdict(self, toks: list, lat: float, lon: float):
        ev = getattr(self, "_ev", None)
        if ev is None:
            return None
        world, city_ph, local_ph = ev
        far_hit = None
        # outside the gazetteer's coverage there is no city/locality
        # evidence to judge by — only the world list applies there
        use_city = _in_core(lat, lon)
        for i, j, g in _ngrams(toks, 3):
            if g in world and not any(
                    _fast_km(lat, lon, a, b) <= FAR_KM for a, b in world[g]):
                far_hit = far_hit or " ".join(g)
            elif use_city and g in city_ph and not any(
                    _fast_km(lat, lon, a, b) <= FAR_KM
                    for a, b in city_ph[g]):
                far_hit = far_hit or " ".join(g)
        if not far_hit:
            return None
        for i, j, g in _ngrams(toks, 4):
            if g in local_ph and " ".join(g) != far_hit and any(
                    _fast_km(lat, lon, a, b) <= LOCAL_KM
                    for a, b in local_ph[g]):
                return None
        return far_hit


AC = AcIndex()
