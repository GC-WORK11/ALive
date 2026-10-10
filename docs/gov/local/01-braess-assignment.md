# gov/local/01 — Flow-Aware Route Segregation: a Braess-Safe Assignment Layer for /v2/plan

*Design memo — deep math section for the government design doc. 2026-10-10.*
*Scope: the assignment layer that sits between `PathEngine.alternatives()`
(server/routegraph.py, `alive_core`) and the option list `/v2/plan` returns.
It decides which of the K honest corridors THIS device gets — so that the
platform's own recommendations cannot manufacture a traffic jam on the
cleanest corridor.*

Sister docs: 03 (dose model), 31 (dose↔emissions scalarization — the
near-tie band and signed trade line are reused verbatim), 33 (load/latency
budgets this layer must fit inside), 26 (claims honesty — this doc owns the
*"we do not cause congestion"* claim).

---

## 0. Verdict up front

**ALive is a Braess generator in waiting.** Every request that asks
"healthiest route?" gets today's answer: the least-dose corridor `c*`,
computed independently for each user. That is Wardrop-first-principle
routing executed by a monopoly oracle: if N users share an OD-bucket and
time window, we hand all N the same corridor. Their added flow raises
edge times; our own cost model — `dose = C_air · me · VE · t` — is
*linear in time on edge*, so the congestion we cause degrades the exact
quantity we optimize. The platform herds users onto `c*` until `c*` is
no longer healthiest. That is Braess's paradox, self-inflicted.

**The fix is three cooperating mechanisms, all cheap:**

1. **Marginal-cost scoring.** Score each candidate corridor for user *i*
   not by the dose *i* will breathe but by *i*'s marginal social cost:
   private dose plus the dose *i* imposes on everyone already assigned
   (Pigou 1920; Beckmann–McGuire–Winsten 1956). Under BPR-type
   latencies the externality term is exactly β times the private
   congestion premium — closed-form, no estimation beyond the flow
   count we already track.
2. **Top-K quota assignment.** Per corridor cohort, solve a K-variable
   convex program for the demand split θ\* = (θ₁…θ_K) that minimizes
   system dose subject to residual-capacity caps, then realize θ\*
   *deterministically* by hashing `x-device-token` into slots. Stateless,
   reproducible, ex-ante fair, provably cap-respecting up to O(√N).
3. **Rolling horizon + hysteresis.** Recompute θ\* each field epoch with
   a damped update; pin each device to its slot across refreshes inside
   a δ-hysteresis band. This is the boundedly-rational-UE regime
   (Mahmassani–Chang 1987) — switching only on material gain kills the
   oscillation an undamped recommender provably produces.

**And the honesty clause, which is a theorem, not a disclaimer:** when
projected utilization u = f/C stays below ≈0.8 on the winning corridor's
bottleneck, the same math shows the price of anarchy is ≤ ~1.04 and the
optimal θ\* puts all mass on the least-dose option anyway. Below that
load the layer must report `segregation: "inactive"` and route everyone
to argmin-dose — claiming flow-balancing benefit we cannot verify would
be the same class of lie docs/26 bans everywhere else. The mechanism
self-disables exactly when it cannot help.

Everything below is the proof and the algorithm.

---

## 1. The model: exposure routing as a congestion game

### 1.1 Notation

- Graph `G = (V,E)`, |E| = 1.07M directed edges (Delhi NCR extract).
  Edge sets are what they are: `alternatives()` returns K ≤ 3 corridors,
  each an edge list, each with real dose — nothing synthesized
  (routegraph.py:441–478).
- Edge latency for mode m: `t_e(f_e) = t_e⁰·(1 + α·(f_e/C_e)^β)` —
  BPR-form (Bureau of Public Roads 1964), α≈0.15, β=4, `C_e` the edge's
  practical capacity in PCU/h.
- **Dose-latency** — the cost our engine actually minimizes
  (routegraph.py:14–20, exposure.py:4):

      d_e(f_e) = C_e^air · me_m · up_hw · (VE_m/1000) · t_e(f_e)
               = d_e⁰·(1 + α·(f_e/C_e)^β),   d_e⁰ = κ_e·t_e⁰

  `C_e^air` is the sampled field concentration — a parameter of the
  edge, fixed within a field epoch (reweighted ≤10 min). The flow
  dependence enters **only through travel time**. Because dose is
  linear in `t_e`, the dose-latency *inherits the BPR shape verbatim*,
  scaled by `κ_e`. This is the mathematical pivot of the whole memo:
  congestion-aware air-quality routing needs no new cost model — the
  existing one, driven by a congested clock, already is one.

  (Honest scope note: `C_e^air` is treated as exogenous. A jam also
  emits, raising `C_e^air` on that and nearby edges — a second
  positive-feedback channel we do not model until an emissions-to-field
  coupling is measured. The mechanism below is therefore a *lower
  bound* on the herding problem; the real paradox is strictly worse.)

