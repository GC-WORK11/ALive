"""Offline tests for /v2/p/* (server/v2/providers.py) — every upstream is an
httpx.MockTransport, no network, no keys.

The module is loaded straight from its file so a half-edited sibling v2
module (11 lanes share this tree) can never break these tests.
"""
import asyncio
import importlib.util
import json
import math
import os
import sys

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

_SERVER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location(
    "alive_providers_under_test", os.path.join(_SERVER, "v2", "providers.py"))
P = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = P
_spec.loader.exec_module(P)

KEYS = {"OLA_API_KEY": "OLA-SECRET-123", "MAPPLS_API_KEY": "MAPPLS-SECRET-456",
        "TOMTOM_API_KEY": "TOMTOM-SECRET-789"}
CONTRACT_KEYS = {"id", "name", "sub", "lat", "lon", "kind", "source", "distance_m"}


class Upstream:
    """Routes mocked upstream calls by host+path; records every request."""

    def __init__(self, routes):
        self.routes = routes
        self.calls = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.calls.append(request)
        for (host, path_part), fn in self.routes.items():
            if request.url.host == host and path_part in request.url.path:
                out = fn(request)
                if isinstance(out, httpx.Response):
                    return out
                return httpx.Response(200, json=out)
        raise AssertionError(f"unexpected upstream call {request.url.host}{request.url.path}")


def _app():
    app = FastAPI()
    app.include_router(P.router, prefix="/v2")
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    for k in KEYS:
        monkeypatch.delenv(k, raising=False)
    P.clear_caches()
    yield
    P.clear_caches()


def _mock(routes):
    up = Upstream(routes)
    P.set_transport(httpx.MockTransport(up))
    return up


def _no_secrets(resp_text: str):
    for v in KEYS.values():
        assert v not in resp_text


# ------------------------------------------------------------ configured:false
def test_unconfigured_every_endpoint_answers_honestly():
    up = _mock({})            # any outbound call would raise
    c = _app()
    for url in ("/v2/p/ac?q=connaught&lat=28.63&lon=77.21",
                "/v2/p/geocode?address=237%20okhla%20phase%203",
                "/v2/p/reverse?lat=28.63&lon=77.21",
                "/v2/p/nearby?lat=28.63&lon=77.21&kind=lodging&radius_m=2000",
                "/v2/p/incidents?bbox=77.1,28.5,77.3,28.7"):
        r = c.get(url)
        assert r.status_code == 200, url
        assert r.json() == {"results": [], "configured": False}, url
    r = c.post("/v2/p/route_traffic", json={"coords": [[28.63, 77.21], [28.64, 77.22]]})
    assert r.status_code == 200 and r.json() == {"results": [], "configured": False}
    r = c.get("/v2/p/flow_tile/11/1462/843.png")
    assert r.status_code == 204 and r.headers["x-alive-provider"] == "unconfigured"
    st = c.get("/v2/p/status")
    body = st.json()
    assert {k: body[k] for k in ("ola", "mappls", "tomtom", "configured")} == {
        "ola": False, "mappls": False, "tomtom": False, "configured": False}
    assert st.headers["cache-control"] == "no-store"
    assert body["budget"]["apis"]["ola:autocomplete"] == {"used": 0, "cap": 3000, "denied": 0}
    assert up.calls == []
    assert asyncio.run(P.traffic_for_route([[28.63, 77.21], [28.64, 77.22]])) is None


# ------------------------------------------------------------ autocomplete merge
def _ola_pred(pid, main, sub, lat, lng, dist=None, types=("establishment",)):
    p = {"place_id": pid, "description": f"{main}, {sub}",
         "structured_formatting": {"main_text": main, "secondary_text": sub},
         "geometry": {"location": {"lat": lat, "lng": lng}}, "types": list(types)}
    if dist is not None:
        p["distance_meters"] = dist
    return p


