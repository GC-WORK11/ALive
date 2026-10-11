/* Alive webapp — Google/Uber-style place search for Delhi + NCR + outskirts.

   A.search.live(q, bias, onRows, opts?) -> cancel()
     Progressive type-ahead. onRows(rows, {final, stage}) fires every time
     a tier lands; rows are already merged + ranked + de-duplicated.
       tier 0 (sync)   DIGIPIN → exact row; the previous list re-ranked for
                       the new text (the list narrows instantly, never blanks)
       tier 1 (~0.4s)  /v2/ac (our prefix index, 1.5 s; falls back to /v2/search)
                       ∥ /v2/p/ac (Ola + Mappls proxy, own 4 s budget — long
                       text takes 0.5–3.5 s there; painted the moment it lands;
                       silent until keyed / 404)
       tier 2 (deep)   only when NOTHING from tier 1 carries the name (index
                       and providers both settled), after a ≥700 ms typing
                       pause, on Enter (opts.enter) or when tier 1 is weak:
                       Photon, Overpass, anchor decomposition — HARD 3.5 s cap.
                       A provider row carrying the name skips it even on Enter.
                       Nominatim only on explicit Enter (its policy bans
                       autocomplete).
     final:true arrives exactly once per live() unless cancelled.
   A.search.search(q, bias, opts?) -> Promise<rows>   final rows, same tiers
   A.search.reverse(lat, lon) -> Promise<name|null>
   A.search.inArea(lat, lon)  coverage box (NCR + outskirts)
   A.search.inDelhi(lat, lon) Delhi proper (home.js "outside Delhi" note)

   Row: {name, sub, kind, lat, lon, dist (metres | null), source, key, full}
     full = holds every typed word (last as prefix) — partials rank below
   Ranking narrows like Google: the leading words are the NAME; kind words
   (bakery, mandir, metro…) only hint; rows holding every typed word (the
   last one as a prefix) beat partial matches; numbers must agree. Rows
   carrying the name always outrank locality/area/road rows that don't
   (anchor gravity only reorders rows that carry the name); locality words
   found in a row's address are a strong bonus. Word matching is
   transliteration-insensitive (neelanchal ≈ Nilanchal, dham ≈ Dhaam,
   masjid ≈ masjeed, iskcon ≈ iskon) — matching keys only, never shown. */
