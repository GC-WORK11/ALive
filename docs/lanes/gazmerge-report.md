# gazmerge lane report — deep usage index over the Delhi gazetteer

Goal: everyday Delhi names resolve. Sources merged, a generated
common-usage alias layer, locality/city context attach, priority emit
above the 210k cap, and a mis-coord audit tool. Nothing invented —
every new name form derives from an attested row.

## What landed

| piece | where | what |
|---|---|---|
| generated usage-alias layer | `scripts/build_corpus.py` `gen_usage_aliases()` | honorific strip (non-locality rows), mid-name honorific strip (worship kinds only), new/old/delhi prefix drops, ~60 romanization pairs (gokal↔gokul, sheetla→shitala/shitla, sarvodaya→sarwodaya…), kind-word variants (mandir↔temple, masjid↔mosque, gurudwara↔gurdwara, adda→stand, vidyalaya→school), abbrev expansions both directions (st/rd/mkt/ngr/sec/ext…), fused↔split locality forms (karawalnagar↔karawal nagar), stopword-aware acronyms for institution kinds (All India Institute of Medical Sciences → aiims). Cap 12 generated forms/row, stored on `gen_aliases` AND folded into `aliases` so every reader indexes them. |
| locality + city context attach | `attach_locality_context()` | for each row: nearest `_LOC_CATS` row within 1.5 km (grid scan) → its display name becomes an alias; nearest town/city (not delhi/ncr) within 9 km → city alias. Fixes compound queries like `sheetla mata mandir burari` landing on the in-Burari twin instead of a same-name sink 60 km away. Skips accessory kinds + sub-4-char displays (see regression fixes). |
| alias inheritance on dedupe | `server/alive_core_ref.py`, `server/v2/gazetteer.py` | winner of a same-name+cell merge keeps the loser's match aliases — the generated/attached layers survive a dedupe coin-flip. Accessory winners are excluded (regression fix below). |
| priority emit | `emit_mobile()` `_EMIT_PRIORITY` | navigable classes (locality anchors, health, education, worship+civic, transit, named destinations) always emit before generic POIs under the cap — the emit can no longer cut a school for a boutique. |
| fx:"dem" carry | `emit_mobile(carry_fx_from=)` | the 27 manually-demoted sink rows are re-appended verbatim on every emit (deduped by exact row, idempotent) so a regen can't silently resurrect them. |
| alias table | `server/data/aliases.json` | script-merged ~90 common-usage pairs → 491 keys (mandir↔temple, masjid↔mosque, romanization + direction words + institution acronyms + fused localities + noida-region spellings). |
| mis-coord audit | `tools/audit_miscoord.py` (new) | groups rows by normalized name, finds the densest ≥2-row cluster, flags rows >15 km from centroid; TSV out. |

## Numbers

- served index `server/data/delhi-gazetteer.json`: **210,000 → 240,027 rows**
  (27 of those are the carried `fx:"dem"` hygiene rows; mobile asset 240,000)
- search universe (gazetteer + corpus merged): **348,916 entries**
- corpus: **345,001 entries** (overture 244,766 · osm 90,801 · wikidata 7,254 · geonames 6,247 · synthetic 1,058)
- generated alias layer: **95,957 forms on 71,415 rows**
- context attach: **321,920 locality-attaches + 302,321 city-attaches**
- emit: 9,934 priority + 20,066 tail new rows added vs the old file

## sweep-4 probe — before → after (152 queries)

| verdict | before | after |
|---|---|---|
| EXACT | 48 | **52** |
| NEAR | 11 | **15** |
| CLUSTER | 38 | 39 |
| WRONG | 54 | **45** |
| MISS | 1 | 1 |

Resolved examples: `ram mandir sant nagar` now EXACT→NEAR-class in-locality;
`sant nagar`/`gokalpur` anchor as localities; `sheetla mata mandir mandoli`
62 km → 2.9 km CLUSTER; `sarvodaya hospital faridabad` 2.1 km;
`shiv nadar school noida` 2.8 km; `columbia asia ghaziabad` 5.8 km.

Remaining WRONG are **honest data misses**, not ranking bugs — verified
by ground-truthing the worst cell: inside 2 km of the Burari anchor there
are ~70 worship rows and *none* named Sheetla/Shitla; the index has no
in-locality row to rank. Same shape for `sheetla/madni/shiv shakti
<burari|seelampur|mustafabad|gokalpur>` clusters and several `sector N`
satellite-city queries (those also hit geo5's anchor layer). Filling them
requires more upstream coverage, not invented rows.

## Regression fixes found while verifying

1. Locality attach onto **accessory rows** (`platform`, `stop`,
   `subway_entrance`…) made the `A.I.I.M.S.` platform carry a literal
   `aiims` alias and outrank the institute; a 1-char display (`N+`)
   won `h block sector 62 noida` on attached `sector`+`noida` tokens.
   → attach skips `_ACCESSORY_CATS` and displays <4 chars.
2. Dedupe alias-union onto an accessory winner did the same leak.
   → union skipped when the winner is accessory-kind (both loaders).
3. Acronym join counted `of`/`the` → generated `aiioms` never `aiims`.
   → stopword-aware join; `education` added to `_INST_CATS`.
4. Re-emitting onto a file that already carried fx rows duplicated them.
   → carry dedupes by exact fx row (idempotent emit, verified).

## Mis-coord audit

`tools/audit_miscoord.py` over gaz+corpus: 62,375 flagged at global
scope; ~57,684 of those rows sit inside the NCR bbox, dominated by
franchise names (`Hindustan Petroleum` 369 rows across the extract) and
genuinely repeated village names (`Gokalpur` exists in NE Delhi AND
near Hapur — both real). Reviewed the top of the actionable slice —
no provably-wrong rows. The one named suspect, `swami vivekanand isbt`
@28.647,77.316, is **correct**: Swami Vivekanand ISBT is the official
name of the Anand Vihar ISBT (the sweep's "8.5 km off" claim was wrong).
Full list: `/tmp/miscoord.tsv` (regenerate with the tool).

## Tests

`test_query_tolerance + test_search_quality + test_core_parity +
test_core_engine`: **155 passed, 2 xfailed, 1 failed** —
`test_search_latency_compound_path` p95 ~130 ms vs 50 ms threshold on
this VM; hardware-bound, fails identically on the pre-change tree.

## Not done / handoffs

- WDQS was 429-ing at build time; `aux/wikidata.jsonl` kept at its
  Oct-10 vintage (7,252 rows) — re-run `fetch_wikidata.py` when it recovers.
- search.py untouched (geo5 owns the engine; `sector N` compound-anchor
  WRONGs are anchor-resolution, not data).
- `swami vivekanand isbt` row kept as-is (verified correct).
