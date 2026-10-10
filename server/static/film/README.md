# film/ — "one ink line" SVG asset library

Thin-line ink illustrations for the scroll-driven film about air-pollution
exposure in Delhi. Aesthetic: single-weight strokes on cream paper
(architectural sketch / etching), no fills except light ink hatching, no
gradients, no filters.

## Conventions

- `viewBox="0 0 1200 675"` on every file.
- `stroke="currentColor"` `fill="none"` `stroke-width="1.8"` `stroke-linecap="round"`
  `stroke-linejoin="round"` set on the root `<svg>` — inherit page ink color.
- Every **drawn** element carries `data-draw=""` so JS can do
  `el.getTotalLength()` → `stroke-dasharray` draw-on animation. Clip-path
  geometry inside `<defs>` (cells.svg) is intentionally not marked.
- No wobble/displacement filters; curves carry the hand-drawn feel.

## Files

| file | motif | total length* |
|---|---|---|
| `arc.svg` | master arc — one wide elegant sweep, recurring motif | 1132 u |
| `bed.svg` | stay/sleep — bed silhouette, one continuous line | 1782 u |
| `breath.svg` | breathing waveform, gently irregular inhale/exhale | 1604 u |
| `cells.svg` | irregular hand-drawn map patch; 3 cells ink-hatched (heavier air) | 15526 u |
| `clockarc.svg` | 24 h semicircle dial, hour ticks, bolder 10–15 h "lightest window" | 1775 u |
| `eye.svg` | minimal eye — almond outline, iris + pupil rings | 1256 u |
| `particles.svg` | sparse PM2.5 mote field (52 circles, varied size/opacity), drifts | 767 u |
| `pin.svg` | minimal location pin — teardrop + inner ring | 1020 u |
| `route.svg` | two routes between shared nodes: direct vs long detour arc | 1425 u |
| `skyline.svg` | Delhi skyline — ONE continuous path: rooftops → Qutub-like minaret → tomb dome → mosque → India Gate (chhatri + arch traced by doubling back along the baseline) → Lotus Temple petals → minaret | 4381 u |

\* lengths in viewBox units, computed by `pathlen.py`
(same as `getTotalLength()`). Grand total: **30 668 u**.

## Regenerating lengths

    python3 pathlen.py            # table
    python3 pathlen.py pin.svg    # per-element detail

## Notes for the film

- Draw-on: `stroke-dasharray: L; stroke-dashoffset: L` → animate offset to 0.
- `particles.svg` dots already vary opacity; drift via `transform` on `<circle>`s
  or a wrapping `<g>`.
- `clockarc.svg` bold segment is `stroke-width="3.2"` — same `currentColor`.
- `cells.svg` hatching uses `clipPath` ids `cell0..cell2`, opacity 0.45.
- Cream-paper preview: `#f5f0e4` background, e.g. `#3a3428` ink.
