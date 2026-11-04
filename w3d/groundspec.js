/* What a battle's ground may be, and the named features a reply places on it. Pure (no DOM, no three.js), so turn.js
   and tests/ can use it in node; w3d/ground.js loads and lays out the ground itself.
   battleDemo.ground is either a library id (w3d/grounds/<id>.json, real relief, cover and villages) or
   {kind, villages?, woods?, streams?, heights?}: the page lays that kind of country on the real relief at battleDemo.center,
   then draws the named features where the account puts them. Coordinates are metres east (e) and north (n) of center. */

export const FIELD = { cell: 30, cols: 198, rows: 132, w: 5940, h: 3960 };
// the library built by src/ground_build.py (w3d/grounds/index.json; a test keeps the two in step)
export const GROUNDS = ['mollwitz', 'brieg', 'neisse', 'glogau', 'chotusitz', 'prague', 'leuthen', 'linz'];
// kinds of country the page lays out itself on live relief for any other field
export const GROUND_KINDS = ['open plain', 'river crossing', 'vineyards', 'marsh', 'wooded hills'];
// the words of the earlier ground format (Nov 2026) and plain synonyms, read as the nearest kind
export const KIND_ALIASES = { plain: 'open plain', farmland: 'open plain', open: 'open plain', wooded: 'wooded hills', hills: 'wooded hills', woods: 'wooded hills', river: 'river crossing', crossing: 'river crossing', vines: 'vineyards', swamp: 'marsh' };
export const VILLAGE_SIZES = { hamlet: 55, village: 110, town: 190 };
// drawn width of named water in metres (a stream narrower than a cell is water to the rules but drawn at its own width)
export const STREAM_W = { stream: 8, river: 45 };

const HALF_E = FIELD.w / 2, HALF_N = FIELD.h / 2;
const num = v => typeof v === 'number' && Number.isFinite(v);
const onField = (e, n) => num(e) && num(n) && Math.abs(e) <= HALF_E && Math.abs(n) <= HALF_N;
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// what the reply gave, made safe. Unknown library ids and kinds read as the nearest kind (a warning: the field differs
// from what was asked); features off the field are dropped (a fix).
export function cleanGround(g, fixes = [], warns = []) {
  if (g == null) return g;
  if (typeof g === 'string') {
    if (GROUNDS.includes(g)) return g;
    const k = KIND_ALIASES[g] || (GROUND_KINDS.includes(g) ? g : null);
    if (k) return { kind: k };
    warns.push('Unknown battle ground "' + g + '": the field is laid out as open plain on the relief at battleDemo.center. Grounds: ' + GROUNDS.join(', ') + '; or {"kind": ' + GROUND_KINDS.map(k => '"' + k + '"').join(' | ') + '}.');
    return { kind: 'open plain', asked: g };
  }
  if (!isObj(g)) { warns.push('battleDemo.ground was not a library id or an object; the field is laid out as open plain.'); return { kind: 'open plain' }; }
  if (!GROUND_KINDS.includes(g.kind)) {
    const k = KIND_ALIASES[g.kind];
    if (k) { fixes.push('Ground "' + g.kind + '" read as "' + k + '".'); g.kind = k; }
    else { warns.push('Unknown ground kind ' + JSON.stringify(g.kind) + ': laid out as open plain. Kinds: ' + GROUND_KINDS.join(', ') + '.'); if (typeof g.kind === 'string') g.asked = g.kind; g.kind = 'open plain'; }
  }
  const keep = (key, ok, what) => { if (!(key in g)) return; if (!Array.isArray(g[key])) { fixes.push('ground.' + key + ' was not a list and was left out.'); delete g[key]; return; }
    g[key] = g[key].filter((f, i) => { const good = isObj(f) && ok(f); if (!good) fixes.push(what + ' ' + (i + 1) + ' (' + ((f && f.name) || 'unnamed') + ') was left out: it needs a place on the field (e, n within ±' + HALF_E + ' and ±' + HALF_N + ' m).'); return good; }); };
  keep('villages', f => onField(f.e, f.n), 'Village');
  keep('woods', f => onField(f.e, f.n), 'Wood');
  keep('heights', f => onField(f.e, f.n), 'Height');
  keep('streams', f => Array.isArray(f.path) && f.path.length >= 2 && f.path.every(p => Array.isArray(p) && num(p[0]) && num(p[1])), 'Stream');
  for (const v of g.villages || []) if (v.size && !VILLAGE_SIZES[v.size]) { fixes.push('Unknown size "' + v.size + '" for ' + (v.name || 'a village') + ' read as village.'); v.size = 'village'; }
  for (const s of g.streams || []) { if (s.kind && !STREAM_W[s.kind]) s.kind = 'stream'; s.crossings = (Array.isArray(s.crossings) ? s.crossings : []).filter(p => Array.isArray(p) && onField(p[0], p[1])); }
  for (const h of g.heights || []) { h.r = Math.max(150, Math.min(1500, num(h.r) ? h.r : 500)); h.h = Math.max(5, Math.min(80, num(h.h) ? h.h : 25)); }
  return g;
}

