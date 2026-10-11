# Lane J — journey (Oct 11)

Files: `server/webapp/journey.js`, `server/webapp/journey.css` (nothing else touched).

## What changed
**Real navigation only.** `navigator.geolocation.watchPosition` is called directly, so errors
show up: blocked → "Location is blocked — allow it to navigate", no fix → "Finding your
location…". There is no simulated drive in any user flow. The "ride a preview" option, the
sim banner and the ×8 speed button are gone. `?sim=1` is QA only: fake fixes go through the
same path and the record is saved as `simulated:true`.

- **Position and speed.** Each fix is projected onto the line, with a window around the
  current progress first. Progress only moves forward, and a single stray fix can't jump it
  further than a plausible ride. Fixes vaguer than 150 m never move progress. Speed is the
  device's own reading, or the displacement between fixes. With no new fix for 5 s the
  speed shows **0**. Stop moving and the puck stops.
- **Turn-by-turn banner.** Uses the served maneuvers. Engine "least-smoke" rows only carry
  "Head out" / "You'll arrive", so `lineTurns()` reads the turns off the line itself (heading
  change of 35° or more). The distance to the next turn is measured from the real projected
  position. A cue is held until ~15 m past the corner. Shows the instruction, plus the street
  when the instruction doesn't already name it, and "Arrive at <destination>".
- **ETA.** Built from live traffic `live_s` for the line still ahead (or the plan's
  `live_eta_s` / `eta_s`). As the trip goes on it blends in your own measured pace (weight up
  to 0.6). Shows "N min · X km · arrive h:mm".
- **Reroute.** Triggers when you are more than 60 m off the line for more than 10 s, at most
  once every 30 s. Sends `POST /v2/reroute {route_id, at, to, vehicle}` with no trip `mode`
  (the server would read it as the family hint), then adopts `option`. Intake and the
  odometer carry over, and the route is redrawn. A detour still adds to the odometer.
- **Live jams.** `POST /v2/p/route_traffic {coords ≤150 [lat,lon], mode}` with the remaining
  line, on start and every 120 s. Skipped for walk, cycle and metro. Each jam is projected
  onto our line. The slim dark line says "Jam ahead on <road> · +N min", and there are
  small map pins. A 404 or `configured:false` shows nothing. A failed or missing endpoint
  backs off to one request every 10 min.
- **Intake by time actually spent.** Every second you are tracked:
  `k × served segment pm25 × dt`, where `k = plan dose ÷ plan eta ÷ mean pm25` (the plan's own
  breathing constant). Following the plan at plan pace gives back the plan dose; sitting in a
  jam adds dose. If a route has no strip/eta, intake falls back to the plan dose spread along
  the distance covered.
- **Measured "stuck".** Speed under 5 km/h for more than 60 s, after the first 30 m. Each
  stretch records its start, end, duration, position and street.
- **Receipt (simple).**
  - Hero: "You breathed ≈ X µg" with a chip for the band word and colour of the trip-mean air.
  - Verdict: 5 steps (Very light / Light / Moderate / Heavy / Very heavy), set by the share of
    a WHO 24 h guideline day (15 µg/m³ × 14.4 m³ = 216 µg). Plus one line comparing against
    the cleanest served option.
  - Graph: **one** graph of intake along the trip (bins along the odometer), each bar coloured
    with the existing band palette of its stretch. Bars were all red before; this is fixed.
    Tags read "jammed here · N min" and "most intake here".
  - Mini SVG route map: what you rode, coloured by air, with the same two markers. The legend
    gives the street (from the route, else reverse-geocoded).
  - Tiles for distance, time and stuck. At most one fuel/CO₂ line.
  - No monospace text, no CO₂ ranges, no footers.
- **Ledger record.** Fields are only added (`dose_ug, dose_lo_ug, dose_hi_ug, emit_kg,
  avoided_ug, simulated` keep their meaning). New: `mode, stuck[], reroutes, measured:'gps'`.
  A trip that never really started (no fix, or under 50 m) is not stored.
- **Telemetry.** `A.track('journey_start', {mode, vehicle})` on mount.
  `A.track('journey_end', {completed, mode, vehicle, dose_ug, dose_saved_ug (fastest − taken),
  km, minutes})` on finish, or when the screen is left mid-trip (completed:false). Not sent
  for `?sim=1` rides.
- **Route paint.** Segments go to `A.map.showRoute` with a **numeric** band (the served band
  is the word 'Satisfactory'), so stretches draw in their band colour.

## How it was verified
Rig: `~/alive-dev/j/run.js`. Headless Chrome at 390×844, localhost:8110 (local
files + prod API). It uses DevTools geolocation emulation driving the real `watchPosition`,
on the CP → Tolstoy Marg car route (2.2 km).
- Banner: "Head out onto Outer Circle" → "1.4 km / 1.1 km / 780 m · Turn left onto Kasturba
  Gandhi Marg" → after the turn, "Turn left onto Tolstoy Marg". Speed read 74–81 km/h at
  20 m per 0.9 s.
