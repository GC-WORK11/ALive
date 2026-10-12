"""Provider proxy — Ola Maps, Mappls, TomTom behind one honest seam.

Contract: docs/lanes/MASTER-PLAN-oct11.md "Provider contract" (lane P).
Mounted by v2/__init__.py, so every route lives under /v2/p/...

  GET  /v2/p/ac?q&lat&lon              Ola autocomplete + Mappls autosuggest, merged
  GET  /v2/p/geocode?address&lat&lon   house-level: Ola geocode + Mappls geocode
  GET  /v2/p/reverse?lat&lon           {name,address,locality,city,source}
  GET  /v2/p/nearby?lat&lon&kind&radius_m
  POST /v2/p/route_traffic {coords:[[lat,lon],...], mode?, depart_at?,
         fuel_l100?|kwh_100km?}     live traffic + route depth on OUR line:
         jams, alternatives, tolls, speed limits, roads, progress, steps
  GET  /v2/p/flow_tile/{z}/{x}/{y}.png TomTom relative0 flow raster (204 when off)
  GET  /v2/p/incidents?bbox=minLon,minLat,maxLon,maxLat
  GET  /v2/p/status                    which providers are configured (booleans only)

  Python (other server lanes):
      from v2.providers import traffic_for_route
      t = await traffic_for_route([[lat, lon], ...])   # same dict as route_traffic, or None

Rules every function here keeps:
- Keys only from the environment (OLA_API_KEY, MAPPLS_API_KEY, TOMTOM_API_KEY),
  read per call; never echoed in a response, an error string or a log line.
- A missing key answers 200 {"results": [], "configured": false}.
  A provider failure answers 200 {"results": [], "error": "<short>"}.
  Nothing is ever invented: every field traces to a provider field or to
  plain geometry (haversine distance, point index -> metres along line).
- Every outbound call is async httpx with a 3 s hard deadline.
- In-memory TTL caches: ac 10 min, geocode/reverse 1 day, nearby 1 h,
  route_traffic 60 s, tiles 120 s, incidents 120 s. Failures are not cached.
- CDN-friendly (P2, Oct 11): every GET answers Cache-Control with s-maxage
  (ac 600, geocode/reverse 86400, nearby 3600, flow_tile 120 +
  stale-while-revalidate, incidents 120; partial/degraded answers 60;
  failures + /status no-store). ac/nearby cache keys round lat/lon to 2 dp
  and the upstream is asked at that rounded point, so near-identical
  requests share one entry; distance_m is then re-measured from the
  caller's own point (plain haversine).
- Daily budgets (P2): in-memory per-provider counters that reset at IST
  midnight (Ola ~3,000/day PER API, TomTom ~2,300 non-tile + ~45,000
  tiles, Mappls ~900; env ALIVE_BUDGET_* and divided by
  ALIVE_BUDGET_SHARDS = processes). Over budget a provider is simply not
  called: ac -> {"results":[],"degraded":"budget"} (the client keeps its
  own /v2/ac rows), route_traffic -> TomTom else Ola Directions
  travel_advisory else nothing, flow_tile -> 204. Counts (never keys) at
  /v2/p/status.
- Mappls (0.7-4 s) only when q has >= 3 tokens (in parallel with Ola) or
  Ola's top row is weak; capped at 2.5 s. /ac answers by ~1.3 s with what
  it has; a Mappls call still in flight finishes in the background and
  fills the cache for the next identical request.

Upstream shapes (verified Oct 11 against provider docs / official SDKs):
- Ola  GET  https://api.olamaps.io/places/v1/autocomplete?input&location=lat,lng
            -> predictions[{place_id, description, structured_formatting
               {main_text, secondary_text}, geometry{location{lat,lng}},
               distance_meters, types}]
       GET  /places/v1/geocode?address        -> geocodingResults[{formatted_address,
               name?, geometry{location{lat,lng}}, types, place_id}]
       GET  /places/v1/reverse-geocode?latlng=lat,lng -> results[{formatted_address,
               name?, address_components[{long_name, types}], geometry}]
       GET  /places/v1/nearbysearch?layers=venue&types&location&radius&limit
            -> predictions[...] (geometry only when the API returns it)
       POST /routing/v1/directions?origin&destination&mode&alternatives=true
            &steps=true&overview=full&traffic_metadata=true&language=en
            &route_preference=fastest
            -> routes[{overview_polyline, travel_advisory, summary, bounds,
               warnings, copyrights, legs[{distance, duration, readable_*,
               start_address, end_address, start_location, end_location,
               steps[{instructions, maneuver, distance, duration, readable_*,
               start_location{lat,lng}, end_location{lat,lng},
               bearing_before, bearing_after}]}]}]
            travel_advisory: "fromIdx,toIdx,level|..." spans on the route's
            own overview_polyline. modes verified live: driving, walking
            (bike/auto accepted per docs).
- Mappls (REST static key as access_token):
       GET  https://search.mappls.com/search/places/autosuggest/json?query&location
            -> suggestedLocations[{eLoc, placeName, placeAddress, type, distance,
               latitude?/longitude? (RESTRICTED on generic keys)}]
       GET  https://search.mappls.com/search/address/geocode?address&itemCount
            -> copResults (object or list) {formattedAddress, eLoc, geocodeLevel,
               houseNumber, locality, city, ...}  -- no coordinates on generic keys
       GET  https://search.mappls.com/search/address/rev-geocode?lat&lng
            -> results[{houseNumber, houseName, poi, street, subLocality,
               locality, village, district, city, state, formatted_address}]
       GET  https://search.mappls.com/search/places/nearby/json?keywords&refLocation
       Mappls hits without coordinates are resolved through Ola geocode of
       their own name+address (and checked against Mappls' own distance);
       a hit that cannot be resolved is dropped, never guessed.
- TomTom POST https://api.tomtom.com/routing/1/calculateRoute/{o}:{d}/json
            ?traffic=true&computeTravelTimeFor=all&maxAlternatives=3
            &alternativeType=anyRoute&instructionsType=text&language=en-GB
            &routeRepresentation=polyline&includeTollPaymentTypes=all
            &extendedRouteRepresentation=distance&extendedRouteRepresentation=travelTime
            &sectionType=traffic|importantRoadStretch|toll|tollVignette|urban|
            tunnel|motorway|unpaved|lowEmissionZone|speedLimit|carpool|ferry|carTrain
            [&departAt=ISO] [&vehicleEngineType&constantSpeedConsumption*]
            body {"supportingPoints":[{latitude,longitude}]}
            -> routes[].summary{travelTimeInSeconds, trafficDelayInSeconds,
               noTrafficTravelTimeInSeconds, historicTrafficTravelTimeInSeconds,
               liveTrafficIncidentsTravelTimeInSeconds, trafficLengthInMeters,
               lengthInMeters, departureTime, arrivalTime, fuelConsumptionInLiters?,
               batteryConsumptionInkWh?, deviationDistance?/deviationTime?},
               legs[].points, legs[].guidance.instructions[] (NOT returned on
               the current key/plan — verified live), sections[{sectionType:
               TRAFFIC|TOLL|SPEED_LIMIT|URBAN|TUNNEL|MOTORWAY|UNPAVED|
               LOW_EMISSION_ZONE|CARPOOL|FERRY|CAR_TRAIN|IMPORTANT_ROAD_STRETCH,
               startPointIndex, endPointIndex, delayInSeconds, magnitudeOfDelay,
               simpleCategory, effectiveSpeedInKmh, maxSpeedLimitInKmh,
               tollPaymentTypes, streetName, roadNumbers}],
               progress[{pointIndex, distanceInMeters, travelTimeInSeconds}]
            Alternatives carry the same fields; section/point indices are per
            route's own legs[].points.
            Mappls route/route_adv: NOT available on the static REST key
            (advancedmaps wants OAuth client creds; verified live "Client
            Credentials Expired") — search.mappls.com endpoints only.
       GET  https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png
       GET  https://api.tomtom.com/traffic/services/5/incidentDetails?bbox&fields
            -> incidents[{geometry{type,coordinates}, properties{iconCategory,
               magnitudeOfDelay, delay, roadNumbers, from, to, events}}]
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import math
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse, Response

log = logging.getLogger("alive.providers")

router = APIRouter(prefix="/p", tags=["providers"])

# ---------------------------------------------------------------- constants
OLA_BASE = "https://api.olamaps.io"
MAPPLS_SEARCH = "https://search.mappls.com/search"
TOMTOM_BASE = "https://api.tomtom.com"

TIMEOUT_S = 3.0                      # hard per-call deadline (contract)
AC_TIMEOUT_S = 2.2                   # type-ahead fan-out (search.js aborts at 2.5 s)
AC_TOTAL_S = 2.4                     # ...incl. the Mappls coordinate look-up
GEOCODE_TOTAL_S = 3.3                # search.js waits 3.5 s for geocode
NEARBY_TOTAL_S = 4.5                 # purest.js waits 6 s for nearby
DELHI = (28.6139, 77.2090)           # default bias point (CP area)
# wide NCR + UP/Haryana outskirts box (lat/lon) — Panipat, Rohtak, Rewari,
# Palwal, Meerut, Bulandshahr all inside. Used for bias only, never to filter.
NCR_WIDE = (27.6, 76.0, 30.0, 78.6)  # minLat, minLon, maxLat, maxLon
FAR_KM = 200.0                       # results beyond this sink to the end
DEDUP_M = 250.0                      # same name within this = same place
# two providers pin one POI a block or two apart — 60 m let the same
# hotel show twice; a partial name that only matches across a city
# boundary is never the type-ahead target
PARTIAL_FAR_M = 60000.0
# a name that is only a category word — 'Hotel', 'ATM', 'School' — is an
# unnamed feature, never a row the user can pick
_GENERIC_NAME_WORDS = frozenset("""
hotel hostel lodge lodging motel resort inn guesthouse restaurant cafe
dhaba hotel atm hospital clinic school college university bank park mall
market shop store pharmacy gym office temple mosque church gurudwara
gurdwara station airport stop stand petrol pump
""".split())
MAX_RESOLVE = 4                      # Mappls coord look-ups per request
TT_MAX_PTS = 150                     # TomTom supportingPoints cap
TT_MAX_ALTS = 3                      # maxAlternatives -> up to 3 extra routes
# every sectionType the Routing API offers that can occur on an NCR motor
# route; traffic + importantRoadStretch (jam delays + road names), the rest
# are route feature flags / tolls / speed limits. `tollRoad` is deprecated
# upstream (400s on newer backends) — `toll` + `tollVignette` replace it.
TT_SECTION_TYPES = ("traffic", "importantRoadStretch", "toll", "tollVignette",
                    "urban", "tunnel", "motorway", "unpaved", "lowEmissionZone",
                    "speedLimit", "carpool", "ferry", "carTrain", "pedestrian",
                    "country")
# section types surfaced as route flags -> response "flags" key
_TT_FLAG_SECTIONS = {"TOLL": "toll", "TOLL_VIGNETTE": "toll_vignette",
                     "URBAN": "urban", "TUNNEL": "tunnel",
                     "MOTORWAY": "motorway", "UNPAVED": "unpaved",
                     "LOW_EMISSION_ZONE": "low_emission_zone",
                     "CARPOOL": "carpool", "FERRY": "ferry",
                     "CAR_TRAIN": "car_train", "PEDESTRIAN": "pedestrian",
                     "COUNTRY": "country"}
_TT_MODES = {"car", "motorcycle", "bus", "taxi", "van", "truck",
             "bicycle", "pedestrian"}
_DEPART_RE = re.compile(r"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}")

TTL_AC = 600
TTL_GEOCODE = 86400
TTL_REVERSE = 86400
TTL_NEARBY = 3600
TTL_ROUTE = 60
TTL_TILE = 120
TTL_INCIDENTS = 120
TTL_PARTIAL = 60                     # one provider failed: retry soon
TILE_SWR = 300                       # CDN may serve a stale tile while refetching


def _envf(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name) or default)
    except ValueError:
        return default


MAPPLS_CAP_S = 2.5                   # Mappls is 0.7-4 s: never wait longer
AC_SOFT_S = _envf("ALIVE_AC_SOFT_S", 1.3)   # search.js aborts /v2/p/ac at 1.5 s
MAPPLS_MIN_TOKENS = 3                # >= 3 tokens -> Mappls in parallel with Ola
MAX_BRIDGE = 3                       # Mappls rows bridged per /ac request


def _key(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def ola_key() -> str:
    return _key("OLA_API_KEY")


def mappls_key() -> str:
    return _key("MAPPLS_API_KEY")


def tomtom_key() -> str:
    return _key("TOMTOM_API_KEY")


def _unconfigured() -> dict:
    return {"results": [], "configured": False}


def _failed(err: str) -> dict:
    return {"results": [], "error": err or "provider error"}


# ---------------------------------------------------------------- cache
class _TTL:
    """Small expiring dict. Touched only from the event-loop thread."""

    def __init__(self, ttl_s: float, max_entries: int = 1024):
        self.ttl_s = float(ttl_s)
        self.max_entries = int(max_entries)
        self._d: dict = {}

    def get(self, key):
        e = self._d.get(key)
        if e is None:
            return None
        exp, val = e
        if time.monotonic() > exp:
            self._d.pop(key, None)
            return None
        return val

    def put(self, key, val, ttl_s: Optional[float] = None) -> None:
        if len(self._d) >= self.max_entries:
            now = time.monotonic()
            for k in [k for k, (x, _) in self._d.items() if now > x]:
                self._d.pop(k, None)
            while len(self._d) >= self.max_entries:
                self._d.pop(next(iter(self._d)))
        self._d[key] = (time.monotonic() + (self.ttl_s if ttl_s is None
                                            else float(ttl_s)), val)

    def clear(self) -> None:
        self._d.clear()


_C_AC = _TTL(TTL_AC, 2000)
_C_GEOCODE = _TTL(TTL_GEOCODE, 2000)
_C_RESOLVE = _TTL(TTL_GEOCODE, 4000)     # Ola geocode of a Mappls name+address
_C_REVERSE = _TTL(TTL_REVERSE, 4000)
_C_NEARBY = _TTL(TTL_NEARBY, 500)
_C_ROUTE = _TTL(TTL_ROUTE, 500)
_C_TILE = _TTL(TTL_TILE, 800)            # ~10-40 KB each -> worst ~30 MB
_C_INCIDENTS = _TTL(TTL_INCIDENTS, 200)


def clear_caches() -> None:
    for c in (_C_AC, _C_GEOCODE, _C_RESOLVE, _C_REVERSE, _C_NEARBY,
              _C_ROUTE, _C_TILE, _C_INCIDENTS):
        c.clear()
    BUDGET.reset()


# ---------------------------------------------------------------- daily budgets
# Free tiers: Ola 100k calls/month PER API (~3.3k/day), TomTom 2,500
# non-tile + 50,000 tile calls/day, Mappls eval (unknown; ~1k/day assumed).
# Counters live in this process only (nothing persisted, nothing secret)
# and reset at IST midnight. Several processes (uvicorn workers x ECS
# tasks) each count alone, so every cap is divided by ALIVE_BUDGET_SHARDS.
IST = timezone(timedelta(hours=5, minutes=30))
_CAP_DEFAULT = {"ola": 3000, "tomtom": 2300, "tomtom_tile": 45000, "mappls": 900}
_CAP_ENV = {"ola": "ALIVE_BUDGET_OLA", "tomtom": "ALIVE_BUDGET_TOMTOM",
            "tomtom_tile": "ALIVE_BUDGET_TOMTOM_TILES",
            "mappls": "ALIVE_BUDGET_MAPPLS"}
BUDGET_APIS = ("ola:autocomplete", "ola:geocode", "ola:reverse", "ola:nearby",
               "ola:directions", "tomtom", "tomtom_tile", "mappls")


def _shards() -> int:
    try:
        return max(1, int(os.environ.get("ALIVE_BUDGET_SHARDS") or 1))
    except ValueError:
        return 1


def budget_cap(api: str) -> int:
    fam = api.split(":", 1)[0]
    try:
        base = int(os.environ.get(_CAP_ENV.get(fam, "")) or _CAP_DEFAULT.get(fam, 0))
    except ValueError:
        base = _CAP_DEFAULT.get(fam, 0)
    return max(0, base // _shards())


class _Budget:
    """Per-API call counters for the current IST day."""

    def __init__(self):
        self.reset()

    def reset(self) -> None:
        self.day = datetime.now(IST).date().isoformat()
        self.used: dict = {}
        self.denied: dict = {}

    def _roll(self) -> None:
        d = datetime.now(IST).date().isoformat()
        if d != self.day:
            self.day, self.used, self.denied = d, {}, {}

    def ok(self, api: str) -> bool:
        self._roll()
        return self.used.get(api, 0) < budget_cap(api)

    def allow(self, api: str) -> bool:
        """ok(), and a refusal is counted (denied) and logged once a day."""
        if self.ok(api):
            return True
        n = self.denied.get(api, 0)
        self.denied[api] = n + 1
        if n == 0:
            log.warning("provider %s daily budget reached — not calling", api)
        return False

    def take(self, api: str) -> bool:
        """Count one outbound call; False (and nothing counted) when the
        day's budget is spent."""
        if not self.allow(api):
            return False
        self.used[api] = self.used.get(api, 0) + 1
        return True

    def snapshot(self) -> dict:
        self._roll()
        now = datetime.now(IST)
        nxt = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0,
                                                microsecond=0)
        return {"day_ist": self.day, "resets_in_s": int((nxt - now).total_seconds()),
                "shards": _shards(),
                "apis": {a: {"used": self.used.get(a, 0), "cap": budget_cap(a),
                             "denied": self.denied.get(a, 0)} for a in BUDGET_APIS}}


