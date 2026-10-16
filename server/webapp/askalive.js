/* Alive webapp — Ask ALive. The little bot that lives in the corner.

   the FAB    — a round companion with eyes that follow your finger,
                blinks sometimes, never covers the nav chrome
   the sheet  — a chat surface. you ask plainly ("where can I run
                today?"), ALive answers with ONE real place — name,
                live read, the day's lightest window, and a tiny drawn
                map of the walk there. nothing typed is stored; the
                origin's name never leaves the phone (the card says
                "near you", the map draws from where you are).
*/

(function () {
'use strict';
const A = window.A;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── the face ──────────────────────────────────────────────── */
/* a soft rounded square — organic, alive. eyes are two pills that
   lean toward wherever you're touching/scrolling; they blink on a
   slow timer and go wide when a reply lands. */
function botFace(size, mood) {
  return `<span class="ak-face ${mood || ''}" style="--ak-s:${size}px"><b>a</b></span>`;
}

let fabEl = null, pupils = null, blinkT = 0, faceState = 'idle';
function mountFab() {
  if (fabEl) return;
  fabEl = document.createElement('button');
  fabEl.className = 'ak-fab';
  fabEl.type = 'button';
  fabEl.setAttribute('aria-label', 'ask ALive');
  fabEl.innerHTML = botFace(44);
  document.body.appendChild(fabEl);
  pupils = fabEl.querySelectorAll('.ak-eye i');
  fabEl.addEventListener('click', () => A.show('ask', {}));

  /* eyes lean toward the pointer; on touch screens, toward scroll
     velocity — the bot watches the page breathe */
  const lean = (dx, dy) => {
    const x = Math.max(-1, Math.min(1, dx)) * 3.2;
    const y = Math.max(-1, Math.min(1, dy)) * 2.4;
    pupils.forEach((p) => { p.style.transform = `translate(${x}px,${y}px)`; });
  };
  document.addEventListener('pointermove', (e) => {
    if (!fabEl.isConnected) return;
    const r = fabEl.getBoundingClientRect();
    lean((e.clientX - (r.left + r.width / 2)) / 220,
         (e.clientY - (r.top + r.height / 2)) / 220);
  }, { passive: true });
  let lastY = window.scrollY;
  document.addEventListener('scroll', () => {
    const dy = window.scrollY - lastY; lastY = window.scrollY;
    lean(0, dy / 40);
  }, { passive: true, capture: true });

  const blink = () => {
    if (!fabEl.isConnected) return;
    fabEl.classList.add('ak-blink');
    setTimeout(() => fabEl && fabEl.classList.remove('ak-blink'), 160);
    blinkT = setTimeout(blink, 2600 + Math.random() * 3400);
  };
  blinkT = setTimeout(blink, 3200);
}
function faceMood(m, ms) {
  if (!fabEl) return;
  faceState = m;
  fabEl.classList.remove('ak-m-happy', 'ak-m-think', 'ak-m-love');
  if (m !== 'idle') {
    fabEl.classList.add('ak-m-' + m);
    setTimeout(() => fabEl && fabEl.classList.remove('ak-m-' + m), ms || 2600);
  }
}

/* ── the chat sheet ────────────────────────────────────────── */
const SUGGEST = [
  'where can i run today?',
  'a park to record a video',
  'when should i go out?',
  'how is the air here?',
];

let st = null;
function stReset() { st = { msgs: [], busy: false, askSeq: 0 }; }

function threadEl(el) { return el.querySelector('.ak-thread'); }

function userRow(text) {
  return `<div class="ak-row me"><div class="ak-bub me">${esc(text)}</div></div>`;
}
function botTyping() {
  return `<div class="ak-row" data-typing="1"><div class="ak-bub">
    ${botFace(30, 'think')}<span class="ak-dots"><i></i><i></i><i></i></span>
  </div></div>`;
}
function bandInk(color) { return color || '#8A8D94'; }

/* tiny map inside the reply — the real walk path drawn to scale */
async function miniMapSvg(card, fromPos) {
  if (!card || !fromPos) return '';
  try {
    const j = await A.api.post('/v2/plan', {
      from: { lat: fromPos.lat, lon: fromPos.lon },
      to: { lat: card.lat, lon: card.lon },
      mode: 'health_max', activity: 'walk',
    }, 20000);
    const opts = (j && j.options) || [];
    const geo = (opts[0] && (opts[0].geometry || (opts[0].route_geojson || {}).geometry));
    const cs = geo && geo.type === 'LineString' ? geo.coordinates : null;
    if (!cs || cs.length < 2) return '';
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of cs) {
      x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]);
      y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]);
    }
    const W = 268, H = 120, pad = 14;
    const sx = (x1 - x0) || 1e-6, sy = (y1 - y0) || 1e-6;
    const k = Math.min((W - 2 * pad) / sx, (H - 2 * pad) / sy);
    const pts = cs.map((c) =>
      `${(pad + (c[0] - x0) * k).toFixed(1)},${(H - pad - (c[1] - y0) * k).toFixed(1)}`);
    const a = pts[0].split(','), b = pts[pts.length - 1].split(',');
    return `<svg class="ak-map" viewBox="0 0 ${W} ${H}" aria-label="route to ${esc(card.name)}">
      <polyline points="${pts.join(' ')}" fill="none" stroke="#7FBF9A"
        stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
      <circle cx="${a[0]}" cy="${a[1]}" r="5" fill="#EDEBE4"/>
      <path d="M ${b[0]} ${b[1] - 11} a 6.5 6.5 0 1 1 -0.01 0 M ${b[0]} ${b[1] + 2}
        l -4.4 -6.2 a 6.5 6.5 0 1 1 8.8 0 z" fill="#C05F3A" transform="translate(0,4)"/>
    </svg>`;
  } catch (e) { return ''; }
}

