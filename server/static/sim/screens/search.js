/* search — sim-trip lane. Contract: /tmp/sim-contract.md
   The where-to surface (Mobile/src/screens/SearchScreen.tsx): a From / To
   card over a pill field; typing reads the live gazetteer (GET /search),
   rows land staggered with the matched prefix kept bright. Picking a To
   pushes compare. There is no GPS in the preview — From starts at the
   fixed preview origin and says so; both rows stay editable and swap.
   params: {from?, to?, slot?: 'from'|'to'} */
(() => {
  'use strict';
  const S = window.SIM;
  if (!S) return;

  /* ── icons: Material Symbols Rounded geometry, the app's own set (icons.tsx) ── */
  const P = {
    pin: 'M480-186q122-112 181-203.5T720-552q0-109-69.5-178.5T480-800q-101 0-170.5 69.5T240-552q0 71 59 162.5T480-186Zm0 79q-14 0-28-5t-25-15q-65-60-115-117t-83.5-110.5q-33.5-53.5-51-103T160-552q0-150 96.5-239T480-880q127 0 223.5 89T800-552q0 45-17.5 94.5t-51 103Q698-301 648-244T533-127q-11 10-25 15t-28 5Zm0-453Zm0 80q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z',
    airport: 'M480-120 377-91q-14 4-25.5-4.5T340-118q0-12 3-19.5t8-11.5l69-51v-220l-291 86q-19 5-34-6t-15-31q0-15 5-25t14-15l321-189v-220q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v220l321 189q9 5 14 15t5 25q0 20-15 31t-34 6l-291-86v220l69 51q5 4 8 11.5t3 19.5q0 14-11.5 22.5T583-91l-103-29Z',
    rail: 'M208-80q-14 0-19-12t5-22l46-46h480l46 46q10 10 5 22t-19 12H208Zm72-120 40-40h-20q-58 0-99-41t-41-99v-260q0-129 92.5-204.5T480-920q135 0 227.5 75.5T800-640v260q0 58-41 99t-99 41h-20l40 40H280Zm20-120h360q25 0 42.5-17.5T720-380v-140H240v140q0 25 17.5 42.5T300-320Zm180-40q25 0 42.5-17.5T540-420q0-25-17.5-42.5T480-480q-25 0-42.5 17.5T420-420q0 25 17.5 42.5T480-360ZM240-600h480v-40q0-23-4.5-42.5T703-720H257q-8 18-12.5 37.5T240-640v40Zm89-200h302q-31-20-69.5-30T480-840q-43 0-81.5 10T329-800Zm151 280Zm0-280Z',
    shop: 'M240-80q-33 0-56.5-23.5T160-160v-480q0-33 23.5-56.5T240-720h80q0-66 47-113t113-47q66 0 113 47t47 113h80q33 0 56.5 23.5T800-640v480q0 33-23.5 56.5T720-80H240Zm0-80h480v-480h-80v80q0 17-11.5 28.5T600-520q-17 0-28.5-11.5T560-560v-80H400v80q0 17-11.5 28.5T360-520q-17 0-28.5-11.5T320-560v-80h-80v480Zm160-560h160q0-33-23.5-56.5T480-800q-33 0-56.5 23.5T400-720ZM240-160v-480 480Z',
    hotel: 'M80-200q-17 0-28.5-11.5T40-240v-520q0-17 11.5-28.5T80-800q17 0 28.5 11.5T120-760v360h320v-240q0-33 23.5-56.5T520-720h240q66 0 113 47t47 113v320q0 17-11.5 28.5T880-200q-17 0-28.5-11.5T840-240v-80H120v80q0 17-11.5 28.5T80-200Zm200-240q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm240 40h320v-160q0-33-23.5-56.5T760-640H520v240ZM280-520q17 0 28.5-11.5T320-560q0-17-11.5-28.5T280-600q-17 0-28.5 11.5T240-560q0 17 11.5 28.5T280-520Zm0-40Zm240-80v240-240Z',
    hospital: 'M420-420v80q0 25 17.5 42.5T480-280q25 0 42.5-17.5T540-340v-80h80q25 0 42.5-17.5T680-480q0-25-17.5-42.5T620-540h-80v-80q0-25-17.5-42.5T480-680q-25 0-42.5 17.5T420-620v80h-80q-25 0-42.5 17.5T280-480q0 25 17.5 42.5T340-420h80ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm0-560v560-560Z',
    park: 'M402-240H195q-24 0-36-21t2-41l119-178h-3q-24 0-35.5-21.5T244-543l203-290q6-8 15-12.5t18-4.5q9 0 18 4.5t15 12.5l203 290q14 20 2.5 41.5T683-480h-3l119 178q14 20 2 41t-36 21H558v120q0 17-11.5 28.5T518-80h-76q-17 0-28.5-11.5T402-120v-120Zm-132-80h160-76 252-76 160-420Zm0 0h420L530-560h76L480-740 354-560h76L270-320Z',
    monument: 'M40-200v-47q0-16 6-30.5T63-303l57-57v-240l-57-57q-11-11-17-25.5T40-713v-87q0-17 11.5-28.5T80-840q17 0 28.5 11.5T120-800v40h80v-40q0-17 11.5-28.5T240-840q17 0 28.5 11.5T280-800v40h80v-40q0-17 11.5-28.5T400-840q17 0 28.5 11.5T440-800v87q0 16-6 30.5T417-657l-57 57v40h240v-40l-57-57q-11-11-17-25.5t-6-30.5v-87q0-17 11.5-28.5T560-840q17 0 28.5 11.5T600-800v40h80v-40q0-17 11.5-28.5T720-840q17 0 28.5 11.5T760-800v40h80v-40q0-17 11.5-28.5T880-840q17 0 28.5 11.5T920-800v87q0 16-6 30.5T897-657l-57 57v240l57 57q11 11 17 25.5t6 30.5v47q0 33-23.5 56.5T840-120H600q-17 0-28.5-11.5T560-160v-80q0-33-23.5-56.5T480-320q-33 0-56.5 23.5T400-240v80q0 17-11.5 28.5T360-120H120q-33 0-56.5-23.5T40-200Zm80 0h200v-40q0-66 47-113t113-47q66 0 113 47t47 113v40h200v-47l-80-80v-306l47-47H633l47 47v153H280v-153l47-47H153l47 47v306l-80 80v47Zm360-240Z',
    temple: 'M80-160v-320q0-17 11.5-28.5T120-520q17 0 28.5 11.5T160-480v40h80l119-395v-45q0-17 11.5-28.5T399-920q17 0 28.5 11.5T439-880v40h81v-40q0-17 11.5-28.5T560-920q17 0 28.5 11.5T600-880v40l120 400h80v-40q0-17 11.5-28.5T840-520q17 0 28.5 11.5T880-480v320q0 33-23.5 56.5T800-80H560q-17 0-28.5-11.5T520-120v-160h-80v160q0 17-11.5 28.5T400-80H160q-33 0-56.5-23.5T80-160Zm268-360h264l-24-80H372l-24 80Zm48-160h168l-24-80H420l-24 80ZM160-160h200v-120q0-33 23.5-56.5T440-360h80q33 0 56.5 23.5T600-280v120h200v-200h-80q-26 0-47.5-15.5T643-417l-7-23H324l-7 23q-8 26-29.5 41.5T240-360h-80v200Zm320-280Z',
    school: 'M242-249q-20-11-31-29.5T200-320v-192l-96-53q-11-6-16-15t-5-20q0-11 5-20t16-15l338-184q9-5 18.5-7.5T480-829q10 0 19.5 2.5T518-819l381 208q10 5 15.5 14.5T920-576v256q0 17-11.5 28.5T880-280q-17 0-28.5-11.5T840-320v-236l-80 44v192q0 23-11 41.5T718-249L518-141q-9 5-18.5 7.5T480-131q-10 0-19.5-2.5T442-141L242-249Zm238-203 274-148-274-148-274 148 274 148Zm0 241 200-108v-151l-161 89q-9 5-19 7.5t-20 2.5q-10 0-20-2.5t-19-7.5l-161-89v151l200 108Zm0-241Zm0 121Zm0 0Z',
    museum: 'M80-80v-80h80v-360h-26q-23 0-38.5-16T80-575q0-12 5.5-22t15.5-17l333-234q11-8 22.5-11.5T480-863q12 0 23.5 3.5T526-848l333 234q10 7 15.5 17.5T880-574q0 23-15.5 38.5T826-520h-26v360h80v80H80Zm640-80v-454L480-782 240-614v454h480ZM480-312q10 0 18.5-4.5T513-330l47-70v120q0 17 11.5 28.5T600-240q17 0 28.5-11.5T640-280v-207q0-14-9.5-23.5T607-520h-29q-8 0-15.5 4T550-505l-70 105-68-102q-5-8-14-13t-19-5h-19q-17 0-28.5 11.5T320-480v200q0 17 11.5 28.5T360-240q17 0 28.5-11.5T400-280v-120l47 70q6 9 14.5 13.5T480-312Zm240 152H240h480Z',
    restaurant: 'M280-600v-240q0-17 11.5-28.5T320-880q17 0 28.5 11.5T360-840v240h40v-240q0-17 11.5-28.5T440-880q17 0 28.5 11.5T480-840v240q0 56-34.5 98T360-446v326q0 17-11.5 28.5T320-80q-17 0-28.5-11.5T280-120v-326q-51-14-85.5-56T160-600v-240q0-17 11.5-28.5T200-880q17 0 28.5 11.5T240-840v240h40Zm400 200h-80q-17 0-28.5-11.5T560-440v-240q0-70 51.5-135T718-880q18 0 30 14t12 33v713q0 17-11.5 28.5T720-80q-17 0-28.5-11.5T680-120v-280Z',
    search: 'M380-320q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l224 224q11 11 11 28t-11 28q-11 11-28 11t-28-11L532-372q-30 24-69 38t-83 14Zm0-80q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z',
    close: 'M480-424 284-228q-11 11-28 11t-28-11q-11-11-11-28t11-28l196-196-196-196q-11-11-11-28t11-28q11-11 28-11t28 11l196 196 196-196q11-11 28-11t28 11q11 11 11 28t-11 28L536-480l196 196q11 11 11 28t-11 28q-11 11-28 11t-28-11L480-424Z',
    explore: 'M480-440q-17 0-28.5-11.5T440-480q0-17 11.5-28.5T480-520q17 0 28.5 11.5T520-480q0 17-11.5 28.5T480-440Zm0 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320ZM297-277l250-117q6-3 11-8t8-11l117-250q5-10-2.5-17.5T663-683L413-566q-6 3-11 8t-8 11L277-297q-5 10 2.5 17.5T297-277Z',
    route: 'M360-120q-66 0-113-47t-47-113v-327q-35-13-57.5-43.5T120-720q0-50 35-85t85-35q50 0 85 35t35 85q0 39-22.5 69.5T280-607v327q0 33 23.5 56.5T360-200q33 0 56.5-23.5T440-280v-400q0-66 47-113t113-47q66 0 113 47t47 113v327q35 13 57.5 43.5T840-240q0 50-35 85t-85 35q-50 0-85-35t-35-85q0-39 22.5-70t57.5-43v-327q0-33-23.5-56.5T600-760q-33 0-56.5 23.5T520-680v400q0 66-47 113t-113 47ZM240-680q17 0 28.5-11.5T280-720q0-17-11.5-28.5T240-760q-17 0-28.5 11.5T200-720q0 17 11.5 28.5T240-680Zm480 480q17 0 28.5-11.5T760-240q0-17-11.5-28.5T720-280q-17 0-28.5 11.5T680-240q0 17 11.5 28.5T720-200ZM240-720Zm480 480Z',
    chevron: 'M504-480 348-636q-11-11-11-28t11-28q11-11 28-11t28 11l184 184q6 6 8.5 13t2.5 15q0 8-2.5 15t-8.5 13L404-268q-11 11-28 11t-28-11q-11-11-11-28t11-28l156-156Z',
  };
  const ic = (n, s = 22) =>
    `<svg width="${s}" height="${s}" viewBox="0 -960 960 960" aria-hidden="true"><path fill="currentColor" d="${P[n]}"/></svg>`;
  const BACK = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SWAP = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 18.5V5.5M4.5 9 8 5.5 11.5 9"/><path d="M16 5.5v13M12.5 15l3.5 3.5 3.5-3.5"/></svg>';

  /* ── copy: the app's own words (Mobile/src/i18n/strings.ts) ── */
  const T = {
    to: 'Where to?', from: 'Where from?', fromKey: 'from', toKey: 'To',
    results: 'Results', searching: 'Searching…', none: 'no place found — try a landmark',
    hint: 'type a place or landmark', outside: 'outside Delhi — no smoke estimate here',
    offline: "can't reach the server — trying again", answers: 'air answers',
    stays: 'where to stay', staysSub: 'stays, lightest air first', play: 'when to go out', playSub: 'the next 24 h',
  };
  const TRY = ['khan market', 'igi airport', 'india gate'];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const R = 6371e3, rad = Math.PI / 180;
  const havM = (a, b) => {
    const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  /* SearchScreen.fmtDist — 50 m steps under a km, 1 dp under 10 km */
  const fmtDist = (m) => {
    const km = m / 1000;
    if (km < 1) return Math.max(50, Math.round(m / 50) * 50) + ' m';
    if (km < 10) return (Math.round(km * 10) / 10).toFixed(1) + ' km';
    return Math.round(km) + ' km';
  };
  /* the gazetteer ships kind "place" for every row — the glyph reads the name itself */
  const glyphFor = (name) => {
    const n = String(name || '').toLowerCase();
    if (/airport|\bigi\b|terminal \d/.test(n)) return 'airport';
    if (/metro|railway|station|\brly\b/.test(n)) return 'rail';
    if (/hospital|clinic|aiims|medical/.test(n)) return 'hospital';
    if (/hotel|resort|guest ?house|hostel|\binn\b/.test(n)) return 'hotel';
    if (/market|bazaa?r|mall|plaza|emporium/.test(n)) return 'shop';
    if (/\bpark\b|garden|\blake\b|forest|ridge|lawns?\b/.test(n)) return 'park';
    if (/temple|mandir|gurudwara|gurdwara|masjid|mosque|church|cathedral|dargah|akshardham/.test(n)) return 'temple';
    if (/\bgate\b|\bfort\b|tomb|minar|qila|monument|memorial|maqbara|jyoti/.test(n)) return 'monument';
    if (/museum|gallery/.test(n)) return 'museum';
    if (/school|college|university|institute|campus/.test(n)) return 'school';
    if (/restaurant|cafe|café|dhaba|kitchen|\bsocial\b/.test(n)) return 'restaurant';
    return 'pin';
  };
  /* matched-prefix spans — SearchScreen.matchSpans: a word lights where a query token starts it */
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function titleHTML(name, q) {
    const toks = norm(q).split(' ').filter(Boolean);
    const spans = [];
    if (toks.length) {
      const re = /[a-z0-9]+/gi;
      let m;
      while ((m = re.exec(name))) {
        const w = m[0].toLowerCase();
        for (const t of toks) if (w.startsWith(t)) { spans.push([m.index, m.index + Math.min(t.length, w.length)]); break; }
      }
    }
    if (!spans.length) return esc(name);
    let out = '', i = 0;
    for (const [a, b] of spans) {
      if (a > i) out += `<span class="srch-dim">${esc(name.slice(i, a))}</span>`;
      out += `<b>${esc(name.slice(a, b))}</b>`;
      i = b;
    }
    if (i < name.length) out += `<span class="srch-dim">${esc(name.slice(i))}</span>`;
    return out;
  }
  const keyOf = (p) => `${p.name}|${(+p.lat).toFixed(5)}|${(+p.lon).toFixed(5)}`;
  const place = (p) => ({ lat: +p.lat, lon: +p.lon, name: String(p.name || ''), subtitle: p.subtitle || '', outside: !!p.outside_ncr });

  S.css('search', `
.srch{position:relative;height:100%;display:flex;flex-direction:column;background:var(--paper)}
.srch-head{flex:none;padding:8px 14px 0}
.srch-route{position:relative;background:var(--surface2);border-radius:var(--r-row);overflow:hidden}
.srch-row{position:relative;display:flex;align-items:center;gap:10px;width:100%;height:48px;padding:0 56px 0 12px;transition:background-color .28s ease,scale .46s var(--settle)}
.srch-row.is-on{background:var(--accent-tint)}
.srch-dot{flex:none;width:10px;height:10px;border-radius:50%;background:var(--accent)}
.srch-dot.is-to{background:transparent;box-shadow:inset 0 0 0 2px var(--ink3)}
.srch-key{flex:none;width:34px;font-size:13px;color:var(--ink3)}
.srch-val{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:17px;font-weight:500;color:var(--ink)}
.srch-val.is-empty{font-weight:400;color:var(--ink3)}
.srch-tag{font-size:13px;font-weight:400;color:var(--ink3)}
.srch-hair{height:1px;margin-left:32px;background:var(--hair);transform:scaleY(.5);transform-origin:0 50%}
.srch-swap{position:absolute;right:8px;top:50%;width:40px;height:40px;margin-top:-20px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--surface);color:var(--ink2);box-shadow:0 0 0 .5px var(--ink10),0 3px 10px rgba(59,52,35,.08);z-index:2}
.srch-swap svg{transition:transform .42s var(--settle)}
.srch-bar{display:flex;align-items:center;height:56px;margin:8px 0;padding:0 8px 0 6px;background:var(--surface2);border-radius:999px}
.srch-ibtn{flex:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.srch-ibtn.is-clear{color:var(--ink3);opacity:0;pointer-events:none;transition:opacity .16s ease,scale .46s var(--settle)}
.srch-ibtn.is-clear.is-on{opacity:1;pointer-events:auto}
.srch-input{flex:1;min-width:0;height:100%;margin:0 0 0 4px;padding:0;border:0;outline:0;background:transparent;font-size:17px;color:var(--ink);
  user-select:text;-webkit-user-select:text;caret-color:var(--accent)}
.srch-input::placeholder{color:var(--ink2);opacity:1}
.srch-list{flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y;
  padding:0 0 calc(var(--sim-bot) + 18px);scrollbar-width:none}
.srch-list::-webkit-scrollbar{display:none}
.srch-sec{display:flex;align-items:baseline;justify-content:space-between;margin:14px 18px 4px;font-size:15px;font-weight:700;color:var(--ink)}
.srch-status{font-size:13px;font-weight:400;color:var(--ink3);opacity:0;transition:opacity .2s ease}
.srch-status.is-on{opacity:1}
.srch-busy{position:relative;height:2px;margin:2px 18px 4px;border-radius:1px;overflow:hidden;opacity:0;transition:opacity .2s ease}
.srch-busy.is-on{opacity:1}
.srch-busy::after{content:"";position:absolute;left:0;top:0;bottom:0;width:28%;border-radius:1px;background:var(--ink4);
  animation:srch-scan 1.15s cubic-bezier(.45,.05,.55,.95) infinite;animation-play-state:paused}
.srch-busy.is-on::after{animation-play-state:running}
@keyframes srch-scan{from{transform:translateX(-100%)}to{transform:translateX(360%)}}
.srch-rows{transition:opacity .2s ease}
.srch-rows.is-stale{opacity:.55}
.srch-item{display:flex;align-items:center;width:100%;min-height:58px;padding:8px 14px;border-radius:var(--r-row);text-align:left}
.srch-item.is-out>*{opacity:.55}
.srch-glyph{flex:none;width:38px;height:38px;margin-right:12px;display:flex;align-items:center;justify-content:center;color:var(--ink2)}
.srch-text{flex:1;min-width:0;margin-right:10px}
.srch-title,.srch-sub,.srch-go-t,.srch-go-s{display:block}
.srch-title{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:17px;font-weight:500;color:var(--ink)}
.srch-title b{font-weight:700}
.srch-dim{font-weight:400;color:var(--ink2)}
.srch-sub{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;margin-top:1px;font-size:13px;color:var(--ink2)}
.srch-dist{flex:none;font-size:13px;color:var(--ink2);font-variant-numeric:tabular-nums}
.srch-go{display:flex;align-items:center;gap:12px;width:calc(100% - 28px);margin:6px 14px 2px;padding:12px 14px;border-radius:var(--r-card);
  background:var(--surface);box-shadow:0 0 0 .5px var(--ink10),var(--sh-card);text-align:left}
.srch-go-g{flex:none;width:38px;height:38px;border-radius:var(--r-row);display:flex;align-items:center;justify-content:center;background:var(--surface2);color:var(--ink)}
.srch-go-t{font-size:17px;font-weight:500;color:var(--ink)}
.srch-go-s{margin-top:1px;font-size:13px;color:var(--ink2);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.srch-go-c{flex:none;margin-left:auto;color:var(--ink3)}
.srch-quiet{display:flex;flex-direction:column;align-items:center;padding:26px 28px 6px;text-align:center}
.srch-ring{width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--ink3);box-shadow:inset 0 0 0 1px var(--hair)}
.srch-qt{margin-top:12px;font-size:17px;font-weight:500;color:var(--ink)}
.srch-qs{margin-top:5px;max-width:270px;font-size:13px;line-height:1.4;color:var(--ink3)}
.srch-try{margin-top:14px;font-size:13px;color:var(--ink3);line-height:1.9}
.srch-trybtn{display:inline-flex;align-items:center;min-height:40px;padding:0 8px;margin:0 -4px;font-size:14px;font-weight:500;color:var(--ink2);text-decoration:underline;text-decoration-color:var(--hair);text-underline-offset:4px}
.srch-sep{margin:0 6px;color:var(--ink4)}
@media (prefers-reduced-motion:reduce){.srch-swap svg,.srch-row,.srch-rows,.srch-status{transition:none}.srch-busy::after{animation:none;width:100%;opacity:.5}}
`);

  S.register('search', {
    title: 'where to',
    mount(root, params) {
      params = params || {};
      root.style.overflow = 'hidden';
      const O = S.ORIGIN;
      // the fixed preview origin says so wherever it sits (home hands it over as plain {lat,lon,name})
      const isOrigin = (p) => !!p && Math.abs(+p.lat - O.lat) < 1e-6 && Math.abs(+p.lon - O.lon) < 1e-6;
      const tagOrigin = (p) => (p ? Object.assign({}, p, isOrigin(p) ? { preview: true, name: p.name || O.name } : null) : null);
      const st = {
        from: params.from && isFinite(+params.from.lat) ? tagOrigin(params.from) : { lat: O.lat, lon: O.lon, name: O.name, preview: true },
        to: params.to && isFinite(+params.to.lat) ? tagOrigin(params.to) : null,
        slot: params.slot === 'from' ? 'from' : 'to',
        q: '', rows: null, pendingQ: null, failed: false, seq: 0, busy: false,
      };
      const memo = new Map();
      const timers = new Set();
      const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
      let debounce = 0, retry = 0, dead = false;

      const wrap = h('div', 'srch');
      wrap.innerHTML =
        '<div class="srch-head">' +
          '<div class="srch-route">' +
            `<button class="srch-row" data-slot="from"><span class="srch-dot"></span><span class="srch-key">${T.fromKey}</span><span class="srch-val"></span></button>` +
            '<div class="srch-hair"></div>' +
            `<button class="srch-row" data-slot="to"><span class="srch-dot is-to"></span><span class="srch-key">${T.toKey}</span><span class="srch-val"></span></button>` +
            `<button class="srch-swap" aria-label="swap from and to">${SWAP}</button>` +
          '</div>' +
          '<div class="srch-bar">' +
            `<button class="srch-ibtn" data-act="back" aria-label="back">${BACK}</button>` +
            '<input class="srch-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false" enterkeyhint="search" aria-label="search places">' +
            `<button class="srch-ibtn is-clear" data-act="clear" aria-label="clear">${ic('close', 16)}</button>` +
          '</div>' +
        '</div>' +
        '<div class="srch-list" role="list"></div>';
      root.appendChild(wrap);

      const rowFrom = wrap.querySelector('[data-slot="from"]');
      const rowTo = wrap.querySelector('[data-slot="to"]');
      const valFrom = rowFrom.querySelector('.srch-val');
      const valTo = rowTo.querySelector('.srch-val');
      const swapBtn = wrap.querySelector('.srch-swap');
      const input = wrap.querySelector('.srch-input');
      const clearBtn = wrap.querySelector('[data-act="clear"]');
      const list = wrap.querySelector('.srch-list');

      /* ── the From / To card ── */
      function paintVal(el, p, emptyTxt) {
        if (!p) { el.className = 'srch-val is-empty'; el.textContent = emptyTxt; return; }
        el.className = 'srch-val';
        el.innerHTML = esc(p.name) + (p.preview ? ' <span class="srch-tag">(preview)</span>' : '');
      }
      function paintCard() {
        paintVal(valFrom, st.from, T.from);
        paintVal(valTo, st.to, T.to);
        rowFrom.classList.toggle('is-on', st.slot === 'from');
        rowTo.classList.toggle('is-on', st.slot === 'to');
        rowFrom.setAttribute('aria-label', 'from: ' + (st.from ? st.from.name : T.from));
        rowTo.setAttribute('aria-label', 'to: ' + (st.to ? st.to.name : T.to));
        input.placeholder = st.slot === 'from' ? T.from : T.to;
      }
      // type-ready on a keyboard device; a touch-first phone waits for the user's own tap (no surprise keyboard)
      const fine = !(window.matchMedia && matchMedia('(pointer: coarse)').matches);
      const focusInput = () => { if (!dead) try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } };
      function arm(slot, focus) {
        st.slot = slot;
        paintCard();
        setQuery('');
        if (focus) focusInput();
      }
      S.press(rowFrom, () => arm('from', true));
      S.press(rowTo, () => arm('to', true));

      /* swap — the two values pass each other, then trade places */
      let swapping = false, turns = 0;
      S.press(swapBtn, () => {
        if (swapping) return;
        swapping = true;
        turns++;
        swapBtn.firstElementChild.style.transform = `rotate(${turns * 180}deg)`;
        const d = rowTo.offsetTop - rowFrom.offsetTop;
        const done = () => {
          const f = st.from;
          st.from = st.to; st.to = f; // the "(preview)" tag travels with the fixed origin
          st.slot = !st.from ? 'from' : !st.to ? 'to' : st.slot;
          paintCard();
          setQuery('');
          swapping = false;
        };
        if (S.reduced || !valFrom.animate) { done(); return; }
        const o = { duration: 340, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'forwards' };
        const a = valFrom.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${d}px)`, opacity: 0.35 }], o);
        valTo.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${-d}px)`, opacity: 0.35 }], o);
        let fin = false;
        const end = () => {
          if (fin) return; fin = true;
          valFrom.getAnimations().forEach((x) => x.cancel());
          valTo.getAnimations().forEach((x) => x.cancel());
          done();
          if (!S.reduced) {
            valFrom.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
            valTo.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
          }
        };
        a.onfinish = end;
        later(end, 520);
      });

      /* ── the field ── */
      S.press(wrap.querySelector('[data-act="back"]'), () => { input.blur(); S.back(); });
      S.press(clearBtn, () => { setQuery(''); focusInput(); });
      input.addEventListener('input', () => onType(input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const first = st.rows && st.rows[0];
          if (first && st.pendingQ == null) pick(first);
        } else if (e.key === 'Escape' && input.value) {
          // first Escape clears the field; an empty field lets it through (the shell's back)
          e.preventDefault();
          e.stopPropagation();
          setQuery('');
        }
      });

      function setQuery(v) {
        input.value = v;
        onType(v);
      }
      function onType(v) {
        st.q = v;
        clearBtn.classList.toggle('is-on', v.length > 0);
        clearTimeout(debounce);
        clearTimeout(retry);
        const q = v.trim();
        if (!q) {
          st.seq++;
          st.pendingQ = null; st.rows = null; st.failed = false;
          paintIdle();
          return;
        }
        const hit = memo.get(q.toLowerCase());
        if (hit) { st.seq++; st.pendingQ = null; st.failed = false; paintResults(hit, q); return; }
        st.pendingQ = q;
        markPending();
        debounce = later(() => runSearch(q), 120);
      }

      async function runSearch(q) {
        const seq = ++st.seq;
        const near = st.slot === 'to' && st.from ? st.from : O;
        const path = `/search?q=${encodeURIComponent(q)}&lat=${near.lat.toFixed(4)}&lon=${near.lon.toFixed(4)}&limit=8`;
        const j = await S.api.get(path, 9000);
        if (dead || seq !== st.seq) return;
        st.pendingQ = null;
        if (j == null || typeof j !== 'object') {
          if (!st.failed) S.toast('the search server is unreachable — retrying');
          st.failed = true;
          paintFailed(q);
          retry = later(() => { if (st.q.trim() === q) { st.pendingQ = q; markPending(); runSearch(q); } }, 2600);
          return;
        }
        if (st.failed) S.toast('back online');
        st.failed = false;
        const rows = (Array.isArray(j.results) ? j.results : [])
          .filter((p) => p && isFinite(+p.lat) && isFinite(+p.lon) && p.name)
          .map(place);
        memo.set(q.toLowerCase(), rows);
        paintResults(rows, q);
      }

      /* ── list painting ── */
      let resultsEl = null; // {sec, status, rows}
      function ensureResults() {
        if (resultsEl && resultsEl.sec.isConnected) return resultsEl;
        list.innerHTML = '';
        const sec = h('div', 'srch-sec', `<span>${T.results}</span><span class="srch-status" aria-live="polite">${T.searching}</span>`);
        const busy = h('div', 'srch-busy');
        const rows = h('div', 'srch-rows');
        list.append(sec, busy, rows);
        resultsEl = { sec, busy, status: sec.querySelector('.srch-status'), rows, map: new Map() };
        return resultsEl;
      }
      function markPending() {
        const r = ensureResults();
        r.status.classList.add('is-on');
        r.busy.classList.add('is-on');
        r.rows.classList.toggle('is-stale', r.rows.childElementCount > 0);
        const q = r.rows.querySelector('.srch-quiet');
        if (q) q.remove();
      }
      function enter(el, i) {
        if (S.reduced || !el.animate) return;
        el.animate([{ opacity: 0, transform: 'translate3d(0,8px,0)' }, { opacity: 1, transform: 'translate3d(0,0,0)' }],
          { duration: 300, delay: Math.min(i, 9) * 34, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
      }
      function quiet(glyph, title, sub) {
        return h('div', 'srch-quiet', `<div class="srch-ring">${ic(glyph, 20)}</div><div class="srch-qt">${esc(title)}</div>${sub ? `<div class="srch-qs">${esc(sub)}</div>` : ''}`);
      }
      function rowEl(p, q) {
        const b = h('button', 'srch-item sim-hl' + (p.outside ? ' is-out' : ''));
        b.innerHTML =
          `<span class="srch-glyph">${ic(glyphFor(p.name), 22)}</span>` +
          '<span class="srch-text"><span class="srch-title"></span><span class="srch-sub"></span></span>' +
          '<span class="srch-dist"></span>';
        b._p = p;
        b._title = b.querySelector('.srch-title');
        b._sub = b.querySelector('.srch-sub');
        b._dist = b.querySelector('.srch-dist');
        S.press(b, () => pick(b._p));
        return b;
      }
      function paintResults(rows, q) {
        st.rows = rows;
        const r = ensureResults();
        r.status.classList.remove('is-on');
        r.busy.classList.remove('is-on');
        r.rows.classList.remove('is-stale');
        const old = r.map;
        const next = new Map();
        const qd = r.rows.querySelector('.srch-quiet');
        if (qd) qd.remove();
        let fresh = 0;
        const frag = [];
        const near = st.slot === 'to' && st.from ? st.from : O;
        for (const p of rows) {
          const k = keyOf(p);
          let el = old.get(k);
          if (el) old.delete(k);
          else { el = rowEl(p); el._new = true; }
          el._p = p;
          el._title.innerHTML = titleHTML(p.name, q);
          el._sub.textContent = p.outside ? T.outside : (p.subtitle || '');
          el.classList.toggle('is-out', !!p.outside);
          el._dist.textContent = fmtDist(havM(near, p));
          next.set(k, el);
          frag.push(el);
        }
        old.forEach((el) => el.remove());
        frag.forEach((el) => {
          r.rows.appendChild(el);
          if (el._new) { el._new = false; enter(el, fresh++); }
        });
        r.map = next;
        if (!rows.length) {
          const qq = quiet('search', T.none);
          r.rows.appendChild(qq);
          enter(qq, 0);
        }
      }
      function paintFailed() {
        const r = ensureResults();
        r.status.classList.remove('is-on');
        r.busy.classList.remove('is-on');
        r.rows.classList.remove('is-stale');
        r.rows.innerHTML = '';
        r.map = new Map();
        st.rows = null;
        const qq = quiet('search', T.offline);
        r.rows.appendChild(qq);
        enter(qq, 0);
      }

      function paintIdle() {
        if (st.q.trim()) return;
        resultsEl = null;
        list.innerHTML = '';
        let i = 0;
        if (st.from && st.to) {
          const go = h('button', 'srch-go');
          go.innerHTML =
            `<span class="srch-go-g">${ic('route', 22)}</span>` +
            '<span class="srch-text"><span class="srch-go-t">price every way there</span>' +
            `<span class="srch-go-s">${esc(st.from.name)} → ${esc(st.to.name)}</span></span>` +
            `<span class="srch-go-c">${ic('chevron', 18)}</span>`;
          S.press(go, () => goCompare());
          list.appendChild(go);
          enter(go, i++);
        }
        const qq = quiet('search', T.hint, 'the preview keeps no history — nothing you type is saved');
        const tr = h('div', 'srch-try');
        tr.innerHTML = 'try&nbsp; ';
        TRY.forEach((w, k) => {
          if (k) tr.appendChild(h('span', 'srch-sep', '·'));
          const b = h('button', 'srch-trybtn', esc(w));
          S.press(b, () => { setQuery(w); focusInput(); });
          tr.appendChild(b);
        });
        qq.appendChild(tr);
        list.appendChild(qq);
        enter(qq, i++);
        const near = st.from || O;
        const sec = h('div', 'srch-sec', `<span>${T.answers}</span>`);
        list.appendChild(sec);
        enter(sec, i++);
        const door = (glyph, title, sub, id) => {
          const b = h('button', 'srch-item sim-hl');
          b.innerHTML = `<span class="srch-glyph">${ic(glyph, 22)}</span><span class="srch-text"><span class="srch-title">${esc(title)}</span><span class="srch-sub">${esc(sub)} · near ${esc(near.name)}</span></span>`;
          S.press(b, () => { input.blur(); S.push(id, { lat: near.lat, lon: near.lon, name: near.name }); });
          list.appendChild(b);
          enter(b, i++);
        };
        door('hotel', T.stays, T.staysSub, 'stays');
        door('explore', T.play, T.playSub, 'hours');
      }

      /* ── picking ── */
      function pick(p) {
        if (st.busy || dead) return;
        if (st.slot === 'from') {
          st.from = tagOrigin({ lat: p.lat, lon: p.lon, name: p.name, subtitle: p.subtitle, outside: p.outside });
          if (st.to) { paintCard(); goCompare(); return; }
          arm('to', true);
          return;
        }
        st.to = { lat: p.lat, lon: p.lon, name: p.name, subtitle: p.subtitle, outside: p.outside };
        paintCard();
        if (!S.reduced && valTo.animate) valTo.animate([{ opacity: 0.2, transform: 'translate3d(0,4px,0)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)' });
        goCompare();
      }
      function goCompare() {
        if (!st.from || !st.to || st.busy) return;
        st.busy = true;
        input.blur();
        const from = { lat: st.from.lat, lon: st.from.lon, name: st.from.name, preview: !!st.from.preview, outside: !!st.from.outside };
        const to = { lat: st.to.lat, lon: st.to.lon, name: st.to.name, preview: !!st.to.preview, outside: !!st.to.outside };
        /* reduced motion wants the jump now — no 140 ms beat, no intermediate state */
        if (S.reduced) { st.busy = false; S.push('compare', { from, to, via: 'search' }); return; }
        later(() => { st.busy = false; if (!dead) S.push('compare', { from, to, via: 'search' }); }, 140);
      }

      /* compare's From / To halves land back here armed on that slot */
      const onEdit = (e) => {
        const slot = e && e.detail && e.detail.slot;
        if (slot === 'from' || slot === 'to') { st.slot = slot; paintCard(); setQuery(''); }
      };
      window.addEventListener('simtrip:edit', onEdit);
      root.addEventListener('sim:show', () => { st.busy = false; if (fine) later(focusInput, 60); });

      paintCard();
      paintIdle();
      if (fine) later(focusInput, 420);

      return () => {
        dead = true;
        clearTimeout(debounce); clearTimeout(retry);
        timers.forEach(clearTimeout);
        window.removeEventListener('simtrip:edit', onEdit);
      };
    },
  });
})();