(() => {
'use strict';

/* coverage: Delhi + whole NCR + UP/Haryana/Rajasthan outskirts
   (Panipat, Sonipat, Rohtak, Meerut, Hapur, Bulandshahr, Palwal, Rewari…) */
const AREA = { minLat: 27.6, maxLat: 29.9, minLon: 75.9, maxLon: 78.5 };
const inArea = (lat, lon) =>
  lat >= AREA.minLat && lat <= AREA.maxLat &&
  lon >= AREA.minLon && lon <= AREA.maxLon;
/* Delhi proper — only for callers that ask "is this Delhi" (home.js) */
const DELHI_BBOX = { minLat: 28.35, maxLat: 28.95, minLon: 76.75, maxLon: 77.55 };
const inDelhi = (lat, lon) =>
  lat >= DELHI_BBOX.minLat && lat <= DELHI_BBOX.maxLat &&
  lon >= DELHI_BBOX.minLon && lon <= DELHI_BBOX.maxLon;

const DELHI_CENTER = { lat: 28.6139, lon: 77.2090 };
const PAUSE_MS = 700;      /* typing pause that earns the deep tier */
const DEEP_CAP_MS = 3500;  /* hard cap on the deep tier */
const AC_MS = 1500;        /* tier-1 /v2/ac timeout (our fast prefix index) */
const PROV_MS = 4000;      /* tier-1 /v2/p/ac budget (Ola + Mappls + bridging) */
const ENGINE_MS = 4500;
const MAX_ROWS = 10;

/* ── text tools ─────────────────────────────────────────────────── */

/* STOP feeds the ANCHOR logic only (deep tier) — never name matching */
const STOP = new Set(['near', 'next', 'to', 'at', 'the', 'of', 'in', 'on',
  'opp', 'opposite', 'behind', 'by', 'beside', 'and', 'or', 'a', 'an',
  'delhi', 'new', 'dilli', 'ncr', 'india', 'pin', 'code',
  'block', 'pocket', 'flat', 'house', 'no']);

/* name-matching word classes */
const CONNECT = new Set(['near', 'next', 'to', 'at', 'the', 'of', 'in', 'on',
  'opp', 'opposite', 'behind', 'by', 'beside', 'and', 'or', 'a', 'an',
  'ke', 'ka', 'ki', 'paas', 'pass', 'wali', 'wala']);
const REGION = new Set(['delhi', 'dilli', 'ncr', 'india']);
const STRUCT = new Set(['block', 'blk', 'pocket', 'pkt', 'flat', 'house', 'no',
  'h', 'hno', 'plot', 'gali', 'lane', 'floor', 'khasra', 'ward', 'phase',
  'part', 'sector', 'sec', 'nagar', 'vihar', 'colony', 'enclave', 'extension',
  'extn', 'road', 'rd', 'marg', 'street', 'st', 'pin', 'code']);

/* tokens that commonly END a delhi locality name */
const ANCHOR_TAIL = new Set(['nagar', 'vihar', 'pur', 'pura', 'puri', 'abad',
  'bagh', 'colony', 'enclave', 'extension', 'extn', 'garhi', 'garh', 'sarai',
  'khadar', 'khas', 'kailash', 'ganj', 'estate', 'town', 'sector', 'sec',
  'block', 'pocket', 'phase', 'part', 'road', 'marg', 'street', 'chowk',
  'chungi', 'square', 'circle', 'market', 'wala', 'place', 'village',
  'park', 'nagri', 'kunj', 'lok', 'pahari', 'dwara',
  'shahdara', 'noida', 'gurgaon', 'gurugram', 'ghaziabad', 'faridabad',
  'dwarka', 'rohini', 'burari', 'sarai', 'paharganj', 'mandi']);

/* kind-vocabulary expansion. These are words, not places: 'bace' is
   ISKCON's academy, a 'dham' is a temple-family name, a 'bakery' hides
   under 'confectionery'. */
const KIND_ALIAS = {
  mandir: ['mandir', 'temple'],
  temple: ['temple', 'mandir'],
  dham: ['dham', 'mandir', 'jagannath', 'iskcon'],
  neelanchal: ['neelanchal', 'nilanchal', 'neelachal', 'nilachal', 'jagannath', 'iskcon'],
  nilanchal: ['neelanchal', 'nilanchal', 'neelachal', 'nilachal', 'jagannath', 'iskcon'],
  neelachal: ['neelanchal', 'nilanchal', 'neelachal', 'nilachal', 'jagannath', 'iskcon'],
  bace: ['bace', 'iskcon'],
  iskcon: ['iskcon', 'hare krishna'],
  bakery: ['bakery', 'confectionery', 'pastry', 'sweets'],
  confectionery: ['confectionery', 'bakery', 'sweets', 'pastry'],
  sweets: ['sweets', 'confectionery', 'bakery'],
  pastry: ['pastry', 'bakery', 'confectionery'],
  market: ['market', 'bazaar', 'bazar', 'mart'],
  bazaar: ['bazaar', 'bazar', 'market'],
  bazar: ['bazar', 'bazaar', 'market'],
  masjid: ['masjid', 'mosque'],
  mosque: ['mosque', 'masjid'],
  gurgaon: ['gurgaon', 'gurugram'],
  gurugram: ['gurugram', 'gurgaon'],
  shop: ['shop', 'store', 'mart'],
  store: ['store', 'shop', 'mart'],
  lake: ['lake', 'jheel', 'sarovar'],
  jheel: ['jheel', 'lake', 'sarovar'],
  gurudwara: ['gurudwara', 'gurdwara'],
  gurdwara: ['gurudwara', 'gurdwara'],
  hospital: ['hospital', 'clinic', 'nursing'],
  clinic: ['clinic', 'hospital', 'nursing'],
  school: ['school', 'vidyalaya'],
  college: ['college'],
  metro: ['metro', 'station'],
  atm: ['atm'],
  bank: ['bank', 'atm'],
  hotel: ['hotel', 'lodge', 'oyo'],
  park: ['park', 'garden', 'udyan', 'vatika'],
  pharmacy: ['pharmacy', 'chemist', 'medical'],
  chemist: ['chemist', 'pharmacy', 'medical'],
};
/* words that name a KIND of place — hints that boost matching kinds,
   never the name itself ('pawan bakery' is Pawan's, not any bakery) */
const KINDW = new Set([...Object.keys(KIND_ALIAS).filter((k) =>
  !['neelanchal', 'nilanchal', 'neelachal', 'iskcon', 'bace', 'gurgaon', 'gurugram'].includes(k)),
'station', 'railway', 'rail', 'junction', 'airport', 'terminal', 'bus', 'stand',
'stop', 'depot', 'mall', 'cinema', 'restaurant', 'cafe', 'dhaba', 'gym',
'police', 'thana', 'post', 'office', 'petrol', 'pump', 'church', 'stadium',
'university', 'library', 'museum', 'fort', 'tomb', 'garden', 'hostel', 'pg',
'dispensary', 'medical', 'store', 'shop', 'showroom', 'salon', 'parlour']);

const norm = (s) => (s || '').toLowerCase()
  .replace(/[.'’‘,;:!?()\-_/\\#&+"]/g, ' ').replace(/\s+/g, ' ').trim();

/* transliteration-insensitive MATCHING key for one word (never displayed):
   diacritics off (ā→a), ph→f, ck/kc→k, q→k, w→v, z→j, ee→i, oo→u, then
   any doubled letter → one (aa→a, ii→i, uu→u, ll→l…). Digits untouched.
   neelanchal≈nilanchal, dhaam≈dham, masjeed≈masjid, iskcon≈iskon. */
const TKEY = new Map();
function tkey(t) {
  t = String(t || '');
  let k = TKEY.get(t);
  if (k !== undefined) return k;
  k = t.toLowerCase();
  if (/[^\x00-\x7f]/.test(k)) k = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  k = k.replace(/ph/g, 'f').replace(/ck|kc/g, 'k').replace(/q/g, 'k')
    .replace(/w/g, 'v').replace(/z/g, 'j')
    .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/([a-z])\1+/g, '$1');
  if (TKEY.size > 5000) TKEY.clear();
  TKEY.set(t, k);
  return k;
}
/* alias + kind lookups by key too ('masjeed' → masjid's aliases) */
const KIND_ALIAS_K = {};
for (const [k, v] of Object.entries(KIND_ALIAS)) KIND_ALIAS_K[tkey(k)] = v;
const aliasOf = (t) => KIND_ALIAS[t] || KIND_ALIAS_K[tkey(t)];
const KINDW_K = new Set([...KINDW].map(tkey));

const sigTokens = (q) => norm(q).split(' ').filter((t) => t && !STOP.has(t));

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hav(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* anchor-logic token match: prefix-tolerant both ways
   ('sec' hits 'sector' via prefix; 'sanjay' hits 'sanjays'). */
const tokHit = (q, n) => q === n || n.startsWith(q) || (q.length >= 4 && q.startsWith(n));

/* edit distance ≤ 1 (one typo) */
function ed1(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, e = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++e > 1) return false;
    if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
  }
  return e + (la - i) + (lb - j) <= 1;
}

/* name-matching token hit. `last` = the word being typed → prefix.
   Numbers match exactly (150 ≠ 1500) unless still being typed. */
function hit(q, n, last) {
  if (q === n) return true;
  const digit = /^\d/.test(q);
  if (digit) return !!last && n.startsWith(q);
  if ((last || q.length >= 3) && n.startsWith(q)) return true;
  if (q.length >= 4 && n.length >= 3 && q.length - n.length <= 1 && q.startsWith(n)) return true;
  if (q.length >= 5 && n.length >= 4 && ed1(q, n)) return true;
  if (last && q.length >= 5 && n.length > q.length && ed1(q, n.slice(0, q.length))) return true;
  return false;
}

/* ── query analysis ─────────────────────────────────────────────── */

function analyze(q) {
  const raw = String(q || '');
  const toks = norm(raw).split(' ').filter(Boolean);
  const open = !/\s$/.test(raw);     /* trailing space = last word complete */
  const items = toks.map((t, i) => {
    const last = i === toks.length - 1 && open;
    let w = 1, req = true, cls = 'name';
    if (CONNECT.has(t) && !last) { w = 0; req = false; cls = 'conn'; }
    else if (REGION.has(t)) { w = 0.5; req = false; cls = 'region'; }
    else if (/^\d+[a-z]?$/.test(t)) { w = 1.2; cls = 'num'; }
    else if (KINDW.has(t) || (t.length >= 4 && KINDW_K.has(tkey(t)))) { w = 0.7; cls = 'kind'; }
    else if (STRUCT.has(t)) { w = 0.4; req = false; cls = 'struct'; }
    else if (t.length === 1) { w = last ? 0.5 : 0.3; req = last; cls = 'letter'; }
    return { t, k: tkey(t), i, last, w, req, cls };
  });
  /* the NAME starts at the first real word or number ('sector 150 noida'
     → 150; 'pawan bakery …' → pawan) */
  const lead = items.find((x) => (x.cls === 'name' && x.t.length >= 2) || x.cls === 'num') || null;
  /* the word after the lead completes the name ('pawan BAKERY', 'jama
     MASJID', 'iskcon EAST'); connectors, region words, letters skipped */
  const second = lead ? items.find((x) => x.i > lead.i && x.t.length >= 2 &&
    (x.cls === 'name' || x.cls === 'kind' || x.cls === 'num' || x.cls === 'struct')) || null : null;
  const nums = items.filter((x) => x.cls === 'num').map((x) => x.t.replace(/[a-z]$/, ''));
  /* looks like an address: a house/plot/block number next to address words */
  const addrish = nums.length > 0 && (items.some((x) => x.cls === 'struct' || x.cls === 'letter') ||
    /\b[a-z]\s*-?\s*\d+\b/i.test(raw));
  const wsum = items.reduce((s, x) => s + x.w, 0);
  const core = items.filter((x) => x.cls !== 'conn' && x.cls !== 'region').map((x) => x.t).join(' ');
  const coreK = core.split(' ').map(tkey).join(' ');
  const allK = toks.map(tkey).join(' ');
  const nWords = items.filter((x) => x.cls !== 'conn').length;
  const hasKind = items.some((x) => x.cls === 'kind');
  return { raw, toks, items, lead, second, nums, addrish, wsum, core, coreK, allK, nWords, hasKind };
}

/* ── row hygiene ────────────────────────────────────────────────── */

/* raw tags → plain words ('amenity:place of worship' → 'place of worship') */
const TAG_WORDS = {
  hindu_place_of_worship: 'temple', muslim_place_of_worship: 'mosque',
  sikh_place_of_worship: 'gurudwara', christian_place_of_worship: 'church',
  buddhist_place_of_worship: 'temple', jain_place_of_worship: 'temple',
  place_of_worship: 'place of worship', train_station: 'railway station',
  railway_station: 'railway station', subway_station: 'metro station',
  subway: 'metro station', halt: 'railway station', bus_station: 'bus station',
  bus_stop: 'bus stop', fuel: 'petrol pump', administrative: 'area',
  place: '', yes: '', landuse: '', building: '', unknown: '', node: '', way: '',
  relation: '', house: 'address', address: 'address', street_address: 'address',
  premise: 'address', residential: 'residential area', suburb: 'area',
  neighbourhood: 'area', neighborhood: 'area', quarter: 'area', hamlet: 'village',
  city: 'city', town: 'town', village: 'village', locality: 'locality',
  pharmacy_and_drug_store: 'pharmacy', atm: 'ATM', digipin: 'DIGIPIN',
};
const TAG_PREFIX = /^(amenity|shop|tourism|leisure|overture|osm|building|highway|railway|landuse|place|office|historic|craft|healthcare|natural|man_made|public_transport|aeroway|club|sport|emergency|boundary|category|poi|religion)\s*[:=]\s*/i;
function plainTag(s) {
  let t = String(s || '').trim();
  if (!t) return '';
  t = t.replace(TAG_PREFIX, '');
  const k = t.toLowerCase().replace(/[\s-]+/g, '_');
  if (Object.prototype.hasOwnProperty.call(TAG_WORDS, k)) return TAG_WORDS[k];
  return t.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}
const tagLike = (p) => TAG_PREFIX.test(p) || /_/.test(p) || /^[a-z ]+$/.test(p);
function plainSub(sub, kind, name) {
  const nn = norm(name);
  const seen = new Set();
  const parts = String(sub || '').split(/\s+·\s+|\s*\|\s*/).map((p) => p.trim())
    .map((p) => (tagLike(p) ? plainTag(p) : p))
    .filter((p) => {
      const k = norm(p);
      if (!k || k === nn || seen.has(k)) return false;
      seen.add(k); return true;
    });
  if (!parts.length) { const k = plainTag(kind); if (k && norm(k) !== nn) parts.push(k); }
  return parts.join(' · ');
}

const AREA_KIND = /^(administrative|area|locality|town|city|village|suburb|neighbou?rhood|district|state|county|quarter|hamlet|residential|region|place)$/i;

function tidy(r, bias) {
  if (!r || !r.name) return null;
  const lat = +r.lat, lon = +r.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inArea(lat, lon)) return null;
  const name = String(r.name).trim();
  if (!name) return null;
  const kind = r.kind || '';
  const row = {
    name, sub: plainSub(r.sub, kind, name), kind: plainTag(kind) || kind,
    rawKind: kind, lat, lon,
    dist: bias ? (Number.isFinite(+r.dist) && r.dist != null ? +r.dist : hav(bias.lat, bias.lon, lat, lon)) : null,
    source: r.source || '', key: `${name}|${lat.toFixed(4)}|${lon.toFixed(4)}`,
  };
  if (r.mrank != null) row.mrank = r.mrank;
  if (r.erank != null) row.erank = r.erank;
  if (r.prov) row.prov = true;
  if (r.exact) row.exact = true;
  if (r._deep) row._deep = true;
  if (r._anchor) row._anchor = true;
  return row;
}

/* ── ranking ────────────────────────────────────────────────────── */

function rowToks(r) {
  if (!r._ntk) {
    r._nn = norm(r.name);
    r._nt = r._nn.split(' ');
    r._ntk = r._nt.map(tkey);
    r._nk = r._ntk.join(' ');
    r._stk = norm(`${r.sub} ${r.kind} ${r.rawKind || ''}`).split(' ').filter(Boolean);
    r._stkk = r._stk.map(tkey);
    /* the address alone (locality words), without the kind words */
    r._sbt = norm(r.sub).split(' ').filter(Boolean);
    r._sbtk = r._sbt.map(tkey);
  }
}

/* item vs a token list: transliteration keys first (prefix logic on keys —
   'neel' finds 'Nilanchal'), the raw spelling as a fallback */
function hitIn(item, toks, keys) {
  for (let i = 0; i < toks.length; i++) {
    if (hit(item.k, keys[i], item.last) || (item.k !== item.t && hit(item.t, toks[i], item.last))) return 1;
  }
  const alts = aliasOf(item.t);
  if (alts) {
    for (const a of alts) {
      if (a === item.t) continue;
      const parts = a.split(' ').map(tkey);
      if (parts.length > 1 ? parts.every((p) => keys.includes(p))
        : keys.some((n) => n === parts[0] || n.startsWith(parts[0]))) return 0.85;
    }
  }
  return 0;
}

/* a locality / area / road row — the WHERE, not the thing asked for */
const PLACE_KIND = /\b(administrative|area|locality|sublocality|suburb|neighbou?rhood|district|county|quarter|hamlet|residential|region|city|village|road|street|route|highway|bridge|motorway)\b/i;
const ROADISH = new Set(['road', 'rd', 'marg', 'bridge', 'flyover', 'street', 'lane', 'highway',
  'expressway', 'underpass', 'chowk', 'crossing', 'chauraha']);
function placeLike(r) {
  if (AREA_KIND.test(r.rawKind || '') || PLACE_KIND.test(`${r.rawKind || ''} ${r.kind || ''}`)) return true;
  return ROADISH.has(r._nt[r._nt.length - 1]);
}
/* a road / junction / stop NAMED AFTER the thing ('Iskcon Chowk', 'Jama
   Masjid Road', '… Metro Station', '… Bus Stop') while the text asked for
   none of those — the thing itself comes first */
const DERIVED = new Set([...ROADISH, 'circle', 'parking', 'stop', 'stand', 'depot', 'metro',
  'station', 'gate', 'junction', 'halt']);
const ASKS_DERIVED = new Set([...DERIVED, 'railway', 'rail', 'bus', 'airport', 'terminal']);
function derived(r, qa) {
  if (qa.askDerived === undefined) {
    qa.askDerived = qa.items.some((x) => ASKS_DERIVED.has(x.t) ||
      (x.last && x.t.length >= 2 && [...DERIVED].some((d) => d.startsWith(x.t))));
  }
  return !qa.askDerived && r._nt.some((t) => DERIVED.has(t));
}

/* query asks a number (sector 27) but the row carries a different one
   (sec 18) — the classic wrong-neighbourhood trap */
function numMismatch(qa, r) {
  if (!qa.nums.length) return false;
  const nn = `${r._nn} ${r._stk.join(' ')}`.match(/\d+/g) || [];
  if (!nn.length) return false;
  return !qa.nums.some((q) => nn.includes(q));
}

function scoreRow(r, ctx) {
  const qa = ctx.qa;
  rowToks(r);
  if (r.exact) { r._s = 99; r._tier = 9; r._cover = true; return r._s; }
  let cov = 0, full = true, leadName = 0, locW = 0, secondHit = 0;
  if (ctx.anchorPts && ctx.anchorPts.length) {
    r._dA = Math.min(...ctx.anchorPts.map((p) => hav(p.lat, p.lon, r.lat, r.lon)));
  } else r._dA = null;
  for (const it of qa.items) {
    if (!it.w) continue;
    const hn = hitIn(it, r._nt, r._ntk);
    let c = hn;
    if (!c) {
      const hs = hitIn(it, r._stk, r._stkk);
      if (hs) {
        c = it.cls === 'name' ? 0.5 * hs : hs;
        /* a word the NAME lacks but the ADDRESS holds ('… sant nagar',
           '… shahdara'): the row is in the locality the user named */
        if (it !== qa.lead && hitIn(it, r._sbt, r._sbtk)) {
          locW += (it.cls === 'name' || it.cls === 'num' ? 1 : 0.4) * it.w;
        }
      }
    }
    /* a locality word is also covered by standing inside that locality */
    if (!c && ctx.anchorToks && ctx.anchorToks.has(it.t) && r._dA != null && r._dA < 2500) c = 0.8;
    if (it === qa.lead) leadName = hn;
    if (it === qa.second) secondHit = c;
    cov += it.w * c;
    if (it.req && !c) full = false;
  }
  cov = qa.wsum ? cov / qa.wsum : 0;
  if (qa.lead && !leadName) full = false;
  /* the gate: with a name in the query, a row must carry that name or
     most of the words — 'Amar Bakery' never answers 'pawan bakery' */
  if (!r._anchor && (qa.lead ? (!leadName && cov < (ctx.relaxed ? 0.2 : 0.5)) : cov < (ctx.relaxed ? 0.2 : 0.5))) return null;
  /* carries the NAME: the lead word itself (not an alias) in the name,
     the next word in the name or the address */
  const cover = !!qa.lead && leadName >= 1 && (!qa.second || secondHit > 0);
  /* tier: rows carrying the name > name-carrying localities/roads when a
     kind was asked ('Jama Masjid Road' for 'jama masjid …') or the words
     aren't all there > rows without the name (localities, anchors) */
  const isNoisy = noisy(r, qa);   /* 'OYO Rooms East of Kailash ISKCON' — never the answer */
  const tier = !qa.lead ? 1 : !leadName ? 0 : (isNoisy || (placeLike(r) && (qa.hasKind || !full))) ? 1 : 2;
  const nameStart = qa.lead && (hit(qa.lead.k, r._ntk[0], qa.lead.last) || hit(qa.lead.t, r._nt[0], qa.lead.last));
  let prox;
  if (r.dist != null) prox = ctx.bias ? 1 / (1 + r.dist / 15000) : Math.max(0.2, 1 / (1 + r.dist / 60000));
  else prox = 0.4;
  let s = 2.2 * cov + (full ? 1.2 : 0) + (leadName ? 1.0 * leadName : 0) +
    (nameStart ? 0.3 : 0) + 0.9 * prox;
  if (qa.core && (r._nn === qa.core || r._nk === qa.coreK || r._nk === qa.allK)) s += 0.4;   /* exact name */
  /* the name AND the place: locality words found in the address */
  if (leadName && locW) s += Math.min(1.4, 0.45 * locW);
  /* a provider row carrying the name knows the shop/temple we don't */
  if (cover) s += r.prov ? 0.6 : 0.2;
  if (leadName && derived(r, qa)) s -= 0.7;
  /* tight names beat long ones that merely contain the words
     ('Sector 150' over 'Apollo Pharmacy Noida Sector 150') */
  s -= 0.07 * Math.max(0, r._nt.length - qa.nWords);
  /* the place itself, not a hotel/office named after it
     ('OYO Rooms East of Kailash ISKCON' never answers 'iskcon east of kailash') */
  if (isNoisy) s -= 0.8;
  /* only words, no kind asked: the area/locality is the answer */
  if (!qa.hasKind && AREA_KIND.test(r.rawKind || '') && full) s += 0.3;
  /* the index's / provider's own order carries prominence we can't see */
  if (r.erank != null) s += 0.25 * Math.max(0, 1 - r.erank / 12);
  if (r.mrank >= 3) s -= 1.0;   /* engine's 'other' verdict — demoted rows never lead */
  if (numMismatch(qa, r)) s -= 0.6;
  /* provider house/address hits lead when the text is an address */
  if (qa.addrish && (r.prov || /address|house|premise|building/i.test(r.rawKind || '')) &&
      qa.nums.some((n) => `${r._nn} ${r._stk.join(' ')}`.match(/\d+/g)?.includes(n))) s += 0.9;
  /* resolved-anchor gravity: a row inside the locality the query named
     beats a same-named thing 20km across the city. Within a tier only —
     it reorders rows that carry the name, it never lifts a locality /
     bridge / road over them. */
  if (r._dA != null) {
    s += 1.2 / (1 + r._dA / 2600);
    if (r._dA > 14000) s -= 1.0;
    if (r._deep) s += 0.55;
  }
  /* hysteresis: rows already on screen hold their place unless clearly
     beaten — the list narrows instead of jumping */
  const pi = ctx.prev ? ctx.prev.get(r.key) : undefined;
  if (pi != null) s += 0.3 * Math.max(0, 1 - pi / 12);
  r._s = s; r._full = full; r._lead = !!leadName; r._cov = cov;
  r._tier = tier; r._cover = cover;
  /* public: the row holds every typed word (last as prefix; aliases,
     one typo and "inside the named locality" count) */
  r.full = full;
  return s;
}

/* rank + filter + de-duplicate (same name at the same spot) */
function rank(rows, ctx) {
  const kept = [];
  for (const r of rows) if (scoreRow(r, ctx) != null) kept.push(r);
  kept.sort((a, b) => b._tier - a._tier || b._s - a._s || (a.dist ?? 9e9) - (b.dist ?? 9e9));
  const out = [];
  const span = (x) => (AREA_KIND.test(x.rawKind || '') ? 15000 : 250);
  for (const r of kept) {
    if (out.some((o) => o._nn === r._nn &&
        hav(o.lat, o.lon, r.lat, r.lon) < Math.max(span(o), span(r)))) continue;
    out.push(r);
    if (out.length >= MAX_ROWS) break;
  }
  return out;
}

/* lodging / agents / travel desks named after the landmark the user typed */
const NOISY_KIND = /hotel|lodg|guest|hostel|\boyo\b|travel|\btours?\b|tour_|real.?estate|estate_agent|property|rental|courier|transport_service|packers|movers/i;
const STAY_Q = /\b(hotel|hotels|stay|lodge|oyo|hostel|guest|pg|rooms?|travel|tours?|agent|office|property|rent|rental)\b/i;
function noisy(r, qa) {
  if (STAY_Q.test(qa.raw)) return false;
  return NOISY_KIND.test(`${r.rawKind || ''} ${r.kind || ''}`) || /^oyo\b/i.test(r.name);
}

/* is the current top good enough to stop (no deep tier)? */
function decent(rows, qa) {
  const top = rows[0];
  if (!top) return false;
  if (top.exact) return true;
  if (noisy(top, qa)) return false;
  if (qa.lead) return top._full && top._lead;
  return top._cov >= 0.75 && (top.dist == null || top.dist < 8000);
}

/* something on the list carries the NAME (lead + next word; not a road /
   locality merely named after it) — the browser deep tier has nothing to
   add. byProv: only provider rows count. */
const named = (rows, byProv) =>
  rows.some((r) => r._cover && r._tier >= 2 && !r.exact && (!byProv || r.prov));

/* ── fetch layer ────────────────────────────────────────────────── */

const apiBase = () => {
  if (A.api && typeof A.api.base === 'string') return A.api.base;
  try {
    const q = new URLSearchParams(location.search).get('api');
    if (q) return q.replace(/\/$/, '');
  } catch (e) { /* no location (tests) */ }
  return '';
};

/* fetch JSON with a timeout and an optional outer abort signal; never throws */
async function getJ(url, ms, signal, init) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  const off = () => c.abort();
  if (signal) {
    if (signal.aborted) c.abort();
    else signal.addEventListener('abort', off, { once: true });
  }
  try {
    const r = await fetch(url, { ...(init || {}), signal: c.signal });
    if (!r.ok) return { status: r.status, j: null };
    let j = null;
    try { j = await r.json(); } catch (e) { return { status: r.status, j: null, notJson: true }; }
    return { status: r.status, j };
  } catch (e) {
    return { status: 0, j: null, aborted: !!(signal && signal.aborted) };
  } finally {
    clearTimeout(t);
    if (signal) signal.removeEventListener('abort', off);
  }
}

