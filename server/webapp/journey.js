/* Alive webapp — journey. REAL navigation over the picked /v2/plan
   option, then a simple arrival receipt.
   - Position = the device's own GPS (navigator.geolocation.watchPosition).
     Stop moving → the position stops and the speed reads 0. There is no
     simulated drive in any user flow (QA-only: ?sim=1, never linked).
   - Turn-by-turn = the route's served maneuvers (or turns read off the
     route line when the router served none); distance to the next one
     is measured from the real position projected on the line.
   - Off the line > 60 m for > 10 s → POST /v2/reroute and carry on.
   - Live jams: POST /v2/p/route_traffic with the remaining route on
     start and every 120 s; configured:false / errors show nothing.
   - Intake = time actually spent × the served segment pm25 × the plan's
     own breathing constant (plan dose ÷ plan time ÷ mean pm25), so a
     jam you really sat in counts. Stuck stretches (< 5 km/h for > 60 s)
     are measured from your own GPS.
   Nothing here invents a number: every figure traces to an API field,
   the GPS, or the real clock. */
(() => {
'use strict';

const STORE_LAST = 'journey.last';
const STORE_HIST = 'journey.history';
const HIST_CAP = 20;
const ARRIVE_M = 55;          // puck this close to the destination → arrived
const OFF_M = 60;             // farther than this from the line …
const OFF_HOLD_MS = 10000;    // … for longer than this → ask /v2/reroute
const REROUTE_GAP_MS = 30000; // never hammer the router
const JAM_EVERY_MS = 120000;  // live traffic on the remaining route
const TRAFFIC_PTS = 150;      // route_traffic downsample cap
const STUCK_MIN_S = 60;       // slower than the stuck pace this long = a measured stop
const FIX_STALE_MS = 5000;    // no new GPS fix this long → not moving (speed 0)
const WEAK_ACC_M = 150;       // fixes vaguer than this never move progress
const STEP_PASS_M = 25;       // arclength past a maneuver before the next cue
/* QA-only simulated ride: reachable ONLY with ?sim=1 in the URL — never
   linked, never offered in any user flow; its records are simulated:true
   (home + ledger never count those). */
const SIM_QA = (() => {
  try { return new URLSearchParams(location.search).get('sim') === '1'; } catch (e) { return false; }
})();
/* WHO 24h PM2.5 guideline 15 µg/m³ × ~14.4 m³ breathed/day ≈ 216 µg —
   the same day-breath basis the engine cites in /v2/city breath.basis */
const WHO_DAY_UG = 15 * 14.4;
const IST_MS = 330 * 60 * 1000;   // every clock is an Asia/Kolkata wall time

/* ── icons: same Material Symbols Rounded paths as Mobile/src/icons.tsx
   (960-unit grid, viewBox "0 -960 960 960") ─────────────────────── */
const ICONS = {
"walk": [
"M436-364 371-72q-3 14-14.5 23T330-40q-20 0-32-15t-8-34l102-515-72 28v96q0 17-11.5 28.5T280-440q-17 0-28.5-11.5T240-480v-122q0-12 6.5-21.5T264-638l178-76q14-6 29.5-7t29.5 4q14 5 26.5 14t20.5 23l40 64q13 20 30.5 38t39.5 31q14 8 31 14.5t34 9.5q16 3 26.5 14.5T760-480q0 17-12 28t-29 9q-56-8-100.5-35T541-543l-25 123 72 68q6 6 9 13.5t3 15.5v243q0 17-11.5 28.5T560-40q-17 0-28.5-11.5T520-80v-220l-84-64Zm104-376q-33 0-56.5-23.5T460-820q0-33 23.5-56.5T540-900q33 0 56.5 23.5T620-820q0 33-23.5 56.5T540-740Z"
],
"cycle": [
"M620-740q-33 0-56.5-23.5T540-820q0-33 23.5-56.5T620-900q33 0 56.5 23.5T700-820q0 33-23.5 56.5T620-740ZM432-540l66 69q11 11 16.5 25t5.5 30v176q0 17-11.5 28.5T480-200q-17 0-28.5-11.5T440-240v-160L312-512q-14-12-19-25t-5-31q0-18 5.5-30.5T312-624l112-112q13-13 27.5-18.5T484-760q18 0 32.5 5.5T544-736l76 76q21 21 47 35.5t58 20.5q17 3 28 15t11 29q0 17-12 28t-29 9q-49-7-90-28t-73-53l-32-32-96 96Zm-232 60q85 0 142.5 57.5T400-280q0 85-57.5 142.5T200-80q-85 0-142.5-57.5T0-280q0-85 57.5-142.5T200-480Zm0 340q57 0 98.5-41.5T340-280q0-57-41.5-98.5T200-420q-57 0-98.5 41.5T60-280q0 57 41.5 98.5T200-140Zm560-340q85 0 142.5 57.5T960-280q0 85-57.5 142.5T760-80q-85 0-142.5-57.5T560-280q0-85 57.5-142.5T760-480Zm0 340q57 0 98.5-41.5T900-280q0-57-41.5-98.5T760-420q-57 0-98.5 41.5T620-280q0 57 41.5 98.5T760-140Z"
],
"bike": [
"M280-200q-50 0-85-35t-35-85h-40q-17 0-28.5-11.5T80-360v-80q0-66 47-113t113-47h80q33 0 56.5 23.5T400-520v120h140l140-174v-106h-80q-17 0-28.5-11.5T560-720q0-17 11.5-28.5T600-760h80q33 0 56.5 23.5T760-680v106q0 14-4.5 26.5T743-524L604-350q-11 14-28 22t-35 8H400q0 50-35 85t-85 35Zm40-200Zm-40 120q17 0 28.5-11.5T320-320h-80q0 17 11.5 28.5T280-280Zm80-360H240q-17 0-28.5-11.5T200-680q0-17 11.5-28.5T240-720h120q17 0 28.5 11.5T400-680q0 17-11.5 28.5T360-640Zm400 440q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T800-320q0-17-11.5-28.5T760-360q-17 0-28.5 11.5T720-320q0 17 11.5 28.5T760-280ZM160-400h160v-120h-80q-33 0-56.5 23.5T160-440v40Z"
],
"auto": [
"M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54ZM120-560v120h6q14-35 44.5-57.5T240-520q11 0 21 1.5t19 4.5v-46H120Zm520 120h46q9-26 28.5-45.5T760-514v-6H640v80ZM120-560h160-160Zm520 40h120-120Z"
],
"erick": [
"M240-280q-39 0-69.5-22.5T128-360h-8q-33 0-56.5-23.5T40-440v-320q0-33 23.5-56.5T120-840h482q18 0 34 7t28 21l158 190q9 11 13.5 23.5T840-572v58q35 12 57.5 43.5T920-400q0 50-35 85t-85 35q-39 0-70.5-22.5T686-360H354q-14 35-44.5 57.5T240-280ZM120-640h160v-120H120v120Zm240 200h200v-320H360v120h80q17 0 28.5 11.5T480-600q0 17-11.5 28.5T440-560h-80v120Zm280-160h96l-96-116v116ZM240-360q17 0 28.5-11.5T280-400q0-17-11.5-28.5T240-440q-17 0-28.5 11.5T200-400q0 17 11.5 28.5T240-360Zm560 0q17 0 28.5-11.5T840-400q0-17-11.5-28.5T800-440q-17 0-28.5 11.5T760-400q0 17 11.5 28.5T800-360ZM491-54l-173-87q-7-4-5.5-11.5t9.5-7.5h118v-48q0-11 9.5-17t19.5-1l173 87q7 4 5.5 11.5T638-120H520v48q0 11-9.5 17T491-54ZM120-560v120h6q14-35 44.5-57.5T240-520q11 0 21 1.5t19 4.5v-46H120Zm520 120h46q9-26 28.5-45.5T760-514v-6H640v80ZM120-560h160-160Zm520 40h120-120Z"
],
"car": [
"M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h410q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"
],
"cab": [
"M240-200v20q0 25-17.5 42.5T180-120q-25 0-42.5-17.5T120-180v-286q0-7 1-14t3-13l75-213q8-24 29-39t47-15h85v-40q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800v40h85q26 0 47 15t29 39l75 213q2 6 3 13t1 14v286q0 25-17.5 42.5T780-120q-25 0-42.5-17.5T720-180v-20H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z"
],
"bus": [
"M320-200v20q0 25-17.5 42.5T260-120q-25 0-42.5-17.5T200-180v-62q-18-20-29-44.5T160-340v-380q0-83 77-121.5T480-880q172 0 246 37t74 123v380q0 29-11 53.5T760-242v62q0 25-17.5 42.5T700-120q-25 0-42.5-17.5T640-180v-20H320Zm162-560h224-448 224Zm158 280H240h480-80Zm-400-80h480v-120H240v120Zm100 240q25 0 42.5-17.5T400-380q0-25-17.5-42.5T340-440q-25 0-42.5 17.5T280-380q0 25 17.5 42.5T340-320Zm280 0q25 0 42.5-17.5T680-380q0-25-17.5-42.5T620-440q-25 0-42.5 17.5T560-380q0 25 17.5 42.5T620-320ZM258-760h448q-15-17-64.5-28.5T482-800q-107 0-156.5 12.5T258-760Zm62 480h320q33 0 56.5-23.5T720-360v-120H240v120q0 33 23.5 56.5T320-280Z"
],
"metro": [
"M80-160v-446q0-85 44-147.5T248-848q54-21 115-26.5t117-5.5q56 0 117 5.5T712-848q80 32 124 94.5T880-606v446q0 33-23.5 56.5T800-80H160q-33 0-56.5-23.5T80-160Zm220-280v-160h360v160H300Zm320 140q-17 0-28.5-11.5T580-340q0-17 11.5-28.5T620-380q17 0 28.5 11.5T660-340q0 17-11.5 28.5T620-300Zm-280 0q-17 0-28.5-11.5T300-340q0-17 11.5-28.5T340-380q17 0 28.5 11.5T380-340q0 17-11.5 28.5T340-300ZM160-160h640v-446q0-60-29.5-102.5T682-774q-44-17-97.5-21.5T480-800q-51 0-104.5 4.5T278-774q-59 23-88.5 65.5T160-606v446Zm264-60h110l51 51q5 5 10.5 7t11.5 2q20 0 27.5-19t-6.5-33l-10-10q44-6 73-39.5t29-78.5v-260q0-78-70-99t-170-21q-91 0-165.5 21T240-600v260q0 45 29 78.5t73 39.5l-11 11q-14 14-6.5 32.5T352-160q6 0 11-2t10-7l51-51Zm-264 60v-446q0-60 29.5-102.5T278-774q44-17 97.5-21.5T480-800q51 0 104.5 4.5T682-774q59 23 88.5 65.5T800-606v446H160Z"
],
"locate": [
"M440-82v-40q-125-14-214.5-103.5T122-440H82q-17 0-28.5-11.5T42-480q0-17 11.5-28.5T82-520h40q14-125 103.5-214.5T440-838v-40q0-17 11.5-28.5T480-918q17 0 28.5 11.5T520-878v40q125 14 214.5 103.5T838-520h40q17 0 28.5 11.5T918-480q0 17-11.5 28.5T878-440h-40q-14 125-103.5 214.5T520-122v40q0 17-11.5 28.5T480-42q-17 0-28.5-11.5T440-82Zm40-118q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400Zm0-80Z"
],
"pin": [
"M480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 79q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 45-17.5 94.5t-51 103Q698-301 648-244T533-127q-11 10-25 15t-28 5Zm0-453Zm0 80q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z"
],
"share": [
"M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38 23.5t-44 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 44 8.5t38 23.5l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-44-8.5T638-672L356-508q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38-23.5t44-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-640q17 0 28.5-11.5T760-760q0-17-11.5-28.5T720-800q-17 0-28.5 11.5T680-760q0 17 11.5 28.5T720-720ZM240-440q17 0 28.5-11.5T280-480q0-17-11.5-28.5T240-520q-17 0-28.5 11.5T200-480q0 17 11.5 28.5T240-440Zm480 280q17 0 28.5-11.5T760-200q0-17-11.5-28.5T720-240q-17 0-28.5 11.5T680-200q0 17 11.5 28.5T720-160Zm0-600ZM240-480Zm480 280Z"
],
"close": [
"M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z"
],
"dust": [
"M460-160q-32 0-59.5-16T356-220q-11-20-.5-40t32.5-20q13 0 23 8t18 18q5 7 13.5 10.5T460-240q17 0 28.5-11.5T500-280q0-17-11.5-28.5T460-320H120q-17 0-28.5-11.5T80-360q0-17 11.5-28.5T120-400h340q50 0 85 35t35 85q0 50-35 85t-85 35ZM120-560q-17 0-28.5-11.5T80-600q0-17 11.5-28.5T120-640h500q25 0 42.5-17.5T680-700q0-25-17.5-42.5T620-760q-16 0-30 7.5T568-731q-7 12-17 21.5t-24 9.5q-20 0-32.5-15t-6.5-32q14-42 50.5-67.5T620-840q58 0 99 41t41 99q0 58-41 99t-99 41H120Zm678 308q-20 9-39-2.5T740-288q0-14 9.5-23.5T771-328q14-8 21.5-22t7.5-30q0-25-17.5-42.5T740-440H120q-17 0-28.5-11.5T80-480q0-17 11.5-28.5T120-520h620q58 0 99 41t41 99q0 42-22 76.5T798-252Z"
],
"smoke": [
"M720-200q-17 0-28.5-11.5T680-240q0-17 11.5-28.5T720-280q17 0 28.5 11.5T760-240q0 17-11.5 28.5T720-200ZM280-80q-17 0-28.5-11.5T240-120q0-17 11.5-28.5T280-160q17 0 28.5 11.5T320-120q0 17-11.5 28.5T280-80Zm-40-120q-17 0-28.5-11.5T200-240q0-17 11.5-28.5T240-280h360q17 0 28.5 11.5T640-240q0 17-11.5 28.5T600-200H240ZM400-80q-17 0-28.5-11.5T360-120q0-17 11.5-28.5T400-160h280q17 0 28.5 11.5T720-120q0 17-11.5 28.5T680-80H400ZM300-320q-91 0-155.5-64.5T80-540q0-83 55-145t136-73q32-57 87.5-89.5T480-880q90 0 156.5 57.5T717-679q69 6 116 57t47 122q0 75-52.5 127.5T700-320H300Zm0-80h400q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-40q0-66-47-113t-113-47q-48 0-87.5 26T333-704l-10 24h-25q-57 2-97.5 42.5T160-540q0 58 41 99t99 41Zm180-200Z"
],
"uturn": [
"M280-297q-8 0-15-2.5t-13-8.5L148-412q-11-11-11-28t11-28q11-11 28-11t28 11l36 36v-168q0-100 70-170t170-70q100 0 170 70t70 170v440q0 17-11.5 28.5T680-120q-17 0-28.5-11.5T640-160v-440q0-66-47-113t-113-47q-66 0-113 47t-47 113v168l36-36q11-11 28-11t28 11q11 11 11 28t-11 28L308-308q-6 6-13 8.5t-15 2.5Z"
],
"roundabout": [
"M280-160v-203q-88-14-144-81.5T80-600q0-100 70-170t170-70q88 0 155.5 56T557-640h170l-36-36q-11-11-11-27.5t12-28.5q11-11 28-11t28 11l104 104q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L748-468q-11 11-27.5 11T692-468q-12-12-12-28.5t12-28.5l35-35H556q-29 0-51-19t-27-48q-10-58-54.5-95.5T320-760q-66 0-113 47t-47 113q0 59 37.5 103.5T293-442q29 5 48 27t19 51v204q0 17-11.5 28.5T320-120q-17 0-28.5-11.5T280-160Z"
],
"mergeDir": [
"M480-344 284-148q-11 11-27.5 11.5T228-148q-11-11-11-28t11-28l165-166q23-23 35-52t12-61v-204l-36 36q-11 11-27.5 11T348-652q-11-11-11-28t11-28l104-104q12-12 28-12t28 12l104 104q11 11 11.5 27.5T612-652q-11 11-28 11t-28-11l-36-35v204q0 32 12 61t35 52l165 166q11 11 11.5 27.5T732-148q-11 11-28 11t-28-11L480-344Z"
],
"ramp": [
"M480-120q-17 0-28.5-11.5T440-160v-212q-28 38-63.5 72T296-235q-16 11-34.5 10T229-240q-11-11-7.5-27.5T240-294q63-42 131.5-119.5T440-600v-87l-36 35q-11 11-28 11t-28-11q-12-12-11.5-28.5T348-708l104-104q6-6 13-8.5t15-2.5q8 0 15 2.5t13 8.5l104 104q11 11 11 28t-11 28q-12 12-28.5 12T556-651l-36-36v527q0 17-11.5 28.5T480-120Z"
],
"slightL": [
"M560-160q-17 0-28.5-11.5T520-200v-264L320-664v50q0 17-11.5 28.5T280-574q-17 0-28.5-11.5T240-614v-146q0-17 11.5-28.5T280-800h146q17 0 28.5 11.5T466-760q0 17-11.5 28.5T426-720h-50l201 201q11 11 17 25.5t6 30.5v263q0 17-11.5 28.5T560-160Z"
],
"slightR": [
"M400-160q-17 0-28.5-11.5T360-200v-263q0-16 6-30.5t17-25.5l201-201h-50q-17 0-28.5-11.5T494-760q0-17 11.5-28.5T534-800h146q17 0 28.5 11.5T720-760v146q0 17-11.5 28.5T680-574q-17 0-28.5-11.5T640-614v-50L440-464v264q0 17-11.5 28.5T400-160Z"
],
"arrowUp": [
"M440-647 244-451q-12 12-28 11.5T188-452q-11-12-11.5-28t11.5-28l264-264q6-6 13-8.5t15-2.5q8 0 15 2.5t13 8.5l264 264q11 11 11 27.5T772-452q-12 12-28.5 12T715-452L520-647v447q0 17-11.5 28.5T480-160q-17 0-28.5-11.5T440-200v-447Z"
],
"turnL": [
"m313-320 115 115q12 12 12.5 28T429-149q-12 12-28.5 12T372-149L188-332q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l185-185q12-12 28-11.5t28 12.5q11 12 11.5 28T429-516L313-400h367v-360q0-17 11.5-28.5T720-800q17 0 28.5 11.5T760-760v360q0 33-23.5 56.5T680-320H313Z"
],
"turnR": [
"M532-149q-12-12-12-28t12-28l115-115H280q-33 0-56.5-23.5T200-400v-360q0-17 11.5-28.5T240-800q17 0 28.5 11.5T280-760v360h367L531-516q-12-12-11.5-28t11.5-28q12-12 28-12.5t28 11.5l185 185q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L589-149q-12 12-28.5 12T532-149Z"
],
"navigate": [
"M480-240 222-130q-13 5-24.5 2.5T178-138q-8-8-10.5-20t2.5-25l273-615q5-12 15.5-18t21.5-6q11 0 21.5 6t15.5 18l273 615q5 13 2.5 25T782-138q-8 8-19.5 10.5T738-130L480-240Zm-196-4 196-84 196 84-196-440-196 440Zm196-84Z"
],
"route": [
"M360-120q-66 0-113-47t-47-113v-327q-35-13-57.5-43.5T120-720q0-50 35-85t85-35q50 0 85 35t35 85q0 39-22.5 69.5T280-607v327q0 33 23.5 56.5T360-200q33 0 56.5-23.5T440-280v-400q0-66 47-113t113-47q66 0 113 47t47 113v327q35 13 57.5 43.5T840-240q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-39 22.5-70t57.5-43v-327q0-33-23.5-56.5T600-760q-33 0-56.5 23.5T520-680v400q0 66-47 113t-113 47ZM240-680q17 0 28.5-11.5T280-720q0-17-11.5-28.5T240-760q-17 0-28.5 11.5T200-720q0 17 11.5 28.5T240-680Zm480 480q17 0 28.5-11.5T760-240q0-17-11.5-28.5T720-280q-17 0-28.5 11.5T680-240q0 17 11.5 28.5T720-200ZM240-720Zm480 480Z"
],
"flag": [
"M280-400v240q0 17-11.5 28.5T240-120q-17 0-28.5-11.5T200-160v-600q0-17 11.5-28.5T240-800h287q14 0 25 9t14 23l10 48h184q17 0 28.5 11.5T800-680v320q0 17-11.5 28.5T760-320H553q-14 0-25-9t-14-23l-10-48H280Zm306 0h134v-240H543q-14 0-25-9t-14-23l-10-48H280v240h257q14 0 25 9t14 23l10 48Zm-86-160Z"
],
"clock": [
"M520-496v-144q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640v159q0 8 3 15.5t9 13.5l132 132q11 11 28 11t28-11q11-11 11-28t-11-28L520-496ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"
],
"info": [
"M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"
]
};
const ic = (name, size, color) =>
  `<svg viewBox="0 -960 960 960" width="${size}" height="${size}" ` +
  `fill="${color || 'currentColor'}" aria-hidden="true">` +
  (ICONS[name] || []).map((d) => `<path d="${d}"/>`).join('') + `</svg>`;

function vehicleGlyph(vehicle) {
  const k = (vehicle || '').toLowerCase();
  if (k.includes('walk')) return 'walk';
  if (k.includes('cycle') || k.includes('bicycle')) return 'cycle';
  if (k.includes('e_rickshaw') || k.includes('erick')) return 'erick';
  if (k.includes('auto') || k.includes('rickshaw')) return 'auto';
  if (k.includes('two_wheeler') || k.includes('bike') || k.includes('scooter') || k.includes('moto')) return 'bike';
  if (k.includes('bus')) return 'bus';
  if (k.includes('metro')) return 'metro';
  if (k.includes('cab') || k.includes('taxi')) return 'cab';
  return 'car';
}

/* ── maneuver classification — Mobile NavChrome.maneuverOf, verbatim ── */
const MANEUVER_GLYPH = {
  left: 'turnL', right: 'turnR', slightLeft: 'slightL', slightRight: 'slightR',
  uturn: 'uturn', roundabout: 'roundabout', merge: 'mergeDir', exit: 'ramp',
  straight: 'arrowUp',
};
function maneuverOf(instruction, type, modifier) {
  const ty = (type || '').toLowerCase();
  const mod = (modifier || '').toLowerCase();
  const s = (instruction || '').toLowerCase();
  if (mod.includes('uturn') || ty === 'uturn' || s.includes('u-turn')) return 'uturn';
  if (ty === 'arrive') return 'arrive';
  if (ty === 'roundabout' || ty === 'rotary' || s.includes('roundabout')) return 'roundabout';
  if (ty === 'merge' || s.includes('merge')) return 'merge';
  if (ty === 'metro' || ty === 'bus' || ty === 'tram' || ty === 'train') return 'transit';
  if (ty === 'walk' || ty === 'transfer') return 'walk';
  if (ty === 'fork') {
    return mod.includes('left') ? 'slightLeft' : mod.includes('right') ? 'slightRight' : 'straight';
  }
  if (mod) {
    if (mod.includes('left')) return mod.startsWith('slight') ? 'slightLeft' : 'left';
    if (mod.includes('right')) return mod.startsWith('slight') ? 'slightRight' : 'right';
    if (mod.includes('straight')) return 'straight';
  }
  if (s.includes('arrive') || s.includes('destination')) return 'arrive';
  if (s.includes('ramp') || s.includes('exit')) return 'exit';
  if (s.includes('left')) {
    return s.includes('bear') || s.includes('keep') || s.includes('slight') ? 'slightLeft' : 'left';
  }
  if (s.includes('right')) {
    return s.includes('bear') || s.includes('keep') || s.includes('slight') ? 'slightRight' : 'right';
  }
  if (s.includes('walk')) return 'walk';
  if (s.includes('metro') || s.includes('board') || s.includes('take the') || s.includes('take a')) {
    return 'transit';
  }
  return 'straight';
}

/* ── strings — the en strings from Mobile/src/i18n/strings.ts, verbatim ── */
const approx = (n) => Number(n) === 0 ? '0' : `≈ ${n}`;
const doseUgRound = (ug) => ug >= 10 ? Math.round(ug) : Math.round(ug * 10) / 10;
const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const distToStr = (m) =>
  m >= 950 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`;
const leftIsKm = (m) => m >= 950;
const leftMNum = (m) => Math.max(10, Math.round(m / 10) * 10);
function clockLabel(ms) {
  const ist = new Date(ms + IST_MS);
  const h24 = ist.getUTCHours(), min = ist.getUTCMinutes();
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${`${min}`.padStart(2, '0')} ${h24 < 12 ? 'am' : 'pm'}`;
}
/* modeLabel(en) — strings.ts MODE_BASE + suffix handling, en only */
const MODE_EN = {
  car: 'Car (AC)', car_open: 'Car (windows down)', bike: 'Bike / scooter',
  bus: 'Bus', auto: 'Auto-rickshaw', 'metro+walk': 'Metro + walk',
  cycle: 'Bicycle', walk: 'On foot',
};
const BASES = Object.values(MODE_EN).sort((a, b) => b.length - a.length);
function modeLabel(mode, label) {
  label = label || '';
  const byMode = MODE_EN[mode];
  const b = (byMode && label.startsWith(byMode)) ? byMode
    : BASES.find((x) => label === x || label.startsWith(x + ' ') || label.startsWith(x + '('));
  if (!b) return label;
  const rest = label.slice(b.length);
  let suffix = rest;
  if (rest.startsWith(' (approx')) suffix = ' (roughly)';
  else {
    const alt = rest.match(/^ · (?:least-smoke alt|least smoky option) (\d+)$/);
    if (alt) suffix = ` · least smoky option ${alt[1]}`;
    else if (rest === ' · least-smoke rd' || rest === ' · least smoky way') suffix = ' · least smoky way';
    else {
      const a = rest.match(/^ · alt (\d+)$/);
      if (a) suffix = ` · alt ${a[1]}`;
    }
  }
  return b + suffix;
}
/* smokeFraction — strings.ts table, en words */
const SMOKE_FRACS = [[2, 'a half'], [3, 'a third'], [4, 'a quarter'],
  [5, 'a fifth'], [6, 'a sixth'], [8, 'an eighth'], [10, 'a tenth']];
function smokeFraction(ratio) {
  if (!(ratio > 1)) return null;
  let best = null, bestD = Infinity;
  for (const row of SMOKE_FRACS) {
    const d = Math.abs(1 / ratio - 1 / row[0]);
    if (d < bestD) { best = row; bestD = d; }
  }
  return (!best || bestD > 0.13 * (1 / best[0])) ? null : best[1];
}

/* ── tiny geo kit ─────────────────────────────────────────────────── */
const K = Math.PI / 180;
function havM(aLat, aLon, bLat, bLon) {
  const dLa = (bLat - aLat) * K, dLo = (bLon - aLon) * K;
  const s = Math.sin(dLa / 2) ** 2 +
    Math.cos(aLat * K) * Math.cos(bLat * K) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(s));
}
function bearingDeg(aLat, aLon, bLat, bLon) {
  const y = Math.sin((bLon - aLon) * K) * Math.cos(bLat * K);
  const x = Math.cos(aLat * K) * Math.sin(bLat * K) -
    Math.sin(aLat * K) * Math.cos(bLat * K) * Math.cos((bLon - aLon) * K);
  return (Math.atan2(y, x) / K + 360) % 360;
}
const lerpAng = (a, b, t) => {
  let d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fmtDur(s) {
  if (s == null || !isFinite(s)) return '—';
  if (s < 60) return '<1 min';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

/* ── route geometry: arclength table + nearest-point projection ───── */
function buildRoute(geom) {
  const pts = geom.coordinates;                       // [lon,lat][]
  const n = pts.length;
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++)
    cum[i] = cum[i - 1] + havM(pts[i - 1][1], pts[i - 1][0], pts[i][1], pts[i][0]);
  const L = cum[n - 1] || 1;
  const lat0 = pts.reduce((a, p) => a + p[1], 0) / n;
  const kx = 111320 * Math.cos(lat0 * K), ky = 110540;
  const xy = pts.map((p) => [p[0] * kx, p[1] * ky]);

  function idxAt(s) {
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; (cum[m] <= s ? lo = m : hi = m); }
    return lo;
  }
  /* windowed first (no snapping onto a later lap of a looping line),
     whole line when the window has nothing within OFF_M */
  function projectNear(lat, lon, s) {
    const i0 = Math.min(idxAt(Math.max(0, s - 100)), n - 2);
    const i1 = Math.max(i0 + 1, Math.min(n - 1, idxAt(s + 1000) + 1));
    const a = projectRange(lat, lon, i0, i1);
    return a.off <= OFF_M ? a : project(lat, lon);
  }
  function project(lat, lon) { return projectRange(lat, lon, 0, n - 1); }
  function projectRange(lat, lon, i0, i1) {
    const px = lon * kx, py = lat * ky;
    let best = Infinity, bi = i0, bt = 0;
    for (let i = i0; i < i1; i++) {
      const ax = xy[i][0], ay = xy[i][1];
      const dx = xy[i + 1][0] - ax, dy = xy[i + 1][1] - ay;
      const len2 = dx * dx + dy * dy || 1e-9;
      const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d2 = ex * ex + ey * ey;
      if (d2 < best) { best = d2; bi = i; bt = t; }
    }
    const gx = xy[bi][0] + bt * (xy[bi + 1][0] - xy[bi][0]);
    const gy = xy[bi][1] + bt * (xy[bi + 1][1] - xy[bi][1]);
    return {
      s: cum[bi] + bt * (cum[bi + 1] - cum[bi]),
      off: Math.sqrt(best),
      lat: gy / ky, lon: gx / kx,
    };
  }

  function pointAt(s) {
    s = clamp(s, 0, L);
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; (cum[m] <= s ? lo = m : hi = m); }
    const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1e-9);
    return {
      lat: pts[lo][1] + t * (pts[hi][1] - pts[lo][1]),
      lon: pts[lo][0] + t * (pts[hi][0] - pts[lo][0]),
    };
  }

  function bearingAt(s, ahead = 70) {
    const a = pointAt(s), b = pointAt(s + ahead);
    return bearingDeg(a.lat, a.lon, b.lat, b.lon);
  }

  return { pts, cum, L, n, project, projectNear, idxAt, pointAt, bearingAt };
}

