/* compare — sim-trip lane. Contract: /tmp/sim-contract.md
   The chooser (Mobile/src/components/shell/CompareSheet.tsx + RouteTint):
   POST /v2/plan {from,to,fast:true}; while it prices, an honest working
   state; then every priced way lands in sequence — the dose counts up, the
   honest lo–hi band sits under it as a thin bar, ETA / distance follow, and
   the recommended option settles last with the one forest emphasis. The
   mini map draws every real route; the picked one is tinted by its own
   segments[].pm25. Every number on this screen is the plan's own.
   params: {from:{lat,lon,name}, to:{lat,lon,name}, via?} */
(() => {
  'use strict';
  const S = window.SIM;
  if (!S) return;

  /* ── icons: Material Symbols Rounded geometry (Mobile/src/icons.tsx) ── */
  const P = {
    car: 'M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h410q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm68 240q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Z',
    bike: 'M280-200q-50 0-85-35t-35-85h-40q-17 0-28.5-11.5T80-360v-80q0-66 47-113t113-47h80q33 0 56.5 23.5T400-520v120h140l140-174v-106h-80q-17 0-28.5-11.5T560-720q0-17 11.5-28.5T600-760h80q33 0 56.5 23.5T760-680v106q0 14-4.5 26.5T743-524L604-350q-11 14-28 22t-35 8H400q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T320-320h-80q0 17 11.5 28.5T280-280Zm80-360H240q-17 0-28.5-11.5T200-680q0-17 11.5-28.5T240-720h120q17 0 28.5 11.5T400-680q0 17-11.5 28.5T360-640Zm400 440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T800-320q0-17-11.5-28.5T760-360q-17 0-28.5 11.5T720-320q0 17 11.5 28.5T760-280Z',
    auto: 'M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54Z',
    cycle: 'M620-740q-33 0-56.5-23.5T540-820q0-33 23.5-56.5T620-900q33 0 56.5 23.5T700-820q0 33-23.5 56.5T620-740ZM432-540l66 69q11 11 16.5 25t5.5 30v176q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-160L312-512q-14-12-19-25t-5-31q0-18 5.5-30.5T312-624l112-112q13-13 27.5-18.5T484-760q18 0 32.5 5.5T544-736l76 76q21 21 47 35.5t58 20.5q17 3 28 15t11 29q0 17-12 28t-29 9q-49-7-90-28t-73-53l-32-32-96 96Zm-232 60q85 0 142.5 57.5T400-280q0 85-57.5 142.5T200-80q-85 0-142.5-57.5T0-280q0-85 57.5-142.5T200-480Zm0 340q57 0 98.5-41.5T340-280q0-57-41.5-98.5T200-420q-57 0-98.5 41.5T60-280q0 57 41.5 98.5T200-140Zm560-340q85 0 142.5 57.5T960-280q0 85-57.5 142.5T760-80q-85 0-142.5-57.5T560-280q0-85 57.5-142.5T760-480Zm0 340q57 0 98.5-41.5T900-280q0-57-41.5-98.5T760-420q-57 0-98.5 41.5T620-280q0 57 41.5 98.5T760-140Z',
    walk: 'M436-364 371-72q-3 14-14.5 23T330-40q-20 0-32-15t-8-34l102-515-72 28v96q0 17-11.5 28.5T280-440q-17 0-28.5-11.5T240-480v-122q0-12 6.5-21.5T264-638l178-76q14-6 29.5-7t29.5 4q14 5 26.5 14t20.5 23l40 64q13 20 30.5 38t39.5 31q14 8 31 14.5t34 9.5q16 3 26.5 14.5T760-480q0 17-12 28t-29 9q-56-8-100.5-35T541-543l-25 123 72 68q6 6 9 13.5t3 15.5v243q0 17-11.5 28.5T560-40q-17 0-28.5-11.5T520-80v-220l-84-64Zm104-376q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Z',
    bus: 'M320-200v20q0 25-17.5 42.5T260-120q-25 0-42.5-17.5T200-180v-62q-18-20-29-44.5T160-340v-380q0-83 77-121.5T480-880q172 0 246 37t74 123v380q0 29-11 53.5T760-242v62q0 25-17.5 42.5T700-120q-25 0-42.5-17.5T640-180v-20H320Zm-80-360h480v-120H240v120Zm100 240q25 0 42.5-17.5T400-380q0-25-17.5-42.5T340-440q-25 0-42.5 17.5T280-380q0 25 17.5 42.5T340-320Zm280 0q25 0 42.5-17.5T680-380q0-25-17.5-42.5T620-440q-25 0-42.5 17.5T560-380q0 25 17.5 42.5T620-320Z',
    metro: 'M80-160v-446q0-85 44-147.5T248-848q54-21 115-26.5t117-5.5q56 0 117 5.5T712-848q80 32 124 94.5T880-606v446q0 33-23.5 56.5T800-80H160q-33 0-56.5-23.5T80-160Zm220-280v-160h360v160H300Zm320 140q-17 0-28.5-11.5T580-340q0-17 11.5-28.5T620-380q17 0 28.5 11.5T660-340q0 17-11.5 28.5T620-300Zm-280 0q-17 0-28.5-11.5T300-340q0-17 11.5-28.5T340-380q17 0 28.5 11.5T380-340q0 17-11.5 28.5T340-300Zm84 80h110l51 51q5 5 10.5 7t11.5 2q20 0 27.5-19t-6.5-33l-10-10q44-6 73-39.5t29-78.5v-260q0-78-70-99t-170-21q-91 0-165.5 21T240-600v260q0 45 29 78.5t73 39.5l-11 11q-14 14-6.5 32.5T352-160q6 0 11-2t10-7l51-51Z',
    dust: 'M460-160q-32 0-59.5-16T356-220q-11-20-.5-40t32.5-20q13 0 23 8t18 18q5 7 13.5 10.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H120q-17 0-28.5-11.5T80-360q0-17 11.5-28.5T120-400h340q50 0 85 35t35 85q0 50-35 85t-85 35ZM120-560q-17 0-28.5-11.5T80-600q0-17 11.5-28.5T120-640h500q25 0 42.5-17.5T680-700q0-25-17.5-42.5T620-760q-16 0-30 7.5T568-731q-7 12-17 21.5t-24 9.5q-20 0-32.5-15t-6.5-32q14-42 50.5-67.5T620-840q58 0 99 41t41 99q0 58-41 99t-99 41H120Zm678 308q-20 9-39-2.5T740-288q0-14 9.5-23.5T771-328q14-8 21.5-22t7.5-30q0-25-17.5-42.5T740-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h620q58 0 99 41t41 99q0 42-22 76.5T798-252Z',
    leaf: 'M450-80q-33 0-66.5-7.5T315-109q12-121 70-226t149-185q-110 56-190.5 148T231-162q-4-3-7.5-6.5L216-176q-47-47-71.5-105T120-402q0-68 27-130t75-110q70-70 173.5-98T675-760q26 1 48 11.5t39 27.5q17 17 27 39.5t12 48.5q6 180-21 281t-96 170q-49 49-109.5 75.5T450-80Z',
    info: 'M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
    pin: 'M480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 79q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 45-17.5 94.5t-51 103Q698-301 648-244T533-127q-11 10-25 15t-28 5Zm0-453Zm0 80q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z',
    search: 'M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z',
  };
  const ic = (n, s = 22) =>
    `<svg width="${s}" height="${s}" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="${P[n] || P.car}"/></svg>`;
  const BACK = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.6 5.4 8 12l6.6 6.6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const glyphOf = (mode) => {
    const k = String(mode || '').toLowerCase();
    if (k.includes('walk')) return 'walk';
    if (k.includes('cycle') || k.includes('bicycle')) return 'cycle';
    if (k.includes('auto') || k.includes('rickshaw')) return 'auto';
    if (k.includes('bike') || k.includes('scooter') || k.includes('two_wheeler')) return 'bike';
    if (k.includes('bus')) return 'bus';
    if (k.includes('metro')) return 'metro';
    return 'car';
  };

  /* ── the app's words (Mobile/src/i18n/strings.ts) ── */
  const MODE_WORD = { car: 'car', car_open: 'car', bike: 'bike / scooter', auto: 'auto', cycle: 'cycle', walk: 'on foot', bus: 'bus', metro: 'metro', 'metro+walk': 'metro' };
  const TAG = { 'lightest on both': 'lightest on both', 'lightest for you': 'lightest for you', 'lightest for delhi': 'lightest for Delhi' };
  const modeWord = (o) => MODE_WORD[o.mode] || String(o.label || o.mode || 'this way').split(' · ')[0].toLowerCase();
  function splitLabel(label) {
    const s = String(label || '');
    const cut = s.lastIndexOf(' · ');
    if (cut <= 0) return [s, ''];
    let q = s.slice(cut);
    const alt = q.match(/^ · least-smoke alt (\d+)$/);
    if (q === ' · least-smoke rd') q = ' · least smoky way';
    else if (alt) q = ` · least smoky option ${alt[1]}`;
    return [s.slice(0, cut), q];
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs) => { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rad = Math.PI / 180;
  const fin = (v) => typeof v === 'number' && isFinite(v);
  const ug = (v) => S.fmt.ug(v);
  /* the app's one clock: Asia/Kolkata wall time, 12h — "11:52 pm" */
  const clock = (t) => {
    const d = new Date(t + 330 * 60000);
    const hh = d.getUTCHours(), mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${((hh + 11) % 12) + 1}:${mm} ${hh < 12 ? 'am' : 'pm'}`;
  };
  const istHour = () => new Date(Date.now() + 330 * 60000).getUTCHours();
  const airWord = () => { const hh = istHour(); return hh >= 18 || hh < 5 ? "tonight's air" : "today's air"; };
  const etaMin = (o) => (fin(o.eta_s) ? o.eta_s / 60 : fin(o.duration_min) ? o.duration_min : null);
  const etaTxt = (m) => {
    if (m == null) return '—';
    const r = Math.max(1, Math.round(m));
    if (r < 100) return r + ' min';
    return `${Math.floor(r / 60)} h ${String(r % 60).padStart(2, '0')}`;
  };
  const kmTxt = (km) => (fin(km) ? (km < 10 ? (Math.round(km * 10) / 10).toFixed(1) : String(Math.round(km * 10) / 10)) + ' km' : null);
  /* theme.doseColor — quiet air reads as plain muted ink (absence of colour = lighter) */
  const doseColor = (avg) => { const b = S.fmt.band(avg); return b.idx == null || b.idx <= 1 ? '#6E7278' : b.color; };
  const QUIET = '#8A93A3';
  const coordsOf = (o) => {
    const c = o && o.route_geojson && Array.isArray(o.route_geojson.coordinates) ? o.route_geojson.coordinates : null;
    return c && c.length > 1 ? c.filter((p) => Array.isArray(p) && fin(p[0]) && fin(p[1])) : null;
  };
  const geomKey = (c) => (c ? `${c.length}|${c[0]}|${c[c.length >> 1]}|${c[c.length - 1]}` : '');
  /* an endpoint's name beside its pin: the side away from the other end first, then the
     other side, then centred over/under the pin — truncated only when nothing fits */
  function placeLabel(g, cls, x, y, txt, isDest, otherX, W) {
    const t = sv('text', { class: cls });
    g.appendChild(t);
    const pad = 8, dx = isDest ? 13 : 15;
    const measure = (s) => { t.textContent = s; try { return t.getComputedTextLength(); } catch (e) { return s.length * 6.4; } };
    let w = measure(txt);
    const room = { start: W - pad - (x + dx), end: x - dx - pad };
    const order = x <= otherX ? ['end', 'start'] : ['start', 'end'];
    let side = order.find((a) => room[a] >= w);
    if (side) {
      t.setAttribute('text-anchor', side);
      t.setAttribute('x', (side === 'start' ? x + dx : x - dx).toFixed(1));
      t.setAttribute('y', (isDest ? y - 16 : y + 4).toFixed(1));
      return t;
    }
    if (w <= W - 2 * pad) {
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('x', clamp(x, pad + w / 2, W - pad - w / 2).toFixed(1));
      t.setAttribute('y', (isDest ? y - 38 : y + 24).toFixed(1));
      return t;
    }
    side = room.start >= room.end ? 'start' : 'end';
    let n = txt.length;
    while (n > 3 && w > room[side]) { n -= 1; w = measure(txt.slice(0, n).trimEnd() + '…'); }
    t.setAttribute('text-anchor', side);
    t.setAttribute('x', (side === 'start' ? x + dx : x - dx).toFixed(1));
    t.setAttribute('y', (isDest ? y - 16 : y + 4).toFixed(1));
    return t;
  }

  S.css('compare', `
.cmp{position:absolute;inset:0;overflow:hidden;background:#EEECE5}
.cmp-map{position:absolute;left:0;right:0;top:0;overflow:hidden;
  background:radial-gradient(120% 90% at 50% 35%,#F2F0EA 0%,#ECEAE2 70%,#E8E5DC 100%)}
.cmp-svg{position:absolute;left:0;top:0;display:block;overflow:visible}
.cmp-lbl{font:500 11.5px/1 var(--font);fill:#4A4E57;paint-order:stroke;stroke:#F2F0EA;stroke-width:3.4px;stroke-linejoin:round}
.cmp-seek{stroke:#6E7278;stroke-width:2;stroke-dasharray:1.5 7;stroke-linecap:round;fill:none;opacity:.8;animation:cmp-march .9s linear infinite}
@keyframes cmp-march{to{stroke-dashoffset:-17}}
.cmp-bubble{position:absolute;left:0;top:0;padding:7px 11px;border-radius:999px;background:rgba(255,255,255,.94);
  box-shadow:0 0 0 .5px var(--ink10),var(--sh-float);font:500 13px/1 var(--font);color:var(--ink);white-space:nowrap;
  font-variant-numeric:tabular-nums;opacity:0;pointer-events:none}
.cmp-scale{position:absolute;left:18px;display:flex;align-items:flex-end;gap:6px;opacity:0;transition:opacity .4s ease}
.cmp-scale i{display:block;height:5px;border:1.5px solid #8A8D94;border-top:0}
.cmp-scale span{font:500 11px/1 var(--font);color:#6E7278;font-variant-numeric:tabular-nums}
.cmp-top{position:absolute;left:14px;right:14px;top:calc(var(--sim-top) + 6px);display:flex;align-items:center;gap:8px;z-index:3}
.cmp-back{flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink);
  background:rgba(255,255,255,.88);box-shadow:0 0 0 .5px var(--ink10),var(--sh-float);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.cmp-fresh{display:flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:999px;background:rgba(255,255,255,.86);
  box-shadow:0 0 0 .5px var(--ink10),var(--sh-card);font:500 12.5px/1 var(--font);color:var(--ink2);opacity:0;transition:opacity .35s ease;
  font-variant-numeric:tabular-nums}
.cmp-fresh.is-on{opacity:1}
.cmp-fresh i{width:6px;height:6px;border-radius:50%;background:#8A8D94}
.cmp-panel{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;background:var(--paper);
  border-radius:var(--r-sheet) var(--r-sheet) 0 0;box-shadow:0 -6px 30px rgba(59,52,35,.12),0 0 0 .5px var(--ink10);z-index:2}
.cmp-grab{flex:none;width:36px;height:5px;margin:7px auto 0;border-radius:3px;background:rgba(22,24,29,.14)}
.cmp-trip{flex:none;display:flex;align-items:center;gap:8px;margin:8px 14px 0;padding:0 2px 9px;border-bottom:.5px solid var(--hair)}
.cmp-half{flex:0 1 auto;display:flex;align-items:center;gap:6px;min-width:0;min-height:40px;border-radius:8px;font:500 13px/1 var(--font);color:var(--ink)}
.cmp-half span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.cmp-half[data-slot="to"]{flex-shrink:5}
.cmp-half em{flex:none;font-style:normal;font-weight:400;color:var(--ink3)}
.cmp-dot{flex:none;width:9px;height:9px;border-radius:50%;background:var(--accent)}
.cmp-dot.is-to{background:transparent;box-shadow:inset 0 0 0 2px var(--ink3)}
.cmp-arrow{flex:none;font:400 13px/1 var(--font);color:var(--ink3)}
.cmp-body{position:relative;flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
  touch-action:pan-y;padding:2px 0 18px;scrollbar-width:none}
.cmp-body::-webkit-scrollbar{display:none}
.cmp-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:9px 18px 1px;font:400 12.5px/1.25 var(--font);color:var(--ink3)}
.cmp-legend{display:flex;align-items:center;gap:5px;flex:none}
.cmp-card{position:relative;display:block;width:calc(100% - 28px);margin:8px 14px 0;border-radius:var(--r-card);background:var(--surface);
  box-shadow:0 0 0 .5px var(--ink10),var(--sh-card);text-align:left;overflow:hidden}
.cmp-wash{position:absolute;inset:0;background:var(--accent-wash);opacity:0;transition:opacity .45s var(--settle);pointer-events:none}
.cmp-card.is-sel .cmp-wash{opacity:1}
.cmp-row{position:relative;display:flex;align-items:center;gap:12px;min-height:68px;padding:13px 14px}
.cmp-well{flex:none;width:44px;height:44px;border-radius:var(--r-row);display:flex;align-items:center;justify-content:center;color:var(--ink2);
  transition:background-color .45s var(--settle),color .45s var(--settle)}
.cmp-card.is-sel .cmp-well{background:var(--accent);color:#FAFAF7}
.cmp-mid{flex:1;min-width:0}
.cmp-lbl2{display:block;font:500 15px/1.25 var(--font);color:var(--ink)}
.cmp-qual{font-size:13px;font-weight:400;color:var(--ink3)}
.cmp-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}
.cmp-chips:empty{display:none}
.cmp-chip{display:inline-flex;align-items:center;gap:4px;height:21px;padding:0 7px;border-radius:var(--r-row);background:var(--surface2);
  font:500 12.5px/1 var(--font);color:var(--ink2);white-space:nowrap}
.cmp-chip.is-acc{background:var(--accent-wash);color:var(--accent-ink)}
.cmp-chip.is-acc svg{color:var(--accent)}
.cmp-card.is-sel .cmp-chip{background:rgba(255,255,255,.72)}
.cmp-meta,.cmp-felt,.cmp-why{display:block;margin-top:3px;font:400 13px/1.3 var(--font);color:var(--ink3)}
.cmp-meta{font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmp-felt{color:#C05F3A;font-weight:500}
.cmp-why{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cmp-right{flex:none;display:flex;flex-direction:column;align-items:flex-end;min-width:58px}
.cmp-dose{font:700 26px/1 var(--font);letter-spacing:-.01em;font-variant-numeric:tabular-nums;color:var(--ink)}
.cmp-dose.is-na{font:500 13px/1.2 var(--font);color:var(--ink3)}
.cmp-unit{margin-top:3px;font:400 11px/1 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums;white-space:nowrap}
.cmp-rng{position:relative;display:block;width:48px;height:4px;margin-top:7px;border-radius:2px;background:rgba(20,24,31,.08)}
.cmp-rng-b{position:absolute;top:0;bottom:0;border-radius:2px;opacity:.55;transform-origin:0 50%}
.cmp-rng-m{position:absolute;top:-2px;width:2px;height:8px;margin-left:-1px;border-radius:1px;background:var(--ink)}
.cmp-eta{margin-top:7px;font:500 13px/1 var(--font);color:var(--ink2);font-variant-numeric:tabular-nums;white-space:nowrap}
.cmp-late{opacity:0}
.cmp-foot{flex:none;display:flex;align-items:center;gap:12px;padding:10px 16px calc(var(--sim-bot) + 10px);border-top:.5px solid var(--line);background:var(--paper);
  transform:translate3d(0,110%,0);visibility:hidden;transition:transform .5s var(--ease),visibility 0s linear .5s}
.cmp-foot.is-on{transform:none;visibility:visible;transition:transform .5s var(--ease),visibility 0s}
.cmp-sum{flex:1;min-width:0}
.cmp-sum b{display:block;font:500 15px/1.25 var(--font);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmp-sum span{display:block;margin-top:2px;font:400 13px/1.25 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cmp-go{flex:none;min-height:48px;padding:0 26px;border-radius:999px;background:var(--ink);color:var(--paper);font:700 16px/1 var(--font);
  box-shadow:var(--sh-float)}
.cmp-go[disabled]{opacity:.35;pointer-events:none}
.cmp-state{display:flex;flex-direction:column;align-items:center;padding:30px 28px 10px;text-align:center}
.cmp-spin{width:22px;height:22px;border-radius:50%;border:2.2px solid rgba(53,97,75,.18);border-top-color:var(--accent);animation:cmp-rot .8s linear infinite}
@keyframes cmp-rot{to{transform:rotate(360deg)}}
.cmp-ring{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--surface2);color:var(--ink2)}
.cmp-st{margin-top:12px;font:500 15px/1.35 var(--font);color:var(--ink)}
.cmp-ss{margin-top:6px;max-width:300px;font:400 13px/1.45 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.cmp-retry{margin-top:16px;min-height:44px;padding:0 24px;border-radius:var(--r-card);background:var(--ink);color:var(--paper);font:500 15px/1 var(--font)}
@media (prefers-reduced-motion:reduce){.cmp-seek,.cmp-spin{animation:none}.cmp-wash,.cmp-well,.cmp-scale,.cmp-fresh,.cmp-foot,.cmp-foot.is-on{transition:none}}
`);

  let uid = 0;

  S.register('compare', {
    title: 'compare the ways',
    mount(root, params) {
      params = params || {};
      root.classList.add('sim-bleed');
      root.style.overflow = 'hidden';
      const O = S.ORIGIN;
      const isOrigin = (p) => !!p && Math.abs(+p.lat - O.lat) < 1e-6 && Math.abs(+p.lon - O.lon) < 1e-6;
      const tag = (p) => (p && fin(+p.lat) && fin(+p.lon) ? Object.assign({}, p, { lat: +p.lat, lon: +p.lon }, isOrigin(p) ? { preview: true, name: p.name || O.name } : null) : null);
      const from = tag(params.from) || { lat: O.lat, lon: O.lon, name: O.name, preview: true };
      const to = tag(params.to);
      const id = ++uid;
      let dead = false;
      const timers = new Set();
      const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };
      const anims = new Set();
      const play = (el, kf, o) => {
        if (S.reduced || !el.animate) { const f = kf[kf.length - 1]; for (const k in f) if (k !== 'offset' && k !== 'easing') el.style[k] = f[k]; return null; }
        const a = el.animate(kf, Object.assign({ fill: 'both' }, o));
        anims.add(a);
        a.onfinish = a.oncancel = () => anims.delete(a);
        return a;
      };

      const wrap = h('div', 'cmp');
      wrap.innerHTML =
        '<div class="cmp-map"><div class="cmp-bubble"></div><div class="cmp-scale"><i></i><span></span></div></div>' +
        `<div class="cmp-top"><button class="cmp-back" aria-label="back">${BACK}</button><div class="cmp-fresh"><i></i><span></span></div></div>` +
        '<div class="cmp-panel">' +
          '<div class="cmp-grab"></div>' +
          '<div class="cmp-trip">' +
            `<button class="cmp-half" data-slot="from"><i class="cmp-dot"></i><span>${esc(from.name)}</span>${from.preview ? '<em>(preview)</em>' : ''}</button>` +
            '<span class="cmp-arrow">→</span>' +
            `<button class="cmp-half" data-slot="to"><i class="cmp-dot is-to"></i><span>${esc(to ? to.name : 'Where to?')}</span>${to && to.preview ? '<em>(preview)</em>' : ''}</button>` +
          '</div>' +
          '<div class="cmp-body"></div>' +
          '<div class="cmp-foot"><div class="cmp-sum"><b></b><span></span></div><button class="cmp-go" disabled>start journey</button></div>' +
        '</div>';
      root.appendChild(wrap);
      const mapEl = wrap.querySelector('.cmp-map');
      const bubble = wrap.querySelector('.cmp-bubble');
      const scaleEl = wrap.querySelector('.cmp-scale');
      const fresh = wrap.querySelector('.cmp-fresh');
      const panel = wrap.querySelector('.cmp-panel');
      const body = wrap.querySelector('.cmp-body');
      const sumB = wrap.querySelector('.cmp-sum b');
      const sumS = wrap.querySelector('.cmp-sum span');
      const goBtn = wrap.querySelector('.cmp-go');
      const svg = sv('svg', { class: 'cmp-svg' });
      mapEl.insertBefore(svg, mapEl.firstChild);
      const defs = sv('defs');
      const gCam = sv('g'), gAlt = sv('g'), gCon = sv('g'), gWin = sv('g'), gSeek = sv('g'), gPins = sv('g');
      gCam.append(gAlt, gCon, gWin, gPins);
      svg.append(defs, gCam, gSeek);

      S.press(wrap.querySelector('.cmp-back'), () => S.back());
      wrap.querySelectorAll('.cmp-half').forEach((b) => S.press(b, () => editSlot(b.getAttribute('data-slot'))));
      function editSlot(slot) {
        if (params.via === 'search') {
          window.dispatchEvent(new CustomEvent('simtrip:edit', { detail: { slot } }));
          S.back();
        } else {
          S.push('search', { from, to, slot });
        }
      }

      /* ── geometry: one equirectangular fit for every route in the plan ── */
      let G = null;
      const simTop = () => {
        const p = h('div');
        p.style.cssText = 'position:absolute;visibility:hidden;height:var(--sim-top);width:0';
        root.appendChild(p);
        const v = p.offsetHeight || 0;
        p.remove();
        return v;
      };
      function layout() {
        const W = root.clientWidth || 390, H = root.clientHeight || 844;
        const top = simTop();
        const panelTop = Math.round(clamp(H * 0.41, 250, 380));
        panel.style.top = panelTop + 'px';
        mapEl.style.height = (panelTop + 26) + 'px';
        svg.setAttribute('width', W);
        svg.setAttribute('height', panelTop + 26);
        svg.setAttribute('viewBox', `0 0 ${W} ${panelTop + 26}`);
        scaleEl.style.top = (panelTop - 26) + 'px';
        G = { W, H, top, panelTop, box: { x: 30, y: top + 64, w: W - 60, h: Math.max(80, panelTop - (top + 64) - 34) } };
      }
      function project(points) {
        let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
        for (const p of points) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; if (p[1] < c) c = p[1]; if (p[1] > d) d = p[1]; }
        const midLat = (c + d) / 2, kx = Math.cos(midLat * rad);
        let wu = (b - a) * kx, hu = d - c;
        const min = 0.006;
        if (wu < min) { const m = (a + b) / 2; a = m - min / kx / 2; b = m + min / kx / 2; wu = min; }
        if (hu < min) { const m = (c + d) / 2; c = m - min / 2; d = m + min / 2; hu = min; }
        const bx = G.box, s = Math.min(bx.w / wu, bx.h / hu);
        const ox = bx.x + (bx.w - wu * s) / 2, oy = bx.y + (bx.h - hu * s) / 2;
        return { x: (lon) => ox + (lon - a) * kx * s, y: (lat) => oy + (d - lat) * s, mPerPx: 111320 / s };
      }
      const toPath = (coords, pr) => {
        let s = '', L = 0, px = 0, py = 0;
        for (let i = 0; i < coords.length; i++) {
          const x = pr.x(coords[i][0]), y = pr.y(coords[i][1]);
          s += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
          if (i) L += Math.hypot(x - px, y - py);
          px = x; py = y;
        }
        return { d: s, len: L };
      };
      const pointAt = (coords, pr, f) => {
        const pts = coords.map((c) => [pr.x(c[0]), pr.y(c[1])]);
        let tot = 0; const seg = [];
        for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); tot += l; }
        let want = tot * f;
        for (let i = 0; i < seg.length; i++) {
          if (want <= seg[i] || i === seg.length - 1) {
            const k = seg[i] ? clamp(want / seg[i], 0, 1) : 0;
            return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
          }
          want -= seg[i];
        }
        return pts[pts.length - 1];
      };

      /* ── pins + labels ── */
      let PR = null;
      function drawPins(animate) {
        gPins.innerHTML = '';
        const ox = PR.x(from.lon), oy = PR.y(from.lat);
        const dx = PR.x(to.lon), dy = PR.y(to.lat);
        const o = sv('g', { transform: `translate(${ox.toFixed(1)} ${oy.toFixed(1)})` });
        const oi = sv('g');
        oi.append(sv('circle', { r: 8.6, fill: '#16181D', stroke: '#FFFFFF', 'stroke-width': 2.6 }), sv('circle', { r: 3.3, fill: '#35614B' }));
        o.appendChild(oi);
        const dpin = sv('g', { transform: `translate(${dx.toFixed(1)} ${dy.toFixed(1)})` });
        const di = sv('g');
        const k = 0.74;
        di.appendChild(sv('path', { d: 'M16 1.5C8.6 1.5 2.5 7.6 2.5 15c0 10.2 13.5 27.5 13.5 27.5S29.5 25.2 29.5 15C29.5 7.6 23.4 1.5 16 1.5z', fill: '#16181D', stroke: '#FFFFFF', 'stroke-width': 1.6, transform: `translate(${-16 * k} ${-42.5 * k}) scale(${k})` }));
        di.appendChild(sv('circle', { cx: 0, cy: (-42.5 + 15) * k, r: 5 * k, fill: '#FFFFFF' }));
        dpin.appendChild(di);
        gPins.append(o, dpin);
        const l1 = placeLabel(gPins, 'cmp-lbl', ox, oy, String(from.name || ''), false, dx, G.W);
        const l2 = placeLabel(gPins, 'cmp-lbl', dx, dy, String(to.name || ''), true, ox, G.W);
        if (animate) {
          play(oi, [{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1)' });
          play(di, [{ transform: 'translate(0,-15px) scale(.65)', opacity: 0 }, { transform: 'translate(0,0) scale(1)', opacity: 1 }], { duration: 480, delay: 170, easing: 'cubic-bezier(.2,.9,.3,1)' });
          play(l1, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 260 });
          play(l2, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 380 });
        }
      }
      function drawScale() {
        if (!PR) return;
        const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        let m = steps[0];
        for (const s of steps) { if (s / PR.mPerPx <= 96) m = s; }
        const px = m / PR.mPerPx;
        scaleEl.querySelector('i').style.width = px.toFixed(1) + 'px';
        scaleEl.querySelector('span').textContent = m >= 1000 ? m / 1000 + ' km' : m + ' m';
        scaleEl.style.opacity = '1';
      }

      /* ── the honest working state: from → to, the line seeking between them ── */
      function drawSeek() {
        gSeek.innerHTML = '';
        const x1 = PR.x(from.lon), y1 = PR.y(from.lat), x2 = PR.x(to.lon), y2 = PR.y(to.lat);
        const len = Math.hypot(x2 - x1, y2 - y1) + 2;
        const pts = { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1) };
        // the as-the-crow-flies line from → to draws on, then keeps marching while the planner prices
        const mid = 'cmps' + id;
        const mask = sv('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -G.W, y: -G.H, width: G.W * 3, height: G.H * 3 });
        const ml = sv('line', Object.assign({ stroke: '#fff', 'stroke-width': 8, 'stroke-linecap': 'round' }, pts));
        ml.style.strokeDasharray = len.toFixed(1);
        mask.appendChild(ml);
        const l = sv('line', Object.assign({ class: 'cmp-seek', mask: `url(#${mid})` }, pts));
        gSeek.append(mask, l);
        play(ml, [{ strokeDashoffset: len }, { strokeDashoffset: 0 }], { duration: 950, delay: 430, easing: 'cubic-bezier(.33,0,.2,1)' });
      }

      /* ── plan state ── */
      const st = { plan: null, opts: [], sel: -1, rec: -1, phase: 'pricing', t0: 0, cards: [], routes: [], settled: false };
      let tick = 0;

      const foot = wrap.querySelector('.cmp-foot');
      function pricing() {
        st.phase = 'pricing';
        st.t0 = performance.now();
        goBtn.disabled = true;
        foot.classList.remove('is-on');
        sumB.textContent = '';
        sumS.textContent = '';
        body.innerHTML =
          '<div class="cmp-state" aria-live="polite"><div class="cmp-spin"></div>' +
          '<div class="cmp-st">finding the purest route for you…</div>' +
          `<div class="cmp-ss">pricing every way across ${airWord()} <span class="cmp-el"></span></div></div>`;
        const el = body.querySelector('.cmp-el');
        const ss = body.querySelector('.cmp-ss');
        clearInterval(tick);
        let slowSaid = false;
        const upd = () => {
          const s = (performance.now() - st.t0) / 1000;
          el.textContent = '· ' + s.toFixed(1) + ' s';
          if (s > 9 && !slowSaid) { slowSaid = true; ss.insertAdjacentHTML('beforeend', '<br>long trips take the field a little longer'); }
        };
        upd();
        tick = setInterval(upd, 100);
        play(body.firstElementChild, [{ opacity: 0, transform: 'translate3d(0,6px,0)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1)' });
        // what it's priced against — the live field's own provenance (omitted if the read fails)
        S.city().then((c) => {
          if (dead || st.phase !== 'pricing' || !c || !ss.isConnected) return;
          const n = c.sources && c.sources.stations && fin(c.sources.stations.count) ? c.sources.stations.count : null;
          const age = c.freshness && fin(c.freshness.age_min) ? c.freshness.age_min : null;
          if (n == null && age == null) return;
          const line = h('div', 'cmp-ss', [n != null ? `${n} live station readings` : null, age != null ? `air map ${Math.max(1, Math.round(age))} min old` : null].filter(Boolean).join(' · '));
          line.style.marginTop = '2px';
          ss.after(line);
          play(line, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
        });
      }

      function stateBlock(glyph, title, sub, btn, onBtn) {
        clearInterval(tick);
        goBtn.disabled = true;
        foot.classList.remove('is-on');
        sumB.textContent = ''; sumS.textContent = '';
        body.innerHTML = '';
        const b = h('div', 'cmp-state');
        b.setAttribute('aria-live', 'polite');
        b.innerHTML = `<div class="cmp-ring">${ic(glyph, 20)}</div><div class="cmp-st">${esc(title)}</div>${sub ? `<div class="cmp-ss">${esc(sub)}</div>` : ''}`;
        if (btn) {
          const x = h('button', 'cmp-retry', esc(btn));
          S.press(x, onBtn);
          b.appendChild(x);
        }
        body.appendChild(b);
        play(b, [{ opacity: 0, transform: 'translate3d(0,6px,0)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1)' });
        gSeek.innerHTML = '';
      }

      async function run() {
        pricing();
        if (PR && !gSeek.firstChild) drawSeek();
        const t0 = performance.now();
        const res = await S.api.post('/v2/plan', { from: { lat: +from.lat, lon: +from.lon }, to: { lat: +to.lat, lon: +to.lon }, fast: true }, 30000);
        if (dead) return;
        // a beat so the working state never flashes past the eye on a cached answer
        const wait = Math.max(0, 650 - (performance.now() - t0));
        later(() => land(res), wait);
      }

      function land(res) {
        clearInterval(tick);
        st.phase = 'landed';
        if (res == null || typeof res !== 'object') {
          S.toast("couldn't reach the planner");
          stateBlock('info', "couldn't load the ways there — check the connection", "the preview couldn't reach the planner just now.", 'try again', () => run());
          return;
        }
        const opts = (Array.isArray(res.options) ? res.options : []).filter((o) => o && coordsOf(o));
        const outside = res.code === 'outside_service_area' || (!opts.length && (from.outside || to.outside));
        if (outside) {
          stateBlock('pin', 'this trip sits outside Delhi NCR', 'Alive only measures the air inside Delhi NCR — this trip leaves the air map, so its smoke can\'t be counted honestly.', 'change the trip', () => editSlot(to.outside || !from.outside ? 'to' : 'from'));
          return;
        }
        if (!opts.length) {
          stateBlock('search', 'no route found between those two places', res.error && res.error !== 'no route' ? String(res.error) : 'try a landmark nearby — the planner prices roads it can reach.', 'change the trip', () => editSlot('to'));
          return;
        }
        st.plan = res;
        st.opts = opts;
        const ageS = res.field && fin(res.field.age_s) ? res.field.age_s : null;
        if (ageS != null) {
          fresh.querySelector('span').textContent = 'air map ' + S.fmt.ago(ageS) + ' old';
          fresh.classList.add('is-on');
        }
        // recommended → its forest emphasis; fallbacks: the lightest dose, then the first row
        let rec = opts.findIndex((o) => o.recommended === true);
        const doses = opts.map((o) => (o.dose && fin(o.dose.mid) ? o.dose.mid : Infinity));
        const minDose = Math.min(...doses);
        if (rec < 0 && minDose < Infinity) rec = doses.indexOf(minDose);
        if (rec < 0) rec = 0;
        st.rec = rec;
        // everything on the map — the plan's own geometry, every way it priced
        const pts = [[+from.lon, +from.lat], [+to.lon, +to.lat]];
        opts.forEach((o) => coordsOf(o).forEach((c) => pts.push(c)));
        const prOld = PR;
        PR = project(pts);
        drawPins(false);
        drawScale();
        camera(prOld, PR);
        renderCards(opts, minDose);
        choreograph();
      }
      /* the frame eases from the two pins to the whole priced set — a camera move, not a jump */
      function camera(a, b) {
        if (S.reduced || !a) return;
        const f = [b.x(from.lon), b.y(from.lat)], t = [b.x(to.lon), b.y(to.lat)];
        const F = [a.x(from.lon), a.y(from.lat)], T2 = [a.x(to.lon), a.y(to.lat)];
        const dn = Math.hypot(t[0] - f[0], t[1] - f[1]), dO = Math.hypot(T2[0] - F[0], T2[1] - F[1]);
        const A = dn > 2 ? dO / dn : 1;
        const bx = F[0] - A * f[0], by = F[1] - A * f[1];
        play(gCam, [{ transform: `matrix(${A.toFixed(4)},0,0,${A.toFixed(4)},${bx.toFixed(2)},${by.toFixed(2)})` }, { transform: 'matrix(1,0,0,1,0,0)' }],
          { duration: 640, easing: 'cubic-bezier(.32,.72,0,1)' });
      }

      /* ── cards ── */
      function renderCards(opts, minDose) {
        body.innerHTML = '';
        const lightest = opts.find((o) => o.dose && o.dose.mid === minDose) || null;
        const lw = lightest ? modeWord(lightest) : '';
        const maxHi = Math.max(1e-6, ...opts.map((o) => (o.dose ? (fin(o.dose.hi) ? o.dose.hi : fin(o.dose.mid) ? o.dose.mid : 0) : 0)));
        const took = fin(st.plan.took_ms) ? st.plan.took_ms / 1000 : null;
        const head = h('div', 'cmp-head',
          `<span>${opts.length} way${opts.length === 1 ? '' : 's'} priced${took != null ? (took < 0.1 ? ' in under 0.1 s' : ` in ${took < 10 ? took.toFixed(1) : Math.round(took)} s`) : ''}</span>` +
          `<span class="cmp-legend">${ic('dust', 13)}smoke you breathe</span>`);
        body.appendChild(head);
        play(head, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
        const now = Date.now();
        st.cards = opts.map((o, i) => {
          const d = o.dose || {};
          const has = fin(d.mid);
          const [base, qual] = splitLabel(o.label || MODE_WORD[o.mode] || o.mode);
          /* the leaf chip names the lightest dose — only. a server flag or a
             recommendation can decorate any card; it can never mint "least smoky" */
          const safest = has && d.mid === minDose;
          const tagKey = o.tag ? String(o.tag).toLowerCase() : '';
          const tag = o.tag ? (TAG[tagKey] || o.tag) : null;
          let chips = '';
          if (safest) chips += `<span class="cmp-chip is-acc">${ic('leaf', 11)}least smoky</span>`;
          if (tag) chips += `<span class="cmp-chip${!safest ? ' is-acc' : ''}">${esc(tag)}</span>`;
          else if (o.recommended && !safest) chips += '<span class="cmp-chip">our pick</span>';
          const gap = has && minDose < Infinity && d.mid - minDose >= 0.5 ? d.mid - minDose : null;
          const felt = gap != null
            ? (minDose > 0 && d.mid / minDose >= 2
              ? `~${(d.mid / minDose).toFixed(1).replace(/\.0$/, '')}× more inhaled than ${esc(lw)}`
              : `+${Math.round(gap)} µg more than ${esc(lw)}`)
            : '';
          const em = etaMin(o);
          const km = kmTxt(o.distance_km);
          const meta = [km, em != null ? 'arrive ' + clock(now + em * 60000) : null].filter(Boolean).join(' · ');
          const loR = fin(d.lo) ? Math.round(d.lo) : null, hiR = fin(d.hi) ? Math.round(d.hi) : null;
          const band = loR != null && hiR != null && loR !== hiR ? ` ${loR}–${hiR}` : '';
          const col = has ? doseColor(d.avg_conc_ugm3) : '#6E7278';
          const c = h('button', 'cmp-card');
          c.setAttribute('aria-pressed', 'false');
          c.innerHTML =
            '<span class="cmp-wash"></span>' +
            '<span class="cmp-row">' +
              `<span class="cmp-well">${ic(glyphOf(o.mode), 24)}</span>` +
              '<span class="cmp-mid">' +
                `<span class="cmp-lbl2">${esc(base)}${qual ? `<span class="cmp-qual">${esc(qual)}</span>` : ''}</span>` +
                `<span class="cmp-chips">${chips}</span>` +
                `<span class="cmp-meta cmp-late">${esc(meta)}</span>` +
                (felt ? `<span class="cmp-felt cmp-late">${felt}</span>` : '') +
                (o.reason_line ? `<span class="cmp-why cmp-late">${esc(o.reason_line)}</span>` : '') +
              '</span>' +
              '<span class="cmp-right">' +
                (has ? `<span class="cmp-dose" style="color:${col}">≈0</span><span class="cmp-unit">µg${band}</span>` : '<span class="cmp-dose is-na">no estimate</span>') +
                (has ? '<span class="cmp-rng"><i class="cmp-rng-b"></i><i class="cmp-rng-m"></i></span>' : '') +
                `<span class="cmp-eta cmp-late">${etaTxt(em)}</span>` +
              '</span>' +
            '</span>';
          if (has) {
            const lo = fin(d.lo) ? d.lo : d.mid, hi = fin(d.hi) ? d.hi : d.mid;
            const bEl = c.querySelector('.cmp-rng-b'), mEl = c.querySelector('.cmp-rng-m');
            const W = 48;
            const l = (lo / maxHi) * W, r = (hi / maxHi) * W;
            bEl.style.left = l.toFixed(1) + 'px';
            bEl.style.width = Math.max(3, r - l).toFixed(1) + 'px';
            bEl.style.background = col === '#6E7278' ? '#8A8D94' : col;
            mEl.style.left = clamp((d.mid / maxHi) * W, 1, W - 1).toFixed(1) + 'px';
          }
          c.setAttribute('aria-label', `${base}: about ${has ? ug(d.mid) + ' µg' : 'no estimate'}, ${etaTxt(em)}`);
          S.press(c, () => choose(i, true));
          body.appendChild(c);
          return c;
        });
      }

      /* ── the chooser beat: ways trace on, cards land in order, the pick settles last ── */
      function choreograph() {
        const opts = st.opts, cards = st.cards;
        st.settled = false;
        gSeek.querySelectorAll('.cmp-seek').forEach((l) => play(l, [{ opacity: 0.8 }, { opacity: 0 }], { duration: 260 }));
        later(() => { gSeek.innerHTML = ''; }, 300);
        // distinct geometries; the recommended way traces last
        const seen = new Map();
        opts.forEach((o, i) => { const k = geomKey(coordsOf(o)); if (!seen.has(k)) seen.set(k, []); seen.get(k).push(i); });
        const recKey = geomKey(coordsOf(opts[st.rec]));
        const keys = Array.from(seen.keys()).sort((a, b) => (a === recKey) - (b === recKey));
        gAlt.innerHTML = ''; gCon.innerHTML = ''; gWin.innerHTML = '';
        st.routes = keys.map((k) => {
          const i = seen.get(k)[0];
          const p = toPath(coordsOf(opts[i]), PR);
          const alt = sv('path', { d: p.d, fill: 'none', stroke: QUIET, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 });
          const con = sv('path', { d: p.d, fill: 'none', stroke: '#6E7278', 'stroke-width': 3.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.62 });
          con.style.strokeDasharray = p.len.toFixed(1);
          con.style.strokeDashoffset = p.len.toFixed(1);
          gAlt.appendChild(alt);
          gCon.appendChild(con);
          return { key: k, idx: seen.get(k), alt, con, len: p.len };
        });
        const reduce = S.reduced;
        // 1 · ways: each candidate traces on, staggered — every line a way the server priced
        const shown = st.routes.slice(-3);
        st.routes.forEach((r) => { if (!shown.includes(r)) { r.con.style.strokeDashoffset = '0'; } });
        shown.forEach((r, k) => {
          play(r.con, [{ strokeDashoffset: r.len }, { strokeDashoffset: 0 }], { duration: 760, delay: 120 + k * 420, easing: 'cubic-bezier(.33,0,.2,1)' });
        });
        const waysDone = 120 + (shown.length - 1) * 420 + 760;
        // cards land in sequence; each dose counts up from zero, then ETA / distance
        cards.forEach((c, i) => {
          const at = 140 + i * 110;
          play(c, [{ opacity: 0, transform: 'translate3d(0,16px,0)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: at, easing: 'cubic-bezier(.2,.9,.3,1)' });
          const num = c.querySelector('.cmp-dose:not(.is-na)');
          const o = opts[i];
          const bEl = c.querySelector('.cmp-rng-b');
          if (bEl) play(bEl, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 640, delay: at + 160, easing: 'cubic-bezier(.2,.9,.3,1)' });
          if (num) {
            if (reduce) num.textContent = '≈' + ug(o.dose.mid);
            else later(() => S.countUp(num, o.dose.mid, 720, (v) => '≈' + ug(v)), at + 120);
          }
          c.querySelectorAll('.cmp-late').forEach((el) => play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: at + 760 }));
        });
        const cardsDone = 140 + (cards.length - 1) * 110 + 880;
        const settleAt = Math.max(waysDone + 220, cardsDone + 120);
        later(() => settle(), reduce ? 0 : settleAt);
      }

      function settle() {
        if (st.settled) return;
        st.settled = true;
        st.routes.forEach((r) => {
          r.con.getAnimations && r.con.getAnimations().forEach((a) => a.finish());
          play(r.con, [{ opacity: 0.62 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
          play(r.alt, [{ opacity: 0 }, { opacity: 0.55 }], { duration: 420, easing: 'ease-out' });
        });
        choose(st.sel >= 0 ? st.sel : st.rec, false, true);
      }

      /* the picked way: casing + band-tinted segments, revealed from → to by one mask stroke */
      let winSeq = 0;
      function drawWinner(i, animate) {
        const o = st.opts[i];
        const coords = coordsOf(o);
        const p = toPath(coords, PR);
        const mid = 'cmpm' + id + '-' + (++winSeq);
        const mask = sv('mask', { id: mid, maskUnits: 'userSpaceOnUse', x: -G.W, y: -G.H, width: G.W * 3, height: G.H * 3 });
        const mp = sv('path', { d: p.d, fill: 'none', stroke: '#fff', 'stroke-width': 14, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
        mask.appendChild(mp);
        defs.appendChild(mask);
        const g = sv('g', { mask: `url(#${mid})` });
        g.appendChild(sv('path', { d: p.d, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 9, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
        const segs = Array.isArray(o.segments) ? o.segments.filter((s) => s && s.geometry && Array.isArray(s.geometry.coordinates) && s.geometry.coordinates.length > 1) : [];
        if (segs.length) {
          segs.forEach((s) => {
            const sp = toPath(s.geometry.coordinates, PR);
            const col = fin(s.pm25) ? S.fmt.band(s.pm25).color : QUIET;
            g.appendChild(sv('path', { d: sp.d, fill: 'none', stroke: col, 'stroke-width': 5.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
          });
        } else {
          const avg = o.dose && fin(o.dose.avg_conc_ugm3) ? o.dose.avg_conc_ugm3 : null;
          g.appendChild(sv('path', { d: p.d, fill: 'none', stroke: avg != null ? S.fmt.band(avg).color : QUIET, 'stroke-width': 5.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
        }
        const old = Array.from(gWin.children);
        gWin.appendChild(g);
        const kill = () => old.forEach((n) => {
          const m = n.getAttribute('mask'); // url(#id)
          n.remove();
          const mm = m && document.getElementById(m.slice(5, -1));
          if (mm) mm.remove();
        });
        if (animate && !S.reduced) {
          mp.style.strokeDasharray = (p.len + 2).toFixed(1);
          play(mp, [{ strokeDashoffset: p.len + 2 }, { strokeDashoffset: 0 }], { duration: clamp(380 + p.len * 1.1, 520, 980), easing: 'cubic-bezier(.33,0,.2,1)' });
          old.forEach((n) => play(n, [{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: 'ease-out' }));
          later(kill, 340);
        } else kill();
        // alternates: the picked geometry hides its quiet twin
        const key = geomKey(coords);
        st.routes.forEach((r) => { r.alt.style.visibility = r.key === key ? 'hidden' : ''; });
        placeBubble(i, coords, animate);
      }
      function placeBubble(i, coords, animate) {
        const o = st.opts[i];
        const d = o.dose || {};
        const em = etaMin(o);
        bubble.textContent = [em != null ? etaTxt(em) : null, fin(d.mid) ? '≈ ' + ug(d.mid) + ' µg' : null].filter(Boolean).join(' · ');
        const bw = bubble.offsetWidth || 110, bh = bubble.offsetHeight || 28;
        // pin the bubble beside the picked line where it covers the least of any route or pin
        const avoid = [];
        st.routes.forEach((r) => {
          const a = coordsOf(st.opts[r.idx[0]]);
          let px = PR.x(a[0][0]), py = PR.y(a[0][1]);
          avoid.push([px, py]);
          for (let k = 1; k < a.length; k++) {
            const x = PR.x(a[k][0]), y = PR.y(a[k][1]);
            const n = Math.ceil(Math.hypot(x - px, y - py) / 6);
            for (let j = 1; j <= n; j++) avoid.push([px + ((x - px) * j) / n, py + ((y - py) * j) / n]);
            px = x; py = y;
          }
        });
        avoid.push([PR.x(from.lon), PR.y(from.lat)], [PR.x(to.lon), PR.y(to.lat) - 14]);
        // the endpoint labels count as ink too
        gPins.querySelectorAll('text').forEach((t) => {
          try {
            const b = t.getBBox();
            for (let u = 0; u <= 4; u++) for (const yy of [b.y, b.y + b.height]) avoid.push([b.x + (b.width * u) / 4, yy]);
          } catch (e) { /* not rendered */ }
        });
        const minX = 10, maxX = G.W - bw - 10, minY = G.top + 52, maxY = G.panelTop - bh - 8;
        const a = bw / 2, b = bh / 2;
        let best = null, bestS = -Infinity;
        for (const f of [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74]) {
          const [x, y] = pointAt(coords, PR, f);
          const [x2, y2] = pointAt(coords, PR, Math.min(1, f + 0.03));
          const [x0, y0] = pointAt(coords, PR, Math.max(0, f - 0.03));
          const L = Math.hypot(x2 - x0, y2 - y0) || 1;
          const nx = -(y2 - y0) / L, ny = (x2 - x0) / L; // the line's local normal
          // centre the box just off the line: its support distance along the normal + a gap
          const off = a * Math.abs(nx) + b * Math.abs(ny) + 9;
          for (const s of [1, -1]) {
            const cx = x + s * nx * off, cy = y + s * ny * off;
            const bx = clamp(cx - a, minX, maxX), by = clamp(cy - b, minY, maxY);
            let clear = Infinity; // nearest ink (any route, pin or label) to the box
            for (const p of avoid) {
              const dx = Math.max(bx - p[0], 0, p[0] - (bx + bw)), dy = Math.max(by - p[1], 0, p[1] - (by + bh));
              const d = dx * dx + dy * dy;
              if (d < clear) clear = d;
            }
            clear = Math.sqrt(clear);
            const drift = Math.hypot(bx + a - cx, by + b - cy); // pushed off its spot by the frame edge
            const score = Math.min(clear, 14) * 5 - Math.abs(f - 0.5) * 40 - drift * 0.6;
            if (score > bestS) { bestS = score; best = [bx, by]; }
          }
        }
        const [bx, by] = best;
        bubble.style.transform = `translate3d(${bx.toFixed(1)}px,${by.toFixed(1)}px,0)`;
        play(bubble, [{ opacity: animate ? 0 : 1 }, { opacity: 1 }], { duration: 320, delay: animate ? 420 : 0, easing: 'ease-out' });
      }

      function choose(i, user, fromSettle) {
        if (i < 0 || i >= st.opts.length) return;
        if (user && !st.settled) {
          // a tap mid-beat jumps the choreography to its end — the tap wins
          anims.forEach((a) => { try { a.finish(); } catch (e) { /* gone */ } });
          st.cards.forEach((c, k) => {
            const num = c.querySelector('.cmp-dose:not(.is-na)');
            if (num) S.countUp(num, st.opts[k].dose.mid, 0, (v) => '≈' + ug(v)); // lands the final number now
          });
          st.sel = i;
          settle();
          return;
        }
        const prev = st.sel;
        if (prev === i && !fromSettle) return;
        st.sel = i;
        st.cards.forEach((c, k) => { c.classList.toggle('is-sel', k === i); c.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
        const card = st.cards[i];
        if (fromSettle && !S.reduced) play(card, [{ transform: 'scale(.985)' }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.2,.9,.3,1)' });
        const samePath = prev >= 0 && geomKey(coordsOf(st.opts[prev])) === geomKey(coordsOf(st.opts[i]));
        if (!samePath || fromSettle) drawWinner(i, true);
        else placeBubble(i, coordsOf(st.opts[i]), false);
        // footer: what start will ride
        const o = st.opts[i], d = o.dose || {};
        sumB.textContent = `${modeWord(o)} · ${etaTxt(etaMin(o))}`;
        sumS.textContent = fin(d.mid) ? `you'd breathe ≈ ${ug(d.mid)} µg` : 'no smoke estimate for this way';
        goBtn.disabled = false;
        foot.classList.add('is-on');
        if (user && card.scrollIntoView) {
          const br = body.getBoundingClientRect(), cr = card.getBoundingClientRect();
          if (cr.top < br.top || cr.bottom > br.bottom) card.scrollIntoView({ block: 'nearest', behavior: S.reduced ? 'auto' : 'smooth' });
        }
      }

      S.press(goBtn, () => {
        if (goBtn.disabled || st.sel < 0) return;
        const opts = st.opts;
        const o = opts[st.sel];
        const withDose = opts.filter((x) => x.dose && fin(x.dose.mid));
        const worstO = withDose.reduce((a, b) => (b.dose.mid > a.dose.mid ? b : a), withDose[0] || o);
        const lightO = withDose.reduce((a, b) => (b.dose.mid < a.dose.mid ? b : a), withDose[0] || o);
        const pack = (x) => (x && x.dose && fin(x.dose.mid) ? { mode: x.mode, mid: x.dose.mid, label: x.label, word: modeWord(x) } : null);
        S.push('nav', {
          from, to, option: o,
          worst: pack(worstO), lightest: pack(lightO), count: withDose.length,
          fieldAgeS: st.plan && st.plan.field && fin(st.plan.field.age_s) ? st.plan.field.age_s : null,
        });
      });

      /* ── boot ── */
      layout();
      if (!to) {
        stateBlock('search', 'pick where you\'re going first', null, 'choose a place', () => editSlot('to'));
        return () => { dead = true; };
      }
      PR = project([[+from.lon, +from.lat], [+to.lon, +to.lat]]);
      drawPins(true);
      drawSeek();
      run();

      const onResize = () => {
        if (dead) return;
        layout();
        if (st.opts.length) {
          const pts = [[+from.lon, +from.lat], [+to.lon, +to.lat]];
          st.opts.forEach((o) => coordsOf(o).forEach((c) => pts.push(c)));
          PR = project(pts);
          drawPins(false);
          drawScale();
          st.routes.forEach((r) => {
            const p = toPath(coordsOf(st.opts[r.idx[0]]), PR);
            r.alt.setAttribute('d', p.d); r.con.setAttribute('d', p.d); r.len = p.len;
            r.con.style.strokeDasharray = p.len.toFixed(1);
          });
          if (st.sel >= 0) drawWinner(st.sel, false);
        } else {
          PR = project([[+from.lon, +from.lat], [+to.lon, +to.lat]]);
          drawPins(false);
          if (st.phase === 'pricing') drawSeek();
        }
      };
      window.addEventListener('resize', onResize);

      return () => {
        dead = true;
        clearInterval(tick);
        timers.forEach(clearTimeout);
        anims.forEach((a) => { try { a.cancel(); } catch (e) { /* gone */ } });
        window.removeEventListener('resize', onResize);
      };
    },
  });
})();
