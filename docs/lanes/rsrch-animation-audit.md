# rsrch — where-to "choosing paths" animation audit

Research only — no code changed. Repo HEAD `5f744ac4`.
Scope: `server/webapp/whereto.js` (+`map.js`, `journey.js`, `whereto.css`), the
Mobile twin, the scripted sim, `server/v2/plan.py` + `modes_engine.py`.

## TL;DR

- The "choosing paths" animation **was never in the webapp**. It exists — still
  live — in `Mobile/src/components/RouteTint.tsx` (the four-act "chooser" beat)
  and in the scripted landing sim `server/static/sim/screens/compare.js`
  (marching-ants seek line + `stroke-dashoffset` contender traces + winner
  mask reveal + verdict bubble).
- The moment it "went away" on the surfaces people see is **Oct 10**:
  `3e44ada3` + `b035b6a4` swapped the landing's live-preview iframe from the
  scripted sim (`/static/sim/` or edge equivalent) to the **real `/app/`**
  webapp — which has no route-draw choreography. Same day `a1fd733d` created
  `whereto.js`; `f48114ea` made it a pixel-twin of the RN sheets but ported
  the cards, not the map beat.
- The cards' cheapness has its own commit: **`69495bd4` "Oct 11 release"**
  deliberately deleted the rich option card (delta headline, reason_line,
  "lightest for you/Delhi" tags, felt-gap line, dose band, dose bar, coverage
  note, info panel) in favour of "simple route cards" — documented intent in
  `docs/lanes/whereto-oct11.md` ("Deleted: …" list, lines 68–71).
- Restoring is a **port**, not a revert: there is no web implementation to
  bring back. The Mobile beat is the spec; both web map engines (MapLibre GL
  4.7.1 and the Leaflet basic fallback) can run it. Two-phase `fast:true` →
  full `/v2/plan` already exists on the server and is exactly the "real work"
  a loading animation should be tied to.

---

## 1. Git archaeology — the animation that was lost

### 1a. What it was — the Mobile "chooser" (still live at HEAD)

`Mobile/src/components/RouteTint.tsx` (815 lines, mounted in `App.tsx:350`,
fed by `useShellFlow.ts` → `planEngineFirst`/`planOptions`). File header calls
it **"THE CHOOSER"** — four acts, all inside `whenMapDrawFree` (a sim-only
draw-pump throttle, `src/map/drawHold.ts`):

- **act 0 · frame** (~640 ms): a ring breathes once on each endpoint — origin
  first, destination ~170 ms later — "the trip itself is marked on the map
  while nothing else moves". Two always-mounted `Marker`s whose child swaps to
  a pulsing `Animated.View` ring (26 px, scale 0.3→2.2, opacity 0→0.55→0,
  ease-out cubic).
- **act 1 · ways** (~750 ms per option, staggered 540 ms): up to 3 drawable
  candidates (ranked alternates first, the selected row **last**) trace on
  span-by-span at an ease-out cadence — `CAND_GROUP_DELAY = [0,62,131,209,294,
  388,490,600]` ms over `CAND_GROUPS = 8` chunk flushes, each chunk stepping
  opacity `[0→0.16]→[120ms→0.5]→[230ms→0.85]` (`CAND_IN`). All contenders at
  equal `CAND_OP = 0.85` — "every line a real option the server priced".
