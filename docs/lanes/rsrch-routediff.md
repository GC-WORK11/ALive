# rsrch-routediff — Health Maxer / Petrol+Health / Time+Health all pick the same road

Research-only lane. User complaint: the three trip modes "show THE SAME
route everywhere and each calls it 'best' — feels fake." Scope:
`server/v2/plan.py` (read fully, 2599 lines), `server/v2/modes_engine.py`
(791), `server/v2/deps.py`, `server/exposure.py`, `server/emissions.py`,
`server/routegraph.py`, `server/location_client.py`, `server/webapp/whereto.js`,
plus `server/v2/providers.py` as merged on `int/routes-airmap` (the enriched
provider seam: `alternatives[]`, `sections`, `progress[]`, `instructions`,
`fuel_l`). **No code changed.**

## TL;DR — the root cause is two-layered

1. **Thin candidate pool.** For the rider's vehicle family the pool usually
   contains ONE real corridor: the primary router fetch explicitly asks for
   **no alternatives** (`deps.py:255` `"alternatives": "false"`), AWS routing
   is off in prod, OSRM public-demo alternatives "often return none for NCR
   ODs" (lane-E doc), and the engine's least-smoke alternatives are gated by
   five separate conditions (`plan.py:2178`). When the pool has one corridor,
   every mode's argmin is the same row — correctly, honestly, and uselessly.
2. **Same pool, three re-sorts.** The three modes never fetch mode-specific
   candidates and never re-score the geometry for their objective — they
   re-order one shared pool with different sort keys
   (`modes_engine.py:559-587`, `_mode_cands_key`). Because fuel ≈ distance,
   dose ≈ time × concentration on a smooth field, and live ETA correlates
   with the same length, one corridor legitimately wins all three axes most
   days. The server already *detects* this (`one_pick`, `mode_picks`,
   `why: "the same road wins every way"`, `modes_engine.py:656-666,739-744`)
   and the client already *suppresses* the comparison line on it
   (`whereto.js:1031-1032`) — but the mode cards still stamp "cleanest" /
   "least petrol" / "fastest" on an identical polyline, which is what reads
   as fake. The fix is not better wording alone: it's **fetching genuinely
   different corridors so different argmins can exist**, then labelling the
   honest tie when it persists.

## 1. How many candidates each mode actually requests — the trace

Entry: `plan.py:2301` `tmode = _modes.trip_mode(body)` → trip-mode plans set
`want_alts=True` at `plan.py:2328-2331` (reroute same at `plan.py:2496-2498`).
Non-trip plans pass `want_alts=False` and fetch **zero** alternatives.

### Router arm — `_motorized_options` (`plan.py:921-1094`)

- **AWS keyed** (`plan.py:931-941`): `calculate_routes` per travel mode —
  `alternatives=2` for Car (`plan.py:935`), `alternatives=0` for Scooter
  (`plan.py:936`). Up to 3 car corridors; car alternatives become
  `"Car (AC) · alt i"` rows (`plan.py:956-966`); `car_open`/`auto`/`bus` rows
  are stamped on the **primary** geometry only (`plan.py:967-990`); bike gets
  `sco_rts[0]` only (`plan.py:991-1007`). AWS `enabled=false` in prod
  (engine-oct11.md), so this branch is dormant there.
- **OSRM path** (`plan.py:1011-1022`): primary = `deps.osrm_route` which
  requests `"alternatives": "false"` — **deps.py:255 is the file:line where
  alternatives are declined on the main fetch.** When `want_alts`, a second
  call `modes_engine.osrm_alternatives("driving", …)` runs in parallel
  (`plan.py:1013-1016`): OSRM `alternatives=3` requested
  (`modes_engine.py:774`), returns `routes[1:3]` (`modes_engine.py:781`) —
  up to 2 alternates. Filters: `distance ≤ 1.6× primary` (`plan.py:1045`,
  `DETOUR_MAX_VS_FAST`), `_same_road` dedupe by length ±300 m/2 % + midpoint
  ~150 m (`plan.py:1030-1048`). Emitted as **car AND bike** `"· alt N"` rows
  with a duration factor (`plan.py:1076-1092`) — no bike-specific corridor,
  no auto/bus/cycle/walk alternates.
