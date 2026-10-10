/* receipt — sim-trip lane (sheet). Contract: /tmp/sim-contract.md
   The arrival receipt (Mobile/src/components/shell/ReceiptSheet.tsx): what
   the simulated ride breathed — the plan option's own dose.mid when the ride
   ran its course — counted up, its honest band on a ruler with the smokiest
   priced way marked, the comparison in the plan's real numbers, then the
   ride's stats. Calm footnote: a preview keeps nothing.
   params: {option, taken, worst:{mode,mid,label?,word?}, lightest?, count?, ended?, frac?, fieldAgeS?, speed?} */
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
    dust: 'M460-160q-32 0-59.5-16T356-220q-11-20-.5-40t32.5-20q13 0 23 8t18 18q5 7 13.5 10.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H120q-17 0-28.5-11.5T80-360q0-17 11.5-28.5T120-400h340q50 0 85 35t35 85q0 50-35 85t-85 35ZM120-560q-17 0-28.5-11.5T80-600q0-17 11.5-28.5T120-640h500q25 0 42.5-17.5T680-700q0-25-17.5-42.5T620-760q-16 0-30 7.5T568-731q-7 12-17 21.5t-24 9.5q-20 0-32.5-15t-6.5-32q14-42 50.5-67.5T620-840q58 0 99 41t41 99q0 58-41 99t-99 41H120Zm678 308q-20 9-39-2.5T740-288q0-14 9.5-23.5T771-328q14-8 21.5-22t7.5-30q0-25-17.5-42.5T740-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h620q58 0 99 41t41 99q0 42-22 76.5T798-252Z',
  };
  const ic = (n, s = 22) =>
    `<svg width="${s}" height="${s}" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="${P[n] || P.car}"/></svg>`;
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
  const OF_WORD = { car: 'the car', car_open: 'the car', bike: 'the bike', auto: 'the auto', cycle: 'cycling', walk: 'walking', bus: 'the bus', metro: 'the metro', 'metro+walk': 'the metro' };
  /* strings.ts SMOKE_FRACS + smokeFraction — "about a third of walking" when the ratio lands on one */
  const FRACS = [[2, 'half'], [3, 'a third'], [4, 'a quarter'], [5, 'a fifth'], [6, 'a sixth'], [8, 'an eighth'], [10, 'a tenth']];
  const smokeFraction = (ratio) => {
    if (!(ratio > 1)) return null;
    let best = null, bd = Infinity;
    for (const r of FRACS) { const d = Math.abs(1 / ratio - 1 / r[0]); if (d < bd) { bd = d; best = r; } }
    return best && bd <= 0.13 * (1 / best[0]) ? best[1] : null;
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const fin = (v) => typeof v === 'number' && isFinite(v);
  const ug = (v) => S.fmt.ug(v);
  const approx = (v) => (Number(v) === 0 ? '0' : '≈ ' + ug(v));
  const r1 = (n) => Math.round(n * 10) / 10;

  S.css('receipt', `
.rct{padding:0 18px}
.rct.is-full{flex:1;display:flex;flex-direction:column}
.rct.is-full .rct-main{flex:1;display:flex;flex-direction:column;justify-content:center;padding:8px 0 28px}
.rct.is-full .rct-hero{font-size:50px}
.rct-head{display:flex;align-items:center;gap:10px;min-height:34px;padding-right:44px}
.rct-title{flex:1;min-width:0;font:700 22px/1.2 var(--font);color:var(--ink);letter-spacing:-.01em}
.rct-chip{flex:none;display:flex;align-items:center;gap:5px;max-width:55%;height:30px;padding:0 11px;border-radius:999px;background:var(--surface2);
  font:500 13px/1 var(--font);color:var(--ink2);white-space:nowrap;overflow:hidden}
.rct-chip span{overflow:hidden;text-overflow:ellipsis}
.rct-eye{display:flex;align-items:center;gap:7px;margin-top:12px;font:500 13px/1.2 var(--font);color:var(--ink2)}
.rct-eye svg{color:#CF8A50}
.rct-hero{margin-top:4px;font:700 42px/1.05 var(--font);color:var(--ink);letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.rct-est{font:400 13px/1 var(--font);color:var(--ink3);letter-spacing:0;vertical-align:middle;margin-right:5px}
.rct-unit{font-size:24px;font-weight:500;color:var(--ink2);letter-spacing:0;margin-left:4px}
.rct-band{margin-top:2px;font:400 13px/1.3 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.rct-ruler{display:flex;align-items:center;gap:8px;margin-top:11px;color:var(--ink3)}
.rct-trk{position:relative;flex:1;height:6px;border-radius:3px;background:var(--hair)}
.rct-fill{position:absolute;left:0;top:0;bottom:0;min-width:2px;border-radius:3px;background:#CF8A50;transform-origin:0 50%}
.rct-wh{position:absolute;top:-2px;width:2.5px;height:10px;margin-left:-1.25px;border-radius:1.25px;background:#C05F3A}
.rct-worst{position:absolute;top:-3px;width:12px;height:12px;margin-left:-6px;border-radius:50%;border:2px solid #4A4E57;background:var(--surface)}
.rct-scale{display:flex;justify-content:space-between;margin:5px 21px 0 0;font:400 11px/1 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.rct-sub{margin-top:8px;font:400 14px/1.4 var(--font);color:var(--ink2)}
.rct-sub b{font-weight:500;color:var(--ink)}
.rct-grid{display:flex;gap:8px;margin-top:13px}
.rct-cell{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 8px;border-radius:var(--r-row);background:var(--surface2)}
.rct-cv{font:500 17px/1.2 var(--font);color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.rct-cc{font:400 11px/1.2 var(--font);color:var(--ink3)}
.rct-det{margin-top:7px;padding:0 2px;font:400 11.5px/1.4 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.rct-foot{margin-top:11px;padding-top:9px;border-top:1px solid var(--glass-line);font:400 11.5px/1.4 var(--font);color:var(--ink3)}
.rct-done{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-top:12px;border-radius:999px;background:var(--ink);
  color:var(--paper);font:700 16px/1 var(--font)}
`);

  S.register('receipt', {
    title: 'ride receipt',
    mount(root, params) {
      params = params || {};
      const o = params.option || {};
      const dose = o.dose || {};
      const mid = fin(dose.mid) ? dose.mid : null;
      const ended = params.ended === true;
      const frac = fin(params.frac) ? Math.max(0, Math.min(1, params.frac)) : ended ? 0 : 1;
      const taken = fin(params.taken) ? params.taken : (mid != null && !ended ? mid : null);
      const km = fin(o.distance_km) ? o.distance_km : null;
      const ridden = km != null ? km * frac : null;
      const etaS = fin(o.eta_s) ? o.eta_s : fin(o.duration_min) ? o.duration_min * 60 : null;
      const neverStarted = ended && (ridden == null ? frac < 0.02 : ridden < 0.1);
      // the honest band follows the ride: scaled by the share of the trip's dose actually taken
      const share = mid ? (taken != null ? taken / mid : 0) : 0;
      const bLo = fin(dose.lo) && taken != null ? dose.lo * share : null;
      const bHi = fin(dose.hi) && taken != null ? dose.hi * share : null;
      const worst = params.worst && fin(params.worst.mid) ? params.worst : null;
      const lightest = params.lightest && fin(params.lightest.mid) ? params.lightest : null;
      const base = String(o.label || MODE_WORD[o.mode] || o.mode || '').split(' · ')[0];

      const wrap = h('div', 'rct');
      const head = h('div', 'rct-head',
        `<div class="rct-title">${neverStarted ? 'ended before it really started' : ended ? 'Trip ended.' : "You're here."}</div>` +
        (base && !neverStarted ? `<div class="rct-chip">${ic(glyphOf(o.mode), 15)}<span>${esc(base)}</span></div>` : ''));
      wrap.appendChild(head);
      const reveal = [];

      if (neverStarted) {
        wrap.appendChild(h('div', 'rct-sub', 'under 100 m — nothing counted'));
      } else {
        wrap.appendChild(h('div', 'rct-eye', `${ic('dust', 15)}You breathed`));
        let numEl = null;
        if (taken == null) {
          wrap.appendChild(h('div', 'rct-sub', 'no smoke estimate for this trip'));
        } else {
          const hero = h('div', 'rct-hero', '<span class="rct-est">about</span><span class="rct-num">≈ 0</span><span class="rct-unit">µg</span>');
          numEl = hero.querySelector('.rct-num');
          wrap.appendChild(hero);
          if (bLo != null && bHi != null && bHi - bLo >= 1) {
            const lo = bLo >= 10 ? Math.round(bLo) : r1(bLo), hi = bHi >= 10 ? Math.round(bHi) : r1(bHi);
            wrap.appendChild(h('div', 'rct-band', `about ${lo}–${hi} µg`));
          }
          // the ruler: this ride's band, the smokiest priced way as a hollow ring
          const scaleMax = Math.max(bHi || 0, taken, worst ? worst.mid : 0, 1);
          const pct = (v) => Math.max(0, Math.min(100, (v / scaleMax) * 100)).toFixed(2) + '%';
          const ruler = h('div', 'rct-ruler');
          const trk = h('div', 'rct-trk');
          const fill = h('i', 'rct-fill');
          fill.style.width = pct(taken);
          trk.appendChild(fill);
          if (bLo != null && bHi != null && bHi - bLo >= 1) {
            const a = h('i', 'rct-wh'); a.style.left = pct(bLo); trk.appendChild(a);
            const b = h('i', 'rct-wh'); b.style.left = pct(bHi); trk.appendChild(b);
          }
          if (worst && !ended && worst.mid > taken * 1.02) {
            const w = h('i', 'rct-worst'); w.style.left = pct(worst.mid); trk.appendChild(w);
          }
          ruler.appendChild(trk);
          ruler.insertAdjacentHTML('beforeend', ic('dust', 13));
          wrap.appendChild(ruler);
          if (worst && !ended && worst.mid > taken * 1.02) {
            // the ring's own label — the smokiest way the plan priced
            const sc = h('div', 'rct-scale', `<span>0</span><span>smokiest way · ${esc(worst.word || MODE_WORD[worst.mode] || 'priced')} ${approx(worst.mid)} µg</span>`);
            wrap.appendChild(sc);
          }
          // the comparison — the plan's real numbers; only for a ride that ran its course
          if (!ended && worst) {
            const ratio = taken > 0.5 ? worst.mid / taken : null;
            if (ratio != null && ratio > 1.05) {
              const fr = smokeFraction(ratio);
              const n = ratio >= 10 ? Math.round(ratio) : r1(ratio);
              const isWalk = worst.mode === 'walk';
              const line = fr
                ? `about ${fr} of ${OF_WORD[worst.mode] || 'the smokiest option'}`
                : isWalk ? `about ${n}× less smoke than on foot` : `about ${n}× less smoke than by ${esc(worst.word || MODE_WORD[worst.mode] || 'the smokiest option')}`;
              wrap.appendChild(h('div', 'rct-sub', `<b>${line}</b>`));
            } else if (lightest && lightest.mid < taken * 0.95) {
              const c = params.count;
              wrap.appendChild(h('div', 'rct-sub', `the smokiest of the ${fin(c) && c > 1 ? c + ' ways' : 'ways'} priced — ${esc(lightest.word || MODE_WORD[lightest.mode] || 'the lightest')} would have been ${approx(lightest.mid)} µg`));
            }
          } else if (ended) {
            wrap.appendChild(h('div', 'rct-sub', `ended at ${Math.round(frac * 100)}% of the route — the comparison needs the whole ride`));
          }
        }

        // stats: put out · distance · time — the ride's share of the plan option
        const co2 = o.emissions && o.emissions.co2_kg && fin(o.emissions.co2_kg.mid) ? o.emissions.co2_kg : null;
        const grid = h('div', 'rct-grid');
        const cell = (v, c) => { const e = h('div', 'rct-cell', `<div class="rct-cv">${v}</div><div class="rct-cc">${c}</div>`); grid.appendChild(e); reveal.push(e); };
        if (co2) {
          const c = Math.max(0, co2.mid * frac);
          cell(co2.hi < 1 ? `${Math.round(c * 1000)} g` : `${approx(r1(c))} kg`, 'put out');
        } else cell('—', 'put out');
        if (ridden != null) cell(`${r1(ridden).toFixed(1)} km`, 'distance');
        if (etaS != null) cell(`${Math.max(1, Math.round((etaS * frac) / 60))} min`, 'time');
        wrap.appendChild(grid);
        if (co2) {
          let det;
          if (!(co2.hi > 0)) det = 'your ride put out nothing — no exhaust';
          else {
            const lo = (fin(co2.lo) ? co2.lo : co2.mid) * frac, hi = co2.hi * frac;
            det = 'estimated for this kind of ride · ' + (co2.hi < 1
              ? `${Math.round(lo * 1000)}–${Math.round(hi * 1000)} g`
              : (r1(lo) === r1(hi) ? `${r1(hi).toFixed(1)} kg` : `${r1(lo)}–${r1(hi)} kg`));
          }
          wrap.appendChild(h('div', 'rct-det', det));
        }

        // count-up once the sheet has risen
        if (numEl) setTimeout(() => S.countUp(numEl, taken, 900, (v) => approx(v)), S.reduced ? 0 : 260);
        const fillEl = wrap.querySelector('.rct-fill');
        if (fillEl && !S.reduced && fillEl.animate) fillEl.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 520, delay: 300, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
      }

      // opened at the full detent (a short phone): the reading sits centred, footnote + Done at the foot
      if (params.full === true) {
        root.style.display = 'flex';
        root.style.flexDirection = 'column';
        wrap.classList.add('is-full');
        const main = h('div', 'rct-main');
        Array.from(wrap.children).slice(1).forEach((n) => main.appendChild(n));
        wrap.appendChild(main);
      }
      const age = fin(params.fieldAgeS) ? `air map ${S.fmt.ago(params.fieldAgeS)} old` : null;
      wrap.appendChild(h('div', 'rct-foot', ['a preview ride — nothing was saved or sent', age].filter(Boolean).join(' · ')));
      const done = h('button', 'rct-done', 'Done');
      S.press(done, () => {
        // close the sheet, then leave the ride for the ways it was picked from
        S.back();
        if (S.current && S.current() === 'nav') S.back();
      });
      wrap.appendChild(done);
      root.appendChild(wrap);

      reveal.forEach((e, i) => {
        if (S.reduced || !e.animate) return;
        e.animate([{ opacity: 0, transform: 'translate3d(0,10px,0)' }, { opacity: 1, transform: 'none' }],
          { duration: 420, delay: 240 + i * 80, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
      });
      return undefined;
    },
  });
})();
