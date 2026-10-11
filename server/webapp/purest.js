/* Alive webapp — purest places. Where the air is lightest right now:
   every row is a served /v2/districts area ranked by its live pm25,
   painted as that area's real boundary; stays come from /v2/stays,
   ranked on the next-24h mean at each stay's own coordinates.
   Nothing here invents a number — names, pm25, distances and ranks
   all trace to served fields. */
(() => {
'use strict';

const AREA_SRC = 'pm-areas';
const AREA_FILL = 'pm-areas-fill';
const AREA_LINE = 'pm-areas-line';
const TOP_N = 8;                 // ranked rows that also get numbered pins
const ANCHOR_KEY = 'purest.anchor';

const BAND_HEX = ['#6E93AE', '#C7A34F', '#CF8A50', '#C05F3A', '#A83D30', '#6E2D28'];
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = null;

/* ── geometry index: name → {centroid, feature} from the two geojsons ── */
async function areaIndex() {
  const [ncr, sub] = await Promise.all([
    A.api.get('/ncr.geojson', 15000),
    A.api.get('/delhi_subdistricts.geojson', 15000),
  ]);
  const idx = new Map();
  for (const fc of [ncr, sub]) {
    if (!fc || !Array.isArray(fc.features)) continue;
    for (const f of fc.features) {
      const n = f && f.properties && f.properties.name;
      if (n && !idx.has(n)) idx.set(n, f);
    }
  }
  return idx;
}

/* paint the ranked areas as their real boundaries, band-colored */
function paintAreas(rows, idx) {
  const feats = [];
  for (const r of rows) {
    const f = idx.get(r.name);
    if (!f || !f.geometry) continue;
    if (r.name === 'Delhi NCT') continue;      // parent boundary = union of its children
    feats.push({
      type: 'Feature',
      properties: { name: r.name, pm25: r.pm25, band: A.fmt.bandIdx(r.pm25), rank: r._rank },
      geometry: f.geometry,
    });
  }
  if (!feats.length) return;
  A.map.ready((m) => {
    if (m.getSource(AREA_SRC)) m.getSource(AREA_SRC).setData({ type: 'FeatureCollection', features: feats });
    else {
      m.addSource(AREA_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: feats } });
      m.addLayer({
        id: AREA_FILL, type: 'fill', source: AREA_SRC,
        paint: {
          'fill-color': ['match', ['get', 'band'],
            0, BAND_HEX[0], 1, BAND_HEX[1], 2, BAND_HEX[2],
            3, BAND_HEX[3], 4, BAND_HEX[4], 5, BAND_HEX[5], '#A6ACB8'],
          'fill-opacity': 0.24,
        },
      });
      m.addLayer({
        id: AREA_LINE, type: 'line', source: AREA_SRC,
        paint: { 'line-color': '#ffffff', 'line-width': 1, 'line-opacity': 0.8 },
      });
    }
    if (m.getLayer(AREA_FILL)) m.setLayoutProperty(AREA_FILL, 'visibility', 'visible');
    if (m.getLayer(AREA_LINE)) m.setLayoutProperty(AREA_LINE, 'visibility', 'visible');
  });
}

function setAreasVisible(v) {
  A.map.ready((m) => {
    [AREA_FILL, AREA_LINE].forEach((l) => {
      if (m.getLayer(l)) m.setLayoutProperty(l, 'visibility', v ? 'visible' : 'none');
    });
  });
}

/* numbered pin chips for the top rows */
function pinTop(rows, idx) {
  rows.slice(0, TOP_N).forEach((r) => {
    const f = idx.get(r.name);
    const c = f && f.properties && f.properties.centroid;
    if (!c) return;
    A.map.pin(`pm-a-${r._rank}`, c[0], c[1],
      `<div class="pin-chip pm-chip"><b>${r._rank}</b> ${esc(r.name.length > 16 ? r.name.slice(0, 15) + '…' : r.name)}</div>`);
  });
}
function pinStays(stays) {
  const prev = state.stayPinCount || 0;
  for (let i = 0; i < prev; i++) A.map.unpin(`pm-s-${i}`);
  state.stayPinCount = 0;
  stays.forEach((s, i) => {
    if (s.lat == null || s.lon == null) return;
    A.map.pin(`pm-s-${i}`, s.lon, s.lat,
      `<div class="pin-dot pm-stay-dot" title="stay"></div>`);
    state.stayPinCount = i + 1;
  });
}
function unpinAll(rows, stays) {
  (rows || []).forEach((r) => A.map.unpin(`pm-a-${r._rank}`));
  (stays || []).forEach((s, i) => A.map.unpin(`pm-s-${i}`));
}

