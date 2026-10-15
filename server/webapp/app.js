/* Alive webapp — the runtime. One global: A.
   Contract for screens: A.screen(id, {mount(el, params)}) — screens render
   into a provided element; the router shows exactly one at a time.
   A.api.get/post — same-origin /v2 calls, never throws (null on failure).
   A.geo — consent + position state (localStorage).
   A.fmt — band/ug/ago formatters. A.toast. A.store — namespaced localStorage. */
(() => {
'use strict';

const API_BASE = (() => {
  const q = new URLSearchParams(location.search).get('api');
  if (q) return q.replace(/\/$/, '');
  return '';               // same-origin on prod
})();

const DELHI = { lat: 28.6139, lon: 77.2090 };
const BOUNDS = [[76.75, 28.35], [77.55, 28.90]];   // NCR-ish view

/* ── api ─────────────────────────────────────────────────────────── */
async function get(path, ms = 15000) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(API_BASE + path, { signal: c.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}
async function post(path, body, ms = 30000) {
  try {
    const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
    const r = await fetch(API_BASE + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: c.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

/* shared /aqi read — the home hero and the air-map hero must never
   quote different numbers for the same spot: one fetch per spot per
   ~2 min, in-flight requests shared so two screens mounting together
   ride a single call. Failures are never cached (a retry re-fetches). */
const aqiMemo = new Map();      // key -> {t, j}
const aqiBusy = new Map();      // key -> Promise
async function aqiSpot(lat, lon, ms = 9000) {
  const key = `${(+lat).toFixed(4)},${(+lon).toFixed(4)}`;
  const hit = aqiMemo.get(key);
  if (hit && Date.now() - hit.t < 120000) return hit.j;
  if (aqiBusy.has(key)) return aqiBusy.get(key);
  const p = get(`/aqi?lat=${(+lat).toFixed(5)}&lon=${(+lon).toFixed(5)}`, ms)
    .then((j) => { aqiBusy.delete(key); if (j) aqiMemo.set(key, { t: Date.now(), j }); return j; });
  aqiBusy.set(key, p);
  return p;
}

/* ── store ───────────────────────────────────────────────────────── */
const store = {
  get(k, d = null) {
    try { const v = localStorage.getItem('alive.' + k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  },
  set(k, v) { try { localStorage.setItem('alive.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('alive.' + k); } catch (e) {} },
};

/* ── geo: consent + position ─────────────────────────────────────── */
const geo = {
  consent: store.get('consent'),            // 'granted' | 'picked' | null
  pos: store.get('pos'),                    // {lat,lon,label?,t}
  lastErr: null,                            // last geolocation error code
  granted() { return geo.consent === 'granted'; },
  /* a FRESH fix, never a cached one: laptops/phones often answer first
     with a coarse Wi-Fi/IP fix (±1–3 km) and sharpen within seconds —
     take the best fix of a short window, return early once it is tight.
     tight means street-tight (~35 m): the satellite fix takes a few
     seconds longer than the instant Wi-Fi guess — worth the wait */
  async locate(opts) {
    if (!navigator.geolocation) throw new Error('no geolocation');
    const goodM = (opts && opts.goodM) || 35, waitMs = (opts && opts.waitMs) || 9000;
    return new Promise((res, rej) => {
      let best = null, done = false, id = null, tm = null, tm2 = null;
      const end = (err) => {
        if (done) return; done = true;
        clearTimeout(tm); clearTimeout(tm2); if (id != null) navigator.geolocation.clearWatch(id);
        if (best) { geo.pos = best; store.set('pos', best); res(best); } else rej(err || new Error('no fix'));
      };
      tm = setTimeout(() => (best ? end() : null), waitMs);
      /* hard deadline: a silent watch (no fix, no error callback — e.g.
         an unreported denial) must not leave the promise pending past
         the watch's own timeout window */
      tm2 = setTimeout(() => end(Object.assign(new Error('no fix'), { code: 3 })), 16000);
      id = navigator.geolocation.watchPosition((p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude, t: Date.now(), acc: p.coords.accuracy };
        if (!best || !(best.acc <= pos.acc)) best = pos;
        if (pos.acc != null && pos.acc <= goodM) end();
      }, (e) => { geo.lastErr = e && e.code; if (!best || (e && e.code === 1)) end(e); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    });
  },
  /* what the position of record is worth right now —
     fresh < 2 min, stale ≤ 15 min, aged ≤ 24 h, absent otherwise */
  posNow() {
    const p = geo.pos;
    if (!p || !isFinite(p.lat) || !isFinite(p.lon)) return { stale: 'absent' };
    const age = Date.now() - (p.t || 0);
    const stale = age < 120e3 ? 'fresh' : age <= 15 * 60e3 ? 'stale' : age <= 24 * 3600e3 ? 'aged' : 'absent';
    return { lat: p.lat, lon: p.lon, acc: p.acc ?? null, label: p.label || null, t: p.t || 0, age_ms: age, stale };
  },
  /* 'on' | 'off' | 'denied' | 'unknown' — is location actually usable */
  async state() {
    if (!navigator.geolocation) return 'off';
    if (geo.pos && Date.now() - (geo.pos.t || 0) < 120e3) return 'on';
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const s = await navigator.permissions.query({ name: 'geolocation' });
        if (s && s.state === 'denied') return 'denied';
      }
    } catch (_) {}
    if (geo.lastErr === 2) return 'off';
    return 'unknown';
  },
  /* when a locate fails but consent stands, keep a cheap low-power watch
     armed: the first real fix that arrives (user turned location on,
     stepped outside) immediately becomes a locate — no refresh needed */
  armRecovery() {
    if (geo._recovery || !navigator.geolocation || !geo.granted()) return;
    const disarm = () => {
      geo._recovery = null;
      navigator.geolocation.clearWatch(id);
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
      window.removeEventListener('pageshow', onShow);
    };
    const wake = () => geo.locate().then((pos) => {
      document.dispatchEvent(new CustomEvent('alive:location', { detail: pos }));
      disarm();
    }).catch(() => {});
    const onShow = () => { if (!document.hidden) wake(); };
    const id = navigator.geolocation.watchPosition(wake, () => {},
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 20000 });
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    window.addEventListener('pageshow', onShow);
    geo._recovery = disarm;
  },
  /* keep sharpening after the first answer: cb fires only when the fix
     gets meaningfully tighter (or the device really moved) */
  refine(cb, ms = 90000) {
    if (!navigator.geolocation) return () => {};
    let best = geo.pos;
    const id = navigator.geolocation.watchPosition((p) => {
      const pos = { lat: p.coords.latitude, lon: p.coords.longitude, t: Date.now(), acc: p.coords.accuracy };
      const bAcc = best && best.acc != null ? best.acc : Infinity;
      const dM = best ? Math.hypot((pos.lat - best.lat) * 111320, (pos.lon - best.lon) * 111320 * Math.cos(pos.lat * Math.PI / 180)) : Infinity;
      if (pos.acc != null && (pos.acc < bAcc * 0.7 || dM > Math.max(80, pos.acc + (isFinite(bAcc) ? bAcc : 0)))) {
        best = pos; geo.pos = pos; store.set('pos', pos); cb(pos);
      }
    }, () => {}, { enableHighAccuracy: true, maximumAge: 0 });
    const tm = setTimeout(() => navigator.geolocation.clearWatch(id), ms);
    return () => { clearTimeout(tm); navigator.geolocation.clearWatch(id); };
  },
  /* persistent the way maps apps do it: only a fix that sharpens the
     answer or proves real movement becomes the app's position — GPS
     wobble never repaints the pin or re-reads the air */
  watch(cb) {
    if (!navigator.geolocation) return null;
    let best = geo.pos;
    return navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude, t: Date.now(),
                      acc: p.coords.accuracy, speed: p.coords.speed, heading: p.coords.heading };
        const bAcc = best && best.acc != null ? best.acc : Infinity;
        const dM = best ? Math.hypot((pos.lat - best.lat) * 111320, (pos.lon - best.lon) * 111320 * Math.cos(pos.lat * Math.PI / 180)) : Infinity;
        if (pos.acc != null && (pos.acc < bAcc * 0.7 || dM > Math.max(80, pos.acc + (isFinite(bAcc) ? bAcc : 0)))) {
          best = pos; geo.pos = pos; store.set('pos', pos); cb(pos);
        }
      },
      () => {}, { enableHighAccuracy: true, maximumAge: 2000 });
  },
  clearWatch(id) { if (id != null) navigator.geolocation.clearWatch(id); },
};

/* ── format ──────────────────────────────────────────────────────── */
const BAND_NAMES = ['good', 'satisfactory', 'moderate', 'poor', 'very poor', 'severe'];
const BAND_BREAKS = [30, 60, 90, 120, 250];
const fmt = {
  bandIdx(pm) {
    if (pm == null || !isFinite(pm)) return null;
    let i = 0; while (i < BAND_BREAKS.length && pm > BAND_BREAKS[i]) i++;
    return Math.min(i, 5);
  },
  band(pm) {
    const i = fmt.bandIdx(pm);
    if (i == null) return null;
    return { i, name: BAND_NAMES[i], color: `var(--b${i})`, wash: `var(--w${i})` };
  },
  bandWord(i) { return i == null ? null : BAND_NAMES[i]; },
  ug(v) { return v == null ? '—' : `~${Math.round(v)} µg`; },
  ugm3(v) { return v == null ? '—' : `~${Math.round(v)} µg/m³`; },
  km(v) { return v == null ? '—' : v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1)} km`; },
  min(s) { return s == null ? '—' : s < 60 ? '<1 min' : `${Math.round(s / 60)} min`; },
  hrs(s) { if (s == null) return '—'; const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`; },
  ago(epochS) {
    if (epochS == null) return null;
    const s = Math.max(0, Date.now() / 1000 - epochS);
    if (s < 90) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min old`;
    return `${(s / 3600).toFixed(1)} h old`;
  },
  clock(iso) {
    try { const d = new Date(iso); return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return iso; }
  },
};

/* ── toast ───────────────────────────────────────────────────────── */
let toastT = null;
function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms);
}

/* ── router ──────────────────────────────────────────────────────── */
const SCREENS = {};
const stack = [];
function screen(id, def) { SCREENS[id] = def; }
/* every change of the top screen is announced (sidebar/profile listen):
   document 'alive:screen' {id, prev} — purely informational */
function announce(id, prev) {
  try { document.dispatchEvent(new CustomEvent('alive:screen', { detail: { id, prev } })); } catch (e) {}
}
function show(id, params, replace = false) {
  const def = SCREENS[id];
  if (!def) return;
  const host = document.getElementById('screens');
  // hide current
  const cur = stack[stack.length - 1];
  if (cur) { cur.el.classList.remove('on'); if (cur.def.hide) cur.def.hide(); }
  if (replace && cur) { stack.pop(); if (cur.cleanup) cur.cleanup(); cur.el.remove(); }
  const el = document.createElement('div');
  el.className = 'screen on';
  host.appendChild(el);
  const rec = { id, el, def };
  stack.push(rec);
  document.body.dataset.top = id;
  const cleanup = def.mount(el, params || {});
  rec.cleanup = cleanup;
  announce(id, cur ? cur.id : null);
}
function back() {
  const cur = stack.pop();
  if (!cur) return;
  if (cur.cleanup) cur.cleanup();
  cur.el.remove();
  const top = stack[stack.length - 1];
  if (top) { top.el.classList.add('on'); if (top.def.show) top.def.show(); document.body.dataset.top = top.id; announce(top.id, cur.id); }
  else {
    /* stack empty — never strand on a bare map: route home via the hash
       handler (or mount directly if the hash is already home) */
    document.body.dataset.top = 'home';
    if (location.hash !== '#/home') location.hash = '#/home';
    else if (SCREENS.home) show('home', {});
  }
}
function current() { const c = stack[stack.length - 1]; return c && c.id; }
/* ids of every mounted screen, bottom → top (e.g. a journey under a sheet) */
function stackIds() { return stack.map((r) => r.id); }

/* ── sheet helper: builds standard chrome around a screen's body ─── */
function sheetChrome(el, title, onBack) {
  el.innerHTML = `
    <div class="sheet">
      <div class="sheet-grab"></div>
      <div class="sheet-title">
        <button class="back-btn" type="button" aria-label="back">‹</button>
        <h2></h2>
        <button class="x-btn" type="button" aria-label="close">✕</button>
      </div>
      <div class="sheet-body"></div>
    </div>`;
  el.querySelector('h2').textContent = title;
  const sh = el.querySelector('.sheet');
  requestAnimationFrame(() => requestAnimationFrame(() => sh.classList.add('on')));
  const close = () => { sh.classList.remove('on'); setTimeout(back, 320); };
  el.querySelector('.back-btn').addEventListener('click', close);
  el.querySelector('.x-btn').addEventListener('click', close);
  return { body: el.querySelector('.sheet-body'), close, sheetEl: sh };
}

/* ── boot ────────────────────────────────────────────────────────── */
function boot() {
  const start = location.hash ? location.hash.slice(2) : 'home';
  const startId = SCREENS[start] ? start : 'home';
  show(startId, {});
  /* ?pin=lat,lon,label — "i am standing here" as a URL: used by demos,
     shared links and the tap-to-drop flow. the pin becomes the position
     of record for the session; everything downstream (air read, asks,
     plans) still computes from live data at that point. */
  const _pinM = /(?:^|[?&])pin=(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,([^&]*))?/.exec(location.search || '');
  if (_pinM) {
    const pinPos = { lat: +_pinM[1], lon: +_pinM[2], t: Date.now(), acc: 25,
      label: _pinM[3] ? decodeURIComponent(_pinM[3]).replace(/\+/g, ' ') : 'pinned spot' };
    geo.pos = pinPos; store.set('pos', pinPos);
    geo.consent = 'picked'; store.set('consent', 'picked');
  }
  // consent gate — only once, only if unanswered
  const consented = geo.consent;
  if (!consented) {
    const c = document.getElementById('consent');
    c.hidden = false;
    c.querySelector('#consent-yes').addEventListener('click', async () => {
      geo.consent = 'granted'; store.set('consent', 'granted');
      c.hidden = true;
      try {
        const pos = await geo.locate();
        document.dispatchEvent(new CustomEvent('alive:location', { detail: pos }));
        if (!geo._watched) geo._watched = geo.watch((p2) => document.dispatchEvent(new CustomEvent('alive:location', { detail: p2 })));
      } catch (e) {
        toast('location refused — pick a point on the map instead');
        document.dispatchEvent(new CustomEvent('alive:location', { detail: null }));
      }
    });
    c.querySelector('#consent-skip').addEventListener('click', () => {
      geo.consent = 'picked'; store.set('consent', 'picked');
      c.hidden = true;
      toast('tap the map where you are');
      document.dispatchEvent(new CustomEvent('alive:location', { detail: null }));
    });
  } else if (geo.granted()) {
    /* every open re-proves the foot: anything older than half a minute
       gets re-located quietly — the stored pos paints honestly while
       the satellites sharpen */
    if (!geo.pos || Date.now() - geo.pos.t > 30000) {
      geo.locate().then((pos) => document.dispatchEvent(new CustomEvent('alive:location', { detail: pos })))
        .catch(() => geo.armRecovery());
    }
    /* and keep listening for as long as the app is open: a real move
       or a sharper fix lands as alive:location → the pin, the address
       and the air read follow atomically */
    if (!geo._watched) {
      geo._watched = geo.watch((pos) => document.dispatchEvent(new CustomEvent('alive:location', { detail: pos })));
    }
  }
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(2) || 'home';
    if (id !== current() && SCREENS[id]) { while (stack.length > 1) back(); if (current() !== id) show(id, {}, true); }
  });
  /* mobile keeps the page in bfcache — reopening the app or coming back
     from another tab restores it WITHOUT a boot: re-prove the foot each
     time we surface again, exactly how a maps app behaves */
  const reprove = () => {
    if (document.hidden || !geo.granted()) return;
    if (!geo.pos || Date.now() - geo.pos.t > 30000) {
      geo.locate().then((pos) => document.dispatchEvent(new CustomEvent('alive:location', { detail: pos })))
        .catch(() => geo.armRecovery());
    }
  };
  window.addEventListener('pageshow', (e) => { if (e.persisted) reprove(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reprove(); });
  window.addEventListener('focus', reprove);
}

/* the shared heartbeat: one scheduler for every "refresh me every
   N minutes" need — ticks only while the tab is visible and catches
   up the moment the user comes back; returns an unregister fn */
const beats = new Map();
function beat(name, fn, ms) {
  if (beats.has(name)) return () => {};
  const it = { fn, ms, last: 0 };
  const tick = () => {
    if (document.hidden) return;
    const now = Date.now();
    if (now - it.last >= it.ms) { it.last = now; try { it.fn(); } catch (_) {} }
  };
  const id = setInterval(tick, Math.min(ms, 30000));
  const onVis = () => { if (!document.hidden) tick(); };
  document.addEventListener('visibilitychange', onVis);
  beats.set(name, it);
  return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); beats.delete(name); };
}

window.A = {
  api: { get, post }, aqiSpot, geo, store, fmt, toast, screen, show, back, current, stackIds,
  sheetChrome, DELHI, BOUNDS, screensReady: SCREENS, beat,
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
