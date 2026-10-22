import * as THREE from 'three';
import { tint, merge, place } from './lib.js';
import { makeAnimal } from './actors.js';

/* Low-poly figures for formations, baked into pose frames and drawn with instancing.
   They illustrate the sim's state (march, stand, fire, rout); counts on labels stay authoritative. */
export const UNIFORM = {
  A: { coat: 0xe7e2d6, facing: 0xa3302a, breeches: 0xe7e2d6, legs: 0x2a2622, hat: 0x1a1612, trim: 0xf2eee4, horseCoat: 0xe7e2d6 },
  B: { coat: 0x2b3d6e, facing: 0xa3302a, breeches: 0xe2d9b8, legs: 0xe8e4da, hat: 0x1a1612, trim: 0xf2eee4, horseCoat: 0xf0ece0 },
};
const SKIN = 0xd8a684, WOOD = 0x5a3a20, IRON = 0x3a3a3c;

function limb(len, r0, r1, c) { return tint(new THREE.CylinderGeometry(r1, r0, len, 5), c).translate(0, -len / 2, 0); }
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => place(g, x, y, z, ry, 1, 1, 1, rx, rz);

/* pose: {lt, rt (leg swing rad), la, ra (arm pitch), musket:'shoulder'|'present'|'trail', lean} */
function soldierFull(u, pose) {
  const P = [], hipY = .93;
  for (const [s, a] of [[-1, pose.lt], [1, pose.rt]]) {
    P.push(at(limb(.5, .075, .065, u.breeches), s * .09, hipY, 0, a));
    const kz = -Math.sin(a) * .5, ky = hipY - Math.cos(a) * .5, ka = a + Math.max(0, a) * .9;
    P.push(at(limb(.45, .062, .05, u.legs), s * .09, ky, kz, ka));
    P.push(at(tint(new THREE.BoxGeometry(.1, .07, .22), 0x15110d), s * .09, ky - Math.cos(ka) * .45 + .03, kz - Math.sin(ka) * .45 + .05));
  }
  const lean = pose.lean || 0, T = [];
  T.push(at(tint(new THREE.CylinderGeometry(.17, .19, .58, 6), u.coat), 0, hipY + .3, 0));
  T.push(at(tint(new THREE.CylinderGeometry(.19, .31, .42, 7, 1, true, .6, Math.PI * 2 - 1.2), u.coat), 0, hipY - .1, 0));
  T.push(at(tint(new THREE.BoxGeometry(.2, .32, .05), u.facing), 0, hipY + .34, .16));
  T.push(at(tint(new THREE.BoxGeometry(.06, .5, .03), 0xf2eee4), .05, hipY + .3, .175, 0, 0, .55)); // cross-belt
  T.push(at(tint(new THREE.DodecahedronGeometry(.11, 0), SKIN), 0, hipY + .74, .01));
  T.push(at(tint(new THREE.CylinderGeometry(.24, .2, .07, 3), u.hat), 0, hipY + .84, 0, 0, Math.PI));
  T.push(at(tint(new THREE.CylinderGeometry(.11, .12, .08, 6), u.hat), 0, hipY + .88, 0));
  T.push(at(tint(new THREE.CylinderGeometry(.25, .21, .02, 3), u.trim), 0, hipY + .81, 0, 0, Math.PI));
  const sh = hipY + .52;
  // arms: left swings, right holds the musket
  T.push(at(limb(.52, .06, .05, u.coat), -.22, sh, 0, pose.la)); T.push(at(tint(new THREE.BoxGeometry(.11, .1, .11), u.facing), -.22 + 0, sh - Math.cos(pose.la) * .48, -Math.sin(pose.la) * .48));
  if (pose.musket === 'present') {
    T.push(at(limb(.5, .06, .05, u.coat), .2, sh, 0, -1.45)); T.push(at(limb(.45, .06, .05, u.coat), -.2, sh, 0, -1.5, 0, -.35));
    T.push(at(tint(new THREE.BoxGeometry(.05, .06, 1.5), WOOD), .1, sh + .06, .55)); T.push(at(tint(new THREE.BoxGeometry(.025, .025, .5), 0xc8c8cc), .1, sh + .08, 1.5));
  } else {
    T.push(at(limb(.52, .06, .05, u.coat), .22, sh, 0, pose.ra));
    const mx = .26, my = sh + .25, mz = -.04, tilt = pose.musket === 'trail' ? .55 : .12;
    T.push(at(tint(new THREE.BoxGeometry(.05, 1.5, .06), WOOD), mx, my, mz, tilt)); T.push(at(tint(new THREE.BoxGeometry(.025, .45, .025), 0xc8c8cc), mx, my + Math.cos(tilt) * .95, mz + Math.sin(tilt) * .95, tilt));
  }
  const torso = merge(T); torso.translate(0, -hipY, 0); torso.rotateX(lean); torso.translate(0, hipY, 0);
  return merge([...P, torso]);
}

