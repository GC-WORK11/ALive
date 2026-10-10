# launch v22 — copy kit for the scroll-film site

Post, thread, replies and voiceover for the v22 landing ("the film":
`server/landing.html`, working tree) and the live preview of the app it
carries (`/tmp/sim-contract.md`, being built in `server/static/sim/`).
Written against `docs/judges/film-copy.md` (page copy + voice),
`docs/judges/x-post-thread.md` and the earlier `docs/plan/x-posts.md` /
`docs/plan/launch-kit.md` (prior launch voice; there is no
`launch-tonight.md`), the production data contract
(`/tmp/audit/DATA-CONTRACT.md` + its saved captures) and the owner's
law (`alive-consciousness/06-THE-LAW.md`).

**No copy block contains a literal number.** Every figure is a
`{placeholder}` the lead fills from a live read at post time (§5). The
only digits inside copy blocks are in the pollutant name `pm2.5`, the
unit `µg/m³` and the endpoint paths (`/v2/…`).

Voice used throughout: lowercase except the `A` in Alive · no exclamation marks ·
plain verbs, short · no hype, no wellness talk · neither of the two
banned product words (law §13) · nothing tells anyone to put their life
off (law §14) · `≈` kept on every equivalence · every live number
carries its age.

Lengths use X's weighting: a link counts 23, `≈ → ↓` count 2, everything
else used here counts 1. Every block fits ≤ 280 both ways: counted as
written (placeholder names at their literal length) and at worst-case
fill (table at the end of §3).

---

## 1 · the post

```text
Alive has a new site. delhi's air, rebuilt from {stations} government monitors every {refresh_min} min — now {pm25_now} µg/m³ pm2.5, {band}, map {age_min} min old. a day outside ≈ {cigarettes} cigarettes. scroll the film, then try the app's live preview: {url}
```

Attach the recorded landing film with the §4 voiceover. `{band}` is the
felt word and the cigarettes line is the reference (law §15). Keep both:
on a "satisfactory" day the cigarettes line is what tells a stranger
what the air costs.

---

## 2 · the thread

hook → the live field → the four jobs → try the live preview. The posts
carry no `1/4` numbering because that would be a literal number; the `↓`
marks the thread.

**post 1 · hook**

```text
the air is invisible. the dose isn't.

a day outside in delhi ≈ {cigarettes} cigarettes — read off a map {age_min} min old. nobody tells you that.

Alive counts it. the new site plays like a film you scroll.

↓
```

**post 2 · the live field**

```text
the field: {stations} government monitors across the ncr, wind-weighted — upwind counts more — rebuilt every {refresh_min} min into {cells} cells.

now {pm25_now} µg/m³ on average, {band}, map {age_min} min old. each cell carries its confidence; thin coverage stays marked thin.
```

If the `/grid` read fails, cut ` into {cells} cells` and the post still
reads. "upwind counts more" is the field's real weighting
(`server/airfield.py:60-62`, `:924-966`).

**post 3 · the four jobs** (the kickers are the film's own)

```text
crossing it — every way priced live, in µg you'd breathe. connaught place → igi: {car_ug} µg by car, ac on; {walk_ug} on foot — {ratio}× apart.
staying over — stays ranked by door-level air.
stepping out — the day's cleanest hours, named.
asking the map — tap a cell, it answers.
```

If the plan call fails or a §5 hold trips, swap the first line for this
one, which has no number:

```text
crossing it — every way across, priced in µg you'd breathe before you leave.
```

"by car, ac on" is the plan's own label (`Car (AC) · least-smoke rd`).
The car dose is the cabin figure, not the street. "stepping out" names
no clock hour on purpose (note 1 at the end).

**post 4 · try the live preview**

```text
try it with no install: the page runs a live preview of the app on the same field. pick where to, compare every way priced live, ride a simulated trip on the real route, get the receipt. it starts at connaught place and says so — no gps, no history.

{url}
```

Every claim here is a rule in the preview's contract: compare is the
real `POST /v2/plan`, the ride is simulated and labelled as such, the
origin is fixed and tagged "(preview)", there's no GPS, and the preview
keeps no history. Post only after hold 7 in §5 clears.

---

## 3 · replies

**is this real data?** (cites `/health`)

```text
yes. {stations} government monitors — cpcb and dpcc, via waqi's feed and dpcc's own pages — feed a field rebuilt every {refresh_min} min; this read is {age_min} min old. a public air model fills the gaps, and each cell says how sure it is. feeds, live: {url}/health
```

This matches `data-truth.md`: cpcb/dpcc instruments arrive through
waqi's republication and dpcc's own pages, and the cams model fills
between them. Name only the feeds `/health` reports as `ok` (hold 2).

**how accurate is it?** (cites `/v2/skill`)

```text
the forecast grades itself in public: an hour ahead it's off by {skill_mae_h1} µg/m³ on average, with the right air band in {skill_hit_h1}% of cells; the furthest hour out, off by {skill_mae_h11}. it's graded against its own record, and says so: {url}/v2/skill
```

If any row used reads `thin`:

```text
the forecast grades itself in public, against its own record. until it has enough graded hours, it prints “thin” instead of a score — no guessing: {url}/v2/skill
```

If they push on the live map:

```text
the live map isn't scored on a public endpoint — each cell carries its confidence instead, and thin coverage is marked thin. the forecast score grows by the hour: {hours_graded} hours graded so far.
```

The wording follows from what `/v2/skill` is: it grades each served
forecast against the field the API later recorded. It is self-graded,
not checked against held-out monitors (note 2). It's the only public
score, so the reply says exactly that and shows the far hour as
honestly as the near one.

**where's the app?** (two versions; post the one that's true)

