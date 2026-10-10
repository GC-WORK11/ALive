# 03 · Emissions & fuel — the corridor-hour emissions field and the ₹ basis

*Sibling memo in the `docs/gov/local/` series (see `10-synthesis-skeleton.md`
for the map and the shared vocabulary). This file owns: **fleet-average
emission-factor bands, the per-trip fuel/energy cost basis, and the
emissions-per-corridor-hour construction** that `01-assignment-math`
(budgets), `02-congestion-estimation` (flow/speed), `04-gov-platform`
(console) and `08-delhi-factors` (fleet mix) consume. Where a sibling
disagrees on its own turf, the sibling wins; where the shipped code and
this memo disagree, the code wins and the memo gets patched.*

*Grounding rule inherited from `docs/26`/`docs/29`/`docs/32`: **bands,
never points**. No number in this file is a per-vehicle truth; every
quantity is a class-average band with its provenance named. The engine
this memo documents is `server/emissions.py` (shipped) — section
references are to that file unless noted.*

---

## 0. Verdict up front

**The emissions chain exists, is shipped, and is honest — the fuel-cost
column does not.** `/v2/plan` already returns per-option CO2/PM2.5/NOx
bands with a moving/idle/cold-start decomposition, per-passenger
occupancy accounting, a PUC-calibration path, and a separately-reported
non-exhaust PM band (`server/v2/plan.py::_emission_band`,
`server/emissions.py::integrate`). What the same response does **not**
carry is a ₹ field — neither fuel-burn cost nor fare. Both are
computable from data the response already contains (CO2 inverts to fuel
through carbon factors; distances and wait-time feed published fare
tables), so §3 specifies the ₹ model to wire, not a research programme.

Three further verdicts, each defended below:

1. **The honest modelling tier today is macroscopic**: average-speed
   emission factor × distance, plus a g/s idle floor charged on
   `eta_s − freeflow_s` congestion delay. Microscopic VSP/instantaneous
   modelling is not supported by our inputs and is explicitly out of
   scope (§4).
2. **A jam is the worst emitter on every axis we score.** On the
   worked 10 km example (§3.4) a 20-minute standstill adds +30% CO2,
   **+226% PM2.5** and +72% NOx to a petrol car trip, ~+₹21 of fuel,
   and keeps the rider inside the corridor plume for the same minutes
   — the joint dose×emission penalty the assignment memo needs (§5).
3. **Corridor-hour emissions are sums of donated traversals, scaled by
   an honestly-banded penetration estimate** — and the observed sum and
   the scaled estimate are two different numbers that must never be
   silently merged (§7). Cold-start truth: today's cell store already
   sums `co2_kg` per traversal (`community.py` `_fold`); PM2.5/NOx sums
   and per-cell idle attribution are gaps G-1/G-2.

---

## 1. The inference chain (what runs today)

```
declared {class, fuel, year?|year_bucket, puc?}        (S8 questionnaire →
  → BS bucket            _BS_BY_YEAR / _FLEET_PRIOR      emissions.py:104-131)
  → EF band/pollutant    _EF, g/km (lo,mid,hi) @ 30 km/h emissions.py:138-238)
  → speed factor f_p(v)  COPERT U-curve, pinned <9 km/h  emissions.py:286-308)
  → idle floor I_p       g/s while stationary            emissions.py:249-262)
  → cold-start multiplier  first 4 km, decays linearly   emissions.py:264-273)
  → occupancy ÷          auto 1.5 · cab 1.3 · bus 20     emissions.py:63-67)
  → trip band {lo,mid,hi} CO2 kg · PM2.5 g · NOx g      integrate():554)
```

- `vehicle` on `/v2/plan` accepts the questionnaire strings; unknown
  class/fuel/year values degrade to the **Delhi fleet prior** (never a
  4xx, never a guess presented as a fact — `plan.py::_parse_vehicle`,
  `_option_vehicle`).
- A `vehicle_profile.puc` block (measured readings vs printed limits,
  or a declared BS class) narrows the band: health factor clamped to
  0.3–3× on PM/NOx, quarter-strength on CO2 (`emissions.py:411-493`).
- `trip_emissions(mode, km, eta_s, freeflow_s)` is the preview path:
  **one moving span at free-flow mean speed + one idle span of
  `eta − freeflow`** (`emissions.py:735-766`). This is the two-span
  macroscopic model §4 justifies.
- Labels are generated, e.g. *"estimated for a CNG auto-rickshaw
  (Delhi fleet mix — BS-II–BS-VI)"* — every served number carries its
  vehicle assumption.
- Non-exhaust PM10 (resuspension + brake/tyre) is integrated per vkm
  but **reported separately, never folded into the tailpipe headline**
  (`emissions.py:279-284`, `712-719`) — ~86% of Delhi on-road PM10 is
  non-exhaust (Sahu et al., STOTEN 2020; `docs/26`).