export function rider(u, sword) {
  const P = [], hipY = 0;
  for (const s of [-1, 1]) { P.push(at(limb(.48, .08, .07, u.breeches), s * .15, hipY, .05, -1.25, 0, s * .25)); P.push(at(tint(new THREE.CylinderGeometry(.07, .065, .5, 5), 0x15110d), s * .28, hipY - .32, .3)); }
  P.push(at(tint(new THREE.CylinderGeometry(.17, .2, .6, 6), u.coat), 0, hipY + .32, 0));
  P.push(at(tint(new THREE.BoxGeometry(.2, .3, .05), u.facing), 0, hipY + .36, .17));
  P.push(at(tint(new THREE.DodecahedronGeometry(.11, 0), SKIN), 0, hipY + .76, .01));
  P.push(at(tint(new THREE.CylinderGeometry(.24, .2, .07, 3), u.hat), 0, hipY + .86, 0, 0, Math.PI)); P.push(at(tint(new THREE.CylinderGeometry(.11, .12, .08, 6), u.hat), 0, hipY + .9, 0));
  P.push(at(limb(.5, .06, .05, u.coat), -.22, hipY + .55, 0, -.6)); P.push(at(limb(.5, .06, .05, u.coat), .22, hipY + .55, 0, sword ? -2.2 : -.6));
  if (sword) P.push(at(tint(new THREE.BoxGeometry(.03, .85, .02), 0xd0d0d4), .22, hipY + 1.15, -.2, -.4));
  return merge(P);
}

// far figure (~70 triangles): same silhouette and colours, no small details
function soldierLow(u, pose) {
  const P = [], hipY = .93;
  for (const [s, a] of [[-1, pose.lt], [1, pose.rt]]) P.push(at(tint(new THREE.BoxGeometry(.13, .93, .13), u.legs).translate(0, -.46, 0), s * .09, hipY, 0, a));
  const T = [at(tint(new THREE.CylinderGeometry(.17, .29, 1.0, 4), u.coat), 0, hipY + .1, 0, 0, Math.PI / 4), at(tint(new THREE.BoxGeometry(.2, .22, .2), SKIN), 0, hipY + .74, 0), at(tint(new THREE.CylinderGeometry(.24, .2, .1, 3), u.hat), 0, hipY + .86, 0, 0, Math.PI)];
  if (pose.musket === 'present') T.push(at(tint(new THREE.BoxGeometry(.06, .06, 1.5), WOOD), .1, hipY + .58, .55));
  else { const tilt = pose.musket === 'trail' ? .55 : .12; T.push(at(tint(new THREE.BoxGeometry(.06, 1.6, .06), WOOD), .26, hipY + .3, -.04, tilt)); }
  const torso = merge(T); torso.translate(0, -hipY, 0); torso.rotateX(pose.lean || 0); torso.translate(0, hipY, 0);
  return merge([...P, torso]);
}

