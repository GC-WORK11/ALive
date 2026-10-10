# motes.js — the air you can't see, made visible

A live particulate layer for the hero. Fine motes drift through the haze in
`hero-main.webp` / `hero-mobile.webp`. **The number of motes is tonight's real
PM2.5: one mote per µg/m³.** Plain ES5 script, no modules, no libraries: 560
lines, 25 KB, 8.8 KB gzipped. It exposes `window.Motes`.

## The encoding (honest, exact)

| rule | detail |
|---|---|
| **motes = `Math.round(pm25)`** | 56.6 µg/m³ → 57 motes on the canvas. `count` reports it. |
| no reading → no motes | `pm25` that is `null`, `undefined`, `NaN` or ≤ 0 gives 0 motes. This matches the landing's rule: no figure until the read lands. |
| cap 300 | Above 300 µg/m³ the canvas holds 300 motes and `capped === true`. Write "300+" in any caption. |
| never lost at an edge | The canvas wraps like a torus. A mote that drifts off one edge comes back in at the opposite edge, drawn in two halves while it crosses, so it is never lost or double-counted. |
| depth split held exact | far 46 % · mid 36 % · near 18 % at every count, including mid-transition. |
| changes ease, never pop | `set()` moves the population along an ease-in-out curve over 1.4–4 s, and each mote fades in or out over 1.6 s. A mote that is fading out is reused if the count rises again, so the canvas never draws more than 300. |
| `count` vs `visible` | `count` is the settled number. `visible` is how many motes are on the canvas right now. The two differ only during a fade. |

**Visibility audit** (`/tmp/motes-demo/analyze.py`): the same frame was rendered
with the canvas on and off, and every mote was found as a blob against the photo.
At pm 56.6, all 57 motes were found at 1440×900 @1×, @2× and at 390×844 @3×.
Every mote changes the photo by at least ΔL 16.5/255 (median 28–39, max ≤ 82), so
each one is visible and none glares.

## API

```js
const m = Motes.mount(canvas, { pm25, windFromDeg, windKmh });   // → instance
m.set({ pm25, windFromDeg, windKmh });  // partial: only the keys you pass change
m.destroy();
m.count    // settled motes = Math.round(pm25), 0 with no reading, ≤ 300
m.visible  // motes on the canvas this instant (differs from count only mid-fade)
m.capped   // pm25 rounds above 300
m.blend    // 'plus-lighter' | 'screen' | 'normal'
Motes.MAX  // 300
```

| option | default | meaning |
|---|---|---|
| `pm25` | — | µg/m³. Sets the count, as above. |
| `windFromDeg` | — | The direction the wind comes **from**, in degrees (meteorological). `null` means no wind reading: the motes only wander. |
| `windKmh` | — | Wind speed. It scales the drift gently: drift ∝ km/h^0.72. |
| `blend` | `'plus-lighter'` | How the canvas is composited onto the photo. `'normal'` switches to a cream source-over palette. |
| `fps` | `60` | Frame cap. `30` halves the cost; at these speeds the motion still looks the same. |
| `parallax` | `true` | Pointer parallax by depth. Desktop only (`hover:hover` and `pointer:fine`). |

What `set()` does with each key: a key you pass is applied, and a key you leave
out keeps its value. `pm25: null` means no reading, so the motes fade out to 0.
Wind changes steer the drift smoothly over about 2.5 s.

`mount()` sets two inline styles on the canvas and puts both back on `destroy()`:

- `mix-blend-mode` (unless `blend: 'normal'`)
- `pointer-events: none` (only if no inline value was already set)

Mounting the same canvas again destroys the earlier instance. A bad canvas
returns a harmless no-op instance.

## Integration (6 lines)

```html
<canvas class="motes" id="heroMotes" aria-hidden="true"></canvas>  <!-- in .hero: after .haze, before .copy -->
<script src="/static/hero/motes.js"></script>                      <!-- before the landing's main <script> -->
```
```css
.hero .motes{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
```
```js
const motes = Motes.mount(document.getElementById('heroMotes'));      // at boot: no reading yet → no motes
const w = d.wind && d.wind.known ? d.wind : {};                         // in the /v2/city handler, right after
motes.set({ pm25: pm, windFromDeg: w.from_deg, windKmh: w.speed_kmh }); //   heroV.textContent = pm.toFixed(1)
```

- **Layering.** Put the canvas above `.ph` and `.haze` and below `.copy`. The
  blend works on whatever is painted under the canvas inside the hero. I checked
  it against the landing's own hero stack (the scaled, panning photo plus the
  screen-blended haze) with the demo's `?landing=1`.
