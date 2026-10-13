/* Alive webapp — purest places + hotels.
   Places: /v2/purest — named localities/parks NEAR you, solid data only
   (a named live monitor close by, inside the field, area fully
   covered), ranked by the live pm2.5 at each place. Before that
   endpoint is deployed the screen falls back to /v2/districts rows that
   carry the same honesty flags (confidence 'field', not partial).
   Hotels: /v2/stays (24 h average at each stay's own coordinates,
   Alive's pick on top), any hotel by name via search, and an env card
   built from /v2/playtime at the hotel — the SAME numbers /v2/stays
   ranks on (now = field read, 24 h avg = the next-24 h mean).
   Nothing here invents a number. */
(() => {
'use strict';

const RADIUS_KM = 15;
const PLACES_N = 6;
const HOTELS_N = 6;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r0 = (v) => (v == null || !isFinite(v) ? '—' : String(Math.round(v)));

/* ONE scale, the same as home + the air map: the CPCB national AQI from
   PM2.5 + PM10 at the spot (A.map.cpcbAqi / aqiBand / BANDS). The read
   is /aqi?lat&lon — the exact call home makes — so one spot shows one
   number in one colour on every screen. PM2.5-only numbers (the 24 h
   forecast) are labelled PM2.5 and take the PM2.5 sub-index band, as
   home's PM2.5 tile does. */
const INK = '#16181D';
const BAND_WORD = ['Good', 'Satisfactory', 'Moderate', 'Poor', 'Very poor', 'Severe'];
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const hexMix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};
function aqiOf(pm25, pm10) {
  const M = A.map;
  if (!M || typeof M.cpcbAqi !== 'function') return null;
  const a25 = isNum(pm25) ? pm25 : null, a10 = isNum(pm10) ? pm10 : null;
  const aqi = M.cpcbAqi(a25, a10);
  if (aqi == null) return null;
  const c = typeof M.cpcb === 'function' ? M.cpcb(a25, a10) : null;
  return { aqi, over: !!(c && c.over), band: M.aqiBand(aqi) };
}
const pmBand = (pm25) => (isNum(pm25) && A.map && A.map.cpcbAqi
  ? A.map.aqiBand(A.map.cpcbAqi(pm25, null)) : null);
/* number ink = the band colour 20 % toward ink (home's hero number) */
const bandInk = (i) => (i == null || !A.map || !A.map.BANDS ? 'var(--ink)' : hexMix(A.map.BANDS[i], INK, 0.20));
const bandCol = (i) => (i == null || !A.map || !A.map.BANDS ? 'var(--ink4)' : A.map.BANDS[i]);
const aqiTxt = (c) => (c ? `${c.aqi}${c.over ? '+' : ''}` : '—');
/* distances: always our own haversine from the user's spot (or the
   "near …" point) — never a provider's distance_m */
const kmTxt = (d) => (d == null || !isFinite(d) ? null
  : Math.round(d * 10) / 10 < 10 ? `${Math.max(0.1, Math.round(d * 10) / 10).toFixed(1)} km` : `${Math.round(d)} km`);
const distFrom = (ref, lat, lon) => (ref && isNum(ref.lat) && isNum(ref.lon) && isNum(+lat) && isNum(+lon)
  && lat !== null && lon !== null ? hav(ref.lat, ref.lon, +lat, +lon) : null);
function hav(aLat, aLon, bLat, bLon) {
  const R = 6371, dLa = (bLat - aLat) * Math.PI / 180, dLo = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLa / 2) ** 2 + Math.cos(aLat * Math.PI / 180) *
    Math.cos(bLat * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const norm = (n) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const nice = (n) => (n && n.length > 3 && n === n.toUpperCase() && /[A-Z]/.test(n)
  ? n.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : n || '');
const LODGE_KIND = /hotel|hostel|lodg|resort|guest|motel|dharamshala|accommodation|apartment|\binn\b/i;
const LODGE_NAME = /\b(hotel|hostel|resort|inn|lodge|guest ?house|homestay|oyo|suites?|dharamshala|motel)\b/i;
function isLodging(r) {
  const k = (r.kind || '').toLowerCase();
  if (k && !/^(place|poi|establishment|point_of_interest|address)$/.test(k)) return LODGE_KIND.test(k);
  return LODGE_NAME.test(r.name || '');
}

let state = null;

/* ── map pins ─────────────────────────────────────────────────────── */
function clearPins() {
  if (!state) return;
  state.pinIds.forEach((id) => A.map.unpin(id));
  state.pinIds = [];
}
function addPin(id, lon, lat, html) {
  A.map.pin(id, lon, lat, html);
  state.pinIds.push(id);
}
function pinPlaces(rows) {
  rows.forEach((p, i) => {
    const nm = p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name;
    addPin(`pm-p-${i}`, p.lon, p.lat,
      `<div class="pin-chip pm-chip"><i class="pm-dot" style="background:${bandCol(p.cp ? p.cp.band : null)}"></i>${esc(nm)}</div>`);
  });
}

/* the air at one spot — /aqi, exactly as home asks for it */
function aqiAt(lat, lon) {
  const key = `${(+lat).toFixed(4)},${(+lon).toFixed(4)}`;
  if (state.aqiCache.has(key)) return state.aqiCache.get(key);
  const cache = state.aqiCache;
  const p = A.api.get(`/aqi?lat=${lat}&lon=${lon}`, 8000)
    .then((j) => (j && isNum(j.pm25) ? j : null));
  cache.set(key, p);
  p.then((j) => { if (!j) cache.delete(key); });
  return p;
}
/* attach the CPCB AQI (pm2.5 + pm10 at the row's own spot) to rows */
async function withAqi(rows) {
  const reads = await Promise.all(rows.map((r) => aqiAt(r.lat, r.lon)));
  rows.forEach((r, i) => {
    const j = reads[i];
    r.read = j ? { pm25: j.pm25, pm10: isNum(j.pm10) ? j.pm10 : null } : null;
    r.cp = j ? aqiOf(j.pm25, j.pm10) : null;
  });
  return rows;
}
function pinHotels(rows) {
  rows.forEach((s, i) => {
    if (s.lat == null || s.lon == null) return;
    addPin(`pm-s-${i}`, s.lon, s.lat, '<div class="pin-dot pm-stay-dot"></div>');
  });
}
function repin() {
  clearPins();
  if (state.places && state.places.length) pinPlaces(state.places.slice(0, PLACES_N));
  if (state.stays && state.stays.length) pinHotels(state.stays.slice(0, HOTELS_N));
}
function fitPlaces() {
  const me = state.me;
  const pts = (state.places || []).slice(0, PLACES_N).map((p) => [p.lon, p.lat]);
  if (me) pts.push([me.lon, me.lat]);
  if (pts.length >= 2) A.map.fit(pts, 70);
  else if (pts.length === 1) A.map.fly(pts[0][1], pts[0][0], 12.5);
}

/* ── the env card: one place's air now + its next 24 h ───────────── */
function envEl() {
  if (!state.envEl) {
    state.envEl = document.createElement('div');
    state.envEl.className = 'pm-env';
    state.envEl.hidden = true;
    state.el.appendChild(state.envEl);
  }
  return state.envEl;
}
function closeEnv() { if (state && state.envEl) state.envEl.hidden = true; }

async function playAt(lat, lon) {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (state.playCache.has(key)) return state.playCache.get(key);
  const p = A.api.get(`/v2/playtime?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`, 20000);
  state.playCache.set(key, p);
  const j = await p;
  if (!j) state.playCache.delete(key);
  return j;
}

function cardTop(name, sub) {
  return `<div class="pm-env-top">
      <div class="pm-env-head"><div class="pm-env-name">${esc(name)}</div>
        ${sub ? `<div class="pm-env-sub">${esc(sub)}</div>` : ''}</div>
      <button class="pm-x" type="button" aria-label="close">✕</button></div>`;
}

async function openEnv(o) {
  const el = envEl();
  const seq = (state.envSeq = (state.envSeq || 0) + 1);
  el.hidden = false;
  el.innerHTML = `${cardTop(o.name, o.sub)}<div class="sk" style="height:40px;width:180px;margin-top:6px"></div>`;
  el.querySelector('.pm-x').addEventListener('click', closeEnv);
  const me = state.me;
  const away = me && hav(me.lat, me.lon, o.lat, o.lon) > 0.3;
  const [pt, mine, rd, myRd] = await Promise.all([
    playAt(o.lat, o.lon),
    away ? playAt(me.lat, me.lon) : Promise.resolve(null),
    aqiAt(o.lat, o.lon),
    away ? aqiAt(me.lat, me.lon) : Promise.resolve(null),
  ]);
  if (!state || seq !== state.envSeq || el.hidden) return;
  const hours = pt && Array.isArray(pt.hours) ? pt.hours.filter((h) => isNum(h.pm25_mid)) : [];
  const c = rd ? aqiOf(rd.pm25, rd.pm10) : null;
  const pmNow = rd ? rd.pm25 : (pt && isNum(pt.now_pm25) ? pt.now_pm25 : null);
  if (!c && pmNow == null) {
    el.innerHTML = `${cardTop(o.name, o.sub)}
      <div class="pm-plain">${pt && pt.error ? 'outside the area we cover' : 'no honest read for this spot right now'}</div>`;
    el.querySelector('.pm-x').addEventListener('click', closeEnv);
    return;
  }
  const avg = pt && isNum(pt.mean_pm25) ? pt.mean_pm25 : null;
  let best = null, worst = null;
  hours.forEach((h) => {
    if (!best || h.pm25_mid < best.pm25_mid) best = h;
    if (!worst || h.pm25_mid > worst.pm25_mid) worst = h;
  });
  const dayW = (h) => (h && h.day_offset === 1 ? ' tmrw' : '');
  const mc = myRd ? aqiOf(myRd.pm25, myRd.pm10) : null;
  const mAvg = mine && isNum(mine.mean_pm25) ? mine.mean_pm25 : null;
  /* a PM2.5 value in its CPCB PM2.5 sub-index band; an AQI in its band */
  const pmCell = (v) => `<b style="color:${bandInk(pmBand(v))}">${r0(v)}</b>`;
  const aqCell = (x) => `<b style="color:${bandInk(x ? x.band : null)}">${aqiTxt(x)}</b>`;
  let strip = '';
  if (hours.length > 3) {
    const vals = hours.map((h) => h.pm25_mid);
    const max = Math.max(...vals), min = Math.min(...vals), span = Math.max(1, max - min);
    strip = `<div class="pm-strip" aria-hidden="true">${hours.map((h) => {
      const fh = 0.18 + 0.82 * ((h.pm25_mid - min) / span);
      return `<i style="transform:scaleY(${fh.toFixed(3)});background:${bandCol(pmBand(h.pm25_mid))}"></i>`;
    }).join('')}</div>
    <div class="pm-strip-ax"><span>${esc(hours[0].ist_label || 'now')}</span><span>PM2.5 next 24 h</span><span>${esc(hours[hours.length - 1].ist_label || '')}</span></div>`;
  }
  const pmLine = [`PM2.5 ${r0(pmNow)}`, rd && isNum(rd.pm10) ? `PM10 ${r0(rd.pm10)}` : null]
    .filter(Boolean).join(' · ') + ' µg/m³';
  const head = c
    ? `<span class="v" style="color:${bandInk(c.band)}">${aqiTxt(c)}</span>
      <span class="u"><b>AQI now</b> · <span style="color:${bandInk(c.band)}">${BAND_WORD[c.band]}</span><br>${pmLine}</span>`
    : `<span class="v" style="color:${bandInk(pmBand(pmNow))}">${r0(pmNow)}</span>
      <span class="u"><b>PM2.5 now</b><br>µg/m³</span>`;
  const stats = hours.length || avg != null ? `
    <div class="pm-env-sec">PM2.5 µg/m³ · next 24 h${pt && pt.sparse ? ' · thin read here' : ''}</div>
    <div class="pm-stats">
      <div><span>24 h avg</span>${avg != null ? pmCell(avg) : '—'}</div>
      <div><span>best${dayW(best)}</span>${best ? `${pmCell(best.pm25_mid)}<em>${esc(best.ist_label)}</em>` : '—'}</div>
      <div><span>worst${dayW(worst)}</span>${worst ? `${pmCell(worst.pm25_mid)}<em>${esc(worst.ist_label)}</em>` : '—'}</div>
    </div>
    ${strip}` : '';
  const cmpRows = [
    c && mc ? `<div><span>AQI now</span>${aqCell(c)}${aqCell(mc)}</div>` : '',
    avg != null && mAvg != null ? `<div><span>PM2.5 24 h avg</span>${pmCell(avg)}${pmCell(mAvg)}</div>` : '',
  ].join('');
  el.innerHTML = `${cardTop(o.name, o.sub)}
    <div class="pm-env-num">${head}</div>
    ${stats}
    ${cmpRows ? `<div class="pm-cmp">
      <div class="pm-cmp-h"><span></span><span>here</span><span>where you are</span></div>
      ${cmpRows}
    </div>` : ''}`;
  el.querySelector('.pm-x').addEventListener('click', closeEnv);
}

/* ── places ───────────────────────────────────────────────────────── */
async function areaCentroids() {
  if (state.idx) return state.idx;
  const [ncr, sub] = await Promise.all([
    A.api.get('/ncr.geojson', 15000), A.api.get('/delhi_subdistricts.geojson', 15000)]);
  const idx = new Map();
  for (const fc of [ncr, sub]) {
    if (!fc || !Array.isArray(fc.features)) continue;
    for (const f of fc.features) {
      const p = f && f.properties;
      if (p && p.name && Array.isArray(p.centroid) && !idx.has(p.name)) idx.set(p.name, p.centroid);
    }
  }
  if (state) state.idx = idx;
  return idx;
}

async function loadPlaces() {
  const me = state.me;
  const q = me ? `lat=${me.lat.toFixed(5)}&lon=${me.lon.toFixed(5)}` : '';
  const scope = state.scope;
  const url = `/v2/purest?${q}${scope === 'ncr' ? '&scope=ncr' : `&radius_km=${RADIUS_KM}`}`;
  state.places = null;
  renderBody();
  const d = await A.api.get(url, 20000);
  if (!state || scope !== state.scope) return;
  const ref = me || state.anchor;
  let rows = [];
  if (d && Array.isArray(d.places)) {
    state.placesSrc = 'places';
    rows = d.places.filter((p) => p && isNum(p.lat) && isNum(p.lon));
    state.pickWhy = d.pick ? d.pick.why : null;
    state.placesErr = d.error || null;
    state.monitorsUp = d.monitors_up !== false;
    state.fieldAgeS = isNum(d.field_age_s) ? d.field_age_s : null;
  } else {
    /* /v2/purest not deployed yet: same honesty flags on district rows */
    const [dd, idx] = await Promise.all([A.api.get('/v2/districts', 20000), areaCentroids()]);
    if (!state || scope !== state.scope) return;
    rows = (dd && Array.isArray(dd.districts) ? dd.districts : [])
      .filter((r) => r && r.pm25 != null && r.confidence === 'field' && !r.partial_field_coverage
        && r.name !== 'Delhi NCT' && idx.has(r.name))
      .map((r) => {
        const c = idx.get(r.name);
        return { name: r.name, kind: 'area', lat: c[1], lon: c[0], pm25: r.pm25,
          area: r.parent || r.state || null };
      })
      .sort((a, b) => a.pm25 - b.pm25);
    state.placesSrc = 'areas';
    state.pickWhy = scope === 'ncr' ? 'cleanest air in NCR right now' : 'cleanest air near you right now';
    state.placesErr = null;
    state.monitorsUp = true;
    state.fieldAgeS = dd && isNum(dd.field_age_s) ? dd.field_age_s : null;
  }
  /* distance = our haversine from you; "15 km" means within 15 km */
  rows.forEach((p) => { p.dist_km = distFrom(ref, p.lat, p.lon); });
  if (scope !== 'ncr') rows = rows.filter((p) => p.dist_km == null || p.dist_km <= RADIUS_KM);
  /* the number on each row is the CPCB AQI at that spot (pm2.5 + pm10,
     the /aqi read home shows) — rank on that same number */
  rows = await withAqi(rows.slice(0, 10));
  if (!state || scope !== state.scope) return;
  rows.sort((a, b) => (a.cp ? a.cp.aqi : 9e9) - (b.cp ? b.cp.aqi : 9e9)
    || (a.read ? a.read.pm25 : a.pm25) - (b.read ? b.read.pm25 : b.pm25)
    || (a.dist_km ?? 9e9) - (b.dist_km ?? 9e9));
  state.places = rows;
  if (!rows.length || !rows[0].cp) state.pickWhy = null;
  repin();
  renderBody();
  fitPlaces();
}

/* ── hotels ───────────────────────────────────────────────────────── */
async function loadStays() {
  const a = state.anchor;
  state.stays = null;
  state.nearby = [];
  renderBody();
  const [d, nb] = await Promise.all([
    A.api.get(`/v2/stays?lat=${a.lat.toFixed(5)}&lon=${a.lon.toFixed(5)}&k=10`, 20000),
    A.api.get(`/v2/p/nearby?lat=${a.lat.toFixed(5)}&lon=${a.lon.toFixed(5)}&kind=lodging&radius_m=3000`, 6000),
  ]);
  if (!state || a !== state.anchor) return;
  const rows = d && Array.isArray(d.stays) ? d.stays : [];
  /* one row per hotel — the corpus repeats a roof under several sources */
  const out = [];
  for (const r of rows) {
    if (r.window_mean_ug == null && r.pm25_now == null) continue;
    const dup = out.some((o) => {
      const on = norm(o.name), rn = norm(r.name);
      const dk = hav(o.lat, o.lon, r.lat, r.lon);
      return (on && rn && (on === rn || (dk < 0.4 && (on.includes(rn) || rn.includes(on))))) || dk < 0.025;
    });
    if (!dup) out.push(r);
  }
  /* Alive's pick: the server marks it; older servers don't — then the
     best 24 h air on a solid (non-thin) read */
  if (!out.some((s) => s.pick)) {
    const i = out.findIndex((s) => s.window_mean_ug != null && !s.sparse);
    if (i >= 0) {
      const p = out.splice(i, 1)[0];
      p.pick = true;
      p.why = `cleanest next-24 h air near ${a.me ? 'you' : 'here'}`;
      out.unshift(p);
    }
  }
  /* each row: our own distance from the "near …" point, and the AQI now
     at the hotel (the same /aqi read + CPCB index as home) */
  const stays = out.slice(0, HOTELS_N);
  stays.forEach((s) => { s.dist_km = distFrom(a, s.lat, s.lon); });
  await withAqi(stays);
  if (!state || a !== state.anchor) return;
  const pick = stays.filter((s) => s.pick);
  const rest = stays.filter((s) => !s.pick).sort((x, y) => (x.cp ? x.cp.aqi : 9e9) - (y.cp ? y.cp.aqi : 9e9)
    || (x.dist_km ?? 9e9) - (y.dist_km ?? 9e9));
  state.stays = pick.concat(rest);
  state.staysErr = d && d.error ? 'outside the area we cover' : (!d ? 'hotels didn’t load — try again' : null);
  if (nb && nb.configured !== false && Array.isArray(nb.results)) {
    state.nearby = nb.results
      .filter((r) => r && r.lat != null && r.lon != null && r.name)
      .filter((r) => !state.stays.some((s) => norm(s.name) === norm(r.name)))
      .map((r) => ({ ...r, dist_km: distFrom(a, r.lat, r.lon) }))
      .sort((x, y) => (x.dist_km ?? 9e9) - (y.dist_km ?? 9e9))
      .slice(0, 5);
  }
  repin();
  renderBody();
}

/* hotel search — lodging only. A.search.live when present (streams
   tiers), else A.search.search; plus the index asked for the name
   with 'hotel' so a bare brand ('radisson') still finds the roof. */
function hotelSearch(q, bias, onRows) {
  const seen = [];
  const merge = (rows) => {
    for (const r of rows || []) {
      if (!r || r.lat == null || r.lon == null || !r.name || !isLodging(r)) continue;
      const dup = seen.some((o) => norm(o.name) === norm(r.name) && hav(o.lat, o.lon, +r.lat, +r.lon) < 0.3);
      /* distance: our haversine from the bias point — provider/index
         distance_m fields have been seen measured from elsewhere */
      if (!dup) seen.push({ ...r, lat: +r.lat, lon: +r.lon, dist_km: distFrom(bias, r.lat, r.lon) });
    }
    seen.sort((a, b) => (a.dist_km ?? 9e9) - (b.dist_km ?? 9e9));
    onRows(seen.slice(0, 8));
  };
  const idx = async (qq) => {
    const p = new URLSearchParams({ q: qq, lat: bias.lat, lon: bias.lon });
    const j = await A.api.get(`/v2/search?${p}`, 6000);
    return j && Array.isArray(j.results) ? j.results.map((r) => ({
      name: r.name, sub: r.subtitle || '', kind: r.kind, lat: r.lat, lon: r.lon,
      source: 'index' })) : [];
  };
  const jobs = [];
  if (!LODGE_NAME.test(q)) jobs.push(idx(`${q} hotel`).then(merge));
  jobs.push(idx(q).then(merge));
  try {
    if (A.search && typeof A.search.live === 'function') {
      A.search.live(q, bias, (rows) => merge(rows));
      return Promise.all(jobs).then(() => seen);
    }
  } catch (e) { /* the index jobs still answer */ }
  /* the wider public-layer search only when the index found no roof */
  return Promise.all(jobs).then(async () => {
    if (!seen.length && A.search && A.search.search) {
      try { merge(await A.search.search(q, bias)); } catch (e) { /* honest empty */ }
    }
    return seen;
  });
}

/* ── anchor picker for "hotels near …" ───────────────────────────── */
function openPicker() {
  const body = state.body;
  state.picking = true;
  body.innerHTML = `
    <div class="searchbar pm-search">
      <span class="sdot a"></span>
      <input type="text" autocomplete="off" autocorrect="off" spellcheck="false"
        placeholder="hotels near…" aria-label="hotels near a place">
    </div>
    <div class="pm-quick">
      ${state.me ? `<button class="srow" type="button" data-me="1"><span class="ic">◉</span>
        <span class="pm-row-main"><span class="n">near you</span></span></button>` : ''}
      <button class="srow" type="button" data-back="1"><span class="ic">‹</span>
        <span class="pm-row-main"><span class="n">back</span></span></button>
    </div>
    <div class="row-list pm-results"></div>`;
  const input = body.querySelector('input');
  const list = body.querySelector('.pm-results');
  const finish = (p) => {
    state.picking = false;
    state.anchor = { lat: p.lat, lon: p.lon, label: p.label || p.name, me: !!p.me };
    renderBody();
    loadStays();
  };
  const meBtn = body.querySelector('[data-me]');
  if (meBtn) meBtn.addEventListener('click', () => finish({ ...state.me, label: 'you', me: true }));
  body.querySelector('[data-back]').addEventListener('click', () => { state.picking = false; renderBody(); });
  let deb = null, seq = 0;
  input.addEventListener('input', () => {
    clearTimeout(deb);
    const q = input.value.trim();
    if (q.length < 2) { list.innerHTML = ''; return; }
    deb = setTimeout(async () => {
      const my = ++seq;
      list.innerHTML = '<div class="pm-plain">searching…</div>';
      const res = await A.search.search(q, state.me || A.DELHI);
      if (!state || my !== seq) return;
      list.innerHTML = res.length ? '' : '<div class="pm-plain">nothing found</div>';
      res.slice(0, 8).forEach((r) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'srow';
        b.innerHTML = `<span class="ic">◦</span><span class="pm-row-main"><span class="n">${esc(r.name)}</span>
          <span class="s">${esc([r.sub, kmTxt(distFrom(state.me || A.DELHI, r.lat, r.lon))].filter(Boolean).join(' · '))}</span></span>`;
        b.addEventListener('click', () => finish(r));
        list.appendChild(b);
      });
    }, 260);
  });
  requestAnimationFrame(() => input.focus());
}

/* ── body ─────────────────────────────────────────────────────────── */
function placeRow(p, i) {
  const c = p.cp;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'srow pm-row';
  const isPick = i === 0 && state.pickWhy;
  const dist = kmTxt(p.dist_km);
  const sub = [isPick ? state.pickWhy : (p.kind === 'park' ? 'park' : (p.area || '')),
    dist].filter(Boolean).join(' · ');
  const pm = p.read ? p.read.pm25 : null;
  el.innerHTML = `
    <span class="pm-rank">${i + 1}</span>
    <span class="pm-row-main">
      <span class="n">${esc(p.name)}${isPick ? ' <i class="pm-pick">alive pick</i>' : ''}</span>
      <span class="s">${esc(sub)}</span>
    </span>
    <span class="pm-v">
      <b style="color:${bandInk(c ? c.band : null)}">${aqiTxt(c)}</b>
      <i>${c ? `AQI now${pm != null ? ` · PM2.5 ${r0(pm)}` : ''}` : 'no read now'}</i>
    </span>`;
  el.addEventListener('click', () => {
    A.map.fly(p.lat, p.lon, p.kind === 'area' && state.placesSrc === 'areas' ? 11.5 : 14);
    openEnv({ name: p.name, sub: [p.kind === 'park' ? 'park' : p.area, dist ? `${dist} away` : null].filter(Boolean).join(' · '), lat: p.lat, lon: p.lon });
  });
  return el;
}

function hotelRow(s, opts = {}) {
  const c = s.cp;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'srow pm-row';
  const dist = kmTxt(s.dist_km);
  const sub = [s.pick ? s.why : null, dist, s.sparse ? 'thin read' : null].filter(Boolean).join(' · ');
  el.innerHTML = `
    <span class="ic pm-stay-ic" aria-hidden="true"></span>
    <span class="pm-row-main">
      <span class="n">${esc(nice(s.name))}${s.pick ? ' <i class="pm-pick">alive pick</i>' : ''}</span>
      <span class="s">${esc(sub || s.sub || '')}</span>
    </span>
    ${opts.noValue ? '<span class="pm-v pm-go">›</span>' : `<span class="pm-v">
      <b style="color:${bandInk(c ? c.band : null)}">${aqiTxt(c)}</b>
      <i>${c ? 'AQI now' : 'no read now'}</i>
    </span>`}`;
  el.addEventListener('click', () => {
    A.map.fly(s.lat, s.lon, 14.5);
    clearPins(); repin();
    addPin('pm-h-sel', s.lon, s.lat, '<div class="pin-dot pm-stay-dot pm-sel"></div>');
    openEnv({ name: nice(s.name), sub: dist ? `${dist} away` : (s.sub || ''), lat: s.lat, lon: s.lon });
  });
  return el;
}

function renderBody() {
  if (!state || state.picking) return;
  const body = state.body;
  body.innerHTML = '';

  /* places */
  const head = document.createElement('div');
  head.className = 'pm-head';
  head.innerHTML = `<div class="sec-label">cleanest air ${state.scope === 'ncr' ? 'in NCR' : 'near you'}</div>
    <div class="pm-seg" role="tablist">
      <button type="button" data-s="near" class="${state.scope === 'near' ? 'on' : ''}">${RADIUS_KM} km</button>
      <button type="button" data-s="ncr" class="${state.scope === 'ncr' ? 'on' : ''}">all NCR</button>
    </div>`;
  head.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => {
    if (state.scope === b.dataset.s) return;
    state.scope = b.dataset.s;
    loadPlaces();
  }));
  body.appendChild(head);

  /* the field's own honesty: how fresh the read is, and when no live
     monitors are up that these are satellite+model reads — never left
     for the user to guess */
  if (state.places !== null || state.monitorsUp === false) {
    const ageM = state.fieldAgeS != null ? Math.max(0, Math.floor(state.fieldAgeS / 60)) : null;
    const src = state.monitorsUp === false
      ? 'satellite + model field — live monitors down'
      : 'live-monitor field';
    body.insertAdjacentHTML('beforeend',
      `<div class="pm-plain" style="padding-top:0">${src}${ageM != null ? ` · updated ${ageM} min ago` : ''}</div>`);
  }

  if (!state.places) {
    body.insertAdjacentHTML('beforeend',
      '<div class="sk pm-sk"></div><div class="sk pm-sk"></div><div class="sk pm-sk"></div>');
  } else if (!state.places.length) {
    body.insertAdjacentHTML('beforeend', `<div class="pm-plain">${state.placesErr
      ? 'outside the area we cover'
      : (state.scope === 'near' ? `no solid air reads within ${RADIUS_KM} km — try all NCR` : 'no solid air reads right now')}</div>`);
  } else {
    const list = document.createElement('div');
    list.className = 'row-list';
    state.places.slice(0, PLACES_N).forEach((p, i) => list.appendChild(placeRow(p, i)));
    body.appendChild(list);
  }

  /* hotels */
  const h2 = document.createElement('div');
  h2.className = 'sec-label pm-sec2';
  h2.textContent = 'hotels';
  body.appendChild(h2);

  const sb = document.createElement('div');
  sb.className = 'searchbar pm-search';
  sb.innerHTML = `<span class="sdot a"></span>
    <input type="search" autocomplete="off" autocorrect="off" spellcheck="false"
      placeholder="find any hotel" aria-label="find any hotel" value="${esc(state.hq || '')}">`;
  body.appendChild(sb);
  const results = document.createElement('div');
  results.className = 'row-list pm-results';
  body.appendChild(results);
  const input = sb.querySelector('input');
  const drawResults = (rows, note) => {
    results.innerHTML = note ? `<div class="pm-plain">${note}</div>` : '';
    rows.forEach((r) => results.appendChild(hotelRow(r, { noValue: true })));
  };
  let deb = null;
  input.addEventListener('input', () => {
    clearTimeout(deb);
    const q = input.value.trim();
    state.hq = input.value;
    if (q.length < 2) { results.innerHTML = ''; anchorWrap.hidden = false; return; }
    anchorWrap.hidden = true;
    deb = setTimeout(() => {
      const my = (state.hseq = (state.hseq || 0) + 1);
      drawResults([], 'searching…');
      let got = false;
      hotelSearch(q, state.me || state.anchor || A.DELHI, (rows) => {
        if (!state || my !== state.hseq) return;
        if (rows.length) { got = true; drawResults(rows); }
      }).then(() => {
        if (state && my === state.hseq && !got) drawResults([], 'no hotel by that name here');
      });
    }, 240);
  });

  const anchorWrap = document.createElement('div');
  if ((state.hq || '').trim().length >= 2) anchorWrap.hidden = true;
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'pm-anchor';
  chip.innerHTML = `<span class="pm-anchor-label">near ${esc(state.anchor.me ? 'you' : (state.anchor.label || 'this point'))}</span>
    <span class="pm-anchor-edit">change</span>`;
  chip.addEventListener('click', openPicker);
  anchorWrap.appendChild(chip);

  if (!state.stays) {
    anchorWrap.insertAdjacentHTML('beforeend', '<div class="sk pm-sk"></div><div class="sk pm-sk"></div>');
  } else if (!state.stays.length) {
    anchorWrap.insertAdjacentHTML('beforeend',
      `<div class="pm-plain">${state.staysErr || 'no hotels with an honest read here'}</div>`);
  } else {
    const list = document.createElement('div');
    list.className = 'row-list';
    state.stays.forEach((s) => list.appendChild(hotelRow(s)));
    anchorWrap.appendChild(list);
  }
  if (state.nearby && state.nearby.length) {
    const more = document.createElement('div');
    more.className = 'row-list';
    state.nearby.forEach((r) => more.appendChild(hotelRow(r, { noValue: true })));
    anchorWrap.appendChild(more);
  }
  body.appendChild(anchorWrap);
}

