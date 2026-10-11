# geo5 — sweep-4 residual classes

Lane: kill the measured geocode residuals from `acct2-geo4.md` (WRONG 28%).
All mechanisms are general — zero per-name hardcode. All changes are inside
`server/v2/search.py`; the probe harness is the local `/v2/search` endpoint
(`V2_OVERPASS=off`, `ALIVE_LOCATION_KEY` unset, bias 28.63,77.24).

## What was actually wrong (mechanism-level)

1. **Entity-name outranks ward kind-fill** (`sheetla mata mandir <ward>` →
   Mata Sundari 7–14km). Non-near rows were never gated: a covering namesake
   at 26km stayed `match_rank=0` while the ward's own mandirs sat near a
   w=2 locality anchor.
   → `_far_literal` gate: non-near literal hits get flagged + r0 floors to
   r1 under a w=2 anchor; sort puts them above generics but below vouched
   coverage/kind rows.

2. **Ward echo outranked the actual ask** (`madni masjid sant nagar` →
   'Oppo Sant Nagar' shops; `ecotech 2 greater noida` → 'Greater Noida'
   echo). Three stacked causes:
   - `_anchor_corrupt` dropped real ward/city anchors: a single convicted
     namesake within 4km, or no namesake inside a fixed 4km, damned the pick.
     Fixed: branch-1 now requires the convicted row to BE the anchor's own
     name (`_phrase_eq(rt, acore)`), branch-2 scales by `_vouch_radius(a)`
     (a city's namesakes legitimately span its grid).
   - the sort's `-min(_core_cov,3)` scored anchor tokens for free — a ward
     echo covering 'sant nagar' beat the row covering 'madni'. New
     `_need_cov` counts only unanchored content tokens and sorts first.
   - a namesake of a ward anchor deferred when it can't cover the ask OR
     when the query also named a *content* entity (masjid/mandir/hospital
     anchor) — `_ns_defer`, applied at namesake and w2-anchor sort slots.

3. **`madni masjid`/`ram mandir` never anchored**: the prefix-of-content
   skip in `_locality_anchors` killed multi-token spans too ('madni masjid'
   before 'sant nagar'). Restricted to 1-token spans ('swami', 'shiv'
   fragments).

4. **Anchor-covered intent words lost their kind ask** (`madni masjid
   gokalpur` → 'Madni Clinic' #1): `allowed` was built only from uncovered
   tokens, so a 'masjid' the Masjid anchor consumed couldn't kind-gate rows.
   `intent_toks` now adds type tokens from non-locality anchors' names;
   `qrel` uses the same set.

5. **kind-inconsistent echo admitted**: `if allowed and ktier < 0: continue`
   — a 'Gokalpur (locality)' row can't fill a masjid ask; a detailing shop
   named 'Infront Of Yatharth' isn't a hospital. Applied after the
   foreign-geo check so honest foreign rows ('Sheetla Mata Mandir,
   Gurgaon') still read as literal.

6. **self-claim conviction**: `_coord_consistency` convicted a row for a
   claim the query itself made ('Yatharth Hospital, Gautam Buddha Nagar'
   vs claim 'nagar'). Exempt: `all(t in qtoks for t in claim)` — multi-site
   brand scatter isn't a bad-pin signal.

7. **second-anchor gate too tight for wards**: loc-kind anchors get a
   40km co-anchor distance gate (was 7.5km for all kinds) — 'Gokalpur'
   joins the 'Sheetla Mata Mandir' anchor 9.4km away.

8. **`_anchor_gap` never fired**: a namesake echo satisfied the anchor even
   when content tokens stayed uncovered. The echo branch now runs only when
   `need` is empty — yatharth/felix/madni/ecotech requeries fire.

9. **overpass arm latency regression**: `_anchor_requeries` inside the arm
   ate ~14s on a fat-postings query (`_t1` on 'pawan bakery c block
   hanuman mandir ashok nagar shahdara' = 12.9s). Requeries now run
   concurrently with the mirror races under a 450ms deadline slice;
   `wait_for` drops slow ones (thread finishes unattended). Off-path
   (overpass off) keeps unbounded requeries.

## Verified (endpoint, this VM)

| query | top-1 before → now |
|---|---|
| madni masjid sant nagar | Oppo Sant Nagar shops → **Madni Masjid** 6.1km |
| madni masjid gokalpur | Oppo/Karawal rows → **Madni Masjid** 6.1km |
| ram mandir gokalpur | ward echo → **Shri Ram Mandir** 1.5km |
| madni masjid burari | — → Masjid Aqsa + Madina/Masjid sharief (local) |
| gurudwara sant nagar | Karol Bagh 'sant' → **Gurudwara Sant Nagar EOK** 8.4km |
| sheetla mata mandir burari | Mata Sundari 26km → local mandir + SHEETLA 7.8km |
| sheetla mata mandir gokalpur | Mata Sundari 26km → SHEETLA MATA MANDIR 7.8km |
| sheetla mata mandir karawal nagar | → SHEETLA MATA MANDIR 7.8km |
| sheetla mata mandir ashok nagar | → Sheetla Mata Mandir 3.7km |
| hanuman mandir ashok nagar | → hanuman mandir + Sankatmochan 10km |
| yatharth hospital noida | Detailing Bot → **Yatharth Super Specialty** r1 |
| felix hospital noida | Felix Benelli → **Felix Hospital** r1 |
| ecotech 2 greater noida | GN echo → **Ecotech 2** |
| qrg hospital faridabad | — → **Qrg Hospital** 3.9km |
| sarvodaya hospital faridabad | — → **Sarvodaya Hospital** 24km |
| amrita hospital faridabad | Amrita r0 (held) |
| shiv nadar school noida | 22km miss → **Shiv Nadar School, NOIDA** r0 |
| swami vivekanand isbt | 8.5km wrong-coord → **ISBT station** 7.7km r1 |
| delhi sarai rohilla station | filling station 36km → **Sarai Rohilla Railway Station** 6.3km |
| patel nagar station delhi | Kamla Nagar rows → **Patel Nagar Metro Station** 7.2km |
| sector 150 noida | '150 Shanti Lane' 24km → **ACE Golfshire Sector 150** + sector rows |
| noida sector 119/122 | ~12km off → real sector rows r0/r1 |
| hilton gurgaon sector 50 | 32.7km off → Hilton row r3 #1 |
| knowledge park 5 | '5'-digit rows → **DPS Knowledge Park-V** |
| chi 3 greater noida | '3 Idiots' 30km → **Sector-Chi 3-Main Gate** |

## Tests

`pytest tests/test_query_tolerance.py tests/test_search_quality.py
tests/test_core_engine.py tests/test_v2_hardening.py
tests/test_v2_overpass_race.py` → **212 passed, 2 xfailed**.

One deselect: `test_search_latency_compound_path` — p95 347ms vs 50ms on
this VM. Fails IDENTICALLY on unmodified `main` (347ms stashed vs 348ms
with the diff) — the box is ~7× slower than the 50ms budget; an
environment property, not this diff. The
`test_arm_merges_across_queries_with_fast_mirror` regression my changes
DID cause (14s requeries inside the arm) is fixed via the deadline slice
above; the test passes again.

## Mechanisms added/changed

- `_locality_anchors`: digit-span skip; 1-token prefix-of-content skip;
  loc-kind second-anchor gate widened to 40km.
- `_merge` vouch block: `_far_literal`/`_far_lit_w` for non-near covering
  rows; `_ns_defer` for ward echoes that can't answer; kind-miss
  suppression `allowed and ktier<0`; `intent_toks`/`qrel` include
  non-locality anchor name tokens; sort gains `_need_cov` and
  `_ns_defer`-aware w2 gate; `_anchor_corrupt` tightened (own-name +
  `_vouch_radius` scaling).
- `_anchor_gap`: namesake-echo branch gated on `not need`.
- `_coord_consistency`: query's own claim can't convict.
- `_anchor_namesakes`/`_anchor_requeries`: async; requeries take an
  optional deadline (450ms slice inside the overpass arm).
- Constants: `_VOUCH_LOCAL_M` 4500, `_VOUCH_DIST_M` 10000,
  `_VOUCH_CITY_M` 18000, `_SECTOR_WARD_MAX_M` 24000.
