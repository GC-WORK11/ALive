# docs/gov/local/05 — Real-time architecture: trip stream → corridor state → advisories

*Plumbing memo. Owns: cadence, queues, storage schema, SLOs, degradation —
the pipe that carries traversals into corridor state and corridor state
back into `/v2/plan`. It deliberately does **not** own: the λ/budget math
(01), the speed/flow estimator (02), the privacy tiers it must respect
(06), or the failure-mode kill list it must implement (09). Where this
memo and a sibling disagree on their topic, the sibling wins.*

Sister docs: `10-synthesis-skeleton.md` (contracts + vocabulary),
`09-failure-honesty.md` (oscillation/gaming — this memo implements its
gates), deployed-system truth in `docs/18-aws-architecture.md`,
`docs/33-v2-load-latency.md` (measured latency), `docs/30-live-tracking.md`
(telemetry physics). Prices are ap-south-1 list, Oct-2026, ±15% — verify
at commit; every derived number is marked [C] and shows its inputs.

**Ground truth this memo is written against** (skeleton §2, deployed
`alive108-agg`): 22 all-time donated trips, 14 contributors, 12
publishable corridors of 54 tracked. Today the whole corridor layer
could run on a Raspberry Pi. This memo exists so that the day the
stream is real, nothing in the pipe has to be re-argued — only resized.

---

## 0. Verdict up front

1. **Two stores, two jobs — the single decision everything else
   follows from.** The *ledger* (durable, auditable, already shipped —
   DynamoDB `alive108-agg`) and the *flow state* (ephemeral,
   lossy-tolerant, decays in minutes) must be different systems. Every
   bad option in this memo is a version of conflating them: writing
   telemetry into the ledger (cost explosion), or reading corridor load
   from the ledger on the plan path (latency + full-table scans —
   `agg_ddb.py:_scan` already scans the whole table per `corridors()`
   call, and it will be the first thing to melt at scale). Ledger =
   DynamoDB. Flow state = in-memory mirror in every API task, backed by
   a shared substrate that changes per tier (§4).
2. **Real-time state ≠ real-time authority.** Corridor *state* should
   converge in ≤30 s so badges, heat, and quota advisories describe a
   world that still exists. The *authority* layer — budget consumption,
   λ, who gets a quota advisory — stays on the 15-min field cadence per
   skeleton D1: a stale-aware fast observation feeding a deliberately
   slow decision. Fast state, slow authority. The pipe serves both.
3. **Sync read + score inside `/v2/plan`; async everything else.** The
   read is ~µs (in-memory) to ~1 ms (Redis MGET) and the scoring is
   already Pareto-ranking — a "scoring service" would be a 5–20 ms
   network hop plus a failure domain purchased for zero compute. What
   must NOT live in the request is *aggregation* (stream folding,
   budget recompute, snapshot publishing) — that's a worker.
4. **Ingestion: direct in-task fold to ~10k, SQS when you need
   decoupling, Kinesis when you need replay/fan-out — not before**
   (§3). The events commute (`cell +1`), so ordering and exactly-once
   buy nothing; the queue exists to absorb bursts and to feed
   non-obvious consumers (ledger compactor, analytics tap, replay for
   bugs) — which is what Kinesis is *for*, and SQS is not.
5. **What breaks first is not the database.** Failure order (§6):
   single-loop CPU for plan serialization → OSRM's ~2 GB graph cloned
   per task → DynamoDB hot partition keys (`day#`, `global`) →
   subnet-IP/task quotas → egress cost. At 100k concurrent, **data
   transfer out is a top-3 line item, ahead of compute** unless the
   plan payload gets a slim mode (§10, §13).
6. **Flink/KDA is overkill until ~100k concurrent AND a derived-metric
   product.** Corridor state is decayed counters — a 200-line consumer
   plus a dict. Flink earns its place when you need per-event sliding
   windows over >~10k events/s, multi-stream joins (traversals ⋈
   GTFS-RT ⋈ incidents), or exactly-once into a metered data product —
   §7 gives the precise threshold.
7. **Demo = zero new AWS resources.** In-memory flow dict on the one
   task, a synthetic-probe generator honestly labeled, one quota
   advisory on the plan receipt, corridors layer on the map. Ships in
   days; nothing in it is a lie (§11).

---

## 1. What "real-time" must mean here — and must not

The requirement as stated: *corridor state must update as trips stream
in.* Decomposed honestly:

| Quantity | Honest freshness budget | Why |
|---|---|---|
| `flow[cell].active` — who's on this corridor now | **≤30 s** | drives quota advisories + "busy" bands; a 2-min-old load map still spreads demand, a 15-min-old one herds (09 §2) |
| `flow[cell].speed_evidence` | ~60 s | speeds need ≥2 traversals before they're evidence, not anecdote — the 09 gates bind before latency does |
| `pending[]` soft reservations (P2 only) | **≤5 s** to be *useful*; advisory-only below that | anti-pile-up only works if the next planner sees your slot before it's granted; below 5 s it degrades to statistical spread — acceptable, but say so |
| corridor badges on `/community`, `/v2/city` | ≤60 s | display surface |
| gov console corridor-hour state | **60–120 s is plenty** | planners read minutes-old state; nobody's decision latency is under a minute |
| budget consumption + λ | **15 min — by design (D1)** | authority recomputes on the field rebuild; faster authority = oscillation (09) |

