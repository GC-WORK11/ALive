# Geocoding probe — sweep 2 (prod :265, acct2 lane)

Same endpoint as sweep 1: `https://d2eh2l2ys9wkij.cloudfront.net/v2/search?q=<q>&lat=28.63&lon=77.24`.
129 fresh queries, four categories: named **blocks** (36), **landmarks inside localities** (30),
**villages** (37), **hospital/school anchors** (26). Verdicts hand-audited per query against
known ground truth:

- **EXACT** — top hit is the intended entity at/near ground truth
- **NEAR** — right locality resolved; intended row at rank 1–2, or top hit is an
  adjacent/in-locality entity of a different type
- **CLUSTER** — top-3 contains ≥2 rows of the intended entity at conflicting coords
  (>500 m apart) and the top hit is not the clearly-correct row — index has same-name
  duplicates and ranking picks arbitrarily
- **WRONG** — top hit confidently wrong and no correct row in top-3
  (mis-geocoded dup, different-locality same-name, unrelated entity, outside-Delhi row)
- **MISS** — zero results

## Verdicts

| class | count | share |
|---|---|---|
| EXACT | 22 | 17.1% |
| NEAR | 59 | 45.7% |
| CLUSTER | 4 | 3.1% |
| WRONG | 43 | 33.3% |
| MISS | 1 | 0.8% |
| **total** | **129** | |

| category | EXACT | NEAR | CLUSTER | WRONG | MISS | n |
|---|---|---|---|---|---|---|
| block | 1 | 15 | 0 | 19 | 1 | 36 |
| landmark-in-locality | 6 | 21 | 1 | 2 | 0 | 30 |
| village | 2 | 21 | 0 | 14 | 0 | 37 |
| hospital/school anchor | 13 | 2 | 3 | 8 | 0 | 26 |

Top-hit `match` types: `token-prefix` 56, `exact-prefix` 29, `category` 18, `other` 16,
`area` 8, **`live osm` 1** (new on :265 — live OSM fallback path; it landed an EXACT:
`springdales school dhaula kuan` → 31 m). Of the 16 `other` top hits, 13 are WRONG —
`other` is effectively the garbage path.

**Ranking penalty**: in 49/129 queries a rank-1/2 row is >150 m closer to ground truth
than the top hit. Same signature as sweep 1 — presence is decent, ordering is the loss.

## Full WRONG list (43)

| query | top hit | gtd | defect |
|---|---|---|---|
| c block ashok nagar shahdara | C Block Park | 2297m | other locality's block park |
| g block sangam vihar | G Block Park | 4879m | other locality's block park |
| pocket b mayur vihar | Mayur vihar phase-2 pocket-B (pankaj arcade) | 1615m | wrong phase |
| pocket 1 jasola vihar | Pocket 1 | 7169m | mis-coord block row |
| pocket b dilshad garden | Pocket - B | 9550m | mis-coord block row |
| d block saket | Saket D Block | 1941m | mis-coord block row |
| e block rohini sector 11 | Rohini Sector 11 | 3884m | sector row at wrong coords |
| e2 block rohini sector 7 | E2- Block | 27689m | mis-coord block row (28km) |
| c-2 block janakpuri | c block park 2 | 18433m | mis-coord park row |
| m block greater kailash 2 | 2 Block M, Greater Kailash | 2956m | names GK, sits 3km off |
| a1 block paschim vihar | A1 | 14028m | degenerate-name row |
| b4 block rajouri garden | B4 Market Paschim Vihar | 2650m | Paschim Vihar's B4, not Rajouri |
| a block swasthya vihar | A Block | 9656m | degenerate block row |
| b block laxmi nagar | B Block | 5099m | degenerate block row |
| c block pandav nagar | C-Block | 6713m | degenerate block row |
| e block malviya nagar | E-Block | 10384m | degenerate block row |
| b block pitampura | B Block | 11155m | degenerate block row |
| d block ashok vihar phase 1 | Block D 1 | 13666m | degenerate block row |
| e block kalkaji | E-Block | 10522m | degenerate block row |
| satya niketan market | Beguz Zaidi Market Moti Bagh | 1969m | different market 2km off |
| khel gaon marg | Khel Gaon. Sport Complex, Delhi | 7048m | mis-coord sports-complex row |
| devli | Devli (village) | 30688m | **same far-artifact as sweep 1 — persists on :265** |
| nitri village | Badkhal village | 19686m | Faridabad villages, no Nithari |
| kotla mubarakpur village | Kotla Village | 8573m | different village |
| zamrudpur village | Garhi Village | 3799m | different village |
| masjid moth village | Masjid Hazrat Aaisha Lil Banat | 22464m | unrelated masjid 22km |
| pilanji village | Madhavpuram Village | 5820m | different village; Pilanji dup at rank2 also 5km off |
| lado sarai village | Village Arts | 1614m | unrelated entity |
| aya nagar village | Aya Nagar (city/place/locality) | 7658m | all 3 rows same-name at one wrong point 7km west — bad-coord batch signature |
| asola village | Asola Fatehpur Beri Village | 4083m | different (Asola-FB gym) |
| jaitpur village | Jaitpur Village | 2688m | mis-coord named row |
| najafgarh village | Hastsal Village | 7365m | different village |
| mukundpur village | Kanawani Village - गांव कनावनी | 23091m | Ghaziabad village |
| bawana village | Dariyapur Village | 3143m | different village |
| jagatpur village | Mother Dairy Village Wazirabad | 2935m | different village |
| sitaram diwan chand paharganj | Diwan Shree Apartments | 2869m | token-prefix on "diwan"/"chand" — famous eatery absent (was MISS on sweep 1, now WRONG) |
| gtb hospital dilshad garden | Jain Hospital | 676m | different hospital ~700m; GTB absent |
| batra hospital tughlakabad | Batra Hospital | 3531m | all 3 Batra rows 1.9–3.5km off — mis-geocoded batch |
| max pitampura | Max (shopping mall) | 621m | brand collision: Max Fashion stores; hospital absent |
| ram manohar lohia hospital | Ramणीय | 10218m | corrupted-name row 10km off |
| dps vasant kunj | DPS Global Vasant Kunj DL | 2786m | different school (DPS Global ≠ DPS VK) |
| dps mathura road | DPS Mathura Road | 6465m | named row 6.5km off |
| sardar patel vidyalaya lodhi | Sardar Textiles | 8401m | token match on "sardar" |

