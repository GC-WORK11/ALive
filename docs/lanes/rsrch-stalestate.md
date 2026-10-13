# rsrch-stalestate — cached location silently wins; location-off invisible; slow recovery

Research-only lane. Bug: with **device location services OFF**, opening the webapp
served the last-known location and its AQI across 4–5 refreshes with no prompt;
after location was turned on it took ~3 refreshes to recover (mobile has no
hard-refresh). Scope: `server/webapp/` (app.js geo helpers, home.js
lifecycle/consent/location flow, telemetry.js storage) + the server cadence the
client polls. Complements `rsrch-gps-precision.md` (which audited *accuracy*; this
audits *freshness/failure*). **No code changed.**

## TL;DR

The stale render is **structural, not a race lost by accident**: `boot()` mounts
home and home paints from `store.get('pos')` **synchronously** in the same task,
while any fresh fix is ≥5–16 s away (`geo.locate()` window). The real defects are
that the re-lock failure is **swallowed twice** (app.js:266, home.js:480 — only
code 1 sets `locErr`, and even that note can't render while a stale pos exists,
home.js:318), and that **no standing watch survives a failed locate** — recovery
exists only via the 5-min poll or a reload, which is why toggling location on
mid-session did nothing until manual refreshes.

## 1. What is cached, where — the honest inventory

All keys are `localStorage` under the `alive.` prefix via `A.store`
(app.js:60–67). What persists across reloads:

| Key | Written at | Contents | Age/TTL |
|---|---|---|---|
| `alive.pos` | `geo.locate()` success (app.js:85), `geo.refine` gate pass (app.js:110), `applyPos` (home.js:511) | `{lat, lon, t, acc?, picked?}` | `t` = fix epoch ms. **No expiry** — read at any age |
| `alive.consent` | home.js:617/630/639, app.js:248/259 | `'granted' \| 'picked' \| 'later'` | sticky |
| `alive.consent_v` | home.js:617/630/639 | `2` | migration gate — `≠2` wipes consent+pos once at home mount (home.js:767–769) |
| `alive.onboarded` | home.js:617/637 | `1` | skips intro |
| `alive.settings` | home.js:97 | `{share, vehicle, home, work, profile…}` | user prefs |
| `alive.daylog.samples` | home.js:119 | ambient dose samples | 21-day keep (home.js:109); `personalSample` refuses fixes >15 min old (home.js:126) — stale pos can't pollute it |
| `alive.journey.history` / `.last` | journey.js:1109–1112 | finished trips | intended history |
| `alive.airmap.place`(+`.recent`), `alive.whereto.*` | airmap.js:541/1067…, whereto.js:734/757/775/890 | user-picked spots/recents | intended |
| `alive.anon`, `tq`, `tprof`, `topen`, `internal`, `telemetry` | telemetry.js | counters/queue only — **no coordinates, ever** (telemetry.js:23–33) | per-IST-day gates |

What does **not** persist: `aqiMemo`/`aqiBusy` — the `/aqi` result cache is an
**in-memory Map**, 2-min TTL, keyed to 4-dp coords (app.js:46–57). So **the AQI
number is never stored**. The bug's "last known location and its AQI" is a
*fresh* `/aqi` answer computed for the *stale* coordinates — same place, same
15-min-cached server field → same-looking number.

## 2. Boot path — exactly why stale wins

Order in `boot()` (app.js:238–267):

1. `show('home')` (app.js:241) → home `mount` runs synchronously:
   `cur.pos = A.geo.pos` — the stored fix, any age (home.js:771).
   `paint()` renders the hero; `posState()` (home.js:272–281) labels it
   `live` (<120 s), `stale` (≥120 s), `pin`, `locating`, or `off`.
   First paint is the skeleton "Reading the air here…" (home.js:328–329).
2. `refresh()` (home.js:483–505): `at = ps.pos || A.DELHI` → `A.aqiSpot(stale
   coords)` (home.js:488) → ~1 s later the full card paints: eyebrow
   **"Air at your last fix"** (`eyeStale`, home.js:174/311) + big AQI + PM row +
   spot card **"You are here · <address> · ±Nm"** (home.js:363–380 — rendered for
   `stale` too, not just `live`).
3. Only *after* mount does `boot()` fire `geo.locate()` — and only when
   `geo.pos` is absent or >120 s old (app.js:264–267). It is fire-and-forget:
   `.then(dispatch alive:location).catch(() => {})`.

