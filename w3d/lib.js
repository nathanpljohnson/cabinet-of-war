import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function rngFrom(seed) {
  let s = seed | 0;
  return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// 2D simplex noise (Gustavson), seeded permutation
export function makeNoise(seed) {
  const r = rngFrom(seed), p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  const perm = new Uint8Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
  const F2 = .5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const n2 = (x, y) => {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
    const x0 = x - (i - t), y0 = y - (j - t), i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255; let n = 0;
    for (const [dx, dy, gi] of [[x0, y0, perm[ii + perm[jj]]], [x1, y1, perm[ii + i1 + perm[jj + j1]]], [x2, y2, perm[ii + 1 + perm[jj + 1]]]]) {
      let tt = .5 - dx * dx - dy * dy; if (tt > 0) { tt *= tt; const g = G[gi & 7]; n += tt * tt * (g[0] * dx + g[1] * dy); }
    }
    return 70 * n;
  };
  n2.fbm = (x, y, oct = 4) => { let a = 1, f = 1, s = 0, m = 0; for (let o = 0; o < oct; o++) { s += a * n2(x * f, y * f); m += a; a *= .5; f *= 2.03; } return s / m; };
  return n2;
}

export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

// geometry with a flat vertex colour, non-indexed so faces stay faceted after merging
export function tint(geo, color, jitter = 0, rnd = Math.random) {
  const g = geo.index ? geo.toNonIndexed() : geo, n = g.attributes.position.count, c = new Float32Array(n * 3), col = new THREE.Color(color);
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (rnd() - .5) * jitter;
    for (let v = 0; v < 3; v++) { c[(i + v) * 3] = col.r * k; c[(i + v) * 3 + 1] = col.g * k; c[(i + v) * 3 + 2] = col.b * k; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

export function jitterVerts(geo, amt, rnd) {
  const p = geo.attributes.position, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
    if (!map.has(k)) map.set(k, [(rnd() - .5) * amt, (rnd() - .5) * amt, (rnd() - .5) * amt]);
    const d = map.get(k); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
  }
  return geo;
}

export function merge(list) {
  const g = mergeGeometries(list.map(x => { const y = x.index ? x.toNonIndexed() : x; if (y.attributes.uv) y.deleteAttribute('uv'); return y; }), false);
  g.computeVertexNormals();
  return g;
}

export function place(geo, x, y, z, ry = 0, sx = 1, sy = sx, sz = sx, rx = 0, rz = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return geo.applyMatrix4(m);
}

export const box = (w, h, d, c, x = 0, y = 0, z = 0, ry = 0) => place(tint(new THREE.BoxGeometry(w, h, d), c), x, y + h / 2, z, ry);

export const clock = { t: 0 };
const windUniform = { value: 0 };
export function setWindTime(t) { windUniform.value = t; }

// sway foliage/grass in the vertex shader: amount grows with local height
export function windMaterial(opts, amp = .1, freq = 1.6) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, flatShading: true, roughness: .95, metalness: 0 }, opts));
  m.onBeforeCompile = sh => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3]);
      #else
        vec3 ip = vec3(modelMatrix[3]);
      #endif
      float hh = max(0., transformed.y);
      transformed.x += sin(uWind*${freq.toFixed(2)} + ip.x*.13 + ip.z*.07) * ${amp.toFixed(3)} * hh;
      transformed.z += cos(uWind*${(freq * .8).toFixed(2)} + ip.x*.05 + ip.z*.11) * ${(amp * .6).toFixed(3)} * hh;`);
  };
  // double-sided blades keep their up-facing normal on both faces instead of going black on the back
  if (opts.side === THREE.DoubleSide) { const prev = m.onBeforeCompile; m.onBeforeCompile = sh => { prev(sh); sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n normal = normalize(vNormal);'); }; }
  m.customProgramCacheKey = () => 'wind' + amp + freq + (opts.side || 0);
  return m;
}

export const stdMat = (o = {}) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, flatShading: true, roughness: .92, metalness: 0 }, o));

export function polylineFromCurve(curve, step) {
  const L = curve.getLength(), n = Math.max(2, Math.ceil(L / step)), pts = curve.getSpacedPoints(n);
  return pts.map(p => [p.x, p.z]);
}

// fast nearest-distance to a polyline via a uniform grid of segment buckets
export function makeDistField(pts, cell = 16) {
  const segs = [], grid = new Map(), key = (i, j) => i * 100003 + j;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; segs.push([ax, az, bx, bz, i]);
    const i0 = Math.floor(Math.min(ax, bx) / cell), i1 = Math.floor(Math.max(ax, bx) / cell), j0 = Math.floor(Math.min(az, bz) / cell), j1 = Math.floor(Math.max(az, bz) / cell);
    for (let a = i0; a <= i1; a++) for (let b = j0; b <= j1; b++) { const k = key(a, b); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(segs.length - 1); }
  }
  // returns [distance, index along polyline (fractional)] ; maxR bounds the search
  return (x, z, maxR = 48) => {
    const ci = Math.floor(x / cell), cj = Math.floor(z / cell), r = Math.ceil(maxR / cell); let best = 1e9, bt = 0; const seen = new Set();
    for (let a = ci - r; a <= ci + r; a++) for (let b = cj - r; b <= cj + r; b++) {
      const l = grid.get(key(a, b)); if (!l) continue;
      for (const s of l) {
        if (seen.has(s)) continue; seen.add(s);
        const [ax, az, bx, bz, i] = segs[s], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
        let t = L2 ? ((x - ax) * dx + (z - az) * dz) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const ex = ax + dx * t - x, ez = az + dz * t - z, d = Math.hypot(ex, ez);
        if (d < best) { best = d; bt = i + t; }
      }
    }
    return [best, bt];
  };
}

export function disposeTree(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) for (const m of [].concat(o.material)) { for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose(); m.dispose(); }
  });
}
