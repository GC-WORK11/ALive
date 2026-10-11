/* Alive webapp — where to. PIXEL TWIN of the Android app's
   Mobile/src/screens/SearchScreen.tsx + components/shell/CompareSheet.tsx
   option cards + screens/VehicleSheet.tsx.
   Same screens, same card order, same strings, same shapes, same type,
   same spacing. The web runtime stays: A.search cascade + mrank honoring,
   A.api /v2/plan, A.map paint, A.show('journey', {option, from, to}). */
(() => {
'use strict';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const el = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild; };

/* ── RN tokens (theme.ts) — local vars, never app.css's ───────────── */
const INK = '#16181D', INK2 = '#4A4E57', INK3 = '#6E7278', INK4 = '#A6ACB8';
const ACCENT = '#35614B', ACC_INK = '#2A4D3B', ACC_WASH = '#EFEDE7', ACC_TINT = '#E5E2DA';
const PIN_DEST = '#C05F3A', BREATH1 = '#CF8A50', BREATH2 = '#C05F3A', BREATH3 = '#A83D30';
const SURF2 = '#F3F2EC', PAPER = '#FAFAF7';
const BAND_HEX = ['#6E93AE', '#C7A34F', '#CF8A50', '#C05F3A', '#A83D30', '#6E2D28'];
const MAP_QUIET = '#8A93A3';
const PM25_BREAKS = [30, 60, 90, 120, 250];
const bandIdx = (pm) => { let i = 0; while (i < PM25_BREAKS.length && pm > PM25_BREAKS[i]) i++; return Math.min(i, 5); };
const doseColor = (pm) => bandIdx(pm) <= 1 ? INK3 : BAND_HEX[bandIdx(pm)];

/* ── strings — en table verbatim from Mobile/src/i18n/strings.ts ──── */
const T = {
  fromLabel: 'from', fieldTo: 'To', yourSpot: 'your spot…',
  searchPlaceholder: 'Where to?', searchFromPlaceholder: 'Where from?',
  yourLocation: 'Your location', chooseOnMap: 'Choose on map',
  mapPickHint: 'tap the map to drop a pin there',
  sidebarSavedPlaces: 'Saved places', recents: 'Recent',
  exploreHeader: 'air answers', resultsHeader: 'Results',
  searching: 'Searching…', noPlaceFound: 'no place found — try a landmark',
  emptySearchHint: 'type a place or landmark — or choose on the map',
  outsideDelhi: 'outside Delhi — no smoke estimate here',
  home: 'Home', work: 'Work',
  saveAsHome: 'Save as Home', saveAsWork: 'Save as Work',
  savedHome: 'Home saved', savedWork: 'Work saved',
  removeHome: 'Remove Home', removeWork: 'Remove Work',
  staysTitle: 'where to stay', doorStaysSub: 'stays, lightest air first · near you',
  explorePlayTitle: 'when to go out', doorPlaySub: 'the next 24 h · near you',
  airIntentTitle: 'the air map',
  checkingRoutes: 'finding the purest route for you…',
  noRoutes: 'no route found between those two places',
  plan_failed: "couldn't load the ways there — check the connection",
  plan_failed_server: "the server couldn't route this trip",
  plan_retry: 'try again',
  plan_outside_title: 'this trip sits outside Delhi NCR',
  plan_outside_body: 'Alive only measures the air inside Delhi NCR — this trip leaves the air map, so its smoke can’t be counted honestly.',
  plan_outside_cta: 'change the trip',
  plan_coverage_note: 'smoke counted only for the Delhi NCR part',
  compare_smokeIn: 'smoke you breathe', compare_pick: 'our pick',
  compare_safest: 'least smoky', compare_yours: 'your usual',
  compare_feltMore: '~{x}× more inhaled than {m}',
  compare_moreVs: '+{n} µg more than {m}', compare_doseNA: 'no estimate',
  delta_airPct: '{p}% air', delta_sameAir: 'same air',
  delta_minQuicker: '{m} min quicker', delta_sameTime: 'same time',
  delta_worth: 'worth it for {who}', delta_takeFast: 'take the fast one',
  delta_defaultBoth: 'the default — fastest AND the lighter air today',
  delta_defaultCleanSlow: 'the default · the lighter air, {m} min slower',
  delta_defaultSaves: 'the default · {p} air vs the purest — saves {m} min',
  delta_defaultSlower: 'the default · {p} air vs the purest — {m} min slower',
  delta_selfLightest: 'the default — fastest, and the lightest air today',
  who_schoolRun: 'the school run', who_rider: 'a delivery rider',
  who_commute: 'the commute', who_rideIn: 'the ride in',
  who_walkThere: 'the walk there', who_visitor: 'a visitor',
  startJourney: 'start journey', arriveAt: 'arrive {t}',
  unitsKm: 'km', minUnit: 'min', bandUpTo: 'up to {n}',
  lightestOnBoth: 'lightest on both', lightestForYou: 'lightest for you',
  lightestForDelhi: 'lightest for Delhi',
  viaStreets: 'via {streets}',
  veh_introTitle: 'before you pick',
  veh_introBody: 'the smoke estimate fits what you actually take — a metro cabin, a bike, a car on Ring Road breathe different air on the same trip.',
  veh_introHonest: 'no sign-in, nothing leaves this phone. you can skip it — the Delhi fleet average is a decent guess.',
  veh_start: "tell us what you're taking", veh_why: 'your pick sharpens the “your ride puts out” numbers — saved on this phone only',
  vehicleQ1: 'What are you taking?', vehicleQ2: 'Fuel?',
  vehicleQ3: 'Roughly when was it bought?',
  vehicleQ_back: 'back', vehicleQ_skip: 'skip — a typical Delhi ride works',
  vehicleDone: 'got it — estimates now use your ride.',
  vehicle_likeYours: 'a typical Delhi ride', veh_now: 'right now: {v}',
  veh_grp_own: 'your own', veh_grp_shared: 'shared', veh_grp_noengine: 'no engine',
  vehicle_car: 'car', vehicle_auto: 'auto', vehicle_bike: 'bike / scooter',
  vehicle_bus: 'bus', vehicle_metro: 'metro', vehicle_cycle: 'cycle', vehicle_walk: 'on foot',
  veh_cap_car: 'petrol · diesel · CNG · EV', veh_cap_auto: '3-wheeler · mostly CNG',
  veh_cap_bike: 'scooter · motorcycle', veh_cap_bus: 'shared ride',
  veh_cap_metro: 'electric · shared', veh_cap_cycle: 'no exhaust', veh_cap_walk: 'no exhaust',
  fuelPetrol: 'petrol', fuelDiesel: 'diesel', fuelCNG: 'CNG', fuelElectric: 'electric',
  veh_cap_petrol: 'cars · scooters · bikes', veh_cap_diesel: 'more fine particles',
  veh_cap_cng: 'lighter exhaust', veh_cap_ev: 'no exhaust',
  yearBefore2010: 'before 2010', year2010to2016: '2010–2016',
  vehicle_year2017to2020: '2017–2020', vehicle_year2021plus: '2021 or later',
  yearNotSure: 'not sure', veh_cap_y_notsure: 'we’ll use the Delhi average',
  puc_title: 'PUC certificate (optional)', puc_helper: "from your vehicle's pollution certificate — improves YOUR emissions estimate",
  puc_bsQ: 'Bharat stage on the certificate',
  puc_bs3: 'BS-III', puc_bs4: 'BS-IV', puc_bs6: 'BS-VI',
  puc_co: 'CO %', puc_coHint: 'carbon monoxide — petrol / CNG',
  puc_hc: 'HC ppm', puc_hcHint: 'hydrocarbons — petrol / CNG',
  puc_smoke: 'smoke %', puc_smokeHint: 'smoke density — diesel',
  receipt_save: 'save', puc_badge: 'PUC',
};
const t = (k, vars) => {
  let s = T[k] != null ? T[k] : k;
  if (vars) for (const kk in vars) s = s.split(`{${kk}}`).join(vars[kk]);
  return s;
};

/* ── icons — same Material Symbols Rounded geometry as icons.tsx,
   960-unit grid (viewBox "0 -960 960 960") ────────────────────────── */
const D = {
  walk: 'M436-364 371-72q-3 14-14.5 23T330-40q-20 0-32-15t-8-34l102-515-72 28v96q0 17-11.5 28.5T280-440q-17 0-28.5-11.5T240-480v-122q0-12 6.5-21.5T264-638l178-76q14-6 29.5-7t29.5 4q14 5 26.5 14t20.5 23l40 64q13 20 30.5 38t39.5 31q14 8 31 14.5t34 9.5q16 3 26.5 14.5T760-480q0 17-12 28t-29 9q-56-8-100.5-35T541-543l-25 123 72 68q6 6 9 13.5t3 15.5v243q0 17-11.5 28.5T560-40q-17 0-28.5-11.5T520-80v-220l-84-64Zm104-376q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Z',
  cycle: 'M620-740q-33 0-56.5-23.5T540-820q0-33 23.5-56.5T620-900q33 0 56.5 23.5T700-820q0 33 56.5 23.5T620-740ZM432-540l66 69q11 11 16.5 25t5.5 30v176q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-160L312-512q-14-12-19-25t-5-31q0-18 5.5-30.5T312-624l112-112q13-13 27.5-18.5T484-760q18 0 32.5 5.5T544-736l76 76q21 21 47 35.5t58 20.5q17 3 28 15t11 29q0 17-12 28t-29 9q-49-7-90-28t-73-53l-32-32-96 96Zm-232 60q85 0 142.5 57.5T400-280q0 85-57.5 142.5T200-80q-85 0-142.5-57.5T0-280q0-85 57.5-142.5T200-480Zm0 340q57 0 98.5-41.5T340-280q0-57-41.5-98.5T200-420q-57 0-98.5 41.5T60-280q0 57 41.5 98.5T200-140Zm560-340q85 0 142.5 57.5T960-280q0 85-57.5 142.5T760-80q-85 0-142.5-57.5T560-280q0-85 57.5-142.5T760-480Zm0 340q57 0 98.5-41.5T900-280q0-57-41.5-98.5T760-420q-57 0-98.5 41.5T620-280q0 57 41.5 98.5T760-140Z',
  bike: 'M280-200q-50 0-85-35t-35-85h-40q-17 0-28.5-11.5T80-360v-80q0-66 47-113t113-47h80q33 0 56.5 23.5T400-520v120h140l140-174v-106h-80q-17 0-28.5-11.5T560-720q0-17 11.5-28.5T600-760h80q33 0 56.5 23.5T760-680v106q0 14-4.5 26.5T743-524L604-350q-11 14-28 22t-35 8H400q0 50-35 85t-85 35Zm40-200Zm-40 120q17 0 28.5-11.5T320-320h-80q0 17 11.5 28.5T280-280Zm80-360H240q-17 0-28.5-11.5T200-680q0-17 11.5-28.5T240-720h120q17 0 28.5 11.5T400-680q0 17-11.5 28.5T360-640Zm400 440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T800-320q0-17-11.5-28.5T760-360q-17 0-28.5 11.5T720-320q0 17 11.5 28.5T760-280ZM160-400h160v-120h-80q-33 0-56.5 23.5T160-440v40Z',
  auto: 'M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54ZM120-560v120h6q14-35 44.5-57.5T240-520q11 0 21 1.5t19 4.5v-46H120Zm520 120h46q9-26 28.5-45.5T760-514v-6H640v80ZM120-560h160-160Zm520 40h120-120Z',
  car: 'M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h410q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z',
  cab: 'M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h85v-40q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800v40h85q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z',
  bus: 'M320-200v20q0 25-17.5 42.5T260-120q-25 0-42.5-17.5T200-180v-62q18-20 29-44.5T160-340v-380q0-83 77-121.5T480-880q172 0 246 37t74 123v380q0 29-11 53.5T760-242v62q0 25-17.5 42.5T700-120q-25 0-42.5-17.5T640-180v-20H320Zm162-560h224-448 224Zm158 280H240h480-80Zm-400-80h480v-120H240v120Zm100 240q25 0 42.5-17.5T400-380q0-25-17.5-42.5T340-440q-25 0-42.5 17.5T280-380q0 25 17.5 42.5T340-320Zm280 0q25 0 42.5-17.5T680-380q0-25-17.5-42.5T620-440q-25 0-42.5 17.5T560-380q0 25 17.5 42.5T620-320ZM258-760h448q-15-17-64.5-28.5T482-800q-107 0-156.5 12.5T258-760Zm62 480h320q33 0 56.5-23.5T720-360v-120H240v120q0 33 23.5 56.5T320-280Z',
  metro: 'M80-160v-446q0-85 44-147.5T248-848q54-21 115-26.5t117-5.5q56 0 117 5.5T712-848q80 32 124 94.5T880-606v446q0 33-23.5 56.5T800-80H160q-33 0-56.5-23.5T80-160Zm220-280v-160h360v160H300Zm320 140q-17 0-28.5-11.5T580-340q0-17 11.5-28.5T620-380q17 0 28.5 11.5T660-340q0 17-11.5 28.5T620-300Zm-280 0q-17 0-28.5-11.5T300-340q0-17 11.5-28.5T340-380q17 0 28.5 11.5T380-340q0 17-11.5 28.5T340-300ZM160-160h640v-446q0-60-29.5-102.5T682-774q-44-17-97.5-21.5T480-800q-51 0-104.5 4.5T278-774q-59 23-88.5 65.5T160-606v446Zm264-60h110l51 51q5 5 10.5 7t11.5 2q20 0 27.5-19t-6.5-33l-10-10q44-6 73-39.5t29-78.5v-260q0-78-70-99t-170-21q-91 0-165.5 21T240-600v260q0 45 29 78.5t73 39.5l-11 11q-14 14-6.5 32.5T352-160q6 0 11-2t10-7l51-51Zm-264 60v-446q0-60 29.5-102.5T278-774q44-17 97.5-21.5T480-800q-51 0-104.5 4.5T278-774q59 23 88.5 65.5T800-606v446H160Z',
  locate: 'M440-82v-40q-125-14-214.5-103.5T122-440H82q-17 0-28.5-11.5T42-480q0-17 11.5-28.5T82-520h40q14-125 103.5-214.5T440-838v-40q0-17 11.5-28.5T480-918q17 0 28.5 11.5T520-878v40q125 14 214.5 103.5T838-520h40q17 0 28.5 11.5T918-480q0 17-11.5 28.5T878-440h-40q-14 125-103.5 214.5T520-122v40q0 17-11.5 28.5T480-42q-17 0-28.5-11.5T440-82Zm40-118q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400Zm0-80Z',
  pin: 'M480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 79q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 45-17.5 94.5t-51 103Q698-301 648-244T533-127q-11 10-25 15t-28 5Zm0-453Zm0 80q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z',
  search: 'M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z',
  close: 'M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z',
  home: 'M240-200h120v-200q0-17 11.5-28.5T400-440h160q17 0 28.5 11.5T600-400v200h120v-360L480-740 240-560v360Zm-80 0v-360q0-19 8.5-36t23.5-28l240-180q21-16 48-16t48 16l240 180q15 11 23.5 28t8.5 36v360q0 33-23.5 56.5T720-120H560q-17 0-28.5-11.5T520-160v-200h-80v200q0 17-11.5 28.5T400-120H240q-33 0-56.5-23.5T160-200Zm320-270Z',
  work: 'M160-120q-33 0-56.5-23.5T80-200v-440q0-33 23.5-56.5T160-720h160v-80q0-33 23.5-56.5T400-880h160q33 0 56.5 23.5T640-800v80h160q33 0 56.5 23.5T880-640v440q0 33-23.5 56.5T800-120H160Zm0-80h640v-440H160v440Zm240-520h160v-80H400v80ZM160-200v-440 440Z',
  clock: 'M520-496v-144q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v159q0 8 3 15.5t9 13.5l132 132q11 11 28 11t28-11q11-11 11-28t-11-28L520-496ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z',
  hotel: 'M80-200q-17 0-28.5-11.5T40-240v-520q0-17 11.5-28.5T80-800q17 0 28.5 11.5T120-760v360h320v-240q0-33 23.5-56.5T520-720h240q66 0 113 47t47 113v320q0 17-11.5 28.5T880-200q-17 0-28.5-11.5T840-240v-80H120v80q0 17-11.5 28.5T80-200Zm200-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 40h320v-160q0-33-23.5-56.5T760-640H520v240ZM280-520q17 0 28.5-11.5T320-560q0-17-11.5-28.5T280-600q-17 0-28.5 11.5T240-560q0 17 11.5 28.5T280-520Zm0-40Zm240-80v240-240Z',
  explore: 'M480-440q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520q17 0 28.5 11.5T520-480q0 17-11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320ZM297-277l250-117q6-3 11-8t8-11l117-250q5-10-2.5-17.5T663-683L413-566q-6 3-11 8t-8 11L277-297q-5 10 2.5 17.5T297-277Z',
  leaf: 'M216-176q-45-45-70.5-104T120-402q0-63 24-124.5T222-642q60-60 169.5-91T675-759q26 1 48 11t39 27q17 17 27 39.5t11 48.5q2 82-4.5 151.5t-21 125.5q-14.5 56-37 99.5T684-182q-53 53-112.5 77.5T450-80q-65 0-127-25.5T216-176Zm112-16q29 17 59.5 24.5T450-160q46 0 91-18.5t86-59.5q18-18 36.5-50.5t32-85Q709-426 716-500.5t2-177.5q-49-2-110.5-1.5T485-670q-61 9-116 29t-90 55q-45 45-62 89t-17 85q0 59 22.5 103.5T262-246q42-80 111-153.5T534-520q-72 63-125.5 142.5T328-192Zm0 0Zm0 0Z',
  trash: 'M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM400-280q17 0 28.5-11.5T440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280Zm160 0q17 0 28.5-11.5T600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280ZM280-720v520-520Z',
  info: 'M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
  dust: 'M460-160q-32 0-59.5-16T356-220q-11-20-.5-40t32.5-20q13 0 23 8t18 18q5 7 13.5 10.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H120q-17 0-28.5-11.5T80-360q0-17 11.5-28.5T120-400h340q50 0 85 35t35 85q0 50-35 85t-85 35ZM120-560q-17 0-28.5-11.5T80-600q0-17 11.5-28.5T120-640h500q25 0 42.5-17.5T680-700q0-25-17.5-42.5T620-760q-16 0-30 7.5T568-731q-7 12-17 21.5t-24 9.5q-20 0-32.5-15t-6.5-32q14-42 50.5-67.5T620-840q58 0 99 41t41 99q0 58-41 99t-99 41H120Zm678 308q-20 9-39-2.5T740-288q0-14 9.5-23.5T771-328q14-8 21.5-22t7.5-30q0-25-17.5-42.5T740-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h620q58 0 99 41t41 99q0 42-22 76.5T798-252Z',
  warn: 'M109-120q-11 0-20-5.5T75-140q-5-9-5.5-19.5T75-180l370-640q6-10 15.5-15t19.5-5q10 0 19.5 5t15.5 15l370 640q6 10 5.5 20.5T885-140q-5 9-14 14.5t-20 5.5H109Zm69-80h604L480-720 178-200Zm302-40q17 0 28.5-11.5T520-280q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280q0 17 11.5 28.5T480-240Zm0-120q17 0 28.5-11.5T520-400v-120q0-17-11.5-28.5T480-560q-17 0-28.5 11.5T440-520v120q0 17 11.5 28.5T480-360Zm0-100Z',
  hospital: 'M420-420v80q0 25 17.5 42.5T480-280q25 0 42.5-17.5T540-340v-80h80q25 0 42.5-17.5T680-480q0-25-17.5-42.5T620-540h-80v-80q0-25-17.5-42.5T480-680q-25 0-42.5 17.5T420-620v80h-80q-25 0-42.5 17.5T280-480q0 25 17.5 42.5T340-420h80ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z',
  pharmacy: 'M204-120q-42 0-65.5-33T128-225l72-215-72-215q-13-39 10.5-72t65.5-33h424l41-113q7-20 25.5-28.5T733-903q20 7 28.5 25.5T763-839l-29 79h22q42 0 65.5 33t10.5 72l-72 215 72 215q13 39-10.5 72T756-120H204Zm236-160h80v-120h120v-80H520v-120h-80v120H320v80h120v120Zm-236 80h552l-80-240 80-240H204l80 240-80 240Zm276-240Z',
  shop: 'M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33-23.5-56.5T480-720ZM240-160v-480 480Z',
  mall: 'M200-80q-33 0-56.5-23.5T120-160v-480q0-33 23.5-56.5T200-720h80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720h80q33 0 56.5 23.5T840-640v480q0 33-23.5 56.5T760-80H200Zm0-80h560v-480H200v480Zm160-560h240q0-50-35-85t-85-35q-50 0-85 35t-35 85ZM200-160v-480 480Zm279-240q74 0 134-49t59-110q0-17-11-29t-28-12q-14 0-25 9t-16 27q-11 38-43 61t-70 23q-38 0-70.5-23T366-564q-5-19-15-27.5t-24-8.5q-17 0-28.5 12T287-559q0 61 59 110t133 49Z',
  school: 'M242-249q-20-11-31-29.5T200-320v-192l-96-53q-11-6-16-15t-5-20q0-11 5-20t16-15l338-184q9-5 18.5-7.5T480-829q10 0 19.5 2.5T518-819l381 208q10 5 15.5 14.5T920-576v256q0 17-11.5 28.5T880-280q-17 0-28.5-11.5T840-320v-236l-80 44v192q0 23-11 41.5T718-249L518-141q-9 5-18.5 7.5T480-131q-10 0-19.5-2.5T442-141L242-249Zm238-203 274-148-274-148-274 148 274 148Zm0 241 200-108v-151l-161 89q-9 5-19 7.5t-20 2.5q-10 0-20-2.5t-19-7.5l-161-89v151l200 108Zm0-241Zm0 121Zm0 0Z',
  airport: 'M480-120 377-91q-14 4-25.5-4.5T340-118q0-12 3-19.5t8-11.5l69-51v-220l-291 86q-19 5-34-6t-15-31q0-15 5-25t14-15l321-189v-220q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v220l321 189q9 5 14 15t5 25q0 20-15 31t-34 6l-291-86v220l69 51q5 4 8 11.5t3 19.5q0 14-11.5 22.5T583-91l-103-29Z',
  temple: 'M80-160v-320q0-17 11.5-28.5T120-520q17 0 28.5 11.5T160-480v40h80l119-395v-45q0-17 11.5-28.5T399-920q17 0 28.5 11.5T439-880v40h81v-40q0-17 11.5-28.5T560-920q17 0 28.5 11.5T600-880v40l120 400h80v-40q0-17 11.5-28.5T840-520q17 0 28.5 11.5T880-480v320q0 33-23.5 56.5T800-80H560q-17 0-28.5-11.5T520-120v-160h-80v160q0 17-11.5 28.5T400-80H160q-33 0-56.5-23.5T80-160Zm268-360h264l-24-80H372l-24 80Zm48-160h168l-24-80H420l-24 80ZM160-160h200v-120q0-33 23.5-56.5T440-360h80q33 0 56.5 23.5T600-280v120h200v-200h-80q-26 0-47.5-15.5T643-417l-7-23H324l-7 23q-8 26-29.5 41.5T240-360h-80v200Zm320-280Z',
  mosque: 'M40-200v-411q-18-11-29-28.5T0-680q0-23 24-56t56-64q32 31 56 64t24 56q0 23-11 40.5T120-611v171h80v-80q0-25 16-48t46-30q-11-17-16.5-37t-5.5-41q0-40 19-74t51-56l125-84q20-14 45-14t45 14l125 84q32 22 51 56t19 74q0 21-5.5 41T698-598q30 7 46 30t16 48v80h80v-171q-18-11-29-28.5T800-680q0-23 24-56t56-64q32 31 56 64t24 56q0 23-11 40.5T920-611v411q0 33-23.5 56.5T840-120H560q-17 0-28.5-11.5T520-160v-120q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280v120q0 17-11.5 28.5T400-120H120q-33 0-56.5-23.5T40-200Zm356-400h168q32 0 54-22t22-54q0-20-9-36.5T606-740l-126-84-126 84q-16 11-25 27.5t-9 36.5q0 32 22 54t54 22ZM120-200h240v-80q0-50 35-85t85-35q50 0 85 35t35 85v80h240v-160h-80q-33 0-56.5-23.5T680-440v-80H280v80q0 33-23.5 56.5T200-360h-80v160Zm360-320Zm0-80Zm0 2Z',
  church: 'M80-160v-188q0-24 13-43.5t35-29.5l112-50v-80q0-23 12-41.5t32-29.5l156-78v-60h-40q-17 0-28.5-11.5T360-800q0-17 11.5-28.5T400-840h40v-40q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v40h40q17 0 28.5 11.5T600-800q0 17-11.5 28.5T560-760h-40v60l156 78q20 11 32 29.5t12 41.5v80l112 50q22 10 35 29.5t13 43.5v188q0 33-23.5 56.5T800-80H560q-17 0-28.5-11.5T520-120v-120q0-17-11.5-28.5T480-280q-17 0-28.5 11.5T440-240v120q0 17-11.5 28.5T400-120H160q-33 0-56.5-23.5T80-160Zm80 0h200v-82q0-51 35-86.5t85-35.5q50 0 85 35.5t35 86.5v82h200v-192l-160-72v-134l-160-82-160 82v134l-160 72v192Zm320-260q25 0 42.5-17.5T540-480q0-25-17.5-42.5T480-540q-25 0-42.5 17.5T420-480q0 25 17.5 42.5T480-420q0 20Z',
  bank: 'M200-320v-200q0-17 11.5-28.5T240-560q17 0 28.5 11.5T280-520v200q0 17-11.5 28.5T240-280q-17 0-28.5-11.5T200-320Zm240 0v-200q0-17-11.5-28.5T480-560q17 0 28.5 11.5T520-520v200q0 17-11.5 28.5T480-280q-17 0-28.5-11.5T440-320ZM120-120q-17 0-28.5-11.5T80-160q0-17 11.5-28.5T120-200h720q17 0 28.5 11.5T880-160q0 17-11.5 28.5T840-120H120Zm560-200v-200q0-17-11.5-28.5T720-560q17 0 28.5 11.5T760-520v200q0 17-11.5 28.5T720-280q-17 0-28.5-11.5T680-320Zm160-320H116q-15 0-25.5-10.5T80-676v-22q0-11 5.5-19t14.5-13l344-172q17-8 36-8t36 8l342 171q11 5 16.5 15t5.5 21v15q0 17-11.5 28.5T840-640Zm-582-80h444-444Zm0 0h444L480-830 258-720Z',
  atm: 'M520-400H400q-17 0-28.5 11.5T360-360q0 17-11.5 28.5T400-320h40q0 17 11.5 28.5T480-280q17 0 28.5 11.5T520-320h40q17 0 28.5-11.5T600-360v-120q0-17-11.5-28.5T560-520H440v-40h120q17 0 28.5 11.5T600-600q0-17-11.5-28.5T560-640h-40q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640h-40q-17 0-28.5 11.5T360-600v120q0 17-11.5 28.5T400-440h120v40ZM160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h640v-480H160v480Zm0 0v-480 480Z',
  fuel: 'M160-160v-600q0-33 23.5-56.5T240-840h240q33 0 56.5 23.5T560-760v280h40q33 0 56.5 23.5T680-400v180q0 17 11.5 28.5T720-180q17 0 28.5-11.5T760-220v-288q-9 5-19 6.5t-21 1.5q-42 0-71-29t-29-71q0-32 17.5-57.5T684-694l-63-63q-9-9-9-21t9-21q8-8 20.5-8.5T663-800l127 124q15 15 22.5 35t7.5 41v380q0 42-29 71t-71 29q-42 0-71-29t-29-71v-200h-60v260q0 17-11.5 28.5T520-120H200q-17 0-28.5-11.5T160-160Zm80-400h240v-200H240v200Zm480 0q17 0 28.5-11.5T760-600q0-17-11.5-28.5T720-640q-17 0-28.5 11.5T680-600q0 17 11.5 28.5T720-560ZM240-200h240v-280H240v280Zm240 0H240h240Z',
  police: 'm480-420 85 65q6 5 12 .5t4-11.5l-33-106 89-70q5-5 3-11.5t-9-6.5H524l-34-107q-2-7-10-7t-10 7l-34 107H329q-7 0-9.5 6.5T322-542l88 70-33 107q-2 7 4 11.5t12-.5l87-66Zm0 336q-7 0-13-1t-12-3q-135-45-215-166.5T160-516v-189q0-25 14.5-45t37.5-29l240-90q14-5 28-5t28 5l240 90q23 9 37.5 29t14.5 45v189q0 140-80 261.5T505-88q-6 2-12 3t-13 1Zm0-80q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132Zm0-316Z',
  gym: 'M282-622 168-508q-11-11-27.5-11.5T112-508q-11-11-11.5-27.5T111-564l29-30-28-28q-12-12-12-28t12-28l56-56-29-30q-11-11-11-27.5t12-28.5q11-11 27.5-11.5T196-821l30 29 56-56q12-12 28-12t28 12l28 28 30-29q11-11 27.5-11t28.5 12q11 11 11 28t-11 28L338-678l340 340 114-114q11-11 27.5-11.5T848-452q11 11 11.5 27.5T849-396l-29 30 28 28q12 12 12 28t-12 28l-56 56 29 30q11 11 11 27.5T820-140q-11 11-27.5 11.5T764-139l-30-29-56 56q-12 12-28 12t-28-12l-28-28-30 29q-11 11-27.5 11T508-112q-11-11-11-28t11-28l114-114-340-340Z',
  office: 'M200-120q-33 0-56.5-23.5T120-200v-400q0-33 23.5-56.5T200-680h80v-80q0-33 23.5-56.5T360-840h240q33 0 56.5 23.5T680-760v240h80q33 0 56.5 23.5T840-440v240q0 33-23.5 56.5T760-120H520v-160h-80v160H200Zm0-80h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 320h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm160 480h80v-80h-80v80Zm0-160h80v-80h-80v80Z',
  cinema: 'm160-800 65 130q7 14 20 22t28 8q30 0 46-25.5t2-52.5l-41-82h80l65 130q7 14 20 22t28 8q30 0 46-25.5t2-52.5l-41-82h80l65 130q7 14 20 22t28 8q30 0 46-25.5t2-52.5l-41-82h80l65 130q7 14 20 22t28 8q30 0 46-25.5t2-52.5l-41-82h120q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800Zm0 240v320h640v-320H160Zm0 0v320-320Z',
  stadium: 'M120-712v-96q0-11 9.5-17t19.5-1l95 48q11 5 11 18t-11 18l-95 48q-10 5-19.5-1t-9.5-17Zm600 0v-96q0-11 9.5-17t19.5-1l95 48q11 5 11 18t-11 18l-95 48q-10 5-19.5-1t-9.5-17Zm-280-40v-96q0-11 9.5-17t19.5-1l95 48q11 5 11 18t-11 18l-95 48q-10 5-19.5-1t-9.5-17ZM406-81q-140-8-233-41.5T80-200v-360q0-25 31.5-46.5t85.5-38q54-16 127-26t156-9.5q83 0 156 9.5t127 26q54 16 85.5 38T880-560v360q0 45-93.5 78T553-81q-14 1-23.5-8.5T520-113v-127h-80v126q0 14-10 24t-24 9Zm74-439q97 0 167.5-11.5T760-558q0-5-76-23.5T480-600q-128 0-204 18.5T200-558q42 15 112.5 26.5T480-520ZM360-166v-74q0-33 23.5-56.5T440-320h80q33 0 56.5 23.5T600-240v74q80-8 131-23.5t69-27.5v-271q-55 22-138 35t-182 13q-99 0-182-13t-138-35v271q18 12 69 27.5T360-166Zm120-161Z',
  park: 'M402-240H195q-24 0-36-21t2-41l119-178h-3q-24 0-35.5-21.5T244-543l203-290q6-8 15-12.5t18-4.5q9 0 18 4.5t15 12.5l203 290q14 20 2.5 41.5T683-480h-3l119 178q14 20 2 41t-36 21H558v120q0 17-11.5 28.5T518-80h-76q-17 0-28.5-11.5T402-120v-120Zm-132-80h160-76 252-76 160-420Zm0 0h420L530-560h76L480-740 354-560h76L270-320Z',
  monument: 'M40-200v-47q0-16 6-30.5T63-303l57-57v-240l-57-57q-11-11-17-25.5T40-713v-87q0-17 11.5-28.5T80-840q17 0 28.5 11.5T120-800v40h80v-40q0-17 11.5-28.5T240-840q17 0 28.5 11.5T280-800v40h80v-40q0-17 11.5-28.5T400-840q17 0 28.5 11.5T440-800v87q0 16-6 30.5T417-657l-57 57v40h240v-40l-57-57q-11-11-17-25.5t-6-30.5v-87q0-17 11.5-28.5T560-840q17 0 28.5 11.5T600-800v40h80v-40q0-17 11.5-28.5T720-840q17 0 28.5 11.5T760-800v40h80v-40q0-17 11.5-28.5T880-840q17 0 28.5 11.5T920-800v87q0 16-6 30.5T897-657l-57 57v240l57 57q11 11 17 25.5t6 30.5v47q0 33-23.5 56.5T840-120H600q-17 0-28.5-11.5T560-160v-80q0-33-23.5-56.5T480-320q-33 0-56.5 23.5T400-240v80q0 17-11.5 28.5T360-120H120q-33 0-56.5-23.5T40-200Zm80 0h200v-40q0-66 47-113t113-47q66 0 113 47t47 113v40h200v-47l-80-80v-306l47-47H633l47 47v153H280v-153l47-47H153l47 47v306l-80 80v47Zm360-240Z',
  museum: 'M80-80v-80h80v-360h-26q-23 0-38.5-16T80-575q0-12 5.5-22t15.5-17l333-234q11-8 22.5-11.5T480-863q12 0 23.5 3.5T526-848l333 234q10 7 15.5 17.5T880-574q0 23-15.5 38.5T826-520h-26v360h80v80H80Zm640-80v-454L480-782 240-614v454h480ZM480-312q10 0 18.5-4.5T513-330l47-70v120q0 17 11.5 28.5T600-240q17 0 28.5-11.5T640-280v-207q0-14-9.5-23.5T607-520h-29q-8 0-15.5 4T550-505l-70 105-68-102q-5-8-14-13t-19-5h-19q-17 0-28.5 11.5T320-480v200q0 17-11.5 28.5T360-240q17 0 28.5-11.5T400-280v-120l47 70q6 9 14.5 13.5T480-312Zm240 152H240h480Z',
  rail: 'M208-80q-14 0-19-12t5-22l46-46h480l46 46q10 10 5 22t-19 12H208Zm72-120 40-40h-20q-58 0-99-41t-41-99v-260q0-129 92.5-204.5T480-920q135 0 227.5 75.5T800-640v260q0 58-41 99t-99 41h-20l40 40H280Zm20-120h360q25 0 42.5-17.5T720-380v-140H240v140q0 25 17.5 42.5T300-320Zm180-40q25 0 42.5-17.5T540-420q0-25-17.5-42.5T480-480q-25 0-42.5 17.5T420-420q0 25 17.5 42.5T480-360ZM240-600h480v-40q0-23-4.5-42.5T703-720H257q-8 18-12.5 37.5T240-640v40Zm89-200h302q-31-20-69.5-30T480-840q-43 0-81.5 10T329-800Zm151 280Zm0-280Z',
  flame: 'M480-80q-134 0-227-93t-93-227q0-113 67-217t184-182q22-15 45.5-1.5T480-760v52q0 34 23.5 57t57.5 23q17 0 32.5-7.5T621-657q8-10 20.5-12.5T665-664q63 45 99 115t36 149q0 134-93 227T480-80ZM240-400q0 52 21 98.5t60 81.5q-1-5-1-9v-9q0-32 12-60t35-51l113-111 113 111q23 23 35 51t12 60v9q0 4-1 9 39-35 60-81.5t21-98.5q0-50-18.5-94.5T648-574q-20 13-42 19.5t-45 6.5q-62 0-107.5-41T401-690q-78 66-119.5 140.5T240-400Zm240 52-57 56q-11 11-17 25t-6 29q0 32 23.5 55t56.5 23q33 0 56.5-23t23.5-55q0-16-6-29.5T537-292l-57-56Z',
};
function icon(name, size, color, fill) {
  const p = D[fill && D[name + '@fill'] ? name + '@fill' : name];
  if (!p) return '';
  return `<svg viewBox="0 -960 960 960" width="${size}" height="${size}" fill="${color || 'currentColor'}" aria-hidden="true" style="flex:none;display:block"><path d="${p}"/></svg>`;
}
/* RN BackGlyph — custom 24-grid stroke path, not the 960 grid */
const BACK_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="${INK2}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>`;
const CHEV_SVG = (color, size) => `<svg viewBox="0 -960 960 960" width="${size}" height="${size}" fill="${color}" aria-hidden="true" style="flex:none;display:block"><path d="M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z"/></svg>`;

/* categoryGlyph — same regex table as Mobile/src/search/CategoryIcon.tsx */
const CAT_MAP = [
  [/metro|subway/, 'metro'], [/train|railway|rail/, 'rail'], [/bus|transit/, 'bus'],
  [/restaurant|cafe|food|eatery|dhaba|bakery|bar|pub/, 'restaurant'],
  [/hospital|clinic|doctor|health|vet/, 'hospital'], [/pharmacy|chemist|medicine/, 'pharmacy'],
  [/mall|shopping/, 'mall'], [/shop|market|store|bazaar|retail/, 'shop'],
  [/school|college|university|education|institute/, 'school'],
  [/airport|airfield|airstrip/, 'airport'], [/mosque|masjid|dargah/, 'mosque'],
  [/church/, 'church'], [/worship|temple|gurudwara|gurdwara|shrine|mandir/, 'temple'],
  [/atm/, 'atm'], [/bank|finance|credit/, 'bank'],
  [/hotel|lodge|guest|resort|hostel|inn|stay/, 'hotel'],
  [/cinema|movie|theater|theatre|multiplex/, 'cinema'],
  [/stadium|arena|sports|playground|ground/, 'stadium'],
  [/fuel|petrol|gas_station|charging/, 'fuel'], [/police|security/, 'police'],
  [/gym|fitness/, 'gym'], [/office|business|cowork/, 'office'],
  [/park|garden|forest|nature/, 'park'], [/museum|gallery/, 'museum'],
  [/landmark|monument|historic|attraction|memorial|fort/, 'monument'],
  [/address|housenumber|housename|residential/, 'home'], [/fire/, 'flame'],
];
const catGlyph = (kind) => {
  const k = String(kind || '').toLowerCase().replace(/_/g, ' ');
  for (const [re, g] of CAT_MAP) if (re.test(k)) return g;
  return 'pin';
};
/* vehicleGlyph — icons.tsx vehicleGlyph map */
const vehicleGlyph = (mode) => {
  const m = String(mode || '').toLowerCase();
  if (/walk/.test(m)) return 'walk';
  if (/cycle|bicycle/.test(m)) return 'cycle';
  if (/e_rickshaw|erick/.test(m)) return 'auto';
  if (/auto|rickshaw/.test(m)) return 'auto';
  if (/two_wheeler|bike|scooter|moto/.test(m)) return 'bike';
  if (/bus/.test(m)) return 'bus';
  if (/metro/.test(m)) return 'metro';
  if (/cab|taxi/.test(m)) return 'cab';
  return 'car';
};

/* ── formatters — verbatim ports ──────────────────────────────────── */
const NORM = (s) => String(s == null ? '' : s).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const WORD = /[a-z0-9]+/g;
/* matchSpans — bold the chars inside words the query touched, dim rest */
function matchSpans(title, q) {
  const toks = (NORM(q).match(WORD) || []).filter((w) => w.length >= 2);
  if (!toks.length) return `<span class="wt-dim">${esc(title)}</span>`;
  const norm = NORM(title);
  let html = '', i = 0;
  for (const m of norm.matchAll(WORD)) {
    if (m.index > i) html += esc(title.slice(i, m.index));
    const word = m[0];
    const hit = toks.some((tk) => word.startsWith(tk) || tk.startsWith(word));
    html += hit
      ? `<b>${esc(title.slice(m.index, m.index + word.length))}</b>`
      : `<span class="wt-dim">${esc(title.slice(m.index, m.index + word.length))}</span>`;
    i = m.index + word.length;
  }
  html += esc(title.slice(i));
  return html;
}
const fmtDist = (d) => d == null ? '' : d < 1 ? `${Math.round(d * 20) * 50} m`
  : d < 10 ? `${d.toFixed(1)} km` : `${Math.round(d)} km`;
const clockLabel = (ts) => {
  const d = new Date(ts + 330 * 60000);
  let h = d.getUTCHours();
  const ap = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  return `${h}:${String(d.getUTCMinutes()).padStart(2, '0')} ${ap}`;
};

/* ── option-card text — verbatim ports from CompareSheet ──────────── */
const TAG_KEY = {
  'lightest on both': 'lightestOnBoth',
  'lightest for you': 'lightestForYou',
  'lightest for delhi': 'lightestForDelhi',
};
const DELTA_WHO = {
  car: 'who_schoolRun', car_open: 'who_schoolRun', bike: 'who_rider',
  auto: 'who_commute', cycle: 'who_rideIn', walk: 'who_walkThere',
  bus: 'who_visitor', 'metro+walk': 'who_visitor',
};
function deltaLine(o, minDose) {
  const dv = o.delta;
  if (!dv) return null;
  const pct = dv.air_pct, ug = dv.air_ug, min = dv.min_added;
  const airPart = pct != null
    ? (Math.abs(pct) <= 5 ? t('delta_sameAir')
      : t('delta_airPct', { p: `${pct > 0 ? '+' : '−'}${Math.abs(Math.round(pct))}` }))
    : ug != null && Math.abs(ug) >= 0.5
      ? `${ug > 0 ? '+' : '−'}${Math.abs(ug).toFixed(1)} µg`
      : null;
  const timePart = min != null
    ? (min > 0.5 ? `+${Math.round(min)} ${t('minUnit')}`
      : min < -0.5 ? t('delta_minQuicker', { m: Math.round(-min) })
      : t('delta_sameTime'))
    : null;
  const parts = [airPart, timePart].filter(Boolean).join(' · ');
  if (dv.basis === 'route') {
    if (!parts) return null;
    const bandClear = (dv.band_drop ?? 0) >= 1;
    const worth = (bandClear && (ug == null || ug <= 0.5)) || (pct != null && pct <= -25);
    if (worth) return { text: `${parts} — ${t('delta_worth', { who: t(DELTA_WHO[o.mode] || 'who_commute') })}`, tone: 'good' };
    if (pct != null && pct > 5 && (min == null || min > -0.5)) return { text: `${parts} — ${t('delta_takeFast')}`, tone: 'warn' };
    if (pct != null && Math.abs(pct) <= 5 && (min == null || min > 0.5)) return { text: `${parts} — ${t('delta_takeFast')}`, tone: 'flat' };
    return { text: parts, tone: pct != null && pct < -5 ? 'good' : 'flat' };
  }
  if (dv.basis === 'default') {
    if (ug == null) return null;
    if (ug <= 0) {
      if (min != null && min > 0.5) return { text: t('delta_defaultCleanSlow', { m: Math.round(min) }), tone: 'good' };
      return { text: t('delta_defaultBoth'), tone: 'good' };
    }
    if (pct == null) return null;
    const p = `${Math.round(pct)}%`;
    if (min != null && min < -0.5) return { text: t('delta_defaultSaves', { p: `+${p}`, m: Math.round(-min) }), tone: 'flat' };
    return { text: t('delta_defaultSlower', { p: `+${p}`, m: Math.max(0, Math.round(min ?? 0)) }), tone: 'flat' };
  }
  if (dv.basis === 'self') {
    return o.dose?.mid != null && minDose < Infinity && o.dose.mid === minDose
      ? { text: t('delta_selfLightest'), tone: 'good' } : null;
  }
  return parts ? { text: parts, tone: 'flat' } : null;
}
/* RN modeLabel: server label + wire suffix (" · least-smoke alt 2") —
   the en surface just carries the label; split qualifier for styling */
const modeLabel = (o) => String(o.label || '').trim() || 'way there';
const isTransit = (o) => /metro|bus/.test(o.mode || '') || !!o.stations;

/* ── vehicle profile — store/vehicle.ts ports ─────────��─��─────────── */
const SERVER_CLASS = { car: 'car', bike: 'bike', auto: 'rickshaw', bus: 'bus', metro: 'metro', cycle: 'cycle', walk: 'pedestrian' };
const SERVER_YEAR = { pre_2010: 'before_2010', y2010_2016: '2010_2016', y2017_2020: '2017_2019', y2021_plus: '2020_plus' };
const YEAR_KEY = { pre_2010: 'yearBefore2010', y2010_2016: 'year2010to2016', y2017_2020: 'vehicle_year2017to2020', y2021_plus: 'vehicle_year2021plus', not_sure: 'yearNotSure' };
const FUEL_KEY = { petrol: 'fuelPetrol', diesel: 'fuelDiesel', cng: 'fuelCNG', ev: 'fuelElectric' };
const needsFuel = (c) => c === 'car' || c === 'bike';
const needsYear = (c) => c === 'car' || c === 'bike' || c === 'auto';
const fuelsFor = (c) => c === 'bike' ? ['petrol', 'ev'] : ['petrol', 'diesel', 'cng', 'ev'];
const CLASS_GROUPS = [
  ['veh_grp_own', ['car', 'auto', 'bike']],
  ['veh_grp_shared', ['bus', 'metro']],
  ['veh_grp_noengine', ['cycle', 'walk']],
];
const CLS_CAP = { car: 'veh_cap_car', auto: 'veh_cap_auto', bike: 'veh_cap_bike', bus: 'veh_cap_bus', metro: 'veh_cap_metro', cycle: 'veh_cap_cycle', walk: 'veh_cap_walk' };
const FUEL_CAP = { petrol: 'veh_cap_petrol', diesel: 'veh_cap_diesel', cng: 'veh_cap_cng', ev: 'veh_cap_ev' };
const YEAR_ORDER = ['pre_2010', 'y2010_2016', 'y2017_2020', 'y2021_plus', 'not_sure'];
const BS_STAGES = [['bs3', 'puc_bs3'], ['bs4', 'puc_bs4'], ['bs6', 'puc_bs6']];
function planVehicle(p) { return p && p.cls ? { cls: SERVER_CLASS[p.cls] } : null; }
function planVehicleProfile(p) {
  if (!p || !p.cls) return null;
  const out = { class: SERVER_CLASS[p.cls] };
  if (p.fuel) out.fuel = p.fuel;
  if (p.year && p.year !== 'not_sure') out.year_bucket = SERVER_YEAR[p.year];
  if (p.puc) out.puc = p.puc;
  return out;
}
function vehicleLabel(p) {
  if (!p || !p.cls) return t('vehicle_likeYours');
  return [
    p.year && p.year !== 'not_sure' ? t(YEAR_KEY[p.year]) : null,
    p.fuel ? t(FUEL_KEY[p.fuel]) : null,
    t('vehicle_' + (p.cls === 'walk' ? 'walk' : p.cls)),
  ].filter(Boolean).join(' ');
}

/* ── store keys ───────────────────────────────────────────────────── */
const K_RECENT = 'whereto.recents', K_SAVED = 'whereto.saved',
  K_VEH = 'whereto.vehicle', K_LAST = 'whereto.last';
const loadJ = (k, fb) => { try { return A.store.get(k, fb); } catch (e) { return fb; } };

/* ── per-mount state ──────────────────────────────────────────────── */
let S = null;

/* ═══════════════ SEARCH SURFACE — SearchScreen.tsx twin ════════════ */
function placeRow(o) {
  /* o: {glyph, gcolor, title, sub, dist, armed, dim, data} → PlaceRow */
  return `<button class="wt-row${o.armed ? ' armed' : ''}${o.dim ? ' dim' : ''}" type="button" data-k="${o.key || ''}">
    <span class="wt-gb">${icon(o.glyph || 'pin', 20, o.gcolor || INK2)}</span>
    <span class="wt-rt">
      <span class="wt-rt-t">${o.titleHtml || esc(o.title)}</span>
      ${o.sub ? `<span class="wt-rt-s">${esc(o.sub)}</span>` : ''}
    </span>
    ${o.dist != null ? `<span class="wt-dist">${fmtDist(o.dist)}</span>` : ''}
  </button>`;
}
function saveStrip() {
  /* SaveStrip — the long-press affordance under a result/saved row.
     armed row: remove pills; other rows: save-as pills. */
  const sf = S.saveFor;
  if (!sf) return '';
  if (sf.slot) {
    return `<div class="wt-save">
      <button class="wt-sbtn wt-sdel" type="button" data-slot="${sf.slot}">
        ${icon('trash', 15, PIN_DEST)}<span>${t(sf.slot === 'home' ? 'removeHome' : 'removeWork')}</span>
      </button></div>`;
  }
  const p = sf.place;
  const isHome = S.saved.home && samePlace(S.saved.home, p);
  const isWork = S.saved.work && samePlace(S.saved.work, p);
  return `<div class="wt-save">
    <button class="wt-sbtn" type="button" data-slot="home" ${isHome ? 'disabled' : ''}>
      ${icon('home', 15, ACCENT)}<span>${t(isHome ? 'savedHome' : 'saveAsHome')}</span>
    </button>
    <button class="wt-sbtn" type="button" data-slot="work" ${isWork ? 'disabled' : ''}>
      ${icon('work', 15, ACCENT)}<span>${t(isWork ? 'savedWork' : 'saveAsWork')}</span>
    </button></div>`;
}
const samePlace = (a, b) => a && b && Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lon - b.lon) < 0.001;
const rowKey = (p) => `${p.name || p.label}|${(p.lat || 0).toFixed(4)}|${(p.lon || 0).toFixed(4)}`;

