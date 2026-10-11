/* Alive webapp — motion + glitch lane. ADDITIVE ONLY: enhances whatever
   sheet surfaces exist at runtime; safe on screens that never mount a
   sheet and when other lanes' files change around it.

   Owns: sheet enter/exit choreography (transform+opacity only), grab
   drag with velocity-follow, Esc + focus trap + restore, and the close
   race where the old timer cut the exit 130ms early.

   Opt-in hook: any element carrying [data-sheet-anim] gets the same
   treatment. The standard A.sheetChrome sheets and journey's .jr-sheet
   are tagged automatically here. */
(() => {
'use strict';

const SHEETS = '.sheet, .jr-sheet, [data-sheet-anim]';
const GRAB = '.sheet-grab, .jr-grab';
const HEAD = '.sheet-title, .jr-head';
const mqDesk = () => matchMedia('(min-width: 720px)').matches;
const seen = new WeakSet();          // enhanced sheets
const invoker = new WeakMap();       // sheet -> element to re-focus
const closers = new WeakSet();       // sheets mid-exit

const topSheet = () => {
  const host = document.querySelector('.screen.on');
  if (!host) return null;
  const list = host.querySelectorAll(SHEETS);
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].classList.contains('on')) return list[i];
  }
  return null;
};

/* every .sheet slides in from the right on desktop (right rail), from the
   bottom on mobile — except the armed pin-drop strip, which stays bottom.
   .jr-sheet is a bottom card on every viewport. */
const axis = (sh) => {
  if (!sh.classList.contains('sheet')) return 'y';
  if (sh.closest('.wt-armed')) return 'y';
  return mqDesk() ? 'x' : 'y';
};

function afterTransform(el, ms, cb) {
  let done = false;
  const fin = () => { if (done) return; done = true; el.removeEventListener('transitionend', onEnd); cb(); };
  const onEnd = (e) => { if (e.target === el && e.propertyName === 'transform') fin(); };
  el.addEventListener('transitionend', onEnd);
  setTimeout(fin, ms);
}

/* ── close choreography ────────────────────────────────────────────
   every exit runs the full transform, THEN the teardown. sheetChrome
   teardown is A.back() (what its own close does after a fixed 320ms —
   130ms before its 450ms transform finished). .jr-sheet buttons keep
   their own handlers — replayed after the exit so "plan the way back"
   still swaps the stack in the right order. */
function closeSheet(sh, replayBtn) {
  if (!sh || closers.has(sh)) return;
  closers.add(sh);
  sh.dataset.drag && delete sh.dataset.drag;
  sh.style.transform = '';
  sh.style.opacity = '';
  sh.classList.remove('on');
  afterTransform(sh, 520, () => {
    if (!sh.isConnected) return;
    const host = sh.closest('.screen');
    if (host && !host.classList.contains('on')) return;   // router already moved on
    if (replayBtn && replayBtn.isConnected) {
      replayBtn.__moBypass = true;
      replayBtn.click();
    } else {
      window.A && A.back();
    }
    const back = invoker.get(sh);
    if (back && back.isConnected) { try { back.focus({ preventScroll: true }); } catch (e) {} }
  });
}

/* capture-phase click intercept — runs before the buttons' own bubble
   handlers; we own the exit, then replay so their teardown still runs */
document.addEventListener('click', (e) => {
  const sh = e.target && e.target.closest ? e.target.closest(SHEETS) : null;
  const btn = e.target && e.target.closest ? e.target.closest('.x-btn, .back-btn, .jr-x, .jr-done, .jr-back') : null;
  if (btn && btn.__moBypass) { delete btn.__moBypass; return; }
  if (!sh || !btn || !sh.classList.contains('on') || closers.has(sh)) return;
  if (!sh.closest('.screen.on')) return;
  e.preventDefault(); e.stopPropagation();
  const replay = sh.classList.contains('jr-sheet') ? btn : null;
  closeSheet(sh, replay);
}, true);