- Demand per epoch τ: users `i = 1…N`, each with OD pair, mode `m_i`,
  and vehicular demand `q_i` in PCU. **Only road-vehicle modes add
  flow**: car ≈ 1.0, auto ≈ 1.2, bike ≈ 0.5–0.75 PCU (Indo-HCM 2017
  priors). Metro, bus-riding, cycling, walking users contribute ≈ 0 —
  they ride existing capacity. The segregation lever exists *only* for
  flow-adding modes; for the others argmin-dose is already system-clean.
- Flow: `f_e = f_e^bg + Σ_i q_i·1[e ∈ c_i]` — background traffic
  (exogenous; observed through OSRM/AWS-route speeds or Indo-HCM
  priors) plus our own committed assignments `f_e^us`, which we know
  exactly.
- Cohort: users sharing an option set signature (same K-corridor family,
  same epoch). The unit of quota control.

### 1.2 Why independent argmin-dose fails

The platform returns `c* = argmin_c Σ_{e∈c} d_e⁰` to every user in the
cohort — evaluated *before* those users drive. With N users of mean PCU
q̄, realized utilization on c*'s bottleneck edge is

    u = (f^bg + N·q̄)/C_e

and the honest ex-post dose is `d_e⁰(1+αu^β)`, not the advertised `d_e⁰`.
At u=1.0 the BPR-4 premium is α·u^β = 15% over free flow; at u=1.2 it is
31%; the *marginal* harm each additional user causes is β× larger still
(§3). If the second corridor sat at u=0.4, the system — and most users —
were better off with a split. A naive argmin platform cannot express
"the optimal *mixture* of recommendations"; that is what quotas add.

---

## 2. User equilibrium vs system optimum — when Braess actually bites

### 2.1 Wardrop equilibrium