- **Slow modes** (`plan.py:1097-1123`): one OSRM route per cycling/walking
  profile, `alternatives=false` via `deps.osrm_route`.

### Engine arm — `_engine_options` (`plan.py:2103-2240`)

Least-dose A* per mode on the priced field raster. Primaries for 5 modes
(`ENGINE_MODES`, `plan.py:1654`); corridor alternatives via
`routegraph.alternatives` (tax-and-re-solve, `ALT_TAX=1.5`,
`ALT_MAX_SHARED=0.85`, `ALT_MAX_ATTEMPTS=4`, `routegraph.py:111-117,441-478`),
fetched at `plan.py:1774` `alts_fn(flat, flon, tlat, tlon, mode, 2)` — but
**only** when ALL of: `alts=True` (off for `fast` first-paint,
`plan.py:2416`), `alts_fn is not None` (C++ kernel only — Python twin never
serves alts, `plan.py:2147-2158`), `air_km ≤ 50` (`ALT_OD_KM`), arm elapsed
< 6 s (`ALT_ARM_SOFT_S`), then per-alt `distance ≤ 1.6× primary`
(`ALT_MAX_DETOUR`, `plan.py:1783-1787`), snap ≤ 1200 m, `≤ MAX_ROUTE_KM`,
and the `_engine_merge` corridor-dedupe/detour guard (`plan.py:2243-2287`)
which drops a same-corridor engine row against the router row and flags the
router row `engine_confirmed`.

### Transit arm — GTFS journeys (`plan.py:1169-1224`)

Multiple real journeys when the feed offers them, else the station-model
approximation — genuine variety, but transit sits outside the rider's
vehicle family and only matters when the family has no rows.

### Net pool per family (prod, engine priced, AWS off, OSRM alts empty)

| Family | Typical corridors on screen |
|---|---|
| car | router primary + engine least-smoke rd (+ eng alt, + rare OSRM alt) |
| bike | router primary (driving scaled) + engine least-smoke rd |
| auto/bus | router primary only (engine auto row possible; bus never) |
| metro | GTFS journeys |
| walk/cycle | OSRM + engine least-smoke rd |

**Answers to "does the engine fetch ONE route per vehicle/mode then score it
three ways?":** Yes for car_open/auto/bus (one shared driving geometry, five
duration/microenv/emission lenses — `plan.py:1059-1072`); the modes then pick
over whatever the arms produced. No trip mode triggers a fetch for its own
objective — `time_health` never asks for the fastest road, `petrol_health`
never asks for the thriftiest, `health_max` relies entirely on the engine's
dose-min A* (which does do its job when priced).

## 2. The scoring trace — one pool, three keys

`apply()` (`modes_engine.py:709-744`) runs once per response:

1. `option_fuel` per row (`modes_engine.py:138-174`): `fuel_l =
   emissions.co2_kg.mid ÷ 2.31` (petrol) / `2.68` (diesel); CNG → `fuel_kg ÷
   2.69`; metro/EV/walk/cycle → `fuel_l = 0` + note. **Fuel is a CO₂
   back-calculation, not a consumption model** — the number is whatever
   `emissions.trip_emissions` (`emissions.py:735-767`) priced: one moving
   span at implied free-flow speed × BS-era g/km band × speed-curve + idle
   g/s over `(dur − freeflow)` + cold-start. Live jam delay adds the Tiwari
   idle top-up only (`_idle_topup`, `modes_engine.py:177-198`).
2. `live_traffic` (`modes_engine.py:325-391`): `traffic_for_route(coords)` on
   **≤ 5 distinct geometries** (`TRAFFIC_MAX_ROUTES=5`, line 65), sorted
   rider's-family-first then cleanest (`lines 340-342`), 6 s wall budget.
   **`_call(fn, coords)` passes only coords (`line 356`)** — `mode`,
   `depart_at`, `consumption` are never forwarded even though the enriched
   provider accepts all three. `_apply_traffic` (`284-323`): provider's
   absolute `live_s` only when its route length matches ours ±300 m/5 % AND
   mode ∈ car-family; else `eta + delay_s` (re-based on `freeflow_s` when the
   row already carried traffic); bike/auto always take the additive basis.
   **`alternatives[]`, `progress[]`, `fuel_l`, `instructions[]` in the
   response are ignored today** — `_usable` only checks `delay_s|live_s`.
