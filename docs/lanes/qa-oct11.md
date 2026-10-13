# Lane Q (QA) — Oct 11 defect log

Rig: `/home/govinda/alive-dev/qa/` (puppeteer-core + Chrome 148 headless, 390×844 @DPR3, Android UA,
touch, geolocation override, safe-area emulated top 47 / bottom 34). Re-run everything with ONE command:

    bash /home/govinda/alive-dev/qa/run.sh <cycleName> [all|consent,home,search,route,airmap,purest,admin]

Writes `qa/shots/<cycle>/NNN-*.png|jpg` per step, `results.json` (raw), `summary.md` (auto-findings,
per-width global checks, search table). `node qa/summarize.mjs <cycle>` re-prints a summary.
Target: `http://localhost:8110/app/` (LOCAL webapp files + LIVE prod API `aa6836e8`) — lanes were editing
during the cycle, so every item below says which run saw it; items fixed mid-cycle are listed as fixed.

---

## Cycle 1 — 17:30–18:00 IST (runs c1 17:30, c1b 17:39, c1c 17:43, c1d 17:47, c1e 17:55)

### P0 — blocks the demo

1. **[P0][S] Where To list goes blank ("Searching…") for >1 s on most keystrokes, and 4.6–7.1 s after the user stops typing.**
   Repro: fresh tab `/app/#/whereto` (seed Shahdara), tap To, type letter by letter.
   c1d: "pawan bakery c block hanuman mandir ashok nagar shahdara" → list blank >1 s on **39 of 56** keystrokes;
   "neelanchal dham sant nagar" 21/26; "jama masjid shahdara" 6/20. Typed at a normal 70 ms/char,
   "jama masjid shahdara" shows NO rows for **7.1 s (c1b), 4.6 s (c1d), 4.9 s (c1e)**.
   Cause seen in the console: search.js still fires browser-side Overpass (4 mirrors: overpass-api.de
   ERR_CONNECTION_REFUSED, overpass.nchc.org.tw ERR_NAME_NOT_RESOLVED, kumi/private.coffee CORS-blocked) and
   Nominatim (CORS-blocked from the app origin) and the list waits on them; `/v2/ac` + `/v2/p/ac` are 404 on prod.
   Fix wanted: keep the previous rows visible until new ones arrive (never blank), and drop the browser-side
   Overpass/Nominatim calls in favour of the contract endpoints.
   Shots: `qa/shots/c1b/030-route-pick-list.png` (7 s), `qa/shots/c1/064-route-pick-list.png` (still "Searching…" at 2.5 s),
   table `qa/shots/c1/search-table.txt`.

2. **[P0][coordinator/P/X/A] The new webapp calls server endpoints that do not exist on prod (`aa6836e8`).**
   404s seen from the local webapp: `GET /v2/ac`, `GET /v2/p/ac`, `GET /v2/p/nearby?kind=lodging`, `GET /v2/purest`,
   `GET /v2/p/flow_tile/{z}/{x}/{y}.png`, `POST /v2/p/route_traffic`, `POST /v2/tally` (every screen),
   `POST /v2/usage` (consent). Deploying the webapp before the server = console errors on every screen,
   no jams, no live ETA, hotel search on fallback. Deploy server first (or together) and re-run this rig against it.
   Evidence: console/fails in `qa/shots/c1d/results.json` → steps.purest/route/search `.console`.

3. **[P0][J] (FIXED mid-cycle, re-verify) journey threw `ReferenceError: OFFROUTE_M is not defined`** (journey.js:738/748)
   on every GPS fix → banner frozen at "10 m Head out", "no location — counting the air where you started",
   3.0 km left never changed while 14 fixes were fed. Seen c1b 17:40 (`qa/shots/c1b/052-journey-stopped.png`).
   c1e 17:57: no pageerror; with a realistic 40 km/h emulated drive the banner counts down
   (10 m Turn left → 760 → 720 … 410 m Turn right), km-left 6.5→6.1, 40 km/h → 0 km/h when stopped, position
   holds. PASS now (`qa/shots/c1e/018-journey-moving.png`, `023-journey-stopped.png`).

