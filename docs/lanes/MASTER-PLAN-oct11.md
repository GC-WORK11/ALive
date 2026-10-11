# ALive — MASTER PLAN, Oct 11 (deadline 20:00 IST)

Coordinator: local Devin session (parent). 11 lanes run in parallel on ONE
working tree: `/home/govinda/Alive` (branch `main`, repo GC-WORK11/ALive).
Every lane edits ONLY the files it owns. Lanes do NOT commit, do NOT push,
do NOT deploy — the coordinator integrates, commits and deploys.

## The product (owner's words, condensed)
A Delhi/NCR personal air-exposure web app (Uber-light, Google-Maps-easy,
pixel-perfect at 390px). Real data only. Coverage = Delhi + whole NCR +
UP/Haryana outskirts (Noida, Gr. Noida, Ghaziabad, Meerut, Hapur,
Bulandshahr, Baghpat, Gurugram, Faridabad, Sonipat, Panipat, Rohtak,
Jhajjar, Bahadurgarh, Palwal, Rewari, Manesar…).

1. Consent popup (nice, not cheap): "your location is only used to analyse
   the air around you" — share location / drop a point / not now.
2. Home: AQI + PM2.5 + PM10 of the EXACT spot, band colour (existing
   palette — do not invent colours), one small plain line "how is the air
   where you are". No captions, no jargon.
3. Where To = ONE Google-Maps-like surface. From + To. Infinite index:
   type-ahead that narrows like Google/Uber; house-level addresses; DIGIPIN.
   REMOVE "where to stay" / "when to go out" / any air rows from Where To.
4. Modes BEFORE routing: Health Maxer (cleanest air, no compromise),
   Budget+Health = PETROL-FRIENDLY (least fuel: short, least stop-and-go,
   least idling in jams — show litres saved, NEVER money), Time+Health
   (fastest with live traffic, still clean). Then vehicle. Then routes.
5. Journey: REAL geolocation (watchPosition). No simulated drive in any
   user flow. Stop moving → position stops. Turn-by-turn street banners.
   Live jams ahead (TomTom). Reroute when off route.
6. Trip end: simple graph — "jammed here", "you breathed most here", a
   verdict on a clear scale. Plain words, band colours, no wall of text.
7. Air Around Me: live-location map, AQI colours down to street level,
   detailed basemap, NO caption. "Planning to go out": pick a place → best
   time of day card (the existing gorgeous time-grade card).
8. Purest places: cleanest places near you (only where data is solid).
   Hotels: pick ANY hotel → environment card; Alive's suggested hotel on top.
9. Local storage only, no auth. Anonymous counters (no location) power the
   admin; trips with location only when the user opted in.
10. Admin (/admin, operator token): Cognition-minimal dark. Delhi tile map
   refreshing every 15 min; users, journeys done, successful journeys,
   modes used most, intake saved, segregation (are people piling onto the
   same road?). ALL real numbers, end to end.

## THE LAW
- No fake/hardcoded numbers or places. Every number traces to a live API
  field or an honest computation. Never hardcode the test addresses.
- No captions/explainer slabs, no raw tags ("amenity:place of worship"),
  no monospace walls. Plain, short, human.
- Band colours ONLY mean air quality; reuse the existing palette.
- ≥40px tap targets, ≥16px inputs, no overlap, no horizontal overflow at
  320/360/390/430 px. 60fps transitions (transform/opacity only).
- English default (Hindi strings where the file already has them).
- Honest empty/error states — never a spinner that never ends.

