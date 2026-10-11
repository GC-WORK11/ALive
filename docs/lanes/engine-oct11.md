# Lane E (engine) — Oct 11: trip modes, fuel litres, live traffic

Files: `server/v2/plan.py` (wiring), `server/v2/modes_engine.py` (new, the
whole modes step), `server/tests/test_modes_oct11.py` (new, 22 tests).
Nothing committed / pushed / deployed.

## Wire contract
`POST /v2/plan` and `POST /v2/reroute` body gain `mode` (or `trip_mode`) ∈
`health_max | petrol_health | time_health` (aliases: `health`, `petrol`,
`budget`, `time`, `fastest`, "Petrol + Health" …; none collides with a vehicle
alias, so a legacy `mode:"car"` still means the vehicle). No mode → the old
body exactly (tested: no new keys, no extra router/traffic calls).

Response-level (plan): `mode`, `trip_mode`, `mode_rule`, `traffic`
`{live, routes_checked, routes_live, took_ms, source?, timed_out?, note?}`,
`fuel_basis` (sources sentence), `pick_route_id`; `mode_error` only if the
modes step itself failed (then the doc-06 winner carries the one pick).

Per option: `fuel_l` (litres; null for CNG/unknown), `fuel_kg` (CNG only),
`fuel_type`, `fuel_note`, `fuel_idle_l|fuel_idle_kg` (only when a live jam
added idle burn), `live_eta_s`, `traffic_delay_s` (null = no live reading,
never 0-for-unknown), `jams[]` `{lat,lon,from_m,to_m,delay_s,road,magnitude}`,
`traffic_source`, `mode_pick` (exactly one, always `options[0]`), `why`
(≤ 8 words). Petrol pick also: `fuel_saved_l|fuel_saved_kg` + `fuel_saved_vs`
(litres saved vs the fastest same-fuel row in the rider's family; never money).

Reroute: same body; the rerouted (flattened) option IS the mode's pick.
Top-level `mode` stays the selected row's travel mode (legacy contract); the
trip mode is `trip_mode`; the pick's `live_eta_s, traffic_delay_s, jams,
fuel_l, fuel_kg, fuel_type, fuel_note, fuel_saved_l, mode_pick, why` are
flattened next to `geometry/eta_s`, plus `mode_rule, traffic, fuel_basis,
pick_route_id`. With a mode but no vehicle in the body, the family of the row
being ridden (stored route's `mode`) is kept. Journey (lane J) should send
`{route_id, at, to, mode: <trip mode>, vehicle: <family>}`.

## Rules
Pool = servable rows of the rider's vehicle family (else all servable rows).
- health_max: min `dose.mid` (the number the card shows), no compromise.
- petrol_health: min fuel among rows with dose ≤ 1.15 × min dose. Fuel within
  1 % / 0.01 L (or kg) of the least → the cleaner row wins (a 1 mL edge is
  not "least petrol"). One fuel type → its amount; mixed types → engine CO₂.
- time_health: min `live_eta_s` among rows ≤ 1.15 × min dose; when any
  candidate has a live reading, unread rows can't win on a freeflow guess;
  within 60 s of the fastest → the cleaner row ("within a minute of fastest").
- All rows within 3 % dose, 60 s, 3 % fuel → "all routes are about the same today".

Fuel = the row's own `emissions.co2_kg.mid` ÷ petrol 2.31 / diesel 2.68 kg
CO₂/L (UNECE R101 carbon balance; IPCC 2006), CNG ÷ 2.69 kg CO₂/kg (IPCC
2006) → `fuel_kg`; EV/metro/walk/cycle → 0 with a note. Live-jam idle burn
(only delay the engine didn't already price) from measured Indian vehicles:
Tiwari, IJRET 2013 (car 0.65 L/h petrol, 0.59 diesel; 2W 0.20 L/h; CNG
auto 0.52 kg/h; no bus figure → no bus top-up).

Live traffic: `v2.providers.traffic_for_route(coords)` (lane P) on ≤ 5
distinct road geometries (rider's family first, cleanest first), all in
parallel, 3 s wall budget; `fast:true` first paint skips it. One basis on
every row: our eta + provider `delay_s` (provider's absolute `live_s` only
when it sends no delay and its road length matched ours, car rows only).
Expected provider signature (confirmed in lane P's providers.py):
`async traffic_for_route(coords: [[lat, lon], …], lonlat=None, mode="car")
-> {live_s, freeflow_s, delay_s, length_m, jams[], source} | None`
(sync providers also accepted — run on a private pool). Import is guarded:
missing provider → `traffic.note: "live traffic not connected"`, nulls.

Alternatives: when Amazon routing is off (prod today: location up=false),
mode plans also ask OSRM for ≤ 2 alternative roads (car + bike rows,
labelled "· alt N", ≤ 1.6× the fast road, same-road dupes dropped). The
public OSRM demo often returns none for NCR ODs; the engine's least-smoke
rows (prod engine up) are the other real choices.

## Verified
- `pytest server/tests/test_modes_oct11.py -q` → 22 passed.
- `pytest server/tests -k "plan or reroute or modes" -q` → 120 passed, 1 skipped.
- Live, own keyed instance :8118 (TomTom + Ola keys from keys.env; lane P's
  :8108 has no keys loaded → `traffic.live:false` there, honest), CP
  (28.6315,77.2167) → ISKCON East of Kailash (28.5565,77.2480), car petrol,
  18:00 IST: 5/5 roads read live (TomTom). All three modes pick the OSRM
  road "Car (AC)" 12.5 km: eta 971 s → live 1413 s (+442 s, 1 jam), dose
  7.8, 0.743 L (incl. 0.08 L idle in the jam) — it is cleanest, least
  petrol AND fastest now; the engine's least-smoke roads (12.9/12.7/15.4 km,
  dose 8.9–10.4, 0.77–0.86 L, 1–3 min slower) are the real alternatives.
  Reroute (28.600,77.230 → ISKCON, time_health) returned the pick, live 1256 s.
- First live run exposed a mixed basis (TomTom absolute time on car rows vs
  eta+delay on others made the bus look faster) and 1 mL / 45 s "wins";
  fixed (one basis; near-ties → cleaner row), both covered by tests.

## Open / for other lanes
- Lane P: `traffic_for_route` returns None without TOMTOM_API_KEY. Back it
  with Ola Directions when TomTom is absent: POST
  `/routing/v1/directions?origin&destination&waypoints=<≤ ~10 pts of our
  line>&alternatives=false&overview=full&traffic_metadata=true` → return
  `{live_s: legs[0].duration (Ola's traffic-aware time), length_m:
  legs[0].distance, delay_s: None, freeflow_s: None, jams: stretches of
  travel_advisory "from,to,level" with level ≥ 10 mapped to
  {lat,lon,from_m,to_m} over the decoded overview_polyline (delay_s null —
  level meaning unverified), source:"ola"}`. modes_engine already handles a
  live-time-only result (tested): matched car rows take it, others stay null.
- Lane P: the :8108 dev server runs without the keys (`/v2/p/status` all
  false) — source `~/.config/alive-ops/keys.env` before uvicorn.
- Ola Directions `alternatives=true` returned 3 real roads with live
  durations for CP→ISKCON (12.66 km/26 min, 12.14/30, 14.66/32). Using them
  as plan rows needs one time basis (Ola times are live, OSRM/engine are
  freeflow) — next step, not done today.
- First (cold) TomTom calls can exceed the 3 s budget (live: 3 of 5 timed
  out on the first plan, 0 after) → those rows say "no live traffic reading".
