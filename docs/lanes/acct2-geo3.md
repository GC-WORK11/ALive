# acct2 geo sweep-3 — prod :267 (n=149)

Probe: `/v2/search?q=…&lat=28.63&lon=77.24`. Verdict per query: does top-3 make geographic
sense (right locality, not a far same-name sink)? EXACT = top hit is intended place
(gtd ≤ ~500m of ground truth); NEAR = right locality / intended row in top-3 but not top;
CLUSTER = 3 same-name rows at conflicting coords; WRONG = confident wrong top hit;
MISS = empty. Distances are to pinned ground truth (GT corrections applied where my pins
were wrong — aqua-line stations, GN stations, see "GT notes").

## Tally

| class | n | % |
|---|---|---|
| EXACT | 51 | 34.2% |
| NEAR | 40 | 26.8% |
| CLUSTER | 3 | 2.0% |
| WRONG | 54 | 36.2% |
| MISS | 1 | 0.7% |

| category | n | EXACT | NEAR | CLUSTER | WRONG | MISS |
|---|---|---|---|---|---|---|
| govinda set | 3 | 0 | 2 | 0 | 0 | 1 |
| NCR metro | 67 | 32 | 18 | 0 | 17 | 0 |
| deep-locality worship | 28 | 2 | 4 | 0 | 22 | 0 |
| terminals/rail/bus | 28 | 12 | 8 | 1 | 7 | 0 |
| NCR schools/hosp/colonies | 23 | 5 | 8 | 2 | 8 | 0 |

## (a) Govinda set re-verify

| q | verdict | top-3 |
|---|---|---|
| pawan bakery c block hanuman mandir ashok nagar shahdara | NEAR | 'Amar Bakery' (cake_shop, GT 1284m) top; 'Bharat Bazaar' + 'Goyal Store' — locality held, no bakery-name index |
| iskcon east of kailash | NEAR | ISKCON-area rows land in East of Kailash; temple itself not the top row |
| neelanchal dham sant nagar | MISS (empty) | index gap — noted, not flagged per coordinator |

`pawan bakery` is a big improvement vs :262 (was garbage/confectionery chains); the
gazupdate refresh landed a real Shahdara bakery ('Amar Bakery') ~1.3km from the bakery
cluster near C-block Hanuman Mandir. `iskcon` now parks in the right locality. `neelanchal
dham` still absent from the index entirely.

## (b) NCR metro by name — the strong category

- **Aqua line essentially complete**: 76/83/101/137/142/144/145/146/147/148 + Delta-1
  all EXACT at real expressway-alignment coords (my earlier pins were off — corrected
  in GT). `gnida office` is the one bad one: top = guest house 6.2km, plus the `ITO
  metro station` artifact at 32.6km (see artifacts). `alpha 1`/`pari chowk` NEAR via
  station-adjacent POIs.