BUDGET = _Budget()


def _degraded() -> dict:
    """Every provider that could answer is over today's budget."""
    return {"results": [], "configured": True, "degraded": "budget"}


# ---------------------------------------------------------------- Cache-Control
def _cc(response: Optional[Response], s_maxage: int, *, swr: int = 0) -> None:
    """CDN header: browsers keep it <= 10 min, CloudFront s_maxage.
    s_maxage <= 0 -> no-store (failures are never cached anywhere)."""
    if response is None:
        return
    if s_maxage <= 0:
        response.headers["Cache-Control"] = "no-store"
        return
    v = f"public, max-age={min(int(s_maxage), 600)}, s-maxage={int(s_maxage)}"
    if swr:
        v += f", stale-while-revalidate={int(swr)}"
    response.headers["Cache-Control"] = v


def _edge_ttl(out: dict, full: int) -> int:
    """Full TTL for a clean answer, 60 s for partial/degraded/unconfigured
    ones, 0 (no-store) for a failure."""
    if out.get("error"):
        return 0
    if out.get("pending"):
        return 10                    # a background fill lands within ~2.5 s
    if out.get("errors") or out.get("degraded") or out.get("configured") is False:
        return TTL_PARTIAL
    return full


# ---------------------------------------------------------------- http
_CLIENT: Optional[httpx.AsyncClient] = None


def _http() -> httpx.AsyncClient:
    """Shared client. Tests swap in httpx.MockTransport via set_transport()."""
    global _CLIENT
    if _CLIENT is None or _CLIENT.is_closed:
        _CLIENT = httpx.AsyncClient(
            timeout=httpx.Timeout(TIMEOUT_S),
            headers={"User-Agent": "alive108-providers/1.0"},
            limits=httpx.Limits(max_connections=64,
                                max_keepalive_connections=16))
    return _CLIENT


def set_transport(transport) -> None:
    """Test seam: route every outbound call through `transport`."""
    global _CLIENT
    _CLIENT = httpx.AsyncClient(timeout=httpx.Timeout(TIMEOUT_S),
                                transport=transport)


def _short_err(e: BaseException) -> str:
    # never str(e): httpx messages carry the full URL incl. the api key
    if isinstance(e, (asyncio.TimeoutError, httpx.TimeoutException)):
        return "timeout"
    if isinstance(e, httpx.HTTPStatusError):
        return f"http {e.response.status_code}"
    if isinstance(e, ValueError):
        return "bad response"
    if isinstance(e, httpx.RequestError):
        return "network"
    return "error"


async def _call(method: str, url: str, provider: str, *,
                params: Optional[dict] = None, json_body: Any = None,
                want: str = "json", timeout: float = TIMEOUT_S,
                budget: Optional[str] = None, headers: Optional[dict] = None):
    """One outbound call -> (payload, err). payload is parsed JSON, bytes
    for want="bytes", or None. HTTP 204 = an honest empty answer.
    budget: the daily counter this call draws on ("budget" error = not
    called because today's budget is spent)."""
    if budget and not BUDGET.take(budget):
        return None, "budget"
    try:
        r = await asyncio.wait_for(
            _http().request(method, url, params=params, json=json_body,
                            timeout=timeout, headers=headers),
            timeout=timeout)
        if r.status_code == 204:
            return ({} if want == "json" else b""), None
        if r.status_code >= 400:
            err = f"http {r.status_code}"
            log.warning("provider %s %s", provider, err)
            return None, err
        if want == "bytes":
            return r.content, None
        return r.json(), None
    except Exception as e:  # noqa: BLE001 — any failure is one short string
        err = _short_err(e)
        log.warning("provider %s %s", provider, err)
        return None, err


# ---------------------------------------------------------------- geometry
def haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _num(v) -> Optional[float]:
    """Provider numbers arrive as numbers, numeric strings or "RESTRICTED"."""
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


def _latlon(lat, lon) -> Optional[tuple]:
    la, lo = _num(lat), _num(lon)
    if la is None or lo is None or not (-90 <= la <= 90) or not (-180 <= lo <= 180):
        return None
    if la == 0 and lo == 0:
        return None
    return la, lo


def _bias(lat, lon) -> tuple:
    """User point when it is inside the wide NCR box, else central Delhi."""
    p = _latlon(lat, lon)
    if p and NCR_WIDE[0] <= p[0] <= NCR_WIDE[2] and NCR_WIDE[1] <= p[1] <= NCR_WIDE[3]:
        return p
    return DELHI


# ---------------------------------------------------------------- text
_PIN_RE = re.compile(r"\b\d{6}\b")
_PINWORD_RE = re.compile(r"\bpin[-:\s]*\d{6}\b", re.I)
_TAG_RE = re.compile(r"^[a-z_]+:[a-z_ ]+$", re.I)    # amenity:place_of_worship
_SPACE_RE = re.compile(r"\s+")


def _norm(s: str) -> str:
    return _SPACE_RE.sub(" ", re.sub(r"[^0-9a-z]+", " ", (s or "").lower())).strip()


def plain_sub(text: str, name: str = "", max_parts: int = 4) -> str:
    """Provider address -> short plain words: no pincodes, no ', India',
    no raw tags, no repeats of the name or of itself."""
    if not text:
        return ""
    text = _PINWORD_RE.sub("", str(text))
    out, seen = [], {_norm(name)} if name else set()
    for part in text.split(","):
        p = _PIN_RE.sub("", part).strip(" .-;")
        p = _SPACE_RE.sub(" ", p)
        if not p or _TAG_RE.match(p) or "_" in p:
            continue
        if p.lower() in ("india", "in", "ind"):
            continue
        if p.lower().endswith(" district"):
            p = p[: -len(" district")].strip()
        k = _norm(p)
        if not k or k in seen:
            continue
        seen.add(k)
        out.append(p)
        if len(out) >= max_parts:
            break
    return ", ".join(out)


def _split_desc(desc: str) -> tuple:
    parts = [p.strip() for p in (desc or "").split(",") if p.strip()]
    if not parts:
        return "", ""
    return parts[0], ", ".join(parts[1:])


_AREA_TYPES = {"locality", "sublocality", "sublocality_level_1",
               "sublocality_level_2", "neighborhood", "neighbourhood",
               "administrative_area_level_1", "administrative_area_level_2",
               "administrative_area_level_3", "political", "postal_code",
               "colloquial_area", "city", "town", "village", "state",
               "country", "region", "district"}
_ADDR_TYPES = {"street_address", "premise", "subpremise", "house",
               "house_number", "housenumber", "address", "plus_code"}
_STREET_TYPES = {"route", "street", "road"}
_LODGING_TYPES = {"lodging", "hotel", "hostel", "guest_house", "motel",
                  "resort"}


def kind_from_types(types) -> str:
    ts = {str(t).lower() for t in (types or [])}
    if ts & _LODGING_TYPES:
        return "lodging"
    if ts & _ADDR_TYPES:
        return "address"
    if ts & _STREET_TYPES and not (ts - _STREET_TYPES - {"geocode"}):
        return "street"
    if ts and ts <= (_AREA_TYPES | {"geocode"}):
        return "area"
    if ts:
        return "poi"
    return "place"


