import { makeNoise, rngFrom } from './lib.js';
import { GROUNDS, GROUND_KINDS } from './turn.js';

/* The ground a battle is fought on (state.battleDemo.ground).
   - A library id ('mollwitz', 'prague', …): w3d/grounds/<id>.json, built by src/ground_build.py from real relief,
     land cover and a gazetteer.
   - {kind}: a field not in the library. Real relief is fetched here for battleDemo.center (AWS Terrain Tiles, open to
     the browser); woods, water, marsh, vines and hamlets are laid on it for that kind of country. They are illustrative.
   The ground replaces TER in place, so the desk's battle engine, the desk map and the 3D field read the same grid.
   Code supplies the ground; Claude chooses it. */

const CELL = 30, COLS = 198, ROWS = 132, W = CELL * COLS, H = CELL * ROWS, HALF = 12600, OSTEP = 200;
const cache = new Map();

export function groundKey(bd) {
  const g = (bd || {}).ground, c = ((bd || {}).center || [0, 0]).map(v => (+v).toFixed(3)).join(',');
  if (typeof g === 'string' && GROUNDS.includes(g)) return g;
  const kind = g && typeof g === 'object' && GROUND_KINDS.includes(g.kind) ? g.kind : 'open plain';
  return 'live:' + kind + '@' + c;
}

// relief arrays: uint16 little-endian of (metres − min) × 10, base64
function decode(b64, n, min) {
  const bin = atob(b64), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = min + (bin.charCodeAt(i * 2) | bin.charCodeAt(i * 2 + 1) << 8) / 10;
  return out;
}

function sampler(arr, cols, rows, x0, y0, step) { // node (i,j) at e = x0 + i·step, n = y0 − j·step
  return (e, n) => {
    let u = (e - x0) / step, v = (y0 - n) / step; u = Math.max(0, Math.min(cols - 1.001, u)); v = Math.max(0, Math.min(rows - 1.001, v));
    const i = u | 0, j = v | 0, fu = u - i, fv = v - j, o = j * cols + i;
    return (arr[o] * (1 - fu) + arr[o + 1] * fu) * (1 - fv) + (arr[o + cols] * (1 - fu) + arr[o + cols + 1] * fu) * fv;
  };
}

// elevation (m above sea) anywhere: the field's 30 m relief inside, the 200 m country outside, blended over 300 m
function finish(g) {
  const R = g.relief, O = g.outer;
  g.inner = decode(R.b64, R.cols * R.rows, R.min); g.outerH = decode(O.b64, O.cols * O.rows, O.min);
  const fi = sampler(g.inner, R.cols, R.rows, -W / 2, H / 2, R.step), fo = sampler(g.outerH, O.cols, O.rows, -O.half, O.half, O.step);
  g.elev = (e, n) => {
    const d = Math.max(Math.abs(e) - W / 2, Math.abs(n) - H / 2);
    if (d >= 0) return fo(e, n);
    const k = Math.min(1, -d / 300); return fi(e, n) * k + fo(e, n) * (1 - k);
  };
  g.outerCover = (e, n) => { const c = Math.round((e + O.half) / O.step), r = Math.round((O.half - n) / O.step); const row = O.cover && O.cover[r]; return row && c >= 0 && c < row.length ? +row[c] : 0; };
  return g;
}

export async function loadGround(bd) {
  const key = groundKey(bd);
  if (cache.has(key)) return cache.get(key);
  let g;
  if (!key.startsWith('live:')) {
    const r = await fetch('w3d/grounds/' + key + '.json'); if (!r.ok) throw new Error('ground ' + key + ': ' + r.status);
    g = await r.json();
  } else g = await liveGround(bd.center, key.slice(5, key.indexOf('@')));
  g.key = key; finish(g); cache.set(key, g); return g;
}

// TER is the desk's const object: its fields are replaced, never the binding
export function applyGround(g) {
  Object.assign(TER, { cell: g.cell, cols: g.cols, rows: g.rows, w: g.w, h: g.h, rows_str: g.rows_str, legend: g.legend, id: g.key });
  window.__ground = g;
}

