/* Alive webapp — air around me. Pixel twin of the RN city-day surface:
   the field painted on the map (AirMapCard legend floats over it, taps
   answer through TapReadout + TapPin), and the "Delhi today" sheet —
   day-of-breathing hero, species, next-12h, streets, travellers, the
   moves card, the go-out window (DepartGraph), and the estimate basis.
   Every string verbatim from Mobile/src/i18n/strings.ts (en);
   every number mono/tabular; band hues only where they mean air. */
(() => {
'use strict';

/* ── theme helpers — exact ports of Mobile/src/theme.ts ──────────── */
const BANDS = ['#6E93AE', '#C7A34F', '#CF8A50', '#C05F3A', '#A83D30', '#6E2D28'];
const BREAKS = [30, 60, 90, 120, 250];
const hexMix = (a, b, t) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
};
const bandIdx = (v) => {           // theme.bandIdx
  if (v == null || !isFinite(v)) return null;
  let i = 0; while (i < BREAKS.length && v > BREAKS[i]) i++;
  return Math.min(i, 5);
};
const bandColor = (v) => { const i = bandIdx(v); return i == null ? null : BANDS[i]; };
const bandColorIdx = (i) => i == null ? null : BANDS[Math.max(0, Math.min(5, i))];
const bandWashIdx = (i) => hexMix(BANDS[Math.max(0, Math.min(5, i))], '#FFFFFF', 0.90);
const bandWashDeepIdx = (i) => hexMix(BANDS[Math.max(0, Math.min(5, i))], '#FFFFFF', 0.68);
const bandEdgeIdx = (i) => hexMix(BANDS[Math.max(0, Math.min(5, i))], '#FFFFFF', 0.60);
const bandInkIdx = (i) => hexMix(BANDS[Math.max(0, Math.min(5, i))], '#16181D', 0.20);
const bandFieldIdx = (i) => hexMix(BANDS[Math.max(0, Math.min(5, i))], '#EDEAE3', 0.68);
const doseColor = (avg) => { const i = bandIdx(avg); return (i == null || i <= 1) ? '#6E7278' : BANDS[i]; };
const breath = (f) => f > 0.66 ? '#A83D30' : f > 0.33 ? '#C05F3A' : '#CF8A50'; // breathRamp

/* ── the register's strings (en table, verbatim) ─────────────────── */
const S = {
  delhiTitle: 'Delhi today', cityHeroLead: 'a day of Delhi air',
  unitUg: 'µg (micrograms)', cityHeroAirFelt: 'the air outside — {w}',
  cityHeroUnitUg: 'µg of fine smoke (PM2.5) inhaled today',
  refWhoOver: '{x}× the WHO daily limit', refWhoUnder: 'within the WHO daily limit',
  cityHeroAirNow: 'city average now ~{n} µg/m³',
  cityHeroRange: 'likely between {lo} and {hi}', cityHeroUnit: 'cigarettes of smoke',
  cigsTrace: 'a trace of a cigarette', whyJoin: ' and ',
  noteMeasured: 'measured, not reported', updatedMinAgo: 'updated {n} min ago',
  cityStale: 'older data — reconnecting',
  dataFromModelOnly: 'estimated from satellites — live stations reconnecting',
  citySpeciesTitle: 'the other things in the air', aqiScale: '0–500 scale',
  whoRef: 'WHO limit {n}',
  citySpeciesNote: 'dust & gases — city average in µg/m³, about every 15 min · US AQI is the index other air apps quote',
  cityTypicalAbove: '{p}% above the 10-year average for this hour ({med} µg/m³)',
  cityTypicalBelow: '{p}% below the 10-year average for this hour ({med} µg/m³)',
  cityForecastTitle: 'the next 12 hours', cityForecastNow: 'now', hourTick: '+{n}h',
  cityForecastNote: 'satellite forecast matched to live readings, µg/m³',
  cityNoOwnTrips: 'no trips yet — go live your day, we\'ll count it here',
  cityNoOwnTripsSub: 'the streets and totals in this view are counted from trips other people share',
  cityStreetsTitle: 'streets travellers crossed',
  cityEmptyStreets: 'nothing to show yet — a street appears after 3+ travellers cross it in 3 days',
  cityTrips: '{n} {tripNoun}', tripNounOne: 'trip', tripNounMany: 'trips',
  cityHeavier: 'heavier', cityLighter: 'lighter', cityUnnamed: 'a street we can\'t name yet',
  cityTravellersTitle: 'what ALive travellers did today',
  cityTodayUtc: 'utc day · resets 05:30 ist',
  cityTravellersLine: '{trips} {tripNoun} · {km} km · ≈{cigs} cigarettes breathed · ≈{kg} kg put out',
  cityTravellersLineUg: '{trips} {tripNoun} · {km} km · {ug} µg breathed · ≈{kg} kg put out',
  citySwitched: '{n} {tripNoun} took a lighter way',
  movesTitle: 'how Delhi moves', ledgerLast7: 'last 7 days',
  movesWindowDays: 'last {d} days',
  movesNotEnough: 'not enough shared trips yet — Delhi\'s movement shows after {k}+ travellers cross a street in {d} days',
  movesSuppressed: '+{n} more trips stay private — fewer than {k} travellers crossed them',
  movesCorridorN: '{n} {streetNoun} measured over {h} hours',
  movesCorridorNDays: '{n} {streetNoun} measured over the last {d} days',
  movesTypical: 'typical trip', movesModeOther: 'other ways',
  compare_smokeIn: 'smoke you breathe', compare_smokeOut: 'smoke your ride puts out',
  receipt_pmBand: 'includes {lo}–{hi} g of fine dust (PM2.5)',
  receipt_pmBandOne: 'includes {x} g of fine dust (PM2.5)',
  cityBasisPrivacy: 'a street shows up only after {k} different travellers crossed it in {h} hours — nobody is singled out',
  cityBasisPrivacyDays: 'a street shows up only after {k} different travellers crossed it in {d} days — nobody is singled out',
  cityBasisModel: 'estimated from satellite + weather over Delhi, refreshed about every 15 min',
  cityBasisNoStations: 'no live stations right now — satellite estimate only',
  cityBasisStations: '{n} live stations counted in',
  cityBasisPm25Ug: 'fine smoke (PM2.5) {lo}–{hi} µg/m³ — the raw number behind the hero figure',
  cityBasisBand: 'the range is honest — it covers what the meters miss and how different Delhi\'s neighbourhoods are',
  cityWhyTitle: 'why this is an estimate',
  offline: 'can\'t reach the server — trying again', cityRetry: 'try again',
  cityLoading: 'reading Delhi\'s air…', cityNoField: 'no live air reading right now',
  streetNounOne: 'street', streetNounMany: 'streets',
  airmapTitle: 'the air map', airmapLine: 'redder = worse air right now',
  howWe_fieldAge: 'air reading: {n} min old', minUnit: 'min',
  srcStations: 'live stations', srcModel: 'satellite estimate',
  tapReading: 'reading…', tapOutside: 'outside the air map — no read here', tapHere: 'this spot',
  band_good: 'good', band_satisfactory: 'satisfactory', band_moderate: 'moderate',
  band_poor: 'poor', band_veryPoor: 'very poor', band_severe: 'severe',
  felt_easy: 'good', felt_fine: 'satisfactory', felt_fair: 'moderate',
  felt_heavy: 'poor', felt_rough: 'very poor', felt_harsh: 'severe',
  whyBit_stubble: 'stubble smoke drifting in on the {dir} wind',
  whyBit_stagnation: 'the air is barely moving — the day\'s pollution is sitting over the city',
  whyBit_trendRising: 'levels still climbing', whyBit_trendFalling: 'easing off the earlier high',
  whyDir_N: 'northerly', whyDir_NE: 'north-east', whyDir_E: 'easterly',
  whyDir_SE: 'south-east', whyDir_S: 'southerly', whyDir_SW: 'south-west',
  whyDir_W: 'westerly', whyDir_NW: 'north-west',
  vehicle_car: 'car', vehicle_auto: 'auto', vehicle_bike: 'bike / scooter',
  vehicle_bus: 'bus', vehicle_metro: 'metro', vehicle_walk: 'on foot',
  vehicle_cycle: 'cycle', vehicleCab: 'cab',
  exploreNowMarker: 'now', exploreTomorrow: 'tomorrow', exploreInDays: 'in {n} days',
  playBestLine: 'lightest window — {w} · ~{n} µg', playWorstLine: 'heaviest — {w} · ~{n} µg',
  exploreAvgLine: '24 h avg ~{n} µg/m³', exploreReading: 'reading the field…',
  exploreNoCurve: 'no honest curve for this spot right now',
  exploreThinRead: 'thin read — nearest monitor ~{n} km',
  exploreThinReadNoKm: 'thin read — no live monitor nearby',
  receipt_estShort: 'about', departNow: 'now',
  cityGoOut: 'planning to go out',
  a11yClear: 'clear', a11yBack: 'back',
  tapAqiA11y: 'air at {place}: AQI {n} — {band}',
  bandScaleA11y: 'air quality today: {b} — position {n} of 6 on the good to severe scale',
  tripsDoseBand: 'about {lo}–{hi} µg',
  daypart_am: 'am', daypart_pm: 'pm',
  thinRead: 'thin read',
  spotLead: 'the air where you are', spotLeadAt: 'the air at {place}',
  spotNone: 'tap the map to read the air there',
  spotReading: 'reading the air here…', spotOffline: 'can\'t read the air here right now',
  spotOutside: 'outside the area we can read',
  spotNearest: 'nearest monitor ~{n} km', spotNearestEst: 'an estimate — nearest monitor ~{n} km',
  spotAqi: 'AQI',
  citySpeciesCity: 'other things in delhi\'s air',
  scPh: 'name a place in delhi — a park, a block, a market',
  scNone: 'nothing found — try a landmark, a block, a sector',
  scSearching: 'searching…', scSlow: 'this is taking long — try a shorter name',
  scNoExact: 'no exact match — closest places', scRecent: 'recent places',
  scSearchA11y: 'search the air at a place',
};
const t = (k, vars) => { let s = S[k] ?? k; if (vars) for (const [a, v] of Object.entries(vars)) s = s.replaceAll(`{${a}}`, String(v)); return s; };

/* ── formatters — strings.ts ports (en, IST clocks) ──────────────── */
const IST_MS = 330 * 60 * 1000;
const istParts = (ts) => { const d = new Date(ts + IST_MS); return { h24: d.getUTCHours(), min: d.getUTCMinutes() }; };
const clockLabel = (d) => {
  const ts = typeof d === 'number' ? d : d.getTime();
  const { h24, min } = istParts(ts);
  return `${((h24 + 11) % 12) + 1}:${String(min).padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
};
const clockTight = (d) => clockLabel(d).replace(' ', '');
const hourLabel = (d) => {
  const ts = typeof d === 'number' ? d : d.getTime();
  const { h24, min } = istParts(ts);
  if (min !== 0) return clockTight(d);
  return `${((h24 + 11) % 12) + 1}${h24 < 12 ? 'am' : 'pm'}`;
};
const dateOf = (iso) => { if (!iso) return null; const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z'); return isNaN(d) ? null : d; };
const approx = (n) => Number(n) === 0 ? '0' : `≈ ${n}`;
const doseUgRound = (ug) => ug >= 10 ? Math.round(ug) : Math.round(ug * 10) / 10;
const fmtCig = (v) => v < 1 ? v.toFixed(2) : v.toFixed(1);
const fmtKm = (km) => km < 10 ? km.toFixed(1) : `${Math.round(km)}`;
const fmtKg = (kg) => kg < 1 ? kg.toFixed(2) : kg.toFixed(1);
const fmtUgS = (v) => v < 10 ? v.toFixed(1) : `${Math.round(v)}`;
const fmtPct = (s) => `${Math.round(s * 100)}%`;
const CIG_UG = 316;
const cigOf = (ug) => ug == null ? null : Math.round((ug / CIG_UG) * 100) / 100;
const streetName = (name) => /[A-Z]/.test(name) ? name : name.replace(/\b\w/g, (c) => c.toUpperCase());
const BAND_KEYS = ['band_good', 'band_satisfactory', 'band_moderate', 'band_poor', 'band_veryPoor', 'band_severe'];
const FELT_KEYS = ['felt_easy', 'felt_fine', 'felt_fair', 'felt_heavy', 'felt_rough', 'felt_harsh'];
const feltKeyForBand = (i) => FELT_KEYS[Math.max(0, Math.min(5, i ?? 1))];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  "pin": ["M480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 79q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 45-17.5 94.5t-51 103Q698-301 648-244T533-127q-11 10-25 15t-28 5Zm0-453Zm0 80q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z"],
  "clock": ["M520-496v-144q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v159q0 8 3 15.5t9 13.5l132 132q11 11 28 11t28-11q11-11 11-28t-11-28L520-496ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"],
  "info": ["M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"],
  "chevron": ["M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z"],
  "close": ["M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z"],
  "flag": ["M280-400v240q0 17-11.5 28.5T240-120q-17 0-28.5-11.5T200-160v-600q0-17 11.5-28.5T240-800h287q14 0 25 9t14 23l10 48h184q17 0 28.5 11.5T800-680v320q0 17-11.5 28.5T760-320H553q-14 0-25-9t-14-23l-10-48H280Zm306 0h134v-240H543q-14 0-25-9t-14-23l-10-48H280v240h257q14 0 25 9t14 23l10 48Zm-86-160Z"],
  "walk": ["M436-364 371-72q-3 14-14.5 23T330-40q-20 0-32-15t-8-34l102-515-72 28v96q0 17-11.5 28.5T280-440q-17 0-28.5-11.5T240-480v-122q0-12 6.5-21.5T264-638l178-76q14-6 29.5-7t29.5 4q14 5 26.5 14t20.5 23l40 64q13 20 30.5 38t39.5 31q14 8 31 14.5t34 9.5q16 3 26.5 14.5T760-480q0 17-12 28t-29 9q-56-8-100.5-35T541-543l-25 123 72 68q6 6 9 13.5t3 15.5v243q0 17-11.5 28.5T560-40q-17 0-28.5-11.5T520-80v-220l-84-64Zm104-376q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Z"],
  "cycle": ["M620-740q-33 0-56.5-23.5T540-820q0-33 23.5-56.5T620-900q33 0 56.5 23.5T700-820q0 33-23.5 56.5T620-740ZM432-540l66 69q11 11 16.5 25t5.5 30v176q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-160L312-512q-14-12-19-25t-5-31q0-18 5.5-30.5T312-624l112-112q13-13 27.5-18.5T484-760q18 0 32.5 5.5T544-736l76 76q21 21 47 35.5t58 20.5q17 3 28 15t11 29q0 17-12 28t-29 9q-49-7-90-28t-73-53l-32-32-96 96Zm-232 60q85 0 142.5 57.5T400-280q0 85-57.5 142.5T200-80q-85 0-142.5-57.5T0-280q0-85 57.5-142.5T200-480Zm0 340q57 0 98.5-41.5T340-280q0-57-41.5-98.5T200-420q-57 0-98.5 41.5T60-280q0 57 41.5 98.5T200-140Zm560-340q85 0 142.5 57.5T960-280q0 85-57.5 142.5T760-80q-85 0-142.5-57.5T560-280q0-85 57.5-142.5T760-480Zm0 340q57 0 98.5-41.5T900-280q0-57-41.5-98.5T760-420q-57 0-98.5 41.5T620-280q0 57 41.5 98.5T760-140Z"],
  "bike": ["M280-200q-50 0-85-35t-35-85h-40q-17 0-28.5-11.5T80-360v-80q0-66 47-113t113-47h80q33 0 56.5 23.5T400-520v120h140l140-174v-106h-80q-17 0-28.5-11.5T560-720q0-17 11.5-28.5T600-760h80q33 0 56.5 23.5T760-680v106q0 14-4.5 26.5T743-524L604-350q-11 14-28 22t-35 8H400q0 50-35 85t-85 35Zm40-200Zm-40 120q17 0 28.5-11.5T320-320h-80q0 17 11.5 28.5T280-280Zm80-360H240q-17 0-28.5-11.5T200-680q0-17 11.5-28.5T240-720h120q17 0 28.5 11.5T400-680q0 17-11.5 28.5T360-640Zm400 440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T800-320q0-17-11.5-28.5T760-360q-17 0-28.5 11.5T720-320q0 17 11.5 28.5T760-280ZM160-400h160v-120h-80q-33 0-56.5 23.5T160-440v40Z"],
  "auto": ["M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54ZM120-560v120h6q14-35 44.5-57.5T240-520q11 0 21 1.5t19 4.5v-46H120Zm520 120h46q9-26 28.5-45.5T760-514v-6H640v80ZM120-560h160-160Zm520 40h120-120Z"],
  "erick": ["M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54ZM120-560v120h6q14-35 44.5-57.5T240-520q11 0 21 1.5t19 4.5v-46H120Zm520 120h46q9-26 28.5-45.5T760-514v-6H640v80ZM120-560h160-160Zm520 40h120-120Z"],
  "cab": ["M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h85v-40q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800v40h85q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"],
  "bus": ["M320-200v20q0 25-17.5 42.5T260-120q-25 0-42.5-17.5T200-180v-62q-18-20-29-44.5T160-340v-380q0-83 77-121.5T480-880q172 0 246 37t74 123v380q0 29-11 53.5T760-242v62q0 25-17.5 42.5T700-120q-25 0-42.5-17.5T640-180v-20H320Zm162-560h224-448 224Zm158 280H240h480-80Zm-400-80h480v-120H240v120Zm100 240q25 0 42.5-17.5T400-380q0-25-17.5-42.5T340-440q-25 0-42.5 17.5T280-380q0 25 17.5 42.5T340-320Zm280 0q25 0 42.5-17.5T680-380q0-25-17.5-42.5T620-440q-25 0-42.5 17.5T560-380q0 25 17.5 42.5T620-320ZM258-760h448q-15-17-64.5-28.5T482-800q-107 0-156.5 12.5T258-760Zm62 480h320q33 0 56.5-23.5T720-360v-120H240v120q0 33 23.5 56.5T320-280Z"],
  "metro": ["M80-160v-446q0-85 44-147.5T248-848q54-21 115-26.5t117-5.5q56 0 117 5.5T712-848q80 32 124 94.5T880-606v446q0 33-23.5 56.5T800-80H160q-33 0-56.5-23.5T80-160Zm220-280v-160h360v160H300Zm320 140q-17 0-28.5-11.5T580-340q0-17 11.5-28.5T620-380q17 0 28.5 11.5T660-340q0 17-11.5 28.5T620-300Zm-280 0q-17 0-28.5-11.5T300-340q0-17 11.5-28.5T340-380q17 0 28.5 11.5T380-340q0 17-11.5 28.5T340-300ZM160-160h640v-446q0-60-29.5-102.5T682-774q-44-17-97.5-21.5T480-800q-51 0-104.5 4.5T278-774q-59 23-88.5 65.5T160-606v446Zm264-60h110l51 51q5 5 10.5 7t11.5 2q20 0 27.5-19t-6.5-33l-10-10q44-6 73-39.5t29-78.5v-260q0-78-70-99t-170-21q-91 0-165.5 21T240-600v260q0 45 29 78.5t73 39.5l-11 11q-14 14-6.5 32.5T352-160q6 0 11-2t10-7l51-51Zm-264 60v-446q0-60 29.5-102.5T278-774q44-17 97.5-21.5T480-800q51 0 104.5 4.5T682-774q59 23 88.5 65.5T800-606v446H160Z"],
  "car": ["M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h410q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"],
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

/* ── city helpers — DelhiToday.tsx ports ─────────────────────────── */
const stationsOffline = (d) => {
  const st = d && d.provenance && d.provenance.stations;
  if (st) return st.live === false;
  const s = d && d.sources && d.sources.stations;
  return s ? s.up === false : false;
};
const WHY_CARRY = [[337.5, 'whyDir_N'], [292.5, 'whyDir_NW'], [247.5, 'whyDir_W'], [202.5, 'whyDir_SW'],
  [157.5, 'whyDir_S'], [112.5, 'whyDir_SE'], [67.5, 'whyDir_E'], [22.5, 'whyDir_NE']];
const whyCompass = (deg) => {
  if (deg == null) return 'whyDir_NW';
  const d = ((deg % 360) + 360) % 360;
  for (const [top, k] of WHY_CARRY) if (d >= top) return k;
  return 'whyDir_N';
};
const whyBitKey = (d) => {
  if (d.kind === 'trend')
    return d.direction === 'rising' ? 'whyBit_trendRising' : d.direction === 'falling' ? 'whyBit_trendFalling' : null;
  if (d.kind === 'stubble_smoke') return 'whyBit_stubble';
  if (d.kind === 'stagnation') return 'whyBit_stagnation';
  return null;
};
const whyLine = (why, wind) => {
  const drivers = why.drivers ?? [];
  if (!drivers.length) return why.line ?? '';
  const dir = t(whyCompass(wind && wind.from_deg));
  const head = drivers.slice(0, 2);
  const parts = head.map((d) => {
    const k = whyBitKey(d);
    if (k === 'whyBit_stubble') return t(k, { dir });
    return k ? t(k) : null;
  });
  if (parts.length < head.length || parts.some((p) => p == null)) return why.line ?? '';
  return parts.join(t('whyJoin'));
};
const noteLine = (why) => why.cause_note ?? '';

/* ── field + readout plumbing — the shared map paints the field (a
   smooth band tint + every road in view coloured by the air at its
   spot); this screen only switches it on and reads it back ────────── */
const PICK_KEY = 'airmap.place';
const HIST_KEY = 'journey.history';
let st = null;               // screen state
let tapMarker = null;

function setFieldVisible(v) {
  A.map.setFieldVisible(!!v);
  if (A.map.airRoads) A.map.airRoads(!!v);
}

/* ONE scale everywhere: the CPCB national AQI from PM2.5 + PM10 — the
   same function, tables and category the home hero and the map paint
   use (map.js cpcb). {aqi, over, band} or null. */
function aqiOf(pm25, pm10) {
  const n = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  if (A.map && typeof A.map.cpcb === 'function') return A.map.cpcb(n(pm25), n(pm10));
  return null;
}

/* the painted field at a point (TapReadout's field-first contract: the
   colour you tapped is the number you get) */
function sampleFieldAt(lat, lon) {
  const s = A.map.sampleField ? A.map.sampleField(lat, lon) : null;
  if (!s || s.band == null || s.aqi == null) return null;
  return { aqi: s.aqi, pm25: s.pm25, pm10: s.pm10, band: s.band,
    conf: s.w < 0.45 ? 'lo' : s.w < 0.8 ? 'med' : 'hi' };
}

/* ── the band scale chip — colours + "good → severe", nothing else ── */
function scaleChip() {
  const el = document.createElement('div');
  el.className = 'am-chip';
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', `${t('band_good')} to ${t('band_severe')}`);
  el.innerHTML = `<span class="amc-dots">${[0, 1, 2, 3, 4, 5].map((i) =>
    `<i style="background:${bandColorIdx(i)}"></i>`).join('')}</span>
    <span class="amc-scale">${esc(t('band_good'))} → ${esc(t('band_severe'))}</span>`;
  return el;
}

/* ── TapReadout — the tap's answer card + TapPin ──────────────────── */
function readCard() {
  if (!st.readEl) {
    st.readEl = document.createElement('div');
    st.readEl.className = 'am-read';
    st.el.appendChild(st.readEl);
  }
  return st.readEl;
}
function paintRead(read, place) {
  const el = readCard();
  el.hidden = false;
  const resolved = read && typeof read === 'object';
  const qualifier = resolved && (read.conf === 'lo' || read.conf === 'model') ? t('thinRead') : null;
  const caption = [place || (resolved ? t('tapHere') : null), qualifier].filter(Boolean).join(' · ');
  if (resolved) {
    /* AQI + its band word up front (one scale), PM2.5 as the quiet
       second figure — never a µg number next to an AQI word */
    const ink = bandInkIdx(read.band);
    el.innerHTML = `
      <div class="amr-row">
        <div class="amr-read" role="img" aria-label="${esc(t('tapAqiA11y', { place: place || t('tapHere'), n: read.aqi, band: t(BAND_KEYS[read.band]) }))}">
          <span class="amr-dot" style="background:${bandColorIdx(read.band) ?? '#6E7278'}"></span>
          <span class="amr-num num" style="color:${ink}">${read.aqi}${read.over ? '+' : ''}<span class="amr-unit"> ${esc(t('spotAqi'))}</span><span class="amr-band" style="color:${ink}"> — ${esc(t(BAND_KEYS[read.band]))}</span></span>
          ${read.pm25 != null ? `<span class="amr-pm num"><b>PM2.5</b> ${Math.round(read.pm25)}</span>` : ''}
          ${read.pm10 != null ? `<span class="amr-pm num"><b>PM10</b> ${Math.round(read.pm10)}</span>` : ''}
        </div>
        <button class="amr-x" type="button" aria-label="${esc(t('a11yClear'))}">${icon('close', '#6E7278', 12)}</button>
      </div>
      ${caption ? `<div class="amr-caption">${esc(caption)}</div>` : ''}`;
  } else {
    el.innerHTML = `
      <div class="amr-row">
        <div class="amr-read"><span class="amr-plain">${esc(read === 'pending' ? t('tapReading') : t('tapOutside'))}</span></div>
        <button class="amr-x" type="button" aria-label="clear">${icon('close', '#6E7278', 12)}</button>
      </div>
      ${caption ? `<div class="amr-caption">${esc(caption)}</div>` : ''}`;
  }
  el.querySelector('.amr-x').addEventListener('click', () => {
    el.hidden = true;
    if (tapMarker) { tapMarker.remove(); tapMarker = null; }
  });
}
function tapPin(label, band, lon, lat) {
  if (tapMarker) tapMarker.remove();
  const i = band == null ? null : Math.max(0, Math.min(5, band));
  const fg = i == null ? '#16181D' : bandInkIdx(i);
  const pin = document.createElement('div');
  pin.className = 'am-tappin';
  pin.innerHTML = `
    <div class="am-tappin-chip" style="background:${i == null ? '#FFF' : bandWashIdx(i)};border-color:${i == null ? '#E3E0D7' : bandEdgeIdx(i)}">
      <span class="am-tappin-num num" style="color:${fg}">${esc(label)}</span>
    </div>
    <div class="am-tappin-dot" style="background:${fg}"></div>`;
  A.map.ready((m) => {
    tapMarker = new maplibregl.Marker({ element: pin, anchor: 'bottom' }).setLngLat([lon, lat]).addTo(m);
  });
}
async function tapRead(lat, lon) {
  /* field-first: the painted cell answers instantly; /aqi only when the
     cells don't reach — same contract as api/airfield.sampleFieldAt */
  const cell = sampleFieldAt(lat, lon);
  if (cell) {
    paintRead(cell, st.tapPlace);
    tapPin(`${cell.aqi}`, cell.band, lon, lat);
    return;
  }
  paintRead('pending', st.tapPlace);
  tapPin('…', null, lon, lat);
  const j = await A.api.get(`/aqi?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, 9000);
  if (!st || st.readEl.hidden) return;
  const v = j ? aqiOf(j.pm25, j.pm10) : null;
  if (!v) {
    paintRead('outside', st.tapPlace);
    if (tapMarker) { tapMarker.remove(); tapMarker = null; }
    return;
  }
  const read = { aqi: v.aqi, over: v.over, pm25: j.pm25, pm10: j.pm10, band: v.band,
    conf: j.beyond_field_edge ? 'lo' : 'med' };
  paintRead(read, st.tapPlace);
  tapPin(`${v.aqi}${v.over ? '+' : ''}`, read.band, lon, lat);
}

