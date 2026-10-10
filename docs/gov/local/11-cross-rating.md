# 11 · Cross-rating — the corpus audited against itself and the repo

*Cross-rater deliverable. Reads all ten memos 01–10 in full, checks every
load-bearing file:line citation against the shipped code, re-derives the
arithmetic that matters, rates each memo on five axes, registers every
inter-memo disagreement with a resolution or an owner flag, harvests the
one thing from each memo that must survive synthesis, lists what to kill,
and names what nobody covered.*

*Verification method: ~40 file:line citations spot-checked against
`server/` and `Mobile/` (appendix A). Two formulas re-derived
numerically: 03's speed-factor table runs identical to
`emissions.speed_factor` to 3 decimals (the `/g(30 km/h)` normalization
is what makes it exact); 01's refined PoA bound `PoA(ū) ≤
1/(1−ρ(ū))` reproduces the global 2.151 limit as ū→∞ and the printed
ū=0.5/1.0 cells (~1.005/~1.075) exactly.*

*Owner's corrected priority model held fixed throughout: consumer-facing
score = **₹ fuel saved → time/reliability → safety**, health/dose
internalized as the engineered byproduct, never the headline.
Segregation = top-K corridor quotas so our own recommendations can't
manufacture jams.*

---

## 1. Ratings matrix

Axes (1–10): **math** = correctness of math/engineering claims ·
**ground** = repo grounding (are the file:line citations real?) ·
**cover** = coverage of assigned topic · **honest** = admits uncertainty
· **act** = actionability for a solo team.

| memo | math | ground | cover | honest | act | Σ/50 | one-line justification |
|---|---|---|---|---|---|---|---|
| **01** braess-assignment | 10 | 9 | 9 | 10 | 8 | **46** | Deepest original math in the corpus — refined-PoA derivation verified, β-toll closed form, five proved propositions; the u≈0.8 self-disabling gate is the corpus's best honesty mechanism; every cite checked exact. Docked on act: the mechanism depends on cohort forecasts + flow estimates that don't exist yet. |
| **02** congestion-model | 9 | 9 | 9 | 10 | 8 | **45** | The estimator everything else reads from; [V]/[I]/[C] tagging is exemplary; joint-gate arithmetic (30/hr AND 3% ⇒ <1,000 veh/h) is the corpus's most useful derived constraint. Docked on act: needs the GTFS-RT key + 08's missing enumeration before it can run. |
| **03** emissions-fuel | 10 | 10 | 9 | 9 | 9 | **47** | Most bulletproof grounding — speed-factor table verified *numerically* against shipped code to 3 decimals; κ_fuel inversion turns shipped CO2 bands into the ₹ headline for free; 14-gap table is the corpus's best work-breakdown. Small honesty dock: the two price bases (its own ₹102.1 vs 08's ₹94.77) never reconcile in-file. |
| **04** gov-platform | 8 | 8 | 9 | 8 | 8 | **41** | Most complete product spec — endpoints, schema, build order, RFP compliance — but highest seam-debt: `cor#` pk collision with 02, flat k≥5 contradicting both 06's spec and D3's tiers, DP scope looser than 06's math allows, live console vs 09's export floor, two citation drifts (agg_ddb:343→317, grid.py labels). |
| **05** realtime-architecture | 9 | 9 | 9 | 9 | 9 | **45** | Best "kill the bad option early" engineering — the two-stores-two-jobs split and fast-state/slow-authority frame reconcile every sibling's cadence demands; cost table is honest arithmetic with an assumptions register. Docked slightly on math for unverified rate assumptions ([I]-tagged, admitted). |
| **06** privacy | 10 | 9 | 9 | 10 | 9 | **47** | The only memo that *prices* privacy (Laplace std = √2Δ/ε ⇒ cell×hour DP is numerically ruinous — arithmetic verified); shipped-vs-spec delta table is a model of honest spec-writing; every cite verified including the 410-Gone retirement. Sits at the center of the corpus's worst conflict cluster (C1–C2) — not its fault, but unresolved. |
| **07** fairness-incentives | 9 | 7 | 9 | 9 | 8 | **42** | Best mechanism-design reasoning — the ±1 deficit proof is correct (induction verified), the honest "bench not boast" clause for the general case is exactly right, IR cap is the ethical load-bearer. Docked on ground (mostly doc-level, few code cites) and act (requires owner decisions + new per-token state). |
| **08** delhi-factors | 9 | 8 | 7 | 10 | 9 | **43** | Highest fact-check survivability — say/don't-say tables, dated prices, [UNVERIFIED] tags, every repo cite verified. **But failed its one assigned deliverable**: the enumerated pilot corridor set (seam rule 1) was never produced — a crash-corridor list is not a pilot enumeration — and its fuel prices conflict with 03's. |
| **09** failure-honesty | 9 | 7 | 9 | 10 | 9 | **44** | The discipline memo — correlated-failure framing, refusal thresholds, kill switches on data not humans, a runnable red-team checklist. Docked on ground (doc-level cites only, appropriate but thinner) and for carrying the corpus's most aggressive export floor (≥24h/≥25) without reconciling it against 06's hourly feed. |
| **10** synthesis-skeleton | 8 | 8 | 8 | 9 | 8 | **41** | Does its map-job well — seam rules and decision register are what make this corpus resolvable at all, cold-start truth stated plainly. Docked on cover: it inherits 08's missing enumeration and its own §1 pitch still leads with dose (uncorrected score order). A map, not territory — rated accordingly. |