/* infantry frames: 0 stand, 1..6 march, 7 present (firing), 8..11 run (rout, leaning, musket trailed) */
export function infantryFrames(side, low) {
  const soldier = low ? soldierLow : soldierFull;
  const u = UNIFORM[side], F = [soldier(u, { lt: 0, rt: 0, la: 0, ra: 0, musket: 'shoulder' })];
  for (let i = 0; i < 6; i++) { const p = i / 6 * Math.PI * 2, a = Math.sin(p) * .42; F.push(soldier(u, { lt: a, rt: -a, la: -a * .8, ra: 0, musket: 'shoulder', lean: .03 })); }
  F.push(soldier(u, { lt: -.25, rt: .12, la: 0, ra: 0, musket: 'present', lean: .05 }));
  for (let i = 0; i < 4; i++) { const p = i / 4 * Math.PI * 2, a = Math.sin(p) * .7; F.push(soldier(u, { lt: a, rt: -a, la: -a, ra: a * .5, musket: 'trail', lean: .25 })); }
  return F;
}

// distant figure (~48 triangles): two frames, standing and mid-step
export function tinyFrames(side) {
  const u = UNIFORM[side], mk = step => merge([
    at(tint(new THREE.BoxGeometry(.24, .86, .14), u.legs), 0, .43, step ? .05 : 0, step ? .18 : 0),
    at(tint(new THREE.BoxGeometry(.42, .72, .3), u.coat), 0, 1.2 + (step ? .03 : 0), 0),
    at(tint(new THREE.BoxGeometry(.2, .2, .2), SKIN), 0, 1.66, 0), at(tint(new THREE.BoxGeometry(.4, .09, .3), u.hat), 0, 1.81, 0),
    at(tint(new THREE.BoxGeometry(.05, 1.5, .05), WOOD), .24, 1.35, -.04, .12)]);
  return [mk(false), mk(true)];
}
// distant horse and rider (~84 triangles): standing and two gallop frames
export function tinyCavalryFrames(side) {
  const u = UNIFORM[side], hc = side === 'A' ? 0x5a3a22 : 0xd8d2c6, mk = k => {
    const swing = [0, .5, -.5][k];
    return merge([at(tint(new THREE.BoxGeometry(.55, .62, 1.7), hc), 0, 1.25, 0), at(tint(new THREE.BoxGeometry(.3, .75, .35), hc), 0, 1.7, .8, -.6), at(tint(new THREE.BoxGeometry(.24, .28, .55), hc), 0, 1.95, 1.12, .5),
      at(tint(new THREE.BoxGeometry(.45, .95, .14), 0x2a1e14).translate(0, -.47, 0), 0, 1.0, .6, swing), at(tint(new THREE.BoxGeometry(.45, .95, .14), 0x2a1e14).translate(0, -.47, 0), 0, 1.0, -.6, -swing),
      at(tint(new THREE.BoxGeometry(.6, .06, .8), side === 'A' ? 0xa3302a : 0x2b3d6e), 0, 1.58, 0),
      at(tint(new THREE.BoxGeometry(.4, .62, .3), u.coat), 0, 1.95, -.05), at(tint(new THREE.BoxGeometry(.2, .2, .2), SKIN), 0, 2.38, 0), at(tint(new THREE.BoxGeometry(.4, .09, .3), u.hat), 0, 2.52, 0)]);
  };
  return [mk(0), mk(1), mk(2)];
}

