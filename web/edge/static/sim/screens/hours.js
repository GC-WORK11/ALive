/* hours — sim-day lane · "when to go out" (mirrors Mobile/src/components/shell/PlaytimeSheet.tsx + HourArc.tsx)
   The rolling next-24 h air at a point as a curve (with its likely range), the hour arc
   beneath it (one bar per served hour in its CPCB band), the least-bad window glowing,
   a breathing now-marker, and the server's own words. Every number is /v2/playtime's —
   or, if that read is unreachable, /v2/city's next_hours[] at connaught place, said so.
   The least-bad window is the server's best_window when it names one; when it declines
   (no "clean" run) the window is computed here, honestly, from the served hours: the
   contiguous run within ~4 µg/m³ of the lightest hour — and labelled as such.
   Copy rule (app): never "don't go out" — the lighter hour is for what's optional.
   CSS prefix: .hrs- */
(() => {
  'use strict';
  const SIM = window.SIM;
  if (!SIM || typeof SIM.register !== 'function') return;

  const P = {
    explore: 'M480-440q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520q17 0 28.5 11.5T520-480q0 17-11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320ZM297-277l250-117q6-3 11-8t8-11l117-250q5-10-2.5-17.5T663-683L413-566q-6 3-11 8t-8 11L277-297q-5 10 2.5 17.5T297-277Z',
    back: 'm432-480 156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L348-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L432-480Z',
    navigate: 'M480-240 222-130q-13 5-24.5 2.5T178-138q-8-8-10.5-20t2.5-25l273-615q5-12 15.5-18t21.5-6q11 0 21.5 6t15.5 18l273 615q5 13 2.5 25T782-138q-8 8-19.5 10.5T738-130L480-240Zm-196-4 196-84 196 84-196-440-196 440Zm196-84Z',
  };
  const ico = (name, size, cls) =>
    `<svg class="${cls || ''}" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${P[name]}"/></svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fin = (v) => typeof v === 'number' && isFinite(v);
  const reduced = () => !!SIM.reduced;
  const band = (pm) => SIM.fmt.band(pm);
  const r1 = (v) => Math.round(v * 100) / 100;
  const pad = (n) => String(n).padStart(2, '0');
  let UID = 0;
  /* axis label widths, measured in the axis' own face (falls back to an estimate) */
  let mctx = null;
  function textW(s) {
    try {
      if (!mctx) mctx = document.createElement('canvas').getContext('2d');
      const fam = getComputedStyle(document.body).getPropertyValue('--font') || 'system-ui';
      mctx.font = `400 10.5px ${fam}`;
      const w = mctx.measureText(s).width;
      if (w > 0) return w;
    } catch (e) { /* estimate below */ }
    return s.length * 5.4;
  }

  function anchorOf(params) {
    const o = SIM.ORIGIN;
    const lat = fin(+params.lat) ? +params.lat : o.lat;
    const lon = fin(+params.lon) ? +params.lon : o.lon;
    const isOrigin = Math.abs(lat - o.lat) < 2e-4 && Math.abs(lon - o.lon) < 2e-4;
    const name = (params.name && String(params.name)) || (isOrigin ? o.name : null);
    return { lat, lon, name, isOrigin };
  }
  const nearLine = (a) => (a.name ? `near ${a.name}${a.isOrigin ? ' (preview)' : ''}` : `near ${a.lat.toFixed(3)}, ${a.lon.toFixed(3)}`);

  /* day words + window words — exploreShared.windowWords; an open end reads "from … onward" (dayMorningHeavyFrom) */
  const dayWord = (off) => (off <= 0 ? 'today' : off === 1 ? 'tomorrow' : `in ${off} days`);
  function windowWords(w) {
    const d0 = dayWord(w.start_day_offset || 0);
    if (w.end_label == null) return `${d0} from ${w.start_label} onward`;
    const e = w.end_day_offset == null ? w.start_day_offset || 0 : w.end_day_offset;
    return e === (w.start_day_offset || 0) ? `${d0} ${w.start_label}–${w.end_label}` : `${d0} ${w.start_label} – ${dayWord(e)} ${w.end_label}`;
  }
  function plusHour(lbl) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(lbl || ''));
    if (!m) return { label: lbl, wrap: false };
    const a = +m[1] * 60 + +m[2], b = (a + 60) % 1440;
    return { label: `${pad(Math.floor(b / 60))}:${pad(b % 60)}`, wrap: b < a };
  }

  /* ── models ── */
  function fromPlay(d) {
    return (d.hours || []).filter((h) => h && fin(h.h) && fin(h.pm25_mid)).map((h) => ({
      h: h.h, label: h.ist_label || '', day: fin(h.day_offset) ? h.day_offset : 0, mid: h.pm25_mid,
      lo: fin(h.pm25_lo) ? h.pm25_lo : null, hi: fin(h.pm25_hi) ? h.pm25_hi : null,
    }));
  }
  /* /v2/city next_hours: forecast at the city centroid (= connaught place); `start` is the forecast's naive-UTC label */
  function fromCity(c) {
    const now = new Date(Date.now() + 330 * 60000);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return ((c && c.next_hours) || []).filter((x) => x && fin(x.pm25) && x.start).map((x) => {
      const t = Date.parse(String(x.start).replace(' ', 'T') + 'Z');
      const ist = new Date(t + 330 * 60000);
      const day = Math.round((Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - today) / 86400000);
      return { h: x.h, label: `${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`, day, mid: x.pm25, lo: null, hi: null };
    }).filter((x) => isFinite(x.day));
  }
  const idxOfH = (H, h) => H.findIndex((x) => x.h === h);
  /* when the payload's field_age_s was true: its own build stamp if plausible (server caches up to
     60 s; SIM.city() up to 5 min), never later than our fetch — ages are overstated, never understated */
  function bornAt(d, fetchedAt) {
    const c = [d && d.generated_ist, d && d.generated_at].map((s) => Date.parse(s || ''));
    if (d && fin(d.ts)) c.unshift(d.ts * 1000);
    const now = Date.now();
    for (const t of c) if (fin(t) && t <= now + 5000 && now - t < 3600e3) return Math.min(t, fetchedAt);
    return fetchedAt;
  }
  function serverWindow(H, w) {
    if (!w || !fin(w.start_h)) return null;
    const ia = idxOfH(H, w.start_h);
    const ib = w.end_h == null ? H.length - 1 : idxOfH(H, w.end_h);
    if (ia < 0 || ib < ia) return null;
    return { ia, ib, mean: fin(w.pm25_mid) ? w.pm25_mid : null, start_label: w.start_label, end_label: w.end_label,
      start_day_offset: w.start_day_offset || 0, end_day_offset: w.end_day_offset, computed: false };
  }
  /* the least-bad window when the server names none: the contiguous run (≥2 h) within ~4 µg/m³
     (or 10 %) of the lightest served hour, lowest mean wins; never the whole horizon */
  function leastBad(H) {
    if (H.length < 3) return null;
    const lo = Math.min(...H.map((x) => x.mid));
    const tol = Math.max(4, 0.1 * lo);
    let best = null, a = null;
    const close = (i) => {
      if (a == null) return;
      const len = i - a;
      if (len >= 2) {
        const mean = H.slice(a, i).reduce((s, x) => s + x.mid, 0) / len;
        if (!best || mean < best.mean - 1e-9 || (Math.abs(mean - best.mean) < 1e-9 && len > best.ib - best.ia + 1)) best = { ia: a, ib: i - 1, mean };
      }
      a = null;
    };
    for (let i = 0; i < H.length; i++) {
      const ok = H[i].mid <= lo + tol;
      if (ok && a != null && H[i].h !== H[i - 1].h + 1) close(i);
      if (ok && a == null) a = i;
      if (!ok) close(i);
    }
    close(H.length);
    if (!best) { const i = H.findIndex((x) => x.mid === lo); best = { ia: i, ib: i, mean: lo }; }
    if (best.ib - best.ia + 1 >= H.length - 1) return null;
    const end = plusHour(H[best.ib].label);
    return { ia: best.ia, ib: best.ib, mean: best.mean, start_label: H[best.ia].label, end_label: end.label,
      start_day_offset: H[best.ia].day, end_day_offset: H[best.ib].day + (end.wrap ? 1 : 0), computed: true, tol };
  }
  const isFlat = (H) => {
    const m = H.map((x) => x.mid), lo = Math.min(...m), hi = Math.max(...m), mean = m.reduce((s, v) => s + v, 0) / m.length;
    return hi - lo <= Math.max(15, 0.15 * mean);
  };

  /* Fritsch–Carlson monotone cubic — never invents a peak the hours don't have */
  function mono(pts, cont) {
    const n = pts.length;
    if (!n) return '';
    if (n === 1) return `${cont ? 'L' : 'M'}${r1(pts[0].x)},${r1(pts[0].y)}`;
    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x; m[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1); }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `${cont ? 'L' : 'M'}${r1(pts[0].x)},${r1(pts[0].y)}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += `C${r1(pts[i].x + h)},${r1(pts[i].y + t[i] * h)} ${r1(pts[i + 1].x - h)},${r1(pts[i + 1].y - t[i + 1] * h)} ${r1(pts[i + 1].x)},${r1(pts[i + 1].y)}`;
    }
    return d;
  }

  const CSS = `
.hrs{padding:12px 20px 30px;color:var(--ink)}
.hrs-head{display:flex;align-items:flex-start;gap:12px}
.hrs-well{flex:none;width:34px;height:34px;border-radius:50%;background:var(--accent-wash);color:var(--accent);display:flex;align-items:center;justify-content:center;margin-top:2px}
.hrs-hcol{flex:1;min-width:0}
.hrs-title{margin:0;font:500 25px/1.15 var(--font);letter-spacing:-.4px;color:var(--ink)}
.hrs-sub{margin-top:2px;font:400 13.5px/1.3 var(--font);color:var(--ink3)}
.hrs-disc{margin-top:5px;font:400 12px/1.4 var(--font);color:var(--ink4)}
.hrs-doors{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.hrs-chip{display:inline-flex;align-items:center;gap:5px;min-height:40px;padding:0 15px;border-radius:999px;border:.5px solid rgba(22,24,29,.16);
  font:500 13px/1 var(--font);color:var(--accent-ink);background:var(--surface)}
.hrs-chip svg{display:block;flex:none}
.hrs-chip .hrs-go{transform:rotate(90deg)}
.hrs-body{margin-top:18px}
.hrs-state{padding:10px 0;font:400 14px/1.45 var(--font);color:var(--ink3)}
.hrs-honest{display:inline-block;margin:0 0 10px;padding:5px 11px;border-radius:13px;background:var(--accent-wash);font:400 12px/1.35 var(--font);color:var(--accent-ink)}
.hrs-verdict{margin:0;font:500 16.5px/1.4 var(--font);letter-spacing:-.15px;color:var(--ink)}
.hrs-card{margin-top:14px;padding:16px 16px 8px;border-radius:var(--r-card);background:var(--surface);box-shadow:0 0 0 .5px var(--ink10),var(--sh-card)}
.hrs-win-k{display:flex;align-items:center;gap:7px;font:500 12.5px/1.3 var(--font);color:var(--accent-ink)}
.hrs-win-k i{width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 3px rgba(53,97,75,.14)}
.hrs-win-v{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 12px;margin-top:5px}
.hrs-win-w{font:500 19px/1.25 var(--font);letter-spacing:-.25px;color:var(--ink);font-variant-numeric:tabular-nums}
.hrs-win-n{font:400 12.5px/1 var(--font);color:var(--ink3);white-space:nowrap}
.hrs-win-n b{font:300 27px/1 var(--font);letter-spacing:-.6px;color:var(--ink);font-variant-numeric:tabular-nums}
.hrs-win-why{margin-top:5px;font:400 12.5px/1.4 var(--font);color:var(--ink3)}
.hrs-win-flat{color:var(--ink3)}
.hrs-win-flat i{background:var(--ink4);box-shadow:0 0 0 3px rgba(22,24,29,.06)}
.hrs-win-w.hrs-flat{flex:1 1 180px;font-size:16px;line-height:1.35;letter-spacing:-.1px}
.hrs-plot{position:relative;margin-top:14px;touch-action:pan-y;cursor:crosshair}
.hrs-chart{position:relative;height:136px}
.hrs-chart>svg{position:absolute;left:0;top:0;overflow:visible}
.hrs-glow{position:absolute;top:-6px;bottom:-42px;opacity:0;pointer-events:none;will-change:opacity;
  background:linear-gradient(to top,rgba(46,120,82,.19),rgba(46,120,82,.085) 56%,rgba(46,120,82,0));
  -webkit-mask-image:linear-gradient(to right,transparent,#000 20%,#000 80%,transparent);mask-image:linear-gradient(to right,transparent,#000 20%,#000 80%,transparent)}
.hrs-glow.is-on{opacity:1}
.hrs-glow.is-breath{animation:hrs-breathe 4.4s ease-in-out infinite}
@keyframes hrs-breathe{0%,100%{opacity:1}50%{opacity:.62}}
.hrs-now{position:absolute;width:0;height:0;pointer-events:none}
.hrs-now i,.hrs-now b{position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:var(--ink)}
.hrs-now i{box-shadow:0 0 0 2.5px #fff,0 1px 6px rgba(22,24,29,.25)}
.hrs-now b{opacity:0;will-change:transform,opacity}
.hrs-now.is-live b{animation:hrs-pulse 2.6s cubic-bezier(.2,.6,.35,1) infinite}
@keyframes hrs-pulse{0%{transform:scale(1);opacity:.30}75%,100%{transform:scale(3.8);opacity:0}}
.hrs-now u{position:absolute;left:-14px;top:-26px;width:28px;text-align:center;text-decoration:none;font:500 10.5px/1 var(--font);color:var(--ink)}
.hrs-dot{position:absolute;width:9px;height:9px;margin:-4.5px 0 0 -4.5px;border-radius:50%;background:#fff;border:2px solid var(--ink);opacity:0;pointer-events:none;transition:opacity .15s}
.hrs-dot.is-on{opacity:1}
.hrs-arc{position:relative;height:38px;margin-top:4px}
.hrs-bar{position:absolute;bottom:6px;border-radius:3px 3px 2px 2px;transform-origin:50% 100%;transition:opacity .18s}
.hrs-gnd{position:absolute;bottom:0;height:3px;border-radius:1.5px}
.hrs-axis{position:relative;height:16px;margin-top:5px;font:400 10.5px/16px var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.hrs-axis span{position:absolute;top:0;white-space:nowrap}
.hrs-read{position:relative;height:20px;margin-top:8px;text-align:center;font:500 13px/20px var(--font);color:var(--ink);font-variant-numeric:tabular-nums}
.hrs-read>span{position:absolute;left:0;right:0;top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .2s}
.hrs-read .hrs-idle{font-weight:400;font-size:12px;color:var(--ink4)}
.hrs-read .hrs-val{opacity:0}
.hrs-read.is-on .hrs-val{opacity:1}
.hrs-read.is-on .hrs-idle{opacity:0}
.hrs-read em{font-style:normal;font-weight:400;color:var(--ink3)}
.hrs-basis{margin:2px 0 6px;font:400 11.5px/1.45 var(--font);color:var(--ink4)}
.hrs-lines{margin-top:16px}
.hrs-worst{margin:0;font:400 13.5px/1.45 var(--font);color:var(--ink2);font-variant-numeric:tabular-nums}
.hrs-avg{margin:4px 0 0;font:400 12.5px/1.45 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.hrs-decs{margin-top:14px;border-top:.5px solid var(--ink10)}
.hrs-dec{display:flex;flex-direction:column;gap:2px;padding:10px 0;border-bottom:.5px solid var(--ink10)}
.hrs-dec-k{font:500 12px/1.3 var(--font);color:var(--ink3)}
.hrs-dec-v{font:400 13.5px/1.45 var(--font);color:var(--ink2)}
.hrs-foot{margin:14px 0 0;font:400 11.5px/1.5 var(--font);color:var(--ink4);font-variant-numeric:tabular-nums}
.hrs-sk{position:relative;height:300px;margin-top:14px;border-radius:var(--r-card);background:var(--surface);box-shadow:0 0 0 .5px var(--ink10),var(--sh-card);overflow:hidden}
.hrs-sk::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(243,242,236,.9),transparent);transform:translateX(-100%);animation:hrs-sh 1.4s ease-in-out infinite}
@keyframes hrs-sh{to{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.hrs-glow.is-breath,.hrs-now.is-live b,.hrs-sk::after{animation:none}}
`;

  function headHTML(A) {
    return `
<header class="hrs-head">
  <div class="hrs-well">${ico('explore', 17)}</div>
  <div class="hrs-hcol">
    <h1 class="hrs-title">when to go out</h1>
    <div class="hrs-sub">${esc(nearLine(A))}</div>
    <div class="hrs-disc">rolling 24 h — now to this time tomorrow</div>
    <div class="hrs-doors">
      <button class="hrs-chip hrs-back" aria-label="back">${ico('back', 13)}back</button>
      <button class="hrs-chip hrs-sib">where to stay${ico('navigate', 11, 'hrs-go')}</button>
    </div>
  </div>
</header>`;
  }

  SIM.register('hours', {
    title: 'when to go out',
    mount(root, params) {
      SIM.css('hours', CSS);
      const A = anchorOf(params || {});
      const uid = ++UID;
      let dead = false, timer = 0, tries = 0, ro = null, hideT = 0, ageT = 0, src = null;
      const timers = new Set();
      const defer = (fn, ms) => {
        if (reduced() || !ms) { fn(); return; }
        const id = setTimeout(() => { timers.delete(id); if (!dead) fn(); }, ms);
        timers.add(id);
      };

      root.innerHTML = `<div class="hrs">${headHTML(A)}<div class="hrs-body" aria-live="polite"></div></div>`;
      const body = root.querySelector('.hrs-body');
      SIM.press(root.querySelector('.hrs-back'), () => SIM.back());
      SIM.press(root.querySelector('.hrs-sib'), () => SIM.replace('stays', { lat: A.lat, lon: A.lon, name: A.name }));
      body.innerHTML = '<p class="hrs-state">reading the field…</p><div class="hrs-sk"></div>';
      load();

      async function load() {
        const t0 = Date.now();
        const d = await SIM.api.get(`/v2/playtime?lat=${A.lat.toFixed(5)}&lon=${A.lon.toFixed(5)}`, 15000);
        if (dead) return;
        if (d && d.error && !(d.hours || []).length) {
          if (/outside|service area|delhi/i.test(String(d.error)) && !/forecast/i.test(String(d.error))) {
            body.innerHTML = '<p class="hrs-state">outside the live field — Delhi/NCR only</p>';
            return;
          }
        }
        const H = d ? fromPlay(d) : [];
        if (d && H.length >= 2) { if (tries) { tries = 0; SIM.toast('back online'); } render(H, d, 'play', bornAt(d, t0)); return; }
        /* the 24 h read failed: say so; at the preview origin, /v2/city's next 12 h (forecast at connaught
           place) can stand in — labelled — while we keep retrying */
        if (!d && tries === 0) SIM.toast("can't reach the field — retrying");
        tries++;
        if (src !== 'city') {
          const c = A.isOrigin ? await SIM.city() : null;
          if (dead) return;
          const CH = c ? fromCity(c) : [];
          if (CH.length >= 3) render(CH, c, 'city', bornAt(c, Date.now()));
          else if (src == null) {
            body.innerHTML = d && !H.length
              ? '<p class="hrs-state">no honest curve for this spot right now</p>'
              : '<p class="hrs-state">can\'t reach the field — retrying</p><div class="hrs-sk" style="opacity:.5"></div>';
          }
        }
        timer = setTimeout(load, Math.min(30000, 3000 * Math.pow(2, tries - 1)));
      }

      function render(H, d, from, fetchedAt) {
        src = from;
        clearInterval(ageT);
        if (ro) { ro.disconnect(); ro = null; }
        const play = from === 'play';
        const flat = play ? !!d.flat && !d.best_window : isFlat(H);
        let win = play ? serverWindow(H, d.best_window) : null;
        if (!win && !flat) win = leastBad(H);
        const worst = play ? serverWindow(H, d.worst_window) : null;
        const mean = play && fin(d.mean_pm25) ? d.mean_pm25 : H.reduce((s, x) => s + x.mid, 0) / H.length;
        const last = H[H.length - 1];
        const decisions = play && Array.isArray(d.decisions)
          ? d.decisions.filter((x) => x && x.line && !/^\s*indoors\b/i.test(x.line)) : [];
        const age0 = play ? (fin(d.field_age_s) ? d.field_age_s : null) : (d && fin(d.field_age_s) ? d.field_age_s : null);
        const fcAge = play && d.forecast && fin(d.forecast.age_s) ? d.forecast.age_s + Math.max(0, (Date.now() - fetchedAt) / 1000) : null;
        const conf = play && d.confidence ? ({ hi: 'high', med: 'medium', lo: 'low' }[d.confidence] || d.confidence) : null;

        const disc = root.querySelector('.hrs-disc');
        if (disc) disc.textContent = play ? 'rolling 24 h — now to this time tomorrow' : `the next ${H.length} h — the city read at connaught place`;
        const chips = [];
        if (!play) chips.push('the 24 h read isn\'t reachable — showing the city read\'s next 12 h at connaught place');
        if (play && d.sparse) chips.push(fin(d.nearest_station_km) ? `thin read — nearest monitor ~${d.nearest_station_km} km` : 'thin read — no live monitor nearby');

        const verdict = play && d.verdict ? d.verdict : null;
        const winBlock = win
          ? `<div class="hrs-win-k"><i></i>${win.computed ? 'least-bad stretch — our read, not a clean window' : 'least-bad window'}</div>
  <div class="hrs-win-v"><span class="hrs-win-w">${esc(windowWords(win))}</span>${fin(win.mean) ? `<span class="hrs-win-n">~<b class="hrs-n" data-v="${win.mean}">${Math.round(win.mean)}</b> µg/m³</span>` : ''}</div>
  <div class="hrs-win-why">for what's optional — a run, a walk, play outside</div>`
          : flat ? `<div class="hrs-win-k hrs-win-flat"><i></i>no lighter window to pick</div>
  <div class="hrs-win-v"><span class="hrs-win-w hrs-flat">${play ? 'a flat day' : 'a flat stretch'} — any hour sits about as light as the next</span>${fin(mean) ? `<span class="hrs-win-n">~<b class="hrs-n" data-v="${mean}">${Math.round(mean)}</b> µg/m³ avg</span>` : ''}</div>` : '';
        const basis = win && win.computed
          ? `<p class="hrs-basis">the field names no clean window — this stretch is our arithmetic on its curve: the hours within ~${Math.round(win.tol)} µg/m³ of the lightest served hour.</p>` : '';
        const worstLine = worst && fin(worst.mean)
          ? `<p class="hrs-worst">heaviest — ${esc(windowWords(worst))} · ~<span class="hrs-n" data-v="${worst.mean}">${Math.round(worst.mean)}</span> µg/m³</p>` : '';
        const avgLine = fin(mean) && !(flat && !win) ? `<p class="hrs-avg">${play ? `${H.length} h` : `next ${H.length} h`} avg ~<span class="hrs-n" data-v="${mean}">${Math.round(mean)}</span> µg/m³</p>` : '';
        const foot = [
          age0 != null ? '<span class="hrs-age"></span>' : '',
          fcAge != null ? `forecast fetched ${SIM.fmt.ago(fcAge)} ago` : '',
          conf ? `confidence ${esc(conf)}` : '',
        ].filter(Boolean).join(' · ');

        body.innerHTML = `
${chips.map((c) => `<div><span class="hrs-honest">${esc(c)}</span></div>`).join('')}
${verdict ? `<p class="hrs-verdict">${esc(verdict)}</p>` : ''}
<section class="hrs-card" aria-label="the next ${H.length} hours">
  ${winBlock}
  <div class="hrs-plot">
    <div class="hrs-chart"></div>
    <div class="hrs-arc"></div>
    <div class="hrs-axis"></div>
  </div>
  <div class="hrs-read" aria-live="polite"><span class="hrs-idle">touch to read an hour${H.some((x) => x.lo != null) ? ' · shading: the likely range' : ''}</span><span class="hrs-val"></span></div>
  ${basis}
</section>
<div class="hrs-lines">${worstLine}${avgLine}</div>
${decisions.length ? `<div class="hrs-decs">${decisions.map((x) => `<div class="hrs-dec"><span class="hrs-dec-k">${esc(x.label)}</span><span class="hrs-dec-v">${esc(x.line)}</span></div>`).join('')}</div>` : ''}
${foot ? `<p class="hrs-foot">${foot}</p>` : ''}`;

        const ageEl = body.querySelector('.hrs-age');
        if (ageEl) {
          const paint = () => { ageEl.textContent = `field read ${SIM.fmt.ago(age0 + (Date.now() - fetchedAt) / 1000)} ago`; };
          paint();
          ageT = setInterval(paint, 30000);
        }

        const plot = body.querySelector('.hrs-plot');
        const chart = body.querySelector('.hrs-chart');
        const arc = body.querySelector('.hrs-arc');
        const axis = body.querySelector('.hrs-axis');
        const read = body.querySelector('.hrs-read');
        const readVal = read.querySelector('.hrs-val');
        let G = null; // geometry of the last draw
        let active = false, litI = -1; // scrub state

        function draw(animate) {
          const W = Math.max(200, Math.round(chart.clientWidth));
          const GUT = 24; // right gutter for the µg/m³ gridline labels
          const PW = W - GUT;
          const CH = 136, top = 14, bot = 6;
          const h0 = H[0].h, N = last.h - h0 + 1, cw = PW / N;
          const X = (h) => (h - h0 + 0.5) * cw;
          const vmax = Math.max(...H.map((x) => (x.hi != null ? x.hi : x.mid)));
          const step = vmax <= 70 ? 20 : vmax <= 150 ? 50 : vmax <= 320 ? 100 : 200;
          const yMax = Math.max(step * 1.2, vmax * 1.08); // 0-based, fitted to the likely range's top
          const Y = (v) => top + (1 - v / yMax) * (CH - top - bot);
          G = { W, PW, cw, h0, N, X, Y };
          const gid = `hrsG${uid}`;
          const stops = H.map((x) => `<stop offset="${r1(X(x.h) / PW)}" stop-color="${band(x.mid).color}"/>`).join('');
          const grid = [];
          for (let v = step; v < yMax; v += step) {
            grid.push(`<line x1="0" x2="${PW}" y1="${r1(Y(v))}" y2="${r1(Y(v))}" stroke="rgba(22,24,29,.07)" stroke-width="1"/>
<text x="${W}" y="${r1(Y(v) + 3.5)}" text-anchor="end" fill="#6E7278" style="font:400 10px var(--font)">${v}</text>`);
          }
          grid.push(`<line x1="0" x2="${PW}" y1="${r1(Y(0))}" y2="${r1(Y(0))}" stroke="rgba(22,24,29,.10)" stroke-width="1"/>
<text x="${W}" y="${r1(Y(0) + 3.5)}" text-anchor="end" fill="#6E7278" style="font:400 10px var(--font)">0</text>`);
          let mid = '';
          const mi = H.findIndex((x, i) => i > 0 && x.day > H[i - 1].day);
          if (mi > 0) {
            const mx = r1(X(H[mi].h) - cw / 2);
            /* the day word sits low by the baseline, clear of the now-marker's label up top */
            mid = `<line x1="${mx}" x2="${mx}" y1="${top - 6}" y2="${r1(Y(0))}" stroke="rgba(22,24,29,.16)" stroke-width="1" stroke-dasharray="2 3"/>
<text x="${mx + 4}" y="${r1(Y(0) - 5)}" fill="#4A4E57" style="font:400 10px var(--font)">${esc(dayWord(H[mi].day))}</text>`;
          }
          const pts = H.map((x) => ({ x: X(x.h), y: Y(x.mid) }));
          const lineD = mono(pts);
          let ribD = '';
          if (H.every((x) => x.lo != null && x.hi != null)) {
            const up = H.map((x) => ({ x: X(x.h), y: Y(x.hi) }));
            const dn = H.map((x) => ({ x: X(x.h), y: Y(x.lo) })).reverse();
            ribD = mono(up) + mono(dn, true) + 'Z';
          }
          chart.innerHTML = `
<div class="hrs-glow"></div>
<svg width="${W}" height="${CH}" viewBox="0 0 ${W} ${CH}" aria-hidden="true">
  <defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${PW}" y2="0">${stops}</linearGradient></defs>
  ${grid.join('')}${mid}
  ${ribD ? `<path class="hrs-rib" d="${ribD}" fill="url(#${gid})" opacity=".16"/>` : ''}
  <path class="hrs-line" d="${lineD}" fill="none" stroke="url(#${gid})" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>
  <line class="hrs-scrub" x1="0" x2="0" y1="${top - 4}" y2="${r1(Y(0))}" stroke="#16181D" stroke-opacity=".28" stroke-width="1" opacity="0"/>
</svg>
<div class="hrs-now"><b></b><i></i><u>now</u></div>
<div class="hrs-dot"></div>`;
          const nowEl = chart.querySelector('.hrs-now');
          nowEl.style.left = `${r1(X(H[0].h))}px`;
          nowEl.style.top = `${r1(Y(H[0].mid))}px`;
          /* the "now" word sits above the dot unless the curve's top edge crowds it */
          if (Y(H[0].mid) < 34) nowEl.querySelector('u').style.top = '10px';
          const glow = chart.querySelector('.hrs-glow');
          if (win) {
            /* the lit column covers the window's hours fully; its soft shoulders spill half an hour each side */
            const gx = X(H[win.ia].h) - cw, gw = (H[win.ib].h - H[win.ia].h + 2) * cw;
            glow.style.left = `${r1(gx)}px`;
            glow.style.width = `${r1(gw)}px`;
          } else glow.remove();

          /* the hour arc — one bar per served hour in its band. Heights sit on the curve's own 0-based
             scale (not the day's min–max, which would blow ±1 µg of noise up into a skyline) */
          const inWin = (i) => win && i >= win.ia && i <= win.ib;
          const inWorst = (i) => worst && i >= worst.ia && i <= worst.ib;
          const bw = Math.max(3, Math.min(9, cw * 0.58));
          arc.innerHTML = H.map((x, i) => {
            const hgt = Math.max(5, Math.round(4 + 28 * Math.min(1, x.mid / yMax)));
            const left = r1(X(x.h) - bw / 2);
            const g = inWin(i) ? 'var(--accent)' : inWorst(i) ? 'var(--ink4)' : '';
            return `<i class="hrs-bar" data-i="${i}" style="left:${left}px;width:${r1(bw)}px;height:${hgt}px;background:${band(x.mid).color};opacity:${inWin(i) || !win ? 1 : 0.72}"></i>` +
              (g ? `<i class="hrs-gnd" style="left:${r1(X(x.h) - cw / 2 + 0.75)}px;width:${r1(cw - 1.5)}px;background:${g}"></i>` : '');
          }).join('');

          /* axis: now · first label, every 6 h, last label + day word — dropped where they'd collide */
          /* the right end carries its day word whenever the strip crosses a midnight */
          const cands = [{ i: 0, txt: `now · ${H[0].label}`, al: 'l' },
            { i: H.length - 1, txt: `${last.label}${last.day > 0 || last.day !== H[0].day ? ` · ${dayWord(last.day)}` : ''}`, al: 'r' }];
          for (let k = 6; k < N - 1; k += 6) { const i = idxOfH(H, h0 + k); if (i > 0) cands.push({ i, txt: H[i].label, al: 'c' }); }
          const boxes = [];
          axis.innerHTML = cands.map((c) => {
            const w = textW(c.txt), x = X(H[c.i].h);
            const l = c.al === 'l' ? 0 : c.al === 'r' ? PW - w : x - w / 2;
            if (boxes.some((b) => l < b[1] + 14 && l + w > b[0] - 14)) return '';
            boxes.push([l, l + w]);
            const pos = c.al === 'l' ? 'left:0' : c.al === 'r' ? `right:${GUT}px` : `left:${r1(x)}px;transform:translateX(-50%)`;
            return `<span style="${pos}">${esc(c.txt)}</span>`;
          }).join('');

          const line = chart.querySelector('.hrs-line'), rib = chart.querySelector('.hrs-rib');
          const bars = Array.from(arc.querySelectorAll('.hrs-bar'));
          const settle = () => {
            line.style.strokeDasharray = '';
            nowEl.classList.add('is-live');
            if (win && glow.isConnected) glow.classList.add('is-on', 'is-breath');
          };
          if (animate && !reduced() && line.animate) try {
            /* the pen draws the curve; the hour arc sweeps up under it; then the window glows and now breathes */
            const DRAW = 1150;
            line.style.strokeDasharray = '1';
            line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: DRAW, delay: 120, easing: 'cubic-bezier(.33,.08,.3,1)', fill: 'backwards' })
              .onfinish = () => { line.style.strokeDasharray = ''; };
            if (rib) rib.animate([{ opacity: 0 }, { opacity: 0.16 }], { duration: 700, delay: 420, easing: 'ease-out', fill: 'backwards' });
            bars.forEach((b) => {
              const t = 140 + (parseFloat(b.style.left) / W) * (DRAW - 120);
              b.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 560, delay: t, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
            });
            arc.querySelectorAll('.hrs-gnd').forEach((g) => g.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: DRAW + 40, fill: 'backwards' }));
            nowEl.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.18)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }],
              { duration: 520, delay: 80, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' });
            defer(() => nowEl.classList.add('is-live'), 700);
            if (win && glow.isConnected) {
              defer(() => {
                glow.animate([{ opacity: 0, transform: 'scaleY(.82)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: 760, easing: 'cubic-bezier(.32,.72,0,1)' });
                glow.style.transformOrigin = '50% 100%';
                glow.classList.add('is-on');
              }, DRAW + 60);
              defer(() => glow.classList.add('is-breath'), DRAW + 900);
            }
          } catch (e) { settle(); } else settle();
        }
        draw(true);
        let lastW = chart.clientWidth;
        if (window.ResizeObserver) {
          ro = new ResizeObserver(() => {
            const w = chart.clientWidth;
            if (Math.abs(w - lastW) > 1) { lastW = w; litI = -1; draw(false); }
          });
          ro.observe(chart);
        }

        /* scrub — a finger (or the mouse) on the curve or the arc reads that hour, honestly */
        const scrubLine = () => chart.querySelector('.hrs-scrub');
        const dot = () => chart.querySelector('.hrs-dot');
        function scrubAt(clientX) {
          if (!G) return;
          clearTimeout(hideT);
          const r = plot.getBoundingClientRect();
          const hh = G.h0 + Math.max(0, Math.min(G.N - 1, Math.floor((clientX - r.left) / G.cw)));
          let i = idxOfH(H, hh);
          if (i < 0) {
            let bd = 1e9;
            H.forEach((x, j) => { const dd = Math.abs(x.h - hh); if (dd < bd) { bd = dd; i = j; } });
          }
          if (i === litI) return;
          litI = i;
          const x = H[i];
          const sx = r1(G.X(x.h));
          const sl = scrubLine();
          sl.setAttribute('x1', sx); sl.setAttribute('x2', sx); sl.setAttribute('opacity', '1');
          const dt = dot();
          dt.style.left = `${sx}px`; dt.style.top = `${r1(G.Y(x.mid))}px`; dt.classList.add('is-on');
          arc.querySelectorAll('.hrs-bar').forEach((b) => {
            const j = +b.dataset.i;
            b.style.opacity = j === i ? '1' : '0.38';
          });
          const range = x.lo != null && x.hi != null ? ` <em>· likely ${Math.round(x.lo)}–${Math.round(x.hi)}</em>` : '';
          readVal.innerHTML = `${esc(i === 0 ? 'now' : dayWord(x.day))} ${esc(x.label)} · air ~${Math.round(x.mid)} µg/m³${range}`;
          read.classList.add('is-on');
        }
        function release() {
          active = false;
          clearTimeout(hideT);
          hideT = setTimeout(() => {
            if (dead) return;
            litI = -1;
            read.classList.remove('is-on');
            const sl = scrubLine(); if (sl) sl.setAttribute('opacity', '0');
            const dt = dot(); if (dt) dt.classList.remove('is-on');
            arc.querySelectorAll('.hrs-bar').forEach((b) => {
              const j = +b.dataset.i;
              b.style.opacity = (win && j >= win.ia && j <= win.ib) || !win ? '1' : '0.72';
            });
          }, 5000);
        }
        plot.addEventListener('pointerdown', (e) => {
          if (e.button > 0) return;
          active = true;
          scrubAt(e.clientX);
        });
        plot.addEventListener('pointermove', (e) => { if (active || e.pointerType === 'mouse') scrubAt(e.clientX); });
        plot.addEventListener('pointerup', release);
        plot.addEventListener('pointercancel', release);
        plot.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' || active) release(); });

        /* everything around the card settles in; each number counts up as its line fades in
           (never a visible stale "0" — the count starts with the reveal, under opacity 0) */
        const rise = (el, delay) => {
          if (!el || reduced() || !el.animate) return;
          el.animate([{ opacity: 0, transform: 'translate3d(0,10px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
            { duration: 460, delay, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'backwards' });
        };
        const delays = new Map();
        const stage = (el, delay) => { if (el) { delays.set(el, delay); rise(el, delay); } };
        stage(body.querySelector('.hrs-verdict'), 0);
        stage(body.querySelector('.hrs-card'), 50);
        Array.from(body.querySelectorAll('.hrs-honest,.hrs-worst,.hrs-avg,.hrs-dec,.hrs-foot')).forEach((el, i) => stage(el, 260 + i * 35));
        body.querySelectorAll('.hrs-n').forEach((el) => {
          const v = +el.dataset.v;
          let host = el.parentElement, delay = 0;
          while (host && host !== body) { if (delays.has(host)) { delay = delays.get(host); break; } host = host.parentElement; }
          const inCard = host && host.classList && host.classList.contains('hrs-card');
          if (!reduced()) el.textContent = '0';
          /* the window's number lands with the pen reaching its stretch */
          defer(() => SIM.countUp(el, v, inCard ? 1100 : 820, (n) => String(Math.round(n))), delay);
        });
      }

      return () => {
        dead = true;
        clearTimeout(timer);
        clearTimeout(hideT);
        clearInterval(ageT);
        timers.forEach((id) => clearTimeout(id));
        if (ro) ro.disconnect();
      };
    },
  });
})();
