/* Alive webapp — DIGIPIN (India Post's official 4m x 4m address grid).
   Owned by the search lane. Contract:
     A.digipin.encode(lat, lon) -> 'XXX-XXX-XXXX' | null
     A.digipin.decode(code)     -> { lat, lon } | null   (cell centre)
     A.digipin.match(text)      -> canonical code if text IS a DIGIPIN, else null

   Encode/decode below is a straight port of India Post's reference
   implementation (getDigiPin / getLatLngFromDigiPin):
     https://github.com/INDIAPOST-gov/digipin  (src/digipin.js)
     Developed by India Post, Department of Posts (CEPT).
     Licensed under the Apache License, Version 2.0
     (http://www.apache.org/licenses/LICENSE-2.0).
   Changes from the reference: errors return null instead of throwing,
   decode returns numbers (6-decimal centre like the reference) and the
   display form carries the familiar 3-3-4 dashes; the grid, bounds and
   per-level arithmetic are untouched. */
(() => {
'use strict';

const DIGIPIN_GRID = [
  ['F', 'C', '9', '8'],
  ['J', '3', '2', '7'],
  ['K', '4', '5', '6'],
  ['L', 'M', 'P', 'T'],
];

const BOUNDS = { minLat: 2.5, maxLat: 38.5, minLon: 63.5, maxLon: 99.5 };

const CHARS = /^[23456789CJKLMPFT]{10}$/;

/* 'XXXXXXXXXX' → 'XXX-XXX-XXXX' */
const dash = (p) => `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;

/* port of getDigiPin(lat, lon) */
function encode(lat, lon) {
  lat = +lat; lon = +lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat) return null;
  if (lon < BOUNDS.minLon || lon > BOUNDS.maxLon) return null;

  let minLat = BOUNDS.minLat;
  let maxLat = BOUNDS.maxLat;
  let minLon = BOUNDS.minLon;
  let maxLon = BOUNDS.maxLon;
  let pin = '';

  for (let level = 1; level <= 10; level++) {
    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;

    /* reversed row logic (row 0 = north), as in the reference */
    let row = 3 - Math.floor((lat - minLat) / latDiv);
    let col = Math.floor((lon - minLon) / lonDiv);

    row = Math.max(0, Math.min(row, 3));
    col = Math.max(0, Math.min(col, 3));

    pin += DIGIPIN_GRID[row][col];

    maxLat = minLat + latDiv * (4 - row);
    minLat = minLat + latDiv * (3 - row);

    minLon = minLon + lonDiv * col;
    maxLon = minLon + lonDiv;
  }
  return dash(pin);
}

/* strip separators/case; 10 approved chars or null */
function compact(code) {
  if (typeof code !== 'string') return null;
  const pin = code.replace(/[\s\-–—_.]/g, '').toUpperCase();
  return CHARS.test(pin) ? pin : null;
}

/* port of getLatLngFromDigiPin(digiPin) */
function decode(code) {
  const pin = compact(code);
  if (!pin) return null;

  let minLat = BOUNDS.minLat;
  let maxLat = BOUNDS.maxLat;
  let minLon = BOUNDS.minLon;
  let maxLon = BOUNDS.maxLon;

  for (let i = 0; i < 10; i++) {
    const ch = pin[i];
    let ri = -1, ci = -1;
    for (let r = 0; r < 4 && ri < 0; r++) {
      const c = DIGIPIN_GRID[r].indexOf(ch);
      if (c >= 0) { ri = r; ci = c; }
    }
    if (ri < 0) return null;

    const latDiv = (maxLat - minLat) / 4;
    const lonDiv = (maxLon - minLon) / 4;

    const lat1 = maxLat - latDiv * (ri + 1);
    const lat2 = maxLat - latDiv * ri;
    const lon1 = minLon + lonDiv * ci;
    const lon2 = minLon + lonDiv * (ci + 1);

    minLat = lat1; maxLat = lat2;
    minLon = lon1; maxLon = lon2;
  }
  return {
    lat: +((minLat + maxLat) / 2).toFixed(6),
    lon: +((minLon + maxLon) / 2).toFixed(6),
  };
}

/* is the WHOLE text a DIGIPIN? Accepts 39JJ567L7P, 39j-j56-7l7p,
   '39J J56 7L7P', 'digipin: 39J-J56-7L7P'. A bare 10-digit string is
   only taken when typed in the 3-3-4 shape — otherwise a phone number
   made of 2-9 would read as a pin. */
function match(text) {
  if (typeof text !== 'string') return null;
  let s = text.trim().replace(/^digi\s*pin\s*[:#-]?\s*/i, '');
  if (s.length < 10 || s.length > 16) return null;
  const pin = compact(s);
  if (!pin) return null;
  const shaped = /^[0-9a-z]{3}[\s\-–—]+[0-9a-z]{3}[\s\-–—]+[0-9a-z]{4}$/i.test(s);
  if (!/[CJKLMPFT]/.test(pin) && !shaped) return null;
  return dash(pin);
}

A.digipin = { encode, decode, match, compact };
})();
