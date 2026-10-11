"""Oct11 admin lane — anonymous usage counters end to end.

POST /v2/tally (v2/trip.py) → agg_ddb usage store (memory twin or the
DynamoDB table via a fake client — no AWS, no network) → <mount>/api/app
(admin_agg) → admin.html panels. Plus the segregation share on
/api/corridors and the telemetry.js client contract.
"""
import json
import os
import time

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

import admin_agg
import agg_ddb
from admin_mount import ADMIN_MOUNT as M
from v2 import trip as v2trip
from v2.store import LEDGER, TRIPS

_HERE = os.path.dirname(os.path.abspath(__file__))
_SERVER = os.path.dirname(_HERE)

app = FastAPI()
app.include_router(admin_agg.router)
_v2 = APIRouter(prefix="/v2")
_v2.include_router(v2trip.router)
app.include_router(_v2)
client = TestClient(app)

BANNED_KEYS = {
    "token", "tokens", "token_hash", "device_token", "anon", "anon_hash",
    "lat", "lon", "latitude", "longitude", "coord", "coords",
    "coordinate", "coordinates", "trajectory", "points", "geometry",
    "route", "contributor", "reporter", "identity", "user", "users",
    "uid", "uuid", "device_id", "ip", "address",
}
A1 = "a" * 32
A2 = "b" * 32


def _keys(o):
    if isinstance(o, dict):
        for k, v in o.items():
            yield k
            yield from _keys(v)
    elif isinstance(o, list):
        for v in o:
            yield from _keys(v)


class ConditionalCheckFailedException(Exception):
    """Same class name botocore raises for a failed ConditionExpression."""


class FakeDDB:
    """update_item (SET/ADD/DELETE over N + SS, ExpressionAttributeNames,
    the area-cap ConditionExpression), scan, delete_item — the shapes
    agg_ddb emits, with real ADD / DELETE semantics."""

    def __init__(self, fail_on=()):
        self.items = {}
        self.fail_on = set(fail_on)

    def _cond_ok(self, item, cond, names, vals):
        # only the shape agg_ddb emits for the daily area index:
        # attribute_not_exists(#n) OR contains(#n, :s) OR size(#n) < :cap
        assert cond == ("attribute_not_exists(#n) OR contains(#n, :s) OR "
                        "size(#n) < :cap"), cond
        cur = item.get(names["#n"])
        if cur is None:
            return True
        ss = set(cur["SS"])
        return vals[":s"]["S"] in ss or len(ss) < float(vals[":cap"]["N"])

    def update_item(self, TableName, Key, UpdateExpression,
                    ExpressionAttributeNames=None,
                    ExpressionAttributeValues=None,
                    ConditionExpression=None, **kw):
        if "update_item" in self.fail_on:
            raise RuntimeError("injected update failure")
        names = ExpressionAttributeNames or {}
        vals = ExpressionAttributeValues or {}
        k = (Key["pk"]["S"], Key["sk"]["S"])
        item = self.items.get(k) or dict(Key)
        if ConditionExpression and not self._cond_ok(
                item, ConditionExpression, names, vals):
            raise ConditionalCheckFailedException("condition failed")
        self.items[k] = item
        expr = UpdateExpression.strip()
        parts = {"SET": "", "ADD": "", "DELETE": ""}
        import re as _re
        for m in _re.finditer(r"(SET|ADD|DELETE)\s+(.*?)(?=\s+(?:SET|ADD|DELETE)\s|$)",
                              expr):
            parts[m.group(1)] = m.group(2)
        for a in filter(None, (x.strip() for x in parts["SET"].split(","))):
            attr, ref = (x.strip() for x in a.split("="))
            item[names.get(attr, attr)] = dict(vals[ref])
        for a in filter(None, (x.strip() for x in parts["ADD"].split(","))):
            attr, ref = a.split()
            attr = names.get(attr, attr)
            v, cur = vals[ref], item.get(attr)
            if cur is None:
                item[attr] = dict(v)
            elif "N" in cur:
                item[attr] = {"N": str(float(cur["N"]) + float(v["N"]))}
            else:
                item[attr] = {"SS": sorted(set(cur["SS"]) | set(v["SS"]))}
        for a in filter(None, (x.strip() for x in parts["DELETE"].split(","))):
            attr, ref = a.split()
            attr = names.get(attr, attr)
            cur = item.get(attr)
            if cur is not None:
                left = sorted(set(cur["SS"]) - set(vals[ref]["SS"]))
                if left:
                    item[attr] = {"SS": left}
                else:
                    item.pop(attr)          # DDB drops an emptied set
        return {}

    def scan(self, TableName, **kw):
        if "scan" in self.fail_on:
            raise RuntimeError("injected scan failure")
        return {"Items": [dict(v) for v in self.items.values()]}

    def delete_item(self, TableName, Key, **kw):
        self.items.pop((Key["pk"]["S"], Key["sk"]["S"]), None)


