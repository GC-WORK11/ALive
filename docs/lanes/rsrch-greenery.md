# rsrch-greenery — "which route has the most greenery", honest and free

Research-only lane. No code changed. Question: can Health Maxer (and the new
Running Mode) prefer greener, plant-covered routes on **real** data, free,
Delhi-focused, combinable into the scoring engine? **Yes — and the best source
is already on disk.** The same Geofabrik PBF that `tools/build_route_graph.py`
parses for streets carries every mapped park, forest, garden, wood, scrub,
meadow, orchard and tree-row polygon in NCR. We counted them live (below).

## TL;DR

- **Primary: OSM green landcover, extracted from the route graph's own PBF at
  build time.** ~14.8k green features in the graph bbox (live count, this
  lane): 6,825 `leisure=park/garden/nature_reserve/common`, 1,676 green
  `landuse=*`, 1,721 `natural=wood/scrub/grassland/…`, 236 `natural=tree_row`
  ways, 4,077 `natural=tree` points. Delhi's named green landmarks are all in
  the corpus (Lodi Gardens, Deer Park, Sanjay Van, Aravalli Biodiversity Park,
  Jahanpanah City Forest, Coronation Park, Garden of Five Senses, district
  parks…). Free, ODbL, exact polygons — scores a route corridor to ~25 m.
- **Corroboration (optional, cheap): ESA WorldCover 10 m via Overture
  `base/land_cover`** — free GeoParquet on public S3, no auth, and the repo
  already reads Overture parquet in place (`scripts/fetch_overture.py`,
  duckdb). Catches what OSM mappers never drew: avenue trees, scrub, vacant
  green. Sentinel-2 NDVI is the upgrade path if we ever need freshness
  (5-day revisit, free within CDSE quota); MODIS/Bhuvan NDVI at 250 m–1 km is
  too coarse for route corridors.
- **Score per route = green_cover_fraction**: fraction of polyline samples
  within ~40–50 m of mapped vegetation. Plugs into `modes_engine` as a new
  axis mirroring the existing `DOSE_SLACK` pattern — "greenest within 15% of
  the cleanest dose" — never a fabricated dose benefit.
- **Never live-query Overpass per request.** Verified today: the public
  instances were busy enough to stall even `out count` calls (one took ~40 s;
  a second instance ~80 s). The fair-use guidance (~100 queries / 10 MB per
  day for regular app use, all app users counting together) rules per-plan
  queries out anyway. Bake the layer at graph build; refresh on PBF cadence.
- **No shapely in the server venv** (`requirements.txt`: fastapi, httpx,
  numpy, h3, boto3, pytest). The design below uses a numpy grid raster — no
  new runtime dependency; shapely only ever in `tools/corpus-venv` if the
  builder wants exact polygon ops offline.

---

## 1. Where this lands in the codebase

