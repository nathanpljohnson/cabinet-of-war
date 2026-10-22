import * as THREE from 'three';
import { tint, jitterVerts, merge, place, rngFrom, windMaterial, stdMat } from './lib.js';

const BARK = 0x5a4330, BARK2 = 0x6e5a48;

// crowns are near-white so the instance colour carries the hue (autumn variety without extra geometry)
function blob(r, rnd, detail = 1) { return jitterVerts(new THREE.IcosahedronGeometry(r, detail), r * .32, rnd); }

function broadleaf(seed, lod) {
  const rnd = rngFrom(seed), H = 3.2 + rnd() * 1.6, trunk = [], crown = [];
  trunk.push(place(tint(new THREE.CylinderGeometry(.22, .38, H + 1.2, 6), BARK, .2, rnd), 0, (H + 1.2) / 2, 0));
  for (let b = 0; b < 3; b++) {
    const a = b * 2.1 + rnd(), L = 1.6 + rnd();
    trunk.push(place(tint(new THREE.CylinderGeometry(.08, .16, L, 5), BARK, .2, rnd), Math.sin(a) * L * .35, H + .2 + L * .35, Math.cos(a) * L * .35, 0, 1, 1, 1, Math.cos(a) * .7, -Math.sin(a) * .7));
  }
  const n = 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, rr = i === 0 ? 0 : 1.1 + rnd() * .9, r = i === 0 ? 2.3 : 1.3 + rnd() * .9;
    crown.push(place(tint(blob(r, rnd, i === 0 && !lod ? 1 : 0), 0xffffff, .22, rnd), Math.sin(a) * rr, H + 1.6 + (rnd() - .3) * 1.4 + (i === 0 ? .6 : 0), Math.cos(a) * rr, rnd() * 6, 1, .85 + rnd() * .2));
  }
  return { trunk: merge(trunk), crown: merge(crown), h: H + 4 };
}

function fir(seed, lod) {
  const rnd = rngFrom(seed), crown = [], tiers = 4 + Math.floor(rnd() * 2), H = 7 + rnd() * 3;
  const trunk = [place(tint(new THREE.CylinderGeometry(.16, .3, 2.2, 5), BARK2, .2, rnd), 0, 1.1, 0)];
  for (let i = 0; i < tiers; i++) {
    const f = i / tiers, r = 2.4 * (1 - f * .78) + rnd() * .3, h = H / tiers * 1.75;
    crown.push(place(tint(jitterVerts(new THREE.ConeGeometry(r, h, lod ? 5 : 7, 1), .35, rnd), 0xffffff, .18, rnd), 0, 1.6 + f * H * .92 + h / 2, 0, rnd() * 3));
  }
  return { trunk: merge(trunk), crown: merge(crown), h: H + 2 };
}

function poplar(seed, lod) {
  const rnd = rngFrom(seed), H = 10 + rnd() * 4;
  const trunk = [place(tint(new THREE.CylinderGeometry(.14, .3, H * .5, 5), BARK, .2, rnd), 0, H * .25, 0)];
  const crown = [];
  for (let i = 0; i < 3; i++) crown.push(place(tint(blob(1.25 - i * .2, rnd, 0), 0xffffff, .2, rnd), (rnd() - .5) * .5, H * .38 + i * H * .2, (rnd() - .5) * .5, 0, 1, 2.6 - i * .4, 1));
  return { trunk: merge(trunk), crown: merge(crown), h: H };
}

function bush(seed) {
  const rnd = rngFrom(seed), crown = [];
  for (let i = 0; i < 3; i++) crown.push(place(tint(blob(.6 + rnd() * .4, rnd, 0), 0xffffff, .25, rnd), (rnd() - .5) * 1.2, .45 + rnd() * .3, (rnd() - .5) * 1.2, 0, 1, .75));
  return { crown: merge(crown) };
}

export function rockGeo(seed, detail = 0) {
  const rnd = rngFrom(seed), g = jitterVerts(new THREE.DodecahedronGeometry(1, detail), .42, rnd);
  return merge([tint(g, 0xffffff, .16, rnd)]);
}