_MAPPLS_KIND = {
    "POI": "poi", "HOUSE_NUMBER": "address", "HOUSE_NAME": "address",
    "STREET": "street", "SUBSUBLOCALITY": "area", "SUBLOCALITY": "area",
    "LOCALITY": "area", "VILLAGE": "area", "SUBDISTRICT": "area",
    "DISTRICT": "area", "CITY": "area", "STATE": "area", "PINCODE": "area",
    "COUNTRY": "area",
}


def _mappls_kind(t: str, keywords=None) -> str:
    # Mappls POI category codes are 6 letters, category first (FODCOF =
    # food/coffee); the HOTxxx family is accommodation.
    if any(re.fullmatch(r"HOT[A-Z]{3}", str(k).upper()) for k in (keywords or [])):
        return "lodging"
    return _MAPPLS_KIND.get(str(t or "").upper(), "place")


def _item(*, pid: str, name: str, sub: str, lat, lon, kind: str,
          source: str, distance_m=None, bias=None, extra: Optional[dict] = None) -> dict:
    p = _latlon(lat, lon)
    d = _num(distance_m)
    if d is None and p and bias:
        d = haversine_m(bias[0], bias[1], p[0], p[1])
    it = {
        "id": pid,
        "name": name.strip(),
        "sub": plain_sub(sub, name),
        "lat": round(p[0], 6) if p else None,
        "lon": round(p[1], 6) if p else None,
        "kind": kind,
        "source": source,
        "distance_m": int(round(d)) if d is not None else None,
    }
    if extra:
        it.update(extra)
    return it


# ---------------------------------------------------------------- Ola
_OLA_API = {"/places/v1/autocomplete": "ola:autocomplete",
            "/places/v1/geocode": "ola:geocode",
            "/places/v1/reverse-geocode": "ola:reverse",
            "/places/v1/nearbysearch": "ola:nearby",
            "/places/v1/nearbysearch/advanced": "ola:nearby",
            "/routing/v1/directions": "ola:directions"}


def ola_budget_ok(path: str) -> bool:
    return BUDGET.allow(_OLA_API.get(path, "ola:other"))


async def _ola_get(path: str, params: dict, timeout: float = TIMEOUT_S):
    q = dict(params)
    q["api_key"] = ola_key()
    return await _call("GET", OLA_BASE + path, "ola", params=q, timeout=timeout,
                       budget=_OLA_API.get(path, "ola:other"),
                       headers={"X-Request-Id": uuid.uuid4().hex})


def _ola_status_err(data) -> Optional[str]:
    if not isinstance(data, dict):
        return "bad response"
    st = str(data.get("status") or "ok").lower()
    if st not in ("ok", "zero_results", "success"):
        return f"status {st}"[:40]
    return None


def parse_ola_predictions(data, bias) -> list:
    out = []
    for p in (data or {}).get("predictions") or []:
        sf = p.get("structured_formatting") or {}
        name = (sf.get("main_text") or "").strip()
        sub = sf.get("secondary_text") or ""
        if not name:
            name, sub = _split_desc(p.get("description") or "")
        loc = ((p.get("geometry") or {}).get("location")) or {}
        if not name:
            continue
        out.append(_item(
            pid=f"ola:{p.get('place_id') or p.get('reference') or _norm(name)}",
            name=name, sub=sub or p.get("description") or "",
            lat=loc.get("lat"), lon=loc.get("lng", loc.get("lon")),
            kind=kind_from_types(p.get("types")), source="ola",
            distance_m=p.get("distance_meters"), bias=bias))
    return out


def parse_ola_geocode(data, bias) -> list:
    rows = (data or {}).get("geocodingResults")
    if rows is None:
        rows = (data or {}).get("results")
    out = []
    for g in rows or []:
        fa = g.get("formatted_address") or ""
        nm = (g.get("name") or "").strip()
        first, rest = _split_desc(fa)
        name = nm or first
        if name and not re.search(r"[a-zA-Z]", name) and rest:
            # bare house number -> '237, Okhla Industrial Estate Phase 3'
            name = f"{name}, {rest.split(',')[0].strip()}"
        loc = ((g.get("geometry") or {}).get("location")) or {}
        if not name:
            continue
        out.append(_item(
            pid=f"ola:{g.get('place_id') or _norm(fa)}",
            name=name, sub=(fa if nm and _norm(nm) != _norm(first) else rest),
            lat=loc.get("lat"), lon=loc.get("lng", loc.get("lon")),
            kind=kind_from_types(g.get("types")), source="ola", bias=bias))
    return out


async def ola_autocomplete(q: str, bias, timeout: float = TIMEOUT_S) -> tuple:
    data, err = await _ola_get("/places/v1/autocomplete", {
        "input": q, "location": f"{bias[0]:.5f},{bias[1]:.5f}"}, timeout=timeout)
    if err:
        return [], err
    err = _ola_status_err(data)
    if err:
        return [], err
    return parse_ola_predictions(data, bias), None


async def ola_geocode(address: str, bias, timeout: float = TIMEOUT_S) -> tuple:
    data, err = await _ola_get("/places/v1/geocode", {"address": address},
                               timeout=timeout)
    if err:
        return [], err
    err = _ola_status_err(data)
    if err:
        return [], err
    return parse_ola_geocode(data, bias), None


# ---------------------------------------------------------------- Mappls
async def _mappls_get(path: str, params: dict, timeout: float = TIMEOUT_S):
    q = dict(params)
    q["access_token"] = mappls_key()
    return await _call("GET", MAPPLS_SEARCH + path, "mappls", params=q,
                       timeout=min(timeout, MAPPLS_CAP_S), budget="mappls")


def parse_mappls_suggest(data, bias) -> list:
    out = []
    d = data or {}
    rows = list(d.get("suggestedLocations") or []) + \
        list(d.get("userAddedLocations") or d.get("userAddedLocation") or [])
    for s in rows:
        name = (s.get("placeName") or "").strip()
        if not name:
            continue
        eloc = s.get("eLoc") or s.get("mapplsPin") or _norm(name)
        out.append(_item(
            pid=f"mappls:{eloc}", name=name, sub=s.get("placeAddress") or "",
            lat=s.get("latitude", s.get("lat")),
            lon=s.get("longitude", s.get("lng")),
            kind=_mappls_kind(s.get("type"), s.get("keywords")),
            source="mappls", distance_m=s.get("distance"), bias=bias,
            extra={"_addr": s.get("placeAddress") or ""}))
    return out


def parse_mappls_geocode(data, bias) -> list:
    cop = (data or {}).get("copResults")
    if isinstance(cop, dict):
        cop = [cop]
    out = []
    for c in cop or []:
        fa = c.get("formattedAddress") or ""
        if not fa:
            continue
        hn = (c.get("houseNumber") or "").strip()
        lead = (c.get("houseName") or c.get("poi") or c.get("street") or "").strip()
        if hn and lead:
            name = f"{hn}, {lead}"
        elif hn and not lead:
            # '237' alone is unreadable — anchor it to its locality/area
            loc = (c.get("locality") or c.get("subLocality")
                   or c.get("village") or "").strip()
            name = f"{hn}, {loc}" if loc else hn
        else:
            name = lead or _split_desc(fa)[0]
        lvl = str(c.get("geocodeLevel") or "").lower()
        kind = ("address" if lvl in ("housenumber", "housename") else
                "street" if lvl == "street" else
                "poi" if lvl == "poi" else "area")
        out.append(_item(
            pid=f"mappls:{c.get('eLoc') or c.get('eloc') or _norm(fa)}",
            name=name, sub=fa, lat=c.get("latitude", c.get("lat")),
            lon=c.get("longitude", c.get("lng")), kind=kind, source="mappls",
            bias=bias, extra={"_addr": fa}))
    return out


async def mappls_autosuggest(q: str, bias, timeout: float = TIMEOUT_S) -> tuple:
    data, err = await _mappls_get("/places/autosuggest/json", {
        "query": q, "location": f"{bias[0]:.5f},{bias[1]:.5f}",
        "region": "IND", "hyperLocal": ""}, timeout=timeout)
    if err:
        return [], err
    return parse_mappls_suggest(data, bias), None


async def mappls_geocode(address: str, bias) -> tuple:
    data, err = await _mappls_get("/address/geocode", {
        "address": address, "itemCount": 3})
    if err:
        return [], err
    return parse_mappls_geocode(data, bias), None


async def _resolve_coords(items: list, bias, budget_s: float,
                          cap: int = MAX_RESOLVE,
                          skip_names: Optional[set] = None) -> list:
    """Mappls generic keys withhold coordinates. BRIDGE: look each
    coord-less hit up through Ola geocode of "placeName, placeAddress";
    keep only answers that agree with Mappls' own aerial distance (when it
    gave one). Unresolved hits are dropped — never placed by guess.
    skip_names: normalised names Ola already returned (with coordinates) —
    those Mappls twins are not bridged, saving Ola geocode budget."""
    if skip_names:
        items = [it for it in items
                 if it["lat"] is not None or _norm(it["name"]) not in skip_names]
    if not ola_key() or budget_s < 0.3:
        return [it for it in items if it["lat"] is not None]
    todo = [it for it in items if it["lat"] is None][:cap]
    if not todo:
        return items

    async def one(it):
        text = ", ".join(x for x in (it["name"], it.get("_addr") or it["sub"]) if x)
        ck = _norm(text)
        hit = _C_RESOLVE.get(ck)
        if hit is None:
            rows, err = await ola_geocode(text, bias, timeout=min(TIMEOUT_S, budget_s))
            if err:
                return
            hit = rows[0] if rows else {}
            _C_RESOLVE.put(ck, hit)
        if not hit or hit.get("lat") is None:
            return
        # name/address agreement: the geocode hit must share a non-generic
        # token with the text we sent — the place's name OR its own
        # address (a POI may legitimately resolve onto its street).
        # "Panipat" may not land on a Gurugram / Sonipat row that merely
        # sits at the claimed distance.
        want = [_skel(t) for t in
                _norm(it["name"] + " " + (it.get("_addr") or it["sub"])).split()
                if len(t) >= 3 and t not in
                ("delhi", "new", "india", "haryana", "uttar", "pradesh",
                 "ncr", "state", "district", "near")]
        if want:
            hay = [_skel(w) for w in
                   (_norm(hit.get("name") or "") + " " +
                    _norm(hit.get("sub") or "")).split()]
            if not any(any(h.startswith(t) or t.startswith(h) for h in hay)
                       for t in want):
                return
        d = haversine_m(bias[0], bias[1], hit["lat"], hit["lon"])
        claimed = it.get("distance_m")
        if claimed is not None:
            if abs(d - claimed) > max(2000.0, 0.3 * claimed):
                return                       # Ola found some other place
        elif d > FAR_KM * 1000:
            return
        it["lat"], it["lon"] = hit["lat"], hit["lon"]
        if claimed is None:
            it["distance_m"] = int(round(d))
        it["coord_src"] = "ola_geocode"

    await asyncio.gather(*(one(it) for it in todo), return_exceptions=True)
    return [it for it in items if it["lat"] is not None]


# ---------------------------------------------------------------- merge
def _match_rank(name: str, q: str) -> int:
    n, qq = _norm(name), _norm(q)
    if not qq:
        return 1
    if n.startswith(qq):
        return 0
    words = n.split()
    toks = qq.split()
    if toks and all(any(w.startswith(t) for w in words) for t in toks):
        return 1
    if toks and any(any(w.startswith(t) for w in words) for t in toks):
        return 2
    return 3


def _skel(w: str) -> str:
    """Consonant skeleton: Hindi transliterations differ in vowels and
    doubled letters (neelanchal ~ nilanchal, dham ~ dhaam)."""
    s = re.sub(r"[aeiouy]+", "", w)
    s = re.sub(r"(.)\1+", r"\1", s)
    return s or w


def _item_rank(it: dict, q: str) -> int:
    """_match_rank on the name; a row whose name+address carries EVERY
    query token (exact prefix, or same consonant skeleton for tokens of
    4+ letters) is lifted to rank 1 — "neelanchal dham sant nagar" ->
    "Nilanchal Dhaam Bace · Sant Nagar"."""
    r = _match_rank(it.get("name", ""), q)
    if r <= 1:
        return r
    toks = _norm(q).split()
    words = (_norm(it.get("name", "")) + " " + _norm(it.get("sub", ""))).split()
    if not toks or not words:
        return r
    sk = [_skel(w) for w in words]

    def hit(t: str) -> bool:
        if any(w.startswith(t) for w in words):
            return True
        return len(t) >= 4 and any(s.startswith(_skel(t)) for s in sk)
    return 1 if all(hit(t) for t in toks) else r