And the scope honesty the sibling docs insist on, restated for plumbing:
this stream measures **our users'** load — penetration-gated by
definition (02). At realistic adoption (0.01–1% of corridor flow), what
this layer prevents is *self-inflicted* pile-ups — us sending every
ALive user down the same "clean" corridor at 08:40 — not Delhi
congestion. The plumbing must carry the penetration estimate alongside
every number so no downstream surface forgets which world it's
describing (09 §5 gates: <3 probes/hr → dark, 3–10 → qualitative,
10–50 → anomaly bands, ≥50 → suggestion-eligible).

---

## 2. The scale model — the table every downstream number hangs on

`U` = *concurrent active trips* — users currently mid-trip with
telemetry on, plus planners in a session. "Concurrent" is the honest
denominator: infra sizes against concurrency, cost normalizes against
MAU (≈5–10× concurrent for a commute-patterned app [I]).

Derived rates, assumptions stated:

| assumption | value | basis |
|---|---|---|
| telemetry batch cadence | 1 per trip per **45 s** | docs/30 §6 spec: 30–60 s batched uploads (radio tail energy, not server CPU, is the constraint) |
| new corridor cells per batch | ~0.5–1 | H3 res-8 ≈ 460–730 m span; Delhi moving speed ~15–25 km/h ⇒ 190–310 m per 45 s batch |
| `/v2/plan` rate | `U/120` rps | ~1 plan per 2 min per active session: initial plan + deviation re-plans + compare [I] |
| corridor cells read per plan | ~50–150 | route corridor ≈ 15–40 res-8 cells × ~3 alternatives, deduped [C] |
| trip completions | `U × 2.7`/hr | mean motorized trip ~20–25 min [I] |
| ledger writes per completion | **~27** | measured in `agg_ddb.record_trip`: 2 day-items + ~20 cell-items + 2 hour-items + ~3 global-items |
| plan CPU | ~0.4 s/plan on 1 vCPU | srv took_ms 532–960 (docs/33); CPU fraction ≈ 40–70% of wall [I] |
| duty factor | avg ≈ 0.5 × peak | Delhi bimodal commute [I] |

| rate (peak) | 1k concurrent | 10k | 100k |
|---|---|---|---|
| telemetry batches | ~22/s | ~220/s | ~2,200/s |
| cell-traversal events (flow-state writes) | ~15–30/s | ~150–300/s | ~1.5–3k/s |
| `/v2/plan` | ~8/s | ~83/s | ~833/s |
| corridor-cell reads (×100/plan) | ~800/s | ~8k/s | ~83k/s |
| trip completions | ~0.7/s | ~7/s | ~75/s |
| ledger writes (×27) | ~19/s | ~190/s | ~2,000/s |
| plan response egress (40 KB gz avg) | ~0.3 MB/s | ~3 MB/s | ~33 MB/s |

Two numbers in that table decide everything: **flow-state writes stay
under ~3k/s even at 100k** (trivial for any substrate — the write path
is never the problem) and **corridor reads hit ~83k/s** (impossible for
DynamoDB, the actual driver of §4).

---

## 3. Ingestion path: direct DDB vs SQS vs Kinesis

What the event stream actually is: `POST /v2/tick` (new — telemetry
batch: `{trip_id, seq, fixes[]}`) and `POST /v2/trip` (shipped —
completion + summary). Both pass the privacy pipeline first (trim 300 m,
thin 100 m, round 4 dp, H3 res-8, token→sha256[:16], raw discarded —
`v2/trip.py`); **corridor cells are minted before storage**, so nothing
downstream ever handles a raw trace. Events are idempotent by
`(token_hash, trip_id, seq)` and increments commute — at-least-once
delivery is fine everywhere.

### Option A — direct DynamoDB writes (the shipped pattern, extended)

Every traversal event → `UpdateItem ADD` on `cell#{h3}` (exactly
`agg_ddb._add_cell` today); completions keep their ~27-write fold.

| tier | event writes/s | monthly events (avg) | on-demand cost @ $1.4/M WRU |
|---|---|---|---|
| 1k | ~15–30 | ~50M | ~$70 |
| 10k | ~150–300 | ~500M | ~$700 |
| 100k | ~1.5–3k | ~5B | ~**$7,000** |

plus ledger writes (~$30/$300/$3k) on top. Latency: none added on the
read path (state is written, not queried); ~10–40 ms p99 tail risk on
the tick handler if the write is awaited — buffer it and it's ~0.
Real limit: the hot partition key — `day#{day}` and `global` take a
write on *every* completion; at ~75 completions/s×2 items at 100k
they're fine (~150 WCU/pk < 1,000), but `cell#{hottest}` during a
corridor stampede is the soft spot — shard `cell#` keys
(`cell#{h}#s{n}`) before ~800 writes/s on one cell, i.e. around the
10k tier if a marquee corridor concentrates events.

**Verdict: never for telemetry events.** Direct-DDB-per-event costs
~$7k/mo at 100k for data whose value expires in minutes. Keep it for
the *ledger* — aggregated, durable, already paid for.

### Option B — in-task fold → flush (no queue)

