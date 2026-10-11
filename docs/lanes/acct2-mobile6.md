# acct2-mobile6 — :274 re-sweep (build 3a7f2000)

Mobile-reality lane, prod :274, live `build_sha = 3a7f2000` (/health).
iPhone emulation 390×844, DPR 3, touch, Safari UA17, Delhi geo stub.
Shots: `docs/lanes/acct2-mobile6-shots/`.

## Verdicts on the four asks

### 1. Whereto inline composer — WORKS, one P2 nit

- `.wt-rrow` renders as tappable button rows ("from · Your location" / "To · Where to?"); **'to' is armed by default** on open (`.wt-rrow.on.edit` + focused `.wt-rin`). `s6-whereto-armed.png`.
- **Row tap arms**: tapping the `from` button row moves the edit state + `.wt-rin` into it (`from` → `wt-rrow on edit`, `to` → back to button). Verified both directions. `s6b-from-armed.png`.
- **Typing edits in-row**; `.wt-rx` × appears once text exists.
- **First-letter typeahead**: fresh install 'h' → 0 rows is CORRECT (local tier = saved+recents only, both empty). With a seeded recent: 'h' → "HUDA City Centre Metro Station · 18 km" painted at 300ms. `s6b-1char.png`.
- **Results near-first**: 'huda city centre' → HUDA metro 18km #1, same-name group sorted ascending by dist. `s6-whereto-results.png`.
- **Enter picks top place row** → 'to' filled, plan rendered. `s6-whereto-picked.png`.
- **locate** fills the armed slot → "Your location" → plan. `s6b-locate.png`.
- **pin-drop**: armed 'to' → "Choose on map" → pinbar over live map → tap (195,300) → 'to' = "Malka Ganj" → plan. `s6c-armed.png`, `s6c-pindrop.png`.
- OV=0 on every composer state.

**P2 — ghost × on the cleared field**: `[data-act="clear"]` tap empties `.wt-rin` via `input.value=''`, which doesn't fire the `input` event that re-hides the button → the × stays rendered over the empty input (placeholder ghost of the picked value). `hidden:false`, visible at [334,…]. Dead control. `s6c-ghostx.png`. Fix: set `x.hidden = true` in the clear handler (whereto.js:~648).

### 2. Home hero provenance line — VERIFIED, both states

- Geo on: `.hs-prov` = "from SPM-SPC Talkatora Garden · 1.7 km away · read 1 min ago", rendered directly under the ambient read at [22,472]. `s6-home-top.png`.
- Geo off (denied permission, skipped loc step): hero falls back to "the air near central Delhi" and the line honestly says "location is off or hasn't locked yet — turn it on for the air where you actually are · read 4 min ago". `s6c-home-geoOff.png`.

### 3. `.am-read` — FIXED

Measured rect **[73, 64, 244, 61]** — compact top card (was 760px slab). Computed `top:64px`, `bottom` now content-driven (airmap.css:29 `bottom:auto` shipped). `rgba(255,255,255,.86)` is fine at this size. `.amr-x` effective **42×41** via `-11px -9px -11px -11px` pad; closes the card. `s6c-airmap-point.png`.

### 4. Budget card — CLEAN

`.hs-budgetbar` + `.hs-budgetfill` + `.hs-budgetline` + `.hs-fine` only — zero toggle pills on the card. `s6-home-budget.png`.

## New defects this build

| # | sev | what | where |
|---|-----|------|-------|
| 1 | P2 | ghost × stays rendered after clearing `.wt-rin` | whereto composer, `s6c-ghostx.png` |
| 2 | P3 | dropped-pin badge occludes a base-map label ("Sahibi river") | airmap point state — inherent map layering, audit noise only |

## Ruled out (third build running)

- `wt-dim × wt-dist` (search rows): measured hOverlap −82…−215px, vertical 9px line-box pad — no collision. Permanent false positive of the rect pass; ignoring.
- `hs-lenspill` small pills found on home are the week-strip day lenses, not budget toggles.

## VERIFIED CLEAN

OV/OC = 0 on: home top/budget, whereto (initial/armed/results/picked/1char/from-armed/locate/armed-map/pindrop), airmap point, geoOff home. No text-on-text, no clipped text beyond intended ellipsis, no floating-card regressions. The :272 `.am-read` slab is dead; every composer promise (arm/type/Enter/clear/locate/pin) delivers.