def _dup(a: dict, b: dict) -> bool:
    an, bn = _norm(a["name"]), _norm(b["name"])
    if an != bn:
        # word-order and coverage variants of one name: 'Hotel IBIS' vs
        # 'IBIS Hotel', 'AIIMS' vs 'AIIMS Hospital' — equal or nested
        # token sets still name the same row when the pins sit together
        at, bt = frozenset(an.split()), frozenset(bn.split())
        if at != bt:
            small, big = (at, bt) if len(at) <= len(bt) else (bt, at)
            if not small < big or not any(len(t) >= 4 for t in small):
                return False
    if a["lat"] is not None and b["lat"] is not None:
        return haversine_m(a["lat"], a["lon"], b["lat"], b["lon"]) <= DEDUP_M
    return _norm(a["sub"]) == _norm(b["sub"])


def merge_results(groups: list, q: str = "", limit: int = 10,
                  drop_letterless: bool = True) -> list:
    """groups: provider lists in priority order (best provider first).
    Interleave by provider rank, sink weak text matches and far places,
    de-dup by name + ~60 m (first seen wins, missing coords filled in).
    drop_letterless=False lets geocode keep bare house-number answers
    ('237, Okhla Phase 3' is exactly what the address query asked for)."""
    ranked = []
    for gi, items in enumerate(groups):
        for ri, it in enumerate(items or []):
            # a provider name with no letters is a pincode or a '00'
            # house-name — never a place the user can pick in type-ahead
            _nm = _norm(it.get("name") or "")
            if drop_letterless and not re.search(r"[a-z]", _nm):
                continue
            _nt = _nm.split()
            if len(_nt) == 1 and _nt[0] in _GENERIC_NAME_WORDS:
                continue
            rank = _item_rank(it, q)
            # a weak text match cities away ('Saket' partial in another
            # town) is noise even at the tail — drop, don't sink
            if (rank >= 2 and it.get("distance_m") is not None
                    and it["distance_m"] > PARTIAL_FAR_M):
                continue
            far = it.get("distance_m") is not None and it["distance_m"] > FAR_KM * 1000
            ranked.append(((1 if far else 0), rank, ri, gi, it))
    ranked.sort(key=lambda t: t[:4])
    out: list = []
    for *_, it in ranked:
        dup = next((o for o in out if _dup(o, it)), None)
        if dup is not None:
            if dup["lat"] is None and it["lat"] is not None:
                dup["lat"], dup["lon"] = it["lat"], it["lon"]
            if dup.get("distance_m") is None and it.get("distance_m") is not None:
                dup["distance_m"] = it["distance_m"]
            continue
        out.append(it)
        if len(out) >= limit:
            break
    return out


def _public(items: list) -> list:
    return [{k: v for k, v in it.items() if not k.startswith("_")} for it in items]


# ---------------------------------------------------------------- /ac
@router.get("/status")
async def status(response: Response):
    """Which providers are configured + today's call counts — booleans and
    numbers only, never key material."""
    _cc(response, 0)
    o, m, t = bool(ola_key()), bool(mappls_key()), bool(tomtom_key())
    return {"ola": o, "mappls": m, "tomtom": t, "configured": o or m or t,
            "budget": BUDGET.snapshot()}


def _cell(lat, lon) -> tuple:
    """Bias point rounded to 2 dp (~1.1 km): the cache key AND the point
    the upstream is asked at, so one answer serves the whole cell."""
    b = _bias(lat, lon)
    return (round(b[0], 2), round(b[1], 2))


def _redistance(items: list, lat, lon) -> list:
    """Shared (cell-keyed) rows -> distance_m from the caller's own point."""
    p = _latlon(lat, lon)
    out = []
    for it in items:
        it = dict(it)
        if p and it.get("lat") is not None and it.get("lon") is not None:
            it["distance_m"] = int(round(haversine_m(p[0], p[1], it["lat"], it["lon"])))
        out.append(it)
    return out


def _ac_reply(response, out: dict, lat, lon, full: int = TTL_AC) -> dict:
    _cc(response, _edge_ttl(out, full))
    if out.get("results"):
        out = dict(out)
        out["results"] = _redistance(out["results"], lat, lon)
    return out


def _weak_top(items: list, q: str, bias) -> bool:
    """Ola's top row is weak: nothing came back, its name+address doesn't
    carry every query token, or it is far outside the user's region."""
    if not items:
        return True
    top = items[0]
    hay = (_norm(top.get("name", "")) + " " + _norm(top.get("sub", ""))).split()
    toks = _norm(q).split()
    if toks and not all(any(w.startswith(t) for w in hay) for t in toks):
        return True
    d = top.get("distance_m")
    return d is not None and d > 60000


_BG: set = set()          # background Mappls fills (strong refs until done)


async def _mappls_bridged(q: str, bias, timeout: float, ola_task) -> tuple:
    """Mappls autosuggest -> bridge its coordinate-less rows via Ola
    geocode of "placeName, placeAddress" (rows Ola already has are skipped,
    failures dropped). -> (items, err)."""
    t0 = time.monotonic()
    items, err = await mappls_autosuggest(q, bias, timeout=min(MAPPLS_CAP_S, timeout))
    if err or not items:
        return [], err
    skip = set()
    if ola_task is not None:
        try:
            ola_items, _ = await asyncio.shield(ola_task)
            skip = {_norm(it["name"]) for it in ola_items or [] if it.get("lat") is not None}
        except Exception:  # noqa: BLE001
            skip = set()
    left = max(0.0, MAPPLS_CAP_S + 0.6 - (time.monotonic() - t0))
    items = await _resolve_coords(items[:6], bias, min(TIMEOUT_S, left),
                                  cap=MAX_BRIDGE, skip_names=skip)
    return items, None


@router.get("/ac")
async def ac(response: Response, q: str = Query("", max_length=200),
             lat: Optional[float] = None, lon: Optional[float] = None,
             limit: int = Query(10, ge=1, le=20)):
    q = _SPACE_RE.sub(" ", q or "").strip()
    have_ola, have_mappls = bool(ola_key()), bool(mappls_key())
    if not (have_ola or have_mappls):
        _cc(response, TTL_PARTIAL)
        return _unconfigured()
    nq = _norm(q)
    if len(nq) < 2:                       # Ola autocomplete only for q >= 2 chars
        _cc(response, TTL_AC)
        return {"results": [], "configured": True}
    bias = _cell(lat, lon)
    ck = (nq, bias[0], bias[1], limit)
    hit = _C_AC.get(ck)
    if hit is not None:
        return _ac_reply(response, hit, lat, lon)
    use_ola = have_ola and ola_budget_ok("/places/v1/autocomplete")
    mappls_ok = have_mappls and BUDGET.allow("mappls")
    if not (use_ola or mappls_ok):
        # every provider is over today's budget: the client keeps its own
        # /v2/ac index rows — nothing is made up here
        return _ac_reply(response, _degraded(), lat, lon)
    t0 = time.monotonic()
    ola_task = asyncio.ensure_future(
        ola_autocomplete(q, bias, timeout=AC_TIMEOUT_S)) if use_ola else None
    map_task = None
    if mappls_ok and (len(nq.split()) >= MAPPLS_MIN_TOKENS or not use_ola):
        map_task = asyncio.ensure_future(
            _mappls_bridged(q, bias, MAPPLS_CAP_S, ola_task))
    groups, errs = {}, {}
    if ola_task is not None:
        try:
            items, err = await ola_task
        except Exception as e:  # noqa: BLE001
            items, err = [], _short_err(e)
        if err:
            errs["ola"] = err
        groups["ola"] = items or []
        if map_task is None and mappls_ok and _weak_top(groups["ola"], q, bias):
            left = AC_SOFT_S + MAPPLS_CAP_S - (time.monotonic() - t0)
            if left > 0.5:
                map_task = asyncio.ensure_future(
                    _mappls_bridged(q, bias, min(MAPPLS_CAP_S, left), None))

    def build(mappls_items) -> dict:
        # rows > 200 km out are outside the NCR service area (e.g. Mappls'
        # same-name lodge in Puri) — dropped from type-ahead, not sunk
        near = [[it for it in g if it.get("distance_m") is None
                 or it["distance_m"] <= FAR_KM * 1000]
                for g in (groups.get("ola", []), mappls_items or [])]
        merged = merge_results(near, q=q, limit=limit)
        # canonical-place pin: when the whole query is a known place name
        # ('panipat', 'hapur'), its gazetteer entity must be in the pool —
        # otherwise a same-name provider row wins whenever the index call
        # drops that row (the #1 then flips run to run)
        want_kinds = ("town", "city", "locality", "district", "state",
                      "station", "train_station", "metro_station",
                      "airport", "landmark")
        if (2 <= len(nq) <= 40 and
                not any(_norm(m.get("name") or "") == nq
                        and (m.get("kind") or "") in want_kinds
                        for m in merged)):
            try:
                from .gazetteer import AC
                if AC.ready:
                    cands = [g for g in AC.query(q, lat, lon, 8)
                             if _norm(g.get("name") or "") == nq
                             and (g.get("kind") or "") in want_kinds]
                    cands.sort(key=lambda g: want_kinds.index(g["kind"]))
                    if cands:
                        g = cands[0]
                        merged.insert(0, _item(
                            pid=g.get("id") or f"ac:{nq}",
                            name=g["name"], sub=g.get("subtitle") or "",
                            lat=g["lat"], lon=g["lon"], kind=g["kind"],
                            source=g.get("source") or "gazetteer",
                            distance_m=g.get("distance_m"), bias=bias))
                        merged = merged[:limit]
            except Exception:
                pass
        o = {"results": _public(merged), "configured": True}
        if errs:
            o["errors"] = dict(errs)
        return o

    pending = False
    if map_task is not None:
        wait = max(0.0, AC_SOFT_S - (time.monotonic() - t0))
        done, _ = await asyncio.wait({map_task}, timeout=wait)
        if done:
            try:
                m_items, m_err = map_task.result()
            except Exception as e:  # noqa: BLE001
                m_items, m_err = [], _short_err(e)
            if m_err and m_err != "budget":
                errs["mappls"] = m_err
            groups["mappls"] = m_items or []
        else:
            # answer now with what we have; the Mappls call (capped 2.5 s)
            # finishes in the background and fills the cache for the next
            # identical request
            pending = True

            def _fill(t, ck=ck):
                _BG.discard(t)
                try:
                    m_items, m_err = t.result()
                except BaseException:  # noqa: BLE001 — incl. cancelled at shutdown
                    return
                o = build(m_items)
                if m_err and m_err != "budget":
                    o.setdefault("errors", {})["mappls"] = m_err
                _C_AC.put(ck, o, TTL_PARTIAL if o.get("errors") else None)
            _BG.add(map_task)
            map_task.add_done_callback(_fill)
    out = build(groups.get("mappls"))
    tried = (1 if ola_task is not None else 0) + (1 if map_task is not None else 0)
    if not out["results"] and errs and len(errs) >= tried and not pending:
        return _ac_reply(response, _failed("; ".join(f"{k} {v}" for k, v in errs.items())),
                         lat, lon)
    if pending:
        out["pending"] = "mappls"
        _C_AC.put(ck, out, 15)            # the background fill replaces it
    else:
        _C_AC.put(ck, out, TTL_PARTIAL if errs else None)
    return _ac_reply(response, out, lat, lon)