### Provenance (printed in the code header, `emissions.py:19-47`)

ARAI/ICAP-2007 chassis-dyno in-use fleet (MIDC) is the base table;
Guttikunda-2015 fleet ±SD and the SIM/urbanemissions Delhi PM2.5 set
cross-check it; real-world uplifts from Jaiprakash–Habib on-road
tailpipe, ICCT BS-IV analysis, and ICCT-TRUE Delhi remote sensing
(111,712 measurements — BS-VI taxis 2.4× private NOx, high-use CNG
1.5–14× over type-approval) widen the `hi` tail. Full argument:
`docs/29` §3–4, fleet priors `docs/32` §2.

---

## 2. Speed-band emission factors (COPERT-style)

### 2.1 The curve

`speed_factor(pol, v)` (`emissions.py:294-308`) is the COPERT U-shape,
normalised to **1.0 at 30 km/h** (the MIDC urban-average reference, so
the published table reproduces at ref speed), minimum near **50 km/h**,
pinned flat below **9 km/h** — slower motion is stop-creep and belongs
in the idle bucket:

```
f_p(v) = g_p(v)/g_p(30 km/h)
g_p(v) = 1 + L_p·((50−v)/50)²·(50/v)   v < 50 km/h
         1 + H_p·((v−50)/50)²          v ≥ 50 km/h
(L,H): CO2 (1.2, 0.8) · PM2.5 (1.8, 1.2) · NOx (0.9, 1.4)
```

Measured multipliers (computed from the shipped function):

| mean speed km/h | CO2 | PM2.5 | NOx | interpretation |
|---|---|---|---|---|
| ≤9 (floor) | 4.15 | 5.22 | 3.52 | pinned — true stop time goes to idle g/s |
| 10 | 3.67 | 4.57 | 3.13 | heavy jam creep |
| 15 | 2.24 | 2.66 | 1.99 | peak-hour arterial |
| 20 | 1.58 | 1.77 | 1.46 | congested |
| 25 | 1.21 | 1.28 | 1.17 | typical urban |
| **30** | **1.00** | **1.00** | **1.00** | reference speed |
| 40 | 0.80 | 0.74 | 0.84 | free-flowing urban |
| 50 | 0.76 | 0.68 | 0.81 | optimum |
| 60 | 0.78 | 0.71 | 0.85 | expressway |
| 80 | 0.98 | 0.97 | 1.21 | highway |
| 100 | 1.36 | 1.49 | 1.94 | NH/expressway hi-speed rise |

Honesty note: the U-curve captures *speed-conditional* g/km. It does
not capture acceleration enrichment between two readings — that is a
microscopic term and its absence is declared in §4, not hidden in the
curve (band widening `sw = 1 + 0.2·|f−1|` on lo/hi covers part of it).

### 2.2 Resolved factors — Delhi fleet prior, per vehicle-km

`emission_factors({class})` at the fleet prior (year *not_sure* →
BS-III–VI mix, `docs/32` §2.1: ~89% BS-IV+ on-road), warm engine, g/km
mid at 30 km/h (band lo–hi in parens). Vehicle-level; shared modes
divide by §2.3 occupancy at integrate time.

