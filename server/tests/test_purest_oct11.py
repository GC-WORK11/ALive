"""Oct-11 purest lane: /v2/purest (solid-data places near you), the
/v2/stays pick + spread pool, and the /v2/playtime advice regression
('kids outdoors: before ~06:30' while 06:30 was the day's peak).

Offline: FIELD is seeded with samples + a named live instrument,
FORECAST with a synthetic horizon (same pattern as test_v2_explore).
"""
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
from airfield import FIELD  # noqa: E402
from forecast import FORECAST  # noqa: E402
from v2 import city, deps, explore  # noqa: E402
from v2.day import summarize_day  # noqa: E402

client = TestClient(main.app, raise_server_exceptions=False)

CP = (28.6315, 77.2167)
SAMPLES = [
    (28.6315, 77.2167, "test-station", {"pm2_5": 150.0}),
    (28.6519, 77.1907, None, {"pm2_5": 185.0}),
    (28.5850, 77.2300, None, {"pm2_5": 120.0}),
    (28.7000, 77.2000, None, {"pm2_5": 210.0}),
]


def _seed_forecast(vals):
    t0 = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0,
                                            microsecond=0)
    times = [(t0 + timedelta(hours=i)).isoformat() for i in range(len(vals))]
    FORECAST._aq = [{"lat": CP[0], "lon": CP[1], "name": None, "t0": t0,
                     "times": times, "vars": {"pm2_5": list(vals)}}]
    FORECAST._met = []
    FORECAST._fetched_at = time.time()


@pytest.fixture(autouse=True)
def wired(monkeypatch):
    FIELD._samples = list(SAMPLES)
    FIELD._fetched_at = time.time()
    FIELD._station_count = 1
    FIELD._source = "test"
    FIELD._snap = None
    FIELD._snap_centers = []
    monkeypatch.setattr(FIELD, "_stations_live",
                        [(28.6315, 77.2167, "test-station"),
                         (28.5850, 77.2300, "test-south")], raising=False)
    vals = [150.0] * 120
    for i in range(30, 40):
        vals[i] = 60.0
    _seed_forecast(vals)

    async def _noop(*a, **k):
        return None
    monkeypatch.setattr(deps, "field_refresh", _noop)
    monkeypatch.setattr(FIELD, "refresh", _noop)
    monkeypatch.setattr(FORECAST, "refresh", _noop)
    monkeypatch.setattr(main.FIRES, "refresh", _noop)
    explore._EXPLORE_CACHE._d.clear()
    city._PUREST_CACHE.clear()
    city._DIST_CACHE = None
    yield
    FORECAST._fetched_at = 0.0


# ------------------------------------------------------ playtime advice
def _hours(labels_vals, start_day=0, roll_at="00:30"):
    """hour rows shaped like /v2/playtime's (h, ist_label, pm25_mid,
    band, day_offset) — the day offset rolls at IST midnight."""
    out, day = [], start_day
    for h, (lab, v) in enumerate(labels_vals):
        if h and lab == roll_at:
            day += 1
        out.append({"h": h, "ist_label": lab, "pm25_mid": float(v),
                    "band": "Moderate", "day_offset": day, "start": None})
    return out


def _fold(hours):
    fold = summarize_day(hours)
    by_h = {r["h"]: r for r in hours}
    for k in ("cleanest_window", "heavy_window"):
        w = fold.get(k)
        if w:
            st = by_h[w["start_h"]]
            w["start_day_offset"] = st["day_offset"]
    return fold


def _demo_bug_curve():
    """The recorded CP case: horizon 13:30 today -> 12:30 tomorrow,
    clean 13:30-20:30, rising overnight to a 06:30 peak (~104)."""
    labels = [f"{(13 + i) % 24:02d}:30" for i in range(24)]
    vals = [40, 38, 37, 36, 37, 39, 41, 48,      # 13:30-20:30 clean
            60, 66, 72, 78, 82, 86, 90, 94, 98,  # 21:30-05:30 rising
            104, 100, 97, 95, 94, 92, 91]        # 06:30 peak, heavy on
    return _hours(list(zip(labels, vals)))


