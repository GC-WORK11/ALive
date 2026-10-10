# Screens Gallery Assets

Generated 2025-10-09. All files are optimized WebP (q88), under 300 KB.
Status bar / gesture-pill chrome cropped where it collided with content
(Android: top 100 px + bottom 50 px of 1080x2424; iOS: top 86–90 px,
matching the existing `*-c.webp` crop convention).

## Produced assets

| File | Dims | Size | Shows | Platform | Source | Staleness |
|---|---|---|---|---|---|---|
| scr-compare-android.webp | 1080x2274 | 132 KB | Route compare: Karol Bagh → India Gate — "air by hour" strip, "lightest around 1:30 pm", 6.2 µg breathed, "Car (AC) · least smoky way", "lightest for you", +1 min quicker, 10.71 km · arrive 1:56 pm, start journey | android | demos/android/uc2-nav.png | clean |
| scr-compare-ios.webp | 720x1476 | 76 KB | Route verdict: India Gate, bike selected — "leave 13:30 → breathe ~11% less", air-by-hour strip, 2 µg breathed, Car (AC), turn-by-turn Start | ios | static/ios-choose-verdict.png | clean |
| scr-stay-android.webp | 1080x2274 | 114 KB | "Where to stay near you" — ranked stays with per-stay µg deltas (YMCA Tourist Hotel ~80 µg · 4.6 µg lighter, Hotel Raj Mahal 4.2 µg lighter…) | android | demos/android/uc3-stays-painted.png | clean |
| scr-stay-ios.webp | 662x1354 | 164 KB | "Where to stay" near Lodhi Garden — Ambassador/Vivanta hotels ~100 µg, 8.3–8.5 µg lighter | ios | static/ios-feat-stays.webp | clean |
| scr-hours-android.webp | 1080x2274 | 118 KB | "When to go out" — least-bad window 13:30–20:30 ~67 µg/m³, heaviest 23:30–08:30 ~96, 24 h avg ~83 | android | demos/android/uc5-playtime.png | clean |
| scr-hours-ios.webp | 662x1354 | 162 KB | "When to go out" near Lodhi Garden — least-bad 13:30–17:30 ~84 µg/m³ (−9 vs now), 24 h avg ~107 | ios | static/ios-feat-playtime.webp | clean |
| scr-map-android.webp | 1080x2274 | 252 KB | Live air map — 53 stations, good→severe legend, tap readout "66 µg/m³ moderate" near Karol Bagh, "your day so far ~62 µg/m³" | android | demos/android/uc6-airmap-tap.png | clean |
| scr-map-ios.webp | 708x1483 | 115 KB | Live air map — 53 stations, legend, reading 5 min old, "your day so far ~62 µg/m³" | ios | static/app-airmap.png | clean |
| scr-nav-android.webp | 1080x2274 | 138 KB | (bonus) Live nav "Head out" — ride meters paused / still counting air, breathe 0.7 µg vs ride 35 g, 13 min · 10.1 km left, arrive 2:02 pm | android | demos/android/uc2-nav-final.png | clean |
| scr-week-android.webp | 1080x2274 | 49 KB | ALIVE panel — Today 2.1 µg breathed on trips, This-week bar strip (S–S), saved places, trips list | android | demos/android/uc7-sidebar.png | clean |
| scr-week-ios.webp | 662x1354 | 39 KB | ALIVE panel — Today 9.6 µg (29% less than yesterday), This week 10 trips · 152 µg, saved places | ios | static/ios-feat-week.webp | clean |
| scr-settings.webp | 1080x2274 | 71 KB | Settings — vehicle, Language & display, Voice, cigarette comparison, Privacy & sharing ("Share anonymous trip data — on, one tap to stop") | android | demos/android/uc7-settings-en.png | clean |

No iOS settings screenshot exists in any source — scr-settings is Android-only.

## demo-*.mp4 verdicts (static/)

| File | Dims | Duration | Content | Verdict |
|---|---|---|---|---|
| demo-cross.mp4 | 432x970 | 38.8 s | from/to search (Karol Bagh → India Gate) → "finding the purest route" → vehicle chooser → vehicle picker | CLEAN — usable |
| demo-live.mp4 | 432x970 | 14.1 s | onboarding splash "You can't see it. You still breathe it." | **STALE — every sampled frame shows "Skipping counts as sharing on — either way, one tap in Settings undoes it". DO NOT USE** |
| demo-out.mp4 | 432x970 | 15.4 s | stays ranked → "when to go out" least-bad window | CLEAN — usable |
| demo-stay.mp4 | 432x970 | 18.5 s | where-from/to search → "where to stay… reading the field" | CLEAN — usable |
| demo-week.mp4 | 432x970 | 16.2 s | trips ledger empty state "no trips yet — your day builds here" | CLEAN but thin (static empty state) |