- **act 2 · hold**: ~300 ms breath, all candidates read as equals.
- **act 3 · settle**: losers dip to `DROP_OP = 0.3` then rest at `ALT_OP = 0.5`
  hairline; the winner **re-traces itself bold from→to** in 3 slices ~190 ms
  apart (opacities 0.62 → 0.82 → 1, 9 px casing under 6 px line — "thickens");
  a **verdict pill** pins onto the route ~260 ms after the winner's weight
  lands, holds ~4.2 s, fades. Pill copy is derived from the set's own numbers
  by `chooserVerdict()` in `src/map/routeTint.ts` ("cleanest · 41% less than
  fastest" only when the fastest option's dose really is that much heavier;
  else "cleanest" / "fastest" / the server's `reason_line`).
- **tap-swap on the same set**: new pick settles into bold over ~300 ms while
  the demoted one eases down to `DEMOTE_OP = 0.18` → back to alternates
  (~450 ms). Pill re-derives.
- Mechanics: every stage is feature `op` props stepped on `setTimeout`s into
  two always-mounted `GeoJSONSource`s (`routeTintAlts`, `routeTintSel`) +
  data-driven `line-opacity: ['coalesce',['get','op'], …]` — sources/layers
  never unmount (the iOS-sim removeSource-mid-draw SIGSEGV class). Beat is
  interruptible by generation counter; `useReduceMotion` collapses to final
  state; the first tick waits for `whenMapDrawFree` so a flush can't ride a
  sheet-mount frame.

Commits (all 2026, all still on HEAD — Mobile never lost it):

| commit | date | what |
|---|---|---|
| `f4578e07` | Oct 6 | `route tint: staggered suggestion sequence + tap-swap settle` — first reveal |
| `db62bd17` | Oct 7 | `mobile: cinematic route chooser — equal candidates draw, winner settles + verdict pill` |
| `f5c95ccd` | Oct 7 | `chooser-craft: four-act from→to→choose beat — endpoint frame, felt alternates, bold settle + honest verdict pill` — the current form |
| `a85ef265` | Oct 7 | `map-perf: … chooser flush count` — `CAND_GROUPS` 8, ease-out resample, ~27 % fewer source rebuilds |

`docs/lanes/whereto-rebuild-report.md` measured it: `plan:req → plan:first`
(engine rows) **489 ms**, `plan:req → plan.chooser` ~6.6 s incl. the beat,
full ~24-option set ~10.7 s.

### 1b. The scripted-sim twin (still in repo, orphaned)

`server/static/sim/screens/compare.js` (byte-identical twin at
`web/edge/static/sim/screens/compare.js`) — a DOM/SVG recreation of the same
beat for the landing's scripted phone preview:

- **While `/v2/plan` prices** (`pricing()`, lines 397–431): the panel shows a
  spinner + "finding the purest route for you…" + "pricing every way across
  today's air · {live elapsed s}" (a real 100 ms-interval clock, not a fake
  bar) and, after >9 s, "long trips take the field a little longer"; plus real
  provenance from `/v2/city` ("N live station readings · air map M min old").
- **`drawSeek()`** (375–390): the as-the-crow-flies straight line from→to
  *draws itself on* (SVG mask + `strokeDashoffset` sweep, 950 ms, delay 430 ms)
  then **keeps marching** — `.cmp-seek { stroke-dasharray:1.5 7; animation:
  cmp-march .9s linear infinite }` (`@keyframes cmp-march { to {
  stroke-dashoffset:-17 } }`). This is the "searching paths" shimmer — and it
  is honest: it's the actual OD pair, marching while an actual POST runs.
- **`choreograph()`** (593–640): contenders trace on via `strokeDashoffset`
  (760 ms, staggered 420 ms, ≤3 shown, recommended last); cards land in
  sequence, each dose **counts up** from 0 (`S.countUp`), lo–hi band bar
  scales in, ETA/felt lines follow.
- **`settle()` + `drawWinner()`** (642–695): contenders fade, the winner
  reveals from→to through a mask stroke (`clamp(380 + len·1.1, 520, 980)` ms),
  previous winner fades out; a **bubble** is placed on the route at the
  clearance-maximising spot (real ink-avoidance solver, `placeBubble` 696–752).
- Mid-beat tap jumps the choreography to its end (`choose(user)` finishes all
  WAAPI animations — "the tap wins").

### 1c. When/why it disappeared from view

No commit ever removed the animation from the webapp — `git log -p --follow
server/webapp/whereto.js` (all 19 commits) and the `map.js`/`journey.js`
histories contain **zero** route-draw animation: pickaxe sweeps for
`dash`, `stagger`, `reveal`, `trace`, `settle`, `chooser`, `CAND_`,
`stroke-dashoffset`, `requestAnimationFrame` across `server/webapp/` find only
skeleton/progress-bar CSS (`wtProg`, `wtPulse`, `wtIn`) and sheet
choreography (`motion.css`). `paintRoutes()` has painted every option
instantly in every committed version since `a1fd733d` (Oct 10).

The visible removal was a **surface swap**, Oct 10:

- `3e44ada3` "landing: live preview iframe now loads the real /app (was
  scripted sim) + 'open the app' link" — `server/landing.html` `simURL`
  `/static/sim/…` → `/app/` (currently `server/landing.html:1125`);
- `b035b6a4` — same swap for the edge landing (`web/edge/index.html:579`).

So the user-facing "choosing paths" disappeared the day the preview became
the real app. `/static/sim/index.html` is still served (`server/main.py:1870`
`/static/{asset:path}`, `x-frame-options: SAMEORIGIN` kept expressly for it)
but nothing links to it. If the user instead remembers this from the Android/
iOS app: on device it should still be there — `RouteTintSource` is mounted at
`App.tsx:350` on HEAD; a "gone on device" report would be a build/runtime
issue, not a code removal.

## 2. Current webapp loading/searching states (whereto.js, 1573 lines)

