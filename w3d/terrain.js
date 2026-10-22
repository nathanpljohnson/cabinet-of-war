import * as THREE from 'three';
import { rngFrom } from './lib.js';

// axis coordinates: fine spacing inside [lo,hi], coarse outside out to ±far
export function axis(lo, hi, fine, far, coarse) {
  const a = [];
  for (let x = -far; x < lo; x += coarse) a.push(x);
  for (let x = lo; x < hi; x += fine) a.push(x);
  for (let x = hi; x <= far; x += coarse) a.push(x);
  return a;
}

function find(a, x) { let lo = 0, hi = a.length - 2; if (x <= a[0]) return 0; if (x >= a[hi + 1]) return hi; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m] <= x) lo = m; else hi = m - 1; } return lo; }

/* Faceted terrain. height(x,z) → y ; color(x,z,y,out Color) sets a base colour per vertex;
   faces on steep slopes blend toward `steep`. Returns {mesh, heightAt}. */
export function buildTerrain({ xs, zs, height, color, steep = 0x8a7a64, seed = 3, jitter = .07 }) {
  const nx = xs.length, nz = zs.length, H = new Float32Array(nx * nz), C = new Float32Array(nx * nz * 3), col = new THREE.Color();
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, y = height(xs[i], zs[j]); H[k] = y; color(xs[i], zs[j], y, col); C[k * 3] = col.r; C[k * 3 + 1] = col.g; C[k * 3 + 2] = col.b;
  }
  const tris = (nx - 1) * (nz - 1) * 2, pos = new Float32Array(tris * 9), cols = new Float32Array(tris * 9), rnd = rngFrom(seed), st = new THREE.Color(steep);
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  let o = 0;
  const tri = (a, b, c) => {
    for (const [v, k] of [[va, a], [vb, b], [vc, c]]) v.set(xs[k % nx], H[k], zs[(k / nx) | 0]);
    e1.subVectors(vb, va); e2.subVectors(vc, va); e1.cross(e2).normalize(); const ny = Math.abs(e1.y), s = Math.min(1, Math.max(0, (.86 - ny) / .22)), f = 1 + (rnd() - .5) * jitter * 2;
    for (const [v, k] of [[va, a], [vb, b], [vc, c]]) {
      pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
      cols[o] = (C[k * 3] * (1 - s) + st.r * s) * f; cols[o + 1] = (C[k * 3 + 1] * (1 - s) + st.g * s) * f; cols[o + 2] = (C[k * 3 + 2] * (1 - s) + st.b * s) * f; o += 3;
    }
  };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if ((i + j) & 1) { tri(a, c, b); tri(b, c, d); } else { tri(a, c, d); tri(a, d, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals(); g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .97, metalness: 0 }));
  mesh.receiveShadow = true;
  const heightAt = (x, z) => {
    const i = find(xs, x), j = find(zs, z), u = Math.min(1, Math.max(0, (x - xs[i]) / (xs[i + 1] - xs[i]))), v = Math.min(1, Math.max(0, (z - zs[j]) / (zs[j + 1] - zs[j])));
    const a = H[j * nx + i], b = H[j * nx + i + 1], c = H[(j + 1) * nx + i], d = H[(j + 1) * nx + i + 1];
    if ((i + j) & 1) return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
    return u >= v ? a + (d - b) * v + (b - a) * u : a + (d - c) * u + (c - a) * v;
  };
  return { mesh, heightAt };
}
