"""Lane X (oct11): /v2/ac prefix type-ahead, load-time junk purge,
/v2/search budget + name-first ranking.

In-process only (FastAPI TestClient over the v2 search router) — no
network, no local server. Assertions are mechanism-level: they never
pin a Delhi place's coordinates; landmark checks only assert the name
the user typed comes back first.
"""
import asyncio
import os
import statistics
import sys
import time

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from v2 import search as v2search  # noqa: E402
from v2.gazetteer import (AC, _AIR_WORDS, hub_class,  # noqa: E402
                          hub_reclass, normalize)

_app = FastAPI()
_app.include_router(v2search.router, prefix="/v2")
client = TestClient(_app)

# test positions from the master plan (user bias only — never asserted)
SHAHDARA = (28.684, 77.300)
CP = (28.6315, 77.2167)
SONIPAT = (28.99, 77.02)


@pytest.fixture(scope="module", autouse=True)
def _index():
    assert AC.ensure(), AC.error
    yield


def _ac(q, pos=SHAHDARA, limit=10):
    r = client.get("/v2/ac", params={"q": q, "lat": pos[0], "lon": pos[1],
                                     "limit": limit})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ok"
    return body


# --- contract ----------------------------------------------------------------
def test_ac_contract_shape():
    body = _ac("isk")
    assert body["results"], body
    for row in body["results"]:
        for key in ("id", "name", "subtitle", "kind", "lat", "lon",
                    "distance_m", "match_rank"):
            assert key in row, (key, row)
        assert row["id"].startswith("gaz:")
        assert isinstance(row["distance_m"], int)
        assert "_" not in row["subtitle"], row  # no raw tags
    assert body["count"] == len(body["results"])
    assert isinstance(body["took_ms"], float)


def test_ac_rejects_empty_and_caps_limit():
    assert client.get("/v2/ac", params={"q": ""}).status_code == 422
    assert client.get("/v2/ac", params={"q": "a", "limit": 99}
                      ).status_code == 422
    body = client.get("/v2/ac", params={"q": "zzqxw"}).json()
    assert body["results"] == [] and body["status"] == "ok"


def test_ac_warming_is_honest_not_blocking(monkeypatch):
    monkeypatch.setattr(type(AC), "ready", property(lambda self: False))
    monkeypatch.setattr(AC, "warm_async", lambda: None)
    body = client.get("/v2/ac", params={"q": "isk"}).json()
    assert body == {**body, "results": [], "count": 0, "status": "warming"}


# --- prefix narrowing --------------------------------------------------------
def test_prefix_narrowing_isk():
    rows = _ac("isk")["results"]
    assert rows
    for row in rows:
        assert any(t.startswith("isk") for t in normalize(row["name"]).split()), row
    assert any("iskcon" in normalize(r["name"]) for r in rows[:3])


def test_each_keystroke_keeps_typed_prefix():
    q = "new delhi railway station"
    for i in range(3, len(q) + 1):
        part = q[:i]
        if part.endswith(" "):
            continue
        rows = _ac(part)["results"]
        assert rows, part
        toks = normalize(part).split()
        lead = toks[0]
        for row in rows:
            nt = normalize(row["name"]).split()
            ok = (any(t.startswith(lead) for t in nt) if len(toks) == 1
                  else lead in nt)
            assert ok, (part, row["name"])


def test_new_delhi_rail_first():
    rows = _ac("new delhi rail")["results"]
    top = normalize(rows[0]["name"])
    assert top.startswith("new delhi railway station") or \
        top.startswith("new delhi rail way station"), rows[0]
    assert hub_class(rows[0]["kind"]) == "rail"
    # the top row is a corroborated copy — not one the purge flagged
    key = (tuple(top.split()), round(rows[0]["lat"], 3),
           round(rows[0]["lon"], 3))
    assert key not in AC.junk_keys


def test_kind_word_never_hijacks_the_name():
    # 'bakery' may boost categories, never pick a row without 'pawan'
    for q in ("pawan bakery", "pawan bak"):
        rows = _ac(q)["results"]
        for row in rows:
            assert "pawan" in normalize(row["name"]).split(), (q, row)


def test_context_words_do_not_make_results_jump():
    base = _ac("iskcon")["results"]
    assert "iskcon" in normalize(base[0]["name"]).split()
    rows = _ac("iskcon east of kailash")["results"]
    assert rows
    top = normalize(rows[0]["name"]).split()
    assert top[0] == "iskcon", rows[0]