@pytest.fixture(autouse=True)
def fresh():
    agg_ddb.set_usage_store(agg_ddb.MemoryUsageAggregates())
    v2trip._USAGE_RL.clear()
    v2trip._USAGE_OPENS.clear()
    v2trip._USAGE_PROFILES.clear()
    TRIPS.reset()
    LEDGER.reset()
    yield
    agg_ddb.set_usage_store(None)


def _post(anon, events, **extra):
    return client.post("/v2/tally", json={"anon": anon, "events": events,
                                          **extra})


def _journey(anon, mode="health_max", vehicle="car", completed=True,
             saved=40.0, **kw):
    return _post(anon, [
        {"event": "journey_start", "props": {"mode": mode,
                                             "vehicle": vehicle}},
        {"event": "journey_end", "props": {
            "completed": completed, "mode": mode, "vehicle": vehicle,
            "dose_ug": 120.0, "dose_saved_ug": saved, "km": 8.2,
            "minutes": 31, **kw}}])


# --- ingestion -----------------------------------------------------------------

def test_tally_counts_flow_into_api_app():
    assert _post(A1, [{"event": "app_open"}]).json()["accepted"] == 1
    assert _journey(A1).status_code == 200
    assert _journey(A2, mode="time_health", vehicle="rickshaw",
                    completed=False, saved=-5.0).status_code == 200
    d = client.get(M + "/api/app").json()
    assert d["available"] is True and d["empty"] is False
    assert d["devices"] == {**d["devices"], "today": 2, "d7": 2, "total": 2}
    j = d["journeys"]["total"]
    assert (j["started"], j["ended"], j["completed"]) == (2, 2, 1)
    assert j["success_pct"] == 50.0
    modes = {r["name"]: r for r in d["modes"]["total"]}
    assert modes["health_max"]["started"] == 1
    assert modes["time_health"]["started"] == 1
    assert modes["petrol_health"]["started"] == 0      # listed, honest 0
    veh = {r["name"]: r["started"] for r in d["vehicles"]["total"]}
    assert veh == {"car": 1, "auto": 1}                 # rickshaw → auto
    v2trip._USAGE_RL.clear()
    for v, want in (("erick", "erick"), ("taxi", "cab"),
                    ("driving_two_wheeler", "bike"), ("walking", "walk")):
        props, _ = v2trip._clean_usage_props("journey_start", {"vehicle": v})
        assert props["vehicle"] == want, v
    i = d["intake"]["total"]
    assert i["saved_ug"] == 35.0 and i["reports"] == 2
    assert d["opens"]["today"] == 1
    assert d["since"] == agg_ddb.ist_day(time.time())
    assert len(d["daily"]) == 14 and d["daily"][-1]["started"] == 2


def test_location_fields_are_dropped_never_stored():
    r = _post(A1, [
        {"event": "journey_start", "lat": 28.6,
         "props": {"mode": "health_max", "vehicle": "car",
                   "lat": 28.68, "lon": 77.3, "coords": [[77.3, 28.68]]}},
        {"event": "journey_end", "props": {
            "completed": True, "address": "Pawan Bakery", "dose_ug": 50,
            "from": {"lat": 28.6, "lon": 77.2}}}], where={"lat": 1})
    d = r.json()
    assert r.status_code == 200 and d["accepted"] == 2
    assert d["dropped_fields"] == 7   # where + lat + lat/lon/coords + addr/from
    store = agg_ddb.usage_store()
    blob = json.dumps(store.summary(), default=list)
    for bad in ("28.6", "77.3", "Pawan", "lat", "lon", "coords"):
        assert bad not in blob, bad
    leaked = {k.lower() for k in _keys(client.get(M + "/api/app").json())}
    assert not leaked & BANNED_KEYS