/* turns read off the line itself — only when the router served no
   maneuvers (engine "least-smoke" rows carry depart + arrive only).
   Heading change over ±25 m windows ≥ 35°, merged within 40 m. */
function lineTurns(route) {
  const out = [];
  const W = 25;
  for (let i = 1; i < route.n - 1; i++) {
    const s = route.cum[i];
    if (s < 30 || s > route.L - 30) continue;
    const a = route.pointAt(s - W), b = route.pointAt(s), c = route.pointAt(s + W);
    const d = ((bearingDeg(b.lat, b.lon, c.lat, c.lon) - bearingDeg(a.lat, a.lon, b.lat, b.lon) + 540) % 360) - 180;
    if (Math.abs(d) < 35) continue;
    const last = out[out.length - 1];
    if (last && s - last.s < 40) { if (Math.abs(d) > Math.abs(last.d)) { last.s = s; last.d = d; } continue; }
    out.push({ s, d });
  }
  return out.map((t) => {
    const ad = Math.abs(t.d), side = t.d > 0 ? 'right' : 'left';
    if (ad >= 150) return { s: t.s, instruction: 'Make a U-turn', type: 'turn', modifier: 'uturn' };
    if (ad < 60) return { s: t.s, instruction: `Bear ${side}`, type: 'turn', modifier: `slight ${side}` };
    return { s: t.s, instruction: `Turn ${side}`, type: 'turn', modifier: side };
  });
}