# ---------------------------------------------------------------- /geocode
@router.get("/geocode")
async def geocode(response: Response, address: str = Query("", max_length=300),
                  lat: Optional[float] = None, lon: Optional[float] = None,
                  limit: int = Query(6, ge=1, le=10)):
    address = _SPACE_RE.sub(" ", address or "").strip()
    have_ola, have_mappls = bool(ola_key()), bool(mappls_key())
    if not (have_ola or have_mappls):
        _cc(response, TTL_PARTIAL)
        return _unconfigured()
    if len(address) < 3:
        _cc(response, TTL_GEOCODE)
        return {"results": [], "configured": True}
    bias = _bias(lat, lon)
    ck = (_norm(address), round(bias[0], 1), round(bias[1], 1), limit)
    hit = _C_GEOCODE.get(ck)
    if hit is not None:
        _cc(response, _edge_ttl(hit, TTL_GEOCODE))
        return hit
    have_mappls = have_mappls and BUDGET.allow("mappls")
    have_ola = have_ola and ola_budget_ok("/places/v1/geocode")
    if not (have_ola or have_mappls):
        _cc(response, TTL_PARTIAL)
        return _degraded()
    t0 = time.monotonic()
    jobs, names = [], []
    if have_mappls:
        jobs.append(mappls_geocode(address, bias)); names.append("mappls")
    if have_ola:
        jobs.append(ola_geocode(address, bias)); names.append("ola")
    res = await asyncio.gather(*jobs, return_exceptions=True)
    groups, errs = {}, {}
    for nm, r in zip(names, res):
        if isinstance(r, BaseException):
            errs[nm] = _short_err(r)
            continue
        items, err = r
        if err:
            errs[nm] = err
        groups[nm] = items or []
    short = False
    if "mappls" in groups:
        # search.js waits 3.5 s for /v2/p/geocode
        left = GEOCODE_TOTAL_S - (time.monotonic() - t0)
        short = left < 0.3 and any(it["lat"] is None for it in groups["mappls"])
        groups["mappls"] = await _resolve_coords(groups["mappls"], bias, left, cap=2)
    # house-level parse from Mappls first (when it could be placed), Ola next;
    # a bare house number IS the asked-for answer here — keep it
    merged = merge_results([groups.get("mappls", []), groups.get("ola", [])],
                           q="", limit=limit, drop_letterless=False)
    if not merged and errs and len(errs) == len(names):
        _cc(response, 0)
        return _failed("; ".join(f"{k} {v}" for k, v in errs.items()))
    out = {"results": _public(merged), "configured": True}
    if errs:
        out["errors"] = errs
    _C_GEOCODE.put(ck, out, TTL_PARTIAL if (errs or short) else None)
    _cc(response, TTL_PARTIAL if short else _edge_ttl(out, TTL_GEOCODE))
    return out


# ---------------------------------------------------------------- /reverse
def _comp(comps, *types) -> str:
    for t in types:
        for c in comps or []:
            if t in (c.get("types") or []):
                v = (c.get("long_name") or c.get("short_name") or "").strip()
                if v:
                    return v
    return ""


def parse_ola_reverse(data) -> Optional[dict]:
    rows = (data or {}).get("results") or []
    if not rows:
        return None
    g = rows[0]
    fa = g.get("formatted_address") or ""
    comps = g.get("address_components") or []
    name = (g.get("name") or "").strip() or _split_desc(fa)[0]
    locality = _comp(comps, "sublocality_level_1", "sublocality", "neighborhood",
                     "locality")
    city = _comp(comps, "locality", "administrative_area_level_3",
                 "administrative_area_level_2")
    if city.lower().endswith(" district"):
        city = city[: -len(" district")]
    if not name:
        return None
    out = {"name": name, "address": plain_sub(fa, "", 6),
           "locality": locality, "city": city, "source": "ola"}
    pin = _comp(comps, "postal_code")
    state = _comp(comps, "administrative_area_level_1")
    if pin:
        out["pincode"] = pin
    if state:
        out["state"] = state
    return out


def parse_mappls_reverse(data) -> Optional[dict]:
    rows = (data or {}).get("results") or []
    if not rows:
        return None
    g = rows[0]
    fa = g.get("formatted_address") or ""
    name = next((str(g.get(k)).strip() for k in
                 ("poi", "houseName", "street", "subSubLocality", "subLocality",
                  "locality", "village") if (g.get(k) or "").strip()), "")
    hn = (g.get("houseNumber") or "").strip()
    if hn and name and name == (g.get("houseName") or g.get("street") or "").strip():
        name = f"{hn}, {name}"
    locality = next((str(g.get(k)).strip() for k in
                     ("subLocality", "locality", "village", "subDistrict")
                     if (g.get(k) or "").strip()), "")
    city = (g.get("city") or g.get("district") or "").strip()
    if city.lower().endswith(" district"):
        city = city[: -len(" district")]
    if not name:
        name = _split_desc(fa)[0]
    if not name:
        return None
    # Mappls appends "508 m from <poi>" prose to formatted_address — keep words
    addr = re.sub(r"\.?\s*\d+(\.\d+)?\s*m from [^,]*", "", fa)
    out = {"name": name, "address": plain_sub(addr, "", 6),
           "locality": locality, "city": city, "source": "mappls"}
    pin = str(g.get("pincode") or "").strip()
    state = (g.get("state") or "").strip()
    district = (g.get("district") or "").strip()
    if district.lower().endswith(" district"):
        district = district[: -len(" district")].strip()
    if pin:
        out["pincode"] = pin
    if state:
        out["state"] = state
    if district:
        out["district"] = district
    return out


@router.get("/reverse")
async def reverse(response: Response, lat: float = Query(..., ge=-90, le=90),
                  lon: float = Query(..., ge=-180, le=180)):
    have_ola, have_mappls = bool(ola_key()), bool(mappls_key())
    if not (have_ola or have_mappls):
        _cc(response, TTL_PARTIAL)
        return _unconfigured()
    ck = (round(lat, 4), round(lon, 4))
    hit = _C_REVERSE.get(ck)
    if hit is not None:
        _cc(response, _edge_ttl(hit, TTL_REVERSE))
        return hit
    have_ola = have_ola and ola_budget_ok("/places/v1/reverse-geocode")
    have_mappls = have_mappls and BUDGET.allow("mappls")
    if not (have_ola or have_mappls):
        _cc(response, TTL_PARTIAL)
        return _degraded()
    # Ola first (fast, 3.3k/day); Mappls (slow, ~900/day) only when Ola
    # can't answer — never both for every pin drop
    errs, parsed = {}, {}
    for nm in (("ola",) if have_ola else ()) + (("mappls",) if have_mappls else ()):
        if parsed:
            break
        try:
            if nm == "ola":
                data, err = await _ola_get("/places/v1/reverse-geocode",
                                           {"latlng": f"{lat:.6f},{lon:.6f}"})
            else:
                data, err = await _mappls_get("/address/rev-geocode",
                                              {"lat": f"{lat:.6f}", "lng": f"{lon:.6f}"})
        except Exception as e:  # noqa: BLE001
            data, err = None, _short_err(e)
        if err:
            errs[nm] = err
            continue
        p = (parse_ola_reverse if nm == "ola" else parse_mappls_reverse)(data)
        if p:
            parsed[nm] = p
    best = parsed.get("ola") or parsed.get("mappls")
    if best is None:
        if errs:
            _cc(response, 0)
            return _failed("; ".join(f"{k} {v}" for k, v in errs.items()))
        out = {"results": [], "configured": True}
        _C_REVERSE.put(ck, out, TTL_PARTIAL)
        _cc(response, TTL_PARTIAL)
        return out
    out = dict(best)
    out["configured"] = True
    _C_REVERSE.put(ck, out, TTL_PARTIAL if errs else None)
    _cc(response, TTL_PARTIAL if errs else TTL_REVERSE)
    return out


# ---------------------------------------------------------------- /nearby
_KIND_OLA = {"lodging": "lodging", "hotel": "lodging", "hotels": "lodging"}
_KIND_MAPPLS = {"lodging": "hotel", "hotel": "hotel", "hotels": "hotel"}


async def ola_nearby(bias, kind: str, radius_m: int, limit: int) -> tuple:
    params = {"layers": "venue", "types": _KIND_OLA.get(kind, kind),
              "location": f"{bias[0]:.6f},{bias[1]:.6f}",
              "radius": radius_m, "limit": limit, "withCentroid": "true"}
    data, err = await _ola_get("/places/v1/nearbysearch", params)
    if err == "http 400":                      # older param set: retry plain
        params.pop("withCentroid", None)
        data, err = await _ola_get("/places/v1/nearbysearch", params)
    if err:
        return [], err
    err = _ola_status_err(data)
    if err:
        return [], err
    items = parse_ola_predictions(data, bias)
    if items and all(it["lat"] is None for it in items):
        # basic search withheld coordinates — the advanced search carries them
        adv, err2 = await _ola_get("/places/v1/nearbysearch/advanced", {
            "location": f"{bias[0]:.6f},{bias[1]:.6f}",
            "types": _KIND_OLA.get(kind, kind), "radius": radius_m,
            "limit": limit})
        if not err2 and isinstance(adv, dict):
            items = parse_ola_predictions(adv, bias) or items
    for it in items:
        if it["kind"] in ("poi", "place") and kind in ("lodging", "hotel", "hotels"):
            it["kind"] = "lodging"
    return [it for it in items if it["lat"] is not None], None


async def mappls_nearby(bias, kind: str, radius_m: int) -> tuple:
    data, err = await _mappls_get("/places/nearby/json", {
        "keywords": _KIND_MAPPLS.get(kind, kind),
        "refLocation": f"{bias[0]:.6f},{bias[1]:.6f}",
        "radius": max(500, min(10000, radius_m)), "sortBy": "dist:asc",
        "region": "IND"})
    if err:
        return [], err
    items = parse_mappls_suggest(data, bias)
    if kind in ("lodging", "hotel", "hotels"):
        for it in items:
            if it["kind"] in ("poi", "place"):
                it["kind"] = "lodging"
    return items, None


def _nearby_reply(response, out: dict, lat, lon) -> dict:
    _cc(response, _edge_ttl(out, TTL_NEARBY))
    if out.get("results"):
        out = dict(out)
        rows = _redistance(out["results"], lat, lon)
        rows.sort(key=lambda it: (it.get("distance_m") is None, it.get("distance_m") or 0))
        out["results"] = rows
    return out


@router.get("/nearby")
async def nearby(response: Response, lat: float = Query(..., ge=-90, le=90),
                 lon: float = Query(..., ge=-180, le=180),
                 kind: str = Query("lodging", max_length=40),
                 radius_m: int = Query(3000, ge=100, le=20000),
                 limit: int = Query(20, ge=1, le=50)):
    have_ola, have_mappls = bool(ola_key()), bool(mappls_key())
    if not (have_ola or have_mappls):
        _cc(response, TTL_PARTIAL)
        return _unconfigured()
    kind = re.sub(r"[^a-z_]", "", (kind or "lodging").lower()) or "lodging"
    # 2 dp cell (~1.1 km): the key AND the point asked upstream; distances
    # are re-measured from the caller's own point on the way out
    pt = (round(lat, 2), round(lon, 2))
    ck = (pt[0], pt[1], kind, radius_m, limit)
    hit = _C_NEARBY.get(ck)
    if hit is not None:
        return _nearby_reply(response, hit, lat, lon)
    have_ola = have_ola and ola_budget_ok("/places/v1/nearbysearch")
    have_mappls = have_mappls and BUDGET.allow("mappls")
    if not (have_ola or have_mappls):
        return _nearby_reply(response, _degraded(), lat, lon)
    t0 = time.monotonic()
    jobs, names = [], []
    if have_ola:
        jobs.append(ola_nearby(pt, kind, radius_m, limit)); names.append("ola")
    if have_mappls:
        jobs.append(mappls_nearby(pt, kind, radius_m)); names.append("mappls")
    res = await asyncio.gather(*jobs, return_exceptions=True)
    groups, errs = {}, {}
    for nm, r in zip(names, res):
        if isinstance(r, BaseException):
            errs[nm] = _short_err(r)
            continue
        items, err = r
        if err:
            errs[nm] = err
        groups[nm] = items or []
    if groups.get("mappls"):
        groups["mappls"] = await _resolve_coords(
            groups["mappls"], pt, NEARBY_TOTAL_S - (time.monotonic() - t0), cap=4,
            skip_names={_norm(it["name"]) for it in groups.get("ola", [])})
    merged = merge_results([groups.get("ola", []), groups.get("mappls", [])],
                           q="", limit=limit)
    merged = [it for it in merged
              if it.get("distance_m") is None or it["distance_m"] <= radius_m * 1.5]
    merged.sort(key=lambda it: (it.get("distance_m") is None, it.get("distance_m") or 0))
    if not merged and errs and len(errs) == len(names):
        _cc(response, 0)
        return _failed("; ".join(f"{k} {v}" for k, v in errs.items()))
    out = {"results": _public(merged), "configured": True}
    if errs:
        out["errors"] = errs
    _C_NEARBY.put(ck, out, TTL_PARTIAL if errs else None)
    return _nearby_reply(response, out, lat, lon)


