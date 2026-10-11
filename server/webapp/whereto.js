/* Alive webapp — where to. From → To → mode → vehicle → real options.
   One /v2/plan call returns every vehicle's base + least-smoke routes;
   modes and vehicles re-rank/filter that response client-side — every
   number on a card is a served field, never derived out of thin air. */
(() => {
'use strict';

const MODES = [
  { id: 'health', t: 'health maxer',      s: 'the lightest air you can buy on this trip' },
  { id: 'budget', t: 'budget + health',   s: 'short route, still breathing better' },
  { id: 'time',   t: 'time + health',     s: 'fastest there — and what it costs you' },
];
const VEHICLES = [
  { id: 'car',   t: 'car',   match: (m) => m === 'car' || m === 'car_open' },
  { id: 'bike',  t: 'bike',  match: (m) => m === 'bike' },
  { id: 'auto',  t: 'auto',  match: (m) => m === 'auto' },
  { id: 'cycle', t: 'cycle', match: (m) => m === 'cycle' },
  { id: 'walk',  t: 'walk',  match: (m) => m === 'walk' },
  { id: 'bus',   t: 'bus',   match: (m) => m === 'bus' },
];
const RECENTS_KEY = 'whereto.recents';
const LAST_KEY = 'whereto.last';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const doseOf = (o) => (o.dose && o.dose.mid != null) ? o.dose.mid
  : (o.engine_dose_ug != null ? o.engine_dose_ug : null);
const concOf = (o) => o.dose && o.dose.avg_conc_ugm3;
const etaOf = (o) => o.eta_s;
const kmOf = (o) => o.distance_km;
const baseMode = (o) => (o.mode || '').split('_')[0];

let state = null;

function saveLast() {
  if (!state) return;
  A.store.set(LAST_KEY, {
    from: state.from, to: state.to, mode: state.mode, vehicle: state.vehicle,
  });
}
function recents() { return A.store.get(RECENTS_KEY, []); }
function pushRecent(p) {
  const k = `${(p.label || '').toLowerCase()}|${p.lat.toFixed(3)}|${p.lon.toFixed(3)}`;
  const rs = recents().filter((r) => `${(r.label || '').toLowerCase()}|${r.lat.toFixed(3)}|${r.lon.toFixed(3)}` !== k);
  rs.unshift({ label: p.label, lat: p.lat, lon: p.lon });
  A.store.set(RECENTS_KEY, rs.slice(0, 6));
}

/* ── ranking: the three modes over the served option set ────────── */
function rank(opts, mode) {
  const valid = opts.filter((o) => doseOf(o) != null);
  if (mode === 'time') {
    return [...opts].sort((a, b) => (etaOf(a) ?? 9e9) - (etaOf(b) ?? 9e9));
  }
  if (mode === 'budget') {
    const minKm = Math.min(...opts.map((o) => kmOf(o) ?? Infinity));
    const cap = minKm * 1.12;
    return [...opts].sort((a, b) => {
      const dA = doseOf(a) ?? 9e9, dB = doseOf(b) ?? 9e9;
      const inA = (kmOf(a) ?? Infinity) <= cap, inB = (kmOf(b) ?? Infinity) <= cap;
      if (inA !== inB) return inA ? -1 : 1;
      return dA - dB;
    });
  }
  // health — pure lightest first
  return [...opts].sort((a, b) => (doseOf(a) ?? 9e9) - (doseOf(b) ?? 9e9));
}

/* pick which served options to show for the chosen vehicle:
   the ranked set for that mode — best first, capped at 4 */
function visibleOptions(opts, vehicle, mode) {
  const v = VEHICLES.find((x) => x.id === vehicle);
  const mine = v ? opts.filter((o) => v.match(o.mode)) : opts;
  return rank(mine.length ? mine : opts, mode).slice(0, 4);
}

/* ── option card ────────────────────────────────────────────────── */
function optCard(o, best, sel) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'opt' + (sel === o ? ' sel' : '');
  const dose = doseOf(o), conc = concOf(o), b = A.fmt.band(conc);
  const bestDose = doseOf(best);
  const delta = (dose != null && bestDose != null && o !== best)
    ? `+${Math.round(((dose - bestDose) / Math.max(0.1, bestDose)) * 100)}% breath`
    : null;
  const vias = (o.via_names || []).slice(0, 2).join(' · ');
  el.innerHTML = `
    <div class="ot">
      <span class="m">${esc(o.label || o.mode)}</span>
      ${o.tag ? `<span class="otag">${esc(o.tag)}</span>` : ''}
      <span class="t">${A.fmt.min(etaOf(o))} · ${A.fmt.km(kmOf(o))}</span>
    </div>
    <div class="dose">
      <span class="v">${dose != null ? '~' + Math.round(dose) : '—'}</span>
      <span class="w" ${b ? `style="color:${b.color}"` : ''}>µg${b ? ' · ' + b.name : ''}</span>
      ${delta ? `<span class="r">${delta}</span>` : ''}
    </div>
    ${o.reason_line ? `<div class="why">${esc(o.reason_line)}</div>` : ''}
    ${vias ? `<div class="why">${esc(vias)}</div>` : ''}
    <div class="strip">${(o.segments || []).map((s) =>
      `<i style="flex:${Math.max(1, Math.round((s.end_frac - s.start_frac) * 100))};background:var(--b${A.fmt.bandIdx(s.pm25) ?? 0})" title="${Math.round(s.pm25)} µg/m³"></i>`).join('')}</div>`;
  el.addEventListener('click', () => {
    state.sel = o;
    renderOptions();
    paintRoutes();
  });
  return el;
}

/* ── map preview: alternates grey + thin, selected forest ───────── */
function paintRoutes() {
  if (!state.plan) return;
  const shown = state.shown || [];
  shown.forEach((o, i) => {
    const id = `wt${i}`;
    const geo = o.geometry || (o.route_geojson && { type: 'LineString', coordinates: o.route_geojson.coordinates });
    if (!geo) return;
    A.map.showRoute(id, geo, o.segments);
    A.map.ready((m) => {
      const picked = state.sel === o;
      const line = `${'route-' + id}-line`, segLine = `${'route-' + id}-segs-line`;
      if (m.getLayer(line)) {
        m.setPaintProperty(line, 'line-color', picked ? '#2A4D3B' : '#9aa3ad');
        m.setPaintProperty(line, 'line-opacity', picked ? 0.9 : 0.45);
        m.setPaintProperty(line, 'line-width', ['interpolate', ['linear'], ['zoom'], 9, picked ? 3.6 : 2.2, 14, picked ? 6.8 : 3.6]);
      }
      if (m.getLayer(segLine)) {
        m.setPaintProperty(segLine, 'line-opacity', picked ? 0.95 : 0.25);
      }
    });
  });
  /* a smaller shown set leaves orphan wtN lines from the last paint —
     hide every id above the new count before fitting the pick */
  for (let i = shown.length; i < (state.painted || 0); i++) A.map.hideRoute(`wt${i}`);
  state.painted = shown.length;
  if (state.sel) {
    const g = state.sel.geometry || state.sel.route_geojson;
    if (g) A.map.fit(g, window.innerWidth >= 720
      ? { top: 70, bottom: 70, left: 60, right: 500 }   // stay clear of the right rail
      : 110);
  }
}

/* ── results render ─────────────────────────────────────────────── */
function renderOptions() {
  const wrap = state.body.querySelector('.wt-results');
  const opts = visibleOptions(state.plan.options, state.vehicle, state.mode);
  state.shown = opts;
  wrap.innerHTML = '';

  // vehicle chips — only modes the response actually serves
  const vrow = document.createElement('div');
  vrow.className = 'vrow';
  VEHICLES.forEach((v) => {
    const n = state.plan.options.filter((o) => v.match(o.mode)).length;
    if (!n) return;
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'vchip' + (state.vehicle === v.id ? ' sel' : '');
    c.textContent = v.t;
    c.addEventListener('click', () => {
      state.vehicle = v.id;
      state.sel = null;
      saveLast();
      renderOptions();
      paintRoutes();
    });
    vrow.appendChild(c);
  });
  wrap.appendChild(vrow);

  const best = rank(state.plan.options.filter((o) => {
    const v = VEHICLES.find((x) => x.id === state.vehicle);
    return v ? v.match(o.mode) : true;
  }), 'health')[0];

  opts.forEach((o) => wrap.appendChild(optCard(o, best, state.sel || (state.sel = state.sel || opts[0]))));
  if (!state.sel) state.sel = opts[0];

  if (state.plan.partial) {
    const p = document.createElement('div');
    p.className = 'muted wt-partial';
    p.textContent = 'a few routes timed out — showing everything that came back';
    wrap.appendChild(p);
  }

  // CTA
  const cta = document.createElement('div');
  cta.className = 'cta';
  const canJourney = !!(A.screensReady && A.screensReady.journey);
  cta.innerHTML = canJourney
    ? `<button class="btn-primary" type="button">start journey</button>`
    : `<button class="btn-primary" type="button" disabled>start journey — coming soon</button>`;
  if (canJourney) {
    cta.querySelector('button').addEventListener('click', () => {
      const o = state.sel || opts[0];
      A.show('journey', {
        option: o,
        options: state.plan && state.plan.options,   // journey lane: worst/alt comparisons
        field_age_s: state.plan && state.plan.field && state.plan.field.age_s,
        from: state.from, to: state.to,
        vehicle: state.vehicle,
      });
    });
  }
  wrap.appendChild(cta);
}

async function plan() {
  const s = state;
  const res = state.body.querySelector('.wt-results');
  res.innerHTML = `
    <div class="wt-planning">
      <div class="sk" style="height:74px;border-radius:16px"></div>
      <div class="sk" style="height:74px;border-radius:16px;margin-top:8px"></div>
      <div class="muted" style="text-align:center;padding:6px">finding the cleanest routes for you…</div>
    </div>`;
  A.map.hideAllRoutes();
  state.painted = 0;
  const j = await A.api.post('/v2/plan', {
    from: { lat: state.from.lat, lon: state.from.lon },
    to: { lat: state.to.lat, lon: state.to.lon },
  }, 45000);
  /* the sheet may have closed (or remounted) while the engine thought —
     never write a stale plan into whatever state is there now */
  if (state !== s) return;
  if (!j) {
    res.innerHTML = `<div class="wt-err">
      <div class="wt-err-t">couldn't plan this trip</div>
      <div class="muted">the engine only covers Delhi NCR — or it's having a slow minute.</div>
      <button class="btn-ghost" type="button">try again</button></div>`;
    res.querySelector('.btn-ghost').addEventListener('click', plan);
    return;
  }
  if (j.code === 'outside_service_area' || j.error === 'outside_service_area') {
    res.innerHTML = `<div class="wt-err">
      <div class="wt-err-t">outside Delhi NCR</div>
      <div class="muted">alive prices air inside the region it can see — pick points in NCR.</div></div>`;
    return;
  }
  if (!Array.isArray(j.options) || !j.options.length) {
    res.innerHTML = `<div class="wt-err">
      <div class="wt-err-t">no honest route back</div>
      <div class="muted">the engine returned nothing for this pair — try nearby points.</div>
      <button class="btn-ghost" type="button">try again</button></div>`;
    res.querySelector('.btn-ghost').addEventListener('click', plan);
    return;
  }
  state.plan = j;
  state.sel = null;
  // keep stored vehicle only if served
  const servedModes = new Set(j.options.map((o) => (o.mode || '').split('_')[0]));
  if (!servedModes.has(state.vehicle)) state.vehicle = j.vehicle || 'car';
  saveLast();
  renderOptions();
  paintRoutes();
}

/* ── search surface inside the sheet ────────────────────────────── */
function openSearch(which) {
  const body = state.body;
  const cur = state[which];
  body.innerHTML = `
    <div class="searchbar wt-search-head">
      <span class="sdot ${which === 'from' ? 'a' : 'b'}"></span>
      <input type="text" autocomplete="off" autocorrect="off" spellcheck="false"
        placeholder="${which === 'from' ? 'from — name a place in Delhi' : 'where to?'}">
    </div>
    <div class="wt-drop"><button class="srow" type="button"><span class="ic">◎</span>
      <span><span class="n">drop a pin on the map</span><span class="s" style="display:block">tap anywhere — the trip starts/ends there</span></span>
    </button></div>
    ${which === 'from' && A.geo.pos ? `<div class="wt-drop"><button class="srow" type="button" data-cur="1"><span class="ic">◉</span>
      <span><span class="n">your current location</span><span class="s" style="display:block">${esc(A.geo.pos.label || 'where you are')}</span></span>
    </button></div>` : ''}
    <div class="wt-drop"><button class="srow" type="button" data-back="1"><span class="ic">‹</span>
      <span><span class="n">back to the trip</span></span>
    </button></div>
    <div class="row-list wt-rows"></div>`;

  const input = body.querySelector('input');
  const rows = body.querySelector('.wt-rows');

  const finish = (p) => {
    state[which] = { lat: p.lat, lon: p.lon, label: p.name || p.label || 'dropped pin' };
    pushRecent(state[which]);
    state.plan = null; state.sel = null;
    saveLast();
    renderMain();
    if (state.from && state.to) plan();
  };

  body.querySelector('.wt-drop .srow').addEventListener('click', () => {
    /* armed pin-drop: fold the near-full sheet into a hint strip —
       otherwise the whole map is covered and the tap can't land */
    state.armed = which;
    state.el.classList.add('wt-armed');
    body.innerHTML = `
      <div class="wt-armhint">
        <div class="wt-armhint-t">${which === 'from' ? 'tap the map where this trip starts' : 'tap the map where it ends'}</div>
        <div class="muted" style="margin-top:2px">the sheet is folded away — the whole map is yours</div>
        <button class="btn-ghost" type="button" data-unarm>back to the search</button>
      </div>`;
    body.querySelector('[data-unarm]').addEventListener('click', () => {
      state.armed = null;
      state.el.classList.remove('wt-armed');
      openSearch(which);
    });
  });
  body.querySelector('[data-back]').addEventListener('click', () => renderMain());
  const curBtn = body.querySelector('[data-cur]');
  if (curBtn) curBtn.addEventListener('click', () => {
    finish({ lat: A.geo.pos.lat, lon: A.geo.pos.lon, name: A.geo.pos.label || 'your spot' });
  });

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

  const showRecents = () => {
    const rs = recents();
    draw(rs.map((r) => ({ name: r.label, sub: '', dist: null, lat: r.lat, lon: r.lon, source: 'recent' })),
      rs.length ? '' : 'recent places will live here');
  };
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
      if (!res.length) draw([], 'nothing found — try a landmark, a block, a sector');
      else draw(res);
    }, 260);
  });
  requestAnimationFrame(() => input.focus());
}

