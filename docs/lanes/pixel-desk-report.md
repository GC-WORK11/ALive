# pixel-desk — desktop (1440×900) + tablet (768×1024) pass

Lane: pixel-ruthless desktop/tablet sweep of `server/webapp`. Read
`pixel-report.md` (390 px mobile pass) first — nothing here re-fixes it.
Method: headless Chromium (Playwright) walked the full flow at both
viewports with console + pageerror + failed-request capture, per-step
screenshots, and DOM rect probes for anything that looked off. Local
server `python3 -m http.server 8090` on `server/webapp`, prod API via
`?api=…cloudfront.net`.

## Defects found and FIXED (all in scoped files)

| # | Defect | Fix | File |
|---|--------|-----|------|
| 1 | **Crash on unmount mid-plan** — `/v2/plan` resolves after the sheet closed (or remounted): `state.plan = j` on `state === null` → `TypeError: Cannot set properties of null (setting 'plan')`. Reproduced live at 768: navigate away while the engine is thinking → pageerror, and at desktop widths the same race exists on close→reopen (stale plan could paint into a fresh sheet). | Capture `const s = state` at `plan()` entry; `if (state !== s) return;` right after the await — covers unmount *and* remount. | `whereto.js` |
| 2 | **Two more post-unmount `state.` derefs in whereto** — `A.search.reverse(…).then` callbacks touch `state.from` / `state[which]`; reverse geocodes resolve after unmount → same TypeError class. | Added `state &&` guards (matches airmap's existing pattern). | `whereto.js` |
| 3 | **Escape did nothing anywhere** — no `keydown` handler in the app at all; keyboard users could not close a sheet, leave a search, or cancel an armed pin-drop. | Per-screen `keydown` wiring, removed on teardown: **whereto** Escape walks back one level — armed hint → back to search, in-search → back to trip view, main view → `chrome.close()` (each case presses the same on-screen control); **airmap / purest** Escape → `chrome.close()`; **journey** Escape → dismiss the end-confirm if open, else receipt `done`, else the `end journey` confirm. Verified live: armed → Esc×3 lands `#/home` with sheet closed at both widths. | `whereto.js`, `airmap.js`, `purest.js`, `journey.js` |
| 4 | **Map zoom + attribution buried** — MapLibre parks NavigationControl and attribution bottom-right, which is *inside* the 460 px sheet rail on every sheet screen and under `.home-panel` on home at ≥720 px (measured: ctrl at right:0, y 788–900 vs panel x ≥1022). Zoom buttons were invisible and untappable; attribution covered. | `.maplibregl-ctrl-bottom-right { right: 472px }` at ≥720 — sits 12 px left of the rail, clear of the home panel (right:18+400) and journey HUD/fabs. Verified in shots at both widths. | `home.css` |
| 5 | **No keyboard focus ring** — nothing set `:focus-visible`, so Tab was invisible on desktop. | `:focus-visible { outline: 2px solid var(--accent) }` — verified: `.door` shows a 2 px solid ring on Tab. | `home.css` |
| 6 | **No hover affordance** — list rows, option cards, mode cards, vehicle chips, place bars and chrome buttons gave zero hover feedback (only `.door` had one). | `@media (hover:hover)` hover tint in `var(--surface2)` — the app's own pressed/selected color — on `.srow .opt .mode .vchip button.searchbar .back-btn .x-btn`; `brightness(1.05)` on primary/ghost buttons. | `home.css` |
| 7 | **Scroll chaining + short-viewport clip risk** — `.sheet-body` wheel-scroll could chain out of the rail; `.home-panel` (bottom-anchored) would clip its card top on viewports shorter than ~440 px. | `.sheet-body { overscroll-behavior: contain }`; `.home-panel { max-height: 100dvh; overflow-y:auto }` with hidden scrollbar at ≥720. | `home.css` |

## Per-screen per-viewport verdicts

| Screen | 1440×900 | 768×1024 |
|--------|----------|----------|
| consent | **clean** — card centered 460 px, copy intact | **clean** |
| drop-a-pin → home | **clean** — right rail panel, real 50 µg/m³ read, chip, puck; doors measured inside viewport (bottom 888 < 900 / 1012 < 1024 — the earlier "clipped door" read was the buried maplibre attribution, fixed via #4) | **clean** — same, taller card still fits |
| whereto (search → options → mode/vehicle) | **fixed then clean** — rail + routes fit (fit padding right:500 clears the rail), option cards, chips, `start journey` CTA all good. Was the crash site of #1. | **fixed then clean** — 460 px rail on 768 is by design (split-view); options + CTA render |
| whereto armed pin-drop | **clean** — fold to bottom-right hint card works, whole map tappable, Esc disarms to search | **clean** — same fold, hint clear of shifted map controls |
| journey (preview → ×8 → end → receipt) | **clean** — HUD bottom-right 400 px, ×8 fab, dest pill, dose-graph receipt; camera follows puck, route visible | **clean** — same; Esc → end-confirm wired |
| airmap (tap → readout → go-out card → picker → armed) | **clean** — field choropleth, tap card top-left, ranked legend, plan bars all real | **clean** — readout card still clears the rail |
| purest (list → env card → stays → district tap) | **clean** — district fills, numbered pins, ranked rows, stays; offscreen flags were inside the scroll container (verified, not defects) | **clean** |
| sheet close → home | **clean** — `top=home, aircard=1` at both widths | **clean** |

## Console / network log (reported, mostly NOT fixable in scope)

- `/v2/reverse?lat&lon` → **404 on every hit** — server route missing or renamed; the client already degrades to Nominatim so the chip labels were real, but it burns a failed request each time. **server-side (coordinator's domain).**
- `/v2/playtime`, `/v2/stays` → **intermittent 404s** on some coordinates this pass (e.g. Meerut centroid 28.946,77.673) — cards rendered their honest "no read for this spot" fallback, so the UI is truthful; backend coverage/flakiness is server-side.
- Overpass mirrors (`nchc.org.tw`, `private.coffee`, `kumi.systems`) → `ERR_NAME_NOT_RESOLVED` / CORS blocks from this box; the cascade tolerated it (Photon/Nominatim answered). "ISKCON east of kailash" returned **0 rows on two later runs** after working on the first — external flakiness, not a code defect; the walker fell back to "saket" to keep exercising the flow.
- One `net::ERR_ABORTED` tile request — MapLibre aborts stale tiles on re-fit; normal.
- **Zero pageerrors** in the final walks at both viewports (the `null.plan` TypeError is gone).

## Frozen files — defects/notes living there, not touched

- `app.js` — `sheetChrome(el, title, onBack)`: the `onBack` parameter is **dead** (both ‹ and ✕ call `close()`). Harmless today; if per-screen back-behavior is ever wanted, that arg is the hook.
- `app.css` — `.sheet` desktop rail is `top:0` full-height and slides under the sheet-chrome area during open (prior mobile report flagged the same); cosmetic only.
- `app.css` — the ≥720 rail is hard-coded `width:460px`; at 768 that's 60 % of the viewport. Looked intentional (split-view) and usable in shots; flagging for product taste, not a bug.
- `map.js` — controls placed `bottom-right` at init; repositioned via scoped CSS rather than touching it (#4). If you'd rather move the `addControl` call instead, that's the alternative.

## Not re-fixed (from the mobile pass, still verified good)

Sheet-fold on armed pin, back rows, route repaint after journey, AREA_FILL
bind, orphan `wtN` routes, swap-label clip, home-gap pointer-events,
results restore — all still behave at both new widths.
