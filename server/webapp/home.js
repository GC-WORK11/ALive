/* Alive webapp — home. The consent layer + the live air card for your
   point + the doors. Every number on the card traces to /aqi (pm25,
   pm10, no2, us_aqi, pm25_lo/hi, nearest_station_km, beyond_field_edge,
   field.built_epoch/age_s/stale, typical) and /v2/why ({line}).
   Re-reads /aqi every 5 min while mounted; nothing is ever invented. */
(() => {
'use strict';

const DOORS = [
  { id: 'whereto', ico: '⇄', t: 'where to', s: 'the cleanest way from A to B — priced in breath' },
  { id: 'airmap',  ico: '◉', t: 'air around me', s: 'the map of what Delhi is breathing, down to the street' },
  { id: 'purest',  ico: '◍', t: 'purest places', s: 'where the air is lightest right now — stays ranked by it' },
];
const POLL_MS = 5 * 60 * 1000;   // field TTL is 15 min — a 5-min read stays honest
const TICK_MS = 30 * 1000;       // freshness text ages quietly, no network
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

let cur = { pos: null, label: null, aqi: null, why: null, tried: false, fallback: false };

/* ── consent ─────────────────────────────────────────────────────────
   The #consent markup is this lane's. app.js wires the buttons only on
   a first unanswered visit; we answer them ourselves here — capture on
   the layer swallows the click before it can reach the buttons — so
   re-consent from the loc-chip works in every state. */
function wireConsentLayer() {
  const layer = document.getElementById('consent');
  if (!layer || layer.dataset.wired) return;
  layer.dataset.wired = '1';
  layer.addEventListener('click', (e) => {
    if (e.target.closest('#consent-yes')) { e.stopPropagation(); answer('gps'); }
    else if (e.target.closest('#consent-skip')) { e.stopPropagation(); answer('picked'); }
    else if (e.target === layer && A.geo.consent) { layer.hidden = true; }
  }, true);
}

async function answer(mode) {
  const layer = document.getElementById('consent');
  layer.hidden = true;
  if (mode === 'gps') {
    A.geo.consent = 'granted'; A.store.set('consent', 'granted');
    try {
      const pos = await A.geo.locate();
      document.dispatchEvent(new CustomEvent('alive:location', { detail: pos }));
    } catch (err) {
      // refused or timed out — never a dead end: become pick-a-point
      A.geo.consent = 'picked'; A.store.set('consent', 'picked');
      A.toast('location refused — tap the map where you are');
      document.dispatchEvent(new CustomEvent('alive:location', { detail: null }));
    }
    return;
  }
  A.geo.consent = 'picked'; A.store.set('consent', 'picked');
  A.toast('tap anywhere on the map — that becomes your spot');
  document.dispatchEvent(new CustomEvent('alive:location', { detail: null }));
}

function openConsent() {
  const layer = document.getElementById('consent');
  const note = layer.querySelector('.consent-note');
  if (note) {
    note.hidden = true;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then((r) => { note.hidden = r.state !== 'denied'; })
        .catch(() => {});
    }
  }
  layer.hidden = false;
}

/* ── the air card ─────────────────────────────────────────────────── */
function daypart(h) {
  if (h == null) return 'day';
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function freshness(aqi) {
  const f = aqi && aqi.field;
  if (!f) return null;
  const ep = f.built_epoch || (f.age_s != null ? Date.now() / 1000 - f.age_s : null);
  const bits = [];
  if (ep) bits.push(f.stale ? `stale · ${A.fmt.ago(ep)}` : A.fmt.ago(ep));
  else if (f.stale) bits.push('stale');
  if (aqi.nearest_station_km != null) bits.push(`station ${A.fmt.km(aqi.nearest_station_km)}`);
  return bits.filter(Boolean).join(' · ') || null;
}

function renderAir(el) {
  const card = el.querySelector('.air-card');
  if (!card) return;
  const aqi = cur.aqi;
  const num = card.querySelector('.air-num .v');
  const word = card.querySelector('.air-word');
  const sub = card.querySelector('.air-sub');
  const whyEl = card.querySelector('.air-why');
  const ageEl = card.querySelector('.air-age');
  const ctxEl = card.querySelector('.air-ctx');
  const hintEl = card.querySelector('.air-hint');
  const wash = card.querySelector('.bandwash');
  const segs = card.querySelectorAll('.bandscale .seg');

  card.querySelector('.air-label').textContent =
    cur.fallback ? 'the air · central delhi' : 'the air where you are';
  hintEl.hidden = !(cur.fallback && A.geo.consent === 'picked');

  if (!cur.tried) {                                   // first read in flight
    num.innerHTML = '<span class="sk" style="display:inline-block;width:86px;height:46px"></span>';
    word.textContent = ''; sub.innerHTML = ''; ctxEl.textContent = '';
    whyEl.textContent = 'reading the air here…';
    ageEl.textContent = '';
    return;
  }
  if (!aqi || aqi.pm25 == null) {                     // honest empty
    num.textContent = '—';
    word.textContent = '';
    wash.style.background = 'transparent';
    segs.forEach((s) => s.classList.remove('me'));
    sub.innerHTML = ''; ctxEl.textContent = '';
    ageEl.textContent = '';
    whyEl.textContent = (aqi && aqi.error)
      ? 'outside delhi ncr — the field doesn’t reach here'
      : 'no honest read for this point right now';
    return;
  }

  const b = A.fmt.band(aqi.pm25);
  wash.style.background = b ? b.wash : 'transparent';
  num.textContent = Math.round(aqi.pm25);
  if (b) { word.textContent = b.name; word.style.color = b.color; }
  else word.textContent = '';
  segs.forEach((s, i) => s.classList.toggle('me', !!b && i === b.i));

  const met = [
    aqi.pm10 != null ? ['pm10', aqi.pm10] : null,
    aqi.no2 != null ? ['no₂', aqi.no2] : null,
    aqi.us_aqi != null ? ['us aqi', aqi.us_aqi] : null,
  ].filter(Boolean);
  sub.innerHTML = met.map(([k, v]) => `<span class="m"><b>${Math.round(v)}</b> ${k}</span>`).join('');

  // provenance line — the model's own spread + the season comparison
  const ctx = [];
  if (aqi.pm25_lo != null && aqi.pm25_hi != null && aqi.pm25_hi > aqi.pm25_lo)
    ctx.push(`likely ${Math.round(aqi.pm25_lo)}–${Math.round(aqi.pm25_hi)}`);
  const t = aqi.typical;
  if (t && t.vs_now_pct != null && t.median != null) {
    const pct = Math.round(Math.abs(t.vs_now_pct));
    ctx.push(`${pct}% ${t.vs_now_pct <= 0 ? 'under' : 'over'} a usual ${MONTHS[t.month - 1] || ''} ${daypart(t.hour_ist)}`);
  }
  ctxEl.textContent = ctx.join(' · ');

  if (aqi.beyond_field_edge) {
    whyEl.textContent = 'right at the field’s edge — the model is filling in, treat this as a guess';
  } else {
    whyEl.textContent = (cur.why && cur.why.line) || '';
  }
  ageEl.textContent = freshness(aqi) || '';
}

async function loadAir(el) {
  const pos = cur.pos;
  if (!pos) return;
  const [aqi, why] = await Promise.all([
    A.api.get(`/aqi?lat=${pos.lat.toFixed(5)}&lon=${pos.lon.toFixed(5)}`),
    A.api.get(`/v2/why?lat=${pos.lat.toFixed(5)}&lon=${pos.lon.toFixed(5)}`, 9000),
  ]);
  if (!el.isConnected || pos !== cur.pos) return;   // moved on — drop stale read
  cur.tried = true;
  // a failed poll keeps the last honest read on screen (its age keeps
  // counting via built_epoch); a failed FIRST read shows the empty state
  if (aqi !== null || cur.aqi == null) cur.aqi = aqi;
  if (why !== null || cur.why == null) cur.why = why;
  renderAir(el);
  setChip();
}

async function setChip() {
  const chip = document.getElementById('loc-chip');
  if (!chip) return;
  chip.hidden = false;
  const pm = cur.aqi && cur.aqi.pm25;
  const b = pm != null ? A.fmt.band(pm) : null;
  if (!cur.label && cur.pos && !cur.fallback)
    cur.label = await A.search.reverse(cur.pos.lat, cur.pos.lon);
  const label = cur.label || (cur.fallback ? 'central delhi' : 'your spot');
  chip.innerHTML = `<span class="dot" style="background:${b ? b.color : 'var(--accent)'}"></span><span class="txt"></span>`;
  chip.querySelector('.txt').textContent = label;
}

/* ── the screen ───────────────────────────────────────────────────── */
A.screen('home', {
  mount(el) {
    el.innerHTML = `
      <div class="home-panel">
        <div class="air-card">
          <div class="bandwash"></div>
          <div class="air-head">
            <div class="air-label">the air where you are</div>
            <div class="air-age"></div>
          </div>
          <div class="air-num">
            <span class="v">—</span><span class="u">µg/m³ pm2.5</span>
            <span class="air-word"></span>
          </div>
          <div class="air-sub"></div>
          <div class="air-ctx"></div>
          <div class="air-why"></div>
          <div class="air-hint" hidden>showing central delhi — tap the map for your spot</div>
          <div class="bandscale">${[0, 1, 2, 3, 4, 5].map((i) => `<span class="seg" style="background:var(--b${i})"></span>`).join('')}</div>
        </div>
        <div class="doors"></div>
      </div>`;

    // doors — only ones whose screens registered (no dead buttons)
    const doors = el.querySelector('.doors');
    DOORS.forEach((d) => {
      if (!A.screensReady || !A.screensReady[d.id]) return;
      const b = document.createElement('button');
      b.className = 'door'; b.type = 'button';
      b.innerHTML = `<span class="d-i">${d.ico}</span><div class="d-t">${d.t}</div><div class="d-s">${d.s}</div>`;
      b.addEventListener('click', () => { location.hash = '#/' + d.id; });
      doors.appendChild(b);
    });

    wireConsentLayer();
    const chip = document.getElementById('loc-chip');
    const onChip = () => openConsent();
    if (chip) chip.addEventListener('click', onChip);

    const applyPos = (pos) => {
      const changed = !cur.pos || !pos ||
        cur.pos.lat !== pos.lat || cur.pos.lon !== pos.lon;
      cur.fallback = !pos;
      cur.pos = pos || { lat: A.DELHI.lat, lon: A.DELHI.lon };
      if (changed) {
        cur.label = (pos && pos.label) || null;
        cur.tried = false;
        renderAir(el);
        A.map.ready((m) => A.map.fly(cur.pos.lat, cur.pos.lon, Math.max(11.4, m.getZoom())));
      }
      if (pos && pos.acc) A.map.puckMove(pos.lat, pos.lon, pos.acc);
      else if (pos) A.map.puckMove(pos.lat, pos.lon, null);
      else A.map.puckRemove();   // no fake puck on the fallback point
      loadAir(el);
    };

    if (A.geo.pos) applyPos(A.geo.pos);
    else if (A.geo.granted()) {
      A.geo.locate().then(applyPos).catch(() => {
        A.geo.consent = 'picked'; A.store.set('consent', 'picked');
        A.toast('couldn’t reach your gps — tap the map instead');
        applyPos(null);
      });
    } else applyPos(null);

    const onLoc = (e) => {
      if (e.detail) applyPos(e.detail);
      else if (!cur.pos) applyPos(null);
      // null with a live point → keep the spot they already had
    };
    const onTap = (e) => {
      if (A.current() !== 'home') return;
      if (A.geo.consent !== 'picked') return;    // real gps wins
      applyPos({ lat: e.detail.lat, lon: e.detail.lon });
    };
    const onField = () => renderAir(el);          // field rebuilt — refresh age text
    document.addEventListener('alive:location', onLoc);
    document.addEventListener('alive:maptap', onTap);
    document.addEventListener('alive:field', onField);

    const poll = setInterval(() => {
      if (!document.hidden && el.isConnected && cur.pos) loadAir(el);
    }, POLL_MS);
    const tick = setInterval(() => {
      if (el.isConnected && cur.tried && cur.aqi && cur.aqi.pm25 != null) {
        const ageEl = el.querySelector('.air-age');
        if (ageEl) ageEl.textContent = freshness(cur.aqi) || '';
      }
    }, TICK_MS);

    A.map.setFieldVisible(false);   // home stays calm — the air map is its own door
    return () => {
      document.removeEventListener('alive:location', onLoc);
      document.removeEventListener('alive:maptap', onTap);
      document.removeEventListener('alive:field', onField);
      if (chip) chip.removeEventListener('click', onChip);
      clearInterval(poll);
      clearInterval(tick);
      A.map.puckRemove();
    };
  },
});
})();