def test_tally_rejects_bad_envelopes():
    assert _post("short", [{"event": "app_open"}]).status_code == 422
    assert _post(A1 + "!", [{"event": "app_open"}]).status_code == 422
    assert _post(A1, []).status_code == 422
    assert _post(A1, {"event": "app_open"}).status_code == 422
    assert _post(A1, [{"event": "app_open"}] * 26).status_code == 422
    assert client.post("/v2/tally", content=b"{nope").status_code == 422
    assert client.post("/v2/tally", content=b"[1,2]").status_code == 422
    big = json.dumps({"anon": A1, "events": [{"event": "app_open",
                                              "props": {"x": "y" * 20000}}]})
    assert client.post("/v2/tally", content=big.encode()).status_code == 413
    # text/plain (sendBeacon) parses the same as JSON
    r = client.post("/v2/tally", content=json.dumps(
        {"anon": A1, "events": [{"event": "app_open"}]}).encode(),
        headers={"content-type": "text/plain"})
    assert r.status_code == 200 and r.json()["accepted"] == 1


def test_unknown_events_modes_and_numbers_are_dropped():
    d = _post(A1, [{"event": "page_view"}, {"event": "journey_start",
                   "props": {"mode": "<script>", "vehicle": "spaceship"}},
                  {"event": "journey_end", "props": {
                      "completed": "yes", "dose_ug": 1e9, "km": "nan",
                      "minutes": -3}}]).json()
    assert d["rejected"] == 1 and d["accepted"] == 2
    assert d["dropped_fields"] == 4     # mode + dose_ug + km + minutes
    s = agg_ddb.usage_store().summary()
    day = s["days"][s["today"]]
    assert day["modes"] == {"none": {"started": 1, "completed": 0}}
    assert day["vehicles"] == {"other": {"started": 1, "completed": 0}}
    assert day["completed"] == 0         # "yes" is not True
    assert day["dose_n"] == 0 and day["km"] == 0


def test_app_open_once_per_ist_day_and_rate_limit():
    for _ in range(3):
        _post(A1, [{"event": "app_open"}])
    assert agg_ddb.usage_store().summary()["days"][
        agg_ddb.ist_day(time.time())]["opens"] == 1
    sent = limited = 0
    while sent < v2trip.USAGE_RATE_PER_HOUR + 40:
        d = _post(A2, [{"event": "journey_start",
                        "props": {"mode": "health_max"}}] * 20).json()
        sent += 20
        limited += d["rate_limited"]
    assert limited == sent - v2trip.USAGE_RATE_PER_HOUR
    s = agg_ddb.usage_store().summary()
    assert s["days"][s["today"]]["started"] == v2trip.USAGE_RATE_PER_HOUR


def test_old_or_future_client_clock_lands_on_server_day():
    now_ms = time.time() * 1000
    _post(A1, [{"event": "journey_start", "ts": now_ms - 30 * 86400000},
               {"event": "journey_start", "ts": now_ms + 86400000}])
    s = agg_ddb.usage_store().summary()
    assert list(s["days"]) == [agg_ddb.ist_day(time.time())]


# --- DynamoDB backend (fake client) ---------------------------------------------

def test_ddb_backend_matches_memory():
    fake = FakeDDB()
    ddb = agg_ddb.get_usage_store(client=fake)
    mem = agg_ddb.MemoryUsageAggregates()
    ts = time.time()
    evs = [("app_open", {}, "h1"),
           ("journey_start", {"mode": "petrol_health", "vehicle": "bike"}, "h1"),
           ("journey_end", {"completed": True, "mode": "petrol_health",
                            "vehicle": "bike", "dose_ug": 80.5,
                            "dose_saved_ug": 12.25, "km": 5.0,
                            "minutes": 20.0}, "h1"),
           ("journey_start", {"mode": "health_max"}, "h2")]
    for kind, props, h in evs:
        ddb.record(kind, props, h, ts)
        mem.record(kind, props, h, ts)
    a, b = ddb.summary(ts), mem.summary(ts)
    assert a["backend"] == "dynamodb" and b["backend"] == "memory"
    a.pop("backend"), b.pop("backend")
    assert json.loads(json.dumps(a)) == json.loads(json.dumps(b))
    assert a["devices"] == {"today": 2, "d7": 2, "total": 2}
    pks = {pk for pk, _ in fake.items}
    assert pks == {agg_ddb.USAGE_PK + agg_ddb.ist_day(ts)}
    # nothing but hashed ids + counters on the table
    blob = json.dumps(list(fake.items.values()))
    assert "lat" not in blob and "lon" not in blob
    ddb.reset()
    assert not fake.items


