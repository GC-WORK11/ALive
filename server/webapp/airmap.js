/* Alive webapp — air around me. The live pm2.5 field painted on the
   real map (the app's band scale), a tap readout that says exactly how
   honest it is (nearest station, field age, likely range), and the
   'planning to go out' card — the next 24 hours at any picked place,
   from /v2/playtime. Every number traces to a served field. */
(() => {
'use strict';

const FIELD_SRC = 'am-field';
const FIELD_LAYER = 'am-field-fill';
const GRID_URL = '/grid?cells=40&param=pm2_5';   // 40 is the server's hard cap
const PICK_KEY = 'airmap.place';

let state = null;
let tapMarker = null;

const BAND_HEX = ['#6E93AE', '#C7A34F', '#CF8A50', '#C05F3A', '#A83D30', '#6E2D28'];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── the field, painted from /grid — source is a FeatureCollection of
   real cell polygons (server caps cells at 40; ~2.5 km a cell).
   conf 'lo' cells paint fainter — confidence is honest, not hidden. */
function firstLabelLayer(m) {
  for (const l of m.getStyle().layers) {
    if (l.type === 'line' && /water|boundary/.test(l.id)) return l.id;
  }
  for (const l of m.getStyle().layers) if (l.type === 'symbol') return l.id;
  return undefined;
}

async function mountField() {
  const j = await A.api.get(GRID_URL, 20000);
  if (!j || !Array.isArray(j.features) || !j.features.length) return null;
  const feats = j.features.filter((f) =>
    f && f.geometry && f.properties && f.properties.pm25 != null);
  if (!feats.length) return null;
  const ep = j.properties && Array.isArray(j.properties.cell_epoch)
    ? j.properties.cell_epoch[0] : null;
  const fc = {
    type: 'FeatureCollection',
    features: feats.map((f) => ({
      type: 'Feature',
      properties: {
        pm25: f.properties.pm25,
        band: A.fmt.bandIdx(f.properties.pm25),
        conf: f.properties.conf || null,
      },
      geometry: f.geometry,
    })),
  };
  A.map.ready((m) => {
    const before = firstLabelLayer(m);
    if (m.getSource(FIELD_SRC)) {
      m.getSource(FIELD_SRC).setData(fc);
    } else {
      m.addSource(FIELD_SRC, { type: 'geojson', data: fc });
      m.addLayer({
        id: FIELD_LAYER, type: 'fill', source: FIELD_SRC,
        paint: {
          'fill-color': ['match', ['get', 'band'],
            0, BAND_HEX[0], 1, BAND_HEX[1], 2, BAND_HEX[2],
            3, BAND_HEX[3], 4, BAND_HEX[4], 5, BAND_HEX[5], '#A6ACB8'],
          'fill-opacity': ['match', ['get', 'conf'],
            'hi', 0.38, 'med', 0.32, 'lo', 0.2, 0.32],
        },
      }, before);
    }
    if (m.getLayer(FIELD_LAYER)) {
      m.setLayoutProperty(FIELD_LAYER, 'visibility', 'visible');
    }
  });
  return { epoch: ep, cells: feats.length };
}

function setFieldVisible(v) {
  A.map.ready((m) => {
    if (m.getLayer(FIELD_LAYER)) {
      m.setLayoutProperty(FIELD_LAYER, 'visibility', v ? 'visible' : 'none');
    }
  });
  A.map.setFieldVisible(false);   // keep the shared layer off — this screen paints its own
}

/* ── freshness chip text ─────────────────────────────────────────── */
function fieldAge(j) {
  const f = j && j.field;
  const ep = (f && (f.built_epoch || (f.age_s != null ? Date.now() / 1000 - f.age_s : null)))
    || (state.fieldMeta && state.fieldMeta.epoch);
  if (!ep) return null;
  const stale = f && f.stale;
  return (stale ? 'field stale · ' : 'field ') + A.fmt.ago(ep);
}

/* ── tap readout: /aqi point read + all its honesty ────────────────
   the card lives inside the screen element — it dies with the screen
   even when the router removes us without calling our cleanup. */
function readCard() {
  if (!state.readEl) {
    state.readEl = document.createElement('div');
    state.readEl.className = 'am-read';
    state.el.appendChild(state.readEl);
  }
  return state.readEl;
}

async function tapRead(lat, lon) {
  const el = readCard();
  el.hidden = false;
  el.innerHTML = `<div class="sk" style="width:150px;height:40px"></div>`;
  const j = await A.api.get(`/aqi?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, 9000);
  if (!state || el.hidden) return;
  if (!j || j.pm25 == null) {
    el.innerHTML = `<div class="am-plain">outside the field — no honest read here</div>
      <button class="am-x" type="button" aria-label="close">✕</button>`;
    el.querySelector('.am-x').addEventListener('click', () => { el.hidden = true; });
    return;
  }
  const b = A.fmt.band(j.pm25);
  const meta = [];
  if (j.nearest_station_km != null) meta.push(`station ${A.fmt.km(j.nearest_station_km)}`);
  const age = fieldAge(j);
  if (age) meta.push(age);
  const range = (j.pm25_lo != null && j.pm25_hi != null && j.pm25_hi > j.pm25_lo)
    ? `likely ${Math.round(j.pm25_lo)}–${Math.round(j.pm25_hi)}` : null;
  const note = j.beyond_field_edge
    ? 'at the field’s edge — treat this as a guess'
    : range ? `a model read between stations · ${range}` : 'a model read between stations';
  el.innerHTML = `
    <div class="am-read-top">
      <div class="am-num" style="color:${b ? b.color : 'var(--ink)'}">${Math.round(j.pm25)}</div>
      <div>
        <div class="am-u">µg/m³ pm2.5</div>
        ${b ? `<div class="am-word" style="color:${b.color}">${b.name}</div>` : ''}
      </div>
      <button class="am-x" type="button" aria-label="close">✕</button>
    </div>
    <div class="am-note">${esc(note)}</div>
    ${meta.length ? `<div class="am-meta">${esc(meta.join(' · '))}</div>` : ''}`;
  el.querySelector('.am-x').addEventListener('click', () => {
    el.hidden = true;
    if (tapMarker) { tapMarker.remove(); tapMarker = null; }
  });
  if (tapMarker) tapMarker.remove();
  const pin = document.createElement('div');
  pin.className = 'alive-pin';
  pin.innerHTML = `<div class="pin-dot" style="background:${b ? b.color : 'var(--accent)'}"></div>`;
  A.map.ready((m) => {
    tapMarker = new maplibregl.Marker({ element: pin }).setLngLat([lon, lat]).addTo(m);
  });
}

/* ── 'planning to go out' — /v2/playtime at a picked place ───────── */
function placeLabel() {
  const p = state.place;
  return (p && p.label) || 'central delhi';
}

async function planCard() {
  const body = state.body;
  const lat = state.place.lat, lon = state.place.lon;
  const zone = body.querySelector('.am-plan');
  zone.innerHTML = `<div class="muted" style="padding:12px 4px">reading the next 24 hours…</div>`;
  const d = await A.api.get(`/v2/playtime?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`, 18000);
  if (!body.isConnected) return;
  if (!d || !Array.isArray(d.hours) || !d.hours.length) {
    zone.innerHTML = `<div class="muted" style="padding:12px 4px">no honest read for this spot right now</div>`;
    return;
  }
  const best = d.best_window || null;
  const worst = d.worst_window || null;
  const mids = d.hours.map((h) => h.pm25_mid || 0);
  const max = Math.max(...mids), min = Math.min(...mids);
  const span = Math.max(1, max - min);
  const inWin = (h, w) => w && w.start_h != null && w.end_h != null && h >= w.start_h && h <= w.end_h;
  const meta = [];
  if (d.nearest_station_km != null) meta.push(`station ${A.fmt.km(d.nearest_station_km)}`);
  if (d.field_age_s != null) meta.push(`field ${A.fmt.ago(Date.now() / 1000 - d.field_age_s)}`);
  zone.innerHTML = `
    ${d.verdict ? `<div class="am-verdict">${esc(d.verdict)}</div>` : ''}
    <div class="am-bars" role="img" aria-label="pm2.5 forecast, next 24 hours">${d.hours.map((h) => {
      const b = A.fmt.band(h.pm25_mid);
      const f = 0.16 + 0.84 * (((h.pm25_mid || 0) - min) / span);
      const cls = [inWin(h.h, best) ? 'isbest' : '', inWin(h.h, worst) ? 'isworst' : ''].join(' ');
      const lo = h.pm25_lo != null ? 0.16 + 0.84 * ((h.pm25_lo - min) / span) : null;
      const hi = h.pm25_hi != null ? 0.16 + 0.84 * ((h.pm25_hi - min) / span) : null;
      return `<div class="am-bar ${cls}" title="${h.ist_label || ''} — ${Math.round(h.pm25_mid || 0)} µg/m³${b ? ' · ' + b.name : ''}${h.day_offset ? ' · tomorrow' : ''}">
        <i style="height:${Math.round(f * 100)}%;background:${b ? b.color : 'var(--ink4)'}"></i>
        ${lo != null && hi != null && hi > lo ? `<u style="bottom:${Math.round(lo * 100)}%;height:${Math.round((hi - lo) * 100)}%"></u>` : ''}
      </div>`;
    }).join('')}</div>
    <div class="am-axis"><span>${esc(d.hours[0].ist_label || 'now')}</span><span>${esc((d.hours[Math.floor(d.hours.length / 2)] || {}).ist_label || '')}</span><span>${esc((d.hours[d.hours.length - 1] || {}).ist_label || '')}${d.hours[d.hours.length - 1] && d.hours[d.hours.length - 1].day_offset ? ' · tomorrow' : ''}</span></div>
    <div class="am-bestworst">
      ${best ? `<div class="am-bw"><span class="bw-l">lightest</span> ${esc(best.start_label || '')}${best.end_label ? '–' + esc(best.end_label) : ''} · ${A.fmt.ugm3(best.pm25_mid)}</div>` : ''}
      ${worst ? `<div class="am-bw"><span class="bw-l">heaviest</span> ${esc(worst.start_label || '')}${worst.end_label ? '–' + esc(worst.end_label) : ''} · ${A.fmt.ugm3(worst.pm25_mid)}</div>` : ''}
      ${d.mean_pm25 != null ? `<div class="am-bw muted">24 h average ${A.fmt.ugm3(d.mean_pm25)}</div>` : ''}
      ${d.cleaner_by_ug != null && d.cleaner_by_ug > 0 ? `<div class="am-bw muted">the best stretch buys ~${Math.round(d.cleaner_by_ug)} µg/m³</div>` : ''}
      ${(d.decisions || []).map((x) => `<div class="am-bw"><span class="bw-l">${esc(x.label)}</span> ${esc(x.line)}</div>`).join('')}
      ${meta.length ? `<div class="am-meta">${esc(meta.join(' · '))}</div>` : ''}
    </div>`;
}

/* ── place picker — same surface whereto uses, one anchor ────────── */
function openPicker() {
  const body = state.body;
  body.innerHTML = `
    <div class="searchbar">
      <span class="sdot a"></span>
      <input type="text" autocomplete="off" autocorrect="off" spellcheck="false"
        placeholder="name a place in delhi — a park, a block, a market">
    </div>
    <div class="am-quick">
      ${A.geo.pos ? `<button class="srow" type="button" data-me="1"><span class="ic">◉</span>
        <span><span class="n">your current location</span><span class="s" style="display:block">${esc(A.geo.pos.label || 'where you are')}</span></span></button>` : ''}
      <button class="srow" type="button" data-pin="1"><span class="ic">◎</span>
        <span><span class="n">drop a pin on the map</span><span class="s" style="display:block">tap anywhere — the hours are read there</span></span></button>
      <button class="srow" type="button" data-back="1"><span class="ic">‹</span>
        <span><span class="n">back to the air map</span></span></button>
    </div>
    <div class="row-list am-rows"><div class="muted" style="padding:10px 6px">recent places will live here</div></div>`;

  const input = body.querySelector('input');
  const rows = body.querySelector('.am-rows');
  const recents = A.store.get(PICK_KEY + '.recent', []);

  const finish = (p) => {
    state.place = { lat: p.lat, lon: p.lon, label: p.name || p.label || 'dropped pin' };
    A.store.set(PICK_KEY, state.place);
    const rs = recents.filter((r) =>
      `${(r.label || '').toLowerCase()}|${r.lat.toFixed(3)}` !==
      `${(state.place.label || '').toLowerCase()}|${state.place.lat.toFixed(3)}`);
    rs.unshift(state.place);
    A.store.set(PICK_KEY + '.recent', rs.slice(0, 6));
    renderMain();
    planCard();
  };

  const meBtn = body.querySelector('[data-me]');
  if (meBtn) meBtn.addEventListener('click', () =>
    finish({ lat: A.geo.pos.lat, lon: A.geo.pos.lon, name: A.geo.pos.label || 'your spot' }));
  body.querySelector('[data-pin]').addEventListener('click', () => {
    state.armed = true;
    A.toast('tap the map — the 24-hour read moves there');
    renderMain();
  });
  body.querySelector('[data-back]').addEventListener('click', renderMain);

  const draw = (list, note) => {
    rows.innerHTML = '';
    if (note) rows.innerHTML = `<div class="muted" style="padding:10px 6px">${note}</div>`;
    list.forEach((r) => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'srow';
      el.innerHTML = `<span class="ic">◦</span><span style="min-width:0">
        <span class="n">${esc(r.name)}</span>
        <span class="s" style="display:block">${esc([r.sub, r.dist != null ? A.fmt.km(r.dist / 1000) + ' away' : null].filter(Boolean).join(' · '))}</span></span>
        <span class="src">${esc(r.source || '')}</span>`;
      el.addEventListener('click', () => finish(r));
      rows.appendChild(el);
    });
  };
  const showRecents = () => draw(
    recents.map((r) => ({ name: r.label, sub: '', dist: null, lat: r.lat, lon: r.lon, source: 'recent' })),
    recents.length ? '' : 'recent places will live here');
  showRecents();

  let deb = null, seq = 0;
  input.addEventListener('input', () => {
    clearTimeout(deb);
    const q = input.value;
    if (q.trim().length < 2) { showRecents(); return; }
    rows.innerHTML = `<div class="muted" style="padding:10px 6px">searching…</div>`;
    deb = setTimeout(async () => {
      const my = ++seq;
      const res = await A.search.search(q, A.geo.pos || A.DELHI);
      if (my !== seq) return;
      draw(res, res.length ? '' : 'nothing found — try a landmark, a block, a sector');
    }, 260);
  });
  requestAnimationFrame(() => input.focus());
}

/* ── main sheet ──────────────────────────────────────────────────── */
function renderMain() {
  const body = state.body;
  body.innerHTML = `
    <div class="am-legend">${[0, 1, 2, 3, 4, 5].map((i) =>
      `<div class="am-leg"><span style="background:var(--b${i})"></span>${A.fmt.bandWord(i)}</div>`).join('')}</div>
    <div class="muted am-hint">tap anywhere on the map — it reads the air there. each square is about 2–3 km, a model read between stations, not a promise for one house.</div>
    <button class="searchbar am-place" type="button">
      <span class="sdot a"></span>
      <span class="am-place-label">planning to go out · ${esc(placeLabel())}</span>
      <span class="am-place-edit">change</span>
    </button>
    <div class="am-plan"></div>`;
  body.querySelector('.am-place').addEventListener('click', openPicker);
  planCard();
}

/* ── the screen ──────────────────────────────────────────────────── */
A.screen('airmap', {
  mount(el) {
    const chrome = A.sheetChrome(el, 'air around me');
    el.classList.add('am-host');
    state = {
      el,
      body: chrome.body,
      place: A.store.get(PICK_KEY, null) || A.geo.pos || { ...A.DELHI, label: 'central delhi' },
      armed: false,
      fieldMeta: null,
      readEl: null,
    };
    renderMain();

    mountField().then((meta) => {
      if (!state) { setFieldVisible(false); return; }
      state.fieldMeta = meta;
      if (!meta) A.toast('the live field didn’t load — tap reads still work');
    });
    A.map.fly(A.DELHI.lat, A.DELHI.lon, 10.4);

    const onTap = (e) => {
      if (A.current() !== 'airmap' || !state) return;
      if (state.armed) {
        state.armed = false;
        const p = e.detail;
        state.place = { lat: p.lat, lon: p.lon, label: 'dropped pin' };
        A.search.reverse(p.lat, p.lon).then((n) => {
          if (n && state && state.place && state.place.label === 'dropped pin') {
            state.place.label = n;
            const lbl = state.body.querySelector('.am-place-label');
            if (lbl) lbl.textContent = `planning to go out · ${n}`;
          }
        });
        A.store.set(PICK_KEY, state.place);
        renderMain();
        return;
      }
      tapRead(e.detail.lat, e.detail.lon);
    };
    document.addEventListener('alive:maptap', onTap);

    /* teardown must survive BOTH router paths: back() calls our cleanup,
       but show(replace) only drops the 'on' class and removes the element
       — so a class observer catches that case too. */
    let torn = false;
    const teardown = () => {
      if (torn) return;
      torn = true;
      document.removeEventListener('alive:maptap', onTap);
      mo.disconnect();
      setFieldVisible(false);
      if (state.readEl) state.readEl.hidden = true;
      if (tapMarker) { tapMarker.remove(); tapMarker = null; }
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