## Architecture
```
browser (server/webapp, vanilla JS)          server (FastAPI, ECS Fargate)
 search.js ── /v2/ac (our prefix index) ───▶ v2/search.py + gazetteer.py
          └── /v2/p/ac /v2/p/geocode ──────▶ v2/providers.py ─▶ Ola, Mappls
 whereto.js ─ POST /v2/plan {mode} ────────▶ v2/plan.py ─▶ alive_core engine
                                                       └▶ providers.traffic_for_route ─▶ TomTom
 journey.js ─ watchPosition, POST /v2/p/route_traffic, POST /v2/reroute
 map.js ───── basemap (OpenFreeMap, no key) + /v2/p/flow_tile (TomTom jams)
 airmap.js ── /aqi /grid /v2/playtime      purest.js ─ /v2/stays /v2/districts /v2/p/nearby
 telemetry.js ─ POST /v2/trip (+ usage counters) ─▶ agg_ddb (DynamoDB) ─▶ admin_agg ─▶ admin.html
```
Keys live server-side only (AWS Secrets Manager in prod, env vars locally).
Env names: `OLA_API_KEY`, `TOMTOM_API_KEY`, `MAPPLS_API_KEY`, `HF_TOKEN`.
Local secrets file: `~/.config/alive-ops/keys.env` (chmod 600, never in git).
Already in prod secrets: OPENAQ, WAQI, ALIVE_ADMIN_TOKEN.

### Provider contract (lane P implements in `server/v2/providers.py`)
All GET unless noted, JSON, cached, 3s hard timeout. If a key is missing the
endpoint answers 200 `{"results": [], "configured": false}` — never fakes.
- `GET /v2/p/ac?q&lat&lon` → `{results:[{id,name,sub,lat,lon,kind,source,distance_m}]}` (Ola autocomplete + Mappls autosuggest, merged, NCR-biased)
- `GET /v2/p/geocode?address&lat&lon` → `{results:[…same shape…]}` (house-level: Mappls + Ola)
- `GET /v2/p/reverse?lat&lon` → `{name,address,locality,city,source}`
- `GET /v2/p/nearby?lat&lon&kind=lodging&radius_m` → `{results:[…]}`
- `POST /v2/p/route_traffic {coords:[[lat,lon],…]}` → `{live_s,freeflow_s,delay_s,jams:[{lat,lon,from_m,to_m,delay_s,road,magnitude}],source}`
- `GET /v2/p/flow_tile/{z}/{x}/{y}.png` → TomTom traffic-flow raster (cached 60s)
- `GET /v2/p/incidents?bbox=minLon,minLat,maxLon,maxLat` → `{results:[{lat,lon,type,road,delay_s}]}`
- Python for other server lanes: `from v2.providers import traffic_for_route` → same dict as route_traffic or None.

### Modes contract (lane E, `/v2/plan` body gains `mode`)
`mode ∈ {"health_max","petrol_health","time_health"}`. Every option gains:
`fuel_l` (from the engine's own exhaust/CO₂: petrol 2.31 kg CO₂/L, diesel
2.68, CNG/EV handled honestly), `live_eta_s`, `traffic_delay_s`, `jams[]`,
`mode_pick` (bool), `why` (≤8 plain words). Health Maxer = min dose, no
compromise. Petrol+Health = min fuel among options within +15% of min dose.
Time+Health = min live ETA among options within +15% of min dose.
Backward compatible: no `mode` → today's behaviour.

