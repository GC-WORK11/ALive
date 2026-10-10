# 12 · The Peak Path — final synthesis

*The master document. Written after the 10-memo corpus (`01`–`10`) and the independent
cross-rating (`11-cross-rating.md`). Supersedes siblings wherever it rules on an open
decision. Owner corrections encoded throughout. Docs-only — zero product code changed.*

## 0 · The one-paragraph product

ALive is a health product on the surface — the consumer keeps seeing what ALive has
always shown: *"the fastest, friendliest, cleanest way."* Under the hood the backend
computes **every** factor end-to-end: ₹ fuel spent, minutes, jam risk, crash-zone
exposure, emissions added, dose breathed. Segregation is not splitting users across
equal routes — it is **real differentiation**: a longer free-flowing road genuinely
dominates a short jammed one on time AND petrol AND dose. Users get the dominant
option; the network spreads assignments so the recommendation never manufactures
the jam it was avoiding. The aggregates our own users generate become the government
planning product. Consumer ₹ = *their savings shown*, never our revenue.

## 1 · The corrected score (owner's order — canonical)

```
user-visible promise : fastest · friendliest · cleanest   (health stays the face)
internal rank key    : h_e = BPR-shaped edge cost over dose+emissions   [C4 ruling]
displayed subtext    : ₹ fuel saved · time saved · safety note
network overlay      : top-K corridor quotas + load term λ — invisible to the user
```

**C4 ruling:** the internal cost function does NOT flip to ₹-first — `03` §9's dual-budget
H(c,h) remains the edge cost because dose and emissions co-vary under BPR. The owner's
order governs the **display layer and the product promise**, not the optimizer's currency.
Fuel ₹ comes free: `03`'s κ_fuel inversion — every shipped CO₂ band is already a ₹ band
(stoichiometry, zero new modeling). This is the single cheapest feature win in the corpus.

## 2 · Canonical rulings on the cross-rater's open decisions

| # | Conflict | Ruling |
|---|---|---|
| C1 k-tiers | four numbers across 03/04/06/09 | **Consumer map: k≥3 (shipped). Gov durable rows: k≥5, randomized margin {5,6,7} (06). Gov export/public: ≥25 contributors (09).** One table, three surfaces — each memo right on its own surface. |
| C3 mechanism fork | 01 stateless hash-lottery vs 07 stateful deficit-rotation | **Adopt the rater's hybrid: θ\* sizes and the u≈0.8 gate from 01; selection order from 07's deficit-ordered fill.** Cost: one counter + one field on the token ledger — accepted; 06/07 flagged it, owner confirmed by asking for fairness. Stateless-only remains the P1 fallback if ledger cost is contested. |
| C6 salt-domain bug | per-(day×cell) salts inflate corridor-union k | **Add a corridor-scoped salt family** `salt_cor(day, corridor_id)` for the corridor-union gate only; cell salts stay as spec'd in 06. 04's GOV_AGG fan-out writes both. |
| C13 incentive currency | ₹5–10/turn credit vs D4's "never cash" | **₹-denominated travel credits (metro/DTC top-up, UPI voucher) — never cash, never a "pay to breathe worse" framing.** Bounded by 07's IR cap (never ask when Δdose>15% or Δtime>5min) and DMRC off-peak precedent. Legal review of the weekly draw before any pilot. |
| C16 auto waiting charge | ₹0.75/min vs ₹1/min | Display **₹0.75–1.00/min** band until the Jan-2023 notification text is pulled and pinned. Low stakes; flagged, not blocking. |
| Namespace | `cor#` collision on `alive108-agg` | **02's family renamed `cst#`** (corridor-state); 04 keeps `cor#` for gov corridor-hour aggregates. Both `dp#` ledgers unify under 06's shape. |

## 3 · The brutal floor — what we are before the flywheel

The corpus's most load-bearing theorem is `01`'s inactivity bound: below **u≈0.8 corridor
utilization OR ~3% measured penetration**, assignment authority self-disables and must
honestly report `segregation:"inactive"`. Translation: **at demo-day scale ALive is an
honest router with telemetry — and that is correct, not a failure.** The platform earns
authority per corridor only after it measures enough of that corridor. Any pitch that
claims network effects before the gates trip is lying; the corpus exists so we never
have to.

