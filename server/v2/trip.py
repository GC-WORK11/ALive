"""POST /v2/trip — donate an anonymized traversal (docs/plan/07 §3).

The privacy pipeline is enforced server-side, exactly as documented —
the client is assumed hostile/buggy:

  1. drop the first and last 300 m of the trajectory (endpoint hiding)
  2. thin to ~100 m spacing
  3. round coordinates to 4 decimals (~11 m)
  4. convert to H3 res-8 cells IMMEDIATELY (fall back to 4-decimal
     lat/lon cell keys when h3 isn't installed — same granularity idea)
  5. discard the raw payload — it is never stored, never logged

Only aggregates persist (store.TripAggregates — day counters + per-cell
counts/dose/tokens). The device token is an opaque string: hashed
before it touches the store and used only for the k>=3 distinct-device
threshold on corridors.
"""
import hashlib
import json
import math
import re
import threading
import time
import unicodedata

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from .store import LEDGER, TRIPS

router = APIRouter()

# community.observe folds the SAME privacy-trimmed points into ~500 m
# corridor cells — the citizen sensor layer that sharpens the kriged
# field. Only `kept` ever crosses the boundary: already trimmed of its
# endpoints, thinned, and rounded, so observe() stores nothing the
# privacy pipeline didn't already allow.

TRIM_M = 300.0          # drop this much from BOTH ends, always
THIN_M = 100.0          # keep at most one point per this distance
ROUND_DP = 4            # ~11 m — the documented precision ceiling
MAX_POINTS = 5000       # payload abuse guard

# Idempotency: a retried donation (network flake, offline queue replay)
# carries an identical trajectory — re-recording it would mint a trip
# that never happened in the totals. Signature = token hash + endpoint
# cells + distance + duration; a hit inside the window replays stored
# without double-counting. Per-worker memory is enough — the window is
# short and the privacy contract already caps corridor inflation at one
# device.
_DEDUPE: dict = {}
_DEDUPE_TTL_S = 24 * 3600
_DEDUPE_MAX = 4096


def _dupe_key(token_hash: str, cells: list, summary: dict) -> str:
    sig = "|".join([
        token_hash,
        str(cells[0]) if cells else "",
        str(cells[-1]) if cells else "",
        str(summary.get("distance_km") or ""),
        str(summary.get("duration_s") or ""),
    ])
    return hashlib.sha256(sig.encode()).hexdigest()[:24]