**Strongest overall: 01-braess-assignment** — deepest load-bearing
novelty with the best honesty mechanism (a theorem that self-disables),
verified math, exact citations. Honorable mention: **03** and **06**
(both Σ47, the most bulletproof on pure correctness).

**Weakest overall: 04-gov-platform** — not bad work, but the highest
seam-debt: it's implicated in five registered conflicts (C1, C2, C6, C7,
C14) and needs the most rework before it can serve as the product spec.
**Most incomplete: 08-delhi-factors** — superb on what it covered, but
it alone failed to deliver an assigned artifact (the pilot corridor
enumeration that 02, 04, and 10 all consume).

---

## 2. Conflicts register

Each entry quotes both sides, resolves per the skeleton's seam rules
("sibling wins on its own topic"), and flags genuine owner decisions.
Ordered roughly by blast radius.

### C1 — k-anonymity tiers: four numbers, one gate 〔UNDECIDED → owner〕

| side | says |
|---|---|
| **06** (owns k, seam rule 3) | "publish threshold k≥3 → **k≥5, plus randomized margin**" — T_b ∈ {5,6,7} deterministic-secret per bucket, hysteresis, atomic embargoed release |
| **10** D3 | "**k≥3** consumer corridor layer · **k≥10** gov corridor-day · **k≥20** anything hourly/public" — repeated verbatim by 02 §7 and 03 §7.1 |
| **04** | "GOV_K_MIN = **5** distinct hashed devices per published row" |
| **09** | export floor "**≥25 contributors/aggregate**, or calibrated DP noise" |

- *Resolution:* 06 owns the *mechanism* and its randomized margin +
  hysteresis + atomic release is strictly stronger than fixed thresholds
  — adopt it everywhere. The *levels* are the conflict: 06's feed rows
  sit at 5–7 while D3 wants 10/20 and 09 wants 25 on exports.
  **Undecided — flag to owner.** Recommended compromise the synthesis
  can adopt pending ruling: consumer display k≥3 · gov console rows
  k≥10±margin · public/hourly artifacts k≥20±margin · durable exports
  k≥25 (09's floor) or DP where 06 §4.2 permits. One canonical tier
  table must exist; today the corpus has four.

### C2 — Export time-window floor: hourly feed vs ≥24 h rule 〔09 wins; 06 needs redesign〕

- **06** specs "atomic hourly release, embargoed +2 h" of cell×hour
  rows as "the primary feed unit" (§2 step 8, §3.2, §9.1 feed contract).
- **09** holds "**≥24 h minimum time window** for anything leaving the
  building. Live corridor feeds to a government are a tracking tool —
  refuse" (§4.3).
- **04** splits the difference (weekly exports, live console); D3's
  "k≥20 anything hourly/public" contemplates hourly artifacts existing.

- *Resolution:* 09 owns the kill list and this is a misuse-boundary
  call → **09 wins on exports**: 06's hourly cell×hour artifact feed is
  killed or coarsened to ≥24 h / ward-level. Console (tenant-gated,
  no durable artifact) may show live corridor-hour *state* under the
  k-tiers — that is a read, not a release. **Flag:** 06's §9.1 feed
  contract must be re-drafted at ≥24 h granularity; the corpus
  currently spec's two different feeds (06's hourly cells, 04's weekly
  corridor-week exports) and only the second survives 09's rule.

### C3 — Who fills the sacrifice slots: hash-lottery vs deficit rotation 〔UNDECIDED → owner; THE mechanism fork〕

- **01** (owns quota math): `u_i = SHA256(token ‖ cohort ‖ τ)/2^64`,
  cumulative-quantile cut over θ* — stateless, ex-ante envy-free, Weyl
  rotation bounds *time-averaged dose* at O(log T/T).
- **07** (owns who-bears-the-detour): rank by deficit `d_i = D_i − a_i`,
  lowest s_e take option 2 — proved `max D_i − min D_i ≤ 1` stationary
  (induction verified), needs two counters per token (owner decision
  flagged in-memo).

- *The collision:* 01's per-epoch hash draw is precisely the
  day-salted-lottery shape 07 §2.2 analyzes and **rejects as primary
  mechanism** ("acceptable only as the tie-break inside rotation").
  01's Weyl rotation bounds dose-average, but the *count* of sacrifices
  remains stochastic — 07's §2.2 tail argument (`E[D]+4σ` unlucky user)
  applies to it.
