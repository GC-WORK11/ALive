# 04 · The government data platform — local (Delhi) edition

Series: `docs/gov/local/` — the municipal product line. 01–03 cover the
pitch, the data inventory and the privacy/legal posture; this document is
the engineering design. "Local" means the buyers that actually own the
streets: **PWD** (roads), **Delhi Traffic Police** (signals), **Transport
Dept / DTC** (transit), **MCD** (trees, street works), **DPCC** (air).
State/national variants inherit this design with the region list widened.

The premise: every ALive trip that completes with sharing on already
donates a trimmed, thinned, hashed, cell-folded record (`server/v2/trip.py`,
`server/v2/store.py`, `server/agg_ddb.py`). The consumer app turns those
donations into corridors and a city ledger. The government platform turns
the same donation stream into a **planning instrument**: which corridors
carry the most inhaled dose, when, by what mode, with what estimated
emissions — and whether the thing the city just built changed any of it.

The hard boundary, restated because every number below depends on it:
**no raw trajectories ever exist server-side.** The donation pipeline
trims 300 m off both ends, thins to ~100 m, rounds to ~11 m, converts to
H3 res-8 cells and discards the payload inside the request
(`server/v2/trip.py:185-209`). The gov layer cannot leak what was never
stored — it can only ever be a reader of aggregates, so its privacy job
is *threshold and noise discipline*, not data hygiene.

---

## 1. What the platform sells, in one paragraph

A weekly-refreshed, k-anonymized, methodology-documented dataset of
**corridor × IST hour-of-week × mode** traversals — trips, distinct
donating devices, km, inhaled-dose sum, estimated CO2/PM2.5 emitted, and a
congestion histogram — plus an intervention registry that automatically
produces before/after reports for anything the city builds on a watched
corridor. Delivered as a console, a versioned REST API, and export
channels (CSV / GeoJSON / Parquet) that can land in a government-owned
bucket. Everything stays in `ap-south-1` (Mumbai), where the platform
already lives.

---

## 2. The aggregate data model

### 2.1 The atom: corridor-cell × hour-of-week

The consumer layer's publishable unit is the bare H3 res-8 cell
(`cell#<h3>` items, `count` + `dose_sum` + a hashed-token set, 30-day
TTL, k≥3 in a rolling 72 h window — `server/agg_ddb.py:44-52`). That is
right for a live map and wrong for planning: a planner needs the same
corridor's **recurring weekly rhythm** (Tuesday 8 am vs Saturday 8 pm),
kept for months, at a stricter anonymity bar.

The gov atom is therefore a different item family — written by the same
`record_trip` call, at donation time, alongside the existing items:

| dimension | value | why |
|---|---|---|
| space | one H3 res-8 cell (~0.74 km²) | the privacy pipeline's only spatial unit — already the public aggregate cell (doc 05 §2: ~12k cells NCR, ~2k in NCT) |
| time | ISO week + weekday (1–7) + hour (00–23), **all in IST** | "where do jams recur" is an hour-*of-week* question; a planner thinks in civil Delhi time, not UTC epoch hours (the existing `recent`/`hour#` items are UTC — fine for an ops feed, wrong for this) |
| mode | the donation's sanitized mode token (`_MODE_RE`, `trip.py:138`) | greening/transit decisions are mode decisions |

Per atom item, counters (all `ADD`, idempotent-safe alongside the
existing dedupe in `trip.py:47-80`):

```
trips            traversals touching the cell in that hour
devices   (SS)   hashed tokens — the k-anonymity set, same discipline
                 as every other layer (sha256[:16], rotated 30 d on the
                 device, never the raw token)
km_sum           trip km spread evenly over its distinct cells — the
                 existing even-attribution contract (agg_ddb.py:153-158);
                 it stays the only honest split while per-cell path
                 lengths aren't retained
dur_s_sum        same even split of duration_s — feeds the speed proxy
dose_ug_sum      Σ estimated inhaled PM2.5 (µg) across traversals
co2_g_sum        Σ co2_kg_mid × 1000 → grams (mid band only — the
                 emissions engine never emits a point, docs/29 §5)
pm25_g_sum       Σ emitted PM2.5 grams (pm25_g_mid)
switched         traversals the app counted as taking a lighter way
sp_lt8, sp_8_15, sp_15_25, sp_gt25
                 congestion histogram — each traversal's whole-trip
                 mean speed (distance_km / duration_s, already bounded
                 at ingest: trip.py:266-269) credited once to every
                 distinct cell it crossed
last_ts          freshness stamp
ttl              write + 400 d (planning horizon; S3 exports are the
                 system of record beyond it)
```