/* ── BandScale — the good→severe anchor ───────────────────────────── */
function bandScale(idx) {
  const i = Math.max(0, Math.min(5, idx));
  const seg = 100 / 6;
  const stops = [0, 1, 2, 3, 4, 5].map((j) =>
    `${bandEdgeIdx(j)} ${(j * seg).toFixed(2)}%, ${bandEdgeIdx(j)} ${((j + 1) * seg).toFixed(2)}%`).join(', ');
  return `<div class="dt-scale" role="img" aria-label="${esc(t('bandScaleA11y', { b: t(BAND_KEYS[i]), n: i + 1 }))}">
    <div class="dt-scale-track" style="background:linear-gradient(90deg, ${stops})"></div>
    <div class="dt-scale-seam" style="left:calc(${i * seg}% - 1px);width:calc(${seg}% + 2px)"></div>
    <div class="dt-scale-pos" style="left:calc(${i * seg}% + 1.5px);width:calc(${seg}% - 3px);background:${bandInkIdx(i)}"></div>
  </div>`;
}

/* ── DepartGraph — the go-out window card (candlesticks + axis + caption) */
function departGraph(rows0, opts) {
  /* rows0: [{hour, mid, lo, hi, label}] — mid/lo/hi in µg/m³ ambient.
     opts: {bestHour} — column = bar(mid) + whisker(lo→hi); best = accent
     + top dot; selected = ink over accentTint well; axis = now/+6/+12/
     +18/last; caption 'about … ≈ N µg/m³'. Height 64 like the RN prop. */
  const rows = [...rows0].filter((d) => Number.isFinite(d.mid)).sort((a, b) => a.hour - b.hour);
  const n = rows.length;
  if (!n) return '';
  const H = 64;
  const max = Math.max(1e-6, ...rows.map((d) => Math.max(d.mid, d.hi ?? 0)));
  const y = (v) => Math.max(2, (v / max) * H);
  const want = new Set([0, 6, 12, 18, rows[n - 1].hour]);
  const ticks = rows.map((d, i) => want.has(d.hour) ? i : -1).filter((i) => i >= 0);
  st.dgRows = rows; st.dgBest = opts.bestHour; st.dgMax = max;
  const barColor = (d) =>
    d.hour === st.dgSel ? '#16181D'
      : d.hour === opts.bestHour ? '#35614B' : breath(d.mid / max);
  const cols = rows.map((d, i) => {
    const c = barColor(d);
    const lo = d.lo ?? d.mid, hi = d.hi ?? d.mid;
    const banded = hi > lo;
    return `<div class="dg-cell" data-h="${d.hour}" data-i="${i}" role="button" tabindex="0"
      aria-label="${d.hour === 0 ? t('departNow') : t('hourTick', { n: d.hour })} ≈ ${Math.round(d.mid)} µg/m³">
      <div class="dg-col${d.hour === st.dgSel ? ' sel' : ''}">
        ${d.hour === opts.bestHour ? '<div class="dg-bestdot"></div>' : ''}
        ${banded ? `<div class="dg-whisk" style="bottom:${y(lo).toFixed(1)}px;height:${Math.max(2, y(hi) - y(lo)).toFixed(1)}px;background:${c}66"></div>` : ''}
        <div class="dg-bar" style="height:${y(d.mid).toFixed(1)}px;background:${c}"></div>
      </div>
    </div>`;
  }).join('');
  const axis = ticks.map((i) => {
    const d = rows[i];
    const cx = ((i + 0.5) / n) * 100;
    return `<div class="dg-tick" style="left:calc(${cx}% - 24px)">
      <span class="dg-tickoff${d.hour === opts.bestHour ? ' best' : ''}">${d.hour === 0 ? t('departNow') : t('hourTick', { n: d.hour })}</span>
      <span class="dg-tickclk num">${esc(d.label || ' ')}</span>
    </div>`;
  }).join('');
  return `<div class="dg-wrap"><div class="dg-bars" style="height:${H}px">${cols}</div>
    <div class="dg-axis">${axis}</div>
    <div class="dg-caption"><span class="dg-cap">${esc(t('receipt_estShort'))}</span><span class="dg-capval num" id="dg-capv"></span></div></div>`;
}
function dgDetail() {
  const rows = st.dgRows || [];
  const detail = rows.find((d) => d.hour === st.dgSel) ?? rows.find((d) => d.hour === st.dgBest) ?? rows[0];
  return detail ? `${detail.hour === 0 ? t('departNow') : t('hourTick', { n: detail.hour })}${detail.label ? ` · ${detail.label}` : ''} ≈ ${Math.round(detail.mid)} µg/m³` : '';
}
function bindDepartGraph(zone) {
  const bars = zone.querySelector('.dg-bars');
  if (!bars) return;
  const capv = zone.querySelector('#dg-capv');
  if (capv) capv.textContent = dgDetail();
  const hourFromX = (clientX) => {
    const r = bars.getBoundingClientRect();
    const n = st.dgRows.length;
    const idx = Math.max(0, Math.min(n - 1, Math.floor((clientX - r.left) / (r.width / n))));
    return st.dgRows[idx] && st.dgRows[idx].hour;
  };
  const select = (hour) => {
    if (hour == null || hour === st.dgSel) return;
    st.dgSel = hour;
    bars.querySelectorAll('.dg-cell').forEach((cellEl) => {
      const on = Number(cellEl.dataset.h) === hour;
      cellEl.querySelector('.dg-col').classList.toggle('sel', on);
      const barEl = cellEl.querySelector('.dg-bar');
      const whisk = cellEl.querySelector('.dg-whisk');
      const d = st.dgRows.find((x) => x.hour === Number(cellEl.dataset.h));
      const c = on ? '#16181D' : (d.hour === st.dgBest ? '#35614B' : breath(d.mid / st.dgMax));
      if (barEl) barEl.style.background = c;
      if (whisk) whisk.style.background = c + '66';
    });
    if (capv) capv.textContent = dgDetail();
  };
  let scrubbing = false;
  bars.addEventListener('pointerdown', (e) => { scrubbing = true; bars.setPointerCapture(e.pointerId); select(hourFromX(e.clientX)); });
  bars.addEventListener('pointermove', (e) => { if (scrubbing) select(hourFromX(e.clientX)); });
  bars.addEventListener('pointerup', () => { scrubbing = false; });
  bars.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { const h = Number(e.target.closest('.dg-cell').dataset.h); select(h); e.preventDefault(); }
  });
}