def test_alias_forms_type_ahead():
    rows = _ac("cp", pos=CP)["results"]
    assert any("connaught place" in normalize(r["name"]) for r in rows[:3])


# --- landmarks unchanged -----------------------------------------------------
@pytest.mark.parametrize("typed,expect", [
    ("india g", "india gate"),
    ("india gate", "india gate"),
    ("red fort", "red fort"),
    ("lotus temple", "lotus temple"),
    ("akshardham", "akshardham"),
    ("jama masjid", "jama masjid"),
])
def test_landmarks_first(typed, expect):
    for pos in (SHAHDARA, CP):
        rows = _ac(typed, pos=pos)["results"]
        assert normalize(rows[0]["name"]).startswith(expect), (typed, pos, rows[:3])


# --- junk purge --------------------------------------------------------------
def test_purge_counts_logged():
    s = AC.stats
    assert s["dropped_far_named_hubs"] >= 20, s
    assert s["reclassified_hub_mismatch"] >= 20, s
    assert s["dropped_exact_duplicates"] >= 1, s
    assert s["rows_indexed"] > 200_000, s


def test_far_named_hubs_never_surface():
    # a dropped row (name + spot) can never come back; a same-named
    # row at its real place may ('Jewar Airport' near Jewar stays)
    for name in AC.stats["far_examples"]:
        toks = normalize(name).split()
        for q in (" ".join(toks[:2]), " ".join(toks)):
            for row in _ac(q, limit=20)["results"]:
                key = (tuple(normalize(row["name"]).split()),
                       round(row["lat"], 3), round(row["lon"], 3))
                assert key not in AC.junk_keys, (q, row)
    # names that only name places abroad: no hub row at all
    for q in ("zurich", "heathrow", "london airport", "dubai airport",
              "switzerland"):
        for row in _ac(q, limit=20)["results"]:
            assert hub_class(row["kind"]) is None, (q, row)


def test_airport_rows_are_airports():
    for q in ("airport", "air", "gurgaon", "epson", "fedex"):
        for row in _ac(q, limit=20)["results"]:
            if hub_class(row["kind"]) == "air":
                toks = set(normalize(row["name"]).split())
                assert toks & _AIR_WORDS or "air" in toks, row


def test_far_station_near_cp_is_gone():
    # mechanism, not a list: every rail/air hub row in the index whose
    # name names a far place must have local evidence
    bad = []
    for rid in range(len(AC.names)):
        if hub_class(AC.kinds[rid]) is None or \
                not isinstance(AC.idx[rid], int):   # gazetteer rows
            continue
        if AC._far_verdict(list(AC.toks[rid]), AC.lat[rid], AC.lon[rid]):
            bad.append(AC.names[rid])
    assert not bad, bad[:10]


def test_hub_reclass_helper():
    assert hub_reclass("EPSON CERTIFIED CHANNEL PARTNER - X", "airport") == "business"
    assert hub_reclass("Indira Gandhi International Airport", "airport") is None
    assert hub_reclass("Bahadurgarh", "train_station") is None  # bare names stay


# --- outskirts ---------------------------------------------------------------
def test_outskirts_towns_type_ahead():
    # the gazetteer stops at 29.07N / 76.6E; GeoNames rows fill the ring
    assert AC.stats["outskirts_rows_added"] > 1000, AC.stats
    for town in ("panipat", "rohtak", "rewari", "meerut", "sonipat",
                 "palwal", "hapur", "bulandshahr"):
        rows = _ac(town, pos=SONIPAT)["results"]
        assert rows and normalize(rows[0]["name"]).startswith(town), (town, rows[:2])


def test_geo_ids_resolve():
    from v2 import places as v2places
    app = FastAPI()
    app.include_router(v2places.router, prefix="/v2")
    c = TestClient(app)
    rows = _ac("panipat", pos=SONIPAT)["results"]
    geo = [r for r in rows if r["id"].startswith("geo:")]
    assert geo, rows
    body = c.get(f"/v2/place/{geo[0]['id']}").json()
    assert body["name"] == geo[0]["name"] and body["lat"] == geo[0]["lat"]
    assert c.get("/v2/place/geo:0").status_code == 404


