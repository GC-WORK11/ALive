# acct2 parity audit — webapp twin vs Android app (prod)

**Lane:** acct2-parity · **Target:** https://d2eh2l2ys9wkij.cloudfront.net/app/ @ 390×844 (Delhi geo mocked)
**Reference:** `Mobile/src/screens/{OnboardingScreen,HomeScreen,SearchScreen,VehicleSheet,SettingsScreen}.tsx` + `Mobile/src/theme.ts` + `i18n/strings.ts` (repo HEAD — prod verified byte-identical to `server/webapp/*` at HEAD)
**Method:** Playwright/Chromium real-user walk of every surface; DOM+computed-style dumps; verbatim string/shape diff vs RN source. Logs `alivetest/p1.log p2.log p3.log`; shots `alivetest/shots/pb-*.png`.

## Totals: 11 mismatches (6 P1, 5 P2)

---

## ONBOARDING — 5 mismatches

**PARITY-BUG 1 — missing `~` on the ambient air number (P2)**
- RN: `OnboardingScreen.tsx:265` renders `~{Math.round(ambientUg)}`.
- Web: `home.js:837` renders `{Math.round(ambientUg)}` — prod shows **"50"**, no tilde.
- Shot: `pb-onb-0.png`. Everything else on p0 matches (eyebrow "delhi · right now", µg/m³, band word, "You can't see it. You still breathe it.").

**PARITY-BUG 2 — k-anonymity card reads "3", RN reads "3+" (P2)**
- RN: `OnboardingScreen.tsx:331` → literal `3+`.
- Web: `home.js` `onb-knum` → **"3"** (prod DOM verified).
- Shot: `pb-onb-2.png`.

**PARITY-BUG 3 — live "Next" button on the consent-choice page (P1)**
- RN: `step < STEP_CHOICE` gates Next (`OnboardingScreen.tsx`) — pages 3 & 4 show a ghost; the choice is the only way forward, so nobody opts into upload by walking past the question.
- Web: `home.js:867` renders Next when `page < ONB_PAGES - 1` → page 3 has a **working Next** (prod DOM, `p1.log:125`). Tapping it advances to page 4 with the sharing question unanswered — and `share` stays at `SETTINGS_DEFAULTS.share = true`, i.e. **upload-on by default**.
- Shot: `pb-onb-3.png` (shows Next next to the 4th dot on the choice page).

**PARITY-BUG 4 — "Skip" doesn't persist sharing off or ask location (P1)**
- RN: skip calls `finish(askLocation=true)` → persists `sharing ?? "off"` and fires the OS location prompt (`OnboardingScreen.tsx`).
- Web: `home.js:889` skip handler = `A.store.set('onboarded',1); consentEl.hidden = true` — nothing is persisted, `geo.consent` stays `null`, `share` stays default `true`, and no location ask happens. On web, Skip = "uploads on, no location, done"; on RN, Skip = "sharing off, location asked".
- Same root as BUG 3 (the web consent page can never write share=false), different element → counted separately.

**PARITY-BUG 5 — no horizontal swipe paging (P2)**
- RN: `OnboardingScreen.tsx:197` PanResponder — `dx < -48` flips forward (stops at the choice), swipe-back allowed.
- Web: `home.js:881-895` wires a **click-only** listener — no touch/swipe handlers. Buttons work, pages don't swipe.

## HOME — 2 mismatches (both acknowledged can't-do in `home.js` header, still element-for-element gaps)

**PARITY-BUG 6 — "your day" card absent (P1)**
- RN mounts `DayCard` (title `dayTitle` "your day") at delay 170 whenever `data && !data.rec.thin` (`HomeScreen.tsx` ~1580).
- Web: no such section; `home.js` mounts hero@0, incidents@70, doors@90, move@130, **skips 170/190**, outlook@210, lens@250, budget@300.

**PARITY-BUG 7 — "your lungs' calendar" week strip + heroWeekRow absent (P1)**
- RN mounts `WeekStrip` (`weekTitle` "your lungs' calendar") at delay 190 whenever `data` exists, plus the `heroWeekRow` inside the hero.
- Web: neither exists. `home.js` header documents this as can't-do (no on-device daylog); recorded as a gap, not negligence.

**Otherwise PARITY OK:** card order hero → incidents → doors(3 rows: Air map / Delhi today / Trips, same glyphs+keys) → the move → the days ahead (5 cells) → how you felt → a suggested daily limit; hero number 132px/ls -6/Satoshi 300 (RN `heroNum` identical); bg #FAFAF7, text #16181D; `.hcard` radius 24 = RN `ss.card` 24; CTA ink pill 56px/999; all verbatim strings (eyebrow "the air around you", "PM2.5 dust per m³ of air · same air = AQI {a} on other apps", "{x}× the WHO daily limit", prov line, "· measured, not reported", prog label, move lines, noteline, lens rows+verdict, budget line+profiles+fine print).

## WHERETO — 4 mismatches

**PARITY-BUG 8 — from-row placeholder "your spot…" vs "Where from?" (P2)**
- RN: `SearchScreen.tsx:731` → `fromLabel ?? t("searchFromPlaceholder")` = "Where from?" (`strings.ts:7`).
- Web: `whereto.js:443` → `S.from ? S.from.label : t('yourSpot')` = **"your spot…"** (`whereto.js:27`). Verified: prod shows "Your location" once set — only the empty state differs.
- Shot: `pb-wt-1.png`.

