# Lane W — Where To (Oct 11)

Files: `server/webapp/whereto.js`, `server/webapp/whereto.css` (only).
Nothing committed / pushed / deployed. Rig + shots live outside the repo in
`~/alive-dev/w/` (`drive.js`, `drive2.js`, `probe*.js`, `shots/`).

## What changed

**One Google-Maps surface.** Search = From + To rows (the rows ARE the
inputs) over one results list, plus the existing "Your location" / "Choose
on map" bar. Deleted from Where To: the "air answers" header, "where to
stay" / "when to go out" door rows, the air / stay / play intent rows and
the kind-accelerator row (plus all their intent parsers and strings).
From stays editable in place (tap the row, or the From half of the trip row
on later steps). From defaults to Your location; To opens empty.

**Results while typing.** Uses `A.search.live(q, bias, onRows, opts)` (lane
S, landed 17:40) with `A.search.search` as fallback. Rules:
- every keystroke bumps a sequence; an answer for an old query never paints
  as-is. Rows already shown narrow in place (only rows carrying every typed
  word survive), interim tiers only show rows carrying every typed word;
- typing forward *retires* the in-flight call instead of killing it — its
  next network tier may add rows that still match, then it is cancelled
  (≤2 retired, 2.5 s cap); editing backwards cancels everything;
- slim 2 px progress bar (transform animation) while deeper tiers come;
  if nothing at all is listable yet: 3 quiet skeleton rows (opacity pulse) —
  never a bare "Searching…";
- final answer with no row carrying every word → header "No exact match —
  closest places" above the closest rows; final with no rows → "no place
  found — try a landmark, or choose on the map"; a 15 s guard turns any
  never-ending search into "this is taking long — …" (late rows still land);
