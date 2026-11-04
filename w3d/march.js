/* Marching on the table (game-v13, after battle-atlas). The pure helpers are exported for the tests; install() gives the
   desk's battle engine its hooks (window.__march), as w3d/campaign.js does for the enemy's temper.
   - Lines keep their facing while they advance, give ground or step obliquely (up to 60° off the front), and wheel on a
     flank to turn: the outer flank marches the arc, so a long line turns slower than a short one.
   - Columns take a route over the ground's 30 m grid: roads are quick and bridge the water; woods, marsh, vines and
     villages cost what they slow a march; water is avoided wherever a way round exists.
   - Units do not pass through one another: the one that is moving gives way, a routing one most of all.
   - Troop types (battle-atlas): inf line infantry, gd guards, lt light infantry, cav horse, lc light horse, art guns. The
     engine knows three classes (u.type inf / cav / art); the troop type rides on u.kind and shades speed, fire, cover,
     shock and sight. Code supplies these rules of the table; who fights where, and with what, is Claude's choice. */

export const TROOPS = {
  inf: { type: 'inf', word: 'Line infantry', men: 600, speed: 1, fire: 1, cover: 1, shock: 1, mor: 0, sight: 900, wood: .5 },
  gd: { type: 'inf', word: 'Guards', men: 600, speed: 1, fire: 1.15, cover: 1, shock: 1.35, mor: 12, sight: 900, wood: .5 },
  lt: { type: 'inf', word: 'Light infantry', men: 300, speed: 1.35, fire: .55, cover: .45, shock: .55, mor: 0, sight: 1200, wood: .9, open: true },
  cav: { type: 'cav', word: 'Horse', men: 130, speed: 1, fire: 0, cover: 1, shock: 1, mor: 0, sight: 1600, wood: .3 },
  lc: { type: 'cav', word: 'Light horse', men: 110, speed: 1.2, fire: 0, cover: 1, shock: .7, mor: 0, sight: 2200, wood: .35 },
  art: { type: 'art', word: 'Guns', men: 60, speed: 1, fire: 1, cover: 1, shock: 1, mor: 0, sight: 700, wood: .5 },
};
export const kindOf = u => TROOPS[u.kind] ? u.kind : TROOPS[u.type] ? u.type : 'inf';
// a troop type given as a unit's type becomes the engine's class plus the kind
export function normalizeUnit(u) {
  if (!u || !u.type) return u;
  if (TROOPS[u.type] && TROOPS[u.type].type !== u.type) { u.kind = u.type; u.type = TROOPS[u.kind].type; }
  return u;
}

const RAD = Math.PI / 180;
export const bearing = (de, dn) => (Math.atan2(de, dn) / RAD + 360) % 360;
export const rel = (a, b) => ((a - b + 540) % 360) - 180; // signed degrees from b to a

// one step of a wheel on the inner flank toward `want`; returns {e, n, facing}
export function wheel(u, want, width, maxDeg) {
  const df = Math.max(-maxDeg, Math.min(maxDeg, rel(want, u.facing)));
  if (Math.abs(df) < 1e-9) return { e: u.e, n: u.n, facing: u.facing };
  const f0 = u.facing * RAD, f1 = (u.facing + df) * RAD, s = df > 0 ? 1 : -1, h = width / 2;
  // right of a bearing f is (cos f, −sin f) in (e, n); the pivot is the flank on the side of the turn
  const pe = u.e + s * Math.cos(f0) * h, pn = u.n - s * Math.sin(f0) * h;
  return { e: pe - s * Math.cos(f1) * h, n: pn + s * Math.sin(f1) * h, facing: (u.facing + df + 360) % 360 };
}

// minimal push that separates two facing rectangles (centre e/n, facing, w along the front, d in depth); null if apart
export function separation(a, da, b, db) {
  const corners = (u, d) => { const f = u.facing * RAD, fx = Math.sin(f), fy = Math.cos(f), rx = Math.cos(f), ry = -Math.sin(f), w = d.w / 2, h = d.d / 2;
    return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [u.e + rx * w * i + fx * h * j, u.n + ry * w * i + fy * h * j]); };
  const A = corners(a, da), B = corners(b, db), axes = [];
  for (const u of [a, b]) { const f = u.facing * RAD; axes.push([Math.sin(f), Math.cos(f)], [Math.cos(f), -Math.sin(f)]); }
  let best = null;
  for (const [x, y] of axes) {
    const pa = A.map(p => p[0] * x + p[1] * y), pb = B.map(p => p[0] * x + p[1] * y);
    const o = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    if (o <= 0) return null;
    if (!best || o < best.depth) { const sgn = (b.e - a.e) * x + (b.n - a.n) * y >= 0 ? 1 : -1; best = { x: x * sgn, y: y * sgn, depth: o }; }
  }
  return best; // push b along (x, y), a the other way
}

