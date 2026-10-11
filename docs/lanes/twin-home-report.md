# twin-home lane report — home + onboarding + settings

Lane: `Mobile/src/screens/HomeScreen.tsx` (1892 lines), `OnboardingScreen.tsx` (709),
`SettingsScreen.tsx` (882) → `server/webapp/home.js` + `home.css` + NEW `settings.js` + `settings.css`.
Verified at 390×844 in real Chrome against `?api=https://d2eh2l2ys9wkij.cloudfront.net`.
Screenshots in `docs/lanes/twin-home-shots/`.

## coordinator wiring needed (frozen files)

`index.html` — two additions, exactly where the existing per-screen tags are:

```html
<link rel="stylesheet" href="settings.css">     <!-- after home.css -->
<script src="settings.js"></script>            <!-- after home.js, before whereto.js -->
```

That's all. `settings.js` registers `A.screen('settings')` itself; the hash router
(`#/settings`) and back-stack already work. The home menu button already routes to
`#/settings` when the screen is registered, and toasts otherwise — no other code
changes needed for the door.

`#consent` element — I restructured **inside** it only (the onboarding flow), per
the brief. Two mechanics of the element my interior relies on — no changes needed,
just facts the coordinator should know:

- it shows/hides via the `hidden` attribute (not a class) — my code drives
  `c.hidden = false|true`.
- `boot()` attaches click listeners to `#consent-yes`/`#consent-skip` inside it
  after mounting home. My onboarding renders hidden dummy nodes with those two ids
  on pages 0–3 and the real buttons (same ids, its own handler) on the location
  page — so `boot()` finds them and never throws, and my capture-phase delegation
  on `#consent` owns all real clicks. Keep both ids present if the interior is
  ever re-marked-up.

## per-screen mapping (RN file+lines → web)

### OnboardingScreen.tsx → `#consent` interior (`.onb`), `home.js` `onbHtml` + `home.css` `.onb-*`

| RN | web |
|---|---|
| topRow wordmark "Alive" 12px ls3 + skip | `.onb-top` / `.onb-word` / `.onb-skip` |
| page 0: airKicker + aqiRow ~96px serif-light bandInk + meta (µg/m³ 17 + band word) + airLine 22px lh31 maxW300 | `.onb-eyebrow`, `.onb-airrow/.onb-airnum` 96px, `.onb-airmeta`, `.onb-line`; number re-paints when `/aqi` lands |
| page 1: whatTitle 44px + 3 arc rows (38×38 r12 surface2 wells, search/dust/flag, 17px) | `.onb-hero`, `.onb-arcrow` + `.onb-arcwell` — same three strings |
| page 2: phoneTitle + lead + accentWash kCard (kNum 52 + kLabel) | `.onb-kcard/.onb-knum "3"` |
| page 3: consent choiceCol 2 btns min-h84 r20 (ink share / surface2 keep) | `.onb-choicebtn.share/.keep` → `settings.share` store key |
| page 4: locTitle/locBody + ink locBtn h64 (locate icon) + locLater | `#consent-yes` (`.onb-locbtn`) + `#consent-skip` (`.onb-loclater`) |
| footnote outside scroll (steps ≤3) + Dots (6px, active 18px accent) + nextBtn ink pill h56 | `.onb-foot`, `.onb-dots/.onb-dot.on`, `.onb-next` |

Deviations:
- RN skip = "keep sharing on, complete without location". Web: `alive.onboarded=1`
  store key + `hidden=true`; consent stays `null`, home falls back to the city
  anchor. Consent won't auto-reopen after skip (chip-reopen parity, below).
