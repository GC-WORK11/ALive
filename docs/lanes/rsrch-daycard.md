# rsrch-daycard — "air around me" search-pick + Day Card research

**Scope: research only. No code changes.** Repo `/home/govinda/Alive`, HEAD `5f744ac4`.
Feature ask: searching a place in "air around me" should fly to *that* place (not keep
re-centering the user's own location) and offer a Day Card — today's hourly AQI for the
spot, "the most fresh window and current + hourly", glanceable, honest, no fake numbers.

## TL;DR

1. **The hourly forecast already exists and is honest.** `/v2/day?lat&lon`
   (`server/v2/day.py`) serves today's remaining IST hours at an arbitrary point, from a
   real CAMS-via-Open-Meteo hourly field (`server/forecast.py`, 5-day horizon, IDW +
   ventilation + advection + live-station-anchored bias correction, fitted blend). It
   returns `error: "forecast unavailable"` + `hours: []` when cold — never fabricated
   values. `/v2/playtime` (`server/v2/explore.py`) already feeds the airmap planning
   strip from the same machinery. **No new ingestion is needed for a Day Card.**

2. **The camera-yank is `follow()` in `server/webapp/airmap.js:1245-1253`.** Every GPS
   fix (`A.geo.watch`, line 1254) and every `alive:location` event (lines 1255-1256)
   calls `follow`, which flies back to the user's live position whenever it falls
   outside the current map bounds (lines 1249-1250). Nothing checks `st.picked` /
   `st.place`, so a search pick at distance is overridden by the very next fix. The
   5-minute `liveTimer` (lines 1305-1307) and `spotPos`/`pullSpot` (lines 820-823,
   865-878) re-anchor the *state* to the GPS position as well. A `movestart`/
   pan-interrupt gate does not exist anywhere in the webapp (verified: no
   `movestart`/`dragstart` handler in `server/webapp/`).

3. **Historical climatology is real but it is not a forecast.** `server/history.py`
   (OpenAQ archive, month×hour stats) may only appear under a "typical pattern, not a
   forecast" label — never blended into today's hourly numbers.

---

## (a) Hourly-card data availability matrix

| Card need | Status | Source / endpoint | Line refs | Honesty notes |
|---|---|---|---|---|
| Live PM2.5/PM10 + US AQI at arbitrary point | ✅ shipped | `GET /aqi?lat&lon` → `server/airfield.py` field read | `server/main.py` `/aqi` route; `airfield.py` `CACHE_TTL=900` | Real blended field (CAMS grid + stations). Returns `nearest_station_km`, `beyond_field_edge`, `typical` vs climatology. Verified live: `pm25 66.1, pm10 93.4, us_aqi 156`. |
| Hourly PM2.5 for *the rest of today* at arbitrary point | ✅ shipped | `GET /v2/day?lat&lon` → `hours[]` | `server/v2/day.py` (~468-510 response fields) | Real CAMS hourly, live-anchored. Honest holes — no padding to 24h, no zero-fill. |
| Rolling next-24h hourly (cross-midnight) | ✅ shipped | `GET /v2/playtime?near=lat,lon` | `server/v2/explore.py`; consumed at `airmap.js:469-506` (`planCard`) | Same forecast machinery; already powers the airmap graph + "cleanest window" text. |
| Cleanest / heavy window today | ✅ shipped | `cleanest_window`, `heavy_window`, `decisions[]`, `day_mean_pm25` on `/v2/day`; `best_window`, `verdict` on `/v2/playtime` | `server/v2/day.py`, `server/v2/explore.py` | Server-authored lines, e.g. "10:30–18:30 cleanest" — this is the string users already see; it is **not** a synthetic curve. |
| Per-hour uncertainty band + confidence | ✅ shipped | `hours[].pm25_lo/pm25_hi`, `band`, `confidence` (hi/med/lo; `lo` = raw CAMS after the live anchor fades) | `_hour_entry` in `server/v2/day.py` / `explore.py` | Whisker bands already rendered by `departGraph`. |
| Freshness provenance | ✅ shipped | `field_age_s`, `field`, `forecast` status blocks on `/v2/day` & `/v2/playtime` | same | Enough to label "air read N min old · forecast fetched HH:MM". |
| Multi-day outlook (context) | ✅ shipped | `GET /v2/outlook?lat&lon` — today + ≤4 IST days, partial final day marked | `server/v2/outlook.py` | Real horizon only; probably more than a Day Card needs. |
| CPCB AQI per forecast hour | ⚠️ partial | `hours[].us_aqi` exists (PM2.5-only basis); true CPCB AQI/hour needs PM10 forecast | `server/forecast.py` `FORECAST.pollutant()` exists but unanchored | Card can show CPCB band now (client computes AQI from `/aqi` pm25+pm10) + per-hour PM2.5 µg/m³ — don't print a per-hour "AQI" without saying the basis. |
| IITM WRF-Chem 72h hourly | ❌ unreachable | `server/iitm_probe.py` — host resolved to RFC1918 private IP, no JSON feed; returns `None` correctly | `server/iitm_probe.py` | Probe recorded failure; not usable. |
| WAQI forecast block | ❌ not ingested | `server/ingest_waqi.py` ingests **live** obs only (CPCB/DPCC CAAQMS republish; needs `WAQI_API_KEY`) | `server/ingest_waqi.py` | WAQI `/feed` *does* expose a `forecast.daily` block for some stations — the only credible new-ingestion candidate, but daily not hourly. |
| OpenWeather air-pollution | ❌ not wired | not in `server/upstreams.py` | — | Not needed; CAMS path is better. |
| Historical diurnal pattern (fallback reference) | ✅ exists, ⚠️ climatology | `GET /v2/today` → `server/history.py` (`delhi_climatology.json.gz`, OpenAQ archive; `typical`, `typical_band`, `diurnal_curve`) | `server/history.py` | Month×hour p25/median/p75 — **label "typical for this month/hour, not a forecast"** or don't show. |
| Recorded served-field replay | ✅ exists | `GET /v2/archive?day=YYYY-MM-DD` → `server/archive.py` hourly IST snapshots (`basis: "recorded"`) | `server/archive.py`; local mirror `server/data/archive/`, local keep `LOCAL_KEEP_DAYS=8` | What the API actually served; gaps are honest gaps. S3 copy durable; only ~8 days kept locally. |

### Forecast pipeline facts (all verified in source)

- **Upstream:** Open-Meteo air-quality API (CAMS) `pm2_5, pm10, nitrogen_dioxide` + Open-Meteo
  met API (boundary-layer height, 10 m wind speed/dir) — `server/forecast.py` top constants.
- **Horizon:** `FORECAST_DAYS = 5` → ~120 hourly slots.
- **Freshness:** `CACHE_TTL = 1800` (30 min); CAMS updates ~hourly. Live field TTL 900 s
  (`airfield.py`); ingest worker rebuilds snapshots every `INDEX_PERIOD_S = 900` s
  (`server/ingest_worker.py`), mirrored `s3://alive108-air/field/YYYY/MM/DD/HHmm.json.gz`;
  `STALE_AFTER_S = 45*60`.
- **Spatial:** IDW interpolation to any NCR point + ventilation/stagnation correction +
  semi-Lagrangian advection + live-anchor bias blend `(live − corrected-now)·exp(−lead/9h)`;
  anchor weight 1 through ~h+2, linear to 0 by h+40 (blend fitted on served-vs-recorded
  archive pairs). Live fields >3 h stale are not anchored.
- **Failure mode:** degrades to `None`/empty — `server/forecast.py` explicitly does not
  invent values; `/v2/day` → `{"error":"forecast unavailable","hours":[]}`.
- **Operational caveat observed locally:** cold-start `/v2/day` returned
  `forecast unavailable` (`aq_points:0`) even though direct upstream probes succeeded
  (AQ ~1.1 s; met ~14.9 s — the met leg can exceed the bounded refresh). The card must
  keep the honest empty state in exactly this case.

### What the existing "cleanest window" strip is fed by

`airmap.js` `planCard()` (lines 469-506) → `/v2/playtime?near=…` → `hours[].pm25_mid/lo/hi`,
`ist_label`, `best_window`, `decisions`, `nearest_station_km`, `field_age_s` →
`departGraph` bars + verdict line. i.e. the UI users already see ("10:30–18:30 cleanest")
is the real anchored CAMS series — the Day Card is mostly a **presentation problem plus
the camera-pick bug**, not a data problem. The RN app already renders this contract
(`Mobile/src/api/dayfield.ts`, `Mobile/src/screens/HomeScreen.tsx` — server windows and
hourly mids authoritative; per-hour `null` holes preserved).

---

## (b) Exact re-centering mechanism — every path that reclaims the camera

`server/webapp/airmap.js`:

1. **`follow(p)` — lines 1245-1253 — the yank.** On every fix: `puckMove` (1247), then
   `getBounds().contains([p.lon,p.lat])` — if the *user's* position isn't inside the
   current view, `flyToSpot(p, Math.max(13, m.getZoom()))` (1249-1250). No check of
   `st.picked`, `st.place`, or whether the user initiated the camera move.
   Drivers: `A.geo.watch(follow)` when granted (1254; `watchPosition`,
   `maximumAge:2000`, high accuracy — `app.js` `A.geo.watch`), and `onLoc →
   follow(e.detail)` on every `alive:location` document event (1255-1256). Those events
   fire from `app.js` on consent-yes locate, consent fail/skip, and the boot
   re-locate for returning granted users — i.e. **they can land seconds after a pick,
   long after mount.**

2. **Mount fly — lines 1240-1244.** `pos0 = spotPos()` (live fix) always wins the opening
   camera: `flyToSpot(pos0, 14.2)`; else Delhi 10.4. `st.place` is restored from
   `PICK_KEY` at line 1224 — so a *persisted* pick's data is reloaded but the camera
   still opens on the live dot. Inconsistent restoration.

3. **`spotPos`/`pullSpot` — lines 820-823, 865-878, driven by live `A.geo.pos` (821).**
   Recomputes the hero/spot read from the GPS position whenever `distM(st.spot.pos, p) >
   120` (1252) and on the 5-minute `liveTimer` (1305-1307: `pull()` + `pullSpot()` while
   `!st.pickOpen`). Doesn't move the camera itself, but keeps the spot card
   contradicted against a picked place — and `A.geo.pos` can silently update under the
   sheet because `geo.refine`'s callback writes `geo.pos` regardless of current screen.

4. **`scReset` — lines 1081-1097.** ✕ clears the pick, restores `st.place` to live pos
   ("where you are") or central Delhi, `flyToSpot(pos, 14.2)` (1094). *Intentional*
   return-to-me — keep this; it's the only deliberate user-driven re-center.

5. **`onTap` map tap — lines 1258+ + `scNoteTap` (1101-1106).** A map tap clears the pick
   state and re-reads — by design, but see bug list (tap targets vs sheet overlap).

6. **`home.js` `onLoc` — `home.js` around the `alive:location` listener → `A.map.fly(pos)`
   + `puckMove`.** Harmless while home is mounted (listener removed at cleanup,
   home.js:801-807) — but the same unconditional-fly pattern. Not an airmap vector since
   hash-nav `back()` unmounts home (`app.js` stack pop on hashchange).

7. **Latent leak (home):** `stopRefine` is never called in home's cleanup
   (home.js:801-807 clears intervals/listeners but not the `geo.refine` watchPosition
   started at 467, ~30-min duration) — GPS radio stays hot ~30 min after leaving
   home; callback is `A.current()==='home'`-gated so no visual effect, but `geo.pos`
   still updates (feeds path 3).

Net behaviour: `scPick` (1060-1079) does set `st.picked`, persist `PICK_KEY`, fly, pin,
`tapRead` (343-364), `planCard` — then the **next GPS fix** hits path 1 and steals the camera back
because the user isn't inside the searched place's bounds. There is no "camera anchor"
concept: `st.picked` is only consumed by `onTap`/`scNoteTap`, never by `follow`,
`pullSpot`, or `spotPos`.

---

## (c) Day Card design proposal

### Data calls (all existing; no new ingestion)

- `GET /aqi?lat&lon=<pick>` — current read: `pm25`, `pm10`, client-computed CPCB AQI
  (`A.map.cpcb`), `us_aqi`, `nearest_station_km`, `beyond_field_edge`,
  `smoke_modifier`, `typical`, field freshness.
- `GET /v2/day?lat&lon=<pick>` — today's remaining hourly forecast: `hours[]`
  (`ist_label`, `pm25_mid/lo/hi`, `us_aqi`, `band`, `confidence`), `now_idx`,
  `day_mean_pm25`, `cleanest_window`, `heavy_window`, `decisions[]`, `grap`,
  `model`, `band_basis`, `field_age_s`, `field`, `forecast`.

### Display order (glanceable first)

1. **Header** — picked place label + "today" + freshness chip
   (`air read N min old · forecast fetched HH:MM` from `field_age_s`/`forecast.age_s`).
2. **Now row** — CPCB AQI number + band word + `PM2.5 N µg/m³` (+ PM10 if shown, same
   basis). Basis string required: e.g. "CPCB AQI · from PM2.5+PM10".
3. **Hourly strip** — reuse `departGraph` idiom: bar per `hours[]` slot coloured by
   `band`, whiskers `lo–hi`, "now" tick at `now_idx`/`h=0`, axis `ist_label`. Show only
   what the API sent (remaining hours — do not pad to 24).
4. **Freshest window callout** — `cleanest_window` ("cleanest ~14:30–18:30 · ~48 µg/m³"),
   relabel "least-bad" when its mean is still unhealthy (cf. prior copy fix: '0 µg/m³
   lighter' bug in `acct2-mobile4.md`); `flat` days → "no meaningful window". Optional
   `heavy_window` second line.
5. **Decision lines** — `decisions[]` verbatim (server-authored en/hi).
6. **Honesty footer** — short `model`/`band_basis` ("CAMS model · anchored to live
   stations · range is the honest spread"), confidence chip when `confidence==='lo'`
   ("beyond live-station reach — model only").

### Missing/thin-data rules (the no-fake contract)

- `error: "forecast unavailable"` → render Now row only + a literal "hourly forecast
  unavailable right now" line. **Do not** substitute climatology into the strip.
- If a fallback reference is wanted, it must be a *separately labelled* block:
  "typical for this month/hour — 10 years of readings, not a forecast" (`/v2/today`).
- `beyond_field_edge` / large `nearest_station_km` → "an estimate — nearest live
  monitor ~N km" (worktree already prototypes `spotNearestEst` copy).
- `pm25` ambient vs smoke-adjusted: use the same basis as `pm25_mid` (ambient) and say so;
  don't silently mix.
- Per-hour `confidence==='lo'` → hollow/desaturated bar tail, matching the RN
  `covered`/`conf` treatment.

### Prior art to mirror

`Mobile/src/api/dayfield.ts` + `Mobile/src/screens/HomeScreen.tsx` already implement this
contract (server windows/decisions authoritative, hourly mids, `null` holes preserved,
`fieldStale` honoured). The web card should reuse `/v2/day` verbatim rather than
re-deriving windows client-side.

---

## (d) Airmap map-control bug list (user-visible)

Ordered by user impact. Line refs are `server/webapp/airmap.js` unless noted.

1. **P0 — Search pick loses the camera to the next GPS fix.** `follow` (1245-1253)
   re-flies to the user whenever they're outside the picked bounds; fires on every
   watch tick and `alive:location`. Repro: grant location → search a place ≥ ~1 km away
   → pick it → map flies there → within a fix or two the map drags back to you.
   Fix shape: a "camera anchor" state — `follow` (and `pullSpot`-adjacent moves) gated
   while `st.picked`/`st.place` is a user pick; `scReset` already provides the
   intentional return.
2. **P0 — iOS/touch: composer rows + ✕ may never fire their pick.** Row buttons and ✕
   use `pointerdown → preventDefault()` (lines 977, 1156), which on iOS Safari
   suppresses the synthesized `click` — the row looks tappable but nothing picks.
   Fixed in `.wt/lane-airmap` worktree (`mousedown` instead, commit `705fcf3d`) — not
   on main.
3. **P1 — Two pick paths disagree.** Composer `scPick` flies + pins + reads
   (1060-1079); sheet picker `finish()` (539-549) sets `st.place`/`PICK_KEY`/recents
   but **no `flyToSpot`, no `tapRead` pin** — map doesn't move, no AQI pin drops.
   Worktree added the fly (`st.tapPlace`/`flyToSpot`/`tapRead` in finish); main is
   inconsistent.
4. **P1 — `tapRead` resolve race mislabels numbers.** `tapRead` (343-364) calls
   `paintRead(..., st.tapPlace)` at *resolve* time (348, 358, 364): tap A → its
   `/aqi` resolves after tap B → A's numbers render under B's place name (or the
   reverse-geocode that lands at 1262-1266 rewrites the caption under the old
   numbers). No staleness token; the `st.readEl.hidden` check (355) only skips
   painting.
5. **P1 — Persisted pick, live-pos camera on remount.** `st.place` restores from
   `PICK_KEY` (1224) but mount flies to `pos0` anyway (1240-1244), and `st.picked`
   isn't restored — sheet shows the saved place while the camera sits on you, and the
   first tap treats the pick as fresh state.
6. **P1 — A stray map tap silently retargets the sheet + plan.** Plain `onTap`
   (1285-1299) sets `st.place` to the tapped point ("pinned spot"), persists it to
   `PICK_KEY`, and re-runs `planCard()` — intended per the comment (1286-1287), but
   there is no undo/highlight, so an accidental tap while panning quietly changes
   which place the sheet, hero-adjacent label, and day plan describe.
7. **P2 — Spot card is pinned to GPS while the sheet is about the pick.** The hero
   is explicitly "the air at your live spot" (comment at 815); `spotPos` (820-823)
   reads live `A.geo.pos` and `paintSpot`/`pullSpot` (856-878) keep refreshing it —
   so the sheet can show a picked place + its `/aqi` read (`.am-read`, `tapRead`)
   while the hero block still quotes *your* location's air. Two places' numbers on
   one screen with no visual binding; either scope the hero to `st.place` or label.
8. **P2 — GPS jitter → repeated camera steals at bounds edges.** `follow` uses raw
   `getBounds().contains` (1249-1250) — a fix just outside the view (or jitter
   straddling the edge) triggers `flyToSpot` every time; no hysteresis, no
   user-pan suppression (`movestart`/`dragstart` handlers don't exist).
9. **P2 — Deferred pin can land after its cleanup.** `tapPin` assigns `tapMarker`
   inside `A.map.ready` (334-341); if the map isn't ready at tap time, the '…'
   placeholder lands *later*. A card close (`.amr-x` 318-321) or `scReset`
   (1088-1089) that runs while `tapMarker` is still null removes nothing — the
   late-arriving pin then stays with its card hidden, and the `hidden` early
   return at 355 never re-checks it. Narrow race (map-not-ready window); worktree
   removes `tapMarker` in the hidden path as a belt-and-braces fix — main doesn't.
10. **P3 — Home `geo.refine` watch leaks after unmount** (home.js:801-807 cleanup
    omits `stopRefine()`; watch started at 467 runs its ~30 min): battery/radio
    cost only — callback is `A.current()==='home'`-gated — but it keeps `A.geo.pos`
    churning under airmap (feeds bugs 1 & 7).
11. **P3 — Visible map strip is ~42% and overlaid.** Sheet is bottom-anchored
    (`airmap.css`); `.am-scw` composer + `.am-read` card stack over the top strip —
    after a pick, the pin/readout can land under the cards' hit areas — those DOM
    overlays swallow the gestures (composer input, `.amr-x` close at 318), so the
    usable map strip shrinks further exactly when the user wants to interact with
    the picked spot (and per bug 6, a map hit that does land retargets the sheet).

---

## Appendix — verification performed

- Served `/aqi?lat=28.6&lon=77.2` locally → real numbers (pm25 66.1, pm10 93.4,
  us_aqi 156, `beyond_field_edge:false`); `/search?q=Lodi Gardens` → real geocoded
  candidates with coords.
- `/v2/day` cold-start → `{"error":"forecast unavailable","hours":[]}`,
  `forecast.aq_points:0`; direct upstream probes 200 OK (AQ ~217 KB/1.1 s;
  met ~215 KB/14.9 s) — pipeline real, cold-start/timeout window also real.
- Grepped `server/webapp/` for `flyToSpot|A.map.fly|puckMove|getBounds|A.geo.watch|
  alive:location|movestart|dragstart` — complete camera-write list above; **no
  pan-interrupt gate exists**.
- `docs/lanes/` spot-checked (`pick-race-navcrash-report.md`, `acct2-mobile4.md`,
  `coldread-home-report.md`) — the "cleanest window" copy is server-authored; the
  RN dayfield contract exists; no lane has fixed the web `follow()` steal.
- `.wt/lane-airmap` worktree differs from main (touch-browser `mousedown` fix, armed-tap
  pin, nearest-monitor caption, picker fly) — noted where it already fixes a listed bug.
