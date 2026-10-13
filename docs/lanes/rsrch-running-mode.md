# rsrch-running-mode — Running Mode: end-to-end design

Research-only lane. Feature brief: for daily runners in Delhi — enter a
destination → on-foot routes scored for **least exposure + most greenery** →
the most detailed map in the app → chosen route in green → live run with a
mini exposure card + tracking → congrats card → all saved locally → the
every-5-min field refresh applies during the run. **No code changed.** All
file:line cites are from the working tree (`server/`, `Mobile/`, `Bridge/`).

## TL;DR

Most of this already exists — as *walk* machinery, not *run* machinery:

- **Routing:** the least-dose pathfinder (`routegraph.py` / `alive_core.PathEngine`)
  already has a **walk mode that routes over footways, paths, park trails and
  pedestrian streets** (hw classes 15–21 allowed, motorways denied, `foot=*`
  access honoured) with corridor-diverse `alternatives()`. Because the dose
  objective is `C·VE·len/spd` and run speed/VE are *uniform scalars*, **the
  walk argmin path is the run argmin path** — no graph changes needed for v1.
- **Live tracking:** `journey.js` is a full nav engine (watchPosition, arclength
  projection, dose accrual, off-route reroute, receipt, localStorage history)
  that is already mode-agnostic — it carries walk today and can carry a run
  with a HUD skin + 4 deltas (pace, pause, strip refresh, green paint).
- **Gaps:** no `run` mode in `exposure.py` (VE/microenv tables), no
  `activity`/`run` param on `/v2/plan`, no greenery data anywhere in the repo
  (the greenery lane's contract is the only input — spec'd below), no
  pause/resume anywhere (web or mobile), web journey never re-pulls
  `/v2/strip` (mobile does, every 10 min), and no run persistence key.
- **Biggest honest-design decision:** show *dose* and *greenness* as two
  numbers per route, don't fuse them into one score by default — a park path
  can be greener AND smokier (still air under trees next to a road); the
  product's credibility is that we never hide that trade.

---

## 1. What exists for on-foot journeys

### 1.1 Server: walk/cycle options in `/v2/plan`

`server/v2/plan.py` builds options on four racing arms
(`_build_options`, plan.py:1554–1632): motorized (AWS/OSRM driving), slow
(`_slow_mode_options`, plan.py:1097 — OSRM `cycling`+`walking` profiles,
durations restated at `MODE_SPEED_KMH {cycling:15, walking:5}`),
engine (`_engine_options` — least-dose A*, `ENGINE_MODES` at plan.py:1654
includes `("walk","On foot")`), transit (GTFS).

Every option carries (`_option`, plan.py:768–892): `mode`, `label`,
`geometry`/`route_geojson`, `steps` (turn list), `distance_km`, `eta_s`,
`dose {lo,mid,hi,avg_conc_ugm3,coverage,confidence,basis}`,
`emissions`, `segments` (per-stretch pm25 for the band ramp,
`_option_segments` plan.py:713 — `{geometry, pm25, band, start_frac,
end_frac, dist_m}`, contract: docs/lanes/route-segments-contract.md),
`route_id` (RouteStore key, **1 h TTL**, cap 500 — store.py:25–51),
plus truncation honesty (`reaches_destination`, `starts_at_origin`,
`*_gap_km`).

`modes_engine.py` (trip modes) already treats walk/cycle as engineless
(`_NO_ENGINE`, modes_engine.py:111 → `fuel_l:0, "no engine, no fuel"`)
and excludes them from live traffic (`is_road`, modes_engine.py:219).
`/v2/reroute` (plan.py:2427) replans from a live fix and accepts a
`mode`/`vehicle` family hint — `walk` is a valid family
(`_VEHICLE_ALIASES` plan.py:95).

**Run-specific fields: none.** No pace, no `run`/`jog` alias, no `activity`
axis. `exposure.py` has no running row: `MICROENV`/`VENTILATION_LPM`/
`MODE_ACTIVITY` (exposure.py:51–149) cover seated/walking/cycling only —
an unknown mode degrades to `microenv 1.0, VE 10.0, known_mode=False`
(exposure.py:178–189), which would *understate* a runner's dose and must
not be silently used.

### 1.2 Web: `journey.js` live engine — what a run inherits

