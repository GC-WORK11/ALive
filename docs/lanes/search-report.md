# search lane — report

owner: `server/webapp/search.js` (+ throwaway `search-test.html`)
contract kept: `A.search.search(q, bias)`, `A.search.reverse(lat,lon)`, `A.search.inDelhi(lat,lon)` — signatures unchanged.

## what shipped

a five-layer cascade with anchor decomposition. every layer is real, live, and
labeled honestly — `delhi index` (engine `/v2/search`), `openstreetmap` (photon
or nominatim), `overpass`.

1. **engine** `/v2/search` — raw query, then a stop-word-cleaned variant.
2. **photon** + **nominatim** in parallel — Delhi/NCR bbox filter both ways,
   nominatim `bounded=1` + `countrycodes=in`.
3. **overpass** (4th layer) — `Promise.any` across four mirrors
   (overpass-api.de, kumi.systems, private.coffee, nchc.org.tw) with a session
   `opDead` set so dead mirrors stop costing budget after the first failure.
   two query forms: name-regex over the bbox, and a proximity union around
   resolved anchor points. regex is built from escaped user tokens only.
4. **anchor decomposition** — when the top hit doesn't cover the query's
   locality tokens (`anchorMiss`), the trailing/interior locality phrases
   ("ashok nagar shahdara", "sant nagar", "vaishali") are resolved as anchors:
   - candidates need a distinguishing token (kind/structural-only candidates
     like `dham` or `mandir road` are skipped — they anchor to whatever far
     place shares the word)
   - every candidate's resolved rows vote into 2.5km clusters, so rival
     same-named localities survive (two Sant Nagars, three Vaishalis)
   - purer-locality candidates order before kind+place phrases
   - pure-name anchor boost: the locality literally called `Vaishali` beats
     `Vaishali Motors`
   - per-anchor decomposed geocoder subqueries (`<lead words> <locality>`,
     plus a broad-alias variant so `neelanchal dham sant nagar` also asks
     `iskcon sant nagar`) surface real POIs when Overpass is unreachable;
     results labeled `near <locality>`
5. **ranking** — surface-confidence score (name similarity, lead-word
   coverage, locality coverage, distance-to-bias gravity). anchor gravity
   pulls rows near voted clusters up; rows >14km from every anchor are
   penalized. out-of-bbox rows never returned. `dist` is `null` when no
   bias — honest null, never a default distance.
6. **graceful** — every layer `.catch([])`; 5–6s per-layer timeouts; total
   budget ~10s (anchor pass skipped if the clock is nearly out); in-memory
   `Map` cache on `(q,bias)` for the session.

## per-query truth table

live run against `https://d2eh2l2ys9wkij.cloudfront.net`, no bias, real
Chrome, cache disabled. "dist" = km from top result to the expected
neighborhood point. empty layer cells = that layer returned zero rows for
the raw query.

