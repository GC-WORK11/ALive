# acct2 — twin re-regression :265→:266

Lane: acct2 (testing) · target `https://d2eh2l2ys9wkij.cloudfront.net/app/`
Builds exercised: started on **a9e0ead0 (:265)**, re-verified on **c93d8203 (:266)** — `/health.build_sha` confirmed both.
Harness: Playwright + headless Chromium @ 390×844, Delhi geo mocked (`/Users/devin/alivetest`, logs `p4..p9c.log`, shots `shots/`).

Coordinator exclusion (do NOT report): the four search-ranking fixes — `sikanderpur metro`, `terminal 1`, `terminal 2`, `delhi airport t1` — verified behaving as announced, excluded.

## Fix verification — 7/7 DEAD

| # | Fix | Verdict | Evidence |
|---|-----|---------|----------|
| 01 | pick-mode map tappable + exit | **PASS** | Seeded `alive.consent='"picked"'`, `alive.onboarded=true`, cleared `alive.pos` → canvas tap wrote `alive.pos {lat:28.5608,lon:77.2089,picked:true}` → home rendered. `p4.log`, `shots/fx01-*.png` |
| 02 | option cards `N min` + real arrive | **PASS** | 17 options, e.g. `8 min · 4.3 km left · arrive 10:07 am` on journey card; cards show `arrive 10:07 am`/`10:08 am` (real `eta_s`). `p4.log`, `p8.log` |
| 03 | go-out pick no TypeError | **PASS** | "when to go out" door row → "air around me" surface (DelhiToday hero + AirMapCard legend, 52 stations). Zero pageerrors/console errors. `p7.log`, `shots/f7-goout*.png` |
| 04 | Settings My vehicle = wizard choice | **PASS** | Wizard car+petrol+year → done "before 2010 petrol car" → plan chip; Settings row reads `car · estimates run on this · change`. `p6.log`, `shots/f6-settings.png`, `fx04-settings.png` |
| 05 | no favicon 404 | **PASS** | Full re-walk network log: zero favicon requests/404s (`badReqs:[]`). `p8.log` |
| 06 | `/v2/reverse` 200 | **PASS** | 7/7 calls → 200 across plan/map/pin flows. `p8.log` |
| 07 | drag-dismiss works | **PASS** | Sheet drag top→down removes `.sheet.on`; escape from armed states intact. `p4.log`, `shots/fx07-afterdrag.png` |

## Prior acct2 defects — re-checked

- **P0 Esc-journey wedge — FIXED.** Esc×2 mid-journey: first opens `.jn-confirm` ("end this ride?"), second dismisses it; `.jn` persists, `wedged? false`. No bare map, no lost UI. `p8.log`, `shots/f8-esc1/2.png`
- **P1 Esc-on-receipt double-pop — FIXED.** Journey → `.jn-close` → `.jn-yes` → `.jr-sheet.on` receipt → single Esc → lands exactly one step back on whereto plan (`.wt-opt` live, `hero:false`). `p9b.log`, `shots/f9b-escreceipt.png`
- Receipt path end-to-end clean: early-end receipt renders "ended before it really started / under 100 m — nothing counted / done"; `.jr-done` returns to plan. `shots/f9-confirm.png`, `f9-receipt.png`
- Wire-form leak (parity BUG 11): options now read "least smoky option 1/2" — fixed.

## Regression re-walk

Full journey (search→plan→17 options→start→turn-by-turn→confirm→receipt→done→plan), second journey + Esc torture, armed pin-drop, airmap paint/readout, purest, settings, all hash-route refreshes, cold deep-links, `/v2/reverse`, favicon — all clean except:

### DEFECT (new, P2) — malformed `shop` icon path: console errors + blank glyph
- Repro: any search result row whose category maps `shop|market|store|bazaar|retail` → `ic('shop')` emits `d="…T480-800q-33-23.5-56.5T480-720ZM240-160…"`.
- Actual: `Error: <path> attribute d: Expected number` ×3 on a single run (p8, `connaught place`/`noida sector 18` rows); icon renders empty.
- Expected: valid path, no console error, visible glyph.
- Root (read-only): `server/webapp/whereto.js:140` — `shop:` path has `q-33-23.5-56.5` (relative quadratic needs 4 coords, has 3).
- Evidence: `p8.log` error tail; source line above.

### Notes (not defects)
- Repeated WebGL `GPU stall due to ReadPixels` warnings — headless-Chromium artifact, seen before, ignored.
- Earlier `0 km` option-meta artifact not reproduced on :266 (17 opts, `0km:0`).

## Totals
Fixes verified dead: **7/7** · prior wedge/double-pop: **2/2 dead** · new defects: **1 P2** · coordinator-excluded ranking fixes: verified, not counted.
