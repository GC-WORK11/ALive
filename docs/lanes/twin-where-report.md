# twin-where report — `whereto` pixel twin of SearchScreen + VehicleSheet + RouteTint

## what shipped
`server/webapp/whereto.js` fully rebuilt DOM-wise as a 1:1 twin of
`Mobile/src/screens/SearchScreen.tsx` (three surfaces: search, compare options,
vehicle wizard). `whereto.css` rewritten with exact RN tokens (theme.ts colors,
spacing, radii, type scale). `search.js` untouched — deep-cascade + mrank
contract intact.

## RN → web mapping
| SearchScreen.tsx | whereto |
|---|---|
| routeCard (from/to rows, hairline@32, armed wash) | `.wt-rc` / `.wt-rrow` |
| bar pill 56px + back/locate/x glyphs | `.wt-bar` / `.wt-bbtn` / `.wt-input` |
| sectionHead secondary15 sb | `.wt-sec` |
| placeRow glyphBox 38r13 + title/sub + dist | `placeRow()` `.wt-row` |
| SaveStrip pills (del home/work, save-as) | `saveStrip()` `.wt-save` |
| InstantCard prefill | `instantRows()` |
| actionBar your location / choose on map | `.wt-act` |
| armedPinFold → map tap | `armPinDrop()` + `.wt-pinbar` |
| CompareSheet tripRow/legend | `.wt-trip` / `.wt-legend` |
| OptionCard (chip, delta, felt/mask, reason 3-line, doseR, µg tracks, info i) | `optionCard()` `.wt-opt` |
| VehicleSheet wizard (cls→fuel→year→puc→done, 1s auto-advance, skip/change) | `renderVehicle()` `.wt-v*` |
| matchSpans (caseless token highlight, ink sb vs text2 reg) | `matchSpans()` |
| fmtDist / fmtEta | ported verbatim |
| strings.ts en | `STR` verbatim (findGeoHint fallback 'looking around you…') |

## behaviors ported
from→to armed flip, swap (haptic=press), Your location (consent, recents
seed from geo.pos once), choose-on-map pin-drop + reverse label, doorRows
(askroute → `A.show('askroute',{ask})`), quiet empty, air answers not-found
row, saveFor open/close under row, plan deep-cascade stages (planning→
failed/no-trails/server → empty trailwarn → options+partial warn), dose
bands+qual+delta by vehicle, selbg .4s/well .3s transitions, wizard
regen>=2019 + bs6 chip, puc digits 4-14 validation, done auto-advance 1s.

## deviations
- saveFor opens via small `＋` glyph next to distance (long-press ux analog)
- doorRows also rendered above typed Results (RN has none there — cascade
  coverage is identical otherwise)
- enter animation .36s cubic-bezier(.22,.8,.32,1) ≈ RN 420ms .22,.8,.3,1
- vehicleGlyph rides label 'rides' vs RN 'rides your way' (kept terse to
  avoid 2-col clip)
- 'dose band' label shown literally (no doseUg n-key in STR)
- wild actionRow folded into same .wt-act slot (RN parity)

## frozen-file needs (reported, not touched)
- app.css `.sheet-body` keeps padding 4/18 — `.wt` counteracts with negative
  margins to get edge-to-edge RN layout. A `--wt-pad:0` body variant would be
  cleaner.
- map.ts emits `map:tap` — used for pin-drop. OK as-is.

## verify
`python3 -m http.server 8090` → 390×844 real Chrome (playwright channel):
armed=from, bar PH 'Where from?', air-answers rows, actionBar both pills,
`Searching…` status on input, 0 JS errors. Remote cascade APIs unreachable
from this box → only 'Searching…' state exercised (expected; deep cascade
path untouched). Screenshots: /tmp/wt-search.png, /tmp/wt-typing.png.

## commits
- `b616cfb` whereto: pixel-twin of SearchScreen + VehicleSheet + option cards
  (base f89ff74; push 403 → applied via patch by coordinator)
