"""GET /static/{asset:path} — landing media under server/static/.

Nested paths must serve; anything that resolves outside the static dir
(traversal, encoded dots) or isn't a file must be a 404 — the route is
the landing page's only file window, so it has to be airtight.
"""
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)


def test_static_nested_file_serves():
    r = client.get("/static/film/pin.svg")
    assert r.status_code == 200
    assert "svg" in r.headers.get("content-type", "")


def test_static_deep_nested_file_serves():
    r = client.get("/static/screens/scr-compare-ios.webp")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/")


def test_static_traversal_is_404():
    assert client.get("/static/../main.py").status_code == 404
    assert client.get("/static/%2e%2e/main.py").status_code == 404
    assert client.get("/static/%2e%2e%2fmain.py").status_code == 404
    assert client.get("/static/film/../../main.py").status_code == 404


def test_static_missing_is_404():
    assert client.get("/static/definitely-missing.webp").status_code == 404
    assert client.get("/static/film/not-here.svg").status_code == 404


def test_static_directory_is_404():
    """A directory is not a file — no listing, no index."""
    assert client.get("/static/film/").status_code == 404
    assert client.get("/static/film").status_code in (404, 307)
