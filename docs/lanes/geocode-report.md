# Deep-geocoding lane — T3 live-OSM arm + anchor parse + honest fallback

NEEDS_DEPLOY — verified locally on `:8901` (`T1_ENGINE=alive_core_ref`,
`uvicorn main:app --port 8901`), not yet against prod CloudFront.

## What landed (`server/v2/search.py`)

**T3 Overpass arm** (`V2_OVERPASS`, default on; `off/0/false/no/disabled` to kill):
fires only when the local cascade is thin — `<3` hits, best hit `>2 km`, **or**
a resolvable locality in the query is never mentioned by the user-visible top
rows (e.g. `... shahdara` → bakeries in Sawan Park: strong rows, wrong ward).
Emits two QL bodies (anchored `around:` probes per resolved anchor + NCR-bbox
name-chains) as hedged POSTs — each probe hits two mirrors concurrently inside
one 3 s fuse (`overpass-api.de`, `overpass.private.coffee`, `kumi.systems`).
Descriptive UA required — `overpass-api.de` 406s curl's default. Non-200 / slow
→ `t3_status: timeout|error|empty`, never a fabricated row. 45 s in-memory
cache, but only `ok`/`empty` results are cached — a hung mirror doesn't poison
the next query. Wire rows carry `match: "live osm"`, `source: "overpass"`,
`sources: ["t3"]`, real `(type,id)` ids — same `_engine_rows` shape, so merge
dedupe + `name_says_elsewhere` demotion apply unchanged.

**Query-parse depth**: `_locality_anchors` resolves trailing locality phrases
(≤3 spans) against ~34 k locality-kind index rows, then resolves spans
sequentially — best-corroborated anchor first, later spans take the candidate
nearest the cluster and **stay unresolved when nothing is within 7.5 km** (so
`ashok nagar` can't pin the Mayur Vihar ward when the user means Shahdara's).
`_deep_parse` then pulls the block letter (`c block`/`block c`), POI probes
with name-context (`bakery{ctx:[pawan]}`, `mandir{ctx:[hanuman]}` via a ~45-type
token table), and free name tokens. Locality-kind filtering is exact — bare
(≤3-token) names only for transit/worship/marketplace kinds, so `Hanuman
Mandir` can anchor but `Delhi Shahdara Junction railway station` can't.

**Gazetteer requery** (t1-shaped, joins t1 before merge): each POI probe and
name-token phrase is re-asked of the local engine biased at the **anchors** —
`pawan bakery` around Shahdara surfaces the real Shahdara bakeries the
user-bias query ranked out.

**Fallback ranking**: live rows sort by best `classify()` against every probe
phrase + anchor name (a real `Pawan Bakery` node outranks any fallback), then
anchor proximity (≤450 m to live landmarks, ≤700 m to resolved localities).
Unnamed elements keep their tag label — never the query's words. Subtitles
carry provenance: `kind · addr bits · near <landmark> · <locality chain>`.

## Verified on :8901

| query | fires | result |
|---|---|---|
| `Pawan Bakery C block Hanuman Mandir Ashok Nagar Shahdara` | yes (uncovered) | anchors = Shahdara-locality + Hanuman-Mandir-east; gaz requery adds real Shahdara bakeries (Defence/Sona Mithai/Amar/Pandit, ~8.2 km, honest cluster) |
| `pawan bakery ashok nagar shahdara` | yes | same anchored bakeries; `ashok nagar` stays a probe token, not a wrong-ward anchor |
| `hanuman mandir shahdara` | no | T1 already exact: 8 mandirs, Shahdara Hanuman Rd Market, 97–340 m |
| `bakery near block c ashok nagar` | no | T1 already exact: bakeries in `New Ashok nagar Block C` |
| `connaught place` (regression) | no | unchanged CP rows, no arm |
| `new delhi railway station` (regression) | no | unchanged NDLS rows, no arm |
| `V2_OVERPASS=off` | — | `tiers:["t1"]`, `t3_status:"off"` |

`_live_rows` unit-checked with realistic Overpass elements: `Pawan Bakery`
node → `rank0 live osm`; `Ashok Nagar` platform node (28.7001, 77.297 — the
ward the corpus lacks) → `rank0`; unnamed bakery → honest `Bakery` label,
`near c block market · shahdara · hanuman mandir` subtitle.

## Timing

Steady-state: thin queries ≈ `t1 ~1.2 s + t3 ≤3.3 s` (fuse cap). Non-thin
queries pay ~30–80 ms for the uncovered-check anchor resolve — the anchor scan
itself runs on the T1 executor, never the loop. First request after boot adds
the shared gazetteer ingest (~4–7 s) — amortized, same as T1's own cold path.

During this verification the **entire public Overpass fleet was degraded**
(api.de hanging >10 s, kumi/private.coffee 500ing): the arm correctly returned
`timeout` with zero live rows while the gazetteer requery still delivered the
honest anchored answer. The mirror hedge + 3 s cap behaved exactly as designed.

## Honest verdicts

- `Pawan Bakery ... Shahdara`: **honestly anchored** — no `Pawan Bakery`
  exists in OSM/live index; answer = real Shahdara bakeries + locality anchors
  with provenance, never a made-up point.
- `hanuman mandir shahdara`, `bakery near block c ashok nagar`: **exact** via
  T1, arm correctly silent.
- `ashok nagar` in Shahdara: exists in live OSM (platform node 28.700,77.297)
  but not in the local corpus — resolves via the T3 name probe when the fleet
  is healthy.

Tests: `test_v2.py` 23 pass, `test_search_quality.py` 116 pass + 2 xfailed.