/* ---------- named features on a laid-out field ---------- */
function hashSeed(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function noiseOf(seed) {
  const h = (x, y) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296 * 2 - 1; };
  const s = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = s(x - xi), fy = s(y - yi), a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
}
const segD = (e, n, [ae, an], [be, bn]) => { const de = be - ae, dn = bn - an, L = de * de + dn * dn || 1, t = Math.max(0, Math.min(1, ((e - ae) * de + (n - an) * dn) / L)); return Math.hypot(e - ae - de * t, n - an - dn * t); };

// the named heights rise from the real relief: relief nodes (cols × rows at `step`, the first at (−w/2, +h/2)), in metres
export function raiseHeights(inner, cols, rows, step, heights) {
  for (const p of heights || []) for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const e = -FIELD.w / 2 + i * step, n = FIELD.h / 2 - j * step;
    inner[j * cols + i] += p.h * Math.exp(-((e - p.e) ** 2 + (n - p.n) ** 2) / (2 * (p.r * .45) ** 2));
  }
}

/* Draws the reply's features into a laid-out grid (rows of '0' open, '1' wood, '2' water, '3' village): the armies'
   ground is cleared first, then woods, villages, water, and the bridges and fords left dry. Returns the rivers to draw
   ({w, p, name}) and the names to letter ({name, e, n, what}). The same battle and ground always draw the same way. */
export function stampFeatures(rows_str, ground, units = [], seedText = '') {
  const { cell, cols, rows } = FIELD, N = noiseOf(hashSeed(seedText + JSON.stringify(ground)));
  const grid = rows_str.map(r => r.split(''));
  const eOf = c => -HALF_E + (c + .5) * cell, nOf = r => HALF_N - (r + .5) * cell;
  const each = fn => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) fn(r, c, eOf(c), nOf(r)); };
  const us = (units || []).filter(u => u && num(u.e) && num(u.n));
  // the armies are drawn up on open ground where the account puts them
  if (us.length) each((r, c, e, n) => { if (grid[r][c] !== '2' && us.some(u => Math.hypot(u.e - e, u.n - n) < 150)) grid[r][c] = '0'; });
  for (const w of ground.woods || []) { const we = Math.max(60, w.w || 400) / 2, wn = Math.max(60, w.d || 300) / 2;
    each((r, c, e, n) => { const q = ((e - w.e) / we) ** 2 + ((n - w.n) / wn) ** 2; if (q < 1 + .3 * N(e / 80 + 5, n / 80 - 5)) grid[r][c] = '1'; }); }
  for (const v of ground.villages || []) { const rad = VILLAGE_SIZES[v.size || 'village'];
    each((r, c, e, n) => { if (Math.hypot(e - v.e, n - v.n) < rad * (1 + .35 * N(e / 60 + v.e, n / 60 + v.n))) grid[r][c] = '3'; }); }
  const rivers = [];
  for (const s of ground.streams || []) { const w = STREAM_W[s.kind || 'stream'], half = Math.max(w / 2, cell * .5) + cell * .2;
    each((r, c, e, n) => { let d = Infinity; for (let i = 1; i < s.path.length; i++) d = Math.min(d, segD(e, n, s.path[i - 1], s.path[i])); if (d < half) grid[r][c] = '2'; });
    for (const [ce, cn] of s.crossings || []) each((r, c, e, n) => { if (Math.hypot(e - ce, n - cn) < 45 && grid[r][c] === '2') grid[r][c] = '0'; });
    rivers.push({ w, p: s.path.map(p => [p[0], p[1]]), name: s.name || null, src: 'as the account describes it' }); }
  const mid = s => s.path[Math.floor(s.path.length / 2)];
  const names = [...(ground.villages || []).map(v => ({ name: v.name, e: v.e, n: v.n, what: 'village' })), ...(ground.woods || []).map(w => ({ name: w.name, e: w.e, n: w.n, what: 'wood' })),
    ...(ground.heights || []).map(h => ({ name: h.name, e: h.e, n: h.n, what: 'height' })), ...(ground.streams || []).filter(s => s.name).map(s => ({ name: s.name, e: mid(s)[0], n: mid(s)[1], what: s.kind || 'stream' }))].filter(x => x.name);
  return { rows_str: grid.map(r => r.join('')), rivers, names };
}
