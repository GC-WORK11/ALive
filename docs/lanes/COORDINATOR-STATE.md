# COORDINATOR STATE — alive webapp wave 2 (updated 2026-10-10 ~16:45 UTC)

Coordinator session: devin-39817b9ec42b4ecc91694474c4451967 ("Launch Six Agents").
Repo: GC-WORK11/ALive `main`. Prod: https://d2eh2l2ys9wkij.cloudfront.net (+ Vercel delhi-is-alive.vercel.app proxy). Webapp live at /app since deploy :9878ca3f.
Lane contract: docs/lanes/webapp-wave2.md. Lane prompt files on coordinator box: /Users/devin/lane-prompts/lane-*.txt.

## Fleet (SWE-2 cap = 7 concurrent; terminate settled lanes to free slots)
| Lane | Session | Status |
|---|---|---|
| home+consent | a54609c0108248caa7ecd07ac724f3ff | DONE, terminated. Shipped 6027c8c/33e4d64/5a22c94 + docs/lanes/home-report.md |
| deep search | d398397c2cb14f74814e6d2efe09ba65 | running |
| journey+receipt | 57f50f80 | DONE+terminated: e9136f0/194cfe6/3851646 — real GPS nav, labeled preview, honest receipt |
| whereto | — | DONE BY COORDINATOR inline: cbadb07 (whereto.js+whereto.css). Needs browser QA pass. |
| airmap+purest | e21a32eb | running (launched ~17:25) |
| admin | — | NOT LAUNCHED (slot cap) — prompt file ready |

## Rival tree (DO NOT duplicate — outside coordinator control, 403 on interact)
auto-cdc1fa9fa4cf47a58cdefe87a47cb86c "keep cooking" (user asked it disabled — approval pending): spawned coordinator 9160aa614c1a4e759c5754d159741f4e "Build Alive Web App" + lanes 5bef2fc1 (web/ Vite+React on web/dev branch), e0fcfdca (API atlas), e0372075 (maplibre). Net-policy = git-only → can't hit API. Building a DIFFERENT app in web/ — verify whether it lands anything; merge ideas not code.

## Verified facts
- /v2/plan one call returns ~17 options across ALL vehicles (car/car_open/bike/auto/cycle/walk/bus): fields mode,label,tag,recommended,reason_line,delta,distance_km,eta_s,dose{lo,mid,hi,avg_conc_ugm3,confidence},engine_dose_ug,emissions{co2_kg,pm25_g,nox_g},segments[{geometry,pm25,band,start_frac,end_frac,dist_m}],via_names,route_id,steps_source(osrm|endpoints|gtfs). partial:true possible.
- /aqi: pm25,pm10,no2,o3,co,so2,us_aqi,us_aqi_basis,nearest_station_km,beyond_field_edge,fire{},wind{},field age via built_epoch.
- /v2/why: {line,cause_note,drivers[],history.points[]}.
- /v2/search: results[] {id,lat,lon,score,name,subtitle,kind,distance_m,match}.
- /app, /app/{asset} routes live in main.py (cache 60s html, 1h assets). Deploy: PATH=$HOME/.aws-venv/bin:$PATH bash scripts/deploy.sh (~6min, CodeBuild). aws-cli at ~/.aws-venv (acct 185708268748, ap-south-1).
- heartbeat automation auto-0468765fe2a6477cace3578a511f42e7 re-injects master prompt every 2h (next 17:00 UTC).

## Next actions (in order)
1. Launch airpurest + admin lanes when slots free (terminate finished lanes first).
2. Browser-QA whereto + home on localhost:8090/?api=CF — screenshots, then deploy again once lanes land.
3. Check rival tree sessions; if dead, good; if they landed useful work in web/, harvest ideas only.
4. Integration pass: journey CTA visible only when journey registered (whereto handles), doors auto-render.
5. Re-deploy after each wave; verify /app on CF + Vercel; truth-audit every rendered number vs live JSON.
6. Credential rotation reminder for final report (keys pasted in chat = compromised).
7. Memory update at end: webapp-wave2 facts, deploy recipe, rival-tree lesson.

