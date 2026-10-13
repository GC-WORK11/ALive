#!/usr/bin/env node
/* ALive webapp defect-repro harness (QA lane, Oct 12).

   Drives the real /app/ in real Chrome via playwright-core and reproduces
   the user-reported defects, printing measured observations (positions,
   hit-tests, zoom deltas, route/sheet overlap) — not just screenshots.

   Usage:
     node tools/qa-oct12/e2e.mjs [--preset desktop|phone|both] [--nogl]
              [--scenario all|boot|zoom|from|routes|airmap]   (comma list ok)
              [--out DIR] [--tag NAME] [--headed] [--slowms N]

   Env:
     BASE     app URL          (default http://localhost:8909/app/?internal=1)
     CHROME   chrome binary    (default ~/.local/bin/google-chrome wrapper)
     PW_NODE_MODULES  dir that contains playwright-core (auto-detected:
                      repo node_modules, /home/govinda/re, /tmp/pwtest, hermes)

   GL modes:
     default — headless WebGL via SwiftShader (--use-angle=swiftshader
               --enable-unsafe-swiftshader) → MapLibre path. On a real laptop
               the GPU does this natively; headless needs the flag set.
     --nogl  — --disable-webgl --disable-webgl2 --disable-gpu → the app's
               Leaflet "basic" fallback (what the user's laptop hits).

   Serve the app first:
     cd server && set -a && . ~/.config/alive-ops/keys.env && set +a &&
       .venv/bin/python -m uvicorn main:app --port 8909

   Output: <out>/<preset>-<glmode>-<scenario>-*.png + <out>/results-<tag>.json
   Exit 0 always — this measures, it does not gate. Read the printed OBSERVED
   lines and results JSON. */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* ── playwright-core resolution ────────────────────────────────────── */
const PW_DIRS = [
  process.env.PW_NODE_MODULES,
  path.join(HERE, 'node_modules'),
  path.join(HERE, '..', '..', 'node_modules'),
  '/home/govinda/re/node_modules',
  '/tmp/pwtest/node_modules',
  '/home/govinda/.hermes/hermes-agent/node_modules',
  '/home/govinda/.local/lib/node_modules',
].filter(Boolean);
let chromium = null, pwFrom = null;
for (const d of PW_DIRS) {
  try {
    const req = createRequire(path.join(d, 'x.js'));
    chromium = req('playwright-core').chromium;
    if (chromium) { pwFrom = d; break; }
  } catch (e) { /* next candidate */ }
}
if (!chromium) {
  console.error('playwright-core not found. Set PW_NODE_MODULES to a dir containing it.');
  process.exit(1);
}

