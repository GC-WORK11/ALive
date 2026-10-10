# film copy — the scroll-film landing page

Microcopy sheet for the scroll-film version of the landing page.
Written against the verified-numbers list only — nothing below claims
anything a number can't carry. Re-check live figures before paste:
`python3 scripts/research/freshness_probe.py`.

Voice rules this sheet already follows: lowercase everywhere except the
`A` in Alive · no exclamation marks · plain verbs · ~8 words max per
headline, ~14 per subline · `µg`, `pm2.5`, `≈` as written · English
only on the page (hindi stays in-app).

Numbers cleared for use: **54 government monitors** · **rebuilt every
15 minutes** · **wind-weighted — upwind counts more** · **1,156 field
cells** · **10 µg by car vs 360 µg on foot, same trip** · **stays
ranked by door-level air** · **12-hour forward surface** · **a day
outside ≈ 2.7 cigarettes** (the live page computes it).

---

## 1 · hero

**wordmark treatment** — two options:

- **a — the live dot.** `Alive` in the page serif, lowercase after the
  A, followed by a small square dot. the dot pulses once per field
  refresh — it is the live indicator, not decoration.
- **b — the boot spell.** `Alive` spelled letter by letter over the
  haze plate (a · l · i · v · e), then the dot lands and stays lit
  while the field is fresh.

**promise line** — two options:

- a) `delhi's air, priced by the breath.`
- b) `what you actually breathe, counted.`

**subline** — two options:

- a) `the live pm2.5 field over delhi — 54 monitors, rebuilt every 15 minutes.`
- b) `54 government monitors, wind-weighted — then priced per breath.`

---

## 2 · film beats

Six beats, in scroll order. each carries a kicker (2–3 words, mono),
a headline, a subline, and a mono stat line where the numbers earn it.

### beat 1 — the air is invisible

- kicker: `breathing anyway`
- headline: `the air is invisible. the dose isn't.`
- subline: `a day outside ≈ 2.7 cigarettes — nobody tells you that.`
- mono stat: `pm2.5 · the ncr mean · recomputed live`

### beat 2 — we rebuilt it as a live field

- kicker: `the field`
- headline: `delhi's air, rebuilt every 15 minutes.`
- subline: `54 government monitors, wind-weighted — what's upwind counts more.`
- mono stat: `54 monitors · 15-min rebuild · 1,156 cells`

### beat 3 — the field prices a trip

- kicker: `crossing it`
- headline: `the cleanest way across — priced by breath.`
- subline: `car, metro, bike, foot — same trip: 10 µg sealed vs 360 on foot.`
- mono stat: `10 µg by car · 360 µg on foot · same trip`

### beat 4 — the field prices a stay

- kicker: `staying over`
- headline: `stays ranked by the air at the door.`
- subline: `same stars, same street — the address decides the dose.`
- mono stat: `door-level air · not distance, not stars`

### beat 5 — the field names an hour

- kicker: `stepping out`
- headline: `the day's cleanest hours, named.`
- subline: `the next 12 hours, hour by hour — go when the field dips.`
- mono stat: `12-hour forward surface · hourly`

### beat 6 — the field answers a tap

- kicker: `asking the map`
- headline: `tap anywhere. the field answers.`
- subline: `every cell reads its own number — confidence carried with it.`
- mono stat: `any cell · its number, and its band`

---

## 3 · dark section — the app, running

**intro line:** `the app — six surfaces, one field.`

**feature captions** — name + one line each:

| screen | name | caption |
|---|---|---|
| route compare | `route compare` | `car, metro, bike, foot — each priced in µg before you leave.` |
| stays | `stays` | `nearby stays, ranked by the air at each door.` |
| when-to-go-out curve | `when to go out` | `the next 12 hours on one curve — the cleanest window marked.` |
| live nav | `live nav` | `the dose ticks as you move; the receipt lands in µg.` |
| week / dose | `the week` | `seven days of what you breathed — kept on this phone.` |
| settings / share off | `sharing: off` | `one switch — off means nothing leaves the phone.` |

---

## 4 · footer

- closing line: `what you breathed — and what you didn't.`
- evidence links label: `the evidence` — followed by the link row:
  `live field · health · validation · privacy`

---

## 5 · alt text — every visual

Alts describe the literal shot — what a screen reader needs to know is
on screen, nothing more. If a frame changes, change the noun, keep the
function.

| # | visual | alt text |
|---|---|---|
| 1 | hero haze plate + wordmark | `morning haze over delhi — the air before it is counted. the word Alive on it.` |
| 2 | beat 1 — the invisible street | `an ordinary delhi street in daylight — nothing visible in the air.` |
| 3 | beat 2 — the live field map | `the live pm2.5 field over delhi ncr: 1,156 cells coloured by air band, 54 monitor dots.` |
| 4 | beat 3 — route compare | `the route picker: car, metro, bike and foot for one trip, each priced in µg inhaled.` |
| 5 | beat 4 — stays list | `a list of stays, each ranked by the pm2.5 at its door.` |
| 6 | beat 5 — the day curve | `the next 12 hours as hourly bars — the cleanest window marked.` |
| 7 | beat 6 — tap a cell | `the live field with one cell selected — its pm2.5 reading and its error band.` |
| 8 | dark — route compare screen | `app screen: four ways across the city for one trip, priced in µg inhaled.` |
| 9 | dark — stays screen | `app screen: stays near a chosen area, ranked by door-level air.` |
| 10 | dark — go-out curve screen | `app screen: the next 12 hours of pm2.5 as a curve, cleanest window marked.` |
| 11 | dark — live nav screen | `app screen: turn-by-turn navigation with the inhaled dose ticking up.` |
| 12 | dark — week/dose screen | `app screen: the week's trips and their doses, stored on the phone.` |
| 13 | dark — settings/share-off screen | `app screen: the sharing switch set to off.` |
| 14 | footer ghost wordmark | decorative — `aria-hidden="true"`, no alt. |

---

## paste notes

- `Alive` takes a capital A; everything else lowercase, including at
  the start of sentences.
- the `≈` in `≈ 2.7 cigarettes` is load-bearing — never drop the hedge
  on an equivalence.
- if a monitor count or a figure drifts at ship time, take the live
  number — the copy's whole claim is that the numbers are read, not
  written.
