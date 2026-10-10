/* Alive webapp — layered place search. The engine's own index first
   (/v2/search — alive_core + gazetteer), then the free public layers
   (Photon → Nominatim) for the deep POIs the index hasn't swallowed
   yet. Every result carries its source, honestly. */
(() => {
'use strict';

const DELHI_BBOX = { minLat: 28.35, maxLat: 28.95, minLon: 76.75, maxLon: 77.55 };
const inDelhi = (lat, lon) =>
  lat >= DELHI_BBOX.minLat && lat <= DELHI_BBOX.maxLat &&
  lon >= DELHI_BBOX.minLon && lon <= DELHI_BBOX.maxLon;

function dedupe(rows) {
  const seen = new Set(), out = [];
  for (const r of rows) {
    const k = `${(r.name || '').toLowerCase().slice(0, 24)}|${r.lat.toFixed(3)}|${r.lon.toFixed(3)}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(r);
  }
  return out;
}

async function engineSearch(q, bias) {
  const p = new URLSearchParams({ q });
  if (bias) { p.set('lat', bias.lat); p.set('lon', bias.lon); }
  const j = await A.api.get(`/v2/search?${p}`);
  if (!j || !Array.isArray(j.results)) return [];
  return j.results.map((r) => ({
    name: r.name, sub: r.subtitle || r.kind || '',
    kind: r.kind, lat: r.lat, lon: r.lon,
    dist: r.distance_m, source: 'delhi index',
  }));
}

async function photonSearch(q) {
  try {
    const r = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q + ' Delhi')}&limit=6&lat=28.6&lon=77.2`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.features || []).map((f) => ({
      name: f.properties.name || f.properties.street || f.properties.district || q,
      sub: [f.properties.district, f.properties.city, f.properties.state].filter(Boolean).join(', '),
      kind: f.properties.osm_value || f.properties.osm_key || 'place',
      lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0],
      source: 'openstreetmap',
    })).filter((r) => inDelhi(r.lat, r.lon));
  } catch (e) { return []; }
}

async function nominatimSearch(q) {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&countrycodes=in&viewbox=${DELHI_BBOX.minLon},${DELHI_BBOX.maxLat},${DELHI_BBOX.maxLon},${DELHI_BBOX.minLat}&bounded=0`,
      { headers: { 'Accept-Language': 'en' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
    if (!r.ok) return [];
    const j = await r.json();
    return j.map((x) => ({
      name: (x.display_name || '').split(',')[0] || q,
      sub: (x.display_name || '').split(',').slice(1, 4).join(',').trim(),
      kind: x.type || x.class || 'place',
      lat: +x.lat, lon: +x.lon,
      source: 'openstreetmap',
    })).filter((r) => inDelhi(r.lat, r.lon));
  } catch (e) { return []; }
}

/* the cascade: engine first (it knows Delhi's aliases + compound names),
   then Photon (fuzzy POI), then Nominatim (address-complete). A weak
   engine answer (empty or all-distant) falls through to the next layer. */
async function search(q, bias) {
  q = (q || '').trim();
  if (q.length < 2) return [];
  const eng = await engineSearch(q, bias);
  const strong = eng.filter((r) => (r.dist ?? 0) < 45000);
  if (strong.length >= 2 || (strong.length && strong[0].dist < 8000)) {
    return dedupe(strong);
  }
  const [ph, nom] = await Promise.all([photonSearch(q), nominatimSearch(q)]);
  const merged = dedupe([...strong, ...ph, ...nom]);
  return merged.slice(0, 10);
}

/* reverse: what is this point called — engine's locality or nominatim */
async function reverse(lat, lon) {
  const j = await A.api.get(`/v2/search?lat=${lat}&lon=${lon}&q=&near=1`);
  if (j && j.results && j.results[0] && (j.results[0].distance_m ?? 1e9) < 1200)
    return j.results[0].name;
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`,
      { headers: { 'Accept-Language': 'en' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.display_name || '').split(',')[0] || null;
  } catch (e) { return null; }
}

A.search = { search, reverse, inDelhi };
})();
