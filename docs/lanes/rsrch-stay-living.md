# rsrch: "plan the living" — yearly-record stay/locality composer

Research only, no code changed. Audited 2026-10-12 against `server/` @ HEAD
(`5f744ac4`). Every number below is either read out of a committed artifact or
measured live this session — external probes are dated and reproducible.

Feature under research: **one composer — search a hotel or a locality → ranked
"purest" recommendations backed by YEARLY record cards.** Use cases: a visitor
picking a well-aired hotel; someone moving to Delhi picking a locality. Both
need *a year of reality*, not today's reading.

---

## 1. History-depth audit — how far back does our own record go?

**Bottom line: ~1 week. Our own field history cannot answer a yearly question.**

| Store | Where | Cadence | Earliest record | Retention |
|---|---|---|---|---|
| Served-field snapshots | `s3://alive108-air/field/YYYY/MM/DD/HHmm.json.gz` + local mirror `server/data/field/snapshots/` | 15 min (`ingest_worker.py:364`, `INDEX_PERIOD_S=900`) | Local: only 2026-10-11 files on this box. S3 durable; started when `ALIVE_AIR_BUCKET` was provisioned (deploy reports put first snapshots ~Oct 3–5) | Local pruned to newest 96 files (24 h, `ingest_worker.py:49-58`); `snapshot_gc.py` keeps locals ≤7 d once S3-confirmed; S3→GLACIER@90d only if provisioned `--glacier` (`infra/provision.sh:58,108`) |
| Hourly archive (the replayable record) | `s3://alive108-air/archive/field-YYYYMMDDHH.json.gz` + `server/data/archive/` | 1/IST-hour (`archive.py`, `run_forever`) | **2026-10-05 20:00 IST** — confirmed across lane reports (`judge-qa-report`, `demo-day-final`, `forecast-skill-report` all cite since=Oct-5 20:00; local files on this box start Oct-11) | Local mirror `LOCAL_KEEP_DAYS=8` (`archive.py:85`); S3 is the durable shelf |
| Daily rollups | `daily/{date}.json` → `data/field/daily/` (`rollup.py:227`) | nightly 00:30 IST | One local file: `2026-10-03.json` | durable on S3 |
| Weekly LOSO validation | `field/validation/` | weekly | `2026-W40` only | durable on S3 |
| Station-history cache | `data/openaq_recent.csv` (`openaq_archive.py`) | manual pull | ~10-day window (Sep-21→Sep-30, meta: 86/125 stations, 51,593 rows) | refresh-on-demand |
| **Climatology (the real history)** | `data/delhi_climatology.json.gz` (`history_builder.py`, read by `history.py`) | rebuild-on-demand | **2016→2026**, generated 2026-10-01 | committed, 554 KiB gz |

So: the served-field archive is honest but only a week deep. The 15-min
snapshot cadence writes ~180 KB gz ≈ 17 MB/day (measured on `data/field/
snapshots/2026/10/11/`; `ingest_worker.py:121` says the same) ≈ ~6 GB/year —
trivially fine on S3, but **a year of it doesn't exist and won't for
12 months**. The yearly card must be backed by station history, not our field.

### The honest yearly source already in the repo

`history_builder.py` + `history.py` + `delhi_climatology.json.gz`:

- **125 NCR stations** (27 "canonical" CPCB/DPCC/IMD anchors + 98 extras;
  of the extras, **66 are also official-agency stations** that didn't
  token-merge to a canonical name — e.g. `Alipur, Delhi - DPCC`,
  `Chandni Chowk, Delhi - IITM` — and 32 are low-cost/community:
  SAMOSA_*, Air Check, NASA_AQCS, US Embassy/State Dept).
- Per station: **month × hour-of-day IST → [p25, median, p75]** for
  pm25/pm10/no2 (µg/m³ only, `MIN_N=8` samples per bucket, `0≤v<2000` QC),
  plus `first_seen`/`last_seen`/`years[]` provenance. Canonical stations carry
  all 288 buckets; 81–93 stations carry ≥20 hour-buckets in any given month.
- Source: **OpenAQ public S3 archive** (`openaq-data-archive/records/csv.gz`,
  anonymous HTTPS, no key) — verified live this session.
- Reader: `history.typical(lat,lon,month,hour)` — IDW(p=2) over the ≤3 nearest
  stations holding that bucket, **city-curve fallback** — already the
  honest-interpolation pattern this card needs (`history.py:64-92`).
- Already on the wire: `/aqi` `typical{}` block (main.py:1137), `/today` 24-h
  typical curve, `/shift` scaled-typical hours, `/v2/day` + `/v2/outlook`
  climatology band blend (`day.py:390-404`).