What the user sees between "both ends set" and routes painting today:

1. `finish()` → `afterBoth()` (whereto.js:766): if mode+vehicle are
   remembered → straight to `plan()`; else `showModes()` (a real step, not a
   stall), then the vehicle step, then `plan()`.
2. `plan()` (903–932): `S.planning = true`; `clearMapExtras()` +
   `A.map.hideAllRoutes()` + `pinEnds()` — **the map shows two endpoint pins
   and nothing else moving**. The sheet (half height, `.wt-half`) renders
   `renderPlan()`'s planning branch (1208–1213):
   - `.wt-prog` — a 2 px **indeterminate** barber-pole bar
     (`@keyframes wtProg`, 1.05 s translateX loop, `whereto.css:107–109`);
   - `.wt-pstat` — "finding the cleanest ways there…" (`checkingRoutes`);
   - `.wt-skel wt-skc` — two pulsing skeleton cards (`wtPulse`).
   One `A.api.post('/v2/plan', {from,to,mode,vehicle,vehicle_profile},
   45000)` — plain JSON fetch, no streaming, no progress events
   (`app.js:29–40`). `S.guard`-style slow-path exists for *search* only
   (15 s, line 693); **plan has no slow-hint** — a 30 s CP→Pataudi plan just
   pulses skeletons.
