# 06 · Privacy — the government data platform

The privacy claim the platform makes to a buyer is structural, not
promissory: **the records a government would want to subpoena, leak, or
misuse do not exist.** Raw GPS never persists, per-trip rows never
persist, and every published figure is gated behind a minimum-count
rule. This document is the engineering basis for that claim — the
threat model, the aggregation pipeline step by step, the k-anonymity
and suppression rules, the differential-privacy option and when it is
honestly useless, the re-identification attack catalogue, the consent
semantics, the DPDP Act 2023 mapping, and a normative spec an RFP
evaluator can mark compliant/not-compliant line by line.

It covers the **telemetry path only**: opt-in trip donations
(origin/destination corridors, mode, times, dose) that power
traffic-state estimation and the government feed. Station ingest, air
fields, and routing carry no user data and are out of scope.

**Shipped-today vs feed-spec.** Where the consumer build and this spec
differ, the delta is stated plainly rather than hidden:

| parameter | shipped consumer build | this spec (gov feed) |
|---|---|---|
| publish threshold | k≥3 distinct devices (`server/agg_ddb.py` `K_MIN`, `server/community.py` `_K_MIN_DEVICES`) | **k≥5**, plus randomized margin (§3) |
| endpoint trim | 300 m both ends (`server/v2/trip.py` `TRIM_M`, client mirror `Mobile/src/nav/engine.ts` `TRAJ_TRIM_M`) | **500 m** + terminal-cell drop (§5) |
| token hash | unsalted `sha256(token)[:16]` (`trip.py:241`) | **HMAC with per-(day × cell) salt** (§2) |
| publication | live read endpoints | atomic hourly release, embargoed (§3) |

Everything else in this document describes what already runs.

---

## 1. Threat model — who sees what

### 1.1 Actors

| actor | what they can see | what they cannot see |
|---|---|---|
| **Government feed consumer** (transport dept analyst, RFP evaluator) | Published aggregates only: (cell, hour) counters, corridor stats, zone totals — every row behind k≥5 | Device identifiers (none exist in the feed), per-trip records, sub-threshold rows, trajectories, raw coordinates |
| **Government buyer, contract/legal layer** | The same feed + this spec + the verification suite | A demand for "the raw data" is unanswerable — there is nothing to produce. This is the strongest clause we can offer and it is structural |
| **ALive ops engineer** | DynamoDB aggregate items (counters + hashed-token sets under the current salt), template-only request logs, health metrics | Raw GPS (never persisted anywhere server-side), raw tokens (hashed before any store call), joins of device sets across cells or days (per-bucket salts, §2) |
| **Holder of a full DynamoDB dump** (leak, breach, or compelled disclosure) | Every aggregate: cell counters, day counters, hashed-token sets | The salt key (lives in Secrets Manager under a separate IAM path); the preimage of any hash (a 64-bit CSPRNG id nobody maps to a person); any coordinate or ordered path (never written) |
| **Network observer / TLS terminator / NLB** | Request timing, sizes, and request lines in transit | The donation payload (TLS body). We claim *we never write request lines down* (`--no-access-log`, denylisted app logger) — we do not claim infrastructure never sees them |
| **Sybil attacker** | Can mint unlimited fresh device tokens and donate fabricated trips | Cannot read anything extra — but can push a 4-device cell over the k threshold or inject fake mass. Acknowledged residual, §10 |
| **The user themselves** | Their own donated trip summaries via `GET /v2/ledger` + `X-Device-Token` | Other devices' rows (token is an unguessable bearer key), the aggregate layer's internals |

### 1.2 Data classes and where each lives

| data item | device | wire | request memory | DynamoDB | ops eyes | gov feed |
|---|---|---|---|---|---|---|
| raw trajectory (GPS points) | ✓ | TLS body, transient | < 1 s, transform only | never | never | never |
| trimmed/thinned cell list | derived on upload | — | ✓ | keys only | keys only | published as counts |
| raw `device_token` | ✓ (`contributor.txt`) | POST body / header | ✓ | never — hashed first | never | never |
| hashed token (`HMAC(...)[:16]`) | — | — | ✓ | ✓ (SS sets, for k-counting) | ✓ | never — sets are never published |
| per-trip summary (km, dose, mode, ts) | ✓ | body | ✓ | ledger items, token-keyed, user-deletable, 90 d TTL | ✓ | never |
| aggregates (counts, sums, sets) | — | — | ✓ | ✓ | ✓ | ✓ — only rows passing the publish gate |

Two rows carry the whole argument. **Raw trajectory**: one line of
"never" across every server-side column — a dump of the table, the
logs, and process memory after the request completes contains no
coordinate. **Hashed token**: exists at rest because the k-gate needs
distinct-device sets; the honest statement is "no per-trip records,"
not "no device-keyed state" (PRIVACY.md §Known gaps).

### 1.3 Trust assumptions, stated plainly

- The **device OS** is out of scope: a compromised phone exposes its own
  ledger and contributor id, nothing else, because nothing else exists
  on it.
