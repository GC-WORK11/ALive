# docs/gov/local/09 — Failure honesty: what breaks, what we say, what we refuse

*Skeptical review deliverable. The expansion — user segregation,
emission estimates, congestion models, government-facing aggregates —
turns ALive from a personal dose advisor into a system that influences
other people's trips and feeds a customer with enforcement powers.
Every honesty mechanism we have today (freshness labels, σ bands, opt-in
telemetry, k-thresholds) was designed for single-trip estimates. This doc
enumerates how each new layer fails, sets the refusal thresholds, and ends
with the red-team checklist we run before any government demo.*

*Rule inherited from docs/05 and docs/26, unchanged: if we can't
validate it, we label it; if we can't label it honestly, we cut it.
New clause for the expansion: if a feature only works at a scale we
don't have, it ships inert — and the UI says so.*

Sister docs: 05 (validation), 26 (claims kill list), 30 (live-tracking
physics), 31 (dual-objective routing), 32 (fleet ground truth),
privacy/data-flow (the ingest pipeline this all sits on).

---

## 0. Verdict up front

1. **This is a category change, not a feature.** A recommender fails
   privately — one user, one bad suggestion, they ignore it. An
   assignment engine fails *correlated*: the same wrong field, the same
   wrong congestion read, the same wrong incentive steers everyone at
   once. All honesty machinery below exists to manage correlation.
2. **The floor we protect is "no worse than selfish routing."** The
   upside of assignment is bounded (price-of-anarchy ≈ ≤4/3 on linear
   latency — at best a ~25% system win, realistically low single
   digits, docs/31 §5). The downside of a confidently wrong coordinated
   push has no equivalent floor. That asymmetry — small prize, real
   downside — is the entire design argument for refusal gates.
3. **Our privacy architecture makes manipulation cheap.** No accounts,
   rotating UUIDv4 tokens hashed to sha256[:16], raw trajectories
   discarded at ingest. Today's stakes: a corrupted corridor cell.
   Post-expansion stakes: fake probes divert real people's real
   commutes. Token diversity, not token identity, is the defence.
4. **The government platform inverts the threat model.** Today we
   protect users *from us*. On the gov side, the customer is the
   potential attacker — aggregates get repurposed for surveillance and
   enforcement. The only durable defence is resolution we technically
   cannot serve, plus a written "what this data can't do" shipped with
   every export.
5. **Below the adoption floor, the honest product is a smaller
   product.** At <1% of corridor flow, our "congestion estimate" is a
   biased sample of volunteers. The refusal threshold is
   decision-relevance: *when the uncertainty band is wider than the
   difference the number would decide, we show nothing.*

---

## 1. The failure surface changes shape

| Layer | Today (dose app) | After expansion |
|---|---|---|
| Field model error | One user gets a wrong band; harm bounded by one trip | Correlated — every assignment inherits the same wrong field; the fleet is steered by one error |
| Stale data | "data N min old" badge; user discounts it | Stale congestion → assignments against a world that no longer exists — and the assignment itself *changes* that world (self-invalidating observation) |
| Thin telemetry | Corridor cell hidden below k≥3 | Model emits noise as signal; <1% penetration means observed flow ≠ flow |
| Bad recommendation | User ignores it; personal cost | Our suggestion diverts *other* people's trips — a third-party externality we now own |
| A user harmed | Support problem | A *cohort* harmed — if we segregate users and one cohort eats the bad assignment, that's a fairness event, not a bug |

The sentence to keep on the wall: **advice can be wrong politely;
allocation cannot.**

---

## 2. Failure mode — the model is wrong and everyone follows it

### 2.1 How assignment goes worse-than-selfish

- **Flash-herding (coordinated overshoot).** We observe a free
  corridor, push N users onto it, and *create* the jam we were
  avoiding. The observation expires the instant we act on it. This is
  the documented failure of every naive traffic-advice system — the
  municipal backlash against Waze/Google reroutes (Leonia, NJ
  restricted side streets in 2018; LA neighborhoods lobbied for years)
  is what "the system answered back" looks like.
- **Phantom jams.** GNSS canyon error is measured, not hypothetical:
  ~13 m horizontal RMSE, 400 m teleports, minutes of dead pings in
  Delhi geometry (docs/30 §2). A few devices dwelling near a highway
  cell — parked riders, chai stops, a garage — read as "congestion."
  One spoofed or lazy cluster diverts everyone off a road that is fine.