def test_play_decisions_point_at_cleanest_window_not_before_peak():
    hours = _demo_bug_curve()
    fold = _fold(hours)
    best, worst = fold["cleanest_window"], fold["heavy_window"]
    assert best is not None and worst is not None
    assert best["start_label"] == "13:30"
    ds = explore.play_decisions(hours, best, worst, fold["day_mean"],
                                flat=False)
    go = [d for d in ds if not d.get("avoid")]
    assert {d["label"] for d in go} >= {"outdoor exercise", "kids outdoors"}
    peak_h = max(hours, key=lambda r: r["pm25_mid"])["h"]
    for d in go:
        assert "before" not in d["line"]
        assert d["line"].startswith("13:30-")
        assert worst["start_label"] not in d["line"]
        # the recommended span IS the cleanest window, and never touches
        # the heavy run, the peak, or the hour just before it
        assert (d["start_h"], d["end_h"]) == (best["start_h"], best["end_h"])
        assert d["end_h"] < worst["start_h"] - 1
        assert not (d["start_h"] <= peak_h <= d["end_h"])
        assert not (d["start_h"] <= peak_h - 1 <= d["end_h"])
    avoid = [d for d in ds if d.get("avoid")]
    assert avoid and "06:30" in avoid[0]["line"] or \
        worst["start_label"] in avoid[0]["line"]


def test_play_decisions_no_window_uses_lightest_hour():
    labels = [f"{(16 + i) % 24:02d}:30" for i in range(24)]
    # jagged, no >=2 h run clears the clean threshold except the min
    vals = [80, 60, 82, 61, 85, 62, 88, 63, 90, 64, 92, 65,
            94, 66, 96, 67, 98, 68, 99, 69, 100, 70, 101, 59]
    hours = _hours(list(zip(labels, vals)))
    ds = explore.play_decisions(hours, None, None, 80.0, flat=False)
    lo = min(hours, key=lambda r: r["pm25_mid"])
    for d in ds:
        assert lo["ist_label"] in d["line"]
        assert d["start_h"] == lo["h"]


def test_playtime_endpoint_decisions_follow_best_window():
    d = client.get("/v2/playtime", params={"lat": CP[0], "lon": CP[1]}).json()
    assert d["served_h"] >= 20
    best, worst = d["best_window"], d["worst_window"]
    assert best is not None
    by_h = {h["h"]: h["pm25_mid"] for h in d["hours"]}
    peak_h = max(by_h, key=by_h.get)
    for dec in d["decisions"]:
        if dec.get("avoid"):
            continue
        assert "before" not in dec["line"]
        assert best["start_label"] in dec["line"]
        assert (dec["start_h"], dec["end_h"]) == (best["start_h"],
                                                  best["end_h"])
        assert not (dec["start_h"] <= peak_h <= dec["end_h"])
        if worst is not None:
            assert dec["end_h"] < worst["start_h"] or \
                dec["start_h"] > (worst["end_h"] or 10 ** 6)


# ------------------------------------------------------------- purest
class _FakeField:
    """value() rises west->east; a monitor only near CP + Lodhi Rd."""
    stations = [(28.6315, 77.2167), (28.5918, 77.2273)]

    def value(self, lat, lon, param="pm2_5"):
        return 40.0 + (lon - 77.0) * 100.0 + (lat - 28.5) * 10.0

    def nearest_station_km(self, lat, lon):
        import math
        return min(math.hypot((a - lat) * 111.0, (b - lon) * 97.6)
                   for a, b in self.stations)

    def beyond_field_edge(self, lat, lon):
        return not (76.85 <= lon <= 77.75 and 28.25 <= lat <= 28.85)


NAMES = [
    # (lat, lon, name, kind, pop)
    (28.5931, 77.2197, "Lodhi Garden", "park", 0.9),
    (28.5965, 77.1859, "Chanakyapuri", "area", 0.9),
    (28.6328, 77.2197, "Connaught Place", "area", 0.9),
    (28.6129, 77.2295, "India Gate Lawns Park", "park", 0.9),
    (28.6840, 77.3000, "Ashok Nagar", "area", 0.9),          # no monitor
    (28.9800, 77.7000, "Meerut Cantt", "area", 0.9),         # beyond edge
]


def _rows(partial=()):
    import districts as _d
    out = []
    for d in _d._districts():
        out.append({"name": d["name"], "confidence": "field",
                    "partial_field_coverage": d["name"] in partial})
    return out


