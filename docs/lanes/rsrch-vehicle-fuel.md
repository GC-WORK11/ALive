# rsrch-vehicle-fuel — "Petrol + Health suggests CNG without asking"

Research-only lane. Complaint: in Petrol + Health the app hands out numbers
like "0.3 kg CNG" without ever asking what the vehicle runs on — it should
ASK class + fuel and estimate honestly, in real time. **No code changed.**
Scope: `server/webapp/whereto.js`, `server/v2/plan.py`,
`server/v2/modes_engine.py`, `server/emissions.py`,
`server/v2/providers.py` (main + `int/routes-airmap` ≡ lane/providers),
`docs/29,31,32`, `docs/gov/local/03-emissions-fuel.md`, `docs/lanes/MASTER-PLAN-oct11.md`.

## TL;DR

1. **The mechanism is `_DEFAULT_FUEL`, not malice.** The wizard asks fuel only
   for `car`/`bike` (`needsFuel`, whereto.js:266). For `auto` (and `bus`,
   `cab` via API) the server silently assigns CNG (`emissions.py:87-88`) —
   right for Delhi (TRUE: all measured 3Ws were CNG) but *unstated*: the card
   then reads "0.3 kg CNG" under a mode literally titled "Petrol + Health",
   and `why` says "least CNG and the cleanest air". It *looks* like a CNG
   advertisement; it's an unasked default rendered without its assumption.
2. **The estimates themselves are honest — and labelled, just not shown.**
   `emissions.label` already says *"estimated for a CNG auto-rickshaw (Delhi
   fleet mix — BS-II–BS-VI), per passenger (÷1.5)"* (verified live). The web
   card drops that line; the mobile CompareSheet shows it
   (`CompareSheet.tsx:317-339`). Surfacing the label on the web card is the
   cheapest honesty fix in this report.
3. **"Real time" fuel exists but is only half-wired.** `fuel_l` is inverted
   from the option's own CO2 (carbon factors, `modes_engine.py:69-82`) — real
   model, per route, but computed on the *router's* ETA. Live TomTom delay
   only adds an idle top-up (IJRET-2013 rates). Lane P's TomTom
   consumption seam (`consumption=("combustion",l100)|("electric",kwh)` →
   provider-modelled `fuel_l`/`battery_kwh`) is built, tested-shaped, and
   **never called**: `modes_engine._call` invokes `traffic_for_route(coords)`
   with no `mode`, `depart_at`, or `consumption` (modes_engine.py:249-257).
4. **Two subtleties before wiring:** (a) lane P sends a *single* speed-consumption
   pair `"50,{per}"` → TomTom's curve is flat, so `fuel_l ≈ per × dist/100`
   — the honest version needs a 2–3-point curve (stop-go costs more); (b)
   CNG is sold/measured by the kg — sending kg/100km as "litres" to a
   volume model is a unit lie; keep CNG on the carbon-inversion path.
5. **Litres, never ₹.** Product law: "show litres saved, NEVER money"
   (MASTER-PLAN-oct11 §4; whereto-oct11 "No money anywhere"). The ₹/trip
   model is *specified but not wired* (`gov/local/03 §3`, gap G-4 — no live
   price feed). Keep L/kg/kWh; ₹ is a separate approved-but-unbuilt lane.

---

## 1. Current-estimate audit — what is real vs constant

### 1.1 The ask flow today (whereto.js)

```
modes (Health/Petrol/Time) → vehicle wizard → /v2/plan {mode, vehicle, vehicle_profile}
```