# ---------------------------------------------------------------- TomTom route traffic
def _coerce_coords(coords, lonlat: Optional[bool] = None) -> list:
    """[[lat,lon],...] (or {lat,lon} dicts) -> [(lat,lon)]. lonlat=None
    auto-detects GeoJSON order for the service area (lat 5-40 < lon 60-100)."""
    pts = []
    for c in coords or []:
        if isinstance(c, dict):
            p = _latlon(c.get("lat", c.get("latitude")),
                        c.get("lon", c.get("lng", c.get("longitude"))))
        elif isinstance(c, (list, tuple)) and len(c) >= 2:
            p = (_num(c[0]), _num(c[1]))
            p = None if None in p else p
        else:
            p = None
        if p:
            pts.append(p)
    if not pts:
        return []
    if lonlat is None:
        lonlat = all(60 <= a <= 100 and 5 <= b <= 40 for a, b in pts[:50])
    if lonlat:
        pts = [(b, a) for a, b in pts]
    return [p for p in pts if _latlon(*p)]


def downsample(pts: list, max_n: int = TT_MAX_PTS) -> list:
    """Line -> <= max_n supporting points that still pin OUR route: half the
    budget goes to Ramer-Douglas-Peucker shape points (turns), the rest to
    evenly spaced points so long straights never become one free leg that
    TomTom could re-route. First + last always kept (TomTom needs origin and
    destination at the ends of supportingPoints)."""
    clean = [pts[0]] if pts else []
    for p in pts[1:]:
        if haversine_m(clean[-1][0], clean[-1][1], p[0], p[1]) >= 1.0:
            clean.append(p)
    if len(clean) == 1 and len(pts) > 1:
        clean.append(pts[-1])
    if len(clean) <= max_n:
        return clean
    lat0 = math.radians(sum(p[0] for p in clean) / len(clean))
    kx, ky = 111320.0 * math.cos(lat0), 110540.0
    xy = [(p[1] * kx, p[0] * ky) for p in clean]

    def rdp(eps: float) -> list:
        keep = [False] * len(xy)
        keep[0] = keep[-1] = True
        stack = [(0, len(xy) - 1)]
        while stack:
            i, j = stack.pop()
            if j <= i + 1:
                continue
            (x1, y1), (x2, y2) = xy[i], xy[j]
            dx, dy = x2 - x1, y2 - y1
            norm = math.hypot(dx, dy)
            best, bk = -1.0, -1
            for k in range(i + 1, j):
                x0, y0 = xy[k]
                if norm == 0:
                    d = math.hypot(x0 - x1, y0 - y1)
                else:
                    d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norm
                if d > best:
                    best, bk = d, k
            if best > eps:
                keep[bk] = True
                stack.append((i, bk))
                stack.append((bk, j))
        return [k for k in range(len(clean)) if keep[k]]

    shape_cap = max(2, max_n // 2)
    shape = [0, len(clean) - 1]
    eps = 4.0
    while eps < 4000:
        idx = rdp(eps)
        if len(idx) <= shape_cap:
            shape = idx
            break
        eps *= 1.8
    cum = [0.0]
    for a, b in zip(clean, clean[1:]):
        cum.append(cum[-1] + haversine_m(a[0], a[1], b[0], b[1]))
    keep = set(shape)
    budget = max_n - len(keep)
    if budget > 0 and cum[-1] > 0:
        j = 0
        for k in range(1, budget + 1):
            target = cum[-1] * k / (budget + 1)
            while j < len(cum) - 1 and cum[j] < target:
                j += 1
            keep.add(j)
    out = sorted(keep)[:max_n]
    if out[-1] != len(clean) - 1:
        out[-1] = len(clean) - 1
    return [clean[k] for k in out]


def _tt_route_points(r: dict) -> tuple:
    """route -> ([(lat,lon)], cum_m): the route's own polyline (all legs'
    points concatenated) and cumulative metres along it."""
    pts = []
    for leg in r.get("legs") or []:
        for p in leg.get("points") or []:
            q = _latlon(p.get("latitude"), p.get("longitude"))
            if q:
                pts.append(q)
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + haversine_m(a[0], a[1], b[0], b[1]))
    return pts, cum


def _tt_sec_norm(s: str) -> str:
    """'importantRoadStretch' (request) and 'IMPORTANT_ROAD_STRETCH'
    (response) -> 'important_road_stretch'."""
    return re.sub(r"(?<=[a-z0-9])([A-Z])", r"_\1", str(s)).lower()


def _tt_route(r: dict, requested: frozenset) -> dict:
    """One routes[] entry -> contract dict. Section startPointIndex /
    endPointIndex address this route's own point list."""
    pts, cum = _tt_route_points(r)
    s = r.get("summary") or {}
    req = {_tt_sec_norm(x) for x in requested}
    # False (checked, absent on this route) vs key missing (never asked)
    flags = {fl: False for st, fl in _TT_FLAG_SECTIONS.items()
             if _tt_sec_norm(st) in req}

    def at(i):
        if not pts:
            return None
        return max(0, min(int(i), len(pts) - 1))

    def span(sec):
        i0, i1 = at(sec.get("startPointIndex") or 0), at(sec.get("endPointIndex") or 0)
        if i0 is None:
            return None
        return {"lat": round(pts[i0][0], 6), "lon": round(pts[i0][1], 6),
                "end_lat": round(pts[i1][0], 6), "end_lon": round(pts[i1][1], 6),
                "from_m": int(round(cum[i0])), "to_m": int(round(cum[i1]))}

    roads, jams, tolls, speed_limits = [], [], [], []
    for sec in r.get("sections") or []:
        st = str(sec.get("sectionType") or "")
        fl = _TT_FLAG_SECTIONS.get(st)
        if fl is not None and _tt_sec_norm(st) in req:
            flags[fl] = True
        if st == "IMPORTANT_ROAD_STRETCH":
            nm = ((sec.get("streetName") or {}).get("text") or "").strip()
            if not nm:
                nm = ", ".join(x.get("text", "") for x in (sec.get("roadNumbers") or [])
                               if x.get("text"))
            if nm:
                roads.append((int(sec.get("startPointIndex") or 0),
                              int(sec.get("endPointIndex") or 0), nm))
    named = []
    if "important_road_stretch" in req:
        seen_r, named = set(), []
        for a, b, nm in sorted(roads):
            key = (a, b, nm)
            if key in seen_r:
                continue
            seen_r.add(key)
            i0, i1 = at(a), at(b)
            if i0 is not None:
                named.append({"from_m": int(round(cum[i0])),
                              "to_m": int(round(cum[i1])), "name": nm})

    def road_for(a, b) -> str:
        best, bo = "", 0
        for s0, s1, nm in roads:
            ov = min(b, s1) - max(a, s0)
            if ov > bo or (ov == 0 and bo == 0 and s0 <= a <= s1 and not best):
                best, bo = nm, ov
        return best

    for sec in r.get("sections") or []:
        st = str(sec.get("sectionType") or "")
        if st == "TRAFFIC":
            sp = span(sec)
            if sp is None:
                continue
            cat = str(sec.get("simpleCategory") or "").lower() or None
            mag = sec.get("magnitudeOfDelay")
            jams.append({
                **sp,
                "delay_s": int(sec["delayInSeconds"]) if _num(sec.get("delayInSeconds")) is not None else None,
                "road": road_for(at(sec.get("startPointIndex") or 0),
                                 at(sec.get("endPointIndex") or 0)),
                "magnitude": int(mag) if _num(mag) is not None else None,
                "category": cat,
                "speed_kmh": _num(sec.get("effectiveSpeedInKmh")),
            })
        elif st in ("TOLL", "TOLL_VIGNETTE"):
            sp = span(sec)
            if sp is None:
                continue
            pays = [str(p) for p in (sec.get("tollPaymentTypes") or []) if p]
            t = dict(sp)
            if pays:
                t["payments"] = pays
            if st == "TOLL_VIGNETTE":
                t["vignette"] = True
            tolls.append(t)
        elif st == "SPEED_LIMIT":
            sp = span(sec)
            lim = _num(sec.get("maxSpeedLimitInKmh"))
            if sp is None or lim is None:
                continue
            speed_limits.append({"from_m": sp["from_m"], "to_m": sp["to_m"],
                                 "kmh": int(lim)})

    instructions = []
    for leg in r.get("legs") or []:
        for ins in ((leg.get("guidance") or {}).get("instructions") or []):
            msg = (ins.get("message") or "").strip()
            if not msg:
                continue
            p = _latlon((ins.get("point") or {}).get("latitude"),
                        (ins.get("point") or {}).get("longitude"))
            it = {"i": len(instructions), "text": msg,
                  "maneuver": ins.get("maneuver") or "",
                  "street": ins.get("street") or "",
                  "offset_m": int(_num(ins.get("routeOffsetInMeters")) or 0)}
            tsec = _num(ins.get("travelTimeInSeconds"))
            if tsec is not None:
                it["t_s"] = int(tsec)
            if p:
                it["lat"], it["lon"] = round(p[0], 6), round(p[1], 6)
            instructions.append(it)

    progress = []
    for pr in r.get("progress") or []:
        d_m, t_s = _num(pr.get("distanceInMeters")), _num(pr.get("travelTimeInSeconds"))
        pi = _num(pr.get("pointIndex"))
        if d_m is None and t_s is None:
            continue
        progress.append({"i": int(pi or 0),
                         "t_s": int(t_s) if t_s is not None else None,
                         "d_m": int(round(d_m or 0))})

    live = _num(s.get("travelTimeInSeconds"))
    free = _num(s.get("noTrafficTravelTimeInSeconds"))
    delay = _num(s.get("trafficDelayInSeconds"))
    out = {
        "live_s": int(live) if live is not None else None,
        "freeflow_s": int(free) if free is not None else None,
        "delay_s": int(delay) if delay is not None else None,
        "length_m": int(_num(s.get("lengthInMeters")) or 0) or None,
        "jams": jams,
        "source": "tomtom",
    }
    for src, dst in (("historicTrafficTravelTimeInSeconds", "historic_s"),
                     ("liveTrafficIncidentsTravelTimeInSeconds", "incidents_s"),
                     ("trafficLengthInMeters", "traffic_length_m"),
                     ("deviationDistance", "deviation_m"),
                     ("deviationTime", "deviation_s")):
        v = _num(s.get(src))
        if v is not None:
            out[dst] = int(v)
    for src, dst in (("fuelConsumptionInLiters", "fuel_l"),
                     ("batteryConsumptionInkWh", "battery_kwh")):
        v = _num(s.get(src))
        if v is not None:
            out[dst] = round(v, 3)
    for src, dst in (("departureTime", "depart_at"),
                     ("arrivalTime", "arrive_at")):
        v = s.get(src)
        if isinstance(v, str) and v:
            out[dst] = v
    if pts:
        out["polyline"] = [[round(a, 6), round(b, 6)] for a, b in pts]
    if flags:
        out["flags"] = flags
    if tolls:
        out["tolls"] = tolls
    if speed_limits:
        out["speed_limits"] = speed_limits
    if "important_road_stretch" in req and named:
        out["roads"] = named
    if progress:
        out["progress"] = progress
    if instructions:
        out["instructions"] = instructions
    return out


def parse_tomtom_route(data, requested: frozenset = frozenset(TT_SECTION_TYPES)) -> Optional[dict]:
    """routes[0] -> contract dict + routes[1:] -> alternatives, same shape.
    `requested` = the section types the request asked for (a flag is only
    claimed absent when we actually asked for it)."""
    routes = (data or {}).get("routes") or []
    if not routes:
        return None
    out = _tt_route(routes[0], requested)
    alts = [_tt_route(r, requested) for r in routes[1:]]
    if alts:
        out["alternatives"] = alts
    return out


