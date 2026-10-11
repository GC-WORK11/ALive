# acct2-mobile5 — :272 overlap + "card everywhere" sweep (build 9bf64497)

Mobile-reality lane, prod :272 rolling deploy, live `build_sha = 9bf64497` (/health).
iPhone 12/13/14 emulation: 390×844, DPR 3, touch, Safari UA17, Delhi geo stub.
Method: playwright walk of all 21 states + programmatic rect-intersection pass + a
dedicated dark-card DOM scan (every element with computed bg luminance ≤90 dumped
with rect + text). Shots: `docs/lanes/acct2-mobile5-shots/`.

## Findings

### 1. P0 — `.am-read` point-read card is a 760px frosted slab covering the whole screen — THE "card that came everywhere"

Tap any station/point on airmap → the point card renders as a
`position:fixed` panel at **rect [73, 64, 244, 760]** — i.e. it stretches from
64px below the top to 20px above the bottom across the entire screen. It carries
`background: rgba(255,255,255,.86)` so every layer beneath bleeds through:
"air around me" title, "a day of Delhi air", the 774µg hero, "the air outside —
satisfactory", "why this is an estimate" — all readable *through* the card,
text-on-text, everywhere. The card's own content is two lines at the top:
`56 µg/m³ — satisfactory / near Delhi University Students Union` — PM2.5 +
locality, matching the owner's report (this is the only card on any screen that
carries PM2.5 + locality; there is no dark PM2.5 card — the only dark-bg
elements anywhere are the legit black CTAs: Where-to pill, Next, done,
start journey).

Root cause (found in repo): two competing `.am-read` rules —

- `server/webapp/app.css:227` `.am-read { position: fixed; …; bottom: calc(20px + var(--sab)); … }` (legacy scaffold rule, `background: var(--surface)`)
- `server/webapp/airmap.css:29` `.am-read { position: fixed; top: calc(64px + var(--sat)); … }` (new top card, `background: rgba(255,255,255,.86)`)

Both sheets load (index.html:10,16). airmap.css wins on `top` + `background`
but never clears `bottom` → **computed: top 64px, bottom 20px, height 760px**
(measured via getComputedStyle — exact match for the rect). The fix is one line:
`bottom: auto` in the airmap rule (or delete the dead app.css block).

Persistence verified: identical at 1.6s and 3.5s after tap, and still present
after a second snapshot — not an animation frame. z-index 40, pointer-events
auto, sits above the sheet.

Repro: airmap → tap any station dot (e.g. 195,260) → frosted slab + bleed.
Proof: `s5-airmap-point.png`, `s5b-airmap-point.png`, `s5b-airmap-after-close.png`.
Programmatic: `elementsFromPoint(200,{400,700})` → `.am-read` on top of
`.dt-heroref`, `.dt-hero`, `.sheet-body`, `.sheet.on`, canvas.

### 2. P1 — `.amr-x` (point card ✕) is a 22×19px tap target, no hit pad

`airmap.css:41` `.amr-x { padding: 2px 2px 2px 8px }` — measured 22×19 effective,
no `::after` pad. Every other dismiss in the app got padded in the :265 fixes;
this is the one left. Repro: same point card → ✕.

### 3. P2 — scrolled content still slices under translucent sheet title (airmap)

Scroll `.sheet-body` on "air around me" → `span.dt-swho.num` ("0–500 scale")
passes under the `h2` title strip. Same class as mobile-reality #6 — still live.

### 4. P2 — redundant copy: "the air is barely moving" twice in adjacent lines

Airmap sheet, back to back: *"the air is barely moving — the day's pollution is
sitting over the city"* then *"the belt is quiet — 5 fires burning · the air is
barely moving — clearing at ~76% of its usual pace · measured, not reported"*.
Proof: `probe-attrib.png`.

### 5. P3 — map attribution links collide geometrically with the sheet's "why" note

`.maplibregl-ctrl-attrib-inner` [117,786,263,48] ∩ `.dt-whynote` [40,797,310,57]
on airmap. Attribution is fully covered by the opaque sheet → invisible to the
user, but the links are live in dead space and will keep polluting overlap
audits. Suggest hiding the control while the sheet covers it.

## Ruled out (flagged by the pass, verified non-defects)

- `st-title × st-hint` (settings) — hint at y=-828, off-screen; no visible overlap.
- `wt-dim × wt-dist` (whereto results) — all measured gaps NEGATIVE (−70 to −239px); no collision. `s5-whereto-results.png` clean.
- `dt-heronum × dt-herofelt` (airmap hero) — ≤4px line-box touch; `s5-airmap.png` clean.
- All "clipped" flags = intended ellipses (search-result names).
- OC flags on stay card / point pins = expected card-over-list layering.

## VERIFIED CLEAN

OV=0 / OC=0 on: all 5 onboarding pages, home top/mid/bottom, settings (top+bottom),
ledger, purest list, whereto (search, results, plan top+bottom, armed, post-Esc),
journey, receipt. Armed pin-drop still works (`s5b-armed.png`: pinbar + live map,
`pointer-events` correct). Esc-unarm verified again (Esc → back to sheet, stays
whereto). Journey + receipt (`s5b-journey/receipt.png`) clean, CTAs in thumb zone.
Drag-dismiss, ≥40px pads, 16px inputs — all prior verdicts hold; no regressions
found en route.

## Overlap table (final, 21 states)

| state | textOverlaps | occluded | note |
|---|---|---|---|
| onb 1–5 | 0 | 0 | clean |
| home ×3 | 0 | 0 | clean |
| settings ×2 | 0* | 0 | *1 off-screen flag, ruled out |
| ledger | 0 | 0 | clean |
| purest / stay | 0 | 3 | expected card layering |
| airmap | 0* | 0 | *2 line-box touches, invisible |
| airmap-bot | 0* | 0 | + P2 chrome slice (#3) |
| airmap-point | 0 | 8–12 | **P0 am-read slab** |
| whereto/results/plan/armed | 0 | 0 | clean |
| journey / receipt | 0 | 0 | clean |

Build checked: 9bf64497 — reply format per lane protocol. No product code touched.
