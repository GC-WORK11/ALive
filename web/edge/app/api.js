/* api — typed wrappers over the Alive backend. Contract: CONTRACT.md
   Every call returns a promise; errors are {error:true, status, detail}.
   Relative paths — the Vercel edge rewrites /v2/* etc. to the API origin. */
(() => {
  'use strict';
  const S = window.SIM;
  const api = (window.API = {});

  const j = (r) => (r && r.error) ? r : (r || {});
  const qs = (o) => Object.keys(o).filter((k) => o[k] != null && o[k] !== '')
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&');

  api.city = () => S.cached('/v2/city', 300000, 20000).then(j);
  api.aqi = (lat, lon) => S.get('/aqi?' + qs({ lat, lon })).then(j);
  api.grid = () => S.cached('/grid?cells=34&param=pm2_5', 300000, 20000).then(j);
  api.why = (lat, lon) => S.get('/v2/why?' + qs({ lat, lon })).then(j);
  api.search = (q, lat, lon) =>
    S.get('/v2/search?' + qs({ q, lat, lon, limit: 10 })).then(j);
  api.reverse = (lat, lon) => S.get('/v2/reverse?' + qs({ lat, lon })).then(j);
  api.plan = (body) => S.post('/v2/plan', body).then(j);
  api.strip = (body) => S.post('/v2/strip', body).then(j);
  api.stays = (lat, lon) => S.get('/v2/stays?' + qs({ lat, lon })).then(j);
  api.playtime = (lat, lon) => S.get('/v2/playtime?' + qs({ lat, lon })).then(j);
  api.moves = () => S.cached('/v2/city/moves', 300000, 20000).then(j);
  api.today = () => S.cached('/v2/today', 300000, 20000).then(j);
  api.districts = () => S.cached('/v2/districts', 600000, 30000).then(j);
  api.archive = () => S.cached('/v2/archive', 900000, 60000).then(j);

  /* CPCB pm2.5 band index 0-5 → css var + label. Single source of truth. */
  const BANDS = [
    { v: 'var(--b0)', hex: '#6E93AE', label: 'Good', max: 30 },
    { v: 'var(--b1)', hex: '#C7A34F', label: 'Satisfactory', max: 60 },
    { v: 'var(--b2)', hex: '#CF8A50', label: 'Moderate', max: 90 },
    { v: 'var(--b3)', hex: '#C05F3A', label: 'Poor', max: 120 },
    { v: 'var(--b4)', hex: '#A83D30', label: 'Very poor', max: 250 },
    { v: 'var(--b5)', hex: '#6E2D28', label: 'Severe', max: Infinity },
  ];
  api.bandOf = (pm) => {
    const v = Number(pm);
    if (!isFinite(v) || v < 0) return BANDS[1];
    return BANDS.find((b) => v <= b.max) || BANDS[5];
  };
  api.fmtUg = (v) => (v == null || !isFinite(+v)) ? '—' : (+v >= 100 ? Math.round(+v) : (+v).toFixed(1)) + ' µg/m³';
  api.fmtDose = (v) => (v == null || !isFinite(+v)) ? '—' : Math.round(+v) + ' µg';
  api.fmtMin = (s) => (s == null || !isFinite(+s)) ? '—' : Math.max(1, Math.round(+s / 60)) + ' min';
  api.fmtKm = (m) => (m == null || !isFinite(+m)) ? '—' : (+m >= 1000 ? (+m / 1000).toFixed(1) + ' km' : Math.round(+m) + ' m');
})();