3. `_pool_ctx` (`544-556`): pool = servable rows of the rider's family else
   all servable rows (`_servable` = has eta + not clipped, `416-419`).
   `min_dose` = min `dose.mid`; `within` = `dose ≤ 1.15×min`.
4. Three picks on the same pool (`_mode_cands_key`, `559-587`):
   - `health_max`: `min(dose.mid, live, fuel)` over all dosed rows.
   - `petrol_health`: `min(fuel, dose, live)` inside the +15 % dose window;
     if no fuel numbers inside the window, widens to known-fuel rows.
   - `time_health`: `min(live_eta, dose)` inside the window; when ANY
     candidate has `traffic_delay_s ≠ None`, unmeasured rows can't win.
   - Near-ties → the cleaner row (petrol ±1 %/0.01 L; time ±60 s).
5. `pick_and_explain` (`637-699`) stamps `mode_pick` + `why`, reorders
   pick-first. Tie messaging already exists: `len(pool)==1` → "the only
   route for this ride"; `_all_same` (pool within 3 % dose + 60 s + 3 %
   fuel) → "all routes are about the same today"; all three modes' picks
   identical → "the same road wins every way" + `one_pick:true` +
   `mode_picks` briefs in the response block. Client-side, `vsLine` returns
   `''` when `one_pick` (`whereto.js:1031-1032`).

**Why one road wins all three so often:** inside a family the metrics are
nearly monotone in the same direction — fuel ∝ distance+idle, live ETA ∝
distance+jams, dose ∝ duration × corridor concentration. On a spatially
smooth field the shortest/fastest corridor is also the least-dose one;
alternatives that survive the 15 % dose window are both slower and
thirstier. Verified live in the lane-E doc: all three modes picked the same
OSRM "Car (AC)" 12.5 km. The complaint's "feels fake" is therefore
*structurally true* (often just 1-2 corridors exist) and *arithmetically
true* (one corridor dominates all axes) — not a bug in the pick math.

**One real under-pricing:** `dose.mid` is computed once at option build with
`eta_s` (freeflow basis) — live delay never re-enters the dose integral
(`_apply_traffic` stamps `live_eta_s` after dosing; `modes_engine.py:395-399`
`_dose` reads the stale `mid`). A jammed corridor breathes more than its
card says, and `health_max` prices the same stale number `time_health`
corrects. `progress[]` and per-jam `delay_s` now exist to fix this.

## 3. Mode descriptions vs what each actually optimizes

| Card (whereto-oct11) | Wire rule (`MODE_RULES`, `modes_engine.py:702-706`) | What it really does | Honest-fix deltas |
|---|---|---|---|
| **Health Maxer** — "cleanest air, no compromise" | `health_max`: "least smoke, no compromise" | argmin `dose.mid` over dosed family rows — dose integrated on the same raster the engine priced, 250 m samples, uniform-speed time apportionment (`exposure.py:230-277,280-401`) | (a) dose basis is **freeflow duration** — jam time doesn't add breathing time, so a stuck "clean" corridor can look cheaper than truth; (b) "cleanest" is only cleanest-of-fetched — provider corridors were never dosed; (c) engine least-smoke rows DO exist when priced — the honest spine is there |
| **Petrol + Health** — "least petrol, clean air" | `petrol_health`: "least fuel within 15% of the least smoke" | argmin `fuel_l` in the dose window; `fuel_l` = option's own `emissions.co2_kg.mid ÷ kg-CO₂/L` — i.e., **exhaust-CO₂ model ÷ constant**, not a fuel model; idle burn = `(eta − freeflow)` idle-span + measured idle top-up on unpriced live delay only | (a) name promises fuel — number is a CO₂ proxy; TomTom `fuelConsumptionInLiters` (providers.py:1735-1739) is now available when `consumption=` is passed — rank on real fuel where present, label basis; (b) "least idling in jams" (master plan) is approximated by two lumped idle terms — `sections[].TRAFFIC.delayInSeconds` + `progress[]` give real stop-go structure; (c) `fuel_saved_l` vs fastest same-fuel row is honest already |
| **Time + Health** — "fastest with live traffic, still clean" | `time_health`: "fastest now within 15% of the least smoke" | argmin `live_eta_s` in the dose window, live read on ≤5 geometries; provider `live_s` only when route lengths match; unread rows excluded only when a sibling has a reading | (a) "live traffic" covers ≤5 probed lines — provider-returned alt corridors arrive pre-timed and are currently thrown away; (b) ±60 s tie → cleaner row wins (deliberate "+Health"); (c) with no live reading it quietly falls back to freeflow eta — `why` already switches to "fastest route" but the card name still says "live traffic" |

