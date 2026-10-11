# sweep-4 query corpus — post-anchorsink-fix verification set (n=150)

Lane: acct2 probe. Status: **STAGED — do not run until coordinator go-signal after deploy.**

Purpose: verify the anchorsink engine fix generalizes — fresh wording, new entity names,
new deep localities vs sweeps 1–3 (no query string repeated). Same probe + verdict
classes as sweep-3 (EXACT/NEAR/CLUSTER/WRONG/MISS; verdict = does top-3 make
geographic sense, right locality not far same-name sink).

## Group A — deep-locality worship (55) — the anchorsink test

Sweep-3's worst form (22/28 WRONG — every `jama masjid <locality>` sank to Old Delhi).
Fresh entity names × 9 localities; pass = worship row actually in the named locality.

### burari (7)
sheetla mata mandir burari · madni masjid burari · gurudwara singh sabha burari ·
shiv shakti mandir burari · ameen masjid burari · ram mandir burari · markazi masjid burari

### seelampur (6)
shiv shakti mandir seelampur · madni masjid seelampur · gurudwara singh sabha seelampur ·
sheetla mata mandir seelampur · ameen masjid seelampur · ram mandir seelampur

### mustafabad (6)
markazi masjid mustafabad · sheetla mata mandir mustafabad · gurudwara mustafabad ·
madni masjid mustafabad · shiv shakti mandir mustafabad · quba masjid mustafabad

### sant nagar (6)
shiv shakti mandir sant nagar · madni masjid sant nagar · gurudwara sant nagar ·
sheetla mata mandir sant nagar · ameen masjid sant nagar · ram mandir sant nagar

### karawal nagar (6)
sheetla mata mandir karawal nagar · madni masjid karawal nagar · shiv shakti mandir
karawal nagar · markazi masjid karawal nagar · gurudwara karawal nagar · ram mandir karawal nagar

### gokalpur (6)
sheetla mata mandir gokalpur · madni masjid gokalpur · shiv shakti mandir gokalpur ·
markazi masjid gokalpur · gurudwara gokalpur · ram mandir gokalpur

### mandoli (6)
sheetla mata mandir mandoli · madni masjid mandoli · shiv mandir mandoli ·
markazi masjid mandoli · gurudwara mandoli · ram mandir mandoli

### trilokpuri (6)
sheetla mata mandir trilokpuri · madni masjid trilokpuri · shiv mandir trilokpuri ·
markazi masjid trilokpuri · gurudwara trilokpuri · kali mandir trilokpuri

### ghazipur (6)
sheetla mata mandir ghazipur · madni masjid ghazipur · shiv mandir ghazipur ·
markazi masjid ghazipur · gurudwara ghazipur · ram mandir ghazipur

## Group B — NCR sector/colony queries (40)

### noida sectors (12)
noida sector 66 · noida sector 70 · noida sector 119 · noida sector 122 ·
noida sector 12 · noida sector 27 · noida sector 93 · noida sector 108 ·
noida sector 115 · noida sector 135 · noida sector 143 · noida sector 150

### greater noida (8)
greater noida sector 1 · greater noida sector 16 · greater noida sector 37 ·
knowledge park 3 · knowledge park 5 · surajpur greater noida ·
ecotech 2 greater noida · chi 3 greater noida

### gurgaon sectors (10)
sector 43 gurgaon · sector 44 gurgaon · sector 46 gurgaon · sector 50 gurgaon ·
sector 51 gurgaon · sector 57 gurgaon · sector 82 gurgaon · sector 90 gurgaon ·
dlf phase 3 gurgaon · sushant lok 1

### faridabad sectors (10)
sector 21 faridabad · sector 15 faridabad · sector 16 faridabad · sector 17 faridabad ·
sector 8 faridabad · sector 10 faridabad · sector 84 faridabad · sector 86 faridabad ·
nit 3 faridabad · ballabhgarh

## Group C — rail / bus terminals (25)

### ring/branch railway stations (13)
narela railway station · holambi kalan station · khera kalan station ·
badli railway station · adarsh nagar station delhi · ghevra station · mundka station ·
nangloi railway station · patel nagar station delhi · daya basti station ·
tilak bridge station · shivaji bridge station · vivekanand puri halt

### bus stands (8)
anand vihar bus adda · sarai kale khan bus stand · nizamuddin bus stand ·
badarpur border bus stand · loni bus stand · narela bus stand ·
bahadurgarh bus stand · tikri border

### metro (4, fresh vs sweeps 1–3)
welcome metro station · jaffrabad metro station · maujpur metro station · babarpur metro

## Group D — schools / hospitals / colonies deep NCR (30)

### hospitals (10)
fortis faridabad · amrita hospital faridabad · qrg hospital faridabad ·
sarvodaya hospital faridabad · yatharth hospital noida ·
yatharth hospital greater noida · felix hospital noida · civil hospital gurgaon ·
mayom hospital gurgaon · columbia asia ghaziabad

### schools (10)
dps dwarka · dps faridabad · dps gurgaon · amity gurgaon ·
shiv nadar school noida · step by step school noida · cambridge school noida ·
khaitan public school noida · somerville school noida · modern school faridabad

### deep colonies/villages (10)
lado sarai · kapashera village · nangli sakrawati · dallupura village ·
razapur khurd · shikarpur village · saboli village · gamri village · ghonda · pul pehladpur

## Verdict framing (same as sweep-3)

- EXACT: top hit = intended place (≤ ~500m GT)
- NEAR: right locality, intended row in top-3 but not top
- CLUSTER: same-name rows at conflicting coords, top not clearly right
- WRONG: confident wrong top (incl. far same-name sink, wrong-city/mis-coord rows)
- MISS: empty / garbage
- Watchlist vs sweep-3 artifacts: `ITO metro station` far-sink leaks; `Jama Masjid`
  Old-Delhi universal sink; `Guru Dwara Noida Sec-37`/`Bombay Wali Masjid` wrong-entity
  sinks; degenerate line rows (`Blue Line`, `Aqua Line`, `Rapid MetroRail Gurgaon`).