function botRow(d, mapHtml) {
  const c = d.card;
  const win = d.window;
  const winLine = win && win.start
    ? `<div class="ak-win">${esc(win.start)}–${esc(win.end || '')}<span class="ak-win-s"> · lightest window</span></div>` : '';
  const cardHtml = c ? `
    <div class="ak-card">
      <div class="ak-card-t">${esc(c.name)}</div>
      <div class="ak-card-m">${[
        c.km != null ? `${c.km} km away` : null,
        c.area || null,
      ].filter(Boolean).map(esc).join(' · ') || 'in Delhi NCR'}</div>
      <div class="ak-card-row">
        <span class="ak-aqi" style="background:${bandInk(c.color)}">${c.aqi}<span> aqi</span></span>
        ${c.pm25 != null ? `<span class="ak-pm">pm2.5 ~${Math.round(c.pm25)}</span>` : ''}
      </div>
      ${winLine}
      ${mapHtml || ''}
      ${c.why ? `<div class="ak-why">${esc(c.why)}</div>` : ''}
      <button class="ak-go" type="button" data-lat="${c.lat}" data-lon="${c.lon}" data-name="${esc(c.name)}">see it on the map →</button>
    </div>` : '';
  const extras = (d.extras || []).map((x) =>
    `<div class="ak-extra">${esc(x)}</div>`).join('');
  return `<div class="ak-row"><div class="ak-ava">${botFace(30)}</div>
    <div class="ak-bub"><div class="ak-say">${esc(d.say)}</div>${cardHtml}${extras}</div></div>`;
}

function renderThread(el) {
  const th = threadEl(el);
  th.innerHTML = st.msgs.join('');
  th.scrollTop = th.scrollHeight;
}

async function send(el, q) {
  if (!q || !q.trim() || st.busy) return;
  st.busy = true;
  const seq = ++st.askSeq;
  st.msgs.push(userRow(q.trim()), botTyping());
  renderThread(el);
  faceMood('think');
  const pos = A.geo && A.geo.pos;
  let d = null;
  try {
    d = await A.api.post('/v2/ask', {
      q, lat: pos ? pos.lat : null, lon: pos ? pos.lon : null,
    }, 30000);
  } catch (e) { d = null; }
  if (!st || seq !== st.askSeq) return;
  st.msgs.pop();                                   // drop typing bubble
  if (d && d.ok) {
    const mapHtml = await miniMapSvg(d.card, pos);
    if (!st || seq !== st.askSeq) return;
    st.msgs.push(botRow(d, mapHtml));
    faceMood(d.card ? 'love' : 'happy', 3000);
  } else {
    st.msgs.push(`<div class="ak-row"><div class="ak-ava">${botFace(30)}</div>
      <div class="ak-bub"><div class="ak-say">my feeds hiccuped — ask me again in a minute.</div></div></div>`);
  }
  st.busy = false;
  renderThread(el);
}

function mountAsk(el) {
  stReset();
  el.innerHTML = `
    <div class="sheet ak-sheet on">
      <div class="sheet-grab"></div>
      <div class="ak-head">
        <button class="back-btn" type="button" aria-label="back">‹</button>
        <div class="ak-hface">${botFace(40)}</div>
        <div class="ak-htext">
          <div class="ak-ht">Ask ALive</div>
          <div class="ak-hs">answers from live Delhi air — nothing guessed</div>
        </div>
      </div>
      <div class="ak-thread"></div>
      <div class="ak-sugg">
        ${SUGGEST.map((s) => `<button class="ak-chip" type="button">${esc(s)}</button>`).join('')}
      </div>
      <div class="ak-composer">
        <input class="ak-in" type="text" autocomplete="off" autocapitalize="sentences"
          placeholder="ask me where to go, when, how the air is…" enterkeyhint="send">
        <button class="ak-send" type="button" aria-label="send">↑</button>
      </div>
    </div>`;

  st.msgs.push(`<div class="ak-row"><div class="ak-ava">${botFace(30)}</div>
    <div class="ak-bub"><div class="ak-say">hey — i watch Delhi's air all day. ask me where to go or when.</div></div></div>`);
  renderThread(el);

  el.querySelector('.back-btn').addEventListener('click', () => A.back());
  const input = el.querySelector('.ak-in');
  const go = () => { const v = input.value; input.value = ''; send(el, v); };
  el.querySelector('.ak-send').addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  el.querySelectorAll('.ak-chip').forEach((b) =>
    b.addEventListener('click', () => send(el, b.textContent)));
  el.querySelector('.ak-thread').addEventListener('click', (e) => {
    const b = e.target.closest('.ak-go');
    if (!b) return;
    /* "see it on the map" — fly airmap to the pick so the suggestion
       lands somewhere real, not just in chat */
    try { A.store.set('airmap.pick', { lat: +b.dataset.lat, lon: +b.dataset.lon, label: b.dataset.name }); } catch (e2) {}
    A.show('airmap', {});
  });
  setTimeout(() => input.focus({ preventScroll: true }), 350);
}

A.screen('ask', { mount: mountAsk });

/* the FAB floats over every screen — mounted once at boot, kept clear
   of the top chrome by the safe-area + header offset in css */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountFab);
} else mountFab();
})();
