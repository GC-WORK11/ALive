# acct2 geo sweep-4 — prod :271, post-anchorsink (n=150 fresh + 91-winner re-check)

Probe: `/v2/search?q=…&lat=28.63&lon=77.24`. Same rubric as sweep-3: does top-3 make
geographic sense (right locality, not a far same-name sink)? EXACT ≤~1.5km GT named
entity; NEAR = right locality/intended row in top-3; CLUSTER = conflicting same-name
coords; WRONG = confident-wrong top; MISS = empty. All 150 strings fresh vs sweeps 1–3.

## HEADLINE

**WRONG: 42/150 = 28.0%** — down from **36.2%** on :267 (−8.2pts). The drop is driven
by the anchorsink fix landing exactly where it was aimed: worship 22/28 WRONG (78.6%)
→ **19/55 WRONG (34.5%)** on fresh wording + fresh localities — i.e. it generalizes,
not a fit to sweep-3's names. Zero CLUSTER, zero MISS this round.

**Land-wins: 89/91 hold** (82 strict-hold, 7 still-NEAR). **2 regressions**, both
single-query, listed below.

## Tally — sweep-4 corpus

| class | n | % |
|---|---|---|
| EXACT | 37 | 24.7% |
| NEAR | 71 | 47.3% |
| CLUSTER | 0 | 0.0% |
| WRONG | 42 | 28.0% |
| MISS | 0 | 0.0% |

| group | n | EXACT | NEAR | CLUSTER | WRONG | MISS |
|---|---|---|---|---|---|---|
| worship (9 deep localities) | 55 | 7 | 29 | 0 | 19 | 0 |
| NCR sectors | 40 | 12 | 13 | 0 | 15 | 0 |
| rail/bus/metro terminals | 25 | 11 | 13 | 0 | 1 | 0 |
| hospitals/schools/colonies | 30 | 7 | 16 | 0 | 7 | 0 |

## Per-locality worship detail (the anchorsink test)

| locality | E | N | W | note |
|---|---|---|---|---|
| karawal nagar | 2 | 4 | 0 | best — Shitla Mata 1307m + Ram Mandir 1300m EXACT |
| trilokpuri | 3 | 3 | 0 | gurudwara trilokpuri EXACT 924m; masjid-block-27 lands |
| mandoli | 1 | 5 | 0 | shiv mandir 383m EXACT |
| seelampur | 1 | 5 | 0 | seetla mata 709m EXACT; 300-500m mosque rows |
| ghazipur | 1 | 5 | 0 | shiv mandir 625m EXACT |
| mustafabad | 0 | 6 | 0 | eidgaah/noor/umar masjids in-locality (sheetla sinks) |
| burari | 0 | 4 | 3 | mosques land (1716-2814m); mandirs+gurudwara sink 8-14km |
| gokalpur | 0 | 0 | 6 | locality not anchored — everything comes from karawal/mustafabad 5-7km |
| sant nagar | 0 | 0 | 6 | still unanchored — karol bagh 'sant' entities + EOK gurudwara 22.8km |

`sant nagar` and `gokalpur` remain dead localities — the anchor never resolves.
`sheetla mata mandir <locality>` is the biggest residual failure form: 7/9 localities
return the same famous-entity triplet (Mata Sundari Gurdwara / Mata Vaishno Shrine
Trust / Dakhina Kali) 7–14km off — entity name wins over locality token.

## Regressions vs sweep-3 land-wins (2 of 91)

