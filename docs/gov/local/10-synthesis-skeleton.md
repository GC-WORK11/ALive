# 10 · Synthesis skeleton — the master RFC

*The unifying document for the `docs/gov/local/` memo series. A technical
reviewer reads this first, then descends into whichever sibling memo owns
the claim they want to attack. Nine sibling memos are written in parallel
against this skeleton; where a sibling and this file disagree, the sibling
wins on its own topic and this file gets patched — the skeleton is the
map, not the territory.*

**Sibling memos** (filenames as they should land; fix this table if a memo
ships under a different name):

| file | owns |
|---|---|
| `01-assignment-math.md` | cost function, λ, user-equilibrium vs system-optimal, quota math |
| `02-congestion-model.md` | corridor speed/flow estimation from probes + GTFS-RT + published counts |
| `03-emissions-fuel.md` | fleet-average EF tables, corridor-hour emissions field, fuel basis |
| `04-gov-platform.md` | gov console, planner APIs, data-product surface design |
| `05-realtime-architecture.md` | plumbing: budgets → advisories → devices, cadence, storage, SLOs |
| `06-privacy.md` | k-anonymity tiers, DP trade-offs, re-identification threat model |
| `07-fairness-incentives.md` | who bears the detour, incentive currency, equity audits |
| `08-delhi-factors.md` | GRAP/CAQM hooks, fleet mix, OTD, seasonal physics — Delhi calibration |
| `09-failure-honesty.md` | oscillation, gaming, cold-start, attribution limits, kill list |

---

## 1. Thesis (one paragraph)

ALive today is a **consumer dose router**: it prices every Delhi trip in
inhaled PM2.5 — and secondarily in minutes, rupees, and emitted CO2e/PM —
so a commuter picks the lighter way before leaving. The same machinery is,
with adoption, a **flow-aware mobility platform**: every donated trip is a
trimmed, thinned, k-gated traversal of a real corridor, so the server
accumulates a live, source-labeled estimate of where Delhi actually moves,
at what speed, breathing what, emitting what. That observation layer,
crossed with the cost function that already prices trips, is the
**government planning data product**: not another AQI dashboard, but a
console and API that answer the questions planners actually ask — *which
corridor-hours are worst for lungs and for emissions, what would this
intervention do to them, and did the last one work* — with the same
honesty machinery (measured/modeled/estimated labels, uncertainty bands,
k-thresholds, published error) that is the consumer product's
differentiator. One-sentence version: **we show individuals what a trip
costs their lungs — and in doing so become the only network that measures
Delhi's demand for air, which is the dataset the government needs and
does not have.**

The three acts are load-bearing and sequential — you cannot skip to act
three, because the gov product's only moat is the telemetry the consumer
app earns:

```
consumer dose app ──► flow-aware mobility platform ──► gov planning data product
(/v2/plan, /v2/trip)   (corridor state, quotas, λ)      (console, APIs, evaluation)
      P0 shipped           P1 at adoption threshold        P2 under agreement
```

---

## 2. System architecture overview

Everything below the heavy line **exists today** (shipped, measured —
`docs/plan/NUMBERS.md`); everything above it is what the gov memos design.

```
                        GOVERNMENT-PLANE (read-only at P1, queryable at P2)
 ┌───────────────────────────────────────────────────────────────────────┐
 │  gov console (read-only, P1)  ·  planner APIs (P2)  ·  intervention   │
 │  evaluation (diff-in-diff vs control corridors)          → 04 memo    │
 ├───────────────────────────────────────────────────────────────────────┤
 │  corridor-hour STATE:  speed proxy · traversal density · dose mean ·  │
 │  emissions band · budget consumption % · penetration estimate         │
 │     estimation math → 02 memo   emissions basis → 03 memo             │
 ├───────────────────────────────────────────────────────────────────────┤
 │  assignment layer:  corridor budgets → advisories → plan options;     │
 │  λ ramps 0 → small per-corridor; user cost increase bounded           │
 │     math → 01 memo   plumbing → 05 memo   incentives → 07 memo        │
 ╞═══════════════════ shipped consumer substrate ════════════════════════╡
 │  /v2/plan honest router (dose·time·₹ bands per option, provenance)    │
 │  /v2/trip telemetry opt-in (trim 300 m · thin 100 m · round 4 dp ·    │
 │    H3 res-8 / ~500 m cells · sha256 token · raw discarded)            │
 │  air field: stations + CAMS + fires + met → kriged grid, 15-min, σ    │
 │  routing: self-hosted OSRM (free-flow, no traffic) + GTFS transit     │
 │  aggregates: /community, /v2/city, /admin — k≥3 · 72 h freshness      │
 └───────────────────────────────────────────────────────────────────────┘
        privacy model → 06 memo · delhi calibration → 08 memo
        failure analysis cross-cuts everything → 09 memo
```

