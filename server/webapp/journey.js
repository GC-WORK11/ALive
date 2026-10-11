/* Alive webapp — journey. Live navigation over the picked /v2/plan
   option, then the arrival receipt. PIXEL TWIN of the Android app:
   the nav chrome mirrors Mobile/src/components/shell/NavChrome.tsx
   (banner + maneuver tile + instrument cluster) and the receipt
   mirrors Mobile/src/components/shell/ReceiptSheet.tsx (+ the
   DepartGraph-style dose card). Maneuver arrows are the same Material
   Symbols geometry as Mobile/src/icons.tsx (960 grid).
   Progress = real nearest-point projection on the route LineString;
   dose-so-far = the served dose band spread along the route by the
   per-segment pm25 strip — always labeled "plan estimate". Real GPS
   tracking when the device has it; otherwise an explicitly-labeled
   simulated preview at the plan's own pace (L/eta_s). Nothing here
   invents a number: every figure traces to the option fields,
   /v2/city, or the real clock. */
(() => {
'use strict';

const STORE_LAST = 'journey.last';
const STORE_HIST = 'journey.history';
const HIST_CAP = 20;
const ARRIVE_M = 55;          // puck this close to the destination → arrived
const OFFROUTE_M = 80;        // farther than this from the line → off-route note
const STEP_PASS_M = 25;       // arclength past a maneuver before the next cue
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

  function project(lat, lon) {
    const px = lon * kx, py = lat * ky;
    let best = Infinity, bi = 0, bt = 0;
    for (let i = 0; i < n - 1; i++) {
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
      lon: pts[lo][0] + t * (pts[lo][0] - pts[lo][0]),
    };
  }

  function bearingAt(s, ahead = 70) {
    const a = pointAt(s), b = pointAt(s + ahead);
    return bearingDeg(a.lat, a.lon, b.lat, b.lon);
  }

  return { pts, cum, L, n, project, pointAt, bearingAt };
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
  if (total == null) return { total: null, bandAt: () => ({ lo: null, mid: null, hi: null }), at: () => null, pmAt: () => null, heaviest: () => null };
  if (!segs.length) {
    return {
      total,
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
  function pmAt(s) {
    for (const g of segs) if (s >= g.s0 && s < g.s1) return g.pm;
    return segs.length ? segs[segs.length - 1].pm : null;
  }
  function heaviest() {
    let best = null;
    for (const g of segs) if (!best || g.pm > best.pm) best = g;
    return best ? { pm25: best.pm, sMid: (best.s0 + best.s1) / 2,
      frac: ((best.s0 + best.s1) / 2) / L, dist: best.dist } : null;
  }
  return {
    total,
    at: (s) => total * (watt(s) / W),
    bandAt: (s) => bandFrac(total * (watt(s) / W)),
    pmAt, heaviest,
  };
}

/* ── road names: named steps where they exist, via_names else ────── */
function buildRoads(option, route) {
  const named = (option.steps || [])
    .filter((st) => st.street && st.lat != null)
    .map((st) => ({ s: route.project(st.lat, st.lon).s, street: st.street }))
    .sort((a, b) => a.s - b.s);
  const vias = option.via_names || [];
  return function roadAt(s) {
    if (named.length) {
      let r = null;
      for (const st of named) { if (st.s <= s + 8) r = st.street; else break; }
      if (r) return r;
    }
    if (vias.length) {
      const i = clamp(Math.floor((s / route.L) * vias.length), 0, vias.length - 1);
      return vias[i];
    }
    return null;
  };
}

/* ── next-maneuver: served steps projected onto arclength ─────────── */
function buildSteps(option, route) {
  const steps = (option.steps || [])
    .filter((st) => st.lat != null && st.instruction)
    .map((st) => ({
      s: route.project(st.lat, st.lon).s,
      instruction: st.instruction,
      type: st.type || null,
      modifier: st.modifier || null,
    }))
    .sort((a, b) => a.s - b.s);
  /* the cue a rider needs = the first step ahead; skip depart-at-0 and
     anything we've already passed by more than a breath */
  return function nextStep(s) {
    for (const st of steps) {
      if (st.s > s + (st.type === 'depart' ? -1 : STEP_PASS_M)) {
        if (st.type === 'depart' && s > 1) continue;
        return { instruction: st.instruction, distM: Math.max(0, st.s - s),
          type: st.type, modifier: st.modifier };
      }
    }
    return null;
  };
}

/* ══════════════════ the screen ══════════════════ */
A.screen('journey', {
  mount(el, params) {
    /* defend the handoff — anything missing goes back to whereto */
    const opt = params && params.option;
    const geom = opt && (opt.geometry || opt.route_geojson);
    const from = params && params.from, to = params && params.to;
    if (!opt || !geom || geom.type !== 'LineString' ||
        !Array.isArray(geom.coordinates) || geom.coordinates.length < 2 ||
        !from || !to || from.lat == null || from.lon == null ||
        to.lat == null || to.lon == null) {
      A.toast('no route to follow — pick a ride first');
      setTimeout(() => { A.back(); if (!A.current()) A.show('home'); }, 60);
      return () => {};
    }

    const route = buildRoute(geom);
    const dose = buildDose(opt, route.L);
    const roadAt = buildRoads(opt, route);
    const nextStep = buildSteps(opt, route);
    const options = (params && Array.isArray(params.options) ? params.options : [opt]);
    const planKm = opt.distance_km != null ? opt.distance_km : route.L / 1000;
    const planEta = opt.eta_s != null ? opt.eta_s : null;
    const mode = opt.mode || (params && params.vehicle) || '';
    /* co2 accrues per km — the served band spreads uniformly over L */
    const co2Band0 = opt.emissions && opt.emissions.co2_kg && opt.emissions.co2_kg.mid > 0
      ? opt.emissions.co2_kg : null;
    const pm25Band0 = opt.emissions && opt.emissions.pm25_g || null;
    const emLabel = opt.emissions && opt.emissions.label || null;
    const fieldAgeMin = params && params.field_age_s != null ? params.field_age_s / 60 : null;

    const S = {
      mode: null,            // 'live' | 'preview'
      follow: true,
      s: 0, sMax: 0,
      pos: null,
      watchId: null, watchTimer: null,
      raf: 0, simMul: 1, simLast: 0, simElapsed: 0,
      liveAcc: 0, liveT0: 0,
      samples: [{ t: 0, dose: 0 }],
      sampleFloor: 0,
      bearing: null,
      done: false,
      offRoute: false,
      simUsed: false,
      gotFix: false,
      dead: false,
      cueKey: null,
    };

    /* ── view — NavChrome.tsx structure: banner + pill + cluster ──── */
    el.innerHTML = `
      <div class="jn">
        <div class="jn-banner">
          <div class="jn-tile"><span class="jn-mico"></span></div>
          <div class="jn-btxt">
            <div class="jn-dist"></div>
            <div class="jn-instr"></div>
          </div>
          <button class="jn-act jn-recenter" type="button" aria-label="re-centre" hidden>${ic('locate', 20, 'var(--ink2)')}</button>
          <button class="jn-act jn-close" type="button" aria-label="end journey">${ic('close', 20, 'var(--ink2)')}</button>
        </div>
        <div class="jn-flags">
          <div class="jn-flag" hidden>preview — simulated ride · plan pace</div>
          <div class="jn-pill" hidden><i class="jn-pdot"></i><span class="jn-ptxt"></span></div>
        </div>
        <div class="jn-bottom">
          <div class="jn-fabs">
            <button class="jn-fab jn-speed" type="button" hidden>×8</button>
          </div>
          <div class="jn-cluster">
          <div class="jn-prog" hidden><i></i></div>
          <div class="jn-cells">
            <div class="jn-cell">
              <div class="jn-cellh">${ic('dust', 14, 'var(--b2)')}<span class="jn-celll">smoke you breathe</span></div>
              <div class="jn-cellv jn-dosev">—</div>
              <div class="jn-btrack" hidden><i class="jn-bseg"></i><i class="jn-bmid"></i></div>
              <div class="jn-cellb jn-doseb"></div>
            </div>
            <div class="jn-cdiv" hidden></div>
            <div class="jn-cell jn-outcell" hidden>
              <div class="jn-cellh">${ic('smoke', 14, 'var(--ink2)')}<span class="jn-celll">smoke your ride puts out</span></div>
              <div class="jn-cellv jn-cov">—</div>
              <div class="jn-btrack jn-cotrack" hidden><i class="jn-bseg jn-coseg"></i><i class="jn-bmid"></i></div>
              <div class="jn-cellb jn-cob"></div>
            </div>
          </div>
          <div class="jn-meta"></div>
          <div class="jn-ctl" hidden>
            <button class="jn-gps" type="button" hidden>follow my gps</button>
            <button class="jn-prev" type="button" hidden>ride a preview instead</button>
          </div>
          <div class="jn-confirm" hidden>
            <span>end this ride? the receipt covers what you did</span>
            <button class="jn-yes" type="button">end</button>
            <button class="jn-no" type="button">keep riding</button>
          </div>
          </div>
        </div>
      </div>`;

    const $ = (q) => el.querySelector(q);
    const ui = {
      banner: $('.jn-banner'), tile: $('.jn-tile'), mico: $('.jn-mico'),
      dist: $('.jn-dist'), instr: $('.jn-instr'),
      recenter: $('.jn-recenter'), close: $('.jn-close'),
      flag: $('.jn-flag'), pill: $('.jn-pill'), ptxt: $('.jn-ptxt'), pdot: $('.jn-pdot'),
      speedFab: $('.jn-speed'),
      prog: $('.jn-prog'), progFill: $('.jn-prog i'),
      doseV: $('.jn-dosev'), doseB: $('.jn-doseb'),
      btrack: $('.jn-btrack'), bseg: $('.jn-bseg'), bmid: $('.jn-bmid'),
      cdiv: $('.jn-cdiv'), outcell: $('.jn-outcell'),
      cov: $('.jn-cov'), cob: $('.jn-cob'),
      cotrack: $('.jn-cotrack'), coseg: $('.jn-coseg'), cobmid: $('.jn-cotrack .jn-bmid'),
      meta: $('.jn-meta'),
      ctl: $('.jn-ctl'), gpsBtn: $('.jn-gps'), prevBtn: $('.jn-prev'),
      confirm: $('.jn-confirm'),
    };
    if (co2Band0) { ui.outcell.hidden = false; ui.cdiv.hidden = false; }

    /* ── map dressing ─────────────────────────────────────────────── */
    A.map.hideAllRoutes();
    A.map.setFieldVisible(false);
    A.map.showRoute('journey', geom, opt.segments);
    A.map.pin('jfrom', route.pts[0][0], route.pts[0][1],
      '<div class="pin-dot"></div>');
    const toName = to.label || 'there';
    A.map.pin('jto', route.pts[route.n - 1][0], route.pts[route.n - 1][1],
      `<div class="pin-chip">${esc(toName.length > 18 ? toName.slice(0, 17) + '…' : toName)}</div>`);
    A.map.fit(geom, 84);

    /* ── band-track painter (NavChrome CounterCell band viz) ──────── */
    function paintBand(track, seg, midEl, band, tint) {
      const span = band && band.hi > 0 ? band.hi : 0;
      if (!band || span <= 0) { track.hidden = true; return; }
      track.hidden = false;
      const pct = (v) => clamp((v / span) * 100, 0, 100);
      seg.style.left = pct(Math.max(0, band.lo || 0)) + '%';
      seg.style.width = Math.max(3, pct(band.hi) - pct(Math.max(0, band.lo || 0))) + '%';
      seg.style.background = tint;
      midEl.style.left = `calc(${pct(band.mid)}% - 1.5px)`;
    }
    const bandText = (band, unit) => {
      if (!band) return '';
      const lo = Math.round(Math.max(0, band.lo || 0));
      const hi = Math.round(Math.max(0, band.hi || 0));
      return lo === hi ? `${lo} ${unit}` : `${lo}–${hi} ${unit}`;
    };
    const kgText = (kg) => kg < 1 ? `${Math.round(Math.max(0, kg * 1000))} g`
      : `${approx(r1(Math.max(0, kg)))} kg`;

    /* ── banner cue — maneuver tile + dist + instruction ──────────── */
    function paintCue() {
      const next = nextStep(S.s);
      const maneuver = next
        ? maneuverOf(next.instruction, next.type, next.modifier)
        : 'straight';
      const glyph = maneuver === 'arrive' ? 'pin'
        : (maneuver === 'walk' ? 'walk'
        : (maneuver === 'transit' ? vehicleGlyph(mode)
        : (MANEUVER_GLYPH[maneuver] || 'arrowUp')));
      const gcolor = maneuver === 'arrive' ? '#E8B8A8' : '#FAFAF7';
      const banner = next ? next.instruction : 'follow the route line';
      const key = `${glyph}|${banner}`;
      if (S.cueKey !== key) {           // only a new cue earns the swap
        S.cueKey = key;
        ui.mico.innerHTML = ic(glyph, 30, gcolor);
        ui.instr.textContent = banner;
        ui.instr.classList.toggle('big', !next);
        ui.tile.classList.remove('swap'); ui.instr.classList.remove('swap');
        void ui.tile.offsetWidth;
        ui.tile.classList.add('swap'); ui.instr.classList.add('swap');
      }
      const dtxt = next ? distToStr(next.distM) : '';
      if (ui.dist.textContent !== dtxt) ui.dist.textContent = dtxt;
    }

    /* ── HUD render (only what changed) ───────────────────────────── */
    let lastTxt = {};
    function set(elm, key, txt) {
      if (lastTxt[key] !== txt) { elm.textContent = txt; lastTxt[key] = txt; }
    }
    function render() {
      const frac = clamp(S.s / route.L, 0, 1);
      const remM = Math.max(0, route.L - S.s);
      const remS = planEta != null ? planEta * (1 - frac) : null;
      const min = Math.max(0, Math.round((remS || 0) / 60));

      /* progress hairline */
      ui.prog.hidden = frac <= 0;
      ui.progFill.style.width = `${frac * 100}%`;

      /* breathe cell — accrued dose band (plan estimate) */
      const dB = dose.bandAt(S.s);
      const dTxt = dB.mid == null ? 'locating you…'
        : `≈ ${doseUgRound(dB.mid)} µg`;
      set(ui.doseV, 'dv', dB.mid === 0 ? '0 µg' : dTxt);
      paintBand(ui.btrack, ui.bseg, ui.bmid, dB, 'var(--b2)');
      set(ui.doseB, 'db', bandText(dB, 'µg'));

      /* put-out cell — co2 band accrued per km */
      if (co2Band0) {
        const cb = { lo: co2Band0.lo * frac, mid: co2Band0.mid * frac, hi: co2Band0.hi * frac };
        const outG = co2Band0.hi < 1;
        set(ui.cov, 'cv', outG ? `${Math.round(Math.max(0, cb.mid * 1000))} g`
          : `${approx(r1(Math.max(0, cb.mid)))} kg`);
        paintBand(ui.cotrack, ui.coseg, ui.cobmid, cb, 'var(--ink2)');
        const lo = Math.round(Math.max(0, cb.lo)), hi = Math.round(Math.max(0, cb.hi));
        if (outG) set(ui.cob, 'cb', lo === hi ? `${lo} g` : `${lo}–${hi} g`);
        else set(ui.cob, 'cb', r1(cb.lo) === r1(cb.hi) ? `${r1(cb.hi)} kg` : `${r1(cb.lo)}–${r1(cb.hi)} kg`);
      }

      /* meta — "N min · K km left · arrive 4:42 pm" */
      const leftTxt = leftIsKm(remM)
        ? `${min} min · ${(remM / 1000).toFixed(1)} km left`
        : `${min} min · ${leftMNum(remM)} m left`;
      const arr = remS != null ? ` · arrive ${clockLabel(Date.now() + Math.max(0, remS) * 1000)}` : '';
      set(ui.meta, 'm', leftTxt + arr);

      /* status pills — RN's single pill slot, one line at a time */
      let pillTxt = null, pillDot = false;
      if (S.mode === 'live' && S.offRoute) { pillTxt = 'finding a new way…'; pillDot = true; }
      else if (S.mode === 'live' && !S.gotFix) { pillTxt = 'no location — counting the air where you started'; }
      ui.pill.hidden = pillTxt == null;
      ui.pdot.hidden = !pillDot;
      if (pillTxt != null) set(ui.ptxt, 'p', pillTxt);

      paintCue();
    }

    /* ── camera ───────────────────────────────────────────────────── */
    function camera(lat, lon, instant) {
      if (!S.follow) return;
      const brg = route.bearingAt(S.s);
      const b = S.bearing == null ? brg : lerpAng(S.bearing, brg, 0.4);
      S.bearing = b;
      A.map.ready((m) => {
        m.easeTo({
          center: [lon, lat], zoom: Math.max(15.4, m.getZoom()),
          bearing: b, duration: instant ? 200 : 700,
        });
      });
    }
    const onDrag = () => {               // user panned → release follow
      if (S.dead) return;
      if (S.follow) { S.follow = false; ui.recenter.hidden = false; }
    };
    A.map.ready((m) => { m.on('dragstart', onDrag); });
    ui.recenter.addEventListener('click', () => {
      S.follow = true; ui.recenter.hidden = true;
      const p = S.pos || route.pointAt(S.s);
      camera(p.lat, p.lon, true);
    });

    /* ── progress intake (shared by live + preview) ───────────────── */
    function advance(lat, lon, opts) {
      if (S.done) return;
      const pr = route.project(lat, lon);
      S.s = Math.max(S.s, pr.s);          // progress only ratchets forward
      S.sMax = Math.max(S.sMax, S.s);
      S.offRoute = pr.off > OFFROUTE_M;
      A.map.puckMove(lat, lon, opts && opts.acc);
      if (S.follow) camera(lat, lon);
      // dose sample for the receipt curve — at most ~every 1.2s of ride
      const elapsed = elapsedNow();
      if (elapsed - S.sampleFloor >= 1.2) {
        S.sampleFloor = elapsed;
        S.samples.push({ t: elapsed, dose: dose.at(S.s) });
      }
      render();
      const arrived = pr.off < OFFROUTE_M &&
        (S.s / route.L >= 0.985 || havM(lat, lon, to.lat, to.lon) < ARRIVE_M);
      if (arrived) finish(true);
    }

    /* ride clock: preview sim-seconds + live wall-seconds, added honestly */
    function elapsedNow() {
      const live = S.liveAcc + (S.mode === 'live' && S.liveT0 ? (Date.now() - S.liveT0) / 1000 : 0);
      return S.simElapsed + live;
    }

    /* ── live mode ────────────────────────────────────────────────── */
    function startLive() {
      S.mode = 'live';
      S.liveT0 = Date.now();
      ui.flag.hidden = true; ui.speedFab.hidden = true;
      ui.ctl.hidden = true; ui.gpsBtn.hidden = true; ui.prevBtn.hidden = true;
      S.watchId = A.geo.watch((pos) => {
        if (S.done || S.mode !== 'live') return;
        S.pos = pos; S.gotFix = true;
        advance(pos.lat, pos.lon, { acc: pos.acc });
      });
      if (S.watchId == null) {           // no geolocation after all
        startPreview();
        return;
      }
      // honest "waiting on gps" state if the first fix is slow
      clearTimeout(S.watchTimer);
      S.watchTimer = setTimeout(() => {
        if (!S.gotFix && !S.done) {
          ui.prevBtn.hidden = false;      // 'ride a preview instead'
          ui.ctl.hidden = false;
        }
      }, 12000);
    }

    /* ── preview mode — simulated, honestly paced ─────────────────── */
    function startPreview() {
      if (S.done) return;
      if (S.mode === 'live') {
        if (S.watchId != null) { A.geo.clearWatch(S.watchId); S.watchId = null; }
        if (S.liveT0) { S.liveAcc += (Date.now() - S.liveT0) / 1000; S.liveT0 = 0; }
      }
      S.mode = 'preview';
      S.simUsed = true;
      ui.flag.hidden = false;
      ui.speedFab.hidden = false;
      ui.prevBtn.hidden = true;
      ui.gpsBtn.hidden = !navigator.geolocation;
      ui.ctl.hidden = ui.gpsBtn.hidden;
      ui.speedFab.textContent = S.simMul === 1 ? '×8' : '×1';
      ui.speedFab.classList.toggle('on', S.simMul !== 1);
      // pace = plan pace: cover L in eta_s (realistic — never a teleport)
      const v = planEta != null && planEta > 0 ? route.L / planEta : null;
      if (v == null) {
        ui.flag.textContent = 'preview needs the plan eta — not served for this option';
        return;
      }
      if (!S.simLast) S.simLast = performance.now();
      if (S.raf) return;
      const tick = (now) => {
        if (S.done || S.mode !== 'preview') { S.raf = 0; return; }
        const dt = Math.min(0.5, (now - S.simLast) / 1000);   // tab-jank guard
        S.simLast = now;
        S.simElapsed += dt * S.simMul;
        S.s = Math.min(route.L, S.s + v * dt * S.simMul);
        S.sMax = S.s;
        const p = route.pointAt(S.s);
        S.pos = p;
        advance(p.lat, p.lon, {});
        if (!S.done) S.raf = requestAnimationFrame(tick);
      };
      S.raf = requestAnimationFrame(tick);
    }
    ui.speedFab.addEventListener('click', () => {
      S.simMul = S.simMul === 1 ? 8 : 1;
      ui.speedFab.textContent = S.simMul === 1 ? '×8' : '×1';
      ui.speedFab.classList.toggle('on', S.simMul !== 1);
      S.simLast = performance.now();
    });
    ui.gpsBtn.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      A.geo.consent = 'granted'; A.store.set('consent', 'granted');
      ui.gpsBtn.hidden = true; ui.ctl.hidden = true;
      S.gotFix = false;
      startLive();
    });
    ui.prevBtn.addEventListener('click', () => startPreview());

    /* ── end / exit — confirm swaps with the cluster body ─────────── */
    ui.close.addEventListener('click', () => {
      ui.confirm.hidden = false;
      ui.ctl.hidden = true;
      $('.jn-cells').hidden = true; ui.meta.hidden = true; ui.prog.hidden = true;
    });
    $('.jn-no').addEventListener('click', () => {
      ui.confirm.hidden = true;
      $('.jn-cells').hidden = false; ui.meta.hidden = false;
      render();
    });
    $('.jn-yes').addEventListener('click', () => finish(false));

    /* ── the receipt — ReceiptSheet.tsx mirrored ──────────────────── */
    function finish(arrived) {
      if (S.done) return;
      S.done = true;
      if (S.watchId != null) { A.geo.clearWatch(S.watchId); S.watchId = null; }
      if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
      clearTimeout(S.watchTimer);

      const takenS = elapsedNow();
      const coveredM = S.sMax;
      const frac = clamp(coveredM / route.L, 0, 1);
      const doseBand = dose.bandAt(coveredM);
      const doseDone = doseBand.mid;
      const heavy = dose.heaviest();
      const neverStarted = !arrived && coveredM < 100;

      /* comparisons against the OTHER served options (NavSession's rule:
         the taken mode can't compare against itself) */
      const others = options.filter((o) => o !== opt);
      const worstDose = Math.max(0, ...others.map((o) => (o.dose && o.dose.mid) || 0));
      const worstOpt = worstDose > 0 ? others.find((o) => ((o.dose && o.dose.mid) || 0) === worstDose) : null;
      const altEmit = others
        .filter((o) => o.emissions && o.emissions.co2_kg && o.emissions.co2_kg.mid > 0)
        .sort((a, b) => a.emissions.co2_kg.mid - b.emissions.co2_kg.mid)[0];

      // persist — the local ledger
      const rec = {
        t: Date.now(), arrived,
        from: { lat: from.lat, lon: from.lon, label: from.label || 'start' },
        to: { lat: to.lat, lon: to.lon, label: to.label || 'there' },
        vehicle: (params && params.vehicle) || (opt.mode || '').split('_')[0] || null,
        label: opt.label || opt.mode || null,
        km_plan: opt.distance_km ?? null, eta_plan_s: opt.eta_s ?? null,
        covered_km: coveredM / 1000, taken_s: Math.round(takenS),
        dose_ug: doseDone, dose_plan_ug: dose.total,
        simulated: S.simUsed,
      };
      A.store.set(STORE_LAST, rec);
      const hist = A.store.get(STORE_HIST, []);
      hist.unshift(rec);
      A.store.set(STORE_HIST, hist.slice(0, HIST_CAP));

      renderReceipt(rec, { frac, heavy, doseBand, worstDose, worstOpt, altEmit, neverStarted });
    }

    async function renderReceipt(rec, x) {
      const jn = $('.jn');
      if (jn) jn.remove();
      const optDose = dose.total;
      const isSim = rec.simulated;
      const doseB = x.doseBand;
      const dShown = doseB.mid;
      const co2 = co2Band0 ? { lo: co2Band0.lo * x.frac, mid: co2Band0.mid * x.frac, hi: co2Band0.hi * x.frac } : null;
      const pm25 = pm25Band0 ? { lo: pm25Band0.lo * x.frac, mid: pm25Band0.mid * x.frac, hi: pm25Band0.hi * x.frac } : null;
      const co2Zero = co2 != null && co2.hi <= 0;
      const worst = x.worstDose;
      const fullRun = rec.arrived;
      const mins = Math.max(1, Math.round(rec.taken_s / 60));
      const chip = modeLabel(opt.mode || '', opt.label || '');

      /* dose ruler — ReceiptSheet DoseScale: mid fill on the trip-or-1cig
         scale; whiskers = the honest lo/hi band; ring = smokiest option */
      const scaleMax = Math.max(doseB.hi || 0, worst || 0, dShown || 0, 1);
      const pct = (v) => clamp((v / scaleMax) * 100, 0, 100);
      const doseScale = dShown != null ? `
        <div class="jr-scale" role="img" aria-label="dose on this trip's scale">
          <div class="jr-strack">
            <i class="jr-sfill" style="width:${pct(doseB.mid)}%"></i>
            ${(doseB.hi - doseB.lo) >= 1 ? `<i class="jr-swhisk" style="left:${pct(doseB.lo)}%"></i><i class="jr-swhisk" style="left:${pct(doseB.hi)}%"></i>` : ''}
            ${worst != null && worst > doseB.mid * 1.02 ? `<i class="jr-sworst" style="left:${pct(worst)}%"></i>` : ''}
          </div>
          ${ic('dust', 13, 'var(--ink3)')}
        </div>` : '';

      /* "about N× less smoke than by X" — same fraction/× copy as RN */
      const ratio = doseB.mid != null && worst != null && doseB.mid > 0.5
        ? Math.round((worst / doseB.mid) * 10) / 10 : null;
      const fracW = ratio != null && ratio > 1.05 && fullRun ? smokeFraction(ratio) : null;
      const worstLabel = x.worstOpt ? modeLabel(x.worstOpt.mode || '', x.worstOpt.label || '') : null;
      const worstIsWalk = (x.worstOpt && x.worstOpt.mode) === 'walk';
      const ratioTxt = ratio != null && ratio > 1.05 && fullRun
        ? (fracW != null
          ? (worstLabel ? (worstIsWalk ? `about ${fracW} of walking` : `about ${fracW} of ${worstLabel}`)
              : `about ${fracW} of the smokiest option`)
          : (worstLabel ? (worstIsWalk ? `about ${ratio}× less smoke than on foot`
              : `about ${ratio}× less smoke than by ${worstLabel}`)
            : `about ${ratio}× less smoke than the smokiest option`))
        : null;
      const savedUg = doseB.mid != null && worst != null ? Math.max(0, worst - doseB.mid) : null;

      /* dose-over-ride card — DepartGraph bars: one column per time
         bucket, height = dose added in that bucket, breath ramp by
         share of the max, accent dot on the heaviest stretch's bucket */
      const samples = S.samples.length ? S.samples : [{ t: 0, dose: 0 }];
      const tMax = Math.max(rec.taken_s, samples[samples.length - 1].t, 1);
      const cumAt = (t) => {
        if (t <= 0) return 0;
        let prev = samples[0];
        for (const p of samples) {
          if (p.t >= t) {
            const span = p.t - prev.t || 1;
            return (prev.dose || 0) + ((p.dose || 0) - (prev.dose || 0)) * ((t - prev.t) / span);
          }
          prev = p;
        }
        return samples[samples.length - 1].dose || 0;
      };
      const NCOL = 14, dt = tMax / NCOL;
      const cols = [];
      for (let i = 0; i < NCOL; i++) {
        const v = Math.max(0, cumAt((i + 1) * dt) - cumAt(i * dt));
        cols.push({ t0: i * dt, t1: (i + 1) * dt, v });
      }
      const colMax = Math.max(1e-6, ...cols.map((c) => c.v));
      const breathRamp = (f) => f > 0.66 ? 'var(--b4)' : f > 0.33 ? 'var(--b3)' : 'var(--b2)';
      /* which bucket holds the heaviest stretch → accent column + dot */
      let heavyCol = -1;
      if (x.heavy) {
        const tA = tAtS(Math.max(0, x.heavy.sMid - (x.heavy.dist || 0) / 2));
        const tB = tAtS(Math.min(rec.covered_km * 1000, x.heavy.sMid + (x.heavy.dist || 0) / 2));
        const tMid = (tA + tB) / 2;
        heavyCol = clamp(Math.floor(tMid / dt), 0, NCOL - 1);
      }
      const graph = `
        <div class="jr-g">
          <div class="jr-gbars" style="height:64px">
            ${cols.map((c, i) => {
              const col = i === heavyCol ? 'var(--accent)' : breathRamp(c.v / colMax);
              const h = Math.max(2, (c.v / colMax) * 64);
              return `<div class="jr-gcell">${i === heavyCol ? '<i class="jr-gdot"></i>' : ''}` +
                `<i class="jr-gbar" style="height:${h.toFixed(0)}px;background:${col}"></i></div>`;
            }).join('')}
          </div>
          <div class="jr-gax">
            <span>0</span><span>${tMax < 90 ? Math.round(tMax) + ' sec' : Math.round(tMax / 60) + ' min'}</span>
          </div>
          <div class="jr-gcap"><span>est.</span><span class="jr-gcapv">${dShown != null ? `≈ ${doseUgRound(dShown)} µg across the ride` : 'no dose estimate'}</span></div>
        </div>`;
      function tAtS(sM) {
        const dAt = dose.at(sM);
        let best = 0, bd = Infinity;
        for (const p of samples) {
          const dd = Math.abs((p.dose || 0) - dAt);
          if (dd < bd) { bd = dd; best = p.t; }
        }
        return best || (sM / route.L) * rec.taken_s;
      }

      /* emissions footnotes — RN detail lines verbatim */
      const detail = [];
      if (co2 != null) {
        if (co2Zero) detail.push('your ride put out nothing — no exhaust');
        else {
          let t1 = 'estimated for this kind of ride';
          if (co2.hi < 1) {
            const lo = Math.round(Math.max(0, co2.lo * 1000)), hi = Math.round(Math.max(0, co2.hi * 1000));
            t1 += `  ·  ${lo === hi ? `${hi} g` : `${lo}–${hi} g`}`;
          } else if (co2.hi - co2.lo > 0.05) {
            t1 += `  ·  ${r1(co2.lo) === r1(co2.hi) ? `${r1(co2.hi)} kg` : `${r1(co2.lo)}–${r1(co2.hi)} kg`}`;
          }
          detail.push(t1);
          if (pm25 != null && pm25.hi > 0) {
            const lo = r2(pm25.lo), hi = r2(pm25.hi);
            detail.push(lo === hi
              ? (hi === 0 ? 'includes a trace of fine dust (PM2.5)' : `includes ${hi} g of fine dust (PM2.5)`)
              : `includes ${lo}–${hi} g of fine dust (PM2.5)`);
          }
          if (x.altEmit && x.altEmit.emissions.co2_kg.mid != null) {
            /* RN renders kg only — a sub-50 g alt would read "0 kg",
               which hides the number; grams keep it honest */
            const altKg = Math.max(0, x.altEmit.emissions.co2_kg.mid);
            const altTxt = altKg >= 0.1 ? `${approx(r1(altKg))} kg`
              : `${approx(Math.round(altKg * 1000))} g`;
            detail.push(`${modeLabel(x.altEmit.mode || '', x.altEmit.label || '')} would have put out ${altTxt}`);
          }
        }
      }

      /* stats grid — put out · distance · time */
      const stats = `
        <div class="jr-grid">
          <div class="jr-cell"><div class="jr-cv">${co2 == null ? '—' : kgText(co2.mid)}</div><div class="jr-ck">put out</div></div>
          <div class="jr-cell"><div class="jr-cv">${r1(Math.max(0, rec.covered_km))} km</div><div class="jr-ck">distance</div></div>
          <div class="jr-cell"><div class="jr-cv">${mins} min</div><div class="jr-ck">time</div></div>
        </div>`;

      const rcEl = document.createElement('div');
      rcEl.className = 'jr';
      rcEl.innerHTML = `
        <div class="jr-sheet">
          <div class="jr-head">
            <div class="jr-title">${x.neverStarted ? 'ended before it really started' : (rec.arrived ? "You're here." : 'Trip ended.')}</div>
            ${chip && !x.neverStarted ? `<div class="jr-chip">${ic(vehicleGlyph(opt.mode || ''), 14, 'var(--ink2)')}<span>${esc(chip)}</span></div>` : ''}
          </div>
          ${x.neverStarted ? `
            <div class="jr-sub">under 100 m — nothing counted</div>
            <div class="jr-btns"><button class="jr-done" type="button">done</button></div>` : `
          ${isSim ? `<div class="jr-simflag">preview — simulated ride · the receipt uses plan pace</div>` : ''}
          <div class="jr-ebrow">${ic('dust', 15, 'var(--b2)')}<span>You breathed</span></div>
          ${dShown == null ? `<div class="jr-heronone">no dose estimate came back for this option — nothing to total up</div>` : `
            <div class="jr-hero"><span class="jr-est">about</span> ≈ ${doseUgRound(dShown)} µg</div>
            ${(doseB.hi - doseB.lo) >= 1 ? `<div class="jr-bandtxt">about ${doseUgRound(doseB.lo)}–${doseUgRound(doseB.hi)} µg</div>` : ''}
            ${doseScale}
            ${ratioTxt ? `<div class="jr-sub">${esc(ratioTxt)}</div>` : ''}
            ${savedUg != null && savedUg >= 6 && fullRun ? `<div class="jr-sub">the smokiest way would have added ${approx(doseUgRound(savedUg))} µg</div>` : ''}
          `}
          ${stats}
          ${detail.length ? `<div class="jr-detail">${detail.map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
          <div class="jr-glabel">dose over the ride <span>· ${isSim ? 'simulated' : 'along your track'} · plan estimate</span></div>
          ${graph}
          <div class="jr-heavy"></div>
          <div class="jr-ctx"></div>
          <div class="jr-foot"></div>
          <div class="jr-btns">
            <button class="jr-done" type="button">done</button>
            <button class="jr-back" type="button">plan the way back</button>
          </div>`}
        </div>`;
      el.appendChild(rcEl);
      requestAnimationFrame(() => requestAnimationFrame(() =>
        rcEl.querySelector('.jr-sheet').classList.add('on')));

      if (!x.neverStarted) {
        /* heaviest stretch — real segment pm25 + where it sits */
        const heavyEl = rcEl.querySelector('.jr-heavy');
        if (x.heavy) {
          const h = x.heavy;
          const b = A.fmt.band(h.pm25);
          const where = roadAt(h.sMid) || null;
          const fracOf = (hv) => clamp((rec.covered_km * 1000 - (hv.sMid - (hv.dist || 0) / 2)) / (hv.dist || 1), 0, 1);
          const paint = (place) => {
            heavyEl.innerHTML =
              `heaviest stretch · <b style="color:${b ? b.color : 'var(--ink)'}">${Math.round(h.pm25)} µg/m³</b>` +
              `${b ? ` · ${b.name}` : ''}${place ? ` — around ${esc(place)}` : ''}` +
              (fracOf(h) < 1 ? ` <span class="muted">(you${rec.arrived ? '' : ' only'} rode ${Math.round(fracOf(h) * 100)}% of it)</span>` : '');
          };
          if (where) paint(where);
          else {
            const pt = route.pointAt(h.sMid);
            A.search.reverse(pt.lat, pt.lon).then((n) => { if (rcEl.isConnected) paint(n || 'mid-route'); });
          }
        } else heavyEl.remove();

        /* context rows — WHO guideline + delhi field mean, live fetch */
        const ctxEl = rcEl.querySelector('.jr-ctx');
        if (dShown != null) {
          const pctTxt = (p) => p >= 1 ? `${Math.round(p)}%` : '<1%';
          ctxEl.innerHTML = `<div>≈ ${pctTxt((dShown / WHO_DAY_UG) * 100)} of a day at the WHO 24h guideline (15 µg/m³, ~216 µg breathed)</div><div class="muted">reading today's delhi average for the honest comparison…</div>`;
          A.api.get('/v2/city', 9000).then((city) => {
            const m = city && city.pm25_stats && city.pm25_stats.mean;
            if (!ctxEl.isConnected) return;
            if (m != null && m > 0) {
              const dayUg = m * 14.4;
              const pctRaw = (dShown / dayUg) * 100;
              const pct = pctRaw >= 1 ? `${Math.round(pctRaw)}%` : '<1%';
              const conc = opt.dose && opt.dose.avg_conc_ugm3;
              let eq = null;
              if (conc && rec.eta_plan_s) {
                const vent = (optDose || dShown) / (conc * (rec.eta_plan_s / 60));
                if (vent > 0) eq = Math.round(dShown / (m * vent));
              }
              ctxEl.innerHTML =
                `<div>≈ ${pctTxt((dShown / WHO_DAY_UG) * 100)} of a day at the WHO 24h guideline (15 µg/m³, ~216 µg breathed)</div>` +
                `<div>≈ <b>${pct}</b> of a day breathing delhi's current average ` +
                `(${Math.round(m)} µg/m³ field mean now)` +
                (eq != null && eq >= 1 ? ` — like <b>${eq} min</b> in that average air` : '') + `</div>`;
            } else {
              ctxEl.lastElementChild.textContent = "delhi's average didn't come back — the per-ride numbers above still stand";
            }
          });
        } else ctxEl.remove();

        /* provenance */
        const foot = [];
        if (fieldAgeMin != null) foot.push(`updated ${Math.max(0, Math.round(fieldAgeMin))} min ago`);
        if (isSim) foot.push('preview — simulated ride · plan pace');
        /* "this phone" on RN is the store; on web the same local ledger
           lives in localStorage — the honest noun here is the browser */
        foot.push('kept in this browser only');
        const footEl = rcEl.querySelector('.jr-foot');
        footEl.textContent = foot.join('  ·  ');

        rcEl.querySelector('.jr-back').addEventListener('click', () => {
          const swap = {
            from: { lat: to.lat, lon: to.lon, label: to.label || 'here' },
            to: { lat: from.lat, lon: from.lon, label: from.label || 'back' },
          };
          A.back();                                   // cleans this screen fully
          A.show('whereto', swap, true);              // replaces old whereto
        });
      }
      const doneFns = () => A.back();
      rcEl.querySelector('.jr-done').addEventListener('click', doneFns);
      // keep the route on the map behind the receipt — it's the story
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

    /* ── choose the mode, start the engine ────────────────────────── */
    if (navigator.geolocation && A.geo.consent === 'granted') startLive();
    else startPreview();

    render();

    return () => {
      document.removeEventListener('keydown', onKey);
      S.dead = true; S.done = true;
      if (S.watchId != null) A.geo.clearWatch(S.watchId);
      if (S.raf) cancelAnimationFrame(S.raf);
      clearTimeout(S.watchTimer);
      A.map.ready((m) => { m.off('dragstart', onDrag); });
      A.map.hideRoute('journey');
      A.map.unpin('jfrom'); A.map.unpin('jto');
      A.map.puckRemove();
      A.map.ready((m) => { if (m.getBearing() !== 0) m.easeTo({ bearing: 0, duration: 500 }); });
    };
  },
});
})();
