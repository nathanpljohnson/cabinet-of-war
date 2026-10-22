import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { tint, merge, place, box } from './lib.js';

const loader = new GLTFLoader(), cache = {};
export function loadGLB(url) { return cache[url] || (cache[url] = loader.loadAsync(url)); }

/* Uniforms (illustrative, broad 1740 conventions). Bands are read in the mannequin's bind pose (metres, T-pose). */
export const OUTFITS = {
  commander: { coat: 0xd9d3c6, facing: 0xa3302a, vest: 0xa3302a, breeches: 0xe9e3d3, legs: 0x17130f, bootTop: .56, hat: 0x1a1612, hatTrim: 0xd4b24a, wig: 0xeeeae2, sash: 0xd4b24a, sword: true },
  aide: { coat: 0xd2cbbd, facing: 0x2f5a3a, vest: 0xd4b24a, breeches: 0xe9e3d3, legs: 0x17130f, bootTop: .56, hat: 0x1a1612, hatTrim: 0xd4b24a, wig: 0xe2ddd2, sword: true },
  adviser: { coat: 0x463650, facing: 0x463650, vest: 0x8a6a3a, breeches: 0x463650, legs: 0xefeae0, bootTop: .12, hat: null, wig: 0xf2efe8, longCoat: true },
  clerk: { coat: 0x3d4434, facing: 0x3d4434, vest: 0xb8a882, breeches: 0x3d4434, legs: 0xe6e0d2, bootTop: .12, hat: null, wig: 0xd8d2c4 },
  infantry: { coat: 0xe6e1d4, facing: 0xa3302a, vest: 0xe6e1d4, breeches: 0xe6e1d4, legs: 0x26221e, bootTop: .5, hat: 0x1a1612, hatTrim: 0xf2eee4, wig: 0x6a4a30, musket: true, pouch: true },
  gunner: { coat: 0x8a7458, facing: 0xa3302a, vest: 0x8a7458, breeches: 0x8a7458, legs: 0x26221e, bootTop: .5, hat: 0x1a1612, hatTrim: 0xf2eee4, wig: 0x5a3e28 },
  courier: { coat: 0x5a6a3a, facing: 0xa3302a, vest: 0x5a6a3a, breeches: 0xd8cdb4, legs: 0x17130f, bootTop: .56, hat: 0x1a1612, hatTrim: 0xf2eee4, wig: 0x5a3e28 },
  // court and town (illustrative)
  minister: { coat: 0x2c3a5a, facing: 0x2c3a5a, vest: 0xd4b24a, breeches: 0x2c3a5a, legs: 0xefeae0, bootTop: .12, hat: null, wig: 0xf2efe8, longCoat: true },
  courtier: { coat: 0x7a2a3a, facing: 0x7a2a3a, vest: 0xe8dcc0, breeches: 0x7a2a3a, legs: 0xefeae0, bootTop: .12, hat: 0x1a1612, hatTrim: 0xd4b24a, wig: 0xf2efe8, longCoat: true },
  general: { coat: 0xe6e1d4, facing: 0xa3302a, vest: 0xa3302a, breeches: 0xe6e1d4, legs: 0x17130f, bootTop: .56, hat: 0x1a1612, hatTrim: 0xd4b24a, wig: 0xeeeae2, sash: 0xd4b24a, sword: true },
  mourner: { coat: 0x1a1817, facing: 0x1a1817, vest: 0x2a2624, breeches: 0x1a1817, legs: 0x1a1817, bootTop: .12, hat: null, wig: 0xf2efe8, longCoat: true }, // court mourning, 1740
  mournerHat: { coat: 0x1c1a19, facing: 0x1c1a19, vest: 0x2a2624, breeches: 0x1c1a19, legs: 0x1c1a19, bootTop: .12, hat: 0x111010, hatTrim: 0x111010, wig: 0xf2efe8, longCoat: true },
  burgher: { coat: 0x6a4a2e, facing: 0x6a4a2e, vest: 0x9a8a5a, breeches: 0x4a3a2a, legs: 0xd8d0c0, bootTop: .12, hat: 0x2a2018, hatTrim: 0x2a2018, wig: 0x6a5a48 },
  labourer: { coat: 0xe2dccb, facing: 0xe2dccb, vest: 0x7a5a3a, breeches: 0x5a4a38, legs: 0x8a7a64, bootTop: .12, hat: null, wig: 0x5a4030 },
  woman: { coat: 0x8a3a2e, facing: 0xeee8da, vest: 0xeee8da, breeches: 0x3a4a5a, legs: 0x3a4a5a, bootTop: .12, hat: null, wig: 0x6a4a30, gown: 0x3a4a5a, cap: true },
  lady: { coat: 0xb8c8d8, facing: 0xf2eee4, vest: 0xf2eee4, breeches: 0xb8c8d8, legs: 0xb8c8d8, bootTop: .12, hat: null, wig: 0xe8e2d6, gown: 0xa8b8cc },
};
const SKIN = new THREE.Color(0xd8a684), STOCK = new THREE.Color(0x1d1a18), SHOE = new THREE.Color(0x15110d);

