/* settings.js — NEW screen, pixel twin of
   Mobile/src/screens/SettingsScreen.tsx. Registered as
   A.screen('settings'); the coordinator wires index.html
   (script+link tags) and the home menu/door to '#/settings'.
   Shares the 'settings' store key with home.js so the budget profile,
   share choice and toggles are one truth. */
(() => {
'use strict';

const ICONS = {
  "chevron": ["M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z"],
  "info": ["M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"],
  "trash": ["M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM400-280q17 0 28.5-11.5T440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280Zm160 0q17 0 28.5-11.5T600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280ZM280-720v520-520Z"],
  "warn": ["M109-120q-11 0-20-5.5T75-140q-5-9-5.5-19.5T75-180l370-640q6-10 15.5-15t19.5-5q10 0 19.5 5t15.5 15l370 640q6 10 5.5 20.5T885-140q-5 9-14 14.5t-20 5.5H109Zm69-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm0-120q17 0 28.5-11.5T520-400v-120q0-17-11.5-28.5T480-560q-17 0-28.5 11.5T440-520v120q0 17 11.5 28.5T480-360Zm0-100Z"],
  "wind": ["M750-614q-27 27-62 41t-70 14q-35 0-69-13.5T488-614l-75-75q-15-15-34-22.5t-39-7.5q-20 0-39 7.5T267-689l-47 47q-12 12-28 11.5T164-643q-12-12-12-28.5t12-28.5l46-46q27-27 61-40.5t69-13.5q35 0 68.5 13.5T469-746l75 75q16 16 35 23.5t39 7.5q20 0 39.5-7.5T693-671l47-47q12-12 28.5-12t28.5 12q12 12 12 28.5T797-661l-47 47Zm0 200q-27 27-61.5 40.5T619-360q-35 0-69.5-13.5T488-414l-75-75q-15-15-34-22.5t-39-7.5q-20 0-39 7.5T267-489l-47 47q-11 11-27.5 11.5T164-442q-12-11-12.5-28t11.5-29l47-47q27-27 61-40.5t69-13.5q35 0 68.5 13.5T469-546l75 75q16 16 35 23.5t39 7.5q20 0 39.5-7.5T693-471l47-47q12-12 28.5-12t28.5 12q12 12 12 28.5T797-461l-47 47Zm-1 200q-27 27-61 40.5T619-160q-35 0-69.5-13.5T488-214l-76-75q-15-15-34-22.5t-39-7.5q-20 0-39 7.5T266-289l-47 47q-11 11-27.5 11.5T163-242q-11-11-11-28t11-28l47-48q27-27 61-40.5t69-13.5q35 0 68.5 13.5T469-346l75 75q16 16 35.5 23.5T619-240q20 0 39-7.5t35-23.5l47-47q12-12 28-11.5t28 12.5q11 12 11.5 28T796-261l-47 47Z"],
  "star": ["m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143Zm126 18L314-169q-11 7-23 6t-21-8q-9-7-14-17.5t-2-23.5l44-189-147-127q-10-9-12.5-20.5T140-571q4-11 12-18t22-9l194-17 75-178q5-12 15.5-18t21.5-6q11 0 21.5 6t15.5 18l75 178 194 17q14 2 22 9t12 18q4 11 1.5 22.5T809-528L662-401l44 189q3 13-2 23.5T690-171q-9 7-21 8t-23-6L480-269Zm0-201Z"],
  "star@fill": ["M480-269 314-169q-11 7-23 6t-21-8q-9-7-14-17.5t-2-23.5l44-189-147-127q-10-9-12.5-20.5T140-571q4-11 12-18t22-9l194-17 75-178q5-12 15.5-18t21.5-6q11 0 21.5 6t15.5 18l75 178 194 17q14 2 22 9t12 18q4 11 1.5 22.5T809-528L662-401l44 189q3 13-2 23.5T690-171q-9 7-21 8t-23-6L480-269Z"],
  "bike": ["M280-200q-50 0-85-35t-35-85h-40q-17 0-28.5-11.5T80-360v-80q0-66 47-113t113-47h80q33 0 56.5 23.5T400-520v120h140l140-174v-106h-80q-17 0-28.5-11.5T560-720q0-17 11.5-28.5T600-760h80q33 0 56.5 23.5T760-680v106q0 14-4.5 26.5T743-524L604-350q-11 14-28 22t-35 8H400q0 50-35 85t-85 35Zm40-200Zm-40 120q17 0 28.5-11.5T320-320h-80q0 17 11.5 28.5T280-280Zm80-360H240q-17 0-28.5-11.5T200-680q0-17 11.5-28.5T240-720h120q17 0 28.5 11.5T400-680q0 17-11.5 28.5T360-640Zm400 440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T800-320q0-17-11.5-28.5T760-360q-17 0-28.5 11.5T720-320q0 17 11.5 28.5T760-280ZM160-400h160v-120h-80q-33 0-56.5 23.5T160-440v40Z"],
  "car": ["M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h410q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"],
  "auto": ["M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54ZM120-560v120h6q14-35 44.5-57.5T240-520q11 0 21 1.5t19 4.5v-46H120Zm520 120h46q9-26 28.5-45.5T760-514v-6H640v80ZM120-560h160-160Zm520 40h120-120Z"],
  "cab": ["M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h85v-40q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800v40h85q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"],
  "bus": ["M320-200v20q0 25-17.5 42.5T260-120q-25 0-42.5-17.5T200-180v-62q-18-20-29-44.5T160-340v-380q0-83 77-121.5T480-880q172 0 246 37t74 123v380q0 29-11 53.5T760-242v62q0 25-17.5 42.5T700-120q-25 0-42.5-17.5T640-180v-20H320Zm162-560h224-448 224Zm158 280H240h480-80Zm-400-80h480v-120H240v120Zm100 240q25 0 42.5-17.5T400-380q0-25-17.5-42.5T340-440q-25 0-42.5 17.5T280-380q0 25 17.5 42.5T340-320Zm280 0q25 0 42.5-17.5T680-380q0-25-17.5-42.5T620-440q-25 0-42.5 17.5T560-380q0 25 17.5 42.5T620-320ZM258-760h448q-15-17-64.5-28.5T482-800q-107 0-156.5 12.5T258-760Zm62 480h320q33 0 56.5-23.5T720-360v-120H240v120q0 33 23.5 56.5T320-280Z"],
  "metro": ["M80-160v-446q0-85 44-147.5T248-848q54-21 115-26.5t117-5.5q56 0 117 5.5T712-848q80 32 124 94.5T880-606v446q0 33-23.5 56.5T800-80H160q-33 0-56.5-23.5T80-160Zm220-280v-160h360v160H300Zm320 140q-17 0-28.5-11.5T580-340q0-17 11.5-28.5T620-380q17 0 28.5 11.5T660-340q0 17-11.5 28.5T620-300Zm-280 0q-17 0-28.5-11.5T300-340q0-17 11.5-28.5T340-380q17 0 28.5 11.5T380-340q0 17-11.5 28.5T340-300ZM160-160h640v-446q0-60-29.5-102.5T682-774q-44-17-97.5-21.5T480-800q-51 0-104.5 4.5T278-774q-59 23-88.5 65.5T160-606v446Zm264-60h110l51 51q5 5 10.5 7t11.5 2q20 0 27.5-19t-6.5-33l-10-10q44-6 73-39.5t29-78.5v-260q0-78-70-99t-170-21q-91 0-165.5 21T240-600v260q0 45 29 78.5t73 39.5l-11 11q-14 14-6.5 32.5T352-160q6 0 11-2t10-7l51-51Zm-264 60v-446q0-60 29.5-102.5T278-774q44-17 97.5-21.5T480-800q51 0 104.5 4.5T682-774q59 23 88.5 65.5T800-606v446H160Z"],
  "cycle": ["M620-740q-33 0-56.5-23.5T540-820q0-33 23.5-56.5T620-900q33 0 56.5 23.5T700-820q0 33-23.5 56.5T620-740ZM432-540l66 69q11 11 16.5 25t5.5 30v176q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-160L312-512q-14-12-19-25t-5-31q0-18 5.5-30.5T312-624l112-112q13-13 27.5-18.5T484-760q18 0 32.5 5.5T544-736l76 76q21 21 47 35.5t58 20.5q17 3 28 15t11 29q0 17-12 28t-29 9q-49-7-90-28t-73-53l-32-32-96 96Zm-232 60q85 0 142.5 57.5T400-280q0 85-57.5 142.5T200-80q-85 0-142.5-57.5T0-280q0-85 57.5-142.5T200-480Zm0 340q57 0 98.5-41.5T340-280q0-57-41.5-98.5T200-420q-57 0-98.5 41.5T60-280q0 57 41.5 98.5T200-140Zm560-340q85 0 142.5 57.5T960-280q0 85-57.5 142.5T760-80q-85 0-142.5-57.5T560-280q0-85 57.5-142.5T760-480Zm0 340q57 0 98.5-41.5T900-280q0-57-41.5-98.5T760-420q-57 0-98.5 41.5T620-280q0 57 41.5 98.5T760-140Z"],
  "walk": ["M436-364 371-72q-3 14-14.5 23T330-40q-20 0-32-15t-8-34l102-515-72 28v96q0 17-11.5 28.5T280-440q-17 0-28.5-11.5T240-480v-122q0-12 6.5-21.5T264-638l178-76q14-6 29.5-7t29.5 4q14 5 26.5 14t20.5 23l40 64q13 20 30.5 38t39.5 31q14 8 31 14.5t34 9.5q16 3 26.5 14.5T760-480q0 17-12 28t-29 9q-56-8-100.5-35T541-543l-25 123 72 68q6 6 9 13.5t3 15.5v243q0 17-11.5 28.5T560-40q-17 0-28.5-11.5T520-80v-220l-84-64Zm104-376q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Z"]
};
function ic(name, size, cls) {
  const d = ICONS[name];
  if (!d) return '';
  return `<svg class="ic ${cls || ''}" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">${(Array.isArray(d) ? d : [d]).map((p) => `<path d="${p}"/>`).join('')}</svg>`;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── settings model (components/shell/settings.ts) ── */
const DEFAULT_SETTINGS = {
  lang: 'en', voice: true, share: true, brief: false, remind: true,
  alerts: true, alerts_fires: true, alerts_band: true,
  alerts_windows: true, alerts_reflect: true,
  show_cig: false, vehicle: null, home: null, work: null,
  profile: 'general', profile_set: false,
};
const getSettings = () => Object.assign({}, DEFAULT_SETTINGS, A.store.get('settings', {}));
const setSettings = (patch) => A.store.set('settings', Object.assign(getSettings(), patch));

/* ── verbatim en strings (i18n/strings.ts) ── */
const S = {
  sidebarSettings: 'Settings', settingsClose: 'close',
  sidebarMyVehicle: 'My vehicle',
  vehicleScooterBike: 'scooter / bike', vehicleCar: 'car', vehicleAuto: 'auto',
  vehicleCab: 'cab', vehicleBusMetro: 'bus / metro', vehicleCycleWalk: 'cycle / walk',
  vehicleQ1: 'What are you taking?', notSet: 'not set',
  settingsVehicleLike: 'estimates run on this', changeLabel: 'change',
  settingsGeneral: 'Language & display', settingsLanguage: 'Language',
  settingsVoice: 'Voice', settingsVoiceHint: 'spoken turn-by-turn guidance',
  settingsShowCig: 'Cigarette comparison', settingsShowCigHint: 'off by default — your dose stays in µg',
  settingsUnitsInfo: 'distances in km — metric only',
  settingsPrivacy: 'Privacy & sharing', settingsShareData: 'Share anonymous trip data',
  settingsShareExplain: 'share trips anonymously so Delhi sees its roads — nothing personal ever leaves this phone',
  shareDataHint: 'on — one tap to stop anytime',
  settingsStoreOff: 'off = nothing is uploaded; your own stats still work on this phone',
  settingsWhatWeStore: 'What we store',
  settingsStoreNoAccount: 'no name, no phone, no account — ever',
  settingsStoreTrim: 'trip ends stay hidden — the first and last 300 m are dropped before a trip is stored',
  settingsStoreThin: 'about one dot per 100 m of road, rounded to ~11 m',
  settingsStoreCells: 'kept only as counts on a street grid — the raw trail is thrown away',
  settingsStoreToken: 'a random id — never linked to you; it changes itself every ~30 days, or when you delete your data',
  settingsStoreK: 'a street appears only after 3+ different devices have crossed it',
  settingsDeleteData: 'Delete my data',
  deleteConfirmTitle: 'delete my data?',
  deleteConfirmBody: 'your trips, settings and anonymous id are removed from this phone',
  cancel: 'cancel', deleteConfirmYes: 'delete',
  settingsNotifications: 'Notifications',
  settingsNotifBlocked: 'notifications are blocked in system settings — tap to open and allow',
  settingsDepartRemind: 'clean-window pings',
  settingsDepartRemindHint: 'when a lighter time exists for your trip we offer a reminder — it goes off only if you tap it',
  morningAlert: 'Morning air alert', settingsBriefHint: "a ping the next morning with the day's cleanest window",
  settingsAlerts: 'Air alerts',
  settingsAlertsHint: 'the master switch for the alerts below — real events only, checked while the app is open',
  settingsAlertsFires: 'smoke & fires',
  settingsAlertsFiresHint: 'when the burn belt northwest of Delhi lights up',
  settingsAlertsBand: 'air turning worse',
  settingsAlertsBandHint: "band crossings, severe days, air that isn't moving",
  settingsAlertsWindows: 'clean windows',
  settingsAlertsWindowsHint: "when the day's lightest hours open up + tomorrow's read each evening",
  settingsAlertsReflect: 'your day on the road',
  settingsAlertsReflectHint: "yesterday's trips, once a day — from your own ledger",
  settingsAbout: 'About', settingsVersion: 'Version',
  settingsBuildLoading: 'reading…', settingsBuildNone: 'web app',
  settingsDataSources: 'air: satellite estimate + live stations when they connect',
  settingsHowNumbers: 'How numbers are estimated',
  settingsHowNumbersBody: "your breath number comes from a street-level air map — Delhi's monitoring stations + satellite weather, refreshed about every 15 minutes. it's always a range, never a fake-exact number. · 1 cigarette ≈ 316 µg of PM2.5 breathed in (the Berkeley Earth rule). · what your ride puts out comes from published tests on that kind of ride (ARAI / ICCT road measurements) — a range like 1.1–1.6 kg CO2. · your phone doesn't sense the air — it just moves through the map.",
  settingsNearestInstrument: "right now: a real monitoring instrument read ~{n} km from you — that's the map's honesty, not a model guess.",
  sidebarHowAliveWorks: 'How ALive works',
  howAliveBody: 'ALive maps every way to where you\'re going — metro, car, auto, on foot. For each, it estimates the smoke you\'d breathe along the way, from a live street-level air map built from stations, satellites and trips people shared. It also estimates the smoke your ride puts out, from published tests on that kind of ride. Your trips stay anonymous and help the city see its air street by street. Numbers are honest ranges, never fake-exact.',
  settingsRate: 'rate Alive', settingsRateNotePh: 'a line about the app — optional',
  settingsRateHint: "one line — what worked, what didn't",
  settingsRateFail: "couldn't send — check your connection and try again",
  settingsRateSend: 'send', settingsRateSending: 'sending…', settingsRateThanks: 'thanks — that helps',
};
const t = (k, vars) => {
  let s = S[k] ?? k;
  if (vars) for (const key of Object.keys(vars)) s = s.replaceAll(`{${key}}`, String(vars[key]));
  return s;
};

const STORE_BULLETS = [
  'settingsStoreNoAccount', 'settingsStoreTrim', 'settingsStoreThin',
  'settingsStoreCells', 'settingsStoreToken', 'settingsStoreK', 'settingsStoreOff',
];
const VEHICLE_LABEL = {
  two_wheeler: 'vehicleScooterBike', bike: 'vehicleScooterBike', scooter: 'vehicleScooterBike',
  car: 'vehicleCar', auto: 'vehicleAuto', rickshaw: 'vehicleAuto', cab: 'vehicleCab', taxi: 'vehicleCab',
  bus_metro: 'vehicleBusMetro', transit: 'vehicleBusMetro', bus: 'vehicleBusMetro', metro: 'vehicleBusMetro',
  cycle: 'vehicleCycleWalk', bicycle: 'vehicleCycleWalk', walk: 'vehicleCycleWalk', cycle_walk: 'vehicleCycleWalk',
};
const vehicleGlyph = (vehicle) => {
  const k = (vehicle || '').toLowerCase();
  if (k.includes('walk')) return 'walk';
  if (k.includes('cycle') || k.includes('bicycle')) return 'cycle';
  if (k.includes('auto') || k.includes('rickshaw')) return 'auto';
  if (k.includes('two_wheeler') || k.includes('bike') || k.includes('scooter') || k.includes('moto')) return 'bike';
  if (k.includes('bus')) return 'bus';
  if (k.includes('metro')) return 'metro';
  if (k.includes('cab') || k.includes('taxi')) return 'cab';
  return 'car';
};
const notifPerm = () =>
  ('Notification' in window && Notification.permission) || 'denied';

/* ── row builders ── */
const hairline = '<div class="st-hair"></div>';
const switchHtml = (key, on, disabled) => `
  <span class="st-sw ${on ? 'on' : ''} ${disabled && on ? 'dison' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(t(key))}">
    <span class="st-swthumb"></span>
  </span>`;
const rowSwitch = (labelKey, hintKey, key, disabled) => `
  <button class="st-row st-rowswitch ${disabled ? 'off' : ''}" data-row="${key}">
    <span class="st-rowmid"><span class="st-rowlabel">${esc(t(labelKey))}</span>${hintKey ? `<span class="st-hint">${esc(t(hintKey))}</span>` : ''}</span>
    ${switchHtml(key, !!getSettings()[key], disabled)}
  </button>`;
const sectionLabel = (k) => `<div class="st-seclabel">${esc(t(k))}</div>`;
let expandKey = null;
const expander = (labelKey, k, body, icon) => `
  <button class="st-row st-exprow" data-exp="${k}" aria-expanded="${expandKey === k}">
    ${ic(icon || 'info', 20, 'st-rowic')}
    <span class="st-rowmid"><span class="st-rowlabel">${esc(t(labelKey))}</span></span>
    ${ic('chevron', 18, 'st-expchev' + (expandKey === k ? ' open' : ''))}
  </button>
  ${expandKey === k ? `<div class="st-expbody">${body}</div>` : ''}`;

/* ── rate-alive body ── */
const rateState = { stars: 0, note: '', state: 'idle' };
function rateHtml() {
  if (rateState.state === 'ok') {
    return `<div class="st-ratedone">${ic('star@fill', 18)}<span class="st-bodytxt">${esc(t('settingsRateThanks'))}</span></div>`;
  }
  return `
    <div class="st-ratestars">${[1, 2, 3, 4, 5].map((i) =>
      `<button class="st-star ${rateState.stars >= i ? 'on' : ''}" data-star="${i}" aria-label="${i}">${ic(rateState.stars >= i ? 'star@fill' : 'star', 28)}</button>`).join('')}
    </div>
    <input class="st-rateinput" type="text" maxlength="240" placeholder="${esc(t('settingsRateNotePh'))}" value="${esc(rateState.note)}" />
    <div class="st-ratefoot">
      <span class="st-ratehint ${rateState.state === 'err' ? 'err' : ''}">${esc(rateState.state === 'err' ? t('settingsRateFail') : t('settingsRateHint'))}</span>
      <button class="st-ratesend" data-send="1">${esc(rateState.state === 'sending' ? t('settingsRateSending') : t('settingsRateSend'))}</button>
    </div>`;
}

/* ── the card bodies ── */
let nearestTxt = null;
function howNumbersBody() {
  return `<div class="st-bodytxt">${esc(t('settingsHowNumbersBody'))}</div>
    ${nearestTxt != null ? `<div class="st-bodytxt st-nearest">${esc(t('settingsNearestInstrument', { n: nearestTxt }))}</div>` : ''}`;
}
const storeBody = () =>
  STORE_BULLETS.map((k) => `<div class="st-bullet"><span class="st-bdot"></span><span class="st-btxt">${esc(t(k))}</span></div>`).join('');

function settingsHtml() {
  const s = getSettings();
  const vehRec = A.store.get('whereto.vehicle');
  const veh = s.vehicle || (vehRec && (typeof vehRec === 'string' ? vehRec : vehRec.cls));
  const vehLabel = veh ? t(VEHICLE_LABEL[veh] || 'vehicleQ1') : t('notSet');
  const denied = notifPerm() === 'denied';
  return `
    <div class="st-card">
      <button class="st-row" data-go="whereto">
        <span class="st-vehwell">${ic(vehicleGlyph(veh || 'car'), 22)}</span>
        <span class="st-rowmid"><span class="st-rowlabel">${esc(t('sidebarMyVehicle'))}</span>
        <span class="st-hint">${esc(veh ? `${vehLabel} · ${t('settingsVehicleLike')}` : vehLabel)}</span></span>
        <span class="st-action">${esc(t('changeLabel'))}</span>
      </button>
    </div>

    ${sectionLabel('settingsGeneral')}
    <div class="st-card">
      <div class="st-row">
        <span class="st-rowmid"><span class="st-rowlabel">${esc(t('settingsLanguage'))}</span></span>
        <span class="st-segwrap">
          <button class="st-seg on" data-lang="en">English</button>
          <button class="st-seg" data-lang="hi">हिंदी</button>
        </span>
      </div>
      ${hairline}
      ${rowSwitch('settingsVoice', 'settingsVoiceHint', 'voice')}
      ${hairline}
      ${rowSwitch('settingsShowCig', 'settingsShowCigHint', 'show_cig')}
      ${hairline}
      <div class="st-row">${ic('info', 20, 'st-rowic')}<span class="st-rowmid"><span class="st-hint" style="margin-top:0">${esc(t('settingsUnitsInfo'))}</span></span></div>
    </div>

    ${sectionLabel('settingsPrivacy')}
    <div class="st-card">
      ${rowSwitch('settingsShareData', null, 'share')}
      <div class="st-explain">${esc(t('settingsShareExplain'))}<div class="st-explainstatus">${esc(t(s.share ? 'shareDataHint' : 'settingsStoreOff'))}</div></div>
      ${hairline}
      ${expander('settingsWhatWeStore', 'store', storeBody(), 'info')}
      ${hairline}
      <button class="st-row" data-act="delete">
        ${ic('trash', 20, 'st-danger')}
        <span class="st-rowmid"><span class="st-rowlabel st-danger">${esc(t('settingsDeleteData'))}</span></span>
      </button>
    </div>

    ${sectionLabel('settingsNotifications')}
    <div class="st-card">
      ${denied ? `<button class="st-row" data-act="notifperm">
        ${ic('warn', 20, 'st-danger')}
        <span class="st-rowmid"><span class="st-hint" style="margin-top:0">${esc(t('settingsNotifBlocked'))}</span></span>
        ${ic('chevron', 18, 'st-expchev')}
      </button>${hairline}` : ''}
      ${rowSwitch('settingsDepartRemind', 'settingsDepartRemindHint', 'remind')}
      ${hairline}
      ${rowSwitch('morningAlert', 'settingsBriefHint', 'brief')}
      ${hairline}
      ${rowSwitch('settingsAlerts', 'settingsAlertsHint', 'alerts')}
      ${hairline}
      ${rowSwitch('settingsAlertsFires', 'settingsAlertsFiresHint', 'alerts_fires', !s.alerts)}
      ${hairline}
      ${rowSwitch('settingsAlertsBand', 'settingsAlertsBandHint', 'alerts_band', !s.alerts)}
      ${hairline}
      ${rowSwitch('settingsAlertsWindows', 'settingsAlertsWindowsHint', 'alerts_windows', !s.alerts)}
      ${hairline}
      ${rowSwitch('settingsAlertsReflect', 'settingsAlertsReflectHint', 'alerts_reflect', !s.alerts)}
    </div>

    ${sectionLabel('settingsAbout')}
    <div class="st-card">
      <div class="st-row">
        <span class="st-rowmid"><span class="st-rowlabel">${esc(t('settingsVersion'))}</span></span>
        <span class="st-value" id="st-build">${esc(t('settingsBuildLoading'))}</span>
      </div>
      ${hairline}
      <div class="st-row">${ic('wind', 20, 'st-rowic')}<span class="st-rowmid"><span class="st-bodytxt">${esc(t('settingsDataSources'))}</span></span></div>
      ${hairline}
      ${expander('settingsHowNumbers', 'numbers', howNumbersBody(), 'info')}
      ${hairline}
      ${expander('sidebarHowAliveWorks', 'alive', `<div class="st-bodytxt">${esc(t('howAliveBody'))}</div>`, 'info')}
      ${hairline}
      ${expander('settingsRate', 'rate', rateHtml(), 'star')}
    </div>`;
}

function rerender(body) { body.innerHTML = settingsHtml(); }

A.screen('settings', {
  mount(elm) {
    elm.innerHTML = `
      <div class="st-scrim" data-act="back"></div>
      <div class="st-root">
        <div class="st-head">
          <button class="st-back" data-act="back" aria-label="${esc(t('settingsClose'))}">${ic('chevron', 22, 'st-backchev')}</button>
          <div class="st-title">${esc(t('sidebarSettings'))}</div>
        </div>
        <div class="st-scroll" id="st-scroll"></div>
      </div>`;
    const body = elm.querySelector('#st-scroll');
    rerender(body);

    /* provenance line for "how numbers" — the field's nearest instrument */
    const pos = A.geo.pos || A.DELHI;
    A.api.get(`/aqi?lat=${pos.lat}&lon=${pos.lon}`, 8000).then((j) => {
      if (j && j.nearest_station_km != null) {
        nearestTxt = j.nearest_station_km.toFixed(1);
        if (expandKey === 'numbers') rerender(body);
      }
    });

    /* the deployed build, live — never a stale 'dev build' label */
    A.api.get('/health', 6000).then((h) => {
      const el = body.querySelector('#st-build');
      if (el) el.textContent = (h && h.build_sha) ? `web · ${String(h.build_sha).slice(0, 8)}` : t('settingsBuildNone');
    });

    elm.addEventListener('click', async (e) => {
      if (e.target.closest('[data-act="back"]')) { A.back(); return; }
      const g = e.target.closest('[data-go]');
      if (g) { location.hash = `#/${g.dataset.go}`; return; }
      const act = e.target.closest('[data-act]');
      if (act && act.dataset.act === 'delete') {
        if (window.confirm(`${t('deleteConfirmTitle')} — ${t('deleteConfirmBody')}`)) {
          Object.keys(localStorage).filter((k) => k.startsWith('alive.')).forEach((k) => localStorage.removeItem(k));
          location.hash = '#/home'; location.reload();
        }
        return;
      }
      if (act && act.dataset.act === 'notifperm') {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(rerender.bind(null, body));
        } else {
          A.toast("enable it in the browser's site settings");
        }
        return;
      }
      const lang = e.target.closest('[data-lang]');
      if (lang) {
        if (lang.dataset.lang === 'hi') {
          A.toast('hindi lands with the app — the web build is english-only today');
        } else setSettings({ lang: 'en' });
        return;
      }
      const exp = e.target.closest('[data-exp]');
      if (exp) {
        expandKey = expandKey === exp.dataset.exp ? null : exp.dataset.exp;
        rerender(body);
        return;
      }
      const star = e.target.closest('[data-star]');
      if (star) { rateState.stars = Number(star.dataset.star); rerender(body); return; }
      const send = e.target.closest('[data-send]');
      if (send) {
        if (!rateState.stars || rateState.state === 'sending') return;
        rateState.note = (body.querySelector('.st-rateinput') || {}).value || '';
        rateState.state = 'sending'; rerender(body);
        const r = await A.api.post('/v2/feedback', {
          stars: rateState.stars, note: rateState.note.trim().slice(0, 240) || undefined, build: 'web',
        });
        rateState.state = r === null ? 'err' : 'ok';
        if (rateState.state === 'ok') { rateState.stars = 0; rateState.note = ''; }
        rerender(body);
        return;
      }
      const sw = e.target.closest('[data-row]');
      if (sw) {
        const key = sw.dataset.row;
        if (sw.classList.contains('off')) return;   // disabled kind row
        const cur = !!getSettings()[key];
        const next = !cur;
        /* arming a real delivery surface: web Notification permission is
           the honest gate, same as RN's armNotifs */
        if (next && (key === 'brief' || key === 'alerts' || key === 'remind') &&
            'Notification' in window && Notification.permission === 'default') {
          const p = await Notification.requestPermission();
          if (p !== 'granted') { rerender(body); return; }
        }
        if (next && Notification.permission === 'denied' && (key === 'brief' || key === 'alerts' || key === 'remind')) {
          A.toast("enable notifications in the browser's site settings first");
          return;
        }
        setSettings({ [key]: next });
        rerender(body);
      }
    });
    return () => {};
  },
});
})();
