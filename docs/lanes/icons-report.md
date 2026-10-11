# Icons lane — whereto result-row category glyphs

Scope: `server/webapp/whereto.js` only. Owner complaint: "in the location when I
type something, there is cringe, you know, random thing... have some better icons."

## Root cause (the "cringe")

`catGlyph(kind)` mapped every food kind (`restaurant`, `cafe`, `bakery`,
`fast_food`, `dhaba`, ...) to the glyph name `restaurant` — but the shared
`D` path dictionary had **no `restaurant` entry**. `icon()` returns `''` for
missing names, so every food row rendered an **empty 38px glyph tile** — a
blank box where an icon should be.

Gazetteer impact (210k rows, field `c`):

| metric | before | after |
|---|---|---|
| rows rendering an empty glyph tile | 21,237 | 0 |
| rows falling through to generic `pin` | 73,542 (35.0%) | 8,980 (4.3%) |
| rows on a real category icon | 54.9% | 95.7% |

Secondary problems fixed in the same pass:

- `station` (rail), `parking`, `road/street` classes, `locality/suburb/sector`,
  `suburb` rows all collapsed to `pin` — the most common kinds had the least
  informative glyphs.
- `parking` hit the `/park/` regex → rendered a **park tree** on parking rows.
- `blood_bank` hit `/bank/` → bank icon on a medical facility.
- `bar|pub` unbounded → `barber`, `pub`-substring words hit the food bucket.
- worship faiths: `muslim_place_of_worship` (599 rows) → mosque, `christian_*`
  (978) → church, `hindu/gurudwara/mandir/...` → temple.
- `medicine` → pharmacy vs medical-facility split corrected (`medicine shop` →
  pharmacy; bare `medicine`/clinics → hospital).

## What changed

1. **`D` additions** — three single-path `d` strings on the 960-unit
   `viewBox="0 -960 960 960"` grid, same Material-Symbols-Rounded line weight
   as the existing set, ported verbatim from `Mobile/src/icons.tsx`:
   `restaurant` (fork+knife), `city` (skyline), `route` (road).
   `icon('restaurant')` etc. now return real SVG instead of `''`.

2. **`CAT_MAP` rewrite** — same regex-table shape, widened to the real web kind
   vocabulary (gazetteer `c` values + OSM tag values from photon/nominatim/
   overpass producers). Ordered: family catch-alls (`bank`, `park`, `station`,
   `road`, `locality`) sit after specific kinds so `police station` → police,
   `service road` → route, `blood bank` → hospital, `district court` → civic
   (bank glyph — columned institution, correct read for government buildings).
   `pin` remains the honest fallback for genuinely generic kinds
   (`place`, `named`, `water/canal/stream`, `parking`, `substation`, `wall`).

3. **New glyph assignments** (kind → glyph):
   - `station/halt/platform/junction/terminus` → `rail`; `metro/subway/
     rapid_transit` → `metro`; `bus/stop` → `bus`
   - `locality/suburb/sector/colony/village/township/district/building/...` → `city`
   - road classes (`motorway/trunk/primary/secondary/tertiary/link/marg/
     chowk/footway/...`) → `route`
   - `government/court/embassy/municipal/...` → `bank` (civic columns)
   - `information/tourist/visitor` → `info`
   - `library/planetarium` → `museum`; `golf` → `park`; `archaeological` → `monument`

4. **Untouched by design** — saved/recents/door/intent row glyphs
   (`home`, `work`, `clock`, `hotel`, `explore`, `leaf`) and their accent
   coloring stay exactly as before; `pin` stays the generic fallback.

## Other surfaces (checked, NOT sharing catGlyph — left untouched)

- `purest.js` pm-rows (~L277): rank numbers + `◍` char, own markup — no change.
- `airmap.js` dt-cglyph (~L703): hardcoded `icon('pin',...)` on street-corridor
  rows, own markup — no change. If the corridor rows should carry kind glyphs
  that's a separate lane decision; `catGlyph` is whereto-scoped.

## Verification

- `node --check server/webapp/whereto.js` — clean.
- Kind-coverage audit: extracted `D`/`CAT_MAP`/`catGlyph` from the edited file
  and ran all gazetteer `c` values through both old and new tables (numbers in
  the table above). No `CAT_MAP` target is missing from `D` (verified
  programmatically — `missing glyphs: none`).
- Visual: `placeRow` output rendered through real `whereto.css` for 23
  representative kinds — see attached screenshot (rail, metro, food,
  hospital, school, hotel, temple/mosque/church, locality, park, fuel, bank,
  atm, route, museum, parking→pin, pharmacy, police).