## 4 · Three acts (gated, not scheduled)

**P0 — now:** product unchanged; opt-in telemetry already shipped starts filling
corridor cells; `/v2/plan` gains the ₹/time subtext fields (backend-only, κ_fuel
inversion + existing speed data — the frontend stays untouched); file for the
**Delhi OTD GTFS-RT key** (7k buses = free probe fleet, the single highest-leverage
external dependency); pilot-corridor enumeration re-done per `02`'s <1,000 veh/h
screen (the job `08` didn't finish) — natural candidates sit in the DTU→civil-lines
belt where our users already are.

**P1 — gate: ≥30 traversals/peak-hour on ~20 corridors for 28 days + tiered-k pass:**
corridor state store (`cst#`, free/congested/jam + reliability quantiles from `02`);
soft dual budgets H(c,h); advisory quotas (soft default + one-tap override, never a
hard block — `07`); read-only `/gov/console` mirror for mentors/partners;
kill switches armed per `09` §8.

**P2 — gate: a government counterpart signs a pilot:** bounded λ>0 assignment
(proofs in `01` §4); `/gov/v1` planner APIs + calibration corridors (agencies upload
ANPR/tube counts — trust machinery `04` §7); intervention what-if + automatic
before/after DiD reports; ₹ travel-credit incentives (`07`, legal-cleared);
commercial shape per `04` §8 (pilot→license, ap-south-1 residency, DPDP
aggregate-only posture).

## 5 · What the corpus proved vs what it still owes

**Proven/grounded:** quota math + 5 propositions (`01`); penetration→accuracy gates
(`02` — 30/hr = ±15% at CV 0.4); emissions & ₹ priced from live code (`03`);
privacy pipeline + DPDP map (`06`); incentive currencies verified against DMRC,
Spitsmijden, INSTANT (`07`); failure modes + kill switches (`09`); $0.01–0.02/MAU
cost curve (`05`).

**Still owed (the gap list `11` surfaced — nobody priced the human):**
1. Ops burden — who watches kill switches, calibrates corridors, answers gov queries
2. Legal entity + procurement vehicle for the B2G sale
3. Map-data licensing for derived-data resale (TomTom/HERE terms forbid it — `08` §3)
4. Mobile engineering scope for the quota-era UX (override affordance, credits wallet)
5. The traffic-data decision D2: own-probes+GTFS-RT first, bought feeds only as
   audit/validation (`02` flag) — formal revisit owed if a buyer demands bought data

## 6 · Kill list (binding — extends docs/26)

- Never sell priority or exemptions — paid tiers can't buy their way out of quotas (`07`)
- Never claim congestion/accident reduction until measured — Tier-2 caps (`09` §7)
- Never show a corridor intervention band narrower than the decision gap — the
  decision-relevance gate (`09` §5)
- Never call a routed option "best" when it was assigned — `07`'s copy rule
- Never repeat the "parali −90% decline" — satellite undercount caveat (`08` §5)
- Never route more traffic than the measured penetration supports — `01`/`02` gates
- Never resell bought traffic data as derived product — licensing (`08`/`11`)

## 7 · The answer to "where to from here" in five lines

1. **This week:** `cor#`→`cst#` rename note + corridor-salt family into the spec; file the GTFS-RT OTD request; re-run the pilot-corridor enumeration under the <1,000 veh/h screen.
2. **First code (P0):** `/v2/plan` ₹/time subtext fields — backend-only, the frontend never changes.
3. **First build (P1):** `cst#` store + corridor fusion loop — the smallest thing that turns user trips into measured flow.
4. **First sale (P2):** a calibration-corridor pilot with DTP/PWD — their ANPR data against our speeds, the trust wedge `04` designed.
5. **Never:** claim the platform effect before the penetration gates trip — the docs exist so the pitch stays honest at every scale.
