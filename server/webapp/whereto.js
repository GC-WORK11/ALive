/* Alive webapp — where to. ONE Google-Maps-like surface:
     search  — From + To rows (they ARE the inputs) over one results list
               (A.search.live progressive rows when present, else the
               A.search.search cascade). No air / stay / play rows here.
     modes   — Health Maxer · Petrol + Health · Time + Health, chosen
               BEFORE routing (remembered in whereto.mode)
     vehicle — the VehicleSheet wizard (trip ctx: one tap on a saved ride)
     routes  — POST /v2/plan {mode}; simple cards (time, air, traffic,
               petrol, one short why), route lines + live jams on the map,
               Start → A.show('journey', {option, from, to, mode, vehicle}). */
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
  fromLabel: 'From', fieldTo: 'To', yourSpot: 'your spot…',
  searchPlaceholder: 'Where to?', searchFromPlaceholder: 'Where from?',
  yourLocation: 'Your location', chooseOnMap: 'Choose on map',
  mapPickHint: 'tap the map to drop a pin there',
  sidebarSavedPlaces: 'Saved places', recents: 'Recent',
  searching: 'Searching…', noPlaceFound: 'no place found — try a landmark, or choose on the map',
  noExact: 'No exact match — closest places',
  slowSearch: 'this is taking long — try a shorter name, or choose on the map',
  keepTyping: 'keep typing — a place, a landmark or an address',
  emptySearchHint: 'type a place or landmark — or choose on the map',
  home: 'Home', work: 'Work',
  saveAsHome: 'Save as Home', saveAsWork: 'Save as Work',
  savedHome: 'Home saved', savedWork: 'Work saved',
  removeHome: 'Remove Home', removeWork: 'Remove Work',
  modesQ: 'How do you want to go?',
  checkingRoutes: 'finding the cleanest ways there…',
  noRoutes: 'no route found between those two places',
  plan_failed: "couldn't load the ways there — check the connection",
  plan_retry: 'try again',
  plan_outside_title: 'this trip sits outside Delhi NCR',
  plan_outside_body: 'Alive only measures the air inside Delhi NCR, so this trip can’t be counted honestly.',
  plan_outside_cta: 'change the trip',
  locating: 'finding your spot…',
  locFail: 'couldn’t get your location — pick a place, or tap the map',
  recommendedTag: 'recommended', walkBit: '{d} walk',
  compare_doseNA: 'no air estimate', compare_fuelNA: 'fuel not known',
  breathed: 'breathed', traffic: 'traffic', otherWays: 'other ways to go',
  startJourney: 'Start', arriveAt: 'arrive {t}',
  unitsKm: 'km', minUnit: 'min',
  viaStreets: 'via {streets}',
  vehicleQ1: 'What are you taking?', vehicleQ2: 'Fuel?',
  vehicleQ3: 'Roughly when was it bought?',
  vehicleQ_back: 'back', vehicleQ_skip: 'skip — a typical Delhi ride', puc_skip: 'skip',
  vehicle_likeYours: 'a typical Delhi ride',
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
  shop: 'M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-560ZM240-160v-480 480Z',
  restaurant: 'M280-600v-240q0-17 11.5-28.5T320-880q17 0 28.5 11.5T360-840v240h40v-240q0-17 11.5-28.5T440-880q17 0 28.5 11.5T480-840v240q0 56-34.5 98T360-446v326q0 17-11.5 28.5T320-80q-17 0-28.5-11.5T280-120v-326q-51-14-85.5-56T160-600v-240q0-17 11.5-28.5T200-880q17 0 28.5 11.5T240-840v240h40Zm400 200h-80q-17 0-28.5-11.5T560-440v-240q0-70 51.5-135T718-880q18 0 30 14t12 33v713q0 17-11.5 28.5T720-80q-17 0-28.5-11.5T680-120v-280Z',
  city: 'M120-200v-400q0-33 23.5-56.5T200-680h160v-47q0-16 6-30.5t17-25.5l40-40q23-23 57-23t57 23l40 40q11 11 17 25.5t6 30.5v207h160q33 0 56.5 23.5T840-440v240q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200Zm80 0h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm240 320h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm240 480h80v-80h-80v80Zm0-160h80v-80h-80v80Z',
  mall: 'M200-80q-33 0-56.5-23.5T120-160v-480q0-33 23.5-56.5T200-720h80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720h80q33 0 56.5 23.5T840-640v480q0 33-23.5 56.5T760-80H200Zm0-80h560v-480H200v480Zm160-560h240q0-50-35-85t-85-35q-50 0-85 35t-35 85ZM200-160v-480 480Zm279-240q74 0 134-49t59-110q0-17-11-29t-28-12q-14 0-25 9t-16 27q-11 38-43 61t-70 23q-38 0-70.5-23T366-564q-5-19-15-27.5t-24-8.5q-17 0-28.5 12T287-559q0 61 59 110t133 49Z',
  school: 'M242-249q-20-11-31-29.5T200-320v-192l-96-53q-11-6-16-15t-5-20q0-11 5-20t16-15l338-184q9-5 18.5-7.5T480-829q10 0 19.5 2.5T518-819l381 208q10 5 15.5 14.5T920-576v256q0 17-11.5 28.5T880-280q-17 0-28.5-11.5T840-320v-236l-80 44v192q0 23-11 41.5T718-249L518-141q-9 5-18.5 7.5T480-131q-10 0-19.5-2.5T442-141L242-249Zm238-203 274-148-274-148-274 148 274 148Zm0 241 200-108v-151l-161 89q-9 5-19 7.5t-20 2.5q-10 0-20-2.5t-19-7.5l-161-89v151l200 108Zm0-241Zm0 121Zm0 0Z',
  airport: 'M480-120 377-91q-14 4-25.5-4.5T340-118q0-12 3-19.5t8-11.5l69-51v-220l-291 86q-19 5-34-6t-15-31q0-15 5-25t14-15l321-189v-220q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v220l321 189q9 5 14 15t5 25q0 20-15 31t-34 6l-291-86v220l69 51q5 4 8 11.5t3 19.5q0 14-11.5 22.5T583-91l-103-29Z',
  temple: 'M80-160v-320q0-17 11.5-28.5T120-520q17 0 28.5 11.5T160-480v40h80l119-395v-45q0-17 11.5-28.5T399-920q17 0 28.5 11.5T439-880v40h81v-40q0-17 11.5-28.5T560-920q17 0 28.5 11.5T600-880v40l120 400h80v-40q0-17 11.5-28.5T840-520q17 0 28.5 11.5T880-480v320q0 33-23.5 56.5T800-80H560q-17 0-28.5-11.5T520-120v-160h-80v160q0 17-11.5 28.5T400-80H160q-33 0-56.5-23.5T80-160Zm268-360h264l-24-80H372l-24 80Zm48-160h168l-24-80H420l-24 80ZM160-160h200v-120q0-33 23.5-56.5T440-360h80q33 0 56.5 23.5T600-280v120h200v-200h-80q-26 0-47.5-15.5T643-417l-7-23H324l-7 23q-8 26-29.5 41.5T240-360h-80v200Zm320-280Z',
  mosque: 'M40-200v-411q-18-11-29-28.5T0-680q0-23 24-56t56-64q32 31 56 64t24 56q0 23-11 40.5T120-611v171h80v-80q0-25 16-48t46-30q-11-17-16.5-37t-5.5-41q0-40 19-74t51-56l125-84q20-14 45-14t45 14l125 84q32 22 51 56t19 74q0 21-5.5 41T698-598q30 7 46 30t16 48v80h80v-171q-18-11-29-28.5T800-680q0-23 24-56t56-64q32 31 56 64t24 56q0 23-11 40.5T920-611v411q0 33-23.5 56.5T840-120H560q-17 0-28.5-11.5T520-160v-120q0-17-11.5-28.5T480-320q-17 0-28.5 11.5T440-280v120q0 17-11.5 28.5T400-120H120q-33 0-56.5-23.5T40-200Zm356-400h168q32 0 54-22t22-54q0-20-9-36.5T606-740l-126-84-126 84q-16 11-25 27.5t-9 36.5q0 32 22 54t54 22ZM120-200h240v-80q0-50 35-85t85-35q50 0 85 35t35 85v80h240v-160h-80q-33 0-56.5-23.5T680-440v-80H280v80q0 33-23.5 56.5T200-360h-80v160Zm360-320Zm0-80Zm0 2Z',
  church: 'M80-160v-188q0-24 13-43.5t35-29.5l112-50v-80q0-23 12-41.5t32-29.5l156-78v-60h-40q-17 0-28.5-11.5T360-800q0-17 11.5-28.5T400-840h40v-40q0-17 11.5-28.5T480-920q17 0 28.5 11.5T520-880v40h40q17 0 28.5 11.5T600-800q0 17-11.5 28.5T560-760h-40v60l156 78q20 11 32 29.5t12 41.5v80l112 50q22 10 35 29.5t13 43.5v188q0 33-23.5 56.5T800-80H560q-17 0-28.5-11.5T520-120v-120q0-17-11.5-28.5T480-280q-17 0-28.5 11.5T440-240v120q0 17-11.5 28.5T400-120H160q-33 0-56.5-23.5T80-160Zm80 0h200v-82q0-51 35-86.5t85-35.5q50 0 85 35.5t35 86.5v82h200v-192l-160-72v-134l-160-82-160 82v134l-160 72v192Zm320-260q25 0 42.5-17.5T540-480q0-25-17.5-42.5T480-540q-25 0-42.5 17.5T420-480q0 25 17.5 42.5T480-420Z',
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
  route: 'M360-120q-66 0-113-47t-47-113v-327q-35-13-57.5-43.5T120-720q0-50 35-85t85-35q50 0 85 35t35 85q0 39-22.5 69.5T280-607v327q0 33 23.5 56.5T360-200q33 0 56.5-23.5T440-280v-400q0-66 47-113t113-47q66 0 113 47t47 113v327q35 13 57.5 43.5T840-240q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-39 22.5-70t57.5-43v-327q0-33-23.5-56.5T600-760q-33 0-56.5 23.5T520-680v400q0 66-47 113t-113 47ZM240-680q17 0 28.5-11.5T280-720q0-17-11.5-28.5T240-760q-17 0-28.5 11.5T200-720q0 17 11.5 28.5T240-680Zm480 480q17 0 28.5-11.5T760-240q0-17-11.5-28.5T720-280q-17 0-28.5 11.5T680-240q0 17 11.5 28.5T720-200ZM240-720Zm480 480Z',
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

/* categoryGlyph — Mobile/src/search/CategoryIcon.tsx table, widened for
   web kind vocabulary (delhi-gazetteer 'c' values + OSM tag values).
   First match wins — specific kinds before family catch-alls; the bare
   station/road/locality rules sit last so 'police station', 'service
   road', 'district court' still read as what they are, not their suffix. */
