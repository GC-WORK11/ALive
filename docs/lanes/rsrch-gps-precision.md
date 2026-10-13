# rsrch-gps-precision — why "live location" lands 100–300 m off

Research-only lane. User complaint: the webapp's live fix is ~100–300 m off while
Google Maps / Uber land on the spot you're standing on. Scope: every
`navigator.geolocation` call and every `A.geo.*` consumer under
`server/webapp/` (plus the Expo shell for comparison). **No code changed.**

## TL;DR — the mechanism, not the flag

`enableHighAccuracy` is **already on** for every acquisition call. The 100–300 m
offset is explained by *when we stop listening*, not by what we request:

1. `A.geo.locate()` (app.js:77–99) accepts `acc ≤ 100 m` as "done" instantly, and
   resolves with the best-so-far at **5 s** (`waitMs`). On Android Chrome the
   fused provider answers in <1 s with a Wi-Fi/cell fix (typ. ±30–800 m); a true
   GNSS lock needs ~5–30 s of warm-up. Our window closes before GPS ever speaks.
2. That first coarse fix is written to `localStorage` and consumed by every
   downstream screen **with no accuracy or age gate** — whereto's From is
   `live: 1` "your location" even for a day-old ±500 m fix (whereto.js:1554).
3. Journey primes itself with a *deliberately coarse* cached probe
   (`enableHighAccuracy:false, maximumAge:30000`, journey.js:730) and writes it
   into the shared `A.geo.pos` (journey.js:700) — polluting every other screen.
4. The puck's "accuracy ring" is `--acc` in **screen px capped at 160 px**
   (map.js:815, app.css:245), not metres — cosmetic, not a truth circle.

Google Maps/Uber behave differently in kind: they hold a continuous
high-accuracy session, paint a provisional dot with an honest accuracy circle
immediately, and let the dot snap inward as the fix tightens over 5–20 s. We
treat the first answer as final.

---

## 1. Current-call audit

Every geolocation API touch point in `server/webapp/`:

| # | Site | Call | Options | Behaviour / notes |
|---|------|------|---------|-------------------|
| 1 | `app.js:92` `geo.locate()` | `watchPosition` | `{eHA:true, timeout:15000, maximumAge:0}` | Acquisition. Resolves early only when `acc ≤ goodM` (**default 100 m**). At `waitMs` (**default 5 s**) resolves with best-so-far regardless of acc. Hard deadline 16 s (`tm2`, app.js:91). **Buglet (app.js:94):** `!(best.acc <= pos.acc)` — a fix with `acc == null` replaces a measured one (`x <= null` is false for x>0); a null-acc `best` can never be displaced. Persists winner to `localStorage` (`store.set('pos')`). |
| 2 | `app.js:105` `geo.refine(cb, ms)` | `watchPosition` | `{eHA:true, maximumAge:0}`, **no timeout** | Post-fix sharpener. Fires cb only when `acc` improves ≥30 % **or** displacement > `max(80 m, pos.acc + best.acc)` (app.js:109). Auto-stops after `ms`. Non-qualifying fixes are dropped *without* updating `geo.pos` — a coarse fix stream that never clears either gate leaves a stale stored pos standing. |
| 3 | `app.js:118` `geo.watch(cb)` | `watchPosition` | `{eHA:true, maximumAge:2000}`, **no timeout** | Continuous track for airmap's follow mode. Writes `geo.pos` on **every** fix — including km-grade ones; no acc floor. |
| 4 | `app.js:251` consent-yes (frozen card) | `geo.locate()` | defaults | → `alive:location` event. |
| 5 | `app.js:264` boot re-lock | `geo.locate()` | defaults | Fires when consent granted and stored pos absent or **>120 s old** (the only place `pos.t` is checked centrally). |
| 6 | `home.js:474` `relocate()` | `geo.locate()` | defaults | Re-fires on every `refresh()` poll (POLL_MS = 5 min, home.js:27) when pos missing or **>60 s old**; then `startRefine()`. |
| 7 | `home.js:467` `startRefine()` | `geo.refine(cb, 30 min)` | — | Runs a high-accuracy watch for up to **30 min** per qualifying fix; each fires `applyPos` → full `/aqi` re-fetch + reverse-geocode. |
| 8 | `home.js:611` `chooseGps()` | `Promise.race(geo.locate(), 20 s)` | defaults | Consent-sheet button; the 20 s cap is the honest-timeout guard. |
| 9 | `home.js:756` pickgps | `geo.locate()` | defaults | "use GPS instead" escape from the pin-drop card. |
| 10 | `journey.js:715` `startGeo()` | `watchPosition` | `{eHA:true, maximumAge:1000, timeout:20000}` | Continuous nav tracking — the right call for the job. |
| 11 | `journey.js:730` priming `probe()` | `getCurrentPosition` | `{eHA:**false**, maximumAge:30000, timeout:12000}` | Grabs a **cached, possibly 30 s-old, non-GPS** fix to prime nav; passes through `onFix` → `A.geo.pos` write (journey.js:700). Teleport guard only rejects >1500 m vs a live origin (journey.js:770). |
| 12 | `journey.js:731` `geoPulse` | `getCurrentPosition` every 9 s | `{eHA:true, maximumAge:0, timeout:10000}` | Re-pokes acquisition until first fix. Good pattern. |
| 13 | `journey.js:745` "Try again" | `getCurrentPosition` | `{eHA:true, maximumAge:0, timeout:15000}` | Post-denial re-check. |
| 14 | `whereto.js:777` `locateFill()` | `geo.locate()` *only if no `A.geo.pos`* | defaults | Cached `A.geo.pos` used at **any age, any acc** — no freshness check. |
| 15 | `whereto.js:1554` mount | reads `A.geo.pos` | — | From = `{label:'your location', live:1}` straight from stored pos. **No age or acc gate.** |
| 16 | `airmap.js:1254` | `geo.watch(follow)` | call #3 | Live dot + recenter + `pullSpot()` re-read while open. |
| 17 | `airmap.js:552, 1225` etc. | reads `A.geo.pos` | — | "your current location" row; initial place; search bias. |
| 18 | `purest.js:619` | reads `A.geo.pos` | — | Anchor for near-me queries; no acc/age gate. |
| 19 | `profile.js:215` | reads `A.geo.pos` | — | Search bias only. Harmless. |
| — | `map.js:807` `puckMove` | — | — | Accuracy ring = `--acc` px (cap 160 px), not metres; never clears once set (`if (acc)` only). |