- Enter takes the top row; with nothing listed it reruns live() with
  `{enter:true}` (lane S's deep tier).
- Rows: category icon, name (typed words bold), ONE plain subtitle (raw
  tags like `amenity:place_of_worship` stripped, name echo and
  "Delhi, Delhi" repeats removed, ≤2 segments), distance.

**Modes step (before routing).** Three big cards: Health Maxer — cleanest
air, no compromise · Petrol + Health — least petrol, clean air · Time +
Health — fastest with live traffic, still clean. Last pick remembered in
`alive.whereto.mode` (highlighted). No money anywhere.

**Vehicle step.** The existing VehicleSheet wizard, minus the intro/caption
slabs and radios. Trip context: tapping the saved ride (pre-selected) goes
straight to routes; a new ride asks fuel + year only; "skip — a typical
Delhi ride" routes with the server's fleet prior. The routes-view vehicle
pill opens the full wizard (incl. PUC).

**Routes.** `POST /v2/plan` body gains `mode` (`health_max` |
`petrol_health` | `time_health`). Half sheet (top 38%) so the map shows the
route lines (picked = forest on a paper casing, others = quiet hairline),
From/To pins, jam markers from `option.jams` (red dot + "+3 min"), and
`A.map.traffic(null, true)` (lane M's TomTom flow layer) while the routes
view is up (off on leave / journey). Cards are simple:
- big "25 min · arrive 6:14 pm" (`live_eta_s` if present, else `eta_s`);
- air: band-colour dot + "7 µg breathed" + band word on its wash
  ("good air"), from `dose.mid` / `dose.avg_conc_ugm3`;
- "+4 min traffic" only if `traffic_delay_s > 60` (null = unknown = hidden);
  "0.6 L petrol" / "0.3 kg CNG" only if `fuel_l` / `fuel_kg` exist, "saves
  0.2 L" from `fuel_saved_l|kg`, "no petrol" for 0-fuel rows only in Petrol +
  Health; all fuel bits highlighted in Petrol + Health; never money;
- small mode badge ("cleanest" / "least petrol" / "fastest") on the pick:
  the server's `mode_pick` wherever it sits; with no flag anywhere (today's
  prod) the contract rule on live fields (min dose; or min ETA within +15%
  of min dose); petrol never claims a pick without `fuel_l`;
- ONE short `why` line only when the server sends it; a grey meta line
  "Car (AC) · 21.2 km · via Mahatma Gandhi Marg, …".
- Deleted: reason_line ("Within ~10% … a fair trade", "Least smoke for you,
  but heavier for Delhi"), delta lines ("+20% air +4 min — take the fast
  one", "same air · +1 min …"), "+1 µg more than Car (AC)", coverage note,
  µg bars, the info panel, the legend.
- Collapse: your vehicle's options (`your_vehicle`) lose any route another
  one beats on time AND air (AND petrol when sent), then near-duplicates
  (<60 s, ≤3% dose); max 3; the pick always stays. Other vehicles: one best
  card each under a collapsed "other ways to go".
- Start → `A.show('journey', {option, from, to, options, mode, vehicle,
  field_age_s})` (journey.js untouched).

**Bugs fixed on the way**
- The vehicle was posted as an object (`vehicle: {cls:'bike'}`);
  `plan._parse_vehicle` wants a string, so every pick silently became
  "car". Now `vehicle: 'bike'` + `vehicle_profile.class` ('walk' not
  'pedestrian', 'auto' not 'rickshaw'). Verified: `your_vehicle` now flags
  the picked ride's options.
- The `church` icon path was malformed (`q0 20Z`) → console error whenever
  a church row showed. Fixed.
- "Your location" / "dropped pin" no longer pollute Recents.

## How verified (headless Chrome, puppeteer-core, 390×844 DPR 3, :8110)
- `node --check server/webapp/whereto.js` — OK.
- `drive.js`: types "new delhi railway station" and "iskcon east of
  kailash" letter by letter (140 ms/key), screenshot per prefix, picks the
  ISKCON temple row → modes → vehicle (car → petrol → 2017–2020) → routes →
  other ways → mode switch → vehicle pill → edit From. Layout audit at
  320/360/390/430 on search, modes, vehicle, routes: no document overflow,
  no element past the viewport, no tap target < 40 px, no input < 16 px.
  0 door/intent rows. Plan body seen on the wire:
  `{"mode":"petrol_health","vehicle":"car","vehicle_profile":{"class":"car","fuel":"petrol","year_bucket":"2017_2019"}}`.
- `drive2.js`: typo "iskcn eest of kailsh" → "No exact match — closest
  places" + ISKCON Temple East of Kailash; garbage → honest "no place
  found"; saved ride + remembered mode → one tap each; a TEST-ONLY mock that
  adds lane E's fields to a real `/v2/plan` answer proves the badge,
  "+2 min traffic", "0.4 L petrol" (highlighted in petrol mode), the `why`
  line and the jam marker render; Start mounts journey and leaves no
  whereto pins behind.
- Shots: `~/alive-dev/w/shots/` — `01-empty`, `02-ndls-*`,
  `03-iskcon-*`, `04-modes`, `05-vehicle`, `05b-fuel`, `05c-year`,
  `06-routes`, `07-routes-other`, `08-{search,modes,vehicle,routes}-{320,360,390,430}`,
  `09-routes-health`, `10-edit-from`, `11-typo-closest`, `12-nothing`,
  `13-jama`, `14-mock-contract-routes`, `15-mock-petrol-routes`,
  `16-journey-started`.
- Console: zero JS errors from whereto.js. Remaining console noise is
  network-level and not from this lane: `/v2/ac` + `/v2/p/ac` 404 on prod
  (lanes X/P not deployed), Overpass mirrors refused/CORS (search.js deep
  tier), `/v2/p/flow_tile` 404 (map.js traffic probe, lane P not deployed),
  `/v2/tally` 404 (telemetry.js); one earlier run also caught
  `pageerror: OFFROUTE_M is not defined` from journey.js (lane J, in
  progress — gone in the last runs).

## Depends on other lanes
- **E** (`/v2/plan`): `mode` semantics + `fuel_l`, `fuel_kg`, `fuel_type`,
  `fuel_saved_l|kg`, `live_eta_s`, `traffic_delay_s`, `jams[]`, `mode_pick`,
  `why` — field names checked against the local `server/v2/modes_engine.py`
  (lane E, in progress). All hidden until present on the wire.
  NOTE for E: today prod reads `body.mode` as a vehicle alias when
  `vehicle` is absent ("skip" path) — harmless (falls back to car) but
  `vehicle_requested` echoes "health_max" until E takes `mode` over.
  If `mode_pick` lands on another vehicle than the rider's, W shows the
  badge on that "other way" card and opens the list.
- **S**: `A.search.live` used as documented; rows tidied again here (plain
  subtitle, distance from bias when missing).
- **X / P**: type-ahead only feels instant once `/v2/ac` and `/v2/p/ac`
  answer on prod — today tier 1 falls back to `/v2/search` (~4.5 s), so
  during continuous typing the list shows the skeleton until a pause.
- **M / P**: traffic layer appears only when `/v2/p/flow_tile` answers.
- **J / A**: nobody calls `A.track('journey_start', …)` yet. W passes
  `mode` + `vehicle` in the journey params; suggested one-liner in
  journey.js mount: `if (A.track) A.track('journey_start', { mode: params.mode, vehicle: params.vehicle });`
  (W deliberately does not track, to avoid double counting).

## Honest gaps
- With today's prod data the collapse often leaves ONE card for the
  rider's vehicle (the default route beats the "least-smoke" variants on
  both time and dose); alternatives reappear when E's live traffic makes
  them faster. Other vehicles stay one tap away.
- Mode switch on today's prod re-plans but returns the same set (server
  ignores `mode` until E ships), so only the badge/sort/fuel highlight
  change.
- The routes view's half sheet is a CSS override of app.css `.sheet`
  (`.wt-half .sheet { top: 38% }`); no drag handle behaviour.
- Ranking quality of results (e.g. "OYO Rooms … ISKCON" above the temple)
  is lane S/X's.
