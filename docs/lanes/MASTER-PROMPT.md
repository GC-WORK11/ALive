# ALive — elaborated master prompt (the whole product, end to end)

You are building **Alive**: a Delhi/NCR personal air-exposure product — NOT a generic AQI dashboard. It answers one question: **"What did this air do to me, and what should I do next?"** The design language is a PIXEL TWIN of the owner's Android app (`Mobile/src/`) on the web (`server/webapp/`), with Uber/Google-Maps-grade UX polish on top. Warm neutral base (`#FAFAF7` paper, `#16181D` ink, `#35614B` forest as a SMALL accent only), band colors ONLY where they mean air quality. Plain language, no jargon, no emoji. Local storage only — no auth anywhere.

**The vow:** nothing faked, nothing artificially animated that fails on demo, no hardcoded data, no "sorry not available" cop-outs when free/open-source paths exist. Every number must be real and traceable.

## The product, feature by feature

**1. Consent** — a nice popup, not a cheap one: "your location is only used to analyse the environment" class of copy. Three real paths: share my location (real GPS), drop a point (map pick), decline (works but clearly told what degrades). Choice persists in `alive.*` localStorage.

**2. Home** — live AQI + PM2.5 + PM10 of the EXACT spot the user stands on. Serif hero number in band-ink color, "satisfactory/moderate/poor…" band label, "×WHO daily limit" line, band scale, sparkline, "in Delhi's air right now" intel card. **Provenance line**: "from {station name} · {km} away · read {m} min ago" — the named monitor (argmin over `/aqi field.stations[]`), so "is this really my air" is provable on-screen.

**3. Where To** — ONE surface: From/To rows ARE the inputs (no third composer — DEAD, keep it dead). First-letter typeahead: local tier paints instantly, server merges ~200ms under the same list; near-first combining ("type bakery → all bakeries near you"). Three modes: **Health Maxer** (absolute cleanest route, no compromise), **Budget+Health** (short route, better air), **Time+Health** (fast + clean). Vehicle select next. Route options carry real dose math + real arrival clock — never invented ETAs.

**4. Journey** — Start Journey → REAL live geolocation nav (watchPosition, real tracking — NO fake auto-drive). Live jams where a free traffic source exists; honest where it doesn't. Arrival receipt: intake graph judged on a dose scale — "this route jammed here, you inhaled most here" — simple, honest, no ai-slop graph.

**5. Air Around Me** — AQI-colored map to street level (real field surface, not captions). "Planning to go out": pick a place → best-time-of-day card graded by AQI + indexes, the gorgeous graded card.

**6. Purest places** — cleanest areas of the city ranked on the live field. Hotel env-cards: pick ANY hotel (not hardcoded) → environment card around it; Alive's suggested hotel up top.

**7. Admin** (`/admin`) — minimal dark dashboard, Cognition-grade: Delhi tile map refreshing ~15 min, analytics (users, journeys done, modes used most, successful journeys, intake saved, route-segregation analysis — is everyone taking the same road creating more pollution?), ALL real numbers, everything connected end to end.

## Non-negotiable mechanics
- **Deep Delhi index**: layered gazetteer (`server/data/delhi-gazetteer.json` 240,027 rows + 96k generated usage aliases: mandir↔temple, masjid↔mosque, romanization/abbreviation/fused-split forms) + anchors + Overpass T3 mirror race. Common-usage names resolve; compound queries anchor to locality. NEVER per-name hardcode — mechanisms only. Test addresses (must resolve, never hardcoded): Pawan Bakery C block Hanuman Mandir Ashok Nagar Shahdara, ISKCON East of Kailash, Neelanchal Dham Sant Nagar.
- **Deploy**: `PATH="$HOME/.aws-venv/bin:$PATH" bash scripts/deploy.sh` → verify `GET /health → build_sha`.
- **Lane contract**: `docs/lanes/webapp-wave2.md` + `rn-twin.md`; all lane reports live in `docs/lanes/`.
- **144hz smooth, zero glitches, 100% mobile-responsive** — every component, font, color verified non-overlapping at 390px; 60fps sheet transitions; ≥40px tap targets; 16px+ inputs.
