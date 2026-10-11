# lane: motion — sheet choreography + glitch audit (web)

Base: `main @ ab40cc0` (+ any lane pushes since). Owner directive: "at least
144hz native smooth, not a single glitch, natively 100% mobile responsive,
no text/component/font/color overlap".

**Ships:** `server/webapp/motion.css` + `server/webapp/motion.js` — NEW files,
additive only. Nothing else edited; every enhancement degrades harmlessly on
screens that aren't present.

## Method (measured, not vibes)

Headless Chrome, 390×844 CSS viewport (DPR 2, touch UA), local server
`python3 -m http.server 8090` + `?api=https://d2eh2l2ys9wkij.cloudfront.net`.
Instrumentation: rAF-delta frame sampler across open/close,
`PerformanceObserver` for `layout-shift` (with source nodes) and `longtask`,
plus programmatic rect-intersection and effective-hit-size audits in
`page.evaluate`. Journey exercised against live `/v2/plan` →
`A.show('journey')` → end → receipt. Same drive path for before/after;
numbers from two motion runs — the best-looking single run is not cherry-
picked, deltas reproduce in both.

Caveat: probe uses synthetic clicks — `layout-shift` counts them as
non-input, so the close-time shift below is probe-visible; a real tap
excludes it via `hadRecentInput`. Root reflow is real either way.

## Numbers — 60fps = 16.7ms/frame

| surface | metric | before | after |
|---|---|---|---|
| whereto open | avg / max frame ms · >34ms frames | 19.2 / 100 · 2 | 16.7 / 16.8 · **0** |
| whereto close | avg / max · >34ms | 17.1 / 50 · 1 | 16.7 / 16.8 · **0** |
| airmap open | avg / max · >50ms | 19.4 / 116.6 · 3 | 16.7 / 16.8 · **0** |
| airmap open CLS | growth as data lands | **0.153** | **0.000** |
| purest open/close | avg / max | 16.7 / 16.8 | 16.7 / 16.8 (unchanged, clean) |
| receipt open | max · >50ms | 66.6 · 1 | 16.8 · **0** |
| receipt close | exit animation | **none — instant pop** | 340ms transform exit, avg 16.7 |
| sheetChrome close | visible exit duration | ~320ms then hard cut (timer 320ms vs its own 450ms transform) | full 340ms, unmount after `transitionend` |
| grab drag | tracked movement | 0 px (no gesture) | velocity-follow, dismiss at >0.45px/ms or >42% detent (Y mobile, X desktop rail) |
| Esc | sheet close | per-screen partial (whereto/airmap/purest), receipt none | uniform, with unarm/search-back walk-back preserved |
| focus | ring / trap / restore | `--accent` ring, no trap, focus dropped to body | `--accent-ink` ring, in-sheet Tab cycle, restore to invoker |
| effective hit <40px | per screen | 5–7 controls | **0** |

Residual CLS on sheet close (0.0685 in probe): `.home-panel`/`.air-card`
reflow — the home card re-renders taller while hidden and reappears at a
new offset. Source nodes captured. Same story at home mount (~0.05–0.08):
skeleton→data swap grows the card. Both are home lane's render —
**NEEDS_PARENT** (see below). Probe-only visibility for real taps aside,
the geometry change is real.

## What motion.js does

- Tags `.sheet` (via wrapped `A.sheetChrome`) and `.jr-sheet` with
  `data-sheet-anim` — the public opt-in hook; any sheet carrying the
  attribute gets identical treatment (`MutationObserver` on `#screens`
  catches runtime mounts, incl. non-chrome sheets).
- Retimes enter/exit to `cubic-bezier(.2,.9,.25,1)` 340ms —
  `transform`+`opacity` only; `will-change` keeps the slide on the
  compositor under mount-time main-thread work.
- Grab drag: `.sheet-grab`/`.jr-grab`/title-row zones → `translateY/X`
  follows the pointer (rubber-band ×0.22 against travel), release snaps
  back or dismisses by velocity/distance. Axis-aware: right-rail on
  desktop drags in X. `data-drag` suspends the transition while the
  finger owns the transform.