const biasQS = (q, bias) => {
  const b = bias || DELHI_CENTER;
  return new URLSearchParams({ q, lat: b.lat, lon: b.lon }).toString();
};

/* tiny response cache: backspace / retype repaints instantly */
const rcache = new Map();
const rkey = (ep, q, bias) =>
  `${ep}|${norm(q)}|${bias ? (+bias.lat).toFixed(3) + ',' + (+bias.lon).toFixed(3) : '-'}`;
function rget(k) {
  const v = rcache.get(k);
  if (!v || Date.now() - v.t > 300000) return null;
  return v.rows;
}
function rput(k, rows) {
  if (rcache.size > 300) rcache.delete(rcache.keys().next().value);
  rcache.set(k, { rows, t: Date.now() });
}

const fromEngine = (r, i) => ({
  name: r.name, sub: r.subtitle || r.sub || '', kind: r.kind || '',
  lat: r.lat, lon: r.lon, dist: r.distance_m, source: 'delhi index',
  /* engine's own verdict — 'other' covers partial matches AND far-city
     corpus artifacts the server demotes */
  mrank: r.match_rank, erank: i,
});
const fromProvider = (r, i) => ({
  name: r.name, sub: r.sub || r.address || '', kind: r.kind || '',
  lat: r.lat, lon: r.lon, dist: r.distance_m, source: r.source || 'provider', prov: true,
  erank: i,
});

