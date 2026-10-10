# COORDINATOR STATE — alive webapp wave 2 (updated 2026-10-10 ~16:45 UTC)

Coordinator session: devin-39817b9ec42b4ecc91694474c4451967 ("Launch Six Agents").
Repo: GC-WORK11/ALive `main`. Prod: https://d2eh2l2ys9wkij.cloudfront.net (+ Vercel delhi-is-alive.vercel.app proxy). Webapp live at /app since deploy :9878ca3f.
Lane contract: docs/lanes/webapp-wave2.md. Lane prompt files on coordinator box: /Users/devin/lane-prompts/lane-*.txt.

## Fleet (SWE-2 cap = 7 concurrent; terminate settled lanes to free slots)
| Lane | Session | Status |
|---|---|---|
| home+consent | a54609c0108248caa7ecd07ac724f3ff | DONE, terminated. Shipped 6027c8c/33e4d64/5a22c94 + docs/lanes/home-report.md |
| deep search | d398397c2cb14f74814e6d2efe09ba65 | running |
| journey+receipt | 57f50f8033314de598e579092834b1ce | running (started ~16:46) |
| whereto | — | DONE BY COORDINATOR inline: cbadb07 (whereto.js+whereto.css). Needs browser QA pass. |
| airmap+purest | — | NOT LAUNCHED (slot cap) — prompt file ready |
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