/* ── main sheet ─────────────────────────────────────────────────── */
function rowView(which) {
  const v = state[which];
  const label = v ? v.label : (which === 'from' ? 'pick a start' : 'where to?');
  return `<button class="searchbar wt-row" type="button" data-which="${which}">
    <span class="sdot ${which === 'from' ? 'a' : 'b'}"></span>
    <span class="wt-row-label ${v ? '' : 'empty'}">${esc(label)}</span>
  </button>`;
}

function renderMain() {
  const body = state.body;
  const has = state.from && state.to;
  body.innerHTML = `
    ${rowView('from')}
    <div class="wt-swap-row">
      <button class="wt-swap" type="button" aria-label="swap">⇅</button>
      ${rowView('to')}
    </div>
    <div class="modes wt-modes">${MODES.map((m) => `
      <button class="mode ${state.mode === m.id ? 'sel' : ''}" type="button" data-mode="${m.id}">
        <span class="mi">${m.id === 'health' ? '♥' : m.id === 'budget' ? '◑' : '⏱'}</span>
        <span><span class="mt">${m.t}</span><span class="ms" style="display:block">${m.s}</span></span>
      </button>`).join('')}
    </div>
    <div class="wt-results">${has ? '' : '<div class="muted" style="padding:8px 2px">set both ends — the routes above price the trip in breath, not just minutes</div>'}</div>`;

  body.querySelectorAll('.wt-row').forEach((b) =>
    b.addEventListener('click', () => openSearch(b.dataset.which)));
  body.querySelector('.wt-swap').addEventListener('click', () => {
    const t = state.from; state.from = state.to; state.to = t;
    state.plan = null; state.sel = null;
    saveLast(); renderMain();
    if (state.from && state.to) plan();
  });
  body.querySelectorAll('.mode').forEach((b) =>
    b.addEventListener('click', () => {
      state.mode = b.dataset.mode;
      saveLast();
      body.querySelectorAll('.mode').forEach((x) => x.classList.toggle('sel', x === b));
      if (state.plan) { state.sel = null; renderOptions(); paintRoutes(); }
    }));

  /* coming back from the search surface rebuilds .wt-results empty —
     put the served options back (their route lines never left the map) */
  if (state.plan) renderOptions();
}

