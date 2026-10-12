"""Trip modes (lane E, Oct 11): health_max / petrol_health / time_health.

Contract (docs/lanes/MASTER-PLAN-oct11.md "Modes contract"): with a
`mode` every option gains fuel_l, live_eta_s, traffic_delay_s, jams,
mode_pick (exactly one), why (<= 8 words); no `mode` -> today's body.

Offline: deps.osrm_route, modes_engine.osrm_alternatives and the live
traffic provider (traffic_for_route via modes_engine.TRAFFIC_FN) are
all fakes. The engine arm is disabled so the option set is the router
rows alone (deterministic, fast).
"""
import asyncio
import os
import sys
import time

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.pop("ALIVE_LOCATION_KEY", None)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from airfield import FIELD  # noqa: E402
from v2 import deps, store  # noqa: E402
from v2 import plan as v2plan  # noqa: E402
from v2 import modes_engine as me  # noqa: E402
import transit  # noqa: E402
import transit_v2  # noqa: E402

client = TestClient(main.app)

FROM = {"lat": 28.6139, "lon": 77.2090}
TO = {"lat": 28.6450, "lon": 77.1990}
MAIN = {"type": "LineString", "coordinates": [
    [77.2090, 28.6139], [77.2150, 28.6300], [77.1990, 28.6450]]}
ALT1 = {"type": "LineString", "coordinates": [
    [77.2090, 28.6139], [77.2250, 28.6250], [77.1990, 28.6450]]}
ALT2 = {"type": "LineString", "coordinates": [
    [77.2090, 28.6139], [77.1950, 28.6280], [77.1990, 28.6450]]}
# live delay per road, keyed by the geometry's middle vertex latitude
DELAY_BY_MID = {28.63: 600.0, 28.625: 30.0, 28.628: 60.0}
CALLS: list = []


def _route(geom, dist_m, dur_s):
    rt = {"distance": dist_m, "duration": dur_s, "geometry": geom}
    rt["steps"] = deps.osrm_steps(rt)
    rt["source"] = "osrm-test"
    return rt


async def fake_osrm(profile, flon, flat, tlon, tlat):
    return _route(MAIN, 6200.0, 780.0)


async def fake_alts(profile, flon, flat, tlon, tlat, max_alts=2):
    return [_route(ALT1, 7000.0, 820.0), _route(ALT2, 6900.0, 900.0)]


