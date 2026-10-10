# Launch copy — alive web

Grounded in what's live right now (verified 2026-10-10, build `3a0c69f1`):

- Consumer app: https://d2eh2l2ys9wkij.cloudfront.net/app/ (mirror: https://delhi-is-alive.vercel.app/app)
- Landing: https://delhi-is-alive.vercel.app/ — the phone on the page runs the real app, not a sim
- Admin ("engine room", operator-only): obscure mount, token-gated
- Android APK: `alive-ef758f9-arm64.apk` (v9, verified; see `docs/lanes/apk-v9-report.md`)

## X thread (8 posts)

1/ Delhi is the most polluted megacity on earth. Every map app tells you how long the trip takes. None tells you what it puts in your lungs.

alive prices every trip in PM2.5 you'd actually inhale — live, on the web, no install:

2/ Open it, drop a pin (your location never leaves the device — it's only used to read the environment around you), and get the air at that exact point: PM2.5, PM10, NO₂, the band, how old the reading is, and a plain-words why.

3/ "where to" — one from/to box with deep Delhi geocoding (neighbourhoods, temples, bakeries, not just landmarks). Three modes: health maxer, budget + health, time + health. Pick a vehicle; get real route options, each priced in µg with the +% breath over the lightest.

4/ "start journey" — real turn-by-turn with the dose ticking as you move. The arrival receipt: how much you breathed, the heaviest stretch, and what it means against the WHO day.

5/ "air around me" — the live PM2.5 field painted over the city down to the street, tap anywhere for a reading, plus the best window to go out today.

6/ "purest places" — the districts breathing lightest right now, ranked on the live field, and stays ranked by the air at each door. No hardcoded anything.

7/ Underneath: a real physics stack — ~52 live ground stations + model samples rebuilt into a kriged field every 15 min, our own C++ engine pricing ~900k road edges, dose integrated per segment. The same API serves the Android app, iOS build, and an operator dashboard.

8/ Built solo on AWS (ECS Fargate, NLB, CodeBuild, ECR, S3, DynamoDB, Secrets Manager) for the Environmental Hacks hackathon. Try it — it works today, in Delhi: https://delhi-is-alive.vercel.app/app

## 60s judge demo script (web)

1. Open the landing (`delhi-is-alive.vercel.app`) — scroll to "the app, running live": the phone frame runs the real app. Click "open the app →".
2. Consent → "drop a point on the map" → pin near Connaught Place → home card shows live pm2.5/pm10/no₂ + freshness.
3. Door "where to" → type "ISKCON east of kailash" → resolves → pick "health maxer" → car → real options with dose µg + via-names.
4. "start journey" → simulated preview (honestly labeled) → arrival receipt with dose graph + WHO context.
5. "air around me" → tap the map → readout + best-window card.
6. "purest places" → ranked districts → tap one → env card + stays.

Every number is from the live API — nothing canned. If a screen's data is unreachable it says so rather than faking it.

## One-liner

alive — the map that prices your trip in what you breathe, not just how long it takes.