/* local instant rows — the "t0" paint: saved + recents matching query */
function instantRows() {
  const q = NORM(S.q).trim();
  const out = [];
  const test = (nm) => { const n = NORM(nm); return q.split(/\s+/).every((w) => n.includes(w)); };
  for (const slot of ['home', 'work']) {
    const p = S.saved[slot];
    if (p && test(`${slot} ${p.name}`)) out.push({ ...p, _slot: slot });
  }
  for (const r of S.recents) if (test(r.name)) out.push({ ...r, _recent: true });
  return out.slice(0, 4);
}
const doorRows = () => `
  <div class="wt-sec">${t('exploreHeader')}</div>
  ${placeRow({ key: 'door:stay', glyph: 'hotel', gcolor: ACCENT, title: t('staysTitle'), sub: t('doorStaysSub') })}
  ${placeRow({ key: 'door:play', glyph: 'explore', gcolor: ACCENT, title: t('explorePlayTitle'), sub: t('doorPlaySub') })}`;
const AIR_RE = /\b(air|aqi|pollution|smoke|smog|pm ?2\.?5)\b/i;
const STAY_RE = /\b(stay|stays|hotel|hotels|sleep|lodge|lodge)\b/i;

function searchListHTML() {
  let h = '';
  const typing = S.q.trim().length > 0;
  if (!typing) {
    const saved = ['home', 'work'].filter((s) => S.saved[s]);
    if (saved.length) {
      h += `<div class="wt-sec">${t('sidebarSavedPlaces')}</div>`;
      for (const s of saved) {
        const p = S.saved[s];
        h += placeRow({ key: `saved:${s}`, glyph: s, title: t(s), sub: p.name, armed: S.saveFor && S.saveFor.slot === s });
        if (S.saveFor && S.saveFor.slot === s) h += saveStrip();
      }
    }
    if (S.recents.length) {
      h += `<div class="wt-sec">${t('recents')}</div>`;
      for (const r of S.recents.slice(0, 5)) {
        const k = rowKey(r);
        h += placeRow({ key: `recent:${k}`, glyph: 'clock', title: r.name, sub: r.sub, armed: S.saveFor && S.saveFor.key === `recent:${k}` });
        if (S.saveFor && S.saveFor.key === `recent:${k}`) h += saveStrip();
      }
    }
    h += doorRows();
    if (!S.recents.length && !saved.length) {
      h += `<div class="wt-quiet">${icon('search', 20, INK3)}<span>${t('emptySearchHint')}</span></div>`;
    }
    return h;
  }
  /* typing — air door + results (instant rows, then cascade below a hairline) */
  if (AIR_RE.test(S.q) || STAY_RE.test(S.q)) h += doorRows();
  h += `<div class="wt-sec">${t('resultsHeader')}</div>`;
  const inst = instantRows();
  const instKeys = new Set();
  for (const p of inst) {
    const k = p._slot ? `saved:${p._slot}` : `recent:${rowKey(p)}`;
    instKeys.add(k);
    h += placeRow({ key: k, glyph: p._slot || 'clock', titleHtml: matchSpans(p._slot ? t(p._slot) : p.name, S.q), sub: p._slot ? p.name : p.sub, dist: p.dist, armed: S.saveFor && S.saveFor.key === k });
    if (S.saveFor && S.saveFor.key === k) h += saveStrip();
  }
  h += `<i class="wt-hl"></i>`;
  if (S.pending) h += `<div class="wt-status">${t('searching')}</div>`;
  else if (S.results && S.results.length) {
    for (const r of S.results) {
      const k = rowKey(r);
      h += placeRow({ key: `res:${k}`, glyph: catGlyph(r.kind), titleHtml: matchSpans(r.name, S.q), sub: r.sub, dist: r.dist != null ? r.dist / 1000 : null, armed: S.saveFor && S.saveFor.key === `res:${k}` });
      if (S.saveFor && S.saveFor.key === `res:${k}`) h += saveStrip();
    }
  } else {
    h += `<div class="wt-quiet">${icon('search', 20, INK3)}<span>${t('noPlaceFound')}</span></div>`;
  }
  return h;
}
function renderSearch() {
  const fromTxt = S.from ? S.from.label : t('yourSpot');
  const toTxt = S.to ? S.to.label : t('searchPlaceholder');
  const inCls = S._anim !== 'search' ? ' wt-in' : ''; S._anim = 'search';
  S.body.innerHTML = `<div class="wt${inCls}">
    <div class="wt-rc">
      <button class="wt-rrow${S.armed === 'from' ? ' on' : ''}" type="button" data-arm="from">
        <i class="wt-rdot"></i><span class="wt-rkey">${t('fromLabel')}</span>
        <span class="wt-rval${S.from ? '' : ' ph'}">${esc(fromTxt)}</span>
      </button>
      <i class="wt-rhair"></i>
      <button class="wt-rrow${S.armed === 'to' ? ' on' : ''}" type="button" data-arm="to">
        <i class="wt-rdot to"></i><span class="wt-rkey">${t('fieldTo')}</span>
        <span class="wt-rval${S.to ? '' : ' ph'}">${esc(toTxt)}</span>
      </button>
    </div>
    <div class="wt-bar">
      <button class="wt-bbtn" type="button" data-act="close" aria-label="back">${BACK_SVG}</button>
      <input class="wt-input" type="text" autocapitalize="off" autocomplete="off" spellcheck="false"
        placeholder="${esc(S.armed === 'from' ? t('searchFromPlaceholder') : t('searchPlaceholder'))}" value="${esc(S.q)}">
      <button class="wt-bbtn wt-x" type="button" data-act="clear" aria-label="clear" ${S.q ? '' : 'hidden'}>${icon('close', 16, INK3)}</button>
    </div>
    ${S.notice ? `<div class="wt-notice"><span>${esc(S.notice)}</span></div>` : ''}
    <div class="wt-list">${searchListHTML()}</div>
    <div class="wt-act">
      <button class="wt-abtn" type="button" data-act="locate">${icon('locate', 18, INK2)}<span>${t('yourLocation')}</span></button>
      <i class="wt-asplit"></i>
      <button class="wt-abtn" type="button" data-act="map">${icon('pin', 18, INK2)}<span>${t('chooseOnMap')}</span></button>
    </div>
  </div>`;
  bindSearch();
}
function bindSearch() {
  const root = S.body.querySelector('.wt');
  const input = root.querySelector('.wt-input');
  root.querySelectorAll('.wt-rrow').forEach((b) => b.addEventListener('click', () => {
    S.armed = b.dataset.arm;
    root.querySelectorAll('.wt-rrow').forEach((x) => x.classList.toggle('on', x === b));
    input.placeholder = S.armed === 'from' ? t('searchFromPlaceholder') : t('searchPlaceholder');
    input.focus();
  }));
  root.querySelector('[data-act="close"]').addEventListener('click', () => S.chrome.close());
  const xBtn = root.querySelector('[data-act="clear"]');
  xBtn.addEventListener('click', () => { input.value = ''; onQ(''); input.focus(); });
  input.addEventListener('input', () => { xBtn.hidden = !input.value; onQ(input.value); });
  root.querySelector('[data-act="locate"]').addEventListener('click', locateFill);
  root.querySelector('[data-act="map"]').addEventListener('click', armPinDrop);
  /* rows — click fills the armed slot; press-and-hold opens SaveStrip */
  root.querySelectorAll('.wt-row').forEach((b) => {
    let lp = null, moved = false;
    b.addEventListener('pointerdown', () => {
      moved = false;
      lp = setTimeout(() => { openSave(b.dataset.k); lp = null; }, 360);
    });
    b.addEventListener('pointermove', (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 8) { moved = true; clearTimeout(lp); lp = null; } });
    const cancel = () => { clearTimeout(lp); lp = null; };
    b.addEventListener('pointerup', cancel);
    b.addEventListener('pointercancel', cancel);
    b.addEventListener('click', () => { if (!moved) pickRow(b.dataset.k); moved = false; });
  });
  root.querySelectorAll('.wt-sbtn').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation(); saveSlot(b.dataset.slot);
  }));
}
let qTimer = 0;
function onQ(v) {
  S.q = v;
  clearTimeout(qTimer);
  S.pending = !!v.trim();
  const list = S.body.querySelector('.wt-list');
  if (list) list.innerHTML = searchListHTML(), rebindList();
  if (!v.trim()) return;
  const seq = ++S.seq;
  qTimer = setTimeout(async () => {
    const bias = S.from || (A.geo && A.geo.pos) || A.DELHI;
    const rows = await A.search.search(v, bias);
    if (seq !== S.seq || A.current() !== 'whereto') return;
    S.results = rows || [];
    S.pending = false;
    const l = S.body.querySelector('.wt-list');
    if (l) l.innerHTML = searchListHTML(), rebindList();
  }, 260);
}
function rebindList() {
  const root = S.body.querySelector('.wt');
  root.querySelectorAll('.wt-row').forEach((b) => {
    let lp = null, moved = false;
    b.addEventListener('pointerdown', () => { moved = false; lp = setTimeout(() => { openSave(b.dataset.k); lp = null; }, 360); });
    b.addEventListener('pointermove', (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 8) { moved = true; clearTimeout(lp); lp = null; } });
    const cancel = () => { clearTimeout(lp); lp = null; };
    b.addEventListener('pointerup', cancel); b.addEventListener('pointercancel', cancel);
    b.addEventListener('click', () => { if (!moved) pickRow(b.dataset.k); moved = false; });
  });
  root.querySelectorAll('.wt-sbtn').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation(); saveSlot(b.dataset.slot);
  }));
}
function placeByKey(k) {
  if (k === 'door:stay') return { door: 'purest' };
  if (k === 'door:play') return { door: 'airmap' };
  if (k === 'door:airmap') return { door: 'airmap' };
  if (k && k.startsWith('saved:')) return { saved: k.slice(6) };
  if (k && k.startsWith('recent:')) {
    const kk = k.slice(7);
    return S.recents.find((r) => rowKey(r) === kk) || null;
  }
  if (k && k.startsWith('res:')) {
    const kk = k.slice(4);
    return (S.results || []).find((r) => rowKey(r) === kk) || null;
  }
  return null;
}
function openSave(k) {
  if (!k) return;
  if (k.startsWith('saved:')) S.saveFor = { key: k, slot: k.slice(6) };
  else {
    const p = placeByKey(k);
    if (!p || p.door || p.saved) return;
    S.saveFor = { key: k, place: p };
  }
  const l = S.body.querySelector('.wt-list');
  if (l) l.innerHTML = searchListHTML(), rebindList();
}
function saveSlot(slot) {
  const sf = S.saveFor;
  if (!sf) return;
  if (sf.slot === slot) {           /* remove saved place */
    delete S.saved[slot];
    A.store.set(K_SAVED, S.saved);
    S.saveFor = null;
  } else if (sf.place) {
    S.saved[slot] = { name: sf.place.name, sub: sf.place.sub, lat: sf.place.lat, lon: sf.place.lon };
    A.store.set(K_SAVED, S.saved);
    S.saveFor = null;
  }
  const l = S.body.querySelector('.wt-list');
  if (l) l.innerHTML = searchListHTML(), rebindList();
}
function pickRow(k) {
  const p = placeByKey(k);
  if (!p) return;
  if (p.door) { A.show(p.door); return; }
  if (p.saved != null) {
    const s = S.saved[p.saved];
    if (s) finish({ name: t(p.saved), label: `${t(p.saved)} — ${s.name}`, lat: s.lat, lon: s.lon });
    return;
  }
  finish({ name: p.name, label: p.name, sub: p.sub, lat: p.lat, lon: p.lon });
}
function finish(place) {
  S[S.armed] = { label: place.label || place.name, lat: place.lat, lon: place.lon };
  pushRecent({ name: place.name, sub: place.sub, lat: place.lat, lon: place.lon });
  A.store.set(K_LAST, { from: S.from, to: S.to });
  S.q = ''; S.results = null; S.saveFor = null; S.notice = null;
  /* RN: picking fills the field; if both set → the plan runs */
  if (S.from && S.to) { S.phase = 'plan'; plan(); }
  else { S.armed = S.armed === 'to' ? 'from' : 'to'; renderSearch(); }
}
function pushRecent(p) {
  if (!p || p.name == null || p.lat == null) return;
  S.recents = [p, ...S.recents.filter((r) => !samePlace(r, p))].slice(0, 8);
  A.store.set(K_RECENT, S.recents);
}
async function locateFill() {
  let pos = A.geo && A.geo.pos;
  if (!pos) {
    try { pos = await A.geo.locate(); } catch (e) { pos = null; }
  }
  if (!pos) { S.notice = 'couldn’t get your location — choose on the map instead'; renderSearch(); return; }
  finish({ name: t('yourLocation'), lat: pos.lat, lon: pos.lon });
}
/* armed pin-drop — fold the sheet into a hint strip; one map tap fills it */
function armPinDrop() {
  S.armedPin = S.armed;
  S.el.classList.add('wt-armed');
  const strip = el(`<div class="wt-pinbar">
      ${icon('pin', 16, INK2)}
      <span><b>${t('mapPickHint')}</b><i>${S.armedPin === 'from' ? t('searchFromPlaceholder') : t('searchPlaceholder')}</i></span>
      <button class="wt-pinx" type="button" aria-label="cancel">${icon('close', 14, INK3)}</button>
    </div>`);
  strip.querySelector('.wt-pinx').addEventListener('click', disarmPin);
  S.el.querySelector('.sheet').appendChild(strip);
  const onTap = (e) => {
    if (A.current() !== 'whereto') return;
    const { lat, lon } = e.detail;
    const which = S.armedPin;
    disarmPin();
    finish({ name: 'dropped pin', lat, lon });
    A.search.reverse(lat, lon).then((nm) => {
      if (nm && S && S[which] && S[which].lat === lat) {
        S[which].label = nm;
        if (S.phase === 'search') renderSearch();
        else if (S.phase === 'plan') renderPlan();
      }
    }).catch(() => {});
  };
  S._tapOff = () => document.removeEventListener('alive:maptap', onTap);
  document.addEventListener('alive:maptap', onTap, { once: true });
}
function disarmPin() {
  S.armedPin = null;
  S.el.classList.remove('wt-armed');
  const s = S.el.querySelector('.wt-pinbar');
  if (s) s.remove();
  if (S._tapOff) { S._tapOff(); S._tapOff = null; }
}

