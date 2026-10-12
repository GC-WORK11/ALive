/* Alive webapp — the shared map. MapLibre GL + OpenFreeMap Positron
   (free, no key, the whole planet — every street of Delhi, the NCR and
   the UP/Haryana outskirts). If the remote style can't load, the same
   OpenMapTiles-schema roads come from the server's own pmtiles
   (/tiles/tilejson.json) — an offline fallback, never the primary.

   The live field (/grid PM2.5 + PM10 cells — the same surface /aqi
   reads) becomes the CPCB AQI (same index + words as the home hero)
   and is painted two ways, both in the existing band palette only:
     · a smooth tint under the roads: the cell centres bilinearly
       interpolated, each pixel coloured by its band, alpha = the cell's
       own confidence (distance to the nearest real sample) — it fades
       out where the field is thin and stops at the field's edge;
     · street level (A.map.airRoads): the roads in view re-drawn in the
       band of the field at their spot — thin-confidence cells are left
       uncoloured rather than guessed.

   API (backward compatible): init, ready, loadField, setFieldVisible,
   fieldEpoch, showRoute, hideRoute, hideAllRoutes, pin, unpin,
   clearPins, puckMove, puckRemove, fly, fit, center, map.
   New: traffic(map, on), airRoads(on), sampleField(lat, lon),
   fieldInfo(), cpcbAqi(pm25, pm10) → number, cpcb(pm25, pm10) →
   {aqi, over, band, basis}, aqiBand(aqi), segBand(segment), BANDS.
   showRoute(id, geojson, opts) — opts may be null (picked style), a
   bare segments array (older callers), or an object:
     { segments: [...], ghost: true, label: '11 km · 24 min' }
   ghost paints a muted dashed alternative under the picked route;
   label pins a small chip on the route's midpoint. Segments may carry
   band as the CPCB word ('Very Poor') or the 0-5 index — both paint.
   fit(g, pad) — pad is a number or a box {top,left,right,bottom};
   {sheetRight:px} adds clearance on the right for the desktop sheet
   (a bare {sheetRight} object keeps the default padding elsewhere). */
(() => {
'use strict';
const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const OMT = 'openmaptiles';                 // the vector source id in the style
const BANDS = ['#6E93AE', '#C7A34F', '#CF8A50', '#C05F3A', '#A83D30', '#6E2D28'];
const CONF_W = { hi: 1, med: 0.72, lo: 0.22 };   // tint alpha per cell confidence
const ROAD_W = { hi: 1, med: 0.78, lo: 0 };      // roads: thin cells stay uncoloured
const API_ORIGIN = (() => {
  const q = new URLSearchParams(location.search).get('api');
  return q ? q.replace(/\/$/, '') : location.origin;
})();

let map = null, ready = false, queue = [];
let fieldEpoch = null, field = null, fieldWanted = false, fieldTimer = null;
let styleOk = false, fellBack = false, omtTileOk = false, omtErrors = 0;
/* WebGL-off mode: a Leaflet raster map takes the same API instead of a
   dead canvas — 'basic' means no street-level air colours, everything
   else (field tint, pins, puck, routes, traffic tiles) still works */
let basicMode = false, fieldImg = null, trafficLayer = null;
const lfRoutes = new Map();

function markReady() {
  if (ready) return;
  ready = true;
  queue.forEach((cb) => { try { cb(map); } catch (err) { /* one caller's bug never blocks the rest */ } });
  queue = [];
  loadField(true);
  // live field — repaint every 5 min quietly
  fieldTimer = setInterval(() => loadField(false), 300000);
}

/* ── basemap ─────────────────────────────────────────────────────── */
/* the offline fallback: our own pmtiles, quiet positron-like paint, no
   glyph/sprite dependency (labels need the remote font server) */
/* direct tile URLs, not the TileJSON: behind CloudFront the server's
   own base_url is the ALB's http host (mixed content from https) */
const LOCAL_TILES = () => ({
  type: 'vector', tiles: [`${API_ORIGIN}/tiles/delhi/{z}/{x}/{y}.mvt`],
  minzoom: 0, maxzoom: 14, bounds: [76.8, 28.2, 77.9, 28.95],
  attribution: '© OpenStreetMap contributors',
});
function offlineStyle() {
  const road = (id, classes, color, w0, w1, minzoom) => ({
    id, type: 'line', source: OMT, 'source-layer': 'transportation', minzoom: minzoom || 0,
    filter: ['in', ['get', 'class'], ['literal', classes]],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': color, 'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 10, w0, 18, w1] },
  });
  return {
    version: 8, name: 'alive-offline',
    sources: { [OMT]: LOCAL_TILES() },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': 'rgb(242,243,240)' } },
      { id: 'park', type: 'fill', source: OMT, 'source-layer': 'park', paint: { 'fill-color': 'rgb(230,233,229)' } },
      { id: 'water', type: 'fill', source: OMT, 'source-layer': 'water', paint: { 'fill-color': 'rgb(194,200,202)' } },
      { id: 'building', type: 'fill', source: OMT, 'source-layer': 'building', minzoom: 14, paint: { 'fill-color': 'rgb(234,234,229)', 'fill-outline-color': 'rgb(219,219,218)' } },
      road('highway_minor_casing', ['minor', 'service', 'tertiary'], 'rgb(220,220,218)', 0.6, 16, 12),
      road('highway_minor', ['minor', 'service', 'tertiary'], '#ffffff', 0.4, 13, 12),
      road('highway_major_casing', ['primary', 'secondary', 'trunk', 'motorway'], 'rgb(213,213,213)', 1.6, 24),
      road('highway_major_inner', ['primary', 'secondary', 'trunk', 'motorway'], '#ffffff', 1, 20),
    ],
  };
}

/* quiet Uber-light tweaks on top of Positron: streets a touch firmer so
   the grid reads at street zoom; labels keep Positron's soft greys */
function tuneBasemap(m) {
  const set = (id, k, v) => { try { if (m.getLayer(id)) m.setPaintProperty(id, k, v); } catch (e) { /* layer shape changed upstream — keep the stock paint */ } };
  set('highway_minor', 'line-color', '#ffffff');
  set('highway_minor', 'line-opacity', 1);
  set('highway_path', 'line-color', 'rgb(226,226,224)');
  set('building', 'fill-color', 'rgb(232,232,228)');
}

function fallBack(reason) {
  if (fellBack) return;
  fellBack = true;
  if (!styleOk) { map.setStyle(offlineStyle()); return; }
  /* the style loaded but its vector source (the planet TileJSON) or its
     tiles don't — keep the very same style, every basemap layer and every
     overlay already added, and point only that source at the local tiles
     (same OpenMapTiles schema). setStyle diffs: the source and the layers
     that read it are swapped, nothing else is touched. */
  try {
    const s = map.getStyle();
    if (s && s.sources && s.sources[OMT]) {
      s.sources[OMT] = LOCAL_TILES();
      map.setStyle(s);
    }
  } catch (e) { /* stay on what we have */ }
  void reason;
}

