# Lane: providers — deep provider-layer enrichment (2026-10-12)

Scope: `server/v2/providers.py` + `server/tests/test_providers.py`. Goal: the
route/traffic call now asks for — and returns — every feature the paid APIs
actually serve on our keys. All fields REAL from provider payloads; anything
the key can't serve is absent, never faked. Backward compatible: only added
fields / optional request params; existing keys unchanged.

## Live-verified feature matrix (real keys, CP→Nehru Place 28.6315,77.2167 → 28.5494,77.2502)

### TomTom Routing API (`calculateRoute`, POST + supportingPoints)

| Feature | Requested now? | Served on key? | Wire field |
|---|---|---|---|
| live/freeflow/delay times (`traffic=true`, `computeTravelTimeFor=all`) | already | YES | `live_s`,`freeflow_s`,`delay_s`,`length_m` (unchanged) |
| TRAFFIC sections (jam spans: delay, magnitude, category, speed) | already | YES | `jams[]` (unchanged shape) |
| IMPORTANT_ROAD_STRETCH (road names) | already | YES | `jams[].road` + NEW `roads[]` (ordered named stretches) |
| `maxAlternatives=3&alternativeType=anyRoute` | NEW | YES (4 routes live) | `alternatives[]` — same shape as primary, incl. own jams/flags/polyline + `deviation_m`,`deviation_s` |
| `instructionsType=text&language=en-GB` (turn-by-turn guidance) | NEW | **NO** — `legs[].guidance` absent even for Berlin on this key/plan | `instructions[]` parsed & emitted only if ever returned |
| `extendedRouteRepresentation=distance,travelTime` | NEW | YES | `progress[]` `{i,t_s,d_m}` cumulative per route point |
| `sectionType=toll/tollVignette` + `includeTollPaymentTypes=all` | NEW | YES (TOLL spans on DND CP→Noida alts; payment list empty for India) | `tolls[]` `{from_m,to_m,lat,lon,end_lat,end_lon,payments[]?,vignette?}` + `flags.toll` |
| `sectionType=speedLimit` | NEW | YES (16-20 SPEED_LIMIT sections/route, e.g. 45/50 kmh) | `speed_limits[]` `{from_m,to_m,kmh}` |
| `sectionType=urban,tunnel,motorway,unpaved,lowEmissionZone,carpool,ferry,carTrain,pedestrian,country` | NEW | YES (URBAN/TUNNEL/COUNTRY seen live) | `flags{}` — bool per requested type (false = checked, absent on route; key absent = never asked) |
| `departAt` (future/planning traffic) | NEW (body `depart_at`) | YES (verified: tomorrow 08:30 → different live_s, echo depart_at) | `depart_at`,`arrive_at` (ISO, verbatim) |
| consumption model (`vehicleEngineType` + `constantSpeedConsumption*`) | NEW (body `fuel_l100`/`kwh_100km`) | YES (`fuelConsumptionInLiters`,`batteryConsumptionInkWh` — 0.803 L live) | `fuel_l` / `battery_kwh` per route incl. per-alternative |
| `routeRepresentation=polyline` (dense geometry) | NEW (explicit) | YES | `polyline` `[[lat,lon]…]` per route (348–550 pts live) |
| `report=effectiveSettings` | probed | YES | not exposed (debug-only upstream echo) |
| historic/incident split | NEW | YES | `historic_s`,`incidents_s`,`traffic_length_m` |
| `tollRoad` sectionType | deliberately NOT requested | deprecated upstream (400 risk); `toll`/`tollVignette` replace it | — |
| toll *amounts* (`computeTollAmounts`) | probed | **NO** ("Invalid compute toll amounts value: [all]" — not offered) | — |

400-retry kept: second call drops extra sectionTypes/guidance/extended/
departAt/consumption, keeps traffic+alternatives (verified live-safe).

### Ola Maps Directions (`/routing/v1/directions`, POST)