/* /v2/ac → our fast prefix index. 404 (not deployed) flips to /v2/search
   for the rest of the page-load; a timeout falls back for this query only. */
let acState = 'unknown', acFails = 0, acRetry = 0;
async function acRows(q, bias, signal) {
  const t0 = Date.now();
  const qs = biasQS(q, bias);
  if (acState === 'missing' && acRetry && Date.now() > acRetry) acState = 'unknown';
  if (acState !== 'missing') {
    const r = await getJ(`${apiBase()}/v2/ac?${qs}`, AC_MS, signal);
    if (r.j && Array.isArray(r.j.results)) {
      acState = 'ok'; acFails = 0;
      return { rows: r.j.results.map(fromEngine), via: 'ac' };
    }
    if (signal && signal.aborted) return null;
    /* not deployed (404 / an HTML fallback page) → our engine for this
       page-load; two plain failures in a row → engine for a minute */
    if (r.status === 404 || r.status === 405 || r.notJson) { acState = 'missing'; acRetry = 0; }
    else if (++acFails >= 2) { acState = 'missing'; acRetry = Date.now() + 60000; acFails = 0; }
  }
  /* tier 1 never exceeds ENGINE_MS in total */
  const rows = await engineSearch(q, bias, signal, Math.max(1500, ENGINE_MS - (Date.now() - t0)));
  return { rows, via: 'engine' };
}