/* bake a skinned animal clip into static geometries (vertex colours from its materials) */
const vtmp = new THREE.Vector3();
export function bakeAnimal(gltf, height, clipName, n, extra) {
  const a = makeAnimal(gltf, height), clip = a.clips[clipName], frames = [];
  const act = a.mixer.clipAction(clip); act.play();
  for (let f = 0; f < n; f++) {
    a.mixer.setTime(clip.duration * f / n); a.obj.updateMatrixWorld(true); a.obj.traverse(m => { if (m.isSkinnedMesh) m.skeleton.update(); });
    const pos = [], col = [];
    a.obj.traverse(m => {
      if (!m.isSkinnedMesh) return;
      const g = m.geometry, idx = g.index, c = m.material.color, cnt = idx ? idx.count : g.attributes.position.count;
      for (let k = 0; k < cnt; k++) { const i = idx ? idx.getX(k) : k; m.getVertexPosition(i, vtmp); vtmp.applyMatrix4(m.matrixWorld); pos.push(vtmp.x, vtmp.y, vtmp.z); col.push(c.r, c.g, c.b); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    frames.push(extra ? merge([g, extra.clone()]) : g);
  }
  const bb = new THREE.Box3().setFromObject(a.obj, true);
  return { frames, bb, dur: clip.duration };
}

/* cavalry frames: horse+rider. 0 idle, 1..6 walk, 7..12 gallop */
export function cavalryFrames(gltf, side) {
  const u = UNIFORM[side], probe = makeAnimal(gltf, 2.15), bb = new THREE.Box3().setFromObject(probe.obj, true);
  const len = bb.max.z - bb.min.z, saddleY = bb.min.y + (bb.max.y - bb.min.y) * .66, cz = bb.min.z + len * .5;
  const r = rider(u, side === 'A'); r.translate(0, saddleY + .1, cz);
  const cloth = merge([at(tint(new THREE.BoxGeometry(.75, .05, 1.0), side === 'A' ? 0xa3302a : 0x2b3d6e), 0, saddleY - .02, cz), at(tint(new THREE.BoxGeometry(.05, .5, .95), side === 'A' ? 0xa3302a : 0x2b3d6e), .37, saddleY - .27, cz), at(tint(new THREE.BoxGeometry(.05, .5, .95), side === 'A' ? 0xa3302a : 0x2b3d6e), -.37, saddleY - .27, cz)]);
  const extra = merge([r, cloth]);
  const idle = bakeAnimal(gltf, 2.15, 'Idle', 1, extra), walk = bakeAnimal(gltf, 2.15, 'Walk', 6, extra), gal = bakeAnimal(gltf, 2.15, 'Gallop', 6, extra);
  return [...idle.frames, ...walk.frames, ...gal.frames];
}

/* A set of InstancedMeshes, one per frame; each tick, instances are re-bucketed by frame */
export class FramePool {
  constructor(frames, cap, mat) {
    this.cap = cap;
    this.meshes = frames.map(g => { const m = new THREE.InstancedMesh(g, mat, cap); m.count = 0; m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; return m; });
    this.group = new THREE.Group(); this.group.add(...this.meshes);
  }
  begin() { for (const m of this.meshes) m.count = 0; }
  push(frame, matrix) { const m = this.meshes[frame]; if (m.count < this.cap) m.setMatrixAt(m.count++, matrix); }
  put(frame, x, y, z, c, s, S) { const m = this.meshes[frame]; if (m.count >= this.cap) return; const e = m.instanceMatrix.array, o = m.count++ * 16;
    e[o] = c * S; e[o + 1] = 0; e[o + 2] = -s * S; e[o + 3] = 0; e[o + 4] = 0; e[o + 5] = S; e[o + 6] = 0; e[o + 7] = 0; e[o + 8] = s * S; e[o + 9] = 0; e[o + 10] = c * S; e[o + 11] = 0; e[o + 12] = x; e[o + 13] = y; e[o + 14] = z; e[o + 15] = 1; }
  end() { for (const m of this.meshes) { const a = m.instanceMatrix; a.clearUpdateRanges(); if (m.count) { a.addUpdateRange(0, m.count * 16); a.needsUpdate = true; } } } // upload only the instances in use
  setShadow(on) { for (const m of this.meshes) m.castShadow = on; }
}