- **Reduced motion is handled inside.** No `RM` check is needed. Under
  `prefers-reduced-motion` the layer draws one static frame with exactly `count`
  motes, and later `set()` calls redraw that frame.
- **Caption idea:** "each mote is one µg/m³ — 57 tonight". Use `m.count`, and add
  "+" when `m.capped`.

## The look

| layer | share | diameter (css px) | edge | drift × | pointer reach |
|---|---|---|---|---|---|
| far | 46 % | 0.6–1.0 | crisp | 0.42 | ±1.6 px |
| mid | 36 % | 1.0–1.56 | slightly soft | 0.78 | ±4 px |
| near | 18 % | 1.64–2.2 | defocused | 1.30 | ±8 px |

- **Light adds.** Dust in sunlight scatters light, so it adds brightness to the
  scene. The canvas is composited with `mix-blend-mode: plus-lighter` (or
  `screen` where that is unsupported), using warm amber light at 50–88 % strength.
  - Over the bright sky a mote clips to **cream**. Blue is held back so it never
    turns white like a star.
  - In the ochre haze it is **gold**.
  - Over the dark canopy it stays a dim **amber**.
  - Plain source-over cream cannot do this: it measured ΔL 2/255 (invisible) on
    the sky and up to 97 (a star field) on the trees.
- **Sizes and brightness** lean toward small and dim: many faint motes, a few
  bright ones.
- **Shimmer.** Each mote has a slow tumble: ±5–12 % over periods of 6–20 s. It is
  not a twinkle.
- **Sun bias.** Brightness runs from ×0.84 far from the light at the top right
  to ×1.14 nearest it.
- **Glints.** About once every 4–5 s at 60 motes, one mote catches the light. It
  rises fast and falls slowly over 1.1–1.9 s, grows ×1.4 and blooms faintly. There
  is no flare and no sparkle.
- **Wind.** The motes travel opposite to `windFromDeg`, reading the canvas as a
  map: east → right, north → up. The north–south part is damped ×0.4, because we
  look across the city rather than down on it, so dust drifts rather than falls.
  - At the live 8.7 km/h from 108° (ESE), motes drift left and very slightly up:
    near ≈ 10–16 px/s, far ≈ 3–5 px/s.
  - This was checked by tracking motes in the capture.
- **Wander.** Each mote has its own Brownian wander (an Ornstein–Uhlenbeck
  velocity, τ 3.2 s). Three slow divergence-free eddies (curl noise) are layered
  on top, so neighbouring motes swirl together the way real air does.
- **Placement.** New motes land in the emptiest air (best of 10 candidates). The
  field stays even and never clumps.
- **Smooth sub-pixel motion.** Sprites are pre-rendered at device resolution and
  blitted 1:1. Tracked centroid jitter is 0.04–0.07 px RMS, where integer
  snapping would show about 0.3 px.

## Behaviour

- **Runs only when it can be seen.** No rAF at all when:
  - the canvas is off-screen (IntersectionObserver)
  - the tab is hidden (`visibilitychange`)
  - reduced motion is on
  - the canvas has zero size
  - the field is empty
- **Transitions survive pauses.** Fades and transitions run on simulation time,
  so a change made while paused plays out when the layer comes back.
- **Resizing.**
  - ResizeObserver resizes the backing store to css size × min(devicePixelRatio, 2)
    and repaints at once.
  - Mote positions are stored as fractions of the canvas, so a resize never bunches
    them.
  - A change in DPR (zoom, or moving to another monitor) rebuilds the sprites.
  - If the canvas has no CSS size, mount detects that once and fills its parent,
    so a self-growing backing store can't loop.
- **Frame cap.** At most 60 fps, which also halves the work on 120/144 Hz screens.
  If a device can't hold about 40 fps for a few seconds, the layer settles at a
  steady 30 rather than a ragged 35–45. This switch is one-way.
- **Live reduced-motion switch.** When the user toggles `prefers-reduced-motion`,
  the layer switches between static and animated mode straight away.

## Performance

Measured with headless Chrome 148 via puppeteer-core:

- **JS time per frame** is the motes rAF callback, from an injected wrapper.
- **Busy %** is `Performance.getMetrics` TaskDuration over 6 s, which counts
  every main-thread task: raster, paint and style as well as script.