/* MapLibre draws with WebGL; a browser with graphics acceleration off (some
   laptops, hardened browser settings) would otherwise show an empty map —
   say so plainly instead */
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
  } catch (e) { return false; }
}
function noMapNote() {
  const el = document.getElementById('map');
  if (!el || el.querySelector('.map-nogl')) return;
  const n = document.createElement('div');
  n.className = 'map-nogl';
  n.setAttribute('role', 'note');
  n.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-size:15px;line-height:1.45;color:#4A4E57;background:#F2F3F0';
  n.textContent = "This browser has graphics acceleration (WebGL) turned off, so the map can't draw. Turn on hardware acceleration in your browser settings, or open Alive on your phone — every number still works.";
  el.appendChild(n);
}

/* ── basic mode: Leaflet + raster tiles when WebGL can't run ────────── */
/* a slim chip, not a wall — the map is real, just without street-level
   air colours (those need the vector source only WebGL can draw) */
function basicNote() {
  const el = document.getElementById('map');
  if (!el || el.querySelector('.map-nogl')) return;
  const n = document.createElement('div');
  n.className = 'map-nogl';
  n.setAttribute('role', 'note');
  n.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:800;max-width:82%;padding:6px 12px;border-radius:20px;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(20,20,20,.14);font-size:12.5px;line-height:1.4;color:#4A4E57;text-align:center;pointer-events:none';
  n.textContent = 'Basic map — this browser has graphics acceleration off, so live road colours can\'t draw. Everything else still works.';
  el.appendChild(n);
}
/* raster providers for basic mode — tried in order; a browser/network
   that drops one still gets a real map from the next */
const BASIC_TILES = [
  { url: 'https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors · tiles: Wikimedia' },
  { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '© OpenStreetMap contributors · tiles: Esri' },
  { url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', sub: 'abc',
    attribution: '© OpenStreetMap contributors · tiles: OSM-France' },
];
/* positioning-critical Leaflet CSS, inlined — if the CDN stylesheet is
   the thing that's blocked, tiles and markers still land where they
   should instead of piling at the corner */
const BASIC_CSS =
  '#map .leaflet-pane,#map .leaflet-tile,#map .leaflet-marker-icon,#map .leaflet-image-layer,#map .leaflet-layer,#map .leaflet-pane>svg{position:absolute;left:0;top:0}' +
  '#map .leaflet-container{overflow:hidden;background:var(--surface2,#EDECE7)}' +
  '#map .leaflet-tile{-webkit-user-select:none;user-select:none;visibility:hidden}' +
  '#map .leaflet-tile-loaded{visibility:inherit}' +
  '#map .leaflet-marker-icon,#map .leaflet-image-layer{display:block}' +
  '#map .leaflet-pane{z-index:400}#map .leaflet-tile-pane{z-index:200}' +
  '#map .leaflet-overlay-pane{z-index:400}#map .leaflet-marker-pane{z-index:600}' +
  '#map .leaflet-top,#map .leaflet-bottom{position:absolute;z-index:1000;pointer-events:none}' +
  '#map .leaflet-top{top:0}#map .leaflet-bottom{bottom:0}' +
  '#map .leaflet-left{left:0}#map .leaflet-right{right:0}' +
  '#map .leaflet-control{position:relative;z-index:800;pointer-events:auto}' +
  '#map .leaflet-bottom .leaflet-control{margin:10px}' +
  '#map .leaflet-control-attribution{background:rgba(255,255,255,.7);font-size:10px;padding:1px 6px;color:#555}' +
  '#map .leaflet-control-attribution a{color:#555}' +
  '#map .leaflet-control-zoom a{display:block;width:34px;height:34px;line-height:34px;text-align:center;' +
  'background:#fff;color:#4A4E57;border-radius:6px;box-shadow:0 1px 5px rgba(20,20,20,.18);margin-bottom:4px;' +
  'text-decoration:none;font-size:19px;font-weight:600}' +
  '#map .leaflet-control-zoom a:last-child{margin-bottom:0}';
function initBasic() {
  basicMode = true;
  if (!document.getElementById('map')) { noMapNote(); return; }
  const start = () => {
    if (!window.L) { noMapNote(); return; }
    map = window.L.map('map', {
      center: [A.DELHI.lat, A.DELHI.lon], zoom: 11,
      minZoom: 9, maxZoom: 18, zoomControl: false,
      scrollWheelZoom: true,
      attributionControl: true,
    });
    /* bottom-LEFT: the screen sheet docks on the right (desktop) and
       would cover a bottom-right control entirely */
    window.L.control.zoom({ position: 'bottomleft' }).addTo(map);
    /* callers like whereto.js style MapLibre layers through ready(m =>
       m.getLayer('route-x-line')) — Leaflet's Map has no getLayer (only
       LayerGroups do), so the call threw mid-loop and killed the rest
       of the paint: routes half-drawn, no fit. A no-op returning
       undefined turns every guard into a safe skip. */
    map.getLayer = () => undefined;
    /* tiles: count loads vs errors; a provider that draws nothing (or
       mostly errors) within a few seconds is swapped for the next */
    let bi = 0, tOk = 0, tErr = 0;
    const addTiles = (i) => {
      const s = BASIC_TILES[i];
      if (!s) return;
      tOk = 0; tErr = 0;
      const tl = window.L.tileLayer(s.url, {
        maxZoom: 19, subdomains: s.sub || 'abc', attribution: s.attribution,
      });
      tl.on('tileload', () => { tOk++; });
      tl.on('tileerror', () => { tErr++; });
      tl.addTo(map);
      setTimeout(() => {
        if (bi !== i) return;
        if (tOk === 0 || tErr > tOk * 3) { bi = i + 1; tl.remove(); addTiles(bi); }
      }, 8000);
    };
    addTiles(0);
    map.on('click', (e) => {
      document.dispatchEvent(new CustomEvent('alive:maptap', { detail: { lat: e.latlng.lat, lon: e.latlng.lng, point: e.containerPoint } }));
    });
    basicNote();
    markReady();
  };
  const st = document.createElement('style');
  st.textContent = BASIC_CSS;
  document.head.appendChild(st);
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(css);
  const s = document.createElement('script');
  s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  s.onload = start;
  s.onerror = noMapNote;
  document.head.appendChild(s);
}
/* the field tint is a painted PNG — an image overlay carries it in
   basic mode exactly like the raster source does under MapLibre */
