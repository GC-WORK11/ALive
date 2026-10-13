/* store — Alive webapp persistence. Contract: CONTRACT.md
   localStorage  : profile + consent + settings  (small, sync, survives)
   IndexedDB     : receipts, cached plans, search recents  (larger, async)

   Keys:
     alive.profile.v1   { consent_geo, consent_ts, vehicle, vehicle_profile, name?, created }
     alive.settings.v1  { sharing, band_units, reduced_motion }
     alive.recents.v1   [ {name, lat, lon, kind, ts} ]  (max 8)

   IndexedDB 'alive-ledger' v1:
     receipts  (id, ts, origin, dest, mode, dose_ug, emission_g, eta_s, km, score, meta)
     plans     (id, ts, from, to, vehicle, options[], meta)
*/
(() => {
  'use strict';
  const LS = window.localStorage;
  const store = (window.STORE = {});

  /* ── localStorage helpers ─────────────────────────────────────────── */
  const readLS = (k, dflt) => {
    try { const v = LS.getItem(k); return v == null ? dflt : JSON.parse(v); }
    catch (e) { return dflt; }
  };
  const writeLS = (k, v) => { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} };

  store.profile = () => readLS('alive.profile.v1', null);
  store.setProfile = (patch) => {
    const p = Object.assign(store.profile() || { created: Date.now() }, patch);
    writeLS('alive.profile.v1', p); return p;
  };
  store.settings = () => readLS('alive.settings.v1', { sharing: false, reduced_motion: false });
  store.setSettings = (patch) => { const s = Object.assign(store.settings(), patch); writeLS('alive.settings.v1', s); return s; };

  store.recents = () => readLS('alive.recents.v1', []);
  store.pushRecent = (r) => {
    const list = store.recents().filter((x) => x.name !== r.name);
    list.unshift({ name: r.name, lat: r.lat, lon: r.lon, kind: r.kind || 'place', ts: Date.now() });
    writeLS('alive.recents.v1', list.slice(0, 8));
    return list;
  };

  /* ── IndexedDB ────────────────────────────────────────────────────── */
  let _db = null;
  function db() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open('alive-ledger', 1); } catch (e) { return rej(e); }
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('receipts')) d.createObjectStore('receipts', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('plans')) d.createObjectStore('plans', { keyPath: 'id' });
      };
      req.onsuccess = () => { _db = req.result; res(_db); };
      req.onerror = () => rej(req.error);
    });
  }
  const put = (os, obj) => db().then((d) => new Promise((res, rej) => {
    const tx = d.transaction(os, 'readwrite');
    tx.objectStore(os).put(obj);
    tx.oncomplete = () => res(obj); tx.onerror = () => rej(tx.error);
  })).catch(() => null);
  const all = (os, limit) => db().then((d) => new Promise((res, rej) => {
    const out = [];
    const tx = d.transaction(os, 'readonly');
    const rq = tx.objectStore(os).openCursor(null, 'prev');
    rq.onsuccess = () => {
      const c = rq.result;
      if (!c || (limit && out.length >= limit)) return res(out);
      out.push(c.value); c.continue();
    };
    rq.onerror = () => rej(rq.error);
  })).catch(() => []);
  const clear = (os) => db().then((d) => new Promise((res) => {
    const tx = d.transaction(os, 'readwrite');
    tx.objectStore(os).clear(); tx.oncomplete = res; tx.onerror = res;
  })).catch(() => null);

  store.saveReceipt = (r) => put('receipts', Object.assign({ id: 'rc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now() }, r));
  store.receipts = (n) => all('receipts', n || 50);
  store.savePlan = (p) => put('plans', Object.assign({ id: 'pl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now() }, p));
  store.plans = (n) => all('plans', n || 20);
  store.wipe = async () => {
    try { LS.removeItem('alive.recents.v1'); } catch (e) {}
    await clear('receipts'); await clear('plans');
  };
  store.wipeAll = async () => {
    try { ['alive.profile.v1', 'alive.settings.v1', 'alive.recents.v1'].forEach((k) => LS.removeItem(k)); } catch (e) {}
    await clear('receipts'); await clear('plans');
  };
  store.exportAll = async () => ({
    profile: store.profile(), settings: store.settings(), recents: store.recents(),
    receipts: await store.receipts(500), plans: await store.plans(100),
    exported_at: new Date().toISOString(), v: 1,
  });
})();