Each API task folds arriving batches into `dict[cell] → {n, Σv, Σv²,
tokens}` in memory; every 15–30 s flushes *deltas* to the shared state
store (Redis `INCR`-style ops, or DDB ADD at ≤10k). The flush write rate
is bounded by **dirty cells per window**, not events:

| tier | est. dirty cells/30 s window | flush writes/s | monthly store-writes |
|---|---|---|---|
| 1k | ~200–400 | ~10 | ~$40 prov/on-demand mix |
| 10k | ~2–4k | ~100 | ~$60–140 |
| 100k | ~10–15k | ~400–500 | ~$280–560 |

Dedup gain over Option A: ~2–6× (cells are sparse relative to events —
the honest number, not the 50× people assume). Latency: zero added to
requests; flush on a background task with a bounded buffer (drop-oldest
on overflow — telemetry is a sample, not a transaction). Failure mode:
task death loses ≤30 s of increments — **lossy-tolerant by
construction**; the counters are estimates and say so.

**Verdict: correct at ≤10k.** Zero new infrastructure; extends the
proven `community._fold` + snapshot pattern. The only thing it cannot
give you is *cross-task visibility faster than the flush window* —
acceptable while flow state is advisory.

### Option C — SQS → consumer → state

`POST /v2/tick` enqueues a batch (~1–4 KB); a Lambda or Fargate consumer
micro-batches (100–500 records) → state store. At-least-once +
unordered: harmless — increments commute.

| tier | msgs/s avg | monthly requests (send+recv+del, batched ×10) | SQS cost @ $0.40/M | consumer |
|---|---|---|---|---|
| 1k | ~11 | ~9M | ~$4 | ~$5 |
| 10k | ~110 | ~90M | ~$36 | ~$15–40 |
| 100k | ~1,100 | ~900M | ~$360 | ~$60–150 |

Added latency: ~10–30 ms enqueue + ~1–3 s consumer path — invisible
against a 30 s freshness budget.

**Verdict: the cheapest decoupling.** Adopt when (a) tick bursts
threaten the plan path's CPU (they don't until ~10k+), or (b) the
ledger compactor should not share fate with the API. Not needed at 1k;
a coin-flip vs Option B at 10k; the wrong tool past that only because
it buys no fan-out — one queue, one consumer group.

### Option D — Kinesis → consumer(s)

Same flow as C, but ordered per partition key (shard by `cell` →
per-cell ordering for free) with 24 h replay and multiple independent
consumers (flow-state worker · ledger compactor · analytics tap ·
replay for bug-hunts). Provisioned: 1 MB/s + 1,000 rec/s per shard,
$0.015–0.021/shard-hr, PUT units $0.014–0.018/M per 25 KB.

| tier | shards (incl. ~2× headroom) | monthly stream cost | + consumers |
|---|---|---|---|
| 1k | 1–2 | ~$25–35 | ~$10 — **overkill** |
| 10k | 2–4 | ~$45–80 | ~$20–50 — justifiable if a 2nd consumer exists |
| 100k | 4–8 | ~$110–170 | ~$60–150 — **right tool** |

**Verdict: at 100k, yes — because of what it enables, not the
throughput.** Replay alone justifies it at platform scale (recompute
corridor state after an estimator bug; audit what the quota layer saw
when it advised; feed the offline regret-replay 09 demands). Below
~50k concurrent it's vanity infrastructure.

### The honest summary

| tier | pick | added monthly cost | added latency |
|---|---|---|---|
| ≤1k | B — in-task fold → flush | ~$0–40 | ~0 |
| ~10k | B, or C if bursts bite / ledger decouples | ~$50–100 | ~1–3 s |
| ~100k | D — Kinesis → consumer fleet, C for the ledger sidepath | ~$250–500 | ~2–5 s |

The trap to name: **writing telemetry events into `alive108-agg`
directly** — it looks free (table exists, `UpdateItem` exists) and it
is the single most expensive option on the page at 100k ($7k/mo) while
*also* polluting the ledger with ephemeral state. Option A survives
only as the ledger path — which is exactly what it already is.

---

## 4. Corridor state store: the read pattern is the design

The read: every `/v2/plan` wants load on ~50–150 cells — the corridors
of its candidate routes. From §2: **800 / 8k / 83k cell-reads per
second** at the three tiers. The write: ≤3k/s. This is a
read-dominated, latency-sensitive, lossy-tolerant, small dataset:

- hot set: ~20–40k cells with nonzero state × ~60–100 B → **~3–8 MB**
- semantics: decayed counters + bands — eventual consistency is not a
  compromise, it's the *specification* (the state is an estimate; ±15 s
  changes nothing a user should see)

### Option matrix

| store | read cost/plan | read latency | 83k reads/s? | monthly cost @100k | consistency |
|---|---|---|---|---|---|
| DynamoDB | ~100 GetItems ≈ 25–50 RCU | 5–15 ms | ✗ — ~$4–8k/mo provisioned, and per-plan fan-out | $4–8k | strong but pointless |
| DDB single "snapshot" item (≤400 KB, polled per task) | 0 — read is local | ~µs | ✓ — T tasks × 4/min on one item | ~$1–5 | 15–30 s staleness |
| ElastiCache Redis | 1 MGET (~100 keys, pipelined) | ~0.5–1.5 ms | ✓ — r7g.large does >150k ops/s | ~$150–300 | shared, ~1 s |
| **In-memory mirror per task** | 0 — dict lookup | ~µs | ✓ trivially | ~$0 | 5–30 s behind shared |

