/* Alive webapp — journey. Live navigation over the picked /v2/plan
   option, then the arrival receipt.
   Progress = real nearest-point projection on the route LineString;
   dose-so-far = dose.mid spread along the route by the served
   per-segment pm25 strip (pm25-weighted arclength) — always labeled
   "plan estimate". Real GPS tracking when the device has it;
   otherwise an explicitly-labeled simulated preview at the plan's
   own pace (L/eta_s). Nothing here invents a number: every figure
   traces to the option fields, /v2/city, or the real clock. */
(() => {
'use strict';

const STORE_LAST = 'journey.last';
const STORE_HIST = 'journey.history';
const HIST_CAP = 20;
const ARRIVE_M = 55;          // puck this close to the destination → arrived
const OFFROUTE_M = 80;        // farther than this from the line → off-route note
const REV_MIN_MS = 25000;     // reverse-geocode throttle: time
const REV_MIN_M = 320;        // …and distance along route
/* WHO 24h PM2.5 guideline 15 µg/m³ × ~14.4 m³ breathed/day ≈ 216 µg —
   the same day-breath basis the engine cites in /v2/city breath.basis */
const WHO_DAY_UG = 15 * 14.4;

/* ── tiny geo kit ─────────────────────────────────────────────────── */
const K = Math.PI / 180;
function havM(aLat, aLon, bLat, bLon) {
  const dLa = (bLat - aLat) * K, dLo = (bLon - aLon) * K;
  const s = Math.sin(dLa / 2) ** 2 +
    Math.cos(aLat * K) * Math.cos(bLat * K) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
}
function bearingDeg(aLat, aLon, bLat, bLon) {
  const y = Math.sin((bLon - aLon) * K) * Math.cos(bLat * K);
  const x = Math.cos(aLat * K) * Math.sin(bLat * K) -
    Math.sin(aLat * K) * Math.cos(bLat * K) * Math.cos((bLon - aLon) * K);
  return (Math.atan2(y, x) / K + 360) % 360;
}
const lerpAng = (a, b, t) => {
  let d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmtDur(s) {
  if (s == null || !isFinite(s)) return '—';
  if (s < 60) return '<1 min';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/* ── route geometry: arclength table + nearest-point projection ───── */
function buildRoute(geom) {
  const pts = geom.coordinates;                       // [lon,lat][]
  const n = pts.length;
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++)
    cum[i] = cum[i - 1] + havM(pts[i - 1][1], pts[i - 1][0], pts[i][1], pts[i][0]);
  const L = cum[n - 1] || 1;
  const lat0 = pts.reduce((a, p) => a + p[1], 0) / n;
  // flat plane for projection — error < 0.3% across a Delhi trip
  const kx = 111320 * Math.cos(lat0 * K), ky = 110540;
  const xy = pts.map((p) => [p[0] * kx, p[1] * ky]);

  function project(lat, lon) {
    const px = lon * kx, py = lat * ky;
    let best = Infinity, bi = 0, bt = 0;
    for (let i = 0; i < n - 1; i++) {
      const ax = xy[i][0], ay = xy[i][1];
      const dx = xy[i + 1][0] - ax, dy = xy[i + 1][1] - ay;
      const len2 = dx * dx + dy * dy || 1e-9;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d2 = ex * ex + ey * ey;
      if (d2 < best) { best = d2; bi = i; bt = t; }
    }
    const gx = xy[bi][0] + bt * (xy[bi + 1][0] - xy[bi][0]);
    const gy = xy[bi][1] + bt * (xy[bi + 1][1] - xy[bi][1]);
    return {
      s: cum[bi] + bt * (cum[bi + 1] - cum[bi]),
      off: Math.sqrt(best),
      lat: gy / ky, lon: gx / kx,
    };
  }

  function pointAt(s) {
    s = clamp(s, 0, L);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; (cum[m] <= s ? lo = m : hi = m); }
    const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1e-9);
    return {
      lat: pts[lo][1] + t * (pts[hi][1] - pts[lo][1]),
      lon: pts[lo][0] + t * (pts[hi][0] - pts[lo][0]),
    };
  }

  function bearingAt(s, ahead = 70) {
    const a = pointAt(s), b = pointAt(s + ahead);
    return bearingDeg(a.lat, a.lon, b.lat, b.lon);
  }

  return { pts, cum, L, n, project, pointAt, bearingAt };
}

/* ── dose curve: plan dose spread by the real per-segment pm25 strip ──
   segments tile 0→1 in route fraction with served pm25; W(s)=∫pm25 ds
   so dose accumulates faster through the heavier stretches. Falls back
   to uniform when no strip was served. Always a plan estimate. */
function buildDose(option, L) {
  const total = (option.dose && option.dose.mid != null) ? option.dose.mid
    : (option.engine_dose_ug != null ? option.engine_dose_ug : null);
  const segs = (option.segments || [])
    .map((g) => ({ s0: g.start_frac * L, s1: g.end_frac * L, pm: g.pm25, dist: g.dist_m }))
    .filter((g) => g.pm != null && g.s1 > g.s0)
    .sort((a, b) => a.s0 - b.s0);
  if (total == null) return { total: null, at: () => null, pmAt: () => null, heaviest: () => null };
  if (!segs.length) {
    return {
      total,
      at: (s) => total * clamp(s / L, 0, 1),
      pmAt: () => null,
      heaviest: () => null,
    };
  }
  // prefix integral of pm25 over arclength
  const bp = [{ s: 0, w: 0 }];
  let w = 0;
  for (const g of segs) {
    w += g.pm * (g.s1 - Math.max(g.s0, bp[bp.length - 1].s));
    bp.push({ s: g.s1, w });
  }
  const W = bp[bp.length - 1].w || 1;
  function watt(s) {
    if (s <= 0) return 0;
    if (s >= L) return W;
    let acc = 0;
    for (const g of segs) {
      if (g.s0 >= s) break;
      acc += g.pm * (Math.min(s, g.s1) - g.s0);
    }
    return acc;
  }
  function pmAt(s) {
    for (const g of segs) if (s >= g.s0 && s < g.s1) return g.pm;
    return segs.length ? segs[segs.length - 1].pm : null;
  }
  function heaviest() {
    let best = null;
    for (const g of segs) if (!best || g.pm > best.pm) best = g;
    return best ? { pm25: best.pm, sMid: (best.s0 + best.s1) / 2,
      frac: ((best.s0 + best.s1) / 2) / L, dist: best.dist } : null;
  }
  return { total, at: (s) => total * (watt(s) / W), pmAt, heaviest };
}

/* ── current road: named steps where they exist, via_names else ──────
   steps carry lat/lon — project each onto arclength once; the road
   you're on is the street of the last named step behind you.
   via_names (ordered along the route) is the fallback, fraction-mapped. */
function buildRoads(option, route) {
  const named = (option.steps || [])
    .filter((st) => st.street && st.lat != null)
    .map((st) => ({ s: route.project(st.lat, st.lon).s, street: st.street }))
    .sort((a, b) => a.s - b.s);
  const vias = option.via_names || [];
  return function roadAt(s) {
    if (named.length) {
      let r = null;
      for (const st of named) { if (st.s <= s + 8) r = st.street; else break; }
      if (r) return r;
    }
    if (vias.length) {
      const i = clamp(Math.floor((s / route.L) * vias.length), 0, vias.length - 1);
      return vias[i];
    }
    return null;
  };
}

/* ══════════════════ the screen ══════════════════ */
A.screen('journey', {
  mount(el, params) {
    /* defend the handoff — anything missing goes back to whereto */
    const opt = params && params.option;
    const geom = opt && (opt.geometry || opt.route_geojson);
    const from = params && params.from, to = params && params.to;
    if (!opt || !geom || geom.type !== 'LineString' ||
        !Array.isArray(geom.coordinates) || geom.coordinates.length < 2 ||
        !from || !to || from.lat == null || from.lon == null ||
        to.lat == null || to.lon == null) {
      A.toast('no route to follow — pick a ride first');
      setTimeout(() => { A.back(); if (!A.current()) A.show('home'); }, 60);
      return () => {};
    }

    const route = buildRoute(geom);
    const dose = buildDose(opt, route.L);
    const roadAt = buildRoads(opt, route);
    const planKm = opt.distance_km != null ? opt.distance_km : route.L / 1000;
    const planEta = opt.eta_s != null ? opt.eta_s : null;

    const S = {
      mode: null,            // 'live' | 'preview'
      follow: true,
      s: 0, sMax: 0,
      pos: null,
      watchId: null, watchTimer: null,
      raf: 0, simMul: 1, simLast: 0, simElapsed: 0,
      liveAcc: 0, liveT0: 0,
      samples: [{ t: 0, dose: 0 }],
      sampleFloor: 0,
      bearing: null,
      done: false,
      offRoute: false,
      simUsed: false,
      lastRev: { t: 0, s: -1e9 },
      revName: null,
      gotFix: false,
      dead: false,
    };

    /* ── view ─────────────────────────────────────────────────────── */
    const toName = to.label || 'there';
    el.innerHTML = `
      <div class="jn">
        <div class="jn-top">
          <button class="jn-exit" type="button" aria-label="end journey">✕</button>
          <div class="jn-dest"><span class="jn-dest-to">to</span> <b>${esc(toName)}</b></div>
        </div>
        <div class="jn-offroute" hidden>off the planned route — finding your way back on</div>
        <div class="jn-nofix" hidden></div>
        <div class="jn-fabs">
          <button class="jn-fab jn-speed" type="button" hidden>×8</button>
          <button class="jn-fab jn-follow" type="button" aria-label="follow me" hidden>◎</button>
        </div>
        <div class="jn-hud">
          <div class="jn-flag" hidden>preview — simulated ride · plan pace</div>
          <div class="jn-main">
            <div class="jn-eta"><span class="jn-eta-v">–</span><span class="jn-eta-u"></span></div>
            <div class="jn-side">
              <div class="jn-dist"></div>
              <div class="jn-road"></div>
            </div>
          </div>
          <div class="jn-sub">
            <span class="jn-dose"><b></b><i></i></span>
            <span class="jn-speedlive" hidden></span>
          </div>
          <div class="jn-ctl">
            <button class="jn-end" type="button">end journey</button>
            <button class="jn-gps" type="button" hidden>follow my gps</button>
          </div>
          <div class="jn-confirm" hidden>
            <span>end this ride? the receipt covers what you did</span>
            <button class="jn-yes" type="button">end</button>
            <button class="jn-no" type="button">keep riding</button>
          </div>
        </div>
      </div>`;

    const $ = (q) => el.querySelector(q);
    const ui = {
      dest: $('.jn-dest b'), etaV: $('.jn-eta-v'), etaU: $('.jn-eta-u'),
      dist: $('.jn-dist'), road: $('.jn-road'),
      doseB: $('.jn-dose b'), doseI: $('.jn-dose i'),
      speedLive: $('.jn-speedlive'),
      offroute: $('.jn-offroute'), nofix: $('.jn-nofix'),
      flag: $('.jn-flag'), speedFab: $('.jn-speed'), followFab: $('.jn-follow'),
      endBtn: $('.jn-end'), gpsBtn: $('.jn-gps'),
      ctl: $('.jn-ctl'), confirm: $('.jn-confirm'),
      exit: $('.jn-exit'),
    };

    /* ── map dressing ─────────────────────────────────────────────── */
    A.map.hideAllRoutes();
    A.map.setFieldVisible(false);
    A.map.showRoute('journey', geom, opt.segments);
    A.map.pin('jfrom', route.pts[0][0], route.pts[0][1],
      '<div class="pin-dot"></div>');
    A.map.pin('jto', route.pts[route.n - 1][0], route.pts[route.n - 1][1],
      `<div class="pin-chip">${esc(toName.length > 18 ? toName.slice(0, 17) + '…' : toName)}</div>`);
    A.map.fit(geom, 84);

    /* ── HUD render (only what changed) ───────────────────────────── */
    let lastTxt = {};
    function set(elm, key, txt) {
      if (lastTxt[key] !== txt) { elm.textContent = txt; lastTxt[key] = txt; }
    }
    function render() {
      const frac = clamp(S.s / route.L, 0, 1);
      const remM = Math.max(0, route.L - S.s);
      const remS = planEta != null ? planEta * (1 - frac) : null;
      if (frac >= 0.985) {
        set(ui.etaV, 'ev', 'now'); set(ui.etaU, 'eu', '');
      } else {
        set(ui.etaV, 'ev', remS == null ? '–' : fmtDur(remS));
        set(ui.etaU, 'eu', '');
      }
      set(ui.dist, 'd', `${A.fmt.km(remM / 1000)} left`);
      const rd = roadAt(S.s) || S.revName;
      set(ui.road, 'r', rd || 'on the route');
      const d = dose.at(S.s);
      set(ui.doseB, 'db', d == null ? '—' : `~${Math.round(d)} µg`);
      set(ui.doseI, 'di', d == null ? 'no dose estimate' :
        ` breathed · ${S.mode === 'preview' ? 'simulated, ' : ''}plan estimate`);
      ui.offroute.hidden = !(S.mode === 'live' && S.offRoute);
    }

    /* ── camera ───────────────────────────────────────────────────── */
    function camera(lat, lon, instant) {
      if (!S.follow) return;
      const brg = route.bearingAt(S.s);
      const b = S.bearing == null ? brg : lerpAng(S.bearing, brg, 0.4);
      S.bearing = b;
      A.map.ready((m) => {
        m.easeTo({
          center: [lon, lat], zoom: Math.max(15.4, m.getZoom()),
          bearing: b, duration: instant ? 200 : 700,
        });
      });
    }
    const onDrag = () => {               // user panned → release follow
      if (S.dead) return;
      if (S.follow) { S.follow = false; ui.followFab.hidden = false; }
    };
    A.map.ready((m) => { m.on('dragstart', onDrag); });
    ui.followFab.addEventListener('click', () => {
      S.follow = true; ui.followFab.hidden = true;
      const p = S.pos || route.pointAt(S.s);
      camera(p.lat, p.lon, true);
    });

    /* ── progress intake (shared by live + preview) ───────────────── */
    function advance(lat, lon, opts) {
      if (S.done) return;
      const pr = route.project(lat, lon);
      S.s = Math.max(S.s, pr.s);          // progress only ratchets forward
      S.sMax = Math.max(S.sMax, S.s);
      S.offRoute = pr.off > OFFROUTE_M;
      A.map.puckMove(lat, lon, opts && opts.acc);
      if (S.follow) camera(lat, lon);
      // dose sample for the receipt curve — at most ~every 1.2s of ride
      const elapsed = elapsedNow();
      if (elapsed - S.sampleFloor >= 1.2) {
        S.sampleFloor = elapsed;
        S.samples.push({ t: elapsed, dose: dose.at(S.s) });
      }
      // throttled reverse name only when nothing better exists
      if (!roadAt(S.s) && S.s - S.lastRev.s > REV_MIN_M &&
          Date.now() - S.lastRev.t > REV_MIN_MS) {
        S.lastRev = { t: Date.now(), s: S.s };
        A.search.reverse(lat, lon).then((n) => {
          if (n && !S.done) { S.revName = n; render(); }
        });
      }
      render();
      const arrived = pr.off < OFFROUTE_M &&
        (S.s / route.L >= 0.985 || havM(lat, lon, to.lat, to.lon) < ARRIVE_M);
      if (arrived) finish(true);
    }

    /* ride clock: preview sim-seconds + live wall-seconds, added honestly */
    function elapsedNow() {
      const live = S.liveAcc + (S.mode === 'live' && S.liveT0 ? (Date.now() - S.liveT0) / 1000 : 0);
      return S.simElapsed + live;
    }

    /* ── live mode ────────────────────────────────────────────────── */
    function startLive() {
      S.mode = 'live';
      S.liveT0 = Date.now();
      ui.flag.hidden = true; ui.speedFab.hidden = true; ui.gpsBtn.hidden = true;
      S.watchId = A.geo.watch((pos) => {
        if (S.done || S.mode !== 'live') return;
        S.pos = pos; S.gotFix = true;
        ui.nofix.hidden = true;
        advance(pos.lat, pos.lon, { acc: pos.acc });
        if (pos.speed != null && pos.speed > 0.5) {
          ui.speedLive.hidden = false;
          ui.speedLive.textContent = `${Math.round(pos.speed * 3.6)} km/h`;
        } else ui.speedLive.hidden = true;
      });
      if (S.watchId == null) {           // no geolocation after all
        startPreview();
        return;
      }
      // honest "waiting on gps" state if the first fix is slow
      clearTimeout(S.watchTimer);
      S.watchTimer = setTimeout(() => {
        if (!S.gotFix && !S.done) {
          ui.nofix.textContent = 'waiting for gps… or ride the simulated preview';
          ui.nofix.hidden = false;
          ui.gpsBtn.hidden = true;
          ui.speedFab.hidden = true;
          showPreviewOffer();
        }
      }, 12000);
    }
    function showPreviewOffer() {
      ui.gpsBtn.hidden = true;
      // reuse the gps button slot as a preview switch
      const b = document.createElement('button');
      b.className = 'jn-gps'; b.type = 'button';
      b.textContent = 'preview instead';
      b.addEventListener('click', () => startPreview());
      ui.ctl.appendChild(b);
      ui.ctl._offer = b;
    }

    /* ── preview mode — simulated, honestly paced ─────────────────── */
    function startPreview() {
      if (S.done) return;
      if (S.mode === 'live') {
        if (S.watchId != null) { A.geo.clearWatch(S.watchId); S.watchId = null; }
        if (S.liveT0) { S.liveAcc += (Date.now() - S.liveT0) / 1000; S.liveT0 = 0; }
      }
      S.mode = 'preview';
      S.simUsed = true;
      ui.flag.hidden = false;
      ui.speedFab.hidden = false;
      ui.nofix.hidden = true;
      if (ui.ctl._offer) ui.ctl._offer.hidden = true;
      ui.gpsBtn.hidden = !navigator.geolocation;
      ui.speedFab.textContent = S.simMul === 1 ? '×8' : '×1';
      ui.speedFab.classList.toggle('on', S.simMul !== 1);
      // pace = plan pace: cover L in eta_s (realistic — never a teleport)
      const v = planEta != null && planEta > 0 ? route.L / planEta : null;
      if (v == null) {
        ui.flag.textContent = 'preview needs the plan eta — not served for this option';
        return;
      }
      if (!S.simLast) S.simLast = performance.now();
      if (S.raf) return;
      const tick = (now) => {
        if (S.done || S.mode !== 'preview') { S.raf = 0; return; }
        const dt = Math.min(0.5, (now - S.simLast) / 1000);   // tab-jank guard
        S.simLast = now;
        S.simElapsed += dt * S.simMul;
        S.s = Math.min(route.L, S.s + v * dt * S.simMul);
        S.sMax = S.s;
        const p = route.pointAt(S.s);
        S.pos = p;
        advance(p.lat, p.lon, {});
        if (!S.done) S.raf = requestAnimationFrame(tick);
      };
      S.raf = requestAnimationFrame(tick);
    }
    ui.speedFab.addEventListener('click', () => {
      S.simMul = S.simMul === 1 ? 8 : 1;
      ui.speedFab.textContent = S.simMul === 1 ? '×8' : '×1';
      ui.speedFab.classList.toggle('on', S.simMul !== 1);
      S.simLast = performance.now();
    });
    ui.gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      A.geo.consent = 'granted'; A.store.set('consent', 'granted');
      ui.gpsBtn.hidden = true;
      if (ui.ctl._offer) ui.ctl._offer.hidden = true;
      S.gotFix = false;
      startLive();
    });

    /* ── end / exit ───────────────────────────────────────────────── */
    ui.endBtn.addEventListener('click', () => {
      ui.ctl.hidden = true; ui.confirm.hidden = false;
    });
    $('.jn-no').addEventListener('click', () => {
      ui.confirm.hidden = true; ui.ctl.hidden = false;
    });
    $('.jn-yes').addEventListener('click', () => finish(false));
    ui.exit.addEventListener('click', () => {
      ui.ctl.hidden = true; ui.confirm.hidden = false;
    });

    /* ── the receipt ──────────────────────────────────────────────── */
    function finish(arrived) {
      if (S.done) return;
      S.done = true;
      if (S.watchId != null) { A.geo.clearWatch(S.watchId); S.watchId = null; }
      if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
      clearTimeout(S.watchTimer);

      const takenS = elapsedNow();
      const coveredM = S.sMax;
      const frac = clamp(coveredM / route.L, 0, 1);
      const doseDone = dose.at(coveredM);
      const heavy = dose.heaviest();

      // persist — the local ledger
      const rec = {
        t: Date.now(), arrived,
        from: { lat: from.lat, lon: from.lon, label: from.label || 'start' },
        to: { lat: to.lat, lon: to.lon, label: to.label || 'there' },
        vehicle: (params && params.vehicle) || (opt.mode || '').split('_')[0] || null,
        label: opt.label || opt.mode || null,
        km_plan: opt.distance_km ?? null, eta_plan_s: opt.eta_s ?? null,
        covered_km: coveredM / 1000, taken_s: Math.round(takenS),
        dose_ug: doseDone, dose_plan_ug: dose.total,
        simulated: S.simUsed,
      };
      A.store.set(STORE_LAST, rec);
      const hist = A.store.get(STORE_HIST, []);
      hist.unshift(rec);
      A.store.set(STORE_HIST, hist.slice(0, HIST_CAP));

      renderReceipt(rec, { frac, heavy });
    }

    async function renderReceipt(rec, extra) {
      const jn = $('.jn');
      if (jn) jn.remove();
      const optDose = dose.total;
      const isSim = rec.simulated;
      const dShown = rec.dose_ug;

      /* dose-over-time graph — honest samples, plan total as reference */
      const samples = S.samples.length ? S.samples : [{ t: 0, dose: 0 }];
      const tMax = Math.max(rec.taken_s, samples[samples.length - 1].t, 1);
      const dMax = Math.max(dShown || 0, optDose || 0, 1) * 1.08;
      const W = 320, H = 120, PADL = 30, PADB = 20, PADT = 8, PADR = 8;
      const iw = W - PADL - PADR, ih = H - PADT - PADB;
      const pts = samples.map((p) =>
        `${(PADL + (p.t / tMax) * iw).toFixed(1)},${(PADT + ih - (Math.max(0, p.dose || 0) / dMax) * ih).toFixed(1)}`);
      // heaviest stretch → time window it spans on this ride
      let heavyBand = '';
      if (extra.heavy) {
        const h = extra.heavy;
        const s0 = h.sMid - (h.dist || 0) / 2, s1 = h.sMid + (h.dist || 0) / 2;
        if (s1 > 0 && s0 < rec.covered_km * 1000) {
          const tA = tAtS(Math.max(0, s0)), tB = tAtS(Math.min(rec.covered_km * 1000, s1));
          const x0 = PADL + (tA / tMax) * iw, x1 = PADL + (tB / tMax) * iw;
          const hb = A.fmt.band(h.pm25);
          heavyBand = `<rect x="${x0.toFixed(1)}" y="${PADT}" width="${Math.max(2, x1 - x0).toFixed(1)}" height="${ih}"
            fill="${hb ? hb.wash : 'var(--w3)'}" />`;
        }
      }
      const planY = optDose != null
        ? PADT + ih - (optDose / dMax) * ih : null;
      const graph = `
        <svg class="jr-graph" viewBox="0 0 ${W} ${H}" role="img"
          aria-label="dose accumulated over the ride">
          ${heavyBand}
          ${planY != null ? `<line x1="${PADL}" x2="${W - PADR}" y1="${planY.toFixed(1)}" y2="${planY.toFixed(1)}"
            stroke="var(--ink4)" stroke-dasharray="3 3" stroke-width="1"/>` : ''}
          <polyline points="${pts.join(' ')}" fill="none"
            stroke="var(--accent-ink)" stroke-width="1.8" stroke-linejoin="round"/>
          <text x="${PADL - 4}" y="${PADT + 8}" class="jr-ax" text-anchor="end">µg</text>
          <text x="${PADL}" y="${H - 6}" class="jr-ax">0</text>
          <text x="${W - PADR}" y="${H - 6}" class="jr-ax" text-anchor="end">${tMax < 90 ? Math.round(tMax) + ' sec' : Math.round(tMax / 60) + ' min'}</text>
          ${planY != null ? `<text x="${W - PADR}" y="${Math.max(10, planY - 3).toFixed(1)}" class="jr-ax"
            text-anchor="end">plan ~${Math.round(optDose)}</text>` : ''}
        </svg>`;
      // seconds at arclength s on this ride — invert the samples
      function tAtS(sM) {
        const f = sM / route.L;
        // samples dose ↔ s via dose curve; approx by matching dose value
        const dAt = dose.at(sM);
        let best = 0, bd = Infinity;
        for (const p of samples) {
          const dd = Math.abs((p.dose || 0) - dAt);
          if (dd < bd) { bd = dd; best = p.t; }
        }
        return best || f * rec.taken_s;
      }

      /* verdict lines — only real cited comparisons */
      const vlines = [];
      if (dShown != null) {
        const pctTxt = (p) => p >= 1 ? `${Math.round(p)}%` : '<1%';
        vlines.push(`you breathed ~${Math.round(dShown)} µg of pm2.5 on this ride`);
        vlines.push(`≈ ${pctTxt((dShown / WHO_DAY_UG) * 100)} of a day at the WHO 24h guideline (15 µg/m³, ~216 µg breathed)`);
      } else {
        vlines.push('no dose estimate came back for this option — nothing to total up');
      }

      const rcEl = document.createElement('div');
      rcEl.className = 'jr';
      rcEl.innerHTML = `
        <div class="jr-sheet">
          <div class="jr-grab"></div>
          <div class="jr-head">
            <div class="jr-title">${rec.arrived ? 'arrived' : 'ride ended'} — ${esc(rec.to.label)}</div>
            <button class="jr-x" type="button" aria-label="done">✕</button>
          </div>
          <div class="jr-body">
            <div class="jr-sim" ${isSim ? '' : 'hidden'}>preview — simulated ride · the receipt uses plan pace</div>
            <div class="jr-stats">
              <div><div class="jr-sv">${A.fmt.km(rec.covered_km)}</div><div class="jr-sk">you covered${rec.arrived ? '' : ` of ${A.fmt.km(rec.km_plan)}`}</div></div>
              <div><div class="jr-sv">${fmtDur(rec.taken_s)}</div><div class="jr-sk">${isSim ? 'sim time' : 'it took'} · plan ${fmtDur(rec.eta_plan_s)}</div></div>
              <div><div class="jr-sv">${dShown == null ? '—' : '~' + Math.round(dShown)}</div><div class="jr-sk">µg · plan est.</div></div>
            </div>
            <div class="jr-glabel">dose over the ride <span>· ${isSim ? 'simulated' : 'along your track'} · plan estimate</span></div>
            ${graph}
            <div class="jr-heavy"></div>
            <div class="jr-verdict">${vlines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>
            <div class="jr-city muted">reading today's delhi average for the honest comparison…</div>
            <div class="jr-cta">
              <button class="btn-primary jr-back" type="button">plan the way back</button>
              <button class="btn-ghost jr-done" type="button">done</button>
            </div>
          </div>
        </div>`;
      el.appendChild(rcEl);
      requestAnimationFrame(() => requestAnimationFrame(() =>
        rcEl.querySelector('.jr-sheet').classList.add('on')));

      // heaviest stretch callout — real segment pm25 + where it sits
      const heavyEl = rcEl.querySelector('.jr-heavy');
      if (extra.heavy) {
        const h = extra.heavy;
        const b = A.fmt.band(h.pm25);
        const where = roadAt(h.sMid) || null;
        const paint = (place) => {
          heavyEl.innerHTML =
            `heaviest stretch · <b style="color:${b ? b.color : 'var(--ink)'}">${Math.round(h.pm25)} µg/m³</b>` +
            `${b ? ` · ${b.name}` : ''}${place ? ` — around ${esc(place)}` : ''}` +
            (fracOf(h) < 1 ? ` <span class="muted">(you${rec.arrived ? '' : ' only'} rode ${Math.round(fracOf(h) * 100)}% of it)</span>` : '');
        };
        function fracOf(hv) {
          const s0 = hv.sMid - (hv.dist || 0) / 2;
          return clamp((rec.covered_km * 1000 - s0) / (hv.dist || 1), 0, 1);
        }
        if (where) paint(where);
        else {
          const pt = route.pointAt(h.sMid);
          A.search.reverse(pt.lat, pt.lon).then((n) => { if (rcEl.isConnected) paint(n || 'mid-route'); });
        }
      }

      /* live city comparison — /v2/city pm25_stats.mean × 14.4 m³/day */
      if (dShown != null) {
        A.api.get('/v2/city', 9000).then((city) => {
          const m = city && city.pm25_stats && city.pm25_stats.mean;
          const cel = rcEl.querySelector('.jr-city');
          if (!cel || !cel.isConnected) return;
          if (m != null && m > 0) {
            const dayUg = m * 14.4;
            const pctRaw = (dShown / dayUg) * 100;
            const pct = pctRaw >= 1 ? `${Math.round(pctRaw)}%` : '<1%';
            // equal-breath minutes in today's average air
            const conc = opt.dose && opt.dose.avg_conc_ugm3;
            let eq = null;
            if (conc && rec.eta_plan_s) {
              const vent = (optDose || dShown) / (conc * (rec.eta_plan_s / 60)); // m³/min implied
              if (vent > 0) eq = Math.round(dShown / (m * vent));
            }
            cel.classList.remove('muted');
            cel.innerHTML =
              `≈ <b>${pct}</b> of a day breathing delhi's current average ` +
              `(${Math.round(m)} µg/m³ field mean now)` +
              (eq != null && eq >= 1 ? ` — like <b>${eq} min</b> in that average air` : '');
          } else {
            cel.textContent = 'delhi\'s average didn\'t come back — the per-ride numbers above still stand';
          }
        });
      } else {
        const cel = rcEl.querySelector('.jr-city');
        if (cel) cel.remove();
      }

      rcEl.querySelector('.jr-back').addEventListener('click', () => {
        const swap = {
          from: { lat: to.lat, lon: to.lon, label: to.label || 'here' },
          to: { lat: from.lat, lon: from.lon, label: from.label || 'back' },
        };
        A.back();                                   // cleans this screen fully
        A.show('whereto', swap, true);              // replaces old whereto
      });
      const doneFns = () => A.back();
      rcEl.querySelector('.jr-done').addEventListener('click', doneFns);
      rcEl.querySelector('.jr-x').addEventListener('click', doneFns);
      // keep the route on the map behind the receipt — it's the story
    }

    /* ── choose the mode, start the engine ────────────────────────── */
    if (navigator.geolocation && A.geo.consent === 'granted') startLive();
    else startPreview();

    return () => {
      S.dead = true; S.done = true;
      if (S.watchId != null) A.geo.clearWatch(S.watchId);
      if (S.raf) cancelAnimationFrame(S.raf);
      clearTimeout(S.watchTimer);
      A.map.ready((m) => { m.off('dragstart', onDrag); });
      A.map.hideRoute('journey');
      A.map.unpin('jfrom'); A.map.unpin('jto');
      A.map.puckRemove();
      A.map.ready((m) => { if (m.getBearing() !== 0) m.easeTo({ bearing: 0, duration: 500 }); });
    };
  },
});
})();
