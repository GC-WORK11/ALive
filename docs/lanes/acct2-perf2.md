# Lane report — PERF2 re-probe (acct2)

Base: `https://d2eh2l2ys9wkij.cloudfront.net` · measured 2026-10-11 ~04:20–04:30 UTC · prod build moved since first probe (search T3/indexfix landed on main).
Transport floor ≈ 265 ms. All `srv_ms` figures are the server's own `took_ms` — server-side time, not network.

## /v2/search — 30 Delhi queries × 2 passes

Overall (n=60): **min 281 · p50 478 · p95 3522 · max 3801 ms** — bimodal: gazetteer hits fast, multi-token POI queries slow.

| Query | min/max ms | srv_ms | top result | match |
|---|---|---|---|---|
| hanuman mandir ashok nagar shahdara | 1050/1084 | 777 | Hanuman Mandir Ashok Vihar P… | category |
| sikanderpur metro station | 505/509 | 231 | Bharat Petroleum Fuel Fillin… | category |
| connaught place | 387/710 | 108 | Connaught Place | exact-prefix |
| india gate | 281/375 | 74 | India Gate | exact-prefix |
| karol bagh | 433/437 | 167 | Karol Bagh | exact-prefix |
| lajpat nagar | 479/651 | 363 | Lajpat Nagar | exact-prefix |
| hauz khas | 420/431 | 162 | Hauz Khas | exact-prefix |
| saket | 331/416 | 62 | Saket | exact-prefix |
| rohini | 370/372 | 104 | Rohini | exact-prefix |
| pitampura | 327/327 | 62 | Pitam Pura | token-prefix |
| dwarka sector 8 | 597/602 | 327 | Dwarka Sector 8 | exact-prefix |
| noida city centre | 932/1076 | 665 | Noida City Centre metro | exact-prefix |
| gurgaon cyber city | 570/571 | 306 | Gurgaon Cyber City | exact-prefix |
| faridabad | 357/363 | 88 | Faridabad | exact-prefix |
| anand vihar | 476/478 | 210 | Anand Vihar | exact-prefix |
| kashmere gate | 367/375 | 102 | Kashmiri Gate | exact-prefix |
| rajiv chowk | 399/573 | 298 | Rajiv Chowk, New Delhi | exact-prefix |
| aiims | 578/579 | 311 | All India Institute… | exact-prefix |
| **select citywalk** | **3404/3408** | **3139** | Select Citywalk | exact-prefix |
| **dlf mall** | **3315/3316** | **3050** | Dlf Mall | exact-prefix |
| **pacific mall subhash nagar** | **3708/3715** | **3443** | Subhash Nagar Pacific Mall | token-prefix |
| pvr vikaspuri | 362/420 | 95 | PVR VIKASPURI | exact-prefix |
| **hanuman mandir cp** | **3522/3801** | **3516** | Connaught Place | token-prefix |
| akshardham temple | 369/402 | 102 | Akshardham Temple | exact-prefix |
| lotus temple | 380/380 | 99 | Lotus Temple | exact-prefix |
| jama masjid | 380/422 | 114 | Jama Masjid | exact-prefix |
| chandni chowk | 475/525 | 234 | Chandni Chowk | exact-prefix |
| sarojini nagar market | 631/959 | 679 | Sarojini Nagar Market | exact-prefix |
| laxmi nagar | 464/466 | 196 | Laxmi Nagar | exact-prefix |
| mayur vihar phase 3 | 1093/1316 | 1053 | RWA Pocket B-3 Mayur Vihar P… | exact-prefix |

**>2 s flag — deterministic, not load.** Rechecked post-run: `select citywalk` 3138 ms, `dlf mall` 3052 ms, `hanuman mandir cp` 1580 ms **again**, while `t1` (local engine) is 3–24 ms. The ~3 s is spent in the T3 live Overpass arm (results still correct — Select Citywalk/Dlf Mall resolve). Same-class multi-token POI queries will all pay this. No timeout/cache floor visible.

