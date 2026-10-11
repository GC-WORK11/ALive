# gazupdate — gazetteer-refresh lane report

NEEDS_DEPLOY

## Scope executed

Rebuilt the corpus + served gazetteer from the LATEST extracts, then hunted
the deep names (owner's 3 acceptance queries + acct2 sweep classes) and
closed the data-side gaps with general mechanisms.

## Freshness

| source | what shipped | freshness |
|---|---|---|
| Geofabrik northern-zone | `dl/northern-zone-latest.osm.pbf` (224 MB) | Oct-9-2026 snapshot |
| Geofabrik central-zone | `dl/central-zone-latest.osm.pbf` (352 MB) | Oct-9-2026 snapshot |
| Overture places | `aux/overture-places.jsonl.gz` | release `2026-09-23.1` — **already latest**: fresh pull (244,425 rows) is byte-identical to committed aux, 0 diffs |
| GeoNames IN | `IN.txt` slice | 6,245 in box |
| Wikidata | `aux/wikidata.jsonl` | 7,565 rows |

Previous committed build was `remerge-aux` (OSM pass skipped). This build
ran the real pyosmium pass over both fresh PBFs.

## Corpus delta

- entries: **344,923 → 345,001** (+78)
- OSM 90,729 → 90,801 (+72 real re-parse), overture 244,762→244,766 (+4),
  wikidata 7,262→7,254 (−8), synthetic 1,064→1,058 raw /
  `synthetic:*` category 738→748 (+10 new sub-designator canonicals)
- acceptance score: **87/88** (same as committed; `chandi chowk` remains
  the standing miss — DL-2 typo beyond the index bound, not a regression)
- served gazetteer `server/data/delhi-gazetteer.json`: regenerated to the
  210k emit; all **27/27 indexfix `fx:dem` flags carried forward** by
  normalized-name + 75 m cell (0 dropped, 0 appended)

## Deep-name hunt — prod vs refreshed index

Prod = cloudfront `/v2/search` today. Refreshed = `core_engine.search`
over new corpus + new served gazetteer on this box.

| query | prod now | refreshed index | verdict |
|---|---|---|---|
| `sitaram diwan chand paharganj` | WRONG: Diwan Shree Apartments (token spam) | **Sita Ram Dewan Chand @28.6422,77.2103 + Sita Ram Diwan Chand top-2** | FIXED — fused-name alias gap |
| `sita ram dewan chand` | EXACT | EXACT | unchanged |
| `a2 block rohini sector 15` | MISS (empty) | **A2 Block, Rohini Sector 17 synthetic @28.7388,77.1173** — resolves in raw index; engine top shows `15 Block H-5` (verbatim-digit filter drops the Sector-17 row when user says '15') | data FIXED; rank caveat below |
| `iskcon delhi east of kailash` | OYO Rooms EoK ISKCON + ISKCON East Delhi | same | already resolved |
| `pawan bakery c block hanuman mandir ashok nagar shahdara` | graceful: Amar Bakery, Pandit Bakery (real Shahdara bakeries) | Royal Bakery @28.6211,77.2839 + New Ashok Nagar Block C | graceful — **Pawan Bakery unmappable**: 0 rows in OSM-latest, Overture-latest, GeoNames, Wikidata, Nominatim, Photon |
| `neelanchal dham sant nagar` / `nilanchal dham sant nagar` / `bace sant nagar` | MISS (empty) | MISS → dham/sant-nagar rows reachable via components; `sant nagar burari` now tops **Sant Nagar @28.6545,77.1885** | **Neelanchal Dham unmappable**: 0 features within the Burari bbox in Oct-9 OSM (scanned PBF for `dham|neelanchal|nilanchal|bace` → 0 hits) and 0 in every aux source |
| `sikanderpur metro` | (indexfix) real station rows | Sikanderpur Metro Station rows lead; spam sink absent | holds |
| `srinagar railway station delhi` | planted sink suppressed | suppressed (dem-flag carried) | holds |

Regression: connaught place, sarita vihar, kashmere gate, lajpat nagar 4,
hauz khas, karol bagh, noida sec 18, saket pvr, rohini sector 7,
dlf cyber hub, india gate, aiims metro — all still resolve.

## Data-side fixes (general mechanisms)

1. **`server/data/aliases.json` — +7 transliteration/fused entries**
   (same convention as karolbagh→karol bagh, waali→wali):
   - `sitaram` → `sita ram` — fused deity-name (fixes the WRONG class)
   - `dewan` → `diwan`, `diwan` → `diwan, dewan` — i↔e pair
   - `pawan` → `pawan, pavan`, `pavan` → `pawan` — vowel-length pair
   - `neelanchal` → `neelanchal, nilanchal`, `nilanchal` → `neelanchal` —
     insurance for when the dham is eventually mapped under either spelling
2. **`scripts/build_corpus.py` — sector sub-designator canonicals.**
   `_SECT_PREFIX` ate the trailing designator (`Rohini Sector 17 A-2` →
   only `Rohini Sector 17`). New `_SECT_SUB` regex runs first and emits
   `A2 Block, Rohini Sector 17` canonicals; `_fused()` adds fused-form
   aliases (`a2 block rohini sector 17`, `a2 rohini sector 17`) so
   letter+digit-fused query tokens (`a2`) post the row. Block branch
   gains the same fused aliases. +24 new attested canonicals this build
   (1,025 → 1,049 attested).

## Remaining honest gaps (not data-fixable)

- `a2 block rohini sector 15`: row exists + raw-index resolves it
  (score 1.57, cov 0.8) but `core_engine.search`'s verbatim-digit rule
  requires '15' in display tokens; attested name is 'Sector 17'.
  Rank-side decision for indexfix/poolgap (e.g. count digits against
  display+alias tokens, or relax when the digit belongs to the parent
  designator).
- `neelanchal`/`pawan bakery`: absent from every upstream source —
  can't be fabricated. Owner's queries degrade to real nearby anchors
  (Sant Nagar locality, Shahdara bakeries) once deployed.
- `chandi chowk`: pre-existing DL-2 typo miss, index-bound.

## Files

- `server/data/corpus/delhi-corpus.jsonl.gz`, `delhi-corpus-sample.jsonl`,
  `STATS.md`, `docs/plan/corpus-report.md` — fresh build artifacts
- `server/data/delhi-gazetteer.json` — 210k regen + fx:dem carry-forward
- `server/data/aliases.json` — +7 entries
- `scripts/build_corpus.py` — `_SECT_SUB` + `_fused` mechanisms
- `docs/lanes/gazupdate-report.md` — this file

Verification: `core_engine.search` over the refreshed universe
(348,915 merged entries) for every query in the hunt table above;
raw-index + served-path agreement checked on the two fixes.