/* ── dose: the served {lo,mid,hi} band spread by the segment strip ──
   segments tile 0→1 in route fraction with served pm25; W(s)=∫pm25 ds
   so dose accrues faster through the heavier stretches. Falls back to
   uniform when no strip was served. Always a plan estimate. */
function buildDose(option, L) {
  const band = option.dose || null;
  const total = band && band.mid != null ? band.mid
    : (option.engine_dose_ug != null ? option.engine_dose_ug : null);
  const bandFrac = (mid) => band ? {
    lo: band.lo != null ? band.lo * mid / (band.mid || 1) : null,
    mid,
    hi: band.hi != null ? band.hi * mid / (band.mid || 1) : null,
  } : { lo: null, mid, hi: null };
  const segs = (option.segments || [])
    .map((g) => ({ s0: g.start_frac * L, s1: g.end_frac * L, pm: g.pm25, dist: g.dist_m }))
    .filter((g) => g.pm != null && g.s1 > g.s0)
    .sort((a, b) => a.s0 - b.s0);
  /* distance-weighted mean ambient pm25 of the served strip */
  const segLen = segs.reduce((a, g) => a + (g.s1 - g.s0), 0);
  const meanPm = segLen > 0 ? segs.reduce((a, g) => a + g.pm * (g.s1 - g.s0), 0) / segLen : null;
  function pmAt(s) {
    for (const g of segs) if (s >= g.s0 && s < g.s1) return g.pm;
    return segs.length ? segs[segs.length - 1].pm : null;
  }
  if (total == null) return { total: null, meanPm, bandAt: () => ({ lo: null, mid: null, hi: null }), at: () => null, pmAt, heaviest: () => null };
  if (!segs.length) {
    return {
      total, meanPm,
      at: (s) => total * clamp(s / L, 0, 1),
      bandAt: (s) => bandFrac(total * clamp(s / L, 0, 1)),
      pmAt: () => null,
      heaviest: () => null,
    };
  }
  // prefix integral of pm25 over arclength
  const bp = [{ s: 0, w: 0 }];
  let w = 0;
  for (const g of segs) {
    w += g.pm * (g.s1 - Math.max(g.s0, bp[bp.length - 1].s));
    bp.push({ s: g.s1, w });
  }
  const W = bp[bp.length - 1].w || 1;
  function watt(s) {
    if (s <= 0) return 0;
    if (s >= L) return W;
    let acc = 0;
    for (const g of segs) {
      if (g.s0 >= s) break;
      acc += g.pm * (Math.min(s, g.s1) - g.s0);
    }
    return acc;
  }
  function heaviest() {
    let best = null;
    for (const g of segs) if (!best || g.pm > best.pm) best = g;
    return best ? { pm25: best.pm, sMid: (best.s0 + best.s1) / 2,
      frac: ((best.s0 + best.s1) / 2) / L, dist: best.dist } : null;
  }
  return {
    total, meanPm,
    at: (s) => total * (watt(s) / W),
    bandAt: (s) => bandFrac(total * (watt(s) / W)),
    pmAt, heaviest,
  };
}

/* ── road names: only where a served step names the street at a real
   position (no spreading via_names evenly — that would be a guess) ── */
function buildRoads(option, route) {
  const named = (option.steps || [])
    .filter((st) => st.street && st.lat != null)
    .map((st) => ({ s: route.project(st.lat, st.lon).s, street: st.street }))
    .sort((a, b) => a.s - b.s);
  return function roadAt(s) {
    let r = null;
    for (const st of named) { if (st.s <= s + 8) r = st.street; else break; }
    return r;
  };
}

