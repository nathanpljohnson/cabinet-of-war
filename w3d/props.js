import * as THREE from 'three';
import { tint, merge, place, box, rngFrom, jitterVerts } from './lib.js';

const WALL = 0xdcb873, TRIM = 0xf1e9d8, PLINTH = 0xb7a17c, ROOF = 0x7a4434, GLASS = 0x34404c, WOOD = 0x6b4a2e, WOOD2 = 0x8a6440, CANVAS = 0xe8dfc8, IRON = 0x3a3836, BRONZE = 0x9a7a3e;

// hip roof over a w×d footprint, ridge along x
export function hipRoof(w, d, h, c, over = .5) {
  const W = w / 2 + over, D = d / 2 + over, r = Math.max(0, W - D);
  const v = [[-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D], [-r, h, 0], [r, h, 0]];
  const f = [[0, 4, 5], [0, 5, 1], [1, 5, 2], [2, 5, 4], [2, 4, 3], [3, 4, 0], [0, 1, 2], [0, 2, 3]];
  const pos = []; for (const t of f) for (const i of t) pos.push(...v[i]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return tint(g, c, .08);
}

function gable(w, d, h, c) { // triangular prism, ridge along x
  const W = w / 2, D = d / 2, v = [[-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D], [-W, h, 0], [W, h, 0]];
  const f = [[0, 4, 5], [0, 5, 1], [3, 2, 5], [3, 5, 4], [0, 3, 4], [1, 5, 2]];
  const pos = []; for (const t of f) for (const i of t) pos.push(...v[i]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return tint(g, c, .05);
}

/* a baroque wing: length L along local x, depth D, front faces +z */
export function wing(L, D, storeys, opts = {}) {
  const P = [], sh = 4.1, H = storeys * sh + 1.2;
  P.push(box(L, .9, D + .3, PLINTH, 0, 0, 0));
  P.push(box(L, H - .9, D, opts.wall || WALL, 0, .9, 0));
  P.push(box(L + .4, .35, D + .4, TRIM, 0, H - .1, 0));
  P.push(place(hipRoof(L, D, opts.roofH || 5, opts.roof || ROOF), 0, H + .25, 0));
  const bays = Math.floor(L / 3.6), step = L / bays;
  for (const side of [1, -1]) for (let b = 0; b < bays; b++) {
    const x = -L / 2 + step * (b + .5);
    if (opts.door != null && side === 1 && b === opts.door) {
      P.push(box(2.2, 3.4, .3, TRIM, x, .9, side * (D / 2 + .05)));
      P.push(box(1.6, 3, .32, 0x4a3422, x, .9, side * (D / 2 + .08)));
    }
    for (let s = 0; s < storeys; s++) {
      if (opts.door != null && side === 1 && b === opts.door && s === 0) continue;
      const y = 1.6 + s * sh;
      P.push(box(1.5, 2.5, .2, TRIM, x, y, side * (D / 2 + .02)));
      P.push(box(1.1, 1.05, .22, GLASS, x, y + .2, side * (D / 2 + .04)), box(1.1, 1.05, .22, 0x6a7f90, x, y + 1.25, side * (D / 2 + .04)));
      P.push(box(.07, 2.1, .26, TRIM, x, y + .2, side * (D / 2 + .05)), box(1.1, .07, .26, TRIM, x, y + 1.3, side * (D / 2 + .05)));
      P.push(box(1.8, .25, .35, TRIM, x, y + 2.6, side * (D / 2 + .06)));
    }
    if (b % 2 === 0) P.push(box(.5, H - 1.2, .2, TRIM, -L / 2 + step * b + .25, .9, side * (D / 2 + .03)));
  }
  for (const x of [-L / 3, L / 3]) P.push(box(.9, 2.4, .9, 0xa0806a, x, H + 2.2, D * .15));
  return merge(P);
}

export function manor(wall = WALL) {
  const P = [];
  // main corps: 52 m along z at x=-6 (local), facing +x; with a raised central risalit and pediment
  P.push(place(wing(52, 13, 2, { door: 7, wall }), 0, 0, 0, Math.PI / 2));
  const R = []; R.push(box(13, 10.4, 2, wall, 0, 0, 0)); R.push(box(13.4, .4, 2.4, TRIM, 0, 10.2, 0));
  R.push(place(gable(13.4, 2.6, 3.2, TRIM), 0, 10.5, 0));
  for (const x of [-6.2, -2, 2, 6.2]) R.push(box(.7, 10, .4, TRIM, x, 0, 1.05));
  R.push(box(3, 4.4, .5, TRIM, 0, .9, 1.05)); R.push(box(2.2, 4, .6, 0x4a3422, 0, .9, 1.1));
  for (const x of [-4, 4]) { R.push(box(1.5, 2.6, .5, TRIM, x, 5.7, 1.05)); R.push(box(1.1, 2.2, .55, GLASS, x, 5.9, 1.08)); }
  R.push(box(1.6, 2.4, .5, TRIM, 0, 5.8, 1.05)); R.push(box(1.2, 2, .55, GLASS, 0, 6, 1.08));
  R.push(place(tint(new THREE.CylinderGeometry(.9, .9, .3, 16), 0xb08a40), 0, 11.6, 1.15, 0, 1, 1, 1, Math.PI / 2)); // cartouche
  R.push(box(5, .25, 2.5, PLINTH, 0, 0, 2.2)); R.push(box(4, .25, 1.5, PLINTH, 0, .25, 1.8)); // steps
  P.push(place(merge(R), 7.5, 0, 0, Math.PI / 2));
  // side wings run east (+x) from each end
  P.push(place(wing(34, 10, 2, { roofH: 4, wall }), 6.5 + 17, 0, -21.5, 0));
  P.push(place(wing(34, 10, 2, { roofH: 4, wall }), 6.5 + 17, 0, 21.5, Math.PI));
  return merge(P);
}

export function gateWall(len, gap) { // wall along z at local x=0, centred gate of width gap
  const P = [], half = len / 2, g = gap / 2;
  for (const [z0, z1] of [[-half, -g - .6], [g + .6, half]]) {
    const L = z1 - z0, zc = (z0 + z1) / 2;
    P.push(box(.7, 2.4, L, WALL, 0, 0, zc)); P.push(box(.9, .25, L, TRIM, 0, 2.4, zc));
    for (let z = z0 + 3; z < z1 - 1; z += 4) P.push(box(1, 2.8, .7, TRIM, 0, 0, z));
  }
  for (const s of [-1, 1]) {
    P.push(box(1.3, 3.8, 1.3, TRIM, 0, 0, s * (g + .65))); P.push(box(1.6, .3, 1.6, PLINTH, 0, 3.8, s * (g + .65)));
    P.push(place(tint(new THREE.IcosahedronGeometry(.55, 1), TRIM), 0, 4.65, s * (g + .65)));
  }
  return merge(P);
}

export function fountain() {
  const P = [];
  const basin = [[0, 0], [3.75, 0], [3.75, .14], [3.45, .14], [3.42, .72], [3.04, .72], [3.04, .4], [0, .4]].map(([x, y]) => new THREE.Vector2(x, y));
  P.push(tint(new THREE.LatheGeometry(basin, 20), 0xe6dcc4, .05));
  P.push(place(tint(new THREE.CircleGeometry(3.05, 20).rotateX(-Math.PI / 2), 0x6f9aa0), 0, .56, 0));
  P.push(place(tint(new THREE.CircleGeometry(1.0, 12).rotateX(-Math.PI / 2), 0x7aa4aa), 0, 2.51, 0));
  P.push(place(tint(new THREE.CylinderGeometry(.35, .5, 2.2, 8), TRIM), 0, 1.1, 0));
  P.push(place(tint(new THREE.CylinderGeometry(1.1, .5, .4, 12), TRIM), 0, 2.3, 0));
  P.push(place(tint(new THREE.IcosahedronGeometry(.35, 1), TRIM), 0, 2.8, 0));
  return merge(P);
}

export function awning(w, d) {
  const P = [];
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) P.push(box(.15, 3, .15, WOOD, x, 0, z));
  P.push(place(gable(w + .6, d + .8, 1.1, 0xe9dcc0), 0, 3, 0));
  for (let x = -w / 2; x < w / 2; x += .9) P.push(place(tint(new THREE.ConeGeometry(.42, .35, 3), 0xb84a32), x + .45, 2.85, d / 2 + .4, 0, 1, 1, 1, Math.PI, 0));
  return merge(P);
}

export function mapTable() {
  const P = [];
  P.push(box(3.2, .12, 2.1, WOOD2, 0, .86, 0));
  for (const [x, z] of [[-1.45, -.9], [1.45, -.9], [-1.45, .9], [1.45, .9]]) P.push(box(.14, .86, .14, WOOD, x, 0, z));
  P.push(box(3, .06, .1, WOOD, 0, .4, 0));
  // dividers, inkpot, a few weights holding the corners
  for (const [x, z] of [[-1.4, -.85], [1.4, -.85], [-1.4, .85], [1.4, .85]]) P.push(box(.12, .1, .12, IRON, x, .99, z));
  return merge(P);
}

export function writingDesk() {
  const P = [];
  P.push(box(1.7, .08, .85, WOOD2, 0, .76, 0));
  for (const [x, z] of [[-.75, -.35], [.75, -.35], [-.75, .35], [.75, .35]]) P.push(box(.08, .76, .08, WOOD, x, 0, z));
  P.push(box(1.7, .5, .22, WOOD, 0, .84, -.32)); // pigeonholes
  for (let i = 0; i < 5; i++) P.push(box(.24, .04, .18, 0xf3ecd8, -.6 + i * .3, 1.0 + (i % 2) * .2, -.3));
  for (let i = 0; i < 6; i++) P.push(box(.32, .015, .22, 0xf3ecd8, -.4 + (i % 3) * .05, .85 + i * .015, .1 + (i % 2) * .03, i * .2));
  P.push(box(.08, .09, .08, 0x1c1c22, .5, .84, .15)); P.push(box(.02, .26, .02, 0xf6f2e8, .52, .9, .14));
  P.push(box(.6, .45, .4, WOOD, 1.25, 0, .1)); // chest of letters
  P.push(box(.5, .5, .5, WOOD, -1.2, 0, .55)); // stool
  return merge(P);
}

export function chest() { return merge([box(1.1, .55, .62, 0x5c3b22, 0, 0, 0), box(1.14, .12, .66, IRON, 0, .55, 0), box(.2, .2, .05, BRONZE, 0, .35, .33)]); }

export function tent(rnd) {
  const P = [], c = rnd ? 0xf0e6cc - Math.floor(rnd() * 3) * 0x050505 : CANVAS;
  P.push(place(gable(2.6, 2.3, 1.75, c), 0, 0, 0));
  P.push(box(.06, 2, .06, WOOD, -1.32, 0, 0)); P.push(box(.06, 2, .06, WOOD, 1.32, 0, 0));
  P.push(place(tint(new THREE.PlaneGeometry(.8, 1.4), 0x5a4a38), 1.31, .7, 0, Math.PI / 2)); // dark doorway
  P.push(box(.06, .35, .06, WOOD, -1.32, 2, 0), box(.06, .35, .06, WOOD, 1.32, 2, 0)); // pole tops above the ridge
  for (const s of [-1, 1]) { // guy ropes from the pole tops to pegs, and pegs along the skirts
    P.push(place(tint(new THREE.BoxGeometry(.02, 1.5, .02), 0xb8a882), s * 1.85, 1.3, 0, 0, 1, 1, 1, 0, s * -.62), box(.05, .18, .05, WOOD, s * 2.3, 0, 0));
    for (const x of [-.9, 0, .9]) P.push(box(.04, .14, .04, WOOD, x, 0, s * 1.3));
  }
  if (rnd && rnd() < .5) P.push(place(tint(new THREE.PlaneGeometry(.5, .4), 0xd6c9a4), -.4, 1, .96, 0, 1, 1, 1, -.72)); // a patched panel
  return merge(P);
}

export function marquee() {
  const P = [];
  P.push(box(6, 2.2, 4.6, 0xf2ead5, 0, 0, 0));
  P.push(place(hipRoof(6, 4.6, 1.6, 0xeee2c4, .35), 0, 2.2, 0));
  for (let x = -3; x < 3; x += .75) for (const s of [1, -1]) P.push(place(tint(new THREE.ConeGeometry(.38, .3, 3), 0x3a3a3a), x + .37, 2.08, s * 2.65, 0, 1, 1, 1, Math.PI, 0));
  P.push(box(1.8, 2, .06, 0x7a6a50, 0, 0, 2.33));
  P.push(box(.1, 4.6, .1, WOOD, 0, 0, 0));
  return merge(P);
}

export function wheel(r = .6) {
  const P = [place(tint(new THREE.TorusGeometry(r, .07, 5, 12), WOOD), 0, 0, 0)];
  for (let i = 0; i < 6; i++) P.push(place(tint(new THREE.BoxGeometry(.05, r * 2, .05), WOOD), 0, 0, 0, 0, 1, 1, 1, 0, i * Math.PI / 6));
  P.push(place(tint(new THREE.CylinderGeometry(.12, .12, .18, 8), IRON), 0, 0, 0, 0, 1, 1, 1, Math.PI / 2));
  return merge(P);
}

export function cannon() {
  const P = [];
  P.push(place(tint(new THREE.CylinderGeometry(.13, .2, 2.3, 10), BRONZE), 0, 1.05, .2, 0, 1, 1, 1, Math.PI / 2 - .06));
  P.push(place(tint(new THREE.IcosahedronGeometry(.2, 1), BRONZE), 0, 1.0, -.95));
  for (const s of [-1, 1]) {
    P.push(place(tint(new THREE.BoxGeometry(.12, .4, 2.6), WOOD2), s * .26, .7, -.75, 0, 1, 1, 1, .32));
    P.push(place(wheel(.62), s * .55, .62, .1, Math.PI / 2));
  }
  P.push(box(.7, .12, .2, IRON, 0, .58, .1));
  return merge(P);
}

export function limber() {
  const P = [box(1, .5, .7, WOOD, 0, .62, 0), box(1.05, .08, .75, IRON, 0, 1.1, 0), place(tint(new THREE.BoxGeometry(.1, .1, 2.2), WOOD2), 0, .5, 1.3, 0, 1, 1, 1, -.15)];
  for (const s of [-1, 1]) P.push(place(wheel(.55), s * .62, .55, 0, Math.PI / 2));
  return merge(P);
}

export function wagon() {
  const P = [box(1.5, .5, 3.4, WOOD2, 0, .75, 0)];
  for (const s of [-1, 1]) for (const z of [-1.1, 1.1]) P.push(place(wheel(z > 0 ? .55 : .7), s * .82, z > 0 ? .55 : .7, z, Math.PI / 2));
  // canvas cover on hoops
  const cov = new THREE.CylinderGeometry(.95, .95, 3.2, 10, 1, true, -Math.PI / 2, Math.PI);
  P.push(place(tint(cov, CANVAS, .05), 0, 1.25, 0, 0, 1, 1.15, 1, Math.PI / 2));
  P.push(place(tint(new THREE.BoxGeometry(.08, .08, 2.4), WOOD), 0, .6, 2.6));
  return merge(P);
}

export function barrel() { return merge([place(tint(new THREE.CylinderGeometry(.32, .32, .85, 9), 0x7a5532, .05), 0, .43, 0, 0, 1, 1, 1), place(tint(new THREE.CylinderGeometry(.34, .34, .06, 9), IRON), 0, .2, 0), place(tint(new THREE.CylinderGeometry(.34, .34, .06, 9), IRON), 0, .68, 0)]); }
export function crate() { return merge([box(.8, .7, .8, 0x9a7448, 0, 0, 0), box(.84, .06, .84, WOOD, 0, .35, 0)]); }

export function muskets() { // stack of arms: a cone of 6 muskets leaning together
  const P = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P.push(place(tint(new THREE.BoxGeometry(.05, 1.6, .05), i % 2 ? WOOD2 : 0x5a3c22), Math.sin(a) * .3, .76, Math.cos(a) * .3, 0, 1, 1, 1, -Math.cos(a) * .2, Math.sin(a) * .2)); }
  return merge(P);
}

