#!/usr/bin/env bash
# End-to-end smoke for ALive against BASE (default prod CloudFront).
# Usage: bash smoke.sh [BASE]   e.g. bash smoke.sh http://127.0.0.1:8108
BASE="${1:-https://d2eh2l2ys9wkij.cloudfront.net}"
python3 - "$BASE" <<'EOF'
import json, sys, time, urllib.request, urllib.parse, hashlib
B = sys.argv[1].rstrip('/')
ok = fail = 0
def req(path, body=None, timeout=60):
    t = time.time()
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(B + path, data=data, method='POST' if data else 'GET',
                               headers={'Content-Type': 'application/json'} if data else {})
    try:
        resp = urllib.request.urlopen(r, timeout=timeout); raw = resp.read()
        return resp.status, raw, int((time.time() - t) * 1000)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), int((time.time() - t) * 1000)
    except Exception as e:
        return 0, str(e).encode(), int((time.time() - t) * 1000)
def check(name, cond, detail):
    global ok, fail
    ok += bool(cond); fail += (not cond)
    print(f"{'PASS' if cond else 'FAIL'}  {name:34} {detail}")
s, raw, ms = req('/health'); h = json.loads(raw) if s == 200 else {}
check('health', s == 200 and not h.get('field_stale'), f"build {h.get('build_sha')} field_age {h.get('field_age_s')}s {ms}ms")
s, raw, ms = req('/v2/p/status'); st = json.loads(raw) if s == 200 else {}
check('providers configured', s == 200 and st.get('ola') and st.get('tomtom'), f"{ {k: st.get(k) for k in ('ola','tomtom','mappls')} } {ms}ms")
s, raw, ms = req('/v2/ac?' + urllib.parse.urlencode({'q': 'new delhi rail', 'lat': 28.6315, 'lon': 77.2167}))
r = (json.loads(raw).get('results') or [{}]) if s == 200 else [{}]
check('/v2/ac prefix', s == 200 and 'new delhi' in (r[0].get('name') or '').lower(), f"#1 {r[0].get('name')!r} {ms}ms")
for q, lat, lon, want in [('pawan bakery', 28.684, 77.300, 'pawan bak'),
                          ('neelanchal dham sant nagar', 28.5565, 77.2480, 'dha'),
                          ('iskcon east of kailash', 28.6315, 77.2167, 'iskcon')]:
    s, raw, ms = req('/v2/p/ac?' + urllib.parse.urlencode({'q': q, 'lat': lat, 'lon': lon}), timeout=20)
    rows = (json.loads(raw).get('results') or []) if s == 200 else []
    top = ' | '.join(f"{x.get('name')} · {(x.get('sub') or '')[:40]}" for x in rows[:2])
    check(f'/v2/p/ac {q[:22]}', s == 200 and any(want in (x.get('name') or '').lower() for x in rows[:3]), f"{top} {ms}ms")
s, raw, ms = req('/v2/purest?lat=28.6315&lon=77.2167')
check('/v2/purest', s == 200, f"{ms}ms {raw[:90]!r}")
s, raw, ms = req('/v2/plan', {'from': {'lat': 28.6315, 'lon': 77.2167}, 'to': {'lat': 28.5565, 'lon': 77.2480}, 'mode': 'time_health', 'vehicle': 'car'}, timeout=60)
p = json.loads(raw) if s == 200 else {}
o = (p.get('options') or [{}])[0]
check('/v2/plan time_health', s == 200 and o.get('mode_pick') is True, f"{o.get('label')} eta {o.get('eta_s')} live {o.get('live_eta_s')} +{o.get('traffic_delay_s')}s fuel {o.get('fuel_l')} why {o.get('why')!r} traffic {p.get('traffic')} {ms}ms")
s, raw, ms = req('/v2/tally', {'anon': 'smoke' + 'x' * 20, 'events': [{'event': 'app_open', 'ts': int(time.time() * 1000), 'props': {}}]})
check('/v2/tally', s in (200, 202, 204), f"{s} {raw[:80]!r} {ms}ms")
s, raw, ms = req('/app/')
html = raw.decode(errors='replace') if s == 200 else ''
need = ['digipin.js', 'telemetry.js', 'sidebar.js', 'profile.js']
check('/app/ index scripts', s == 200 and all(n in html for n in need), f"missing {[n for n in need if n not in html]} {ms}ms")
s, raw, ms = req('/app/search.js')
try: local = hashlib.md5(open(__import__('subprocess').run(['git','rev-parse','--show-toplevel'],capture_output=True,text=True).stdout.strip()+'/server/webapp/search.js','rb').read()).hexdigest()
except Exception: local = '?'
check('/app/search.js == local', s == 200 and hashlib.md5(raw).hexdigest() == local, f"{hashlib.md5(raw).hexdigest()[:8]} vs local {local[:8]}")
print(f"\n{ok} passed, {fail} failed  @ {B}")
EOF
