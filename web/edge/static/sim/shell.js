/* Alive live preview — the shell (sim-core). Contract: /tmp/sim-contract.md
   One global: SIM. Vanilla ES2020, zero libraries, relative API paths.

   CONTRACT API
     SIM.register(id, {title, mount(root, params) -> cleanup|undefined})
     SIM.start(id, params) · SIM.push(id, params) · SIM.back() · SIM.replace(id, params)
     SIM.sheet(id, params) -> {close()}
     SIM.api.get(path, ms=12000) · SIM.api.post(path, body, ms=30000)   (Promise<json|null>, never throws)
     SIM.city()  cached /v2/city (re-read after 5 min; failures are not cached)
     SIM.fmt.ug(v) · SIM.fmt.band(pm) -> {name, color} · SIM.fmt.ago(sec)
     SIM.countUp(el, to, ms=900, fmt=SIM.fmt.ug) · SIM.press(el) · SIM.css(id, text) · SIM.toast(msg)
     SIM.reduced · SIM.ORIGIN

   ADDITIVE (optional — safe to use)
     SIM.closeSheet()              close the topmost sheet (e.g. a "done" button inside a sheet)
     SIM.sheet(id, params, {full:true})   open a sheet straight at the full detent
     SIM.cached(path, maxAgeMs=300000)    cached GET promise (null results are not cached)
     SIM.backButton({glass})       round 40px back button; press feedback; calls SIM.back()
     SIM.press(el, onTap)          optional tap handler; add class "sim-hl" first for a row
                                   highlight instead of the .97 scale
     SIM.current()                 id of the top pushed screen
     SIM.fmt.band(pm) also returns {idx, ink, wash, edge}; SIM.fmt.int(v); SIM.fmt.clock(date)
     register option statusBar:'light' -> white status-bar glyphs while that screen is on top
     root.dataset.sb = 'static'    no frosted status-bar backdrop when this screen's content scrolls
     root events: 'sim:hide' (covered by a push) · 'sim:show' (revealed again after a back)

   LAYOUT (what mount(root) receives)
     root = full-bleed box (position:absolute; inset:0) that scrolls vertically and is padded by
     var(--sim-top) / var(--sim-bot) (status bar / home indicator, or the phone's real safe areas).
     Add class "sim-bleed" to root to drop that padding and handle safe areas yourself.
     Set root.style.overflow = 'hidden' if the screen owns its own scrolling / fixed chrome.
     In a sheet: root has class "sim-in-sheet" (flows inside the sheet's scroller; the grabber sits
     above it and the ✕ sits at top-right 12px — keep the top-right 48×48 clear).
     Tokens: see :root in sim.css (--paper, --ink…, --accent, --b0…--b5, --font, --ease…).

   CHROME (status bar + home indicator) is drawn unless we are the phone's own screen: top-level
   with innerWidth < 500, or a full-width iframe takeover on a touch phone. ?frame=1 / ?frame=0
   force it on / off (e.g. the landing can pass frame=0 to its phone takeover iframe). */