## Lanes (owner → files; nobody else edits them)
| Lane | Owns | Job |
|---|---|---|
| P platform | `server/main.py`, `server/v2/__init__.py`, NEW `server/v2/providers.py`, `scripts/deploy.sh`, `server/requirements*.txt` | provider proxy per contract; secrets wiring (deploy.sh secrets); local full server on :8108; aws venv; deploy readiness |
| S search-client | `server/webapp/search.js`, `server/webapp/digipin.js` | Google-like type-ahead tiers, NCR bbox, DIGIPIN, merge providers, no stale/blank lists |
| X search-index | `server/v2/search.py`, `server/v2/gazetteer.py`, `server/v2/places.py`, `server/data/*` | fast `/v2/ac` prefix endpoint, junk purge, name-first ranking, NCR/outskirts data |
| W where-to | `server/webapp/whereto.js`, `whereto.css` | single Google-Maps surface, modes picker, vehicle, simple route cards, jam markers |
| E engine | `server/v2/plan.py` (+ engine-side helpers it alone uses) | modes, fuel litres, live traffic merge |
| J journey | `server/webapp/journey.js`, `journey.css` | real GPS nav only, live jams, reroute, simple receipt graph |
| H home | `server/webapp/home.js`, `home.css`, `settings.js`, `settings.css`, `server/v2/day.py`, `server/v2/outlook.py` | consent popup, AQI+PM2.5+PM10 hero, no captions |
| M air-map | `server/webapp/airmap.js`, `airmap.css`, `map.js`, `server/tiles.py` | detailed basemap, street-level AQI colour, no caption, planning-to-go-out card |
| U purest | `server/webapp/purest.js`, `purest.css`, `server/v2/explore.py`, `server/v2/city.py` | purest places (solid data only), any-hotel env card, Alive pick; playtime advice bug |
| A admin | `server/admin.html`, `server/webapp/admin.css`, `server/webapp/telemetry.js`, `server/webapp/ledger.js`, `ledger.css`, `server/v2/trip.py`, `server/v2/ledger.py`, `server/admin_agg.py`, `server/agg_ddb.py`, `server/community.py` | real analytics end to end |
| Q qa | nothing in the repo (rig in `/home/govinda/alive-dev/qa/`) | e2e + pixel rig at 390×844, continuous defect reports, final demo recordings |
| coordinator | `server/webapp/app.js`, `index.html`, `app.css`, `motion.*`, docs | integration, commits, deploys |

Need a change in a file you don't own? Put the exact patch in your report.

## Dev & test
- `http://localhost:8110/app/` = LOCAL webapp files + LIVE prod API (devproxy).
- Local full server (after lane P brings it up): `http://localhost:8108`.
- Viewport 390×844, DPR 3. Store keys are JSON-quoted: `alive.consent`='"picked"',
  `alive.onboarded`='1', `alive.pos`=`{"lat":..,"lon":..,"t":..}`.
- Test positions: Ashok Nagar Shahdara 28.684,77.300 · CP 28.6315,77.2167 ·
  Sonipat 28.99,77.02 · Greater Noida 28.47,77.50 · Gurugram Cyber City 28.495,77.089.
- Test queries (never hardcode): "Pawan Bakery C block Hanuman Mandir Ashok
  Nagar Shahdara", "ISKCON Delhi East of Kailash", "Neelanchal Dham Sant
  Nagar", "new delhi railway station", "jama masjid shahdara", a Sonipat
  address, a Greater Noida society, a house address, a DIGIPIN.
- Checks before reporting: `node --check <file>` for JS; `python -m py_compile`
  + relevant `pytest server/tests -k <area> -q` for Python.

## Report format (every lane)
Write `docs/lanes/<lane>-oct11.md` (what changed, how verified, open issues).
Return ≤25 lines: files changed, verification evidence, patches needed in
files you don't own, honest gaps.

## Ola Maps — VERIFIED LIVE (17:40 IST, real key in ~/.config/alive-ops/keys.env as OLA_API_KEY)
Base `https://api.olamaps.io`, auth `?api_key=$OLA_API_KEY`, header `X-Request-Id: <any>`. Latency 140–560 ms.
- Autocomplete `GET /places/v1/autocomplete?input&location=lat,lon` → `predictions[]`: `description`,
  `structured_formatting.{main_text,secondary_text}`, `geometry.location.{lat,lng}`, `distance_meters`,
  `place_id`, `types[]`, `layer[]`. "pawan bakery" @Shahdara → #1 "Pawan Bakery · C-543, Hanuman Mandir Rd,
  West Jyoti Nagar, B-Block…" 1.2 km (THE test address). Narrows per keystroke like Google ("pawan ba" → #1).
  House numbers resolve ("C-12 ashok nagar shahdara" → house-level rows). NCR outskirts work (Sonipat, Sector 150 Noida).
