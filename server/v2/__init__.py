"""Alive /v2 API — versioned surface per docs/plan/05 §3.

Mounted by server/main.py under prefix /v2. Importable two ways:
`import v2` when server/ is on sys.path (the deployed layout —
Dockerfile runs uvicorn from server/), or `import server.v2` from the
repo root (tests, notebooks). The bootstrap below makes the flat server
modules (airfield, exposure, transit, location_client...) resolvable in
both cases.
"""
import os
import sys

_SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _SERVER_DIR not in sys.path:
    sys.path.insert(0, _SERVER_DIR)

from fastapi import APIRouter  # noqa: E402

from . import archive, city, day, explore, ledger, outlook, places, plan, reach, search, skill, strip, trip, why  # noqa: E402

router = APIRouter(prefix="/v2", tags=["v2"])
for _r in (search.router, places.router, plan.router,
           strip.router, trip.router, city.router, ledger.router,
           day.router, explore.router, outlook.router, reach.router,
           archive.router, skill.router, why.router):
    router.include_router(_r)

# /v2/p/* provider proxy (Ola, Mappls, TomTom — lane P, Oct 11). Guarded:
# a broken provider module must never take the whole /v2 surface down.
try:
    from . import providers  # noqa: E402
    router.include_router(providers.router)
except Exception as _e:  # pragma: no cover — logged, /v2 keeps serving
    import logging as _logging
    _logging.getLogger("alive.v2").warning(
        "v2.providers not mounted: %s", type(_e).__name__)

__all__ = ["router"]