There is no world where `/v2/plan` hits DynamoDB for corridor load —
that option is dead on arrival and the memo says so plainly so nobody
re-proposes it.

### The actual design: mirror + substrate

Every API task holds a **read mirror** (`dict[cell] → {active, pending,
speed_band, epoch}`) — the read that can never be outsourced, because
the plan path cannot take a network dependency for an *advisory*
signal. What varies per tier is the **substrate** that keeps mirrors
true:

| tier | substrate | convergence | cost/mo | why |
|---|---|---|---|---|
| ≤1k | nothing — one task *is* the store | ~0 | $0 | single task sees 100% of the stream; a mirror of yourself is yourself |
| ~10k | **delta snapshot**: consumer (or leader-elected task) publishes a compact `{cell: deltas}` blob every 10–15 s to a single DDB item or S3 object; mirrors pull-merge | 10–25 s | ~$1–10 | ~8 tasks × 4 polls/min on one small object — free-tier arithmetic; staleness is honest because state is advisory |
| ~100k | **ElastiCache Redis** (`corr:{h3}` → counters; `corr:pend:{h3}` → reservation buckets), mirrors still cache hot cells ~5 s | ~1–5 s shared, ~5 s served | ~$150–300 (+replica ~×2 for HA) | at ~50–100 tasks, pending-reservation semantics need a shared writer/reader inside the freshness window; a 15 s snapshot still works for *display* state but not for anti-pile-up slots (09) |

Why Redis and not DAX/DDB-accelerated at 100k: counters, not items —
`INCR` + decay + per-bucket TTL is a Redis-shaped workload; DDB counters
would need 1,000+ WCU on hot keys plus shard-key gymnastics for the
same freshness Redis gives at 1 ms. And why mirrors stay even with
Redis: a 5 s micro-cache cuts Redis ops ~10× *and* makes the plan path
survive a Redis blip serving seconds-old truth instead of an outage —
the mirror is the degradation path (§8).

Honest limit of the ≤10k design, stated: with N tasks each seeing 1/N
of the stream, **local counts under-report by N** until the snapshot
syncs. The mirror's `epoch` field travels with every served number; a
surface can always tell state-age — which is what the honesty layer
needs anyway.

---

## 5. Assignment service placement: inside plan or beside it

Three candidate placements, one clear answer:

| placement | adds to plan p95 | fails when | verdict |
|---|---|---|---|
| **Sync read + score inside `/v2/plan`** | ~0–1.5 ms (mirror dict / Redis MGET) | nothing new — same task, same failure domain | **yes — the read + rank** |
| Sync call to a separate scoring service | +5–20 ms network hop + its own SLO | the scoring service — which is now on the plan path | ✗ — buys separation, sells latency |
| **Async worker** for aggregation | not on the path | lag only; plan serves mirror state | **yes — everything that isn't per-request** |

The reasoning, explicitly: flow-aware scoring is *not a service* — it's
~50 lines of Pareto-weight adjustment over data already in-process.
`rank_options()` (`v2/plan.py`) gains a corridor-load term; the cost is
a dict lookup. Putting that behind a network call is the
microservices-for-org-chart anti-pattern: a new deployable, a new SLO,
a new timeout budget — for µs of math.

What *is* a service (or at least a worker): the **state aggregator** —
consumes the stream, folds traversals into corridor cells, applies the
09 gates (k≥3 distinct tokens, ≥2 time bins, single-source dominance
cap, dwell/plausibility rejects), publishes the shared state and the
15-min budget inputs. It never touches a request.

The one judgment call — **reservation commit on plan issue** (P2/100k
only): when a plan is served, the recommended option's cells get a
soft reservation (`pending[cell][5-min-bucket] += 1`, TTL ~2× trip
duration, idempotent by `plan_id`). Options:

| how | cost | verdict |
|---|---|---|
| sync Redis `EVALSHA` (one round-trip writes all cells) | ~1–2 ms on plan path | **yes at 100k** — atomic, deduped, inside the freshness window |
| buffered async (per-task queue, 5 s flush) | ~0 ms, 5–10 s convergence | fine at 10k where reservations are statistical anyway |
| DynamoDB | +5–15 ms, hot-key risk | ✗ |

**Verdict: sync read + rank inside plan (always); async aggregation
worker (always); sync reservation commit only at the 100k/P2 tier.**
And the honesty bound from the skeleton, implemented as plumbing: λ=0
stays the default — quota = *offered alternative with incentive*,
never a hidden reroute; the user-optimal option is always present and
labeled. The pipe doesn't get to change that.

---

## 6. Compute: Fargate sizing and what actually breaks first

Current task: 1 vCPU / 3 GB, single uvicorn worker, FastAPI +
`osrm-routed` sidecar — OSRM MLD over 4.4M NCR edges (~1.5–2.2 GB
resident), Python ~0.6–0.9 GB. **The task is already at its RAM
ceiling** — the headroom for what this memo adds (flow mirror ~10 MB,
tick buffers, one more uvicorn worker ~+400–600 MB) does not exist in
3 GB. First sizing rule: **+workers = +RAM; OSRM is a fixed ~2 GB tax
per task that hosts it.**