const CAT_MAP = [
  [/metro|subway|rapid transit/, 'metro'], [/train|railway|rail/, 'rail'],
  [/bus|transit|\bstops?\b/, 'bus'],
  [/restaurant|cafe|food|eatery|dhaba|bakery|bake\b|\bbar\b|\bpub\b|canteen|kitchen|confection|sweets?\b|mithai|halwai|ice ?cream|biryani|kebab|tandoor|chaat|pizza|burger|sandwich|dosa|idli|momos?\b|juice|beverage|\bchai\b|coffee|snacks?\b|\btea\b|meals?\b|dining|diner\b|pastry|lounge\b/, 'restaurant'],
  [/pharmacy|chemist|medical store|drugs?\b|medicine (shop|store)/, 'pharmacy'],
  [/school|college|university|education|institute|kindergarten|playschool|pre ?school|elementary|academy|coaching|tuition|tutor|campus|day ?care|child ?care|creche|learning|montessori|training/, 'school'],
  [/hospital|clinic|doctor|dentist|dental|health|veterin|vets?\b|\bcare\b|medical|medicine|surgery|surgical|dispensary|nursing|diagnostic|labs?\b|laborator|patholog|blood bank|physio|therap|rehab|wellness|hospice|pediatric|ortho|eye\b|vision|ayurved|homeopath|mental|psych|ambulance|maternity|fertility|dialysis/, 'hospital'],
  [/mall|shopping/, 'mall'],
  [/shop|market|\bmarts?\b|store|bazaar|mandi\b|retail|outlet|showroom|dealer|distributor|wholesale|grocery|kirana|provisions|general store|convenience|jewel|gold\b|shoes?\b|footwear|clothes?\b|clothing|fashion|apparel|cosmetic|optician|optical|tailor|embroidery|hairdresser|barber|salon|parlour|parlor|beauty|spa\b|florist|flowers?\b|gift\b|toys?\b|stationery|furniture|furnishing|decor|interior|appliance|laundry|dry clean|liquor|wine|alcohol|mobile\b|computer\b|electronics|paint\b|hardware|dairy|meat\b|butcher|chicken\b|mutton|fish\b|books?\b|bags?\b|emporium|boutique|studio|workshop|repair|arcade\b|plaza|pet\b|animal|greengrocer|houseware|tobacco|fabric|electrical|watches?\b/, 'shop'],
  [/airport|airfield|airstrip/, 'airport'],
  [/mosque|masjid|dargah|muslim|islamic|\bimam\b|namaaz|eidgah/, 'mosque'],
  [/church|chapel|cathedral|christian|catholic|protestant|evangel/, 'church'],
  [/worship|temple|gurudwara|gurdwara|shrine|mandir|synagogue|buddhist|jain|ashram|monastery|religious|\bsikh\b|pilgrim|spiritual/, 'temple'],
  [/\batms?\b/, 'atm'], [/bank|financ|credit|nbfc|insurance/, 'bank'],
  [/gov|court\b|courthouse|embassy|diplomatic|consulate|municipal|parliament|ministry|political|town hall|secretariat|bhavan\b|judicial|tribunal/, 'bank'],
  [/hotel|lodge|lodging|guest|resort|hostel|\binns?\b|stay|motel|dharamshala|sarai|bed and breakfast|paying guest|\bpg\b|accommodation|villa\b|cottages?\b/, 'hotel'],
  [/cinema|movie|theater|theatre|multiplex/, 'cinema'],
  [/stadium|arena|sports?\b|playground|\bground\b|pitch|venue|banquet|auditorium|convention|exhibition|\bfair\b/, 'stadium'],
  [/fuel|petrol|gas station|gas_station|cng|diesel\b|charging|petrol pump|\bgas\b/, 'fuel'],
  [/police|security|thana\b/, 'police'],
  [/gym|fitness|yoga|boxing|martial|swimming|athletic|workout|akhada|akhara/, 'gym'],
  [/office|business|cowork|company|firm\b|agency|consult|attorney|law\b|legal|advocate|solicitor|lawyer|property|real estate|estate agent|builder\b|developer\b|construction|trading|enterprise|corporation|corporate|association|organization|organis|federation|professional|printing|travels?\b|tours?\b|courier|cargo|logistics|packers?|movers?|architect|accountant|auditor|chartered|community|post office|ngo\b|\w+ services?\b/, 'office'],
  [/\bparks?\b|garden|botanic|forest|jungle|nature|meadow|grove|picnic|zoo\b|wildlife|aviary|safari|golf/, 'park'],
  [/museum|gallery|library|planetarium|archives/, 'museum'],
  [/landmark|monument|historic|attraction|memorial|fort|heritage|ruins|palace|tomb|statue|qila\b|\bgates?\b|smarak|artwork|archaeolog/, 'monument'],
  [/information|\binfo\b|tourist\b|visitor\b/, 'info'],
  [/address|housenumber|housename|residence|dwelling|\bhouses?\b|\bflats?\b|bungalow|\bhut\b/, 'home'],
  [/fire/, 'flame'],
  [/\bstations?\b|\bhalt\b|platforms?\b|junctions?\b|terminus/, 'rail'],
  [/road|street|avenue|boulevard|lane\b|marg\b|drive\b|\bpath\b|track\b|footway|footpath|cycleway|bridleway|pedestrian|living street|highway|motorway|trunk|expressway|flyover|bypass|bridge|chowk|roundabout|crossing|intersection|corridor|\blink\b|^service$|primary|secondary|tertiary|unclassified|\bnh\b|\bsh\b/, 'route'],
  [/locality|suburb|neighbourhood|neighborhood|macrohood|microhood|quarter|district|borough|sector|colony|enclave|hamlet|village|township|\btowns?\b|\bcity\b|tehsil|division|residential|administrative|block\b|ward\b|zone\b|region|province|state\b|housing|society|building|commercial|industrial|factory|manufactur|warehouse|centre|center|apartments?|estate\b|pocket\b|phase\b/, 'city'],
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

/* ── route-card words + numbers — plain, short, from live fields only ── */
const BAND_WORD = ['good', 'satisfactory', 'moderate', 'poor', 'very poor', 'severe'];
const fmtMins = (m) => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
/* one decimal under 10 so a real 4.1-vs-5.2 win can't round away */
const doseTxt = (x) => `${x < 10 ? x.toFixed(1) : Math.round(x)} µg`;
const etaOf = (o) => (o && typeof o.live_eta_s === 'number' ? o.live_eta_s
  : o && typeof o.eta_s === 'number' ? o.eta_s
  : o && typeof o.duration_s === 'number' ? o.duration_s
  : o && typeof o.minutes === 'number' ? o.minutes * 60
  : o && typeof o.duration_min === 'number' ? o.duration_min * 60 : Infinity);
const doseOf = (o) => {
  const d = o && o.dose;
  if (!d) return Infinity;
  if (typeof d.mid === 'number') return d.mid;
  /* no point estimate — the wire's own interval midpoint, not a guess */
  if (typeof d.lo === 'number' && typeof d.hi === 'number') return (d.lo + d.hi) / 2;
  return Infinity;
};
/* lane E: fuel_l (petrol/diesel litres; 0 = no engine / electric),
   CNG rows carry fuel_l=null + fuel_kg — compared as amounts, shown in
   their own unit, never as money */
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
const fuelOf = (o) => (o ? (num(o.fuel_l) != null ? num(o.fuel_l) : num(o.fuel_kg)) : null);

/* ── modes — chosen BEFORE routing (Modes contract, lane E) ───────── */
const MODES = [
  { id: 'health_max', glyph: 'leaf', title: 'Health Maxer', sub: 'cleanest air, no compromise', badge: 'cleanest' },
  { id: 'petrol_health', glyph: 'fuel', title: 'Petrol + Health', sub: 'least petrol, clean air', badge: 'petrol-friendly' },
  { id: 'time_health', glyph: 'clock', title: 'Time + Health', sub: 'fastest with live traffic, still clean', badge: 'fastest' },
];
const modeDef = (id) => MODES.find((m) => m.id === id) || MODES[0];

/* ── vehicle profile — store/vehicle.ts ports ─────────────────────── */
/* plan._VEHICLE_ALIASES wants a STRING ('bike'); an object here made the
   server fall back to 'car' whatever the rider picked */
const SERVER_CLASS = { car: 'car', bike: 'bike', auto: 'auto', bus: 'bus', metro: 'metro', cycle: 'cycle', walk: 'walk' };
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
function planVehicle(p) { return p && p.cls ? SERVER_CLASS[p.cls] || null : null; }
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
/* option.mode → the declared vehicle it represents (plan._FAMILY) */
const FAMILY = { car: 'car', car_open: 'car', cab: 'car', auto: 'auto', e_rickshaw: 'auto', bike: 'bike', scooter: 'bike', bus: 'bus', metro: 'metro', 'metro+walk': 'metro', walk: 'walk', cycle: 'cycle' };
const famOf = (o) => FAMILY[o.mode] || (/metro/.test(o.mode || '') ? 'metro' : /bus/.test(o.mode || '') ? 'bus' : 'car');

/* ── store keys ───────────────────────────────────────────────────── */
const K_RECENT = 'whereto.recents', K_SAVED = 'whereto.saved',
  K_VEH = 'whereto.vehicle', K_LAST = 'whereto.last', K_MODE = 'whereto.mode';
const loadJ = (k, fb) => { try { return A.store.get(k, fb); } catch (e) { return fb; } };

/* ── per-mount state ──────────────────────────────────────────────── */
let S = null;

/* ═══════════════ SEARCH SURFACE — one Google-Maps surface ══════════
   From + To rows (they ARE the inputs) over one results list. Nothing
   else lives here: no air rows, no stay/play doors, no intent rows. */
function placeRow(o) {
  /* o: {glyph, gcolor, title, sub, dist, armed, data} → PlaceRow */
  return `<button class="wt-row${o.armed ? ' armed' : ''}" type="button" data-k="${esc(o.key || '')}">
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
const rowKey = (p) => `${p.name || p.label}|${(+p.lat || 0).toFixed(4)}|${(+p.lon || 0).toFixed(4)}`;

const havM = (a, b) => {
  if (!a || !b || b.lat == null || a.lat == null) return null;
  const R = 6371000, rad = Math.PI / 180;
  const s = Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) *
    Math.sin((b.lon - a.lon) * rad / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const searchBias = () => S.from || (A.geo && A.geo.pos) || A.DELHI;
/* local instant rows — saved + recents matching every typed word */
function instantRows() {
  const q = NORM(S.q).trim();
  const out = [];
  const bias = searchBias();
  const test = (nm) => { const n = NORM(nm); return q.split(/\s+/).every((w) => n.includes(w)); };
  for (const slot of ['home', 'work']) {
    const p = S.saved[slot];
    if (p && test(`${slot} ${p.name} ${p.sub || ''}`)) out.push({ ...p, _slot: slot });
  }
  for (const r of S.recents) if (test(`${r.name} ${r.sub || ''}`)) out.push({ ...r, _recent: true });
  return out.slice(0, 3).map((p) => {
    const d = havM(bias, p);
    return d == null ? p : { ...p, dist: d / 1000 };
  });
}

/* ONE plain subtitle — never a raw tag ("amenity:place_of_worship"),
   never the name echoed back, never "Delhi, Delhi" twice */
const TAG_PREFIX = /\b(amenity|shop|tourism|leisure|building|highway|place|office|landuse|railway|public_transport|historic|man_made|natural|craft|healthcare|club|sport|emergency|aeroway|waterway|boundary|religion|cuisine|denomination)\s*[:=]\s*/gi;
function plainSub(sub, name) {
  let s = String(sub == null ? '' : sub).replace(TAG_PREFIX, '').replace(/_/g, ' ')
    .replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const nm = NORM(name).trim();
  const seen = new Set([nm]);
  const segs = [];
  for (const seg of s.split(/\s+·\s+|\s*\|\s*/)) {
    const parts = [];
    for (const p of seg.split(/\s*,\s*/)) {
      const k = NORM(p).trim();
      if (!k || seen.has(k)) continue;
      seen.add(k); parts.push(p.trim());
    }
    if (parts.length) segs.push(parts.slice(0, 3).join(', '));
  }
  return segs.slice(0, 2).join(' · ');
}
function cleanRows(rows) {
  const out = [], seen = new Set();
  const bias = searchBias();
  for (const r of rows || []) {
    if (!r || r.lat == null || r.lon == null || !isFinite(+r.lat) || !isFinite(+r.lon)) continue;
    const name = String(r.name || r.label || '').trim();
    if (!name) continue;
    const dm = r.dist != null ? r.dist : r.distance_m != null ? r.distance_m : havM(bias, { lat: +r.lat, lon: +r.lon });
    const row = { ...r, name, lat: +r.lat, lon: +r.lon,
      sub: plainSub(r.sub != null ? r.sub : r.subtitle, name), dist: dm };
    const k = rowKey(row);
    if (seen.has(k)) continue;
    seen.add(k); out.push(row);
  }
  return out;
}
/* does a row answer the typed words? every word prefixes a word of its
   name or subtitle — lets the last answer narrow while the next one is
   on its way (never a stale row for a new query), and decides "exact" */
const Q_STOP = new Set(['the', 'of', 'to', 'in', 'at', 'near', 'and', 'a', 'an', 'on', 'opp', 'opposite', 'behind', 'by']);
const qToks = (q) => (NORM(q).match(WORD) || []).filter((w) => !Q_STOP.has(w));
function rowMatches(r, toks) {
  if (!toks.length) return true;
  const words = NORM(`${r.name} ${r.sub || ''}`).match(WORD) || [];
  return toks.every((tk) => words.some((w) => w.startsWith(tk)));
}

function searchListHTML() {
  let h = '';
  const qt = S.q.trim();
  if (!qt) {
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
    if (!S.recents.length && !saved.length) {
      h += `<div class="wt-quiet">${icon('search', 20, INK3)}<span>${t('emptySearchHint')}</span></div>`;
    }
    return h;
  }
  const inst = instantRows();
  const toks = qToks(S.q);
  const searching = qt.length >= 2 && !S.final;
  /* slim progress hint — rows already shown stay; deeper ones land below */
  if (searching) h += `<div class="wt-prog" role="progressbar" aria-label="${t('searching')}"><i></i></div>`;
  for (const p of inst) {
    const k = p._slot ? `saved:${p._slot}` : `recent:${rowKey(p)}`;
    h += placeRow({ key: k, glyph: p._slot || 'clock', titleHtml: matchSpans(p._slot ? t(p._slot) : p.name, S.q), sub: p._slot ? p.name : p.sub, dist: p.dist, armed: S.saveFor && S.saveFor.key === k });
    if (S.saveFor && S.saveFor.key === k) h += saveStrip();
  }
  const dup = new Set(inst.map((p) => rowKey(p)));
  const rest = (S.results || []).filter((r) => !dup.has(rowKey(r)));
  /* honest closeness: when the finished answer holds nothing that
     carries every typed word, say so above the nearest guesses */
  if (S.final && rest.length && !inst.length && !rest.some((r) => rowMatches(r, toks))) {
    h += `<div class="wt-sec wt-near">${t('noExact')}</div>`;
  }
  for (const r of rest) {
    const k = `res:${rowKey(r)}`;
    h += placeRow({ key: k, glyph: catGlyph(r.kind || r.sub), titleHtml: matchSpans(r.name, S.q), sub: r.sub, dist: r.dist != null ? r.dist / 1000 : null, armed: S.saveFor && S.saveFor.key === k });
    if (S.saveFor && S.saveFor.key === k) h += saveStrip();
  }
  if (!inst.length && !rest.length) {
    if (searching) {
      h += '<div class="wt-skel" aria-hidden="true"><i></i><i></i><i></i></div>';
    } else if (qt.length >= 2) {
      h += `<div class="wt-quiet">${icon('search', 20, INK3)}<span>${t(S.slow ? 'slowSearch' : 'noPlaceFound')}</span></div>`;
    } else {
      h += `<div class="wt-quiet">${icon('search', 20, INK3)}<span>${t('keepTyping')}</span></div>`;
    }
  }
  return h;
}
/* a from/to row — the armed row IS the input (Uber pattern) */
function rrowHtml(which) {
  const key = which === 'from' ? t('fromLabel') : t('fieldTo');
  const dot = which === 'to' ? ' to' : '';
  const phOf = () => S[which] ? S[which].label
    : (which === 'from' && S.locating ? t('locating')
    : t(which === 'from' ? 'searchFromPlaceholder' : 'searchPlaceholder'));
  if (S.armed !== which) {
    const locating = which === 'from' && !S[which] && S.locating;
    return `<button class="wt-rrow" type="button" data-arm="${which}">
      <i class="wt-rdot${dot}"></i><span class="wt-rkey">${key}</span>
      <span class="wt-rval${S[which] ? '' : ' ph'}"${locating ? ' style="animation:wtPulse 1.2s ease-in-out infinite alternate"' : ''}>${esc(phOf())}</span>
    </button>`;
  }
  return `<div class="wt-rrow on edit" data-arm="${which}">
    <i class="wt-rdot${dot}"></i><span class="wt-rkey">${key}</span>
    <input class="wt-rin" type="text" autocapitalize="off" autocomplete="off" spellcheck="false"
      enterkeyhint="search" aria-label="${which === 'from' ? t('searchFromPlaceholder') : t('searchPlaceholder')}" placeholder="${esc(phOf())}" value="${esc(S.q)}">
    <button class="wt-bbtn wt-rx" type="button" data-act="clear" aria-label="clear" ${S.q ? '' : 'hidden'}>${icon('close', 15, INK3)}</button>
  </div>`;
}
function focusArmed() {
  const inp = S.body.querySelector('.wt-rin');
  if (!inp) return;
  inp.focus();
  const n = inp.value.length;
  inp.setSelectionRange(n, n);
}
function renderSearch(focus) {
  S.phase = 'search';
  setHalf(false);
  const inCls = S._anim !== 'search' ? ' wt-in' : ''; S._anim = 'search';
  S.body.innerHTML = `<div class="wt${inCls}">
    <div class="wt-rc">
      <button class="wt-bbtn" type="button" data-act="close" aria-label="back">${BACK_SVG}</button>
      <div class="wt-rrows">
        ${rrowHtml('from')}
        <i class="wt-rhair"></i>
        ${rrowHtml('to')}
      </div>
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
  if (focus) focusArmed();
}
function bindSearch() {
  const root = S.body.querySelector('.wt');
  /* unarmed row: tap arms it — the input moves into that row */
  root.querySelectorAll('button.wt-rrow').forEach((b) => b.addEventListener('click', () => {
    if (S.armed === b.dataset.arm) return;
    cancelLive();
    S.armed = b.dataset.arm; S.q = ''; S.results = null; S.final = true; S.saveFor = null;
    /* a live fix stashed while the user was typing a custom From applies
       when they leave the row without picking — 'Your location' stands */
    if (S.armed !== 'from' && S._geoWait) {
      const p = S._geoWait; S._geoWait = null;
      applyGeoFrom(p);
      if (S.phase !== 'search') return;
    }
    renderSearch(true);
  }));
  const armedRow = root.querySelector('.wt-rrow.edit');
  const input = armedRow && armedRow.querySelector('.wt-rin');
  if (armedRow && input) {
    armedRow.addEventListener('click', (e) => {
      if (e.target === input || e.target.closest('[data-act="clear"]')) return;
      input.focus();
      const n = input.value.length;
      input.setSelectionRange(n, n);
    });
    input.addEventListener('input', () => {
      const x = armedRow.querySelector('[data-act="clear"]');
      if (x) x.hidden = !input.value;
      onQ(input.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      /* Go = take the top place row; nothing listed yet → look deeper now */
      const first = root.querySelector('.wt-list .wt-row[data-k]');
      if (first) { pickRow(first.dataset.k); return; }
      if (S.q.trim().length >= 2) {
        cancelLive(); S.final = false; paintList();
        runSearch(S.q, { enter: true });
      }
    });
  }
  root.querySelector('[data-act="close"]').addEventListener('click', () => S.chrome.close());
  const xBtn = root.querySelector('[data-act="clear"]');
  if (xBtn) xBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (input) { input.value = ''; xBtn.hidden = true; onQ(''); input.focus(); }
  });
  root.querySelector('[data-act="locate"]').addEventListener('click', locateFill);
  root.querySelector('[data-act="map"]').addEventListener('click', armPinDrop);
  bindRows(root);
}
/* rows — click fills the armed slot; press-and-hold opens SaveStrip */
function bindRows(root) {
  root.querySelectorAll('.wt-list .wt-row').forEach((b) => {
    let lp = null, moved = false;
    b.addEventListener('pointerdown', () => { moved = false; lp = setTimeout(() => { openSave(b.dataset.k); lp = null; }, 420); });
    b.addEventListener('pointermove', (e) => { if (Math.abs(e.movementX) + Math.abs(e.movementY) > 8) { moved = true; clearTimeout(lp); lp = null; } });
    const cancel = () => { clearTimeout(lp); lp = null; };
    b.addEventListener('pointerup', cancel); b.addEventListener('pointercancel', cancel);
    b.addEventListener('click', () => { if (!moved) pickRow(b.dataset.k); moved = false; });
  });
  root.querySelectorAll('.wt-list .wt-sbtn').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation(); saveSlot(b.dataset.slot);
  }));
}
function paintList() {
  if (!S || S.phase !== 'search') return;
  const l = S.body.querySelector('.wt-list');
  if (!l) return;
  l.innerHTML = searchListHTML();
  bindRows(S.body.querySelector('.wt'));
}
/* near-first combining: same-name rows keep their tier position and sort
   nearest-first inside it */