/* ── planning to go out — /v2/playtime at the picked place ────────── */
function placeLabel() {
  const p = st.place;
  return (p && p.label) || 'where you are';
}
async function planCard() {
  const body = st.body;
  const lat = st.place.lat, lon = st.place.lon;
  const zone = body.querySelector('.am-plan');
  if (!zone) return;
  zone.innerHTML = `<div class="muted" style="padding:12px 4px">${esc(t('exploreReading'))}</div>`;
  const d = await A.api.get(`/v2/playtime?near=${lat.toFixed(5)},${lon.toFixed(5)}`, 18000);
  if (!body.isConnected || !st) return;
  if (!d || !Array.isArray(d.hours) || !d.hours.length) {
    zone.innerHTML = `<div class="muted" style="padding:12px 4px">${esc(t('exploreNoCurve'))}</div>`;
    return;
  }
  const best = d.best_window || null;
  const rows = d.hours.map((h) => ({
    hour: h.h, mid: h.pm25_mid, lo: h.pm25_lo, hi: h.pm25_hi,
    label: h.ist_label || null, day_offset: h.day_offset || 0,
  }));
  const bestHour = best && best.start_h != null ? best.start_h : null;
  const inWin = (h, w) => w && w.start_h != null && h >= w.start_h && h <= (w.end_h ?? d.hours[d.hours.length - 1].h);
  /* the server's own go-out lines (/v2/playtime decisions, verbatim) —
     they already name the cleanest and the heaviest window, so the
     client's lightest/heaviest rows only show when the server sent none */
  const decs = (Array.isArray(d.decisions) ? d.decisions : [])
    .filter((x) => x && typeof x.line === 'string' && x.line.trim());
  const meta = [];
  if (d.nearest_station_km != null) meta.push(`nearest monitor ${A.fmt.km(d.nearest_station_km)}`);
  if (d.field_age_s != null) meta.push(`air read ${A.fmt.ago(Date.now() / 1000 - d.field_age_s)}`);
  zone.innerHTML = `
    ${d.sparse ? `<div class="dt-chip">${d.nearest_station_km != null
      ? esc(t('exploreThinRead', { n: Math.round(d.nearest_station_km) }))
      : esc(t('exploreThinReadNoKm'))}</div>` : ''}
    ${d.verdict ? `<div class="am-verdict">${esc(d.verdict)}</div>` : ''}
    ${departGraph(rows, { bestHour })}
    <div class="am-bestworst">
      ${decs.length ? '' : `
      ${best ? `<div class="am-bw"><span class="bw-l">lightest</span> ${esc(winWords(best))} · ~${Math.round(best.pm25_mid ?? 0)} µg/m³</div>` : ''}
      ${d.worst_window ? `<div class="am-bw"><span class="bw-l">heaviest</span> ${esc(winWords(d.worst_window))} · ~${Math.round(d.worst_window.pm25_mid ?? 0)} µg/m³</div>` : ''}`}
      ${decs.map((x) => `<div class="am-bw"><span class="bw-l">${esc(x.label)}</span> ${esc(x.line)}</div>`).join('')}
      ${d.mean_pm25 != null ? `<div class="am-bw muted">${esc(t('exploreAvgLine', { n: Math.round(d.mean_pm25) }))}</div>` : ''}
      ${meta.length ? `<div class="am-meta">${esc(meta.join(' · '))}</div>` : ''}
    </div>`;
  bindDepartGraph(zone);
}
function winWords(w) {
  const a = w.start_label || '', b = w.end_label || '';
  return b && b !== a ? `${a}–${b}` : a;
}

