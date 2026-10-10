# webapp wave-2 — integration + truth audit (coordinator)

Deploy: `758d5f4c` on prod — CloudFront + Vercel proxy. `/app` 200 on both.
Admin mount (`/a-AFiVSpmZ1Oc4YhaaQyhRie5yqnlKV_qs/`) 200; `/admin` → 404 (obscurity holds).

## Every rendered number → its source (verified live or in lane reports)

| surface | number | source |
|---|---|---|
| home air card | pm2.5, pm10, no₂, us-aqi, band, likely lo–hi, vs-now %, field age, station km | `/aqi`, `/v2/why`, `/grid` epoch |
| whereto options | dose µg, eta, km, +% breath, co₂, via names, segment strip | `/v2/plan` options + segments |
| journey | eta left, km left, road name, dose estimate, off-route flag | plan option + GPS/projection + reverse |
| receipt | dose graph, heaviest stretch, covered km, WHO 24h eq, city mean eq | journey math + `/v2/city` mean |
| airmap | cell fills, tap pm25/band/station/age, playtime windows + bars | `/grid` + `/aqi` + `/v2/playtime` |
| purest | district ranks, stay `window_mean_ug`, env cards | `/v2/districts` + `/v2/stays` + `/aqi` + `/v2/playtime` |
| admin | live users, journeys/hr, mode share, dose/co₂ avoided, corridors, tile map, uptime | `<mount>/api*` + `/grid` + `/health` |
| deep search | Shahdara/locality/OSM/Overpass hits labeled by source | `/v2/search` + Photon + Overpass |

Nothing hardcoded anywhere: missing fields → honest "—" or "not yet instrumented" tiles.

## Coordinator fixes on frozen files (this wave)
- `map.js loadField` — was dead (`cells=44`→422, read `j.cells` which /grid never serves). Now `cells=40&param=pm2_5`, consumes real GeoJSON `features[]`, `cell_epoch[0]` for field age, `alive:field` dispatched every load.
- `app.js show(replace)` — popped screens without cleanup → watcher/timer/pin leak. Now calls `cur.cleanup()`.
- `airmap.css` — `.am-read` had author `display:block` beating `[hidden]` → card outlived screen. Added `[hidden]{display:none}`.

## Verified end-to-end in real Chrome (localhost → prod API)
consent → whereto: ISKCON EOK (3 delhi_index hits) → Car options (16min/12.8km/~6µg, "lightest for you", real via-names) → journey preview (×8 labeled sim, plan pace, real roads) → receipt (12.6km, ~6µg, 70µg/m³ heaviest at Kartavya Path, WHO context, "plan the way back") → airmap (legend, tap=58µg satisfactory, best-window 13:30–15:30 ~55µg) → Pawan Bakery query → Royal Bakery Shahdara + block gates + Hanuman Mandir + locality (all real tiers).

## Known edges (honest)
- Neelanchal Dham: absent from OSM entirely — honest fallback = Sant Nagar localities + drop-a-pin. Nothing invented.
- Preview ride is simulation — labeled on-screen the whole time; upgrades to real GPS via "follow my gps".
- Admin tile repaint gates on `field.built_epoch` (~15min server TTL), not a page timer.
- Counter resets on deploy (uptime "since boot" line says so).

## Fleet
6 lanes: home ✅(6027c8c..5a22c94) whereto ✅(cbadb07, coordinator inline) journey ✅(e9136f0..3851646) airmap+purest ✅(24ab4fb..5ff3478) admin ✅(a05ca04/fcbe28d) search ✅(0d99cab/758d5f4). Lane reports in docs/lanes/*-report.md.