**MISS (1):** `a2 block rohini sector 15` — zero results.

## CLUSTER list (4)

| query | top-3 | note |
|---|---|---|
| nehru park chanakyapuri | Nehru Park Chanakyapuri New Delhi (6283m) / Nehru Park (294m) / Nehru Park (4716m) | named-dup scatter; correct park sits at rank 1 |
| moolchand hospital | Moolchand Hospital (809m) / Moolchand Hospital (247m) / Moolchand Kharaiti Ram (336m) | dup rows at 2 coords; better at rank 1 |
| fortis shalimar bagh | Fortis SB (989m) / Fortis Blood Bank SB (980m) / Fortis SB New Delhi (316m) | 3 Fortis rows, best at rank 2 |
| dps rk puram | Dps Rk Puram (1026m) / DPS RK Puram New Delhi (5256m) / Hostel DPS R.K. Puram (1327m) | real + far dup + hostel mixed |

## Comparison vs sweep 1 (probe of same endpoint, earlier build)

- **Blocks still die**: sweep-1 had 0/5 EXACT on block queries; sweep-2 has 1/36 EXACT,
  19/36 WRONG — block tokens remain effectively unindexed; rows named "B Block"/"A1"/"C-Block"
  with no locality binding dominate and land 5–28km off.
- `sant nagar burari` improved: sweep-1 MISS (far rows only) → sweep-2 NEAR (Burari-side
  `Kids Shell Sant Nagar` + `Sant nagar` rows now surface, ~800m–1km).
- `devli` unchanged: the 30.7km-outside-Delhi `Devli` village dup still wins rank 0.
- `sitaram diwan chand paharganj` still dead: sweep-1 MISS → sweep-2 WRONG
  (Diwan-named unrelated entities).
- `hanuman mandir shahdara` slightly worse: sweep-1 EXACT (`Hanuman Mandir` at rank 0) →
  sweep-2 NEAR (`Shri Kamla Devi Shri Krishn Mandir` 121m wins; real Hanuman Mandir at rank 1, 6m).
- Anchor coverage is strong when names are distinctive: hospitals/schools went 13/26 EXACT
  (SGRH 108m, Max Patparganj 7m, Lok Nayak 112m, AIIMS Trauma via new `live osm`-adjacent rows,
  Springdales/Sanskriti/Holy Family all landed once GT was corrected — the index resolves them
  fine at their real coords).
- `match=other` rows now surface as top hits (16) — in sweep 1 they were rare; 13/16 are WRONG.
- Station renames handled: `udyog bhawan metro` returns the renamed `Seva Teerth` station rows
  AND the legacy `Udyog Bhawan metro station` row (rank 2, 103m) → EXACT.
- Brand-name collisions hurt: `Max` (fashion) beats Max Hospital at Pitampura; `DPS` returns
  wrong DPS branches; `Max`/`A1`/`B Block` degenerate names are a recurring wrong-top pattern.

## Deepest resolves this sweep (proof of depth)

