# Lane X — search index (oct11)

Owner files: `server/v2/search.py`, `server/v2/gazetteer.py`,
`server/v2/places.py`, `server/data/*`, `server/tests/test_ac_oct11.py`.
Nothing committed/pushed/deployed.

## 1. `GET /v2/ac?q&lat&lon&limit=10` (new, search.py → `gazetteer.AC`)

Pure in-memory prefix type-ahead. Never calls the network, never waits on
the index build.

```
GET /v2/ac?q=new%20delhi%20rail&lat=28.684&lon=77.300&limit=10
200 {"q": "...", "status": "ok" | "warming" | "unavailable",
     "results": [{"id": "gaz:1194" | "geo:1260716", "name", "subtitle",
                  "kind", "lat", "lon", "distance_m", "match_rank",
                  "match", "score", "source": "gazetteer"|"geonames",
                  "sources": ["ac"]}],
     "count", "bias", "index_rows", "took_ms"}
```
- Row shape = `/v2/search` results (same keys), so search.js can reuse its
  mapper. `subtitle` is plain ("temple · Sant Nagar", "railway station"),
  never a raw tag. `match_rank` 0 = name starts with the query,
  1 = every word in the name, 3 = partial/context.
- `limit` 1..20 (422 outside), `q` 1..200 chars. Bad/missing lat/lon →
  no distance bias (Delhi centre used for `distance_m`).
- While the index builds (~6–13 s once per task, background thread
  started at import) the answer is `{"results": [], "status":
  "warming"}` immediately — never a spinner, never a block.
- `/v2/place/{id}` resolves `gaz:` and the new `geo:` ids from the same
  index (no corpus load).

Matching: earlier words match WHOLE name tokens or alias phrases
(aliases.json + builtins: `cp` → Connaught Place, `ndls`, `aiims`…), the
LAST word matches as a prefix. The lead word must be in the NAME;
kind words (`bakery`, `station`, `mandir`, `hospital`…) are covered by the
name or by a matching category and boost matching categories — they never
pick a row by themselves. Trailing words may be satisfied by locality
names around the row (cell-level context: `iskcon east of kailash`,
`sector 62 noida`). Score = 2·coverage + name-starts-with-query 0.6 +
sequence 0.3 + 0.5·name precision + 0.3·prefix quality + 0.45 kind boost +
0.9·prior(w,k) − 0.12·ln(1+km) (distance doubled for 1–2 typed chars).
Same-name rows within 300 m collapse.

Measured (in-process, 252k rows, shared box with other lanes running):
keystroke sweep of the plan's test queries, every prefix, 2 positions:
p50 ≈ 4–6 ms, p95 ≈ 14–23 ms, warm max ≈ 22 ms (cold first-time
context-token max ≈ 33–50 ms). Build 5.4 s (gazetteer only) / ~13 s with
GeoNames under load. Memory: see "Memory" below.

## 2. Junk purge — mechanisms, applied at load (file untouched)

Counts logged at build (`alive.ac` logger, `AC.stats`):

| mechanism | rows |
|---|---|
| (a) far-named transport hubs dropped (name names a place >50 km away — world-places.json or the gazetteer's own city/town rows — and no locality within 25 km) | 55 |
| (b) hub category/name mismatch → kind `business`, hub weight removed ('airport' rows with no airport/terminal/aerodrome/heliport/airstrip word; rail/bus rows that read as business listings) | 94 |
| (c) exact duplicates (same name+kind at the same ~11 m point) | 234 |
| (d) uncorroborated copies of a rail/air hub >5 km from the corroborated cluster (e.g. 'New Delhi Railway Station' pinned in Shahdara/Rohini) | 32 |

Examples dropped by (a): Zurich Airport , Switzerland; Heathrow
International Airport London; Shimla Airport; RGI Airport, Hyderabad;
Jaipur Airport; Raja Sansi International Airport Amritsar; a 'Jewar
Airport' copy pinned >50 km from Jewar (the copy near Jewar stays).
City evidence only applies inside the gazetteer's own coverage
(28.0–29.07N, 76.6–78.02E) and only city/town rows count (common
toponym words like mandi/khera/khurd never do), so real outskirts
stations ('Charkhi Dadri') are not mistaken for far ones. Gazetteer rows
with non-Latin-only names (843) can't be typed and are not indexed.

The same mechanisms are applied to rows other engines return in
`/v2/search` (`_junk_filter`: drop (a)/(d), relabel (b)) once the index is
warm. `Srinagar Railway Station` / `Gorkhpur Railway Station` near CP: gone
(world-places has both; test `test_far_station_near_cp_is_gone` checks
every gazetteer hub row in the index).

Data added: `server/data/world-places.json` (236 far countries/cities with
approximate centroids — only the >50 km test reads them).

## 3. `/v2/search` changes
- **Budget**: `V2_SEARCH_BUDGET_S` (default 1.5 s). The Overpass deep arm
  gets only what's left (`_overpass_arm(..., fuse_s=left-0.1)` plus an
  `asyncio.wait_for` safety net); <0.25 s left → skipped
  (`t3_status: "skipped:budget"` / `"timeout:budget"`). T2 (Amazon) waits
  are capped by the same budget. Test: a 5 s fake arm → request < 2.2 s.