function leafFieldVisible(v) {
  if (!map || !fieldImg) return;
  if (v && !map.hasLayer(fieldImg)) fieldImg.addTo(map);
  if (!v && map.hasLayer(fieldImg)) map.removeLayer(fieldImg);
}
const leafLL = (coords) => coords.map((c) => [c[1], c[0]]);
function leafShowRoute(id, geojson, opts) {
  onReady(() => {
    leafHideRoute(id);
    const o = normRouteOpts(opts);
    const coords = routeCoords(geojson);
    if (!coords.length) return;
    const ghost = !!o.ghost;
    const ll = leafLL(coords);
    const g = window.L.layerGroup().addTo(map);
    const line = (pts, p) => window.L.polyline(pts,
      { interactive: false, lineCap: 'round', lineJoin: 'round', ...p }).addTo(g);
    /* the same stack the WebGL side draws: a faint rim so the casing
       reads as an edge, the paper casing, the core, then each dose
       band on its own halo — no more bare hairlines */
    line(ll, { color: RT_EDGE, weight: ghost ? 8 : 11, opacity: ghost ? 0.3 : 0.42 });
    line(ll, { color: ghost ? '#F0F1ED' : RT_PAPER, weight: ghost ? 6.5 : 9, opacity: ghost ? 0.8 : 0.95 });
    line(ll, { color: ghost ? RT_GHOST : RT_INK, weight: ghost ? 3.4 : 4.6, opacity: ghost ? 0.85 : 0.95,
      ...(ghost ? { dashArray: '7 7' } : {}) });
    const n = coords.length;
    /* halos first, band strokes after — a later halo can't nick the
       previous band's cap at a seam */
    const bandSegs = (o.segments || []).map((s) => {
      const bi = segBandIdx(s);
      if (bi == null) return null;
      const a = Math.floor((s.start_frac ?? 0) * (n - 1));
      const b = Math.max(a + 1, Math.ceil((s.end_frac ?? 1) * (n - 1)));
      return { bi, pts: leafLL(coords.slice(a, b + 1)) };
    }).filter(Boolean);
    for (const bs of bandSegs) line(bs.pts, { color: RT_PAPER, weight: 7, opacity: 0.9 });
    for (const bs of bandSegs) line(bs.pts, { color: BANDS[bs.bi], weight: 4.6, opacity: 0.95 });
    if (o.label) {
      const mid = routeMidpoint(coords);
      const ic = window.L.divIcon({ className: '',
        html: `<div style="transform:translate(-50%,-50%)">${rtLabelHtml(o.label)}</div>` });
      window.L.marker([mid[1], mid[0]], { icon: ic, interactive: false, keyboard: false }).addTo(g);
    }
    lfRoutes.set(id, g);
  });
}
function leafHideRoute(id) { const g = lfRoutes.get(id); if (g) { g.remove(); lfRoutes.delete(id); } }
function leafHideAll() { lfRoutes.forEach((g) => g.remove()); lfRoutes.clear(); }
function leafPin(id, lon, lat, html, cls) {
  onReady(() => {
    unpin(id);
    /* 'anchor-b' in cls = the pin's bottom tip sits on the point (matches
       MapLibre anchor:'bottom'); default centres the marker like MapLibre */
    const ay = /(^|\s)anchor-b(\s|$)/.test(cls || '') ? '-100%' : '-50%';
    const ic = window.L.divIcon({ className: '', html: `<div class="alive-pin ${cls || ''}" style="transform:translate(-50%,${ay})">${html || '<div class="pin-dot"></div>'}</div>` });
    pins.set(id, window.L.marker([lat, lon], { icon: ic, interactive: false, keyboard: false }).addTo(map));
  });
}
function leafPuckMove(lat, lon, acc) {
  onReady(() => {
    if (!puck) {
      const ic = window.L.divIcon({ className: '', html: '<div class="alive-puck" style="transform:translate(-50%,-50%)"><div class="puck-ring"></div><div class="puck-core"></div></div>' });
      puck = window.L.marker([lat, lon], { icon: ic, interactive: false, keyboard: false }).addTo(map);
      puckEl = puck.getElement() && puck.getElement().firstChild;
    } else puck.setLatLng([lat, lon]);
    if (acc && puckEl) puckEl.style.setProperty('--acc', `${Math.min(160, acc)}px`);
  });
}
function leafFly(lat, lon, zoom) {
  onReady(() => map.flyTo([lat, lon], zoom ?? map.getZoom(), { duration: 0.9 }));
}
function leafFit(geojsonOrCoords, pad) {
  onReady(() => {
    const g = geojsonOrCoords;
    const coords = (g && (g.type === 'Feature' ? g.geometry.coordinates : g.type === 'LineString' ? g.coordinates : g)) || [];
    if (!coords.length) return;
    /* the box callers pass ({top,left,right,bottom[,sheetRight]}) maps
       onto Leaflet's two corner paddings — identical to the WebGL side */
    const p = padBox(pad);
    map.flyToBounds(window.L.latLngBounds(leafLL(coords)), {
      paddingTopLeft: window.L.point(p.left, p.top),
      paddingBottomRight: window.L.point(p.right, p.bottom),
    });
  });
}
function leafTraffic(on) {
  const off = () => { if (trafficLayer) { trafficLayer.remove(); trafficLayer = null; } return false; };
  if (!on || !map) return Promise.resolve(off());
  return probeFlow().then((ok) => {
    if (!ok) return off();
    if (!trafficLayer) {
      trafficLayer = window.L.tileLayer(`${API_ORIGIN}/v2/p/flow_tile/{z}/{x}/{y}.png`, {
        tileSize: 256, minZoom: 6, maxZoom: 18, opacity: 0.9,
        bounds: [[27.4, 75.8], [30.0, 78.9]],
      });
    }
    trafficLayer.addTo(map);
    return true;
  });
}

function init() {
  if (!webglOK() || !window.maplibregl) { initBasic(); return; }
  map = new maplibregl.Map({
    container: 'map',
    style: STYLE_URL,
    center: [A.DELHI.lon, A.DELHI.lat],
    zoom: 10.2,
    maxZoom: 17, minZoom: 8.4,
    attributionControl: { compact: true },
    dragRotate: false, pitchWithRotate: false,
    touchZoomRotate: true,
  });
  /* bottom-LEFT — the app's screen sheet docks on the right (desktop)
     and sits over a bottom-right control, making zoom unreachable */
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
  map.touchZoomRotate.disableRotation();
  const guard = setTimeout(() => { if (!styleOk) fallBack('style timeout'); }, 9000);
  map.on('style.load', () => {
    if (!styleOk) { styleOk = true; clearTimeout(guard); }
    tuneBasemap(map);
    /* overlays + camera can start as soon as the style is in — 'load'
       also waits for every first tile, and a stalled or failed basemap
       source would otherwise hold the whole app's map hostage */
    markReady();
  });
  /* one error listener = MapLibre stops console-logging every failed
     tile; the basemap falls back, overlays (traffic) fail silently */
  map.on('error', (e) => {
    const sid = e && e.sourceId;
    if (!styleOk && !sid) { fallBack('style error'); return; }
    /* the source itself failing (its TileJSON — no tile on the event)
       falls back at once; tile failures after a few in a row */
    if (sid === OMT && !omtTileOk && (!e.tile || ++omtErrors >= 4)) { fallBack('tiles error'); return; }
    /* a caller's bad layer/expression still surfaces (quietly) */
    const msg = e && e.error && String(e.error.message || '');
    if (!sid && msg && !/glyph|sprite|fetch|abort|network/i.test(msg)) console.warn('[map]', msg);
  });
  map.on('data', (e) => { if (!omtTileOk && e.sourceId === OMT && e.tile) omtTileOk = true; });
  map.on('load', markReady);
  map.on('click', (e) => {
    document.dispatchEvent(new CustomEvent('alive:maptap', { detail: { lat: e.lngLat.lat, lon: e.lngLat.lng, point: e.point } }));
  });
}