### Failure order at scale (each is the *first* thing at its tier)

| # | wall | hits at | evidence |
|---|---|---|---|
| 1 | **Event-loop CPU on 1 vCPU** — plan serialization + dose scoring + gzip; ~2–5 plan-rps/vCPU | inside the **1k tier** (8 plan-rps peak > 1 task's ~3 rps) | measured: docs/33 — response machinery starved co-tenants; caches shipped help but misses still cost |
| 2 | **OSRM RAM duplication** — 2 GB graph cloned per task | ~10+ tasks → 20 GB of identical graphs; pure waste | architectural, not measured — MLD needs the full graph resident per process |
| 3 | **`_scan()` reads on `alive108-agg`** — `corridors()`/`city_aggregates()` scan the whole table per call | any real scale; ~seconds per scan at 10⁵ items | `agg_ddb.py:456–468` — must be bypassed by the state layer, not tuned |
| 4 | **DynamoDB hot keys** — `day#{day}`, `global`, `cell#{hottest}` | ~10k tier (completions ~7/s OK; marquee-cell events concentrate) | 1,000 WCU/pk ceiling; fix = shard suffix + read-time rollup |
| 5 | **Fargate quotas + subnet IPs** — each task eats an ENI/IP | ~60–100 tasks → need /22+ subnets + quota raise | quota ticket, boring but real |
| 6 | **Egress** — plan payload × rps | 100k tier: ~33 MB/s ⇒ ~85 TB/mo | §13 — bigger than compute unless payload slims |
| 7 | uvicorn worker geometry | continuous | workers ≈ vCPUs; `_ENG_EXEC` stays 3 threads (docs/33: more threads = queue shuffling, not CPU) |

### Tier topologies

**≤1k (demo/pilot):** one task, but **2 vCPU / 6 GB** — the 3 GB box
cannot host a second worker plus OSRM plus mirrors. Single uvicorn
worker + `ALIVE_INGEST_IN_APP=1`. ~$90/mo. (The honest alternative:
1 vCPU/3 GB exactly as today + flow dict — demo-only, admits plan p95
degrades past ~3 concurrent plans.)

**~10k:** split already justified — **OSRM tier: 3 × 4 vCPU / 8 GB**
behind an internal NLB (~2 GB graph + headroom; ~200–400 route-rps
each); **API tier: 4–8 × 2 vCPU / 4 GB**, workers=2, autoscale on CPU
+ `plan_queue_depth` custom metric. Plan caching (60 s `(o,d,mode,
epoch)` key, extends the docs/33 pattern) is what keeps this at ~15–20
vCPU instead of ~30–40 — commute ODs repeat; state the assumption.
~$500–900/mo compute.

**~100k:** API **50–100 × 2 vCPU/4 GB** (the wide range is the honest
one — it spans plan-CPU 0.3–0.5 s and cache-hit 50–80%; §13 carries the
cost as a range); OSRM **4–6 × 4 vCPU/8 GB**; aggregator worker
**2 × 2 vCPU/4 GB**; optional Fargate→EC2-launch-type or Graviton move
(~25–35% compute saving — worth a line item at this spend, not at
10k). Cross-AZ spread; NLB unchanged — connection churn ~2–3k/s is
nowhere near its envelope.

The sizing sentence to quote: **the API fleet scales on plan-CPU, the
OSRM tier scales on route-rps and stays small, the state layer never
materially contributes to compute** — 3k writes/s and a dict are not a
compute problem anywhere on this page.

---

## 7. The state-feedback loop: rollups vs streaming vs Flink

Three cadences on one pipe; the memo's job is matching each consumer to
the cheapest loop that meets its budget (§1).

### Loop 1 — EventBridge rollup (the shipped pattern, densified)

Today: `rollup-daily` + `validate` one-off Fargate tasks; ingest-15min
disabled because the in-app loop owns it (docs/18). Add a
`rollup-1min`/`rollup-5min` schedule → tiny task or Lambda that reads
the shared state → writes the corridor-hour snapshot to DDB + S3 →
gov console + badge surfaces poll it.

| property | value |
|---|---|
| latency end-to-end | 60–180 s |
| monthly cost | ~$10–40 (Fargate-minutes or Lambda; S3/DDB puts are noise) |
| feeds | corridor badges, gov console, budget-consumption history, the audit trail |
| honest limit | cannot drive anti-pile-up (needs ≤30 s); **it is the record, not the reflex** |

This loop also owns the *durable* copy: the Redis/memory flow state is
correctly ephemeral; the corridor-hour rollup is what the evaluation
and regret-replay (09 §2.2) read a month later.

### Loop 2 — streaming consumer (state convergence ≤15–30 s)

The §3 consumer (in-task fold at ≤10k; SQS/Kinesis consumer at 100k)
folds events → shared state continuously. Freshness = flush interval +
write latency ≈ 5–20 s. This is the loop the §4 mirrors poll/are
backed by, and the only loop fast enough for pending-reservations.

### Loop 3 — Flink / Kinesis Analytics — when it stops being overkill

For corridor state it is overkill *by construction*: the state is
decayed counters — a dict and a 200-line consumer. Flink pays for
per-event windowed state, multi-stream joins, and exactly-once
semantics; we need none of those for counters that are allowed to be
approximate. **It stops being overkill when three conditions stack:**

1. **rate** — sustained >~10k events/s (our 100k tier), where
   micro-batching on a single consumer task gets fragile; and
2. **semantics** — you need per-event sliding windows or joins, e.g.
   "true speed distribution per corridor per sliding 5 min" over 100k
   probes, or traversals ⋈ GTFS-RT bus positions ⋈ an incident feed —
   things a counter cannot express; and
3. **accountability** — a metered/published data product where "we
   recomputed the whole window exactly-once" is an audit requirement,
   not a nicety — the gov real-time claims tier, if it ever exists.

Roughly: **P3+ features at ≥100k concurrent**. Until then KDA's floor
(~1–4 KPU ≈ $80–350/mo + engineering) buys you a distributed-systems
problem in exchange for arithmetic a dict already does. Say that
plainly in the demo if asked — it's the right kind of boring.

---

## 8. Graceful degradation — the matrix is the product

Design rule: **the plan path fails open to today** (λ=0, free-flow +
field-only, user-optimal) and says which piece of the world it's
missing. Every degraded mode is a labeled mode — this is the deployed
system's own rule (`stale` badges, `eta_model:"estimated"`,
`serving:snapshot`) extended to the flow layer.

