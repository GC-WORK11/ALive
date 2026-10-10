/* Alive webapp — layered place search, tuned for deep Delhi.
   Cascade: engine /v2/search (alive_core + gazetteer)
     → Photon (fuzzy POI) → Nominatim (address-complete)
     → Overpass (raw OSM name scan — the layer that knows the mandir
        inside C-block nobody geocodes)
     → anchor decomposition: when the name layers can't resolve the
        compound, resolve the trailing locality and list the real named
        things around it that match the lead words.
   Every result: {name,sub,kind,lat,lon,dist,source}. source is honest:
   'delhi index' | 'openstreetmap' | 'overpass'; decomposed hits say
   'near <anchor>' in their subtitle. */
(() => {
'use strict';

const DELHI_BBOX = { minLat: 28.35, maxLat: 28.95, minLon: 76.75, maxLon: 77.55 };
const inDelhi = (lat, lon) =>
  lat >= DELHI_BBOX.minLat && lat <= DELHI_BBOX.maxLat &&
  lon >= DELHI_BBOX.minLon && lon <= DELHI_BBOX.maxLon;

const DELHI_CENTER = { lat: 28.6139, lon: 77.2090 };
const SEARCH_BUDGET_MS = 9500;

/* ── text tools ─────────────────────────────────────────────────── */

const STOP = new Set(['near', 'next', 'to', 'at', 'the', 'of', 'in', 'on',
  'opp', 'opposite', 'behind', 'by', 'beside', 'and', 'or', 'a', 'an',
  'delhi', 'new', 'dilli', 'ncr', 'india', 'pin', 'code',
  /* 'c block'-style address structure — carries no place signal and
     floods the lead gate with every apartment block in the locality */
  'block', 'pocket', 'flat', 'house', 'no']);

/* tokens that commonly END a delhi locality name */
const ANCHOR_TAIL = new Set(['nagar', 'vihar', 'pur', 'pura', 'puri', 'abad',
  'bagh', 'colony', 'enclave', 'extension', 'extn', 'garhi', 'garh', 'sarai',
  'khadar', 'khas', 'kailash', 'ganj', 'estate', 'town', 'sector', 'sec',
  'block', 'pocket', 'phase', 'part', 'road', 'marg', 'street', 'chowk',
  'chungi', 'square', 'circle', 'market', 'wala', 'place', 'village',
  'park', 'nagri', 'kunj', 'lok', 'pahari', 'dwara',
  'shahdara', 'noida', 'gurgaon', 'gurugram', 'ghaziabad', 'faridabad',
  'dwarka', 'rohini', 'burari', 'sarai', 'paharganj', 'mandi']);

/* kind-vocabulary expansion — used ONLY for the near-anchor POI scan.
   These are words, not places: 'bace' is ISKCON's academy, a 'dham' is
   a temple-family name, a 'bakery' hides under 'confectionery'. */
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

const norm = (s) => (s || '').toLowerCase()
  .replace(/[.'’‘,;:!?()\-_/\\]/g, ' ').replace(/\s+/g, ' ').trim();

const sigTokens = (q) => norm(q).split(' ').filter((t) => t && !STOP.has(t));

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function hav(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
    Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/* does query-token q match name-token n? prefix-tolerant both ways
   ('sec' hits 'sector' via prefix; 'sanjay' hits 'sanjays'). */
const tokHit = (q, n) => q === n || n.startsWith(q) || (q.length >= 4 && q.startsWith(n));

/* fraction of query tokens the row's name+sub covers — a token also
   hits through its kind-aliases ('dham' covers an iskcon row) */
function nameSim(qToks, row) {
  if (!qToks.length) return 0;
  const nToks = norm(`${row.name} ${row.sub}`).split(' ');
  let hit = 0;
  for (const q of qToks) {
    const alts = KIND_ALIAS[q];
    if (nToks.some((n) => tokHit(q, n) ||
        (alts && alts.some((a) => tokHit(a, n))))) hit++;
  }
  return hit / qToks.length;
}

/* the lead word sits inside the name's first two tokens → the row is
   probably THE thing named, not a row that merely mentions it */
function leadHit(qToks, row) {
  if (!qToks.length) return false;
  const lead = qToks[0];
  if (lead.length < 3) return false;
  return norm(row.name).split(' ').slice(0, 2).some((n) => tokHit(lead, n));
}

/* query asks a number (sector 27) but the name carries a different one
   (sec 18) — the classic wrong-neighbourhood trap */
function numMismatch(qToks, row) {
  const qn = qToks.filter((t) => /^\d+$/.test(t));
  if (!qn.length) return false;
  const nn = norm(`${row.name} ${row.sub}`).match(/\d+/g) || [];
  if (!nn.length) return false;
  return !qn.some((q) => nn.includes(q));
}

function coversToks(toks, row) {
  const n = norm(`${row.name} ${row.sub}`).split(' ');
  return toks.some((t) => n.some((x) => tokHit(t, x)));
}

/* EVERY locality token covered — 'mahadev park' must not pass the
   gate for 'chittaranjan park' just because both say park */
function coversAllToks(toks, row) {
  if (!toks.length) return true;
  const n = norm(`${row.name} ${row.sub}`).split(' ');
  return toks.every((t) => n.some((x) => tokHit(t, x) ||
    (KIND_ALIAS[t] || []).some((a) => x.startsWith(a) || a.startsWith(x))));
}

function score(row, ctx) {
  const sim = nameSim(ctx.qToks, row);
  const lead = leadHit(ctx.qToks, row);
  let prox;
  if (row.dist != null && ctx.bias) prox = 1 / (1 + row.dist / 15000);
  else if (row.dist != null) prox = Math.max(0.2, 1 / (1 + row.dist / 60000));
  else prox = 0.4;
  let s = 1.7 * sim + 0.9 * (lead ? 1 : 0) + 0.9 * prox;
  if (lead && sim < 0.75) s += (0.75 - sim) * 1.7;      /* entity-name floor */
  if (numMismatch(ctx.qToks, row)) s -= 0.6;
  if (ctx.anchorToks.length) {
    if (coversToks(ctx.anchorToks, row)) s += 0.35;
    else if ((row.dist ?? 0) > 8000) s -= 0.6;
  }
  /* resolved-anchor gravity: a row sitting inside the locality the
     query named beats a same-named thing 20km across the city. rows
     that survived the lead-regex + radius filter earn a deep bonus. */
  if (ctx.anchorPts && ctx.anchorPts.length) {
    const dA = Math.min(...ctx.anchorPts.map((p) =>
      hav(p.lat, p.lon, row.lat, row.lon)));
    s += 1.2 / (1 + dA / 2600);
    if (dA > 14000) s -= 1.0;
    if (row._deep) s += 0.55;
    row._dA = dA;
  }
  row._sim = sim; row._lead = lead; row._score = s;
  return s;
}

function dedupe(rows) {
  const seen = new Set(), out = [];
  for (const r of rows) {
    if (!r || r.lat == null || !inDelhi(r.lat, r.lon)) continue;
    const k = `${norm(r.name).slice(0, 24)}|${r.lat.toFixed(3)}|${r.lon.toFixed(3)}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(r);
  }
  return out;
}

/* ── layers ─────────────────────────────────────────────────────── */

const timeout = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);

async function engineSearch(q, bias) {
  const p = new URLSearchParams({ q });
  const b = bias || DELHI_CENTER;
  p.set('lat', b.lat); p.set('lon', b.lon);
  const j = await A.api.get(`/v2/search?${p}`, 6000);
  if (!j || !Array.isArray(j.results)) return [];
  return j.results.map((r) => ({
    name: r.name, sub: r.subtitle || r.kind || '',
    kind: r.kind, lat: r.lat, lon: r.lon,
    dist: r.distance_m, source: 'delhi index',
  }));
}

async function photonSearch(q, bias) {
  try {
    const b = bias || DELHI_CENTER;
    const u = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8` +
      `&lat=${b.lat}&lon=${b.lon}` +
      `&bbox=${DELHI_BBOX.minLon},${DELHI_BBOX.minLat},${DELHI_BBOX.maxLon},${DELHI_BBOX.maxLat}`;
    const r = await fetch(u, { signal: timeout(5000) });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.features || []).map((f) => {
      const p = f.properties || {};
      const lat = f.geometry.coordinates[1], lon = f.geometry.coordinates[0];
      return {
        name: p.name || p.street || p.district || q,
        sub: [p.district, p.city, p.state].filter(Boolean).join(', '),
        kind: p.osm_value || p.osm_key || 'place',
        lat, lon, dist: bias ? hav(bias.lat, bias.lon, lat, lon) : null,
        source: 'openstreetmap',
      };
    }).filter((r) => inDelhi(r.lat, r.lon));
  } catch (e) { return []; }
}

async function nominatimSearch(q, bias) {
  try {
    const vb = `${DELHI_BBOX.minLon},${DELHI_BBOX.maxLat},${DELHI_BBOX.maxLon},${DELHI_BBOX.minLat}`;
    const u = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}` +
      `&format=json&limit=8&countrycodes=in&viewbox=${vb}&bounded=1`;
    const r = await fetch(u, {
      headers: { 'Accept-Language': 'en' }, signal: timeout(5000),
    });
    if (!r.ok) return [];
    const j = await r.json();
    return j.map((x) => ({
      name: (x.display_name || '').split(',')[0] || q,
      sub: (x.display_name || '').split(',').slice(1, 4).join(',').trim(),
      kind: x.type || x.class || 'place',
      lat: +x.lat, lon: +x.lon,
      dist: bias ? hav(bias.lat, bias.lon, +x.lat, +x.lon) : null,
      source: 'openstreetmap',
    })).filter((r) => inDelhi(r.lat, r.lon));
  } catch (e) { return []; }
}

/* overpass: full-planet public instances only. (overpass.fr is
   usage-whitelisted for browsers, osm.ch is Switzerland-only, the .ru
   mirror is dead.) A dead endpoint is remembered for the session so a
   down mirror costs nothing twice. */
const OP_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
];
const opDead = new Set();

/* race the live mirrors: first good answer wins; a dead mirror costs
   one parallel slot, not a serial timeout chain. Endpoints that fail
   are remembered for the session. */
async function overpass(query, ms = 6000) {
  const live = OP_ENDPOINTS.filter((b) => !opDead.has(b));
  if (!live.length) return [];
  const attempt = async (base) => {
    let els = null;
    try {
      const r = await fetch(`${base}?data=${encodeURIComponent(query)}`,
        { signal: timeout(ms) });
      if (r.ok) {
        const j = await r.json();
        if (j && Array.isArray(j.elements)) els = j.elements;
      }
    } catch (e) { /* fall through */ }
    if (!els) { opDead.add(base); throw new Error('overpass failed'); }
    return els;
  };
  const els = await Promise.any(live.map(attempt)).catch(() => null);
  if (!els) return [];
  return els.map((e) => {
    const c = e.center || { lat: e.lat, lon: e.lon };
    const t = e.tags || {};
    return {
      name: t.name,
      sub: t.amenity || t.shop || t.tourism || t.leisure ||
        t.place || t.office || e.type,
      kind: t.amenity || t.shop || t.place || e.type,
      lat: c.lat, lon: c.lon, source: 'overpass',
    };
  }).filter((x) => x.name && x.lat != null && inDelhi(x.lat, x.lon));
}

/* one union call scanning every anchor point — kinder to shared-IP
   rate limits than firing per-anchor requests */
function overpassNearAnchors(points, radiusM, regex, limit = 12) {
  const unions = points
    .map((p) => `nwr["name"~"${regex}",i](around:${radiusM},${p.lat},${p.lon});`)
    .join('');
  return overpass(`[out:json][timeout:7];(${unions});out center ${limit};`);
}

function overpassByName(regex, limit = 10) {
  const bb = `${DELHI_BBOX.minLat},${DELHI_BBOX.minLon},${DELHI_BBOX.maxLat},${DELHI_BBOX.maxLon}`;
  return overpass(`[out:json][timeout:6];nwr["name"~"${regex}",i](${bb});out center ${limit};`);
}

/* ── anchor decomposition ───────────────────────────────────────── */

/* candidate anchor strings: trailing suffixes (longest first) plus
   interior n-grams that end on a locality-looking token. Two guards:
   never the whole query ('jagat farm market vaishali' would resolve
   the wrong-town POI as its own anchor) and never a candidate that
   swallows the lead entity word ('pawan ...' is the place, not land). */
/* structural words that describe a place's shape, not its name —
   fine as the tail of a longer candidate ('chittaranjan park'),
   poison alone ('park' resolves to whichever park is nearest) */
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
    /* must carry a distinguishing token — a candidate made of only
       kind/structural words ('dham', 'mandir road') anchors to whatever
       place anywhere shares the word and drags its neighborhood in */
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
  const n = norm(`${row.name} ${row.sub}`).split(' ');
  let hit = 0;
  for (const t of aToks) if (n.some((x) => tokHit(t, x))) hit++;
  return hit / aToks.length;
}

async function resolveAnchor(cand, bias) {
  const aToks = sigTokens(cand);
  const [eng, ph, nm] = await Promise.all([
    engineSearch(cand, bias).catch(() => []),
    photonSearch(cand, bias).catch(() => []),
    nominatimSearch(cand, bias).catch(() => []),
  ]);
  const fit = dedupe([...eng, ...ph, ...nm])
    .map((r) => ({ r, fit: anchorFit(r, aToks) }))
    .filter((x) => x.fit >= 0.66)
    /* pure-name rows first: the locality literally called 'Vaishali'
       beats 'Vaishali Motors' — its extra word means it's a place
       inside Vaishali, not Vaishali itself */
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

/* query words minus the anchor's words — the 'kind + name' lead */
const leadToks = (qToks, aToks) =>
  qToks.filter((t) => !aToks.includes(t) && (t.length >= 3 || /^\d+$/.test(t)));

/* locality the user named: the longest anchor candidate that has a
   real distinguishing token ('mandir chittaranjan park' → the answer
   must cover chittaranjan, not just any park). Kind-words inside the
   candidate ('mandir', 'market') are dropped — 'mahadev park' covering
   'park' must never satisfy a 'chittaranjan park' query. */
function locToksOf(qToks, cands) {
  for (const cand of cands) {
    const toks = sigTokens(cand);
    if (!toks.some((t) => !KIND_ALIAS[t] && !GENERIC_TAIL.has(t))) continue;
    const loc = toks.filter((t) => !KIND_ALIAS[t]);
    if (loc.length) return loc;
  }
  return [];
}

/* the no-overpass deep pass: per resolved anchor, ask the text
   geocoders for '<lead words> <anchor>' — photon/nominatim steer by
   the locality name and hand back the named things inside it. One
   extra variant swaps each kind-word for its broadest alias so
   'neelanchal dham sant nagar' also tries 'iskcon sant nagar'. */
async function anchorGeoRows(anchors, qToks, aToksAll, bias) {
  const lead = leadToks(qToks, aToksAll);
  if (!lead.length) return [];
  const re = buildLeadRegex(qToks, aToksAll);
  const rx = re ? new RegExp(re, 'i') : null;
  const jobs = [];
  for (const a of anchors.slice(0, 3)) {
    const variants = new Set([`${lead.join(' ')} ${a._cand}`]);
    const broad = lead.map((t) => {
      const al = KIND_ALIAS[t];
      return al ? al[al.length - 1] : t;
    }).join(' ');
    if (broad !== lead.join(' ')) variants.add(`${broad} ${a._cand}`);
    let first = true;
    for (const v of variants) {
      const query = v;
      const tag = () => jobs.push(
        engineSearch(query, bias).catch(() => []),
        photonSearch(query, bias).catch(() => []));
      tag();
      if (first) jobs.push(nominatimSearch(query, bias).catch(() => []));
      first = false;
    }
  }
  const flat = dedupe((await Promise.all(jobs)).flat());
  const out = [];
  for (const r of flat) {
    const near = anchors.reduce((best, p) =>
      hav(p.lat, p.lon, r.lat, r.lon) < hav(best.lat, best.lon, r.lat, r.lon)
        ? p : best, anchors[0]);
    if (hav(near.lat, near.lon, r.lat, r.lon) > 5000) continue;
    if (rx && !rx.test(`${r.name} ${r.sub}`) &&
        nameSim(lead, r) < 0.4) continue;
    out.push({
      ...r, sub: `${r.sub ? r.sub + ' · ' : ''}near ${near._cand || near.name}`,
      _deep: true,
    });
  }
  return out;
}

/* ── the cascade ────────────────────────────────────────────────── */

const cache = new Map();
const cacheKey = (q, bias) =>
  `${norm(q)}|${bias ? bias.lat.toFixed(3) + ',' + bias.lon.toFixed(3) : '-'}`;

function cachePut(k, rows) {
  if (cache.size > 150) cache.delete(cache.keys().next().value);
  cache.set(k, rows);
}

/* worth spending an Overpass call on? (it's the slow layer) */
const deepish = (qToks) =>
  qToks.length >= 2 || qToks.some((t) => KIND_ALIAS[t] || ANCHOR_TAIL.has(t));

async function search(q, bias) {
  const t0 = Date.now();
  q = (q || '').trim();
  if (q.length < 2) return [];
  const ck = cacheKey(q, bias);
  if (cache.has(ck)) return cache.get(ck);

  const qToks = sigTokens(q);
  if (!qToks.length) return [];
  const cands = anchorCandidates(qToks);
  const anchorToks = cands.length ? sigTokens(cands[0]) : [];
  const ctx = { qToks, anchorToks, bias };
  const rank = (rows) =>
    dedupe(rows).sort((a, b) => score(b, ctx) - score(a, ctx));
  const strong = (rows) => rows.length &&
    rows[0]._score >= 1.9 && rows[0]._sim >= 0.4;
  const done = (rows) => {
    if (!bias) rows.forEach((r) => { r.dist = null; });
    cachePut(ck, rows); return rows;
  };

  /* 1 — engine, raw + cleaned variants */
  const cleaned = qToks.join(' ');
  const engRows = dedupe([
    ...(await engineSearch(q, bias)),
    ...(cleaned !== norm(q) ? await engineSearch(cleaned, bias) : []),
  ]);
  const engRank = rank(engRows);
  const top = engRank[0];
  const locToks = locToksOf(qToks, cands);
  if (top && top._sim >= 0.85 && (top._lead || top._sim >= 0.99) &&
      (top.dist ?? 0) < 12000 && coversAllToks(locToks, top)) {
    return done(engRank.slice(0, 10));
  }

  /* 2 — public layers in parallel; overpass fires when the query is
     deep enough to deserve a raw name scan */
  const jobs = [photonSearch(q, bias), nominatimSearch(q, bias)];
  if (deepish(qToks) && Date.now() - t0 < 4500) {
    const words = qToks.filter((t) => t.length >= 3).slice(0, 4).map(escRe);
    if (words.length) {
      jobs.push(overpassByName(
        words.length > 1 ? `(${words.join('|')})|${words.join('\\s+')}` : words[0]));
    }
  }
  const trio = await Promise.all(jobs);
  const merged = rank([...engRank, ...trio.flat()]);
  const m0 = merged[0];
  /* a top row that doesn't cover the locality the user named is a
     miss wherever it sits — a CP pastry 529m from the bias is still
     19km from the shahdara they asked for */
  const anchorMiss = m0 && locToks.length && !coversAllToks(locToks, m0);
  if (strong(merged) && !anchorMiss) return done(merged.slice(0, 10));

  /* 3 — anchor decomposition: resolve the trailing locality, then ask
     OSM (one union call) what named things sit near each candidate
     anchor that match the lead words. Round-robin across candidates
     keeps rival same-named localities in play (two Sant Nagars, three
     Vaishalis) instead of letting the first candidate flood the pool. */
  /* anchor selection by cluster vote: every resolved row votes for
     the 2.5km cluster it sits in (one vote per candidate per cluster).
     A locality two different candidates agree on beats the whichever
     single the first candidate happened to rank first — the right
     Shahdara and the EoK Sant Nagar survive flaky geocoder ordering. */
  const anchors = [];
  const liveCands = cands.slice(0, 4);
  const resolved = await Promise.all(
    liveCands.map((cand) => resolveAnchor(cand, bias)));
  const clusters = [];
  resolved.forEach((rows, ci) => {
    const voted = new Set();
    for (const r of rows.slice(0, 8)) {
      let cl = clusters.find((c) => hav(c.lat, c.lon, r.lat, r.lon) < 2500);
      if (!cl) {
        cl = { lat: r.lat, lon: r.lon, votes: 0, rows: [], first: ci };
        clusters.push(cl);
      }
      cl.rows.push({ r, cand: liveCands[ci] });
      if (!voted.has(cl)) { cl.votes++; voted.add(cl); }
    }
  });
  const candLen = (i) => liveCands[i].split(' ').length;
  clusters.sort((a, b) => b.votes - a.votes ||
    /* purer locality candidates first: 'sant nagar' anchors before
       kind+place phrases like 'dham sant nagar', so the locality
       itself — not whatever faraway thing shares the kind-word —
       defines the neighborhood */
    candLen(a.first) - candLen(b.first) || a.first - b.first ||
    (a.rows[0].r.dist ?? 9e9) - (b.rows[0].r.dist ?? 9e9));
  for (const cl of clusters.slice(0, 4)) {
    const best = cl.rows[0];
    anchors.push({ ...best.r, _cand: best.cand });
  }
  if (anchors.length && Date.now() - t0 < SEARCH_BUDGET_MS - 800) {
    const pts = anchors.slice(0, 4);
    ctx.anchorPts = pts;
    const aToksAll = [...new Set(anchors.flatMap((a) => sigTokens(a._cand)))];
    const re = buildLeadRegex(qToks, aToksAll);
    const [pois, geoRows] = await Promise.all([
      re ? overpassNearAnchors(pts, 1600, re, 12) : Promise.resolve([]),
      anchorGeoRows(anchors, qToks, aToksAll, bias),
    ]);
    const poiRows = pois.map((r) => {
      const near = pts.reduce((best, p) =>
        hav(p.lat, p.lon, r.lat, r.lon) < hav(best.lat, best.lon, r.lat, r.lon) ? p : best, pts[0]);
      return {
        ...r, sub: `${r.sub ? r.sub + ' · ' : ''}near ${near._cand || near.name}`,
        dist: bias ? hav(bias.lat, bias.lon, r.lat, r.lon) : null,
        _deep: true,
      };
    });
    const anchorRows = anchors.map((a) => ({
      name: a.name, sub: a.sub || a._cand, kind: a.kind,
      lat: a.lat, lon: a.lon, dist: a.dist, source: a.source,
    }));
    return done(rank([...poiRows, ...geoRows, ...anchorRows, ...merged]).slice(0, 10));
  }
  if (anchors.length) {
    const anchorRows = anchors.map((a) => ({
      name: a.name, sub: a.sub || a._cand, kind: a.kind,
      lat: a.lat, lon: a.lon, dist: a.dist, source: a.source,
    }));
    return done(rank([...anchorRows, ...merged]).slice(0, 10));
  }

  return done(merged.slice(0, 10));
}

/* ── reverse ────────────────────────────────────────────────────── */

async function reverse(lat, lon) {
  const j = await A.api.get(`/v2/reverse?lat=${lat}&lon=${lon}`, 6000);
  if (j && j.name && (j.distance_m ?? 1e9) < 3000) return j.name;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`,
      { headers: { 'Accept-Language': 'en' }, signal: timeout(6000) });
    if (!r.ok) return null;
    const x = await r.json();
    return (x.display_name || '').split(',')[0] || null;
  } catch (e) { return null; }
}

A.search = { search, reverse, inDelhi };
/* dev surface for search-test.html — per-layer probes, not the
   contract screens call */
A.search._dbg = {
  engineSearch, photonSearch, nominatimSearch, overpass,
  overpassByName, overpassNearAnchors, resolveAnchor,
  anchorCandidates, sigTokens, opDead,
};
})();