async function engineSearch(q, bias, signal, ms = ENGINE_MS) {
  const r = await getJ(`${apiBase()}/v2/search?${biasQS(q, bias)}`, ms, signal);
  if (!r.j || !Array.isArray(r.j.results)) return [];
  return r.j.results.map(fromEngine);
}

/* provider proxy (Ola + Mappls). {configured:false} until keys exist —
   then stay quiet for 10 min; 404 (not deployed) → quiet for the page-load */
const prov = { st: 'unknown', until: 0 };
/* will a /v2/p call be made at all? (not 404'd / unconfigured) */
const provLive = () => prov.st !== 'missing' && !(prov.st === 'off' && Date.now() < prov.until);
/* /v2/p/ac gets its OWN budget (PROV_MS): Ola + Mappls (+ Ola geocode
   bridging Mappls rows to coordinates) takes 0.5–3.5 s on long text — the
   old shared 1.5 s cut aborted it and the provider rows never painted */
async function providerRows(path, q, bias, signal) {
  if (!provLive()) return [];
  const b = bias || DELHI_CENTER;
  const p = new URLSearchParams(path === 'geocode' ? { address: q, lat: b.lat, lon: b.lon } : { q, lat: b.lat, lon: b.lon });
  const r = await getJ(`${apiBase()}/v2/p/${path}?${p}`, path === 'geocode' ? 3500 : PROV_MS, signal);
  if (r.status === 404 || r.status === 405 || r.notJson) { prov.st = 'missing'; return []; }
  if (r.j && r.j.configured === false) { prov.st = 'off'; prov.until = Date.now() + 600000; return []; }
  if (r.j && Array.isArray(r.j.results)) {
    prov.st = 'ok';
    return r.j.results.filter((x) => x && typeof x === 'object').map(fromProvider);
  }
  return [];
}

async function photonSearch(q, bias, signal) {
  const b = bias || DELHI_CENTER;
  const u = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8` +
    `&lat=${b.lat}&lon=${b.lon}` +
    `&bbox=${AREA.minLon},${AREA.minLat},${AREA.maxLon},${AREA.maxLat}`;
  const r = await getJ(u, 3000, signal);
  if (!r.j) return [];
  return (r.j.features || []).map((f) => {
    const p = f.properties || {};
    const lat = f.geometry.coordinates[1], lon = f.geometry.coordinates[0];
    const street = [p.housenumber, p.street].filter(Boolean).join(' ');
    return {
      name: p.name || street || p.district || q,
      sub: [p.name && street ? street : '', p.district || p.locality, p.city || p.county, p.state]
        .filter(Boolean).join(', '),
      kind: p.osm_value || p.osm_key || 'place',
      lat, lon, dist: bias ? hav(bias.lat, bias.lon, lat, lon) : null,
      source: 'openstreetmap',
    };
  }).filter((x) => inArea(x.lat, x.lon));
}

/* Nominatim: explicit Enter ONLY (usage policy forbids autocomplete) */
async function nominatimSearch(q, bias, signal) {
  const vb = `${AREA.minLon},${AREA.maxLat},${AREA.maxLon},${AREA.minLat}`;
  const u = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}` +
    `&format=json&limit=8&countrycodes=in&viewbox=${vb}&bounded=1`;
  const r = await getJ(u, 3000, signal, { headers: { 'Accept-Language': 'en' } });
  if (!Array.isArray(r.j)) return [];
  return r.j.map((x) => ({
    name: (x.display_name || '').split(',')[0] || q,
    sub: (x.display_name || '').split(',').slice(1, 4).join(',').trim(),
    kind: x.type || x.class || 'place',
    lat: +x.lat, lon: +x.lon,
    dist: bias ? hav(bias.lat, bias.lon, +x.lat, +x.lon) : null,
    source: 'openstreetmap',
  })).filter((x) => inArea(x.lat, x.lon));
}

/* overpass: full-planet public instances only. A mirror that FAILS (not
   one we cancelled) is remembered for the session. */
const OP_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];
const opDead = new Set();

async function overpass(query, ms = 3400, signal) {
  const live = OP_ENDPOINTS.filter((b) => !opDead.has(b));
  if (!live.length) return [];
  const attempt = async (base) => {
    const r = await getJ(`${base}?data=${encodeURIComponent(query)}`, ms, signal);
    if (r.j && Array.isArray(r.j.elements)) return r.j.elements;
    if (!(signal && signal.aborted) && !r.aborted && r.status !== 0) opDead.add(base);
    throw new Error('overpass failed');
  };
  const els = await Promise.any(live.map(attempt)).catch(() => null);
  if (!els) return [];
  return els.map((e) => {
    const c = e.center || { lat: e.lat, lon: e.lon };
    const t = e.tags || {};
    return {
      name: t.name,
      sub: [t['addr:street'], t['addr:suburb'] || t['addr:city']].filter(Boolean).join(', ') ||
        t.amenity || t.shop || t.tourism || t.leisure || t.place || t.office || '',
      kind: t.amenity || t.shop || t.tourism || t.leisure || t.place || t.office || '',
      lat: c.lat, lon: c.lon, source: 'openstreetmap',
    };
  }).filter((x) => x.name && x.lat != null && inArea(x.lat, x.lon));
}

function overpassNearAnchors(points, radiusM, regex, limit = 12, signal) {
  const unions = points
    .map((p) => `nwr["name"~"${regex}",i](around:${radiusM},${p.lat},${p.lon});`)
    .join('');
  return overpass(`[out:json][timeout:4];(${unions});out center ${limit};`, 3400, signal);
}

/* raw name scan around the user (±~35 km, clipped to the coverage box) —
   the whole NCR box is too big for a public mirror to scan in time */
function overpassByName(regex, limit = 10, bias, signal) {
  const b = bias || DELHI_CENTER, d = 0.32;
  const bb = [Math.max(AREA.minLat, b.lat - d), Math.max(AREA.minLon, b.lon - d),
    Math.min(AREA.maxLat, b.lat + d), Math.min(AREA.maxLon, b.lon + d)].join(',');
  return overpass(`[out:json][timeout:4];nwr["name"~"${regex}",i](${bb});out center ${limit};`, 3400, signal);
}

/* ── anchor decomposition (deep tier) ───────────────────────────── */

/* structural words that describe a place's shape, not its name */
const GENERIC_TAIL = new Set(['nagar', 'vihar', 'pur', 'pura', 'puri',
  'abad', 'bagh', 'colony', 'enclave', 'extension', 'extn', 'garhi',
  'garh', 'sarai', 'khadar', 'khas', 'ganj', 'estate', 'town', 'sector',
  'sec', 'block', 'pocket', 'phase', 'part', 'road', 'marg', 'street',
  'chowk', 'chungi', 'square', 'circle', 'market', 'wala', 'place',
  'village', 'park', 'nagri', 'kunj', 'lok', 'pahari', 'dwara',
  'sarai', 'mandi']);

