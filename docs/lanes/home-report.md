# home lane — report (2026-10-10)

Lane: consent layer + home air card + doors.
Owns: `server/webapp/home.js`, `server/webapp/home.css`, `#consent` markup in
`index.html` (the div and its contents only — nothing else in that file touched).

## What shipped

1. **Consent that works in all four states.** First-visit unanswered → card up;
   granted → gps locate; denied-by-browser → consent state demoted to `picked`
   + toast "location refused — tap the map where you are" + map-tap picking
   enabled (scaffold left `consent='granted'` after a failed locate, which
   silently disabled map taps — a dead end, now impossible). Re-consent from
   the loc-chip reopens the card in every state: home.js answers the buttons
   itself with a capture listener on `#consent` (app.js only wires them on a
   first unanswered visit), so its handler swallows the click before it can
   double-fire. A `.consent-note` appears in the card when the Permissions API
   reports `denied`. Backdrop tap dismisses only after consent was answered.
   Copy says plainly: the point is only used to read the environment around
   it; it stays in this browser; nothing is tracked; no account.
2. **Air card, every number traced.** pm2.5 headline + CPCB band word +
   band-tinted wash; pm10 / no₂ / us aqi sub-metrics; `why.line` verdict;
   provenance line (`pm25_lo–hi` model spread + `typical.vs_now_pct` season
   comparison); freshness block (`field.built_epoch` age + `nearest_station_km`,
   `field.stale` flagged). Failed polls keep the last honest read with its age
   still counting; a failed first read or `pm25:null` shows the honest
   `—` + "outside delhi ncr" state. `beyond_field_edge` shows the number but
   says "the model is filling in, treat this as a guess".
3. **Auto-refresh.** `/aqi` re-read every 5 min while home is mounted (skipped
   when tab hidden); freshness text re-ages every 30 s without network; both
   intervals killed in cleanup; `alive:field` events re-render the age.
4. **Doors stay honest** — rendered only for registered screens
   (`A.screensReady`); only "air around me" shows today because whereto.js,
   journey.js, purest.js are still empty (other lanes). Odd door count spans
   the full row.
5. **Picked point persists.** Map-tap positions are stored (`alive.pos`), so a
   relaunch in picked mode restores the user's spot and re-reads it — before
   this it silently reset to central delhi.
6. **Single fetch.** The scaffold fetched `/aqi` twice per refresh (card +
   chip); now the one response feeds both.

## Number audit — every rendered value vs live API

Verified live 2026-10-10 ~16:20 UTC (build a13f0e8a), at 28.6315, 77.2167:

| UI element | Value shown | API source (endpoint → field) |
|---|---|---|
| big number | `65` | `/aqi` → `pm25` (65.4 → `Math.round`) |
| band word + wash + scale seg | `moderate` | `pm25` → `A.fmt.band` (CPCB breaks) |
| sub-metrics | `158 pm10 · 29 no₂ · 155 us aqi` | `/aqi` → `pm10`, `no2`, `us_aqi` |
| model spread | `likely 31–100` | `/aqi` → `pm25_lo`, `pm25_hi` |
| season context | `31% under a usual october night` | `/aqi` → `typical.vs_now_pct`, `typical.month`, `typical.hour_ist` |
| verdict line | "the air is barely moving…" | `/v2/why` → `line` |
| freshness | `2 min old` | `/aqi` → `field.built_epoch` (→ `A.fmt.ago`; `field.stale` flags stale) |
| station distance | `station 1.6 km` | `/aqi` → `nearest_station_km` (→ `A.fmt.km`) |
| chip dot color | band color | `pm25` → `A.fmt.band` |
| chip label | `Outer Circle` | `/v2/search?near=1` via `A.search.reverse` |
| edge warning | "treat this as a guess" | `/aqi` → `beyond_field_edge` (verified live at 27.80,77.90: station 99.7 km, spread 9–151) |
| no-read state | `—` + "outside delhi ncr" | `/aqi` → `pm25:null` + `error` (verified at 19.076,72.877) |

No number is hardcoded, assumed, or seeded. Hidden-absent fields degrade to
empty, never to a fallback.

## Verified (Playwright, real Chrome, mobile 390×844 + desktop 1440×900)

- fresh visit → consent card → grant → gps locate → card live (shots m-01, m-02, d-01, d-02)
- re-consent via loc-chip → card reopens → switch to pick-a-point → map tap moves read (m-03, m-04)
- denied permission → toast + `consent:"picked"` + map tap works (m-05)
- relaunch → consent does NOT replay; picked spot restored, chip re-geocoded (m-06, m-13)
- field edge (station 99.7 km) → honest guess warning (m-12); outside NCR → `—` no-read (m-14)
- freshness two-line render, no mid-phrase wrap (m-10)
- screenshots: `docs/lanes/home-shots/`
- latency: `/aqi` 0.28 s, `/v2/why` 0.26 s, `/v2/search?near=1` 0.26 s

## Still missing / notes for coordinator

- Doors for `whereto`, `purest` appear automatically when those lanes register
  their screens; nothing to do here.
- `index.html` title/meta says "PM2.5 dosimeter" — shared-file territory, not mine.
- Suggestion (shared file, not applied): `app.css` still carries consent +
  `.air-*`/`.door` styles that logically belong to this lane; moving them into
  `home.css` later would tighten the contract. No functional need.
- Geolocation "denied" note state verified by code path (Permissions API), not
  by a real blocked-permission browser profile — headless Chrome can't grant
  the denied state.
