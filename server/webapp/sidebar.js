/* sidebar.js — A.sidebar: the left drawer (lane Y).

   Opened by the home menu button (A.sidebar.open(returnFocusEl)).
   Closes on scrim tap, Esc, swipe left or the ✕; focus is trapped while
   open and handed back on close. Motion: transform + opacity only.

   Header: the on-device profile (A.profile) — initial + name + home area,
   or "Make Alive yours" when there is none; tapping it edits the profile.
   Rows: Where to · Air around me · Purest places · Trips · Saved places
   (whereto.saved, read only) · Settings · Privacy (what stays on this
   phone) · Delete my data (the same wipe as Settings).
   Navigation goes through the app's own router: location.hash = '#/<id>'
   (exactly what the home doors do); a saved place opens Where To with it
   as the destination via A.show('whereto', {to}, true). */
(() => {
'use strict';
if (!window.A) return;

const ICONS = {
  home: 'M240-200h120v-200q0-17 11.5-28.5T400-440h160q17 0 28.5 11.5T600-400v200h120v-360L480-740 240-560v360Zm-80 0v-360q0-19 8.5-36t23.5-28l240-180q21-16 48-16t48 16l240 180q15 11 23.5 28t8.5 36v360q0 33-23.5 56.5T720-120H560q-17 0-28.5-11.5T520-160v-200h-80v200q0 17-11.5 28.5T400-120H240q-33 0-56.5-23.5T160-200Zm320-270Z',
  work: 'M160-120q-33 0-56.5-23.5T80-200v-440q0-33 23.5-56.5T160-720h160v-80q0-33 23.5-56.5T400-880h160q33 0 56.5 23.5T640-800v80h160q33 0 56.5 23.5T880-640v440q0 33-23.5 56.5T800-120H160Zm0-80h640v-440H160v440Zm240-520h160v-80H400v80ZM160-200v-440 440Z',
  close: 'M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z',
  explore: 'M480-440q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520q17 0 28.5 11.5T520-480q0 17-11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320ZM297-277l250-117q6-3 11-8t8-11l117-250q5-10-2.5-17.5T663-683L413-566q-6 3-11 8t-8 11L277-297q-5 10 2.5 17.5T297-277Z',
  city: 'M120-200v-400q0-33 23.5-56.5T200-680h160v-47q0-16 6-30.5t17-25.5l40-40q23-23 57-23t57 23l40 40q11 11 17 25.5t6 30.5v207h160q33 0 56.5 23.5T840-440v240q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200Zm80 0h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm240 320h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm240 480h80v-80h-80v80Zm0-160h80v-80h-80v80Z',
  trash: 'M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM400-280q17 0 28.5-11.5T440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280Zm160 0q17 0 28.5-11.5T600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280ZM280-720v520-520Z',
  navigate: 'M480-240 222-130q-13 5-24.5 2.5T178-138q-8-8-10.5-20t2.5-25l273-615q5-12 15.5-18t21.5-6q11 0 21.5 6t15.5 18l273 615q5 13 2.5 25T782-138q-8 8-19.5 10.5T738-130L480-240Zm-196-4 196-84 196 84-196-440-196 440Zm196-84Z',
  history: 'M480-120q-126 0-223-76.5T131-392q-4-15 6-27.5t27-14.5q16-2 29 6t18 24q24 90 99 147t170 57q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h70q17 0 28.5 11.5T360-600q0 17-11.5 28.5T320-560H160q-17 0-28.5-11.5T120-600v-160q0-17 11.5-28.5T160-800q17 0 28.5 11.5T200-760v54q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm40-376 100 100q11 11 11 28t-11 28q-11 11-28 11t-28-11L452-452q-6-6-9-13.5t-3-15.5v-159q0-17 11.5-28.5T480-680q17 0 28.5 11.5T520-640v144Z',
  chevron: 'M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z',
};
/* Material Symbols Rounded (960 grid) — settings sliders, shield, person */
ICONS.tune = 'M440-120v-240h80v80h320v80H520v80h-80Zm-320-80v-80h240v80H120Zm160-160v-80H120v-80h160v-80h80v240h-80Zm160-80v-80h400v80H440Zm160-160v-240h80v80h160v80H680v80h-80Zm-480-80v-80h400v80H120Z';
ICONS.shield = 'M480-80q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80Zm0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z';
ICONS.person = 'M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-240v-32q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v32q0 33-23.5 56.5T720-160H240q-33 0-56.5-23.5T160-240Zm80 0h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm240-320q33 0 56.5-23.5T560-640q0-33-23.5-56.5T480-720q-33 0-56.5 23.5T400-640q0 33 23.5 56.5T480-560Zm0-80Zm0 400Z';
function ic(name, size, cls) {
  const d = ICONS[name];
  if (!d) return '';
  return `<svg class="sb-ic ${cls || ''}" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
}
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fin = (v) => typeof v === 'number' && Number.isFinite(v);

const S = {
  menu: 'Menu', close: 'Close menu', back: 'Back',
  make: 'Make Alive yours', makeSub: 'Name, age group, home area — all optional',
  you: 'Your profile', noArea: 'Add your home area', edit: 'Edit your profile',
  whereto: 'Where to', airmap: 'Air around me', purest: 'Purest places', ledger: 'Trips',
  saved: 'Saved places', home: 'Home', work: 'Work', noSaved: 'Save home or work from Where to',
  settings: 'Settings', privacy: 'Privacy', privacySub: 'What stays on this phone',
  del: 'Delete my data',
  delConfirm: 'Delete my data? Your trips, settings, profile and saved places are removed from this phone.',
  pvTitle: 'What stays on this phone',
  pvLoc: 'Your location', pvLocT: 'Kept on this phone. Sent only to read the air at that spot.',
  pvTrips: 'Your trips', pvTripsOn: 'Kept here; shared without your name because trip sharing is on.',
  pvTripsOff: 'Stay on this phone.',
  pvPlaces: 'Saved places and searches', pvPlacesT: 'Stay on this phone.',
  pvProfile: 'Your profile', pvName: 'Your name never leaves this phone.',
  pvCountOn: 'Age group and area are counted anonymously.', pvCountOff: 'Nothing from it is counted.',
  pvNone: 'Not set.',
  pvCounters: 'Anonymous counts', pvCountersT: 'App opens and trips, with a random id — no location, no name.',
  pvNo: 'No account. Delete everything here anytime.',
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ── data (all read from this phone's storage) ── */
const profile = () => (A.profile && typeof A.profile.get === 'function' ? A.profile.get() : null);
function savedPlaces() {
  const s = A.store.get('whereto.saved', {}) || {};
  return ['home', 'work'].map((slot) => {
    const p = s[slot];
    return p && fin(p.lat) && fin(p.lon) ? { slot, name: String(p.name || ''), lat: p.lat, lon: p.lon } : null;
  }).filter(Boolean);
}
const tripCount = () => (A.store.get('journey.history', []) || []).filter((r) => r && !r.simulated).length;
const recentCount = () => (A.store.get('whereto.recents', []) || []).length;
const shareOn = () => !!((A.store.get('settings', {}) || {}).share);

/* ── markup ── */
function headHtml() {
  const p = profile();
  const has = p && (p.name || p.area || p.age_band);
  const initial = p && p.name ? p.name.trim()[0].toUpperCase() : '';
  const avatar = initial ? `<span class="sb-av sb-avtxt" aria-hidden="true">${esc(initial)}</span>`
    : `<span class="sb-av" aria-hidden="true">${ic('person', 26)}</span>`;
  if (!has) {
    return `<button class="sb-me" type="button" data-sb="profile">
        ${avatar}<span class="sb-memid"><span class="sb-mename sb-make">${esc(S.make)}</span>
        <span class="sb-mesub">${esc(S.makeSub)}</span></span>${ic('chevron', 20, 'sb-chev')}
      </button>`;
  }
  return `<button class="sb-me" type="button" data-sb="profile" aria-label="${esc(S.edit)}">
      ${avatar}<span class="sb-memid"><span class="sb-mename">${esc(p.name || S.you)}</span>
      <span class="sb-mesub">${esc(p.area ? p.area.name : S.noArea)}</span></span>${ic('chevron', 20, 'sb-chev')}
    </button>`;
}
const row = (attrs, glyph, label, sub, cls) => `<button class="sb-row${cls ? ' ' + cls : ''}" type="button" ${attrs}>
    ${ic(glyph, 22, 'sb-rowic')}<span class="sb-rowmid"><span class="sb-rowl">${esc(label)}</span>${sub ? `<span class="sb-rows">${esc(sub)}</span>` : ''}</span>
  </button>`;
function mainHtml() {
  const ready = A.screensReady || {};
  const nav = [['whereto', 'navigate'], ['airmap', 'explore'], ['purest', 'city'], ['ledger', 'history']]
    .filter(([id]) => ready[id])
    .map(([id, g]) => row(`data-go="${id}"`, g, S[id])).join('');
  const sp = savedPlaces();
  const saved = sp.length
    ? sp.map((p) => row(`data-saved="${p.slot}"`, p.slot, S[p.slot], p.name)).join('')
    : `<div class="sb-empty">${esc(S.noSaved)}</div>`;
  return `
    <div class="sb-top">${headHtml()}
      <button class="sb-x" type="button" data-sb="close" aria-label="${esc(S.close)}">${ic('close', 20)}</button>
    </div>
    <div class="sb-scroll">
      <div class="sb-group">${nav}</div>
      <div class="sb-label">${esc(S.saved)}</div>
      <div class="sb-group">${saved}</div>
      <div class="sb-sep"></div>
      <div class="sb-group">
        ${ready.settings ? row('data-go="settings"', 'tune', S.settings) : ''}
        ${row('data-sb="privacy"', 'shield', S.privacy, S.privacySub)}
        ${row('data-sb="delete"', 'trash', S.del, null, 'sb-danger')}
      </div>
    </div>`;
}
function privacyHtml() {
  const p = profile();
  const trips = tripCount(), places = savedPlaces().length, recents = recentCount();
  const item = (k, t, n) => `<li class="sb-pv"><span class="sb-pvk">${esc(k)}${n ? `<span class="sb-pvn">${esc(n)}</span>` : ''}</span><span class="sb-pvt">${esc(t)}</span></li>`;
  const prof = p ? `${S.pvName} ${p.share ? S.pvCountOn : S.pvCountOff}` : S.pvNone;
  return `
    <div class="sb-top sb-subtop">
      <button class="sb-x sb-backb" type="button" data-sb="main" aria-label="${esc(S.back)}">${ic('chevron', 22, 'sb-backic')}</button>
      <h2 class="sb-subh" tabindex="-1">${esc(S.pvTitle)}</h2>
    </div>
    <div class="sb-scroll">
      <ul class="sb-pvlist">
        ${item(S.pvLoc, S.pvLocT)}
        ${item(S.pvTrips, shareOn() ? S.pvTripsOn : S.pvTripsOff, trips ? plural(trips, 'trip', 'trips') : '')}
        ${item(S.pvPlaces, S.pvPlacesT, places + recents ? plural(places + recents, 'place', 'places') : '')}
        ${item(S.pvProfile, prof)}
        ${item(S.pvCounters, S.pvCountersT)}
      </ul>
      <div class="sb-pvno">${esc(S.pvNo)}</div>
      <div class="sb-group">${row('data-sb="delete"', 'trash', S.del, null, 'sb-danger')}</div>
    </div>`;
}

/* ── the drawer ── */
let root = null, panel = null, mainEl = null, subEl = null, open_ = false, retFocus = null, hideT = 0;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
function build() {
  if (root) return;
  root = document.createElement('div');
  root.id = 'sb';
  root.className = 'sb';
  root.hidden = true;
  root.innerHTML = `<div class="sb-scrim" data-sb="close"></div>
    <nav class="sb-panel" role="dialog" aria-modal="true" aria-label="${esc(S.menu)}" tabindex="-1">
      <section class="sb-page sb-main"></section>
      <section class="sb-page sb-sub" aria-hidden="true"></section>
    </nav>`;
  document.body.appendChild(root);
  panel = root.querySelector('.sb-panel');
  mainEl = root.querySelector('.sb-main');
  subEl = root.querySelector('.sb-sub');
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKey);
  wireSwipe();
}
function render() {
  if (!root) return;
  mainEl.innerHTML = mainHtml();
  if (root.classList.contains('sub-on')) subEl.innerHTML = privacyHtml();
}
function focusables(scope) {
  return [...scope.querySelectorAll(FOCUSABLE)].filter((x) => !x.hidden && x.offsetParent !== null);
}
function open(returnFocus) {
  build();
  clearTimeout(hideT);
  retFocus = returnFocus || document.activeElement;
  root.classList.remove('sub-on');
  subEl.setAttribute('aria-hidden', 'true'); mainEl.removeAttribute('aria-hidden');
  render();
  root.hidden = false;
  void root.offsetWidth;          /* commit the closed pose, then animate */
  root.classList.add('on');
  open_ = true;
  document.body.classList.add('sb-open');
  setTimeout(() => { if (open_) { const f = focusables(mainEl)[0]; (f || panel).focus({ preventScroll: true }); } }, 40);
}
function close(restore = true) {
  if (!root || !open_) return;
  open_ = false;
  root.classList.remove('on', 'drag');
  panel.style.transform = ''; root.style.removeProperty('--sb-scrim');
  document.body.classList.remove('sb-open');
  hideT = setTimeout(() => { if (!open_) { root.hidden = true; root.classList.remove('sub-on'); } }, 420);
  if (restore && retFocus && retFocus.isConnected && typeof retFocus.focus === 'function') {
    try { retFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  retFocus = null;
}
function showPrivacy(on) {
  if (on) {
    subEl.innerHTML = privacyHtml();
    root.classList.add('sub-on');
    subEl.removeAttribute('aria-hidden'); mainEl.setAttribute('aria-hidden', 'true');
    setTimeout(() => { const h = subEl.querySelector('.sb-subh'); if (h) h.focus({ preventScroll: true }); }, 60);
  } else {
    root.classList.remove('sub-on');
    mainEl.removeAttribute('aria-hidden'); subEl.setAttribute('aria-hidden', 'true');
    setTimeout(() => { const b = mainEl.querySelector('[data-sb="privacy"]'); if (b) b.focus({ preventScroll: true }); }, 60);
  }
}
function go(id) {
  close(false);
  if (A.current() === id) return;
  location.hash = `#/${id}`;
}
function openSaved(slot) {
  const p = savedPlaces().find((x) => x.slot === slot);
  close(false);
  if (!p || !(A.screensReady || {}).whereto) return;
  const label = p.name ? `${S[slot]} — ${p.name}` : S[slot];
  /* same shape whereto.finish() builds for a saved row; replace like the
     hash router does, then mirror the hash (a no-op for the router) */
  A.show('whereto', { to: { label, lat: p.lat, lon: p.lon } }, true);
  if (location.hash !== '#/whereto') location.hash = '#/whereto';
}
function wipe() {
  if (!window.confirm(S.delConfirm)) return;
  try { Object.keys(localStorage).filter((k) => k.startsWith('alive.')).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
  location.hash = '#/home';
  location.reload();
}
function onClick(e) {
  const g = e.target.closest('[data-go]');
  if (g) { go(g.dataset.go); return; }
  const sv = e.target.closest('[data-saved]');
  if (sv) { openSaved(sv.dataset.saved); return; }
  const a = e.target.closest('[data-sb]');
  if (!a) return;
  const act = a.dataset.sb;
  if (act === 'close') close();
  else if (act === 'privacy') showPrivacy(true);
  else if (act === 'main') showPrivacy(false);
  else if (act === 'delete') wipe();
  else if (act === 'profile') {
    const ret = retFocus;
    close(false);
    if (A.profile && typeof A.profile.open === 'function') {
      setTimeout(() => A.profile.open({ edit: true, returnFocus: ret }), 180);
    }
  }
}
function onKey(e) {
  if (!open_) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    if (root.classList.contains('sub-on')) showPrivacy(false); else close();
    return;
  }
  if (e.key !== 'Tab') return;
  const scope = root.classList.contains('sub-on') ? subEl : mainEl;
  const f = focusables(scope);
  if (!f.length) { e.preventDefault(); panel.focus(); return; }
  const first = f[0], last = f[f.length - 1];
  const inside = scope.contains(document.activeElement);
  if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus(); }
}
/* Esc also works when focus somehow left the drawer */
document.addEventListener('keydown', (e) => { if (open_ && e.key === 'Escape' && root && !root.contains(e.target)) { e.preventDefault(); close(); } });

/* swipe left to close: the panel follows the finger (transform only) */
function wireSwipe() {
  let x0 = 0, y0 = 0, t0 = 0, dx = 0, dragging = false, decided = false, id = null, w = 1, dragEndAt = 0;
  const reset = () => { dragging = false; decided = false; id = null; };
  root.addEventListener('pointerdown', (e) => {
    dragEndAt = 0;
    if (!open_ || (e.pointerType === 'mouse' && e.button !== 0)) return;
    id = e.pointerId; x0 = e.clientX; y0 = e.clientY; t0 = performance.now(); dx = 0;
    dragging = false; decided = false; w = panel.getBoundingClientRect().width || 1;
  });
  root.addEventListener('pointermove', (e) => {
    if (id !== e.pointerId || !open_) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!decided) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      decided = true;
      dragging = mx < 0 && Math.abs(mx) > Math.abs(my) * 1.2;
      if (dragging) root.classList.add('drag');
    }
    if (!dragging) return;
    dx = Math.min(0, mx);
    panel.style.transform = `translate3d(${dx}px,0,0)`;
    root.style.setProperty('--sb-scrim', String(Math.max(0, 1 + dx / w)));
  });
  const end = (e) => {
    if (id !== e.pointerId) return;
    const was = dragging;
    reset();
    if (!was) return;
    dragEndAt = performance.now();
    root.classList.remove('drag');
    const v = dx / Math.max(1, performance.now() - t0);   /* px/ms, negative = left */
    if (dx < -w * 0.3 || v < -0.45) close();
    else { panel.style.transform = ''; root.style.removeProperty('--sb-scrim'); }
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  /* a drag must not turn into a click on the row under the finger — only
     the click that immediately follows a drag is swallowed (keyboard and
     later taps are never affected) */
  root.addEventListener('click', (e) => {
    if (dragEndAt && performance.now() - dragEndAt < 350) { e.stopPropagation(); e.preventDefault(); }
    dragEndAt = 0;
  }, true);
}

/* keep the header honest while open; any screen change underneath (a
   journey taking over, the browser back button) closes the drawer */
document.addEventListener('alive:profile', () => { if (open_) render(); });
document.addEventListener('alive:screen', () => { if (open_) close(false); });
window.addEventListener('hashchange', () => { if (open_) close(false); });

A.sidebar = { open, close, isOpen: () => open_, render };
})();