- *Resolution per seams:* the two mechanisms answer different
  sub-questions and can stack — **θ\* (01) decides split sizes;
  selection (07) decides who fills them.** Recommended stack: θ\* →
  deficit-ordered fill for ledgered users, hash-lottery for anonymous
  (07 §3.3 already specs this fallback). **Undecided — flag to owner:**
  the stack costs the per-token counters 07 requires (one ledger field
  + accrual counter); if the owner refuses new device-keyed state, 01's
  lottery stands and the synthesis must accept its ex-post tail —
  explicitly disclosed, since 07's own copy rules require telling users
  why them.

### C4 — Consumer score order: owner's ₹→time→safety vs shipped dose-first 〔owner model wins; three files need patching〕

- **Owner model** (stated verbatim in 02 §0): "₹ fuel saved →
  time/reliability → safety, with dose internalized under the hood."
  08 supplies the evidence base.
- **Shipped code** (`plan.py:1189–1245`, verified): rank key = dose_lo,
  ε-constraint near-tie by CO2. **03 §5.2** documents exactly this.
  **07** defines "option 1 = the user's dose-ranked best." **10 §1**
  pitches the consumer app as "prices every trip in inhaled PM2.5" —
  dose as the headline.

- *Resolution:* not a real architecture conflict — the internal
  optimization stays dose+emissions (D9 governs the λ>0 system term;
  dose is what we measure best) while the *consumer-facing score, sort,
  and copy* flip to ₹-first. **Flag to owner:** confirm the internal
  rank key itself stays dose-first (recommended — it is what the field
  validates) with ₹ leading the display, OR whether `rank_options`
  re-keys to ₹. Either way: patch 10 §1's pitch line, 07's option-1
  definition, and every "lightest"-tag consumer copy to match the
  corrected order. The skeleton is currently the stale file on this.

### C5 — DynamoDB namespace collisions: `cor#` and `dp#` 〔mechanical, resolved〕

- **02** writes `cor#<corridor_id>` / sk ∈ {live, clim, hour#*,
  obs#*, flow} on `alive108-agg`.
- **04** writes `cor#<h3>` / sk `hw#<week>#<dow>#<hh>` — **same table,
  same pk prefix.** Its own claim "prefix-scoped reads cannot
  interfere" is wrong in exactly one place: the weekly gov rollup
  "scans the past week's cor# items" — that scan picks up 02's live/
  clim/obs items too (works only if every reader sk-prefix-filters).
- **06**'s DP ledger `pk=dp#budget, sk=<day>` vs **04**'s
  `gov#meta/dp#<YYYY-MM>` per-tenant ledger — second collision.

- *Resolution:* rename before build — corridor-state family → `cst#`
  (02 owns state; `cor#` stays for gov atoms since 04's is the bigger
  surface), DP ledger unified under 06's shape (tenant id inside the
  item). Mechanical; flag so no one builds on the current spelling.

### C6 — Salt domain vs the corridor-union k-gate 〔UNDECIDED → owner; the subtlest conflict〕

- **06**: `token_cell = HMAC(K, token|day|cell)` — "a device's hash
  differs in every cell and every day → set-intersection between two
  cells or two days yields empty sets."
- **04**: corridor publish gate = "union of cell `devices` SS across
  the corridor's cells for the time slice ≥5."

- *The collision:* union of differently-salted hashes **over-counts
  distinct devices** — one device crossing 3 cells contributes 3
  different HMACs to the union. A corridor with 3 real devices can
  publish as "k≥5": the salted scheme silently *inflates* k exactly
  where the gate matters.
- *Resolution:* 06 owns the privacy scheme and wins on principle —
  cross-bucket unlinkability must stand. But its salt domain must
  match the counting domain: corridor-level gates need a
  **per-(period × corridor-scope) salted hash** written at ingest
  (a second HMAC per donation), or corridor unions are uncomputable.
  **Undecided — flag to owner:** either 04's corridor gate gets its own
  salt family, or corridor rows publish only at cell-level k. This is
  the one conflict where both sides are right and the fix is a
  protocol detail nobody has written yet.

### C7 — Fuel price tables: two dated snapshots 〔03 wins; resolved〕

- **03**: petrol ₹102.1/L, diesel ₹95.2/L, CNG ₹83.1/kg — "Sept–Oct
  2026 snapshot," notes trackers ranged ₹94.8–102.1.
- **08**: petrol ₹94.77/L, diesel ₹87.67/L, CNG ~₹77.09/kg — 2024–25
  verified prices.

- *Resolution:* both honestly dated, no arithmetic error — but the
  synthesis needs ONE price table. 03 owns the ₹ model → its snapshot
  governs; 08's stays as citation provenance. The downstream ₹/km rows
  differ accordingly (08's ₹6–9/km vs 03's ~₹6.8/km mid — consistent
  given different price bases, but one must lead). Resolved; G-4's
  monthly refresh job becomes load-bearing.

### C8 — Sync vs async assignment 〔no real conflict; resolved〕

- **10** D1: "async budgets + user-optimal core"; sync marginal-cost
  routing rejected for P1.
- **01**: per-request `ASSIGN` does an O(1) hash-slot lookup; θ\* is
  solved per cohort-epoch off the request path.
- **05**: "sync read + rank inside plan (always); async aggregation
  (always)."

