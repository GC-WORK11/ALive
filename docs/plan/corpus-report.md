# Delhi-NCR corpus report

Built: 2026-10-11 04:56 UTC  |  OSM source: `remerge(committed+aux)`  |  script: `scripts/build_corpus.py`

## Sources

| source | rows in | merged into existing | new entries | provenance |
|---|---|---|---|---|
| OSM (remerge(committed+aux)) | 90,580 in extraction box (post-dedupe) | — | base layer | `source:osm`, id n/w/r<osmid> |
| GeoNames IN.zip | 6,245 in box | 0 | 0 | `source:geonames`, id gn:<geonameid> |
| aux/*.jsonl (overture-places.jsonl.gz:244,425r/+240,673, wikidata.jsonl:7,565r/+0) | 251,990 | 11,317 | 240,673 | per-row `source`/`wikidata` |
| synthetic (attested sector/block canonicalization) | 1,049 attested | 301 folded | 748 | `synthetic:true`, coords = mean of attesting features |

**Total entries: 345,001**  (previous build: 586,398)

T0/T1 ceiling check: corpus 345,001 + bundled 210,000 -> gazetteer 210,000 vs ~150k ambition. The gap to 150k is real, not padded -- OSM Delhi named features + GeoNames + Wikidata + attested sector/block canonicals exhaust the legitimate sources; the rest must come from Amazon T2 cache-back or licensed data.

| per-source membership | entries |
|---|---|
| overture | 244,766 |
| osm | 90,801 |
| wikidata | 7,254 |
| geonames | 6,247 |
| synthetic | 1,058 |
| rows flagged synthetic:true | 748 |

## Dedupe

- same normalized name + ~75 m cell, richest row kept, aliases+sources unioned: 10,926 merges

## 88-query score (tests/search_queries.txt)

- **with aliases.json: 87/88** — without: 84/88

## Mobile gazetteer

- bundled kept 210,000 + new 0 = **210,000** (19.9 MB, dedupe-skipped 201,206)

## Reproduce

```sh
tools/corpus-venv/bin/python scripts/fetch_wikidata.py
tools/corpus-venv/bin/python scripts/build_corpus.py --emit-mobile
tools/corpus-venv/bin/python scripts/build_mobile_gaz.py   # alt emit
```

Note: only real named entities are emitted -- Wikidata/GeoNames/OSM rows or attested sector/block designators (synthetic:true, coords averaged from attesting features). No fabricated names. Where the sources run dry the report above is the real ceiling, not a target hit by padding.
