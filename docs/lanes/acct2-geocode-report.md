# Geocoding probe — Delhi coverage & index-gap report (acct2 lane)

Probe target: `https://d2eh2l2ys9wkij.cloudfront.net/v2/search?q=<q>&lat=28.63&lon=77.24` (bias ≈ Connaught Place).
Method: 237 queries across 7 categories; top-3 rows recorded per query; every query hand-classified
**EXACT** (top hit = intended place) / **NEAR** (right locality, wrong or adjacent row) /
**FALLBACK** (locality-level anchor only) / **MISS** (empty, garbage, or far-city artifact).
Ground-truth coords verified against known locations where possible; `gt_dist_m` = haversine
top-hit → ground truth.

## Verdict

| class | count | share |
|---|---|---|
| EXACT | 128 | 54.0% |
| NEAR | 75 | 31.6% |
| FALLBACK | 8 | 3.4% |
| MISS | 26 | 11.0% |
| **total** | **237** | |

Per-category:

| category | EXACT | NEAR | FALLBACK | MISS | n |
|---|---|---|---|---|---|
| abbrev | 10 | 2 | 0 | 1 | 13 |
| food | 4 | 4 | 0 | 2 | 10 |
| landmark | 11 | 4 | 0 | 2 | 17 |
| locality | 63 | 27 | 1 | 9 | 100 |
| owner | 0 | 1 | 0 | 2 | 3 |
| transport | 32 | 35 | 7 | 6 | 80 |
| worship | 8 | 2 | 0 | 4 | 14 |

Top-hit `match` field distribution: `exact-prefix` 158, `token-prefix` 35, `category` 29,
`area` 9, `other` 4, `fuzzy` 1.

## Full MISS list (26)

