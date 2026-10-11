"""T3 Overpass arm — the mirror race (deeppass lane).

Each distinct probe QL races every endpoint in _OVERPASS_ENDPOINTS at
once inside the shared fuse; the first definitive answer (ok or empty)
wins and the losers are cancelled. These tests stub the transport seam
(_op_post_one / deps.http) so they measure the arm's scheduling, never
this box's WAN path.
"""
import asyncio
import time

from v2 import search


EPS = ("ep-a", "ep-b", "ep-c")


def _eps(monkeypatch):
    monkeypatch.setattr(search, "_OVERPASS_ENDPOINTS", EPS)


def _runner(monkeypatch, profile):
    """profile: ep -> (status, latency_s, elements). Returns a fake
    _op_post_one honouring cancellation like the real one."""
    calls = []

    async def fake(ql, ep, deadline):
        st, lat, els = profile[ep]
        try:
            await asyncio.sleep(lat)
        except asyncio.CancelledError:
            calls.append((ep, "cancelled"))
            raise
        calls.append((ep, st))
        return els, st
    return fake, calls


class _Resp:
    def __init__(self, elements, status=200):
        self.status_code = status
        self._elements = elements

    def json(self):
        return {"elements": self._elements}


class _HTTP:
    is_closed = False

    def __init__(self, profile):
        self.profile = profile
        self.calls = []

    async def post(self, ep, data=None, headers=None, timeout=None):
        st, lat = self.profile[ep]
        try:
            await asyncio.sleep(lat)
        except asyncio.CancelledError:
            self.calls.append((ep, "cancelled"))
            raise
        self.calls.append((ep, st))
        if st == "error":
            return _Resp([], status=500)
        return _Resp([{"type": "node", "id": abs(hash(data["data"])) % 10**6,
                       "lat": 28.674, "lon": 77.418,
                       "tags": {"name": "probe hit", "amenity": "cafe"}}],
                     status=200)


def test_race_first_definitive_wins(monkeypatch):
    """A 100ms mirror beats a 900ms one — the race resolves at the
    fast one's latency and the slow one is cancelled."""
    _eps(monkeypatch)
    fake, calls = _runner(monkeypatch, {
        "ep-a": ("ok", 0.90, [{"id": 1}]),
        "ep-b": ("ok", 0.10, [{"id": 2}]),
        "ep-c": ("ok", 0.60, [{"id": 3}]),
    })
    monkeypatch.setattr(search, "_op_post_one", fake)
    dl = time.monotonic() + 3.0
    t0 = time.monotonic()
    els, st = asyncio.run(search._op_race("[out:json];", dl))
    dt = time.monotonic() - t0
    assert st == "ok" and els == [{"id": 2}]
    assert dt < 0.5, f"race paid {dt * 1000:.0f}ms — wait-all semantics?"
    asyncio.run(asyncio.sleep(0.01))  # let cancellations land
    assert (EPS[0], "cancelled") in calls or (EPS[2], "cancelled") in calls


def test_race_error_drops_out_others_finish(monkeypatch):
    """A 500ing mirror is out of its own race — the healthy mirror still
    answers inside the same fuse."""
    _eps(monkeypatch)
    fake, calls = _runner(monkeypatch, {
        "ep-a": ("error", 0.02, []),
        "ep-b": ("error", 0.03, []),
        "ep-c": ("ok", 0.25, [{"id": 9}]),
    })
    monkeypatch.setattr(search, "_op_post_one", fake)
    els, st = asyncio.run(search._op_race("[out:json];",
                                        time.monotonic() + 3.0))
    assert (st, els) == ("ok", [{"id": 9}])


def test_race_empty_is_definitive(monkeypatch):
    """'empty' is a real answer, not a failure: the fastest mirror's
    200 ends the race even with siblings still in flight."""
    _eps(monkeypatch)
    fake, calls = _runner(monkeypatch, {
        "ep-a": ("empty", 0.05, []),
        "ep-b": ("ok", 0.80, [{"id": 1}]),
        "ep-c": ("ok", 0.80, [{"id": 1}]),
    })
    monkeypatch.setattr(search, "_op_post_one", fake)
    t0 = time.monotonic()
    els, st = asyncio.run(search._op_race("[out:json];",
                                        time.monotonic() + 3.0))
    assert st == "empty" and els == []
    assert time.monotonic() - t0 < 0.5


