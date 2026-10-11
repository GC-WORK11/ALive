# ALive webapp — testing lane findings (acct2, testing lane)

Target: https://d2eh2l2ys9wkij.cloudfront.net/app/ (production)
Method: Playwright + headless Chromium at 390x844 (mobile UA) and 1440x900 (desktop), geolocation mocked to Delhi (28.6139, 77.2090, acc 40).
Harness + scripts + screenshots: `/Users/devin/alivetest/` (`01-recon.js`…`08-desktop.js`, `shots/*.png`, `02.log`…`08.log`).

---

## DEFECT 1 — P0 — Escape during a journey destroys the journey AND wedges the app on a bare map

**Repro (reproduced at BOTH 390x844 and 1440x900):**
1. `/app/` → consent → allow location → open **where to**
2. From = current location (or "Delhi"), To = `ISKCON east of kailash` → plan options load
3. Tap **start journey** (live mode, geolocation granted)
4. Press **Escape** once — as a user would to dismiss what looks like a sheet

**Expected:** journey's own Esc handling — the end-journey confirm (`.jn-confirm`) opens, or a single step back.

**Actual:**
- t≈200ms: `.jn-confirm` ("end the journey?") opens correctly.
- t≈700ms: **whereto's own document-level Escape handler also fires** → `chrome.close()` → `setTimeout(back, 320)` pops the TOP screen of the stack — which is the **journey**, not whereto.
- Result: journey is destroyed (no receipt, ride data lost). Whereto's `.sheet` element has lost its `.on` class, so the screen shows a **bare map with the route line and zero UI**. Escape and map taps are dead — the user is **wedged** until a reload or manual hash edit.
- State captured: `top: whereto`, `nScreens: 1`, `.sheet.on: false`, `.jn` absent.

**Root cause (read-only analysis):** `server/webapp/whereto.js` registers its Escape handler on `document` inside `mount`, gated only by `state` being non-null — it never checks `A.current()==='whereto'`. Journey mounts via `A.show` without changing the hash, so whereto stays mounted underneath and its handler still runs `chrome.close()`, which pops whatever screen is on top (journey) while hiding whereto's own sheet.

**Screenshots:** `shots/esc-00-journey.png`, `shots/esc-01-t200.png` (confirm open), `shots/esc-02-aftermath.png` (wedged bare map), `shots/esc-03-second.png`; desktop: `shots/dwt-05-journey.png` → `shots/dwt-06-esc.png`.

**Console errors:** none — pure logic bug, no exception.

## DEFECT 2 — P1 — Escape on the journey receipt double-pops and lands on Home

**Repro:** complete/end a journey → receipt card `.jr` shown → press **Escape** once.

**Expected:** `.jr-done` behavior — one step back, landing on **whereto**.

