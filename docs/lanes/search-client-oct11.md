# Lane S — search client (Oct 11)

Files: `server/webapp/search.js` (rewritten tiers + ranking), `server/webapp/digipin.js` (India Post port).
Harness (not in repo): `/home/govinda/alive-dev/search/` — `before.mjs`, `after.mjs [--type] [--base URL]`,
`offline.mjs` (mocked network, 15 checks), `digipin_test.mjs`, `dbg.mjs "<q>" lat lon`.

## API (for lane W and other screens)
```js
const cancel = A.search.live(q, bias, (rows, { final, stage }) => { … }, { enter: false });
// rows: [{name, sub, kind, lat, lon, dist /*metres|null*/, source, key}] — merged, ranked, deduped, ≤10
// stage: 'digipin' | 'carry' | 'cache' | 'ac' | 'engine' | 'providers' | 'photon' | 'overpass' | 'anchors' | 'final'
// final:true arrives exactly once (≤ ~4.5 s worst case) unless cancelled → show "no place found" only then.
// opts.enter = user pressed Enter: deep tier now, Nominatim allowed.
A.search.search(q, bias, { enter }) → Promise<rows>   // unchanged contract, same tiers, never Nominatim unless enter
A.search.inArea(lat, lon)  // NCR + outskirts box 27.6–29.9N, 75.9–78.5E
A.search.inDelhi(lat, lon) // unchanged old Delhi box (home.js "outside Delhi" note still uses it)
A.digipin.encode(lat, lon) → 'XXX-XXX-XXXX' | null; decode(code) → {lat, lon} | null; match(text) → code | null
```
Call `live()` on every input event (≥2 chars; a 0–60 ms debounce is plenty). A new `live()` supersedes the
previous one automatically; calling the old `cancel()` right before it is fine too (same tick). The
superseded keystroke's in-flight tier-1 answer is adopted if the new text continues it, so the list
never blanks while typing over a slow index. Call `cancel()` when the input is cleared or the screen closes.

## Tiers
- **Tier 0 (sync):** DIGIPIN → exact row (then `/v2/reverse` names it); previous list re-ranked for the new
  text (narrowing) + response cache (backspace repaints instantly).
- **Tier 1 (each keystroke):** `/v2/ac` ∥ `/v2/p/ac`, 1.5 s timeouts. `/v2/ac` 404/HTML → `/v2/search`
  for the page-load; 2 timeouts → `/v2/search` for 60 s. `/v2/p/ac` `{configured:false}` → silent, not
  re-asked for 10 min; 404 → silent for the page-load. Each answer paints the moment it lands; at most one
  repaint per 90 ms; rows already on screen get a small hysteresis bonus (no wild reshuffles).
- **Tier 2 (deep):** only after a ≥700 ms pause, on Enter, or when tier 1 has nothing decent. Photon (also at
  600 ms if nothing is on screen yet), engine with the cleaned variant, Overpass name scan (±35 km around the
  user, not the whole box), `/v2/p/geocode` when the text looks like an address, anchor decomposition
  (resolve the trailing locality, cluster vote, rows near it gain coverage + gravity). Hard 3.5 s cap
  (`Promise.race` + abort). Every slow layer is wrapped in `within()` so it never holds the anchors stage.
  Engine fan-out per deep run cut from ≤12 calls to ≤5 (prod and the local server choke otherwise).
  Nominatim only with `enter`.

## Ranking (B)
Words are classed: name / number / kind (bakery, mandir, metro, station…) / region (delhi, ncr) /
structure (block, sector, nagar…) / connector. `new` and `delhi` are no longer dropped (STOP now feeds only
the anchor logic). The **lead** (first name word or number) must be in the row's NAME; subtitle-only hits
of name words count half ('Amar Bakery · Pawan Poria F/S' never answers 'pawan bakery'). Rows holding every
required word (last word as prefix, 1-typo tolerance on ≥5 letters, numbers exact) get +1.2 over partials.
Plus: proximity, tight names over long ones, exact-name bonus, engine/provider order, area kinds for
kind-less text, landmark-named hotels/agents demoted (and never count as a "decent" stop), number mismatch
penalty, provider address hit +0.9 when the text has a house/block number. Gate: no lead in name and <50%
coverage → hidden; at final, if nothing passes, the closest partials (incl. the resolved locality) show.

## Hygiene (D)
Raw tags → plain words (`amenity:place of worship` → place of worship, `overture:event_venue` → event venue,
`hindu_place_of_worship` → temple, `administrative` → area…); subtitle parts equal to the name dropped;
same name within 250 m (15 km for areas) collapses; `dist` always metres from the bias (null without bias).

## DIGIPIN (E)
Port of `INDIAPOST-gov/digipin` `src/digipin.js` (Apache-2.0, attribution in the file header). Vector
28.70486848, 77.10376044 ↔ `39J-J56-7L7P` (official: `39JJ567L7P`); 20,000 random NCR points: encode and
decode identical to the official code (0 mismatches). `match()` accepts any case, dashes/spaces, a
`digipin:` prefix; a bare 10-digit string is accepted only in 3-3-4 shape (phone numbers stay text).

