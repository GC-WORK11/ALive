/* Alive webapp — anonymous usage counters for the operator dashboard.
   Owned by the admin lane.

   Contract: A.track(event, props) — never throws, never blocks.
     app_open       {}                       sent automatically, ≤ 1 per IST day
     journey_start  {mode, vehicle}
     journey_end    {completed, mode, vehicle, dose_ug, dose_saved_ug, km, minutes}
     profile        {age_band, area}         ≤ 1 per IST day; a changed answer
                                             resends; the last answer re-counts
                                             itself once on each new day
   mode ∈ health_max | petrol_health | time_health; vehicle = the picked
   class (car, cab, bike, auto, erick, bus, metro, cycle, walk). completed: true only
   when the user arrived. dose_saved_ug = fastest option's dose − taken
   dose (negative allowed). minutes/km = what was actually travelled.
   dose_ug only when it was measured (> 0) — pass null with no GPS fix;
   a 0/absent dose also drops dose_saved_ug (a saving needs a dose).
   age_band ∈ under13 | 13-17 | 18-29 | 30-44 | 45-59 | 60plus (the labels
   "Under 13", "13–17", "18–29", "30–44", "45–59", "60+" are accepted);
   area = a short locality/district NAME (≤ 48 chars): house numbers,
   PINs, coordinates and links are stripped — never pass a person's name.
   A.track('profile', {}) (nothing valid) forgets the stored answer.

   Privacy: NO coordinates, ever. Props are whitelisted here AND on the
   server (POST /v2/tally); anything else is dropped. The id is a random
   per-install string (localStorage 'alive.anon', JSON-quoted like every
   alive.* key) — no account, unrelated to the trip-sharing token. Setting
   A.store.set('telemetry', false) turns counting off on this device.

   Delivery: events queue in localStorage ('alive.tq', ≤ 50), flush in
   batches of ≤ 20 a few seconds after the last event, and on pagehide /
   tab-hide via sendBeacon (fetch keepalive as fallback). 2xx or 4xx drops
   the batch (a 4xx can never succeed on retry); network error or 5xx
   keeps it for the next flush.

   Internal/test traffic: opening the app with ?internal=1 marks this
   browser as internal (localStorage 'alive.internal'); every event then
   carries internal:true and the ops console counts it apart from real
   traffic. ?internal=0 lifts the mark. Still counts-only — the flag says
   "test device", nothing more. */
