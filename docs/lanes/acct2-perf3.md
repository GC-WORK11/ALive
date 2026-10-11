# Lane report — PERF3 (acct2)

Base: `https://d2eh2l2ys9wkij.cloudfront.net` · build **c5d66e11** (:269) · measured 2026-10-11 ~04:55–05:05 UTC · n=5 per cell. Baseline = perf2 (:265-ish, ~04:20 UTC). Transport floor ≈ 265 ms.

## Headline: gazetteer 124k→210k rows — NO search regression

| Query class | perf3 p50 ms | perf2 reference | verdict |
|---|---|---|---|
| short (saket, rohini, dwarka, noida, karol bagh) | 301–361 | 331–433 | same or faster |
| anchor/deep (hanuman mandir ashok nagar shahdara, sikanderpur metro, dwarka sector 8, sarojini nagar market) | 396–712 | 437–1084 | faster (hanuman: 1084→712) |
| mayur vihar phase 3 | 1085 | 1093 | flat — still the locality+qualifier slow case |
| Overpass-arm (select citywalk, dlf mall, terminal 1) | 3301–3726 | 3050–3443 | unchanged slow — see flag |
| pacific mall subhash nagar | 1861 (p95 3537) | 3443 | improved/bimodal — some calls skip the arm now |
| delhi airport t1 | 753 (p95 1662) | 3103 | improved post-poolgap — literal rows reach merge first |

Doubling the index cost ~0 ms on gazetteer-class queries — t1 stayed at ms scale. The only slow class is unchanged: the live Overpass arm.

## /v2/plan POST

| OD | min | p50 | p95 | max | note |
|---|---|---|---|---|---|
| CP→SW (~10 km) | 734 | 743 | 2274 | 2274 | one >2 s outlier |
| Rohini→Saket (~29 km) | 1782 | 1789 | **8124** | 8124 | long-haul p95 flag |
| short 1.5 km | 375 | 375 | 571 | 571 | fine |

Long routes price ~1.8 s typical with occasional 8 s+ queue events (same load sensitivity as perf2 — single box, 2 rps/burst-6 limiter, multi-lane traffic).

## /v2/reverse (new this round)

| Path | p50 | codes | body |
|---|---|---|---|
| /v2/reverse?lat=28.63&lon=77.24 | 263 | 200 | `near Comptroller And Auditor General Of India`, dist 14.8 m, `source:"gazetteer"` |
| /reverse?lat=28.63&lon=77.24 (unversioned twin) | 360 | 200 | same |
| /v2/reverse?lat=28.55&lon=77.19 | 261 | **404** | `{"error":"no named place within 150m","dropped_pin":true}` — honest 4xx for a real not-found |

Fast, honest, gazetteer-sourced.

## Map tiles

| Endpoint | p50 | result |
|---|---|---|
| /tiles/health | 266 | 200, archive present |
| /tiles/tilejson.json | 264 | 200 TileJSON |
| /tiles/delhi/12/2926/1707.mvt | 495 | 200, 84.6 KB `vnd.mapbox-vector-tile` |
| /tiles/delhi.pmtiles Range 0-65535 | 281 | **206 Partial Content** — Range honored |

All at/near floor; pmtiles Range support verified.

## /health

p50 275 ms; `build_sha:c5d66e11`, `field_age_s:272` of 900 s TTL — fresh.

## >2 s / stale flags

1. **search Overpass arm still 3.3–3.9 s** on mall/airport-class multi-token queries (select citywalk 3344, dlf mall 3301, terminal 1 3726) — unchanged from perf2, unaffected by gazupdate. Suggest timeout cap + result cache before demo traffic hits it.
2. **plan long-OD p95 8.1 s** (Rohini→Saket) — load-queue sensitivity, same flag as perf2.
3. Nothing stale: field age 272 s; all freshness disclosures intact.
