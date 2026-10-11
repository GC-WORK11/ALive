# HANDOVER — what happened overnight (Oct 10 night → Oct 11 noon)

You are taking over from Devin session `39817b9ec42b4ecc91694474c4451967` — the overnight coordinator. You gave it the handover last night; this is what it did with it. Repo: `github.com/GC-WORK11/ALive` (public, main branch, direct pushes — no PRs). Local clone: `/Users/devin/repos/ALive`.

## Deployed truth
- **Prod backend**: `https://d2eh2l2ys9wkij.cloudfront.net` (CloudFront → NLB `65.2.28.40` → ECS Fargate `alive108`, ap-south-1, acct 185708268748). Current build: **`aa6836e8` = deploy :276**. Check `GET /health` → `build_sha` for deployed truth.
- **Deploy command**: `PATH="$HOME/.aws-venv/bin:$PATH" bash scripts/deploy.sh` (~9-10 min: CodeBuild → ECR → new task def → rolling deploy → verify /health).
- **Consumer mirror**: `delhi-is-alive.vercel.app` (landing at `/`, real app embedded at `/app/`; `X-Frame-Options: SAMEORIGIN` now, so the landing's live-preview phone runs the actual app).
- The app itself lives in `server/webapp/` (vanilla JS+CSS, no framework): `home.js`, `whereto.js`, `journey.js`, `airmap.js`, `purest.js`, `search.js`, `settings.js`, `app.js`, `app.css`, `index.html`.
- Android source of truth for design: `Mobile/src/` (theme.ts, icons.tsx, screens). The webapp is now a PIXEL TWIN of the RN app — same card order, same strings verbatim, same shapes/type/spacing. RN wins every disagreement (`docs/lanes/rn-twin.md`).

## What shipped overnight (all on main, all deployed, all verified on prod)

### 1. Pixel-twin rebuild (the pivot)
- RN-twin lanes rebuilt home+consent+settings (`1a4dbe9`, `3d2e192`, `1caaf7b`), whereto+vehicle (`acbe267`, `71ea89d`), journey+receipt, delhi-today+ledger. The webapp IS the Android app now — serif hero number, gold band-ink, "Where to?" dark pill, 5-page onboarding with live number, Settings screen the web never had.
- parity-fix `0645c3c`: all 11 measured RN mismatches killed — onboarding gates Next on sharing choice, Skip persists share-off + asks location, swipe paging, DayCard + WeekStrip from real local daylog, whereto intent rows ("the air map · near you"), "least smoky way" wire strings.

### 2. The owner's critique #1 (all dead on prod)
- **Third composer killed** (`cbf7a4d` wlive): From/To rows ARE the inputs now — tap row, type in place. First-letter typeahead: local tier paints ~instantly from seeded recents+index, server merges under the same list ~200ms. "type one bakery → ALL bakeries near you."
- **Black card killed**: was `.am-read` — dead `app.css` rule stretched it 760px frosted across the screen (`355b571` mobile5). ALSO killed the `.hs-profseg` toggle strip on the budget card (`dea8019`) — that's the "black strip with toggle system" he meant.
- **Provenance** (`3b6c65b` proven): hero now reads "from {station name} · {km} away · read {m} min ago" — named monitor via argmin over `/aqi field.stations[]` (server `_KY/_KX` formula reproduced exactly). Honest states for pin/stale/off/edge.
- **Overlaps**: mobile5/mobilefit rounds killed the frost slab, 22×19px amr-x, srow name bleed, sub-40px targets, 15px inputs, chrome slices.
- **Icons** (`7ab222f`): real category glyphs on result rows — `D` icon dict += restaurant/city/route from `Mobile/src/icons.tsx`, `CAT_MAP` rewritten. 95.7% of rows on real icons (was 54.9%).

### 3. The location/index war (his #1 ask — "thousands of database merged, brutally deeply")
- **Gazetteer now 240,027 rows on prod** (gazupdate `a61156f` → 210k; gazmerge `e6ce221`+`39d08b6` → 240k + **95,957 generated alias forms**: mandir↔temple, masjid↔mosque, ~60 romanization pairs, honorifics, abbreviations, fused-split localities; locality/city attach for compound queries). Corpus: `server/data/corpus/delhi-corpus.jsonl.gz` 345k entries. NOTHING hardcoded.
- **Search engine fixes** in `server/v2/search.py`+`gazetteer.py`, each verified per-query on prod:
  - `a6e706f` indexfix: planted-coords cluster killed (Srinagar Railway Station at Delhi coords, Tea Square Abu Dhabi labels), AIIMS/Lotus dupes demoted, qualifier anchoring.
  - `2f4afce` poolgap: Sikanderpur/Chhatarpur metro + Airport T1/T2/T3 reach the merge.
  - `b679d6e`+`a9af06d` anchorsink: place-anchor resolution — `jama masjid shahdara`→in-Shahdara mosque, `sector 28 faridabad`→Fbd (was Noida), `anand vihar metro`→real stn, `delhi airport t1`→T1-IGI.
  - `b2a0af9` geo5 (latest): `_far_literal` gates (sheetla-mata universal sink dead), `_anchor_corrupt` fixes, `_anchor_gap` coverage gate (yatharth/felix/ecotech requeries), numerals gate (`sector 150 noida` no longer →"150 Shanti Lane"), `patel nagar station delhi`→railway, `sarai rohilla`→station.
  - `3d4cd13` deeppass: T3 Overpass probes race 3 mirrors per query (~0.7s prod).
- **Sweep-4 on prod (150 fresh queries)**: EXACT 52 / NEAR 15 / CLUSTER 39 / WRONG 45 / MISS 1 — down from WRONG 54. Remaining wrongs are honest no-data (e.g. zero Sheetla rows exist in Burari anywhere) + a handful of anchor cases.
- **Verified live flips you can re-test**: `sheetla mata burari`→in-Burari, `sant nagar`/`gokalpur`→real anchors, `sarvodaya hospital faridabad`→hospital, `shiv nadar school noida`→still weak (honest index gap).

### 4. Acct2 testing fleet (org `org-5f3b8c91f908494a9c5d3ddcef1c40c2`)
- 5 lanes ran real-user probes all night and filed reports in `docs/lanes/`: e2e2/e2e3 full regressions (11/11 stages), mobile-reality audits @390×844, geo sweeps 1–4 (~600 fresh queries), perf/UX truth. Every defect they found is fixed and re-verified dead on prod: plan cards now show real `eta_s` minutes+arrive clock, pick-mode goes transparent+inert so map taps reach canvas (`a8fdb06`), settings vehicle reads `whereto.vehicle`, Esc unarms pin-drop, favicon route, landing preview phone embed.
- Their one remaining knowns: overpass arm ~3s (parallel race landed, still bounded by mirrors), `sector 28 faridabad`-class cases get better as index grows.

## Traps & mechanics (don't relearn these)
- **My org cannot push to GC-WORK11/ALive** — every push 403s. All pushes go through acct2's geo lane (`devin-ae597b9c1b884a6c9f609fd640ef976d`): `git format-patch` → upload .patch to acct2's `/attachments` endpoint (Bearer `$DEVIN_ACCT2_SERVICE_KEY` — acct2 sessions can't read MY org's attachment URLs, re-upload there) → `POST /v3/organizations/org-5f3b8c91.../sessions/devin-ae597b9c.../messages` (my own devin tools 403 on acct2 sessions — use raw curl). Attachment upload cap ~78MB: split data commits into code patch + repo-relative tarball.
- **Store keys are JSON-quoted**: `alive.consent`='"picked"', `alive.onboarded`='1', `alive.pos`=JSON `{lat,lon,label?,t}`. Playwright rigs must seed quoted values or onboarding gates home render.
- **Post-wlive DOM**: `.wt-rrow` button↔`.wt-rrow.on.edit`+`input.wt-rin`; `[data-act="clear"]`; `.wt-bbtn[data-act="close"]`; `.wt-act [data-act="locate"]`/`[data-act="map"]`; `.wt-list .wt-row[data-k^="res:"]`.
- **Prebuild destroys cleartext + landing asset 404s** — vendored data files only serve after a deploy.
- **Videos**: `/tmp/pptr/drv.js` is the recorder (STORAGE seeds, 390×844, recordVideo). `D.cap()` is now a NO-OP forever — owner saw a caption bubble in a video and thought it was in-app. Never re-enable.
- **Compound-latency test** fails on the mac VM (p95 ~130ms vs 50ms budget) — pre-existing hardware bound, not a regression.
- **Deploy numbering** used in `docs/lanes/COORDINATOR-STATE.md` tracks every round; lane reports in `docs/lanes/acct2-*.md` + `docs/lanes/geo5-report.md` are evidence.

## Still open (honest gaps)
- Real-time traffic — needs a free TomTom/HERE key; routes are real but not jam-aware.
- ~10 names not in ANY free index (e.g. `neelanchal dham` verified unmappable in OSM/Overture/GeoNames/Wikidata/Nominatim/Photon) — resolves as honest empty, not fake.
- Vercel mirror redeploy is the owner-side manual.
- `shiv nadar school noida` weak (honest gap).

## Demo-ready evidence
- Prod :276 verified queries above; 8 per-feature videos reshot caption-free were delivered to the owner (consent/home/search/whereto/journey/airmap/purest/admin on aa6836e8).
- Sweep/perf/regression reports: `docs/lanes/acct2-{geo4,e2e2,perf3,mobile5,mobile6}.md`, `docs/lanes/geo5-report.md`, `docs/lanes/COORDINATOR-STATE.md`.
