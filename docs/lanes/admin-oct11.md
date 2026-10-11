# Lane A (admin) — Oct 11

Real analytics end to end: anonymous usage counters (no location, ever) →
DynamoDB aggregate table → admin API → a 6-panel dark admin.

## What changed (only lane-A files)

| File | Change |
|---|---|
| `server/webapp/telemetry.js` | Real client. `A.track(event, props)`; random install id in `alive.anon` (JSON-quoted via `A.store`); events queue in `alive.tq` (≤50), batch ≤20, POST `/v2/tally` (fetch keepalive; sendBeacon text/plain on pagehide/hidden). `app_open` sent automatically ≤1 per IST day (`alive.topen`). Client-side whitelist of props; `A.store.set('telemetry', false)` = opt-out. |
| `server/v2/trip.py` | NEW `POST /v2/tally`: strict whitelist (3 event kinds, closed prop sets, bounded numbers, mode ∈ 3 modes, vehicle normalised to car/cab/bike/auto/erick/bus/metro/cycle/walk/other); every other field (lat/lon/coords/address…) dropped and counted in `dropped_fields`; anon id regex `[A-Za-z0-9_-]{16,64}`, hashed `sha256("alive-usage-v1:"+id)[:16]` (cannot join the trip token hash); body ≤16 KB, ≤25 events; 120 events/hour per id; app_open deduped per id per IST day; client `ts` honoured only within −3 d…+5 min; store failure → 503 so the client keeps its batch. `/v2/trip` untouched. |
| `server/agg_ddb.py` | NEW `MemoryUsageAggregates` + `DDBUsageAggregates` (same table, pk `usage#d#<IST day>`, sk `sum` / `dev` (SS of hashed ids) / `mode#<m>` / `veh#<v>`, ADD counters), shared `_usage_deltas`/`_usage_rollup` so both backends agree; `get_usage_store()` (same AGG_TABLE + creds rule as `v2.store._select_trips`), `usage_store()` process singleton, `set_usage_store()` for tests. |
| `server/admin_agg.py` | NEW `GET <mount>/api/app` (behind `_admin_guard` via the existing router include): devices today/7d/all (exact set unions), journeys started/ended/completed/success % (today/7d/all), modes + vehicles ranked (3 modes always listed), intake saved (µg vs fastest, today/7d/all, reports, mean), opens, 14-day daily series, `since` (first counted IST day) or `server_start_ts`, `persists`, `available:false + error` on read failure. `/api/corridors` gains top-level `trips_total` (rows unchanged). `/api/timing` error rows: key `route` → `path` (fixes the order-dependent privacy-scan failure). Index list unchanged (a test pins it). |
| `server/admin.html` | Rewritten console: 01 air map (MapLibre + OpenFreeMap dark basemap, `/grid?cells=40` tiles under roads + labels, band legend, "as of <field build time>" from `cell_epoch`, stale flag past 45 min, re-read every 15 min, canvas fallback without WebGL), 02 who's using it, 03 journeys (+14-day columns), 04 modes used most + vehicles, 05 intake saved, 06 are people piling onto the same road? (k≥3 corridor rows; share of ALL shared trips through the busiest stretch; ≥50% = piling, stated on the page). Every panel: "as of HH:MM IST"; zeros read "0 … so far — counting since <date>"; locked panels say "locked — sign in as operator". Gate markup + cookie auth flow kept verbatim. No fixture/demo mode in the shipped file. |
| `server/tests/test_admin_oct11.py` | 14 tests: ingestion → /api/app, location fields dropped and never stored, envelope rejects (422/413, text/plain ok), unknown events/modes/numbers dropped, app_open dedupe + rate limit, clock window, DDB fake parity with memory, DDB write 503 / read honest, empty-store honesty, backend selection, corridor share, gate 401 on /api/app via main.app, page panels/no fixture, telemetry whitelist. |

`admin.css`, `ledger.js`, `ledger.css`, `v2/ledger.py`, `community.py`: unchanged (console CSS is inline so the secret-mount page stays self-contained).

## Event contract for other lanes (`A.track`)
```
A.track('journey_start', {mode, vehicle})
A.track('journey_end',   {completed, mode, vehicle, dose_ug, dose_saved_ug, km, minutes})
```
`mode`: `health_max|petrol_health|time_health`; `vehicle`: the picked class
(`car|cab|bike|auto|erick|bus|metro|cycle|walk`, server also maps rickshaw/taxi/driving_*/walking…; unknown → other);
`completed`: `true` only on arrival; `dose_ug`: taken dose; `dose_saved_ug`:
fastest option's dose (scaled to the covered fraction) − taken dose (may be
negative); `km`, `minutes`: actually travelled. `app_open` is automatic.
Never pass coordinates — they are dropped anyway.

## Verification
- `pytest server/tests/test_admin_oct11.py -q` → 14 passed.
- `pytest server/tests -k "admin or agg or trip or ledger" -q` → see final report
  (only pre-existing/unrelated failures remain: `test_v2_why::test_admin_html_has_drivers_table`
  (fails on HEAD too — the old page had no drivers table either), `test_contract_sync::test_nested_place_and_strip_rows`
  (another lane's area)).
- `node --check server/webapp/telemetry.js`; inline script of admin.html `node --check` + `scripts/check_inline_scripts.py` OK; `py_compile` OK.
- Visual: dev-only harness `~/alive-dev/a/harness.py` (real admin_agg + v2 trip routers in-process, admin.html at the mount, /grid proxied to prod), seeded only through the real `POST /v2/tally` and `POST /v2/trip`. Screenshots: `~/alive-dev/a/shots/empty-{desk,m390}.png` (day-one honest zeros) and `seeded-{desk,m390}.png`. 390 px: scrollWidth 390 = clientWidth, no console errors.

## Open issues / gaps
- Counters only move once lanes J/W call `A.track` (patches in the final report) and app.js gives `A.track` a no-op default (ad-blockers may block a file named telemetry.js).
- Day device sets (`dev` SS) are one DDB item per IST day — fine to ~20k devices/day (400 KB item cap); shard beyond that.
- Success rate = completed ÷ max(started, ended) per window; a journey that never sends `journey_end` (tab killed mid-trip) counts as not completed.
- Corridor names come from the nearest gazetteer row (`_corridor_label`) and can be odd ("Tower 2").
- The in-memory fallback resets on deploy; prod uses DynamoDB (`AGG_TABLE=alive108-agg` in deploy.sh) — the page says which ("counters: dynamodb/memory").
