/* profile.js — A.profile: an optional profile that lives ONLY on this phone.

   Asked nicely, once: a bottom sheet after real engagement — the user has
   been active ≥45 s AND did one meaningful thing (opened a screen, which
   is where searching and planning happen) — or on the 2nd visit. Never
   during consent/onboarding, never during a journey, never over a focused
   input, only while home is on top; dismissed → not again that IST day,
   and after 3 dismissals never again (the sidebar header still edits it).

   Fields (all optional): name (never leaves this phone), age group chips,
   home area (type-ahead through A.search; stored as its display name +
   lat/lon rounded to 2 decimals). One switch, ON by default: "Count my
   age group and area anonymously — never my name" → on save
   A.track('profile', {age_band, area}) where area is locality text only.

   Store: alive.profile {v,name,age_band,area:{name,sub,lat,lon,locality},
   share,t,sent}; alive.profile.ask {visits,dismissed,dismissedDay,done}.
   API: A.profile.get() → {name, first, age_band, area, share, t} | null,
   A.profile.open({edit}) / close(), A.profile.firstName().
   Event: document 'alive:profile' (detail = get()) after every save. */
(() => {
'use strict';
if (!window.A || !A.store) return;

const K = 'profile', K_ASK = 'profile.ask';
const AGES = [['u13', 'Under 13'], ['13-17', '13–17'], ['18-29', '18–29'],
  ['30-44', '30–44'], ['45-59', '45–59'], ['60+', '60+']];
const ACTIVE_S = 45, SECOND_VISIT_S = 6, SETTLE_MS = 1500, MAX_DISMISS = 3;
const IST_MS = 330 * 60000;
const istDay = () => new Date(Date.now() + IST_MS).toISOString().slice(0, 10);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r2 = (v) => Math.round(v * 100) / 100;
const fin = (v) => typeof v === 'number' && Number.isFinite(v);

const S = {
  title: 'Make Alive yours', titleEdit: 'Your profile',
  name: 'Name', namePh: 'Your first name', nameFine: 'Stays on this phone',
  age: 'Age group', area: 'Home area', areaPh: 'Your colony, sector or town',
  areaBusy: 'Looking…', areaNone: 'No match yet — try your colony or sector',
  areaOff: "Search isn't available just now",
  share: 'Count my age group and area anonymously — never my name',
  save: 'Save', later: 'Not now', cancel: 'Cancel', remove: 'Remove my profile',
  saved: 'Saved on this phone', removed: 'Profile removed from this phone', clear: 'Clear',
};

/* ── model ── */
function cleanArea(a) {
  if (!a || typeof a !== 'object' || typeof a.name !== 'string' || !a.name.trim()) return null;
  return {
    name: a.name.trim().slice(0, 80),
    sub: typeof a.sub === 'string' ? a.sub.slice(0, 120) : '',
    lat: fin(a.lat) ? r2(a.lat) : null,
    lon: fin(a.lon) ? r2(a.lon) : null,
    locality: typeof a.locality === 'string' && a.locality.trim() ? a.locality.trim().slice(0, 60) : null,
  };
}
function get() {
  const p = A.store.get(K, null);
  if (!p || typeof p !== 'object') return null;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  return {
    name,
    first: name ? name.split(/\s+/)[0] : '',
    age_band: AGES.some((a) => a[0] === p.age_band) ? p.age_band : null,
    area: cleanArea(p.area),
    share: p.share !== false,
    t: p.t || 0,
  };
}
const firstName = () => { const p = get(); return p && p.first ? p.first : null; };
const ageLabel = (k) => { const a = AGES.find((x) => x[0] === k); return a ? a[1] : null; };
const ask = () => Object.assign({ visits: 0, dismissed: 0, dismissedDay: null, done: false },
  A.store.get(K_ASK, {}) || {});
const setAsk = (patch) => A.store.set(K_ASK, Object.assign(ask(), patch));

/* the area as plain locality text — what the anonymous counter may carry
   (never coordinates, never a house number or street) */
const AREA_KIND = /^(locality|suburb|neighbou?rhood|quarter|sector|colony|village|hamlet|town|city|district|city_district|state_district|county|borough|municipality|sublocality|area|residential|admin|region)/i;
const AREA_WORD = /(nagar|vihar|colony|enclave|sector|puri|pur|bagh|ganj|kunj|extension|extn|garh|abad|town|city|park|place|khas|kalan)\b/i;
const REGIONISH = /^(new )?delhi$|^india$|^ncr$|^nct|^national capital|uttar pradesh|haryana|rajasthan|^up$|^hr$/i;
const STREETISH = /\b(road|rd|marg|lane|gali|street|st|block|blk|pocket|pkt|floor|near|opp|opposite|behind|house|flat|plot|tower|gate)\b/i;
function localityOf(r) {
  const nm = String(r.name || '').trim();
  const sub = String(r.sub || '').trim();
  const nameOk = nm && !/\d/.test(nm);
  /* the row IS an area (by its kind, or the plain kind word search.js
     puts in `sub`, e.g. "locality") → its own name */
  if (nameOk && ((r.kind && AREA_KIND.test(String(r.kind))) || AREA_KIND.test(sub))) return nm.slice(0, 60);
  /* a named area word in the name ("Ashok Nagar", "Sector 62" has a digit) */
  if (nameOk && AREA_WORD.test(nm)) return nm.slice(0, 60);
  /* a POI with a provider address: the first locality-looking part.
     All-lowercase parts are kind labels ("historic site"), not places. */
  const parts = sub.split(/\s*[,·|]\s*/).map((s) => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (p.length < 3 || /\d/.test(p) || REGIONISH.test(p) || STREETISH.test(p)) continue;
    if (p === p.toLowerCase() || /^(digipin|exact spot)/i.test(p)) continue;
    return p.slice(0, 60);
  }
  return null;
}

function save(next) {
  const prev = A.store.get(K, null) || {};
  const area = cleanArea(next.area);
  const rec = {
    v: 1,
    name: String(next.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40),
    age_band: AGES.some((a) => a[0] === next.age_band) ? next.age_band : null,
    area,
    share: next.share !== false,
    t: Date.now(),
    sent: typeof prev.sent === 'string' ? prev.sent : null,
  };
  /* the anonymous count: age band + locality text only; the name never
     leaves this phone. Re-sent only when what it would say changed. */
  const areaText = area ? (area.locality || null) : null;
  if (rec.share && (rec.age_band || areaText)) {
    const sig = `${rec.age_band || ''}|${areaText || ''}`;
    if (sig !== rec.sent && typeof A.track === 'function') {
      const props = {};
      if (rec.age_band) props.age_band = rec.age_band === 'u13' ? 'under13' : rec.age_band === '60+' ? '60plus' : rec.age_band;
      if (areaText) props.area = areaText;
      try { A.track('profile', props); } catch (e) { /* counting never breaks saving */ }
      rec.sent = sig;
    }
  }
  A.store.set(K, rec);
  setAsk({ done: true });
  announce();
  return get();
}
function remove() {
  A.store.del(K);
  setAsk({ done: true });
  announce();
}
function announce() {
  try { document.dispatchEvent(new CustomEvent('alive:profile', { detail: get() })); } catch (e) {}
}

/* ── the sheet ── */
let el = null, st = null;
const isOpen = () => !!el;
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function areaRowsHtml() {
  if (!st) return '';
  const rows = st.rows || [];
  if (st.areaState === 'idle' || st.areaState === 'picked') return '';
  if (!rows.length) {
    const msg = st.areaState === 'busy' ? S.areaBusy : st.areaState === 'off' ? S.areaOff : S.areaNone;
    return `<div class="pf-areamsg" role="status">${esc(msg)}</div>`;
  }
  return rows.map((r, i) => `<button class="pf-row" type="button" role="option" data-pick="${i}">
      <span class="pf-rowt">${esc(r.name)}</span>${r.sub ? `<span class="pf-rows">${esc(r.sub)}</span>` : ''}
    </button>`).join('');
}
function html(p) {
  const edit = !st.prompt;
  return `<div class="pf-scrim" data-pf="scrim"></div>
    <div class="pf-sheet" role="dialog" aria-modal="true" aria-labelledby="pf-title">
      <div class="pf-grab" aria-hidden="true"></div>
      <h2 class="pf-title" id="pf-title" tabindex="-1">${esc(edit && p ? S.titleEdit : S.title)}</h2>
      <label class="pf-lbl" for="pf-name">${esc(S.name)}</label>
      <input class="pf-input" id="pf-name" type="text" maxlength="40" autocomplete="given-name"
        autocapitalize="words" spellcheck="false" enterkeyhint="next" placeholder="${esc(S.namePh)}" value="${esc(p ? p.name : '')}">
      <div class="pf-fine">${esc(S.nameFine)}</div>
      <div class="pf-lbl" id="pf-age-l">${esc(S.age)}</div>
      <div class="pf-chips" role="radiogroup" aria-labelledby="pf-age-l">
        ${AGES.map(([k, label]) => `<button class="pf-chip${st.age === k ? ' on' : ''}" type="button" role="radio" aria-checked="${st.age === k}" data-age="${k}">${esc(label)}</button>`).join('')}
      </div>
      <label class="pf-lbl" for="pf-area">${esc(S.area)}</label>
      <div class="pf-areabox">
        <input class="pf-input pf-areain" id="pf-area" type="text" autocomplete="off" spellcheck="false"
          enterkeyhint="search" role="combobox" aria-autocomplete="list" aria-controls="pf-arearows" aria-expanded="false"
          placeholder="${esc(S.areaPh)}" value="${esc(st.area ? st.area.name : '')}">
        <button class="pf-areaclr" type="button" data-pf="clear" aria-label="${esc(S.clear)}"${st.area ? '' : ' hidden'}>✕</button>
      </div>
      <div class="pf-areasub"${st.area && st.area.sub ? '' : ' hidden'}>${esc(st.area ? st.area.sub : '')}</div>
      <div class="pf-arearows" id="pf-arearows" role="listbox" aria-label="${esc(S.area)}"></div>
      <button class="pf-switch" type="button" role="switch" aria-checked="${st.share}" data-pf="share">
        <span class="pf-switcht">${esc(S.share)}</span>
        <span class="pf-sw${st.share ? ' on' : ''}" aria-hidden="true"><i></i></span>
      </button>
      <div class="pf-actions">
        <button class="pf-save" type="button" data-pf="save">${esc(S.save)}</button>
        <button class="pf-later" type="button" data-pf="later">${esc(edit ? S.cancel : S.later)}</button>
        ${edit && p ? `<button class="pf-remove" type="button" data-pf="remove">${esc(S.remove)}</button>` : ''}
      </div>
    </div>`;
}
function paintRows() {
  if (!el) return;
  const box = el.querySelector('#pf-arearows');
  if (box) box.innerHTML = areaRowsHtml();
  const inp = el.querySelector('#pf-area');
  if (inp) inp.setAttribute('aria-expanded', String(!!(st.rows && st.rows.length && st.areaState !== 'picked')));
  const clr = el.querySelector('[data-pf="clear"]');
  if (clr) clr.hidden = !(st.area || (inp && inp.value));
  const sub = el.querySelector('.pf-areasub');
  if (sub) { sub.textContent = st.area && st.area.sub ? st.area.sub : ''; sub.hidden = !(st.area && st.area.sub); }
}
function stopSearch() {
  if (!st) return;
  clearTimeout(st.deb);
  if (st.cancel) { try { st.cancel(); } catch (e) {} st.cancel = null; }
}
function onAreaInput(q) {
  stopSearch();
  st.area = null;
  const qt = String(q || '').trim();
  if (qt.length < 2) { st.rows = []; st.areaState = 'idle'; paintRows(); return; }
  const seq = ++st.seq;
  if (!st.rows.length) { st.areaState = 'busy'; paintRows(); }
  const bias = A.geo && A.geo.pos && fin(A.geo.pos.lat) ? { lat: A.geo.pos.lat, lon: A.geo.pos.lon } : A.DELHI;
  const take = (rows, final) => {
    if (!el || !st || seq !== st.seq) return;
    st.rows = (rows || []).filter((r) => r && r.name && fin(+r.lat) && fin(+r.lon)).slice(0, 5);
    st.areaState = final ? 'final' : 'busy';
    paintRows();
  };
  st.deb = setTimeout(() => {
    if (!el || seq !== st.seq) return;
    if (A.search && typeof A.search.live === 'function') {
      /* an area is a colony/sector/town: the fast tiers (our index + Ola/
         Mappls, Photon when thin) find it — no deep Overpass crawl, and no
         disturbing Where To's carried-over list (remember:false) */
      st.cancel = A.search.live(qt, bias, (rows, m) => take(rows, !!(m && m.final)), { remember: false, pauseMs: 1e9 });
    } else if (A.search && typeof A.search.search === 'function') {
      A.search.search(qt, bias).then((rows) => take(rows, true), () => take([], true));
    } else { st.rows = []; st.areaState = 'off'; paintRows(); }
  }, 140);
}
function pick(i) {
  const r = st.rows[i];
  if (!r) return;
  stopSearch();
  st.seq++;
  st.area = { name: String(r.name), sub: String(r.sub || ''), lat: r2(+r.lat), lon: r2(+r.lon), locality: localityOf(r) };
  st.rows = []; st.areaState = 'picked';
  const inp = el.querySelector('#pf-area');
  if (inp) { inp.value = st.area.name; inp.blur(); }
  paintRows();
}
function trap(e) {
  if (!el) return;
  if (e.key === 'Escape') { e.preventDefault(); close('later'); return; }
  if (e.key !== 'Tab') return;
  const f = [...el.querySelectorAll(FOCUSABLE)].filter((x) => !x.hidden && x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
}
function open(opts) {
  if (el) return;
  const p = get();
  const prompt = !!(opts && opts.prompt);
  st = { prompt, age: p ? p.age_band : null, area: p ? p.area : null, share: p ? p.share : true,
    rows: [], areaState: p && p.area ? 'picked' : 'idle', seq: 0, cancel: null, deb: 0,
    ret: opts && opts.returnFocus ? opts.returnFocus : document.activeElement };
  el = document.createElement('div');
  el.className = 'pf';
  el.innerHTML = html(p);
  document.body.appendChild(el);
  void el.offsetWidth;
  el.classList.add('on');
  /* focus the title, not an input: no keyboard jumping up uninvited */
  setTimeout(() => { const h = el && el.querySelector('#pf-title'); if (h) h.focus({ preventScroll: true }); }, 60);
  el.addEventListener('keydown', trap);
  el.addEventListener('click', onClick);
  el.querySelector('#pf-area').addEventListener('input', (e) => onAreaInput(e.target.value));
  el.querySelector('#pf-area').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); if (st.rows.length) pick(0); }
  });
  el.querySelector('#pf-name').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
  });
}
function onClick(e) {
  if (!el) return;
  const chip = e.target.closest('[data-age]');
  if (chip) {
    st.age = st.age === chip.dataset.age ? null : chip.dataset.age;   /* tap again = none */
    el.querySelectorAll('[data-age]').forEach((b) => {
      const on = b.dataset.age === st.age;
      b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on));
    });
    return;
  }
  const pk = e.target.closest('[data-pick]');
  if (pk) { pick(+pk.dataset.pick); return; }
  const act = e.target.closest('[data-pf]');
  if (!act) return;
  const a = act.dataset.pf;
  if (a === 'scrim' || a === 'later') { close('later'); return; }
  if (a === 'share') {
    st.share = !st.share;
    act.setAttribute('aria-checked', String(st.share));
    const k = act.querySelector('.pf-sw'); if (k) k.classList.toggle('on', st.share);
    return;
  }
  if (a === 'clear') {
    stopSearch(); st.seq++;
    st.area = null; st.rows = []; st.areaState = 'idle';
    const inp = el.querySelector('#pf-area'); if (inp) { inp.value = ''; inp.focus(); }
    paintRows();
    return;
  }
  if (a === 'remove') { remove(); close('saved'); A.toast(S.removed); return; }
  if (a === 'save') {
    const name = (el.querySelector('#pf-name') || {}).value || '';
    save({ name, age_band: st.age, area: st.area, share: st.share });
    close('saved');
    A.toast(S.saved);
  }
}
function close(reason) {
  if (!el) return;
  stopSearch();
  if (reason === 'later' && st && st.prompt) {
    const a = ask();
    setAsk({ dismissed: (a.dismissed || 0) + 1, dismissedDay: istDay() });
  }
  const node = el, ret = st && st.ret;
  el = null; st = null;
  node.classList.remove('on');
  node.classList.add('closing');
  setTimeout(() => node.remove(), 380);
  if (ret && ret.isConnected && typeof ret.focus === 'function') { try { ret.focus({ preventScroll: true }); } catch (e) {} }
}

