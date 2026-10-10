# system/ — paper & ink design foundation

Standalone, dependency-free CSS for the landing page. Warm cream paper, thin
ink hairlines, one forest accent, a dark "shady" section with blurred glass.
System font stacks only — nothing downloads.

## Load order

```html
<link rel="stylesheet" href="/static/system/paper.css">
<link rel="stylesheet" href="/static/system/type.css">
<link rel="stylesheet" href="/static/system/motion.css">
```

`type.css` and `motion.css` consume tokens defined in `paper.css` — keep the
order. No build step, no resets included (scope classes carry their own
styles; add your own normalize if the page needs one).

## The model

Two scopes, one vocabulary:

- **`paper`** — the default light scope. Apply to `<body>` or any section.
- **`shady`** — the dark scope. Apply to a `<section>` or `<div>`; every
  semantic token (`--fg`, `--fg-mute`, `--rule`, `--accent`, …) re-maps
  inside it, so components written once work on both surfaces.

Components should always consume the **semantic aliases** (`--fg`, `--rule`,
`--bg`), not the literal color tokens (`--ink`, `--hairline`), so they
darken automatically inside `.shady`.

## Recipe: paper hero

```html
<body class="paper">
  <header class="wrap section stack">
    <p class="kicker a-fade"><i>01</i> air intelligence</p>
    <h1 class="display--hero a-rise d1">
      Know the air <em>before</em> you breathe it.
    </h1>
    <p class="lede a-rise d2">Hyperlocal AQI, resolved street by street.</p>
  </header>
  <div class="grain" aria-hidden="true"></div>
</body>
```

- `.display--hero` — serif, `clamp(2.4rem, 7vw, 5.5rem)`. `<em>` inside a
  display head renders italic serif — the one expressive move available.
- `.kicker` / `.label` / `.stat` / `.meta` — lowercase mono micro
  (11–12px, light letterspacing). **Never** uppercase them; the lowercase
  informality is intentional.
- `.lede` — intro paragraph between headline and `.prose`.
- `.prose` — body copy: 15–16px, `line-height: 1.55`, muted ink, capped at
  `--measure` (38rem).
- `.grain` — fixed `feTurbulence` fiber overlay at ~3.5% effective opacity
  (multiply on paper). Put it once as the last child of `<body>`.
- `.grid-lines` — opt-in faint 24px baseline grid for alignment/debugging.

## Recipe: hairline rules

```html
<hr class="rule a-rule">            <!-- draws itself left → right -->
<ul class="meta">
  <li>updated 06:00 ist</li>
  <li><span class="rule-v" aria-hidden="true"></span></li>
  <li>cpcb · waqi</li>
</ul>
<section class="frame rule--soft">  <!-- 1px box, 8% ink -->
```

- `.rule` — horizontal 1px ink rule (`<hr>` or empty `<div>`).
- `.rule--t / --b / --x / --y` — border utilities on real boxes.
- `.rule-v` — vertical divider for inline meta rows.
- `.frame` — full 1px box.
- `.rule--soft` / `.rule--strong` — re-point `--rule` to ~8% / ~30% ink;
  modifiers compose with every rule utility and cascade to descendants.

## Recipe: dark section + blur panel

```html
<section class="shady section">
  <div class="wrap stack">
    <p class="kicker"><i>04</i> the network</p>
    <h2 class="display">Sensors that sleep on rooftops.</h2>
  </div>

  <!-- floating panel over imagery / map -->
  <aside class="blur frame rule--soft">
    <p class="stat">aqi <b>142</b> · pm2.5 61µg/m³</p>
  </aside>
</section>
```

- `.shady` — shady black `#0d0c0a`, warm ivory text, hairlines re-mapped to
  `rgba(236,231,221,…)`, accent lifted to `#93b18e`, `color-scheme: dark`.
- `.blur` — the dark glass panel: `background: rgba(13,12,10,.85)` +
  `backdrop-filter: blur(24px) saturate(1.35)`. Without `backdrop-filter`
  support the alpha rises to .94 so text stays legible.
- `.blur--paper` — cream counterpart for navs/overlays on the light side.
- `.grain--dark` — grain that screens instead of multiplies (light fibers
  on black); `.shady .grain` picks this up automatically.

## Motion

All motion is gated behind `@media (prefers-reduced-motion: no-preference)`.

| token / class | value | use |
|---|---|---|
| `--ease-out-expo` | `cubic-bezier(.16,1,.3,1)` | entrances, hovers — fast attack, silk tail |
| `--ease-in-out-soft` | `cubic-bezier(.65,0,.35,1)` | on-stage moves, cross-fades |
| `--ease-settle` | `cubic-bezier(.3,1.08,.35,1)` | elements that "land" — whisper of overshoot |
| `--dur-transition` | 600ms | the one transition duration |
| `--dur-beat` family | 900–1400ms | entrance choreography |
| `.a-fade` `.a-rise` `.a-blur` `.a-settle` `.a-rule` | entrance beats | attach to any element |
| `.d1`–`.d8` / `.stagger` | 90ms steps | sequence siblings |
| `.t-lift` `.t-color` `.t-fade` | transitions | hover/focus states |
| `.reveal` + `.in` | scroll reveal | JS IntersectionObserver adds `.in` |

**Reduced-motion contract:** entrance classes only *add* animation — the
base state of every element is its final state, so under `reduce` nothing
is hidden and nothing moves. `.reveal` (the one exception that starts
hidden) is explicitly reset to visible. See the contract comment at the
bottom of `motion.css`.

## Breakpoints

Mobile-first ladder — tokens handle most of it (`--gutter` and `--wrap`
already respond); components should prefer `clamp()` and container queries
over hard steps.

| step | width | expectation |
|---|---|---|
| base | 320px | single column, hero ~2.4rem floor |
| 390px | phones | as base; check `--gutter` feels generous |
| 768px | tablets | `--gutter` widens; 2-col layouts may open |
| 1024px | desktop | full grid, hero approaches its cap |
| 1440px | wide | `--wrap` grows to 82rem; hero pinned at 5.5rem |

```css
@media (min-width: 768px)  { /* tablet+  */ }
@media (min-width: 1024px) { /* desktop  */ }
@media (min-width: 1440px) { /* wide     */ }
```

## House rules

- One hue: `--forest` / `--accent`. Links on hover, a kicker index, a live
  dot, focus rings, `::selection`. Never large fills — use `--accent-tint`.
- Rules are always 1px translucent ink (`rgba`), never solid borders.
- Lowercase mono for labels. No tracked-out caps, no thin weights
  (everything is 400), no stretched or condensed faces.
- Serif does headlines and prose; mono does labels/stats; `--font-sans` is
  available only for UI chrome (forms, dense nav).
- Dark sections get `.shady`; don't hand-pick dark colors outside it.
