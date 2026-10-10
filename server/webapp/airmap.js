/* Alive webapp — air around me. The live field painted on the real
   map (WHO/CPCB band colors, street level), tap any point for the
   readout, and the 'planning to go out' card for the best hour. */
(() => {
'use strict';

let readEl = null, planEl = null, tapMarker = null;

function readCard() {
  if (!readEl) {
    readEl = document.createElement('div');
    readEl.className = 'am-read';
    document.body.appendChild(readEl);
  }
  return readEl;
}

async function tapRead(lat, lon) {
  const el = readCard();
  el.hidden = false;
  el.innerHTML = `<div class="sk" style="width:130px;height:34px"></div>`;
  const j = await A.api.get(`/aqi?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, 9000);
  if (!j || j.pm25 == null) {
    el.innerHTML = `<div class="am-plain">outside the field — no honest read</div>`;
    return;
  }
  const b = A.fmt.band(j.pm25);
  el.innerHTML = `
    <div class="am-num" style="color:${b ? b.color : 'var(--ink)'}">${Math.round(j.pm25)}</div>
    <div class="am-u">µg/m³${b ? ` · ${b.name}` : ''}</div>
    <button class="am-x" type="button" aria-label="close">✕</button>`;
  el.querySelector('.am-x').addEventListener('click', () => {
    el.hidden = true;
    if (tapMarker) { tapMarker.remove(); tapMarker = null; }
  });
  if (tapMarker) tapMarker.remove();
  const pin = document.createElement('div');
  pin.className = 'alive-pin';
  pin.innerHTML = `<div class="pin-dot" style="background:${b ? b.color : 'var(--accent)'}"></div>`;
  A.map.ready((m) => {
    tapMarker = new maplibregl.Marker({ element: pin }).setLngLat([lon, lat]).addTo(m);
  });
}

/* planning to go out — best hours card for a point */
async function planCard(lat, lon, body) {
  body.innerHTML = `
    <div class="sec-label">planning to go out</div>
    <div class="am-plan-note muted">reading the next 24 hours at this spot…</div>`;
  const d = await A.api.get(`/v2/playtime?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`, 18000);
  if (!d || !Array.isArray(d.hours) || !d.hours.length) {
    body.querySelector('.am-plan-note').textContent = 'no honest read for this spot';
    return;
  }
  const best = d.best_window;
  const worst = d.worst_window;
  const max = Math.max(...d.hours.map((h) => h.pm25_mid || 0));
  const min = Math.min(...d.hours.map((h) => h.pm25_mid || 0));
  const span = Math.max(1, max - min);
  body.innerHTML = `
    <div class="sec-label">planning to go out</div>
    ${d.verdict ? `<div class="am-verdict">${d.verdict}</div>` : ''}
    <div class="am-bars">${d.hours.map((h) => {
      const b = A.fmt.band(h.pm25_mid);
      const f = 0.18 + 0.82 * (((h.pm25_mid || 0) - min) / span);
      return `<div class="am-bar" title="${h.ist_label || ''} — ${Math.round(h.pm25_mid || 0)} µg/m³${b ? ' · ' + b.name : ''}">
        <i style="height:${Math.round(f * 100)}%;background:${b ? b.color : 'var(--ink4)'}"></i></div>`;
    }).join('')}</div>
    <div class="am-bestworst">
      ${best ? `<div class="am-bw"><span class="bw-l">lightest</span> ${best.start_label || ''}${best.end_label ? '–' + best.end_label : ''} · ${A.fmt.ugm3(best.pm25_mid)}</div>` : ''}
      ${worst ? `<div class="am-bw"><span class="bw-l">heaviest</span> ${worst.start_label || ''}${worst.end_label ? '–' + worst.end_label : ''} · ${A.fmt.ugm3(worst.pm25_mid)}</div>` : ''}
      ${d.mean_pm25 != null ? `<div class="am-bw muted">24 h average ${A.fmt.ugm3(d.mean_pm25)}</div>` : ''}
    </div>`;
}

A.screen('airmap', {
  mount(el) {
    const chrome = A.sheetChrome(el, 'air around me', null);
    const body = chrome.body;
    body.innerHTML = `
      <div class="am-legend"></div>
      <div class="muted am-hint">tap anywhere on the map — it reads the air there</div>
      <div class="am-plan"></div>`;
    const leg = body.querySelector('.am-legend');
    ['good', 'satisfactory', 'moderate', 'poor', 'very poor', 'severe'].forEach((w, i) => {
      const s = document.createElement('div');
      s.className = 'am-leg';
      s.innerHTML = `<span style="background:var(--b${i})"></span>${w}`;
      leg.appendChild(s);
    });
    A.map.setFieldVisible(true);
    A.map.fly(A.DELHI.lat, A.DELHI.lon, 10.4);

    // the last picked point (or current location) anchors "planning to go out"
    const anchor = A.geo.pos || A.DELHI;
    planCard(anchor.lat, anchor.lon, body.querySelector('.am-plan'));

    const onTap = (e) => { if (A.current() === 'airmap') tapRead(e.detail.lat, e.detail.lon); };
    document.addEventListener('alive:maptap', onTap);

    return () => {
      document.removeEventListener('alive:maptap', onTap);
      A.map.setFieldVisible(false);
      if (readEl) { readEl.hidden = true; }
      if (tapMarker) { tapMarker.remove(); tapMarker = null; }
    };
  },
});
})();