/* ── args / config ─────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);
if (has('help') || has('h')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(0, 38).join('\n')); process.exit(0); }

const BASE = process.env.BASE || 'http://localhost:8909/app/?internal=1';
const CHROME = process.env.CHROME || '/home/govinda/.local/bin/google-chrome';
const NOGL = has('nogl');
const HEADED = has('headed');
const SLOW = +arg('slowms', 0);
const PRESETS = {
  desktop: { width: 1366, height: 850, isMobile: false, hasTouch: false },
  phone:   { width: 390, height: 844, isMobile: true, hasTouch: true },
};
const presetSel = arg('preset', 'both');
const presetNames = presetSel === 'both' ? ['desktop', 'phone'] : presetSel.split(',');
const SCEN = arg('scenario', 'all');
const scenList = SCEN === 'all' ? ['boot', 'zoom', 'from', 'routes', 'airmap'] : SCEN.split(',');
const OUT = path.resolve(arg('out', path.join(HERE, 'shots-baseline')));
const TAG = arg('tag', 'run');
const GEO = { latitude: 28.6139, longitude: 77.2090, accuracy: 32 };   // Connaught Place
const GL_ARGS = NOGL
  ? ['--disable-webgl', '--disable-webgl2', '--disable-gpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { base: BASE, chrome: CHROME, nogl: NOGL, playwright: pwFrom, ranAt: new Date().toISOString(), runs: [] };
const say = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

/* ── browser session ───────────────────────────────────────────────── */
let browser = null;
async function newPage(presetName, { seedPos = true, geoDelay = 0 } = {}) {
  const vp = PRESETS[presetName];
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile, hasTouch: vp.hasTouch,
    geolocation: GEO, permissions: ['geolocation'],
  });
  await context.addInitScript(({ seedPos, geoDelay }) => {
    /* returning, consented user — the consent gate must NOT re-open.
       consent_v=2 is the home lane's "answered on this build" marker. */
    try {
      localStorage.setItem('alive.consent', '"granted"');
      localStorage.setItem('alive.consent_v', '2');
      localStorage.setItem('alive.onboarded', 'true');
      if (seedPos) localStorage.setItem('alive.pos',
        JSON.stringify({ lat: 28.6139, lon: 77.2090, t: Date.now(), acc: 32, label: 'Connaught Place' }));
      else localStorage.removeItem('alive.pos');
    } catch (e) {}
    /* geoDelay simulates a real-device fix taking geoDelay ms (headless
       geolocation answers instantly, which would mask the mount race) */
    if (geoDelay && navigator.geolocation) {
      const wp = navigator.geolocation.watchPosition.bind(navigator.geolocation);
      const cp = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
      const lag = (fn) => (p) => setTimeout(() => fn(p), geoDelay);
      navigator.geolocation.watchPosition = (ok, err, o) => wp(lag(ok), err, o);
      navigator.geolocation.getCurrentPosition = (ok, err, o) => cp(lag(ok), err, o);
    }
  }, { seedPos, geoDelay });
  const page = await context.newPage();
  const rec = { errors: [], consoleErr: [], failedReq: [], page, context };
  page.on('pageerror', (e) => rec.errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') rec.consoleErr.push(m.text().slice(0, 300)); });
  page.on('requestfailed', (r) => rec.failedReq.push(`${r.url().slice(0, 110)} :: ${(r.failure() || {}).errorText}`));
  if (SLOW) context.setDefaultTimeout(SLOW);
  return rec;
}

async function shot(page, preset, name) {
  const f = path.join(OUT, `${preset}-${NOGL ? 'nogl' : 'gl'}-${TAG}-${name}.png`);
  try { await page.screenshot({ path: f }); } catch (e) { say('shot failed', name, e.message); }
  return f;
}

/* ── shared page probes ────────────────────────────────────────────── */
async function mapInfo(page) {
  return page.evaluate(() => {
    const out = { hasA: !!window.A, basemap: null, zoom: null, center: null, engine: null };
    try {
      const c = document.createElement('canvas');
      out.webgl = !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
    } catch (e) { out.webgl = 'err'; }
    out.leaflet = !!document.querySelector('.leaflet-container');
    out.maplibre = !!document.querySelector('.maplibregl-canvas');
    out.noglNote = !!document.querySelector('.map-nogl');
    if (window.A && A.map) {
      out.basemap = A.map.basemap;
      const m = A.map.map;
      if (m) {
        out.engine = m.getZoom ? (m instanceof (window.L && L.Map || Object) ? 'leaflet' : 'maplibre') : '?';
        try { out.zoom = +m.getZoom().toFixed(2); } catch (e) {}
        try { const c2 = m.getCenter(); out.center = [+c2.lat.toFixed(4), +c2.lng.toFixed(4)]; } catch (e) {}
        try { out.layers = m.getStyle ? m.getStyle().layers.map((l) => l.id).filter((id) => /^route-|^jam/.test(id)) : null; } catch (e) {}
      }
    }
    return out;
  });
}

/* hit-test: what element sits at (x,y)? describe it compactly */
function hitTest(page, x, y) {
  return page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return { hit: null };
    const path = [];
    let n = el;
    while (n && path.length < 6) {
      path.push(n.tagName.toLowerCase() + (n.className && typeof n.className === 'string' ? '.' + n.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '') + (n.id ? '#' + n.id : ''));
      n = n.parentElement;
    }
    const inSheet = !!el.closest('.sheet'), inScreen = !!el.closest('.screen'),
      inHome = !!el.closest('.home-panel'), inComposer = !!el.closest('.am-scw,.am-read,.am-chip'),
      inMap = !!el.closest('#map');
    return { hit: path.join(' < '), inSheet, inScreen, inHome, inComposer, inMap };
  }, [x, y]);
}

/* find a viewport point whose hit-test lands inside #map, and measure what
   share of the viewport is reachable map at all (grid probe). */
