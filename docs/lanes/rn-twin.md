# RN-TWIN CONVERSION — the owner's directive (verbatim)

"I wanted exact pixel to pixel same android app into webapp — the android app
from the home screen to everything, ditto. Then over that, a little Uber and
Google Maps feel. What you created is a giant piece of slop — bring back all
those hardworked UI UX complete pixel to pixel."

## The law

`server/webapp/` must become the PIXEL TWIN of `Mobile/src/` — same screens,
same card order, same strings, same component shapes, same type scale, same
spacing. NOT a re-theme. Where a web implementation already exists but looks
different, the RN version wins — rebuild the DOM/CSS to match the RN layout.

## Design tokens (Mobile/src/theme.ts — already identical palette)

paper #FAFAF7 · surface #FFF · surface2 #F3F2EC · surface3 #EBE9E1 ·
line #ECE9E2 · hairline #E3E0D7 · ink #16181D · ink2 #4A4E57 · ink3 #6E7278 ·
ink4 #A6ACB8 · accent forest #35614B · accentInk #2A4D3B ·
glass rgba(255,255,255,.91) · CPCB bands #6E93AE #C7A34F #CF8A50 #C05F3A
#A83D30 #6E2D28. Type: serif display (famSerif), sans body (fam), mono
numbers (mono/mtext — tabular numerals). Card radius/elevation per V2Elev:
card shadow #3B3423 @ 0.07/18/y6; sheet shadow up-cast @ 0.12/30/y-6.
NO gradients, NO emoji, lowercase voice.

## Screen map (RN file → web screen)

- `Mobile/src/screens/OnboardingScreen.tsx` (709 lines) → consent + first-run
- `Mobile/src/screens/HomeScreen.tsx` (1892 lines) → home.js/css — the
  outdoors/exposure card, moves card, parts card, doors
- `Mobile/src/screens/SearchScreen.tsx` (1114 lines) → whereto.js/css + search.js —
  from/to fields, result rows, recents
- `Mobile/src/screens/VehicleSheet.tsx` (591 lines) → the vehicle picker inside whereto
- `Mobile/src/screens/DelhiToday.tsx` (1069 lines) → airmap.js/css (air around me)
- `Mobile/src/screens/LedgerScreen.tsx` (876 lines) → NEW screen: dose ledger
- `Mobile/src/screens/SettingsScreen.tsx` (882 lines) → NEW screen: settings/profile
- `Mobile/src/nav/*.ts` (journey engine: instructions, offroute, reroute, strip)
  → journey.js behavior + receipt visuals
- `Mobile/src/components/*.tsx` (BandScale, DepartGraph, TapReadout, FreshnessChip,
  CityMoves, RouteTint, AirMapCard) → the matching web components

## Reference-render discipline

Run the RN screens on iOS sim OR read their JSX + StyleSheet blocks and
translate View→div, Text→span/p, StyleSheet→CSS. Spacing values are exact
(px = RN pt). Border radius, shadows, paddings — exact. If a value is
visually ambiguous, open the landing emulator (server/landing.html iframe
shows the same look) or run the app — never guess at a different look.

## What stays

- Web runtime: `A.api`, `A.geo`, `A.store`, `A.fmt`, `A.map`, `A.search`,
  `A.sheetChrome`, `A.show/back`, hash router — the plumbing works; only the
  pixels change.
- APIs + data contract unchanged.
- Everything still real — nothing faked.

## Frozen (coordinator owns)

index.html skeleton ids, app.js runtime, map.js runtime, server/*.
app.css global tokens MAY be edited ONLY by coordinator (I sync V2T into
:root vars) — lanes style inside their own per-screen css files and may add
generic element classes inside their screen containers.

## Coordinator file

Report per-screen: which RN structures were mirrored (file+line), what
deviates and why, before/after screenshots at 390px.