Let `𝒫_i` be the path set for commodity i, `x_P ≥ 0` the flow on path P,
`f_e = Σ_{P∋e} x_P`, cost `c_P(f) = Σ_{e∈P} c_e(f_e)` for class-appropriate
`c_e`. A feasible flow f\* is a **Wardrop user equilibrium** (Wardrop
1952) iff for every commodity and every `P` with `x_P > 0`,

    c_P(f*) ≤ c_{P'}(f*)   for all P' ∈ 𝒫_i

i.e., all used routes have equal, minimal *experienced* cost; no driver
can improve by unilateral rerouting. Equivalent variational-inequality
form (Smith 1979; Dafermos 1980):

    Σ_e c_e(f*_e)·(f*_e − f_e) ≤ 0   for all feasible f.

Existence follows from continuity of `c_e`; uniqueness of link flows
from monotonicity (strictly increasing `c_e` ⇒ strict convexity of the
Beckmann program below ⇒ unique `f*`). **This is what our current
system produces**: each user independently receives the
minimum-cost-under-conditions-she-will-help-create route. A monopoly
oracle answering argmin queries manufactures the UE by construction —
including when UE is bad.

### 2.2 Beckmann transformation and the system optimum

Wardrop equilibria are exactly the optima of the convex program
(Beckmann–McGuire–Winsten 1956)

    min_f  Φ(f) = Σ_e ∫₀^{f_e} c_e(x) dx      s.t. f feasible

because the KKT conditions of Φ reproduce Wardrop's equal-cost rule.

The **system optimum** minimizes total cost:

    min_f  Ψ(f) = Σ_e f_e·c_e(f_e).

Differentiate the summand: `d/df [f·c(f)] = c(f) + f·c'(f) =: m_e(f)`,
the **marginal social cost**. Substituting `m_e` for `c_e` in the
Beckmann program converts SO into a Wardrop equilibrium *with respect
to marginal costs* (Dafermos–Sparrow 1969):

    SO under c_e   =   UE under m_e = c_e + f_e·c'_e.

This is the entire theoretical basis of congestion pricing — and of our
per-user score (§3): charge each user the externality `f_e·c'_e(f_e)`
(Pigou 1920) and selfish behavior reproduces the social optimum.

### 2.3 The price of anarchy — bounds by latency family

`PoA = C_UE / C_SO ≥ 1` (Koutsoupias–Papadimitriou 1999). For nonatomic
flows (each user infinitesimal — the right abstraction for a cohort of
hundreds+ on a 1.07M-edge graph):

| latency family `c_e(x)` | PoA bound | tightness | source |
|---|---|---|---|
| constant (free-flow) | 1 — UE = SO | exact | trivial: c' ≡ 0 |
| affine `ax + b` | **4/3** | tight, 2-link Pigou network | Roughgarden–Tardos 2002 |
| polynomial deg ≤ p, coeffs ≥ 0 | `(1 − p·(p+1)^{-(p+1)/p})^{-1}` = Θ(p/ln p) | tight | Roughgarden 2003; Correa–Schulz–Stier-Moses 2004/08 |
| — deg 2 | 1.626 | | (formula) |
| — deg 4 (our BPR) | **2.151** | | (formula) |
| M/M/1 `1/(C−x)` | unbounded | as f→C | queuing divergence |

The Pigou example that achieves 4/3 is two parallel links, demand 1:
`c₁(x)=x`, `c₂(x)=1`. UE sends everyone down link 1, cost 1. SO splits
x=½, cost ¾. Ratio 4/3. **Crucially, the worst case needs only a
two-node, two-link network** (Roughgarden 2003: the price of anarchy is
independent of topology) — our 1.07M-edge graph buys us nothing; the
paradox lives at the bottleneck, not in graph size.

**Utilization-refined bound (the honesty knob).** The global bound
assumes unbounded loading. If every bottleneck edge satisfies `u ≤ ū`,
a direct variational computation for `c(x)=c⁰(1+αu^β)` gives

    PoA(ū) ≤ 1 / (1 − ρ(ū)),
    ρ(ū) = β·(β+1)^{-(β+1)/β} · αū^β / (1 + αū^β),

increasing in ū and recovering the global bound as ū→∞. For BPR-4
(α=0.15, β=4):

| ū | 0.5 | 1.0 | 1.2 | 1.5 | 2.0 | →∞ |
|---|---|---|---|---|---|---|
| PoA ≤ | ~1.005 | ~1.075 | ~1.15 | ~1.30 | ~1.61 | 2.151 |

**Read: selfish routing is provably near-optimal below capacity.** The
entire justification for intervention is congestion; at ū ≤ 0.8 the
bound is ≤ ~1.04 and shrinking fast. This table is the quantitative
basis of the §6 inactivity rule — computed, not asserted.

### 2.4 Braess's paradox, precisely

Braess (1968; English translation Braess–Nagurney–Wakolbinger 2005):
adding capacity can strictly worsen the unique UE for *every* user.
Canonical form — nodes s,v,w,t; demand 1; edges `s→v` and `w→t` with
`c(x)=x`; `v→t` and `s→w` with `c(x)=1`. UE splits ½–½, cost 3/2. Now
add the free shortcut `v→w`, `c≡0`. The unique UE sends *all* flow
through s→v→w→t; cost 2 > 3/2. Everyone loses 33%; deleting the best
edge would improve everyone. Severity: for single-commodity networks
with general latencies the Braess ratio can reach ⌊n/2⌋ (Roughgarden
2006), for affine latencies it is capped at the PoA's own 4/3, and for
k commodities affine bounds grow with k (Lin–Roughgarden–Tardos–
Walkover 2011) — multi-OD cohorts are the dangerous regime.

**Translation to ALive.** We never add edges; the mechanism's analog is
on the *recommendation* side. Braess's construction works because the
new link is a dominant option that everyone self-selects into until it
is overloaded. A platform that returns one corridor `c*` to an entire
cohort *is that dominant option made of existing road*: we synthesize
the shortcut by unanimity of recommendation. The conditions that make
it bite, concretely:

1. **Demand concentration**: cohort size × PCU comparable to a
   corridor's residual capacity — commute-peak OD clusters, event
   egress, office corridors. (Sporadic single requests can never
   trigger it; N·q̄ must move u materially.)
2. **Near-capacity baseline**: f^bg/C on `c*`'s bottleneck ∈ [0.8, 1.5].
   This is *precisely* the Delhi peak regime on e.g. Ring Road, DND,
   NH-48 approaches — the hours when users most need the app.
3. **Steep marginal cost**: near capacity, `c'(f)` ∝ β·u^{β−1} — the
   externality of one more vehicle is β=4× its private premium (§3.2).
   Free-flow roads have `c'≈0` and nothing to price.
4. **Homogeneous compliance**: all users receive the same argmin and
   (mostly) follow it. Heterogeneous mode VE already gives some free
   diversity — different modes have different argmins — but intra-mode
   convergence is total under naive argmin.

Conditions 2–4 are empirical; condition 1 is the design variable. The
quota layer exists to enforce controlled diversity — to keep the
*recommendation mixture* near the restricted system optimum on the
K-corridor option set instead of collapsing it to a point mass.

**Atomic honesty.** Wardrop/PoA theory is nonatomic. Our cohorts are
finite, sometimes small. Two facts keep the theory honest: (a) atomic
unsplittable congestion games still possess pure equilibria — Rosenthal
1973 potential — and their affine PoA is 5/2 (unweighted;
Christodoulou–Koutsoupias 2005) resp. φ²≈2.618 (weighted;
Bhawalkar–Gairing–Roughgarden 2014), i.e., *worse* bounds but over a
*smaller* effect; (b) when N is small, N·q̄/C is small and the §6
inactivity rule fires anyway. The mechanism degrades to argmin exactly
where the continuum approximation would mislead.

**Partial control.** We command only our own users, and only their
*displayed* option — compliance α < 1. This is Stackelberg routing
(Korilis–Lazar–Orda 1997): a leader routes fraction α of flow to induce
a better UE for the rest. Known results for linear latencies put
induced-equilibrium cost at roughly `≲ 4/(3+α)·SO` — interpolating from
4/3 at α=0 toward 1 at α=1 — while Bonifaci–Harks–Schäfer (2010) show
no strategy certifies SO at α<1 in general. Two implications we accept:
partial compliance degrades gains *gracefully* (no cliff), and the
segregation benefit is bounded by our platform share — a small-install
base cannot fix Delhi, and should not claim to.

---

## 3. Marginal-cost pricing applied to per-user recommendations

### 3.1 The adjusted score

For user i (PCU `q_i`, mode `m`) and corridor c, define the
**system-aware score**

    S_i(c) =  Σ_{e∈c} d_e(f̂_e)                       ← private dose
            + λ·Σ_{e∈c} f̂_e · [d_e(f̂_e + q_i) − d_e(f̂_e)]
                                                      ↑
                   externality our assignment causes on e (exact, atomic)

with f̂ the forecast post-assignment flow. For `q_i ≪ f̂_e` this
linearizes to the Pigouvian form

    S_i(c) ≈ Σ_{e∈c} [ d_e(f̂_e) + λ·f̂_e·d'_e(f̂_e)·q_i ].

At `λ=1`, `S_i` is i's marginal social cost; assigning each user to
`argmin S_i` is the decentralization of SO (§2.2). The score enters the
existing ranking exactly where dose does — decide.py's
`W_DOSE·norm + W_RISK + W_TIME` composition is unchanged; only the dose
term's argument changes from private to marginal.

### 3.2 Closed form under BPR-dose and the β-multiplier

With `d_e(f) = d_e⁰(1+αu^β)`, `u = f/C_e`:

    f·d'_e(f) = d_e⁰·αβ·u^β  =  β · [private congestion premium].

**The Pigouvian toll is β times the congestion premium the user already
feels.** At β=4 this is a 4× lever on the congestion-sensitive part of
dose — strong precisely where it should be (u→1) and ~0 in free flow
(u≤0.5 ⇒ αu^β<1% ⇒ toll < 4%·d⁰·share). Concretely, at u=0.9: private
premium 9.8% of free dose, toll 39%. At u=1.1: premium 22%, toll 88%.
The same steepness that creates the paradox gives us a strong,
correctly-shaped correction term for free.

### 3.3 Which flow to price: platform-selfish vs socially-aligned

`f̂` decomposes as `f^bg + f^us`. Two λ-scopes:

- **Platform-selfish**: objective `min Σ_{i∈us} dose_i`. The toll
  internalizes only harm to *our* users: `f^us_e·d'_e·q_i`. Treats
  background congestion as weather. Maximizes cohort welfare; can
  still dump our users onto a bg-saturated corridor if it spreads ours.
- **Socially-aligned**: `f̂_e = f^bg_e + f^us_e` in the toll — we pay the
  harm done to Delhi's traffic, not just ours. Correctly repels our
  cohort from corridors saturated by *anyone's* herding (including
  other navigation apps' — whose demand we cannot see but whose *speed
  effect* we observe through the same u).

This memo recommends socially-aligned `λ=1` — it is the version that is
also selfishly correct whenever f^bg dominates (it pushes us off
saturated roads regardless of who saturated them), and it makes the
government-facing claim defensible: we are not optimizing our users
*against* the city. Residual honesty: `f^bg` is inferred from speeds,
not counted; report it as estimate.

### 3.4 What marginal scoring alone cannot do

Marginal scoring changes the *ranking* shown to a user — but if applied
uniformly it still returns *one* argmin per request, now of `S_i` rather
than `d_i`. If `argmin S` is the same corridor for everyone, we have
re-priced the herd, not split it: UE under `m_e` on a saturated corridor
is better than UE under `c_e` (it IS the SO — but only when the toll is
*paid by everyone*). Our toll is virtual — a score term — and paid only
by our users, only through compliance. The instrument that actually
diversifies flow is the quota (§4); the marginal score tells the quota
*what the right split is* and gives each assigned user a legible,
signed rationale ("corridor A full — your route costs +x µg, saves the
corridor ~y").

---

## 4. Top-K quota assignment

### 4.1 Corridor capacity

Each corridor `c_j` (edge set from `alternatives()`) has effective
residual capacity

    resid_j = min_{e ∈ crit(j)} (C_e − f^bg_e),   crit(j) = {e∈c_j : u_e ≥ u*},

the bottleneck being the tightest *critical* edge (u* ≈ 0.8). `C_e`
comes from OSM `highway`×`lanes` × Indo-HCM PCU rates — a prior, ±.
Edges are shared across corridors (the 0.85 shared-length gate bounds,
does not eliminate, overlap), so capacities couple through `f_e =
f^bg_e + q̄·Σ_{j:e∈c_j} x_j` — we do NOT model corridors as disjoint
parallel links; the load sum below keeps shared edges honest.

### 4.2 The optimal split θ\*

Let `x_j` = PCU flow we commit to corridor j, `Q = N·q̄` cohort demand,
`x_j = θ_j·Q`. The restricted system optimum on the K-option set:

    min_x  Ψ(x) = Σ_e (f^bg_e + Σ_j x_j·1[e∈c_j]) · d_e(f^bg_e + Σ_j x_j·1[e∈c_j])
    s.t.   Σ_j x_j = Q,   0 ≤ x_j ≤ resid_j,   x_j = 0 for ineligible j.

**Eligibility gate** (the bounded-sacrifice constraint):
`j ∈ E` iff `D_j(x→) ≤ (1+r)·min_j D_j` and j feasible — `r ≈ 0.10–0.15`,
the same near-tie band doc-31 uses for dose↔emissions trades. No user
may be asked to sacrifice more than fraction r of their private best.
This single constraint converts "system assignment" into something a
user can accept: our maximum *individual* ask is r, declared on the
wire via the existing `dose_vs_best_pct` field.

Ψ is a positive-definite quadratic in x for affine `d_e` — and strictly
convex monotone for BPR — so `x*` is unique in link loads and the KKT
conditions give the water-filling characterization: there exists a
shadow price λ\* such that every used corridor has equal *marginal*
cost `m_j(x*) = λ*`, unused corridors have `m_j(0) ≥ λ*` (or are
cap/exclusion-limited). Solving is trivial: K ≤ 3, support enumeration
≤ 2^K − 1 cases, or Newton on λ\* — §7. The output is `θ*_j = x*_j/Q`.

**Interpretation: quotas are non-monetary Pigouvian tolls.** A toll
decentralizes SO by changing what each user *wants*; a slot quota
decentralizes it by changing what each user is *told*. Same fixed
point, different instrument — ours requires no payment rail, no
regressivity, and no user model beyond "the app said so."

### 4.3 Deterministic device-hash slotting

Given θ\*, assign each device a slot *without storing per-device state*:

    u_i = H(token_i ‖ cohort_id ‖ τ) / 2^64     ∈ [0,1)
    slot(i) = min{ j : u_i < Σ_{ℓ≤j} θ*_ℓ }      — cumulative-quantile cut

`H` = SHA-256 (the token is already a self-minted pseudonymous id —
middleware.py:83; hashing it again adds nothing identifiable).
`cohort_id` is a signature over the K corridors' edge sets; `τ` the
epoch index. Properties by construction:

- **Stateless & reproducible**: any replica computes the same slot —
  survives horizontal scaling, restarts, retries. No sticky sessions.
- **Realizes θ\* as a lottery**: `P(slot=j) = θ*_j` per device (treating
  H as a uniform oracle — the standard consistent-hashing assumption,
  Karger et al. 1997).
- **Anti-gaming**: a device that mints fresh tokens to re-draw gets a
  fresh lottery draw over the *same eligible set* — worst case bounded
  by r, expectation identical. Rate-limit on token churn stays as the
  cheap belt on this suspenders-tight bound.
- **Small-N exactness option**: if cohort N < ~30, replace hash-slotting
  by a stateful counter cut at exact quantiles — |realized − θ·N| < 1.
  Flagged but not recommended; statelessness is worth O(√N) slack.

### 4.4 Fairness — five propositions with proofs

**P1 (ex-ante envy-freeness).** For any two devices i, i′:
`E[dose_i] = E[dose_i′] = Σ_j θ*_j D_j`. *Proof:* `P(slot_i=j) = θ*_j`
for every i ⇒ identical expected cost. Jain's index over expected dose
= 1. The lottery treats equals equally — nobody is designated the
sacrifice class. ∎

**P2 (cap feasibility w.h.p.).** Realized slot load `N_j ~ Bin(N, θ*_j)`.
Choosing `θ*_j ≤ resid_j(1−ε)/(N·q̄)` with safety margin ε gives

    P(violation of resid_j) ≤ exp(−ε²·θ*_j·N/3)   (Chernoff).

The bound bites once `θ*_j·N` is in the hundreds — ε=0.2, θ·N=300 gives
≤ e^{−4} ≈ 2% — and falls exponentially thereafter. Below that scale the
tail bound is honestly weak; the guarantee then comes from deterministic
overflow: a device drawing a slot whose live counter exceeds `resid_j`
falls through to the next eligible slot — bounded distortion, never a
hard denial. ∎

**P3 (intertemporal equalization, Weyl rotation).** Epoch-reshuffling
via `u_i(τ) = frac(h_i + τ·φ)`, `φ = (√5−1)/2`, gives each device a
*low-discrepancy* rotation through the θ-cells rather than an iid
redraw. For an irrational rotation with bounded continued-fraction
coefficients — φ is optimal — the star-discrepancy is
`D*_T = O(log T / T)` (Kuipers–Niederreiter 1974), so

    | (1/T)·Σ_{τ≤T} dose_i(τ) − E_slot[dose] | = O(log T / T)

i.e., every device's *time-averaged* dose converges to the cohort mean
at rate O(log T/T) — strictly faster than iid reshuffling's O(1/√T) —
and no device can be permanently unlucky: repeated sacrifice is
provably bounded. ∎

**P4 (bounded individual regret ⇒ incentive compatibility).**
Eligibility ⇒ `dose(assigned) ≤ (1+r)·dose(private-best)` ⇒ per-trip
regret ≤ r, and expected regret `Σ_j θ*_j(D_j − D_min) ≤ r·(1−θ*_{argmin}) < r`.
A user gains ≤ r by defecting to their private best. With r ≈ 0.10 the
defection prize is inside the dose band we already report as
approximate — friction plus an honest trade line sustains compliance;
and even at α-compliance, §2.4's Stackelberg interpolation keeps the
degradation smooth. ∎

**P5 (the assignment is a tolled Wardrop equilibrium).** Within the
cohort, the pair (θ\*, slotting) constitutes a UE *with respect to the
adjusted score* `S_i` of §3: every device's assigned option minimizes
`S_i` given the virtual tolls the quota implies, up to the quantization
error of one user — an ε-UE with `ε = O(q̄/C̄)`. *Proof sketch:* θ\* is
the KKT point of restricted-SO; KKT equality of marginal costs across
used corridors is exactly the Wardrop condition under `m_e`; slotting
implements θ\* atomically with per-device error bounded by one quantum.
∎

### 4.5 What quotas deliberately are not

A quota assignment is **not** a free Wardrop equilibrium: some users
are held off their argmin. That is the point — the free equilibrium is
the disease. Nor is it rationing by income, priority, or profile: the
lottery is over a hash, ex-ante uniform, with a published regret cap r
and rotation fairness — the three properties a public-fairness audit
can verify from the algorithm alone.

---

## 5. The dynamic variant: rolling horizon with hysteresis

### 5.1 Epoch dynamics

Quotas live on epoch τ aligned with the field refresh (PathEngine
reweights ≤10 min). Per epoch: recompute f̂^bg from current speeds, the
committed-flow counters roll with TTL, and re-solve θ\*_τ per cohort.

### 5.2 Damped update — why not just recompute

Publishing fresh argmin-derived θ\* each epoch invites the classic
recommender oscillation: corridor A is declared fuller → next epoch's
flow overshoots to B → A looks empty → flow swings back. Undamped
best-response dynamics on shared congestion estimates diverge or
limit-cycle even when a unique equilibrium exists; damped updates —
the method-of-successive-averages family — converge for monotone-cost
congestion models (Sheffi 1985; Smith 1984 dynamic stability). Apply:

    θ_τ = proj_simplex[ (1−γ)·θ_{τ−1} + γ·θ*_τ ],   γ ≈ 0.25–0.5.

γ trades responsiveness for stability; γ=1 is the oscillating special
case. Since our restricted-SO is a small strictly-convex program, the
damped iteration converges to the unique θ\* for γ in the MSA-stable
range — and any fixed θ is implementable, there is no equilibrium
condition *between* epochs to lose.

### 5.3 Per-device hysteresis

Even with damped θ, per-request reslotting would flip individual users
between corridors on every refresh — bad UX, and dangerous mid-trip.
Pin rule: a device keeps its current slot while EITHER

- (a) the fresh draw `u_i(τ)` still falls inside slot j's θ-band widened
  by hysteresis margin δ (`[Θ_{j−1} − δ, Θ_j + δ]`), or
- (b) the device is within an active trip (pin TTL = trip end; reroute
  stays governed by /v2/reroute's materiality rules, not this layer).

Reslot only when the band has moved > δ *and* the user re-queries.
**Consequence — bounded churn:** each device's slot changes only when
cumulative θ-drift exceeds δ, so flips per device per epoch ≤
`Δθ_T/δ` where `Δθ_T` is total θ-variation — O(1) under damping.
This is precisely the bounded-rationality indifference band of
Mahmassani–Chang (1987) implemented server-side: their existence and
stability results for band-indifferent UE carry over, i.e., the
hysteresis band is not a hack, it is a convergent equilibrium regime.

### 5.4 Cold start & shrinkage

A cohort's first epoch has no θ_{τ−1}: use `θ_0 = θ*_0` computed on
f^bg alone (no committed flow yet). Committed-count estimates shrink
toward realized check-ins as they accrue; forecast `N` itself from the
rolling request rate per cohort — and when the estimator's confidence
is low, prefer inactivity (§6) over acting on noise.

---

## 6. Honesty: when the quotas must be *inactive*

This section is the product's license to claim anything at all.

**Theorem (inactivity regime).** If for the winning corridor's
bottleneck edges projected utilization `u = (f^bg + N·q̄)/C < u_on` —
with `u_on ≈ 0.8` — then: (a) by §2.3's refined bound, `PoA ≤ ~1.04`
and falling; (b) the KKT solution of restricted-SO has θ\* ≈ e_{argmin}
(all mass on the least-dose option) up to the toll-resolution —
because below u_on the marginal-cost ordering equals the private-cost
ordering. *Sketch:* at u<0.8, `f·d'_e` contributes < ~15% of `d_e` to
the marginal score; unless corridors tie within that band, argmin is
unchanged; when they do tie, the split is real but inconsequential
(PoA bound). Either way: **the correct recommendation is the naive
one.** ∎

Operational rules:

1. Compute `u_crit = max_{e∈crit(c*)} (f^bg_e + N̂·q̄)/C_e` per request.
2. `u_crit < u_on` or `N̂ < n_min` (cohort too small to move u by ≥ ~2%)
   → return argmin-dose, set `segregation: "inactive"` on the wire.
3. When active, report it: `segregation: "active"`, the assigned slot's
   `dose_vs_best_pct` (the existing field — the user's visible,
   bounded sacrifice), and an audit counter of shifted share.
4. **Never** claim city-level congestion benefit. Our controllable
   fraction ρ = f^us/(f^bg+f^us) is what it is; when ρ ≪ 5%, we may
   still segregate *for our users' own dose* (platform-selfish §3.3)
   but the public-impact claim is zero. The government doc should say
   this in so many words.
5. Capacity priors C_e are ±; treat caps as soft targets, adapt them
   online from realized speed observations, and prefer under-claiming.
   An over-tight cap is a missed optimization; an over-loose one is a
   fabricated benefit.

The strongest version of this honesty: the same scalar — projected
utilization — gates, parameterizes, and justifies the mechanism. One
number decides whether we segregate, how hard, and whether we may say
so. If the number is wrong, we degrade to today′s behavior, not to a
wrong one.

---

## 7. The assignment algorithm

### 7.1 Pseudocode

```
# per-request — sits between PathEngine.alternatives() and plan response
ASSIGN(token, o, d, mode, t):
    C ← PATH_ENGINE.alternatives(o, d, mode)          # ≤K corridors, real doses
    if len(C) = 1 or mode ∉ FLOW_ADDING_MODES:        # metro/bus/walk/cycle add ~0 PCU
        return C[0]                                   # argmin is system-clean
    τ  ← epoch(t)                                     # ~ field refresh cadence
    cg ← cohort_sig(C)                                # hash of corridor edge sets
    N̂, f_bg ← FORECAST(cg, τ)                         # cohort size + background load
    u_crit ← max over crit(c*) of (f_bg[e] + N̂·q̄)/C_e
    if u_crit < U_ON or N̂ < N_MIN:                    # §6 — honesty gate
        return C[argmin dose]  +  {segregation: "inactive"}

    E ← { j : D_j ≤ (1+R)·min D_j  and  resid_j > 0 } # eligibility / regret cap
    θ_prev, θ* ← THETA[cg], SOLVE_SPLIT(E, N̂·q̄, f_bg, resid)
    θ ← proj_simplex( (1−γ)·θ_prev + γ·θ* );  THETA[cg] ← θ          # damping §5.2

    u ← SHA256(token ‖ cg ‖ τ) / 2^64                 # §4.3 deterministic draw
    j ← PIN[token]  if fresh(τ) and u ∈ widened_band(j, θ, δ)        # hysteresis §5.3
        else  min{ j : u < cumθ_j }                                # quantile slot
    if OVERFLOW[cg][j] ≥ resid_j·(1−ε): j ← next_eligible(j)       # P2 fallback
    PIN[token] ← (cg, j, τ);  OVERFLOW[cg][j] += q_i
    return C[j] + {segregation:"active", dose_vs_best_pct, trade_line}

# per (cohort, epoch) — KKT water-filling on the restricted SO
SOLVE_SPLIT(E, Q, f_bg, resid):
    # min_x Σ_e (f_bg[e]+Σ_j x_j·1[e∈c_j])·d_e(...)   s.t. Σx=Q, 0≤x≤resid
    for each support S ⊆ E (≤ 2^K−1 sets, K≤3):
        solve λ : Σ_{j∈S} x_j(λ) = Q                      # Newton / bisection on λ
        where x_j(λ) = unique x with m_j(x) = λ           # m_j = marginal corridor dose
            clipped to [0, resid_j]
        if all x_j(λ) ≥ 0 and KKT residuals satisfied:
            return θ* = x / Q
    return θ* = e_argmin                                  # degenerate → inactive

# per epoch — forecast roll
EPOCH_UPDATE(τ):
    f_bg ← infer from current speeds on critical edges    # OSRM/AWS duration → u
    N̂[cg] ← EMA of committed counts over last W epochs
    expire OVERFLOW and PIN entries past TTL
```

`m_j(x) = Σ_{e∈c_j} q̄·d'_e(f_bg[e] + x·1[…] + other corridors' shares)·…`
— evaluated directly on edge sets so shared edges are charged their
joint load (§4.1). For affine `d_e` the inner solve is a convex QP —
active-set in O(K³); for BPR-4, bisection on λ since `m_j` is monotone.

### 7.2 Complexity

| component | cost | note |
|---|---|---|
| `alternatives()` | already paid by /v2/plan — ≤ ALT_MAX_ATTEMPTS=4 A* runs | no added graph work |
| cohort_sig | O(K·L), L = edges/corridor (~10²–10³) | hash once per request |
| eligibility filter | O(K) | |
| SOLVE_SPLIT | support enum ≤ 7 sets × O(K·L) edge evals × ~O(log 1/ε) bisection | < ~10⁵ flops, sub-ms for K≤3 |
| hash slot | O(1) hash + O(K) scan | |
| pin/overflow maps | O(1) lookup, O(N_active) memory, TTL'd | |
| per-epoch sweep | O(#cohorts · SOLVE_SPLIT) | cohorts = active option-set signatures, bounded by traffic |
| state | θ, counters only — **no per-device rows** | slot derives from hash |

Everything in the request path after `alternatives()` is O(K·L) ≈ O(10³)
operations — inside the latency headroom doc-33 measured (plan solves
are 0.5–3 s; this adds microseconds). The layer is cheaper than the
JSON encoder that wraps it.

---

## 8. What we cannot claim (registered, not buried)

- We do not observe or control background flow or other platforms'
  herding. `f^bg` is inferred; ρ = our share bounds our leverage.
- Quotas act on *recommendations*. Defection is free (bounded by r);
  the Stackelberg interpolation absorbs degraded compliance smoothly
  but also caps the upside.
- `C_e` is an Indo-HCM prior, not a measurement, until speed-based
  calibration ships. Soft caps, conservative u_on.
- The dose–congestion model prices time, not the emissions feedback a
  jam adds to `C_e^air` — §1.1. The paradox is likely *worse* than
  modeled; the fix generalizes unchanged (κ_e gains a flow term).
- Atomic small-cohort regimes degrade to argmin by design (§6), which
  is honest and also means: at early adoption this layer is a silent
  no-op. Ship the wire flag from day one so its activation is
  observable when scale arrives.

---

## References

1. Wardrop, J.G. (1952). "Some theoretical aspects of road traffic research." *Proc. Inst. Civil Engineers*, Part II, 1(3):325–362.
2. Beckmann, M., McGuire, C.B., Winsten, C.B. (1956). *Studies in the Economics of Transportation.* Yale University Press.
3. Pigou, A.C. (1920). *The Economics of Welfare.* Macmillan.
4. Braess, D. (1968). "Über ein Paradoxon aus der Verkehrsplanung." *Unternehmensforschung* 12:258–268. [English: Braess, Nagurney, Wakolbinger (2005), *Transportation Science* 39(4):446–450.]
5. Koutsoupias, E., Papadimitriou, C. (1999). "Worst-case equilibria." *STACS '99*; rev. *Computer Science Review* 3(2):65–69, 2009.
6. Roughgarden, T., Tardos, É. (2002). "How bad is selfish routing?" *J. ACM* 49(2):236–259.
7. Roughgarden, T. (2003). "The price of anarchy is independent of the network topology." *J. Comput. Syst. Sci.* 67(2):341–364.
8. Roughgarden, T. (2004). "Stackelberg scheduling strategies." *SIAM J. Comput.* 33(2):332–350.
9. Roughgarden, T. (2006). "On the severity of Braess's paradox: designing networks for selfish users is hard." *J. Comput. Syst. Sci.* 72(5):922–953.
10. Lin, H., Roughgarden, T., Tardos, É., Walkover, A. (2011). "Stronger bounds on Braess's paradox and the maximum latency of selfish routing."
11. Korilis, Y.A., Lazar, A.A., Orda, A. (1997). "Achieving network optima using Stackelberg routing strategies." *IEEE/ACM Trans. Networking* 5(1):161–173.
12. Bonifaci, V., Harks, T., Schäfer, G. (2010). "Stackelberg routing in arbitrary networks." *Math. Oper. Res.* 35(2):330–346.
13. Rosenthal, R.W. (1973). "A class of games possessing pure-strategy Nash equilibria." *Int. J. Game Theory* 2:65–67.
14. Christodoulou, G., Koutsoupias, E. (2005). "The price of anarchy of finite congestion games." *STOC '05*, 67–73.
15. Bhawalkar, K., Gairing, M., Roughgarden, T. (2014). "Weighted congestion games: the price of anarchy, universal worst-case examples, and tightness." *ACM Trans. Econ. Comput.* 2(4).
16. Correa, J., Schulz, A., Stier-Moses, N. (2004). "Selfish routing in capacitated networks." *Math. Oper. Res.* 29(4):961–976; and (2008) "A geometric approach to the price of anarchy in nonatomic congestion games." *Games Econ. Behav.* 64(2):457–469.
17. Smith, M.J. (1979). "The existence, uniqueness and stability of traffic equilibria." *Transp. Res. B* 13(4):295–304; (1984) "The stability of a dynamic model of traffic assignment — an application of a method of Lyapunov." *Transp. Sci.* 18(3):245–252.
18. Dafermos, S.C., Sparrow, F.T. (1969). "The traffic assignment problem for a general network." *J. Res. NBS* 73B:91–118; Dafermos, S.C. (1972) "The traffic assignment problem for multiclass-user transportation networks." *Transp. Sci.* 6:73–87; (1980) "Traffic equilibrium and variational inequalities." *Transp. Sci.* 14(1):42–54.
19. Sheffi, Y. (1985). *Urban Transportation Networks.* Prentice-Hall. [MSA/damped-assignment convergence.]
20. Mahmassani, H.S., Chang, G.-L. (1987). "On boundedly rational user equilibrium in transportation systems." *Transp. Sci.* 21(2):89–99. [Indifference-band UE — the hysteresis regime.]
21. Bureau of Public Roads (1964). *Traffic Assignment Manual.* US Dept. of Commerce. [BPR function α=0.15, β=4.]
22. Karger, D., et al. (1997). "Consistent hashing and random trees." *STOC '97*, 654–663.
23. Kuipers, L., Niederreiter, H. (1974). *Uniform Distribution of Sequences.* Wiley. [Star-discrepancy of Weyl/Kronecker sequences, O(log T/T).]
24. CSIR-CRRI (2017). *Indian Highway Capacity Manual (Indo-HCM).* [PCU factors & lane capacities.]
25. Vickrey, W.S. (1969). "Congestion theory and transport investment." *Amer. Econ. Rev.* 59(2):251–260.
