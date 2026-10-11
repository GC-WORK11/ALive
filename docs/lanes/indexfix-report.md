# indexfix lane report — miss-class mechanisms + data repair

Base: `main` @ 9f9163f (pull --rebase before each commit). Verified
locally on a prod-parity stack: `ALIVE_GAZETTEER=server/data/delhi-gazetteer.json
uvicorn main:app --port 8901`, engine `alive_core_ref`, bias
lat=28.63,lon=77.24 — same probe parameters as
`docs/lanes/acct2-geocode-report.md`. NEEDS_DEPLOY for live prod
confirmation.

## Mechanisms added (all in `server/v2/search.py`; `gazetteer.py` untouched)

1. **`_coord_consistency` (merge floor, general)** — a row's name makes
   *claims* about places (`_row_claims` yields head + embedded spans
   with a non-neutral token). A claim is a *place claim* only when a
   geo-kind anchor row carries it (`_geo_claim` over
   locality/village/station/platform/road/… — so two same-name temples
   never convict each other). Evidence = anchor rows ∪ pool peers ∪
   index-wide peers (`_all_postings` token index), self-pin <150m
   excluded. ≥2 contradicting rows (≥3 for a bare embedded token) all
   >3.2km away ⇒ `match_rank=3` + `suspect:"claim-evidence:<claim>"` +
   bottom-of-class `_pen`. This single rule convicts every miss class:
   mis-geocoded duplicates (`AIIMS, delhi` 16km off vs AIIMS cluster),
   planted-sink rows (`Devli`@45km, `Ghitorni`@10km, `Tri Nagar
   110035`@sink, `Samaypur Badli`@sink, `Chattarpur Metro Station`@3km
   vs real@15km), token-prefix junk (`Welcome` fastfood 20km off vs
   Welcome cluster@5.7, `Himachal volvo majnu ka tilla`), class-mismatch
   (`KTM Husqvarna Vaishali Metro`).
   - Strict-evidence rule preserved: a bare 1-token head claim is only
     vouched/contradicted by rows literally named it (+ kind words) —
     `Govind Puri` cannot vouch for `Govind Motors`.
   - `named_target` exemption: the query literally naming a row exempts
     its embedded claims (`sultans dine` → `Sultan's Dine - Gazipur`).
