#!/usr/bin/env python3
"""Report total stroke length per SVG for draw-on animation timing.

Walks every element carrying `data-draw`, computes its geometric length
(same value as getTotalLength() in the browser) and prints a table.

Usage:  python3 pathlen.py            # table for all *.svg here
        python3 pathlen.py pin.svg    # one file, per-element detail
"""
import math, os, re, sys
import xml.etree.ElementTree as ET

NS = "{http://www.w3.org/2000/svg}"
TOKEN = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][+-]?\d+)?)")


def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return (u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1])


def qbez(p0, p1, p2, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


def seg_len(fn, n=240):
    a, acc = fn(0.0), 0.0
    for i in range(1, n + 1):
        b = fn(i / n)
        acc += math.hypot(b[0] - a[0], b[1] - a[1])
        a = b
    return acc


def arc_fn(p0, rx, ry, rot, laf, sf, p1):
    """SVG endpoint->center conversion; returns point-on-arc function."""
    phi = math.radians(rot)
    dx, dy = (p0[0] - p1[0]) / 2, (p0[1] - p1[1]) / 2
    x1p = math.cos(phi) * dx + math.sin(phi) * dy
    y1p = -math.sin(phi) * dx + math.cos(phi) * dy
    rx, ry = abs(rx), abs(ry)
    lam = x1p**2 / rx**2 + y1p**2 / ry**2
    if lam > 1:
        s = math.sqrt(lam); rx, ry = rx * s, ry * s
    num = rx**2 * ry**2 - rx**2 * y1p**2 - ry**2 * x1p**2
    den = rx**2 * y1p**2 + ry**2 * x1p**2
    co = math.sqrt(max(0.0, num / den)) * (-1 if laf == sf else 1)
    cxp = co * rx * y1p / ry
    cyp = -co * ry * x1p / rx
    cx = math.cos(phi) * cxp - math.sin(phi) * cyp + (p0[0] + p1[0]) / 2
    cy = math.sin(phi) * cxp + math.cos(phi) * cyp + (p0[1] + p1[1]) / 2
    def ang(ux, uy):
        d = math.hypot(ux, uy)
        a = math.acos(max(-1, min(1, ux / d)))
        return -a if uy < 0 else a
    t1 = ang((x1p - cxp) / rx, (y1p - cyp) / ry)
    t2 = ang((-x1p - cxp) / rx, (-y1p - cyp) / ry)
    dt = t2 - t1
    if not sf and dt > 0: dt -= 2 * math.pi
    if sf and dt < 0: dt += 2 * math.pi
    def f(t):
        a = t1 + dt * t
        return (cx + rx * math.cos(phi) * math.cos(a) - ry * math.sin(phi) * math.sin(a),
                cy + rx * math.sin(phi) * math.cos(a) + ry * math.cos(phi) * math.sin(a))
    return f


def path_length(d):
    """Length of one path's `d` attribute (all commands, abs+rel)."""
    toks = [(m.group(1), m.group(2)) for m in TOKEN.finditer(d)]
    nums = [float(t[1]) if t[1] is not None else t[0] for t in toks]
    i, cur, start, cmd = 0, (0.0, 0.0), (0.0, 0.0), None
    prev_c2 = prev_q = None
    total = 0.0
    def take(k):
        nonlocal i
        v = nums[i:i + k]; i += k
        return v
    while i < len(nums):
        if isinstance(nums[i], str):
            cmd = nums[i]; i += 1
        rel = cmd.islower(); c = cmd.upper()
        try:
            if c == 'M':
                x, y = take(2)
                cur = (cur[0] + x, cur[1] + y) if rel else (x, y)
                start = cur; cmd = 'l' if rel else 'L'
            elif c == 'L':
                x, y = take(2)
                p = (cur[0] + x, cur[1] + y) if rel else (x, y)
                total += math.hypot(p[0] - cur[0], p[1] - cur[1]); cur = p
            elif c == 'H':
                x = take(1)[0]
                p = (cur[0] + x, cur[1]) if rel else (x, cur[1])
                total += abs(p[0] - cur[0]); cur = p
            elif c == 'V':
                y = take(1)[0]
                p = (cur[0], cur[1] + y) if rel else (cur[0], y)
                total += abs(p[1] - cur[1]); cur = p
            elif c == 'C':
                x1, y1, x2, y2, x, y = take(6)
                p1, p2, p = (x1, y1), (x2, y2), (x, y)
                if rel:
                    p1 = (p1[0] + cur[0], p1[1] + cur[1]); p2 = (p2[0] + cur[0], p2[1] + cur[1]); p = (p[0] + cur[0], p[1] + cur[1])
                a = cur
                total += seg_len(lambda t: bez(a, p1, p2, p, t))
                prev_c2 = p2; cur = p
            elif c == 'S':
                x2, y2, x, y = take(4)
                p2, p = (x2, y2), (x, y)
                if rel:
                    p2 = (p2[0] + cur[0], p2[1] + cur[1]); p = (p[0] + cur[0], p[1] + cur[1])
                p1 = (2 * cur[0] - prev_c2[0], 2 * cur[1] - prev_c2[1]) if prev_c2 else cur
                a = cur
                total += seg_len(lambda t: bez(a, p1, p2, p, t))
                prev_c2 = p2; cur = p
            elif c == 'Q':
                x1, y1, x, y = take(4)
                p1, p = (x1, y1), (x, y)
                if rel:
                    p1 = (p1[0] + cur[0], p1[1] + cur[1]); p = (p[0] + cur[0], p[1] + cur[1])
                a = cur
                total += seg_len(lambda t: qbez(a, p1, p, t))
                prev_q = p1; cur = p
            elif c == 'T':
                x, y = take(2)
                p = (cur[0] + x, cur[1] + y) if rel else (x, y)
                p1 = (2 * cur[0] - prev_q[0], 2 * cur[1] - prev_q[1]) if prev_q else cur
                a = cur
                total += seg_len(lambda t: qbez(a, p1, p, t))
                prev_q = p1; cur = p
            elif c == 'A':
                rx, ry, rot, laf, sf, x, y = take(7)
                p = (cur[0] + x, cur[1] + y) if rel else (x, y)
                total += seg_len(arc_fn(cur, rx, ry, rot, int(laf), int(sf), p))
                cur = p
            elif c == 'Z':
                total += math.hypot(start[0] - cur[0], start[1] - cur[1]); cur = start
        except IndexError:
            break
        if c not in 'CcSs': prev_c2 = None
        if c not in 'QqTt': prev_q = None
    return total


def circle_length(cx, cy, r):
    return 2 * math.pi * r


def report(path, detail=False):
    tree = ET.parse(path)
    total = 0.0
    for el in tree.getroot().iter():
        if el.get("data-draw") is None:
            continue
        tag = el.tag.replace(NS, "")
        if tag == "path":
            n = path_length(el.get("d", ""))
        elif tag == "circle":
            n = circle_length(float(el.get("cx", 0)), float(el.get("cy", 0)), float(el.get("r", 0)))
        else:
            continue
        total += n
        if detail:
            print(f"    <{tag}> {n:9.1f} u")
    return total


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    if len(sys.argv) > 1:
        for f in sys.argv[1:]:
            print(f"{os.path.basename(f)}:")
            print(f"  total {report(os.path.join(here, f), detail=True):9.1f} u")
        return
    rows = []
    for f in sorted(os.listdir(here)):
        if f.endswith(".svg"):
            rows.append((f, report(os.path.join(here, f))))
    for f, n in rows:
        print(f"{f:16s} {n:9.1f} u")
    print(f"{'TOTAL':16s} {sum(n for _, n in rows):9.1f} u")


if __name__ == "__main__":
    main()
