# Lane report — `admin` (ops dashboard rebuild)

**What shipped:** `server/admin.html` rewritten to the owner's new spec — "the same
look of Cognition.com site, minimal dashboard": dark, quiet, hairline rules, margin
indices, serif prose voice, mono labels. One file, no build step, no new endpoints.

**Files touched:** `server/admin.html` only. `server/admin_agg.py` needed **zero
changes** — every analytics surface the spec asks for is already served by existing
endpoints; the old page just never fetched them. Gate markup, login flow,
`admin_mount.py`, `main.py` untouched (gate verified byte-identical in behavior;
only its palette restyled).

---

## What the page does

| # | Surface | Source |
|---|---------|--------|
| 01 | live air — mean PM2.5 numeral, band chip, honesty line, cigarettes line, station rows, forecast spark | `/v2/city` |
| 02 | **the field** — Delhi tile choropleth from `/grid?cells=40&param=pm2_5`, canvas, band-scale colors, confidence-dimmed alpha, district hairlines from `/ncr.geojson`, tooltip per cell | `/grid`, `/ncr.geojson` |
| 03 | coverage — stations into blend, per-source status, field internals (kriging, sigma, wind, snapshot state) | `/v2/city`.field, `<mount>/api/sources` |
| 04 | movement — uptime line, request counters, slowest routes, journeys spark, devices-that-shared, mode share bars, intake-avoided tiles | `<mount>/api`, `/api/timing`, `/api/usage`, `/api/donations`, `/api/global` |
| 05 | **segregation** — corridor table (street cell, live PM2.5 it rides through, est. inhaled per crossing, CO₂ per 100 m, share %), area + OD flows, k≥3 suppression note verbatim + withheld counts | `<mount>/api/corridors`, `/api/global` |
| 06 | health — alarm state, source freshness list, errors since boot, system rows (disk, ledger, build, uptime) | `<mount>/api/sources`, `/api/timing`, `/api/status`, `/health` |

**Tile-map refresh semantics:** the page polls `/v2/city` every 30 s and reads
`field.built_epoch`. Only when that epoch advances does it refetch
`/grid?cells=40&param=pm2_5` and repaint — i.e. the map tracks the field's real
TTL (`refresh_ttl_s` = 900 s), not a page timer. Captions show
"built X ago" (from `built_epoch`) and "field epoch HH:MM ist · rebuilds ~every
15 min".

**Honesty:** every figure is a served field or an em-dash / "no …" honest tile.
Uptime copy says "since boot — counters reset on deploy" verbatim. "Devices that
shared" phrasing used throughout (`devices_basis` line renders the server's own
note: true installs unknowable). k≥3 corridor rule renders `rule` verbatim from
`/api/corridors`. Banned-key guard respected — nothing renders lat/lon/coords/
trajectory/user/route; corridor rows show only `near` street names, cell counts,
and aggregate stats.

## Figure → endpoint → field audit

