# lane: poolgap — engine rows that never reach the merge

Scope (coordinator brief): Sikanderpur/Chhatarpur metro and Terminal
1/2/3 rows exist in the gazetteer/engine index but never reach the
`/v2/search` merge — the engine's compound pool starves or vetoes them.

## diagnosis

All gaps live in `server/core_engine.py` pool building, not in data —
every named row was confirmed present in `delhi-gazetteer.json` and the
348k-entry engine index.

Three distinct bug shapes, verified on prod before the fix:

**Bug A — wrong-anchor kind scan starves literal hits** (`sikanderpur
metro`). `search()` prepended *every* comp row before `[:limit]`:
`hits = comp`. The kind-scan anchored on the nearest same-named
locality (Sikanderpur ward ~11 km NE of bias, not the Gurugram metro
area ~21 km SW), so 7 junk category rows (bus stops, Metro Shoes …)
led the wire; the verbatim station names sat at positions 9–12 and
were cut at limit=8. With limit=15+ they surfaced — hence "rows exist
but never reach merge".

**Bug B — `_foreign` veto + bare-digit rows** (`terminal 1`,
`terminal 2`). `_subplace` anchored on 'Kendriya Terminal' (CP) and
`_foreign_place` convicted every real airport-terminal row — their
leftover tokens resolve to 'Delhi Airport', which lacks Kendriya's
distinctive tokens. `search()` then dropped *all* `_foreign` hits.
Meanwhile Devanagari displays normalize to bare digits
(`'…द्वार सं. 2' → ['2']`), trivially passing `_unit_leading` — the
only row prod emitted for `terminal 2` was a Central Secretariat gate.

**Bug C — lost qualifier** (`delhi airport t1`). Kind `airport`
consumed the phrase; `place_toks` shrink resolved bare `Delhi` as the
anchor and *discarded* `t1` — the kind scan then returned every
airline office within 2.6 km of the centre.

## fix (all in `server/core_engine.py`, general mechanisms only)

1. `search()` ordering `units + covered + kinds + rest`: unit-leading
   subplace rows keep their strict contract ('Beta 2' still leads
   'beta 2 greater noida'); name hits covering the whole query
   (cov = 1.0) outrank speculative kind-scan rows; partial hits trail.
2. `_foreign` may no longer veto a full-coverage hit — it convicts
   against ONE speculative anchor; a literal answer can't be foreign.
   Partial-hit protection unchanged.
3. `_compound` tracks `want_extra` — unit-shaped place tokens the
   winning anchor phrase never consumed (digits, letter+digit like
   `t1`) — and `_leftover_ok` filters kind-scan rows that can't carry
   them (alias-aware: `t1` → `terminal 1`). `etoks` stays lazy so the
   empty-`want_extra` path costs exactly what it did before.
4. `_unit_leading` drops bare-digit displays — a non-ASCII name that
   normalizes to only digits is a parse artifact, never a unit leader.
5. `itertools.pairwise` shim for py <3.10 (local runner is 3.9; the
   unguarded call would crash `_subplace` entirely there — flagging:
   prod runs 3.11+ so this is dev-machine insurance).

## verification (prod-parity stack, alive_core_ref, bias 28.63/77.24)

| query | before (prod) | after (`GET /v2/search`) |
|---|---|---|
| `sikanderpur metro` | bus stops / Metro Shoes | `Sikanderpur metro station, Gurugram` #1 |
| `chhatarpur metro` | ok | `Chhatarpur metro station` #1 (unchanged) |
| `terminal 1` | 1 bogus Devanagari row | `Terminal 1 IGI Airport` #1 |
| `terminal 2` | 1 bogus Devanagari row | real T2 airport rows top-5 |
| `delhi airport t1` | airline offices | Delhi Airport rows (honest) |
| `beta 2 greater noida` | `Beta 2` #1 | `Beta 2` #1 (unchanged) |
| `atm near cp` | ATMs near CP | unchanged |
| `pocket b sarita vihar` | Sarita Vihar + Pocket B | unchanged |

`pytest tests/test_query_tolerance.py tests/test_search_quality.py`
→ **140 passed**; `tests/test_core_engine.py` → 8 passed. One
deselect: `test_search_latency_compound_path` fails on the pure-Python
reference engine (~300 ms p95) — confirmed identical on unmodified
code (pre-existing local-only flake; the C++ build dir isn't in this
clone so the fast path never loads).

Not mine: `neelanchal dham sant nagar` stays empty — index MISS
(index-truth lane scope, honest fallback only, no row to surface).

NEEDS_DEPLOY — server-side only; restart the v2 search workers.
