# Lane P (platform) — Oct 11

## What changed
| File | Change |
|---|---|
| `server/v2/providers.py` (NEW) | The provider proxy from the contract: `/v2/p/ac`, `/geocode`, `/reverse`, `/nearby`, `POST /route_traffic`, `/flow_tile/{z}/{x}/{y}.png`, `/incidents`, and `/status` (booleans only). Also `async traffic_for_route(coords)` for other server modules. |
| `server/v2/__init__.py` | Mounts `providers.router` inside a try/except, so a broken provider module can never take `/v2` down. |
| `server/main.py` | `/v2/p/flow_tile` gets its own rate-limit bucket (20 rps, burst 80). It is added through `_DEFAULT_PATH_LIMITS.setdefault`, not as an explicit kwarg, so `ALIVE_RATE_LIMIT=0` still turns the limiter off. |
| `server/tests/test_providers.py` (NEW) | 17 offline tests. Every upstream is an `httpx.MockTransport`. The module is loaded straight from its file, so another lane's half-edited v2 module cannot break these tests. |
| `scripts/deploy.sh` | (1) Adds `OLA_API_KEY`, `TOMTOM_API_KEY` and `MAPPLS_API_KEY` from `alive108/ola`, `alive108/tomtom` and `alive108/mappls`. Each one is added **only if** `describe-secret` shows the secret exists, is not pending deletion and has a value (`[DeletedDate == null, VersionIdsToStages != null]`). (2) Local docker builds now refuse to run on an uncommitted `server/` tree, because docker builds the working tree but tags it with HEAD's sha. Ways round it: commit first, use `BUILD_MODE=codebuild` (builds exactly HEAD), or set `ALLOW_DIRTY=1`. |
| `~/alive-dev/put-secrets.sh` (NEW) | Reads `~/.config/alive-ops/keys.env` without sourcing it, then creates or updates the three secrets as plain strings. Each value goes through a 0600 temp file as `file://`, so it never appears in stdout or the process list. Restores a secret that is pending deletion. |
| `~/alive-dev/run-8108.sh` (NEW) | Starts (or restarts), stops and reports status for the local full server. |
| `requirements*.txt` | Unchanged. `httpx` was already a dependency. |

## Provider behaviour (THE LAW)
- Keys are read from the environment on every call. They never appear in a response, an error string or a log line. Errors are mapped to short codes (`timeout`, `http 4xx`, `network`), because `str(httpx error)` would include the URL with the key in it.
- Missing key: `200 {"results": [], "configured": false}`. Provider failure: `200 {"results": [], "error": "ola http 500"}`.
- If one provider fails and the other succeeds, the response carries the results plus `"errors": {...}` and is cached for only 60 s.
- Failures are never cached.
- Every outbound call has a hard 3 s limit (httpx timeout plus `asyncio.wait_for`). Some endpoints get a tighter overall budget, matched to how long their client waits:
  - `/ac`: the provider calls get 2.2 s, and the whole request including the Mappls coordinate look-up finishes within about 2.4 s, because `search.js` gives up at 2.5 s.
  - `/geocode`: about 3.3 s (`search.js` waits 3.5 s).
  - `/nearby`: about 4.5 s (`purest.js` waits 6 s).
  - When the budget runs out, Mappls rows without coordinates are dropped and the answer is cached for only 60 s.
- Cache lifetimes: ac 10 min, geocode and reverse 1 day, nearby 1 h, route_traffic 60 s, tiles 60 s, incidents 120 s.
- **`flow_tile` is the one exception to the JSON rule.** When unconfigured or when TomTom fails it returns `204` plus an `X-Alive-Provider` header, so map clients see an empty tile instead of trying to decode JSON as a PNG. `map.js`'s probe (`r.ok && image/*`) already treats this as "off". The JSON answer lives at `/v2/p/status`.
- **Mappls generic static keys do not return coordinates.** Autosuggest, geocode and nearby give `latitude: "RESTRICTED"` (per the mappls-api README). Each Mappls hit without coordinates is looked up through Ola geocode of its own name and address, capped at 4 per request.
  - The Ola answer is kept only if it roughly matches the distance Mappls itself reported (within 2 km or 30%).
  - Hits that fail this check are **dropped**, never guessed. They are marked `coord_src: "ola_geocode"`.
  - So with *only* a Mappls key, `ac`, `geocode` and `nearby` return few or no Mappls rows.
- Merging autocomplete:
  - Ranking: weak text matches and places more than 200 km away sink to the bottom, then results interleave by provider rank (Ola first for `ac`, Mappls first for `geocode`, because it parses house-level addresses).
  - De-dup: same normalised name and either ≤ 60 m apart or the same subtitle.
  - The user's lat/lon is used as the bias point when it falls inside a wide NCR box (27.6–30.0 N, 76.0–78.6 E); otherwise central Delhi is used.
  - `sub` is reduced to plain words: no pincodes, no ", India", no raw `amenity:` tags, no " District" suffix, no repeated parts.
- route_traffic:
  - The line is cut to ≤ 150 points: half the budget goes to RDP shape points, the rest to evenly spaced points, with the ends kept. The even spacing stops long straight stretches becoming free legs that TomTom could re-route.
  - Request: `calculateRoute` with `supportingPoints`, `traffic=true`, `sectionType=traffic&sectionType=importantRoadStretch`, `computeTravelTimeFor=all`.
  - Each TRAFFIC section becomes a jam: start and end points from the response's own `legs[].points`, and `from_m`/`to_m` measured by haversine along those points.
  - Jam fields: `delay_s`, `magnitude` (0–4), `category` (jam, road_work, …), `speed_kmh`, and `road` taken from the overlapping IMPORTANT_ROAD_STRETCH street name (`""` if there is none, never invented).
  - `traffic_for_route()` auto-detects GeoJSON `[lon,lat]` order and returns `None` on any miss.