**The fix can never beat the paint** — `locate()` waits up to 5 s for `acc ≤
100 m` and hard-times-out at 16 s (app.js:87–91,97). The stale card is on screen
within a frame; that part is intentional instant-UI. What's broken is everything
after:

- `refresh()` also calls `relocate()` when pos is missing or >60 s old
  (home.js:486 → 471–482). Its catch sets `cur.locErr = 'denied'` **only for
  `e.code === 1`** — `POSITION_UNAVAILABLE` (2) and `TIMEOUT` (3, incl. the 16 s
  synthesized deadline at app.js:91) vanish silently.
- Even `locErr = 'denied'` is invisible here: the hero note renders only for
  `state === 'off'`/`'locating'` (home.js:318–319); with a stored pos the state
  is `stale` → `note = null` → **no note, no prompt, no action**. The only
  disclosure is the small eyebrow string.
- With location OFF at OS level the browser answers code 2 (or hangs → code 3).
  Both paths are silent. So each refresh replays the identical stale render —
  exactly the reported symptom.
- If the stored pos is absent entirely, `posState` returns `locating` forever
  (home.js:276): "Finding you…" + "Showing central Delhi until your location
  comes in" spins indefinitely on code-2/3 failures.

Contributing aggravations:

- **Two concurrent `locate()` calls at boot** when pos >120 s: app.js:265 and
  home.js:486→474 — two `watchPosition(eHA:true)` sessions at once. Harmless to
  correctness, wasteful, and there's no single-flight.
- `locate()`'s error callback `(e) => { if (!best || e.code === 1) end(e) }`
  (app.js:96) aborts the whole attempt on the **first** transient
  POSITION_UNAVAILABLE — a provider mid-warm-up kills the fix GPS would have
  delivered seconds later (also flagged in rsrch-gps-precision §2).
- `geo.refine`'s standing watch is only armed *after* a successful locate
  (`startRefine`, home.js:464–470). A failed boot leaves **zero** geolocation
  subscriptions — nothing exists to notice the OS toggle flipping back on.
  Recovery then needs the next `POLL_MS` tick (≤5 min) or a reload.
- Why ~3 refreshes to recover even *after* location was on: each reload's
  `locate()` needs up to 5–16 s of provider warm-up; users refresh faster than
  that and kill the pending watch. Separately, Chromium has a long history of
  per-tab geolocation error stickiness — once a tab starts returning
  POSITION_UNAVAILABLE, subsequent requests in that tab can keep returning it
  until a fresh provider start (crbug 542923-era reports; SO 26694260 — the
  canonical workaround being exactly "switch to a *persistent* watchPosition").

## 3. Can we detect "location off" vs "denied" vs "no fix"? — yes, well enough

Signals available on Android Chrome + desktop:

| Signal | Tells us | Caveats |
|---|---|---|
| `navigator.permissions.query({name:'geolocation'})` | **site** permission: `granted`/`prompt`/`denied`; `.onchange` fires on unblock | Reflects the site setting only — Android OS-off still reads `granted`. Use as a *classifier of code-1*, not a device sensor |
| PositionError `code 1` PERMISSION_DENIED | site/app denied → site-settings copy | unambiguous, already half-handled |
| `code 2` POSITION_UNAVAILABLE | **device can't produce a fix** — Android: OS location off/provider dead; Windows: Chrome runs `kPlatformOnly` + `kWinSystemLocationPermission` (OS toggle → code 2); macOS: CoreLocation w/ network fallback | the closest thing to a "location services off" signal the web platform exposes |
| `code 3` TIMEOUT | ambiguous — weak signal, cold GNSS, *or* a provider that never answers (incl. some Android-off builds that never call back → our 16 s synth at app.js:91) | don't prompt on one; do after repeated failures |
| no `navigator.geolocation` | unsupported → `csNoGeo` exists (home.js:212) | rare |
| standing `watchPosition` | **errors don't cancel a watch** — when the platform provider returns, the same watch's success callback fires by itself | the free auto-recovery hook; some Chrome builds still need a *fresh* request → also re-probe on resume/focus |

Honest-UX proposal (no nag when fine, one clear prompt when the fix is ours to
request):

