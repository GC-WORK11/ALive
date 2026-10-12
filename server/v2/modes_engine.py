"""Trip modes for POST /v2/plan + /v2/reroute (lane E, Oct 11).

`body.mode` in {"health_max", "petrol_health", "time_health"}. When the
body carries none of them, plan.py never calls into this module and the
response is byte-for-byte today's.

With a mode, every option gains:

  fuel_l           litres of petrol/diesel for THIS option, derived from
                   the option's own emissions.co2_kg.mid (the number the
                   receipt prints as "… g put out") divided by a published
                   kg-CO2-per-litre factor. CNG is sold by the kg in India,
                   so CNG rows carry fuel_l=null + fuel_kg. Electric, metro,
                   walk and cycle carry fuel_l=0 with a fuel_note saying why.
  live_eta_s       the row's eta plus the live jam delay on its road
                   (v2.providers.traffic_for_route, TomTom) — one basis
                   on every row; a provider's absolute live time only
                   when it sends no delay and its road matched ours.
                   No live reading -> live_eta_s == eta_s.
  traffic_delay_s  live delay in seconds; null = no live reading (never 0
                   standing in for "unknown").
  traffic_source   who priced that delay — the live provider's name;
                   null when no live reading exists.
  traffic_matched  true when the provider timed THIS road (its length
                   agrees with our geometry), false when the delay is a
                   nearby road's congestion priced onto this route;
                   null when no live reading exists.
  jams             provider jam list ([] when none / unavailable).
  mode_pick        exactly one True per response.
  why              <= 8 plain words.

Picks (all inside the rider's own vehicle family when it has rows,
else across every servable row):
  health_max     lowest dose.mid — no compromise.
  petrol_health  lowest fuel among rows whose dose.mid <= 1.15 x min
                 (fuel within 1 % / 0.01 L of it -> the cleaner row).
  time_health    lowest live_eta_s among rows whose dose.mid <= 1.15 x min,
                 judged on live readings when any exist (within 60 s of
                 the fastest -> the cleaner row).
dose.mid is the number the where-to sheet shows, so the row we call
"cleanest" is the row the rider sees as cleanest.
"""
import asyncio
import concurrent.futures
import inspect
import logging
import math
import re
import time
from typing import Callable, Optional

_log = logging.getLogger("v2.modes")

TRIP_MODES = ("health_max", "petrol_health", "time_health")
# generous spellings the client may send; none collides with a vehicle
# alias in plan._VEHICLE_ALIASES (legacy bodies used `mode` for vehicle)
_ALIASES = {
    "health_max": "health_max", "healthmax": "health_max",
    "health_maxer": "health_max", "health": "health_max",
    "cleanest": "health_max",
    "petrol_health": "petrol_health", "petrol": "petrol_health",
    "petrol_friendly": "petrol_health", "budget": "petrol_health",
    "budget_health": "petrol_health", "fuel_health": "petrol_health",
    "time_health": "time_health", "time": "time_health",
    "fastest": "time_health",
}
DOSE_SLACK = 1.15            # "still clean" = within +15 % of the least dose
SAME_DOSE = 0.03             # rows within 3 % dose / fuel and 60 s are
SAME_ETA_S = 60.0            # "about the same"
TRAFFIC_BUDGET_S = 6.0       # whole live-traffic fan-out, wall clock
TRAFFIC_MAX_ROUTES = 5       # distinct road geometries asked per response
TRAFFIC_MAX_PTS = 400        # coords sent per geometry (ends always kept)
JAMS_MAX = 12                # jams echoed per option (response size)

# --- fuel conversions (documented, never tuned) --------------------------
# kg CO2 emitted per litre burned (tank-to-wheel, fossil carbon):
#  petrol 2.31 — UNECE Reg. 101 / EU Reg. 2017/1151 carbon-balance
#    fuel-consumption formula for petrol, FC[L/100 km] = (0.1180/D) x
#    (0.848 HC + 0.429 CO + 0.273 CO2) with reference density D = 0.743
#    kg/L -> 1 L per 2.306 kg CO2. IPCC 2006 Guidelines Vol.2 Ch.3
#    Table 3.2.1 (motor gasoline 69,300 kg CO2/TJ) x Vol.2 Ch.1 Table 1.2
#    NCV (44.3 TJ/Gg) x 0.75 kg/L = 2.30 agrees.
#  diesel 2.68 — IPCC 2006 Guidelines: gas/diesel oil 74,100 kg CO2/TJ x
#    NCV 43.0 TJ/Gg x 0.84 kg/L = 2.68.
CO2_KG_PER_L = {"petrol": 2.31, "diesel": 2.68}
# kg CO2 per kg of CNG — IPCC 2006 Guidelines natural gas 56,100 kg CO2/TJ
# x NCV 48.0 TJ/Gg = 2.69. Reported as fuel_kg (CNG is sold by the kg).
CO2_KG_PER_KG_CNG = 2.69