function nearFirst(rows) {
  const groups = new Map(), order = [];
  for (const r of rows) {
    const k = NORM(r.name || '').replace(/[^a-z0-9]+/g, ' ').trim();
    if (!groups.has(k)) { groups.set(k, []); order.push(k); }
    groups.get(k).push(r);
  }
  const out = [];
  for (const k of order) {
    out.push(...groups.get(k).sort((a, b) => (a.dist ?? 9e12) - (b.dist ?? 9e12)));
  }
  return out;
}
let qTimer = 0;
/* the answer in flight: {c: cancel, seq, v}. Typing forward RETIRES it
   instead of killing it — its next network tier may still hold rows that
   carry every word typed since (they narrow in, never as stale rows),
   then it is cancelled. Editing backwards / clearing kills everything. */
function killRec(r) {
  if (!r) return;
  clearTimeout(r.t);
  if (typeof r.c === 'function') { try { r.c(); } catch (e) { /* already done */ } }
  r.c = null;
  if (S && S.retired) S.retired = S.retired.filter((x) => x !== r);
}
function cancelLive() {
  clearTimeout(qTimer);
  if (!S) return;
  if (S.guard) { clearTimeout(S.guard); S.guard = 0; }
  killRec(S.cur); S.cur = null;
  (S.retired || []).slice().forEach(killRec);
  S.retired = [];
}
function retireLive() {
  clearTimeout(qTimer);
  if (!S) return;
  if (S.guard) { clearTimeout(S.guard); S.guard = 0; }
  const r = S.cur; S.cur = null;
  if (!r || typeof r.c !== 'function') return;
  r.t = setTimeout(() => killRec(r), 2500);
  S.retired = [...(S.retired || []), r];
  while (S.retired.length > 2) killRec(S.retired[0]);
}
function onQ(v) {
  const prev = S.q;
  S.q = v;
  const forward = NORM(v).trim().startsWith(NORM(prev).trim()) && NORM(prev).trim().length >= 2;
  if (forward) retireLive(); else cancelLive();
  S.seq++;                       /* any answer still in flight is now stale */
  S.saveFor = null; S.slow = false;
  const len = v.trim().length;
  if (len < 2) {
    S.results = null; S.final = true; paintList();
    /* cleared the From box while a fix waited behind it — back to
       'Your location', the default the row started from */
    if (S._geoWait) { const p = S._geoWait; setTimeout(() => applyGeoFrom(p), 0); }
    return;
  }
  /* the previous answer narrows in place — only rows that still carry
     every typed word survive, so nothing on screen belongs to an old
     query and the list never blanks while the next answer is coming */
  if (S.results) S.results = S.results.filter((r) => rowMatches(r, qToks(v)));
  S.final = false;
  paintList();
  qTimer = setTimeout(() => runSearch(v), typeof A.search.live === 'function' ? 90 : 170);
}
const NET_STAGE = (st) => st !== 'carry' && st !== 'cache';
function runSearch(v, opts) {
  if (!S) return;
  const seq = ++S.seq;
  const bias = searchBias();
  S.slow = false;
  const rec = { c: null, seq, v, t: 0 };
  const live = () => S && seq === S.seq && v === S.q && S.phase === 'search' && A.current() === 'whereto';
  const apply = (rows, meta) => {
    if (!S || S.phase !== 'search' || A.current() !== 'whereto') return;
    const fin = !meta || meta.final !== false;
    if (!live()) {
      /* a retired answer: it may only ADD rows that carry every word
         typed now, and only until the current answer has its final word */
      const cur = S.q;
      if (!S.final && cur.trim().length >= 2 && NORM(cur).trim().startsWith(NORM(v).trim())) {
        const toks = qToks(cur);
        const add = nearFirst(cleanRows(rows)).filter((r) => rowMatches(r, toks));
        const have = new Set((S.results || []).map(rowKey));
        const fresh = add.filter((r) => !have.has(rowKey(r)));
        if (fresh.length) { S.results = [...(S.results || []), ...fresh].slice(0, 10); paintList(); }
      }
      if (fin || NET_STAGE(meta && meta.stage)) killRec(rec);
      return;
    }
    let clean = nearFirst(cleanRows(rows));
    /* while deeper tiers are still coming, only rows that carry every
       typed word show — a re-ranked list from the last query never
       passes for this one; the final word may add the closest guesses */
    if (!fin) clean = clean.filter((r) => rowMatches(r, qToks(v)));
    if (clean.length || fin) S.results = clean;
    if (fin) { S.final = true; S.slow = false; }
    if (fin && S.guard) { clearTimeout(S.guard); S.guard = 0; }
    paintList();
  };
  /* never a spinner that never ends: if no final word lands, the hint
     stops and an honest "taking long" line shows (late rows still land) */
  S.guard = setTimeout(() => { if (live() && !S.final) { S.final = true; S.slow = true; S.guard = 0; paintList(); } }, 15000);
  if (typeof A.search.live === 'function') {
    try {
      S.cur = rec;
      const c = A.search.live(v, bias, (rows, meta) => apply(rows, meta || { final: false }), opts || {});
      rec.c = typeof c === 'function' ? c : (c && typeof c.cancel === 'function' ? () => c.cancel() : null);
      if (!rec.c) S.cur = S.cur === rec ? null : S.cur;
      return;
    } catch (e) { if (S && S.cur === rec) S.cur = null; /* fall through to the one-shot cascade */ }
  }
  Promise.resolve(A.search.search(v, bias, opts || {}))
    .then((rows) => apply(rows, { final: true }))
    .catch(() => apply([], { final: true }));
}
function placeByKey(k) {
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
    if (!p || p.saved) return;
    S.saveFor = { key: k, place: p };
  }
  paintList();
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
  paintList();
}
function pickRow(k) {
  const p = placeByKey(k);
  if (!p) return;
  if (p.saved != null) {
    const s = S.saved[p.saved];
    if (s) finish({ name: t(p.saved), label: `${t(p.saved)} — ${s.name}`, lat: s.lat, lon: s.lon, noRecent: true });
    return;
  }
  finish({ name: p.name, label: p.name, sub: p.sub, lat: p.lat, lon: p.lon });
}
function finish(place) {
  const which = S.armed;
  S[which] = { label: place.label || place.name, lat: place.lat, lon: place.lon };
  /* a From the user typed or dropped themselves ends live auto-fill for
     this visit — a late GPS fix must never stomp a deliberate pick */
  if (which === 'from') { S.fromManual = true; S.locating = false; S._geoWait = null; }
  if (!place.noRecent) pushRecent({ name: place.name, sub: place.sub, lat: place.lat, lon: place.lon });
  A.store.set(K_LAST, { from: S.from, to: S.to });
  cancelLive();
  S.q = ''; S.results = null; S.final = true; S.saveFor = null; S.notice = null;
  S.plans = {};                    /* a new trip: cached mode answers are stale */
  if (S.from && S.to) afterBoth();
  else { S.armed = which === 'to' ? 'from' : 'to'; renderSearch(true); }
}
/* both ends set → modes → vehicle → routes. Once both were chosen on this
   visit, editing an end re-routes straight away with the same choices */