- **Name-first** (`_name_first`, after `_merge`): rows whose name carries
  the query's lead word move ahead (stable); with ≥3 words, rows whose
  name STARTS with the lead lead that group; if none of the top 3 names
  the lead, the /v2/ac best rows are put in front. Skipped for kind-first
  (`atm near cp`), unit/address leads (`b-12 lajpat nagar`, `sector 62`),
  and `<locality> <kind>` asks (`shahdara bakery`) — the compound path
  owns those.
- **Junk filter** on T1/T3 rows (see §2).
- **Overpass bbox** widened from deps.NCR_BBOX (28.20–28.95N,
  76.80–77.90E — cut Sonipat, Meerut, Rohtak, Rewari, Palwal) to
  `SEARCH_BBOX` lat 27.6–29.9, lon 75.9–78.5.

## 4. Outskirts coverage
Rows within 5 km / 10 km of each town (gazetteer | corpus):

| town | gaz 5km | gaz 10km | corpus 5km | corpus 10km |
|---|---|---|---|---|
| Sonipat | 1367 | 2208 | 2423 | 3510 |
| Panipat | 0 | 0 | 0 | 0 |
| Meerut | 4676 | 6456 | 7210 | 10033 |
| Hapur | 847 | 1133 | 1313 | 1684 |
| Palwal | 782 | 1163 | 1292 | 1680 |
| Rohtak | 313 | 443 | 0 | 54 |
| Bulandshahr | 760 | 967 | 1291 | 1541 |
| Rewari | 309 | 518 | 0 | 111 |
| Gr. Noida | 3093 | 5086 | 4383 | 7248 |

Every bundled source (gazetteer, corpus, overture aux, wikidata aux) is
clipped to 28.0–29.07N / 76.6–78.02E. Added
`server/data/outskirts-geonames.json` (GeoNames IN dump, CC-BY 4.0,
1.7 MB, 19,004 rows: populated places, admin areas, stations/airports/
landmarks inside lat 27.6–29.9 / lon 75.9–78.5); the /v2/ac build adds
13,270 of them (rows the gazetteer already names within 2 km skipped).
Panipat, Rohtak, Rewari, Karnal, Muzaffarnagar now type-ahead.

Clamps outside my files (not changed — patches for owners):
- `server/v2/deps.py:21 NCR_BBOX = (76.80, 28.20, 77.90, 28.95)` — AIR
  field bbox; search no longer uses it. If any lane uses it to gate
  search/geocode, widen to `(75.9, 27.6, 78.5, 29.9)`.
- `server/main.py:248 NCR_BBOX = "76.80,28.20,77.90,28.95"` (legacy
  /search photon bbox) → `"75.9,27.6,78.5,29.9"` (lane P).
- `server/middleware.py:373 NCR_BBOX` and `server/tiles.py:60 _BOUNDS`
  (lane M) — air-field/tile bounds, not search; leave unless the map
  must show outskirts air.

## Memory
tracemalloc around the build (252,106 indexed rows incl. 13,270
GeoNames): **112 MB retained** Python heap after build, **227 MB peak**
during the JSON parse (freed). Prod task memory is 2–3 GB
(scripts/deploy.sh). Untraced build 5.4 s (gazetteer only) – 8.8 s (with
GeoNames) on this shared box, in a daemon thread started at import
(`ALIVE_AC_WARM=0` disables; pytest processes never auto-warm).

## Verification
- `pytest server/tests/test_ac_oct11.py -q` → all pass (contract, warming,
  prefix narrowing, keystroke prefix, new-delhi-rail first, kind words,
  context words, aliases, 6 landmarks × 2 positions, purge counts,
  far-named hubs never surface, airport rows are airports, outskirts,
  geo ids resolve, latency budget, /v2/search budget/junk/name-first).
- `pytest server/tests -k search -q`: baseline (before my search.py
  edits) 3 failed / 132 passed / 1 xfailed; after: 3 failed / 134 passed /
  2 xfailed — the same 3 pre-existing failures
  (`test_contract_sync[V2SearchResponse]`,
  `test_search_latency_compound_path`,
  `test_search_merge_preserves_engine_landmark_order` — 'aiims' platform
  first, single-token query, untouched by my changes). The xfails are
  test_search_quality's per-query top-3 visibility marks ('petrol pump
  near karol bagh', 'bus stop near iit delhi'): both kind-first queries
  (name-first skips them) and their answers were identical with my
  changes off (6 s budget, no AC) vs on — they move with the public
  Overpass mirrors' state (erroring today), not this lane.
- Airport category after load: 250 rows → 34 dropped, 87 relabelled
  business, 129 real airports. 'Srinagar Railway Station', 'Gorkhpur
  Railway Station', 'Heathrow International Airport London', 'Zurich
  Airport , Switzerland': raw 1 each → 0 in the index.

## Open issues / honest gaps
- Non-hub junk (e.g. 'Boston Marriott Burlington Hotel' filed as a Delhi
  hotel) is untouched — by design (city-named businesses are real in
  Delhi); a far-chain-hotel mechanism would be next.
- Many same-name rows (e.g. 'Jama Masjid', 'Hanuman Mandir') are honest
  but undifferentiated; the subtitle locality helps, the gazetteer often
  lacks the exact one asked for ('jama masjid shahdara').
- /v2/search T1 (alive_core) index still contains the junk rows; they are
  filtered after the engine, so a T1 page can come back a row short.
- `/v2/ac` is index-only: house-level addresses / DIGIPIN come from the
  provider tier (lane P/S).
- The deep pass now gives up at 1.5 s: on prod's erroring mirrors that
  means fewer street-level T3 rows, by request.