function paint(geo, o) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3), c = new THREE.Color();
  const C = k => new THREE.Color(o[k]);
  const coat = C('coat'), facing = C('facing'), vest = C('vest'), breeches = C('breeches'), legs = C('legs'), wig = C('wig'), sash = o.sash ? C('sash') : null;
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(x);
    if (ax > .74) c.copy(SKIN);                                   // hands
    else if (ax > .62) c.copy(facing);                            // cuffs
    else if (ax > .2 && y > 1.2) c.copy(coat);                    // sleeves
    else if (y > 1.56) c.copy(z < -.02 && y < 1.72 ? wig : (y > 1.74 && !o.hat ? wig : SKIN)); // head, hair at the back
    else if (y > 1.47) c.copy(ax < .07 && z > 0 ? STOCK : (z > .02 ? STOCK : coat)); // neck stock
    else if (y > .95) c.copy(z > .045 && ax < .11 ? vest : (sash && y > 1.0 && y < 1.07 ? sash : (z > .03 && ax < .16 && y > 1.15 ? facing : coat)));
    else if (y > o.bootTop) c.copy(breeches);
    else if (y > .06) c.copy(legs);
    else c.copy(SHOE);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function tricorne(c, trim) {
  const P = [];
  P.push(place(tint(new THREE.CylinderGeometry(.105, .118, .1, 10), c), 0, .05, 0));
  P.push(place(tint(new THREE.CylinderGeometry(.24, .2, .07, 3), c), 0, .06, 0, Math.PI));          // the cocked brim, a point to the front
  P.push(place(tint(new THREE.CylinderGeometry(.252, .212, .03, 3), trim), 0, .025, 0, Math.PI));
  return merge(P);
}
function skirts(o) {
  if (o.gown) return merge([tint(new THREE.CylinderGeometry(.17, .38, .84, 12), o.gown, .04), place(tint(new THREE.CylinderGeometry(.13, .24, .6, 10, 1, true, -.7, 1.4), 0xeee8da), 0, -.1, .03)]); // gown to the ground, apron
  const g = new THREE.CylinderGeometry(.2, .31, .5, 12, 1, true, .55, Math.PI * 2 - 1.1);
  const P = [tint(g, o.coat)];
  P.push(place(tint(new THREE.CylinderGeometry(.205, .315, .12, 12, 1, true, .55, Math.PI * 2 - 1.1), o.facing), 0, -.19, 0));
  return merge(P);
}
function musket() {
  return merge([box(.035, 1.0, .06, 0x5a3a20, 0, 0, 0), box(.022, .55, .022, 0x3a3a3c, 0, .98, .012), box(.012, .2, .012, 0xc8c8cc, 0, 1.5, .012), box(.04, .05, .06, 0x8a7a3a, 0, .55, 0)]);
}
function wig(c) { return merge([place(tint(new THREE.IcosahedronGeometry(.055, 0), c), .1, -.02, -.02), place(tint(new THREE.IcosahedronGeometry(.055, 0), c), -.1, -.02, -.02), place(tint(new THREE.CylinderGeometry(.025, .015, .18, 5), 0x1d1a18), 0, -.12, -.1, 0, 1, 1, 1, .3)]); }