function afterBoth() {
  const ae = document.activeElement;
  if (ae && ae.blur) ae.blur();
  if (S.modeChosen && S.vehChosen) plan();
  else showModes();
}
function pushRecent(p) {
  if (!p || p.name == null || p.lat == null) return;
  S.recents = [p, ...S.recents.filter((r) => !samePlace(r, p))].slice(0, 8);
  A.store.set(K_RECENT, S.recents);
}
/* ── From = your live spot, by default ──────────────────────────────
   The composer opens locating already running: a fresh cached fix (or
   the picked spot) fills it at once, otherwise locate() runs under
   'granted' consent while the row says 'finding your spot…'. A manual
   pick ends auto-fill for the visit; a refusal or a dead sensor lands
   as an honest empty row + one hint line, never an invented place. */
/* rewrite only the from/to label wherever it is on screen — the search
   rows and the trip row — never a full re-render while the user types */
function relabelEnd(which) {
  if (!S || !S.body) return;
  const p = S[which];
  const txt = p ? p.label
    : (which === 'from' && S.locating ? t('locating')
    : t(which === 'from' ? 'searchFromPlaceholder' : 'searchPlaceholder'));
  const row = S.body.querySelector(`.wt-rrow[data-arm="${which}"]`);
  if (row) {
    const v = row.querySelector('.wt-rval');
    if (v) {
      v.textContent = txt;
      v.classList.toggle('ph', !p);
      v.style.animation = !p && which === 'from' && S.locating
        ? 'wtPulse 1.2s ease-in-out infinite alternate' : '';
    }
    const inp = row.querySelector('.wt-rin');
    if (inp) inp.placeholder = txt;
  }
  const tt = S.body.querySelector(`.wt-th[data-arm="${which}"] .wt-tt`);
  if (tt) tt.textContent = p ? p.label
    : t(which === 'from' ? 'searchFromPlaceholder' : 'searchPlaceholder');
}
function paintNotice() {
  if (!S || !S.body) return;
  const w = S.body.querySelector('.wt');
  if (!w) return;
  let n = w.querySelector('.wt-notice');
  if (S.notice) {
    if (!n) {
      n = el('<div class="wt-notice"><span></span></div>');
      const list = w.querySelector('.wt-list');
      if (list) w.insertBefore(n, list); else w.appendChild(n);
    }
    n.querySelector('span').textContent = S.notice;
  } else if (n) n.remove();
}
/* 'Your location' upgraded with the real locality once the reverse
   geocoder answers — the pin-drop rename pattern */
function geoLabel(which, pos) {
  if (!S || !pos) return;
  const lat = +pos.lat, lon = +pos.lon;
  const p = S[which];
  if (!p || p.lat !== lat || p.lon !== lon) return;
  if (pos.label) { p.label = pos.label; relabelEnd(which); return; }
  if (!A.search || typeof A.search.reverse !== 'function') return;
  A.search.reverse(lat, lon).then((nm) => {
    if (!S || !S[which] || S[which].lat !== lat || S[which].lon !== lon) return;
    if (nm) { S[which].label = `${t('yourLocation')} — ${nm}`; relabelEnd(which); }
  }).catch(() => {});
}
function applyGeoFrom(pos) {
  if (!S || S.fromManual || !pos || !isFinite(+pos.lat) || !isFinite(+pos.lon)) return;
  /* mid-typing a custom From — keep the fix on hold, it applies when the
     row is left or the box cleared */
  if (S.armed === 'from' && (S.q || '').trim()) { S._geoWait = pos; return; }
  const moved = !S.from || Math.abs(S.from.lat - pos.lat) > 1e-5
    || Math.abs(S.from.lon - pos.lon) > 1e-5;
  S.locating = false; S._geoWait = null;
  if (S._geoNoted) { S._geoNoted = false; S.notice = null; paintNotice(); }
  S.from = { label: pos.label || t('yourLocation'), lat: +pos.lat, lon: +pos.lon, live: 1 };
  geoLabel('from', pos);
  relabelEnd('from');
  if (moved) S.plans = {};          /* a moved start makes mode answers stale */
  if (S.to && moved) afterBoth();
}
function geoFail() {
  if (!S || S.from || S.fromManual) return;
  S.locating = false; S._geoWait = null; S._geoNoted = true;
  S.notice = t('locFail');
  paintNotice();
  relabelEnd('from');
}
function kickFromGeo() {
  if (!A.geo || S.from) return;
  const pos = A.geo.pos;
  const fresh = !!(pos && pos.t && (Date.now() - pos.t) < 120000);
  /* a fresh fix or a spot the user pinned themselves fills From at once;
     a stale GPS fix still verifies below — it just can't show first */
  if (pos && (fresh || pos.picked)) applyGeoFrom(pos);
  if (!navigator.geolocation) { if (!S.from) geoFail(); return; }
  if (A.geo.refine && A.geo.consent === 'granted') {
    /* keep following the fix while the composer is open — a From that is
       'Your location' moves when the fix does */
    S._geoStop = A.geo.refine((p) => applyGeoFrom(p));
  }
  if (A.geo.consent === 'picked' || A.geo.consent === 'later') return;
  /* the consent card's own fix lands through the event — covers a grant
     that arrives after our locate() already failed or while the sheet
     was still up */
  if (!S._geoEvt) {
    S._geoEvt = (e) => {
      if (!S || S.fromManual) return;
      if (e.detail) applyGeoFrom(e.detail);
      else geoFail();
    };
    document.addEventListener('alive:location', S._geoEvt);
  }
  if (S.from) return;             /* cached fill already applied */
  S.locating = true;
  relabelEnd('from');
  A.geo.locate()
    .then((p) => applyGeoFrom(p))
    .catch(() => { if (S && !S.from && !S.fromManual) geoFail(); });
}
async function locateFill() {
  const which = S.armed;
  let pos = A.geo && A.geo.pos;
  if (!pos) {
    try { pos = await A.geo.locate(); } catch (e) { pos = null; }
  }
  if (!S || S.phase !== 'search') return;
  if (!pos) { S.notice = t('locFail'); paintNotice(); return; }
  finish({ name: t('yourLocation'), lat: pos.lat, lon: pos.lon, noRecent: true });
  geoLabel(which, pos);
}
/* armed pin-drop — fold the sheet into a hint strip; one map tap fills it */
function armPinDrop() {
  const ae = document.activeElement;
  if (ae && ae.blur) ae.blur();
  cancelLive();
  S.armedPin = S.armed;
  S.el.classList.add('wt-armed');
  const strip = el(`<div class="wt-pinbar">
      ${icon('pin', 16, INK2)}
      <span><b>${t('mapPickHint')}</b><i>${S.armedPin === 'from' ? t('searchFromPlaceholder') : t('searchPlaceholder')}</i></span>
      <button class="wt-pinx" type="button" data-unarm aria-label="cancel">${icon('close', 14, INK3)}</button>
    </div>`);
  strip.querySelector('.wt-pinx').addEventListener('click', disarmPin);
  S.el.querySelector('.sheet').appendChild(strip);
  const onTap = (e) => {
    if (A.current() !== 'whereto' || !S) return;
    const { lat, lon } = e.detail;
    const which = S.armedPin;
    disarmPin();
    finish({ name: 'dropped pin', lat, lon, noRecent: true });
    A.search.reverse(lat, lon).then((nm) => {
      if (nm && S && S[which] && S[which].lat === lat) {
        S[which].label = nm;
        if (S.phase === 'search') renderSearch(true);
        else if (S.phase === 'modes') renderModes();
        else if (S.phase === 'plan') renderPlan();
      }
    }).catch(() => {});
  };
  S._tapOff = () => document.removeEventListener('alive:maptap', onTap);
  document.addEventListener('alive:maptap', onTap, { once: true });
}
function disarmPin() {
  if (!S) return;
  S.armedPin = null;
  S.el.classList.remove('wt-armed');
  const s = S.el.querySelector('.wt-pinbar');
  if (s) s.remove();
  if (S._tapOff) { S._tapOff(); S._tapOff = null; }
  if (S.phase === 'search' && A.current() === 'whereto') focusArmed();
}

/* ═══════════════ trip row — shared by modes / vehicle / routes ═════ */
function tripRow() {
  return `<div class="wt-trip">
    <button class="wt-th" type="button" data-arm="from"><i class="wt-tdot"></i><span class="wt-tt">${esc(S.from ? S.from.label : t('searchFromPlaceholder'))}</span></button>
    <span class="wt-tarr" aria-hidden="true">→</span>
    <button class="wt-th" type="button" data-arm="to"><i class="wt-tdot to"></i><span class="wt-tt">${esc(S.to ? S.to.label : t('searchPlaceholder'))}</span></button>
  </div>`;
}
function bindTrip(root) {
  root.querySelectorAll('.wt-th').forEach((b) => b.addEventListener('click', () => {
    S.pseq++;                    /* a plan still in flight is now stale */
    clearMapExtras(); A.map.hideAllRoutes(); S.paintedIds = [];
    S.armed = b.dataset.arm; S.q = ''; S.results = null; S.final = true;
    renderSearch(true);
  }));
}
function setHalf(on) { if (S && S.el) S.el.classList.toggle('wt-half', !!on); }

/* ═══════════════ MODES — before routing ════════════════════════════ */
function showModes() {
  S.phase = 'modes';
  S.pseq++;
  clearMapExtras(); A.map.hideAllRoutes(); S.paintedIds = [];
  renderModes();
  pinEnds();                     /* the two ends on the map while a mode is picked */
}
/* once a mode's plan was fetched this trip, its card shows the pick's
   own numbers ("pick · 0.93 L · 17 min") — real answers, not promises */
