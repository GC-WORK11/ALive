# Mobile reality — re-audit on prod :266 (was :265 / a9e0ead0 → c93d8203)

Lane: acct2-mobile · Target: https://d2eh2l2ys9wkij.cloudfront.net/app/ · Rig: Playwright, iPhone emulation 390×844, DPR 3, touch, mobile Safari UA, Delhi geo stub. ~30 states walked across two full passes (onboarding → home → settings → ledger → purest +stay card → airmap +picker +armed pin → whereto → plan → journey → receipt).

## Verdict

**All five :264 P1 fixes verify FIXED live.** One **new P0** (armed pin-drop is dead — sheet eats map taps) and one new P1 sub-40 target. Ranking fix confirmed working: `sikanderpur metro` → "Sikanderpur Metro Station-Gate No 2" (Gurugram) is row #1 in both the whereto list and the airmap picker — counted as correct per coordinator note.

## Findings

| # | Sev | Finding | Repro / evidence |
|---|-----|---------|------------------|
| 1 | **P0** | **"Choose on map" (armed pin-drop) is uncompletable.** In armed mode the whereto `.sheet` stays 792px tall (y52–844), opaque (`rgb(250,250,247)`), `pointer-events:auto` — `elementsFromPoint(195,300)` returns `.sheet-body`+`.sheet` *above* `canvas.maplibregl-canvas`. Every map tap lands on the invisible sheet; `alive:maptap` never fires. Root cause: `motion.css:51` scopes the collapse to `.wt-armed .sheet[data-sheet-anim]` but the whereto sheet has **no `data-sheet-anim` attribute** (measured `null`), so `height:auto` never applies; nothing sets `pointer-events:none` either. Real `touchscreen.tap` at (195,300) and on the visible map band (195,60): pinbar stays armed, slots unchanged. Only escape = the 28×28 ✕. | whereto → "choose on map" → tap map anywhere → nothing. Shots: `v2-52-armed-pin`, `v2-53-pin-dropped` (pinbar still armed after tap). |
| 2 | **P1** | `.wt-th` from/to pills on the plan screen are **165×29.5px, no `::after` pad** — the only interactive element still under 40px. Re-opens slot search. | plan state after picking a destination. |
| 3 | **P1** | `.wt-pinx` (armed-pin cancel ✕) is **28×28, no pad** (`whereto.css:129`). Matters more now that it's the only way out of the broken armed state. | same armed-pin flow. |
| 4 | **P2** | Sheet-open transition still the jank heaviest surface: 56/130 frames >16.7ms (43%), avg 21.5ms, worst 66.6ms, longtasks 55/55/60/60ms. Same range as phase 1 — no regression, no improvement. | `#/purest` open, headless CPU-bound (upper bound). |
| 5 | **P2** | `.back-btn`/`‹` and `.x-btn`/`✕` on ledger measure scrollW 39 > clientW 36 — a 3px glyph-box overhang; screenshots show clean single glyphs (measurement artifact, noted not as a visual defect). | `v2-83-ledger`. |
| 6 | **P2** | `#loc-chip` is permanently hidden by design (`home.js:1271` comment: "the frozen #loc-chip stays hidden") — dead element still in DOM with `min-height:40px` CSS that never applies. Harmless. | any state. |

## P1-fix verification (all FIXED)