/* queued callbacks are error-isolated in markReady; a callback that
   arrives after ready ran the same way — one caller's throw must not
   kill the rest of its own paint loop */
function onReady(cb) {
  if (ready) { try { cb(map); } catch (err) { /* caller's bug — never blocks the rest */ } }
  else queue.push(cb);
}

/* first road layer of the basemap — the tint sits under every street */
function firstRoadLayer(m) {
  for (const l of m.getStyle().layers) {
    if (l['source-layer'] === 'transportation' || l['source-layer'] === 'building') return l.id;
  }
  return firstSymbol(m);
}
function firstSymbol(m) {
  for (const l of m.getStyle().layers) if (l.type === 'symbol') return l.id;
  return undefined;
}

/* ── the field: /grid cells → a regular lattice we can sample ──────
   Two layers of the same live surface (/grid param=pm2_5 and pm10, one
   lattice) → the CPCB national AQI per point: max of the PM2.5 and
   PM10 sub-indices through CPCB's breakpoint tables — the same index,
   tables and category words the home hero uses, so the colour on the
   street and the number on home always agree. */
const CPCB_PM25 = [[0, 30, 0, 50], [30, 60, 51, 100], [60, 90, 101, 200], [90, 120, 201, 300], [120, 250, 301, 400], [250, 500, 401, 500]];
const CPCB_PM10 = [[0, 50, 0, 50], [50, 100, 51, 100], [100, 250, 101, 200], [250, 350, 201, 300], [350, 430, 301, 400], [430, 510, 401, 500]];
function subIndex(c, table) {
  if (c == null || !isFinite(c) || c < 0) return null;
  for (const [lo, hi, ilo, ihi] of table) if (c <= hi) return ilo + ((ihi - ilo) / (hi - lo)) * (c - lo);
  const [lo, hi, ilo, ihi] = table[table.length - 1];
  return ilo + ((ihi - ilo) / (hi - lo)) * (c - lo);
}
function cpcbAqi(pm25, pm10) {
  const x = subIndex(pm25, CPCB_PM25), y = subIndex(pm10, CPCB_PM10);
  if (x == null && y == null) return null;
  return Math.min(500, Math.round(Math.max(x == null ? -1 : x, y == null ? -1 : y)));
}
const aqiBandIdx = (aqi) => (aqi == null || !isFinite(aqi)) ? null
  : aqi <= 50 ? 0 : aqi <= 100 ? 1 : aqi <= 200 ? 2 : aqi <= 300 ? 3 : aqi <= 400 ? 4 : 5;
/* the same index with home's extras: over (the scale tops out at 500 →
   "500+") and which pollutant set it — identical to home.js cpcbAqi */
function cpcb(pm25, pm10) {
  const x = subIndex(pm25, CPCB_PM25), y = subIndex(pm10, CPCB_PM10);
  if (x == null && y == null) return null;
  const v = Math.max(x == null ? -1 : x, y == null ? -1 : y);
  const aqi = Math.min(500, Math.round(v));
  return { aqi, over: v > 500.5, band: aqiBandIdx(aqi),
    basis: y != null && (x == null || y > x) ? 'pm10' : 'pm25' };
}

function buildLattice(j, j10) {
  const feats = (j.features || []).filter((f) => f && f.geometry && f.geometry.type === 'Polygon'
    && f.properties && f.properties.pm25 != null && isFinite(f.properties.pm25));
  if (!feats.length) return null;
  const r0 = feats[0].geometry.coordinates[0];
  const dx = Math.abs(r0[1][0] - r0[0][0]), dy = Math.abs(r0[2][1] - r0[1][1]);
  if (!(dx > 0) || !(dy > 0)) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const f of feats) {
    for (const [x, y] of f.geometry.coordinates[0]) {
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
  }
  const nx = Math.round((x1 - x0) / dx), ny = Math.round((y1 - y0) / dy);
  const v25 = new Float32Array(nx * ny).fill(NaN), v10 = new Float32Array(nx * ny).fill(NaN);
  const conf = new Array(nx * ny).fill(null);
  const slot = (ring) => {
    let mx = Infinity, my = Infinity;
    for (const [x, y] of ring) { if (x < mx) mx = x; if (y < my) my = y; }
    const ix = Math.round((mx - x0) / dx), iy = Math.round((my - y0) / dy);
    return (ix < 0 || iy < 0 || ix >= nx || iy >= ny) ? -1 : iy * nx + ix;
  };
  for (const f of feats) {
    const k = slot(f.geometry.coordinates[0]);
    if (k < 0) continue;
    v25[k] = f.properties.pm25;
    conf[k] = f.properties.conf || 'med';
  }
  let n10 = 0;
  for (const f of (j10 && j10.features) || []) {
    const v = f && f.properties && f.properties.pm10;
    if (!f.geometry || f.geometry.type !== 'Polygon' || v == null || !isFinite(v)) continue;
    const k = slot(f.geometry.coordinates[0]);
    if (k < 0) continue;
    v10[k] = v; n10++;
  }
  return { x0, y0, x1, y1, dx, dy, nx, ny, v25, v10, conf, n: feats.length, n10 };
}

/* bilinear over the cell centres; missing corners drop out (weights
   renormalised), past the outer cell centres the value holds but its
   weight fades to zero by the field's edge — never extrapolated */