- `Springdales School` + `Springdales School Dhaula Kuan` rows at ~911–922m via new match paths
- `Polo Guest House ... Near Indraprastha Apollo` — a Sarita Vihar hotel found by Apollo proximity
- `Wazirabad Village-Block A` — village + block row (1.6km)
- `Jhuggi No. 142 Vishwanath Puri Village Bhalswa` — jhuggi-number-level addresses inside Bhalswa
- `Delhi State Cooperative Bank Devli Village Branch` — a branch inside Devli village (top hit for 'devli village')
- `Setu School, Shiv Mandir Gali Village Nithari Noida` — a school on a named gali in Nithari
- gate-level metro rows again: `Jor Bagh (Elevator)`, `Jor Bagh Metro Gate No. 1`,
  `Lok Kalyan Marg Metro Gate No. 2`, `Seva Teerth Metro Gate Number 1`
- `NBCC's AIIMS Trauma Center Phase II` + `Out Patient Department Jpn Apex Trauma Center`
- `Two Wheeler Parking-Lok Nayak Hospital-Gate No 2`
- `Sbv J Block Sangam Vihar` — the actual J-block row inside Sangam Vihar

## Which forms die hardest (this sweep)

1. **Named blocks** — worst category again: 1 EXACT / 36. Rows like `B Block`, `A1`, `C-Block`,
   `E2- Block` have no locality binding and land arbitrarily 5–28km off. When a locality-bound
   block row exists (`Saket H Block`, `Sbv J Block Sangam Vihar`, `Jhilmil Colony Block A`) it wins → NEAR.
2. **Village disambiguation** — 14 WRONG of 37: adjacent/different villages win over the target
   (Kotla vs Kotla Mubarakpur, Garhi vs Zamrudpur, Hastsal vs Najafgarh, Kanawani vs Mukundpur);
   plus outside-Delhi artifacts (Devli, Aya Nagar batch, Mukundpur→Kanawani).
3. **Market names** — small markets resolve to the *nearest* named market ~1–2km off
   (Satya Niketan→Moti Bagh market WRONG; Anand Niketan→Shanti Niketan DDA NEAR).
4. **Short brand names** — `Max`, `DPS` collide across branches/brands.
5. Strongest: **hospitals/schools by full name** (13 EXACT) and **metro stations** (mostly
   EXACT/NEAR including gate-level rows).

## Notes for build lane (deltas from :262/263→:265)

- `live osm` match type exists and lands real hits — new fallback path in the pipeline.
- `match=other` is now a common top-hit type and is correlated with WRONG (13/16) — worth
  checking what produces it (looks like the residual/degenerate-token path).
- Same-name dup scatter (CLUSTER class) is a real pattern on hospitals: Moolchand (2 coords),
  Fortis SB (3 rows), DPS RKP, Nehru Park — dedupe/ranking fix converts 4 clusters + several
  NEARs to EXACT.
- Degenerate-name rows (`A1`, `B Block`, `1`, `2`, `Gate 2` etc.) need a name-quality floor —
  they're 11 of 19 block-category WRONGs.
- `Ramणीय` — a corrupted/mixed-script name row wins `ram manohar lohia hospital` at 10km off —
  index has mojibake rows.

### Appendix — all 129 queries (top-3 rows, GT distance)