- Exit sequencing: capture-phase intercept on
  `.x-btn,.back-btn,.jr-x,.jr-done,.jr-back` → plays the exit, then runs
  the original teardown (`A.back()` for chrome sheets; replay-click for
  receipt buttons so "plan the way back" still swaps the stack).
- Esc: walks unarm → `[data-back]` → animated close, then traps Tab
  inside the open sheet, focuses the sheet on open, restores to the
  invoker on close. Sets `role="dialog"` + `aria-label` from the sheet
  title.

## What motion.css does

- Choreography vars `--motion-ease`/`--motion-dur`, hidden state
  `opacity:0` (kills the mid-flight frame flash), drag transition kill.
- Pins mobile detents: `.am-host .sheet` `height:58%`, `.pm-host`
  `height:62%` (was content-sized `max-height` — that's where the 0.153
  open-CLS came from). `.wt-armed` strip exempt; desktop rail untouched.
- `body[data-top="journey"] #mark { display:none }` — journey's own top
  row (exit dot + dest pill) collided with the wordmark pill ~80px².
  Same pattern the loc-chip already uses.
- `.sk` shimmer moved off `background-position` (a paint every frame)
  onto a translating `::before` sweep — compositor-only, same look.
- Invisible `::after` hit pads: back/x/exit buttons 36→42px, wt-swap
  30→40, am-x/pm-x →40, maplibre zoom 29→41, attribution links 14→40
  tall, loc-chip min-height 40, vchips padded. Visual sizes unchanged.
- Focus ring `--accent-ink`; `:focus-within` ring on `.searchbar`.

## Overlap audit at 390×844 — verdicts

- `alive` mark × `.jn-exit` (80px²) — REAL, fixed (rule above).
- `.wt-swap` ⇅ over the to-row label element (608px²) — element rects
  overlap but no text collision: `.wt-swap-row .wt-row-label` already
  carries `padding-right:38px`. By design; flagged to whereto lane FYI.
- `searchbar wt-row` × `searchbar wt-row` (1416px²) — the −4px tuck in
  `.wt-swap-row`, rows read contiguous. By design.
- airmap/purest/home/receipt: zero text or component overlaps.

## NEEDS_PARENT

1. **home lane** — `.air-card` re-render on re-show changes card height;
   returning home shifts `.home-panel` (~0.0685 CLS in probe; same
   family on mount ~0.05–0.08). Fix needs the card's geometry pinned
   across data swaps — reserve the number block's height or avoid
   reflowing the panel.
2. **coordinator (app.js)** — `sheetChrome`'s close hard-codes
   `setTimeout(back, 320)` while its own transform runs 450ms. motion.js
   intercepts and sequences properly today; if motion.js is ever
   dropped, restore by retiming to the transform duration or listen for
   `transitionend`.
3. **whereto lane** — element-rect overlaps above are by design; no
   action unless the tuck look changes.
4. **all lanes** — mount-time DOM/route work still produces occasional
   long frames inside the open window (one 33–117ms frame on some runs;
   compositor keeps the slide smooth regardless). Deferring non-critical
   mount work past the animation would erase the residual.

## NEEDS_WIRE (index.html — coordinator owns)

```html
<link rel="stylesheet" href="motion.css">   <!-- AFTER purest.css — last stylesheet -->
<script src="motion.js"></script>           <!-- AFTER purest.js — last script -->
```

Order matters: motion.css must load after every screen lane's css (its
overrides rely on cascade position); motion.js wraps `A.sheetChrome` if
it's already defined and polls briefly if not — either position works,
but last is cleanest. No new ids/classes required — `data-sheet-anim` is
applied automatically to `.sheet` and `.jr-sheet`; other/future sheets
opt in by adding the attribute.

## NEEDS_DEPLOY

YES — two new static files; they take effect only once wired + deployed.

## Files

- `server/webapp/motion.css` — choreography props, compositor swaps,
  detent pin, hit pads, focus ring.
- `server/webapp/motion.js` — drag, esc/focus, exit sequencing,
  `A.sheetChrome` wrapper, screen observer.
- `docs/lanes/motion-report.md` — this report.