function sampleLattice(L, lat, lon, weights) {
  if (!L) return null;
  const fx = (lon - L.x0) / L.dx - 0.5, fy = (lat - L.y0) / L.dy - 0.5;
  if (fx < -0.5 || fy < -0.5 || fx > L.nx - 0.5 || fy > L.ny - 0.5) return null;
  const i0 = Math.floor(fx), j0 = Math.floor(fy);
  const tx = fx - i0, ty = fy - j0;
  let s25 = 0, sw = 0, sc = 0, s10 = 0, sw10 = 0;
  for (let dj = 0; dj <= 1; dj++) {
    for (let di = 0; di <= 1; di++) {
      const i = Math.min(L.nx - 1, Math.max(0, i0 + di)), jj = Math.min(L.ny - 1, Math.max(0, j0 + dj));
      const k = jj * L.nx + i;
      const w = (di ? tx : 1 - tx) * (dj ? ty : 1 - ty);
      if (w <= 0) continue;
      const v = L.v25[k];
      if (isFinite(v)) { s25 += v * w; sw += w; sc += (weights[L.conf[k]] ?? 0.5) * w; }
      const u = L.v10[k];
      if (isFinite(u)) { s10 += u * w; sw10 += w; }
    }
  }
  if (sw < 0.2) return null;                    // most corners empty — no honest read
  // edge fade across the outermost half cell
  const ex = Math.min(1, fx + 0.5, L.nx - 0.5 - fx) * 2;
  const ey = Math.min(1, fy + 0.5, L.ny - 0.5 - fy) * 2;
  const edge = Math.max(0, Math.min(1, ex, ey));
  const pm25 = s25 / sw, pm10 = sw10 >= 0.2 ? s10 / sw10 : null;
  const aqi = cpcbAqi(pm25, pm10);
  return { aqi, pm25, pm10, band: aqiBandIdx(aqi), w: (sc / sw) * Math.min(1, sw / 0.6) * edge };
}

/* the tint raster — 8 px per cell, each pixel in its AQI band's colour */
function paintTint(L) {
  const S = 8, W = L.nx * S, H = L.ny * S;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const rgb = BANDS.map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  for (let py = 0; py < H; py++) {
    const lat = L.y1 - ((py + 0.5) / H) * (L.y1 - L.y0);
    for (let px = 0; px < W; px++) {
      const lon = L.x0 + ((px + 0.5) / W) * (L.x1 - L.x0);
      const s = sampleLattice(L, lat, lon, CONF_W);
      if (!s || s.band == null || s.w <= 0.01) continue;
      const o = (py * W + px) * 4, c = rgb[s.band];
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2];
      img.data[o + 3] = Math.round(255 * s.w);
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv.toDataURL('image/png');
}

async function loadField(first) {
  const [j, j10] = await Promise.all([
    A.api.get('/grid?cells=40&param=pm2_5', 20000),
    A.api.get('/grid?cells=40&param=pm10', 20000),
  ]);
  if (!j || !Array.isArray(j.features)) return;
  const ce = j.properties && j.properties.cell_epoch;
  const ep = Array.isArray(ce) ? ce[0] : (j.properties && j.properties.epoch) ?? null;
  if (!first && field && ep != null && ep === fieldEpoch && (field.n10 > 0 || !j10)) return;   // same epoch — nothing new
  const L = buildLattice(j, j10);
  if (!L) return;
  fieldEpoch = ep; field = L;
  const url = paintTint(L);
  const coords = [[L.x0, L.y1], [L.x1, L.y1], [L.x1, L.y0], [L.x0, L.y0]];
  onReady((m) => {
    if (basicMode) {
      const b = [[L.y0, L.x0], [L.y1, L.x1]];
      if (fieldImg) { fieldImg.setUrl(url); fieldImg.setBounds(b); }
      else {
        fieldImg = window.L.imageOverlay(url, b, { opacity: 0.42, interactive: false });
        if (fieldWanted) fieldImg.addTo(m);
      }
      return;
    }
    const src = m.getSource('alive-field');
    if (src && typeof src.updateImage === 'function') src.updateImage({ url, coordinates: coords });
    else {
      if (m.getLayer('alive-field-fill')) m.removeLayer('alive-field-fill');
      if (src) m.removeSource('alive-field');
      m.addSource('alive-field', { type: 'image', url, coordinates: coords });
      m.addLayer({
        id: 'alive-field-fill', type: 'raster', source: 'alive-field',
        layout: { visibility: fieldWanted ? 'visible' : 'none' },
        paint: {
          /* the tint carries the city view; at street zoom the coloured
             roads carry it and the tint steps back */
          'raster-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.46, 11.5, 0.34, 13.5, 0.14, 16, 0.1],
          'raster-resampling': 'linear', 'raster-fade-duration': 0,
        },
      }, firstRoadLayer(m));
    }
    if (roads.on) roadsRefresh();
  });
  document.dispatchEvent(new CustomEvent('alive:field', { detail: { epoch: fieldEpoch, n: L.n } }));
}

function setFieldVisible(v) {
  fieldWanted = !!v;
  onReady((m) => { if (m.getLayer('alive-field-fill')) m.setLayoutProperty('alive-field-fill', 'visibility', v ? 'visible' : 'none'); });
}

/* the field at a point, as painted — {aqi, pm25, pm10, band, w} or null
   (band = CPCB AQI category; w = 0..1 confidence the paint used) */
function sampleField(lat, lon) {
  const s = sampleLattice(field, lat, lon, CONF_W);
  return s && s.band != null ? s : null;
}
function fieldInfo() {
  return field ? { epoch: fieldEpoch, cells: field.n, bbox: [field.x0, field.y0, field.x1, field.y1] } : null;
}

/* ── street level: the roads in view, coloured by the air at their spot */
const roads = { on: false, t: null, bound: false };
const ROAD_CLASSES = (z) => z >= 14 ? ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']
  : z >= 13 ? ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']
    : ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
function roadsCompute(m) {
  const z = m.getZoom();
  if (!field || z < 11.5 || !m.getSource(OMT)) return { type: 'FeatureCollection', features: [] };
  const classes = new Set(ROAD_CLASSES(z));
  let feats = [];
  try { feats = m.querySourceFeatures(OMT, { sourceLayer: 'transportation' }); } catch (e) { feats = []; }
  const out = [];
  const seen = new Set();
  for (const f of feats) {
    const p = f.properties || {};
    if (!classes.has(p.class) || p.brunnel === 'tunnel') continue;
    const g = f.geometry;
    const lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : null;
    if (!lines) continue;
    for (const line of lines) {
      if (line.length < 2) continue;
      const key = `${line[0][0].toFixed(5)},${line[0][1].toFixed(5)},${line[line.length - 1][0].toFixed(5)},${line.length}`;
      if (seen.has(key)) continue;          // the same street from a neighbouring tile's buffer
      seen.add(key);
      let run = null, runB = null, runW = null;
      const flush = () => { if (run && run.length > 1) out.push({ type: 'Feature', properties: { b: runB, w: runW, c: p.class }, geometry: { type: 'LineString', coordinates: run } }); };
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i];
        const s = sampleLattice(field, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2, ROAD_W);
        const band = s && s.w > 0.05 ? s.band : null;
        const w = band == null ? null : Math.round(s.w * 4) / 4;
        if (band !== runB || w !== runW) { flush(); run = band == null ? null : [a]; runB = band; runW = w; }
        if (run) run.push(b);
      }
      flush();
      if (out.length > 24000) break;
    }
    if (out.length > 24000) break;
  }
  return { type: 'FeatureCollection', features: out };
}
function roadsRefresh() {
  if (!roads.on || !map) return;
  clearTimeout(roads.t);
  roads.t = setTimeout(() => {
    if (!roads.on) return;
    const m = map;
    const data = roadsCompute(m);
    const src = m.getSource('alive-airroads');
    if (src) src.setData(data);
    else m.addSource('alive-airroads', { type: 'geojson', data, tolerance: 0.6, buffer: 32 });
    if (m.getLayer('alive-airroads-line')) return;
    /* zoom must lead the expression — class/confidence scale the stops */
    const major = ['match', ['get', 'c'], ['motorway', 'trunk', 'primary'], 1, ['secondary', 'tertiary'], 0.72, 0.5];
    const w = ['coalesce', ['get', 'w'], 0];
    m.addLayer({
      id: 'alive-airroads-line', type: 'line', source: 'alive-airroads',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'b'], 0, BANDS[0], 1, BANDS[1], 2, BANDS[2], 3, BANDS[3], 4, BANDS[4], 5, BANDS[5], '#A6ACB8'],
        'line-width': ['interpolate', ['exponential', 1.5], ['zoom'],
          11.5, ['*', major, 1.6], 14, ['*', major, 3.6], 16, ['*', major, 8], 17, ['*', major, 12]],
        'line-opacity': ['interpolate', ['linear'], ['zoom'],
          11.5, 0, 12.2, ['*', w, 0.74], 15, ['*', w, 0.84]],
      },
    }, firstSymbol(m));
  }, 180);
}
function airRoads(on) {
  roads.on = !!on;
  onReady((m) => {
    if (!roads.bound) {
      roads.bound = true;
      m.on('moveend', () => roadsRefresh());
      m.on('sourcedata', (e) => { if (roads.on && e.sourceId === OMT && e.isSourceLoaded && e.tile) roadsRefresh(); });
    }
    if (roads.on) roadsRefresh();
    else {
      clearTimeout(roads.t);
      if (m.getLayer('alive-airroads-line')) m.removeLayer('alive-airroads-line');
      if (m.getSource('alive-airroads')) m.removeSource('alive-airroads');
    }
  });
}