| Feature | Requested now? | Served? | Wire field |
|---|---|---|---|
| `traffic_metadata` travel_advisory | already | YES | `jams[]` projected onto our line + NEW `level` (raw 0/5/10/15) + raw `advisory` string |
| `alternatives=true` | NEW (was false) | YES (3 routes live) | `alternatives[]` — each own `live_s`,`length_m`,`jams[]` (on own polyline),`polyline`,`instructions`,`summary` |
| `steps=true` | NEW (was false) | YES (22-32 steps/route) | `instructions[]` `{i,text,maneuver,distance_m,duration_s,lat,lon}` |
| `mode` | NEW | `driving`/`walking` verified; `bike`/`auto` per docs | request maps our modes (car-family→driving, pedestrian→walking, bike→bike, auto→auto) |
| `route_preference=fastest`, `language=en` | NEW | YES | — |
| `overview=full` polyline | already | YES | NEW `polyline` (decoded) |
| `summary`/`warnings`/`bounds` | — | summary/warnings live | `summary`,`warnings` emitted when non-empty |
| waypoints / distanceMatrix / routeOptimizer | — | exist upstream | not needed by current seam |

### Mappls

| Capability | Status on our static REST key |
|---|---|
| autosuggest / geocode / rev-geocode / nearby (`search.mappls.com`) | YES (in use, unchanged) |
| route / route_adv / traffic routing (`apis.mappls.com/advancedmaps`) | **NO** — "Client Credentials Expired"/"does not exist"; advancedmaps wants OAuth client creds we don't hold |
| reverse-geocode extras | NEW: `pincode`, `state`, `district` now surfaced on `/v2/p/reverse` |

## Response fields ADDED (consumed defensively by plan/frontend lanes)

`POST /v2/p/route_traffic` & `traffic_for_route()` return:
`historic_s, incidents_s, traffic_length_m, depart_at, arrive_at, fuel_l,
battery_kwh, polyline, roads, tolls, speed_limits, flags, progress,
instructions, advisory, summary, warnings, alternatives[]`
Each `alternatives[]` entry = same shape minus `alternatives`.
Ola-sourced: `jams[].level` added; Ola gives no delay_s/speed_kmh (None).
Request gains optional `mode` (extended: bicycle/pedestrian), `depart_at`
(ISO 8601), `fuel_l100` / `kwh_100km`. Invalid extras are ignored, never 400.

For `/v2/plan` + frontend lanes: use `alternatives` for route choice,
`instructions` (Ola only today) for turn-by-turn, `progress` for ETA-at-point,
`flags.toll`/`speed_limits` for chips, `polyline` for drawing provider geometry.

## Also fixed (pre-existing failure in owned file)
- `merge_results` gained `drop_letterless` (default keeps type-ahead junk
  rule); `/v2/p/geocode` passes False so a bare house-number hit ("237" →
  "237, Okhla Industrial Estate Phase 3") is returned, not dropped.
  House-number-only names are also anchored to their locality for display.

## Tests
- `pytest tests/test_providers.py`: **29 passed** (was 23 pass + 1 fail).
  New: full-depth TomTom fields, request-param surface, fuel/depart_at,
  Ola steps+alternatives+mode map, reverse pincode/state.
- `pytest tests/test_v2.py test_modes_oct11.py test_v2_hardening.py`:
  109 passed — no regressions.
- Live: CP→Nehru Place verified end-to-end for TomTom (4 routes, toll/speed/
  progress/flags) and Ola fallback (steps, 2 alternatives, advisory, level).

## Timeout/outage safety (unchanged semantics)
- 3 s hard deadline per outbound call; TomTom timeout/error → Ola fallback
  → honest failure (verified live: one TomTom timeout correctly degraded to
  Ola with `source:"ola"`, no hang). Daily budgets unchanged (same call count
  per request — richer response, not more calls).

## Open gaps (honest)
- TomTom guidance `instructions[]` absent on current key/plan — Ola's
  `instructions` carry turn-by-turn whenever Ola answers; on TomTom answers
  the key is simply missing.
- No toll *amounts* anywhere (TomTom toll amounts not in this API tier;
  Ola none; Mappls unreachable) — `tolls[]` = spans + payment types only.
- Mappls routing requires OAuth credentials not in keys.env — routing depth
  is TomTom (primary) → Ola (fallback).