## Before / after (node harness, real `search.js`, prod API https://d2eh2l2ys9wkij.cloudfront.net)
Before = old `search()` (full cascade, measured 17:33). After = `live()` cold (17:59, prod `/v2/ac` and
`/v2/p/*` not deployed → `/v2/search` fallback). TTFR = time to first rows on screen.

| query (bias) | before: time · #1 | after: TTFR · final · #1 |
|---|---|---|
| new delhi railway station (CP) | 491 ms · Minto Road railway station ✗ | 417 ms · 418 ms · New Delhi Railway Station ✓ |
| iskcon east of kailash (Ashok Nagar) | 5261 ms · Hare Krishna Associates ✗ | 244 ms · 1332 ms · ISKCON Temple (Raja Dheer Sen Marg, East of Kailash) ✓ |
| jama masjid shahdara | 6434 ms · creative_jama (school) ✗ | 826 ms · 2877 ms · Jama Masjid (Old Delhi, 7.5 km) ~ |
| pawan bakery c block hanuman mandir ashok nagar shahdara | 14254 ms · Makoons school ✗ | 2905 ms · 4503 ms · New Ashok Nagar Bridge (locality fallback) ✗ |
| neelanchal dham sant nagar (CP) | 10655 ms · Sanatan Dharm Mandir ✗ | 2908 ms · 4503 ms · Sant Nagar (locality fallback) ~ |
| sonipat (CP) | 1659 ms · Sonipat ✓ | 1533 ms · 1533 ms · Sonipat ✓ (prod engine slow at that minute; 57–449 ms other runs) |
| sector 150 noida (Gr. Noida) | 3383 ms · Sector 150 Project noida | 3464 ms · 4102 ms · Sector 150 Project noida (engine 3.4 s) |
| 39J-J56-7L7P | 4359 ms · nothing ✗ | 1 ms · 158 ms · exact DIGIPIN row ✓ |

Typing simulation (one `live()` per keystroke every 170 ms, fresh page-load, prod):
- new delhi railway station: rows on screen before the next key on **24/24** keystrokes (median 1 ms, via
  carry/adoption); final 312 ms after the last key.
- iskcon east of kailash: 20/21; final 3.7 s after the last key → ISKCON Temple Delhi, ISKCON Temple, ISKCON Delhi Auditorium.
- sector 150 noida: 10/15 (the index answers 1–3.5 s at that minute).
Before: every keystroke ran the full cascade (0.4 / 5–7 / 10–16 s) and the list said "Searching…" until it ended.

Local full server (`:8108`, lane X's `/v2/ac` live, 17:55): new delhi railway station TTFR **63 ms** (final 64 ms);
iskcon east of kailash TTFR **9 ms**. (The server went down mid-run; numbers for the rest are not representative.)

Browser (`browser.mjs`, headless Chrome on the devproxy :8110 = these files + prod API): `live()` runs with
relative URLs, no errors from search.js/digipin.js; NDLS final 638 ms, sonipat 187 ms, DIGIPIN 1 ms;
`/v2/ac` and `/v2/p/ac` correctly detected as not deployed on prod (`missing`).

Lane W (`whereto.js`) already feature-detects `A.search.live` (onQ → runSearch): compatible as is.
Optional: its non-final filter `rowMatches()` could use the new `row.full` flag (counts aliases, one typo
and "inside the named locality"), so e.g. 'jama masjid shahdara' rows show before the final word.

Offline (`offline.mjs`, mocked network): 15/15 PASS — name-first, new/delhi kept, outskirts kept / out-of-box
dropped, tags plain, duplicates collapsed, ac→providers→one final, unconfigured provider silent, `/v2/ac` 404
fallback not retried, no Nominatim while typing, Enter allows Nominatim, slow layers cut by the cap,
DIGIPIN synchronous, next keystroke repaints synchronously from carry.

## Open issues / honest gaps
- First-rows latency is bounded by the index: prod `/v2/search` swung 0.15 s → 4.5 s (timeouts) during this
  session, and the shared `:8108` server went down twice. `/v2/ac` (lane X) is what makes <400 ms real.
- "pawan bakery …", "neelanchal dham …": no index we can reach has the place; we show the resolved locality
  instead of nothing. Ola/Mappls (`/v2/p/ac`, `/v2/p/geocode`) are wired and rank address hits high, but
  were `configured:false` / 404 everywhere — untested with real provider rows.
- "jama masjid shahdara": depends on whether the engine returns the Shahdara-side mosque rows (varies by
  run); with them, anchor gravity puts them first (seen in one run), without them the Old Delhi one leads.
- Junk rows (e.g. "2025 New Delhi railway station stampede") are lane X's purge; the client only demotes.
- `search()` callers (airmap, purest) still fire per keystroke with their own debounce; they now get no
  Nominatim and a capped deep tier, but should move to `live()` for progressive paint.
