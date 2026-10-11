# Lane U — purest places + hotels (Oct 11)

## What changed
**server/v2/city.py**
- `GET /v2/purest?lat&lon[&radius_km=15][&scope=ncr][&k=8]` (new). Ranks named
  gazetteer **localities and real parks** (junk "park" rows like banquets,
  a Domino's or embassies are filtered) around the user, by the live field
  PM2.5 at each place (`F.value`, the same read /aqi and /v2/stays use).
  A place counts only when its data is solid:
  - a **named live monitor within 6 km** (`nearest_station_km`; model fill points don't count),
  - **inside the field's extent** (`beyond_field_edge` false),
  - its finest district/sub-district row is `confidence == "field"` and
    **not `partial_field_coverage`** (the /v2/districts flags).
  Places that fail are left out and counted (`excluded.thin_data`, `excluded.partial_area`),
  never ranked. One place per ~2 km bucket (parks first), at least 1.2 km apart.
  Ties to the µg go to the closer place. All-caps names get title case.
  `pick = {index: 0, why: "cleanest air near you right now"}`. The row has
  `name, kind (park|area), lat, lon, pm25, aqi (US EPA, pm2.5), category,
  color, area, dist_km, nearest_station_km, basis:"now"`. Outside the
  service area you get an honest error and `places: []`.
- `/v2/districts` now builds through `_districts_payload(F)`. The response
  shape is the same, and the one cached grid solve is shared with /v2/purest.

**server/v2/explore.py**
- **Playtime advice bug fixed.** `decisions` now come from `play_decisions()`,
  which is built for the rolling 24 h horizon. Every go-out line (outdoor
  exercise, kids outdoors, windows open) points at `best_window` and says
  the day ("13:30-20:30 today — cleanest, ~40 µg/m³"). When no window
  qualifies it points at the single lightest hour. The heavy window gets
  its own `avoid: true` "stay in" line. The old line was "before ~<heavy start>":
  day.py's day-card logic misread on a horizon that crosses midnight. Each
  line also carries `start_h/end_h`. day.py is untouched.
- **/v2/stays**
  - The pool is spread out: the 5 nearest stays, then one per ~900 m bucket out to 5 km.
    Before, the nearest 40 roofs in CP were all within ~300 m, so the list was
    79/80/80/80, all tied.
  - The same hotel listed several times is collapsed to one row (same name, or
    under 25 m apart).
  - Alive's pick is the best next-24 h mean on a non-sparse row. It goes to
    the top with `pick: true` and `why` (8 words or fewer).
  - New fields: `anchor_window_mean_ug` and `radius_km`.

**server/webapp/purest.js / purest.css** (rewritten)
- **Cleanest air near you**: a 15 km / all NCR toggle and up to 6 ranked
  rows, each with name, park or area, distance, and **AQI now** with PM2.5,
  in band colour. The #1 row carries an "alive pick" tag and the reason
  "cleanest air near you right now". Places get pins on the map, which
  fits to them. Until /v2/purest is deployed, the client falls back to
  /v2/districts rows filtered by the same flags (`confidence=field`, not
  partial, within 25 km), so Meerut or Hapur can never top the list again.
- **Hotels**:
  - "find any hotel" search: lodging kinds only. It uses `A.search.live`
    when it exists, else `A.search.search`, plus `/v2/search` asked for
    "<q> hotel" so a bare brand still finds the hotel.
  - "near you · change" opens a place picker.
  - The list comes from /v2/stays with a **24 h avg** label and Alive's pick on top.
  - Extra rows come from `/v2/p/nearby?kind=lodging` when it's configured.
- **Environment card** (any hotel or place): **AQI now** with PM2.5 and band,
  **24 h avg**, **best** and **worst** hour (marked "tmrw" when they fall
  tomorrow), a 24 h strip, and a here vs where-you-are table (now and 24 h avg).
  Everything comes from /v2/playtime at the point. On prod, its `now_pm25`
  and `mean_pm25` match /v2/stays' `pm25_now` and `window_mean_ug`
  (53.9 / 76.9 for The Hotel W), so the list and the card agree.

**server/tests/test_purest_oct11.py** (new, 9 tests): the playtime
regression on the recorded CP curve (peak at 06:30, clean 13:30-20:30), the
no-window case, endpoint decisions following best_window, purest
solid-only ranking, exclusion of partial areas, the /v2/purest shape with
honest empty and out-of-area answers, /v2/districts still serving, the
stays pick, dedupe and radius, and the spread pool.

## Verified
- `pytest server/tests/test_purest_oct11.py -q`: 9 passed.
- `pytest server/tests -k "stays or playtime or city or districts or explore or purest" -q`:
  all pass except `test_contract_sync`.
  - `[V2SearchResponse]` and `test_nested_place_and_strip_rows` fail on
    search.py/places.py fields (lane X), not on my files.
  - The two new top-level keys I first added to /v2/stays were removed again
    so V2StaysResponse stays contract-clean. The new per-row `pick`/`why` keys
    pass that check.
- Console on 8110:
  - 404s for endpoints that aren't deployed yet: /v2/purest, /v2/p/nearby,
    /v2/ac, /v2/p/ac, /v2/tally.
  - Headless WebGL failure (no GPU).
  - CORS errors from search.js calling Overpass (lane S) during hotel search.
  - No JS errors from purest.js. No horizontal overflow (scrollWidth 390).
- Preview of /v2/purest's logic on **prod data** (prod /grid cells, the 53 prod
  stations, prod /v2/districts flags, real gazetteer):
  - CP: Delhi parks and localities 0.6–4 km from a monitor.
  - Ashok Nagar: Ashoka Park, Bihari Pur, Babu Park, Pur Shahdara…
  - Greater Noida, Gurugram, Sonipat: **empty**. The prod station feed is
    Delhi-only, so those places have no monitor within 6 km, and the UI says
    "no solid air reads within 15 km — try all NCR".
- UI at 390×844 against 8110 (local webapp + prod API), CP and Ashok Nagar.
  Screenshots are in `/home/govinda/alive-dev/u/shots/`.

## Open issues
- /v2/purest and the new /v2/stays pick and spread aren't live until the coordinator deploys.
  Until then the UI uses the district fallback and the client-side pick.
- The prod station feed covers Delhi only (WAQI + DPCC). Outside Delhi the purest list is
  honestly empty until NCR monitors (CPCB key, owner blocker) feed the field.
- `/v2/p/nearby` (lane P) has no air numbers. Its rows show as plain names, and
  their air loads when tapped.