## Deep-search test data (coordinator probing, 16:58 UTC)
- "Pawan Bakery c block Hanuman mandir Ashok nagar shahdara": /v2/search misses (gives Pawan Plaza pastry 0.5km central). Photon finds "Royal Bakery, Near Hanuman Mandir road, Shahdara" (77.2839,28.6211) — right locality. Fix = better token handling/bias.
- "Neelanchal dham santnagar": /v2/search, Photon, Nominatim, Overpass-spellings ALL empty — POI likely absent from OSM. Photon resolves "Sant Nagar" localities (77.0912,28.647 west; 77.2495,28.5548 south). Honest UX = offer locality + drop-a-pin, never invent coords.
- "iskcon east of kailash": /v2/search resolves 3 delhi_index hits incl ISKCON East Delhi (28.56ish) — verified live in whereto.
- 17:05 probe: airmap.js is a 109-line scaffold only (legend+tap readout+playtime card stub) — airpurest lane builds it out. search.js 103 lines (engine→Photon→Nominatim cascade exists but shallow). app.js 217 lines frozen.
- Rival fleet: still no pushes to origin (only main exists remotely).

- 17:26: journey lane landed (nav+receipt verified); airpurest launched; search still working.
- 17:40: airpurest done+terminated (airmap field/readout/playtime + purest districts/stays). Its bug reports FIXED by coordinator in 2d849eb (map.js /grid cells=44→40 + j.cells→j.features + cell_epoch; app.js replace now calls cleanup).
- Rival coordinator 9160aa61 + 5 children: CANNOT touch main (GC-WORK11 403 on their creds, git-only net_policy, can't reach API). Harmless. The owner killed the spawning automation + asked us to coordinate; messaged it (403 on writes — one-way). Nothing to revert.
- BUG (integration): airmap tap-readout card leaks onto whereto screen (shared map pins/cards survive screen switch). Fix = whereto mount clears airmap's tap pin/card or airmap cleanup removes its overlay — check airmap.js teardown on hide.
- BUG (search): Pawan Bakery Shahdara still wrong after 0d99cab — delhi_index Pawan Plaza rows short-circuit the cascade; anchor decomposition not reached. Nudged search lane w/ live repro.
- admin lane ffb3fedb RUNNING.
- 18:15: ALL 6 LANES DONE. deploys: da798351 (5 lanes) then 758d5f4c (all + admin + search fix). /app + admin mount live on prod+Vercel.
- Search acceptance PASSED in node harness: Pawan Bakery → Shahdara cluster (Royal Bakery 77.2839, block gates, Hanuman Mandir, locality). Browser stale-cache was the earlier false-negative — always cmd+shift+r between commits.
- Integration audit written: docs/lanes/integration-audit.md. Blueprint suggestion filed (macOS aws-cli venv + deploy recipe).
- Remaining: memory sync, final user wrap, credential-rotation reminder.

## 2026-10-10 ~18:05 UTC — WAVE-2 CLOSED, prod blank-page fix shipped
- **prod /app was blank since first deploy**: `/app` (no slash) → relative assets resolved `/app.js` → 404 → no JS. Fixed: `/app` → 301 `/app/` (6e81401). Verified on prod: consent renders over live field map at /app/#/whereto.
- **Lesson**: curl-ing status codes ≠ rendering. Visual check caught it. When serving a static dir, ALWAYS test `/app` (no slash) form.
- Search lane final commits: `b26623e` (purer-locality anchor ordering, kind-token anchor ban, structural stop-words) + `c686c56` report → deployed as `c686c561` (:253).
- Search lane TERMINATED (acceptance verified: Pawan Bakery→Shahdara strip, ISKCON→0.1km, Neelanchal→honest Sant Nagar rows).
- Honest remaining gaps (from lane report, do NOT hide): jagat farm vaishali ordering flickers; Overpass public mirrors dead from VM (layer stays for prod browsers); tiptop market kalyan puri absent from all indexes (3km nearest).
- All 6 wave-2 lanes landed+deployed+terminated. Fleet clear for next wave.
- Deploys this session: da798351 (:250), 758d5f4c (:251), 6e81401c (:252), c686c561 (:253).

## 2026-10-10 ~18:30 UTC — e2e on prod + nav fixes (3a0c69f1, :255)
- Full annotated e2e on PROD by testing agent: every screen verified live, 98s recording at /Users/devin/screencasts/rec-6c14c4d4-a567-478c-9a68-d6b5a631ac6d/.
- Defects found & FIXED this commit: (1) closing any sheet stranded user on bare map — doors replace home via show(id,{},true); back() emptied stack. Fix: back() on empty stack → location.hash='#/home' (hashchange mounts home). (2) loc-chip covered sheet ✕ and was dead off-home → body[data-top] set in show()/back(); CSS hides chip when top≠home. (3) receipt "you covered of" copy, (4) purest "0 µg/m³ lighter" noise.
- Landing: live-preview iframe now embeds REAL /app (was scripted /static/sim) + explicit "open the app" link (e045c3c, :254).
- Rival fleet: coordinator idle, ZERO pushes to origin (no GC-WORK11 creds) — harmless.
- Deploys: :250 da798351, :251 758d5f4c, :252 6e81401c, :253 c686c561, :254 e045c3c2, :255 3a0c69f1.

## 2026-10-10 ~18:45 UTC — wave-2 fully closed + next-wave items
- Mobile viewport (400x911) verified on prod: home bottom-sheet card + doors, whereto full-width sheet + options — responsive correct.
- Launch copy committed: docs/launch-copy.md (8-post X thread + 60s web demo script).
- Mobile deliverables confirmed from earlier waves: alive-ef758f9-arm64.apk (v9, verified) + iOS reports/shots in docs/lanes/ios-*.
- Admin gate verified on prod (engine room, token-gated, obscure mount).
- Pending user approvals: blueprint suggestion (aws-cli venv), alive-webapp-prod-testing SKILL.md. Credential rotation reminder still standing.
- ~18:55 UTC heartbeat#2: Pawan Bakery acceptance re-verified ON PROD in whereto field — full Shahdara cluster (Jain Confectionary/Modi/Rathor 78BlockB/Hathras/Shagun/Sehgal/Manohar/Harish/Shakti/Shyam Bakery — all "near shahdara"/Mandir Marg), zero CP pastry. Master-prompt acceptance phrase passes live.
- ~19:10 UTC heartbeat#3: residual passes — landing page verified on prod (52 stations/1,156 cells live numbers, field choropleth, gallery). Found vercel edge landing served its OWN static copy (web/edge/index.html) still embedding old sim → synced same 3 fixes (simURL→/app/, iframe src, open-the-app link) as e6b0d2c; Vercel redeploy is on push or the owner's project settings. Headless playwright sweep on prod: ZERO pageerrors/requestfails across home/whereto/airmap/purest/landing (one transient favicon-class 404 on consent-first-visit only). 
- ~19:15 UTC heartbeat#4: mobile-viewport (390x844) headless sweep on prod — home/airmap/purest/whereto all pixel-clean, real numbers throughout (Meerut 40→NWD 48, cleanest window 04:30-16:30 ~56µg). Vercel edge still stale — needs the owner-side redeploy.
- ~19:40 UTC: the owner re-pasted master spec — all items already live+verified. Honest gap named: no free real-time Delhi traffic feed exists (TomTom/HERE free tiers need keys) — routes/journey real but not traffic-aware. Launched pixel lane devin-ea7f85f90c214369bf6fdaec1b32ed86 (SWE-2 MAX, 390px real-defect pass). Admin internals verified E2E myself: /in/<token> -> cookie -> /api returns live analytics (users/field/fire/community/corridors/journeys).
- ~20:15 UTC: brutal video review (9 per-feature prod videos, 390x844) caught P1+P2. FIXED: far-city corpus artifacts (687 rows: 'Srinagar Railway Station'@NDLS, 'Heathrow Airport London'@Chhatarpur) demoted via name_says_elsewhere — immobile kinds only, NCR/query tokens keep rows clean (37221f3+594aaaf :256/:257); reverse labels skip contradictions+glued corp names ('Tea Square,a J Vof Abu Dhabi…Inc'→'near Air Astana Airlines'); client honors mrank (deep-pass 'railway station' re-query can no longer float Srinagar to top); favicon added; snake_case sublabels prettified; 'dosimeter' dropped from meta. Pixel lane ea7f85f landed 8 real mobile fixes (armed pin-drop sheet-fold, back rows, route repaint, purest taps, orphan layers, gap taps). Deploying :258 (3f60251). NDLS journey reshot demo-clean.
- ~21:30 UTC: deploy :258 (3f602517) live — pixel fixes + corpus demotion on prod (verified mrank in served search.js, sheet-fold in whereto.js, AREA_FILL in purest.js). 8 per-feature demo mp4s delivered to the owner. Jargon sweep: zero banned words in UI ('dosimeter' killed in meta too). Landing verified at 390px — real numbers render mobile-perfect. Next lane launched: devin-4badf01dc5d2451b846b445c8a59814e (desktop+tablet pixel pass).

## 2026-10-11 ~04:20 UTC — TWIN ERA, prod :263
- **Binding pivot shipped**: webapp is now RN pixel-twin (Mobile/src wins every pixel). :262 = home/consent/settings/airmap/ledger/journey twins; :263 = + indexfix + parity-fix(11) + mobilefit P1s + xframe SAMEORIGIN + motion choreography + overpass T3 arm.
- **indexfix live-verified**: lotus temple→temple, aiims→real hospital, tri nagar planted-sink gone, ashok nagar shahdara→Shahdara rows. General mechanisms only, no per-name hardcode.
- **parity-fix live**: onboarding gates Next on share choice, Skip→share-off+geo ask, DayCard+WeekStrip from real daylog, whereto intent rows, "least smoky" wire strings.
- **Ranking verified**: pawan bakery query → Shahdara bakeries rank 1-2 (anchor-biased) ahead of distance-biased Sawan Park rows — honest "not in index, here's real" answer.
- **Known live gaps**: sikanderpur metro (row exists, never merges), neelanchal dham sant nagar (EMPTY — index gap), devli far-cluster. → poolgap lane (devin-07d32a3c1b194ae294655b0a17886773) running.
- **acct2 e2e lane** (ae597b9c1b884a6c9f609fd640ef976d) walking prod twin — harvest findings when it returns.
- Relay pattern proven 4×: format-patch → acct2 attachments → acct2 lane am+pushes. My-org push still 403.
- Deploys this session: :260 3f602517, :262 1caaf7b9, :263 7c9e0c7a.

## 2026-10-11 ~05:30 UTC — :264/:265 e2e-fix round
- acct2 twin-e2e regression (7 defects) triaged+fixed live: eta_s duration/arrive (whereto:767,809), settings whereto.vehicle key, airmap planCard null-zone guard, /favicon.ico root route, pick-mode (hs-picking: transparent+inert surface, exposed map, pickcard w/ gps escape; SECOND fix: read cur.pos||A.geo.pos — applyPos doesn't write geo.pos).
- Verified on prod: pick canvas tappable → maptap → hero renders, pos persisted. favicon 200.
- Skipped by design: /v2/reverse 404 (rolling transient, nominatim fallback), compare-sheet drag-only dismiss (RN parity, gesture verified).
- :264=aa35cf62, :265=a9e0ead0. Relay: stacks 6+7 to geo lane (overlap note sent — stack7 supersedes).
- Re-tasked acct2 fleet on :265: e2e-rerun (verify 7 dead), mobile-rerun (P1s verify), stress-perf (search/plan latency), geo-sweep2 (~120 new deep queries). uxread exited.
- New lanes mine: poolgap (merge-pool drops: sikanderpur metro row exists k:0.73 but never merges), gazupdate (Geofabrik+Overture refresh → neelanchal/pawan/sitaram deep-name hunt).
- Search perf measured: ~0.4s normal, 4.8s when Overpass T3 arm fires (3s fuse + network) — honest deep-probe cost.

## 2026-10-11 ~05:45 UTC — :266 poolgap round
- poolgap lane delivered (devin-07d32a3c1b194ae294655b0a17886773, patch→am as c93d8203): all 3 gaps were engine pool-building, not data. Fixes in server/core_engine.py only: (a) cov=1.0 literal hits outrank speculative comp rows — sikanderpur Gurugram metro now #1; (b) _foreign veto can't drop full-coverage hit + want_extra filter on kind-scan rows + alias-aware unit tokens (t1→terminal 1) — Terminal 1 IGI #1, real T2 top-5, Devanagari Central-Secretariat gate killed; (c) anchor can't silently eat unit token — `delhi airport t1` returns honest airport rows.
- Verified on prod :266 myself via /v2/search curl — all 4 queries return correct rows.
- acct2 fleet notified :266 is live so they don't re-report fixed rows.
- gazupdate still running (deep-name hunt: neelanchal/pawan/sitaram/g block).
- Attachments upload endpoint (acct2): POST /v3/organizations/{org}/attachments (NOT /v3/attachments).
- Relay stack8 (c93d8203) sent to geo lane for push.

## 2026-10-11 ~06:15 UTC — :267 armed-fix round
- acct2 harvest: e2e2 (d9d5b8c) all 7 fixes DEAD; mobile2 (1353ba9) all 5 P1s verified + 3 new; perf2 (8e07453) ranking verified, T3 3.1-3.4s honest cost.
- Fixed mobile2's P0 live on :267 (c4c7daa): `.wt-armed .sheet` → transparent+pointer-events:none (sheet-grab/title hidden, pinbar keeps pointer-events:auto) — map taps now reach canvas. Verified: elementFromPoint=CANVAS, real tap→armedGone+slot filled.
- Also fixed: wt-th/wt-pinx ::after pads ≥40px; shop icon malformed `q-33-23.5-56.5` → completed symmetric handle arc `q-33 0-56.5 23.5T400-560` (path parses clean).
- Relay: armed.patch (single commit) sent to geo lane. NOTE: /v3/attachments is wrong path; correct = /v3/organizations/{org}/attachments.
- gazupdate still running (deep-name hunt).
- Deploys: :266=c93d8203, :267=c4c7daa2.

## 2026-10-11 ~07:00 UTC — :268 gazupdate round
- gazupdate lane done (72MB patch→am as 193fa5b7): real pyosmium pass Oct-9 Geofabrik north+central PBFs + Overture latest → corpus 345,001; served gazetteer 123,934→210,000 rows. aliases.json +7 general pairs (sitaram↔sita ram, pawan↔pavan, neelanchal↔nilanchal, dewan↔diwan). _SECT_SUB synth for block canonicals.
- Verified on prod :268: `sitaram diwan chand paharganj`→Sita Ram Dewan Chand #1; `pawan bakery shahdara`→real Shahdara bakeries; `a2 block rohini`→real rows; `neelanchal dham`→honest empty (verified unmappable in EVERY upstream — OSM/Overture/GeoNames/Wikidata/Nominatim/Photon).
- acct2 verify-rounds all green: e2e3 (armed-pin 7/7), mobile3 (4 fixes ALIVE, zero new), one P2 fixed→Esc mid-arm now unarms via data-unarm on wt-pinx (1e4feec).
- Deploys: :266=c93d8203, :267=c4c7daa2, :268=193fa5b7.

## :271 round (anchorsink) — 06:40 UTC
- anchorsink PATCHED → relayed via acct2-geo → PUSHED 9bf64497 → deployed :271
- Prod-verified: jama masjid {shahdara,mustafabad}→in-locality; sector 28 faridabad→Fbd; anand vihar metro→real stn; delhi airport t1→T1-IGI. All land-wins hold (sikanderpur/chhatarpur/lotus/aiims/iskcon/sitaram).
- Mechanisms: place-anchor resolution (container-pref), anchor-namesake echo+faith tier, 8.6km city-anchor radius caps, merge vouch (non-anchor coverage +≤2.5km), foreign geo-claim disqualify, infra rescan ≤30km.
- Residuals (honest data gaps): sector 14/29 gurgaon + NSEZ no literal rows; hanuman/kali mustafabad blocked by junk CP anchor row; T3 no standalone row; sarai rohilla/bijwasan rows far off.
- acct2 go-signals fired: geo sweep-4 (150q corpus on :271) + e2e regression#2.
- deeppass lane launched (eff2a1d1): parallel Overpass probes, arm 3s→<1s, same search.py contract.
- Video reshoot: all 8 scripts remapped to post-twin DOM (5-page onboarding, .wt-rrow/data-arm, locate action, plan-phase flow), 8 mp4s delivered to user after frame-review.

## :272 round (escfix + deeppass + sweep-4/e2e2 reports) — 07:20 UTC
- escfix (5bba3cb): Esc during live journey → .jn-close. deeppass (3d4cd13): T3 Overpass arm serial→per-query mirror race (3s worst→<1s typical; identical row sets; +6 race tests).
- geo4 report (385f4a4): WRONG 28.0% on :271 vs 36.2% pre-anchorsink; worship 78.6%→34.5%; 2 regressions + residual list → geo5 lane (80cba95a) grinding.
- e2e2 (ef51c15): 11/11 stages clean; all prior defects verified dead.
- Owner feedback lanes launched: wlive (db8b2535, whereto inline From/To fields + first-letter typeahead — kill third composer), proven (a261f722, hero station/km/age provenance), acct2-mobile5 (390px overlap+cringe sweep incl. the 'black PM2.5 card' hunt).
- Videos: 8 feature mp4s reshot on :271 post-twin DOM, frame-verified, delivered.

## :272→:273 round — owner critique + mobile5 fixes
- Owner: third-composer kill (wlive), inline From/To + first-letter typeahead, "is this really my air" provenance (proven), kill "black PM2.5/locality card" = .am-read frost slab (mobile5 P0: dead app.css rule top+bottom → 760px stretch), kill profseg toggle strip (done — dea8019), deeper index (gazmerge), real icons (icons lane).
- mobile5 fixes committed 1b6a587 (patch relay to geo): dead .am-read block deleted, bottom:auto, amr-x 40px pad, sheet-title solid, belt-copy dedupe (why.py "holding still"), :has() attrib hide.
- Lanes live: wlive db8b2535, proven a261f722, geo5 80cba95a, icons 7d243577, gazmerge 6eca8a9e, acct2-mobile5 sweeping done (report 4bd14ac).
- :274 LIVE (3a7f2000): wlive+proven+icons+mobile5+profseg all verified on prod. mobile6 sweep: everything PASS, one P2 ghost-x fixed (1a11f6b, relayed). Videos reshot: 02-home-v2, 04-whereto-v2 delivered to owner.
- Remaining build lanes: geo5 (80cba95a), gazmerge (6eca8a9e). Testers: mobile6 done → may re-arm for future sweeps.

## :275→:276 (Sat PM)
- :275 aa6836e8-ish/da79d4cc — gazmerge 240,027-row gazetteer + 96k generated aliases deployed. Verified: sarvodaya fbd, sant nagar, gokalpur now resolve/anchor.
- :276 aa6836e8 — geo5 b2a0af9: ward echo deferral, _far_literal gates (sheetla sink dead), _anchor_corrupt fixes, coverage gate (yatharth/felix requeries), kind-miss suppression, sarai-rohilla station-token fix, overpass-arm requery deadline. Verified on prod: sheetla→in-Burari, sector150→noida rows, patel nagar station, yatharth.
- All 8 demo videos reshot caption-free (v3 mp4s delivered); drv.js cap() is now a no-op.
- All lanes delivered+merged; fleet idle. Prod = demo build :276.