`A.screen('journey')` (journey.js:541) is handed
`{option, options, from, to, mode, vehicle, field_age_s}` by whereto
(whereto.js:1277). Per-fix pipeline:

- `watchPosition {eHA:true, maximumAge:1000, timeout:20000}` + priming
  probe + 9 s geoPulse re-acquisition (journey.js:712–735).
- Arclength projection onto the line (`buildRoute`, journey.js:278);
  progress ratchets forward with teleport guards (>60 m/s implied,
  4-repeat escape; >150 m accuracy never moves progress).
- **Dose accrual** (`buildDose` + 1 Hz `tick`, journey.js:371–431, 918–947):
  served segment strip → `pmAt(s)`; breathing constant
  `k = plan_dose/(eta·meanPm)` (journey.js:520); `intake += k·pm·dt`
  — time-actually-spent × stretch pm25. 20 m intake bins for the
  receipt graph.
- Off-route >60 m >10 s → `POST /v2/reroute` with family hint
  (journey.js:845–881); adopt swaps plan/geometry/dose seamlessly.
- Jams every 120 s via `/v2/p/route_traffic` — **already skipped for
  `NO_TRAFFIC = {walk, cycle, metro}`** (journey.js:482) — a run
  inherits the same correct skip.
- Arrival: `rem ≤35 m` or `<250 m && within 55 m of dest`
  (journey.js:830–834) → `finish()` → receipt + persistence:
  `journey.last` + `journey.history` (cap 20) via `A.store`
  (journey.js:1090–1113). Record carries km, taken_s, dose_ug
  (lo/mid/hi), dose_plan_ug, avoided_ug vs smokiest option, stuck
  list, reroutes, `measured:'gps'`, `simulated` flag.
- Receipt (journey.js:1133–1336): hero µg, WHO-day verdict scale,
  vs-cleanest comparison, per-stretch intake bar chart coloured by
  band, mini SVG map (plan line + actual track tinted by band),
  distance/time/stuck cells, "Plan the way back".

**Verdict: the journey engine CAN carry a run.** It is mode-agnostic by
construction — nothing in the fix→progress→dose→receipt path reads
`mode` except the glyph (`vehicleGlyph`, journey.js:141), the traffic
skip (`NO_TRAFFIC`), and label strings. The deltas a run needs:

1. **Pace, not speed** — HUD shows km/h (journey.js:1000); runners want
   min/km and avg pace. Pure display change on `S.speed`/`S.odo`/`t`.
2. **Pause/resume — absent everywhere.** `taken_s` is wall time; dose
   honestly keeps accruing while standing (the air keeps hitting), but
   runners expect paused *moving-time* stats. Mobile already computes
   `pausedS` from fix-gaps (engine.ts NavSummary, counters.ts:78–95 —
   dose accrues at rest-VE during gaps) — the honest model to mirror.