# --- idle fuel while stuck in a LIVE jam (published, measured) -----------
# K. P. Tiwari, "Fuel wastage & emission due to idling of vehicles at
# road traffic signals", Int. J. of Research in Engineering and
# Technology (IJRET), Oct 2013, Table 3 — idle fuel burn measured with
# Ono Sokki flow meters on Indian vehicles: motorcycles 100/125/150/180 cc
# = 162/191/205/241 ml/h; petrol MPFI cars Maruti van 563, Esteem 740
# ml/h; diesel Tata Indica 1.0 L 590 ml/h; CNG auto-rickshaw 522 g/h.
# We use each class's mean. Applied ONLY to the live delay the engine
# did not already price (the engine's own idle model covers eta minus
# freeflow). Buses: the paper's bus row is diesel while Delhi's fleet is
# CNG — no matching figure, so no idle top-up for bus rows (said so in
# fuel_note), never a borrowed number.
IDLE_L_PER_H = {
    ("car", "petrol"): (563.0 + 740.0) / 2.0 / 1000.0,       # 0.652
    ("car", "diesel"): 590.0 / 1000.0,                        # 0.590
    ("2w", "petrol"): (162.0 + 191.0 + 205.0 + 241.0) / 4.0 / 1000.0,  # 0.200
}
IDLE_KG_PER_H = {("auto", "cng"): 522.0 / 1000.0}            # 0.522
_IDLE_GROUP = {"car": "car", "cab": "car", "bike": "2w", "scooter": "2w",
               "auto": "auto"}
FUEL_SOURCES = (
    "fuel from each route's own CO2 estimate: petrol 2.31 / diesel 2.68 kg "
    "CO2 per litre (UNECE R101 carbon balance; IPCC 2006), CNG 2.69 kg CO2 "
    "per kg (IPCC 2006); live-jam idle burn from measured Indian vehicles "
    "(Tiwari, IJRET 2013)")

_ROAD_MODES = ("car", "car_open", "bike", "auto", "bus")
_NO_ENGINE = ("walk", "cycle")
_METRO = ("metro", "metro+walk")

# private pool for a synchronous provider (never the shared default
# executor — plan.py's history with boot-warm starvation)
_TRAFFIC_EXEC = concurrent.futures.ThreadPoolExecutor(
    max_workers=TRAFFIC_MAX_ROUTES, thread_name_prefix="alive-traffic")

# tests / callers may inject a provider; None -> import lane P's
TRAFFIC_FN: Optional[Callable] = None


def trip_mode(body) -> Optional[str]:
    """The trip mode a body asks for, or None (legacy body -> legacy
    behaviour). Reads `mode`, then `trip_mode`."""
    if not isinstance(body, dict):
        return None
    for key in ("mode", "trip_mode"):
        raw = body.get(key)
        if isinstance(raw, str) and raw.strip():
            norm = re.sub(r"[^a-z]+", "_", raw.lower()).strip("_")
            if norm in _ALIASES:
                return _ALIASES[norm]
    return None


# --- fuel ---------------------------------------------------------------
def option_fuel(o: dict) -> dict:
    """{fuel_l, fuel_type, fuel_note[, fuel_kg]} from the option's own
    emissions block — the same co2_kg.mid the receipt shows. Shared modes
    (auto, cab, bus) are per passenger because that block is."""
    mode = o.get("mode")
    em = o.get("emissions") if isinstance(o.get("emissions"), dict) else {}
    vclass = em.get("class")
    fuel = em.get("fuel")
    co2 = (em.get("co2_kg") or {}).get("mid") \
        if isinstance(em.get("co2_kg"), dict) else None
    if mode in _NO_ENGINE or vclass in _NO_ENGINE:
        return {"fuel_l": 0.0, "fuel_type": None,
                "fuel_note": "no engine, no fuel"}
    if mode in _METRO or vclass == "metro":
        return {"fuel_l": 0.0, "fuel_type": "electric",
                "fuel_note": "electric train, no petrol or diesel"}
    if fuel == "electric":
        return {"fuel_l": 0.0, "fuel_type": "electric",
                "fuel_note": "electric, no petrol or diesel"}
    if not isinstance(co2, (int, float)) or not math.isfinite(co2):
        return {"fuel_l": None, "fuel_type": fuel,
                "fuel_note": "no exhaust estimate for this route"}
    shared = em.get("basis") == "per_pax_km"
    if fuel in CO2_KG_PER_L:
        out = {"fuel_l": round(co2 / CO2_KG_PER_L[fuel], 3),
               "fuel_type": fuel,
               "fuel_note": (f"your share of the {fuel}" if shared
                             else f"{fuel}, from this route's exhaust")}
        return out
    if fuel == "cng":
        return {"fuel_l": None, "fuel_type": "cng",
                "fuel_kg": round(co2 / CO2_KG_PER_KG_CNG, 3),
                "fuel_note": ("runs on CNG, sold by the kg"
                              + (" (your share)" if shared else ""))}
    # static-table fallback rows carry no fuel type: say so, never guess
    return {"fuel_l": None, "fuel_type": None,
            "fuel_note": "fuel type unknown for this estimate"}


