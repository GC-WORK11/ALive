#!/usr/bin/env node
/* ALive journey e2e — headless Chrome over CDP, no npm deps.

   Drives the real app end to end: consent → where to → search → mode →
   vehicle → Start → journey mounts → feeds Emulation.setGeolocationOverride
   points along the ACTUAL route geometry the server returned → asserts
   progress + next-turn cue → Stop → asserts the receipt.

   A real fix lands on every override push in headless, so the override
   walk IS the GPS feed — same path watchPosition takes on-device.

   Usage:
     node tools/journey_e2e.js [--url http://localhost:8080/app/] [--w 390 --h 844]
                               [--frac 0.6] [--tag run] [--out shots]
                               [--denied] [--dest "Cyber Hub"] [--from "Connaught Place"]
     --denied = permission denied path: asserts the enable-steps card and
                a working Try again button (uses the --from fallback origin).

   Exit code 0 = all asserts passed, 3 = failures, 1 = rig error.
   Screenshots + log land in --out. */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9400 + Math.floor(Math.random() * 500);
const PROF = `/tmp/alive-j2-prof-${process.pid}`;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes('--' + k);

const cfg = {
  url: arg('url', 'http://localhost:8080/app/'),
  w: +arg('w', 390), h: +arg('h', 844), dpr: +arg('dpr', 3), mobile: !has('desktop'),
  frac: +arg('frac', 0.6), tag: arg('tag', 'journey-e2e'),
  out: arg('out', 'shots'), denied: has('denied'),
  dest: arg('dest', 'Cyber Hub'), from: arg('from', 'Connaught Place'),
};