def test_ddb_write_failure_is_503_and_read_failure_is_honest():
    agg_ddb.set_usage_store(agg_ddb.get_usage_store(
        client=FakeDDB(fail_on=("update_item",))))
    r = _post(A1, [{"event": "journey_start"}])
    assert r.status_code == 503 and r.json()["stored"] is False
    agg_ddb.set_usage_store(agg_ddb.get_usage_store(
        client=FakeDDB(fail_on=("scan",))))
    d = client.get(M + "/api/app").json()
    assert d["available"] is False and "scan" in (d["error"] or "")


def test_empty_store_is_honest_zero_with_since_basis():
    d = client.get(M + "/api/app").json()
    assert d["empty"] is True and d["since"] is None
    assert d["server_start_ts"] <= time.time()
    assert d["journeys"]["total"]["success_pct"] is None
    assert d["intake"]["total"]["mean_saved_ug"] is None
    assert d["devices"]["total"] == 0


def test_usage_store_backend_selection(monkeypatch):
    monkeypatch.delenv("AGG_TABLE", raising=False)
    monkeypatch.delenv("ALIVE_DDB_TABLE", raising=False)
    assert agg_ddb.get_usage_store().backend == "memory"
    monkeypatch.setenv("AGG_TABLE", "alive108-agg")
    monkeypatch.setattr(agg_ddb, "_aws_ready", lambda: (None, "no creds"))
    assert agg_ddb.get_usage_store().backend == "memory"


# --- segregation share on /corridors --------------------------------------------

def test_corridor_share_of_all_trips():
    for tok in ("t1", "t2", "t3", "t4"):
        TRIPS.record_trip(["cellA", "cellB"], {"distance_km": 4.0,
                                               "dose_ug": 50.0}, tok)
    TRIPS.record_trip(["cellC"], {"distance_km": 2.0}, "t5")
    d = client.get(M + "/api/corridors").json()
    assert d["trips_total"] == 5
    rows = {r["cell"]: r for r in d["rows"]}
    assert set(rows) == {"cellA", "cellB"}            # cellC: k<3, hidden
    # the console's share = row.trips / trips_total → 4 of 5 = 80%
    assert rows["cellA"]["trips"] / d["trips_total"] == 0.8
    assert "share_of_trips_pct" not in rows["cellA"]  # row shape unchanged
    assert all(int(r["devices"]) >= 3 for r in d["rows"])


# --- gate + page + client contract ----------------------------------------------

def test_api_app_is_behind_the_operator_gate(monkeypatch):
    import main as _m
    monkeypatch.setenv("ALIVE_ADMIN_TOKEN", "oct11-secret")
    c = TestClient(_m.app)
    assert c.get(M + "/api/app").status_code == 401
    ok = c.get(M + "/api/app",
               headers={"Authorization": "Bearer oct11-secret"})
    assert ok.status_code == 200 and "journeys" in ok.json()
    # ingestion is public (anonymous counters), GET on it is not a page
    assert c.post("/v2/tally", json={"anon": A1, "events": [
        {"event": "app_open"}]}).status_code == 200


def test_admin_page_has_six_real_panels_and_the_gate():
    html = open(os.path.join(_SERVER, "admin.html"), encoding="utf-8").read()
    for sid in ("s-air", "s-users", "s-journeys", "s-modes", "s-intake",
                "s-seg"):
        assert f'id="{sid}"' in html, sid
    assert html.count('class="asof"') >= 6            # every panel: as of
    for need in ("M+'/api/app'", "M+'/api/corridors'", "/grid?cells=40",
                 "cell_epoch", "so far — counting since", 'id="gate"',
                 "M+'/login'", "M+'/session'", "M+'/logout'",
                 "isGatedPath", "locked — sign in as operator",
                 "GRID_EVERY_MS=15*60*1000", "corr.trips_total"):
        assert need in html, need
    low = html.lower()
    for bad in ("fixture", "demo data", "lorem", "math.random"):
        assert bad not in low, bad


