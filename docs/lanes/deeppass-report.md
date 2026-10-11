# deeppass — T3 Overpass arm: wait-all → per-query mirror race

**Verdict:** the arm's worst case is gone. A thin-local query now costs
its *fastest* mirror instead of its *slowest probe*: ~3.0–3.4 s →
~0.4–0.7 s whenever any mirror is healthy, never worse than the old
fan-out, and the 3 s fuse is still the whole-arm cap.
NEEDS_DEPLOY = yes — `server/v2/search.py` only.

## What the arm did vs does

The T3 arm was never truly serial — since `1b434eb` it fired up to 2 QL
bodies (anchored + wide) × the first 2 mirrors concurrently, then
`asyncio.wait(..., timeout=fuse)` with `ALL_COMPLETED`. Two leaks:

- **wait-all:** the arm returned when the *slowest* of 4 requests
  finished or the fuse burned. One hung mirror turned a 300 ms answer
  into a 3.0 s ride — the perf3 ~3 s arm path.
- **half the fleet:** `_OVERPASS_ENDPOINTS[:2]` — the third mirror
  (kumi) never carried a probe.

Now each distinct probe QL runs `_op_race`: all 3 mirrors at once,
`FIRST_COMPLETED`, first *definitive* answer (`ok` or `empty`) wins,
losers cancelled. The arm `asyncio.gather`s the races, so its cost is
**max over queries of min over mirrors** — the slowest query's fastest
mirror, not the slowest request. Merge contract unchanged: elements
merge across queries, `_live_rows` ranks them, `sources:["t3"]` rows
keep the same schema. 45 s `_OP_CACHE` untouched; `_OP_FUSE_S` still
caps everything.

One semantic guard added in `_op_post_one`: a 200 with `elements: []`
AND a `remark` field (Overpass "timed out in"/rate-limit) is a degraded
mirror, not a real negative — scored `error` so it can't win a race a
healthy sibling would have answered with rows.

## Before → after (median of 5, arm wall-time ms)

Stubbed-transport bench driving the *real* `_overpass_arm` — HEAD copy
(`_search_old`) vs this patch, identical `deps.http()` latency-injected
stub. Real mirrors are unreachable from the dev box (overpass-api.de
refuses connections; private.coffee + kumi were 500ing tonight — itself
the motivating failure shape), so these are scheduling-semantics
numbers; prod numbers come post-deploy.

| thin-local query | mirror profile | wait-all | mirror-race |
|---|---|---|---|
| pawan bakery c block hanuman mandir ashok nagar shahdara | 300/900/1500 ms | 1307 | **715** |
| hanuman mandir near gtb nagar | 300/900/1500 ms | 1011 | **415** |
| dominos sector 15 noida | 300/900/1500 ms | 984 | **383** |
| pawan bakery … shahdara | 300 ms / hang / hang | 3414 | **716** |
| hanuman mandir near gtb nagar | 300 ms / hang / hang | 3114 | **415** |
| dominos sector 15 noida | 300 ms / hang / hang | 3071 | **378** |
| pawan bakery … shahdara | 500s / 900 / 1500 ms | 1287 | 1280 |
| hanuman mandir near gtb nagar | 500s / 900 / 1500 ms | 1006 | 1006 |
| dominos sector 15 noida | 500s / 900 / 1500 ms | 974 | 975 |
| all three | all-hang | ~3.1–3.4 s | ~3.1–3.4 s (timeout) |

Merged row sets: **identical in all 12 cells** (per-QL marker elements
diffed). Honest residuals:

- All-healthy-but-slow mirrors (row 3): no win, no loss — racing can't
  beat physics, only scheduling.
- Arm wall-time isn't pure mirror latency: ~80–430 ms of locality-anchor
  resolution + gazetteer requery rides beside it in both versions —
  untouched by this lane.
- Probe count per thin-local query: 4 → up to 6 POSTs (2 QLs × 3
  mirrors); losers are cancelled mid-flight. Still bounded by the fuse,
  fires only when local tiers are thin.
- First-definitive-wins trades a rare replication-lag edge (fast mirror
  returns `empty` while a slow sibling has rows) for latency — same QL
  on the same extract, bounded; the remark guard covers the degraded
  variant of it.

## Tests

`server/tests/test_v2_overpass_race.py` — 6 new tests, all green:
first-definitive-wins + loser cancel, error-drops-out, empty is
definitive, fuse caps all-hang (all 3 losers cancelled), remarked-empty
is not definitive, end-to-end arm merge + cache.

Full suite on this box: identical pass/fail set before vs after the
change (verified by stash A/B on the search files). Local pre-existing
failures unrelated to this lane — flagged for the coordinator, not
fixed here (out of scope):

- `test_no_uncontracted_server_fields[V2SearchResponse]` — server emits
  `t3`/`t3_status` fields contract.ts never declared (the T3 lane's own
  gap; contract.ts is a webapp file).
- `test_search_merge_preserves_engine_landmark_order`,
  `test_search_subplace_anchor_beats_foreign_unit_rows` — merge-order
  regressions on main (anchorsink-era), reproduce on clean HEAD.
- `test_admin_*`, `test_landing_serve`, `test_playtime` — markup/data
  gaps on main; `test_parity_krige` needs an Eigen build (fixed locally
  by building `alive_core` with `EIGEN_INC`).
- `test_search_latency_compound_path` — the known local-only flake,
  deselected as usual.

## Risks

- Upstream load: ≤6 concurrent POSTs per thin-local arm vs 4 before —
  cancelled losers still hit the mirror briefly. Bounded by the fuse,
  and the arm only fires when local tiers are thin.
- `asyncio` semantics: `FIRST_COMPLETED` races + task cancellation on
  the shared `httpx.AsyncClient` — cancellation mid-request is clean;
  verified losers cancel (no leaked tasks) under test.
- No per-query logic added; the mechanism is uniform across QL bodies.
