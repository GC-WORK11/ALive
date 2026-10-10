# Alive — Hero Visuals

Art direction: **Delhi air-exposure at golden hour** — India Gate as a ghost
silhouette inside layered particulate haze. Warm cream → amber → umber palette
(Anthropic-paper adjacent), editorial, filmic grain. Built from a real
photograph, graded — not a render.

## Files

| file | size | spec |
|---|---|---|
| `hero-main.webp`   | 2560×1600 | ~159 KB @ q82 — full-bleed desktop hero |
| `hero-mobile.webp` | 1200×1600 | ~74 KB @ q82 — portrait recompose |
| `hero-poster.svg`  | viewBox 2560×1600 | ~32 KB — thin-line skyline overlay (1.5px ink) |

## Source

`server/static/hero-delhi-smog.webp` (2048×1365) — real Delhi smog photograph,
India Gate centre. Chosen over `hero-haze.webp` (flatter, lower-res) and
`hero-alive.webp` (native 2560w but pale/washed dawn — weaker pollution read).
No usable captures existed in `alive-consciousness/local-logs` (app screenshots
only).

## Grade recipe (applied on source before upscale)

1. **Green desat** — foreground trees pulled toward neutral olive
   (`gmask = clip((G−max(R,B))·6)·0.55`, blend to luma).
2. **Amber shadow lift** — warm floor in darks `+R .052 +G .030 −B .012`,
   weight `(1−lum/0.55)^1.6`.
3. **Warm midtones** — `R ×1.055, G ×1.018, B ×0.94` weighted to mids.
4. **S-curve** — gentle contrast, pivot 0.48, amplitude 0.16.
5. **Cream shoulder** — highlight compression above 0.82; top end tinted
   toward paper cream (251,244,229) — nothing clips to pure white.
6. **Halation** — bright-pass (lum>0.55), 70px gaussian, screen-blended warm
   at 11% — the glow around the monument/skyline.
7. **Ground + vignette** — bottom 30% deepened ≤10% (cosine), corners ≤6%.
8. **Left rail scrim** — see below.
9. **Grain** — mono gaussian σ≈3.4, weighted to midtones.

## Rail zone (LEFT, overlaid rail)

Scrim is baked in: **max 18% darkening at x=0, constant through x≈210,
cosine-feathered to zero at x≈560.** C1-smooth at both joints — no visible
band (verified: column luma steps <3% at every pixel).

Ink-on-image legibility, measured on `hero-main` (luma 0–1):

| zone | content | luma | ink text |
|---|---|---|---|
| x<210, y 0–500   | clean bright haze        | 0.55–0.75 | excellent |
| x<210, y 500–1100| rooftops, tanks, mast    | 0.40–0.55 | good — wordmark/stat size |
| x<210, y 1100–1600 | dark foreground canopy | 0.22–0.35 | poor — use cream if needed |

Recommended rail layout: wordmark top (~y60–160), live stats y~200–400,
nav index y~500–1000. Bottom-left quadrant stays photographic.
Small chhatri dome at (x≈500, y≈720) and a lattice mast at (x≈210, y≈880–1100)
are real scene detail — keep nav index left of x≈180.

## Composition map (`hero-main`)

- India Gate: x≈1090–1326, apex y≈404, body dissolves ~y780 — ~47% h / ~25% v.
- Free space for headline: right 2/3 is open haze (luma 0.6–0.8) to the frame.
- Mid-haze city band edge ~y700–880; foreground canopy ~y1150–1600.

## `hero-mobile` crop

Portrait crop taken from the **unscaled source** (better native detail):
source x 449–1472 (1023×1365 ≈ 0.75) centred on India Gate (cx≈960),
then graded identically and resized to 1200×1600. Monument upper-centre,
haze bands mid, dark canopy lower third. Same scrim scaled (110px core,
300px feather, 16%).

## `hero-poster.svg` construction

Traced from the graded `hero-main` (grayscale, per-column sustained
dark-run edge detection, median+gaussian smoothing):

- **canopy** — foreground treeline top edge, full width, full weight.
- **haze band** — mid-city stratum edge, two segments either side of the
  monument, opacity 0.30.
- **India Gate** — parametric glyph fitted to the traced step profile
  (apex 404, rings 418/434, shoulder 476, body 520→fade 790): stepped
  silhouette + round arch (apex y≈566, w≈104) + ghost legs dissolving to
  y≈1130 (opacity 0.22) + cornice hairline + plinth on the canopy line.
- **5 ceremonial poles** flanking the Rajpath axis, opacity 0.30.

Ink `#2a1f14`, all strokes 1.5px, `fill="none"` — overlays cleanly on the
photo or on paper-cream (#f6f0e5) backgrounds.

## Regeneration

Working scripts (kept out of the deploy dir): `/tmp/alive-hero/make_hero.py`
(webp pair) and `/tmp/alive-hero/make_svg.py` (poster). PIL + numpy only;
`convert` used to rasterise the SVG preview.