/* A route over the grid: g = {cols, rows, cell, w, h}, cost(c, r) the price of crossing a cell (Infinity = never).
   from/to in metres (e, n). Returns waypoints [[e, n], …] ending at `to`, with straight runs merged. */
export function findRoute(g, cost, from, to) {
  const { cols, rows, cell, w, h } = g, N = cols * rows;
  const cr = ([e, n]) => [Math.max(0, Math.min(cols - 1, Math.floor((e + w / 2) / cell))), Math.max(0, Math.min(rows - 1, Math.floor((h / 2 - n) / cell)))];
  const ctr = k => [-w / 2 + (k % cols + .5) * cell, h / 2 - (Math.floor(k / cols) + .5) * cell];
  const [c0, r0] = cr(from), [c1, r1] = cr(to), s = r0 * cols + c0, t = r1 * cols + c1;
  if (s === t) return [to];
  let cmin = Infinity; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const v = cost(c, r); if (v < cmin) cmin = v; }
  const G = new Float64Array(N).fill(Infinity), P = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [];
  const hx = k => Math.hypot(k % cols - c1, Math.floor(k / cols) - r1) * cmin;
  const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  G[s] = 0; push(hx(s), s);
  while (heap.length) {
    const [, k] = pop(); if (done[k]) continue; done[k] = 1; if (k === t) break;
    const c = k % cols, r = Math.floor(k / cols), ck = cost(c, r);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue; const cc = c + dc, rr = r + dr; if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
      const kk = rr * cols + cc; if (done[kk]) continue; const cn = cost(cc, rr); if (!isFinite(cn)) continue;
      const g2 = G[k] + (ck + cn) / 2 * (dr && dc ? Math.SQRT2 : 1);
      if (g2 < G[kk]) { G[kk] = g2; P[kk] = k; push(g2 + hx(kk), kk); }
    }
  }
  if (P[t] < 0) return [to];
  const cells = []; for (let k = t; k !== -1; k = P[k]) cells.push(k); cells.reverse();
  // merge straight runs: from each kept cell, jump to the farthest cell whose straight line costs no more than the path
  const out = [];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    for (; j > i + 1; j--) {
      const [ax, ay] = ctr(cells[i]), [bx, by] = ctr(cells[j]), L = Math.hypot(bx - ax, by - ay), steps = Math.ceil(L / (cell / 4)); let sc = 0;
      for (let q = 0; q < steps; q++) { const [cc, rr] = cr([ax + (bx - ax) * (q + .5) / steps, ay + (by - ay) * (q + .5) / steps]); sc += cost(cc, rr) * L / steps / cell; }
      if (sc <= G[cells[j]] - G[cells[i]] + .05) break;
    }
    out.push(ctr(cells[j])); i = j;
  }
  out[out.length - 1] = [to[0], to[1]];
  return out;
}

// cells a set of polylines (metres) pass through, for roads
export function rasterize(lines, g) {
  const set = new Set();
  for (const p of lines) for (let i = 1; i < p.length; i++) {
    const [x1, y1] = p[i - 1], [x2, y2] = p[i], k = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (g.cell / 3)));
    for (let j = 0; j <= k; j++) { const c = Math.floor((x1 + (x2 - x1) * j / k + g.w / 2) / g.cell), r = Math.floor((g.h / 2 - (y1 + (y2 - y1) * j / k)) / g.cell); if (c >= 0 && r >= 0 && c < g.cols && r < g.rows) set.add(r * g.cols + c); }
  }
  return set;
}