### Where each sibling memo plugs in

| memo | plugs into | reads from | writes to |
|---|---|---|---|
| `01-assignment-math` | assignment layer | corridor state (02), EF bands (03), fairness bounds (07) | cost function + λ schedule used by 05 |
| `02-congestion-model` | corridor state, speed/flow | probe traversals, GTFS-RT (key owed), published counts | speed/flow field feeding 01, 03, 04 |
| `03-emissions-fuel` | corridor state, emissions | fleet mix + EFs (08), flow (02) | emissions-per-corridor-hour field feeding 01, 04 |
| `04-gov-platform` | gov-plane surfaces | all of corridor state | console/API spec; what planners can ask |
| `05-realtime-architecture` | plumbing between state and devices | 01's quotas, 02/03's fields | cadence, queues, storage schema, SLOs, degradation |
| `06-privacy` | the k-gates on every arrow marked "publish" | existing pipeline (`trip.py`, `community.py`) | tiered-k spec, DP decision, threat model |
| `07-fairness-incentives` | incentive + equity bounds on 01/04 | quota events (05), corridor demographics (08) | incentive currency spec, per-group fairness audit |
| `08-delhi-factors` | calibration inputs to 02, 03, 04 | OTD/GTFS, GRAP, fleet, season, blackspots | constants + regime flags all other memos cite |
| `09-failure-modes` | red-team layer across all | everything | kill list, oscillation/gaming analysis, honest limits |

### Canonical vocabulary (sibling memos must use these terms)

| term | definition | first defined |
|---|---|---|
| **dose** | estimated inhaled PM2.5 µg for a trip: Σ conc(edge) × mode-microenv factor × ventilation × time | shipped (`server/exposure.py`) |
| **traversal** | one device's passage through one corridor cell, post-privacy-pipeline | shipped (`community.observe`) |
| **corridor** | a contiguous set of ~500 m / H3-8 cells carrying a named traffic axis (e.g. Ring Road–Ashram); enumerated, not inferred | 08 memo enumerates pilot set |
| **corridor-hour** | corridor × clock hour: the atomic unit of state, budgets, and metrics | this file |
| **corridor state** | per corridor-hour: {speed proxy, traversal count, dose mean+band, emissions band, penetration est., source labels} | 02/03 memos |
| **budget** | soft per-corridor-hour cap on emissions (+dose) expressed as % of a rolling baseline; advisory, not legal | 01 memo |
| **quota** | the assignment action when a corridor exceeds budget: eligible users get a lighter alternative proposed with incentive attached | 01/07 memos |
| **λ (lambda)** | weight of the system term in the plan cost function: `cost = user_cost + λ · marginal_system_cost`. λ=0 ⇒ pure user-optimal (today) | 01 memo |
| **penetration** | our share of total corridor flow, estimated with wide bands; gates every quota decision | 02 memo |
| **instrumented corridor** | a corridor whose state is served — requires k≥k_gov devices AND fresh traversals; below that it is *dark*, not zero | this file |
| **admitted-uncertainty coverage** | fraction of served numbers carrying a band + source label; the honesty metric | §5 |
| **NSIM** | EPA's "non-regulatory supplemental monitoring" tier — the legally safe framing for everything we publish to gov | `docs/26-honest-impact.md` §3.3 |

