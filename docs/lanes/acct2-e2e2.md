# acct2 — e2e2 full regression :271

Lane: acct2 (testing) · target `https://d2eh2l2ys9wkij.cloudfront.net/app/` · build **9bf64497 (:271)** via `/health.build_sha`.
Harness: Playwright + headless Chromium @ 390×844, Delhi geo mocked (`/Users/devin/alivetest/p11..p14.log`, shots `shots/b*.png`).

## Full journey — VERIFIED CLEAN except 1 defect

| Stage | Result | Evidence |
|-------|--------|----------|
| consent (fresh profile) | **PASS** | 5-dot walk: next ×3 → choice page (share/keep) → keep → loc page → `#consent-yes` → `alive.consent='"granted"'`; `onboarded` stays null by design — gate is `!A.geo.consent && !onboarded` (`home.js:1288`), consent key alone persists. Overlay never reshows on reload. `shots/b0..b3` |
| home | **PASS** | hero `53 µg/m³ satisfactory`, "3.5× WHO daily limit", sparse day card ("your count starts…"), week strip element, Delhi-air card, all 3 doors. `b3-home.png` |
| whereto search | **PASS** | `ISKCON east of kailash` → 3 relevant rows (OYO ISKCON hotel / Iskcon Temple Kailash Colony / ISKCON East Delhi), dists shown. `b4-rows.png` |
| modes | **PASS** | 24 options across modes: Car(AC), Car(windows down), Bike/scooter, Auto-rickshaw, Bus, Metro+walk, Bicycle, On foot — each w/ dose delta + arrive clock |
| options eta+arrive | **PASS** | every card: `N km · arrive H:MM am/pm` + eta `N min`; qualifiers read "least smoky way/option N" (wire-form dead). `b5-plan.png` |
| vehicle wizard | **PASS** | intro → cls(7) → fuel → year(5) → puc skip → chip "before 2010 petrol car" → Settings "My vehicle \| car · estimates run on this". `b11..b13` |
| journey | **PASS** | live card "10 m — Head straight on Kartavya Path", meta `17 min · 12.4 km left · arrive 12:04 pm`, dose counters. `b8/b9` |
| receipt | **PASS** | `.jn-close`→confirm→`.jn-yes`→`.jr-sheet` "ended before it really started / under 100 m" → `.jr-done` → plan intact. `b10` |
| airmap | **PASS** | "a day of Delhi air" sheet, 745 µg outside card; map tap → readout updates "inhaled today · 3.4× WHO". `b15/b16` |
| purest | **PASS** | ranking Meerut/Hapur/Ghaziabad 40-42 µg/m³ + "field only partly reaches here" honesty note. `b17` |
| settings | **PASS** | My vehicle `car · estimates run on this · change`, Language/Voice/Cigarette/Privacy groups, version row. `b18` |

## DEFECT 1 — P2 — Escape is dead during a live journey

- Repro: start journey → `.jn` live → **Escape** (×N) → nothing: `.jn-confirm` never unhides, no sheet closes, no error.
- Expected (`journey.js:1090` comment): Esc "steps back one level … open the end-confirm — the same taps as on-screen" — i.e. same as tapping `.jn-close` X.
- Actual: dead key. Confirm reachable only via the X button (works).
- Root (read-only, verified in deployed bundle): journey's Esc handler clicks `el.querySelector('.jn-end')` (`journey.js:1098`) — **`.jn-end` is never rendered anywhere**; the close control is `.jn-close` (`journey.js:482`). Selector drift: the class was renamed and the Esc path never updated.
- Fix sketch: query `.jn-close` instead (or tag it `data-unarm`-style so motion.js reaches it first — motion.js Esc sees `topSheet()===null` during journey since `.jn` isn't a `.sheet`, so it correctly stays out of the way).
- Evidence: `p14.log` — `jnConfirm:true,hidden:true,inSheet:false`; Esc @350ms & @1250ms → `conf:false` both.

## Prior-defect re-checks — all dead

- Esc×2 mid-journey wedge (P0, :262): `.jn` survives, `wedge:false`, nothing pops. DEAD.
- Esc mid-arm full-screen exit (P2, :267): `.wt-pinx` now carries `data-unarm` (deployed bundle verified); Esc disarms in place — stays `#/whereto`, sheet solid, search live. DEAD.
- Shop icon `attribute d` (P2, :266): `q-33-23.5` count = 0 in deployed `whereto.js`; **0** `attribute d` errors across all runs.
- Esc-on-receipt double-pop: receipt→Esc path unchanged from :266 fix (`.jr-done` present, journey onKey dismisses it one step).

## Robustness sweeps — clean

Hash refresh: `#/whereto` `#/airmap` `#/purest` `#/settings` all remount; `#/bogus` → Home. Admin gate: `#gate` overlay + `session` → `{"authenticated":false"}`, no unauthenticated data. Console: **zero errors** all runs (only benign WebGL GPU-stall warnings + tile `ERR_ABORTED` on nav).

## Totals

Journey stages: **11/11 PASS** · new defects: **1 P2** (dead Esc on journey — `.jn-end` never rendered) · prior defects re-verified: **4/4 dead** · console errors: **0**.
