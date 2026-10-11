# acct2 — RN-twin E2E regression report (prod :262)

Target: https://d2eh2l2ys9wkij.cloudfront.net/app/ — Chrome 154,
390x844 device emulation (DSF 2, mobile), CDP-driven real clicks/typing/
drags. Site data cleared first; full journey walked in order: consent →
home → where-to → modes → vehicle → journey → receipt → air map + go-out
→ purest → settings → ledger → second visit.

Artifacts: /Users/devin/repos/alive_probe/e2e/shots/ (defect-NN.png +
ctx-*.png), console log /tmp/e2e_console.log, plan e2e/plan.md.

## Defects (numbered)

### defect-01 — MAJOR — "tap the map where you are" is impossible: home sheet covers the whole map
- What: after consent "not now" (picked path), the app tells the user to
  pick their spot by tapping the map, but the home sheet occupies 100% of
  the viewport — the map canvas is unreachable under it.
- Where: #/home after onboarding.
- Repro: fresh load → onboarding pages 1-5 → p5 "not now" → toast "tap the
  map where you are" → try to tap the map: elementFromPoint at every y
  returns hs-* elements (hs-brand/hs-sub/hs-cta), never the canvas.
  geo.pos therefore never gets a user position; home silently sits on the
  Delhi default.
- Screenshot: defect-01.png
- Console: none (dead UI, no error).

### defect-02 — MAJOR — where-to option cards drop trip duration; "arrive" time is wrong
- What: option cards never show "N min", and the arrive line computes to
  the current time. Root cause confirmed by re-issuing /v2/plan in-page:
  the server sends `eta_s` (e.g. 1485) but whereto.js reads
  `o.duration_min` — `${Math.round(o.duration_min)} min` is suppressed and
  `arriveAt` = clockLabel(Date.now() + 0).
- Where: #/whereto compare/options state.
- Repro: FROM 'ISKCON east of kailash' → TO 'huda city centre' → plan →
  look at any wt-opt card: no duration; arrive-at ≈ now instead of +ETA.
- Screenshot: defect-02.png
- Console: none.

### defect-03 — MAJOR — uncaught TypeError on every go-out place pick
- What: picking a suggestion in the "planning to go out" picker throws:
  `Uncaught (in promise) TypeError: Cannot set properties of null
  (setting 'innerHTML')` at airmap.js:524 (planCard) ← finish (592) ←
  click (612). finish() → renderMain() paints a loading div (no .am-plan)
  → planCard() runs synchronously against it. The flow recovers only
  because pull() later repaints .am-plan and calls planCard() again —
  the 24-h card does eventually render.
- Where: #/airmap → "planning to go out" → any suggestion.
- Screenshot: defect-03.png
- Console (verbatim):
  EXCEPTION: Uncaught (in promise) TypeError: Cannot set properties of
  null (setting 'innerHTML')
    at planCard (…/app/airmap.js:524:18)
    at finish (…/app/airmap.js:592:5)
    at HTMLButtonElement.<anonymous> (…/app/airmap.js:612:42)

### defect-04 — MAJOR — settings "My vehicle" shows "not set" after the wizard saves a ride
- What: the vehicle wizard writes alive.whereto.vehicle =
  {"cls":"bike","fuel":"petrol","year":"y2021_plus"} but settings.js reads
  store key 'vehicle' → the row renders "not set". Store-key mismatch
  between the new settings screen and the whereto wizard.
- Where: #/settings → "My vehicle" row.
- Repro: complete vehicle wizard (bike → petrol → 2021+ → skip PUC →
  chip shows "right now: bike") → open settings → row says not set.
- Screenshot: defect-04.png
- Console: none.

### defect-05 — minor — favicon.ico 404
- GET /favicon.ico → 404 on every load; LOG.error.network in console.
- Console (verbatim): HTTP404: …/favicon.ico / "Failed to load resource:
  the server responded with a status of 404 ()"

### defect-06 — minor — /v2/reverse 404 on every map tap
- A.search.reverse() hits /v2/reverse (search.js:613) which 404s on this
  backend, then falls back to nominatim.openstreetmap.org — so naming
  still works, but every map tap / reverse lookup logs a console 404.
- Console (verbatim): HTTP404: …/v2/reverse?lat=28.76545604380445&lon=77.209
  / "Failed to load resource: the server responded with a status of 404 ()"

### defect-07 — minor/UX — whereto compare sheet has no visible close control
- What: in options/compare state whereto.js deliberately removes
  .sheet-title ("Keep the grab, drop the title") — no ‹back, no ✕, no
  title. The only dismiss is pull-down-to-dismiss on the grab (verified
  working via pointer drag) — RN parity, but undiscoverable on web and
  impossible to discover without a gesture hint.
- Where: #/whereto compare state.
- Screenshot: ctx-modes-foot.png
- Console: none.

## Clean steps (verified working)

- Onboarding: 5 pages render (live pm25 + band, arc rows, "3" k-card,
  share/keep, location page); Next/Skip advance; "keep on my phone" jumps
  to p5; "not now" sets consent='picked' + toast.
- Second visit: reload skips onboarding entirely (consent='picked') and
  restores the last route (#/ledger reopened).
- Home: greeting + ticking clock, dose hero, incidents, doors card,
  outlook cells expand, lens check-in pills persist
  (alive.checkins), profile segments.
- Where-to: real search inputs → real suggestion rows (names + subs +
  kinds) for both landmarks; plan runs; from/to pills fill.
- Modes: multiple option cards with smoke/time/verdict; non-default
  select swaps 'sel' cleanly.
- Vehicle wizard: intro → cls → fuel → year → PUC; back + skip work;
  chip updates + toast "estimates now use your ride".
- Journey: preview auto-starts under 'picked' consent; ×8 speed FAB
  toggles; progress/distance/meta advance; arrival → receipt
  "You're here." with dose + stats; 'done' exits; journey.history written.
- Air around me: sheet opens w/ back+✕; city card (742 µg, 52 µg/m³,
  13 fires, 62% clearing pace) renders; go-out picker searches
  'connaught place' → suggestions → depart graph renders (despite
  defect-03 throw); map tap shows tap-read chip pm25=49.
- Purest: via whereto 'stay' door; ranked places (Meerut 38 …) + stays
  (Janpath Guest House, Royal Plaza, Ramada w/ 24 h means); row opens
  env card (Meerut 44 µg/m³, window, station 46.7 km).
- Settings: renders; हिंदी → toast "hindi lands with the app — english-
  only today"; voice switch flips + persists; 'what we store' expander
  opens; rate → star → send → "thanks — that helps"; 'delete my data' →
  confirm → cancel leaves all data intact (cancel-safe).
- Ledger: today's trip listed (ISKCON→HUDA, Car AC, ~7.6 µg, simulated);
  row expands to detail.
- Sheets: airmap/purest/ledger have ‹back + ✕ and close cleanly to home;
  whereto closes via grab pull-down (defect-07).

## Console errors captured (verbatim, full session)

1. EXCEPTION (defect-03) — see verbatim above.
2. HTTP404 …/favicon.ico + LOG.error.network 404 (defect-05).
3. HTTP404 …/v2/reverse?lat=28.76545604380445&lon=77.209 +
   LOG.error.network 404 (defect-06).
(One 404 on /app/wait%204 was a test-driver command typo — not an app
request — excluded.)

## Notes

- Live Overpass search resolves in ~5 s; a 'Searching…' state shows
  meanwhile — latency, not a defect.
- Prod JS is ahead of the repo checkout (home/settings/whereto differ;
  settings.js absent locally) — this report was verified against the
  deployed bundle.