/* ── when to ask ── */
try {
  if (!sessionStorage.getItem('alive.visit')) {
    sessionStorage.setItem('alive.visit', '1');
    setAsk({ visits: (ask().visits || 0) + 1 });
  }
} catch (e) { /* storage blocked: no 2nd-visit ask, engagement still works */ }

let activeS = 0, engaged = false, okSince = 0, asked = false;
document.addEventListener('alive:screen', (e) => {
  const id = e.detail && e.detail.id;
  if (id && id !== 'home') engaged = true;     /* opened a screen: search, plan, map… */
});
function wanted() {
  if (A.store.get(K, null)) return false;
  const a = ask();
  if (a.done || (a.dismissed || 0) >= MAX_DISMISS || a.dismissedDay === istDay()) return false;
  if ((a.visits || 0) >= 2) return activeS >= SECOND_VISIT_S;
  return activeS >= ACTIVE_S && engaged;
}
function calm() {
  if (document.visibilityState !== 'visible') return false;
  if (!A.geo || !A.geo.consent) return false;                       /* consent unanswered */
  const c = document.getElementById('consent');
  if (c && !c.hidden) return false;                                  /* consent / onboarding up */
  const ids = typeof A.stackIds === 'function' ? A.stackIds() : [A.current()];
  if (ids.includes('journey') || document.body.dataset.top === 'journey') return false;
  if (A.current() !== 'home') return false;
  if (document.querySelector('.hs-picking')) return false;           /* dropping a point */
  if (A.sidebar && typeof A.sidebar.isOpen === 'function' && A.sidebar.isOpen()) return false;
  const ae = document.activeElement;
  if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return false;
  return true;
}
setInterval(() => {
  if (document.visibilityState === 'visible') activeS++;
  if (asked || el || !wanted() || !calm()) { okSince = 0; return; }
  if (!okSince) { okSince = Date.now(); return; }
  if (Date.now() - okSince >= SETTLE_MS) { asked = true; okSince = 0; open({ prompt: true }); }
}, 1000);

A.profile = {
  get, firstName, ageLabel, open: (o) => open(Object.assign({}, o, { prompt: false })), close: () => close('later'),
  isOpen, AGES: AGES.map((a) => a.slice()),
  _dbg: { ask, activeS: () => activeS, engaged: () => engaged, localityOf },
};
})();