| component down | what happens | what the response says |
|---|---|---|
| Redis / shared state | mirrors serve last-good up to `FRESH_MAX=300 s`; below that, flow terms drop out | `flow_basis:"stale_age_s=N"` → `"unavailable"`; quota advisories suppressed entirely below the freshness floor |
| Kinesis/SQS backlog | state ages linearly; `state_age_s` on every flow-derived field; shed order: telemetry increments (lossy-tolerant) before completions (ledger truth) | `flow_basis:"lagging"` on badges; `/health.flow.lag_s` for alarms |
| Aggregator worker dead | state freezes; mirrors age out → same path as Redis-down within 5 min | honest empty, not fabricated zeros (the `/v2/city/moves` precedent) |
| DynamoDB | ledger writes buffer+retry with jitter; aggregates serve from memory + S3 snapshot (existing `store_blob` degrade path) | nothing user-visible on plan; `last_error` surfaced to admin |
| OSRM tier | `eta_model:"estimated"` (shipped fallback); flow layer unaffected | as today |
| API task with hot mirror dies | its ~1/N share of increments lost ≤flush-window | nothing — counts are estimates; this is the stated semantics |
| **Herding event** (healthy but dangerous) | 09's gates, implemented as plumbing: deterministic fractional split via token-hash, staleness-scaled softmax temperature, hysteresis band, per-corridor divert cap ≤10–15% | two identical O-D requests can honestly get different advisories — disclosed on the receipt |

The one non-negotiable: **quota advisories never serve stale.**
Advisory on a 5-min-old map is how you herd. Below the freshness
floor the surface renders dark-corridor, not "clear" — absence of
reports must *look* like no-data, not free-flow (09 §5.2).

---

## 9. Stability plumbing — the failure that isn't infrastructure

09 owns the math and the kill list; this memo owns the three pipe-level
mechanisms that make oscillation physically harder:

1. **Commit-before-recommend.** At the 100k tier the reservation write
   (§5) lands *before* the response is served — the next planner sees
   the slot taken, not the corridor "still empty". This is the
   difference between load-balancing and synchronized stampede.
2. **Staleness-scaled spread.** The advisory layer's exploration
   temperature is a function of `state_age_s`: fresh state ⇒
   deterministic-best allowed; aging state ⇒ deterministic fractional
   split (token-hash nth) so identical requests diverge. Plumbing
   implements this as *inputs to* 01's cost function, not as a new
   math layer.
3. **Freshness hysteresis.** A corridor doesn't re-enter "calm" on the
   same threshold that marked it "busy" (±10–15% band); the state blob
   carries `entered_state_ts` so flap-rate is itself observable and
   alarmable (`flow_state_flips/hour > X` = loop instability alarm —
   the oscillation detector is a CloudWatch metric, not a postmortem).

---

## 10. Cost model per tier (monthly, ap-south-1, sustained-avg ≈ 0.5×peak)

| line | ≤1k | ~10k | ~100k |
|---|---|---|---|
| API Fargate | 1×2vCPU/6GB — **$90** | 4–8×2vCPU/4GB — **$240–480** | 50–100×2vCPU/4GB — **$3,000–6,000** |
| OSRM tier | in-task | 3×4vCPU/8GB — **$430** | 4–6×4vCPU/8GB — **$570–860** |
| Aggregator/consumer | in-task | in-task or 1×2vCPU — **$0–60** | 2×2vCPU + Lambda — **$150–250** |
| Flow-state substrate | — | DDB snapshot ~**$5** | Redis r7g.large ×2 — **~$300** |
| Ledger DDB | ~$30–70 | ~$150–300 | ~$400–800 prov+AS |
| Ingestion (queue/stream) | — | ~$0–80 | Kinesis ~$150–300 |
| NLB + LCUs | $25 | $40–80 | $150–300 |
| Egress (plan + map) | ~$5–15 | ~$150–600 | **$1,500–7,500** ← top-3, slim↔full payload |
| CloudWatch/logs | ~$10 | ~$40 | ~$150–250 |
| **Total** | **~$160–210** | **~$1,100–1,900** | **~$6,500–16,500** (§13 mid-case ≈ $11–12k) |
| per concurrent user | ~$0.16–0.21 | ~$0.11–0.19 | ~$0.07–0.17 |
| per MAU (×6 MAU:concurrent [I]) | ~$0.03 | ~$0.02–0.03 | ~$0.01–0.03 |