No public build link:

```text
not in the stores. android exists as a demo build with no public link, and ios isn't out. what you can use today: the live preview on the page — the app's screens in your browser, on the same live field: {url}
```

A public build link exists and has been tested in an incognito window.
Use it in replies only; the landing carries no download link (law §22):

```text
android, as a sideload demo build — not in the play store, so play protect will warn: {apk_url} · ios isn't out. or tap through the live preview on the page, no install: {url}
```

**what about privacy?** (follows the code, not PRIVACY.md; see note 3)

```text
no account, no name. the app asks up front whether to share trips — skip, and no trip leaves the phone. a shared trip loses its start and end; a street only shows in city totals after {k_min} different phones cross it. pricing a route sends its from and to; neither is logged.
```

If they push:

```text
a gap, said plainly: the connection is plain http for now. a shared trip travels unencrypted — ends already trimmed — before the server folds it into anonymous cells.
```

Sources:
- the consent screen: skip lands sharing off (`OnboardingScreen.tsx:18-29`, `:163-169`)
- the app's own strings: `consent_*`, `onb_phoneBody` ("shared trips lose both ends before they count")
- `PRIVACY.md`'s transform chain (trim, thin, round, cell, hash) and log denylist
- the client pre-trim (`TRAJ_TRIM_M`)

Drop the follow-up once the page and API are on https.

**why delhi?** (cites `/v2/why`)

```text
because delhi's air is a daily cost nobody prints, and the city has public monitors to rebuild it from — {stations} reporting, map {age_min} min old. delhi ncr only; outside it, the app says so instead of guessing. why the air is like this right now: {url}/v2/why
```

A second reply, quoting the live line:

```text
right now {url}/v2/why says: “{why_line}” — updated {why_age_min} min ago.
```

`line` is pasted verbatim. The story isn't real-time: its age is pinned
to the fire feed (contract flag 5), so `{why_age_min}` always goes with
it. "outside it, the app says so" is the plan's `outside_service_area`
answer.

**lengths** (X-weighted, as written / worst-case fill)

| block | as written | worst fill |
|---|---|---|
| the post | 279 | 248 |
| hook | 212 | 204 |
| the live field | 278 | 253 |
| the four jobs | 280 | 267 |
| try the live preview | 274 | 274 |
| real data | 276 | 258 |
| accuracy · thin · push | 269 · 170 · 198 | 237 · 170 · 188 |
| app · no link · link | 227 · 207 | 227 · 207 |
| privacy · push | 276 · 166 | 271 · 166 |
| why delhi · live line | 274 · 85 | 267 · 75 + the line |

---

## 4 · voiceover: 30 s, seven beats

The recorded film is a scroll capture of the v22 page, and the voice
rides its seven beats. Read it flat and close, with no announcer lift.
It runs to about 62 written words, roughly 68 once the numbers are
spoken, which is about 136 words a minute with room between beats.
Cue times and beat names are direction only; they are never spoken or
posted.

| beat · page label | cue | voice | on screen |
|---|---|---|---|
| the air is invisible · `01 · the air` | 0:00–0:04 | the air over delhi is invisible. the dose isn't. | hero settles into beat 1 |
| the field · `02 · the field` | 0:04–0:09 | Alive rebuilds it live — {stations} government monitors, every {refresh_min} minutes. | beat 2 stat line: monitors · cells · age |
| crossing it · `03 · the trip` | 0:09–0:15 | same trip: {car_ug} micrograms by car, ac on. {walk_ug} on foot. | beat 3 trip line, priced live |
| staying over · `04 · the stay` | 0:15–0:18.5 | stays, ranked by the air at the door. | beat 4 |
| stepping out · `05 · the hour` | 0:18.5–0:21.5 | the day's cleanest hours, named. | beat 5 stat line |
| asking the map · `06 · the ask` | 0:21.5–0:26 | tap anywhere. the field answers — and says how sure it is. | beat 6 (optional insert: a tap on the live field below, readout showing) |
| delhi's air, counted · `07 · alive` | 0:26–0:30 | the field is running now. Alive — delhi's air, counted. | beat 7, then the end card |