| class·fuel | CO2 g/km mid (lo–hi) | PM2.5 g/km mid (lo–hi) | NOx g/km mid (lo–hi) |
|---|---|---|---|
| car · petrol | 153 (105–265) | 0.012 (0.004–0.16) | 0.37 (0.10–1.10) |
| car · diesel | 191 (125–560) | 0.093 (0.003–0.55) | 0.89 (0.15–6.0) |
| car · CNG | 158 (120–260) | 0.016 (0.005–0.14) | 0.20 (0.08–1.40) |
| car · electric (WTW) | 139 (92–221) | ~0 | ~0 |
| cab · CNG (taxi uplift incl.) | 182 (126–416) | 0.021 (0.006–0.28) | 0.30 (0.09–3.36) |
| bike/scooter · petrol | 34 (21–52) | 0.032 (0.010–0.13) | 0.25 (0.08–0.85) |
| auto · CNG | 78 (52–125) | 0.040 (0.010–0.17) | 0.49 (0.12–1.90) |
| auto · petrol | 85 (55–135) | 0.080 (0.02–0.24) | 0.60 (0.15–2.0) |
| auto · electric (e-rickshaw, WTW) | 53 (36–83) | ~0 | ~0 |
| bus · CNG | 747 (560–950) | 0.032 (0.006–0.11) | 7.0 (2.0–20.0) |
| bus · diesel | 776 (600–960) | 0.72 (0.01–6.0) | 12.7 (3.0–30) |
| bus · electric (WTW) | 943 (696–1196) veh-level | ~0 | ~0 |
| metro | 11–25 g CO2e/**pkm** incl. grid | ~0 | ~0 |
| walk / cycle | 0 | 0 | 0 |

Two honest numbers reviewers attack first, pre-empted:

- **EV car ≈ petrol car on CO2** (139 vs 153 g/km mid) — correct at the
  coal-heavy CEA grid margin (0.71–0.92 kg/kWh × 0.13–0.24 kWh/km);
  EV still wins on PM2.5/NOx outright and on CO2 per *pax-km* in shared
  e-modes. WTW is the right boundary (`docs/31` §3.1).
- **Bus beats car per pax only at occupancy.** CNG bus ÷20 → ~37 g
  CO2/pkm vs car 153; at ÷15 the e-bus band (20–60 g/pkm, `docs/31`
  §3.1) can lose to a full 2W. Occupancy is the load-bearing
  assumption and stays disclosed.

### 2.3 Occupancy (per-passenger basis)

| mode | divisor | source |
|---|---|---|
| auto | 1.5 pax | `OCCUPANCY`, `docs/31` §3 |
| cab | 1.3 pax | same |
| bus | 50 × 0.40 = **20 pax** | `BUS_CAPACITY·BUS_LOAD_FACTOR`; Delhi DTC load factor ~40% |
| metro | per-pkm native | DMRC + CEA grid EF (`docs/31` §3) |
| car / bike / private | 1.0 | per-vehicle trip |

### 2.4 Idle floor (the jam term)

g/s while `moving=False` — the number that makes jams the worst
emitter (mid; band in code):

| class·fuel | CO2 g/s | PM2.5 g/s | implied fuel/h |
|---|---|---|---|
| car·petrol | 0.40 | 0.0003 | ~0.62 L/h |
| car·diesel | 0.36 | 0.0007 | ~0.48 L/h |
| car·CNG | 0.33 | 0.0002 | ~0.43 kg/h |
| 2W·petrol | 0.12 | 0.0002 | ~0.19 L/h |
| auto·CNG | 0.15 | 0.00025 | ~0.20 kg/h |
| bus·CNG | 0.90 | 0.0004 | ~1.18 kg/h |
| bus·diesel | 1.00 | 0.003 | ~1.34 L/h |
| EV (aux load) | 0.03–0.16 | 0 | ~0.1–0.3 kW |

Basis: ~0.5–0.8 L/h petrol idle burn → ~0.3–0.5 g/s CO2, scaled by
engine class (`emissions.py:247-248`). EV "idle" is HVAC/aux draw at
grid EF — honest, small, non-zero.

### 2.5 Cold-start

`COLD_KM = 4.0`: multipliers at km 0 decaying linearly to 1.0 — petrol
CO2 ×1.30 / PM2.5 ×2.5 / NOx ×1.6; diesel ×1.15/1.6/1.3; CNG
×1.25/2.0/1.5; EV ×1.0. Applied at 0.7 strength to lo and 1.3 to hi —
cold engines *widen* the spread. For corridor attribution: the cold
penalty physically lands on the **first ~4 km of the trip** — which is
usually a residential street, not the corridor (attribution note, §7.3).

---

## 3. Fuel/energy cost model — ₹/trip

**Status: specified, not wired.** No `/v2/plan` field carries ₹ today.
Everything needed is already on the wire or in this file; the model is
two lines of arithmetic per mode and a price table (gap G-4).

### 3.1 Two different ₹ columns — never merge them

| column | who pays | modes | basis |
|---|---|---|---|
| `fuel_rs` — energy cost | the vehicle (driver's wallet or fleet's P&L) | all | CO2 → fuel via carbon factor → × retail price; EV via kWh |
| `fare_rs` — out-of-pocket | the rider | auto, cab, bus, metro, e-rick | notified fare tables / aggregator bands |

A rider comparing options needs `fare_rs` (the auto costs ₹139, the
metro ₹32); a planner reporting corridor fuel burn needs `fuel_rs`.
Conflating them is the classic error — the auto's fare embeds the
driver's fuel plus margin, night surcharge, and the **waiting charge
that is itself a congestion tax** (₹0.75/min when <1 km per 10 min —
the jam literally bills the rider for the jam).

### 3.2 Carbon-factor inversion (why CO2 *is* the fuel meter)

CO2 is stoichiometric in fuel burned — unlike PM/NOx it cannot
cheat the chemistry. So:

```
fuel_units = E_co2_kg / κ_fuel        κ = kg CO2 per unit fuel
₹_fuel    = fuel_units × P_fuel
```

| fuel | κ (kg CO2/unit) | unit | Delhi retail P (Sept–Oct 2026 snapshot) |
|---|---|---|---|
| petrol | 2.31–2.35 | litre | **₹102.1/L** (trackers ₹94.8–102.1 over 2025-26 — use feed) |
| diesel | 2.68–2.69 | litre | **₹95.2/L** (₹87.7–95.2 over 2025-26) |
| CNG | 2.69–2.75 | kg | **₹83.1/kg** (₹77–87; trackers disagree ~₹4 on IGL revision) |
| electricity | — | kWh | ₹4–18/kWh (Delhi domestic ₹0–8 slabs incl. subsidy; public AC ₹4–10, DC fast ~₹15–25) |

Prices move monthly; the ₹ band width is honest — **a live price feed
is gap G-4, the constant is a dated table until then.** Energy density
caveat: κ inversion gives *combusted* fuel — the same chain that made
the CO2, so the ₹ band inherits its honesty (never tighter than the
CO2 band).

Cross-check sanity (mid EFs → implied fuel economy): petrol car
153 g/km → 15.1 km/L; CNG auto 78 g/km → ~35 km/kg; 2W 34 g/km →
~68 km/L; CNG bus 747 g/km → ~3.7 km/kg. All inside the known Delhi
city-cycle ranges — the inversion is self-consistent.

### 3.3 Per-mode ₹/km (mid, snapshot prices, excl. fares)

| mode | fuel/km | ₹/km mid | vs fare basis |
|---|---|---|---|
| walk / cycle | 0 | ₹0 | — |
| bike · petrol | ~15 mL | ~₹1.5 | self-pay fuel |
| auto · CNG | ~28 g | ~₹2.3 fuel | rider pays **fare** ₹30+₹11/km |
| cab · CNG | ~66 g | ~₹5.5 fuel | rider pays ₹40+₹17–20/km (or app quote) |
| car · petrol | ~66 mL | ~₹6.8 | self-pay fuel |
| car · diesel | ~71 mL | ~₹6.8 | self-pay fuel |
| car · EV | ~0.17 kWh | ~₹1.4 (home) – ₹3.1 (DC) | self-pay energy |
| bus · CNG | ~0.27 kg | ~₹22 veh → ~₹1.1/pax | rider pays ticket ₹5–25 |
| metro | ~0.02 kWh/pkm eq. | <₹0.5/pax energy | rider pays slab ₹11–64 |
| e-rickshaw | ~0.065 kWh | ~₹0.5 | informal ~₹10–20/hop |

### 3.4 How a jam changes the ₹ — worked 10 km example

Same OD, free-flow 20 min (30 km/h mean) vs jam 40 min total
(20 min moving + 20 min standstill), computed through the shipped
engine:

| option | scenario | CO2 mid | PM2.5 mid | fuel ₹ mid | out-of-pocket ₹ |
|---|---|---|---|---|---|
| car·petrol | free-flow | 1.62 kg | 0.16 g | ₹71 | ₹71 |
| car·petrol | jam (+20′ idle) | 2.10 kg **(+30%)** | 0.52 g **(+226%)** | ₹93 (+₹21) | ₹93 |
| auto·CNG (per pax) | free-flow | 0.54 kg | 0.32 g | ₹16.4 fuel | ₹123.5 fare |
| auto·CNG (per pax) | jam | 0.66 kg (+22%) | 0.52 g (+62%) | ₹20.1 (+₹3.7) | **~₹138.5** (fare + ₹15 waiting) |
| bike·petrol | free-flow | 0.36 kg | 0.42 g | ₹15.7 | ₹15.7 |
| bike·petrol | jam | 0.50 kg (+40%) | 0.66 g (+57%) | ₹22.1 (+₹6.4) | ₹22.1 |
| bus·CNG (per pax) | free-flow | 0.39 kg | 0.02 g | ~₹12/pax fuel-eq | ₹20 ticket |
| bus·CNG (per pax) | jam | 0.45 kg (+14%) | 0.04 g | ~₹14 | ₹20 |

Three readings the product can quote honestly:

- **Idle share is the jam premium**: car idle CO2 0.48 kg of the
  2.10 kg total — 23% of trip emissions produced **standing still,
  covering zero km**. This is why "idling in jams is the worst
  emitter" is a computable sentence, not a slogan.
- **PM2.5 inflates much faster than CO2 in a jam** (+226% vs +30%) —
  idle combustion is incomplete combustion; the pollutant the city
  chokes on scales worst.
- **Hired modes socialise the jam**: the bus rider's ₹ doesn't move
  (ticket is flat) while the bus's fuel meter does — the ₹20 the
  rider pays and the ~₹98/h the jam costs DTC are different columns,
  both true. The auto rider pays the jam twice: driver's waiting
  charge + breathing the corridor.

### 3.5 What jams do to dose at the same time

The same 20 minutes is also 0.2 m³ more breathed air at corridor
concentration — an auto rider at the measured ~113 µg/m³ in-vehicle
level (Magenta-line corridor, `exposure.py` source [2]) accrues
~23 µg extra dose while the auto emits its idle gram — and winter
corridor air runs higher than that measured run, so ~20–40 µg is the
honest band. **Fuel ₹, emission g, and dose µg are three axes the jam
pushes simultaneously** — §5 formalises the joint score.

---

## 4. Microscopic vs macroscopic — what our data supports

| tier | model | needs | our data | verdict |
|---|---|---|---|---|
| 4 — instantaneous | PEMS/OBD second-by-second, engine-out | OBD-II/CAN feed or instrumented vehicle | none — no vehicle bus access | **out of scope**; cite Jaiprakash–Habib/TRUE uplifts instead |
| 3 — microscopic | VSP (kW/t = v·a(1+ε)+g·v·grade+rolling), MOVES opModes | ~1 Hz speed+grade+vehicle mass; accel from Δv | GNSS fixes at 25 m / ≥5 s cadence (client-side nav); Delhi grade ≈0 (Ridge ±15 m) | **VSP-lite feasible client-side** (opMode bins: idle/creep/cruise/accel); full VSP not honest at 5 s cadence — accel quantisation swamps the a·v term |
| 2 — mesoscopic | speed-band EF per span | per-span speeds | GNSS ticks give realized speeds today; kernel already ingests `[{dist_m,speed_mps,moving,dur_s}]` (`integrate()`, `alive_core.emission_g_km`) | **kernel shipped, feed missing** — donation summary carries totals only (gap G-3) |
| 1 — macroscopic | avg-speed EF + idle split | route, mode, eta, freeflow | **`trip_emissions` — shipped** | the honest level of plan data |
| 0 — flat | static g/km | distance only | `EMIT_GKM` fallback table | labelled fallback only |

### 4.1 Why the two-span macroscopic model is defensible at plan time

`trip_emissions` reduces a plan to: move the whole distance at
free-flow mean speed, then charge `eta − freeflow` as idle. What it
gets right: distance×EF at a representative speed, plus the full
congestion term as g/s. What it blurs: (a) the *distribution* of
moving speed — 40 min of mixed 15/45 km/h ≠ 30 min at 30 km/h, since
f(v) is convex in v (Jensen gap ~5–15% on CO2, more on PM); (b) jams
with flow — stop-go at 8 km/h counts as "moving at mean speed" rather
than idle+enrichment. Both blur toward the *same direction*
(understating the jam), which is the honest direction to fail — we
under-report congestion harm rather than invent it.

**Critical caveat — `freeflow_s` provenance.** Under AWS
CalculateRoutes, `freeflow_s` is a real free-flow typical → `idle_s`
is meaningful. Under the OSRM fallback (`eta_model: osrm-freeflow`),
`freeflow_s = eta` → **`idle_s ≡ 0` and every trip looks free-flowing**.
The option carries `eta_model`/`duration_basis` for exactly this
reason: consumers of the emissions block MUST read it before quoting
an idle share (corridor console included). Delhi's true congestion is
large — TomTom 2025: 60.2% congestion level, 24:28 per 10 km
(`docs/23` row 43) — so an `idle_s = 0` on a peak-hour plan is
evidence of the fallback path, not of a free city.

### 4.2 The upgrade path that needs no new sensors

The client already knows realized speed tick-by-tick during nav
(25 m/≥5 s fixes, `docs/30` §0). Shipping spans — either the tick
series or an aggregated `[speed_bin × km]` histogram — through the
existing `/v2/trip` summary upgrades every donated traversal from
tier-1 to tier-2 without touching the kernel. The span list is also
exactly what a corridor emissions field wants for *idle attribution*
(which cells ate the standstill — §7.3).

---

## 5. Exposure–emission coupling — the joint score

### 5.1 The physics is shared, so the axes correlate

A congested corridor is a **co-generated harm**: the rider stays
longer inside a high-microenv-ratio microenvironment breathing
corridor air (dose ∝ time × C_road × ME), *and* the vehicle spends
the same minutes at idle+creep emitting at its worst rates
(emissions ∝ idle_s × I + km × f(v_low) × EF). The dose engine and
the emissions engine are two integrals over **the same stay-time on
the same corridor**. Delhi arithmetic (`docs/31` §2–3): the
objectives align in the overwhelming majority of decisions; they
diverge only in a narrow corridor — same-mode detours and
cabin-vs-coach edge cases — where the honest resolution is a signed
trade line, not a hidden scalar.

### 5.2 The shipped joint rule (ε-constraint, `rank_options`, doc 06 §4)

```
rank key   = dose_lo (engine rows: engine_dose_ug × lo/mid mapped)
tied       = {o : dose_lo(o) ≤ 1.10 · min dose_lo}
winner     = argmin CO2_mid within tied          → recommended
tags       = 'lightest on both' | 'lightest for you' + 'lightest for Delhi'
time guard = winner.eta > 1.6 × fastest → append "+N min" to reason
```

Dose leads because we measure it best (field MAE is published);
emissions break near-ties; the split tag tells the user when the two
axes genuinely disagree. Fuel ₹ (§3) is a *third, aligned* axis — a
jam raises all three — suitable for display and the gov ledger rather
than a ranking term (01 memo decides whether it enters the cost
function).

### 5.3 Corridor-hour joint harm (what the dual budget reads)

Per skeleton D5 the corridor budget is dual: dose + emissions. The
measurable quantity this memo supplies:

```
H(c,h) = Σ_{t ∈ traversals(c,h)} [ dose_t(µg) + ω_c·CO2_t(g) + ω_p·PM25_t(g) ]
```

with `ω` the welfare weights the 01 memo owns. This memo's obligation:
every component arrives **banded** — the sum of mids is the headline,
the union of lo/hi the honest width; a corridor whose band spans
"fine" to "worst in Delhi" reports exactly that.

---

## 6. Delhi calibration — what makes this fleet unlike the textbook

| factor | Delhi reality | where it lands in the model |
|---|---|---|
| **CNG mandate fleet** | autos (2002–03 SC mandate, ~1.14 lakh registered, capped 1 lakh), taxis predominantly CNG, **all DTC/cluster buses CNG or electric**; measured on-road fuel mix petrol 45/CNG 32/diesel 23% (TRUE) | `_DEFAULT_FUEL` auto→cng, cab→cng, bus→cng — the *default* is CNG, not an option; TRUE shows high-use CNG 1.5–14× over limits → wide hi tails, never "CNG = clean" copy |
| **Two-wheeler dominance** | ~68% of ~83 lakh active fleet is 2W (`docs/32`); all petrol, no CNG/EV meaningful share yet | `bike`/`scooter` are first-class EF rows; 2W lane-splitting means their *corridor* exposure differs from their *route* exposure — mode-level honesty only |
| **EV share** | 3.17 lakh EVs registered; e-rickshaws ~2–4 lakh (cap 2.5 lakh proposed); new-sale share peaked 19.5% Dec-2023 then collapsed post-incentive | `fuel=electric` path in every class incl. e-rickshaw (auto-class, 0.05–0.09 kWh/km); WTW grid EF keeps them honest vs the coal margin |
| **BS mix** | ~89% BS-IV+ measured on-road; pre-BS-IV ~11% tail produces a majority-share of emissions | `_FLEET_PRIOR` per class×fuel; `hi` band covers the super-emitter tail (IIT-B Kamshet: ~21% of fleet) |
| **PUC compliance** | 31.6% of active vehicles on expired PUC (Sept-2024); PUC tests idle CO/HC only — cannot yield PM/NOx | PUC is a *calibration input*, not a lookup (docs/29 §1); health factor clamp 0.3–3× |
| **Enforcement regime** | >10y diesel / >15y petrol legally off-road (ANPR fuel-denial); GRAP-III bans BS-III petrol + BS-IV diesel LMVs | diesel drops pre-BS-IV from the prior; **GRAP regime shift of the fleet mix is a gap (G-6)** — a Stage-III day should re-mix `_FLEET_PRIOR` |
| **Seasonal** | parali (Oct–Nov NW stubble), winter inversion (Dec–Jan, VC collapse), summer AC load, monsoon dust suppression | smoke_modifier multiplies **dose** live via `fires.FIRES` (shipped; basis shared `/aqi`↔plan); **EF-side seasonal terms are gaps**: winter stretches catalyst light-off beyond COLD_KM=4 (G-7), summer AC adds ~10–20% car fuel (G-8), monsoon suppresses resuspension (G-9) |

The subtle one: **parali/winter modify the exposure side, not the
emission side.** A stubble day does not change what a tailpipe emits —
it changes what breathing that corridor costs (and changes *whose*
share of the ambient the corridor owns: transport ~11–12% typical,
dwarfed on peak-fire days, DSS via `docs/32` §4). The seasonal
modifier belongs on `C(x,t)` — where the code already puts it — while
EF seasonal terms (cold-start stretch, AC load) are honest gaps
because no shipped constant seasons them.

---

## 7. Corridor-hour emissions — construction for the gov field

### 7.1 Definition

```
E_obs(c,h,p) = Σ_{t ∈ traversals(c,h)} e_t(p).mid      band: Σlo … Σhi
Ê(c,h,p)    = E_obs / p̂_min(c,h)                       scaled — only when
              p̂_min ≥ the penetration gate (02 memo)    lower bound holds
```

- `e_t` per traversal is `emissions.integrate` on the realized spans
  (tier-2 once span feed lands; tier-1 estimate from donated
  distance/duration/mode until then).
- **Observed and scaled are two numbers, both published.** The
  observed sum is *measured-modeled* (real traversals × EF bands); the
  scaled estimate adds penetration inference — a labeled guess, per
  skeleton D8. Merging them silently is the exact failure the honesty
  ledger exists to prevent.
- **k-gates (06 memo owns):** nothing publishes below the tiered
  threshold — cell display k≥3/72 h today; gov corridor-day rollups
  k≥10; anything hourly/public k≥20.

### 7.2 What the store already holds

`community._fold` accumulates per cell: `trips`, `km_sum`, `dose_sum`,
`co2_kg_sum`, `co2_trips`, `modes` mix, device sets (`community.py:
200-216`); per hour-bucket: trips, devices, duration_s, dose, km,
mode counts (`community.py:173-186`); TripAggregates day counters add
`co2_moving_g/idle_g/cold_g` splits when clients donate them
(`v2/trip.py:95-105`). So **CO2 per cell-hour exists today**; PM2.5/
NOx per cell and per-cell idle attribution do not — G-1/G-2.

### 7.3 Attribution honesty

- **Cold-start lands where the trip starts** — usually residential,
  not the corridor. Corridor sums that include cold_extra should
  attribute it to the cells holding the first ~4 km; a corridor-hour
  that "emits" cold starts is being debited for trips born inside it,
  which is correct but should be disclosed in the console read.
- **Mode-mix bias**: our traversals reflect our users (app-using,
  motorized-biased, likely car/2W-rich vs Delhi's true walk/bus-heavy
  share). Corridor totals must state they scale *our* fleet sample,
  and the penetration denominator (02) is what separates "our users'
  corridor emissions" from "the corridor's".
- **Penetration is the honest limit**: at 14 contributors / 22
  all-time donated trips (`docs/plan/NUMBERS.md`), corridor emissions
  are illustrative of method, not measurements of Delhi. Say so in
  every surface until the P1 adoption gate holds.

---

## 8. What `/v2/plan` computes today vs what's missing

**Per option, on the wire now** (`plan.py::_option`, `_emission_band`):

| field | content |
|---|---|
| `emissions.co2_kg / pm25_g / nox_g` | {lo,mid,hi} per option, ÷occupancy for shared modes |
| `emissions.breakdown` | `moving_mid`, `idle_mid`, `cold_extra_mid` grams — the jam/cold attribution is *already served* |
| `emissions.occupancy / bs_class / bs_options / fuel / class / confidence / label` | the assumption set, echoed |
| `emissions.non_exhaust.pm10_g` | separate band, never in headline |
| `emissions.puc_calibrated` | true when the PUC card narrowed the band |
| `eta_s / freeflow_s / eta_model / duration_basis` | the congestion signal *and* its provenance (`osrm-freeflow` ⇒ idle≈0 by construction) |
| `dose.{lo,mid,hi,avg_conc_ugm3,confidence,coverage}` | the exposure twin of the same stay-time |
| `segments[]` | ~12 arc-spans × {pm25, CPCB band} — the corridor read the option traverses |
| `smoke_modifier` | response-level parali multiplier, shared basis with `/aqi` |
| `route_id` | → `/v2/reroute` mid-trip re-plan |

**Not on the wire (the ₹ and tier-2 gaps):**

| missing | consequence | fix size |
|---|---|---|
| `cost.fuel_rs / fare_rs` | ₹ axis absent from compare sheet though computable today | small — pure post-processing of existing fields + fare/price tables (§3) |
| span-level speeds (tier-2) | PM Jensen gap, no per-cell idle attribution | medium — client ships span histogram in `/v2/trip` summary |
| kWh for EV modes | EV cost not derivable client-side | small — surface `EV_KWH_PER_KM` in the emissions block |
| corridor flow/penetration | corridor-hour is observed-only, unscalable | owned by 02 memo |
| NOx/PM per-cell store | corridor PM field absent | small — add `pm25_g_sum`, `nox_g_sum` beside `co2_kg_sum` |
| fuel/toll/parking | ₹_fuel understates car cost (tolls, parking) | small — static corridor toll table |
| live price feed | ₹ snapshot goes stale | small — monthly table refresh job |

---

## 9. The emissions scoring formula (canonical)

**Trip emissions, per pollutant p ∈ {CO2, PM2.5, NOx}** — as shipped
(`emissions.integrate`), spans `[{dist_m, speed_mps, moving, dur_s}]`:

```
E_p(trip) = [ Σ_{moving s} EF_p(c,f,BS) · f_p(v_s) · km_s · cold_p(d_s)
            + Σ_{stopped s} I_p(c,f) · Δt_s ]  ÷  occ(c)

band width:   km_lo = lo·f/sw,  km_hi = hi·f/sw,   sw = 1 + 0.2·|f − 1|
cold:         ×(1 + (C_p−1)·(1 − d̄_s/4)) over first 4 km only
preview:      spans = [{km_trip @ dist/freeflow_s}] + [{idle: eta−freeflow}]
```

**Option score (the shipped joint rule):**

```
key(o)  = dose_lo(o)                      (engine rows: engine_dose_ug·lo/mid)
win     = argmin_{o : key ≤ 1.10·min key} CO2_mid(o)
report  = {co2_kg, pm25_g, nox_g}{lo,mid,hi} + non_exhaust.pm10_g
        + fuel_rs{lo,mid,hi}              (once §3 wires)
guard   = eta(win) ≤ 1.6·min eta else disclose "+N min"
```

**Corridor-hour, per corridor c × hour h:**

```
Ē_p(c,h) = Σ_{t∈T(c,h)} e_{t,p}.mid     band [Σlo, Σhi]   — observed
Ê_p(c,h) = Ē_p / p̂_min(c,h)   only if p̂_min ≥ gate         — scaled
dual budget read: H(c,h) = Σ_t [ dose_t + ω_c·CO2_t + ω_p·PM25_t ]
```

**Fuel ₹:**

```
₹_fuel(pax)  = E_co2/κ_fuel · P_fuel ÷ occ      (+ toll/parking statics)
₹_rider(hired) = fare_table(mode, km, wait_min, night?)   — fare ≠ fuel
```

---

## 10. Data gaps table

| # | gap | blocks | nearest source / fix | size |
|---|---|---|---|---|
| G-1 | PM2.5/NOx sums per cell (CO2 only today, `community.py:200-216`) | corridor PM field | add `pm25_g_sum`, `nox_g_sum` at `_fold`; donate `pm25_g_mid` already bounded in `trip.py` | small |
| G-2 | per-cell idle attribution (moving/idle/cold donated but day-level only) | corridor jam-emission map | fold `CO2_SPLIT_KEYS` into cell buckets like `co2_kg_sum` | small |
| G-3 | realized speed spans to server | tier-2 emissions; idle localisation | span histogram in `/v2/trip` summary (bounds exist); kernel already ingests spans | medium |
| G-4 | live fuel/energy price feed | ₹ columns | monthly statics job; trackers disagree ~₹4/kg CNG — cite band | small |
| G-5 | fare engine for hired modes | `fare_rs` | notified tables (auto ₹30+₹11/km+₹0.75/min wait+25% night; taxi ₹40+₹17/20; metro slabs ₹11–64 Aug-2025; DTC ₹5–25; e-rick informal) — aggregator quotes stay "est." | small-medium |
| G-6 | GRAP regime fleet-mix switch | EF priors on restriction days | regime flag → re-mix `_FLEET_PRIOR` (drop banned BS×fuel) | small |
| G-7 | winter cold-start stretch | seasonal EF accuracy | COLD_KM as function of ambient temp (Open-Meteo already ingested) | small |
| G-8 | AC/aux load seasonal term | car fuel ₹ summer bias ~10–20% | temperature-conditioned fuel factor | small |
| G-9 | monsoon resuspension suppression | non-exhaust seasonal band | seasonal flag on `_NON_EXHAUST_PM10_GVKM` | small |
| G-10 | corridor penetration + flow | scaling Ē→Ê | **02 memo owns** — GTFS-RT key owed, probe traversals, published counts | medium (sibling) |
| G-11 | corridor toll/parking table | car ₹_fuel completeness | static per-corridor toll list | small |
| G-12 | acceleration/grade terms (VSP-lite) | stop-go enrichment beyond idle+speed | client-side opMode bins from GNSS ticks; Delhi grade ≈0 simplifies | medium |
| G-13 | occupancy realization | shared-mode per-pax truth | fleet-average disclosed today; AVL/GTFS-RT crowding feed if it ever opens | large |
| G-14 | secondary nitrate from NOx | full PM accounting | out of scope honestly — note "tailpipe primary only" on every PM surface | note only |

---

### Provenance footer

Primary sources for every EF number: `server/emissions.py` header
(lines 19–47) — ARAI/ICAP 2007, Guttikunda-2015, SIM/urbanemissions,
Jaiprakash–Habib, ICCT, ICCT-TRUE; fleet priors `docs/32`; inference
argument `docs/29`; WTW boundary `docs/31` §3; occupancy `docs/31` §3;
speed/live model `docs/30` §0; non-exhaust `docs/26` §3.2; congestion
context TomTom 2025 via `docs/23` row 43; fares: Delhi Transport Dept
notification Jan-2023 (auto ₹30+₹11/km, taxi ₹40+₹17/20), DMRC fare
revision Aug-2025 (₹11–64), DTC slabs (₹5–25). Fuel prices: Delhi
retail trackers Sept–Oct 2026 (petrol ₹102.1/L, diesel ₹95.2/L, CNG
₹83.1/kg ±₹4 tracker disagreement) — **dated snapshot, recompute at
serve time (G-4)**. Where this memo and `server/emissions.py`
disagree, the code is right — file it.