| query | cat | verdict | rank0 | rank1 | rank2 |
|---|---|---|---|---|---|
| c block ashok nagar shahdara | block | WRONG | C Block Park (park, 2297m) | Ashok Nagar (locality, 18339m) | Ashok Nagar (neighborhood, 18572m) |
| f block ashok nagar shahdara | block | NEAR | Brahma Kumaris New Delhi Shahdara Ashok Nagar (wellness_service, 1415m) | Ashok Nagar (locality, 18762m) | Ashok Nagar (neighborhood, 18995m) |
| g block sangam vihar | block | WRONG | G Block Park (park, 4879m) | G Block (retail, 15162m) | G Block (city_block, 12567m) |
| j block sangam vihar | block | NEAR | Sbv J Block Sangam Vihar (place_of_learning, 964m) | J Block (city_block, 12061m) | J block (building, 20039m) |
| pocket b mayur vihar | block | WRONG | Mayur vihar phase-2 pocket-B 2nd floor pankaj  (restaurant, 1615m) | A14,B14,C14,D14 Block Pocket B, Mayur Vihar 2 (addr:address, 1519m) | RWA Pocket B-3 Mayur Vihar Phase III (social_or_community_service, 3677m) |
| pocket 4 mayur vihar phase 1 | block | NEAR | Pocket - 4, Mayur Vihar Phase 1 (neighborhood, 644m) | Pocket 4 (locality, 664m) | Pocket-4 School Road (residential, 225m) |
| pocket 1 jasola vihar | block | WRONG | Pocket 1 (locality, 7169m) | Pocket-1 (locality, 21388m) | Pocket - 4, Mayur Vihar Phase 1 (neighborhood, 6499m) |
| pocket c sarita vihar | block | NEAR | Pocket C Sarita Vihar Park (park, 709m) | Sarita Vihar Pocket C (residential, 616m) | Sarita Vihar C-Pocket Temple (religious_organization, 566m) |
| pocket d okhla phase 2 | block | NEAR | 27 Okhla Phase 2 (address, 1477m) | Mayur vihar phase-2 pocket-B 2nd floor pankaj  (restaurant, 10362m) | Sector D Pocket 2 (named, 10240m) |
| a block dilshad garden | block | NEAR | A-Block Dilshad Garden (lodging, 643m) | A Block (building, 11148m) | A-Block (retail, 11208m) |
| pocket b dilshad garden | block | WRONG | Pocket - B (residential, 9550m) | Pocket B (residential, 6892m) | Pocket B (neighborhood, 14369m) |
| d block saket | block | WRONG | Saket D Block (construction, 1941m) | D-Block (retail, 12729m) | D Block (neighborhood, 15497m) |
| h block saket | block | NEAR | Saket H Block (proposed, 468m) | H block Saket (historic_site, 376m) | H-Block (retail, 12888m) |
| j block saket | block | EXACT | J-98 J Block Saket (address, 97m) | Saket, J Block (bus_stop, 482m) | Saket, J Block (platform, 139m) |
| e block rohini sector 11 | block | WRONG | Rohini Sector 11 (platform, 3884m) | E-25A Block E, Gali #11 (addr:address, 6249m) | — |
| a2 block rohini sector 15 | block | MISS | — | — | — |
| e2 block rohini sector 7 | block | WRONG | E2- Block (university, 27689m) | Sector E2 (community_and_government, 18371m) | E2-1 (housename, 23272m) |
| b block janakpuri | block | NEAR | Delhi - Janakpuri Block B-1 Branch ATM (atm, 964m) | B Block (building, 14242m) | B-Block (retail, 13999m) |
| c-2 block janakpuri | block | WRONG | c block park 2 (park, 18433m) | C-2 Block (locality, 405m) | C-2 (residential, 503m) |
| c block vasant kunj | block | NEAR | Apollo Pharmacy Vasant Kunj C Block (pharmacy_and_drug_store, 1097m) | C-Block (retail, 13247m) | C Block (apartments, 16840m) |
| d block defence colony | block | NEAR | ICICI Bank New Delhi Defence Colony D Block (bank_or_credit_union, 918m) | 140 Block D, Defence Colony (addr:address, 1021m) | D-Block (retail, 6702m) |
| r block greater kailash 1 | block | NEAR | OYO Premium 189 GK 1 R Block (resort, 788m) | Kanchan Photography C R Park & G K 1 M Block M (professional_service, 1950m) | K.R. Mangalam World School Greater Kailash-1 (high_school, 764m) |
| m block greater kailash 2 | block | WRONG | 2 Block M, Greater Kailash (addr:address, 2956m) | 2 Block M (address, 2992m) | G.k-2 M Block Market (food_and_beverage_store, 957m) |
| a1 block paschim vihar | block | WRONG | A1 (residential, 14028m) | A1-A14 (apartments, 25710m) | A1 (apartments, 26872m) |
| b4 block rajouri garden | block | WRONG | B4 Market Paschim Vihar (books_music_and_video_store, 2650m) | B4 (apartments, 27616m) | B4 road (tertiary, 8659m) |
| a block swasthya vihar | block | WRONG | A Block (building, 9656m) | A-Block (retail, 9850m) | A BLOCK (residential, 18881m) |
| b block laxmi nagar | block | WRONG | B Block (building, 5099m) | B-Block (retail, 5401m) | B Block (residential, 6414m) |
| c block pandav nagar | block | WRONG | C-Block (retail, 6713m) | C Block (apartments, 2958m) | C Block (residential, 7733m) |
| f block lajpat nagar 2 | block | NEAR | F-2 Block (university, 8650m) | F Block Pocket 2 Park (park, 23020m) | Lajpat Nagar (locality, 1488m) |
| e block malviya nagar | block | WRONG | E-Block (retail, 10384m) | E Block (apartments, 13944m) | E block (building, 18432m) |
| c block mansarovar garden | block | NEAR | Gurudwara C Block Mansarovar Garden (place_of_worship, 2194m) | C-Block (retail, 10593m) | C Block (apartments, 17927m) |
| b block pitampura | block | WRONG | B Block (building, 11155m) | B-Block (retail, 10465m) | B Block (apartments, 17206m) |
| d block ashok vihar phase 1 | block | WRONG | Block D 1 (residential, 13666m) | D-1/D Ashoka Road (address, 3199m) | 64 Block D-1 (address, 6598m) |
| g block shalimar bagh | block | NEAR | Shalimar Bagh (platform, 971m) | G Block (quarter, 2412m) | G Block (retail, 10120m) |
| e block kalkaji | block | WRONG | E-Block (retail, 10522m) | E Block (apartments, 10986m) | E Block (apartments, 3915m) |
| a block jhilmil colony | block | NEAR | Jhilmil Colony Block A (block, 837m) | A Block (building, 10475m) | A-Block (retail, 10535m) |
| hanuman mandir shahdara | ll | NEAR | Shri Kamla Devi Shri Krishn Mandir (hindu_place_of_worship, 121m) | Hanuman Mandir (hindu_place_of_worship, 6m) | Shree Radha Krishna Mandir (lodging, 241m) |
| iskcon east of kailash | ll | NEAR | OYO Rooms East of Kailash ISKCON (hotel, 928m) | ISKCON East Delhi (hindu_place_of_worship, 10594m) | Iskcon Temple, Kailash Colony (hindu_place_of_worship, 5165m) |
| bengali market mandi house | ll | NEAR | Bengali Market (building, 887m) | Safal (greengrocer, 77m) | Brij Fruit Mart (greengrocer, 285m) |
| moolchand metro | ll | EXACT | Moolchand metro station (metro, 25m) | Moolchand (restaurant, 2319m) | Moolchand Hospital (hospital, 294m) |
| rajiv chowk | ll | EXACT | Rajiv Chowk, New Delhi (train_station, 8m) | Rajiv Chowk metro station (metro, 8m) | Rajiv Chowk Central Park (attraction, 4m) |
| anand vihar isbt | ll | NEAR | Anand Vihar (monitoring_station, 954m) | Anand Vihar (macrohood, 738m) | Anand Vihar (administrative, 977m) |
| meherchand market lodhi colony | ll | EXACT | Meharchand Market (place, 305m) | Altitude store (greengrocer, 411m) | Blue Tokai Coffee Roasters | Mehar Chand Marke (coffee_shop, 422m) |
| khanna market lodhi colony | ll | NEAR | Khanna Market, Lodhi Colony (shopping_mall, 794m) | Khanna Market (retail, 677m) | New Khanna Market (retail, 1007m) |
| dhaula kuan bus stop | ll | NEAR | Sardar Patel Marg (platform, 339m) | Atma Ram Sanatan Dharma College (platform, 488m) | Dhaula Kuan (platform, 636m) |
| ashram chowk | ll | NEAR | Ashram (locality, 691m) | Ashram (station, 600m) | Ashram (platform, 671m) |
| tilak bridge railway station | ll | NEAR | Tilak Bridge railway station (train_station, 771m) | Tilak Bridge (station, 693m) | Tilak Bridge (bridge, 1094m) |
| shivaji stadium metro | ll | NEAR | Metro Trip (fast_food, 908m) | Shivaji Stadium metro station (metro, 143m) | Shivaji Stadium (station, 127m) |
| mandi house metro | ll | EXACT | Mandi House metro station (metro, 97m) | Mandi House (place, 180m) | Mandi House Metro Station Gate Number 2 (subway_entrance, 73m) |
| barakhamba road metro | ll | EXACT | Barakhamba Road metro station (train_station, 81m) | Barakhamba Road (secondary, 705m) | Barakhamba Road (street, 273m) |
| jor bagh metro | ll | NEAR | Jor Bagh Bus Stop (public_transit_facility_or_service, 340m) | Jor Bagh (Elevator) (subway_entrance, 301m) | Jor Bagh Metro Gate No. 1 (subway_entrance, 278m) |
| bhikaji cama place metro | ll | NEAR | EUMEC Private Limited (public_transit_facility_or_service, 217m) | Hub And Oak Coworking - BCP (public_transit_facility_or_service, 217m) | Metro Food Bazaar (convenience_store, 480m) |
| udyog bhawan metro | ll | EXACT | Seva Teerth Metro Station Gate Number 1 (subway_entrance, 91m) | Seva Teerth metro station (metro, 81m) | Udyog Bhawan metro station (travel_and_transportation, 103m) |
| lok kalyan marg metro | ll | NEAR | Lok Kalyan Marg (secondary, 159m) | 1 Lok Kalyan Marg (address, 419m) | Lok Kalyan Marg Metro Gate No. 2 (subway_entrance, 921m) |
| nanakpura gurudwara | ll | NEAR | Gurudwara Moti Bagh Sahib (place_of_worship, 1441m) | Moti Bagh Gurudwara Nanakpura (platform, 1309m) | Shahi Masjid (place_of_worship, 2365m) |
| moti bagh gurudwara | ll | NEAR | Moti Bagh (locality, 746m) | Moti Bagh (place, 1005m) | Sheetal Mata Mandir (place_of_worship, 1233m) |
| teen murti bhavan | ll | NEAR | Teen Murti (locality, 433m) | Teen Murti Marg (secondary, 347m) | Teen Murti Lane (residential, 387m) |
| nehru park chanakyapuri | ll | CLUSTER | Nehru Park Chanakyapuri New Delhi (park, 6283m) | Nehru Park (park, 294m) | Nehru Park (park, 4716m) |
| malcha marg market | ll | NEAR | Malcha Marg Market (retail, 711m) | Safal (greengrocer, 1633m) | South Avenue Market-New Delhi (shopping_mall, 1732m) |
| satya niketan market | ll | WRONG | Beguz Zaidi Market Moti Bagh south facing (marketplace, 1969m) | Begum Zaidi Market Moti Bagh - North Facing (marketplace, 2014m) | South Moti Bagh Market (food_and_beverage_store, 1050m) |
| rk puram sector 12 market | ll | NEAR | Vivekanand Market (supermarket, 799m) | Mohan Singh Market (platform, 426m) | Mini Market Sector 12-R. K. Puram (shopping_mall, 1255m) |
| anand niketan market | ll | NEAR | Shanti Niketan DDA Market (shopping_mall, 783m) | South Moti Bagh Market (food_and_beverage_store, 1095m) | Collection O 30075 South City-1 Market (resort, 1046m) |
| panchsheel enclave market | ll | NEAR | Safal Store (greengrocer, 189m) | 16 GK 1 Market (address, 1048m) | 16 Block M, GK 1 Market (addr:address, 1048m) |
| khel gaon marg | ll | WRONG | Khel Gaon. Sport Complex, Delhi (sports_and_recreation, 7048m) | Dabri Gaon Khel Parisar (recreation_ground, 18194m) | Khel Gaon Residence Welfare Association (senior_living_facility, 3833m) |
| nauroji nagar market | ll | NEAR | Ring Road Market (shopping_mall, 1764m) | Nauroji Nagar Market (food_and_beverage_store, 1645m) | Pottery Market (arts_crafts_and_hobby_store, 2160m) |
| sarai kale khan village | ll | NEAR | Manopali Village (government_office, 877m) | Khelgaon Village (sports_and_recreation, 713m) | Garhi Village (platform, 2582m) |
| devli | village | WRONG | Devli (village, 30688m) | Devli Road (tertiary, 1821m) | Devli Road (tertiary, 1341m) |
| devli village | village | NEAR | Delhi State Cooperative Bank Devli Village Bra (bank_or_credit_union, 1258m) | Devli (village, 30688m) | Devli (farm, 30599m) |
| khirki | village | NEAR | Khirki (neighborhood, 853m) | Khirki Masjid (mosque, 915m) | Khirki Extension (place, 947m) |
| khirki village | village | NEAR | Khirki village (historic_site, 977m) | Khirki Village Road (residential, 598m) | Khirki Village Choupal (assembly_point, 904m) |
| sant nagar burari | village | NEAR | Kids Shell Sant Nagar (home_service, 756m) | Sant nagar (lodging, 2122m) | Sant Nagar (locality, 22797m) |
| nitri village | village | WRONG | Badkhal village (locality, 19686m) | Badkhal village (neighbourhood, 19672m) | Bhankri village (village, 21883m) |
| nithari village noida | village | NEAR | Setu School, Shiv Mandir Gali Village Nithari  (place_of_learning, 2467m) | Nithari Village (village, 0m) | Nithari Village (city, 31374m) |
| chhattarpur village | village | NEAR | Chhatarpur Village (hindu_place_of_worship, 756m) | Chhattarpur (macrohood, 461m) | Chhatarpur (station, 399m) |
| khajuri khas village | village | NEAR | Khajuri Khas Village (arts_and_entertainment, 1870m) | Gamri Village (neighborhood, 2510m) | BOA Village (restaurant, 6012m) |
| karawal nagar village | village | NEAR | CMS Shastri Gali, Kranti Krishan Chowk, Karawa (hindu_place_of_worship, 1427m) | Gamri Village (neighborhood, 4710m) | BOA Village (restaurant, 7961m) |
| katwaria sarai village | village | NEAR | Madhavpuram Village (neighborhood, 2934m) | Hauz Khas Village (commercial, 1977m) | Katwaria Sarai (village, 1052m) |
| shahpur jat village | village | NEAR | Asiad Village (historic_site, 407m) | Asian Games Village (locality, 454m) | Asian Games Village (locality, 593m) |
| kotla mubarakpur village | village | WRONG | Kotla Village (arts_and_entertainment, 8573m) | Manopali Village (government_office, 3491m) | Khelgaon Village (sports_and_recreation, 2580m) |
| zamrudpur village | village | WRONG | Garhi Village (hindu_place_of_worship, 3799m) | Garhi Village (platform, 4082m) | Downtown Village (lounge, 4624m) |
| begumpur village malviya nagar | village | NEAR | Khirki village (historic_site, 1650m) | Khirki Village Road (residential, 1634m) | Khirki Village Choupal (assembly_point, 1459m) |
| masjid moth village | village | WRONG | Masjid Hazrat Aaisha Lil Banat (muslim_place_of_worship, 22464m) | Al-Mubina Masjid (muslim_place_of_worship, 22283m) | Ameena Masjid (muslim_place_of_worship, 23088m) |
| sheikh sarai village | village | NEAR | Khirki village (historic_site, 1150m) | Khirki Village Road (residential, 1062m) | Khirki Village Choupal (assembly_point, 1307m) |
| pilanji village | village | WRONG | Madhavpuram Village (neighborhood, 5820m) | The Village Basket (convenience, 5252m) | Old Pillanji Village (village, 5084m) |
| lado sarai village | village | WRONG | Village Arts (art_gallery, 1614m) | Liberty Village (amenity, 508m) | Khirki Village (platform, 1811m) |
| kishangarh village | village | EXACT | Kishangarh Village (village, 353m) | Kishangarh (place, 197m) | Kishangarh (construction, 111m) |
| mehrauli village | village | NEAR | Domino's Pizza | Village- Mehrauli, Tehsil- Ha (restaurant, 135m) | Mehrauli (locality, 766m) | Mehrauli (construction, 246m) |
| aya nagar village | village | WRONG | Aya Nagar (city, 7658m) | Aya Nagar (place, 6996m) | Aya Nagar (locality, 7054m) |
| fatehpur beri village | village | NEAR | Asola Fatehpur Beri Village (gym, 601m) | PHC, Fatehpur Beri (centre, 4m) | Satbari Village (platform, 2377m) |
| asola village | village | WRONG | Asola Fatehpur Beri Village (gym, 4083m) | Satbari Village (platform, 2718m) | Pali village (village, 9285m) |
| jaitpur village | village | WRONG | Jaitpur Village (arts_and_entertainment, 2688m) | molarband village park (park, 1183m) | Ali Village (lodging, 2208m) |
| mitraon village | village | EXACT | Mitraon Village (lodging, 1915m) | Mitraon Village (campground, 6m) | Mitraon (locality, 307m) |
| najafgarh village | village | WRONG | Hastsal Village (neighborhood, 7365m) | Baprola Village Street (living_street, 4347m) | Bindapur Village (neighborhood, 8041m) |
| haiderpur village | village | NEAR | Haiderpur Village (station, 844m) | Haiderpur Village metro station (metro, 787m) | Haiderpur Village Bus Stop (public_transit_facility_or_service, 728m) |
| shalimar village | village | NEAR | Shalimar village house no 40 (historic_site, 1508m) | Sahipur Village (residential, 943m) | Haiderpur Village (station, 2354m) |
| burari village | village | NEAR | Burari Village (hindu_place_of_worship, 1380m) | Burari (locality, 911m) | Burari (political, 793m) |
| mukundpur village | village | WRONG | Kanawani Village - गांव कनावनी (lodging, 23091m) | Rasoolpur Village (platform, 23734m) | Mamura Village (platform, 24809m) |
| bawana village | village | WRONG | Dariyapur Village (platform, 3143m) | Katewara Village (named, 6051m) | Jhinjoli Village (locality, 6529m) |
| nangloi village | village | NEAR | Nangloi (political, 1301m) | Nangloi (locality, 598m) | Nangloi (macrohood, 300m) |
| bhalswa village | village | NEAR | Bhalswa Village (stadium_arena, 587m) | Jhuggi No. 142 Vishwanath Puri Village Bhalswa (address, 904m) | Jhuggi No. 188 Kalander Colony Village Bhalswa (address, 914m) |
| alipur village | village | NEAR | Dayal Market Ali Pur Village Bus Stop (public_transit_facility_or_service, 603m) | Singhola Village (locality, 5502m) | Hamidpur Village (arts_and_entertainment, 3577m) |
| wazirabad village | village | NEAR | Wazirabad Village-Block A (arts_and_entertainment, 1645m) | Mother Dairy Village Wazirabad (dairy, 2038m) | BOA Village (restaurant, 7030m) |
| jagatpur village | village | WRONG | Mother Dairy Village Wazirabad (dairy, 2935m) | Jheemar Village (neighborhood, 2587m) | BOA Village (restaurant, 6860m) |
| sitaram diwan chand paharganj | anchor | WRONG | Diwan Shree Apartments (apartments, 2869m) | Diwan-i-Am (building, 3304m) | Diwan Saheb (fashion_and_apparel_store, 2023m) |
| max saket | anchor | NEAR | Max (clothes, 1059m) | Max Healthcare (hospital, 229m) | Max Super Speciality Hospital, Saket (Max Sake (hospital, 61m) |
| apollo sarita vihar | anchor | NEAR | Polo Guest House Sarita Vihar New Delhi Near I (hotel, 1209m) | Apollo Hospital Blood Bank, Srita Vihar (blood_bank, 480m) | Apollo Pharmacy Preet Vihar (pharmacy_and_drug_store, 11437m) |
| gtb hospital dilshad garden | anchor | WRONG | Jain Hospital (diagnostics_imaging_or_lab_service, 676m) | Dr Garg ENT Clinic (specialized_health_care, 428m) | Stanley Browne Research (hospital, 724m) |
| holy family hospital okhla | anchor | EXACT | Holy Family Hospital (hospital, 117m) | Dr. Biren Nadkarni - Best Knee, Hip & Joint Re (specialized_health_care, 120m) | Dr. Ashish Gupta - Best Neurosurgeon | Fortis  (specialized_health_care, 80m) |
| moolchand hospital | anchor | CLUSTER | Moolchand Hospital (hospital, 809m) | Moolchand Hospital (hospital, 247m) | Moolchand Kharaiti Ram Hospital (hospital, 336m) |
| sir ganga ram hospital | anchor | EXACT | Sir Ganga Ram Hospital (hospital, 108m) | Sir Ganga Ram Hospital (hospital, 1281m) | Sir Ganga Ram Hospital Marg (tertiary, 469m) |
| batra hospital tughlakabad | anchor | WRONG | Batra Hospital (hospital, 3531m) | Batra Hospital (hospital, 2060m) | Batra Hospital (platform, 1950m) |
| fortis shalimar bagh | anchor | CLUSTER | Fortis Hospital Shalimar Bagh (hospital, 989m) | Fortis Hospital Blood Bank, Shalimar Bagh (blood_bank, 980m) | Fortis Hospital Shalimar Bagh New Delhi (hospital, 316m) |
| fortis vasant kunj | anchor | EXACT | Fortis Hospital (hospital, 181m) | Fortis Flt Lt Rajan Dhall Hospital (hospital, 196m) | Dr. Shubham Jain | Fortis Hospital Vasant Kunj (medical_service, 211m) |
| max pitampura | anchor | WRONG | Max (shopping_mall, 621m) | Max (shop:clothes, 3042m) | Max (shopping_mall, 1796m) |
| max patparganj | anchor | EXACT | Max Super Speciality Hospital, Patparganj (hospital, 7m) | Max Lab - Patparganj (diagnostics_imaging_or_lab_service, 848m) | Max Institute of Cancer Care, Patparganj (hospital, 895m) |
| venkateshwar hospital dwarka | anchor | EXACT | Venkateshwar Super Speciality Hospital Dwarka (hospital, 1m) | Venkateshwar International School (place_of_learning, 2006m) | Sri Venkateshwar International School (high_school, 1272m) |
| rajiv gandhi cancer institute rohini | anchor | EXACT | Rajiv Gandhi Cancer Hospital (platform, 705m) | Rajiv Gandhi Cancer Institute and Research Cen (college, 756m) | Rajiv Gandhi Institute for Contemporary Studie (research_institute, 16008m) |
| aiims trauma center | anchor | EXACT | AIIMS trauma center (hospital, 25m) | Out Patient Department Jpn Apex Trauma Center  (emergency_department, 34m) | NBCC's AIIMS Trauma Center Phase II (hospital, 345m) |
| ram manohar lohia hospital | anchor | WRONG | Ramणीय (fashion_and_apparel_store, 10218m) | Savitri Hospital (hospital, 8471m) | Kuber Hospital (hospital, 9542m) |
| lok nayak hospital | anchor | EXACT | Lok Nayak Hospital (hospital, 112m) | Lok Nayak Jai Prakash Narayan Hospital (hospital, 629m) | Two Wheeler Parking-Lok Nayak Hospital-Gate No (hospital, 59m) |
| springdales school dhaula kuan | anchor | EXACT | Springdales School (school, 31m) | Springdales School Dhaula Kuan (place_of_learning, 33m) | Springdales School, Pusa Road (school, 7177m) |
| modern school barakhamba | anchor | EXACT | Modern School Barakhamba (school, 336m) | Modern School (place_of_learning, 478m) | Modern School (amenity:school, 11175m) |
| dps rk puram | anchor | CLUSTER | Dps Rk Puram (college_university, 1026m) | DPS RK Puram, New Delhi (high_school, 5256m) | Hostel, DPS R.K. Puram (lodging, 1327m) |
| dps vasant kunj | anchor | WRONG | DPS Global Vasant Kunj DL (preschool, 2786m) | DPS, Vasant Vihar (place_of_learning, 2717m) | DPS International School (school, 3559m) |
| dps mathura road | anchor | WRONG | DPS Mathura Road (place_of_learning, 6465m) | DPS Junior (home_service, 2189m) | Junior DPS (preschool, 2698m) |
| sardar patel vidyalaya lodhi | anchor | WRONG | Sardar Textiles (arts_crafts_and_hobby_store, 8401m) | Sardar Vallabhbhai Patel Hospital (hospital, 8841m) | Sardar Vallabh Bhai Patel Hospital (hospital, 8832m) |
| sanskriti school chanakyapuri | anchor | EXACT | Sanskriti School (school, 15m) | Sanskriti School Main Gate (gate, 32m) | Aashai School of Music & Dance (specialty_school, 12517m) |
| mothers international school hauz khas | anchor | EXACT | The Mother's International School (school, 331m) | Mother's International School (school, 283m) | Takshila Institute | IIT JEE, NEET Classes Kal (tutoring_service, 271m) |
| st columbas school | anchor | EXACT | Saint Columba's School (school, 83m) | St. Columba's School, Delhi (school, 149m) | St. Columbus School (building:school, 17584m) |