Supers (burned in, mono, lowercase):

- lower third, 0:04–0:15: `live reads · {read_time_ist} ist · {read_date}`
- end card from 0:28: `Alive · {url}`

Fill and speech rules:

- A recording freezes its numbers. The read-time super keeps them
  honest, and the post carrying the film links the live page.
- Fill the voice from the same reads the capture shows, so the voice
  never says a number the frame contradicts. The page's beat-3 line
  prints the lightest and heaviest of all modes
  (`landing.html:606-608`). If those aren't car and foot in the
  capture, say the modes on screen.
- Say numbers the way the page prints them. `µg` is spoken
  "micrograms". No concentration (µg/m³) figure is spoken.

---

## 5 · placeholders → live fields

Fill everything in one pass, from reads taken inside the same field
rebuild. If `field.built_at` changes mid-pass, re-read. The endpoint
links in the copy assume `{url}` is the origin that serves both the
page and the API. That holds for v22: the API box serves it at `/` and
all its fetches are relative.

**numbers**

| placeholder | read: endpoint → field path | fill as | used in |
|---|---|---|---|
| `{pm25_now}` | `GET /v2/city` → `pm25_stats.mean` | one decimal, as the hero prints it | post · live field |
| `{band}` | `GET /v2/city` → `grap.aqi`, matched in `GET /v2/districts` → `bands[]` (`min` ≤ aqi ≤ `max` → `category`) | lowercase; the same band the hero derives from `pm25_stats.mean` (cpcb, indian scale) | post · live field |
| `{age_min}` | `GET /v2/city` → `freshness.age_min` | whole minutes; write `1` when it reads ≤ 1 (the page's rule) | post · hook · live field · real data · why delhi |
| `{cigarettes}` | `GET /v2/city` → `breath.cigarettes.mid` | one decimal; the `≈` stays | post · hook |
| `{stations}` | `GET /v2/city` → `sources.stations.count` (agrees with `provenance.stations.count` and `field.station_readings`) | whole number | post · live field · real data · why delhi · voice |
| `{refresh_min}` | `GET /v2/city` → `field.refresh_ttl_s` ÷ 60 | whole number | post · live field · real data · voice |
| `{cells}` | `GET /grid?cells=34&param=pm2_5` → count of `features[]` with non-null `properties.pm25` | en-IN thousands comma, as the page prints it | live field |
| `{car_ug}` | `POST /v2/plan` (body below) → `options[]` where `mode` is `"car"` (label `Car (AC) · …`) → `dose.mid` | < 10 → one decimal, else whole (the page's `fmt`) | four jobs · voice |
| `{walk_ug}` | same response → `options[]` where `mode` is `"walk"` → `dose.mid` | same rule | four jobs · voice |
| `{ratio}` | computed: walk `dose.mid` ÷ car `dose.mid`, from unrounded values | ≥ 10 → whole, else one decimal (the page's rule) | four jobs |
| `{skill_mae_h1}` | `GET /v2/skill` → `horizons[]` where `h` is `1` → `mae_ug` | as served (µg/m³) | accuracy |
| `{skill_hit_h1}` | same row → `band_hit_pct` | whole number | accuracy |
| `{skill_mae_h11}` | `GET /v2/skill` → `horizons[]` where `h` is `11` → `mae_ug` | as served | accuracy |
| `{hours_graded}` | `GET /v2/skill` → `coverage.hours_graded` | whole number | accuracy · push |
| `{k_min}` | `GET /v2/city` → `provenance.trips.k_min`. This field is in the contract's saved capture (`v2-city.json`) but not its table, which only notes the trips privacy floor | whole number | privacy |
| `{why_age_min}` | `GET /v2/why` → `story_age_s` ÷ 60 | whole minutes | why delhi · live line |

**text and links**

| placeholder | read | fill as | used in |
|---|---|---|---|
| `{why_line}` | `GET /v2/why` → `line` | verbatim (it's already lowercase) | why delhi · live line |
| `{read_time_ist}` · `{read_date}` | `GET /v2/city` → `ts` (epoch seconds, UTC) → Asia/Kolkata | 12-hour clock, lowercase am/pm · day and month, lowercase | voiceover supers |
| `{url}` | the live landing origin | — | post · preview · replies · end card |
| `{apk_url}` | a public build link, tested in an incognito window; only if one exists | — | app · link |

The plan call is the page's own demo pair (`landing.html:592`). Prod
accepts no POST except this one (law §25):

```text
POST /v2/plan
{"from":{"lat":28.6315,"lon":77.2167},"to":{"lat":28.5562,"lon":77.1000},"fast":true}
```

**hold rules.** A failed check holds only the block that depends on
it, not the whole kit.

1. **Fresh field or nothing.** `GET /health` must show `ok: true` and
   `field_stale: false`. `GET /v2/city` must show `freshness.label` =
   `"live"` and `field.stale` = `false`. If `age_min` runs past two
   rebuilds (`2 × field.refresh_ttl_s ÷ 60`), hold every block: the
   page prints its own age and would contradict the post.
2. **Stations.** `sources.stations.up` must be `true`. The "real data"
   reply names both feeds, so post it as written only if `GET /health`
   → `sources.stations.feeds` reads `ok` for both `waqi` and `dpcc`.
   Otherwise name only the feed that's up.
3. **The trip.**
   - Must hold: no top-level `code` or `error`; `degraded[]` empty or
     absent; car and walk rows both present; neither row has
     `reaches_destination` or `starts_at_origin` = `false`.
   - Not a blocker: `partial: true`, which is normal for `fast: true`
     (engine rows first, `server/v2/plan.py:2278-2280`).
   - On failure, use the no-number first line in "four jobs".
4. **The page's trip line.** It prints the lightest and heaviest of all
   modes. If those aren't car and foot at post time, either word "four
   jobs" to the modes the page shows or use the no-number line.
5. **Skill.** The top-level `status` and both horizon rows must read
   `"ok"`. If anything reads `"thin"`, post the thin reply. Never post a
   score from a thin bucket.
6. **Why.** Post the quoted line only if `cannot_tell[]` is empty, and
   always with `{why_age_min}`.
7. **The preview.** Post 4 and both app replies point at the in-page
   preview. Post them only once it loads on prod and its compare
   screen prices a trip. If a screen post 4 names didn't ship, cut that
   verb.
8. **Plain http.** Drop the privacy follow-up the day the page and API
   move to https.
9. **Recount after filling.** Worst-case fill was checked, so nothing
   should move, but a long `{why_line}` can push the live-line reply.

---

## notes for the lead: traps found while mapping

1. **`next_hours[].start` is UTC-naive, not IST.**
   - Contract flag 14 says it's IST-naive, but the code parses those
     slots as UTC (`server/forecast.py:146`, `:302-306`).
   - The saved capture agrees: taken at 22:28 IST, its `h: 0` slot
     reads `…T16:00`, which is 21:30 IST.
   - The preview's hours screen says the same (`static/sim/screens/hours.js:63`).
   - Anyone naming a clock hour from `next_hours` or `/depart` slots
     must add 5:30. This kit names no clock hour for that reason.
2. **`/v2/skill` is self-graded.**
   - It scores each served forecast against the field the API later
     recorded (`server/skill.py:1-35`, `:275-279`), not against
     held-out monitors. Never call it accuracy against monitors.
   - The field-vs-monitor validation is admin-only
     (`server/admin_agg.py:792`).
   - HANDOVER.md still flags the hero's "95.2%" claim as unreconciled.
     Keep it out of posts.
3. **PRIVACY.md is stale on the sharing default.**
   - Line 5 says sharing is "on by default".
   - The app asks up front and a skip lands off: commit `ee9f51e`,
     `OnboardingScreen.tsx:163-169`, verified on device per
     HANDOVER.md.
   - The privacy reply follows the code. PRIVACY.md is untouched here
     and needs that line fixed by whoever owns it.
4. **The page hardcodes figures the wire carries.**
   - "every 15 minutes" (`landing.html:392`, `:394`)
   - "the next 12 hours" (`:414`, `:471`)
   - "seven days" (`:479`)
   - "car, metro, bike, foot" (`:400`, `:463`), although the CP → IGI
     plan returns car, bike, auto, cycle and walk, with no metro.
   - The copy here avoids all of these.
5. **The preview was mid-build at write time.**
   - Present in `server/static/sim/`: `index.html`, `shell.js` and the
     home, search, stays, hours and map screens.
   - Missing: compare, nav, receipt and settings.
   - Post 4 names compare, the ride and the receipt, so hold 7 applies.