**The speed histogram is a proxy, stated as one everywhere it appears:**
a traversal's single whole-trip mean speed is credited to each cell on
its path — a cell with a high `sp_lt8` share is where *slow trips pass*,
not a measured link speed. It is honest for recurrence questions ("this
stretch is in the slow bucket 6 of the last 8 Tuesday 9 am hours") and
dishonest for engineering-speed claims; §7 covers the calibration path
(government's own counts) that upgrades it.

### 2.2 DynamoDB key-schema extension — same table, new families

`alive108-agg` already carries four key families on generic `pk`/`sk`
string attributes (`infra/provision.sh:123-131`, layout in
`agg_ddb.py:12-22`). The gov plane adds three families to **the same
table** — the task IAM role already holds `dynamodb:*` on exactly this
table, `provision.sh` needs no new resource, and every existing read is
prefix-scoped (`_scan` filters `pk.startswith`, `agg_ddb.py:456-468`)
so the families cannot interfere. New table = new IAM, new provision,
new backup story — for zero isolation benefit, since nothing in any
family is person-identifiable anyway.

```
pk                       sk                                notes
──────────────────────────────────────────────────────────────────────────
(existing — unchanged)
day#YYYY-MM-DD           sum | mode#<mode>                   city/day counters, no ttl
cell#<h3>                cell                             consumer corridor cell, 30 d ttl
recent                   hour#<h>[#mode#<m>]                UTC-hour ops feed, 72 h ttl
global                   area#<n> | od#<o>#<d> | sum        district/OD layer
ledger#<token_hash>      trip#<ts>                          per-device ledger, 90 d ttl
ledger_meta              device#<token_hash>                device index
──────────────────────────────────────────────────────────────────────────
(new — gov plane)
cor#<h3>                 hw#<YYYY-Www>#<dow>#<hh>           the §2.1 atom
                         hw#<YYYY-Www>#<dow>#<hh>#m#<mode>   mode slice: trips,
                                                            devices SS, dose_ug_sum,
                                                            km_sum — k-gated per row
gov#cor#<corridor_id>    def                              corridor registry (§2.3)
gov#intv#<id>            meta                             intervention registry
                         rep#<YYYY-Www>                    weekly before/after
                                                            report rows (§6)
gov#idx                  wk#<YYYY-Www>                    rollup-materialized
                                                            rankings (§6)
gov#od                   wk#<YYYY-Www>#<o>#<d>            per-week OD pair:
                                                            trips, devices SS —
                                                            the existing all-time
                                                            `global`/`od#` layer
                                                            re-keyed weekly (§3.5)
gov#meta                 dp#<YYYY-MM>                      DP ε spend ledger
                         export#<ts>                       export audit rows
                         methodology                       pinned doc version+sha
gov#cal                  corridor#<corridor_id>            gov-supplied ground
                                                            counts (§7.4)
```

`sk` grammar: `dow` = ISO weekday 1–7, `hh` = IST hour 00–23 (donation
`ts` is converted to Asia/Kolkata before bucketing), `<YYYY-Www>` = ISO
week of that IST date. Example: `cor#892a828d47fffff` /
`hw#2026-W14#2#08` = that cell, Tuesday 08:00–09:00 IST, week 14 of
2026. `#m#<mode>` slices carry their own `devices` set — a mode row is
published only when it independently clears k (§2.4).

TTL: `cor#` items expire at write + 400 d — long enough for a baseline
window + a year of afters; every weekly export to S3 is the permanent
record (same relationship the field layer has: DDB hot, S3 durable —
`server/rollup.py`). Registry/report/meta items have no `ttl`.

Cost honesty: +2 writes per distinct cell per donated trip (atom + mode
slice) + 1 `gov#od` item when both endpoint areas resolved. A 15-cell
trip adds ~31 writes; at PAY_PER_REQUEST (~US$1.25/M writes in
ap-south-1) a million donations ≈ US$40 of gov-plane writes.
Guarded by env flag `GOV_AGG=1` so the consumer path can run without it.

### 2.3 Corridor registry

A **corridor** is a named set of cells — the atom answers per-cell
questions, the corridor answers street questions.

`gov#cor#<id>` / `def`:

```
corridor_id   "cor-" + 10 hex (uuid4, issued at registration)
label         human name ("NH-48 — Rao Tula Ram Marg")
cells         SS of H3 res-8 ids — the geometry of record
road_names    [] street names, resolved from the routegraph edge-name
              table (routegraph.py:686-719 already surfaces them on
              every plan) — reviewer-visible, never user-derived
ward, agency  strings — who owns the road (PWD / MCD / NHAI…)
length_m      Σ cell-boundary path length along registered geometry
created_by    tenant id, created_at, source: drawn | suggested
```

Two creation paths: **drawn** — an analyst clicks cells on the console
map; **suggested** — the weekly gov rollup clusters the top publishable
`cell#`/`cor#` cells by contiguous road name and proposes corridors
(corridors a city would care about are, tautologically, the ones trips
already traverse).

### 2.4 Privacy gates — k≥5, suppression accounting, optional DP

| gate | rule | where |
|---|---|---|
| k-anonymity | **GOV_K_MIN = 5** distinct hashed devices per published row — stricter than the consumer k≥3 (`agg_ddb.py:50`), deliberately: the consumer layer is an ephemeral live map, while gov output is a durable, circulated dataset — the bar rises with the blast radius | enforced in the gov store's publishable filter, re-asserted at the API exactly like `admin_agg.py:544-546` — a violating row is a store bug → fail loud (500), never render |
| two scopes | cell gate (map layer): devices per cell ≥5. corridor gate (ranked table / reports): union of cell `devices` SS across the corridor's cells for the time slice ≥5 — a corridor can publish while every member cell is suppressed, which is correct: the union is the aggregate | reader-side union, identical mechanics to `hours_window` (agg_ddb.py:343) |
| suppression accounting | every response and export carries `suppressed: {cells: n, corridors: n, mode_rows: n}` — withheld rows are counted, never silently absent (same convention as `global_aggregates`, agg_ddb.py:399-417) | API layer |
| DP noise (optional) | Laplace noise on top of k-filtered true aggregates for *releases* (exports + any `dp=1` API read). Contribution caps per device per corridor-week statistic: trips ≤10, km ≤60, dose ≤20 000 µg, co2 ≤60 kg, devices Δ=1 → Laplace b = Δ/ε. ε_release = 1.0 default; per-tenant monthly budget 4.0 tracked on `gov#meta`/`dp#<YYYY-MM>`; exhausted → `429 dp_budget_exhausted`. Seeded noise — `seed = sha256(tenant‖dataset‖week‖schema)` — so re-exporting the same release returns the identical file (kills the noise-averaging attack) and `clamped` device counts are disclosed in the manifest | `gov_dp.py`, release-time only |
| raw data | no trajectory, coordinate, or cell-chain exists anywhere server-side — the pipeline discards them in-request. The shared table's `ledger#` family does hold per-device summary rows (km/dose/mode/ts — **no location**, the device-facing history of `docs/plan/07 §3`) — but no gov endpoint, response, or export can produce one: the gov plane reads only the `cor#`/`global`/`gov#*` families and publishes only k≥5 unions | structural (PRIVACY.md, docs/plan/07 §3) |

DP is positioned honestly: k≥5 + contribution clamps are the primary
protection; DP is the formal guarantee for bulk releases. The live
console reads exact aggregates (it is already behind a tenant gate);
`dp=1` exists for datasets that will travel.

### 2.5 What the API computes vs what the store holds

Reads are `Query` on `pk = cor#<cell>` with `sk begins_with hw#<week>` —
one query per cell returns its whole week (≤168 hour items + mode
slices). Corridor views = one query per member cell, server-side union
of `devices` sets, sums of counters. City-wide rankings do **not** scan:
the weekly gov rollup (§6.2) materializes `gov#idx`/`wk#<week>` — top-N
lists per metric + coverage stats — and the ranked endpoint reads one
item, falling back to a prefix scan (marked `"source": "scan"`) only
when the index is absent, the same degrade-loudly-not-silently pattern
the rest of the repo uses.

---

## 3. The planner's API — `/gov/v1`

### 3.0 Surface and guard

Mounted beside `/v2` in `server/main.py`. Separate guard from the ops
console: `_gov_guard` authenticates `Authorization: Bearer <tenant_key>`
against Secrets Manager entries `alive108/gov/<tenant>` (the console's
session cookie is minted the same way `main.py`'s `_session_sign`
already does — HMAC over expiry under the tenant key). The tenant id
stamps every response (`"tenant"`) and every audit row. Rate limits sit
in `middleware.py`'s existing per-path buckets.

Every response carries the honesty block the whole repo already speaks:

```
schema, k_min: 5, window, tenant, generated_ts,
suppressed: {...}, source: "idx"|"scan"|"computed",
confidence fields where a number is an estimate
```

| endpoint | answers |
|---|---|
| `GET /gov/v1/corridors?week&rank=dose\|dose_per_trip\|trips\|co2\|slow&dow&hour&limit` | ranked corridor table |
| `GET /gov/v1/corridors/{id}` | corridor detail: definition, weekly series, mode split |
| `GET /gov/v1/corridors/{id}/hours?week&dow` | 7×24 hour-of-week grid |
| `GET /gov/v1/corridors/{id}/estimate?scenario=greening\|signal\|transit\|closure` | counterfactual band |
| `GET /gov/v1/dose-map?week` | cell-level GeoJSON map layer |
| `GET /gov/v1/jams?weeks&min_hit_weeks&band` | recurring-congestion engine |
| `GET /gov/v1/od?week&sort&min_devices` | district OD pairs + transit gap |
| `GET /gov/v1/interventions` · `POST` · `GET /{id}` · `GET /{id}/report` | intervention registry + auto before/after |
| `GET /gov/v1/exports?dataset&week&format=csv\|geojson\|parquet&dp=0\|1` | release channel + manifest |
| `GET /gov/v1/meta/methodology` | versioned methodology + live model constants + latest validation |
| `GET /gov/v1/meta/coverage` | "how much should you trust the sample" numbers |

### 3.1 "Which corridors carry the most inhaled dose?"

```
GET /gov/v1/corridors?week=2026-W14&rank=dose&limit=25
```

```json
{
  "schema": "alive-gov-corridors/1", "week": "2026-W14", "k_min": 5,
  "rows": [{
    "corridor_id": "cor-9f2c81a4b0", "label": "Ring Rd — Ashram–Nizamuddin",
    "ward": "Central", "cells": 14,
    "trips": 1182, "devices": 264,
    "dose_ug_sum": 4021000, "dose_share_pct": 6.9,
    "dose_per_trip_ug": 3402, "dose_per_km_ug": 512,
    "km_sum": 8210, "co2_g_sum": 1489000,
    "slow_share_pct": 31.4,
    "mode_top3": [["auto_rickshaw", 0.34], ["driving_two_wheeler", 0.27], ["bus", 0.18]],
    "confidence": "high", "suppressed_cells": 0
  }],
  "suppressed": {"corridors": 7, "cells": 214},
  "city_dose_ug_sum": 58200000, "source": "idx",
  "note": "dose is the exposure model applied to traversals — estimated,
           not measured; dose_share is of all published corridors"
}
```

`rank=dose` orders by **total µg inhaled on the corridor** (where the
city's lungs actually are); `dose_per_trip` and `dose_per_km` order by
**intensity** (where each crossing is worst). A corridor can top one
list and miss the other — both belong on the console table; conflating
them is how agencies end up greening empty streets.

### 3.2 "Where do jams recur?"

```
GET /gov/v1/jams?weeks=8&min_hit_weeks=4&band=lt15
```

The reader scans each published cell's `hw#` rows for the trailing N
weeks; a cell-hour-of-week is a **hit** when
`(sp_lt8 + sp_8_15) / trips ≥ slow_share` (default 0.5) *and* the row
clears k≥5. Recurrence = hits in ≥ `min_hit_weeks` distinct weeks.

```json
{
  "schema": "alive-gov-jams/1", "weeks": 8, "band": "lt15", "k_min": 5,
  "rows": [{
    "cell": "892a828d47fffff", "corridor_id": "cor-9f2c81a4b0",
    "dow": 2, "hour_ist": 9,
    "hit_weeks": 6, "seen_weeks": 8,
    "slow_share_avg": 0.71, "trips_med": 34,
    "co2_idle_share_est": 0.22,
    "confidence": "medium"
  }],
  "suppressed": {"cell_hours": 1391},
  "caveat": "whole-trip mean speed credited per cell — recurrence of
            slow traversals, not measured link speed; calibrate against
            ANPR/tube counts (§7.4)"
}
```

`co2_idle_share_est` reuses the donation's phase split — `co2_idle_g` is
already a bounded summary field (`trip.py:96`) summed in the day
counters; the gov estimator allocates the corridor's observed moving/
idle/cold mix onto slow cell-hours. This is the signal-timing and
junction-queue answer: where, which hour, how repeatable, and what the
idling is costing.

### 3.3 "What would greening corridor X save?"

```
GET /gov/v1/corridors/cor-9f2c81a4b0/estimate?scenario=greening
```

Bands, never a point — the same rule `emissions.py` enforces
("every returned quantity is a band {lo, mid, hi}"):

```json
{
  "schema": "alive-gov-estimate/1", "corridor_id": "cor-9f2c81a4b0",
  "scenario": "greening", "k_min": 5,
  "baseline_week": {"dose_ug_sum": 4021000, "co2_g_sum": 1489000,
                    "trips": 1182, "devices": 264},
  "delta_per_week": {
    "dose_ug":  {"lo": 280000, "mid": 640000, "hi": 960000},
    "co2_g":    {"lo": 0,      "mid": 45000,  "hi": 120000}
  },
  "assumptions": [
    "exposure-side band: published near-road vegetation PM2.5 effects
     ≈7–24% of local concentration, applied to this corridor's
     traversal dose only",
    "emission-side: through-traffic does not vanish — small mode/speed
     co-benefit only; the band floor is 0 by design",
    "12-week horizon, current mode mix held constant"
  ],
  "citations": ["near-road vegetation review band — doc 06 §1 register",
                "ALive dose model constants — /api/model"],
  "disclaimer": "scenario arithmetic on measured baselines — a planning
                screen, not a forecast; the intervention report (§6) is
                the only measured answer"
}
```

Scenario register (all applied to the corridor's stored baselines, all
returned as bands with assumptions and citations attached):

| scenario | mechanism the estimate uses |
|---|---|
| `greening` | exposure-side reduction band on traversal dose (hedge/tree near-road literature) + small emission co-benefit |
| `signal` | idle-share reduction: corridor's slow-share × moving/idle/cold mix → avoided idle CO2 + dose band |
| `transit` | mode-shift: re-weight the corridor's mode split toward bus/metro shares the planner supplies (`?shift_car_to_metro=0.15`), recompute Σ dose and Σ emissions through `exposure.MICROENV`/`VENTILATION_LPM` + `emissions` band tables — the same constants the app uses |
| `closure` | pedestrianization screen: motorized dose/emissions zeroed on the corridor + **diversion leakage** flagged onto the named neighboring corridors (the estimate states leakage, it does not pretend trips evaporate) |

### 3.4 "Did the project work?" — automatic before/after

```
GET /gov/v1/interventions/intv-51c2/report
```

```json
{
  "schema": "alive-gov-report/1", "intervention": {
    "id": "intv-51c2", "name": "Ashram green divider + hedge",
    "type": "greening", "corridor_id": "cor-9f2c81a4b0",
    "live_date": "2026-02-16", "baseline_weeks": 8,
    "baseline_frozen": true},
  "baseline": {"dose_per_trip_ug": 3402, "co2_g_per_trip": 1260,
               "slow_share": 0.314, "trips_wk": 1182,
               "weeks": 8, "sigma_week": 0.062},
  "post": [{"week": "2026-W14", "dose_per_trip_ug": 2980,
            "delta_pct": -12.4, "ci95_pct": 12.4,
            "co2_g_per_trip": 1231, "slow_share": 0.298,
            "trips": 1104, "devices": 251, "confidence": "medium"}],
  "verdict": "no_clear_effect_yet",
  "control": {"corridor_ids": ["cor-77aa10e3d2"],
              "did_delta_pct": -9.1,
              "note": "corridor −9.1pp vs matched-control movement"},
  "suppressed": {"weeks": 1},
  "note": "verdict needs |Δ| > 2×baseline-σ for 2 consecutive weeks
          AND ≥30 devices/week — 'no clear effect' is an answer, not a
          failure of the report"
}
```

### 3.5 "Where should the next transit line go?"

```
GET /gov/v1/od?week=2026-W14&sort=transit_gap&min_devices=5
```

OD rows come from the existing `global`/`od#<origin>#<dest>` layer
(district/subdistrict names snapped at donate-time, `trip.py:306-315`)
re-keyed per week, joined with corridor mode rows:

```json
{"rows": [{"origin": "Dwarka", "dest": "Nehru Place",
           "trips": 402, "devices": 187,
           "transit_share": 0.11, "motorized_share": 0.89,
           "transit_gap_score": 358,
           "peak_dose_corridor": "cor-9f2c81a4b0"}],
 "note": "transit_gap = motorized trips × (1 − transit_share) — where a
          line would convert the most dose-carrying motorized travel"}
```

### 3.6 "When should we retime signals?"

```
GET /gov/v1/corridors/cor-9f2c81a4b0/hours?week=2026-W14&dow=1-5
```

A 5×24 grid (dow × IST hour): `trips, devices, slow_share, dose_ug_sum,
co2_g_sum` per hour, suppressed hours returned as `null + counted`.
Peak-spread, shoulder width, and the jam rows of §3.2 in one view —
the retiming analyst's actual worksheet.

### 3.7 The air side

`GET /gov/v1/field/daily?date=` serves the existing `alive-rollup/2`
daily files (per-cell mean/min/max, p10/p50/p90, city median, %
above WHO-15 and CPCB-60, ventilation series — `docs/plan/rollup-schema.md`)
and `GET /gov/v1/field/validation` the latest `alive-validation/2`
(LOSO MAE/RMSE/bias + band coverage). The traversal dataset and the air
dataset stay separate products on the same API — a planner overlays
them; the platform never pretends one measured the other.

---

## 4. The console — `/gov/console`

A single page in the repo's established register: static HTML + inline
JS + hand-drawn SVG/canvas (the admin engine-room ships exactly this —
`server/admin.html`; no map library, no CDN dependency a government
network can block). Optional basemap via the already-provisioned
Amazon Location key (`geo-maps:GetTile` is in its AllowActions,
`provision.sh:285-293`); without it, cells draw as hex polygons from
`h3.cell_to_boundary` over a district outline
(`static/ncr_districts.geojson` already baked).

Same gate pattern as admin: an un-guessable `GOV_MOUNT` constant (the
`admin_mount.py` mechanism — a location secret on top of the real
guard), tenant-key login → HMAC session cookie → every fetch through
`_gov_guard`.

Four surfaces:

1. **Corridor map.** The `dose-map` layer: published cells as hexes,
   choropleth toggle across `trips / dose_ug_sum / dose_per_trip /
   co2_g_sum / slow_share`, hour-of-week slider (dow + IST hour),
   corridor outlines from the registry. Suppressed cells render as
   hatched "below-k" — visible absence, never implied zero.
2. **Ranked corridor table.** §3.1's rows: corridor, ward, trips/wk,
   devices, Σdose, dose/trip, dose/km, ΣCO2, slow-share, top-3 modes,
   8-week sparkline, confidence badge, suppressed-cell count. Sortable
   on every column; click → corridor detail (hours grid + mode split +
   estimates).
3. **Intervention tracker.** Cards per registered intervention:
   baseline-vs-post chart (drawn from `rep#` items — nothing
   hand-entered), Δ% with the ±2σ band, verdict badge
   (`accumulating / no_clear_effect / improvement / regression`),
   control-corridor row when set, print-PDF view for the file that
   goes to the house/press.
4. **Trust tab.** Methodology version + hash, this tenant's export
   audit log, the latest LOSO numbers, live coverage numbers
   (§3.x `meta/coverage`), and the calibration-corridor table (§7.4).

The intervention tracker is the product's spine: **a greening project
registered once produces its own before/after evidence forever** — no
analyst query, no consultant report, no bespoke survey.

---

## 5. Writes: donation → gov items

One extension point: `DDBTripAggregates.record_trip` (agg_ddb.py:97)
already fans out to day / cell / recent / global items; gov adds a
fifth fan-out behind `GOV_AGG`:

```
for c in distinct(cells):                       # same dedupe as cell#
    ist ← ts in Asia/Kolkata
    wk, dow, hh ← iso_week(ist), weekday(ist), hour(ist)
    sk ← f"hw#{wk}#{dow}#{hh:02d}"
    UPDATE cor#<c> / sk         ADD trips 1, km_sum, dur_s_sum,
        dose_ug_sum, co2_g_sum, pm25_g_sum, switched,
        sp_<band> 1;            devices += token_hash;  ttl = +400d
    UPDATE cor#<c> / sk#m#<mode>  ADD trips 1, dose_ug_sum, km_sum;
                                  devices += token_hash; ttl = +400d
if origin_area and dest_area:                    # same strings the
    UPDATE gov#od / wk#<wk>#<o>#<d>  ADD trips 1;  # global layer wrote
        devices += token_hash;  ttl = +400d        # — now weekly
```

Speed band = the donation's `distance_km / (duration_s/3600)` (skipped
when `duration_s` is absent — the histogram then under-counts and the
response says so via `sp_unbinned`). Per-trip dedupe (`_seen_dupe`,
trip.py:63) already prevents replay double-counting upstream; the gov
items inherit it.

---

## 6. The weekly gov rollup — the job that makes it a product

New entry in `rollup_lambda.JOBS` + one EventBridge schedule
(`infra/schedules/gov-rollup-weekly.json`, cron Mon 02:30 IST =
Sun 21:00 UTC — after Sunday closes the ISO week):

`{"job":"gov_rollup"}` → `gov_rollup.py`:

1. **Materialize rankings** — scan the past week's `cor#` items →
   `gov#idx`/`wk#<YYYY-Www>`: top-100 per metric (dose, trips, co2,
   slow-share), publishable/suppressed counts, coverage stats.
2. **Intervention reports** — for each active `gov#intv#`: corridor-week
   metrics vs the frozen baseline → `rep#<week>` item: deltas, ±2σ CI
   from baseline weekly σ, device/trip n, verdict, confidence.
3. **Corridor suggestions** — cluster new publishable cells by road
   name → `gov#cor#`/`def` rows with `source: suggested`.
4. **Export drop** — the week's corridor-week CSV + GeoJSON written to
   `s3://alive108-air/gov-exports/<tenant>/<dataset>/<week>/` (and/or a
   customer bucket) with `manifest.json` {sha256, rows, schema, k_min,
   dp_epsilon_used, clamped}.
5. **Calibration refresh** — diff gov-supplied counts vs ours (§7.4).

### The intervention lifecycle (the §3.4 numbers' source)

- `POST /gov/v1/interventions` registers `{name, type, corridor_id,
  live_date, baseline_weeks=8, control_corridor_ids[]}`.
- **Baseline freezes at registration** — computed once from stored
  `cor#` history, written immutably onto `meta`. A baseline that can
  be recomputed is a baseline that can be moved; freezing it is what
  makes the after-report worth anything in a review meeting. If <4
  weeks of history exist → `baseline.status: accumulating`, reports
  begin when the window fills.
- Metrics per corridor-week: `trips, devices, dose_ug_sum,
  dose_per_trip_ug, co2_g_sum, co2_g_per_trip, slow_share, mode_share`.
- Verdict rule (stated on every report):
  `improvement`/`regression` only when |Δ| > 2·σ_baseline on the
  primary metric for 2 consecutive weeks AND ≥30 devices/week;
  otherwise the honest `no_clear_effect` / `accumulating`.
- Optional **difference-in-differences**: the same delta computed on
  control corridors is subtracted — separates "the corridor changed"
  from "the whole city's air changed that month" (November always
  changes; DiD is how the report survives it).

---

## 7. Trust mechanics — how a government verifies the numbers

Procurement committees don't buy claims; they buy things they can
check. Every mechanism below is already the repo's working style —
this section wires them for an external verifier.

### 7.1 Methodology as a served artifact

`GET /gov/v1/meta/methodology` returns the versioned methodology doc —
generated **from the code** the way `/api/model` serves `exposure.py`'s
constants (`admin_agg.py:596-638`), so the doc cannot drift from the
engine: dose formula, microenv/ventilation/uplift tables with
citations, emission-factor band sources (ARAI/ICAP 2007, Guttikunda
2015, ICCT/TRUE uplifts), the donation privacy pipeline spec, k and
suppression rules, DP parameters, schema versions. Every export
embeds the methodology version + sha256 — a dataset states exactly
which math produced it.

### 7.2 Sample counts on every row

No gov number exists without its `n`: `devices`, `trips`, `weeks`,
`suppressed`, `confidence`. Confidence is a stated function
(devices/week, baseline weeks, field σ coverage — `grid.py:16` already
labels air reads `"sparse"`/`"none"` the same way). A government
statistician can sort by n and decide what to trust — the platform
never upgrades a thin sample into a confident-looking total.

### 7.3 Independent verification of the air side

The air field is already validated against instruments the government
owns: weekly LOSO + OpenAQ archive replay (`rollup.py`,
`alive-validation/2` — MAE/RMSE/bias + band coverage vs CPCB/OpenAQ
stations). `meta/methodology` serves the latest run. A DPCC reviewer
can verify our field against their own CAAQMS feed — public data,
independent of us — which is the strongest trust signal available:
**our hardest numbers are checkable against the buyer's own sensors.**

### 7.4 Calibration corridors — their counts vs ours

`gov#cal`/`corridor#<id>`: the agency uploads its own ground truth —
ANPR/tube/manual counts for N chosen corridors × hours — via
`POST /gov/v1/calibration`. The weekly job returns a correlation
report (`{corridor, hour, their_count, our_trips, ratio, r}`). The
expected finding, stated honestly upfront: donated trips are a
**self-selected commuter sample biased toward app users** — a
consistent fraction of real traffic, not a census. The calibration
table shows the fraction is stable, which is what makes deltas and
recurrence meaningful even where absolute volumes differ.

### 7.5 Reproducibility

Every export is `schema`-versioned (`alive-gov-*/1`), carries a
`manifest.json` {sha256 of content, row counts, suppressed counts,
clamped counts, dp ε spent, methodology hash} and lands in a location
the customer controls. Re-issuing a release is byte-identical (the
seeded-DP rule). A re-procurement audit three years later replays
byte-for-byte.

---

## 8. Procurement reality — what makes this sellable

### 8.1 Compliance table (the checklist an RFP actually scores)

| requirement | answer |
|---|---|
| Data residency | **everything already `ap-south-1` (Mumbai)** — compute, DDB, S3, secrets, schedules (`provision.sh:35`, `agg_ddb.py:45`); exports can land in a customer bucket in-region; no personal data and no aggregate ever leaves India |
| DPDP Act 2023 posture | the gov plane holds **only aggregates** — no "personal data" as the Act defines; the nearest thing to identity anywhere is a SHA-256-truncated hash of a random, device-minted, 30-day-rotating token, used solely as a k-anonymity set member (PRIVACY.md, docs/plan/07 §3). Donations are opt-in consent artifacts (app toggle, off by default). DP releases add a formal ε bound |
| Standards | REST + **OpenAPI 3.1** (FastAPI generates it natively — `docs/api/REFERENCE.md` already exists); **GeoJSON RFC 7946 / EPSG:4326**; **CSV RFC 4180**; Parquet for analytics teams; **CKAN/data.gov.in-shaped** dataset descriptors so the department can republish as open data; ISO-8601 timestamps + explicit IST labels; H3 open index; versioned schemas |
| Security | per-tenant API keys in Secrets Manager (`alive108/gov/<tenant>`), HMAC-signed sessions, constant-time compares, login rate buckets — the `_admin_guard` machinery reused; every export and mutation writes a `gov#meta`/`export#<ts>` audit row (who, what dataset, when, rows, sha256) |
| TLS | **honest flag**: the demo NLB still serves `:80` (noted in the admin-login code comment). A gov deployment terminates TLS — ACM + ALB in our account, or termination at the department's gateway; the app already honors `x-forwarded-proto` for cookie `Secure` |
| Cloud portability / MeitY | the whole stack is DDB + S3 + Fargate + EventBridge + Secrets Manager — deployable into a government AWS account or a MeitY-empanelled region; the store interface is already pluggable (`TripAggregates` ↔ `DDBTripAggregates` behind one contract, `v2/store.py:406`), so a Postgres/Mongo-backed on-prem/NIC variant is an adapter, not a rewrite |
| Accessibility | console target WCAG 2.1 AA (GIGW posture); it is already one static HTML file with no framework/CDN — loads on a 2014 office browser |
| Auditability | methodology served from code constants; export manifests; audit items; the repo's own `docs/privacy/verify.md` claim→enforcement→test table style extended to gov claims |

### 8.2 The commercial shape

- **Pilot**: one district/ward, 90 days, N corridors, 1 tenant key.
  Deliverables: console + API + weekly intervention PDFs + export
  channel + a methodology walkthrough (the §7.1 session — the meeting
  where the department's own statistician tries to break the numbers).
- **License**: flat annual per-department; corridors/tenants scale the
  tier, never privacy.
- **Why infra-cheap**: the platform runs on the same ~US$50/month
  single-Fargate + serverless periphery the demo runs on today
  (`provision.sh:60` budget line); the marginal gov cost is the `cor#`
  write volume (§2.2) and one weekly batch job — priced like software,
  not like a data centre.
- **Procurement hooks**: data escrow = the S3 export bucket they own;
  methodology escrow = the served doc + repo hash; SLA signals already
  exist (CloudWatch alarms on field-age and 5xx, `provision.sh:189-211`).

### 8.3 What it replaces (the honest pitch line)

A corridor traffic+exposure study today is a one-off survey tender:
weeks, ₹lakhs, one snapshot, no after-measurement. This is a standing
instrument — the greening project measures itself, every week, forever,
and the report is a button.

---

## 9. In the repo today vs new work

| exists now (reused, file) | new for gov |
|---|---|
| donation pipeline — trim/thin/round/H3/discard, bounds, dedupe (`server/v2/trip.py`) | `GOV_AGG` write fan-out: `cor#` hour-of-week atoms + mode slices + speed histogram |
| `alive108-agg` table, TTL `ttl`, IAM (`infra/provision.sh`, `agg_ddb.py`) | new pk families on the same table; `GOV_K_MIN=5`; 400-day item TTL |
| day/cell/hour/global item families + k≥3 publish filters (`v2/store.py`, `agg_ddb.py`) | `gov#cor`/`gov#intv`/`gov#idx`/`gov#meta`/`gov#cal` families |
| `recent`/`hour#` UTC ops feed | IST civil hour-of-week bucketing |
| `global`/`od#` district OD layer | per-week OD + transit-gap scoring |
| admin console + `_admin_guard` + `ADMIN_MOUNT` + rate buckets (`main.py`, `admin_mount.py`, `middleware.py`) | `_gov_guard` (tenant keys, Secrets Manager `alive108/gov/<tenant>`), `GOV_MOUNT`, `/gov/console` page |
| admin aggregate API incl. corridors/donations/global/validation/model/usage (`admin_agg.py`) | `/gov/v1` router (`gov_api.py`) — §3 surface |
| dose model + microenv/VE/uplift constants (`exposure.py`); emission bands (`emissions.py`); segment dose (`segments.py`); road names (`routegraph.py`) | scenario estimator (`gov_estimate.py`) — mitigation band register §3.3 |
| daily/weekly rollups + LOSO validation + JOBS handler (`rollup.py`, `rollup_lambda.py`) | `gov_rollup` job + `infra/schedules/gov-rollup-weekly.json` + provision line |
| S3 `alive108-air` snapshot/daily/validation layout | `gov-exports/` prefix + manifest writer + customer-bucket push (`gov_export.py`) |
| districts/subdistricts resolution (`districts.py`, baked geojson) | corridor registry (cells→label/ward/agency) |
| `community.py` corridor layer + implied-ambient inversion (≤900 µg/m³ gate) | calibration-corridor comparison (their counts vs our traversals) |
| honesty conventions — suppressed-counted, null-not-zero, degrade-loudly, `k` re-asserted at API | DP noise module (`gov_dp.py`): clamps, Laplace, seeded draws, ε budget ledger |
| PRIVACY.md + docs/plan/07 §3 contract | `docs/gov/local/05-gov-privacy.md` — the buyer-facing legal annex (DPDP posture) |

---

## 10. Limitations — stated, never smoothed

1. **Sample bias.** Donations come from people who installed an air-app
   and turned sharing on. Volumes are a stable *fraction* of traffic
   (§7.4 calibrates it), never a census; absolute counts must ship with
   the basis note attached.
2. **Speed is a traversal proxy**, not a link measurement (§2.1).
3. **Dose is modeled, not measured** — exposure constants on a kriged
   field; the field itself carries weekly published error bounds, which
   the methodology doc attaches.
4. **k-suppression is the truth budget.** Sparse cells/hours/modes are
   absent from answers by design; `suppressed` counts make the absence
   visible — a corridor that never clears k=5 is the platform saying
   "we don't know," and the console renders exactly that.
5. **Intervention attribution is quasi-experimental.** DiD with control
   corridors is offered; a report without controls separates "the
   corridor changed" from "the season changed" only by baseline σ.
6. **DP trades utility.** On thin corridors, seeded Laplace noise at
   ε=1 can exceed the true weekly movement — the export discloses
   ε and clamped counts, and `dp=0` (k≥5-only) remains the default for
   gated reads.

---

## 11. Build order

1. `GOV_AGG` write fan-out + `cor#` items + GOV_K_MIN store gate —
   the data plane starts accumulating immediately (history is the
   product; every week of build delay is a week of baseline lost).
2. `gov_rollup` job + `gov#idx` materialization + schedule json.
3. `/gov/v1` router: corridors/hours/jams/od reads + `meta/*`.
4. Corridor registry + console map/table (draw-path + suggested list).
5. Interventions: registry + baseline freeze + weekly `rep#` + tracker.
6. Exports + manifests + seeded DP + budget ledger + audit items.
7. Calibration upload + estimate scenarios.
8. TLS termination + tenant-key issuance runbook → pilot readiness.