- **Nothing shown** while `state === 'live'` or a fix flows — today holds.
- **Prompt rules** (all need consent `'granted'` first):
  - code 1 / permissions `denied` → existing `blockedNote` (home.js:190) + pin-drop.
  - code 2, **or** ≥2 consecutive code-3/deadline failures, or >~20 s stuck in
    `locating` with permission `granted` → "Location looks off on this device"
    note in the existing `.hs-note` slot (extend home.js:318 to `stale` too),
    with journey.js:738–742's per-platform instruction pattern and the existing
    "drop a point" escape. Dismissable for the session; re-arms next boot.
  - never prompt on `prompt`/`denied` permission state alone.
- **Auto-recovery, no refresh needed**: while `consent==='granted'` and
  `state !== 'live'`, hold one low-power sentinel watch
  (`{enableHighAccuracy:false, maximumAge:60000}` — cheap, coarse is fine for a
  wake-up). First success → `applyPos` → `startRefine` upgrades it. Plus a fresh
  one-shot probe on `visibilitychange→visible`, `focus`, and `pageshow` — the
  exact moments a user who just flipped the OS switch produces. This is
  journey.js's `geoPulse` (journey.js:731–734) generalized to the whole app;
  journey already proves the honest pattern (`geoErr` ∈ denied|unavailable|
  unsupported, per-platform help, "Try again" — journey.js:705–748,1015–1025).
- Also: surface locate failures through `alive:location` (dispatch
  `{error: e.code}`) instead of `.catch(() => {})` at app.js:266 — one line
  turns the whole silent path observable.

## 4. (a) Boot-time fresh-vs-cached policy — design

In-repo precedent to copy: `Mobile/src/components/shell/net.ts:41–60`
`posNowDetailed` — fresh fix raced at 9 s → else last-known **≤15 min, labelled
`fresh:false` + `ageS`, never "Your location"**. Port that contract to the web:

- Keep the synchronous first paint (instant-UI is right); make the cached fix
  *provisional by construction*:
  - `pos.t` age <2 min → `live` (today).
  - 2 min–15 min → `stale`: serve it, eyebrow says **"Air at your last fix ·
    {age} ago"** (carry `ageS`, like `net.ts`); `.hs-note` gains a quiet
    "re-checking…" while re-lock is in flight and the off/prompt note when it
    fails.
  - >15 min → keep serving the read but **stop claiming presence**: suppress
    the "You are here" spot card (home.js:363 gates on live/stale/pin today —
    make stale render "last fix was here · {age} ago" instead), and arm the
    recovery watch + affordance. Recommend a hard ceiling (~24 h) past which the
    stored pos is treated as absent → `locating`/`off` with central Delhi read.
  - `picked` pins keep `pin` semantics at any age (user-asserted truth).
- **Single-flight acquisition**: `geo.locate()` callers share one in-flight
  promise (the `aqiBusy` pattern, app.js:47) so boot's re-lock and home's
  `relocate()` ride one watch instead of two.
- Keep `locate()` from dying on the first transient error: only `code 1` should
  end an attempt early; code 2/3 while `waitMs` remains should keep listening
  (today: app.js:96 aborts on any error when `!best`).
- Align the thresholds: boot re-lock at >120 s (app.js:264), `refresh()` re-lock
  at >60 s (home.js:486), `stale` label at >120 s (home.js:279) — pick one
  freshness budget (suggest 60 s live / 15 min serve-with-age / 24 h drop) and
  derive all three.

## 5. (c) The 5-min internal balancer — what exists, what's missing

**Already running (three separate, non-coordinated loops):**

| Loop | Where | Cadence | Scope | Visibility-aware? |
|---|---|---|---|---|
| `refresh()` — /aqi + re-lock + sample | home.js:27,780 | 5 min | home mounted only (cleared at 802) | no |
| `loadField(false)` — /grid field tint, epoch-gated (map.js:497) | map.js:54 | 5 min | page lifetime | no |
| `pull() + pullSpot()` | airmap.js:1305–1307 | 5 min | airmap mounted + top | no |
| `geo.refine` sharper-fix watch | home.js:467–469 | ≤30 min window | after a good fix only | no |
| telemetry flush | telemetry.js:222–227 | debounced | pagehide/visibilitychange/online | **yes — the precedent** |

Server cadence underneath: `AirField.refresh` self-throttles to `CACHE_TTL =
900 s` (airfield.py:35,237) and is triggered lazily per request
(`_field_refresh_bounded` on every `/aqi`, main.py:1066); `FIELD.status()`
reports `age_s`, `refresh_in_s`, `stale` (>45 min, airfield.py:1102–1139). The
client already echoes `field.age_s` as "updated N min ago" (home.js:290–291) —
good. So a 5-min client loop is right-sized: the field can only change on a
15-min boundary; polling cheaper than that buys nothing.