- *Resolution:* all three agree once stated precisely — **authority is
  async (15-min epoch θ, budgets, λ); the per-request read+slot is
  sync and O(1).** D1's rejected option (a) was *sync marginal-cost
  computation* per request, which nobody proposes. Patch the synthesis
  to say "async authority, sync read" in one line. Resolved.

### C9 — Sacrifice caps: three parameterizations 〔mechanism agreed, numbers flagged〕

- **01**: eligibility gate `D_j ≤ (1+r)·min D_j`, r ≈ 0.10–0.15 (dose).
- **07**: IR cap "Δdose ≤ 15% AND Δtime ≤ 5 min" (+ε_med ≈ 0 for
  health-declared users).
- **10** P2: "never propose > +15% time or +10% dose vs user-optimal
  without opt-in + incentive."

- *Resolution:* the dual-axis cap wins (07's shape is the strictest and
  carries the ethical load). Canonical cap recommended: **Δdose ≤ 10%
  AND Δtime ≤ 5 min for default asks; beyond that requires opt-in +
  incentive, never silently.** The three numbers (dose %, time min,
  dose % for opt-in) are an owner call — flag; mechanism resolved.

### C10 — Adoption/penetration gates: four thresholds, four quantities 〔complementary; unified stack needed〕

- **10** P1 gate: penetration LB ≥3% on ≥20 corridors + ≥30
  traversals/peak corridor-hour, sustained 28 d.
- **02**: same gates; derived corollary — pilot corridors should run
  <~1,000 veh/h two-way peak or the gates can't both pass.
- **09**: quotas bind only at ~1M DAU (~12% share); refusal tiers
  <3 / 3–10 / 10–50 / 50+ probes per rolling hour.
- **01**: activation on `u_crit ≥ 0.8` (cohort demand vs bottleneck
  residual capacity), `N̂ < n_min` → inert.

- *Resolution:* complementary quantities, not contradictions — the
  unified gate stack: (a) `p̂_LB ≥ 3%` → measurement claims; (b) `n_trav
  ≥30/peak-hr` → "measured" label; (c) `alive_share` 2%/10% →
  endogeneity flag; (d) `u_crit ≥0.8 AND N̂≥n_min` → segregation
  activates; (e) 09's probe tiers → display authority. 09's "~12%" is
  about *city-level claims*, not self-herding protection — 01 §3.3's
  platform-selfish scope makes segregation for *our own users' dose*
  rational at far lower share. Resolved with the stack table; 09's
  caution stands for every public claim.

### C11 — "Corridor" means two different objects 〔vocabulary collision; flag for patch〕

- **10/08/02/04**: corridor = enumerated named axis of contiguous
  ~500 m/H3-8 cells ("enumerated, not inferred").
- **01**: corridor = an option corridor (edge list) from
  `alternatives()` — per-request, cohort_sig-keyed, K≤3 per OD.
- **05**: `flow[cell]` at res-8 — cell-level live load.

- *Resolution:* two objects sharing one name — **axis corridor**
  (state/budget/gov surfaces, enumerated) vs **option corridor**
  (assignment member, per-request). The missing join: each option
  corridor must map onto the axis corridors it traverses so axis
  budgets can bind option-corridor quotas. Flag for a skeleton §3.2
  vocabulary patch — add the two terms and the join rule. Same class
  of fix for time bases: "live load state" (05, ≤30 s) vs
  "corridor-hour measured state" (02, 15-min) vs "planning atom"
  (04, hour-of-week).

### C12 — Corridor geometry ownership: the undelivered enumeration 〔GAP, not disagreement〕

- Seam rule 1: "the enumerated pilot set lives in 08."
- **08** delivers a crash-corridor geography (9 axes, black-spot
  rationale) — not a pilot set with flow/demand estimates.
- **02** ("corridors enumerated from 08's pilot set"), **04** (registry
  pre-seed), **10** (P1's ≥20 instrumented corridors) all consume it.
- **04**'s corridor registry (drawn | suggested) is a different
  lifecycle — customer-defined corridors, not the pilot set.

- *Resolution:* 08 still owes the enumeration, screened by 02's
  <~1,000 veh/h rule and its own crash/exposure priorities; 04's
  suggested-corridor job can generate the candidate pool. Flag as open
  work item — the single unmet assignment in the corpus.

### C13 — Incentive currency: ₹ credits vs D4's "never (a)" 〔UNDECIDED → owner〕

- **10** D4: "(b) dose-saved + civic ledger now → (d) lottery at P2,
  **never (a)** cash/UPI per reroute" — rationale: "drive the corridor
  to be paid to leave it."
- **07**: ₹-denominated credits ₹5–10 per accepted turn + weekly pooled
  draw; vesting on *completed* trips; ₹30/day cap; "the wallet is
  labelled a ledger of turns, not money" until a rail exists.

- *The collision:* 07's base credit IS per-reroute payment — D4's
  rejected option. 07's guardrails (vest on completed trips verified
  against the route, earn cap, IR cap, farming-EV analysis) answer the
  gaming objection *partially*: they raise farming cost but the
  direction of payment still funds accepting detours.
