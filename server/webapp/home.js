/* Alive webapp — home. The live air card for where you stand + the
   four doors. Numbers come from /aqi at your point; the plain-words
   line from /v2/why; every number states its basis and age. */
(() => {
'use strict';

const DOORS = [
  { id: 'whereto', ico: '⇄', t: 'where to', s: 'the cleanest way from A to B — priced in breath' },
  { id: 'airmap',  ico: '◉', t: 'air around me', s: 'the map of what Delhi is breathing, down to the street' },
  { id: 'purest',  ico: '◍', t: 'purest places', s: 'where the air is lightest right now — stays ranked by it' },
];

let cur = { pos: null, label: null };
let whyT = null;

async function loadAir(el, lat, lon) {
  const card = el.querySelector('.air-card');
  const [aqi, why] = await Promise.all([
    A.api.get(`/aqi?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`),
    A.api.get(`/v2/why?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, 9000),
  ]);
  if (!aqi || aqi.pm25 == null) {
    card.querySelector('.air-num .v').textContent = '—';
    card.querySelector('.air-why').textContent =
      'no reading here — the field only covers Delhi NCR';
    return;
  }
  const b = A.fmt.band(aqi.pm25);
  card.querySelector('.bandwash').style.background = b ? b.wash : 'transparent';
  card.querySelector('.air-num .v').textContent = Math.round(aqi.pm25);
  const w = card.querySelector('.air-word');
  if (b) { w.textContent = b.name; w.style.color = b.color; }
  const segs = card.querySelectorAll('.bandscale .seg');
  segs.forEach((s, i) => s.classList.toggle('me', b && i === b.i));
  const sub = card.querySelector('.air-sub');
  sub.innerHTML = '';
  const met = [
    aqi.pm10 != null ? ['pm10', aqi.pm10] : null,
    aqi.no2 != null ? ['no₂', aqi.no2] : null,
    aqi.us_aqi != null ? ['us aqi', aqi.us_aqi] : null,
  ].filter(Boolean);
  met.forEach(([k, v]) => {
    const d = document.createElement('span');
    d.className = 'm';
    d.innerHTML = `<b>${Math.round(v)}</b> ${k}`;
    sub.appendChild(d);
  });
  if (aqi.beyond_field_edge) {
    card.querySelector('.air-why').textContent = 'near the field edge — this read leans on the model';
  } else if (why && why.line) {
    card.querySelector('.air-why').textContent = why.line;
  }
  const ageEl = card.querySelector('.air-age');
  if (aqi.nearest_station_km != null)
    ageEl.textContent = `station ${aqi.nearest_station_km.toFixed(1)} km away`;
}

function setLocChip(label, bandPm) {
  const chip = document.getElementById('loc-chip');
  chip.hidden = false;
  const b = bandPm != null ? A.fmt.band(bandPm) : null;
  chip.innerHTML = `<span class="dot" style="background:${b ? b.color : 'var(--accent)'}"></span><span class="txt"></span>`;
  chip.querySelector('.txt').textContent = label || 'Delhi';
}

async function refresh(el) {
  const pos = cur.pos;
  if (!pos) {
    setLocChip('pick your point on the map');
    return;
  }
  const card = el.querySelector('.air-card');
  card.querySelector('.air-num .v').innerHTML = '<span class="sk" style="display:inline-block;width:84px;height:44px"></span>';
  loadAir(el, pos.lat, pos.lon).then(async () => {
    const aqi = await A.api.get(`/aqi?lat=${pos.lat.toFixed(4)}&lon=${pos.lon.toFixed(4)}`);
    const label = cur.label || (await A.search.reverse(pos.lat, pos.lon)) || 'your spot';
    cur.label = label;
    setLocChip(label, aqi && aqi.pm25);
  });
}

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
          <div class="air-why"></div>
          <div class="bandscale">${[0, 1, 2, 3, 4, 5].map((i) => `<span class="seg" style="background:var(--b${i})"></span>`).join('')}</div>
        </div>
        <div class="doors"></div>
      </div>`;

    // doors — only the ones whose screens exist (no dead buttons)
    const doors = el.querySelector('.doors');
    const renderDoors = () => {
      doors.innerHTML = '';
      DOORS.forEach((d) => {
        if (!A.screensReady || !A.screensReady[d.id]) return;
        const b = document.createElement('button');
        b.className = 'door'; b.type = 'button';
        b.innerHTML = `<span class="d-i">${d.ico}</span><div class="d-t">${d.t}</div><div class="d-s">${d.s}</div>`;
        b.addEventListener('click', () => { location.hash = '#/' + d.id; });
        doors.appendChild(b);
      });
    };
    renderDoors();

    // position: consented gps, a picked map point, or Delhi centroid
    const applyPos = (pos) => {
      cur.pos = pos || { lat: A.DELHI.lat, lon: A.DELHI.lon };
      if (!pos) cur.label = 'central Delhi';
      A.map.fly(cur.pos.lat, cur.pos.lon, Math.max(11.4, (A.map.map && A.map.map.getZoom()) || 0));
      if (pos && pos.acc) A.map.puckMove(pos.lat, pos.lon, pos.acc);
      refresh(el);
    };
    if (A.geo.pos) applyPos(A.geo.pos);
    else if (A.geo.granted()) {
      A.geo.locate().then(applyPos).catch(() => applyPos(null));
    } else applyPos(null);

    const onLoc = (e) => applyPos(e.detail);
    const onTap = async (e) => {
      if (A.current() !== 'home') return;
      if (A.geo.consent !== 'picked' && A.geo.granted()) return; // real gps wins
      const p = e.detail;
      applyPos({ lat: p.lat, lon: p.lon });
      A.map.puckMove(p.lat, p.lon, null);
    };
    document.addEventListener('alive:location', onLoc);
    document.addEventListener('alive:maptap', onTap);
    document.getElementById('loc-chip').addEventListener('click', () => {
      const c = document.getElementById('consent');
      c.hidden = false;
    });

    A.map.setFieldVisible(false);   // home stays calm — air map is its own door
    return () => {
      document.removeEventListener('alive:location', onLoc);
      document.removeEventListener('alive:maptap', onTap);
      clearTimeout(whyT);
      A.map.puckRemove();
    };
  },
});
})();
