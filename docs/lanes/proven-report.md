# proven — "is this really my air" provenance on the home hero

**Verdict:** the hero's one provenance line now answers the owner's question
verbatim — where the number was read, *which named instrument* fed it, and how
old the read is — in every position state. Two dishonest states shipped in prod
are dead (below). NEEDS_DEPLOY = yes (copy + placement only, `server/webapp`).

## Lies found in the before state (verified against prod /aqi + staged DOM)

| state | before rendered | why it lied |
|-------|-----------------|-------------|
| GPS granted, no fix yet | eyebrow `the air around you` + `read near New Delhi · nearest live monitor ~1.7 km away` | `meta.atGps` evaluated to `null` (not `false`) when `pos` was null → fell through to the "at your location" branch while `/aqi` had actually been called at the `A.DELHI` fallback. The number was the city read labelled as yours — the exact thing the owner asked about. |
| dropped pin | eyebrow `the air near central Delhi` + `location is off… turn it on` | `pos.picked` made `atGps === false`, lumping pins into the off bucket: a pin read claimed to be central Delhi *and* told the user to turn location on. |
| any positioned read | `read near near Syndicate Bank-Parivahan Bhawan New Delhi · nearest live monitor ~1.6 km away` | cited the reverse-geocoded *address* (with a double "near near" bug when the label itself starts with "near") and left the actual monitor anonymous. |
| beyond edge | `closest live monitors cover Delhi's core — this is their nearest read` | soft-pedalled: server semantics are *nearest-edge extrapolation, not a local read*. |

## After — one line, ink3, same quiet-eyebrow voice

State machine (`heroData().meta.state`, replaces the two-value `atGps`):

| state | trigger | rendered |
|-------|---------|----------|
| `live` | consent granted + `pos` + fix < 2 min | eyebrow `the air around you` · `from {stationName} · {km} km away · read {m} min ago` — shot: `from SPM-SPC Talkatora Garden · 1.6 km away · read 6 min ago` |
| `pin` | `pos.picked` | eyebrow `the air at your pin` · `at your pin · from {stationName} {km} km · read {m} min ago` — shot: `at your pin · from Mandir Marg 3.9 km · read 6 min ago` |
| `stale` | granted + fix ≥ 2 min (silent re-lock in flight — `refresh()` re-locates past 60 s, so this is transient) | eyebrow `the air around you` · `at your last fix · from {stationName} {km} km · read {m} min ago` |
| `off` | no usable fix → `/aqi` fell back to `A.DELHI` | eyebrow `the air near central Delhi` · `location is off or hasn't locked yet — turn it on for the air where you actually are · read {m} min ago` — the eyebrow and the line both say *city read*, never "your air" |
| beyond edge | `beyond_field_edge` (any positioned state) | `outside the live field — the nearest edge's read, not the air where you are` — honest per `airfield.beyond_field_edge`: edge-evidence extrapolation, **not** a "city average" (the brief's suggested wording would itself have been a lie) |

Station name is **cited, never invented**: `/aqi` serves `field.stations[]`
(the same `_stations_live` list the server's `nearest_station_km` is computed
over). The webapp argmins it under the server's own constants
(`airfield._KY=110.6`/`_KX=99.4`) — verified live: argmin distance == wire
`nearest_station_km` exactly (1.7 == 1.7 → "SPM-SPC Talkatora Garden").
`stationLabel()` only trims the feed's repeated `, Delhi(, India)` tails
(`Mandir Marg, Delhi, Delhi, India` → `Mandir Marg`).

Honest degradation: no station name in payload → `nearest live monitor ~{k} km`;
no `km` either → existing `no live monitors feeding the field right now`
strings (per-state leads kept); `field.age_s` absent → the age clause drops.

Style: `.hs-prov` ink4 → ink3 (same 13px quiet register as `.hs-proglbl`/
`.hcard-title`); no new boxes, borders, chips, or components.

## Verification

Playwright-core + system Chrome, `server/webapp` served statically, `?api=`
pointed at prod NLB (`build_sha 9bf64497`); each state staged via
`localStorage alive.consent/pos` + geolocation permission. Screenshots:
before-off/after-off, before-live/after-live, after-pin, after-stale,
after-edge attached to the lane reply.

## Files

`server/webapp/home.js` (+state machine, station argmin + label, per-state
strings), `server/webapp/home.css` (`.hs-prov` ink3), this report.