- `swami vivekanand isbt` — was EXACT 177m; now correct entity surfaces but at
  **8.5km coord** (name-matched row's coords, not the :267 coord). → now NEAR-equivalent.
- `delhi sarai rohilla station` — was NEAR (station at rank 1); now `station` token
  prefix-matches **'M/S Gee Dee Filling Station' 36.7km** and station rows fall to
  category-matched generic fills ~3km. Regressed WRONG-adjacent.

(7 "soft" holds: sector 55-56, alpha 1, sai mandir shahdara, delhi airport t3, mukarba
chowk, medanta, greater noida west — all still NEAR-grade top-3.)

## Fresh artifacts on :271

1. **sheetla-mata universal sink** — Mata Sundari Gurdwara 7.3–14.4km answers the
   query in every locality lacking a local Shitla row (7 of 9 tested).
2. **Kamla Nagar swallows 'patel nagar'** — `patel nagar station delhi` resolves to
   Kamla Nagar anchor: Medanta Lab Kamla Nagar + Kamla Market Bus Stop rows (WRONG).
3. **mis-coord sector batches persist**: noida sec-119/122 rows at ~11–13km, greater
   noida sec-16 at 16.5km, faridabad sec-17 rows at 29–43km, hilton ggn sec-50 at 32.7km.
4. **degenerate numerals still win**: `sector 150 noida`→'150 Shanti Lane' 24km;
   `knowledge park 5`→KP5 row 9.4km + literal '5' living_street rows 24-27km;
   `greater noida sector 37`→'Bistro 37'/'Kosmos 37'; `chi 3`→'3 Idiots Chinese Adda' 30km.
5. **'station' token-prefixes fuel stops** (sarai rohilla regression above).
6. Hospital name coverage thinner than metro: `qrg`/`sarvodaya`/`yatharth` noida+gn
   don't resolve (parijat/dentistry/detailing rows instead); `felix hospital
   polyclinic` name row lands 10.3km. `shiv nadar school`→Setu School 22km.
   Positive: `amrita hospital faridabad` exact-prefix ~8km (real coords, pin drift),
   `mayom`→'Kidney Healers at Mayom' 1.4km, `columbia asia ghaziabad` 3× same-name.
7. **Dhaulatabad/Carterpuri/Jhajgarh village sinks** answer `shikarpur village`
   (village name unindexed → nearby-village tokens).

## What now works that didn't (sweep-3 → 4)

- `jama masjid <locality>`-type queries no longer sink to Old Delhi — masjid-token
  queries land real in-locality mosques (seelampur 302-476m, mandoli 967-1726m,
  burari 1716-2814m, ghazipur 931-1971m, trilokpuri 727-968m).
- named-locality gurudwara works where indexed: gurudwara trilokpuri EXACT, gurudwara
  karawal nagar→Sachkhand Nanak Dham 881m, ghazipur→Madhu Vihar/Gurudwara rows ~1.5-2.5km.
- `sarai kale khan bus stand` EXACT 483m (sweep-3's `veer hakikat rai isbt` was WRONG
  → Azad Market 10km). `bahadurgarh bus stand` name-match 1.6km. `tikri border`
  name+metro rows ~1.4-2.5km.
- Ring-line stations resolve: narela 453m, badli 299m, mundka 372m, nangloi 854m,
  daya basti 859m, shivaji bridge 830m, vivekanand puri halt 1.3km, ghevra ~1km,
  holambi kalan ~3.8km, khera kalan ~5.4km.
- Metro: welcome 53m, jaffrabad 761m, babarpur→maujpur-babarpur 330m.
- Colonies: lado sarai, kapashera (252m), ghonda, dallupura, gamri, saboli-adjacent,
  pul pehladpur all land own-name rows.

## Appendix — all 150 queries, top-3 with GT distances

| query | group | verdict | top | rank2 | rank3 |
|---|---|---|---|---|---|
| sheetla mata mandir burari | worship | WRONG | Mata Sundari Gurdwara (place_of_worship, 13821m) | Shri Mata Vaishno Shrine Board Trust (hindu_place_of_worship, 13923m) | Dakhina Kali Mata Mandir (hindu_place_of_worship, 13272m) |
| madni masjid burari | worship | NEAR | Sunni Noori Jama Masjid (muslim_place_of_worship, 1716m) | Masjid Aqsa Uttarakhand Enclave (muslim_place_of_worship, 2102m) | Madina Masjid (muslim_place_of_worship, 2814m) |
| gurudwara singh sabha burari | worship | WRONG | Singh Sabha Gurudwara (place_of_worship, 8765m) | Gurudwara Guru Singh Sabha (place_of_worship, 9667m) | Gurdwara Sri Guru Singh Sabha Kalyan Vihar (place_of_worship, 7284m) |
| shiv shakti mandir burari | worship | WRONG | Shiv Shakti Mandir (hindu_place_of_worship, 8063m) | Shiv Shakti Valmiki Mandir (place_of_worship, 8862m) | Shiv Mandir (place_of_worship, 8923m) |
| ameen masjid burari | worship | NEAR | Ameena Masjid (muslim_place_of_worship, 3995m) | Sunni Noori Jama Masjid (muslim_place_of_worship, 1716m) | Masjid Aqsa Uttarakhand Enclave (muslim_place_of_worship, 2102m) |
| ram mandir burari | worship | NEAR | Ram Hanuman Mandir (hindu_place_of_worship, 1918m) | Shree Shree Gouri Shankar Ram Janki Mandir (hindu_place_of_worship, 1980m) | Baba Mohan Ram Mandir (hindu_place_of_worship, 2605m) |
| markazi masjid burari | worship | NEAR | Sunni Noori Jama Masjid (muslim_place_of_worship, 1716m) | Masjid Aqsa Uttarakhand Enclave (muslim_place_of_worship, 2102m) | Madina Masjid (muslim_place_of_worship, 2814m) |
| shiv shakti mandir seelampur | worship | NEAR | Shiv Mandir (religious_organization, 1855m) | Shiv Mandir Dharmshala (hindu_place_of_worship, 2529m) | Shiv Mandir (hindu_place_of_worship, 1638m) |
| madni masjid seelampur | worship | NEAR | Kadri Mosque (muslim_place_of_worship, 337m) | Makka Masjid (muslim_place_of_worship, 476m) | Wahid Jama Masjid (muslim_place_of_worship, 302m) |
| gurudwara singh sabha seelampur | worship | NEAR | Mata Village Usmanpur (place_of_worship, 2037m) | Shri Shiv Durga Mandir (place_of_worship, 1376m) | Domino's Pizza | Gurudwara Road, New Seela (restaurant, 1144m) |
| sheetla mata mandir seelampur | worship | EXACT | Shree Seetla Mata Mandir (hindu_place_of_worship, 709m) | Kalka Mata Mandir (hindu_place_of_worship, 678m) | Jhande Wali Mata Mandir (hindu_place_of_worship, 1174m) |
| ameen masjid seelampur | worship | NEAR | Kadri Mosque (muslim_place_of_worship, 337m) | Makka Masjid (muslim_place_of_worship, 476m) | Wahid Jama Masjid (muslim_place_of_worship, 302m) |
| ram mandir seelampur | worship | NEAR | Shri Ram Mandir (place_of_worship, 1773m) | Jai Baba Mohan Ram (Kali Kolhi) Mandir. (hindu_place_of_worship, 1801m) | Ram Gadiya Gurdwara (place_of_worship, 1392m) |
| markazi masjid mustafabad | worship | NEAR | Markazi Jama Masjid (muslim_place_of_worship, 5594m) | Eidgaah Mustafabad (muslim_place_of_worship, 4085m) | Mustafabad Noor Masjid (muslim_place_of_worship, 3670m) |
| sheetla mata mandir mustafabad | worship | WRONG | Mata Sundari Gurdwara (place_of_worship, 12665m) | Shri Mata Vaishno Shrine Board Trust (hindu_place_of_worship, 13053m) | Dakhina Kali Mata Mandir (hindu_place_of_worship, 11990m) |
| gurudwara mustafabad | worship | NEAR | Gurudwara Khajuri B block (place_of_worship, 4346m) | Shiv Mandir (place_of_worship, 5279m) | shiv mandir (place_of_worship, 3804m) |
| madni masjid mustafabad | worship | NEAR | Eidgaah Mustafabad (muslim_place_of_worship, 4085m) | Mustafabad Noor Masjid (muslim_place_of_worship, 3670m) | Umar Masjid (muslim_place_of_worship, 3726m) |
| shiv shakti mandir mustafabad | worship | NEAR | Shri Shiv Shakti Mandir (hindu_place_of_worship, 5261m) | Shiv Shakti Mandir (hindu_place_of_worship, 5415m) | Shri Baba Amarnath Shiv Shakti Sewa Trust (hindu_place_of_worship, 4059m) |
| quba masjid mustafabad | worship | NEAR | Eidgaah Mustafabad (muslim_place_of_worship, 4085m) | Mustafabad Noor Masjid (muslim_place_of_worship, 3670m) | Umar Masjid (muslim_place_of_worship, 3726m) |
| shiv shakti mandir sant nagar | worship | WRONG | Shree Shiv Tribhuvan Mandir (hindu_place_of_worship, 10959m) | Shree shiv mandir (hindu_place_of_worship, 11616m) | Shiv mandir (hindu_place_of_worship, 11357m) |
| madni masjid sant nagar | worship | WRONG | Sant Samagam Gurudwara, Karol Bagh (place_of_worship, 11447m) | Gurudwara Sant Sujan Singh Maharaj (place_of_worship, 11427m) | New Delhi Juma Masjid (muslim_place_of_worship, 11868m) |
| gurudwara sant nagar | worship | WRONG | Gurudwara Sant Nagar, EOK (place_of_worship, 22794m) | Gurdwara Singh Sabha Sant Nagar Extension (place_of_worship, 15860m) | Sant Samagam Gurudwara, Karol Bagh (place_of_worship, 11447m) |
| sheetla mata mandir sant nagar | worship | WRONG | Shree Shakti Peeth Jai Mata Mandir (hindu_place_of_worship, 11874m) | Jai Mata Mandir (place_of_worship, 11847m) | Jai Mata Vaishno Devi Mandir (hindu_place_of_worship, 10010m) |
| ameen masjid sant nagar | worship | WRONG | Sant Samagam Gurudwara, Karol Bagh (place_of_worship, 11447m) | Gurudwara Sant Sujan Singh Maharaj (place_of_worship, 11427m) | New Delhi Juma Masjid (muslim_place_of_worship, 11868m) |
| ram mandir sant nagar | worship | WRONG | Shree 108 Sant Durbal Nath Ji Mandir (hindu_place_of_worship, 11761m) | Sant Samagam Gurudwara, Karol Bagh (place_of_worship, 11447m) | Gurudwara Sant Sujan Singh Maharaj (place_of_worship, 11427m) |
| sheetla mata mandir karawal nagar | worship | EXACT | Shitla Mata Mandir (religious_organization, 1307m) | Satya Kabeer Mandir (hindu_place_of_worship, 425m) | Shiv Vihar (hindu_place_of_worship, 813m) |
| madni masjid karawal nagar | worship | NEAR | Hazrat Bilal Masjid (muslim_place_of_worship, 953m) | Raza Masjid (muslim_place_of_worship, 1651m) | Dilshah Masjid (muslim_place_of_worship, 1593m) |
| shiv shakti mandir karawal nagar | worship | NEAR | Shri Baba Amarnath Shiv Shakti Sewa Trust (hindu_place_of_worship, 2297m) | Shiv Vihar (hindu_place_of_worship, 813m) | Shri Shiv Mandir (hindu_place_of_worship, 1287m) |
| markazi masjid karawal nagar | worship | NEAR | Hazrat Bilal Masjid (muslim_place_of_worship, 953m) | Raza Masjid (muslim_place_of_worship, 1651m) | Dilshah Masjid (muslim_place_of_worship, 1593m) |
| gurudwara karawal nagar | worship | NEAR | Sachkhand Nanak Dham (place_of_worship, 881m) | shiv mandir (place_of_worship, 1970m) | Pandav Nagar Gurudwara (place_of_worship, 12366m) |
| ram mandir karawal nagar | worship | EXACT | Shri Ram Mandir (religious_organization, 1300m) | Baba Mohan Ram Mandir (hindu_place_of_worship, 1903m) | Shri Ram Mandir (hindu_place_of_worship, 3187m) |
| sheetla mata mandir gokalpur | worship | WRONG | Mata Sundari Gurdwara (place_of_worship, 14449m) | Shri Mata Vaishno Shrine Board Trust (hindu_place_of_worship, 14902m) | Dakhina Kali Mata Mandir (hindu_place_of_worship, 13768m) |
| madni masjid gokalpur | worship | WRONG | Masjid Jannati jumme ki namaz 1:30 (muslim_place_of_worship, 5800m) | Chhappar Wali Masjid (muslim_place_of_worship, 6763m) | Fatima Masjid (muslim_place_of_worship, 7036m) |
| shiv shakti mandir gokalpur | worship | WRONG | Shiv Shakti Mandir (hindu_place_of_worship, 12839m) | Shiv Shakti Valmiki Mandir (place_of_worship, 11864m) | Shiv Mandir (place_of_worship, 12330m) |
| markazi masjid gokalpur | worship | WRONG | Markazi Jama Masjid (muslim_place_of_worship, 6959m) | Masjid Jannati jumme ki namaz 1:30 (muslim_place_of_worship, 5800m) | Chhappar Wali Masjid (muslim_place_of_worship, 6763m) |
| gurudwara gokalpur | worship | WRONG | SHAKUMBHARI MANDIR (place_of_worship, 6793m) | shiv mandir (place_of_worship, 4431m) | Shiv Mandir (place_of_worship, 6436m) |
| ram mandir gokalpur | worship | WRONG | Shri ram mandir (hindu_place_of_worship, 7268m) | Shri Ram Mandir (hindu_place_of_worship, 6031m) | Baba Mohan Ram Mandir (hindu_place_of_worship, 4464m) |
| sheetla mata mandir mandoli | worship | WRONG | Mata Sundari Gurdwara (place_of_worship, 10633m) | Shri Mata Vaishno Shrine Board Trust (hindu_place_of_worship, 11189m) | Dakhina Kali Mata Mandir (hindu_place_of_worship, 9980m) |
| madni masjid mandoli | worship | NEAR | Badi Masjid (religious_organization, 1207m) | Dargah Wali Masjid (muslim_place_of_worship, 967m) | Saeeda Masjid (muslim_place_of_worship, 1726m) |
| shiv mandir mandoli | worship | EXACT | Shiv Mandir (hindu_place_of_worship, 383m) | Shiv Mandir (hindu_place_of_worship, 826m) | Shiv Mandir (hindu_place_of_worship, 1206m) |
| markazi masjid mandoli | worship | NEAR | Badi Masjid (religious_organization, 1207m) | Dargah Wali Masjid (muslim_place_of_worship, 967m) | Saeeda Masjid (muslim_place_of_worship, 1726m) |
| gurudwara mandoli | worship | NEAR | SHAKUMBHARI MANDIR (place_of_worship, 2010m) | shiv mandir (place_of_worship, 1498m) | Sri Prachin Kaal Bhairav Nath Mandir (place_of_worship, 2499m) |
| ram mandir mandoli | worship | NEAR | Shri ram mandir (hindu_place_of_worship, 2291m) | Baba Mohan Ram Mandir (hindu_place_of_worship, 1665m) | Shri Ram Mandir (religious_organization, 1970m) |
| sheetla mata mandir trilokpuri | worship | WRONG | Mata Sundari Gurdwara (place_of_worship, 7327m) | Shri Mata Vaishno Shrine Board Trust (hindu_place_of_worship, 7831m) | Dakhina Kali Mata Mandir (hindu_place_of_worship, 7322m) |
| madni masjid trilokpuri | worship | NEAR | Masjid-Block 27 Trilokpuri (religious_organization, 968m) | Gurudwara Trilokpuri (place_of_worship, 924m) | Madina Masjid (muslim_place_of_worship, 727m) |
| shiv mandir trilokpuri | worship | EXACT | Shri Shiv Gorakhnath & Vaishno Devi Mandir (hindu_place_of_worship, 684m) | Bhagwan Shiv Mandir (religious_organization, 1097m) | Shiv Mandir (building, 797m) |
| markazi masjid trilokpuri | worship | NEAR | Masjid-Block 27 Trilokpuri (religious_organization, 968m) | Gurudwara Trilokpuri (place_of_worship, 924m) | Madina Masjid (muslim_place_of_worship, 727m) |
| gurudwara trilokpuri | worship | EXACT | Gurudwara Trilokpuri (place_of_worship, 924m) | Gurudwara Guru Singh Sabha (place_of_worship, 923m) | Bhagwat Dham (place_of_worship, 1371m) |
| kali mandir trilokpuri | worship | NEAR | Gurudwara Trilokpuri (place_of_worship, 924m) | Kali Bari Mayur Vihar (hindu_place_of_worship, 795m) | Mayur Vihar Phase II Kali Bari (hindu_place_of_worship, 379m) |
| sheetla mata mandir ghazipur | worship | WRONG | Mata Sundari Gurdwara (place_of_worship, 9131m) | Shri Mata Vaishno Shrine Board Trust (hindu_place_of_worship, 9716m) | Dakhina Kali Mata Mandir (hindu_place_of_worship, 8952m) |
| madni masjid ghazipur | worship | NEAR | Madina Masjid (muslim_place_of_worship, 1971m) | Jama Masjid (muslim_place_of_worship, 1790m) | Subhania Masjid( Badi Masjid) (muslim_place_of_worship, 931m) |
| shiv mandir ghazipur | worship | EXACT | Shiv Mandir (religious_organization, 625m) | Shiv shakti mandir (hindu_place_of_worship, 1326m) | Shiv Om Mandir (place_of_worship, 2504m) |
| markazi masjid ghazipur | worship | NEAR | Madina Masjid (muslim_place_of_worship, 1971m) | Jama Masjid (muslim_place_of_worship, 1790m) | Subhania Masjid( Badi Masjid) (muslim_place_of_worship, 931m) |
| gurudwara ghazipur | worship | NEAR | Gurudwara Madhu Vihar (place_of_worship, 2549m) | Gurudwara Sri Guru Singh Sabha (place_of_worship, 1516m) | Shri Sanatam Dharm Mandir (place_of_worship, 1934m) |
| ram mandir ghazipur | worship | NEAR | Ram Mandir Street (residential, 2879m) | Jai Shri ram (hindu_place_of_worship, 2363m) | Prachin Mandir Kali Kholi Dham (hindu_place_of_worship, 849m) |
| noida sector 66 | sector | NEAR | Noida - Mamura Sec 66 (bank_or_credit_union, 1854m) | OYO Rooms Noida Sector 66 (hotel, 1179m) | OYO Townhouse 590 Sector 66 Noida (hotel, 1872m) |
| noida sector 70 | sector | EXACT | Noida Sector 70 (proposed, 916m) | Noida Sec - 70 (fashion_and_apparel_store, 962m) | Bright Wheels Noida Sector 70 (place_of_learning, 7131m) |
| noida sector 119 | sector | WRONG | Noida Sector 119 (lodging, 11372m) | Fitso Sector 119 Noida, Swimming (swimming_pool, 11250m) | FNP Cakes - Cakes, Plants & Gift Hampers i (casual_eatery, 11343m) |
| noida sector 122 | sector | WRONG | Noida Sector 122 (sector, 13078m) | Aspam Preschool Sec 122, Noida (preschool, 13103m) | Footprints Childcare - Sector 122, Noida (preschool, 12934m) |
| noida sector 12 | sector | EXACT | Noida - Sec 12 (bank_or_credit_union, 526m) | Noida - Sector 12 (sector, 932m) | Noida sec-12 up (lodging, 4202m) |
| noida sector 27 | sector | EXACT | Noida Sector 27 (sector, 912m) | Noida - Sec 27 (bank_or_credit_union, 922m) | Noida, Sector-27 (lodging, 1103m) |
| noida sector 93 | sector | NEAR | HDFC Bank Sec 93 Noida branch (place, 877m) | Super Townhouse Sector 93 Noida Expressway (hotel, 437m) | Hotel O Sector 93 Noida Formerly Grand Emp (hotel, 696m) |
| noida sector 108 | sector | NEAR | Sector 108 Noida Central Park (park, 3926m) | Collection O Sector 108 Noida (hotel, 3683m) | Peas in Pod Preschool & Daycare, Sector 10 (preschool, 4161m) |
| noida sector 115 | sector | WRONG | Sambhu Dayal Public School Sec 115 Noida G (place_of_learning, 8924m) | 115 IP Extension (address, 18964m) | 115 Sadbhavana Road (address, 18964m) |
| noida sector 135 | sector | EXACT | Noida Sector 135 (historic_site, 1753m) | PHD Sec 135 Noida (fast_food_restaurant, 10777m) | Genpact Noida Sector 135 (professional_service, 20702m) |
| noida sector 143 | sector | EXACT | Noida Sector 143 (sector, 356m) | Noida Sector 143 metro station (metro, 356m) | The Detailing Mafia Noida Sec 143 (automotive_service, 15130m) |
| noida sector 150 | sector | WRONG | 150 Shanti Lane (address, 24211m) | Kidzee Noida 150 (place_of_learning, 25426m) | ACE Golfshire Sector 150 Noida (historic_site, 3307m) |
| greater noida sector 1 | sector | NEAR | Greater Noida West Sector 1 (sector, 10458m) | Siora Kidz | Best Preschool in Sector 1 No (preschool, 11987m) | Makoons Play School, Sector 1, Greater Noi (elementary_school, 10591m) |
| greater noida sector 16 | sector | WRONG | Greater Noida - Sector 16 (sector, 16505m) | Greater Noida - Sec 16 B (bank_or_credit_union, 16505m) | Greater Noida Property,Sector 16 B (historic_site, 16178m) |
| greater noida sector 37 | sector | WRONG | Bistro 37 (cafe) | Bistro 37 (cafe) | Kosmos 37 (apartments) |
| knowledge park 3 | sector | EXACT | Knowledge Park 3 (park, 1368m) | OYO Townhouse 173 Knowledge Park 3 (hotel, 478m) | Aakash Institute, Knowledge Park-3 (Greate (education, 1854m) |
| knowledge park 5 | sector | WRONG | Knowledge Park 5 (park, 9433m) | 5 (living_street, 23903m) | 5 (living_street, 26819m) |
| surajpur greater noida | sector | NEAR | Crown plazza surajpur greater noida (hotel, 3020m) | Collectorate & District Court, Greater Noi (government_office, 2535m) | Arya Deep Public School,Surajpur Greater N (middle_school, 3072m) |
| ecotech 2 greater noida | sector | WRONG | Cricket Point,  Cricket Ground 2 (stadium_arena, 17198m) | Ecotech Machineries (automotive_service, 30815m) | Ecotech 12 / Tech Zone Station (proposed, 16393m) |
| chi 3 greater noida | sector | WRONG | 3 Idiots Chinese Adda (fast_food, 29955m) | Chirag Delhi Metro Gate No. 3 (subway_entrance, 28157m) | Chik-inn ,A-3 (hotel, 45729m) |
| sector 43 gurgaon | sector | EXACT | Gurgaon Sector 43 (sector, 1446m) | Birla Fertility & IVF - Gurgaon, Sector- 4 (diagnostics_imaging_or_lab_service, 1462m) | Gurgaon Sector 43 ,shalom H (specialized_health_care, 1446m) |
| sector 44 gurgaon | sector | EXACT | Gurgaon Sector 44 (sector, 617m) | Gurgaon Sector 44 Substation (substation, 575m) | Gurgaon Sector 44 Substation (gate, 659m) |
| sector 46 gurgaon | sector | NEAR | Gurgaon Sector 46 (sector, 4074m) | Sector 46 (place, 3743m) | Sector 46 (place, 3623m) |
| sector 50 gurgaon | sector | WRONG | Hilton Gurgaon Sector 50 (hotel, 32729m) | Holiday Inn Express Gurugram Sector 50 (hotel, 1916m) | Nirvana Library ,Sector 50 , Gurugram (library, 1684m) |
| sector 51 gurgaon | sector | NEAR | Apexo Dental, Sector -51, Gurgaon (dental_clinic, 7559m) | Townhouse Sector 51 Gurgaon (hotel, 679m) | Apollo Pharmacy Gurgaon Sec 51 (pharmacy_and_drug_store, 664m) |
| sector 57 gurgaon | sector | NEAR | OYO 7530 Sector 57 (resort, 7285m) | Gurugram Sector 57 (substation, 1102m) | Brainobrain - Sector 57, Gurugram (education, 781m) |
| sector 82 gurgaon | sector | WRONG | CarzSpa Gurgaon Sector 82 (automotive_service, 8796m) | ICICI Bank Gurgaon Sector 82 (bank_or_credit_union, 10454m) | Brahma Kumaris Gurugram Sector 82 (wellness_service, 8192m) |
| sector 90 gurgaon | sector | WRONG | Holiday Inn Gurugram Sector 90 (hotel, 13233m) | Holiday Inn Gurugram Sector 90 (hotel, 8988m) | Clove Dental Clinic - Sector 90 Saphire, G (dental_clinic, 8964m) |
| dlf phase 3 gurgaon | sector | EXACT | DLF Phase 3 Gurgaon (professional_service, 544m) | Chaayos - DLF Phase 3 Gurgaon (non_alcoholic_beverage_venue, 1703m) | Amazone Residency Dlf Phase 3 Gurugram (hotel, 908m) |
| sushant lok 1 | sector | EXACT | Sushant Lok 1 Market (food_and_beverage_store, 854m) | Sushant Lok-1 (historic_site, 1654m) | C Block Sushant Lok 1 (residential, 1233m) |
| sector 21 faridabad | sector | EXACT | Faridabad - Sector 21 (sector, 1463m) | Sector 21 (residential, 18966m) | Sector 21 (neighborhood, 27874m) |
| sector 15 faridabad | sector | NEAR | Sector 15, Faridabad (lodging, 2851m) | Faridabad Sector 15 (sector, 2559m) | HDFC Securities - Sec 15 Faridabad (financial_service, 2808m) |
| sector 16 faridabad | sector | NEAR | Sector 16, Faridabad (shopping, 2213m) | Faridabad Sector 16 (sector, 3583m) | Sector 16 (commercial, 19769m) |
| sector 17 faridabad | sector | WRONG | Sector 17 (residential, 29456m) | Sector 17 (commercial, 43144m) | Sector 17 (locality, 43454m) |
| sector 8 faridabad | sector | NEAR | Sector 8 Faridabad (lodging, 4302m) | Sector 8 (locality, 36456m) | Sector 8 (neighborhood, 24815m) |
| sector 10 faridabad | sector | WRONG | S.S.M Sr Sec School (place_of_learning, 11069m) | Sector 35 (residential, 11465m) | Sector 34 (residential, 11410m) |
| sector 84 faridabad | sector | WRONG | Faridabad (administrative, 11525m) | Sector 84 (macrohood, 38705m) | 84 Sector 4 (address, 32197m) |
| sector 86 faridabad | sector | NEAR | EuroKids PreSchool Sec 86-Summer Palm Fari (preschool, 5523m) | Sai Nursery Sector 86 Faridabad Haryana (professional_service, 8270m) | EuroKids Preschool Sector 86 Faridabad, Be (preschool, 3840m) |
| nit 3 faridabad | sector | NEAR | Footprints Childcare - NIT 3, DAV College  (family_service, 3790m) | NIT 3 (residential, 3601m) | Vaid Slimming NIT 3 (wellness_service, 6855m) |
| ballabhgarh | sector | EXACT | Ballabhgarh Metro Station (train_station, 83m) | Paramount Ballabhgarh (education, 17361m) | Faridabad - BallabhGarh (bank_or_credit_union, 2275m) |
| narela railway station | term | EXACT | Narela Railway Station (train_station, 453m) | Narela (station, 449m) | Narela Bus Stop (public_transit_facility_or_service, 1347m) |
| holambi kalan station | term | NEAR | Holambi Kalan railway station (station, 3803m) | Holambi Kalan Railroad Station (station, 3913m) | Holambi Kalan Bus Stop (public_transit_facility_or_service, 3736m) |
| khera kalan station | term | NEAR | Railway Station Khera Khurd (train_station, 5403m) | Rohini Sector 27 Bus Stop (public_transit_facility_or_service, 5248m) | Khera Kalan Railroad Station (station, 5539m) |
| badli railway station | term | EXACT | Badli railway station (station, 299m) | Badli Railways Station (train_station, 313m) | Badli Railway Station (platform, 416m) |
| adarsh nagar station delhi | term | NEAR | police station-Adarsh Nagar (police_station, 675m) | Adarsh Nagar metro station (train_station, 128m) | Adarsh Nagar metro station (metro, 151m) |
| ghevra station | term | NEAR | Ghevra railway station (station, 949m) | Ghevra metro station (metro, 1303m) | Ghevra Metro Station-Gate No2 (train_station, 1271m) |
| mundka station | term | EXACT | Mundka metro station (metro, 372m) | Mundka railway station (station, 895m) | Mundka Metro Station (train_station, 450m) |
| nangloi railway station | term | EXACT | Nangloi Railway Station (station, 854m) | Nangloi railway station (train_station, 916m) | OYO Metro City Stay Home Near Nangloi Rail (resort, 899m) |
| patel nagar station delhi | term | WRONG | Medanta Lab - Kamla Nagar (public_transit_facility_or_service, 3795m) | Kamla Market Bus Stop (public_transit_facility_or_service, 3356m) | OYO 3594 Kamla Nagar (public_transit_facility_or_service, 3155m) |
| daya basti station | term | EXACT | Daya basti railway station (station, 859m) | Sarai metro station (metro, 25023m) | Sarai Metro Station-Gate No 1 (train_station, 24868m) |
| tilak bridge station | term | NEAR | Tilak Bridge railway station (train_station, 2524m) | Tilak Bridge (station, 2574m) | Tilak Bridge (bridge, 2383m) |
| shivaji bridge station | term | EXACT | Shivaji Bridge railway station (train_station, 830m) | Unique Filling Station (gas_station, 928m) | Minto Road railway station (station, 727m) |
| vivekanand puri halt | term | EXACT | Vivekanand Puri Halt railway station (station, 1343m) | Tea Halt (fast_food, 13771m) | Nasirpur Halt railway station (station, 11171m) |
| anand vihar bus adda | term | NEAR | Local Bus Terminal (public_transit_facility_or_service, 145m) | Kaushambhi Bus Station (public_transit_facility_or_service, 368m) | Kaushambi Bus Stand (bus_station, 341m) |
| sarai kale khan bus stand | term | EXACT | Sarai Kale Khan Bus Stop (public_transit_facility_or_service, 483m) | Sarai Kale Khan ISBT (platform, 415m) | Sarai Kale Khan - Nizamuddin (stop, 368m) |
| nizamuddin bus stand | term | NEAR | Shiv Mandir Nizamuddin Bus Stop (public_transit_facility_or_service, 892m) | Hazarat Nizamuddin (platform, 478m) | Dargah Hazarat Nizamuddin (platform, 469m) |
| badarpur border bus stand | term | NEAR | Badarpur (platform, 1737m) | Tughlaqabad Metro Station (travel_and_transportation, 1813m) | Tughlakabad (stop, 1798m) |
| loni bus stand | term | NEAR | Shanti Nagar (public_transit_facility_or_service, 1632m) | Loni No 2 Bus Stop (public_transit_facility_or_service, 2004m) | Loni Bus Stop (public_transit_facility_or_service, 5153m) |
| narela bus stand | term | NEAR | Narela Bus Stop (public_transit_facility_or_service, 1654m) | Narela Sector 5 & 6 Bus Stop (public_transit_facility_or_service, 2388m) | Narela Road Bawana Bus Stop (public_transit_facility_or_service, 6755m) |
| bahadurgarh bus stand | term | NEAR | Bus stand bahadurgarh (bus_station, 1638m) | Pandit Shree Ram Sharma (stop, 2304m) | Tikri Border Bus Stop (public_transit_facility_or_service, 3176m) |
| tikri border | term | NEAR | Tikri Border (social_or_community_service, 2525m) | Tikri Border metro station (metro, 2222m) | Tikri Border Metro Station (travel_and_transportation, 1439m) |
| welcome metro station | term | EXACT | Welcome Metro Station (train_station, 53m) | Welcome Metro Station (Pink Line) (transportation, 50m) | Welcome Metro Station (Red Line) (transportation, 67m) |
| jaffrabad metro station | term | EXACT | Jaffrabad metro station (metro, 761m) | Jaffrabad (station, 765m) | Ghonda Chowk Bus Stop (public_transit_facility_or_service, 991m) |
| maujpur metro station | term | NEAR | Ghonda Chowk Bus Stop (public_transit_facility_or_service, 1065m) | Babarpur Terminal Bus Stop (public_transit_facility_or_service, 511m) | Mojpur More Bus Stop (public_transit_facility_or_service, 657m) |
| babarpur metro | term | EXACT | Maujpur - Babarpur metro station (metro, 330m) | SPOT ON Liv In Guest House Near Maujpur-Ba (hotel, 1108m) | Babarpur Terminal Bus Stop (public_transit_facility_or_service, 397m) |
| fortis faridabad | anchor | NEAR | Dr. Shubham Vatsya CONSULTANT GASTROENTERO (diagnostics_imaging_or_lab_service, 3372m) | Dr. PANKAJ BATRA PRINCIPAL CONSULTANT CARD (diagnostics_imaging_or_lab_service, 3322m) | Dr. HITESH PANT ADDITIONAL DIRECTOR PAEDIA (diagnostics_imaging_or_lab_service, 3370m) |
| amrita hospital faridabad | anchor | NEAR | Amrita Hospital, Faridabad (amenity:hospital, 7972m) | Amrita Hospital Projects- Faridabad (hospital, 8073m) | CGHS Dispensary Pandara Road (hospital, 30279m) |
| qrg hospital faridabad | anchor | WRONG | Parijat Hospital, Faridabad (hospital, 6498m) | Faridabad Family Clinic (hospital, 7656m) | Sparsh Hospital, Faridabad (hospital, 7027m) |
| sarvodaya hospital faridabad | anchor | WRONG | Centre For Dentistry And Maxillofacial Sur (dental_clinic, 5069m) | SLV Multispeciality Clinic (hospital, 20013m) | Seeds of Innocens (hospital, 19766m) |
| yatharth hospital noida | anchor | WRONG | Detailing Bot Noida • Infront Of Yatharth  (automotive_service, 9757m) | Dr. Vimal Dassi | Best Urologist in Sector (apartment, 11568m) | Dr. Ivan Singh | Best Ophthalmologist in S (hospital, 11568m) |
| yatharth hospital greater noida | anchor | WRONG | Detailing Bot Noida • Infront Of Yatharth  (automotive_service, 12245m) | DermaKācā | Skin, Hair Treatment & Aesthet (specialized_health_care, 26711m) | Dr. Mohit Bhandari - Best Doctor for Weigh (specialized_health_care, 26961m) |
| felix hospital noida | anchor | NEAR | Felix Hospital Polyclinic (government_department, 10310m) | Dr. Vimal Dassi | Best Urologist in Sector (apartment, 10675m) | Dr. Ivan Singh | Best Ophthalmologist in S (hospital, 10675m) |
| civil hospital gurgaon | anchor | NEAR | Old Civil Hospital (Demolished), Gurgaon (government, 564m) | Sushruta Trauma Centre (hospital, 31332m) | Dr Abhishek Sharma- Orthopaedics (specialized_health_care, 30906m) |
| mayom hospital gurgaon | anchor | EXACT | Kidney Healers Unit at Mayom Hospital - Be (specialized_medical_facility, 1362m) | Lotus Hospital, Gurgaon (hospital, 1778m) | Mamta Hospital, Gurgaon (hospital, 1856m) |
| columbia asia ghaziabad | anchor | EXACT | Columbia Asia Hospital (amenity:hospital) | Columbia Asia Hospital (hospital) | Columbia Asia Hospital (hospital) |
| dps dwarka | anchor | WRONG | DPS Dwarka Expressway (place_of_learning, 14661m) | DPS Global (preschool, 16202m) | DPS Films (arts_and_entertainment, 14666m) |
| dps faridabad | anchor | NEAR | DPS Faridabad Hostel (place_of_learning, 6183m) | Dpsg Faridabad (place_of_learning, 12244m) | DPS Greater Faridabad (place_of_learning, 4074m) |
| dps gurgaon | anchor | NEAR | DPS Gurgaon Sector 84 (elementary_school, 16007m) | Dps gurgaon Sec- 45. (place_of_learning, 2335m) | Junior DPS Gurugram (preschool, 3594m) |
| amity gurgaon | anchor | NEAR | Gurgaon (place_of_learning) | Gurgaon (city) | Amity University, Gurgaon (university) |
| shiv nadar school noida | anchor | WRONG | Setu School, Shiv Mandir Gali Village Nith (place_of_learning, 22454m) | Sanfort Play School | Best Pre School & Da (preschool, 20972m) | FirstCry Intellitots Preschool & Daycare-  (preschool, 21051m) |
| step by step school noida | anchor | NEAR | Gurusthanam Grooming School Radhika Enclav (education, 1614m) | Junior Delhi School, Sec 134 - Noida (place_of_learning, 1010m) | Day Care School Noida (preschool, 186m) |
| cambridge school noida | anchor | EXACT | Cambridge School Noida (school, 1533m) | Cambridge School Greater Noida (place_of_learning, 20647m) | Cambridge School Srinivaspuri (school, 1533m) |
| khaitan public school noida | anchor | NEAR | Delhi Modern Public School (high_school, 2930m) | M A S Public School (place_of_learning, 2929m) | English & Personality Development Institut (specialty_school, 2458m) |
| somerville school noida | anchor | EXACT | Somerville School (Noida) (place_of_learning, 770m) | Somerville School, Greater Noida (school, 21910m) | Somerville School Greater NOIDA (place_of_learning, 35440m) |
| modern school faridabad | anchor | NEAR | Modern School Faridabad (school, 4072m) | Arya Modern Public School,Faridabad (place_of_learning, 11578m) | Modern Vidya Niketan School, Aravali Hills (school, 7761m) |
| lado sarai | anchor | EXACT | Lado sarai (locality, 1252m) | Lado Sarai (macrohood, 882m) | Lado Sarai (construction, 1253m) |
| kapashera village | anchor | EXACT | Kapashera Village (historic_site, 252m) | Kapashera Village Bus Stop (public_transit_facility_or_service, 412m) | Kapashera Village (platform, 815m) |
| nangli sakrawati | anchor | NEAR | Nangli Sakrawati (village, 5179m) | Nangli Sakrawati (political, 5374m) | Nangli Sakrawati (locality, 5273m) |
| dallupura village | anchor | NEAR | Dallupura Village (village, 2311m) | Dallupura Village (locality, 2214m) | Dallupura Chowk (junction, 1888m) |
| razapur khurd | anchor | NEAR | Yadav Stationers-Razapur Khurd (books_music_and_video_store) | Razapur (neighborhood) | Razapur (locality) |
| shikarpur village | anchor | WRONG | Daultalbad Village (locality) | Carterpuri Village (neighborhood) | Jhajgarh Village (arts_and_entertainment) |
| saboli village | anchor | NEAR | Mandoli Village (arts_and_entertainment, 2628m) | Gamri Village (neighborhood, 7809m) | Chandrawali village (historic_site, 7166m) |
| gamri village | anchor | NEAR | Gamri Village (neighborhood, 6060m) | Gamri Road (tertiary, 5148m) | Gamri Extension (arts_and_entertainment, 5999m) |
| ghonda | anchor | EXACT | Ghonda (locality, 1967m) | Ghonda (locality, 1266m) | Ghonda Chauhan Bangar (locality, 1955m) |
| pul pehladpur | anchor | NEAR | Pul pehladpur (historic_site, 2444m) | Badi Masjid Pul Pehladpur (muslim_place_of_worship, 1877m) | Police Station Pul Prahladpur (police, 1699m) |