## How it was verified
- `python -m py_compile` passes on `v2/providers.py`, `v2/__init__.py`, `main.py` and `tests/test_providers.py`. `bash -n` passes on `deploy.sh`, `put-secrets.sh` and `run-8108.sh`.
- `pytest tests/test_providers.py -q`: **17 passed**. Together with `test_security`, `test_admin_auth` and `test_v2_hardening`: **111 passed** on the final code.
- On the live :8108 server, every `/v2/p/*` endpoint answers `{"results":[],"configured":false}` (no keys yet). `flow_tile` returns `204` with `x-alive-provider: unconfigured`, and `openapi.json` lists all 8 `/v2/p/*` paths.
- I assembled the deploy.sh container-definitions JSON with 0 and with 2 provider secrets and checked both with `json.load`. I checked the JMESPath secret gate with the awscli's own jmespath (`[True, True]` / `[True, False]` / `[False, True]`).
- How I checked the upstream APIs:
  - **Ola:** the official docs (developer.olamaps.io) block this box with an Akamai 403, and the maps.olakrutrim.com API reference only renders client-side. Paths and response keys were confirmed from the `olamaps` PyPI client source: `predictions`, `geocodingResults`, `results`, `/routing/v1/directions` as POST.
  - **Mappls:** the official mappls-api/mappls-rest-apis READMEs.
  - **TomTom:** developer.tomtom.com calculate-route and incident-details v5 pages.

## Local full server (:8108)
- Start or restart: `bash ~/alive-dev/run-8108.sh`. Also `stop` and `status`. Log: `~/alive-dev/server-8108.log`.
- What it runs: `server/.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8108 --no-access-log --reload --reload-dir server` (excluding tests, data, webapp, static, core, .venv and tools), from `server/`.
  - Environment: `ALIVE_RATE_LIMIT=0`, because all lanes share one 127.0.0.1 rate bucket.
  - It sources `~/.config/alive-ops/keys.env` if the file exists. That file is **absent right now**, so after creating it, re-run the script; a reload does not re-read the environment.
- Boots in about 15 s with the real `alive_core` engine (1,070,459 edges, about 903k priced), a live field from open-meteo/cams, and metro GTFS.
- Station feeds are off locally: WAQI has no key here, and DPCC is behind a flag.
- `--reload` means a lane's server edit goes live after about 15 s, but requests during a reload get connection-refused. There were about 50 reloads in the first 30 minutes while lanes were editing `plan.py`, `modes_engine.py` and the rest.
- For a stable, warm server instead: `RELOAD=0 bash ~/alive-dev/run-8108.sh`. Re-run the script to pick up code changes.

## Deploy readiness (nothing was deployed)
- `~/.aws-venv` has aws-cli 1.46.1. Run as `PATH="$HOME/.aws-venv/bin:$PATH" bash scripts/deploy.sh`. deploy.sh already handles v1's `update-service --load-balancers` gap.
- **Blocker:** there are no AWS credentials on this box. No `AWS_*` environment variables, and `~/.aws` only has an `sso/` cache with no config. The credentials need IAM, ECS, ECR, EC2, ELBv2, S3, CodeBuild and SecretsManager rights; the script runs `put-role-policy` among other things.
- **Docker works here**, so `BUILD_MODE=auto` does a **local** build of the working tree.
  - The new dirty-tree guard will stop it while `server/` has uncommitted or untracked files. Today that includes `webapp/digipin.js`, `webapp/telemetry.js` and every lane's edits.
  - The local build also needs network access (pybind11/eigen FetchContent, plus a GTFS download of about 120 MB) and pushes a large image to ECR from this box's uplink.
  - `BUILD_MODE=codebuild` builds exactly HEAD inside AWS and skips the upload.
- `OSRM_SIDECAR=1` (the default) needs `alive108-osrm:latest` in ECR. If it is not there, deploy with `OSRM_SIDECAR=0`.
- Provider keys in prod: create keys.env, run `put-secrets.sh`, then deploy. deploy.sh logs `secret alive108/ola -> OLA_API_KEY` for each secret it adds. The execution role's `alive108/*` GetSecretValue policy already covers the new secrets.

## Notes for other lanes (no patches required)
- **E (plan.py):** `from .providers import traffic_for_route`, then `t = await traffic_for_route(option_geometry_coords)`.
  - Coordinates can be `[lat,lon]` or GeoJSON `[lon,lat]`; the order is auto-detected.
  - Returns `{live_s, freeflow_s, delay_s, length_m, jams[], source}` or `None`.
  - TomTom's free tier is about 2.5k non-tile calls a day. Call it only for the motorised options you show; repeat calls within 60 s are cached.
- **J (journey.js):** the jam fields are `lat, lon, end_lat, end_lon, from_m, to_m, delay_s, road, magnitude, category, speed_kmh`. A bad body gets a 400.
- **S (search.js):** every result has numeric `lat` and `lon`. There may also be an extra `coord_src` field and a top-level `errors` object. `configured` is always present.
- **M (map.js):** the existing probe works as is: a 204 has no image content type, so the layer stays off.
- **U (purest):** `/v2/p/nearby?lat&lon&kind=lodging&radius_m=` returns results sorted by distance, with `kind: "lodging"`.

## Gaps I can't close yet
- I could not make a single live provider call because there are no keys on this box. Only the mocked contract and the configured:false paths are proven.
- The Ola nearbysearch parameter `withCentroid` comes from memory of the docs. If Ola answers 400, the code retries without it, and falls back to `/nearbysearch/advanced` when the basic search returns no coordinates. Check this with a real key.
- Mappls with a generic key gives names and addresses only. Its coordinates depend on Ola geocode, as described above.
