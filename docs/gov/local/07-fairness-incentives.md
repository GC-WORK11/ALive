# gov/local/07 — Fairness & Incentives for Load-Segregated Assignments

*Research + spec deliverable. Question: when ALive steers a fraction of
users to their 2nd-best option to keep a corridor breathable, who takes
the hit, how do we say so without lying, what does a turn earn, does the
week even out, can it be gamed, and who is never asked.*

Sister docs: 22 (contribution-loop design — owns the incentive-evidence
base: INSINC, corpses/survivors), 26 (honest impact ledger — owns the
kill-list ethic), 31 (dual-objective routing — owns option ranking),
12 (lung ledger — owns the on-device account), `docs/plan/hi-glossary.md`
(Hindi register), `PRIVACY.md` (owns every claim about device-keyed
state). Where this doc proposes new server state or a new public claim,
the change is flagged as an owner decision against those files.

---

## 0. Verdict up front

**Recommended mechanism — a three-layer hybrid, none of the pure
schemes alone:**

1. **Rotation decides who is asked.** Per (corridor, 15-min) epoch, the
   needed overflow `s_e` is taken from the eligible participants with the
   *lowest lifetime deficit* `d_i = D_i − a_i` (turns taken minus accrued
   fair share), ties broken by a publicly auditable seeded lottery. This
   is deficit-round-robin applied to sacrifice, and it gives the strong
   guarantee proved in §6: **in the stationary case every user is within
   ±1 turn of exact equal share over any window — deterministically,
   not just in expectation.** A pure lottery cannot say that.
2. **Credits thank who accepts, they never buy priority.** A small
   ₹-denominated credit plus a weekly pooled draw (INSTANT/INSINC
   structure — both proven, one of them in Bangalore) accompanies every
   ask. Payment is a receipt for a turn, never a market for clean air;
   the sacrifice cap in §2.4 is what makes that distinction real.
3. **The assignment is a default, not a block.** Option 2 is the
   pre-selected, honest-labelled recommendation; option 1 stays one tap
   away, always, penalty-free. Defaults deliver most of the shift
   (opt-out rates in every default-effect study run in the single
   digits) without ever creating a coercive moment — and this one design
   decision solves the emergency/accessibility edge cases structurally
   (§8), because the escape hatch is universal.

Everything else — fixed hashing, pure lottery, pure pay-to-shift — is
either unfair at the tail, unverifiable, or politically toxic. The
details and the honest limits are below.

---

## 1. The setting — why "option 2" exists at all

Load segregation is not a fairness tax invented to look civic. It
exists because *unmanaged convergence is self-defeating*:

- **Time:** left to themselves, users sort into a Wardrop equilibrium —
  everyone on the personally-best route until it's jammed enough that
  alternatives tie. For linear latency functions the price of anarchy is
  4/3 (Roughgarden & Tardos): unmanaged convergence can waste ~33% of
  aggregate travel time. A controller routing even a minority of flow
  strictly improves the equilibrium — the Stackelberg-routing result
  (Korilis–Lazar–Orda 1997; Roughgarden 2004). Splitting demand is what
  a central view is *for*.
- **Air (our actual objective):** a corridor's "lightness" is partly a
  function of how much traffic it carries. Route every user to the one
  clean corridor and two things happen: trip time inside the corridor
  stretches (dose = concentration × time × ventilation — the same
  physics `server/exposure.py` prices), and the corridor absorbs the
  emission load that makes it less clean. Honest caveat, flagged
  docs/25-style: **our served field is not yet coupled to live traffic
  emissions** — we measure where the air is dirty, we do not yet close
  the loop that models a convoy of diverted autos *making* it dirty.
  Until that loop exists, the honest justification for segregation is
  congestion/time (well-evidenced) plus a qualitative emissions argument
  (directionally true, unquantified in our field). Say it that way.

So the design problem is real: in any epoch where projected demand for
option 1 exceeds the corridor's capacity `K_e`, `s_e = n_e − K_e`
participants get option 2. Who are they, what are they told, and what
do they get?

**Definitions used throughout.**

- **Epoch** `e` = (corridor `c`, 15-min window `w`). Corridors are the
  H3/edge-cluster objects the PathEngine already returns as "corridor-
  diverse alternatives"; the window matches the field reprice cadence.
- **Participants** = users whose *started trip* (not plan request — see
  §7, gaming) is projected to enter `c` inside `w`.
- **Option 1** = the user's dose-ranked best feasible option (doc 31's
  ranking: dose first, near-tie by emissions). **Option 2** = their best
  feasible alternative not using the saturated corridor.
- **Sacrifice** `Δ_i` = the user's own utility gap between options —
  expressed to the user in the two units they already see: minutes and
  smoke-heaviness.

---

## 2. Who bears the cost — the three candidate schemes, and their envy bounds

There are exactly three places the cost of `s_e` bad draws can land:
randomly on today's unlucky (hash), evenly on everyone over time
(rotation), or on the sponsor's budget (voluntary). They are not
equivalent — they differ in *who feels cheated*.

### 2.1 Deterministic hashing (fixed slot)

Scheme: `slot_i = H(token_i) mod n`; in each epoch, the lowest `s_e`
slots take option 2.