- **Feedback blindness.** Traversals feed the estimate; assignments
  change the traversals. Roads we deprioritize get fewer probes → the
  model's picture of them goes stale or collapses → we deprioritize
  them harder. The model trains on its own output and cannot see the
  roads it stopped sending people down. This is the explore/exploit
  hole, and it *never announces itself* — it presents as confidence.
- **The exposure externality at system scale.** Zhao-2024 (docs/31
  §1.3): fuel-aware routing pushed traffic onto local streets and
  *increased residents' exposure*. Our quieter-road lever has the same
  moral hazard. At app scale it's a caveat; at assignment scale we
  become the mechanism that exports dose to people who never opened
  the app.

### 2.2 Honesty boundaries for the routing layer

- **Fractional, never total.** A corridor suggestion may take only a
  share of simultaneous demand — deterministic split (e.g., nth-token
  hashing) so two identical requests can honestly get different
  options. "Everyone sent somewhere" is the failure we're designing
  against; the fix is built into the assignment, not bolted on.
- **Cap what one estimate can move.** No single congestion read may
  divert more than a configured fraction of corridor throughput
  (proposed: ≤10–15% until the model has a published replay record —
  §6). Quota is a *trust budget*, earned per corridor.
- **Disclose the cohort.** If user segregation means cohort A gets
  corridor 1 and cohort B gets corridor 2, the user-facing line must
  say which logic applied. An engine that sacrifices one user's
  optimum for the system's — silently — has stopped recommending and
  started levying. **A levy must be disclosed.** If a user would have
  done better under selfish choice, the receipt must show it.
- **The regret metric.** Offline replay, per corridor: would following
  our suggestions, given realized speeds, have beaten the free-choice
  median? Publish that number when N suffices; refuse to claim
  "flow-aware" on corridors where it doesn't. This is the same
  discipline docs/05 applies to the air field — a model that can't
  beat its baseline is cut, not shipped.

---

## 3. Failure mode — manipulation and adversarial trips

### 3.1 Why we're soft

The privacy pipeline (docs/privacy/data-flow.md) is deliberately
identity-free: token = UUIDv4, rotated ~30 days, stored only as
sha256[:16]. That is the correct privacy design — and it means a fresh
"user" costs nothing. Pre-expansion, a Sybil corrupts a corridor cell.
Post-expansion, a Sybil **diverts real people**: a fleet operator
protecting its drivers' corridor, a business wanting traffic routed
past (or away from) its street, a resident who wants cars off their
road. The motive already exists in the literature of this failure —
Weckert's handcart of 99 phones painted a virtual jam on Google Maps
in 2020; delivery platforms deal with GPS spoofing as routine fraud.

### 3.2 Attack shapes we must survive