- The **device token is a bearer key**: whoever holds it reads that
  device's ledger. Header transport keeps it out of URLs and logs;
  30-day rotation bounds exposure (`Mobile/src/community.ts` `ID_TTL_MS`).
- **Endpoint security of the buyer's own systems** is theirs: we deliver
  the feed to an S3 prefix or API; what their analysts do with printed
  aggregates is outside our control and inside their AUP.

---

## 2. The exact pipeline: device event → publishable aggregate

Every step is enforceable server-side; the client is treated as
friendly-but-untrusted (a buggy or hostile build cannot put anything
extra into the store because the server re-derives everything).

```
 STEP  WHERE                              WHAT HAPPENS
 ────  ─────────────────────────────────  ──────────────────────────────────
  0    device, consent.json               shareEnabled must be truthy — the
        (Mobile/src/store/consent.ts)     ONLY donation callsite sits behind
                                          it (engine.ts:381: `shareEnabled &&
                                          traj.length>1 && km>=0.1`). Gate
                                          off ⇒ the code path is unreachable,
                                          not just unwired.
  1    device, trip completes             build donation: summary{mode, km,
        (engine.ts:294-350)               duration_s, dose_ug, co2/pm25 mids,
                                          switched, notice_v}, trajectory
                                          [lon,lat]…, device_token
  1a   device, anchor suppression         client drops every point inside the
        (spec — client knows home/work;   saved home/work res-8 cells before
        the server never does)            trim, then trims first/last 500 m
                                          (shipped today: 300 m; the spec
                                          constant is 500 — one-line change)
  2    wire                               POST /v2/trip, JSON body, TLS.
        (server/v2/trip.py)               /observe (the old raw endpoint)
                                          answers 410 Gone — no second
                                          ingest path exists.
  3    server, in-request memory          validate: ≤5000 points (MAX_POINTS),
                                          MIN_TRIP_KM 0.1, MAX_SPEED_KMH 140,
                                          MAX_IMPLIED_PM25 900 — injections
                                          that can't be traversals refused
  4    server, in-request memory          TRIM first+last 500 m along-path →
                                          THIN ≤1 pt/100 m → ROUND 4 dp
                                          (~11 m) → DROP the two terminal
                                          res-8 cells (the anchor cells never
                                          enter the pipeline at all)
  5    server, in-request memory          each kept point → H3 res-8 cell id
                                          (≈0.74 km², ~1 km across). The kept
                                          list becomes a SET — ordering and
                                          duplicates die here. No chain is
                                          ever formed server-side.
  6    server, in-request memory          token → HMAC-SHA-256[:16] under
                                          per-bucket salt (below). Raw token
                                          never touches a store or a log.
                                          THE RAW PAYLOAD IS THEN DISCARDED —
                                          after this step no coordinate and
                                          no raw token exists in-process.
  7    DynamoDB alive108-agg              conditional ADD writes (agg_ddb.py):
        (PAY_PER_REQUEST, pk/sk,          day#<d>/sum + day#<d>/mode#<m>   += trips, km,
          TTL attr `ttl`, ap-south-1)        dose_ug, co2, pm25, switched
                                          cell#<h3>/cell   += count, dose_sum,
                                            km_sum; tokens SS ∪ {hash};
                                            last_ts=now; ttl=now+30d (refreshed
                                            each traversal — an idle cell's
                                            device set dies with the data
                                            that needs it)
                                          recent/hour#<h>  += trips, dose_ug,
                                            km, co2; devices SS ∪ {hash};
                                            ttl=ts+72h
                                          recent/hour#<h>#mode#<m> += trips
                                          global/area#<district>,
                                            od#<dist>#<dist> += trips, devices
                                          ledger#<hash>/trip#<ts> = sanitized
                                            summary row, ttl=+90d (the only
                                            per-trip records anywhere —
                                            keyed to a hash, user-deletable)
  8    publisher job (hourly, h+2 h)      reads the hour's buckets; applies the
                                          publish gate (§3); writes the feed
                                          artifact — all rows for hour h in
                                          ONE atomic release, embargoed +2 h
                                          so stragglers land and real-time
                                          correlation with street-level
                                          observation is broken
  9    feed artifact                      s3://<feed>/v1/hourly/YYYY/MM/DD/HH.json.gz
                                          + manifest.json (schema v, row count,
                                          suppressed count, SHA-256 of payload,
                                          methodology hash)
 10    expiry                             DynamoDB `ttl` attribute sweeps:
                                          hour buckets die at 72 h; cell items
                                          die 30 d after their last traversal;
                                          ledger rows at 90 d; day/lifetime
                                          counters are anonymized counts —
                                          retained (§8, with the honest
                                          argument for why that's defensible)
```

The salt scheme for step 6 — the piece that makes at-rest device sets
useless as join keys, including to us:

```
token_cell = HMAC_SHA256(K, token | day | cell)[:16]   → per-cell sets
token_net  = HMAC_SHA256(K, token | day)[:16]          → the network-wide
                                                         daily distinct count
K = server-side key in Secrets Manager, rotated; never written
  alongside the table; not needed to read the feed
```

