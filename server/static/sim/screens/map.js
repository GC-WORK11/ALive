/* map — sim-core. The live air field (/grid cells) over the NCR district borders (/ncr.geojson),
   live monitor positions (/v2/city field.stations), drag to pan, pinch / wheel to zoom, tap for a
   readout (cell pm2.5 + band + confidence, the top line of /v2/why at that point, both ages).
   Mirrors the app's air-map chrome: the glass legend card ("the air map · N live stations ·
   redder = worse air right now · good → severe · air reading: N min old") + a locate button.
   Needs SIM._core (screens/home.js, same lane). */
(() => {
  'use strict';
  const S = window.SIM;
  if (!S) return;

  S.css('map', `
.mp{position:absolute;inset:0;overflow:hidden;background:#F1EFE9}
.mp-cv{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab;opacity:0;transition:opacity .6s ease}
.mp-cv.on{opacity:1}
.mp-cv.is-grab{cursor:grabbing}
.mp-top{position:absolute;left:12px;right:12px;top:calc(max(var(--sim-top),8px) + 6px);display:flex;align-items:flex-start;gap:10px;pointer-events:none}
.mp-top>*{pointer-events:auto}
.mp-legend{flex:1;min-width:0;padding:11px 14px 11px;border-radius:18px;background:var(--glass);
  box-shadow:0 0 0 .5px var(--ink10),var(--sh-float);-webkit-backdrop-filter:blur(12px) saturate(1.3);backdrop-filter:blur(12px) saturate(1.3)}
.mp-lg-r1{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.mp-lg-r1 b{font:500 15px/20px var(--font);color:var(--ink)}
.mp-lg-r1 span{font:400 12.5px/18px var(--font);color:var(--ink3);white-space:nowrap;font-variant-numeric:tabular-nums}
.mp-lg-r2{margin-top:3px;font:400 14px/19px var(--font);color:var(--ink2)}
.mp-lg-r3{display:flex;align-items:center;gap:8px;margin-top:6px;font:400 12.5px/17px var(--font);color:var(--ink3);font-variant-numeric:tabular-nums;white-space:nowrap}
.mp-lg-r3 .mp-age{margin-left:auto}
.mp-dots{display:flex;gap:3px}
.mp-dots i{display:block;width:8px;height:8px;border-radius:50%}
.mp-fab{position:absolute;right:14px;bottom:calc(var(--sim-bot) + 18px);width:48px;height:48px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;background:var(--glass-faint);color:var(--ink);box-shadow:0 0 0 .5px var(--ink10),var(--sh-float);
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);transition:transform .45s var(--ease),opacity .3s ease}
.mp-hint{position:absolute;left:50%;bottom:calc(var(--sim-bot) + 28px);transform:translate3d(-50%,0,0);padding:9px 14px;border-radius:999px;
  background:rgba(22,24,29,.86);color:#fff;font:500 13px/1 var(--font);white-space:nowrap;pointer-events:none;
  transition:opacity .35s ease,transform .45s var(--ease)}
.mp-hint.off{opacity:0;transform:translate3d(-50%,10px,0)}
.mp-note{position:absolute;left:0;right:0;top:50%;text-align:center;font:400 14px/20px var(--font);color:var(--ink3);pointer-events:none}
.mp-card{position:absolute;left:10px;right:10px;bottom:calc(var(--sim-bot) + 10px);padding:16px 18px 15px;border-radius:22px;background:#FFFFFF;
  box-shadow:0 0 0 .5px var(--ink10),0 14px 40px rgba(59,52,35,.18);
  transform:translate3d(0,calc(100% + 40px),0);transition:transform .5s cubic-bezier(.2,.9,.25,1);touch-action:none}
.mp-card.on{transform:none}
.mp-card.is-drag{transition:none}
.mp-grab{position:absolute;left:50%;top:6px;width:36px;height:4px;margin-left:-18px;border-radius:2px;background:rgba(22,24,29,.14)}
.mp-x{position:absolute;right:8px;top:8px;width:40px;height:40px;border-radius:50%;background:var(--surface2);color:var(--ink2);display:flex;align-items:center;justify-content:center}
.mp-c1{display:flex;align-items:baseline;gap:6px;padding-right:36px;flex-wrap:wrap}
.mp-c-dot{align-self:center;flex:none;width:10px;height:10px;border-radius:50%;margin-right:2px}
.mp-c-v{font:500 30px/34px var(--font);letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.mp-c-u{font:400 14px/1 var(--font);color:var(--ink3)}
.mp-c-b{font:500 20px/26px var(--font)}
.mp-c2{margin-top:4px;font:400 13px/18px var(--font);color:var(--ink2)}
.mp-c3{margin-top:2px;font:400 13px/18px var(--font);color:var(--ink3)}
.mp-c4{margin-top:11px;padding-top:11px;border-top:.5px solid var(--hair)}
.mp-c4 small{display:block;font:500 12.5px/17px var(--font);color:var(--ink3)}
.mp-c4 p{margin:3px 0 0;font:400 15px/21px var(--font);color:var(--ink2);min-height:21px}
.mp-c5{margin-top:8px;font:400 12.5px/17px var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.mp-swap{animation:mp-swap .32s ease}
@keyframes mp-swap{from{opacity:.25}to{opacity:1}}
.mp-skel{display:inline-block;width:70%;height:12px;border-radius:6px;background:rgba(22,24,29,.07);animation:mp-sk 1s ease-in-out infinite alternate;vertical-align:middle}
@keyframes mp-sk{from{opacity:.5}to{opacity:1}}
@media (prefers-reduced-motion:reduce){.mp-card,.mp-hint,.mp-fab,.mp-cv{transition:none}.mp-swap,.mp-skel{animation:none}}`);

  const BAND_HEX = ['#6E93AE', '#C7A34F', '#CF8A50', '#C05F3A', '#A83D30', '#6E2D28'];
  const X_SVG = '<svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  function inRing(ring, x, y) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
    }
    return inside;
  }
  function districtAt(gj, lon, lat) {
    if (!gj || !Array.isArray(gj.features)) return null;
    let best = null;
    for (const f of gj.features) {
      const g = f && f.geometry;
      if (!g) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys) {
        if (poly && poly[0] && inRing(poly[0], lon, lat)) {
          // the smallest containing polygon wins (Noida sits inside Gautam Buddha Nagar)
          const n = poly[0].length;
          if (!best || n < best.n) best = { name: (f.properties && f.properties.name) || null, n };
        }
      }
    }
    return best && best.name;
  }
  const kmBetween = (a, b) => {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const cleanName = (n) => String(n || '').replace(/,\s*Delhi.*$/i, '').replace(/,\s*India$/i, '').trim();

  S.register('map', {
    title: 'the air map',
    mount(root) {
      const C = S._core;
      root.classList.add('sim-bleed');
      root.style.overflow = 'hidden';
      root.dataset.sb = 'static';
      if (!C) { root.innerHTML = '<div class="sim-fail">the air map lives in the app.</div>'; return; }
      root.innerHTML = `
<div class="mp">
  <canvas class="mp-cv" role="img" aria-label="live air map of Delhi NCR — drag to pan, tap for a reading"></canvas>
  <div class="mp-note">reading the field…</div>
  <div class="mp-top">
    <div class="mp-back"></div>
    <div class="mp-legend">
      <div class="mp-lg-r1"><b>the air map</b><span class="mp-st"></span></div>
      <div class="mp-lg-r2">redder = worse air right now</div>
      <div class="mp-lg-r3"><span class="mp-dots">${BAND_HEX.map((c) => `<i style="background:${c}"></i>`).join('')}</span><span>good → severe</span><span class="mp-age"></span></div>
    </div>
  </div>
  <div class="mp-hint off">tap anywhere for a reading</div>
  <button class="mp-fab" type="button" aria-label="back to ${C.esc(S.ORIGIN.name)}">${C.icon('locate', 22)}</button>
  <div class="mp-card" role="dialog" aria-label="air reading" aria-hidden="true">
    <div class="mp-grab"></div>
    <button class="mp-x" type="button" aria-label="close">${X_SVG}</button>
    <div class="mp-cbody"></div>
  </div>
</div>`;
      const $ = (s) => root.querySelector(s);
      const cv = $('.mp-cv'), note = $('.mp-note'), stEl = $('.mp-st'), ageEl = $('.mp-age');
      const hint = $('.mp-hint'), fab = $('.mp-fab'), card = $('.mp-card'), cbody = $('.mp-cbody');
      const back = S.backButton({ glass: true });
      $('.mp-back').replaceWith(back);

      let alive = true, raf = 0, dirty = true;
      let W = 0, H = 0, dpr = 1;
      const mountT = performance.now();
      let L = null, ncr = null, borders = null, city = null, labels = [], sites = [], chromeBoxes = [];
      function setSites() {
        const st = city && city.field && Array.isArray(city.field.stations) ? city.field.stations : [];
        sites = [];
        for (const s of st) {
          const p = { lat: Number(s.lat), lon: Number(s.lon), name: cleanName(s.name) };
          if (!isFinite(p.lat) || !isFinite(p.lon)) continue;
          if (!sites.some((q) => kmBetween(p, q) < 0.35)) sites.push(p);
        }
      }
      function measureChrome() {
        const r0 = cv.getBoundingClientRect();
        chromeBoxes = ['.mp-top', '.mp-fab'].map((s) => root.querySelector(s)).filter(Boolean).map((el) => {
          const r = el.getBoundingClientRect();
          return [r.left - r0.left - 4, r.top - r0.top - 4, r.right - r0.left + 4, r.bottom - r0.top + 4];
        });
      }
      const view = { cx: 77.15, cy: 28.615, k: 800 };
      let kMin = 200, kMax = 6000, fitted = false;
      let pin = null; // {lon, lat, color}

      /* ── sizing + drawing ── */
      function resize() {
        const r = cv.getBoundingClientRect();
        W = Math.max(1, r.width); H = Math.max(1, r.height);
        dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        measureChrome();
        if (L) {
          kMin = (W / ((L.lon1 - L.lon0) * C.COS)) * 0.92;
          kMax = kMin * 9;
          if (!fitted) { view.k = Math.max(kMin, W / (0.62 * C.COS)); fitted = true; }
          view.k = Math.min(kMax, Math.max(kMin, view.k));
        }
        dirty = true; loop();
      }
      function clampView() {
        if (!L) return;
        view.k = Math.min(kMax, Math.max(kMin, view.k));
        // keep the field on screen: a small overscroll past its edge, centred when it's smaller than the view
        const m = 36; // px of paper allowed past the field's edge
        const hx = Math.max(0, W / 2 - m) / (C.COS * view.k), hy = Math.max(0, H / 2 - m) / view.k;
        const ax = L.lon0 + hx, bx = L.lon1 - hx, ay = L.lat0 + hy, by = L.lat1 - hy;
        view.cx = ax <= bx ? Math.min(bx, Math.max(ax, view.cx)) : (L.lon0 + L.lon1) / 2;
        view.cy = ay <= by ? Math.min(by, Math.max(ay, view.cy)) : (L.lat0 + L.lat1) / 2;
      }
      function draw() {
        const ctx = cv.getContext('2d');
        C.paint(ctx, W, H, dpr, view, L, borders, { line: 1, halo: 3, ink: 'rgba(22,24,29,.32)', base: '#F1EFE9' });
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineJoin = 'round';
        const taken = chromeBoxes.slice();
        if (cardOpen) taken.push([card.offsetLeft, card.offsetTop - 50, card.offsetLeft + card.offsetWidth, card.offsetTop + card.offsetHeight]);
        const hit = (box) => taken.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]));
        // live monitors (the feed lists some sites twice — once per network; one dot per site)
        for (const s of sites) {
          const [x, y] = C.project(view, W, H, s.lon, s.lat);
          if (x < -6 || x > W + 6 || y < -6 || y > H + 6) continue;
          ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fillStyle = 'rgba(250,250,247,.9)'; ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, 2.1, 0, Math.PI * 2); ctx.fillStyle = 'rgba(22,24,29,.62)'; ctx.fill();
        }
        // the preview origin, labelled
        {
          const [x, y] = C.project(view, W, H, S.ORIGIN.lon, S.ORIGIN.lat);
          ctx.beginPath(); ctx.arc(x, y, 8.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(250,250,247,.9)'; ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, 4.6, 0, Math.PI * 2); ctx.fillStyle = '#16181D'; ctx.fill();
          ctx.font = '500 12px Satoshi, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.strokeStyle = 'rgba(250,250,247,.92)'; ctx.lineWidth = 3.6;
          ctx.strokeText(S.ORIGIN.name, x + 13, y); ctx.fillStyle = '#16181D'; ctx.fillText(S.ORIGIN.name, x + 13, y);
          taken.push([x - 10, y - 10, x + 17 + ctx.measureText(S.ORIGIN.name).width, y + 10]);
        }
        // the tapped point
        if (pin) {
          const [x, y] = C.project(view, W, H, pin.lon, pin.lat);
          ctx.save();
          ctx.shadowColor = 'rgba(22,24,29,.25)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
          ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
          ctx.restore();
          ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = pin.color; ctx.fill();
          taken.push([x - 12, y - 12, x + 12, y + 12]);
        }
        // district names last — greedy, no overlaps, never under the floating chrome
        if (labels.length) {
          ctx.font = '500 11.5px Satoshi, system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (const lb of labels) {
            const [x, y] = C.project(view, W, H, lb.lon, lb.lat);
            if (x < -40 || x > W + 40 || y < -20 || y > H + 20) continue;
            const w = ctx.measureText(lb.name).width + 8, h = 16;
            const box = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
            if (box[0] < 2 || box[2] > W - 2 || box[1] < 2 || box[3] > H - 2 || hit(box)) continue;
            taken.push(box);
            ctx.strokeStyle = 'rgba(250,250,247,.88)'; ctx.lineWidth = 3.2;
            ctx.strokeText(lb.name, x, y);
            ctx.fillStyle = 'rgba(74,78,87,.94)';
            ctx.fillText(lb.name, x, y);
          }
        }
      }
      function loop() {
        if (raf || !alive) return;
        raf = requestAnimationFrame(frame);
      }
      function frame(t) {
        raf = 0;
        if (!alive) return;
        let more = false;
        if (fling) more = stepFling(t) || more;
        if (tween) more = stepTween(t) || more;
        if (dirty) { dirty = false; draw(); }
        if (more) loop();
      }

      /* ── gestures: pan (1 pointer), pinch (2), wheel zoom, tap → readout ── */
      const pts = new Map();
      let ref = null, tapCand = null, samples = [], fling = null, tween = null, multi = false;
      const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      const centroid = () => { let x = 0, y = 0; pts.forEach((p) => { x += p[0]; y += p[1]; }); return [x / pts.size, y / pts.size]; };
      const spread = (c) => { let s = 0; pts.forEach((p) => { s += Math.hypot(p[0] - c[0], p[1] - c[1]); }); return s / pts.size; };
      function rebase() { ref = pts.size ? { c: centroid(), s: spread(centroid()) } : null; }
      function moveTo(lon, lat, x, y) {
        view.cx = lon - (x - W / 2) / (C.COS * view.k);
        view.cy = lat + (y - H / 2) / view.k;
      }
      function zoomAt(x, y, f) {
        const [lon, lat] = C.unproject(view, W, H, x, y);
        view.k = Math.min(kMax, Math.max(kMin, view.k * f));
        moveTo(lon, lat, x, y);
        clampView(); dirty = true; loop();
      }
      cv.addEventListener('pointerdown', (e) => {
        if (!L) return;
        const [x, y] = local(e);
        // the left edge belongs to the shell's swipe-back
        if (e.clientX - root.getBoundingClientRect().left < 26) return;
        try { cv.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
        pts.set(e.pointerId, [x, y]);
        fling = null; tween = null;
        if (pts.size === 1) { multi = false; tapCand = { x, y, t: performance.now() }; samples = [{ t: performance.now(), x, y }]; }
        else { multi = true; tapCand = null; }
        cv.classList.add('is-grab');
        rebase();
      });
      cv.addEventListener('pointermove', (e) => {
        if (!pts.has(e.pointerId)) return;
        const p = local(e);
        pts.set(e.pointerId, p);
        if (tapCand && Math.hypot(p[0] - tapCand.x, p[1] - tapCand.y) > 7) tapCand = null;
        const c = centroid(), s = spread(c);
        if (ref) {
          const [lon, lat] = C.unproject(view, W, H, ref.c[0], ref.c[1]);
          if (pts.size > 1 && ref.s > 4) view.k = Math.min(kMax, Math.max(kMin, view.k * (s / ref.s)));
          moveTo(lon, lat, c[0], c[1]);
          clampView();
          dirty = true; loop();
        }
        ref = { c, s };
        if (pts.size === 1) {
          const now = performance.now();
          samples.push({ t: now, x: c[0], y: c[1] });
          while (samples.length > 2 && now - samples[0].t > 90) samples.shift();
        }
      });
      const up = (e) => {
        if (!pts.has(e.pointerId)) return;
        pts.delete(e.pointerId);
        if (pts.size) { rebase(); samples = []; return; }
        cv.classList.remove('is-grab');
        ref = null;
        if (tapCand && e.type === 'pointerup' && performance.now() - tapCand.t < 450 && !multi) {
          readout(tapCand.x, tapCand.y);
          tapCand = null;
          return;
        }
        tapCand = null;
        if (!multi && samples.length > 1 && !S.reduced) {
          const a = samples[0], b = samples[samples.length - 1], dt = Math.max(1, b.t - a.t);
          const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
          if (Math.hypot(vx, vy) > 0.15 && performance.now() - b.t < 60) { fling = { vx, vy, t: 0 }; loop(); }
        }
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', (e) => {
        if (!L) return;
        e.preventDefault();
        const [x, y] = local(e);
        const d = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        zoomAt(x, y, Math.exp(-d * 0.0016));
      }, { passive: false });
      function stepFling(t) {
        if (!fling) return false;
        if (!fling.t) { fling.t = t; return true; }
        const dt = Math.min(34, t - fling.t); fling.t = t;
        view.cx -= (fling.vx * dt) / (C.COS * view.k);
        view.cy += (fling.vy * dt) / view.k;
        clampView();
        const dec = Math.pow(0.9965, dt);
        fling.vx *= dec; fling.vy *= dec;
        dirty = true;
        if (Math.hypot(fling.vx, fling.vy) < 0.02) { fling = null; return false; }
        return true;
      }
      function flyTo(cx, cy, k, ms = 650) {
        fling = null;
        if (S.reduced) { view.cx = cx; view.cy = cy; view.k = k; clampView(); dirty = true; loop(); return; }
        tween = { from: { ...view }, to: { cx, cy, k }, t0: 0, ms };
        loop();
      }
      function stepTween(t) {
        if (!tween) return false;
        if (!tween.t0) tween.t0 = t;
        const p = Math.min(1, (t - tween.t0) / tween.ms);
        const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const f = tween.from, g = tween.to;
        view.k = f.k * Math.pow(g.k / f.k, e);
        view.cx = f.cx + (g.cx - f.cx) * e;
        view.cy = f.cy + (g.cy - f.cy) * e;
        dirty = true;
        if (p >= 1) { tween = null; clampView(); return false; }
        return true;
      }
      S.press(fab, () => flyTo(S.ORIGIN.lon, S.ORIGIN.lat - 0.012, Math.max(kMin, W / (0.32 * C.COS))));

      /* ── readout card ── */
      let readSeq = 0, cardOpen = false;
      function fieldAge() { return L && L.epoch ? S.fmt.ago(Date.now() / 1000 - L.epoch) : null; }
      function openCard() {
        if (cardOpen) return;
        cardOpen = true;
        card.setAttribute('aria-hidden', 'false');
        card.classList.add('on');
        hint.classList.add('off');
        requestAnimationFrame(() => { fab.style.transform = `translate3d(0,${-(card.offsetHeight + 8)}px,0)`; });
      }
      function closeCard() {
        if (!cardOpen) return;
        cardOpen = false;
        card.classList.remove('on');
        card.setAttribute('aria-hidden', 'true');
        fab.style.transform = '';
        pin = null; dirty = true; loop();
        readSeq++;
      }
      S.press($('.mp-x'), closeCard);
      // drag the card down to dismiss
      (() => {
        let y0 = null, dy = 0, pid = null;
        card.addEventListener('pointerdown', (e) => {
          if (e.target.closest('.mp-x')) return;
          y0 = e.clientY; dy = 0; pid = e.pointerId;
          try { card.setPointerCapture(pid); } catch (er) { /* fine */ }
        });
        card.addEventListener('pointermove', (e) => {
          if (y0 == null || e.pointerId !== pid) return;
          dy = Math.max(-8, e.clientY - y0);
          if (Math.abs(dy) > 3) { card.classList.add('is-drag'); card.style.transform = `translate3d(0,${dy < 0 ? dy * 0.3 : dy}px,0)`; }
        });
        const end = () => {
          if (y0 == null) return;
          y0 = null;
          card.classList.remove('is-drag');
          card.style.transform = '';
          if (dy > 60) closeCard();
          dy = 0;
        };
        card.addEventListener('pointerup', end);
        card.addEventListener('pointercancel', end);
      })();

      function readout(x, y) {
        const [lon, lat] = C.unproject(view, W, H, x, y);
        const cell = C.cellAt(L, lon, lat);
        const seq = ++readSeq;
        if (!cell) {
          pin = { lon, lat, color: '#A6ACB8' };
          cbody.innerHTML = `<div class="mp-c1"><span class="mp-c-b" style="color:var(--ink2)">outside the air map — no read here</span></div>` +
            `<div class="mp-c3">the live field covers Delhi NCR</div>`;
          dirty = true; loop(); openCard();
          return;
        }
        const b = S.fmt.band(cell.pm);
        pin = { lon, lat, color: b.color };
        dirty = true; loop();
        const dist = districtAt(ncr, lon, lat);
        let near = null;
        for (const s of sites) {
          const d = kmBetween({ lat, lon }, s);
          if (!near || d < near.d) near = { d, name: s.name };
        }
        const where = [dist, near ? `nearest live monitor ${near.name}, ~${near.d < 10 ? near.d.toFixed(1) : Math.round(near.d)}\u00a0km` : null].filter(Boolean).join(' · ');
        const prevV = cbody.querySelector('.mp-c-v');
        const fromV = prevV && typeof prevV._cuV === 'number' ? prevV._cuV : null;
        cbody.innerHTML =
          `<div class="mp-c1"><i class="mp-c-dot" style="background:${b.color}"></i><span class="mp-c-v" style="color:${b.ink}"></span>` +
          `<span class="mp-c-u">µg/m³</span><span class="mp-c-b" style="color:${b.ink}">— ${b.name}</span></div>` +
          `<div class="mp-c2">${C.esc(where || `${lat.toFixed(3)}°N ${lon.toFixed(3)}°E`)}</div>` +
          `<div class="mp-c3">${C.esc(C.CONF_TXT[cell.conf] || 'confidence unknown')}</div>` +
          `<div class="mp-c4"><small>why the air is like this</small><p class="mp-why"><span class="mp-skel"></span></p></div>` +
          `<div class="mp-c5"><span class="mp-fa">${fieldAge() ? `air reading: ${fieldAge()} old` : ''}</span><span class="mp-wa"></span></div>`;
        const v = cbody.querySelector('.mp-c-v');
        if (fromV != null) v._cuV = fromV;
        S.countUp(v, cell.pm, cardOpen ? 450 : 700);
        if (cardOpen) cbody.classList.remove('mp-swap'), void cbody.offsetWidth, cbody.classList.add('mp-swap');
        openCard();
        S.api.get(`/v2/why?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`).then((w) => {
          if (!alive || seq !== readSeq) return;
          const p = cbody.querySelector('.mp-why'), wa = cbody.querySelector('.mp-wa');
          if (w && w.line) {
            p.textContent = w.line;
            if (w.story_age_s != null && wa) wa.textContent = ` · drivers read ${S.fmt.ago(w.story_age_s)} ago`;
          } else {
            p.textContent = "can't reach the why-read right now";
            p.style.color = 'var(--ink3)';
          }
          p.classList.add('mp-swap');
          requestAnimationFrame(() => { if (cardOpen) fab.style.transform = `translate3d(0,${-(card.offsetHeight + 8)}px,0)`; });
        });
      }

      /* ── data ── */
      function legend() {
        const n = city && city.sources && city.sources.stations && city.sources.stations.count;
        stEl.textContent = n != null ? `${n} live station readings` : '';
        const a = fieldAge();
        ageEl.textContent = a ? `${a} old` : '';
        ageEl.title = a ? `air reading: ${a} old` : '';
      }
      let gRetry = 0, gRetryT = 0, firstPaintT = 0;
      function load() {
        clearTimeout(gRetryT);
        Promise.all([C.grid(), ncr ? ncr : C.ncr(), S.city()]).then(([g, n, c]) => {
          if (!alive) return;
          if (n && !ncr) {
            ncr = n; borders = C.bordersPath(n);
            labels = (n.features || []).filter((f) => f.properties && Array.isArray(f.properties.centroid))
              .map((f) => ({ name: f.properties.name, lon: f.properties.centroid[0], lat: f.properties.centroid[1] }))
              .sort((a, b) => (a.name === 'Delhi NCT' ? -1 : b.name === 'Delhi NCT' ? 1 : 0));
          }
          if (c && c !== city) { city = c; setSites(); }
          const nl = C.parseGrid(g);
          if (nl) {
            gRetry = 0;
            const firstLoad = !L;
            L = nl;
            note.hidden = true;
            if (firstLoad) {
              /* the first raster (smoothed field upsample + borders) is the heavy one —
                 land it after the push's slide settles, never inside a slide frame */
              const paintDelay = S.reduced ? 40 : 430;
              firstPaintT = setTimeout(() => {
                if (!alive) return;
                resize();
                if (performance.now() - mountT < 200) cv.style.transition = 'none';
                cv.classList.add('on');
                dirty = true; loop();
                setTimeout(() => { if (alive && !cardOpen) hint.classList.remove('off'); }, 500);
                setTimeout(() => hint.classList.add('off'), 6000);
              }, paintDelay);
            } else { dirty = true; loop(); }
          } else if (!L) {
            note.textContent = "can't reach the field — retrying";
            gRetry = Math.min(gRetry + 1, 5);
            gRetryT = setTimeout(load, [4, 6, 10, 15, 20, 30][gRetry] * 1000);
          }
          legend();
        });
      }

      const ro = window.ResizeObserver ? new ResizeObserver(() => resize()) : null;
      if (ro) ro.observe(cv); else window.addEventListener('resize', resize);
      resize();
      load();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) { dirty = true; loop(); } });
      const pollIv = setInterval(load, 60000);
      const ageIv = setInterval(() => {
        legend();
        const fa = cbody.querySelector('.mp-fa');
        if (fa && fieldAge()) fa.textContent = `air reading: ${fieldAge()} old`;
      }, 20000);

      return () => {
        alive = false;
        cancelAnimationFrame(raf);
        clearInterval(pollIv); clearInterval(ageIv); clearTimeout(gRetryT); clearTimeout(firstPaintT);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      };
    },
  });
})();