- Stop for 7 s: the puck stayed put and the speed read 0.
- 150 m off the line: "Off route". After 10 s, `POST /v2/reroute → 200` returned a new car
  line of 1.68 km. The new line was followed to arrival, and the receipt opened automatically.
- Receipt: the bars were `rgb(199,163,79)` = `--b1` (satisfactory), not red. It showed
  "most intake here · Outer Circle", the mini map, and "Very light · under 1% of a day at the
  WHO limit".
- Ledger record written; telemetry queue flushed.
- Overflow at 320, 390 and 430 px: `scrollWidth == innerWidth`, no element crossing the
  edge.
- Run B (QA-only mocked route_traffic response plus a 66 s stop):
  - The dark line read "Jam ahead on Kasturba Gandhi Marg · +4 min", then "Slow traffic on …"
    once inside the jam. The ETA took `live_s`.
  - The stop gave a measured stuck stretch `{dur_s:64, street:'Outer Circle'}`. The receipt
    showed "jammed here · 1 min", a "1 min stuck" tile and the mini-map marker.
  - The reroute this time returned an engine row, and `lineTurns()` cues followed it ("Bear
    left / Turn right / Turn left").
  - `/v2/tally` bodies: `journey_start {mode:'health_max', vehicle:'car'}` and
    `journey_end {completed:true, mode, vehicle, dose_ug:0.89, dose_saved_ug:0.91, km:2.38,
    minutes:3.1}`.
- Run C (layout re-check): the jam/status lines always sit under the banner (flow column), and
  the nav HUD has no overflow at 320/390/430.
- Location blocked: the pill read "Location is blocked — allow it to navigate". Ending showed
  "Location was blocked, so nothing was measured." and no ledger row was written.
- `?sim=1` smoke: the ride arrived and the record was saved with `simulated:true`.
- `node --check server/webapp/journey.js` passes. The only console errors were the browser's
  own "Failed to load resource: 404" lines for `/v2/p/route_traffic`, plus `/v2/tally` while
  prod lacks lane P/A endpoints. No JS errors.

Screenshots: `~/alive-dev/j/shots/a-*.png` (real-GPS run), `b-*.png` (jam + stuck).

## Patches needed in files I don't own
**map.js (lane M)**: `paintSegments` should take string bands and use the segment's own
geometry. `start_frac`/`end_frac` are arc fractions, not vertex fractions.
```diff
-    const feats = segments.map((s) => {
-      const a = Math.floor((s.start_frac ?? 0) * (n - 1));
-      const b = Math.max(a + 1, Math.ceil((s.end_frac ?? 1) * (n - 1)));
-      return {
-        type: 'Feature',
-        properties: { band: s.band ?? A.fmt.bandIdx(s.pm25), pm25: s.pm25 },
-        geometry: { type: 'LineString', coordinates: coords.slice(a, b + 1) },
-      };
-    });
+    const feats = segments.map((s) => {
+      const band = typeof s.band === 'number' ? s.band : A.fmt.bandIdx(s.pm25);
+      let g = s.geometry && Array.isArray(s.geometry.coordinates) && s.geometry.coordinates.length >= 2
+        ? s.geometry.coordinates : null;
+      if (!g) {
+        const a = Math.floor((s.start_frac ?? 0) * (n - 1));
+        const b = Math.max(a + 1, Math.ceil((s.end_frac ?? 1) * (n - 1)));
+        g = coords.slice(a, b + 1);
+      }
+      return { type: 'Feature', properties: { band, pm25: s.pm25 },
+        geometry: { type: 'LineString', coordinates: g } };
+    });
```
**app.js (coordinator)**: `A.geo.watch` swallows errors. The journey doesn't use it any more,
but other callers should get them:
```diff
-  watch(cb) {
+  watch(cb, errCb) {
@@
-      () => {}, { enableHighAccuracy: true, maximumAge: 2000 });
+      (e) => { if (errCb) errCb(e); }, { enableHighAccuracy: true, maximumAge: 2000 });
```
**whereto.js (lane W)**: already passes `{option, options, from, to, mode, vehicle}`. Keep
`mode` ∈ health_max|petrol_health|time_health and `vehicle` = the class. Telemetry uses both.

Small extras:
- When the jam is also where most went in, the receipt shows one marker instead of two
  stacked ones.
- The map zoom buttons are hidden on the journey screen. They sat under the ETA card at
  320 px; pinch still zooms.
- A reroute response that lands after you are back on the line is discarded.

## Open issues / honest gaps
- `/v2/p/route_traffic` 404s on prod until lane P deploys, so no jam line shows on prod today.
  The UI path was verified only with a QA-side response mock.
- Reroute picks the server's top option for the vehicle family. It doesn't re-apply the trip
  mode (by design, see above).
- motion.js focuses `.jr-sheet`. The card's own focus ring is suppressed in journey.css; the
  buttons keep theirs.