/* ═══════════════ OPTIONS SURFACE — CompareSheet twin ═══════════════ */
async function plan() {
  S.planning = true; S.planErr = null; S.plan = null; S.sel = 0; S.detOpen = -1;
  renderPlan();
  const body = {
    from: { lat: S.from.lat, lon: S.from.lon },
    to: { lat: S.to.lat, lon: S.to.lon },
  };
  const veh = planVehicle(S.veh), prof = planVehicleProfile(S.veh);
  if (veh) body.vehicle = veh;
  if (prof) body.vehicle_profile = prof;
  const j = await A.api.post('/v2/plan', body, 45000);
  if (A.current() !== 'whereto' || S.phase !== 'plan') return;
  S.planning = false;
  if (!j) { S.planErr = 'failed'; renderPlan(); return; }
  if (j.error === 'outside') { S.planErr = 'outside'; renderPlan(); return; }
  if (!Array.isArray(j.options) || !j.options.length) { S.planErr = j.error === 'failed' ? 'failed' : 'noroutes'; renderPlan(); return; }
  S.plan = j;
  const ri = j.options.findIndex((o) => o.recommended);
  S.sel = ri >= 0 ? ri : 0;
  S.partial = Array.isArray(j.degraded) && j.degraded.length ? j.degraded : null;
  renderPlan();
  paintRoutes();
}
function minDoseOf(opts) {
  return opts.reduce((m, o) => o.dose && o.dose.mid != null ? Math.min(m, o.dose.mid) : m, Infinity);
}
function lightestOf(opts) {
  let best = null;
  for (const o of opts) if (o.dose && o.dose.mid != null && (!best || o.dose.mid < best.dose.mid)) best = o;
  return best;
}
function optionCard(o, i, minDose, lightest) {
  const d = o.dose;
  const sel = i === S.sel;
  const bandLoR = d && d.lo != null ? Math.round(d.lo) : null;
  const bandHiR = d && d.hi != null ? Math.round(d.hi) : null;
  const band = d && (d.lo != null || d.hi != null) && (d.lo !== d.mid || d.hi !== d.mid)
    ? (d.lo != null && d.hi != null
        ? (bandLoR !== bandHiR ? `${bandLoR}–${bandHiR}` : null)
        : d.lo != null ? `${bandLoR}+` : t('bandUpTo', { n: bandHiR ?? 0 }))
    : null;
  const dCol = d && d.avg_conc_ugm3 != null ? doseColor(d.avg_conc_ugm3) : INK;
  const doseGap = d && d.mid != null && minDose < Infinity && d.mid - minDose >= 0.5 ? Math.round(d.mid - minDose) : null;
  const lightestWord = lightest ? (lightest.label || 'the lightest') : '';
  const felt = doseGap != null && d && d.mid != null
    ? (minDose > 0 && d.mid / minDose >= 2
        ? t('compare_feltMore', { x: (d.mid / minDose).toFixed(1).replace(/\.0$/, ''), m: lightestWord })
        : t('compare_moreVs', { n: doseGap, m: lightestWord }))
    : null;
  const meta = (o.distance_km != null ? `${o.distance_km} ${t('unitsKm')} · ` : '')
    + t('arriveAt', { t: clockLabel(Date.now() + (o.duration_min || 0) * 60000) })
    + (o.stations ? ` · ${esc(o.stations.board)}→${esc(o.stations.alight)}` : '');
  const tag = o.tag ? (T[TAG_KEY[String(o.tag).toLowerCase()]] || o.tag) : null;
  const lbl = modeLabel(o);
  const cut = lbl.lastIndexOf(' · ');
  const lblBase = cut > 0 ? lbl.slice(0, cut) : lbl;
  const lblQual = (cut > 0 ? lbl.slice(cut) : '') + (o.your_vehicle ? ` · ${t('compare_yours')}` : '');
  const dline = deltaLine(o, minDose);
  const via = Array.isArray(o.via_streets) && o.via_streets.length
    ? t('viaStreets', { streets: o.via_streets.slice(0, 2).join(' → ') + (o.via_streets.length > 2 ? '…' : '') })
    : (o.via || null);
  const cov = d && d.coverage != null && d.coverage < 0.999 ? t('plan_coverage_note') : null;
  const frac = d && d.mid != null && o.distance_km ? Math.min(1, d.mid / Math.max(1e-6, worstDose())) : 0;
  const fillCol = frac > 0.66 ? BREATH3 : frac > 0.33 ? BREATH2 : BREATH1;
  const chip = o.safest
    ? `<span class="wt-chip on">${icon('leaf', 11, ACCENT)} ${t('compare_safest')}</span>`
    : tag ? `<span class="wt-chip">${esc(tag)}</span>`
    : o.recommended ? `<span class="wt-chip pl">${t('compare_pick')}</span>` : '';
  const det = S.detOpen === i ? `<span class="wt-det">
      ${band ? `<div class="wt-det-row"><span>dose band</span><b>µg ${band}</b></div>` : ''}
      ${d && d.avg_conc_ugm3 != null ? `<div class="wt-det-row"><span>avg along the way</span><b>${Math.round(d.avg_conc_ugm3)} µg/m³</b></div>` : ''}
      ${d && d.note ? `<div class="wt-det-row"><span>${esc(doseNote(d.note))}</span></div>` : ''}
      ${o.engine && o.engine.note ? `<div class="wt-det-row"><span>${esc(o.engine.note)}</span></div>` : ''}
      ${S.plan && S.plan.field_age_s != null ? `<div class="wt-det-row"><span>air map age</span><b>${Math.max(0, Math.round(S.plan.field_age_s / 60))} min</b></div>` : ''}
    </span>` : '';
  return `<button class="wt-opt${sel ? ' sel' : ''}" type="button" data-i="${i}">
    <span class="wt-selbg"></span>
    <span class="wt-well">${icon(vehicleGlyph(o.mode), 24, sel ? ACCENT : INK2)}</span>
    <span class="wt-omid">
      <span class="wt-oline"><span class="wt-olbl">${esc(lblBase)}</span>${lblQual ? `<span class="wt-oqual">${esc(lblQual)}</span>` : ''}${chip}</span>
      ${dline ? `<span class="wt-delta ${dline.tone}">${esc(dline.text)}</span>` : ''}
      <span class="wt-meta">${meta}</span>
      ${felt ? `<span class="wt-felt">${esc(felt)}</span>` : ''}
      ${o.reason_line ? `<span class="wt-rsn">${esc(reasonTxt(o.reason_line))}</span>` : ''}
      ${via ? `<span class="wt-via">${esc(via)}</span>` : ''}
      ${cov ? `<span class="wt-cov">${esc(cov)}</span>` : ''}
    </span>
    <span class="wt-oright">
      ${d && d.mid != null
        ? `<span class="wt-dose" style="color:${dCol}">≈${doseRound(d.mid)}</span>
           <span class="wt-dsub">µg${band ? ` ${band}` : ''}</span>`
        : `<span class="wt-dna">${t('compare_doseNA')}</span>`}
      <span class="wt-eta">${o.duration_min != null ? `${Math.round(o.duration_min)} ${t('minUnit')}` : ''}</span>
      ${d && d.mid != null ? `<span class="wt-barsrow">${icon('dust', 11, INK3)}<i class="wt-track"><i style="width:${Math.round(frac * 100)}%;background:${fillCol}"></i></i><span class="wt-i" data-info="${i}">${icon('info', 13, INK3)}</span></span>` : ''}
    </span>
    ${det}
  </button>`;
}
const doseRound = (x) => Math.round(x);
function worstDose() {
  const opts = (S.plan && S.plan.options) || [];
  return opts.reduce((m, o) => o.dose && o.dose.mid != null ? Math.max(m, o.dose.mid) : m, 0);
}
const DOSE_NOTE = {
  'dose engine unavailable': 'doseNote_engineDown',
  'dose engine error': 'doseNote_engineError',
  'field unavailable': 'doseNote_fieldDown',
};
const DOSE_NOTE_TXT = {
  doseNote_engineDown: 'smoke estimate unavailable',
  doseNote_engineError: 'smoke estimate error',
  doseNote_fieldDown: 'air map unavailable',
};
const doseNote = (n) => DOSE_NOTE_TXT[DOSE_NOTE[n]] || n;
const REASON_KEY = {
  'Least smoke for you — no emissions estimate for this set.': 'reason_noEmis',
  'Least smoke for you and lowest emissions — the easy pick.': 'reason_easyPick',
  'Least smoke for you, but heavier for Delhi.': 'reason_heavierDelhi',
  "Lowest emissions of the options — but you'd breathe more.": 'reason_lowestEmis',
  'Within ~10% of the lightest dose and the lightest exhaust of those — a fair trade.': 'reason_fairTrade',
};
const REASON_TXT = {
  reason_noEmis: 'Least smoke for you — no emissions estimate for this set.',
  reason_easyPick: 'Least smoke for you and lowest emissions — the easy pick.',
  reason_heavierDelhi: 'Least smoke for you, but heavier for Delhi.',
  reason_lowestEmis: 'Lowest emissions of the options — but you\'d breathe more.',
  reason_fairTrade: 'Within ~10% of the lightest dose and the lightest exhaust of those — a fair trade.',
};
function reasonTxt(n) {
  const m = String(n).match(/ \+(\d+) min vs fastest\.$/);
  const base = m ? n.slice(0, -m[0].length) : n;
  const out = REASON_TXT[REASON_KEY[base]] || base;
  return m ? out + ` ${m[1]} min slower than the fastest.` : out;
}
function renderPlan() {
  let mid = '';
  if (S.planning) {
    mid = `<div class="wt-state">${icon('dust', 30, INK3)}<span class="wt-st-t">${t('checkingRoutes')}</span></div>`;
  } else if (S.planErr) {
    const title = S.planErr === 'outside' ? t('plan_outside_title') : S.planErr === 'noroutes' ? t('noRoutes') : t('plan_failed');
    const body = S.planErr === 'outside' ? t('plan_outside_body') : '';
    const cta = S.planErr === 'outside' ? t('plan_outside_cta') : t('plan_retry');
    mid = `<div class="wt-state">${icon('warn', 52, INK4)}<span class="wt-st-t">${esc(title)}</span>
      ${body ? `<span class="wt-st-s">${esc(body)}</span>` : ''}
      <button class="wt-retry" type="button" data-act="retry">${esc(cta)}</button></div>`;
  } else if (S.plan) {
    const opts = S.plan.options;
    const minDose = minDoseOf(opts);
    const lightest = lightestOf(opts);
    const anyDose = opts.some((o) => o.dose && o.dose.mid != null);
    mid = `<div class="wt-list">
      ${anyDose ? `<div class="wt-legend">${icon('dust', 13, INK3)}<span>${t('compare_smokeIn')}</span></div>` : ''}
      ${S.partial ? `<div class="wt-notice"><span>a few routes timed out — showing what we have</span></div>` : ''}
      ${opts.map((o, i) => optionCard(o, i, minDose, lightest)).join('')}
    </div>`;
  }
  const veh = S.veh;
  const chipTxt = veh ? vehicleLabel(veh) + (veh.puc ? ` · ${t('puc_badge')}` : '') : t('vehicle_likeYours');
  const inCls2 = S._anim !== 'plan' ? ' wt-in' : ''; S._anim = 'plan';
  S.body.innerHTML = `<div class="wt${inCls2}">
    <div class="wt-trip">
      <button class="wt-th" type="button" data-arm="from"><i class="wt-tdot"></i><span class="wt-tt">${esc(S.from ? S.from.label : '—')}</span></button>
      <span class="wt-tarr">→</span>
      <button class="wt-th" type="button" data-arm="to"><i class="wt-tdot to"></i><span class="wt-tt">${esc(S.to ? S.to.label : '—')}</span></button>
    </div>
    ${mid}
    <div class="wt-vrow"><button class="wt-vchip" type="button" data-act="veh">
      ${icon(vehicleGlyph(veh && veh.cls), 15, INK2)}<span>${esc(chipTxt)}</span>${CHEV_SVG(INK3, 11)}
    </button></div>
    <div class="wt-foot"><button class="wt-go" type="button" data-act="go" ${S.plan ? '' : 'disabled'}>${t('startJourney')}</button></div>
  </div>`;
  const root = S.body.querySelector('.wt');
  root.querySelectorAll('.wt-th').forEach((b) => b.addEventListener('click', () => {
    S.armed = b.dataset.arm; S.phase = 'search'; S.q = ''; S.results = null; renderSearch();
  }));
  const retry = root.querySelector('[data-act="retry"]');
  if (retry) retry.addEventListener('click', () => { S.planErr = null; plan(); });
  root.querySelectorAll('.wt-opt').forEach((b) => b.addEventListener('click', (e) => {
    const info = e.target.closest('[data-info]');
    if (info) { S.detOpen = S.detOpen === +info.dataset.info ? -1 : +info.dataset.info; renderPlan(); return; }
    S.sel = +b.dataset.i;
    root.querySelectorAll('.wt-opt').forEach((x) => x.classList.toggle('sel', x === b));
    paintRoutes();
  }));
  const vehBtn = root.querySelector('[data-act="veh"]');
  if (vehBtn) vehBtn.addEventListener('click', openVehicle);
  const go = root.querySelector('[data-act="go"]');
  if (go) go.addEventListener('click', () => {
    if (!S.plan) return;
    const o = S.plan.options[S.sel];
    if (A.screensReady && A.screensReady.journey) {
      A.show('journey', { option: o, from: S.from, to: S.to });
    } else {
      A.toast('journey is still landing');
    }
  });
}