def test_telemetry_client_contract():
    js = open(os.path.join(_SERVER, "webapp", "telemetry.js"),
              encoding="utf-8").read()
    assert "A.track = track" in js and "'/v2/tally'" in js
    assert "st.get('anon')" in js and "sendBeacon" in js and "keepalive" in js
    for ev in ("app_open", "journey_start", "journey_end"):
        assert ev in js
    allowed = js[js.index("const ALLOWED"):js.index("};", js.index("const ALLOWED"))]
    for bad in ("lat", "lon", "coord", "address", "label"):
        assert bad not in allowed, bad


# --- profile: "anybody comes, we have the data, not by name" -------------------

def _profile(anon, **props):
    return _post(anon, [{"event": "profile", "props": props}])


def test_profile_normalises_labels_and_areas_and_flows_to_audience():
    assert _profile(A1, age_band="18–29", area="  Laxmi   NAGAR ").json()[
        "accepted"] == 1
    assert _profile(A2, age_band="60+",
                    area="H.No. 12, C-543 Laxmi Nagar 110092").json()[
        "accepted"] == 1
    assert _profile("c" * 32, age_band="Under 13",
                    area="Sector 62 Noida").json()["accepted"] == 1
    d = client.get(M + "/api/app").json()
    a = d["audience"]
    assert a["age_bands"] == {"under13": 1, "13-17": 0, "18-29": 1,
                              "30-44": 0, "45-59": 0, "60plus": 1}
    assert a["top_areas"] == [{"area": "Laxmi Nagar", "count": 2},
                              {"area": "Sector 62 Noida", "count": 1}]
    assert a["profiles_total"] == 3 and a["today"] == 3
    assert a["since"] == agg_ddb.ist_day(time.time())
    assert a["as_of"] <= time.time()
    assert "no names, no locations" in a["privacy"]
    leaked = {k.lower() for k in _keys(d)}
    assert not leaked & BANNED_KEYS


def test_profile_is_strict_coordinates_names_and_junk_never_land():
    r = _post(A1, [{"event": "profile", "props": {
        "age_band": "adult", "area": "28.6842, 77.3001", "name": "Ravi",
        "phone": "9876543210", "lat": 28.68, "lon": 77.30}}]).json()
    assert r["accepted"] == 0 and r["rejected"] == 1
    assert r["dropped_fields"] == 6     # band + area + name/phone/lat/lon
    for bad in ("me@mail.com", "https://x.in/a", "12/3 4-B", "A", 77.3):
        props, _ = v2trip._clean_usage_props("profile", {"area": bad})
        assert "area" not in props, bad
    long = "Mayur Vihar Phase 1 Pocket 2 Near The Big Market Road Gate"
    props, _ = v2trip._clean_usage_props("profile", {"area": long})
    assert len(props["area"]) <= 48 and props["area"].startswith(
        "mayur vihar phase 1")
    for lbl, want in (("Under 13", "under13"), ("13–17", "13-17"),
                      ("18–29", "18-29"), ("30–44", "30-44"),
                      ("45–59", "45-59"), ("60+", "60plus"),
                      ("30-44", "30-44"), ("60plus", "60plus")):
        assert v2trip.norm_age_band(lbl) == want, lbl
    assert v2trip.norm_age_band("18 to 29") is None
    s = agg_ddb.usage_store().summary()
    assert s["audience"]["profiles_total"] == 0
    blob = json.dumps(s, default=list)
    for bad in ("28.68", "77.30", "Ravi", "98765"):
        assert bad not in blob, bad


def test_profile_once_per_device_per_day_and_a_change_replaces():
    _profile(A1, age_band="30-44", area="Shahdara")
    r = _profile(A1, age_band="30–44", area="shahdara").json()
    assert r["accepted"] == 0 and r["duplicates"] == 1
    _profile(A1, age_band="45-59", area="Ashok Nagar")      # corrected
    a = client.get(M + "/api/app").json()["audience"]
    assert a["profiles_total"] == 1
    assert a["age_bands"]["45-59"] == 1 and a["age_bands"]["30-44"] == 0
    assert a["top_areas"] == [{"area": "Ashok Nagar", "count": 1}]
    # the id never lands in clear — only the namespaced hash
    store = agg_ddb.usage_store()
    blob = json.dumps({d: {k: {x: sorted(s) for x, s in v.items()}
                           for k, v in p.items() if k != "areas"}
                       for d, p in store._prof.items()})
    assert A1 not in blob and v2trip.usage_anon_hash(A1) in blob