/* ── place picker — same surface whereto uses, one anchor ─────────── */
function openPicker() {
  const body = st.body;
  st.pickOpen = true;
  body.innerHTML = `
    <div class="searchbar">
      <span class="sdot a"></span>
      <input type="text" autocomplete="off" autocorrect="off" spellcheck="false"
        placeholder="name a place in delhi — a park, a block, a market">
    </div>
    <div class="am-quick">
      ${A.geo.pos ? `<button class="srow" type="button" data-me="1"><span class="ic">◉</span>
        <span><span class="n">your current location</span><span class="s" style="display:block">${esc(A.geo.pos.label || 'where you are')}</span></span></button>` : ''}
      <button class="srow" type="button" data-pin="1"><span class="ic">◎</span>
        <span><span class="n">drop a pin on the map</span><span class="s" style="display:block">tap anywhere — the hours are read there</span></span></button>
      <button class="srow" type="button" data-back="1"><span class="ic">‹</span>
        <span><span class="n">back to the air map</span></span></button>
    </div>
    <div class="row-list am-rows"></div>`;
  const input = body.querySelector('input');
  const rows = body.querySelector('.am-rows');
  const recents = A.store.get(PICK_KEY + '.recent', []);
  const finish = (p) => {
    st.place = { lat: p.lat, lon: p.lon, label: p.name || p.label || 'dropped pin' };
    A.store.set(PICK_KEY, st.place);
    const rs = recents.filter((r) =>
      `${(r.label || '').toLowerCase()}|${r.lat.toFixed(3)}` !==
      `${(st.place.label || '').toLowerCase()}|${st.place.lat.toFixed(3)}`);
    rs.unshift(st.place);
    A.store.set(PICK_KEY + '.recent', rs.slice(0, 6));
    renderMain();
    planCard();
  };
  const meBtn = body.querySelector('[data-me]');
  if (meBtn) meBtn.addEventListener('click', () =>
    finish({ lat: A.geo.pos.lat, lon: A.geo.pos.lon, name: A.geo.pos.label || 'your spot' }));
  body.querySelector('[data-pin]').addEventListener('click', () => {
    st.armed = true;
    A.toast('tap the map — the 24-hour read moves there');
    renderMain();
  });
  body.querySelector('[data-back]').addEventListener('click', renderMain);
  const draw = (list, note) => {
    rows.innerHTML = note ? `<div class="muted" style="padding:10px 6px">${note}</div>` : '';
    list.forEach((r) => {
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'srow';
      el.innerHTML = `<span class="ic">◦</span><span style="min-width:0">
        <span class="n">${esc(r.name)}</span>
        <span class="s" style="display:block">${esc([r.sub, r.dist != null ? A.fmt.km(r.dist / 1000) + ' away' : null].filter(Boolean).join(' · '))}</span></span>
        <span class="src">${esc(r.source || '')}</span>`;
      el.addEventListener('click', () => finish(r));
      rows.appendChild(el);
    });
  };
  const showRecents = () => draw(
    recents.map((r) => ({ name: r.label, sub: '', dist: null, lat: r.lat, lon: r.lon, source: 'recent' })),
    recents.length ? '' : 'recent places will live here');
  showRecents();
  let deb = null, seq = 0;
  const NONE = 'nothing found — try a landmark, a block, a sector';
  const rawTag = (x) => /^[a-z_]+:[a-z_ ]+$/i.test(x || '');   // 'amenity:place of worship' never shows
  const norm = (list) => (Array.isArray(list) ? list : []).filter((r) => r && isFinite(r.lat) && isFinite(r.lon))
    .map((r) => {
      const sub = r.sub || r.subtitle || '';
      return { ...r, name: r.name || r.label || 'a place', sub: rawTag(sub) ? '' : sub,
        dist: r.dist ?? r.distance_m ?? null, source: '' };
    });
  input.addEventListener('input', () => {
    clearTimeout(deb);
    const q = input.value;
    const my = ++seq;
    if (q.trim().length < 2) { showRecents(); return; }
    rows.innerHTML = `<div class="muted" style="padding:10px 6px">searching…</div>`;
    const bias = A.geo.pos || A.DELHI;
    deb = setTimeout(async () => {
      /* the engine's own index answers in well under a second — paint it
         first; the full cascade below replaces it when it lands */
      let shown = false;
      A.api.get(`/v2/search?q=${encodeURIComponent(q.trim())}&lat=${bias.lat.toFixed(4)}&lon=${bias.lon.toFixed(4)}`, 6000)
        .then((j) => {
          const r = norm(j && j.results).slice(0, 8);
          if (my === seq && r.length && !shown) draw(r, '');
        });
      if (typeof A.search.live === 'function') {
        /* lane S's type-ahead: rows stream in tier by tier — the newest
           keystroke owns the list, a late tier never repaints an old one */
        let got = false;
        const onRows = (list) => {
          if (my !== seq) return;
          const r = norm(list);
          if (r.length) { got = true; shown = true; draw(r, ''); }
        };
        try {
          const fin = await A.search.live(q, bias, onRows);
          if (my !== seq) return;
          if (Array.isArray(fin) && fin.length) onRows(fin);
        } catch (e) { /* fall through to the plain search below */ }
        if (my !== seq || got) return;
      }
      const res = norm(await A.search.search(q, bias));
      if (my !== seq) return;
      if (res.length) { shown = true; draw(res, ''); }
      else if (!rows.querySelector('.srow')) draw([], NONE);
    }, 220);
  });
  requestAnimationFrame(() => input.focus());
}

