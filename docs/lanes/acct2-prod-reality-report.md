# Lane report — PROD REALITY (acct2)

Base: `https://d2eh2l2ys9wkij.cloudfront.net` · measured 2026-10-11 ~01:55–02:15 UTC · build `ab40cc00`
Client: macOS, Python urllib + curl, from outside the VPC. Transport floor ≈ 265 ms (TLS + RTT to ap-south-1); everything below that number is network, not compute.

## 1. Latency — 10 sequential + 10 concurrent per endpoint (ms)

| Endpoint | seq min | seq p50 | seq p95 | seq max | conc min | conc p50 | conc p95 | conc max | codes |
|---|---|---|---|---|---|---|---|---|---|
| GET /health | 285 | 295 | 605 | 605 | 293 | 539 | 546 | 546 | 200×10 / 200×10 |
| GET /aqi?lat=28.63&lon=77.24 | 270 | 281 | 338 | 338 | 322 | 332 | 352 | 352 | 200×10 / 200×10 |
| GET /v2/why?lat=28.63&lon=77.24 | 276 | 284 | 320 | 320 | 268 | 269 | 282 | 282 | 200×10 / 200×10 |
| GET /v2/search?q=connaught+place | 266 | 271 | 306 | 306 | 308 | 324 | 359 | 359 | 200×10 / 200×10 |
| GET /grid?cells=400&param=pm2_5 | 265 | 272 | 316 | 316 | 277 | 288 | 304 | 304 | **422×10 / 422×10** — spec bug: cells cap is 40 |
| GET /grid?cells=40&param=pm2_5 | 335 | 341 | 1278 | 1278 | 709 | 1805 | 2060 | 2060 | 200×10 / 200×10 |
| GET /v2/playtime | 275 | 280 | 298 | 298 | 297 | 320 | 363 | 363 | 200×10 / 200×10 |
| GET /v2/city | 266 | 278 | 371 | 371 | 298 | 312 | 330 | 330 | 200×10 / 200×10 |
| GET /v2/districts | 265 | 275 | 583 | 583 | 286 | 290 | 297 | 297 | 200×10 / 200×10 |
| GET /v2/stays | 263 | 270 | 1134 | 1134 | 272 | 276 | 307 | 307 | 200×10 / 200×10 |
| POST /v2/plan (run 1) | 715 | 721 | 2955 | 2955 | 1215 | 2457 | 2751 | 2751 | 200×10 seq; conc mixed 200+429 |
| POST /v2/plan (run 2) | 492 | 502 | 708 | 708 | 509 | 3042 | 3321 | 3321 | 200×10 seq; 200×8 + **429×2** conc |

Notes:
- Read endpoints are effectively at the network floor: ~10–50 ms of server time over transport. `/grid` at the real max (40 cells) is the heaviest read: +~70 ms seq, ~1.5 s of queuing under P=10.
- `/v2/plan` enforces a real, disclosed rate limit: 429 body `{"error":"rate_limited","retry_after_s":1,"limit":{"rate_per_s":2.0,"burst":6.0}}`. At P=14, 8/14 throttled — consistent with burst 6 + ~2 rps. This is honest throttling with machine-readable limits, not a flake.
- p95 outliers on /health, /districts, /stays, /grid seq runs are single cold-ish hits, not a pattern.

## 2. Freshness truth — VERDICT: HONEST

`/aqi` twice 30 s apart: `field.age_s` 664→695 (ticks 1:1 with wall clock), `field.refresh_in_s` 236→205 (counts down), `field.built_epoch` held at 1791683282 between builds, declared `refresh_ttl_s: 900`, `stale_after_s: 2700`, `stale: false`. Fire age 662→694, wind age 666→697 — same tick.

24 min later: `built_epoch` advanced 1791683282 → 1791684189 (+906.7 s ≈ the declared 900 s TTL), `age_s` reset to 259. **The "15-min rebuild" is real and observable, not a static label.**

`/grid` pins `properties.cell_epoch = [<same built_epoch>, 0]` — the grid serves the same field build /aqi reports. Byte-identical across 30 s within a build window (correct: deterministic slice of an unchanged field).

`/health` publishes the same ages plus per-source ages, and openly discloses gaps: `sources.location.up: false, key: "unset"`. `/v2/search` echoes it: `t2_status: "disabled:no ALIVE_LOCATION_KEY"`. They publish their own missing pieces — the opposite of a freshness lie.

## 3. Plan semantics — VERDICT: REAL ROUTES, HONEST DEGRADATION