3. Response lands → `buildView()` (collapse + group) → `renderPlan()` +
   `paintRoutes()` (1345–1384): every shown option's geometry is committed at
   once (`A.map.showRoute('wt{i}', g, null)` — `null` segments, flat paint is
   deliberate per the owner's air-gate law), picked = forest on paper casing,
   others quiet hairline, then `A.map.fit`. **Lines pop in fully formed; the
   only "motion" is the map camera's fit flight.**

So: spinner-equivalents exist in the sheet (honest copy, fake progress bar),
and **the map — the surface that owns this animation everywhere else —
is dead air during the entire fetch.**

The honest primitives already exist server-side and on Mobile:
`POST /v2/plan {fast:true}` returns least-inhalation engine rows in ~0.5 s
(`resp.partial = true`, `plan.py:2407 _engine_first`); the full set follows at
its own pace (Mobile fires both concurrently, `useShellFlow.ts:460–502`, and
even survives a degraded engine arm by keeping the painted engine rows).
`resp.degraded` + `resp.field.age_s` + `resp.took_ms` are all on the wire.

## 3. Route-card audit — why they feel cheap/samey

Current card (`optionCard`, whereto.js:1142–1204): vehicle well-glyph · mode
badge on the pick only · one lead metric (air | petrol | time per mode) ·
secondary metrics row · `vsLine` trade-off (pick only) · `why` (modes-engine,
≤8 words) · grey meta `"{label-base} · {km} · via {streets}"`. Honest
numbers, uniform rhythm — every card reads as the same card with different
digits. Three concrete causes:

1. **The same polyline literally backs most cards.** `plan.py
   _motorized_options` (OSRM path, 1057–1093) emits car / car_open / bike /
   auto / bus rows **all sharing `rt["geometry"]`**; under AWS, car_open /
   auto / bus still share `car_rts[0]`'s geometry (956–990). Distinct
   corridors exist only for `· alt N` router alts, `alive_core-path`
   least-smoke engine rows, slow modes, and transit. `buildView`/`collapse`
   dedupes by *numbers* (dose/eta/fuel `nearSame`), never by geometry;
   `paintRoutes` paints each card's geometry as its own `route-wt{i}` source,
   so identical lines stack invisibly — N cards, 1 visible line. That is the
   "same route on all cards" complaint, verbatim.
2. **Label qualifiers are dropped.** `baseLabel` (1014) truncates at `" · "`,
   so "Car (AC) · least-smoke alt 1" and "Car (AC) · alt 2" both display as
   **"Car (AC)"** — same-mode alternatives are name-indistinguishable.
   (The parity fix `c14730e8` had translated qualifiers to "· least smoky
   option {n}" / "· alt {n}"; `69495bd4` removed the translator when it
   rewrote the card — wire strings no longer leak, they just vanish.)
3. **The differentiators were deleted on purpose.** `69495bd4` (Oct 11
   release) replaced the pixel-twin card — a near-verbatim CompareSheet port
   (`f48114ea`, still in history) that rendered `o.delta` headline ("−38 %
   air · +6 min — worth it for your commute" / "take the fast one"),
   `safest_path` leaf chip, `o.tag` chips ("lightest for you" / "lightest for
   Delhi" / "lightest on both"), `o.reason_line`, the felt-gap line ("~2.4×
   more inhaled than metro"), dose lo–hi band, inhaled-vs-worst dose bar,
   coverage note, and a per-card "how we got this" detail block — with the
   current simple card. `docs/lanes/whereto-oct11.md:68–71` lists the
   deletion as deliberate ("Cards are simple"), and honestly notes the
   consequence: "the collapse often leaves ONE card … alternatives reappear
   when live traffic makes them faster". The fields were not removed from the
   wire — Mobile still renders every one of them (`CompareSheet.tsx:540–673`,
   `deltaLine` 423–490). The cheapness is an information deficit, not a style
   problem.

## 4. Restore vs redesign — recommendation for both engines

**Port the Mobile chooser; do not try to "restore" web code (none exists)
and do not clone the sim's SVG approach** (the sim draws on its own canvas
projection, not the real map). The RN beat's mechanics translate directly:

**MapLibre GL 4.7.1 (primary engine):**
- Keep the existing per-option `route-wt{i}` sources, but feed each a
  FeatureCollection of chunked slices (or grow one LineString by coordinate
  slice) with per-feature `op`, and set `line-opacity:
  ['coalesce',['get','op'],0]` — the exact RN data-driven mechanism. Each
  timed step = one `setData` (cheap re-parse of a few dozen coords; keep
  `CAND_GROUPS = 8` and the same stagger math — the Mobile perf commit exists
  precisely because bridge-commits are costly; GL setData is cheaper but the
  cadence is the design, don't inflate it).
- Endpoint "frame" rings and the verdict pill are `maplibregl.Marker` divs +
  CSS — the webapp's `pin()` already does exactly this shape (`map.js:793`),
  and `wt-endpin` pins exist. A `.wt-ring` keyframe + a `.wt-verdict` pill
  element is all CSS.
- A cleaner GL-native alternative for the winner's re-trace: `lineMetrics:
  true` on the geojson source + a `line-gradient` whose transparent cutoff is
  advanced per frame via `setPaintProperty` (no re-parse, smoothest sweep).
  Works in 4.7.1; use it only for the settle sweep if chunked setData
  profiling disappoints — the chunked port is otherwise the faithful one.
- Marching-ants in GL has no `line-dash-offset` paint property; don't fake it
  per-frame. For the in-flight "seek" state use the frame rings + a single
  thin straight LineString from→to drawing on once (progressive setData) —
  honest, cheap, engine-agnostic.

**Leaflet raster fallback (basic mode):**
- `leafShowRoute` (`map.js:239`) already builds `L.polyline`s in a layer
  group. Port the beat as: staged `setLatLngs(coords.slice(0,k))` + `setStyle
  ({opacity})` on the same timer cadence — or SVG-native `stroke-dasharray`/
  `dashoffset` on `polyline._path` (stable-enough private handle; the sim's
  `cmp-march` keyframes are literally this trick). Real marching-ants are
  free here via CSS on the path element, so the seek line can be the full
  sim version in basic mode.
- Frame rings/pill: `L.divIcon` markers (same as `leafPin`), CSS identical.

**Shared contract (port faithfully):** act order frame→ways→hold→settle;
max 3 contenders, winner last; equal contender opacity; verdict pill from a
`chooserVerdict` port (recompute claims from the served numbers — no
invented copy); interruptible (hang beat timers on `S.pseq` — the staleness
counter already exists); `matchMedia('(prefers-reduced-motion: reduce)')` in
JS → paint final state instantly (the app.css media blanket kills CSS anims
but not timer-driven `setData`); beat starts on `A.map.ready` + a sheet-mount
grace (~350 ms covers `wtIn`). Flat paint stays — alternates quiet ink,
winner forest; the beat never introduces band colours (air-gate law holds in
both twins).

Effort: ~150–200 lines in `whereto.js` + a small engine branch in `map.js`
(both route paths already exist); zero server work.

## 5. Loading-state design — honest "routing in progress"

Real milestones exist; drive the visuals off them, not a timer:

1. **Seek (t = 0 → engine rows land):** pins drop (already happens), frame
   rings pulse once on each end, the straight from→to connector draws on and
   marches (Leaflet: CSS ants; GL: draw-on then hold + end-pin pulse). Sheet
   keeps `wt-pstat` but graduates the copy: "asking the engine for the
   cleanest corridors…" → after ~9 s "long trips take the field a little
   longer" (the sim's exact honest pattern, incl. live elapsed s). Kill the
   barber-pole `.wt-prog` or keep it *strictly* as an "in flight" glyph — it
   must not imply measurable progress.
2. **Engine rows land (~0.5 s typical):** real options exist → the way-trace
   act plays *on the real engine geometries* (these are the least-smoke
   corridors — the product), cards render with real numbers, a "still
   checking the other ways…" line reflects `partial:true`/`refining`. This is
   the payoff: the animation IS the first fetch completing.
3. **Full plan lands:** new option-set identity → settle act (winner bold
   re-trace + verdict pill) and cards refresh in place (Mobile precedent:
   strip arrivals recolour in place, never rewind the reveal). If only the
   engine rows existed, no rewind — mark the state complete.
4. **Honesty guards already on the wire:** `degraded` → the existing
   "a few routes timed out — showing what we have" notice; `field.age_s` →
   "air map N min old" chip (the sim already composes "N live station
   readings · air map M min old" from `/v2/city`); `took_ms` → "K ways priced
   in X s" header line (sim `cmp-head`).

If the two-phase fetch is too big a bite for a first cut, the minimal honest
version is: seek line + rings while the single 45 s POST is in flight
(stop when data lands — the motion's duration is literally the fetch), then
the full frame→ways→settle beat on arrival. That alone restores the remembered
feel; `fast:true` is what makes it *fast*.

## 6. Card polish proposal — minimal real fixes

Substance first (all fields already on the wire; every one is rendered by
Mobile today):

1. **Restore the deleted differentiators** — `o.tag`/`safest_path` chips,
   `o.delta` headline (port `deltaLine`, ~70 lines incl. string keys — the
   f48114ea version is in git to crib), `o.reason_line`, the felt-gap line.
   These are the only places a card can say *why it is different* — which is
   the complaint.
2. **Re-show label qualifiers** — revive the `c14730e8` translator
   ("· least smoky way", "· least smoky option {n}", "· alt {n}") so two
   car-family rows aren't both "Car (AC)". One regex block, strings already
   exist in Mobile's table.
3. **Distinct route thumbnail in `.wt-well`** — project each option's own
   geometry into the 44 px well as a mini SVG stroke (the sim's
   `project()`/`toPath` are ~40 lines of prior art). Real data, zero network:
   same-road rows honestly render identical thumbnails (which *is* the truth
   — "same corridor, different ride"), while engine alts and transit get
   visibly different shapes.
4. **Card↔map coupling** — hover/focus (and press-hold on touch) lifts that
   card's `route-wt{i}` line to contender opacity/width (one
   `setPaintProperty` pair; Leaflet `setStyle`), restoring on blur. In
   `paintRoutes`, dedupe by geometry (sim's `geomKey` pattern: length +
   first/mid/last coord) so identical polylines aren't stacked as N invisible
   layers — same-geometry cards share the one line they truly share.
5. Keep the flat-paint law and the simple chrome — the Oct-11 lane's instinct
   (Uber-simple card) is fine; what failed is that *identical* simple cards
   carried no distinguishing truth. Fix the content, not the furniture.

## Evidence index

- Live chooser: `Mobile/src/components/RouteTint.tsx` (header spec 31–69,
  clock 148–180, beat 402–599); helpers `Mobile/src/map/routeTint.ts`
  (`candidatesFor`, `chooserVerdict`, `collectionsFor`); mount `App.tsx:350`;
  two-phase fetch `useShellFlow.ts:456–502`, `api/plan.ts:242–252`.
- Scripted-sim twin: `server/static/sim/screens/compare.js` ≡
  `web/edge/static/sim/screens/compare.js` (seek 375–390, choreograph
  592–640, winner 653–695, bubble 696–752); still served via
  `server/main.py:1870` `/static/{asset}`; unlinked since `3e44ada3`,
  `b035b6a4` (Oct 10).
- Webapp today: loading `whereto.js:1205–1213` + `whereto.css:107–120`;
  instant paint `whereto.js:1345–1384`, `map.js:686–713` (GL) /
  `map.js:239–257` (Leaflet); no anim in any of 19 committed versions.
- Deleted rich card: `f48114ea` version (in git history) vs
  `69495bd4` rewrite + rationale `docs/lanes/whereto-oct11.md:49–77,141–148`;
  qualifier translator added `c14730e8`, removed `69495bd4`.
- Wire fields unused by the webapp today: `tag`, `safest_path`, `delta`,
  `reason_line`, `segments`, `degraded`, `took_ms`, `field.*` — vs Mobile
  `CompareSheet.tsx:423–490,540–673`, `plan.py:1255–1430`.
- Same-geometry proof: `server/v2/plan.py:1057–1093` (OSRM shared geometry),
  `946–1008` (AWS: car_open/auto/bus share car_rts[0]); webapp stacks them
  blindly at `whereto.js:1353–1374`.
