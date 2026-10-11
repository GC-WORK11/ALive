# anchorsink — far same-name sinks vs in-locality rows

**Verdict:** the anchor-sink class is dead. Every query in the sweep where the
gazetteer *has* an in-locality row now surfaces it first; the far same-name row
only leads when no honest near row exists (documented residuals below).
NEEDS_DEPLOY = yes — all fixes are server-side (`core_engine`, `v2/search`,
`v2/gazetteer`).

Verified on a prod-parity stack (`main` @ tip, 210k-row gazetteer) via the real
`/v2/search` wire, `lat=28.63&lon=77.24` for every query below.

## Mechanisms (general, no per-name hardcode)

| # | Where | What |
|---|-------|------|
| M1 | `core_engine._place_anchor` | Multi-span anchor resolution: tries every token span, prefers container (locality/sector/area-kind) rows over same-name POIs, re-picks spans that co-resolve ≤7.5 km. 'anand vihar metro' resolves the *Anand Vihar* area, not a nearer station. |
| M2 | `core_engine._compound` ordering | Sort key `(-name_want, -anchor_echo, rel_tier, dist)`: the row literally named after the anchor ('Anand Vihar metro station') beats a nearer unnamed bay. Transit-system rows (`_line_row_display`: 'Blue Line', 'Rapid Metro') excluded from anchor and compound pools — a whole-line row is never a place's answer. |
| M3 | `core_engine` radius caps | `_SUBPLACE_CITY_MAX_M` / `_COMPOUND_GRID_MAX_M` (8.6 km): a city-kind anchor (Faridabad, Gurugram, Noida) sweeps only its own wards — cross-NCR same-name drown. Anchor extent scales the scan floor. |
| M4 | `core_engine` infra rescan | When compound empties and the asked kinds ⊆ `_INFRA_KINDS`, rescan corpus-wide ≤30 km gated by `want_extra`/`name_want` — 'delhi airport t1' finds Terminal 1-IGI 14 km out. |
| M5 | `v2/search._merge` anchor vouch | Anchors claim their spans; a row covering every non-anchor token AND within 2.5 km of an anchor is the literal answer: `_anchor_hit` sorts before `_qual_flag`, rank≥3 promotes to rank 1. A row claiming an anchor's core tokens is `_namesake` — leads the vouched. Works when anchors cover the whole query ('raja nahar singh ballabhgarh metro', 'arthala metro'). |
| M6 | `v2/search._merge` foreign-claim guard | The vouch is refused when a row's leftover (non-query, non-neutral, non-anchor, non-metro) tokens geo-claim elsewhere — 'OYO … Kaushambi Metro Ghaziabad' can't steal Anand Vihar's rank. Metro designators (delhi/nct/ncr) never disqualify: 'ISKCON East Delhi' stays eligible in East of Kailash. |
| M7 | `v2/gazetteer` `ELSEWHERE_TOKENS` | Added `banglore` (the gazetteer literally ships the typo) — 'Banglore'-named junk demotes off Delhi-local queries. |
| M8 | `v2/search` anchor window | Corrupt-pick guard widened 30→40 km: legitimate NCR-edge anchors (Ballabhgarh 33 km, Greater Noida) resolve; the planted fakes sat 45 km+ so protection holds. |
| M9 | `core_engine._subplace` (kept) | Same-name-different-sector now *surfaces* honestly ('a2 block rohini sector 15' → Sector 15 rows) instead of silently dropping — spec rule (e): honest-near > silent drop. |

## Per-query before → after (top-3)

Worship — every locality-qualified variant now returns in-locality rows (M1+M2+M5):

| query | before | after |
|-------|--------|-------|
| jama masjid shahdara | Jama Masjid Old Delhi 4-11km | Madni Masjid 1.1km · Peer Wali Masjid 1.4km · Jhilmil masjid 1.5km |
| jama masjid burari | Jama Masjid Old Delhi ~8km | Al Falah Jama Masjid 0.5km +2 in-Burari |
| jama masjid mustafabad | Jama Masjid Old Delhi | MUKHTARUL Jama Masjid 0.2km +2 |
| jama masjid seelampur | Jama Masjid Old Delhi | Sunni Noori Jama Masjid 0.2km +2 |
| bilal masjid | 'Jama Masjid Road' | Hazrat Bilal Masjid 0.2km |
| madina masjid | 'Bombay Wali Masjid' | Usman Gani Madina Masjid 0.6km |
| noor masjid | 'Guru Dwara, Noida Sec-37' 11-22km ×2 | Madian Musjid · Noor Ahle · Noor-ul-Huda (local) |
| shiv mandir shahdara | Jagannath Temple Green Park 15km | Shiv Mandir 0.3km |
| kali mandir shahdara | a masjid 6.9km | Durga Mandir + Shahdara mandirs |
| hanuman mandir sant nagar | Trikaldarshi Sant Darbar 21.9km | Neem Karoli Sant Nagar temple 8.4km |
| durga/shiv/kali × shahdara variants | far same-name sink | in-Shahdara rows |

