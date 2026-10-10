/* Alive webapp — the map. MapLibre GL + CARTO Positron (free, light,
   no key) + the live field painted as a fill layer from /grid cells.
   A.map.ready(cb) — the map loads once and is shared by all screens.
   Layers are namespaced per caller: A.map.field(), A.map.route(),
   A.map.pins(), A.map.puck() — each idempotent. */
(() => {
'use strict';
let map = null, ready = false, queue = [];
let fieldSrc = null, fieldData = null, fieldEpoch = null;

function init() {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
    center: [A.DELHI.lon, A.DELHI.lat],
    zoom: 10.2,
    maxZoom: 17, minZoom: 8.4,
    attributionControl: { compact: true },
    dragRotate: false, pitchWithRotate: false,
    touchZoomRotate: true,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.on('load', () => {
    ready = true;
    queue.forEach((cb) => cb(map)); queue = [];
    loadField(true);
    // live field — repaint every 5 min quietly
    setInterval(() => loadField(false), 300000);
  });
  map.on('click', (e) => {
    document.dispatchEvent(new CustomEvent('alive:maptap', { detail: { lat: e.lngLat.lat, lon: e.lngLat.lng, point: e.point } }));
  });
}

function onReady(cb) { ready ? cb(map) : queue.push(cb); }

/* ── the field — /grid cells as a semi-transparent fill layer ────── */
async function loadField(first) {
  const j = await A.api.get('/grid?cells=44');
  if (!j || !Array.isArray(j.cells)) return;
  fieldData = j; fieldEpoch = j.epoch ?? j.generated_s ?? null;
  const feats = [];
  for (const c of j.cells) {
    if (c.lat == null || c.lon == null || c.pm25 == null) continue;
    const d = (j.cell_deg || j.deg || 0.012);
    const h = d / 2;
    feats.push({
      type: 'Feature',
      properties: { pm25: c.pm25, band: c.band ?? A.fmt.bandIdx(c.pm25), conf: c.conf ?? null },
      geometry: { type: 'Polygon', coordinates: [[
        [c.lon - h, c.lat - h], [c.lon + h, c.lat - h],
        [c.lon + h, c.lat + h], [c.lon - h, c.lat + h], [c.lon - h, c.lat - h],
      ]] },
    });
  }
  const fc = { type: 'FeatureCollection', features: feats };
  if (map.getSource('alive-field')) {
    fieldSrc.setData(fc);
  } else {
    map.addSource('alive-field', { type: 'geojson', data: fc });
    fieldSrc = map.getSource('alive-field');
    map.addLayer({
      id: 'alive-field-fill', type: 'fill', source: 'alive-field',
      paint: {
        'fill-color': ['match', ['get', 'band'],
          0, '#6E93AE', 1, '#C7A34F', 2, '#CF8A50',
          3, '#C05F3A', 4, '#A83D30', 5, '#6E2D28', '#A6ACB8'],
        'fill-opacity': 0.34,
      },
    }, firstWater());
    document.dispatchEvent(new CustomEvent('alive:field', { detail: { epoch: fieldEpoch, n: feats.length } }));
  }
}

/* put the field below road labels — find the first symbol/water layer */
function firstWater() {
  for (const l of map.getStyle().layers) {
    if (l.type === 'line' && /water|boundary/.test(l.id)) return l.id;
  }
  for (const l of map.getStyle().layers) {
    if (l.type === 'symbol') return l.id;
  }
  return undefined;
}

function setFieldVisible(v) {
  onReady((m) => { if (m.getLayer('alive-field-fill')) m.setLayoutProperty('alive-field-fill', 'visibility', v ? 'visible' : 'none'); });
}

/* ── route drawing: geojson line + per-segment band colors ───────── */
function showRoute(id, geojson, segments) {
  onReady((m) => {
    const srcId = `route-${id}`;
    if (m.getSource(srcId)) { m.getSource(srcId).setData(geojson); return; }
    m.addSource(srcId, { type: 'geojson', data: geojson });
    m.addLayer({
      id: `${srcId}-line`, type: 'line', source: srcId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3.4, 14, 6.4],
        'line-color': '#2A4D3B', 'line-opacity': 0.85,
      },
    });
    m.addLayer({
      id: `${srcId}-casing`, type: 'line', source: srcId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 6.4, 14, 10.4],
        'line-color': '#ffffff', 'line-opacity': 0.55,
      },
    }, `${srcId}-line`);
    if (segments && segments.length) paintSegments(srcId, geojson, segments);
  });
}

/* paint the same geometry but colored by its air strip — when the
   option carries per-segment pm25+band we split the line at segment
   boundaries and color each stretch by the band that stretch breathes */
function paintSegments(srcId, geojson, segments) {
  onReady((m) => {
    const coords = geojson.coordinates || (geojson.geometry && geojson.geometry.coordinates) || [];
    if (!coords.length) return;
    const n = coords.length;
    const feats = segments.map((s) => {
      const a = Math.floor((s.start_frac ?? 0) * (n - 1));
      const b = Math.max(a + 1, Math.ceil((s.end_frac ?? 1) * (n - 1)));
      return {
        type: 'Feature',
        properties: { band: s.band ?? A.fmt.bandIdx(s.pm25), pm25: s.pm25 },
        geometry: { type: 'LineString', coordinates: coords.slice(a, b + 1) },
      };
    });
    const segSrc = `${srcId}-segs`;
    const data = { type: 'FeatureCollection', features: feats };
    if (m.getSource(segSrc)) { m.getSource(segSrc).setData(data); return; }
    m.addSource(segSrc, { type: 'geojson', data });
    m.addLayer({
      id: `${segSrc}-line`, type: 'line', source: segSrc,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3.4, 14, 6.4],
        'line-color': ['match', ['get', 'band'],
          0, '#6E93AE', 1, '#C7A34F', 2, '#CF8A50',
          3, '#C05F3A', 4, '#A83D30', 5, '#6E2D28', '#2A4D3B'],
        'line-opacity': 0.9,
      },
    }, `${srcId}-line`);
  });
}

function hideRoute(id) {
  onReady((m) => {
    [`route-${id}-segs-line`, `route-${id}-line`, `route-${id}-casing`].forEach((l) => { if (m.getLayer(l)) m.removeLayer(l); });
    [`route-${id}-segs`, `route-${id}`].forEach((s) => { if (m.getSource(s)) m.removeSource(s); });
  });
}
function hideAllRoutes() {
  onReady((m) => {
    const ids = new Set();
    m.getStyle().layers.forEach((l) => {
      const mm = l.id.match(/^route-(.+?)(-segs-line|-line|-casing)?$/);
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
function fit(geojsonOrCoords, pad = 90) {
  onReady((m) => {
    const coords = geojsonOrCoords.type === 'Feature'
      ? geojsonOrCoords.geometry.coordinates
      : geojsonOrCoords.type === 'LineString' ? geojsonOrCoords.coordinates : geojsonOrCoords;
    const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
    m.fitBounds(b, { padding: pad, duration: 850, essential: true });
  });
}
function center() { return map && map.getCenter(); }

A.map = { init, ready: onReady, loadField, setFieldVisible, fieldEpoch,
  showRoute, hideRoute, hideAllRoutes, pin, unpin, clearPins,
  puckMove, puckRemove, fly, fit, center, get map() { return map; } };
init();
})();
