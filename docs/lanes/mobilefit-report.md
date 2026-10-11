# Lane — Mobile-fit: audit P1s fixed (srow bleed · drag · targets · inputs · clips)

Source audit: `docs/lanes/acct2-mobile-reality-report.md` (390×844, prod
2026-10-11). The rn-twin rewrites + the motion lane landed after that audit —
this lane re-checked every P1 against the CURRENT tree, fixed what was still
broken, and verified fixed-elsewhere items rather than duplicating them.

## Verdict per P1

| audit P1 | status before this lane | what this lane did |
|---|---|---|
| srow names bleed under `.src` + off-screen | **still broken** (generic picker rows) | fixed — below |
| sheet grab decorative, no drag dismissal | already fixed (`motion.js` `bindDrag`) | verified live (below) |
| sub-40px tap targets | partially fixed (motion.css pads) | padded the post-twin stragglers |
| search inputs 15px → iOS auto-zoom | partially fixed (`.wt-input` now 17px) | every remaining 15px input → 16px |
| `.vrow` 'bus' mid-glyph clip | resolved by rewrite (`.vrow` has no emitters) | verified zero mid-glyph clips |

## Changes (commit `ee550ad`, base `1caaf7b`)

**`server/webapp/app.css`**
- `.srow > span { min-width: 0 }` — the name/sub wrapper (a bare `<span>` in
  airmap/purest pickers, `.pm-row-main` in ranked rows) may now shrink below
  content width. Every other sibling is `flex:none` and keeps its basis, so
  the rule only permits shrink where shrink is wanted.
- `.srow .n`, `.srow .s` → `display: block` — inline boxes ignore
  `overflow:hidden`/`text-overflow:ellipsis`; block boxes honour the
  ellipsis rules that were already declared. `.pm-row-main .n/.s` in
  purest.css already did exactly this — the fix generalises it to the
  picker-row emitters that hand-roll their own markup.
- `.searchbar input` 15px → **16px** — iOS auto-zooms on focus below 16px
  and `user-scalable=no` locks the user zoomed in. Covers the airmap +
  purest place pickers (the audit's named input, `.wt-search-head`, is
  gone post-twin).

**`server/webapp/whereto.css`** — `.wt-vin` 15px → 16px (PUC input, same
auto-zoom class of bug).

**`server/webapp/settings.css`** — `.st-rateinput` 15px → 16px (rate-note
input, same class).

**`server/webapp/motion.css`** — the hit-zone section already pads the
audit list (`.back-btn`/`.x-btn` 36→42, `.wt-swap` 30→40, `.am-x`/`.pm-x`
→~44, ctrl-group buttons 29→41, attrib links →~40, `#loc-chip`
min-height:40, `.vchip` →44). Added the survivors it missed, all
measured sub-40 on this tree:
- `.wt-bbtn` 34×34 → eff 40 (bar back/clear, whereto)
- `.wt-vchip` 34h → eff 40 (vehicle selector pill)
- `.wt-vfb` ~34h → eff ~42 (vehicle-sheet footer skip/back/save)
- `.st-star` 28×28 → eff 40 (rate stars, settings)
- `.maplibregl-ctrl-attrib-button` 24×24 → eff 40 — it lives in
  `.maplibregl-ctrl-attrib`, NOT `.maplibregl-ctrl-group`, so the existing
  `> button` rule never reached it
- `.onb-skip` ~32×30 → ~42×46, `.onb-loclater` ~35h → ~43 (onboarding
  text buttons; post-audit markup)

## Already-true P1s — verified, not duplicated

- **Drag**: `motion.js` `bindDrag` binds pointer drag on every
  `.sheet`/`.jr-sheet` (grab zone = `.sheet-grab,.jr-grab` + title/head
  zones `.sheet-title,.jr-head`), velocity-follow + rubber-band +
  flick/drag-home dismiss + snap-back. Verified live: pointer drag on
  `.sheet-grab` through 480px dismisses the sheet (`.sheet.on` → false).
  `.jr-sheet`'s `.jr-head` is covered by the same zone map.
- **Clip**: `.vrow`/`.vchip` have no JS emitters post-twin (whereto now
  renders `.wt-vrow` single `.wt-vchip` + `.wt-vcard` rows). A full
  scrollWidth>clientWidth scan of the whereto + airmap sheets found zero
  mid-glyph clips.

## Verification (Playwright, chrome headless, 390×844, dsf 3, touch,
iPhone UA, geo stubbed to Delhi, prod API `?api=`)

26/26 checks passed:

- picker `.searchbar input` computed 16px (live)
- `.srow` rows in the live airmap picker: no `.n` over `.src`, no `.n`
  past 390px, `.sheet-body` scrollW == clientW == 390 (h-scroll gone)
- synthetic audit-shaped row (60-char name + `.src` 'delhi index'): name
  clips at 284px, `.src` at 295px — ellipsis fires
- `.wt-vin`/`.st-rateinput`/`.searchbar input` computed 16px
- every padded target ≥40px effective (rect + ::after inset)
- drag-to-dismiss works on `.sheet-grab`
- whereto clip scan: 0 non-scrollable overflowers

## Still open (P2 class — out of this lane's P1 scope, flagged for owner)

- scrolled content slices under the translucent sheet title bar (airmap)
- `#loc-chip` unreachable off-home (design note in app.css:51 says it's
  intentional; the consent fine-print line promises otherwise)
- `.wt-bar` dead padding around the input field edges (old `.wt-search-head`
  is gone; check the new bar's gutters)
- `.jr-title` intentional ellipsis, `.srow .s` 11.5px / `.src` 9.5px type
  floor, `user-scalable=no` — owner calls, all below P1 severity

## Repo state on push attempt

`git push origin main` → **403** (grant revoked mid-session, same as the
other lanes hit). `mobilefit.patch` (attached to my session) contains this
report commit + `ee550ad` as one format-patch bundle on base `1caaf7b`
for the coordinator to apply+push.