**What the artifact does NOT carry:** a year axis. Buckets pool 2016–2026 into
"typical January". `years[]`/`first_seen`/`last_seen` are per-station metadata
only. A per-station *per-year* aggregate (yearly mean, monthly means, monitored
days count) needs a new aggregation pass over the same raw pulls — the raw
cache (`data/_cache/values.jsonl`) is uncommitted intermediate and absent on
this box, so it must be re-pulled (~45–60 min per the module docstring).

### The 2023–24 blackout — verified live, this session

Official CAAQMS stations in the OpenAQ archive **go dark for 2023 and 2024**.
Verified 2026-10-12 via anonymous S3 listing:

- `locationid=235` (Anand Vihar): 2022 → **0 day-files**, 2023 → **0**, 2024 →
  **0**, 2025 → **315 day-files**, Oct-2026 → 7 so far (archive lags ~1–2 d).
- `locationid=5626` (DTU): 2022 → 108 files, 2023–24 → **0**, 2025 → 315.

The only stations spanning 2023–24 are diplomatic/low-cost (`US Diplomatic
Post: New Delhi` runs unbroken 2016→2026 — reference-grade, single site,
Chanakyapuri). This is an *upstream* gap (OpenAQ lost the CPCB feed), not our
ingestion bug — but any "year over year" display must mark 2023–24 honestly.

**The gap is fillable for Delhi proper.** `data.opencity.in` dataset "Delhi
Hourly Air Quality Reports" (CKAN id `0dc7b9fe-…`, verified live):
- 39 DPCC stations × hourly AQI 2017–2023, **and**
- 39 stations × **15-min raw concentrations for 2024–25** — the CSV carries
  `PM2.5 (µg/m³)` + full pollutant/met columns (verified: Anand Vihar file,
  `site_301`, rows every 15 min from 2024-01-01).
That fills the official blackout with the *same DPCC instruments* for
2023(?)–2025. CPCB's CCR portal (`app.cpcbccr.com/ccr`) is reachable (HTTP 200)
but unofficial/community-scraped, ~1 week of 15-min data per query — a poor
bulk source; treat as last resort. `api.data.gov.in` returns 400 without a key
(key pending w/ owner per docs/23).

## 2. What exists today — purest + hotel card

### `GET /v2/purest` (`v2/city.py:840`, core `purest_places()`)