| Figure on page | Endpoint | Field |
|---|---|---|
| mean PM2.5 numeral + band | `/v2/city` | `pm25_stats.mean` → CPCB band index |
| "the data is Xm old" | `/v2/city` | `freshness.label` / `field_age_s` |
| cigarettes line | `/v2/city` | `breath.cigarettes.lo/hi`, `breath.basis` |
| stations reporting N | `/v2/city` | `field.station_readings` |
| per-source status rows | `/v2/city` + `<mount>/api/sources` | `field.stations_src` (waqi/dpcc/cpcb/openaq status) |
| forecast spark | `/v2/city` | `next_hours[].pm25` ×12 |
| map cell colors | `/grid?cells=40&param=pm2_5` | `features[].properties.pm25`, `.conf` (hi/med/lo → alpha 1/.82/.56) |
| "N cells · range µg/m³" | `/grid` | `features.length`, min/max of `pm25` |
| "built X ago", epoch clock | `/v2/city` | `field.built_epoch`, `field.refresh_ttl_s` |
| coverage rows (kriging, sigma, wind, serving, stale) | `/v2/city` | `field.kriging`, `.sigma_coverage`, `.wind`, `.serving`, `.stale`, `.coverage` |
| uptime | `<mount>/api` | `uptime_s` → "since boot" |
| live users | `<mount>/api` | `live_users` |
| requests total / 4xx / 5xx | `<mount>/api/timing` | `requests.total`, `requests.by_status` |
| slowest routes | `<mount>/api/timing` | `routes[].path/.n/.mean_ms/.p90_le_ms` |
| journeys spark + per-hour | `<mount>/api` + `/api/usage` | `journeys_per_hour`, `trips.last_24h.per_hour[]` |
| journeys totals, km, dose | `<mount>/api/usage` | `trips.total`, `.km`, `.dose_ug`, `.today`, `.last_24h` |
| devices that shared | `<mount>/api/usage` | `devices.total`, `.seen_24h`, `.seen_7d`, `devices_basis` |
| installs honesty | `<mount>/api/usage` | `installs` (null + `note`) |
| mode share bars | `<mount>/api/donations` | `mode_share[].mode/.trips/.pct`, `totals.modes` |
| intake avoided | `<mount>/api/global` | `dose_avoided.dose_ug`, `.trips_reporting` |
| CO₂ avoided | `<mount>/api/global` | `co2_avoided.co2_kg`, `.puc_calibrated_trips` |
| corridor rows | `<mount>/api/corridors` | `rows[].near/.trips/.devices/.avg_dose_ug/.co2_g_per_100m/.field_pm25` |
| corridor rule verbatim | `<mount>/api/corridors` | `rule` ("a cell is publishable only with >=3 distinct devices in 72h — enforced by the store, re-asserted here"), `k_min`, `window_s` |
| corridor tracked/publishable | `<mount>/api/corridors` | `cells_tracked`, `publishable_cells` |
| areas + OD flows | `<mount>/api/global` | `areas[]`, `od_pairs[]`, `suppressed.areas`, `suppressed.od_pairs` |
| errors since boot | `<mount>/api/timing` | `errors[]` (turned away / server errors) |
| source freshness list | `<mount>/api/sources` | per-source status + age |
| disk, ledger, build | `<mount>/api/status` + `/health` | disk free %, ledger devices, `build_sha` |
| session/auth | `<mount>/session` | `authenticated` boolean (200 always; API 401s relock) |

Nothing on the page is hardcoded except the CPCB band breaks (≤30/60/90/120/250)
and band hex strings — same constants the landing page uses.

## Verification

Local rig: `uvicorn main:app :8090` (venv `~/.venvs/alive-admin`, py3.12). The
local field is a stale Oct-03 snapshot — exercised the honest stale/alarm paths.

- **Populated state:** seeded 9 real trip donations via `POST /v2/trip` (4 device
  tokens, ~1.4 s pacing for the 1 rps limit) → corridors cleared k≥3 (7
  publishable / 58 tracked), mode_share 8 modes, dose_avoided 239 µg / 5 trips,
  co2_avoided 0.17 kg / 2 PUC trips, areas + OD rows. All rendered.
- **Empty state:** fresh boot after token-restart → corridors and modes show
  honest "—" tiles with explanatory copy.
- **Gate:** `ALIVE_ADMIN_TOKEN=lane-gate-test-token` restart → page shows gate;
  `POST /login` wrong token → 401 + "wrong token — try again"; right token →
  cookie minted, board loads; sign-out → gate returns. Unauthenticated
  `/api/*` → 401. (`/session` correctly returns `{authenticated:false}` at 200 —
  page reads the boolean.)
- **Overflow fix:** first 390 px shot showed horizontal overflow (scrollW 454) —
  mobile overrides were losing on source order to later base rules. Moved all
  layout mobile rules to a `@media(max-width:640px)` block at the end of the
  stylesheet; re-measured scrollW = 390, zero overflowing elements (CDP walk).
- **Network cleanliness:** zero 4xx/5xx among page resource fetches after auth.
- **Latency:** `/v2/city` ~90–140 ms local; `/grid?cells=40` ~60 ms cached;
  full tick ≈ 11 fetches, all local.
- **Screens (attached):** `m1-open` 390×844 top, `m2-map` tile map mobile,
  `m3-seg` segregation mobile, `m4-health`/`m5-foot` health+footer mobile,
  `d1-open`/`d2-map`/`d3-seg`/`d4-health` 1440×900, `g1-gate`/`g2-after-login`
  gate flow.

## Still missing / notes for coordinator

- **Local field is a stale Oct-03 snapshot** — page shows "stale · 183h ago"
  honestly; on prod with live keys it'll read live. Nothing to fix, just expected.
- **`/api/corridors` rows are capped** (top rows by trips) — page renders all
  served rows; if a fuller table is wanted that's an admin_agg.py addition
  (didn't add — current surface suffices).
- **`installs` is null** by design (server note rendered). Mode share exists only
  when trips donate a `mode`; the honest tile covers the no-mode case.
- In-memory ledger resets on deploy — uptime/journey counters say so on-page.
- Shared-file changes needed: **none**.
