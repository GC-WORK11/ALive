# lane-airmap — "can't search / can't pin" reality pass

Owns `server/webapp/airmap.js` only. Verified against a live local server
(`uvicorn main:app :8903`, keys.env loaded) with playwright-core + Chrome 148,
geolocation stubbed to 28.6139, 77.209. Both engines driven:
**MapLibre** (`--enable-unsafe-swiftshader --use-angle=swiftshader` — plain
headless Chrome has no WebGL at all) and **Leaflet** (`--disable-webgl
--disable-webgl2 --disable-gpu`). Screenshots in `docs/lanes/lane-airmap-shots/`.

## What reproduced, and what didn't

Driven end-to-end on both engines (desktop 1280×860 mouse, mobile 414×820
touch): composer → type "sarai kale khan" → 10 suggestion rows → tap → map
flies to 28.5866/77.2562 @13.2 → `.am-read` card "500 AQI — severe · PM2.5 86 ·
PM10 569 · Sarai Kale Khan" → `.am-tappin` pin present (maplibregl.Marker on
MapLibre, `.leaflet-marker-icon` + divIcon on Leaflet) → real map tap → fresh
readout + pin ("382 AQI — very poor · near Axis Bank" on Leaflet, "455 — severe
· Lodhi Estate" on MapLibre) → ✕ clears input + pin + card.

So the happy path already worked in this tree on Chrome. The complaints map to
real gaps found while driving it as a user:

### 1. Suggestion taps can be dead on touch-first browsers → "can't search"
`scBindRows` and the composer ✕ used `pointerdown → preventDefault()`.
Canceling `pointerdown` suppresses the synthesized compatibility `click` in
browsers where click is a mouse-synthesized event (iOS Safari, older WebKit) —
the row visibly taps but `scPick` never runs. Chrome 90+ regenerates `click`
from pointer events so it survives on desktop (verified — that's why it looks
fine in devtools and fails on phones).
**Fix:** `mousedown → preventDefault()` instead — identical focus-retention on
the input, and `click` fires on every engine. Applied to `.am-srow` rows and
`.am-sc-x`.

### 2. The explicit "drop a pin on the map" flow dropped nothing → "can't pin"
Sheet picker → `data-pin` armed the tap (`st.armed`), but the armed branch of
`onTap` returned before `tapRead` — no `.am-tappin` pin, no readout, just a
silent sheet re-render. A user who armed pin-drop tapped the map and saw
nothing happen on the map.
**Fix:** armed tap now calls `tapRead` (field-first read + AQI pin + card,
same as any map tap) and reverse-geocoded names flow into the readout caption.

### 3. The in-sheet place picker changed nothing visibly → "searched, nothing happened"
`openPicker.finish` set `st.place` + re-rendered the sheet, but the map never
flew and no pin/readout appeared — pick a place, screen looks untouched.
**Fix:** `finish` now does exactly what a composer pick does: names the tap
(`st.tapPlace`), `flyToSpot` at the shared place zoom (locality→13.2,
point→14.8 — regex deduped into `placeZoom`), and `tapRead` (pin + card).
Verified: pick "Lodhi Garden" → map flew to 77.2196/28.593 → pin + "434 AQI —
severe · Lodhi Garden".

### 4. Dead-end pin + thinner card polish
- If the tap card was dismissed while `/aqi` was still in flight, the pending
  `…` pin stayed on the map forever — now removed with the card.
- Focus on an empty composer could show a blank list card — now shows only
  when there is a query or rows.
- Tap/place card now shows **nearest-monitor distance** from `/aqi`'s own
  `nearest_station_km` ("nearest monitor ~N km", or "an estimate — nearest
  monitor ~N km" on thin reads — same words as the hero). Card already carried
  place name, AQI + band word, PM2.5 + PM10. No invented fields: with live
  stations down in this env (`nearest_station_km: null`) the line correctly
  doesn't render; field-painted reads (which carry no monitor distance) keep
  the "thin read" qualifier.

## Map usability (complaint 3)
Nothing in `airmap.js` swallows wheel/pointer events: verified wheel-zoom
(14.2→15.9 MapLibre, 13→18 Leaflet) and drag-pan on both engines. `.am-scw`,
`.am-read`, `.am-chip` only occupy their own boxes; `.am-chip` is
`pointer-events:none`.

**Reported, not fixed (another lane owns it):** the zoom controls are under the
sheet and unreachable on both engines. MapLibre `.maplibregl-ctrl-bottom-right`
and Leaflet `.leaflet-control-zoom` both sit bottom-right; on desktop the
sheet is a 460px right rail (x ≥ 820) and on mobile a 58% bottom detent — the
controls hit-test onto sheet content either way. (Per the brief, another lane
is moving them bottom-left.)

## Also observed (out of scope, reported)
First-run consent (`?` → Continue → share location) calls `goHome()` and
navigates a `#/airmap` first-run to `#/home` — home.js's onboarding, not this
file. Works fine once past onboarding.

## Verification log
- `node --check server/webapp/airmap.js` — clean.
- MapLibre desktop: composer pick → fly 77.2562/28.5866, pin, card; canvas
  tap → new read + pin; in-sheet pick → fly + pin + card; armed tap → pin +
  card; ✕ clears. No page errors.
- Leaflet desktop + mobile-touch: identical checks green (`lftMarkers: 2` =
  puck + tap pin, `pins: 1` = `.am-tappin`).
- Screenshots: `*-1-open … *-6-reset`, `*-p1-picker … *-p3-armedtap` per engine.