- Each run had a warm-up page first.
- "Mobile" means a 390×844 viewport at DPR 3 (capped to 2) with CPU throttled
  ×4 via CDP.

**GPU raster** (`--enable-gpu`, AMD iGPU through ANGLE):

| case | JS ms/frame avg · p95 · max | fps | main thread busy |
|---|---|---|---|
| desktop 1440×900 @2×, 57 motes (live) | 0.24 · 0.4 · 0.5 | 60 | 3.4 % |
| desktop 1440×900 @2×, 300 motes | 0.73 · 1.0 · 2.3 | 60 | 7.0 % |
| mobile @2×, CPU ÷4, 57 motes | 0.78 · 1.4 · 1.8 | 60 | 12.6 % |
| mobile @2×, CPU ÷4, 300 motes | 2.09 · 3.5 · 4.9 | 60 | 21.7 % |
| desktop @2×, CPU ÷6, 300 motes | 3.57 · 5.5 · 9.1 | 60 | 34.1 % |

No frame went over 20 ms in any GPU case. With no reading, or with 0 motes, the
cost is 0 % because there is no rAF.

**Software raster** (no GPU, the blocklisted-driver fallback):

- These figures are ranges over 3 runs. The machine was shared with another
  agent's Chrome automation (load average 3.5–7), so treat them as indicative.
- The JS stays tiny: 0.2–0.3 ms per frame at 57 motes. Nearly all the cost is
  Chrome raster-compositing a full-screen 2880×1800 layer in software.

| case | fps | main thread busy |
|---|---|---|
| desktop @2×, 57 motes | 49–60 | 33–45 % |
| desktop @2×, 57 motes, `fps: 30` | 30 | 15–18 % |
| desktop @2×, 57 motes, `blend: 'normal'` | 60 | 32 % (so the blend itself costs about +2–3 pts) |
| desktop @2×, 300 motes | 54–60 | 37–51 % |
| mobile @2×, CPU ÷4, 300 motes | 56–59 | 65–89 % |
| desktop @2×, CPU ÷6, 300 motes | 19–35 | saturated; adaptive cap settles at 30 |

## Verification

Demo: `python3 /tmp/motes-demo/serve.py`, then open `http://127.0.0.1:8334/`.

- The server proxies `/static` and `/v2` to the :8333 harness, so the API read is
  same-origin.
- It reads `pm25_stats.mean`, `wind.from_deg` and `wind.speed_kmh` from `/v2/city`.

| parameter | effect |
|---|---|
| `?pm25=`, `&from=`, `&kmh=` | override the live read |
| `&seq=57,150,20&every=6` | cycle `set()` calls |
| `&landing=1` | the landing's hero stack and copy |
| `&blend=normal` | source-over cream palette |
| `&fps=30` | 30 fps cap |
| `&ui=0` | hide the caption |

`/tmp/motes-demo/capture.js` (subcommands `shots`, `cast`, `diff`, `tests`, `perf`,
`all`, plus `--sw` for software raster) produced the following.

**Screenshots**

- `shot-1440x900.png` (@2×)
- `shot-1440x900-dpr1.png`
- `shot-390x844.png` (@3×)
- `shot-1440x900-copy.png`

**Capture**

- `motes-6s.mp4`: 1440×900, 60 fps, 6 s.
- It comes from CDP `Page.startScreencast` frames, which are in `cast-motes-6s/`
  with their real timestamps, joined with the ffmpeg concat demuxer.
- `motes-6s-trails.png` overlays every path from the capture.

**Behaviour tests — all 18 pass**

- the encoding
- easing 57→150 (at most 5 motes per 100 ms)
- fading 150→20
- no pops (canvas alpha mass changes ≈ 1 % per frame; by construction a mote's
  alpha moves ≤ 1.6 % per frame)
- the cap at 437 → 300
- no reading → 0 motes with the loop idle
- the off-screen pause and the hidden-tab pause
- resize at DPR 3 → backing store ×2
- `destroy`
- the reduced-motion static frame and its redraw on `set()`
- the integration snippet run verbatim (mount with no reading, then `set`)
- a wind-only `set` keeps the count
- re-mounting a canvas makes the old instance inert
- `destroy` restores the inline styles
- a canvas with no CSS size fills its parent without growing

**Pointer parallax probe** (`parallax.js` / `parallax.py`): headless Chrome reports
`hover: none`, so the media query was forced for this probe. A full left→right
sweep moved near motes −14 px, mid −6 and far −4. They shift against the pointer,
as head-motion parallax does with the photo at infinity.