- **Violet Faridabad complete**: escorts mujesar, mewla maharajpur, nhpc chowk, sant
  surdas sihi, raja nahar singh all EXACT at real coords. `bata chowk`/`old faridabad`/
  `badkhal mor` NEAR (station rows 700-900m). `neelam chowk ajronda` WRONG ('Brake Test
  Track'). `sector 28 faridabad` is the worst sink: 'Noida Sector 38A Bus Stop' 18.8km.
- **Gurgaon**: sikanderpur + iffco chowk EXACT (the :266 fix confirmed on :267). Rapid
  metro partial: 55-56, moulsari, cyber city NEAR; belvedere towers + indusind bank cyber
  city WRONG (station-name rows absent — 'Rapid MetroRail Gurgaon' system row, far
  'IndusInd Bank' 20km). sector 14 + sector 29 WRONG ('Metro Inn' hotel, 'Blue Line' 27.6km).
- **Red/Yellow-east**: vaishali, kaushambi, karkarduma, mohan nagar, jhilmil, shahdara,
  shaheed sthal, hindon river, arthala, trilokpuri EXACT. `anand vihar metro` WRONG —
  returns Karkarduma station 969m (Anand Vihar terminal station doesn't surface as top).
  `dilshad garden` WRONG (Sunder Nagri Kabristan 1.8km). `mansarovar park` NEAR.
- **Noida blue-line oddities**: sec-15/51/52/62 + noida electronic city NEAR (station rows
  in top-3 but not top). WRONG: `sector 34` (row 2.7km off), `sector 50` ('Rainbow metro
  station' dup), `nsez` (Aqua Line system row), `sector 81` (hotel-near-station row),
  `sector 19` (Domino's Botanical Garden), `noida city centre` (dup 3.1km), `wave city
  centre` ('Spectrum Metro Commercial Shops' — different Wave mall).

## (c) Deep-locality worship — dies hardest (22/28 WRONG)

Pattern: `jama masjid <locality>` always resolves to the Old Delhi Jama Masjid 4-11km off
(far same-name sink) — shahdara/burari/mustafabad/seelampur all identical failure. Named
masjids land on wrong entities: bilal→'Jama Masjid Road', madina→'Bombay Wali Masjid',
noor→'Guru Dwara, Noida Sector-37' (11-22km, twice!). Mandirs scatter: `shiv mandir
shahdara`→Jagannath Temple Green Park 15km; `kali mandir shahdara`→masjid 6.9km;
`hanuman mandir sant nagar`→'Trikaldarshi...Sant Darbar' 21.9km.
Exceptions that DO work: `gurudwara shahdara` EXACT 460m (Teliwara), `sai mandir shahdara`
NEAR (3 in-Shahdara sai-mandir rows), `kali mandir mustafabad` NEAR (Kali Mandir Road),
`noor masjid seelampur` NEAR (Masjid Noor Un Nabi), `masjid jahangirpuri` NEAR (resolves
to a Shiv Mandir row — in-locality), `prachin hanuman mandir connaught place` EXACT 355m.
Locality token never restricts the search — it's decoration unless the entity name itself
is indexed.

## (d) Terminals / rail / bus

EXACT (12): delhi airport t2 (station row at real T2), hazrat nizamuddin (92m), anand
vihar terminal (144m), delhi cantt (279m), delhi junction (273m), shakur basti,
tughlakabad, safdarjung, palam, swami vivekanand isbt (177m), gurgaon bus stand (124m),
new bus adda ghaziabad (real stn coords).
NEAR (8): airport t3 (Domino's-T3 top, real T3 row rank-2), sarai rohilla, kishanganj,
bijwasan, mori gate, mukarba chowk, badarpur, shahdara railway.
WRONG (7): **`delhi airport t1` regressed vs :266** — top = 'New Delhi Airport Express
Terminal' rows ~16km off at New Delhi station side (the :266 fix not holding on :267? —
fact as observed, coordinator note says T1 was fixed on :266); `terminal 3 igi` top is a
mojibake-name row 2.7km; `okhla railway station` dup 2.9km; `veer hakikat rai isbt`→Azad
Market 10km; `majnu ka tilla`→'Mavi Earth Movers' 10.8km; `faridabad bus stand` dup 3km;
`noida bus stand`→Wave Cinema 2km.
CLUSTER (1): ghaziabad bus stand — 3 different stand rows 1.3-2.3km.

## (e) NCR anchors

EXACT: metro hospital faridabad, dav rohini (357m), amity noida (83m), gd goenka rohini
(Sec-9 at ~60m), sector 18 noida market (212m).
WRONG (8): fortis noida (coffee_shop/hospital rows pinned 1.3km NW of real), kailash
hospital noida (4.9km east), asian hospital (Arabic-name 'Radix Hospital' 26km), ryan
rohini (Sec-25 row 18.6km), dps noida (ATM row; real DPS Sec-30 absent), lotus valley
('SEO Expert Tutorials' 11km), shri ram gurgaon (Mankrola global school 3.5km),
heritage gurgaon (5.2km).
CLUSTER (2): artemis gurgaon (3 Artemis at 3 coords incl. 15km far dup), paras gurgaon
(3 rows 2-2.7km).
NEAR (8): medanta, raj nagar ext, crossings republik, niti khand 1, vaibhav khand,
ahinsa khand 2, greater noida west, noida extension.

## Deltas vs sweeps 1-2

- `pawan bakery…` garbage→NEAR (real Shahdara bakery now indexed — gazupdate effect).
- `sikanderpur metro` MISS→EXACT 74m; `terminal 1`/`terminal 2`/`delhi airport t1`
  coordinator claims fixed on :266 — t1 query REGRESSED on :267 (returns New Delhi
  Airport Express rows 16km; reporting as observed).
- `sant nagar burari` NEAR (Burari-side rows ~800m) — consistent with sweep-2.
- Worship-with-locality is the worst form in any sweep (22/28 WRONG); block-level from
  sweeps 1-2 was second-worst.

## Artifacts worth build-lane attention

1. **`ITO metro station` wild row** — appears top-3 on far queries: escorts mujesar
   (27km), gnida office (32.6km), pari chowk (32.3km), sant surdas (20km). Planted row
   leaking into unrelated results — new recurrent sink on :267.
2. Far same-name sinks persist: `Jama Masjid` Old Delhi answers every locality-qualified
   jama-masjid query (4-11km off); 'Guru Dwara, Noida Sector-37' answers `noor masjid`
   in shahdara AND burari (11.8/22.8km); 'Bombay Wali Masjid' answers `madina masjid`
   in shahdara AND mustafabad.
3. Mis-coord entity batches: all Fortis Noida rows at one wrong coord (~1.3km off);
   Kailash Hospital 4.9km east; 'Noida Sector 38A Bus Stop' answering faridabad query.
4. Degenerate/system rows still surface: 'Blue Line', 'Aqua Line', 'Rapid MetroRail
   Gurgaon', 'Jama Masjid Road' as entity answers.
5. `delhi airport t1` regression vs :266 claim — New Delhi Airport Express Terminal rows
   (~16km) top the results.

## GT notes

30 query ground-truth pins corrected after audit (aqua-line station coords, palam/
safdarjung/shakur basti/tughlakabad stations, airport T2, new bus adda, crossings,
metro hospital fbd, gd goenka, sant nagar burari). All corrections use real station/
entity coordinates read off the returned rows themselves (expressway/rail alignment
verified monotonic).

## Appendix — all 149 queries (top-3 with GT distances)

| query | cat | verdict | top | rank2 | rank3 |
|---|---|---|---|---|---|
| pawan bakery c block hanuman mandir ashok nagar shahdara | govinda | NEAR | Amar Bakery (bakery, 1284m) | Pandit Bakery (casual_eatery, 1293m) | Giani's di Hatti (confectionery, 6839m) |
| iskcon east of kailash | govinda | NEAR | OYO Rooms East of Kailash ISKCON (hotel, 928m) | ISKCON East Delhi (hindu_place_of_worship, 10594m) | Iskcon Temple, Kailash Colony (hindu_place_of_worship, 5165m) |
| neelanchal dham sant nagar | govinda | MISS | — | — | — |
| sikanderpur metro | metro | EXACT | Sikanderpur metro station, Gurugram (metro, 74m) | OYO Flagship 532 Sikanderpur Metro Station (resort, 1218m) | Sikanderpur Metro Station-Gate No 2 (train_station, 197m) |
| iffco chowk metro | metro | EXACT | Iffco chowk metro station (geonames, 77m) | IFFCO Chowk metro station Gurugram (metro, 5m) | Metro Shoes (fashion_and_apparel_store, 1246m) |
| mg road metro gurgaon | metro | NEAR | Rodeo, MGF Metropolitan Mall, MG Road, Gurga (shopping_mall, 186m) | MG Road metro station (metro, 220m) | OYO Flagship 525 MG Road Metro Station (hotel, 7572m) |
| sector 14 metro gurgaon | metro | WRONG | Metro Inn (hotel, 1438m) | Sheetla Mata Road Bus Stop (public_transit_facility_or_service, 1657m) | Blue Line (subway, 27559m) |
| sector 29 metro gurgaon | metro | WRONG | Blue Line (subway, 27563m) | Metro Properties (property_management, 28193m) | Akshardham Temple Bus Stop (public_transit_facility_or_service, 27484m) |
| sector 55-56 rapid metro | metro | NEAR | Rapid MetroRail Gurgaon (subway, 544m) | Rapid MetroRail Gurgaon (subway, 1016m) | Rapid MetroRail Gurgaon (subway, 100m) |
| belvedere towers rapid metro | metro | WRONG | Rapid MetroRail Gurgaon (subway, 4474m) | DLF Property (public_transit_facility_or_service, 5299m) | DLF Phase 3 Metro Station (travel_and_transportation, 5032m) |
| moulsari avenue rapid metro | metro | NEAR | Rapid MetroRail Gurgaon (subway, 983m) | Moulsari Avenue metro station (metro, 989m) | Central Secratariat Metro Station (travel_and_transportation, 1182m) |
| indusind bank cyber city metro | metro | WRONG | IndusInd Bank (office_supply_store, 20047m) | Greening MSMEs-SIDBI (bank_or_credit_union, 20050m) | Kotak Securities (financial_service, 20034m) |
| cyber city metro gurgaon | metro | NEAR | Metro Shoes (fashion_and_apparel_store, 1689m) | Rapid Metro (travel_and_transportation, 403m) | Regus - Gurgaon, Metropolitan - Cybercity (professional_service, 660m) |
| huda city centre gurgaon | metro | NEAR | Macdonald huda City Centre Gurgaon (restaurant, 32m) | At Huda City Centre Gurgaon (historic_site, 15225m) | Chai Point - Huda City center, Gurgaon (hotel, 17m) |
| noida sector 15 metro | metro | NEAR | Sector 15 Metro parking (parking, 192m) | Noida Sector 15 (arcade, 266m) | Noida Sector 15 metro station (metro, 182m) |
| noida sector 34 metro | metro | WRONG | Noida Sector 34 metro station (metro, 2739m) | Dr.Devendra Singh (public_transit_facility_or_service, 3081m) | Sector 34 Noida Metro Station (travel_and_transportation, 2740m) |
| noida sector 52 metro | metro | NEAR | Noida Sector 52 metro station (metro, 679m) | Blue Line (subway, 821m) | Aqua Line (subway, 963m) |
| noida sector 51 metro | metro | NEAR | Noida Sector 51 metro station (metro, 457m) | Hotel Metro Stays (hotel, 831m) | Noida Sector 51 (synthetic:sector, 1038m) |
| noida sector 50 metro | metro | WRONG | Rainbow metro station (metro, 1128m) | Spectrum Metro Mall (commercial, 1215m) | Spectrum Metro Mall (shopping_mall, 1148m) |
| noida sector 61 metro | metro | EXACT | Noida Sector 61 metro station (metro, 164m) | Noida Sector 61 (synthetic:sector, 1708m) | Hotel Metro View (resort, 19077m) |
| noida sector 59 metro | metro | EXACT | Noida Sector 59 metro station (travel_and_transportation, 352m) | Sector 59 Noida Metro Station-Gate No 1 (train_station, 355m) | Noida Sector 59 (railway:stop, 324m) |
| noida sector 62 metro | metro | NEAR | Noida Sector 62 (synthetic:sector, 1552m) | Noida Sector 62 metro station (metro, 625m) | Noida Sector 62 Metro Station Gate Number 1 (subway_entrance, 618m) |
| noida electronic city metro | metro | NEAR | Electronic City Metro Station Road (residential, 269m) | Blue Line (subway, 315m) | Trip Trek Holiday (public_transit_facility_or_service, 726m) |
| noida sector 76 metro | metro | EXACT | Noida Sector 76 metro station (metro, 5m) | Aqua Line (subway, 400m) | OYO LIFE NOD542 Nr Noida Sector 76 Metro (lodging, 1601m) |
| noida sector 101 metro | metro | EXACT | Noida Sector 101 metro station (metro, 5m) | Hotel O Moonville 101 Metro (hotel, 119m) | Aqua Line (subway, 521m) |
| noida sector 137 metro | metro | EXACT | Noida Sector 137 metro station (metro, 6m) | Domino's Pizza | Botanical Garden, Metro Sta (restaurant, 10932m) | Flight Crust (public_transit_facility_or_service, 10672m) |
| noida sector 142 metro | metro | EXACT | Noida Sector 142 metro station (metro, 263m) | Noida Sector the Noida Metro Rail Corporatio (stop, 277m) | चौBara Noida Sector-142 (cafe, 289m) |
| noida sector 144 metro | metro | EXACT | Noida Sector 144 metro station (metro, 4m) | Aqua Line (subway, 542m) | Aqua Line (subway, 607m) |
| noida sector 145 metro | metro | EXACT | Noida Sector 145 metro station (metro, 5m) | Noida Sector 145 (stop, 3m) | 145 Shanti Lane (address, 14931m) |
| noida sector 146 metro | metro | EXACT | Noida Sector 146 metro station (metro, 4m) | Sector153 Metro Station (travel_and_transportation, 63m) | Aqua Line (subway, 698m) |
| noida sector 147 metro | metro | EXACT | Noida Sector 147 metro station (metro, 4m) | Noida Sector 147 (stop, 12m) | 147 Shanti Lane (address, 18126m) |
| noida sector 148 metro | metro | EXACT | Noida Sector 148 metro station (metro, 4m) | Aqua Line (subway, 581m) | Noida Sector 148 (substation, 538m) |
| nsez noida metro | metro | WRONG | Aqua Line (subway, 3951m) | Noida Sector 82 Bus Stop (public_transit_facility_or_service, 2970m) | Metro Care Path Lab (diagnostics_imaging_or_lab_service, 4048m) |
| noida sector 81 metro | metro | WRONG | Flagship Vibhu Residency Near Noida Sector 8 (resort, 2014m) | Aqua Line (subway, 4755m) | Aqua Line (subway, 5727m) |
| noida sector 83 metro | metro | EXACT | Noida Sector 83 metro station (metro, 5m) | Aqua Line (subway, 416m) | Super Townhouse Sector 86 Near Sector 83 Met (resort, 447m) |
| noida sector 19 metro | metro | WRONG | Domino's Pizza | Botanical Garden, Metro Sta (restaurant, 571m) | Flight Crust (public_transit_facility_or_service, 570m) | Delhi Metro Rail Corporation Ltd Project Off (government_office, 421m) |
| noida city centre metro | metro | WRONG | Noida City Centre metro station (metro, 3145m) | Noida City Centre Metro Station Car Park (parking, 3171m) | Noida City Center Metro Station (public_transit_facility_or_service, 3195m) |
| botanical garden metro | metro | EXACT | Botanical Garden metro station (train_station, 38m) | Botanical Garden (station, 46m) | Botanical Garden (substation, 158m) |
| wave city centre noida metro | metro | WRONG | Spectrum Metro Commercial Shops Noida (shopping_mall, 1592m) | Metro Station Sec-15 Noida (train_station, 1905m) | Choura Raghunath Pur Sector 22 Bus Stop (public_transit_facility_or_service, 1445m) |
| noida golf course metro | metro | EXACT | Golf Course metro station (metro, 4m) | Metro Shoes (fashion_and_apparel_store, 1083m) | Noida Golf Course (station, 37m) |
| pari chowk metro greater noida | metro | NEAR | Domino's Pizza | Pari Chowk Metro Station, G (restaurant, 437m) | ITO metro station (metro, 32273m) | Pari Chowk, Greater Noida (historic_site, 18259m) |
| alpha 1 metro greater noida | metro | NEAR | Ginger Greater Noida, Pari Chowk (public_transit_facility_or_service, 263m) | ALPHA 1 metro station (metro, 781m) | Aqua Line (subway, 300m) |
| delta 1 metro greater noida | metro | EXACT | Delta 1 Metro Station (travel_and_transportation, 5m) | Aqua Line (subway, 613m) | Aqua Line (subway, 775m) |
| gnida office metro | metro | WRONG | POP Royal Guest House Near GNIDA Office Metr (resort, 6154m) | ITO metro station (metro, 32577m) | GNIDA Office (station, 4935m) |
| knowledge park 2 metro | metro | NEAR | Knowledge Park 2 Metro Station (travel_and_transportation, 1147m) | Spectrum Metro Phase 2 (shopping_mall, 17043m) | Saket Metro Gate 2 (platform, 28994m) |
| neelam chowk ajronda metro | metro | WRONG | Brake Test Track (subway, 1925m) | Metro Hospital Sector 16A Faridabad (hospital, 2072m) | Metro Hospital Sector 16A (synthetic:sector, 2072m) |
| bata chowk metro | metro | NEAR | Bata Chowk metro station (train_station, 826m) | Bata Chowk (named, 905m) | OYO Flagship 26451 Bata Chowk Metro Station  (hotel, 721m) |
| escorts mujesar metro | metro | EXACT | Escorts Mujesar metro station (train_station, 10m) | ITO metro station (metro, 29724m) | Escorts Mujesar (stop_position, 26m) |
| sector 28 faridabad metro | metro | WRONG | Noida Sector 38A Bus Stop (public_transit_facility_or_service, 18817m) | Metro Shoes (fashion_and_apparel_store, 18700m) | Noida Sector-18 Metro Gate Number 1 (subway_entrance, 19062m) |
| mewla maharajpur metro | metro | EXACT | Mewla Maharajpur metro station (train_station, 3m) | Jaitpur Terminal Bus Stop (public_transit_facility_or_service, 6466m) | OYO Flagship Hotel Silver Tree Near Badarpur (private_lodging, 5996m) |
| old faridabad metro | metro | NEAR | Old Faridabad metro station (metro, 729m) | Metro Heart Institute with Multispeciality (hospital, 1976m) | Dr. Suresh Yadav General Physician (public_transit_facility_or_service, 3286m) |
| nhpc chowk metro | metro | EXACT | NHPC Chowk metro station (train_station, 5m) | — | — |
| sarai metro faridabad | metro | WRONG | NHPC Chowk metro station (train_station, 2200m) | Sarai metro station (metro, 4439m) | Sarai Metro Station-Gate No 1 (train_station, 4572m) |
| badkhal mor metro | metro | NEAR | Badkhal Mor metro station (train_station, 481m) | Badkal Mor metro station (metro, 481m) | Dwarka Mor metro station (train_station, 34297m) |
| sant surdas sihi metro | metro | EXACT | Sant Surdas (Sihi) metro station (metro, 3m) | ITO metro station (metro, 31406m) | Sant Surdas Park (park, 1877m) |
| raja nahar singh ballabhgarh metro | metro | EXACT | Raja Nahar Singh metro station (metro, 27m) | Ballabhgarh Metro Station (train_station, 3m) | Bus Stand Ballabgarh (public_transit_facility_or_service, 201m) |
| vaishali metro | metro | EXACT | Vaishali metro station (metro, 12m) | Vaishali Metro Station Parking (parking, 16m) | Vaishali metro station (train_station, 946m) |
| kaushambi metro | metro | EXACT | Kaushambi metro station (metro, 79m) | Kaushambi Metro Station Parking (parking, 71m) | Kaushambi Metro Station-Gate No 2 (train_station, 49m) |
| anand vihar metro | metro | WRONG | Karkarduma Metro Station (Pink Line) (building, 969m) | Delhi Metro Pink Line (subway, 901m) | Karkarduma metro station (metro, 1006m) |
| karkarduma metro | metro | EXACT | Karkarduma metro station (metro, 67m) | Karkarduma metro station (train_station, 132m) | Karkarduma Metro Station (Pink Line) (building, 37m) |
| mohan nagar metro | metro | EXACT | Mohan Nagar metro station (metro, 212m) | Sagarpur Flyover Bus Stop (public_transit_facility_or_service, 28117m) | Nagal Raya Bus Stop (public_transit_facility_or_service, 27948m) |
| dilshad garden metro | metro | WRONG | Sunder Nagri Kabristan (public_transit_facility_or_service, 1818m) | Nand Nagari E Block Bus Stop (public_transit_facility_or_service, 2062m) | Nand Nagari C Block Bus Stop (public_transit_facility_or_service, 2204m) |
| jhilmil metro | metro | EXACT | Jhilmil metro station (train_station, 293m) | Capital O Green Palms Near Jhilmil Metro Sta (resort, 232m) | Jhilmil (station, 295m) |
| mansarovar park metro | metro | NEAR | Mansarovar Park metro station (train_station, 928m) | Mansarovar Park (park, 1281m) | Mansarovar Park (station, 995m) |
| shahdara metro | metro | EXACT | Shahdara metro station (metro, 11m) | Shahdara metro station (train_station, 366m) | Shahdara Metro Station Gate No. 2 (named, 76m) |
| shaheed sthal new bus adda metro | metro | EXACT | Shaheed Sthal New Bus Adda Metro Station (travel_and_transportation, 5m) | New bus adda Rapid metro station Ghaziabad (travel_service, 102m) | Shaheed Sthal (New Bus Adda) (station, 344m) |
| hindon river metro | metro | EXACT | Hindon River metro station (metro, 3m) | Hindon River Metro Station (train_station, 714m) | Hindon River (river, 2054m) |
| arthala metro | metro | EXACT | Arthala metro station (metro, 4m) | Arthala Metro Station (travel_and_transportation, 405m) | Arthala (locality, 292m) |
| mayur vihar pocket 1 metro | metro | NEAR | Mayur Vihar - 1 Metro Station Lift Number 4A (subway_entrance, 754m) | Mayur Vihar - 1 Metro Station Gate Number 4 (subway_entrance, 719m) | Mayur Vihar Phase 1 Metro Station (platform, 891m) |
| trilokpuri sanjay lake metro | metro | EXACT | Trilokpuri Metro Station (platform, 174m) | Delhi Metro Pink Line (subway, 418m) | Delhi–Meerut RRTS (subway, 761m) |
| shiv mandir shahdara | worship | WRONG | Jagannath Temple,green Park,new Delhi (hindu_place_of_worship, 15045m) | Gurudwara Green Park (place_of_worship, 14989m) | Gurdwara Sikh Sangat Green Park (place_of_worship, 15035m) |
| durga mandir shahdara | worship | WRONG | Shri Sai (hindu_place_of_worship, 1738m) | Panchal Shiv Hanuman Mandir (hindu_place_of_worship, 1646m) | Shri Maan Vaishno Devi Mandir (hindu_place_of_worship, 1742m) |
| kali mandir shahdara | worship | WRONG | Masjid Ahle Hadees (place_of_worship, 6924m) | Blue and yellow mosque (place_of_worship, 7064m) | Mughal era mosque (place_of_worship, 7191m) |
| jama masjid shahdara | worship | WRONG | Jama Masjid (amenity:place_of_worship, 6048m) | 2006 Jama Masjid explosions (place, 6054m) | 2010 Jama Masjid attack (place, 6054m) |
| madina masjid shahdara | worship | WRONG | Bombay Wali Masjid (religious_organization, 6163m) | Nurani Masjid (muslim_place_of_worship, 6154m) | Jama Masjid Heritage Walks (historic_site, 6142m) |
| noor masjid shahdara | worship | WRONG | Guru Dwara, Noida Sector-37 (place_of_worship, 11821m) | Christ Church Noida (place_of_worship, 12743m) | Noor Masjid (place_of_worship, 10423m) |
| gurudwara shahdara | worship | EXACT | Gurdwara Sri Guru singh Sabha Teliwara , Sha (religious_organization, 460m) | Shri Akhand Darbar Sahib (place_of_worship, 485m) | Maniram Mandir (place_of_worship, 716m) |
| radha krishna mandir shahdara | worship | WRONG | Manokamana Siddh Durga Mandir (place_of_worship, 5119m) | Manokamana Sidh Durga Mata Mandir (hindu_place_of_worship, 5114m) | Pracheen Durga Mandir (place_of_worship, 5121m) |
| sai mandir shahdara | worship | NEAR | SAI SHARNAM MANDIR SHAHDARA (place_of_worship, 1632m) | Sai Sharnam Mandir Shahdara (hindu_place_of_worship, 533m) | Shirdi Sai Mandir- Shahdara (hindu_place_of_worship, 858m) |
| shani mandir shahdara | worship | WRONG | Shri Shani Mandir CP (hindu_place_of_worship, 8654m) | Ganesh Ji Mandir (place_of_worship, 8650m) | Shri Ganesh Mandir (hindu_place_of_worship, 8659m) |
| hanuman mandir sant nagar | worship | WRONG | Trikaldarshi Shri Hanuman Ji Sant Darbar (hindu_place_of_worship, 21856m) | Shiv Mandir (religious_organization, 21585m) | Shri Durga Kalyani Mandir (hindu_place_of_worship, 21549m) |
| shiv mandir sant nagar burari | worship | WRONG | Shiv Mandir (hindu_place_of_worship, 2020m) | Shiv Mandir (hindu_place_of_worship, 750m) | Kids Shell Sant Nagar (home_service, 756m) |
| durga mandir burari | worship | WRONG | Ved Mandir Trust (animal_or_pet_service, 14948m) | Sammed Shikharji Madhuban (hindu_place_of_worship, 14990m) | Akshardam (hindu_place_of_worship, 14915m) |
| jama masjid burari | worship | WRONG | Jama Masjid (amenity:place_of_worship, 11165m) | 2006 Jama Masjid explosions (place, 11165m) | 2010 Jama Masjid attack (place, 11165m) |
| bilal masjid burari | worship | WRONG | Jama Masjid Road (tertiary, 11133m) | Shia Jama Mosque, Delhi (muslim_place_of_worship, 11141m) | Jama Masjid, Delhi (mosque, 11141m) |
| noor masjid burari | worship | WRONG | Guru Dwara, Noida Sector-37 (place_of_worship, 22843m) | Christ Church Noida (place_of_worship, 24072m) | Noori Masjid (place_of_worship, 3907m) |
| hanuman mandir mustafabad | worship | WRONG | Hanuman Mandir (hindu_place_of_worship, 12907m) | Hanuman Temple, Connaught Place (temple, 12896m) | Prachin Hanuman Mandir (place_of_worship, 12859m) |
| jama masjid mustafabad | worship | WRONG | Jama Masjid (amenity:place_of_worship, 10106m) | Jama Masjid (mosque, 10065m) | 2006 Jama Masjid explosions (place, 10109m) |
| bilal masjid mustafabad | worship | WRONG | Jama Masjid Road (tertiary, 10126m) | Shia Jama Mosque, Delhi (muslim_place_of_worship, 10106m) | Jama Masjid, Delhi (mosque, 10106m) |
| madina masjid mustafabad | worship | WRONG | Bombay Wali Masjid (religious_organization, 10548m) | Nurani Masjid (muslim_place_of_worship, 10559m) | Jama Masjid Heritage Walks (historic_site, 10559m) |
| shiv mandir mustafabad | worship | WRONG | Shiv Mandir (place_of_worship, 4387m) | shiv mandir (place_of_worship, 3006m) | Shiv Mandir (hindu_place_of_worship, 2939m) |
| kali mandir mustafabad | worship | NEAR | Kali Mandir Road (residential, 815m) | Kali Mandir (place_of_worship, 11920m) | Minto Road Puja Samity (hindu_place_of_worship, 11876m) |
| hanuman mandir seelampur | worship | WRONG | Hanuman Mandir (hindu_place_of_worship, 6975m) | Hanuman Temple, Connaught Place (temple, 6968m) | Prachin Hanuman Mandir (place_of_worship, 6941m) |
| jama masjid seelampur | worship | WRONG | Jama Masjid (amenity:place_of_worship, 4137m) | 2006 Jama Masjid explosions (place, 4143m) | 2010 Jama Masjid attack (place, 4143m) |
| noor masjid seelampur | worship | NEAR | Masjid Noor Un Nabi (muslim_place_of_worship, 1050m) | Guru Dwara, Noida Sector-37 (place_of_worship, 12280m) | Christ Church Noida (place_of_worship, 13403m) |
| hanuman mandir jahangirpuri | worship | WRONG | Hanuman Mandir (hindu_place_of_worship, 11829m) | Hanuman Temple, Connaught Place (temple, 11819m) | Prachin Hanuman Mandir (place_of_worship, 11785m) |
| masjid jahangirpuri | worship | NEAR | Prachin Shiv Mandir (place_of_worship, 800m) | Madina Masjid (place_of_worship, 935m) | Hanuman Mandir (place_of_worship, 775m) |
| prachin hanuman mandir connaught place | worship | EXACT | Prachin Hanuman Mandir (place_of_worship, 355m) | Shri Hanuman Temple (hindu_place_of_worship, 336m) | Hanuman Temple, Connaught Place (temple, 386m) |
| delhi airport t1 | term | WRONG | New Delhi Airport Express Terminal (station, 16378m) | Delhi Domestic Airport (airport, 17663m) | New Delhi Airport Express Station (train_station, 16414m) |
| delhi airport t2 | term | EXACT | Delhi Airport T2 (airport, 10m) | Terminal 2 - Delhi Airport Old Airport Remin (airport, 383m) | Go Colors - Delhi Internation Airport Termin (fashion_and_apparel_store, 534m) |
| delhi airport t3 | term | NEAR | Domino's Pizza | Terminal 3, Igi Airport, Ne (restaurant, 1855m) | Airport Medical Services - Terminal 3 Delhi (airport, 13929m) | IGI Delhi International Airport Terminal 3 (airport, 265m) |
| terminal 3 igi airport | term | WRONG | Terminal 3 - Indira Gandhi International Air (airport, 2691m) | Indira Gandhi International Airport Terminal (airport, 2182m) | Terminal 3 (International) (terminal, 2181m) |
| hazrat nizamuddin railway station | term | EXACT | NZM Railway Station (train_station, 92m) | Hazrat Nizamuddin railway station (station, 140m) | Hazrat Nizamuddin railway station (train_station, 614m) |
| anand vihar terminal railway station | term | EXACT | Anvt Railway Station (train_station, 144m) | Anand Vihar Terminus Railway Station (railway, 226m) | Anand Vihar Terminal (station, 277m) |
| delhi sarai rohilla station | term | NEAR | M/S Gee Dee Filling Station (gas_station, 36732m) | Delhi Sarai Rohilla (station, 355m) | Government Quarter New Rohtak Road Bus Stop (public_transit_facility_or_service, 347m) |
| delhi cantt railway station | term | EXACT | Delhi Cantt railway station (station, 279m) | 2025 New Delhi railway station stampede (place, 10912m) | Delhi (locality, 12236m) |
| delhi kishanganj station | term | NEAR | Delhi Kishanganj railway station (station, 1323m) | Delhi Kishanganj (station, 1089m) | Delhi (locality, 3172m) |
| shakur basti station | term | EXACT | Shakurbasti railway station (train_station, 89m) | Shakurbasti Railway Station Delhi (train_station, 604m) | Shakurbasti (station, 174m) |
| tughlakabad station | term | EXACT | Tughlakabad Station metro station (metro, 302m) | Tughlakabad railway station (station, 0m) | Tughlakabad Railroad Station (station, 213m) |
| okhla railway station | term | WRONG | Okhla railway station (station, 2930m) | Jamia Millia Islamia (station, 2039m) | Jamia College (platform, 2020m) |
| delhi junction railway station | term | EXACT | Delhi Junction railway station (station, 273m) | Police Station Old Delhi Railway Station (police, 453m) | Delhi Junction (train_station, 319m) |
| safdarjung railway station | term | EXACT | Delhi Safdarjung railway station (station, 4m) | Hindustan Petroleum Fuel Filling Station (Sa (station, 2639m) | Tughlak Crescent (platform, 2828m) |
| bijwasan station | term | NEAR | L-Band Radar and HF Transmitting Station (industrial, 2286m) | Bijwasan railway station (train_station, 1338m) | Bijwasan Railway Station Parking (parking, 1300m) |
| palam railway station | term | EXACT | Palam Railway Station (train_station, 7m) | Townhouse New Delhi Palam Railway Station (hotel, 315m) | Collection O Palam Near Railway Station (hotel, 316m) |
| swami vivekanand isbt | term | EXACT | Inter-State Bus Terminus (ISBT) Kashmiri Gat (building, 177m) | Swami Vivekanand Inter State Bus Terminus (station, 8539m) | ISBT (platform, 199m) |
| mori gate bus stand | term | NEAR | Manjot Enterprises (public_transit_facility_or_service, 1330m) | Fateh Puri Bus Stop (public_transit_facility_or_service, 981m) | Mori gate (travel_and_transportation, 1173m) |
| veer hakikat rai isbt sarai kale khan | term | WRONG | Azad Market (platform, 9985m) | Ice Factory (platform, 10256m) | Saint Stephen's Hospital (platform, 10045m) |
| majnu ka tilla bus stand | term | WRONG | Mavi Earth Movers (travel_and_transportation, 10755m) | Majnu-ka-tilla (locality, 287m) | Majnu-ka-tilla (place, 458m) |
| mukarba chowk bus stop | term | NEAR | Mukarba Chowk (platform, 1998m) | DTC Bus Depot (public_transit_facility_or_service, 1687m) | Karnal By Pass Bus Stop (public_transit_facility_or_service, 1484m) |
| badarpur bus stand | term | NEAR | Badarpur (platform, 222m) | Tughlaqabad Metro Station (travel_and_transportation, 182m) | Tughlakabad (stop, 197m) |
| faridabad bus stand | term | WRONG | Faridabad Bus Stand (bus_station, 2955m) | Eicher School Bus Stop (platform, 4044m) | Om Sai Transport Services (travel_and_transportation, 5871m) |
| noida bus stand | term | WRONG | Wave Cinema (platform, 2064m) | Film City Mod (platform, 2210m) | Wave Sector 18 Metro Station-Gate No 1 (travel_and_transportation, 2050m) |
| gurgaon bus stand | term | EXACT | Gurgaon Bus Stand (public_transit_facility_or_service, 124m) | Gurugram Bus Stand (bus_station, 116m) | OYO Rooms Gurgaon Bus Stand (hotel, 205m) |
| ghaziabad bus stand | term | CLUSTER | Ghaziabad Bus Stand (bus_station, 2309m) | Ghaziabad New Bus Stand (public_transit_facility_or_service, 2319m) | Old Bus Stand- Ghaziabad (public_transit_facility_or_service, 1277m) |
| new bus adda ghaziabad | term | EXACT | Shaheed Sthal (New Bus Adda) (station, 1m) | Shaheed Sthal New Bus Adda Metro Station (travel_and_transportation, 346m) | New bus adda Rapid metro station Ghaziabad (travel_service, 361m) |
| shahdara railway station | term | NEAR | Chhajupur Bus Stop (public_transit_facility_or_service, 122m) | Hindustan Petroleum Fuel Filling Station (Pa (station, 370m) | Hindustan Petroleum Fuel Filling Station (Ra (station, 375m) |
| medanta gurgaon | anchor | NEAR | OYO 7572 near Medanta (resort, 3316m) | Medanta Pharmacy, Gurgaon (hospital, 284m) | Medanta Hospital Gurgaon Bridge (private_lodging, 162m) |
| artemis hospital gurgaon | anchor | CLUSTER | ARTEMIS Hospital ; Gurgaon (hospital, 3759m) | Artemis Hospital (building, 15288m) | Artemis Hospital (hospital, 1072m) |
| paras hospital gurgaon | anchor | CLUSTER | Paras Hospital, Gurgaon (hospital, 2500m) | Paras Hospital (building, 2500m) | Paras Hospital (geonames, 2748m) |
| fortis noida | anchor | WRONG | Fortis Noida (coffee_shop, 1277m) | Best Psychiatry Hospital , | Fortis Hospital (diagnostics_imaging_or_lab_service, 1276m) | Best Ophthalmology Hospital , | Fortis Hospi (hospital, 1276m) |
| kailash hospital noida | anchor | WRONG | Kailash Hospital (Noida) (hospital, 4935m) | Rejoice hospital (hospital, 7964m) | MASSH Hospital (hospital, 8568m) |
| metro hospital faridabad | anchor | EXACT | Metro Hospital Sector 16A Faridabad (hospital, 6m) | Metro Hospital Sector 16A (synthetic:sector, 6m) | Delhi–Meerut RRTS (subway, 21284m) |
| asian hospital faridabad | anchor | WRONG | Radix Hospital Delhi شفاخانه رادیکس دهلی هند (hospital, 26033m) | Clinic Dermatech Nirman Vihar - Laser Hair R (specialized_health_care, 26016m) | Basil Skin Clinic (specialized_health_care, 25919m) |
| dav public school rohini | anchor | EXACT | DAV Public School Rohini (place_of_learning, 357m) | DAV Public School (school, 337m) | Mass physics education (education, 460m) |
| ryan international school rohini | anchor | WRONG | Sector 25, Rohini Ryan International School (place_of_learning, 18621m) | ACCA - Finaco Pro (education, 18670m) | Studio B3 (dancing_school, 18481m) |
| gd goenka school rohini | anchor | EXACT | GD Goenka Public School, Rohini Sector 9 (place_of_learning, 4m) | GD Goenka School, Sector-22, Rohini, Delhi (high_school, 6145m) | GD Goenka (school, 7m) |
| amity noida | anchor | EXACT | Amity Noida (college_university, 83m) | Amity Noida (college_university, 2941m) | Amity International, Noida (school, 1390m) |
| dps noida | anchor | WRONG | Delhi - Noida DPS Worksite ATM (atm, 2262m) | DPS 122 Noida (place_of_learning, 7894m) | Dps Greater Noida (place_of_learning, 26001m) |
| lotus valley school noida | anchor | WRONG | SEO Expert Tutorials (education, 10973m) | Maths Tuition Classes - Cuemath (tutoring_service, 10902m) | C M Shri Chilla Gaon Mayur Vihar Extension (education, 11391m) |
| shri ram school gurgaon | anchor | WRONG | Shri Ram Global School, Mankrola, Gurugram (place_of_learning, 3521m) | Shri Ram public school ,rajghat ,Narora (place_of_learning, 26482m) | The Shri Ram School (place_of_learning, 14707m) |
| heritage school gurgaon | anchor | WRONG | The Heritage School, Gurgaon (high_school, 5239m) | The Heritage School (place_of_learning, 29897m) | Delhi Heritage School (place_of_learning, 30732m) |
| raj nagar extension ghaziabad | anchor | NEAR | HealthKart - Raj Nagar Extension, Ghaziabad (food_and_beverage_store, 1929m) | Footprints Childcare: Rajnagar Extension, Gh (preschool, 2485m) | Bachpanplayschool Rajnagar Extension Ghaziab (preschool, 1119m) |
| crossings republik | anchor | NEAR | Crossings Republik (place, 116m) | Crossings Republik (macrohood, 116m) | Crossings Republik (suburb, 9m) |
| niti khand 1 indirapuram | anchor | NEAR | EuroKids PreSchool, Indirapuram, Niti Khand  (preschool, 336m) | Niti Khand 1 (historic_site, 418m) | Neeta's Kids Cradle Pre School & Daycare Nit (sport_or_fitness_facility, 901m) |
| vaibhav khand indirapuram | anchor | NEAR | Vaibhav Park (leisure:park, 552m) | Apollo 247 Lab Tests in Indirapuram, Vaibhav (diagnostics_imaging_or_lab_service, 240m) | Kailash Path Labs (healthcare:sample_collection, 304m) |
| ahinsa khand 2 indirapuram | anchor | NEAR | HOD Ahinsa Khand 2, Indirapuram (health_care, 1027m) | Winni Cakes & More Ahinsa Khand - 2 Indirapu (casual_eatery, 9412m) | Makoons - Preschool in AhinsaKhand 2, Indira (preschool, 688m) |
| greater noida west | anchor | NEAR | NND Kidzee Greater Noida West / Noida Extens (preschool, 3439m) | Tumbledry greater Noida west (laundry_service, 10477m) | Fabricspa Greater Noida West (beauty, 619m) |
| noida extension | anchor | NEAR | Noida Extension (historic_site, 985m) | HealthBowl Noida Extension (restaurant, 11065m) | Digamber Jain Temple, Sunpura, Noida Ext (religious_organization, 17876m) |
| sector 18 noida market | anchor | EXACT | Noida Sector 18 Atta Market (shopping, 212m) | Taneira Sarees (Sector 18 Market, Noida) (fashion_and_apparel_store, 217m) | Atta Market (retail, 152m) |