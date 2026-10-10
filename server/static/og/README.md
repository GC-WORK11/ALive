# og/ — link-preview card + icon set

Cream paper `#f4efe7`, ink `#1c1913`, one amber accent `#a4762b`. The Delhi
skyline is the film's one-line path (`../film/skyline.svg`) drawn in thin ink,
and the wordmark is P052, URW's Palatino, which matches the landing's
`Iowan Old Style / Palatino` stack. The image has no numbers anywhere.

| file | size | use |
|---|---|---|
| `og.png` | 1200×630 · 188 KB | `og:image` / `twitter:image` (under WhatsApp's 300 KB cap) |
| `og-square.png` | 1080×1080 · 259 KB | post as an image on X/Instagram. Don't use it as `og:image` |
| `favicon.svg` | 799 B | tab icon: bold "A" and an amber dot on a cream tile. The A is converted to outlines, so it needs no web font |
| `favicon-32.png` | 32×32 | fallback for browsers that don't use SVG favicons (Safari) |
| `apple-touch-icon.png` | 180×180 | iOS home screen. Full-bleed and opaque, because iOS rounds the corners itself |

## Paste into `<head>` (after `<title>` / `<meta name="description">`)

```html
<!-- link preview -->
<meta property="og:type" content="website">
<meta property="og:site_name" content="Alive">
<meta property="og:url" content="http://65.2.28.40/">
<meta property="og:title" content="Alive — Delhi's air, counted.">
<meta property="og:description" content="Alive rebuilds Delhi's air as a live field — then prices what a trip, a stay, an hour outside actually puts in you.">
<meta property="og:image" content="http://65.2.28.40/static/og/og.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Alive — delhi's air, counted. The Delhi skyline drawn in one thin ink line on cream paper.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="http://65.2.28.40/static/og/og.png">
<meta name="twitter:image:alt" content="Alive — delhi's air, counted. The Delhi skyline drawn in one thin ink line on cream paper.">
<meta name="theme-color" content="#f4efe7">
<!-- icons: Chrome/Firefox/Edge take the SVG, Safari takes the PNG -->
<link rel="icon" href="/static/og/favicon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/static/og/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/static/og/apple-touch-icon.png" sizes="180x180">
```

`og:site_name`, `og:image:type` and the two `:alt` tags are optional extras.
Everything else is the required set.

## Before posting

- X caches a card per URL for about a week. If the link was shared before these tags
  went live, post `http://65.2.28.40/?v=1` so X fetches the card fresh. Do the same
  if `og.png` ever changes: rename it or add `?v=2` to the image URL.
- To check the card, paste the URL into a draft post on X; the card renders in the composer.
  Facebook's Sharing Debugger or opengraph.xyz will show the same tags.
- `/static/{asset:path}` already serves this folder (png → `image/png`,
  svg → `image/svg+xml`, `max-age=3600`). `/robots.txt` returns 404, so crawlers
  are allowed.

## Composition notes

- `og.png`: the wordmark and line sit in the open upper-left, and the skyline runs
  along the lower third. A warm haze collects on the horizon, and the horizon line
  fades out toward both edges. The amber dot sits directly above the Qutub
  minaret's finial. In `og-square.png` it sits above India Gate's chhatri instead.
- Grain is a 2 px paper texture over soft mottling and a faint vignette.
  The PNGs use a 256-colour palette with no dithering, and show no visible
  loss at 3× zoom.