Ground truth today (the cold start, stated plainly — `docs/plan/NUMBERS.md`):
**12 publishable corridors of 54 tracked, 22 all-time donated trips, 14
contributors.** The platform thesis is real; the flow data is not yet.
Every number below is written against that fact, not around it.

---

## 3. Phased rollout

### P0 — today (shipped)

| surface | what it does | honesty posture |
|---|---|---|
| honest router | `/v2/plan` ranks every option by dose band + time + ₹; recommendation is **user-optimal only — λ=0 by construction** | bands + `est.` labels; mode ratios from Delhi studies, not our model |
| telemetry opt-in | `/v2/trip` donates trimmed/thinned/rounded traversals → cell+hour+day aggregates only; raw discarded in-process | no accounts, no PII, k≥3 & 72 h publish gates, opt-out = nothing uploaded |
| corridor tracking | `community.observe` accumulates; `/community` + `/admin` publish only ≥3-device fresh cells | below-k cells are suppressed, and suppression is itself reported |

P0 invariants the platform must never break: λ=0 means no user is ever
sent a worse-for-them route for the system's benefit; the aggregate store
holds counters, never trips; every served number carries its source class.

### P1 — corridor state + quotas at adoption threshold; gov console read-only

**Entry gate (all three, sustained 28 days, on the pilot corridor set
enumerated in 08):**

1. **penetration**: lower bound of the penetration estimate ≥ ~3% of
   corridor flow on ≥ 20 instrumented corridors (02 memo defines the
   estimator; a labeled guess is honest, an unlabeled one is not);
2. **density**: ≥ ~30 traversals per peak corridor-hour on the same set
   (enough that speed/flow bands are narrow enough to act on);
3. **privacy**: gov surfaces pass the tiered-k spec in 06 (k≥10 on
   corridor-day rollups, k≥20 on anything hourly or public).

**What ships:**

- **corridor state** — speed proxy + traversal density per corridor-hour
  (02); emissions per corridor-hour as CO2e tight band + PM fleet band
  (03); each cell labeled measured / modeled / estimated with its source
  mix. GTFS-RT bus speeds (the OTD key is already owed — 08) are the
  speed backbone on the 543-route bus network.
- **soft budgets + quota advisories** — per corridor-hour, budget
  consumption % vs rolling baseline; when an hour exceeds baseline +1σ,
  eligible planning requests (flexible departure/mode, declared
  opt-in) get a lighter alternative with the incentive attached (01 math,
  07 currency). λ stays 0 for the user-optimal option, which is never
  hidden — a quota is an *offered alternative*, not a reroute.
- **read-only gov console** (04) — corridor state map, dose/exposure
  heatmap, budget consumption, data-age and penetration labels on every
  surface; aggregates only; public summary stays at `/v2/city`.
- **measurement harness begins logging** — control-corridor matching and
  user-level holdouts arm now so P2 claims have a baseline (09).

### P2 — real-time assignment, planner APIs, intervention measurement

**Entry gate:** a government counterpart (DPCC / CAQM / Delhi Transport
Dept / MCD) agrees to a pilot on named corridors — because hard claims
about system effect need a partner's ground truth (their counts, their
interventions) to be anything but self-graded homework (09).

**What ships:**

- **λ > 0, per-corridor** — marginal-cost-aware assignment inside
  `/v2/plan` on instrumented corridors only, with a hard bound: never
  propose > +15% time or +10% dose vs user-optimal without opt-in +
  incentive (01 proves the bound; 07 owns who bears it). Async cadence —
  budgets recompute every 15 min on the field rebuild, not per-request.
- **planner APIs** (04) — programmatic corridor state, OD aggregates,
  budget history, "what-if" reads (e.g., modeled effect of a proposed
  restriction at fleet-average EF basis), all k-gated, all labeled.