**PARITY-BUG 9 — typed air/stay queries show the static door pair instead of intent rows (P1)**
- RN (`SearchScreen.tsx:638-677`): typed air-intent → row **"the air map · near you"** (leaf glyph, `airIntentTitle`); typed stay/play-intent → single row titled `exploreStays` "stays — lightest air first" or `explorePlay` "when's the air lightest to play", sub `exploreNearYou` "near you"/`exploreNearPlace`.
- Web (`whereto.js:419`): `AIR_RE.test(S.q) || STAY_RE.test(S.q)` → `doorRows()` emits the **untyped static pair** ("where to stay" + "when to go out" with their empty-state subs) for either intent — never the air-map row, never the typed titles. Web's `airIntentTitle` (`whereto.js:42`) is defined but **dead — never emitted**.
- User-visible: typing "air"/"aqi" gives no air-map door; typing "stay" shows a second wrong row.

**PARITY-BUG 10 — quiet hint sits below the "air answers" rows, RN puts it above (P2)**
- RN (`SearchScreen.tsx:595-607`): saved → recents → **Quiet hint** → "air answers" header → stays/play rows.
- Web (`whereto.js:408-414`): saved → recents → **"air answers" header → rows → quiet hint**. Prod dump (`p2.log:20-38`) confirms hint lands under the doors.

**PARITY-BUG 11 — wire-form leak in plan option qualifiers (P1 voice)**
- RN translates the wire suffixes: `mode_leastSmoke` = " · least smoky way", `mode_leastSmokeAlt` = " · least smoky option {n}" (`strings.ts:65-66, 2501-2507`).
- Web prints the raw wire strings on every alternate option: **"· least-smoke rd"**, **"· least-smoke alt 1"**, **"· least-smoke alt 2"** — 8 rows on the prod plan (`p3.log`). Deliberately-translated voice leaking as machine text.
- Shot: `pb-wt-plan.png`.

**Otherwise PARITY OK:** route card (from/To keys, "Your location", "Where to?" ph, on-arm), search bar (back+input+clear), empty state (saved gating, recents ≤5, hint text verbatim), "Results" hairline cascade, bottom bar "Your location | Choose on map", trip header swap, plan rows (dose ≈N µg A–B, km · arrive, deltas, felt ~N× lines, chips "lightest for you"/"lightest for Delhi", reason lines), foot "a typical Delhi ride" chip + "start journey".

## VEHICLE STEP — PARITY OK (0 mismatches)
Intro ("before you pick" + body + honest + "tell us what you're taking" + "skip — a typical Delhi ride works"), step titles ("What are you taking?" / "Fuel?" / "Roughly when was it bought?" / "PUC certificate (optional)"), why-line, dots, 3 groups ("your own" car/auto/bike — "shared" bus/metro — "no engine" cycle/on foot) with verbatim caps, back+skip footers, done "got it — estimates now use your ride." — all verbatim (`p3.log`, `pb-veh-*.png`).

## SETTINGS — PARITY OK (0 mismatches)
My vehicle → Language & display (English/हिंदी seg, Voice, Cigarette comparison, "distances in km — metric only") → Privacy & sharing ("Share anonymous trip data" + "on — one tap to stop anytime" + What we store + Delete my data) → Notifications (blocked-hint row + clean-window pings + Morning air alert + Air alerts master + smoke & fires / air turning worse / clean windows / your day on the road) → About (Version "dev build", data-sources line, How numbers are estimated, How ALive works, rate Alive w/ stars+note+send). All rows/hints verbatim (`pb-set-1.png`).

## AIRMAP — PARITY OK (0 mismatches)
Floating legend card = RN `AirMapCard` verbatim ("the air map" / "redder = worse air right now" / stations / band scale); sheet = DelhiToday surface ("a day of Delhi air" hero, "planning to go out" + place picker + 24h bars + bestworst + species grid PM10/NO₂/O₃/CO/SO₂/US AQI + "the next 12 hours" + own-empty "no trips yet — go live your day, we'll count it here" + "why this is an estimate"). (`pb-am-1.png`, `p3.log`.)

## LEDGER — PARITY OK (0 mismatches)
Empty state verbatim: badge + "no trips yet" + "finish a trip and its smoke numbers land here" + "trips stay on your phone". (`pb-lg-1.png`.)

## Web-only elements (no RN counterpart)
- `#loc-chip` — rendered but intentionally hidden (home.js comment); ambient line shows the same info. Not flagged.
- `.hs-mood` — ambient wash layer behind home; RN has its own ambient layer (`HomeScreen` mood). Equivalent, not extra.
- No other rendered web element lacked an RN counterpart — every button/row traced to an RN element.

## Severity rollup
- **P1 (6):** BUG 3 (consent-page Next bypasses the choice, uploads default-on), BUG 4 (Skip writes nothing — share on, no location ask), BUG 6 (DayCard absent), BUG 7 (WeekStrip absent), BUG 9 (typed intent rows wrong — air-map door unreachable via query), BUG 11 (wire-form qualifiers).
- **P2 (5):** BUG 1 (`~`), BUG 2 (`3+`), BUG 5 (swipe), BUG 8 ("your spot…"), BUG 10 (hint order).
- Count = 11.