/* ── screen ─────────────────────────────────────────────────────── */
A.screen('whereto', {
  mount(el, params) {
    const chrome = A.sheetChrome(el, 'where to');
    state = {
      el,
      body: chrome.body,
      from: null, to: null,
      mode: 'health', vehicle: 'car',
      plan: null, sel: null, shown: [], painted: 0, armed: null,
    };

    const last = A.store.get(LAST_KEY, null);
    if (last) {
      state.from = last.from || null;
      state.to = last.to || null;
      state.mode = MODES.some((m) => m.id === last.mode) ? last.mode : 'health';
      state.vehicle = last.vehicle || 'car';
    }
    if (params && params.from) state.from = params.from;
    if (params && params.to) state.to = params.to;

    // from defaults to live position
    if (!state.from && A.geo.pos) {
      state.from = { lat: A.geo.pos.lat, lon: A.geo.pos.lon, label: A.geo.pos.label || 'your spot' };
    } else if (!state.from) {
      state.from = { lat: A.DELHI.lat, lon: A.DELHI.lon, label: 'central Delhi' };
    }
    // resolve a real label for a bare from
    if (state.from && !state.from.label) {
      A.search.reverse(state.from.lat, state.from.lon).then((n) => {
        if (n && state && state.from) { state.from.label = n; renderMain(); }
      });
    }

    renderMain();
    if (state.from && state.to) plan();

    const onTap = (e) => {
      if (!state.armed || A.current() !== 'whereto') return;
      const which = state.armed; state.armed = null;
      el.classList.remove('wt-armed');
      const p = e.detail;
      state[which] = { lat: p.lat, lon: p.lon, label: 'dropped pin' };
      A.search.reverse(p.lat, p.lon).then((n) => {
        if (n && state && state[which]) { state[which].label = n; renderMain(); }
      });
      pushRecent(state[which]);
      state.plan = null; state.sel = null;
      saveLast(); renderMain();
      if (state.from && state.to) plan();
    };
    document.addEventListener('alive:maptap', onTap);
    A.map.setFieldVisible(false);

    /* Escape walks back one level at a time: armed pin → search → close */
    const onKey = (e) => {
      if (e.key !== 'Escape' || !state) return;
      const un = state.body.querySelector('[data-unarm]');
      if (un) { un.click(); return; }
      if (state.body.querySelector('.wt-search-head')) {
        const bk = state.body.querySelector('[data-back]');
        if (bk) { bk.click(); return; }
      }
      if (chrome.sheetEl.classList.contains('on')) chrome.close();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('alive:maptap', onTap);
      document.removeEventListener('keydown', onKey);
      A.map.hideAllRoutes();
      state = null;
    };
  },
  /* re-shown after a stacked screen (journey cleared every route line
     on mount) — repaint what our cards still promise */
  show() { if (state && state.plan) paintRoutes(); },
});
})();
