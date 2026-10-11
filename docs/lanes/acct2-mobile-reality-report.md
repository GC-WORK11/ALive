# acct2 — MOBILE REALITY lane report

ALive webapp @ **390×844, iPhone 12/13/14 emulation** (Playwright chromium-headless,
deviceScaleFactor 3, touch on, mobile Safari UA 17, geolocation stubbed to New Delhi).
Target: https://d2eh2l2ys9wkij.cloudfront.net/app/ — production deploy, walked
2026-10-11.

Method per state: full-page screenshot + programmatic DOM pass (every visible text
node → getBoundingClientRect → pair intersection, then `elementFromPoint` 3×3
sampling inside each crossing to see what actually paints on top, with an
opaque-ancestor check to suppress occlusion-by-card), clip detection
(scrollWidth > clientWidth), <40px tap targets, fixed-element coverage,
CTA-in-bottom-60% reachability, and rAF frame deltas + `longtask` observer
during sheet transitions, map pans and scrolls.

Note on rigor: mid-audit I found a bug in my own overlap pass (record-field typo
that NaN'd every sampled pair → silently skipped). Every state below was
**re-audited with the fixed pass**; numbers here are final.

---

## Findings

### P1 — long result names bleed through the `delhi index` source tag and off the screen edge
`.srow .n` is `display:inline`, so `overflow:hidden; text-overflow:ellipsis` never
applies. Names paint at full width under the `.src` tag (which has a transparent
background and wins topmost at every sampled crossing point — i.e. its glyphs are
stamped over the tail of the name) and past the row edge.

Measured on whereto → TO `huda city centre` (3 of 9 rows hit):

| row | `.n` right edge | `.src` left | crossing |
|---|---|---|---|
| Tata Motors Cars Showroom - Treo, Huda City Centre | **401.6px** (> 390 viewport) | 295 | 71×6px |
| Domino's Pizza \| Huda City Centre(Metro Station) | 373.4 | 295 | 71×6px |
| OYO 79955 Collection O Huda City Centre | 334.4 | 295 | 39×6px |

Knock-on: `.sheet-body` gains a 12px horizontal scroll (scrollW 402 > clientW 390).
Affects every `.srow` with a long name + `.src` — whereto results, airmap picker,
purest rows share the component.

Proof: `shots/106-whereto-results-to.png` — 'delhi index' visibly ghosted over
'…Treo, Huda City Cent' running off-screen.
Root cause: `app.css` `.srow .n` needs a block-level box (`display:block` or the
`min-width:0` wrapper given `overflow:hidden`) so the ellipsis rules apply, plus
room reserved for `.src`.

### P1 — sheet grab handle is decorative; no drag/swipe dismissal anywhere
`.sheet-grab` (38×4px pull-pill) and `.jr-grab` have **zero touch/drag/pointer
handlers** in the app JS. CDP touch pull-down from (195,63)→500, a drag starting
on the title area, and taps on the exposed map strip all leave the sheet open
(`.sheet.on` still true). The only way out is ‹ back or ✕ — both 36×36px,
already under the 40px floor. Muscle memory says drag-to-dismiss on a mobile
sheet; here it dead-ends.

Proof: `shots/43-after-grab-drag.png` (sheet unchanged after full pull-down),
walk3 traces.

### P1 — sub-40px tap targets across primary chrome
| element | size (w×h, px) | where |
|---|---|---|
| `.pm-x` (stay card ✕) | **20.4×18.8** | purest stay card |
| attribution toggle | 24×24 | every screen (MapLibre) |
| MapLibre zoom ± | 29×29 | every screen |
| `.wt-swap` ⇅ | 30×30 | whereto |
| `#loc-chip` | 99.5×**32.9** | home |
| `.back-btn` / `.x-btn` | 36×36 | every sheet chrome |
| `.jn-exit` / `.jr-x` | 36×36 | journey / receipt |
| `.vchip` ×6 | ~51–63×**38.2** | options vehicle row |
| attribution links | 40.5×**14** / 85.4×14 | map footer |

The two exits users reach for most (sheet ✕, journey ✕) are 36px — and `.pm-x`
at ~20px is the worst offender measured.

### P1 — search inputs at 15px trigger iOS auto-zoom, and zoom is then locked
`.wt-search-head input` (whereto) and the airmap picker input both compute
`font-size:15px` < 16px → mobile Safari auto-zooms on focus. The input is
auto-focused when the search view opens (`requestAnimationFrame(focus)`), so the
zoom fires uninvited — and `user-scalable=no` in the viewport meta stops the
user pinching back out.

### P1 — vehicle chip row clips the 'bus' chip mid-glyph with no scroll affordance
`.vrow` scrollW 384 > clientW 354 → 'bus' is sliced to 'b' at the right edge
(x348–401 > 390). The row is scrollable but nothing signals it — it reads as a
broken cut, not a carousel.

Proof: `shots/110-whereto-veh2.png`, `shots/111-armed-pin.png` ('b' at right edge).

### P2 — scrolled content slices under the translucent sheet title bar
Scrolling the airmap sheet drives content under the grab/title chrome, which is
not fully opaque: the go-out card 'planning to go out · central delhi / change'
is caught mid-glyph under 'air around me'.

Proof: `shots/120-airmap-scrolled.png`.

### P2 — `#loc-chip` is unreachable off-home, contradicting the consent fine print
`body[data-top]:not([data-top="home"]) #loc-chip{display:none}` and its click
handler unmounts with the home screen. The consent card tells the user "you can
change this anytime — the chip up top reopens this" and `home.js:25` even
comments "re-consent from the loc-chip works in every state" — but from
whereto/airmap/purest/journey the chip isn't rendered, so there is no way to
re-open consent until you return home. (On home it works: tap → consent card on
top — `shots/62-consent-reopen.png`.)

### P2 — search field has ~12–31px of dead padding around the input
`.wt-search-head` spans x18–372 while the input inside is x49–359, y133–155.
Tapping the left gutter (icon zone, x≈33) does nothing — `activeElement` stays
`BODY`. The visible field is ~46px tall but only the inner ~22px accepts taps.

### P2 — `alive` brand mark overlaps the journey ✕ button's box
`div#mark` (y10–54.3) × `.jn-exit` (y52.1–88.1): the top 2px of the ✕ sits under
the mark's box (`elementFromPoint` → mark wins 6/9 samples). The circular button
keeps most of its area clear, but the overlap shaves an already-36px target and
a tap in that strip hits the mark, not ✕.

Proof: `shots/113-journey.png` + `113-journey.json` occludedCrossings.

### P2 — option-card headers wrap mid-token
'least-smoke alt 1'/'alt 2' break the digit onto its own line and '23.8'/'km'
splits across lines inside the route card header.

Proof: `shots/110-whereto-veh2.png`.

### P2 — `user-scalable=no` + tiny meta text
`index.html` viewport meta disables pinch zoom (iOS ≥10 ignores it, other
mobile browsers honor it). `.srow .s` is 11.5px and `.src` 9.5px — below
comfortable reading size on the densest info rows. Receipt `.jr-title` is
intentionally ellipsized ('ride ended — HUDA City Centre …') — by design, noted.

---

## Rect-intersection pass — full data

Across all 24 audited states (consent, home, whereto main/search/results ×2,
options ×3, armed pin, after-pin, journey, confirm, receipt ×2, airmap ×3
incl. scrolled + point-read, purest ×3, stay card, consent reopen):

- **Text-on-text bleeds**: only the `.n` × `.src` class above (3 instances,
  `hitB=9/9` on each — `.src` paints on top of the name tail).
- **h2 sheet-title bleeds** (`h2 × .mi/.ms`, `h2 × .am-hint`, `h2 × .pm-row`):
  box intersections ≤8px where the loser element sits behind the sheet edge —
  verified against screenshots as not user-visible (either fully hidden or a
  ≤3px sliver under frosted chrome). Not counted as defects.
- **Occluded crossings** (a third, opaque element paints over the intersection —
  expected layering): consent card over home text + map attribution, stay card
  over map pin-chips, `#mark`/pin-chips over overflow-clipped scrolled rows.
  All confirmed invisible-by-design in screenshots.
- **Everywhere else: 0** intersecting visible text pairs.

## Jank measurements

rAF frame deltas during each interaction, `longtask` observer armed.
**Caveat: headless chromium is CPU-bound** — a real iPhone pushes map/raster
work to the GPU; treat these as an upper bound, ranking is the signal.

| surface | frames | >16.7ms | % | avg | p95 | worst | longtasks >50ms |
|---|---|---|---|---|---|---|---|
| sheet open | 43–51 | 19–20 | 37–47% | 18.6–22.1 | 33.4 | 33.4–83.3 | 84, 52 |
| sheet close | 102–150 | 10–57 | 10–38% | 17.0 | 16.7 | 33.4 | — |
| map pan ×3 | 468–672 | 134–414 | 29–62% | 16.7–22.8 | 16.7–33.4 | 16.8–66.7 | 63, 63, 63 |
| results scroll ×3 | 260–404 | 120–184 | ~46% | 16.7 | 16.8 | 16.8 | — |
| airmap pan+scroll | 465 | 305 | 66% | 24.0 | — | — | — |
| purest scroll ×3 | 588 | 300 | 51% | — | — | — | — |

Sheet transitions (.45s CSS transform) and map pan are the heaviest surfaces;
scrolls hold ~16.7ms avg with ~45–50% of frames over budget in headless.

## VERIFIED CLEAN

- **consent card**: opaque, readable, both CTAs full-width; reopen from loc-chip
  on home works (card verified topmost).
- **home**: three doors reachable (cy 674/674/785 — bottom 60%), loc-chip visible.
- **whereto search**: head input focuses, FROM+TO searches both return rows,
  rows tappable full-width.
- **armed pin**: fold strip renders; 'back to the search' ghost CTA ≥40px at
  cy 804 — inside one-thumb reach; map tap drops the pin.
- **journey preview / confirm / receipt**: primary CTAs in bottom 60%
  ('start journey' cy 799, 'end journey' bottom sheet, 'plan the way back' /
  'done' bottom); receipt sheet scrolls to bottom rows.
- **airmap**: detent sheet 58% max-height, go-out card present, point-read state
  fully clean (0 overlaps / 0 clips), sheet-body scrolls to 'windows open' row.
- **purest**: detent sheet 62%, all 13 rows reachable by scroll, stay card +
  sparkline render; `.pm-x` closes it.
- **keyboard-open proxy** (visualViewport shrunk to 390×500): search input at
  y133 stays above the fold, uncovered, still focusable.
- **toast** after consent-skip: y765 — above the home-indicator zone.
- **safe-area**: `--sat`/`--sab` `env()` applied on sheet top, `.am-read`,
  `#toast`, `.jn-top` — correct throughout.
- **consent-skip → map-tap → home** flow works end to end.
- **no real text-on-text** anywhere except the `.n`×`.src` class; no unintended
  fixed-element coverage outside the documented cases.

## Not covered / limits

- Real-device jank (headless numbers are CPU-bound upper bounds) and real iOS
  keyboard `visualViewport` (used a 390×500 resize proxy).
- `.jn-fab` speed/follow toggles are `hidden` in the normal flow (42×42 when
  shown — over the floor).
- Sheets have no half/full detents on whereto — open state only; airmap/purest
  are bottom-detent by design.

Evidence: `~/work/mobile-lane/shots/` (PNG + audit JSON per state), harness
`~/work/mobile-lane/{lib,walk,walk2,walk3,walk4,walk5b,jank2,reaudit-all}.js`.