export function campfire() {
  const P = [], rnd = rngFrom(4);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; P.push(place(tint(jitterVerts(new THREE.DodecahedronGeometry(.22, 0), .1, rnd), 0x77736c), Math.sin(a) * .85, .1, Math.cos(a) * .85)); }
  for (let i = 0; i < 4; i++) P.push(place(tint(new THREE.CylinderGeometry(.08, .1, 1.2, 5), 0x4a3424), 0, .25, 0, i * .8, 1, 1, 1, Math.PI / 2 - .35));
  P.push(box(.08, 1.4, .08, WOOD, -.9, 0, 0)); P.push(box(.08, 1.4, .08, WOOD, .9, 0, 0)); P.push(place(tint(new THREE.BoxGeometry(1.9, .06, .06), WOOD), 0, 1.35, 0));
  P.push(place(tint(new THREE.CylinderGeometry(.3, .22, .35, 8), IRON), 0, .95, 0));
  return merge(P);
}

export function bridge(len, w) { // along local x
  const P = [], rnd = rngFrom(9);
  for (let x = -len / 2; x < len / 2; x += .45) P.push(place(tint(new THREE.BoxGeometry(.42, .12, w), rnd() > .5 ? WOOD2 : 0x7a5a3a), x + .22, 0, 0, 0, 1, 1, 1, 0, (rnd() - .5) * .03));
  for (const s of [-1, 1]) {
    P.push(place(tint(new THREE.BoxGeometry(len, .1, .12), WOOD), 0, .95, s * (w / 2 - .05)));
    P.push(place(tint(new THREE.BoxGeometry(len, .22, .25), WOOD), 0, -.15, s * (w / 2 - .3)));
    for (let x = -len / 2; x <= len / 2 + .01; x += len / 6) {
      P.push(place(tint(new THREE.BoxGeometry(.16, 1.05, .16), WOOD), x, .45, s * (w / 2 - .05)));
      P.push(place(tint(new THREE.CylinderGeometry(.16, .18, 3.4, 6), 0x4e3a28), x, -1.8, s * (w / 2 - .3)));
    }
  }
  return merge(P);
}