async def _route_traffic(pts: list, mode: str = "car", depart_at=None,
                         consumption=None) -> tuple:
    """(dict, None) | (None, err). pts already [(lat, lon)], >= 2.
    consumption: ("combustion"|"electric", per-100 km amount) -> the summary
    then carries the provider-computed fuel_l / battery_kwh."""
    sp = downsample(pts, TT_MAX_PTS)
    if len(sp) < 2:
        return None, "need >= 2 distinct points"
    mode = mode if mode in _TT_MODES else "car"
    dep = depart_at if isinstance(depart_at, str) and _DEPART_RE.match(depart_at) else None
    cons = None
    try:
        eng, per = (consumption or (None, None))
        if eng in ("combustion", "electric") and _num(per) and 0 < float(per) < 200:
            cons = (eng, float(per))
    except (TypeError, ValueError):
        cons = None
    h = hashlib.sha1(("|".join(f"{a:.5f},{b:.5f}" for a, b in sp)
                      + mode + str(dep) + str(cons)).encode()).hexdigest()
    hit = _C_ROUTE.get(h)
    if hit is not None:
        return hit, None
    o, d = sp[0], sp[-1]
    url = (f"{TOMTOM_BASE}/routing/1/calculateRoute/"
           f"{o[0]:.6f},{o[1]:.6f}:{d[0]:.6f},{d[1]:.6f}/json")
    params = [("key", tomtom_key()), ("traffic", "true"),
              ("computeTravelTimeFor", "all"), ("routeType", "fastest"),
              ("travelMode", mode),
              ("maxAlternatives", str(TT_MAX_ALTS)),
              ("alternativeType", "anyRoute"),
              ("instructionsType", "text"), ("language", "en-GB"),
              ("routeRepresentation", "polyline"),
              ("includeTollPaymentTypes", "all"),
              ("extendedRouteRepresentation", "distance"),
              ("extendedRouteRepresentation", "travelTime")]
    params += [("sectionType", st) for st in TT_SECTION_TYPES]
    if dep:
        params.append(("departAt", dep))
    if cons:
        eng, per = cons
        params.append(("vehicleEngineType", eng))
        params.append(("constantSpeedConsumptionInLitersPerHundredkm" if eng == "combustion"
                       else "constantSpeedConsumptionInkWhPerHundredkm",
                       f"50,{per:g}"))
    body = {"supportingPoints": [{"latitude": round(a, 6), "longitude": round(b, 6)}
                                 for a, b in sp]}
    requested = frozenset(TT_SECTION_TYPES)
    data, err = await _call("POST", url, "tomtom", params=params, json_body=body,
                            budget="tomtom")
    if err == "http 400":
        # road names / guidance extras are niceties: if TomTom refuses the
        # richer request for this line, ask again for the traffic picture
        # alone (alternatives kept — verified harmless)
        params = [("key", tomtom_key()), ("traffic", "true"),
                  ("sectionType", "traffic"),
                  ("computeTravelTimeFor", "all"), ("routeType", "fastest"),
                  ("travelMode", mode),
                  ("maxAlternatives", str(TT_MAX_ALTS)),
                  ("alternativeType", "anyRoute")]
        requested = frozenset({"traffic"})
        data, err = await _call("POST", url, "tomtom", params=params, json_body=body,
                                budget="tomtom")
    if err:
        return None, err
    out = parse_tomtom_route(data, requested)
    if out is None:
        return None, "no route"
    _C_ROUTE.put(h, out)
    return out, None


# ---------------------------------------------------------------- Ola traffic fallback
def decode_polyline(s: str, precision: int = 5) -> list:
    """Google encoded polyline -> [(lat, lon)]."""
    pts, i, lat, lng, n, f = [], 0, 0, 0, len(s or ""), 10.0 ** precision
    while i < n:
        vals = []
        for _ in (0, 1):
            shift = res = 0
            while True:
                if i >= n:
                    return pts
                b = ord(s[i]) - 63
                i += 1
                res |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            vals.append(~(res >> 1) if res & 1 else res >> 1)
        lat += vals[0]
        lng += vals[1]
        pts.append((lat / f, lng / f))
    return pts


# Ola documents travel_advisory only as "congestion types" per polyline
# span: "fromIdx,toIdx,level|...". Levels seen live: 0, 5, 10, 15 (higher
# = slower). Honest mapping, mirroring TomTom's magnitudeOfDelay scale:
#   level <= 0  -> free flow (no jam emitted)
#   level 1-9   -> category "slow", magnitude 1 (minor)
#   level 10-14 -> category "jam",  magnitude 2 (moderate)
#   level >= 15 -> category "jam",  magnitude 3 (major)
# Ola gives no per-span delay or speed -> delay_s / speed_kmh stay None.
def ola_level(level: float) -> Optional[tuple]:
    if level is None or level <= 0:
        return None
    if level < 10:
        return ("slow", 1)
    if level < 15:
        return ("jam", 2)
    return ("jam", 3)


def _densify(pts: list, step_m: float = 30.0, cap: int = 20000) -> list:
    out = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        d = haversine_m(a[0], a[1], b[0], b[1])
        k = int(d // step_m)
        for j in range(1, k + 1):
            t = j / (k + 1)
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
        out.append(b)
        if len(out) > cap:
            break
    return out


def _ola_polyline(r: dict):
    return decode_polyline(r.get("overview_polyline") or "")


def _ola_poly_jams(poly: list, advisory: str) -> list:
    """travel_advisory "from,to,level|..." -> jam spans measured along THIS
    polyline (used for Ola's own alternative routes; the primary route's
    jams are projected onto our line instead)."""
    cum = [0.0]
    for a, b in zip(poly, poly[1:]):
        cum.append(cum[-1] + haversine_m(a[0], a[1], b[0], b[1]))
    jams = []
    for part in str(advisory or "").split("|"):
        f = [x.strip() for x in part.split(",")]
        if len(f) < 3:
            continue
        a, b, lv = _num(f[0]), _num(f[1]), _num(f[2])
        cls = ola_level(lv)
        if a is None or b is None or cls is None or not poly:
            continue
        a, b = max(0, int(a)), min(len(poly) - 1, int(b))
        if a > b:
            continue
        # merge a same-category span separated from the last jam by a
        # <= 50 m gap (the advisory is very granular)
        if (jams and jams[-1]["category"] == cls[0]
                and cum[a] - jams[-1]["to_m"] <= 50):
            j = jams[-1]
            if cum[b] > j["to_m"]:
                j["to_m"] = int(round(cum[b]))
                j["end_lat"], j["end_lon"] = round(poly[b][0], 6), round(poly[b][1], 6)
            j["magnitude"] = max(j["magnitude"], cls[1])
            j["level"] = max(j["level"], int(lv))
            continue
        jams.append({"lat": round(poly[a][0], 6), "lon": round(poly[a][1], 6),
                     "end_lat": round(poly[b][0], 6), "end_lon": round(poly[b][1], 6),
                     "from_m": int(round(cum[a])), "to_m": int(round(cum[b])),
                     "delay_s": None, "road": "", "magnitude": cls[1],
                     "category": cls[0], "speed_kmh": None,
                     "level": int(lv)})
    return jams


def _ola_instructions(legs) -> list:
    """legs[].steps[] -> turn-by-turn rows (real provider text)."""
    out = []
    for leg in legs or []:
        for st in leg.get("steps") or []:
            txt = (st.get("instructions") or "").strip()
            if not txt:
                continue
            p = _latlon((st.get("start_location") or {}).get("lat"),
                        (st.get("start_location") or {}).get("lng"))
            it = {"i": len(out), "text": txt,
                  "maneuver": str(st.get("maneuver") or ""),
                  "distance_m": int(_num(st.get("distance")) or 0),
                  "duration_s": int(_num(st.get("duration")) or 0)}
            if p:
                it["lat"], it["lon"] = round(p[0], 6), round(p[1], 6)
            out.append(it)
    return out


def _ola_route_dict(r: dict, poly: list) -> dict:
    """One Ola routes[] entry -> contract shape (its own polyline basis)."""
    legs = r.get("legs") or []
    dur = sum(_num(lg.get("duration")) or 0 for lg in legs)
    dist = sum(_num(lg.get("distance")) or 0 for lg in legs)
    out = {"live_s": int(dur) if dur else None,
           "freeflow_s": None, "delay_s": None,
           "length_m": int(dist) or None,
           "jams": _ola_poly_jams(poly, r.get("travel_advisory")),
           "source": "ola"}
    if poly:
        out["polyline"] = [[round(a, 6), round(b, 6)] for a, b in poly]
    ins = _ola_instructions(legs)
    if ins:
        out["instructions"] = ins
    if (r.get("summary") or "").strip():
        out["summary"] = r["summary"].strip()
    warns = [str(w) for w in (r.get("warnings") or []) if str(w).strip()]
    if warns:
        out["warnings"] = warns
    adv = str(r.get("travel_advisory") or "")
    if adv:
        out["advisory"] = adv
    return out


def parse_ola_traffic(data, our_pts: list, near_m: float = 60.0) -> Optional[dict]:
    """Ola Directions (overview=full, traffic_metadata=true, steps=true,
    alternatives=true) -> contract dict measured along OUR line: a slow/jam
    span counts only where Ola's polyline runs within near_m of our line;
    from_m/to_m are metres along our line. live_s is Ola's own ETA, kept
    only when Ola's route length is within 15 % of ours (else it describes
    a different road). polyline / instructions / advisory / alternatives
    describe Ola's own returned geometry, not our line."""
    routes = (data or {}).get("routes") or []
    if not routes or len(our_pts) < 2:
        return None
    r = routes[0]
    poly = _ola_polyline(r)
    if poly and haversine_m(poly[0][0], poly[0][1], our_pts[0][0], our_pts[0][1]) > 50000:
        poly = decode_polyline(r.get("overview_polyline") or "", 6)
    legs = r.get("legs") or []
    dur = sum(_num(lg.get("duration")) or 0 for lg in legs)
    dist = sum(_num(lg.get("distance")) or 0 for lg in legs)
    our = _densify(our_pts)
    cum = [0.0]
    for a, b in zip(our, our[1:]):
        cum.append(cum[-1] + haversine_m(a[0], a[1], b[0], b[1]))
    our_len = cum[-1]
    grid: dict = {}
    for k, p in enumerate(our):
        grid.setdefault((int(p[0] / 0.001), int(p[1] / 0.001)), []).append(k)

    def nearest(p) -> Optional[int]:
        gx, gy = int(p[0] / 0.001), int(p[1] / 0.001)
        best, bk = near_m, None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for k in grid.get((gx + dx, gy + dy), ()):
                    d = haversine_m(p[0], p[1], our[k][0], our[k][1])
                    if d <= best:
                        best, bk = d, k
        return bk

    spans = []
    for part in str(r.get("travel_advisory") or "").split("|"):
        f = [x.strip() for x in part.split(",")]
        if len(f) < 3:
            continue
        a, b, lv = _num(f[0]), _num(f[1]), _num(f[2])
        cls = ola_level(lv)
        if a is None or b is None or cls is None or not poly:
            continue
        a, b = max(0, int(a)), min(len(poly) - 1, int(b))
        hits = [k for k in (nearest(poly[i]) for i in range(a, b + 1)) if k is not None]
        if hits:
            spans.append((min(hits), max(hits), cls, int(lv)))
    spans.sort()
    jams: list = []
    for k0, k1, (cat, mag), lv in spans:
        if jams and jams[-1]["category"] == cat and cum[k0] - jams[-1]["to_m"] <= 50:
            j = jams[-1]
            if cum[k1] > j["to_m"]:
                j["to_m"] = int(round(cum[k1]))
                j["end_lat"], j["end_lon"] = round(our[k1][0], 6), round(our[k1][1], 6)
            j["magnitude"] = max(j["magnitude"], mag)
            j["level"] = max(j["level"], lv)
            continue
        jams.append({"lat": round(our[k0][0], 6), "lon": round(our[k0][1], 6),
                     "end_lat": round(our[k1][0], 6), "end_lon": round(our[k1][1], 6),
                     "from_m": int(round(cum[k0])), "to_m": int(round(cum[k1])),
                     "delay_s": None, "road": "", "magnitude": mag,
                     "category": cat, "speed_kmh": None, "level": lv})
    same_road = bool(dist) and our_len > 0 and abs(dist - our_len) <= 0.15 * our_len
    out = {"live_s": int(dur) if (dur and same_road) else None,
           "freeflow_s": None, "delay_s": None,
           "length_m": int(dist) or None, "jams": jams, "source": "ola"}
    if poly:
        out["polyline"] = [[round(a, 6), round(b, 6)] for a, b in poly]
    ins = _ola_instructions(legs)
    if ins:
        out["instructions"] = ins
    if (r.get("summary") or "").strip():
        out["summary"] = r["summary"].strip()
    warns = [str(w) for w in (r.get("warnings") or []) if str(w).strip()]
    if warns:
        out["warnings"] = warns
    adv = str(r.get("travel_advisory") or "")
    if adv:
        out["advisory"] = adv
    alts = []
    for alt in routes[1:]:
        alts.append(_ola_route_dict(alt, _ola_polyline(alt)))
    if alts:
        out["alternatives"] = alts
    return out


# our mode names -> Ola's documented modes (driving | walking | bike | auto)
_OLA_MODES = {"car": "driving", "taxi": "driving", "cab": "driving",
              "bus": "driving", "van": "driving", "truck": "driving",
              "motorcycle": "driving", "two_wheeler": "bike",
              "bicycle": "bike", "bike": "bike", "cycling": "bike",
              "walk": "walking", "pedestrian": "walking", "walking": "walking",
              "auto": "auto", "rickshaw": "auto"}


async def _ola_route_traffic(pts: list, mode: str = "driving") -> tuple:
    """(dict, None) | (None, err): Ola Directions (alternatives + steps +
    traffic_metadata) on the line's own origin -> destination, projected
    back onto the line."""
    sp = downsample(pts, TT_MAX_PTS)
    if len(sp) < 2:
        return None, "need >= 2 distinct points"
    omode = _OLA_MODES.get(str(mode or "").lower(), "driving")
    h = "ola:" + hashlib.sha1(("|".join(f"{a:.5f},{b:.5f}" for a, b in sp)
                               + omode).encode()).hexdigest()
    hit = _C_ROUTE.get(h)
    if hit is not None:
        return hit, None
    o, d = pts[0], pts[-1]
    data, err = await _call(
        "POST", OLA_BASE + "/routing/v1/directions", "ola",
        params={"origin": f"{o[0]:.6f},{o[1]:.6f}",
                "destination": f"{d[0]:.6f},{d[1]:.6f}",
                "mode": omode,
                "alternatives": "true", "steps": "true", "overview": "full",
                "traffic_metadata": "true", "language": "en",
                "route_preference": "fastest", "api_key": ola_key()},
        budget="ola:directions", headers={"X-Request-Id": uuid.uuid4().hex})
    if err:
        return None, err
    try:
        out = parse_ola_traffic(data, pts if len(pts) <= 20000 else sp)
    except Exception:  # noqa: BLE001
        out = None
    if out is None:
        return None, "no route"
    _C_ROUTE.put(h, out)
    return out, None


async def _traffic(pts: list, mode: str = "car", depart_at=None,
                   consumption=None) -> tuple:
    """TomTom (best: delay + jam speeds + tolls + speed limits +
    alternatives + time profile) -> Ola travel_advisory + steps ->
    nothing. Skips a provider that is unconfigured or over today's
    budget."""
    errs = []
    if tomtom_key():
        if BUDGET.allow("tomtom"):
            out, err = await _route_traffic(pts, mode, depart_at=depart_at,
                                            consumption=consumption)
            if out is not None:
                return out, None
            errs.append(err)
        else:
            errs.append("budget")
    if ola_key():
        if ola_budget_ok("/routing/v1/directions"):
            out, err = await _ola_route_traffic(pts, mode)
            if out is not None:
                return out, None
            errs.append(err)
        else:
            errs.append("budget")
    if not errs:
        return None, "unconfigured"
    real = [e for e in errs if e and e != "budget"]
    return None, (real[0] if real else "budget")


async def traffic_for_route(coords, lonlat: Optional[bool] = None,
                            mode: str = "car", depart_at=None,
                            consumption=None) -> Optional[dict]:
    """For other server modules (async): live traffic on a route line.

        t = await traffic_for_route([[lat, lon], ...])
        -> {live_s, freeflow_s, delay_s, length_m, jams[...], source,
            historic_s, incidents_s, traffic_length_m, depart_at,
            arrive_at, polyline, roads, tolls, speed_limits, flags,
            progress, instructions, alternatives}  (all additive; only
            present when the provider really returned them) | None

    TomTom first; Ola Directions travel_advisory when TomTom is absent, over
    budget or failing (source "ola": no delay_s; jams carry category
    slow|jam + magnitude + level; adds real turn-by-turn instructions and
    alternatives with their own advisories); None when neither can answer
    (callers then show no traffic — never a made-up one). GeoJSON
    [lon, lat] order is auto-detected (or force lonlat=True).

    Optional: mode (TomTom travelMode; Ola driving/walking/bike/auto),
    depart_at (ISO 8601 str -> TomTom departAt), consumption=
    ("combustion"|"electric", per-100 km amount) -> fuel_l / battery_kwh
    computed by TomTom's own model."""
    if not (tomtom_key() or ola_key()):
        return None
    try:
        pts = _coerce_coords(coords, lonlat)
        if len(pts) < 2:
            return None
        out, err = await _traffic(pts, mode, depart_at=depart_at,
                                  consumption=consumption)
        return out if not err else None
    except Exception:  # noqa: BLE001 — a traffic miss must never break a plan
        log.warning("traffic_for_route failed")
        return None


@router.post("/route_traffic")
async def route_traffic(request: Request):
    if not (tomtom_key() or ola_key()):
        return _unconfigured()
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "body must be JSON {coords:[[lat,lon],...]}"},
                            status_code=400)
    if not isinstance(body, dict):
        return JSONResponse({"error": "body must be an object"}, status_code=400)
    coords = body.get("coords")
    if not isinstance(coords, list) or len(coords) > 20000:
        return JSONResponse({"error": "coords: list of [lat,lon], max 20000"},
                            status_code=400)
    lonlat = body.get("lonlat")
    pts = _coerce_coords(coords, None if lonlat is None else bool(lonlat))
    if len(pts) < 2:
        return JSONResponse({"error": "need >= 2 valid [lat,lon] points"},
                            status_code=400)
    # optional extras (all real provider features):
    #   depart_at: ISO-8601 -> TomTom departAt (future/planning traffic)
    #   fuel_l100 / kwh_100km: a vehicle consumption figure -> TomTom's own
    #   consumption model returns fuel_l / battery_kwh per route
    cons = None
    fl = _num(body.get("fuel_l100"))
    kw = _num(body.get("kwh_100km"))
    if fl and 0 < fl < 200:
        cons = ("combustion", fl)
    elif kw and 0 < kw < 200:
        cons = ("electric", kw)
    out, err = await _traffic(pts, str(body.get("mode") or "car"),
                              depart_at=body.get("depart_at"),
                              consumption=cons)
    if err == "budget":
        return _degraded()
    if err:
        return _failed(err)
    res = dict(out)
    res["configured"] = True
    return res


