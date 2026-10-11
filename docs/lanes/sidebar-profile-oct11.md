# Lane Y — sidebar + profile (Oct 11)

## What changed
| File | Change |
|---|---|
| `server/webapp/sidebar.js` (NEW) | `A.sidebar.{open(returnFocusEl), close(), isOpen(), render()}` — left drawer. Header = on-device profile (initial + name + home area) or "Make Alive yours"; tapping it opens the profile editor. Rows: Where to · Air around me · Purest places · Trips · Saved places (home/work read from `alive.whereto.saved`, read only; tapping one opens Where To with it as the destination) · Settings · Privacy (in-drawer page "What stays on this phone", with honest on-device counts) · Delete my data (same wipe as Settings: every `alive.*` key, then reload). Closes on scrim, Esc, ✕, swipe-left (panel follows the finger); focus trapped, returned to the menu button on close; auto-closes if a journey takes over. |
| `server/webapp/sidebar.css` (NEW) | Drawer `min(86vw,340px)`, transform/opacity only, ≥44px rows/buttons; off-stage privacy page is `visibility:hidden`. Destructive row stays ink (band hues mean air only). |
| `server/webapp/profile.js` (NEW) | `A.profile.{get(), firstName(), ageLabel(k), open({edit}), close(), isOpen()}`; event `alive:profile` after each save. The bottom sheet + the "when to ask" logic (below). |
| `server/webapp/profile.css` (NEW) | The sheet: 48px inputs at 16px, 40px age chips, switch, Save / Not now. |
| `server/webapp/app.js` | Router announces every top-screen change: `document` event `alive:screen {id, prev}` (from `show()` and `back()`); new `A.stackIds()` (ids bottom→top). Nothing else changed; every existing export/behaviour kept. |
| `server/webapp/index.html` | + `sidebar.css`, `profile.css` links; + `profile.js`, `sidebar.js` scripts (after `ledger.js`, before `motion.js`). |
| `server/webapp/home.js` | ONLY the menu button: moved to the header's left (top-left), `aria-haspopup="dialog"`, click → `A.sidebar.open(btn)` (falls back to `#/settings` if the sidebar isn't loaded). |

## Profile — data + privacy
- `alive.profile` = `{v:1, name, age_band, area:{name, sub, lat, lon, locality}, share, t, sent}`; lat/lon rounded to 2 decimals.
  Age bands: `u13, 13-17, 18-29, 30-44, 45-59, 60+` (chips: Under 13 … 60+).
- Name never leaves the phone. Switch (ON by default, labelled "Count my age group and area anonymously — never my name"):
  on save → `A.track('profile', {age_band, area})`, `area` = locality text only (no coordinates, no house/street —
  derived by `localityOf()`: the row's own name when it is an area, else the first locality-looking part of a provider
  address; kind labels like "historic site" are never used). Re-sent only when that pair changes (no double counts on edits).
  Until lane A2 whitelists `profile` in `telemetry.js` + server, `A.track` drops it silently (expected).
- Area type-ahead: `A.search.live(q, bias, onRows, {remember:false})` (does not disturb Where To's carry-over list),
  140 ms debounce, ≤5 rows, honest states ("Looking…", "No match yet…", "Search isn't available just now");
  falls back to `A.search.search`.

## When the sheet appears
`alive.profile.ask = {visits, dismissed, dismissedDay, done}`; a visit = a new tab session (`sessionStorage alive.visit`).
- Ask if: no profile saved AND not dismissed today (IST) AND fewer than 3 dismissals AND
  (≥45 s visible-active AND a screen other than home was opened this session — searching/planning happen in Where To)
  OR (2nd+ visit AND ≥6 s active).
- Only when calm for 1.5 s: consent answered and `#consent` hidden, no journey anywhere in the stack, home on top,
  not dropping a point (`.hs-picking`), sidebar closed, no focused input, tab visible.
- "Not now" / scrim / Esc → dismissed today. Save (even empty) → never asked again; editable from the sidebar header.

## Verified (headless Chrome 390×844 DPR3, rig `/home/govinda/alive-dev/y/verify.mjs`, shots in `/home/govinda/alive-dev/y/shots`)
Run on `http://localhost:8111/app/` (local files + local full server) and `:8110` (prod API):
fresh profile → consent intro → share location → home → menu top-left (x=20, 44×44) → sidebar opens settled with focus inside,
14×Tab / Shift+Tab stay trapped, Esc closes and focus returns to the menu, scrim closes, swipe-left closes; open animation
rAF avg 16.7 ms / worst 17 ms (swiftshader). No sheet before engagement (9 s) or during consent; sidebar → Air around me opens
airmap; no sheet before 45 s even after engaging; sheet appears at 47 s; "ashok nagar" type-ahead rows; Save stores name +
18-29 + Ashok Nagar @ 28.69,77.3; `A.track('profile', {age_band:'18-29', area:'Ashok Nagar'})` once, no name, no coordinates;
name not in `alive.tq`; header shows "Govinda Test · Ashok Nagar"; Privacy page + Esc back; reload keeps the header; header tap
opens the pre-filled editor; no re-prompt. Saved Work → Where To "Your location → Work — Connaught Place" with modes, store
untouched. 2nd visit → sheet with no engagement; Not now → not again that day. 320/360/390/430: no horizontal overflow in
drawer or sheet; every button ≥40px. `node --check` on app.js, home.js, sidebar.js, profile.js.
Final run on `:8111`: main 33/33, saved 4/4, second 4/4, widths 20/20 PASS, **0 console errors** (logs in
`/home/govinda/alive-dev/y/*.log`, summary `results.txt`).

## Open / for the coordinator
- Greeting by first name on home: home exposes no hook, so not done (per brief). One-line patch for lane H if wanted —
  in `home.js` `tickClock`: `const fn = A.profile && A.profile.firstName(); brandEl.textContent = fn ? \`${t(key)}, ${fn}\` : t(key);`
  plus `document.addEventListener('alive:profile', tickClock)` (remove it in the cleanup).
- `telemetry.js` (lane A2): add `profile: ['age_band', 'area']` to `ALLOWED` and a `clean()` branch
  (age_band ∈ the 6 keys above; area = trimmed string ≤ 60 chars).
- On `:8110` the prod API 404s `/v2/tally`, `/v2/ac`, `/v2/p/ac` (not deployed yet) — console noise, not from these files.
- Lane S FYI: `search.js`'s deep tier hits Overpass mirrors (`overpass.private.coffee`, `overpass.kumi.systems`) that fail
  CORS/DNS from the browser → console errors whenever the deep tier runs. The profile sheet now never starts the deep tier
  (`pauseMs: 1e9`, Photon still joins when tier 1 is thin), but Where To still can.
- Swipe-to-open from the screen edge is not built (menu button only).