(() => {
'use strict';
if (!window.A || !A.store) return;
const API_BASE = (() => {
  const q = new URLSearchParams(location.search).get('api');
  return q ? q.replace(/\/$/, '') : '';
})();
const ENDPOINT = API_BASE + '/v2/tally';
const ALLOWED = {
  app_open: [],
  journey_start: ['mode', 'vehicle'],
  journey_end: ['completed', 'mode', 'vehicle', 'dose_ug', 'dose_saved_ug', 'km', 'minutes'],
  profile: ['age_band', 'area'],
};
const MODES = ['health_max', 'petrol_health', 'time_health'];
const AGE_BANDS = ['under13', '13-17', '18-29', '30-44', '45-59', '60plus'];
/* "Under 13" → under13, "13–17" → 13-17, "60+" → 60plus; nothing else */
function ageBand(v) {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase().replace(/[\u2010-\u2015\u2212]/g, '-').replace(/\s+/g, '');
  if (s === '60+') return '60plus';
  return AGE_BANDS.includes(s) ? s : null;
}
/* the server re-runs the same rules (v2/trip.py norm_area) — this copy
   only keeps a house number from ever leaving the phone */
const AREA_NUM_OK = ['sector', 'sec', 'phase', 'ph', 'stage', 'block', 'pocket', 'zone', 'part', 'extension', 'ext'];
const AREA_HOUSE = ['h.no', 'h.no.', 'hno', 'house', 'flat', 'tower', 'floor', 'plot', 'khasra', 'no', 'no.', '#'];
function areaName(v) {
  if (typeof v !== 'string') return null;
  let s = v.slice(0, 200);
  try { s = s.normalize('NFKC'); } catch (e) {}
  if (/@|https?:|www\./i.test(s)) return null;
  s = s.toLowerCase().replace(/\b(?:h\s*[./]?\s*no|house\s*no|flat\s*no|plot\s*no|khasra\s*no)\b\.?/g, ' ');
  const kept = [];
  for (let t of s.split(/[\s,;|/\\:]+/)) {
    if (!t) continue;
    if (/\d/.test(t)) {
      if (/^\d{1,3}$/.test(t) && kept.length && AREA_NUM_OK.includes(kept[kept.length - 1])) kept.push(t);
      continue;
    }
    if (AREA_HOUSE.includes(t)) continue;
    t = t.replace(/[^\p{L}\p{M}.\-'&()]/gu, ' ');
    for (let w of t.split(/\s+/)) {
      w = w.replace(/^[.\-'&()]+|[.\-'&()]+$/g, '');
      if (w && !AREA_HOUSE.includes(w)) kept.push(w);
    }
  }
  let out = '';
  for (const w of kept) {
    const nxt = (out + ' ' + w).trim();
    if (nxt.length > 48) break;
    out = nxt;
  }
  return (out.match(/\p{L}/gu) || []).length >= 2 ? out : null;
}
const MAX_Q = 50, BATCH = 20, DEBOUNCE_MS = 4000;
const st = A.store;
const off = () => st.get('telemetry') === false;
/* the internal mark — a test browser's own declaration, kept on the
   device and echoed on each event so the server never has to guess */
const _intq = new URLSearchParams(location.search).get('internal');
if (_intq === '1' || _intq === 'true') st.set('internal', true);
else if (_intq === '0' || _intq === 'false') st.del('internal');
const isInternal = () => st.get('internal') === true;
const istDay = () => new Date(Date.now() + 19800000).toISOString().slice(0, 10);

function anonId() {
  let id = st.get('anon');
  if (typeof id === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(id)) return id;
  try {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    id = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    id = (Date.now().toString(36) + Math.random().toString(36).slice(2) +
          Math.random().toString(36).slice(2)).replace(/[^a-z0-9]/g, '').slice(0, 32).padEnd(16, '0');
  }
  st.set('anon', id);
  return id;
}

function clean(event, props) {
  const keys = ALLOWED[event];
  const out = {};
  if (!keys || !props || typeof props !== 'object') return out;
  for (const k of keys) {
    const v = props[k];
    if (v == null) continue;
    if (k === 'mode') { if (MODES.includes(v)) out.mode = v; }
    else if (k === 'vehicle') { const s = String(v).trim().toLowerCase().slice(0, 32); if (s) out.vehicle = s; }
    else if (k === 'completed') out.completed = v === true;
    else if (k === 'age_band') { const b = ageBand(v); if (b) out.age_band = b; }
    else if (k === 'area') { const a = areaName(v); if (a) out.area = a; }
    else if (v !== '') { const n = Number(v); if (Number.isFinite(n)) out[k] = Math.round(n * 100) / 100; }
  }
  /* no GPS fix → nothing measured: a 0 dose (and a "saving" against it)
     is left out, so it can never drag the console's averages to 0 */
  if (event === 'journey_end' && !(out.dose_ug > 0)) { delete out.dose_ug; delete out.dose_saved_ug; }
  return out;
}

/* profile — at most one per IST day per device; a changed answer resends
   at once, and the last answer re-counts itself on each new day so the
   console's daily audience reflects who actually came. */
function profile(props, auto) {
  const c = clean('profile', props);
  if (!c.age_band && !c.area) { if (!auto) st.del('tprof'); return; }
  const sig = (c.age_band || '') + '|' + (c.area || '');
  const last = st.get('tprof');
  if (last && last.day === istDay() && last.sig === sig) return;
  st.set('tprof', { day: istDay(), sig, age_band: c.age_band || null, area: c.area || null });
  enqueue('profile', c);
}

const loadQ = () => { const q = st.get('tq', []); return Array.isArray(q) ? q : []; };
const saveQ = (q) => st.set('tq', q.slice(-MAX_Q));
let timer = null, inflight = false;

/* the batch leaves the queue the moment it is sent (so a pagehide beacon
   racing an in-flight fetch can never send it twice) and goes back only
   when the post failed. A failed post stops the drain — the queue waits
   for the next event / open / 'online' instead of hammering a dead link. */
async function flush(beacon) {
  clearTimeout(timer); timer = null;
  if (off()) { st.del('tq'); return; }
  if (inflight && !beacon) return;
  const q = loadQ();
  if (!q.length) return;
  const batch = q.slice(0, BATCH);
  saveQ(q.slice(batch.length));
  const body = JSON.stringify({ anon: anonId(), events: batch });
  if (beacon && navigator.sendBeacon) {
    let sent = false;
    try { sent = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' })); } catch (e) {}
    if (sent) return;
  }
  inflight = true;
  let ok = false;
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body, keepalive: true, credentials: 'omit',
    });
    ok = r.status < 500;          // a 4xx can never succeed on retry
  } catch (e) { /* offline */ }
  inflight = false;
  if (!ok) { saveQ(batch.concat(loadQ())); return; }
  if (!beacon && loadQ().length) timer = setTimeout(() => flush(false), 1000);
}

function enqueue(event, props) {
  const q = loadQ();
  const ev = { event, ts: Date.now(), props };
  if (isInternal()) ev.internal = true;
  q.push(ev);
  saveQ(q);
  clearTimeout(timer);
  timer = setTimeout(() => flush(false), event === 'journey_end' ? 800 : DEBOUNCE_MS);
}

function track(event, props) {
  try {
    if (off() || !ALLOWED[event]) return;
    if (event === 'profile') { profile(props, false); return; }
    enqueue(event, clean(event, props));
  } catch (e) { /* telemetry must never break the app */ }
}
track.flush = () => flush(false);
A.track = track;

/* app_open — once per IST calendar day per device; the stored profile
   answer (if the user gave one) re-counts itself once on a new day */
try {
  if (!off() && st.get('topen') !== istDay()) {
    st.set('topen', istDay());
    track('app_open', {});
  }
  const lp = !off() && st.get('tprof');
  if (lp && typeof lp === 'object' && lp.day !== istDay()) {
    profile({ age_band: lp.age_band, area: lp.area }, true);
  }
} catch (e) {}
addEventListener('pagehide', () => flush(true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush(true);
});
addEventListener('online', () => flush(false));
if (loadQ().length) setTimeout(() => flush(false), DEBOUNCE_MS);
})();
