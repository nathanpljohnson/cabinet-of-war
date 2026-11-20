/* The ground of a battle: the 30 m land-cover grid the table battle fights over (0 open, 1 wood, 2 water, 3 village) and
   the relief the 3D field is raised on. The adjudicator describes it (battleDemo.ground: a kind and named features); the
   page draws it, the same way every time for the same battle. Mollwitz, which has no ground given, keeps its mapped grid.
   Pure (no DOM), so tests/ can run it in node. Coordinates are metres east (e) and north (n) of battleDemo.center. */

export const FIELD = { cell: 30, cols: 198, rows: 132, w: 5940, h: 3960 };
// background woods (share of the ground), hamlets scattered about, and how much the land rises and falls
export const GROUND_KINDS = {
  plain: { relief: .35, wood: .04, hamlets: 2 },
  farmland: { relief: 1, wood: .09, hamlets: 4 },
  wooded: { relief: 2.2, wood: .34, hamlets: 2 },
  hills: { relief: 5.5, wood: .16, hamlets: 2 },
  river: { relief: .8, wood: .07, hamlets: 3, river: true },
};
export const VILLAGE_SIZES = { hamlet: 55, village: 110, town: 190 };
const STREAM_W = { stream: 21, river: 50 };
const HALF_E = FIELD.w / 2, HALF_N = FIELD.h / 2;

const num = v => typeof v === 'number' && Number.isFinite(v);
const onField = (e, n) => num(e) && num(n) && Math.abs(e) <= HALF_E && Math.abs(n) <= HALF_N;
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// what the reply gave, made safe: unknown words read as the nearest sensible one, features off the field are dropped
export function cleanGround(g, fixes = []) {
  if (!isObj(g)) return null;
  if ('kind' in g && !GROUND_KINDS[g.kind]) { fixes.push('Unknown ground "' + g.kind + '" read as farmland.'); g.kind = 'farmland'; }
  const keep = (key, ok, what) => { if (!(key in g)) return; if (!Array.isArray(g[key])) { fixes.push('ground.' + key + ' was not a list and was left out.'); delete g[key]; return; }
    g[key] = g[key].filter((f, i) => { const good = isObj(f) && ok(f); if (!good) fixes.push(what + ' ' + (i + 1) + ' (' + ((f && f.name) || 'unnamed') + ') was left out: it needs a place on the field (e, n within ±' + HALF_E + ' and ±' + HALF_N + ' m).'); return good; }); };
  keep('villages', f => onField(f.e, f.n), 'Village');
  keep('woods', f => onField(f.e, f.n), 'Wood');
  keep('heights', f => onField(f.e, f.n), 'Height');
  keep('streams', f => Array.isArray(f.path) && f.path.length >= 2 && f.path.every(p => Array.isArray(p) && num(p[0]) && num(p[1])), 'Stream');
  for (const v of g.villages || []) if (v.size && !VILLAGE_SIZES[v.size]) { fixes.push('Unknown size "' + v.size + '" for ' + (v.name || 'a village') + ' read as village.'); v.size = 'village'; }
  for (const s of g.streams || []) { if (s.kind && !STREAM_W[s.kind]) s.kind = 'stream'; s.crossings = (Array.isArray(s.crossings) ? s.crossings : []).filter(p => Array.isArray(p) && onField(p[0], p[1])); }
  for (const hgt of g.heights || []) { hgt.r = Math.max(150, Math.min(1500, num(hgt.r) ? hgt.r : 500)); hgt.h = Math.max(5, Math.min(80, num(hgt.h) ? hgt.h : 25)); }
  return g;
}

/* ---------- small deterministic noise ---------- */
function hashSeed(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function rngOf(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function noiseOf(seed) {
  const h = (x, y) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296 * 2 - 1; };
  const s = t => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi), a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
  v.fbm = (x, y, o = 3) => { let t = 0, amp = 1, f = 1, k = 0; for (let i = 0; i < o; i++) { t += v(x * f + i * 17, y * f - i * 11) * amp; k += amp; amp *= .5; f *= 2; } return t / k; };
  return v;
}
const segD = (e, n, [ae, an], [be, bn]) => { const de = be - ae, dn = bn - an, L = de * de + dn * dn || 1, t = Math.max(0, Math.min(1, ((e - ae) * de + (n - an) * dn) / L)); return Math.hypot(e - ae - de * t, n - an - dn * t); };
const centroid = us => us.length ? [us.reduce((s, u) => s + u.e, 0) / us.length, us.reduce((s, u) => s + u.n, 0) / us.length] : null;