/* ---------- the hooks the desk's battle engine calls (globals: TER, terrainAt, terMul, SPEED, dims, alive) ---------- */
export function install() {
  const K = u => TROOPS[kindOf(u)];
  let roadKey = null, roads = new Set();
  const roadSet = () => { const g = window.__ground, key = TER.id + ':' + (g ? g.key : ''); if (key !== roadKey) { roadKey = key; roads = rasterize(((g && g.roads) || []).map(r => r.p), TER); } return roads; };
  const cellOf = (e, n) => { const c = Math.floor((e + TER.w / 2) / TER.cell), r = Math.floor((TER.h / 2 - n) / TER.cell); return c < 0 || r < 0 || c >= TER.cols || r >= TER.rows ? -1 : r * TER.cols + c; };
  const onRoad = (e, n) => roadSet().has(cellOf(e, n));
  // how fast a unit goes over a cell: the engine's land cover rule, light infantry at home in woods, roads quick for all
  const goes = (u, t, road) => {
    if (road) return u.form === 'column' ? 1.3 : 1.05;
    if (t === 1) return K(u).wood;
    return terMul(u, t);
  };
  const route = (u, to) => {
    const rs = roadSet(), cost = (c, r) => { const k = r * TER.cols + c, t = +TER.rows_str[r][c], road = rs.has(k); const v = goes(u, t, road); return t === 2 && !road ? 1 / v * 2 : 1 / v; };
    return findRoute(TER, cost, [u.e, u.n], to);
  };
  const mover = {
    move(u) {
      if (!alive(u) || u.st === 'routing') return; u.moved = false; const o = u.ord; if (!o) return;
      if (o.form && o.form !== u.form) { u.form = o.form; o.form = null; o.path = null; }
      const isLine = (u.form || 'line') === 'line' && u.type !== 'art', W = dims(u).w;
      const sp0 = SPEED[u.type][u.form || 'line'] * .5 * K(u).speed * (u.st === 'wavering' ? .6 : 1), wheelMax = Math.min(12, sp0 / Math.max(20, W) / RAD);
      if (o.dest) {
        const d0 = Math.hypot(o.dest[0] - u.e, o.dest[1] - u.n);
        const sp = sp0 * goes(u, terrainAt(u.e, u.n), onRoad(u.e, u.n)) * (o.mode === 'charge' && d0 < 260 ? 1.6 : 1);
        if (d0 <= Math.max(4, sp)) {
          u.e = o.dest[0]; u.n = o.dest[1]; o.dest = null; o.path = null; u.moved = true;
          if (o.facing != null && !isLine) { u.facing = o.facing; o.facing = null; }
          if (o.mode === 'advance' || o.mode === 'retire') o.mode = 'hold'; u.mode = o.mode || 'hold'; return;
        }
        let tgt = o.dest;
        if (u.form === 'column' && u.type !== 'art') {
          const key = o.dest.join(',');
          if (!o.path || o.pathTo !== key) { o.path = route(u, o.dest); o.pathTo = key; }
          while (o.path.length > 1 && Math.hypot(o.path[0][0] - u.e, o.path[0][1] - u.n) < Math.max(10, sp)) o.path.shift();
          tgt = o.path[0];
        }
        const dx = tgt[0] - u.e, dy = tgt[1] - u.n, d = Math.hypot(dx, dy) || 1, want = bearing(dx, dy);
        const step = (k) => { const s = Math.min(sp * k, d); u.e += dx / d * s; u.n += dy / d * s; u.moved = true; if (u.type === 'inf' && terrainAt(u.e, u.n) !== 0 && !K(u).open && !onRoad(u.e, u.n)) u.coh -= 1.2; };
        if (isLine) {
          const r = Math.abs(rel(want, u.facing));
          if (r <= 60) step(1);                       // advance, or step obliquely, in line
          else if (r >= 120 && o.mode !== 'charge') step(.6); // give ground facing the enemy
          else { const w2 = wheel(u, want, W, wheelMax); u.e = w2.e; u.n = w2.n; u.facing = w2.facing; u.moved = true; }
        } else {
          step(1); const rate = u.form === 'column' ? 25 : 12, df = rel(want, u.facing); u.facing = (u.facing + Math.max(-rate, Math.min(rate, df)) + 360) % 360;
        }
        if (o.mode) u.mode = o.mode;
      } else if (o.facing != null) {
        const df = rel(o.facing, u.facing);
        if (isLine) { const w2 = wheel(u, o.facing, W, wheelMax); u.e = w2.e; u.n = w2.n; u.facing = w2.facing; }
        else { const rate = u.form === 'column' ? 25 : 12; u.facing = (u.facing + Math.max(-rate, Math.min(rate, df)) + 360) % 360; }
        if (Math.abs(df) < 3) o.facing = null;
      }
    },
    // after every unit has moved: none stands in another; the one that moved gives way
    after(us) {
      const L = us.filter(u => alive(u) && u.st !== 'gone'), D = L.map(u => dims(u)), give = u => u.st === 'routing' ? 6 : u.moved ? 4 : 1;
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j], reach = (Math.max(D[i].w, D[i].d) + Math.max(D[j].w, D[j].d)) / 2;
        if (Math.abs(a.e - b.e) > reach || Math.abs(a.n - b.n) > reach) continue;
        const s = separation(a, D[i], b, D[j]); if (!s) continue;
        const ga = give(a), gb = give(b), wa = ga / (ga + gb), wb = 1 - wa;
        a.e -= s.x * s.depth * wa; a.n -= s.y * s.depth * wa; b.e += s.x * s.depth * wb; b.n += s.y * s.depth * wb;
      }
      for (const u of L) { u.e = Math.max(-TER.w / 2, Math.min(TER.w / 2, u.e)); u.n = Math.max(-TER.h / 2, Math.min(TER.h / 2, u.n)); }
    },
    men: u => K(u).men,
    mor: u => K(u).mor,
    sight: u => K(u).sight,
    fire: a => K(a).fire,
    // light infantry in open order is a poor target for musketry and guns
    cover: t => K(t).cover,
    // a charge on light infantry caught in the open breaks in easily; in woods or a village it does not
    charge: (a, t) => K(a).shock * (K(t).open ? ([1, 3].includes(terrainAt(t.e, t.n)) ? .4 : 1.6) : 1),
    shock: u => K(u).shock,
    onRoad, route,
  };
  window.__march = mover;
  return mover;
}