def _seen_dupe(key: str) -> bool:
    now = time.time()
    # expire cheaply on access; a full sweep only at the cap
    if len(_DEDUPE) >= _DEDUPE_MAX:
        for k, t in list(_DEDUPE.items()):
            if now - t > _DEDUPE_TTL_S:
                _DEDUPE.pop(k, None)
        if len(_DEDUPE) >= _DEDUPE_MAX:
            # evict the oldest slice — never clear(): a flood of fresh
            # keys must not wipe every live dedupe window and let a
            # replay double-count (hostile-read §7)
            for k, _t in sorted(_DEDUPE.items(),
                                key=lambda kv: kv[1])[:_DEDUPE_MAX // 8]:
                _DEDUPE.pop(k, None)
    if key in _DEDUPE and now - _DEDUPE[key] <= _DEDUPE_TTL_S:
        return True
    _DEDUPE[key] = now
    return False

# --- sanity bounds: the client is assumed hostile/buggy --------------------
# These don't need to be tight — they only have to kill payloads that can
# never be a real Delhi trip (e.g. distance_km=1e12 injected into the
# donations totals). Generous caps so an honest odd trip still counts.
_BOUNDS = {
    "distance_km": (0.0, 300.0),     # Delhi is ~50 km across; 300 is generous
    "duration_s": (0.0, 21600.0),    # 6 h of riding
    "dose_ug": (0.0, 50_000.0),      # worst-day × worst-ventilation orders below
    "co2_kg_mid": (0.0, 200.0),      # 300 km × heaviest fleet factor
    "pm25_g_mid": (0.0, 50.0),
    # optional phase split from the receipt's emissions.breakdown —
    # grams, mid estimates only; absent on old app builds / zero-emission
    # modes, and never fabricated server-side
    "co2_moving_g": (0.0, 300_000.0),
    "co2_idle_g": (0.0, 300_000.0),
    "co2_cold_g": (0.0, 300_000.0),
    # savings-vs-fastest fields the app computes off its own plan
    # receipt (router-dose minus taken-dose; co2 only counts when the
    # receipt was PUC-calibrated — flagged by puc_calibrated). Absent on
    # every donation that can't honestly know; never invented here.
    "avoided_ug": (0.0, 50_000.0),
    "co2_avoided_kg": (0.0, 200.0),
}
CO2_SPLIT_KEYS = ("co2_moving_g", "co2_idle_g", "co2_cold_g")

# --- plausibility floor (app-stress N2) --------------------------------------
# A donation must describe a traversal that could have happened. The
# hostile drive's phantom-arrival bug proved a 0 km / 37 s "trip" can
# reach ingest; the collective totals (trips, modes, dose, km) count
# whatever lands. Two honest floors, both still generous:
#   * MIN_TRIP_KM — under this it is a cancelled nav or GNSS noise,
#     real telemetry but never a traversal (and its trajectory would
#     trim to zero corridor cells anyway). A cancelled-nav donation
#     still POSTs from a real device — that is decided here as not a
#     trip: the collective counts traversals, and the app keeps its own
#     ledger copy regardless.
#   * MAX_SPEED_KMH — implied average speed past every Delhi mode's
#     physical ceiling is a bug or an injection. No lower bound:
#     Delhi jams really do park a "trip" for hours, and its in-traffic
#     dose is honest data.
# duration_s stays optional (older clients may not send it) — the
# check only runs when both numbers are present.
MIN_TRIP_KM = 0.1       # 100 m — nobody navigates less
MAX_SPEED_KMH = 140.0   # airport-express peak ≈120; nothing real tops it
# Implied-concentration ceiling (judge-attack + server-audit fix): the
# corridor layer inverts dose → ambient C = dose/(VE·dur·microenv) and
# only accepts <=900 µg/m³ as a measurement (community._fold's gate —
# above it a traversal is refused as a field sample anyway). A donation
# claiming worse than that ceiling is not a real traversal, so it is
# refused at the door instead of letting its dose land in the totals.
MAX_IMPLIED_PM25 = 900.0
# A mode is a vehicle-class token — word characters, spaces and '+'.
# Anything carrying markup or punctuation can never reach mode_share.
# '+' is in the class because the planner itself emits multimodal modes
# ("metro+walk" in plan.py) — the server's own vocabulary must not be
# dropped on the way back in.
_MODE_RE = re.compile(r"^[a-z][a-z0-9_\- +]{0,23}$")

try:
    import h3 as _h3
    _CELL_KIND = "h3:8"

    def _cell(lat: float, lon: float) -> str:
        return _h3.latlng_to_cell(lat, lon, 8)

except Exception:  # degrade: same privacy, coarser key
    _CELL_KIND = "grid:4dp"

    def _cell(lat: float, lon: float) -> str:
        return f"ll:{lat:.{ROUND_DP}f},{lon:.{ROUND_DP}f}"


def _hav_m(a_lat, a_lon, b_lat, b_lon) -> float:
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6371000.0 * math.asin(math.sqrt(h))


def _parse(traj) -> list:
    """[{lat,lon} | [lon,lat] GeoJSON order] → [(lat, lon), ...].

    Points outside valid geo ranges are dropped — a garbage coordinate
    (lat=999 wraps onto a South-Atlantic h3 cell) must never land in the
    aggregates as a real traversal."""
    pts = []
    for p in traj or []:
        try:
            if isinstance(p, dict):
                la, lo = float(p["lat"]), float(p["lon"])
            elif isinstance(p, (list, tuple)) and len(p) >= 2:
                la, lo = float(p[1]), float(p[0])
            else:
                continue
        except (KeyError, TypeError, ValueError):
            continue
        if not (math.isfinite(la) and math.isfinite(lo)
                and -90.0 <= la <= 90.0 and -180.0 <= lo <= 180.0):
            continue
        pts.append((la, lo))
    return pts[:MAX_POINTS]


def privacy_pipeline(traj) -> tuple:
    """trajectory → (kept [(lat,lon) rounded], trim_start_m, trim_end_m).

    Mirrors the documented client behavior so the server is safe even
    when the client forgets: endpoints trimmed by distance along the
    path, middle thinned to ~100 m, rounded to 4 dp.
    """
    pts = _parse(traj)
    if len(pts) < 2:
        return [], 0.0, 0.0
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + _hav_m(*pts[i - 1], *pts[i]))
    total = cum[-1]
    mid = [p for p, c in zip(pts, cum) if TRIM_M <= c <= total - TRIM_M]
    trim_start = min((c for c in cum if c >= TRIM_M), default=total)
    trim_end = total - max((c for c in cum if c <= total - TRIM_M),
                           default=0.0)

    kept, last = [], None
    for p in mid:
        if last is None or _hav_m(last[0], last[1], p[0], p[1]) >= THIN_M:
            kept.append((round(p[0], ROUND_DP), round(p[1], ROUND_DP)))
            last = p
    return kept, trim_start, trim_end