/* flat paint — RouteTint law: picked forest on a paper casing,
   alternatives a quiet 3px hairline, never a band strip */
function paintRoutes() {
  if (!S.plan || !A.map) return;
  const opts = S.plan.options;
  opts.forEach((o, i) => {
    const g = o.geometry || o.route_geojson;
    if (!g) return;
    const picked = i === S.sel;
    A.map.showRoute(`wt${i}`, g, o.segments);
    A.map.ready((m) => {
      const line = `route-wt${i}-line`, seg = `route-wt${i}-segs-line`, cas = `route-wt${i}-casing`;
      if (m.getLayer(line)) {
        m.setPaintProperty(line, 'line-color', picked ? ACCENT : MAP_QUIET);
        m.setPaintProperty(line, 'line-opacity', picked ? 1 : 0.5);
        m.setPaintProperty(line, 'line-width', ['interpolate', ['linear'], ['zoom'], 9, picked ? 3 : 1.8, 14, picked ? 6 : 3]);
      }
      if (m.getLayer(cas)) {
        m.setPaintProperty(cas, 'line-color', picked ? PAPER : MAP_QUIET);
        m.setPaintProperty(cas, 'line-opacity', picked ? 1 : 0);
        m.setPaintProperty(cas, 'line-width', ['interpolate', ['linear'], ['zoom'], 9, picked ? 5 : 2.5, 14, picked ? 9 : 4]);
      }
      /* RouteTint flat law — no band strips on the map at all */
      if (m.getLayer(seg)) m.setPaintProperty(seg, 'line-opacity', 0);
    });
  });
  for (let i = opts.length; i < (S.painted || 0); i++) A.map.hideRoute(`wt${i}`);
  S.painted = opts.length;
  const g = opts[S.sel] && (opts[S.sel].geometry || opts[S.sel].route_geojson);
  if (g) A.map.fit(g, { top: 70, left: 24, right: 24, bottom: 340 });
}