export async function syncGround(bd) {
  const key = groundKey(bd);
  if (window.__ground && window.__ground.key === key && TER.id === key) return window.__ground;
  const g = await loadGround(bd); applyGround(g); return g;
}

/* ---------- a field laid out on live relief ---------- */
async function terrarium(z, x, y) {
  const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`, { mode: 'cors' });
  if (!r.ok) throw new Error('relief tile ' + r.status);
  const bmp = await createImageBitmap(await r.blob()), c = new OffscreenCanvas(256, 256), cx = c.getContext('2d'); cx.drawImage(bmp, 0, 0);
  const d = cx.getImageData(0, 0, 256, 256).data, out = new Float32Array(65536);
  for (let i = 0; i < 65536; i++) out[i] = d[i * 4] * 256 + d[i * 4 + 1] + d[i * 4 + 2] / 256 - 32768;
  return out;
}
// metres above sea at every (e, n) of a list, from Terrarium tiles at zoom z
async function reliefAt(center, z, pts) {
  const [lat0, lon0] = center, ky = 111200, kx = 111200 * Math.cos(lat0 * Math.PI / 180), n2 = 2 ** z;
  const tx = lon => (lon + 180) / 360 * n2, ty = lat => (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * n2;
  const xy = pts.map(([e, n]) => [tx(lon0 + e / kx) * 256 - .5, ty(lat0 + n / ky) * 256 - .5]), tiles = new Map();
  for (const [px, py] of xy) for (const dx of [0, 1]) for (const dy of [0, 1]) { const k = (((px | 0) + dx) >> 8) + ',' + (((py | 0) + dy) >> 8); if (!tiles.has(k)) tiles.set(k, null); }
  await Promise.all([...tiles.keys()].map(async k => { const [x, y] = k.split(',').map(Number); tiles.set(k, await terrarium(z, x, y)); }));
  const at = (X, Y) => { const t = tiles.get((X >> 8) + ',' + (Y >> 8)); return t[(Y & 255) * 256 + (X & 255)]; };
  return xy.map(([px, py]) => { const X = Math.floor(px), Y = Math.floor(py), fu = px - X, fv = py - Y; return (at(X, Y) * (1 - fu) + at(X + 1, Y) * fu) * (1 - fv) + (at(X, Y + 1) * (1 - fu) + at(X + 1, Y + 1) * fu) * fv; });
}
function enc(arr) { let mn = Infinity; for (const v of arr) mn = Math.min(mn, v); let s = ''; for (const v of arr) { const q = Math.max(0, Math.min(65535, Math.round((v - mn) * 10))); s += String.fromCharCode(q & 255, q >> 8); } return { min: mn, b64: btoa(s) }; }

async function liveGround(center, kind) {
  const nodes = [], opts = [];
  for (let j = 0; j <= ROWS; j++) for (let i = 0; i <= COLS; i++) nodes.push([-W / 2 + i * CELL, H / 2 - j * CELL]);
  const oc = Math.round(2 * HALF / OSTEP) + 1; for (let j = 0; j < oc; j++) for (let i = 0; i < oc; i++) opts.push([-HALF + i * OSTEP, HALF - j * OSTEP]);
  let inner, outer, note = 'Relief: AWS Terrain Tiles (Terrarium), fetched for this field; a surface model, so woods and towns of today may stand a little high.';
  try { [inner, outer] = await Promise.all([reliefAt(center, 13, nodes), reliefAt(center, 11, opts)]); }
  catch (e) { inner = nodes.map(() => 150); outer = opts.map(() => 150); note = 'Relief could not be fetched (' + e.message + '); the field is drawn level.'; }
  const ie = enc(inner), oe = enc(outer);
  const g = { id: null, title: kind[0].toUpperCase() + kind.slice(1), place: 'Laid out for ' + kind + ' country at ' + center.map(v => (+v).toFixed(3)).join(', '), center, about: kind,
    cell: CELL, cols: COLS, rows: ROWS, w: W, h: H, legend: { 0: 'open', 1: 'wood', 2: 'water', 3: 'village', 4: 'marsh', 5: 'vineyard' },
    relief: { cols: COLS + 1, rows: ROWS + 1, step: CELL, min: ie.min, b64: ie.b64 }, outer: { half: HALF, step: OSTEP, cols: oc, rows: oc, min: oe.min, b64: oe.b64 },
    rivers: [], roads: [], places: [], notes: [note, 'Woods, water, marsh, vines, hamlets and tracks are laid out for "' + kind + '" country; they are illustrative, not mapped.'], sources: ['Relief: AWS Terrain Tiles (Terrarium)'], live: true };
  layOut(g, inner, kind, center); return g;
}

// land cover for a kind of country, drawn from the relief (high, low, steep, sunny) and a noise seeded by the place
function layOut(g, inner, kind, center) {
  const seed = Math.round(Math.abs(center[0] * 1e3 + center[1] * 7e3)), N = makeNoise(seed), rnd = rngFrom(seed);
  const C = COLS + 1, hN = (i, j) => inner[j * C + i];
  const cellH = new Float32Array(COLS * ROWS), slope = new Float32Array(COLS * ROWS), south = new Float32Array(COLS * ROWS);
  let lo = Infinity, hi = -Infinity;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const a = hN(c, r), b = hN(c + 1, r), d = hN(c, r + 1), e = hN(c + 1, r + 1), k = r * COLS + c, h = (a + b + d + e) / 4;
    const gx = ((b + e) - (a + d)) / (2 * CELL), gn = ((a + b) - (d + e)) / (2 * CELL); // rise per metre east, north
    cellH[k] = h; slope[k] = Math.hypot(gx, gn); south[k] = gn / (Math.hypot(gx, gn) || 1); lo = Math.min(lo, h); hi = Math.max(hi, h);
  }
  const span = Math.max(4, hi - lo), t = k => (cellH[k] - lo) / span;
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill('0'));
  const at = (r, c) => r * COLS + c, x = c => -W / 2 + (c + .5) * CELL, y = r => H / 2 - (r + .5) * CELL;
  // the lowest line across the field (east–west or north–south, whichever runs deeper): river, brook or wet ground follows it
  const lowLine = () => {
    const ew = [], ns = []; let dEW = 0, dNS = 0;
    for (let c = 0; c < COLS; c++) { let br = 0; for (let r = 0; r < ROWS; r++) if (cellH[at(r, c)] < cellH[at(br, c)]) br = r; ew.push(br); dEW += t(at(br, c)); }
    for (let r = 0; r < ROWS; r++) { let bc = 0; for (let c = 0; c < COLS; c++) if (cellH[at(r, c)] < cellH[at(r, bc)]) bc = c; ns.push(bc); dNS += t(at(r, bc)); }
    const sm = (a, n) => a.map((_, i) => { let s = 0, k = 0; for (let j = Math.max(0, i - n); j <= Math.min(a.length - 1, i + n); j++) { s += a[j]; k++; } return Math.round(s / k); });
    return dEW / COLS <= dNS / ROWS ? sm(ew, 9).map((r, c) => [r, c]) : sm(ns, 9).map((c, r) => [r, c]);
  };
  const paint = (r, c, v) => { if (r >= 0 && c >= 0 && r < ROWS && c < COLS) grid[r][c] = v; };
  const spots = []; // hamlets and the crossing, joined by tracks at the end
  const hamlet = (r0, c0, len, along) => { spots.push([x(c0), y(r0)]); for (let i = -len; i <= len; i++) for (let w = -1; w <= 1; w++) { const r = r0 + (along ? w : i), c = c0 + (along ? i : w); if (r >= 0 && c >= 0 && r < ROWS && c < COLS && grid[r][c] !== '2' && rnd() < .8) grid[r][c] = '3'; } };
  const flank = () => { for (let k = 0; k < 40; k++) { const r = 8 + Math.floor(rnd() * (ROWS - 16)), c = 8 + Math.floor(rnd() * (COLS - 16)); if (Math.abs(x(c)) > 1700 || Math.abs(y(r)) > 1300) return [r, c]; } return [10, 10]; };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const k = at(r, c), n1 = N.fbm(x(c) / 700, y(r) / 700, 3), n2 = N(x(c) / 180, y(r) / 180), tt = t(k);
    let v = '0';
    if (kind === 'wooded hills') v = tt > .5 - n1 * .25 || slope[k] > .1 || n1 > .5 ? '1' : '0';
    else if (kind === 'marsh') v = tt < .28 + n1 * .15 ? (n2 > .5 ? '2' : '4') : n1 > .5 ? '1' : '0';
    else if (kind === 'vineyards') v = slope[k] > .025 && south[k] > .3 && tt > .15 && tt < .92 && n1 > -.35 ? '5' : n1 > .55 ? '1' : '0';
    else if (kind === 'river crossing') v = tt < .15 && n2 > .2 ? '4' : n1 > .52 ? '1' : '0';
    else v = n1 > .5 && n2 > -.2 ? '1' : '0';   // open plain
    grid[r][c] = v;
  }
  if (kind === 'river crossing' || kind === 'marsh') {
    const line = lowLine(), wide = kind === 'river crossing' ? 1 : 0, pts = [];
    for (const [r, c] of line) { for (let w = -wide; w <= wide; w++) { const along = line.length === COLS; paint(along ? r + w : r, along ? c : c + w, '2'); } }
    for (let i = 0; i < line.length; i += 6) pts.push([x(line[i][1]), y(line[i][0])]); pts.push([x(line.at(-1)[1]), y(line.at(-1)[0])]);
    g.rivers.push({ w: kind === 'river crossing' ? 45 : 4, p: pts, src: 'laid out along the lowest line of the relief' });
    if (kind === 'river crossing') { // the crossing: a village on both banks at the point of the river nearest the centre, the bridge open
      let best = line[0]; for (const p of line) if (Math.hypot(x(p[1]), y(p[0])) < Math.hypot(x(best[1]), y(best[0]))) best = p;
      const along = line.length === COLS; hamlet(best[0] + (along ? -4 : 0), best[1] + (along ? 0 : -4), 5, along); hamlet(best[0] + (along ? 4 : 0), best[1] + (along ? 0 : 4), 5, along);
      for (let w = -2; w <= 2; w++) paint(along ? best[0] + w : best[0], along ? best[1] : best[1] + w, '3');
      g.places.push({ name: 'the crossing', e: x(best[1]), n: y(best[0]), src: 'laid out' });
      // the road over the crossing runs across the river from edge to edge
      const ce = x(best[1]), cn = y(best[0]); g.roads.push({ p: along ? [[ce, H / 2], [ce, cn], [ce, -H / 2]] : [[-W / 2, cn], [ce, cn], [W / 2, cn]], src: 'laid out' });
    }
  }
  for (let i = 0; i < 3; i++) { const [r, c] = flank(); hamlet(r, c, 4 + Math.floor(rnd() * 4), rnd() < .5); }
  // tracks: each hamlet to its nearest neighbour, and the first one on to the field's edge
  for (let i = 0; i < spots.length; i++) { let b = -1, bd = Infinity; for (let j = 0; j < spots.length; j++) if (j !== i) { const d = Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]); if (d < bd) { bd = d; b = j; } }
    if (b >= 0 && b > i) g.roads.push({ p: [spots[i], [(spots[i][0] + spots[b][0]) / 2 + (rnd() - .5) * 200, (spots[i][1] + spots[b][1]) / 2 + (rnd() - .5) * 200], spots[b]], src: 'laid out' }); }
  if (spots.length) { const [e, n] = spots[0]; g.roads.push({ p: [[e, n], Math.abs(e) / W > Math.abs(n) / H ? [Math.sign(e) * W / 2, n] : [e, Math.sign(n) * H / 2]], src: 'laid out' }); }
  g.rows_str = grid.map(r => r.join(''));
  g.outer.cover = []; { const oc = g.outer.cols; for (let j = 0; j < oc; j++) { let s = ''; for (let i = 0; i < oc; i++) { const e = -HALF + i * OSTEP, n = HALF - j * OSTEP; s += N.fbm(e / 2500, n / 2500, 3) > (kind === 'wooded hills' ? -.05 : .3) ? '1' : '0'; } g.outer.cover.push(s); } }
}