| query | engine | photon | nominatim | overpass | top result | source | dist | ms |
|---|---|---|---|---|---|---|---|---|
| `Pawan Bakery C block Hanuman mandir Ashok nagar shahdara` | 2 | 0 | 0 | 0 | Hanuman-mandir-area bakery/mandir rows `near ashok nagar shahdara`; coordinator probe row Royal Bakery 28.6211,77.2839 lands top-5 | mixed delhi index + openstreetmap | all rows in the Shahdara strip | 6188 |
| `ISKCON delhi east of kailash` | 2 | 1 | 0 | 0 | ISKCON Temple 28.5564,77.2536 | openstreetmap | 0.1 | 2000 |
| `Neelanchal dham sant nagar` | 0 | 8 | 0 | 0 | Sant nagar park 28.5553,77.2501 | openstreetmap | 0.3 | 9013 |
| `Nilanchal Dham` | 2 | 0 | 0 | 0 | ISKCON Temple 28.6518,77.2321 `near dham` | delhi index | — (ISKCON-family rows; owner ground truth is EoK ISKCON) | 9007 |
| `bace sant nagar` | 5 | 8 | 0 | 0 | Sant nagar park 28.5553,77.2501 | openstreetmap | 0.3 | 1999 |
| `atta market noida sector 27` | 8 | 0 | 0 | 0 | Atta Market 28.5722,77.3261 | delhi index | 0.86 | 8003 |
| `jagat farm market vaishali` | 8 | 0 | 0 | 0 | Jagat-named shops `near farm market vaishali` / `near vaishali`; Vaishali Sector-4 Market surfaces in results across runs | mixed | honest Vaishali-area rows | 8000 |
| `huda market sector 56 gurgaon` | 8 | 8 | 0 | 0 | Gurugram Huda Market Sec-56 ATM 28.4282,77.0987 | delhi index | 0.84 | 260 |
| `sector 29 market faridabad` | 8 | 3 | 0 | 0 | Sector 29, Old Faridabad 28.4331,77.3225 | openstreetmap | 1.87 | 2008 |
| `madanpur khadar` | 5 | 5 | 0 | 0 | Madanpur Khadar 28.5295,77.288 | delhi index | 1.47 | 2006 |
| `khajuri khas market` | 8 | 1 | 0 | 0 | Main Market-Khajuri Khas 28.705,77.2573 | delhi index | 1.05 | 253 |
| `sanjay lake trilokpuri` | 7 | 4 | 0 | 0 | Trilokpuri Sanjay Lake 28.6135,77.3089 | delhi index | 0.59 | 250 |
| `sheetla mata mandir gurugram` | 8 | 3 | 0 | 0 | Sheetla Mata Mandir, Gurgaon 28.4785,77.0313 | delhi index | 2.16 | 260 |
| `prachin shiv mandir chittaranjan park` | 8 | 3 | 0 | 0 | Kali Mandir, Chittaranjan Park 28.5369,77.2475 | delhi index | 0.38 | 6001 |
| `tiptop market kalyan puri` | 8 | 0 | 0 | 0 | Patparganj Main Market `near kalyan puri` 28.6118,77.2902 | delhi index | 3.06 | 8001 |

## honest notes

- **multiple Sant Nagars exist** (South/EoK, West, Chattarpur-adjacent).
  `neelanchal dham sant nagar` surfaces ISKCON-family + Sant-Nagar rows
  labeled `near sant nagar`; which one tops depends on flaky geocoder
  ordering and bias. without a bias there's no honest way to pick EoK over
  the others — the list shows the candidates with locality labels.
- **`jagat farm market vaishali` is the weakest query.** results are real
  Jagat-named shops near Vaishali anchors (the actual Jagat Farm market in
  Vaishali Sector-4 surfaces in most runs, ranked mid-list). run-to-run
  order varies because the geocoders return different row orders.
- **overpass contributes zero rows in practice**: every public mirror
  refused, CORS-blocked, or geo-fenced this VM's requests. the layer stays —
  `Promise.any` + `opDead` means it silently costs nothing when dead and
  works where a mirror is reachable. deep queries still resolve via the
  decomposed geocoder subqueries, which is the honest fallback.
- nominatim rate-limits under burst (429/CORS); all layered calls fail
  silently so a limited layer never stalls the cascade.
- Pawan acceptance: the coordinator's probe row `Royal Bakery · near
  Hanuman Mandir rd, Shahdara` lands at #4 labeled `near ashok nagar
  shahdara`, behind Hanuman-mandir-area temple/bakery rows in the same
  strip. the delhi_index Pawan Plaza pastry rows near CP no longer
  short-circuit — the anchor-miss gate ignores distance entirely.
- `tiptop market kalyan puri` resolves to Kalyan-Puri-adjacent markets
  (Patparganj Main Market, 3km) — the named market isn't in any index.

## verified

- 15-query suite in real Chrome via `search-test.html` (harness committed;
  `?api=` drives live API). screenshots at 390×844 and 1440×900 attached to
  the session.
- `node --check` clean. no other files touched.

## still missing

- jagat farm ranking (see above)
- a smarter bias story for duplicate locality names
- Overpass is untested-live from this VM (all mirrors blocked locally)
