# journey lane report — live nav + arrival receipt (2026-10-10)

Session: devin-57f50f8033314de598e579092834b1ce. Owns `server/webapp/journey.js`,
`server/webapp/journey.css` only. Commits: `e9136f0` (screen), `194cfe6` (honesty fixes).
Pushed straight to `main` per lane contract.

## What shipped

**`A.screen('journey', {mount})`** — full-map navigation over the picked `/v2/plan`
option, then an in-screen arrival receipt. Entry per contract:
`A.show('journey', {option, from:{lat,lon,label}, to:{lat,lon,label}, vehicle})`.
Bad/missing params (no option, no LineString, missing ends) → toast +
`A.back()` (falls back to home on a bare `#/journey` deep-link).

- **Nav view**: `A.map.showRoute('journey', geom, option.segments)` (band-colored
  strip where segments exist), A/B pins, fit-to-route, then camera-follow:
  `map.easeTo` zoom ~15.4+, bearing = route bearing 70 m ahead, lerped 0.4 to kill
  jitter. Panning releases follow (dragstart) → `◎` FAB re-engages + recenters.
- **HUD**: time remaining (plan pace × remaining fraction), distance remaining
  (real arclength minus projected progress), current road, dose-so-far,
  live speed chip when `pos.speed` is served. End-journey → inline confirm
  (never a silent kill).
- **Live tracking**: `A.geo.watch` → nearest-point projection on the route
  polyline (flat-plane, ~230 segment scan per fix — <1 ms). Progress ratchets
  forward; >80 m off the line → honest "off the planned route" pill, progress
  paused. Arrival = projected frac ≥ 98.5 % or within 55 m of `to`.
- **Preview mode**: default when there's no usable GPS (no geolocation, or
  consent 'picked'/unanswered). Simulates travel along the real geometry at
  the plan's own pace `L/eta_s` — never a teleport. Visible the whole time as
  "preview — simulated ride · plan pace"; ×8 fast-forward FAB labeled for
  testing; "follow my gps" button upgrades to live mid-ride (browser prompt).
- **Receipt** (arrival or manual end): ride stats, dose-over-time SVG graph
  (real samples; plan total as dashed reference; heaviest segment shaded in its
  band wash), heaviest-stretch callout, verdict with cited constants, CTA
  "plan the way back" → `A.show('whereto', swapped)` (verified: fresh plan
  auto-runs). Persists `journey.last` + `journey.history` (unshift, cap 20).
- **Cleanup**: watch cleared, rAF cancelled, dragstart listener removed,
  route layers + pins + puck removed, map bearing eased back to 0.

## Every number → its source

| Shown | Source |
|---|---|
| route line, distance | `option.geometry`/`route_geojson` (LineString, verified identical fields); served `distance_km` corroborates computed arclength (−0.34 % on a 26.9 km route) |
| time remaining / plan time | `option.eta_s` (plan pace); receipt "it took" = wall clock (live) or sim clock (preview, labeled) |
| dose so far / plan dose | `option.dose.mid` (fallback `engine_dose_ug`), spread along the route by `option.segments[].pm25 × arclength` — pm25-weighted, labeled "plan estimate". dose(0)=0, dose(L)=dose.mid by construction |
| current road | `option.steps[].street` projected onto arclength (base options carry ~40 named steps); else `via_names` fraction-mapped; else throttled `A.search.reverse` (≥25 s / ≥320 m) |
| heaviest stretch | `option.segments` max `pm25` + `band`; place from `steps`/`via_names` or one real `/v2/search near` / Nominatim reverse call |
| WHO comparison | constant cited inline: WHO 24h PM2.5 guideline 15 µg/m³ × ~14.4 m³/day ≈ 216 µg — same day-breath basis the API documents in `/v2/city → breath.basis` |
| Delhi-day comparison | live `GET /v2/city → pm25_stats.mean` (73.4 µg/m³ at test time) × 14.4; "like N min" = implied ventilation from `dose.avg_conc_ugm3` + `eta_s` (cancels cleanly) |
| speed | `pos.coords.speed` only when the device serves it — hidden otherwise |

Nothing assumed/hardcoded: when `eta_s` or `dose` is absent the UI degrades to
honest "—"/"no dose estimate" states, never a placeholder number.

## Verified (Playwright + system Chrome, `?api=cloudfront`, real API)

- **Preview pass (390×844)**: whereto → search "noida sector 18" → plan →
  start journey. Flag shown. 16.5 km route arrived in 148 s wall at ×8
  (sim ≈ 1299 s plan eta — pacing honest). HUD: 22 min → 20 min, road names
  tracked (Kartavya Path → Dara Shikoh Road → …), dose ~0 → ~1 → ~8 µg.
- **Receipt**: "arrived — Subway Sector 18 Noida", 16.3 km / 21 min sim /
  ~8 µg, graph drew 11 k points-string, heaviest "79 µg/m³ moderate around
  Gali Number 5 (you rode 50 % of it)", WHO 4 %, city line resolved live
  (73 µg/m³). `journey.last` + `history[n=1]` in localStorage.
- **Live pass**: consent 'granted' + CDP geolocation → no preview flag;
  fed real positions along the actual map-source route (360 pts) → puck moved,
  "13.3 km left · Maulana Azad Road", "~2 µg". Jump to 28.66,77.30 →
  "off the planned route" banner. Manual end → "ride ended" receipt,
  9.5 km of 16.6 km covered.
- **Way back**: whereto reopens with swapped ends and auto-plans fresh routes.
- **Desktop 1440×900**: HUD docks as right card, receipt right panel — no
  layout breakage.

## Still missing / notes for the coordinator

- `elapsed` blends sim+live seconds for mixed preview→live rides; `simulated`
  flag set if preview ever ran (disclosed on receipt).
- Re-routing on off-route is honest-static (banner + frozen progress), not a
  replan — a second `/v2/plan` call mid-ride is a possible follow-up.
- Least-smoke options carry only 2 steps → road label falls back to
  `via_names` (fraction-mapped) — approximate by nature, fine as a hint.
- `index.html` loads `airmap.js`/`purest.js`/`admin.css` — those lanes'
  stubs still empty at push time; dead doors won't render (by design).
- Shared-file needs: none — runtime (`A.*`) covered everything.