function modeSub(m) {
  const j = S.plans && S.plans[m.id];
  if (!j) return m.sub;
  const b = (j.mode_picks && j.mode_picks[m.id])
    || (Array.isArray(j.options) ? j.options.find((o) => o.mode_pick) : null);
  if (!b) return m.sub;
  const es = isFinite(etaOf(b)) ? etaOf(b) : null;
  const mins = es != null ? Math.max(1, Math.round(es / 60)) : null;
  const dm = doseMidOf(b), fl = fuelLead(b);
  const parts = m.id === 'petrol_health' ? [fl, mins != null ? `${mins} min` : null]
    : m.id === 'time_health' ? [mins != null ? `${mins} min` : null, dm != null ? doseTxt(dm) : null]
    : [dm != null ? doseTxt(dm) : null, mins != null ? `${mins} min` : null];
  const s = parts.filter(Boolean).join(' · ');
  return s ? `pick · ${s}` : m.sub;
}
function renderModes() {
  setHalf(false);
  const cur = S.mode;
  const inCls = S._anim !== 'modes' ? ' wt-in' : ''; S._anim = 'modes';
  S.body.innerHTML = `<div class="wt${inCls}">
    ${tripRow()}
    <div class="wt-vhead"><span class="wt-vq">${t('modesQ')}</span></div>
    <div class="wt-list wt-mlist">
      ${MODES.map((m) => `<button class="wt-mode${m.id === cur ? ' on' : ''}" type="button" data-mode="${m.id}" aria-pressed="${m.id === cur}">
        <span class="wt-mg">${icon(m.glyph, 26, m.id === cur ? ACCENT : INK2)}</span>
        <span class="wt-mt"><b>${esc(m.title)}</b><span>${esc(modeSub(m))}</span></span>
        ${CHEV_SVG(m.id === cur ? ACCENT : INK3, 20)}
      </button>`).join('')}
    </div>
    <div class="wt-vfoot"><button class="wt-vfb" type="button" data-act="back">${t('vehicleQ_back')}</button><span></span></div>
  </div>`;
  const root = S.body.querySelector('.wt');
  bindTrip(root);
  root.querySelectorAll('.wt-mode').forEach((b) => b.addEventListener('click', () => {
    S.mode = b.dataset.mode;
    A.store.set(K_MODE, S.mode);
    S.modeChosen = true;
    if (S.vehChosen) plan();
    else openVehicle('trip');
  }));
  root.querySelector('[data-act="back"]').addEventListener('click', () => {
    if (S.plan && S.vehChosen) { S.phase = 'plan'; renderPlan(); paintRoutes(); return; }
    S.armed = 'to'; S.q = ''; S.results = null; S.final = true;
    renderSearch(true);
  });
}

/* ═══════════════ ROUTES — after mode + vehicle ═════════════════════ */
async function plan() {
  S.phase = 'plan';
  S.planning = true; S.planErr = null; S.plan = null; S.view = null; S.sel = 0; S.showOther = false;
  const seq = ++S.pseq;
  clearMapExtras(); A.map.hideAllRoutes(); S.paintedIds = [];
  clearTimeout(S._fitT); S._fitT = 0;   /* a queued fit belongs to the stale plan */
  renderPlan();
  pinEnds();
  const body = {
    from: { lat: S.from.lat, lon: S.from.lon },
    to: { lat: S.to.lat, lon: S.to.lon },
    mode: S.mode,
  };
  const veh = planVehicle(S.tripVeh), prof = planVehicleProfile(S.tripVeh);
  if (veh) body.vehicle = veh;
  if (prof) body.vehicle_profile = prof;
  const j = await A.api.post('/v2/plan', body, 45000);
  if (!S || seq !== S.pseq || A.current() !== 'whereto' || S.phase !== 'plan') return;
  S.planning = false;
  if (!j) { S.planErr = 'failed'; renderPlan(); return; }
  if (j.error === 'outside') { S.planErr = 'outside'; renderPlan(); return; }
  if (!Array.isArray(j.options) || !j.options.length) { S.planErr = j.error === 'failed' ? 'failed' : 'noroutes'; renderPlan(); return; }
  S.plan = j;
  S.plan.options = expandAlts(j.options, j);
  S.plans[S.mode] = j;             /* the modes screen annotates with each fetched pick */
  S.view = buildView(S.plan.options);
  S.sel = S.view.pickI >= 0 ? S.view.pickI : (S.view.prim[0] ? S.view.prim[0].i : 0);
  if (S.view.otherPickI >= 0) S.showOther = true;   /* the server's pick is another ride — show it */
  S.partial = Array.isArray(j.degraded) && j.degraded.length ? j.degraded : null;
  renderPlan();
  paintRoutes();
}
/* the mode's rule (Modes contract) applied to live fields only. The
   server's own mode_pick always wins; petrol never claims a pick
   without litres on the wire. */
function rulePick(group, mode) {
  const wd = group.filter((x) => isFinite(doseOf(x.o)));
  if (!wd.length) return -1;
  const minD = Math.min(...wd.map((x) => doseOf(x.o)));
  const ok = wd.filter((x) => doseOf(x.o) <= minD * 1.15 + 1e-9);
  if (mode === 'time_health') return ok.reduce((b, x) => (etaOf(x.o) < etaOf(b.o) ? x : b)).i;
  if (mode === 'petrol_health') {
    const f = ok.filter((x) => fuelOf(x.o) != null);
    return f.length ? f.reduce((b, x) => (fuelOf(x.o) < fuelOf(b.o) ? x : b)).i : -1;
  }
  return wd.reduce((b, x) => (doseOf(x.o) < doseOf(b.o) ? x : b)).i;
}
const keyFor = (mode) => mode === 'time_health' ? etaOf
  : mode === 'petrol_health' ? (o) => (fuelOf(o) != null ? fuelOf(o) : doseOf(o)) : doseOf;
/* b is no better than a on time, air and petrol, and worse on one */
function dominates(a, b) {
  const ta = etaOf(a), tb = etaOf(b), da = doseOf(a), db = doseOf(b);
  if (!isFinite(da) || !isFinite(db) || !isFinite(ta) || !isFinite(tb)) return false;
  const fa = fuelOf(a), fb = fuelOf(b);
  const fOk = fa == null || fb == null || fa <= fb + 0.005;
  const better = ta < tb - 30 || da < db - 0.05 || (fa != null && fb != null && fa < fb - 0.01);
  return ta <= tb + 30 && da <= db + 0.05 && fOk && better;
}
function nearSame(a, b) {
  const da = doseOf(a), db = doseOf(b);
  const fa = fuelOf(a), fb = fuelOf(b);
  return Math.abs(etaOf(a) - etaOf(b)) < 60 &&
    isFinite(da) && isFinite(db) && Math.abs(da - db) <= Math.max(0.3, 0.03 * Math.min(da, db)) &&
    (fa == null || fb == null || Math.abs(fa - fb) < 0.05);
}
/* four near-identical cards of one vehicle collapse to the distinct ones:
   drop routes another route beats on time AND air (AND petrol when the
   server sends litres), then near-duplicates; the mode's pick stays */
function collapse(group, pickI, mode) {
  const key = keyFor(mode);
  const sorted = [...group].sort((a, b) => (a.i === pickI ? -1 : b.i === pickI ? 1 : key(a.o) - key(b.o)));
  const nd = sorted.filter((x) => x.i === pickI || !sorted.some((y) => y !== x && dominates(y.o, x.o)));
  const out = [];
  for (const x of nd) {
    if (out.some((y) => nearSame(x.o, y.o))) continue;
    out.push(x);
    if (out.length >= 3) break;
  }
  return out;
}
/* a lane may add `alternatives` — extra corridors nested under a row or
   at the top level. Only route-shaped entries (geometry + an eta) join
   the picker, labelled '· alt'; anything else is skipped, absent is fine */
function expandAlts(opts, plan) {
  const out = [];
  const push = (a, parent) => {
    if (!a || typeof a !== 'object' || Array.isArray(a)) return;
    const g = a.geometry || a.route_geojson;
    if (!g || !isFinite(etaOf(a))) return;
    out.push({ ...a,
      mode: a.mode || (parent && parent.mode) || 'car',
      label: a.label || `${baseLabel(parent || a)} · alt` });
  };
  for (const o of opts || []) {
    out.push(o);
    (Array.isArray(o && o.alternatives) ? o.alternatives : []).forEach((a) => push(a, o));
  }
  (Array.isArray(plan && plan.alternatives) ? plan.alternatives : []).forEach((a) => push(a, null));
  return out;
}
function buildView(opts) {
  const all = opts.map((o, i) => ({ o, i }));
  const tv = S.tripVeh && S.tripVeh.cls;
  let prim = all.filter((x) => x.o.your_vehicle === true);
  if (!prim.length && tv) prim = all.filter((x) => famOf(x.o) === tv);
  if (!prim.length) {
    const r = opts.find((o) => o.recommended) || opts[0];
    prim = all.filter((x) => famOf(x.o) === famOf(r));
  }
  /* the server's mode_pick is the truth wherever it sits; only an older
     server (no flag anywhere) falls back to the contract rule */
  const serverPickI = opts.findIndex((o) => o.mode_pick === true);
  const flagged = prim.find((x) => x.o.mode_pick === true);
  const pickI = flagged ? flagged.i : (serverPickI >= 0 ? -1 : rulePick(prim, S.mode));
  const distinct = collapse(prim, pickI, S.mode);
  /* other ways: the best of each other vehicle, cleanest first */
  const primFam = new Set(prim.map((x) => famOf(x.o)));
  const key = keyFor(S.mode);
  const fams = new Map();
  for (const x of all) {
    const f = famOf(x.o);
    if (primFam.has(f)) continue;
    const cur = fams.get(f);
    if (!cur || key(x.o) < key(cur.o)) fams.set(f, x);
  }
  if (serverPickI >= 0 && !flagged) {
    const f = famOf(opts[serverPickI]);
    fams.set(f, { o: opts[serverPickI], i: serverPickI });
  }
  const other = [...fams.values()].sort((a, b) =>
    (key(a.o) - key(b.o)) || (doseOf(a.o) - doseOf(b.o))).slice(0, 6);
  return { prim: distinct, other, pickI, otherPickI: flagged ? -1 : serverPickI };
}
const baseLabel = (o) => String(o.label || '').split(' · ')[0].trim() || t('vehicle_' + famOf(o));
/* mode_picks refs carry dose_mid; options carry dose.{mid} — one read for both */
const doseMidOf = (x) => x ? (num(x.dose_mid) != null ? num(x.dose_mid)
  : (x.dose && num(x.dose.mid) != null ? num(x.dose.mid)
  : (isFinite(doseOf(x)) ? doseOf(x) : null))) : null;
/* the number each mode leads its cards with — its own metric */
const PK_TAG = { health_max: 'the cleanest pick', petrol_health: 'the petrol pick', time_health: 'the fastest pick' };
const PK_WORD = { health_max: 'the cleanest', petrol_health: 'the thriftiest', time_health: 'the fastest' };
const fuelLead = (o) => {
  /* 2 decimals under 1 L so a real 0.01 L win can't round away */
  const l = num(o.fuel_l), kg = num(o.fuel_kg);
  const kind = String(o.fuel_type || (o.emissions && o.emissions.fuel) || '').toLowerCase();
  if (l != null && l > 0) return `${l < 1 ? l.toFixed(2) : l < 10 ? l.toFixed(1) : Math.round(l)} L ${kind === 'diesel' ? 'diesel' : 'petrol'}`;
  if (l == null && kg != null && kg > 0) return `${kg < 1 ? kg.toFixed(2) : kg.toFixed(1)} kg CNG`;
  if (l === 0) return 'no petrol';
  return null;                       /* unknown — never a guess */
};
/* pick card: the trade-off against the OTHER modes' picks, in real
   numbers from mode_picks. Every clause is a comparison of two wire
   numbers; nothing is interpolated or invented. */
