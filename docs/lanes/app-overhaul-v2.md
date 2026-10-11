# Lane: app-overhaul-v2 — component-level redesign (owner mandate)

## Owner's verdict (verbatim, governs everything)
Paraphrased: the admin, the landing page and especially the mobile app
look cheap and too complex, like an operating system. The app must be a
daily driver. Keep the light theme but make it less dull, with less going
on and fewer small words. Minimal, functional, individually designed
colourful components (a little liquid glass), easy for a non-technical
user to navigate. The functionality is advanced but not expressed well.
Do not remove a single feature or number.

## The reference register (what his Dribbble/Mobbin tabs show)
Chunky COLORFUL components on light backgrounds — saturated accent
cards (lime balance card, purple unlock tile, orange stat tiles),
big hero numerals owning their card, generous rounded corners +
pill buttons, near-zero prose, cards that carry meaning visually.
Color lives ON components, not painted over everything. Glass is a
tint, not a frosting layer.

## Scope — Mobile app, component by component
Every screen keeps 100% of its features and numbers. The expression
changes:

1. **Kill the mini-words.** Audit every screen for text density:
   labels >3 words, qualifier strings, prose lines. Replace with
   component grammar: the number + its unit + a band-colored
   accent/icon does the talking. Words only where a number alone
   can't mean anything.
2. **Component-level design** — each surface's components get
   individually designed, not one blanket card style: dose hero,
   day arc, the move, days strip, ledger rows, compare options,
   receipt stats — each is its own designed object (own accent,
   own shape language, own hierarchy).
3. **Colorful + glass, in the light theme.** Saturated band-colored
   accents on components (CPCB palette deepened/saturated for
   component surfaces), light glass tints where the map shows
   through (search bar, chips, HUD tiles — the existing glass
   rule stands), soft shadows on cards. NOT: repaint the whole
   app colored, NOT dark theme, NOT frosting everywhere.
4. **Hierarchy per screen** — one hero per screen, everything else
   visibly recedes. The dose number / the move / today's window
   owns its screen.
5. **Navigable blind** — a non-technical user reaches every feature
   in ≤2 obvious taps; if a feature needs a label to be found,
   the IA is wrong.

## Rules
- Zero features or numbers removed — the verification list is the
  apk-final 14/14 surface set (docs/lanes/apk-final-report.md).
- Light theme only. Fraunces/Plex Mono stay (they're bundled).
- No jest; gates: cd Mobile && npx tsc --noEmit && npx expo lint &&
  node src/store/test-runner.mjs && node src/nav/test-runner.mjs.
- Never deploy. Live API GETs only.
- Deliver before/after shots per screen in the report +
  what the APK rebuild must re-verify. Commit to base/v2
  (pull --rebase). Report → docs/lanes/app-overhaul-v2-report.md.
- This lane owns Mobile only — web surfaces have a sibling lane;
  share the design language via docs/lanes/register-card.md
  (update it, don't fork it).

## DECODED REGISTER (from his two tabs, ~30 production screens studied)
Screens studied: KakaoBank card stack, Plata Card, Swiggy, Origin,
Trust Wallet, Ultrahuman, stoic., Nextdoor, Ronas finance apps,
trek/cycling map+stat, AI assistant glass set, sports/deals apps.

1. **One hero per screen** — a huge numeral or one statement owns
   the viewport ("$3,200.00", "153,295원", "USE YOUR CARD TO GET
   CASHBACK"); everything else visibly recedes.
2. **Chunky rounded cards ~18-28px radius, ONE idea each** —
   KakaoBank: mint/salmon/blue/beige account cards, huge numeral,
   zero prose. Card surfaces CAN be tinted pastel — the card itself
   is the color.
3. **Category icon tiles as feature doors** — Swiggy FOOD/
   INSTAMART/DINEOUT/SCENES: small colorful square tiles with an
   icon + 1-word label. Our features (search, day, trips, ledger,
   settings) enter through designed tiles, not text links.
4. **Pills for everything interactive** — search pill, ONE primary
   CTA pill per screen (dark or saturated), filter tab pills,
   status chips.
5. **Accent color = component identity** — lime banner, purple
   tile, orange stat. Band colors get saturated pastel component
   surfaces (not just dots).
6. **Art/photo in cards** — personality lives in imagery and
   gradient-mesh "liquid" art on hero surfaces, not prose.
7. **Honest empty states as designed cards** — Ultrahuman "No data/
   Calibrating/Locked" are styled blocks, not apologies. Our sparse
   states already do this — keep the pattern.
8. **Tab bar: icon + 1-word label, 4-5 items.**
9. **Glass = frosted tint on floaters over live content** (search
   bar, chips, map HUD) — subtle blur + tint, never a frosting
   layer on solid surfaces.
10. **Words rationed**: number + unit + ≤3-word label. Sentences
    only in CTAs and empty states.

## HARD ANTI-LIST (owner, second message — violations are regressions)
- NO cyberpunk/neon/glow/retro/synthwave anything.
- NO 3D renders, no decorative SVG art, no broken-image risk.
- NO lime-slime/"chocolaty" greens, NO cheap yellowish tones.
  Color discipline: muted-expensive — deep ink, forest, muted
  CPCB band tones, saturated-but-classy accents. Think Origins'
  restraint, not crypto-neon.
- No over-frontend: no gratuitous animation, no parallax tricks —
  smooth physics on real interactions only.
