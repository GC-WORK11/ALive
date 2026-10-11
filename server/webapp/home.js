/* home.js — pixel twin of Mobile/src/screens/HomeScreen.tsx (+ the
   onboarding flow inside the frozen #consent element, the twin of
   OnboardingScreen.tsx). Same surfaces, same card order, same strings,
   same shapes, same type scale, same spacing. The web runtime (A.api,
   A.geo, A.store, A.fmt, A.map, A.search, A.show) stays.

   What the RN file owns that the web cannot (in
   docs/lanes/twin-home-report.md): on-device dose reconstruction
   (daylog.ts → counted-day hero, DayCard arc, week strip, heroWeekRow)
   and the trips ledger. Those surfaces take the RN honest-empty shape
   — never a fake number. */
(() => {
'use strict';

const POLL_MS = 5 * 60 * 1000, TICK_MS = 30 * 1000;

/* ── icons: Material Symbols Rounded paths on the 960 grid,
      the same set Mobile/src/icons.tsx draws for these screens ── */
const ICONS = {
  "search": ["M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"],
  "navigate": ["M480-240 222-130q-13 5-24.5 2.5T178-138q-8-8-10.5-20t2.5-25l273-615q5-12 15.5-18t21.5-6q11 0 21.5 6t15.5 18l273 615q5 13 2.5 25T782-138q-8 8-19.5 10.5T738-130L480-240Zm-196-4 196-84 196 84-196-440-196 440Zm196-84Z"],
  "explore": ["M480-440q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520q17 0 28.5 11.5T520-480q0 17-11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320ZM297-277l250-117q6-3 11-8t8-11l117-250q5-10-2.5-17.5T663-683L413-566q-6 3-11 8t-8 11L277-297q-5 10 2.5 17.5T297-277Z"],
  "city": ["M120-200v-400q0-33 23.5-56.5T200-680h160v-47q0-16 6-30.5t17-25.5l40-40q23-23 57-23t57 23l40 40q11 11 17 25.5t6 30.5v207h160q33 0 56.5 23.5T840-440v240q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200Zm80 0h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm240 320h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm240 480h80v-80h-80v80Zm0-160h80v-80h-80v80Z"],
  "history": ["M480-120q-126 0-223-76.5T131-392q-4-15 6-27.5t27-14.5q16-2 29 6t18 24q24 90 99 147t170 57q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h70q17 0 28.5 11.5T360-600q0 17-11.5 28.5T320-560H160q-17 0-28.5-11.5T120-600v-160q0-17 11.5-28.5T160-800q17 0 28.5 11.5T200-760v54q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm40-376 100 100q11 11 11 28t-11 28q-11 11-28 11t-28-11L452-452q-6-6-9-13.5t-3-15.5v-159q0-17 11.5-28.5T480-680q17 0 28.5 11.5T520-640v144Z"],
  "flame": ["M480-80q-134 0-227-93t-93-227q0-113 67-217t184-182q22-15 45.5-1.5T480-760v52q0 34 23.5 57t57.5 23q17 0 32.5-7.5T621-657q8-10 20.5-12.5T665-664q63 45 99 115t36 149q0 134-93 227T480-80ZM240-400q0 52 21 98.5t60 81.5q-1-5-1-9v-9q0-32 12-60t35-51l113-111 113 111q23 23 35 51t12 60v9q0 4-1 9 39-35 60-81.5t21-98.5q0-50-18.5-94.5T648-574q-20 13-42 19.5t-45 6.5q-62 0-107.5-41T401-690q-78 66-119.5 140.5T240-400Zm240 52-57 56q-11 11-17 25t-6 29q0 32 23.5 55t56.5 23q33 0 56.5-23t23.5-55q0-16-6-29.5T537-292l-57-56Z"],
  "pin": ["M480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 79q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 45-17.5 94.5t-51 103Q698-301 648-244T533-127q-11 10-25 15t-28 5Zm0-453Zm0 80q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z"],
  "chevron": ["M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z"],
  "locate": ["M440-82v-40q-125-14-214.5-103.5T122-440H82q-17 0-28.5-11.5T42-480q0-17 11.5-28.5T82-520h40q14-125 103.5-214.5T440-838v-40q0-17 11.5-28.5T480-918q17 0 28.5 11.5T520-878v40q125 14 214.5 103.5T838-520h40q17 0 28.5 11.5T918-480q0 17-11.5 28.5T878-440h-40q-14 125-103.5 214.5T520-122v40q0 17-11.5 28.5T480-42q-17 0-28.5-11.5T440-82Zm40-118q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400Zm0-80Z"],
  "dust": ["M460-160q-32 0-59.5-16T356-220q-11-20-.5-40t32.5-20q13 0 23 8t18 18q5 7 13.5 10.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H120q-17 0-28.5-11.5T80-360q0-17 11.5-28.5T120-400h340q50 0 85 35t35 85q0 50-35 85t-85 35ZM120-560q-17 0-28.5-11.5T80-600q0-17 11.5-28.5T120-640h500q25 0 42.5-17.5T680-700q0-25-17.5-42.5T620-760q-16 0-30 7.5T568-731q-7 12-17 21.5t-24 9.5q-20 0-32.5-15t-6.5-32q14-42 50.5-67.5T620-840q58 0 99 41t41 99q0 58-41 99t-99 41H120Zm678 308q-20 9-39-2.5T740-288q0-14 9.5-23.5T771-328q14-8 21.5-22t7.5-30q0-25-17.5-42.5T740-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h620q58 0 99 41t41 99q0 42-22 76.5T798-252Z"],
  "flag": ["M280-400v240q0 17-11.5 28.5T240-120q-17 0-28.5-11.5T200-160v-600q0-17 11.5-28.5T240-800h287q14 0 25 9t14 23l10 48h184q17 0 28.5 11.5T800-680v320q0 17-11.5 28.5T760-320H553q-14 0-25-9t-14-23l-10-48H280Zm306 0h134v-240H543q-14 0-25-9t-14-23l-10-48H280v240h257q14 0 25 9t14 23l10 48Zm-86-160Z"]
};

function ic(name, size, cls) {
  const d = ICONS[name];
  if (!d) return '';
  const paths = (Array.isArray(d) ? d : [d]).map((p) => `<path d="${p}"/>`).join('');
  return `<svg class="ic ${cls || ''}" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">${paths}</svg>`;
}

/* ── V2T palette math (Mobile/src/theme.ts) ── */
const INK = '#16181D';
const BANDS = ['#6E93AE', '#C7A34F', '#CF8A50', '#C05F3A', '#A83D30', '#6E2D28'];
const hexMix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};
const bandColorIdx = (i) => BANDS[i];
const bandWashIdx = (i) => hexMix(BANDS[i], '#FFFFFF', 0.90);
const bandWashDeepIdx = (i) => hexMix(BANDS[i], '#FFFFFF', 0.68);
const bandEdgeIdx = (i) => hexMix(BANDS[i], '#FFFFFF', 0.60);
const bandInkIdx = (i) => hexMix(BANDS[i], INK, 0.20);
const SAND = { wash: '#F1EFE9', ink: '#4A4E57' };   // V2Tint.sand = STONE

const WHO_DAILY_UG = 15;
const THIN_SAMPLE_MIN = 3;
const CLEAN_UG = 60;
const DAY_HOURS = 12;
const PROFILE_BUDGET_UG = { general: 216, sensitive: 72, child: 130 };

const bandIdx = (ug) => A.fmt.bandIdx(ug);
const bandIdxForName = (band) => {
  const m = { good: 0, satisfactory: 1, moderate: 2, poor: 3, 'very poor': 4, severe: 5 };
  return band ? (m[String(band).trim().toLowerCase()] ?? null) : null;
};
const doseTierIdx = (ug, budget) => {
  if (ug == null || !isFinite(ug) || ug <= 0 || !budget) return null;
  const r = ug / budget;
  return r < 0.34 ? 0 : r < 0.67 ? 2 : r <= 1 ? 3 : 4;
};
const doseDotColor = (ug, budget) => {
  const i = doseTierIdx(ug, budget);
  return i == null ? null : bandColorIdx(i);
};
const doseUgRound = (ug) => (ug >= 10 ? Math.round(ug) : Math.round(ug * 10) / 10);
const approx = (n) => (Number(n) === 0 ? '0' : `≈ ${n}`);

/* ── settings (Mobile/src/components/shell/settings.ts) — one shared
      key so consent, the budget card and the settings screen read the
      same truth ── */
const DEFAULT_SETTINGS = {
  lang: 'en', voice: true, share: true, brief: false, remind: true,
  alerts: true, alerts_fires: true, alerts_band: true,
  alerts_windows: true, alerts_reflect: true,
  show_cig: false, vehicle: null, home: null, work: null,
  profile: 'general', profile_set: false,
};
const getSettings = () => Object.assign({}, DEFAULT_SETTINGS, A.store.get('settings', {}));
const setSettings = (patch) => {
  const s = Object.assign(getSettings(), patch);
  A.store.set('settings', s);
  return s;
};
const profileBudgetUg = (p) => PROFILE_BUDGET_UG[p] || PROFILE_BUDGET_UG.general;

/* ── check-ins (RN store/checkin.ts — on-device only, keyed by IST day) ── */
const dayKeyOf = (t0) => {
  const d = new Date(t0 + 330 * 60000);
  return `${d.getUTCFullYear()}-${`${d.getUTCMonth() + 1}`.padStart(2, '0')}-${`${d.getUTCDate()}`.padStart(2, '0')}`;
};
const getCheckins = () => A.store.get('checkins', {});
const saveCheckin = (patch) => {
  const all = getCheckins();
  const k = dayKeyOf(Date.now());
  all[k] = Object.assign({}, all[k], patch);
  A.store.set('checkins', all);
  return all;
};

/* ── strings: verbatim en values from Mobile/src/i18n/strings.ts ── */
const S = {
  searchPlaceholder: 'Where to?', goLabel: 'go somewhere', a11yMenu: 'menu', cityName: 'Delhi',
  homeGreetMorning: 'good morning', homeGreetAfternoon: 'good afternoon',
  homeGreetEvening: 'good evening', homeGreetNight: 'up late',
  homeBreathed: "you've breathed today", homeAirForecast: 'the air expected near you',
  homeAirNowCity: 'the air near central Delhi', homeAirNowLead: 'the air around you',
  homeAirWhat: 'PM2.5 — fine dust per cubic metre of air, right now',
  homeAirWhatAqi: 'PM2.5 dust per m³ of air · same air = AQI {a} on other apps',
  homeAirWhatFc: 'expected PM2.5 per m³ of air — the forecast cell, not a live read',
  homeAirMetaPlace: 'read near {p} · nearest live monitor ~{k} km away',
  homeAirMeta: 'read at your location · nearest live monitor ~{k} km away',
  homeAirPlaceModel: 'read near {p} · no live monitors feeding the field right now',
  homeAirModel: 'read at your location · no live monitors feeding the field right now',
  homeAirEdge: "closest live monitors cover Delhi's core — this is their nearest read",
  homeAirCityHint: "location is off or hasn't locked yet — turn it on for the air where you actually are",
  homeOutsideNow: 'outside ~{n} µg/m³ · {w}', homeWeek: '{n} µg this week',
  homeLinkMap: 'Air map', homeLinkCity: 'Delhi today', homeLinkTrips: 'Trips',
  incidentsTitle: "in Delhi's air right now", noteMeasured: 'measured, not reported',
  refBudget: '{p}% of your daily limit', refBudgetSugg: '{p}% of the suggested daily limit',
  refYesterdayMore: '{n} µg more than yesterday', refYesterdayLess: '{n} µg less than yesterday',
  refWhoOver: '{x}× the WHO daily limit', refWhoUnder: 'within the WHO daily limit',
  daySparseWait: 'waiting for the first air reading today',
  daySparseCount: 'your count starts once the phone logs its first hours',
  dayCovered: '{h}h {m}m counted', dayCoveredMin: '{m}m counted',
  band_good: 'good', band_satisfactory: 'satisfactory', band_moderate: 'moderate',
  band_poor: 'poor', band_veryPoor: 'very poor', band_severe: 'severe',
  felt_easy: 'good', felt_fine: 'satisfactory', felt_fair: 'moderate',
  felt_heavy: 'poor', felt_rough: 'very poor', felt_harsh: 'severe',
  dayNow: 'now', hourTick: '+{n}h', hourTickTilde: '~{n}h',
  moveTitle: 'the move',
  dayMorningMove: 'the same plan at {f} breathes ~{x}× lighter than at {g}',
  dayMorningFlat: 'a flat day — any hour sits about as light as the next',
  dayMorningHeavy: 'heaviest ~{f}–{t} (≈{c} µg/m³)',
  dayMorningHeavyFrom: 'heaviest from ~{f} onward (≈{c} µg/m³)',
  dayMorningClean: 'lightest ~{f}–{t} (≈{c} µg/m³)',
  dayMorningCleanFrom: 'lightest from ~{f} onward (≈{c} µg/m³)',
  dayOutsideDelhi: "outside Delhi — the smoke map doesn't reach here",
  dayMorningNoCell: 'outside the air map — no hour-by-hour read here',
  dayMorningStale: 'last air reading {n} min ago',
  howWe_fieldAge: 'air reading: {n} min old', howWe_conf: 'how sure we are: {c}',
  conf_low: 'low',
  moveDec_cleanWindow: '{w} stretch {win} — around {c} µg/m³, against {m} across the day',
  moveDec_noClean: 'no clean hours left today — the lightest is {n} µg/m³',
  moveDec_short: 'only ~{n}h of today left on the card — {b} throughout',
  moveDec_cardShort: "the next ~{n}h look {b} — the rest of today's card isn't in yet",
  moveDec_flat: 'no meaningful window today — {b} air all day ({lo}–{hi} µg/m³)',
  moveDec_jagged: 'no steady window today — from {lo} to {hi} µg/m³',
  dayOutlookTitle: 'the days ahead',
  dayOutlookCleanest: 'cleanest', dayOutlookLeastBad: 'least-bad',
  dayOutlookTodayPartial: 'rest of today (~{n}h)', dayOutlookPartial: 'first ~{n}h only',
  dayOutlookAllDayHeavy: 'heavy right through — no lighter run to pick',
  dayOutlookHeavyHours: 'heaviest at {h}',
  dayOutlookRange: '≈{lo}–{hi} µg/m³',
  dayOutlookLoNote: 'faded days are past live readings — satellite estimate only',
  dayLbl_today: 'today', dayLbl_tomorrow: 'tomorrow',
  dayLbl_monday: 'monday', dayLbl_tuesday: 'tuesday', dayLbl_wednesday: 'wednesday',
  dayLbl_thursday: 'thursday', dayLbl_friday: 'friday', dayLbl_saturday: 'saturday', dayLbl_sunday: 'sunday',
  lensTitle: 'how you felt',
  lensSub: 'breath · eyes · energy — a 5-second check-in, on this phone only',
  lensBreath: 'breath', lensEyes: 'eyes', lensEnergy: 'energy',
  lensGood: 'good', lensMeh: 'meh', lensRough: 'rough',
  lensPrivacy: 'stays on this phone — never uploaded',
  lensEarly: 'a few check-ins in — the pattern needs ~7 days',
  lensFlat: '{n} {dayNoun} in — no pattern yet, the lens stays honest',
  lensLink: 'your rough {f} follow heavy-smoke days',
  lensFacetEyes: 'eye-burn', lensFacetEnergy: 'low-energy', lensFacetBreath: 'breathing',
  dayNounOne: 'day', dayNounMany: 'days',
  budgetTitle: 'your daily limit', budgetTitleSugg: 'a suggested daily limit',
  budgetOver: '{o} µg over your {p} limit today',
  budgetOverSugg: '{o} µg over the suggested {p} limit today',
  budgetWithin: '{r} µg left of your {b} µg line for today',
  budgetWithinSugg: '{r} µg left of the suggested {b} µg line for today',
  budgetProfileQ: '{b} µg is the most fine dust you want to breathe in a day — a line you set, not a medical rule',
  budgetQGeneralSugg: "{b} µg — a suggested reference: WHO 24-h fine-dust guide 15 µg/m³ × ~14.4 m³ of air a day — the volume is our assumption, not WHO's",
  budgetQSensitiveSugg: "{b} µg — a suggested reference: WHO annual fine-dust guide 5 µg/m³ × ~14.4 m³ of air a day — the volume is our assumption, not WHO's",
  budgetQChildSugg: "{b} µg — a suggested reference: WHO 24-h guide 15 µg/m³ × ~8.6 m³ of air a day — our assumed volume for a child",
  profileGeneral: 'general', profileSensitive: 'sensitive', profileChild: 'child',
  onb_airKicker: 'delhi · right now',
  onb_airLine: "You can't see it. You still breathe it.",
  onb_whatTitle: 'Every Delhi trip has an air price.',
  onb_arcLineSearch: 'see the smoke before you go',
  onb_arcLineDose: 'it counts what you breathe as you go',
  onb_arcLineReceipt: 'a receipt of it when you arrive',
  onb_phoneTitle: 'Nothing personal leaves this phone.',
  onb_phoneBody: 'No account, no name — shared trips lose both ends before they count.',
  onb_kLabel: 'a street appears only after this many different devices cross it',
  onb_skip: 'Skip', onb_next: 'Next',
  onb_locTitle: 'One permission — where you are.',
  onb_locBody: 'ALive reads the air at your street and steers the map as you move. It stays on this phone.',
  onb_locBtn: 'turn on location', onb_locLater: 'not now',
  consent_title: "One choice — and it's yours.",
  consent_body: "Your dose and your routes live on this phone. Sharing sends only anonymous, trimmed trips — it's how Delhi's air map sees its streets. Works the same either way.",
  consent_shareBtn: 'Share trips anonymously', consent_shareSub: 'helps Delhi see its air, street by street',
  consent_keepBtn: 'Keep everything on my phone', consent_keepSub: 'nothing is uploaded — you can turn it on later',
  consent_footnote: 'Skipping keeps everything on this phone — either way, one tap in Settings changes it.',
};
const FELT_BY_BAND = ['felt_easy', 'felt_fine', 'felt_fair', 'felt_heavy', 'felt_rough', 'felt_harsh'];
const MOVE_BAND_KEYS = ['band_good', 'band_satisfactory', 'band_moderate', 'band_poor', 'band_veryPoor', 'band_severe'];
const t = (k, vars) => {
  let s = S[k] ?? k;
  if (vars) for (const key of Object.keys(vars)) s = s.replaceAll(`{${key}}`, String(vars[key]));
  return s;
};
const feltKeyForBand = (idx) => FELT_BY_BAND[Math.max(0, Math.min(5, idx == null ? 1 : idx))];
const bandWord = (idx) => t(MOVE_BAND_KEYS[Math.max(0, Math.min(5, idx))]);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ── clock + day words (strings.ts / daywords.ts, IST conventions) ── */
const IST_MS = 330 * 60 * 1000;
const istParts = (t0) => { const d = new Date(t0 + IST_MS); return { h24: d.getUTCHours(), min: d.getUTCMinutes(), dow: d.getUTCDay() }; };
const clockLabel = (t0) => {
  const { h24, min } = istParts(t0);
  return `${((h24 + 11) % 12) + 1}:${`${min}`.padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
};
const hourOfDay = (h) => {
  const whole = Math.floor(h), h24 = ((whole % 24) + 24) % 24, h12 = ((h24 + 11) % 12) + 1;
  const min = Math.round((h - whole) * 60);
  if (min > 0 && min < 60) return `${h12}:${`${min}`.padStart(2, '0')}${h24 < 12 ? 'am' : 'pm'}`;
  return `${h12}${h24 < 12 ? 'am' : 'pm'}`;
};
const wireClockLabel = (s) => String(s)
  .replace(/\b(\d{1,2}):(\d{2})\b/g, (_m, h, min) => {
    const hh = Number(h), mm = Number(min);
    if (hh > 23 || mm > 59) return `${h}:${min}`;
    return `${((hh + 11) % 12) + 1}:${min}${hh < 12 ? 'am' : 'pm'}`;
  })
  .replace(/\s*IST\b/g, '');
const fmtHr = (h) => hourOfDay(h);
const DAY_LABEL_KEYS = {
  today: 'dayLbl_today', tomorrow: 'dayLbl_tomorrow', monday: 'dayLbl_monday',
  tuesday: 'dayLbl_tuesday', wednesday: 'dayLbl_wednesday', thursday: 'dayLbl_thursday',
  friday: 'dayLbl_friday', saturday: 'dayLbl_saturday', sunday: 'dayLbl_sunday',
};
const dayLabel = (label) => {
  const k = DAY_LABEL_KEYS[String(label).trim().toLowerCase()];
  return k ? t(k) : label;
};
const shortDate = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
/* served "HH:MM" hourly starts → compact ranges (daywords.compactHours) */
const compactHours = (labels) => {
  const hrs = labels
    .map((l) => (/^\d{1,2}:\d{2}/.test(l) ? { h: parseInt(l, 10), raw: l } : null))
    .filter(Boolean);
  if (!hrs.length) return '';
  const out = [];
  let i = 0;
  while (i < hrs.length) {
    let j = i;
    while (j + 1 < hrs.length && hrs[j + 1].h === hrs[j].h + 1) j += 1;
    if (j > i) out.push(`${hrs[i].raw}–${`${(hrs[j].h + 1) % 24}`.padStart(2, '0')}:${hrs[j].raw.slice(3)}`);
    else out.push(hrs[i].raw);
    i = j + 1;
  }
  return wireClockLabel(out.join(', '));
};
const nowHour = () => new Date(Date.now() + IST_MS).getUTCHours();

/* ── freshness (FreshnessChip.tsx / daywords.fieldAgeLine) ── */
const freshnessTone = (ageS, stale) => {
  if (stale === true) return 'stale';
  if (ageS == null || !isFinite(ageS)) return 'unknown';
  if (ageS >= 1800) return 'stale';
  if (ageS >= 600) return 'ok';
  return 'fresh';
};
const fieldAgeLine = (ageS, stale) => {
  const tone = freshnessTone(ageS, stale);
  if (tone === 'unknown') return null;
  const n = Math.max(0, Math.floor((ageS ?? 0) / 60));
  return tone === 'stale' ? t('dayMorningStale', { n }) : t('howWe_fieldAge', { n });
};

/* ── the day curve (api/dayfield.ts — /v2/day first, /grid fallback) ── */
const CONF_RANK = (c) => (c === 'hi' ? 2 : c === 'med' ? 1 : c === 'lo' ? 0 : -1);
const cellContains = (feat, lat, lon) => {
  const g = feat && feat.geometry;
  if (!g || g.type !== 'Polygon' || !g.coordinates[0] || g.coordinates[0].length < 4) return false;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of g.coordinates[0]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1;
};
const pickCell = (fc, lat, lon) => {
  for (const f of (fc && fc.features) || []) if (cellContains(f, lat, lon)) return f;
  return null;
};
const fieldAgeFromEpoch = (fc) => {
  const ep = fc && fc.properties && fc.properties.cell_epoch;
  if (!Array.isArray(ep)) return null;
  const fieldEp = ep.length >= 2 ? ep[1] : ep[0];
  return typeof fieldEp === 'number' && isFinite(fieldEp) ? Math.max(0, Date.now() / 1000 - fieldEp) : null;
};
const mapWin = (w, series) => {
  if (!w || typeof w.start_h !== 'number') return null;
  const slice = series.slice(w.start_h, w.end_h ?? series.length).filter((v) => v != null);
  const conc = typeof w.pm25_mid === 'number' ? w.pm25_mid
    : slice.length ? slice.reduce((s, x) => s + x, 0) / slice.length : null;
  if (conc == null) return null;
  return { from: w.start_h, to: w.end_h ?? series.length, conc };
};
async function fetchDayServer(lat, lon) {
  const d = await A.api.get(`/v2/day?lat=${lat}&lon=${lon}`, 8000);
  if (!d || !Array.isArray(d.hours) || d.error) return null;
  const series = [];
  let conf = null;
  for (const h of d.hours) {
    if (typeof h.h !== 'number' || typeof h.pm25_mid !== 'number') continue;
    series[h.h] = h.pm25_mid;
    const cr = CONF_RANK(h.confidence);
    if (cr >= 0 && (conf === null || CONF_RANK(conf) > cr)) conf = h.confidence;
  }
  if (!series.some((v) => v != null)) return null;
  return {
    series, conf, covered: true,
    fieldAgeS: typeof d.field_age_s === 'number' ? d.field_age_s : (d.field && d.field.age_s) ?? null,
    fieldStale: !!(d.field && d.field.stale === true),
    server: {
      heavy: mapWin(d.heavy_window, series), clean: mapWin(d.cleanest_window, series),
      decisions: (d.decisions || []).filter((x) => x && typeof x.line === 'string'),
      heavyLabel: (d.heavy_window && d.heavy_window.start_label) ?? null,
      cleanLabel: (d.cleanest_window && d.cleanest_window.start_label) ?? null,
      heavyEndLabel: (d.heavy_window && d.heavy_window.end_label) ?? null,
      cleanEndLabel: (d.cleanest_window && d.cleanest_window.end_label) ?? null,
    },
  };
}
async function fetchGridSeries(lat, lon) {
  const series = new Array(DAY_HOURS).fill(null);
  let conf = null, covered = false, fieldAgeS = null;
  await Promise.all(Array.from({ length: DAY_HOURS }, (_, h) =>
    A.api.get(`/grid?cells=8&param=pm2_5&h=${h}`, 12000).then((fc) => {
      const cell = pickCell(fc, lat, lon);
      if (!cell) return;
      covered = true;
      const v = cell.properties && cell.properties.pm25;
      if (typeof v === 'number' && isFinite(v)) series[h] = v;
      const c = cell.properties && cell.properties.conf;
      const cr = CONF_RANK(c);
      if (cr >= 0 && (conf === null || CONF_RANK(conf) > cr)) conf = c;
      if (fieldAgeS == null) fieldAgeS = fieldAgeFromEpoch(fc);
    })));
  return { series, conf, covered, fieldAgeS };
}
async function fetchDayCurve(lat, lon) {
  const c = (await fetchDayServer(lat, lon)) ?? (await fetchGridSeries(lat, lon));
  if (!c.covered || !c.series.some((v) => v != null)) return null;
  return c;
}
/* morningAnswers(series) — api/dayfield.ts verbatim */
function morningAnswers(series) {
  const vals = series.filter((v) => v != null);
  if (vals.length < 3) return { heavy: null, clean: null, ratio: null, flat: true };
  const W = 3;
  let heavy = null, clean = null;
  for (let i = 0; i + W <= series.length; i += 1) {
    const w = series.slice(i, i + W);
    const ok = w.filter((v) => v != null);
    if (ok.length < 2) continue;
    const mean = ok.reduce((s, x) => s + x, 0) / ok.length;
    if (!heavy || mean > heavy.conc) heavy = { from: i, to: i + W, conc: mean };
    if (!clean || mean < clean.conc) clean = { from: i, to: i + W, conc: mean };
  }
  if (!heavy || !clean) return { heavy, clean, ratio: null, flat: true };
  const ratio = clean.conc > 0 ? heavy.conc / clean.conc : null;
  const flat = ratio != null && ratio < 1.2;
  return { heavy, clean, ratio, flat };
}
/* decisionLine — the en rebuild of the served 'outdoor exercise'/'today'
   sentences (HomeScreen.tsx) */
function decisionLine(d, srv, series) {
  const mids = series.filter((v) => v != null);
  if (!mids.length) return d.line;
  const lo = Math.min(...mids), hi = Math.max(...mids);
  const mean = mids.reduce((s, x) => s + x, 0) / mids.length;
  const modalBand = () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (const m of mids) { const i = bandIdx(m); if (i != null) counts[i] += 1; }
    let best = 0;
    for (let i = 1; i < 6; i += 1) if (counts[i] > counts[best]) best = i;
    return bandWord(best);
  };
  if (d.label === 'outdoor exercise') {
    if (srv.clean) {
      const w = t(srv.clean.conc > CLEAN_UG ? 'dayOutlookLeastBad' : 'dayOutlookCleanest');
      const win = wireClockLabel(`~${srv.cleanLabel ?? ''}-${srv.cleanEndLabel ?? ''}`);
      return t('moveDec_cleanWindow', { w, win, c: Math.round(srv.clean.conc), m: Math.round(mean) });
    }
    return t('moveDec_noClean', { n: Math.round(lo) });
  }
  if (d.label === 'today') {
    if (mids.length < 3) {
      const last = bandIdx(mids[mids.length - 1]);
      const b = last == null ? '' : bandWord(last);
      const istHour = (Date.now() / 3600000 + 5.5) % 24;
      const istLeft = 24 - istHour;
      return istLeft <= mids.length + 1.5
        ? t('moveDec_short', { n: mids.length, b })
        : t('moveDec_cardShort', { n: mids.length, b });
    }
    if (hi - lo <= Math.max(15, 0.15 * mean)) {
      return t('moveDec_flat', { b: modalBand(), lo: Math.round(lo), hi: Math.round(hi) });
    }
    return t('moveDec_jagged', { lo: Math.round(lo), hi: Math.round(hi) });
  }
  return d.line;
}

/* ── the outlook (api/outlook.ts — wire fields kept) ── */
async function fetchOutlook(lat, lon) {
  const d = await A.api.get(`/v2/outlook?lat=${lat}&lon=${lon}`, 8000);
  if (!d || !Array.isArray(d.days)) return null;
  const days = d.days
    .filter((x) => x && typeof x.pm25_mid === 'number' && typeof x.label === 'string')
    .map((x) => ({
      ...x,
      heavy_hours_ist: Array.isArray(x.heavy_hours_ist) ? x.heavy_hours_ist.filter((h) => typeof h === 'string') : [],
      cleanest_window: x.cleanest_window && typeof x.cleanest_window === 'object' ? x.cleanest_window : null,
    }));
  if (!days.length) return null;
  const b = d.best_day;
  const best_day = b && typeof b === 'object' && typeof b.label === 'string' && typeof b.pm25_mid === 'number'
    ? { date_ist: typeof b.date_ist === 'string' ? b.date_ist : '', label: b.label, pm25_mid: b.pm25_mid,
        n_hours: typeof b.n_hours === 'number' ? b.n_hours : 0, partial: !!b.partial,
        delta_vs_mean: typeof b.delta_vs_mean === 'number' ? b.delta_vs_mean : 0,
        line: typeof b.line === 'string' ? b.line : '' }
    : null;
  return {
    days, best_day, flat: !!d.flat, verdict: typeof d.verdict === 'string' ? d.verdict : '',
    fieldAgeS: typeof d.field_age_s === 'number' ? d.field_age_s : (d.field && d.field.age_s) ?? null,
    fieldStale: !!(d.field && d.field.stale === true),
  };
}
const outlookCaption = (o) => (o && o.verdict ? o.verdict : '');   // en keeps the wire line

/* ── state ── */
const cur = { pos: null, label: null, aqi: null, day: null, outlook: null, cityWhy: null };

/* ── tiny DOM helpers ── */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const node = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
const cardTitle = (k, mb0) => `<div class="hcard-title"${mb0 ? ' style="margin-bottom:0"' : ''}>${esc(t(k))}</div>`;
const FadeIn = (i, inner) => `<div class="hs-fade" style="animation-delay:${i}ms">${inner}</div>`;
const quietBlock = (glyph, titleKey) => `
  <div class="hs-quiet"><div class="hs-quietring">${ic(glyph, 20)}</div>
  <div class="hs-quiettitle">${esc(t(titleKey))}</div></div>`;

/* ══ HERO ══ */
function heroHtml(d) {
  const airNow = d.ambientUg ?? (d.series.find((v) => v != null) ?? null);
  const airSrc = d.ambientUg != null ? 'live' : (d.series.some((v) => v != null) ? 'forecast' : null);
  const airNowIdx = bandIdx(airNow);
  const counted = !d.thin;
  const idx = counted ? (doseTierIdx(d.totalUg, d.budget) ?? 0) : airNowIdx;
  const ink = idx != null ? bandInkIdx(idx) : 'var(--ink)';
  const felt = idx != null ? t(feltKeyForBand(idx)) : null;
  const airAgeLine = airSrc === 'live' ? fieldAgeLine(d.fieldAgeS, d.fieldStale) : null;

  let ref = null, ref2 = null;
  if (counted) {
    ref = d.budget > 0 ? t(d.profileSet ? 'refBudget' : 'refBudgetSugg', { p: Math.round((d.totalUg / d.budget) * 100) }) : null;
    if (d.yday > 0) {
      const delta = Math.round(d.totalUg - d.yday);
      if (delta !== 0) ref2 = t(delta > 0 ? 'refYesterdayMore' : 'refYesterdayLess', { n: Math.abs(delta) });
    }
  } else if (airNow != null) {
    const x = airNow / WHO_DAILY_UG;
    ref = x > 1.05 ? t('refWhoOver', { x: x >= 10 ? Math.round(x) : x.toFixed(1) }) : t('refWhoUnder');
  }
  const provBase = !counted && airSrc === 'live' && d.meta != null
    ? (d.meta.atGps === false ? t('homeAirCityHint')
      : d.meta.beyondEdge ? t('homeAirEdge')
      : d.meta.km != null
        ? (d.meta.place ? t('homeAirMetaPlace', { p: d.meta.place, k: d.meta.km }) : t('homeAirMeta', { k: d.meta.km }))
        : (d.meta.place ? t('homeAirPlaceModel', { p: d.meta.place }) : t('homeAirModel')))
    : null;
  const provLine = [provBase, counted ? null : airAgeLine].filter(Boolean).join('  ·  ');

  return `
    <div class="hs-eyebrow">${esc(counted ? t('homeBreathed')
      : airSrc === 'forecast' ? t('homeAirForecast')
      : d.meta && d.meta.atGps === false ? t('homeAirNowCity') : t('homeAirNowLead'))}</div>
    ${counted ? `
      <div class="hs-heronumrow"><span class="hs-heronum" data-count="${doseUgRound(d.totalUg)}" style="color:${ink}">0</span><span class="hs-heroug">µg</span></div>`
    : airNow != null ? `
      <div class="hs-heronumrow"><span class="hs-heronum" data-count="${Math.round(airNow)}" style="color:${ink}">0</span><span class="hs-heroug">µg/m³</span></div>`
    : `<div class="hs-thinline">${esc(t('daySparseWait'))}</div>`}
    ${(counted || airNow != null) ? `<div class="hs-breathline" style="background:${ink}"></div>` : ''}
    ${felt != null && (counted || airNow != null) ? `
      <div class="hs-feltrow"><span class="hs-feltsq" style="background:${idx != null ? bandColorIdx(idx) : 'var(--surface3)'}"></span><span class="hs-felt" style="color:${ink}">${esc(felt)}</span></div>` : ''}
    ${!counted && airNow != null ? `
      <div class="hs-ref">${esc(airSrc === 'forecast' ? t('homeAirWhatFc')
        : d.meta && d.meta.usAqi != null ? t('homeAirWhatAqi', { a: Math.round(d.meta.usAqi) })
        : t('homeAirWhat'))}</div>` : ''}
    ${ref != null ? `<div class="hs-ref">${esc(ref)}${ref2 ? esc(`  ·  ${ref2}`) : ''}</div>` : ''}
    ${provLine !== '' ? `<div class="hs-prov">${esc(provLine)}</div>` : ''}
    ${airNowIdx != null ? `<div class="hs-scale" id="hs-scale"></div>` : ''}
    ${!counted && d.series.some((v) => v != null) ? `<div class="hs-arc" id="hs-arc"></div>` : ''}
    ${!counted ? `
      <div class="hs-progrow">${Array.from({ length: THIN_SAMPLE_MIN }, (_, i) =>
        `<span class="hs-progseg" style="background:${i < d.samplesToday ? ink : 'var(--surface3)'}"></span>`).join('')}
        <span class="hs-proglbl">${esc(t('daySparseCount'))}</span></div>` : ''}
  `;
}
function countUp(span) {
  if (!span) return;
  const target = Number(span.dataset.count);
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / 600);
    span.textContent = Math.round(target * p);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function renderBandScale(mount, idx) {
  if (!mount) return;
  const W = 220, H = 9, N = 6;
  const stops = BANDS.map((_, i) =>
    `<stop offset="${(i / N) * 100}%" stop-color="${bandEdgeIdx(i)}"/><stop offset="${((i + 1) / N) * 100}%" stop-color="${bandEdgeIdx(i)}"/>`).join('');
  const live = idx != null
    ? `<rect x="${(idx / N) * W + 1.5}" y="0" width="${W / N - 3}" height="${H}" rx="${H / 2}" fill="${bandColorIdx(idx)}" stroke="var(--paper)" stroke-width="1.5"/>` : '';
  mount.innerHTML = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs><linearGradient id="bsg" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient></defs>
    <rect x="0" y="0" width="${W}" height="${H}" rx="${H / 2}" fill="url(#bsg)"/>${live}</svg>`;
}
function renderSparseArc(mount, series, color) {
  if (!mount) return;
  const W = 346, H = 64, PAD = 4;
  const vals = series.filter((v) => v != null);
  if (!vals.length) { mount.innerHTML = ''; return; }
  const max = Math.max(...vals, 1), min = Math.min(...vals, 0), span = Math.max(1, max - min);
  const x = (i) => PAD + (W - 2 * PAD) * (series.length <= 1 ? 0 : i / (series.length - 1));
  const y = (v) => H - 6 - (H - 16) * ((v - min) / span);
  const runs = [];
  let pts = [];
  const flush = () => {
    if (pts.length > 1) {
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let k = 1; k < pts.length; k += 1) {
        const [px, py] = pts[k - 1], [cx, cy] = pts[k];
        d += ` Q${px.toFixed(1)} ${py.toFixed(1)} ${((px + cx) / 2).toFixed(1)} ${((py + cy) / 2).toFixed(1)}`;
      }
      const last = pts[pts.length - 1];
      d += ` L${last[0].toFixed(1)} ${last[1].toFixed(1)}`;
      runs.push({ line: d, area: `${d} L${last[0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z` });
    }
    pts = [];
  };
  series.forEach((v, i) => { if (v == null) flush(); else pts.push([x(i), y(v)]); });
  flush();
  const first = series.findIndex((v) => v != null);
  mount.innerHTML = `<svg width="100%" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="arcWash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.16"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    ${runs.map((r) => `<path d="${r.area}" fill="url(#arcWash)"/><path d="${r.line}" stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.75"/>`).join('')}
    ${first >= 0 ? `<circle class="hs-arcdot" cx="${x(first)}" cy="${y(series[first])}" r="4" fill="${color}"/>` : ''}</svg>`;
}

/* ══ INCIDENTS ══ */
const incidentHtml = (line) => `
  <div class="hcard hs-inc"><div class="hs-inchead">${ic('flame', 15)}<span>${esc(t('incidentsTitle'))}</span></div>
  <div class="hs-incline">${esc(line)}<span class="hs-inctag"> · ${esc(t('noteMeasured'))}</span></div></div>`;

/* ══ DOORS — one grouped list card ══ */
const DOORS = [
  { glyph: 'explore', key: 'homeLinkMap', id: 'airmap' },
  { glyph: 'city', key: 'homeLinkCity', id: 'airmap' },
  { glyph: 'history', key: 'homeLinkTrips', id: 'ledger' },
];
function doorsHtml() {
  const rows = DOORS.filter((d) => A.screensReady[d.id]).map((d, i) => `
    ${i > 0 ? '<div class="hs-doorsep"></div>' : ''}
    <button class="hs-doorrow" data-go="${d.id}">
      ${ic(d.glyph, 24, 'hs-dooric')}<span class="hs-doorlbl">${esc(t(d.key))}</span>${ic('chevron', 18, 'hs-doorchev')}
    </button>`).join('');
  return rows ? `<div class="hcard hs-doorcard">${rows}</div>` : '';
}

/* ══ MOVE CARD ══ */
function sparklineHtml(series) {
  const H = 44, PAD = 8, W0 = 314;
  const vals = series.filter((v) => v != null);
  const max = Math.max(...vals, 1), span = Math.max(1, max);
  const slot = series.length ? (W0 - 2 * PAD) / series.length : 0;
  const bw = Math.max(3, Math.min(10, slot - 4));
  const bars = series.map((v, i) => {
    const yv = v == null ? null : H - 6 - (H - 10) * (v / span);
    const top = v == null ? H - 4 : Math.min(yv, H - 6);
    const hgt = H - top;
    return `<div class="hs-spcol"><div class="hs-spbar" style="height:${hgt}px;width:${bw}px;border-radius:${bw / 2}px;background:${v == null ? 'var(--surface3)' : bandColorIdx(bandIdx(v))}"></div></div>`;
  }).join('');
  const labels = series.map((v, i) => {
    const label = i === 0 ? t('dayNow') : i % 3 === 0 ? t('hourTick', { n: i }) : '';
    return `<div class="hs-splbl">${label ? esc(label) : ''}</div>`;
  }).join('');
  return `<div class="hs-spark">${bars}</div><div class="hs-sparklabels">${labels}</div>`;
}
function moveHtml(curve, outside) {
  if (outside) {
    return `<div class="hcard">${cardTitle('moveTitle')}${quietBlock('pin', 'dayOutsideDelhi')}</div>`;
  }
  if (!curve) return '';
  if (!curve.covered) {
    return `<div class="hcard">${cardTitle('moveTitle')}${quietBlock('pin', 'dayMorningNoCell')}</div>`;
  }
  const srv = curve.server;
  const a = morningAnswers(curve.series);
  const heavy = srv ? srv.heavy : a.heavy;
  const clean = srv ? srv.clean : a.clean;
  const flat = srv ? (!srv.heavy && !srv.clean) : a.flat;
  const heavyF = srv && srv.heavyLabel ? wireClockLabel(srv.heavyLabel) : (heavy ? fmtHr(heavy.from + nowHour()) : '');
  const heavyT = srv && srv.heavyEndLabel ? wireClockLabel(srv.heavyEndLabel) : (srv && srv.heavyLabel ? '' : heavy ? fmtHr(heavy.to + nowHour()) : '');
  const cleanF = srv && srv.cleanLabel ? wireClockLabel(srv.cleanLabel) : (clean ? fmtHr(clean.from + nowHour()) : '');
  const cleanT = srv && srv.cleanEndLabel ? wireClockLabel(srv.cleanEndLabel) : (srv && srv.cleanLabel ? '' : clean ? fmtHr(clean.to + nowHour()) : '');
  const dec = srv && srv.decisions && srv.decisions[0] ? srv.decisions[0] : null;
  const felt = dec && srv ? decisionLine(dec, srv, curve.series)
    : (!flat && clean && heavy && a.ratio != null && a.ratio >= 1.2
      ? t('dayMorningMove', { f: cleanF, g: heavyF, x: a.ratio.toFixed(1) }) : null);
  const ageLine = fieldAgeLine(curve.fieldAgeS, curve.fieldStale);
  const cleanIdx = clean != null ? bandIdx(clean.conc) : null;
  const bg = cleanIdx != null ? bandWashIdx(cleanIdx) : (felt != null || flat ? SAND.wash : 'var(--surface)');
  const edge = cleanIdx != null ? hexMix(BANDS[cleanIdx], INK, 0.20).replace('rgb', 'rgba').replace(')', ',0.20)')
    : (felt != null || flat ? 'rgba(74,78,87,0.19)' : 'var(--hairline)');
  return `<div class="hcard" style="background:${bg};border:0.5px solid ${edge}">
    ${cardTitle('moveTitle')}
    ${felt ? `<div class="hs-moveline">${esc(felt)}</div>` : flat ? `<div class="hs-moveline">${esc(t('dayMorningFlat'))}</div>` : ''}
    ${sparklineHtml(curve.series)}
    ${!flat && heavy ? `<div class="hs-winchip"><span class="hs-windot" style="background:${bandColorIdx(bandIdx(heavy.conc))}"></span><span class="hs-winchiptxt">${esc(t(heavyT ? 'dayMorningHeavy' : 'dayMorningHeavyFrom', { f: heavyF, t: heavyT, c: Math.round(heavy.conc) }))}</span></div>` : ''}
    ${!flat && clean ? `<div class="hs-winchip"><span class="hs-windot" style="background:${bandColorIdx(bandIdx(clean.conc))}"></span><span class="hs-winchiptxt">${esc(t(cleanT ? 'dayMorningClean' : 'dayMorningCleanFrom', { f: cleanF, t: cleanT, c: Math.round(clean.conc) }))}</span></div>` : ''}
    ${curve.conf === 'lo' ? `<div class="hs-fine">${esc(t('howWe_conf', { c: t('conf_low') }))}</div>` : ''}
    ${ageLine ? `<div class="hs-fine">${esc(ageLine)}</div>` : ''}
  </div>`;
}

/* ══ DAYS AHEAD ══ */
function outlookHtml(o) {
  if (!o || !o.days.length) return '';
  const days = o.days.slice(0, 5);
  const anyLo = days.some((d) => d.confidence === 'lo');
  const caption = outlookCaption(o);
  const ageLine = o.fieldStale ? fieldAgeLine(o.fieldAgeS, o.fieldStale) : null;
  const cells = days.map((d) => {
    const best = o.best_day && o.best_day.date_ist === d.date_ist;
    const bi = bandIdxForName(d.band) ?? bandIdx(d.pm25_mid);
    const dot = bi != null ? bandColorIdx(bi) : 'var(--text4)';
    const midCol = bi != null ? bandInkIdx(bi) : 'var(--ink)';
    return `<button class="hs-oacell ${d.confidence === 'lo' ? 'lo' : ''}" data-date="${esc(d.date_ist)}" aria-expanded="false">
      <span class="hs-oaday">${esc(dayLabel(d.label))}</span>
      <span class="hs-oamid"><span class="hs-windot" style="background:${dot}"></span><span class="hs-oanum" style="color:${midCol}">${Math.round(d.pm25_mid)}</span></span>
      <span class="hs-oasub">${d.partial ? esc(t('hourTickTilde', { n: d.n_hours })) : ' '}</span>
      <span class="hs-oamark">${best ? esc(t(d.pm25_mid > CLEAN_UG ? 'dayOutlookLeastBad' : 'dayOutlookCleanest')) : ' '}</span>
    </button>`;
  }).join('');
  return `<div class="hcard">
    <div class="hs-oahead">${cardTitle('dayOutlookTitle', true)}<span class="hs-oaunit">µg/m³</span></div>
    <div class="hs-oarow">${cells}</div>
    <div class="hs-oadetail" id="hs-oadetail"></div>
    ${caption ? `<div class="hs-noteline">${esc(caption)}</div>` : ''}
    ${anyLo ? `<div class="hs-fine">${esc(t('dayOutlookLoNote'))}</div>` : ''}
    ${ageLine ? `<div class="hs-fine">${esc(ageLine)}</div>` : ''}
  </div>`;
}
function outlookDetailHtml(o, date) {
  const d = o.days.find((x) => x.date_ist === date);
  if (!d) return '';
  return `<div class="hs-oadetailin">
    <div class="hs-oadetailhead">${esc(dayLabel(d.label))} · ${esc(shortDate(d.date_ist))}</div>
    ${d.partial ? `<div class="hs-oadetailnote">${esc(t(d.label === 'today' ? 'dayOutlookTodayPartial' : 'dayOutlookPartial', { n: d.n_hours }))}</div>` : ''}
    ${d.cleanest_window ? `
      <div class="hs-mrow"><span class="hs-windot" style="background:${bandColorIdx(bandIdx(d.cleanest_window.pm25_mid ?? 0))}"></span><span class="hs-mline">${esc(t(d.cleanest_window.end_label ? 'dayMorningClean' : 'dayMorningCleanFrom', {
        f: wireClockLabel(d.cleanest_window.start_label ?? ''),
        t: wireClockLabel(d.cleanest_window.end_label ?? ''),
        c: Math.round(d.cleanest_window.pm25_mid ?? 0),
      }))}</span></div>`
    : `<div class="hs-mline" style="margin-top:6px">${esc(t(d.heavy_hours_ist.length ? 'dayOutlookAllDayHeavy' : 'dayMorningFlat'))}</div>`}
    ${d.cleanest_window && d.heavy_hours_ist.length ? `<div class="hs-oadetailnote">${esc(t('dayOutlookHeavyHours', { h: compactHours(d.heavy_hours_ist) }))}</div>` : ''}
    ${d.pm25_lo != null && d.pm25_hi != null ? `<div class="hs-oadetailnote">${esc(t('dayOutlookRange', { lo: Math.round(d.pm25_lo), hi: Math.round(d.pm25_hi) }))}</div>` : ''}
  </div>`;
}

/* ══ CHECK-IN (shell/CheckinSheet.tsx) ══ */
const FACETS = [
  { k: 'breath', label: 'lensBreath' },
  { k: 'eyes', label: 'lensEyes' },
  { k: 'energy', label: 'lensEnergy' },
];
const lensVerdict = () => {
  const days = Object.keys(getCheckins()).length;
  if (days < 3) return t('lensEarly');
  return t('lensFlat', { n: days, dayNoun: t(days === 1 ? 'dayNounOne' : 'dayNounMany') });
};
function lensHtml() {
  const today = getCheckins()[dayKeyOf(Date.now())] || {};
  const rows = FACETS.map((f) => `
    <div class="hs-lensrow"><span class="hs-lenslabel">${esc(t(f.label))}</span><div class="hs-lenspills">
      ${['good', 'meh', 'rough'].map((o) => `<button class="hs-lenspill ${today[f.k] === o ? 'sel' : ''}" data-facet="${f.k}" data-val="${o}">${esc(t(`lens${cap(o)}`))}</button>`).join('')}
    </div></div>`).join('');
  return `<div class="hcard">
    <div class="hs-lenstitle">${esc(t('lensTitle'))}</div>
    <div class="hs-lenssub">${esc(t('lensSub'))}</div>
    ${rows}
    <div class="hs-fine hs-lenspriv">${esc(t('lensPrivacy'))}</div>
    <div class="hs-lensverdict">${esc(lensVerdict())}</div>
  </div>`;
}

/* ══ BUDGET ══ */
function budgetHtml() {
  const s = getSettings();
  const budget = profileBudgetUg(s.profile);
  const total = 0;   // no on-device dose reconstruction on web — the honest 0
  const over = total - budget;
  const frac = Math.max(0, Math.min(1, total / budget));
  const profName = t(`profile${cap(s.profile)}`);
  const line = over > 0
    ? t(s.profile_set ? 'budgetOver' : 'budgetOverSugg', { o: doseUgRound(over), p: profName })
    : t(s.profile_set ? 'budgetWithin' : 'budgetWithinSugg', { r: doseUgRound(-over), b: budget });
  const qKey = `budgetQ${cap(s.profile)}Sugg`;
  const fine = s.profile_set ? t('budgetProfileQ', { b: budget }) : t(qKey, { b: budget });
  const segs = ['general', 'sensitive', 'child'].map((p) =>
    `<button class="hs-profseg ${s.profile === p ? 'sel' : ''}" data-profile="${p}">${esc(t(`profile${cap(p)}`))}</button>`).join('');
  return `<div class="hcard">
    ${cardTitle(s.profile_set ? 'budgetTitle' : 'budgetTitleSugg')}
    <div class="hs-budgetbar"><div class="hs-budgetfill" style="width:${frac * 100}%;background:${doseDotColor(total, budget) || 'var(--surface3)'}"></div></div>
    <div class="hs-budgetline">${esc(line)}</div>
    <div class="hs-profrow">${segs}</div>
    <div class="hs-fine">${esc(fine)}</div>
  </div>`;
}

/* ══ data assembly ── */
function heroData() {
  const s = getSettings();
  const aqi = cur.aqi;
  const pos = cur.pos || A.geo.pos;
  const atGps = A.geo.consent === 'granted' && pos && !pos.picked;
  const ambientUg = aqi && aqi.pm25 != null ? Math.round(aqi.pm25) : null;
  return {
    thin: true, totalUg: 0, samplesToday: 0, yday: 0,
    budget: profileBudgetUg(s.profile), profileSet: s.profile_set,
    ambientUg,
    series: cur.day ? cur.day.series : [],
    meta: {
      km: aqi && aqi.nearest_station_km != null ? aqi.nearest_station_km : null,
      atGps, usAqi: aqi ? aqi.us_aqi : null,
      beyondEdge: aqi ? !!aqi.beyond_field_edge : false,
      place: cur.label || (pos && pos.label) || null,
    },
    fieldAgeS: aqi && aqi.field ? aqi.field.age_s : (cur.day ? cur.day.fieldAgeS : null),
    fieldStale: aqi && aqi.field ? aqi.field.stale : (cur.day ? cur.day.fieldStale : null),
  };
}

/* ══ screen ── */
let root, heroEl, incWrap, doorsWrap, moveWrap, oaWrap, lensWrap, budWrap;
let clockTimer = null, moodIdx = null, moodEl = null;

function paint() {
  const d = heroData();
  const cidx = d.ambientUg != null ? bandIdx(d.ambientUg) : doseTierIdx(d.totalUg, d.budget);
  if (cidx !== moodIdx) {
    const prev = moodEl.querySelector('.hs-mood-cur');
    const old = prev ? prev.style.getPropertyValue('--hs-mood') : null;
    if (prev && old) {
      const p = document.createElement('div');
      p.className = 'hs-mood-prev';
      p.style.setProperty('--hs-mood', old);
      moodEl.appendChild(p);
      setTimeout(() => p.remove(), 800);
    }
    moodIdx = cidx;
    const curEl = document.createElement('div');
    curEl.className = 'hs-mood-cur';
    curEl.style.setProperty('--hs-mood', cidx != null ? bandWashDeepIdx(cidx) : 'var(--paper)');
    moodEl.querySelectorAll('.hs-mood-cur').forEach((x) => x.remove());
    moodEl.appendChild(curEl);
  }
  heroEl.innerHTML = heroHtml(d);
  countUp(heroEl.querySelector('.hs-heronum'));
  const airNowIdx = d.ambientUg != null ? bandIdx(d.ambientUg)
    : (d.series.some((v) => v != null) ? bandIdx(d.series.find((v) => v != null)) : null);
  renderBandScale(heroEl.querySelector('#hs-scale'), airNowIdx);
  const ink = airNowIdx != null ? bandInkIdx(airNowIdx) : 'var(--ink)';
  renderSparseArc(heroEl.querySelector('#hs-arc'), d.series, ink);
  incWrap.innerHTML = cur.cityWhy ? incidentHtml(cur.cityWhy) : '';
  moveWrap.innerHTML = moveHtml(cur.day, cur.pos ? !A.search.inDelhi(cur.pos.lat, cur.pos.lon) : false);
  oaWrap.innerHTML = cur.outlook ? outlookHtml(cur.outlook) : '';
  budWrap.innerHTML = budgetHtml();
}

async function refresh() {
  const pos = cur.pos || A.geo.pos || A.DELHI;
  const j = await A.api.get(`/aqi?lat=${pos.lat}&lon=${pos.lon}`, 8000);
  if (j) {
    cur.aqi = j;
    if (!cur.label) {
      A.search.reverse(pos.lat, pos.lon).then((n) => { if (n) { cur.label = n; paint(); } });
    }
    paint();
    const c = document.getElementById('consent');
    if (c && !c.hidden && onbPage === 0) renderOnb(c);
  }
  fetchDayCurve(pos.lat, pos.lon).then((dc) => { cur.day = dc; paint(); });
  fetchOutlook(pos.lat, pos.lon).then((o) => { cur.outlook = o; paint(); });
  if (cur.cityWhy === null) {
    A.api.get('/v2/city', 8000).then((j2) => {
      const w = j2 && j2.why;
      cur.cityWhy = w ? (w.cause_note || '') : '';
      paint();
    });
  }
}

/* ══ consent → onboarding (OnboardingScreen.tsx, 5 pages) ══ */
const ONB_PAGES = 5, ONB_CHOICE = 3;
function onbHtml(page, ambientUg) {
  const band = ambientUg != null ? bandIdx(ambientUg) : null;
  const body = [
    `<div class="onb-eyebrow">${esc(t('onb_airKicker'))}</div>
     ${ambientUg != null ? `<div class="onb-airrow"><span class="onb-airnum" style="color:${bandInkIdx(band)}">${Math.round(ambientUg)}</span><div class="onb-airmeta"><span class="onb-airunit">µg/m³</span><span class="onb-airband" style="color:${bandInkIdx(band)}">${esc(bandWord(band))}</span></div></div>` : ''}
     <div class="onb-line">${esc(t('onb_airLine'))}</div>`,
    `<div class="onb-hero">${esc(t('onb_whatTitle'))}</div>
     <div class="onb-arc">
       <div class="onb-arcrow"><span class="onb-arcwell">${ic('search', 19)}</span><span>${esc(t('onb_arcLineSearch'))}</span></div>
       <div class="onb-arcrow"><span class="onb-arcwell">${ic('dust', 19)}</span><span>${esc(t('onb_arcLineDose'))}</span></div>
       <div class="onb-arcrow"><span class="onb-arcwell">${ic('flag', 19)}</span><span>${esc(t('onb_arcLineReceipt'))}</span></div>
     </div>`,
    `<div class="onb-hero">${esc(t('onb_phoneTitle'))}</div>
     <div class="onb-lead">${esc(t('onb_phoneBody'))}</div>
     <div class="onb-kcard"><div class="onb-knum">3</div><div class="onb-klabel">${esc(t('onb_kLabel'))}</div></div>`,
    `<div class="onb-hero">${esc(t('consent_title'))}</div>
     <div class="onb-lead">${esc(t('consent_body'))}</div>
     <div class="onb-choice">
       <button class="onb-choicebtn share" data-onb="share"><span class="onb-choicet">${esc(t('consent_shareBtn'))}</span><span class="onb-choices">${esc(t('consent_shareSub'))}</span></button>
       <button class="onb-choicebtn keep" data-onb="keep"><span class="onb-choicet">${esc(t('consent_keepBtn'))}</span><span class="onb-choices">${esc(t('consent_keepSub'))}</span></button>
     </div>`,
    `<div class="onb-hero">${esc(t('onb_locTitle'))}</div>
     <div class="onb-lead">${esc(t('onb_locBody'))}</div>
     <button class="onb-locbtn" id="consent-yes">${ic('locate', 20)}<span>${esc(t('onb_locBtn'))}</span></button>
     <button class="onb-loclater" id="consent-skip">${esc(t('onb_locLater'))}</button>`,
  ][page];
  return `
    ${page === ONB_PAGES - 1 ? '' : '<span style="display:none"><button id="consent-yes"></button><button id="consent-skip"></button></span>'}
    <div class="onb-top">
      <span class="onb-word">Alive</span>
      ${page <= ONB_CHOICE ? `<button class="onb-skip" data-onb="skip">${esc(t('onb_skip'))}</button>` : ''}
    </div>
    <div class="onb-body">${body}</div>
    ${page <= ONB_CHOICE ? `<div class="onb-foot">${esc(t('consent_footnote'))}</div>` : ''}
    <div class="onb-footer">
      <div class="onb-dots">${Array.from({ length: ONB_PAGES }, (_, i) => `<span class="onb-dot ${i === page ? 'on' : ''}"></span>`).join('')}</div>
      ${page < ONB_PAGES - 1 ? `<button class="onb-next" data-onb="next">${esc(t('onb_next'))}${ic('chevron', 18)}</button>` : ''}
    </div>`;
}
let onbPage = 0;
function renderOnb(consentEl) {
  consentEl.innerHTML = `<div class="onb">${onbHtml(onbPage, cur.aqi && cur.aqi.pm25 != null ? Math.round(cur.aqi.pm25) : null)}</div>`;
}
function wireConsentLayer(consentEl) {
  if (!consentEl || consentEl.dataset.onb) return;
  consentEl.dataset.onb = '1';
  onbPage = 0;
  renderOnb(consentEl);
  consentEl.addEventListener('click', (e) => {
    if (e.target.closest('#consent-yes')) { e.stopPropagation(); e.preventDefault(); answer('gps'); return; }
    if (e.target.closest('#consent-skip')) { e.stopPropagation(); e.preventDefault(); answer('picked'); return; }
    const act = e.target.closest('[data-onb]');
    if (act) {
      e.stopPropagation(); e.preventDefault();
      const a = act.dataset.onb;
      if (a === 'next') { onbPage = Math.min(ONB_PAGES - 1, onbPage + 1); renderOnb(consentEl); }
      else if (a === 'skip') { A.store.set('onboarded', 1); consentEl.hidden = true; }
      else if (a === 'share') { setSettings({ share: true }); onbPage = 4; renderOnb(consentEl); }
      else if (a === 'keep') { setSettings({ share: false }); onbPage = 4; renderOnb(consentEl); }
      return;
    }
    if (A.geo.consent && e.target === consentEl) consentEl.hidden = true;
  }, true);
}
function openConsent() {
  const c = document.getElementById('consent');
  if (!c) return;
  wireConsentLayer(c);
  c.hidden = false;
}
function answer(mode) {
  const c = document.getElementById('consent');
  if (mode === 'gps') {
    A.geo.consent = 'granted'; A.store.set('consent', 'granted');
    if (c) c.hidden = true;
    A.geo.locate().then((pos) => { if (pos) applyPos(pos); }).catch(() => {});
  } else {
    if (A.geo.consent) { if (c) c.hidden = true; return; }
    A.geo.consent = 'picked'; A.store.set('consent', 'picked');
    if (c) c.hidden = true;
    A.toast('tap the map to drop your point');
  }
}
function applyPos(pos) {
  cur.pos = pos; cur.label = pos.label || null;
  A.store.set('pos', pos);
  cur.aqi = null; cur.day = null; cur.outlook = null; cur.cityWhy = null;
  refresh();
}

/* ══ mount ══ */
A.screen('home', {
  mount(elm) {
    elm.innerHTML = `
      <div class="hs">
        <div class="hs-mood" id="hs-mood"></div>
        <header class="hs-head">
          <div class="hs-brandwrap">
            <div class="hs-brand" id="hs-brand"></div>
            <div class="hs-sub" id="hs-sub"></div>
          </div>
          <button class="hs-menubtn" id="hs-menu" aria-label="${esc(t('a11yMenu'))}"><span class="hs-menubars"><i></i><i></i></span></button>
        </header>
        <div class="hs-ctabar">
          <button class="hs-cta" id="hs-cta" aria-label="${esc(t('goLabel'))}">
            ${ic('search', 19)}<span class="hs-ctatxt">${esc(t('searchPlaceholder'))}</span>
            <span class="hs-ctaarrow">${ic('navigate', 16)}</span>
          </button>
        </div>
        <div class="hs-scroll">
          <section class="hs-fade" style="animation-delay:0ms"><div class="hs-hero" id="hs-hero"></div></section>
          <section class="hs-fade" id="hs-incwrap" style="animation-delay:70ms"></section>
          <section class="hs-fade" id="hs-doorswrap" style="animation-delay:90ms"></section>
          <section class="hs-fade" id="hs-movewrap" style="animation-delay:130ms"></section>
          <section class="hs-fade" id="hs-oawrap" style="animation-delay:210ms"></section>
          <section class="hs-fade" id="hs-lenswrap" style="animation-delay:250ms"></section>
          <section class="hs-fade" id="hs-budwrap" style="animation-delay:300ms"></section>
        </div>
      </div>`;
    root = elm.firstElementChild;
    moodEl = elm.querySelector('#hs-mood');
    heroEl = elm.querySelector('#hs-hero');
    incWrap = elm.querySelector('#hs-incwrap');
    doorsWrap = elm.querySelector('#hs-doorswrap');
    moveWrap = elm.querySelector('#hs-movewrap');
    oaWrap = elm.querySelector('#hs-oawrap');
    lensWrap = elm.querySelector('#hs-lenswrap');
    budWrap = elm.querySelector('#hs-budwrap');

    doorsWrap.innerHTML = doorsHtml();
    lensWrap.innerHTML = lensHtml();

    const brandEl = elm.querySelector('#hs-brand'), subEl = elm.querySelector('#hs-sub');
    const WEEKDAY_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const tickClock = () => {
      const now = Date.now();
      const { h24, dow } = istParts(now);
      const key = h24 < 5 || h24 >= 21 ? 'homeGreetNight' : h24 < 12 ? 'homeGreetMorning' : h24 < 17 ? 'homeGreetAfternoon' : 'homeGreetEvening';
      brandEl.textContent = cap(t(key));
      subEl.textContent = `${t('cityName')} · ${cap(dayLabel(WEEKDAY_EN[dow]))} · ${clockLabel(now)}`;
    };
    tickClock();
    clockTimer = setInterval(tickClock, 1000);

    elm.querySelector('#hs-menu').addEventListener('click', () => {
      if (A.screensReady.settings) location.hash = '#/settings';
      else A.toast('settings lands with the coordinator');
    });
    elm.querySelector('#hs-cta').addEventListener('click', () => { location.hash = '#/whereto'; });
    elm.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { location.hash = `#/${go.dataset.go}`; return; }
      const oa = e.target.closest('.hs-oacell');
      if (oa) {
        const det = elm.querySelector('#hs-oadetail');
        const open = det && det.dataset.open === oa.dataset.date;
        elm.querySelectorAll('.hs-oacell').forEach((c) => {
          const sel = !open && c === oa;
          c.classList.toggle('sel', sel);
          c.setAttribute('aria-expanded', sel ? 'true' : 'false');
        });
        if (det) {
          det.innerHTML = open ? '' : outlookDetailHtml(cur.outlook, oa.dataset.date);
          det.dataset.open = open ? '' : oa.dataset.date;
        }
        return;
      }
      const pill = e.target.closest('.hs-lenspill');
      if (pill) {
        saveCheckin({ [pill.dataset.facet]: pill.dataset.val });
        lensWrap.innerHTML = lensHtml();
        return;
      }
      const seg = e.target.closest('.hs-profseg');
      if (seg) { setSettings({ profile: seg.dataset.profile, profile_set: true }); paint(); }
    });

    const chip = document.getElementById('loc-chip');
    const setChip = () => {
      if (!chip) return;
      const granted = A.geo.consent === 'granted';
      const picked = A.geo.consent === 'picked';
      const s0 = chip.querySelector('span');
      if (s0) s0.textContent = granted ? 'live location' : picked ? 'picked spot' : 'set your location';
      chip.classList.toggle('live', granted);
      /* RN home carries no location chip — the provLine is the nudge;
         the frozen #loc-chip stays hidden (consent opens on first run) */
    };
    setChip();
    if (chip && !chip.dataset.homeWired) {
      chip.dataset.homeWired = '1';
      chip.addEventListener('click', openConsent);
    }

    if (!A.geo.consent && !A.store.get('onboarded')) openConsent();
    else if (A.geo.consent === 'granted' && !A.geo.pos) {
      A.geo.locate().then((p) => { if (p) applyPos(p); }).catch(() => {});
    }
    if (A.geo.pos) { cur.pos = A.geo.pos; cur.label = A.geo.pos.label || null; }

    A.map.setFieldVisible(false);
    paint();
    refresh();
    const poll = setInterval(refresh, POLL_MS);
    const tick = setInterval(paint, TICK_MS);

    const onLoc = (e) => {
      const pos = e.detail;
      if (!pos) return;
      applyPos(pos);
      A.map.ready((m) => A.map.fly(pos.lat, pos.lon, Math.max(11.4, m.getZoom())));
      if (pos.acc) A.map.puckMove(pos.lat, pos.lon, pos.acc);
      else A.map.puckMove(pos.lat, pos.lon, null);
      setChip();
    };
    const onTap = (e) => {
      if (A.geo.consent !== 'picked') return;
      const p = { lat: e.detail.lat, lon: e.detail.lon, label: null, picked: true };
      applyPos(p);
      A.map.puckMove(p.lat, p.lon, null);
    };
    document.addEventListener('alive:location', onLoc);
    document.addEventListener('alive:maptap', onTap);

    return () => {
      clearInterval(poll); clearInterval(tick); clearInterval(clockTimer);
      document.removeEventListener('alive:location', onLoc);
      document.removeEventListener('alive:maptap', onTap);
      A.map.puckRemove();
    };
  },
});
})();