## 4. What `int/routes-airmap` providers.py now exposes (merged state)

`traffic_for_route(coords, lonlat=None, mode="car", depart_at=None,
consumption=None)` → dict | None (`providers.py:2158-2192`):

| Field | Source | Meaning for scoring |
|---|---|---|
| `live_s`, `freeflow_s`, `delay_s`, `length_m` | TomTom `summary` (Ola: duration only, `live_s` kept when length within 15 %, `2059-2062`) | traffic-aware ETA + delay per candidate |
| `jams[]` | TomTom `sections[TRAFFIC]` (`1651-1667`): `delay_s`, `magnitude`, `speed_kmh` (effectiveSpeedInKmh), road name, `from_m/to_m`; Ola advisory levels (`2030-2058`) | per-jam delay & speed → non-uniform dose weighting |
| `alternatives[]` | `parse_tomtom_route` (`1762-1773`): `routes[1:]` same shape; `maxAlternatives=3` + `alternativeType=anyRoute` (`171,1804-1805`); Ola `alternatives=true` (`2112`), alts parsed `2076-2080` | **up to 3 provider corridors for the same OD, each with its own polyline/live_s/delay_s/length_m/jams/instructions/fuel_l** — the missing candidate set |
| `fuel_l` / `battery_kwh` | `summary.fuelConsumptionInLiters` (`1735-1739`), returned only when `consumption=("combustion"\|"electric", per-100 km)` is sent → `vehicleEngineType` + `constantSpeedConsumption… "50,per"` (`1814-1819`) | provider-model fuel per candidate — a real petrol axis |
| `progress[]` | `progress[{pointIndex→i, travelTimeInSeconds→t_s, distanceInMeters→d_m}]` (`1706-1714`) | cumulative time along the polyline → per-segment **traffic-aware** dose apportionment |
| `instructions[]` | TomTom guidance instructions (not returned on current key — header doc line 102) / Ola legs.steps (`1946-1963`) | real turn lists on alt corridors |
| `roads[]`, `tolls[]`, `speed_limits[]`, `flags` | IMPORTANT_ROAD_STRETCH / TOLL / SPEED_LIMIT / flag sections (`1616-1685`) | via-names + route flags |
| `polyline`, `summary`, `warnings`, `advisory` | per route | alt geometry (`[[lat,lon]]`) + provider notes |

Request side already wired: `depart_at` → TomTom `departAt` (`1812-1813`),
`mode` → TomTom `travelMode` / Ola `_OLA_MODES` (`1784,2084-2090`), 60 s
route cache, 3 s deadline, daily budgets, TomTom→Ola fallback
(`2128-2155`). **None of these inputs are sent by `modes_engine` today** —
`_call(fn, coords)` forwards only the line.

## 5. Per-mode scoring contract — design using the real fields

Fetch once per OD (inside the existing `live_traffic` fan-out, no new
network): the family's primary geometry is already first in the read order
(`modes_engine.py:340-342`); pass `mode`, `depart_at`, and `consumption`
(derive `fuel_l100`/`kwh_100km` from the vehicle profile — fleet-prior
g/km ÷ kg-CO₂-per-litre ×100 km, or skip when unknown). The response's
`alternatives[]` are real corridors; ingest each as a candidate.

**Candidate schema (one normalized row per corridor, scored identically):**

```
{ geometry, distance_km, eta_s, freeflow_s, live_eta_s, traffic_delay_s,
  jams[], dose{lo,mid,hi,avg_conc_ugm3,coverage,confidence},
  fuel_l|fuel_kg, fuel_basis ("tomtom"|"ola"|"emissions-co2"),
  source ("tomtom-alt"|"ola-alt"|"osrm-alt"|"alive_core-path"|"router"),
  alternative_index }
```

Rules per mode (existing semantics preserved, now over a real candidate set):