const tmpM = new THREE.Matrix4();
function attach(root, boneName, geo, mat, worldPos, worldRot = new THREE.Euler()) {
  const bone = root.getObjectByName(boneName); if (!bone) return null;
  const m = new THREE.Mesh(geo, mat); m.castShadow = true;
  const want = new THREE.Matrix4().compose(worldPos, new THREE.Quaternion().setFromEuler(worldRot), new THREE.Vector3(1, 1, 1));
  tmpM.copy(bone.matrixWorld).invert().multiply(want); tmpM.decompose(m.position, m.quaternion, m.scale);
  bone.add(m); return m;
}

let mannequin = null;
const actorMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85, metalness: 0 });
const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .8, metalness: 0 });

export async function initActors(base = 'w3d/assets/') {
  const [m, hb, hw, sh, dg] = await Promise.all(['ual1_standard.glb', 'horse_bay.glb', 'horse_white.glb', 'sheep.glb', 'shibainu.glb'].map(f => loadGLB(base + f)));
  mannequin = m;
  return { m, hb, hw, sh, dg };
}

// moving people and animals do not cast into the shadow map (it is redrawn only when the view moves, see main.js);
// a soft blob on the ground under them stands in for their shadow
const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), blobGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
function groundShadow(obj, rx, rz) { obj.traverse(x => { x.castShadow = false; }); const m = new THREE.Mesh(blobGeo, blobMat); m.scale.set(rx, 1, rz); m.position.y = .05; m.renderOrder = 1; obj.add(m); }

const geoCache = {};
/* A dressed, animated person. Returns {obj, mixer, play(name, fade), clips} */
export function makePerson(kind, look = {}) {
  const o = OUTFITS[kind], root = SkeletonUtils.clone(mannequin.scene);
  root.updateMatrixWorld(true);
  root.traverse(x => {
    if (!x.isSkinnedMesh) return;
    const key = kind + x.geometry.uuid;
    if (!geoCache[key]) { const g = x.geometry.clone(); paint(g, o); geoCache[key] = g; }
    x.geometry = geoCache[key]; x.material = actorMat; x.castShadow = true; x.receiveShadow = false; x.frustumCulled = false;
  });
  // put the skeleton in bind pose so world positions of attachments match the T-pose measurements
  root.traverse(x => { if (x.isSkinnedMesh) x.skeleton.pose(); }); root.updateMatrixWorld(true);
  if (o.hat) attach(root, 'Head', tricorne(o.hat, o.hatTrim), propMat, new THREE.Vector3(0, 1.79, -.005), new THREE.Euler(-.08, 0, 0));
  if (o.wig) attach(root, 'Head', wig(o.wig), propMat, new THREE.Vector3(0, 1.7, -.01));
  attach(root, 'pelvis', skirts(o), propMat, new THREE.Vector3(0, o.gown ? .5 : o.longCoat ? .78 : .8, -.01));
  if (o.cap) attach(root, 'Head', place(tint(new THREE.IcosahedronGeometry(.12, 1), 0xf4f0e6), 0, 0, 0, 0, 1, .55, 1.05), propMat, new THREE.Vector3(0, 1.8, -.02));
  if (o.musket) attach(root, 'spine_03', musket(), propMat, new THREE.Vector3(.19, .92, -.08), new THREE.Euler(.1, 0, -.12));
  if (o.sword) attach(root, 'pelvis', merge([box(.03, .85, .02, 0xb8b8bc, 0, 0, 0), box(.12, .03, .04, 0xd4b24a, 0, .85, 0)]), propMat, new THREE.Vector3(-.24, .42, -.1), new THREE.Euler(.5, 0, .1));
  if (o.pouch) attach(root, 'pelvis', box(.2, .14, .08, 0x15110d, 0, 0, 0), propMat, new THREE.Vector3(.2, .92, -.12));
  // what makes a principal recognisable across the courtyard (people.js): build and what they carry
  const props = look.props || [];
  if (props.includes('spectacles')) attach(root, 'Head', merge([place(tint(new THREE.TorusGeometry(.028, .005, 4, 10), 0x2a2620), .035, 0, 0), place(tint(new THREE.TorusGeometry(.028, .005, 4, 10), 0x2a2620), -.035, 0, 0), box(.02, .005, .005, 0x2a2620, 0, -.002, 0)]), propMat, new THREE.Vector3(0, 1.665, .1));
  if (props.includes('papers')) attach(root, 'spine_03', merge([box(.24, .03, .32, 0xf3ecd8, 0, 0, 0), box(.05, .035, .32, 0xa3302a, .06, 0, 0)]), propMat, new THREE.Vector3(.2, 1.12, .02), new THREE.Euler(0, 0, -1.2));
  if (props.includes('star')) attach(root, 'spine_03', place(tint(new THREE.CylinderGeometry(.045, .045, .01, 8), 0xe8d48a), 0, 0, 0, 0, 1, 1, 1, Math.PI / 2), propMat, new THREE.Vector3(.09, 1.3, .13));
  if (props.includes('cane')) attach(root, 'pelvis', merge([box(.025, .98, .025, 0x3a2416, 0, 0, 0), box(.05, .05, .05, 0xd4b24a, 0, .98, 0)]), propMat, new THREE.Vector3(.3, .02, .14), new THREE.Euler(.1, 0, -.06));
  if (look.scale) root.scale.set(...look.scale);
  const obj = new THREE.Group(); obj.add(root); groundShadow(obj, .5, .5);
  const mixer = new THREE.AnimationMixer(root), clips = {};
  for (const c of mannequin.animations) clips[c.name] = c;
  return wrapAnim(obj, mixer, clips);
}