async function findMapPoint(page, { yMin = 0, yMax = 1 } = {}) {
  const pts = await page.evaluate(([yMin, yMax]) => {
    const W = innerWidth, H = innerHeight, out = [];
    for (let fy = yMin; fy <= yMax + 1e-6; fy += 0.05)
      for (let fx = 0.02; fx < 1; fx += 0.05)
        out.push([Math.round(W * fx), Math.round(H * fy)]);
    return out;
  }, [yMin, yMax]);
  let free = 0, first = null;
  const cover = {};
  for (const [x, y] of pts) {
    const h = await hitTest(page, x, y);
    const ok = h.inMap && !h.inSheet && !h.inScreen && !h.inComposer && !h.inHome;
    if (ok) { free++; if (!first) first = { x, y, hit: h.hit }; }
    else { const k = h.hit ? h.hit.split(' < ')[0] : 'null'; cover[k] = (cover[k] || 0) + 1; }
  }
  const topCover = Object.entries(cover).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}×${v}`);
  return { point: first, probed: pts.length, free, freeFrac: +(free / pts.length).toFixed(2), topCover };
}

/* fraction of viewport width covered by the open .sheet (desktop rail) */
async function sheetRect(page) {
  return page.evaluate(() => {
    const sh = document.querySelector('.screen.on .sheet');
    if (!sh) return null;
    const r = sh.getBoundingClientRect();
    return { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) };
  });
}

async function zoomControls(page) {
  return page.evaluate(() => {
    const sel = ['.maplibregl-ctrl-zoom-in', '.maplibregl-ctrl-zoom-out',
      '.leaflet-control-zoom-in', '.leaflet-control-zoom-out'];
    return sel.map((s) => {
      const el = document.querySelector(s);
      if (!el) return { sel: s, present: false };
      const r = el.getBoundingClientRect();
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return {
        sel: s, present: true,
        rect: { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0) },
        visibleCss: getComputedStyle(el).display !== 'none' && +getComputedStyle(el).opacity > 0,
        coveredBy: top ? (top === el || el.contains(top) ? null :
          top.tagName.toLowerCase() + '.' + String(top.className).split(' ')[0] +
          (top.closest('.sheet') ? '(in .sheet)' : top.closest('.screen') ? '(in .screen)' : top.closest('.home-panel') ? '(in .home-panel)' : '')) : 'offscreen',
      };
    });
  });
}

async function zoomVal(page) { const i = await mapInfo(page); return i.zoom; }

/* click the real zoom-in button coordinates with the real mouse; report delta */
async function tryZoomClick(page, selSuffix) {
  const z0 = await zoomVal(page);
  const ctr = await page.evaluate((suf) => {
    const el = document.querySelector('.maplibregl-ctrl-zoom' + suf) || document.querySelector('.leaflet-control-zoom' + suf);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selSuffix);
  if (!ctr) return { present: false };
  await page.mouse.move(ctr.x, ctr.y);
  await page.mouse.down(); await page.mouse.up();
  await sleep(700);
  const z1 = await zoomVal(page);
  return { present: true, at: ctr, zoomBefore: z0, zoomAfter: z1, worked: z1 != null && z0 != null && Math.abs(z1 - z0) > 0.01 };
}

async function wheelZoom(page, x, y, dy = -300) {
  const z0 = await zoomVal(page);
  await page.mouse.move(x, y);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, dy / 4); await sleep(140); }
  await sleep(700);
  const z1 = await zoomVal(page);
  return { zoomBefore: z0, zoomAfter: z1, worked: z1 != null && z0 != null && Math.abs(z1 - z0) > 0.05 };
}

/* ── scenario: boot ────────────────────────────────────────────────── */
async function scBoot(page, preset, rec) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(6000);
  const info = await mapInfo(page);
  await shot(page, preset, 'boot-home');
  say(`  [boot ${preset}] engine=${info.basemap} webgl=${info.webgl} zoom=${info.zoom} leaflet=${info.leaflet} maplibre=${info.maplibre} nogl-note=${info.noglNote}`);
  return { mapInfo: info };
}

/* ── scenario: zoom controls ───────────────────────────────────────── */
async function scZoom(page, preset) {
  const out = {};
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await sleep(6000);
  out.home = { controls: await zoomControls(page), sheet: await sheetRect(page) };
  out.home.mapProbe = await findMapPoint(page);
  const mp = out.home.mapProbe.point;
  if (mp) out.home.wheel = await wheelZoom(page, mp.x, mp.y);
  out.home.clickIn = await tryZoomClick(page, '-in');
  await shot(page, preset, 'zoom-home');

  /* same probe with the whereto sheet open */
  await page.evaluate(() => { location.hash = '#/whereto'; });
  await sleep(2600);
  out.whereto = { controls: await zoomControls(page), sheet: await sheetRect(page) };
  out.whereto.mapProbe = await findMapPoint(page);
  const mp2 = out.whereto.mapProbe.point;
  out.whereto.clickIn = await tryZoomClick(page, '-in');
  if (mp2) out.whereto.wheel = await wheelZoom(page, mp2.x, mp2.y);
  await shot(page, preset, 'zoom-whereto');
  await page.evaluate(() => { window.A && A.back ? A.back() : history.back(); });
  await sleep(900);

  for (const [where, o] of Object.entries(out)) {
    if (!o.controls) continue;
    for (const c of o.controls.filter((c) => c.present)) {
      say(`  [zoom ${preset} ${where}] ${c.sel} rect=${JSON.stringify(c.rect)} coveredBy=${c.coveredBy || 'nothing'}`);
    }
    if (o.clickIn) say(`  [zoom ${preset} ${where}] click + ⇒ zoom ${o.clickIn.zoomBefore}→${o.clickIn.zoomAfter} worked=${o.clickIn.worked}`);
    if (o.wheel) say(`  [zoom ${preset} ${where}] wheel ⇒ zoom ${o.wheel.zoomBefore}→${o.wheel.zoomAfter} worked=${o.wheel.worked}`);
    if (o.sheet) say(`  [zoom ${preset} ${where}] sheet rect=${JSON.stringify(o.sheet)}`);
    say(`  [zoom ${preset} ${where}] reachable map: ${o.mapProbe.free}/${o.mapProbe.probed} (${o.mapProbe.freeFrac * 100}%)` +
      (o.mapProbe.point ? ` first free ${o.mapProbe.point.x},${o.mapProbe.point.y}` : ' — NO reachable map pixel') +
      ` top cover: ${o.mapProbe.topCover.join(', ')}`);
  }
  return out;
}

/* ── scenario: From default ────────────────────────────────────────── */
async function scFrom(page, preset, rec) {
  const out = {};
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });   // pos NOT seeded → locate() races mount
  /* open where-to the instant the shell exists — before the geo fix lands */
  await page.waitForFunction(() => window.A && A.screensReady && A.screensReady.whereto, { timeout: 15000 });
  await page.evaluate(() => { location.hash = '#/whereto'; });
  await page.waitForSelector('.wt-rrow', { timeout: 10000 }).catch(() => {});
  await sleep(400);
  const readRows = () => page.evaluate(() => {
    const rows = [...document.querySelectorAll('.wt-rrow')].map((r) => ({
      which: r.dataset.arm,
      armed: r.classList.contains('edit'),
      text: (r.querySelector('.wt-rval') && r.querySelector('.wt-rval').textContent
        || (r.querySelector('.wt-rin') && (r.querySelector('.wt-rin').value || r.querySelector('.wt-rin').placeholder)) || '').trim(),
      ph: !!(r.querySelector('.wt-rval') && r.querySelector('.wt-rval').classList.contains('ph')),
    }));
    return { rows, geoPos: window.A && A.geo && A.geo.pos ? { lat: A.geo.pos.lat, acc: A.geo.pos.acc, t: A.geo.pos.t } : null };
  });
  out.atMount = await readRows();
  await shot(page, preset, 'from-race-open');
  /* give the boot-time geo.locate() time to land, then re-read the row —
     does the From slot backfill the late fix? */
  await sleep(6000);
  out.afterFix = await readRows();
  await shot(page, preset, 'from-race-later');
  say(`  [from ${preset} race] at mount: from="${(out.atMount.rows.find(r => r.which === 'from') || {}).text}" ph=${(out.atMount.rows.find(r => r.which === 'from') || {}).ph} geoPos=${JSON.stringify(out.atMount.geoPos)}`);
  say(`  [from ${preset} race] +6s:   from="${(out.afterFix.rows.find(r => r.which === 'from') || {}).text}" ph=${(out.afterFix.rows.find(r => r.which === 'from') || {}).ph} geoPos=${JSON.stringify(out.afterFix.geoPos)}`);
  return out;
}
async function scFromWarm(page, preset) {
  /* returning user WITH a stored position — the control case */
  const rec2 = { };
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.A && A.screensReady && A.screensReady.whereto, { timeout: 15000 });
  await sleep(1500);
  await page.evaluate(() => { location.hash = '#/whereto'; });
  await page.waitForSelector('.wt-rrow', { timeout: 10000 }).catch(() => {});
  await sleep(400);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.wt-rrow')].map((r) => ({
    which: r.dataset.arm, text: (r.querySelector('.wt-rval')?.textContent || '').trim(),
  })));
  say(`  [from ${preset} warm] from="${(rows.find(r => r.which === 'from') || {}).text}"`);
  return { rows };
}

/* ── scenario: from→to routes ──────────────────────────────────────── */
async function scRoutes(page, preset, rec) {
  const out = { steps: [] };
  const step = (s) => { out.steps.push(s); say(`  [routes ${preset}] ${s}`); };
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.A && A.screensReady && A.screensReady.whereto, { timeout: 15000 });
  await sleep(1200);
  await page.evaluate(() => { location.hash = '#/whereto'; });
  await page.waitForSelector('.wt-rin', { timeout: 10000 });

  /* To = Nehru Place */
  await page.click('.wt-rrow.edit[data-arm="to"] .wt-rin').catch(() => page.click('.wt-rin'));
  await page.keyboard.type('Nehru Place', { delay: 30 });
  await page.waitForSelector('.wt-list .wt-row[data-k]', { timeout: 12000 });
  const firstRow = await page.evaluate(() => document.querySelector('.wt-list .wt-row[data-k]')?.textContent.trim().slice(0, 80));
  step(`search rows painted; picking first: "${firstRow}"`);
  await shot(page, preset, 'routes-search');
  await page.click('.wt-list .wt-row[data-k]');
  await page.waitForSelector('.wt-mode', { timeout: 8000 });
  step('modes shown');
  await shot(page, preset, 'routes-modes');

  /* Health Maxer → vehicle car → petrol → plan */
  await page.click('.wt-mode[data-mode="health_max"]').catch(() => page.click('.wt-mode'));
  await page.waitForSelector('.wt-vcard', { timeout: 8000 });
  await shot(page, preset, 'routes-vehicle');
  await page.click('.wt-vcard[data-k="car"]');
  await sleep(600);
  const fuel = await page.$('.wt-vcard[data-k="petrol"]');
  if (fuel) { await fuel.click(); step('vehicle car+petrol'); } else step('vehicle picked (no fuel step)');
  step('waiting for /v2/plan options…');
  await page.waitForSelector('.wt-opt', { timeout: 45000 }).catch(() => {});
  await sleep(2500);   // fit camera animation + route paint settle
  out.map = await mapInfo(page);
  out.sheet = await sheetRect(page);
  await shot(page, preset, 'routes-painted');
  step(`options=${await page.locator('.wt-opt').count()} engine=${out.map.basemap} routeLayers=${JSON.stringify(out.map.layers)}`);
  /* pinEnds() drops wt-a/wt-b markers after painting — their absence is a
     marker for the paintRoutes crash path */
  out.endPins = await page.evaluate(() => ({
    pinEls: document.querySelectorAll('.alive-pin').length,
    wtPins: document.querySelectorAll('.wt-endpin').length,
    center: (() => { try { const c = A.map.map.getCenter(); return [+c.lat.toFixed(4), +c.lng.toFixed(4)]; } catch (e) { return null; } })(),
    zoom: (() => { try { return +A.map.map.getZoom().toFixed(2); } catch (e) { return null; } })(),
  }));
  step(`endPins=${JSON.stringify(out.endPins)} (delhi default cam = 28.6139,77.209 z11/10.2)`);

  /* measure: how much of the painted route sits under the sheet? */
  out.occlusion = await page.evaluate(() => {
    const sh = document.querySelector('.screen.on .sheet');
    const sheetR = sh ? sh.getBoundingClientRect() : null;
    const m = window.A && A.map && A.map.map;
    const inR = (x, y, r) => r && x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
    /* MapLibre path: project route source coords */
    if (m && m.getSource) {
      const srcs = Object.keys(m.getStyle().sources).filter((k) => /^route-wt\d+$/.test(k));
      const per = {};
      let tot = 0, under = 0;
      for (const s of srcs) {
        const data = m.getSource(s).serialize ? m.getSource(s).serialize().data : null;
        const coords = data && (data.coordinates || (data.geometry && data.geometry.coordinates) ||
          (data.features && data.features.flatMap((f) => f.geometry.coordinates)));
        if (!coords || !coords.length) continue;
        let u = 0;
        const pts = coords.map((c) => m.project(c));
        for (const p of pts) { tot++; if (inR(p.x, p.y, sheetR)) u++; }
        /* also the visible bbox of the projected route */
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        per[s] = { pts: pts.length, underSheet: u,
          bbox: { x: +Math.min(...xs).toFixed(0), y: +Math.min(...ys).toFixed(0), w: +(Math.max(...xs) - Math.min(...xs)).toFixed(0), h: +(Math.max(...ys) - Math.min(...ys)).toFixed(0) } };
        under += u;
      }
      return { engine: 'maplibre', srcs, per, totalPts: tot, underSheetPts: under, sheet: sheetR && { x: sheetR.x, w: sheetR.width },
        view: { w: innerWidth, h: innerHeight }, center: m.getCenter(), zoom: +m.getZoom().toFixed(2) };
    }
    /* Leaflet path: overlay svg path bboxes */
    const paths = [...document.querySelectorAll('.leaflet-overlay-pane svg path')];
    const per = paths.map((p) => { const r = p.getBoundingClientRect(); return { x: +r.x.toFixed(0), y: +r.y.toFixed(0), w: +r.width.toFixed(0), h: +r.height.toFixed(0), underSheet: inR(r.x + r.width / 2, r.y + r.height / 2, sheetR) }; });
    return { engine: 'leaflet', pathCount: paths.length, bboxes: per, sheet: sheetR && { x: sheetR.x, w: sheetR.width }, zoom: m && m.getZoom ? m.getZoom() : null };
  });
  step(`occlusion: ${JSON.stringify(out.occlusion).slice(0, 600)}`);
  if (rec.errors.length) step(`pageerrors: ${rec.errors.join(' | ').slice(0, 400)}`);
  if (rec.consoleErr.length) step(`console errors: ${rec.consoleErr.slice(0, 4).join(' | ').slice(0, 400)}`);
  return out;
}

/* drive the whereto plan flow quickly (shared by 'routes' and the
   '--afterplan' airmap variant — searches stall while the server's
   route engine is still saturated) */
async function drivePlan(page, preset, shot_) {
  await page.evaluate(() => { location.hash = '#/whereto'; });
  await page.waitForSelector('.wt-rin', { timeout: 10000 });
  await page.click('.wt-rin');
  await page.keyboard.type('Nehru Place', { delay: 25 });
  await page.waitForSelector('.wt-list .wt-row[data-k]', { timeout: 12000 });
  await page.click('.wt-list .wt-row[data-k]');
  await page.waitForSelector('.wt-mode', { timeout: 8000 });
  await page.click('.wt-mode[data-mode="health_max"]').catch(() => page.click('.wt-mode'));
  await page.waitForSelector('.wt-vcard', { timeout: 8000 });
  await page.click('.wt-vcard[data-k="car"]');
  await sleep(500);
  const fuel = await page.$('.wt-vcard[data-k="petrol"]');
  if (fuel) await fuel.click();
  await page.waitForSelector('.wt-opt', { timeout: 45000 }).catch(() => {});
  await sleep(1200);
}

/* ── scenario: airmap search + pin ─────────────────────────────────── */
async function scAirmap(page, preset, rec) {
  const out = {};
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.A && A.screensReady && A.screensReady.airmap, { timeout: 15000 });
  if (has('afterplan')) {
    say(`  [airmap ${preset}] --afterplan: running the route plan first, then searching while the engine is hot`);
    await drivePlan(page, preset);
  } else {
    await sleep(1000);
  }
  await page.evaluate(() => { location.hash = '#/airmap'; });
  await page.waitForSelector('.am-sc-in', { timeout: 12000 });
  await sleep(2500);
  out.map = await mapInfo(page);
  out.sheet = await sheetRect(page);
  await shot(page, preset, 'airmap-open');

  /* (c) the floating search composer */
  const apiHits = [];
  page.on('response', (r) => { if (/\/v2\/(ac|search|p\/ac)/.test(r.url())) apiHits.push(`${r.status()} ${r.url().slice(0, 110)}`); });
  await page.click('.am-sc-in');
  await page.keyboard.type('connaught', { delay: 40 });
  await page.waitForSelector('.am-slist .am-srow, .am-slist .am-squiet', { timeout: 12000 }).catch(() => {});
  await sleep(2500);
  out.search = await page.evaluate(() => ({
    listHidden: document.querySelector('.am-slist')?.hidden,
    rows: document.querySelectorAll('.am-slist .am-srow').length,
    firstRows: [...document.querySelectorAll('.am-slist .am-srow .am-srt-t')].slice(0, 4).map((e) => e.textContent.trim()),
    quiet: document.querySelector('.am-slist .am-squiet')?.textContent || null,
    prog: !!document.querySelector('.am-slist .am-sprog'),
  }));
  out.search.apiHits = apiHits;
  say(`  [airmap ${preset}] search: rows=${out.search.rows} first=${JSON.stringify(out.search.firstRows)} quiet=${out.search.quiet} prog=${out.search.prog}`);
  say(`  [airmap ${preset}] search api hits: ${apiHits.length ? apiHits.join(' ; ') : 'NONE'}`);
  await shot(page, preset, 'airmap-search');

  /* pick the top row → the map should fly + pin + readout */
  if (out.search.rows) {
    await page.click('.am-slist .am-srow');
    await sleep(2500);
    out.picked = await page.evaluate(() => ({
      read: document.querySelector('.am-read') && !document.querySelector('.am-read').hidden
        ? document.querySelector('.am-read').textContent.trim().slice(0, 120) : null,
      pin: !!document.querySelector('.am-tappin'),
      inputVal: document.querySelector('.am-sc-in')?.value,
    }));
    say(`  [airmap ${preset}] picked: read="${out.picked.read}" pin=${out.picked.pin} input="${out.picked.inputVal}"`);
    await shot(page, preset, 'airmap-picked');
    /* reset composer so a raw map tap is a raw map tap */
    await page.click('.am-sc-x').catch(() => {});
    await sleep(800);
  }

  /* (d) drop a pin: first locate a viewport pixel that is actually map */
  const probe = await findMapPoint(page);
  out.mapProbe = probe;
  const mp = probe.point;
  say(`  [airmap ${preset}] reachable map: ${probe.free}/${probe.probed} (${probe.freeFrac * 100}%) top cover: ${probe.topCover.join(', ')}`);
  if (mp) {
    say(`  [airmap ${preset}] map point found at ${mp.x},${mp.y} (${mp.hit})`);
    await page.mouse.click(mp.x, mp.y);
    await sleep(2200);
    out.tap = await page.evaluate(() => ({
      pin: !!document.querySelector('.am-tappin'),
      read: document.querySelector('.am-read') && !document.querySelector('.am-read').hidden
        ? document.querySelector('.am-read').textContent.trim().slice(0, 140) : null,
    }));
    say(`  [airmap ${preset}] tap ⇒ pin=${out.tap.pin} read="${out.tap.read}"`);
    await shot(page, preset, 'airmap-pin');
  } else {
    say(`  [airmap ${preset}] NO reachable map pixel — every probed point is covered by sheet/composer/chrome`);
    out.tap = { skipped: 'no reachable map point' };
    await shot(page, preset, 'airmap-nomap');
  }

  /* (c alt) the in-sheet place picker's own search box — a different code
     path than the floating composer (.am-rows + input, A.search.live) */
  const placeBtn = await page.$('.am-place');
  if (placeBtn) {
    await placeBtn.click(); await sleep(800);
    const pInput = await page.$('.sheet-body input');
    if (pInput) {
      await pInput.click();
      await page.keyboard.type('connaught', { delay: 40 });
      await page.waitForSelector('.am-rows .srow', { timeout: 12000 }).catch(() => {});
      await sleep(2000);
      out.pickerSearch = await page.evaluate(() => ({
        rows: document.querySelectorAll('.am-rows .srow').length,
        first: [...document.querySelectorAll('.am-rows .srow .n')].slice(0, 4).map((e) => e.textContent.trim()),
        note: document.querySelector('.am-rows .muted')?.textContent.trim() || null,
      }));
      say(`  [airmap ${preset}] picker search: rows=${out.pickerSearch.rows} first=${JSON.stringify(out.pickerSearch.first)} note=${out.pickerSearch.note}`);
      await shot(page, preset, 'airmap-pickersearch');
      /* pick a row → returns to main render with the place set */
      if (out.pickerSearch.rows) { await page.click('.am-rows .srow'); await sleep(1200); }
    } else out.pickerSearch = { skipped: 'no picker input' };
  }

  /* (d alt) the armed picker flow: .am-place → "drop a pin on the map" */
  out.picker = await page.evaluate(() => !!document.querySelector('.am-place'));
  if (out.picker) {
    await page.click('.am-place'); await sleep(700);
    const hasPinBtn = await page.$('[data-pin]');
    if (hasPinBtn) {
      await hasPinBtn.click(); await sleep(700);
      const probe2 = await findMapPoint(page);
      const mp2 = probe2.point;
      if (mp2) { await page.mouse.click(mp2.x, mp2.y); await sleep(2500); }
      out.armedPin = await page.evaluate(() => ({
        label: document.querySelector('.am-place-label')?.textContent.trim() || null,
        labelEl: !!document.querySelector('.am-place-label'),
        reachableFrac: null,
      }));
      out.armedPin.reachableFrac = probe2.freeFrac;
      say(`  [airmap ${preset}] armed pin flow: mapPoint=${mp2 ? `${mp2.x},${mp2.y}` : 'NONE'} (map ${probe2.freeFrac * 100}% reachable) label="${out.armedPin.label}"`);
      await shot(page, preset, 'airmap-armedpin');
    }
  }
  if (rec.errors.length) say(`  [airmap ${preset}] pageerrors: ${rec.errors.join(' | ').slice(0, 300)}`);
  return out;
}

/* ── driver ────────────────────────────────────────────────────────── */
async function runOne(preset, scen) {
  const seedPos = scen !== 'from';
  const geoDelay = scen === 'from' ? +arg('geodelay', 2500) : 0;
  const rec = await newPage(preset, { seedPos, geoDelay });
  const { page, context } = rec;
  const t0 = Date.now();
  let out = null, err = null;
  try {
    if (scen === 'boot') out = await scBoot(page, preset, rec);
    else if (scen === 'zoom') out = await scZoom(page, preset);
    else if (scen === 'from') { out = { race: await scFrom(page, preset, rec) };
      await context.close();
      const rec2 = await newPage(preset, { seedPos: true });
      out.warm = await scFromWarm(rec2.page, preset);
      rec.errors.push(...rec2.errors); rec.consoleErr.push(...rec2.consoleErr);
      await rec2.context.close(); await context.close(); return { preset, scen, ms: Date.now() - t0, out, errors: rec.errors, consoleErr: rec.consoleErr };
    }
    else if (scen === 'routes') out = await scRoutes(page, preset, rec);
    else if (scen === 'airmap') out = await scAirmap(page, preset, rec);
  } catch (e) { err = String(e && e.stack || e).slice(0, 800); say(`  [${scen} ${preset}] RIG ERROR: ${err.split('\n')[0]}`); }
  if (rec.errors.length && scen !== 'routes' && scen !== 'airmap') say(`  [${scen} ${preset}] pageerrors: ${rec.errors.join(' | ').slice(0, 300)}`);
  await shot(page, preset, `${scen}-end`).catch(() => {});
  await context.close();
  return { preset, scen, ms: Date.now() - t0, out, err, errors: rec.errors, consoleErr: rec.consoleErr, failedReq: rec.failedReq };
}

async function main() {
  say(`e2e harness — base=${BASE} chrome=${CHROME} mode=${NOGL ? 'NO-GL (leaflet basic)' : 'GL (swiftshader→maplibre)'} presets=${presetNames} scenarios=${scenList}`);
  browser = await chromium.launch({
    executablePath: CHROME, headless: !HEADED,
    args: [...GL_ARGS, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--disable-dev-shm-usage'],
  });
  try {
    for (const preset of presetNames)
      for (const scen of scenList)
        results.runs.push(await runOne(preset, scen));
  } finally { await browser.close(); }
  const rf = path.join(OUT, `results-${TAG}.json`);
  fs.writeFileSync(rf, JSON.stringify(results, null, 2));
  say(`done — results: ${rf}`);
  say(`screenshots: ${OUT}`);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