- Candidates = gazetteer **localities + real parks** (`_purest_names` —
  `_AREA_KINDS` locality/neighborhood/suburb/quarter/sector/village/town/city/
  `place:*`/`synthetic:sector`; parks filtered through `_PARK_WORD`/`_PARK_JUNK`
  so banquets/Domino's/embassies never name a place).
- Ranking = **live field `F.value` at the place's own coordinates** —
  `basis:"now"` is literally on each row. A candidate must clear: inside field
  extent, **named live monitor within 6 km** (`nearest_station_km`, model fill
  never counts), finest district row `confidence=="field"` and not
  `partial_field_coverage`. Excluded places are counted
  (`excluded.thin_data`/`partial_area`), never ranked.
- **Nothing yearly anywhere.** "Purest" today = "cleanest right now".

### `GET /v2/stays` (`v2/explore.py:308`)

- Pool = corpus lodging slice (`_lodging_rows` over `GAZ._load()`;
  ~16k lodging-ish corpus rows: `overture:hotel` 6,768 / `hotel` 2,584 /
  `overture:resort` 3,613 / `overture:lodging` 2,024 / hostel/guest_house/etc),
  ≤5 nearest + one per ~900 m bucket to 5 km, capped 40, deduped by
  normalized-name/25 m.
- Score = **mean of the live-anchored CAMS forecast over the next 24 h at each
  stay's coordinates** (`FORECAST.pm25`), falling back to `pm25_now`,
  `scored_on` disclosed per row; `sparse`/`nearest_station_km`/`beyond_edge`
  on every row; unrated rows sort last. Pick = best next-24 h non-sparse row.
- Front-end: `webapp/purest.js` renders both (verified Oct-10 lane report);
  mobile `StaysSheet`/`PlaytimeSheet` ship the same contract.

### Climatology already blended into cards

`/aqi` answers `typical{median,p25,p75,vs_now_pct}` for the *current*
month+hour — the seed of a yearly card exists and follows the honesty
conventions already (None ≠ 0, basis labels, sparsity disclosure).

## 3. The honest yearly card — data contract proposal

Per place (hotel or locality), one card. Everything computable from station
records only; nothing invented.

```
GET /v2/living?lat&lon          (or near=<name> via the _resolve_near seam)
{
  "place": {lat, lon, name, kind, via},
  "basis": "station_record",                      // NEVER "field" — this is
                                                  // measured history, not our
                                                  // served surface
  "window": {"from": "2025-10", "to": "2026-09"}, // trailing 12 full months
  "pm25_ug": {
    "annual_mean": <float>,      // mean of station daily means, honest n
    "months": [{m, mean, p25, p75, days}×12],   // per-month stats + coverage
    "season": {"winter_nov_feb": <mean>, "monsoon_jul_sep": <mean>,
               "worst_month": {"m": 11, "mean": <f>}},
    "monitor_days": <int>,       // distinct days with ≥18 reported hours
    "monitor_hours": <int>
  },
  "aqi_days": {"good_satisfactory": <n>, "moderate_poor": <n>,
               "very_poor_severe": <n>},         // CPCB bands on daily means
  "evidence": {
    "mode": "nearest_monitor" | "idw_3" | "city_fallback",
    "stations": [{"name","lat","lon","km","instrument":"reference|low-cost",
                  "first","last","days_in_window"}…],
    "nearest_monitor_km": <float>,
    "sources": ["openaq-s3-archive","opencity-ckan"],
    "caveats": ["2023-24 CPCB feed blackout — not in window"]
  }
}
```

Design rules (all follow existing repo conventions):

- **Two windows, both honest**: `trailing_12m` (the last complete 12 months —
  fully covered today: OpenAQ 2025-10→2026-09 for ~88 stations) is the default;
  `typical_year` = the committed pooled climatology as the *climate-normal*
  comparison ("a typical November here reads ~280 µg at Anand Vihar").
  Never call the pooled climatology "last year".
- **Aggregation = monitor-based only.** Yearly/monthly means come from station
  day files. A locality's card names the station(s) behind it. `# monitoring
  days` is a *counted* field — a station with 200 days says 200.
- **Interpolation policy, in order** (mirroring `history._interp`'s existing
  pattern):
  1. `nearest_monitor` — the closest station with ≥90% month coverage,
     ≤~3 km: card reads "measured at <name>, N km away".
  2. `idw_3` — IDW(p=2) over the ≤3 nearest stations covering each month
     (exactly `history._interp`): card says "blended from N monitors,
     nearest N km". Season-split months are per-station-month means — only
     months with ≥50% day coverage enter a station's year (partial months
     disclosed, not silently averaged).
  3. `city_fallback` — the pooled city curve when no station covers the
     bucket: card says "city-typical, no monitor near here".
  - A kriged surface over station *yearly means* is possible (`krige.py`
    exists, LOSO-validated weekly) but a yearly variogram fit is a different
    claim than the live residual fit — if used, label
    `basis:"kriged_estimate"` with the fitted sigma. **Default recommendation:
    skip krige for v1** — IDW + named monitors + distances is the honest
    product; krige adds false precision to a decision card.
- **Instrument class is disclosed** (`instrument: reference|low-cost`): the 32
  community sensors (SAMOSA_*, Air Check) fill spatial gaps but are
  humidity-sensitive low-cost devices — cards over them say so.
- **The 2023–24 hole is a printed caveat** when `window` spans it, or the card
  simply shows `typical_year` for trend questions and says why.
- Ranking keeps the existing honesty machinery: a candidate locality/hotel is
  rankable on yearly data only when `mode != city_fallback` OR
  `nearest_monitor_km` is disclosed; excluded-for-thin-data counts carry over
  from `/v2/purest` verbatim. "Purest by year" ranks on `annual_mean`, tie-
  broken by `worst_month` (winter is the decision season: city pooled medians
  run **Nov ~214, Dec ~183, Jan ~128 vs Aug ~30 µg/m³** — measured from the
  committed artifact).

### What the yearly card needs that doesn't exist

| Need | Status |
|---|---|
| Pooled climatology (typical year) | ✅ committed (`delhi_climatology.json.gz`, 2016–2026) |
| Per-station **per-year** aggregates (yearly mean, month means, monitoring-day counts) | ❌ new aggregation pass over the OpenAQ pull (`history_builder` extension — `aggregate()` already iterates `values.jsonl`; add a `year` axis + day counting; needs a ~1 h re-pull since `_cache` isn't committed) |
| 2023–24 official data | ❌ new ingest: opencity CKAN 15-min CSVs (39 DPCC stations, real PM2.5 µg/m³, verified live) — one bulk download, no scraping |
| Refresher job | ❌ monthly-ish `openaq_archive pull` widened to day-file counts per station (the machinery exists; extend to emit `data/station_years.json.gz`) |
| Endpoint | ❌ new `/v2/living` (or `/v2/stays?window=year`) — pure read over the new artifact + `GAZ` + `history._interp`; no new infra |
| Field-archive contribution | ⚠️ from 2027 the served-field archive can *verify* the card ("our recorded year vs the station year"), never backfill it |

## 4. Search side — hotel/locality query coverage

Already works (read, verified): `/v2/search` T1 = `alive_core` C++/ref index over
`GAZ._load()` = bundled gazetteer (**240,027 rows**) + corpus
(**345,001 rows**); `/v2/ac` prefix index; `/v2/p/*` providers (Ola
autocomplete+geocode+nearby, Mappls autosuggest, TomTom traffic) merge live
with honest `configured:false` fallbacks; `kind` plumbing for lodging exists
(`_LODGING_TYPES`, `_KIND_OLA`/`_KIND_MAPPLS` lodging→ola `lodging`/mappls
`hotel`).

**Hotels:** ~16k corpus lodging rows + 9,990 gazetteer `hotel` + provider
`lodging` kind — coverage is good where sources agree; `/v2/stays` already
dedupes the same roof across Overture/OSM/gazetteer ids (the Oct-10 lane saw
3× Le Meridien pre-dedupe). Gaps:
- No hotel-*typed* search surface — "taj palace" resolves via generic name
  match; an unnamed/half-named hotel depends on provider geocode (Mappls hits
  without coordinates are bridged through Ola, dropped if unresolvable —
  honest but lossy).
- Corpus lodging skews Overture; Delhi's long tail (guest houses, OYOs,
  dharamshalas) exists (`guest_house`, `dharamshala` in `_LODGE_MARK`) but
  pins are only as good as Overture/OSM published — the pick pool is bounded
  to ≤5 km anyway, so misses degrade to "nearest known", never invented.

**Localities:** `_AREA_KINDS` pool is large — gazetteer `locality` 7,151 /
`place` 2,700 (+corpus `locality` 4,716, `place` 1,467, `village` 161,
`town` 26) → **~11.2k nameable area rows** feeding both `_loc_rows` query
anchors and `/v2/purest` candidates. The Oct-6 coverage report measured ~100%
of OSM's `addr:place`/`addr:subdistrict` names ingested; residual misses are
OSM data gaps (unnamed blocks, roman-script-only index), stated there.

**Reality check — locality ↔ monitor distance** (measured on committed data):
of 11,191 gazetteer locality-ish rows, only **42% sit within 6 km of a
canonical monitor** and **59% within 6 km of any climatology station**; ~28%
are >10 km from *any* of the 125. So for a large minority of typed localities
the honest card is "IDW blend, nearest monitor ~12 km" or "city-typical" — the
coverage disclosure (`evidence.mode`, `nearest_monitor_km`) is the product
feature, not a footnote. Enabling the 66 official *extra* stations as card
evidence roughly doubles ground truth density vs the 27 canonical names alone.

## 5. Gap list — what's needed vs what exists

**Exists, reusable as-is:** `GAZ`/search/providers (place resolution),
`_resolve_near` anchor seam, `history._interp` + city fallback, `krige.py` if
ever wanted, `districts.area_for_point` (area label on cards), CPCB/US-AQI
band functions, `openaq_archive.py` pull machinery, the thin-data/sparse
disclosure vocabulary (`sparse`, `nearest_station_km`, `beyond_edge`,
`excluded.thin_data`).

**Needs building:**
1. `history_builder.aggregate` extension (or `yearly_builder.py`): per station
   × year → monthly/annual stats + `monitor_days`/`monitor_hours`; emit
   `data/station_years.json.gz`. Re-pull `data/_cache` first (~1 h of
   anonymous S3 GETs).
2. opencity CKAN ingest (one-off bulk + QC into the same schema) to cover
   2023–24 for 39 DPCC stations — this is what makes "the last few years"
   honest inside Delhi proper.
3. Optional monthly refresh cron re-running `openaq_archive.pull` →
   `station_years` rebuild (the archive lags ~1–2 d; monthly is enough for a
   yearly card).
4. `/v2/living` endpoint: resolve anchor → rank candidates (localities for a
   move, stays for a visit) → attach `basis:"station_record"` cards → reuse
   `/v2/purest`'s exclusion accounting and `/v2/stays`' pool geometry.
5. Client: one composer screen — search (existing `A.search`) → ranked rows
   with the yearly card; "right now" stays a secondary row, never the ranking
   number for a move/stay decision.

**Deliberately out of scope / rejected:**
- Backfilling a "year of our served field" — impossible (archive started
  Oct-5); claim otherwise is fabrication.
- Kriged yearly grids as default — label-or-skip; IDW + named monitors is
  defensible and matches the shipped convention.
- CPCB CCR scraping for bulk history — unofficial, per-query capped, fragile;
  opencity + OpenAQ cover the same instruments cleaner.
- aqi.in/Airveda density — ToS-gray per docs/23; not needed (93 official
  stations already cover the decision space).
