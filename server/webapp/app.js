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
  granted() { return geo.consent === 'granted'; },
  async locate() {
    if (!navigator.geolocation) throw new Error('no geolocation');
    return new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude, t: Date.now(), acc: p.coords.accuracy };
        geo.pos = pos; store.set('pos', pos);
        res(pos);
      },
      rej,
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }));
  },
  watch(cb) {
    if (!navigator.geolocation) return null;
    return navigator.geolocation.watchPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lon: p.coords.longitude, t: Date.now(),
                      acc: p.coords.accuracy, speed: p.coords.speed, heading: p.coords.heading };
        geo.pos = pos; cb(pos);
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
  const cleanup = def.mount(el, params || {});
  rec.cleanup = cleanup;
}
function back() {
  const cur = stack.pop();
  if (!cur) return;
  if (cur.cleanup) cur.cleanup();
  cur.el.remove();
  const top = stack[stack.length - 1];
  if (top) { top.el.classList.add('on'); if (top.def.show) top.def.show(); }
}
function current() { const c = stack[stack.length - 1]; return c && c.id; }

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
  } else if (geo.granted() && (!geo.pos || Date.now() - geo.pos.t > 120000)) {
    geo.locate().then((pos) => document.dispatchEvent(new CustomEvent('alive:location', { detail: pos })))
      .catch(() => {});
  }
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(2) || 'home';
    if (id !== current() && SCREENS[id]) { while (stack.length > 1) back(); if (current() !== id) show(id, {}, true); }
  });
}

window.A = {
  api: { get, post }, geo, store, fmt, toast, screen, show, back, current,
  sheetChrome, DELHI, BOUNDS, screensReady: SCREENS,
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