/* ── the env card: one place's air + its next 24 h ──────────────────
   lives inside the screen element so it dies with the screen even when
   the router removes us without calling our cleanup. */
function envCard() {
  if (!state.envEl) {
    state.envEl = document.createElement('div');
    state.envEl.className = 'pm-env';
    state.el.appendChild(state.envEl);
  }
  return state.envEl;
}

async function openEnv(name, lat, lon, extra) {
  const el = envCard();
  el.hidden = false;
  el.innerHTML = `
    <div class="pm-env-top"><div class="pm-env-name">${esc(name)}</div>
      <button class="pm-x" type="button" aria-label="close">✕</button></div>
    <div class="sk" style="height:34px;width:170px"></div>`;
  el.querySelector('.pm-x').addEventListener('click', () => { el.hidden = true; });
  const [aqi, pt] = await Promise.all([
    A.api.get(`/aqi?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`, 9000),
    A.api.get(`/v2/playtime?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`, 18000),
  ]);
  if (!state || el.hidden) return;
  if (!aqi || aqi.pm25 == null) {
    el.innerHTML = `
      <div class="pm-env-top"><div class="pm-env-name">${esc(name)}</div>
        <button class="pm-x" type="button" aria-label="close">✕</button></div>
      <div class="pm-plain">no honest read for this spot right now</div>`;
    el.querySelector('.pm-x').addEventListener('click', () => { el.hidden = true; });
    return;
  }
  const b = A.fmt.band(aqi.pm25);
  const meta = [];
  if (aqi.nearest_station_km != null) meta.push(`station ${A.fmt.km(aqi.nearest_station_km)}`);
  const f = aqi.field;
  const ep = f && (f.built_epoch || (f.age_s != null ? Date.now() / 1000 - f.age_s : null));
  if (ep) meta.push(`field ${A.fmt.ago(ep)}${f.stale ? ' (stale)' : ''}`);
  let strip = '';
  if (pt && Array.isArray(pt.hours) && pt.hours.length) {
    const mids = pt.hours.map((h) => h.pm25_mid || 0);
    const max = Math.max(...mids), min = Math.min(...mids);
    const span = Math.max(1, max - min);
    strip = `<div class="pm-strip">${pt.hours.map((h) => {
      const hb = A.fmt.band(h.pm25_mid);
      const fh = 0.18 + 0.82 * (((h.pm25_mid || 0) - min) / span);
      return `<i style="height:${Math.round(fh * 100)}%;background:${hb ? hb.color : 'var(--ink4)'}"
        title="${h.ist_label || ''} — ${Math.round(h.pm25_mid || 0)} µg/m³"></i>`;
    }).join('')}</div>
    ${pt.best_window ? `<div class="pm-env-line">lightest ${esc(pt.best_window.start_label || '')}${pt.best_window.end_label ? '–' + esc(pt.best_window.end_label) : ''} · ${A.fmt.ugm3(pt.best_window.pm25_mid)}</div>` : ''}`;
  }
  el.innerHTML = `
    <div class="pm-env-top"><div class="pm-env-name">${esc(name)}</div>
      <button class="pm-x" type="button" aria-label="close">✕</button></div>
    <div class="pm-env-num">
      <span class="v" style="color:${b ? b.color : 'var(--ink)'}">${Math.round(aqi.pm25)}</span>
      <span class="u">µg/m³${b ? ` · <b style="color:${b.color}">${b.name}</b>` : ''}</span>
    </div>
    ${extra || ''}
    ${aqi.beyond_field_edge ? `<div class="pm-note">at the field’s edge — treat this as a guess</div>` : ''}
    ${strip}
    ${meta.length ? `<div class="pm-meta">${esc(meta.join(' · '))}</div>` : ''}`;
  el.querySelector('.pm-x').addEventListener('click', () => { el.hidden = true; });
}