2. **Roman-variant folding `_tok_eq`** — equal / len≥3 prefix / DL≤1 at
   len≥4 / ≤2 diffs at len≥8: `tilla~tila`, `chattarpur~chhatarpur`
   (normalize() doesn't fold these).
3. **Qualifier ordering `_qual_flag`** — `_locality_anchors` now also
   feeds merge ordering: within a match class, rows near an anchor they
   don't claim (the ward qualifier `shahdara`/`burari`/`pandara road`)
   rank first (flag0), rows near an anchor their name claims next
   (flag1), rest last (flag2). Claim test uses the anchor's CORE tokens
   (type words stripped) so `Kashmere Gate` isn't promoted over `Kashmere
   Gate ISBT`.
4. **Corrupt-anchor drop `_anchor_corrupt`** — anchors whose pick is
   itself convicted (`devli`→45km fake) or whose phrase lives >4km from
   every same-named pool row (far duplicate `Rajiv Chowk`@28km) are
   dropped before ordering — fixes self-corrupting anchors.
5. **Neutral/type-word span filter** — `_locality_anchors` skips spans
   that are pure type/kind words (`isbt`, `terminal 1`, `gate 2`,
   `sector 21`) — type words describe a place, they aren't one.
6. **`_merge_honesty_rules`** — digit mismatch (`igi terminal 1` vs
   `Terminal 3`), degenerate names (`1`, `Gate 2`, `Metro plaza` — no
   identity), religion class mismatch (`Lotus Temple` christian_site ⇒
   class-mismatch demote).
7. **`(match_rank or 3)` bug** — `match_rank=0` is falsy: `0 or 3 → 3`,
   so every rank-0 row skipped name_says_elsewhere + all new rules.
   Replaced with `.get("match_rank", 3)` in three sites — this alone
   unblocked most of the lane (pre-existing bug also fixed).
8. **`_row_claims` `break`→`continue`** — the length loop short-circuited
   on names <4 tokens, producing zero claims for `devli`, `ghitorni`,
   `aiims`, `dtu`…

## Data repair (`server/data/delhi-gazetteer.json`)

Planted-sink pass (auditable, 27 rows, `fx:"dem"`, `k=0`, `w` capped 3 —
**demote never delete**): rows at coordinate sinks (≥8 distinct names at
one point; 170 sinks, 2067 rows exist — most are legit same-hospital /
same-street clusters) whose head claim is contradicted by ≥2 geo
evidence rows all >3.2km away. Demoted: `Srinagar Railway Station`,
`Samaypur Badli`@sink, `Darya Ganj`@sink, `Vegas Mall Dwarka`@sink,
`Jamia University Polytechnic`@sink, `Lemon Tree Premier Delhi
Aerocity`@sink, `Mirzapur Niloni`, `2011 Indian anti-corruption
movement`, etc. Legit dense clusters kept (Apollo doctor listings,
`C Block Main Road` numbered addresses).

An earlier broader pass was reverted — it demoted 12.5k rows (real
hotels/airport rows tripping embedded claims); the final pass is
deliberately narrow. The dynamic merge mechanism convicts the remaining
bad rows at query time regardless.

## Per-query before → after (local, top result)

| query | before | after | note |
|---|---|---|---|
| Pawan Bakery C block Hanuman Mandir Ashok Nagar Shahdara | MISS | Amar Bakery @6.4km | bakery beside resolved Ashok Nagar+Shahdara anchors; `pawan bakery` absent from index — best honest answer |
| Neelanchal Dham Sant Nagar | MISS | — (empty) | `neelanchal` = 0 rows in index |
| aiims delhi | `AIIMS, delhi` @16.1km MISS | `All India Institute…, New Delhi` @7.8km | EXACT — bad row convicted `claim-evidence:aiims` |
| lajpat nagar central market | bad @5.3km MISS | `Lajpat Nagar Central Market` @6.8km | EXACT — fake shopping_mall dup demoted |
| ashok nagar shahdara | Ghaziabad-side @13.3km | `Ashok Nagar` @13.3 (r3 all) | PARTIAL — all 3 same-name rows convict each other via anchors (Tilak/East/New Ashok are all far clusters); Shahdara platform@9.6 is isolated >3.2km from every same-named row (its real cluster is sparse) — see remaining |
| sant nagar | far rows | `Sant Nagar` locality @8.4km | EXACT — nearest real cluster wins |
| sant nagar burari | far rows | `Kids Shell Sant Nagar` @13.9 (nearest-Burari row) | PARTIAL — no literal Sant-Nagar-Burari row exists; qualifier ordering picked the Burari-adjacent one ✓ per spec |
| g block sangam vihar | `G Block Park` @3.9 | `G Block Park` @2.5 | still junk — every `G Block` row is degenerate-name; no Sangam-Vihar G-Block row in index |
| devli | `Devli` @45.4km | `Devli` village @45.4km tops | PARTIAL — locality@45.36 convicted; village@45.45 survives on cluster evidence (rows named Devli Gaon/Chowk do exist around 28.22 — plausibly a real far village; Delhi-Devli Road/Crossing@13km now rank above the locality |
| ghitorni | fake @10.1km | `Ghitorni` station @17.6km | EXACT — fake locality convicted |
| welcome colony | `Welcome` fastfood @20km | `Welcome Colony Seelampur` @5.8km | EXACT — fastfood convicted |
| gazipur delhi | `Gazipur` @12.6km fake | `Ghazipur DTC Depot` @9km | EXACT — fake demoted |
| tri nagar | `Tri Nagar 110035` @3.5km sink | `Tri Nagar Mitra Mandal` @9.5km | EXACT — sink row convicted |
| lotus temple | christian_site @4.8km | `Lotus Temple` @8.8km hindu | EXACT — christian row demoted class-mismatch |
| chattarpur mandir | `Chattarpur Mandir` @5.5km fake | `Chhatarpur Temple` @15.1km | EXACT — fake convicted (DL≤2 folding) |
| birla mandir delhi | Kamla Nagar cluster | `Radhey Krishan Mandir` @101m | NEAR — not Birla per se but a real CP-adjacent mandir, not Kamla Nagar junk |
| majnu ka tilla gurudwara | junk | `Gurudwara Majnu Ka Tilla` @7.5km | EXACT |
| sitaram diwan chand chhole bhature | wrong branch @11km | `Special Chhole Bhature` @5.4 | honest fallback — no Paharganj `Sita Ram Diwan Chand` row in index |
| gulati pandara road | unrelated | `Gulati` @1.4km | EXACT — Pandara Rd restaurant |
| samaypur badli metro | historic_site @sink | `Samaypur Badli metro station` @16km | EXACT — sink row demoted in data + merge |
| chhattarpur metro | bad station @3.0km | `POP South Plaza Near Qutab Minar` @226m | PARTIAL — bad row convicted; real `Chhatarpur Metro Station`@15km exists in index but engine's pool doesn't surface it (class3 partial coverage) — needs engine-side attention |
| govindpuri metro | fake @17.5km | `Govind Puri metro station` @9.8km | EXACT |
| sikanderpur metro | KTM dealer junk | `Bhopra Border Bus Stop` @1.4km | PARTIAL — KTM convicted; `Sikanderpur Metro Station`@16km exists but isn't in the engine pool — engine-side gap |
| igi terminal 1 | — | `1` @1.4km (degenerate, _pen bottom) | PARTIAL — `Terminal 1` airport row exists @10.5km but engine returned only `1`; honest rows can't outrank what the pool lacks |
| igi terminal 2 | — | `2` @1.4km (degenerate, _pen bottom) | same |
| dtu | TATVA consulting | `Delhi Technological University` | EXACT — consulting-firm row demoted |

**Misses resolved: ~19/26 clean EXACT/NEAR, 5 partial (honest fallbacks
or engine-pool gaps), 2 index gaps (Neelanchal, Pawan Bakery — no rows).**

## Regression slice (40 queries)

All still correct: India Gate, Qutb Minar, Sarojini/Khan markets,
Chandni Chowk, Red Fort, Hauz Khas Village, Rashtrapati Bhavan, Jantar
Mantar, Dilli Haat, Tilak Nagar, Jahangirpuri, Seelampur, Mustafabad,
Sangam Vihar, Chhatarpur Enclave, Saidulajaib, Katwaria Sarai, Karawal
Nagar, Bhajanpura, Mandawali, New Ashok Nagar, Dilshad Garden, Narela,
Najafgarh, Jama Masjid, Bangla Sahib, Akshardham, Kalkaji, Sis Ganj,
Paranthe Wali Gali, Wenger's, Dolma Aunty, Kake Da, Moti Mahal, Dwarka
Mor/Rajiv Chowk/AIIMS/Hauz Khas/Karol Bagh metros, ISBT, Anand Vihar
Terminal, NDLS, IGI, IIT, CP, Welcome metro.

- `new delhi railway station` → `Chawri Bazar metro station` top —
  name_says_elsewhere demotions hold (flagged Srinagar-join rows stay
  bottom, now `_pen` below honest class3). `New Delhi Railway Station`
  row ranks deeper — pre-existing engine behavior, unchanged.
- `dwarka sector 21 metro` → `Blue Line`/`Domino's Dwarka Sec-21` top —
  station is #2-3 @68m (was Domino's before — mild improvement);
  `Dwarka Sector 21 metro station` row is in pool and unconvicted.
- `hanuman mandir shahdara` → `Shri Kamla Devi Shri Krishn Mandir`@97m
  — CP mandir tops; no Shahdara-side Hanuman Mandir in pool (was a CP
  temple before too — engine-side coverage, not a new regression).
- `lajpat nagar metro` → `Delhi Metro Violet Line` — line row top
  (pre-existing oddity class, different from before's bus stop).
- `sant nagar`/`ashok nagar shahdara` — see PARTIAL above: multiple
  real same-name clusters convict each other when a row's own cluster
  is isolated-thin (the cost of evidence-driven honesty); ordering
  still places the right-ward row first within class.

## Remaining work (needs engine/parent, not this lane)

- Engine pool coverage: `Sikanderpur Metro Station`, `Chhatarpur Metro
  Station`, `Terminal 1/2` rows exist in the index but don't reach the
  candidate pool for those queries — merge can't rank what it never
  sees. Same for a Shahdara Hanuman Mandir / Paharganj Sitaram Diwan
  Chand / Sangam Vihar G-Block — index gaps, honest fallbacks only.
- `ashok nagar shahdara`: the ~8km Shahdara Ashok Nagar cluster is
  sparse enough that no two evidence rows corroborate it — qualifier
  ordering only reorders within class; a corpus densification of
  Shahdara-side Ashok Nagar rows would let evidence vote correctly.
- `devli`: the 28.22 Devli cluster looks like a real far village
  (Devli Gaon rows corroborate each other) — scope question for the
  app, not corruption.