- A device's hash differs in every cell and every day → set-intersection
  between two cells or two days yields empty sets even for the same
  device. An insider cannot trace a path across cells; a dump holder
  cannot link anything to anything.
- The salt's job is **unlinkability**, not brute-force resistance — the
  preimage is already an unguessable 64-bit id. We say that precisely
  because "salting" is often claimed for the wrong reason.
- Consequence: k-counting is only valid *within* one salt epoch (a UTC
  day). The publish gate therefore evaluates k on the current epoch's
  set; a device cannot be carried across epochs to inflate k. This
  *tightens* the gate at salt boundaries — documented, accepted.
- Shipped delta: today the hash is unsalted `sha256(token)[:16]`, so
  same-device sets *can* be intersected by an insider within the 30-day
  client rotation window. The HMAC wrapper is a small change at
  `trip.py:241`/`agg_ddb._add_cell`; the client rotates its id every 30
  days regardless.

---

## 3. k-anonymity: thresholds and suppression rules

### 3.1 What k counts, and why

k is **distinct salted device hashes in the bucket's set**, never trip
count. One device making ten trips is k=1 — a lone commuter must not be
able to mint a publishable row no matter how often they drive it. The
set representation makes repeat donations idempotent for free
(DynamoDB SS union).

### 3.2 Thresholds per published surface

| published row | bucket | threshold | notes |
|---|---|---|---|
| corridor cell row `{cell, hour, trips, devices, mean_dose_ug, mean_km}` | cell × hour | **k ≥ T_b**, T_b ∈ {5,6,7} per §3.3 | primary feed unit; store buckets are UTC epoch-hours (`agg_ddb.py:177`), the feed relabels in IST wall-clock for the buyer |
| corridor cell (standing corridor layer, `/v2` corridors) | cell, trailing 72 h | k≥5 AND `now − last_ts ≤ 72 h` | freshness gate mirrors shipped behavior |
| mode stratum | ward × hour | mode named only if ≥3 distinct devices used it in a ward-hour already at k≥5 | never at cell level — the "only cyclist at 3 am" stratum is unnameable |
| OD pair | district × district, day | k≥5 | district names only — no cell-pair ODs ever leave |
| ward/zone totals | ward × hour | k≥5 (de facto always) | computed **over published rows only** — §3.4 |
| city totals | day | n/a (city-scale counts) | same published-rows-only rule |

Mode pooling note: hours 23:00–05:00 IST collapse to a single night
bucket at cell level (the long tail is thinnest and most identifying
there); ward×hour mode shares stay hourly.

### 3.3 The margin is randomized, and publication is sticky

A fixed k≥5 line is probe-able: an adversary who knows exactly 4
devices are inside can watch the boundary. Two countermeasures:

- **Randomized threshold**: `T_b = 5 + (HMAC(K_rel, cell|hour)[0] mod 3)`
  → an effective threshold of 5, 6, or 7 per bucket, deterministic
  (auditable), secret (unpredictable to the adversary). Nobody can
  confirm "my +1 device was the one that flipped it."
- **Hysteresis**: once a cell clears the gate in the current salt epoch
  it stays publishable for the epoch — a cell cannot flicker
  published/suppressed/published and leak marginal arrivals.
- **Atomic release**: all rows for hour h publish together at h+2 h.
  No streaming deltas, so no ordering information within the hour.

### 3.4 Suppression rules (the important half)

1. **Suppressed rows are absent, not zeroed.** A `{trips: 0}` row would
   announce "1–4 devices were here" — which is itself the leak. The row
   simply does not exist in the artifact.
2. **Totals are sums over published rows only.** Ward and city figures
   published for hour h are computed from the *published* cell rows,
   not from the full table. Then totals ≡ sum(parts) by construction
   and **total-minus-parts differencing returns exactly nothing**
   beyond the disclosed suppressed mass. The methodology file states
   that totals exclude suppressed rows.
3. **Suppressed mass is reported as one rounded number per day**
   (`suppressed_trips ≈ N`, rounded to the nearest 10) — transparency
   about coverage without distributing the leak across buckets.
4. **Freshness suppression**: a cell whose newest traversal is older
   than 72 h does not publish regardless of k (stale anchors fade).
5. **Sum-guard**: rate-like fields (mean dose) publish only inside
   k-gated rows and are rounded (dose to 0.1 µg, km to 0.1) — rounding
   bounds the precision an attacker can difference on.
6. **No mode, no timestamp inside cell rows**: the feed's time field is
   the bucket label (`2026-10-10T08+05:30`), never an observed instant.

### 3.5 What k-anonymity does not claim

k≥5 bounds *published membership* to crowds of five; it is not a
differential-privacy guarantee, and a determined adversary who can both
inject devices and observe releases can still probe margins (§10). That
is why §4 exists — and why §4 has sharp limits.

---

## 4. The differential-privacy option — priced honestly