- **intervention measurement** — diff-in-diff vs matched control
  corridors + holdout users who never see advisories; published
  methodology, claims capped at Tier-2 honesty ("the corridor changed
  like this while controls changed like that") — the A-PAG 35-sensor
  Delhi study (26.6/15.7/15.3% PM2.5 reductions, diff-of-diff) is the
  methodological precedent we cite, not exceed.
- **incentive pilot** — one corridor, one currency, legal sign-off (07).

**What never ships in any phase** (09's kill list, restated so the
skeleton carries it): city-AQI attribution claims, per-vehicle exact
emissions, raw trajectory export at any price, quota-as-punishment
(no degraded service for users who decline), and any unlabeled number.

---

## 4. Decision register

The hard choices, once, with the picked option. Each decision names its
owner memo for the full argument; this table is the contract between them.

| # | decision | options | **pick** | why (one line) |
|---|---|---|---|---|
| D1 | sync vs async assignment | (a) λ inside each `/v2/plan` call, real-time marginal cost; (b) 15-min corridor budgets → advisory layer, per-request stays user-optimal; (c) batch overnight re-planning | **(b) async budgets + user-optimal core** | sync marginal-cost routing needs flow estimates we won't have at P1 scale, and invites oscillation/herding (09); async rides the existing 15-min field cadence, degrades to λ=0 honestly, and keeps the user-optimal option always visible → 01, 05 |
| D2 | probe vs bought traffic | (a) buy TomTom/HERE speed feed; (b) own traversals only; (c) probes + GTFS-RT buses + published counts, fused with source labels | **(c) fused, buy nothing at P0–P1** | bought data can't be redistributed into a gov data product and costs money we don't have; GTFS-RT gives instrumented speeds on 543 routes free; traversals cover where buses don't; TomTom annual index validates, doesn't feed → 02 |
| D3 | k thresholds | (a) keep k≥3/72 h everywhere; (b) raise k uniformly; (c) tiered k by surface sensitivity | **(c) k≥3 consumer corridor layer · k≥10 gov corridor-day · k≥20 anything hourly/public** | a lone 2W commuter on a corridor-hour is an identifiable person; gov surfaces invite motivated re-identification; tiers keep consumer coverage while hardening the gov-facing attack surface. Formal DP deferred — utility loss on small counts; re-examine at P2 → 06 |
| D4 | incentive currency | (a) cash/UPI per reroute; (b) dose-saved + civic ledger framing; (c) perks via gov partner (parking, metro); (d) lottery | **(b) now → (d) one-corridor pilot at P2, never (a)** | cash-per-reroute is gameable in the worst direction — drive the corridor to be paid to leave it (09); dose-saved is already the app's receipt economy and costs ₹0; a lottery is behaviorally strong and cheap but needs the partner's legal sign-off → 07 |
| D5 | what the quota prices | (a) dose corridor-hour cap; (b) emissions corridor-hour cap; (c) speed floor; (d) dual soft budget on dose + emissions vs rolling baseline | **(d) soft dual budget** | hard caps need statutory authority we don't have and ground truth we only estimate; a baseline-relative soft budget is honest, measurable, and still gives planners the signal; speed-floor-only makes us a worse Google → 01, 03 |
| D6 | assignment locus | (a) server-side system term; (b) on-device with pushed corridor state; (c) hybrid | **(a) server-side** | corridor state is server-computed anyway; keeps the privacy model (no per-device assignment state), keeps λ tunable without app-store lag; cached advisories degrade gracefully offline → 05 |
| D7 | gov data access model | (a) open public data dumps; (b) gov-only console; (c) paid API; (d) public aggregates free + gov console free read-only + planner API under agreement | **(d)** | the trust path runs through public auditability (`/v2/city` already does this); data-access asymmetry is a fairness problem and a political liability (07); the monetizable tier is query capacity and evaluation, not exclusive data → 04 |
| D8 | penetration / adoption measurement | (a) ignore it; (b) estimate per corridor with wide bands; (c) wait for gov ground counts | **(b) labeled estimate, quotas gated on its lower bound** | "we affect 3% of flow" is a guess either way — shipping it labeled with the method published is honest; gating quotas on the lower bound means we only act when we're *sure* we matter → 02 |
| D9 | optimization target at λ>0 | (a) min total time; (b) min total dose; (c) min total emissions; (d) dose+emissions, time as bounded constraint | **(d)** | time-optimal competes with Google and produces the send-everyone-down-the-lane failure (09); dose+emissions is where our marginal-cost correction is unique — and it moves mode/departure, not just micro-routes → 01 |
| D10 | intervention attribution | (a) before/after; (b) diff-in-diff vs matched control corridors; (c) randomized holdouts; (d) b+c combined | **(d) combined, claims capped at Tier-2** | before/after confounds with weather (VC swings ±96% daily — 08); matched controls + a no-advisory holdout give an honest causal-ish claim; we cite A-PAG's diff-of-diff precedent and never claim beyond it → 09 |

**Deferred, on record:** formal differential privacy (D3); scooter/2W
OSRM profile (08's fleet says ~90% 2W+cars — the largest uncovered mode);
street-canyon OSPM (needs building heights Delhi OSM lacks);
inverse-emission tomography (the research frontier, ≥1 week on top of a
validated forward model — `docs/25-peak-physics.md`).

---

## 5. Success metrics

Four scoreboards, one per scope. Every metric has a named data source and
an honesty qualifier; none of them is a vanity count.

### Consumer — dose saved per user-week

| metric | source | target shape |
|---|---|---|
| dose avoided, µg/user-week (banded) | ledger `avoided_ug` over donated trips vs user's worst alternative | median + p25/p75 per active user; banded, never point |
| receipt coverage | % of completed trips producing an arrival receipt | engagement proxy for the honesty story |
| telemetry opt-in share | devices with sharing on / active devices | the platform's fuel gauge; report the number, not a projection |
| plan latency p50/p95 | `/v2/plan` `took_ms` | hold the shipped ~0.06–1.7 s warm / ≤8 s cold envelope |

### System — emissions per corridor-hour (instrumented corridors only)

| metric | source | honesty note |
|---|---|---|
| CO2e per corridor-hour (±~30% band) | 03 field × flow estimate | tightest number we own — lead with it |
| tailpipe PM2.5 per corridor-hour (wide fleet band) | 03 | width is the published truth; no points |
| corridor-hour budget consumption % | budget service (01) | the gov console's headline number |
| lighter-mode share vs baseline | aggregate modes per corridor | VC-adjusted where weather confounds |
| non-exhaust note | resuspension share allocated per-VKT | counts *for* us: ~86% of traffic PM10 is non-exhaust — honest accounting must include it or we undercount |

### Platform — planner queries answered

| metric | source |
|---|---|
| distinct corridors queried / week | console + API logs (aggregate-only) |
| planner API calls & p95 latency | gateway metrics |
| gov orgs onboarded / active | account list (gov-side accounts are fine — they're institutions, not people) |
| data freshness SLA | field age, corridor-state age vs 15-min cadence |
| suppression visibility | count of dark corridors published as a count — honesty is itself a surface |

### Honesty — admitted-uncertainty coverage

| metric | source | rule |
|---|---|---|
| % of served numbers carrying band + source label | wire audit of every gov surface | target 100%; an unlabeled number is a bug, filed |
| calibration drift | weekly LOO vs station archive | MAE tracked openly (today: 8.8 live / 22.0 held-out window — publish both) |
| killed-claim count | `docs/26` kill list vs all surfaces | zero tolerance — one leaked claim and the surface ships a correction |
| penetration bands honest | 02 estimator self-check vs any ground count obtained | bands must admit they can be wrong, and say how |

---

## 6. The mentor pitch — 2-page outline in bullets

For a technical mentor / potential gov champion. Two pages, all bullets,
every claim carrying its proof or its label.

**Page 1 — the problem and the wedge**

- Delhi runs the densest public air-quality monitoring network in India
  (~46 CAAQMS inside Delhi, ~84 NCR — ₹1.5 crore per station, per its own
  May-2025 tender) and it still cannot answer a planning question:
  *where do people actually move, and what does moving cost their lungs?*
- The official layer measures **concentration**, not **demand**. Nobody —
  not CPCB, not SAFAR, not the app stores' 40 AQI dashboards — has a
  demand-side exposure layer. That is the dataset the government needs
  and does not have.
- We shipped the demand layer's first half as a consumer product: a Delhi
  app that prices every trip in inhaled PM2.5 (and time and ₹), live
  field rebuilt every 15 min from 54 instruments + model + fires + wind,
  honest bands on everything. Same trip on foot vs closed car: ~33× dose
  — measured basis, demoable today.
- Every trip a user takes donates — anonymously, opt-in, trimmed 300 m
  both ends, thinned to ~100 m, snapped to cells, token hashed, raw
  discarded — one traversal of a real corridor. k≥3 devices / 72 h or
  the cell is never published. The privacy pipeline is code, not policy.
- The wedge: **the consumer app earns the telemetry; the telemetry is the
  platform; the platform is the gov data product.** Each stage funds and
  justifies the next. Nobody can buy their way into act three — the moat
  is earned trust, not a sensor contract.

**Page 2 — what exists, what we'd build, what we need**

- Shipped and provable today: kriged field with published error (MAE 8.8
  live-calibrated, 22.0 on 3,550 held-out station-hours); 1.07M-edge
  self-hosted road graph repriced every 10 min; GTFS transit; dose
  receipts; corridor aggregates (12 publishable today — cold start,
  stated, not hidden); privacy pipeline with nothing linkable at rest.
- P1 asks: corridor-hour state (speed + flow + dose + emissions bands) on
  ~20 pilot corridors; soft budgets and opt-in quota advisories; a
  read-only gov console. Entry condition is our own adoption threshold —
  we only act where the lower bound of our measured flow share says we
  matter.
- P2 asks: bounded system-aware assignment (never >+15% time vs
  user-optimal, never hidden), planner APIs, and intervention measurement
  honest enough to survive a skeptical journal club — diff-in-diff vs
  matched controls, claims capped at "the corridor changed like this."
- What we do **not** claim: we are not a sensor (traversals measure
  demand and timing; the field supplies concentrations — EPA's NSIM
  tier, the officially sanctioned framing); we do not reduce Delhi's AQI
  (we reduce exposure and corridor-hour emissions, measured where we can
  measure); we do not sell data (aggregates are public; the tier is query
  capacity, never exclusive access).
- The precedents that prove the channel works: Green Delhi app ~1 lakh
  complaints resolved at 87% across 30 departments — citizen-fed data
  does move Delhi machinery; A-PAG's 35-sensor IIT-Delhi deployment
  measured real intervention effects (26.6/15.7/15.3% PM2.5 cuts,
  diff-of-diff) — the method we'd imitate, with software-scale coverage.
- What we want from a mentor: (i) names of 5–10 pilot corridors where a
  planner already wants this answer; (ii) the OTD GTFS-RT key expedited —
  it's requested, not granted; (iii) one hour with a DPCC/CAQM technical
  reviewer to attack the corridor-state spec before we build it; (iv) a
  letter of intent for the P2 measurement pilot contingent on the
  adoption gate.
- The repeat-to-another-person line: **"Google prices a trip in minutes;
  they price it in breath — and every trip teaches Delhi where its
  citizens actually breathe."**

---

## Cross-memo seams (for the parallel authors)

1. **Corridor definition** must be identical in 01, 02, 04, 08 — the
   enumerated pilot set lives in 08 and everyone else references it.
   Do not invent your own geometry.
2. **λ** is defined once (01) and *referenced* everywhere else; 05 may
   not redefine the schedule, only describe how it's transported.
3. **k tiers** (D3) are owned by 06; any memo that publishes a number
   must cite which tier gates it. 04's console design inherits k≥10/20.
4. **Emission bands** are owned by 03 on the basis 08 supplies; 04 and
   the metrics section above consume them — if the EF table changes,
   this file's §5 changes automatically, not by re-derivation.
5. **The kill list** (09) is binding on this file: if a metric in §5
   would require a killed claim to compute, the metric is wrong — flag
   it back here.
6. Provisional filenames in the sibling table: rename freely, then patch
   this table in the same commit so 10 stays a faithful index.