# --- latency budget ----------------------------------------------------------
def test_keystroke_latency_budget():
    queries = ["Pawan Bakery C block Hanuman Mandir Ashok Nagar Shahdara",
               "ISKCON Delhi East of Kailash", "Neelanchal Dham Sant Nagar",
               "new delhi railway station", "jama masjid shahdara",
               "sector 62 noida", "india gate", "delhi s", "s", "a"]
    # best of two passes per keystroke: the box is shared with other
    # lanes' servers, a single pass measures their load, not ours
    times = []
    for q in queries:
        for i in range(1, len(q) + 1):
            part = q[:i]
            if not part.strip():
                continue
            for pos in (SHAHDARA, SONIPAT):
                best = 9e9
                for _ in range(2):
                    t = time.perf_counter()
                    AC.query(part, pos[0], pos[1], 10)
                    best = min(best, (time.perf_counter() - t) * 1000.0)
                times.append(best)
    times.sort()
    p50 = statistics.median(times)
    p95 = times[int(len(times) * 0.95)]
    worst = times[-1]
    print(f"ac keystrokes n={len(times)} p50={p50:.2f}ms "
          f"p95={p95:.2f}ms max={worst:.2f}ms")
    assert p95 < 30.0, (p50, p95, worst)
    assert worst < 120.0, (p50, p95, worst)


# --- /v2/search: budget, junk filter, name-first -------------------------------
def _fake_t1(rows):
    def _raw(q, lat=None, lon=None, limit=8):
        return [dict(r) for r in rows]
    return _raw


def test_search_budget_caps_deep_pass(monkeypatch):
    async def slow_arm(*a, **kw):
        await asyncio.sleep(5.0)
        return [], [], "ok"
    monkeypatch.setattr(v2search, "_t1_raw", _fake_t1([]))
    # warm the local anchor structures first (prod warms them at boot)
    monkeypatch.setenv("V2_OVERPASS", "off")
    client.get("/v2/search", params={"q": "zzqx yyqv wwqz"})
    monkeypatch.setattr(v2search, "_overpass_arm", slow_arm)
    monkeypatch.setenv("V2_OVERPASS", "on")
    t = time.perf_counter()
    r = client.get("/v2/search", params={"q": "zzqx yyqv wwqz",
                                         "lat": SHAHDARA[0],
                                         "lon": SHAHDARA[1]})
    dt = time.perf_counter() - t
    assert r.status_code == 200
    body = r.json()
    assert dt < 2.2, dt
    assert body["t3_status"] in ("timeout:budget", "skipped:budget", None,
                                 "no-probe"), body["t3_status"]


def test_search_drops_far_named_hub_rows(monkeypatch):
    rows = [
        {"name": "Heathrow International Airport London", "category": "airport",
         "lat": CP[0] - 0.12, "lon": CP[1] - 0.05, "id": "gaz:1"},
        {"name": "EPSON CERTIFIED CHANNEL PARTNER - Test", "category": "airport",
         "lat": CP[0], "lon": CP[1], "id": "gaz:2"},
        {"name": "Connaught Place", "category": "locality",
         "lat": CP[0], "lon": CP[1], "id": "gaz:3"},
    ]
    monkeypatch.setattr(v2search, "_t1_raw", _fake_t1(rows))
    monkeypatch.setenv("V2_OVERPASS", "off")
    body = client.get("/v2/search", params={"q": "heathrow",
                                            "lat": CP[0], "lon": CP[1]}).json()
    names = [r["name"] for r in body["results"]]
    assert "Heathrow International Airport London" not in names
    for r in body["results"]:
        if r["name"].startswith("EPSON"):
            assert r["kind"] == "business"


def test_search_name_first(monkeypatch):
    rows = [
        {"name": "Amar Bakery", "category": "bakery",
         "lat": SHAHDARA[0] + 0.001, "lon": SHAHDARA[1], "id": "gaz:11"},
        {"name": "Pandit Bakery", "category": "bakery",
         "lat": SHAHDARA[0] + 0.002, "lon": SHAHDARA[1], "id": "gaz:12"},
        {"name": "Pawan Sweets", "category": "bakery",
         "lat": SHAHDARA[0] + 0.003, "lon": SHAHDARA[1], "id": "gaz:13"},
    ]
    monkeypatch.setattr(v2search, "_t1_raw", _fake_t1(rows))
    monkeypatch.setenv("V2_OVERPASS", "off")
    body = client.get("/v2/search", params={"q": "pawan bakery",
                                            "lat": SHAHDARA[0],
                                            "lon": SHAHDARA[1]}).json()
    assert body["results"], body
    assert "pawan" in normalize(body["results"][0]["name"]).split(), \
        [r["name"] for r in body["results"]]