- Cost: zero state — trivially fits "no user rows."
- Fairness: ex-ante envy-free (before your slot is drawn, everyone's
  chances are equal) and **ex-post catastrophically unequal**: slot 0
  sacrifices on *every* congested trip, the top slots never do. Over a
  year of `T` congested epochs, `D_i ∈ {≈0, ≈T·q}` — maximal variance,
  and the losses are **correlated**: the same hash loses on every
  corridor, so an unlucky user is deprioritized everywhere at once.
- Verdict: **reject.** It is the cheapest mechanism and the worst
  fairness object. It also has a political-history warning attached —
  the 1970 US draft lottery's birthdate draw was insufficiently mixed,
  produced non-uniform risk by birth month, and detonated public trust
  in the draw itself (Starr 1997). A fairness mechanism whose outcome
  is visibly predictable gets read as rigged even when it's merely
  clumsy.

### 2.2 Day-salted hashing (redeal lottery)

Scheme: `r_i(e) = HMAC(day_seed, epoch_id ‖ SHA256(token_i))`; lowest
`s_e` ranks take option 2. Each epoch is an independent uniform draw.

- Cost: still near-zero state (one daily seed).
- Fairness: ex-ante envy-free. Ex-post, each user's sacrifice count
  `D_i ~ Binomial(T, q̄)` with `q̄` their mean overflow rate — symmetric
  in expectation but **heavy-tailed in practice**. For a daily commuter
  hitting ~5 congested epochs a week with `q̄ = 0.4`: `E[D] = 2`,
  `σ = √(5·0.4·0.6) ≈ 1.1`; over `N = 10⁴` users the Chernoff+union
  tail puts the unluckiest near `E[D] + 4σ ≈ 6` — someone sacrifices
  on ~6 congested trips while a neighbour sacrifices zero. That user is
  not paranoid; the lottery *did* single them out. "It was random" is
  not an answer a wronged tail accepts, and §4's transparency makes the
  tail *visible*.
- Verdict: acceptable only as the **tie-break inside rotation** and as
  the fallback for anonymous users (§3.3). Never the mechanism.

### 2.3 Rotating slots (deficit rotation)

Scheme: keep per-token counters `D_i` (turns taken) and `a_i` (accrued
fair share, `Σ_{e∋i} s_e/n_e`). Each epoch, offer the option-2 default
to the `s_e` participants with the lowest deficit `d_i = D_i − a_i`;
ties by the seeded lottery `r_i(e)`.

- Cost: real but small — two numbers per active token. This is the one
  scheme that *needs* device-keyed state, and §3.3 shows how it fits
  inside the existing ledger claim rather than inventing a new one.
- Fairness: the strongest achievable — §6 proves that for a stationary
  cohort `max D_i − min D_i ≤ 1` after every epoch, i.e. everyone is
  within ±1 turn of exact equal share **at every point in time**, and
  §3.1 gives the general priority guarantee (no user ever sacrifices
  while a co-participant with a strictly higher deficit keeps option 1).
  Envy, when it occurs, is *compensating* envy only.
- Behavioural bonus: rotation is *legible*. "Your turn / my turn" is a
  fairness schema every Delhiite already runs — queues, बारी-बारी,
  odd-even's intended spirit — unlike "the hash chose you," which
  nobody can audit emotionally.
- Verdict: **the core mechanism.**

### 2.4 Voluntary incentives (self-selection)

Scheme: offer `s_e` credits; whoever accepts takes option 2.

- Efficiency: the best of the three — volunteers are exactly the
  participants with the *lowest* sacrifice disutility, so the same load
  shift is bought at minimum total cost. Empirically it works at small
  stakes: Spitsmijden moved ~50% of participants' peak car trips for
  €2–7/day (Bliemer, Dicke-Ogenia & Ettema 2010); INSTANT shifted
  thousands of Bangalore commutes for a ₹96k/week lottery pool (§5.1).
- The catch, and it is ethical not technical: a pure market allocates
  the burden to **whoever most needs the money**. Uncapped, it is a
  mechanism for paying poorer users to breathe dirtier air — an
  environmental-justice red line with a ₹ sign. The fix is not to ban
  payment but to cap what is being sold: **the IR cap.** We only ever
  *ask* when option 2 is genuinely near-equivalent (`Δdose ≤ 15%` **and**
  `Δtime ≤ 5 min`, absolute ceilings in §9). Under the cap, the credit
  pays for a small inconvenience, never for health — "a thank-you for
  taking a turn," not compensation for smoke. That distinction is the
  whole game and it must be in the copy (§10).
- Second catch: budget and retention physics. Rewards must keep flowing
  or behaviour reverts — when Spitsmijden's incentives ended,
  participants returned to the peak. This is OPEX, not a vaccine.
- Verdict: **complement, not substitute.** Incentives sweeten the
  rotation's ask; they do not choose the asked.

### 2.5 Scoreboard

| Scheme | State needed | Ex-ante EF | Ex-post bound | Legible? | Toxic modes |
|---|---|---|---|---|---|
| Fixed hash | none | yes | none — `D_i ∈ {0, Tq}` | no ("rigged") | correlated losses everywhere |
| Day-salted lottery | 1 seed | yes | tail: `E[D]+3σ` over `N` | weak | unlucky-tail resentment |
| **Deficit rotation** | 2 counters/token | yes | **±1 of fair share (proved)** | yes (turns) | none found |
| Voluntary | budget + ledger | n/a | none — burden follows price sensitivity | yes | paying the poor to breathe worse; reverts when unfunded |

