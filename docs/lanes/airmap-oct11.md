# Lane M — air map (oct 11)

Files: `server/webapp/map.js`, `server/webapp/airmap.js`, `server/webapp/airmap.css`.
`server/tiles.py` unchanged. Nothing committed / pushed / deployed.

## What changed

### map.js (shared base map; public API kept, only additions)
- Basemap = OpenFreeMap Positron (no key), light street tuning (white minor roads, firmer paths).
- **Fallback, both cases now work** (verified with CDP network blocks):
  - style host down → offline style built on our own tiles `/tiles/delhi/{z}/{x}/{y}.mvt`
    (direct URLs, so prod's http-ELB `tilejson.json` is never used);
  - style loads but the planet TileJSON/tiles fail → the **same** style re-applied (setStyle diff)
    with only the `openmaptiles` source pointed at the local tiles. Labels and every overlay are kept.
    Before this fix the map never fired `load` here, so the whole app's map (field, pins, fly) hung.
- Ready on `style.load` as well as `load`: overlays and camera don't wait on slow first tiles.
- Field: `/grid?cells=40` PM2.5 + PM10 → CPCB AQI per point. Smooth tint under the roads that fades where data
  is thin and stops at the field edge (lat 28.95). `airRoads(on)` colours each road in view by the air at its
  spot; weak cells stay uncoloured.
- New exports: `cpcb(pm25, pm10)` → `{aqi, over, band, basis}` (same tables/rounding as home.js `cpcbAqi`),
  `cpcbAqi` → number, `aqiBand`, `segBand`, `sampleField`, `fieldInfo`, `traffic(map, on)`, `airRoads(on)`, `BANDS`.
- **Route segments**: `band` may be the CPCB word (`'Satisfactory'`, `'Very Poor'`, any case) or the 0–5 index.
  `'No data'` falls back to the stretch's pm25; with neither it keeps the plain route colour. The coloured
  stretches are now drawn **above** the plain route line. Before, the forest-green line covered them, so every
  route looked green even with numeric bands. `showRoute` on an existing id repaints its segments.
- Traffic: probes one `/v2/p/flow_tile` tile and adds the raster only when it gets an image. Otherwise it
  returns false and adds no layer. Re-probes after 5 min.

### airmap.js / airmap.css
- **Hero = home's number**: AQI and band word from `A.map.cpcb(j.pm25, j.pm10)` on `/aqi` at the live spot
  (was `us_aqi`). PM2.5 and PM10 below it. "an estimate — nearest monitor ~N km" when the read is thin.
- **Tap readout, one scale**: "175 AQI — moderate · PM2.5 56". AQI and band come from the painted field
  (`sampleField`), or from `/aqi` → CPCB when the field doesn't reach. The pin shows the AQI. a11y string fixed.
- City "other things in the air" grid: the **US AQI tile is removed** (a second index on the same screen).
- Planning to go out: renders the server's `/v2/playtime` `decisions` word for word (lane U's fixed text shows
  after deploy; no client workaround). The client's own lightest/heaviest rows only appear when the server sent
  no decisions, and now say µg/m³ instead of "µg". Meta line in plain words: "nearest monitor 2.8 km · air read N min old".
- Kept from before: no caption card (only the good → severe chip), the live dot follows (re-reads after
  120 m), opens at street zoom, the picker uses `A.search.live`, no raw tags.

## Verification (390×844, DPR 3, http://localhost:8110/app/ = local files + live prod API)
Rig: `/home/govinda/alive-dev/m/check.mjs` (heroes | segs | fallback | fallback2 | follow | traffic2) plus
`shoot.mjs` (traffic | others | plan). Screenshots are in `/home/govinda/alive-dev/m/shots/`.
- Hero vs home, same spot. Ashok Nagar: home 173 Moderate, air map 173 moderate (`/aqi` pm25 58, pm10 209,
  CPCB 173; the US AQI 151 is no longer shown). Sonipat: 181 / 181, with "an estimate — nearest monitor ~17 km".
  MATCH true on two separate runs (earlier 167/167 and 173/173).
- Map: OpenFreeMap; at z14.2 Ashok shows 229 road and 16 label features, 1055–1916 coloured air-road pieces,
  no caption, no horizontal overflow. Sonipat has streets but no colour: honest, it is past the field edge.
- Tap: "175 AQI — moderate PM2.5 56 · Khera". The pin says 175, matching `sampleField` at the tapped pixel
  (aqi 175, w 1). Sonipat falls back to `/aqi`: "181 AQI — moderate PM2.5 53 · thin read".
- Segments: `'Satisfactory'`→1, `'very poor'`→4, `'No data'`→route colour, `2`→2. Rendered bands [4,1,2,-1];
  the segs layer sits right above `route-t-line`.
- Fallback with the style host blocked: offline basemap, 2278 road features, field and air roads on, hero 167, within 5 s.
  Fallback with the planet TileJSON blocked: same Positron style on local tiles, 1296 roads, labels, field, hero.
- Live-dot follow (consent granted, GPS moved 1 km then 6 km): the puck tracks the new fix, the camera
  keeps it in the open strip, and the hero re-reads (173 → 174 → 163).
- Traffic on prod: `/v2/p/flow_tile` returns 404, `traffic()` returns false, no layer, no JS noise. The only
  console line is Chrome's own network-404 log for the single probe. With real TomTom tiles standing in for
  the route (key read in the test rig only): layer added below the labels, 9 tiles loaded, off() removes it.
- Other screens on map.js: home, whereto and purest render on the OpenFreeMap basemap with the field off.
- At 320 px: hero 173 equals home 173. The tap card wraps "PM2.5 56" onto a second line, no horizontal overflow.
- `node --check map.js airmap.js` OK. Zero console errors from map.js/airmap.js. The other errors seen
  (`/v2/tally`, `/v2/purest`, `/v2/p/nearby` 404s; `profile.*` and `sidebar.*` missing) belong to other lanes or wait on the deploy.

## Ola basemap
There is no server proxy route for Ola tiles: `v2/providers.py` has only `flow_tile`. The style needs
`api_key` on every tile, sprite and glyph URL, so it would sit in the browser. **Kept OpenFreeMap.** If wanted
later, a `/tiles/ola/*` proxy that rewrites the style's URLs could go into `server/tiles.py` (OLA_API_KEY server-side).

## Open / notes
- `/tiles/tilejson.json` on prod still advertises `http://alive108-…elb…/tiles/...`. Nothing in the app uses it now.
- The traffic probe 404 shows up as one Chrome network-log line until lane P's route is deployed. After deploy
  the route answers 200, or 204 when the key is off, and the helper stays silent.
- TomTom flow tiles use their own green-to-red ramp. The air map never turns them on; whereto/journey do.