### P1 — must fix before 20:00

4. **[P1][E/W] Route planning took ~35–40 s and returned partial results** ("a few routes timed out — showing what
   we have", ONE card). Repro: Shahdara → "Jama Masjid Road" (6.5 km), Health Maxer, car. The card area showed
   "finding the cleanest ways there…" for >35 s (`qa/shots/c1e/012-route-cards.png`; cards appear in
   `015-route-cards-w390.png`). c1b (3 km trip) and c1d (same 7 km trip) returned well inside the rig's wait →
   intermittent; probably prod under load from 11 lanes. Needs a hard client cap + honest message well under 35 s.

5. **[P1][S/X] Wrong #1 / weak results at the full query (c1d, latest):**
   - "iskcon east of kailash" → #1 "ISKCON Temple — temple (7.5 km)" (no locality; not EoK). The right row
     "ISKCON Temple — Raja Dheer Sen Marg, East of Kailash" is #3, below "iskcon temple — … Nithari, Noida".
   - "pawan bakery c block hanuman mandir ashok nagar shahdara" → #1 "New Ashok Nagar Bridge — Shahdara South"
     (11 km; New Ashok Nagar ≠ Ashok Nagar Shahdara); rest are other "Pawan …" shops 12–18 km away.
   - "sector 150 noida" → only 2 rows; #1 "ELECTRICITY OFFICE SECTOR-150" (33 km), no Sector 150 locality.
   - "neelanchal dham sant nagar" → "Sant Nagar — South" (honest locality fallback; Neelanchal Dham not indexed).
   - "jama masjid shahdara" → "Markazi Jama Masjid — mosque" then 2× "Jama Masjid — mosque" with NO locality
     line → can't tell them apart.
   OK now: "new delhi railway station" → NDLS #1; "sonipat" → "Sonipat — Haryana" #1.
   Shots: `qa/shots/c1d/0*-whereto-q-*.png`.

6. **[P1][S] (FIXED mid-cycle, watch for regressions) stale lists + raw tags + "no place found" at 17:32 (c1):**
   list frozen from "ne" for 24 keystrokes of "neelanchal dham sant nagar" (New Excel / Pick N Pack NE Store);
   frozen from "iskcon" for 16 keystrokes; "new delhi" → "no place found — try a landmark" while
   `/v2/search?q=new%20delhi` returns rows; "sonipat"/"sector 150 noida" → no rows ever; rows showing raw tags
   "muslim_place_of_worship", "overture:religious_organization", "amenity:place_of_worship";
   "creative_jama" as #1 for "jama masjid shahdara" (c1b). c1d: none of these reproduced.
   Note `search.js:15` DELHI_BBOX is still 28.35–28.95 / 76.75–77.55 → Panipat, Meerut, Hapur, Bulandshahr,
   Rohtak, Rewari, Palwal are outside the client filter (Sonipat town 28.99 is outside too — it survived only via
   rows inside the box). Check with X's /v2/ac once deployed.

7. **[P1][U] (FIXED mid-cycle) Hotel environment card glued text** "24 h avg73", "best5517:30",
   "worst tmrw9107:30", "17:30next 24 h16:30" at 17:37 (`qa/shots/c1/083-purest-hotel-card.png`).
   17:53 card is clean: boxed "24 h avg 68 / best 47 17:30 / worst tmrw 85 16:30" (`qa/shots/c1d/063-purest-hotel-card.png`).

8. **[P1][U] (FIXED mid-cycle) hotel card ✕ 21×19 px and unstyled "15 km | all NCR" segment (38×20/50×20)** at
   17:37 (`qa/shots/c1/076-purest.png`); 17:53 both pass (`qa/shots/c1d/056-purest.png`).

9. **[P1][U/X] Hotel search distances impossible (c1 17:37):** from CP, "Vivanta by Taj - Gurgaon 925 m",
   "Taj Mahal Hotel 104 m", "Tajpur Pahadi Barat Ghar 754 m". c1d showed "Taj Palace Hotel 6.0 km" (plausible) —
   re-verify after the `/v2/p/nearby` + `/v2/ac` deploy. Shot `qa/shots/c1/082-purest-hotel-search.png`.

10. **[P1][M] Air Around Me still carries caption/explainer text** under the hero: italic "the air is barely
    moving — the day's pollution is sitting over the city", "station 1.6 km · field 5 min old", "the streets and
    totals in this view are counted from trips other people share", "why this is an estimate", plus a long
    advice block ("outdoor exercise … kids outdoors before ~06:30 IST … windows open …"). Spec: NO caption.
    Shot `qa/shots/c1d/04*-airmap*.png`. (AQI scale fixed mid-cycle: 17:37 showed "150 AQI satisfactory"
    = US-AQI number + PM2.5 word; 17:52 shows "131 AQI moderate", consistent with Home.)

11. **[P1][U] Same AQI, different band colour/word than Home.** Purest rows 114–140 AQI are painted gold
    (`--b1`, satisfactory — the PM2.5 band of 41–51 µg/m³) while Home paints AQI 128/162 orange "Moderate"
    (`--b2`); hotel card "130 AQI now · PM2.5 47 µg/m³ · satisfactory". Rows read "114 AQI now · 41" (41 =
    unlabeled PM2.5). Band colour must mean one thing: colour the AQI number by the AQI category like Home, label
    PM2.5 explicitly. Also "South Delhi · 15.8 km" is listed under the "15 km" filter. Shots
    `qa/shots/c1d/056-purest.png`, `063-purest-hotel-card.png` vs `qa/shots/c1c/041-home-cp-picked.png`.

### P2 — polish

12. [P2][coordinator] `sheetChrome` back ‹ / close ✕ buttons are 36×36 (<40) on every sheet (air map, purest).
    Owner of `app.js/app.css`. Shots `qa/shots/c1d/048-airmap-w390.png`.
13. [P2][J] Journey + old receipt used monospace for numbers/lines ("10 m", "0 µg", "5 min · 3.0 km left");
    new receipt (c1e) is clean: band-coloured bars (all `--b1`, matches "satisfactory"), "Most intake · near
    Aastha Medicos" marker, verdict "Very light", no "simulated" text. No "jammed here" marker yet (no jams
    without `/v2/p/route_traffic`). Shot `qa/shots/c1e/024-receipt.png`.