def _idle_topup(o: dict, extra_s: float) -> None:
    """Add the published idle burn for live delay the engine didn't
    price. Mutates fuel_l / fuel_kg; records fuel_idle_l / fuel_idle_kg."""
    if extra_s <= 0:
        return
    em = o.get("emissions") if isinstance(o.get("emissions"), dict) else {}
    group = _IDLE_GROUP.get(em.get("class") or "")
    fuel = o.get("fuel_type")
    occ = em.get("occupancy") if em.get("basis") == "per_pax_km" else 1.0
    try:
        occ = float(occ or 1.0)
    except (TypeError, ValueError):
        occ = 1.0
    occ = occ if occ > 0 else 1.0
    if o.get("fuel_l") is not None and (group, fuel) in IDLE_L_PER_H:
        add = extra_s / 3600.0 * IDLE_L_PER_H[(group, fuel)] / occ
        o["fuel_l"] = round(o["fuel_l"] + add, 3)
        o["fuel_idle_l"] = round(add, 3)
    elif o.get("fuel_kg") is not None and (group, fuel) in IDLE_KG_PER_H:
        add = extra_s / 3600.0 * IDLE_KG_PER_H[(group, fuel)] / occ
        o["fuel_kg"] = round(o["fuel_kg"] + add, 3)
        o["fuel_idle_kg"] = round(add, 3)


def _fuel_amount(o: dict):
    v = o.get("fuel_l")
    if v is None:
        v = o.get("fuel_kg")
    return float(v) if isinstance(v, (int, float)) else None


# --- live traffic ---------------------------------------------------------
def _traffic_fn():
    if TRAFFIC_FN is not None:
        return TRAFFIC_FN
    try:
        from .providers import traffic_for_route   # lane P
        return traffic_for_route
    except Exception:   # ImportError until lane P lands — never fatal
        return None


def is_road(o: dict) -> bool:
    """Motor rows on a road geometry. Transit rows (they carry legs) are
    walk + ride composites — a road-traffic read doesn't apply."""
    return o.get("mode") in _ROAD_MODES and not o.get("legs")