/* ═══════════════ VEHICLE SURFACE — VehicleSheet.tsx twin ═══════════ */
function openVehicle() {
  S.phase = 'veh';
  S.wiz = { step: S.veh ? 'cls' : 'intro', cls: S.veh ? S.veh.cls : null, fuel: S.veh ? S.veh.fuel : null, year: S.veh ? S.veh.year : null, bs: S.veh && S.veh.puc ? S.veh.puc.bs : null, puc: S.veh && S.veh.puc ? { ...S.veh.puc } : {} };
  renderVehicle();
}
const wizSteps = () => {
  const s = ['cls'];
  if (needsFuel(S.wiz.cls)) s.push('fuel');
  if (needsYear(S.wiz.cls)) s.push('year', 'puc');
  return s;
};
const stepQ = { cls: 'vehicleQ1', fuel: 'vehicleQ2', year: 'vehicleQ3', puc: 'puc_title' };
function renderVehicle() {
  const w = S.wiz;
  let inner = '';
  if (w.step === 'intro') {
    inner = `<div class="wt-vhead"><span class="wt-vq">${t('veh_introTitle')}</span></div>
      <div class="wt-list">
        <p class="wt-vbody">${t('veh_introBody')}</p>
        <p class="wt-vhonest">${t('veh_introHonest')}</p>
        <button class="wt-vstart" type="button" data-act="start">${t('veh_start')}</button>
      </div>
      <div class="wt-vfoot"><span></span><button class="wt-vfb" type="button" data-act="skip">${t('vehicleQ_skip')}</button></div>`;
  } else if (w.step === 'done') {
    const lbl = vehicleLabel({ cls: w.cls, fuel: w.fuel, year: w.year });
    inner = `<div class="wt-vdone"><span class="wt-vdt">${t('vehicleDone')}</span>
      <span class="wt-vds">${esc(lbl)}${w.puc && (w.puc.bs || w.puc.co_pct || w.puc.hc_ppm || w.puc.smoke_pct) ? ` · ${t('puc_badge')}` : ''}</span></div>`;
  } else {
    const steps = wizSteps();
    const idx = Math.max(0, steps.indexOf(w.step));
    let cards = '';
    if (w.step === 'cls') {
      cards = CLASS_GROUPS.map(([gk, items]) => `
        <div class="wt-vgrp">${t(gk)}</div>
        <div class="wt-vgrid">${items.map((c) => `
          <button class="wt-vcard${w.cls === c ? ' on' : ''}" type="button" data-k="${c}">
            <span class="wt-vg">${icon(vehicleGlyph(c), 24, w.cls === c ? ACCENT : INK2)}</span>
            <span class="wt-vcard-mid"><span class="wt-vt">${t('vehicle_' + c)}</span><span class="wt-vcap">${t(CLS_CAP[c])}</span></span>
            <span class="wt-radio"><i></i></span>
          </button>`).join('')}</div>`).join('');
    } else if (w.step === 'fuel') {
      cards = `<div class="wt-vgrid">${fuelsFor(w.cls).map((f) => `
        <button class="wt-vcard${w.fuel === f ? ' on' : ''}" type="button" data-k="${f}">
          <span class="wt-vcard-mid"><span class="wt-vt">${t(FUEL_KEY[f])}</span><span class="wt-vcap">${t(FUEL_CAP[f])}</span></span>
          <span class="wt-radio"><i></i></span>
        </button>`).join('')}</div>`;
    } else if (w.step === 'year') {
      cards = YEAR_ORDER.map((y) => `
        <button class="wt-vcard wt-vrow${w.year === y ? ' on' : ''}" type="button" data-k="${y}">
          <span class="wt-vcard-mid"><span class="wt-vt">${t(YEAR_KEY[y])}</span>${y === 'not_sure' ? `<span class="wt-vcap">${t('veh_cap_y_notsure')}</span>` : ''}</span>
          <span class="wt-radio"><i></i></span>
        </button>`).join('');
    } else if (w.step === 'puc') {
      const fields = (w.fuel === 'diesel')
        ? [['smoke_pct', 'puc_smoke', 'puc_smokeHint']]
        : [['co_pct', 'puc_co', 'puc_coHint'], ['hc_ppm', 'puc_hc', 'puc_hcHint']];
      cards = `<div class="wt-vgrp">${t('puc_bsQ')}</div>
        <div class="wt-vgrid">${BS_STAGES.map(([bs, k]) => `
          <button class="wt-vcard${w.bs === bs ? ' on' : ''}" type="button" data-bs="${bs}">
            <span class="wt-vcard-mid"><span class="wt-vt">${t(k)}</span></span>
            <span class="wt-radio"><i></i></span>
          </button>`).join('')}</div>
        <div class="wt-vfields">${fields.map(([f, lk, hk]) => `
          <div class="wt-vfield">
            <span class="wt-vfl">${t(lk)}</span>
            <input class="wt-vin" type="text" inputmode="decimal" maxlength="6" data-f="${f}" value="${w.puc[f] != null ? esc(w.puc[f]) : ''}">
            <span class="wt-vfh">${t(hk)}</span>
          </div>`).join('')}</div>`;
    }
    inner = `<div class="wt-vhead">
        <span class="wt-vq">${t(stepQ[w.step])}</span>
        <span class="wt-dots">${steps.map((s, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</span>
      </div>
      <p class="wt-vwhy">${w.step === 'puc' ? t('puc_helper') : (S.veh && w.step === 'cls' ? `${t('veh_now', { v: vehicleLabel(S.veh) })} — ${t('veh_why')}` : t('veh_why'))}</p>
      <div class="wt-list">${cards}</div>
      <div class="wt-vfoot">
        <button class="wt-vfb" type="button" data-act="back">${t('vehicleQ_back')}</button>
        <span class="wt-vfr">
          ${w.step === 'puc' ? `<button class="wt-vfb wt-vsave" type="button" data-act="save">${t('receipt_save')}</button>` : ''}
          <button class="wt-vfb" type="button" data-act="skip">${t('vehicleQ_skip')}</button>
        </span>
      </div>`;
  }
  const inCls3 = S._anim !== 'veh' ? ' wt-in' : ''; S._anim = 'veh';
  S.body.innerHTML = `<div class="wt${inCls3}">${inner}</div>`;
  bindVehicle();
}
function bindVehicle() {
  const root = S.body.querySelector('.wt'), w = S.wiz;
  const q = (s) => root.querySelector(s);
  const stepIdx = () => wizSteps().indexOf(w.step);
  const goStep = (s) => { w.step = s; renderVehicle(); };
  const prevStep = () => {
    const steps = wizSteps(), i = steps.indexOf(w.step);
    if (i > 0) goStep(steps[i - 1]);
    else if (S.veh) { S.phase = 'plan'; renderPlan(); }
    else goStep('intro');
  };
  const finish = (savePuc) => {
    const p = { cls: w.cls, fuel: needsFuel(w.cls) ? w.fuel : null, year: needsYear(w.cls) ? w.year : null };
    if (savePuc && (w.bs || Object.keys(w.puc).length)) {
      const puc = {};
      if (w.bs) puc.bs = w.bs;
      for (const f of ['co_pct', 'hc_ppm', 'smoke_pct']) {
        const v = parseFloat(w.puc[f]);
        if (!isNaN(v)) puc[f] = v;
      }
      if (Object.keys(puc).length) p.puc = puc;
    } else if (!savePuc && S.veh && S.veh.puc) p.puc = S.veh.puc;
    S.veh = p;
    A.store.set(K_VEH, p);
    w.step = 'done';
    renderVehicle();
    setTimeout(() => { if (A.current() === 'whereto') { S.phase = 'plan'; if (S.from && S.to) plan(); else renderPlan(); } }, 1000);
  };
  if (q('[data-act="start"]')) q('[data-act="start"]').addEventListener('click', () => goStep('cls'));
  root.querySelectorAll('[data-act="skip"]').forEach((b) => b.addEventListener('click', () => {
    if (w.step === 'puc') finish(false);
    else { S.phase = 'plan'; if (S.plan || (S.from && S.to)) renderPlan(), plan(); else { S.phase = 'search'; renderSearch(); } }
  }));
  if (q('[data-act="back"]')) q('[data-act="back"]').addEventListener('click', prevStep);
  if (q('[data-act="save"]')) q('[data-act="save"]').addEventListener('click', () => finish(true));
  root.querySelectorAll('.wt-vcard').forEach((b) => b.addEventListener('click', () => {
    const steps = wizSteps();
    if (b.dataset.bs) { w.bs = w.bs === b.dataset.bs ? null : b.dataset.bs; renderVehicle(); return; }
    const k = b.dataset.k;
    if (w.step === 'cls') {
      w.cls = k;
      if (!needsFuel(k)) w.fuel = null;
      if (!needsYear(k)) { w.year = null; w.puc = {}; w.bs = null; }
      const next = wizSteps()[1];
      if (next) goStep(next); else finish(false);
      return;
    }
    if (w.step === 'fuel') { w.fuel = k; goStep('year'); return; }
    if (w.step === 'year') { w.year = k; goStep('puc'); return; }
  }));
  root.querySelectorAll('.wt-vin').forEach((inp) => inp.addEventListener('input', () => {
    S.wiz.puc[inp.dataset.f] = inp.value;
  }));
}