**Actual:** lands on `top: home` — both journey AND whereto popped by a single keypress (same root cause: whereto's stray document-level Esc handler fires its `close()`/`back()` while the receipt is stacked above it).

**Screenshots:** `shots/esc-10-receipt.png`, `shots/esc-11-receipt-after.png`.

**Console errors:** none. **Severity:** P1 — visibly wrong navigation, app remains usable.

## DEFECT 3 — P2 — Uncaught TypeError when leaving purest quickly after open

**Repro:** open **purest**, then press Escape (or hash-navigate away) within ~300ms of mount — i.e. before the anchor's reverse-geocode label resolves.

**Actual:** `[pageerror] TypeError: Cannot read properties of null (reading 'anchor')`.

**Root cause:** `server/webapp/purest.js` mount-time `A.search.reverse(lat,lon).then(...)` reads `state.anchor` after teardown has set `state = null`. Unguarded async callback. Reproduced on both `esc-fast` and `hash-away` exits.

**User-visible impact:** none — console noise only. **Severity:** P2.

## DEFECT 4 — P2 — "follow my gps" offered with denied permission → ~12s dead wait

**Repro:** consent screen → deny/dismiss location → whereto → plan → start journey → the `.jn-gps` "follow my gps" button is visible and tappable despite the denied permission → tap it → ~12 second dead wait → then honest `nofix` toast + preview-journey offer.

**Expected:** button hidden/disabled when permission is denied, or fast-fail.

**Actual:** recovers honestly, only after ~12s. **Severity:** P2 nit. **Screenshot:** `shots/rob-denied-nofix.png`.

---

## ADMIN GATE — VERIFIED CLEAN

`/a-AFiVSpmZ1Oc4YhaaQyhRie5yqnlKV_qs/` checked unauthenticated (gate only — no tokens tried, per instructions):
- `#gate` overlay covers the viewport; `/a-…/session` honestly returns `{"authenticated":false}`.
- Every probe to `/a-…/api/*` → 404; no admin data served.
- Every value rendered in the console DOM traces to **public** endpoints (`/v2/city`, `/health`, `/grid`, `/ncr.geojson`); admin-only counters render `—` placeholders.
- Note (not a defect): the console DOM/copy is shipped beneath the gate overlay, so view-source exposes the admin UI *layout*. All numbers are public data, so nothing sensitive leaks today — but the gate is cosmetic-only client-side.

**Screenshots:** `shots/admin-gate.png`, `shots/admin-full.png`.

---

## VERIFIED CLEAN — everything below passed at the viewports noted

- **Consent → home:** allow + skip paths, home air card loads, loc-chip reconsent (`shots/mob-01/02`, `desk-01/02`, `rob-reconsent`).
- **All 3 home doors** open their screens (whereto / air around me / purest).
- **Whereto:** search "ISKCON east of kailash" → 3 rows; all 3 modes (health/budget/time); all 6 vehicle chips (car/bike/auto/cycle/walk/bus); route options with dose+eta; select + start journey — `shots/wt-01…wt-07`.
- **Journey:** live journey driven along the route by `watchPosition` to arrival → receipt; preview mode with ×8 speed fab; end-journey confirm yes/no — `shots/wt-08…wt-10`, `wt-15…wt-18`.
- **Plan-way-back:** `.jr-back` pre-fills reversed from/to (swap verified — Iskcon appears in FROM) — `shots/wt-11`, `dwt-04`.
- **Armed pin-drop:** arm → map tap drops pin → search resolves — `shots/wt-12…wt-14`.
- **Airmap:** field paints (`am-field-fill` 40-cell grid), tap-anywhere AQI readout card, planning-to-go-out 24h bar card, place picker — `shots/mob-airmap`, `mob-tapread`, `mob-plancard`, `desk-*` equivalents.
- **Purest:** district ranking rows, env cards, stays anchors, painted boundaries — `shots/mob-purest`, `mob-env`, `mob-anchor`, `desk-*`.
- **Back/close/Esc from every state** EXCEPT the two journey defects above — all other sheets/cards/searches close cleanly, Esc chains (unarm→back-to-search→close) work.
- **Rapid double-taps:** on doors, options, CTAs — no duplicate mounts, no wedge (`rob-doubletap-end`).
- **Mid-request navigation:** Esc / hash-away while `/v2/plan` in flight — stale-response guard works (`rob-midreq`).
- **3G throttle:** loads with honest wait states (`rob-3g-*`).
- **Denied location:** honest fallback to central Delhi; map tap sets spot; air card updates; reconsent works (`rob-denied*`).
- **Offline mid-journey:** journey continues on the loaded route to receipt (`rob-offline-receipt`).
- **Refresh mid-screen on every hash route:** `#/home`, `#/whereto`, `#/whereto` mid-search, `#/airmap`, `#/purest`, mid-journey (journey has no hash — lands on whereto; acceptable by design) — `shots/rf-*`.
- **Cold deep-links:** `#/home` `#/whereto` `#/airmap` `#/purest` mount directly; `#/journey` → home; `#/bogus` → home — `shots/dl-*`.
- **Browser Back/Forward:** Back `#/airmap`→home, Forward→airmap — clean (`dwt-07`).
- **Desktop 1440x900:** full whereto→journey flow, swap, current-location row all functional (`dwt-*`).
- **Console:** zero errors across all runs except the purest TypeError (DEFECT 3).

**Totals:** 1×P0, 1×P1, 2×P2. Push check: **PUSH_OK**.