- **Undecided — flag to owner:** (i) strict D4 — kill the base credit,
  lottery only; (ii) allow base credit inside 07's guardrail stack
  (recommended — the ₹ credit is the legible unit for the ₹-first
  consumer score, and the IR cap makes it pay for inconvenience, never
  dose); (iii) sponsor-funded pool (city/CSR pays — sidesteps our
  OPEX). The lottery component is D4-endorsed either way.

### C14 — Turn-counters vs the salt scheme and ledger 〔resolved with a spec note〕

- **07**'s D_i/a_i live on the token-keyed `ledger#` family
  (sha256[:16] as shipped — user fetches by raw token, so the ledger
  key must stay unsalted-by-day or lookups break).
- **06**'s per-(day×cell) HMAC salts govern *publish sets*, not the
  ledger family.

- *Resolution:* compatible as written — ledger stays token-keyed
  unsalted (it is user-facing and user-deletable; 06's §2 table already
  treats it separately), publish sets get salts. Needs one line in
  06's spec: "the ledger family is exempt from per-bucket salting —
  it is the bearer-keyed user surface." Token 30-day rotation caps the
  fairness horizon (07 already TTLs counters to it). Resolved.

### C15 — Emissions inside the quota objective: dose-only Ψ vs dual budget 〔patch to 01; resolved〕

- **01**'s restricted-SO: `min Ψ = Σ f_e·d_e(f_e)` — dose only.
- **10** D5: "dual soft budget on dose + emissions." **03** supplies
  `H(c,h) = Σ[dose + ω_c·CO2 + ω_p·PM25]` with weights "the 01 memo
  owns" — **01 never defines ω.**

- *Resolution:* swap the edge cost `d_e → h_e` in 01 (BPR shape
  survives — the time-dependence carries it, κ_e just gains emission
  addends). Mechanical patch; otherwise D5 silently reduces to
  dose-only. Resolved pending the patch.

### C16 — Auto-rickshaw waiting charge 〔minor; owner verify〕

- **03**: "₹0.75/min when <1 km per 10 min."
- **08**: "waiting ₹1/min after 15 min."

- Both cite the Transport Dept Jan-2023 notification. Flag for owner —
  one line to check against the notification text; affects only the
  fare-engine table (03 G-5), not any structural claim.

### C17 — Exploration vs disclosure 〔no conflict; noted〕

- **02** §6.3: ε-exploration returns "a randomly sampled near-optimal
  option (≤+5% user cost, logged `exploration=true`)."
- **07** copy rules: never imply an assigned option is personal best;
  always disclose.

- *Resolution:* consistent — 02 already requires "honest on the
  receipt"; exploration rides 07's disclosure copy and the same IR
  cap. Resolved.

### Conflicts checked and found NOT to exist (seam audit summary)

- **Bus occupancy**: 03's ÷20 shipped divisor vs 08's 15–40-aboard
  band — consistent (03 discloses the sensitivity).
- **Divert cap**: 09's ≤10–15% of corridor throughput = 05's §8 cap,
  explicitly inherited. Consistent.
- **Idle burn**: 03's 0.40 g/s CO2 (~0.62 L/h) inside 08's 0.45–1.0 L/h
  class band. Consistent.
- **λ=0 default / quota-as-offer**: 01, 05, 09, 10 all agree — user
  optimum always listed, never hidden.
- **Cold-start numbers**: 22 trips / 14 contributors / 12-of-54
  corridors identical across 02, 03, 05, 10 — verified against
  `docs/plan/NUMBERS.md`.