3. **Live field refresh — absent on web.** Journey uses the plan-time
   strip for the whole trip. Mobile re-pulls `/v2/strip` every 10 min
   (`STRIP_REFRESH_MS`, Mobile/src/nav/engine.ts:44). For the run
   screen, re-pull every 5 min (the app's poll cadence, home.js:27) —
   §7.
4. **Green route paint** — `showRoute` default is already forest green
   `#2A4D3B` + white casing (map.js:695–710); journey overlays band
   segments via `paintSegs`. For a run we keep the solid green line and
   drop the band ramp (or demote it behind a toggle) — §6.
5. **A `run` activity flag** through the handoff — new `params.activity`
   (or `vehicle:'run'`) so the same screen swaps HUD, store keys, and
   receipt copy without forking the engine.

### 1.3 Mobile (parity note)

`Mobile/src/nav/engine.ts` (`useNavEngine`) is the *stronger* engine:
expo-location `BestForNavigation` 1 s/5 m watch, `LiveCounters` doing
`dose += C(alongM)·ME·VE·dt` per 1 Hz tick with lo/mid/hi bands,
strip re-pull, honest `pausedS`, trajectory privacy-trim + `/v2/trip`
donation. `ME_VE` (counters.ts:25–34) has `walk` but no `run`. Running
mode's real athlete surface is the phone-in-pocket app — spec'd as a
follow-on parity lane (§10), not the web demo path.

---

## 2. Pedestrian routing — substrate audit

Six ways to get a real walkable route today, ranked by fitness for
"least exposure + most greenery":

| # | Substrate | Pedestrian capability | Status in-tree | Fit for run routes |
|---|-----------|----------------------|----------------|-------------------|
| 1 | **Local route graph** (`routegraph.py`, `alive_core.PathEngine`) | `walk` mode: denies only motorway/mw_link (hw 0–1); **allows footway, pedestrian, path, steps, bridleway, corridor, cycleway** (HW_CODES 15–21, build_route_graph.py:83); honours `foot=no`/access byte (routegraph.py:308–324); ignores vehicular oneways; turn-ban mask `turn:4` | Live — serves `walk` engine rows in `/v2/plan` today | **Best.** Dose-optimizing A* (edge cost = `C·VE·len/spd`), corridor `alternatives()` (≤85% shared-length diversity gate, ≤1.6× detour cap), snap-connectivity screened, ~10 ms C++ solves, zero external calls. The only substrate that optimizes *exposure* rather than time. |
| 2 | **AWS Location `Pedestrian`** | `travel_mode="Pedestrian"` already in the allowlist (location_client.py:219) | Wired but **never called** — `_motorized_options` requests only `Car`/`Scooter` (plan.py:931) | Good complement: real pedestrian network + `MaxAlternatives`, returns steps. Cost: AWS call per OD. |
| 3 | **OSRM `walking` profile** | Real foot routing on the same OSM base | Wired — `deps.osrm_route("walking")` serves walk rows (plan.py:1103); local daemon `OSRM_URL_WALKING` (port 5002 per run_stack.sh), flagged public-demo fallback; `modes_engine.osrm_alternatives("walking",…)` already fetches alts | Good honest baseline — the "grey route a maps app would give you" (fastest/shortest walk) to compare the green route against. |
| 4 | **Ola `mode=walking`** | Documented param: `driving|walking|bike|auto` (Ola Directions docs) | Proxy calls `/routing/v1/directions` **without** `mode` (providers.py:1741–1747, traffic fallback only — defaults to driving) | Viable third geometry source; India-tuned ped network. Small provider change (`mode` param + steps). |
| 5 | **TomTom `travelMode=pedestrian`** | Documented in calculateRoute | `_TT_MODES` excludes it (providers.py:1563 — car/motorcycle/bus/taxi/van/truck only) — but that function is *traffic-on-our-line*, where pedestrian is meaningless anyway. A new pedestrian route call would be a new method. | Optional. `routeType=shortest` could give a genuinely different geometry for the alt pool. |
| 6 | **Mappls `route_adv/walking`** | Exists (pedestrian profile; route_adv only — no traffic/ETA resources; needs `route_adv` allocation on the key) | Not wired for routing at all (search/geocode only) | Stretch. India-specific foot mapping; low value vs #1–#4 for the demo window. |

**Recommended substrate stack for run planning:**

- **Primary:** engine `walk` A* + `alternatives()` → the *least-dose* run
  corridor + 1–2 diverse alternates. This is the differentiator — the
  only provider that can claim "least exposure" honestly.
- **Baseline:** OSRM `walking` (or AWS `Pedestrian`) → the reference
  "normal route" for the dose-saved comparison and the money shot.
- **Not needed:** live traffic (runners don't sit in jams; `NO_TRAFFIC`
  already correct), TomTom traffic on pedestrian lines.

**The speed/VE insight that makes this cheap:** engine edge dose =
`C_e · me · VE · (len/spd)`. `me`, `VE`, and a flat `spd` are uniform
scalars → **the A* argmin path is identical at any run speed**; only the
dose magnitude and ETA change. So: solve with `walk`, re-price totals at
run constants, serve as `run` rows. No graph rebuild, no new mode in
`MODE_RULES` for v1 (a real `run` rule would only matter if we wanted
speed to vary by edge class — stairs at 5 km/h, promenade at 11 — a
legit v2 refinement, flagged).

**Run dose physics (for the science lane to sign off):** same path, same
air → run dose = walk dose × `(VE_run/VE_walk)` × `(eta_run/eta_walk)`
≈ walk × `(30/14)` × `(5/10)` ≈ **walk × 1.07 per km**. Running breathes
harder (VE ~28–40 L/min moderate, EPA EFH band — propose 30 L/min mid
with the band labelled) but halves exposure time; per-km dose lands
~7% above walking, and the *route choice* swings the concentration term
by multiples of that. This is also the honest copy on screen: "you
breathe ~2× a walker per minute — the path matters more, not less."

---

## 3. Green scoring — contract with the greenery lane

**Repo today: zero greenery data.** The route graph stores only highway
class/oneway/speed/name/access (build_route_graph.py); no `leisure=park`,
`landuse=*`, `natural=wood`, or canopy attributes anywhere. The basemap's
only green is the OMT `park` fill layer painted grey in the offline
style (map.js:79). Everything below is the *interface* — the greenery
research lane owns the data.

### 3.1 Proposed contract (what `/v2/plan` must gain)

Per option (additive, optional — absent when the greenery layer isn't
built):

```jsonc
"green": {
  "score": 0.62,            // fraction of route length inside green
                            // corridor coverage, 0..1 — honest ratio
  "corridor_m": 3400,       // metres of the path under coverage
  "basis": "osm leisure=park|garden|nature_reserve, landuse=grass|forest|recreation_ground, natural=wood|scrub — 25 m buffer",
  "coverage": "osm-delhi"   // or null + score:null when unbuilt
}
```

And per segment (extends the existing `segments[]` contract so the map
can paint green intensity):

```jsonc
"segments[i].green": true | false   // or "green_frac": 0..1 per span
```

Two honest axes per option, computed on the *same served geometry*:

- **Exposure:** existing `dose {lo,mid,hi}` — re-priced at run VE.
- **Greenery:** corridor coverage fraction — a *descriptive* stat
  (how much of the path is inside mapped green), not a health claim.

### 3.2 One score or a slider? — Neither alone; two numbers + a pick

Fusing dose and greenness into one number hides the case that *defines*
Delhi: the Lodhi-Gardens path can be greener **and** smokier than the
wide-ventilated avenue (still air under canopy can hold roadside PM).
The product rule everywhere else is "show the trade, never blend it
away" (health_max vs petrol_health vs time_health keep three honest
picks). So:

- **Default sort:** dose (the app's core promise — same `_dose_key`
  ranking as today).
- **Each card shows both:** "3.4 km through green · ≈42 µg" vs
  "0.8 km through green · ≈35 µg" — the runner sees the trade in one
  glance.
- **A toggle, not a slider:** two labelled sorts — `least smoke` /
  `most green`. A slider implies a blended formula we'd have to defend;
  two sorts show the actual ends of the trade and let the runner pick
  their own blend point by choosing a middle card. (A true weighted
  slider is a stretch flag — it needs a defended weighting function.)
- **Honesty guard:** if the greenest route costs *more* dose than the
  cleanest, its card must say "+N µg for the green" — never let the
  green styling imply it's also the clean-air pick.

### 3.3 Where the coverage comes from (for the greenery lane)

Cheap path: the same `northern-zone`/`central` OSM PBFs the route graph
already builds from — extract `leisure=park|garden|nature_reserve|common`,
`landuse=grass|forest|recreation_ground|village_green`, `natural=wood|scrub|tree_row`
polygons once into a coverage raster/edge flag at graph-build time (a
per-edge `green` bit would let the *pathfinder itself* weight greenery —
v2; for v1 a post-hoc coverage fraction per route is enough). Stretch:
NDVI/Sentinel tile overlay — prettier, slower, same contract.

---

## 4. Screens & flow

