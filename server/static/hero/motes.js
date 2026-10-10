/*!
 * Alive · motes.js — the air you can't see, made visible.
 *
 * A live particulate layer for the hero: fine motes drifting through the haze,
 * and their COUNT is the city's real PM2.5 — one mote per µg/m³.
 *
 *   var motes = Motes.mount(canvas, { pm25: 58, windFromDeg: 108, windKmh: 8.7 });
 *   motes.count              // 58 — the canvas holds exactly Math.round(pm25) motes
 *   motes.set({ pm25: 120 }) // population eases 58 → 120: motes fade in, never pop
 *   motes.destroy()
 *
 * Plain script (no modules, no dependencies). Canvas 2D, DPR-aware (cap 2),
 * ≤300 motes, pauses off-screen / in hidden tabs, one static frame under
 * prefers-reduced-motion. The canvas is blended additively onto the photo
 * (mix-blend-mode: plus-lighter, set here) — sunlit dust adds light.
 * Encoding, wind mapping, options and perf notes: MOTES.md.
 */
(function (win) {
  'use strict';
  if (!win || !win.document) return;
  var doc = win.document;

  var MAX_MOTES = 300;     // hard cap (perf); above it the canvas holds 300 and `capped` is true
  var DPR_CAP = 2;
  var FADE_S = 1.6;        // each mote fades in / out over this long — nothing ever pops
  var WIND_EASE_S = 2.5;   // a new wind reading steers the drift over a few seconds
  var REF_W = 1440;        // drift speeds are tuned for a canvas this wide (css px)
  var NS_DAMP = 0.4;       // north–south wind → vertical drift: we look across the city, not down on it
  var OU_TAU = 3.2;        // Brownian wander: velocity memory (s)
  var OU_SIGMA = 2.6;      // Brownian wander: steady-state speed (css px/s, before layer scale)
  var SUN = [0.9, -0.06];  // where the light comes from, in canvas fractions (hero-main: top right)
  var TAU = Math.PI * 2;

  // Three depth layers. share: fraction of the population (held exact at every
  // count); r: radius range, css px (diameters ≈0.6–2.2); soft: edge softness as
  // a fraction of radius (far crisp → near defocused); drift: parallax multiplier
  // on all motion; jitter: wander multiplier; tw: depth of the slow tumble
  // shimmer; px: pointer-parallax reach (css px).
  var LAYERS = [
    { share: 0.46, r: [0.30, 0.50], soft: 0.12, drift: 0.42, jitter: 0.55, tw: 0.05, px: 1.6 },
    { share: 0.36, r: [0.50, 0.78], soft: 0.30, drift: 0.78, jitter: 0.80, tw: 0.10, px: 4 },
    { share: 0.18, r: [0.82, 1.10], soft: 0.62, drift: 1.30, jitter: 1.15, tw: 0.12, px: 8 }
  ];
  // Colour per layer: tint at the small (warm) / large (pale) end + alpha range.
  // LIGHT is for the default additive blend (mix-blend-mode: plus-lighter): sunlit
  // dust ADDS warm light to the scene, so a mote turns cream over the bright sky,
  // gold in the ochre haze and stays a dim amber over the dark canopy — visible
  // everywhere, never a star field. Blue is held back so a mote clipping on the
  // bright sky lands on cream, not on a white star. CREAM: source-over fallback.
  var LIGHT = {
    layers: [
      { warm: [134, 96, 44], pale: [138, 104, 54], a: [0.55, 0.88] },
      { warm: [138, 104, 58], pale: [142, 112, 68], a: [0.52, 0.82] },
      { warm: [142, 114, 78], pale: [148, 122, 88], a: [0.48, 0.74] }
    ],
    glint: [164, 134, 92]
  };
  var CREAM = {
    layers: [
      { warm: [255, 236, 200], pale: [255, 242, 214], a: [0.62, 0.90] },
      { warm: [255, 242, 216], pale: [255, 247, 228], a: [0.52, 0.80] },
      { warm: [255, 246, 228], pale: [255, 250, 238], a: [0.38, 0.60] }
    ],
    glint: [255, 247, 230]
  };
  var CLASSES = 4;                    // pre-rendered size classes per layer

  function finite(v) { return typeof v === 'number' && isFinite(v); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) * 2; } // ≈N(0,1)
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  // pm25 → exact mote count. No reading (null/NaN/negative) → 0: no figure, no motes.
  function countFor(pm) { return finite(pm) && pm > 0 ? Math.min(MAX_MOTES, Math.round(pm)) : 0; }

  // ---- sprites: soft discs pre-rendered at device resolution, blitted 1:1 ----
  // A logistic-edged disc, 4×4 supersampled. The softness floor keeps the tiniest
  // motes ~1.5 device px wide so sub-pixel motion never shimmers into a twinkle.
  function discSprite(rDev, wDev, rgb) {
    var w = Math.max(wDev, 0.36);
    var h = Math.ceil(rDev + 5 * w) + 1, s = h * 2;
    var c = doc.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d'), img = g.createImageData(s, s), d = img.data;
    var norm = 1 + Math.exp(-rDev / w); // centre alpha → 1
    for (var py = 0; py < s; py++) {
      for (var px = 0; px < s; px++) {
        var acc = 0;
        for (var sy = 0; sy < 4; sy++) {
          var dy = py + (sy + 0.5) / 4 - h;
          for (var sx = 0; sx < 4; sx++) {
            var dx = px + (sx + 0.5) / 4 - h;
            acc += 1 / (1 + Math.exp((Math.sqrt(dx * dx + dy * dy) - rDev) / w));
          }
        }
        var i = (py * s + px) * 4;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
        d[i + 3] = Math.round(255 * Math.min(1, acc / 16 * norm));
      }
    }
    g.putImageData(img, 0, 0);
    return { c: c, h: h, s: s };
  }

  // The faint warm bloom around a mote at the moment it catches the light.
  function haloSprite(sigma, rgb) {
    var h = Math.ceil(sigma * 3) + 1, s = h * 2;
    var c = doc.createElement('canvas');
    c.width = c.height = s;
    var g = c.getContext('2d'), img = g.createImageData(s, s), d = img.data;
    for (var py = 0; py < s; py++) {
      for (var px = 0; px < s; px++) {
        var dx = px + 0.5 - h, dy = py + 0.5 - h, i = (py * s + px) * 4;
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
        d[i + 3] = Math.round(255 * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)));
      }
    }
    g.putImageData(img, 0, 0);
    return { c: c, h: h, s: s };
  }

  function buildSprites(dpr, pal) {
    var out = [];
    for (var l = 0; l < 3; l++) {
      var L = LAYERS[l], P = pal.layers[l], disc = [];
      for (var k = 0; k < CLASSES; k++) {
        var t = k / (CLASSES - 1), r = (L.r[0] + (L.r[1] - L.r[0]) * t) * dpr;
        disc.push(discSprite(r, r * L.soft, mix(P.warm, P.pale, t)));
      }
      out.push({ disc: disc, halo: haloSprite(L.r[1] * dpr * 2.6 + 0.8, pal.glint) });
    }
    return out;
  }

  // Glint envelope: quick rise, slow fall (a flake turning into the sun and away).
  function bell(p) {
    var q = p < 0.35 ? p / 0.35 * 0.5 : 0.5 + (p - 0.35) / 0.65 * 0.5, s = Math.sin(Math.PI * q);
    return s * s;
  }

  function stub() { return { set: function () { return this; }, destroy: function () {}, count: 0, visible: 0, capped: false, blend: 'normal' }; }

  function mount(canvas, opts) {
    if (!canvas || typeof canvas.getContext !== 'function') return stub();
    if (canvas.__aliveMotes) canvas.__aliveMotes.destroy();
    var ctx = null;
    try { ctx = canvas.getContext('2d', { alpha: true }); } catch (e) { ctx = null; }
    if (!ctx) return stub();
    opts = opts || {};

    var motes = [[], [], []];   // per layer, drawn far → near
    var alive = [0, 0, 0];      // motes per layer that are staying (not fading out)
    var target = countFor(opts.pm25), capped = finite(opts.pm25) && Math.round(opts.pm25) > MAX_MOTES;
    var ease = null;            // population transition {from, to, t0, dur}
    var t = 0;                  // simulated seconds (advances only while running)
    var W = 0, H = 0, cw = 0, ch = 0, dpr = 0, sprites = null;
    var fromDeg = NaN, kmh = NaN, wx = 0, wy = 0, twx = 0, twy = 0;
    var ppx = 0, ppy = 0, tpx = 0, tpy = 0;
    var raf = 0, last = 0, dead = false, intersecting = true;
    // Frame cap: the motes move < 0.25 px per frame at 60 fps, so on 90/120/144 Hz
    // screens extra frames buy nothing visible. fps: 30 halves the cost again.
    var minFrameMs = 800 / clamp(finite(opts.fps) ? opts.fps : 60, 10, 240); // 0.8: vsync jitter tolerance
    var slow = 16.7;            // smoothed frame interval (ms) for the adaptive 30 fps fallback
    var mq = win.matchMedia ? win.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduced = !!(mq && mq.matches);
    var parallax = opts.parallax !== false && !!(win.matchMedia && win.matchMedia('(hover: hover) and (pointer: fine)').matches);
    var io = null, ro = null;

    // Light adds: the canvas is blended additively onto the photo beneath it
    // (plus-lighter; screen where unsupported). blend: 'normal' opts out and
    // switches to the cream source-over palette.
    var blend = opts.blend === 'normal' || opts.blend === 'screen' ? opts.blend : 'plus-lighter';
    var cssOk = function (v) { return !!(win.CSS && win.CSS.supports && win.CSS.supports('mix-blend-mode', v)); };
    if (blend === 'plus-lighter' && !cssOk(blend)) blend = 'screen';
    var pal = blend === 'normal' ? CREAM : LIGHT;
    var prevBlend = canvas.style.mixBlendMode;
    if (blend !== 'normal') canvas.style.mixBlendMode = blend;

    // Coherent eddies: the curl of three slow travelling waves, so neighbouring
    // motes swirl together the way real air does (divergence-free, no clumping).
    var waves = [];
    for (var j = 0; j < 3; j++) {
      var ang = Math.random() * TAU, k = TAU / (520 + Math.random() * 460), sp = 0.9 + Math.random() * 0.6;
      waves.push({ kx: Math.cos(ang) * k, ky: Math.sin(ang) * k, a: sp / k, p: Math.random() * TAU,
        w: (0.025 + Math.random() * 0.04) * (Math.random() < 0.5 ? -1 : 1) });
    }

    // Wind → drift. windFromDeg is where the wind comes FROM; the motes travel
    // the other way. The canvas reads as a map (east → right, north → up), with the
    // vertical part damped. Speed grows gently (sub-linearly) with km/h.
    function aimWind() {
      if (!finite(fromDeg) || !finite(kmh) || kmh <= 0) { twx = 0; twy = 0; return; }
      var to = (fromDeg + 180) * Math.PI / 180, s = 1.55 * Math.pow(Math.min(kmh, 60), 0.72);
      twx = Math.sin(to) * s;
      twy = -Math.cos(to) * s * NS_DAMP;
    }
    function takeWind(o, initial) {
      if ('windFromDeg' in o) fromDeg = finite(o.windFromDeg) ? o.windFromDeg : NaN;
      if ('windKmh' in o) kmh = finite(o.windKmh) ? o.windKmh : NaN;
      aimWind();
      if (initial) { wx = twx; wy = twy; }
    }
    takeWind(opts, true);

    function Mote(l, x, y, on) {
      var A = pal.layers[l].a;
      this.l = l;
      this.k = Math.min(CLASSES - 1, Math.floor(Math.pow(Math.random(), 1.35) * CLASSES)); // skew small
      this.a = A[0] + (A[1] - A[0]) * Math.pow(Math.random(), 1.5);                     // many dim, few bright
      this.x = x; this.y = y;                                                            // canvas fractions
      this.vx = gauss() * OU_SIGMA; this.vy = gauss() * OU_SIGMA;                        // wander velocity
      this.f = on ? 1 : 0; this.d = on ? 0 : 1;                                          // fade, direction
      this.tf = TAU * (0.05 + Math.random() * 0.11); this.tp = Math.random() * TAU;     // slow tumble
      this.g = -1; this.gd = 1;                                                          // glint progress
    }

    // Best-of-10 candidates (Mitchell): new motes land in the emptiest air, so
    // the field reads even — never clumped, never a grid.
    function freeSpot() {
      var ax = W || 1, ay = H || 1, bx = Math.random(), by = Math.random(), bd = -1;
      for (var c = 0; c < 10; c++) {
        var x = Math.random(), y = Math.random(), dmin = Infinity;
        for (var l = 0; l < 3; l++) {
          var arr = motes[l];
          for (var i = 0; i < arr.length; i++) {
            if (arr[i].d < 0) continue;
            var dx = Math.abs(arr[i].x - x), dy = Math.abs(arr[i].y - y);
            if (dx > 0.5) dx = 1 - dx;
            if (dy > 0.5) dy = 1 - dy;
            var d2 = dx * dx * ax * ax + dy * dy * ay * ay;
            if (d2 < dmin) dmin = d2;
          }
        }
        if (dmin > bd) { bd = dmin; bx = x; by = y; }
      }
      return [bx, by];
    }

    function total() { return motes[0].length + motes[1].length + motes[2].length; }

    function addOne(want, now) {
      var best = 0, bestDef = -Infinity, l, i, arr;
      for (l = 0; l < 3; l++) {
        var def = LAYERS[l].share * want - alive[l];
        if (def > bestDef) { bestDef = def; best = l; }
      }
      // a mote still fading out comes back instead of a new one being born
      // (from any layer if the 300 budget is already spent)
      var full = total() >= MAX_MOTES;
      for (var pass = 0; pass < (full ? 2 : 1); pass++) {
        for (l = 0; l < 3; l++) {
          if (pass === 0 && l !== best) continue;
          arr = motes[l];
          for (i = 0; i < arr.length; i++) {
            if (arr[i].d < 0) { arr[i].d = now ? 0 : 1; if (now) arr[i].f = 1; alive[l]++; return; }
          }
        }
      }
      var p = freeSpot();
      motes[best].push(new Mote(best, p[0], p[1], now));
      alive[best]++;
    }

    function removeOne(want, now) {
      var best = -1, bestSur = -Infinity;
      for (var l = 0; l < 3; l++) {
        var sur = alive[l] - LAYERS[l].share * want;
        if (alive[l] > 0 && sur > bestSur) { bestSur = sur; best = l; }
      }
      if (best < 0) return;
      var arr = motes[best], n = arr.length, s = Math.floor(Math.random() * n);
      for (var j = 0; j < n; j++) {
        var i = (s + j) % n;
        if (arr[i].d >= 0) {
          if (now) arr.splice(i, 1); else arr[i].d = -1;
          alive[best]--;
          return;
        }
      }
    }

    // Bring the staying population to the eased count for this instant.
    function reconcile(now) {
      var want = target;
      if (!now && ease) {
        var p = (t - ease.t0) / ease.dur;
        if (p >= 1) ease = null;
        else want = Math.round(ease.from + (ease.to - ease.from) * (0.5 - 0.5 * Math.cos(Math.PI * p)));
      }
      var n = alive[0] + alive[1] + alive[2];
      while (n < want) { addOne(want, now); n++; }
      while (n > want) { removeOne(want, now); n--; }
    }

    function retarget(nt) {
      if (nt === target) return;
      var from = alive[0] + alive[1] + alive[2];
      target = nt;
      ease = { from: from, to: nt, t0: t, dur: clamp(0.9 + 0.028 * Math.abs(nt - from), 1.4, 4) };
      if (reduced) settle();
    }

    // Reduced motion (or a resize while static): exact count, every mote fully
    // present, no glints — one frame, then nothing.
    function settle() {
      ease = null;
      for (var l = 0; l < 3; l++) {
        var arr = motes[l];
        for (var i = arr.length - 1; i >= 0; i--) {
          if (arr[i].d < 0) arr.splice(i, 1);
          else { arr[i].f = 1; arr[i].d = 0; arr[i].g = -1; }
        }
      }
      reconcile(true);
      ppx = ppy = tpx = tpy = 0;
      draw();
    }

    function step(dt) {
      t += dt;
      var kw = 1 - Math.exp(-dt / WIND_EASE_S);
      wx += (twx - wx) * kw; wy += (twy - wy) * kw;
      var kp = 1 - Math.exp(-dt / 0.9);
      ppx += (tpx - ppx) * kp; ppy += (tpy - ppy) * kp;
      reconcile(false);
      if (!W || !H) return;

      var sc = clamp(Math.sqrt(W / REF_W), 0.6, 1.25);
      var decay = Math.exp(-dt / OU_TAU), kick = OU_SIGMA * Math.sqrt(1 - decay * decay);
      var iW = dt / W, iH = dt / H, df = dt / FADE_S;
      for (var l = 0; l < 3; l++) {
        var L = LAYERS[l], arr = motes[l], ph = l * 1.7;
        var dx = L.drift * wx, dy = L.drift * wy;
        for (var i = arr.length - 1; i >= 0; i--) {
          var m = arr[i];
          if (m.d) {
            m.f += m.d * df;
            if (m.f >= 1) { m.f = 1; m.d = 0; }
            else if (m.f <= 0) { arr.splice(i, 1); continue; }
          }
          m.vx = m.vx * decay + kick * gauss();
          m.vy = m.vy * decay + kick * gauss();
          var X = m.x * W, Y = m.y * H, fx = 0, fy = 0;
          for (var q = 0; q < 3; q++) {
            var w = waves[q], c = Math.cos(w.kx * X + w.ky * Y + w.w * t + w.p + ph);
            fx += w.a * w.ky * c; fy -= w.a * w.kx * c;
          }
          m.x += (dx + L.drift * fx + L.jitter * m.vx) * sc * iW;
          m.y += (dy + L.drift * fy + L.jitter * m.vy) * sc * iH;
          m.x -= Math.floor(m.x); m.y -= Math.floor(m.y);   // the canvas is a torus: no mote ever leaves
          if (m.g >= 0) { m.g += dt / m.gd; if (m.g >= 1) m.g = -1; }
        }
      }

      // Now and then a mote catches the light — about one every 4–5 s at ~60 motes.
      var n = alive[0] + alive[1] + alive[2];
      if (n && Math.random() < 0.2 * clamp(Math.sqrt(n / 60), 0.45, 2) * dt) {
        var gl = Math.random() < 0.25 ? 0 : Math.random() < 0.6 ? 1 : 2, ga = motes[gl];
        if (ga.length) {
          var gm = ga[Math.floor(Math.random() * ga.length)];
          if (gm.d === 0 && gm.g < 0) { gm.g = 0; gm.gd = 1.1 + Math.random() * 0.8; }
        }
      }
    }

    // Draw a sprite centred at (x, y) device px; edge-straddling motes are also
    // drawn wrapped, so a mote crossing an edge is split, never lost.
    function blit(sp, x, y, k) {
      var s = sp.s * k, x0 = x - sp.h * k, y0 = y - sp.h * k;
      var nx = x0 < 0 ? cw : x0 + s > cw ? -cw : 0, ny = y0 < 0 ? ch : y0 + s > ch ? -ch : 0;
      if (k === 1) {
        ctx.drawImage(sp.c, x0, y0);
        if (nx) ctx.drawImage(sp.c, x0 + nx, y0);
        if (ny) ctx.drawImage(sp.c, x0, y0 + ny);
        if (nx && ny) ctx.drawImage(sp.c, x0 + nx, y0 + ny);
      } else {
        ctx.drawImage(sp.c, x0, y0, s, s);
        if (nx) ctx.drawImage(sp.c, x0 + nx, y0, s, s);
        if (ny) ctx.drawImage(sp.c, x0, y0 + ny, s, s);
        if (nx && ny) ctx.drawImage(sp.c, x0 + nx, y0 + ny, s, s);
      }
    }

    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (cw && ch) ctx.clearRect(0, 0, cw, ch);
      if (!cw || !ch || !sprites) return;
      var sunX = SUN[0] * cw, sunY = SUN[1] * ch, D = Math.max(cw, ch), sunK = 3.2 / (D * D);
      for (var l = 0; l < 3; l++) {
        var L = LAYERS[l], arr = motes[l], S = sprites[l];
        var ox = ppx * L.px * dpr, oy = ppy * L.px * dpr;
        for (var i = 0; i < arr.length; i++) {
          var m = arr[i], f = m.f;
          if (f <= 0) continue;
          f = f * f * (3 - 2 * f);
          var x = m.x * cw + ox, y = m.y * ch + oy;
          x -= Math.floor(x / cw) * cw; y -= Math.floor(y / ch) * ch;
          var ex = x - sunX, ey = y - sunY;
          var a = m.a * f * (0.84 + 0.3 * Math.exp(-(ex * ex + ey * ey) * sunK)) * (1 + L.tw * Math.sin(m.tf * t + m.tp));
          var g = m.g >= 0 ? bell(m.g) : 0;
          if (g > 0) a += (1 - a) * 0.8 * g * f;
          if (a > 1) a = 1;
          if (a < 0.004) continue;
          ctx.globalAlpha = a;
          blit(S.disc[m.k], x, y, g > 0.002 ? 1 + 0.4 * g : 1);
          if (g > 0.02) { ctx.globalAlpha = 0.24 * g * f; blit(S.halo, x, y, 1); }
        }
      }
      ctx.globalAlpha = 1;
    }

    // Animate only when it can be seen and there is something to see: off-screen,
    // hidden tab, reduced motion, zero size or an empty field (no reading) → no rAF.
    function shouldRun() {
      return !dead && !reduced && intersecting && !doc.hidden && cw > 0 && ch > 0 && (target > 0 || total() > 0);
    }
    function frame(now) {
      raf = 0;
      if (!shouldRun()) return;
      if (last && now - last < minFrameMs) { raf = win.requestAnimationFrame(frame); return; } // fps cap
      var dt = last ? clamp((now - last) / 1000, 0, 0.05) : 0;
      if (last) {
        // A device that can't hold ~40 fps for a few seconds gets a steady 30
        // instead of a ragged 35–45 (and the rest of the page gets the headroom).
        slow += (Math.min(now - last, 50) - slow) * 0.03;
        if (slow > 24 && t > 3 && minFrameMs < 800 / 30) minFrameMs = 800 / 30;
      }
      last = now;
      if (Math.min(DPR_CAP, win.devicePixelRatio || 1) !== dpr) resize(W, H); // zoom / monitor change
      step(dt);
      draw();
      if (!raf && shouldRun()) raf = win.requestAnimationFrame(frame);
    }
    function update() {
      var run = shouldRun();
      if (run && !raf) { last = 0; raf = win.requestAnimationFrame(frame); }
      else if (!run && raf) { win.cancelAnimationFrame(raf); raf = 0; }
    }

    // A canvas with no CSS size takes its layout size from its backing store, and
    // would grow with every DPR-scaled resize. Detect that once; fill the parent.
    function pinIfIntrinsic() {
      var w0 = canvas.clientWidth, h0 = canvas.clientHeight, aw = canvas.width, ah = canvas.height;
      canvas.width = aw + 16; canvas.height = ah + 16;
      var gw = canvas.clientWidth !== w0, gh = canvas.clientHeight !== h0;
      canvas.width = aw; canvas.height = ah;
      if (gw) canvas.style.width = '100%';
      if (gh) canvas.style.height = '100%';
    }

    function resize(cssW, cssH) {
      if (dead) return;
      var d = Math.min(DPR_CAP, win.devicePixelRatio || 1);
      var nw = Math.max(0, Math.round(cssW * d)), nh = Math.max(0, Math.round(cssH * d));
      if (d !== dpr) { dpr = d; sprites = buildSprites(d, pal); }
      W = cssW; H = cssH;
      if (nw !== canvas.width || nh !== canvas.height) { canvas.width = nw; canvas.height = nh; }
      cw = nw; ch = nh;
      draw(); // the backing store was cleared — repaint now, even when paused or static
      update();
    }
    function measure() { resize(canvas.clientWidth, canvas.clientHeight); }
    function onWinResize() {
      if (!win.ResizeObserver || Math.min(DPR_CAP, win.devicePixelRatio || 1) !== dpr) measure();
    }
    function onPointer(e) {
      tpx = -(e.clientX / (win.innerWidth || 1) * 2 - 1);
      tpy = -(e.clientY / (win.innerHeight || 1) * 2 - 1);
    }
    function onLeave() { tpx = 0; tpy = 0; }
    function onMotionPref() {
      reduced = !!mq.matches;
      if (reduced) settle();
      update();
    }

    function set(o) {
      if (dead || !o) return api;
      if ('windFromDeg' in o || 'windKmh' in o) takeWind(o, reduced);
      if ('pm25' in o) {
        capped = finite(o.pm25) && Math.round(o.pm25) > MAX_MOTES;
        retarget(countFor(o.pm25));
      }
      update();
      return api;
    }

    function destroy() {
      if (dead) return;
      dead = true;
      if (raf) win.cancelAnimationFrame(raf);
      raf = 0;
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      doc.removeEventListener('visibilitychange', update);
      win.removeEventListener('resize', onWinResize);
      if (parallax) {
        win.removeEventListener('pointermove', onPointer);
        doc.documentElement.removeEventListener('mouseleave', onLeave);
      }
      if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', onMotionPref); else if (mq.removeListener) mq.removeListener(onMotionPref); }
      motes = [[], [], []]; alive = [0, 0, 0];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.mixBlendMode = prevBlend;
      canvas.style.pointerEvents = prevPE;
      if (canvas.__aliveMotes === api) canvas.__aliveMotes = null;
    }

    var api = {
      set: set,
      destroy: destroy,
      /** the settled number of motes = Math.round(pm25) (0 with no reading, ≤300) */
      get count() { return target; },
      /** motes on the canvas right now, including any mid-fade */
      get visible() { var n = 0; for (var l = 0; l < 3; l++) for (var i = 0; i < motes[l].length; i++) if (motes[l][i].f > 0) n++; return n; },
      /** true when pm25 exceeds the 300-mote budget (the canvas then holds 300) */
      get capped() { return capped; },
      /** the blend in use: 'plus-lighter' (default), 'screen' (fallback) or 'normal' */
      get blend() { return blend; }
    };
    canvas.__aliveMotes = api;
    var prevPE = canvas.style.pointerEvents;
    if (!prevPE) canvas.style.pointerEvents = 'none'; // decoration never eats clicks

    // wire up
    if (win.ResizeObserver) {
      ro = new win.ResizeObserver(function (es) {
        var r = es[es.length - 1].contentRect;
        resize(r.width, r.height);
      });
      ro.observe(canvas);
    }
    if (win.IntersectionObserver) {
      io = new win.IntersectionObserver(function (es) {
        intersecting = es[es.length - 1].isIntersecting;
        update();
      });
      io.observe(canvas);
    }
    doc.addEventListener('visibilitychange', update);
    win.addEventListener('resize', onWinResize);
    if (parallax) {
      win.addEventListener('pointermove', onPointer, { passive: true });
      doc.documentElement.addEventListener('mouseleave', onLeave);
    }
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', onMotionPref); else if (mq.addListener) mq.addListener(onMotionPref); }

    if (target) ease = { from: 0, to: target, t0: 0, dur: clamp(0.9 + 0.028 * target, 1.4, 4) };
    pinIfIntrinsic();
    measure();
    if (reduced) settle();
    update();
    return api;
  }

  win.Motes = { mount: mount, MAX: MAX_MOTES, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : null);