Also present: app-walkthrough.mp4 (720x1566, 39 s, iOS) — home scroll: easing
banner → lightest-hours card → 5-day forecast strip → check-in card. CLEAN.
boot-haze.mp4 (720x720, 4 s) — decorative haze loop, not a screen.

## Source inventory

### static/ app/ios captures (iOS, ~0.46 aspect)
- app-airmap.png/.webp 708x1573 — air map 53 stations → used (scr-map-ios)
- app-choose-settle.png/.webp 708x1573 — compare, HUDA City Centre, petrol car, "safest route / lightest for you"
- app-choose-strip-{848,1360,1520} — wide crops of compare screen
- app-hero.png, app-hero-{472,708} — hero app shot (mostly map, no text)
- app-walkthrough-poster.webp 720x1566 — home "air around you 8 µg satisfactory"
- ios-choose-bold.png/.webp 720x1566 — compare, on-foot, leave 16:30 breathe ~10% less
- ios-choose-priced.png/.webp 720x1566 — compare alternates list (on-foot µg costs, ~20.5x more inhaled)
- ios-choose-verdict.png/.webp 720x1566 → used (scr-compare-ios)
- ios-dose.png/.webp 720x1566 — home with dose card (8 µg, 40% of limit)
- ios-feat-airmap.webp 662x1440 — air map (data 13 min old — scr-map-ios preferred: 5 min)
- ios-feat-playtime.webp / -c — used (scr-hours-ios; -c = identical 86-px crop)
- ios-feat-stays.webp / -c — used (scr-stay-ios; -c = identical 86-px crop)
- ios-feat-trips.webp — trips ledger, 10 trips · 152 µg · ~26 kg emitted
- ios-feat-week.webp — used (scr-week-ios)
- android-{airmap,home,playtime,stays,week}.webp 1080x2400 — pre-made Android crops; all clean, usable as fallbacks (stay deltas smaller ~0.6 µg; week shows only 1 trip — uc7-sidebar.png preferred)
- hero-*.webp — photographic heroes, not screens

### demos/android/ stills (all 1080x2424 Pixel frames)
- uc1-onb1..4.png, uc1-splash2.png — **STALE: "Skipping counts as sharing on…" onboarding copy — DO NOT USE**
- uc1-consent-after.png — permission explainer "One permission — where you are… stays on this phone" — clean
- uc1-splash.png — bare "alive" wordmark; s01-launch.png — home "Good afternoon, 24 m counted, least-bad 12:30–17:30"; uc1-home-fresh.png — home w/ "easiest hours ahead"; uc1-home-final.png / uc4-ledger-fresh.png — empty "no trips yet"
- uc1-permdialog.png — system location dialog; baseline.png, uc1-splash-frame.png — Android launcher, not app; s02-relaunch.png — relaunch splash; live-state.png — keyboard open (live card)
- uc2-chooser.png, uc2-mid2.png — vehicle-estimate explainer; uc2-chooser-final.png — BS-year picker; uc2-chooser-or-state.png — place search w/ keyboard; uc2-vehicles.png — vehicle grid picker; uc2-mid1.png — destination results
- uc2-nav.png → used (scr-compare-android); uc2-nav2.png / uc2-nav-final.png → live nav (nav-final used as scr-nav-android); uc2-endcard*.png — trip-end cards
- uc3-stays.png — search + "air answers"; uc3-stays-painted.png → used (scr-stay-android)
- uc4-ledger.png — trips ledger w/ 7-day strip; uc4-trips.png — search w/ air answers
- uc5-playtime.png → used (scr-hours-android)
- uc6-airmap-tap.png → used (scr-map-android); uc6-airmap-readout.png — air map w/ readout card (52 stations, "older data — reconnecting 19 min" — stale-data badge, tap version preferred); airmap-state.png — map only
- uc7-settings.png / uc7-sidebar.png → sidebar/ALIVE panel (sidebar used as scr-week-android); uc7-settings-en.png → used (scr-settings); uc7-settings-final.png — same w/ share OFF; uc7-settings-real.png / uc7-hindi-*.png — Hindi variants; uc7-delhitoday*.png — "Delhi today" city-air report

### demos/android/ videos (all 1080x2424)
airmap 29.7 s · coldopen 89.1 s · delhitoday2 14.3 s · goingout 14.5 s
(stays→hours flow) · nav 14.5 s (live nav) · settings2 19.8 s (sidebar +
settings incl. "Delete my data") · staying 25 s · travelling-journey 130 s ·
travelling-nav-stuck 54 s · travelling-plan 58.5 s · travelling-take1 79 s ·
travelling-take2 90 s · week3 16.2 s (empty ledger).
All sampled frames clean of stale copy.