```
┌ HOME (new "Run" door tile)                                       
│   → optional: "cleanest window today" chip from /v2/day           
│     (summarize_day's cleanest_window — the "wrong hour" answer)   
▼                                                                  
SCR 1 · RUN SETUP  (reuse whereto search machinery, activity=run)    
    From: your location (GPS) | pinned | search                     
    To:   search field  ──────────────────────────────  [map pin]   
    ┌ plan cards (one per option, ≤4)                              
    │  ● green line preview · "Cleanest air" ≈N µg · 5.2 km · ~31min 
    │    ⌂ 3.4 km through green                                     ⑤
    │  ○ grey preview  · "Usual way"  ≈M µg · 4.6 km · ~28min       
    │  ○ "Greenest"     ≈K µg · 6.1 km · ~37min · 4.9 km in green   
    └ [least smoke | most green] toggle        [Start run]          
▼                                                                  
SCR 2 · LIVE RUN (journey engine, run skin)                         
    top:    maneuver banner (same engine; or slim "follow the line" 
            mode — running you don't stare at turns)                
    map:    green line + puck, follow-cam, park fills tinted green  
    mini card (bottom, live-updating 1 Hz):                         
      ┌──────────────────────────────────────────┐                 
      │ 4.32 km   26:41   6:11/km   ≈ 31 µg      │   ← dose ticks   
      │ Poor air here ──────●── 54 µg/m³         │   ← strip pm@pos 
      │ [❚❚ Pause]                        [End]  │                 
      └──────────────────────────────────────────┘                 
▼                                                                  
SCR 3 · CONGRATS CARD (receipt, run skin)                           
    "5.2 km in 32 min — nice run."                                  
    You breathed ≈ 48 µg  ·  that's ≈ N µg less than the            
    usual way (the grey route)                                      
    [per-km intake bars coloured by band — reuse jr graph]          
    [mini map: green plan line + your track]                        
    pace · splits-ish · share? (stretch)          [Done] [Run back] 
▼                                                                  
SCR 4 · RUN HISTORY (ledger section or its own list)                
    localStorage run.history — date, km, time, avg pace, dose, saved
```

Entry point options: a door tile on home next to "Where to" (home.js:400
door array pattern) + sidebar nav row (sidebar.js:100 nav list). The
`activity` rides the whereto→journey handoff as a first-class param.

**The "wrong hour" hook (cheap, high story value):** `/v2/day`
(day.py:408) already returns hourly slots + `cleanest_window` and
`/depart` (main.py:953) prices the same trip per departure hour. A one-line
chip on SCR 1 — "air is ~40% lighter after 9 pm tonight" — is the
existing engine answering the feature's premise; no new science.

---

## 5. Data contract — what `/v2/plan` must return for a run

**Recommendation: extend `/v2/plan`, don't fork an endpoint.** A
`POST /v2/run` that re-implements `_build_options` duplicates the whole
four-arm/honesty/missing-degradation machinery. Instead:

```jsonc
POST /v2/plan
{ "from": {...}, "to": {...}, "vehicle": "walk", "activity": "run" }
```

`activity:"run"` is additive (absent → byte-identical today). Its effect:

1. **Option filter:** keep only on-foot rows (engine `walk` primary +
   alts relabelled `run`, OSRM/AWS/Ola walking rows as baselines). Motor
   rows are meaningless for a run plan — omit, not degrade.
   (`_options_bounded` arms still run; the run response just filters —
   or cheaper: a `want=("walk")` hint that skips motor/transit arms.
   Filtering after the fact is honest; skipping arms is faster.)
2. **Re-priced fields per row** (`mode:"run"`): `eta_s` at ~10 km/h
   (6:00/km stated pace — honest labelled estimate, not a promise);
   `dose` re-integrated through `exposure.dose` with a new `run` row:
   `MICROENV.run = 1.30` (open air, same as walking), `VE.run ≈ 30 L/min`
   (science-lane signoff; band via sigma as usual),
   `MODE_ACTIVITY.run = "running"`. `engine_dose_ug` rescaled ×30/14
   with `duration_model:"estimated"`, `duration_basis:"10 km/h stated
   pace"`. `MODE_SPEED_KMH["running"]=10` for router-row restatement.
3. **New per-row fields** (all additive): `pace_s_km` (600 stated),
   `green` block (§3.1), `segments[i].green`, and a response-level
   `baseline_route_id` naming the "usual way" row so the receipt's
   dose-saved claim cites a *served* alternative.
4. **Aliases:** `_VEHICLE_ALIASES += {run|jog|running → walk family}`
   *only for family mapping* (reroute/ledger) — the dose mode stays
   `run` so its VE isn't flattened to walk's.
5. **`/v2/reroute`** needs `activity` passthrough (or family-hint `run`
   → walk routing, run-priced dose) — a run off its line should re-plan
   *pedestrian* routes, which already works via `vehicle:walk`; the run
   skin must send `activity:"run"` so the returned rows stay run-priced.
6. **Route cap:** runs are 1–20 km. Serve engine/OSRM rows up to
   ~25 km; beyond that the honest answer is "that's a long run —
   the air math still holds" with rows intact (a cap, not a block).