function anchorCandidates(qToks) {
  const out = [], seen = new Set();
  const push = (arr) => {
    if (!arr.length || arr.length >= qToks.length) return;
    if (arr.includes(qToks[0])) return;
    if (arr.length === 1 && GENERIC_TAIL.has(arr[0])) return;
    if (!arr.some((t) => !KIND_ALIAS[t] && !GENERIC_TAIL.has(t))) return;
    const s = arr.join(' ');
    if (s && !seen.has(s)) { seen.add(s); out.push(s); }
  };
  for (let n = Math.min(3, qToks.length - 1); n >= 1; n--) push(qToks.slice(-n));
  for (let i = 0; i < qToks.length; i++) {
    if (!ANCHOR_TAIL.has(qToks[i])) continue;
    for (let n = 3; n >= 1; n--) {
      if (i - n + 1 < 0) continue;
      const cand = qToks.slice(i - n + 1, i + 1);
      if (cand.length === 1 && cand[0].length < 4) continue;
      push(cand);
    }
  }
  return out.slice(0, 6);
}

function anchorFit(row, aToks) {
  const n = norm(`${row.name} ${row.sub}`).split(' ').map(tkey);
  let h = 0;
  for (const t of aToks) { const k = tkey(t); if (n.some((x) => hit(k, x, false))) h++; }
  return h / aToks.length;
}

const nameSim = (qToks, row) => {
  if (!qToks.length) return 0;
  const nToks = norm(`${row.name} ${row.sub}`).split(' ').map(tkey);
  let h = 0;
  for (const q of qToks) {
    const alts = aliasOf(q), k = tkey(q);
    if (nToks.some((n) => tokHit(k, n) || (alts && alts.some((a) => tokHit(tkey(a), n))))) h++;
  }
  return h / qToks.length;
};

/* p's value, or `fb` once ms pass — the deep tier never waits on a slow layer */
const within = (p, ms, fb = []) => Promise.race([
  Promise.resolve(p).catch(() => fb),
  new Promise((res) => setTimeout(() => res(fb), ms)),
]);

async function resolveAnchor(cand, bias, enter, signal, useEngine = true) {
  const aToks = sigTokens(cand);
  const [eng, ph, nm] = await Promise.all([
    useEngine ? within(engineSearch(cand, bias, signal), 1300) : Promise.resolve([]),
    within(photonSearch(cand, bias, signal), 1300),
    enter ? within(nominatimSearch(cand, bias, signal), 1500) : Promise.resolve([]),
  ]);
  const fit = [...eng, ...ph, ...nm]
    .filter((r) => r && r.lat != null && inArea(r.lat, r.lon))
    .map((r) => ({ r, fit: anchorFit(r, aToks) }))
    .filter((x) => x.fit >= 0.66)
    /* pure-name rows first: the locality literally called 'Vaishali'
       beats 'Vaishali Motors' */
    .map((x) => ({
      ...x,
      pure: norm(x.r.name).split(' ').every((t) => aToks.includes(t)) ? 1 : 0,
    }))
    .sort((a, b) => b.fit - a.fit || b.pure - a.pure ||
      (a.r.dist ?? 9e9) - (b.r.dist ?? 9e9));
  if (!fit.length) return [];
  const maxFit = fit[0].fit;
  return fit.filter((x) => x.fit >= maxFit - 0.01).map((x) => x.r);
}

const leadToks = (qToks, aToks) =>
  qToks.filter((t) => !aToks.includes(t) && (t.length >= 3 || /^\d+$/.test(t)));

function buildLeadRegex(qToks, aToks) {
  const lead = leadToks(qToks, aToks);
  const terms = new Set();
  for (const t of lead.slice(0, 4)) {
    terms.add(t);
    (KIND_ALIAS[t] || []).forEach((a) => terms.add(a));
  }
  if (!terms.size) return null;
  return [...terms].slice(0, 8).map(escRe).join('|');
}

/* per resolved anchor, ask the text geocoders for '<lead words> <anchor>'
   (one variant swaps kind-words for their broadest alias). Each answer
   is handed to `add` the moment it lands. */
async function anchorGeoRows(anchors, qToks, aToksAll, bias, enter, signal, add) {
  const lead = leadToks(qToks, aToksAll);
  if (!lead.length) return;
  const re = buildLeadRegex(qToks, aToksAll);
  const rx = re ? new RegExp(re, 'i') : null;
  const keep = (rows) => {
    const out = [];
    for (const r of rows || []) {
      if (!r || r.lat == null) continue;
      const near = anchors.reduce((best, p) =>
        hav(p.lat, p.lon, r.lat, r.lon) < hav(best.lat, best.lon, r.lat, r.lon)
          ? p : best, anchors[0]);
      if (hav(near.lat, near.lon, r.lat, r.lon) > 5000) continue;
      if (rx && !rx.test(`${r.name} ${r.sub}`) && nameSim(lead, r) < 0.4) continue;
      out.push({ ...r, erank: undefined, _deep: true });
    }
    if (out.length) add(out);
  };
  const jobs = [];
  let engineLeft = 1;     /* one engine call; Photon carries the variants */
  for (const a of anchors.slice(0, 3)) {
    const variants = new Set([`${lead.join(' ')} ${a._cand}`]);
    const broad = lead.map((t) => {
      const al = KIND_ALIAS[t];
      return al ? al[al.length - 1] : t;
    }).join(' ');
    if (broad !== lead.join(' ')) variants.add(`${broad} ${a._cand}`);
    let first = true;
    for (const v of variants) {
      if (engineLeft-- > 0) jobs.push(engineSearch(v, bias, signal).then(keep).catch(() => {}));
      jobs.push(photonSearch(v, bias, signal).then(keep).catch(() => {}));
      if (first && enter) jobs.push(nominatimSearch(v, bias, signal).then(keep).catch(() => {}));
      first = false;
    }
  }
  await Promise.all(jobs);
}

/* worth spending an Overpass call on? */
const deepish = (qToks) =>
  qToks.length >= 2 || qToks.some((t) => KIND_ALIAS[t] || ANCHOR_TAIL.has(t));

/* the deep tier. st = {qa, bias, enter, signal, add(rows, stage), top(),
   viaAc, ctx}. Everything it finds is pushed through st.add as it lands,
   so the caller's hard cap can finalize with whatever arrived. */
