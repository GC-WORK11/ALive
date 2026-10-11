# pixel report — 390×844 mobile pass (+1440px desktop spot-checks)

lane: pixel-ruthless mobile pass, REAL defects only
run: local `python3 -m http.server 8090` → `?api=https://d2eh2l2ys9wkij.cloudfront.net` (prod API, live data)
method: Chrome device emulation, full walk: consent → drop-a-pin → home → whereto (search "ISKCON east of kailash", modes + vehicles) → journey preview → receipt → airmap → purest. Every finding below was reproduced live before a fix was made.

## verdicts

| screen | verdict |
|---|---|
| home | 1 defect fixed (gap taps dead) — otherwise clean |
| whereto | 5 defects fixed — the pass's hotspot |
| journey | clean — preview, HUD, receipt all fit and function at 390px and 1440px |
| airmap | 1 defect fixed — otherwise clean |
| purest | 1 defect fixed — otherwise clean |
| search.js | no defects |

## defects found + fixed

1. **armed pin-drop unreachable on mobile (whereto)** — real, severe. Choosing "drop a pin on the map" armed the tap but restored the near-full sheet, leaving only ~52px of map to aim at. Fix: arming now folds the sheet (`wt-armed`) into a bottom hint strip — "tap the map where it ends/starts", "the sheet is folded away — the whole map is yours", and a "back to the search" link that un-arms. Verified both fields on mobile + desktop rail: fold → tap → sheet restores → "dropped pin" → resolves to a real name → plans.
2. **no way back from search (whereto, airmap)** — the picker/search surface replaced the whole sheet body with no return except closing the screen. purest already had "back to the rankings"; whereto now has "back to the trip", airmap "back to the air map". Verified: returns to main view with state intact.
3. **bare map after journey → done (whereto)** — journey's mount hid every `route-*` layer; landing back on whereto showed option cards promising routes that were gone. Fix: whereto now implements the screen `show()` hook → repaints when `state.plan` exists. Verified: 12 `route-wtN` layers back after "done".
4. **purest map-area taps dead** — `m.on('click', AREA_FILL, ...)` was gated on `m.getLayer(AREA_FILL)` at bind time, but the layer is painted async after `/v2/districts` resolves → handler never bound. Maplibre evaluates layer filters at click time, so the bind is now unconditional. Verified: tap inside a Meerut fill opens the env card (44 µg/m³ · 24h strip · station 46.7 km).
5. **orphan route lines when options shrink (whereto)** — `paintRoutes` only touched ids for the current `shown`; shrinking 4 options → 2 (car → bus) left `wt2`/`wt3` painted forever. Fix: track `state.painted`, hide ids ≥ shown.length before refit. Verified: bus switch leaves exactly the served lines.
6. **"to" label under the swap disc (whereto)** — `.wt-swap` sits absolutely at right:14px and the label ran beneath it; a long place name clipped behind the disc. Fix: `.wt-swap-row .wt-row-label { padding-right:38px }` → truncates clear of it. Verified at 390px.
7. **gap taps dead on home** — `.home-panel` filled the bottom strip; taps in its gaps (between air card and door grid, between doors) hit the invisible flex container instead of the map. Fix: `.home-panel { pointer-events:none }`, `.home-panel > * { pointer-events:auto }`. Verified: gap tap logs a map click and moves the picked pin.
8. **regression found by verify pass → fixed** — "back to the trip" rebuilt `.wt-results` empty (this wipe predates the lane via the old pin-drop `backTo` path, but was unreachable often enough to go unnoticed). Fix: `renderMain()` tail-calls `renderOptions()` when `state.plan` exists; `state.sel` survives so the selected card keeps its border. Verified.

## also changed (same commit)

- **desktop `fit` asymmetric padding** — selected routes could slide under the 460px right rail; `A.map.fit` now uses `{left:60, right:500, top:70, bottom:70}` on ≥720px (mobile keeps 110). Same pixels touched by fix 5 — included to stop a real overlap.
- **escape server/user strings** — whereto injected `label`, `via_names`, `reason_line`, `tag`, search `name`/`sub`/`source` into `innerHTML` raw. Any `&`/`<` in a served string would corrupt layout (real: "Fashion & Lifestyle" style names exist in the corpus). Added the local `esc()` helper and applied it where HTML is built — not a style change, honest data only.
- **`.opt .strip:empty { display:none }`** — an option with no `segments` rendered a phantom empty bar under the card.

## checked and clean (honest non-defects)

- **steel-blue square in the airmap choropleth** — suspected null-band fallback; it's a genuine band-0 (good-air) cell `#6E93AE` at low-confidence opacity surrounded by sandy band-1 cells. Data, not a bug.
- **vehicle chips overflow at 390px** — "bus" clips off the right edge but the row scrolls; intentional dense row, not a defect.
- **option-card width, label ellipsis, instant-end empty dose graph** — all probed and found correct.
- **journey full path** — preview sim, HUD (eta/dist/road/dose/fabs), receipt stats + dose graph + WHO-day verdict, "plan the way back" swap, done → all clean.
- **home card** — skeleton → real load, field-age/station freshness lines, polling, re-entry — clean.
- **airmap go-out card + tap-read, purest district rows + stays + picker back-row + env card** — clean.
- **consent flow** — grant/pick/deny paths, capture-phase listener — clean.

## defects seen but not fixed

- **`.sheet` desktop rail reaches top:0 under the header chrome (frozen `app.css`)** — cosmetic: on ≥720px the sheet is a full-height right rail while `#loc-chip`/`#aem-title` float top-left; no overlap observed, only a slight margin asymmetry vs the mobile `top: calc(52px + sat)`. Not touching frozen files. Low priority; if wanted, a `top` value on the desktop `.sheet` media block in app.css is the fix.
- **whereto drop-pin hint copy is the same for both fields at first glance** — text does switch ("this trip starts" vs "it ends"); just noting it's one word apart if a quick scan misses it.

## risks / notes for the lead

- Verification screenshots exist for every fix; ask if you want them attached.
- `.wt-armed` lives on the screen element; if you ever refactor the sheet host, keep the class contract (`wt-armed` → fold).
- `state.painted` counts painted `wtN` ids; `hideAllRoutes()` callers now reset it — the counter is local to whereto only.