**Recommendation stands:** rotation picks the asked, credits thank the
accepter, override is always free. The lottery survives only as
tie-break and audit.

---

## 3. Envy-freeness — what is achievable, stated precisely

Perfect ex-post envy-freeness is impossible by construction: in every
congested epoch *someone* gets the worse option. The honest targets are
the three relaxations the fair-division literature actually uses:

- **Ex-ante envy-freeness** — before the draw, all participants have
  identical expected outcome. Achieved by any symmetric mechanism; our
  seeded tie-break provides it.
- **EF1-style (envy-free up to one assignment)** — removing any single
  epoch's assignment event makes every user envy-free *in count*. The
  rotation's ±1 bound (§6) is exactly this: Lipton–Markakis–Mossel–
  Saberi (EC'04) and Budish's approximate competitive equilibrium are
  the canonical results; Freeman–Shah–Vaish (EC'20) showed ex-ante EF
  and ex-post EF1 can hold *simultaneously*, which our lottery-
  tie-break + rotation also achieves.
- **No justified envy (priority-respecting)** — from matching theory:
  an assignment respects priorities if nobody who kept option 1 had a
  *weaker* fairness claim than somebody pushed to option 2.

### 3.1 The claim we can prove and print

> **Claim (no non-envied sacrifice).** If user `j` is assigned option 2
> in epoch `e`, then every co-participant `i` who kept option 1 had
> `d_i ≥ d_j` — no user ever sacrifices while a strictly-more-owed
> co-participant breathes easy.
>
> *Proof.* Selection takes the `s_e` lowest deficits (§9, rule S2). If
> `d_i < d_j` for a kept user `i`, then `i` belongs to the selected set
> and `j` does not — contradiction. ∎

One line, fully provable, and it is the entire answer to "why me and
not him": *because his turn count was higher than yours, and you can
check it* (§3.3 auditability).

### 3.2 What we deliberately do not promise

- **Equal *cost*** `Δ_i`: option 2 hurts some users more than others
  (an asthmatic's 4% is not an office worker's 4%). Equalizing turns is
  provable; equalizing felt sacrifice is not — the IR cap + exemptions
  (§8) bound the worst felt costs instead. Say so.
- **Welfare-maximizing assignment**: lowest-deficit ignores whose
  option-2 gap is smallest. Voluntary acceptance partially recovers the
  efficiency (the people for whom the gap is largest override or
  decline). Honest: we trade a little efficiency for a provable,
  auditable fairness rule.

### 3.3 Where the counters live (privacy fit)

`PRIVACY.md` already permits device-keyed *aggregate* state: the k≥3
corridor gate keeps hashed device ids in memory; `/v2/ledger` keeps a
token-keyed per-device history. Two clean options:

1. **Ledger-derived (preferred).** Completed trips already write a
   ledger entry keyed by the (hashed) device token. Add one field —
   `assignment: "option2_default" | "option2_accepted" | "override"` —
   and `D_i` is computable from existing state; `a_i` is a running
   accrual counter beside it. User-deletion of the ledger *forfeits
   turn-credit* — self-consistent: you cannot claim turns you erased.
   This adds zero new stores, one new field, and one new claim row to
   `PRIVACY.md`. **Flagged as owner decision + doc change.**
2. **In-memory epoch table** (like the k-gate sets): `{hashed_token →
   (D, a)}`, TTL aligned to the 30-day token rotation. Simpler, but a
   second device-keyed store — more claim surface.

**Anonymous users (no token, sharing off):** the server cannot know
two requests are the same person — by design. They get the pure lottery
per request (`r_i(e)` on an ephemeral id): ex-ante fair, no weekly
guarantee. This is disclosed honestly (§10, the "no account" note):
*with no account we cannot promise you even turns — only fair draws.*
That is a real cost of the privacy model and the doc should not pretend
otherwise.

---

## 4. Honest UX framing — say it, don't hide it

### 4.1 The evidence for disclosure

- **Transparency raises trust even when the news is bad.** Kizilcec
  (CHI'16, Facebook feed experiment): users told *how* the algorithm
  works trusted it more than users given identical outcomes silently —
  and *procedural* transparency ("this is the rule") beat outcome
  transparency ("here is your number"). Our disclosure is procedural:
  the turn system, the reason, the override.
- **Algorithms get less forgiveness than humans.** Dietvorst–Simmons–
  Massey (JEP:G 2015): users abandon an algorithm after seeing one
  error far faster than they abandon a person. A *discovered* hidden
  steer is the error — once a user catches the app quietly routing them
  worse "for the greater good," every future recommendation is
  suspect. The one-tap override is also the algorithm-aversion antidote:
  control restores trust.
- **Process legitimacy is what makes bad outcomes acceptable.**
  Procedural justice (Lind & Tyler; Leventhal's six rules —
  consistency, bias-suppression, accuracy, correctability,
  representation, ethicality): people accept worse outcomes from a
  process they judge fair. Our mechanism maps 1:1 — consistency
  (rotation), bias-suppression (seeded lottery), accuracy (real demand
  counts), correctability (override + appeal-by-design), representation
  (everyone in the same pool), ethicality (the IR cap).
- **The counterexample is hiding it.** Every discovered covert steer in
  the industry's history (throttling, greyballing, shadow-ranking) paid
  a years-long trust bill. Delhi additionally has a live reference:
  odd-even taught citizens that restriction schemes are resented
  *and* gamed (second-car purchases, exemption-shopping). We are the
  opposite of odd-even: nobody is banned, everyone takes a turn, the
  turn is paid.

### 4.2 The copy rules (binding)

1. **Never imply the assigned option is the personal best.** The pill,
  the reason line, and the delta all stay. "Lightest" tags are reserved
  for options that actually are.
2. **Show the delta in the two units the user already owns** — minutes
  and smoke-heaviness (doc 02: no µg, no "exposure," no "dose" on
  consumer surfaces).
3. **Name the cause at corridor level, not system level.** "Ring Rd is
  filling up 8:30–9:00" is checkable and concrete; "to help reduce
  congestion" is fog and reads as excuse.
4. **Show the receipt** — the turn count and what it bought ("kept the
  light route light for ~60 people"). The e2democracy corpse died of
  invisible effect; every accepted turn must visibly close its loop.
5. **Always show the exit on the same surface as the ask** — "Take Ring
  Rd anyway →" — never in a submenu. An exit you have to hunt for is a
  dark pattern wearing fairness clothes.
6. **No moral vocabulary.** No "good citizen," "duty," "do your part."
  The exchange is a turn plus a credit; preachiness is both off-register
  and strategically wrong (it frames the override as sin).
7. **Override is consequence-free, and the copy says so.** Declining a
  turn never raises future ask frequency beyond what the deficit rule
  dictates — and §7 explains why it can't.
8. **No stealth mode.** There is no build flag, A/B bucket, or "quiet
  period" in which the steer ships unlabelled. If it isn't worth
  disclosing, it isn't worth doing.

### 4.3 Framing that survives scrutiny — and framing that doesn't

| Approach | Verdict |
|---|---|
| "A lighter route for everyone" — frames the collective benefit, keeps the personal delta visible | **Use** — true, non-sugarcoated, checkable |
| "Your turn for Delhi" + turn count + credit | **Use** — reciprocity is the honest frame; turn counts are auditable |
| Present option 2 as "recommended" with no delta | **Reject** — lying by adjective |
| Hide the steer inside ranking noise ("options reordered") | **Reject** — the discovered-steer scenario above |
| Pay silently ("we added credits to your account") | **Reject** — payment for an unannounced sacrifice is worse than no payment |

---

## 5. Incentive design — what reward currency works in India

### 5.1 What has actually worked — and in India specifically

| Programme | Where | Mechanism | Result | Lesson |
|---|---|---|---|---|
| **INSTANT** (Merugu–Prabhakar–Rama, NetEcon'09) | **Infosys Bangalore**, Oct'08–Apr'09, ~14,000 commuters | Cash **lottery** for off-peak arrival; ~₹96k/week pool, prizes to ₹12k | ~3,000 additional pre-8am arrivals; campus buses ~30 min faster; ~₹20k/day fuel saved | Cash-equivalent + weekly draw works on Indian commuters at workplace scale — the single most relevant precedent we have |
| **INSINC** (Singapore LTA) | city scale | Raffle credits + social comparison + personalized offers | +12% pre-peak rail volume; ~76% of peak trips came from 20% of commuters | Target the few; comparison beats flat reward (docs/22 already logged this) |
| **CAPRI** (Zhu et al., Stanford) | campus | Points → games/raffle for off-peak/walk/bike | sustained off-peak shift | Personalization of offers matters |
| **Spitsmijden** (Bliemer–Dicke-Ogenia–Ettema 2010) | Netherlands, 4 corridor pilots | €2–7/day per avoided peak trip | ~50% fewer peak car trips among participants; route-shift up to 28% (Moerdijk); **reverted when rewards stopped** | Route-level (not just time) asks work; incentives are OPEX forever — budget honestly |
| **DMRC off-peak discounts** | **Delhi, live** | +10% smart-card discount (20% total) for non-peak entry; MJQRT QR tickets: 10% peak / 20% off-peak | deployed policy, not a pilot | Delhi commuters already read "off-peak = cheaper" — our credit plugs into a *trained reflex*, not a new concept |

### 5.2 Currency candidates, ranked for this market

1. **₹-denominated credits, redeemable.** India's smartphone population
   is the most cashback-conditioned on earth — a decade of UPI
   scratch-cards made "₹ reward" the most legible incentive unit in
   existence. Denominate honestly: `1 credit = ₹1 face`. Redemption
   needs a rail (UPI payout requires a VPA → identity → **opt-in only,
   never tied to the anonymous token**; or partner rails below).
   *Deployable without partners:* ledger accrual + weekly draw, with
   redemption marked "coming via partner" — but see the warning: points
   that visibly die are worse than no points.
2. **Transit fare credit.** The most mission-aligned currency — it
   literally subsidizes the cleanest mode — and DMRC has already done
   the user education (off-peak discounts, above). A "₹10 off your next
   Sarathi QR ticket" partnership is the ideal rail. **Needs partner;
   do not build the economy on it.**
3. **Fuel/commute-cost framing.** Delhi commuters are price- and
   fuel-sensitive (the task brief states it; every fare-discount
   precedent confirms it). Even where redemption is pending, denominate
   the *benefit* in fuel terms: "your turns this month ≈ ₹90 of petrol
   not burnt in that jam." Legible, honest, costless.
4. **A weekly pooled draw.** The retention engine: variable-ratio
   reward at trivial cost (INSTANT's entire Bangalore shift ran on a
   ~₹96k/week pool for 14,000 people). Structure: every accepted turn
   = one entry; entry list is the token ledger (anonymous-compatible —
   the prize can be claimed by whoever holds the token, like a bearer
   ticket). Legal flag: a free-entry promotional draw is fine; anything
   resembling a paid lottery is state-regulated — counsel before launch.
5. **"Carbon points" / GoI Green Credits — do not use as currency.**
   India's Green Credit Programme (Green Credit Rules 2023, S.O.
   4458(E), ICFRE-administered) is an afforestation scheme — ≥5-hectare
   blocks, 5-year verification, B2B trading. It is not a commuter
   currency and borrowing the name invites an honesty bug. CO₂e amounts
   belong in the *impact display* ("your turns kept ~2 kg of smoke out
   of Ring Rd"), never in the wallet. Users cannot spend a number they
   cannot name.

**Recommended economics:** base credit ₹5–10 per accepted turn (sized
against Delhi willingness-to-accept: urban VOT ~₹40–70/hr puts a 4-min
sacrifice near ₹3–5 — the credit must beat the felt cost but stay below
farming economics, §7), one raffle entry per turn, weekly pool
₹5,000–12,000 at launch scale, daily earn cap ₹30. At a projected
~5% option-2 rate on 10⁴ daily plans, direct credit cost ≈
₹2,500–5,000/day — publish the budget cap; when it's spent, asks pause.
A fairness scheme with a visible budget is more credible than one that
quietly degrades.

**The ethical guardrail, restated because it governs everything here:**
credits thank users for *turns under the IR cap*. We never pay anyone to
accept a meaningfully dirtier trip — that version of the programme is
paying the poor to breathe worse, and it is rejected, not deferred.

---

## 6. Repeated-game fairness — does the week even out? (the proof)

**Model.** A cohort of `n` users participates in epochs `e = 1..T`.
Epoch `e` requires `s_e` option-2 assignments among its `n_e`
participants. Each participant accrues `a_i += s_e/n_e` (their
proportional share of that epoch's burden); a user assigned option 2
increments `D_i += 1`. Mechanism: assign to the `s_e` participants with
lowest deficit `d_i = D_i − a_i`; ties by seeded lottery.

**Lemma 1 (deficit conservation).** `Σ_i d_i = 0` always.

*Proof.* Each epoch subtracts `Σ_{i∈P_e} s_e/n_e = s_e` from the
participants' deficits via accrual and adds `s_e` via the `s_e`
increments. Init at 0. ∎

**Lemma 2 (stationary cohort ⇒ ±1 bound).** If the same `n` users
participate in every epoch and `s_e = s` constant, then after every
epoch `max_i D_i − min_i D_i ≤ 1`, hence every user's `D_i ∈
{⌊Ts/n⌋, ⌈Ts/n⌉}`.

*Proof.* Induction on `e`. Base `e=0`: all `D_i = 0`. Step: the
mechanism increments the `s` smallest `D_i`. If some incremented user
had `D = m+1` while an unincremented user sits at `m`, then `m+1` was
not among the `s` smallest unless all `m`-users were also incremented —
i.e. increments fill the bottom level before touching the next. The
invariant `max − min ≤ 1` is preserved. Total `ΣD_i = Ts`, so each
`D_i` sits at `⌊Ts/n⌋` or `⌈Ts/n⌉`. ∎

**Corollary (the weekly guarantee).** A daily commuter hitting 5
congested epochs a week at `s/n = 0.4` overflow share sacrifices
**exactly 2 times** (`Ts/n = 2` exactly; if the share product isn't an
integer, either ⌊·⌋ or ⌈·⌉ — never 0, never a tail). Compare the
lottery (§2.2): same expectation `E[D] = 2`, tail at ~6. Rotation has
no tail to feel cheated by.

**General participation (what's proved vs. what's benched).** With
varying participant sets, two statements remain exactly provable:
Lemma 1's `Σ_i d_i = 0` (the arithmetic doesn't care who showed up),
and §3.1's selection guarantee (sacrifices still go only to the
`s_e` lowest deficits in the epoch). What is *not* airtight without
more work is the tight per-user envelope `|D_i − a_i| ≤ 1`: the ±1
induction leans on a shared participant set, and with heterogeneous
attendance the walk can transiently overshoot (an award adds `< 1` per
selection, accrual removes `< 1` per participation, but the ordering
stops being a clean fill-the-bottom). The mechanism is still
self-correcting — conservation forces winners' deficits down through
accrual while sacrificers bank credit — so the honest deliverable is a
**bench, not a boast**: run the simulation harness over synthetic NCR
demand (flagged as a bench task, same discipline as
`docs/plan/bench-results.md`) and publish the measured envelope — our
working hypothesis: for users with ≥5 participations in any rolling
14-day window, `|D_i − a_i| ≤ 1` holds outside a small measure of edge
epochs, with the F3 40% ceiling as the hard backstop regardless.
**If simulation finds a fatter bound, we ship the simulated bound in
the docs, not the hoped-for one.**

**Non-stationary nicety worth stating:** because selection is by
deficit relative to *accrued* share, a user who simply wasn't in the
congested pool hasn't accrued anything — they aren't taxed for other
people's congestion, and a newcomer (`D=0, a=0`) enters at balance, not
at the front of the queue.

---

## 7. Gaming resistance — the attack surface, enumerated and closed

The task constraint is the right instinct: **the draw must have no
user-controllable input.** `r_i(e) = HMAC(day_seed, epoch_id ‖
SHA256(token))` — the seed is server-held (committed daily, revealed
+24h, §9), the epoch id is server-defined, the token is the only
user-side term and entering it is the attack surface enumerated below.

| # | Attack | Result | Mitigation |
|---|---|---|---|
| 1 | **Re-roll identity**: reinstall / force token rotation to escape a deficit | New token enters at `d=0` — *average*, not priority; accrued ledger + credits are token-keyed and **forfeit on reset** | Reroll EV ≤ fresh-draw EV minus burned credits — bounded by making credits non-transferable across tokens (already true). Cannot be prevented, only made worthless — say so honestly |
| 2 | **Preview-then-reroll**: see assignment, dislike, retry with new id | Same (token, epoch) → same assignment; a new token just re-enters the same lottery | No preview channel exists: the assignment is inside the plan response; each redraw requires a fresh install (attack 1) |
| 3 | **Sybil request flood**: fake plan requests inflate `n_e`, diluting everyone's odds | Capacity is counted on **started trips** (`/v2/trip`), not plan requests | `n_e` is derived from trips that actually start + a demand prior, never from raw request volume — stated in spec |
| 4 | **Farm credits with spoofed trips** | Credits vest on *completed* trips (1 Hz strip tick against the served route — a fake trip must simulate a plausible traversal) | ₹30/day earn cap → farming EV below effort; `isMockLocation` checks where available; emulator-class abuse flagged as accepted residual risk, not a promise we can't keep |
| 5 | **Dodge the epoch** (shift departure ±15 min) | Succeeds — *and this is the desired behavior*: the peak just smoothed. INSINC/INSTANT paid real money for exactly this move | Not a bug; the ledger even credits it as an off-peak contribution |
| 6 | **Collusion** (friends pool devices to concentrate turns) | No shared state to exploit; deficits and draws are per-token | None needed — there's no transferable asset to pool |
| 7 | **Push someone else into option 2** | Impossible: your request never enters another user's assignment function | Structural |
| 8 | **Predict the lottery** (recompute seed early) | `H(day_seed)` is *committed* at 00:00 IST, seed revealed next day — prediction requires breaking the commit; rigging the day *after* seeing arrivals requires breaking pre-image | Commit-reveal = draft-lottery-grade auditability: after reveal, anyone can recompute every rank they personally participated in |

Residual honesty paragraph (the doc demands one): a sufficiently
determined user *can* reset identity (attack 1) — we cannot and do not
claim sybil-proofness on an anonymous system; we claim the reset's
expected value is ≤ its cost because everything earned is token-keyed.
If that claim is ever false (credit value ≫ identity-reset cost), the
earn cap and the IR cap are the parameters that keep it true.

---

## 8. Edge cases — who may never be deprioritized

The **universal override** (§0, layer 3) resolves most of this
structurally:
since assignment is a default with a visible exit, a misclassified edge
case costs a user one tap, not a blocked trip. Formal exemptions stack
on top, because "the user had to tap out of an assignment we should
never have offered" is still a small dignity tax.

**Never asked (hard exemptions):**

| Class | Detection | Notes |
|---|---|---|
| Emergency trips | destination category = hospital/emergency, or the trip-level "urgent" flag | False positives are cheap (one fewer ask); false negatives are harm — classify generously |
| Accessibility needs | declared profile flag (step-free, mobility aid, low-vision) | Also auto-exempts any option 2 that fails the constraint — e.g. adds stairs, a transfer, a long walk leg. The engine already enforces feasibility; the exemption makes it *never asked*, not "asked and found infeasible" |
| Health-sensitive users | declared "breathing is hard for me" flag (asthma/COPD/pregnancy) | Asks allowed only when `Δdose ≈ 0` (`ε_med`, spec table) — in practice this is "never on bad-air days" |
| Time-critical commutes | school/medical-appointment destinations where lateness is not inconvenience | Same generous-classification rule |
| Option 2 over the IR cap | computed per trip | Not a user class — a trip filter: `Δdose > 15%` or `Δtime > 5 min` → no ask, ever. This cap is the ethical load-bearing member of the whole scheme |
| Transit (metro/bus legs) | mode | A metro journey cannot be "moved to another corridor" on the road graph; cross-mode asks are always voluntary suggestions — the product's existing "candidates draw as equals" stance stays |

**Never sellable (policy, not mechanism):**

- **Paid tiers may never purchase exemption.** Priority is not for
  sale. A paid tier may buy information (wider bands, earlier alerts,
  history) — never position in the queue. Pay-to-breathe-clean is the
  environmental-justice red line and belongs on the doc-26 kill list if
  it isn't already; **flagged to claims-ledger owner.**
- **Exemption status is never displayed or rankable.** Users cannot
  buy, earn, or farm an exempt flag — accessibility is a declared
  profile property with no external verification and no benefit beyond
  exemption (self-declaration is safe precisely because exemption is
  not valuable enough to farm: it only removes a paid ask).

---

## 9. Assignment-fairness spec (v0.1 draft)

```
SCOPE.      Applies to started road-mode trips in an epoch where
            projected demand for a corridor exceeds capacity. Metro/bus
            legs and cross-mode suggestions are exempt (§8).

DEFS.
  epoch e        := (corridor c, 15-min IST window w)
  n_e            := projected starts on corridor c in w
                   (from started trips + demand prior; never from raw
                    plan-request counts — §7 attack 3)
  K_e            := corridor capacity; v0: free-flow headway proxy
                   (honest: heuristic until traffic-coupled field lands)
  s_e            := max(0, n_e − K_e);   skip the epoch if s_e/n_e < 5%
  D_i            := accepted option-2 assignments, token's ledger
  a_i            := Σ over epochs e containing i of (s_e / n_e)
  d_i            := D_i − a_i            (deficit; lower = more owed)
  r_i(e)         := HMAC(day_seed, epoch_id ‖ SHA256(token_i)) mod 2³²

ELIGIBILITY (all required, evaluated per trip plan).
  E1  participant in epoch e (trip projected to enter c in w)
  E2  option 2 exists AND meets declared constraints (accessibility,
      transfers, vehicle)
  E3  Δdose ≤ 15% AND Δtime ≤ 5 min AND Δdose ≤ ε_med when the user
      declared health sensitivity      (the IR cap)
  E4  user not in a §8 exempt class
  E5  option 1 remains selectable — soft assignment only

SELECTION.
  S1  rank eligible participants by d_i ascending
  S2  ties (incl. all d_i equal) by r_i(e) ascending
  S3  the first s_e in that order get the option-2 default + credit offer

FAIRNESS INVARIANTS (proved in §6; monitored live).
  F1  stationary cohort:  max D_i − min D_i ≤ 1 after every epoch
                          (proved, §6 Lemma 2)
  F2  general case:       Σ d_i = 0 and lowest-deficit selection
                          (proved); |D_i − a_i| envelope is published
                          from the simulation bench, not assumed (§6)
  F3  backstop:           option-2 share ≤ 40% of any user's eligible
                          epochs over rolling 14 days  (hard ceiling
                          behind F1 — belt over proved suspenders)

AUDIT.
  A1  H(day_seed) published 00:00 IST daily (proposed: on /v2/city)
  A2  day_seed revealed +24h (proposed endpoint: /v2/fairness/audit);
      any user recomputes their own rank — no other user's data needed
  A3  user's own D_i, a_i readable via /v2/ledger (token-keyed);
      deleting the ledger forfeits turn-credit — self-consistent

CREDITS.
  C1  +₹5–10 face per accepted turn; 1 weekly-draw entry per turn
  C2  daily earn cap ₹30; weekly pool ₹5–12k; pool + spend published
  C3  credits are token-keyed, non-transferable; redemption rail TBD
      (UPI opt-in or transit partner — §5.2); until a rail exists the
      wallet is labelled a ledger of turns, not money

OVERRIDE.
  O1  one tap, always available, zero penalty. An override changes
      nothing in the ledger: a_i accrued at participation (as it does
      for every co-participant, winners included — Lemma 1 needs that),
      D_i only moves on a completed option-2 trip. Declining therefore
      can't buy lower future ask rates — it just leaves your debt
      unpaid, which is your right
  O2  emergency/urgent flag bypasses the ask entirely
  O3  anonymous (tokenless) users: lottery-only assignment (§3.3),
      disclosed; no deficit tracking is possible and none is claimed

STATE ADDED (privacy impact — owner decision against PRIVACY.md).
  one field on the existing token-keyed ledger entry (assignment
  outcome) + accrual counter a_i; no location, no identity; TTL
  aligned to the 30-day token rotation
```

---

## 10. Disclosure copy — English strings, and the Hindi tone spec

Voice rules are inherited (doc 02): "smoke you breathe," "lighter/
heavier," one number per state, every number comparative, no µg/AQI/
dose/exposure on consumer surfaces. The disclosure adds one new noun —
**"a turn"** — and one rule above all: *the word "best" is never spent
on an assigned option.*

### 10.1 English strings

```
Options screen — assigned option row, badge:
  "A turn for Delhi"

  Same row, reason line (always present on assigned options):
  "Ring Rd is filling up 8:30–9:00. This way: +3 min, ~4% heavier
   smoke — keeps the light route light for everyone."

  Same row, offer line (when credits attach):
  "+8 credits if you take it"

  Same row, exit (always, same surface):
  "Take Ring Rd anyway →"

Trip preview — assigned option, under the counters:
  "You got the second-lightest way today — your turn in the split.
   Ring Rd stays light for ~60 people because of trips like yours."

Override confirmation (neutral, consequence-free):
  "Done — Ring Rd it is. Your turn count doesn't change."

Receipt — accepted turn:
  "You took a turn for Delhi. 3rd this month. +8 credits.
   Ring Rd stayed ~20% lighter through the peak."

Receipt — weekly fairness summary (Ledger screen):
  "This week: 2 turns for you, 2 turns for Delhi — even."

Anonymous-user footnote (only when sharing is off):
  "Heads up: with sharing off we can't count your turns — your draws
   are fair, but we can't promise they even out week to week."

Never ship:
  "best route" / "recommended" / "fastest way" on an assigned option;
  "we've optimized your route"; any copy where the steer is invisible;
  any guilt frame on the override.
```

### 10.2 Hindi tone spec (register description — no Hindi written here)

- **Register**: conversational Delhi Hindi exactly per
  `docs/plan/hi-glossary.md` — the words a 12-year-old uses. All
  existing bindings hold: धुआँ, हल्का/भारी (paired), रास्ता, आप-form,
  polite imperatives, Latin digits (`+3 मिनट`), spoken loanwords
  allowed (क्रेडिट, रूट, लाइव).
- **The key lexical choice — बारी, not त्याग.** The fairness concept
  maps onto **बारी** ("turn"), the word every Delhi kid already owns
  from queues and गली क्रिकेट — reciprocal, sequential, morally
  neutral. The Hindi voice should lean on बारी-बारी logic: "आज आपकी
  बारी, कल किसी और की" is the *emotional* shape (reciprocity forward),
  and a literal translation of the English reason line slots in after
  it. **Rejected registers**: त्याग/बलिदान (sacrifice vocabulary —
  coercive, government-circular), सेवा/कर्तव्य (service/duty —
  preachy, violates copy rule 6), कृपया-अनुरोध constructions (notice-
  board formality — this is a friend telling you the queue split, not
  a department announcing it).
- **Tone shape**: flatter than the English, not more emotional. One
  clause of reason (the corridor + the window), one clause of
  reciprocity (the turn), one clause of exit. No exclamation marks,
  no moral adjectives, numbers stay Arabic numerals. The collective-
  benefit clause ("keeps the light route light for everyone") should
  render as plain consequence — *the light रास्ता stays हल्का for
  everyone* — not as civic virtue.
- **What "feeling cheated" sounds like in Hindi, and must never be
  triggered**: the danger words are the ones implying the app *gave
  you a worse deal quietly* — any phrasing that could read as धोखा or
  as the app taking sides. The turn-frame defuses this specifically
  because बारी implies *your turn comes back* — the reciprocity is in
  the word itself, which is why it's chosen over every alternative.

---

## Appendix A — Parameter table (all tuneable, all must appear in the claims ledger)

| Param | v0 value | Basis |
|---|---|---|
| epoch window | 15 min IST | matches ≤10-min field reprice; finer invites boundary gaming |
| IR cap — dose | Δdose ≤ 15% | doc-31 near-tie logic; the ethical ceiling — never negotiate |
| IR cap — time | Δtime ≤ 5 min | vs. Delhi VOT ≈ ₹3–5 felt cost; below the ₹5–10 credit |
| health-sensitive cap | ε_med ≈ 0 (effectively never on bad days) | §8 |
| ask-suppression floor | s_e/n_e ≥ 5% | don't run fairness machinery for noise |
| rolling share ceiling | ≤40% of eligible epochs / 14d | backstop behind proved ±1 |
| base credit | ₹5–10 / accepted turn | INSTANT/Spitsmijden response band vs VOT |
| weekly pool | ₹5,000–12,000 | INSTANT scaled to launch footprint |
| daily earn cap | ₹30 | keeps farming EV below reset cost (§7 attacks 1, 4) |
| seed commit/reveal | H daily 00:00 IST; reveal +24h | draft-lottery-grade audit |

## Appendix B — Honest limits (say these)

1. **The air-side benefit is directionally true, not yet measured.** Our
   served field doesn't ingest traffic as a live source term; the time-
   side benefit (PoA ≈ 4/3 bound) is well-evidenced, the corridor-
   cleanliness feedback is argued, not shown. Do not ship copy that
   claims "this kept the air X% cleaner" until the coupled field lands.
2. **K_e is a heuristic.** Until a traffic-coupled model exists,
   corridor capacity is set from headway/history, not physics. The spec
   marks it honestly.
3. **Fairness for anonymous users is probabilistic only.** No token ⇒
   no counters ⇒ no weekly guarantee. The privacy model's real cost,
   disclosed in copy.
4. **Sybil resistance is economic, not absolute.** Identity reset can't
   be prevented on an anonymous system; we bound its value. If credit
   value ever dominates reset cost, the caps are the fix — not a promise
   the attack doesn't exist.
5. **Incentives are a standing cost.** Spitsmijden's participants
   reverted when rewards ended. Budget this as OPEX; if the budget
   pauses, the rotation still stands — fairness doesn't depend on the
   money, only sweetness does.
6. **The ±1 bound is proved for the stationary cohort; the general
   bound is argued, then benched.** Before launch, the simulation
   harness must reproduce F1–F3 on synthetic NCR demand; whichever
   bound the bench supports is the one that ships in the public docs.