/* ── DelhiToday — the city-day sheet content ───────────────────────── */
const WHO_DAILY_UG = 216;   // shell/settings: WHO 24h 15µg/m³ × ~14.4 m³
function citySection(data, moves, own) {
  const breathD = data.breath, pm = breathD && breathD.pm25_ugm3, inhaled = breathD && breathD.day_inhaled_ug;
  const ageMin = data.freshness && data.freshness.age_min != null ? data.freshness.age_min : null;
  const stale = (data.freshness && data.freshness.label === 'stale') || (ageMin != null && ageMin > 15);
  const offline = stationsOffline(data);
  const corridors = data.corridors ?? [];
  const day = (data.trips && data.trips.today) || null;
  const stStations = data.provenance && data.provenance.stations;
  const tr = data.provenance && data.provenance.trips;
  const bandI = pm ? bandIdx(pm.mid) ?? 0 : 0;

  const species = (() => {
    const sp = data.species;
    if (!sp) return '';
    const tiles = [];
    const push = (key, label, who) => {
      const v = sp[key];
      if (v) tiles.push({ label, val: `${Math.round(v.mean)}`, who, over: who != null && v.mean > who });
    };
    push('pm10', 'PM10', 45); push('nitrogen_dioxide', 'NO₂', 25); push('ozone', 'O₃', 100);
    push('carbon_monoxide', 'CO', 4000); push('sulphur_dioxide', 'SO₂', 40); push('ammonia', 'NH₃', null);
    /* no US AQI tile: this app quotes ONE index (CPCB, the hero's) */
    if (!tiles.length) return '';
    return `
      <div class="dt-sec">${esc(t('citySpeciesCity'))}</div>
      <div class="dt-grid">${tiles.map((tile, i) => `
        <div class="dt-species${i > 0 ? ' sep' : ''}">
          <span class="dt-slab">${esc(tile.label)}</span>
          <span class="dt-sval num" style="color:${tile.over ? '#C05F3A' : '#16181D'}">${esc(tile.val)}</span>
          <span class="dt-swho num">${esc(tile.whoTxt ?? (tile.who != null ? t('whoRef', { n: tile.who }) : ''))}</span>
        </div>`).join('')}</div>
`;
  })();

  const typical = data.typical && data.typical.vs_now_pct != null ? `
    <div class="dt-note">${esc(t(data.typical.vs_now_pct < 0 ? 'cityTypicalBelow' : 'cityTypicalAbove', {
      p: Math.abs(Math.round(data.typical.vs_now_pct)), med: Math.round(data.typical.median) }))}</div>` : '';

  const forecast = (() => {
    const hrs = data.next_hours;
    if (!hrs || hrs.length < 2) return '';
    const max = Math.max(...hrs.map((x) => x.pm25), 1);
    return `
      <div class="dt-sec">${esc(t('cityForecastTitle'))}</div>
      <div class="dt-fcrow">${hrs.map((x) => `
        <div class="dt-fccol">
          <span class="dt-fcval num">${x.h % 3 === 0 ? Math.round(x.pm25) : ''}</span>
          <i class="dt-fcbar" style="height:${4 + Math.round(28 * x.pm25 / max)}px;background:${bandColor(x.pm25) ?? '#6E7278'}"></i>
          <span class="dt-fchr num">${x.h === 0 ? t('cityForecastNow') : x.h % 3 === 0 ? t('hourTick', { n: x.h }) : ''}</span>
        </div>`).join('')}</div>
`;
  })();

  const agg = own === null ? '' : own === 0 ? `
      <div class="dt-ownempty">
        <div class="dt-ownline">${esc(t('cityNoOwnTrips'))}</div>
        <div class="dt-ownsub">${esc(t('cityNoOwnTripsSub'))}</div>
      </div>` : `
      <div class="dt-sec">${esc(t('cityStreetsTitle'))}</div>
      ${corridors.length === 0
        ? `<div class="dt-empty">${esc(t('cityEmptyStreets'))}</div>`
        : `<div class="dt-grid">${corridors.map((c, i) => `
            <div class="dt-crow${i > 0 ? ' sep' : ''}">
              <span class="dt-cglyph">${icon('pin', '#4A4E57', 18)}</span>
              <span class="dt-ctext">
                <span class="dt-cname">${esc(c.name ? streetName(c.name) : t('cityUnnamed'))}</span>
                <span class="dt-csub num">${esc(t('cityTrips', { n: c.trips, tripNoun: t(c.trips === 1 ? 'tripNounOne' : 'tripNounMany') }))}</span>
              </span>
              <span class="dt-crel" style="color:${c.relative === 'heavier' ? '#C05F3A' : '#4A4E57'}">${esc(t(c.relative === 'heavier' ? 'cityHeavier' : 'cityLighter'))}</span>
            </div>`).join('')}</div>`}
      ${day && day.trips > 0 ? `
        <div class="dt-sec">${esc(t('cityTravellersTitle'))}</div>
        <div class="dt-dayqual">${esc(t('cityTodayUtc'))}</div>
        <div class="dt-dayline num">${esc(t('cityTravellersLineUg', {
          trips: day.trips,
          tripNoun: t(day.trips === 1 ? 'tripNounOne' : 'tripNounMany'),
          km: fmtKm(day.km), ug: approx(Math.round(day.dose_ug)), kg: fmtKg(day.co2_kg_mid) }))}</div>
        ${day.switched > 0 ? `<div class="dt-dayline num">${esc(t('citySwitched', {
          n: day.switched, tripNoun: t(day.switched === 1 ? 'tripNounOne' : 'tripNounMany') }))}</div>` : ''}` : ''}
      ${cityMovesCard(moves)}`;

  return `
    <div class="am-spot"></div>

    <div class="dt-chips">
      ${ageMin != null && !stale ? `<span class="dt-chip">${icon('clock', '#6E7278', 14)}<span>${esc(t('updatedMinAgo', { n: Math.max(1, Math.round(ageMin)) }))}</span></span>` : ''}
      ${stale ? `<span class="dt-chip">${icon('clock', '#6E7278', 14)}<span>${esc(t('cityStale'))}</span></span>` : ''}
      ${offline ? `<span class="dt-chip">${icon('info', '#6E7278', 14)}<span>${esc(t('dataFromModelOnly'))}</span></span>` : ''}
    </div>

    <div class="dt-sec">${esc(t('cityGoOut'))}</div>
    <button class="searchbar am-place" type="button">
      <span class="sdot a"></span>
      <span class="am-place-label">${esc(placeLabel())}</span>
      <span class="am-place-edit">change</span>
    </button>
    <div class="am-plan"></div>

    ${species}
    ${typical}
    ${forecast}
    ${agg}

    <button class="dt-whybtn" type="button">
      ${icon('info', '#4A4E57', 16)}
      <span class="dt-whylabel">${esc(t('cityWhyTitle'))}</span>
      <span class="dt-whychev">${icon('chevron', '#6E7278', 14)}</span>
    </button>
    <div class="dt-whybody" hidden>
      <div class="dt-whyline">${esc(t('cityBasisModel'))}</div>
      <div class="dt-whyline">${esc(offline ? t('cityBasisNoStations') : t('cityBasisStations', { n: stStations?.count ?? 0 }))}</div>
      ${pm ? `<div class="dt-whyline">${esc(t('cityBasisPm25Ug', { lo: Math.round(pm.lo), hi: Math.round(pm.hi) }))}</div>` : ''}
      <div class="dt-whyline">${esc(t('cityBasisBand'))}</div>
      <div class="dt-whyline">${esc((tr?.window_h ?? 72) % 24 === 0
        ? t('cityBasisPrivacyDays', { k: tr?.k_min ?? 3, d: Math.round((tr?.window_h ?? 72) / 24) })
        : t('cityBasisPrivacy', { k: tr?.k_min ?? 3, h: tr?.window_h ?? 72 }))}</div>
    </div>`;
}