export function fenceSeg(len) { // split-rail along local x
  const P = [];
  for (let x = 0; x <= len + .01; x += 2.4) P.push(box(.12, 1.1, .12, WOOD, x - len / 2, 0, 0));
  for (const y of [.45, .85]) P.push(place(tint(new THREE.BoxGeometry(len, .08, .08), WOOD2), 0, y, 0));
  return merge(P);
}

export function shrine() { // Bildstock: wayside shrine typical of the Austrian countryside
  const P = [box(.5, 2, .5, TRIM, 0, 0, 0), box(.75, .9, .75, TRIM, 0, 2, 0), box(.5, .55, .1, 0x4a5a8a, 0, 2.15, .36), place(hipRoof(.8, .8, .55, ROOF, .15), 0, 2.9, 0), place(tint(new THREE.BoxGeometry(.05, .4, .05), IRON), 0, 3.6, 0), place(tint(new THREE.BoxGeometry(.25, .05, .05), IRON), 0, 3.68, 0)];
  return merge(P);
}

export function signpost(n = 2) {
  const P = [box(.14, 2.6, .14, WOOD, 0, 0, 0)];
  for (let i = 0; i < n; i++) P.push(place(tint(new THREE.BoxGeometry(1.1, .22, .05), 0xd8cdb4), .45 * (i % 2 ? -1 : 1), 2.2 - i * .35, 0, i * .7));
  return merge(P);
}

