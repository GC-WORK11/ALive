/* nav — sim-trip lane. Contract: /tmp/sim-contract.md
   A simulated ride along the plan option's real route (Mobile NavChrome
   grammar: next-air banner on top, the two live counters + trip meta in one
   bottom cluster). Time is compressed so any ride plays in ~40 s and the
   speed is said. The dose ticks segment by segment: dose.mid is split over
   segments[] in proportion to pm25 × dist_m, so the total lands exactly on
   the plan's own number. Nothing is measured here — it is labelled a
   preview, at tonight's air. End → the receipt sheet.
   params: {from, to, option, worst?, lightest?, count?, fieldAgeS?} */
(() => {
  'use strict';
  const S = window.SIM;
  if (!S) return;

  const P = {
    car: 'M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h410q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm68 240q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Z',
    bike: 'M280-200q-50 0-85-35t-35-85h-40q-17 0-28.5-11.5T80-360v-80q0-66 47-113t113-47h80q33 0 56.5 23.5T400-520v120h140l140-174v-106h-80q-17 0-28.5-11.5T560-720q0-17 11.5-28.5T600-760h80q33 0 56.5 23.5T760-680v106q0 14-4.5 26.5T743-524L604-350q-11 14-28 22t-35 8H400q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T320-320h-80q0 17 11.5 28.5T280-280Zm80-360H240q-17 0-28.5-11.5T200-680q0-17 11.5-28.5T240-720h120q17 0 28.5 11.5T400-680q0 17-11.5 28.5T360-640Zm400 440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T800-320q0-17-11.5-28.5T760-360q-17 0-28.5 11.5T720-320q0 17 11.5 28.5T760-280Z',
    auto: 'M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54Z',
    cycle: 'M620-740q-33 0-56.5-23.5T540-820q0-33 23.5-56.5T620-900q33 0 56.5 23.5T700-820q0 33-23.5 56.5T620-740ZM432-540l66 69q11 11 16.5 25t5.5 30v176q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-160L312-512q-14-12-19-25t-5-31q0-18 5.5-30.5T312-624l112-112q13-13 27.5-18.5T484-760q18 0 32.5 5.5T544-736l76 76q21 21 47 35.5t58 20.5q17 3 28 15t11 29q0 17-12 28t-29 9q-49-7-90-28t-73-53l-32-32-96 96Zm-232 60q85 0 142.5 57.5T400-280q0 85-57.5 142.5T200-80q-85 0-142.5-57.5T0-280q0-85 57.5-142.5T200-480Zm0 340q57 0 98.5-41.5T340-280q0-57-41.5-98.5T200-420q-57 0-98.5 41.5T60-280q0 57 41.5 98.5T200-140Zm560-340q85 0 142.5 57.5T960-280q0 85-57.5 142.5T760-80q-85 0-142.5-57.5T560-280q0-85 57.5-142.5T760-480Zm0 340q57 0 98.5-41.5T900-280q0-57-41.5-98.5T760-420q-57 0-98.5 41.5T620-280q0 57 41.5 98.5T760-140Z',
    walk: 'M436-364 371-72q-3 14-14.5 23T330-40q-20 0-32-15t-8-34l102-515-72 28v96q0 17-11.5 28.5T280-440q-17 0-28.5-11.5T240-480v-122q0-12 6.5-21.5T264-638l178-76q14-6 29.5-7t29.5 4q14 5 26.5 14t20.5 23l40 64q13 20 30.5 38t39.5 31q14 8 31 14.5t34 9.5q16 3 26.5 14.5T760-480q0 17-12 28t-29 9q-56-8-100.5-35T541-543l-25 123 72 68q6 6 9 13.5t3 15.5v243q0 17-11.5 28.5T560-40q-17 0-28.5-11.5T520-80v-220l-84-64Zm104-376q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Z',
    bus: 'M320-200v20q0 25-17.5 42.5T260-120q-25 0-42.5-17.5T200-180v-62q-18-20-29-44.5T160-340v-380q0-83 77-121.5T480-880q172 0 246 37t74 123v380q0 29-11 53.5T760-242v62q0 25-17.5 42.5T700-120q-25 0-42.5-17.5T640-180v-20H320Zm-80-360h480v-120H240v120Zm100 240q25 0 42.5-17.5T400-380q0-25-17.5-42.5T340-440q-25 0-42.5 17.5T280-380q0 25 17.5 42.5T340-320Zm280 0q25 0 42.5-17.5T680-380q0-25-17.5-42.5T620-440q-25 0-42.5 17.5T560-380q0 25 17.5 42.5T620-320Z',
    metro: 'M80-160v-446q0-85 44-147.5T248-848q54-21 115-26.5t117-5.5q56 0 117 5.5T712-848q80 32 124 94.5T880-606v446q0 33-23.5 56.5T800-80H160q-33 0-56.5-23.5T80-160Zm220-280v-160h360v160H300Zm320 140q-17 0-28.5-11.5T580-340q0-17 11.5-28.5T620-380q17 0 28.5 11.5T660-340q0 17-11.5 28.5T620-300Zm-280 0q-17 0-28.5-11.5T300-340q0-17 11.5-28.5T340-380q17 0 28.5 11.5T380-340q0 17-11.5 28.5T340-300Zm84 80h110l51 51q5 5 10.5 7t11.5 2q20 0 27.5-19t-6.5-33l-10-10q44-6 73-39.5t29-78.5v-260q0-78-70-99t-170-21q-91 0-165.5 21T240-600v260q0 45 29 78.5t73 39.5l-11 11q-14 14-6.5 32.5T352-160q6 0 11-2t10-7l51-51Z',
    close: 'M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z',
    dust: 'M460-160q-32 0-59.5-16T356-220q-11-20-.5-40t32.5-20q13 0 23 8t18 18q5 7 13.5 10.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H120q-17 0-28.5-11.5T80-360q0-17 11.5-28.5T120-400h340q50 0 85 35t35 85q0 50-35 85t-85 35ZM120-560q-17 0-28.5-11.5T80-600q0-17 11.5-28.5T120-640h500q25 0 42.5-17.5T680-700q0-25-17.5-42.5T620-760q-16 0-30 7.5T568-731q-7 12-17 21.5t-24 9.5q-20 0-32.5-15t-6.5-32q14-42 50.5-67.5T620-840q58 0 99 41t41 99q0 58-41 99t-99 41H120Zm678 308q-20 9-39-2.5T740-288q0-14 9.5-23.5T771-328q14-8 21.5-22t7.5-30q0-25-17.5-42.5T740-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h620q58 0 99 41t41 99q0 42-22 76.5T798-252Z',
    smoke: 'M720-200q-17 0-28.5-11.5T680-240q0-17 11.5-28.5T720-280q17 0 28.5 11.5T760-240q0 17-11.5 28.5T720-200ZM280-80q-17 0-28.5-11.5T240-120q0-17 11.5-28.5T280-160q17 0 28.5 11.5T320-120q0 17-11.5 28.5T280-80Zm-40-120q-17 0-28.5-11.5T200-240q0-17 11.5-28.5T240-280h360q17 0 28.5 11.5T640-240q0 17-11.5 28.5T600-200H240ZM400-80q-17 0-28.5-11.5T360-120q0-17 11.5-28.5T400-160h280q17 0 28.5 11.5T720-120q0 17-11.5 28.5T680-80H400ZM300-320q-91 0-155.5-64.5T80-540q0-83 55-145t136-73q32-57 87.5-89.5T480-880q90 0 156.5 57.5T717-679q69 6 116 57t47 122q0 75-52.5 127.5T700-320H300Zm0-80h400q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-40q0-66-47-113t-113-47q-48 0-87.5 26T333-704l-10 24h-25q-57 2-97.5 42.5T160-540q0 58 41 99t99 41Zm180-200Z',
    pin: 'M480-107q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 45-17.5 94.5t-51 103Q698-301 648-244T533-127q-11 10-25 15t-28 5Zm0-373q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z',
  };
  const ic = (n, s = 22) =>
    `<svg width="${s}" height="${s}" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="${P[n] || P.car}"/></svg>`;
  const BACK = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.6 5.4 8 12l6.6 6.6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const REPLAY = '<svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/></svg>';
  const glyphOf = (mode) => {
    const k = String(mode || '').toLowerCase();
    if (k.includes('walk')) return 'walk';
    if (k.includes('cycle')) return 'cycle';
    if (k.includes('auto') || k.includes('rickshaw')) return 'auto';
    if (k.includes('bike') || k.includes('scooter')) return 'bike';
    if (k.includes('bus')) return 'bus';
    if (k.includes('metro')) return 'metro';
    return 'car';
  };
  const MODE_WORD = { car: 'car', car_open: 'car', bike: 'bike / scooter', auto: 'auto', cycle: 'cycle', walk: 'on foot', bus: 'bus', metro: 'metro', 'metro+walk': 'metro' };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs) => { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fin = (v) => typeof v === 'number' && isFinite(v);
  const rad = Math.PI / 180;
  const havM = (a, b) => {
    const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371e3 * Math.asin(Math.sqrt(x));
  };
  const clock = (t) => {
    const d = new Date(t + 330 * 60000);
    const hh = d.getUTCHours(), mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${((hh + 11) % 12) + 1}:${mm} ${hh < 12 ? 'am' : 'pm'}`;
  };
  const airWord = () => { const hh = new Date(Date.now() + 330 * 60000).getUTCHours(); return hh >= 18 || hh < 5 ? "tonight's air" : "today's air"; };
  const QUIET = '#8A93A3';
  /* an endpoint's name beside its pin: away from the other end, else the other side,
     else centred over/under the pin — truncated only when nothing fits */
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

  S.css('nav', `
.nav{position:absolute;inset:0;overflow:hidden;background:radial-gradient(130% 80% at 50% 45%,#F2F0EA 0%,#ECEAE2 70%,#E7E4DB 100%)}
.nav-svg{position:absolute;left:0;top:0;display:block}
.nav-lbl{font:500 11.5px/1 var(--font);fill:#4A4E57;paint-order:stroke;stroke:#F2F0EA;stroke-width:3.4px;stroke-linejoin:round}
.nav-dot{position:absolute;left:0;top:0;width:0;height:0;will-change:transform;z-index:1}
.nav-halo{position:absolute;left:-23px;top:-23px;width:46px;height:46px;border-radius:50%;opacity:.26;transition:background-color .9s ease}
.nav-puck{position:absolute;left:-10px;top:-10px;width:20px;height:20px;border-radius:50%;background:#16181D;box-shadow:0 0 0 3px #fff,0 3px 10px rgba(22,24,29,.28)}
.nav-puck::after{content:"";position:absolute;left:6px;top:6px;width:8px;height:8px;border-radius:50%;background:#fff}
.nav-banner{position:absolute;left:12px;right:12px;top:calc(var(--sim-top) + 8px);display:flex;align-items:center;gap:12px;padding:12px;
  border-radius:var(--r-card);background:rgba(255,255,255,.88);box-shadow:0 0 0 .5px var(--ink10),var(--sh-float);z-index:3;
  -webkit-backdrop-filter:blur(12px) saturate(1.3);backdrop-filter:blur(12px) saturate(1.3)}
.nav-tile{flex:none;width:54px;height:54px;border-radius:17px;display:flex;align-items:center;justify-content:center;background:var(--ink);color:#FAFAF7}
.nav-btxt{position:relative;flex:1;min-width:0;height:44px}
.nav-bl{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center}
.nav-b1{display:flex;align-items:center;gap:7px;font:700 17px/1.2 var(--font);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nav-b1 i{flex:none;width:9px;height:9px;border-radius:50%}
.nav-b2{margin-top:3px;font:500 14px/1.2 var(--font);color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.nav-x{flex:none;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.nav-note{position:absolute;left:50%;top:calc(var(--sim-top) + 98px);transform:translateX(-50%);width:max-content;max-width:calc(100% - 36px);
  padding:8px 14px 9px;border-radius:16px;background:rgba(255,255,255,.9);box-shadow:0 0 0 .5px var(--ink10),var(--sh-card);text-align:center;z-index:2;
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);text-wrap:balance}
.nav-note b{display:block;font:500 10.5px/1.2 var(--mono);letter-spacing:.01em;color:var(--ink3)}
.nav-note span{display:block;margin-top:3px;font:500 13px/1.3 var(--font);color:var(--ink2)}
.nav-cluster{position:absolute;left:14px;right:14px;bottom:calc(var(--sim-bot) + 12px);border-radius:var(--r-card);background:rgba(255,255,255,.88);
  box-shadow:0 0 0 .5px var(--ink10),var(--sh-float);overflow:hidden;z-index:3;
  -webkit-backdrop-filter:blur(12px) saturate(1.3);backdrop-filter:blur(12px) saturate(1.3)}
.nav-prog{height:3px;background:rgba(22,24,29,.06)}
.nav-progf{height:3px;background:var(--accent);transform-origin:0 50%;transform:scaleX(0);will-change:transform}
.nav-cells{display:flex}
.nav-cell{flex:1;min-width:0;padding:10px 14px 0}
.nav-div{width:1px;margin:10px 0;background:var(--line)}
.nav-ch{display:flex;align-items:center;gap:6px;font:500 11px/1.2 var(--font);color:var(--ink3);white-space:nowrap}
.nav-ch svg{flex:none}
.nav-cv{margin-top:4px;font:500 17px/1.2 var(--font);color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.nav-trk{position:relative;height:3px;margin-top:7px;border-radius:2px;background:var(--surface2)}
.nav-seg{position:absolute;top:0;bottom:0;border-radius:2px;opacity:.5}
.nav-midk{position:absolute;top:-1px;width:3px;height:5px;margin-left:-1.5px;border-radius:1.5px;background:var(--ink)}
.nav-cb{margin:5px 0 9px;font:400 11px/1.2 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums;white-space:nowrap}
.nav-meta{display:flex;align-items:center;justify-content:center;min-height:37px;padding:8px 14px;border-top:1px solid var(--line);
  font:400 13px/1.25 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums;text-align:center}
.nav-after{display:none;gap:10px;padding:10px 12px 12px;border-top:1px solid var(--line)}
.nav-cluster.is-done .nav-after{display:flex}
.nav-cluster.is-done .nav-meta{display:none}
.nav-btn{flex:1;min-height:46px;border-radius:999px;display:flex;align-items:center;justify-content:center;gap:7px;font:500 15px/1 var(--font)}
.nav-btn.is-pri{background:var(--ink);color:var(--paper);font-weight:700}
.nav-btn.is-sec{background:var(--surface2);color:var(--ink)}
@media (prefers-reduced-motion:reduce){.nav-halo{transition:none}}
`);

  S.register('nav', {
    title: 'simulated ride',
    mount(root, params) {
      params = params || {};
      root.classList.add('sim-bleed');
      root.style.overflow = 'hidden';
      const o = params.option || null;
      const coords0 = o && o.route_geojson && Array.isArray(o.route_geojson.coordinates) ? o.route_geojson.coordinates.filter((p) => Array.isArray(p) && fin(p[0]) && fin(p[1])) : [];
      const from = params.from || { name: S.ORIGIN.name, lat: S.ORIGIN.lat, lon: S.ORIGIN.lon, preview: true };
      const to = params.to || { name: 'destination' };
      if (!o || coords0.length < 2) {
        root.innerHTML = '<div class="sim-fail">this ride has no route to follow — go back and pick a way.</div>';
        const b = h('button', 'nav-btn is-sec', 'back to the ways');
        b.style.cssText = 'position:absolute;left:24px;right:24px;bottom:calc(var(--sim-bot) + 24px)';
        S.press(b, () => S.back());
        root.appendChild(b);
        return undefined;
      }
      let dead = false;
      const timers = new Set();
      const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (!dead) fn(); }, ms); timers.add(t); return t; };

      /* ── the ride's numbers, all from the plan option ── */
      const coords = coords0;
      const cum = [0];
      for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + havM(coords[i - 1], coords[i]));
      const Dg = cum[cum.length - 1] || 1;
      const dose = o.dose || {};
      const mid = fin(dose.mid) ? dose.mid : null;
      const lo = fin(dose.lo) ? dose.lo : mid, hi = fin(dose.hi) ? dose.hi : mid;
      const kmTotal = fin(o.distance_km) ? o.distance_km : Dg / 1000;
      const eta = fin(o.eta_s) && o.eta_s > 0 ? o.eta_s : fin(o.duration_min) ? o.duration_min * 60 : (kmTotal / 20) * 3600;
      const speed = Math.max(1, Math.round(eta / 40));
      const simDur = eta / speed; // real seconds the preview takes
      const co2 = o.emissions && o.emissions.co2_kg && fin(o.emissions.co2_kg.mid) ? o.emissions.co2_kg : null;
      const showOut = !!(co2 && fin(co2.hi) && co2.hi > 0);
      // segments → dose shares ∝ pm25 × dist_m (exact sum = dose.mid)
      let segs = (Array.isArray(o.segments) ? o.segments : [])
        .filter((s) => s && fin(s.start_frac) && fin(s.end_frac) && s.end_frac > s.start_frac)
        .map((s) => ({ s: clamp(s.start_frac, 0, 1), e: clamp(s.end_frac, 0, 1), pm: fin(s.pm25) ? s.pm25 : null, m: fin(s.dist_m) && s.dist_m > 0 ? s.dist_m : (s.end_frac - s.start_frac) * Dg }))
        .sort((a, b) => a.s - b.s);
      const pmKnown = segs.some((s) => s.pm != null);
      if (!segs.length) segs = [{ s: 0, e: 1, pm: null, m: Dg }];
      const wSum = segs.reduce((a, s) => a + (pmKnown ? (s.pm || 0) : 1) * s.m, 0) || 1;
      let acc = 0;
      segs.forEach((s) => { s.share = mid != null ? (mid * (pmKnown ? (s.pm || 0) : 1) * s.m) / wSum : 0; s.c0 = acc; acc += s.share; });
      const segAt = (f) => { let k = 0; for (let i = 0; i < segs.length; i++) if (f >= segs[i].s) k = i; return k; };
      const doseAt = (f) => {
        if (mid == null) return null;
        if (f >= 1) return mid;
        const i = segAt(f), s = segs[i];
        if (f < s.s) return s.c0;
        return s.c0 + s.share * clamp((f - s.s) / (s.e - s.s), 0, 1);
      };

      /* ── DOM ── */
      const wrap = h('div', 'nav');
      wrap.innerHTML =
        '<div class="nav-dot"><div class="nav-halo"></div><div class="nav-puck"></div></div>' +
        '<div class="nav-banner">' +
          `<div class="nav-tile">${ic(glyphOf(o.mode), 28)}</div>` +
          '<div class="nav-btxt"></div>' +
          `<button class="nav-x" aria-label="end the ride">${ic('close', 20)}</button>` +
        '</div>' +
        `<div class="nav-note"><b>live · the dot is you</b><span id="navgeo">it moves only when you move — at ${airWord()}</span></div>` +
        '<div class="nav-cluster">' +
          '<div class="nav-prog"><div class="nav-progf"></div></div>' +
          '<div class="nav-cells">' +
            `<div class="nav-cell"><div class="nav-ch">${ic('dust', 14)}smoke you breathe</div><div class="nav-cv" data-k="dose">—</div>` +
              '<div class="nav-trk"><i class="nav-seg" data-k="dseg"></i><i class="nav-midk" data-k="dmid"></i></div><div class="nav-cb" data-k="dband"></div></div>' +
            (showOut
              ? '<div class="nav-div"></div>' +
                `<div class="nav-cell"><div class="nav-ch">${ic('smoke', 14)}smoke your ride puts out</div><div class="nav-cv" data-k="co2">—</div>` +
                '<div class="nav-trk"><i class="nav-seg" data-k="cseg"></i><i class="nav-midk" data-k="cmid"></i></div><div class="nav-cb" data-k="cband"></div></div>'
              : '') +
          '</div>' +
          '<div class="nav-meta" data-k="meta"></div>' +
          `<div class="nav-after"><button class="nav-btn is-sec" data-k="again">${REPLAY}ride again</button><button class="nav-btn is-pri" data-k="rcpt">see the receipt</button></div>` +
        '</div>';
      root.appendChild(wrap);
      const q = (k) => wrap.querySelector(`[data-k="${k}"]`);
      const dotEl = wrap.querySelector('.nav-dot');
      const halo = wrap.querySelector('.nav-halo');
      const btxt = wrap.querySelector('.nav-btxt');
      const tile = wrap.querySelector('.nav-tile');
      const xBtn = wrap.querySelector('.nav-x');
      const progf = wrap.querySelector('.nav-progf');
      const cluster = wrap.querySelector('.nav-cluster');
      const E = { dose: q('dose'), dseg: q('dseg'), dmid: q('dmid'), dband: q('dband'), co2: q('co2'), cseg: q('cseg'), cmid: q('cmid'), cband: q('cband'), meta: q('meta') };
      const svg = sv('svg', { class: 'nav-svg' });
      wrap.insertBefore(svg, wrap.firstChild);

      // the band bars: lo→hi as a slice of the band's own scale, mid tick on top (NavChrome CounterCell)
      const setBand = (seg, midk, l, m, hh, col) => {
        if (!seg) return;
        const span = hh > 0 ? hh : 1;
        seg.style.left = ((l / span) * 100).toFixed(1) + '%';
        seg.style.width = Math.max(3, ((hh - l) / span) * 100).toFixed(1) + '%';
        seg.style.background = col;
        midk.style.left = ((m / span) * 100).toFixed(1) + '%';
      };
      if (mid != null && hi > 0) setBand(E.dseg, E.dmid, lo, mid, hi, '#CF8A50');
      else if (E.dseg) E.dseg.parentNode.style.visibility = 'hidden';
      if (showOut) setBand(E.cseg, E.cmid, fin(co2.lo) ? co2.lo : co2.mid, co2.mid, co2.hi, '#4A4E57');

      /* ── map: fit the route between the banner and the cluster ── */
      let PR = null, pts = [], pcum = [], travel = null, total = 0;
      const simTop = () => {
        const p = h('div');
        p.style.cssText = 'position:absolute;visibility:hidden;height:var(--sim-top);width:var(--sim-bot)';
        root.appendChild(p);
        const v = [p.offsetHeight || 0, p.offsetWidth || 0];
        p.remove();
        return v;
      };
      function layout() {
        const W = root.clientWidth || 390, H = root.clientHeight || 844;
        const [top] = simTop();
        const noteB = wrap.querySelector('.nav-note').getBoundingClientRect();
        const rootB = root.getBoundingClientRect();
        const clB = cluster.getBoundingClientRect();
        const y0 = Math.max(top + 150, noteB.bottom - rootB.top + 26);
        const y1 = Math.min(H - 190, clB.top - rootB.top - 30);
        const box = { x: 34, y: y0, w: W - 68, h: Math.max(90, y1 - y0) };
        svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
        const all = coords.concat([[+from.lon, +from.lat]].filter((p) => fin(p[0]) && fin(p[1])), [[+to.lon, +to.lat]].filter((p) => fin(p[0]) && fin(p[1])));
        for (const p of all) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; if (p[1] < c) c = p[1]; if (p[1] > d) d = p[1]; }
        const kx = Math.cos(((c + d) / 2) * rad);
        let wu = (b - a) * kx, hu = d - c;
        const min = 0.004;
        if (wu < min) { const m = (a + b) / 2; a = m - min / kx / 2; b = m + min / kx / 2; wu = min; }
        if (hu < min) { const m = (c + d) / 2; c = m - min / 2; d = m + min / 2; hu = min; }
        const s = Math.min(box.w / wu, box.h / hu);
        const ox = box.x + (box.w - wu * s) / 2, oy = box.y + (box.h - hu * s) / 2;
        PR = { x: (lon) => ox + (lon - a) * kx * s, y: (lat) => oy + (d - lat) * s, W, H };
        pts = coords.map((p) => [PR.x(p[0]), PR.y(p[1])]);
        pcum = [0];
        for (let i = 1; i < pts.length; i++) pcum.push(pcum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        total = pcum[pcum.length - 1] || 1;
        draw();
      }
      const toD = (cs) => { let s = ''; for (let i = 0; i < cs.length; i++) s += (i ? 'L' : 'M') + PR.x(cs[i][0]).toFixed(1) + ' ' + PR.y(cs[i][1]).toFixed(1); return s; };
      function draw() {
        svg.innerHTML = '';
        const full = toD(coords);
        const line = (d, stroke, w, extra) => svg.appendChild(sv('path', Object.assign({ d, fill: 'none', stroke, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, extra || {})));
        line(full, '#FFFFFF', 10);
        const rs = (Array.isArray(o.segments) ? o.segments : []).filter((s) => s && s.geometry && Array.isArray(s.geometry.coordinates) && s.geometry.coordinates.length > 1);
        if (rs.length) rs.forEach((s) => line(toD(s.geometry.coordinates), fin(s.pm25) ? S.fmt.band(s.pm25).color : QUIET, 6));
        else line(full, QUIET, 6);
        // the travelled span paints dimmed behind the dot
        travel = line(full, '#B7B4AB', 6.6);
        travel.style.strokeDasharray = `0 ${(total + 4).toFixed(1)}`;
        // endpoints
        const ox = pts[0][0], oy = pts[0][1];
        const og = sv('g', { transform: `translate(${ox.toFixed(1)} ${oy.toFixed(1)})` });
        og.append(sv('circle', { r: 7.5, fill: '#FFFFFF', stroke: '#16181D', 'stroke-width': 2.6 }));
        svg.appendChild(og);
        const dx = fin(+to.lon) ? PR.x(+to.lon) : pts[pts.length - 1][0], dy = fin(+to.lat) ? PR.y(+to.lat) : pts[pts.length - 1][1];
        const k = 0.74;
        const dg = sv('g', { transform: `translate(${dx.toFixed(1)} ${dy.toFixed(1)})` });
        dg.appendChild(sv('path', { d: 'M16 1.5C8.6 1.5 2.5 7.6 2.5 15c0 10.2 13.5 27.5 13.5 27.5S29.5 25.2 29.5 15C29.5 7.6 23.4 1.5 16 1.5z', fill: '#16181D', stroke: '#FFFFFF', 'stroke-width': 1.6, transform: `translate(${-16 * k} ${-42.5 * k}) scale(${k})` }));
        dg.appendChild(sv('circle', { cx: 0, cy: (-42.5 + 15) * k, r: 5 * k, fill: '#FFFFFF' }));
        svg.appendChild(dg);
        placeLabel(svg, 'nav-lbl', ox, oy, String(from.name || ''), false, dx, PR.W);
        placeLabel(svg, 'nav-lbl', dx, dy, String(to.name || ''), true, ox, PR.W);
        // the gap a truncated route leaves is drawn as what it is — not ridden
        const end = pts[pts.length - 1];
        if (Math.hypot(end[0] - dx, end[1] - dy) > 14) line(`M${end[0].toFixed(1)} ${end[1].toFixed(1)}L${dx.toFixed(1)} ${dy.toFixed(1)}`, '#8A8D94', 2, { 'stroke-dasharray': '2 6' });
        paint(cur.f, true);
      }

      /* ── the ride ── */
      const cur = { f: 0, el: 0, playing: false, seg: -1, done: false, ended: false, raf: 0, last: 0, txt: {} };
      const set = (k, el, v) => { if (el && cur.txt[k] !== v) { cur.txt[k] = v; el.textContent = v; } };
      const ugTxt = (v) => (v == null ? '—' : (v === 0 ? '0' : '≈ ' + S.fmt.ug(v)) + ' µg');
      function bannerAir(i, instant) {
        const s = segs[i];
        const html = s.pm != null
          ? `<div class="nav-b1"><i style="background:${S.fmt.band(s.pm).color}"></i>${esc(S.fmt.band(s.pm).name)} air</div><div class="nav-b2">≈ ${Math.round(s.pm)} µg/m³ on this stretch</div>`
          : '<div class="nav-b1">following the route</div><div class="nav-b2">no street-level air read here</div>';
        swapBanner(html, instant);
        halo.style.backgroundColor = s.pm != null ? S.fmt.band(s.pm).color : QUIET;
      }
      function swapBanner(html, instant) {
        const n = h('div', 'nav-bl', html);
        const old = Array.from(btxt.children);
        btxt.appendChild(n);
        if (instant || S.reduced || !n.animate) { old.forEach((x) => x.remove()); return; }
        n.animate([{ opacity: 0, transform: 'translate3d(0,7px,0)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)' });
        old.forEach((x) => { const a = x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }); a.onfinish = () => x.remove(); });
      }
      function posAt(f) {
        const want = f * Dg;
        let lo2 = 0, hi2 = cum.length - 1;
        while (hi2 - lo2 > 1) { const m = (lo2 + hi2) >> 1; if (cum[m] <= want) lo2 = m; else hi2 = m; }
        const span = cum[hi2] - cum[lo2] || 1;
        const k = clamp((want - cum[lo2]) / span, 0, 1);
        return { x: pts[lo2][0] + (pts[hi2][0] - pts[lo2][0]) * k, y: pts[lo2][1] + (pts[hi2][1] - pts[lo2][1]) * k, p: pcum[lo2] + (pcum[hi2] - pcum[lo2]) * k };
      }
      function paint(f, force) {
        if (!PR) return;
        const p = posAt(f);
        dotEl.style.transform = `translate3d(${p.x.toFixed(2)}px,${p.y.toFixed(2)}px,0)`;
        if (travel) travel.style.strokeDasharray = `${p.p.toFixed(1)} ${(total + 4).toFixed(1)}`;
        progf.style.transform = `scaleX(${f.toFixed(4)})`;
        const dz = doseAt(f);
        set('dose', E.dose, mid == null ? 'no estimate' : ugTxt(dz));
        if (mid != null && E.dband) {
          const share = mid > 0 ? dz / mid : f;
          const l = Math.round(Math.max(0, lo * share)), u = Math.round(Math.max(0, hi * share));
          set('dband', E.dband, l === u ? `${l} µg` : `${l}–${u} µg`);
        }
        if (showOut) {
          const c = co2.mid * f;
          const g = co2.hi < 1;
          set('co2', E.co2, g ? `${Math.round(c * 1000)} g` : `${(Math.round(c * 10) / 10).toFixed(1)} kg`);
          const cl = (fin(co2.lo) ? co2.lo : co2.mid) * f, ch = co2.hi * f;
          set('cband', E.cband, g ? `${Math.round(cl * 1000)}–${Math.round(ch * 1000)} g` : `${cl.toFixed(1)}–${ch.toFixed(1)} kg`);
        }
        if (!cur.ended) {
          const leftM = kmTotal * 1000 * (1 - f);
          const leftMin = Math.max(0, Math.round((eta * (1 - f)) / 60));
          const left = leftM >= 950 ? `${(leftM / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(leftM / 10) * 10)} m`;
          set('meta', E.meta, f >= 1 ? `arrived · ${kmTotal.toFixed(1)} km in ${Math.max(1, Math.round(eta / 60))} min of route time` : `${leftMin} min · ${left} left · arrive ${clock(cur.t0 + eta * 1000)}`);
        }
        const i = segAt(f);
        if (i !== cur.seg || force) {
          const prev = cur.seg;
          cur.seg = i;
          if (!cur.done) {
            const same = prev >= 0 && segs[prev] && segs[i] && segs[prev].pm != null && segs[i].pm != null && Math.round(segs[prev].pm) === Math.round(segs[i].pm);
            if (!same || force) bannerAir(i, force && prev < 0);
          }
        }
      }
      function frame(t) {
        cur.raf = 0;
        if (dead || !cur.playing) return;
        const dt = cur.last ? Math.min(0.1, (t - cur.last) / 1000) : 0;
        cur.last = t;
        cur.el += dt;
        const f = clamp(cur.el / simDur, 0, 1);
        cur.f = f;
        paint(f);
        if (f >= 1) { arrive(); return; }
        cur.raf = requestAnimationFrame(frame);
      }
      let geoWatch = null;
      function fracAt(la, lo) {
        let bi = 0, bd = 1e18;
        for (let i = 0; i < coords.length; i++) { const d = havM(coords[i], [lo, la]); if (d < bd) { bd = d; bi = i; } }
        return clamp(cum[bi] / Dg, 0, 1);
      }
      function geoNote(t) { const n = root.querySelector('#navgeo'); if (n) n.textContent = t; }
      function startRide() {
        if (cur.playing || cur.done) return;
        cur.playing = true;
        cur.last = 0;
        if (navigator.geolocation && navigator.geolocation.watchPosition) {
          geoNote('asking your location once — then the dot is you');
          geoWatch = navigator.geolocation.watchPosition(
            (p) => {
              const f = fracAt(p.coords.latitude, p.coords.longitude);
              cur.f = f; paint(f); geoNote('live — the dot is you; it moves when you move');
              if (f >= 0.998) arrive();
            },
            () => geoNote("location refused — the ride stays put; it can't fake you"),
            { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 });
        } else geoNote("no location on this device — the ride stays put; it can't fake you");
      }
      function pause() {
        cur.playing = false;
        if (geoWatch != null) { try { navigator.geolocation.clearWatch(geoWatch); } catch (e) {} geoWatch = null; }
        if (cur.raf) cancelAnimationFrame(cur.raf);
        cur.raf = 0;
      }
      function finish(ended) {
        pause();
        cur.done = true;
        cur.ended = ended;
        cluster.classList.add('is-done');
        xBtn.innerHTML = BACK;
        xBtn.setAttribute('aria-label', 'back to the ways');
        tile.innerHTML = ic(ended ? glyphOf(o.mode) : 'pin', 28);
        const taken = ended ? doseAt(cur.f) : mid;
        const short = ended && kmTotal * cur.f < 0.1;
        swapBanner(
          `<div class="nav-b1">${ended ? 'Trip ended.' : "You're here."}</div>` +
          `<div class="nav-b2">${short ? 'under 100 m — nothing counted' : mid == null ? 'no smoke estimate for this ride' : `you breathed ${ugTxt(taken)}`}</div>`);
        if (!S.reduced && cluster.animate) cluster.animate([{ transform: 'translate3d(0,6px,0)' }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1)' });
      }
      function arrive() {
        cur.f = 1;
        paint(1);
        finish(false);
        later(openReceipt, 650);
      }
      function openReceipt() {
        const ended = cur.ended;
        const f = ended ? cur.f : 1;
        // a short phone can't hold the receipt at the 55% detent — open it at full there
        S.sheet('receipt', {
          option: o, taken: mid == null ? null : (ended ? doseAt(f) : mid),
          worst: params.worst || null, lightest: params.lightest || null, count: params.count || null,
          ended, frac: f, from, to, speed, fieldAgeS: fin(params.fieldAgeS) ? params.fieldAgeS : null,
          full: (root.clientHeight || 844) < 800,
        }, { full: (root.clientHeight || 844) < 800 });
      }
      function replay() {
        pause();
        cur.el = 0; cur.f = 0; cur.done = false; cur.ended = false; cur.seg = -1; cur.txt = {};
        cluster.classList.remove('is-done');
        xBtn.innerHTML = ic('close', 20);
        xBtn.setAttribute('aria-label', 'end the ride');
        tile.innerHTML = ic(glyphOf(o.mode), 28);
        cur.t0 = Date.now();
        paint(0, true);
        later(startRide, 450);
      }

      S.press(xBtn, () => {
        if (cur.done) { S.back(); return; }
        cur.f = clamp(cur.f || 0, 0, 1);
        finish(true);
        later(openReceipt, 280);
      });
      S.press(q('again'), replay);
      S.press(q('rcpt'), openReceipt);

      cur.t0 = Date.now();
      layout();
      // the ride starts once the push has landed
      later(startRide, 650);
      const onHide = () => pause();
      const onShow = () => { if (!cur.done) startRide(); };
      root.addEventListener('sim:hide', onHide);
      root.addEventListener('sim:show', onShow);
      const onResize = () => { if (!dead) layout(); };
      window.addEventListener('resize', onResize);

      return () => {
        dead = true;
        pause();
        timers.forEach(clearTimeout);
        window.removeEventListener('resize', onResize);
      };
    },
  });
})();