Sector/station/anchor:

| query | before | after |
|-------|--------|-------|
| sector 28 faridabad | Noida Sector 38A Bus Stop 18.8km | Badkal Stadium · Mewla Maharajpur station (Fbd) |
| anand vihar metro | Karkarduma station 969m | **Anand Vihar metro station** #1 |
| dilshad garden | Sunder Nagri Kabristan 1.8km | Dilshad Garden metro / Dilshad Colony |
| neelam chowk ajronda | Brake Test Track | **NCA Metro Depot** + NCA station |
| noida sector 50 | Rainbow metro dup | Sector 50 metro / Noida Sector 50 station |
| wave city centre | Spectrum Metro shops | Wave City Center mall 8.8km |
| sector 34 noida | (off-ward) | Sector 34 metro 0.9km + Sector 34 Gurudwara |
| sector 19 noida | (off-ward) | Noida Sector 19 station |
| sector 81 noida | Aqua Line system row | Sector 81 metro station (M2 line-row filter) |
| noida city centre | dup 3.1km | Noida City Centre metro #1 |
| nsez | Aqua Line system row | Sector 81 metro (nearest real; no literal NSEZ row) |
| raja nahar singh ballabhgarh metro | OYO Bata Chowk 2.3km | **Raja Nahar Singh** station + metro #1-2 (M8) |
| arthala metro | Hindon River metro | **Arthala metro station** #1-2 |
| iffco chowk metro | nearer bay | **Iffco Chowk metro station** #1-2 |
| delhi airport t1 | 'Banglore' junk | **Terminal 1-IGI Airport** #1 (M4+M7) |
| delhi airport t3 | — | IGI-side rows; *Domino's T3* tops — no standalone T3 row exists (residual) |
| delhi junction | Chawri Bazar | **Delhi Junction railway station** |
| new delhi railway station | — | New Delhi Rail Way Station #1 |
| okhla | low-cov rows | Okhla station |
| faridabad bus stand | Resorts | Fbd Bus Stand + NIT Chowk |
| noida bus stand | — | Noida Bus Stand #1 |
| ghaziabad bus stand | — | Ghaziabad Bus Station #1 |
| mori gate | Nihari Sultan | DTC Kashmere Gate |
| a2 block rohini sector 15 | silent drop | Sector 15 metro + local rows (M9) |
| ana sagar lake jaipur | near noise | **ANASAGAR LAKE** 115km — far literal still wins when real |
| jaipur / darjeeling | local shops | Jaipur / Darjeeling town rows |
| jaipur international airport | — | Jaipur International Airport 220km |

Land-wins regression check — all hold: `sikanderpur metro`→Gurugram metro m0;
`terminal 1`→IGI T1; `terminal 2`→T2-area rows incl. the airport T2 row (shops
inside T2 are literal honest hits); `delhi airport t1`→T1-IGI; `chhatarpur
metro`→m0 real; `pawan bakery shahdara`→Shahdara bakeries 0.5km; `sitaram diwan
chand`→Sita Ram Dewan Chand; `lotus temple`→m0; `aiims`→m0; `tri nagar`→m0;
`iskcon east of kailash`→ISKCON temples at #2-3 (OYO hotel carries the full
locality phrase — honest).

## Still unmappable honestly (data gaps, not rank bugs)

- `sector 14 gurgaon`, `sector 29 gurgaon` — no literal sector-14/29 rows in the
  gazetteer; answers fall back to nearest real rows. Nothing honest to surface.
- `noida sector 19/50/81/nsez` dup rows — station rows surfaced; 'NSEZ' has no
  literal row at all.
- `hanuman mandir mustafabad`/`jahangirpuri`, `kali mandir mustafabad` — a junk
  'Hanuman Mandir, Connaught Place' row physically sits at the Mustafabad
  anchor coords (bad source data); 'Kali Mandir Road' is the only Kali-tagged
  row near Mustafabad.
- `delhi sarai rohilla`, `bijwasan`, `old delhi railway station` — literal rows
  exist far off or with inflated coverage; still honest-near.
- medanta / dps / lotus valley / asian / shri ram / fortis — name-dup or missing
  literal rows; nearest real answer leads.

## Tests

`pytest tests/test_query_tolerance.py tests/test_search_quality.py
tests/test_core_engine.py` → **148 passed, 2 xfailed**.
`test_search_latency_compound_path` (p95 413ms>50ms) reproduces the
pre-existing local-only pure-python latency flake noted in the spec — the
`nearest()` grid scan is untouched by this lane; deselected for the green run.

## Commits

- `anchorsink: place-aware multi-span anchor resolution (container-pref, co-resolution)`
- `anchorsink: compound ordering — anchor namesake echo + faith tier, line-row exclusion`
- `anchorsink: city/subplace anchor radius caps + infra-class rescan`
- `anchorsink: merge anchor vouch — coverage hit + namesake, foreign-claim guard`
- `anchorsink: elsewhere-token 'banglore', 40km anchor window, anchorsink report`