def _geom_key(g):
    c = (g or {}).get("coordinates") if isinstance(g, dict) else None
    if not c or len(c) < 2:
        return None
    m = c[len(c) // 2]
    try:
        return (len(c), round(c[0][0], 5), round(c[0][1], 5),
                round(m[0], 5), round(m[1], 5),
                round(c[-1][0], 5), round(c[-1][1], 5))
    except Exception:
        return None


def _latlon_coords(g) -> list:
    """GeoJSON [lon,lat] -> provider [[lat,lon],…], evenly decimated to
    TRAFFIC_MAX_PTS with both ends kept."""
    c = [p for p in ((g or {}).get("coordinates") or [])
         if isinstance(p, (list, tuple)) and len(p) >= 2]
    if len(c) > TRAFFIC_MAX_PTS:
        step = (len(c) - 1) / (TRAFFIC_MAX_PTS - 1)
        c = [c[int(round(i * step))] for i in range(TRAFFIC_MAX_PTS)]
    return [[round(float(p[1]), 6), round(float(p[0]), 6)] for p in c]


async def _call(fn, coords):
    if inspect.iscoroutinefunction(fn):
        res = await fn(coords)
    else:
        res = await asyncio.get_running_loop().run_in_executor(
            _TRAFFIC_EXEC, fn, coords)
    if inspect.isawaitable(res):
        res = await res
    return res


def _usable(res) -> bool:
    if not isinstance(res, dict):
        return False
    return any(isinstance(res.get(k), (int, float)) and math.isfinite(res[k])
               for k in ("delay_s", "live_s"))


def _clean_jams(jams) -> list:
    out = []
    for j in (jams or [])[:JAMS_MAX]:
        if not isinstance(j, dict):
            continue
        out.append({k: j.get(k) for k in
                    ("lat", "lon", "end_lat", "end_lon", "from_m", "to_m",
                     "delay_s", "road", "magnitude") if k in j})
    return out


def _no_traffic(o: dict) -> None:
    o["live_eta_s"] = o.get("eta_s")
    o["traffic_delay_s"] = None
    # a no-live-reading row must not keep a source/match stamp from
    # whatever priced the delay before (plan rows can carry an Amazon
    # router delay into trip mode — the trip-mode contract for these
    # fields is strictly 'the live provider's reading')
    o["traffic_source"] = None
    o["traffic_matched"] = None
    o["jams"] = []


def _apply_traffic(o: dict, res: dict, source) -> None:
    eta = float(o.get("eta_s") or 0.0)
    ff = o.get("freeflow_s")
    # a row whose eta already carries a traffic component (Amazon rows:
    # eta > freeflow) restarts from freeflow so the jam isn't counted twice
    base = float(ff) if isinstance(ff, (int, float)) and 0 < ff < eta \
        else eta
    delay = res.get("delay_s")
    live_s = res.get("live_s")
    dist_m = float(o.get("distance_km") or 0.0) * 1000.0
    rl = res.get("length_m", res.get("distance_m"))
    matched = res.get("matched") is True or (
        isinstance(rl, (int, float)) and dist_m > 0
        and abs(float(rl) - dist_m) <= max(300.0, 0.05 * dist_m))
    # When the provider timed OUR road (its length matches ours), its
    # absolute live time IS the honest ETA for every motor vehicle on it:
    # our engine's free-flow eta assumes empty roads (ISKCON→DTU: engine
    # 42 min vs TomTom 88 min on the same 33 km; TomTom/Ola best roads
    # 65–68 min). A bus is never faster than the car on the same road.
    # Off-road rows (walk/cycle/metro) never reach here. Unmatched roads
    # keep the old basis: our eta + the provider's live delay.
    fam = str(o.get("mode") or "").lower()
    road_motor = fam in ("car", "car_open", "cab", "taxi", "bus")
    if (matched and road_motor and isinstance(live_s, (int, float))
            and math.isfinite(live_s) and live_s > 0):
        live = max(float(live_s), base) if fam == "bus" else float(live_s)
    elif isinstance(delay, (int, float)) and math.isfinite(delay):
        live = base + max(0.0, float(delay))
    else:
        _no_traffic(o)
        return
    o["live_eta_s"] = int(round(max(1.0, live)))
    o["traffic_delay_s"] = (int(round(max(0.0, float(delay))))
                            if isinstance(delay, (int, float))
                            and math.isfinite(delay)
                            else int(round(max(0.0, live - base))))
    o["jams"] = _clean_jams(res.get("jams"))
    o["traffic_source"] = source or "live"
    # whether the provider timed THIS road (matched = its length agrees
    # with our geometry) — on an unmatched read the delay is a nearby
    # road's congestion priced onto this route, and the client should
    # be able to tell
    o["traffic_matched"] = bool(matched)
    _idle_topup(o, max(0.0, live - eta))


async def live_traffic(options: list, family_of: Callable, vehicle: str,
                       budget_s: float = TRAFFIC_BUDGET_S) -> dict:
    """Ask the provider for live traffic on up to TRAFFIC_MAX_ROUTES
    distinct road geometries (the rider's own vehicle rows first), all
    in parallel under one wall-clock budget, and stamp live_eta_s /
    traffic_delay_s / jams on every row. Returns a small status block."""
    for o in options:
        _no_traffic(o)
    fn = _traffic_fn()
    if fn is None:
        return {"live": False, "note": "live traffic not connected"}
    road = [o for o in options if is_road(o)]
    # the rider's own family first, cleanest first inside it: the petrol
    # and time picks come from rows within +15 % of the least dose, so
    # those are the geometries the budget must read live
    road.sort(key=lambda o: (family_of(o.get("mode")) != vehicle,
                             _dose(o) if _dose(o) is not None
                             else float("inf")))
    groups: dict = {}
    for o in road:
        k = _geom_key(o.get("geometry"))
        if k is None:
            continue
        if k not in groups and len(groups) >= TRAFFIC_MAX_ROUTES:
            continue
        groups.setdefault(k, []).append(o)
    if not groups:
        return {"live": False, "note": "no road routes to check"}
    keys = list(groups)
    t0 = time.perf_counter()
    tasks = [asyncio.ensure_future(
        _call(fn, _latlon_coords(groups[k][0].get("geometry"))))
        for k in keys]
    done, pending = await asyncio.wait(tasks, timeout=budget_s)
    for p in pending:
        # a slow reading is NOT thrown away: it finishes in the background
        # and lands in the provider's 60 s cache, so switching modes on the
        # same road shows the SAME live time (not a free-flow fallback)
        p.add_done_callback(lambda f: f.cancelled() or f.exception())
    live_n = 0
    sources = set()
    for k, t in zip(keys, tasks):
        res = None
        if t in done and not t.cancelled() and t.exception() is None:
            res = t.result()
        elif t in done and not t.cancelled():
            _log.warning("traffic_for_route failed: %r", t.exception())
        if not _usable(res):
            continue
        src = res.get("source") or "live"
        for o in groups[k]:
            _apply_traffic(o, res, src)
        # counted live only when a row really took a reading (a bare
        # live_s on an unmatched road gives none)
        if any(o.get("traffic_delay_s") is not None for o in groups[k]):
            live_n += 1
            sources.add(str(src))
    out = {"live": live_n > 0, "routes_checked": len(keys),
           "routes_live": live_n,
           "took_ms": round((time.perf_counter() - t0) * 1000.0)}
    if sources:
        out["source"] = ", ".join(sorted(sources))
    if pending:
        out["timed_out"] = len(pending)
    if not live_n:
        out["note"] = "no live traffic reading right now"
    return out


# --- picks + why ------------------------------------------------------------
def _dose(o: dict):
    v = (o.get("dose") or {}).get("mid") if isinstance(o.get("dose"),
                                                       dict) else None
    return float(v) if isinstance(v, (int, float)) and math.isfinite(v) \
        else None


def _live(o: dict) -> float:
    v = o.get("live_eta_s")
    if not isinstance(v, (int, float)):
        v = o.get("eta_s")
    return float(v) if isinstance(v, (int, float)) else float("inf")


def _co2(o: dict) -> float:
    e = (o.get("emissions") or {}).get("co2_kg") \
        if isinstance(o.get("emissions"), dict) else None
    v = (e or {}).get("mid") if isinstance(e, dict) else None
    return float(v) if isinstance(v, (int, float)) else float("inf")


def _servable(o: dict) -> bool:
    return (o.get("reaches_destination") is not False
            and o.get("starts_at_origin") is not False
            and bool(o.get("eta_s")))


def _fuel_key_fn(cands: list) -> Callable:
    """One fuel type across candidates -> rank by its amount (litres or
    CNG kg). Mixed types (only when the rider's family has no rows) ->
    rank by the engine's CO2, which is proportional to fuel burned."""
    types = {o.get("fuel_type") for o in cands
             if _fuel_amount(o) is not None and _fuel_amount(o) > 0}
    if len(types) <= 1:
        def k(o):
            a = _fuel_amount(o)
            return a if a is not None else float("inf")
        return k
    return _co2


def _mins(sec: float) -> int:
    return int(round(abs(sec) / 60.0))


def _fuel_word(o: dict) -> str:
    t = o.get("fuel_type")
    if t == "cng":
        return "CNG"
    if t == "diesel":
        return "diesel"
    return "petrol"


def _all_same(pool: list) -> bool:
    if len(pool) < 2:
        return False
    ds = [_dose(o) for o in pool]
    if any(d is None for d in ds):
        return False
    lo, hi = min(ds), max(ds)
    if lo <= 0 or (hi - lo) / lo > SAME_DOSE:
        return False
    ts = [_live(o) for o in pool]
    if max(ts) - min(ts) > SAME_ETA_S:
        return False
    fs = [_fuel_amount(o) for o in pool]
    if all(f is not None for f in fs) and max(fs) > 0:
        if (max(fs) - min(fs)) / max(fs) > SAME_DOSE:
            return False
    return True


def _pick_why(mode: str, pick: dict, min_dose, live_known: bool) -> str:
    cleanest = (min_dose is not None and _dose(pick) is not None
                and _dose(pick) <= min_dose * 1.0001)
    if min_dose is None:
        return "no air reading on these routes"
    if mode == "health_max":
        return "cleanest air on this trip"
    if mode == "petrol_health":
        amt = _fuel_amount(pick)
        if amt is None:
            # never claim "least petrol" without a fuel number
            return ("cleanest air, fuel use not known" if cleanest
                    else "air still clean, fuel use not known")
        if amt == 0:
            return ("no petrol at all, cleanest air" if cleanest
                    else "no petrol at all, air still clean")
        w = _fuel_word(pick)
        return (f"least {w} and the cleanest air" if cleanest
                else f"least {w}, air still clean")
    # "now" only when THIS row carries a live reading
    now = ("now" if live_known and pick.get("traffic_delay_s") is not None
           else "route")
    return (f"fastest {now} and the cleanest air" if cleanest
            else f"fastest {now}, air still clean")


def _other_why(mode: str, o: dict, pick: dict, min_dose) -> str:
    d = _dose(o)
    if d is None or min_dose is None:
        air = "no air reading"
    elif d <= min_dose * 1.0001:
        air = "cleanest air"
    elif d <= min_dose * DOSE_SLACK:
        air = "air nearly as clean"
    else:
        pct = int(round((d / min_dose - 1.0) * 100.0)) if min_dose > 0 \
            else None
        air = f"{pct}% more smoke" if pct is not None else "more smoke"
    if mode == "petrol_health":
        fa, fp = _fuel_amount(o), _fuel_amount(pick)
        if (fa is not None and fp is not None and abs(fa - fp) >= 0.01
                and o.get("fuel_type") == pick.get("fuel_type")):
            unit = "kg" if o.get("fuel_type") == "cng" else "L"
            more = "more" if fa > fp else "less"
            return f"{air}, {abs(fa - fp):.2f} {unit} {more} {_fuel_word(o)}"
    if (is_road(o) and o.get("traffic_delay_s") is None
            and pick.get("traffic_delay_s") is not None):
        # a freeflow guess vs a live reading is no time comparison
        return f"{air}, no live traffic reading"
    dt = _live(o) - _live(pick)
    if not math.isfinite(dt) or _mins(dt) < 1:
        return f"{air}, about the same time"
    return f"{air}, {_mins(dt)} min {'slower' if dt > 0 else 'faster'}"


def _fuel_saved(pick: dict, pool: list) -> None:
    """Litres (CNG: kg) the petrol pick saves against the fastest row of
    the same fuel in its pool — the road a time-only app would hand
    out. Difference of two engine numbers; never money. Null when the
    comparison isn't like-for-like."""
    unit = "fuel_saved_kg" if pick.get("fuel_type") == "cng" \
        else "fuel_saved_l"
    pick[unit] = None
    pick["fuel_saved_vs"] = None
    fp = _fuel_amount(pick)
    if fp is None or fp <= 0:
        return
    same = [o for o in pool if o.get("fuel_type") == pick.get("fuel_type")
            and _fuel_amount(o) is not None]
    if not same:
        return
    fastest = min(same, key=_live)
    pick[unit] = round(max(0.0, _fuel_amount(fastest) - fp), 3)
    pick["fuel_saved_vs"] = fastest.get("route_id")


def _pool_ctx(options: list, vehicle: str, family_of: Callable) -> dict:
    """The choice set every mode judges on: the rider's own vehicle
    family when it has servable rows, else every servable row. One ctx
    shared by all three mode picks keeps the comparisons like-for-like."""
    servable = [o for o in options if _servable(o)]
    fam = [o for o in servable if family_of(o.get("mode")) == vehicle]
    pool = fam or servable or list(options)
    dosed = [o for o in pool if _dose(o) is not None]
    min_dose = min((_dose(o) for o in dosed), default=None)
    within = ([o for o in dosed if _dose(o) <= min_dose * DOSE_SLACK]
              if min_dose is not None else [])
    return {"pool": pool, "dosed": dosed, "min_dose": min_dose,
            "within": within}


def _mode_cands_key(mode: str, ctx: dict):
    """(candidates, sort key) for a mode — the contract's own filter +
    its own metric. petr/time pick only inside the 1.15x clean-air
    guard; health_max never compromises."""
    pool, dosed, within = ctx["pool"], ctx["dosed"], ctx["within"]
    if mode == "health_max":
        cands = dosed or pool
        fk = _fuel_key_fn(cands)
        key = lambda o: (_dose(o) if _dose(o) is not None else float("inf"),
                         _live(o), fk(o))
    elif mode == "petrol_health":
        cands = within or pool
        if all(_fuel_amount(o) is None for o in cands):
            # no fuel number inside the clean set: lowest known fuel anywhere
            known = [o for o in pool if _fuel_amount(o) is not None]
            cands = known or cands
        fk = _fuel_key_fn(cands)
        key = lambda o: (fk(o), _dose(o) if _dose(o) is not None
                         else float("inf"), _live(o))
    else:   # time_health
        cands = within or pool
        # "fastest now" is judged on live readings: when any candidate
        # has one, rows without one (budget ran out) can't win on a
        # freeflow guess
        read = [o for o in cands if o.get("traffic_delay_s") is not None]
        cands = read or cands
        key = lambda o: (_live(o), _dose(o) if _dose(o) is not None
                         else float("inf"))
    return cands, key


def _pick_for(mode: str, ctx: dict):
    """The would-be pick for `mode` on this pool: no stamping, no
    reorder. Returns (row, sort key, tie_slower). Row is None only for
    an empty pool."""
    cands, key = _mode_cands_key(mode, ctx)
    pick = min(cands, key=key)
    tie_slower = False
    # near-ties on the mode's own axis (petrol within 1 % / 0.01 L or kg,
    # time within a minute) go to the cleaner row — "+ Health"
    if mode == "petrol_health" and _fuel_amount(pick) is not None:
        fk0 = _fuel_key_fn(cands)
        if fk0 is not _co2:
            lim = fk0(pick) + max(0.01, 0.01 * fk0(pick))
            near = [o for o in cands if fk0(o) <= lim]
            pick = min(near, key=lambda o: (
                _dose(o) if _dose(o) is not None else float("inf"),
                fk0(o), _live(o)))
    elif mode == "time_health" and math.isfinite(_live(pick)):
        fastest = _live(pick)
        near = [o for o in cands if _live(o) <= fastest + SAME_ETA_S]
        pick = min(near, key=lambda o: (
            _dose(o) if _dose(o) is not None else float("inf"), _live(o)))
        tie_slower = _live(pick) > fastest + 0.5
    if mode == "petrol_health":
        _fuel_saved(pick, ctx["pool"])
    return pick, key, tie_slower


def _pick_brief(o) -> Optional[dict]:
    """The numbers a client needs to trade this pick off against the
    other modes': own metric + the two others, never a recomputed one."""
    if o is None:
        return None
    return {
        "route_id": o.get("route_id"), "label": o.get("label"),
        "mode": o.get("mode"), "distance_km": o.get("distance_km"),
        "dose_mid": _dose(o),
        "eta_s": o.get("eta_s"), "live_eta_s": o.get("live_eta_s"),
        "traffic_delay_s": o.get("traffic_delay_s"),
        "fuel_l": o.get("fuel_l"), "fuel_kg": o.get("fuel_kg"),
        "fuel_type": o.get("fuel_type"),
        "fuel_saved_l": o.get("fuel_saved_l"),
        "fuel_saved_kg": o.get("fuel_saved_kg"),
        "your_vehicle": o.get("your_vehicle"),
    }


def pick_and_explain(options: list, mode: str, vehicle: str,
                     family_of: Callable, live_known: bool,
                     ctx: dict = None, pick: dict = None,
                     key: Callable = None, tie_slower: bool = False,
                     picks: dict = None) -> Optional[dict]:
    """Stamp mode_pick + why on every row, move the pick first. Returns
    the picked row (None only for an empty list). `ctx`/`pick`/`key`
    come precomputed when apply() already ran the other modes' picks on
    the same pool; `picks` maps every trip mode to its would-be pick so
    a row that wins all three can say so plainly."""
    if not options:
        return None
    if ctx is None:
        ctx = _pool_ctx(options, vehicle, family_of)
    pool, min_dose = ctx["pool"], ctx["min_dose"]
    if pick is None or key is None:
        pick, key, tie_slower = _pick_for(mode, ctx)

    same = _all_same(pool)
    one_road = bool(picks) and len(pool) > 1 \
        and all(p is pick for p in picks.values())
    for o in options:
        o["mode_pick"] = o is pick
        if o is pick:
            if len(pool) == 1:
                o["why"] = "the only route for this ride"
            elif same:
                o["why"] = "all routes are about the same today"
            elif one_road:
                o["why"] = "the same road wins every way"
            elif mode == "time_health" and tie_slower:
                # a cleaner row near the pool's fastest won the tie —
                # but "fastest" has to hold against every row on screen,
                # not just the clean-window candidates (a visibly
                # quicker road below made the old claim false).
                air = ("cleanest air"
                       if _dose(o) is not None and min_dose is not None
                       and _dose(o) <= min_dose * 1.0001
                       else "cleaner air")
                fastest_all = min((_live(x) for x in options
                                   if math.isfinite(_live(x))),
                                  default=None)
                dt = (_live(o) - fastest_all) \
                    if fastest_all is not None else None
                if dt is not None and dt >= SAME_ETA_S:
                    o["why"] = (f"{_mins(dt)} min behind the "
                                f"quickest route, {air}")
                else:
                    o["why"] = f"within a minute of fastest, {air}"
            else:
                o["why"] = _pick_why(mode, o, min_dose, live_known)
        elif same and o in pool:
            o["why"] = "about the same as the top route"
        else:
            o["why"] = _other_why(mode, o, pick, min_dose)

    # order: pick, then the rest of its pool by the mode's own key, then
    # every other row in the order the doc-06 ranking left them
    rest_pool = sorted((o for o in pool if o is not pick), key=key)
    in_pool = set(id(o) for o in pool)
    others = [o for o in options if id(o) not in in_pool]
    options[:] = [pick] + rest_pool + others
    return pick


MODE_RULES = {
    "health_max": "least smoke, no compromise",
    "petrol_health": "least fuel within 15% of the least smoke",
    "time_health": "fastest now within 15% of the least smoke",
}


async def apply(options: list, mode: str, vehicle: str,
                family_of: Callable, traffic: bool = True,
                budget_s: float = TRAFFIC_BUDGET_S) -> dict:
    """Fuel -> live traffic (+ published idle burn for unpriced live
    delay) -> pick + why + order. Returns the response-level block.
    `mode_picks` carries all three modes' would-be picks from THIS same
    candidate pool so a client can trade the shown pick off against the
    other two in real numbers; `one_pick` says one road won all three."""
    for o in options:
        o.update(option_fuel(o))
    if traffic:
        try:
            tstat = await live_traffic(options, family_of, vehicle,
                                       budget_s=budget_s)
        except Exception as e:     # a provider bug never sinks the plan
            _log.warning("live traffic failed: %r", e)
            for o in options:
                _no_traffic(o)
            tstat = {"live": False, "note": "live traffic failed"}
    else:
        for o in options:
            _no_traffic(o)
        tstat = {"live": False, "note": "not checked on the quick first paint"}
    ctx = _pool_ctx(options, vehicle, family_of) if options else None
    picks = {m: _pick_for(m, ctx) for m in TRIP_MODES} if ctx else {}
    pk, key, tie = picks[mode]
    pick = pick_and_explain(
        options, mode, vehicle, family_of,
        live_known=bool(tstat.get("live")), ctx=ctx, pick=pk, key=key,
        tie_slower=tie, picks={m: p[0] for m, p in picks.items()})
    one_pick = bool(picks) and len({id(p[0]) for p in picks.values()}) == 1
    return {"mode": mode, "mode_rule": MODE_RULES[mode],
            "traffic": tstat, "fuel_basis": FUEL_SOURCES,
            "pick_route_id": (pick or {}).get("route_id"),
            "mode_picks": {m: _pick_brief(p[0]) for m, p in picks.items()},
            "one_pick": one_pick}


# --- extra candidates: OSRM alternatives ----------------------------------
async def osrm_alternatives(profile: str, flon: float, flat: float,
                            tlon: float, tlat: float,
                            max_alts: int = 2) -> list:
    """Alternative OSRM routes (beyond the first) so the modes have real
    choices when Amazon routing isn't keyed. Same backends + caps as
    deps.osrm_route; [] on any failure — never a synthetic route."""
    from . import deps
    try:
        from airfield import in_service_area, MAX_ROUTE_KM
        if not (in_service_area(flat, flon) and in_service_area(tlat, tlon)):
            return []
    except Exception:
        MAX_ROUTE_KM = 80.0
    import upstreams
    bases = []
    try:
        import routing_local as _rl
        bases.append((_rl._default._url_for(profile), "osrm-local"))
    except Exception:
        pass
    bases.append((upstreams.OSRM_PUBLIC, "osrm-public-demo"))
    for base, source in dict.fromkeys(bases):
        url = f"{base}/route/v1/{profile}/{flon},{flat};{tlon},{tlat}"
        try:
            r = await deps.http().get(url, params={
                "overview": "full", "geometries": "geojson",
                "alternatives": str(max_alts + 1), "steps": "true",
            }, timeout=3.0)
            r.raise_for_status()
            routes = r.json().get("routes", []) or []
        except Exception:
            continue
        out = []
        for rt in routes[1:max_alts + 1]:
            try:
                if float(rt.get("distance") or 0.0) / 1000.0 > MAX_ROUTE_KM:
                    continue
                rt["steps"] = deps.osrm_steps(rt)
                rt["source"] = source
                out.append(rt)
            except Exception:
                continue
        return out
    return []
