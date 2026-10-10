/* home — sim-core. Mirrors Mobile/src/screens/HomeScreen.tsx (header, travel pill, hero on the
   mood canvas, doors) with the preview's honest substitutions: no GPS → the hero is the live city
   average from /v2/city (said as such), stays/hours read at SIM.ORIGIN (said as such).
   Also hosts SIM._core: field helpers shared with screens/map.js (same lane). */
(() => {
  'use strict';
  const S = window.SIM;
  if (!S) return;

  /* ── shared core (home + map) ─────────────────────────────────────── */
  const core = (S._core = S._core || {});
  const P = {
    search: 'M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z',
    navigate: 'M480-240 222-130q-13 5-24.5 2.5T178-138q-8-8-10.5-20t2.5-25l273-615q5-12 15.5-18t21.5-6q11 0 21.5 6t15.5 18l273 615q5 13 2.5 25T782-138q-8 8-19.5 10.5T738-130L480-240Z',
    chevron: 'M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z',
    explore: 'M480-440q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520q17 0 28.5 11.5T520-480q0 17-11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0 0q-134 0-227-93t-93-227q0-134 93-227t227-93q134 0 227 93t93 227q0 134-93 227t-227 93Zm67-234q6-3 11-8t8-11l117-250q5-10-2.5-17.5T663-683L413-566q-6 3-11 8t-8 11L277-297q-5 10 2.5 17.5T297-277l250-117Z',
    hotel: 'M80-200q-17 0-28.5-11.5T40-240v-520q0-17 11.5-28.5T80-800q17 0 28.5 11.5T120-760v360h320v-240q0-33 23.5-56.5T520-720h240q66 0 113 47t47 113v320q0 17-11.5 28.5T880-200q-17 0-28.5-11.5T840-240v-80H120v80q0 17-11.5 28.5T80-200Zm200-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Z',
    clock: 'M520-496v-144q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v159q0 8 3 15.5t9 13.5l132 132q11 11 28 11t28-11q11-11 11-28t-11-28L520-496ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z',
    flame: 'M480-80q-134 0-227-93t-93-227q0-113 67-217t184-182q22-15 45.5-1.5T480-760v52q0 34 23.5 57t57.5 23q17 0 32.5-7.5T621-657q8-10 20.5-12.5T665-664q63 45 99 115t36 149q0 134-93 227T480-80ZM240-400q0 52 21 98.5t60 81.5q-1-5-1-9v-9q0-32 12-60t35-51l113-111 113 111q23 23 35 51t12 60v9q0 4-1 9 39-35 60-81.5t21-98.5q0-50-18.5-94.5T648-574q-20 13-42 19.5t-45 6.5q-62 0-107.5-41T401-690q-78 66-119.5 140.5T240-400Zm240 52-57 56q-11 11-17 25t-6 29q0 32 23.5 55t56.5 23q33 0 56.5-23t23.5-55q0-16-6-29.5T537-292l-57-56Z',
    locate: 'M440-82v-40q-125-14-214.5-103.5T122-440H82q-17 0-28.5-11.5T42-480q0-17 11.5-28.5T82-520h40q14-125 103.5-214.5T440-838v-40q0-17 11.5-28.5T480-918q17 0 28.5 11.5T520-878v40q125 14 214.5 103.5T838-520h40q17 0 28.5 11.5T918-480q0 17-11.5 28.5T878-440h-40q-14 125-103.5 214.5T520-122v40q0 17-11.5 28.5T480-42q-17 0-28.5-11.5T440-82Zm40-118q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400Zm0-80Z',
  };
  core.icon = (name, size = 24, cls = '') =>
    `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 -960 960 960" aria-hidden="true" focusable="false"><path d="${P[name] || ''}" fill="currentColor"/></svg>`;
  core.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  core.GRID_PATH = '/grid?cells=34&param=pm2_5';
  core.grid = () => S.cached(core.GRID_PATH, 300000, 15000);
  core.ncr = () => S.cached('/ncr.geojson', 3600000, 15000);
  core.hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  core.rgba = (h, a) => { const c = core.hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  core.mix = (a, b, t) => { const x = core.hexRgb(a), y = core.hexRgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  core.COS = Math.cos((28.6 * Math.PI) / 180);
  core.CONF_A = { hi: 0.66, med: 0.5, lo: 0.32 };
  core.CONF_TXT = {
    hi: 'high confidence — many stations near here',
    med: 'medium confidence — some stations near here',
    lo: 'low confidence — no stations near here',
  };
  /** seconds since a server payload's field was built, ticking with the device clock */
  core.ageOf = (fieldAgeS, generatedAt) => {
    const a = Number(fieldAgeS);
    if (!isFinite(a)) return null;
    const g = Date.parse(generatedAt || '');
    return isFinite(g) ? a + Math.max(0, (Date.now() - g) / 1000) : a;
  };
  /** /grid GeoJSON → lattice {cols, rows, lon0, lat0, dlon, dlat, pm[], conf[], epoch} */
  core.parseGrid = (gj) => {
    if (!gj || !Array.isArray(gj.features) || !gj.features.length) return null;
    if (gj.__lattice) return gj.__lattice;
    let lon0 = Infinity, lat0 = Infinity, lon1 = -Infinity, lat1 = -Infinity, dlon = 0, dlat = 0;
    const boxes = [];
    for (const f of gj.features) {
      const ring = f && f.geometry && f.geometry.coordinates && f.geometry.coordinates[0];
      if (!ring || ring.length < 4) { boxes.push(null); continue; }
      let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
      for (const p of ring) { if (p[0] < a) a = p[0]; if (p[0] > c) c = p[0]; if (p[1] < b) b = p[1]; if (p[1] > d) d = p[1]; }
      boxes.push([a, b, c, d]);
      if (a < lon0) lon0 = a; if (b < lat0) lat0 = b; if (c > lon1) lon1 = c; if (d > lat1) lat1 = d;
      if (!dlon) { dlon = c - a; dlat = d - b; }
    }
    if (!dlon || !dlat || !isFinite(lon0)) return null;
    const cols = Math.round((lon1 - lon0) / dlon), rows = Math.round((lat1 - lat0) / dlat);
    const pm = new Array(cols * rows).fill(null), conf = new Array(cols * rows).fill(null);
    gj.features.forEach((f, k) => {
      const bx = boxes[k];
      if (!bx) return;
      const i = Math.round((bx[0] - lon0) / dlon), j = Math.round((bx[1] - lat0) / dlat);
      if (i < 0 || j < 0 || i >= cols || j >= rows) return;
      const pr = f.properties || {};
      const v = pr.pm25 != null ? Number(pr.pm25) : null;
      pm[j * cols + i] = isFinite(v) ? v : null;
      conf[j * cols + i] = pr.conf || null;
    });
    const ep = gj.properties && Array.isArray(gj.properties.cell_epoch) ? Number(gj.properties.cell_epoch[0]) : null;
    const L = { cols, rows, lon0, lat0, dlon, dlat, lon1: lon0 + cols * dlon, lat1: lat0 + rows * dlat, pm, conf, epoch: isFinite(ep) ? ep : null };
    try { Object.defineProperty(gj, '__lattice', { value: L, enumerable: false }); } catch (e) { /* frozen */ }
    return L;
  };
  core.cellAt = (L, lon, lat) => {
    if (!L || lon < L.lon0 || lon >= L.lon1 || lat < L.lat0 || lat >= L.lat1) return null;
    const i = Math.floor((lon - L.lon0) / L.dlon), j = Math.floor((lat - L.lat0) / L.dlat);
    const k = j * L.cols + i;
    if (L.pm[k] == null) return null;
    return { i, j, pm: L.pm[k], conf: L.conf[k], lon: L.lon0 + (i + 0.5) * L.dlon, lat: L.lat0 + (j + 0.5) * L.dlat };
  };
  /** the lattice as a cols×rows image (one pixel per cell, band colour, alpha by confidence) */
  core.fieldImage = (L) => {
    if (L.__img) return L.__img;
    const cv = document.createElement('canvas');
    cv.width = L.cols; cv.height = L.rows;
    const ctx = cv.getContext('2d');
    const im = ctx.createImageData(L.cols, L.rows);
    // premultiplied cell colours, then one light [1 2 1] pass so neighbouring cells meet softly
    const n = L.cols * L.rows, pre = new Float32Array(n * 4);
    for (let j = 0; j < L.rows; j++) {
      for (let i = 0; i < L.cols; i++) {
        const k = j * L.cols + i, v = L.pm[k];
        if (v == null) continue;
        const c = core.hexRgb(S.fmt.band(v).color);
        const a = core.CONF_A[L.conf[k]] || 0.32;
        const o = ((L.rows - 1 - j) * L.cols + i) * 4;
        pre[o] = c[0] * a; pre[o + 1] = c[1] * a; pre[o + 2] = c[2] * a; pre[o + 3] = a;
      }
    }
    const pass = (src, dx, dy) => {
      const out = new Float32Array(src.length);
      for (let y = 0; y < L.rows; y++) {
        for (let x = 0; x < L.cols; x++) {
          const o = (y * L.cols + x) * 4;
          const xa = Math.max(0, Math.min(L.cols - 1, x - dx)), ya = Math.max(0, Math.min(L.rows - 1, y - dy));
          const xb = Math.max(0, Math.min(L.cols - 1, x + dx)), yb = Math.max(0, Math.min(L.rows - 1, y + dy));
          const oa = (ya * L.cols + xa) * 4, ob = (yb * L.cols + xb) * 4;
          for (let c = 0; c < 4; c++) out[o + c] = (src[oa + c] + 2 * src[o + c] + src[ob + c]) / 4;
        }
      }
      return out;
    };
    const sm = pass(pass(pre, 1, 0), 0, 1);
    for (let p = 0; p < n; p++) {
      const a = sm[p * 4 + 3];
      if (a <= 0) continue;
      im.data[p * 4] = Math.round(sm[p * 4] / a); im.data[p * 4 + 1] = Math.round(sm[p * 4 + 1] / a);
      im.data[p * 4 + 2] = Math.round(sm[p * 4 + 2] / a); im.data[p * 4 + 3] = Math.round(a * 255);
    }
    ctx.putImageData(im, 0, 0);
    L.__img = cv;
    return cv;
  };
  /** the same image upsampled in 2× bilinear steps (34→544 px): a soft, continuous field
      instead of the diamond artefacts of one big bilinear stretch. Values stay the cells'. */
  core.fieldSmooth = (L) => {
    if (L.__smooth) return L.__smooth;
    let src = core.fieldImage(L);
    for (let s = 0; s < 4; s++) {
      const cv = document.createElement('canvas');
      cv.width = src.width * 2; cv.height = src.height * 2;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, cv.width, cv.height);
      src = cv;
    }
    // feather the lattice's outer edge (~¾ cell) so the field fades into the paper, not a hard box
    try {
      const ctx = src.getContext('2d');
      const w = src.width, h = src.height, f = Math.max(2, (w / L.cols) * 0.75);
      const im = ctx.getImageData(0, 0, w, h), d = im.data;
      for (let y = 0; y < h; y++) {
        const ey = Math.min(y + 0.5, h - y - 0.5) / f;
        for (let x = 0; x < w; x++) {
          const e = Math.min(ey, Math.min(x + 0.5, w - x - 0.5) / f);
          if (e >= 1) continue;
          const t = e * e * (3 - 2 * e);
          d[(y * w + x) * 4 + 3] *= t;
        }
      }
      ctx.putImageData(im, 0, 0);
    } catch (e) { /* tainted canvas can't happen here; keep the hard edge if it does */ }
    L.__smooth = src;
    return src;
  };
  /** district rings → one Path2D in projected units (x = lon·cosφ, y = −lat) */
  core.bordersPath = (gj) => {
    if (!gj || !Array.isArray(gj.features)) return null;
    if (gj.__path) return gj.__path;
    const p = new Path2D();
    for (const f of gj.features) {
      const g = f && f.geometry;
      if (!g) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (const poly of polys) {
        const ring = poly && poly[0];
        if (!ring || ring.length < 3) continue;
        ring.forEach((q, i) => (i ? p.lineTo(q[0] * core.COS, -q[1]) : p.moveTo(q[0] * core.COS, -q[1])));
        p.closePath();
      }
    }
    try { Object.defineProperty(gj, '__path', { value: p, enumerable: false }); } catch (e) { /* frozen */ }
    return p;
  };
  /** paint field + borders for a view {cx, cy (lon/lat centre), k (css px per degree lat)} */
  core.paint = (ctx, w, h, dpr, view, L, borders, opt) => {
    opt = opt || {};
    const k = view.k;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = opt.base || '#F1EFE9';
    ctx.fillRect(0, 0, w, h);
    const tx = w / 2 - view.cx * core.COS * k, ty = h / 2 + view.cy * k;
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);
    if (L) {
      ctx.imageSmoothingEnabled = opt.smooth !== false;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(opt.smooth === false ? core.fieldImage(L) : core.fieldSmooth(L),
        L.lon0 * core.COS, -L.lat1, L.cols * L.dlon * core.COS, L.rows * L.dlat);
    }
    if (borders) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = (opt.halo || 2.6) / k;
      ctx.strokeStyle = 'rgba(250,250,247,.5)';
      ctx.stroke(borders);
      ctx.lineWidth = (opt.line || 0.9) / k;
      ctx.strokeStyle = opt.ink || 'rgba(22,24,29,.30)';
      ctx.stroke(borders);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  core.project = (view, w, h, lon, lat) => [w / 2 + (lon - view.cx) * core.COS * view.k, h / 2 - (lat - view.cy) * view.k];
  core.unproject = (view, w, h, x, y) => [view.cx + (x - w / 2) / (core.COS * view.k), view.cy - (y - h / 2) / view.k];
  core.whoLine = (pm) => {
    const x = pm / 15;
    if (!isFinite(x)) return '';
    return x > 1.05 ? `≈ ${x >= 10 ? Math.round(x) : x.toFixed(1)}× the WHO 24-h guideline` : 'within the WHO 24-h guideline';
  };
  core.cadence = (pm) => (pm <= 60 ? 6 : pm <= 120 ? 4.5 : 3.5); // calm · uneasy · heavy (s per breath)

  /* ── home ─────────────────────────────────────────────────────────── */
  S.css('home', `
.hm{position:absolute;inset:0;display:flex;flex-direction:column;overflow:hidden;background:var(--paper)}
.hm-mood{position:absolute;inset:0;pointer-events:none}
.hm-mood>div{position:absolute;inset:0;opacity:0;transition:opacity .8s cubic-bezier(.65,0,.35,1)}
.hm-mood>div.on{opacity:1}
.hm-mood>div>i{position:absolute;inset:0;display:block}
.hm.is-live .hm-mood>div.on>i{animation:hm-breath var(--hm-half,3s) ease-in-out infinite alternate}
@keyframes hm-breath{from{opacity:1}to{opacity:.72}}
.hm-head{position:relative;display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:calc(max(var(--sim-top),12px) + 8px) 20px 6px}
.hm-head-t{min-width:0}
.hm-greet{margin:0;font:500 30px/36px var(--font);letter-spacing:-.6px;color:var(--ink);white-space:nowrap}
.hm-sub{margin-top:1px;font:400 13px/18px var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.hm-menu{flex:none;width:42px;height:42px;border-radius:50%;background:rgba(22,24,29,.05);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:5px}
.hm-menu i{display:block;width:16px;height:2px;border-radius:1px;background:var(--ink)}
.hm-ctabar{position:relative;padding:10px 20px 10px}
.hm-cta{display:flex;align-items:center;gap:10px;width:100%;height:56px;padding:0 13px 0 20px;border-radius:999px;
  background:var(--ink);color:var(--paper);box-shadow:0 8px 22px rgba(59,52,35,.14)}
.hm-cta-t{flex:1;font:700 17px/1 var(--font);letter-spacing:-.1px}
.hm-cta-go{width:30px;height:30px;border-radius:50%;background:rgba(250,250,247,.16);display:flex;align-items:center;justify-content:center}
.hm-scroll{position:relative;flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;touch-action:pan-y;scrollbar-width:none;
  -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 12px);mask-image:linear-gradient(180deg,transparent 0,#000 12px)}
.hm-scroll::-webkit-scrollbar{display:none}
.hm-content{display:flex;flex-direction:column;gap:16px;padding:4px 16px calc(var(--sim-bot) + 22px)}
.hm-in{opacity:0;transform:translate3d(0,14px,0)}
.hm-in.is-in{opacity:1;transform:none;transition:opacity .55s ease,transform .7s var(--ease)}
.hm-live{display:flex;align-items:center;gap:8px;padding:0 6px;margin-bottom:-6px;font:500 10.5px/14px var(--mono);color:var(--ink3);letter-spacing:.01em}
.hm-live-dot{position:relative;flex:none;width:6px;height:6px;border-radius:50%;background:var(--accent)}
.hm.is-live .hm-live-dot::after{content:"";position:absolute;inset:0;border-radius:50%;background:var(--accent);animation:hm-ping 2.4s cubic-bezier(.2,.6,.3,1) infinite}
@keyframes hm-ping{0%{transform:scale(1);opacity:.5}80%,100%{transform:scale(3.2);opacity:0}}
.hm-hero{position:relative;padding:12px 6px 4px}
.hm-eyebrow{position:relative;font:500 15px/20px var(--font);color:var(--ink2)}
.hm-numrow{position:relative;display:flex;align-items:flex-end;gap:10px;height:138px;margin-top:2px}
.hm-halo{position:absolute;left:0;top:50%;width:300px;height:300px;margin:-150px 0 0 -150px;pointer-events:none;opacity:0;
  transform:scale(.86);transition:opacity 1s ease,transform 1.4s var(--ease)}
.hm-halo.on{opacity:1;transform:scale(1)}
.hm-halo>i{position:absolute;inset:0;display:block;border-radius:50%}
.hm.is-live .hm-halo.on>i{animation:hm-halo var(--hm-half,3s) ease-in-out infinite alternate}
@keyframes hm-halo{from{transform:scale(.9);opacity:.62}to{transform:scale(1.06);opacity:1}}
.hm-num{position:relative;font:300 132px/138px var(--font);letter-spacing:-6px;margin-left:-6px;color:var(--ink);
  font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
.hm-unit{position:relative;font:500 13px/1 var(--font);color:var(--ink3);padding-bottom:26px}
.hm-breath{position:relative;height:2px;border-radius:1px;margin-top:14px;opacity:.16}
.hm.is-live .hm-breath.on{animation:hm-line var(--hm-half,3s) ease-in-out infinite alternate}
@keyframes hm-line{from{opacity:.10}to{opacity:.34}}
.hm-felt{position:relative;display:flex;align-items:center;gap:10px;margin-top:14px}
.hm-sq{flex:none;width:10px;height:10px;border-radius:2.5px}
.hm-felt-w{font:500 30px/34px var(--font);letter-spacing:-.4px}
.hm-ref{position:relative;margin-top:9px;font:400 15px/21px var(--font);color:var(--ink2);font-variant-numeric:tabular-nums}
.hm-prov{position:relative;margin-top:8px;font:400 13px/18px var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.hm-scale{position:relative;margin-top:16px;width:220px;max-width:100%;height:9px}
.hm-scale svg{display:block}
.hm-skel{border-radius:8px;background:rgba(22,24,29,.06);animation:hm-skel 1.4s ease-in-out infinite alternate}
@keyframes hm-skel{from{opacity:.55}to{opacity:1}}
.hm-reveal{opacity:0;transform:translate3d(0,8px,0)}
.hm-reveal.is-in{opacity:1;transform:none;transition:opacity .5s ease,transform .6s var(--ease)}
.hm-fail{display:flex;align-items:center;gap:9px;margin-top:14px;font:400 15px/21px var(--font);color:var(--ink2)}
.hm-fail i{flex:none;width:7px;height:7px;border-radius:50%;background:var(--ink4);animation:hm-skel .9s ease-in-out infinite alternate}
.hm-card{position:relative;display:block;width:100%;border-radius:24px;background:var(--surface);box-shadow:var(--sh-card);overflow:hidden;text-align:left}
.hm-mini{position:relative;height:148px;background:#F1EFE9;overflow:hidden}
.hm-mini canvas{position:absolute;inset:0;width:100%;height:100%;opacity:0;transform:scale(1.035);transition:opacity .7s ease,transform 1.1s var(--ease)}
.hm-mini canvas.on{opacity:1;transform:none}
.hm-mini-note{position:absolute;left:0;right:0;top:50%;margin-top:-9px;text-align:center;font:400 13px/18px var(--font);color:var(--ink3)}
.hm-mini-chip{position:absolute;left:12px;top:12px;display:flex;align-items:center;gap:6px;padding:6px 10px 6px 9px;border-radius:999px;
  background:var(--glass);box-shadow:0 0 0 .5px var(--ink10),0 4px 12px rgba(59,52,35,.08);font:500 12px/1 var(--font);color:var(--ink2)}
.hm-mini-chip b{display:flex;gap:3px}
.hm-mini-chip b i{display:block;width:6px;height:6px;border-radius:50%}
.hm-row{display:flex;align-items:center;gap:14px;width:100%;padding:15px 18px;text-align:left;color:var(--ink2)}
.hm-row-t{flex:1;min-width:0}
.hm-row-t b{display:block;font:500 17px/22px var(--font);color:var(--ink)}
.hm-row-t span{display:block;margin-top:1px;font:400 13px/18px var(--font);color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hm-chev{flex:none;color:var(--ink4)}
.hm-sep{height:1px;transform:scaleY(.5);background:var(--hair);margin-left:56px}
.hm-inc{padding:14px 18px 15px}
.hm-inc-h{display:flex;align-items:center;gap:7px;font:500 13px/18px var(--font);color:var(--ink3)}
.hm-inc-l{margin-top:8px;font:400 15px/21px var(--font);color:var(--ink2)}
.hm-inc-tag{font-size:13px;color:var(--ink3)}
.hm-foot{padding:2px 6px 0;font:400 12px/17px var(--font);color:var(--ink4);text-align:center}
@media (max-width:370px){
  .hm-greet{font-size:27px;line-height:32px}
  .hm-num{font-size:118px;line-height:124px;letter-spacing:-5px}
  .hm-numrow{height:124px}
  .hm-felt-w{font-size:27px;line-height:31px}
}
@media (prefers-reduced-motion:reduce){
  .hm-in,.hm-reveal,.hm-in.is-in,.hm-reveal.is-in{opacity:1;transform:none;transition:none}
  .hm-mini canvas{transition:none;transform:none}
  .hm-halo,.hm-halo.on{transition:none;transform:none}
  .hm-mood>div{transition:none}
  .hm.is-live .hm-live-dot::after,.hm-skel,.hm.is-live .hm-mood>div.on>i,.hm.is-live .hm-halo.on>i,.hm.is-live .hm-breath.on{animation:none}
  .hm-breath{opacity:.22}
}`);

  const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const istNow = () => new Date(Date.now() + 330 * 60000); // read with getUTC* → Delhi wall clock
  function greeting(d) {
    const hr = d.getUTCHours();
    return hr < 5 || hr >= 21 ? 'Up late' : hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  }
  function clockLabel(d) {
    const h = d.getUTCHours(), m = d.getUTCMinutes();
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  }

  /** CPCB ramp with today's band proud of it (Mobile/src/components/BandScale.tsx) */
  function bandScale(idx, w) {
    const seg = w / 6;
    const ramp = [0, 1, 2, 3, 4, 5].map((j) => core.mix(['#6E93AE', '#C7A34F', '#CF8A50', '#C05F3A', '#A83D30', '#6E2D28'][j], '#FFFFFF', 0.6));
    const stops = [`<stop offset="0" stop-color="${ramp[0]}"/>`]
      .concat(ramp.map((c, j) => `<stop offset="${((j + 0.5) / 6).toFixed(4)}" stop-color="${c}"/>`))
      .concat([`<stop offset="1" stop-color="${ramp[5]}"/>`]).join('');
    const ink = S.fmt.band([15, 45, 75, 105, 200, 300][idx]).ink;
    return `<svg width="${w}" height="9" viewBox="0 0 ${w} 9" aria-hidden="true"><defs><linearGradient id="hmRamp" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient></defs>` +
      `<rect x="0" y="2.5" width="${w}" height="4" rx="2" fill="url(#hmRamp)"/>` +
      `<rect x="${idx * seg - 1}" y="0" width="${seg + 2}" height="9" rx="4.5" fill="#FAFAF7"/>` +
      `<rect x="${idx * seg + 1.5}" y="1" width="${seg - 3}" height="7" rx="3.5" fill="${ink}"/></svg>`;
  }

  S.register('home', {
    title: 'Alive',
    mount(root) {
      const icon = core.icon, esc = core.esc;
      root.classList.add('sim-bleed');
      root.style.overflow = 'hidden';
      root.dataset.sb = 'static';
      const near = S.ORIGIN.name;
      root.innerHTML = `
<div class="hm">
  <div class="hm-mood" aria-hidden="true"></div>
  <header class="hm-head hm-in">
    <div class="hm-head-t">
      <h1 class="hm-greet"></h1>
      <div class="hm-sub"></div>
    </div>
    <button class="hm-menu" type="button" aria-label="menu"><i></i><i></i></button>
  </header>
  <div class="hm-ctabar hm-in">
    <button class="hm-cta" type="button">
      ${icon('search', 21)}<span class="hm-cta-t">Where to?</span><span class="hm-cta-go">${icon('navigate', 16)}</span>
    </button>
  </div>
  <div class="hm-scroll">
    <div class="hm-content">
      <div class="hm-live hm-in"><span class="hm-live-dot"></span>live preview · real data</div>
      <section class="hm-hero hm-in">
        <div class="hm-eyebrow">the air across Delhi</div>
        <div class="hm-body"></div>
      </section>
      <button class="hm-card hm-in hm-mapcard" type="button">
        <div class="hm-mini"><canvas aria-hidden="true"></canvas><div class="hm-mini-note">reading the field…</div></div>
        <div class="hm-row">${icon('explore', 24)}<div class="hm-row-t"><b>Air map</b><span class="hm-map-sub">the live field, street by street</span></div>${icon('chevron', 18, 'hm-chev')}</div>
      </button>
      <div class="hm-card hm-in">
        <button class="hm-row hm-go-stays sim-hl" type="button">${icon('hotel', 24)}<div class="hm-row-t"><b>Where to stay</b><span>lightest air first · near ${esc(near)}</span></div>${icon('chevron', 18, 'hm-chev')}</button>
        <div class="hm-sep"></div>
        <button class="hm-row hm-go-hours sim-hl" type="button">${icon('clock', 24)}<div class="hm-row-t"><b>When to go out</b><span>the lightest hours · near ${esc(near)}</span></div>${icon('chevron', 18, 'hm-chev')}</button>
      </div>
      <div class="hm-card hm-inc hm-in" hidden></div>
      <div class="hm-foot hm-in">no GPS in the preview — places read from ${esc(near)}</div>
    </div>
  </div>
</div>`;
      const $ = (s) => root.querySelector(s);
      const hm = $('.hm'), mood = $('.hm-mood'), body = $('.hm-body'), greetEl = $('.hm-greet'), subEl = $('.hm-sub');
      const mini = $('.hm-mini'), miniCv = mini.querySelector('canvas'), miniNote = $('.hm-mini-note'), mapSub = $('.hm-map-sub');
      const inc = $('.hm-inc');
      const timers = [];
      let alive = true;
      let hidden = false; // set by sim:hide / cleared by sim:show

      /* header clock — Delhi time, like the app (status bar keeps the device clock) */
      const tickHead = () => {
        if (hidden) return;
        const d = istNow();
        greetEl.textContent = greeting(d);
        subEl.textContent = `Delhi · ${WEEKDAY[d.getUTCDay()]} · ${clockLabel(d)}`;
      };
      tickHead();
      const headIv = setInterval(tickHead, 15000);

      /* doors */
      S.press($('.hm-menu'), () => S.push('settings'));
      S.press($('.hm-cta'), () => S.push('search', { from: { ...S.ORIGIN } }));
      S.press($('.hm-mapcard'), () => S.push('map'));
      S.press($('.hm-go-stays'), () => S.push('stays', { ...S.ORIGIN }));
      S.press($('.hm-go-hours'), () => S.push('hours', { ...S.ORIGIN }));

      /* staggered entrance (30–40 ms) */
      const ins = Array.from(root.querySelectorAll('.hm-in'));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ins.forEach((el, i) => { el.style.transitionDelay = `${i * 38}ms`; el.classList.add('is-in'); });
      }));

      /* hero skeleton until the first live read */
      body.innerHTML = `<div class="hm-skel" style="width:178px;height:104px;margin:18px 0 16px"></div><div class="hm-skel" style="width:62%;height:13px"></div>`;

      let shown = null; // last rendered city payload
      let numEl = null, ageEl = null, provEl = null;
      let moodCur = null;

      function setMood(pm) {
        const b = S.fmt.band(pm);
        const c = core.mix(b.color, '#FFFFFF', 0.68);
        const half = core.cadence(pm) / 2;
        hm.style.setProperty('--hm-half', half + 's');
        if (moodCur === c) return;
        moodCur = c;
        const layer = document.createElement('div');
        const i = document.createElement('i');
        i.style.background = `linear-gradient(180deg, ${c} 0%, ${core.rgba(c, 0.62)} 26%, ${core.rgba(c, 0.3)} 52%, rgba(250,250,247,0) 80%)`;
        layer.appendChild(i);
        mood.appendChild(layer);
        requestAnimationFrame(() => requestAnimationFrame(() => layer.classList.add('on')));
        const old = Array.from(mood.children).slice(0, -1);
        setTimeout(() => old.forEach((o) => o.remove()), 900);
      }

      function ageText(c) {
        // the field build's own epoch (same build the /grid map paints) → ages agree across the screen
        const ep = c.field && Number(c.field.built_epoch);
        const a = isFinite(ep) && ep > 0 ? Math.max(0, Date.now() / 1000 - ep)
          : core.ageOf(c.field_age_s != null ? c.field_age_s : c.freshness && c.freshness.field_age_s, c.generated_at);
        return a == null ? null : `air reading: ${S.fmt.ago(a)} old`;
      }
      function provText(c) {
        const n = c.sources && c.sources.stations && c.sources.stations.count;
        return n != null ? `PM2.5 · the field's NCR average · ${n} live station readings` : "PM2.5 · the field's NCR average";
      }
      function freshText(c) {
        const a = ageText(c) || 'no reading';
        return c.field && c.field.stale ? `${a} · older data — reconnecting` : a;
      }

      function renderHero(c) {
        const pm = c && c.pm25_stats && Number(c.pm25_stats.mean);
        if (!isFinite(pm)) { renderFail(); return; }
        const b = S.fmt.band(pm);
        const first = !numEl;
        if (first) {
          body.innerHTML = `
<div class="hm-numrow"><div class="hm-halo"><i></i></div><span class="hm-num sim-num">0</span><span class="hm-unit">µg/m³</span></div>
<div class="hm-breath hm-reveal"></div>
<div class="hm-felt hm-reveal"><i class="hm-sq"></i><span class="hm-felt-w"></span></div>
<div class="hm-ref hm-reveal"></div>
<div class="hm-prov hm-reveal"><span class="hm-prov-a"></span><br><span class="hm-prov-b"></span></div>
<div class="hm-scale hm-reveal"></div>`;
          numEl = body.querySelector('.hm-num');
          provEl = body.querySelector('.hm-prov-a');
          ageEl = body.querySelector('.hm-prov-b');
        }
        const halo = body.querySelector('.hm-halo');
        const haloI = halo.firstElementChild;
        numEl.style.color = b.ink;
        haloI.style.background = `radial-gradient(closest-side, ${core.rgba(b.color, 0.34)}, ${core.rgba(b.color, 0.22)} 30%, ${core.rgba(b.color, 0.09)} 62%, ${core.rgba(b.color, 0)})`;
        body.querySelector('.hm-breath').style.background = b.ink;
        body.querySelector('.hm-sq').style.background = b.color;
        const fw = body.querySelector('.hm-felt-w');
        fw.textContent = b.name;
        fw.style.color = b.ink;
        body.querySelector('.hm-ref').textContent = core.whoLine(pm);
        provEl.textContent = provText(c);
        ageEl.textContent = freshText(c);
        body.querySelector('.hm-scale').innerHTML = bandScale(b.idx, 220);
        setMood(pm);
        // centre the halo on the numeral once its final width is known
        const place = () => {
          const r = numEl.getBoundingClientRect(), pr = numEl.parentNode.getBoundingClientRect();
          if (r.width) halo.style.left = `${r.left - pr.left + r.width / 2}px`;
        };
        if (first) { numEl.textContent = S.fmt.ug(pm); place(); } // measure the final numeral first
        S.countUp(numEl, pm, first ? 900 : 700).then(place);
        if (first) {
          requestAnimationFrame(() => {
            halo.classList.add('on');
            body.querySelector('.hm-breath').classList.add('on');
            Array.from(body.querySelectorAll('.hm-reveal')).forEach((el, i) => {
              el.style.transitionDelay = `${220 + i * 40}ms`;
              el.classList.add('is-in');
            });
            hm.classList.add('is-live');
          });
        }
      }

      function renderFail() {
        if (numEl) { // keep the last real read (its age keeps ticking); say it's retrying
          ageEl.textContent = `${freshText(shown)} · can't reach the field — retrying`;
          return;
        }
        body.innerHTML = `<div class="hm-fail"><i></i>can't reach the field — retrying</div>`;
      }

      function renderIncident(c) {
        const w = c && c.why;
        const line = w && (w.cause_note || w.line);
        if (!line) { inc.hidden = true; return; }
        const age = w.story_age_s != null ? ` · ${S.fmt.ago(w.story_age_s)} old` : '';
        inc.innerHTML = `<div class="hm-inc-h">${icon('flame', 15)}<span>in Delhi's air right now</span></div>` +
          `<div class="hm-inc-l">${esc(line)}<span class="hm-inc-tag"> · measured, not reported${esc(age)}</span></div>`;
        if (inc.hidden) {
          inc.hidden = false;
          inc.classList.remove('is-in');
          inc.style.transitionDelay = '0ms';
          requestAnimationFrame(() => requestAnimationFrame(() => inc.classList.add('is-in')));
        }
      }

      let retry = 0, retryT = 0;
      function loadCity() {
        clearTimeout(retryT);
        return S.city().then((c) => {
          if (!alive) return;
          if (c && c.pm25_stats && isFinite(Number(c.pm25_stats.mean))) {
            retry = 0;
            const same = shown && shown.generated_at === c.generated_at && shown.pm25_stats.mean === c.pm25_stats.mean;
            shown = c;
            if (!same || !numEl) renderHero(c); else { provEl.textContent = provText(c); ageEl.textContent = freshText(c); }
            renderIncident(c);
            mapSub.textContent = mapSubText();
          } else {
            renderFail();
            retry = Math.min(retry + 1, 5);
            retryT = setTimeout(loadCity, [4, 6, 10, 15, 20, 30][retry] * 1000);
          }
        });
      }

      /* the mini live field */
      let lattice = null, borders = null, gridAgeAt = null;
      function mapSubText() {
        const parts = [];
        const n = shown && shown.sources && shown.sources.stations && shown.sources.stations.count;
        if (n != null) parts.push(`${n} live station readings`);
        if (lattice && lattice.epoch) parts.push(`${S.fmt.ago(Date.now() / 1000 - lattice.epoch)} old`);
        return parts.length ? parts.join(' · ') : 'the live field, street by street';
      }
      function drawMini() {
        if (!lattice || !alive) return;
        const w = mini.clientWidth, h = mini.clientHeight;
        if (!w || !h) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        miniCv.width = Math.round(w * dpr);
        miniCv.height = Math.round(h * dpr);
        const ctx = miniCv.getContext('2d');
        // frame the lattice's full width, centred on the preview origin's latitude
        const k = w / ((lattice.lon1 - lattice.lon0) * core.COS) * 1.06;
        const view = { cx: (lattice.lon0 + lattice.lon1) / 2 + 0.01, cy: S.ORIGIN.lat - 0.035, k };
        core.paint(ctx, w, h, dpr, view, lattice, borders, { line: 0.75, halo: 2, ink: 'rgba(22,24,29,.26)' });
        // the preview origin
        const [x, y] = core.project(view, w, h, S.ORIGIN.lon, S.ORIGIN.lat);
        ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fillStyle = 'rgba(250,250,247,.8)'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 3.6, 0, Math.PI * 2); ctx.fillStyle = '#16181D'; ctx.fill();
        ctx.font = '500 11px Satoshi, system-ui, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(250,250,247,.85)'; ctx.lineWidth = 3;
        ctx.strokeText(S.ORIGIN.name, x + 11, y + 0.5);
        ctx.fillStyle = 'rgba(22,24,29,.82)';
        ctx.fillText(S.ORIGIN.name, x + 11, y + 0.5);
        miniNote.hidden = true;
        if (!miniCv.classList.contains('on')) requestAnimationFrame(() => miniCv.classList.add('on'));
        if (!mini.querySelector('.hm-mini-chip')) {
          const chip = document.createElement('div');
          chip.className = 'hm-mini-chip';
          chip.innerHTML = '<b>' + ['#6E93AE', '#C7A34F', '#CF8A50', '#C05F3A', '#A83D30', '#6E2D28'].map((c) => `<i style="background:${c}"></i>`).join('') + '</b>good → severe';
          mini.appendChild(chip);
        }
      }
      let gRetry = 0, gRetryT = 0;
      function loadGrid() {
        clearTimeout(gRetryT);
        Promise.all([core.grid(), borders ? null : core.ncr()]).then(([g, n]) => {
          if (!alive) return;
          if (n) borders = core.bordersPath(n);
          const L = core.parseGrid(g);
          if (L) {
            gRetry = 0;
            if (L !== lattice) { lattice = L; drawMini(); }
            mapSub.textContent = mapSubText();
          } else {
            if (!lattice) { miniNote.hidden = false; miniNote.textContent = "can't reach the field — retrying"; }
            gRetry = Math.min(gRetry + 1, 5);
            gRetryT = setTimeout(loadGrid, [4, 6, 10, 15, 20, 30][gRetry] * 1000);
          }
        });
      }

      loadCity();
      loadGrid();
      /* hidden under a pushed screen: animations stop (is-live gates them), and
         every clock stops too — no polling or ticking for a screen nobody sees */
      const pollIv = setInterval(() => { if (!hidden) { loadCity(); loadGrid(); } }, 60000);
      const ageIv = setInterval(() => {
        if (hidden) return;
        if (shown && ageEl && !retry) ageEl.textContent = freshText(shown);
        if (shown || lattice) mapSub.textContent = mapSubText();
      }, 20000);
      const onShow = () => { hidden = false; hm.classList.add('is-live'); loadCity(); loadGrid(); };
      const onHide = () => { hidden = true; hm.classList.remove('is-live'); };
      root.addEventListener('sim:show', onShow);
      root.addEventListener('sim:hide', onHide);
      const onResize = () => drawMini();
      window.addEventListener('resize', onResize);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (alive) drawMini(); });
      timers.push(headIv, pollIv, ageIv);

      return () => {
        alive = false;
        timers.forEach(clearInterval);
        clearTimeout(retryT);
        clearTimeout(gRetryT);
        window.removeEventListener('resize', onResize);
      };
    },
  });
})();