function vsLine(o) {
  const pk = S.plan && S.plan.mode_picks;
  if (!pk || S.plan.one_pick) return '';
  const segs = [];
  const sameRow = (r) => r && r.route_id === o.route_id;
  const myDose = isFinite(doseOf(o)) ? doseOf(o) : null, myEta = etaOf(o), myFuel = fuelOf(o);
  const refDose = pk.health_max, refFuel = pk.petrol_health, refTime = pk.time_health;
  const doseSeg = (ref, word) => {
    if (!ref) return null;
    if (sameRow(ref)) return `also ${word}`;
    const rd = doseMidOf(ref);
    if (myDose == null || rd == null || rd <= 0) return null;
    const p = Math.round((myDose - rd) / rd * 100);
    if (Math.abs(p) < 3) return `about the same smoke as ${word}`;
    return `${p > 0 ? '+' : ''}${p}% smoke vs ${word}`;
  };
  const etaSeg = (ref, word) => {
    if (!ref) return null;
    if (sameRow(ref)) return `also ${word}`;
    const re = isFinite(etaOf(ref)) ? etaOf(ref) : null;
    if (!isFinite(myEta) || re == null) return null;
    const d = Math.round((myEta - re) / 60);
    if (d === 0) return `same time as ${word}`;
    return `${d > 0 ? '+' : ''}${d} min vs ${word}`;
  };
  const fuelSeg = (ref, word) => {
    if (!ref) return null;
    if (sameRow(ref)) return `also ${word}`;
    const rf = num(ref.fuel_l) != null ? num(ref.fuel_l) : num(ref.fuel_kg);
    if (myFuel == null || rf == null) return null;
    const unit = (o.fuel_kg != null && ref.fuel_kg != null) ? ' kg' : ' L';
    if (unit === ' L' && (o.fuel_l == null || ref.fuel_l == null)) return null;
    if (unit === ' kg' && (o.fuel_kg == null || ref.fuel_kg == null)) return null;
    const d = myFuel - rf;
    if (Math.abs(d) < 0.005) return `about the same fuel as ${word}`;
    return `${d > 0 ? '+' : ''}${Math.abs(d) < 0.1 ? d.toFixed(2) : d.toFixed(1)}${unit} vs ${word}`;
  };
  if (S.mode === 'health_max') {
    segs.push(etaSeg(refTime, PK_WORD.time_health));
    if (!sameRow(refTime)) {
      const ds = doseSeg(refTime, PK_WORD.time_health);
      if (ds && !/^also/.test(ds)) segs[0] = `${ds} · ${segs[0]}`;
    }
    const fs = fuelSeg(refFuel, PK_WORD.petrol_health);
    if (fs && /^also/.test(fs)) segs.push(fs);
    else if (fs && segs.length < 2) segs.push(fs);
  } else if (S.mode === 'petrol_health') {
    const fs = fuelSeg(refTime, PK_WORD.time_health);
    const es = etaSeg(refTime, PK_WORD.time_health);
    if (fs && !/^also/.test(fs) && es && !/^also/.test(es)) segs.push(`${fs} · ${es}`);
    else segs.push(fs || es);
    const ds = doseSeg(refDose, PK_WORD.health_max);
    if (ds) segs.push(ds);
  } else {
    const ds = doseSeg(refDose, PK_WORD.health_max);
    if (ds) segs.push(ds);
    const fs = fuelSeg(refFuel, PK_WORD.petrol_health);
    if (fs) segs.push(fs);
  }
  return segs.filter(Boolean).slice(0, 2).join(' · ');
}
/* a row that is one of the OTHER modes' picks gets a small tag —
   cross-mode comparison on the card itself; the doc-06 ranked winner
   carries 'recommended' when no mode claims it */
function otherPickTag(o) {
  const pk = S.plan && S.plan.mode_picks;
  if (pk) {
    for (const m of MODES) {
      if (m.id === S.mode) continue;
      const r = pk[m.id];
      if (r && r.route_id === o.route_id) return PK_TAG[m.id];
    }
  }
  return o.recommended === true ? t('recommendedTag') : '';
}
/* o.delta — the server's own "vs the route you'd have taken" numbers:
   air_ug/air_pct (negative = breathes less), min_added, band_drop.
   Shown only when the server computed it — never reconstructed. */
function deltaLine(o) {
  const d = o && o.delta;
  if (!d || d.basis === 'self') return '';
  const p = num(d.air_pct), m = num(d.min_added);
  const vs = d.vs_label ? ` vs ${String(d.vs_label).split(' · ')[0].trim()}` : '';
  const bits = [];
  if (p != null && Math.abs(p) >= 3) bits.push(`${p > 0 ? '+' : '−'}${Math.abs(Math.round(p))}% smoke`);
  if (m != null && Math.abs(m) >= 0.9) bits.push(`${m > 0 ? '+' : '−'}${Math.abs(Math.round(m))} min`);
  return bits.length ? bits.join(' · ') + vs : '';
}
const ROADISH = /^[A-Z0-9]/;
function viaOf(o) {
  if (o.stations && o.stations.board && o.stations.alight) return `${o.stations.board} → ${o.stations.alight}`;
  let names = Array.isArray(o.via_streets) && o.via_streets.length ? o.via_streets
    : Array.isArray(o.via_names) && o.via_names.length ? o.via_names : null;
  if (!names && Array.isArray(o.steps)) {
    const m = new Map();
    for (const s of o.steps) {
      const st = String((s && s.street) || '').trim();
      if (st) m.set(st, (m.get(st) || 0) + ((s && s.distance_m) || 0));
    }
    names = [...m.entries()].sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  }
  if (!names) return '';
  const seen = new Set(), pick = [];
  for (const n of names) {
    const s = String(n || '').trim();
    if (s.length < 3 || !ROADISH.test(s) || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase()); pick.push(s);
    if (pick.length >= 2) break;
  }
  return pick.length ? t('viaStreets', { streets: pick.join(', ') }) : '';
}
const amt = (n) => (n < 0.1 ? n.toFixed(2) : n.toFixed(1));
function fuelBits(o) {
  /* "0.6 L petrol" · "0.3 kg CNG" · "saves 0.2 L" — zero-fuel rows only
     say "no petrol" where petrol is the question (Petrol + Health) */
  const out = [];
  const petrolMode = S.mode === 'petrol_health';
  const kind = String(o.fuel_type || (o.emissions && o.emissions.fuel) || '').toLowerCase();
  const l = num(o.fuel_l), kg = num(o.fuel_kg);
  if (l != null && l > 0) out.push(`${amt(l)} L ${kind === 'diesel' ? 'diesel' : 'petrol'}`);
  else if (l == null && kg != null && kg > 0) out.push(`${amt(kg)} kg CNG`);
  else if (l === 0 && petrolMode) out.push('no petrol');
  const sl = num(o.fuel_saved_l), sk = num(o.fuel_saved_kg);
  if (sl != null && sl >= 0.01) out.push(`saves ${amt(sl)} L`);
  else if (sk != null && sk >= 0.01) out.push(`saves ${amt(sk)} kg`);
  return out;
}
function optionCard(o, i, other) {
  const sel = i === S.sel;
  const md = modeDef(S.mode);
  const pick = S.view && (other ? i === S.view.otherPickI : i === S.view.pickI);
  const e = etaOf(o);
  const mins = isFinite(e) ? Math.max(1, Math.round(e / 60)) : null;
  const d = o.dose;
  /* the three metrics, split so the card can lead with THIS mode's */
  const dNum = d && typeof d.mid === 'number' ? d.mid : null;
  const bi = dNum != null && typeof d.avg_conc_ugm3 === 'number' ? bandIdx(d.avg_conc_ugm3) : null;
  const dotHtml = bi != null ? `<i class="wt-odot" style="background:${BAND_HEX[bi]}"></i>` : '';
  const bandHtml = bi != null ? `<span class="wt-oword" style="background:var(--w${bi})">${BAND_WORD[bi]} air</span>` : '';
  const timeHtml = mins != null ? `<b class="wt-oeta">${fmtMins(mins)}</b><span class="wt-oarr">· ${t('arriveAt', { t: clockLabel(Date.now() + e * 1000) })}</span>` : '';
  const airHtml = dNum != null
    ? `${dotHtml}<b class="wt-oeta">${doseTxt(dNum)}</b><span class="wt-obr">${t('breathed')}</span>${bandHtml}`
    : `<span class="wt-na">${t('compare_doseNA')}</span>`;
  const fLead = fuelLead(o);
  const fuelHtml = fLead != null ? `<b class="wt-oeta">${fLead}</b>` : `<span class="wt-na">${t('compare_fuelNA')}</span>`;
  const traf = typeof o.traffic_delay_s === 'number' && o.traffic_delay_s > 60
    ? `<span class="wt-otraf">+${Math.round(o.traffic_delay_s / 60)} min ${t('traffic')}</span>` : '';
  const fBits = fuelBits(o);
  const savedBit = fBits.find((x) => /^saves/.test(x));
  const fuelChip = (x) => x ? `<span class="wt-ofuel">${x}</span>` : '';
  /* every mode leads with its own metric, then the other two real
     numbers follow — the pick also carries its trade-off vs the other
     modes' picks where the server sent them */
  let lead, rest;
  if (S.mode === 'petrol_health') {
    lead = fuelHtml;
    rest = [timeHtml, traf, airHtml, savedBit ? `<span class="wt-ofuel hl">${savedBit}</span>` : ''].filter(Boolean);
  } else if (S.mode === 'time_health') {
    lead = timeHtml || `<span class="wt-na">${t('compare_doseNA')}</span>`;
    rest = [traf, airHtml, fuelChip(fBits[0])].filter(Boolean);
  } else {
    lead = airHtml;
    rest = [timeHtml, traf, fuelChip(fBits[0])].filter(Boolean);
  }
  /* legs detail when the wire carries it (transit rows): walk distance
     + how many times the ride changes */
  const nTr = num(o.transfers) != null ? num(o.transfers) : num(o.stations && o.stations.transfers);
  const meta = [baseLabel(o),
    o.distance_km != null ? `${o.distance_km} ${t('unitsKm')}` : null,
    viaOf(o),
    num(o.walk_m) != null && o.walk_m >= 50 ? t('walkBit', { d: fmtDist(o.walk_m / 1000) }) : null,
    nTr != null && nTr > 0 ? `${nTr} change${nTr > 1 ? 's' : ''}` : null,
    num(o.emissions && o.emissions.co2_kg) != null && o.emissions.co2_kg > 0
      ? `${amt(o.emissions.co2_kg)} kg CO₂` : null,
  ].filter(Boolean).join(' · ');
  const why = o.why ? String(o.why).trim() : '';
  const vs = pick && !other ? vsLine(o) : '';
  const tag = !pick ? otherPickTag(o) : '';
  const dl = vs ? '' : deltaLine(o);
  /* honest edge note: the router snapped a far point to the coverage
     edge — the line on the map really does start/end short. Say so on
     the card, never let '15 km' read as a 25 km trip. */
  const gaps = [];
  if (typeof o.from_gap_km === 'number' && o.from_gap_km >= 1) gaps.push(`route starts ${o.from_gap_km} ${t('unitsKm')} from your point`);
  if (typeof o.to_gap_km === 'number' && o.to_gap_km >= 1) gaps.push(`route ends ${o.to_gap_km} ${t('unitsKm')} before the destination`);
  const gapLine = gaps.join(' · ');
  return `<button class="wt-opt${sel ? ' sel' : ''}${other ? ' oth' : ''}" type="button" data-i="${i}" aria-pressed="${sel}">
    <span class="wt-selbg"></span>
    <span class="wt-well">${icon(vehicleGlyph(o.mode), 24, sel ? ACCENT : INK2)}</span>
    <span class="wt-omid">
      ${pick ? `<span class="wt-badge">${icon(md.glyph, 12, ACC_INK)}<span>${esc(md.badge)}</span></span>` : ''}
      ${tag ? `<span class="wt-otag">${esc(tag)}</span>` : ''}
      <span class="wt-otop">${lead}</span>
      ${rest.length ? `<span class="wt-oext">${rest.join('<span class="wt-osep">·</span>')}</span>` : ''}
      ${vs ? `<span class="wt-ovs">${esc(vs)}</span>` : ''}
      ${dl ? `<span class="wt-ovs">${esc(dl)}</span>` : ''}
      ${why ? `<span class="wt-owhy">${esc(why)}</span>` : ''}
      <span class="wt-ometa">${esc(meta)}</span>
      ${gapLine ? `<span class="wt-ogap">${esc(gapLine)}</span>` : ''}
    </span>
  </button>`;
}
function renderPlan() {
  setHalf(true);
  let mid = '';
  if (S.planning) {
    mid = `<div class="wt-list wt-plist" aria-busy="true">
      <div class="wt-prog"><i></i></div>
      <div class="wt-pstat">${t('checkingRoutes')}</div>
      <div class="wt-skel wt-skc" aria-hidden="true"><i></i><i></i></div>
    </div>`;
  } else if (S.planErr) {
    const title = S.planErr === 'outside' ? t('plan_outside_title') : S.planErr === 'noroutes' ? t('noRoutes') : t('plan_failed');
    const body = S.planErr === 'outside' ? t('plan_outside_body') : '';
    const cta = S.planErr === 'outside' ? t('plan_outside_cta') : t('plan_retry');
    mid = `<div class="wt-state">${icon('warn', 40, INK4)}<span class="wt-st-t">${esc(title)}</span>
      ${body ? `<span class="wt-st-s">${esc(body)}</span>` : ''}
      <button class="wt-retry" type="button" data-act="${S.planErr === 'outside' ? 'edit' : 'retry'}">${esc(cta)}</button></div>`;
  } else if (S.plan && S.view) {
    const v = S.view;
    mid = `<div class="wt-list wt-plist">
      ${S.partial ? '<div class="wt-notice"><span>a few routes timed out — showing what we have</span></div>' : ''}
      ${v.prim.map((x) => optionCard(x.o, x.i, false)).join('')}
      ${v.other.length ? `<button class="wt-oth-t${S.showOther ? ' open' : ''}" type="button" data-act="other" aria-expanded="${!!S.showOther}"><span>${t('otherWays')}</span>${CHEV_SVG(INK3, 16)}</button>` : ''}
      ${S.showOther ? v.other.map((x) => optionCard(x.o, x.i, true)).join('') : ''}
    </div>`;
  }
  const md = modeDef(S.mode);
  /* the pill stays short: fuel + ride ("petrol car") — the year lives in the wizard */
  const vehTxt = S.tripVeh ? vehicleLabel({ cls: S.tripVeh.cls, fuel: S.tripVeh.fuel }) : t('vehicle_likeYours');
  const inCls = S._anim !== 'plan' ? ' wt-in' : ''; S._anim = 'plan';
  S.body.innerHTML = `<div class="wt${inCls}">
    ${tripRow()}
    <div class="wt-pills">
      <button class="wt-pill wt-pmode" type="button" data-act="mode">${icon(md.glyph, 16, ACCENT)}<span>${esc(md.title)}</span>${CHEV_SVG(INK3, 14)}</button>
      <button class="wt-pill" type="button" data-act="veh">${icon(vehicleGlyph(S.tripVeh && S.tripVeh.cls), 16, INK2)}<span>${esc(vehTxt)}</span>${CHEV_SVG(INK3, 14)}</button>
    </div>
    ${mid}
    <div class="wt-foot"><button class="wt-go" type="button" data-act="go" ${S.plan && S.view ? '' : 'disabled'}>${t('startJourney')}</button></div>
  </div>`;
  const root = S.body.querySelector('.wt');
  bindTrip(root);
  const retry = root.querySelector('[data-act="retry"]');
  if (retry) retry.addEventListener('click', () => plan());
  const edit = root.querySelector('[data-act="edit"]');
  if (edit) edit.addEventListener('click', () => { S.armed = 'to'; S.q = ''; S.results = null; S.final = true; renderSearch(true); });
  root.querySelector('[data-act="mode"]').addEventListener('click', showModes);
  root.querySelector('[data-act="veh"]').addEventListener('click', () => openVehicle('edit'));
  const oth = root.querySelector('[data-act="other"]');
  if (oth) oth.addEventListener('click', () => {
    S.showOther = !S.showOther;
    const sc = root.querySelector('.wt-plist');
    const top = sc ? sc.scrollTop : 0;
    renderPlan(); paintRoutes(false);
    const sc2 = S.body.querySelector('.wt-plist');
    if (sc2) sc2.scrollTop = top;
  });
  root.querySelectorAll('.wt-opt').forEach((b) => b.addEventListener('click', () => {
    S.sel = +b.dataset.i;
    root.querySelectorAll('.wt-opt').forEach((x) => {
      const on = x === b;
      x.classList.toggle('sel', on);
      x.setAttribute('aria-pressed', on);
      const w = x.querySelector('.wt-well svg');
      if (w) w.setAttribute('fill', on ? ACCENT : INK2);
    });
    paintRoutes();
  }));
  const go = root.querySelector('[data-act="go"]');
  if (go) go.addEventListener('click', function startGo() {
    if (!S.plan) return;
    const o = S.plan.options[S.sel];
    if (!o) return;
    if (A.screensReady && A.screensReady.journey) {
      A.show('journey', { option: o, from: S.from, to: S.to,
        options: S.plan && S.plan.options,
        mode: S.mode, vehicle: S.tripVeh ? S.tripVeh.cls : famOf(o),
        field_age_s: S.plan && S.plan.field && S.plan.field.age_s });
      return;
    }
    /* journey.js may still be loading — or may have failed outright
       (flaky radio, a 404). One real retry: re-inject the tag and say
       honestly whether it landed; no toast that lies forever. */
    if (S.journeyRetrying) { A.toast('journey is still landing'); return; }
    S.journeyRetrying = true;
    A.toast('journey is still landing');
    const s = document.createElement('script');
    s.src = `journey.js?retry=${Date.now()}`;
    s.onload = () => {
      S.journeyRetrying = false;
      if (A.screensReady && A.screensReady.journey) startGo();
      else A.toast("journey couldn't start — try again");
    };
    s.onerror = () => {
      S.journeyRetrying = false;
      A.toast("journey couldn't load — check the connection");
    };
    document.head.appendChild(s);
  });
}