const jget = (url) => new Promise((res, rej) => {
  http.get(url, (r) => { let b = ''; r.on('data', (c) => b += c); r.on('end', () => res(JSON.parse(b))); })
    .on('error', rej);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(cfg.out, { recursive: true });
  const log = [];
  let fails = 0;
  const say = (...a) => { const s = `[${new Date().toISOString().slice(11, 19)}] ${a.join(' ')}`; log.push(s); console.log(s); };

  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROF}`, '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--mute-audio',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    `--window-size=${cfg.w},${cfg.h}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeErr = '';
  chrome.stderr.on('data', (d) => { chromeErr += d; });
  process.on('exit', () => { try { chrome.kill('SIGKILL'); } catch (e) {} });

  let targets = null;
  for (let i = 0; i < 60; i++) {
    try { targets = await jget(`http://localhost:${PORT}/json`); if (targets.length) break; } catch (e) {}
    await sleep(500);
  }
  if (!targets || !targets.length) { say('FATAL no devtools', chromeErr.slice(-800)); process.exit(1); }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let mid = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    else if (d.method === 'Runtime.exceptionThrown') {
      const e = d.params.exceptionDetails;
      say('PAGEEXCEPTION:', JSON.stringify(e.exception && e.exception.description || e.text).slice(0, 500));
    } else if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
      const args = (d.params.args || []).map((a) => a.value !== undefined ? a.value : (a.description || a.type)).join(' ');
      say('CONSOLE.error:', String(args).slice(0, 300));
    }
  };
  const send = (method, params) => new Promise((res, rej) => {
    const id = ++mid;
    pending.set(id, (d) => d.error ? rej(new Error(method + ': ' + JSON.stringify(d.error))) : res(d.result || {}));
    ws.send(JSON.stringify({ id, method, params: params || {} }));
  });
  const evaljs = async (expr, awaitP) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!awaitP });
    if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text };
    return r.result ? r.result.value : undefined;
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const f = path.join(cfg.out, `${cfg.tag}-${name}.png`);
    fs.writeFileSync(f, Buffer.from(r.data, 'base64'));
    say('SHOT', f);
  };
  const waitFor = async (expr, ms, label) => {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 15000)) {
      if (await evaljs(`!!(${expr})`) === true) return true;
      await sleep(400);
    }
    say(`WAIT-TIMEOUT ${label || expr}`); fails++;
    return false;
  };
  const click = (sel, nth) => evaljs(
    `(() => { const a = document.querySelectorAll(${JSON.stringify(sel)}); const b = a[${nth || 0}]; if (!b) return 'NO:' + ${JSON.stringify(sel)}; b.click(); return 'clicked'; })()`);
  const type = (sel, txt) => evaljs(
    `(() => { const i = document.querySelector(${JSON.stringify(sel)}); i.focus(); i.value = ${JSON.stringify(txt)}; i.dispatchEvent(new Event('input', {bubbles:true})); return 1; })()`);
  const assert = async (expr, label) => {
    const v = await evaljs(`!!(${expr})`);
    if (v === true) say(`ASSERT PASS — ${label}`);
    else { fails++; say(`ASSERT FAIL — ${label}  → ${JSON.stringify(v)}`); }
  };
  const state = () => evaljs(`(() => ({
    top: A && A.current ? A.current() : null,
    jn: !!document.querySelector('.jn'), jr: !!document.querySelector('.jr'),
    pill: (document.querySelector('.jn-ptxt')||{}).textContent || null,
    pillVis: !(document.querySelector('.jn-pill')||{hidden:1}).hidden,
    banner: ((document.querySelector('.jn-instr')||{}).textContent||''),
    prog: ((document.querySelector('.jn-prog i')||{style:{}}).style||{}).transform || null,
    dose: (document.querySelector('.jn-dosev')||{}).textContent || null,
    geohelp: !(document.querySelector('.jn-geohelp')||{hidden:1}).hidden,
    receipt: (document.querySelector('.jr-title')||{}).textContent || null }))()`);

  /* drive the override along the route's own geometry — distance-normalised
     hops (~35 m / 750 ms ≈ 47 m/s) stay inside journey's plausibility rules */
  const geoRoute = async (frac, stateEvery) => {
    const g = await evaljs(`(() => (window.__jp.option.geometry.coordinates))()`);
    if (!Array.isArray(g) || !g.length) { fails++; say('GEOROUTE no geometry'); return; }
    const hav = (a, b) => { const R = 6371000, dLa = (b[1] - a[1]) * Math.PI / 180, dLo = (b[0] - a[0]) * Math.PI / 180;
      const s = Math.sin(dLa / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLo / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(s)); };
    let total = 0; for (let i = 1; i < g.length; i++) total += hav(g[i - 1], g[i]);
    const step = Math.max(35, total / 450);
    const pts = [[g[0][1], g[0][0]]];
    let acc = 0, prev = g[0];
    for (let i = 1; i < g.length; i++) {
      let d = hav(prev, g[i]);
      while (acc + d >= step) {
        const f = (step - acc) / d;
        prev = [prev[0] + (g[i][0] - prev[0]) * f, prev[1] + (g[i][1] - prev[1]) * f];
        pts.push([prev[1], prev[0]]); d = hav(prev, g[i]); acc = 0;
      }
      acc += d; prev = g[i];
    }
    pts.push([g[g.length - 1][1], g[g.length - 1][0]]);
    const npts = Math.max(2, Math.round(pts.length * frac));
    say(`GEOROUTE ${Math.round(total)}m → ${npts} pts @${Math.round(step)}m`);
    for (let i = 0; i < npts; i++) {
      await send('Emulation.setGeolocationOverride', { latitude: pts[i][0], longitude: pts[i][1], accuracy: 8 });
      await sleep(750);
      if (stateEvery && i % stateEvery === stateEvery - 1) say('GEO@' + (i + 1), JSON.stringify(await state()).slice(0, 300));
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',
    { width: cfg.w, height: cfg.h, deviceScaleFactor: cfg.dpr, mobile: cfg.mobile });
  const origin = new URL(cfg.url).origin;
  await send('Browser.setPermission', { permission: { name: 'geolocation' },
    setting: cfg.denied ? 'denied' : 'granted', origin });
  if (!cfg.denied)
    await send('Emulation.setGeolocationOverride', { latitude: 28.6315, longitude: 77.2167, accuracy: 10 }); // CP
  await send('Page.navigate', { url: cfg.url });
  await sleep(3500);

  /* consent → home → whereto */
  if (await evaljs(`!!(document.getElementById('consent') && !document.getElementById('consent').hidden)`)) {
    await click('[data-cs="next"]'); await sleep(700);
    if (cfg.denied) { await click('[data-cs="later"]'); await sleep(1000); }
    else { await click('[data-cs="gps"]'); await waitFor(`A.geo.consent==='granted'`, 15000, 'consent granted'); }
  }
  await waitFor(`document.querySelector('#hs-cta')`, 12000, 'home cta');
  await click('#hs-cta'); await sleep(500);
  await waitFor(`document.querySelector('.wt-rin')`, 12000, 'whereto');
  await sleep(700);
  await type('.wt-rin', cfg.dest);
  await waitFor(`document.querySelectorAll('.wt-list .wt-row[data-k]').length>0`, 20000, 'dest rows');
  await click('.wt-list .wt-row[data-k]', 0);
  if (cfg.denied) {
    await sleep(1500);                                   // armed flips to 'from'
    await type('.wt-rin', cfg.from);
    await waitFor(`document.querySelectorAll('.wt-list .wt-row[data-k]').length>0`, 20000, 'from rows');
    await click('.wt-list .wt-row[data-k]', 0);
  }
  await waitFor(`document.querySelector('.wt-mode')`, 12000, 'modes');
  await click('.wt-mode[data-mode="health_max"]');
  await waitFor(`document.querySelector('.wt-vcard')`, 10000, 'vehicle');
  await click('.wt-vcard[data-k="car"]'); await sleep(900);
  await click('.wt-vcard[data-k="petrol"]');
  await waitFor(`document.querySelector('.wt-go') && !document.querySelector('.wt-go').disabled`, 60000, 'plan ready');
  await evaljs(`(() => { const o = A.show; A.show = (id,p,r) => { window.__jp = p; return o(id,p,r); }; return 'wrapped'; })()`);
  await shot('01-routes');
  await click('.wt-go');
  await sleep(3000);
  await shot('02-nav');
  say('STATE', JSON.stringify(await state()));

  await assert(`document.querySelector('.jn')`, 'Start mounts journey');
  await assert(`window.__jp && window.__jp.option && window.__jp.option.geometry && window.__jp.option.geometry.coordinates.length>2`,
    'real route geometry handed over');

  if (cfg.denied) {
    await sleep(2000);
    await assert(`document.querySelector('.jn-geohelp') && !document.querySelector('.jn-geohelp').hidden`,
      'denied → enable-steps card');
    await assert(`(document.querySelector('.jn-gh-s')||{textContent:''}).textContent.length > 20`,
      'card carries the how-to');
    await click('.jn-gh-b'); await sleep(2500);
    await assert(`document.querySelector('.jn-gh-b') && !document.querySelector('.jn-gh-b').disabled`,
      'Try again re-arms after a still-denied check');
    await shot('03-denied');
  } else {
    await geoRoute(cfg.frac, 12);
    await sleep(1500);
    await shot('03-nav-mid');
    say('STATE', JSON.stringify(await state()));
    await assert(`parseFloat(((document.querySelector('.jn-prog i')||{style:{transform:'scaleX(0)'}}).style.transform||'').replace(/[^0-9.]/g,''))>0.2`,
      'progress ratchets along the route');
    await assert(`(document.querySelector('.jn-instr')||{}).textContent.length>3`, 'next-turn cue shows');
    await assert(`(document.querySelector('.jn-pill')||{hidden:1}).hidden===true`, 'no dead state while moving');
    await click('.jn-close'); await sleep(700);
    await shot('04-stop');
    await click('.jn-yes');
    await waitFor(`document.querySelector('.jr')`, 8000, 'receipt');
    await shot('05-receipt');
    await assert(`document.querySelector('.jr-title') && /Trip ended|here/.test(document.querySelector('.jr-title').textContent)`,
      'Stop → receipt');
  }

  say('DONE', fails ? `(${fails} FAILURES)` : '(all asserts passed)');
  fs.writeFileSync(path.join(cfg.out, `${cfg.tag}-log.txt`), log.join('\n') + '\n');
  try { ws.close(); } catch (e) {}
  try { chrome.kill('SIGKILL'); } catch (e) {}
  try { execSync(`rm -rf ${PROF}`); } catch (e) {}
  process.exit(fails ? 3 : 0);
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