/* ── next-maneuver: served steps projected onto arclength; when the
   router served no real maneuvers, the line's own turns + arrive ──── */
function buildSteps(option, route) {
  let steps = (option.steps || [])
    .filter((st) => st.lat != null && st.instruction)
    .map((st) => ({
      s: route.project(st.lat, st.lon).s,
      instruction: st.instruction,
      street: st.street || null,
      type: st.type || null,
      modifier: st.modifier || null,
      wait_s: st.wait_s || null,
    }));
  const real = steps.filter((st) => st.type !== 'depart' && st.type !== 'arrive');
  if (!real.length && route.n > 2) steps = steps.concat(lineTurns(route));
  steps.sort((a, b) => a.s - b.s);
  /* the cue a rider needs = the first maneuver not yet passed (held
     until ~15 m past it, so "turn now" reads at the corner); depart
     only before the first metres */
  return function nextStep(s) {
    for (const st of steps) {
      if (st.type === 'depart') { if (s <= 5) return cue(st, s); continue; }
      if (st.s > s - 15) return cue(st, s);
    }
    return null;
  };
  function cue(st, s) {
    return { instruction: st.instruction, street: st.street, distM: Math.max(0, st.s - s),
      type: st.type, modifier: st.modifier, s: st.s, wait_s: st.wait_s };
  }
}

/* ══════════════════ the screen ══════════════════ */
const BIN_M = 20;                  // intake bins along the trip odometer (m)
const SLOW_MPS = 5 / 3.6;          // under 5 km/h = not moving
const TICK_MS = 1000;
/* desktop (journey.css ≥720px): the banner floats top-left (~430 px)
   and the ETA card bottom-right (~418 px) — fits and the follow puck
   keep clear of both */
const WIDE_PX = 720;
const RIGHT_PAD = 460;
const DONE_MIN_M = 25;             // paint the covered stretch only past this
const DONE_STEP_M = 30;            // … and re-paint it only per this much progress
const NO_TRAFFIC = new Set(['walk', 'cycle', 'metro']);   // no car queue to sit in
const TT_MODE = { bike: 'motorcycle', bus: 'bus', cab: 'taxi' };
/* the verdict scale — share of a full day breathed at the WHO 24 h
   PM2.5 guideline (WHO_DAY_UG); five plain steps, band palette */
const VERDICT = [
  { max: 0.05, word: 'Very light' },
  { max: 0.15, word: 'Light' },
  { max: 0.35, word: 'Moderate' },
  { max: 0.70, word: 'Heavy' },
  { max: Infinity, word: 'Very heavy' },
];
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const doseOf = (o) => !o ? null
  : (o.dose && o.dose.mid != null ? o.dose.mid
    : (o.engine_dose_ug != null ? o.engine_dose_ug : null));
const validGeom = (g) => !!g && g.type === 'LineString' &&
  Array.isArray(g.coordinates) && g.coordinates.length >= 2;
/* the map painter matches NUMERIC bands; the served band is a word
   ('Satisfactory') — hand it the index of the served pm25 instead */
const paintSegs = (segs) => (Array.isArray(segs) ? segs : [])
  .map((g) => Object.assign({}, g, { band: A.fmt.bandIdx(g.pm25) }));
const thin = (arr, cap) => {
  if (arr.length <= cap) return arr;
  const k = Math.ceil(arr.length / cap);
  return arr.filter((_, i) => i % k === 0 || i === arr.length - 1);
};

/* one followable line: geometry tables, dose model, cues, street names */
function buildPlan(o) {
  const geom = o.geometry || o.route_geojson;
  const route = buildRoute(geom);
  const dose = buildDose(o, route.L);
  const etaPlan = o.eta_s > 0 ? o.eta_s : null;
  const d = o.dose || {};
  return {
    o, geom, route, dose,
    /* the plan's own breathing constant: µg per second per µg/m³ of
       the served ambient strip — plan dose ÷ plan time ÷ mean pm25 */
    k: dose.total != null && etaPlan && dose.meanPm > 0 ? dose.total / (etaPlan * dose.meanPm) : null,
    etaBase: o.live_eta_s > 0 ? o.live_eta_s : etaPlan,
    loR: d.mid > 0 && d.lo != null ? d.lo / d.mid : null,
    hiR: d.mid > 0 && d.hi != null ? d.hi / d.mid : null,
    roadAt: buildRoads(o, route),
    nextStep: buildSteps(o, route),
  };
}

/* the line still ahead of s0 as [[lat,lon],…], ≤ cap points */
function remainingCoords(route, s0, cap) {
  const p0 = route.pointAt(s0);
  const out = [[r6(p0.lat), r6(p0.lon)]];
  const rest = [];
  for (let i = route.idxAt(s0) + 1; i < route.n; i++) rest.push([r6(route.pts[i][1]), r6(route.pts[i][0])]);
  if (rest.length <= cap - 1) return out.concat(rest);
  const step = (rest.length - 1) / (cap - 2);
  for (let j = 0; j < cap - 1; j++) out.push(rest[Math.round(j * step)]);
  return out;
}

/* the piece of the line already ridden — a LineString from the start
   through the projected position, always ≥ 2 points */
function coveredGeom(route, s0) {
  const pts = route.pts.slice(0, route.idxAt(s0) + 1);
  const p = route.pointAt(s0);
  pts.push([p.lon, p.lat]);
  return { type: 'LineString', coordinates: pts };
}

