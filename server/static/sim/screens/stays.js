/* stays — sim-day lane · "where to stay" (mirrors Mobile/src/components/shell/StaysSheet.tsx)
   Lodging near a point, ranked by the next-24 h air at each stay's OWN coordinates.
   Every number is /v2/stays' — or an honest computation on it:
     row number      window_mean_ug   mean of the anchored forecast, next 24 h, at the stay
     at its door now pm25_now         the live field read at the stay
     lighter/heavier cleaner_by_ug    the anchor's live read − the stay's live read (server-computed)
     walk            dist_km          straight line at the app's 5 km/h convention (~12 min/km)
     read age        field_age_s      + the seconds since we fetched it
   Also registers 'stays-detail' (opened with SIM.sheet from a row). CSS prefix: .sty- */
(() => {
  'use strict';
  const SIM = window.SIM;
  if (!SIM || typeof SIM.register !== 'function') return;

  /* Material Symbols Rounded paths — the app's own glyph set (Mobile/src/icons.tsx) */
  const P = {
    hotel: 'M80-200q-17 0-28.5-11.5T40-240v-520q0-17 11.5-28.5T80-800q17 0 28.5 11.5T120-760v360h320v-240q0-33 23.5-56.5T520-720h240q66 0 113 47t47 113v320q0 17-11.5 28.5T880-200q-17 0-28.5-11.5T840-240v-80H120v80q0 17-11.5 28.5T80-200Zm200-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 40h320v-160q0-33-23.5-56.5T760-640H520v240ZM280-520q17 0 28.5-11.5T320-560q0-17-11.5-28.5T280-600q-17 0-28.5 11.5T240-560q0 17 11.5 28.5T280-520Zm0-40Zm240-80v240-240Z',
    back: 'm432-480 156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L348-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L432-480Z',
    navigate: 'M480-240 222-130q-13 5-24.5 2.5T178-138q-8-8-10.5-20t2.5-25l273-615q5-12 15.5-18t21.5-6q11 0 21.5 6t15.5 18l273 615q5 13 2.5 25T782-138q-8 8-19.5 10.5T738-130L480-240Zm-196-4 196-84 196 84-196-440-196 440Zm196-84Z',
  };
  const ico = (name, size, cls) =>
    `<svg class="${cls || ''}" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${P[name]}"/></svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fin = (v) => typeof v === 'number' && isFinite(v);
  const reduced = () => !!SIM.reduced;
  const band = (pm) => SIM.fmt.band(pm);
  const tilde = (v) => '~' + Math.round(v);
  const one = (v) => (Math.round(Math.abs(v) * 10) / 10).toFixed(1).replace(/\.0$/, '');

  /* the anchor — the preview has no GPS, so the fixed origin is named as such */
  function anchorOf(params) {
    const o = SIM.ORIGIN;
    const lat = fin(+params.lat) ? +params.lat : o.lat;
    const lon = fin(+params.lon) ? +params.lon : o.lon;
    const isOrigin = Math.abs(lat - o.lat) < 2e-4 && Math.abs(lon - o.lon) < 2e-4;
    const name = (params.name && String(params.name)) || (isOrigin ? o.name : null);
    return { lat, lon, name, isOrigin };
  }
  const nearLine = (a) => (a.name ? `near ${a.name}${a.isOrigin ? ' (preview)' : ''}` : `near ${a.lat.toFixed(3)}, ${a.lon.toFixed(3)}`);
  const placeWord = (a) => a.name || 'this point';

  /* the app's walk convention (StaysSheet.walkLabel): 5 km/h ≈ 12 min/km; past 2.5 km nobody walks */
  const walkLabel = (km) => (km < 2.5 ? `~${Math.max(2, Math.round(km * 12))} min walk` : `${km} km away`);
  /* localizeKind (en): a gazetteer namespace is provenance, never a word */
  const kindLabel = (k) => String(k || 'lodging').trim().toLowerCase().replace(/^[a-z]+:/, '').replace(/_/g, ' ') || 'lodging';
  /* exploreLighter / exploreHeavier / exploreSameAir — same 0.5 µg cut as the app */
  function delta(d) {
    if (!fin(d)) return null;
    if (Math.abs(d) < 0.5) return { txt: 'same air', cls: 'is-same' };
    return d > 0 ? { txt: `${one(d)} µg lighter`, cls: 'is-lighter' } : { txt: `${one(d)} µg heavier`, cls: 'is-heavier' };
  }
  const scoreOf = (r) => (fin(r.window_mean_ug) ? r.window_mean_ug : fin(r.pm25_now) ? r.pm25_now : null);

  /* motion: a damped spring sampled into WAAPI keyframes (k 230, c 20 → ζ≈0.66: one soft ~1.5 px
     settle past rest, then still — settles, never bounces) */
  function springIn(el, o) {
    o = o || {};
    if (reduced() || !el || !el.animate) return;
    const y = o.y == null ? 26 : o.y, s = o.s == null ? 0.965 : o.s, k = o.k || 230, c = o.c || 20;
    let x = 1, v = 0, t = 0;
    const dt = 1 / 120, xs = [1];
    while (t < 1.6) {
      v += (-k * x - c * v) * dt;
      x += v * dt;
      t += dt;
      xs.push(x);
      if (Math.abs(x) < 0.0008 && Math.abs(v) < 0.008) break;
    }
    const frames = [];
    for (let i = 0; i < xs.length; i += 2) {
      const q = xs[i];
      frames.push({
        transform: `translate3d(0,${(q * y).toFixed(2)}px,0) scale(${(1 - q * (1 - s)).toFixed(4)})`,
        opacity: Math.max(0, Math.min(1, (1 - q) * 1.9)),
      });
    }
    frames.push({ transform: 'translate3d(0,0,0) scale(1)', opacity: 1 });
    el.animate(frames, { duration: Math.round(t * 1000), delay: o.delay || 0, easing: 'linear', fill: 'backwards' });
  }
  function rise(el, delay, dy) {
    if (reduced() || !el || !el.animate) return;
    el.animate([{ opacity: 0, transform: `translate3d(0,${dy == null ? 12 : dy}px,0)` }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
      { duration: 460, delay: delay || 0, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'backwards' });
  }

  const CSS = `
.sty{padding:12px 20px 30px;color:var(--ink)}
.sty-head{display:flex;align-items:flex-start;gap:12px}
.sty-well{flex:none;width:34px;height:34px;border-radius:50%;background:var(--accent-wash);color:var(--accent);display:flex;align-items:center;justify-content:center;margin-top:2px}
.sty-hcol{flex:1;min-width:0}
.sty-title{margin:0;font:500 25px/1.15 var(--font);letter-spacing:-.4px;color:var(--ink)}
.sty-sub{margin-top:2px;font:400 13.5px/1.3 var(--font);color:var(--ink3)}
.sty-disc{margin-top:5px;font:400 12px/1.4 var(--font);color:var(--ink4)}
.sty-doors{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.sty-chip{display:inline-flex;align-items:center;gap:5px;min-height:40px;padding:0 15px;border-radius:999px;border:.5px solid rgba(22,24,29,.16);
  font:500 13px/1 var(--font);color:var(--accent-ink);background:var(--surface)}
.sty-chip svg{display:block;flex:none}
.sty-chip .sty-go{transform:rotate(90deg)}
.sty-body{margin-top:18px}
.sty-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;font:400 12.5px/1.35 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.sty-meta b{font-weight:500;color:var(--ink2)}
.sty-dot{width:3px;height:3px;border-radius:50%;background:var(--ink4)}
.sty-honest{display:inline-block;margin-top:10px;padding:5px 11px;border-radius:13px;background:var(--accent-wash);font:400 12px/1.35 var(--font);color:var(--accent-ink)}
.sty-top{display:flex;align-items:stretch;gap:12px;width:100%;margin-top:14px;padding:15px 16px 14px;border-radius:var(--r-card);background:var(--surface);
  box-shadow:0 0 0 .5px var(--ink10),var(--sh-card);text-align:left}
.sty-top-l{flex:1;min-width:0;display:flex;flex-direction:column}
.sty-top-r{flex:none;display:flex;flex-direction:column;align-items:flex-end;justify-content:flex-end;text-align:right}
.sty-lightest{align-self:flex-start;padding:3px 9px;border-radius:999px;background:var(--accent-wash);font:500 11.5px/1.3 var(--font);color:var(--accent-ink)}
.sty-tname{display:flex;align-items:center;gap:8px;margin-top:9px;font:500 17px/1.25 var(--font);color:var(--ink);min-width:0}
.sty-tname span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sty-big{font:300 38px/1 var(--font);letter-spacing:-1px;color:var(--ink);font-variant-numeric:tabular-nums}
.sty-tl{font-style:normal;font-weight:400;font-size:.42em;letter-spacing:0;color:var(--ink3);margin-right:2px;vertical-align:.5em}
.sty-unit{margin-top:3px;font:400 11.5px/1.2 var(--font);color:var(--ink3)}
.sty-sq{flex:none;width:8px;height:8px;border-radius:2px}
.sty-list{margin-top:6px}
.sty-row{position:relative;display:flex;align-items:center;gap:11px;width:calc(100% + 40px);margin:0 -20px;padding:12px 20px;text-align:left}
.sty-row::after{content:"";position:absolute;left:20px;right:20px;bottom:0;height:.5px;background:var(--ink10)}
.sty-row:last-child::after{display:none}
.sty-mid{flex:1;min-width:0;display:flex;flex-direction:column}
.sty-name{font:500 14.5px/1.3 var(--font);color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sty-m2{margin-top:2px;font:400 12px/1.3 var(--font);color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sty-right{flex:none;display:flex;flex-direction:column;align-items:flex-end;margin-left:8px}
.sty-pm{font:500 14.5px/1.25 var(--font);color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.sty-pm i{font-style:normal;font-weight:400;font-size:11.5px;color:var(--ink3)}
.sty-dl{margin-top:2px;font:400 11.5px/1.3 var(--font);white-space:nowrap;font-variant-numeric:tabular-nums}
.sty-dl.is-lighter{color:var(--accent-ink)} .sty-dl.is-heavier{color:var(--ink2)} .sty-dl.is-same{color:var(--ink3)}
.sty-legend{margin-top:14px;font:400 12px/1.45 var(--font);color:var(--ink3)}
.sty-hint{margin:18px 0 0;text-align:center;font:400 12px/1.4 var(--font);color:var(--ink4)}
.sty-state{padding:26px 0 10px;text-align:center;font:400 14px/1.45 var(--font);color:var(--ink3)}
.sty-sk{display:flex;align-items:center;gap:11px;height:60px;border-bottom:.5px solid var(--ink10)}
.sty-sk:last-child{border-bottom:0}
.sty-sk i{position:relative;display:block;height:10px;border-radius:5px;background:#EEECE6;overflow:hidden}
.sty-sk i::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent);transform:translateX(-100%);animation:sty-sh 1.35s ease-in-out infinite}
.sty-sk .sty-skc{flex:1;display:flex;flex-direction:column;gap:7px}
.sty-skw{opacity:.45}
@keyframes sty-sh{to{transform:translateX(100%)}}
/* ── detail sheet ── */
.sty-dt{padding:0 22px 8px;color:var(--ink)}
.sty-dt-head{display:flex;align-items:center;gap:9px;padding-right:44px}
.sty-dt-name{margin:0;font:500 21px/1.2 var(--font);letter-spacing:-.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sty-dt-sub{margin-top:4px;padding-left:17px;font:400 13px/1.35 var(--font);color:var(--ink3)}
.sty-dt-hero{display:flex;align-items:baseline;gap:10px;margin-top:20px}
.sty-dt-big{font:300 52px/1 var(--font);letter-spacing:-1.6px;font-variant-numeric:tabular-nums}
.sty-dt-u{font:400 14px/1 var(--font);color:var(--ink3)}
.sty-dt-band{margin-left:auto;align-self:center;padding:5px 11px;border-radius:999px;font:500 12.5px/1.2 var(--font)}
.sty-dt-cap{margin-top:8px;font:400 12.5px/1.45 var(--font);color:var(--ink3)}
.sty-facts{margin-top:18px;border-radius:var(--r-row);background:var(--surface2);padding:2px 14px}
.sty-fact{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:11px 0;font:400 13.5px/1.3 var(--font);color:var(--ink2)}
.sty-fact+.sty-fact{border-top:.5px solid var(--ink10)}
.sty-fact b{font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums;text-align:right}
.sty-fact b.is-lighter{color:var(--accent-ink)}
.sty-dt-note{margin:10px 2px 0;font:400 12px/1.45 var(--font);color:var(--ink3)}
.sty-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:50px;margin-top:18px;border-radius:999px;background:var(--accent);color:#fff;font:500 15.5px/1 var(--font)}
.sty-cta svg{display:block}
.sty-cta .sty-go{transform:rotate(90deg)}
@media (prefers-reduced-motion:reduce){.sty-sk i::after{animation:none}}
`;

  function headHTML(A) {
    return `
<header class="sty-head">
  <div class="sty-well">${ico('hotel', 17)}</div>
  <div class="sty-hcol">
    <h1 class="sty-title">where to stay</h1>
    <div class="sty-sub">${esc(nearLine(A))}</div>
    <div class="sty-disc">each number is the next-24 h air at that address</div>
    <div class="sty-doors">
      <button class="sty-chip sty-back" aria-label="back">${ico('back', 13)}back</button>
      <button class="sty-chip sty-sib">when to go out${ico('navigate', 11, 'sty-go')}</button>
    </div>
  </div>
</header>`;
  }

  const skeleton = (wait) => `<div class="sty-skel${wait ? ' sty-skw' : ''}" aria-hidden="true">${[0.62, 0.48, 0.7, 0.55, 0.66].map((w) =>
    `<div class="sty-sk"><i style="width:8px;height:8px;border-radius:2px"></i><div class="sty-skc"><i style="width:${Math.round(w * 100)}%"></i><i style="width:${Math.round(w * 60)}%;height:8px"></i></div><i style="width:52px"></i></div>`).join('')}</div>`;

  SIM.register('stays', {
    title: 'where to stay',
    mount(root, params) {
      SIM.css('stays', CSS);
      const A = anchorOf(params || {});
      let dead = false, timer = 0, ageT = 0, tries = 0;
      const timers = new Set();
      const defer = (fn, ms) => {
        if (reduced() || !ms) { fn(); return; }
        const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms);
        timers.add(id);
      };

      root.innerHTML = `<div class="sty">${headHTML(A)}<div class="sty-body" aria-live="polite"></div></div>`;
      const body = root.querySelector('.sty-body');
      SIM.press(root.querySelector('.sty-back'), () => SIM.back());
      SIM.press(root.querySelector('.sty-sib'), () => SIM.replace('hours', { lat: A.lat, lon: A.lon, name: A.name }));

      body.innerHTML = `<div class="sty-meta">reading the field…</div>${skeleton(false)}`;
      load();

      async function load() {
        const t0 = Date.now();
        const d = await SIM.api.get(`/v2/stays?lat=${A.lat.toFixed(5)}&lon=${A.lon.toFixed(5)}`, 15000);
        if (dead) return;
        if (!d) {
          tries++;
          if (tries === 1) SIM.toast("can't reach the field — retrying");
          body.innerHTML = `<div class="sty-meta">can't reach the field — retrying</div>${skeleton(true)}`;
          timer = setTimeout(load, Math.min(30000, 2500 * Math.pow(2, tries - 1)));
          return;
        }
        if (tries) { tries = 0; SIM.toast('back online'); }
        if (d.error) { body.innerHTML = '<div class="sty-state">outside the live field — Delhi/NCR only</div>'; return; }
        const raw = Array.isArray(d.stays) ? d.stays.filter((r) => r && r.name) : [];
        /* the gazetteer can list one property under several spellings/pins — the
           display keeps the first of each distinct stay; the source data is untouched */
        const seen = new Set(), rows = [];
        for (const r of raw) {
          const sc = scoreOf(r);
          const key = [String(r.name).trim().toLowerCase().replace(/\s+/g, ' '),
            fin(sc) ? Math.round(sc * 10) / 10 : 'x',
            fin(r.pm25_now) ? Math.round(r.pm25_now * 10) / 10 : 'x',
            fin(r.lat) ? r.lat.toFixed(3) : 'x', fin(r.lon) ? r.lon.toFixed(3) : 'x'].join('|');
          if (seen.has(key)) continue;
          seen.add(key); rows.push(r);
        }
        if (!rows.length) { body.innerHTML = '<div class="sty-state">no lodging rows within reach of the live field here</div>'; return; }
        /* the server may answer from its 60 s cache — age the field from the payload's own build
           time when it's plausible (the earlier of the two: an age is overstated, never understated) */
        const born = fin(d.ts) ? d.ts * 1000 : NaN;
        const at = fin(born) && born <= Date.now() + 5000 && Date.now() - born < 3600e3 ? Math.min(t0, born) : t0;
        /* build off the tap frame — the whole list mounts in one rAF, mid-push or not */
        requestAnimationFrame(() => { if (!dead) render(d, rows, at); });
      }

      function render(d, rows, fetchedAt) {
        const age0 = fin(d.field_age_s) ? d.field_age_s : null;
        const ageNow = () => (age0 == null ? null : age0 + (Date.now() - fetchedAt) / 1000);
        const kms = rows.map((r) => r.dist_km).filter(fin);
        const maxKm = kms.length ? Math.max(...kms) : null;
        const scored = rows.filter((r) => fin(r.window_mean_ug));
        const means = scored.map((r) => r.window_mean_ug);
        const spread = means.length > 1 ? Math.max(...means) - Math.min(...means) : null;
        const nowOnly = d.scored_h === 0;
        /* with a dead horizon every number is a live read — the next-24 h disclosure would lie (the app hides it too) */
        if (nowOnly) { const disc = root.querySelector('.sty-disc'); if (disc) disc.textContent = 'each number is the live read at that address'; }
        const anyDelta = rows.some((r) => fin(r.cleaner_by_ug));
        const top = rows[0];
        const topScored = top && top.scored_on !== 'unrated' && scoreOf(top) != null;

        const chips = [];
        if (d.sparse) chips.push(fin(d.nearest_station_km) ? `thin read — nearest monitor ~${d.nearest_station_km} km` : 'thin read — no live monitor nearby');
        if (nowOnly) chips.push('forecast down — scored on live reads only');
        if (spread != null && spread < 1 && scored.length > 2)
          chips.push(`${scored.length === rows.length ? 'all' : 'the'} ${scored.length}${scored.length === rows.length ? '' : ' scored'} sit within ${one(spread) === '0' ? '0.1' : one(spread)} µg/m³ of each other — about the same air`);

        const rowHTML = (r, i) => {
          const sc = scoreOf(r);
          const unr = r.scored_on === 'unrated' || sc == null;
          const b = band(sc);
          const dl = delta(r.cleaner_by_ug);
          const basis = r.scored_on === 'now' ? 'now · ' : '';
          const thin = r.sparse ? (fin(r.nearest_station_km) ? ` · thin read — nearest monitor ~${r.nearest_station_km} km` : ' · thin read — no live monitor nearby') : '';
          const sub = `${esc(kindLabel(r.kind))} · ${fin(r.dist_km) ? walkLabel(r.dist_km) : 'distance unknown'}${thin}`;
          if (i === 0 && topScored) {
            return `<button class="sty-top" data-i="0" aria-label="${esc(r.name)}, ${esc(kindLabel(r.kind))}">
  <div class="sty-top-l">
    <span class="sty-lightest">lightest</span>
    <span class="sty-tname"><i class="sty-sq" style="background:${b.color}"></i><span>${esc(r.name)}</span></span>
    <span class="sty-m2">${sub}</span>
  </div>
  <div class="sty-top-r">
    <span class="sty-big"><i class="sty-tl">~</i><b class="sty-n sty-nb" data-v="${sc}" style="font-weight:300">${Math.round(sc)}</b></span>
    <span class="sty-unit">µg/m³ · ${nowOnly || r.scored_on === 'now' ? 'now' : 'next 24 h'}</span>
    ${dl ? `<span class="sty-dl ${dl.cls}">${basis}${dl.txt}</span>` : ''}
  </div>
</button>`;
          }
          return `<button class="sty-row sim-hl" data-i="${i}" aria-label="${esc(r.name)}, ${esc(kindLabel(r.kind))}">
  <i class="sty-sq" style="background:${unr ? 'var(--ink4)' : b.color}"></i>
  <span class="sty-mid"><span class="sty-name">${esc(r.name)}</span><span class="sty-m2">${sub}</span></span>
  <span class="sty-right">
    <span class="sty-pm">${unr ? 'no honest read' : `<b class="sty-n" data-v="${sc}" style="font-weight:500">${tilde(sc)}</b><i> µg/m³</i>`}</span>
    ${dl && !unr ? `<span class="sty-dl ${dl.cls}">${basis}${dl.txt}</span>` : ''}
  </span>
</button>`;
        };

        const legend = anyDelta && fin(d.anchor_pm25_now)
          ? `<p class="sty-legend">lighter / heavier compares each stay's air now with ${esc(placeWord(A))}'s, ~${Math.round(d.anchor_pm25_now)} µg/m³ right now.</p>` : '';
        body.innerHTML = `
<div class="sty-meta"><span><b>${rows.length}</b> stays${maxKm != null ? ` within <b>${maxKm}</b> km` : ''}</span><i class="sty-dot"></i><span class="sty-age"></span></div>
${chips.map((c) => `<div><span class="sty-honest">${esc(c)}</span></div>`).join('')}
${topScored ? rowHTML(top, 0) : ''}
<div class="sty-list">${rows.map((r, i) => (i === 0 && topScored ? '' : rowHTML(r, i))).join('')}</div>
${legend}
<p class="sty-hint">tap a stay for its door-level read</p>`;

        const ageEl = body.querySelector('.sty-age');
        const paintAge = () => { const a = ageNow(); ageEl.textContent = a == null ? 'read age unknown' : `field read ${SIM.fmt.ago(a)} ago`; };
        paintAge();
        ageT = setInterval(paintAge, 30000);

        /* tap → the stay's detail sheet (wired before any motion, so motion can never cost a tap) */
        body.querySelectorAll('[data-i]').forEach((el) => {
          const r = rows[+el.dataset.i];
          SIM.press(el, () => SIM.sheet('stays-detail', {
            stay: r, anchor: A, anchorNow: d.anchor_pm25_now, nowOnly,
            age: age0 == null ? null : { s: age0, t: fetchedAt },
          }));
        });

        /* entrance: the meta settles first, the lightest stay springs into place, the rest stagger in 35 ms apart */
        const meta = body.querySelector('.sty-meta');
        rise(meta, 0, 6);
        body.querySelectorAll('.sty-honest').forEach((c) => rise(c, 60, 6));
        const topEl = body.querySelector('.sty-top');
        if (topEl) springIn(topEl, { delay: 90 });
        const list = Array.from(body.querySelectorAll('.sty-row'));
        list.forEach((el, i) => rise(el, 190 + i * 35));
        const tail = body.querySelectorAll('.sty-legend,.sty-hint');
        tail.forEach((el) => rise(el, 190 + list.length * 35 + 60, 6));

        /* count-ups land with their row (the count starts under the row's fade, never a visible stale 0) */
        body.querySelectorAll('.sty-n').forEach((el) => {
          const v = +el.dataset.v;
          const row = el.closest('[data-i]');
          const i = row ? +row.dataset.i : 0;
          const delay = row && row.classList.contains('sty-top') ? 90 : 190 + Math.max(0, list.indexOf(row)) * 35;
          const f = el.classList.contains('sty-nb') ? (n) => String(Math.round(n)) : tilde;
          if (!reduced()) el.textContent = f(0);
          defer(() => SIM.countUp(el, v, i === 0 ? 1000 : 820, f), delay);
        });
      }

      return () => {
        dead = true;
        clearTimeout(timer);
        clearInterval(ageT);
        timers.forEach((id) => clearTimeout(id));
      };
    },
  });

  /* ── the stay's detail sheet ─────────────────────────────────────────── */
  SIM.register('stays-detail', {
    title: 'stay',
    mount(root, params) {
      SIM.css('stays', CSS);
      params = params || {};
      const r = params.stay;
      if (!r) { root.innerHTML = '<div class="sty-state">this stay has no read to show</div>'; return undefined; }
      const A = params.anchor || anchorOf({});
      const sc = scoreOf(r);
      const unr = r.scored_on === 'unrated' || sc == null;
      const onNow = r.scored_on === 'now' || params.nowOnly;
      const b = band(sc);
      const dl = delta(r.cleaner_by_ug);
      const age = params.age;
      const ageNow = () => (age && fin(age.s) ? age.s + (Date.now() - age.t) / 1000 : null);
      const kind = kindLabel(r.kind);
      const walk = fin(r.dist_km) ? walkLabel(r.dist_km) : null;

      const facts = [];
      if (fin(r.pm25_now)) facts.push(['at its door now', `~${SIM.fmt.ug(r.pm25_now)} µg/m³`, '']);
      if (dl) facts.push([`vs ${placeWord(A)} now`, dl.txt, dl.cls === 'is-lighter' ? 'is-lighter' : '']);
      if (fin(r.dist_km)) facts.push(['walk', `${walk.replace(/ walk$/, '')} · ${r.dist_km} km`, '']);
      /* confidence is said as its basis — the server grades no stay, it says how near a live monitor is */
      if (fin(r.nearest_station_km)) facts.push(['confidence', r.sparse ? `thin read — monitor ~${r.nearest_station_km} km` : `live monitor ~${r.nearest_station_km} km away`, '']);
      else if (r.sparse) facts.push(['confidence', 'thin read — no live monitor nearby', '']);
      if (age && fin(age.s)) facts.push(['field read', '', 'sty-age']);

      const cap = unr ? 'the field can\'t read this address honestly right now'
        : onNow ? 'scored on the live read only — the forecast is down'
          : `the next-24 h air at this address — the mean of ${fin(r.n_hours) ? r.n_hours : 24} forecast hours`;
      const note = dl && fin(params.anchorNow) && fin(r.pm25_now)
        ? `the gap compares live reads: ~${SIM.fmt.ug(r.pm25_now)} µg/m³ at this door against ~${SIM.fmt.ug(params.anchorNow)} at ${esc(placeWord(A))}. walk time is the straight line at 5 km/h.`
        : fin(r.dist_km) ? 'walk time is the straight line at 5 km/h.' : '';

      root.innerHTML = `
<div class="sty-dt">
  <div class="sty-dt-head"><i class="sty-sq" style="background:${unr ? 'var(--ink4)' : b.color}"></i><h2 class="sty-dt-name">${esc(r.name)}</h2></div>
  <div class="sty-dt-sub">${esc(kind)}${walk ? ` · ${walk}` : ''}</div>
  <div class="sty-dt-hero">
    ${unr ? '<span class="sty-dt-u" style="font-size:16px">no honest read</span>'
      : `<span class="sty-dt-big"><i class="sty-tl">~</i><b class="sty-n" style="font-weight:300">${Math.round(sc)}</b></span><span class="sty-dt-u">µg/m³</span>
    <span class="sty-dt-band" style="background:${b.wash};color:${b.ink}">${esc(b.name)}</span>`}
  </div>
  <div class="sty-dt-cap">${esc(cap)}</div>
  ${facts.length ? `<div class="sty-facts">${facts.map((f) => `<div class="sty-fact"><span>${esc(f[0])}</span><b class="${f[2]}">${esc(f[1])}</b></div>`).join('')}</div>` : ''}
  ${note ? `<p class="sty-dt-note">${note}</p>` : ''}
  <button class="sty-cta">when to go out from here${ico('navigate', 15, 'sty-go')}</button>
</div>`;

      const ageEl = root.querySelector('.sty-age');
      let ageT = 0;
      if (ageEl) {
        const paint = () => { const a = ageNow(); ageEl.textContent = a == null ? '—' : `${SIM.fmt.ago(a)} ago`; };
        paint();
        ageT = setInterval(paint, 30000);
      }
      const n = root.querySelector('.sty-n');
      const whole = (v) => String(Math.round(v));
      if (n && sc != null) { if (!reduced()) n.textContent = '0'; SIM.countUp(n, sc, 900, whole); }
      root.querySelectorAll('.sty-fact').forEach((el, i) => rise(el, 120 + i * 35, 8));
      rise(root.querySelector('.sty-cta'), 160 + facts.length * 35, 8);
      SIM.press(root.querySelector('.sty-cta'), () => SIM.push('hours', { lat: r.lat, lon: r.lon, name: r.name }));
      return () => clearInterval(ageT);
    },
  });
})();