- Geocode `GET /places/v1/geocode?address` → `geocodingResults[]`: `formatted_address`, `geometry.location`.
- Reverse `GET /places/v1/reverse-geocode?latlng=lat,lon` → `results[]`: `formatted_address`, `name`.
- Nearby `GET /places/v1/nearbysearch?layers=venue&types=lodging&location&radius&limit` → `predictions[]`
  (NO geometry → call Details). Details `GET /places/v1/details?place_id` → `result.{name,formatted_address,
  geometry.location,rating,user_ratings_total,types}`.
- Directions `POST /routing/v1/directions?origin=lat,lon&destination=lat,lon&alternatives=true&steps=true&overview=full&traffic_metadata=true`
  → `routes[]`: `overview_polyline` (encoded), `legs[0].{distance,duration,steps[]}` steps have
  `instructions, maneuver, distance, duration, start_location, end_location`; **`travel_advisory`** =
  live traffic along the polyline as `"fromIdx,toIdx,level|…"` (levels seen: 0,5,10,15 — verify meaning in
  Ola docs; treat higher = slower). Usable as the traffic source when TomTom is absent.
- Tiles: style `GET /tiles/vector/v1/styles/default-light-standard/style.json?api_key` (130 layers, detailed
  India incl. NCR outskirts) — key must be attached to tile/source URLs (proxy or transformRequest).

## TomTom + Mappls — VERIFIED LIVE (17:45 IST; keys in ~/.config/alive-ops/keys.env as TOMTOM_API_KEY, MAPPLS_API_KEY)
- TomTom routing+traffic `GET https://api.tomtom.com/routing/1/calculateRoute/{lat,lon}:{lat,lon}/json?key&traffic=true&sectionType=traffic&travelMode=car&computeTravelTimeFor=all&maxAlternatives=2`
  → routes[].summary.{lengthInMeters,travelTimeInSeconds,trafficDelayInSeconds,noTrafficTravelTimeInSeconds},
  sections[] where sectionType=="TRAFFIC": simpleCategory (JAM…), magnitudeOfDelay, delayInSeconds,
  effectiveSpeedInKmh, startPointIndex/endPointIndex into legs[].points. CP→ISKCON now: 30 min live, +2 min,
  one JAM (7 km/h). ~1.9 s latency → never on the keystroke path; cache 60 s.
- TomTom flow segment `GET https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=lat,lon&key`
  → flowSegmentData.{currentSpeed,freeFlowSpeed,confidence,roadClosure}.
- TomTom flow tiles `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key&tileSize=256` → PNG (24 KB, 945 ms).
- TomTom incidents v5 works but the central-Delhi bbox response is ~500 KB → request a SMALL bbox around the
  route/viewport and a minimal `fields` set; stream/timeout 6 s.
- Mappls autosuggest `GET https://search.mappls.com/search/places/autosuggest/json?query&location=lat,lon&access_token=$MAPPLS_API_KEY`
  → suggestedLocations[]: placeName, placeAddress, eLoc, type, distance — latitude/longitude are NULL on this
  plan (coordinates are a Mappls premium field). "neelanchal dham sant nagar" → #1 "Nilanchal Dhaam Bace ·
  Sant Nagar, East Of Kailash" (the 3rd test address — Ola autocomplete misses it). 0.7–4 s latency.
- Mappls geocode `GET https://search.mappls.com/search/address/geocode?address&itemCount&access_token` →
  copResults: formattedAddress, eLoc, geocodeLevel, confidenceScore; lat/lon NULL on this plan.
- BRIDGE (verified): Mappls name+address → Ola geocode gives coordinates: "Nilanchal Dhaam Bace, Sant Nagar,
  East Of Kailash, New Delhi, Delhi" → Ola "Nilanchaldhaam BACE, 386 ISKCON, Sant Nagar…" @28.5553,77.251.
  So: provider ac = Ola autocomplete (fast, has coords) ∪ Mappls autosuggest (deep, no coords → resolve the
  picked/top rows via Ola geocode of "placeName, placeAddress"). Also try Ola geocode of the raw query when
  autocomplete has no strong match.
- Ola Directions `travel_advisory` + TomTom are both live traffic sources; prefer TomTom sections for jam
  locations/delay, Ola for alternatives with turn-by-turn steps.
