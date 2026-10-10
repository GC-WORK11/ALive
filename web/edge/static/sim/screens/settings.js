/* settings — sim-day lane · mirrors Mobile/src/screens/SettingsScreen.tsx (cards on paper,
   switch rows, the app's own strings). Preview-honest:
     sharing      default OFF, flips locally; the caption is the app's state line
                  (strings.ts shareDataHint / shareDataHintOff) — nothing is sent from here
     language     English; हिंदी lives in the app
     this week    the preview keeps no trips — an honest empty week, no numbers
     about        "live preview — real field, simulated ride" + the field's live age (SIM.city())
     delete       the preview stores nothing — said, not faked
   CSS prefix: .stg- */
(() => {
  'use strict';
  const SIM = window.SIM;
  if (!SIM || typeof SIM.register !== 'function') return;

  const P = {
    back: 'm432-480 156 156q11 11 11 28t-11 28q-11 11-28 11t-28-11L348-452q-6-6-8.5-13t-2.5-15q0-8 2.5-15t8.5-13l184-184q11-11 28-11t28 11q11 11 11 28t-11 28L432-480Z',
    chevron: 'M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z',
    trash: 'M280-120q-33 0-56.5-23.5T200-200v-520q-17 0-28.5-11.5T160-760q0-17 11.5-28.5T200-800h160q0-17 11.5-28.5T400-840h160q17 0 28.5 11.5T600-800h160q17 0 28.5 11.5T800-760q0 17-11.5 28.5T760-720v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM400-280q17 0 28.5-11.5T440-320v-280q0-17-11.5-28.5T400-640q-17 0-28.5 11.5T360-600v280q0 17 11.5 28.5T400-280Zm160 0q17 0 28.5-11.5T600-320v-280q0-17-11.5-28.5T560-640q-17 0-28.5 11.5T520-600v280q0 17 11.5 28.5T560-280ZM280-720v520-520Z',
    info: 'M480-280q17 0 28.5-11.5T520-320v-160q0-17-11.5-28.5T480-520q-17 0-28.5 11.5T440-480v160q0 17 11.5 28.5T480-280Zm0-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z',
    wind: 'M750-614q-27 27-62 41t-70 14q-35 0-69-13.5T488-614l-75-75q-15-15-34-22.5t-39-7.5q-20 0-39 7.5T267-689l-47 47q-12 12-28 11.5T164-643q-12-12-12-28.5t12-28.5l46-46q27-27 61-40.5t69-13.5q35 0 68.5 13.5T469-746l75 75q16 16 35 23.5t39 7.5q20 0 39.5-7.5T693-671l47-47q12-12 28.5-12t28.5 12q12 12 12 28.5T797-661l-47 47Zm0 200q-27 27-61.5 40.5T619-360q-35 0-69.5-13.5T488-414l-75-75q-15-15-34-22.5t-39-7.5q-20 0-39 7.5T267-489l-47 47q-11 11-27.5 11.5T164-442q-12-11-12.5-28t11.5-29l47-47q27-27 61-40.5t69-13.5q35 0 68.5 13.5T469-546l75 75q16 16 35 23.5t39 7.5q20 0 39.5-7.5T693-471l47-47q12-12 28.5-12t28.5 12q12 12 12 28.5T797-461l-47 47Zm-1 200q-27 27-61 40.5T619-160q-35 0-69.5-13.5T488-214l-76-75q-15-15-34-22.5t-39-7.5q-20 0-39 7.5T266-289l-47 47q-11 11-27.5 11.5T163-242q-11-11-11-28t11-28l47-48q27-27 61-40.5t69-13.5q35 0 68.5 13.5T469-346l75 75q16 16 35.5 23.5T619-240q20 0 39-7.5t35-23.5l47-47q12-12 28-11.5t28 12.5q11 12 11.5 28T796-261l-47 47Z',
  };
  const ico = (name, size, cls) =>
    `<svg class="${cls || ''}" width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${P[name]}"/></svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fin = (v) => typeof v === 'number' && isFinite(v);
  const reduced = () => !!SIM.reduced;

  /* the app's own words (Mobile/src/i18n/strings.ts, en) */
  const T = {
    title: 'Settings', // sidebarSettings
    general: 'Language & display', // settingsGeneral
    language: 'Language', // settingsLanguage
    units: 'distances in km — metric only', // settingsUnitsInfo
    privacy: 'Privacy & sharing', // settingsPrivacy
    share: 'Share anonymous trip data', // settingsShareData
    shareExplain: 'share trips anonymously so Delhi sees its roads — nothing personal ever leaves this phone', // settingsShareExplain
    shareOn: 'on — one tap to stop anytime', // shareDataHint
    shareOff: 'off — nothing leaves this phone', // shareDataHintOff
    store: 'What we store', // settingsWhatWeStore
    del: 'Delete my data', // settingsDeleteData
    week: 'This week', // sidebarThisWeek
    about: 'About', // settingsAbout
    sources: 'air: satellite estimate + live stations when they connect', // settingsDataSources
  };
  const STORE = [ // STORE_BULLETS
    'no name, no phone, no account — ever',
    'trip ends stay hidden — the first and last 300 m are dropped before a trip is stored',
    'about one dot per 100 m of road, rounded to ~11 m',
    'kept only as counts on a street grid — the raw trail is thrown away',
    'a random id — never linked to you; it changes itself every ~30 days, or when you delete your data',
    'a street appears only after 3+ different devices have crossed it',
    'off = nothing is uploaded; your own stats still work on this phone',
  ];

  const CSS = `
.stg{padding:0 16px 30px;color:var(--ink)}
.stg-bar{display:flex;align-items:center;justify-content:center;height:56px}
.stg-title{margin:0;font:700 17px/1 var(--font);letter-spacing:-.2px;color:var(--ink)}
/* the back floats (glass) so it stays in reach while the page scrolls under it */
.stg-fback{position:fixed;left:12px;top:calc(var(--sim-top) + 8px);z-index:5}
.stg-backbtn{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink);flex:none;
  background:rgba(255,255,255,.86);box-shadow:0 0 0 .5px var(--ink10),var(--sh-float);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.stg-sec{margin:22px 4px 9px;font:500 15px/1.3 var(--font);color:var(--ink)}
.stg-sec:first-of-type{margin-top:8px}
.stg-card{border-radius:var(--r-card);background:var(--surface);box-shadow:0 0 0 .5px rgba(22,24,29,.05),var(--sh-card);overflow:hidden}
.stg-row{display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:12px 16px;text-align:left;color:var(--ink)}
.stg-row svg{flex:none;display:block}
.stg-mid{flex:1;min-width:0;display:flex;flex-direction:column}
.stg-label{font:500 15px/1.3 var(--font);color:var(--ink)}
.stg-hint{margin-top:3px;font:400 13px/1.38 var(--font);color:var(--ink3);font-variant-numeric:tabular-nums}
.stg-hair{height:.5px;margin:0 16px;background:var(--hair)}
.stg-explain{padding:0 16px 13px;margin-top:-5px}
.stg-explain p{margin:0;font:400 13px/1.4 var(--font);color:var(--ink2)}
.stg-status{position:relative;height:18px;margin-top:7px}
.stg-status span{position:absolute;left:0;right:0;top:0;font:400 13px/18px var(--font);color:var(--ink3);transition:opacity .22s ease,transform .32s var(--ease)}
.stg-status .is-out{opacity:0;transform:translate3d(0,-5px,0)}
.stg-status .is-in{opacity:0;transform:translate3d(0,5px,0)}
.stg-seg{flex:none;display:flex;padding:3px;border-radius:999px;background:var(--surface2)}
.stg-seg button{min-height:40px;padding:0 15px;border-radius:999px;font:500 13px/1 var(--font);color:var(--ink2);transition:background-color .2s,color .2s}
.stg-seg button.is-on{background:var(--ink);color:var(--paper)}
.stg-seg .stg-hi{padding-top:2px;font-family:"Noto Sans Devanagari","Kohinoor Devanagari","Nirmala UI",var(--font)}
.stg-sw{position:relative;flex:none;width:51px;height:31px;border-radius:16px;background:#E2DFD7;transition:background-color .26s ease}
.stg-sw i{position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:#fff;
  box-shadow:0 3px 8px rgba(0,0,0,.15),0 1px 1px rgba(0,0,0,.16),0 0 0 .5px rgba(0,0,0,.04);transition:transform .34s cubic-bezier(.32,.72,0,1),width .2s var(--ease)}
.stg-sw.is-on{background:var(--accent)}
.stg-sw.is-on i{transform:translate3d(20px,0,0)}
.stg-row.is-down .stg-sw i{width:32px}
.stg-row.is-down .stg-sw.is-on i{transform:translate3d(15px,0,0)}
.stg-chev{color:var(--ink3);transition:transform .32s var(--ease)}
.stg-exp.is-open .stg-chev{transform:rotate(90deg)}
.stg-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows .36s var(--ease)}
.stg-body>div{overflow:hidden}
.stg-body.is-open{grid-template-rows:1fr}
.stg-bul{display:flex;gap:9px;padding:4px 16px 4px 18px;font:400 13px/1.42 var(--font);color:var(--ink2)}
.stg-bul::before{content:"";flex:none;width:5px;height:5px;margin-top:7px;border-radius:50%;background:var(--ink4)}
.stg-bul:first-child{padding-top:0}
.stg-bul:last-child{padding-bottom:14px}
.stg-danger,.stg-danger .stg-label{color:#A83D30}
.stg-week{padding:16px 16px 15px}
.stg-days{display:flex;justify-content:space-between;padding:0 4px}
.stg-day{display:flex;flex-direction:column;align-items:center;gap:8px;width:30px}
.stg-day i{display:block;width:8px;height:22px;border-radius:4px;border:1px dashed rgba(22,24,29,.18)}
.stg-day span{font:400 11.5px/1 var(--font);color:var(--ink3)}
.stg-day.is-today i{border-style:solid;border-color:rgba(22,24,29,.30)}
.stg-day.is-today span{font-weight:700;color:var(--ink)}
.stg-empty{margin-top:15px;font:500 15px/1.35 var(--font);color:var(--ink)}
.stg-empty-sub{margin-top:3px;font:400 13px/1.42 var(--font);color:var(--ink3)}
.stg-foot{margin:18px 4px 0;font:400 12px/1.45 var(--font);color:var(--ink4);text-align:center}
`;

  /* the last seven Delhi days, ending today (the app keeps the Delhi wall clock: +330 min) */
  function weekDays() {
    const L = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const now = Date.now() + 330 * 60000;
    const out = [];
    for (let k = 6; k >= 0; k--) out.push({ l: L[new Date(now - k * 86400000).getUTCDay()], today: k === 0 });
    return out;
  }

  SIM.register('settings', {
    title: 'Settings',
    mount(root) {
      SIM.css('settings', CSS);
      let dead = false, ageT = 0, retryT = 0, shareOn = false, toldShare = false, open = false;

      root.innerHTML = `
<div class="stg">
  <div class="stg-bar"><h1 class="stg-title">${T.title}</h1></div>
  <h2 class="stg-sec">${T.general}</h2>
  <div class="stg-card">
    <div class="stg-row">
      <span class="stg-mid"><span class="stg-label">${T.language}</span></span>
      <div class="stg-seg" role="radiogroup" aria-label="${T.language}">
        <button class="is-on" role="radio" aria-checked="true" data-l="en">English</button>
        <button class="stg-hi" role="radio" aria-checked="false" data-l="hi" lang="hi">हिंदी</button>
      </div>
    </div>
    <div class="stg-hair"></div>
    <div class="stg-row" style="min-height:0;padding-top:12px;padding-bottom:13px"><span class="stg-hint" style="margin:0;color:var(--ink2)">${T.units}</span></div>
  </div>

  <h2 class="stg-sec">${T.privacy}</h2>
  <div class="stg-card">
    <button class="stg-row sim-hl stg-share" role="switch" aria-checked="false">
      <span class="stg-mid"><span class="stg-label">${T.share}</span></span>
      <span class="stg-sw" aria-hidden="true"><i></i></span>
    </button>
    <div class="stg-explain">
      <p>${T.shareExplain}</p>
      <div class="stg-status" aria-live="polite"><span>${T.shareOff}</span></div>
    </div>
    <div class="stg-hair"></div>
    <button class="stg-row sim-hl stg-exp" aria-expanded="false">
      ${ico('info', 20)}<span class="stg-mid"><span class="stg-label">${T.store}</span></span>${ico('chevron', 18, 'stg-chev')}
    </button>
    <div class="stg-body"><div>${STORE.map((s) => `<div class="stg-bul">${esc(s)}</div>`).join('')}</div></div>
    <div class="stg-hair"></div>
    <button class="stg-row sim-hl stg-danger stg-del">${ico('trash', 20)}<span class="stg-mid"><span class="stg-label">${T.del}</span></span></button>
  </div>

  <h2 class="stg-sec">${T.week}</h2>
  <div class="stg-card stg-week" aria-label="this week — no trips in the preview">
    <div class="stg-days" aria-hidden="true">${weekDays().map((d) => `<div class="stg-day${d.today ? ' is-today' : ''}"><i></i><span>${d.l}</span></div>`).join('')}</div>
    <div class="stg-empty">no trips in the preview</div>
    <div class="stg-empty-sub">the app keeps your week on your phone — only real trips land there, and a blank day is never a zero.</div>
  </div>

  <h2 class="stg-sec">${T.about}</h2>
  <div class="stg-card">
    <div class="stg-row">
      <span class="stg-mid"><span class="stg-label">live preview — real field, simulated ride</span><span class="stg-hint stg-field">reading the field…</span></span>
    </div>
    <div class="stg-hair"></div>
    <div class="stg-row">${ico('wind', 20)}<span class="stg-mid"><span class="stg-hint" style="margin:0;color:var(--ink2)">${T.sources}</span></span></div>
  </div>
  <p class="stg-foot">Alive · the preview keeps nothing — close it and it's gone</p>
</div>`;

      /* visible back — the shell's own glass button when it ships one; it floats (position:fixed
         inside the screen's contained box) so it never scrolls out of reach */
      let backEl;
      if (typeof SIM.backButton === 'function') backEl = SIM.backButton({ glass: true });
      else {
        backEl = document.createElement('button');
        backEl.className = 'stg-backbtn';
        backEl.setAttribute('aria-label', 'back');
        backEl.innerHTML = ico('back', 24);
        SIM.press(backEl, () => SIM.back());
      }
      backEl.classList.add('stg-fback');
      root.appendChild(backEl);

      /* language: English here; हिंदी lives in the app */
      root.querySelectorAll('.stg-seg button').forEach((b) => {
        SIM.press(b, () => { if (b.dataset.l === 'hi') SIM.toast('हिंदी lives in the app'); });
      });

      /* sharing: default OFF, flips locally; the caption is the app's own state line */
      const shareBtn = root.querySelector('.stg-share');
      const sw = shareBtn.querySelector('.stg-sw');
      const status = root.querySelector('.stg-status');
      function setStatus(txt) {
        const old = status.querySelector('span:not(.is-out)');
        const nu = document.createElement('span');
        nu.textContent = txt;
        if (reduced() || !old) { status.innerHTML = ''; status.appendChild(nu); return; }
        nu.className = 'is-in';
        status.appendChild(nu);
        old.classList.add('is-out');
        requestAnimationFrame(() => requestAnimationFrame(() => nu.classList.remove('is-in')));
        setTimeout(() => { if (old.parentNode) old.remove(); }, 360);
      }
      SIM.press(shareBtn, () => {
        shareOn = !shareOn;
        sw.classList.toggle('is-on', shareOn);
        shareBtn.setAttribute('aria-checked', String(shareOn));
        setStatus(shareOn ? T.shareOn : T.shareOff);
        if (shareOn && !toldShare) { toldShare = true; SIM.toast('preview — nothing is sent from here'); }
      });

      /* what we store — the app's privacy rules, one plain line each */
      const exp = root.querySelector('.stg-exp');
      const expBody = root.querySelector('.stg-body');
      SIM.press(exp, () => {
        open = !open;
        exp.classList.toggle('is-open', open);
        expBody.classList.toggle('is-open', open);
        exp.setAttribute('aria-expanded', String(open));
      });

      /* delete my data — honest: there is nothing here to delete */
      SIM.press(root.querySelector('.stg-del'), () => SIM.toast('nothing to delete — the preview stores nothing'));

      /* about: the live field's age, read off /v2/city and kept ticking */
      const fieldEl = root.querySelector('.stg-field');
      async function readCity() {
        let t0 = Date.now();
        const c = await SIM.city();
        if (dead) return;
        /* SIM.city() may hand back a read cached minutes ago — age the field from the payload's own
           build time (never later than now), so the age can only ever be overstated, not understated */
        const born = c && (fin(c.ts) ? c.ts * 1000 : Date.parse(c.generated_at || ''));
        if (fin(born) && born <= Date.now() + 5000 && Date.now() - born < 3600e3) t0 = Math.min(t0, born);
        const age0 = c && fin(c.field_age_s) ? c.field_age_s : c && c.freshness && fin(c.freshness.field_age_s) ? c.freshness.field_age_s : null;
        if (!c || age0 == null) {
          fieldEl.textContent = 'can\'t reach the field — retrying';
          retryT = setTimeout(readCity, 8000);
          return;
        }
        const st = c.sources && c.sources.stations && fin(c.sources.stations.count) ? c.sources.stations.count : null;
        const stale = c.field && c.field.stale === true;
        const paint = () => {
          const age = SIM.fmt.ago(age0 + (Date.now() - t0) / 1000);
          fieldEl.textContent = `the field read ${age} ago${st != null ? ` · ${st} live station readings` : ''}${stale ? ' · older data — reconnecting' : ''}`;
        };
        paint();
        clearInterval(ageT);
        ageT = setInterval(paint, 30000);
      }
      readCity();

      /* entrance: section by section, 35 ms apart */
      if (!reduced()) {
        Array.from(root.querySelectorAll('.stg-sec,.stg-card,.stg-foot')).forEach((el, i) => {
          el.animate([{ opacity: 0, transform: 'translate3d(0,12px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
            { duration: 480, delay: 40 + i * 35, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'backwards' });
        });
      }

      return () => {
        dead = true;
        clearInterval(ageT);
        clearTimeout(retryT);
      };
    },
  });
})();