/* ── live traffic (TomTom flow via /v2/p/flow_tile) — for any screen.
   Probes one tile first; any failure = no layer, no noise, map intact. */
let trafficOk = null, trafficProbe = null;
function trafficTileXY(z) {
  const n = 2 ** z, lat = A.DELHI.lat * Math.PI / 180;
  return [Math.floor(((A.DELHI.lon + 180) / 360) * n),
    Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n)];
}
function probeFlow() {
  if (!trafficProbe || (trafficOk === false && Date.now() - trafficProbe.t > 300000)) {
    const [x, y] = trafficTileXY(11);
    const p = fetch(`${API_ORIGIN}/v2/p/flow_tile/11/${x}/${y}.png`, { cache: 'no-store' })
      .then((r) => { trafficOk = !!(r.ok && /image/.test(r.headers.get('content-type') || '')); return trafficOk; })
      .catch(() => { trafficOk = false; return false; });
    trafficProbe = { t: Date.now(), p };
  }
  return trafficProbe.p;
}
function traffic(m, on) {
  const mm = m || map;
  if (!mm) return Promise.resolve(false);
  const SRC = 'alive-traffic', LYR = 'alive-traffic-flow';
  const off = () => {
    try { if (mm.getLayer(LYR)) mm.removeLayer(LYR); if (mm.getSource(SRC)) mm.removeSource(SRC); } catch (e) { /* already gone */ }
    return false;
  };
  if (!on) return Promise.resolve(off());
  return probeFlow().then((ok) => {
    if (!ok) return off();
    const add = () => {
      if (!mm.getSource(SRC)) {
        mm.addSource(SRC, {
          type: 'raster', tileSize: 256, minzoom: 6, maxzoom: 18,
          tiles: [`${API_ORIGIN}/v2/p/flow_tile/{z}/{x}/{y}.png`],
          bounds: [75.8, 27.4, 78.9, 30.0],
        });
      }
      if (!mm.getLayer(LYR)) {
        mm.addLayer({ id: LYR, type: 'raster', source: SRC,
          paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0 } }, firstSymbol(mm));
      }
      return true;
    };
    try { return add(); } catch (e) {
      /* style still loading — try once more when the map settles */
      return new Promise((res) => mm.once('idle', () => { try { res(add()); } catch (e2) { res(off()); } }));
    }
  });
}

/* ── route drawing: a real stroke stack, not a bare line ───────────
   Each route is up to four layers deep, bottom → top:
     -edge    a faint wide rim — the casing reads as an outline on tiles
     -casing  the paper underlay every stretch of the route rides on
     -line    the picked forest core (or the muted ghost dash)
     -segs    the dose-band ribbon on its own paper halo
   The layer ids are a contract: whereto.js re-paints -line/-casing
   when the selection changes, so those names never move. */
const RT_INK = '#2A4D3B';        /* the picked forest                 */
const RT_PAPER = '#FAFAF7';      /* casing — the sheet's paper white  */
const RT_EDGE = '#AEB4AB';       /* faint rim under the casing        */
const RT_GHOST = '#8A93A3';      /* alternatives — the quiet slate    */
const routeOpts = new Map();     /* id → last opts (ghost flips rebuild) */
const routeMarks = new Map();    /* id → midpoint label Marker        */
/* the beforeId a route's stack was inserted under — getStyle().layers
   is a stale cache for runtime layers, so the "right above -line" slot
   can't be re-found by scanning; keep it from creation */
const routeTop = new Map();      /* srcId → layer id (or undefined)   */

/* third arg may be: null (picked), a bare segments array (older
   callers), or {segments, ghost, label} — all normalise to an object */
function normRouteOpts(o) {
  if (o == null) return {};
  if (Array.isArray(o)) return { segments: o };
  return typeof o === 'object' ? o : {};
}
/* a Feature, a bare LineString, or a raw [lon,lat] list → coordinates */
function routeCoords(g) {
  if (!g) return [];
  if (Array.isArray(g)) return g;
  return g.coordinates || (g.geometry && g.geometry.coordinates) || [];
}
/* half the arc length, not half the vertex count — a tight hairpin's
   midpoint still lands mid-ride */