- Wizard steps = `cls` → `fuel` **only** (`wizSteps`, whereto.js:1399-1405;
  comment: *"two taps at most: the ride, then its fuel. No year / PUC
  pages — without them the engine uses the Delhi fleet average, said
  plainly"*). `year`/`puc` render code survives but is unreachable — the
  "no vehicle-year or PUC questions" rule is already the shipped posture.
- Classes shown: **car, auto, bike | bus, metro | cycle, walk**
  (`CLASS_GROUPS`, whereto.js:269-273). `cab`/`e_rickshaw` are API-only
  (aliases exist server-side; never produced as options — every motorized
  row is one of car/car_open/bike/auto/bus on the *same* driving geometry,
  plan.py:1045-1061).
- `needsFuel = car|bike` (whereto.js:266). `fuelsFor`: bike → petrol/ev;
  car → petrol/diesel/cng/ev (whereto.js:268). **auto is never asked** →
  server default. Skip → `tripVeh=null` → "a typical Delhi ride" →
  `vehicle=car` + fleet prior.
- Body sent: `vehicle` (string) + `vehicle_profile {class, fuel?}`
  (`planVehicleProfile`, whereto.js:279-286). No mileage/consumption field
  exists anywhere on the wire.

### 1.2 What each shown number actually is

| Shown value | Source | Real or constant? |
|---|---|---|
| `fuel_l` / `fuel_kg` per option | `co2_kg.mid ÷ κ` — κ petrol 2.31, diesel 2.68 kgCO₂/L, CNG 2.69 kgCO₂/kg (modes_engine.py:79-82; UNECE R101 / IPCC 2006) | **Real model, inverted**: stoichiometrically exact *given* the CO2 — inherits the whole emissions band/model, and the router's (not live) traffic picture |
| `emissions.co2_kg` band | `emissions.integrate`: EF g/km band × COPERT speed curve + idle g/s + cold-start, per-pax for shared | **Real model** — ARAI/ICAP-2007 + Guttikunda ±SD + SIM PM2.5 + TRUE/Jaiprakash uplift anchors (emissions.py:19-47) |
| …on a skipped/undeclared vehicle | class-default fuel + `year_bucket:not_sure` → `_FLEET_PRIOR` BS mix | **Fleet prior** — honestly a prior, labelled in `emissions.label`, invisible in the web card |
| `live_eta_s`, `traffic_delay_s`, `jams` | TomTom via `traffic_for_route` (≤5 geometries, 6 s budget) | **Live** — provider read, `source` echoed |
| `fuel_idle_l` top-up | live delay × IJRET-2013 measured idle rates (car-petrol 0.652 L/h, 2W 0.200, auto-CNG 0.522 kg/h) | **Real + published** — only the *unpriced* live delay gets it (modes_engine.py:84-103, 177-198) |
| `fuel_saved_l` | pick fuel − fastest *same-fuel* row's fuel, both engine numbers | **Real difference, point-not-band** (see §5) |
| `fuel_basis` (response) | static `FUEL_SOURCES` provenance string | **Constant label** — honest, but never says which estimator served a row |
| `vehicle` echo | `vehicle` + `vehicle_profile` + `vehicle_requested` echoed | Honest |

### 1.3 Where "CNG without asking" is produced, precisely

- `auto` class picked → `vehicle_profile={class:'auto'}` (no fuel) →
  `_option_vehicle` → `emissions._resolve` → `_DEFAULT_FUEL['auto']='cng'`
  (emissions.py:87) → option `emissions.fuel='cng'` → `fuel_kg` per pax →
  card shows "0.3 kg CNG"; in a pool of autos the Petrol+Health pick's
  `why` = "least CNG and the cleanest air" (modes_engine.py:484-486).
- `cab` declared via API → family `car`, `_DEFAULT_FUEL['cab']='cng'` →
  car routes carry CNG cab emissions unasked.
- `skip` → `vehicle=car` petrol default → card says "0.6 L petrol" the user
  never confirmed. Pill reads "a typical Delhi ride" while the fuel chip
  asserts "petrol" — an assumption wearing a fact's clothes.
- "Other ways" rows always model their own class's default fuel — a CNG
  auto row appears as an *alternative suggestion* next to your petrol car.
- Verified live (local python): `trip_emissions('auto',8km)` →
  `label:'estimated for a CNG auto-rickshaw (Delhi fleet mix — BS-II–BS-VI),
  per passenger (÷1.5)'` — the assumption exists in the payload, unshown.

## 2. The honest picker — fields, defaults, editable mileage

### 2.1 What to ask (≤2 taps, no year, no PUC)

| Field | Who gets it | Values | Why |
|---|---|---|---|
| **class** | everyone | car · auto · bike | bus · metro · cycle · walk | unchanged |
| **fuel** | car, bike, **auto (new)**, cab if ever added | car: petrol/diesel/CNG/EV · bike: petrol/EV · auto: **CNG/petrol/EV** (`_VALID_FUELS`, emissions.py:89-96 — CNG first, caption "most Delhi autos") | the complaint's fix; auto CNG stays a *choice*, not an assumption |
| **my mileage** (optional, own vehicles) | car, bike; auto only if framing is "your auto" | km/L (petrol·diesel), km/kg (CNG), kWh/100km (EV); one inline field under the fuel cards, prefilled with the §2.2 default | feeds TomTom `fuel_l100`/`kwh_100km` + the fallback estimate; editable, never required |
| **bus/metro/cycle/walk** | — | no fuel question | rider doesn't own the fleet's fuel choice; keep defaults + label (TRUE: all Delhi 3Ws/buses CNG; metro electric) |

- **Persistence:** today's `K_VEH` saved-ride pattern already does
  profile-vs-trip right (stored once, one-tap per trip, editable via the
  routes-view pill). Mileage rides the same blob
  `{cls, fuel, mileage}` → `vehicle_profile.mileage` on the wire.
- **Unasked = labelled, everywhere:** when a row's fuel came from
  `_DEFAULT_FUEL`, the card/provenance must say so ("typical Delhi CNG
  auto" — the `emissions.label` string already exists; web just has to
  print it like mobile does). Skipped vehicle → chip "petrol car
  (assumed)" until tapped, not bare "petrol".
- **Mode naming:** "Petrol + Health" crowning a CNG/EV pick is the
  complaint's literal surface. The mode should render per declared fuel —
  "Fuel + Health" (or "CNG + Health" / "EV + Health") — the server already
  adapts `why`/`_fuel_word`; only the static title/subtitle
  (whereto.js:254) doesn't.

### 2.2 Consumption defaults — engine-implied, self-consistent

Derived by running `emissions.emission_factors` at the Delhi fleet prior
(`year:not_sure`) and inverting through κ — the *same* model that produces
the displayed CO2, so the defaults can never disagree with the estimate
(the gov memo's own cross-check, `gov/local/03 §3.2`). Vehicle-level
(before occupancy ÷).

| class·fuel | engine co2 mid (g/km) | implied economy | → TomTom param |
|---|---|---|---|
| car · petrol | 153 | 15.1 km/L = **6.6 L/100** | `fuel_l100=6.6` |
| car · diesel | 191 | 14.1 km/L = **7.1 L/100** | `fuel_l100=7.1` |
| car · CNG | 158 | **17.0 km/kg** = 5.9 kg/100 | (kg — see §3.2) |
| car · EV | 139 WTW | **17 kWh/100** (band 13–24, `EV_KWH_PER_KM`) | `kwh_100km=17` |
| cab · CNG | 182 (taxi uplift) | **14.8 km/kg** | kg path |
| bike · petrol | 34 | 68.8 km/L = **1.5 L/100** | `fuel_l100=1.5` — *optimistic end: surveyed Delhi 2W city figures run ~40–60 km/L; the mid sits at fleet-table efficiency, another reason the field must be editable* |
| bike · EV | 31 WTW | **3.8 kWh/100** (2.5–5.5) | `kwh_100km=3.8` |
| auto · CNG | 78 | **34.6 km/kg** | kg path |
| auto · petrol | 85 | 27.2 km/L = **3.7 L/100** | `fuel_l100=3.7` |
| auto · EV | 53 WTW | **6.5 kWh/100** (5–9) | `kwh_100km=6.5` |
| bus · CNG | 747 | **3.6 km/kg** | fleet's business — no ask |
| bus · diesel | 776 | 3.45 km/L = **29 L/100** | " |
| bus · EV | 943 WTW | **115 kWh/100** (98–130) | " |

All inside published Indian city-cycle ranges (gov memo §3.2 makes the
same sanity argument). Mileage inputs map 1:1 to wire params:
`fuel_l100 = 100/kmL`, `kwh_100km` direct, CNG `kg/100 = 100/kmkg`.

## 3. Consumption-model wiring — TomTom + honest fallbacks

### 3.1 What lane P already built (int/routes-airmap ≡ .wt/lane-providers)

- `POST /v2/p/route_traffic {coords, mode?, depart_at?, fuel_l100?|kwh_100km?}`
  → TomTom `vehicleEngineType=combustion|electric` +
  `constantSpeedConsumption{InLiters,InkWh}PerHundredkm="50,{per}"` →
  summary `fuelConsumptionInLiters→fuel_l` / `batteryConsumptionInkWh→battery_kwh`
  (providers.py:1776-1819, 2215-2228). Python seam:
  `traffic_for_route(coords, mode, depart_at, consumption)` (:2158-2192).
- Validated `0 < per < 200`; consumption is in the 60 s cache key (good —
  different mileage = different entry). On `http 400` the stripped retry
  drops consumption (and departAt) silently — fuel fields just vanish;
  acceptable but worth a `consumption_dropped` flag.
- **Not on main yet**: `main`'s providers.py (1970 lines) has no
  consumption path — the 2367-line version lives on `lane/providers` /
  `int/routes-airmap`. Wiring below assumes that branch's shape.

### 3.2 The honest wiring design

```
rider profile {cls, fuel, mileage?}
  → per100: user mileage (100/kmL, 100/kmkg, kWh/100) else §2.2 default
  → modes_engine.live_traffic: per geometry-group call
       traffic_for_route(coords, mode=TT_MODE(cls), depart_at=body.depart_at,
                         consumption=(engine, per100))
  → res.fuel_l / res.battery_kwh stamps RIDER-family rows on that geometry
     fuel_basis:'tomtom' · fuel_input_l100 echoes what was sent
```

- **Which rows get provider fuel:** rows sharing the rider's family in
  each geometry group. Motorized rows literally share one OSRM geometry —
  one consumption value per call means the rider's value wins the group;
  non-rider rows on the same line keep the engine estimate with a
  distinct `fuel_source` so the two estimators never blur.
- **travelMode is also unwired today** — `modes_engine._call` sends coords
  only, so every row reads as TomTom `car`. Pass per-class modes
  (`journey.js:483` already maps bike→motorcycle, bus→bus, cab→taxi).
- **CNG stays on the carbon-inversion path.** TomTom's combustion model is
  litres-of-liquid; kg-CNG-as-"litres" is a unit lie (energy ≠ volume ≠
  CO2). Either keep `fuel_kg` from `co2÷2.69` (recommended — already
  honest, same κ basis) or, if route-shape sensitivity is wanted for CNG
  too, send petrol-equivalent litres (kg × 2.69/2.31 ≈ ×1.165 on a CO2
  basis) and invert the returned `fuel_l` back to kg — flag the extra
  assumption in `fuel_basis`. Don't do it silently.
- **The single-pair curve is flat.** TomTom consumes a *speed→consumption
  curve* (1–25 pairs; single pair = constant). With `"50,{per}"` the
  returned `fuel_l ≈ per × dist/100` — better provenance but barely
  better physics. To make jams cost real fuel, send 2–3 pairs from the
  engine's own speed structure, e.g. scale the COPERT-normalised curve:
  `{(15, per·f15), (35, per), (70, per·f70)}`. Optional:
  `auxiliaryPowerInLitersPerHour` for HVAC/idling-in-jam truth
  (lane P param list would need extending). Verify live what TomTom does
  with traffic speeds — the SDK says the model uses "route characteristics
  and driving conditions".
- **EV is the clean win:** `kwh_100km` → `battery_kwh`, no unit games;
  tailpipe PM/NOx already zero in our bands; CO2 stays the CEA-grid WTW
  band (0.71–0.92 kg/kWh — say "incl. grid electricity" as the label
  already does).
- **Fallback ladder (all labelled):** TomTom `fuel_l`/`battery_kwh`
  (`fuel_source:'tomtom'`, input echoed) → else engine estimate incl.
  user mileage as a scalar on `fuel_l` (`dist × per/100`, basis
  `'your mileage × distance'`) → else CO2-inversion (`'engine CO2 ÷ κ'`,
  today's `FUEL_SOURCES`) → else `fuel_l:null` + note. Never a number
  without its basis; `fuel_basis` becomes per-row, not one static string.
- **Budget:** consumption rides inside the existing ≤5 `route_traffic`
  calls per plan — zero extra provider calls. Journey can pass the same
  `fuel_l100` on its `route_traffic` poll (journey.js:890) for honest
  remaining-route fuel.

## 4. Emission-factor reality — India sources, per fuel

What the shipped bands already encode (all cited in `emissions.py:19-47`,
`docs/29`, `docs/32`, `gov/local/03 §2.2` — verified numbers, mids at
fleet prior, 30 km/h ref):

| class·fuel | CO2 mid | PM2.5 mid | NOx mid | honest read |
|---|---|---|---|---|
| car · petrol | 153 g/km | 0.012 | 0.37 | baseline |
| car · diesel | 191 | 0.093 | 0.89 | worst PM/NOx of the four; CO2 +25% |
| car · CNG | 158 | 0.016 | 0.20 | PM ≈ petrol, NOx best of ICE; CO2 NOT a win (≈petrol) — plus TRUE's "CNG is not clean" hi-tail (1.5–14× over type-approval on high-use vehicles) |
| car · EV | 139 WTW | ~0 | ~0 | zero tailpipe; CO2 ≈ petrol at Delhi's grid margin — honest claim is PM/NOx, not carbon |

- **Base table:** ARAI/ICAP-2007 chassis-dyno in-use fleet (MIDC cycle) —
  the canonical Indian measured set.
- **Fleet spread:** Guttikunda-2015 Table 5 ±SD; SIM-air/urbanemissions
  Delhi PM2.5 set.
- **Real-world uplift:** Jaiprakash–Habib on-road (post-2010 diesels CO2
  556±261 g/km); ICCT BS-IV analysis; **ICCT-TRUE Delhi 2024 remote
  sensing — 111,712 measurements**: fuel mix petrol 45 / CNG 32 / diesel
  23; ~89% BS-IV+; BS-VI taxis 2.4× private NOx; all measured 3Ws &
  buses CNG.
- **Regulatory anchors:** CPCB/MoRTH Bharat-Stage mass-emission limits +
  Delhi registration-year cutovers (`docs/29 §2`); CMVR Rule 115 PUC
  idle limits (`emissions.py:423-432`).
- **Fuel chemistry:** UNECE R101/EU 2017/1151 carbon balance; IPCC 2006
  Vol.2 Ch.3 (petrol 2.30–2.31, diesel 2.68, CNG 2.69 kg CO₂/unit).
- **Speed/idle/cold:** COPERT U-curve (EEA); idle IJRET-2013 measured
  Indian vehicles; cold-start multipliers per fuel.
- **EV boundary:** CEA CO₂ Baseline Database grid EF band 0.71–0.92
  kg/kWh; `EV_KWH_PER_KM` per class (2W 0.025–0.055, car 0.13–0.24,
  auto 0.05–0.09, bus 0.98–1.30 — ITDP rollout guide).
- **Non-exhaust:** kept separate forever (Sahu et al. STOTEN 2020 — ~86%
  of Delhi traffic PM10 is resuspension/brake/tyre; EVs keep this part).
- **Retail prices (if the ₹ lane ever ships):** verified today —
  Delhi petrol ₹102.12/L, diesel ₹95.20/L, CNG ₹83.09–86.98/kg
  (fuelprice.co.in, IndiaToday, mypetrolprice — matches `gov/local/03
  §3.2` snapshot).

## 5. What "petrol savings" should honestly say

Today (`modes_engine._fuel_saved`): pick fuel − **fastest same-fuel row**
fuel, both engine numbers, ≥0.01 threshold, `fuel_saved_vs` = that route —
rendered "saves 0.2 L" / "saves 0.3 kg". The comparison target is right
(the road a time-only app would hand out) and the same-fuel guard is
right. Keep it, tighten it:

1. **Same estimator on both sides.** When rider rows take TomTom fuel,
   compare provider-vs-provider (or stay engine-vs-engine for the saved
   number and disclose). Mixing a flat-curve TomTom litre against a
   COPERT-curve engine litre is not like-for-like.
2. **It's a mid-minus-mid point on two overlapping bands.** Either keep
   the ≥0.01 L gate (already does — noise never shows) or round the
   claim to "≈0.2 L less"; never print more precision than the band
   supports.
3. **Never money** (product law; the ₹ model in `gov/local/03 §3` is
   specified-not-wired — don't smuggle it).
4. **Fuel-named, not petrol-named:** "saves 0.3 kg" is honest CNG; the
   dishonest part today is the *frame* ("Petrol + Health" mode title +
   "least petrol" subtitle) around it — rename per declared fuel (§2.1).
5. When the pick IS the fastest row or shares its fuel amount,
   `fuel_saved_l:null` — already honest; keep nulls null.

## 6. Where the question lives — profile vs per-trip

Keep today's shape (it already matches "local storage only, no auth"):

- **Saved ride** (`K_VEH`): `{cls, fuel, mileage?}` — set once, one tap per
  trip, editable from the routes-view vehicle pill. Class+fuel is an
  estimate input, not a compliance check — year/PUC stay unasked.
- **Per-trip override:** the same wizard in `trip` ctx; a different
  vehicle for one ride shouldn't rewrite the saved one (today `done()`
  sets both `S.veh` and `S.tripVeh` — split: pill-edit writes `K_VEH`,
  trip-flow writes `tripVeh` only).
- **Unasked = visible assumption:** any row estimated on `_DEFAULT_FUEL`
  or the fleet prior carries its assumption in text (`emissions.label` /
  a "(typical Delhi)" chip) — the single change that resolves the
  complaint even for users who never open the wizard.

## 7. Verify-live list (couldn't run here)

1. TomTom consumption path end-to-end — is `fuelConsumptionInLiters`
   returned with the current single-pair call, and does it move with
   traffic speeds or stay ~flat? (No key in this env; lane P's tests mock
   the seam.)
2. Whether the detailed-model params (`fuelEnergyDensityInMJoulesPerLiter`,
   `auxiliaryPower*`) are *required* once any consumption param is sent —
   TomTom docs say yes for the full model; confirm which tier the current
   request lands in and whether it 400s or defaults.
3. `route_traffic` 400-fallback drops consumption silently — confirm the
   fuel fields are absent (not bogus) on that path, then decide whether to
   surface `consumption_dropped:true`.

---
*Evidence: file:line cites from the working tree; `int/routes-airmap`
providers.py verified identical to `.wt/lane-providers` (2367 lines);
emission bands and labels produced by running `server/emissions.py`
directly (fleet-prior inputs shown); Delhi fuel prices cross-checked
against 3 live trackers 2026-10-12.*