`?sim=1` QA sim (journey.js:751) still works — it drives fixes along
whatever line the plan served.

---

## 6. Live-run state machine

Reuses `journey.js` S-object semantics (journey.js:567–582). Run deltas:

```
MOUNT(plan, activity=run)
  → ACQUIRING  (watchPosition + geoPulse; "finding your spot…")
  → RUNNING    (per-fix: project → odo/s → dose bins → pace → render)
      ├─ PAUSED  (user tap OR fix-gap >30 s: clock & odo freeze;
      │           dose keeps accruing at REST VE — the air doesn't
      │           pause; label "rest breathing still counts" — the
      │           honest model Mobile already proves in counters.ts)
      ├─ OFF_ROUTE (s off-line >60 m >10 s → /v2/reroute, adopt())
      ├─ STRIP_TICK (every 5 min: GET /v2/strip?route_id → swap pmAt
      │              strip; field-age chip shows the read's age)
      └─ GPS_LOST  (>5 s stale → vShown=0, "GPS signal lost" pill)
  → FINISHING  (rem ≤35 m or <55 m of dest | user End → confirm)
  → RECEIPT    (persist + congrats card)
  → unmount: clearWatch + timers + strip timer + wake lock release
```

Details:

- **Track:** `pushTrack` already records `[lon,lat,pm@pos]` — the run
  receipt map and any future export ride on it unchanged. Add `acc`
  per the gps-precision lane's recommendation (honesty of the trace).
- **Mini exposure card:** dose-so-far (`S.intake`, same math), current
  stretch pm25 + band word (`P.dose.pmAt(S.s)` → `A.fmt.band`), pace
  (instant, smoothed ~5 s; `—` under 8 km/h-confident noise), distance,
  elapsed *moving* time + paused subscript. One-tap pause, End behind
  the existing two-tap confirm.
- **Green line:** chosen route `showRoute('journey', geom)` *without*
  `paintSegs` → solid `#2A4D3B` green (alternates can stay grey
  hairlines at reduced opacity during the run for context, or hide —
  cleaner to hide).
- **"Most detailed map":** same map engine, run-scoped tweaks —
  default zoom ≥16.5 (camera already eases to ≥16, journey.js:673),
  puck-following heading mode already exists, plus **park tint**:
  `m.setPaintProperty` on the OMT `park` fill (and `landcover` wood/
  grass where the style exposes them) to a real green while the run
  screen is mounted; revert on unmount. Cheap, scoped, honest — the
  greens on the map are literally the corridor the score counts.
  *Not* a second basemap style (see §9).
- **Wake lock:** `navigator.wakeLock.request('screen')` on run start —
  Chrome/Android real support, iOS Safari ≥16.4 partial; degrade
  silently (a sleeping screen during a run is a UX fail, not a data
  lie — the watch keeps running when the OS allows).
- **Splits (stretch):** per-km pace/dose ticks are ~30 lines on top of
  `S.bins` (already 20 m-binned); v1 can ship without.

---

## 7. The every-5-min field refresh during a run

Server truth: the field refreshes **request-driven** (`CACHE_TTL=900` s,
airfield.py:35; `FIELD.refresh` deduped/bounded via `_bounded_refresh`,
main.py:904–930). Client cadence: home polls 5 min (home.js:27);
mobile nav re-pulls strip 10 min (engine.ts:44).

