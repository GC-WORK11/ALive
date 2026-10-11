# acct2 — e2e3 armed-pin regression :267

Lane: acct2 (testing) · target `https://d2eh2l2ys9wkij.cloudfront.net/app/` · build **c4c7daa2 (:267)** via `/health.build_sha`.
Harness: Playwright + headless Chromium @ 390×844, Delhi geo mocked (`/Users/devin/alivetest/p10.log`, shots `shots/a*.png`).

## New mechanism — verified live

`[data-act="map"]` (choose on map) → `.wt-armed` on screen root → `.sheet` computed `background:rgba(0,0,0,0)` + `pointer-events:none`, `.sheet-body>.wt` hidden — only `.wt-pinbar` (`pointer-events:auto`) live. Shots: `a1-armed-to.png` (full map through, hint strip bottom).

| # | Test | Verdict | Evidence |
|---|------|---------|----------|
| T1 | arm 'to' → sheet inert/transparent, pinbar live | **PASS** | `armed:true, pinbar:true, sheetPE:none, sheetBg:rgba(0,0,0,0), wtVisible:false, pinbarPE:auto` |
| T1b | tap pinbar body → stays armed, no fill | **PASS** | state unchanged |
| T2 | `.wt-pinx` cancel → disarm, no tap-through | **PASS** | `armed:false, pinbar:false`, sheet solid `auto|rgb(250,250,247)`, `to` still "Where to?" — cancel did NOT drop a pin |
| T3 | re-arm 'to' → real map click → fills 'to' | **PASS** | click (200,420) → `to`="near Kreatizz" (reverse-geocoded), plan rendered 8 opts |
| T4 | arm 'from' → map click → fills 'from' | **PASS** | `armRow:'from'` during arm; click (260,500) → plan re-rendered 16 opts; `to` persisted |
| T5b | map tap after Esc-close → no stale listener | **PASS** | home unchanged, no ghost fill — cleanup ran `disarmPin` |
| T6 | normal whereto after arming | **PASS** | sheet `auto|rgb(250,250,247)`, input live, 'india gate' search → 21 options |
| shop icon | `attribute d` console errors | **PASS — 0 errors** | deployed `whereto.js` `q-33-23.5` count = 0; zero `attribute d`/path errors all run |

## DEFECT 1 — P2 — Esc mid-arm exits the whole screen instead of unarming

- Repro: whereto → choose on map → armed (`.wt-armed`, pinbar live) → **Escape once**.
- Expected (per `motion.js:91-93` design comment): Esc "unarm[s] the pin-drop … before dismissing the sheet itself" — i.e. same as ✕ pinbar: back to the search surface.
- Actual: `hash:#/home, screens:0` — Esc fell through to `closeSheet`, popped the **entire whereto screen** to Home. Search context thrown away (recoverable via `whereto.last`, but one Esc ≠ one step back).
- Root (read-only): Esc walk-back checks `sh.querySelector('[data-unarm]')` first (`motion.js:99`) — but **nothing emits `data-unarm`**; `.wt-pinx` (`whereto.js:687`) lacks the attribute, so the unarm step is never reached.
- Fix sketch: add `data-unarm` to `.wt-pinx` (or the pinbar), keep binding `disarmPin`.
- Evidence: `p10.log` T5 state; `shots/a5-esc.png` (lands on Home card). T5b confirms no stale maptap listener after the forced close.

## Totals

Armed-pin mechanism: **7/7 checks PASS** · new defects: **1 P2** (Esc mid-arm = whole-screen exit; `[data-unarm]` hook unwired) · prior P2 shop-icon: **dead** · zero console errors otherwise.