**Missing:**

1. **A shared, visibility-aware scheduler.** Put a tiny `A.beat` in app.js:
   `register(name, everyMs, fn)`; one 60 s tick; skip while `document.hidden`;
   on `visibilitychange→visible`/`pageshow`, immediately run anything overdue
   and dispatch `alive:resume` for repaint-only work. Rationale: Chrome already
   clamps hidden-tab timers, so this isn't about CPU — it's (a) not burning
   network/GPS in a background tab and (b) **catch-up on return** instead of
   waiting out the remaining interval (a tab foregrounded at minute 4:59 shows
   stale data for another 5 min today).
2. **Position revalidation on the same beat** for `consent==='granted'`: pos
   older than the freshness budget → one bounded acquire (single-flight) or the
   sentinel watch; success routes through `applyPos` — the existing pipeline
   repaints hero, spot card, address, puck, and refetches `/aqi` with no reload.
3. **Screen-agnostic.** home's `refresh` and airmap's `pull` stay mounted-only
   (right scoping), but subscribe to `alive:resume`; the field loop (page-lifetime)
   moves onto the beat so the map tint sleeps with the tab too.
4. Failure policy: revalidators are all already never-throw (`A.api.get` returns
   null, app.js:20–28) — keep that; each stores `lastOk`/`lastErr` so the hero
   can age its own claims honestly.

## 6. Other things that render stale first

- **airmap** — `st.place` falls back to stored `airmap.place` then raw
  `A.geo.pos` labelled "where you are"/"central delhi" (airmap.js:1224–1225);
  `spotPos()` reads `A.geo.pos` with **no age gate** (820–823) → hero lead "the
  air where you are" (116) over a day-old fix; "your current location" row
  (528–529); search bias `scBias` (929); `pullSpot` reads at it (872).
- **whereto** — `S.from = {label:'your location', live:1}` from `A.geo.pos` at
  any age/acc (whereto.js:1554); `locateFill` prefers any cached pos before
  trying a fix (777–785).
- **purest** — anchor `{label:'you'}` from raw `A.geo.pos` (purest.js:619–624).
- **profile** — search bias only (profile.js:215), harmless.
- **journey** — live `watchPosition` only; its fixes update `A.geo.pos`
  in-memory but never `store.set('pos')` (journey.js:700,719) — so a session
  ending on a ride leaves `alive.pos` *older* than the last real fix.
- **home `cur.aqi`** is module-scoped (home.js:256–264) — survives remounts
  within a session; first `paint()` after remount can flash the previous read
  before `refresh()` lands (in-session only; `aqiMemo`'s 2-min window is
  intended cross-screen consistency, app.js:42–45).
- **`#loc-chip` is dead markup** — `index.html:38` button is `hidden`, styled
  (app.css:46–54), never wired in any JS; yet consent fine-print promises "the
  chip up top reopens this" (index.html:59). There is no chip.
- **mood/tint** — `hs-mood` band wash and the `/grid` field tint are always
  fresh-fetched at boot (map.js:52 `loadField(true)`; nothing persisted), so
  they can't be stale-on-boot — but the tint is painted for whatever position
  the camera shows, which on boot is Delhi regardless of the stale hero spot.

## Appendix — reported symptoms ↔ mechanisms

| Symptom | Mechanism |
|---|---|
| Opens on last-known location + AQI, 4–5 refreshes | `alive.pos` served unconditionally (home.js:771,488); re-lock fails silently every refresh (app.js:266, home.js:480); 'stale' state has no note slot (home.js:318) |
| No prompt while location was off | code 2/3 dropped everywhere; `locErr` only set on code 1 (home.js:480) and unrenderable under `stale` anyway (home.js:318–319); `#loc-chip` never wired (index.html:38) |
| ~3 refreshes to recover | no standing watch after failed locate (`startRefine` only on success, home.js:464–470); recovery needs poll/reload; each reload's 5–16 s `locate()` races impatient refreshes; Chromium per-tab POSITION_UNAVAILABLE stickiness possible |
| Why it felt silent | the only disclosure is the `eyeStale` eyebrow; the spot card still says "You are here" for stale fixes (home.js:363,380) |