def _mid_lat(coords):
    return round(coords[len(coords) // 2][0], 3)


async def fake_traffic(coords):
    """traffic_for_route(coords: [[lat, lon], ...]) -> dict | None."""
    CALLS.append(coords)
    d = DELAY_BY_MID.get(_mid_lat(coords))
    if d is None:
        return None
    return {"live_s": None, "freeflow_s": None, "delay_s": d,
            "jams": [{"lat": coords[1][0], "lon": coords[1][1],
                      "from_m": 100.0, "to_m": 900.0, "delay_s": d,
                      "road": "Test Marg", "magnitude": 3}],
            "source": "test-traffic"}


async def _noop():
    return None


class DisabledLoc:
    enabled = False


@pytest.fixture(autouse=True)
def wired(monkeypatch):
    deps.set_location(DisabledLoc())
    FIELD._samples = [
        (28.6139, 77.2090, "test-a", {"pm2_5": 150.0}),
        (28.6450, 77.1990, None, {"pm2_5": 185.0}),
        (28.6250, 77.2250, None, {"pm2_5": 120.0}),
        (28.6280, 77.1950, None, {"pm2_5": 210.0}),
    ]
    FIELD._fetched_at = time.time()
    monkeypatch.setattr(deps, "field_refresh", _noop)
    monkeypatch.setattr(deps, "osrm_route", fake_osrm)
    monkeypatch.setattr(me, "osrm_alternatives", fake_alts)
    monkeypatch.setattr(me, "TRAFFIC_FN", fake_traffic)
    monkeypatch.setattr(v2plan, "_engine", lambda: None)
    monkeypatch.setattr(transit_v2, "plan_transit", lambda *a, **k: [])
    monkeypatch.setattr(transit, "metro_option", lambda *a, **k: None)
    store.ROUTES._routes.clear()
    CALLS.clear()
    yield
    deps.set_location(None)
    FIELD._samples = []


def _plan(**kw):
    body = {"from": FROM, "to": TO}
    body.update(kw)
    r = client.post("/v2/plan", json=body)
    assert r.status_code == 200
    return r.json()


def _words(s):
    return len(str(s).split())


def _fam(o):
    return v2plan._FAMILY.get(o["mode"], o["mode"])


def _contract(j):
    opts = j["options"]
    assert opts
    picks = [o for o in opts if o.get("mode_pick") is True]
    assert len(picks) == 1 and opts[0]["mode_pick"] is True
    assert j["pick_route_id"] == opts[0]["route_id"]
    for o in opts:
        for k in ("fuel_l", "live_eta_s", "traffic_delay_s", "jams",
                  "mode_pick", "why"):
            assert k in o, (k, o.get("label"))
        assert isinstance(o["jams"], list)
        assert _words(o["why"]) <= 8, o["why"]
    return opts


# --- parsing -------------------------------------------------------------
def test_trip_mode_parsing_never_eats_a_vehicle():
    assert me.trip_mode({"mode": "health_max"}) == "health_max"
    assert me.trip_mode({"mode": "Petrol + Health"}) == "petrol_health"
    assert me.trip_mode({"trip_mode": "time_health"}) == "time_health"
    for veh in ("car", "walk", "bike", "metro", "auto", "bus", "cycle", ""):
        assert me.trip_mode({"mode": veh}) is None
    assert me.trip_mode(None) is None
    # no alias collides with a vehicle alias (legacy `mode` = vehicle)
    assert not set(me._ALIASES) & set(v2plan._VEHICLE_ALIASES)


# --- fuel ----------------------------------------------------------------
def _em(cls, fuel, co2, basis=None, occ=None):
    e = {"class": cls, "fuel": fuel, "co2_kg": {"mid": co2}}
    if basis:
        e["basis"] = basis
        e["occupancy"] = occ
    return e


def test_fuel_from_the_rows_own_co2():
    f = me.option_fuel({"mode": "car", "emissions": _em("car", "petrol", 2.31)})
    assert f["fuel_l"] == 1.0 and f["fuel_type"] == "petrol"
    f = me.option_fuel({"mode": "car", "emissions": _em("car", "diesel", 2.68)})
    assert f["fuel_l"] == 1.0 and f["fuel_type"] == "diesel"
    f = me.option_fuel({"mode": "auto", "emissions": _em("auto", "cng", 2.69)})
    assert f["fuel_l"] is None and f["fuel_kg"] == 1.0
    f = me.option_fuel({"mode": "car", "emissions": _em("car", "electric", 0.9)})
    assert f["fuel_l"] == 0.0 and f["fuel_type"] == "electric"
    for m in ("walk", "cycle", "metro"):
        assert me.option_fuel({"mode": m, "emissions": {}})["fuel_l"] == 0.0
    # no CO2 / unknown fuel -> honest null, never a guess
    assert me.option_fuel({"mode": "car", "emissions": {}})["fuel_l"] is None
    assert me.option_fuel({"mode": "car", "emissions": _em(
        "car", None, 1.0)})["fuel_l"] is None


def test_idle_topup_only_for_unpriced_live_delay():
    o = {"mode": "car", "eta_s": 600, "freeflow_s": 600, "distance_km": 5.0,
         "emissions": _em("car", "petrol", 2.31)}
    o.update(me.option_fuel(o))
    me._apply_traffic(o, {"delay_s": 360.0, "jams": []}, "t")
    assert o["live_eta_s"] == 960 and o["traffic_delay_s"] == 360
    add = round(360 / 3600.0 * me.IDLE_L_PER_H[("car", "petrol")], 3)
    assert o["fuel_idle_l"] == add and o["fuel_l"] == round(1.0 + add, 3)
    # Amazon-style row already carrying traffic (eta > freeflow): the jam
    # restarts from freeflow, only the extra over eta is topped up
    o2 = {"mode": "car", "eta_s": 900, "freeflow_s": 600, "distance_km": 5.0,
          "emissions": _em("car", "petrol", 2.31)}
    o2.update(me.option_fuel(o2))
    me._apply_traffic(o2, {"delay_s": 200.0}, "t")
    assert o2["live_eta_s"] == 800 and "fuel_idle_l" not in o2


# --- picks (pure) ----------------------------------------------------------
def _row(rid, dose, eta, co2, mode="car", fuel="petrol"):
    o = {"route_id": rid, "mode": mode, "eta_s": eta, "freeflow_s": eta,
         "dose": {"mid": dose}, "emissions": _em(mode, fuel, co2)}
    o.update(me.option_fuel(o))
    me._no_traffic(o)
    return o


def _pick(rows, mode, vehicle="car"):
    me.pick_and_explain(rows, mode, vehicle, lambda m: v2plan._FAMILY.get(
        m, m), live_known=False)
    picks = [o for o in rows if o["mode_pick"]]
    assert len(picks) == 1 and rows[0] is picks[0]
    assert all(_words(o["why"]) <= 8 for o in rows)
    return rows[0]


def test_health_max_is_min_dose_no_compromise():
    rows = [_row("a", 100.0, 600, 1.0), _row("b", 90.0, 1500, 3.0),
            _row("c", 95.0, 700, 0.8)]
    p = _pick(rows, "health_max")
    assert p["route_id"] == "b" and p["why"] == "cleanest air on this trip"


def test_petrol_health_min_fuel_within_15pct_dose():
    rows = [_row("clean", 100.0, 900, 2.0),
            _row("lean", 114.0, 950, 1.2),      # within +15 %: wins
            _row("leanest", 130.0, 1000, 0.5)]  # cheapest fuel, too smoky
    p = _pick(rows, "petrol_health")
    assert p["route_id"] == "lean"
    assert p["why"] == "least petrol, air still clean"
    # litres saved vs the fastest same-fuel row ("clean", 2.0/2.31 L)
    clean = next(o for o in rows if o["route_id"] == "clean")
    assert p["fuel_saved_l"] == round(clean["fuel_l"] - p["fuel_l"], 3)
    assert 0.34 < p["fuel_saved_l"] < 0.35
    assert p["fuel_saved_vs"] == "clean"
    other = next(o for o in rows if o["route_id"] == "leanest")
    assert "more smoke" in other["why"]


def test_time_health_min_live_eta_within_15pct_dose():
    rows = [_row("clean", 100.0, 1200, 2.0), _row("quick", 112.0, 800, 2.2),
            _row("quickest", 140.0, 500, 2.0)]
    p = _pick(rows, "time_health")
    assert p["route_id"] == "quick"
    assert p["why"] == "fastest route, air still clean"   # no live reading


def test_near_ties_go_to_the_cleaner_row():
    # live check (CP -> ISKCON): 0.933 vs 0.932 L, 1262 vs 1217 s — the
    # cleaner road must not lose on a 1 mL / 45 s difference
    def rows():
        a = _row("a", 7.8, 971, 0.933 * 2.31)
        b = _row("b", 8.9, 1108, 0.932 * 2.31)
        a.update(live_eta_s=1262, traffic_delay_s=291)
        b.update(live_eta_s=1217, traffic_delay_s=109)
        return [b, a]
    p = _pick(rows(), "petrol_health")
    assert p["route_id"] == "a" and p["why"] == "least petrol and the cleanest air"
    p = _pick(rows(), "time_health")
    assert p["route_id"] == "a"
    assert p["why"] == "within a minute of fastest, cleanest air"


def test_time_health_judges_on_live_readings_only():
    a = _row("read", 100.0, 900, 1.0)
    a.update(live_eta_s=1500, traffic_delay_s=600)
    b = _row("unread", 105.0, 1200, 1.0)     # budget ran out on this road
    rows = [b, a]
    me.pick_and_explain(rows, "time_health", "car", lambda m: m,
                        live_known=True)
    assert rows[0]["route_id"] == "read"
    assert rows[0]["why"] == "fastest now and the cleanest air"
    assert rows[1]["why"] == "air nearly as clean, no live traffic reading"


def test_pick_stays_inside_the_riders_vehicle_family():
    rows = [_row("walk", 20.0, 3000, 0.0, mode="walk", fuel=None),
            _row("car1", 100.0, 600, 1.0), _row("car2", 105.0, 650, 0.9)]
    p = _pick(rows, "health_max", vehicle="car")
    assert p["route_id"] == "car1"


def test_close_routes_say_about_the_same():
    rows = [_row("a", 100.0, 600, 1.00), _row("b", 101.0, 630, 1.01),
            _row("c", 102.0, 650, 1.02)]
    p = _pick(rows, "time_health")
    assert p["why"] == "all routes are about the same today"


def test_petrol_never_claims_least_fuel_without_a_number():
    rows = [_row("a", 100.0, 600, None), _row("b", 105.0, 650, None)]
    p = _pick(rows, "petrol_health")
    assert "least" not in p["why"] and "not known" in p["why"]


# --- live traffic fan-out ------------------------------------------------
def _geo_rows(n):
    rows = []
    for i in range(n):
        g = {"type": "LineString", "coordinates": [
            [77.20, 28.61], [77.21 + i * 0.01, 28.62 + i * 0.001],
            [77.19, 28.64]]}
        o = _row(f"r{i}", 100.0 + i, 600 + i, 1.0)
        o["geometry"] = g
        rows.append(o)
    return rows


def test_traffic_asks_at_most_five_routes_lat_lon_order():
    rows = _geo_rows(8)
    seen = []

    def sync_provider(coords):          # sync providers run off-loop
        seen.append(coords)
        return {"delay_s": 120.0, "jams": [], "source": "sync"}
    me.TRAFFIC_FN = sync_provider
    st = asyncio.run(me.live_traffic(rows, lambda m: m, "car"))
    assert len(seen) == me.TRAFFIC_MAX_ROUTES == st["routes_checked"]
    assert seen[0][0] == [28.61, 77.20]          # [lat, lon]
    assert st["live"] is True and st["source"] == "sync"
    live = [o for o in rows if o["traffic_delay_s"] is not None]
    assert len(live) == 5 and all(o["live_eta_s"] == o["eta_s"] + 120
                                  for o in live)
    # cleanest first: the 3 dirtiest rows are the ones left unchecked
    assert {o["route_id"] for o in rows if o["traffic_delay_s"] is None} \
        == {"r5", "r6", "r7"}


def test_live_time_only_reading_applies_to_matched_car_rows_only():
    """A provider that knows only the live trip time (no delay, e.g. an
    Ola-backed fallback): matched car rows take it, other rows on that
    road stay honest nulls."""
    car = _row("car", 100.0, 600, 1.0)
    bike = _row("bike", 110.0, 540, 0.3, mode="bike")
    for o in (car, bike):
        o["geometry"] = MAIN
        o["distance_km"] = 6.2
    me.TRAFFIC_FN = lambda coords: {"live_s": 900, "delay_s": None,
                                    "length_m": 6250, "jams": [],
                                    "source": "ola"}
    st = asyncio.run(me.live_traffic([car, bike], lambda m: m, "car"))
    assert st["live"] is True and st["source"] == "ola"
    assert car["live_eta_s"] == 900 and car["traffic_delay_s"] == 300
    assert bike["traffic_delay_s"] is None and bike["live_eta_s"] == 540
    car2 = _row("car2", 100.0, 600, 1.0)
    car2["geometry"], car2["distance_km"] = MAIN, 9.0   # not this road
    st = asyncio.run(me.live_traffic([car2], lambda m: m, "car"))
    assert st["live"] is False and car2["traffic_delay_s"] is None


def test_traffic_budget_and_absent_provider_are_honest_nulls():
    rows = _geo_rows(3)

    async def slow(coords):
        await asyncio.sleep(5)
        return {"delay_s": 999.0}
    me.TRAFFIC_FN = slow
    t0 = time.perf_counter()
    st = asyncio.run(me.live_traffic(rows, lambda m: m, "car", budget_s=0.2))
    assert time.perf_counter() - t0 < 2.0
    assert st["live"] is False and st["timed_out"] == 3
    assert all(o["traffic_delay_s"] is None and o["live_eta_s"] == o["eta_s"]
               and o["jams"] == [] for o in rows)
    me.TRAFFIC_FN = None
    orig = me._traffic_fn
    try:
        me._traffic_fn = lambda: None   # lane P's provider not landed
        st = asyncio.run(me.live_traffic(rows, lambda m: m, "car"))
    finally:
        me._traffic_fn = orig
    assert st == {"live": False, "note": "live traffic not connected"}
    assert all(o["traffic_delay_s"] is None for o in rows)


# --- /v2/plan end to end ---------------------------------------------------
def test_plan_without_mode_is_todays_body():
    j = _plan(vehicle="car")
    assert "mode" not in j and "pick_route_id" not in j
    for o in j["options"]:
        assert "mode_pick" not in o and "fuel_l" not in o
        assert "· alt" not in o["label"]          # no extra router calls
    assert CALLS == []


def test_plan_petrol_health_full_contract():
    j = _plan(mode="petrol_health", vehicle="car",
              vehicle_profile={"class": "car", "fuel": "petrol"})
    assert j["vehicle"] == "car" and j["mode"] == "petrol_health"
    assert j["trip_mode"] == "petrol_health"
    assert j["mode_rule"] and j["fuel_basis"]
    assert j["traffic"]["live"] is True
    opts = _contract(j)
    labels = [o["label"] for o in opts]
    assert any("· alt 1" in s for s in labels) and any("· alt 2" in s
                                                       for s in labels)
    cars = [o for o in opts if _fam(o) == "car"]
    assert _fam(opts[0]) == "car"
    min_d = min(o["dose"]["mid"] for o in cars)
    within = [o for o in cars if o["dose"]["mid"] <= min_d * 1.15]
    lo = min(o["fuel_l"] for o in within)
    assert opts[0]["fuel_l"] <= lo + max(0.01, 0.01 * lo)   # near-tie rule
    assert opts[0]["fuel_l"] > 0 and opts[0]["fuel_type"] == "petrol"
    # the jammed main road: live eta = eta + live delay, idle burn added
    main_car = next(o for o in opts if o["mode"] == "car"
                    and "alt" not in o["label"])
    assert main_car["traffic_delay_s"] == 600
    assert main_car["live_eta_s"] == main_car["eta_s"] + 600
    assert main_car["fuel_idle_l"] == round(
        600 / 3600.0 * me.IDLE_L_PER_H[("car", "petrol")], 3)
    assert main_car["jams"][0]["road"] == "Test Marg"
    assert all(len(c) >= 2 and 28 < c[0][0] < 29 for c in CALLS)  # lat first
    assert len(CALLS) <= me.TRAFFIC_MAX_ROUTES


def test_plan_time_health_picks_fastest_live_within_15pct():
    j = _plan(mode="time_health", vehicle="car")
    opts = _contract(j)
    cars = [o for o in opts if _fam(o) == "car"]
    min_d = min(o["dose"]["mid"] for o in cars)
    within = [o for o in cars if o["dose"]["mid"] <= min_d * 1.15]
    assert opts[0]["live_eta_s"] <= min(o["live_eta_s"] for o in within) + 60
    # the 10-min jam on the main road knocks it off the top
    assert "alt" in opts[0]["label"]


def test_plan_health_max_and_fast_first_paint_skip_traffic(monkeypatch):
    j = _plan(mode="health_max", vehicle="bike")
    opts = _contract(j)
    bikes = [o for o in opts if _fam(o) == "bike"]
    assert _fam(opts[0]) == "bike"
    assert opts[0]["dose"]["mid"] == min(o["dose"]["mid"] for o in bikes)
    assert j["traffic"]["live"] is True

    # fast first paint (engine rows in prod; router rows stand in here,
    # the engine is disabled in this suite): no live-traffic wait
    async def eng_first(flat, flon, tlat, tlon, vehicle, profile):
        return await v2plan._options_bounded(flat, flon, tlat, tlon,
                                             vehicle, profile, None)
    monkeypatch.setattr(v2plan, "_engine_first", eng_first)
    CALLS.clear()
    j = _plan(mode="health_max", vehicle="car", fast=True)
    assert j["partial"] is True and CALLS == []
    assert j["traffic"] == {"live": False,
                            "note": "not checked on the quick first paint"}
    opts = _contract(j)
    assert all(o["traffic_delay_s"] is None and o["live_eta_s"] == o["eta_s"]
               for o in opts)


def test_plan_traffic_failure_and_mode_failure_never_sink_the_plan(
        monkeypatch):
    async def boom(coords):
        raise RuntimeError("provider down")
    monkeypatch.setattr(me, "TRAFFIC_FN", boom)
    j = _plan(mode="time_health", vehicle="car")
    opts = _contract(j)
    assert j["traffic"]["live"] is False
    assert all(o["traffic_delay_s"] is None for o in opts)

    async def apply_boom(*a, **k):
        raise RuntimeError("modes bug")
    monkeypatch.setattr(me, "apply", apply_boom)
    j = _plan(mode="time_health", vehicle="car")
    assert j["options"] and j["mode_error"]
    assert sum(1 for o in j["options"] if o["mode_pick"]) == 1


# --- /v2/reroute honours the mode -----------------------------------------
def test_reroute_returns_the_modes_pick():
    j = client.post("/v2/reroute", json={
        "at": FROM, "to": TO, "mode": "time_health",
        "vehicle": "car"}).json()
    assert j["trip_mode"] == "time_health"
    assert j["option"]["mode_pick"] is True
    assert j["route_id"] == j["option"]["route_id"] == j["pick_route_id"]
    assert j["mode"] == j["option"]["mode"] and j["vehicle"] == "car"
    assert j["live_eta_s"] == j["option"]["live_eta_s"]
    assert "alt" in j["option"]["label"]          # jammed main road avoided
    cars = [o for o in j["options"] if _fam(o) == "car"]
    min_d = min(o["dose"]["mid"] for o in cars)
    within = [o for o in cars if o["dose"]["mid"] <= min_d * 1.15]
    assert j["live_eta_s"] <= min(o["live_eta_s"] for o in within) + 60


def test_reroute_mode_only_keeps_the_ridden_family():
    old = store.ROUTES.put({
        "geometry": MAIN, "mode": "bike", "duration_s": 700,
        "vehicle": "car", "to": TO,
        "emissions_vehicle": {"class": "bike", "fuel": "petrol"}})
    j = client.post("/v2/reroute", json={
        "route_id": old, "at": FROM, "mode": "petrol_health"}).json()
    assert j["rerouted_from"] == old and j["trip_mode"] == "petrol_health"
    assert j["vehicle"] == "bike" and _fam(j["option"]) == "bike"
    assert j["option"]["mode_pick"] is True


def test_reroute_legacy_vehicle_mode_untouched():
    j = client.post("/v2/reroute", json={
        "at": FROM, "to": TO, "mode": "walk"}).json()
    assert j["mode"] == "walk" and "trip_mode" not in j


# --- mode_picks: all three modes' picks on the same pool -------------------
def _brief_keys(b):
    for k in ("route_id", "label", "dose_mid", "eta_s", "live_eta_s",
              "traffic_delay_s", "fuel_l", "fuel_kg", "fuel_type",
              "your_vehicle"):
        assert k in b, k


def test_mode_picks_carries_every_mode_from_the_same_pool():
    j = _plan(mode="time_health", vehicle="car")
    opts = _contract(j)
    mp = j["mode_picks"]
    assert set(mp) == {"health_max", "petrol_health", "time_health"}
    ids = {o["route_id"] for o in opts}
    for m, b in mp.items():
        _brief_keys(b)
        assert b["route_id"] in ids
    # the asked-for mode's brief IS its pick row
    pick = next(o for o in opts if o["mode_pick"])
    assert mp["time_health"]["route_id"] == pick["route_id"]
    for k in ("dose_mid", "live_eta_s", "fuel_l"):
        assert mp["time_health"][k] == (pick["dose"]["mid"] if k == "dose_mid"
                                        else pick[k])
    # every mode's pick obeys its own rule on this pool — recompute,
    # don't trust the wire
    cars = [o for o in opts if _fam(o) == "car"]
    min_d = min(o["dose"]["mid"] for o in cars)
    within = [o for o in cars if o["dose"]["mid"] <= min_d * 1.15]
    assert mp["health_max"]["route_id"] == \
        min(cars, key=lambda o: o["dose"]["mid"])["route_id"]
    assert mp["petrol_health"]["route_id"] == \
        min(within, key=lambda o: o["fuel_l"])["route_id"]
    assert mp["time_health"]["route_id"] == pick["route_id"]
    assert j["one_pick"] is False


def test_mode_picks_one_pick_when_one_road_wins_all_three():
    # a single row that is cleanest AND cheapest AND fastest: the engine
    # must say so plainly instead of pretending three stories
    rows = [_row("only", 100.0, 900, 1.0)]
    me.pick_and_explain(rows, "health_max", "car",
                        lambda m: m, live_known=False,
                        picks={"health_max": rows[0],
                               "petrol_health": rows[0],
                               "time_health": rows[0]})
    assert rows[0]["why"] == "the only route for this ride"
    rows = [_row("a", 100.0, 600, 1.0), _row("b", 140.0, 900, 2.0)]
    me.pick_and_explain(rows, "petrol_health", "car",
                        lambda m: m, live_known=False,
                        picks={"health_max": rows[0],
                               "petrol_health": rows[0],
                               "time_health": rows[0]})
    assert rows[0]["why"] == "the same road wins every way"
    assert rows[0]["mode_pick"] is True


def test_mode_picks_live_through_apply_not_just_the_asked_mode():
    # the briefs come from apply()'s own pool, so a client comparing
    # picks compares like-for-like rows
    o1, o2 = _row("main", 100.0, 1300, 1.0), _row("alt", 105.0, 800, 0.8)
    opts = [o1, o2]
    fam = lambda m: m
    block = asyncio.run(
        me.apply(opts, "health_max", "car", fam, traffic=False))
    mp = block["mode_picks"]
    assert mp["health_max"]["route_id"] == "main"     # cleanest
    assert mp["petrol_health"]["route_id"] == "alt"   # less fuel, within 15%
    assert mp["time_health"]["route_id"] == "alt"     # fastest
    assert block["one_pick"] is False
    assert block["pick_route_id"] == "main"


def test_traffic_matched_flags_the_providers_own_road_read():
    # a delay read whose length agrees with our geometry is THIS road's
    # congestion; a differently-sized read is a nearby road's — the row
    # must say which, not leave it ambiguous
    o = {"mode": "car", "eta_s": 900, "freeflow_s": 600,
         "distance_km": 5.0, "emissions": _em("car", "petrol", 2.31)}
    o.update(me.option_fuel(o))
    me._apply_traffic(o, {"delay_s": 200.0, "length_m": 5050.0,
                          "jams": []}, "t")
    assert o["traffic_matched"] is True
    assert o["traffic_source"] == "t"
    assert o["traffic_delay_s"] == 200
    o2 = {"mode": "car", "eta_s": 900, "freeflow_s": 600,
          "distance_km": 5.0, "emissions": _em("car", "petrol", 2.31)}
    o2.update(me.option_fuel(o2))
    me._apply_traffic(o2, {"delay_s": 200.0, "length_m": 12000.0,
                           "jams": []}, "t")
    assert o2["traffic_matched"] is False
    assert o2["traffic_delay_s"] == 200


def test_no_traffic_clears_source_and_matched_with_delay():
    # trip mode wipes any pre-existing delay stamp — a row with no live
    # reading must not keep a router-priced source/matched dangling on it
    o = {"mode": "car", "eta_s": 900, "freeflow_s": 600,
         "traffic_delay_s": 140, "traffic_source": "amazon-location",
         "traffic_matched": True, "jams": [{"x": 1}]}
    me._no_traffic(o)
    assert o["traffic_delay_s"] is None
    assert o["traffic_source"] is None
    assert o["traffic_matched"] is None
    assert o["jams"] == []
    assert o["live_eta_s"] == 900