- The web `#loc-chip` is kept hidden: RN home has no chip (the hero provLine is
  the "location off" nudge). `#chrome` itself is hidden only while `data-top` is
  `home` or `settings` — map screens keep it (their own lane's call).

### HomeScreen.tsx → `home.js` / `home.css`

| RN (line) | web |
|---|---|
| MoodCanvas L1450-1496: bandWashDeep wash 0→.62@26%→.30@52%→bg@80%, 750ms crossfade, breath .72–1 5.6s | `.hs-mood-cur`/`prev` — same stops + timings |
| header L1016-1058: greeting 30px ls-0.6 lh36 + `Delhi · {weekday} · {clock}` 13px + 42px menu pill | `.hs-head/.hs-brand/.hs-sub/.hs-menubtn`; menu → `#/settings` (toast fallback until wired) |
| pinned CTA: ink h56 r999 "Where to?" + search + 30px arrow well | `.hs-ctabar/.hs-cta` → `#/whereto` |
| HeroBlock L1089-1324: eyebrow rules, 132px CountUp, heroUg µg|µg/m³, BreathLine, feltRow 10px sq + 30px word, heroWhat + refs (budget/WHO/yday), provLine, BandScale 220px, SparseAirArc + sparseProgRow | `heroHtml()`, `countUp`, `renderBandScale`, `renderSparseArc` — same gating (`counted` vs sparse vs thin) |
| IncidentsCard: flame + "in Delhi's air right now" + cause_note + "· measured, not reported" | `incidentHtml()` reading `/v2/city.why.cause_note` verbatim |
| DoorRow L1016+: one grouped list card (Air map / Delhi today / Trips) r24, hairline ml56 | `doorsHtml()` → `airmap` for both air rows; Trips renders only once a `ledger` screen is registered |
| MoveCard L524-651: Quiet pin (outside / !covered), decisionLine(), morningAnswers(), sparkline, winChips heavy→clean, clean-tinted bg + edge | `moveHtml()` — full logic ported incl. `decisionLine` en rebuild of the served 'outdoor exercise'/'today' sentences |
| DaysAheadCard L660-802: 5 cells r15, band-dot + 17px mono mid, partial "~{n}h", best_day mark, lo opacity .62, tap → detail, verdict caption | `outlookHtml()` + `outlookDetailHtml()` — wire fields kept (`label`, `date_ist`, `band`, `confidence`, `partial`, `n_hours`, `cleanest_window`, `heavy_hours_ist`, `pm25_*`) |
| CheckinSheet L1524+: title/sub, 3 facet rows × 3 pills, "stays on this phone", lens line | `lensHtml()` + `getCheckins/saveCheckin` (IST-day keyed localStorage) |
| BudgetCard L1402+: title sugg/set, 8px track + dose-dot fill, mono line, profile segment, explainer | `budgetHtml()` — `profile_budget_ug {general 216, sensitive 72, child 130}` |
| card order + FadeIn delays 0/70/90/130/170/190/210/250/300 | section wrappers carry the same delays (170/190 are the hidden day/week slots) |
| strings | `S` table = en values copied verbatim from `i18n/strings.ts` (incl. `dayLbl_*`, `moveDec_*`, `dayMorning*`, `dayOutlook*`, `budget*`, `onb_*`, `consent_*`) |

RN logic ported verbatim: `morningAnswers(series)` (3h sliding ≥2-valid), `decisionLine`
(en rebuild incl. `istLeft`/`modalBand`/`hi-lo` rules), `wireClockLabel`,
`compactHours`, `dayLabel`, `shortDate`, `fieldAgeLine` (1800s stale / 600s ok),
`doseTierIdx`, `doseUgRound`, `bandIdxForName`, `hexMix` wash/edge/ink math
(.90/.68/.60/.20), `formatHour` (IST), the `/v2/day`→`/grid` fallback
(`fetchDayCurve`, `CONF_RANK` worst-wins, `cell_epoch[1]` age).

Things the RN file owns that the web cannot (honest-empty, never faked):

- **on-device dose (daylog.ts)**: counted-day hero (dose µg + budget %), heroStatRow,
  heroWeekRow (7-bars), DayCard (hour arc + parts/spines), WeekStrip — the web has
  no dose ledger, so `thin=true` always → the sparse hero path (ambient number +
  arc + "your count starts once the phone logs its first hours"), exactly what RN
  shows before the first counted hours. Budget bar sits at 0.
- **checkinStreak/yday** — week-strip math needs 5+ days of ledger; hidden.
- **trips ledger door** — renders when a `ledger` screen is registered.
- **`cause_note_fields` rebuild** (`causeNote()`) not ported — the served
  `cause_note` line is shown verbatim (the RN no-fields fallback). Fields remain
  available in `/v2/city` if the coordinator wants full parity later.
- **lang hi** — settings store key exists; the web build is english-only today
  (toast on हिंदी tap). Every string in home/settings is en-only anyway.
- **mood wash + sparse-arc fill are gradients** — kept, because they're the RN
  pixels; "no gradients" applies to new ornament, not to the twin.

### SettingsScreen.tsx → `settings.js` / `settings.css`, `A.screen('settings')`

| RN | web |
|---|---|
| backdrop scrim + paper pane mt insets+8, r24 top, V2Elev.sheet | `.st-scrim` + `.st-root` |
| back chevron 44 + title "Settings" 17px semi | `.st-head` |
| vehicle card: 40×40 accentWash well + glyph + "My vehicle" + hint + "change" | reads `settings.vehicle` (falls back to `vehicle` store key); `vehicleGlyph()` substring map ported; change → `#/whereto` |
| Language & display: lang segs (ink fill) / Voice / Cigarette comparison / "distances in km" | `.st-segwrap`, `rowSwitch`, info row |
| Privacy & sharing: share switch + explain + status, "What we store" 7 bullets (5px dots), Delete my data (breath3) | `settings.share` key; all 7 `settingsStore*` strings verbatim; delete = confirm → wipe `alive.*` localStorage → reload |
| Notifications: blocked warn row, remind, morning alert, master alerts + 4 kinds (disabled-but-on = translucent accent) | `notifPerm()` via `Notification.permission`; arming a real surface requests the browser permission first (the web `armNotifs`) |
| About: Version "dev build", sources wind row, How numbers expander (+nearestTxt live), How ALive works, rate Alive (stars + note + send → `/v2/feedback`) | all present; nearestTxt fills from `/aqi.nearest_station_km` when the expander opens; rate posts `{stars, note, build:'web'}` |
| rows minH56 px16 py12 gap12, hairline mx16, card r20, single-open expander | `.st-row/.st-hair/.st-card`; chevron rotates 90° open |
| settings model | `DEFAULT_SETTINGS` — same keys/defaults as `components/shell/settings.ts`, shared store key `settings` with home.js |

Deviations:
- The four alert-kind rows arm prefs only — the web has no delivery agent yet,
  same as the earlier settings.js stub noted. The honest gate: arming asks for
  the browser Notification permission first.
- `home`/`work`/`vehicle` location picks live in whereto/search (RN routes there
  too) — rows keep only what RN shows on this screen.
- `confirm()` is the delete confirm (RN's is a styled modal; same words).

## verify log

`python3 -m http.server 8090` on a patched copy (`/tmp/webapp-verify`, index.html
+2 frozen lines above — never committed), Playwright chromium 390×844@2x:
all 5 onboarding pages, share→location page, home hero/incidents/doors/move/
outdoor-expand/checkin/budget, settings all four sections + expanders.
Zero console errors after fixes (`boot()` no longer throws on `#consent-yes`,
icons inject as real path arrays, switches are spans inside row buttons).