- **health_max** → argmin `dose.mid` over all dosed candidates; dose now
  integrated with **traffic-aware duration**: `duration_s = live_s` when a
  live read exists (jam time is breathing time); optionally weight sample
  seconds by `progress[]` deltas instead of uniform arc-length — honest
  v1 is duration = live_s, v2 is per-point weighting.
- **petrol_health** → argmin `fuel_amount` over candidates with
  `dose.mid ≤ 1.15 × min_dose`; prefer provider `fuel_l` where present
  (per-candidate basis flag — never silently mix TomTom litres with
  CO₂-derived litres on the same comparison; rank by like basis, fall back
  to `emissions.co2_kg.mid` only across mixed sets, exactly the existing
  `_fuel_key_fn` rule). Jam-idle: add `Σ sections.TRAFFIC.delay_s × idle
  rate` or keep the existing lumped top-up — pick one, label it.
- **time_health** → argmin `live_eta_s` over the same dose window; provider
  alts arrive pre-timed so `read` (line 583) now includes alt corridors —
  the fastest-*now* pick can finally differ from the fastest-freeflow one.
- All three keep the +Health tie-breaking (near-tie on the mode's axis →
  cleaner row) and the dose window semantics.

Every new candidate gets dose via the shared `_dose_surface` raster
(`plan.py:390-408`) — same estimator every row is priced against, so a
provider corridor and an engine corridor compare like-for-like. Honest
degrades: no provider keys → no alternatives → the pool is what it is and
`candidates` says so; an alt with no polyline or out-of-area endpoints is
dropped, never synthesized.

**Corridor accounting for honest ties:** add a `candidates` block to the
mode response — `{router: n, osrm_alts: n, provider_alts: n, engine: n,
transit: n, live_reads: n}`. When all three argmins coincide, the pick's
`why` becomes *"the same road wins every way — N roads checked"* (number
from the wire, not vibes); `one_pick` and `mode_picks` already carry the
structure. When a mode's pick differs, the existing `why`/`vs_line`
comparisons work unchanged — that's the payoff state.

## 6. plan.py / modes_engine.py changes needed (design, not done)

1. **`_motorized_options` (plan.py:1011-1021)** — nothing needed on the OSRM
   arm; keep. Optionally bump `osrm_alternatives` `max_alts` 2→3 to match
   TomTom's corridor count (cheap, one upstream call).
2. **New: provider-alternative ingestion.** Either (a) a small arm in
   `_build_options` that calls `traffic_for_route` once on the family's
   primary OD line and emits `_option` rows for `alternatives[]` — needs
   the vehicle family + a `_dose_band`-equipped builder, both already in
   plan.py scope; or (b) inside `modes_engine.apply`/`live_traffic`: when a
   call returns `alternatives`, append option rows *before* `_pool_ctx`
   (`apply` mutates `options` in place — appending is legal today, the pick
   logic re-reads the list). Preferred seam: a modes_engine helper
   `ingest_provider_alts(options, res, build_option)` called from
   `live_traffic`'s per-geometry loop, `build_option` injected by plan.py's
   `_apply_trip_mode` so `_option()` stays where it is.
3. **Per-alt row construction:** `polyline` [[lat,lon]] → GeoJSON
   [lon,lat]; `distance_km = length_m/1000`; `eta_s = live_s` (it's the
   provider's traffic-aware time — set `eta_model="provider-live"`,
   `duration_basis="live"`, `router_backend="tomtom-alt"|"ola-alt"`,
   `alternative_index`); `freeflow_s` when present; `traffic_delay_s =
   delay_s`; `jams` mapped through `_clean_jams`; `steps` from
   `instructions[]` (Ola always; TomTom when the key serves guidance).
   `dose` via `_dose_band(geometry, live_s, microenv)` — **live duration,
   not freeflow** — with the shared raster; `emissions`/`fuel` through the
   existing `_emission_band` + `option_fuel`, then override `fuel_l` with
   provider `fuel_l` when returned and stamp `fuel_basis`.
4. **Dedupe + caps:** reuse `_same_road` (plan.py:1030-1038) against every
   existing row AND between alts; `length_m ≤ MAX_ROUTE_KM`; distance ≤
   `DETOUR_MAX_VS_FAST`× same-mode primary; endpoints inside
   `_service_area`. Provider alts duplicate the OSRM/primary line often —
   drop them as today (flag `provider_confirmed`, analogous to
   `engine_confirmed`).