function routeMidpoint(coords) {
  if (coords.length < 2) return coords[0];
  let tot = 0;
  const seg = [];
  for (let i = 1; i < coords.length; i++) {
    const d = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
    seg.push(d); tot += d;
  }
  let half = tot / 2;
  for (let i = 0; i < seg.length; i++) {
    if (half <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? half / seg[i] : 0;
      return [coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t,
        coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t];
    }
    half -= seg[i];
  }
  return coords[coords.length - 1];
}
/* the distance·time chip — the same pill in both engines */
const RT_LABEL_CSS = 'display:inline-block;padding:3px 9px;border-radius:11px;'
  + 'background:rgba(250,250,247,.96);box-shadow:0 1px 5px rgba(20,20,20,.24);'
  + 'color:#3E4440;font:600 11.5px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;'
  + 'white-space:nowrap;pointer-events:none';
function rtLabelHtml(text) {
  const t = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `<div style="${RT_LABEL_CSS}">${t}</div>`;
}
/* paint values live once — creation and restyle read the same table */
function routePaints(o) {
  const ghost = !!(o && o.ghost);
  return {
    edge: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, ghost ? 7.5 : 8.6, 14, ghost ? 11 : 13.6],
      'line-color': RT_EDGE, 'line-opacity': ghost ? 0.3 : 0.42,
    },
    casing: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, ghost ? 5.8 : 6.8, 14, ghost ? 9.4 : 11],
      'line-color': ghost ? '#F0F1ED' : RT_PAPER, 'line-opacity': ghost ? 0.85 : 0.95,
    },
    line: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, ghost ? 2.8 : 3.6, 14, ghost ? 5.2 : 6.6],
      'line-color': ghost ? RT_GHOST : RT_INK, 'line-opacity': ghost ? 0.85 : 0.95,
      ...(ghost ? { 'line-dasharray': [1.9, 1.5] } : {}),
    },
  };
}
function addRouteLayers(m, srcId, geojson, o) {
  const p = routePaints(o);
  const under = firstSymbol(m);   /* routes ride under street labels, over fills */
  routeTop.set(srcId, under);
  m.addSource(srcId, { type: 'geojson', data: geojson });
  const caps = { 'line-cap': 'round', 'line-join': 'round' };
  m.addLayer({ id: `${srcId}-edge`, type: 'line', source: srcId, layout: { ...caps }, paint: p.edge }, under);
  m.addLayer({ id: `${srcId}-casing`, type: 'line', source: srcId, layout: { ...caps }, paint: p.casing }, under);
  m.addLayer({ id: `${srcId}-line`, type: 'line', source: srcId, layout: { ...caps }, paint: p.line }, under);
}
function styleRoute(m, srcId, o) {
  const p = routePaints(o);
  for (const k of ['edge', 'casing', 'line']) {
    const l = `${srcId}-${k}`;
    if (!m.getLayer(l)) continue;
    for (const [pk, pv] of Object.entries(p[k])) {
      try { m.setPaintProperty(l, pk, pv); } catch (e) { /* a paint this build can't express — skip */ }
    }
  }
}
function routeLabel(id, geojson, text) {
  const old = routeMarks.get(id);
  if (old) { old.remove(); routeMarks.delete(id); }
  if (text == null || text === '') return;
  const coords = routeCoords(geojson);
  if (!coords.length) return;
  const el = document.createElement('div');
  el.style.pointerEvents = 'none';
  el.innerHTML = rtLabelHtml(text);
  routeMarks.set(id, new maplibregl.Marker({ element: el }).setLngLat(routeMidpoint(coords)).addTo(map));
}
function removeRoute(m, id) {
  [`route-${id}-segs-line`, `route-${id}-segs-halo`, `route-${id}-line`,
    `route-${id}-casing`, `route-${id}-edge`].forEach((l) => { if (m.getLayer(l)) m.removeLayer(l); });
  [`route-${id}-segs`, `route-${id}`].forEach((s) => { if (m.getSource(s)) m.removeSource(s); });
  const mk = routeMarks.get(id);
  if (mk) { mk.remove(); routeMarks.delete(id); }
  routeTop.delete(`route-${id}`);
}
function showRoute(id, geojson, opts) {
  const o = normRouteOpts(opts);
  /* a raw [lon,lat] list counts as a route too */
  const g = Array.isArray(geojson) ? { type: 'LineString', coordinates: geojson } : geojson;
  onReady((m) => {
    if (!g || !routeCoords(g).length) return;
    const srcId = `route-${id}`;
    /* dash is fixed at layer creation — a ghost flip rebuilds */
    const prev = routeOpts.get(id);
    if (prev && !!prev.ghost !== !!o.ghost) removeRoute(m, id);
    routeOpts.set(id, o);
    if (!m.getSource(srcId)) addRouteLayers(m, srcId, g, o);
    else m.getSource(srcId).setData(g);
    styleRoute(m, srcId, o);
    paintSegments(srcId, g, o.segments);
    routeLabel(id, g, o.label);
  });
}

/* paint the same geometry but colored by its air strip — when the
   option carries per-segment pm25+band we split the line at segment
   boundaries and color each stretch by the band that stretch breathes */
/* a segment's band → palette index. The server sends the CPCB category
   word ('Satisfactory', 'Very Poor', 'No data'); older payloads sent the
   index. Words match case-insensitively; 'No data' (or nothing) falls
   back to the stretch's own pm25 through the same CPCB PM2.5 table, and
   a stretch with neither stays the plain route colour — never guessed. */
