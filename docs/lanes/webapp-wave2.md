# webapp wave 2 — lane contract (2026-10-10)

Coordinator: parent session devin-39817b9ec42b4ecc91694474c4451967 ("Launch Six Agents").
Six parallel lanes build `server/webapp/` — the consumer web app — plus the admin
rebuild. Everyone pushes to `main` on `github.com/GC-WORK11/ALive`.

## The app

`/app` (served by FastAPI, `server/main.py` → `server/webapp/index.html`).
Screens register via `A.screen(id, {mount(el, params)})`; router shows one at a
time; deep-link via `#/<id>`. Shared runtime in `app.js`: `A.api` (same-origin,
`?api=<base>` override for local dev), `A.geo`, `A.store`, `A.fmt`, `A.map`,
`A.search`, `A.sheetChrome`, `A.toast`. Map: MapLibre + CARTO Positron (keyless).

Local test: `cd server/webapp && python3 -m http.server 8090` →
`http://localhost:8090/#/<screen>?api=https://d2eh2l2ys9wkij.cloudfront.net`
(CORS is open `*`).

## File ownership — hard contract

| Lane | Owns (and ONLY these) |
|---|---|
| coordinator | `server/main.py`, `index.html` link/script tags, `app.css` base |
| home | `home.js`, `home.css`, `index.html` consent markup only |
| search | `search.js` |
| whereto | `whereto.js`, `whereto.css` |
| journey | `journey.js`, `journey.css` |
| airmap+purest | `airmap.js`, `purest.js`, `airmap.css`, `purest.css` |
| admin | `server/admin.html`, `server/admin_agg.py` (additions only) |

Rules: `git pull --rebase` before every commit. Never touch another lane's file —
if you need a change outside your files, note it in your report; the coordinator
applies it. `app.css`/`app.js`/`index.html` are FROZEN to all lanes except home's
consent markup. Commit early and often, small diffs, real messages.

## Owner's laws (non-negotiable, from the master prompt)

- No fake/hardcoded/random/seeded user-facing numbers. Every number traces to a
  live API field with provenance + age. `null`/honest-empty over any fallback.
- Warm neutral base; lowercase `alive`; forest `#2A4D3B` as a SMALL accent only —
  never dominant, never "green app". Band colors (`--b0..--b5`) only where they
  mean air quality.
- Plain intelligent language for Delhi users. No jargon, no emoji, no FOMO, no
  "dosimeter" talk to users.
- Uber/Google-Maps-grade simplicity: one obvious action per surface, no manuals.
- If a feature can't work for real, it doesn't ship — no staged demos.

## API surface (verified live 2026-10-10, build a13f0e8a)

`GET /aqi?lat&lon` (pm25, pm10, no2, us_aqi, nearest_station_km, beyond_field_edge,
field age) · `GET /v2/why?lat&lon` ({line}) · `GET /v2/search?q&lat&lon` ({results[]:
name,subtitle,kind,lat,lon,distance_m}) · `GET /v2/reverse?lat&lon` ·
`GET /grid?cells=N&param=pm2_5` ({cells[]: lat,lon,pm25,band,conf}) ·
`POST /v2/plan {from,to,vehicle?,fast}` → {options[]: mode,label,geometry(LineString),
distance,duration,engine_dose_ug,via_names,alternative_index,strip?}, vehicle modes:
car,bike,auto,cycle,walk · `GET /v2/playtime?lat&lon` ({hours[],best_window,
worst_window,verdict,mean_pm25}) · `GET /v2/city` · `GET /v2/districts` ·
`GET /v2/stays` · `GET /v2/skill` · `/ncr.geojson` · admin: `<mount>/api*` gated.

## Screen handoff contracts

- `A.show('journey', {option, from:{lat,lon,label}, to:{lat,lon,label}, vehicle})`
  — whereto's start-journey CTA hands the picked option to journey.
- Doors on home call `location.hash = '#/<screen>'` — door renders only if the
  screen registered (no dead buttons).
- `A.search.search(q, bias) → [{name,sub,kind,lat,lon,dist,source}]` — cascade
  already layered (engine → Photon → Nominatim); screens build their own input UI.
- `document` events: `alive:location` (pos|null), `alive:maptap` ({lat,lon,point}),
  `alive:field` ({epoch,n}).

## Reports

Each lane ends by committing `docs/lanes/<lane>-report.md`: what shipped, how each
number was verified (endpoint + field), what was tested (screens, states,
latency), what's still missing. The coordinator merges, audits, deploys via
`bash scripts/deploy.sh` (commits only — `git archive HEAD:server`).