export function hitchPost() { return merge([box(.14, 1.2, .14, WOOD, -1.2, 0, 0), box(.14, 1.2, .14, WOOD, 1.2, 0, 0), place(tint(new THREE.BoxGeometry(2.6, .1, .1), WOOD2), 0, 1.05, 0)]); }

export function pole(h) { return merge([place(tint(new THREE.CylinderGeometry(.06, .09, h, 6), WOOD), 0, h / 2, 0), place(tint(new THREE.IcosahedronGeometry(.12, 0), BRONZE), 0, h + .05, 0)]); }

export function vineRows(len, rows, gap) { // vineyard stakes with low foliage, along local x
  const P = [], rnd = rngFrom(21);
  for (let r = 0; r < rows; r++) for (let x = -len / 2; x < len / 2; x += 1.3) {
    P.push(box(.05, 1.3, .05, WOOD, x, 0, r * gap));
    P.push(place(tint(jitterVerts(new THREE.IcosahedronGeometry(.45, 0), .2, rnd), rnd() > .4 ? 0xc79a3c : 0x9a8a3a, .2, rnd), x + .6, .8, r * gap, 0, 1.4, .7, .7));
  }
  return merge(P);
}

// period flag: Austrian infantry ordinary colour (yellow field, black double eagle) — simplified, illustrative
export function flagTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const x = c.getContext('2d');
  x.fillStyle = '#e9c53a'; x.fillRect(0, 0, 256, 192);
  x.strokeStyle = '#b8862a'; x.lineWidth = 10; x.strokeRect(5, 5, 246, 182);
  x.fillStyle = '#16120e'; x.save(); x.translate(128, 100);
  x.beginPath(); x.ellipse(0, 6, 18, 34, 0, 0, Math.PI * 2); x.fill();
  for (const s of [-1, 1]) {
    x.beginPath(); x.moveTo(0, -10); x.quadraticCurveTo(s * 40, -50, s * 78, -30); x.lineTo(s * 70, -18); x.lineTo(s * 76, -8); x.lineTo(s * 62, 0); x.lineTo(s * 68, 12); x.lineTo(s * 50, 14); x.quadraticCurveTo(s * 26, 16, 0, 20); x.fill();
    x.beginPath(); x.arc(s * 14, -40, 9, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.moveTo(s * 20, -42); x.lineTo(s * 32, -38); x.lineTo(s * 20, -36); x.fill();
  }
  x.beginPath(); x.moveTo(-12, 36); x.lineTo(0, 62); x.lineTo(12, 36); x.fill();
  x.fillStyle = '#c0282a'; x.fillRect(-10, -8, 20, 24); x.fillStyle = '#f4efe6'; x.fillRect(-10, 0, 20, 8);
  x.fillStyle = '#e9c53a'; x.beginPath(); x.moveTo(-14, -62); x.lineTo(-8, -52); x.lineTo(0, -64); x.lineTo(8, -52); x.lineTo(14, -62); x.lineTo(12, -48); x.lineTo(-12, -48); x.fill();
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// a cloth that waves in the vertex shader (pinned at x=0)
export function flagMesh(w, h, tex, uTime) {
  const g = new THREE.PlaneGeometry(w, h, 12, 6); g.translate(w / 2, 0, 0);
  const m = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: .9, flatShading: true });
  m.onBeforeCompile = sh => { sh.uniforms.uT = uTime; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float k = transformed.x/' + w.toFixed(2) + '; transformed.z += sin(uT*3.2 - transformed.x*2.2)*.22*k; transformed.y -= k*k*.25;'); };
  const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; return mesh;
}