/* Esc — capture so a screen's own handler can't race the exit. Keep the
   walk-back semantics some screens built in: unarm the pin-drop, or step
   out of a sub-search, before dismissing the sheet itself. */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const sh = topSheet();
    if (!sh) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const un = sh.querySelector('[data-unarm]');
    if (un && un.offsetParent) { un.click(); return; }
    const bk = sh.querySelector('.wt-search-head [data-back], [data-back]');
    if (bk && bk.offsetParent) { bk.click(); return; }
    const jr = sh.classList.contains('jr-sheet');
    closeSheet(sh, jr ? sh.querySelector('.jr-x') : null);
    return;
  }
  /* focus trap — while a sheet is open, Tab stays inside it */
  if (e.key === 'Tab') {
    const sh = topSheet();
    if (!sh) return;
    const f = [...sh.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
      .filter(el => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!sh.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}, true);

/* ── grab drag — velocity-follow on the transform axis ───────────── */
function bindDrag(sh) {
  let st = null;                       // {id, ax, d0, trail:[{t,d}], el}
  sh.addEventListener('pointerdown', (e) => {
    if (st || !sh.classList.contains('on') || closers.has(sh)) return;
    const zone = e.target.closest(GRAB + ', ' + HEAD);
    if (!zone || !sh.contains(zone)) return;
    if (e.target.closest('button, a, input, select, textarea, [data-unarm]')) return;
    st = { id: e.pointerId, ax: axis(sh), d0: 0,
           p0: axis(sh) === 'x' ? e.clientX : e.clientY,
           trail: [{ t: performance.now(), d: 0 }] };
    try { sh.setPointerCapture(e.pointerId); } catch (err) {}
    sh.dataset.drag = '';
    e.preventDefault();
  });
  sh.addEventListener('pointermove', (e) => {
    if (!st || e.pointerId !== st.id) return;
    const p = st.ax === 'x' ? e.clientX : e.clientY;
    let d = p - st.p0;
    if (d < 0) d *= 0.22;              // rubber-band past the rest position
    st.d0 = d;
    st.trail.push({ t: performance.now(), d });
    if (st.trail.length > 6) st.trail.shift();
    sh.style.transform = st.ax === 'x' ? `translateX(${d}px)` : `translateY(${d}px)`;
    const h = st.ax === 'x' ? sh.offsetWidth : sh.offsetHeight;
    sh.style.opacity = String(Math.max(0.55, 1 - (d / (h * 1.6))));
  });
  const drop = (e) => {
    if (!st || e.pointerId !== st.id) return;
    const { d0, trail, ax } = st; st = null;
    const tr = trail.length > 1 ? trail[trail.length - 1].d - trail[0].d : 0;
    const dt = Math.max(1, trail[trail.length - 1].t - trail[0].t);
    const v = tr / dt;                                  // px per ms, + = away
    const span = ax === 'x' ? sh.offsetWidth : sh.offsetHeight;
    delete sh.dataset.drag;
    if (v > 0.45 || d0 > span * 0.42) {                 // flicked or dragged home
      closeSheet(sh, sh.classList.contains('jr-sheet') ? sh.querySelector('.jr-x') : null);
    } else {                                            // snap back to detent
      sh.style.transform = ax === 'x' ? 'translateX(0)' : 'translateY(0)';
      sh.style.opacity = '';
      afterTransform(sh, 520, () => { if (sh.isConnected && !closers.has(sh)) { sh.style.transform = ''; } });
    }
  };
  sh.addEventListener('pointerup', drop);
  sh.addEventListener('pointercancel', drop);
}

/* ── enhance one sheet ───────────────────────────────────────────── */
function enhance(sh) {
  if (seen.has(sh)) return;
  seen.add(sh);
  if (!sh.hasAttribute('data-sheet-anim')) sh.setAttribute('data-sheet-anim', '');
  if (!sh.hasAttribute('tabindex')) sh.setAttribute('tabindex', '-1');
  bindDrag(sh);

  /* a11y while open + focus ownership — observed via the .on class */
  const syncA11y = () => {
    if (sh.classList.contains('on')) {
      const t = sh.querySelector('.sheet-title h2, .jr-title');
      if (!sh.hasAttribute('role')) sh.setAttribute('role', 'dialog');
      if (t && t.textContent.trim()) sh.setAttribute('aria-label', t.textContent.trim());
      if (!invoker.has(sh)) invoker.set(sh, document.activeElement);
      /* bring focus inside once the slide settles — only if it is still
         outside (screens that focus their own input keep it) */
      afterTransform(sh, 520, () => {
        if (!sh.isConnected || !sh.classList.contains('on')) return;
        if (!sh.contains(document.activeElement)) sh.focus({ preventScroll: true });
      });
    }
  };
  const obs = new MutationObserver(syncA11y);
  obs.observe(sh, { attributes: true, attributeFilter: ['class'] });
  sh.__moObs = obs;
  if (sh.classList.contains('on')) syncA11y();
}

function drop(root) {
  if (!root) return;
  const kill = (sh) => { if (sh.__moObs) { sh.__moObs.disconnect(); sh.__moObs = null; } };
  if (root.nodeType === 1 && root.matches && root.matches(SHEETS)) kill(root);
  if (root.querySelectorAll) root.querySelectorAll(SHEETS).forEach(kill);
}

function scan(root) {
  if (!root) return;
  if (root.nodeType === 1 && root.matches && root.matches(SHEETS)) enhance(root);
  if (root.querySelectorAll) root.querySelectorAll(SHEETS).forEach(enhance);
}

/* watch the screen host — sheets arrive inside .screen mounts */
const host = document.getElementById('screens');
if (host) {
  new MutationObserver((ms) => {
    for (const m of ms) {
      m.addedNodes.forEach(scan);
      m.removedNodes.forEach(drop);
    }
  }).observe(host, { childList: true, subtree: true });
  scan(host);
}

/* tag + wrap the standard chrome so every screen lane gets it for free */
function wrapChrome() {
  if (!window.A || !window.A.sheetChrome || window.A.sheetChrome.__mo) return;
  const orig = window.A.sheetChrome;
  const wrapped = function (el, title, onBack) {
    const chrome = orig.call(this, el, title, onBack);
    if (chrome && chrome.sheetEl) enhance(chrome.sheetEl);
    return chrome;
  };
  wrapped.__mo = true;
  window.A.sheetChrome = wrapped;
}
wrapChrome();
if (!window.A) {
  /* script loaded before app.js — catch A the moment it lands */
  const t = setInterval(() => {
    if (window.A) { clearInterval(t); wrapChrome(); const h = document.getElementById('screens'); if (h) scan(h); }
  }, 30);
  setTimeout(() => clearInterval(t), 8000);
}
})();