DP adds calibrated noise so that no single citizen's presence is
inferable from any output. It is the right tool at some layers and the
wrong tool at others; the arithmetic decides.

### 4.1 The sensitivity problem on trajectories

Laplace noise scales with **per-user contribution**. For a counting
release, `noise ~ Laplace(0, Δ/ε)`, std = √2·Δ/ε, where Δ is the most
buckets one user's data can touch in the release.

- A 10 km trip thins to ~100 points → dedupes to ~10–20 distinct res-8
  cells. With a contribution cap of B=16 cells per device per release,
  Δ=16 → at ε=1, **noise std ≈ ±23 trips per cell counter**. A true
  cell×hour count of 12 publishes inside roughly [−35, 60] — clamp to
  [0, 60] and it is still meaningless.
- For a single released *scalar* (city day-total), Δ = capped trips per
  device per day ≈ 4 → std ≈ **±5.7** against a count of thousands —
  noise is invisible.

Same mechanism, opposite verdicts — the only thing that changed was
how many buckets one user can touch.

### 4.2 Decision table

| surface | typical count | DP? | ε per release | noise std | verdict |
|---|---|---|---|---|---|
| city × day totals | 10³–10⁵ | **yes** | 1.0 | ≈ ±6 | worth it — formal guarantee, invisible error |
| ward × hour | 50–500 | **optional** | 2.0 | ≈ ±3 | defensible when N ≳ 50 |
| corridor cell × hour | 5–30 | **no** | — | ±20+ | **ruins it** — noise exceeds signal at exactly the counts that matter |
| OD pairs, mode strata | 5–50 | **no** | — | — | suppress + coarsen instead |

**When DP is worth it:** (a) large-N counters where relative error is
negligible and the buyer gets a quantifiable "no single citizen
detectable" clause; (b) *repeated* releases over the same population —
k-anonymity alone leaks via differencing across successive snapshots,
DP bounds cumulative inference; (c) when an RFP demands a formal,
auditable privacy parameter.

**When it ruins the data:** anywhere the true count sits within ~3σ of
zero — i.e., every cell×hour bucket. Clamping negatives biases results
upward; suppressing noisy-negatives biases downward; either way the
buyer's planners get numbers that lie *differently* than suppressed
truth. For small counts, **coarsening beats noise**: res-7 cells
(≈5.2 km²), 3-hour windows, or district ODs buy more privacy per unit
of utility than Laplace ever will at N=8.