async function deepTier(q, st) {
  const { bias, signal, enter } = st;
  const qToks = sigTokens(q);
  const jobs = [];
  const take = (p, stage) => jobs.push(p.then((rows) => st.add(rows, stage)).catch(() => {}));
  if (!st.photonStarted) take(photonSearch(q, bias, signal), 'photon');
  const cleaned = qToks.join(' ');
  if (st.viaAc) take(engineSearch(q, bias, signal), 'engine');
  if (cleaned && cleaned !== norm(q)) take(engineSearch(cleaned, bias, signal), 'engine');
  if (enter) take(nominatimSearch(q, bias, signal), 'nominatim');
  if (st.qa.addrish || enter) take(providerRows('geocode', q, bias, signal), 'providers');
  if (deepish(qToks)) {
    const words = qToks.filter((t) => t.length >= 3).slice(0, 4).map(escRe);
    if (words.length) {
      take(overpassByName(words.length > 1 ? `(${words.join('|')})|${words.join('\\s+')}` : words[0],
        10, bias, signal), 'overpass');
    }
  }
  /* give the name layers a moment — never the whole cap */
  const all = Promise.all(jobs);
  await within(all, 900, null);
  if (signal.aborted) return;
  const cands = anchorCandidates(qToks);
  /* the name layers found the name: no anchor / Overpass fan-out */
  if (!cands.length || decent(st.top(), st.qa) || named(st.top())) { await all; return; }

  /* anchor decomposition: resolve the trailing locality, then ask what
     named things sit near it that match the lead words. Cluster vote:
     a locality two candidates agree on beats a single flaky hit. */
  const liveCands = cands.slice(0, 4);
  /* our engine for the two likeliest candidates only — every extra call
     queues on the same server the next keystroke needs */
  const resolved = await Promise.all(liveCands.map((c, i) => resolveAnchor(c, bias, enter, signal, i < 2)));
  if (signal.aborted) return;
  const finish = () => all;   /* early outs still let the name layers land */
  const clusters = [];
  resolved.forEach((rows, ci) => {
    const voted = new Set();
    for (const r of rows.slice(0, 8)) {
      let cl = clusters.find((c) => hav(c.lat, c.lon, r.lat, r.lon) < 2500);
      if (!cl) { cl = { lat: r.lat, lon: r.lon, votes: 0, rows: [], first: ci }; clusters.push(cl); }
      cl.rows.push({ r, cand: liveCands[ci] });
      if (!voted.has(cl)) { cl.votes++; voted.add(cl); }
    }
  });
  if (!clusters.length) { await finish(); return; }
  const candLen = (i) => liveCands[i].split(' ').length;
  /* specificity: distinguishing words the candidate carries ('east
     kailash' 2 beats 'kailash' 1; 'dham sant nagar' and 'sant nagar' tie
     at 1, and the purer, shorter one wins) */
  const spec = (i) => sigTokens(liveCands[i]).filter((t) => !KIND_ALIAS[t] && !GENERIC_TAIL.has(t)).length;
  clusters.forEach((c) => { c.spec = Math.max(...c.rows.map((x) => spec(liveCands.indexOf(x.cand)))); });
  clusters.sort((a, b) => b.votes - a.votes || b.spec - a.spec ||
    candLen(a.first) - candLen(b.first) || a.first - b.first ||
    (a.rows[0].r.dist ?? 9e9) - (b.rows[0].r.dist ?? 9e9));
  /* only the winning tier anchors (rival same-named localities stay in
     play; a stray 'Kaila' for 'kailash' does not) */
  const best = clusters[0];
  const anchors = clusters.filter((c) => c.votes === best.votes && c.spec === best.spec).slice(0, 3)
    .map((cl) => {
      const top = cl.rows.find((x) => spec(liveCands.indexOf(x.cand)) === cl.spec) || cl.rows[0];
      return { ...top.r, _cand: top.cand };
    });
  const aToksAll = [...new Set(anchors.flatMap((a) => sigTokens(a._cand)))];
  /* the ranker now knows where the named locality is */
  st.ctx.anchorPts = anchors;
  st.ctx.anchorToks = new Set(aToksAll);
  st.add(anchors.map((a) => ({ name: a.name, sub: a.sub || '', kind: a.kind,
    lat: a.lat, lon: a.lon, dist: a.dist, source: a.source, _anchor: true })), 'anchors');
  const re = buildLeadRegex(qToks, aToksAll);
  await Promise.all([
    all,
    re ? overpassNearAnchors(anchors, 1600, re, 12, signal)
      .then((rows) => st.add(rows.map((r) => ({ ...r, _deep: true })), 'anchors')).catch(() => {}) : null,
    anchorGeoRows(anchors, qToks, aToksAll, bias, enter, signal, (rows) => st.add(rows, 'anchors'))
      .catch(() => {}),
  ]);
}

/* ── the live type-ahead ────────────────────────────────────────── */

/* last list live() painted — the next keystroke starts from it */
let painted = { q: '', rows: [] };
/* the live() call allowed to paint, and the one keystroke before it whose
   tier-1 answer may still land: when the text continues, that answer is
   adopted (re-ranked for the newer text) instead of thrown away, so fast
   typing over a slow index never shows a blank list. Only ONE superseded
   request is kept; anything older is aborted. */
let current = null, orphan = null;

const continues = (a, b) => {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  const n = Math.min(x.length, y.length);
  return n >= 2 && x.slice(0, n - 1) === y.slice(0, n - 1);
};