def test_ac_merges_ola_and_mappls_dedups_and_resolves(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.setenv("MAPPLS_API_KEY", KEYS["MAPPLS_API_KEY"])

    def ola_ac(req):
        return {"status": "ok", "predictions": [
            _ola_pred("ola-platform:1", "Pawan Bakery",
                      "C Block, Ashok Nagar, Shahdara, Delhi, 110093, India",
                      28.68412, 77.30051, 420),
            _ola_pred("ola-platform:2", "Pawan Bakery Point",
                      "Sector 18, Noida, Uttar Pradesh, 201301, India",
                      28.5703, 77.3219, 13000),
        ]}

    def mappls_ac(req):
        return {"suggestedLocations": [
            # same shop as Ola #1, ~25 m off -> must collapse into one
            {"eLoc": "ABC123", "placeName": "Pawan Bakery", "type": "POI",
             "placeAddress": "C Block, Ashok Nagar, Shahdara, Delhi, 110093",
             "latitude": 28.68430, "longitude": 77.30060, "distance": 440},
            # generic key: coordinates withheld -> resolved via Ola geocode
            {"eLoc": "XYZ789", "placeName": "Pawan Bakers & Confectioners",
             "type": "POI", "placeAddress": "Hanuman Mandir Road, Ashok Nagar, Delhi",
             "latitude": "RESTRICTED", "longitude": "RESTRICTED", "distance": 600},
        ]}

    def ola_geo(req):
        assert "Pawan Bakers" in req.url.params["address"]
        return {"status": "ok", "geocodingResults": [{
            "formatted_address": "Hanuman Mandir Road, Ashok Nagar, Delhi 110093, India",
            "geometry": {"location": {"lat": 28.6855, "lng": 77.3020}},
            "place_id": "ola-platform:g1", "types": ["establishment"]}]}

    up = _mock({("api.olamaps.io", "/places/v1/autocomplete"): ola_ac,
                ("api.olamaps.io", "/places/v1/geocode"): ola_geo,
                ("search.mappls.com", "/places/autosuggest/json"): mappls_ac})
    # >= 3 tokens -> Mappls runs in parallel with Ola
    r = _app().get("/v2/p/ac", params={"q": "pawan bakery ashok", "lat": 28.684, "lon": 77.300})
    assert r.status_code == 200
    assert r.headers["cache-control"] == "public, max-age=600, s-maxage=600"
    body = r.json()
    _no_secrets(r.text)
    res = body["results"]
    names = [x["name"] for x in res]
    assert names.count("Pawan Bakery") == 1, names
    assert "Pawan Bakers & Confectioners" in names
    assert "Pawan Bakery Point" in names
    for x in res:
        assert CONTRACT_KEYS <= set(x), x
        assert set(x) - CONTRACT_KEYS <= {"coord_src"}, x
        assert isinstance(x["lat"], float) and isinstance(x["lon"], float)
        assert "India" not in x["sub"] and "110093" not in x["sub"], x["sub"]
    first = res[0]
    assert first["name"] == "Pawan Bakery" and first["source"] == "ola"
    assert first["sub"] == "C Block, Ashok Nagar, Shahdara, Delhi"
    resolved = next(x for x in res if x["name"] == "Pawan Bakers & Confectioners")
    assert resolved["source"] == "mappls" and resolved["coord_src"] == "ola_geocode"
    assert resolved["id"] == "mappls:XYZ789"
    # NCR bias: the user's 2-dp cell reached both providers
    ola_req = next(c for c in up.calls if "/autocomplete" in c.url.path)
    map_req = next(c for c in up.calls if "/autosuggest/" in c.url.path)
    assert ola_req.url.params["location"] == "28.68000,77.30000"
    assert map_req.url.params["location"] == "28.68000,77.30000"
    assert ola_req.url.params["api_key"] == KEYS["OLA_API_KEY"]
    assert map_req.url.params["access_token"] == KEYS["MAPPLS_API_KEY"]
    # the Ola twin of Mappls' "Pawan Bakery" was not bridged (budget saver)
    geo_addrs = [c.url.params["address"] for c in up.calls if "/geocode" in c.url.path]
    assert geo_addrs == ["Pawan Bakers & Confectioners, Hanuman Mandir Road, Ashok Nagar, Delhi"]
    # cached: a second identical query makes no new upstream call
    n = len(up.calls)
    assert _app().get("/v2/p/ac", params={"q": "pawan bakery ashok", "lat": 28.684,
                                          "lon": 77.300}).json() == body
    assert len(up.calls) == n
    # near-identical (same 2-dp cell, other spelling/case) shares the entry;
    # distance_m is re-measured from the caller's own point
    other = _app().get("/v2/p/ac", params={"q": "  Pawan  BAKERY ashok ", "lat": 28.6812,
                                           "lon": 77.2981}).json()
    assert len(up.calls) == n
    assert [x["id"] for x in other["results"]] == [x["id"] for x in body["results"]]
    top = other["results"][0]
    assert top["distance_m"] == round(P.haversine_m(28.6812, 77.2981, top["lat"], top["lon"]))
    # budget counters moved (never key material)
    st = _app().get("/v2/p/status").json()["budget"]["apis"]
    assert st["ola:autocomplete"]["used"] == 1 and st["mappls"]["used"] == 1
    assert st["ola:geocode"]["used"] == 1
    assert KEYS["OLA_API_KEY"] not in json.dumps(st)


def test_mappls_hit_that_ola_places_elsewhere_is_dropped(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.setenv("MAPPLS_API_KEY", KEYS["MAPPLS_API_KEY"])
    up = _mock({
        ("api.olamaps.io", "/places/v1/autocomplete"):
            lambda r: {"status": "ok", "predictions": []},
        ("search.mappls.com", "/places/autosuggest/json"):
            lambda r: {"suggestedLocations": [
                {"eLoc": "Q1", "placeName": "Neelanchal Dham", "type": "POI",
                 "placeAddress": "Sant Nagar, Burari, Delhi", "distance": 3000}]},
        # Ola answers with a same-name place ~1100 km away -> disagree -> drop
        ("api.olamaps.io", "/places/v1/geocode"):
            lambda r: {"status": "ok", "geocodingResults": [{
                "formatted_address": "Neelanchal, Puri, Odisha",
                "geometry": {"location": {"lat": 19.81, "lng": 85.83}}}]},
    })
    body = _app().get("/v2/p/ac", params={"q": "neelanchal dham",
                                          "lat": 28.75, "lon": 77.19}).json()
    assert body["results"] == [] and body["configured"] is True
    assert any("/geocode" in c.url.path for c in up.calls)


def test_provider_error_is_short_and_keyless(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    _mock({("api.olamaps.io", "/places/v1/autocomplete"):
           lambda r: httpx.Response(500, json={"message": "boom"})})
    r = _app().get("/v2/p/ac", params={"q": "jama masjid"})
    assert r.status_code == 200
    assert r.json() == {"results": [], "error": "ola http 500"}
    _no_secrets(r.text)
    # a failure is never cached
    _mock({("api.olamaps.io", "/places/v1/autocomplete"):
           lambda r: {"status": "ok", "predictions": [
               _ola_pred("p1", "Jama Masjid", "Chandni Chowk, Delhi, India",
                         28.6507, 77.2334)]}})
    r2 = _app().get("/v2/p/ac", params={"q": "jama masjid"}).json()
    assert [x["name"] for x in r2["results"]] == ["Jama Masjid"]


def test_timeout_maps_to_short_error(monkeypatch):
    monkeypatch.setenv("MAPPLS_API_KEY", KEYS["MAPPLS_API_KEY"])

    def slow(req):
        raise httpx.ReadTimeout("read timed out", request=req)
    _mock({("search.mappls.com", "/places/autosuggest/json"): slow})
    r = _app().get("/v2/p/ac", params={"q": "iskcon delhi"})
    assert r.json() == {"results": [], "error": "mappls timeout"}


def test_merge_results_unit_dedup_by_name_and_60m():
    a = P._item(pid="ola:1", name="ISKCON Temple", sub="East of Kailash, Delhi",
                lat=28.5562, lon=77.2440, kind="poi", source="ola")
    b = P._item(pid="mappls:1", name="Iskcon temple", sub="Hare Krishna Hill, Delhi",
                lat=28.5565, lon=77.2443, kind="poi", source="mappls")   # ~45 m
    c = P._item(pid="mappls:2", name="ISKCON Temple", sub="Sector 33, Noida",
                lat=28.5880, lon=77.3360, kind="poi", source="mappls")   # 9 km
    out = P.merge_results([[a], [b, c]], q="iskcon")
    assert [x["id"] for x in out] == ["ola:1", "mappls:2"]


def test_plain_sub_words_only():
    assert P.plain_sub("amenity:place_of_worship, Sant Nagar, Burari, "
                       "North Delhi District, Delhi, 110084, India") == \
        "Sant Nagar, Burari, North Delhi, Delhi"
    assert P.plain_sub("Gurugram, Gurugram, Haryana 122002", "Cyber City") == \
        "Gurugram, Haryana"


# ------------------------------------------------------------ geocode / reverse
def test_geocode_house_level_mappls_first_with_ola_coordinates(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.setenv("MAPPLS_API_KEY", KEYS["MAPPLS_API_KEY"])
    seen = []

    def ola_geo(req):
        seen.append(req.url.params["address"])
        return {"status": "ok", "geocodingResults": [{
            "formatted_address": "237, Okhla Industrial Estate Phase 3, New Delhi, Delhi 110020, India",
            "geometry": {"location": {"lat": 28.5494, "lng": 77.2690}},
            "place_id": "ola-platform:okhla", "types": ["street_address"]}]}

    _mock({("search.mappls.com", "/address/geocode"): lambda r: {"copResults": {
              "houseNumber": "237", "houseName": "", "poi": "", "street": "",
              "locality": "Okhla Industrial Estate Phase 3", "city": "New Delhi",
              "formattedAddress": "237, Okhla Industrial Estate Phase 3, Kalkaji, "
                                  "South East Delhi District, New Delhi, Delhi, 110020",
              "eLoc": "TIYF9Q", "geocodeLevel": "houseNumber", "confidenceScore": 0.4}},
           ("api.olamaps.io", "/places/v1/geocode"): ola_geo})
    r = _app().get("/v2/p/geocode", params={"address": "237 okhla phase 3"})
    res = r.json()["results"]
    assert res, r.text
    top = res[0]
    assert top["source"] == "mappls" and top["kind"] == "address"
    assert top["id"] == "mappls:TIYF9Q" and top["coord_src"] == "ola_geocode"
    assert abs(top["lat"] - 28.5494) < 1e-6
    assert "110020" not in top["sub"]
    assert len(seen) == 2          # the user's text + Mappls' own formatted address


def test_reverse_prefers_ola_falls_back_to_mappls(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.setenv("MAPPLS_API_KEY", KEYS["MAPPLS_API_KEY"])
    mappls = lambda r: {"responseCode": 200, "results": [{
        "houseNumber": "", "houseName": "", "poi": "Hanuman Mandir", "poi_dist": "40",
        "street": "Hanuman Mandir Road", "subLocality": "Ashok Nagar",
        "locality": "Shahdara", "district": "Shahdara District", "city": "Delhi",
        "state": "Delhi", "pincode": "110093", "lat": "28.684", "lng": "77.300",
        "formatted_address": "Hanuman Mandir Road, Ashok Nagar, Shahdara, Delhi. "
                             "40 m from Hanuman Mandir pin-110093 (India)"}]}
    ola = lambda r: {"status": "ok", "results": [{
        "formatted_address": "C Block, Ashok Nagar, Shahdara, Delhi, 110093, India",
        "name": "C Block",
        "address_components": [
            {"long_name": "Ashok Nagar", "types": ["sublocality"]},
            {"long_name": "Delhi", "types": ["locality"]}],
        "geometry": {"location": {"lat": 28.684, "lng": 77.300}}}]}
    _mock({("api.olamaps.io", "/places/v1/reverse-geocode"): ola,
           ("search.mappls.com", "/address/rev-geocode"): mappls})
    body = _app().get("/v2/p/reverse", params={"lat": 28.684, "lon": 77.3}).json()
    assert body["source"] == "ola" and body["name"] == "C Block"
    assert body["locality"] == "Ashok Nagar" and body["city"] == "Delhi"
    assert "110093" not in body["address"] and "India" not in body["address"]

    P.clear_caches()
    _mock({("api.olamaps.io", "/places/v1/reverse-geocode"):
           lambda r: httpx.Response(503),
           ("search.mappls.com", "/address/rev-geocode"): mappls})
    body = _app().get("/v2/p/reverse", params={"lat": 28.684, "lon": 77.3}).json()
    assert body["source"] == "mappls" and body["name"] == "Hanuman Mandir"
    assert body["locality"] == "Ashok Nagar" and body["city"] == "Delhi"
    assert "40 m from" not in body["address"] and "pin" not in body["address"]


def test_nearby_lodging_from_ola(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    up = _mock({("api.olamaps.io", "/places/v1/nearbysearch"): lambda r: {
        "status": "ok", "predictions": [
            _ola_pred("h2", "Hotel Far", "Karol Bagh, Delhi, India", 28.6519, 77.1909,
                      2900, types=("lodging",)),
            _ola_pred("h1", "Hotel Near", "Connaught Place, Delhi, India", 28.6320,
                      77.2180, 150, types=("lodging",)),
        ]}})
    body = _app().get("/v2/p/nearby", params={"lat": 28.6315, "lon": 77.2167,
                                              "kind": "lodging", "radius_m": 3000}).json()
    assert [x["name"] for x in body["results"]] == ["Hotel Near", "Hotel Far"]
    assert all(x["kind"] == "lodging" for x in body["results"])
    req = up.calls[0]
    assert req.url.params["types"] == "lodging" and req.url.params["radius"] == "3000"


# ------------------------------------------------------------ TomTom
def _line(n=2000, lat0=28.60, lon0=77.20):
    # ~22 km wiggly line north-east across Delhi
    return [[lat0 + i * 1e-4, lon0 + i * 0.8e-4 + 2e-5 * math.sin(i / 7)] for i in range(n)]


def _tt_route(points, sections, summary=None):
    return {"formatVersion": "0.0.12", "routes": [{
        "summary": summary or {"lengthInMeters": 2400, "travelTimeInSeconds": 900,
                               "trafficDelayInSeconds": 240,
                               "noTrafficTravelTimeInSeconds": 600},
        "legs": [{"points": [{"latitude": a, "longitude": b} for a, b in points]}],
        "sections": sections}]}


PTS = [(28.6300, 77.2100), (28.6310, 77.2110), (28.6320, 77.2120),
       (28.6330, 77.2130), (28.6340, 77.2140)]


def test_route_traffic_maps_traffic_sections_to_jams(monkeypatch):
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    bodies = []

    def tt(req):
        bodies.append(json.loads(req.content))
        return _tt_route(PTS, [
            {"startPointIndex": 0, "endPointIndex": 4, "sectionType": "TRAVEL_MODE",
             "travelMode": "car"},
            {"startPointIndex": 0, "endPointIndex": 4,
             "sectionType": "IMPORTANT_ROAD_STRETCH", "importantRoadStretchIndex": 0,
             "streetName": {"text": "Ring Road"}},
            {"startPointIndex": 1, "endPointIndex": 3, "sectionType": "TRAFFIC",
             "simpleCategory": "JAM", "effectiveSpeedInKmh": 8, "delayInSeconds": 120,
             "magnitudeOfDelay": 2, "tec": {"effectCode": 4}},
        ])

    up = _mock({("api.tomtom.com", "/routing/1/calculateRoute/"): tt})
    coords = _line()
    r = _app().post("/v2/p/route_traffic", json={"coords": coords})
    assert r.status_code == 200, r.text
    out = r.json()
    _no_secrets(r.text)
    assert (out["live_s"], out["freeflow_s"], out["delay_s"]) == (900, 600, 240)
    assert out["source"] == "tomtom" and out["configured"] is True
    assert len(out["jams"]) == 1
    j = out["jams"][0]
    cum1 = P.haversine_m(*PTS[0], *PTS[1])
    cum3 = cum1 + P.haversine_m(*PTS[1], *PTS[2]) + P.haversine_m(*PTS[2], *PTS[3])
    assert (j["lat"], j["lon"]) == PTS[1] and (j["end_lat"], j["end_lon"]) == PTS[3]
    assert j["from_m"] == round(cum1) and j["to_m"] == round(cum3)
    assert j["delay_s"] == 120 and j["magnitude"] == 2 and j["road"] == "Ring Road"
    assert j["category"] == "jam" and j["speed_kmh"] == 8
    # the request: our line as <=150 supporting points, ends preserved
    req = up.calls[0]
    assert req.method == "POST"
    sp = bodies[0]["supportingPoints"]
    assert 2 <= len(sp) <= 150
    assert (sp[0]["latitude"], sp[0]["longitude"]) == (round(coords[0][0], 6), round(coords[0][1], 6))
    assert (sp[-1]["latitude"], sp[-1]["longitude"]) == (round(coords[-1][0], 6), round(coords[-1][1], 6))
    assert f"{coords[0][0]:.6f},{coords[0][1]:.6f}:" in req.url.path
    qs = req.url.params
    assert qs["traffic"] == "true" and qs["computeTravelTimeFor"] == "all"
    assert "traffic" in qs.get_list("sectionType")
    assert qs["key"] == KEYS["TOMTOM_API_KEY"]
    # 60 s cache: same line again -> no new call
    _app().post("/v2/p/route_traffic", json={"coords": coords})
    assert len(up.calls) == 1


def test_traffic_for_route_python_api(monkeypatch):
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    up = _mock({("api.tomtom.com", "/routing/1/calculateRoute/"):
                lambda r: _tt_route(PTS, [])})
    # GeoJSON [lon, lat] order is detected and flipped
    geo = [[b, a] for a, b in PTS]
    t = asyncio.run(P.traffic_for_route(geo))
    assert t["live_s"] == 900 and t["jams"] == [] and t["source"] == "tomtom"
    assert f"{PTS[0][0]:.6f},{PTS[0][1]:.6f}:" in up.calls[0].url.path
    # provider down -> None (never a made-up traffic picture)
    P.clear_caches()
    _mock({("api.tomtom.com", "/routing/1/calculateRoute/"):
           lambda r: httpx.Response(403)})
    assert asyncio.run(P.traffic_for_route(PTS)) is None


def test_route_traffic_error_and_bad_input(monkeypatch):
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    _mock({("api.tomtom.com", "/routing/1/calculateRoute/"):
           lambda r: httpx.Response(400, json={"error": "no route"})})
    c = _app()
    r = c.post("/v2/p/route_traffic", json={"coords": [list(p) for p in PTS]})
    assert r.status_code == 200 and r.json() == {"results": [], "error": "http 400"}
    assert c.post("/v2/p/route_traffic", json={"coords": [[28.6, 77.2]]}).status_code == 400
    assert c.post("/v2/p/route_traffic", json={"nope": 1}).status_code == 400


def test_route_traffic_retries_without_road_names_on_400(monkeypatch):
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])

    def tt(req):
        if "importantRoadStretch" in req.url.params.get_list("sectionType"):
            return httpx.Response(400, json={"error": "bad sectionType"})
        return _tt_route(PTS, [{"startPointIndex": 2, "endPointIndex": 4,
                                "sectionType": "TRAFFIC", "delayInSeconds": 60,
                                "magnitudeOfDelay": 1, "simpleCategory": "JAM"}])

    up = _mock({("api.tomtom.com", "/routing/1/calculateRoute/"): tt})
    out = _app().post("/v2/p/route_traffic", json={"coords": [list(p) for p in PTS]}).json()
    assert len(up.calls) == 2
    assert out["jams"][0]["road"] == "" and out["jams"][0]["delay_s"] == 60


def _tt_rich_route(points, sections, summary=None, progress=None,
                   instructions=None):
    r = {"summary": summary or {"lengthInMeters": 2400, "travelTimeInSeconds": 900,
                              "trafficDelayInSeconds": 240,
                              "noTrafficTravelTimeInSeconds": 600},
         "legs": [{"points": [{"latitude": a, "longitude": b} for a, b in points]}],
         "sections": sections}
    if progress is not None:
        r["progress"] = progress
    if instructions is not None:
        r["legs"][0]["guidance"] = {"instructions": instructions}
    return r


def test_route_traffic_full_depth_fields(monkeypatch):
    """Every TomTom feature the request asks for is returned, real."""
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    alt_pts = [(28.6305, 77.2105), (28.6315, 77.2115), (28.6325, 77.2125)]

    def tt(req):
        return {"formatVersion": "0.0.12", "routes": [
            _tt_rich_route(PTS, [
                {"startPointIndex": 0, "endPointIndex": 4,
                 "sectionType": "IMPORTANT_ROAD_STRETCH",
                 "streetName": {"text": "Ring Road"}},
                {"startPointIndex": 1, "endPointIndex": 3, "sectionType": "TRAFFIC",
                 "simpleCategory": "JAM", "effectiveSpeedInKmh": 8,
                 "delayInSeconds": 120, "magnitudeOfDelay": 2},
                {"startPointIndex": 2, "endPointIndex": 4, "sectionType": "TOLL",
                 "tollPaymentTypes": ["ETC_TRANSPONDER"]},
                {"startPointIndex": 0, "endPointIndex": 2,
                 "sectionType": "SPEED_LIMIT", "maxSpeedLimitInKmh": 50},
                {"startPointIndex": 0, "endPointIndex": 4, "sectionType": "URBAN"},
                {"startPointIndex": 0, "endPointIndex": 4,
                 "sectionType": "TRAVEL_MODE", "travelMode": "car"}],
                summary={"lengthInMeters": 2400, "travelTimeInSeconds": 900,
                         "trafficDelayInSeconds": 240,
                         "noTrafficTravelTimeInSeconds": 600,
                         "historicTrafficTravelTimeInSeconds": 800,
                         "liveTrafficIncidentsTravelTimeInSeconds": 870,
                         "trafficLengthInMeters": 320,
                         "departureTime": "2026-10-12T12:00:00+05:30",
                         "arrivalTime": "2026-10-12T12:15:00+05:30"},
                progress=[{"pointIndex": 0, "travelTimeInSeconds": 0,
                           "distanceInMeters": 0},
                          {"pointIndex": 4, "travelTimeInSeconds": 900,
                           "distanceInMeters": 2400}],
                instructions=[{"message": "Head north on Ring Road",
                               "maneuver": "DEPART", "street": "Ring Road",
                               "routeOffsetInMeters": 0, "travelTimeInSeconds": 0,
                               "point": {"latitude": 28.63, "longitude": 77.21}},
                              {"message": "Turn left", "maneuver": "TURN_LEFT",
                               "street": "Mahatma Gandhi Road",
                               "routeOffsetInMeters": 1200,
                               "travelTimeInSeconds": 400,
                               "point": {"latitude": 28.632, "longitude": 77.212}}]),
            _tt_rich_route(alt_pts, [
                {"startPointIndex": 0, "endPointIndex": 2, "sectionType": "TOLL",
                 "tollPaymentTypes": []},
                {"startPointIndex": 0, "endPointIndex": 2,
                 "sectionType": "MOTORWAY"}],
                summary={"lengthInMeters": 2800, "travelTimeInSeconds": 960,
                         "trafficDelayInSeconds": 0,
                         "noTrafficTravelTimeInSeconds": 640,
                         "deviationDistance": 300, "deviationTime": 60}),
        ]}

    up = _mock({("api.tomtom.com", "/routing/1/calculateRoute/"): tt})
    out = _app().post("/v2/p/route_traffic", json={
        "coords": [list(p) for p in PTS], "mode": "car",
        "depart_at": "2026-10-13T08:30:00+05:30", "fuel_l100": 6.3}).json()
    _no_secrets(json.dumps(out))
    # request asks for the full surface
    qs = up.calls[0].url.params
    assert qs["maxAlternatives"] == str(P.TT_MAX_ALTS)
    assert qs["alternativeType"] == "anyRoute"
    assert qs["instructionsType"] == "text" and qs["language"] == "en-GB"
    assert qs["includeTollPaymentTypes"] == "all"
    assert set(qs.get_list("extendedRouteRepresentation")) == {"distance", "travelTime"}
    secs = set(qs.get_list("sectionType"))
    for want in ("traffic", "importantRoadStretch", "toll", "tollVignette",
                 "urban", "tunnel", "motorway", "speedLimit", "unpaved"):
        assert want in secs, want
    assert qs["departAt"] == "2026-10-13T08:30:00+05:30"
    assert qs["vehicleEngineType"] == "combustion"
    assert "6.3" in qs["constantSpeedConsumptionInLitersPerHundredkm"]
    # contract fields unchanged
    assert (out["live_s"], out["freeflow_s"], out["delay_s"], out["length_m"]) == (900, 600, 240, 2400)
    assert out["source"] == "tomtom"
    # new summary fields — real values verbatim
    assert out["historic_s"] == 800 and out["incidents_s"] == 870
    assert out["traffic_length_m"] == 320
    assert out["depart_at"] == "2026-10-12T12:00:00+05:30"
    assert out["arrive_at"] == "2026-10-12T12:15:00+05:30"
    # dense polyline + time profile + roads + instructions
    assert out["polyline"][0] == [28.63, 77.21] and len(out["polyline"]) == 5
    assert out["progress"] == [{"i": 0, "t_s": 0, "d_m": 0},
                               {"i": 4, "t_s": 900, "d_m": 2400}]
    assert out["roads"][0]["name"] == "Ring Road" and out["roads"][0]["from_m"] == 0
    ins = out["instructions"]
    assert len(ins) == 2 and ins[0]["text"] == "Head north on Ring Road"
    assert ins[1]["maneuver"] == "TURN_LEFT" and ins[1]["offset_m"] == 1200
    # tolls / speed limits / flags
    assert out["tolls"][0]["payments"] == ["ETC_TRANSPONDER"]
    assert out["tolls"][0]["from_m"] > 0 and out["tolls"][0]["to_m"] > out["tolls"][0]["from_m"]
    assert out["speed_limits"][0]["kmh"] == 50 and out["speed_limits"][0]["from_m"] == 0
    assert out["flags"]["toll"] is True and out["flags"]["urban"] is True
    assert out["flags"]["tunnel"] is False          # asked, absent on route
    # alternatives: same shape, own basis, deviation fields
    alts = out["alternatives"]
    assert len(alts) == 1
    a = alts[0]
    assert a["live_s"] == 960 and a["length_m"] == 2800
    assert a["deviation_m"] == 300 and a["deviation_s"] == 60
    assert a["flags"]["toll"] is True and a["flags"]["motorway"] is True
    assert a["tolls"] and a["polyline"][0] == [28.6305, 77.2105]
    assert "alternatives" not in a


def test_route_traffic_fuel_and_depart_at_optional(monkeypatch):
    """No consumption params -> no fuel keys asked, no fuel field back."""
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    up = _mock({("api.tomtom.com", "/routing/1/calculateRoute/"):
                lambda r: _tt_route(PTS, [])})
    out = _app().post("/v2/p/route_traffic",
                      json={"coords": [list(p) for p in PTS]}).json()
    qs = up.calls[0].url.params
    assert "departAt" not in qs and "vehicleEngineType" not in qs
    assert "fuel_l" not in out and "battery_kwh" not in out
    assert "instructions" not in out        # provider returned none -> absent
    # electric vehicle model
    P.clear_caches()
    _mock({("api.tomtom.com", "/routing/1/calculateRoute/"): lambda r: {"routes": [
        _tt_rich_route(PTS, [], summary={"lengthInMeters": 2400,
                                        "travelTimeInSeconds": 900,
                                        "batteryConsumptionInkWh": 1.81})]}})
    out = _app().post("/v2/p/route_traffic", json={
        "coords": [list(p) for p in PTS], "kwh_100km": 14}).json()
    assert out["battery_kwh"] == 1.81


def test_ola_fallback_returns_steps_and_alternatives(monkeypatch):
    """Ola directions now asks steps+alternatives; both reach the wire."""
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    monkeypatch.setenv("ALIVE_BUDGET_TOMTOM", "0")
    line = [(28.6000 + i * 0.001, 77.2000) for i in range(11)]
    our_len = sum(P.haversine_m(*a, *b) for a, b in zip(line, line[1:]))
    alt_line = [(a, b + 0.0005) for a, b in line]
    seen = []

    def ola(req):
        seen.append(req)
        r0 = {"overview_polyline": _enc(line), "travel_advisory": "0,4,0|4,7,10",
              "summary": "via Outer Ring Road", "warnings": ["tolls ahead"],
              "legs": [{"distance": int(our_len), "duration": 300,
                        "start_address": "CP", "end_address": "Nehru Place",
                        "steps": [
                            {"instructions": "Head north", "maneuver": "depart",
                             "distance": 500, "duration": 60,
                             "start_location": {"lat": 28.6, "lng": 77.2}},
                            {"instructions": "Turn right onto Ring Road",
                             "maneuver": "turn-right", "distance": 600,
                             "duration": 240,
                             "start_location": {"lat": 28.605, "lng": 77.2}}]}]}
        r1 = {"overview_polyline": _enc(alt_line), "travel_advisory": "0,10,15",
              "summary": "", "legs": [{"distance": int(our_len * 1.1),
                                       "duration": 380, "steps": []}]}
        return {"status": "SUCCESS", "routes": [r0, r1]}

    _mock({("api.olamaps.io", "/routing/v1/directions"): ola})
    out = _app().post("/v2/p/route_traffic",
                      json={"coords": [list(p) for p in line]}).json()
    q = seen[0].url.params
    assert q["alternatives"] == "true" and q["steps"] == "true"
    assert q["mode"] == "driving" and q["route_preference"] == "fastest"
    assert out["source"] == "ola" and out["live_s"] == 300
    assert out["summary"] == "via Outer Ring Road"
    assert out["warnings"] == ["tolls ahead"]
    assert out["advisory"] == "0,4,0|4,7,10"
    assert out["instructions"][0]["text"] == "Head north"
    assert out["instructions"][1]["maneuver"] == "turn-right"
    assert out["instructions"][1]["lat"] == 28.605
    assert out["polyline"][0] == [28.6, 77.2]
    assert out["jams"][0]["level"] == 10      # raw advisory level surfaced
    alts = out["alternatives"]
    assert len(alts) == 1 and alts[0]["live_s"] == 380
    assert alts[0]["length_m"] == int(our_len * 1.1)
    assert alts[0]["jams"][0]["category"] == "jam" and alts[0]["jams"][0]["level"] == 15
    assert alts[0]["polyline"][0][0] == pytest.approx(28.6, abs=1e-4)
    _no_secrets(json.dumps(out))


def test_ola_walking_mode_maps_through(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.delenv("TOMTOM_API_KEY", raising=False)
    seen = []
    line = [(28.6, 77.2), (28.61, 77.2)]
    _mock({("api.olamaps.io", "/routing/v1/directions"): lambda r: (
        seen.append(r) or _ola_dir(line, "", 1200, 900))})
    _app().post("/v2/p/route_traffic",
                json={"coords": [list(p) for p in line], "mode": "pedestrian"})
    assert seen[0].url.params["mode"] == "walking"


def test_reverse_exposes_pincode_and_state(monkeypatch):
    monkeypatch.setenv("MAPPLS_API_KEY", KEYS["MAPPLS_API_KEY"])
    _mock({("search.mappls.com", "/address/rev-geocode"): lambda r: {
        "responseCode": 200, "results": [{
            "poi": "Hanuman Mandir", "street": "Hanuman Mandir Road",
            "subLocality": "Ashok Nagar", "locality": "Shahdara",
            "district": "Shahdara District", "city": "Delhi", "state": "Delhi",
            "pincode": "110093",
            "formatted_address": "Hanuman Mandir Road, Ashok Nagar, Delhi"}]}})
    body = _app().get("/v2/p/reverse", params={"lat": 28.684, "lon": 77.3}).json()
    assert body["source"] == "mappls"
    assert body["pincode"] == "110093" and body["state"] == "Delhi"
    assert body["district"] == "Shahdara"


def test_downsample_cap_ends_and_spacing():
    line = [tuple(p) for p in _line(5000)]
    sp = P.downsample(line, 150)
    assert 100 <= len(sp) <= 150
    assert sp[0] == line[0] and sp[-1] == line[-1]
    total = sum(P.haversine_m(*a, *b) for a, b in zip(line, line[1:]))
    gap = max(P.haversine_m(*a, *b) for a, b in zip(sp, sp[1:]))
    assert gap <= 2.5 * total / 150      # no long free legs for TomTom to re-route
    short = [tuple(p) for p in _line(40)]
    assert P.downsample(short, 150) == short


def test_flow_tile_proxy_and_cache(monkeypatch):
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 64
    up = _mock({("api.tomtom.com", "/traffic/map/4/tile/flow/relative0/11/1462/843.png"):
                lambda r: httpx.Response(200, content=png,
                                         headers={"content-type": "image/png"})})
    c = _app()
    r = c.get("/v2/p/flow_tile/11/1462/843.png")
    assert r.status_code == 200 and r.content == png
    assert r.headers["content-type"] == "image/png"
    assert c.get("/v2/p/flow_tile/11/1462/843.png").content == png
    assert len(up.calls) == 1
    assert c.get("/v2/p/flow_tile/3/9/0.png").status_code == 400     # x >= 2^z


def test_incidents_parsed_to_plain_words(monkeypatch):
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    up = _mock({("api.tomtom.com", "/traffic/services/5/incidentDetails"): lambda r: {
        "incidents": [
            {"type": "Feature",
             "geometry": {"type": "LineString",
                          "coordinates": [[77.2500, 28.5500], [77.2550, 28.5520]]},
             "properties": {"iconCategory": 6, "magnitudeOfDelay": 3, "delay": 420,
                            "roadNumbers": ["NH48"], "from": "Ashram", "to": "Moolchand",
                            "length": 900,
                            "events": [{"description": "Stationary traffic", "code": 101}]}},
            {"type": "Feature", "geometry": {"type": "Point", "coordinates": [77.21, 28.63]},
             "properties": {"iconCategory": 9, "magnitudeOfDelay": 0, "roadNumbers": [],
                            "events": [{"description": "Roadworks", "code": 701}]}},
        ]}})
    body = _app().get("/v2/p/incidents", params={"bbox": "77.1,28.5,77.3,28.7"}).json()
    a, b = body["results"]
    assert (a["lat"], a["lon"], a["type"], a["road"], a["delay_s"]) == \
        (28.55, 77.25, "jam", "NH48", 420)
    assert (b["type"], b["delay_s"], b["road"]) == ("road works", None, "")
    qs = up.calls[0].url.params
    assert qs["bbox"] == "77.10000,28.50000,77.30000,28.70000"
    assert "incidents" in qs["fields"]
    too_big = _app().get("/v2/p/incidents", params={"bbox": "76,27,79,30"}).json()
    assert too_big["results"] == [] and "too large" in too_big["error"]


# ------------------------------------------------------------ P2: scale + budgets
def _enc(pts, precision=5):
    """Google polyline encoder (test helper)."""
    out, plat, plon, f = [], 0, 0, 10 ** precision
    for lat, lon in pts:
        ilat, ilon = int(round(lat * f)), int(round(lon * f))
        for d in (ilat - plat, ilon - plon):
            v = ~(d << 1) if d < 0 else (d << 1)
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1F)) + 63))
                v >>= 5
            out.append(chr(v + 63))
        plat, plon = ilat, ilon
    return "".join(out)


def test_polyline_decode_roundtrip():
    pts = [(28.6315, 77.2167), (28.6322, 77.2201), (28.5562, 77.2440)]
    assert [(round(a, 5), round(b, 5)) for a, b in P.decode_polyline(_enc(pts))] == pts


def test_two_token_query_with_strong_ola_top_never_calls_mappls(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.setenv("MAPPLS_API_KEY", KEYS["MAPPLS_API_KEY"])
    up = _mock({("api.olamaps.io", "/places/v1/autocomplete"): lambda r: {
        "status": "ok", "predictions": [
            _ola_pred("p1", "Pawan Bakery", "C-543, Hanuman Mandir Rd, West Jyoti Nagar, Delhi",
                      28.6905, 77.2950, 1200)]}})     # a Mappls call would raise
    body = _app().get("/v2/p/ac", params={"q": "pawan bakery", "lat": 28.684,
                                          "lon": 77.300}).json()
    assert [x["name"] for x in body["results"]] == ["Pawan Bakery"]
    assert all("mappls" not in c.url.host for c in up.calls)
    # 1 char -> no provider call at all
    n = len(up.calls)
    assert _app().get("/v2/p/ac", params={"q": "p"}).json()["results"] == []
    assert len(up.calls) == n


def test_weak_ola_top_brings_in_mappls_and_bridges_it(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.setenv("MAPPLS_API_KEY", KEYS["MAPPLS_API_KEY"])
    seen = []

    def ola_geo(req):
        seen.append(req.url.params["address"])
        return {"status": "ok", "geocodingResults": [{
            "formatted_address": "Nilanchaldhaam BACE, 386 ISKCON, Sant Nagar, East of Kailash, New Delhi",
            "geometry": {"location": {"lat": 28.5553, "lng": 77.2510}}}]}
    up = _mock({
        ("api.olamaps.io", "/places/v1/autocomplete"): lambda r: {"status": "ok", "predictions": [
            _ola_pred("x", "Neelanchal Apartments", "Sector 4, Dwarka, Delhi", 28.59, 77.06, 18000)]},
        ("search.mappls.com", "/places/autosuggest/json"): lambda r: {"suggestedLocations": [
            {"eLoc": "NDB1", "placeName": "Nilanchal Dhaam Bace", "type": "POI",
             "placeAddress": "Sant Nagar, East Of Kailash, New Delhi, Delhi", "distance": 400,
             "latitude": None, "longitude": None}]},
        ("api.olamaps.io", "/places/v1/geocode"): ola_geo})
    body = _app().get("/v2/p/ac", params={"q": "neelanchal dham", "lat": 28.5565,
                                          "lon": 77.2480}).json()
    hit = next(x for x in body["results"] if x["id"] == "mappls:NDB1")
    assert abs(hit["lat"] - 28.5553) < 1e-6 and hit["coord_src"] == "ola_geocode"
    assert seen == ["Nilanchal Dhaam Bace, Sant Nagar, East Of Kailash, New Delhi, Delhi"]
    assert any("mappls" in c.url.host for c in up.calls)


def test_budget_exhausted_degrades_honestly(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    monkeypatch.setenv("ALIVE_BUDGET_OLA", "1")
    monkeypatch.setenv("ALIVE_BUDGET_TOMTOM_TILES", "0")
    up = _mock({("api.olamaps.io", "/places/v1/autocomplete"): lambda r: {
        "status": "ok", "predictions": [_ola_pred("p1", "Jama Masjid", "Chandni Chowk, Delhi",
                                                  28.6507, 77.2334)]}})
    c = _app()
    assert c.get("/v2/p/ac", params={"q": "jama masjid"}).json()["results"]
    r = c.get("/v2/p/ac", params={"q": "red fort"})
    assert r.json() == {"results": [], "configured": True, "degraded": "budget"}
    assert "s-maxage=60" in r.headers["cache-control"]
    assert len(up.calls) == 1
    t = c.get("/v2/p/flow_tile/11/1462/843.png")
    assert t.status_code == 204 and t.headers["x-alive-provider"] == "budget"
    st = c.get("/v2/p/status").json()["budget"]["apis"]
    assert st["ola:autocomplete"] == {"used": 1, "cap": 1, "denied": 1}
    assert st["tomtom_tile"]["denied"] == 1
    # shards divide every cap (2 processes -> each may spend half)
    monkeypatch.setenv("ALIVE_BUDGET_SHARDS", "2")
    monkeypatch.setenv("ALIVE_BUDGET_OLA", "3000")
    assert P.budget_cap("ola:geocode") == 1500 and P.budget_cap("mappls") == 450


def _ola_dir(poly_pts, advisory, dist, dur):
    return {"status": "SUCCESS", "routes": [{
        "overview_polyline": _enc(poly_pts), "travel_advisory": advisory,
        "legs": [{"distance": dist, "duration": dur, "steps": []}]}]}


def test_route_traffic_falls_back_to_ola_travel_advisory(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    monkeypatch.setenv("ALIVE_BUDGET_TOMTOM", "0")          # TomTom spent today
    line = [(28.6000 + i * 0.001, 77.2000) for i in range(11)]   # ~1.1 km north
    our_len = sum(P.haversine_m(*a, *b) for a, b in zip(line, line[1:]))
    seen = []

    def ola(req):
        seen.append(req)
        # idx 0-4 free, 4-7 level 10 (jam), 7-10 level 5 (slow)
        return _ola_dir(line, "0,4,0|4,7,10|7,10,5", int(our_len), 300)
    _mock({("api.olamaps.io", "/routing/v1/directions"): ola})
    r = _app().post("/v2/p/route_traffic", json={"coords": [list(p) for p in line]})
    out = r.json()
    _no_secrets(r.text)
    assert out["source"] == "ola" and out["configured"] is True
    assert out["live_s"] == 300 and out["delay_s"] is None and out["freeflow_s"] is None
    cats = [(j["category"], j["magnitude"]) for j in out["jams"]]
    assert cats == [("jam", 2), ("slow", 1)]
    jam = out["jams"][0]
    assert abs(jam["from_m"] - 4 * 111.2) < 40 and abs(jam["to_m"] - 7 * 111.2) < 40
    assert jam["delay_s"] is None and jam["speed_kmh"] is None
    q = seen[0].url.params
    assert seen[0].method == "POST" and q["traffic_metadata"] == "true" and q["overview"] == "full"
    assert q["origin"] == "28.600000,77.200000"
    # Python seam takes the same path
    P.clear_caches()
    monkeypatch.setenv("ALIVE_BUDGET_TOMTOM", "0")
    t = asyncio.run(P.traffic_for_route([list(p) for p in line]))
    assert t["source"] == "ola" and len(t["jams"]) == 2
    # Ola's route on another road (length off by > 15 %) -> no live_s, and
    # spans off our line are not reported as jams on it
    P.clear_caches()
    far = [(a, b + 0.01) for a, b in line]                     # ~1 km east
    _mock({("api.olamaps.io", "/routing/v1/directions"):
           lambda r: _ola_dir(far, "0,10,15", int(our_len * 2), 600)})
    out = _app().post("/v2/p/route_traffic", json={"coords": [list(p) for p in line]}).json()
    assert out["live_s"] is None and out["jams"] == []


def test_route_traffic_all_budgets_spent_is_degraded(monkeypatch):
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    monkeypatch.setenv("ALIVE_BUDGET_TOMTOM", "0")
    up = _mock({})
    out = _app().post("/v2/p/route_traffic", json={"coords": [list(p) for p in PTS]}).json()
    assert out == {"results": [], "configured": True, "degraded": "budget"}
    assert up.calls == []


def test_cdn_cache_headers(monkeypatch):
    monkeypatch.setenv("OLA_API_KEY", KEYS["OLA_API_KEY"])
    monkeypatch.setenv("TOMTOM_API_KEY", KEYS["TOMTOM_API_KEY"])
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 32
    _mock({("api.olamaps.io", "/places/v1/geocode"): lambda r: {"status": "ok", "geocodingResults": [{
               "formatted_address": "Jama Masjid, Chandni Chowk, Delhi",
               "geometry": {"location": {"lat": 28.6507, "lng": 77.2334}}}]},
           ("api.olamaps.io", "/places/v1/reverse-geocode"): lambda r: {"status": "ok", "results": [{
               "formatted_address": "C Block, Ashok Nagar, Delhi", "name": "C Block"}]},
           ("api.olamaps.io", "/places/v1/nearbysearch"): lambda r: {"status": "ok", "predictions": [
               _ola_pred("h1", "Hotel Near", "Connaught Place, Delhi", 28.6320, 77.2180, 150,
                         types=("lodging",))]},
           ("api.tomtom.com", "/traffic/map/4/tile/flow/"): lambda r: httpx.Response(
               200, content=png, headers={"content-type": "image/png"}),
           ("api.tomtom.com", "/incidentDetails"): lambda r: {"incidents": []}})
    c = _app()
    cc = lambda url, **kw: c.get(url, params=kw).headers.get("cache-control")
    assert cc("/v2/p/geocode", address="jama masjid") == "public, max-age=600, s-maxage=86400"
    assert cc("/v2/p/reverse", lat=28.684, lon=77.3) == "public, max-age=600, s-maxage=86400"
    assert cc("/v2/p/nearby", lat=28.6315, lon=77.2167) == "public, max-age=600, s-maxage=3600"
    assert cc("/v2/p/flow_tile/11/1462/843.png") == \
        "public, max-age=60, s-maxage=120, stale-while-revalidate=300"
    assert cc("/v2/p/incidents", bbox="77.1,28.5,77.3,28.7") == "public, max-age=120, s-maxage=120"
    assert cc("/v2/p/status") == "no-store"
    # a failure is never cached by the CDN either
    _mock({("api.olamaps.io", "/places/v1/geocode"): lambda r: httpx.Response(500)})
    assert cc("/v2/p/geocode", address="red fort delhi") == "no-store"
