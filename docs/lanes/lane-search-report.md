# Lane: search — composer API additions (search.js only)

Files changed: `server/webapp/search.js` only. Callers (airmap.js,
whereto.js) untouched — every addition below is opt-in and existing
call signatures/behavior are unchanged (verified in-browser).

## API additions for consumers

### 1. `myLoc` hint rows through `A.search.live` — opt-in
```js
const cancel = A.search.live(q, bias, onRows, { myLoc: true, locLabel?: string });
```
For **empty/short queries (<2 chars)** — the case callers currently
don't call `live()` for — the composer contract now answers a maps-style
hint: the cached fix paints immediately (`final:false`, stage `'myloc'`),
a real `A.geo.locate()` refines it, and `final:true` arrives exactly once
(≤ ~6 s hard bound via `within()`; cancelled calls send nothing, as usual).

The row is a **normal row** — `{name:'My location', sub:'gps · ±Nm',
kind:'myloc', rawKind:'myloc', lat, lon, dist, source:'geolocation',
key, loc:true}` — so a caller can hand it straight to its existing
pick path (`scPick`/`pickRow`-equivalents) with zero special-casing.
`loc:true` / `kind:'myloc'` is the flag for a pin/target glyph.
`locLabel` lets a caller pass its translated label (e.g. `t('yourLocation')`).

Without `myLoc`, short queries behave exactly as before: `[](final)`,
stage `'short'` — verified.

### 2. `A.search.myLocation(opts?) → Promise<row|null>`
Same row, standalone — for callers that render their own hint lists
(whereto's armed-row sections, airmap's recents block):
```js
const row = await A.search.myLocation({ maxAgeMs, goodM, waitMs, label, bias });
```
Cached `A.geo.pos` wins while fresh (≤ maxAgeMs, default 120 s — the same
staleness bar app.js uses); otherwise a real `locate()` (default
`goodM:150, waitMs:4500`); a stale cached fix still answers if the fresh
one fails; `null` only when there is no fix at all.

### 3. `A.search.attach(input, opts?) → composer | null`
Drop-in maps-style composer for a plain text input — the shared
implementation of the behaviors the brief asks for (airmap/whereto keep
their own UI; this is for screens/tests that want it built-in):

```js
const comp = A.search.attach(input, {
  bias: { lat, lon } | (() => bias),   // fn or fixed; defaults to geo.pos/Delhi
  onPick: (row) => {},                // the scPick/pickRow equivalent
  myLoc: true,                        // 'My location' first row when empty
  recents: true, recentKey: 'search.recent',   // A.store-backed recents
  strings: { myLoc, recent, clear, searching, none },  // i18n hooks
  list, x, anchor,                    // bring your own elements if styled
  fillPick: true,                     // input.value = row.name on pick
  debounceMs: 90, liveOpts: {},       // passed through to live()
  onEnter, onClear,
});
comp.clear(); comp.detach(); comp.rows(); comp.st; comp.list; comp.x;
```

Behavior: progressive `live()` suggestions per keystroke (90 ms
debounce, list narrows in place, final marks), my-location + 'recent
places' section when the field is empty (recents written on pick,
loc/recent rows never stored), a ✕ inside the field while non-empty,
**ArrowDown/ArrowUp/Enter** navigation (hover tracks the active row;
↑ from the top hands the text back; Enter picks active-or-first and,
with nothing listed, re-runs the query with `{enter:true}` — the deep
tier), and **Escape clears**. Row `pointerdown` is eaten so taps never
steal the input's focus mid-type (same rule airmap's composer follows).

Esc caveat baked in: motion.js consumes Escape at **document capture**
whenever a sheet is open, so `attach` listens at **window capture**
(airmap's composer does the same) and only eats the key while the
composer is engaged — text present, or list open with the field
focused. An idle composer lets Escape fall through to the screen's own
walk-back.

Markup is plain inline styles plus `.asc-list/.asc-row/.asc-on/.asc-sec/
.asc-quiet/.asc-ic/.asc-x` hooks so a screen can theme it or pass
`list`/`x`/`anchor` outright. Returns `null` off-DOM (node harness).

## Bugs fixed inside search.js

1. **`final` could take ~12 s when the pause trigger is disabled.**
   `live()`'s settle loop waited up to 12 s for a deeper tier; but with
   `pauseMs` huge (profile.js passes `pauseMs:1e9` for pure type-ahead)
   the pause timer never fires, so the deep tier can *never* start — the
   only thing still able to land is Photon (~3 s). Now bounded by which
   tiers can actually still fire: `deepMayStart ? 12 s : 3.4 s`. Verified:
   `live('zzqx nowhere lane 99', …, {remember:false, pauseMs:1e9})` →
   final at **3441 ms** (was ~12 s). Normal queries unchanged
   (375 ms final for 'connaught place').
2. **`search()`'s 9 s watchdog fired `cancel()` after the promise had
   already resolved** — a late `retire()`/`ctl.abort()` on a settled
   call. The watchdog is now cleared on resolve.
3. **Queued coalesced paint survived `retire()`** — a ≤90 ms pending
   `emitT` repaint could outlive its call (dead-guarded, but sloppy);
   `emitT`/`pend` are now hoisted and cleared in `retire()`. (Also fixes a
   latent TDZ risk: the `<2 chars` path returns before the paint block's
   `let`s execute.)

## Verified (Playwright, real Chrome 1366×850 + 390×844, geolocation
28.6139,77.209, server :8907)

- `#/airmap` composer: partial typing → progressive `.am-srow` rows
  ('connaught p' → Connaught Place leads), pick fills the field and
  closes the list, ✕ resets. Desktop and phone widths — list isn't
  clipped under the right sheet (`.am-scw` already reserves `right:480px`
  on ≥720 px, z-index 42 over the readout's 40 — no z-order bug found).
- `#/whereto` armed-row composer: 'jama mas' → progressive rows → pick
  lands in the trip row.
- `A.search.myLocation()` → `{name:'My location', lat:28.6139, lon:77.209,
  kind:'myloc', loc:true}`.
- `live('', bias, cb, {myLoc:true})` → `[locRow](non-final)` then
  `[locRow](final)` — exactly one final; without `myLoc` → `[](final)`.
- `attach()` on a fresh input: my-location row on empty focus, typed
  rows stream in, ↓↓↑ lands on row 0, Enter picks it, ✕ clears and a
  'recent places' row is stored + offered, Escape closes (even with a
  sheet open — the window-capture path).
- Zero console/page errors attributable to search.js on either screen.
- `node --check` clean.

Screenshots: `docs/lanes/lane-search-shots/{d,m}-*.png`.

## Notes for other lanes / honest gaps

- **whereto row taps steal focus mid-type**: its `bindRows` binds
  `pointerdown` for the long-press save-strip but never
  `preventDefault()`s, so a tap blurs the armed input (harmless on pick —
  `finish()` re-renders — but the blur is real). One-line fix, their file.
- **No ↑/↓ nav in airmap/whereto composers** — only Enter-top-row.
  `attach()` has it for whoever adopts, or the same pattern ports over.
- The my-location row is inert until a caller passes `myLoc` or calls
  `myLocation()` — no existing list shows it yet.
- `attach` recents use their own `A.store` key (`search.recent`,
  overridable via `recentKey`); airmap's `airmap.place.recent` and
  whereto's `K_RECENT` stay separate — consumers that want one shared
  recent list can point `recentKey` at theirs (shape: `{name,sub,lat,lon}`).