// courtyard, road and camp clutter
export function orangeTub(rnd) {
  const T = [box(.72, .6, .72, 0x3e5e4a), box(.8, .08, .8, 0xd8cdb4, 0, .6, 0), box(.12, .9, .12, 0x6a4a30, 0, .6, 0), place(tint(jitterVerts(new THREE.IcosahedronGeometry(.62, 1), .12, rnd), 0x4f7a36, .12, rnd), 0, 1.75, 0, 0, 1, .9)];
  for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, e = rnd() * 1.2 - .3; T.push(place(tint(new THREE.IcosahedronGeometry(.07, 0), 0xe88a26), Math.cos(a) * Math.cos(e) * .6, 1.75 + Math.sin(e) * .52, Math.sin(a) * Math.cos(e) * .6)); }
  return merge(T);
}
export function hayBale() { return merge([box(1.1, .5, .62, 0xd6b45c), box(1.12, .04, .64, 0x9a7a3a, 0, .2, 0), box(.04, .51, .64, 0x9a7a3a, -.3, 0, 0), box(.04, .51, .64, 0x9a7a3a, .3, 0, 0)]); }
export function sack(rnd) { return place(tint(jitterVerts(new THREE.IcosahedronGeometry(.32, 1), .06, rnd), 0xcbb88e, .08, rnd), 0, .26, 0, 0, 1, .8, .75); }
export function logPile(n, L, rnd) { const G = []; for (let r = 0, k = 0; r < 3; r++) for (let i = 0; i < n - r; i++, k++) G.push(place(tint(new THREE.CylinderGeometry(.13, .13, L, 6), k % 3 ? 0x8a6440 : 0x76563a, .1, rnd), (i - (n - r - 1) / 2) * .27, .13 + r * .23, 0, 0, 1, 1, 1, Math.PI / 2)); return merge(G); }
export function milestone() { return merge([box(.42, .7, .3, 0xd8cdb4), place(tint(new THREE.CylinderGeometry(.21, .21, .3, 8, 1, false, 0, Math.PI), 0xd8cdb4), 0, .7, 0, Math.PI / 2, 1, 1, 1, 0, Math.PI / 2), box(.3, .12, .02, 0x8a3a2a, 0, .42, .16)]); }
