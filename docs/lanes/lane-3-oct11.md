# Lane 3 — Modes: the three cards must differ honestly

**Root cause (verified live, not guessed).** Presentation, not plumbing.
The browser already POSTs the right `mode` per card, and the live backend
already returns a distinct `mode_pick`, ordering and `why` per mode
(CP→Cyber Hub: petrol picked "Car (AC) · least-smoke rd", the others
picked the main road). But every card led with `NN min · arrive` +
µg + litres in the same layout, and 1-decimal fuel/integer-µg rounding
hid the small real differences — so all three cards read the same.

**Files changed**

- `server/webapp/whereto.js` — every card leads with its mode's metric
  (Health Maxer µg breathed · Petrol + Health litres · Time + Health live
  minutes); pick card carries a real-number trade-off line vs the other
  modes' picks from the new `mode_picks` block; rows that are another
  mode's pick get a muted "the fastest/cleanest/petrol pick" tag; modes
  screen annotates each fetched mode card with its pick's numbers;
  dose/fuel leads keep enough precision that a real 0.07 L / 0.6 µg win
  can't round away; "other ways" sorted by the mode's own key.
- `server/webapp/whereto.css` — layout for the lead row, rest line,
  vs-line and pick tags; separator attached to its item (no wrap orphans).
- `server/v2/modes_engine.py` — pick logic refactored into `_pool_ctx` +
  `_pick_for` (no mutation); `apply()` now computes all three modes'
  picks on the same pool and returns `mode_picks` briefs + `one_pick`;
  a pick that wins all three says "the same road wins every way" instead
  of a per-mode claim; 1.15x guard, near-tie rules, fuel_saved untouched.
- `server/tests/test_modes_oct11.py` — +3 tests: response carries every
  mode's pick from the same pool (recomputed, not trusted), one_pick
  honesty wording, briefs through `apply()`.

**Candidate generation.** OSRM alternatives were already wired for mode
plans (`want_alts` when a `mode` is sent → "· alt N" rows) and the
least-smoke engine arm already emits "· least-smoke rd" rows on prod —
verified in live responses. Nothing invented: with one road per family
the card list is honestly short and says the one road won all three.

**Verification**

- `pytest tests/test_modes_oct11.py` — 25 passed.
- `node --check whereto.js` + `scripts/check_inline_scripts.py` — clean.
- Headless Chrome rig (390×844, seeded GPS) on local uvicorn: per-mode
  request bodies verified distinct; after-shots show different leads per
  mode. Before (live) / after (local) for CP→Cyber Hub, Saket→CP,
  Dwarka→IGI T3 — see lane3/shots PNGs attached to the integrator msg.
- `/v2/plan` response on local: `mode_picks` + `one_pick` present.

**Gaps / notes for the integrator**

- `mode_picks` rides on `/v2/plan` and `/v2/reroute` automatically via
  the mode_block echo; no other files needed edits.
- Live traffic still needs the provider keys in env — unchanged.