Run design (matching the brief's 5-min):

- `setInterval(5*60*1000)` → `GET /v2/strip?route_id` — the stored
  geometry re-sampled at ~250 m on the *current* served field
  (strip.py:226–278: samples, roads, `field.age` status). On success,
  rebuild `P.dose` (pmAt/watt) from the fresh samples and update the
  band strip; dose-so-far history stays (you breathed what you
  breathed — bins are immutable once recorded).
- Fallbacks, in order: strip 404/expired → `A.aqiSpot(lat,lon)` point
  read (2-min memoized, app.js:48) for the mini card's "air here";
  total failure → keep last strip, chip shows `field age N min`
  (strip's `field.age_s`-equivalent — never spin fake freshness).
- **TTL flag:** `route_id` lives **1 h** (store.py:25). A >1 h run
  loses strip access — reroute (which issues a fresh route_id) or
  re-plan at pause-resume renews it; flag for the >60 min-long-run
  case. RouteStore TTL bump to 2 h is a one-line server decision.
- Engine reweight TTL is 10 min (ENGINE_REWEIGHT_TTL_S, plan.py:1642)
  — a strip re-pull can return a *freshly-priced* field mid-run. Dose
  display therefore shows `≈` and the receipt labels the plan vs
  measured basis exactly as today.

---

## 8. Persistence schema (localStorage, `A.store` = `alive.` namespace)

Two keys — runs are their own ledger but the day ledger should see the dose:

```jsonc
// alive.run.history  (cap 20, newest first — same shape discipline as
// journey.history so ledger.js can merge by `kind`)
{
  "v": 1, "kind": "run",
  "t": 1759700000000,           // start epoch ms
  "arrived": true,              // finished at dest vs ended early
  "from": {"lat":…, "lon":…, "label": "…"},
  "to":   {"lat":…, "lon":…, "label": "…"},
  "km": 5.21, "moving_s": 1922, "paused_s": 43,
  "avg_pace_s_km": 369,         // moving_s/km — derived, honest
  "dose_ug": 48.2, "dose_lo_ug": …, "dose_hi_ug": …,
  "dose_plan_ug": 51.0,         // plan-time estimate for the same line
  "mean_pm25": 96.4,            // time-weighted along the run
  "green_frac": 0.62,           // metres under green / km (contract §3)
  "saved_vs_usual_ug": 17.3,    // vs the served baseline row — the
                                // congrats headline; null when no
                                // baseline was served (never invented)
  "route_id": "ab12cd…",        // may be dead (>1 h) — display only
  "simulated": false,           // ?sim=1 QA rows excluded from history
  "measured": "gps"
}
// alive.run.last — same record, singleton (fast "last run" card on home)
```

Plus a **summary mirror into `journey.history`** (vehicle:"walk",
mode:"run", same dose fields) so ledger.js/home counts the run's dose in
the day total without ledger changes — it reads known fields and ignores
extras (ledger.js:126, home.js:135). Indexing: `kind`/`mode` separates
runs from trips in any future "Runs" list. No IndexedDB needed — records
are <1 KB, localStorage cap is far away; track polylines stay out of
storage (journey already drops them) — store `track` only if a
"view past run map" screen lands (then IndexedDB, flagged stretch).

---

## 9. Feasibility flags

**Cheap / already true:**
- Walk-mode engine paths = run paths (uniform scalar insight, §2) — the
  differentiating least-exposure route is *already computed*.
- Journey engine carries the run — HUD deltas are display-level.
- OSRM walking + AWS Pedestrian need only *calls*, not integrations.
- `/v2/strip` re-pull = the 5-min refresh, endpoint exists verbatim.
- TomTom pedestrian unnecessary for v1 (traffic is motor-domain).
- Park tint via `setPaintProperty` — scoped, reversible.

**Real work but bounded:**
- `exposure.py` run row (VE 30 L/min mid — needs the science lane's
  published-band signoff; microenv 1.30) + `MODE_SPEED_KMH.running`.
- `/v2/plan` `activity` param + run rows + run-family aliases;
  `/v2/reroute` passthrough.
- Pause/resume: new in both surfaces; Mobile's `pausedS`/rest-VE model
  is the honest template — *dose does not pause*, moving-time does.
- Greenery coverage build (parallel lane) — the score/green-paint
  contract above degrades to `green:null` cleanly when unbuilt.

**Stretch (say so, don't promise):**
- **Loop routes** ("5 km loop from home") — brief is destination-based;
  loops need graph multi-leg synthesis. v2.
- **One blended green-dose score / slider** — needs a defended weighting;
  ship the two-sort toggle first.
- **Second basemap style** (OpenFreeMap liberty/satellite) for "most
  detailed" — new tiles dependency; the park-tint + zoom approach covers
  the intent at zero dependency.
- **Background/screen-off tracking** — web tab must stay alive; wake
  lock is partial on iOS. The *real* long-run surface is the Mobile app
  (parity lane: LiveCounters + ME_VE.run + nav engine already does
  strip-refresh/pausedS/donation).
- **Share/export** (GPX/PNG card) — track is in-memory only today.
- **TomTom/Mappls pedestrian** — alternative geometry sources if engine
  + OSRM disagree in QA; not needed for launch.
- **route_id TTL** for >1 h runs — bump or auto-renew via reroute.

**Honesty watch-items:**
- Never call it "clean air route" — it's *least exposure of the served
  options*; the copy everywhere is dose numbers, band words, and
  "≈N µg less than the usual way" against a *served* baseline.
- Green score = coverage fraction of *mapped* green in OSM — label the
  basis; unmapped green isn't counted, which the card should say.
- Run VE is an estimate band, not measured — `dose.confidence` and the
  `basis` string carry that, same discipline as every other mode.

---

## 10. Demo framing — the money shot

**Screens for the video (60–75 s):**

1. Home → tap **Run** → type a destination (e.g. CP → Lodhi Gardens).
2. Plan sheet: three cards — the grey "usual way" hugging the highway,
   the green route threading the park, the greenest detour. Two numbers
   each: µg and km-in-green. Toggle flips sort order — watch the cards
   reorder. **The two-axis trade visible in one frame.**
3. Start → map zooms to street level, park fills tinted, **green line**
   through the park vs the grey line on the highway. *This is the
   money shot:* same OD, two corridors, one painted green through real
   parkland with "≈38 µg vs ≈61 µg" on screen.
4. Live: mini card ticking µg + pace + the "Poor air here" chip changing
   as the runner exits the park stretch (sim or screen-cast a real run).
   The 5-min strip refresh quietly updates the card.
5. Finish: congrats card — distance/time/avg pace/dose + "**17 µg less
   than the usual way**" + intake bars + mini map.
6. Beat of honesty: history list shows the run persisted locally; the
   day ledger counts it.

**Camera notes:** keep the grey baseline route visible during the run
plan (it disappears at Start — the contrast lives on the plan screen);
the receipt mini-map echoes plan-vs-tracked like today's receipt.

**Sequencing risk for the demo:** the greenery layer is the only hard
external dependency — if it slips, the demo still works with
least-dose-only cards (green block null, map tint still real since OMT
park polys ship in the basemap regardless).

---

## Appendix — evidence index

| Claim | Where |
|---|---|
| Walk engine mode: foot classes legal, motorways denied, access byte | routegraph.py:75–77, 308–324; build_route_graph.py:83–85,102–136 |
| Walk in ENGINE_MODES → least-dose on-foot rows served today | plan.py:1654–1656, `_engine_primaries` 1742 |
| Corridor-diverse `alternatives()`, ≤85% shared, ≤1.6× detour | routegraph.py:110–117,441–462; plan.py:1761–1789 |
| VE/ME priced tables (walk VE 14, ME 1.30; no `run`) | exposure.py:51–149; routegraph.py:83–86 |
| OSRM walking wired; local daemon per profile | deps.py:223–274; routing_local.py:63–69 |
| AWS `Pedestrian` allowed, never called | location_client.py:219; plan.py:931 |
| Ola walking documented; proxy omits `mode` | providers.py:1741–1747 (call is traffic-only) |
| TomTom pedestrian valid upstream; `_TT_MODES` excludes (traffic-only fn) | providers.py:1563–1583 |
| Journey engine: watchPosition, dose accrual, reroute, receipt, history | journey.js:712–735,371–431,845–881,1070–1336 |
| Journey skips traffic for foot modes | journey.js:482 (`NO_TRAFFIC`) |
| `/v2/strip` re-samples stored geometry on live field | strip.py:226–278; route_id TTL 1 h store.py:25–51 |
| Mobile already does strip re-pull + pausedS + rest-VE dose | engine.ts:41–44,256–262; counters.ts:78–95 |
| Field refresh = request-driven 900 s TTL; client polls 5 min | airfield.py:35; main.py:904–930; home.js:27 |
| `/v2/day` cleanest_window + `/depart` per-hour dose | day.py:209–247,408; main.py:953–960 |
| Journey handoff params | whereto.js:1276–1281 |
| localStorage via A.store; journey history shape | app.js:60–67; journey.js:1090–1113; ledger.js:12,126 |
| Competitors shipping run-aware AQ routing | docs/27-frontier.md (AirTrack, AQI Path) |

*Open coordination points: run VE constant (science lane), green
coverage contract §3.1 (greenery lane), `activity` param shape
(plan/contract lanes), journey.js run-skin ownership (journey lane —
single engine, new `params.activity`, or extracted nav core), Mobile
parity sequencing (nav lane).*