**And the honest bound:** DP protects individuals *in* the data against
output inference. It does nothing against injected fake devices (a
fabricated trip is a real contribution — noise doesn't filter lies) and
nothing against a buyer joining the feed to external per-person records
(CCTV, challan). Those need §5's countermeasures and contract terms,
not ε.

### 4.3 Budget accounting, if enabled

- Per-release spend: ε_r = 1.0 (day counters) / 2.0 (ward×hour).
- Per-user exposure = ε_r × max releases touching one user. With
  daily salt rotation a user is a fresh record each day; with a
  donation cap of 4 trips/day, per-user-day ε ≤ 4·ε_r (basic
  composition — the conservative bound, stated as such).
- The accountant is a DynamoDB item (`pk=dp#budget, sk=<day>`) logging
  ε spent per surface per release; the feed manifest carries the day's
  cumulative ε so the buyer can audit spend independently.
- Composition across surfaces uses basic (sequential) composition —
  stated plainly rather than claiming RDP tightness we haven't audited.

**Recommended posture:** Phase 1 ships k≥5 + randomized margin +
hysteresis + atomic embargoed release (§3) — no DP. Phase 2 adds DP on
city×day and ward×hour counters only, behind the budget ledger.
Cell×hour stays suppression-gated forever; that is the layer where
noise is destructive.

---

## 5. Re-identification attacks on trajectory aggregates

The catalogue is written attack-first, countermeasure-second, residual
last. "Aggregates" are not automatically safe — these are the ways they
fail, and what stands in the way.

| # | attack | precondition | what it yields | countermeasures | honest residual |
|---|---|---|---|---|---|
| A1 | **home/work anchoring** — trip ends cluster near a donor's home (night) and workplace (day); over weeks the pattern localizes both | frequent donor | probable home/work cell of one device | 500 m trim + terminal-cell **drop** (nearest evidence ≥2 cells away); client-side home/work cell suppression (device knows them, server never does); feed counts *traversals* not endpoints — through-traffic dilutes the anchor ring; 30-day client rotation + daily salt caps accumulation | the "doughnut": a suppressed anchor surrounded by high ring density can point inward; bounded by ~1 km trim+drop radius. Spec'd (not yet built): per-token endpoint-frequency detector — same surviving end-cell ≥3× in an epoch → excluded from that device's donations |
| A2 | **snapshot differencing** — watch consecutive releases; a cell that +1s right after a known donation outs that donor | observer knows someone's donation time | confirms presence; chained, reconstructs a route | atomic hourly release (all rows land together — no ordering inside an hour); +2 h embargo; randomized threshold T_b; hysteresis | a patient adversary still bounds presence probabilistically at low-traffic cells; formally closed only by DP, which is uneconomic at these counts (§4) |
| A3 | **cross-bucket set intersection** — the k-counting device sets themselves can be joined across cells/hours to trace one hash's movement | insider or dump holder | per-device movement skeleton | per-(day×cell) HMAC salts → intersections are empty *by construction*; sets are never published; sets expire with items (72 h / 30 d) | shipped build is unsalted — cross-cell joins possible inside a rotation window until the HMAC change lands. Stated, scheduled |
| A4 | **quasi-identifier join** — buyer crosses (cell, hour) with CCTV/challan/toll sightings of a specific person | external per-person record | "person X was in this crowd of ≥5" | hour granularity (~1 km² cells): a sighting narrows to a crowd, not a person; no exact timestamps in feed; contract clause: feed may not be joined to per-person records (§9 P-15) | k=5 crowds are small; with repeated sightings an adversary intersects crowds. Mitigation is contractual + the option of res-7 coarsening for sensitive geographies |
| A5 | **membership/attendance inference** — "was X at the clinic/protest cell this hour?" | knows target donates | boolean presence in a crowd | same as A2; plus presence is only ever provable as "one of ≥5" | bounded, not eliminated — say so in the RFP rather than overclaim |
| A6 | **OD-linkage** — origin×destination pairs re-identify ("only family that goes Saket→Sainik Farm") | OD rows | a household's commute signature | ODs publish at **district×district** granularity only, k≥5, day buckets | district ODs can still be small-town-identifying in low-volume pairs → suppression applies; never publish cell-level ODs |
| A7 | **injection / Sybil** — mint fresh tokens, donate phantom trips to force a cell over k, or fabricate mass | none (unauthenticated donations) | corrupts counts; flips suppressed→published | plausibility floors at ingest (MIN_TRIP_KM, MAX_SPEED_KMH, MAX_IMPLIED_PM25 — a fake traversal must still be a *physical* traversal); randomized margin makes boundary probing unreliable; per-IP rate limits | **open, stated**: free identity minting can't be fully closed without attestation. Roadmap: App Attest / Play Integrity at donate-time. DP does not fix this |
| A8 | **ledger/token capture** — stolen device_token reads that device's trip history | physical/logical access to token | trip summaries (no coords, no cells by design) | token is bearer-only and rotates every 30 d; travels in `X-Device-Token` header (never a URL → never in logs/history); delete-my-data wipes both ends | bearer model stands — like a private photo-share link; possession = access, by design (no accounts) |
| A9 | **accumulation inference** — the same anchor cells republished hourly over months sketch a routine | long-lived published cells | routine contours of a neighborhood | daily salt epoch bounds device-level accumulation; cell items die 30 d after last traversal; 72 h freshness gate | counters themselves are eternal (they're anonymous); accumulation reveals neighborhood texture, never a person — defensible, disclosed |
| A10 | **empty-set signalling** — suppressed-but-obviously-nonempty areas announce that *someone* was there | observer watches for absences | "1–4 devices were here" | absence is indistinguishable from truly-zero: totals exclude suppressed rows (§3.4(2)), and no cell list is published to diff against | a determined adversary with perfect area knowledge can still suspect; the leak is a bound (≤4 trips), never an identity |

---

## 6. Consent UX — genuinely opt-in, and honest

The toggle already in the app is the consent mechanism; this section
documents its exact semantics because the RFP will ask.

### 6.1 The shipped semantics

- **Canonical record**: `consent.json` on-device —
  `{seen, sharing: "on"|"off"|null, ts}` (`Mobile/src/store/consent.ts`).
  `null` until answered; the settings toggle mirrors it both ways
  (`App.tsx:945-948`, `onOnboardDone` → `patchSettings`).
- **First-run gate**: a dedicated consent step the swipe can't pass
  ("past it, forward swipe is dead" — `OnboardingScreen.tsx:64`). Two
  equal-weight buttons, **no pre-selection**:
  - *"Share trips anonymously"* — "helps Delhi see its air, street by street"
  - *"Keep everything on my phone"* — "nothing is uploaded — you can turn it on later"
  - Footnote: *"Skipping keeps everything on this phone — either way,
    one tap in Settings changes it."* (English + Hindi ship today,
    `i18n/strings.ts:465-471, 1728-1734`.)
- **One toggle, real semantics**: Settings → "Share anonymous trip data".
  OFF ⇒ the only donation callsite is unreachable (`engine.ts:381` —
  the `shareEnabled &&` is *inside* the arrival handler, evaluated per
  trip, not at app start). The app is **fully functional with sharing
  off**: routing, dose, the personal ledger, Delhi-today all work —
  consent is unconditional because nothing is withheld for refusing.
- **What a donation is**: fired once per completed guided trip ≥0.1 km;
  if offline it sits in `outbox.json` *on the device* until the network
  returns (`offline/queue.ts`) — "queued" never means "uploaded anyway."
- **Withdrawal = grant, reversed**: same toggle, same effort. Toggle off
  → next trip donates nothing; Delete-my-data wipes `consent.json`,
  `settings.json`, `contributor.txt`, `ledger.json`, the outbox, URL
  caches, and calls `DELETE /v2/ledger` server-side
  (`settings.ts:121-151`, `App.tsx:95-98`).
- **Said plainly in-product**: aggregates can't be un-donated — after
  hashing+folding no record maps back. The consent copy says what
  *leaves* ("anonymous, trimmed trips"), and PRIVACY.md says what can't
  come back. Honesty about the irreversibility is part of the consent.

### 6.2 What "honest consent" requires, as a checklist

| requirement | how it's met |
|---|---|
| affirmative action | explicit tap; `null` default; swipe-past is impossible; skip ⇒ off |
| specific purpose | consent copy names the use ("anonymous, trimmed trips → the air map"); §7 notice expands it |
| informed | "Privacy & sharing" screen lists exactly what is donated (trimmed corridor cells, summary numbers) and what is never sent (name, phone, account — *no account exists* — exact GPS endpoints, timestamps) |
| unconditional | every feature works with sharing off — no degraded service, no repeated nagging |
| unambiguous | binary buttons, equal visual weight, no pre-ticked anything |
| withdraw as easily as given | one tap in Settings; withdrawal consequences (aggregate non-retractability) disclosed *before* the choice, not after |
| evidence | donations carry `notice_v` (the notice version accepted) → day counters can tally consent-version coverage — demonstrable consent without a consent database that would itself be personal data |

The consent record living only on-device is deliberate: a server-side
"consent database" would be the first table of identified users we ever
kept. `notice_v` tallies are the auditable substitute.

---

## 7. DPDP Act 2023 — obligations mapped

The Act (22 of 2023) and the DPDP Rules, 2025 (notified 13 Nov 2025,
G.S.R. 846(E)) phase in: §§18–26/35/38–44 already in force; consent-
manager provisions at +1 yr; the core obligations (§§3–5, 6(1)–(8),
7–17) at +18 months ≈ **May 2027**. This spec builds to them now.

### 7.1 Scope analysis — the argument that matters

- "**Personal data**" = data about an individual *identifiable by or in
  relation to* such data (§2(t)). Our position, stated precisely:
  - **In scope**: the transient trajectory during the <1 s server-side
    transform; the donation payload in flight; the token-keyed ledger
    rows (pseudonymous — a holder of the bearer token retrieves a
    person's trip history). We run full consent + rights machinery on
    these.
  - **Out of scope**: published aggregates and the post-fold counters —
    no individual is identifiable in relation to k≥5 crowd counters.
    This is *why the pipeline exists*: it makes the data product
    non-personal rather than asking the Act to look away.
- §3(c) note: we do not rely on the "publicly made available by the data
  principal" exclusion or the §17 research/statistics standards —
  **consent is the basis** (§4(1)(a)), not a legitimate-use or
  exemption argument.

### 7.2 Obligation → implementation

| DPDP provision | obligation | implementation | status |
|---|---|---|---|
| §5 | notice before/with consent: what data, purpose, how to exercise rights, how to complain to the Board | consent screen + "Privacy & sharing" page carrying all four items; English + Hindi shipped, expandable to Eighth-Schedule languages | shipped; add Board-complaint wording to the page |
| §6(1) | free, specific, informed, unconditional, unambiguous consent by clear affirmative action, limited to necessary data | §6 checklist above — the donation path collects no field the pipeline doesn't use | shipped |
| §6(4)–(6) | withdrawal as easy as grant; consequences stated | one-tap toggle; non-retractability disclosed pre-consent | shipped |
| §7 | (not relied on) | — | — |
| §8(2) | processor only under valid contract | AWS as processor under the DPA; no other processor touches telemetry | shipped |
| §8(4)–(5) | technical+organisational measures; reasonable security safeguards | TLS; no access logs (uvicorn `--no-access-log`, denylisted template logger); IAM scoped to `alive108-agg` actions only (`scripts/deploy.sh:166`); DDB server-side encryption; minimization as architecture | shipped; Rules ask ≥1 yr processing-log retention — our logs are template-only aggregate ops lines, kept in CloudWatch |
| §8(6) | breach intimation to the Board **and each affected Data Principal** (Rules: Board within 72 h) | no contact channel exists — spec: in-app banner + public notice + Board filing within 72 h; a "breach" of aggregate counters risks no data principal, and we say so in the notice | spec'd — needs runbook entry |
| §8(7) | erase on withdrawal / purpose end | `DELETE /v2/ledger` (the only person-keyed rows); TTL sweeps (§8 table); aggregates are non-personal at that point — disclosed rather than silently relied on | shipped + disclosure |
| §9 | children: verifiable guardian consent; no tracking/behavioural monitoring/ads at children | spec: donation consent restricted to adults (age affirmation on the consent screen); the app itself is navigation — no ads, no behavioural tracking, of anyone | to confirm with counsel — flag, don't assert |
| §10 | Significant Data Fiduciary extras (DPO in India, DPIA, audit) | not a notified class at current scale; this document + `docs/privacy/verify.md` is the standing DPIA-lite; reassess if user base or designation changes | monitor |
| §11 | right to access own data | `GET /v2/ledger` returns exactly what the device donated | shipped |
| §12 | right to correction & erasure | nothing to correct (no profile fields); erasure = ledger delete + device wipe | shipped |
| §13 | grievance redressal | published contact + 7-day SLA + in-app entry point | spec'd — needs a named officer |
| §14 | nominate | N/A materially (no account); note in the privacy page | — |
| §16 | cross-border restriction (notified-country list) | all telemetry processing in **ap-south-1 (Mumbai)**; for the gov deployment, the geocoder is Amazon Location in-region (or self-hosted) — the only EU sub-processor today (Photon, search text) drops out of scope for telemetry | shipped for telemetry; document the search-text path |
| Rules r.4 | consent managers registerable from Nov 2026 | architecture compatible (consent is already a discrete, recorded act) — no dependency | watch |
| Rules Sch.2 | state processing standards | if the platform is procured as a state instrumentality, the feed still meets the stricter of the two regimes by construction | n/a until procurement |

---

## 8. Retention schedule

| item | store | retention | mechanism |
|---|---|---|---|
| raw trajectory | device → request memory | **0** — discarded in-request | never persisted (`trip.py:106-114`) |
| ledger rows (`ledger#<hash>/trip#<ts>`) | DynamoDB | **90 d** | `ttl` attr (`agg_ddb.py` `LEDGER_TTL_S`); instant delete via `DELETE /v2/ledger` |
| hour buckets (`recent/hour#*`) | DynamoDB | **72 h** | `ttl = ts + 72 h` |
| corridor cell items (`cell#*`) incl. token sets | DynamoDB | **30 d after last traversal** | `ttl` refreshed on write — activity renews, silence deletes |
| day/mode counters, global areas/ODs | DynamoDB | retained — anonymized counts only | defensible because post-k-gate data is non-personal; spec'd rollup day→month after 13 months (not yet built) |
| community hour buckets | process + snapshot | **7 d** | `_HOUR_KEEP_S`, `community.py` |
| hazard reports | process + snapshot | **6 h** | `_REPORT_TTL_S` |
| RouteStore (plan geometries) | in-memory | **1 h**, cap 500 | `store.py:23-26` |
| contributor id | device | **30 d** then rotated | `ID_TTL_MS`, `community.ts` |
| access logs | — | **none exist** | `--no-access-log` + denylist logger |
| consent record | device only | until wipe | `consent.json`; `notice_v` tallies carry the server-side evidence |
| feed artifacts | S3 | versioned, lifecycle → Glacier | mirrors `infra/provision.sh` snapshot policy |
| salt key material | Secrets Manager | rotated; prior epochs' material destroyed — destruction *is* the unlinkability | key schedule, not data |

DynamoDB TTL expiry is eventual (AWS sweeps within ~days) — stated:
TTL is a deletion *guarantee horizon*, not a real-time erase; the
erasure SLA for user-initiated delete is the synchronous
`DELETE /v2/ledger` path, not TTL.

---

## 9. The spec an RFP can mark, line by line

Normative requirements. "Verify" names the artifact an evaluator can
inspect — code, test, or live endpoint — because this repo's rule is
that every claim maps to a check (`docs/privacy/verify.md`).

| id | requirement | implementation | verify |
|---|---|---|---|
| P-01 | Raw trajectories SHALL NOT be persisted — no store, no log, no snapshot | payload discarded in-request after cell-fold (`trip.py:106-114`) | `test_trip_privacy_pipeline`; store repr contains no `"28."`/`"77."` |
| P-02 | Raw device tokens SHALL NOT be persisted | hash-before-store (`trip.py:241`) | token absent from entire store repr (`test_v2.py:284`) |
| P-03 | Donations SHALL be gated by an explicit, recorded, revocable opt-in | `consent.json` + `shareEnabled` gate on the only callsite | `consent.ts`; `engine.ts:381`; onboarding can't be swiped past |
| P-04 | The service SHALL be fully functional with sharing off | no feature branches on `shareEnabled` | exercise app with toggle off |
| P-05 | Published rows SHALL satisfy k≥5 distinct devices per bucket; sub-k rows SHALL be omitted entirely | publish gate; sets never leave | feed artifact; `suppressed` counter in manifest |
| P-06 | The effective margin SHALL be unpredictable (T_b ∈ {5,6,7}) and publication SHALL be atomic per hour + embargoed ≥1 h | §3.3 | manifest timestamp vs bucket label |
| P-07 | Published totals SHALL equal sums over published rows | §3.4(2) | recompute totals from artifact |
| P-08 | Device linkage across cells or days SHALL be impossible, including for the operator | per-(day×cell) HMAC salts; key in Secrets Manager; prior-epoch key material destroyed | salt derivation spec; intersection test on two buckets yields ∅ |
| P-09 | Trip endpoints SHALL be removed ≥500 m both ends AND terminal cells dropped; client SHALL additionally suppress saved home/work cells | `TRIM_M` bump + end-cell drop; `settings.home/work` client filter | transform echo fields in `/v2/trip` response (`trip.py:358-360`) |
| P-10 | Retention SHALL be enforced by expiry mechanism, not policy | DDB `ttl` attribute per §8 table | `describe-ttl`; item inspection |
| P-11 | User-initiated deletion SHALL remove all person-keyed rows synchronously | `DELETE /v2/ledger` + `X-Device-Token`; device wipe clears local stores | `test_ledger_delete_via_header` |
| P-12 | All telemetry processing SHALL occur in India (ap-south-1) | region-pinned services; no telemetry leaves AWS account | `AWS_REGION`; table ARN |
| P-13 | The feed SHALL contain no device identifiers, timestamps finer than the bucket, or per-trip fields | artifact schema (below) | schema lint on any artifact |
| P-14 | Mode and OD data SHALL publish only at ward/district granularity under their own k gates | §3.2 | artifact has no cell-level mode field |
| P-15 | Buyer SHALL NOT join the feed to per-person records nor republish sub-bucket inferences | contract clause + this spec annexed | contract |
| P-16 | DP, if offered, SHALL be confined to surfaces where noise std ≤ 10 % of typical count, with a published ε ledger | §4.2-4.3 | `dp#budget` items + manifest ε field |
| P-17 | Access to the aggregate store SHALL be least-privilege (separate ingest / read / delete roles) | IAM: ingest PutItem+UpdateItem; feed Query/Scan; DeleteItem only for the ledger path | `deploy.sh` IAM doc |
| P-18 | Every privacy claim SHALL map to an executable check or a named unmet item in §10 | `docs/privacy/verify.md` pattern extended to the feed | the test suite |

### 9.1 Feed contract (what the buyer actually receives)

```json
{
  "schema": "alive-gov-feed/1",
  "release": {"bucket_ist": "2026-10-10T08+05:30", "published_at": "2026-10-10T10:00:00+05:30",
              "methodology": "06-privacy.md#3", "suppressed_cells": 41, "suppressed_trips_approx": 120,
              "epsilon_spent_day": 0.0},
  "rows": [
    {"cell": "h3:8:882a1f0d3ffffff", "trips": 17, "devices": 6,
     "mean_dose_ug": 41.2, "mean_km": 6.8}
  ]
}
```

No `devices` set members, no timestamps, no mode at cell level — the
schema makes the promises machine-checkable (P-13). Delivery: hourly
artifact + `manifest.json` (row count, suppressed counts, SHA-256,
schema/methodology versions) to a buyer S3 prefix or versioned API;
artifacts immutable once released — corrections land as a new
`published_at` generation, never an in-place edit (auditability of what
was known when).

---

## 10. Known limits — stated, not hidden

Same rule as PRIVACY.md: publish the residual list rather than
overclaim. An evaluator who finds these *in the document* trusts the
rest of it.

1. **Sybil resistance is honest, not strong.** Unauthenticated
   donations mean free identity minting: an attacker can join a
   4-device cell to force publication, or inject fabricated-but-physical
   trips. Plausibility floors and the randomized margin make it noisy
   and unreliable — not impossible. Closing it needs device attestation
   (App Attest / Play Integrity) — roadmapped, not built.
2. **The bearer-token ledger.** Possession of a `device_token` reads
   that device's trip summaries (never cells/coords). Header transport
   and 30-day rotation bound it; possession-equals-access stands as the
   price of no-accounts.
3. **Aggregates are still aggregates.** Hashed-device sets exist at
   rest (the k-gate needs them). Under per-bucket salts they join to
   nothing; during the transition from unsalted hashing they join
   within a rotation window. Scheduled fix, stated timeline.
4. **k-anonymity is not a formal guarantee.** It bounds crowd size, not
   inference under auxiliary data + repeated observation. §4 prices the
   formal version honestly; where it's uneconomic we say "bounded, not
   eliminated" instead of reaching for the ε label.
5. **Consent is provable only as coverage.** Records live on-device;
   `notice_v` tallies show versions accepted in aggregate. There is no
   per-user consent proof — deliberately, since such a table would be
   the first identified-user store we kept.
6. **The doughnut.** Trim + terminal-cell drop leaves a ~1 km anchor
   hole that a ring of traversals can still point at. Endpoint-frequency
   suppression (A1) is spec'd, not yet built.
7. **TTL is eventual.** DynamoDB expiry sweeps are a horizon, not
   real-time erasure; synchronous deletion exists only for the
   token-keyed ledger — which is also the only person-keyed data.

---

*Cross-references: the consumer-facing statement is `PRIVACY.md`; the
claim→test table is `docs/privacy/verify.md`; the donation pipeline
diagram is `docs/privacy/data-flow.md`; the aggregate table layout is
`docs/plan/05 §4` and `server/agg_ddb.py`.*