/* CityMoves — the how-Delhi-moves card (verbatim) */
const MODE_META = {
  metro: { icon: 'metro', label: 'vehicle_metro', color: '#4A4E57' },
  bus: { icon: 'bus', label: 'vehicle_bus', color: '#4A4E57' },
  walk: { icon: 'walk', label: 'vehicle_walk', color: '#4A4E57' },
  cycle: { icon: 'cycle', label: 'vehicle_cycle', color: '#6E7278' },
  bike: { icon: 'bike', label: 'vehicle_bike', color: '#CF8A50' },
  auto: { icon: 'auto', label: 'vehicle_auto', color: '#C05F3A' },
  erick: { icon: 'erick', label: 'vehicle_auto', color: '#C05F3A' },
  cab: { icon: 'cab', label: 'vehicleCab', color: '#A83D30' },
  car: { icon: 'car', label: 'vehicle_car', color: '#A83D30' },
  car_open: { icon: 'car', label: 'vehicle_car', color: '#A83D30' },
  other: { icon: 'flag', color: '#8A8D94' },
};
const META_FALLBACK = { icon: 'flag', color: '#8A8D94' };
function modeLabelOf(m) {
  const meta = MODE_META[m];
  if (meta && meta.label) return t(meta.label);
  if (m === 'other') return t('movesModeOther');
  return m;
}
function cityMovesCard(data) {
  if (data === null) {
    return `<div class="dt-moves"><div class="dt-mvnote">${esc(t('cityLoading'))}</div></div>`;
  }
  const minK = data.min_k ?? 3;
  const windowDays = (data.window && data.window.days) ?? 7;
  const corridors = data.corridors, perTrip = data.per_trip;
  const suppressed = data.mode_share_suppressed_trips ?? 0;
  const share = data.mode_share || [];
  const bandRow = (label, band, unit, fmt) => !band ? '' : `
    <div class="dt-mvbrow">
      <span class="dt-mvblab">${esc(label)}</span>
      <span class="dt-mvbvals">
        <span class="dt-mvbmid num">${esc(t('movesTypical'))} ≈${fmt(band.p50)} ${unit}</span>
        <span class="dt-mvbband num">${fmt(band.p25)}–${fmt(band.p75)}</span>
      </span>
    </div>`;
  return `<div class="dt-moves">
    <div class="dt-mvtitle">${esc(t('movesTitle'))}</div>
    <div class="dt-mvsub num">${esc(windowDays === 7 ? t('ledgerLast7') : t('movesWindowDays', { d: windowDays }))}  ·  ${esc(t('cityTrips', { n: data.n_trips, tripNoun: t(data.n_trips === 1 ? 'tripNounOne' : 'tripNounMany') }))}</div>
    ${data.insufficient_data ? `<div class="dt-mvnote">${esc(t('movesNotEnough', { k: minK, d: windowDays }))}</div>` : `
      ${share.length ? `<div class="dt-mvbar">${share.map((r) =>
        `<i style="flex-grow:${r.trips};background:${(MODE_META[r.mode] ?? META_FALLBACK).color}"></i>`).join('')}</div>` : ''}
      ${share.map((r) => { const meta = MODE_META[r.mode] ?? META_FALLBACK; return `
        <div class="dt-mvrow">
          ${icon(meta.icon, meta.color, 18)}
          <span class="dt-mvname">${esc(modeLabelOf(r.mode))}</span>
          <span class="dt-mvpct num">${fmtPct(r.share)}</span>
          <span class="dt-mvtrips num">${esc(t('cityTrips', { n: r.trips, tripNoun: t(r.trips === 1 ? 'tripNounOne' : 'tripNounMany') }))}</span>
        </div>`; }).join('')}
      ${suppressed > 0 ? `<div class="dt-mvnote num">${esc(t('movesSuppressed', { n: suppressed, k: minK }))}</div>` : ''}
      ${corridors ? `<div class="dt-mvbrow">
        <span class="dt-mvblab">${esc(t((corridors.window_h ?? 72) % 24 === 0 ? 'movesCorridorNDays' : 'movesCorridorN', {
          n: corridors.active ?? 0, d: Math.round((corridors.window_h ?? 72) / 24), h: corridors.window_h ?? 72,
          streetNoun: t((corridors.active ?? 0) === 1 ? 'streetNounOne' : 'streetNounMany') }))}</span>
        <span class="dt-mvbvals">${corridors.avg_dose_ug ? `<span class="dt-mvbband num">${esc(t('tripsDoseBand', { lo: fmtUgS(corridors.avg_dose_ug.p25), hi: fmtUgS(corridors.avg_dose_ug.p75) }))}</span>` : ''}</span>
      </div>` : ''}
      ${perTrip ? bandRow(t('compare_smokeIn'), perTrip.dose_ug, 'µg', fmtUgS)
        + bandRow(t('compare_smokeOut'), perTrip.co2_kg, 'kg', fmtKg)
        + (perTrip.pm25_g ? `<div class="dt-mvnote num">${esc((() => {
            const lo = fmtUgS(perTrip.pm25_g.p25), hi = fmtUgS(perTrip.pm25_g.p75);
            return t(lo === hi ? 'receipt_pmBandOne' : 'receipt_pmBand', lo === hi ? { x: hi } : { lo, hi });
          })())}</div>` : '') : ''}
      <div class="dt-mvfoot">${esc(t('cityBasisPrivacy', { k: minK, h: corridors?.window_h ?? 72 }))}</div>`}
  </div>`;
}

/* ── the hero — the air at your live spot: /aqi there, band colour ─── */
const distM = (a, b) => {
  const kx = 111320 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
  return Math.hypot((a.lat - b.lat) * 110574, (a.lon - b.lon) * kx);
};
function spotPos() {
  const p = A.geo.pos;
  return p && isFinite(p.lat) && isFinite(p.lon) ? p : null;
}
function spotHtml(j, pos) {
  if (!pos) return `<div class="am-hero"><div class="am-hlead">${esc(t('spotNone'))}</div></div>`;
  const lead = pos.label ? t('spotLeadAt', { place: pos.label }) : t('spotLead');
  if (j === 'pending') {
    return `<div class="am-hero"><div class="am-hlead">${esc(lead)}</div>
      <div class="am-hwait">${esc(t('spotReading'))}</div></div>`;
  }
  /* the CPCB AQI from this spot's PM2.5 + PM10 — the home hero's own
     index, so the two screens never quote different numbers */
  const v = j ? aqiOf(j.pm25, j.pm10) : null;
  if (!v) {
    const outside = j && typeof j.error === 'string' && /outside/.test(j.error);
    return `<div class="am-hero"><div class="am-hlead">${esc(lead)}</div>
      <div class="am-hwait">${esc(outside ? t('spotOutside') : t('spotOffline'))}</div></div>`;
  }
  const i = v.band ?? 0;
  const ink = bandInkIdx(i);
  const isN = (x) => typeof x === 'number' && isFinite(x);
  const thin = !!j.beyond_field_edge || (j.nearest_station_km != null && j.nearest_station_km > 10);
  const big = `<span class="am-hnum num" style="color:${ink}">${v.aqi}${v.over ? '+' : ''}</span><span class="am-hunit">${esc(t('spotAqi'))}</span>`;
  return `<div class="am-hero" style="background:linear-gradient(${bandWashDeepIdx(i)}, #FAFAF7)">
    <div class="am-hlead">${esc(lead)}</div>
    <div class="am-hrow">${big}</div>
    <div class="am-hband" style="color:${ink}">${esc(t(BAND_KEYS[i]))}</div>
    <div class="am-hspecies num">
      ${isN(j.pm25) ? `<span><b>PM2.5</b> ${Math.round(j.pm25)} µg/m³</span>` : ''}
      ${isN(j.pm10) ? `<span><b>PM10</b> ${Math.round(j.pm10)} µg/m³</span>` : ''}
    </div>
    ${bandScale(i)}
    ${thin && j.nearest_station_km != null ? `<div class="am-hthin">${esc(t(j.beyond_field_edge ? 'spotNearestEst' : 'spotNearest', { n: Math.round(j.nearest_station_km) }))}</div>` : ''}
  </div>`;
}
function paintSpot() {
  if (!st) return;
  const z = st.body.querySelector('.am-spot');
  if (!z) return;
  const pos = spotPos();
  if (!pos) { z.innerHTML = spotHtml(null, null); return; }
  if (st.spot && distM(st.spot.pos, pos) < 60) z.innerHTML = spotHtml(st.spot.j, st.spot.pos);
  else { z.innerHTML = spotHtml('pending', pos); pullSpot(); }
}
async function pullSpot() {
  if (!st) return;
  const pos = spotPos();
  if (!pos) { paintSpot(); return; }
  const key = `${pos.lat.toFixed(4)},${pos.lon.toFixed(4)}`;
  if (st.spotKey === key) return;            // that read is already on its way
  st.spotKey = key;
  const j = await A.aqiSpot(pos.lat, pos.lon, 9000);
  if (!st || st.spotKey !== key) return;
  st.spotKey = null;
  st.spot = { pos: { lat: pos.lat, lon: pos.lon, label: pos.label || null }, j, t: Date.now() };
  const z = st.body.querySelector('.am-spot');
  if (z) z.innerHTML = spotHtml(j, st.spot.pos);
}
/* centre the spot in the map strip the sheet leaves open */
function flyToSpot(pos, zoom) {
  const wide = window.matchMedia && window.matchMedia('(min-width: 720px)').matches;
  A.map.fly(pos.lat, pos.lon, zoom, wide ? {} : { offset: [0, -Math.round(window.innerHeight * 0.29)] });
}

/* ── the search composer — the Where To row's twin, floating over the
   map: progressive /v2/ac + /v2/p/ac suggestions via A.search.live (the
   picker's own cascade when it's absent). A pick is exactly a map tap:
   the map flies there, the AQI pin drops, the readout answers and the
   go-out card re-reads that spot. The ✕ returns to the live location.
   Nothing here needs WebGL — fly/pin are no-ops on a dead map while the
   readout and the card still answer. */