function wrapAnim(obj, mixer, clips) {
  let cur = null, curName = '';
  const play = (name, fade = .25, speed = 1) => {
    if (curName === name) { if (cur) cur.timeScale = speed; return; }
    const c = clips[name]; if (!c) return;
    const a = mixer.clipAction(c); a.reset(); a.timeScale = speed; a.play();
    if (cur) a.crossFadeFrom(cur, fade, false);
    cur = a; curName = name;
  };
  return { obj, mixer, clips, play, get anim() { return curName; } };
}

/* Horses: Quaternius models are authored huge and rotated; normalise to ~2.1 m tall incl. head, nose along +z */
export function makeAnimal(gltf, height, opts = {}) {
  const root = SkeletonUtils.clone(gltf.scene);
  root.traverse(x => { if (x.isMesh) { x.castShadow = true; x.frustumCulled = false; if (x.material) { x.material = x.material.clone(); x.material.flatShading = true; x.material.roughness = .85; x.material.metalness = 0; } } });
  root.updateMatrixWorld(true); root.traverse(x => { if (x.isSkinnedMesh) x.skeleton.update(); }); // bone matrices are otherwise only refreshed at render time
  const bb = new THREE.Box3().setFromObject(root, true), s = height / (bb.max.y - bb.min.y); // precise: skinned vertices, not the bind-space box
  root.scale.multiplyScalar(s); root.position.y = -bb.min.y * s;
  const obj = new THREE.Group(); obj.add(root); obj.updateMatrixWorld(true); root.traverse(x => { if (x.isSkinnedMesh) x.skeleton.update(); });
  if (opts.saddle) {
    const sb = new THREE.Box3().setFromObject(root, true), cx = (sb.min.x + sb.max.x) / 2, len = sb.max.z - sb.min.z, back = sb.min.y + (sb.max.y - sb.min.y) * .64;
    const cloth = merge([box(.7, .04, .95, 0xa3302a, 0, 0, 0), box(.74, .03, .99, 0xd4b24a, 0, -.01, 0), place(tint(new THREE.BoxGeometry(.04, .5, .9), 0xa3302a), .36, -.25, 0), place(tint(new THREE.BoxGeometry(.04, .5, .9), 0xa3302a), -.36, -.25, 0), box(.42, .16, .5, 0x3a2416, 0, .04, 0), box(.36, .16, .08, 0x3a2416, 0, .1, .24)]);
    const body = root.getObjectByName('Torso') || root.getObjectByName('Body');
    if (body) attach(root, body.name, cloth, propMat, new THREE.Vector3(cx, back + .02, sb.min.z + len * .52));
  }
  groundShadow(obj, height * .3, height * .62);
  const mixer = new THREE.AnimationMixer(root), clips = {};
  for (const c of gltf.animations) if (!c.name.includes('|')) clips[c.name] = c;
  return wrapAnim(obj, mixer, clips);
}

export function makeHorse(which, opts = {}) { return makeAnimal(which, 2.15, opts); }