- Option count varies by OD (16–24): A CP→SW 24, C Rohini→Saket 20, E 1.5 km hop 21, F Narela→Badarpur 16, G 16. Not a fixed list.
- Modes served: car (AC), car_open (windows down), bike/scooter, auto, cycle, walk, **bus with named route_ids (Bus 505, Bus RL-75)**, metro+walk — GTFS-backed, matching `/health` `transit.compiled:["bus","metro"]`.
- Numbers differ meaningfully (pair A, 10 km): car-AC dose 4.1 µg / 846 s vs walk 104.6 µg / 6522 s — ~25× dose spread; least-smoke alternates carry distinct geometry, distance and dose; emissions differ by mode (car co2 1.27 kg vs walk 0.0).
- Ranking rule disclosed on the wire: `"dose_lo within 10% ties, lowest emission wins"`.
- Requested vehicle does not alter the option math (car-request vs walk-request → identical dose per option) — it sets `vehicle_profile` + `your_vehicle` flags. Correct semantics: your vehicle shouldn't change what a bus emits.
- Unknown vehicle falls back honestly: `spaceship→car`, `ev→car`, `foot→walk`, `bicycle→cycle` — with `vehicle_requested` preserved and `vehicle_profile: null`. Not silent.
- `partial:true` does **not** exist as a field — but partialness is carried, and it's honest: out-of-field plan (→Jaipur) returns `degraded:["engine"]` top-level + per-option `reaches_destination:false`, `truncated_gap_km:174.2`, `dose.basis:"…route stops ~174km short of the destination at the field edge"`, `dose.confidence:"low"`. `degraded:["engine"]` also appears on from==to. Flag name differs from the spec's `partial` but the semantics are there and they don't lie.
- ETA models named per option: `osrm-freeflow` vs `estimated`.

## 4. Error honesty — 24 probes, zero 5xx, zero stack-trace/internal leaks

| Probe | Result |
|---|---|
| /aqi Paris / lat=999 | 200 `{pm25:null, error:"outside service area — dose field covers Delhi/NCR only"}` — clean refusal |
| /aqi just outside bbox (27.9,76.4) | 200 real answer + `beyond_field_edge:true` + `nearest_sample_km:59.2` — extrapolation flagged, not hidden |
| /aqi missing lat/lon; lat=abc | 422 FastAPI detail, field-level loc+msg |
| /aqi extra junk param | 200, ignored |
| /v2/search garbage q | 200 `count:0, results:[]` + discloses `t2_status:"disabled:no ALIVE_LOCATION_KEY"` |
| /v2/search missing q / empty q | 422 (missing / min_length) |
| /v2/why missing params | 200 — defaults to city scope, declares it via `scope`/`point_in_area` (different convention than 422 endpoints, but declared) |
| /v2/playtime lat=200 | 200 `hours:[], error:"outside service area…"` |
| /v2/stays missing params | 422 `near or lat+lon required` |
| /grid cells=0 / cells=400 | 422 ge:1 / le:40 |
| /grid param=banana | 200 empty FeatureCollection + `properties.served` lists the 11 valid params — self-documenting |
| /v2/nonexistent | 404 `{"detail":"Not Found"}` |
| plan `{}`, empty from/to, missing to, string lat | 200 `{options:[], error:"from: need {lat,lon} or [lon,lat]"}` etc. — **honest but non-RESTful: errors ride 200, client must parse body** |
| plan unparseable JSON | 422 `json_invalid` |
| plan from==to | 200 + `degraded:["engine"]` + 8 options |
| plan bogus vehicle | 200, honest fallback (see §3) |

Only wart: `/v2/plan` domain errors return HTTP 200 with an `error` field instead of 4xx. The errors themselves are truthful and specific; the status code just doesn't carry them.

## 5. Search depth — 20 Delhi localities

Match-type distribution on top result: `exact-prefix` 16 · `token-prefix` 2 · `area` 1 · `other` 1. `fuzzy:false` on all 20.

- **Exact locality hit: 17/20** — shahdara, sant nagar, tilak nagar, jahangirpuri, karol bagh, lajpat nagar, hauz khas, saket, ashok vihar, sarita vihar, badarpur (stored "Badar Pur"), nangloi, narela, bawana, mukherjee nagar, geeta colony, pitampura (stored "Pitam Pura", token-prefix).
- **Right locality, qualifier dropped: 2/20** — mayur vihar ph1 → "Mayur Vihar" macrohood; okhla ph2 → "Okhla" locality.
- **Miss: 1/20** — rohini sec 7 → "7-10 Park Street" (address, `match:area`) — the sector intent is lost.
- Garbage fallbacks: 0. Empty results on real queries: 0. Every answer was a plausible Delhi place; a nonsense query returns `count:0` honestly.

## Push access

**PUSH_OK** — `test/acct2-push-check` pushed and deleted cleanly on `origin` (git-manager proxy → github.com/GC-WORK11/ALive).