5. **`live_traffic` signature (modes_engine.py:325-357):** forward `mode`
   (family→provider map), `depart_at` (plan body already carries it — add a
   parameter through `_apply_trip_mode`/`apply`), `consumption` when the
   profile gives a figure. TRAFFIC_MAX_ROUTES may need 5→~7 since alt
   geometries eat the same budget — or read alts' `live_s` for free and
   reserve calls for OUR corridors only.
6. **Dose-on-live-duration:** in `_apply_traffic` (or the new ingest), when
   a row takes a matched `live_s`, recompute `dose` with `duration_s =
   live_eta_s` (same raster, same microenv) so the number the card shows is
   the number time mode priced — kills the freeflow-dose/live-eta basis
   mismatch. Guard: only recompute when `|live − eta| > 60 s` to keep CPU
   flat.
7. **Response surface:** add `candidates` counts + keep `one_pick`/`why`
   semantics; extend the one-road `why` to include the count ("… — N roads
   checked"). `rank_options`/`_route_deltas` need no changes — new rows are
   ordinary options with real fields.
8. **Budget:** all inside the existing 6 s traffic fan-out (alternatives
   ride free on calls already made); dosing 2-4 extra geometries is raster
   reads — bounded by the same `_ROWS_EXEC` pattern. Reroute inherits it
   through the same `want_alts` path.

## 7. Honest messaging for ties — design

- **All three modes → same corridor:** `one_pick:true` + `why` "the same
  road wins every way — N roads checked"; `candidates` block proves the
  search happened. Client already suppresses vs-line; consider rendering
  the pick card's badge as "best on all three" instead of the mode word —
  that's W's call, server sends the fact.
- **Two modes agree, third differs:** `mode_picks` already carries all
  three briefs; `_pick_why`/`_other_why` produce comparisons ("2 min
  slower, 15% cleaner") — keep.
- **No alternatives exist at all** (providers unconfigured/OSRM empty/
  engine unpriced): `candidates` shows 0-1 alternates; pick `why` stays
  "the only route for this ride" when pool==1 — already honest, now with
  the count to show *why*.
- **Never fake:** no relabelling a shared corridor as three picks, no
  dose/fuel numbers borrowed across candidates, no alt rows without real
  geometry. An alt that failed dedupe/coverage is dropped silently — the
  `candidates` count, not a ghost row, records the attempt.

## 8. Evidence files

- `server/v2/plan.py` — arms/fetch (921-1094), engine (2103-2240, 1642-1697,
  1742-1789), merge dedupe (2243-2287), trip-mode wiring (2290-2404),
  `_dose_band`/`_dose_surface` (390-451), `_same_road` (1030-1048),
  `want_alts` call sites (2328-2331, 2496-2498).
- `server/v2/modes_engine.py` — fuel (138-198), traffic fan-out + basis
  (65-66, 284-391), pool/picks/why (395-466, 544-615, 637-699),
  `MODE_RULES`/`apply` (702-744), `osrm_alternatives` (748-791).
- `server/v2/deps.py:255` — `"alternatives": "false"` on the primary fetch.
- `server/v2/providers.py` on `int/routes-airmap` — TT_MAX_ALTS (171),
  section parsing (1600-1685), instructions/progress/fuel (1687-1759),
  `parse_tomtom_route` (1762-1773), request params incl. alternatives +
  consumption (1776-1844), Ola alt path (1946-2081, 2093-2125),
  `traffic_for_route` signature (2158-2192).
- `server/exposure.py:230-401` — 250 m segment sampling, uniform-speed
  duration apportionment, Σc·ME·VE·Δt.
- `server/emissions.py:735-767` — trip_emissions: one moving span + idle
  span; vehicle {class, fuel, year_bucket, puc}.
- `server/routegraph.py:441-478` — engine tax-and-re-solve alternatives.
- `server/location_client.py:204-278` — AWS `MaxAlternatives` (Car=2 in
  plan.py, Scooter=0).
- `server/webapp/whereto.js:858-859,1027-1102` — mode_picks/one_pick
  client handling.
- `docs/lanes/engine-oct11.md` — live verification that all three modes
  picked the same OSRM road; Ola alternatives noted as "next step".
- `docs/lanes/whereto-oct11.md`, `MASTER-PLAN-oct11.md` — mode card copy.