## /v2/plan — latency

Measured window had a **transient server-side spike**: 5 ODs × 2 — min 1136 · p50 5110 · p95 9731 ms, srv_ms up to 7940 (Rohini→Saket) / 7564 (Narela→Badarpur) / 6163 (Dwarka→Noida); even 1.5 km hop = 804 srv_ms vs ~170 ms earlier today.

Rechecked 3× minutes later: e2e 1.38–2.10 s, srv_ms 509–783 — back near baseline. **Verdict: load spike (multi-lane probing on one box), not a code regression — but the box saturates: 2 rps/burst-6 limit + heavy queries queue hard. Flag for capacity, not correctness.**

## /v2/city — freshness

301 ms. `field_age_s: 287` / `refresh_in_s: 613` of declared 900 s TTL, `stale:false`, `built_epoch` 1791692287 (rebuild cadence still ticking ~900 s). `cached_s` disclosed. Rich honest block: breath bands, pm25_stats vs WHO/CPCB, corridors, `enough_data:true`. **Fresh — no lie.**

## /grid — payload size

| Path | ms | bytes | features |
|---|---|---|---|
| cells=40 pm2_5 | 416 | 362,823 | 1600 |
| cells=40 us_aqi | 2017 | 431,609 | 1600 |
| cells=20 pm2_5 | 442 | 87,396 | 400 |
| cells=40 pm2_5&compress=1 | 1327 | 362,823 | 1600 |

- `us_aqi` param hit ~2 s edge (2017 ms) once; pm2_5 stays ~0.4 s.
- Identity payload is chunky (363–432 KB) but **gzip works**: `Accept-Encoding: gzip` → 24,237 B (15×). `compress=1` query param is silently ignored — clients must use HTTP compression.
- cells cap is 40 (earlier spec of 400 → honest 422).

## /v2/playtime

5 calls: min 274 · p50 384 · max 608 ms. 24 hourly windows + best/worst + `confidence`/`sparse`/`beyond_edge`/`nearest_station_km` — fine.

## Flags (>2 s or stale)

1. **search T3 arm: 3.0–3.5 s deterministic** on multi-token POI queries (select citywalk, dlf mall, pacific mall subhash nagar, hanuman mandir cp ~1.6–3.5 s). Locality queries unaffected (~60–360 srv_ms). Worth a timeout cap + cache.
2. **plan saturates under concurrent load**: observed srv_ms 3.8–7.9 s during a multi-client window; recovers to ~0.5–0.8 s quiet. Fine solo, fragile in a demo pile-up.
3. grid us_aqi ~2 s edge case; grid identity payload 363 KB (gzip mandatory).
4. **Nothing stale**: field age 287 s of 900 s TTL across /aqi, /v2/city, /health; rebuild epoch advancing on schedule.

## Addendum — :266 verification (build c93d8203, ~04:40 UTC)

Coordinator's four ranking fixes confirmed live (not defects, per instruction):

| Query | srv_ms | #1 result | note |
|---|---|---|---|
| sikanderpur metro | 56 | Sikanderpur metro station, Gurugram | fixed + fast |
| terminal 1 | 3350 | Terminal 1 IGI Airport | correct #1 |
| terminal 2 | 3388 | Aurelia – Terminal 2 (Departure) | a T2-sited store row, not the terminal node — per coordinator, expected |
| delhi airport t1 | 3103 | New Delhi Airport Express Terminal | airport-class row, honest |

Ranking fixed; the ~3.1–3.4 s T3-arm cost on these airport/multi-token queries is unchanged — same flag as above.

## Relay status

No new patch attached to the PERF+RELAY message — earlier stack (coord-stack5, parity-fix) already on main @0645c3c; other lanes landed e2e-fix/pick-mode since (main was 78c1dc8 pre-this-commit).