1. **srow name bleed — FIXED.** `.srow .n` computes `display:block; text-overflow:ellipsis` with `.srow > span{min-width:0}` + `.src{flex:none}` live. 13 real picker rows on `sikanderpur metro` + 10 on `india gate`: every name ends ≥100px before the `.src` tag, zero past-row overflows, zero src crossings (was 3 bleeds w/ hitB=9/9). Long names ("Sikanderpur Metro Station-Gate No 2") ellipsize inside the row. Whereto results moved to `.wt-row` — same class, clean. `v2-51-picker-metro`.
2. **≥40px effective targets — FIXED** (invisible `::after` pads, verified by computed effective rects, not just CSS presence): maplibre zoom ± 29px→**41×41** (−6px pad), attrib btn 24→**40×40** (−8), attrib links 41/85×14→**×40h** (−13/−4), `.wt-bbtn`/`.wt-x` 34→**40×40** (−3), `.wt-vchip` 169×34→**181×40** (−3/−6), `.onb-skip` 28.7×32.3→**44.7×42.3** (−5/−8), `.onb-loclater` 74.7×40.3→**86.7×48.3** (−4/−6). Already-big: `.jn-close` 44, `#hs-menu` 42, `#hs-cta` 350×56, `.st-*` rows 358×56–64, `.st-seg` 53/74×40, `.wt-abtn` 194×48, `.wt-go` 358×48, `.jr-done` 330×48, `.am-place` 354×43, `.wt-rrow` 362×48, `.onb-choicebtn` 334×84.5, `.onb-locbtn` 334×64. **Residual: `.wt-th`, `.wt-pinx` (findings 2–3).**
3. **Inputs ≥16px — FIXED.** `input.wt-input` computes **17px**; airmap/purest picker `.searchbar input` **16px**. No iOS auto-zoom trigger.
4. **Mid-glyph chip clips — FIXED.** The old `.vrow` scroll-strip is gone; plan uses stacked `.wt-opt` cards. `.wt-tt` slot pills truncate via real ellipsis ("Domino's Pizza | Huda…" ends with …, not a cut glyph). `.wt-vchip` unclipped.
5. **Drag-dismiss on every sheet — FIXED.** `touchDrag` 430px pull: ledger→CLOSED, purest→CLOSED, airmap→CLOSED, airmap-picker→CLOSED, whereto-plan→CLOSED, receipt via `.jr-head`→CLOSED. `.sheet-grab::before` = 140×44 invisible pad; `motion.js` velocity-follow drag (`bindDrag` on GRAB ∪ HEAD zones, flick-threshold 0.45px/ms or 42% travel). Detent pins (`.am-host 58%`, `.pm-host 62%`) confirmed present.

## Rect-intersection pass (post-parity-fix, 24 states)

| Screen | states | text-on-text | notes |
|--------|--------|--------------|-------|
| onboarding | 3 | 0 | OC 3–4 = card-over-map layering (expected, like old consent) |
| home top+bottom | 2 | 0 | clean both scrolls |
| settings top+bottom | 2 | 0 | 11 "smallTap" entries = padded maplibre ctrls + non-interactive spans/icons — clean |
| ledger top+bottom | 2 | 0 | only the 3px glyph overhang (finding 5) |
| purest top/bottom/stay card | 3 | 0 | OC on scrolled state = clipped-offscreen rows under sheet (invisible) |
| airmap main/bottom/point/attrib/picker | 5 | 0 real | 2 pairs = `.dt-heronum`/`µg` line-box touching `.dt-herofelt` top by 4px — **visually verified clean** (empty line-box space, glyphs well separated in `hero-crop`) |
| whereto search/results/plan/armed | 5 | 0 | transient 2-pair flag during sheet-settle animation once; settled = 0 |
| journey + receipt | 2 | 0 | `#mark` no longer collides with close (`body[data-top=journey] #mark{display:none}` works) |

## Jank (rAF deltas + longtasks; headless = upper bound)

| Gesture | frames | >16.7ms | avg | worst | longtasks |
|---------|--------|---------|-----|-------|-----------|
| airmap pan ×3 | 172 | 90 (all ≤16.8ms — marginal band) | 16.7 | 16.8 | [] |
| sheet open (#/purest) | 130 | 56 (43%) | 21.5 | 66.6 | 55,55,60,60 |
| purest scroll | 114 | 30 (26%) | 19.3 | 33.4 | [] |

Map pan is effectively smooth now (worst frame 16.8ms — phase 1 worst was 66.7 with 63ms longtasks). Sheet-open transition remains the heavy surface.

## VERIFIED CLEAN

Onboarding 5-page flow (next/skip/choice/loc-ask) — all taps ≥40 eff incl. skip+later via pads; home feed scroll + doors; settings incl. seg switches; ledger scroll; purest rows + stay card + `.pm-x`; airmap detent + point-read; armed-pin entry strip + ✕ cancel path; plan option cards + `.wt-go` disabled-until-plan gating; journey `.jn-close` 44px; receipt `.jr-done` + head-drag dismiss; attribution open state; every settling-state overlap = 0.

Proof shots (in `~/work/mobile-lane/shots/`): `v2-51-picker-metro`, `v2-52/53-armed-pin*`, `v2-70-plan`, `v2-85-journey`, `v2-86/87-receipt*`, `v2-82-settings`, `v2-83/84-ledger*`.
