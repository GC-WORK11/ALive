#!/usr/bin/env python3
"""Audit gazetteer/corpus rows whose coordinates sit far from the
centroid of same-named rows — join/geocode artifacts (e.g. a 'Swami
Vivekanand ISBT' row planted 8.5 km from the real terminus cluster).

Method: group rows by normalized display name.  A group has a
"consensus cluster" when >=2 rows sit within TIGHT_KM of the group's
densest point; the cluster centroid is the mean of those rows.  Any
row > FLAG_KM from that centroid is flagged.  Groups with no >=2-row
cluster (singletons, fully scattered names) can't be judged — reported
as 'no consensus' rather than flagged.

Usage:
  python3 tools/audit_miscoord.py [--gaz PATH] [--corpus PATH] \
      [--flag-km 15] [--tight-km 1.0] [--out report.tsv]
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
import os
import re
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.dirname(_HERE)
DEF_GAZ = os.path.join(_REPO, "server", "data", "delhi-gazetteer.json")
DEF_CORPUS = os.path.join(_REPO, "server", "data", "corpus",
                          "delhi-corpus.jsonl.gz")

_WS = re.compile(r"\s+")
_NON = re.compile(r"[^a-z0-9 ]+")


def norm(s: str) -> str:
    s = (s or "").lower()
    s = _NON.sub(" ", s)
    return _WS.sub(" ", s).strip()


def hav_km(a, b, c, d) -> float:
    p = math.pi / 180.0
    h = (math.sin((c - a) * p / 2) ** 2 +
         math.cos(a * p) * math.cos(c * p) *
         math.sin((d - b) * p / 2) ** 2)
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def load(gaz_path, corpus_path):
    """rows: [{src, name, norm, cat, lat, lon}]"""
    rows = []
    if gaz_path and os.path.exists(gaz_path):
        for i, g in enumerate(json.load(open(gaz_path))):
            if g.get("fx"):
                continue  # planted demote rows are intentional, not bugs
            rows.append({"src": f"gaz:{i}", "name": g.get("n", ""),
                         "cat": g.get("c", ""), "lat": g["lat"],
                         "lon": g["lon"]})
    if corpus_path and os.path.exists(corpus_path):
        fh = gzip.open(corpus_path, "rt", encoding="utf-8") \
            if corpus_path.endswith(".gz") else open(corpus_path)
        with fh:
            for line in fh:
                try:
                    e = json.loads(line)
                except ValueError:
                    continue
                if not e.get("display"):
                    continue
                rows.append({
                    "src": f"cor:{e.get('id')}",
                    "name": e["display"],
                    "cat": e.get("category", ""),
                    "lat": e["lat"], "lon": e["lon"],
                    "sources": ",".join(e.get(
                        "sources", [e.get("source", "?")]))})
    for r in rows:
        r["norm"] = norm(r["name"])
    return rows


def audit(rows, flag_km, tight_km):
    groups = {}
    for r in rows:
        if len(r["norm"]) >= 3:
            groups.setdefault(r["norm"], []).append(r)

    flagged, nocons = [], 0
    multi = 0
    for n, rs in groups.items():
        if len(rs) < 2:
            continue
        multi += 1
        # densest point = row with most neighbours within tight_km
        best_i, best_c = -1, 0
        for i, r in enumerate(rs):
            c = sum(1 for q in rs
                    if q is not r
                    and hav_km(r["lat"], r["lon"], q["lat"], q["lon"])
                    <= tight_km)
            if c > best_c:
                best_i, best_c = i, c
        if best_c < 1:  # no >=2-row cluster anywhere
            nocons += 1
            continue
        seed = rs[best_i]
        clus = [q for q in rs
                if hav_km(seed["lat"], seed["lon"], q["lat"], q["lon"])
                <= tight_km]
        if len(clus) < 2:
            nocons += 1
            continue
        clat = sum(q["lat"] for q in clus) / len(clus)
        clon = sum(q["lon"] for q in clus) / len(clus)
        for q in rs:
            d = hav_km(q["lat"], q["lon"], clat, clon)
            if d > flag_km:
                flagged.append({
                    "norm": n, "name": q["name"], "cat": q["cat"],
                    "lat": q["lat"], "lon": q["lon"],
                    "centroid_lat": round(clat, 5),
                    "centroid_lon": round(clon, 5),
                    "km": round(d, 1), "src": q["src"],
                    "cluster_n": len(clus), "group_n": len(rs),
                    "sources": q.get("sources", ""),
                })
    flagged.sort(key=lambda f: -f["km"])
    return flagged, multi, nocons


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--gaz", default=DEF_GAZ)
    ap.add_argument("--corpus", default=DEF_CORPUS)
    ap.add_argument("--flag-km", type=float, default=15.0)
    ap.add_argument("--tight-km", type=float, default=1.0)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    rows = load(a.gaz, a.corpus)
    flagged, multi, nocons = audit(rows, a.flag_km, a.tight_km)
    lines = ["# mis-coord audit — rows >%.0f km from their namesake "
             "centroid" % a.flag_km,
             f"# rows: {len(rows):,} | multi-name groups: {multi:,} | "
             f"no-consensus groups: {nocons:,} | flagged: {len(flagged):,}",
             "km\tname\tcat\tlat\tlon\tcentroid\tsrc\tcluster_n/group_n"]
    for f in flagged:
        lines.append(
            f"{f['km']}\t{f['name']}\t{f['cat']}\t{f['lat']},{f['lon']}"
            f"\t{f['centroid_lat']},{f['centroid_lon']}\t{f['src']}"
            f"\t{f['cluster_n']}/{f['group_n']}")
    text = "\n".join(lines) + "\n"
    if a.out:
        open(a.out, "w").write(text)
        print(f"wrote {a.out}")
    print("\n".join(lines[:40]))
    if len(lines) > 40:
        print(f"... ({len(lines) - 40} more lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