const BAND_WORDS = ['good', 'satisfactory', 'moderate', 'poor', 'very poor', 'severe'];
function segBandIdx(s) {
  const b = s && s.band;
  if (typeof b === 'number' && isFinite(b)) return Math.max(0, Math.min(5, Math.round(b)));
  if (typeof b === 'string') {
    const k = BAND_WORDS.indexOf(b.trim().toLowerCase().replace(/[\s_-]+/g, ' '));
    if (k >= 0) return k;
    if (/^\d+$/.test(b.trim())) return Math.max(0, Math.min(5, Number(b.trim())));
  }
  const pm = s && s.pm25;
  return pm == null || !isFinite(pm) ? null : aqiBandIdx(cpcbAqi(pm, null));
}
function paintSegments(srcId, geojson, segments) {
  onReady((m) => {
    const segSrc = `${srcId}-segs`;
    const coords = routeCoords(geojson);
    /* no bands this show — the old ribbon comes down too */
    if (!coords.length || !segments || !segments.length) {
      [`${segSrc}-line`, `${segSrc}-halo`].forEach((l) => { if (m.getLayer(l)) m.removeLayer(l); });
      if (m.getSource(segSrc)) m.removeSource(segSrc);
      return;
    }
    const n = coords.length;
    const feats = segments.map((s) => {
      const a = Math.floor((s.start_frac ?? 0) * (n - 1));
      const b = Math.max(a + 1, Math.ceil((s.end_frac ?? 1) * (n - 1)));
      const bi = segBandIdx(s);
      return {
        type: 'Feature',
        properties: { band: bi == null ? -1 : bi, pm25: s.pm25 },
        geometry: { type: 'LineString', coordinates: coords.slice(a, b + 1) },
      };
    });
    const data = { type: 'FeatureCollection', features: feats };
    if (m.getSource(segSrc)) { m.getSource(segSrc).setData(data); return; }
    m.addSource(segSrc, { type: 'geojson', data });
    /* the coloured stretches sit right ABOVE the plain route line (the
       line would otherwise cover them in forest green); a stretch with
       no read keeps the route's own colour. The paper halo underneath
       is what lets a band read on light tiles. The layer above -line is
       the symbol anchor recorded at creation — getStyle().layers can't
       be trusted to list runtime layers yet */
    const stored = routeTop.get(srcId);
    let above = stored && m.getLayer(stored) ? stored : undefined;
    if (above === undefined) {
      const ls = m.getStyle().layers;
      const k = ls.findIndex((l) => l.id === `${srcId}-line`);
      above = k >= 0 && k + 1 < ls.length ? ls[k + 1].id : undefined;
    }
    m.addLayer({
      id: `${segSrc}-halo`, type: 'line', source: segSrc,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 6.2, 14, 9.8],
        'line-color': RT_PAPER, 'line-opacity': 0.9,
      },
    }, above);
    m.addLayer({
      id: `${segSrc}-line`, type: 'line', source: segSrc,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3.6, 14, 6.6],
        'line-color': ['match', ['get', 'band'],
          0, BANDS[0], 1, BANDS[1], 2, BANDS[2],
          3, BANDS[3], 4, BANDS[4], 5, BANDS[5], RT_INK],
        'line-opacity': 0.95,
      },
    }, above);
  });
}

function hideRoute(id) {
  routeOpts.delete(id);
  onReady((m) => removeRoute(m, id));
}
function hideAllRoutes() {
  onReady((m) => {
    const ids = new Set(routeOpts.keys());
    m.getStyle().layers.forEach((l) => {
      const mm = l.id.match(/^route-(.+?)(-segs-line|-segs-halo|-edge|-line|-casing)?$/);
      if (mm) ids.add(mm[1]);
    });
    ids.forEach((id) => hideRoute(id));
  });
}

/* ── pins: markers keyed by id ───────────────────────────────────── */
const pins = new Map();
function pin(id, lon, lat, html, cls) {
  onReady((m) => {
    unpin(id);
    const el = document.createElement('div');
    el.className = `alive-pin ${cls || ''}`;
    el.innerHTML = html || '<div class="pin-dot"></div>';
    pins.set(id, new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(m));
  });
}
function unpin(id) { const p = pins.get(id); if (p) { p.remove(); pins.delete(id); } }
function clearPins() { pins.forEach((p) => p.remove()); pins.clear(); }

/* ── the user puck: live position dot with accuracy ring ─────────── */
let puckEl = null, puck = null;
function puckMove(lat, lon, acc) {
  onReady((m) => {
    if (!puckEl) {
      puckEl = document.createElement('div');
      puckEl.className = 'alive-puck';
      puckEl.innerHTML = '<div class="puck-ring"></div><div class="puck-core"></div>';
      puck = new maplibregl.Marker({ element: puckEl }).setLngLat([lon, lat]).addTo(m);
    } else puck.setLngLat([lon, lat]);
    if (acc) puckEl.style.setProperty('--acc', `${Math.min(160, acc)}px`);
  });
}
function puckRemove() { if (puck) { puck.remove(); puck = null; puckEl = null; } }

/* ── camera ──────────────────────────────────────────────────────── */
function fly(lat, lon, zoom, opts = {}) {
  onReady((m) => m.flyTo({ center: [lon, lat], zoom: zoom ?? m.getZoom(), duration: 900, essential: true, ...opts }));
}
/* fit() padding — a number pads every side; a box may carry
   {top,left,right,bottom} plus {sheetRight:px}, which is added to the
   right edge for the desktop sheet that occludes it. A box with none
   of the four sides keeps the default all around. */
function padBox(pad, dflt = 90) {
  if (pad == null) pad = dflt;
  if (typeof pad === 'number' && isFinite(pad)) return { top: pad, left: pad, right: pad, bottom: pad };
  const bare = pad.top == null && pad.left == null && pad.right == null && pad.bottom == null;
  const b = bare ? dflt : 0;
  return {
    top: +pad.top || b, left: +pad.left || b, bottom: +pad.bottom || b,
    right: (+pad.right || b) + (+pad.sheetRight || 0),
  };
}
function fit(geojsonOrCoords, pad) {
  onReady((m) => {
    const coords = geojsonOrCoords.type === 'Feature'
      ? geojsonOrCoords.geometry.coordinates
      : geojsonOrCoords.type === 'LineString' ? geojsonOrCoords.coordinates : geojsonOrCoords;
    if (!coords || !coords.length) return;
    const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    m.fitBounds(b, { padding: padBox(pad), duration: 850, essential: true });
  });
}
function center() { return map && map.getCenter(); }

/* basic mode dispatch — the Leaflet map speaks the same API; callers
   never learn which engine drew. Pure functions never branch. */
A.map = { init, ready: onReady, loadField,
  setFieldVisible: (v) => basicMode ? leafFieldVisible(v) : setFieldVisible(v),
  get fieldEpoch() { return fieldEpoch; },
  showRoute: (id, g, s) => basicMode ? leafShowRoute(id, g, s) : showRoute(id, g, s),
  hideRoute: (id) => basicMode ? leafHideRoute(id) : hideRoute(id),
  hideAllRoutes: () => basicMode ? leafHideAll() : hideAllRoutes(),
  pin: (id, lon, lat, html, cls) => basicMode ? leafPin(id, lon, lat, html, cls) : pin(id, lon, lat, html, cls),
  unpin, clearPins,
  puckMove: (lat, lon, acc) => basicMode ? leafPuckMove(lat, lon, acc) : puckMove(lat, lon, acc),
  puckRemove,
  fly: (lat, lon, zoom, opts) => basicMode ? leafFly(lat, lon, zoom, opts) : fly(lat, lon, zoom, opts),
  fit: (g, pad) => basicMode ? leafFit(g, pad) : fit(g, pad),
  center,
  traffic: (m, on) => basicMode ? leafTraffic(on) : traffic(m, on),
  airRoads: (on) => { if (!basicMode) airRoads(on); },
  sampleField, fieldInfo, BANDS, cpcbAqi, cpcb, aqiBand: aqiBandIdx,
  segBand: segBandIdx,
  get basemap() { return basicMode ? 'leaflet' : fellBack ? 'offline' : 'openfreemap'; },
  get map() { return map; } };
init();
void fieldTimer;
})();
