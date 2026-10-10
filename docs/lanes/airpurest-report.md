# lane report — airmap + purest

files owned: `server/webapp/airmap.js` `airmap.css` `purest.js` `purest.css`. nothing else touched.
verified in real Chrome (playwright, `channel:'chrome'`) at 390×844 and 1440×900 against `?api=https://d2eh2l2ys9wkij.cloudfront.net`. console clean except favicon 404 and map.js's own `/grid?cells=44` → 422 (see "for the coordinator").

## airmap — what shipped

- **own field layer.** `map.js` `loadField()` never paints (it calls `/grid?cells=44` → HTTP 422, and reads `j.cells` which the endpoint doesn't serve). airmap now fetches `/grid?cells=40&param=pm2_5` itself and paints the **real cell polygons** (`features[]` GeoJSON) as `am-field`/`am-field-fill`, fill matched to `--b0..--b5` via `A.fmt.bandIdx(pm25)`, inserted below the first label/water layer. `conf` drives opacity: `hi` .38 / `med` .32 / `lo` .20 — confidence is shown, not hidden.
- **cells=40 chosen** (the server's hard cap — `le` validator rejects 41+ with 422). ~1600 cells, 363 KB, ~0.4–0.65 s warm. cells=25 is 138 KB but visibly coarser (~4 km cells); 40 is the best the API allows, so it wins. Cell ≈ 0.025° ≈ 2.5 km.
- **tap readout** (`.am-read`, top-center mobile / top-left desktop): `/aqi?lat&lon` → `pm25` + `A.fmt.band` word, `pm25_lo`–`pm25_hi` as "likely lo–hi" range, `nearest_station_km`, field age from `field.built_epoch` (`(stale)` when `field.stale`), `beyond_field_edge` → "at the field's edge — treat this as a guess". Null/no `pm25` → "outside the field — no honest read here". Tap drops a dot marker; ✕ or next tap clears.
- **planning-to-go-out card** = `/v2/playtime?lat&lon`, verified field-by-field live: `verdict` headline, `hours[24]` rendered as bars (`pm25_mid` height, `band` color, `pm25_lo`–`pm25_hi` whisker, `best_window` ring, `ist_label`/`day_offset` axis), `best_window`/`worst_window` ("lightest"/"heaviest" lines; `end_label` null handled), `mean_pm25`, `cleaner_by_ug`, `decisions[]` (label+line rows), `nearest_station_km` + `field_age_s` meta. `best_window:null` → falls back to `worst_window` only, no invented best.
- **place picker**: `A.search.search(q,bias)` debounced 260 ms + "your current location" + "drop a pin" (arms `alive:maptap` → `A.search.reverse`). Choice persists in `A.store` key `airmap.place`; card head shows `planning to go out · <place>`.
- **legend**: the existing compact 6-band strip, WHO/CPCB words only — kept.
- honesty line in the sheet: "each square is about 2–3 km, a model read between stations, not a promise for one house."

## purest — what shipped (was an empty stub)

- **"lightest air right now"**: `/v2/districts` → all 29 `districts[]` sorted by `pm25` asc; rows show `name`, `state||parent`, `pm25` (band-colored), `partial_field_coverage` → "field only partly reaches here", else `confidence` when not `'field'`. Ranked-on line: `ranked on live field pm2.5 · field <age>` from `field_age_s`. No clustering needed — districts are already named areas, not raw cells (the /grid path would have needed ~2 km dedupe; district rows are the better source and have names).
- **map**: every ranked row paints its **real boundary** — `name` matched into `/ncr.geojson` + `/delhi_subdistricts.geojson` feature index; `pm-areas-fill` band-colored @ .24 + white `pm-areas-line`. `Delhi NCT` skipped (parent = union of children). Top 8 get numbered `pin-chip`s at `properties.centroid`.
- **env card** (tap a row, a pin area, or a stay): name + `/aqi` point read (`pm25`, band, `nearest_station_km`, field age/stale, `beyond_field_edge` note) + `/v2/playtime` 24 h mini-strip + `best_window` line. Note: list `pm25` is the **district aggregate**, env number is a **point read at the centroid** — they can differ by 1–2, both honest.
- **stays that breathe easier**: `GET /v2/stays?lat&lon` — audited live shape `{stays[k=8]: id,name,kind,lat,lon,dist_km,pm25_now,window_mean_ug,n_hours,scored_on,band,cleaner_by_ug,sparse,nearest_station_km; ranked_on; anchor_pm25_now/band; sparse; beyond_edge; field_age_s}`. Rendered: `name`, `dist_km`, `nearest_station_km`, `sparse`→"thin read", `window_mean_ug` as "24 h mean" (band-colored), `ranked_on` printed verbatim. **Deduped** — the API returns the same hotel twice under Overture + gazetteer ids (3× Le Meridien cluster observed); merge rule = normalized-name match OR <120 m apart. Stays with coords get `pm-s-*` dot pins. `beyond_edge`/empty → "this point is past the field's edge — no honest stays read". **No invented hotels or ratings anywhere.**
- **anchor picker**: same pattern as airmap (search + me + drop-pin), persists `purest.anchor`, stays re-rank around it.
- **"alive suggests"**: single accent-wash badge on rank #1 only.

## every number → its source

| shown | endpoint · field |
|---|---|
| field cell color | `/grid` `features[].properties.pm25` → `A.fmt.bandIdx` |
| cell opacity | `/grid` `properties.conf` hi/med/lo |
| tap readout | `/aqi` `pm25`, `pm25_lo/hi`, `nearest_station_km`, `field.built_epoch`, `field.stale`, `beyond_field_edge` |
| out-card verdict/bars/windows | `/v2/playtime` `verdict`, `hours[].pm25_mid|band|ist_label|day_offset`, `best_window`, `worst_window`, `mean_pm25`, `cleaner_by_ug`, `decisions[]`, `field_age_s` |
| ranked areas | `/v2/districts` `districts[].name|state|parent|pm25|partial_field_coverage|confidence`, `field_age_s` |
| area shapes/pins | `/ncr.geojson` + `/delhi_subdistricts.geojson` `geometry`, `properties.name|centroid` |
| env card | `/aqi` + `/v2/playtime` at that point |
| stays | `/v2/stays` `stays[].name|dist_km|window_mean_ug|nearest_station_km|sparse|lat|lon`, `ranked_on`, `beyond_edge` |
| place labels | `A.search.reverse` / `A.search.search` |

## latency (measured 2026-10-10, CloudFront)

`/grid?cells=40` 0.4–0.65 s warm / 363 KB · `/aqi` 0.26 s · `/v2/playtime` 0.30 s · `/v2/districts` 0.26 s · `/v2/stays` 1.35 s (slowest — stays section renders after the list, skeleton shows meanwhile).

## for the coordinator — shared-file issues (not mine to fix)

1. **`map.js` `loadField()` is dead**: calls `/grid?cells=44` (server caps at 40 → 422) and expects `j.cells` while the endpoint serves GeoJSON `features[]`. Fix: `cells=40&param=pm2_5` + read `features[].properties.pm25|conf` + `geometry` directly.
2. **router replace-nav skips cleanup**: `app.js show(id,{},true)` removes the screen element without calling its mount-returned cleanup — only `back()` does. Any map layers/pins/document listeners a screen registers leak onto the next screen. My screens defend themselves (MutationObserver on the 'on' class + floating nodes inside the screen element), but other lanes' floating UI will leak the same way.
3. `.am-read` in app.css is a leftover scaffold class (bottom sheet variant); harmless — my airmap.css overrides to the top card.

## still missing / honest limits

- `/v2/stays` serves ~3 unique hotels near central delhi after dedupe — thin but real; the section degrades to its served `ranked_on` line.
- district aggregate vs centroid point read can differ 1–2 µg/m³ (aggregate in list, point in card) — by design, both served.
- no pagination beyond top 10 rows; the map pins cover only the top 8.
