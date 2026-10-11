/* Alive webapp — Trips, the dose ledger. Pixel twin of
   Mobile/src/screens/LedgerScreen.tsx over the web trip store
   (journey.js 'journey.history' records). Same rows, same day headers,
   same expander, same honest omissions: emission/band/donation seams
   render only when a real value exists on the record. Strings verbatim
   from the en table; numbers tabular Satoshi; bands only at details
   level. Registers A.screen('ledger') — the home doors auto-render it
   once index.html includes this file + ledger.css (coordinator wires). */
(() => {
'use strict';

const HIST_KEY = 'journey.history';
const CIG_UG = 316;

/* ── strings (en table, verbatim) ────────────────────────────────── */
const S = {
  sidebarTrips: 'Trips', sidebarToday: 'Today', ledgerYesterday: 'yesterday',
  tripsBreathed: 'smoke you breathed', doseUg: '{n} µg',
  tripsDoseBand: 'about {lo}–{hi} µg', tripsDoseDetail: 'about {n} µg of smoke you breathed',
  tripsCigs: '{n} cigarettes', tripsPutOut: 'smoke your ride put out',
  tripsOutDetail: 'about {n} kg put out', tripsSavedVsUg: '{n} µg less than the smokiest way',
  ledgerDonated: 'shared anonymously', ledgerDeleteTrip: 'delete this trip',
  ledgerDeleteAll: 'delete all trips', ledgerDeleteAllTitle: 'delete all trips?',
  ledgerDeleteAllBody: 'every saved trip is removed from this phone — this can\'t be undone',
  cancel: 'cancel', deleteConfirmYes: 'delete',
  tripsCount: '{n} trips', tripsCountOne: '{n} trip',
  breathed: 'breathed', putOut: 'put out', unitsKg: 'kg',
  ledgerAllTime: 'all saved trips', ledgerEstNote: 'estimates — honest ranges, never fake-exact',
  ledgerLast7: 'last 7 days', tripsEmpty: 'no trips yet',
  ledgerEmptyHint: 'finish a trip and its smoke numbers land here',
  ledgerPrivacy: 'trips stay on your phone', cigsTrace: 'a trace of a cigarette',
  nav_kg: '{n} kg', a11yBack: 'back', ledgerShowTrip: 'show trip details',
  mode_carAC: 'Car (AC)', mode_carOpen: 'Car (windows down)', mode_bike: 'Bike / scooter',
  mode_bus: 'Bus', mode_auto: 'Auto-rickshaw', mode_metroWalk: 'Metro + walk',
  mode_cycle: 'Bicycle', mode_walk: 'On foot',
  mode_approx: ' (roughly)', mode_leastSmoke: ' · least smoky way',
  mode_leastSmokeAlt: ' · least smoky option {n}', mode_altN: ' · alt {n}',
  placeCurrentLocation: 'your location', placeCentralDelhi: 'central Delhi',
  placeDroppedPin: 'dropped pin',
};
const t = (k, vars) => { let s = S[k] ?? k; if (vars) for (const [a, v] of Object.entries(vars)) s = s.replaceAll(`{${a}}`, String(v)); return s; };

/* ── formatters (strings.ts + LedgerScreen ports, en) ────────────── */
const IST_MS = 330 * 60 * 1000;
const clockLabel = (ts) => {
  const d = new Date(ts + IST_MS);
  const h24 = d.getUTCHours(), min = d.getUTCMinutes();
  return `${((h24 + 11) % 12) + 1}:${String(min).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
};
const dayLabel = (ts) => new Date(ts).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const doseUgRound = (ug) => ug >= 10 ? Math.round(ug) : Math.round(ug * 10) / 10;
const fmtUg = (ug) => `${doseUgRound(ug)}`;
const fmtDoseUg = (ug) => `≈ ${fmtUg(ug)}`;
const fmtKg = (kg) => kg >= 0.1 ? kg.toFixed(1) : kg.toFixed(2);
const cigLine = (ug) => { const c = ug / CIG_UG; return c >= 0.01 ? t('tripsCigs', { n: `≈ ${c.toFixed(2)}` }) : t('cigsTrace'); };
const cigTone = (ug) => { const c = ug / CIG_UG; return c >= 1 ? '#C05F3A' : c >= 0.3 ? '#CF8A50' : '#4A4E57'; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* modeLabel — MODE_BASE/BASES port (en faces only on web) */
const MODE_BASE = {
  car: { en: 'Car (AC)', key: 'mode_carAC' }, car_open: { en: 'Car (windows down)', key: 'mode_carOpen' },
  bike: { en: 'Bike / scooter', key: 'mode_bike' }, bus: { en: 'Bus', key: 'mode_bus' },
  auto: { en: 'Auto-rickshaw', key: 'mode_auto' }, 'metro+walk': { en: 'Metro + walk', key: 'mode_metroWalk' },
  cycle: { en: 'Bicycle', key: 'mode_cycle' }, walk: { en: 'On foot', key: 'mode_walk' },
};
const BASES = Object.values(MODE_BASE).sort((a, b) => b.en.length - a.en.length);
function modeLabel(mode, label) {
  const byMode = MODE_BASE[mode];
  const b = byMode && String(label).startsWith(byMode.en) ? byMode
    : BASES.find((x) => label === x.en || String(label).startsWith(x.en + ' ') || String(label).startsWith(x.en + '('));
  if (!b) return label;
  const rest = String(label).slice(b.en.length);
  let suffix = rest;
  if (rest.startsWith(' (approx')) suffix = t('mode_approx');
  else {
    const alt = rest.match(/^ · (?:least-smoke alt|least smoky option) (\d+)$/);
    if (alt) suffix = t('mode_leastSmokeAlt', { n: alt[1] });
    else if (rest === ' · least-smoke rd' || rest === ' · least smoky way') suffix = t('mode_leastSmoke');
    else { const a = rest.match(/^ · alt (\d+)$/); if (a) suffix = t('mode_altN', { n: a[1] }); }
  }
  return t(b.key) + suffix;
}
const PLACE_SENTINEL = { 'your location': 'placeCurrentLocation', 'Dropped pin': 'placeDroppedPin', 'central Delhi': 'placeCentralDelhi' };
const placeNameLabel = (name) => { const k = PLACE_SENTINEL[name]; return k ? t(k) : name; };

const ICONS = {
  "pin": ["M480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 79q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 45-17.5 94.5t-51 103Q698-301 648-244T533-127q-11 10-25 15t-28 5Zm0-453Zm0 80q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z"],
  "clock": ["M520-496v-144q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v159q0 8 3 15.5t9 13.5l132 132q11 11 28 11t28-11q11-11 11-28t-11-28L520-496ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"],
  "info": ["M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"],
  "chevron": ["M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z"],
  "trash": ["M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM400-280q17 0 28.5-11.5T440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280Zm160 0q17 0 28.5-11.5T600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280ZM280-720v520-520Z"],
  "dust": ["M460-160q-32 0-59.5-16T356-220q-11-20-.5-40t32.5-20q13 0 23 8t18 18q5 7 13.5 10.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H120q-17 0-28.5-11.5T80-360q0-17 11.5-28.5T120-400h340q50 0 85 35t35 85q0 50-35 85t-85 35ZM120-560q-17 0-28.5-11.5T80-600q0-17 11.5-28.5T120-640h500q25 0 42.5-17.5T680-700q0-25-17.5-42.5T620-760q-16 0-30 7.5T568-731q-7 12-17 21.5t-24 9.5q-20 0-32.5-15t-6.5-32q14-42 50.5-67.5T620-840q58 0 99 41t41 99q0 58-41 99t-99 41H120Zm678 308q-20 9-39-2.5T740-288q0-14 9.5-23.5T771-328q14-8 21.5-22t7.5-30q0-25-17.5-42.5T740-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h620q58 0 99 41t41 99q0 42-22 76.5T798-252Z"],
  "close": ["M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z"],
  "flag": ["M280-400v240q0 17-11.5 28.5T240-120q-17 0-28.5-11.5T200-160v-600q0-17 11.5-28.5T240-800h287q14 0 25 9t14 23l10 48h184q17 0 28.5 11.5T800-680v320q0 17-11.5 28.5T760-320H553q-14 0-25-9t-14-23l-10-48H280Zm306 0h134v-240H543q-14 0-25-9t-14-23l-10-48H280v240h257q14 0 25 9t14 23l10 48Zm-86-160Z"],
  "car@fill": ["M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h410q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm68 240q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Z"],
  "cab@fill": ["M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h85v-40q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800v40h85q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm68 240q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Z"],
  "bus@fill": ["M320-200v20q0 25-17.5 42.5T260-120q-25 0-42.5-17.5T200-180v-62q-18-20-29-44.5T160-340v-380q0-83 77-121.5T480-880q172 0 246 37t74 123v380q0 29-11 53.5T760-242v62q0 25-17.5 42.5T700-120q-25 0-42.5-17.5T640-180v-20H320Zm-80-360h480v-120H240v120Zm100 240q25 0 42.5-17.5T400-380q0-25-17.5-42.5T340-440q-25 0-42.5 17.5T280-380q0 25 17.5 42.5T340-320Zm280 0q25 0 42.5-17.5T680-380q0-25-17.5-42.5T620-440q-25 0-42.5 17.5T560-380q0 25 17.5 42.5T620-320Z"],
  "metro@fill": ["M80-160v-446q0-85 44-147.5T248-848q54-21 115-26.5t117-5.5q56 0 117 5.5T712-848q80 32 124 94.5T880-606v446q0 33-23.5 56.5T800-80H160q-33 0-56.5-23.5T80-160Zm220-280v-160h360v160H300Zm320 140q-17 0-28.5-11.5T580-340q0-17 11.5-28.5T620-380q17 0 28.5 11.5T660-340q0 17-11.5 28.5T620-300Zm-280 0q-17 0-28.5-11.5T300-340q0-17 11.5-28.5T340-380q17 0 28.5 11.5T380-340q0 17-11.5 28.5T340-300Zm84 80h110l51 51q5 5 10.5 7t11.5 2q20 0 27.5-19t-6.5-33l-10-10q44-6 73-39.5t29-78.5v-260q0-78-70-99t-170-21q-91 0-165.5 21T240-600v260q0 45 29 78.5t73 39.5l-11 11q-14 14-6.5 32.5T352-160q6 0 11-2t10-7l51-51Z"],
  "bike@fill": ["M280-200q-50 0-85-35t-35-85h-40q-17 0-28.5-11.5T80-360v-80q0-66 47-113t113-47h80q33 0 56.5 23.5T400-520v120h140l140-174v-106h-80q-17 0-28.5-11.5T560-720q0-17 11.5-28.5T600-760h80q33 0 56.5 23.5T760-680v106q0 14-4.5 26.5T743-524L604-350q-11 14-28 22t-35 8H400q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T320-320h-80q0 17 11.5 28.5T280-280Zm80-360H240q-17 0-28.5-11.5T200-680q0-17 11.5-28.5T240-720h120q17 0 28.5 11.5T400-680q0 17-11.5 28.5T360-640Zm400 440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T800-320q0-17-11.5-28.5T760-360q-17 0-28.5 11.5T720-320q0 17 11.5 28.5T760-280Z"],
  "auto@fill": ["M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54Z"],
  "walk@fill": ["M436-364 371-72q-3 14-14.5 23T330-40q-20 0-32-15t-8-34l102-515-72 28v96q0 17-11.5 28.5T280-440q-17 0-28.5-11.5T240-480v-122q0-12 6.5-21.5T264-638l178-76q14-6 29.5-7t29.5 4q14 5 26.5 14t20.5 23l40 64q13 20 30.5 38t39.5 31q14 8 31 14.5t34 9.5q16 3 26.5 14.5T760-480q0 17-12 28t-29 9q-56-8-100.5-35T541-543l-25 123 72 68q6 6 9 13.5t3 15.5v243q0 17-11.5 28.5T560-40q-17 0-28.5-11.5T520-80v-220l-84-64Zm104-376q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Z"],
  "cycle@fill": ["M620-740q-33 0-56.5-23.5T540-820q0-33 23.5-56.5T620-900q33 0 56.5 23.5T700-820q0 33-23.5 56.5T620-740ZM432-540l66 69q11 11 16.5 25t5.5 30v176q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-160L312-512q-14-12-19-25t-5-31q0-18 5.5-30.5T312-624l112-112q13-13 27.5-18.5T484-760q18 0 32.5 5.5T544-736l76 76q21 21 47 35.5t58 20.5q17 3 28 15t11 29q0 17-12 28t-29 9q-49-7-90-28t-73-53l-32-32-96 96Zm-232 60q85 0 142.5 57.5T400-280q0 85-57.5 142.5T200-80q-85 0-142.5-57.5T0-280q0-85 57.5-142.5T200-480Zm0 340q57 0 98.5-41.5T340-280q0-57-41.5-98.5T200-420q-57 0-98.5 41.5T60-280q0 57 41.5 98.5T200-140Zm560-340q85 0 142.5 57.5T960-280q0 85-57.5 142.5T760-80q-85 0-142.5-57.5T560-280q0-85 57.5-142.5T760-480Zm0 340q57 0 98.5-41.5T900-280q0-57-41.5-98.5T760-420q-57 0-98.5 41.5T620-280q0 57 41.5 98.5T760-140Z"],
  "flag@fill": ["M280-400v240q0 17-11.5 28.5T240-120q-17 0-28.5-11.5T200-160v-600q0-17 11.5-28.5T240-800h287q14 0 25 9t14 23l10 48h184q17 0 28.5 11.5T800-680v320q0 17-11.5 28.5T760-320H553q-14 0-25-9t-14-23l-10-48H280Z"],
  "erick@fill": ["M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54Z"],
};
const icon = (name, color, size, filled) => {
  const d = (filled && ICONS[name + '@fill']) || ICONS[name];
  if (!d) return '';
  return `<svg width="${size}" height="${size}" viewBox="0 -960 960 960" aria-hidden="true">` +
    d.map((p) => `<path d="${p}" fill="${color}"/>`).join('') + '</svg>';
};
const vehicleGlyph = (v) => {
  const k = (v || '').toLowerCase();
  if (k.includes('walk')) return 'walk';
  if (k.includes('cycle') || k.includes('bicycle')) return 'cycle';
  if (k.includes('e_rickshaw') || k.includes('erick')) return 'erick';
  if (k.includes('auto') || k.includes('rickshaw')) return 'auto';
  if (k.includes('two_wheeler') || k.includes('bike') || k.includes('scooter') || k.includes('moto')) return 'bike';
  if (k.includes('bus')) return 'bus';
  if (k.includes('metro')) return 'metro';
  if (k.includes('cab') || k.includes('taxi')) return 'cab';
  return 'car';
};

/* ── the trip store — journey.history records → ledger Trip shape ─── */
const loadTrips = () => (A.store.get(HIST_KEY, []) || []).map((r) => ({
  ts: r.t, from: (r.from && (r.from.label || r.from.name)) || 'start',
  to: (r.to && (r.to.label || r.to.name)) || 'there',
  vehicle: r.vehicle || (r.label || '').split('_')[0] || 'car', label: r.label || '',
  dose_ug: r.dose_ug ?? 0, avoided_ug: r.avoided_ug ?? 0,
  emit_kg: r.emit_kg, dose_lo_ug: r.dose_lo_ug, dose_hi_ug: r.dose_hi_ug,
  donated: r.donated, simulated: !!r.simulated,
  _key: `${r.t}|${(r.from && r.from.label) || ''}|${(r.to && r.to.label) || ''}|${r.vehicle || ''}`,
}));
const saveTrips = (trips, keys) => {
  A.store.set(HIST_KEY, keys);
  render();
};
const dayKey = (ts) => new Date(ts).toDateString();
const weekStats = (trips) => {
  const byDay = new Map();
  for (const tr of trips) {
    const k = dayKey(tr.ts);
    const acc = byDay.get(k) ?? { ug: 0, n: 0 };
    acc.ug += tr.dose_ug; acc.n++;
    byDay.set(k, acc);
  }
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const acc = byDay.get(dayKey(d.getTime()));
    days.push({ label: d.toLocaleDateString('en-IN', { weekday: 'narrow' }), ug: Math.round((acc?.ug ?? 0) * 10) / 10, trips: acc?.n ?? 0 });
  }
  return { days, weekUg: Math.round(days.reduce((s, d) => s + d.ug, 0) * 10) / 10 };
};

let st = null;

/* ── trip card + detail ──────────────────────────────────────────── */
function tripCard(tr, open) {
  const saved = tr.avoided_ug > 0;
  return `<div class="lg-card">
    <button class="lg-head${open ? ' open' : ''}" type="button" data-k="${esc(tr._key)}"
      aria-expanded="${open}" aria-label="${esc(placeNameLabel(tr.from))} → ${esc(placeNameLabel(tr.to))}, ${esc(modeLabel(tr.vehicle, tr.label))}, ${esc(dayLabel(tr.ts))} ${esc(clockLabel(tr.ts))}">
      <span class="lg-modebox">${icon(vehicleGlyph(tr.vehicle), '#4A4E57', 22, true)}</span>
      <span class="lg-mid">
        <span class="lg-route">${esc(placeNameLabel(tr.from))} → ${esc(placeNameLabel(tr.to))}</span>
        <span class="lg-meta">${esc(modeLabel(tr.vehicle, tr.label))} · ${esc(clockLabel(tr.ts))}${tr.simulated ? ' · simulated' : ''}</span>
        ${saved ? `<span class="lg-saved">${esc(t('tripsSavedVsUg', { n: fmtDoseUg(tr.avoided_ug) }))}</span>` : ''}
      </span>
      <span class="lg-nums">
        <span class="lg-cigrow">${icon('dust', cigTone(tr.dose_ug), 13)}<span class="lg-cignum num" style="color:${cigTone(tr.dose_ug)}">${esc(fmtDoseUg(tr.dose_ug))} µg</span></span>
        ${tr.emit_kg != null ? `<span class="lg-outnum num">${esc(t('nav_kg', { n: `≈${fmtKg(tr.emit_kg)}` }))}</span>` : ''}
      </span>
      <span class="lg-chev">${icon('chevron', '#6E7278', 16)}</span>
    </button>
    ${open ? tripDetail(tr) : ''}
  </div>`;
}
function tripDetail(tr) {
  const lo = tr.dose_lo_ug, hi = tr.dose_hi_ug;
  return `<div class="lg-detail">
    <div class="lg-drow">
      <span class="lg-dlabel">${esc(t('tripsBreathed'))}</span>
      <span class="lg-dright">
        <span class="lg-dvalue num">${esc(t('doseUg', { n: fmtDoseUg(tr.dose_ug) }))}</span>
        <span class="lg-dsub num">${esc(lo != null && hi != null
          ? t('tripsDoseBand', { lo: fmtUg(lo), hi: fmtUg(hi) })
          : t('tripsDoseDetail', { n: fmtUg(tr.dose_ug) }))}</span>
      </span>
    </div>
    ${tr.emit_kg != null ? `<div class="lg-drow">
      <span class="lg-dlabel">${esc(t('tripsPutOut'))}</span>
      <span class="lg-dvalue num">${esc(t('tripsOutDetail', { n: fmtKg(tr.emit_kg) }))}</span>
    </div>` : ''}
    ${tr.avoided_ug > 0 ? `<div class="lg-dsaved">${esc(t('tripsSavedVsUg', { n: fmtDoseUg(tr.avoided_ug) }))}</div>` : ''}
    ${tr.donated === true ? `<div class="lg-badgerow"><span class="lg-badge">${esc(t('ledgerDonated'))}</span></div>` : ''}
    <div class="lg-dhairline"></div>
    <button class="lg-ddelete" type="button" data-del="${esc(tr._key)}" aria-label="${esc(t('ledgerDeleteTrip'))}">
      ${icon('trash', '#A83D30', 16)}<span>${esc(t('ledgerDeleteTrip'))}</span>
    </button>
  </div>`;
}

/* ── render ──────────────────────────────────────────────────────── */
function render() {
  const body = st.body;
  const trips = loadTrips().sort((a, b) => b.ts - a.ts);
  const openKey = st.openKey;
  if (!trips.length) {
    body.innerHTML = `<div class="lg-emptywrap">
      <div class="lg-emptybadge">${icon('clock', '#6E7278', 30)}</div>
      <div class="lg-emptytitle">${esc(t('tripsEmpty'))}</div>
      <div class="lg-emptyhint">${esc(t('ledgerEmptyHint'))}</div>
      <div class="lg-emptyprivacy">${esc(t('ledgerPrivacy'))}</div>
    </div>`;
    return;
  }
  /* summary card — cumulative over saved trips */
  const week = weekStats(trips);
  const cutoff = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 6); return d.getTime(); })();
  const weekTrips = week.days.reduce((s, d) => s + d.trips, 0);
  const weekEmitKg = trips.filter((tr) => tr.ts >= cutoff && tr.emit_kg != null).reduce((s, tr) => s + tr.emit_kg, 0);
  const allUg = trips.reduce((s, tr) => s + tr.dose_ug, 0);
  const allEmitKg = trips.reduce((s, tr) => s + (tr.emit_kg ?? 0), 0);
  const weekMaxUg = Math.max(0.1, ...week.days.map((d) => d.ug));

  /* day headers + rows */
  const today = new Date().toDateString();
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const yesterday = yest.toDateString();
  let day = '';
  const rows = [];
  for (const tr of trips) {
    const dk = dayKey(tr.ts);
    if (dk !== day) {
      day = dk;
      rows.push(`<div class="lg-dayhead">${esc(dk === today ? t('sidebarToday') : dk === yesterday ? t('ledgerYesterday') : dayLabel(tr.ts))}</div>`);
    }
    rows.push(tripCard(tr, tr._key === openKey));
  }

  body.innerHTML = `
    <div class="lg-summary">
      <div class="lg-sumrow">
        <div class="lg-sumcol">
          <div class="lg-sumnum num">${trips.length}</div>
          <div class="lg-sumcap">${esc(t(trips.length === 1 ? 'tripsCountOne' : 'tripsCount', { n: '' }).trim())}</div>
        </div>
        <div class="lg-sumcol">
          <div class="lg-sumhero num">${esc(fmtDoseUg(allUg))}<span class="lg-sumunithero"> µg</span></div>
          <div class="lg-sumcap">${esc(t('breathed'))}</div>
        </div>
        ${allEmitKg > 0 ? `<div class="lg-sumcol">
          <div class="lg-sumnum num">≈${esc(fmtKg(allEmitKg))}<span class="lg-sumunit"> ${esc(t('unitsKg'))}</span></div>
          <div class="lg-sumcap">${esc(t('putOut'))}</div>
        </div>` : ''}
      </div>
      <div class="lg-sumfoot">${esc(t('ledgerAllTime'))} · ${esc(t('ledgerEstNote'))}</div>
      ${weekTrips > 0 ? `<div class="lg-weekrow">
        <div class="lg-weeklabel">${esc(t('ledgerLast7'))}</div>
        <div class="lg-weekline num">${esc(t(weekTrips === 1 ? 'tripsCountOne' : 'tripsCount', { n: weekTrips }))} · ${esc(t('doseUg', { n: fmtDoseUg(week.weekUg) }))}${weekEmitKg > 0 ? ` · ${esc(t('tripsOutDetail', { n: fmtKg(weekEmitKg) }))}` : ''}</div>
        <div class="lg-barsrow">${week.days.map((d) => `
          <div class="lg-barcol">
            <i class="lg-barfill" style="height:${d.ug <= 0 ? 3 : 4 + (d.ug / weekMaxUg) * 34}px;background:${cigTone(d.ug)}"></i>
            <span class="lg-barlbl">${esc(d.label)}</span>
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>
    <div class="lg-list">${rows.join('')}</div>
    <div class="lg-footer">
      <span class="lg-privacy">${esc(t('ledgerPrivacy'))}</span>
      <button class="lg-deleteall" type="button">
        ${icon('trash', '#A83D30', 15)}<span>${esc(t('ledgerDeleteAll'))}</span>
      </button>
    </div>`;

  body.querySelectorAll('.lg-head').forEach((el) =>
    el.addEventListener('click', () => {
      const k = el.dataset.k;
      st.openKey = st.openKey === k ? null : k;
      render();
    }));
  body.querySelectorAll('[data-del]').forEach((el) =>
    el.addEventListener('click', () => {
      const k = el.dataset.del;
      st.openKey = null;
      saveTrips(null, (A.store.get(HIST_KEY, []) || []).filter((r) =>
        `${r.t}|${(r.from && r.from.label) || ''}|${(r.to && r.to.label) || ''}|${r.vehicle || ''}` !== k));
    }));
  body.querySelector('.lg-deleteall').addEventListener('click', () => {
    if (window.confirm(`${t('ledgerDeleteAllTitle')}\n${t('ledgerDeleteAllBody')}`)) {
      st.openKey = null;
      A.store.set(HIST_KEY, []);
      render();
    }
  });
}

/* ── the screen ──────────────────────────────────────────────────── */
A.screen('ledger', {
  mount(el) {
    const chrome = A.sheetChrome(el, 'Trips');
    el.classList.add('lg-host');
    st = { el, body: chrome.body, openKey: null };
    render();
    return () => { st = null; };
  },
});
})();
