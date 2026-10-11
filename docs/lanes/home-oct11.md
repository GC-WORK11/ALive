# Lane H (home) — Oct 11

Files changed (only these): `server/webapp/home.js`, `home.css`, `settings.js`, `settings.css`.
Not touched: `server/v2/day.py`, `server/v2/outlook.py` (no server change needed; no Python edited).
Pre-change copies: `/home/govinda/alive-dev/h/*.orig`.

## What changed

### 1. Consent: one short intro, then one sheet
- Intro (first run only): "Alive" wordmark, "DELHI · RIGHT NOW", the live AQI for central Delhi in its band
  colour + band word, "You can't see it. You still breathe it.", and a **Continue** button.
- The sheet slides up over the dimmed intro (the live number lifts clear of it):
  **Use your location?** / "Your location is only used to analyse the air around you. It stays on this phone."
  - Trip-sharing switch **Share my trips** with the line "Alive counts trips anonymously — never where you go,
    unless you choose to share trips." **Off by default**; writes `alive.settings.share`.
  - **Share my location** → real `navigator.geolocation` prompt (A.geo.locate). Only a successful fix sets
    `consent='granted'`. If the browser blocks it: plain note "Location is blocked for this site in your browser.
    Drop a point instead — it works the same." If there's no fix: "Couldn't find you just now…". The sheet stays open.
  - **Drop a point on the map** → `consent='picked'`; home turns into the map picker (card: "Tap the map where you
    are — the air reads there." + Use my location / Cancel); the tap stores `alive.pos {lat,lon,t,picked:true}`.
  - **Not now** → `consent='later'` (no nagging on reload), toast "Showing central Delhi's air — not your exact
    spot". The hero then reads "Central Delhi's air" with "Location is off — this is central Delhi, not your
    spot." and a **Set location** button that reopens the sheet (no intro).
- Keys: `alive.consent` 'granted'|'picked'|'later', `alive.onboarded` 1, `alive.pos`, `alive.settings.share`.
  Other screens only ever check `consent === 'granted'`, so 'later' changes nothing for them.
- home.js renders the sheet into `#consent` when the script loads (whatever screen boots, app.js un-hides
  this sheet, not the old frozen card). It keeps hidden `#consent-yes` / `#consent-skip` buttons because
  app.js `boot()` calls `querySelector(...).addEventListener` on them (without them, boot would throw).

### 2. Home hero = the exact spot
- Big number = **AQI** in its band colour + band word; **PM2.5** and **PM10** (µg/m³) side by side, each with a
  dot in its own band colour; one plain line for the band; the provenance line
  "from {station} · {km} km away · read {m} min ago". The "read" age keeps counting between polls.
- Eyebrow names where the number is for: Air where you are (GPS fix < 2 min) / Air at your last fix /
  Air at your pin (+ **Change**) / Finding you… / Central Delhi's air (+ **Set location**).
- Dose ("You've breathed ≈ 43 µg today") is now a small secondary row that opens Trips, shown only when the
  on-device day log counts the day (same reconstruction as before, never uploaded).
- Clear states for waiting, empty and failure: grey placeholder + "Reading the air here…" (8 s timeout) → "Couldn't read the air
  just now." + **Try again**; outside the coverage area → "Alive covers Delhi and the NCR — this spot is outside it."
- Fixed bug: QA-style seeds (`consent='picked'` + `pos` without `picked`) used to read at the pin but say
  "the air near central Delhi". The state now follows the consent.

### 3. Removed from home
The "in Delhi's air right now…" card, "the move" card, "the days ahead", "how you felt", the budget card,
"your day", the week strip, the hero curve, the band scale, and the "your count starts…" / "same air = AQI on
other apps" captions. No more `/v2/day`, `/v2/outlook` or `/v2/city` calls from home.
Entries kept: **Where to?** pill, **Air around me** (airmap), **Purest places** (purest), **Trips** (ledger).

### 4. Settings
Only: **My vehicle** (7 class chips; writes `whereto.vehicle {cls,…}` + `settings.vehicle`), **Language**
(English / हिंदी → toast "Hindi is on its way"), **Share my trips anonymously** (default OFF; the caption matches
trip.py: no name or account, first and last 300 m cut off), **Delete my data** (wipes `alive.*`).
`DEFAULT_SETTINGS.share` changed from true to **false** in both home.js and settings.js. Destructive row is ink,
not a band hue.

## Data sources (nothing invented)
- `GET /aqi?lat&lon` (main.py `aqi()`):
  - `pm25` = station-kriged field × smoke modifier.
  - `pm10` = `FIELD.value(lat,lon,"pm10")`, which is station-grounded. airfield.py bias-corrects the model's
    pm10 with the WAQI/DPCC pm10 instruments (≥8 stations), and instrument rows enter at 3× weight.
  - `nearest_station_km`, `field.stations[]` (the named monitor is the argmin under the server's own km constants),
    `field.age_s`, `beyond_field_edge`.
- **AQI = CPCB national index** = max(PM2.5 sub-index, PM10 sub-index) through CPCB breakpoints (the PM2.5 table is
  `server/districts.py _CPCB_PM25` verbatim; PM10 0-50/51-100/101-250/251-350/351-430/430+). The band colour
  and word are that index's CPCB category, so number, colour and word always agree (they come from the existing
  6-colour palette).
  - `/aqi` also serves `us_aqi` (US-EPA). I didn't use it as the hero because its scale doesn't match the CPCB band
    words (e.g. US 174 would sit next to "poor", while CPCB calls 174 "moderate").
  - Live at 17:4x IST: Ashok Nagar PM2.5 60 / PM10 192 → AQI 162 Moderate (US 152), from ITI Shahdra 1.9 km.
    CP PM2.5 57 / PM10 141 → AQI 128 Moderate, from Mandir Marg 1.6 km.
- The plain line per band is CPCB's own "possible health impacts" statement in plain words (no advice of our own).

## Verification (`/home/govinda/alive-dev/h/verify.mjs`, dev URL :8110, 390×844 DPR3, headless Chrome)
42/42 checks pass, **0 console errors**. Screenshots are in `/home/govinda/alive-dev/h/shots/`:
- 01 intro · 02 sheet · 03 GPS → home (Ashok Nagar) · 04 pick mode · 05 pin tapped at CP on the map → home ·
  06 Not now → home · 07 sheet reopened · 08 location blocked → note · 10 seeded homes at 320/360/390/430
  (CP + Ashok Nagar) · 11/12 intro + sheet at 320×568, 360×740, 430×932 · 13 dose row · 20/21 settings.
- Checks: hero text has AQI + PM2.5 + PM10 matching `/aqi`; stored keys; reload shows no popup after any choice;
  no horizontal overflow at 320/360/390/430; every visible tap target ≥ 40 px; sharing is OFF by default and
  toggles in settings.
- `node --check` passes for home.js and settings.js.

## Open issues / for other lanes
- The console filter drops one external 404: `POST /v2/tally` from lane A's new telemetry.js. Prod doesn't serve it
  until the next deploy.
- `motion.css` lines 97–99 (`.onb-skip`, `.onb-loclater`) target onboarding markup that is gone → coordinator can
  delete them. `app.css` `.consent-card*` rules are now unused, which is harmless.
- The trip upload (lane A / journey) must read `A.store.get('settings').share === true` before sending any trip with
  location. The default is OFF now; old installs keep whatever they stored.
- Hindi: the toggle is present, but only an English build exists.
- The CPCB index here uses the current hour's PM, not the official 24-h mean, and leaves out the gases
  (gas fields in /aqi are raw model, not instrument-grounded).