Consumers that *do* gate: `home.js:279` labels pos `live`/`stale` by a 120 s
rule; `home.js:368` says "Approximate … ±X" when `acc > 250` (honest, good);
`journey.js:792` refuses to move route progress on `acc > 150` (WEAK_ACC_M);
`journey.js:766–777` drops teleporting fixes (>1500 m first-fix or >60 m/s
implied speed, with a 4-repeat escape). Nothing else looks at `pos.acc` at all.

## 2. Why fixes land 100–300 m off — mechanism

A typical Android-Chrome acquisition sequence (GMS fused provider):

| t | What arrives | Typical acc |
|---|---|---|
| ~0.3–1 s | Wi-Fi / cell-tower fused answer | ±30–800 m (dense Wi-Fi ~30–60 m, cell-only 500 m–2 km) |
| ~3–15 s | GNSS locks, doppler/refinement | ±5–30 m |
| steady | GNSS + fused smoothing | ±3–15 m outdoors |

Our `locate()` window closes at **5 s** — and closes *instantly* at `acc ≤ 100
m`. Both exits fire before, or right at the edge of, GNSS lock. The complaint's
100–300 m band is exactly the fused provider's first answer. iOS Safari shows
the same shape — the classic first fix reports `acc ≈ 65 m` or `165 m` while
Core Location is still climbing to GPS grade.

Secondary amplifiers:

- **Stored pos has no acc/age contract.** `store.get('pos')` at boot is only
  re-fetched if >120 s (app.js:264); every screen below home just reads it.
  A ±300 m fix from yesterday morning is today's "your location" in whereto.
- **Journey's priming probe is coarse by design** (`eHA:false, maxAge 30 s`) and
  writes `A.geo.pos` unfiltered — after a ride, home/airmap inherit whatever the
  probe last saw.