/* ── stays: dedupe same-hotel rows by place proximity + name ──────── */
function normName(n) { return (n || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function dedupeStays(rows) {
  const out = [];
  for (const r of rows) {
    const dup = out.some((o) => {
      const dn = normName(o.name), rn = normName(r.name);
      const sameName = dn && rn && (dn === rn || dn.includes(rn) || rn.includes(dn));
      const dKm = (o.lat != null && r.lat != null)
        ? Math.hypot((o.lat - r.lat) * 111, (o.lon - r.lon) * 111 * Math.cos(o.lat * Math.PI / 180))
        : 9;
      return sameName || dKm < 0.12;
    });
    if (!dup) out.push(r);
  }
  return out;
}

/* ── body render ─────────────────────────────────────────────────── */
function renderBody() {
  const body = state.body;
  const rows = state.rows, stays = state.stays;
  body.innerHTML = '';

  const h1 = document.createElement('div');
  h1.className = 'sec-label';
  h1.textContent = 'lightest air right now';
  body.appendChild(h1);

  if (!rows) {
    body.insertAdjacentHTML('beforeend',
      `<div class="sk" style="height:52px;border-radius:12px"></div>
       <div class="sk" style="height:52px;border-radius:12px;margin-top:6px"></div>`);
  } else if (!rows.length) {
    body.insertAdjacentHTML('beforeend',
      `<div class="muted" style="padding:8px 4px">the field didn’t answer — nothing honest to rank</div>`);
  } else {
    const list = document.createElement('div');
    list.className = 'row-list';
    rows.slice(0, TOP_N + 2).forEach((r) => {
      const b = A.fmt.band(r.pm25);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'srow pm-row';
      el.innerHTML = `
        <span class="pm-rank">${r._rank}</span>
        <span class="pm-row-main">
          <span class="n">${esc(r.name)}${r._rank === 1 ? ' <i class="pm-pick">alive suggests</i>' : ''}</span>
          <span class="s">${esc([r.state || r.parent || '', r.partial_field_coverage ? 'field only partly reaches here' : (r.confidence && r.confidence !== 'field' ? `${r.confidence} read` : '')].filter(Boolean).join(' · '))}</span>
        </span>
        <span class="pm-v">
          <b style="color:${b ? b.color : 'var(--ink)'}">${r.pm25 != null ? Math.round(r.pm25) : '—'}</b>
          <i>µg/m³</i>
        </span>`;
      el.addEventListener('click', () => {
        const f = state.idx.get(r.name);
        const c = f && f.properties && f.properties.centroid;
        if (c) {
          A.map.fly(c[1], c[0], 10.6);
          openEnv(r.name, c[1], c[0]);
        } else A.toast('no boundary for this one — list number only');
      });
      list.appendChild(el);
    });
    body.appendChild(list);
    if (state.fieldAgeS != null) {
      body.insertAdjacentHTML('beforeend',
        `<div class="pm-meta" style="padding:4px 2px">ranked on live field pm2.5 · field ${esc(A.fmt.ago(Date.now() / 1000 - state.fieldAgeS))}</div>`);
    }
  }

  /* stays */
  const h2 = document.createElement('div');
  h2.className = 'sec-label';
  h2.textContent = 'stays that breathe easier';
  body.appendChild(h2);

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'searchbar pm-anchor';
  chip.innerHTML = `<span class="sdot a"></span>
    <span class="pm-anchor-label">near ${esc((state.anchor.label || 'central delhi').replace(/^near\s+/i, ''))}</span>
    <span class="pm-anchor-edit">change</span>`;
  chip.addEventListener('click', openPicker);
  body.appendChild(chip);

  if (!stays) {
    body.insertAdjacentHTML('beforeend',
      `<div class="sk" style="height:46px;border-radius:12px"></div>`);
  } else if (!stays.length) {
    body.insertAdjacentHTML('beforeend',
      `<div class="muted" style="padding:8px 4px">${state.staysNote || 'no stays read back honestly here'}</div>`);
  } else {
    const list = document.createElement('div');
    list.className = 'row-list';
    stays.forEach((s, i) => {
      const b = A.fmt.band(s.window_mean_ug);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'srow pm-row';
      el.innerHTML = `
        <span class="ic pm-stay-ic">◍</span>
        <span class="pm-row-main">
          <span class="n">${esc(s.name)}</span>
          <span class="s">${esc([s.dist_km != null ? A.fmt.km(s.dist_km) : null,
            s.nearest_station_km != null ? `station ${A.fmt.km(s.nearest_station_km)}` : null,
            s.sparse ? 'thin read' : null].filter(Boolean).join(' · '))}</span>
        </span>
        <span class="pm-v">
          <b style="color:${b ? b.color : 'var(--ink)'}">${s.window_mean_ug != null ? Math.round(s.window_mean_ug) : '—'}</b>
          <i>24 h mean</i>
        </span>`;
      el.addEventListener('click', () => {
        if (s.lat == null || s.lon == null) return;
        A.map.fly(s.lat, s.lon, 12.2);
        const extra = `<div class="pm-env-line">${[
          s.pm25_now != null ? `now ${A.fmt.ugm3(s.pm25_now)}` : null,
          s.cleaner_by_ug != null && Math.round(s.cleaner_by_ug) > 0 ? `${Math.round(s.cleaner_by_ug)} µg/m³ lighter than around you` : null,
          s.scored_on ? `scored on ${s.scored_on === 'next24h' ? 'the next 24 h' : esc(s.scored_on)}` : null,
        ].filter(Boolean).join(' · ')}</div>`;
        openEnv(s.name, s.lat, s.lon, extra);
      });
      list.appendChild(el);
    });
    body.appendChild(list);
    if (state.rankedOn) {
      body.insertAdjacentHTML('beforeend',
        `<div class="pm-meta" style="padding:4px 2px">${esc(state.rankedOn)}</div>`);
    }
  }
}

/* ── loads ────────────────────────────────────────────────────────── */
async function loadAreas() {
  const [d, idx] = await Promise.all([A.api.get('/v2/districts', 18000), areaIndex()]);
  if (!state) return;
  state.idx = idx;
  if (!d || !Array.isArray(d.districts)) {
    state.rows = [];
    renderBody();
    return;
  }
  state.fieldAgeS = d.field_age_s != null ? d.field_age_s : null;
  state.rows = d.districts
    .filter((r) => r && r.pm25 != null)
    .sort((a, b) => a.pm25 - b.pm25)
    .map((r, i) => ({ ...r, _rank: i + 1 }));
  paintAreas(state.rows, idx);
  pinTop(state.rows, idx);
  renderBody();
  const first = state.rows[0] && idx.get(state.rows[0].name);
  const c = first && first.properties && first.properties.centroid;
  if (c) A.map.fly(c[1], c[0], 9.6);
}

async function loadStays() {
  const a = state && state.anchor;
  if (!a) return;
  const d = await A.api.get(`/v2/stays?lat=${a.lat.toFixed(5)}&lon=${a.lon.toFixed(5)}`, 18000);
  if (!state || a !== state.anchor) return;
  if (!d || !Array.isArray(d.stays) || !d.stays.length) {
    state.stays = [];
    state.staysNote = d && d.beyond_edge
      ? 'this point is past the field’s edge — no honest stays read'
      : 'no stays read back honestly here';
    renderBody();
    return;
  }
  state.rankedOn = d.ranked_on || null;
  state.stays = dedupeStays(d.stays).slice(0, 8);
  pinStays(state.stays);
  renderBody();
}

/* ── anchor picker ───────────────────────────────────────────────── */
function openPicker() {
  const body = state.body;
  body.innerHTML = `
    <div class="searchbar">
      <span class="sdot a"></span>
      <input type="text" autocomplete="off" autocorrect="off" spellcheck="false"
        placeholder="where should stays be ranked around?">
    </div>
    <div class="pm-quick">
      ${A.geo.pos ? `<button class="srow" type="button" data-me="1"><span class="ic">◉</span>
        <span><span class="n">your current location</span><span class="s" style="display:block">${esc(A.geo.pos.label || 'where you are')}</span></span></button>` : ''}
      <button class="srow" type="button" data-pin="1"><span class="ic">◎</span>
        <span><span class="n">drop a pin on the map</span><span class="s" style="display:block">tap anywhere — stays rank around it</span></span></button>
      <button class="srow" type="button" data-back="1"><span class="ic">‹</span>
        <span><span class="n">back to the rankings</span></span></button>
    </div>
    <div class="row-list am-rows"></div>`;

  const input = body.querySelector('input');
  const rows = body.querySelector('.am-rows');

  const finish = (p) => {
    state.anchor = { lat: p.lat, lon: p.lon, label: p.name || p.label || 'dropped pin' };
    A.store.set(ANCHOR_KEY, state.anchor);
    state.stays = null;
    renderBody();
    loadStays();
  };

  const meBtn = body.querySelector('[data-me]');
  if (meBtn) meBtn.addEventListener('click', () =>
    finish({ lat: A.geo.pos.lat, lon: A.geo.pos.lon, name: A.geo.pos.label || 'your spot' }));
  body.querySelector('[data-pin]').addEventListener('click', () => {
    state.armed = true;
    A.toast('tap the map — stays rank around that point');
    renderBody();
  });
  body.querySelector('[data-back]').addEventListener('click', renderBody);

  let deb = null, seq = 0;
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
  draw([], 'type to search — connaught place, saket, noida…');
  input.addEventListener('input', () => {
    clearTimeout(deb);
    const q = input.value;
    if (q.trim().length < 2) { draw([], 'type to search — connaught place, saket, noida…'); return; }
    rows.innerHTML = `<div class="muted" style="padding:10px 6px">searching…</div>`;
    deb = setTimeout(async () => {
      const my = ++seq;
      const res = await A.search.search(q, (state && state.anchor) || A.geo.pos || A.DELHI);
      if (my !== seq) return;
      draw(res, res.length ? '' : 'nothing found — try a landmark, a block, a sector');
    }, 260);
  });
  requestAnimationFrame(() => input.focus());
}

/* ── the screen ──────────────────────────────────────────────────── */
A.screen('purest', {
  mount(el) {
    const chrome = A.sheetChrome(el, 'purest places');
    el.classList.add('pm-host');
    state = {
      el,
      body: chrome.body,
      anchor: A.store.get(ANCHOR_KEY, null) || A.geo.pos || { ...A.DELHI, label: 'central delhi' },
      armed: false,
      rows: null, stays: null, idx: new Map(),
      fieldAgeS: null, rankedOn: null, staysNote: null,
      envEl: null, stayPinCount: 0,
    };
    renderBody();
    loadAreas();
    loadStays();
    if (state.anchor && !state.anchor.label) {
      A.search.reverse(state.anchor.lat, state.anchor.lon).then((n) => {
        if (n && state.anchor) { state.anchor.label = n; renderBody(); }
      });
    }

    const onTap = (e) => {
      if (A.current() !== 'purest' || !state) return;
      if (state.armed) {
        state.armed = false;
        const p = e.detail;
        state.anchor = { lat: p.lat, lon: p.lon, label: 'dropped pin' };
        A.search.reverse(p.lat, p.lon).then((n) => {
          if (n && state.anchor && state.anchor.label === 'dropped pin') {
            state.anchor.label = n; renderBody();
          }
        });
        A.store.set(ANCHOR_KEY, state.anchor);
        state.stays = null;
        renderBody();
        loadStays();
        return;
      }
    };
    document.addEventListener('alive:maptap', onTap);

    const onAreaClick = (e) => {
      const f = e.features && e.features[0];
      if (!f) return;
      const r = state.rows && state.rows.find((x) => x.name === f.properties.name);
      const idxF = state.idx.get(f.properties.name);
      const c = idxF && idxF.properties && idxF.properties.centroid;
      if (c) openEnv(f.properties.name, c[1], c[0]);
    };
    /* bind by layer name — evaluated at click time, so it's live even
       though the areas are painted async after /v2/districts */
    A.map.ready((m) => { m.on('click', AREA_FILL, onAreaClick); });
    A.map.setFieldVisible(false);

    const onKey = (e) => {
      if (e.key === 'Escape' && chrome.sheetEl.classList.contains('on')) chrome.close();
    };
    document.addEventListener('keydown', onKey);

    /* teardown must survive BOTH router paths: back() calls our cleanup,
       but show(replace) only drops the 'on' class and removes the element
       — so a class observer catches that case too. */
    let torn = false;
    const teardown = () => {
      if (torn) return;
      torn = true;
      document.removeEventListener('alive:maptap', onTap);
      document.removeEventListener('keydown', onKey);
      mo.disconnect();
      A.map.ready((m) => { if (m.getLayer(AREA_FILL)) m.off('click', AREA_FILL, onAreaClick); });
      setAreasVisible(false);
      unpinAll(state && state.rows, state && state.stays);
      if (state.envEl) state.envEl.hidden = true;
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
