# Mobile reality — verify-round on prod :267 (c4c7daa2)

Lane: acct2-mobile · Target: https://d2eh2l2ys9wkij.cloudfront.net/app/ · Rig: Playwright, iPhone emulation 390×844, DPR 3, touch, mobile Safari UA, Delhi geo stub.

## Verdicts — all 4 fixes ALIVE

| # | Was | Verdict | Evidence |
|---|-----|---------|----------|
| 1 | **P0** armed pin-drop dead | **FIXED — fully alive end-to-end** | `.wt-armed .sheet` computes `pointer-events:none` + `background:rgba(0,0,0,0)` transparent; `.sheet-body` `pointer-events:none`; `.wt-pinbar` stays `pointer-events:auto`. `elementsFromPoint(195,300)` now returns `CANVAS.maplibregl-canvas` on top (was `.sheet-body`). **Real `touchscreen.tap` at (195,300): pin dropped, strip disarmed, TO slot filled and reverse-geocoded to "14 Malka Ganj", plan computed → `.wt-go` enabled.** Shot: `v3-01-armed-tap` (post-drop plan state). |
| 2 | `.wt-th` 165×29.5 no pad | **FIXED — 173.1×41.5 effective** | `::after` pad `-6px -4px` present; eff h 41.5 ≥ 40. (`.wt-tdot`/`.wt-tarr` are decorative children inside the pill, not targets.) |
| 3 | `.wt-pinx` 28×28 no pad | **FIXED — 44×44 effective** | `::after` pad `-8px` on the armed-pin cancel ✕. `.wt-pinbar` itself 366×56.4. |
| 4 | shop icon malformed `d` | **FIXED — no console errors, glyphs render** | Shop-category results ("superstore / shopping / greengrocer / supermarket / shop / convenience" rows on `grocery store`): 8 glyph `<path>`s, 0 malformed, **0 `attribute d` / Expected-number console errors, 0 pageerrors**. Repaired `q-33 0-56.5 23.5T400-560` present in shipped whereto.js. |

## Fresh overlap pass on changed surfaces

armed-pin strip, post-drop plan, grocery results, plan with `.wt-th`: **0 text-on-text overlaps** in every state.

## New defects found en route

**None.** The full armed→drop→geocode→plan path, which was dead at :266, is now the smoothest flow in the app.

## VERIFIED CLEAN (unchanged from :266, spot-rechecked)

Sheet drag-dismiss still works post-fix (pinbar ✕ path + armed sheet no longer swallows drags — `pointer-events:none` only applies while `.wt-armed`, drag re-arms on exit). All :266 verified-fixed items hold: srow ellipsis/src, ≥40px pads elsewhere, 16/17px inputs, no chip clips.