# ---------------------------------------------------------------- flow tiles
_TILE_CC = f"public, max-age=60, s-maxage={TTL_TILE}, stale-while-revalidate={TILE_SWR}"


@router.get("/flow_tile/{z}/{x}/{y}.png")
async def flow_tile(z: int, x: int, y: int, size: int = Query(256)):
    """TomTom relative0 flow raster. Not configured / over budget / upstream
    failure -> 204 (an empty tile to any map client) + X-Alive-Provider
    header; the JSON truth lives at /v2/p/status."""
    if not (0 <= z <= 22 and 0 <= x < 2 ** z and 0 <= y < 2 ** z):
        return JSONResponse({"error": "tile out of range"}, status_code=400,
                            headers={"Cache-Control": "no-store"})
    size = 512 if size == 512 else 256
    if not tomtom_key():
        return Response(status_code=204, headers={"X-Alive-Provider": "unconfigured",
                                                  "Cache-Control": "no-store"})
    ck = (z, x, y, size)
    png = _C_TILE.get(ck)
    if png is None:
        data, err = await _call(
            "GET", f"{TOMTOM_BASE}/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png",
            "tomtom", params={"key": tomtom_key(), "tileSize": size}, want="bytes",
            budget="tomtom_tile")
        if err == "budget":
            # honest "no traffic layer right now"; short CDN hold so the
            # task isn't asked again for every pan until the day rolls over
            return Response(status_code=204, headers={
                "X-Alive-Provider": "budget",
                "Cache-Control": f"public, max-age=60, s-maxage={TTL_PARTIAL}"})
        if err or not data:
            return Response(status_code=204, headers={
                "X-Alive-Provider": f"error: {err or 'empty'}",
                "Cache-Control": "no-store"})
        png = data
        _C_TILE.put(ck, png)
    return Response(content=png, media_type="image/png",
                    headers={"Cache-Control": _TILE_CC})


# ---------------------------------------------------------------- incidents
_ICON = {0: "unknown", 1: "accident", 2: "fog", 3: "dangerous conditions",
         4: "rain", 5: "ice", 6: "jam", 7: "lane closed", 8: "road closed",
         9: "road works", 10: "wind", 11: "flooding", 14: "broken down vehicle"}
_TT_FIELDS = ("{incidents{type,geometry{type,coordinates},properties{iconCategory,"
              "magnitudeOfDelay,events{description,code,iconCategory},startTime,"
              "endTime,from,to,length,delay,roadNumbers}}}")


def parse_incidents(data) -> list:
    out = []
    for f in (data or {}).get("incidents") or []:
        g = f.get("geometry") or {}
        pr = f.get("properties") or {}
        coords = g.get("coordinates") or []
        if g.get("type") == "Point":
            first = last = coords
        else:
            first = coords[0] if coords else None
            last = coords[-1] if coords else None
        p0 = _latlon(first[1], first[0]) if first and len(first) >= 2 else None
        if not p0:
            continue
        p1 = _latlon(last[1], last[0]) if last and len(last) >= 2 else None
        icon = int(pr.get("iconCategory") or 0) if _num(pr.get("iconCategory")) is not None else 0
        ev = (pr.get("events") or [{}])[0] or {}
        delay = _num(pr.get("delay"))
        out.append({
            "lat": round(p0[0], 6), "lon": round(p0[1], 6),
            "end_lat": round(p1[0], 6) if p1 else None,
            "end_lon": round(p1[1], 6) if p1 else None,
            "type": _ICON.get(icon, "other"),
            "road": ", ".join(str(r) for r in (pr.get("roadNumbers") or []) if r),
            "from": pr.get("from") or "", "to": pr.get("to") or "",
            "delay_s": int(delay) if delay is not None else None,
            "magnitude": int(pr["magnitudeOfDelay"]) if _num(pr.get("magnitudeOfDelay")) is not None else None,
            "length_m": int(_num(pr.get("length")) or 0) or None,
            "description": (ev.get("description") or "").strip(),
        })
    return out


@router.get("/incidents")
async def incidents(response: Response, bbox: str = Query(..., max_length=120)):
    if not tomtom_key():
        _cc(response, TTL_PARTIAL)
        return _unconfigured()
    _cc(response, 0)
    try:
        a = [float(v) for v in bbox.split(",")]
        if len(a) != 4 or not all(math.isfinite(v) for v in a):
            raise ValueError
    except ValueError:
        return JSONResponse({"error": "bbox=minLon,minLat,maxLon,maxLat"},
                            status_code=400, headers={"Cache-Control": "no-store"})
    min_lon, max_lon = sorted((a[0], a[2]))
    min_lat, max_lat = sorted((a[1], a[3]))
    if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180
            and -90 <= min_lat <= 90 and -90 <= max_lat <= 90):
        return JSONResponse({"error": "bbox out of range"}, status_code=400,
                            headers={"Cache-Control": "no-store"})
    mid = math.radians((min_lat + max_lat) / 2)
    area = ((max_lon - min_lon) * 111.32 * math.cos(mid)) * ((max_lat - min_lat) * 110.57)
    if area > 10000:
        return _failed("bbox too large (max 10000 km2)")
    ck = tuple(round(v, 3) for v in (min_lon, min_lat, max_lon, max_lat))
    hit = _C_INCIDENTS.get(ck)
    if hit is not None:
        _cc(response, TTL_INCIDENTS)
        return hit
    data, err = await _call(
        "GET", f"{TOMTOM_BASE}/traffic/services/5/incidentDetails", "tomtom",
        params={"key": tomtom_key(),
                "bbox": f"{min_lon:.5f},{min_lat:.5f},{max_lon:.5f},{max_lat:.5f}",
                "fields": _TT_FIELDS, "language": "en-GB",
                "timeValidityFilter": "present"},
        budget="tomtom")
    if err == "budget":
        _cc(response, TTL_PARTIAL)
        return _degraded()
    if err:
        return _failed(err)
    out = {"results": parse_incidents(data), "configured": True, "source": "tomtom"}
    _C_INCIDENTS.put(ck, out)
    _cc(response, TTL_INCIDENTS)
    return out


__all__ = ["router", "traffic_for_route", "merge_results", "plain_sub",
           "parse_tomtom_route", "parse_ola_traffic", "parse_incidents",
           "downsample", "decode_polyline", "clear_caches", "set_transport"]