/* ── map: route lines (picked forest on paper casing, the rest a quiet
   hairline), the two ends, live jams of the picked route, live flow ── */
function trafficLayer(on) {
  const tr = A.map && A.map.traffic;
  if (!tr || (!on && !S.trafficOn)) return;
  S.trafficOn = !!on;
  try {
    const r = typeof tr === 'function'
      ? (tr.length >= 2 ? tr(null, !!on) : tr(!!on))
      : tr && typeof tr.show === 'function' ? (on ? tr.show() : tr.hide()) : null;
    if (r && typeof r.catch === 'function') r.catch(() => {});
  } catch (e) { /* the overlay is optional — the routes stand alone */ }
}
function pinEnds() {
  if (!A.map || !A.map.pin) return;
  const ok = (p) => p && isFinite(+p.lon) && isFinite(+p.lat);
  if (ok(S.from)) A.map.pin('wt-a', +S.from.lon, +S.from.lat, '<i class="wt-pa"></i>', 'wt-endpin');
  if (ok(S.to)) A.map.pin('wt-b', +S.to.lon, +S.to.lat, '<i class="wt-pb"></i>', 'wt-endpin');
}
function clearJams() {
  if (!S || !A.map) return;
  (S.jamIds || []).forEach((id) => A.map.unpin(id));
  S.jamIds = [];
}
function paintJams(o) {
  clearJams();
  const jams = o && Array.isArray(o.jams) ? o.jams : [];
  jams.slice(0, 10).forEach((j, k) => {
    if (!j || !isFinite(+j.lat) || !isFinite(+j.lon)) return;
    const ds = Number(j.delay_s);
    if (!(ds >= 30)) return;
    const id = `wt-jam${k}`;
    A.map.pin(id, j.lon, j.lat, `<div class="wt-jam"><i></i><span>+${Math.max(1, Math.round(ds / 60))} min</span></div>`, 'wt-jampin');
    S.jamIds.push(id);
  });
}
function clearMapExtras() {
  if (!S || !A.map) return;
  clearJams();
  A.map.unpin('wt-a'); A.map.unpin('wt-b');
  trafficLayer(false);
}
/* the padding that lands the route inside the VISIBLE map: on desktop
   the sheet is a right rail (460px, top 38% when halved) so the camera
   must come off the right edge; on phones the sheet is bottom-anchored
   and only its height matters */
function fitPad() {
  const w = window.innerWidth, h = window.innerHeight;
  const sh = S.el && S.el.querySelector('.sheet');
  const r = sh ? sh.getBoundingClientRect() : null;
  if (w >= 720) {
    return { top: 56, left: 40, right: Math.round((r ? r.width : 460) + 40), bottom: 60 };
  }
  const shH = r && r.height ? r.height : Math.round(h * 0.62);
  return { top: 76, left: 32, right: 32, bottom: Math.round(Math.min(shH, h * 0.7) + 18) };
}
/* fit, after the map is ready, in BOTH engines: MapLibre takes the
   padding object as-is; Leaflet wants paddingTopLeft/BottomRight —
   A.map.fit's scalar-only pad would NaN on an object, so basic mode
   drives flyToBounds itself */
function fitRoute(g) {
  if (!g || !A.map || !A.map.ready) return;
  const p = fitPad();
  A.map.ready((m) => {
    const coords = g && g.type === 'Feature' ? g.geometry.coordinates
      : g && g.type === 'LineString' ? g.coordinates : g;
    if (!coords || !coords.length) return;
    const basic = A.map.basemap === 'leaflet';
    try {
      if (basic && window.L && typeof m.flyToBounds === 'function') {
        m.flyToBounds(window.L.latLngBounds(coords.map((c) => [c[1], c[0]])), {
          paddingTopLeft: window.L.point(p.left, p.top),
          paddingBottomRight: window.L.point(p.right, p.bottom),
          duration: 0.85,
        });
        return;
      }
      if (!basic && window.maplibregl && typeof m.fitBounds === 'function') {
        const b = coords.reduce((bb, c) => bb.extend(c),
          new window.maplibregl.LngLatBounds(coords[0], coords[0]));
        m.fitBounds(b, { padding: p, duration: 850, essential: true });
        return;
      }
    } catch (e) { /* fall through to the shared fit */ }
    A.map.fit(g, basic ? Math.max(p.top, p.right, p.bottom, p.left) : p);
  });
}
function paintRoutes(fit) {
  if (!S || !S.plan || !S.view || !A.map) return;
  const opts = S.plan.options;
  const show = new Set(S.view.prim.map((x) => x.i));
  if (S.showOther) S.view.other.forEach((x) => show.add(x.i));
  show.add(S.sel);
  for (const id of S.paintedIds || []) if (!show.has(id)) A.map.hideRoute(`wt${id}`);
  const order = [...show].filter((i) => i !== S.sel).concat([S.sel]);
  const wasSegs = new Set(S.segIds || []), segIds = [];
  for (const i of order) {
    const o = opts[i];
    const g = o && (o.geometry || o.route_geojson);
    if (!g) continue;
    const picked = i === S.sel;
    /* the picked ride carries its band strip (the server's per-stretch
       PM2.5); the rest sit quiet. The 4th arg is the map lane's opts bag
       ({ghost}) — the current (id, g, segments) signature ignores it, so
       the quiet paint below still does the de-emphasis either way */
    const segs = picked && Array.isArray(o.segments) && o.segments.length ? o.segments : null;
    /* MapLibre only updates the base line when segments go away — a stale
       '-segs-line' would keep colouring the old pick. Drop the route and
       redraw clean (Leaflet already re-creates on every showRoute). */
    if (!segs && wasSegs.has(i)) A.map.hideRoute(`wt${i}`);
    A.map.showRoute(`wt${i}`, g, segs, picked ? null : { ghost: true });
    if (segs) segIds.push(i);
    A.map.ready((m) => {
      const line = `route-wt${i}-line`, cas = `route-wt${i}-casing`, sl = `route-wt${i}-segs-line`;
      if (m.getLayer && m.getLayer(line)) {
        m.setPaintProperty(line, 'line-color', picked ? ACCENT : MAP_QUIET);
        m.setPaintProperty(line, 'line-opacity', picked ? 1 : 0.5);
        m.setPaintProperty(line, 'line-width', ['interpolate', ['linear'], ['zoom'], 9, picked ? 4 : 1.8, 14, picked ? 7.5 : 3]);
      }
      if (m.getLayer && m.getLayer(cas)) {
        m.setPaintProperty(cas, 'line-color', picked ? PAPER : MAP_QUIET);
        m.setPaintProperty(cas, 'line-opacity', picked ? 1 : 0);
        m.setPaintProperty(cas, 'line-width', ['interpolate', ['linear'], ['zoom'], 9, picked ? 7 : 2.5, 14, picked ? 12 : 4]);
      }
      if (m.getLayer && m.getLayer(sl)) {
        m.setPaintProperty(sl, 'line-opacity', picked ? 0.95 : 0.35);
      }
      /* the strip rides above the plain line — move it last or the base
         colour covers the band paint */
      if (picked) {
        try {
          if (m.getLayer(cas)) m.moveLayer(cas);
          if (m.getLayer(line)) m.moveLayer(line);
          if (m.getLayer(sl)) m.moveLayer(sl);
        } catch (e) { /* order is cosmetic */ }
      }
    });
  }
  S.segIds = segIds;
  S.paintedIds = [...show];
  pinEnds();
  paintJams(opts[S.sel]);
  trafficLayer(true);
  /* fit on the picked route's line; a row with no geometry still centers
     the trip — the two end pins carry the framing */
  let g = opts[S.sel] && (opts[S.sel].geometry || opts[S.sel].route_geojson);
  if (!g && S.from && S.to) g = [[+S.from.lon, +S.from.lat], [+S.to.lon, +S.to.lat]];
  if (g && fit !== false) {
    /* paints and re-renders land in bursts — one fit per burst, on the
       last geometry, once the sheet's slide has had a beat to settle */
    clearTimeout(S._fitT);
    S._fitT = setTimeout(() => {
      S._fitT = 0;
      if (S && S.phase === 'plan' && A.current() === 'whereto') fitRoute(g);
    }, 140);
  }
}

