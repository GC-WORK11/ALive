# wlive — lane report

The Where-to sheet's third composer is gone: the armed from/to row IS the
input now (Uber pattern — value label becomes a live field with the caret in
place), first-letter keystrokes paint a synchronous local tier before the
server answers, and merged rows combine near-first. Scope was
`server/webapp/whereto.js` + `whereto.css` only; every other behavior kept.

Verified headless-Chrome (playwright-core, real `?api=` prod CloudFront
backend via a local static+proxy serve) at 390×844, `alive.pos` fix at Hauz
Khas (28.5494, 77.2001): zero console errors, zero pageerrors across the full
drive.

## 1 · from/to rows are the inputs

`.wt-bar` (the pill composer under the rows) is deleted from markup and CSS.
Inside `.wt-rc` a back chevron (`.wt-bbtn`, unchanged job — `S.chrome.close`)
sits beside `.wt-rrows` (from row, hairline, to row):

- unarmed row → `<button class="wt-rrow">` — tap arms it and rebuilds with the
  field inside that row (`renderSearch(true)`)
- armed row → `<div class="wt-rrow on edit">` carrying `<input class="wt-rin">`
  — the field takes the same slot/flex the `.wt-rval` label held; the filled
  value degrades to the ghost placeholder while typing. Tapping row chrome
  (dot/key) re-focuses with caret to end; clicking the field itself keeps the
  native caret.
- per-row clear × (`.wt-rx`, hidden until non-empty) — clears value + query,
  keeps focus. Enter picks the top `res:`/`recent:`/`saved:` row (never a
  door/intent row).
- `.wt-act` bottom bar (your location + choose on map) untouched.

## 2 · first-letter typeahead

`onQ` repaints `.wt-list` synchronously on every keystroke — before any
server work. The local tier reads existing in-memory data only:

- `instantRows()` — saved (home/work) + recents, now matching `name + sub`,
  each stamped with a real haversine `dist` (km) from the same bias the
  server tier uses (`S.from || A.geo.pos || A.DELHI`) — no invented places.
- `kindIntent(q)` — a bare kind word ('bakery') yields a `kind:` accelerator
  row (CAT_MAP-glyph, "near you" / "near {place}"), decided by a regex built
  from `CAT_MAP`'s own kind vocabulary — no new word list.
- air/stay/play intent rows unchanged (`airIntentWeb`/`exploreIntentWeb`).

The engine tier fires at ≥2 chars behind a 190 ms debounce via
`A.search.search(q, bias)` — same cascade as before. `S.pending` shows
"Searching…" under the local tier; the merge lands under the same 'Results'
header — no empty-then-fill flash. Local rows dedupe server rows by
`rowKey` so nothing double-lists.

## 3 · near-first combining

`nearFirst(rows)` groups merged server rows by normalized name; each
same-name group keeps its engine tier position and sorts by `dist` (metres)
nearest-first inside it. 'bakery' returns 8–10 bakeries near Hauz Khas on
prod — kind rows carry the engine's own `kind` field. Thin answers stay thin:
nothing is padded.

## kept behaviors — verified live

- pick → `finish` → `K_LAST` persisted → plan phase (18 option cards on prod)
- trip-head tap → back to search, armed field refocused
- choose-on-map → `armPinDrop` blurs the field before `.wt-armed` folds the
  sheet — the inline input cannot fight the fold; `.wt-pinx` esc → unfold +
  caret handed back (`focusArmed`, guarded by phase + current screen)
- save-strip long-press intact (kind/door rows excluded); vehicle wizard +
  plan phase untouched; recents list updates on every pick
- console clean through the whole drive

## gotcha caught in verification

`pickRow`'s first cut keyed the kind accelerator off `p.kind` — but every
engine row carries a `kind` field, so every server result took the
accelerator path and nothing could be picked. Now `placeByKey` returns
`{ kindRow: true }` only for `kind:` keys; server `kind` stays purely
presentational.

## deliverables

`wlive.patch` (`git format-patch` vs main tip `3d4cd135`) + this report +
two screenshots (`wlive-shot1.png` armed field mid-type `ba` with local tier
painted, `wlive-shot2.png` `bakery` near-first merge).
