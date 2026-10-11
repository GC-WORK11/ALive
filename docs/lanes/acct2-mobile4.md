# Mobile reality — verify-round on prod :269 (c5d66e11, confirmed via /health build_sha)

Lane: acct2-mobile · Target: https://d2eh2l2ys9wkij.cloudfront.net/app/ · Rig: Playwright, iPhone emulation 390×844, DPR 3, touch, mobile Safari UA, Delhi geo stub. 21 states walked + string dump of every visible text node per screen.

## Job 1 — Esc unarm + will-change: PASS

- **Esc #1 while armed**: `.wt-armed` removed, `.wt-pinbar` gone, `.sheet.on` visible again, `data-top` stays `whereto` — unarms back to the sheet, does NOT pop the screen. ✓ (`v4-01-after-esc1`)
- **Esc #2**: closes whereto → `data-top:home`. Acceptable second-Esc close. ✓ (`v4-02-after-esc2`)
- **will-change**: sheet computes `will-change: transform` — hint present, no regression. Armed sheet `pointer-events:none` + transparent still holds from :267 (re-probed during armed flow).

## Job 2 — jank (rAF deltas + longtasks; headless = upper bound)

| Gesture | frames | >16.7ms | avg | worst | p95 | longtasks |
|---------|--------|---------|-----|-------|-----|-----------|
| sheet open (#/airmap) | 79 | 29 (37%) | 19.0 | **50.0** | 33.4 | **[]** |
| sheet close (grab pull) | 216 | 76 (35%) | 17.4 | 33.4 | 16.8 | [] |
| sheet drag-follow | 303 | 99 (33%, all ≤16.8) | 16.7 | 16.8 | 16.7 | [] |

vs :266: open worst 66.6→50.0ms, longtasks 4×55–60ms→**zero**; drag-follow essentially frame-locked (worst 16.8). Sheet animation regressed nothing — it improved.

## Job 3 — copy audit (every visible string, 21 states)

**Overall: the copy is honest, sourced, and plain.** Good marks: WHO math shown openly ("15 µg/m³ × ~14.4 m³ a day"), "satellite estimate only" on faded days, "real events only, checked while the app is open", station counts match `/health` (52 live stations = 52 up), "same air = AQI 133 on other apps" translation, "a street appears only after N devices cross it" privacy mechanism, "measured, not reported" consistent with FIRMS field age ~3min. No cringe tier: taglines stay factual ("You can't see it. You still breathe it."), no emoji-garish or ad-copy voice.

### Copy findings

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| C1 | **P2** | **"0 µg/m³ lighter than now"** — go-out card renders an empty benefit as a claim when the cleanest window ≈ current air ("cleanest window 10:30-16:30 today, ~48 µg/m³ avg — 0 µg/m³ lighter than now"). Reads broken; should say "≈same as now" or hide the delta. | airmap go-out card, live DOM |
| C2 | **P2** | **"…inhaled today within the WHO daily limit"** sits under a **775 µg** hero number — but the app's own suggested daily line is **216 µg** ("216 µg left of the suggested 216 µg line"), derived from WHO 15µg/m³×14.4m³. 775 is **3.6× over** that line; the phrase either claims the dose is within-limit (false) or is parse-ambiguous. Separately, the hero "dose" is clearly an ambient-breathing estimate (~50µg/m³×14.4m³≈720-775), yet the home dose card shows 216/216 left (0 used) — the same "µg inhaled today" concept shows two different numbers on two screens with no distinction. | airmap hero `.dt-herofelt` vs home dose card |
| C3 | **P2** | **"dev build"** — Settings → About → Version on production `/app/`. Either the label is stale or a flag leaked. | settings screen |
| C4 | P3 nit | "the move" — home section heading; cryptic label for the trips/doors area. "air answers" in whereto similar but more legible. | home feed |
| C5 | P3 nit | Result-name casing from provider data renders raw: "HUDA City Centre Metro Station", "Macdonald huda", "Collection O" (OYO brand fragment). Data-quality, not copywriting — mention only. | whereto results |

### Clean pass — no jargon/cringe/lies found in

Onboarding pages 1–5, home feed + all sections (check-in card, dose card, doors, forecast), settings incl. notifications/alert rows, ledger empty state, purest + stay card, airmap hero/go-out/12h bars/pollutant table/52-station footer, whereto search/results/plan/armed strip, Esc flows.

## New mobile-UX defects found en route

**None.** Armed→drop→geocode→plan still smooth; Esc path behaves; sheet open/close/drag all improved or held.

## VERIFIED CLEAN summary (:269)

Esc-unarm exact spec ✓ · will-change on sheet ✓ · zero longtasks on sheet lifecycle ✓ · armed-sheet pe:none preserved ✓ · all :267 verdicts hold ✓.