def test_purest_only_solid_places_ranked_cleanest_first():
    F = _FakeField()
    out = city.purest_places(F, _rows(), CP[0], CP[1], 15.0, k=8,
                             names=NAMES)
    names = [p["name"] for p in out["places"]]
    assert names, out
    assert "Ashok Nagar" not in names            # no monitor within 6 km
    assert "Meerut Cantt" not in names           # outside radius / edge
    pms = [round(p["pm25"]) for p in out["places"]]
    assert pms == sorted(pms)          # ties to the µg go to the closer
    assert out["pick"] and out["pick"]["index"] == 0
    assert "right now" in out["pick"]["why"]
    assert len(out["pick"]["why"].split()) <= 8
    for p in out["places"]:
        assert p["dist_km"] <= 15.0
        assert p["nearest_station_km"] <= city.PUREST_SOLID_KM
        assert p["basis"] == "now"
        assert p["aqi"] is not None and p["color"].startswith("#")
    assert out["excluded"]["thin_data"] >= 1


def test_purest_partial_area_is_excluded():
    import districts as _d
    F = _FakeField()
    a = _d.area_for_point(77.1859, 28.5965)    # Chanakyapuri's area
    assert a is not None
    out = city.purest_places(F, _rows(partial=(a["name"],)), CP[0], CP[1],
                             15.0, k=8, names=NAMES)
    assert "Chanakyapuri" not in [p["name"] for p in out["places"]]
    assert out["excluded"]["partial_area"] >= 1


def test_purest_endpoint_shape_and_honest_empty():
    r = client.get("/v2/purest", params={"lat": CP[0], "lon": CP[1]})
    assert r.status_code == 200
    d = r.json()
    assert d["scope"] == "near" and d["radius_km"] == 15.0
    assert isinstance(d["places"], list)
    for p in d["places"]:
        assert p["nearest_station_km"] <= city.PUREST_SOLID_KM
        assert p["dist_km"] <= 15.0
    if d["places"]:
        assert d["pick"]["index"] == 0
    else:
        assert d["pick"] is None
    # out of area: honest error, never a centre-of-Delhi guess
    d2 = client.get("/v2/purest", params={"lat": 19.07, "lon": 72.87}).json()
    assert d2["places"] == [] and "service area" in d2["error"]
    # NCR-wide on request
    d3 = client.get("/v2/purest", params={"lat": CP[0], "lon": CP[1],
                                          "scope": "ncr"}).json()
    assert d3["scope"] == "ncr" and d3["radius_km"] is None


def test_districts_still_serves_after_refactor():
    d = client.get("/v2/districts").json()
    assert d["districts"] and "cached_s" in d
    assert {"partial_field_coverage", "confidence"} <= set(d["districts"][0])


# --------------------------------------------------------------- stays
def test_stays_pick_on_top_spread_and_deduped():
    d = client.get("/v2/stays", params={"lat": CP[0], "lon": CP[1],
                                        "k": 8}).json()
    stays = d["stays"]
    assert stays
    picks = [s for s in stays if s.get("pick")]
    assert len(picks) <= 1
    if picks:
        assert stays[0].get("pick") is True
        assert not stays[0]["sparse"]
        assert stays[0]["scored_on"] == "next24h"
        assert len(stays[0]["why"].split()) <= 8
    norm = [explore._norm_name(s["name"]) for s in stays]
    assert len(norm) == len(set(norm))
    # pool stays inside the spread radius (contract keys unchanged)
    assert all(x["dist_km"] <= explore._STAY_RADIUS_KM + 0.1 for x in stays)


def test_stay_pool_spreads_beyond_one_block():
    rows = [{"lat": CP[0] + i * 1e-5, "lon": CP[1], "name": f"H{i}",
             "kind": "hotel"} for i in range(60)]
    rows += [{"lat": CP[0] + 0.012 * j, "lon": CP[1] + 0.01, "name": f"F{j}",
              "kind": "hotel"} for j in range(1, 4)]
    pool = explore._stay_pool(rows, CP[0], CP[1], 5.0)
    names = [r["name"] for r in pool]
    # the block may straddle one bucket edge — at most one extra roof
    assert sum(n.startswith("H") for n in names) <= explore._STAY_NEAREST + 1
    assert {"F1", "F2", "F3"} <= set(names)