- **`refine` fixes home, slowly and only while on home.** It does tighten things
  (that's why the spot card "sharpens" after the fact), but the *accepted* fix
  is already stored and already used by anything opened in between.
- **Ring is decorative.** `--acc` is px, cap 160, zoom-independent — even when
  we're honest about `±250 m` in text, the map suggests a much tighter circle.

Small defects surfaced while auditing:

- `app.js:94` — `best` replacement logic: `pos.acc == null` always wins over a
  measured `best`; a `best.acc == null` can never be replaced.
- `app.js:96` — error path ends the attempt even when the watch might still
  deliver (any error when `!best`, or code 1 always); a transient
  POSITION_UNAVAILABLE at 2 s aborts a fix that GPS would have made at 8 s.
- `geo.refine` drops fixes that fail its gates *without* updating `geo.pos` —
  a permanently-coarse device (laptop) is held at its stored position forever.
- `home.js:467` — 30 min of `eHA:true` watch per home visit is a real battery
  cost for a reading that only needs "street-corner" precision.

## 3. State of the art — how consumer apps actually do it

Sources: MDN *Using the Geolocation API*; andygup.net (HTML5 geolocation field
testing); Android fused-provider docs; Chromium/WebKit behaviour notes.

1. **`getCurrentPosition` alone is the trap.** MDN: it "tries to answer as fast
   as possible with a low accuracy result… devices with a GPS can take a minute
   or more to get a GPS fix." The standard recipe for a good single fix *is*
   `watchPosition` + an acceptance predicate + a deadline — which is what
   `locate()` is, just with a threshold (100 m) and window (5 s) set to
   "first answer", not "GPS-grade".
2. **Two-tier acquisition is the universal pattern:** surface a cached/last-known
   fix immediately for instant UI, keep a high-accuracy watch running, swap to
   the refined fix when it lands. Our own mobile shell does exactly this
   (`Mobile/src/components/shell/net.ts:41–60`: fresh fix raced against 9 s,
   then last-known with a 15-min freshness guard, labelled `fresh:false`, never
   "Your location"). The webapp has the first half (stored pos) but no upgrade
   contract and no labelling.
3. **Accuracy-threshold gating with a deadline:** common guidance is accept at
   `acc ≤ ~20–50 m`, cap the wait ~10–15 s, then take the best you have *marked
   coarse*. iOS can saturate near ~65 m indoors — chase tighter forever and you
   burn battery for nothing; the deadline is mandatory.
4. **`enableHighAccuracy:true` matters on Android Chrome** — without it the
   fused provider can stay in balanced mode (Wi-Fi/cell only, "very rarely
   GPS" per Android docs). It's on everywhere here already; that part is done.
5. **`maximumAge` is the cached-fix lever.** `maximumAge:0` = never accept a
   cached fix; `maximumAge:30000` (journey's probe) = any fix up to 30 s old is
   fine. Useful *only* as the instant-UI tier, never as the answer of record.
6. **Warm-up is real and uncontrollable:** GNSS cold→first-fix is ~5–30 s;
   nothing in the API forces the chip hot sooner — you can only hold the session
   open. iOS Safari can stall entirely until a *native* app warms the GPS
   (observed: open Apple/Google Maps, fix appears). Firefox/Android has shipped
   worse — selecting network/passive providers and reporting ~900 m (Mozilla
   bug 1765835). The app can't fix the platform; it can only wait longer and
   say so honestly.
7. **Accuracy is a radius, not a quality score.** `coords.accuracy` is metres at
   ~95 % confidence — always render it, never a bare dot. Google Maps' blue
   circle is the honest pattern: provisional position + true-radius circle +
   zoom bounded by accuracy.

## 4. Proposed acquire/upgrade algorithm

One shared routine in `geo`, replacing "locate + optional refine" as the
canonical acquisition path (names illustrative):

```
geo.acquire({goodM: 25, looseM: 150, deadlineMs: 12000, instantAgeMs: 45000})
  Phase A — instant UI (synchronous):
    emit stored pos if age < instantAgeMs, marked provisional (acc known)
  Phase B — refine (watchPosition {eHA:true, maximumAge:0, timeout:deadline+slack}):
    keep best-by-acc (acc==null counts as +∞ unless nothing else)
    emit 'fix' events progressively — callers repaint each improvement
    resolve when:  best.acc ≤ goodM            → {fix, quality:'fine'}
                or deadline hits                → {fix, quality: best≤looseM?'ok':'coarse'}
                or error(denied)                → reject code 1
                or error(unavailable)+best      → resolve coarse
                or error+no best                → reject
```

Concrete parameter changes vs today: `goodM` 100 → **~25–30 m** (street-corner),
`waitMs` 5 s → **~12 s** deadline (covers median GNSS lock; chooseGps's 20 s
cap already allows it), plus an explicit `coarse` flag on the result so callers
don't have to re-derive honesty from `acc`.

Companion rules:

- `geo.pos` gets a contract: `{lat, lon, t, acc, coarse}`; a consumer that
  can't tolerate coarse checks `pos.acc <= itsNeed`. Provide
  `geo.fresh(maxAgeMs)` / `geo.precise(maxAccM)` helpers so screens stop
  open-coding it.
- Journey's priming probe (call #11) keeps its instant-paint role but must not
  write `A.geo.pos` — shared "position of record" is only written by fixes that
  pass a global floor (say `acc ≤ looseM` and fresh), or write it but flagged
  `coarse` so consumers can tell.
- `refine` becomes "keep watching until `acc ≤ goodM` or ~90 s, then stop" —
  not a 30-min high-accuracy session. Re-acquire on the existing 5-min poll.
- Keep the teleport/plausibility filters (journey's are good); add the same
  "repeat N times to escape" pattern to any new reject path.

### Accuracy display policy

- Text: always `±N m` next to "your location" claims; `acc > 250` keeps home's
  existing "Approximate — within ±X. Sharpening…" wording (that card is already
  the right idea — extend the same honesty into the 100–250 m band as
  "±140 m · sharpening").
- Map: replace the px `--acc` ring with a true-radius circle (a GeoJSON circle
  layer or the MapLibre scale-corrected ring), so the ring *is* the 95 %
  radius. Cap nothing visually; if it fills the screen, that's the truth.
- Zoom honesty: never fly to street zoom under a coarse fix — bound target zoom
  so the accuracy circle still fits meaningfully (rough rule: z14 needs
  acc ≤ ~200 m; z16 needs ≤ ~50 m).
- "Sharpening…" affordance during Phase B — a quiet pulse on the puck / a
  "finding your exact spot" chip, removed on resolve.

## 5. Per-screen implications

| Screen | Today's exposure | Change implied |
|---|---|---|
| **home** | `relocate()` → `locate()` (100 m/5 s), then 30-min `refine` watch | Use `acquire` (25 m/12 s); spot card shows provisional fix immediately with real `±N` and a "sharpening" state; refine watch ends at `acc ≤ goodM` or ~90 s. Keep the >250 m "Approximate" card; add the mid-band. |
| **airmap** | `geo.watch` follow while open; mount flies to z14.2 at stored pos | On mount, if stored `acc > ~150` kick an `acquire` first and bound the fly zoom by `acc`. Keep the open-screen watch (it's scoped and cleared on teardown — already correct). "your current location" row should show `±N` when coarse. |
| **whereto From** | `S.from = A.geo.pos` `live:1` at any age/acc; `locateFill` reuses any cached pos | From defaults to live pos only if `fresh(<60 s) && acc ≤ ~50 m`; otherwise mount starts `acquire`, From shows "finding your spot…" then fills; `locateFill` re-acquires rather than trusting the cache. `live` flag must mean "a fine fix exists", so journey's `fromLive` teleport check stays meaningful. |
| **journey (live tracking)** | `eHA:true` watch — already correct for nav; weak gate at 150 m; priming probe is coarse and writes shared pos | Keep the watch and `geoPulse`. Route the first fix through acquire semantics (or at least: don't write `A.geo.pos` below the 150 m floor; don't let the `eHA:false` probe mark the shared spot). Optionally tighten the *first-fix* gate to ~80 m before progress starts. |
| **running / record mode** | Same path as journey (`S.track`/`pushTrack` are fix-fed) | Same as journey. Track points should carry `acc` so the post-trip view can render honesty (thin line vs fat uncertainty) instead of a confident trace through noise. |
| **purest / profile** | Read-only consumers of `A.geo.pos` | No acquisition changes; bias reads should prefer the freshest pos and silently accept coarse (a ±300 m bias shift barely changes search ranking). |

## 6. Device limits — say them plainly

- **Laptops/desktops have no GPS.** Chrome desktop resolves via Wi-Fi AP
  databases → IP fallback; accuracy is honestly tens-of-metres to *city-block
  to wrong-city*. macOS Safari via Core Location Wi-Fi is similar. This is the
  device's truth: the app must show "Approximate — ±N", offer the pin, and
  never dress a ±2 km read as a street address. Home's >250 m card is the
  model; make every screen follow it.
- **Indoors / dense urban canyons:** GNSS may never arrive; the 12 s deadline
  must return the honest coarse fix, not spin forever. iOS in particular can
  sit at the ~65 m plateau — that's Core Location's real answer, not a bug.
- **`acc` can be `null`** (some providers omit it): treat as unknown-precision,
  i.e. coarse by default, never silently "exact".
- **No API lever for power** mid-watch: the only knobs are starting/stopping
  watches and `enableHighAccuracy` at watch creation. "Refine then release" is
  the battery-honest posture — the current 30-min `eHA` refine on home is the
  outlier to fix.
- A "coarse-only" permission grant (Android 12+ Approximate location, iOS
  Precise: off) caps `acc` at ~1–3 km by OS policy — indistinguishable from
  weak signal at the API; the honest-coarse display path covers it for free.

## 7. What this does *not* fix

- Server-side routing assumes the From is true; a fine fix removes the
  100–300 m origin error but `/v2/plan` geometry still starts at whatever
  coord was submitted — the plan-time From re-check (`from_gap_km` at
  whereto.js:1187) already notices, so no server change implied.
- Nothing here changes the map engine, consent flow, or the stored-consent
  versioning (`consent_v`) — those are separate lanes.

---
*Evidence: all file:line cites are from `server/webapp/` @ working tree as of
this lane; mobile comparison from `Mobile/src/components/shell/net.ts` and
`Mobile/src/nav/engine.ts` (`Accuracy.BestForNavigation` watch at 1 s/5 m —
the native app already does what this report recommends for the webapp).*