let sc = null;
const SC_NORM = (s) => String(s == null ? '' : s).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const SC_WORD = /[a-z0-9]+/g;
const SC_STOP = new Set(['the', 'of', 'to', 'in', 'at', 'near', 'and', 'a', 'an', 'on', 'opp', 'opposite', 'behind', 'by']);
const scToks = (q) => (SC_NORM(q).match(SC_WORD) || []).filter((w) => !SC_STOP.has(w));
const scRowKey = (r) => `${r.name || ''}|${(+r.lat || 0).toFixed(4)}|${(+r.lon || 0).toFixed(4)}`;
function scMatches(r, toks) {
  if (!toks.length) return true;
  const words = SC_NORM(`${r.name} ${r.sub || ''}`).match(SC_WORD) || [];
  return toks.every((tk) => words.some((w) => w.startsWith(tk)));
}
const scDist = (m) => m == null ? '' : m < 1000 ? `${Math.max(50, Math.round(m / 50) * 50)} m`
  : m < 10000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 1000)} km`;
/* whereto's matchSpans: bold the words the query touched, dim the rest */
function scSpans(title, q) {
  const toks = scToks(q).filter((w) => w.length >= 2);
  if (!toks.length) return esc(title);
  const n = SC_NORM(title);
  let html = '', i = 0;
  for (const m of n.matchAll(SC_WORD)) {
    if (m.index > i) html += esc(title.slice(i, m.index));
    const word = m[0];
    const hit = toks.some((tk) => word.startsWith(tk) || tk.startsWith(word));
    const seg = esc(title.slice(m.index, m.index + word.length));
    html += hit ? `<b>${seg}</b>` : `<span class="am-sdim">${seg}</span>`;
    i = m.index + word.length;
  }
  html += esc(title.slice(i));
  return html;
}
const scKindGlyph = (kind) => {
  const k = String(kind || '').toLowerCase();
  if (/metro|subway|rail|station/.test(k)) return 'metro';
  if (/bus|transit/.test(k)) return 'bus';
  return 'pin';
};
const scBias = () => (A.geo && A.geo.pos) || A.DELHI;
const scRecents = () => (A.store.get(PICK_KEY + '.recent', []) || [])
  .filter((r) => r && isFinite(+r.lat) && isFinite(+r.lon) && (r.label || r.name));
function scPushRecent(place) {
  const rs = scRecents().filter((r) =>
    `${SC_NORM(r.label || '')}|${(+r.lat).toFixed(3)}` !== `${SC_NORM(place.label || '')}|${(+place.lat).toFixed(3)}`);
  rs.unshift({ lat: place.lat, lon: place.lon, label: place.label });
  A.store.set(PICK_KEY + '.recent', rs.slice(0, 6));
}
function scClean(list) {
  const out = [], seen = new Set();
  for (const r of (Array.isArray(list) ? list : [])) {
    if (!r || !isFinite(+r.lat) || !isFinite(+r.lon)) continue;
    const name = String(r.name || r.label || '').trim();
    if (!name) continue;
    const sub = r.sub || r.subtitle || '';
    const row = { ...r, name, lat: +r.lat, lon: +r.lon,
      sub: /^[a-z_]+:[a-z_ ]+$/i.test(sub) ? '' : sub,
      dist: r.dist ?? r.distance_m ?? null };
    const k = scRowKey(row);
    if (seen.has(k)) continue;
    seen.add(k); out.push(row);
  }
  return out;
}
/* near-first combining — whereto's rule: same-name rows keep their tier
   position and sort nearest-first inside it */
function scNearFirst(rows) {
  const groups = new Map(), order = [];
  for (const r of rows) {
    const k = SC_NORM(r.name || '').replace(/[^a-z0-9]+/g, ' ').trim();
    if (!groups.has(k)) { groups.set(k, []); order.push(k); }
    groups.get(k).push(r);
  }
  const out = [];
  for (const k of order) out.push(...groups.get(k).sort((a, b) => (a.dist ?? 9e12) - (b.dist ?? 9e12)));
  return out;
}
function scRowHtml(r, i) {
  return `<button class="am-srow" type="button" data-i="${i}">
    <span class="am-sgb">${icon(r._recent ? 'clock' : scKindGlyph(r.kind || r.rawKind || r.sub), '#4A4E57', 18)}</span>
    <span class="am-srt"><span class="am-srt-t">${scSpans(r.name, sc.q)}</span>
      ${r.sub ? `<span class="am-srt-s">${esc(r.sub)}</span>` : ''}</span>
    ${r.dist != null ? `<span class="am-sdist">${esc(scDist(r.dist))}</span>` : ''}
  </button>`;
}
function scBindRows() {
  sc.list.querySelectorAll('.am-srow').forEach((b) => {
    b.addEventListener('pointerdown', (e) => e.preventDefault());   // row taps never steal the input's focus
    b.addEventListener('click', () => { const r = sc.rows[+b.dataset.i]; if (r) scPick(r); });
  });
}
function scShowList() { sc.open = true; sc.list.hidden = false; }
function scHideList() { sc.open = false; sc.list.hidden = true; }
function scPaint() {
  if (!sc) return;
  const qt = sc.q.trim();
  let h = '';
  if (qt.length < 2) {
    const bias = scBias();
    sc.rows = scRecents().slice(0, 6).map((r) => ({ name: r.label || r.name, sub: '',
      lat: +r.lat, lon: +r.lon, dist: bias ? distM(bias, { lat: +r.lat, lon: +r.lon }) : null, _recent: true }));
    if (!sc.rows.length) { scHideList(); return; }
    h += `<div class="am-ssec">${esc(t('scRecent'))}</div>`;
    h += sc.rows.map((r, i) => scRowHtml(r, i)).join('');
  } else {
    const searching = !sc.final;
    if (searching) h += `<div class="am-sprog" role="progressbar" aria-label="${esc(t('scSearching'))}"><i></i></div>`;
    /* honest closeness: the settled answer holds nothing carrying every
       typed word — say so above the nearest guesses */
    if (sc.final && sc.rows.length && !sc.rows.some((r) => scMatches(r, scToks(qt))))
      h += `<div class="am-ssec">${esc(t('scNoExact'))}</div>`;
    h += sc.rows.map((r, i) => scRowHtml(r, i)).join('');
    if (!sc.rows.length)
      h += `<div class="am-squiet">${esc(sc.slow ? t('scSlow') : searching ? t('scSearching') : t('scNone'))}</div>`;
  }
  sc.list.innerHTML = h;
  scBindRows();
}
function scCancel() {
  if (!sc) return;
  clearTimeout(sc.timer);
  if (sc.guard) { clearTimeout(sc.guard); sc.guard = 0; }
  if (sc.cur) { try { sc.cur(); } catch (e) { /* already done */ } sc.cur = null; }
}
function onScQ(v) {
  sc.q = v;
  sc.x.hidden = !v && !sc.picked;
  sc.seq++;
  sc.slow = false;
  if (v.trim().length < 2) { sc.rows = []; sc.final = true; scPaint(); if (sc.rows.length) scShowList(); return; }
  /* the last answer narrows in place — only rows still carrying every
     typed word survive while the next answer is on its way */
  if (sc.rows.length) sc.rows = sc.rows.filter((r) => scMatches(r, scToks(v)));
  sc.final = false;
  scPaint();
  scShowList();
  clearTimeout(sc.timer);
  sc.timer = setTimeout(() => scRun(v), 90);
}
function scRun(v, opts) {
  if (!sc) return;
  const seq = ++sc.seq;
  const bias = scBias();
  const live_ = () => sc && seq === sc.seq && v === sc.q && st && A.current() === 'airmap';
  const apply = (rows, meta) => {
    if (!sc || !st || A.current() !== 'airmap') return;
    const fin = !meta || meta.final !== false;
    if (!live_()) return;
    let clean = scNearFirst(scClean(rows));
    if (!fin) clean = clean.filter((r) => scMatches(r, scToks(v)));
    if (clean.length || fin) sc.rows = clean.slice(0, 10);
    if (fin) { sc.final = true; sc.slow = false; if (sc.guard) { clearTimeout(sc.guard); sc.guard = 0; } }
    scPaint();
  };
  sc.slow = false;
  if (sc.guard) clearTimeout(sc.guard);
  /* never a spinner that never ends: past 15 s the hint stops and an
     honest "taking long" line shows (late rows still land) */
  sc.guard = setTimeout(() => { if (live_() && !sc.final) { sc.final = true; sc.slow = true; sc.guard = 0; scPaint(); } }, 15000);
  if (typeof A.search.live === 'function') {
    try {
      const c = A.search.live(v, bias, (rows, meta) => apply(rows, meta || { final: false }), opts || {});
      sc.cur = typeof c === 'function' ? c : (c && typeof c.cancel === 'function' ? () => c.cancel() : null);
      return;
    } catch (e) { sc.cur = null; /* fall through to the one-shot cascade */ }
  }
  Promise.resolve(A.search.search(v, bias, opts || {}))
    .then((rows) => apply(rows, { final: true }))
    .catch(() => apply([], { final: true }));
}
function scPick(r) {
  if (!r || !st) return;
  scCancel();
  sc.picked = true;
  st.armed = false;
  st.tapPlace = r.name;
  st.place = { lat: +r.lat, lon: +r.lon, label: r.name };
  A.store.set(PICK_KEY, st.place);
  scPushRecent(st.place);
  sc.input.value = r.name;
  sc.x.hidden = false;
  scHideList();
  sc.input.blur();
  /* a whole locality gets the wider frame, a point the street one */
  const areaKind = /area|locality|suburb|neighbou?rhood|district|city|town|village|administrative|region|sector|colony|hamlet/i.test(`${r.kind || ''} ${r.rawKind || ''}`);
  flyToSpot(st.place, areaKind ? 13.2 : 14.8);
  tapRead(st.place.lat, st.place.lon);
  planCard();
  const lbl = st.body.querySelector('.am-place-label');
  if (lbl) lbl.textContent = st.place.label;
}
function scReset() {
  if (!sc || !st) return;
  scCancel();
  sc.q = ''; sc.rows = []; sc.final = true; sc.slow = false; sc.picked = false;
  sc.input.value = ''; sc.x.hidden = true;
  scHideList();
  st.tapPlace = null;
  if (st.readEl) st.readEl.hidden = true;
  if (tapMarker) { tapMarker.remove(); tapMarker = null; }
  const pos = spotPos();
  st.place = pos ? { lat: pos.lat, lon: pos.lon, label: 'where you are' }
    : { ...A.DELHI, label: 'central delhi' };
  A.store.set(PICK_KEY, st.place);
  if (pos) flyToSpot(pos, 14.2);
  const lbl = st.body.querySelector('.am-place-label');
  if (lbl) lbl.textContent = placeLabel();
  planCard();
}
/* a real map tap supersedes the searched place — the composer stops
   claiming a name the readout no longer describes */
function scNoteTap() {
  if (!sc || (!sc.picked && !sc.input.value)) return;
  scCancel();
  sc.picked = false; sc.q = ''; sc.rows = []; sc.final = true;
  sc.input.value = ''; sc.x.hidden = true;
  scHideList();
}
function mountComposer(el) {
  const wrap = document.createElement('div');
  wrap.className = 'am-scw';
  wrap.innerHTML = `
    <div class="am-sc">
      <i class="am-sc-dot"></i>
      <input class="am-sc-in" type="text" inputmode="search" enterkeyhint="search"
        autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"
        aria-label="${esc(t('scSearchA11y'))}" placeholder="${esc(t('scPh'))}">
      <button class="am-sc-x" type="button" aria-label="${esc(t('a11yClear'))}" hidden>${icon('close', '#6E7278', 15)}</button>
    </div>
    <div class="am-slist" hidden></div>`;
  el.appendChild(wrap);
  sc = { wrap, input: wrap.querySelector('.am-sc-in'), x: wrap.querySelector('.am-sc-x'),
    list: wrap.querySelector('.am-slist'), q: '', rows: [], final: true, slow: false,
    seq: 0, cur: null, timer: 0, guard: 0, picked: false, open: false };
  sc.input.addEventListener('input', () => { sc.picked = false; onScQ(sc.input.value); });
  sc.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      /* Go = take the top place row; nothing listed yet → look deeper now */
      const first = sc.rows[0];
      if (first) { scPick(first); return; }
      if (sc.q.trim().length >= 2) { scCancel(); sc.final = false; scPaint(); scRun(sc.q, { enter: true }); }
    }
  });
  /* Esc answers the composer before the sheet's own walk-back (motion.js
     eats Escape at document-capture): while a pick stands it returns to
     the live spot, while a search is live it clears just the text — an
     idle composer lets the key fall through to the screen's own close. */
  sc.onDocKey = (e) => {
    if (e.key !== 'Escape' || !sc) return;
    if (sc.picked) {
      e.stopImmediatePropagation(); e.preventDefault();
      scReset();
      sc.input.blur();
    } else if (sc.input.value || sc.open) {
      e.stopImmediatePropagation(); e.preventDefault();
      scCancel();
      sc.q = ''; sc.rows = []; sc.final = true;
      sc.input.value = ''; sc.x.hidden = true;
      scHideList();
      sc.input.blur();
    }
  };
  window.addEventListener('keydown', sc.onDocKey, true);
  sc.input.addEventListener('focus', () => { scPaint(); scShowList(); });
  sc.input.addEventListener('blur', () => { setTimeout(() => { if (sc) scHideList(); }, 120); });
  sc.x.addEventListener('pointerdown', (e) => e.preventDefault());
  sc.x.addEventListener('click', (e) => { e.stopPropagation(); scReset(); sc.input.blur(); });
}
function unmountComposer() {
  if (!sc) return;
  scCancel();
  window.removeEventListener('keydown', sc.onDocKey, true);
  sc.wrap.remove();
  sc = null;
}

/* ── the sheet render ─────────────────────────────────────────────── */
function renderMain() {
  const body = st.body;
  st.pickOpen = false;
  st.dgSel = null;
  body.innerHTML = `<div class="am-spot"></div><div class="dt-wait">${esc(t('cityLoading'))}</div>`;
  paintSpot();
  pull();
}
async function pull() {
  const [data, moves] = await Promise.all([
    A.api.get('/v2/city', 20000),
    A.api.get('/v2/city/moves', 15000).catch(() => null),
  ]);
  if (!st || !st.body.isConnected || st.pickOpen) return;
  const own = (A.store.get(HIST_KEY, []) || []).length;
  st.cityData = data;
  if (!data) {
    st.body.innerHTML = `
      <div class="am-spot"></div>
      <div class="dt-center">
        <div class="dt-wait">${esc(t('offline'))}</div>
        <button class="dt-retry" type="button">${esc(t('cityRetry'))}</button>
      </div>
      <div class="dt-sec">${esc(t('cityGoOut'))}</div>
      <button class="searchbar am-place" type="button">
        <span class="sdot a"></span>
        <span class="am-place-label">${esc(placeLabel())}</span>
        <span class="am-place-edit">change</span>
      </button>
      <div class="am-plan"></div>`;
    st.body.querySelector('.dt-retry').addEventListener('click', pull);
    st.body.querySelector('.am-place').addEventListener('click', openPicker);
    paintSpot();
    planCard();
    return;
  }
  st.body.innerHTML = citySection(data, moves || null, own);
  paintSpot();
  st.body.querySelector('.am-place').addEventListener('click', openPicker);
  const whyBtn = st.body.querySelector('.dt-whybtn');
  const whyBody = st.body.querySelector('.dt-whybody');
  whyBtn.addEventListener('click', () => {
    const open = whyBody.hidden;
    whyBody.hidden = !open;
    whyBtn.querySelector('.dt-whychev').style.transform = open ? 'rotate(90deg)' : '';
  });
  planCard();
}

/* ── the screen ──────────────────────────────────────────────────── */
A.screen('airmap', {
  mount(el) {
    const chrome = A.sheetChrome(el, 'air around me');
    el.classList.add('am-host');
    st = {
      el, body: chrome.body,
      place: A.store.get(PICK_KEY, null)
        || (A.geo.pos ? { lat: A.geo.pos.lat, lon: A.geo.pos.lon, label: 'where you are' } : { ...A.DELHI, label: 'central delhi' }),
      armed: false, pickOpen: false,
      readEl: null, chipEl: null, cityData: null,
      spot: null, spotKey: null,
      dgRows: null, dgBest: null, dgSel: null, dgMax: 1, axisW: 0,
    };
    renderMain();

    /* the field + street colours come from the shared map */
    setFieldVisible(true);
    st.chipEl = scaleChip();
    el.appendChild(st.chipEl);
    mountComposer(el);

    /* the live dot — and the map opens on it, at street level */
    const pos0 = spotPos();
    if (pos0) {
      A.map.puckMove(pos0.lat, pos0.lon, pos0.acc || null);
      flyToSpot(pos0, 14.2);
    } else A.map.fly(A.DELHI.lat, A.DELHI.lon, 10.4);
    const follow = (p) => {
      if (!st || !p) return;
      A.map.puckMove(p.lat, p.lon, p.acc || null);
      A.map.ready((m) => {
        const b = m.getBounds();
        if (!b.contains([p.lon, p.lat])) flyToSpot(p, Math.max(13, m.getZoom()));
      });
      if (!st.spot || distM(st.spot.pos, p) > 120) pullSpot();
    };
    const watchId = A.geo.granted() ? A.geo.watch(follow) : null;
    const onLoc = (e) => follow(e.detail);
    document.addEventListener('alive:location', onLoc);

    const onTap = (e) => {
      if (A.current() !== 'airmap' || !st) return;
      st.tapPlace = null;
      scNoteTap();
      A.search.reverse(e.detail.lat, e.detail.lon).then((n) => {
        if (st && n) {
          st.tapPlace = n;
          const cap = st.readEl && st.readEl.querySelector('.amr-caption');
          if (cap && !st.readEl.hidden) cap.textContent = [n, cap.textContent.split(' · ')[1]].filter(Boolean).join(' · ');
        }
      }).catch(() => {});
      if (st.armed) {
        st.armed = false;
        const p = e.detail;
        st.place = { lat: p.lat, lon: p.lon, label: 'dropped pin' };
        A.search.reverse(p.lat, p.lon).then((n) => {
          if (n && st && st.place && st.place.label === 'dropped pin') {
            st.place.label = n;
            A.store.set(PICK_KEY, st.place);
            const lbl = st.body.querySelector('.am-place-label');
            if (lbl) lbl.textContent = n;
          }
        }).catch(() => {});
        A.store.set(PICK_KEY, st.place);
        renderMain();
        return;
      }
      tapRead(e.detail.lat, e.detail.lon);
      /* every tap is also a "planning to go out" pin: the AQI pin shows
         the air there now, and the day card below reads that same spot */
      const tp = e.detail;
      st.place = { lat: tp.lat, lon: tp.lon, label: 'pinned spot' };
      A.store.set(PICK_KEY, st.place);
      A.search.reverse(tp.lat, tp.lon).then((n) => {
        if (n && st && st.place && st.place.lat === tp.lat && st.place.lon === tp.lon) {
          st.place.label = n;
          A.store.set(PICK_KEY, st.place);
          const lbl = st.body.querySelector('.am-place-label');
          if (lbl) lbl.textContent = n;
        }
      }).catch(() => {});
      planCard();
      const lbl0 = st.body.querySelector('.am-place-label');
      if (lbl0) lbl0.textContent = st.place.label;
    };
    /* live while open: re-read the city every 5 min (the field rebuilds
       every 15), so "updated N min ago" and every number stay current */
    const liveTimer = setInterval(() => {
      if (st && A.current() === 'airmap' && !st.pickOpen) { pull(); pullSpot(); }
    }, 5 * 60000);
    document.addEventListener('alive:maptap', onTap);

    const onKey = (e) => {
      if (e.key === 'Escape' && chrome.sheetEl.classList.contains('on')) chrome.close();
    };
    document.addEventListener('keydown', onKey);

    let torn = false;
    const teardown = () => {
      if (torn) return;
      torn = true;
      clearInterval(liveTimer);
      document.removeEventListener('alive:maptap', onTap);
      document.removeEventListener('alive:location', onLoc);
      document.removeEventListener('keydown', onKey);
      A.geo.clearWatch(watchId);
      mo.disconnect();
      setFieldVisible(false);
      unmountComposer();
      if (st.readEl) st.readEl.hidden = true;
      if (st.chipEl) st.chipEl.remove();
      if (tapMarker) { tapMarker.remove(); tapMarker = null; }
      st = null;
    };
    const mo = new MutationObserver(() => {
      if (!el.classList.contains('on')) teardown();
    });
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return teardown;
  },
});
})();