def test_area_cap_spills_into_other(monkeypatch):
    monkeypatch.setattr(agg_ddb, "AREA_CAP", 2)
    for i, area in enumerate(("Rohini", "Dwarka", "Saket", "Rohini")):
        _profile(f"{i:032d}", area=area)
    a = client.get(M + "/api/app").json()["audience"]
    assert [r["area"] for r in a["top_areas"]] == ["Rohini", "Dwarka"]
    assert a["areas_other"] == 1 and a["profiles_total"] == 4


def test_ddb_profile_parity_with_memory_and_cap(monkeypatch):
    monkeypatch.setattr(agg_ddb, "AREA_CAP", 2)
    fake = FakeDDB()
    ddb = agg_ddb.get_usage_store(client=fake)
    mem = agg_ddb.MemoryUsageAggregates()
    ts = time.time()
    evs = [("profile", {"age_band": "18-29", "area": "rohini"}, "h1", None),
           ("profile", {"age_band": "60plus", "area": "dwarka"}, "h2", None),
           ("profile", {"area": "saket"}, "h3", None),            # → other
           ("profile", {"age_band": "30-44", "area": "dwarka"}, "h1",
            {"age_band": "18-29", "area": "rohini"}),             # change
           ("app_open", {}, "h4", None)]
    for kind, props, h, prev in evs:
        got = ddb.record(kind, props, h, ts, prev=prev)
        assert got == mem.record(kind, props, h, ts, prev=prev)
    a, b = ddb.summary(ts), mem.summary(ts)
    a.pop("backend"), b.pop("backend")
    assert json.loads(json.dumps(a)) == json.loads(json.dumps(b))
    aud = a["audience"]
    assert aud["age_bands"]["30-44"] == 1 and aud["age_bands"]["18-29"] == 0
    assert aud["areas"] == {"dwarka": 2, "other": 1}
    assert aud["profiles_total"] == 3
    blob = json.dumps(list(fake.items.values()))
    assert "lat" not in blob and "lon" not in blob


def test_journey_end_without_a_fix_never_drags_intake_to_zero():
    _journey(A1, saved=30.0)                                  # measured
    r = _post(A2, [{"event": "journey_end", "props": {
        "completed": True, "mode": "health_max", "vehicle": "car",
        "dose_ug": 0, "dose_saved_ug": 0, "km": 0, "minutes": 4}},
        {"event": "journey_end", "props": {
            "completed": False, "dose_ug": None, "dose_saved_ug": 25.0}}])
    assert r.json()["accepted"] == 2 and r.json()["dropped_fields"] == 0
    i = client.get(M + "/api/app").json()["intake"]["total"]
    assert i["reports"] == 1 and i["dose_reports"] == 1
    assert i["mean_saved_ug"] == 30.0 and i["mean_dose_ug"] == 120.0


def test_admin_page_has_the_audience_panel():
    html = open(os.path.join(_SERVER, "admin.html"), encoding="utf-8").read()
    assert 'id="s-who"' in html and "who uses alive" in html
    assert html.count('class="asof"') >= 7
    for need in ("renderWho(app)", "app.audience", "top_areas",
                 "age_bands", "profiles_total",
                 "no names, no locations — age group and area only, by choice",
                 "so far — counting since"):
        assert need in html, need


def test_telemetry_profile_contract():
    js = open(os.path.join(_SERVER, "webapp", "telemetry.js"),
              encoding="utf-8").read()
    assert "profile: ['age_band', 'area']" in js
    for band in ("'under13'", "'13-17'", "'18-29'", "'30-44'", "'45-59'",
                 "'60plus'"):
        assert band in js, band
    assert "st.get('tprof')" in js and "last.day === istDay()" in js
    # journey_end: no measured dose → neither dose field leaves the phone
    assert "!(out.dose_ug > 0)" in js