Notes that keep the table honest:

- The ≤1k total *includes* today's baseline (~$46 task + NLB + DDB) —
  the flow layer itself adds ~$0–40 at that tier. The feature is
  nearly free until it isn't.
- Egress at 100k is the sleeper: 33 MB/s *sustained at peak* ≈ 85 TB/mo,
  ~45–50 TB duty-corrected, ~15–20 TB once `/v2/plan` gets a `fields=`
  slim projection (8–15 KB vs ~40 KB avg). That lever cuts the largest
  single line ~3× — cheaper than any compute optimization on the page;
  listed as a P2 work item, not waived.
- Fargate→EC2-launch-type at 100k saves ~25–35% of the compute lines;
  Graviton similar order on API tasks (OSRM is already C++, arm64
  fine). Deliberately deferred below 100k — the complexity isn't free.
- DDB on-demand vs provisioned crosses at ~50–80 sustained WCU; the
  10k+ tiers assume provisioned + Application Auto Scaling on
  `alive108-agg`, on-demand kept for spiky side tables.

---

## 11. Demo vs production — the line, drawn explicitly

**Demo build (days, zero new AWS resources):**

| piece | what it is |
|---|---|
| flow dict | `community.py`-style in-mem `flow[cell]` on the one task: `{n_active, Σv, tokens, last_ts}` — fed by real `/v2/trip` **and** `tools/sim_fleet.py`, a generator replaying ~200 synthetic traversals across ~20 named corridors |
| honesty seam | sim traversals carry `source:"sim"` through the same k-gates; admin + `/health` report `sim_share` — the demo *shows* the honesty machinery working, that's the point |
| plan integration | `rank_options` gains corridor-load term + **one** quota advisory line on the receipt ("corridor busy — here's a lighter option + you avoid ~N µg"); λ stays 0; user-optimal still listed |
| visible proof | two devices, same O-D, back-to-back → second device sees the corridor "loaded" by the first → different advisory. The anti-pile-up story in 90 seconds |
| new endpoint | `GET /v2/corridors` — corridor-load bands for the map layer, k-gated, `state_age_s` stamped |

**Production deltas (what the demo deliberately does *not* have):**

| demo shortcut | production replacement | tier |
|---|---|---|
| sim fleet | real stream, `sim:` sources excluded from authority inputs (never from display during pilots — labeled) | all |
| in-task flow dict | mirror + shared substrate (§4) | ≥10k |
| direct fold | SQS/Kinesis + consumer (§3) | ≥10k/100k |
| advisory = static line | reservation counters, per-corridor divert caps, hysteresis metrics (§5, §9) | 100k/P2 |
| no alarms | CloudWatch: `state_age_s`, `flow.lag_s`, `stream_iterator_age`, `ddb_throttles`, `flow_state_flips`, plan p95 | all prod |
| single AZ task | multi-AZ service, autoscaling, OSRM tier split | ≥10k |
| k≥3 only | tiered-k per 06 (k≥10 corridor-day, k≥20 hourly/public) before any gov surface reads it | P1+ |

---

## 12. Component diagram — the 100k tier

```
            ┌──────────────────── DEVICES ────────────────────┐
            │ app: GNSS @25 m → batch 45 s → POST /v2/tick    │
            │      trip-end summary       → POST /v2/trip     │
            │      plan queries           → POST /v2/plan     │
            └───────────────────┬─────────────────────────────┘
                                │ HTTPS
                                ▼
                ┌─── NLB (cross-AZ, Elastic IP) ───┐
                └───────────────┬──────────────────┘
                                ▼
┌─ API fleet: 50–100 × Fargate 2vCPU/4GB · workers=2 · stateless ────────┐
│                                                                       │
│  /v2/tick ─► privacy_pipeline (trim·thin·round·h3·sha256) ─► PutRecords│──┐
│                                                                       │  │
│  /v2/plan:                                                            │  │
│    read   ─► flow MIRROR (dict ~8 MB, epoch-stamped, µs)              │  │
│    score  ─► rank_options + corridor-load term · λ=0 (user-optimal    │  │
│              stays listed) · quota advisory on FRESH state only       │  │
│    commit ─► Redis EVALSHA pending[cell][bucket] += 1 (~1 ms)         │  │
│    route  ─► internal NLB ─► OSRM tier 4–6×4vCPU/8GB                  │  │
│              (MLD, 4.4M NCR edges, free-flow baseline)                │  │
└───────────────────────────────────────────────────────────────────────┘  │
                                                                           │
┌─ Kinesis "alive-flow" 4–8 shards · 24 h replay ◄──────────────────────────┘
│                                                                           │
│  consumer 1 ▸ AGGREGATOR svc (2×2vCPU): fold → cells, apply 09 gates      │
│               (k≥3 tokens · ≥2 time bins · ≤30% single-source cap ·       │
│               dwell/teleport rejects) → Redis corr:*, corr:pend:*         │
│               → delta-publish → mirrors (5 s convergence)                 │
│  consumer 2 ▸ LEDGER COMPACTOR (Lambda/Fargate): trip folds →             │
│               alive108-agg (DDB, prov+AS) — day#·mode#·cell#·hour#·       │
│               global · sharded hot pks · ~27 writes/completion            │
│  consumer 3 ▸ ANALYTICS TAP → S3 parquet (regret-replay / 09 audit)       │
└───────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─ EventBridge rollup-5min → corridor-hour snapshot → DDB + S3 ────────────┐
│  feeds: gov console (read-only) · /v2/city · /community · budget inputs  │
│  budgets + λ recompute rides the existing 15-min field rebuild (D1)      │
└──────────────────────────────────────────────────────────────────────────┘
        │
        ▼   every "publish" arrow passes 06's tiered-k gates; every
            flow-derived number carries band + source + state_age_s
```