/* ── the screen ──────────────────────────────────────────────────── */
A.screen('purest', {
  mount(el) {
    const chrome = A.sheetChrome(el, 'purest places');
    el.classList.add('pm-host');
    const pos = A.geo.pos && A.geo.pos.lat != null ? { lat: A.geo.pos.lat, lon: A.geo.pos.lon } : null;
    state = {
      el,
      body: chrome.body,
      me: pos,
      anchor: pos ? { ...pos, label: 'you', me: true } : { ...A.DELHI, label: 'central Delhi', me: false },
      scope: 'near',
      places: null, placesSrc: null, pickWhy: null, placesErr: null,
      stays: null, staysErr: null, nearby: [],
      idx: null, envEl: null, pinIds: [], playCache: new Map(), aqiCache: new Map(),
      picking: false, hq: '',
    };
    A.map.setFieldVisible(false);
    if (pos && A.map.puckMove) A.map.puckMove(pos.lat, pos.lon);
    renderBody();
    loadPlaces();
    loadStays();

    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (state && state.envEl && !state.envEl.hidden) closeEnv();
      else if (chrome.sheetEl.classList.contains('on')) chrome.close();
    };
    document.addEventListener('keydown', onKey);

    /* teardown must survive BOTH router paths: back() calls our cleanup,
       but show(replace) only drops the 'on' class and removes the element
       — so a class observer catches that case too. */
    let torn = false;
    const teardown = () => {
      if (torn) return;
      torn = true;
      document.removeEventListener('keydown', onKey);
      mo.disconnect();
      clearPins();
      if (state && state.envEl) state.envEl.hidden = true;
      state = null;
    };
    const mo = new MutationObserver(() => {
      if (!el.classList.contains('on')) teardown();
    });
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return teardown;
  },
});
})();