- **External feeds**: D2 (validate-don't-feed TomTom/HERE) respected by
  02's fusion table and 08's license warning.
- **Hysteresis parameters**: 01's γ-damping + δ-band, 02's ±0.05
  classification band, 05's ±10–15% freshness band — different layers,
  all legitimate; synthesis should table them so they aren't conflated.

---

## 3. Best-points harvest — the one thing per memo that must survive

| memo | must-survive idea | why it's the pick |
|---|---|---|
| **01** | **Dose inherits the BPR shape** (dose ∝ congested time ⇒ no new cost model needed) → the closed-form β×-premium Pigouvian toll, gated by the **u≈0.8 inactivity theorem** — one scalar decides whether to segregate, how hard, and whether we may claim it | The whole segregation thesis collapses without the math pivot, and the self-disabling gate is what makes it honest rather than clever. Runner-up: "quotas are non-monetary Pigouvian tolls — same fixed point, different instrument." |
| **02** | **The joint-gate corridor constraint**: 30 traversals/peak-hr AND 3% penetration LB together ⇒ pilot corridors must run **<~1,000 veh/h two-way peak** | Converts two abstract entry gates into a concrete selection rule — it tells the owner which streets are even eligible. Runner-up: "the label travels with the number" (honesty as a storage property, not a UI convention). |
| **03** | **CO₂ is stoichiometric ⇒ κ_fuel inversion**: every shipped CO₂ band is already a ₹ fuel band (`₹ = E_co2/κ·P`), and the shipped idle floor makes "a jam bills you ₹X/min while you breathe" computable — **+226% PM2.5 standing still** | This is the entire ₹ axis of the owner's corrected score — available from data already on the wire, zero new modeling. |
| **04** | **The intervention registry with frozen baseline** — register once at project start; baseline computed once and frozen; weekly before/after reports with ±2σ verdicts forever, DiD vs control corridors | "The greening project measures itself" is the B2G spine — the one artifact a procurement committee can actually grade. Baseline-freezing is the detail that makes it trustworthy. |
| **05** | **Fast state / slow authority** — corridor load converges ≤30 s for display and advisories, while budgets/λ/quotas recompute only on the 15-min epoch | Resolves the corpus's cadence tension in one sentence: real-time UX without the oscillation 09 warns about. Runner-up: the failure-order table (egress > compute at 100k; DDB never on the plan path). |
| **06** | **The DP arithmetic verdict**: noise std = √2·Δ/ε ⇒ Δ=16 cells ⇒ ±23 trips on counts of ~12 — **coarsening beats noise at small counts; DP only where N is big** | Turns "should we do DP" from ideology into arithmetic — the decision table (city×day yes, cell×hour never) is the most reusable single table in the memo. |
| **07** | **The IR cap as ethical load-bearer**: never ask anyone to take Δdose >15% or Δtime >5 min — "a thank-you for a turn, never payment for breathing worse" | It is what makes every incentive/fairness mechanism in the corpus non-toxic. Runner-up: the proved ±1-turn deficit bound and the बारी register. |
| **08** | **"N official crash zones on this route" — a count users can verify on the DTP list** | The only safety claim shippable today with zero modeling risk: countable, source-dated, subtype-aware. Runner-up: the 5-condition metro-dominance footprint (the honest "metro wins on all three axes" headline). |
| **09** | **The decision-relevance gate**: "when the uncertainty band is wider than the difference the number would decide, show nothing" | The cleanest formulation of the entire honesty doctrine — one sentence that generates half the corpus's refusal rules. Runner-up: "advice can be wrong politely; allocation cannot." |
| **10** | **The P1 entry gate as a triple** (≥3% penetration LB + ≥30 traversals/peak-hr on ≥20 corridors + tiered-k, sustained 28 d) + the seam-rule protocol itself | The gate tells you when Act II may begin; the seam rules are what made this review resolvable — keep both. |

**Top-3 across the corpus:** ① 03's κ_fuel inversion (₹ axis for free —
it IS the headline of the corrected score) · ② 01's self-disabling
u≈0.8 gate (segregation that can't lie about itself) · ③ 02's <1,000
veh/h pilot screen (turns gates into a corridor shopping list).

---

## 4. Kill list — strip these before synthesis

**Claims to kill (unsupported or killed by the corpus's own rules):**

1. Any city-level congestion/emissions reduction claim — at ρ ≪ 5%
   platform share the public-impact claim is zero (01 §6 rule 4, 09 §7,
   02 §9, 03 §7.3 — unanimous).
2. "Guaranteed ₹ savings" / point prices — bands only (08, 03).
3. "Safe route" / route safety scores / "we reduce accidents" — counts
   of zones only (08, 09).
4. "Real-time traffic" unlabeled — 15-min authority cadence; name the
   probe source or don't claim (08, 09, 02).
5. "GRAP Stage N in effect" — equivalent-stage labeling only (08).
6. "Fires down 90%" / parali-solved — iFOREST undercount finding (08).
7. DP on cell×hour or any small-count surface — 06's own arithmetic
   kills it; 04's `dp=1` must be surface-scoped.
8. Cell-level OD pairs and cell-level mode names (06 §3.2).
9. Sub-24h exports / hourly cell feeds to government (09 §4.3 — kills
   06's §9.1 hourly artifact as designed).
10. Pay-for-exemption or any purchasable position in the queue (07 §8;
    environmental-justice red line).
11. "CNG = clean" and "EV = zero" copy — TRUE uplifts and coal-grid WTW
    make both false (03 §6, §2.2).
12. Quota-as-punishment — no degraded service for decliners, ever
    (10 §3, 07 §4).
13. Hidden/undisclosed steers — "recommended" on a non-best option is
    lying by adjective (07 §4.2, 09 §2.2).
14. eDAR/CCTNS as accessible data sources — role-based govt login, and
    CCTNS has no traffic content at all (08 §2.5, §3.2).
15. "Your phone measured" — phones traverse a field; banned phrasing
    (09 §9, docs/26 lineage).
16. Source-attribution claims of our own ("stubble caused today's air")
    — cite DSS shares only (08, docs/26).
17. Per-vehicle exact emissions — class bands only (03, docs/26).
18. Consumer headline = dose/health — the owner's corrected order
    internalizes dose; every surface that leads with µg leads wrong
    (C4 patch).

**Resume-padding / over-scope to strip or defer:**

19. Kinesis/Flink below ~50–100k concurrent — 05 kills its own options;
    keep the thresholds, drop the infrastructure.
20. The separate "scoring service" microservice and DDB/DAX read paths
    on the plan path — 05 §4–5's dead options stay dead.
21. 01's stateful small-N counter option — self-flagged not
    recommended; statelessness is worth O(√N).
22. 03's tier-3 VSP-lite (G-12) — defer; tier-2 spans first.
23. Telemetry-event writes to `alive108-agg` — the $7k/mo trap 05
    named; ledger writes only.
24. Green Credit Programme / "carbon points" as currency — 07 kills
    its own option; CO₂e belongs in impact display only.
25. 04's fallback prefix-scan path for rankings — keep it marked
    `source:"scan"` or drop it; never silently.
26. Per-trip/per-coordinate/per-token anything on any gov surface —
    structural refusal (06, 09).
27. Any corridor enumeration not produced by 08's screen — "invented
    geometry" is banned by seam rule 1.
28. The ±1-turn guarantee in marketing copy until the simulation
    bench publishes it (07's own rule: ship the benched bound, not the
    hoped-for one).

---

## 5. Gaps — what NO memo covered

Ordered by how badly the platform needs an answer.

1. **Ops/human burden, priced.** Nobody costs the recurring human
   work: monthly price-feed refresh (03 G-4), fare-table updates,
   blackspots annual refresh (08), salt/key rotation (06), GRAP-regime
   flag flips (03 G-6), demo ops, incident runbooks, the weekly report
   review. 05 prices servers; nothing prices the person. For a solo
   team this is THE constraint.
2. **Calibration ownership.** 04 §7.4 lets the government upload
   counts — but who on our side maintains φ profiles, κ expansion
   factors, C_e priors-vs-realized-speeds, EF bands when ARAI/TRUE
   publish new data? No owner, no cadence, no runbook.
3. **Legal entity & procurement vehicle.** Who signs the contract —
   individual, LLP? GST registration, tender turnover thresholds a
   solo team cannot meet, GeM empanelment, liability for a wrong
   advisory, insurance. 04 covers RFP-compliance of the *product*;
   nothing covers the *seller*.
4. **Map-data licensing, decided.** 08 flags "derived-data resale
   needs explicit terms" — nobody resolves it. Specifically: OSM/ODbL
   implications of selling a corridor dataset derived from an
   OSM-based graph (produced-work vs derivative-database analysis),
   TomTom/HERE display-only licenses vs gov redistribution, Amazon
   Location basemap terms. A legal seam, not a footnote.
5. **The pilot corridor enumeration itself** — C12; assigned to 08,
   never delivered, consumed by 02/04/10.
6. **Mobile engineering scope.** `/v2/tick` upload client (05),
   span-histogram donation (03 G-3), consent-screen changes for
   segregation disclosure (06 §5 + 07 §4), turn receipts/wallet UI
   (07), override affordances — all unpriced. The corpus budgets
   every server line-item and zero app-engineering hours.
7. **Adoption demand-generation.** The path from 14 contributors to
   30 traversals/corridor-hour: seeding strategy (05's sim_fleet is a
   demo tool, not an acquisition plan), fleet/driver partnerships,
   whether quota advisories even help recruitment. The P1 gate is
   defined; the road to it is not.
8. **Enforcement-request escalation runbook.** 09 draws refusal
   boundaries; nobody writes the playbook for when a buyer compels —
   the legal response, the PR posture, the technical "cannot comply"
   demonstration.
9. **Downstream republication liability.** 04 suggests
   CKAN/data.gov.in descriptors — if the buyer republishes, who owns
   the re-identification risk of the re-released data? 06's P-15
   clause binds the buyer, not the public.
10. **Segregation's success threshold.** 09 defines the regret-replay
    harness; nobody sets "keep assignment authority iff we beat the
    free-choice median by ≥X on N corridors" — the number that makes
    the kill-switch quantitative.
11. **GTFS-RT ingest build cost.** Every memo treats the key as the
    blocker; the key is the easy part. The dwell-correction worker,
    feed parsing, outage handling — a service nobody scoped.
12. **Incentive-pool funding source.** 07 publishes a budget cap;
    who funds it — ALive OPEX, city sponsorship, CSR — is unassigned.
13. **Schema versioning for long-TTL items.** 400-day `cor#` atoms
    will outlive their own schema; migration/interpretation policy
    for stale-schema items is unwritten (04 versions exports, not
    stored items).
14. **Offline / low-end behavior.** Skeleton D6 waves at "cached
    advisories degrade gracefully" — no design for plan/advisory
    behavior on dead networks or 1-GPS-fix devices.
15. **Event-day capacity story.** GRAP-III days are simultaneously
    highest-value usage and gate-trippers (09's event-day refusal);
    nobody sizes or rehearses the surge.
16. **Hindi copy production.** 07 spec'd the register; actual strings,
    review, and voice QA are unassigned work.
17. **Named grievance officer + breach runbook.** 06 §7.2 spec's
    "needs a named officer" and a 72-h Board-intimation runbook —
    both still TBD.
18. **Emissions→field coupling.** 01 honestly flags `C_e^air` as
    exogenous; the inversion/tomography path is deferred in docs/25
    and owned by nobody in this series.
19. **Single-region posture.** Everything is ap-south-1; gov
    contracts may require DR — unexamined.
20. **Console accessibility verification.** WCAG target asserted
    (04 §8.1); no test exists.

---

## Appendix A — repo verification log (what was actually checked)

Verified **exact** (file:line as cited):

- `routegraph.py:441–478` `alternatives()` K≤3 corridors, shared-length
  gate; `ALT_MAX_ATTEMPTS=4` (:116); dose formula (:14–20); road-name
  surfacing (:686–719) — 01, 04
- `trip.py`: `TRIM_M=300` (:35), `sha256(token)[:16]` (:241),
  `_MODE_RE` (:138), `co2_idle_g` bound (:96), `MIN_TRIP_KM 0.1` /
  `MAX_SPEED_KMH 140` / `MAX_IMPLIED_PM25 900` (:124–132), echo fields
  (:358), dedupe `_seen_dupe` (:63) — 03, 04, 06
- `main.py:1295–1303` `/observe` retired 410 Gone — 06
- `agg_ddb.py`: `K_MIN=3` (:50), `record_trip` (:97), `_scan` (:456),
  `LEDGER_TTL_S` (:570), UTC epoch-hour buckets (:177), suppression
  counts (:399–417), prefix families (:44–52) — 02, 04, 06
- `emissions.py`: header provenance (:19–47), `_BS_BY_YEAR` (:104),
  `_FLEET_PRIOR` (:122), `_EF` (:138), `OCCUPANCY`/`BUS_*` (:64–66),
  `COLD_KM=4` (:61), `_g_curve`/`speed_factor` (:294–307), `integrate`
  (:554) — 03
- `community.py`: `_fold` (:146–216 incl. `co2_kg_sum` :200–216),
  `_K_MIN_DEVICES=3` (:119), `_HOUR_KEEP_S` (:70), `_REPORT_TTL_S` (:43)
  — 02, 03
- `decide.py:23` `W_DOSE/W_RISK/W_TIME`; `night_black_spots` (:86) — 01
- `v2/plan.py`: `_emission_band` (:204), `_parse_vehicle` (:129),
  `idle_s = eta − freeflow` (:229), `rank_options` dose_lo + 1.10
  near-tie + lightest tags (:1189–1245), `osrm-freeflow` (:1023) — 03
- `v2/store.py`: `RouteStore` 3600 s/500-cap (:25), pluggable
  TripAggregates (:414–421) — 04, 06
- `transit_real.py`: `TRANSFER_PENALTY_S=6 min` (:48),
  `MAX_ACCESS_KM=2.5` (:52) — 08
- `admin_agg.py`: k re-assert→500 (:544–546), `model_card` (:597) — 04
- `middleware.py:83` self-minted token — 01
- `blackspots.py` — DTP 500 m zones, Table 6.28's 87 zones — 08
- `infra/provision.sh`: region (:35), table create (:123–131),
  `geo-maps:GetTile` (:287) — 04
- `scripts/deploy.sh:166` IAM scoped to `alive108-agg` — 06
- `Mobile/`: `engine.ts` `TRAJ_TRIM_M` (:120), `shareEnabled` gate
  (:381); `community.ts` `ID_TTL_MS` 30 d (:5) — 06
- `docs/plan/NUMBERS.md`: 22 obs, 14 contributors, 12/54 corridors —
  02, 03, 05, 10
- `docs/33`: plan srv 532–960 ms, `_ENG_EXEC` 3 workers — 05

Verified **numerically** (not just cited):

- 03's speed-factor table == `emissions.speed_factor` output to 3
  decimals (the `/g(30 km/h)` normalization is the subtlety — memo
  printed it correctly).
- 01's refined PoA formula reproduces the global 2.151 bound as
  ū→∞ and the printed ū∈{0.5,1.0} cells.
- 03's jam worked-example: +29.6% CO₂ ≈ "+30%", +225% PM2.5 ≈ "+226%"
  — arithmetic checks.
- 02's sample-size table: n=(1.96·CV/0.15)² → CV=0.4 gives 27.3 ≈ 27 ✓;
  shockwave worked example (1400−900)/(35−85) = −10 km/h ✓; fusion
  posterior v*=21.3 km/h ✓.
- 06's DP arithmetic: √2·16/1.0 = 22.6 ≈ "±23 trips" ✓.

Citation **drift found** (all minor, listed for the owner to fix):

- 04 cites `agg_ddb.py:343` for `hours_window` — def is at :317.
- 04 cites `grid.py:16` labeling reads `"sparse"/"none"` — grid.py
  uses confidence grades (`_conf` → "lo"/degraded), not those literal
  labels. Spirit right, label names wrong.
- 04 cites `v2/store.py:406` for the pluggable store — the switch is
  :414–421.
- 03 cites `emissions.py:294–308` for `speed_factor` — the public
  function is :305–307 (`_g_curve` :294–299). Fine as a range.

---

*Cross-rating complete. All conflicts either resolved per seam rules or
explicitly flagged C1, C3, C6, C13, C16 to the owner — plus the
score-order patch (C4) and the two undelivered artifacts (C12
enumeration, 06's ≥24h feed redesign under C2).*