// the grid for a battle with a described ground, or null when it has none (Mollwitz keeps its mapped grid)
export function makeGround(bd) {
  if (!bd || !isObj(bd.ground)) return null;
  const g = cleanGround(JSON.parse(JSON.stringify(bd.ground))), K = GROUND_KINDS[g.kind] || GROUND_KINDS.farmland, seed = hashSeed(bd.id || 'battle');
  const N = noiseOf(seed), R = rngOf(seed ^ 0x9e3779b9), { cell, cols, rows } = FIELD, grid = new Uint8Array(cols * rows);
  const eOf = c => -HALF_E + (c + .5) * cell, nOf = r => HALF_N - (r + .5) * cell;
  const each = fn => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) fn(r, c, eOf(c), nOf(r)); };
  const units = (bd.units || []).filter(u => u && num(u.e) && num(u.n));
  // background woods: the wettest-looking quarter of the noise, enough cells for the kind's share
  const vals = new Float32Array(cols * rows); each((r, c, e, n) => { vals[r * cols + c] = N.fbm(e / 700, n / 700, 3) + .45 * N(e / 210 + 40, n / 210 - 9); });
  const cut = [...vals].sort((a, b) => b - a)[Math.floor(vals.length * K.wood)] ?? Infinity;
  each((r, c) => { if (vals[r * cols + c] > cut) grid[r * cols + c] = 1; });
  // a few hamlets about the field, none where the armies stand
  const blob = (e0, n0, rad, t) => each((r, c, e, n) => { if (Math.hypot(e - e0, n - n0) < rad * (1 + .35 * N(e / 60 + e0, n / 60 + n0))) grid[r * cols + c] = t; });
  for (let i = 0, tries = 0; i < K.hamlets && tries < 60; tries++) { const e = (R() * 2 - 1) * HALF_E * .9, n = (R() * 2 - 1) * HALF_N * .9;
    if (units.some(u => Math.hypot(u.e - e, u.n - n) < 380)) continue; blob(e, n, 45 + R() * 40, 3); i++; }
  // the armies are drawn up on open ground: the background clears round every unit
  each((r, c, e, n) => { if (units.some(u => Math.hypot(u.e - e, u.n - n) < 150)) grid[r * cols + c] = 0; });
  // a river across the field when the kind says so and none is named: between the armies, square to the line joining them
  const streams = [...(g.streams || [])];
  if (K.river && !streams.some(s => s.kind === 'river')) {
    const a = centroid(units.filter(u => u.side === 'A')) || [0, -800], b = centroid(units.filter(u => u.side === 'B')) || [0, 800];
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(...d) || 1, p = [-d[1] / L, d[0] / L], far = 4000;
    streams.push({ name: null, kind: 'river', path: [[m[0] - p[0] * far, m[1] - p[1] * far], [m[0] + p[0] * far, m[1] + p[1] * far]], crossings: [[m[0] - p[0] * 650, m[1] - p[1] * 650], [m[0] + p[0] * 650, m[1] + p[1] * 650]] });
  }
  // named features, as the reply placed them: woods, then villages, then water, then the bridges and fords left dry
  for (const w of g.woods || []) { const we = Math.max(60, w.w || 400) / 2, wn = Math.max(60, w.d || 300) / 2;
    each((r, c, e, n) => { const q = ((e - w.e) / we) ** 2 + ((n - w.n) / wn) ** 2; if (q < 1 + .3 * N(e / 80 + 5, n / 80 - 5)) grid[r * cols + c] = 1; }); }
  for (const v of g.villages || []) blob(v.e, v.n, VILLAGE_SIZES[v.size || 'village'], 3);
  for (const s of streams) { const half = (STREAM_W[s.kind || 'stream'] || 21) / 2 + cell * .35;
    each((r, c, e, n) => { let d = Infinity; for (let i = 1; i < s.path.length; i++) d = Math.min(d, segD(e, n, s.path[i - 1], s.path[i])); if (d < half * (1 + .25 * N(e / 90, n / 90))) grid[r * cols + c] = 2; });
    for (const [ce, cn] of s.crossings || []) each((r, c, e, n) => { if (Math.hypot(e - ce, n - cn) < 45 && grid[r * cols + c] === 2) grid[r * cols + c] = 0; }); }
  // distance to water in metres (two-pass chamfer over the grid): the 3D field lays its valleys and banks by it
  const wdist = new Float32Array(cols * rows); for (let i = 0; i < wdist.length; i++) wdist[i] = grid[i] === 2 ? 0 : 1e9;
  const D1 = cell, D2 = cell * Math.SQRT2, relax = (i, j, d) => { if (wdist[j] + d < wdist[i]) wdist[i] = wdist[j] + d; };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c; if (c) relax(i, i - 1, D1); if (r) { relax(i, i - cols, D1); if (c) relax(i, i - cols - 1, D2); if (c < cols - 1) relax(i, i - cols + 1, D2); } }
  for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) { const i = r * cols + c; if (c < cols - 1) relax(i, i + 1, D1); if (r < rows - 1) { relax(i, i + cols, D1); if (c < cols - 1) relax(i, i + cols + 1, D2); if (c) relax(i, i + cols - 1, D2); } }
  const rows_str = []; for (let r = 0; r < rows; r++) { let s = ''; for (let c = 0; c < cols; c++) s += grid[r * cols + c]; rows_str.push(s); }
  const names = [...(g.villages || []).map(v => ({ name: v.name, e: v.e, n: v.n, what: 'village' })), ...(g.woods || []).map(w => ({ name: w.name, e: w.e, n: w.n, what: 'wood' })), ...(g.heights || []).map(h => ({ name: h.name, e: h.e, n: h.n, what: 'height' })), ...streams.filter(s => s.name).map(s => ({ name: s.name, e: s.path[Math.floor(s.path.length / 2)][0], n: s.path[Math.floor(s.path.length / 2)][1], what: s.kind || 'stream' }))].filter(x => x.name);
  return { ...FIELD, rows_str, legend: { 0: 'open', 1: 'wood', 2: 'water', 3: 'village' }, kind: g.kind, relief: K.relief, heights: g.heights || [], names, wdist };
}
// what identifies the ground a battle is fought on (the 3D field and the grid are rebuilt when it changes)
export const groundKey = bd => !bd ? '' : (bd.id || '') + '|' + JSON.stringify(bd.ground || null);
