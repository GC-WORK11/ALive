"""POST /v2/ask — "Ask ALive". One honest recommendation composed from
the live field, not a language model improvising.

Every reply is built from real endpoints' data:
  * purest_places()  — named places ranked by live/solid pm2.5
  * /v2/playtime     — the day's lightest window at the pick
  * F.value / cpcb   — the read where the asker stands
Nothing is invented: no place, number or window appears that the field
didn't compute. The asker's own locality never echoes back — privacy by
design, and the reason the card says "near you", never the address.
"""
from __future__ import annotations

import json
import re
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

from . import deps
from .gazetteer import _haversine_m

router = APIRouter()

_RUN = re.compile(r"\b(run|jog|running|jogging|exercise|workout|walk|walking|"
                  r"morning walk|evening walk|stretch)\b", re.I)
_PARK = re.compile(r"\b(park|garden|green|picnic|kids|children|family|play|"
                   r"date|chill|relax|sit|quiet|peace|calm|read|nature|"
                   r"video|record|shoot|launch|open\s?air|outing|outing)\b", re.I)
_AQI = re.compile(r"\b(aqi|air|pollution|pm\s?2\.?5|pm\s?10|quality|"
                  r"how bad|how clean|smog|outside|out)\b", re.I)
_WHEN = re.compile(r"\b(when|time|hour|tonight|morning|evening|afternoon|"
                   r"schedule|best time|today)\b", re.I)


class AskBody(BaseModel):
    q: str
    lat: Optional[float] = None
    lon: Optional[float] = None


def _place_pick(places, want_park):
    """Top place; when the intent is outdoorsy, parks outrank raw order."""
    if not places:
        return None
    parks = [p for p in places if p.get("kind") == "park"]
    return parks[0] if (want_park and parks) else places[0]


def _fmt_hhmm(lbl):
    return lbl or ""


async def _window_at(lat, lon):
    """/v2/playtime's best window at the pick — real IST labels."""
    try:
        from . import explore
        r = await explore.playtime(lat=round(lat, 5), lon=round(lon, 5))
        body = getattr(r, "body", None)
        d = json.loads(body) if isinstance(body, (bytes, bytearray)) else r
        w = d.get("best_window")
        if w and w.get("start_label"):
            return {
                "start": w.get("start_label"), "end": w.get("end_label"),
                "pm25_mid": w.get("pm25_mid"),
                "verdict": d.get("verdict"),
                "decisions": d.get("decisions") or [],
            }
    except Exception:
        pass
    return None


def _fires_today():
    """VIIRS farm-fire detections — the stubble-burning signal. Returns
    a small dict {n, nearest_km} or None; never raises."""
    try:
        from main import FIRES  # populated by the server's fire fetcher
        feats = getattr(FIRES, "fires_geojson", lambda: {"features": []})()
        n = len((feats or {}).get("features") or [])
        return {"n": n} if n else None
    except Exception:
        return None


def _decision_line(win, *labels):
    """pull one of playtime's verdict rows verbatim — 'kids outdoors',
    'windows open'… already honest server wording."""
    for d in (win or {}).get("decisions") or []:
        if d.get("label") in labels:
            return d.get("line")
    return None


@router.post("/ask")
async def ask(body: AskBody):
    """Compose one recommendation. Never echoes the origin locality."""
    q = (body.q or "").strip()
    if not q:
        return {"ok": False, "say": "ask me something — where to go, when to go out, how the air is."}

    from airfield import in_service_area
    F = deps.field()
    lat, lon = body.lat, body.lon
    have_pos = (lat is not None and lon is not None
                and in_service_area(lat, lon))

    want_park = bool(_PARK.search(q))
    running = bool(_RUN.search(q))
    wants_when = bool(_WHEN.search(q))
    wants_here = bool(_AQI.search(q)) and re.search(
        r"\b(here|now|right now|my|outside)\b", q, re.I) and not want_park

    # ── "how's the air here" intent — pure readout, no place card ──
    if wants_here and have_pos:
        try:
            import districts as _d
            pm = float(F.value(lat, lon))
            aqi = _d.us_aqi(pm)
            cat, _c = _d.cpcb_band(_d.cpcb_aqi(pm))
            win = await _window_at(lat, lon)
            say = (f"Right where you are the air reads about {aqi} (US AQI) — "
                   f"{cat.lower()}. PM2.5 sits near {pm:.0f} µg/m³.")
            if win:
                say += (f" The lightest stretch today is "
                      f"{_fmt_hhmm(win['start'])}–{_fmt_hhmm(win['end'])}.")
            return {"ok": True, "intent": "aqi_here", "say": say,
                    "card": None, "window": win}
        except Exception:
            pass

    # ── place recommendation — purest ranked, intent-shaped ──
    from .city import purest_places, _districts_payload
    dpay, _b = _districts_payload(F)
    res = purest_places(F, dpay.get("districts") or [],
                        lat, lon, 15.0 if have_pos else None)
    places = res.get("places") or []
    pick = _place_pick(places, want_park or running or wants_when or not wants_here)

    if pick is None:
        return {"ok": True, "intent": "go_out", "say":
                "I can't rank a place on honest data right now — "
                "the live field is thin. Try again in a few minutes.",
                "card": None, "window": None}

    win = await _window_at(pick["lat"], pick["lon"])
    km = pick.get("dist_km")
    near = f"{km:g} km away" if km else "in NCR"
    park_word = "park" if pick.get("kind") == "park" else "spot"

    say = (f"{pick['name']} — {near}. The air there reads about "
           f"{pick['aqi']} (US AQI), the cleanest {park_word} I can "
           f"vouch for right now.")
    if win:
        say += (f" Go {_fmt_hhmm(win['start'])}–{_fmt_hhmm(win['end'])} "
                f"— the lightest window of the day there.")
    if running:
        say += " You'll breathe ~3× harder on a run — that window matters double."

    # the whole track on one answer: kids get their own honest window,
    # indoors is named when the air says so, stubble smoke is called out
    extras = []
    kids = _decision_line(win, "kids outdoors", "school outdoors")
    if kids:
        extras.append(f"with kids? {kids.lower()}.")
    wins = _decision_line(win, "windows open", "stay in")
    fires = _fires_today()
    if fires and fires.get("n"):
        extras.append(f"{fires['n']} farm fires detected today — the smoke's real.")
    elif wins:
        extras.append(f"indoors: {wins.lower()}.")

    why_bits = []
    if pick.get("monitored"):
        why_bits.append("named monitor nearby")
    elif res.get("solid_rule"):
        why_bits.append("satellite + model read")
    if win and win.get("pm25_mid") is not None:
        why_bits.append(f"~{round(win['pm25_mid'])} µg/m³ at its lightest")

    return {
        "ok": True,
        "intent": "run" if running else "go_out",
        "say": say,
        "card": {
            "name": pick["name"], "lat": pick["lat"], "lon": pick["lon"],
            "aqi": pick["aqi"], "band": pick.get("category"),
            "color": pick.get("color"), "pm25": pick.get("pm25"),
            "kind": pick.get("kind"), "km": km,
            "area": pick.get("area"),
            "monitored": bool(pick.get("monitored")),
            "why": " · ".join(why_bits) or None,
        },
        "window": win,
        "extras": extras,
        "solid_rule": res.get("solid_rule"),
    }