Degradation overlay (§8): mirror ⇠ last-good when Redis/aggregator
dark; queue lag ⇠ `flow_basis` degrades; authority ⇠ λ→0 = today.

---

## 13. Per-100k-user monthly estimate — the bottom-up bill

Sustained-avg ≈ 55k concurrent (0.55 duty on 100k peak — commute-bimodal
[I]), ap-south-1 list prices [C]:

| line | sizing | $/mo |
|---|---|---|
| API fleet | ~75 × 2vCPU/4GB avg (autoscale band 50–100) | ~4,500 |
| OSRM tier | 5 × 4vCPU/8GB | ~710 |
| Aggregator + consumers | 2×2vCPU Fargate + Lambda | ~200 |
| Kinesis `alive-flow` | 6 shards + PUT units + 24 h retention | ~200 |
| Redis flow-state | r7g.large ×2 (HA) | ~300 |
| DynamoDB `alive108-agg` | ~600–800 WCU prov + AS, ~200 RCU, storage noise | ~500 |
| S3 (snapshots + parquet + archive) | ~TBs + GETs | ~80 |
| NLB ×2 (public + internal) | hourly + ~10–40 NLCU | ~250 |
| CloudWatch metrics + logs | ~200 metrics + ~200 GB logs | ~200 |
| **Egress to internet** | ~18 TB slim-mode · ~48–85 TB full payload | **~1,500–7,300** |
| **Total** | | **~$8,500–14,500** (mid-case ≈ $11–12k) |

= **~$0.09–0.15 per concurrent user-month**; if 100k concurrent ⇒
~0.6–1M MAU [I], ≈ **$0.010–0.024 per MAU-month**.

Levers, in order of size: `fields=` slim plan payloads (−$2–4k) →
EC2-launch-type/Graviton API fleet (−$1–1.5k) → plan-cache hit-rate
engineering (−$0.5–1k compute) → DDB reserved capacity (−$0.1–0.2k).
The flow-state layer — the thing this memo is about — is **~$500/mo of
the bill.** The expensive part of "real-time" at 100k was never the
state; it's serving 833 plans a second and shipping the bytes.

---

## Appendix A — assumptions register (attack these, not the structure)

| # | assumption | sensitivity |
|---|---|---|
| A1 | 45 s telemetry batch cadence | ±15 s moves every rate ±33% — conclusions unchanged (folding absorbs it) |
| A2 | 100 cells read/plan | ×2 plausible; still µs in-memory, ~1.5 ms Redis — no decision changes |
| A3 | 0.4 s plan CPU | ×0.5–1.25 plausible — the single biggest compute-cost driver; cache-hit engineering is the hedge |
| A4 | plan-rps = U/120 | ×2 plausible at nav-heavy adoption; same hedge |
| A5 | 0.5–0.55 duty factor | Delhi bimodal [I]; sustained-flat usage raises DDB/stream ~linearly, compute already peak-sized |
| A6 | ~20 distinct cells/trip ledger write | ~25–30 writes/trip total (measured shape in `record_trip`) |
| A7 | Redis single-node ~150–200k ops/s | 100k-tier needs ~90k key-ops/s served, ~20k incl. micro-cache — headroom exists, it's not free headroom |

## Appendix B — price basis (ap-south-1 list, Oct-2026, ±15%)

Fargate x86 $0.04656/vCPU-hr + $0.00511/GB-hr (1vCPU/3GB ≈ $45–46/mo —
matches docs/18's deployed figure). DDB on-demand ~$1.4/M WRU, $0.28/M
RRU; provisioned ~$0.5/WCU-mo + ~$0.10/RCU-mo. Kinesis provisioned
~$0.018–0.021/shard-hr + ~$0.018/M PUT units (25 KB). SQS $0.40/M reqs.
Lambda $0.20/M + GB-s. ElastiCache r7g.large ~$0.20/hr ≈ $145/mo/node.
NLB $0.0225/hr + $0.006–0.008/NLCU-hr. Egress ~$0.086–0.13/GB tiered.
KDA ~$0.10–0.13/KPU-hr, 1 KPU min. Verify at commit — prices drift;
the *ratios* are the argument and they're robust to ±20% on any line.