/* ═══════════════ mount ═══════════════════════════════════════════ */
A.screen('whereto', {
  mount(elm, params) {
    const chrome = A.sheetChrome(elm, 'where to');
    /* RN SearchScreen carries no title row — the back chevron lives in
       the search pill. Keep the grab (shared sheet affordance), drop
       the chrome title. */
    const title = chrome.sheetEl.querySelector('.sheet-title');
    if (title) title.remove();
    S = {
      el: elm, chrome, body: chrome.body,
      phase: 'search', armed: 'to', armedPin: null,
      from: null, to: null, q: '', results: null, pending: false, seq: 0,
      saveFor: null, notice: null,
      saved: loadJ(K_SAVED, {}),
      recents: loadJ(K_RECENT, []).map((r) => ({ name: r.name || r.label, sub: r.sub, lat: r.lat, lon: r.lon })).filter((r) => r.name != null),
      veh: loadJ(K_VEH, null),
      plan: null, planning: false, planErr: null, sel: 0, detOpen: -1, painted: 0, partial: null,
      wiz: null, _tapOff: null, _anim: null,
    };
    const last = loadJ(K_LAST, null);
    if (last) {
      if (last.from) S.from = last.from;
      if (last.to) S.to = last.to;
    }
    if (params) {
      if (params.from) S.from = params.from;
      if (params.to) S.to = params.to;
      if (params.arm) S.armed = params.arm;
    }
    if (!S.from && A.geo && A.geo.pos) S.from = { label: t('yourLocation'), lat: A.geo.pos.lat, lon: A.geo.pos.lon };
    S.armed = S.to ? 'from' : (S.from ? 'to' : 'from');
    if (S.from && S.to) { S.phase = 'plan'; plan(); }
    else renderSearch();
    A.map.setFieldVisible(false);
    return () => {
      disarmPin();
      clearTimeout(qTimer);
      document.querySelectorAll('.wt-pinbar').forEach((x) => x.remove());
      A.map.hideAllRoutes();
      S = null;
    };
  },
  show() { if (S && S.plan) paintRoutes(); },
});
})();