A.screen('journey', {
  mount(el, params) {
    /* defend the handoff — anything missing goes back to whereto */
    const opt = params && params.option;
    const from = params && params.from, to = params && params.to;
    if (!opt || !validGeom(opt.geometry || opt.route_geojson) ||
        !from || !to || from.lat == null || from.lon == null ||
        to.lat == null || to.lon == null) {
      A.toast('no route to follow — pick a ride first');
      setTimeout(() => { A.back(); if (!A.current()) A.show('home'); }, 60);
      return () => {};
    }
    /* a consent sheet left open under the nav UI is unusable — hide it;
       consent_v stays unset so home re-asks on the next visit */
    const csEl = document.getElementById('consent');
    if (csEl) csEl.hidden = true;
    const options = Array.isArray(params.options) && params.options.length ? params.options : [opt];
    /* journeys whose origin is the rider's own live fix can sanity-check
       the first fix against it (a pinned 'from' may be anywhere) */
    const fromLive = !!from.live;
    const glyph = vehicleGlyph(params.vehicle || opt.mode || '');
    const vehKey = String(params.vehicle || glyph);
    const tripMode = ['health_max', 'petrol_health', 'time_health'].includes(params.mode) ? params.mode : null;
    /* running mode: the same engine, on foot — the route draws green,
       the HUD reads pace not ETA, the screen stays awake, and the air
       re-reads itself every five minutes */
    const isRun = !!(params && params.activity === 'run');
    const FOLLOW_Z = isRun ? 17.4 : 16;
    const toName = to.label || 'your destination';
    const plan0 = buildPlan(opt);
    /* a runner ventilates ~3× a walker (exposure.py VENTILATION_LPM —
       walk 14 → run 45 L/min): the plan priced a walker's minute, so
       the run's own intake constant scales by the same ratio */
    if (isRun && plan0.k != null) plan0.k *= 45 / 14;

    const S = {
      P: plan0,
      s: 0, odo: 0, sTick: 0,
      t0: Date.now(), t1: 0, lastTick: Date.now(),
      watchId: null, geoErr: null,
      gotFix: false, fix: null, pos: null, lastFixT: 0, lastGoodT: 0,
      speed: null, vShown: null, weak: false,
      intake: 0, pmT: 0, tT: 0, doseKnown: plan0.k != null || plan0.dose.total != null,
      bins: [], track: [],
      offSince: 0, rerouting: false, lastReroute: 0, rerouteFail: false, reroutes: 0,
      slowSince: 0, stuckOpen: null, stuck: [],
      traffic: null, jams: [], jamT: 0, jamBusy: false, jamPins: 0, trafficDown: false,
      airNow: null,                     // a live re-read mid-run beats the plan strip
      follow: true, bearing: null, cueKey: null, camInit: false,
      done: false, dead: false, simulated: false,
      timer: 0, simTimer: 0, geoPulse: 0,
    };
    let doneS = -1;                 // arclength the covered line last drew at

    /* ── view: maneuver banner · jam + status line · ETA card ─────── */
    el.innerHTML = `
      <div class="jn">
        <div class="jn-top">
        <div class="jn-banner">
          <div class="jn-tile"><span class="jn-mico"></span></div>
          <div class="jn-btxt">
            <div class="jn-dist"></div>
            <div class="jn-instr"></div>
            <div class="jn-street"></div>
          </div>
          <button class="jn-act jn-close" type="button" aria-label="end trip">${ic('close', 22, 'var(--ink2)')}</button>
        </div>
        <div class="jn-flags">
          <div class="jn-jam" hidden>${ic('clock', 15, 'currentColor')}<span class="jn-jtxt"></span></div>
          <div class="jn-pill" hidden><i class="jn-pdot"></i><span class="jn-ptxt"></span></div>
          <div class="jn-geohelp" hidden>
            <b class="jn-gh-t">Location is off</b>
            <span class="jn-gh-s"></span>
            <button class="jn-gh-b" type="button">Try again</button>
          </div>
        </div>
        </div>
        <div class="jn-bottom">
          <button class="jn-recenter" type="button" hidden>${ic('navigate', 18, 'var(--accent-ink)')}<span>Re-centre</span></button>
          <div class="jn-cluster">
            <div class="jn-prog"><i></i></div>
            <div class="jn-main">
              <div class="jn-eta">
                <div class="jn-etav">—</div>
                <div class="jn-etas"></div>
              </div>
              <div class="jn-spd"><b class="jn-spdv">—</b><span>km/h</span></div>
            </div>
            <div class="jn-air">
              <i class="jn-adot"></i><span class="jn-aword"></span>
              <span class="jn-alab">breathed</span><b class="jn-dosev">—</b>
            </div>
            <div class="jn-confirm" hidden>
              <span>End the trip here?</span>
              <button class="jn-no" type="button">Keep going</button>
              <button class="jn-yes" type="button">End</button>
            </div>
          </div>
        </div>
      </div>`;
    const $ = (q) => el.querySelector(q);
    const ui = {
      tile: $('.jn-tile'), mico: $('.jn-mico'), dist: $('.jn-dist'),
      instr: $('.jn-instr'), street: $('.jn-street'), close: $('.jn-close'),
      jam: $('.jn-jam'), jtxt: $('.jn-jtxt'),
      pill: $('.jn-pill'), pdot: $('.jn-pdot'), ptxt: $('.jn-ptxt'),
      geohelp: $('.jn-geohelp'), ghs: $('.jn-gh-s'), ghb: $('.jn-gh-b'),
      recenter: $('.jn-recenter'), progFill: $('.jn-prog i'),
      main: $('.jn-main'), etaV: $('.jn-etav'), etaS: $('.jn-etas'), spdV: $('.jn-spdv'),
      air: $('.jn-air'), adot: $('.jn-adot'), aword: $('.jn-aword'), doseV: $('.jn-dosev'),
      confirm: $('.jn-confirm'),
    };

    /* ── map: the line coloured by its air, both ends ─────────────── */
    A.map.hideAllRoutes();
    A.map.setFieldVisible(false);
    /* one unmissable run-green stretch across the whole line — both
       engines honour a segment's own color (map.js color passthrough) */
    const RUN_SEGS = [{ start_frac: 0, end_frac: 1, color: '#2F8F5B' }];
    function drawRoute() {
      A.map.hideRoute('journey');
      /* a run draws one honest green line — the dose reads live in the
         HUD instead of colouring the path */
      A.map.showRoute('journey', S.P.geom, isRun ? RUN_SEGS : paintSegs(S.P.o.segments));
      const e = S.P.route.pts[S.P.route.n - 1];
      A.map.pin('jto', e[0], e[1],
        `<div class="pin-chip">${esc(toName.length > 18 ? toName.slice(0, 17) + '…' : toName)}</div>`);
    }
    drawRoute();
    A.map.pin('jfrom', plan0.route.pts[0][0], plan0.route.pts[0][1], '<div class="pin-dot"></div>');
    /* self-heal: a style swap or a stray hideAll mid-run can drop the
       line and nothing would re-add it — re-assert on every styledata
       and inside the per-fix paint below */
    A.map.ready((m) => {
      if (!m.on) return;
      m.on('styledata', () => {
        if (S.dead || S.done) return;
        if (A.map.hasRoute && !A.map.hasRoute('journey')) { drawRoute(); doneS = -1; }
      });
    });
    /* frame the whole line once — on wide screens the cards own the
       top-left strip and the bottom-right corner, so the fit pads them
       (Leaflet takes the same insets as two corner points) */
    function frameAll() {
      if (window.innerWidth < WIDE_PX) { A.map.fit(S.P.geom, 84); return; }
      const pad = { top: 120, right: RIGHT_PAD, bottom: 210, left: 70 };
      if (A.map.basemap === 'leaflet') {
        A.map.ready((m) => {
          if (!window.L) return;
          const b = window.L.latLngBounds(S.P.geom.coordinates.map((c) => [c[1], c[0]]));
          m.flyToBounds(b, { paddingTopLeft: [pad.left, pad.top],
            paddingBottomRight: [pad.right, pad.bottom] });
        });
        return;
      }
      A.map.fit(S.P.geom, pad);
    }
    frameAll();

    function paintJams(clear) {
      for (let i = 0; i < S.jamPins; i++) A.map.unpin(`jjam${i}`);
      S.jamPins = 0;
      if (clear) return;
      S.jams.filter((j) => j.sB > S.s).slice(0, 4).forEach((j, i) => {
        A.map.pin(`jjam${i}`, j.lon, j.lat, '<div class="jn-jampin"></div>');
        S.jamPins = i + 1;
      });
    }

    /* the stretch already ridden draws over the air bands in a muted
       finish — what is behind shouldn't compete with what is ahead.
       The second showRoute works on both engines; the grey restyle is
       GL-only (basic mode's plain casing+line still flattens the bands
       it covers). Always re-added after 'journey' so it stays on top. */
    function paintDone() {
      /* the main line went missing (style reload, a hideAll from under
         us) — put it back, then re-lay the ridden stretch on top */
      if (A.map.hasRoute && !A.map.hasRoute('journey')) { drawRoute(); doneS = -1; }
      if (S.s < DONE_MIN_M) {
        if (doneS >= 0) { A.map.hideRoute('journey-done'); doneS = -1; }
        return;
      }
      if (doneS >= 0 && S.s - doneS < DONE_STEP_M) return;
      doneS = S.s;
      A.map.showRoute('journey-done', coveredGeom(S.P.route, S.s), null);
      if (A.map.basemap === 'leaflet') return;
      A.map.ready((m) => {
        try {
          if (m.getLayer('route-journey-done-line')) {
            m.setPaintProperty('route-journey-done-line', 'line-color', '#98A0AA');
            m.setPaintProperty('route-journey-done-line', 'line-opacity', 0.6);
          }
          if (m.getLayer('route-journey-done-casing')) {
            m.setPaintProperty('route-journey-done-casing', 'line-opacity', 0.3);
          }
        } catch (e) { /* paint is cosmetic — never break a fix over it */ }
      });
    }

    /* ── camera: follows the puck, heading = the line ahead ───────── */
    function camera(lat, lon, instant) {
      const wide = window.innerWidth >= WIDE_PX;
      A.map.ready((m) => {
        if (A.map.basemap === 'leaflet') {
          /* the basic engine has no bearing/offset (and easeTo doesn't
             exist on it — calling it killed every fix): fly in on the
             first fix, then pan just enough to keep the puck inside the
             box the banner + ETA card leave clear */
          try {
            if (!S.camInit) {
              S.camInit = true;
              m.flyTo([lat, lon], Math.max(FOLLOW_Z, m.getZoom()), { duration: 0.9 });
              return;
            }
            m.panInside([lat, lon], {
              paddingTopLeft: window.L.point(wide ? 70 : 30, 130),
              paddingBottomRight: window.L.point(wide ? RIGHT_PAD + 10 : 30,
                wide ? 210 : 180),
              animate: true, duration: instant ? 0.3 : 0.6,
            });
          } catch (e) { /* a camera hiccup must never lose a fix */ }
          return;
        }
        const brg = S.P.route.bearingAt(S.s);
        const b = S.bearing == null ? brg : lerpAng(S.bearing, brg, 0.35);
        S.bearing = b;
        S.camInit = true;
        /* offset — a per-call pixel shift of the rendered centre: on
           desktop it parks the puck at the middle of the area left of
           the bottom-right card, low like a nav HUD. (Not `padding` —
           easeTo padding mutates transform.padding permanently.) */
        m.easeTo({ center: [lon, lat], zoom: Math.max(FOLLOW_Z, m.getZoom()), bearing: b,
          /* a run tilts into the street — buildings extrude, the line
             reads like a nav HUD; a ride stays flat */
          pitch: isRun ? 50 : 0,
          offset: [wide ? -RIGHT_PAD / 2 : 0, 70], duration: instant ? 300 : 800 });
      });
    }
    const onDrag = () => {               // the user panned → stop following
      if (S.dead || S.done) return;
      if (S.follow) { S.follow = false; ui.recenter.hidden = false; }
    };
    A.map.ready((m) => { m.on('dragstart', onDrag); });
    ui.recenter.addEventListener('click', () => {
      S.follow = true; ui.recenter.hidden = true;
      const p = S.pos || S.P.route.pointAt(S.s);
      camera(p.lat, p.lon, true);
    });

    /* ── the device's own GPS — errors are surfaced, never swallowed ─ */
    /* a one-shot probe alongside the watch: primes nav from a last-known
       fix on devices with one, and re-pokes acquisition while we wait —
       a watch that timed out once would otherwise sit dead forever */
    function probe(opts, done) {
      if (!navigator.geolocation) { if (done) done(); return; }
      try {
        navigator.geolocation.getCurrentPosition((p) => {
          if (S.done || S.dead) { if (done) done(); return; }
          const c = p.coords;
          const f = { lat: c.latitude, lon: c.longitude, acc: c.accuracy,
            speed: c.speed, heading: c.heading, t: Date.now() };
          A.geo.pos = { lat: f.lat, lon: f.lon, t: f.t, acc: f.acc };
          onFix(f);
          if (done) done();
        }, (err) => {
          if (S.done || S.dead) { if (done) done(); return; }
          if (err && err.code === 1) S.geoErr = 'denied';
          else if (!S.gotFix) S.geoErr = 'unavailable';
          render();
          if (done) done();
        }, opts);
      } catch (e) { if (done) done(); }
    }
    /* the screen must stay on through a run — the watch can't navigate
       a locked phone, and every run app says this the same honest way */
    let wakeLock = null, onVisLock = null;
    async function lockScreen() {
      if (!isRun || !navigator.wakeLock || wakeLock) return;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch (_) { wakeLock = null; }
    }
    lockScreen();
    if (isRun) {
      onVisLock = () => { if (!document.hidden) lockScreen(); };
      document.addEventListener('visibilitychange', onVisLock);
      /* the air along the run re-reads every five minutes — the strip
         was priced at plan time, the world isn't */
      S.airNow = null;
      S._airBeat = A.beat ? A.beat('journey.air', () => {
        const p = S.pos || A.geo.pos;
        if (!p || S.done || S.dead) return;
        A.aqiSpot(p.lat, p.lon, 8000).then((j) => {
          if (j && isNum(j.pm25)) S.airNow = j.pm25;
        }).catch(() => {});
      }, 300000) : null;
    }
    /* nudge acquisition while the watch is silent — the next fix that
       lands (onFix) clears it, as does a permission denial */
    function pulse() {
      if (S.geoPulse) return;
      S.geoPulse = setInterval(() => {
        if (S.done || S.dead || S.geoErr === 'denied' || S.geoErr === 'unsupported') return;
        probe({ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
      }, 9000);
    }
    function startGeo() {
      if (!navigator.geolocation) { S.geoErr = 'unsupported'; render(); return; }
      try {
        S.watchId = navigator.geolocation.watchPosition((p) => {
          const c = p.coords;
          const f = { lat: c.latitude, lon: c.longitude, acc: c.accuracy,
            speed: c.speed, heading: c.heading, t: Date.now() };
          A.geo.pos = { lat: f.lat, lon: f.lon, t: f.t, acc: f.acc };
          onFix(f);
        }, (err) => {
          if (S.done || S.dead) return;
          S.geoErr = err && err.code === 1 ? 'denied' : 'unavailable';
          pulse();            // a watch that dropped mid-trip re-acquires
          render();
        }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
      } catch (e) { S.geoErr = 'unavailable'; render(); }
      /* grab whatever the device already knows (a cached fix goes through
         the same plausibility drops), then keep nudging until one lands —
         never while permission itself is the problem */
      probe({ enableHighAccuracy: false, maximumAge: 30000, timeout: 12000 });
      pulse();
    }
    /* denied is fixable by the user, not by us — say exactly how, and let
       them re-check once it's on */
    ui.ghs.textContent = /iP(hone|ad|od)/.test(navigator.userAgent)
      ? 'Settings → Privacy & Security → Location Services on → Safari Websites → While Using. Then Try again.'
      : /android/i.test(navigator.userAgent)
        ? 'Tap the lock icon by the address bar → Permissions → Location → Allow. Then Try again.'
        : 'Tap the lock icon by the address bar → Site settings → Location → Allow. Then Try again.';
    ui.ghb.addEventListener('click', () => {
      ui.ghb.disabled = true; ui.ghb.textContent = 'Checking…';
      probe({ enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }, () => {
        ui.ghb.disabled = false; ui.ghb.textContent = 'Try again';
      });
    });
    /* QA only (?sim=1, never linked): fixes fed along the line at 4×
       plan pace through the same path; the record is simulated:true */
    function startSim() {
      S.simulated = true;
      const v = (S.P.etaBase ? S.P.route.L / S.P.etaBase : 8) * 4;
      S.simTimer = setInterval(() => {
        if (S.done) return;
        const p = S.P.route.pointAt(Math.min(S.P.route.L, S.s + v));
        onFix({ lat: p.lat, lon: p.lon, acc: 6, speed: v, heading: null, t: Date.now() });
      }, 1000);
    }

    /* ── one GPS fix ──────────────────────────────────────────────── */
    function onFix(f) {
      if (S.done || S.dead) return;
      const now = Date.now();
      const prev = S.fix, prevT = S.lastFixT;
      /* plausibility: a stale cached fix can teleport the puck a whole
         city away. Drop a first fix far from a live origin and any fix
         implying > ~200 km/h — unless it keeps repeating, in which case
         the rider really did move. */
      if (!prev && fromLive &&
          havM(f.lat, f.lon, from.lat, from.lon) > 1500) {
        if ((S.teleHits = (S.teleHits || 0) + 1) < 4) return;
      } else if (prev && now - prevT < 12000 &&
                 havM(prev.lat, prev.lon, f.lat, f.lon) /
                   Math.max(1, (now - prevT) / 1000) > 60) {
        if ((S.teleHits = (S.teleHits || 0) + 1) < 4) return;
      } else S.teleHits = 0;
      S.geoErr = null;
      if (S.geoPulse) { clearInterval(S.geoPulse); S.geoPulse = 0; }
      /* measured speed: the device's own reading when it gives one, else
         the displacement between two fixes (inside the noise = 0) */
      let v = typeof f.speed === 'number' && isFinite(f.speed) && f.speed >= 0 ? f.speed : null;
      if (v == null && S.fix) {
        const dt = (now - S.lastFixT) / 1000;
        const d = havM(S.fix.lat, S.fix.lon, f.lat, f.lon);
        v = dt >= 0.8 ? (d < 0.5 * Math.max(f.acc || 0, S.fix.acc || 0, 6) ? 0 : d / dt) : S.speed;
      }
      S.speed = v == null ? 0 : v;
      S.vShown = S.speed;
      S.fix = f; S.lastFixT = now;
      if (!S.gotFix) { S.gotFix = true; S.t1 = now; S.lastTick = now; }
      S.weak = f.acc != null && f.acc > WEAK_ACC_M;
      if (S.weak) {                         // too vague to move progress
        A.map.puckMove(f.lat, f.lon, f.acc);
        render();
        return;
      }
      const P = S.P;
      const pr = P.route.projectNear(f.lat, f.lon, S.s);
      if (pr.off > OFF_M) {                 // off the line: wait, then reroute
        if (!S.offSince) S.offSince = now;
        /* a detour is still travel: odometer by displacement beyond the noise */
        if (prev && !(prev.acc > WEAK_ACC_M)) {
          const d = havM(prev.lat, prev.lon, f.lat, f.lon);
          const gapS = Math.max(1, (now - prevT) / 1000);
          if (d > Math.max(8, 0.5 * Math.max(f.acc || 0, prev.acc || 0)) && d < 60 + 70 * gapS) S.odo += d;
        }
        S.pos = { lat: f.lat, lon: f.lon };
        A.map.puckMove(f.lat, f.lon, f.acc);
        if (S.follow) camera(f.lat, f.lon);
        pushTrack(f.lat, f.lon);
        maybeReroute(now);
        render();
        return;
      }
      S.offSince = 0; S.rerouteFail = false;
      /* progress only ratchets forward, and never faster than a plausible
         ride since the last good fix (a stray fix can't teleport you) */
      const gap = S.lastGoodT ? (now - S.lastGoodT) / 1000 : 0;
      if (pr.s > S.s && (!S.lastGoodT || pr.s - S.s <= 60 + 70 * Math.max(1, gap))) {
        if (S.lastGoodT) S.odo += pr.s - S.s;   // the first fix places you; it isn't travel
        S.s = pr.s;
      }
      S.lastGoodT = now;
      const px = pr.off <= 25 ? P.route.pointAt(S.s) : { lat: f.lat, lon: f.lon };
      S.pos = px;
      A.map.puckMove(px.lat, px.lon, f.acc);
      if (S.follow) camera(px.lat, px.lon);
      pushTrack(px.lat, px.lon);
      paintDone();
      const remM = P.route.L - S.s;
      if (remM <= 35 || (remM < 250 && havM(f.lat, f.lon, to.lat, to.lon) < ARRIVE_M)) {
        finish(true);
        return;
      }
      render();
    }
    function pushTrack(lat, lon) {
      const last = S.track[S.track.length - 1];
      if (!last || havM(last[1], last[0], lat, lon) >= 12) {
        S.track.push([r6(lon), r6(lat), S.P.dose.pmAt(S.s)]);
      }
    }

    /* ── reroute: off the line > OFF_M for > OFF_HOLD_MS ──────────── */
    function maybeReroute(now) {
      if (!S.offSince || S.rerouting || S.done || !S.fix) return;
      if (now - S.offSince < OFF_HOLD_MS || now - S.lastReroute < REROUTE_GAP_MS) return;
      reroute(S.fix.lat, S.fix.lon);
    }
    async function reroute(lat, lon) {
      S.rerouting = true; S.lastReroute = Date.now(); render();
      /* no trip `mode` here — /v2/reroute reads it as the family hint */
      const r = await A.api.post('/v2/reroute', {
        route_id: S.P.o.route_id || null,
        at: { lat: r6(lat), lon: r6(lon) },
        to: { lat: to.lat, lon: to.lon },
        vehicle: params.vehicle || opt.mode || 'car',
      }, 20000);
      if (S.done || S.dead) return;
      S.rerouting = false; S.lastReroute = Date.now();
      if (!S.offSince) { render(); return; }  // back on the line meanwhile — keep it
      const o = r && (r.option || (validGeom(r.geometry) ? r : null));
      if (!o || !validGeom(o.geometry || o.route_geojson)) { S.rerouteFail = true; render(); return; }
      adopt(o);
    }
    function adopt(o) {
      const prev = S.P;
      const P = buildPlan(o);
      if (P.k == null) P.k = prev.k;          // same rider, same breathing
      if (P.loR == null) P.loR = prev.loR;
      if (P.hiR == null) P.hiR = prev.hiR;
      S.P = P; S.reroutes++;
      S.s = S.fix ? P.route.project(S.fix.lat, S.fix.lon).s : 0;
      S.sTick = S.s;
      S.offSince = 0; S.rerouteFail = false; S.cueKey = null;
      S.traffic = null; S.jams = []; paintJams();
      if (!S.trafficDown) S.jamT = 0;         // live traffic for the new line next tick
      if (P.k != null || P.dose.total != null) S.doseKnown = true;
      /* the covered overlay belongs to the old line: hide it BEFORE the
         fresh route draws, then re-add — layer order keeps it on top */
      A.map.hideRoute('journey-done'); doneS = -1;
      drawRoute();
      paintDone();
      render();
    }

    /* ── live traffic on the line still ahead (TomTom via lane P) ─── */
    async function refreshJams() {
      if (S.jamBusy || NO_TRAFFIC.has(glyph)) return;
      S.jamT = Date.now();
      const P = S.P, s0 = S.s, remM = P.route.L - s0;
      if (remM < 300) return;
      S.jamBusy = true;
      const r = await A.api.post('/v2/p/route_traffic', {
        coords: remainingCoords(P.route, s0, TRAFFIC_PTS), mode: TT_MODE[glyph] || 'car',
      }, 9000);
      S.jamBusy = false;
      if (S.done || S.dead || P !== S.P) return;
      S.trafficDown = !r;
      if (!r) S.jamT = Date.now() + 4 * JAM_EVERY_MS;   // endpoint down/missing → ask rarely
      if (!r || r.configured === false || (r.live_s == null && !Array.isArray(r.jams))) {
        S.traffic = null; S.jams = [];       // 404 / unconfigured / failed → show nothing
      } else {
        S.traffic = r.live_s > 0 ? { remM, live_s: r.live_s } : null;
        S.jams = (Array.isArray(r.jams) ? r.jams : [])
          .filter((j) => j && j.lat != null && j.lon != null && j.delay_s > 0)
          .map((j) => {
            const guess = s0 + (j.from_m || 0);
            const pr = P.route.projectNear(j.lat, j.lon, Math.max(0, guess - 50));
            const sA = pr.off <= 120 ? pr.s : guess;
            return { sA, sB: sA + Math.max(0, (j.to_m || 0) - (j.from_m || 0)),
              delay_s: j.delay_s, road: String(j.road || '').trim() || null, lat: j.lat, lon: j.lon };
          })
          .sort((a, b) => a.sA - b.sA);
      }
      paintJams();
      render();
    }

    /* ── the 1 s clock: intake by time actually spent, stuck stretches,
       stale-fix speed, reroute + traffic timers ─────────────────── */
    function tick(final) {
      if (S.done || S.dead) return;
      const now = Date.now();
      const dt = clamp((now - S.lastTick) / 1000, 0, 600);
      S.lastTick = now;
      const P = S.P;
      if (S.gotFix && now - S.lastFixT > FIX_STALE_MS) S.vShown = 0;   // no new fix = not moving
      if (S.gotFix && dt > 0) {
        const pm = P.dose.pmAt(S.s);
        let dd = 0;
        if (P.k != null && pm != null) dd = P.k * pm * dt;
        else if (P.dose.total != null) dd = Math.max(0, P.dose.at(S.s) - P.dose.at(S.sTick));
        S.sTick = S.s;
        S.intake += dd;
        if (pm != null) { S.pmT += pm * dt; S.tT += dt; }
        const bi = Math.floor(S.odo / BIN_M);
        let b = S.bins[bi];
        if (!b) {
          const p = S.pos || P.route.pointAt(S.s);
          b = S.bins[bi] = { dose: 0, pmT: 0, tT: 0, lat: p.lat, lon: p.lon, street: P.roadAt(S.s) };
        }
        b.dose += dd;
        if (pm != null) { b.pmT += pm * dt; b.tT += dt; }
        stuckStep(now);
      }
      if (final) return;
      maybeReroute(now);
      if (now - S.jamT >= JAM_EVERY_MS) refreshJams();
      render();
    }
    /* measured stuck: under 5 km/h for over a minute, after setting off */
    function stuckStep(now) {
      const v = S.vShown;
      if (v != null && v < SLOW_MPS && S.odo >= 30) {
        if (!S.slowSince) S.slowSince = now;
        if (!S.stuckOpen && now - S.slowSince >= STUCK_MIN_S * 1000) {
          const p = S.pos || S.P.route.pointAt(S.s);
          S.stuckOpen = { t0: S.slowSince, odo: S.odo, lat: p.lat, lon: p.lon, street: S.P.roadAt(S.s) };
        }
      } else {
        if (S.stuckOpen) closeStuck(now);
        S.slowSince = 0;
      }
    }
    function closeStuck(now) {
      const st = S.stuckOpen;
      S.stuckOpen = null;
      st.t1 = now; st.dur_s = Math.round((now - st.t0) / 1000);
      S.stuck.push(st);
    }

    /* ── ETA: live traffic (else the plan) for what's left, leaning on
       your own measured pace as the trip proves itself ─────────────── */
    function remainingS(remM) {
      const P = S.P;
      let base = null;
      if (S.traffic && S.traffic.remM > 0) base = S.traffic.live_s * (remM / S.traffic.remM);
      else if (P.etaBase) base = P.etaBase * (remM / P.route.L);
      const el = S.t1 ? (Date.now() - S.t1) / 1000 : 0;
      if (S.odo >= 300 && el >= 60) {
        const obs = remM / (S.odo / el);
        if (base == null) return obs;
        const w = clamp(S.odo / 3000, 0, 0.6);
        return (1 - w) * base + w * Math.min(obs, base * 4);
      }
      return base;
    }

    /* ── render (only what changed) ───────────────────────────────── */
    const last = {};
    const set = (node, key, txt) => { if (last[key] !== txt) { node.textContent = txt; last[key] = txt; } };
    function render() {
      if (S.done || S.dead) return;
      const P = S.P;
      const remM = Math.max(0, P.route.L - S.s);
      const tot = S.odo + remM;
      const pf = `scaleX(${(tot > 0 ? clamp(S.odo / tot, 0, 1) : 0).toFixed(4)})`;
      if (last.pf !== pf) { ui.progFill.style.transform = pf; last.pf = pf; }
      const remS = remainingS(remM);
      if (isRun) {
        /* pace is the runner's number: measured km so far ÷ moving time,
           shown as min/km — never the ETA a driver would watch */
        const kmDone = S.odo / 1000;
        const paceS = S.odo >= 40 && S.t1 ? (Date.now() - S.t1) / kmDone : null;
        const pTot = paceS == null ? null : Math.round(paceS / 1000);
        set(ui.etaV, 'ev', pTot == null ? '—' : `${Math.floor(pTot / 60)}:${String(pTot % 60).padStart(2, '0')}`);
        set(ui.etaS, 'es', `min/km · ${kmDone < 10 ? kmDone.toFixed(1) : Math.round(kmDone)} km · ${distToStr(remM)} left`);
      } else {
        set(ui.etaV, 'ev', remS == null ? '—' : fmtDur(remS));
        set(ui.etaS, 'es', distToStr(remM) +
          (remS != null ? ` · arrive ${clockLabel(Date.now() + remS * 1000)}` : ''));
      }
      set(ui.spdV, 'sv', S.vShown == null ? '—' : String(Math.round(S.vShown * 3.6)));
      const b = A.fmt.band(S.airNow != null ? S.airNow : P.dose.pmAt(S.s));
      const bc = b ? b.color : 'var(--ink4)';
      if (last.bc !== bc) { ui.adot.style.background = bc; last.bc = bc; }
      set(ui.aword, 'aw', b ? `${b.name[0].toUpperCase()}${b.name.slice(1)} air` : 'Air here');
      set(ui.doseV, 'dv', S.gotFix && S.doseKnown ? `≈ ${doseUgRound(S.intake)} µg` : '—');

      /* live jam ahead — the nearest one not yet behind you */
      const j = S.offSince ? null : S.jams.find((x) => x.sB > S.s);
      const jt = j ? `${j.sA <= S.s ? 'Slow traffic' : 'Jam ahead'}${j.road ? ` on ${j.road}` : ''} · +${Math.max(1, Math.round(j.delay_s / 60))} min` : '';
      ui.jam.hidden = !j;
      set(ui.jtxt, 'jt', jt);

      /* one status line at a time */
      let pill = null, dot = false;
      if (S.geoErr === 'denied') pill = 'Location is blocked — allow it to navigate';
      else if (S.geoErr === 'unsupported') pill = "This browser can't share your location";
      else if (!S.gotFix) { pill = S.geoErr ? 'No GPS signal yet — still trying…' : 'Finding your location…'; dot = true; }
      else if (Date.now() - S.lastFixT > 2 * FIX_STALE_MS) { pill = 'GPS signal lost — still watching'; dot = true; }
      else if (S.rerouting) { pill = 'Off route — finding a new way…'; dot = true; }
      else if (S.offSince) pill = S.rerouteFail ? "Off route — couldn't get a new way yet" : 'Off route';
      else if (S.weak) pill = 'Weak GPS signal';
      ui.pill.hidden = pill == null;
      ui.pdot.hidden = !dot;
      if (pill != null) set(ui.ptxt, 'pt', pill);
      ui.geohelp.hidden = S.geoErr !== 'denied';
      paintCue(remM);
    }

    /* ── banner cue: next maneuver, distance from where you really are ─ */
    function paintCue(remM) {
      const next = S.P.nextStep(S.s);
      let gname = 'arrowUp', gcolor = '#FAFAF7', instr = 'Follow the route', street = '';
      if (next) {
        const m = maneuverOf(next.instruction, next.type, next.modifier);
        gname = m === 'arrive' ? 'pin' : m === 'walk' ? 'walk'
          : m === 'transit' ? glyph : (MANEUVER_GLYPH[m] || 'arrowUp');
        if (m === 'arrive') { instr = `Arrive at ${toName}`; gcolor = '#E8B8A8'; }
        else instr = next.instruction;
        if (next.street && instr.toLowerCase().indexOf(String(next.street).toLowerCase()) < 0) {
          street = next.street;
        }
        if (next.wait_s > 0) {
          street = `${street ? `${street} · ` : ''}wait ≈ ${Math.max(1, Math.round(next.wait_s / 60))} min`;
        }
      }
      if (!street) street = S.P.roadAt(S.s) || '';   // the road you're on
      const key = `${gname}|${instr}`;
      if (S.cueKey !== key) {                // only a new cue earns the swap
        S.cueKey = key;
        ui.mico.innerHTML = ic(gname, 30, gcolor);
        ui.instr.textContent = instr;
        ui.tile.classList.remove('swap'); ui.instr.classList.remove('swap');
        void ui.tile.offsetWidth;
        ui.tile.classList.add('swap'); ui.instr.classList.add('swap');
      }
      set(ui.street, 'st', street);
      set(ui.dist, 'di', !next ? distToStr(remM) : (next.type === 'depart' ? '' : distToStr(next.distM)));
    }

    /* ── end ──────────────────────────────────────────────────────── */
    const showConfirm = (on) => {
      ui.confirm.hidden = !on; ui.main.hidden = on; ui.air.hidden = on;
    };
    ui.close.addEventListener('click', () => showConfirm(true));
    $('.jn-no').addEventListener('click', () => { showConfirm(false); render(); });
    $('.jn-yes').addEventListener('click', () => finish(false));

    function stopAll() {
      if (S.watchId != null) { try { navigator.geolocation.clearWatch(S.watchId); } catch (e) {} S.watchId = null; }
      clearInterval(S.timer); clearInterval(S.simTimer); clearInterval(S.geoPulse);
      S.timer = 0; S.simTimer = 0; S.geoPulse = 0;
      if (S._airBeat) { S._airBeat(); S._airBeat = null; }
      if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; }
      if (onVisLock) { document.removeEventListener('visibilitychange', onVisLock); onVisLock = null; }
    }

    function finish(arrived) {
      if (S.done) return;
      tick(true);                            // the last seconds count too
      S.done = true;
      stopAll();
      const now = Date.now();
      if (S.stuckOpen) closeStuck(now);
      /* "on the way" starts at the first real fix — the wait for GPS at
         the start isn't travel */
      const takenS = Math.round((now - (S.t1 || S.t0)) / 1000);
      const km = S.odo / 1000;
      const frac = arrived ? 1 : clamp(S.odo / plan0.route.L, 0, 1);
      const measured = S.gotFix && S.doseKnown && (arrived || S.odo >= 50);
      const intake = S.intake;
      const lo = S.P.loR != null ? intake * S.P.loR : null;
      const hi = S.P.hiR != null ? intake * S.P.hiR : null;
      const doses = options.map((o) => ({ o, d: doseOf(o) })).filter((x) => x.d != null);
      const cleanest = doses.length ? doses.reduce((a, b) => (b.d < a.d ? b : a)) : null;
      const smokiest = doses.length ? doses.reduce((a, b) => (b.d > a.d ? b : a)) : null;
      const co2 = opt.emissions && opt.emissions.co2_kg && opt.emissions.co2_kg.mid != null
        ? Math.max(0, opt.emissions.co2_kg.mid) * frac : null;

      if (measured) {                        // the local ledger (only ADDED fields)
        const rec = {
          t: now, arrived,
          from: { lat: from.lat, lon: from.lon, label: from.label || 'start' },
          to: { lat: to.lat, lon: to.lon, label: to.label || 'there' },
          vehicle: params.vehicle || (opt.mode || '').split('_')[0] || null,
          label: opt.label || opt.mode || null,
          mode: tripMode,
          activity: isRun ? 'run' : null,
          pace_s_km: isRun && km > 0.05 ? Math.round(takenS / km) : null,
          km_plan: opt.distance_km ?? null, eta_plan_s: opt.eta_s ?? null,
          covered_km: r2(km), taken_s: takenS,
          dose_ug: r2(intake), dose_lo_ug: lo != null ? r2(lo) : null, dose_hi_ug: hi != null ? r2(hi) : null,
          dose_plan_ug: plan0.dose.total,
          emit_kg: co2 != null ? Math.round(co2 * 1000) / 1000 : null,
          avoided_ug: smokiest ? r2(Math.max(0, smokiest.d * frac - intake)) : 0,
          stuck: S.stuck.map((st) => ({ dur_s: st.dur_s, street: st.street || null })),
          reroutes: S.reroutes,
          measured: 'gps',
          simulated: S.simulated,
        };
        A.store.set(STORE_LAST, rec);
        const hist = A.store.get(STORE_HIST, []) || [];
        hist.unshift(rec);
        A.store.set(STORE_HIST, hist.slice(0, HIST_CAP));
      }
      trackEnd(arrived);
      renderReceipt({ arrived, measured, intake, frac, takenS, cleanest, co2 });
    }
    /* anonymous counter (telemetry.js whitelists these props; no location) */
    let tracked = false;
    function trackEnd(arrived) {
      if (tracked || S.simulated || !A.track) return;
      tracked = true;
      const frac = arrived ? 1 : clamp(S.odo / plan0.route.L, 0, 1);
      const fastest = options.filter((o) => o.eta_s > 0).sort((a, b) => a.eta_s - b.eta_s)[0] || null;
      const fastD = doseOf(fastest);
      A.track('journey_end', {
        completed: !!arrived, mode: tripMode, vehicle: vehKey,
        dose_ug: r2(S.intake), dose_saved_ug: fastD != null ? r2(fastD * frac - S.intake) : null,
        km: r2(S.odo / 1000), minutes: r1((Date.now() - S.t0) / 60000),
      });
    }

    /* ── the receipt: hero, verdict, one band-coloured graph, a mini map ─ */
    function renderReceipt(x) {
      const jn = $('.jn');
      if (jn) jn.remove();
      /* the trip's map layer work ends with the trip: routes, end pins,
         puck, jam pins — both engines, the receipt's mini map is its
         own SVG */
      paintJams(true);
      A.map.hideAllRoutes();
      A.map.unpin('jfrom'); A.map.unpin('jto');
      A.map.puckRemove();
      const chip = isRun && x.measured
        ? (() => {
            const km = S.odo / 1000, ts = x.takenS;
            const pace = km > 0.05 ? Math.round(ts / km) : null;
            const pm = pace == null ? null : Math.floor(pace / 60);
            const ps = pace == null ? null : String(pace % 60).padStart(2, '0');
            return `run · ${km < 10 ? km.toFixed(1) : Math.round(km)} km${pm != null ? ` · ${pm}:${ps} /km` : ''}`;
          })()
        : modeLabel(opt.mode || '', opt.label || '');
      const head = `
        <div class="jr-head">
          <div class="jr-title">${isRun ? (x.arrived ? 'Run done.' : 'Run ended early.') : (x.arrived ? "You're here." : 'Trip ended.')}</div>
          ${chip ? `<div class="jr-chip">${ic(glyph, 14, 'var(--ink2)')}<span>${esc(chip)}</span></div>` : ''}
        </div>`;
      const rc = document.createElement('div');
      rc.className = 'jr';
      if (!x.measured) {
        const why = S.geoErr === 'denied' ? 'Location was blocked, so nothing was measured.'
          : !S.gotFix ? 'No GPS fix came through, so nothing was measured.'
          : !S.doseKnown ? 'No air reading came back for this route.'
          : 'You hardly moved along the route, so nothing was counted.';
        rc.innerHTML = `<div class="jr-sheet">${head}<div class="jr-none">${esc(why)}</div>
          <div class="jr-btns"><button class="jr-done" type="button">Done</button></div></div>`;
      } else {
        const meanPm = S.tT > 0 ? S.pmT / S.tT : null;
        const band = A.fmt.band(meanPm);
        const share = x.intake / WHO_DAY_UG;
        const vi = Math.max(0, VERDICT.findIndex((v) => share < v.max));
        const pct = share * 100 >= 1 ? `${Math.round(share * 100)}%` : 'under 1%';
        let cmp = null;
        if (x.cleanest) {
          const cd = x.cleanest.d * x.frac;
          const extra = x.intake - cd;
          const lbl = modeLabel(x.cleanest.o.mode || '', x.cleanest.o.label || '');
          if (x.cleanest.o === opt) cmp = 'You took the cleanest way there';
          else if (extra > Math.max(0.05, cd * 0.05)) cmp = `≈ ${doseUgRound(extra)} µg more than the cleanest way${lbl ? ` (${lbl})` : ''}`;
          else cmp = `As clean as the cleanest way${lbl ? ` (${lbl})` : ''}`;
        }

        /* the graph: intake per stretch of the trip, coloured by the air
           of that stretch; a jam you sat in stands tall where it happened */
        const nb = S.bins.length;
        let G = null;
        if (nb >= 2) {
          const N = Math.min(28, nb);
          const cols = [];
          for (let c = 0; c < N; c++) {
            const b0 = Math.floor((c * nb) / N), b1 = Math.max(b0 + 1, Math.floor(((c + 1) * nb) / N));
            let v = 0, pmT = 0, tT = 0, at = null;
            for (let i = b0; i < b1; i++) {
              const b = S.bins[i];
              if (!b) continue;
              v += b.dose; pmT += b.pmT; tT += b.tT;
              if (!at || b.dose > at.dose) at = b;
            }
            cols.push({ v, pm: tT > 0 ? pmT / tT : null, at });
          }
          const max = Math.max(...cols.map((c) => c.v));
          if (max > 0) G = { cols, N, nb, max };
        }
        const longest = S.stuck.slice().sort((a, b) => b.dur_s - a.dur_s)[0] || null;
        let jamC = -1, maxC = -1;
        if (G) {
          if (longest) jamC = clamp(Math.floor((Math.floor(longest.odo / BIN_M) * G.N) / G.nb), 0, G.N - 1);
          G.cols.forEach((c, i) => { if (maxC < 0 || c.v > G.cols[maxC].v) maxC = i; });
        }
        const maxAt = G && maxC >= 0 ? G.cols[maxC].at : null;
        const jamMin = longest ? Math.max(1, Math.round(longest.dur_s / 60)) : 0;
        /* the jam IS where most went in → one marker, not two stacked */
        const same = !!(longest && maxAt && (jamC === maxC || havM(longest.lat, longest.lon, maxAt.lat, maxAt.lon) < 60));
        const tags = [];
        if (G && longest) tags.push({ c: jamC, icon: 'clock', txt: `jammed here · ${jamMin} min${same ? ' · most intake' : ''}`, cls: 'jam' });
        if (G && maxAt && !same) tags.push({ c: maxC, icon: 'dust', txt: 'most intake here', cls: 'max' });
        const tagHtml = tags.map((t, row) => {
          const p = (((t.c + 0.5) / G.N) * 100).toFixed(1);
          return `<div class="jr-tag jr-tag-${t.cls}" style="top:${row * 28}px;left:${p}%;transform:translateX(-${p}%)">` +
            `${ic(t.icon, 13, 'currentColor')}<span>${esc(t.txt)}</span></div>`;
        }).join('');
        const graph = G ? `
          <div class="jr-g">
            ${tags.length ? `<div class="jr-tags" style="height:${tags.length * 28}px">${tagHtml}</div>` : ''}
            <div class="jr-bars" role="img" aria-label="intake along the trip">
              ${G.cols.map((c, i) => {
                const h = c.v > 0 ? Math.max(3, Math.round((c.v / G.max) * 76)) : 2;
                const bi = A.fmt.bandIdx(c.pm);
                const col = c.v > 0 && bi != null ? `var(--b${bi})` : 'var(--ink15)';
                const mk = i === jamC ? '<b class="jr-mk jam"></b>' : (i === maxC && maxAt ? '<b class="jr-mk max"></b>' : '');
                return `<div class="jr-col">${mk}<i style="height:${h}px;background:${col}"></i></div>`;
              }).join('')}
            </div>
            <div class="jr-ax"><span>start</span><span>${distToStr(S.odo)}</span></div>
          </div>` : '';

        const marks = [];
        if (longest) marks.push({ lat: longest.lat, lon: longest.lon, icon: 'clock' });
        if (maxAt && !same) marks.push({ lat: maxAt.lat, lon: maxAt.lon, icon: 'dust' });
        const legend = [];
        if (longest) legend.push(`<div class="jr-leg" data-k="jam">${ic('clock', 14, 'var(--ink)')}<span>Jammed ${jamMin} min${same ? ', most intake' : ''}<b class="jr-where">${longest.street ? ` · ${esc(longest.street)}` : ''}</b></span></div>`);
        if (maxAt && !same) legend.push(`<div class="jr-leg" data-k="max">${ic('dust', 14, 'var(--ink)')}<span>Most intake<b class="jr-where">${maxAt.street ? ` · ${esc(maxAt.street)}` : ''}</b></span></div>`);

        const stuckTot = S.stuck.reduce((a, st) => a + st.dur_s, 0);
        const ex = opt.emissions && opt.emissions.co2_kg;
        let fuel = null;
        if (ex && ex.hi != null && ex.hi <= 0) fuel = 'No exhaust from this ride';
        else if (opt.fuel_l > 0) fuel = `≈ ${r2(opt.fuel_l * x.frac)} L fuel${x.co2 > 0 ? ` · ${x.co2 < 1 ? `${Math.round(x.co2 * 1000)} g` : `${r1(x.co2)} kg`} CO₂` : ''}`;
        else if (x.co2 > 0) fuel = `≈ ${x.co2 < 1 ? `${Math.round(x.co2 * 1000)} g` : `${r1(x.co2)} kg`} CO₂ from the ride`;

        rc.innerHTML = `
          <div class="jr-sheet">
            ${head}
            <div class="jr-hero">
              <div class="jr-hk">You breathed</div>
              <div class="jr-hv">≈ ${doseUgRound(x.intake)}<span> µg</span></div>
              ${band ? `<div class="jr-band"><i style="background:${band.color}"></i><span>${esc(band.name)} air on the way</span></div>` : ''}
            </div>
            <div class="jr-v">
              <div class="jr-vscale" aria-hidden="true">${VERDICT.map((v, i) =>
                `<i class="${i === vi ? 'on' : ''}" style="background:var(--b${i})"></i>`).join('')}</div>
              <div class="jr-vtxt"><b>${VERDICT[vi].word}</b> · ${pct} of a day at the WHO limit</div>
              ${cmp ? `<div class="jr-vcmp">${esc(cmp)}</div>` : ''}
            </div>
            ${graph}
            ${marks.length || S.track.length >= 2 ? `<div class="jr-mapw">${miniMap(marks)}</div>` : ''}
            ${legend.length ? `<div class="jr-legs">${legend.join('')}</div>` : ''}
            <div class="jr-grid">
              <div class="jr-cell"><b>${distToStr(S.odo)}</b><span>travelled</span></div>
              <div class="jr-cell"><b>${fmtDur(x.takenS)}</b><span>on the way</span></div>
              ${stuckTot >= 60 ? `<div class="jr-cell"><b>${fmtDur(stuckTot)}</b><span>stuck</span></div>` : ''}
            </div>
            ${fuel ? `<div class="jr-fuel">${esc(fuel)}</div>` : ''}
            <div class="jr-btns">
              <button class="jr-done" type="button">Done</button>
              <button class="jr-back" type="button">Plan the way back</button>
            </div>
          </div>`;
        /* a street for the markers when the route named none there */
        if (A.search && A.search.reverse) {
          [['jam', longest], ['max', same ? null : maxAt]].forEach(([k, m]) => {
            if (!m || m.street) return;
            A.search.reverse(m.lat, m.lon).then((nm) => {
              const w = rc.querySelector(`.jr-leg[data-k="${k}"] .jr-where`);
              if (nm && w && rc.isConnected) w.textContent = ` · ${nm}`;
            }).catch(() => {});
          });
        }
      }
      el.appendChild(rc);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const sh = rc.querySelector('.jr-sheet');
        if (sh) sh.classList.add('on');
      }));
      const back = rc.querySelector('.jr-back');
      if (back) back.addEventListener('click', () => {
        const swap = {
          from: { lat: to.lat, lon: to.lon, label: to.label || 'here' },
          to: { lat: from.lat, lon: from.lon, label: from.label || 'back' },
        };
        A.back();                                   // cleans this screen fully
        A.show('whereto', swap, true);              // replaces the old whereto
      });
      rc.querySelector('.jr-done').addEventListener('click', () => A.back());
      A.map.ready((m) => {
        if (typeof m.getBearing === 'function' && (m.getBearing() !== 0 || (m.getPitch && m.getPitch() !== 0))) {
          m.easeTo({ bearing: 0, pitch: 0, duration: 500 });
        }
      });
    }

    /* the receipt's mini map — the planned line faint, what you rode
       coloured by its air, the two markers */
    function miniMap(marks) {
      const W = 320, H = 128, pad = 16;
      const plan = thin(plan0.route.pts, 300);
      const trk = thin(S.track, 400);
      const all = plan.concat(trk, marks.map((m) => [m.lon, m.lat]));
      const lat0 = all.reduce((a, p) => a + p[1], 0) / all.length;
      const kx = Math.cos(lat0 * K);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of all) {
        const xx = p[0] * kx, yy = p[1];
        if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
        if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
      }
      const sc = Math.min((W - 2 * pad) / Math.max(x1 - x0, 1e-5), (H - 2 * pad) / Math.max(y1 - y0, 1e-5));
      const ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
      const X = (lon) => (ox + (lon * kx - x0) * sc).toFixed(1);
      const Y = (lat) => (H - oy - (lat - y0) * sc).toFixed(1);
      const poly = (pts) => pts.map((p) => `${X(p[0])},${Y(p[1])}`).join(' ');
      const line = (pts, stroke, w) => `<polyline points="${poly(pts)}" style="fill:none;stroke:${stroke};stroke-width:${w};stroke-linecap:round;stroke-linejoin:round"/>`;
      let svg = line(plan, 'var(--ink15)', 6);
      const runs = [];
      for (let i = 1; i < trk.length; i++) {
        const bi = A.fmt.bandIdx(trk[i][2]);
        const r = runs[runs.length - 1];
        if (r && r.b === bi) r.pts.push(trk[i]);
        else runs.push({ b: bi, pts: [trk[i - 1], trk[i]] });
      }
      for (const r of runs) svg += line(r.pts, r.b == null ? 'var(--ink3)' : `var(--b${r.b})`, 4);
      const st = trk.length ? trk[0] : plan[0];
      svg += `<circle cx="${X(st[0])}" cy="${Y(st[1])}" r="4" style="fill:var(--paper);stroke:var(--ink);stroke-width:2"/>`;
      if (trk.length) {
        const e = trk[trk.length - 1];
        svg += `<circle cx="${X(e[0])}" cy="${Y(e[1])}" r="4.5" style="fill:var(--ink)"/>`;
      }
      for (const m of marks) {
        svg += `<g transform="translate(${X(m.lon)},${Y(m.lat)})">` +
          `<circle r="11" style="fill:var(--paper);stroke:var(--ink);stroke-width:1.5"/>` +
          `<svg x="-7" y="-7" width="14" height="14" viewBox="0 -960 960 960">` +
          `<path d="${ICONS[m.icon][0]}" style="fill:var(--ink)"/></svg></g>`;
      }
      return `<svg class="jr-map" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="your trip on a map">${svg}</svg>`;
    }

    /* Escape steps back one level: dismiss the end-confirm, leave the
       receipt, or open the end-confirm — the same taps as on-screen */
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const no = el.querySelector('.jn-no');
      if (no && no.offsetParent) { no.click(); return; }
      const done = el.querySelector('.jr-done');
      if (done) { done.click(); return; }
      const end = el.querySelector('.jn-close');
      if (end) end.click();
    };
    document.addEventListener('keydown', onKey);

    /* ── go ───────────────────────────────────────────────────────── */
    if (SIM_QA) startSim();
    else {
      startGeo();
      if (A.track) A.track('journey_start', { mode: tripMode, vehicle: vehKey });
    }
    S.timer = setInterval(() => tick(false), TICK_MS);
    render();

    return () => {
      document.removeEventListener('keydown', onKey);
      if (!S.done) trackEnd(false);          // left mid-trip: an ended, not completed, trip
      S.dead = true; S.done = true;
      stopAll();
      paintJams(true);
      A.map.ready((m) => { m.off('dragstart', onDrag); });
      A.map.hideRoute('journey');
      A.map.hideRoute('journey-done');
      A.map.unpin('jfrom'); A.map.unpin('jto');
      A.map.puckRemove();
      A.map.ready((m) => {
        if (typeof m.getBearing === 'function' && (m.getBearing() !== 0 || (m.getPitch && m.getPitch() !== 0))) {
          m.easeTo({ bearing: 0, pitch: 0, duration: 500 });
        }
      });
    };
  },
});
})();