14. [P2][W] Map behind Where To / modes step sits on Hamidpur (N Delhi), not on the user or the route
    (`qa/shots/c1b/031-route-after-pick.png`).
15. [P2][X] duplicate rows: "Sonipat-Baghpat Road — Khewra, Haryana" ×2 (c1d), "Jama Masjid Road — Khureji
    Khas" ×2 (c1b).
16. [P2][A] Admin gate (`/admin-local`): token input font 13 px (<16 → iOS zoom), "sign in" 79×30, footer link
    13 px tall, header "Alive / the engine room" at y=20 (under a 47 px status bar), body copy falls back to a
    Times-like serif, 110-char explainer line. Relative `session` call → 404 `/admin-local/session` under the
    dev proxy (fine at `/admin` if the route exists). Shot `qa/shots/c1/088-admin.png`.
17. [P2][H] consent "Share my trips" toggle explainer is 3 lines at 320 px; otherwise fine.
18. [P2][M] map attribution links/`summary` 14–24 px tall (maplibre default) on journey/receipt.
19. [P2][P] `GET /grid?cells=40&param=pm2_5` → 502 once (c1d 17:51) — transient upstream?

### Feature verdicts (latest run)

| Feature | Verdict | Evidence |
|---|---|---|
| 1 Consent (fresh profile) | **PASS** (c1c) — Continue → "Use your location? Your location is only used to analyse the air around you." Share → granted + home "Air where you are 162 AQI"; Drop → "Tap the map…" → tap → "Air at your pin"; Not now → toast + "Central Delhi's air · Set location" | `qa/shots/c1c/006,012,024,032-*.png` |
| 2 Home (Shahdara, CP) | **PASS** (c1c) — AQI 162/128 Moderate, PM2.5 60/57, PM10 192/141, band-coloured, "from ITI Shahdra … 1.9 km away · read 13 min ago", no caption cards; clean at 320–430 | `qa/shots/c1c/033,041-*.png` |
| 3 Where To type-ahead | **FAIL** — blank lists >1 s (P0 #1), wrong #1 for 3 of 7 queries (P1 #5); air rows removed (PASS) | `qa/shots/c1d/` |
| 4 Modes → vehicle → cards | **PASS w/ P1** — 3 modes, vehicle grid, single clean card w/ real numbers, no jargon; plan latency 35–40 s once (P1 #4) | `qa/shots/c1e/002,007,015-*.png` |
| 5 Journey + receipt | **PASS** (c1e) after OFFROUTE_M fix — banner updates, stop holds, End → confirm → simple receipt | `qa/shots/c1e/018,023,024-*.png` |
| 6 Air Around Me | **PARTIAL** — street-level AQI layers (`alive-airroads-line`, `alive-field-fill`) + planning-to-go-out card; caption text remains (P1 #10) | `qa/shots/c1d/04*-airmap*` |
| 7 Purest + hotel | **PARTIAL** — districts list + hotel pick works; env card typography glued, tiny ✕ / segment (P1 #7–9) | `qa/shots/c1d/05*-purest*`, `06*` |
| 8 Admin gate | **PASS w/ P2** — renders dark gate, locked cards | `qa/shots/c1d/068-admin*.png` |

Global checks, all screens × 320/360/390/430: **no horizontal overflow anywhere; no visible text overlaps**
(after clipping-aware audit; the c1 "unverified" overlaps were scroll-clipped text / glyph boxes — false
positives); inputs ≥16 px everywhere except the admin token box; tap-target misses listed above.

Rig caveats: Where To stale/blank timing is measured per keystroke with a 1.5 s cap per key (so "blank 1.5 s"
means ≥1.5 s); vehicle selection in the rig ends on "skip" (chip reads "a typical Delhi ride") — not a product bug.

### Next cycle (Q will run on relaunch)
- Re-run `run.sh c2 all`; switch `BASE` to the local full server (:8108) as soon as lane P has it up, so the
  new `/v2/ac`, `/v2/p/*`, `/v2/purest`, `/v2/tally` paths are exercised end to end.
- Add queries: a DIGIPIN, a house address, a Greater Noida society, a Sonipat street address; positions Sonipat /
  Greater Noida / Cyber City; Petrol + Health (litres saved, never ₹) and Time + Health (live ETA) cards.
- Rig fix: vehicle step should pick car → petrol → year instead of ending on "skip".

---

## Cycle 2 — 18:05–18:30 IST (lane Q2) — target `http://localhost:8111/app/` = local webapp + LOCAL full server :8108

Runs: c2s 18:05 (search), c2/c2x 18:05 (all other steps — killed by the server, see #1), c2b 18:15 (search),
c2c 18:15 (home/route/airmap/purest/admin), c2y 18:15 (modes ×3), c2z 18:18 (sidebar + profile),
c2p 18:22 (Home↔Air parity + Purest colours — on **:8110 = prod API**, because :8111 was dead), c3j 18:24 (journey on :8110).
Rig changes (qa/ only): `run.sh <cycle> <steps> <base>` (3rd arg or `BASE=` env), per-keystroke time-to-rows + which
APIs/third-party hosts each keystroke hit, `C-12 ashok nagar shahdara` + DIGIPIN `39J-2KP-K2F2` (= Pawan Bakery
28.6952,77.3000 via `A.digipin.encode`), vehicle step now car → petrol → 2017–2020, plan latency + card fields,
new `extra.mjs` (modes ×3, Home↔Air parity, Purest colour vs Home band, sidebar/profile, rAF frame probes).
Box load average 16–18 on 12 cores the whole cycle (11 lanes) — absolute timings are pessimistic.

### P0

1. **[P0][P] The local full server behind :8111 was unusable for most of the cycle and is DOWN since ≈18:19.**
   `server-8108.log`: 25 hot reloads between 17:59 and ≈18:17 (lanes saving `v2/providers.py`, `v2/trip.py` and even
   `tests/test_providers.py` / `tests/test_admin_oct11.py` — the `--reload-exclude tests` does not stop test edits from
   reloading). Each restart rebuilds the ac index and runs a blocking ingest (`ingest run … total=15590ms`) during which
   `/health` does not answer; the listen backlog reached **482** queued connections and `/health` took **38 s** at 18:15.
   Since ≈18:19 the uvicorn **worker is gone** (reloader pid 87255 still owns :8108, no `spawn_main` child, no
   "Finished server process" line → killed, probably OOM: 15 GB box, other lanes run servers on :8118/:8119/:8128);
   every API call through :8111 hangs; backlog 250 at 18:25. Fix (lane P): `RELOAD=0 bash /home/govinda/alive-dev/run-8108.sh`
   and restart deliberately after edits. Q did not restart it (not Q's lane). Everything below is labelled healthy/down.

### P1

2. **[P1][S] Previous rows are dropped while a slow query is pending → skeleton-only list for ≥1.5 s per keystroke.**
   Healthy API (c2s 18:06, c2b 18:16, "new delhi railway station" / "iskcon east of kailash"): rows on screen
   **30–65 ms** after every keystroke (≤160 ms for the first rows at 2 chars), new data in 100–400 ms,
   **0 blank keystrokes** — good. API slow/down (c2b
   18:17–18:20): "pawan bakery c block hanuman mandir ashok nagar shahdara" **47/56** keystrokes show only the
   progress bar + skeleton (`.wt-prog` / `.wt-skel`) for ≥1.5 s; "neelanchal dham sant nagar" 20/26; "c-12 ashok nagar
   shahdara" 18/25; DIGIPIN 9/12; "jama masjid sh…" blank to the end. Keep the last rows (re-ranked) until replacements
   land. Table: `qa/shots/c2b/results.json` → `steps.search.queries[*].ks` (tRows / blankMs / api per key).
3. **[P1][S] Browser still calls Overpass ×4 mirrors + Photon on keystrokes, even with a healthy API.**
   c2b: NDLS 6/25 keystrokes, ISKCON 12/22, every keystroke while the API was down (50/56 for Pawan). Console fills with
   CORS errors (overpass.kumi.systems / private.coffee), `ERR_NAME_NOT_RESOLVED` (overpass.nchc.org.tw) and
   `ERR_CONNECTION_REFUSED` (overpass-api.de). No Nominatim on keystrokes (OK) and **no keyed provider host
   (olamaps / mappls / tomtom) is ever called from the browser** (OK — keys stay server-side).
4. **[P1][S/X/P] Search results by query (final list after typing; "down" = API not answering):**
   | query | #1 | verdict |
   |---|---|---|
   | new delhi railway station | New Delhi Railway Station — railway station (9.0 km), #1 from "new delhi ra" | PASS (healthy) |
   | iskcon east of kailash | ISKCON Temple, Delhi — Hare Krishna Hills, Sant Nagar, East Of Kailash (c2b) / ISKCON East Of Kailash Temple — Kallu Mohalla, B-80 (c2s) | PASS (healthy) |
   | pawan bakery c block … shahdara | **Pawan Bakery — C-543, Hanuman Mandir Rd, West Jyoti Nagar (1.2 km)** (c2b; landed from one late `/v2/p/ac` 200) | PASS result / FAIL per-keystroke (down) |
   | neelanchal dham sant nagar | Sant Nagar — South (locality fallback) | FAIL (down). Direct `curl /v2/p/ac` at 18:03 had "Nilanchal Dhaam Bace · Sant Nagar, East Of Kailash" only at **#6**, below 5 Ola "Neelachal Dham" rows in Faridabad / Noida Sec 18 / Fatehpur Beri → the merge must rank the "sant nagar" token match first |
   | c-12 ashok nagar shahdara | Block C-12 Yamuna Vihar (2.4 km) — wrong locality | FAIL (down; house-level provider rows never arrived) |
   | 39J-2KP-K2F2 (DIGIPIN) | 39J-2KP-K2F2 — DIGIPIN · exact spot (1.2 km) | PASS (no reverse name while down) |
   | sonipat | Sonipat — Haryana | PASS |
   | sector 150 noida | ELECTRICITY OFFICE SECTOR-150 (33 km); no Sector 150 locality row | P2 [X] (as c1) |
   | jama masjid shahdara | Jama Masjid Road — Khureji Khas (c2b) / Jama Masjid — mosque · Dilshad Colony (c2s) | P2 — a road beats the mosque |
   Shots `qa/shots/c2b/0*-whereto-q-*.png`, `qa/shots/c2s/…`.
5. **[P1][E/P] Every plan says "a few routes timed out — showing what we have"; only ONE car route comes back.**
   Shahdara → New Delhi Railway Station, car/petrol/2017–20 (c2y 18:16): Health Maxer `/v2/plan` 200 in **3.9 s**
   (cards 3.3 s after the vehicle tap), Petrol + Health 200 in **2.0 s** (cards 1.3 s). Both return the same single car
   route (14.65 km via Vikas Marg) → the three modes cannot differ and "litres saved" is always 0 (`fuel_saved_l: 0`).
   Server log shows many `provider ola timeout` / `provider mappls timeout` at the same time. Time + Health: no
   `/v2/plan` answer within 45 s (server reload at 18:16:3x) — re-run needed. Route step c2c: plan never answered
   (server down) → UI shows the honest "couldn't load the ways there — check the connection · try again" (good).
5b. **[P1][P] Provider calls fail a lot on the local server:** `server-8108.log` (17:59–18:20) has **177 × `provider ola
   timeout`, 63 × `provider mappls timeout`, 16 × `provider mappls http 400`, 1 × `provider tomtom timeout`**. This is
   why Ola route alternatives go missing (P1 #5) and why provider rows (Neelanchal via Mappls, C-12 house rows via Ola)
   arrive late or never in the browser (P1 #2/#4). Check the 3 s budget under load / event-loop blocking, and the
   Mappls 400 request shape.
6. **[P1][M] Air Around Me still shows a caption** under the hero at CP (prod API, c2p 18:22): italic
   `.dt-whyhero.am-why` "the air is barely moving — the day's pollution is sitting over the city" (airmap.js:700) plus
   the long advice block "outdoor exercise cleanest window ~17:30-01:30 IST (a…". Spec: NO caption.
   Shot `qa/shots/c2p/004-parity-cp-airmap.png`.

### P2

7. [P2][coordinator] `sheetChrome` ‹ / ✕ still 36×36 on Air Around Me and Purest at all widths (`qa/shots/c2c/042-airmap-w390.png`).
8. [P2][A] Admin gate (`/admin-local` on :8111) renders the dark page ("operator sign in", "who's using it",
   "journeys", "modes used most"), but: `#gatetok` font 13 px (<16), "sign in" 79×30, wordmark 44×18, footer link
   183×13, "alive / connecting… / operator sign in" at y≈20–24 under the 47 px status bar, 1-line explainer caption at
   430 px. Shots `qa/shots/c2c/062-admin.png`, `066-admin-w430.jpg`.
9. [P2][M/coordinator] Frame drops on sheet open (rAF probe, headless SwiftShader at load 17 — indicative only):
   Home → Air Around Me open: **16/24 frames >16.7 ms, max 217 ms, one 111 ms long task** (sheet itself animates
   transform+opacity 0.34 s, so the cost is main-thread work at open); Air → Home close 6/77, max 167 ms;
   Home → Where To 3/90, max 67 ms (smooth); Where To → Purest 14/141, max 117 ms.
   Sidebar open 8/34, **max 350 ms** at the first frame; close 4/16, **max 433 ms**; profile sheet 8/66, max 167 ms
   (all transform/opacity transitions). Confirm on a phone; if real, defer data/map work until `transitionend`.
   Data: `qa/shots/c2p/results.json` → `steps.parity.cp.frames*`, `qa/shots/c2z/results.json` → `steps.drawer.frames*`.
10. [P2][H/P] On the local server Home reads "113 AQI Moderate · PM2.5 64 µg/m³ · **PM10 —µg/m³**" (local ingest:
    `stations=… unavailable: no key`). Prod shows PM10 (199 at Shahdara). Env gap, but "—µg/m³" should drop the unit.
11. [P2][Y/coordinator] (FIXED by 18:15) 18:05–18:09 `index.html` already linked `sidebar.css/profile.css/sidebar.js/profile.js`
    before the files existed → 404 + "Refused to execute script … MIME type application/json" on every screen.

### Verified OK this cycle
- **Home ↔ Air Around Me parity (prod API):** Shahdara 166 = 166, CP 136 = 136, identical colour `rgb(170,115,70)`;
  PM2.5/PM10 match. Planning-to-go-out card present at CP (c2p).
- **Purest colours (c1 #11 FIXED):** all 10 rows + hotel card painted with Home's CPCB band for the same AQI (band 2 ink,
  same RGB as Home); rows now read "140 AQI now · PM2.5 54"; hotel card "The Lalit 133 AQI now · Moderate PM2.5 50 ·
  PM10 148 µg/m³", boxed 24 h avg / best / worst (CSS-spaced). Alive pick on top ("The Hotel W · cleanest next-24 h air").
  `qa/shots/c2p/001-purest-rows.png`, `003-purest-hotel-card.png`.
- **Modes / cards (healthy plans):** 3 mode buttons (Health Maxer / Petrol + Health / Time + Health), vehicle wizard
  car → petrol → year, card shows ETA + arrive time, "6 µg breathed · satisfactory air", **"+3 min traffic"**,
  **"0.8 L petrol"**, why line ("cleanest air on this trip" / "least petrol and the cleanest air"), badge; plan has
  `fuel_l`, `live_eta_s`, `traffic_delay_s` 192, `jams` 1, `why`, `mode_pick` on all 9 options; **no ₹ anywhere**.
  `qa/shots/c2y/0*-modes-*-cards.png`, plans `qa/shots/c2y/plan-*.json`.
- **Sidebar + profile sheet (lane Y, 18:18):** menu 44×44 → drawer 335 px "Make Alive yours · Where to · Air around me ·
  Purest places · Trips · Saved places · Settings · Privacy · Delete my data"; profile sheet inputs 16 px / 48 px tall;
  no overflow, overlaps or <40 px targets at 320/360/390/430. `qa/shots/c2z/004-drawer-open-w390.png`, `010-profile-open-w390.png`.
- Global (all c2 screens × 320–430): no horizontal overflow, no visible text overlaps; inputs ≥16 px except admin token.

### Feature verdicts (cycle 2)
| Feature | Verdict |
|---|---|
| Where To type-ahead | **PARTIAL** — fast & correct when the API answers (NDLS, ISKCON, Pawan #1, DIGIPIN, Sonipat); drops rows + skeletons when slow (P1 #2), Overpass from browser (P1 #3), Neelanchal / C-12 not verifiable (server down) |
| Modes → vehicle → cards | **PASS w/ P1** — fuel / +min traffic / why present, 2–4 s plans; single route only (P1 #5); Time + Health unverified |
| Journey → receipt | not testable on :8111 (no plan); c3j on :8110 — see cycle 3 |
| Air Around Me | **PARTIAL** — AQI = Home's (PASS), caption still there (P1 #6) |
| Purest + hotel | **PASS** — colours = Home's band, hotel env card clean |
| Sidebar + profile | **PASS** (built by 18:15) — jank on open (P2 #9) |
| Admin gate | **PASS w/ P2** (#8) |

## Cycle 3 — 18:24– IST (journey on :8110 because :8108 had no worker)

- **Journey → receipt (c3j, prod API, journey.js of 18:01): PASS.** Shahdara → "jama masjid shahdara" (#1 "Jama Masjid —
  place of worship", 7.5 km), Health Maxer, car/petrol/2017–20: prod `/v2/plan` 200 in **11.4 s** (cards 10.6 s after
  the vehicle tap; prod card has no fuel / traffic / why yet — those need the new server). Emulated 40 km/h GPS:
  banner "Head out → 10 m Turn left → 760 m Turn right → 720 … 410 m Turn right", stop → holds at 410 m (4 × 2 s),
  End → "End the trip here? Keep going / End" → receipt "Car (AC) · least smoky way · You breathed ≈ 0.3 µg
  satisfactory air · Very light · under 1% of a day at the WHO limit · Most intake · near Aastha Medicos · 440 m ·
  ≈ 60 g CO₂"; bars all `--b1` = the stated band. No "simulated/preview" text. No "jammed here" marker (prod has no
  `/v2/p/route_traffic` → 404, also `/v2/p/flow_tile` 404). Only maplibre attribution links <40 px.
  Shots `qa/shots/c3j/018-journey-moving.png`, `023-journey-stopped.png`, `024-receipt.png`.
- :8108 had no worker until someone restarted it at **18:32:26** (fresh log, no reloader). Re-runs on :8111 at 18:33:
- **Modes ×3 (c3x): PASS.** `/v2/plan` 200 in **2.5 s / 0.9 s / 0.9 s** (Health Maxer / Petrol + Health / Time + Health),
  cards 0.25–1.8 s after the vehicle tap, 2 car cards each: "19 min · 6 µg breathed · satisfactory air · **+2 min
  traffic · 0.8 L petrol**" + why ("cleanest air on this trip" / "least petrol and the cleanest air" / "fastest now and
  the cleanest air"); no "routes timed out" notice any more (so P1 #5 was load/provider timeouts); no ₹; console clean.
- **NEW [P1][E/W] Petrol + Health contradicts itself on screen:** the picked card carries the "least petrol" badge and
  why "least petrol and the cleanest air" at **0.8 L**, while the card right below reads "**0.7 L petrol** · 17% more
  smoke, 0.07 L less petrol" (excluded by the +15 % dose rule — correct engine, misleading words). Say "least petrol
  for clean air" / show the trade-off. Shot `qa/shots/c3x/005-modes-petrol_health-cards.png`, plan `plan-petrol_health.json`.
- **Pawan Bakery per keystroke (c3s): PASS** — #1 "Pawan Bakery — C-543, Hanuman Mandir Rd, West Jyoti Nagar (1.2 km)"
  from "pawan bak" (9th key) to the end; 1/56 keystrokes blank >1 s; **no Overpass/Photon calls** with a healthy API.
  Still 8/56 keystrokes where rows vanish ≈0.45 s when the new word doesn't match the old rows (P1 #2, milder).
- **[P1][S] Neelanchal Dham Sant Nagar: FAIL in the browser although the server has it.** `curl /v2/p/ac` (18:34) →
  #1 "Nilanchal Dhaam Bace · Sant Nagar, East Of Kailash" (mappls, kind `lodging`); the To list shows "Neelachal Dham
  Center — Asola, Fatehpur Beri (28 km)", "Neelanchal Dham — Faridabad", "ISKCON Neelachal Dham — Sector 18" and drops
  it. Likely search.js ranking: "nilanchal" ≠ "neelanchal" (2 edits > one-typo rule) and `kind: lodging` hits
  `NOISY_KIND`. Provider rank #1 + locality-token match ("sant nagar") should win. Shot `qa/shots/c3s/007-whereto-q-neelanchal_dham_sant_nagar.png`.
- **C-12 Ashok Nagar Shahdara: PARTIAL** — #1 "12/214 — Street Number 20, Block D, Ashok Nagar Mandoli (1.6 km)"
  (house-level, right area); `/v2/p/ac` itself has no exact C-12 row (top: "1284, Street Number 7/C — West Jyoti Nagar,
  Ashok Nagar Mandoli, Ashok Nagar, Shahdara").