_SUMMARY_NUM = ("distance_km", "duration_s", "dose_ug",
                "co2_kg_mid", "pm25_g_mid") + CO2_SPLIT_KEYS + (
                "avoided_ug", "co2_avoided_kg")
_SUMMARY_FIELDS = _SUMMARY_NUM + ("mode", "switched", "puc_calibrated")


def _num(v) -> float | None:
    """Coerce a summary number; anything unparseable/non-finite is
    dropped — the store sums floats, and a hostile payload must never
    detonate a 500."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if math.isfinite(f) else None


@router.post("/trip")
async def post_trip(body: dict):
    token = str(body.get("device_token") or "")[:64]
    summary_in = body.get("summary") if isinstance(body.get("summary"), dict) else {}
    traj = body.get("trajectory") or body.get("coords")
    if not isinstance(traj, (list, tuple)):
        traj = []

    kept, trim_a, trim_b = privacy_pipeline(traj)
    # step 4: raw coordinates become cell keys here and are gone
    cells = [_cell(la, lo) for la, lo in kept]
    # the token is hashed before it can ever touch a store or a log
    token_hash = hashlib.sha256(token.encode()).hexdigest()[:16] \
        if token else ""

    summary = {}
    for k in _SUMMARY_NUM:
        v = _num(summary_in.get(k))
        lo, hi = _BOUNDS[k]
        if v is not None and lo <= v <= hi:
            summary[k] = v
    if summary_in.get("mode") is not None:
        m = str(summary_in["mode"]).strip().lower()
        if _MODE_RE.match(m):
            summary["mode"] = m
    if summary_in.get("switched"):
        summary["switched"] = bool(summary_in["switched"])
    if summary_in.get("puc_calibrated"):
        summary["puc_calibrated"] = bool(summary_in["puc_calibrated"])
    if not summary.get("distance_km"):
        # the one number every real trip carries — without it the payload
        # either failed every sanity check or was never a trip at all;
        # storing it would only mint a zero-km count that bumps the totals
        raise HTTPException(422, "missing or implausible distance_km")
    dist = summary["distance_km"]
    if dist < MIN_TRIP_KM:
        raise HTTPException(422, "implausibly short trip")
    dur = summary.get("duration_s")
    if dur is not None and not (dur > 0.0
                              and dist / (dur / 3600.0) <= MAX_SPEED_KMH):
        raise HTTPException(422, "implausible duration_s for distance_km")
    # Geographic admission bound (judge-attack + server-audit: donations
    # minted corridor cells for any in-range lat/lon on Earth). Every
    # `kept` point becomes a corridor cell, so the smallest honest bound
    # checks the whole kept set — endpoints AND the middle — against the
    # same in_service_area the dose endpoints use (NCR bbox + ~220 km
    # margin, airfield.SERVICE_MARGIN_DEG). A traversal past that box is
    # not Delhi data: the field cannot dose it, so it cannot donate it.
    # `kept` empty → no cells can be minted → nothing to bound (the
    # summary-only donation path stays as it was).
    if kept:
        from airfield import in_service_area, OUT_OF_AREA
        if not all(in_service_area(la, lo) for la, lo in kept):
            raise HTTPException(422, OUT_OF_AREA)
    # Implied-concentration bound: invert dose/(VE·dur·microenv) exactly
    # like community._fold does and refuse anything above the corridor
    # layer's own measurement ceiling — a 50k-µg claim on a short ride
    # would otherwise land in dose totals while never being a
    # measurable sample. duration_s absent → the most donor-favorable
    # duration (the 6 h cap): anything still absurd then is impossible
    # no matter the true ride time.
    dose = summary.get("dose_ug")
    if dose:
        from exposure import MICROENV, VENTILATION_LPM
        mode = summary.get("mode") or ""
        ve = VENTILATION_LPM.get(mode, 10.0) / 1000.0
        me = MICROENV.get(mode, 1.0)
        dur_min = (dur if dur is not None
                   else _BOUNDS["duration_s"][1]) / 60.0
        if dose / (ve * dur_min * me) > MAX_IMPLIED_PM25:
            raise HTTPException(422, "implausible dose_ug for duration_s")
    dupe = _seen_dupe(_dupe_key(token_hash, cells, summary))
    # endpoint areas for the admin global layer — the trimmed first/last
    # kept point snapped to its district/sub-district NAME (a string,
    # never a coordinate — the cell keys already carry the spatial
    # precision, the area just buckets them). None when the point lands
    # outside every baked boundary; the global layer skips those.
    origin_area = dest_area = None
    if kept:
        try:
            import districts as _dist
            o = _dist.area_for_point(kept[0][1], kept[0][0])
            e = _dist.area_for_point(kept[-1][1], kept[-1][0])
            origin_area = (o or {}).get("name")
            dest_area = (e or {}).get("name")
        except Exception:  # noqa: BLE001 — area rollup is cosmetic
            origin_area = dest_area = None
    if not dupe:
        TRIPS.record_trip(cells, summary, token_hash,
                          origin_area=origin_area, dest_area=dest_area)
        LEDGER.record(token_hash, summary)
    # feed the citizen layer — every donated trip is a sensor pass. The
    # coordinates that reach observe() are the trimmed/thinned/rounded
    # `kept` points (raw trajectory already gone); observe() folds them
    # straight into cells and never persists points. Without this hop a
    # trip counted in aggregates but never informed the field. A replay
    # must not mint phantom observations either — the dedupe guard holds.
    if kept and not dupe:
        try:
            import community
            community.observe(
                vehicle=str(summary.get("mode") or "unknown"),
                coords=[[lo, la] for la, lo in kept],
                duration_s=float(summary.get("duration_s") or 0.0),
                dose_ug=summary.get("dose_ug"),
                avoided_ug=summary.get("avoided_ug"),
                contributor=token or None,
                co2_kg=summary.get("co2_kg_mid"),
                # `kept` already ran privacy_pipeline above — telling
                # observe() that stops it re-trimming another 300 m off
                # the donated traversal's ends
                privacy_trimmed=True,
            )
        except Exception as e:  # noqa: BLE001 — aggregates already
            # stored; a citizen-layer hiccup must not fail a donation.
            # It must not pass silently either — record it where
            # the ops console and the debug surface can read it.
            try:
                import community
                community._record_error(e)
            except Exception:
                pass
    return {
        "stored": True,
        "deduplicated": bool(dupe),
        "ledger_recorded": bool(token_hash),
        "cells_traversed": len(set(cells)),
        "points_used": len(kept),
        "privacy": {
            "endpoint_trim_m": TRIM_M,
            "thin_m": THIN_M,
            "rounded_decimals": ROUND_DP,
            "cell_scheme": _CELL_KIND,
            "trimmed_start_m": round(trim_a),
            "trimmed_end_m": round(trim_b),
            "raw_trajectory": "discarded — only cell aggregates stored",
        },
        "ts": time.time(),
    }


# --- POST /v2/tally — anonymous usage counters (oct11 admin) -----------------
# What the operator console counts without anyone sharing a trip: app
# opens, journeys started/ended, the mode + vehicle picked, and the
# receipt's own dose numbers. The contract is a WHITELIST — an event is
# one of three kinds, each with a closed set of props; everything else
# (and above all any lat/lon/coords/address field) is dropped before the
# store is touched, and the response says how many fields were dropped.
#
#   body: {"anon": "<16-64 [A-Za-z0-9_-]>",
#          "events": [{"event": "app_open"|"journey_start"|"journey_end"
#                               |"profile",
#                      "ts": <ms epoch, optional>, "props": {...}}]}
#   journey_start props: mode, vehicle
#   journey_end   props: completed (bool), mode, vehicle, dose_ug,
#                        dose_saved_ug, km, minutes — dose_ug counts only
#                        when it is a measured (> 0) number, and
#                        dose_saved_ug only beside it: a trip without a
#                        GPS fix reports nothing rather than a fake 0
#   profile       props: age_band (under13|13-17|18-29|30-44|45-59|60plus,
#                        the app's labels "Under 13".."60+" normalised),
#                        area (a short locality/district name the user
#                        chose to give — house numbers, coordinates,
#                        links and anything past 48 chars never survive)
#
# The anon id is a random per-install string minted by telemetry.js; it is
# hashed (namespaced, so it can never collide with the trip-token hash)
# before it reaches a store, and only ever lands in per-day distinct sets.

USAGE_EVENTS = ("app_open", "journey_start", "journey_end", "profile")
USAGE_MODES = ("health_max", "petrol_health", "time_health")
AGE_BANDS = ("under13", "13-17", "18-29", "30-44", "45-59", "60plus")
_AGE_ALIASES = {b: b for b in AGE_BANDS}
_AGE_ALIASES["60+"] = "60plus"
AREA_MAX = 48
# a number survives in an area name only as the sector/phase/block number
# right after one of these words ("Sector 62", "DLF Phase 3"); every other
# digit-bearing token (C-543, 12/3, 110092, 28.68…) is a house number, a
# PIN or a coordinate and is dropped
_AREA_NUM_OK = frozenset((
    "sector", "sec", "phase", "ph", "stage", "block", "pocket", "zone",
    "part", "extension", "ext"))
_AREA_HOUSE = frozenset(("h.no", "h.no.", "hno", "h/no", "house", "flat",
                         "tower", "floor", "plot", "khasra", "no", "no.",
                         "#"))
_AREA_KEEP = frozenset(".-'&()")


def norm_age_band(v):
    """'Under 13' / '13–17' / '60+' / 'under13' … → the canonical band, or
    None. Dashes of any kind and spaces fold; nothing else is guessed."""
    if not isinstance(v, str):
        return None
    s = re.sub(r"[\u2010-\u2015\u2212]", "-", v.strip().lower())
    return _AGE_ALIASES.get(re.sub(r"\s+", "", s))


def norm_area(v):
    """Free text → a short locality key (lowercase, single spaces), or None.

    Strict: links/emails are refused outright; tokens carrying a digit go
    unless they are a bare sector/phase number; characters outside letters
    and a few joiners become spaces; ≥ 2 letters must remain. A coordinate
    pair therefore normalises to nothing and is dropped."""
    if not isinstance(v, str):
        return None
    s = unicodedata.normalize("NFKC", v[:200])
    if re.search(r"@|https?:|www\.", s, re.I):
        return None
    s = _AREA_PREFIX_RE.sub(" ", s.lower())
    kept = []
    for t in re.split(r"[\s,;|/\\:]+", s):
        t = t.strip()
        if not t:
            continue
        if any(ch.isdigit() for ch in t):
            if (t.isdigit() and len(t) <= 3 and kept
                    and kept[-1] in _AREA_NUM_OK):
                kept.append(t)
            continue
        if t in _AREA_HOUSE:
            continue
        t = "".join(ch if (_letter(ch) or ch in _AREA_KEEP) else " "
                    for ch in t)
        for w in t.split():
            w = w.strip(".-'&()")
            if w and w not in _AREA_HOUSE:
                kept.append(w)
    out = ""
    for w in kept:
        nxt = (out + " " + w).strip()
        if len(nxt) > AREA_MAX:
            break
        out = nxt
    if sum(1 for ch in out if ch.isalpha()) < 2:
        return None
    return out


def _letter(ch: str) -> bool:
    # letters AND combining marks — a Devanagari matra is category M, and
    # dropping it would mangle a Hindi locality name
    return unicodedata.category(ch)[0] in ("L", "M")


# "H.No. 12", "h/no", "House No", "Flat no" … go before tokenising so the
# prefix can't leave a stray letter behind
_AREA_PREFIX_RE = re.compile(
    r"\b(?:h\s*[./]?\s*no|house\s*no|flat\s*no|plot\s*no|khasra\s*no)\b\.?")


_USAGE_VEH = {
    "car": "car", "driving_car": "car", "driving_car_ac": "car",
    "driving_car_open": "car", "ev": "car",
    "cab": "cab", "taxi": "cab",
    "erick": "erick", "e_rickshaw": "erick", "e-rickshaw": "erick",
    "bike": "bike", "two_wheeler": "bike", "driving_two_wheeler": "bike",
    "scooter": "bike", "motorbike": "bike",
    "auto": "auto", "rickshaw": "auto", "auto_rickshaw": "auto",
    "bus": "bus", "metro": "metro", "metro+walk": "metro",
    "cycle": "cycle", "cycling": "cycle", "bicycle": "cycle",
    "walk": "walk", "walking": "walk", "pedestrian": "walk", "foot": "walk",
}
_USAGE_BOUNDS = {
    "dose_ug": (0.0, 50_000.0),          # same ceiling as /v2/trip
    "dose_saved_ug": (-50_000.0, 50_000.0),   # a pick can be dirtier
    "km": (0.0, 300.0),
    "minutes": (0.0, 360.0),
}
_ANON_RE = re.compile(r"^[A-Za-z0-9_-]{16,64}$")
USAGE_MAX_BODY = 16 * 1024
USAGE_MAX_EVENTS = 25          # per POST — the client batches ≤ 20
USAGE_RATE_PER_HOUR = 120      # events per anon id per rolling hour
_USAGE_RL: dict = {}           # anon_hash -> [window_start, count]
_USAGE_OPENS: dict = {}        # anon_hash -> IST day of last counted open
# anon_hash -> (IST day, age_band, area, {what the store counted}) — the
# last profile this worker counted, so a same-day repeat is a no-op and a
# same-day correction replaces instead of double-counting
_USAGE_PROFILES: dict = {}
_USAGE_LOCK = threading.Lock()
_USAGE_RL_MAX = 50_000


def _usage_store():
    try:
        import agg_ddb
    except ImportError:  # package-mode import from the repo root
        from server import agg_ddb  # type: ignore
    return agg_ddb


def usage_anon_hash(anon: str) -> str:
    return hashlib.sha256(
        ("alive-usage-v1:" + anon).encode()).hexdigest()[:16]


def _clean_usage_props(kind: str, props) -> tuple:
    """(clean props, n dropped fields). Whitelist only — a location key
    is not special-cased because nothing outside the list survives."""
    props = props if isinstance(props, dict) else {}
    out, dropped = {}, 0
    allowed = {"journey_start": ("mode", "vehicle"),
               "journey_end": ("completed", "mode", "vehicle", "dose_ug",
                               "dose_saved_ug", "km", "minutes"),
               "profile": ("age_band", "area"),
               }.get(kind, ())
    for k, v in props.items():
        if k not in allowed:
            dropped += 1
            continue
        if v is None:
            continue            # not provided — never a stored 0
        if k == "age_band":
            b = norm_age_band(v)
            if b:
                out["age_band"] = b
            else:
                dropped += 1
        elif k == "area":
            a = norm_area(v)
            if a:
                out["area"] = a
            else:
                dropped += 1
        elif k == "mode":
            m = str(v or "").strip().lower()
            if m in USAGE_MODES:
                out["mode"] = m
            else:
                dropped += 1
        elif k == "vehicle":
            veh = str(v or "").strip().lower()[:32]
            if veh:
                out["vehicle"] = _USAGE_VEH.get(veh, "other")
        elif k == "completed":
            out["completed"] = v is True
        else:
            f = _num(v)
            lo, hi = _USAGE_BOUNDS[k]
            if f is not None and lo <= f <= hi:
                out[k] = round(f, 2)
            else:
                dropped += 1
    if kind == "journey_end":
        # null-safe intake: a journey with no GPS fix measured nothing, and
        # its 0 dose (or a "saving" against that 0) must not drag the
        # console's averages — a dose counts only when it is a measured,
        # positive number, a saving only beside such a dose
        if not (out.get("dose_ug") or 0) > 0:
            out.pop("dose_ug", None)
            out.pop("dose_saved_ug", None)
    return out, dropped


def _profile_prev(anon_hash: str, day: str, props: dict):
    """None → this exact profile was already counted for this device
    today (a repeat). Otherwise the dict of what it replaces on the same
    IST day ({} when nothing) — the store moves the device out of those
    sets, so a corrected answer counts once, not twice."""
    key = (props.get("age_band"), props.get("area"))
    with _USAGE_LOCK:
        last = _USAGE_PROFILES.get(anon_hash)
        if last and last[0] == day and (last[1], last[2]) == key:
            return None
        if last and last[0] == day:
            return dict(last[3])
        return {}


def _profile_seen(anon_hash: str, day: str, props: dict, counted: dict):
    with _USAGE_LOCK:
        if len(_USAGE_PROFILES) > _USAGE_RL_MAX:
            _USAGE_PROFILES.clear()   # bounded memory beats perfect dedupe
        _USAGE_PROFILES[anon_hash] = (day, props.get("age_band"),
                                      props.get("area"), dict(counted or {}))


def _usage_rate_ok(anon_hash: str, n: int, now: float) -> int:
    """How many of n events this anon id may still log this hour."""
    with _USAGE_LOCK:
        if len(_USAGE_RL) > _USAGE_RL_MAX:
            for k, (t0, _c) in list(_USAGE_RL.items()):
                if now - t0 > 3600:
                    _USAGE_RL.pop(k, None)
            if len(_USAGE_RL) > _USAGE_RL_MAX:
                _USAGE_RL.clear()   # bounded memory beats a perfect limit
        w = _USAGE_RL.get(anon_hash)
        if w is None or now - w[0] > 3600:
            w = [now, 0]
            _USAGE_RL[anon_hash] = w
        room = max(0, USAGE_RATE_PER_HOUR - w[1])
        take = min(room, n)
        w[1] += take
        return take


def _first_open_today(anon_hash: str, day: str) -> bool:
    with _USAGE_LOCK:
        if _USAGE_OPENS.get(anon_hash) == day:
            return False
        if len(_USAGE_OPENS) > _USAGE_RL_MAX:
            _USAGE_OPENS.clear()
        _USAGE_OPENS[anon_hash] = day
        return True


@router.post("/tally")
async def post_tally(request: Request):
    raw = await request.body()
    if len(raw) > USAGE_MAX_BODY:
        raise HTTPException(413, "usage batch too large")
    try:
        body = json.loads(raw.decode("utf-8") or "null")
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(422, "body must be JSON")
    if not isinstance(body, dict):
        raise HTTPException(422, "body must be a JSON object")
    anon = body.get("anon")
    if not isinstance(anon, str) or not _ANON_RE.match(anon):
        raise HTTPException(422, "anon must be 16-64 chars of [A-Za-z0-9_-]")
    events = body.get("events")
    if not isinstance(events, list) or not events:
        raise HTTPException(422, "events must be a non-empty list")
    if len(events) > USAGE_MAX_EVENTS:
        raise HTTPException(422, f"at most {USAGE_MAX_EVENTS} events per batch")
    dropped_fields = sum(1 for k in body if k not in ("anon", "events"))
    anon_hash = usage_anon_hash(anon)
    now = time.time()
    agg = _usage_store()
    store = agg.usage_store()
    clean = []
    rejected = 0
    for ev in events:
        if not isinstance(ev, dict) or ev.get("event") not in USAGE_EVENTS:
            rejected += 1
            continue
        kind = ev["event"]
        dropped_fields += sum(1 for k in ev
                              if k not in ("event", "ts", "props",
                                           "internal"))
        # the browser's own test mark (telemetry.js ?internal=1): the
        # event counts, but under the store's internal scope — never
        # mixed into the console's real-traffic numbers
        internal = ev.get("internal") is True
        props, d = _clean_usage_props(kind, ev.get("props"))
        dropped_fields += d
        # client clock only within a sane window — an offline queue may
        # flush late, a wrong clock must not land in a future/ancient day
        ts = now
        t = _num(ev.get("ts"))
        if t is not None:
            t = t / 1000.0 if t > 1e11 else t
            if now - 3 * 86400 <= t <= now + 300:
                ts = t
        clean.append((kind, props, ts, internal))
    allowed = _usage_rate_ok(anon_hash, len(clean), now)
    limited = len(clean) - allowed
    accepted = duplicates = 0
    try:
        for kind, props, ts, internal in clean[:allowed]:
            if kind == "app_open" and not _first_open_today(
                    anon_hash, agg.ist_day(ts)):
                duplicates += 1     # ≤ 1 open per device per IST day
                continue
            if kind == "profile":
                if not props:       # nothing valid survived — not counted
                    rejected += 1
                    continue
                day = agg.ist_day(ts)
                prev = _profile_prev(anon_hash, day, props)
                if prev is None:
                    duplicates += 1     # ≤ 1 profile per device per day
                    continue
                counted = store.record(kind, props, anon_hash, ts,
                                       prev=prev, internal=internal)
                _profile_seen(anon_hash, day, props, counted)
                accepted += 1
                continue
            store.record(kind, props, anon_hash, ts, internal=internal)
            accepted += 1
    except Exception:  # noqa: BLE001 - store down: tell the client to keep it
        return JSONResponse(status_code=503, content={
            "stored": False, "accepted": accepted,
            "error": "usage store unavailable — keep the batch"})
    return {"stored": True, "accepted": accepted, "rejected": rejected,
            "duplicates": duplicates, "rate_limited": limited,
            "dropped_fields": dropped_fields,
            "privacy": "counts only — no location field is ever stored",
            "ts": now}
