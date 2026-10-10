# 02 · Congestion model — corridor speed, flow, and reliability from sparse probes

*Sibling memo of `10-synthesis-skeleton.md`. Owns: how corridor state —
the speed proxy, traversal density, penetration estimate, reliability band,
and queue flags of the skeleton's §2 diagram — is estimated, at what sample
sizes it becomes "measured," how heterogeneous sources fuse, and how the
system avoids grading its own homework. Reads from: donated traversals
(`community.observe` → `v2/trip`), GTFS-RT bus positions (key owed, 08),
published counts and congestion indices, the free-flow graph
(`routegraph.py`, `routing_local.py`). Writes to: 01 (assignment math —
the load term), 03 (emissions basis), 04 (gov surfaces), 05 (cadence).*

*Claim tags throughout: **[V]** verified against a cited doc/paper or our
own code · **[I]** inferred / modeled from cited inputs · **[C]**
arithmetic on verified inputs.*

Downstream contract, per the owner's scoring order — the consumer-facing
score is **₹ fuel saved → time/reliability → safety**, with dose
internalized under the hood. This model feeds the score at three points:
the **time term** directly (corridor speed + reliability → ETA band on
every `/v2/plan` option), the **₹ term** indirectly (corridor speed is
the dominant input to 03's speed-dependent fuel/emission basis), and the
**load term** (corridor flow estimate + our attributable share of it →
01's marginal-system-cost and budget-consumption math). It also quietly
corrects dose: time-in-cell is a dose factor, and a queued traversal
breathes a cell for longer.

---

## 0. Verdict up front

1. **We measure speed years before we measure flow.** Traversals yield
   corridor space-mean speed cheaply and defensibly; total flow needs a
   denominator our sensors don't produce — published counts scaled by a
   time profile, or nothing. The penetration estimator (§2.4, §6.2) is
   honest about this: a labeled band whose lower bound, not its point,
   gates every quota decision (D8). **[C]**
2. **The skeleton's P1 density gate is well-posed, and that is a
   coincidence worth noticing.** ≥30 traversals per peak corridor-hour
   estimates mean corridor speed to ±15% at 95% exactly when the
   coefficient of variation is ≈0.4 — the measured CV of a congested
   signalized arterial. The gate was not derived that way, but the
   sampling equation says it is the right number. **[C — §2.2]**
3. **The two P1 gates jointly constrain corridor choice.** 30
   traversals/hour *and* ≥3% penetration lower bound together imply the
   pilot set should prefer corridors under ~1,000 veh/h two-way peak —
   or admit higher adoption. Flagged for 08's enumeration; not a problem
   to solve by relaxing the estimator. **[C — §2.4]**
4. **Fusion is precision-weighting with a clock.** Every source —
   probes, buses, external feed, hour-of-week climatology — is an
   estimate with a variance that inflates with age; the posterior is a
   weighted mean, and the Kalman recursion is the same algebra run
   sequentially (Okutani–Stephanedes 1984 lineage). Nothing fancier
   survives sparse data honestly. **[V]/[C — §4]**
5. **Circularity is a design constraint, not a footnote.** Once λ>0 our
   advisories move real flow; our own traversals then measure a system
   we perturbed. The mitigations are structural — GTFS-RT buses as the
   exogenous control stream, an endogeneity flag at >2% attributable
   share, ε-exploration on unchosen corridors, and every advisory
   logging its predicted counterfactual — not statistical heroics.
   **[I — §6]**
6. **Today the system is a prior with ambitions.** 22 all-time donated
   trips, 12 publishable corridors. Everything below is built so that
   when the 30-traversal hour arrives, the machinery is already labeled,
   fused, and audited — and until then every corridor number says
   `estimated` or `prior` on its face. **[V — skeleton ground truth]**

---

## 1. What a traversal measures — and what it can't

The shipped pipeline (`community.py` `observe()`, `v2/trip`) folds each
donated trip — opt-in, trimmed 300 m both ends, thinned to ~100 m,
snapped to ~500 m / H3-8 cells, device token hashed, raw discarded —
into **traversals**: one device's passage through one corridor cell,
carrying an implied mean speed over that cell and a stopped-time
fraction. This is **floating car data (FCD)** in the classical sense —
position/time breadcrumbs from vehicles in the flow — and a poor
relative of **FCD-X** (extended FCD: brake/ABS/wiper/throttle signals
from the CAN bus, BMW/TUM xFCD program ~2004 **[V]**), whose phone-era
equivalent we partially have: GNSS Doppler speed (~0.1–0.4 m/s accurate,
docs/30), accelerometer stop detection, barometric level for the
flyover/underpass ambiguity. **[V — lineage], [I — our equivalence]**

Three properties of the traversal matter for everything below:

- **It is Lagrangian.** A traversal samples the speed *experienced by a
  vehicle moving through* the corridor, not the speed at a point in
  space. Per-cell implied speed is already a space-mean over that cell;
  corridor speed aggregates cells as a length-weighted **harmonic**
  mean — `v_cor = ΣL_i / Σ(L_i/v_i)` — never an arithmetic mean, which
  over-weights fast cells by up to ~10% on mixed corridors. **[C]**
- **It is a sample, biased where it is thin.** Donors self-select
  (they use a dose router — plausibly more congestion-avoidant than the
  fleet), mode-mix skews to whatever carries phones (2W + cars dominate
  Delhi trips — 08), and at <1% penetration a single stalled vehicle is
  a sample, not a measurement. Every estimator below carries the bias
  correction we can compute and admits the one we can't. **[I]**
- **It never counts vehicles.** Speed and stopped-fraction, yes;
  vehicles/hour, no. Flow enters only through an exogenous denominator
  (published counts, §2.4) — which is why "traversal density" appears
  in the state vector as its own honest field rather than being dressed
  up as flow. **[V — the privacy pipeline keeps counts, not flows]**

A second, subtler censoring: a vehicle that bails *before* entering a
queue never registers the queue. Traversals therefore measure queue
tails from the inside and undersample their fronts — the approach-speed
drop on the upstream cell is the observable that catches this (§3.4).

---

## 2. Sparse-probe estimation — sample sizes, not slogans

### 2.1 The one equation that runs the whole section

For corridor mean speed `v̄` from `n` independent traversals with
per-traversal variance `σ_v²`, the relative error at confidence `z` is
`ε = z·CV/√n`, so:

```
n ≥ (z·CV/ε)²        CV = σ_v/v̄ (coefficient of variation of traversal speed)
```

Delhi-relevant regimes, `z=1.96` **[C]**:

| corridor regime | typical CV(v) | n for ±15% | n for ±10% |
|---|---|---|---|
| free-flow arterial | 0.15 | 4 | 9 |
| flowing, mixed modes | 0.25 | 11 | 24 |
| congested signalized | 0.40 | **27** | 62 |
| jam / stop-and-go | 0.60 | 61 | 138 |

**The skeleton's "≥30 traversals per peak corridor-hour" lands on the
CV=0.4 / ±15% cell** — the right requirement for acting on a congested
corridor, and the right honesty boundary for claiming `measured`.

CV itself is state-dependent and must be estimated from the data
(self-calibrating: the same traversals that give `v̄` give `σ_v`) — a
corridor that reports CV 0.6 is telling you it is in jam, which is
already the classification signal of §3. **[C]**

### 2.2 What the literature's penetration numbers actually say

Penetration rate — probe vehicles as a fraction of total flow — is the
industry's currency; the traversal-count form above is the honest
translation for a corridor. The results, faithfully **[V]**:

| study | setting | finding |
|---|---|---|
| Turner & Holdener 1995 (TRR, Houston TRANSTAR) | freeway, real AVI probes | probe vehicles demonstrated feasible for freeway travel time — the field's founding result |
| Srinivasan & Jovanis 1996 (TRR 1537) | urban network, simulation | required probe share rises steeply with link count and congestion — first formal sample-size treatment |
| Chen & Chien 2000 (TRR 1719) | freeway, microscopic sim | ~3–5% penetration gives reliable travel time **in congestion**; free-flow needs *more* — speeds disperse when vehicles are unconstrained, so the variance term bites hardest where traffic looks "fine" |
| Cheu, Xie & Lee 2002 (Comp.-Aided Civ. Inf. Eng. 17) | signalized arterial | arterials need roughly an order of magnitude more probes per link than freeways — signal delay dominates the variance; ~10–30 traversals/link/interval for ±10–15%, matching §2.1's table **[V — direction; exact n modeled]** |
| Comert & Cetin 2009 (EJOR 197) | signalized queue | queue-length estimation error vs probe share quantified; useful estimates at low single-digit penetration, degrading gracefully — the analytic basis for §3.4's queue-tail field |
| Hao & Ban 2015 (TRB 82) | signalized intersection | long-queue estimation from sparse mobile data — the modern version of the same problem |
| industry practice (INRIX/TomTom-era fleets) | mixed | commercial traffic layers operate at single-digit % fleet penetration with massive fusion — the existence proof that §4's architecture is the right shape |

**Read honestly:** freeways are the easy case and Delhi corridors are
the hard case — signalized, mode-mixed, non-lane-disciplined flow where
CV is higher and published penetration minima translate to *more*
traversals per corridor-hour, not fewer. Our own equation, not the
literature's freeway numbers, is the gate. **[I]**

### 2.3 Penetration estimation — the estimator the skeleton owes

`penetration = our traversals / total corridor flow` in the window. The
numerator is counted exactly (per corridor-hour, post k-gate). The
denominator is the problem — we hold no counts. The estimator:

```
p̂_c(t) = n_trav_c(t) / q̂_c(t)
q̂_c(t) = Q_c · φ(hour_of_week) · κ_window
```

- `Q_c` — published directional count for the corridor (CMP/CRRI
  counts, PWD/MCD traffic census, EIA appendices, DIMTS reports — the
  realistic sources for Delhi, enumerated in 08). **[I — availability]**
- `φ` — hour-of-week flow profile (168 bins) built from national/
  Delhi screen-line series where available, else a standard urban
  profile labeled as such. **[I]**
- `κ` — expansion from count duration to corridor-hour.
- Uncertainty by propagation: Q aging ±30%, φ ±20% → report
  `p̂` with a band; **the quota gate acts on the lower bound**
  `n / (Q·φ·κ·(1+δ_hi))` — we only act where we're *sure* we matter
  (skeleton D8). **[C]**

Where no `Q_c` exists at all: capacity bound only — `p̂ < n / (lanes·
saturated_flow·window)` with `saturated_flow ≈ 1800 veh/h/lane`
highway-ideal, less in mixed Delhi flow — an upper bound on
penetration, never an estimate. A corridor with zero donors has **no
penetration estimate** — not `p=0`, *unestimable*; the state is `dark`.
**[C]**

### 2.4 The joint-gate arithmetic (feeds 08's corridor enumeration)

On a corridor carrying Q two-way peak flow, `n=30` traversals/peak-hour
implies naive `p̂ = 30/Q`:

| Q (veh/h) | naive p̂ | vs 3% lower-bound gate |
|---|---|---|
| 500 | 6.0% | passes with band room |
| 1,000 | 3.0% | marginal — band LB likely below |
| 2,000 | 1.5% | fails unless n≈60+/h |

**Pilot corridors under ~1,000 veh/h peak satisfy both P1 gates at the
same adoption level** — a constraint on corridor selection (08), not on
the estimator. Urban arterials at that scale exist in abundance; the
Inner Ring Road is not one of them, and the memo that picks corridors
should know it. **[C]**

---

## 3. Corridor state model

### 3.1 The state vector (per corridor-hour, per direction)

The atomic record (full schema §7):

```
state = {
  v_mean, v_var,            # fused space-mean speed + variance (km/h)
  v_ff,                     # free-flow reference from the graph build
  ratio = v_mean / v_ff,
  tt_q50, tt_q80, tt_q95,   # traversal-time quantiles over the corridor
  class,                    # free | congested | jam (+ class_conf)
  queue_tail_m,             # queue extent from downstream end, if detected
  shock_v,                  # tail regression slope, if ≥3 stop-points
  stopped_frac,             # fraction of traversals with stop events
  n_trav, n_dev,            # counts behind the gate
  flow_hat / flow_band,     # §2.3 — or null where unestimable
  alive_share, endogenous,  # §6 — our attributable fraction + flag
  sources{…}, label, sigma  # per-source estimates + honesty tier
}
```

Corridors and directions come **enumerated from 08's pilot set** —
contiguous ~500 m cells on a named axis (skeleton vocabulary; this memo
invents no geometry). Speed aggregates the corridor's cells
harmonically (§1); `queue_tail_m` is corridor-coordinate, so a planner
reads "the jam reaches 700 m back from Ashram Chowk." **[C]**

### 3.2 Classification — free / congested / jam

On `r = v/v_ff` plus the stopped-probe fraction `s`:

| class | rule | reads as |
|---|---|---|
| `free` | r ≥ 0.65 | graph speeds hold |
| `congested` | 0.35 ≤ r < 0.65 | the Delhi-peak normal case |
| `jam` | r < 0.35 *or* s ≥ 0.5 | stopped vehicles dominate |

The `s` clause exists because speed alone misses queues: a corridor
cell's mean can sit at 12 km/h while half its traversals contain a full
stop — the queue, not slow flow. Kerner's three-phase vocabulary
(free / synchronized / jammed) is the honest antecedent, but the
middle phase is unidentifiable from speeds alone in mixed Delhi flow —
we ship the coarser, defensible split and admit it. **[V — Kerner
2004], [I — our collapse]**

Classification hysteresis (±0.05 band on `r`, 2-tick persistence)
damps label flicker at boundaries — cheap insurance against the
oscillation modes 09 owns. **[I]**

### 3.3 Reliability is a first-class output, not an afterthought

The time term the consumer sees is an ETA **band**, and the band is
the reliability literature's standard furniture **[V — Lomax et al.,
TTI/SHRP2 reliability framework]**:

- **Travel Time Index** `TTI = TT_mean / TT_free` — "today takes 1.9×
  free-flow"; stored alongside `r` (its reciprocal per unit distance).
- **Buffer Index** `BI = (TT_95 − TT_mean)/TT_mean` — the extra time a
  commuter must budget for 95% on-time arrival; this is the number that
  turns "₹ fuel → time → safety" into "leave 12 minutes earlier or this
  corridor eats your buffer."
- **Planning Time Index** `PTI = TT_95 / TT_free` — the full-price view.

Quantiles come from traversal times *within the fused hour*, plus a
variance floor from the climatology bin when n is thin — a corridor
that was measured twice still reports an honest q95 drawn from its
hour-of-week spread, never a two-point quantile pretending to be a
distribution. **[I]** Arterial TT distributions are heavy-tailed and
multi-modal (signal-phase splits); Ramezani & Geroliminis 2012 (TRB)
model them as Markov mixtures — we store quantiles, not a fitted
family, because quantiles don't lie about shape. **[V — cite],
[I — our choice]**

### 3.4 Shockwaves — the queue is a moving object

LWR kinematic-wave theory **[V — Lighthill & Whitham 1955; Richards
1956]**: between traffic states (q₁,k₁) and (q₂,k₂), the boundary
travels at `w = (q₂−q1)/(k₂−k₁)`. Worked Delhi example, per-lane
triangular FD (`k_j`=130 veh/km, capacity 1800 veh/h at 45 km/h →
backward-wave slope `w_f` = 1800/(130−40) = 20 km/h) **[C]**:

- demand state A: q=1400 veh/h, v=40 km/h → k_A=35 veh/km;
- bottleneck B (signal/starved lane): discharges q_B=900 →
  k_B = 130 − 900/20 = 85 veh/km (v_B ≈ 10.6);
- shock speed: (1400−900)/(35−85) = **−10 km/h** — the queue tail
  retreats upstream at ~167 m/min, crossing a 500 m corridor cell in
  ~3 min, reaching ~2.5 km over one 15-min state cadence.

Two consequences that shape the product:

1. **A 15-min state tick cannot chase a shock front** — the tail moves
   ~2.5 km per tick. What we *can* do at cadence: estimate `queue_tail_m`
   per tick from stop-point positions (the tail location is directly
   observable from where traversals' speed collapses), and estimate
   `shock_v` as the regression slope of successive stop-points (≥3
   traversals) — Comert & Cetin's estimator, minus their density
   assumptions we lack. **[V — method], [I — our thin version]**
2. **The queue tail is a safety term.** "Stop traffic 800 m ahead on a
   60 km/h corridor" is exactly the rear-end exposure the owner's
   safety leg cares about — the state record carries it so a surface
   can say it. **[I]**

Queue *discharge* after the bottleneck clears rides the same math with
the sign flipped; recovery detection = `queue_tail_m` returning to 0
with rising `r`, which the classifier turns into `congested`, not
`free`, until speeds actually recover. **[C]**

---

## 4. Fusion — probes + buses + feeds + priors, precision-weighted

### 4.1 Source classes and their error models

Every corridor-hour estimate is a posterior over up to four sources,
each arriving as `(v, var, age, provenance)`:

| source | what it is | variance model | bias correction |
|---|---|---|---|
| **own probes** | traversals this window (§2) | `σ_v²/n` from the data itself | mode-mix reweighting where n allows; self-selection admitted, not fixed |
| **GTFS-RT buses** | OTD bus positions on the corridor's cells (543-route network; key owed — 08) | per-bus σ² over n_bus traversals, + dwell-estimate σ | buses run `v_bus = L/(L/v + Σdwell)` — correct via dwell at known stops, band widened ~×1.15 for dwell σ **[I]** |
| **external feed** | TomTom/HERE flow speeds, or Amazon Routes duration on the corridor's route (client exists, `location_client.py`) | vendor-stated ±error where published, else σ ≈ 4 km/h modeled | D2 decision: **validation, not feed, at P0–P1** — enters fused state only if that decision is revisited; until then it calibrates σ and audits our label |
| **climatology prior** | hour-of-week speed ratio from our own history (168 bins, nightly) | empirical bin σ², floored so a 3-day-old bin can't dominate | none — it IS the prior |
| **graph free-flow** | `v_ff` from build (OSM class/maxspeed) | the prior's prior — used only where history is absent | — |

Bus streams deserve one explicit property: **they are the exogenous
control** — scheduled vehicles we cannot influence (§6.3), with
near-continuous coverage on bus corridors at zero marginal cost. That
is why D2 made them the backbone, and this memo's job is to keep the
fusion honest enough that the backbone carries weight. **[I]**

### 4.2 Staleness inflation — information has a half-life

An estimate `v` at age `Δt` minutes is treated as N(v, σ² + D·Δt) —
random-walk aging, the same trick every traffic-information system
runs implicitly. D is set so information half-life ≈ 25 min in
congested regimes: to halve precision, need D·Δt = σ₀² → with σ₀² = 35
(km/h)², D ≈ 1.4 (km/h)²/min. A 30-min-old bus batch on a jam corridor
carries ~⅓ of its fresh weight — it still counts, correctly, but the
prior re-asserts itself as memory fades. **[C]** Traversal stubs carry
their own timestamps; the 72-h publish window (existing k-gate
contract) is a *disclosure* rule, not a *freshness* rule — state fusion
uses a 90-min rolling window and lets inflation do the forgetting.

### 4.3 The posterior — worked example

Independent sources ⇒ precision-weighted mean (BLUE; identical algebra
to sequential Kalman updates with identity state — §4.4). Ring-Road
corridor, 18:15 peak hour **[C]**:

| source | v (km/h) | var | weight 1/var |
|---|---|---|---|
| climatology prior (12 days in bin) | 24.0 | 16.0 | 0.0625 |
| GTFS-RT buses (n=3, dwell-corrected) | 22.0 | 2.30 | 0.435 |
| own probes (n=2) | 18.5 | 12.5 | 0.080 |
| external snapshot (age 4 min, σ²4.0 → +D·4) | 19.0 | 8.8 | 0.114 |

```
v* = Σwᵢvᵢ/Σwᵢ = (1.50+9.57+1.48+2.16)/0.691 = 21.3 km/h
σ* = √(1/Σwᵢ) = 1.20 km/h   →  95% band ≈ [18.9, 23.7]
v_ff = 40 → r = 0.53 → class = congested, TTI ≈ 1.9
label = blended (probes present but below the n=27 measured gate)
```

Read the weights as the product story: with only 2 own traversals the
buses carry this hour; had the probes been n=30 their weight would be
~0.93 and the buses would audit *us*. The arithmetic doesn't care which
source is "ours" — only the label does. **[C]**

### 4.4 The Kalman framing — what we'd cite, and why we don't need more

The canonical lineage: Okutani & Stephanedes 1984 (TR-B) put Kalman
filtering on traffic prediction; Wang & Papageorgiou 2005 (TR-B 39)
run an EKF over a second-order flow model (METANET-class) for freeway
state; Herrera & Bayen 2010 (TR-B 44) do the probe/Lagrangian version;
Nantes et al. 2016 (TR-C 66) is the urban-corridor fusion closest to
our problem. **[V — all]**

Our implementation is the scalar end of that family: state
`x = log r` (log keeps the ratio positive), random-walk process
`x_t = x_{t−1} + w`, `Q = D·Δt`, observations = §4.1's sources with
their `R`s — the precision-weighted mean above *is* the Kalman
posterior when sources are fused in one tick. A full second-order flow
model (speed + density, à la Wang–Papageorgiou) is deferred on the
record: density is the variable we cannot observe (§1), and fitting a
2-state model to a 1-state observation invites confident fiction.
Revisit if loop-detector or video-count data ever arrives. **[I]**

Temporal propagation between ticks uses the same random-walk prior —
no traffic-flow PDE. Honest version of "the model": the corridor
remembers, decays, and re-priors.

---

## 5. Cold start — the prior ladder and the honesty labels

Cold-start reality (skeleton ground truth): **22 all-time donated
trips, 14 contributors, 12 publishable corridors of 54 tracked.** The
system below is built so every corridor-hour reports *something* —
labeled — from day one:

| rung | source of v̄ | label on the surface |
|---|---|---|
| 0 | graph `v_ff` (OSM class speeds at build) | `prior` — "free-flow reference, not a measurement" |
| 1 | + published aggregates (TomTom index: Delhi 60.2% congestion / 24:28 per 10 km **[V — docs/30]**, hour-of-week public curves) scaled onto `v_ff` | `estimated` |
| 2 | + climatology bins (our own history accumulating nightly; bins warm after ~2 weeks) | `estimated` |
| 3 | + external feed or GTFS-RT buses | `blended` |
| 4 | + own traversals, n ≥ gate (§2.1, CV-adaptive) and k-gate | `measured` |
| — | k-gate fails on a publish surface | `dark` — suppressed, never "0" |

The ladder's two design rules:

1. **Labels are sticky downward.** A corridor with 3 traversals and a
   fresh bus stream is `blended`, full stop — `measured` is reserved
   for the n-gate, because "we measured it ourselves with n=3" is the
   honest-sounding lie this whole architecture exists to prevent.
   Skeleton rule: an unlabeled number is a bug, filed. **[C — policy]**
2. **The prior is allowed to be wrong in public.** Every `estimated`/
   `prior` number carries σ and source; when measured data later
   contradicts a rung (e.g., OSM's 50 km/h on a corridor that has never
   exceeded 30 in our history), the climatology bin absorbs the
   correction nightly — priors are recalibrated by our own accumulated
   measurements, automatically, with drift logged. **[I]**

GTFS-RT deserves emphasis in cold start: **one granted key converts the
bus backbone from `estimated` to `blended` on every bus corridor in the
pilot set** — the single highest-value unblocking item in this memo's
dependency list (skeleton's ask to mentors, restated). **[I]**

---

## 6. Feedback — our assignments change the flows we measure

Once λ>0 (P2) — and sooner, wherever advisories bite — we are no longer
observers. The failure this section guards against is quiet circularity:
we route users off a corridor, the corridor speeds up, our traversals
report the improvement, and the system credits its own advice. Three
instrumentation commitments keep the estimator honest **[I — design]**:

### 6.1 Instrument the delta — every advisory ships its counterfactual

Every quota/advisory logged with `{corridor, t, pred_state_at_issue,
option_offered, user_optimal_cost}`; donated completions tagged
`complied`/`declined` via plan_id. Per corridor-hour we store
`advised_in`, `complied_in`, and compare realized state vs the
issue-time prediction: **the measurement harness for the delta is the
log, not a model.** P2's diff-in-diff (skeleton D10, owned by 09)
consumes this directly. **[C — schema in §7]**

### 6.2 The endogeneity flag — know when we ARE the traffic

`alive_share_c(t) = E[our assigned vehicles on c in window] / q̂_c(t)`
with the numerator from issued plans × measured compliance (itself a
shipped aggregate). Policy:

- `alive_share < 2%` → our traversals are ordinary probes; no flag.
- `≥2%` → `endogenous: true` on the state record: own traversals still
  inform speed (they're real flow), but quota-evaluation and effect
  claims on that corridor use only the exogenous subset — buses,
  external feed, holdout donors — or carry the caveat in the claim.
- `≥10%` → the corridor is a system instrument, not a measurement; the
  load term (01's marginal-cost input) must be recomputed *before*
  advisories issue, because we move the corridor's state ourselves.
  **[I — thresholds; the gate is tunable]**

This is also the penetration estimator's other half: `alive_share` is
to *control share* what `p̂` is to *measurement share* — same
denominator problem (§2.3), different policy use.

### 6.3 The control stream and ε-exploration — keep the unchosen measured

- **Buses don't take our advice.** GTFS-RT vehicles follow schedules on
  corridors we advise on — the standing control stream the diff-in-diff
  design needs; same role for whatever external feed exists. **[I]**
- **ε-exploration:** a small ε of eligible `/v2/plan` requests return a
  randomly sampled near-optimal option (bounded regret, ≤+5% user cost,
  logged `exploration=true`) — the contextual-bandit answer to
  "corridors we never recommend stop being measured." Bounded, logged,
  honest on the receipt. **[I — mechanism; the regret bound is policy]**
- **Holdout donors** (never see advisories — skeleton D10) provide the
  user-level control; the consumer k-gate (k≥3) still protects them.
- **Damping at the cadence:** λ updates ride the 15-min field cycle
  (D1), classification hysteresis (§3.2) plus per-corridor advisory
  caps prevent the advise-all-then-measure-nothing oscillation 09
  owns. **[C — mechanism]**

The blunt version for reviewers: **the estimator treats our own
influence as a pollutant it must measure, not a rounding error it can
ignore** — because at the adoption levels that make the gov product
interesting, it isn't one.

---

## 7. Corridor-state record — concrete schema

DynamoDB `alive108-agg`, same conventions as `agg_ddb.py` (pk/sk
composite, TTL where the record is perishable, counters not trips,
k-gates on publish). Corridor IDs are 08's enumerated set.

```
pk                      sk                 ttl     contents
─────────────────────────────────────────────────────────────────────
cor#<corridor_id>       live               —       fused state (below)
cor#<corridor_id>       clim               —       168 hour-of-week bins:
                                                   {r_p50, r_p80, n_days} 
cor#<corridor_id>       hour#<date>#<HH>   90 d    corridor-hour rollup:
                                                   all state fields +
                                                   advised_in, complied_in
cor#<corridor_id>       obs#<ulid>         7 d     traversal stub ring
                                                   (≤32; below)
cor#<corridor_id>       flow               —       q̂ sources: {Q_c, cite,
                                                   φ_table_ver, κ, band}
meta#traffic            warm_set           —       corridors the fusion
                                                   tick services
```

**`live` item attributes:**

```json
{
  "corridor_id": "ringrd-ashram-bhogal-eb",
  "dir": "EB", "cells": ["872a..", "872b.."],
  "v_mean": 21.3, "sigma": 1.20, "v_var": 25.0,
  "v_ff": 40.0, "r": 0.53,
  "tt_q50_s": 214, "tt_q80_s": 268, "tt_q95_s": 341,
  "tti": 1.88, "bi": 0.59, "pti": 2.99,
  "class": "congested", "class_since_min": 30,
  "queue_tail_m": 700, "shock_v_kmh": -9.8,
  "stopped_frac": 0.31,
  "n_trav": 12, "n_dev": 9, "n_bus": 3,
  "flow_hat": 850, "flow_band": [600, 1100], "flow_src": "cmp2019·φ3",
  "alive_share": 0.014, "endogenous": false,
  "sources": {"probe": {"n":12,"v":19.8,"var":2.1,"age_s":240},
              "bus":   {"n":3,"v":22.0,"var":2.3,"age_s":180},
              "ext":   null,
              "prior": {"v":24.0,"var":16.0}},
  "label": "blended", "k_ok_consumer": true, "k_ok_gov_day": false,
  "updated_at": 1760000000, "fused_at_min_ago": 0
}
```

**`obs#` stub** (the ring the fusion reads; privacy-identical to what
`community.py` already folds — cell-level, hashed-token-only for the
n_dev count, never stored):

```json
{"ts": 1759999850, "cell": "872b..", "v_cell": 14.2,
 "stopped_s": 41, "mode": "car", "advisory": "declined", "exploration": false}
```

Cost note **[C]**: the live item ≈1.5 KB; 54 corridors ⇒ ~80 KB hot,
writes on traversal-events + a 15-min fusion tick on the warm set —
on-demand DynamoDB noise-floor territory. At 5,000 corridors the tick
still costs ≪$0.10/day in WCUs; the binding constraint is traversals,
not storage. The obs ring is a *ring* — cap 32, overwrite oldest —
because raw-history accumulation is both a privacy regression and a
bill.

**Publish tiers** (06's D3 gates, consumed not redefined): consumer
corridor layer k≥3 devices; gov corridor-day k≥10; anything
hourly/public k≥20. `label` and the k-flags are computed at fusion
time, not read time — a reader can never serve an ungated number by
forgetting the check.

---

## 8. Update loop — pseudocode

```python
# ── ingest path: inside community.observe / v2.trip, post-privacy-pipeline
def on_traversal(t):                      # cells already ~500 m, token hashed
    for cell in t.cells:
        cor = CORRIDOR_OF.get(cell)       # 08's enumerated map
        if cor is None: continue
        ddb.put(pk=f"cor#{cor}", sk=f"obs#{ulid()}",
                ttl=7*86400,
                item={"ts": t.ts, "cell": cell, "v_cell": t.v[cell],
                      "stopped_s": t.stopped[cell], "mode": t.mode,
                      "advisory": t.advisory_flag,      # None | complied | declined
                      "exploration": t.exploration})    # §6.3
        ring_push(cor, cap=32)            # evict oldest obs# beyond 32
        WARM_SET.add(cor)

# ── fusion tick: EventBridge 15-min, same cadence as the air field rebuild
def fusion_tick(now):
    for cor in ddb.read("meta#traffic", "warm_set"):
        S     = get(cor, "live")                       # prior fused state
        O     = query_obs(cor, window_s=5400)          # ≤32 stubs, ≤90 min old
        B     = bus_obs(cor, now)                      # GTFS-RT lane (08), dwell-corrected
        E     = ext_snapshot(cor)                      # D2: validation-only at P0–P1
        P     = prior(cor, now)                        # clim bin → v_ff fallback

        post  = fuse(S, O, B, E, P)      # precision-weighted, §4.3
        post  = staleness_inflate(post, now, D=1.4)    # §4.2
        post.class  = classify(post, hysteresis=0.05)  # §3.2
        post.queue  = queue_tail(O, post)              # §3.4 stop-point slope
        post.alive_share, post.endogenous = attribution(cor, now)  # §6.2
        post.label  = honesty_label(post)              # §5 ladder
        post.k_flags= k_check(post)                    # §7 tiers (06)

        put(cor, "live", post)
        if hour_boundary_crossed: put(cor, hour_sk(last_hour), rollup)
        emit_metrics(label_counts, state_age, n_dark)

# ── nightly: climatology + prior maintenance (EventBridge 00:40 IST)
def nightly():
    for cor in tracked_corridors:
        roll hour#* → clim[dow][hour] bins (EWMA, α≈0.25)     # rung-2 prior
        drift_check(clim vs v_ff) → log                       # §5.2
        decay n_days on stale bins

# ── read path: /v2/plan consumes state → time term; 01 consumes → load term
def corridor_speed_for_edges(cor):
    s = get(cor, "live")
    if s.label in ("measured","blended"): return s.v_mean / s.v_ff   # ratio applied to edges
    return None          # prior-only state never reprices the graph —
                         # it IS the graph's existing assumption
```

Two design points the pseudocode encodes deliberately:

- **State writes and reads are decoupled.** `/v2/plan` never triggers a
  fusion; it reads `live` items (or the graph's `v_ff` where state is
  prior-only) — the plan path stays at shipped latency, and a dead
  fusion worker degrades the system to "all `estimated`/`prior`,"
  which is the honest state anyway, not an outage. **[C — degradation
  contract]**
- **The label travels with the number.** `label` and `k_flags` are
  written into the record; 04's surfaces render them verbatim —
  admitted-uncertainty coverage stays a storage property, not a UI
  convention. **[C]**

---

## 9. What this memo does not claim

- **No flow truth.** `flow_hat` is counts×profiles with a band; where
  no count exists the field is null and penetration is unestimable —
  `dark`, not zero. The gov product's speed/dose fields don't depend on
  it; the load term does, and is honest about the band. **[C]**
- **No city-traffic claims.** Corridor state is an NSIM-tier demand
  measurement on enumerated corridors — "the corridor changed like
  this," never "Delhi's traffic improved" (09's kill list, binding).
- **No lane-level truth.** ~500 m cells and mixed-mode flow: we measure
  corridor speed, not lane speeds, ramp splits, or per-vehicle delay.
- **No density.** Queue tails and stopped fractions are observable;
  k (veh/km) and the full fundamental diagram are not, until a counts
  source exists. The two-state flow model stays on the shelf (§4.4).
- **TomTom/HERE/Amazon enter the fusion only if D2 is revisited** — at
  P0–P1 they audit σ and validate labels, they don't feed state.
- **Endogeneity is flagged, not solved.** At ≥2% attributable share we
  mark the record and shift claims to exogenous sources; estimating our
  causal wedge out of endogenous data is 09's diff-in-diff job, not a
  regression coefficient's. **[I]**

---

## References

1. Turner, S., Holdener, D. (1995). *Probe Vehicles as a Source of
   Travel Time Information* — Houston TRANSTAR feasibility. TRB.
2. Srinivasan, K., Jovanis, P. (1996). Determination of number of probe
   vehicles required for reliable travel time measurement in urban
   network. *TRR 1537*.
3. Chen, M., Chien, S. (2000). Determining the number of probe vehicles
   for freeway travel time estimation by microscopic simulation.
   *TRR 1719*, 61–68.
4. Cheu, R., Xie, C., Lee, D.-H. (2002). Probe vehicle population and
   sample size for arterial speed estimation. *Computer-Aided Civil and
   Infrastructure Engineering* 17(1), 53–60.
5. Comert, G., Cetin, M. (2009). Queue length estimation from probe
   vehicle location and the impacts of sample size. *European Journal
   of Operational Research* 197(1).
6. Hao, P., Ban, X. (2015). Long queue estimation for signalized
   intersections using mobile data. *Transportation Research B* 82.
7. Okutani, I., Stephanedes, Y. (1984). Dynamic prediction of traffic
   volume through Kalman filtering theory. *Transportation Research B*
   18(1).
8. Wang, Y., Papageorgiou, M. (2005). Real-time freeway traffic state
   estimation based on extended Kalman filter. *TRB* 39(10).
9. Herrera, J., Bayen, A. (2010). Incorporation of Lagrangian
   measurements in freeway traffic state estimation. *TRB* 44(4).
10. Nantes, A., Ngoduy, D., Bhaskar, A., Miska, M., Chung, E. (2016).
    Real-time traffic state estimation in urban corridors from
    heterogeneous data. *Transportation Research C* 66.
11. El Faouzi, N.-E., Leung, H., Kurian, A. (2011). Data fusion in
    intelligent transportation systems: progress and challenges — a
    survey. *Information Fusion* 12(1).
12. Lighthill, M., Whitham, G. (1955). On kinematic waves II. *Proc. R.
    Soc. A* 229 · Richards, P. (1956). Shock waves on the highway.
    *Operations Research* 4(1) — the LWR model and shock relation.
13. Daganzo, C. (1994). The cell transmission model. *TRB* 28(4) —
    reference discretization if the PDE version is ever revived.
14. Kerner, B. (2004). *The Physics of Traffic* — three-phase theory
    behind the §3.2 collapse.
15. Lomax, T., Margiotta, R., et al. (2003). *Selecting Travel
    Reliability Measures* — TTI/BI/PTI definitions (SHRP2-L34 lineage).
16. Ramezani, M., Geroliminis, N. (2012). Arterial route travel-time
    distribution estimation with Markov chains. *TRB* 227(1).
17. Breitenberger, S., et al. (2004). Extended Floating Car Data —
    the xFCD lineage our phone-sensor subset imitates.
18. Treiber, M., Kesting, A. (2013). *Traffic Flow Dynamics* —
    shockwave/FD conventions used in §3.4.
19. TomTom Traffic Index 2025 — Delhi congestion level 60.2%, 24:28 per
    10 km (validation source per D2; also cited in `docs/30`).
20. Internal: `community.py` (traversal pipeline, k-gates), `agg_ddb.py`
    (DDB conventions), `routegraph.py`/`routing_local.py` (free-flow
    graph, `v_ff` basis), `location_client.py` (Amazon Routes —
    per-request traffic where enabled), `docs/plan/05` (15-min field
    cadence), `docs/30` §5 (Delhi congestion-data market scan).