function grassTuft(seed, tipCol, baseCol, blades = 5, flower = null) {
  const rnd = rngFrom(seed), pos = [], col = [], cb = new THREE.Color(baseCol), ct = new THREE.Color(tipCol);
  for (let i = 0; i < blades; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * .18, x = Math.sin(a) * r, z = Math.cos(a) * r, h = .35 + rnd() * .45, w = .06 + rnd() * .05, lean = (rnd() - .5) * .35, la = rnd() * 6.28;
    const px = Math.cos(a), pz = -Math.sin(a);
    pos.push(x - px * w, 0, z - pz * w, x + px * w, 0, z + pz * w, x + Math.sin(la) * lean, h, z + Math.cos(la) * lean);
    col.push(cb.r, cb.g, cb.b, cb.r, cb.g, cb.b, ct.r, ct.g, ct.b);
  }
  if (flower) {
    const fc = new THREE.Color(flower);
    for (let i = 0; i < 3; i++) {
      const x = (rnd() - .5) * .3, z = (rnd() - .5) * .3, h = .45 + rnd() * .2, s = .07;
      pos.push(x, h, z - s, x - s, h + s * .5, z, x + s, h + s * .5, z, x, h, z + s, x + s, h + s * .5, z, x - s, h + s * .5, z);
      for (let k = 0; k < 6; k++) col.push(fc.r, fc.g, fc.b);
      pos.push(x, 0, z, x + .02, h, z, x - .02, h, z); col.push(cb.r, cb.g, cb.b, cb.r, cb.g, cb.b, cb.r, cb.g, cb.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // blades point their normals up so they take sky light like the ground rather than going black
  const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, nr.getX(i) * .3, .95, nr.getZ(i) * .3);
  return g;
}

// palettes for October in lower Austria: some still green, many gold, some rust
export const AUTUMN = [0x6f8f3a, 0x8a9a3c, 0xc9a23a, 0xd98a2b, 0xb8562a, 0x9fae4a, 0xe0b54a];
export const FIRS = [0x2f5a3a, 0x355f37, 0x2a4f39, 0x3b6640];

const mats = {};
function getMats() {
  if (mats.trunk) return mats;
  mats.trunk = stdMat();
  mats.crown = windMaterial({}, .045, 1.1);
  mats.grass = windMaterial({ side: THREE.DoubleSide, flatShading: false }, .22, 2.1);
  mats.rock = stdMat({ roughness: 1 });
  return mats;
}

const SPECIES = { broadleaf, fir, poplar, bush };

/* A forest: species → list of {x,y,z,ry,s,col} placements. Builds 2 instanced meshes per variant.
   Returns a Group; caller adds it to the scene. */
export function buildForest(placements, opts = {}) {
  const M = getMats(), group = new THREE.Group(), dummy = new THREE.Object3D(), c = new THREE.Color();
  const variants = opts.variants || 3;
  for (const sp in placements) {
    const list = placements[sp]; if (!list.length) continue;
    for (let v = 0; v < variants; v++) {
      const sub = list.filter((_, i) => i % variants === v); if (!sub.length) continue;
      const geo = SPECIES[sp](1000 * (Object.keys(SPECIES).indexOf(sp) + 1) + v * 17 + (opts.seed || 0), opts.lod);
      for (const part of ['trunk', 'crown']) {
        if (!geo[part]) continue;
        const im = new THREE.InstancedMesh(geo[part], part === 'trunk' ? M.trunk : M.crown, sub.length);
        sub.forEach((p, i) => {
          dummy.position.set(p.x, p.y - .15, p.z); dummy.rotation.set(0, p.ry, 0); dummy.scale.set(p.s, p.s * (p.sy || 1), p.s); dummy.updateMatrix();
          im.setMatrixAt(i, dummy.matrix);
          if (part === 'crown') im.setColorAt(i, c.set(p.col));
        });
        im.castShadow = opts.shadows !== false; im.receiveShadow = part === 'crown'; im.computeBoundingSphere();
        group.add(im);
      }
    }
  }
  return group;
}

export function buildRocks(list, seed = 5) {
  const M = getMats(), group = new THREE.Group(), dummy = new THREE.Object3D(), c = new THREE.Color();
  for (let v = 0; v < 4; v++) {
    const sub = list.filter((_, i) => i % 4 === v); if (!sub.length) continue;
    const im = new THREE.InstancedMesh(rockGeo(seed + v * 7, v === 3 ? 1 : 0), M.rock, sub.length);
    sub.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.rx || 0, p.ry, p.rz || 0); dummy.scale.set(p.sx, p.sy, p.sz); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, c.set(p.col || 0x8f8a82)); });
    im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); group.add(im);
  }
  return group;
}

export function buildGrass(list, seed = 9) {
  const M = getMats(), group = new THREE.Group(), dummy = new THREE.Object3D();
  const kinds = [
    grassTuft(seed, 0xd2cc78, 0x6b8a3a), grassTuft(seed + 1, 0xb8c46a, 0x5f7f34, 6),
    grassTuft(seed + 2, 0xe0c878, 0x7f7a3a, 4), grassTuft(seed + 3, 0xc0c86a, 0x5f7f34, 5, 0xb48ae0),
    grassTuft(seed + 4, 0xc8c870, 0x5f7f34, 5, 0xf6d84a), grassTuft(seed + 5, 0xc0c070, 0x5f7f34, 5, 0xf8f4ec)];
  for (let k = 0; k < kinds.length; k++) {
    const sub = list.filter(p => p.k === k); if (!sub.length) continue;
    const im = new THREE.InstancedMesh(kinds[k], M.grass, sub.length);
    sub.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(0, p.ry, 0); dummy.scale.setScalar(p.s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.receiveShadow = true; im.computeBoundingSphere(); group.add(im);
  }
  return group;
}
