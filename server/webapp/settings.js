/* settings.js — A.screen('settings'): only what's needed.
   Vehicle · Language · Share my trips (default OFF, honest caption) ·
   Delete my data. Shares the 'settings' store key with home.js (one
   truth for `share`); the vehicle writes 'whereto.vehicle' {cls,…} —
   the key the Where To screen reads. */
(() => {
'use strict';

const ICONS = {
  "chevron": ["M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z"],
  "trash": ["M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM400-280q17 0 28.5-11.5T440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280Zm160 0q17 0 28.5-11.5T600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280ZM280-720v520-520Z"],
  "bike": ["M280-200q-50 0-85-35t-35-85h-40q-17 0-28.5-11.5T80-360v-80q0-66 47-113t113-47h80q33 0 56.5 23.5T400-520v120h140l140-174v-106h-80q-17 0-28.5-11.5T560-720q0-17 11.5-28.5T600-760h80q33 0 56.5 23.5T760-680v106q0 14-4.5 26.5T743-524L604-350q-11 14-28 22t-35 8H400q0 50-35 85t-85 35Zm40-200Zm-40 120q17 0 28.5-11.5T320-320h-80q0 17 11.5 28.5T280-280Zm80-360H240q-17 0-28.5-11.5T200-680q0-17 11.5-28.5T240-720h120q17 0 28.5 11.5T400-680q0 17-11.5 28.5T360-640Zm400 440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T800-320q0-17-11.5-28.5T760-360q-17 0-28.5 11.5T720-320q0 17 11.5 28.5T760-280ZM160-400h160v-120h-80q-33 0-56.5 23.5T160-440v40Z"],
  "car": ["M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h410q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"],
  "auto": ["M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54ZM120-560v120h6q14-35 44.5-57.5T240-520q11 0 21 1.5t19 4.5v-46H120Zm520 120h46q9-26 28.5-45.5T760-514v-6H640v80ZM120-560h160-160Zm520 40h120-120Z"],
  "bus": ["M320-200v20q0 25-17.5 42.5T260-120q-25 0-42.5-17.5T200-180v-62q-18-20-29-44.5T160-340v-380q0-83 77-121.5T480-880q172 0 246 37t74 123v380q0 29-11 53.5T760-242v62q0 25-17.5 42.5T700-120q-25 0-42.5-17.5T640-180v-20H320Zm162-560h224-448 224Zm158 280H240h480-80Zm-400-80h480v-120H240v120Zm100 240q25 0 42.5-17.5T400-380q0-25-17.5-42.5T340-440q-25 0-42.5 17.5T280-380q0 25 17.5 42.5T340-320Zm280 0q25 0 42.5-17.5T680-380q0-25-17.5-42.5T620-440q-25 0-42.5 17.5T560-380q0 25 17.5 42.5T620-320ZM258-760h448q-15-17-64.5-28.5T482-800q-107 0-156.5 12.5T258-760Zm62 480h320q33 0 56.5-23.5T720-360v-120H240v120q0 33 23.5 56.5T320-280Z"],
  "metro": ["M80-160v-446q0-85 44-147.5T248-848q54-21 115-26.5t117-5.5q56 0 117 5.5T712-848q80 32 124 94.5T880-606v446q0 33-23.5 56.5T800-80H160q-33 0-56.5-23.5T80-160Zm220-280v-160h360v160H300Zm320 140q-17 0-28.5-11.5T580-340q0-17 11.5-28.5T620-380q17 0 28.5 11.5T660-340q0 17-11.5 28.5T620-300Zm-280 0q-17 0-28.5-11.5T300-340q0-17 11.5-28.5T340-380q17 0 28.5 11.5T380-340q0 17-11.5 28.5T340-300ZM160-160h640v-446q0-60-29.5-102.5T682-774q-44-17-97.5-21.5T480-800q-51 0-104.5 4.5T278-774q-59 23-88.5 65.5T160-606v446Z"],
  "cycle": ["M620-740q-33 0-56.5-23.5T540-820q0-33 23.5-56.5T620-900q33 0 56.5 23.5T700-820q0 33-23.5 56.5T620-740ZM432-540l66 69q11 11 16.5 25t5.5 30v176q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-160L312-512q-14-12-19-25t-5-31q0-18 5.5-30.5T312-624l112-112q13-13 27.5-18.5T484-760q18 0 32.5 5.5T544-736l76 76q21 21 47 35.5t58 20.5q17 3 28 15t11 29q0 17-12 28t-29 9q-49-7-90-28t-73-53l-32-32-96 96Zm-232 60q85 0 142.5 57.5T400-280q0 85-57.5 142.5T200-80q-85 0-142.5-57.5T0-280q0-85 57.5-142.5T200-480Zm0 340q57 0 98.5-41.5T340-280q0-57-41.5-98.5T200-420q-57 0-98.5 41.5T60-280q0 57 41.5 98.5T200-140Zm560-340q85 0 142.5 57.5T960-280q0 85-57.5 142.5T760-80q-85 0-142.5-57.5T560-280q0-85 57.5-142.5T760-480Zm0 340q57 0 98.5-41.5T900-280q0-57-41.5-98.5T760-420q-57 0-98.5 41.5T620-280q0 57 41.5 98.5T760-140Z"],
  "walk": ["M436-364 371-72q-3 14-14.5 23T330-40q-20 0-32-15t-8-34l102-515-72 28v96q0 17-11.5 28.5T280-440q-17 0-28.5-11.5T240-480v-122q0-12 6.5-21.5T264-638l178-76q14-6 29.5-7t29.5 4q14 5 26.5 14t20.5 23l40 64q13 20 30.5 38t39.5 31q14 8 31 14.5t34 9.5q16 3 26.5 14.5T760-480q0 17-12 28t-29 9q-56-8-100.5-35T541-543l-25 123 72 68q6 6 9 13.5t3 15.5v243q0 17-11.5 28.5T560-40q-17 0-28.5-11.5T520-80v-220l-84-64Zm104-376q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Z"]
};
function ic(name, size, cls) {
  const d = ICONS[name];
  if (!d) return '';
  return `<svg class="ic ${cls || ''}" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">${(Array.isArray(d) ? d : [d]).map((p) => `<path d="${p}"/>`).join('')}</svg>`;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── settings model — `share` defaults OFF, never on by itself ── */
const DEFAULT_SETTINGS = {
  lang: 'en', voice: true, share: false, brief: false, remind: true,
  alerts: true, alerts_fires: true, alerts_band: true,
  alerts_windows: true, alerts_reflect: true,
  show_cig: false, vehicle: null, home: null, work: null,
  profile: 'general', profile_set: false,
};
const getSettings = () => Object.assign({}, DEFAULT_SETTINGS, A.store.get('settings', {}));
const setSettings = (patch) => A.store.set('settings', Object.assign(getSettings(), patch));

/* ── strings (en) ── */
const S = {
  title: 'Settings', close: 'close',
  vehicle: 'My vehicle', vehicleHint: 'routes and fuel estimates use this',
  language: 'Language', hindiSoon: 'Hindi is on its way — English only for now',
  privacy: 'Privacy',
  share: 'Share my trips anonymously',
  shareExplain: 'Alive counts trips anonymously — never where you go, unless you turn this on. Shared trips carry no name or account, and their first and last 300 m are cut off before they are kept.',
  shareOn: 'On — finished trips are shared without your name. Turn off anytime.',
  shareOff: 'Off — your trips stay on this phone.',
  del: 'Delete my data',
  delHint: 'trips, settings and your location — from this phone',
  delConfirm: 'Delete my data? Your trips, settings and saved location are removed from this phone.',
};
const t = (k) => S[k] ?? k;

/* the classes the Where To screen plans with (whereto.js SERVER_CLASS keys) */
const VEHICLES = [
  ['car', 'Car', 'car'], ['bike', 'Bike / scooter', 'bike'], ['auto', 'Auto', 'auto'],
  ['bus', 'Bus', 'bus'], ['metro', 'Metro', 'metro'], ['cycle', 'Cycle', 'cycle'], ['walk', 'Walk', 'walk'],
];
const curVehicle = () => {
  const r = A.store.get('whereto.vehicle');
  const cls = r && (typeof r === 'string' ? r : r.cls);
  return VEHICLES.some((v) => v[0] === cls) ? cls : (getSettings().vehicle || null);
};

function settingsHtml() {
  const s = getSettings();
  const veh = curVehicle();
  return `
    <div class="st-seclabel">${esc(t('vehicle'))}</div>
    <div class="st-card st-vehcard">
      <div class="st-vehgrid" role="radiogroup" aria-label="${esc(t('vehicle'))}">
        ${VEHICLES.map(([k, label, glyph]) => `
          <button class="st-veh${veh === k ? ' on' : ''}" type="button" role="radio" aria-checked="${veh === k}" data-veh="${k}">
            ${ic(glyph, 20)}<span>${esc(label)}</span>
          </button>`).join('')}
      </div>
      <div class="st-vehhint">${esc(t('vehicleHint'))}</div>
    </div>

    <div class="st-seclabel">${esc(t('language'))}</div>
    <div class="st-card">
      <div class="st-row">
        <span class="st-segwrap" role="radiogroup" aria-label="${esc(t('language'))}">
          <button class="st-seg on" type="button" role="radio" aria-checked="true" data-lang="en">English</button>
          <button class="st-seg" type="button" role="radio" aria-checked="false" data-lang="hi">हिंदी</button>
        </span>
      </div>
    </div>

    <div class="st-seclabel">${esc(t('privacy'))}</div>
    <div class="st-card">
      <button class="st-row st-rowswitch" type="button" data-row="share" role="switch" aria-checked="${!!s.share}">
        <span class="st-rowmid"><span class="st-rowlabel">${esc(t('share'))}</span>
        <span class="st-hint">${esc(t(s.share ? 'shareOn' : 'shareOff'))}</span></span>
        <span class="st-sw${s.share ? ' on' : ''}" aria-hidden="true"><span class="st-swthumb"></span></span>
      </button>
      <div class="st-explain">${esc(t('shareExplain'))}</div>
      <div class="st-hair"></div>
      <button class="st-row" type="button" data-act="delete">
        ${ic('trash', 20, 'st-danger')}
        <span class="st-rowmid"><span class="st-rowlabel st-danger">${esc(t('del'))}</span>
        <span class="st-hint">${esc(t('delHint'))}</span></span>
      </button>
    </div>`;
}
function rerender(body) { body.innerHTML = settingsHtml(); }

A.screen('settings', {
  mount(elm) {
    elm.innerHTML = `
      <div class="st-scrim" data-act="back"></div>
      <div class="st-root">
        <div class="st-head">
          <button class="st-back" type="button" data-act="back" aria-label="${esc(t('close'))}">${ic('chevron', 22, 'st-backchev')}</button>
          <div class="st-title">${esc(t('title'))}</div>
        </div>
        <div class="st-scroll" id="st-scroll"></div>
      </div>`;
    const body = elm.querySelector('#st-scroll');
    rerender(body);

    elm.addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'back') { A.back(); return; }
      if (act && act.dataset.act === 'delete') {
        if (window.confirm(t('delConfirm'))) {
          Object.keys(localStorage).filter((k) => k.startsWith('alive.')).forEach((k) => localStorage.removeItem(k));
          location.hash = '#/home'; location.reload();
        }
        return;
      }
      const v = e.target.closest('[data-veh]');
      if (v) {
        const prev = A.store.get('whereto.vehicle');
        const same = prev && typeof prev === 'object' && prev.cls === v.dataset.veh;
        A.store.set('whereto.vehicle', same ? prev : { cls: v.dataset.veh, fuel: null, year: null, puc: null });
        setSettings({ vehicle: v.dataset.veh });
        rerender(body);
        return;
      }
      const lang = e.target.closest('[data-lang]');
      if (lang) {
        if (lang.dataset.lang === 'hi') A.toast(t('hindiSoon'));
        else setSettings({ lang: 'en' });
        return;
      }
      const sw = e.target.closest('[data-row="share"]');
      if (sw) {
        const next = !getSettings().share;
        setSettings({ share: next });
        rerender(body);
      }
    });
    return () => {};
  },
});
})();