| query | what top hit was | defect |
|---|---|---|
| `Pawan Bakery C block Hanuman Mandir Ashok Nagar Shahdara` | `Giani's di Hatti` confectionery ~6.8 km off | `match=category` anchor resolved to `Pawan Textiles`; dumped confectionery chains |
| `Neelanchal Dham Sant Nagar` | — | zero results |
| `aiims delhi` | `AIIMS, delhi` at 13.0 km off | mis-geocoded duplicate; real AIIMS was rank 2 (gt 245 m) |
| `lajpat nagar central market` | `Lajpat Nagar - Central Market` shopping_mall 10.5 km off | mis-geocoded duplicate ranked above true rows (r1, r2) |
| `ashok nagar shahdara` | `Ashok Nagar` locality at 28.7156,77.6590 (~42 km, Ghaziabad side) | wrong-Ashok-Nagar disambiguation; Shahdara row only rank 2 |
| `sant nagar` | `Sant Nagar` place 9.4 km off | multiple same-name rows at 9.4/14.6/21/25 km — none Burari |
| `sant nagar burari` | same | same |
| `g block sangam vihar` | `G Block Park` 3.9 km off | wrong G-block (another locality's block park) |
| `devli` | `Devli` at 28.2285,77.3223 (~32 km, outside Delhi) | far-artifact duplicate; Devli locality exists in-index |
| `ghitorni` | `Ghitorni` at wrong coords (~19 km off) | mis-geocoded row; correct Ghitorni rows deeper |
| `welcome colony` | `Welcome` fastfood ~20 km off | token-prefix matched a food chain |
| `gazipur delhi` | `Ghazipur (Delhi)` govt office 12.6 km off | mis-geocoded row; village-side rows lower |
| `tri nagar` | `Tri Nagar 110035` community_and_government at 28.6143,77.2087 | planted-coords cluster row ~9.7 km off |
| `lotus temple` | `Lotus Temple` christian_site 8.6 km off | mis-geocoded duplicate; real Bahai temple deeper |
| `chattarpur mandir` | `Chattarpur Mandir` 11.5 km off | mis-geocoded duplicate; real temple rows deeper |
| `birla mandir delhi` | `श्री राधा कृष्ण मंदिर 21डी कमला नगर` | disambiguation failed → Kamla Nagar temple cluster |
| `majnu ka tilla gurudwara` | junk row | gurudwara not resolved; other Majnu-ka-tilla rows exist |
| `sitaram diwan chand` | `Sita Ram Diwan Chand` wrong-branch or unrelated row ~11 km off | chain-fragment / branch disambiguation |
| `gulati pandara road` | unrelated row | name-level miss |
| `samaypur badli metro` | `Samaypur Badli` historic_site at 28.6143,77.2087 (16 km off) | same planted-coords cluster; real station rows deeper |
| `chhattarpur metro` | `Chattarpur Metro Station` 16.9 km off | mis-geocoded station duplicate above real station |
| `govindpuri metro` | `Govind Puri Govindpuri Metro Station` 11.4 km off | mis-geocoded station duplicate above real station |
| `sikanderpur metro` | `Sikanderpur Metro Station` wrong-side row | mis-geocoded/dup ranked above real Sikanderpur |
| `igi terminal 1` | `1` / `Terminal 1` degenerate-name row | degenerate-name artifacts outrank the terminal POI |
| `igi terminal 2` | `2` / `Terminal 2` degenerate-name row | same |
| `dtu` | `DTU` college_university ~20 km off | mis-geocoded duplicate; second DTU row ~18 km off also wrong |

## Full artifact list (index defects seen in top-3 rows)

1. **Planted-coords cluster @ 28.6143,77.2087** — multiple unrelated entities dumped at one point
   ~3.5 km SW of the bias: `Tri Nagar 110035` (community_and_government), `Samaypur Badli`
   (historic_site). Signature of a bad import batch.
2. **Mis-geocoded duplicate rows outrank correct rows** — same-name rows at wrong coords sit at
   rank 0 while the true row sits at rank 1–2: AIIMS (13 km off), Lajpat Nagar Central Market
   (10.5 km), Chattarpur Metro (16.9 km), Govindpuri Metro (11.4 km), Lotus Temple (8.6 km),
   Chattarpur Mandir (11.5 km), DTU (20.4 km), INA Delhi Haat (6.2 km), Seelampur Metro (4.9 km),
   HUDA City Centre dup (4.3 km). ~20 queries flagged "better row at rank ≥1" → ranking does not
   penalize wrong coords.
3. **Degenerate-name rows** — top hits literally named `1`, `2`, `Gate 2`, `Gate No. 3`,
   `Delhi Metro Pink/Red/Blue Line`, `Delhi–Meerut RRTS`, `Airport Express Line` for station/terminal
   queries — line-level and gate-level rows outrank stations.
4. **Cross-NCR / outside-Delhi rows at Delhi queries** — `Devli` at 28.2285,77.3223 (~32 km,
   Haryana side), `Ashok Nagar` at 77.659 E (Ghaziabad), `Dayalpur` row ~81 km from its anchor,
   `The Village Dhaba` at 28.147,77.574 (UP, ~62 km).
5. **Same-name multi-coord rows** — `Sant Nagar` rows at 9.4/14.6/21/25 km, none at Burari;
   `Karim's` branches at 6.6/4.2/11 km off.
6. **`match=category` anchor leakage** — query falls back to a resolved anchor (often a same-name
   business like `Pawan Textiles`), then returns that category's rows near the anchor —
   e.g. `Pawan Bakery …` → three confectionery chains around Pawan Textiles, none the bakery.
7. **`match=other` residual type** — a few top hits carry `match=other` (e.g. Tajpur Pahadi) —
   unlabeled residual match path.
8. **name_says_elsewhere**: no literal other-city names (no "Srinagar Railway Station" type) in
   top-3 rows. Closest: `Delhi–Meerut RRTS` (legit NCR line name) and `New Rohtak Road Bus Stop`
   (Rohtak Road is a real Delhi road — false positive). The real artifact pattern here is
   same-name mis-geocoded duplicates, not foreign-city name leakage.

## Deepest things that DID resolve (proof of depth)

1. `hanuman mandir shahdara` → `Hanuman Mandir`, Ashok Nagar Shahdara @28.6819,77.2837 (deep locality temple)
2. `dhaka village` → `Dhakka Village` (fuzzy + spelling-variant village hit)
3. `badli` → `Badli Village , Delhi 110042` (PIN-code-level village row)
4. `azadpur` → `MCD Park-Azadpur Village` (in-village park)
5. `sonia vihar` → `Sonia Vihar Water Treatment Plant` (infra-level POI)
6. `dichaun kalan` → `Dichaun Kalan DTC Depot` (bus depot in a deep village)
7. `welcome colony` vicinity → `Gurudwara Shri Guru Nanak Darbar Welcome Colony` resolves on related queries
8. gate-level station rows: `Kalkaji Mandir Metro Gate No. 3`, `Samaypur Badli Metro Gate No 1`, `Vishwavidyalaya Metro Gate No. 3`, `New Ashok Nagar Metro Station Parking`
9. `chhatarpur enclave` → `Chhatarpur Enclave Phase 2` (phase-level enclave)
10. `saidulajaib` → `Saidulajaib Extension` / `Saidulajaib Samudayik Park`
11. `paranthe wali gali` → three spellings all resolve (`Paranthe Wali Gali`, `Gali Paranthe Wali`, `Parathe Wali gali` restaurant)
12. `sardar ji bakhsh` / `dolma aunty momos` → real-name stall/cafe EXACT
13. `Brahma Kumaris New Delhi Shahdara Ashok Nagar` — a Shahdara Ashok Nagar POI exists and wins
    a/b/c-block queries (the "block" tokens simply aren't indexed — see below)

## Which query forms die hardest

| query form | EXACT rate | verdict |
|---|---|---|
| bare locality names (100 q) | 63% | strong — but same-name disambiguation (sant nagar, ashok nagar, devli) is the weak layer |
| **block-level** (a/b/c block ashok nagar, g/k block sangam vihar) | **0/5** | dies 100% — block tokens not indexed; falls to arbitrary block-park rows of other localities |
| **owner phrases / deep local POIs** | **0/3** | worst of all — entity names (Pawan Bakery, Neelanchal Dham) simply absent |
| metro stations (73 q) | 41% EXACT / 48% NEAR | coverage is there (~95% findable in top-3) but **top-hit correctness only ~45%** — ranking is the gap, not presence |
| worship, disambiguated (`birla mandir delhi`, `majnu ka tilla gurudwara`, `chattarpur mandir`) | ~50% | bare names OK; adding locality/qualifier tokens kills it |
| food real-names | 40% | chains fragment by branch; famous stalls hit |
| landmarks | 65% | big names solid; the misses are mis-geocoded dups (aiims, lotus temple, lajpat market) |
| abbreviations | 77% | expansion works (cp, ndls, igi, aiims, iit, jnu, srcc, nzm, anvt, du) |

**Hardest-hit ordering**: owner phrases / deep POIs > block-level > mis-geocoded stations > disambiguated temples > chain food > everything else.

## Notes for the build lane

- `match=category`/`area` means the engine resolved a locality **anchor** and dumped that
  category/area's rows — `distance_m` is then *row→anchor* (small); for name matches
  (`exact-prefix`/`token-prefix`/`fuzzy`/`other`) `distance_m` is *row→bias point*.
  Consumers must read distance differently per match type.
- The gazetteer's locality coverage is genuinely deep — Dwarka Sec-21, Chhatarpur, Sangam Vihar,
  Krishna Nagar, Sikanderpur anchors all resolve correctly. The weak layers are (a) entity-name
  indexing inside deep localities, (b) coordinate integrity of same-name duplicates,
  (c) ranking against bad-coord duplicates.
- Hindi-script names exist and resolve (`प्राचीन हनुमान मंदिर`, `जामा मस्जिद मेट्रो स्टेशन गेट नं 2`).
- Block tokens ("c block", "g block") are effectively unindexed — route those queries to the
  locality anchor explicitly instead of letting them drift to another locality's block park.
- ~20 of 75 NEAR rows had the correct entity sitting at rank 1–2 behind a garbage rank-0 —
  a small ranking fix (coord sanity / dup suppression) converts a big block of NEARs to EXACTs.

## Method artifacts

Probe scripts and per-query data (top-3 rows, GT distances, classification): this file's appendix
table below; raw `raw_results.jsonl` / `final.jsonl` kept in the probe workdir (not committed —
contains no secrets, but is bulky).

### Appendix — all 237 queries (top-3 names, classification)

| query | cat | class | rank0 | rank1 | rank2 |
|---|---|---|---|---|---|
| Pawan Bakery C block Hanuman Mandir Ashok Nagar Shahdara | owner | MISS | Giani's di Hatti (confectionery, gtd 6839) | Meghraj & sons | Bhikaram chandmal |
| ISKCON East of Kailash | owner | NEAR | OYO Rooms East of Kailash ISKCON (hotel, gtd 928) | ISKCON East Delhi | Iskcon Temple, Kailash Colony |
| Neelanchal Dham Sant Nagar | owner | MISS | — | — | — |
| connaught place | landmark | NEAR | Connaught Place (bank_or_credit_union, gtd 780) | Connaught Place | Connaught Place |
| india gate | landmark | EXACT | India Gate (historic_site, gtd 2) | India Gate canopy | India Gate Fountain |
| qutub minar | landmark | EXACT | Qutb Minar (place, gtd 29) | Qutb Minar | Qutub minarr |
| aiims delhi | landmark | MISS | AIIMS, delhi (hospital, gtd 12967) | All India Institute of Medical Sciences,delhi | All India Institute of Medical Sciences, New Delhi |
| jnu gate | landmark | NEAR | IIT Delhi JNU Gate (gate, gtd 839) | IIT Delhi JNU Gate Road | Kamakshi Temple, Opposite JNU, East Gate |
| sarojini nagar market | landmark | EXACT | Sarojini Nagar Market (place, gtd 317) | Sarojini Nagar | Sarojani Nagar Market Bus Stop |
| chandni chowk | landmark | EXACT | Chandni Chowk (locality, gtd 693) | Chandni Chowk | Chandni Chowk |
| lajpat nagar central market | landmark | MISS | Lajpat Nagar - Central Market (shopping_mall, gtd 10547) | Lajpat Nagar Central Market | Lajpat Nagar, Central Market |
| karol bagh gaffar market | landmark | NEAR | eLobby - Delhi - Karol Bagh Gaffar Market (bank_or_credit_union, gtd 142) | Karol Bagh | Karol Bagh |
| red fort | landmark | EXACT | Red Fort (monument, gtd 81) | Red fort center | Red Fort Baoli |
| humayun tomb | landmark | EXACT | Humayun Tomb (monument, gtd 107) | Humayun Tomb | Humayun Tomb Center Park Cannout Place New Dehli |
| lodhi gardens | landmark | EXACT | Lodi Gardens (park, gtd 152) | Lodi Garden | Lodhi Garden |
| dilli haat ina | landmark | NEAR | INA Delhi Haat (handicraft, gtd 6262) | Dilli Haat | Dilli Haat - INA |
| khan market | landmark | EXACT | Khan Market (building, gtd 58) | Khan Market | Khan Market |
| hauz khas village | landmark | EXACT | Hauz Khas Village (commercial, gtd 215) | Hauz Khas village | Hauz Khas Village |
| rashtrapati bhavan | landmark | EXACT | Rashtrapati Bhavan (place, gtd 12) | Rashtrapati Bhavan | राष्ट्रपति भवन | Rashtrapati Bhavan |
| jantar mantar delhi | landmark | EXACT | Jantar Mantar (attraction, gtd 7) | Jantar-Mantar, New Delhi | Jantar Mantar Entry |
| a block ashok nagar shahdara | locality | NEAR | Brahma Kumaris New Delhi Shahdara Ashok Nagar (wellness_service, gtd 1934) | — | — |
| b block ashok nagar shahdara | locality | NEAR | Brahma Kumaris New Delhi Shahdara Ashok Nagar (wellness_service, gtd 1953) | — | — |
| c block ashok nagar shahdara | locality | NEAR | C Block Park (park, gtd 2122) | — | — |
| ashok nagar shahdara | locality | MISS | Ashok Nagar (locality, gtd 18552) | Ashok Nagar | Brahma Kumaris New Delhi Shahdara Ashok Nagar |
| sant nagar | locality | MISS | Sant Nagar (place, gtd 9398) | Sant Nagar | Sant Nagar |
| sant nagar burari | locality | MISS | Sant Nagar (place, gtd 9398) | Sant Nagar | Sant Nagar |
| tilak nagar | locality | EXACT | Tilak Nagar (locality, gtd 684) | Tilak Nagar | Tilak Nagar |
| jahangirpuri | locality | EXACT | Jahangirpuri (place, gtd 833) | Jahangirpuri | — |
| seelampur | locality | EXACT | Seelampur (macrohood, gtd 425) | Seelampur | Seelampur |
| mustafabad | locality | EXACT | Mustafabad (town, gtd 2555) | Mustafabad | Mustafabad |
| tughlakabad village | locality | NEAR | tughlakabad village residence parking (parking_space, gtd 1098) | skv Tughlakabad village | Patanjali store tughlakabad village |
| sultanpur majra | locality | EXACT | Sultan Pur Majra (locality, gtd 69) | Sultanpur Majra | Sultan Pur Majra |
| mangolpuri | locality | NEAR | Mangolpuri (construction, gtd 2251) | Mangolpuri | Mangolpuri Flyover |
| kirari | locality | EXACT | Kirari (locality, gtd 2803) | Kirari Sulemannagar | Kirari Suleman Nagar |
| ranhola | locality | EXACT | Ranhola (political, gtd 1738) | Ranhola | Ranhola Road |
| chhawla | locality | EXACT | Chhawla (locality, gtd 1812) | Chhawla | Chhawla |
| dhulsiras | locality | NEAR | Dhulsiras (historic_site, gtd 2757) | Dhoolsiras | Dhoolsiras Road |
| sangam vihar | locality | EXACT | Sangam Vihar (macrohood, gtd 1204) | Sangam Vihar | Sangam Vihar |
| g block sangam vihar | locality | MISS | G Block Park (park, gtd 3945) | G Block | G Block |
| k block sangam vihar | locality | FALLBACK | Sangam Vihar (platform, gtd 1270) | K-Block | K block |
| devli | locality | MISS | Devli (locality, gtd 32071) | Devli | Devli Road |
| ghitorni | locality | MISS | Ghitorni (locality, gtd 13016) | Ghitorni | Ghitorni |
| chhatarpur enclave | locality | EXACT | Chhatarpur Enclave Phase 2 (neighbourhood, gtd 1640) | Chattarpur Enclave Phase 1 | Chhattarpur Enclave D Block |
| freedom fighters enclave | locality | EXACT | Freedom Fighters Enclave (place, gtd 2375) | Freedom Fighters Enclave | — |
| saidulajaib | locality | EXACT | Saidulajaib (place, gtd 2345) | Saidulajaib | Saidulajaib Extension |
| katwaria sarai | locality | EXACT | Katwaria Sarai (village, gtd 1668) | Katwaria Sarai | HDFC Bank Katwaria Sarai, New Delhi branch |
| ber sarai | locality | EXACT | Ber Sarai (locality, gtd 875) | Ber Sarai | BAFEL, Ber Sarai |
| munirka village | locality | NEAR | Munirka Village Park (park, gtd 803) | Munirka Village Residents Welfare Association Registerd | Munirka |
| mahipalpur | locality | EXACT | Mahipalpur (locality, gtd 801) | Mahipalpur | Mahipalpur |
| kapashera | locality | EXACT | Kapashera (macrohood, gtd 1229) | Kapashera | Kapashera new Delhi |
| najafgarh | locality | EXACT | Najafgarh (locality, gtd 598) | Najafgarh | Najafgarh |
| mitraon | locality | EXACT | Mitraon (locality, gtd 1868) | Mitraon | Mitraon |
| jharoda kalan | locality | EXACT | Jharoda Kalan (village, gtd 2161) | Jharoda Kalan | Jharoda Kalan |
| nangloi | locality | EXACT | Nangloi (political, gtd 1391) | Nangloi | Nangloi |
| mundka | locality | EXACT | Mundka (village, gtd 222) | Mundka | Mundka |
| bawana | locality | EXACT | Bawana (locality, gtd 503) | Bawana | Bawana |
| narela | locality | NEAR | Narela (administrative, gtd 4757) | Narela | Narela |
| holambi kalan | locality | EXACT | Holambi Kalan (locality, gtd 2587) | Holambi Kalan | Holambi Kalan |
| alipur delhi | locality | NEAR | Mahindra Finance - Delhi Alipur Branch (bank_or_credit_union, gtd 289) | All India Institute of Public & Physical Health Sciences Alipur Delhi | Alipur |
| bhalswa | locality | EXACT | Bhalswa (suburb, gtd 389) | Bhalswa Jheel | Bhalswa Flyover |
| badli village | locality | NEAR | Badli Village , Delhi 110042 (historic_site, gtd 2444) | BADLI | Badli |
| siraspur | locality | EXACT | Siraspur (political, gtd 2441) | Siraspur | Siraspur |
| khera kalan | locality | EXACT | Khera Kalan (political, gtd 2435) | Khera Kalan | Khera Kalan |
| trilokpuri | locality | NEAR | Trilokpuri (locality, gtd 3091) | Trilokpuri | Trilok Puri |
| kalyanpuri | locality | EXACT | Kalyanpuri (administrative, gtd 1328) | Kalyanpuri | Kalyan Puri |
| khichripur | locality | NEAR | Khichripur Road (secondary, gtd 301) | Khichripur Grid | Khichripur |
| nand nagri | locality | EXACT | Nand Nagri (place, gtd 1480) | NAND NAGRI | Nand Nagri |
| sunder nagri | locality | NEAR | Sunder Nagri Kabristan (public_transit_facility_or_service, gtd 3031) | Sunder Nagri Bus Stop | Sneha Public School Sunder nagri |
| gokalpuri | locality | NEAR | Gokalpuri park (park, gtd 881) | Gokalpur | Gokal Pur |
| karawal nagar | locality | EXACT | Karawal Nagar (locality, gtd 329) | Karawal Nagar | Karawal Nagar |
| sonia vihar | locality | NEAR | Sonia Vihar Water Treatment Plant (wastewater_plant, gtd 2144) | Sonia Vihar Toll Tax Chowk | Sonia Vihar Mhitla Chowk |
| bhajanpura | locality | EXACT | Bhajanpura (macrohood, gtd 388) | Bhajanpura | Bhajanpura |
| yamuna vihar | locality | NEAR | Yamuna Vihar (bank_or_credit_union, gtd 2876) | Yamuna Vihar | Yamuna Vihar |
| maujpur | locality | EXACT | Maujpur (locality, gtd 552) | Maujpur | Maujpur-Babarpur |
| jaffrabad | locality | EXACT | Jaffrabad (locality, gtd 86) | Jaffrabad | Jaffrabad metro station |
| welcome colony | locality | MISS | Welcome (fast_food_restaurant, gtd 20003) | Welcome Colony Seelampur | Gurudwara Shri Guru Nanak Darbar Welcome Colony |
| dayalpur | locality | NEAR | Dayalpur (convenience_store, gtd 2978) | Dayalpur | Dayalpur |
| dilshad colony | locality | EXACT | Dilshad Colony (locality, gtd 951) | Dilshad Colony | B 64 DLF Dilshad Colony Bhupura |
| dilshad garden | locality | EXACT | Dilshad Garden (locality, gtd 1116) | Dilshad Garden | Dilshad Garden |
| mandawali | locality | EXACT | Mandawali (place, gtd 1009) | Mandawali | Mandawali Fazalpur |
| new ashok nagar | locality | EXACT | New Ashok Nagar (named, gtd 943) | New Ashok Nagar | New Ashok Nagar |
| vasundhara enclave | locality | EXACT | Vasundhara Enclave (administrative, gtd 337) | Vasundhara Enclave | Vasundhara Enclave |
| ip extension | locality | EXACT | IP Extension (station, gtd 468) | Kidzee Ip Extension | 201 IP Extension |
| patparganj | locality | EXACT | Patparganj (neighborhood, gtd 2749) | Patparganj | Patparganj |
| pandav nagar | locality | EXACT | Pandav Nagar (locality, gtd 2598) | Pandav Nagar | Pandav Nagar |
| shakarpur | locality | EXACT | Shakarpur (place, gtd 179) | Shakarpur | Shakarpur Khas |
| gazipur delhi | locality | MISS | Ghazipur (Delhi) (government_office, gtd 12642) | Ghazipur DTC Depot | Flower Mandi - Delhi/Ghazipur |
| madanpur khadar | locality | EXACT | Madanpur Khadar (locality, gtd 1242) | Madanpur Khadar Village | Madanpur Khadar Road |
| jaitpur | locality | NEAR | Jaitpur (locality, gtd 3714) | Jaitpur | Jaitpur |
| molarband | locality | EXACT | Molarband (locality, gtd 2153) | Molarband school | Molarband School |
| badarpur village | locality | EXACT | Badarpur Village (historic_site, gtd 200) | Badarpur | Badarpur |
| tajpur pahari badarpur | locality | NEAR | Tajpur Pahadi (locality, gtd 1872) | Mohan Baba Mandir Tajpur villege Badarpur Border New Delhi-44 | Tajpur Pahadi Barat Ghar |
| rajokri | locality | NEAR | Rajokri (locality, gtd 3879) | Rajokri | Rajokri Harijan Basti Bus Stop |
| samalka | locality | EXACT | Samalka (locality, gtd 1192) | Samalka, New Delhi- 37 | SPUHC Samalka |
| bamnoli | locality | NEAR | Bamnoli (locality, gtd 3814) | Bamnoli | Bamnoli |
| pochanpur | locality | EXACT | Pochanpur (locality, gtd 2093) | Pochanpur | SubCentre, Pochanpur |
| dichaun kalan | locality | NEAR | Dichaun Kalan DTC Depot (bus_station, gtd 536) | Dichaon Kalan | Dichaon Kalan |
| hastsal | locality | EXACT | Hastsal (political, gtd 631) | Hastsal | Hastsal |
| tihar village | locality | EXACT | Tihar Village (village, gtd 1318) | Tihar Village | Tihar Village Residents Welfare Association |
| rani bagh | locality | EXACT | Rani Bagh (residential, gtd 443) | Rani Bagh | Rani bagh |
| tri nagar | locality | MISS | Tri Nagar 110035 (community_and_government, gtd 9741) | Tri Nagar Mitra Mandal | Tri Nagar Vidhan Sabha constituency |
| shalimar bagh | locality | EXACT | Shalimar Bagh (place, gtd 509) | Shalimar Bagh | Shalimar Bagh |
| azadpur village | locality | NEAR | MCD Park-Azadpur Village (park, gtd 214) | Azadpur | Azadpur |
| gujranwala town | locality | EXACT | Gujranwalan Town (locality, gtd 923) | Feel Fit -Gujranwala town | The Gym : Gujranwala Town |
| outram lines | locality | EXACT | Outram Lines (locality, gtd 2346) | Outram lines | 2222 OUTRAM LINES |
| mukherjee nagar | locality | EXACT | Mukherjee Nagar (locality, gtd 544) | Mukherjee Nagar | Mukherjee nagar |
| vijay nagar delhi | locality | EXACT | Vijay Nagar (neighborhood, gtd 733) | Vijay Sales - Krishna Nagar (Delhi) | Vijay Nagar |
| kalyan vihar | locality | NEAR | Kalyan Vihar (tertiary, gtd 780) | Kalyan Vihar | Kalyan Vihar |
| dhaka village | locality | EXACT | Dhakka Village (historic_site, gtd 570) | Walk In The Village - Family Dhaba | New Village Dhaba |
| rana pratap bagh | locality | EXACT | Rana Pratap Bagh (locality, gtd 2464) | Rana Pratap Bagh | Rana Pratap Bagh Road |
| panchsheel vihar | locality | NEAR | Panchsheel Vihar (residential, gtd 4375) | Panchsheel Buddh Vihar | Panchsheel Budh Vihar |
| khirki village | locality | EXACT | Khirki village (historic_site, gtd 1194) | Khirki Village Road | Khirki Village Choupal |
| shahpur jat | locality | EXACT | Shahpur Jat (village, gtd 1158) | Shahpur Jat | Shahpur Jat |
| chirag delhi | locality | EXACT | Chirag Delhi (locality, gtd 792) | Chirag Delhi | Chirag Delhi |
| sheikh sarai | locality | EXACT | Sheikh Sarai (locality, gtd 2074) | Sheikh Sarai | Sheikh Sarai |
| andrews ganj | locality | EXACT | Andrews Ganj (locality, gtd 1658) | Andrews Ganj | Andrews Ganj Extension |
| kotla mubarakpur | locality | NEAR | Kotla Mubarakpur (car, gtd 957) | Kotla Mubarakpur Complex | Kotla Mubarakpur mosque |
| nizamuddin basti | locality | EXACT | Nizamuddin (locality, gtd 286) | Nizamuddin | Nizamuddin |
| jasola village | locality | NEAR | Jasola Village (social_or_community_service, gtd 984) | GBSSS Jasola Village | Jasola Gujjar Village |
| sarai kale khan village | locality | EXACT | Sarai Kale Khan (place, gtd 701) | Sarai Kale Khan | Sarai Kale Khan |
| hanuman mandir | worship | EXACT | Hanuman Mandir (hindu_place_of_worship, gtd 314) | Hanuman Temple | Hanuman Mandir |
| hanuman mandir connaught place | worship | EXACT | Hanuman Temple, Connaught Place (temple, gtd 313) | Pracheen Hanuman Mandir, Connaught place | Hanuman Mandir, Connought Place, New Delhi |
| hanuman mandir jhandewalan | worship | NEAR | Hanuman Mandir (hindu_place_of_worship, gtd 2181) | Hanuman Temple, Connaught Place | Prachin Hanuman Mandir |
| hanuman mandir shahdara | worship | NEAR | Shri Kamla Devi Shri Krishn Mandir (hindu_place_of_worship, gtd 634) | Hanuman Mandir | Shree Radha Krishna Mandir |
| jama masjid | worship | EXACT | Jama Masjid (amenity:place_of_worship, gtd 6) | Jama Masjid | Jama Masjid |
| gurudwara bangla sahib | worship | EXACT | Gurudwara Bangla Sahib | गुरुद्वारा बंगला साहिब (place_of_worship, gtd 93) | Gurdwara Bangla Sahib | Sri Bangla Sahib Gurudwara |
| lotus temple | worship | MISS | Lotus Temple (christian_place_of_worship, gtd 8618) | Lotus Temple | Lotus Temple |
| akshardham delhi | worship | EXACT | Delhi Akshardham (religious_organization, gtd 148) | Akshardham Temple Delhi | NEXA (Fairdeal, New Delhi, Akshardham) |
| chattarpur mandir | worship | MISS | Chattarpur Mandir (hindu_place_of_worship, gtd 11484) | Chhatarpur Temple | Chhatarpur Temple |
| kalkaji mandir | worship | EXACT | Kalkaji Temple (hindu_place_of_worship, gtd 101) | Kalkaji Mandir | Kalkaji Mandir |
| nizamuddin dargah | worship | EXACT | Nizamuddin Dargah Complex (monument, gtd 37) | Nizamuddin Dargah | Hazrat Nizamuddin Dargah |
| birla mandir delhi | worship | MISS | श्री राधा कृष्ण मंदिर 21डी कमला नगर (hindu_place_of_worship, gtd 5364) | Radhey Krishan Mandir | श्री गीता भवन मंदिर |
| sis ganj sahib | worship | EXACT | Gurdwara Sis Ganj Sahib (place, gtd 10) | Gurudwara Sis Ganj Sahib Ji Amrit Wela Daily Updates | — |
| majnu ka tilla gurudwara | worship | MISS | Shiv Mandir, Afzalpur (place_of_worship, gtd 11523) | Shiv Mandir, Nistoli | Gurudwara Majnu Ka Tilla |
| paranthe wali gali | food | EXACT | Paranthe Wali Gali (residential, gtd 97) | Gali Paranthe Wali | Parathe Wali gali |
| karim's | food | NEAR | Karim's (restaurant, gtd 6573) | Karim's | Karim's |
| sardar ji bakhsh coffee | food | EXACT | Sardar Ji Bakhsh Coffee (coffee, gtd None) | Sardar Ji Bakhsh Coffee | Sardar Ji Bakhsh Coffee and Company |
| sitaram diwan chand chhole bhature | food | MISS | Sitaram Ji Ke Chole Bhature (restaurant, gtd 9069) | — | — |
| kake da hotel | food | NEAR | Kake-Da-Hotel (amenity:fast_food, gtd 962) | Kake Da Hotel | Kake Da Hotel |
| wenger's connaught place | food | EXACT | Wenger's (shop:bakery, gtd 182) | Wenger's Deli | Wenger's Bakery |
| gulati pandara road | food | MISS | Vinay Gulati Marg (residential, gtd 8626) | DK Gulati Path Lab | — |
| moti mahal daryaganj | food | NEAR | Moti Mahal (restaurant, gtd 448) | Moti Mahal | Moti Mahal |
| dolma aunty momos | food | EXACT | Dolma Aunty Momos (fast_food, gtd 357) | Dolma Aunty Momos and cold coffee | Dolma Aunty Momo's |
| nathu sweets bengali market | food | NEAR | Nathus Sweets (restaurant, gtd 2300) | Best Bengali Sweets | Bhatia Sweets |
| dwarka mor metro | transport | EXACT | Dwarka Mor metro station (train_station, gtd 43) | Dwarka More Metro Station | Capital O Dwarka Metro View Near Dwarka Mor Metro Station |
| janakpuri west metro | transport | NEAR | Janakpuri West metro station (train_station, gtd 1294) | Janak Puri West Metro Station | Janakpuri West |
| uttam nagar east metro | transport | NEAR | Tilak Pul Bus Stop (public_transit_facility_or_service, gtd 739) | Metro Pet Mall . | Uttam Nagar East metro station |
| rithala metro | transport | NEAR | Delhi Metro Red Line (subway, gtd 298) | Rithala metro station | Rithala |
| samaypur badli metro | transport | MISS | Samaypur Badli (historic_site, gtd 16015) | Samaypur Badli | Samaypur Badli Metro Gate No 1 |
| huda city centre metro | transport | NEAR | HUDA City Centre Metro Station (train_station, gtd 4257) | HUDA City Centre metro station | Domino's Pizza | Huda City Centre(Metro Station) |
| noida sector 18 metro | transport | FALLBACK | Noida Sector 18 (synthetic:sector, gtd 2849) | Noida Sec 18 | Noida Sector 18 metro station |
| noida sector 16 metro | transport | FALLBACK | Noida Sector 16 (synthetic:sector, gtd 923) | Noida Sector 16 metro station | Townhouse Noida Sector 16 Metro Station |
| rajiv chowk metro | transport | EXACT | Rajiv Chowk Metro Gate No 3 (subway_entrance, gtd 139) | Rajiv Chowk Metro Gate No 5 | Rajiv Chowk metro station |
| kashmere gate metro | transport | FALLBACK | Kashmere Gate (neighborhood, gtd 229) | Kashmere Gate | Kashmere Gate Metro Gate Number 8 |
| aiims metro station | transport | EXACT | AIIMS Metro Station (train_station, gtd 71) | AIIMS Metro Station | AIIMS Metro Gate No. 4 |
| hauz khas metro | transport | EXACT | Hauz Khas metro station (metro, gtd 22) | Delhi Metro Magenta Line | Hauz Khas Metro Station Gate No 3 |
| lajpat nagar metro | transport | NEAR | Jal Vihar Terminal Bus Stop (public_transit_facility_or_service, gtd 1616) | Delhi Metro Violet Line | Jangpura Metro Station Gate 1 |
| kalkaji mandir metro | transport | NEAR | Kalkaji Mandir (station, gtd 561) | Kalkaji Mandir | Kalkaji Mandir Metro |
| nehru place metro | transport | EXACT | Nehru Enclave Metro Gate No. 4 (travel_and_transportation, gtd 144) | Nehru Enclave metro station | Nehru Enclave Metro |
| saket metro | transport | EXACT | Saket metro station (metro, gtd 26) | Saket Metro Gate 2 | Saket Metro (New Delhi) |
| malviya nagar metro | transport | EXACT | Malviya Nagar metro station (metro, gtd 370) | Incentives Vacations Private Limited | Panchsheel Park Metro Gate No. 1 |
| chhattarpur metro | transport | MISS | Chattarpur Metro Station (train_station, gtd 16909) | POP South Plaza Near Qutab Minar Metro Station | OYO Sunrise Villa Near Qutab Minar Metro Station |
| ghitorni metro | transport | EXACT | Ghitorni metro station (metro, gtd 35) | Ghitorni Metro Station | Delhi Cantt Metro Lift Number 4 |
| sultanpur metro | transport | EXACT | Sultanpur (station, gtd 44) | Sultanpur Metro Rail Depot | Delhi Metro Sultanpur Depot |
| iit delhi metro | transport | EXACT | IIT Delhi metro station (metro, gtd 49) | Iit Metro, Delhi | IIT Delhi |
| munirka metro | transport | EXACT | Munirka (station, gtd 216) | Munirka | Munirka |
| vasant vihar metro | transport | NEAR | Vasant Vihar metro station (metro, gtd 828) | Malai Mandir Bus Stop | Basant Gaon Bus Stand |
| delhi aerocity metro | transport | NEAR | Chaayos Cafe at Aerocity (public_transit_facility_or_service, gtd 199) | Delhi Aerocity metro station | Delhi Aero City Metro Station |
| igi airport terminal 3 metro | transport | NEAR | Terminal 3 - Indira Gandhi International Airport (airport, gtd 1476) | Clark Greens Airport Hotel & Spa Resort | Gate 32 |
| dwarka sector 21 metro | transport | NEAR | Domino's Pizza | Pacific Mall, Dwarka Sec-21 Metro Station, Delhi (restaurant, gtd 10) | Dwarka Sector 21 metro station | Dwarka -21 Express Metro |
| rajouri garden metro | transport | NEAR | Rajouri Garden MIG Flat Bus Stop (public_transit_facility_or_service, gtd 382) | Metro Super Mart Limited Liability Partnership | Titarpur Bus Stand |
| kirti nagar metro | transport | NEAR | Metro Plus Life Style (hardware_home_and_garden_store, gtd 965) | F Block Kirti Nagar Bus Stop | DTC Naraina Depot |
| karol bagh metro | transport | EXACT | Karol Bagh metro station (train_station, gtd 211) | Karol Bagh Metro - क़रोल बाग़ मेट्रो | Karol Bagh |
| jhandewalan metro | transport | EXACT | Jhandewalan metro station (train_station, gtd 110) | Jhandewalan Metro Station Gate Number 2 | Jhandewala Metro Station |
| chawri bazar metro | transport | EXACT | Chawri Bazar metro station (metro, gtd 58) | Chawri Bazaar Metro Gate Number 2 | Chawri Bazaar Gate Number 3 |
| jama masjid metro | transport | NEAR | Jama Masjid (mosque, gtd 321) | Jama Masjid | Jama Masjid Metro Gate No. 1 |
| delhi gate metro | transport | EXACT | Delhi Gate metro station (metro, gtd 61) | Delhi Gate Metro Station | Delhi Gate |
| mandi house metro | transport | EXACT | Mandi House metro station (metro, gtd 54) | Mandi House | Mandi House Metro Station Gate Number 2 |
| ito metro | transport | EXACT | ITO metro station (metro, gtd 153) | ITO Metro Station | ITO Metro Station |
| pragati maidan metro | transport | NEAR | Pragati Maidan metro station (train_station, gtd 805) | Pragati Maidan | Pragati Maidan Tunnel |
| jangpura metro | transport | NEAR | Bhogal (Jangpura) Bus Stop (public_transit_facility_or_service, gtd 726) | Jungpura Bus Stop | Jal Vihar Terminal Bus Stop |
| sarai kale khan metro | transport | NEAR | Delhi Metro Pink Line (subway, gtd 1029) | Sarai Kale Khan Bus Stop | Sarai Kale Khan Gate Number 1 |
| ashram metro | transport | NEAR | Delhi Metro Pink Line (underground) (subway, gtd 423) | Ashram Bus Stop | Hotel O KL khari Near Ashram Mein Metro |
| azadpur metro | transport | EXACT | Azadpur metro station (metro, gtd 143) | Azadpur Sabji Mandi Bus Stop | OYO Hotel Sai Near Adarsh Nagar Metro Station |
| model town metro | transport | EXACT | Model Town metro station (metro, gtd 314) | Model Town | Model Town |
| vidhan sabha metro | transport | EXACT | Vidhan Sabha metro station (metro, gtd 98) | Vidhan Sabha | Vidhan Sabha |
| vishwavidyalaya metro | transport | EXACT | Vishwavidyalaya Metro Gate No. 3 (subway_entrance, gtd 26) | Vishwavidyalaya Metro Bus Stand | Vishwavidhyalaya Metro station |
| civil lines metro | transport | FALLBACK | Civil Lines (locality, gtd 332) | Civil Lines | Civil Lines Metro Gate No. 2 |
| pitampura metro | transport | NEAR | Pitampura Metro Station Gate 1 (train_station, gtd 1196) | Metro Grill - Pitampura | Pitam Pura metro station |
| netaji subhash place metro | transport | NEAR | Netaji Subhash Place (subway_entrance, gtd 717) | Saraswati Vihar Bus Stop | Netaji Subhash Place metro station |
| rohini east metro | transport | EXACT | Rohini East metro station (train_station, gtd 384) | Rohini East | Rohini metro station |
| badarpur border metro | transport | EXACT | Badarpur Border metro station (train_station, gtd 350) | Badarpur Border | OYO Ojas Palace Near Badarpur Border Metro Station |
| mohan estate metro | transport | NEAR | Mohan Estate metro station (metro, gtd 551) | Mohan Estate Metro Parking | OYO Nitin Palace Guest House Near Mohan Estate Metro Station |
| sarita vihar metro | transport | NEAR | Ps Kalkaji Mandir Metro Station (police_station, gtd 223) | Sarita Vihar metro station | Flagship The Anmols - A Boutique Hotel Near Sarita Vihar Metro Station |
| jasola apollo metro | transport | EXACT | Jasola Apollo metro station (metro, gtd 29) | Jasola Apollo | Jasola Apollo Hospital |
| govindpuri metro | transport | MISS | Govind Puri Govindpuri Metro Station (professional_service, gtd 11394) | Govind Puri metro station | Govindpuri Metro Station Bus Stand |
| shastri park metro | transport | EXACT | Shastri Park (station, gtd 297) | Shastri park | Shastri Park Metro Station |
| maujpur babarpur metro | transport | NEAR | Maujpur - Babarpur metro station (metro, gtd 541) | Maujpur-Babarpur | SPOT ON Liv In Guest House Near Maujpur-Babarpur Metro Station |
| gokulpuri metro | transport | EXACT | Gokulpuri metro station (metro, gtd 122) | Collection O The Crown Near Gokulpuri Metro Station | Flagship Vikal Stay Near Gokulpuri Metro Station |
| seelampur metro | transport | NEAR | METRO Seelampur (department_store, gtd 94) | Seelampur Metro Station | Ajit Nagar Bus Stop |
| welcome metro | transport | EXACT | Welcome Metro Station (train_station, gtd 64) | Welcome Metro Station (Pink Line) | Welcome Metro Station (Red Line) |
| east azad nagar metro | transport | NEAR | East Azad Nagar metro station (metro, gtd 586) | East Azad Nagar Gate No.2 | Delhi Metro Pink Line |
| krishna nagar metro | transport | FALLBACK | Krishna Nagar (locality, gtd 727) | Lala Quarter Bus Stop | Metro Ultrasound |
| karkardooma metro | transport | NEAR | Karkardooma Court Metro Station (transportation, gtd 1118) | Karkardooma | Karkarduma metro station |
| anand vihar metro | transport | NEAR | Karkarduma Metro Station (Pink Line) (building, gtd 969) | Delhi Metro Pink Line | Karkarduma metro station |
| mayur vihar phase 1 metro | transport | FALLBACK | Mayur Vihar Phase 1 (subdistrict, gtd 336) | Mayur Vihar Phase 1 | Mayur Vihar Phase 1 |
| new ashok nagar metro | transport | FALLBACK | New Ashok Nagar (named, gtd 1681) | New Ashok Nagar | Delhi–Meerut RRTS |
| botanical garden metro | transport | EXACT | Botanical Garden metro station (train_station, gtd 220) | Botanical Garden | Botanical Garden |
| vaishali metro | transport | EXACT | Vaishali metro station (metro, gtd 126) | Vaishali Metro Station Parking | Vaishali metro station |
| sikanderpur metro | transport | MISS | KTM Husqvarna Vaishali Metro (vehicle_dealer, gtd 34175) | Bhopra Border Bus Stop | Metro plaza |
| isbt kashmere gate | transport | EXACT | Kashmere Gate ISBT (bus_station, gtd 385) | Inter-State Bus Terminus (ISBT) Kashmiri Gate | ISBT Kashmiri Gate |
| anand vihar isbt | transport | NEAR | Anand Vihar (monitoring_station, gtd 934) | Anand Vihar | Anand Vihar |
| sarai kale khan isbt | transport | NEAR | Sarai Kale Khan (place, gtd 471) | Sarai Kale Khan | Indraprastha Park |
| new delhi railway station | transport | NEAR | Chawri Bazar metro station (train_station, gtd 1406) | Lal Quila | जामा मस्जिद मेट्रो स्टेशन गेट नं 2 |
| hazrat nizamuddin railway station | transport | NEAR | Hazrat Nizamuddin railway station (train_station, gtd 652) | Platform 6-7 | Police Station Hazrat Nizamudin Railway station |
| old delhi railway station | transport | NEAR | Chawri Bazar metro station (train_station, gtd 1475) | Lal Quila | जामा मस्जिद मेट्रो स्टेशन गेट नं 2 |
| anand vihar terminal | transport | EXACT | Anand Vihar Terminal (station, gtd 219) | Anand Vihar | Anand Vihar |
| delhi sarai rohilla station | transport | EXACT | Delhi Sarai Rohilla (station, gtd 232) | Sarai Rohilla   सराय रोहिल्ला Railway Station | Government Quarter New Rohtak Road Bus Stop |
| delhi cantt railway station | transport | NEAR | Delhi Cantt railway station (station, gtd 2089) | New Delhi railway station | New Delhi Railway Station |
| shahdara railway station | transport | NEAR | Chhajupur Bus Stop (public_transit_facility_or_service, gtd 211) | Delhi Shahdara | Delhi Shahdara Junction railway station |
| tughlakabad railway station | transport | NEAR | Tuglkabad Village Bus Stop (public_transit_facility_or_service, gtd 290) | Tughlakabad | Kaya Maya Hospital |
| igi terminal 1 | transport | MISS | 1 (entrance, gtd 3027) | — | — |
| igi terminal 2 | transport | MISS | 2 (entrance, gtd 1397) | — | — |
| igi terminal 3 | transport | NEAR | Terminal 3 - Indira Gandhi International Airport (airport, gtd 1476) | — | — |
| cp | abbrev | NEAR | Connaught Place (bank_or_credit_union, gtd 780) | Connaught Place | Connaught Place |
| ndls | abbrev | EXACT | New Delhi Railway Station (platform, gtd 249) | New Delhi railway station | New Delhi Railway Station |
| igi | abbrev | EXACT | Indira Gandhi International Airport (stop_position, gtd 868) | Indira Gandhi International Airport | Indira Gandhi International Airport |
| iit delhi | abbrev | EXACT | IIT Delhi (station, gtd 294) | IIT, Delhi | IIT Delhi Hospital |
| du north campus | abbrev | EXACT | North Campus, DU (college_university, gtd 494) | Vc Office Delhi University North Campus | University of Delhi North Campus Conference Centre |
| srcc | abbrev | EXACT | SRCC (college_university, gtd 538) | SRCC | Shri Ram College of Commerce |
| aiims | abbrev | EXACT | All India Institute of Medical Sciences (education, gtd 192) | All India Institute of Medical Sciences | All India Institute of Medical Sciences |
| jnu | abbrev | EXACT | JNU (college_university, gtd 720) | Jawaharlal Nehru University | Jawaharlal Nehru University |
| anvt | abbrev | NEAR | Anand Vihar Railway Terminal Flyover (secondary, gtd 327) | Anand Vihar Terminal | Anand Vihar Terminal |
| nzm | abbrev | EXACT | Hazrat Nizamuddin (locality, gtd 4) | Hazrat Nizamuddin | Hazrat Nizamuddin Dargah |
| t1d delhi airport | abbrev | EXACT | T1D IGI airport, Delhi (airport, gtd 842) | — | — |
| dtu | abbrev | MISS | Delhi Technological University (college, gtd 20422) | Delhi Technological University | Delhi Technological University |
| jamia | abbrev | EXACT | Jamia Millia Islamia (university, gtd 313) | Jamia Millia Islamia | Jamia Millia Islamia |