| Piece | File | What it does today | Hook for greenery |
|---|---|---|---|
| Trip modes | `server/v2/modes_engine.py` | `health_max` / `petrol_health` / `time_health` pick rows in `apply()`; every row gets `mode_pick` + `why`; `DOSE_SLACK = 1.15` defines the "still clean" window | Add `green` per option; a `green_max`/running pick = max green inside the dose window — same guard shape as `petrol_health`/`time_health` (`_mode_cands_key`, `_pick_for`) |
| Option builder | `server/v2/plan.py` `_option()` (~l.768) | Each option carries `geometry` (GeoJSON LineString), `dose`, `emissions`, `why` | Stamp `green: {pct, cover_fraction, basis, source_date}` alongside `dose` |
| Dose engine | `server/exposure.py` `dose()` (l.280) | Samples PM field along the polyline at ≤250 m → `dose.mid` | Same sampling lattice can read the green raster — identical signature shape (`field_value`-style callable) |
| Route graph | `tools/build_route_graph.py` → `server/data/route_graph.bin.gz` (ARG2) | 1,070,459 edges / 819,846 nodes from `northern-zone-latest.osm.pbf` + `central-zone-latest.osm.pbf` (Geofabrik), bbox 76.68–78.02 E × 28.08–29.07 N | Build pass 2: pull green-tag ways/relations from the SAME PBFs (pyosmium already imported), emit sidecar `route_graph.green.bin` = `u8 green_frac` per edge in edge order — no ARG3 format bump needed; loaders optional-read like ARG1 |
| Python engine | `server/routegraph.py` (`PyPathEngine.query/alternatives/reach`) | A* over edge dose; `alternatives()` returns `edge_ids` lists | Per-edge green lets the engine rank by green directly (report axis), while corridor scoring of the final polyline stays engine-agnostic |
| OSRM routes | `server/routing_local.py`, `v2/deps.osrm_route`, `modes_engine.osrm_alternatives` | Walk/cycle/drive geometries from local osrm-routed or public demo | Non-graph routes score from the same green raster at runtime — O(1) per sample |
| Overpass client | `server/v2/search.py` l.897–937 | Live deep-geocode arm already talks to 3 endpoints with a descriptive UA (required — `overpass-api.de` 406s curl's default), 45 s cache, 3 s fuse | Reuse endpoint list + UA + mirror-failover pattern for the *weekly bulk* pull, never per-request |
| Park naming | `server/v2/city.py` l.635–707 (`/v2/purest`) | Park taxonomy already maintained: `_PARK_KINDS`, `_PARK_WORD`, `_PARK_JUNK` (banquets/hotels/malls filtered out) | Reuse the junk-name filter — raw OSM "park" rows include banquet lawns and waterparks |
| Gazetteer | `server/data/delhi-gazetteer.json` | 240k rows, mixed OSM+Overture; **4,028 green-category rows** (3,864 park, 65 garden, 54 forest, 29 national_park, 16 nature_reserve) | Point-level greenspace for naming/QA of the polygon layer |

Nothing green exists today: greps for `park|forest|ndvi|green|greenery` across
`server/` hit only place-naming, CSS colours and POI search — no scoring use.

## 2. Source comparison

Legend: **Real** = measured/mapped data, not modelled; **Free** = $0 at our
scale incl. licence; **Delhi** = actual coverage verified; **Route-usable** =
can answer "how much of THIS polyline is beside vegetation".

| Source | Real? | Free? | Delhi coverage | Route-usable? | Access path | Verdict |
|---|---|---|---|---|---|---|
| **a. OSM green polygons** (leisure=park/garden/nature_reserve/common, landuse=forest/grass/meadow/orchard/recreation_ground/village_green/allotments, natural=wood/scrub/grassland, + tree_row/tree nodes) | ✅ mapped features, ODbL | ✅ | ✅ ~14.8k features in graph bbox (live count below); NCT alone: 5,737 leisure areas + 10,219 landuse/natural polygons (geo2day layer counts, Oct 2026) | ✅ 25 m corridor accuracy; polygons + tree lines | Offline: same PBFs we already parse (pyosmium/osmium tags-filter). Live: Overpass for bulk pulls only | **PRIMARY** |
| **OSM via Overpass API, per-request** | ✅ | ✅ within quota | same | ⚠️ latency 1–40 s+; public instances visibly loaded today | `out geom` per corridor | ❌ request path — bulk/weekly only |
| **ohsome API v2 (HeiGIT)** | ✅ OSM-derived | ✅ free key | same as OSM | ✅ `geometry:polygon` filters, GeoJSON extraction | `api.heigit.org/ohsome-api/v2-rc`, API key, 15 req/min + daily quota | ⚠️ viable bulk alternative to Overpass; adds a key |
| **b. Sentinel-2 NDVI, Copernicus Data Space (Sentinel Hub Processing/Statistical API)** | ✅ measured reflectance | ✅ free tier: **10,000 req/mo, 10k PU/mo, 300/min** (CDSE Quotas doc) | ✅ global 10 m, 5-day revisit; Delhi = UTM 43N tiles | ✅ evalscript returns NDVI for arbitrary bbox/res; ~6 tiled calls cover NCR at 10–20 m | CDSE account → Process API, or openEO | ✅ corroboration layer; needs free account + OAuth |
| **Sentinel-2 L2A via AWS open data / Earth Search STAC** (`s3://sentinel-cogs`, Element84 mirror — **no auth**) | ✅ | ✅ no key at all | ✅ global since Dec 2018 | ✅ read B04/B08 windows of MGRS 43R* tiles, NDVI = (B08−B04)/(B08+B04) locally | HTTP range reads on COGs | ✅ zero-key NDVI path; more DIY (COG window decode) |
| **MODIS MOD13Q1 NDVI via NASA AppEEARS** | ✅ | ✅ Earthdata login (free) | ✅ global | ⚠️ **250 m / 16-day** — a pixel covers a whole colony block; fine for seasonal backdrop, can't split two nearby routes | `appeears.earthdatacloud.nasa.gov` | ❌ too coarse for corridor scoring |
| **ISRO Bhuvan NDVI** (OCM-2) | ✅ | ✅ | ✅ India fortnightly | ❌ **1 km** — coarsest option | Bhuvan download portal / API reg. | ❌ |
| **ESA WorldCover 10 m** (2020/2021 epochs) — direct COGs `s3://esa-worldcover` or **vectorized in Overture `base/land_cover`** | ✅ satellite-classified | ✅ CC-BY / ODbL; parquet reads no auth | ✅ global | ✅ class polygons (tree cover, shrubland, grass, cropland…) — counts avenue canopy OSM lacks | duckdb bbox read on `s3://overturemaps-us-west-2/…/theme=base/type=land_cover/` — same pattern as `fetch_overture.py` | **CORROBORATION** — 2021 vintage, classes ≠ "park", crops read green |
| **c. Delhi govt / FSI** — MCD tree census (first-ever, ongoing; 27% of 250 wards by Jan 2024, ToI), GNCTD forest dept green-cover pages, FSI ISFR 2023 Delhi chapter | ✅ | ✅ | ⚠️ **district-level tables only** (9 districts; Delhi green cover ~342 km² ≈ 23%); tree census incomplete + no public geodata | ❌ nothing per-street | PDFs/web portals | ❌ cite as context numbers, never as routing input |
| **d. Literature methods (adopt, not data)** | — | — | — | — | — | — |
| Novack, Wang, Zipf 2018 (Sensors 18:3794) | OSM-only greenness factor per edge → weighted routing cost; 1,000 OD pairs, routes "slightly longer, significantly greener" | — | — | method | doi:10.3390/s18113794 | ✅ adopt: per-edge factor + user weight |
| openrouteservice green routing (HeiGIT/meinGrün) | green index per street segment × length in cost fn | — | — | method | giscience.github.io/openrouteservice-workshop/usecases/green_routing.html | ✅ adopt: segment-level index, detour-bounded |
| redfrexx/green_index (GIScience 2021) | greenness raster from OSM + Sentinel-2 → per-highway green index csv → forked ORS | — | — | method + code | github.com/redfrexx/green_index | ✅ our exact recipe — validates the OSM+NDVI combo |
| HEAL shade routing (HeiGIT) | solar-exposure cost on ORS | — | — | method | github.com/GIScience/heal-routing-analysis | 🆕 future: shade ≠ green; park-adjacent shade proxy only |

## 3. OSM Delhi coverage — what I verified live

Query run 2026-10-12 against Overpass public instances, bbox =
route-graph bbox `(28.08, 76.68, 29.07, 78.02)` (S,W,N,E):

| Tag set | Ways | Relations | Nodes |
|---|---|---|---|
| leisure = park\|garden\|nature_reserve\|common | 6,802 | 23 | — |
| landuse = forest\|grass\|meadow\|orchard\|recreation_ground\|village_green\|allotments\|cemetery\|plant_nursery | 1,676 | — | — |
| natural = wood\|scrub\|grassland\|heath\|wetland | 1,721 | — | — |
| natural = tree_row | 236 | — | — |
| natural = tree | — | — | 4,077 |
| **Total (incl. misc green rels)** | | | **~14,826** |

The gazetteer cross-check (240k-row `delhi-gazetteer.json`, OSM+Overture
merge) shows every landmark green space: Lodi Gardens ×7 rows, Deer Park,
Buddha Jayanti Park, Sanjay Van (national_park), Jahanpanah City Forest,
Aravalli Biodiversity Park (incl. Gurugram twin), Nehru Park, Coronation
Park, Garden of Five Senses, Indraprastha/Millennium Park, Raj Ghat, and
district parks across Dwarka/Pitampura/Rohini/Sarita Vihar/Tughlakabad.

**Honest read of coverage**: big polygons — parks, the Ridge, city forests,
gardens — are reliably mapped in Delhi (OSM Delhi is dense: 4M ways fed the
graph build). What is NOT mapped: street trees. 4,077 `natural=tree` nodes +
236 `tree_row`s for a ~30M-tree city means avenue canopy — the very thing
that makes Lutyens'-zone avenues and colony streets green — is absent from
OSM geometry. An OSM-only score is exact where mapped and silently low on
tree-lined-but-unmapped streets. That is the gap WorldCover/NDVI fills.

Known smaller gaps by spot-check: "Sunder Nursery" isn't in the gazetteer
under that name (mapped as heritage/park pieces instead); expect similar
naming fuzz for smaller udyaans — the polygon coverage is still real even
when the name isn't.

## 4. Recommended design

Two artefacts, both produced in the **graph build** (offline,
`tools/corpus-venv` — keeps `server/` deps untouched):

1. **Green raster** `server/data/green_mask.bin` — boolean grid over the
   field/graph bbox, ~25 m cells (bbox ≈ 107 × 83 km → ~4,300 × 3,300 ≈
   14M cells ≈ **1.8 MB bitset**; 40 m cells ≈ 0.7 MB):
   - fill cells whose centre falls inside any green polygon (scanline
     even-odd rasterization is ~40 lines of numpy; pyosmium
     `area`/osmium-tool `export` assembles multipolygons to GeoJSON);
   - tree_row ways → rasterize their line with ~15 m width; tree nodes →
     single-cell dots (tiny weight, honest);
   - dilate by ~40–50 m (two rounds of 8-neighbour numpy OR, or
     `h3.grid_disk` — both in existing deps) → "green-adjacent" mask:
     roadside greenery counts, not just park interiors.
2. **Per-edge sidecar** `route_graph.green.bin.gz` — `u8` per edge in the
   ARG2 edge order = `round(255 × fraction of the edge polyline inside the
   dilated mask)`. Same builder, same PBF → green layer and street layer are
   always the same vintage. Loaders (C++ `path.cpp`, `routegraph.py`) read it
   if present; absent → green axis off, cleanly. Follows the ARG1-degradation
   precedent.

Runtime scoring is then pure array lookup — works on ANY polyline (graph
path, local-OSRM, demo-OSRM, Amazon rows), no shapely, no geometry library:

```python
# numpy-only corridor score on a loaded green raster
def green_fraction(geometry, grid):          # grid: {mask bitset, cell_deg}
    pts = resample(geometry["coordinates"], step_m=25)   # haversine chain
    ix = ((pts[:,0] - grid.lon0) / grid.cell_lon).astype(int)
    iy = ((grid.lat1 - pts[:,1]) / grid.cell_lat).astype(int)
    ok = (0 <= ix) & (ix < grid.W) & (0 <= iy) & (iy < grid.H)
    inb = grid.mask[iy[ok], ix[ok]]          # vectorized bitset read
    return {"cover": float(inb.sum()) / max(len(inb), 1),
            "coverage": float(ok.sum()) / max(len(pts), 1)}  # honesty
```

Score definition (the number that must stay honest):

```
green_cover_fraction(route) = #samples within ~45m of mapped green / #samples
option.green = {
    "pct":        round(100 * cover),              # "greenery 62%"
    "basis":      "OSM green polygons + tree rows, 45 m corridor",
    "source_date": pbf_date,
    "coverage":   fraction of route inside the green grid,
    "satellite":  ndvi_mean or worldcover_pct — ONLY when that layer shipped
}
```

Plug into `modes_engine` mirroring the existing guard pattern — **green is
its own axis, never a dose discount** (greenery ≠ measured PM2.5; the field
already prices the air. Claiming "greener = cleaner air" would double-count
and can't be verified):

- Health Maxer: unchanged primary sort on `dose.mid`; `green.pct` shown on
  every card; on near-ties it can be the honest tie-breaker after
  `_live()`/`fk` inside `_mode_cands_key` — surfaced in `why` ("same smoke,
  greener route").
- New `green_max` (and Running Mode's default pick): max `cover` among rows
  within `DOSE_SLACK` of min dose — literally `_mode_cands_key` with
  `key = (-green_cover, dose, live)`. Why-string: "greenest stretch, air
  still within ~15% of cleanest".
- Running Mode: same axis, walk/cycle/foot-scaled rows only
  (`routegraph.MODE_RULES` already gates footway/path/cycleway access); a
  "runs inside parks" bonus comes free — paths *inside* green polygons get
  cover≈1.0 without a special case. Filter `access=private/no` green polygons
  at build so gated lawns don't inflate a runner's score.
- Per-segment green for the map ramp: `segments.py` already splits routes
  into ~90 s spans — average the mask per span the same way `segment_doses`
  averages the field.

## 5. Caching & rate-limit strategy

- **Zero network at request time.** Green layer is a file; scoring is memory
  reads. This is the design constraint that makes the feature free at any
  scale.
- **Refresh cadence = PBF cadence.** `route_graph.bin.gz` already rebuilds
  from fresh Geofabrik extracts (`scripts/geo/fetch_extract.sh`); the green
  artefacts ride the same run. Green space changes monthly-ish; weekly is
  ample, and `source_date` keeps the claim timestamped.
- **Overpass is a bootstrap/fallback path only.** If used at all, ONE bulk
  bbox query (`out geom` or per-layer `out`) on a timer, cached to disk:
  ~10–15k elements ≈ a few MB — inside the "regular use ≤ ~100 queries /
  10 MB per day" guidance; our two live probes today returned in ~40–80 s on
  loaded instances, which alone disqualifies per-request use. Reuse
  `search.py`'s endpoint list, UA, and mirror failover; honour 429 → wait
  30 s (Overpass docs).
- **NDVI/WorldCover refresh**: WorldCover is a fixed epoch (2021 — pin it,
  say the year); Sentinel-2 via CDSE = ~6 Process-API tiles at 10–20 m per
  refresh — 6 of 10,000 free monthly requests even if done daily; monthly is
  honest (NDVI seasonality in Delhi is real — winter crops vs monsoon flush —
  so label the composite month). Earth Search COGs path: no account, pull
  B04/B08 windows for the MGRS tiles covering 43N once, cache the derived
  NDVI raster.

## 6. Honesty caveats (must ship in `basis` strings)

- **"Mapped greenery", not all greenery.** OSM polygons are volunteer-mapped;
  coverage is excellent for named parks/forests and systematically misses
  avenue trees. Label: "of this route runs beside a mapped park, garden or
  forest" — if satellite layer added: "plus satellite-measured vegetation".
- **OSM reads low on unmapped-but-green streets**, not falsely high — the
  failure direction flatters no one, which is the honest direction.
- **NDVI/WorldCover measure vegetation, not parks**: NCR-fringe farmland and
  scrub score green (true for shade/air texture, but a runner can't always
  enter it), barren season fields read low, and 2021-era WorldCover won't
  see post-2021 development. Keep it a corroboration axis, never merged into
  one unexplained number.
- **Green ≠ cleaner air.** Trees near traffic can trap pollution in canyons;
  the dose field already reflects measured air. Green is a
  comfort/shade/pleasantness axis inside the dose slack — the same honest
  shape as "least petrol within 15% of cleanest".
- **Access**: a private farmhouse lawn is green to look at, not to run in —
  exclude `access=private|no` polygons from the runner-facing number (keep
  them for the view/shade axis only if we ever split the two).
- **Corridor width is a choice, not a truth**: ~45 m ≈ "the park across the
  road still shades you". Publish the number in `basis`.

## Sources

- Overpass usage limits: wiki.openstreetmap.org/wiki/Overpass_API + dev docs
  (10k req/1 GB one-off; ÷100 for regular apps; 2 slots/IP; descriptive UA).
- CDSE free quotas: documentation.dataspace.copernicus.eu/Quotas.html
  (Sentinel Hub 10k req+PU/mo; direct COG HTTP 50k req/mo).
- Earth Search Sentinel-2 COGs (no auth): registry.opendata.aws/sentinel-2-l2a-cogs.
- MOD13Q1 250 m/16-day: earthdata.nasa.gov MOD13Q1 v061 + AppEEARS.
- Bhuvan NDVI 1 km fortnightly: bhuvan.nrsc.gov.in Terrestrial Products.
- ESA WorldCover: esa-worldcover.org data access; Overture land_cover:
  docs.overturemaps.org/guides/base + blog 2024-05-16.
- FSI ISFR-2023 Delhi (fsi.nic.in); GNCTD Forest Dept green-cover page
  (297.81→342 km², 2013–2021); MCD tree census status: Times of India,
  Jan 2024 (27% of 250 wards; no public geodata).
- Methods: Novack/Wang/Zipf, Sensors 2018 (doi:10.3390/s18113794);
  openrouteservice green routing workshop page; redfrexx/green_index;
  GIScience 2021 fast-vs-green paper (LIPIcs); HeiGIT HEAL.
- Delhi OSM layer counts: geo2day.com NCT page (Oct 10 2026 extract).
- Live numbers above: Overpass `out count` run by this lane 2026-10-12
  (overpass-api.de + overpass.kumi.systems).