/* ═══════════════ VEHICLE — VehicleSheet.tsx twin ═══════════════════
   ctx 'trip': the step between modes and routes — one tap on the ride
   you saved goes straight on; a new ride asks fuel + year only.
   ctx 'edit': from the routes pill — the full wizard incl. PUC. */
function openVehicle(ctx) {
  S.phase = 'veh';
  S.pseq++;
  clearMapExtras(); A.map.hideAllRoutes(); S.paintedIds = [];
  setHalf(false);
  const v = S.veh;
  S.wiz = { ctx: ctx || 'edit', step: 'cls', cls: v ? v.cls : null, fuel: v ? v.fuel : null, year: v ? v.year : null, bs: v && v.puc ? v.puc.bs : null, puc: v && v.puc ? { ...v.puc } : {} };
  renderVehicle();
}
const wizSteps = () => {
  /* two taps at most: the ride, then its fuel. No year / PUC pages —
     without them the engine uses the Delhi fleet average, said plainly */
  const s = ['cls'];
  if (needsFuel(S.wiz.cls)) s.push('fuel');
  return s;
};
const stepQ = { cls: 'vehicleQ1', fuel: 'vehicleQ2', year: 'vehicleQ3', puc: 'puc_title' };
function renderVehicle() {
  const w = S.wiz;
  const steps = wizSteps();
  const idx = Math.max(0, steps.indexOf(w.step));
  let cards = '';
  if (w.step === 'cls') {
    cards = CLASS_GROUPS.map(([gk, items]) => `
      <div class="wt-vgrp">${t(gk)}</div>
      <div class="wt-vgrid">${items.map((c) => `
        <button class="wt-vcard${w.cls === c ? ' on' : ''}" type="button" data-k="${c}" aria-pressed="${w.cls === c}">
          <span class="wt-vg">${icon(vehicleGlyph(c), 24, w.cls === c ? ACCENT : INK2)}</span>
          <span class="wt-vcard-mid"><span class="wt-vt">${t('vehicle_' + c)}</span><span class="wt-vcap">${t(CLS_CAP[c])}</span></span>
        </button>`).join('')}</div>`).join('');
  } else if (w.step === 'fuel') {
    cards = `<div class="wt-vgrid">${fuelsFor(w.cls).map((f) => `
      <button class="wt-vcard${w.fuel === f ? ' on' : ''}" type="button" data-k="${f}" aria-pressed="${w.fuel === f}">
        <span class="wt-vcard-mid"><span class="wt-vt">${t(FUEL_KEY[f])}</span><span class="wt-vcap">${t(FUEL_CAP[f])}</span></span>
      </button>`).join('')}</div>`;
  } else if (w.step === 'year') {
    cards = YEAR_ORDER.map((y) => `
      <button class="wt-vcard wt-vline${w.year === y ? ' on' : ''}" type="button" data-k="${y}" aria-pressed="${w.year === y}">
        <span class="wt-vcard-mid"><span class="wt-vt">${t(YEAR_KEY[y])}</span>${y === 'not_sure' ? `<span class="wt-vcap">${t('veh_cap_y_notsure')}</span>` : ''}</span>
      </button>`).join('');
  } else if (w.step === 'puc') {
    const fields = (w.fuel === 'diesel')
      ? [['smoke_pct', 'puc_smoke', 'puc_smokeHint']]
      : [['co_pct', 'puc_co', 'puc_coHint'], ['hc_ppm', 'puc_hc', 'puc_hcHint']];
    cards = `<div class="wt-vgrp">${t('puc_bsQ')}</div>
      <div class="wt-vgrid wt-vg3">${BS_STAGES.map(([bs, k]) => `
        <button class="wt-vcard${w.bs === bs ? ' on' : ''}" type="button" data-bs="${bs}" aria-pressed="${w.bs === bs}">
          <span class="wt-vcard-mid"><span class="wt-vt">${t(k)}</span></span>
        </button>`).join('')}</div>
      <div class="wt-vfields">${fields.map(([f, lk, hk]) => `
        <label class="wt-vfield">
          <span class="wt-vfl">${t(lk)}</span>
          <input class="wt-vin" type="text" inputmode="decimal" maxlength="6" data-f="${f}" value="${w.puc[f] != null ? esc(w.puc[f]) : ''}">
          <span class="wt-vfh">${t(hk)}</span>
        </label>`).join('')}</div>`;
  }
  const inCls = S._anim !== 'veh' ? ' wt-in' : ''; S._anim = 'veh';
  S.body.innerHTML = `<div class="wt${inCls}">
    ${tripRow()}
    <div class="wt-vhead">
      <span class="wt-vq">${t(stepQ[w.step])}</span>
      ${steps.length > 1 ? `<span class="wt-dots">${steps.map((s, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</span>` : ''}
    </div>
    <div class="wt-list">${cards}</div>
    <div class="wt-vfoot">
      <button class="wt-vfb" type="button" data-act="back">${t('vehicleQ_back')}</button>
      <span class="wt-vfr">
        ${w.step === 'puc' ? `<button class="wt-vfb wt-vsave" type="button" data-act="save">${t('receipt_save')}</button>` : ''}
        <button class="wt-vfb" type="button" data-act="skip">${w.step === 'puc' ? t('puc_skip') : t('vehicleQ_skip')}</button>
      </span>
    </div>
  </div>`;
  bindVehicle();
}
function bindVehicle() {
  const root = S.body.querySelector('.wt'), w = S.wiz;
  const q = (s) => root.querySelector(s);
  bindTrip(root);
  const goStep = (s) => { w.step = s; renderVehicle(); };
  const toRoutes = () => { S.vehChosen = true; plan(); };
  const prevStep = () => {
    const steps = wizSteps(), i = steps.indexOf(w.step);
    if (i > 0) goStep(steps[i - 1]);
    else if (w.ctx === 'trip') showModes();
    else if (S.plan) { S.phase = 'plan'; renderPlan(); paintRoutes(); }
    else plan();
  };
  const done = (savePuc) => {
    const p = { cls: w.cls, fuel: needsFuel(w.cls) ? w.fuel : null, year: needsYear(w.cls) ? w.year : null };
    if (savePuc && (w.bs || Object.keys(w.puc).length)) {
      const puc = {};
      if (w.bs) puc.bs = w.bs;
      for (const f of ['co_pct', 'hc_ppm', 'smoke_pct']) {
        const v = parseFloat(w.puc[f]);
        if (!isNaN(v)) puc[f] = v;
      }
      if (Object.keys(puc).length) p.puc = puc;
    } else if (!savePuc && S.veh && S.veh.puc && S.veh.cls === p.cls) p.puc = S.veh.puc;
    S.veh = p;
    S.tripVeh = p;
    A.store.set(K_VEH, p);
    S.plans = {};                  /* a new ride: cached mode answers were for another vehicle */
    toRoutes();
  };
  root.querySelectorAll('[data-act="skip"]').forEach((b) => b.addEventListener('click', () => {
    if (w.step === 'puc') { done(false); return; }
    S.tripVeh = null;            /* a typical Delhi ride — the server's fleet prior */
    S.plans = {};
    toRoutes();
  }));
  if (q('[data-act="back"]')) q('[data-act="back"]').addEventListener('click', prevStep);
  if (q('[data-act="save"]')) q('[data-act="save"]').addEventListener('click', () => done(true));
  root.querySelectorAll('.wt-vcard').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.bs) { w.bs = w.bs === b.dataset.bs ? null : b.dataset.bs; renderVehicle(); return; }
    const k = b.dataset.k;
    if (w.step === 'cls') {
      const same = S.veh && S.veh.cls === k;
      w.cls = k;
      if (!same) { w.fuel = null; w.year = null; w.puc = {}; w.bs = null; }
      /* the saved ride, already described → straight on (trip ctx) */
      const complete = !needsFuel(k) || w.fuel;
      if (w.ctx === 'trip' && same && complete) { done(false); return; }
      const next = wizSteps()[1];
      if (next) goStep(next); else done(false);
      return;
    }
    const steps = wizSteps();
    const nxt = steps[steps.indexOf(w.step) + 1];
    if (w.step === 'fuel') w.fuel = k;
    if (w.step === 'year') w.year = k;
    if (nxt) goStep(nxt); else done(false);
  }));
  root.querySelectorAll('.wt-vin').forEach((inp) => inp.addEventListener('input', () => {
    S.wiz.puc[inp.dataset.f] = inp.value;
  }));
}

/* ═══════════════ mount ═══════════════════════════════════════════ */
A.screen('whereto', {
  mount(elm, params) {
    const chrome = A.sheetChrome(elm, 'where to');
    /* no title row — the back chevron lives in the from/to card */
    const title = chrome.sheetEl.querySelector('.sheet-title');
    if (title) title.remove();
    const m0 = loadJ(K_MODE, null);
    S = {
      el: elm, chrome, body: chrome.body,
      phase: 'search', armed: 'to', armedPin: null,
      from: null, to: null, q: '', results: null, final: true, seq: 0, cur: null, retired: [], guard: 0,
      saveFor: null, notice: null,
      locating: false, _geoWait: null, _geoNoted: false, fromManual: false,
      _geoStop: null, _geoEvt: null, _fitT: 0,
      saved: loadJ(K_SAVED, {}) || {},
      recents: (loadJ(K_RECENT, []) || []).map((r) => ({ name: r.name || r.label, sub: r.sub, lat: r.lat, lon: r.lon })).filter((r) => r.name != null && r.name !== 'dropped pin' && r.name !== t('yourLocation')),
      veh: loadJ(K_VEH, null),
      mode: MODES.some((m) => m.id === m0) ? m0 : 'health_max',
      modeChosen: false, vehChosen: false, tripVeh: null,
      plan: null, view: null, planning: false, planErr: null, sel: 0, pseq: 0, partial: null, plans: {},
      showOther: false, paintedIds: [], segIds: [], jamIds: [], trafficOn: false,
      wiz: null, _tapOff: null, _anim: null,
    };
    if (S.veh && !S.veh.cls) S.veh = null;
    S.tripVeh = S.veh;
    params = params || {};
    /* From = your live spot by default; To starts empty — "where to?".
       A caller-passed From counts as deliberate (manual) for auto-fill. */
    if (params.from) { S.from = params.from; S.fromManual = true; }
    if (params.to) S.to = params.to;
    S.armed = params.arm || 'to';
    if (S.from && S.to) showModes();
    else renderSearch(true);
    kickFromGeo();                 /* locating starts the moment the composer opens */
    A.map.setFieldVisible(false);
    return () => {
      disarmPin();
      cancelLive();
      if (S) S.pseq++;
      clearMapExtras();
      document.querySelectorAll('.wt-pinbar').forEach((x) => x.remove());
      A.map.hideAllRoutes();
      if (S) {
        clearTimeout(S._fitT); S._fitT = 0;
        if (S._geoStop) { try { S._geoStop(); } catch (e) {} S._geoStop = null; }
        if (S._geoEvt) { document.removeEventListener('alive:location', S._geoEvt); S._geoEvt = null; }
      }
      S = null;
    };
  },
  show() { if (S && S.phase === 'plan' && S.plan) { setHalf(true); paintRoutes(); } },
  hide() { if (S) clearMapExtras(); },
});
})();