def test_race_fuse_caps_all_hang(monkeypatch):
    """Every mirror hung -> the fuse is the whole cap, and the losers
    are all cancelled, never leaked."""
    _eps(monkeypatch)
    fake, calls = _runner(monkeypatch, {
        "ep-a": ("error", 9.0, []),
        "ep-b": ("error", 9.0, []),
        "ep-c": ("error", 9.0, []),
    })
    monkeypatch.setattr(search, "_op_post_one", fake)
    t0 = time.monotonic()
    els, st = asyncio.run(search._op_race("[out:json];",
                                        time.monotonic() + 0.6))
    dt = time.monotonic() - t0
    assert st == "timeout" and els == []
    assert dt < 1.5, f"fuse breached: {dt * 1000:.0f}ms"
    asyncio.run(asyncio.sleep(0.01))
    assert calls.count(("ep-a", "cancelled")) == 1
    assert calls.count(("ep-b", "cancelled")) == 1
    assert calls.count(("ep-c", "cancelled")) == 1


def test_remarked_empty_is_not_definitive(monkeypatch):
    """A mirror that 200s an empty set WITH a runtime remark (its query
    timed out) is degraded, not a real negative — a slower healthy
    mirror still gets to answer."""

    class _HTTPRemark(_HTTP):
        async def post(self, ep, data=None, headers=None, timeout=None):
            if ep == "ep-a":
                await asyncio.sleep(0.02)
                class R(_Resp):
                    def json(self):
                        return {"elements": [],
                                "remark": "runtime error: timed out"}
                return R([], status=200)
            await asyncio.sleep(0.15)
            return _Resp([{"type": "node", "id": 7, "lat": 28.674,
                           "lon": 77.418,
                           "tags": {"name": "real hit",
                                    "amenity": "cafe"}}], status=200)

    _eps(monkeypatch)
    monkeypatch.setattr(search.deps, "_http", _HTTPRemark({}))
    els, st = asyncio.run(search._op_post_one(
        "[out:json];", "ep-a", time.monotonic() + 3.0))
    assert st == "error"          # degraded, not 'empty'
    els, st = asyncio.run(search._op_race("[out:json];",
                                        time.monotonic() + 3.0))
    assert st == "ok" and els and els[0]["id"] == 7


def test_arm_merges_across_queries_with_fast_mirror(monkeypatch):
    """End-to-end arm: one fast mirror + two dead ones — live rows come
    back at the fast mirror's latency, schema unchanged, cache fills."""
    _eps(monkeypatch)
    http = _HTTP({"ep-a": ("error", 0.02), "ep-b": ("ok", 0.20),
                  "ep-c": ("error", 0.03)})
    monkeypatch.setattr(search.deps, "_http", http)
    search._OP_CACHE.clear()
    presolved = ([{"name": "ashok nagar", "lat": 28.6737,
                   "lon": 77.4178}], {6, 7, 8})
    qn = "pawan bakery c block hanuman mandir ashok nagar shahdara"
    t0 = time.monotonic()
    rows, gaz, status = asyncio.run(search._overpass_arm(
        "pawan bakery c block hanuman mandir ashok nagar shahdara",
        qn, 28.6692, 77.4312, 6, presolved))
    dt = time.monotonic() - t0
    assert status == "ok"
    assert dt < 1.0, f"arm paid {dt * 1000:.0f}ms with a 200ms mirror up"
    assert rows, "fast mirror's elements never surfaced"
    for r in rows:
        assert {"id", "name", "lat", "lon", "kind", "match",
                "sources"} <= set(r)
        assert r["sources"] == ["t3"]
    # 45s cache: a second identical call must not re-probe
    n_calls = len(http.calls)
    rows2, _, status2 = asyncio.run(search._overpass_arm(
        "pawan bakery c block hanuman mandir ashok nagar shahdara",
        qn, 28.6692, 77.4312, 6, presolved))
    assert status2 == "ok" and [r["id"] for r in rows2] == \
        [r["id"] for r in rows]
    assert len(http.calls) == n_calls
