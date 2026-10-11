/* home.js — the home surface + the location consent (inside #consent).

   Home = the EXACT spot the user is on: the AQI as the big number in its
   band colour + band word, PM2.5 and PM10 side by side, one provenance
   line, one plain line on how that air is. Then the doors: Air around
   me · Purest places · Trips. Nothing else — no captions, no explainers.

   Data (all live, nothing invented):
     /aqi?lat&lon → pm25 (station-kriged field), pm10 (station-grounded
     field), nearest_station_km, field.stations[] (named monitors),
     field.age_s (how old the read is).
     AQI = the CPCB national index: max of the PM2.5 and PM10 sub-indices
     through CPCB's own breakpoint tables (the same PM2.5 table as
     server/districts.py cpcb_aqi). Band colour + word = that index's
     CPCB category, so number, colour and word always agree.

   Consent: one short intro (the live number) → one sheet: share my
   location / drop a point / not now, plus the trip-sharing switch
   (default OFF). Keys: alive.consent 'granted'|'picked'|'later',
   alive.onboarded 1, alive.pos {lat,lon,t[,picked]}, alive.settings.share.

   The day log (on-device dose reconstruction from live reads + finished
   trips) stays — it feeds the small "today you've breathed" row. */
(() => {
'use strict';

const POLL_MS = 5 * 60 * 1000, TICK_MS = 30 * 1000;
const IST_MS = 330 * 60 * 1000;

/* ── icons: Material Symbols Rounded paths on the 960 grid ── */
const ICONS = {
  "search": ["M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"],
  "navigate": ["M480-240 222-130q-13 5-24.5 2.5T178-138q-8-8-10.5-20t2.5-25l273-615q5-12 15.5-18t21.5-6q11 0 21.5 6t15.5 18l273 615q5 13 2.5 25T782-138q-8 8-19.5 10.5T738-130L480-240Zm-196-4 196-84 196 84-196-440-196 440Zm196-84Z"],
  "explore": ["M480-440q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520q17 0 28.5 11.5T520-480q0 17-11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320ZM297-277l250-117q6-3 11-8t8-11l117-250q5-10-2.5-17.5T663-683L413-566q-6 3-11 8t-8 11L277-297q-5 10 2.5 17.5T297-277Z"],
  "city": ["M120-200v-400q0-33 23.5-56.5T200-680h160v-47q0-16 6-30.5t17-25.5l40-40q23-23 57-23t57 23l40 40q11 11 17 25.5t6 30.5v207h160q33 0 56.5 23.5T840-440v240q0 33-23.5 56.5T760-120H200q-33 0-56.5-23.5T120-200Zm80 0h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm240 320h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm240 480h80v-80h-80v80Zm0-160h80v-80h-80v80Z"],
  "history": ["M480-120q-126 0-223-76.5T131-392q-4-15 6-27.5t27-14.5q16-2 29 6t18 24q24 90 99 147t170 57q117 0 198.5-81.5T760-480q0-117-81.5-198.5T480-760q-69 0-129 32t-101 88h70q17 0 28.5 11.5T360-600q0 17-11.5 28.5T320-560H160q-17 0-28.5-11.5T120-600v-160q0-17 11.5-28.5T160-800q17 0 28.5 11.5T200-760v54q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-480q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-120Zm40-376 100 100q11 11 11 28t-11 28q-11 11-28 11t-28-11L452-452q-6-6-9-13.5t-3-15.5v-159q0-17 11.5-28.5T480-680q17 0 28.5 11.5T520-640v144Z"],
  "pin": ["M480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 79q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 45-17.5 94.5t-51 103Q698-301 648-244T533-127q-11 10-25 15t-28 5Zm0-453Zm0 80q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z"],
  "chevron": ["M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z"],
  "locate": ["M440-82v-40q-125-14-214.5-103.5T122-440H82q-17 0-28.5-11.5T42-480q0-17 11.5-28.5T82-520h40q14-125 103.5-214.5T440-838v-40q0-17 11.5-28.5T480-918q17 0 28.5 11.5T520-878v40q125 14 214.5 103.5T838-520h40q17 0 28.5 11.5T918-480q0 17-11.5 28.5T878-440h-40q-14 125-103.5 214.5T520-122v40q0 17-11.5 28.5T480-42q-17 0-28.5-11.5T440-82Zm40-118q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400Zm0-80Z"],
  "dust": ["M460-160q-32 0-59.5-16T356-220q-11-20-.5-40t32.5-20q13 0 23 8t18 18q5 7 13.5 10.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H120q-17 0-28.5-11.5T80-360q0-17 11.5-28.5T120-400h340q50 0 85 35t35 85q0 50-35 85t-85 35ZM120-560q-17 0-28.5-11.5T80-600q0-17 11.5-28.5T120-640h500q25 0 42.5-17.5T680-700q0-25-17.5-42.5T620-760q-16 0-30 7.5T568-731q-7 12-17 21.5t-24 9.5q-20 0-32.5-15t-6.5-32q14-42 50.5-67.5T620-840q58 0 99 41t41 99q0 58-41 99t-99 41H120Zm678 308q-20 9-39-2.5T740-288q0-14 9.5-23.5T771-328q14-8 21.5-22t7.5-30q0-25-17.5-42.5T740-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h620q58 0 99 41t41 99q0 42-22 76.5T798-252Z"]
};
function ic(name, size, cls) {
  const d = ICONS[name];
  if (!d) return '';
  const paths = (Array.isArray(d) ? d : [d]).map((p) => `<path d="${p}"/>`).join('');
  return `<svg class="ic ${cls || ''}" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">${paths}</svg>`;
}

/* ── the band palette (app.css --b0..--b5, V2T theme math) ── */
const INK = '#16181D';
const BANDS = ['#6E93AE', '#C7A34F', '#CF8A50', '#C05F3A', '#A83D30', '#6E2D28'];
const hexMix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};
const bandColorIdx = (i) => BANDS[i];
const bandWashDeepIdx = (i) => hexMix(BANDS[i], '#FFFFFF', 0.68);
const bandInkIdx = (i) => hexMix(BANDS[i], INK, 0.20);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/* ── the CPCB national AQI (sub-index = linear inside the breakpoint
   band; overall = the max sub-index). PM2.5 table = server/districts.py
   _CPCB_PM25 verbatim; PM10 = CPCB Table 3.1 (0-50, 51-100, 101-250,
   251-350, 351-430, 430+). The index tops out at 500 — beyond, "500+". */
const CPCB_PM25 = [[0, 30, 0, 50], [30, 60, 51, 100], [60, 90, 101, 200], [90, 120, 201, 300], [120, 250, 301, 400], [250, 500, 401, 500]];
const CPCB_PM10 = [[0, 50, 0, 50], [50, 100, 51, 100], [100, 250, 101, 200], [250, 350, 201, 300], [350, 430, 301, 400], [430, 510, 401, 500]];
function subIndex(c, table) {
  if (!isNum(c) || c < 0) return null;
  for (const [lo, hi, ilo, ihi] of table) if (c <= hi) return ilo + ((ihi - ilo) / (hi - lo)) * (c - lo);
  const [lo, hi, ilo, ihi] = table[table.length - 1];
  return ilo + ((ihi - ilo) / (hi - lo)) * (c - lo);
}
function cpcbAqi(pm25, pm10) {
  const a = subIndex(pm25, CPCB_PM25), b = subIndex(pm10, CPCB_PM10);
  if (a == null && b == null) return null;
  const v = Math.max(a == null ? -1 : a, b == null ? -1 : b);
  return { aqi: Math.min(500, Math.round(v)), over: v > 500.5,
    basis: b != null && (a == null || b > a) ? 'pm10' : 'pm25' };
}
const aqiBandIdx = (aqi) => (!isNum(aqi) ? null
  : aqi <= 50 ? 0 : aqi <= 100 ? 1 : aqi <= 200 ? 2 : aqi <= 300 ? 3 : aqi <= 400 ? 4 : 5);
const pm25BandIdx = (v) => aqiBandIdx(subIndex(v, CPCB_PM25) == null ? null : Math.round(subIndex(v, CPCB_PM25)));
const pm10BandIdx = (v) => aqiBandIdx(subIndex(v, CPCB_PM10) == null ? null : Math.round(subIndex(v, CPCB_PM10)));

/* ── settings — the one shared key (settings.js reads the same) ── */
const DEFAULT_SETTINGS = {
  lang: 'en', voice: true, share: false, brief: false, remind: true,
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

/* ── day log — port of Mobile/src/store/daylog.ts: ambient samples from
   live field reads at a fresh fix + finished trips → the day's dose.
   On this device only, never uploaded. ── */
const dayKeyOf = (t0) => {
  const d = new Date(t0 + IST_MS);
  return `${d.getUTCFullYear()}-${`${d.getUTCMonth() + 1}`.padStart(2, '0')}-${`${d.getUTCDate()}`.padStart(2, '0')}`;
};
const GAP_INTERP_MS = 45 * 60000, VE_REST_M3H = 0.6, THIN_SAMPLE_MIN = 3,
  SAMPLE_KEEP_MS = 21 * 86400000, MAX_SAMPLES = 4000;
const getSamples = () => A.store.get('daylog.samples', []) || [];
const saveSamples = (ls) => A.store.set('daylog.samples', ls);
function recordSample(s) {
  const ls = getSamples();
  const last = ls.length ? ls[ls.length - 1] : null;
  /* dedupe: the same air at the same spot under 8 min is one sample */
  if (last && s.ts - last.ts < 8 * 60000 &&
      Math.abs(s.lat - last.lat) + Math.abs(s.lon - last.lon) < 0.008) return;
  ls.push(s);
  saveSamples(ls.filter((x) => x.ts >= Date.now() - SAMPLE_KEEP_MS).slice(-MAX_SAMPLES));
}
function personalSample(fix, read, now) {
  /* a fresh fix + a live field read, else nothing: we never attribute
     air the phone can't place-and-date */
  if (!fix || !isNum(fix.lat) || !isNum(fix.lon)) return null;
  const ts = fix.ts || 0;
  if (ts <= 0 || now - ts > 15 * 60000) return null;
  const amb = read ? read.amb : null;
  if (!isNum(amb) || amb < 0) return null;
  const ageS = read ? read.fieldAgeS : null;
  if (ageS != null && (!isNum(ageS) || ageS < 0 || ageS > 900)) return null;
  return { ts, lat: fix.lat, lon: fix.lon, amb, bz: read && isNum(read.bz) ? read.bz : null };
}
const dayStartOf = (k) => Date.parse(`${k}T00:00:00+05:30`);
const istHourOf = (t0) => new Date(t0 + IST_MS).getUTCHours();
const loadTrips = () => (A.store.get('journey.history', []) || [])
  .filter((r) => r && !r.simulated && (r.dose_ug > 0))   /* previews never counted — nobody breathed them */
  .map((r) => ({ ts: r.t || 0, dose_ug: +r.dose_ug || 0 }))
  .filter((tr) => tr.ts > 0);
function reconstructDay(day, samples, trips, now) {
  const dayStart = dayStartOf(day);
  const dayEnd = Math.min(dayStart + 24 * 3600 * 1000, now);
  const concOf = (s) => (isNum(s.bz) ? s.bz : s.amb);
  let stayUg = 0;
  for (let i = 0; i + 1 < samples.length; i++) {
    const a = samples[i], b = samples[i + 1];
    if (a.ts >= dayEnd || b.ts <= dayStart) continue;
    const gap = b.ts - a.ts;
    if (gap <= 0 || gap > GAP_INTERP_MS) continue;
    const t0 = Math.max(a.ts, dayStart), t1 = Math.min(b.ts, dayEnd);
    if (t1 <= t0) continue;
    const c0 = concOf(a) + (concOf(b) - concOf(a)) * ((t0 - a.ts) / gap);
    const c1 = concOf(a) + (concOf(b) - concOf(a)) * ((t1 - a.ts) / gap);
    stayUg += ((c0 + c1) / 2) * VE_REST_M3H * ((t1 - t0) / 3600000);
  }
  let tripUg = 0, dayTrips = 0;
  for (const tr of trips) {
    if (dayKeyOf(tr.ts) !== day || !(tr.dose_ug > 0)) continue;
    tripUg += tr.dose_ug; dayTrips += 1;
  }
  const daySamples = samples.filter((s) => dayKeyOf(s.ts) === day).length;
  return {
    totalUg: Math.round((stayUg + tripUg) * 10) / 10,
    thin: daySamples < THIN_SAMPLE_MIN && dayTrips === 0,
  };
}
const todayDose = () => reconstructDay(dayKeyOf(Date.now()), getSamples(), loadTrips(), Date.now());
const doseUgRound = (ug) => (ug >= 10 ? Math.round(ug) : Math.round(ug * 10) / 10);

/* ── strings (en) ── */
const S = {
  searchPlaceholder: 'Where to?', goLabel: 'go somewhere', a11yMenu: 'menu', cityName: 'Delhi',
  homeGreetMorning: 'Good morning', homeGreetAfternoon: 'Good afternoon',
  homeGreetEvening: 'Good evening', homeGreetNight: 'Up late',
  eyeLive: 'Air where you are', eyePin: 'Air at your pin', eyeStale: 'Air at your last fix',
  eyeOff: "Central Delhi's air", eyeLocating: 'Finding you…',
  aqiLbl: 'AQI',
  band0: 'Good', band1: 'Satisfactory', band2: 'Moderate', band3: 'Poor', band4: 'Very poor', band5: 'Severe',
  /* CPCB's own "possible health impacts" per AQI category, in plain words */
  plain0: 'Clean air — little to no impact on health.',
  plain1: 'Mostly fine — sensitive people may feel slight breathing discomfort.',
  plain2: 'Can bother people with asthma, lung or heart conditions.',
  plain3: 'Breathing discomfort for most people on long exposure.',
  plain4: 'Can cause breathing illness on long exposure.',
  plain5: 'Affects healthy people; serious for those with lung or heart disease.',
  provFromAway: 'from {s} · {k} km away', provFrom: 'from {s}',
  provKmAway: 'nearest monitor ~{k} km away', provAge: 'read {m} min ago',
  provEdge: "outside the live air map — the nearest edge's read",
  offNote: 'Location is off — this is central Delhi, not your spot.',
  locatingNote: 'Showing central Delhi until your location comes in.',
  blockedNote: 'Location is blocked for this site — drop a point instead.',
  setLoc: 'Set location', changeSpot: 'Change',
  doseRow: "You've breathed ≈ {n} µg today",
  waiting: 'Reading the air here…',
  noRead: "Couldn't read the air just now.", retry: 'Try again',
  outOfArea: 'Alive covers Delhi and the NCR — this spot is outside it.',
  doorAir: 'Air around me', doorPurest: 'Purest places', doorTrips: 'Trips',
  pickHint: 'Tap the map where you are — the air reads there.',
  pickGps: 'Use my location', pickCancel: 'Cancel',
  /* consent */
  introKicker: 'Delhi · right now',
  introLine: "You can't see it. You still breathe it.",
  introNext: 'Continue',
  csTitle: 'Use your location?',
  csBody: 'Your location is only used to analyse the air around you. It stays on this phone.',
  csTripsK: 'Share my trips',
  csTrips: 'Alive counts trips anonymously — never where you go, unless you choose to share trips.',
  csGps: 'Share my location', csGpsBusy: 'Finding you…',
  csPin: 'Drop a point on the map', csLater: 'Not now',
  csLaterToast: "Showing central Delhi's air — not your exact spot",
  csDenied: 'Location is blocked for this site in your browser. Drop a point instead — it works the same.',
  csNoFix: "Couldn't find you just now. Try again, or drop a point.",
  csNoGeo: "This browser can't share location — drop a point instead.",
  csPinToast: 'Tap the map where you are',
};
const t = (k, vars) => {
  let s = S[k] ?? k;
  if (vars) for (const key of Object.keys(vars)) s = s.replaceAll(`{${key}}`, String(vars[key]));
  return s;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ── clock (IST) ── */
const istParts = (t0) => { const d = new Date(t0 + IST_MS); return { h24: d.getUTCHours(), min: d.getUTCMinutes(), dow: d.getUTCDay() }; };
const clockLabel = (t0) => {
  const { h24, min } = istParts(t0);
  return `${((h24 + 11) % 12) + 1}:${`${min}`.padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
};
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ── the monitor named in the provenance line: /aqi serves
   field.stations[] = the live instruments feeding the field; the one
   cited is the argmin under the server's own km constants
   (airfield._KY/_KX) — it reproduces nearest_station_km, so the name is
   cited, never invented ── */
const ST_KY = 110.6, ST_KX = 99.4;
const nearestStationName = (aqi, lat, lon) => {
  const sts = aqi && aqi.field && Array.isArray(aqi.field.stations) ? aqi.field.stations : null;
  if (!sts || !isNum(lat) || !isNum(lon)) return null;
  let name = null, bk = Infinity;
  for (const s of sts) {
    if (!s || !isNum(s.lat) || !isNum(s.lon)) continue;
    const k = Math.hypot((s.lat - lat) * ST_KY, (s.lon - lon) * ST_KX);
    if (k < bk) { bk = k; name = s.name; }
  }
  return typeof name === 'string' && name.trim() ? name : null;
};
/* 'Mandir Marg, Delhi, Delhi, India' → 'Mandir Marg' */
const stationLabel = (name) => {
  const parts = String(name || '').split(',').map((p) => p.trim()).filter(Boolean);
  while (parts.length > 1 && /^(new )?delhi$|^nct$|^ncr$|^india$/i.test(parts[parts.length - 1])) parts.pop();
  return parts.join(', ');
};

/* ══ state ══ */
const cur = {
  pos: null,          /* the position home reads at (pin or GPS fix) */
  aqi: null,          /* the last /aqi body for `aqiAt` */
  aqiAt: null, aqiFetchedAt: 0,
  err: null,          /* 'net' | 'outside' | null */
  locErr: null,       /* 'denied' when the browser blocks a granted re-lock */
  picking: false,     /* the map is the picker right now */
  seq: 0,
};

/* which position the read is for, named honestly:
   live     — GPS granted, fix under 2 min old
   stale    — GPS granted, the quoted fix is older (re-lock in flight)
   pin      — a dropped point (consent 'picked')
   locating — GPS granted but no fix yet → central Delhi meanwhile
   off      — no position (not now / no drop yet / blocked) → central Delhi */
function posState() {
  const c = A.geo.consent;
  const p = (c === 'granted' || c === 'picked') ? (cur.pos || A.geo.pos || null) : null;
  if (!p || !isNum(p.lat) || !isNum(p.lon)) {
    return { pos: null, state: c === 'granted' && !cur.locErr ? 'locating' : 'off' };
  }
  if (c === 'picked' || p.picked) return { pos: p, state: 'pin' };
  const fresh = !!(p.t && Date.now() - p.t < 120000);
  return { pos: p, state: fresh ? 'live' : 'stale' };
}

/* ══ HERO ══ */
function heroData() {
  const ps = posState();
  const j = cur.aqi;
  const at = cur.aqiAt;
  const pm25 = j && isNum(j.pm25) ? j.pm25 : null;
  const pm10 = j && isNum(j.pm10) ? j.pm10 : null;
  const ageS = j && j.field && isNum(j.field.age_s)
    ? j.field.age_s + Math.max(0, (Date.now() - cur.aqiFetchedAt) / 1000) : null;
  return {
    state: ps.state,
    pm25, pm10,
    v: cpcbAqi(pm25, pm10),
    km: j && isNum(j.nearest_station_km) ? j.nearest_station_km : null,
    station: j && at ? stationLabel(nearestStationName(j, at.lat, at.lon)) : null,
    edge: !!(j && j.beyond_field_edge),
    readMin: ageS != null ? Math.max(0, Math.floor(ageS / 60)) : null,
    dose: todayDose(),
  };
}
function provLine(d) {
  const away = d.state === 'live' || d.state === 'stale' || d.state === 'pin';
  const src = d.edge ? t('provEdge')
    : d.station ? (away && d.km != null ? t('provFromAway', { s: d.station, k: d.km }) : t('provFrom', { s: d.station }))
    : (away && d.km != null ? t('provKmAway', { k: d.km }) : null);
  return [src, d.readMin != null ? t('provAge', { m: d.readMin }) : null].filter(Boolean).join(' · ');
}
function heroHtml(d) {
  const eyebrow = { live: 'eyeLive', stale: 'eyeStale', pin: 'eyePin', locating: 'eyeLocating', off: 'eyeOff' }[d.state];
  const locBtn = d.state === 'off'
    ? `<button class="hs-locbtn" type="button" data-act="consent">${ic('locate', 16)}<span>${esc(t('setLoc'))}</span></button>`
    : d.state === 'pin'
      ? `<button class="hs-locbtn" type="button" data-act="consent">${ic('pin', 16)}<span>${esc(t('changeSpot'))}</span></button>`
      : '';
  const head = `<div class="hs-eyerow"><span class="hs-eyebrow">${esc(t(eyebrow))}</span>${locBtn}</div>`;
  const note = d.state === 'off' ? (cur.locErr === 'denied' ? t('blockedNote') : t('offNote'))
    : d.state === 'locating' ? t('locatingNote') : null;
  const noteHtml = note ? `<div class="hs-note">${esc(note)}</div>` : '';

  if (!d.v) {
    if (cur.err === 'outside') return `${head}<div class="hs-quiet">${esc(t('outOfArea'))}</div>${noteHtml}`;
    if (cur.err === 'net') {
      return `${head}<div class="hs-quiet">${esc(t('noRead'))}</div>
        <button class="hs-retry" type="button" data-act="retry">${esc(t('retry'))}</button>${noteHtml}`;
    }
    return `${head}<div class="hs-wait" aria-busy="true"><span class="hs-waitnum sk"></span>
      <span class="hs-waittxt">${esc(t('waiting'))}</span></div>`;
  }
  const idx = aqiBandIdx(d.v.aqi);
  const ink = bandInkIdx(idx);
  const p25i = pm25BandIdx(d.pm25), p10i = pm10BandIdx(d.pm10);
  const pmTile = (k, v, bi) => `<div class="hs-pm">
      <span class="hs-pmk">${bi != null ? `<i class="hs-pmdot" style="background:${bandColorIdx(bi)}"></i>` : ''}${k}</span>
      <span class="hs-pmv">${v != null ? Math.round(v) : '—'}<span class="hs-pmu">µg/m³</span></span>
    </div>`;
  const prov = provLine(d);
  const dose = d.dose && !d.dose.thin && d.dose.totalUg > 0
    ? `<button class="hs-dose" type="button" data-go="ledger">${ic('dust', 18, 'hs-doseic')}<span class="hs-dosetxt">${esc(t('doseRow', { n: doseUgRound(d.dose.totalUg) }))}</span>${ic('chevron', 18, 'hs-dosechev')}</button>`
    : '';
  return `${head}
    <div class="hs-aqirow">
      <span class="hs-aqinum" style="color:${ink}" data-count="${d.v.aqi}">${d.v.aqi}${d.v.over ? '+' : ''}</span>
      <span class="hs-aqimeta">
        <span class="hs-aqilbl">${esc(t('aqiLbl'))}</span>
        <span class="hs-bandrow"><i class="hs-bandsq" style="background:${bandColorIdx(idx)}"></i><span class="hs-bandword" style="color:${ink}">${esc(t('band' + idx))}</span></span>
      </span>
    </div>
    <div class="hs-pmrow">${pmTile('PM2.5', d.pm25, p25i)}${pmTile('PM10', d.pm10, p10i)}</div>
    <div class="hs-plain">${esc(t('plain' + idx))}</div>
    ${noteHtml}
    ${prov ? `<div class="hs-prov">${esc(prov)}</div>` : ''}
    ${dose}`;
}

/* ══ DOORS — one grouped list card ══ */
const DOORS = [
  { glyph: 'explore', key: 'doorAir', id: 'airmap' },
  { glyph: 'city', key: 'doorPurest', id: 'purest' },
  { glyph: 'history', key: 'doorTrips', id: 'ledger' },
];
function doorsHtml() {
  const rows = DOORS.filter((d) => A.screensReady[d.id]).map((d, i) => `
    ${i > 0 ? '<div class="hs-doorsep"></div>' : ''}
    <button class="hs-doorrow" type="button" data-go="${d.id}">
      ${ic(d.glyph, 24, 'hs-dooric')}<span class="hs-doorlbl">${esc(t(d.key))}</span>${ic('chevron', 18, 'hs-doorchev')}
    </button>`).join('');
  return rows ? `<div class="hcard hs-doorcard">${rows}</div>` : '';
}

/* ══ screen ══ */
let root = null, heroEl = null, moodEl = null, moodIdx = -1, lastCount = null;

function paintMood(idx) {
  if (!moodEl || idx === moodIdx) return;
  const prev = moodEl.querySelector('.hs-mood-cur');
  const old = prev ? prev.style.getPropertyValue('--hs-mood') : null;
  if (prev && old) {
    const p = document.createElement('div');
    p.className = 'hs-mood-prev';
    p.style.setProperty('--hs-mood', old);
    moodEl.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }
  moodIdx = idx;
  moodEl.querySelectorAll('.hs-mood-cur').forEach((x) => x.remove());
  const c = document.createElement('div');
  c.className = 'hs-mood-cur';
  c.style.setProperty('--hs-mood', idx != null ? bandWashDeepIdx(idx) : 'var(--paper)');
  moodEl.appendChild(c);
}
function countUp(span, target) {
  if (!span || !isNum(target)) return;
  const suffix = span.textContent.endsWith('+') ? '+' : '';
  const from = isNum(lastCount) ? lastCount : 0;
  lastCount = target;
  if (from === target) return;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / 600);
    const e = 1 - Math.pow(1 - p, 3);
    span.textContent = `${Math.round(from + (target - from) * e)}${p >= 1 ? suffix : ''}`;
    if (p < 1) requestAnimationFrame(step);
  };
  span.textContent = `${from}`;
  requestAnimationFrame(step);
}
function setPick() {
  if (root) root.classList.toggle('hs-picking', !!cur.picking);
}
function paint() {
  if (!heroEl) return;
  const d = heroData();
  paintMood(d.v ? aqiBandIdx(d.v.aqi) : null);
  heroEl.innerHTML = heroHtml(d);
  if (d.v) countUp(heroEl.querySelector('.hs-aqinum'), d.v.aqi);
  setPick();
}

let relocating = false;
function relocate() {
  if (relocating || !navigator.geolocation) return;
  relocating = true;
  A.geo.locate().then((p) => {
    relocating = false;
    cur.locErr = null;
    if (p && A.geo.consent === 'granted') applyPos(p);
  }).catch((e) => {
    relocating = false;
    if (e && e.code === 1) { cur.locErr = 'denied'; paint(); }
  });
}
async function refresh() {
  const ps = posState();
  const at = ps.pos || A.DELHI;
  if (A.geo.consent === 'granted' && (!ps.pos || !ps.pos.t || Date.now() - ps.pos.t > 60000)) relocate();
  const seq = ++cur.seq;
  const j = await A.api.get(`/aqi?lat=${at.lat}&lon=${at.lon}`, 8000);
  if (seq !== cur.seq) return;          /* a newer position superseded this read */
  if (j && isNum(j.pm25)) {
    cur.aqi = j; cur.aqiAt = { lat: at.lat, lon: at.lon }; cur.aqiFetchedAt = Date.now(); cur.err = null;
    /* a live field read at a fresh fix → an ambient sample for the day log */
    if (ps.pos && ps.state !== 'pin') {
      const smp = personalSample({ lat: at.lat, lon: at.lon, ts: ps.pos.t || 0 },
        { amb: isNum(j.pm25_ambient) ? j.pm25_ambient : j.pm25, bz: j.pm25,
          fieldAgeS: j.field && j.field.age_s != null ? j.field.age_s : null }, Date.now());
      if (smp) recordSample(smp);
    }
  } else if (j && j.error && j.pm25 == null && /area|service|outside/i.test(String(j.error))) {
    cur.aqi = null; cur.err = 'outside';
  } else if (!cur.aqi || !cur.aqiAt || cur.aqiAt.lat !== at.lat || cur.aqiAt.lon !== at.lon) {
    cur.aqi = null; cur.err = 'net';
  }
  paint();
}
function applyPos(pos) {
  if (!pos || !isNum(pos.lat) || !isNum(pos.lon)) return;
  if (!pos.t) pos.t = Date.now();   /* the fix's age gates sampling */
  cur.pos = pos;
  A.geo.pos = pos;
  A.store.set('pos', pos);
  cur.aqi = null; cur.err = null; lastCount = null;
  paint();
  refresh();
}

/* ══ CONSENT — one short intro (the live number), then one sheet ══ */
const CS = { el: null, intro: false, busy: false, note: null, introRead: null };
const placeholders = '<span hidden><button id="consent-yes" type="button"></button><button id="consent-skip" type="button"></button></span>';
function introNumHtml() {
  const j = CS.introRead;
  const v = j ? cpcbAqi(isNum(j.pm25) ? j.pm25 : null, isNum(j.pm10) ? j.pm10 : null) : null;
  if (!v) return '';
  const idx = aqiBandIdx(v.aqi);
  return `<span class="cs-airnum" style="color:${bandInkIdx(idx)}">${v.aqi}${v.over ? '+' : ''}</span>
    <span class="cs-airmeta"><span class="cs-airlbl">${esc(t('aqiLbl'))}</span>
    <span class="cs-airband" style="color:${bandInkIdx(idx)}"><i class="cs-airsq" style="background:${bandColorIdx(idx)}"></i>${esc(t('band' + idx))}</span></span>`;
}
function sheetHtml() {
  const share = !!getSettings().share;
  return `<div class="cs-sheet" role="dialog" aria-modal="true" aria-labelledby="cs-title">
      <div class="cs-grab" aria-hidden="true"></div>
      <div class="cs-glyph" aria-hidden="true">${ic('locate', 24)}</div>
      <h2 class="cs-title" id="cs-title">${esc(t('csTitle'))}</h2>
      <p class="cs-body">${esc(t('csBody'))}</p>
      <div class="cs-note" role="status"${CS.note ? '' : ' hidden'}>${esc(CS.note || '')}</div>
      <button class="cs-trip" type="button" data-cs="share" role="switch" aria-checked="${share}">
        <span class="cs-tripmid"><span class="cs-tripk">${esc(t('csTripsK'))}</span><span class="cs-tript">${esc(t('csTrips'))}</span></span>
        <span class="cs-sw${share ? ' on' : ''}" aria-hidden="true"><i></i></span>
      </button>
      <div class="cs-actions">
        <button class="cs-primary" type="button" data-cs="gps"${CS.busy ? ' disabled' : ''}>${ic('locate', 20)}<span>${esc(t(CS.busy ? 'csGpsBusy' : 'csGps'))}</span></button>
        <button class="cs-secondary" type="button" data-cs="pin">${ic('pin', 20)}<span>${esc(t('csPin'))}</span></button>
        <button class="cs-later" type="button" data-cs="later">${esc(t('csLater'))}</button>
      </div>
    </div>`;
}
function consentHtml() {
  const intro = CS.intro ? `<section class="cs-intro">
      <div class="cs-introtop"><span class="cs-word">Alive</span></div>
      <div class="cs-introbody">
        <div class="cs-kicker">${esc(t('introKicker'))}</div>
        <div class="cs-airrow" id="cs-airrow">${introNumHtml()}</div>
        <div class="cs-line">${esc(t('introLine'))}</div>
      </div>
      <button class="cs-next" type="button" data-cs="next">${esc(t('introNext'))}${ic('chevron', 18)}</button>
    </section>` : '';
  return `<div class="cs${CS.intro ? ' cs-hasintro' : ' sheet-on anim'}">${placeholders}${intro}
    <div class="cs-scrim" data-cs="scrim"></div>${sheetHtml()}</div>`;
}
function renderConsent() {
  if (CS.el) CS.el.innerHTML = consentHtml();
}
function refreshSheetBits() {
  /* in-place updates — never re-render the sheet mid-gesture */
  const el = CS.el;
  if (!el) return;
  const n = el.querySelector('.cs-note');
  if (n) { n.textContent = CS.note || ''; n.hidden = !CS.note; }
  const g = el.querySelector('[data-cs="gps"]');
  if (g) { g.disabled = !!CS.busy; const s = g.querySelector('span'); if (s) s.textContent = t(CS.busy ? 'csGpsBusy' : 'csGps'); }
  const sw = el.querySelector('[data-cs="share"]');
  if (sw) {
    const on = !!getSettings().share;
    sw.setAttribute('aria-checked', String(on));
    const k = sw.querySelector('.cs-sw'); if (k) k.classList.toggle('on', on);
  }
}
function loadIntroRead() {
  if (CS.introRead || CS.introLoading) return;
  CS.introLoading = true;
  A.api.get(`/aqi?lat=${A.DELHI.lat}&lon=${A.DELHI.lon}`, 8000).then((j) => {
    CS.introLoading = false;
    if (!j || !isNum(j.pm25)) return;
    CS.introRead = j;
    const row = CS.el && CS.el.querySelector('#cs-airrow');
    if (row) row.innerHTML = introNumHtml();
  });
}
function closeConsent() {
  const el = CS.el;
  if (!el || el.hidden) return;
  const cs = el.querySelector('.cs');
  if (!cs) { el.hidden = true; return; }
  cs.classList.remove('anim');
  cs.classList.add('closing');
  setTimeout(() => { el.hidden = true; }, 320);
}
function goHome() {
  if (A.current() !== 'home') location.hash = '#/home';
}
async function chooseGps() {
  if (CS.busy) return;
  if (!navigator.geolocation) { CS.note = t('csNoGeo'); refreshSheetBits(); return; }
  CS.busy = true; CS.note = null; refreshSheetBits();
  try {
    const pos = await A.geo.locate();
    CS.busy = false;
    A.geo.consent = 'granted'; A.store.set('consent', 'granted'); A.store.set('onboarded', 1);
    cur.locErr = null; cur.picking = false;
    closeConsent();
    goHome();
    document.dispatchEvent(new CustomEvent('alive:location', { detail: pos }));
  } catch (e) {
    CS.busy = false;
    CS.note = e && e.code === 1 ? t('csDenied') : t('csNoFix');
    refreshSheetBits();
  }
}
function choosePin() {
  A.geo.consent = 'picked'; A.store.set('consent', 'picked'); A.store.set('onboarded', 1);
  cur.picking = true;
  closeConsent();
  goHome();
  setPick();
}
function chooseLater() {
  A.store.set('onboarded', 1);
  const first = !A.geo.consent;
  if (first) { A.geo.consent = 'later'; A.store.set('consent', 'later'); }
  closeConsent();
  if (first) A.toast(t('csLaterToast'));
  paint();
}
function wireConsent(el) {
  if (!el || el.dataset.cs) return;
  el.dataset.cs = '1';
  CS.el = el;
  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-cs]');
    /* own every click inside the layer — app.js's frozen handlers on
       the hidden #consent-yes/#consent-skip never fire */
    e.stopPropagation();
    if (!act) return;
    e.preventDefault();
    const a = act.dataset.cs;
    if (a === 'next') { const cs = el.querySelector('.cs'); if (cs) cs.classList.add('sheet-on'); return; }
    if (a === 'gps') { chooseGps(); return; }
    if (a === 'pin') { choosePin(); return; }
    if (a === 'later') { chooseLater(); return; }
    if (a === 'share') {
      const next = !getSettings().share;
      setSettings({ share: next });
      refreshSheetBits();
      return;
    }
    if (a === 'scrim' && A.geo.consent) closeConsent();
  }, true);
}
function openConsent(opts) {
  const el = document.getElementById('consent');
  if (!el) return;
  wireConsent(el);
  CS.intro = !!(opts && opts.intro);
  CS.busy = false; CS.note = null;
  renderConsent();
  el.hidden = false;
  if (CS.intro) loadIntroRead();
}
/* replace the frozen index.html card at load: whichever screen boots,
   app.js un-hides #consent onto THIS sheet (with the hidden ids it wires) */
(() => {
  const el = document.getElementById('consent');
  if (!el || A.geo.consent) return;
  wireConsent(el);
  CS.intro = !A.store.get('onboarded');
  renderConsent();
  if (CS.intro) loadIntroRead();
})();

/* ══ mount ══ */
A.screen('home', {
  mount(elm) {
    elm.innerHTML = `
      <div class="hs">
        <div class="hs-mood" id="hs-mood"></div>
        <header class="hs-head">
          <button class="hs-menubtn" id="hs-menu" type="button" aria-label="${esc(t('a11yMenu'))}" aria-haspopup="dialog"><span class="hs-menubars"><i></i><i></i></span></button>
          <div class="hs-brandwrap">
            <div class="hs-brand" id="hs-brand"></div>
            <div class="hs-sub" id="hs-sub"></div>
          </div>
        </header>
        <div class="hs-ctabar">
          <button class="hs-cta" id="hs-cta" type="button" aria-label="${esc(t('goLabel'))}">
            ${ic('search', 19)}<span class="hs-ctatxt">${esc(t('searchPlaceholder'))}</span>
            <span class="hs-ctaarrow">${ic('navigate', 16)}</span>
          </button>
        </div>
        <div class="hs-pickcard" id="hs-pickcard">
          <div class="hs-picktxt">${esc(t('pickHint'))}</div>
          <div class="hs-pickbtns">
            <button class="hs-pickgps" type="button" data-act="pickgps">${ic('locate', 18)}<span>${esc(t('pickGps'))}</span></button>
            <button class="hs-pickcancel" type="button" data-act="pickcancel">${esc(t('pickCancel'))}</button>
          </div>
        </div>
        <div class="hs-scroll">
          <section class="hs-fade" style="animation-delay:0ms"><div class="hs-hero" id="hs-hero"></div></section>
          <section class="hs-fade" id="hs-doorswrap" style="animation-delay:90ms"></section>
        </div>
      </div>`;
    root = elm.firstElementChild;
    moodEl = elm.querySelector('#hs-mood');
    heroEl = elm.querySelector('#hs-hero');
    moodIdx = -1; lastCount = null;
    elm.querySelector('#hs-doorswrap').innerHTML = doorsHtml();

    const brandEl = elm.querySelector('#hs-brand'), subEl = elm.querySelector('#hs-sub');
    const tickClock = () => {
      const now = Date.now();
      const { h24, dow } = istParts(now);
      const key = h24 < 5 || h24 >= 21 ? 'homeGreetNight' : h24 < 12 ? 'homeGreetMorning' : h24 < 17 ? 'homeGreetAfternoon' : 'homeGreetEvening';
      const fn = A.profile && A.profile.firstName ? A.profile.firstName() : '';
      brandEl.textContent = fn ? `${t(key)}, ${fn}` : t(key);
      subEl.textContent = `${t('cityName')} · ${WEEKDAY[dow]} · ${clockLabel(now)}`;
    };
    tickClock();
    const clockTimer = setInterval(tickClock, 15000);

    elm.querySelector('#hs-menu').addEventListener('click', (e) => {
      /* the sidebar (sidebar.js); Settings directly if it isn't loaded */
      if (A.sidebar && typeof A.sidebar.open === 'function') A.sidebar.open(e.currentTarget);
      else if (A.screensReady.settings) location.hash = '#/settings';
    });
    elm.querySelector('#hs-cta').addEventListener('click', () => { location.hash = '#/whereto'; });
    elm.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { location.hash = `#/${go.dataset.go}`; return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'consent') openConsent({ intro: false });
      else if (a === 'retry') { cur.err = null; paint(); refresh(); }
      else if (a === 'pickgps') {
        if (!navigator.geolocation) { A.toast(t('csNoGeo')); return; }
        A.geo.locate().then((p) => {
          A.geo.consent = 'granted'; A.store.set('consent', 'granted');
          cur.picking = false; cur.locErr = null;
          applyPos(p);
          A.map.puckMove(p.lat, p.lon, p.acc || null);
        }).catch((err) => A.toast(err && err.code === 1 ? t('blockedNote') : t('csNoFix')));
      } else if (a === 'pickcancel') { cur.picking = false; paint(); }
    });

    /* returning users: a granted consent with no fix re-locks silently */
    if (A.geo.pos) cur.pos = A.geo.pos;
    if (!A.geo.consent) {
      const el = document.getElementById('consent');
      if (!el || el.hidden || !el.dataset.cs) openConsent({ intro: !A.store.get('onboarded') });
    }

    A.map.setFieldVisible(false);
    paint();
    refresh();
    const poll = setInterval(refresh, POLL_MS);
    const tick = setInterval(paint, TICK_MS);

    const onLoc = (e) => {
      const pos = e.detail;
      if (!pos || A.geo.consent !== 'granted') return;
      cur.locErr = null;
      applyPos(pos);
      A.map.ready((m) => A.map.fly(pos.lat, pos.lon, Math.max(11.4, m.getZoom())));
      A.map.puckMove(pos.lat, pos.lon, pos.acc || null);
    };
    const onTap = (e) => {
      if (!cur.picking || A.geo.consent !== 'picked') return;
      const p = { lat: e.detail.lat, lon: e.detail.lon, t: Date.now(), picked: true };
      cur.picking = false;
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
      root = null; heroEl = null; moodEl = null;
    };
  },
});
})();
