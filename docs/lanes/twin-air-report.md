# twin report — air lane (airmap + ledger)

Lane: `server/webapp/airmap.js` + `airmap.css`, NEW `ledger.js` + `ledger.css`.
Sources: `Mobile/src/screens/DelhiToday.tsx`, `Mobile/src/screens/LedgerScreen.tsx`,
`Mobile/src/components/{AirMapCard,TapReadout,DepartGraph,CityMoves,FreshnessChip,BandScale}.tsx`,
`Mobile/src/theme.ts`, `Mobile/src/i18n/strings.ts` (en table — all strings verbatim).

## wiring needed (coordinator)

`index.html` is frozen, so the ledger screen can't load itself. To register it:

```html
<link rel="stylesheet" href="ledger.css">
<script src="ledger.js"></script>
```

`ledger.js` self-registers `A.screen('ledger')` at load — `home.js` doors already
auto-render any registered screen, so a "trips" door appears on home with no door-
specific wiring. Optionally give it its own `DOORS` entry label later (defaults to
the door's auto title from the screen id).

airmap.js/css need no wiring changes — already loaded by index.html.

## mapping — airmap.js + airmap.css

The airmap screen keeps its map-first shape (detent sheet over the painted field —
tap-to-read must stay reachable), and carries the full DelhiToday surface inside
the sheet plus the air-map pieces on the map. Order inside the sheet scroll:
hero → chips → go-out card → species → typical → forecast → own-gated (streets,
travellers, moves) → why-estimate.

| RN (file:structure) | web twin | notes |
|---|---|---|
| DelhiToday hero (`.hero`, ~L360-440) | `.dt-hero` + `.dt-heronum/felt/ref/scale/range/whyhero/whynote` | same pad 22/22/18, 96px lh102 ls-4 light num in `bandInkIdx`, felt 30px, ref 15px lh21, BandScale, `whyLine()` rebuilt from `drivers` + `wind.from_deg` (same `whyCompass`/`whyBit` map), `cause_note + · measured, not reported`. `showCig` line omitted — no settings screen exists web-side (gate has nothing to read). |
| `LinearGradient` hero bg | inline `linear-gradient(bandWashDeepIdx(bi), #FAFAF7)` | verbatim design — the band rendered as graded light, not a flat card. |
| `FreshnessChip` | `.dt-chip` row | `updated {n} min ago` (n=max(1,round(age_min))), `cityStale` when stale/15min+, `dataFromModelOnly` when stations offline. Icons = the same Material glyph paths (icons.tsx, `viewBox 0 -960`). |
| species grid (`speciesGrid`) | `.dt-species` rows in `.dt-grid` | same row order PM10/NO₂/O₃/CO/SO₂/NH₃/US AQI, same WHO limits, over→breath3, `aqiScale`/`whoRef`/`citySpeciesNote`. |
| `cityTypical` | `.dt-note` | same ±% copy. |
| `forecast` row | `.dt-fcrow/.dt-fccol` | w12 r6 h=4+28·pm/max band-colored bars, vals h%3==0, "now"/"+{n}h". |
| `ownEmpty` well | `.dt-ownempty` | own = `journey.history` length; 0 → well, >0 → aggregates, null → hidden. |
| `corridors` | `.dt-crow` in `.dt-grid` | pin glyph, title-case-iff-lowercase name, `cityTrips` sub, heavier→breath2/"heavier". |
| travellers/day lines | `.dt-dayqual/.dt-dayline` | UTC qual + `cityTravellersLineUg` + `citySwitched`. |
| `CityMoves` | `.dt-moves` | verbatim: title/sub, insufficient note, mode-share bar + ModeRows (MODE_META colors), suppressed note, corridors p25–75, BandRows "smoke you breathe/puts out", pm25_g note, `cityBasisPrivacy` foot. |
| why-expander | `.dt-whybtn/.dt-whybody` | surface2 pill, info icon, chevron rotates; body lines model/stations/pm25-band/band-honesty/privacy (k_min, window_h→hours or days). |
| `AirMapCard` | `.am-card` floating over the field, left, above the sheet | glassFaint/r16/hairline/float shadow; "the air map" + `{n} live stations` + "redder = worse air right now" + 6 `bandFieldIdx` dots + "good → severe" + age line (fresh/stale/>30m rules). stations from `/v2/city` `provenance.stations.count`, age from `/grid` cell epoch. |
| `TapReadout` | `.am-read` top-center | glass card r16, padL12/R7/V9, gap3: 9px band dot + `"{n} µg/m³ — {band}"` (17px med, bandInkIdx) + ✕; caption 11px `"{place|'this spot'}{ · satellite estimate}"`. States pending "reading…"/"outside the air map — no read here". Same field-first contract: tap samples the *painted cell* locally (point-in-polygon over `/grid` features) → instant read with its conf; outside cells → `/aqi` read (conf 'model'). |
| `TapPin` | `.am-tappin` | band-washed chip (pad 3/7, r9, `bandWashIdx` bg, `bandEdgeIdx` border, 11px bandInk num) + 5px dot below. |
| `DepartGraph` | `.dg-*` in the go-out card | exact candlestick grammar: strip h64, cell flex1, col centered, whisker w3 r1.5 `color+66` (lo→hi), bar w58% min4 max11 r2 h=mid, best→accent+4px top dot, sel→ink over accentTint well, else breathRamp(mid/max). Axis at {0,6,12,18,last}: `now`/`+{n}h` over clock. Caption "about" + `now/+Nh · ist_label ≈ N µg/m³`. Tap + drag-scrub to select, keyboard Enter. Data = `/v2/playtime?near=` hours (pm25_lo/mid/hi). Verdict sentence, sparse "thin read" chip, best/worst/avg lines, decision lines, station·field-age meta kept — all server strings. |
| `BandScale` | `.dt-scale` | 6-stop `bandEdgeIdx` track (4px r2 in a 9px box), paper seam over current segment, `bandInkIdx` position block. |
| DelhiToday chrome (bar56 + back glyph + title, no ✕/grab) | kept `A.sheetChrome` (web platform chrome: back + title + ✕ + grab). Title "air around me" (the web screen's door name; DelhiToday is the content surface). | deviation noted below. |

## mapping — ledger.js + ledger.css (`A.screen('ledger')`)

Reads `journey.history` (journey.js's real store shape: `t/from/to/vehicle/label/
km_plan/eta_plan_s/covered_km/taken_s/dose_ug/dose_plan_ug/simulated`).

| RN (LedgerScreen) | web twin | notes |
|---|---|---|
| summary card | `.lg-summary` | stone wash `#F1EFE9` (V2Tint clay.wash), r20, padH16/T16/B14, marginH14/B14, card shadow; cols `[{n} trips | ≈{doseUgRound} µg breathed | ≈{kg} put out (only when emit_kg exists)]`, foot `all saved trips · estimates — honest ranges, never fake-exact`. |
| week row | `.lg-weekrow` | hairline top, `last 7 days`, `{n} trips · ≈{ug} µg{ · about {kg} kg put out}`; 7 cols bar w14 r7 h=4+34·ug/max, `cigTone(day ug)` fills, weekday-narrow labels (`en-IN`). |
| day headers | `.lg-dayhead` | `Today` / `yesterday` / `en-IN {weekday short, day, month short}`. |
| TripCard | `.lg-card/.lg-head` | r20 card shadow, head minh68 padH14 padV12 gap12: mode tile 42×42 r13 surface2 + filled `vehicleGlyph` 22px text2 (same icon paths + same glyph mapping incl. erick), route 15px med, meta `{modeLabel} · {clockLabel}` (IST clock, same `modeLabel` MODE_BASE/suffix port incl. `mode_approx/leastSmoke/leastSmokeAlt/altN`), saved line when `avoided_ug>0`, dust icon + `≈{fmtUg} µg` in `cigTone`, `≈{fmtKg} kg` only when `emit_kg` exists, chevron16 rotates on open. `simulated` → `· simulated` suffix on meta (honesty — web trips can be simulated previews, RN trips are always real). |
| TripDetail | `.lg-detail` | hairline padH14 padT8 padB4: breathed row `≈{n} µg` + sub (`tripsDoseBand` when `dose_lo/hi_ug` present, else `tripsDoseDetail`), put-out row when `emit_kg` present, saved line, `shared anonymously` badge when `donated===true`, hairline, delete row (trash16 breath3). Every RN seam renders **only when the stored value exists** — same honesty rule. |
| EmptyState | `.lg-emptywrap` | 76×76 r26 surface2 badge + clock30, `no trips yet` 22px semi, hint 15px center maxw280, `trips stay on your phone`. |
| footer | `.lg-footer` | `trips stay on your phone` + `delete all trips` (trash15 breath3) → `confirm()` with the RN alert's two lines verbatim. |
| chrome | `A.sheetChrome` (back + "Trips" + ✕ + grab) | RN bar has no ✕/grab — that's web platform chrome, kept. Full sheet `top: 52px+sat`. |
| `loadTrips/deleteTrip/clearTrips` | real localStorage ops on `journey.history` | per-trip delete + delete-all actually remove records. |

## deviations (each deliberate)

- **Sheet is a detent (top 42%)**, not RN's full sheet — tap-to-read on the field is
  this surface's purpose; the floating cards + map strip stay live above it. DelhiToday
  content order inside the sheet is verbatim.
- **Go-out card data is ambient µg/m³**, not inhaled-dose — `/v2/playtime` is the
  web route (RN's DepartGraph normally plots dose; here it plots ambient with the
  same candlestick grammar; caption honestly says `µg/m³`).
- **No settings/`showCig` line** in the hero — no web settings store exists to gate
  it on; the cigarette translation only shows in the ledger's cig-tone numbers, which
  are always-on in both.
- **`A.search` failure resilience**: tap caption reverse-geocode is fire-and-forget —
  a failed reverse leaves `this spot`, never a blank card.
- **Field opacity** kept the pre-twin values (hi .38/med .32/lo .2) — the app's
  `bandFieldIdx` tone at ~.32 hi-conf alpha reads the same over the same basemap;
  RN's own alpha isn't a single number to port (it's per-confidence).
- Nothing faked: no emit/band/donation rows on web trips (store lacks them); the
  modes-CityMoves card stays quiet when `/v2/city/moves` fails (own>0 gates it).

## verified — real browser, 390×844

- Chrome/Chromium via Playwright against the live app (same-origin proxy → prod API),
  plus iPhone-17 Safari spot-checks on the same page.
- `#/airmap`: field paints from real `/grid`; AirMapCard "52 live stations · air
  reading: N min old"; tap → `57 µg/m³ — satisfactory · near {place}` card + TapPin;
  hero/species/typical/forecast/ownEmpty/why all render verbatim; DepartGraph
  candlesticks + whiskers + accent best + axis + caption + scrub-select.
- `#/ledger` (files injected — see wiring): summary `3 trips · ≈204 µg`, week bars,
  Today/yesterday/`Tue, 6 Oct` headers, trip cards, expander (`smoke you breathed /
  ≈104 µg / about 104 µg … / delete this trip`), footer + delete-all.

Screenshots in `docs/lanes/twin-air-shots/`:
`airmap-hero.png` (iPhone Safari — hero + legend + field), `airmap-tap.png`
(TapReadout + TapPin + legend), `airmap-goout.png` (DepartGraph card + decisions),
`ledger.png` (summary + week bars + cards), `ledger-open.png` (detail expander).

(Seeded `journey.history` with three records for the ledger verification; the row
math/dates are computed from those store records, not hardcoded.)
