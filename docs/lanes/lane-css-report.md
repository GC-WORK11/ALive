# lane-css report — layout polish around the map/rail

Files touched: `server/webapp/app.css`, `server/webapp/home.css`.
`index.html` unchanged — nothing in it needed layout work.

## Audit answers

**Does the sheet block more than it shows? No — the model was already honest.**
`#screens` and `.screen` are `pointer-events:none`; `.screen > *` re-enables
events only on real surfaces. Verified with `elementFromPoint` grids AND real
mouse input at 1366×850, 1024×768 and 390×844: free-map points resolve to
`canvas.maplibregl-canvas`, clicks there fire `alive:maptap` (2/2 free-area
clicks landed, 0 inside the sheet), wheel reaches the canvas. The sheet's
hit-box is exactly its painted box on every screen checked (airmap full rail,
whereto search rail + `.wt-half` top:38% rail, purest, ledger). Settings' full
`.st-scrim`, the consent gate, `.sb` and `.pf` are real dismiss-surfaces —
blocking the map there is intended.

**Real problems found and fixed (all in the ≥720px media block + chip rule):**

1. **Zoom + attribution were dead on desktop.** `.maplibregl-ctrl-bottom-right`
   sat at x995–1366 while the rail covered x906+ — invisible on every sheet
   screen (i.e., whenever the map is visible). Now the whole bottom-right
   corner cluster (MapLibre zoom group + attribution, and Leaflet's
   bottom-right corner in basic mode) shifts left of the seam:
   `right: calc(var(--rail-w) + 10px)`. Verified: zoom-in button hit-tests
   clean at x917–946, rail starts at 966.

2. **Sheet/map seam.** The rail kept the bottom-sheet shadow
   (`0 -6px 30px`), so its left edge was a hard paper wall. Now:
   `border-left: 1px solid var(--ink10)` + `box-shadow: -18px 0 42px` —
   carved out under `.wt-armed` (the ghost pin-drop sheet gets no seam
   artifacts; verified: border 0, shadow none, pointer-events none).

3. **`map-nogl` chip out from under the sheet.** map.js sets its geometry
   inline (top:10px, viewport-centered) — on a narrower laptop it slid under
   the rail's right side, on phones it tucked under `#mark`. Both variants
   share the class; the veil's inline `inset:` shorthand discriminates:
   - chip: desktop → centered pill inside the honest map region
     (`left:0; right:--rail-w; width:fit-content; margin:auto` — 153–812px at
     1366); phone → a top strip right of the mark (104–380px at 390).
   - veil (`noMapNote`): covers exactly the region left of the rail.
   Overrides need `!important` (inline styles) — flagged below for a JS fix.

4. **Rail narrowed 460 → 400px** (`--rail-w` on `:root`, so every
   clear-the-rail rule derives from one token). More honest map area at
   laptop widths, matches the ~380–420px design.

5. **Toast centers on the visible map** (not the viewport) while a sheet
   screen is up — a long toast could tuck under the rail before.

6. **home.css:** in pick mode the `.hs-pickcard` hint floats as a 440px
   bottom-left card on ≥600px instead of a viewport-wide strip.

## Verified (playwright, Chrome, server :8908) — shots in `lane-css-shots/`

- airmap / whereto-search / whereto-routes(half rail) / purest / home at
  1366×850, plus airmap at 1024×768 and all at 390×844.
- Chip + veil variants injected with map.js's exact inline markup.
- No console errors; mobile geometry unchanged (sheet still bottom-anchored
  full-width; chip/pickcard adjustments are min-width-gated or additive).

## JS-side fixes needed elsewhere (not made — for the integrator)

- **map.js:319** — `NavigationControl` is still `bottom-right`; the map lane's
  move to `bottom-left` makes my corner-shift rule inert (harmless either
  way). Same for Leaflet `position:'bottomright'` at map.js:192.
- **Mobile caveat for that lane:** on <720px the bottom sheet covers both
  bottom corners whenever a sheet screen is open — `bottom-left` alone still
  hides zoom on phones; they'll want it hidden there or hoisted above the
  detent.
- **map.js:134/148** — `map-nogl` positions itself via inline `cssText`.
  Giving the chip variant its own class (e.g. `.map-nogl-chip`) and moving
  geometry into a stylesheet would retire my `!important` overrides.
- **airmap.css / purest.css** hardcode `right:480px` (`.am-scw`, `.am-read`)
  tuned to the old 460 rail — they still clear the 400 rail (80px gap now);
  adopting `--rail-w` tightens it. Their call.
- **Dead CSS in app.css** (not deleted — flagged only): `.home-panel`,
  `.air-card`, `.bandscale`, `.doors`, `.modes`, `.vrow`, `.vchip`, `.opt`,
  `.cta` and friends are the pre-`.hs`/pre-`.wt` markup — zero references in
  current JS/HTML.
