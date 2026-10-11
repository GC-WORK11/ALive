# twin-journey — lane report

Screen: **journey (nav HUD) + arrival receipt** → `server/webapp/journey.js` + `server/webapp/journey.css`.
One additive handoff line in `server/webapp/whereto.js` (flagged below). Frozen files untouched.

Sources mirrored:
- `Mobile/src/components/shell/NavChrome.tsx` — the nav HUD (banner + pill + instrument cluster)
- `Mobile/src/components/shell/ReceiptSheet.tsx` — the arrival receipt
- `Mobile/src/components/DepartGraph.tsx` — the dose-over-ride bar card's visual language
- `Mobile/src/nav/instructions.ts`, `Mobile/src/nav/strip.ts` — cue text + strip/dose-spread semantics
- `Mobile/src/i18n/strings.ts` (en), `Mobile/src/theme.ts` (V2T/V2Elev/V2Type/V2Radius), `Mobile/src/icons.tsx` (glyph geometry)

## Verification

Real Chrome 154 headless-new, emulated 390×844 @2x, driven over CDP against a local static server
(`server/webapp` on :8090) with `?api=` pointed at prod CF. Same-document hash navs keep stale JS —
the driver reloads via `about:blank` (that's why `02`/`06` changed between runs).

Flow: `#/whereto` → consent "picked" → `A.search.search('ISKCON')` → `A.api.post('/v2/plan')` →
`A.show('journey', {option, options, field_age_s, from, to, vehicle})` → preview at plan pace →
×8 → confirm → early-end receipt. Second run: ~800 m trip ridden to arrival.

Screens (in `twin-journey-shots/`):

| shot | state |
|---|---|
| 01_whereto | entry point (other lane's screen; shown for flow context) |
| 02_journey_start | banner: ink tile + slight-left glyph + "1.6 km" + "Bear left onto Janpath"; flag pill; cluster |
| 03_journey_mid | mid-preview: dist counting down, counters accruing, ×8→×1 fab, progress hairline |
| 04_confirm | ✕ → inline confirm row replacing cluster body |
| 05_receipt_early | "Trip ended." + partial dose ruler + stats + dose bars + context rows |
| 06_receipt_arrived | "You're here." full receipt — everything below |

Live-text probes (headless, so preview mode — exactly what a desktop sees):
- HUD: `"1.6 km" · "Bear left onto Janpath" · "11 min · 7.1 km left · arrive 7:45 am" · "≈ 0 µg"`
- mid: `"1.0 km" · "≈ 0.7 µg" · "29 g"`
- receipt: `"You're here." · "about ≈ 1.4 µg" · "about 0.7–2 µg" · "72 g / 1.3 km / 2 min" ·
  "estimated for this kind of ride · 44–124 g" · "includes 0.01–0.26 g of fine dust (PM2.5)" ·
  "Bike / scooter · least smoky way would have put out ≈ 49 g" ·
  "heaviest stretch · 51 µg/m³ · satisfactory — around Baba Kharak Singh Marg" ·
  "updated 1 min ago · preview — simulated ride · plan pace · kept in this browser only"`

## NavChrome → journey DOM/CSS map

| RN (`NavChrome.tsx`) | web (`journey.js` / `journey.css`) |
|---|---|
| `s.banner` top `insets+12`, l/r 12, glassDeep, r20, pad 12, V2Elev.float | `.jn-banner` — same insets/radius/pad; glass `rgba(255,255,255,.95)` + blur; shadow `0 8px 22px rgba(22,24,29,.12)` |
| maneuver tile 54×54 r17 `V2T.text` bg, glyph onInk | `.jn-tile` 54×54 r17 `var(--ink)`; glyph `MANEUVER_GLYPH` + `maneuverOf` ported verbatim; arrive→pin `#E8B8A8`, transit→vehicleGlyph |
| `s.dist` title 22 semi NUM | `.jn-dist` 22px `var(--mono)` 600 tabular (`distToStr`: ≥950 m → `N.N km`, else `N0 m`) |
| `s.instrNext` secondary 15 med text2 (2 lines) / `s.instr` body 17 semi | `.jn-instr` 15/500 ink2 clamp-2; `.big` 17/600 ink when no next step → "follow the route line" |
| acts 44×44 opacity .55 | `.jn-act` 44×44 .55, `:active` scale .86; recenter only when `!follow` (map `dragstart` releases follow) |
| `s.pill` top `insets+92`, glassDeep pill, dot 7 r4 breath pulse | `.jn-flags` at `92+sat`; `.jn-pill` one-line slot — "finding a new way…" (dot) / "no location — counting the air where you started"; `.jn-flag` sits in the same slot for the preview label |
| `s.cluster` l/r 14, bottom `insets+12`, glassDeep r20 float, overflow hidden | `.jn-bottom` anchor + `.jn-cluster` identical metrics; overflow hidden kept |
| `progTrack` h3 glassSoft + accent fill right-rounded | `.jn-prog` 3px + accent fill, hidden at 0% |
| `CounterCell` flex1 pad 14/10; cellDiv 1px line; head icon14 + label 11 ink3 | `.jn-cells`/`.jn-cell`/`.jn-cdiv`/`.jn-cellh`/`.jn-celll` identical |
| `cellVal` body 17 NUM med mt4 | `.jn-cellv` 17 `var(--mono)` 500 mt4 — "≈ N µg" / "N g" / "≈ N.N kg" (approx()/doseUgRound ports) |
| `bandTrack` h3 r2 surface2 mt7 + seg (opacity .5 tint) + mid tick 3×5 | `.jn-btrack`/`.jn-bseg`/`.jn-bmid` identical; span = accrued `hi`, seg = lo→hi%, tick = mid% |
| `cellBand` micro 11 ink3 mono mt5 | `.jn-cellb` — "N–N µg"/"N–N g" collapsing when equal |
| `metaRow` border-top line, `metaTxt` label13 text3 center mono | `.jn-meta` — `"N min · K.K km left · arrive H:MM am"` (leftIsKm ≥950 → km 1dp else m-to-10s; clockLabel = IST wall clock) |
| `nextStep` → banner sentence = served step text | `buildSteps()` projects served `steps[].lat/lon` to arclength; cue = first step ahead (+25 m pass tolerance); `step.instruction` shown verbatim (`instructions.ts` en = server sentence) |

## ReceiptSheet → receipt DOM/CSS map

| RN (`ReceiptSheet.tsx`) | web |
|---|---|
| sheet l/r 12, bottom `insets+14`, `V2T.bg`, r24, V2Elev.pop, pad 18/14 | `.jr-sheet` identical + max-height `calc(100%-96px)` scroll |
| head: title 22 famSerif-semi + modeChip surface2 pill (icon14 + label13) | `.jr-title` 22/700 Satoshi; `.jr-chip` same metrics, `vehicleGlyph` + `modeLabel` en |
| neverStarted → "ended before it really started" + "under 100 m — nothing counted" | `x.neverStarted` (<100 m, not arrived) same copy, done-only |
| eyebrowRow dust15 breath1 + "You breathed" label13 mt16 | `.jr-ebrow` identical |
| heroNum 44 famSerif-semi: "about" est-dangler + "≈ N µg" | `.jr-hero` 44/700 tabular + `.jr-est` 13 ink3 inline |
| bandTxt "about lo–hi µg" label13 mono when hi−lo≥1 | `.jr-bandtxt` same rule |
| DoseScale: track h6 r3 hairline, fill breath1→mid%, whiskers 2.5×9 breath2, worst ring 10 r5 border out1, dust icon | `.jr-scale` identical; scaleMax = `max(hi, worst, dose)`; whiskers when hi−lo≥1; ring when `worst > mid*1.02` |
| "about N× less smoke than by {label}" / `smokeFraction` "about {f} of {m}" (fullRun only) | `SMOKE_FRACS` port; walk special → "than on foot"/"of walking"; needs `options` (below) |
| "the smokiest way would have added ≈ N µg" when ≥6, fullRun | same rule |
| StatTile grid: surface2 r13 pad 11/10 centered — put out / distance / time | `.jr-grid`/`.jr-cell` identical |
| detailTxt 11 text3 mono lines: "estimated for this kind of ride · band", "includes … g of fine dust (PM2.5)", "{alt} would have put out ≈ N kg", "your ride put out nothing — no exhaust" | `.jr-detail` identical strings + collapse rules (gram band when hi<1 kg, ±0.05 collapse, altEmit = lowest `co2.mid > 0` other option) |
| foot borderTop: "updated N min ago · kept on this phone only" | `field.age_s/60`; "kept in this browser only" (deviation D3) |
| btns: done flex1 minH48 ink pill + share pill | `.jr-btns` — "done" ink flex1 + "plan the way back" surface2 pill (deviation D4) |
| DepartGraph dose card | `.jr-g` — 14 columns, 58%-width r2 bars, breath ramp (`f>.66`→`--b4`, `>.33`→`--b3`, else `--b2`), accent column + 4px dot on the heaviest stretch's bucket, mono axis 0→duration, "est." + "≈ N µg across the ride" caption |

## Honest mechanics kept (unchanged)

Real `A.geo.watch` live mode; preview = labeled simulated ride at `L/eta_s` (never fake drive);
arrival = off<80 m && (frac≥0.985 || <55 m); dose = served `{lo,mid,hi}` band spread by segment
pm25 (uniform fallback); counters accrue the same bands; `journey.last`/`journey.history`
persist (cap 20); samples → the dose curve; heaviest stretch = max segment pm25 + roadAt/steps
or reverse-geocode fallback; WHO day-dose = 15 µg/m³ × ~14.4 m³; delhi mean live from `/v2/city`.

## Deviations (each flagged in code)

- **D1 — `#chrome` hidden on journey** (`body[data-top="journey"] #chrome{display:none}`):
  RN nav has no brand chrome; the banner is the top card. Scoped to journey.css, frozen files
  untouched. Other screens unaffected.
- **D2 — web-only affordances in RN vocabulary**: `.jn-flag` preview pill (required honesty label),
  ×8/×1 pace fab floating above the cluster, `.jn-ctl` row ("follow my gps"/"ride a preview
  instead") inside the cluster, `.jn-confirm` swapping the cluster body on ✕ (RN exits instantly;
  web keeps the fat-finger guard from the previous build).
- **D3 — "kept in this browser only"** vs RN "kept on this phone only": same localStorage ledger,
  honest noun for the platform.
- **D4 — "plan the way back" replaces the share button** (web has no share sheet; RN's tertiary
  "How we got this"/"save" donate row also doesn't exist here — noted, not faked).
- **D5 — gram fallback for the alt-emissions line**: RN's "{m} would have put out {n} kg" would
  read "0 kg" for a sub-50 g option — renders "≈ N g" under 0.1 kg instead.
- **D6 — no cigarette tick / strip-fail / paused counters**: RN's showCig framing is
  settings-gated and defaults off; web has no strip endpoint or pause tracking — the
  corresponding pills/lines are honest absences, not hidden bugs.
- **D7 — `whereto.js` +2 lines** (flagged, additive): `A.show('journey', …)` now passes
  `options: state.plan.options` + `field_age_s` — the receipt's worst/alt comparisons and
  "updated N min ago" can't exist without them. No behavior change in whereto itself.
- **D8 — instruction copy**: served `step.instruction` verbatim (RN's en `localizeStep` does the
  same); no-steps options → "follow the route line" (RN `followRoute` string).

Base SHA at time of work: `ab40cc0`.
