# 08 — Delhi factors: fuel, time, safety — the trip score beyond air

*Research deliverable. ALive already scores trips on inhaled dose; this doc is
the evidence base for scoring the other three things a Delhi commuter actually
feels: ₹ fuel cost, speed/reliability, and crash risk — plus the seasonal
frame (parali, inversion, GRAP) that changes what we should say, and the
honest claim set for both the consumer product and the government corridor
product (PWD, DTC, Delhi Traffic Police).*

*Rules inherited from docs/05, docs/26, docs/32: every number a buyer or judge
can fact-check must survive the check; where sources disagree we print the
range; anything not confirmable against a primary page is marked
**[UNVERIFIED]**. Prices verified against OMC/IGL/press sources for the
2024–25 window; crash data against DTP annual lists + MoRTH publications;
congestion stats against TomTom's published index.*

Sister docs: 23 (Delhi data inventory — air side), 26 (honest impact ledger —
emissions claims), 31 (dual-objective routing), 32 (fleet ground truth),
09/transit (metro option as shipped), lanes/grap-stage (GRAP-equivalent
labeling as shipped).

---

## 0. Verdict up front — the numbers that survive a fact-check

| # | Say this | Don't say this | Why it survives |
|---|---|---|---|
| 1 | "A petrol car-km in Delhi traffic costs **₹6–9 in fuel** (₹94.77/L at 11–16 km/l); a CNG car-km ₹3–4; an e-2W km under ₹0.25 home-charged." | "Driving costs ₹X/km" (a point) | Price is official and frozen all year; the band is real-world mileage variation, which is honest |
| 2 | "Idling at a standstill burns **~₹0.5–1.6/min** for a car (0.3–1.0 L/h class rates, CRRI/PCRA-measured); Delhi as a whole has burned **hundreds of crores a year** at signals — CRRI/PCRA put it at ₹994 crore at 2009 prices across ~950 signalized intersections." | "Idling costs Delhi ₹994 crore" (2009 figure at 2025 prices) | The per-vehicle rates are measured; the city total is a dated study — quote it dated |
| 3 | "Delhi recorded **5,657 crashes and 1,504 fatal crashes in 2024** (DTP annual); **~80% of those killed were pedestrians, two-wheelers and cyclists** — car occupants were ~3%." | "Roads are dangerous" (vague) or "the app keeps you safe" (unprovable) | DTP published counts + MoRTH road-user splits; the 80% figure is why open-mode users are the safety product's real audience |
| 4 | "We can tell a route **passes N official crash-prone zones** (DTP 500-m zones; we ship 100+ geocoded); we **cannot** tell you the route is safe." | "This is the safe route" | Crash-zone presence is countable; risk-per-km needs VKT denominators nobody publishes; see §2.4 |
| 5 | "Delhi traffic: **60.2% average congestion, ~104 h/yr lost at rush hour** (TomTom 2025, India #4). Live per-edge speeds are **paid API data** (TomTom/HERE/Google), not free — our own traversals are the honest probe." | "We have real-time traffic" (without a probe source) | Index numbers are published; live speed is licensed data — the claim must name the source |
| 6 | "Metro at ₹11–64 a trip beats a petrol car on ₹ **and** on peak-hour time **when both ends sit within ~1–1.5 km of the network on ≤1-transfer paths**; with 2+ transfers or >2 km access legs it usually loses the time trade." | "Metro is always better" | Arithmetic from DMRC fare slabs + 32 km/h commercial speed + our own access model (docs/09) |
| 7 | "Oct–Nov advice must carry the parali frame (farm fires hit **~35% of Delhi's PM2.5 on peak days**; season mean ~10–13%) and winter advice the GRAP frame — Stage III bans whole vehicle classes off the road." | "Stubble caused today's air" (we don't attribute; DSS does) | DSS-published fractions are citable; our own source-attribution is already on the docs/26 kill list |

---

## 1. Fuel economics — what a Delhi kilometre actually costs

### 1.1 Retail fuel prices (Delhi pump, 2024–25)

| Fuel | Price | Since | Source |
|---|---|---|---|
| Petrol | **₹94.77/L** | unchanged since the Mar-2024 ₹2 cut; IOCL price buildup confirms ₹94.77 effective Dec-2025 | IOCL price buildup PDF; NDTV/Indiatimes daily fuel trackers |
| Diesel | **₹87.67/L** | same window | same |
| CNG | **₹75.09 → 76.09/kg (Apr-2025) → ~₹77.09/kg (Nov-2025)** | IGL revisions Apr 7 and Nov 16, 2025 | IGL rate cards via Zee/Goodreturns |
| Electricity — dedicated EV LT meter | **₹4.50/kWh** (LT) / ₹4.00 (HT) + ~20% levies → **~₹5.3–5.6/kWh effective** | DERC EV tariff (static since FY19-20 order) | BSES EV Connection FAQ |
| Electricity — domestic slab fallback | ₹3–8/kWh by monthly slab | DERC tariff order | BSES Form 2.1a |
| Public DC fast charging | **~₹18–25/kWh** operator-set | Statiq et al. rate cards | chargedekho station listings |

NCR commuters crossing borders pay more: CNG in Noida/Ghaziabad is
₹84.70–85.70/kg (~11% above Delhi); petrol in Gurugram ~₹95.5/L. Route-level
₹ math on cross-border trips should use the destination-side price — a real
second-order effect, not noise, for Delhi↔Noida commute scoring.

### 1.2 Per-km cost by mode — the scoreboard row

Fleet-realistic Delhi consumption bands (city-cycle, not ARAI brochure):
petrol car 11–16 km/l, diesel car 14–19 km/l, CNG car 18–24 km/kg, petrol 2W
40–55 km/l, CNG auto 25–35 km/kg, CNG bus ~2.5–3.5 km/kg, EV car 0.12–0.16
kWh/km, e-2W 0.03–0.05 kWh/km. These are the standard planning bands;
the **class-average band, never a point** rule from docs/26 applies verbatim.

| Mode | ₹/km (energy only) | Working |
|---|---|---|
| Petrol car | **₹6–9** | 94.77 ÷ 11–16 |
| Diesel car | **₹4.6–6.3** | 87.67 ÷ 14–19 |
| CNG car | **₹3.2–4.3** | ~77 ÷ 18–24 |
| Petrol 2W | **₹1.7–2.4** | 94.77 ÷ 40–55 |
| CNG auto (driver cost) | **₹2.2–3.1** | ~77 ÷ 25–35 |
| EV car, home EV-tariff | **₹0.65–0.90** | 0.12–0.16 × ~5.5 |
| EV car, public DC fast | **₹2.2–4.0** | 0.12–0.16 × 18–25 |
| e-2W / e-rickshaw, home | **₹0.15–0.30** | 0.03–0.05 × ~5.5 |
| CNG bus (vehicle) | **₹22–31** vehicle-km → **₹0.6–2.1/passenger-km** at 15–40 aboard | ~77 ÷ 2.5–3.5, occupancy from docs/31 |

**Honesty note for the scoreboard:** what the *user pays* ≠ what the
*vehicle burns*. For own-vehicle modes show burn cost (this table); for
hired modes show the regulated/market fare (§1.5); showing a petrol-car
owner "₹2/km" because an auto driver pays CNG rates is the classic
confusion — never mix the two on one line.

### 1.3 Idling burn — the jam multiplier

Measured per-vehicle idle consumption (Indian Institute of Petroleum /
CRRI Road User Cost Study line, used by the Delhi signal studies):

| Vehicle | Idle fuel burn |
|---|---|
| 2W | ~0.34 L/h |
| CNG 3W (Bajaj class) | ~0.42 L/h |
| Small petrol car (Maruti-800 class) | ~0.45 L/h |
| Large petrol car (Ambassador class) | ~0.78 L/h |
| Diesel jeep/LCV | ~0.69–0.74 L/h |
| Bus / truck | ~0.86–0.92 L/h |
| Modern car **with AC on** | ~1.0–1.5 L/h **[estimate — AC compressor roughly doubles idle burn; no Delhi-published rate]** |

Aggregate evidence at Delhi scale:

- **CRRI × PCRA study** (12 signalized intersections, ~2009): Delhi loses
  **~₹994 crore/yr** to signal idling ≈ **~331 million litres of fuel/yr**
  at ~950 signalized intersections. At 2025 prices the same volume is
  ~₹3,000 crore — quote it as "dated study, current-price equivalent,"
  never as a fresh measurement.
- **Lodhi Road intersection** (IIT/tertiary study): ~230 L petrol + ~100 L
  diesel + ~170 kg CNG burned *at one junction per day*; ~1,300 kg CO2,
  13 kg NOx, 90 kg CO/day — idling CO2 ≈ **9% of Delhi transport emissions**
  in the 2004-era estimate.
- Rule of thumb for the product: **a petrol car at a standstill burns
  ~₹0.7–1.6/min** (0.45–1.0 L/h); a 2W ~₹0.5/min. An 8-minute jam costs a
  car commuter ~₹6–13 in pure idle — before the stop-go penalty on the
  moving segments (stop-go traffic inflates per-km burn ~20–30% vs
  free-flow; COPERT speed curves, already in `alive_core_ref.py` as
  `emission_speed_factor`).

### 1.4 What a route choice actually yields — the honest ₹ band

Worked example, the shapes the scorer will actually produce:

**Route choice (same vehicle):** a 3-km-shorter arterial alternative that
also skips ~10 min of jam time saves a petrol-car commuter roughly
3 km × ₹7 + 10 min × ~₹1 ≈ **₹25–35/trip**. Honest band: **₹10–50/trip**;
annualized over ~500 commute trips ≈ **₹5,000–25,000/yr**. Anything smaller
(₹3–5) is inside fuel-price rounding noise — don't celebrate it.

**Departure choice:** leaving 40 min earlier on the same route can cut
idling more than distance does (TomTom: Delhi evening congestion 107.4%
vs morning 71.7%). A peak→off-peak shift on a 15-km trip is worth
~₹15–30 — often more than any alternate route offers.

**Mode choice (the big lever):** 15-km corridor, Rohini → Nehru Place class:

| Option | User pays (₹) | Time (peak) | Dose |
|---|---|---|---|
| Own petrol car | ~110 fuel + 15–25 idle + 20–50 parking ≈ **₹145–185** | 50–70 min | mid |
| Own petrol 2W | ~₹32 fuel | 40–55 min | high |
| Auto (meter) | 30 + 13.5×11 ≈ **₹179** | 50–65 min | high |
| AC taxi/app cab | 40 + 14×20 ≈ **₹320+** | 50–70 min | mid |
| Metro (12–21 km slab) | **₹43** (₹39 card) | ~40–50 min door-to-door if stations near | low |
| DTC AC bus | **~₹15–25**; ₹0 for women w/ Pink Saheli | 70–100 min | mid-high |
| EV car (home charged) | ~₹11 energy + parking | 50–70 min | mid-low |

The ₹ story on its own already ranks the options sensibly — and it
*agrees* with the dose story on the same trips (docs/31 §2: the objectives
align because the same thing — motorized road time — drives both).

### 1.5 Fares users actually face (regulated numbers, citeable)

| Mode | Fare structure | Source |
|---|---|---|
| DMRC metro | ₹11 / 21 / 32 / 43 / 54 / 64 by distance slab (revised 25-Aug-2025, first hike in 8 yrs); smart card −10%, off-peak −10% more; Sun/holiday slabs cheaper; Airport Express separate | DMRC fare chart + Aug-2025 hike notices |
| DTC / cluster bus | distance-slab fares ₹5–25 class; all-route day pass ₹40 non-AC / ₹50 AC; **women + transgender Delhi residents free with Pink Saheli NCMC card** (mandatory from Aug/Oct-2026, paper pink tickets phased out) | DTC site; Oct-2026 Gazette |
| Auto | ₹30 first 1.5 km + **₹11/km**; +25% night; waiting ₹1/min after 15 min | Transport Dept notification 9-Jan-2023 |
| Taxi (kaali-peeli) | ₹40 first km + ₹17/km non-AC / ₹20/km AC | same notification |
| App cabs | unregulated dynamic; effective ~₹15–25/km + surge **[UNVERIFIED — varies]** | — |

---

## 2. Accident risk — scoring safety honestly

### 2.1 The baseline (all citable)

- **Delhi 2024 (DTP annual assessment):** 5,657 total crashes (−3% yoy),
  **1,504 fatal crashes (+5%)**, ~1,500 killed. Fatal crashes rising while
  total falls — the lethality per crash is the trend to watch.
- **Black spots:** DTP defines a crash-prone zone as ≥3 fatal or ≥10 total
  crashes within a **500-m diameter** in a calendar year. **111 zones in
  2024**; the top-10 alone logged ~170 crashes (~180 by NDTV's count),
  ~42% fatal, ~79 deaths — with **7 new sites entering the top-10** in
  2024 even as older spots improve under remediation. MoRTH's national
  black-spot MIS lists **115 Delhi spots** of ~8,882 nationally
  (docs/23 #42).
- **Who dies:** pedestrians ~38% + two-wheeler riders ~39% + cyclists ~3%
  ≈ **~80% of Delhi's road deaths**; car occupants ~3% (MoRTH road-user
  splits, 2024). Nationally: 1.77 lakh killed 2024, two-wheelers 46.2%,
  pedestrians 20.6%, over-speeding implicated in ~70% of deaths.
- **The asymmetry the product must respect:** the modes with the highest
  dose (walk, cycle, 2W, auto) are also the modes with the highest crash
  lethality — dose score and crash score are correlated, not independent.
  A "lighter air" recommendation toward an open mode is *also* a
  risk-profile change. Say both.

### 2.2 Where Delhi's crash risk actually lives — corridor geography

The 2024 top-10 and the multi-year persistent list cluster on a small set
of corridors — high-speed arterials colliding with pedestrian/bus-stop
activity:

| Corridor | Why it's on the list | Named zones (examples) |
|---|---|---|
| **Outer Ring Road** | Highest count of any corridor — 17 of 111 spots; free-flow speeds vs crossings | Bhalswa Chowk (19 crashes/6 fatal 2024), Mukarba Chowk, Mukundpur, Mangolpuri, Peeragarhi, Chirag Delhi, Wazirabad |
| **GT Karnal Road (NH-44)** | Highway-grade speeds through dense settlements + mandi freight | **Azadpur Sabzi Mandi — 2024's #1 (20 crashes/11 fatal)**, Libaspur (18/6), Nangli Poona, Siraspur, Swaroop Nagar, GTK Depot, Jahangirpuri |
| **NH-24 / NH-9 (east)** | Expressway speeds + 2W/pedestrian mixing | **Akshardham (19/8)**, Anand Vihar ISBT (16), Ghazipur underpass/murga mandi, TELCO |
| **Ring Road** | Same arterial-vs-crossing pattern | ISBT Kashmere Gate (17/8), Punjabi Bagh, Moti Bagh, Dhaula Kuan, Moolchand, Vijay/Nigam Bodh Ghats |
| **Rohtak Road / NH-10** | | Zakhira Flyover, Madipur, Rajdhani Park, Nangloi, Mundka |
| **Mathura Road (NH-19/44)** | | Okhla Mor, Modi Mill, Pul Prahladpur, Badarpur, Sarita Vihar, Jasola |
| **NH-8 / NH-48 (Gurugram)** | | Mahipalpur, **Rajokri Flyover (16 crashes 2024)** |
| **Wazirabad Road / Signature Bridge** | New corridor, speeding + night pedestrian deaths | Signature Bridge approach, Gagan Cinema, Khajoori |
| **Dwarka / Najafgarh periphery** | Fast new roads, weak ped infrastructure | **Yashobhoomi (2024 top-10)**, Sector-7/9 crossing (TRiPC-audited, 27 deaths 2019-21), Najafgarh town |

Pattern for the corridor product: **risk concentrates on 60–80 km/h-design
roads where pedestrian/bus-stop activity wasn't designed out** — metro
construction zones (Azadpur), mandi freight (Azadpur, Ghazipur), ISBT
frontages (Kashmere Gate, Anand Vihar), and flyover/underpass approaches.
This is a *design failure* signature, which is exactly the framing PWD and
DTP already use — our data product should inherit it.

### 2.3 What's already shipped

`server/blackspots.py` — 100+ geocoded official zones: all 87 from the
**DTP Delhi Crash Report 2021** (Table 6.28, with per-zone simple/fatal
counts + subtype flags for night/pedestrian/2W/HTV/hit-and-run), TRiPC
IIT-Delhi audited locations with exact DMS coordinates, and the DTP
annual top-10 lists for 2022/2023/2024 folded in. `decide.py` already
surfaces `night_black_spots` on options; `/blackspots` serves the GeoJSON
layer. Severity tiers (high/medium/watch) are computed *straight off the
published counts* — no invented scoring.

### 2.4 The honest scoring rule

What we can compute vs what we can't:

| Question | Answerable? | Why |
|---|---|---|
| "Does this route pass an official crash-prone zone?" | **Yes — countably** | Zones are published; geometry intersection is exact (`spots_near_geometry`) |
| "Which route touches fewer zones?" | Yes, with caveats | Zone lists update annually; a new corridor can be dangerous before it makes the list (Yashobhoomi entered 2024) |
| "What's the crash risk per km on route A vs B?" | **No** | Needs per-corridor VKT denominators — Delhi publishes counts, not exposure; a per-km number would be invented precision |
| "Is route A safer in a *relative* sense?" | **Bounded claim only** | Defensible phrasing: "touches 2 official crash zones vs 5 on the fastest route" + subtype match (night flags matter at night) — that's a count, not a probability |
| "Will you crash?" | Kill list | Individual risk = f(behavior, vehicle, hour, weather). Never score "safety %" |

**Scoring rule to ship:** a route's safety term = weighted zone-touch
count (severity-tiered, subtype-aware: pedestrian-zones count more for
walk/cycle options; night flags count after ~20:00) + a *mode vulnerability
factor* already implied by the road-user splits (open modes ~25× car
occupants' fatality share). Report it as **"N official crash zones on this
route"** — a count users can verify on the DTP list — never as a
"safe/unsafe" label. A route touching zero zones is "no listed zones,"
not "safe" — lists lag reality and most of the road network is unlisted.

**Underreporting caveat to carry:** MoRTH/DTP counts rest on police
recording; studies consistently find non-fatal crashes under-recorded in
India, and hit-and-run is a named DTP subtype precisely because it's
common. The zone list is the *official floor*, not the full risk field.

### 2.5 iRAD/eDAR — what it is, why we can't just call it

- **eDAR (electronic Detailed Accident Report, formerly iRAD)** is
  MoRTH/NIC's national crash database — police, health, transport and
  road-owning departments each enter their module per crash; GPS-tagged;
  all 36 states/UTs onboarded. **Access is role-based government login
  only — there is no public API and no public extract.** What reaches the
  public: MoRTH's annual *Road Accidents in India* publication, the
  black-spot MIS, DTP's annual lists and Crash Reports, and civic mirrors
  (opencity CKAN).
- **CCTNS** (Crime & Criminal Tracking Network Systems) is the police
  records backbone crash FIRs originate in — it feeds eDAR but is
  **crime-record infrastructure, not a traffic or congestion source**;
  nothing in it gives speeds, counts or flows. Don't list it as a
  congestion data source in the govt pitch; do name it as where our
  "report incident" UX lands if a user files.
- **For the government sale:** the corridor product doesn't need eDAR
  access to be useful — we deliver *demand × exposure × zone* (who
  traverses which corridor, at what dose, through which official zone);
  DTP already owns the crash side. The honest pitch is "we see demand and
  exposure the FIR layer can't see," not "we have better crash data."
- **DTP×Google precedent (Jan-2025):** DTP announced black spots will be
  pushed onto Google Maps for commuter alerts — proof the government
  *wants* zone data in consumer navigation; our differentiator is pairing
  zones with dose and demand, not zone data itself.

---

## 3. Congestion data — what's real, what's API-able, what's report-only

### 3.1 The city-level picture (published, citable)

**TomTom Traffic Index** (the standard citation):

| Year | Delhi avg congestion | India rank | 10 km time | Rush-hour loss |
|---|---|---|---|---|
| 2024 (14th ed.) | ~23:24/10 km avg travel time | ~#10 India cities by time; Kolkata/Bengaluru/Pune globally top-5 slowest | 23:24 | — |
| 2025 (15th ed.) | **60.2%** (+3.5 pp) | **#4 India** (Bengaluru 74.4%, Pune 71.1%, Mumbai 63.2%) | evening rush **31:45/10 km (~19 km/h)**, morning rush congestion 71.7% | **104 h/yr** |

Honest reading: by *travel time per 10 km* Delhi is slow but not India's
slowest (wider arterials + metro absorb); by *congestion level* it's
India #4. Pick the metric, name the metric.

### 3.2 Live speed/traffic — the API landscape and its real costs

| Source | What it gives | Access & cost | Fit |
|---|---|---|---|
| **TomTom Routing API + Traffic Flow** | Traffic-aware ETA + per-segment live speeds | Self-serve key; **2,500 free non-tile req/day**; then $0.75–6/1k by endpoint | Best free tier for demo-scale live speeds; Traffic Stats (historical per-edge) is enterprise-priced |
| **HERE Routing v8** | Traffic-aware routing, flow | Freemium **~30k req/month** (~1k/day) | Second free source; Delhi coverage good |
| **Google Routes / Directions** | Traffic-aware ETA, best data freshness | ~$5/1k essentials, $10/1k traffic-advanced; small monthly free cap | Accurate but paid at any real volume; no per-edge speed redistribution into our own tiles |
| **Self-hosted OSRM/Valhalla (ours)** | Routing on OSM graph, free | Already in stack (`route_graph`) | Free-flow ETA only unless fed a speed field — see 3.4 |
| **Delhi OTD GTFS-RT bus positions** | ~7k buses' live positions = free probe fleet on arterials | Static feeds public today; **RT key on request** (docs/23 #41) | The honest Indian probe source — bus speed on a corridor ≈ traffic speed minus dwell; also directly serves the DTC pitch |
| **DTP iTMS** (Intelligent Traffic Mgmt System) | ~citywide cameras/violation feeds | No public API; govt-internal | Named in the govt pitch as the *buyer's* data, not ours |
| **CCTNS** | FIR/crime records | No traffic content | Explicitly *not* a congestion source (§2.5) |
| **MapmyIndia/Mappls** | Indian stack, local POI strength | Commercial | Worth evaluating if TomTom India coverage disappoints |
| **MoRTH/eDAR, DTP reports, MCD/PWD notices** | Annual/periodic | Report-only | Context, not compute |

**Licensing honesty:** TomTom/HERE/Google results are licensed for
*display to end users in an application*, not for building a
redistributable corridor dataset or a government-facing analytics
product. Anything we *sell* to PWD/DTC must be built on our own
traversals + open feeds (GTFS-RT, OSM), or the vendor contract must
explicitly allow derived-data resale — flag this before pricing the
corridor product.

### 3.3 The own-probe path (the actual differentiator)

Every traversal the app collects is a speed sample on a corridor cell:
position deltas → segment speed → per-cell per-hour speed distributions.
Cold start = seed traversals (labeled); coverage grows with users. The
honest claim is **"measured corridor speeds from real Delhi commutes,
updated continuously, free of vendor license"** — the same mechanism
docs/26 already validates for dose (Tier-1 claim #5-6), applied to time.
Bus GTFS-RT, once keyed, multiplies coverage ~100× on arterial corridors
immediately — the single highest-leverage data action for the time axis.

**Reliability (variance) is the sellable bit:** agencies and commuters
both care about *spread*, not just mean speed. A corridor that is 25 min
±3 is worth more to a commuter than one that is 22 min ±12 — own-probe
distributions give this; TomTom's API gives a point ETA. For DTC, the
same distribution on bus corridors → bunching/dwell analysis. For PWD,
pre/post resurfacing speed distributions → measured (not asserted)
intervention outcomes. This is the B2G product thesis in one paragraph.

---

## 4. Metro vs road — when the shift genuinely wins

### 4.1 The real numbers

- **Network:** ~416 km / ~303 stations NCR-wide (DMRC ~395 km + NMRC Aqua
  ~29 km + Rapid Metro ~13 km); ~63–65 lakh journeys/day (6.31M FY25 avg;
  record 81.9 lakh on 8-Aug-2025).
- **Speed:** ~32–33 km/h commercial including dwell (our shipped
  `METRO_SPEED_KMH`); peak headways 2–4 min on trunk lines.
- **Fares:** ₹11–64 slabs (Aug-2025 revision), card −10–20%; vs
  ₹30+11/km auto, ₹40+17–20/km taxi, ₹6–9/km own petrol car.
- **Dose:** metro microenv factor 0.45 vs 0.55 AC car, 0.90 bus, 1.20–1.30
  2W/auto/walk (`exposure.py`); run-mean 34 µg/m³ vs 113 auto (Magenta
  study) — ~3.3×.

### 4.2 When metro wins on *all three* axes (dose, ₹, time)

Metro genuinely dominates — the "wins both + faster" badge — when **all**
of these hold:

1. **OD within ~1–1.5 km of stations** at both ends (our shipped
   `MAX_ACCESS_KM` gate = 2.5 km, but time-parity needs ~1–1.5);
2. **≤1 interchange** on a reasonably direct path (line topology serving
   the OD — radial trips along Yellow/Blue/Red/Violet corridors);
3. **Trip ≥ ~8–10 km** (short trips can't amortize access+wait);
4. **Peak or near-peak hours** (road is slowest exactly when metro
   frequency is best);
5. Service hours (~05:30–23:30) and the user can walk the access legs.

On that footprint — most central-Delhi and NCR-gateway commute pairs —
metro wins ₹ by 3–4× (₹43 vs ₹145–185 car / ₹179 auto on 15 km), dose by
~3–10×, and time by 10–30 min at evening rush. **This is the honest
headline: on a metro-served corridor at rush hour, metro isn't the
virtuous compromise — it's the dominant option on every axis.**

### 4.3 When it doesn't — the four failure shapes

| Shape | Example | What happens |
|---|---|---|
| **Cross-radial / orbital OD** | Dwarka → Gurugram Cyber Hub | 2–3 transfers + long in-coach leg: metro ~85–100 min vs car ~35 min (docs/31 Trip B). Dose still wins, time loses badly — show the trade, don't hide it |
| **Short trip + far station** | 4 km hop, 2 km from a station | access+wait (~15–20 min) > the ride itself; auto/2W/e-rick wins time; walk+metro never forms |
| **Access mode is a motorized leg** | station 2.5 km away → auto to station | dose and ₹ erode: the auto leg carries rickshaw microenv (1.30) and ₹30+; a full-auto trip can beat metro+auto on time with dose similar — the *access leg is the decision*, not the trunk |
| **Off-hours / freight / companions** | post-23:00, airport luggage, family of 4 | service ends; cab splits one fare; car's door-to-door wins cleanly |

### 4.4 Interchange penalty — handling

Shipped: `TRANSFER_PENALTY_S = 6 min` per line change in `transit_real.py`
(GTFS path), folded into duration; street-level cross-station transfers
get <350 m walk links where the feed models separate stops. How that
squares with the literature:

- Stated-preference interchange penalties in planning models run
  **~5–15 min equivalent** per transfer (boarding friction + wait
  uncertainty + wayfinding); DMRC's big interchanges (Rajiv Chowk,
  Kashmere Gate, Hauz Khas) have real walk components of 3–8 min
  alone → our 6 min sits at the honest low end of *elapsed* time, which
  is right for a duration model (perceived-time penalties are a
  scoring-layer concern, not a clock-time one).
- **What to add if we show perceived time:** a separate "hassle" term
  (transfers × ~5–10 min equivalent + crowding) — but keep it out of the
  ETA. Label rule: ETA = scheduled; "≈N min of transfers/waits" is a
  separate, named line.
- Dose handling is already correct: concourse/wait time prices at
  near-metro microenv, walk legs at 1.30 — the walk legs carry most of
  a metro trip's dose (docs/09 §why); surface that, since it *is* the
  metro counterargument a sharp user raises.

---

## 5. Seasonal context — parali, inversion, GRAP

### 5.1 Parali season (Oct–Nov): the numbers and the trap

- **Official monitoring season:** 15 Sep – 30 Nov (ISRO/CREAMS protocol).
  Punjab fire counts: ~10,909 (2024) → **5,114 (2025, −53% yoy, −93% vs
  2021)**; Haryana 662 (2025).
- **DSS share of Delhi PM2.5:** season-mean ~10–13% (10.6% in the Oct 8–
  Dec 7, 2024 window, per the MoEFCC Lok Sabha answer); **daily peaks
  35% (Nov 1, 2024), 48% (Nov 6, 2021)**; 2025's first severe day ran
  ~22%. Transport's own share those days: ~11–12%.
- **The honesty trap — undercounted fires:** iFOREST's multi-satellite
  assessment finds **>90% of large fires in 2024–25 now occur after
  ~15:00**, i.e. after the polar-orbiters' single daily pass — official
  fire-count declines (~90%) reflect partly a real decline (burnt area
  −25–35%) and partly a monitoring artifact. **Product rule:** our
  FIRMS-based fire layer can legitimately claim "satellite-detected
  fires," must *not* claim "total fires" or repeat the −90% decline as
  fact; the honest version is "fires detected: N (satellites now miss
  late-afternoon burns — iFOREST)."
- **What changes for the user in-season:** NW-wind days after big fire
  days are when open-mode advisories have their largest absolute value
  (peak-day stubble share ~35% × a 300–500 µg field is real dose), and
  when "leave later / metro today" stops being a marginal nudge.

### 5.2 Winter inversion & ventilation

The physics is already in docs/25 — reuse it: Delhi's ventilation
coefficient runs post-monsoon ~907±522 / winter ~1,112±574 vs
pre-monsoon ~3,667±2,140 m²/s; a measured October day ran night-VC ~285
vs midday ~6,300 — a ~96% collapse overnight. Operational consequences:

- **Best-hour advice is a winter product too**, not just fair-weather:
  the midday ventilation window is when open modes are least punished.
- **Morning-peak is the worst-dose slot** (shallow BL + traffic peak);
  the Delhi microenv studies confirm morning peaks carry the worst dose.
- Fog/low-visibility days stack a *visibility* crash-risk term on top of
  dose — flag it in the winter advisory copy.

### 5.3 GRAP — the stages and what each changes for our advice

CAQM's Graded Response Action Plan is legally binding, cumulative, and
triggered on Delhi's average AQI (invoked in advance on IMD/IITM
forecast):

| Stage | AQI trigger | Key measures that change a commute |
|---|---|---|
| I — Poor | 201–300 | dust/PUC/enforcement drives; **anti-idling advisory** ("switch off at red lights"); mechanical sweeping |
| II — Very Poor | 301–400 | + diesel genset curbs, parking-fee hikes, more bus/metro frequency urged |
| III — Severe | 401–450 | **+ BS-III petrol & BS-IV diesel 4-wheelers banned from roads** (Delhi + NCR districts); C&D stopped; primary schools go hybrid; inter-state diesel buses restricted |
| IV — Severe+ | >450 | + truck entry stopped (except essential/CNG-e-LNG/BS-VI); possible odd-even; 50% WFH advised incl. public offices |

What each stage does to *what ALive should say*:

- **Stage I–II:** normal scoring + the anti-idling nudge (it's the one
  GRAP measure aimed directly at drivers; a ₹/min idling number makes
  the official advice concrete).
- **Stage III:** the mode option set *literally shrinks* — BS-III petrol
  / BS-IV diesel cars are illegal; if the user's declared vehicle is in
  the banned class, the honest product says so instead of scoring it.
  Open-mode dose warnings get maximal weight (field ≥ severe).
- **Stage IV:** truck-entry bans change corridor traffic composition and
  speeds; WFH advisories make "should you travel at all" the first
  question — our "leave later" framing extends to "don't go" days.
- **Labeling discipline (shipped rule, keep it):** we compute the
  *GRAP-equivalent* stage of our served field — "this air maps to
  Stage III rules" — never "Stage III is in effect"; CAQM declarations
  are official acts we don't have a feed for (lanes/grap-stage).

### 5.4 Seasonal message rules

| Season | What the user should hear |
|---|---|
| Jul–Sep (monsoon/clean window) | Normal scoring; this is when open modes are cheapest in dose terms — don't over-warn |
| Oct–Nov (parali) | Fire-share line on bad days ("~a third of today's PM is farm smoke" — DSS-cited, day-labeled); NW-wind + high fire day = strongest "metro today" push of the year |
| Dec–Jan (inversion/fog) | Ventilation-window advice (best hours 11:00–16:00); morning-peak dose warnings; visibility flag on open modes; GRAP stage context |
| Feb–Mar | Transition; dust picks up — non-tailpipe PM framing matters more than stubble |
| Apr–Jun (heat/dust) | Ozone becomes a co-pollutant (PM-only dose understates); heat stress on open modes is a real advisory (60 lakh riders at 24°C coach vs 45°C street is a comfort+health story) |

---

## 6. The honest claim set — what ALive can promise a Delhi commuter

### 6.1 Can say (defensible today)

| Claim | Basis | Precision |
|---|---|---|
| "This trip costs ~₹A–B in fuel for your declared vehicle class" | Official prices × class consumption band | ±~30%, band shown |
| "Idling right now is costing you ~₹X/min" | Measured class idle rates | per-minute figure, class-banded |
| "The other route saves ~₹Y–Z/trip (~₹N/year)" | Distance × ₹/km + idle-time delta × ₹/min | Band; only above ~₹10 materiality |
| "This route passes N official crash-prone zones (DTP list)" | Shipped blackspots layer | Exact count, source-dated |
| "These N zones are flagged for night / pedestrian / 2W crashes" | DTP subtype flags in shipped data | Exact flags |
| "Metro beats car on ₹, dose and time *on this OD at this hour*" | Fare slabs + 32 km/h + dose factors + GTFS times | Option-level verdict, conditions stated |
| "Today maps to GRAP Stage-N rules; BS-III/BS-IV classes are off the road at Stage III" | CAQM schedule + our field | Equivalent-stage, labeled |
| "N commutes measured this corridor; data H hours old" | Own traversals | Exact counts — same Tier-1 claim as dose |
| "Your corridor's typical speed is V ± spread at this hour" | Own probe samples (when density exists) | Distribution honest: report p10/p90 |

### 6.2 Can't say (kill list — extends docs/26)

| Killed claim | Why it dies |
|---|---|
| "This is the safe route" / "route safety score: 87%" | No exposure denominators; list lag; individual risk unmodelable |
| "Guaranteed ₹X savings" | Driver behavior, AC use, real mileage variance — band only |
| "Real-time traffic" without a named probe feed | TomTom/HERE/Google are paid; own-probe needs density — name the source or don't claim live |
| "We reduce accidents" | Mechanism (awareness) plausible; outcome needs before/after causality we can't show at user scale |
| "Metro is always the right choice" | Fails on cross-radial ODs, short trips, access>2 km, off-hours — §4.3 |
| "Your car emits X g" (point) | docs/26 already killed: class band only |
| "Fires are down 90% so parali is solved" | iFOREST undercount finding; cite detected fires only |
| "GRAP Stage III is in effect" | Official CAQM declaration ≠ our computed equivalent — wording rule shipped |
| Per-person risk statements ("your crash odds are 1 in N") | Base-rate × individual behavior — unprovable |

### 6.3 The government corridor product — same honesty rules at B2G

What the corridor data product can truthfully sell to each buyer:

| Buyer | What we give them | What we can't |
|---|---|---|
| **DTP / traffic police** | Zone-traversal demand: how many commutes pass through each official black spot, by mode and hour; which corridors carry the most open-mode traffic at night — enforcement posting and lighting priority evidence | Crash prediction; violations; anything identifying a vehicle or person (privacy design forbids it: k≥3 cells, no raw traces at rest) |
| **PWD / road agencies** | Corridor speed distributions pre/post their interventions (resurfacing, signal retiming); demand-weighted zone exposure = which 500-m zones expose the most commuters — a prioritization metric they don't get from FIR counts | Pavement condition; engineering diagnosis |
| **DTC / DIMTS** | Bus-corridor speed/bunching distributions (their own GTFS-RT makes this cheap); where bus speeds diverge from general traffic (bus-priority evidence); last-mile demand around stops | Schedule compliance per vehicle (that's their AVL data, not ours) |
| **CAQM / DPCC** | Exposure-weighted corridor demand: "corridor C delivers Σµg/day of inhaled dose across N commuters" — the dose-demand product nobody else computes | Emissions inventory claims (their domain; we consume their inventories) |

**The one-sentence honest pitch:** *"You have the crash layer and the
station layer; we have the demand×exposure layer — who commutes through
which corridor at what dose, continuously, privacy-clean."* Everything in
that sentence is a mechanism we can demonstrate; nothing requires
attribution we can't prove.

---

## 7. Data-source table — factor → source → license/cost → freshness

| Factor | Source | Access / license / cost | Freshness | Status |
|---|---|---|---|---|
| Petrol/diesel retail price | IOCL/OMC daily price + price-buildup PDFs; news trackers | Public web, free, attribute | Daily 06:00 revision; Delhi stable since Mar-2024 | 🆕 manual refresh or scrape |
| CNG price | IGL rate cards (igl.co.in) + press | Public, free | Discrete revisions (Apr/Nov-2025) | 🆕 manual refresh |
| EV tariff | DERC tariff order + BSES EV FAQ | Public PDF, free | ~Annual (tariff static since FY19-20) | 🆕 static constant |
| Public charging price | Statiq/charge-map listings | Public web | Operator-set, drifts | 🆕 sample quarterly |
| Fuel consumption per class | ARAI/IIP idling + planning bands; COPERT speed curves (in `alive_core_ref.py`) | Published methods, free w/ citation | Static factors | ✅ pattern in use (emission speed factor) |
| Idle burn rates | CRRI/PCRA Delhi signal study; IIT idling-consumption papers | Published, cite | 1996–2013 vintage — flag dated | ✅ in this doc |
| Metro fare/speed/frequency | DMRC fare chart, annual report; GTFS feed (dmrc-rs crate) | Public, free | Fare: Aug-2025 revision; GTFS: calendar in feed | ✅ GTFS shipped (`transit_real.py`) |
| Bus fare/free-travel rule | Transport Dept + DTC + Oct-2026 Gazette | Public, free | On notification | 🆕 static constant |
| Auto/taxi regulated fares | Transport Dept notification 9-Jan-2023 | Public, free | Last revised 2023 | 🆕 static constant |
| Bus live positions (probe) | Delhi OTD GTFS-RT `VehiclePositions.pb` | Key on request; open-data intent | Real-time | 🆕 **key owed — highest-leverage action for the time axis** |
| Crash-prone zones (black spots) | DTP Crash Report 2021 + annual top-10 lists + TRiPC IIT-D audited coords | Public reports, free | Annual (list refreshes ~Jan–Feb) | ✅ shipped (`blackspots.py`, 100+ zones) |
| National/state crash stats | MoRTH *Road Accidents in India* annual; DTP statistics page | Public PDFs/web | Annual (~Oct following year); DTP page through 2021 | ✅ context numbers in this doc |
| Crash micro-data (FIR-level) | eDAR/iRAD (irad.parivahan.gov.in) | **Govt role-based login only — no public API/extract** | Continuous entry | ❌ not accessible; use published aggregates |
| MoRTH black-spot MIS | blackspot.morth.gov.in + dataful mirror | Public-ish; mirror CSV free | Updated episodically | 🆕 mirror usable |
| City congestion stats | TomTom Traffic Index (web) | Free web stats, cite TomTom | Annual (Jan) | ✅ citeable stats |
| Live traffic speeds | TomTom API ($0.75/1k, 2.5k free/day); HERE (~30k/mo free); Google Routes ($5–10/1k) | Commercial license — display OK, **derived-data resale needs explicit terms** | Real-time | ⚠️ free tier demo-scale only; license audit before B2G use |
| Corridor speeds (ours) | User traversals → per-cell speed distributions | Own data, privacy rules apply (k≥3) | Continuous, density-limited | ⚠️ cold-start — seed + GTFS-RT |
| Fire pixels | NASA FIRMS VIIRS/MODIS | Free MAP_KEY | NRT ~3h; **misses post-15:00 burns** | ✅ module ready (docs/23) |
| Stubble share of PM2.5 | IITM DSS (portal currently unreachable — docs/25) | Public bulletin when up | Daily in season | ⚠️ use published values + fire surrogate, labeled |
| Ventilation/BLH | Open-Meteo BLH + wind profile | CC-BY 4.0, free ≤10k/day non-commercial | Hourly | ✅ in `/depart` |
| GRAP schedule + declarations | CAQM orders (caqm.nic.in) | Public, free | Stage orders as invoked | ✅ equivalent-stage shipped; official feed none |
| Metro ridership/context | DMRC annual reports | Public PDF | Annual | ✅ context |
| Fleet fuel mix | TRUE/ICCT remote sensing 2024; VAHAN/DES | Published reports | Periodic | ✅ docs/32 |

Legend: ✅ integrated or citation-locked · 🆕 available, not yet wired ·
⚠️ usable with named caveats · ❌ not accessible to us

**Single highest-value actions from this map:** (1) request the OTD
GTFS-RT key — 7,000 buses become our speed probe overnight; (2) refresh
`blackspots.py` each January when DTP's annual list drops (mechanical,
keeps the layer official); (3) log per-traversal speed samples now so the
corridor product accumulates history before the first government
conversation.