| Attack | Mechanism | What it buys the attacker |
|---|---|---|
| Sybil probes | Minted tokens upload fabricated slow traversals on corridor A | A marked "congested", real users diverted to B |
| Adversarial trips | Real phones, real GPS — driven deliberately slowly, or dwelt near a target cell | Same as above; passes all raw-data checks |
| Stationary cluster | Devices parked on/near a corridor cell (garage, depot, drivers' stand) | Phantom jam, zero intent required — this one happens *accidentally* |
| Selective opt-in | Volunteers report only where they want the map shaped | Systematic coverage bias that looks like signal |
| Goodhart decay | Once "slow traversals = congestion" is known, the metric is gamed by whoever it affects | The signal dies as the product succeeds |

### 3.3 Defences that don't break privacy

- **Token tenure weighting.** A token that has donated plausible trips
  for weeks weighs more than one minted this morning. Tenure is a
  count of past donations — not identity; it survives the privacy
  model intact. (Rotation weakens it: cap tenure at the 30-day
  rotation window and say so.)
- **Plausibility gates at ingest.** Speed vs road class, teleport
  rejection, dwell-vs-classified-road checks. The pipeline already
  trims/thins/rounds; it does not yet *distrust*. Add reject
  accounting — `% donations rejected` is itself an honest
  data-quality metric for the admin/gov side.
- **Single-source dominance cap.** If one token supplies >~30% of a
  cell's reports in a window, the cell is excluded from flow estimates
  regardless of count. k≥3 counts *distinct tokens*; it says nothing
  about *balance* — fix that.
- **Corroboration before consequence.** A congestion state that will
  change real suggestions needs either ≥N independent tokens across
  ≥2 time bins, or agreement with an outside feed (TomTom free-tier
  budget, OTD bus speeds — buses are ungameable probes that already
  exist). One app's phones alone do not get to move other people's
  commutes.
- **Accuse nothing.** Flags log to admin as "data quality watch." We
  never label a user a spoofer — false positives are real people with
  bad GPS, and the accusation is itself an unprovable claim (docs/26
  logic applied to our own telemetry).

---

## 4. Failure mode — government misuse

The customer on this side can compel. Honest-by-design has to mean
*honest about what the data enables*, not just how it's made.

### 4.1 Aggregates are surveillance with extra steps

- **k-anonymity protects counts, not patterns.** Our cell gate
  (≥3 tokens/72 h) stops small-numbers publication. It does not stop
  re-identification through time-slicing: hourly corridor sequences
  through a sensitive area (a clinic, a protest route, a religious
  site during a festival) reconstruct movement from "anonymous"
  counters. The NYC TLC medallion dump was "anonymized" hashes too —
  reversed trivially in 2014. Strava's *aggregate* heatmap exposed
  military patrol routes in 2018. Aggregates leak exactly what their
  finest resolution permits; **resolution is the policy decision.**
- **The enforcement repurpose is automatic.** A "worst-exposure
  corridors" layer is also a "where the autos/2Ws run" layer —
  docs/32 §3 already established that the heaviest dosers are gig
  riders, auto drivers, street-level workers. Hand an enforcement
  agency a fine-resolution map of where those vehicles concentrate
  and you've built a crackdown targeting tool whether you intended
  it or not. The same tile that justifies a bus route justifies a
  sweep.
- **Purpose creep is the default, not the exception.** Germany's Luca
  check-in app — built for contact tracing — was dipped into by
  police within months; the scandal wasn't the access, it was that
  the access was *possible*. Assume every export we ship will
  eventually be asked to do the worst thing its resolution allows.

### 4.2 The segregation problem at platform scale

If the engine ever optimizes system outcomes over individual dose —
send cohort B the longer way so corridor totals work — then *some
users are assigned to breathe more so others breathe less.* At app
scale that's a routing decision; exported to government aggregates it
becomes visible policy: which neighborhoods absorb the traffic, the
dose, the noise. The honest requirements:

- cohort assignment must be **random, disclosed, and
  distribution-audited** — publish the distributional outcome (who
  got worse suggestions), not just the mean saving;
- never segregate by anything correlated with power (device class,
  payment, compliance history, geography) — that's an
  environmental-justice landmine *inside our own product*;
- if the distribution audit shows a cohort systematically eating
  worse outcomes, the segregation mechanism is broken, not
  unlucky.

### 4.3 Boundaries for the gov-facing product

| Boundary | Rule |
|---|---|
| Export resolution | Coarser than user-facing, always: ward/res-7-scale or coarser, **≥24 h minimum time window** for anything leaving the building. Live corridor feeds to a government are a tracking tool — refuse |
| Export k-floor | k≥3 is for *display inside our own UI*. Anything exported needs a much larger floor (≥25 contributors/aggregate, or calibrated differential-privacy noise) — the number is set by re-identification risk, not by what looks nice |
| Technical impossibility > policy | The durable guarantee is data we don't hold: raw trajectories die at ingest today (privacy/data-flow §invariant) and stay dead. No flag, no "enforcement mode", no debug endpoint that re-materialises them |
| Sharing ledger | A public log of what was exported, to whom, at what resolution, when. Apple's transparency-report shape. If we can't log it, we can't ship it |
| The disclaimer ships with the data | Every export carries "what this cannot be used for" — probe-sample bias, coverage map, suppression rules, and the explicit no-enforcement-use line — as part of the deliverable, not buried in terms |

---

## 5. Failure mode — low adoption: when the honest answer is silence

### 5.1 The arithmetic we can't spin

Delhi runs ~15–17M motorized trips/day (DIMTS, docs/32 §3.1). Probe
share:

| Our scale | Trips/day we see | Share of Delhi flow |
|---|---|---|
| 1,000 DAU × 2 trips | ~2,000 | ~0.01% |
| 10,000 DAU | ~20,000 | ~0.1% |
| 100,000 DAU | ~200,000 | ~1% |
| ~1M *daily actives* (not installs — installs are not trips) | ~2,000,000 | ~12% — *here* quotas bind |

Below ~1% the "congestion estimate" is a *sample of volunteers* — and
a biased one: our users own smartphones, opt in to telemetry, care
about air quality, plausibly cluster on certain corridors and income
bands. That bias is systematic, not random; widening σ doesn't fix a
sample that's wrong on purpose.

### 5.2 Refusal thresholds (proposed floors — calibrate before ship)

| Probes crossing a corridor (distinct tokens, rolling hour) | What we may show | What we refuse |
|---|---|---|
| <3 | Nothing — cell hidden (existing k-rule) | No congestion colour, no assignment, no "clear" |
| 3–10 | "Few reports" qualitative text only | No travel-time number, no congested/clear label |
| 10–50 | Flow-anomaly vs free-flow baseline, wide band, labeled "probe estimate" | No assignment authority; user-level alternatives only |
| 50+ sustained across days + days-of-week | Corridor-level suggestion eligibility, capped split | City-scale claims — refused at every tier |

Three cross-cutting refusals:

- **Decision-relevance gate.** If the congestion band is wider than
  the gap it would decide between two options, show "similar", not a
  false ranking. The number only exists if it can change the
  decision.
- **Coverage-shape gate.** If the probe map is 90% one corridor type
  or one part of the city, say "we see these roads" — never render
  the unobserved as empty. Absence of reports ≠ absence of traffic;
  the empty cell must *look* like no-data, not like free-flow.
- **Event-day gate.** GRAP III/IV restrictions, odd-even, Diwali,
  farmer-march days: historical priors are invalid and probe mix
  shifts weirdly. Realized-vs-prior divergence >2σ across ≥K
  corridors trips the same refusal automatically (§7).

### 5.3 What the UI says instead

Honest degradation is a *product surface*, designed like one:

- thin probes → "not enough travellers reporting here to read traffic
  — showing the usual pattern"
- biased coverage → "we mostly see main roads today — side streets
  unmeasured"
- event day → "today is unusual — estimates wider than normal"
- never: a clean empty map that reads as "all clear."

---

## 6. The scale paradox — quotas that only matter at a scale we may never reach

Assignment quotas exist to stop us breaking a corridor — they bind
only when we steer a meaningful share of flow. The eco-routing
literature's own numbers: network-level savings scale with
penetration (Ahn & Rakha 2013, 3.3–9.3%; the SLC macro-sim put
Google-scale traffic-aware routing at ~1.7% CO₂ / 6.5% time
*fleetwide* — docs/30 §5, docs/31 §1). At our realistic penetration
(~0.01–1%), no quota will ever bind. So:

- **Inert-by-default is the spec.** Quota machinery ships behind the
  penetration gates of §5 — dormant paths that cannot misfire, with
  tests asserting the inert path at current volumes. Dead code that
  can activate accidentally is worse than no code.
- **The gate measures, not assumes.** Penetration = server-counted
  probes ÷ corridor throughput estimate (OSM road class × published
  capacity). A config flag someone flips for a demo is how honest
  systems get caught lying.
- **Authority is re-earned per tier.** A congestion model validated
  at 0.1% penetration is *not* validated at 20% — at 20% the system
  responds to us, the self-referential loop tightens, and the model's
  assumptions break. Each tier re-runs the regret replay before the
  next authority level unlocks.
- **The honest marketing line and the engineering invariant are the
  same sentence:** "flow-aware when we can prove it, dose-aware
  always." If the product can't say which mode it's in, it isn't
  honest — it's marketing.

---

## 7. Claim creep — the evidence ladder for the new surface

Expansion multiplies claims faster than it multiplies evidence. Every
claim sits at a tier (docs/26 structure); below its tier it dies.

| Claim someone will want to make | Minimum evidence | Status |
|---|---|---|
| "ALive users breathe less on this trip" | Tier 1 — /compare reproducible | ✅ shipping |
| "ALive estimates corridor flow from probe speeds" | Tier 2 — method + declared inputs, "probe estimate" label | Only above §5 floor |
| "ALive saved you time vs not following" | Counterfactual required: same-O-D realized times vs rejected options | Replay metric only; per corridor, N-gated |
| "ALive saves fuel" | Google-standard: modelled vs declared counterfactual, band, per-trip | Tier 2 max; never a city total (docs/31 §4) |
| "ALive reduces congestion" | ≥10–20% penetration + before/after vs control corridors (diff-in-diff, the A-PAG pattern docs/26 §3.2 cites) | Kill until measured |
| "ALive reduces accidents" | Multi-year intervention study — even Google doesn't claim this. MoRTH black-spot data may appear as *context*, never outcome | Kill list |
| "ALive data helps government plan" | Tier 3 mechanism: cite Green Delhi complaint-resolution precedent, Breathe London's ULEZ-evaluation role | Allowed, mechanism-only |
| "ALive reduced Delhi's emissions" | docs/26 kill list; even heroic adoption ≈ ~0.2–0.3% of Delhi PM2.5 (docs/31 §4.2) | Kill list — ceiling framing only |
| "ALive balances traffic fairly" | Distribution audit §4.2 published alongside the claim | Earned per release, not asserted |

Claim-creep tripwires: any new screen gets a row in the claims ledger
(docs/plan/10) before merge; grep every deck for "reduces", "saves",
"proves", "real-time", "balances" — each hit needs a validation
artifact or it's cut. The word "real-time" is banned for anything
derived from a 15-minute field TTL (docs/30 already settled this).

---

## 8. The kill switches — what turns itself off

Every layer degrades **on data, not on someone noticing.** A gate a
human must trip stays open through exactly the demo where it matters.

| Signal | Threshold | What turns off | What the UI says instead |
|---|---|---|---|
| Station freshness | <80% stations <90 min old (existing) | Field σ widens; dose bands widen | "readings running thin — showing a wider range" |
| Corridor coverage | <3 distinct tokens/h | Cell hidden from corridor + flow layers | cell shows nothing (existing) — not "clear" |
| Single-token dominance | one token >~30% of a cell's reports | Cell excluded from flow estimate | nothing user-facing; admin data-quality line |
| Plausibility rejects | >5% donations rejected/h | Affected cells frozen; data-quality event logged | admin: "ingest quality watch" — no accusations |
| Congestion model σ | band wider than the decision gap | Assignment reverts to dose-ranking only | "ranked by air, not traffic — we can't read the roads well enough" |
| Regret replay | assigned flow underperforms free-choice median on a corridor | Assignment authority suspended on that corridor | "routing by your air" — logged internally, reviewed before re-arm |
| Event-day divergence | realized vs prior >2σ on ≥K corridors | Congestion layer → free-flow priors + widened bands | "unusual traffic today — extra uncertain" |
| Export floor | <25 contributors in any aggregate | Row suppressed from export entirely | export shows "suppressed — small sample", never the number |

The unifying principle: **the degraded state is a feature
description, not an error.** "Not enough data" rendered honestly
builds more trust than a confident wrong number — it is the same
trick the freshness badge already performs, extended to the new
surface.

---

## 9. The honest one-pager — measured vs estimated vs outside

Every number on every surface — consumer, admin, government export —
carries exactly one of three labels. Ships as a one-pager inside
every government packet; the minister's dashboard is not exempt.

| Label | Means | Examples | Proof |
|---|---|---|---|
| **ALive measured** | Counted by our systems from donated aggregates | trips logged, km by mode, corridor cell counts (≥k), field MAE vs stations, station freshness %, our own latency/uptime | server-countable; auditable on request |
| **ALive estimated** | Our model on measured inputs, band attached | trip dose µg, field between stations (krige σ), avoided-dose ledger, corridor flow anomaly, congestion surcharge vs free-flow | method doc + published validation |
| **Outside data** | Published by someone else, cited | CAAQMS/WAQI readings, mode dose ratios (Delhi studies), fleet emission factors (ARAI/WRI), TomTom congestion index, OTD/DMRC transit data, GRAP stages | citation + licence on the number |

Hard rules: never blend labels ("measured congestion" when it's
probe-estimated); "your phone measured" is banned (docs/26 kill list —
the phone traverses a field); outside data is quoted with its own
uncertainty, not laundered into ours.

---

## 10. The pre-demo red-team checklist

Run before **any** government demo, every time. Any unchecked box =
the demo isn't ready, not the checklist.

**Model & routing**
- [ ] Replay last 7 days of suggestions vs realized speeds: how often
      did we beat the free-choice median? If we can't answer with a
      number, don't demo assignment — demo dose.
- [ ] Find the thinnest-probed corridor still showing a congestion
      state. Is its "few reports" label visible *in the demo build*?
- [ ] Simulate the field feed going stale mid-demo: does every
      dependent number degrade and label, or does anything keep its
      precision? Walk the surfaces and look.
- [ ] Herd test: fire 200 simultaneous identical O-D requests. Do
      suggestions split across corridors, or does everyone get sent
      the same way? Show the split.

**Adversarial**
- [ ] Mint 5 fresh tokens, upload synthetic slow traversals on one
      corridor. Does the cell change state? (It must not, below
      diversity floors.)
- [ ] Upload a physically impossible trip (200 km/h on Ring Road,
      teleports). Rejected? Logged? Visible in admin?
- [ ] One token supplies 40% of a cell's reports. Excluded? Flagged?
- [ ] Park 3 devices stationary on a corridor cell for an hour.
      Phantom jam or filtered?

**Government-facing**
- [ ] Print the dashboard. For every number, say its label —
      measured / estimated / outside — out loud. Anything
      unclassifiable gets a label or gets cut.
- [ ] Can any export be time-sliced below 24 h at corridor
      resolution? If yes: explain why that's not a tracking tool —
      or coarsen it before the demo.
- [ ] Hostile reading: hand the dashboard to someone outside the
      team. "How would you use this against a neighborhood?" Every
      answer becomes a design change or a written refusal.
- [ ] Read the export's "what this data can't do" section aloud. If
      there isn't one, stop.
- [ ] Confirm the demo's language matches the penetration tier we're
      *actually at*. "Flow-aware" while the floors say
      "flow-observing" is the exact lie this doc exists to prevent.
- [ ] Kill-list sweep: grep deck + script for *reduces, saves,
      proves, predicts, real-time, balances, optimizes*. Every hit
      needs a claims-ledger row and a validation artifact.
- [ ] Segregation disclosure: if cohorts exist, does the receipt say
      which logic applied to *this* user? Show one.
- [ ] Rehearse the worst question — "what happens when you're
      wrong?" — and answer it with §8's table, live, not with
      reassurance.
- [ ] Confirm the sharing ledger entry for the demo data exists and
      is public-consistent.

---

## 11. Precedents and sources

- **Assignment gone wrong**: Roughgarden–Tardos price-of-anarchy
  bounds (≤4/3 linear latency — the *cap* on our upside); Braess-type
  paradoxes incl. the eco-routing version (arXiv 2207.13698, docs/31
  §4.2 — total emissions *rise* under selfish eco-routing); municipal
  backlash to app reroutes (Leonia NJ 2018; LA Waze neighborhoods);
  Zhao et al. 2024 exposure export (docs/31 §1.3).
- **Manipulation**: Weckert, *Google Maps Hacks* (99 phones, virtual
  jam, Feb 2020); delivery-platform GPS-spoofing as routine fraud;
  Goodhart's law — the probe signal degrades precisely when it becomes
  load-bearing.
- **Aggregate leakage**: NYC TLC medallion de-anonymization (2014);
  Strava heatmap exposing military patrol routes (2018); Luca app
  police access (Germany, 2022) — purpose creep as default.
- **Penetration math**: DIMTS travel-demand model — 15.1M → 17.4M
  motorized trips/day (docs/32 §3.1); Ahn & Rakha 2013 + SLC macro-sim
  magnitudes (docs/30 §5).
- **Internal**: docs/05 (validation rule + failure table), docs/26
  (tiers + kill list), docs/30 §8 (honest spec cadence), docs/31 §4–5
  (aggregate claims, ε-constraint selection), docs/32 §3 (occupational
  exposure = who the aggregates describe), docs/privacy/data-flow.md
  (the ingest invariants all of this inherits).
