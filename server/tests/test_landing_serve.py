"""Landing page serve-path smoke: / + /landing must return the real
page, not a truncated or stale file.

The raster field + live status are assembled in-browser — the only
automatable check is that the served HTML still contains the markers
every piece of that machinery hangs off. A truncated write, a missing
fetch path, or a placeholder restore fails this loudly.
Design guards: owner rejected capsule buttons, ASCII art and heavy
copy — the FORBIDDEN list keeps the page from drifting back.
"""
import re

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)

# anchors that make the page what it is: the film intro (motes canvas,
# colour wash, morphing ink line, beats, end card), the device stage,
# the live field canvas, the sim slot, the live fetch paths, and the
# ids the data bindings write to.
REQUIRED = [
    'id="motes"',                    # film particulate canvas (in the stage)
    'id="moteCap"',                  # the mote caption
    'id="filmTrack"',                # the scroll film — the intro that plays itself
    'id="washA"', 'id="washB"',      # the colour field under the line
    "class=\"mstr motif\"",          # the morphing ink line (bottom-band svg)
    'id="endcard"',                    # the film's last frame — introducing Alive
    'class="details"', 'id="detV"', 'id="detBand"', 'id="detStamp"',  # the live read + the running app
    'id="b0stat"', 'id="bSt"', 'id="bCells"', 'id="bAge"', 'id="bTrip"',
    'id="bHours"', 'id="bAsk"', 'id="b5stat"',        # live ids
    "/static/film/particles.svg",    # drifting particulate fetch
    'id="dark"', 'class="dlist"',    # the capture wall — 003 · the app
    "/static/god/integrate-s18_compare2.webp",  # gallery captures
    "/static/god/integrate-s26b_stays.webp",
    'id="tryit"',                    # the live preview section
    'src="/app/"',                   # the live preview iframe — the real
                                     # app since 3e44ada (was scripted sim)
    'id="simFrame"', 'id="simfit"',  # desktop embedded preview rig
    'id="simOpen"', 'id="simOv"',    # phone poster → fullscreen overlay
    'id="fieldSec"',                 # the field section
    'id="mapCv"', 'id="dstrip"',     # live canvas + district strip
    "/v2/city", "/v2/plan", "/grid", "/v2/districts",  # live reads
    "priceTrip", "loadGrid", "drawField", "setHTML",   # data bindings

    "<main>",                        # landmark: main content
    "prefers-reduced-motion",
    "Alive",
    "the air around you",
]
# owner-vetoed elements + placeholder guards
FORBIDDEN = [
    "lorem ipsum",
    "TODO",
    "FIXME",
    "placeholder text",
    "border-radius:999px",  # capsule buttons — rejected outright
    "border-radius: 999px",
    "aether",
    "ROUTE_ODS",
    "demo-live.mp4",        # stale consent copy — banned outright
]
# landing-only bans (community legitimately links /admin in its nav)
LANDING_FORBIDDEN = FORBIDDEN + [
    "/admin",  # owner: "admin is personal — nothing admin on the marketing page"
    "github.com",  # v12 owner law: no repo/release links on the landing
    "get the app",  # v12: launch ships no public download ask
    'href="/city"',       # v19 teaser law: zero links to live surfaces
    'href="/community"',
    "app store",
    "border-radius:100px",  # v19: the teaser is capsule-free (community's
                          # own register pass is a separate lane)
]


def test_root_serves_landing():
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers.get("content-type", "")
    assert "<title>" in r.text and "alive" in r.text.lower()


def test_landing_alias_same_payload():
    a, b = client.get("/"), client.get("/landing")
    assert a.status_code == 200 and b.status_code == 200
    assert a.text == b.text


def test_landing_machinery_intact():
    body = client.get("/").text
    missing = [s for s in REQUIRED if s not in body]
    assert not missing, f"landing lost markers: {missing}"
    for bad in LANDING_FORBIDDEN:
        assert bad not in body, f"landing contains placeholder {bad!r}"


def test_landing_script_wellformed():
    """A truncated <script> assembly is how a page 'loads but does
    nothing' — braces must balance and the live machinery must be present."""
    body = client.get("/").text
    m = re.search(r"<script>(.*)</script>", body, re.S)
    assert m, "landing has no inline script"
    js = m.group(1)
    assert js.count("{") == js.count("}"), "unbalanced braces in landing JS"
    assert "fetch(" in js, "live fetch missing"
    assert "requestAnimationFrame" in js, "film engine missing"
    assert "IntersectionObserver" in js, "lazy mounts missing"


def test_community_serves_page_to_browsers():
    """/community content-negotiates: browser Accept → the v5 page,
    API clients → the totals JSON the app consumes."""
    html = client.get("/community", headers={"accept": "text/html"})
    assert html.status_code == 200
    assert "text/html" in html.headers.get("content-type", "")
    for marker in ("/community", "lgrid", "corridors", "enough phones", "top_corridors"):
        assert marker in html.text, f"community page lost marker {marker!r}"
    for bad in FORBIDDEN:
        assert bad not in html.text
    js = client.get("/community")
    assert js.status_code == 200
    assert "application/json" in js.headers.get("content-type", "")
    assert "contributors" in js.json()