(() => {
  'use strict';
  const D = document, W = window;
  const EASE = 'cubic-bezier(.32,.72,0,1)';
  const PUSH_MS = 380;
  const mq = W.matchMedia ? W.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  const mk = (tag, cls, html) => {
    const e = D.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ── chrome mode: status bar + home indicator only when not top-level on a phone ── */
  const qs = new URLSearchParams(location.search);
  const forced = qs.get('frame'); // '1' force chrome on, '0' force off (testing aid)
  let topLevel = true;
  try { topLevel = W.top === W; } catch (e) { topLevel = false; }
  function chromeMode() {
    // the real status bar / home indicator exist when we ARE the phone's screen: top-level on a
    // narrow viewport (contract rule) — or a full-width takeover iframe on a touch phone
    const coarse = !!(W.matchMedia && W.matchMedia('(pointer: coarse)').matches);
    const fillsPhone = coarse && W.innerWidth < 500 && W.screen && Math.abs(W.innerWidth - W.screen.width) <= 2;
    const phone = (topLevel && W.innerWidth < 500) || fillsPhone;
    const show = forced === '1' ? true : forced === '0' ? false : !phone;
    const desk = topLevel && W.innerWidth >= 500 && forced !== '0';
    D.documentElement.classList.toggle('sim-chrome', show);
    D.documentElement.classList.toggle('sim-desk', desk);
  }
  chromeMode();

  /* ── device DOM ── */
  const sim = D.getElementById('sim') || D.body.appendChild(mk('div'));
  sim.id = 'sim';
  sim.classList.add('sim');
  const stackEl = mk('div', 'sim-stack');
  const layerEl = mk('div', 'sim-layer');
  const statusEl = mk('div', 'sim-status');
  const homeEl = mk('div', 'sim-homeind');
  const toastEl = mk('div', 'sim-toast');
  const probe = mk('div', 'sim-probe');
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  statusEl.setAttribute('aria-hidden', 'true');
  homeEl.setAttribute('aria-hidden', 'true');
  sim.append(stackEl, layerEl, statusEl, homeEl, toastEl, probe);

  statusEl.innerHTML =
    '<div class="sim-sb-ear"><span class="sim-sb-time"></span></div><div class="sim-sb-isl"></div>' +
    '<div class="sim-sb-ear sim-sb-r">' +
    '<svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor"><rect x="0" y="7.2" width="3" height="3.8" rx=".9"/><rect x="4.6" y="5" width="3" height="6" rx=".9"/><rect x="9.2" y="2.6" width="3" height="8.4" rx=".9"/><rect x="13.8" y="0" width="3" height="11" rx=".9"/></svg>' +
    '<svg width="15" height="11" viewBox="0 0 15 11" fill="currentColor"><path d="M7.5 2.3c2.1 0 4 .8 5.5 2.1.2.2.5.2.7 0l.9-.9c.2-.2.2-.5 0-.7A10.4 10.4 0 0 0 7.5.2C5 .2 2.6 1.1.7 2.8c-.2.2-.2.5 0 .7l.9.9c.2.2.5.2.7 0a8 8 0 0 1 5.2-2.1Z"/><path d="M7.5 5.6c1.2 0 2.3.4 3.2 1.2.2.2.5.2.7 0l.9-.9c.2-.2.2-.5 0-.7a6.9 6.9 0 0 0-9.6 0c-.2.2-.2.5 0 .7l.9.9c.2.2.5.2.7 0 .9-.8 2-1.2 3.2-1.2Z"/><path d="M9.6 8.4c.2-.2.2-.5 0-.7a3 3 0 0 0-4.2 0c-.2.2-.2.5 0 .7l1.7 1.7c.2.2.5.2.7 0l1.8-1.7Z"/></svg>' +
    '<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.4" fill="none" stroke="currentColor" stroke-opacity=".38"/><rect class="sim-sb-lvl" x="2" y="2" width="19" height="8" rx="2" fill="currentColor"/><path d="M24 4v4c.8-.3 1.4-1.1 1.4-2S24.8 4.3 24 4Z" fill="currentColor" fill-opacity=".42"/></svg>' +
    '</div>';
  const timeEl = statusEl.querySelector('.sim-sb-time');
  function tick() {
    const d = new Date();
    timeEl.textContent = fmt.clock(d);
    setTimeout(tick, 60000 - (d.getSeconds() * 1000 + d.getMilliseconds()) + 30);
  }
  // battery glyph: the device's own level when the browser exposes it (no number is shown)
  try {
    if (navigator.getBattery) navigator.getBattery().then((b) => {
      const lvl = statusEl.querySelector('.sim-sb-lvl');
      const set = () => lvl.setAttribute('width', String(Math.max(2, Math.round(19 * b.level))));
      set();
      b.addEventListener('levelchange', set);
    }).catch(() => {});
  } catch (e) { /* not exposed */ }

  /* ── format ── */
  const BANDS = [
    { name: 'good', color: '#6E93AE' },
    { name: 'satisfactory', color: '#C7A34F' },
    { name: 'moderate', color: '#CF8A50' },
    { name: 'poor', color: '#C05F3A' },
    { name: 'very poor', color: '#A83D30' },
    { name: 'severe', color: '#6E2D28' },
  ];
  const BREAKS = [30, 60, 90, 120, 250];
  const hexMix = (a, b, t) => {
    const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  const BAND_X = BANDS.map((b) => ({
    ink: hexMix(b.color, '#16181D', 0.2),
    wash: hexMix(b.color, '#FFFFFF', 0.9),
    edge: hexMix(b.color, '#FFFFFF', 0.6),
  }));
  const num = (v) => (typeof v === 'number' ? v : v == null || v === '' ? NaN : Number(v));
  const fmt = {
    ug(v) {
      const n = num(v);
      if (!isFinite(n)) return '—';
      return Math.abs(n) < 10 ? (Math.round(n * 10) / 10).toFixed(1) : String(Math.round(n));
    },
    int(v) {
      const n = num(v);
      return isFinite(n) ? String(Math.round(n)) : '—';
    },
    band(pm) {
      const n = num(pm);
      if (!isFinite(n)) return { name: '—', color: '#A6ACB8', idx: null, ink: '#6E7278', wash: '#F3F2EC', edge: '#E3E0D7' };
      let i = 0;
      while (i < BREAKS.length && n > BREAKS[i]) i++;
      return Object.assign({ idx: i }, BANDS[i], BAND_X[i]);
    },
    ago(sec) {
      const n = num(sec);
      if (!isFinite(n)) return '—';
      const m = Math.max(1, Math.round(n / 60));
      if (m < 60) return m + ' min';
      const h = Math.round(m / 60);
      if (h < 48) return h + ' h';
      return Math.round(h / 24) + ' d';
    },
    clock(d) {
      d = d || new Date();
      let s;
      try { s = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { s = ''; }
      s = (s || '').replace(/\s?[AaPp]\.?\s?[Mm]\.?/, '').trim();
      return s || (String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'));
    },
  };

  /* ── network: relative paths, timeouts, null on any failure ── */
  const norm = (p) => (/^(https?:)?\/\//.test(p) || p.startsWith('/') ? p : '/' + p);
  const inflight = new Map();
  async function req(path, init, ms) {
    const ctl = W.AbortController ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), ms);
    try {
      const r = await fetch(norm(path), Object.assign({ signal: ctl ? ctl.signal : undefined, cache: 'no-store' }, init));
      if (!r.ok) return null;
      const txt = await r.text();
      try { return JSON.parse(txt); } catch (e) { return null; }
    } catch (e) {
      return null;
    } finally {
      clearTimeout(t);
    }
  }
  const api = {
    get(path, ms = 12000) {
      const key = norm(path);
      if (inflight.has(key)) return inflight.get(key);
      const p = req(key, { method: 'GET' }, ms).finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
    post(path, body, ms = 30000) {
      return req(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body == null ? {} : body) }, ms);
    },
  };
  const cache = new Map();
  function cached(path, maxAgeMs = 300000, ms) {
    const key = norm(path), hit = cache.get(key), now = Date.now();
    if (hit && now - hit.t < maxAgeMs) return hit.p;
    const p = api.get(key, ms).then((j) => {
      if (j == null && cache.get(key) && cache.get(key).p === p) cache.delete(key);
      return j;
    });
    cache.set(key, { t: now, p });
    return p;
  }
  const city = () => cached('/v2/city', 300000);

  /* hosted inside the landing — the page posts its own /v2/city payload
     ({type:'alive-city', data}) so the preview's numbers are literally
     the page's numbers, never a second read a minute apart. */
  window.addEventListener('message', (e) => {
    const d = e && e.data;
    if (d && d.type === 'alive-city' && d.data) {
      cache.set('/v2/city', { t: Date.now(), p: Promise.resolve(d.data) });
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('sim:city', { detail: d.data }));
      }
    }
  });

  /* ── motion helpers ── */
  const reducedNow = () => !!mq.matches;
  function applyLast(el, frames) {
    const f = frames[frames.length - 1];
    for (const k in f) if (k !== 'offset' && k !== 'easing' && k !== 'composite') el.style[k] = f[k];
  }
  function anim(el, frames, ms, easing = EASE) {
    if (!el) return Promise.resolve();
    if (reducedNow() || ms <= 0 || !el.animate) { applyLast(el, frames); return Promise.resolve(); }
    return new Promise((res) => {
      let done = false, a;
      const fin = () => {
        if (done) return;
        done = true;
        applyLast(el, frames);
        try { a && a.cancel(); } catch (e) { /* gone */ }
        res();
      };
      try {
        a = el.animate(frames, { duration: ms, easing, fill: 'forwards' });
        a.onfinish = fin;
      } catch (e) { fin(); return; }
      setTimeout(fin, ms + 160); // backgrounded tabs can stall finish events
    });
  }

  function countUp(el, to, ms = 900, f = fmt.ug) {
    if (!el) return Promise.resolve();
    if (el._cuRaf) { cancelAnimationFrame(el._cuRaf); el._cuRaf = 0; }
    const n = num(to);
    if (!isFinite(n)) { el.textContent = '—'; el._cuV = null; return Promise.resolve(); }
    const from = typeof el._cuV === 'number' ? el._cuV : 0;
    el._cuV = n;
    if (reducedNow() || ms <= 0 || from === n) { el.textContent = f(n); return Promise.resolve(); }
    return new Promise((res) => {
      let t0 = 0;
      const step = (t) => {
        if (!t0) t0 = t;
        const k = Math.min(1, (t - t0) / ms);
        const e = 1 - Math.pow(1 - k, 4);
        el.textContent = f(from + (n - from) * e);
        if (k < 1) el._cuRaf = requestAnimationFrame(step);
        else { el._cuRaf = 0; el.textContent = f(n); res(); }
      };
      el.textContent = f(from);
      el._cuRaf = requestAnimationFrame(step);
    });
  }

  function press(el, onTap) {
    if (!el) return el;
    if (onTap) el.addEventListener('click', onTap);
    if (el._simPress) return el;
    el._simPress = true;
    el.classList.add('sim-pressable');
    let down = 0, sx = 0, sy = 0, live = false, timer = 0;
    const on = () => { clearTimeout(timer); timer = 0; if (live) { el.classList.add('is-down'); down = performance.now(); } };
    const off = () => {
      clearTimeout(timer); timer = 0; live = false;
      if (!el.classList.contains('is-down')) return;
      const held = performance.now() - down;
      if (held < 110) setTimeout(() => el.classList.remove('is-down'), 110 - held);
      else el.classList.remove('is-down');
    };
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      sx = e.clientX; sy = e.clientY; live = true;
      if (e.pointerType === 'touch') timer = setTimeout(on, 45); else on();
    });
    el.addEventListener('pointermove', (e) => {
      if (live && Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) {
        live = false; clearTimeout(timer); timer = 0; el.classList.remove('is-down');
      }
    });
    el.addEventListener('pointerup', () => { if (live && timer) on(); off(); });
    el.addEventListener('pointercancel', () => { live = false; off(); });
    el.addEventListener('pointerleave', () => { if (live) { live = false; off(); } });
    return el;
  }

  const injected = new Set();
  function css(id, text) {
    if (injected.has(id)) return;
    injected.add(id);
    const s = D.createElement('style');
    s.setAttribute('data-sim', id);
    s.textContent = text;
    D.head.appendChild(s);
  }

  let toastT = 0;
  function toast(msg) {
    toastEl.textContent = String(msg == null ? '' : msg);
    toastEl.classList.remove('is-on');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2300);
  }

  /* ── geometry ── */
  const simW = () => sim.clientWidth || W.innerWidth;
  const simH = () => sim.clientHeight || W.innerHeight;
  const safeTop = () => probe.offsetHeight || 0;

  /* ── screen stack ── */
  const registry = new Map();
  const stack = []; // {id, params, def, sec, root, dim, cleanup}
  const sheets = [];
  const queue = [];
  let busy = false;

  function register(id, def) {
    if (typeof def === 'function') def = { mount: def };
    if (!id || !def || typeof def.mount !== 'function') { console.warn('[sim] bad register', id); return; }
    registry.set(id, def);
  }

  function build(id, params) {
    const def = registry.get(id);
    const sec = mk('section', 'sim-screen');
    sec.setAttribute('data-screen', id);
    sec.setAttribute('aria-label', (def && def.title) || id);
    const root = mk('div', 'sim-root');
    root.setAttribute('data-screen', id);
    const dim = mk('div', 'sim-dim');
    sec.append(root, dim);
    return { id, params: params || {}, def, sec, root, dim, cleanup: null };
  }
  function mountInto(s) {
    try {
      const r = s.def.mount(s.root, s.params);
      if (typeof r === 'function') s.cleanup = r;
    } catch (e) {
      console.error('[sim] mount failed: ' + s.id, e);
      s.root.innerHTML = '<div class="sim-fail">this screen hit a snag.</div>';
    }
  }
  function destroy(s) {
    if (!s) return;
    try { s.cleanup && s.cleanup(); } catch (e) { console.error('[sim] cleanup failed: ' + s.id, e); }
    s.cleanup = null;
    if (s.sec) s.sec.remove();
    if (s.wrap) s.wrap.remove();
  }
  const top = () => stack[stack.length - 1];
  const emit = (s, type) => { try { s && s.root.dispatchEvent(new CustomEvent(type)); } catch (e) { /* ignore */ } };

  function cover(s) {
    s.sec.classList.add('is-covered');
    s.sec.inert = true;
    s.sec.style.willChange = '';
    emit(s, 'sim:hide');
  }
  function uncover(s) {
    s.sec.classList.remove('is-covered');
    s.sec.inert = false;
  }
  function syncChrome() {
    const t = top();
    const light = !!(t && t.def && t.def.statusBar === 'light') && !sheets.length;
    statusEl.classList.toggle('is-light', light);
    homeEl.classList.toggle('is-light', light);
    let sc = false;
    if (t && !sheets.length && t.root.dataset.sb !== 'static') {
      const r = t.root;
      sc = r.scrollTop > 6 && getComputedStyle(r).overflowY !== 'hidden';
    }
    statusEl.classList.toggle('is-scrolled', sc && !light);
  }
  // frosted status bar once content scrolls under it (opt out: root.dataset.sb = 'static')
  stackEl.addEventListener('scroll', (e) => {
    const t = top();
    if (!t || sheets.length || light() || t.root.dataset.sb === 'static') return;
    const tg = e.target;
    if (tg && tg.nodeType === 1 && t.sec.contains(tg)) statusEl.classList.toggle('is-scrolled', tg.scrollTop > 6);
  }, true);
  const light = () => statusEl.classList.contains('is-light');

  function run(fn) {
    queue.push(fn);
    if (!busy) pump();
  }
  async function pump() {
    busy = true;
    sim.classList.add('is-nav');
    while (queue.length) {
      const f = queue.shift();
      try { await f(); } catch (e) { console.error('[sim] nav', e); }
    }
    busy = false;
    sim.classList.remove('is-nav');
    syncChrome();
  }

  function start(id, params) {
    id = id || 'home';
    run(async () => {
      while (sheets.length) destroy(sheets.pop());
      while (stack.length) destroy(stack.pop());
      if (!registry.has(id)) {
        const s = build(id, params);
        s.def = { mount: (r) => { r.innerHTML = '<div class="sim-fail">Alive — the preview couldn\'t load. Reload to try again.</div>'; } };
        stackEl.appendChild(s.sec); stack.push(s); mountInto(s);
        return;
      }
      const s = build(id, params);
      stackEl.appendChild(s.sec);
      stack.push(s);
      mountInto(s);
      syncChrome();
      await anim(s.sec, [{ opacity: 0 }, { opacity: 1 }], 320, 'ease-out');
      s.sec.style.opacity = '';
    });
  }

  function slideIn(s, prev, ms = PUSH_MS) {
    s.sec.style.willChange = 'transform';
    prev.sec.style.willChange = 'transform';
    return Promise.all([
      anim(s.sec, [{ transform: 'translate3d(100%,0,0)' }, { transform: 'translate3d(0,0,0)' }], ms),
      anim(prev.sec, [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-30%,0,0)' }], ms),
      anim(prev.dim, [{ opacity: 0 }, { opacity: 1 }], ms),
    ]).then(() => { s.sec.style.willChange = ''; s.sec.style.transform = ''; });
  }

  function push(id, params) {
    if (!registry.has(id)) { toast('in the app'); return; }
    run(async () => {
      if (sheets.length) dismissAllSheets();
      const prev = top();
      const s = build(id, params);
      stackEl.appendChild(s.sec);
      stack.push(s);
      mountInto(s);
      syncChrome();
      if (!prev) return;
      await slideIn(s, prev);
      cover(prev);
    });
  }

  function replace(id, params) {
    if (!registry.has(id)) { toast('in the app'); return; }
    run(async () => {
      if (sheets.length) dismissAllSheets();
      const old = top();
      const s = build(id, params);
      stackEl.appendChild(s.sec);
      if (!old) { stack.push(s); mountInto(s); return; }
      stack[stack.length - 1] = s;
      mountInto(s);
      syncChrome();
      await slideIn(s, old);
      destroy(old);
    });
  }

  function popTo(cur, prev, fromX, ms, easing) {
    // fromX: px offset of cur (0..W); finishes the back motion from wherever a gesture left it
    const w = simW();
    uncover(prev);
    prev.sec.style.willChange = 'transform';
    const p0 = fromX / w;
    return Promise.all([
      anim(cur.sec, [{ transform: `translate3d(${fromX}px,0,0)` }, { transform: 'translate3d(100%,0,0)' }], ms, easing),
      anim(prev.sec, [{ transform: `translate3d(${-0.3 * w * (1 - p0)}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], ms, easing),
      anim(prev.dim, [{ opacity: String(1 - p0) }, { opacity: '0' }], ms, easing),
    ]).then(() => {
      const i = stack.indexOf(cur);
      if (i >= 0) stack.splice(i, 1);
      destroy(cur);
      prev.sec.style.transform = '';
      prev.sec.style.willChange = '';
      emit(prev, 'sim:show');
    });
  }

  function back() {
    if (sheets.length) { closeSheet(); return; }
    if (!busy && stack.length < 2) return; // no-op at root
    // queued: a back requested mid-transition (e.g. programmatic back right after a push) runs after it
    run(async () => {
      if (stack.length < 2) return;
      await popTo(top(), stack[stack.length - 2], 0, PUSH_MS);
    });
  }

  /* ── left-edge swipe-back (touch; mouse drag too, for the desktop ghost phone) ── */
  const EDGE = 24;
  let sw = null; // {x0,y0,t0,on,dx,samples,cur,prev,w,pid,touchId}
  function swBegin(x, y, extra) {
    if (busy || sheets.length || stack.length < 2) return false;
    const r = sim.getBoundingClientRect();
    if (x - r.left > EDGE || x < r.left) return false;
    sw = Object.assign({ x0: x, y0: y, t0: performance.now(), on: false, dx: 0, samples: [], left: r.left }, extra);
    return true;
  }
  function swMove(x, y, ev) {
    if (!sw) return;
    const dx = x - sw.x0, dy = y - sw.y0;
    if (!sw.on) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (dx > 0 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        sw.on = true;
        sw.cur = top(); sw.prev = stack[stack.length - 2]; sw.w = simW();
        uncover(sw.prev);
        sw.cur.sec.style.willChange = 'transform';
        sw.prev.sec.style.willChange = 'transform';
        sim.classList.add('is-nav');
      } else { sw = null; return; }
    }
    if (ev && ev.cancelable) ev.preventDefault();
    const w = sw.w, d = clamp(dx, 0, w), p = d / w;
    sw.dx = d;
    const now = performance.now();
    sw.samples.push({ t: now, x: d });
    while (sw.samples.length > 2 && now - sw.samples[0].t > 90) sw.samples.shift();
    sw.cur.sec.style.transform = `translate3d(${d}px,0,0)`;
    sw.prev.sec.style.transform = `translate3d(${-0.3 * w * (1 - p)}px,0,0)`;
    sw.prev.dim.style.opacity = String(1 - p);
  }
  function swEnd(cancelled) {
    if (!sw) return;
    const g = sw; sw = null;
    if (!g.on) return;
    const s = g.samples, w = g.w;
    let v = 0;
    if (s.length > 1) { const a = s[0], b = s[s.length - 1]; v = (b.x - a.x) / Math.max(1, b.t - a.t); }
    const go = !cancelled && (g.dx > w * 0.5 || (v > 0.35 && g.dx > 24)) && v > -0.2;
    suppressClick();
    run(async () => {
      if (go) {
        const rest = w - g.dx;
        const ms = clamp(v > 0.05 ? rest / v : PUSH_MS, 160, PUSH_MS);
        await popTo(g.cur, g.prev, g.dx, ms, 'cubic-bezier(.2,.75,.25,1)');
      } else {
        const ms = clamp(220 + g.dx * 0.4, 220, 360);
        await Promise.all([
          anim(g.cur.sec, [{ transform: `translate3d(${g.dx}px,0,0)` }, { transform: 'translate3d(0,0,0)' }], ms),
          anim(g.prev.sec, [{ transform: `translate3d(${-0.3 * w * (1 - g.dx / w)}px,0,0)` }, { transform: 'translate3d(-30%,0,0)' }], ms),
          anim(g.prev.dim, [{ opacity: String(1 - g.dx / w) }, { opacity: '1' }], ms),
        ]);
        g.cur.sec.style.transform = '';
        g.cur.sec.style.willChange = '';
        cover(g.prev);
      }
    });
  }
  function suppressClick() {
    const kill = (e) => { e.stopPropagation(); e.preventDefault(); };
    W.addEventListener('click', kill, true);
    setTimeout(() => W.removeEventListener('click', kill, true), 60);
  }
  sim.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { if (sw && !sw.on) sw = null; return; }
    const t = e.touches[0];
    swBegin(t.clientX, t.clientY, { touchId: t.identifier });
  }, { passive: true, capture: true });
  sim.addEventListener('touchmove', (e) => {
    if (!sw || sw.touchId == null) return;
    const t = Array.from(e.touches).find((q) => q.identifier === sw.touchId);
    if (!t) return;
    swMove(t.clientX, t.clientY, e);
    if (sw && sw.on) e.stopPropagation();
  }, { passive: false, capture: true });
  sim.addEventListener('touchend', () => { if (sw && sw.touchId != null) swEnd(false); }, { capture: true });
  sim.addEventListener('touchcancel', () => { if (sw && sw.touchId != null) swEnd(true); }, { capture: true });
  sim.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    swBegin(e.clientX, e.clientY, { pid: e.pointerId });
  }, true);
  W.addEventListener('pointermove', (e) => {
    if (!sw || sw.pid !== e.pointerId) return;
    swMove(e.clientX, e.clientY, e);
  }, true);
  W.addEventListener('pointerup', (e) => { if (sw && sw.pid === e.pointerId) swEnd(false); }, true);
  W.addEventListener('pointercancel', (e) => { if (sw && sw.pid === e.pointerId) swEnd(true); }, true);

  /* ── sheets: detent 55% → drag to full; ✕; scrim closes ── */
  const X_SVG = '<svg width="13" height="13" viewBox="0 0 14 14"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>';
  function sheetGeom(S) {
    const H = simH();
    S.H = H;
    S.sheetH = Math.round(H - safeTop() - 10);
    S.sh.style.height = S.sheetH + 'px';
    S.yFull = 0;
    S.yMid = Math.max(0, S.sheetH - Math.round(H * 0.55));
    S.yClosed = S.sheetH + 30;
  }
  function sheetSetY(S, y) {
    S.y = y;
    S.sh.style.transform = `translate3d(0,${y}px,0)`;
    const k = y <= S.yMid ? 1 : 1 - clamp((y - S.yMid) / Math.max(1, S.yClosed - S.yMid), 0, 1);
    S.scrim.style.opacity = String(k);
  }
  function sheetTo(S, y, ms = 420, easing = EASE) {
    const from = S.y;
    const k0 = S.scrim.style.opacity || '0';
    const k1 = y <= S.yMid ? 1 : 1 - clamp((y - S.yMid) / Math.max(1, S.yClosed - S.yMid), 0, 1);
    S.y = y;
    S.detent = y <= S.yFull + 1 ? 'full' : y >= S.yClosed - 1 ? 'closed' : 'mid';
    S.sh.classList.toggle('is-full', S.detent === 'full');
    return Promise.all([
      anim(S.sh, [{ transform: `translate3d(0,${from}px,0)` }, { transform: `translate3d(0,${y}px,0)` }], ms, easing),
      anim(S.scrim, [{ opacity: k0 }, { opacity: String(k1) }], ms, easing),
    ]);
  }
  function sheetClose(S, ms = 300) {
    if (!S || S.closing) return Promise.resolve();
    S.closing = true;
    S.wrap.classList.add('is-closing');
    const i = sheets.indexOf(S);
    if (i >= 0) sheets.splice(i, 1);
    return sheetTo(S, S.yClosed, ms, 'cubic-bezier(.4,0,.8,.6)').then(() => {
      destroy(S);
      syncChrome();
    });
  }
  function closeSheet() {
    const S = sheets[sheets.length - 1];
    return S ? sheetClose(S) : Promise.resolve();
  }
  function dismissAllSheets() {
    sheets.slice().reverse().forEach((S) => sheetClose(S, 240));
  }

  function sheet(id, params, opts) {
    if (!registry.has(id)) { toast('in the app'); return { close() {} }; }
    opts = opts || {};
    const def = registry.get(id);
    const wrap = mk('div', 'sim-sheetwrap');
    const scrim = mk('div', 'sim-scrim');
    const sh = mk('div', 'sim-sheet');
    sh.setAttribute('role', 'dialog');
    sh.setAttribute('aria-modal', 'true');
    sh.setAttribute('aria-label', def.title || id);
    sh.setAttribute('data-sheet', id);
    const body = mk('div', 'sim-sheet-body');
    const root = mk('div', 'sim-root sim-in-sheet');
    root.setAttribute('data-screen', id);
    const head = mk('div', 'sim-sheet-head');
    const grab = mk('div', 'sim-grab');
    const x = mk('button', 'sim-sheet-x', X_SVG);
    x.setAttribute('aria-label', 'close');
    body.appendChild(root);
    sh.append(body, head, grab, x);
    wrap.append(scrim, sh);
    layerEl.appendChild(wrap);
    const S = { id, params: params || {}, def, wrap, scrim, sh, body, root, head, y: 0, detent: 'closed', cleanup: null, closing: false };
    sheets.push(S);
    sheetGeom(S);
    sheetSetY(S, S.yClosed);
    mountInto(S);
    syncChrome();
    press(x, () => sheetClose(S));
    scrim.addEventListener('click', () => sheetClose(S));
    requestAnimationFrame(() => sheetTo(S, opts.full ? S.yFull : S.yMid, 460));
    wireSheetDrag(S);
    return { close: () => sheetClose(S) };
  }

  function settleSheet(S, v) {
    // v: px/ms, positive = downward
    const proj = S.y + v * 140;
    const pts = [S.yFull, S.yMid, S.yClosed];
    let target = pts.reduce((a, b) => (Math.abs(b - proj) < Math.abs(a - proj) ? b : a));
    if (v > 0.7) target = S.y < S.yMid - 4 ? S.yMid : S.yClosed;
    else if (v < -0.7) target = S.y > S.yMid + 4 ? S.yMid : S.yFull;
    if (target === S.yClosed) return sheetClose(S, clamp((S.yClosed - S.y) / Math.max(0.6, v), 160, 300));
    const ms = clamp(Math.abs(target - S.y) / Math.max(0.8, Math.abs(v)), 220, 420);
    return sheetTo(S, target, ms, 'cubic-bezier(.2,.8,.25,1)');
  }

  function wireSheetDrag(S) {
    let g = null;
    const rubber = (o) => -Math.pow(Math.max(0, -o), 0.72);
    const begin = (y, x, fromHead, extra) => {
      if (S.closing) return;
      g = Object.assign({ y0: y, x0: x, start: S.y, on: false, fromHead, samples: [] }, extra);
    };
    const move = (y, x, ev) => {
      if (!g || S.closing) return;
      const dy = y - g.y0, dx = x - g.x0;
      if (!g.on) {
        if (Math.abs(dy) < 6 || Math.abs(dy) < Math.abs(dx)) { if (Math.abs(dx) > 10) g = null; return; }
        const atFull = S.y <= S.yFull + 1;
        if (g.fromHead || !atFull || (S.body.scrollTop <= 0 && dy > 0)) {
          if (ev && !ev.cancelable && ev.type === 'touchmove') { g = null; return; }
          g.on = true;
          g.y0 = y; g.start = S.y;
        } else { g = null; return; }
      }
      if (ev && ev.cancelable) ev.preventDefault();
      let ny = g.start + (y - g.y0);
      if (ny < S.yFull) ny = S.yFull + rubber(ny - S.yFull);
      sheetSetY(S, ny);
      const now = performance.now();
      g.samples.push({ t: now, y: ny });
      while (g.samples.length > 2 && now - g.samples[0].t > 90) g.samples.shift();
    };
    const end = () => {
      if (!g) return;
      const k = g; g = null;
      if (!k.on) return;
      suppressClick();
      const s = k.samples;
      let v = 0;
      if (s.length > 1) { const a = s[0], b = s[s.length - 1]; v = (b.y - a.y) / Math.max(1, b.t - a.t); }
      settleSheet(S, v);
    };
    S.sh.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) { g = null; return; }
      const t = e.touches[0];
      const r = S.sh.getBoundingClientRect();
      begin(t.clientY, t.clientX, t.clientY - r.top < 34, { tid: t.identifier });
    }, { passive: true });
    S.sh.addEventListener('touchmove', (e) => {
      if (!g || g.tid == null) return;
      const t = Array.from(e.touches).find((q) => q.identifier === g.tid);
      if (t) move(t.clientY, t.clientX, e);
    }, { passive: false });
    S.sh.addEventListener('touchend', end);
    S.sh.addEventListener('touchcancel', end);
    // mouse: drag by the grabber zone (desktop ghost phone)
    S.head.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      begin(e.clientY, e.clientX, true, { pid: e.pointerId });
      const mv = (ev) => { if (g && ev.pointerId === g.pid) move(ev.clientY, ev.clientX, ev); };
      const up = (ev) => {
        if (g && ev.pointerId !== g.pid) return;
        W.removeEventListener('pointermove', mv, true);
        W.removeEventListener('pointerup', up, true);
        end();
      };
      W.addEventListener('pointermove', mv, true);
      W.addEventListener('pointerup', up, true);
    });
    // wheel at the medium detent expands to full first (iOS: scrolling expands the sheet)
    S.sh.addEventListener('wheel', (e) => {
      if (S.closing || g) return;
      if (S.detent === 'mid' && e.deltaY > 0) { e.preventDefault(); sheetTo(S, S.yFull, 380); }
    }, { passive: false });
  }

  /* ── misc ── */
  function backButton(opts) {
    opts = opts || {};
    const b = mk('button', 'sim-back' + (opts.glass ? ' is-glass' : ''),
      '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M14.6 5.4 8 12l6.6 6.6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>');
    b.setAttribute('aria-label', opts.label || 'back');
    press(b, () => back());
    return b;
  }

  W.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') back();
  });
  W.addEventListener('resize', () => {
    chromeMode();
    sheets.forEach((S) => {
      const d = S.detent;
      sheetGeom(S);
      sheetSetY(S, d === 'full' ? S.yFull : d === 'mid' ? S.yMid : S.yClosed);
    });
  });

  const ORIGIN = Object.freeze({ lat: 28.7501, lon: 77.1177, name: 'delhi technological university' });

  const SIM = {
    register, start, push, back, replace, sheet,
    api, city, fmt, countUp, press, css, toast,
    ORIGIN,
    // additive
    closeSheet, cached, backButton,
    current: () => (top() ? top().id : null),
    version: 'core-1',
  };
  Object.defineProperty(SIM, 'reduced', { get: reducedNow, enumerable: true });
  W.SIM = SIM;
  tick();
})();