function live(q, bias, onRows, opts = {}) {
  const raw = String(q || '');
  const qt = raw.trim();
  const ctl = new AbortController();    /* deep tier + timers */
  const ctl1 = new AbortController();   /* tier-1 requests */
  const timers = [];
  let dead = false;
  const remember = opts.remember !== false;
  const me = { qt, ctl1, adopt: null, t: 0 };
  /* superseded by a newer keystroke: stop painting and the deep tier,
     let tier 1 finish for adoption */
  const retire = () => {
    if (dead) return;
    dead = true; ctl.abort();
    timers.forEach(clearTimeout);
    if (!remember) { ctl1.abort(); return; }
    if (orphan && orphan !== me) orphan.ctl1.abort();
    orphan = me;
  };
  /* caller's cancel. If a newer live() starts in the same tick it adopts
     our tier 1 (W cancels right before the next keystroke's live());
     otherwise everything is aborted next tick. */
  const cancel = () => {
    if (dead && orphan !== me) return;
    retire();
    if (current === me) current = null;
    me.t = Date.now();
    setTimeout(() => {
      if (!current || current.since < me.t || !continues(qt, current.qt)) {
        ctl1.abort();
        if (orphan === me) orphan = null;
      }
    }, 0);
  };
  me.retire = retire;
  if (remember) {
    if (current && current !== me) current.retire();
    me.since = Date.now();
    current = me;
  }
  const say = (rows, final, stage) => {
    if (dead) return;
    try { onRows(rows, { final, stage }); } catch (e) { /* caller's bug, not ours */ }
  };
  if (qt.length < 2) { say([], true, 'short'); return cancel; }

  const b = bias && Number.isFinite(+bias.lat) && Number.isFinite(+bias.lon)
    ? { lat: +bias.lat, lon: +bias.lon } : null;
  const qa = analyze(raw);
  const ctx = { qa, bias: b, prev: null, anchorPts: null, anchorToks: null };
  const pool = new Map();
  let finalSent = false, shownN = 0, lastAt = 0, emitT = 0, pend = null;
  /* coalesce bursts (the anchor stage lands in many small pieces):
     at most one repaint per 90 ms; first paint and final go straight out */
  const emit = (stage, final) => {
    if (dead || finalSent) return;
    const now = Date.now();
    if (!final && shownN && now - lastAt < 90) {
      pend = stage;
      if (!emitT) {
        emitT = setTimeout(() => { emitT = 0; const st = pend; pend = null; paint(st, false); }, 90 - (now - lastAt));
      }
      return;
    }
    paint(stage, final);
  };
  const paint = (stage, final) => {
    if (dead || finalSent) return;
    if (final && emitT) { clearTimeout(emitT); emitT = 0; }
    lastAt = Date.now();
    if (remember) ctx.prev = new Map(painted.rows.map((r, i) => [r.key, i]));
    let rows = rank([...pool.values()], ctx);
    /* nothing carries the name: at the end, show the closest partials
       (the locality, the landmark) rather than an empty list */
    if (final && !rows.length && pool.size) { ctx.relaxed = true; rows = rank([...pool.values()], ctx); }
    shownN = rows.length;
    if (remember) painted = { q: qt, rows };
    if (final) { finalSent = true; timers.forEach(clearTimeout); }
    say(rows, !!final, stage);
  };
  const addRows = (rows) => {
    let n = 0;
    for (const r of rows || []) {
      const t = tidy(r, b);
      if (!t) continue;
      const old = pool.get(t.key);
      if (!old || (!old.sub && t.sub)) { pool.set(t.key, t); n++; }
    }
    return n;
  };

  /* tier 0 — DIGIPIN is an exact answer */
  const pin = A.digipin && A.digipin.match ? A.digipin.match(qt) : null;
  if (pin) {
    const c = A.digipin.decode(pin);
    if (c && inArea(c.lat, c.lon)) {
      addRows([{ name: pin, sub: 'DIGIPIN · exact spot', kind: 'digipin',
        lat: c.lat, lon: c.lon, source: 'digipin', exact: true }]);
      emit('digipin', false);
      /* put a place name on it (our own reverse; quick, never per keystroke
         — a full pin only exists once typed) */
      reverseOwn(c.lat, c.lon, ctl.signal).then((nm) => {
        if (nm) for (const r of pool.values()) if (r.exact) r.sub = `DIGIPIN · ${nm}`;
        emit('digipin', true);
      });
    } else emit('digipin', true);
    return cancel;
  }

  /* tier 0 — narrow what is already on screen */
  if (remember && painted.rows.length && continues(painted.q, qt)) {
    for (const r of painted.rows) {
      if (!r.exact) pool.set(r.key, { ...r, dist: b ? hav(b.lat, b.lon, r.lat, r.lon) : null });
    }
  }
  const cached = [rget(rkey('t1', qt, b)), rget(rkey('p', qt, b))].filter(Boolean);
  for (const rows of cached) addRows(rows);
  if (pool.size) emit(cached.length ? 'cache' : 'carry', false);

  /* tier 1 — our index ∥ providers, each painted the moment it lands */
  const t0 = Date.now();
  let viaAc = false;
  /* a superseded keystroke's answer: hand it to the live call if the
     text still continues ours */
  const handOff = (rows) => {
    if (orphan !== me || !rows || !rows.length) return;
    const cur = current;
    if (cur && cur !== me && cur.adopt && continues(qt, cur.qt)) cur.adopt(rows);
  };
  me.adopt = (rows) => {
    if (dead || finalSent) return;
    if (addRows(rows)) emit('carry', false);
  };
  /* the provider tier has its own (longer) budget; while it is in flight
     the browser deep tier waits for its verdict */
  let provPending = provLive();
  const t1 = Promise.all([
    acRows(qt, b, ctl1.signal).then((r) => {
      if (!r) return;
      rput(rkey('t1', qt, b), r.rows);
      if (dead) { handOff(r.rows); return; }
      viaAc = r.via === 'ac';
      addRows(r.rows); emit(r.via, false);
    }).catch(() => {}),
    providerRows('ac', qt, b, ctl1.signal).then((rows) => {
      provPending = false;
      if (rows.length) rput(rkey('p', qt, b), rows);
      if (dead) { handOff(rows); return; }
      if (rows.length) { addRows(rows); emit('providers', false); }
    }).catch(() => {}).then(() => { provPending = false; pauseCheck(); }),
  ]).catch(() => {}).then(() => { if (orphan === me) orphan = null; });
  /* tier 1 answered well enough that the browser deep tier stays off:
     the top is a full match, or a row carries the name (Enter: only a
     provider row carrying the name holds it off) */
  const enough = (rows) => named(rows, true) ||
    (!opts.enter && (decent(rows, qa) || named(rows)));


  /* tier 2 — deep, capped */
  let deepP = null, photonStarted = false;
  const top = () => rank([...pool.values()], ctx);
  const startPhoton = () => {
    if (photonStarted || dead) return;
    photonStarted = true;
    photonSearch(qt, b, ctl.signal).then((rows) => {
      if (dead || finalSent) return;
      if (addRows(rows)) emit('photon', false);
    });
  };
  const startDeep = () => {
    if (deepP || dead || finalSent) return deepP;
    const dctl = new AbortController();
    ctl.signal.addEventListener('abort', () => dctl.abort(), { once: true });
    let capped = false;
    const st = {
      qa, bias: b, enter: !!opts.enter, signal: dctl.signal, ctx,
      viaAc: viaAc || acState === 'ok', photonStarted,
      top,
      add: (rows, stage) => {
        if (dead || capped || finalSent) return;
        if (addRows(rows)) emit(stage, false);
        else if (stage === 'anchors') emit(stage, false);   /* re-rank with anchor gravity */
      },
    };
    photonStarted = true;
    deepP = Promise.race([
      deepTier(qt, st).catch(() => {}),
      new Promise((res) => timers.push(setTimeout(res, DEEP_CAP_MS))),
    ]).then(() => { capped = true; dctl.abort(); });
    return deepP;
  };

  /* tier 1 slow (cold index, long text): Photon joins at 600 ms — only
     reached when this keystroke survived that long, i.e. typing paused —
     and never while the provider tier may still bring the name */
  timers.push(setTimeout(() => {
    if (!dead && !finalSent && !shownN && !provPending) startPhoton();
  }, 600));

  let t1Done = false, pauseFired = false;
  /* the deep-tier gate after a pause: BOTH tiers answered without the
     name — or the providers did (or are absent) and our index is slow
     (> AC_MS: prod's /v2/search fallback); never while the providers may
     still bring the name (t1 below starts it when they land) */
  function pauseCheck() {
    if (!pauseFired || dead || finalSent || deepP) return;
    const rows = top();
    if (enough(rows)) return;
    if (t1Done) { startDeep(); return; }
    if (provPending || named(rows)) return;
    const wait = AC_MS - (Date.now() - t0);
    if (wait > 0) { timers.push(setTimeout(pauseCheck, wait + 5)); return; }
    startDeep();
  }
  t1.then(() => {
    t1Done = true;
    if (dead || finalSent) return;
    if (enough(top())) {
      if (!deepP) emit('final', true);
      return;
    }
    if (pauseFired || opts.immediate || opts.enter) startDeep();
    else startPhoton();
  });
  timers.push(setTimeout(() => { pauseFired = true; pauseCheck(); },
    opts.enter ? 0 : Math.max(0, opts.pauseMs ?? PAUSE_MS)));

  /* final = tier 1 settled AND (deep settled, or deep never needed) */
  const settle = async () => {
    await t1;
    while (!dead && !finalSent) {
      if (deepP) { await deepP; break; }
      if (enough(top())) break;
      await new Promise((res) => setTimeout(res, 60));
      if (Date.now() - t0 > 12000) break;     /* never a spinner that never ends */
    }
    emit('final', true);
  };
  settle();
  return cancel;
}

/* ── final-rows API for existing callers ─────────────────────────── */

const cache = new Map();
const cacheKey = (q, bias, enter) =>
  `${norm(q)}|${bias ? (+bias.lat).toFixed(3) + ',' + (+bias.lon).toFixed(3) : '-'}|${enter ? 1 : 0}`;
function cachePut(k, rows) {
  if (cache.size > 150) cache.delete(cache.keys().next().value);
  cache.set(k, rows);
}

/* same tiers, resolved once final. Deep runs right away only if tier 1
   is weak (or on Enter); never Nominatim unless opts.enter. */
function search(q, bias, opts = {}) {
  q = String(q || '').trim();
  if (q.length < 2) return Promise.resolve([]);
  const ck = cacheKey(q, bias, opts.enter);
  if (cache.has(ck)) return Promise.resolve(cache.get(ck));
  return new Promise((resolve) => {
    let last = [], done = false;
    const fin = (rows) => { if (done) return; done = true; resolve(rows); };
    const cancel = live(q, bias, (rows, m) => {
      last = rows;
      if (m.final) { cachePut(ck, rows); fin(rows); }
    }, { ...opts, immediate: true, remember: false, pauseMs: 1e9 });
    setTimeout(() => { cancel(); fin(last); }, 9000);
  });
}

/* ── reverse ────────────────────────────────────────────────────── */

async function reverseOwn(lat, lon, signal) {
  const r = await getJ(`${apiBase()}/v2/reverse?lat=${lat}&lon=${lon}`, 2500, signal);
  const j = r.j;
  return j && j.name && (j.distance_m ?? 1e9) < 3000 ? j.name : null;
}

async function reverse(lat, lon) {
  const own = await reverseOwn(lat, lon);
  if (own) return own;
  const r = await getJ(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`,
    6000, null, { headers: { 'Accept-Language': 'en' } });
  return r.j ? ((r.j.display_name || '').split(',')[0] || null) : null;
}

A.search = { live, search, reverse, inDelhi, inArea, AREA };
/* dev surface for search-test.html and the node harness */
A.search._dbg = {
  engineSearch, photonSearch, nominatimSearch, overpass,
  overpassByName, overpassNearAnchors, resolveAnchor,
  anchorCandidates, sigTokens, opDead, analyze, plainSub, plainTag,
  acState: () => acState, provState: () => ({ ...prov }),
};
})();
