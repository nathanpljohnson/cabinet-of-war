import * as THREE from 'three';
import { makeNoise, rngFrom, smooth, lerp, polylineFromCurve, makeDistField, stdMat, tint, merge, place, box } from './lib.js';
import { axis, buildTerrain } from './terrain.js';
import { buildForest, buildRocks, buildGrass, AUTUMN, FIRS } from './nature.js';
import * as P from './props.js';
import { makePerson, makeHorse, makeAnimal } from './actors.js';
import { infantryFrames, FramePool, rider as riderGeo } from './figures.js';
import { place as placeGeom } from './lib.js';
import { personOf } from './people.js';
import { placeCfg, townHouse, church, landmark, viennaSkyline, marianColumn, stall } from './places.js';

/* The explorable ground: headquarters courtyard → road over the river → a small camp.
   Illustrative countryside outside Vienna; not a reconstruction of a particular site. */
export const HQ = { x: -200, z: -10 }, CAMP = { x: 178, z: 44, r: 50 };
const CY = { x0: -193.5, x1: -159.5, z0: -26.5, z1: 6.5 };

export function buildRegion({ actors, quality, uTime, place = { id: 'vienna', name: 'Vienna' }, people = [], mode = 'court', cues = {} }) {
  // cues: what the state says the world looks like — season, mourning, pay, roads, refugees, men in camp, standing, dismissal
  const winter = cues.season === 'winter', SNOW = new THREE.Color(0xeef1f4);
  // what someone walking through would notice (state.world.scene, chosen by the adjudicator from a fixed list)
  // winter quarters and campaigning look the part unless the adjudicator described this place itself
  const tags = new Set(cues.scene && cues.scene.length ? cues.scene : cues.tempo === 'winter quarters' ? ['idle_soldiers'] : cues.tempo === 'campaigning' ? ['wagons_in'] : []);
  // each campaign location gets its own country: same plan, different seed, name and stucco
  const seed = [...place.id].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7), N = makeNoise(place.id === 'vienna' ? 1740 : seed), rnd = rngFrom(place.id === 'vienna' ? 1021 : seed ^ 0x5bd1), group = new THREE.Group();
  const STUCCO = [0xdcb873, 0xe8d9b8, 0xd9b8a0, 0xe2cf96, 0xd8c8c0][Math.abs(seed) % 5];
  // the town round your lodging (not at Vienna, where headquarters lie outside the walls and the city is on the skyline)
  const cfg = placeCfg(place.id), town = cfg.town, TOWN = { x0: -232, x1: -88, z0: -72, z1: 50 }, SQ = { x0: -156, x1: -104, z0: -42, z1: 22 };
  const far0 = cfg.skyline ? { x: -760, z: -600, r: 300 } : cfg.landmark ? { x: -330, z: -480, r: 110 } : null;
  const pathCurve = new THREE.CatmullRomCurve3([[-157, -10], [-132, -7], [-104, 6], [-76, 14], [-52, 11], [-31, 6], [-10, 1], [14, -9], [42, -21], [72, -22], [98, -8], [122, 12], [146, 24], [160, 30]].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const riverCurve = new THREE.CatmullRomCurve3([[-110, -900], [-70, -420], [-52, -200], [-22, -110], [-40, -42], [-30, 6], [-16, 58], [-42, 140], [-24, 230], [-60, 460], [-40, 900]].map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const PP = polylineFromCurve(pathCurve, 2), RP = polylineFromCurve(riverCurve, 4);
  const pathD = makeDistField(PP, 16), riverD = makeDistField(RP, 24);

  const base = (x, z) => {
    const r = Math.hypot(x, z);
    let h = 7 + 6 * N.fbm(x / 170, z / 170, 4) + 2.2 * N.fbm(x / 45 + 9, z / 45, 3);
    h += 15 * Math.exp(-((x - 40) ** 2 + (z + 100) ** 2) / (2 * 42 * 42));
    h += 11 * Math.exp(-((x + 95) ** 2 + (z - 125) ** 2) / (2 * 55 * 55));
    h += smooth(300, 1100, r) * (26 + 70 * Math.max(0, N.fbm(x / 430 + 3, z / 430 - 7, 4) + .35));
    return h;
  };
  const hqH = base(HQ.x + 20, HQ.z), campH = base(CAMP.x, CAMP.z), farH = far0 ? base(far0.x, far0.z) : 0;
  const rectD = (x, z, x0, x1, z0, z1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  const pre = (x, z) => { // everything except the road
    let h = base(x, z);
    const [dR] = riverD(x, z, 60);
    h = lerp(h, -1.7, 1 - smooth(4, 24, dR));
    h = lerp(h, hqH, 1 - smooth(0, 16, rectD(x, z, -212, -150, -42, 22)));
    h = lerp(h, campH, 1 - smooth(CAMP.r - 4, CAMP.r + 16, Math.hypot(x - CAMP.x, z - CAMP.z)));
    if (town) h = lerp(h, hqH, 1 - smooth(0, 14, rectD(x, z, TOWN.x0, TOWN.x1, TOWN.z0, TOWN.z1)));
    if (far0) h = lerp(h, farH, 1 - smooth(far0.r, far0.r * 1.5, Math.hypot(x - far0.x, z - far0.z)));
    return h;
  };
  // road profile: follow the ground, smoothed, raised to the bridge deck at the crossing
  let prof = PP.map(([x, z]) => pre(x, z));
  for (let pass = 0; pass < 3; pass++) prof = prof.map((_, i) => { let s = 0, k = 0; for (let j = Math.max(0, i - 6); j <= Math.min(prof.length - 1, i + 6); j++) { s += prof[j]; k++; } return s / k; });
  let iB = 0, bd = 1e9; PP.forEach(([x, z], i) => { const d = riverD(x, z, 60)[0]; if (d < bd) { bd = d; iB = i; } });
  const DECK = 2.0; prof = prof.map((h, i) => { const s = Math.abs(i - iB) * 2; return s < 12 ? DECK : lerp(DECK, h, smooth(12, 30, s)); });
  const profAt = t => { const i = Math.min(prof.length - 2, Math.floor(t)), f = t - i; return lerp(prof[i], prof[i + 1], f); };

  let info = { dP: 0, dR: 0, h0: 0 };
  const height = (x, z) => {
    const h0 = pre(x, z), [dP, t] = pathD(x, z, 40), [dR] = riverD(x, z, 60);
    const m = (1 - smooth(2.4, 6.5, dP)) * smooth(9.5, 13.5, dR);
    info = { dP, dR, h0 };
    return lerp(h0, profAt(t) - .1, m);
  };

  const fieldAt = (x, z) => { // open fields south of the road, east of the river: irregular edges, no strips
    const e = 14 * N(x / 40 + 3, z / 40 - 6);
    return x + e < 0 || x - e > 128 || z + e < 58 || z - e > 210 ? -1 : 0;
  };
  const C = new THREE.Color(), tmp = new THREE.Color();
  const G1 = new THREE.Color(0x6f8a3c), G2 = new THREE.Color(0x9f9d50), G3 = new THREE.Color(0x587236), DIRT = new THREE.Color(0xa8805a), DIRT2 = new THREE.Color(0x8e6c4a), GRAVEL = new THREE.Color(0xc6b597), BANK = new THREE.Color(0xa1977c), MUD = new THREE.Color(0x56675c);
  const FIELDS = [0xc6ad66, 0x7e5c3e, 0x8ea24c, 0xb59a58].map(c => new THREE.Color(c));
  const color = (x, z, h, out) => {
    const n = N.fbm(x / 38, z / 38, 3), f = N.fbm(x / 120 - 4, z / 120 + 2, 3);
    out.copy(G1).lerp(G2, smooth(-.15, .55, n)); if (f > .1) out.lerp(G3, smooth(.1, .4, f) * .7);
    if (fieldAt(x, z) >= 0) { const a = N.fbm(x / 60 + 2, z / 60, 3), b = N(x / 25 - 4, z / 25 + 1); out.copy(FIELDS[0]).lerp(FIELDS[2], smooth(-.2, .25, a)).lerp(FIELDS[1], smooth(.2, .5, b) * .45).lerp(tmp.set(0xffffff), (N(x / 6, z / 6) * .5 + .5) * .05); }
    const r = Math.hypot(x, z); if (r > 320) out.lerp(tmp.set(0x55703a), smooth(320, 900, r) * .5);
    if (town && rectD(x, z, TOWN.x0, TOWN.x1, TOWN.z0, TOWN.z1) < .1) out.copy(rectD(x, z, SQ.x0, SQ.x1, SQ.z0, SQ.z1) < .1 ? GRAVEL : DIRT2).lerp(tmp.set(0x9a9284), (N(x / 2.5, z / 2.5) * .5 + .5) * .4);
    if (rectD(x, z, CY.x0, CY.x1, CY.z0, CY.z1) < .1) out.copy(GRAVEL).lerp(tmp.set(0xb2a487), (N(x / 3, z / 3) * .5 + .5) * .5);
    const dc = Math.hypot(x - CAMP.x, z - CAMP.z); if (dc < CAMP.r) out.lerp(tmp.set(0x9d8c5c), (1 - smooth(CAMP.r * .5, CAMP.r, dc)) * (.45 + .3 * N(x / 9, z / 9)));
    if (winter && h > .5) out.lerp(SNOW, .55 + .35 * smooth(-.3, .4, N(x / 22, z / 22)));
    const pm = 1 - smooth(1.6, 3.4, info.dP); if (pm > 0) out.lerp(tmp.copy(cues.roads === 'heavy' || cues.roads === 'impassable' ? MUD : DIRT).lerp(DIRT2, smooth(.6, 1.4, Math.abs(info.dP - 1.1) < .35 ? 1.4 : 0)), pm);
    if (h < .45) out.lerp(BANK, smooth(.45, .05, h)); if (h < -.25) out.copy(MUD);
  };

  const xs = axis(-264, 264, quality.terrain, 1600, 44), zs = axis(-204, 204, quality.terrain, 1600, 44);
  const T = buildTerrain({ xs, zs, height, color, steep: 0x8a7c66, seed: 7 });
  group.add(T.mesh);
  const hAt = T.heightAt;

  // water
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400, 1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x78b4c2, roughness: .08, metalness: .1, transparent: true, opacity: .8 }));
  water.position.y = 0; water.receiveShadow = true; group.add(water);

  /* ---------- vegetation ---------- */
  const inCY = (x, z, m) => rectD(x, z, -214, -148, -44, 24) < m;
  const blocked = (x, z, path = 7) => { const [dP] = pathD(x, z, 20), [dR] = riverD(x, z, 30); return dP < path || dR < 10.5 || inCY(x, z, 6) || Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r + 6 || fieldAt(x, z) !== -1 || (x < -40 && x > -150 && z > 95 && z < 170) || (town && rectD(x, z, TOWN.x0, TOWN.x1, TOWN.z0, TOWN.z1) < 6); };
  const trees = { broadleaf: [], fir: [], poplar: [], bush: [] }, rocks = [], pick = a => a[Math.floor(rnd() * a.length)];
  const addFar = (sp, x, z, s) => { const y = hAt(x, z); far[sp].push({ x, y, z, ry: rnd() * 6.28, s, col: sp === 'fir' ? pick(FIRS) : winter ? pick(BARE) : pick(AUTUMN) }); };
  const addTree = (sp, x, z, s, col) => { const y = hAt(x, z); if (y < .4) return; trees[sp].push({ x, y, z, ry: rnd() * 6.28, s, col: col || (sp === 'fir' ? pick(FIRS) : winter ? pick(BARE) : pick(AUTUMN)) }); };
  const BARE = [0x6e5e4e, 0x7a6a58, 0x625446];
  const dens = quality.trees;
  for (let x = -264; x < 264; x += 6 / dens) for (let z = -204; z < 204; z += 6 / dens) {
    const px = x + (rnd() - .5) * 5, pz = z + (rnd() - .5) * 5, f = N.fbm(px / 120 - 4, pz / 120 + 2, 3);
    if (blocked(px, pz)) continue;
    if (rnd() < smooth(.04, .22, f) * 1.05) {
      const h = hAt(px, pz), sp = rnd() < smooth(10, 20, h) * .55 + .12 ? 'fir' : 'broadleaf';
      addTree(sp, px, pz, .8 + rnd() * .55);
    } else if (rnd() < smooth(-.05, .08, f) * .25) addTree('bush', px, pz, .8 + rnd() * .7);
  }
  for (let i = 0; i < 26; i++) { const cx = -250 + rnd() * 500, cz = -190 + rnd() * 380; if (blocked(cx, cz, 12)) continue; const n = 3 + Math.floor(rnd() * 5), col = pick(AUTUMN); for (let k = 0; k < n; k++) { const x = cx + (rnd() - .5) * 14, z = cz + (rnd() - .5) * 14; if (!blocked(x, z)) addTree(k === 0 && rnd() < .3 ? 'fir' : 'broadleaf', x, z, .8 + rnd() * .5, rnd() < .6 ? col : pick(AUTUMN)); } for (let k = 0; k < 4; k++) { const x = cx + (rnd() - .5) * 18, z = cz + (rnd() - .5) * 18; if (!blocked(x, z, 4)) addTree('bush', x, z, .8 + rnd() * .6); } }
  // riverside poplars and willows
  for (let i = 0; i < RP.length; i++) { const [x, z] = RP[i]; if (Math.abs(z) > 220 || rnd() > .5) continue; const s = rnd() > .5 ? 1 : -1, d = 12 + rnd() * 6; const px = x + s * d, pz = z + (rnd() - .5) * 4; if (pathD(px, pz, 20)[0] < 8) continue; addTree(rnd() < .55 ? 'poplar' : 'broadleaf', px, pz, .8 + rnd() * .4, winter ? 0x6e5e4e : rnd() < .6 ? 0xd9b13a : 0x9fae4a); }
  // a lime allée from the gate: baroque avenue
  for (let i = 2; i < 46; i += 4) { const [x0, z0] = PP[i], [x1, z1] = PP[i + 1], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); for (const s of [-1, 1]) { const tx = x0 - dz / L * 6.2 * s, tz = z0 + dx / L * 6.2 * s; if (!(town && rectD(tx, tz, TOWN.x0, TOWN.x1, TOWN.z0, TOWN.z1) < 4)) addTree('broadleaf', tx, tz, 1.0, winter ? 0x6e5e4e : i % 8 ? 0xd8b03c : 0xc79a34); } }
  // hedges and bushes along the field margins
  for (let i = 0; i < 260; i++) { const x = -14 + rnd() * 156, z = 44 + rnd() * 180; if (fieldAt(x, z) === -1 && (fieldAt(x + 4, z) === 0 || fieldAt(x - 4, z) === 0 || fieldAt(x, z + 4) === 0 || fieldAt(x, z - 4) === 0) && !blocked(x, z, 4) && rnd() < .7) addTree('bush', x, z, .7 + rnd() * .6, pick([0x7a8a3a, 0xa08a3a, 0x8a5a2a])); }
  const forest = buildForest(trees, { variants: 3, seed: 3 }); group.add(forest);
  const far = { broadleaf: [], fir: [], poplar: [], bush: [] };
  // the wider country, coarser, no shadows
  for (let x = -1150; x < 1150; x += 15 / dens) for (let z = -1150; z < 1150; z += 15 / dens) {
    if (Math.abs(x) < 270 && Math.abs(z) < 210) continue;
    const px = x + (rnd() - .5) * 12, pz = z + (rnd() - .5) * 12, f = N.fbm(px / 160 - 4, pz / 160 + 2, 3);
    if (riverD(px, pz, 30)[0] < 12 || (far0 && Math.hypot(px - far0.x, pz - far0.z) < far0.r * 1.1)) continue;
    if (rnd() < smooth(-.05, .3, f) * .85) { const h = hAt(px, pz); addFar(rnd() < smooth(18, 50, h) * .6 + .15 ? 'fir' : 'broadleaf', px, pz, 1 + rnd() * .5); }
  }
  group.add(buildForest(far, { variants: 2, seed: 5, lod: true, shadows: false }));

  // rocks: a crag on the north hill, boulders by the water, stones along the road
  for (let i = 0; i < 24; i++) { const a = rnd() * 6.28, d = rnd() * 22, x = 40 + Math.sin(a) * d, z = -100 + Math.cos(a) * d; const s = 1.2 + rnd() * 2.6; rocks.push({ x, y: hAt(x, z) + s * .25, z, ry: rnd() * 6, sx: s * (1 + rnd() * .5), sy: s * (.6 + rnd() * .4), sz: s }); }
  for (let i = 0; i < 70; i++) { const [x, z] = RP[Math.floor(rnd() * RP.length)]; if (Math.abs(z) > 230) continue; const s = .5 + rnd() * 1.4, o = (rnd() > .5 ? 1 : -1) * (8 + rnd() * 6), px = x + o, pz = z + (rnd() - .5) * 6; if (pathD(px, pz, 20)[0] < 5) continue; rocks.push({ x: px, y: hAt(px, pz) + s * .1, z: pz, ry: rnd() * 6, sx: s, sy: s * .6, sz: s * (1 + rnd() * .4) }); }
  for (let i = 0; i < PP.length; i += 1) { if (rnd() > .28) continue; const [x0, z0] = PP[i], [x1, z1] = PP[Math.min(PP.length - 1, i + 1)], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1, s = rnd() > .5 ? 1 : -1, o = 3.4 + rnd() * 2.2, px = x0 - dz / L * o * s, pz = z0 + dx / L * o * s; if (inCY(px, pz, 2) || riverD(px, pz, 20)[0] < 12 || (town && rectD(px, pz, TOWN.x0, TOWN.x1, TOWN.z0, TOWN.z1) < 2)) continue; const sc = .2 + rnd() * .5; rocks.push({ x: px, y: hAt(px, pz), z: pz, ry: rnd() * 6, sx: sc, sy: sc * .7, sz: sc }); }
  for (let i = 0; i < 14; i++) { const cx = -240 + rnd() * 480, cz = -180 + rnd() * 360; if (blocked(cx, cz, 9)) continue; const n = 3 + Math.floor(rnd() * 4); for (let k = 0; k < n; k++) { const x = cx + (rnd() - .5) * 7, z = cz + (rnd() - .5) * 7, s = (k === 0 ? 2.6 : 1) * (1 + rnd() * 1.4); rocks.push({ x, y: hAt(x, z) + s * .2, z, ry: rnd() * 6, sx: s * 1.2, sy: s * .75, sz: s, col: rnd() < .5 ? 0x9a948a : 0x86827a }); } }
  for (let i = 0; i < 160; i++) { const x = -264 + rnd() * 528, z = -204 + rnd() * 408; if (blocked(x, z, 4)) continue; const s = .6 + rnd() * 1.6; rocks.push({ x, y: hAt(x, z) + s * .15, z, ry: rnd() * 6, sx: s, sy: s * .7, sz: s * 1.2 }); }
  group.add(buildRocks(rocks, 11));

  // grass and late flowers
  const grass = [];
  for (let i = 0; i < quality.grass * (winter ? .12 : 1); i++) {
    let x = -250 + rnd() * 500, z = -195 + rnd() * 390; if (rnd() < .6) { const [px, pz] = PP[Math.floor(rnd() * PP.length)]; x = px + (rnd() - .5) * 70; z = pz + (rnd() - .5) * 70; } const [dP] = pathD(x, z, 10);
    if (N(x / 14, z / 14) < -.35 && rnd() < .8) continue;
    if (dP < 2.6 || rectD(x, z, CY.x0, CY.x1, CY.z0, CY.z1) < .5 || (town && rectD(x, z, TOWN.x0, TOWN.x1, TOWN.z0, TOWN.z1) < 2)) continue;
    const y = hAt(x, z); if (y < .5) continue;
    if (fieldAt(x, z) >= 0 && rnd() < .8) continue;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < 30 && rnd() < .7) continue;
    const r = rnd(); grass.push({ x, y, z, ry: rnd() * 6.28, s: .6 + rnd() * .55, k: (N(x / 9 + 50, z / 9) > .45 && r < .55) ? 3 + Math.floor(rnd() * 3) : r < .03 ? 4 : Math.floor(rnd() * 3) });
  }
  group.add(buildGrass(grass, 4));

  /* ---------- buildings and props ---------- */
  const solid = [], colliders = [], add = (geo, x, z, ry = 0, y) => { const m = new THREE.Mesh(geo, propsMat); m.position.set(x, y ?? hAt(x, z), z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; group.add(m); return m; };
  const propsMat = stdMat();
  const manor = add(P.manor(place.id === 'vienna' ? undefined : STUCCO), HQ.x, HQ.z, 0, hqH); solid.push(manor);
  solid.push(add(P.gateWall(33, 7), CY.x1 + .3, -10, 0, hqH));
  add(P.fountain(), -174, -10, 0, hqH);
  add(P.awning(8, 5), -183, -21, 0, hqH);
  const tableM = add(P.mapTable(), -184, -21, 0, hqH), desk = add(P.writingDesk(), -178.5, -21.5, Math.PI, hqH);
  add(P.chest(), -175.4, -24.6, 0, hqH);
  add(P.hitchPost(), -163, 1.8, 0, hqH);
  for (const [x, z] of [[-156, -17.2], [-156, -2.8]]) add(P.pole(.1), x, z);
  colliders.push({ b: [-206.6, -193.4, -36.6, 16.6] }, { b: [-193.6, -159.4, -36.8, -26.4] }, { b: [-193.6, -159.4, 6.4, 16.8] }, { b: [-193.6, -191.4, -16.6, -3.4] },
    { b: [-159.8, -158.6, -27, -13.4] }, { b: [-159.8, -158.6, -6.6, 7] }, { c: [-174, -10, 3.7] }, { b: [-185.7, -182.3, -22.2, -19.8] }, { b: [-179.6, -177.4, -22.2, -20.6] }, { c: [-175.4, -24.6, .7] });
  // map texture from the project's own 1740 tiles (zoom 6, central Europe)
  const mapCanvas = document.createElement('canvas'); mapCanvas.width = 1536; mapCanvas.height = 1024; const mctx = mapCanvas.getContext('2d'); mctx.fillStyle = '#e6dabb'; mctx.fillRect(0, 0, 1536, 1024);
  const mapTex = new THREE.CanvasTexture(mapCanvas); mapTex.colorSpace = THREE.SRGBColorSpace; mapTex.anisotropy = 4;
  for (let tx = 32; tx < 38; tx++) for (let ty = 20; ty < 24; ty++) { const im = new Image(); im.onload = () => { mctx.drawImage(im, (tx - 32) * 256, (ty - 20) * 256); mapTex.needsUpdate = true; }; im.src = 'tiles1740/6/' + tx + '/' + ty + '.webp'; }
  const sheetMat = new THREE.MeshStandardMaterial({ map: mapTex, roughness: .95 });
  const addSheet = (x, y, z, w, h, parent = group) => { const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), sheetMat); s.position.set(x, y, z); s.receiveShadow = true; parent.add(s); return { x, y, z, w, h }; };
  const tables = [addSheet(-184, hqH + .995, -21, 3.0, 2.0)];

  // the road: bridge, shrine, signpost, fences
  const [bx, bz] = PP[iB], [bx2, bz2] = PP[iB + 1], bang = Math.atan2(-(bz2 - bz), bx2 - bx);
  solid.push(add(P.bridge(26, 4.4), bx, bz, bang, DECK + .02));
  const shrineAt = PP[Math.floor(PP.length * .5)]; add(P.shrine(), shrineAt[0] + 4.5, shrineAt[1] - 3.5, -.4); colliders.push({ c: [shrineAt[0] + 4.5, shrineAt[1] - 3.5, .6] });
  add(P.signpost(2), 152, 21, .5);
  for (let i = Math.floor(PP.length * .58); i < Math.floor(PP.length * .8); i += 6) { const [x0, z0] = PP[i], [x1, z1] = PP[i + 6] || PP[i], dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 1) continue; const ox = -dz / L * 4.6, oz = dx / L * 4.6; const g = add(P.fenceSeg(L), (x0 + x1) / 2 - ox, (z0 + z1) / 2 - oz, Math.atan2(-dz, dx)); g.position.y = hAt(g.position.x, g.position.z); }
  // vineyard on the south-west slope
  for (let r = 0; r < 6; r++) { const x = -95, z = 105 + r * 9; const g = add(P.vineRows(70, 1, 0), x, z, .15); g.position.y = hAt(x, z) - .1; }

  // the town: houses round the market square outside the gate and along the lanes behind the lodging, a church,
  // a plague column, stalls, and a gate with a stretch of wall where the road leaves the town
  const chimneys = [], spots = { market: null, gate: null };
  if (town) {
    const H = [], row = (x0, x1, z0, z1, ry) => { // fronts along a straight line; ry turns the house front (+z) to face the street
      const L = Math.hypot(x1 - x0, z1 - z0); let s = 0;
      while (s < L - 5) { const w = Math.min(L - s, 6 + Math.floor(rnd() * 4)), d = 11, f = (s + w / 2) / L, fx = x0 + (x1 - x0) * f, fz = z0 + (z1 - z0) * f, cx = fx - Math.sin(ry) * d / 2, cz = fz - Math.cos(ry) * d / 2;
        H.push(placeGeom(townHouse(w - .15, d, 2 + Math.floor(rnd() * 3), rnd), cx, hqH, cz, ry));
        const hw = Math.abs(Math.cos(ry)) > .5 ? [w / 2, d / 2] : [d / 2, w / 2]; colliders.push({ b: [cx - hw[0] - .2, cx + hw[0] + .2, cz - hw[1] - .2, cz + hw[1] + .2] });
        if (rnd() < .18) chimneys.push([cx, hqH + 13, cz, .45]); s += w; }
    };
    row(SQ.x0, SQ.x1, SQ.z0, SQ.z0, 0); row(SQ.x0, SQ.x1, SQ.z1, SQ.z1, Math.PI); row(SQ.x1, SQ.x1, SQ.z0, -4, -Math.PI / 2);
    row(-213, -162, -44, -44, 0); row(-213, -162, 24, 24, Math.PI); row(-214, -214, -44, 24, Math.PI / 2);
    const tg = add(merge(H), 0, 0, 0, 0); solid.push(tg);
    const chm = add(church(cfg.church), -130, -68, 0, hqH); solid.push(chm); colliders.push({ b: [-150, -110, -112, -60] });
    add(marianColumn(), -130, -26, 0, hqH); colliders.push({ c: [-130, -26, 3] });
    for (const [x, z, r] of [[-145, -33, 0], [-139, -33, 0], [-117, -33, 0], [-146, 15, Math.PI], [-120, 15, Math.PI]]) { add(stall(rnd), x, z, r, hqH); colliders.push({ b: [x - 1.6, x + 1.6, z - .9, z + .9] }); }
    for (const [x, z, r] of [[-112, -20, 1.2], [-150, 4, -.4]]) { add(P.wagon(), x, z, r, hqH); colliders.push({ c: [x, z, 2] }); }
    let gi = 0, gd = 1e9; PP.forEach(([x], i) => { if (Math.abs(x + 90) < gd) { gd = Math.abs(x + 90); gi = i; } }); const gz = PP[gi][1];
    const gate = merge([box(6, 12, 3.2, 0xe6dcc6, 0, 0, -5.2), box(6, 12, 3.2, 0xe6dcc6, 0, 0, 5.2), box(6, 5, 13.6, 0xe6dcc6, 0, 7, 0), box(6.4, .4, 14, 0xf1e9d8, 0, 12, 0), placeGeom(P.hipRoof(6, 13.6, 4, 0x8e4a34, .4), 0, 12.2, 0)]);
    solid.push(add(gate, -90, gz, 0, hqH));
    for (const [z0, z1] of [[TOWN.z0, gz - 6.8], [gz + 6.8, TOWN.z1]]) { const L = z1 - z0, W = [box(2.4, 6, L, 0xa89c84, 0, 0, 0), box(3, .5, L, 0xc8bea6, 0, 6, 0)]; for (let k = 4; k < L - 2; k += 8) W.push(box(1.2, 5.6, 1.6, 0x9a8e76, -1.6, 0, -L / 2 + k)); for (let k = 1; k < L - 1; k += 2.4) W.push(box(2.6, .9, 1.2, 0xb4aa92, 0, 6.5, -L / 2 + k)); add(merge(W), -90, (z0 + z1) / 2, 0, hqH); colliders.push({ b: [-91.4, -88.6, z0, z1] }); }
    colliders.push({ b: [-93, -87, gz - 6.8, gz - 3.4] }, { b: [-93, -87, gz + 3.4, gz + 6.8] });
    spots.market = [-134, -24]; spots.gate = [-94, gz - 6];
  }
  if (far0) { const g = cfg.skyline ? viennaSkyline(rnd) : landmark(cfg.landmark); if (g) { const m = add(g, far0.x, far0.z, cfg.skyline ? .5 : .55, farH - .5); m.castShadow = false; } }

  // camp
  const camp = new THREE.Group(); group.add(camp);
  const ch = campH, cadd = (geo, x, z, ry = 0) => { const m = new THREE.Mesh(geo, propsMat); m.position.set(x, ch, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; camp.add(m); return m; };
  const tentG = [P.tent(rngFrom(1)), P.tent(rngFrom(2))];
  const ROWS = cues.men ? Math.max(1, Math.min(6, Math.round(cues.men / 1200))) : cues.tempo === 'winter quarters' ? 2 : cues.tempo === 'campaigning' ? 6 : 4;
  for (let row = 0; row < ROWS; row++) for (let i = 0; i < 6; i++) { const x = 160 + i * 6.4, z = 36 + row * 8.5; cadd(tentG[(i + row) % 2], x, z, Math.PI / 2); colliders.push({ b: [x - 1.3, x + 1.3, z - 1.45, z + 1.45] }); if (i % 2 === 0) cadd(P.muskets(), x, z + 3.2); }
  cadd(P.marquee(), 204, 24, -Math.PI / 2); colliders.push({ b: [201.6, 206.4, 20.8, 27.2] });
  const fieldTable = cadd(P.mapTable(), 199, 24, Math.PI / 2); colliders.push({ b: [197.9, 200.1, 22.4, 25.6] });
  const fires = [[170, 72], [192, 69]];
  for (const [x, z] of fires) { cadd(P.campfire(), x, z); colliders.push({ c: [x, z, 1.1] }); for (let k = 0; k < 3; k++) { const a = k * 2.1 + .4; cadd(P.barrel(), x + Math.sin(a) * 2.6, z + Math.cos(a) * 2.6); } }
  for (let i = 0; i < 3; i++) { const x = 142 + i * 5, z = 62; cadd(P.cannon(), x, z, Math.PI * .9); colliders.push({ c: [x, z, 1.4] }); }
  for (let i = 0; i < 2; i++) { cadd(P.limber(), 144 + i * 7, 72, Math.PI); colliders.push({ c: [144 + i * 7, 72, 1.2] }); }
  for (const [x, z, r] of [[136, 34, .3], [134, 45, -.2]]) { cadd(P.wagon(), x, z, r); colliders.push({ c: [x, z, 2] }); }
  for (let i = 0; i < 5; i++) cadd(i % 2 ? P.crate() : P.barrel(), 139 + (i % 3) * 1, 52 + i * .9, i);
  cadd(P.hitchPost(), 217, 48, Math.PI / 2); cadd(P.hitchPost(), 217, 57, Math.PI / 2);
  cadd(P.pole(8), 182, 26); cadd(P.pole(6), 204, 29.5);
  const flagTex = P.flagTexture(); for (const [x, z, h, w] of [[182, 26, 8, 1.9], [204, 29.5, 6, 1.4]]) { const f = P.flagMesh(w, w * .72, flagTex, uTime); f.position.set(x + .06, ch + h - w * .38, z); camp.add(f); }

  // fire glow and smoke
  const fireLights = [], flames = [];
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [x, z] of fires) {
    const L = new THREE.PointLight(0xff9a40, 30, 16, 1.6); L.position.set(x, ch + 1.1, z); group.add(L); fireLights.push(L);
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.28 - k * .06, .9 - k * .15, 5), flameMat); f.position.set(x + (k - 1) * .15, ch + .55, z + (k % 2) * .12); group.add(f); flames.push(f); }
  }
  // the public place: the market square in a town, the road before headquarters at Vienna
  const PUB = town ? [-130, -8] : [-146, -8], pubY = (x, z) => town ? hqH : hAt(x, z), extraSmoke = [];
  if (tags.has('celebration')) { const [x, z] = [PUB[0] + 9, PUB[1] - 1], y = pubY(x, z);
    const L = new THREE.PointLight(0xff9a40, 30, 22, 1.6); L.position.set(x, y + 1.4, z); group.add(L); fireLights.push(L);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.55 - k * .1, 1.8 - k * .3, 5), flameMat); f.position.set(x + (k - 1.5) * .25, y + 1, z + (k % 2) * .2); group.add(f); flames.push(f); }
    colliders.push({ c: [x, z, 1.4] }); extraSmoke.push([x, y + 2, z, 1.6]); }
  if (tags.has('smoke')) extraSmoke.push([-80, 30, -440, 7], [140, 30, -400, 5.5], [40, 30, -470, 6]);
  const smoke = makeSmoke(group, [...extraSmoke, ...fires.map(([x, z]) => [x, ch + 1.2, z, 1]), [HQ.x - 2, hqH + 15.5, HQ.z - 16, .6], [HQ.x - 2, hqH + 15.5, HQ.z + 4, .6], ...chimneys.slice(0, 5)]);

  /* ---------- people and animals ---------- */
  const live = [];
  const person = (kind, x, z, ry, anim, y, look) => { const p = makePerson(kind, look); p.obj.position.set(x, y ?? hAt(x, z), z); p.obj.rotation.y = ry; p.play(anim, 0); p.mixer.update(rnd() * 3); group.add(p.obj); live.push(p); return p; };
  const horse = (which, x, z, ry, anim, saddle) => { const h = makeHorse(which, { saddle }); h.obj.position.set(x, hAt(x, z), z); h.obj.rotation.y = ry; h.play(anim, 0); h.mixer.update(rnd() * 3); group.add(h.obj); live.push(h); colliders.push({ c: [x, z, 1.4] }); return h; };
  const adviser = person('adviser', -184.6, -23.2, Math.PI * .1, 'Idle_Talking_Loop', hqH); colliders.push({ c: [-184.6, -23.2, .5] });
  person('clerk', -178.5, -20.3, Math.PI, 'Sitting_Idle_Loop', hqH - .02); // at the writing desk
  for (const [x, z] of [[-156, -15.5], [-156, -4.5]]) { person('infantry', x, z, Math.PI / 2, 'Idle_Loop'); colliders.push({ c: [x, z, .5] }); }
  const courier = person('courier', -165, -1, Math.PI * 1.1, 'Idle_Loop', hqH); colliders.push({ c: [-165, -1, .5] });
  const hitched = horse(actors.hb, -163, 3.6, Math.PI / 2, 'Idle_2', true);
  person('infantry', 154, 18, Math.PI * .6, 'Idle_Loop'); person('infantry', 156, 31, Math.PI * .4, 'Idle_Loop');
  const officer = person('aide', 186, 28, -Math.PI / 2, 'Idle_Talking_Loop', ch); colliders.push({ c: [186, 28, .5] });
  for (const [x, z] of fires) for (let k = 0; k < 3; k++) { const a = k * 2.1 + 1.45, px = x + Math.sin(a) * 2.5, pz = z + Math.cos(a) * 2.5; person(k === 2 ? 'gunner' : 'infantry', px, pz, a + Math.PI, k === 1 ? 'Idle_Torch_Loop' : 'Sitting_Idle_Loop', ch + (k === 1 ? 0 : .38)); }
  person('infantry', 168, 51.5, 0, 'Fixing_Kneeling', ch); person('gunner', 147.5, 64, Math.PI * .8, 'Fixing_Kneeling', ch);
  person('infantry', 175, 33, Math.PI / 2, 'Walk_Formal_Loop', ch).patrol = { a: [158, 33], b: [198, 33], v: 1.2 };
  for (let i = 0; i < 4; i++) horse(i % 2 ? actors.hw : actors.hb, 219, 46 + i * 3.6, -Math.PI / 2, ['Eating', 'Idle', 'Idle_2', 'Idle_Headlow'][i], i < 2);
  for (let i = 0; i < 7; i++) { const a = makeAnimal(actors.sh, 1.05); const x = 70 + rnd() * 24, z = 44 + rnd() * 16; a.obj.position.set(x, hAt(x, z), z); a.obj.rotation.y = rnd() * 6; a.play(rnd() < .6 ? 'Idle_Eating' : 'Idle', 0); a.mixer.update(rnd() * 4); group.add(a.obj); live.push(a); }
  { const d = makeAnimal(actors.dg, .62); d.obj.position.set(172.5, ch, 69); d.obj.rotation.y = 2; d.play('Idle', 0); group.add(d.obj); live.push(d); }

  const v3 = (x, z, y) => new THREE.Vector3(x, (y ?? hAt(x, z)) + 1, z);
  // the people who are here: you can walk up and speak with them (cast from the campaign state; soldiers' roles in camp)
  const reports = (typeof state !== 'undefined' && state.reports) || [], talk = [], present = {}, MIL = new Set(['neipperg', 'wallis', 'inf-general', 'cav-general', 'art-officer', 'quartermaster']);
  const COURT = [[-183, 2, 2.4], [-180.4, 3.6, -2.2], [-170, -20.5, 3.4], [-166.6, -17.6, -2.4], [-186, -3, 1.6], [-171, 3.6, 3.1], [-176.6, 4.4, 2.9], [-168, -24.6, .5], [-162.6, -21, -1.5], [-162.6, -24.4, -1.2], [-188.5, 3.6, 2.4], [-173.5, -15.8, 0]], CAMPS = [[192, 37, -1.8], [195.6, 39.4, -2.5], [150, 48, .8], [146, 44, 2.2]];
  let ci = 0, mi = 0;
  const GSP = [[-183.4, 1.2], [-172.2, -22.4], [-166, 0]], OFF = [[-.8, 0], [.8, 0], [0, .9], [0, -.9]], groups = (cues.groups || []).slice(0, GSP.length), inGroup = {};
  groups.forEach((g, gi) => g.who.filter(id => people.some(p => p.id === id)).forEach((id, k) => { if (k < OFF.length) inGroup[id] = { g, sp: [GSP[gi][0] + OFF[k][0], GSP[gi][1] + OFF[k][1], Math.atan2(-OFF[k][0], -OFF[k][1])] }; }));
  for (const c of people) {
    const grp = inGroup[c.id], mil = MIL.has(c.id) && mode === 'field' && !grp, sp = grp ? grp.sp : mil ? CAMPS[mi++] : COURT[ci++]; if (!sp) continue;
    const look = personOf(c.id).look, gen = MIL.has(c.id) ? (c.id === 'quartermaster' ? 'clerk' : 'general') : cues.mourning ? (ci % 2 ? 'mourner' : 'mournerHat') : (ci % 2 ? 'minister' : 'courtier');
    const kind = look ? (cues.mourning && (look.kind === 'minister' || look.kind === 'courtier') ? 'mourner' : look.kind) : gen;
    const st = (cues.standing || {})[c.id], away = st === 'cool' || st === 'hostile'; // how they stand towards you shows; it is never counted
    const y = mil ? ch : hqH, p = person(kind, sp[0], sp[1], sp[2] + (away ? Math.PI : 0), away ? 'Idle_Loop' : 'Idle_Talking_Loop', y, look); colliders.push({ c: [sp[0], sp[1], .5] }); p.hours = [8.5, 18]; p.cid = c.id;
    const manner = { warm: 'greets you warmly', cool: 'keeps a polite distance', hostile: 'turns away as you approach' }[st];
    const withWhom = grp ? grp.g.who.filter(id => id !== c.id).map(id => (people.find(x => x.id === id) || (cues.castNames || {})[id] && { name: cues.castNames[id] } || { name: id }).name.split(',')[0]).join(' and ') : '';
    if (grp) p.play('Idle_Talking_Loop', 0);
    talk.push({ id: 'talk:' + c.id, pos: v3(sp[0], sp[1], y), r: 1.9, label: 'Give orders to ' + c.name, hint: grp ? (withWhom ? 'with ' + withWhom : '') + (grp.g.doing ? (withWhom ? ' — ' : '') + grp.g.doing : '') : manner || ((c.office || '') + (reports.some(r => r.from_id === c.id) ? ' · has written to you' : '')), act: 'talk:' + c.id, obj: p.obj, who: p });
    present[c.id] = p;
  }
  // what you can only overhear in person: two of those present, standing together (lines come from the reply: state.overheard)
  const PAIR = [[-177.2, -.6, 1.2], [-175.4, .8, -2]], heard = [];
  for (const o of cues.overheard || []) { const [a, b] = (o.who || []).map(id => present[id]); if (!a || !b) continue;
    for (const [p, [x, z, r]] of [[a, PAIR[0]], [b, PAIR[1]]]) { p.obj.position.set(x, hqH, z); p.obj.rotation.y = r; p.play('Idle_Talking_Loop', 0); const it = talk.find(i => i.who === p); it.pos.set(x, hqH + 1, z); }
    heard.push({ o, at: [(PAIR[0][0] + PAIR[1][0]) / 2, (PAIR[0][1] + PAIR[1][1]) / 2], done: false }); break; }
  if (place.id === 'vienna') { const p = person(cues.mourning ? 'mournerHat' : 'courtier', -189.4, -14.8, 1.4, 'Idle_Loop', hqH); colliders.push({ c: [-189.4, -14.8, .5] }); talk.push({ id: 'chamberlain', pos: v3(-189.4, -14.8, hqH), r: 1.8, label: 'Request an audience at the Hofburg', hint: cues.rulerWith || 'The chamberlain carries it to the Archduchess or the Grand Duke', act: cues.dismissed ? 'toast:The chamberlain regrets that Her Majesty is not receiving you.' : 'chamberlain', obj: p.obj }); }
  { const p = person('clerk', -168.6, 4.4, 2.6, 'Idle_Loop', hqH); colliders.push({ c: [-168.6, 4.4, .5] }); talk.push({ id: 'steward', pos: v3(-168.6, 4.4, hqH), r: 1.8, label: 'Tell your steward where you are going', hint: 'Travel: you leave at once; the journey goes into your orders', act: 'travel', obj: p.obj }); }
  // townsfolk going about the square and the lanes; a few on the road out of Vienna
  const FOLK = ['burgher', 'woman', 'labourer', 'lady', 'woman', 'burgher', 'labourer', 'woman', 'burgher', 'lady'];
  const walks = town ? [[[-150, -36], [-110, -36]], [[-112, 18], [-152, 18]], [[-150, -14], [-112, -2]], [[-140, 10], [-140, -34]], [[-120, -36], [-120, 16]], [[-210, -40], [-165, -40]], [[-165, 29], [-210, 29]], [[-108, -30], [-108, 0]]] : [[[-140, -6], [-60, 12]], [[-20, 0], [-120, -2]]];
  (tags.has('empty_market') ? walks.slice(0, 2) : walks).forEach(([a, b], i) => { const p = person(FOLK[i % FOLK.length], a[0], a[1], 0, 'Walk_Loop', town ? hqH : undefined); p.patrol = { a, b, v: 1.1 + rnd() * .4, ground: !town }; });
  if (town && !tags.has('empty_market')) for (const [x, z, r, k] of [[-145, -30.8, Math.PI, 'woman'], [-139, -31, Math.PI + .3, 'burgher'], [-117, -30.9, Math.PI, 'lady'], [-146, 12.9, 0, 'labourer'], [-120, 12.8, -.2, 'woman'], [-133, -21.5, 2.6, 'burgher'], [-131, -21, -2.4, 'labourer']]) { person(k, x, z, r, 'Idle_Talking_Loop', hqH); colliders.push({ c: [x, z, .45] }); }

  // people on the road: refugees heading for the town, deserters slipping out of an unpaid camp (they walk the road, then start again)
  const walkRoad = (kind, pts, v, k) => { const p = person(kind, pts[0][0], pts[0][1], 0, 'Walk_Loop'); p.follow = { pts, i: Math.floor(k * pts.length * .9), v }; const [x, z] = pts[p.follow.i]; p.obj.position.set(x, hAt(x, z), z); return p; };
  if (cues.refugees) { const back = [...PP].reverse().map(([x, z], i) => [x + Math.sin(i) * 1.1, z + Math.cos(i * 1.3) * 1.1]); for (let i = 0; i < 7; i++) walkRoad(['labourer', 'woman', 'labourer', 'woman', 'burgher', 'woman', 'labourer'][i], back, .8 + rnd() * .3, i / 7); }
  if (cues.pay === 'unpaid') { const out = [[176, 40], [196, 52], [222, 66], [252, 84]]; for (let i = 0; i < 2; i++) walkRoad('infantry', out, 1.0, i / 2); }
  const drilling = cues.pay !== 'unpaid' && cues.pay !== 'in arrears' && cues.tempo !== 'winter quarters';
  // the scene tags: what the adjudicator says has changed about this place
  const at = (x, z, kind, ry, anim) => { const p = person(kind, x, z, ry, anim, pubY(x, z)); colliders.push({ c: [x, z, .45] }); return p; };
  if (tags.has('alarm')) { for (const [x, z] of [[-157, -17.5], [-157, -2.5], [-154, -12], [-154, -8]]) at(x, z, 'infantry', Math.PI / 2, 'Idle_Loop'); const g = person('infantry', PUB[0], PUB[1] - 6, 0, 'Walk_Formal_Loop', pubY(PUB[0], PUB[1])); g.patrol = { a: [PUB[0] - 14, PUB[1] - 6], b: [PUB[0] + 14, PUB[1] - 6], v: 1.2, ground: !town }; }
  if (tags.has('idle_soldiers')) [[-3, 5, 1], [-1.5, 6, 2.6], [0, 4.6, -2], [9, -3, .4], [10.5, -2, 3]].forEach(([dx, dz, r], i) => at(PUB[0] + dx, PUB[1] + dz, 'infantry', r, i % 2 ? 'Idle_Talking_Loop' : 'Idle_Loop'));
  if (tags.has('bread_queue')) for (let i = 0; i < 9; i++) at(PUB[0] - 12 + i * .9, PUB[1] - 13 + (i % 2) * .25, ['woman', 'labourer', 'burgher', 'woman', 'lady', 'labourer', 'woman', 'burgher', 'woman'][i], -Math.PI / 2, i % 3 ? 'Idle_Loop' : 'Idle_Talking_Loop');
  if (tags.has('recruiting')) { at(PUB[0] - 4, PUB[1] + 8, 'aide', -Math.PI / 2, 'Idle_Talking_Loop'); at(PUB[0] - 4, PUB[1] + 9.4, 'infantry', -Math.PI / 2, 'Idle_Loop'); for (let i = 0; i < 4; i++) at(PUB[0] - 6.5, PUB[1] + 6 + i * .9, 'labourer', Math.PI / 2, 'Idle_Loop'); }
  if (tags.has('wounded')) { [[126, 50, .3], [128, 53, 2], [125, 55, -1], [130, 57, 1.2], [123, 48, 2.8], [131, 49, -2.4]].forEach(([x, z, r]) => { person('infantry', x, z, r, 'Sitting_Idle_Loop', ch + .38); colliders.push({ c: [x, z, .5] }); }); cadd(P.wagon(), 121, 55, 1.2); colliders.push({ c: [121, 55, 2] }); }
  if (tags.has('prisoners')) { const road = [...PP].reverse().map(([x, z], i) => [x + Math.sin(i * .7) * .6, z]); for (let i = 0; i < 10; i++) walkRoad(i % 4 === 0 ? 'infantry' : 'gunner', road, .9, i / 40); }
  // your last dispatch, carried out where you can see it (cues.carried, the first day after a reply): a column marching out,
  // wagons leaving, a messenger riding off. A rider leaving at dawn is your rival's courier.
  const outRoad = [...PP, [PP[PP.length - 1][0] + 60, PP[PP.length - 1][1] + 30], [PP[PP.length - 1][0] + 200, PP[PP.length - 1][1] + 120]];
  const fromGate = [[-163, 1], [-156, -8], ...outRoad];
  const movers = [], mover = (obj, pts, v, at, hours) => { obj.position.set(pts[0][0], 0, pts[0][1]); group.add(obj); movers.push({ obj, pts, i: 0, v, at, hours }); obj.visible = false; };
  const c = cues.carried || {};
  if (c.march) for (let i = 0; i < 12; i++) { const p = person('infantry', CAMP.x, CAMP.z, 0, 'Walk_Formal_Loop'); p.road = { pts: [[CAMP.x - 10, CAMP.z - 14], ...outRoad.slice(-12)], i: 0, v: 1.25, delay: Math.floor(i / 3) * 2.2 + (i % 3) * .2, off: (i % 3 - 1) * .9 }; }
  if (tags.has('wagons_in')) { const inRoad = [...outRoad].reverse(); for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(P.wagon(), propsMat); w.castShadow = false; mover(w, inRoad, 1.6, i * 9); } }
  if (c.supply) for (let i = 0; i < 2; i++) { const w = new THREE.Mesh(P.wagon(), propsMat); w.castShadow = false; mover(w, [[140, 44], ...outRoad.slice(-14)], 1.6, i * 7); }
  const rider = () => { const h = makeHorse(actors.hb, { saddle: true }); h.play('Gallop', 0); const sb = new THREE.Box3().setFromObject(h.obj, true), m = new THREE.Mesh(riderGeo({ coat: 0x5a6a3a, facing: 0xa3302a, breeches: 0xd8cdb4, hat: 0x1a1612, trim: 0xf2eee4 }, false), propsMat); m.position.set((sb.min.x + sb.max.x) / 2, sb.min.y + (sb.max.y - sb.min.y) * .66 + .1, (sb.min.z + sb.max.z) / 2); h.obj.add(m); live.push(h); return h; };
  if (c.letters) { const h = rider(); mover(h.obj, fromGate, 8.5, 1); }
  if (tags.has('celebration')) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, x = PUB[0] + 9 + Math.sin(a) * 4.2, z = PUB[1] - 1 + Math.cos(a) * 4.2; at(x, z, ['burgher', 'woman', 'labourer', 'lady', 'infantry'][i % 5], a + Math.PI, i % 2 ? 'Idle_Talking_Loop' : 'Idle_Loop'); }
  if (cues.rivalHere) { const h = rider(); mover(h.obj, fromGate, 8.5, 0, [5.5, 8.5]); }
  // court mourning: black cloth on the gate pillars and over the main door
  if (cues.mourning) { for (const z of [-14.15, -5.85]) add(box(1.45, 2.4, 1.45, 0x151313), CY.x1 + .3, z, 0, hqH + 1.3); add(box(.25, 4.2, 4.6, 0x151313), -191.2, -10, 0, hqH + 3.2); }
  // lanterns at the gate: lit at night
  const lanterns = []; for (const z of [-14.15, -5.85]) { const L = new THREE.PointLight(0xffb060, 0, 22, 1.6); L.position.set(CY.x1 - .6, hqH + 4.2, z); group.add(L); lanterns.push(L); const f = new THREE.Mesh(new THREE.ConeGeometry(.16, .5, 5), flameMat); f.position.set(CY.x1 - .6, hqH + 4.15, z); f.visible = false; group.add(f); lanterns.push(f); }
  const setNight = on => { for (const l of lanterns) { if (l.isLight) l.intensity = on ? 40 : 0; else l.visible = on; } };
  // falling snow near the camera
  let snow = null; if (winter && !cues.ownWeather) { const n = 1800, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (rnd() - .5) * 80; pos[i * 3 + 1] = rnd() * 40; pos[i * 3 + 2] = (rnd() - .5) * 80; } g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); snow = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: .12, transparent: true, opacity: .85, depthWrite: false })); snow.frustumCulled = false; group.add(snow); }

  // a company at drill and a rank paraded by the colours: instanced figures, cheap
  const drill = new FramePool(infantryFrames('A'), 64, stdMat({ roughness: .85 })); drill.setShadow(false); group.add(drill.group);
  const dm4 = new THREE.Matrix4(), dq = new THREE.Quaternion(), dv = new THREE.Vector3(), d1 = new THREE.Vector3(1, 1, 1), upY = new THREE.Vector3(0, 1, 0);
  const drillStep = t => {
    drill.begin();
    const L = 36, sp = 1.1, cyc = (t * sp) % (2 * L + 6), back = cyc > L + 3, s = back ? (2 * L + 6 - cyc) : cyc, turning = cyc > L && cyc < L + 6;
    const dir = back ? -1 : 1, cx = 158 + Math.min(L, Math.max(0, s));
    dq.setFromAxisAngle(upY, turning ? Math.PI / 2 * (1 + (back ? 1 : 0)) : dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    for (let r = 0; r < 3; r++) for (let f = 0; f < 8; f++) {
      const x = cx - dir * r * 1.4, z = 84 + f * 1.1, frame = turning ? 0 : 1 + Math.floor((t * 1.6 + r * .02) * 6) % 6;
      dm4.compose(dv.set(x, ch, z), dq, d1); drill.push(frame, dm4);
    }
    dq.setFromAxisAngle(upY, 0);
    for (let f = 0; f < 14; f++) { dm4.compose(dv.set(170 + f * 1.1, ch, 17), dq, d1); drill.push(Math.sin(t * .3 + f) > .97 ? 7 : 0, dm4); }
    drill.end();
  };
  drillStep(0); drill.group.visible = drilling; // an unpaid company does not drill

  /* ---------- interaction points: each opens the existing desk ---------- */
  const interact = [
    { id: 'map', pos: v3(-184, -19.2, hqH), r: 2.4, label: 'Study the maps', hint: 'Open the campaign map', act: 'map', obj: tableM },
    { id: 'orders', pos: v3(-178.5, -23.2, hqH), r: 2.6, label: 'Write the orders of the day', hint: 'Orders', act: 'orders', obj: desk },
    { id: 'council', pos: v3(-186.4, -22.6, hqH), r: 2, label: 'Consult your adviser', hint: 'Council', act: 'council', obj: adviser.obj },
    { id: 'record', pos: v3(-175.4, -24.6, hqH), r: 2.2, label: 'Your archive of letters', hint: 'Every letter that has reached you', act: 'archive' },
    { id: 'reports', pos: v3(-165, -1, hqH), r: 2.8, label: 'Take the courier’s reports', hint: 'Reports received', act: 'reports', obj: courier.obj },
    { id: 'staff', pos: v3(186, 28, ch), r: 2.8, label: 'Hear the officer of the day', hint: 'What your staff knows', act: 'staff', obj: officer.obj },
    { id: 'hall', pos: v3(-190.2, -10, hqH), r: 2.4, label: 'Enter the Conference chamber', hint: cues.dismissed ? 'The doors stay closed to you' : 'Your advisers’ counsel', act: cues.dismissed ? 'toast:The Conference meets without you now.' : 'hall' },
    { id: 'campmap', pos: v3(197, 24, ch), r: 2.6, label: 'Study the field map', hint: 'Campaign map', act: 'map', obj: fieldTable },
    { id: 'battle', pos: v3(184, 27.5, ch), r: 3, label: 'Ride out to the field (table battle)', hint: 'Battlefield', act: 'battle' },
    { id: 'muster', pos: v3(166, 78, ch), r: 4, label: 'Inspect the companies at drill', hint: 'See for yourself: men present, arms, drill', act: 'inspect:muster' },
    { id: 'stores', pos: v3(138, 40, ch), r: 3.5, label: 'Look over the wagons and stores', hint: 'See for yourself: bread, forage, powder', act: 'inspect:stores' },
    ...talk,
  ];
  if (spots.market) interact.push({ id: 'market', pos: v3(spots.market[0], spots.market[1], hqH), r: 4.5, label: 'Listen to the talk of the market', hint: 'Prices, rumours, the mood of the town', act: 'inspect:market' });
  if (spots.gate) interact.push({ id: 'walls', pos: v3(spots.gate[0], spots.gate[1], hqH), r: 4, label: 'Walk the walls and the gate', hint: 'See the defences for yourself', act: 'inspect:walls' });

  const zoneName = (x, z) => rectD(x, z, -212, -150, -42, 22) < 2 ? cfg.lodging + ' · ' + place.name : town && rectD(x, z, SQ.x0, SQ.x1, SQ.z0, SQ.z1) < 1 ? 'The market square · ' + place.name : town && rectD(x, z, TOWN.x0, TOWN.x1, TOWN.z0, TOWN.z1) < 1 ? 'The streets of ' + place.name
    : Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r + 8 ? (mode === 'field' ? 'The army’s camp near ' : 'Camp of the garrison of ') + place.name : riverD(x, z, 30)[0] < 22 ? 'Crossing ' + cfg.river : town ? 'The road out of ' + place.name : 'The road to the camp';

  /* ---------- the courier: rides out with the sealed orders, back with the reply ---------- */
  const route = [[-163, 1], [-156, -8], ...PP.map(([x, z]) => [x, z])];
  { const [ax, az] = PP[PP.length - 2], [bx, bz] = PP[PP.length - 1], L = Math.hypot(bx - ax, bz - az); route.push([bx + (bx - ax) / L * 60, bz + (bz - az) / L * 60 + 30], [bx + (bx - ax) / L * 220, bz + (bz - az) / L * 220 + 140]); }
  const cum = [0]; for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
  const routeLen = cum[cum.length - 1];
  const steed = makeHorse(actors.hb, { saddle: true }); steed.play('Gallop', 0); steed.obj.visible = false; group.add(steed.obj);
  { const sb = new THREE.Box3().setFromObject(steed.obj, true), g = riderGeo({ coat: 0x5a6a3a, facing: 0xa3302a, breeches: 0xd8cdb4, hat: 0x1a1612, trim: 0xf2eee4 }, false); const m = new THREE.Mesh(g, propsMat); m.position.set((sb.min.x + sb.max.x) / 2, sb.min.y + (sb.max.y - sb.min.y) * .66 + .1, sb.min.z + (sb.max.z - sb.min.z) * .5); steed.obj.add(m); }
  const courierRide = { state: 'home', s: 0, onArrive: null }, pace = cues.roads === 'impassable' ? .3 : cues.roads === 'heavy' ? .55 : 1;
  const setHome = home => { courier.obj.visible = home; hitched.obj.visible = home; };
  const atS = s => { let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), [ax, az] = route[i - 1], [bx, bz] = route[i]; return [ax + (bx - ax) * f, az + (bz - az) * f, Math.atan2(bx - ax, bz - az)]; };
  courierRide.depart = instant => { setHome(false); if (instant) { courierRide.state = 'away'; steed.obj.visible = false; return; } courierRide.state = 'out'; courierRide.s = 0; steed.obj.visible = true; };
  courierRide.arriveAt = (px, pz, cb) => { const a = Math.atan2(px - 160, pz - 30) + Math.PI, sx = px + Math.sin(a) * 160, sz = pz + Math.cos(a) * 160; const ex = px + Math.cos(a) * 3, ez = pz - Math.sin(a) * 3; courierRide.direct = { sx, sz, px: ex, pz: ez, s: 0, L: Math.hypot(ex - sx, ez - sz) - 5 }; courierRide.onArrive = cb || null; courierRide.state = 'in'; steed.obj.visible = true; setHome(false); };
  courierRide.arrive = (instant, cb) => { courierRide.direct = null; courierRide.onArrive = cb || null; if (instant) { courierRide.state = 'home'; steed.obj.visible = false; setHome(true); return; } courierRide.state = 'in'; courierRide.s = Math.min(routeLen, 220); steed.obj.visible = true; setHome(false); };
  function stepCourier(dt) {
    const c = courierRide;
    if (c.state === 'wait') { c.waitT -= dt; steed.play('Idle', .4); steed.mixer.update(dt); if (c.waitT <= 0) { c.state = 'home'; steed.obj.visible = false; setHome(true); } return; }
    if (c.state === 'in' && c.direct) { // ride straight to the commander, rein in, then return to the gate unseen
      const D = c.direct; D.s = Math.min(D.L, D.s + 9 * pace * dt); const f = D.s / D.L, x = D.sx + (D.px - D.sx) * f, z = D.sz + (D.pz - D.sz) * f;
      steed.obj.position.set(x, groundAt(x, z), z); steed.obj.rotation.y = Math.atan2(D.px - D.sx, D.pz - D.sz); steed.play(D.L - D.s < 14 ? 'Walk' : 'Gallop', .3); steed.mixer.update(dt);
      if (D.s >= D.L) { c.direct = null; c.state = 'wait'; c.waitT = 6; c.onArrive && c.onArrive(); } return;
    }
    if (c.state !== 'out' && c.state !== 'in') return;
    c.s += (c.state === 'out' ? 1 : -1) * 9 * pace * dt;
    if (c.state === 'out' && c.s >= Math.min(routeLen, 260)) { c.state = 'away'; steed.obj.visible = false; return; }
    if (c.state === 'in' && c.s <= 0) { c.state = 'home'; steed.obj.visible = false; setHome(true); c.onArrive && c.onArrive(); return; }
    const [x, z, a] = atS(Math.max(0, Math.min(routeLen, c.s))); steed.obj.position.set(x, groundAt(x, z), z); steed.obj.rotation.y = c.state === 'out' ? a : a + Math.PI;
    steed.play(Math.min(c.s, routeLen - c.s) < 12 ? 'Walk' : 'Gallop', .3); steed.mixer.update(dt);
  }

  // unread letters on the dispatch desk, each with a red seal
  const letterG = merge([box(.3, .012, .22, 0xf3ecd8, 0, 0, 0), box(.05, .02, .05, 0xa3302a, 0, .006, 0)]), letters = new THREE.InstancedMesh(letterG, propsMat, 10); letters.count = 0; letters.castShadow = true; group.add(letters);
  // the pigeonholes of the writing desk fill as your archive grows
  const pigeon = new THREE.InstancedMesh(merge([box(.2, .1, .16, 0xece2c8, 0, 0, 0), box(.04, .101, .161, 0x8a2f26, .05, 0, 0)]), propsMat, 30); pigeon.count = 0; group.add(pigeon);
  const setArchive = n => { const d = new THREE.Object3D(); pigeon.count = Math.min(30, n); for (let i = 0; i < pigeon.count; i++) { const cell = i % 10, layer = Math.floor(i / 10); d.position.set(-178.5 + .6 - (cell % 5) * .3, hqH + .87 + Math.floor(cell / 5) * .22 + layer * .05, -21.5 + .3); d.rotation.set(0, (i * .37) % .3 - .15, 0); d.updateMatrix(); pigeon.setMatrixAt(i, d.matrix); } pigeon.instanceMatrix.needsUpdate = true; };
  const setLetters = n => { const d = new THREE.Object3D(); letters.count = Math.min(10, n); for (let i = 0; i < letters.count; i++) { d.position.set(-178.9 + (i % 3) * .07, hqH + .82 + i * .014, -21.35 + (i % 2) * .05); d.rotation.set(0, i * .37, 0); d.updateMatrix(); letters.setMatrixAt(i, d.matrix); } letters.instanceMatrix.needsUpdate = true; };

  const tmpV = new THREE.Vector3();
  // the hour of the day (main.js): people keep hours, the Conference sits in the evening
  let hour = 9;
  const hallItem = () => interact.find(i => i.id === 'hall');
  function setHour(h) {
    hour = h; for (const a of live) if (a.hours) a.off = h < a.hours[0] || h > a.hours[1];
    const it = hallItem(); if (it && !cues.dismissed) it.hint = h >= 16 && h <= 21 ? 'The Conference sits this evening' : 'Your advisers’ counsel';
  }
  function update(dt, t, cam, pl) {
    stepCourier(dt);
    for (const m of movers) { // carts and riders on the road: once, then gone
      if (m.done || (m.hours && (hour < m.hours[0] || hour > m.hours[1]))) { m.obj.visible = false; continue; }
      if ((m.at -= dt) > 0) continue; const [tx, tz] = m.pts[m.i], o = m.obj.position, dx = tx - o.x, dz = tz - o.z, L = Math.hypot(dx, dz);
      m.obj.visible = true; if (L < 1) { if (++m.i >= m.pts.length) { m.done = true; m.obj.visible = false; } continue; }
      o.x += dx / L * m.v * dt; o.z += dz / L * m.v * dt; o.y = groundAt(o.x, o.z); m.obj.rotation.y = Math.atan2(dx, dz);
    }
    if (pl) for (const h of heard) if (!h.done && Math.hypot(pl.x - h.at[0], pl.z - h.at[1]) < 5 && hour >= 8.5 && hour <= 18) { h.done = true; out.onOverhear && out.onOverhear(h.o); }
    for (const a of live) {
      const d = a.obj.position.distanceToSquared(cam.position);
      if (a.road) { const r = a.road; if ((r.delay -= dt) > 0 || r.done) { a.obj.visible = false; continue; } const [tx, tz] = r.pts[r.i], o = a.obj.position, dx = tx + r.off - o.x, dz = tz - o.z, L = Math.hypot(dx, dz); if (L < .8) { if (++r.i >= r.pts.length) { r.done = true; a.obj.visible = false; continue; } } else { o.x += dx / L * r.v * dt; o.z += dz / L * r.v * dt; o.y = groundAt(o.x, o.z); a.obj.rotation.y = Math.atan2(dx, dz); } }
      a.obj.visible = !a.off && d < 260 * 260;
      if (a.follow) { const f = a.follow, o = a.obj.position, [tx, tz] = f.pts[f.i], dx = tx - o.x, dz = tz - o.z, L = Math.hypot(dx, dz); if (L < .6) { f.i++; if (f.i >= f.pts.length) { f.i = 0; o.set(f.pts[0][0], 0, f.pts[0][1]); } } else { o.x += dx / L * f.v * dt; o.z += dz / L * f.v * dt; a.obj.rotation.y = Math.atan2(dx, dz); } o.y = groundAt(o.x, o.z); }
      if (a.patrol) { const p = a.patrol, o = a.obj.position, tgt = p.flip ? p.b : p.a, dx = tgt[0] - o.x, dz = tgt[1] - o.z, L = Math.hypot(dx, dz); if (L < .5) p.flip = !p.flip; else { o.x += dx / L * p.v * dt; o.z += dz / L * p.v * dt; a.obj.rotation.y = Math.atan2(dx, dz); if (p.ground) o.y = groundAt(o.x, o.z); } }
      if (d < 35 * 35) a.mixer.update(dt); // further off, animate less often
      else if (d < 120 * 120) { a.lag = (a.lag || 0) + dt; a.tick = (a.tick || 0) + 1; if (a.tick % (d < 70 * 70 ? 2 : 3) === 0) { a.mixer.update(a.lag); a.lag = 0; } }
    }
    for (let i = 0; i < fireLights.length; i++) fireLights[i].intensity = 26 + Math.sin(t * 13 + i) * 4 + Math.sin(t * 7.3 + i * 2) * 3;
    flames.forEach((f, i) => { f.scale.set(1, .8 + Math.sin(t * 11 + i * 1.7) * .25, 1); f.rotation.y = t * 2 + i; });
    smoke.update(dt);
    if (drilling && Math.hypot(cam.position.x - CAMP.x, cam.position.z - CAMP.z) < 320) drillStep(t);
    if (snow) { const p = snow.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) - dt * 1.6; if (y < 0) y += 40; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * .7 + i) * dt * .3); } p.needsUpdate = true; snow.position.set(Math.round(cam.position.x / 20) * 20, cam.position.y - 20, Math.round(cam.position.z / 20) * 20); }
    water.position.y = Math.sin(t * .6) * .03;
  }

  // walkability: water outside the bridge, buildings, props
  const blockedAt = (x, z) => {
    if (Math.abs(x) > 262 || Math.abs(z) > 202) return true;
    const [dP] = pathD(x, z, 10), y = hAt(x, z);
    if (y < .35 && dP > 2.4) return true;
    for (const c of colliders) {
      if (c.b) { if (x > c.b[0] && x < c.b[1] && z > c.b[2] && z < c.b[3]) return true; }
      else if ((x - c.c[0]) ** 2 + (z - c.c[1]) ** 2 < c.c[2] ** 2) return true;
    }
    return false;
  };
  // ground under the player: the bridge deck where it spans the water
  const groundAt = (x, z) => { const [dP, t] = pathD(x, z, 10), y = hAt(x, z); return (dP < 2.4 && Math.abs(t - iB) * 2 < 13) ? Math.max(y, DECK + .14) : y; };

  tables.push(addSheet(199, ch + .995, 24, 1.8, 1.2)); // on the commander's field table in the camp
  // anywhere else: the aide sets up a folding table with the field map
  let portable = null;
  const setUpTable = (x, z, ry) => {
    if (portable) { group.remove(portable.g); }
    const g = new THREE.Group(), y = groundAt(x, z);
    const legs = new THREE.Mesh(merge([box(1.6, .06, 1.1, 0x8a6440, 0, .78, 0), placeGeom(tint(new THREE.BoxGeometry(.05, 1.1, .05), 0x5a3a20), -.6, .4, 0, 0, 1, 1, 1, .6), placeGeom(tint(new THREE.BoxGeometry(.05, 1.1, .05), 0x5a3a20), -.6, .4, 0, 0, 1, 1, 1, -.6), placeGeom(tint(new THREE.BoxGeometry(.05, 1.1, .05), 0x5a3a20), .6, .4, 0, 0, 1, 1, 1, .6), placeGeom(tint(new THREE.BoxGeometry(.05, 1.1, .05), 0x5a3a20), .6, .4, 0, 0, 1, 1, 1, -.6), box(.5, .3, .35, 0x5c3b22, .5, 0, .8)]), propsMat);
    legs.castShadow = legs.receiveShadow = true; g.add(legs); g.position.set(x, y, z); group.add(g);
    const pose = addSheet(0, .845, 0, 1.5, 1.0, g); pose.x = x; pose.y = y + .845; pose.z = z;
    portable = { g, pose }; return pose;
  };
  const packTable = () => { if (portable) { group.remove(portable.g); portable = null; } };
  const tablePose = tables[0];
  const out = { setNight, setHour, setArchive, onOverhear: null, group, heightAt: groundAt, courierRide, setLetters, tablePose, tables, setUpTable, packTable, spawnCamp: { x: 193, z: 31, ry: Math.PI * .75 }, fires: fires.map(([x, z]) => [x, z]), camp: CAMP, place, blockedAt, interact, zoneName, update, solid, spawn: { x: -167.5, z: -6.5, ry: -2.41 }, live, counts: { trees: Object.values(trees).reduce((s, a) => s + a.length, 0), farTrees: Object.values(far).reduce((s, a) => s + a.length, 0), rocks: rocks.length, grass: grass.length, people: live.length } };
  return out;
}

function makeSmoke(group, sources) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(235,230,222,.55)'); g.addColorStop(1, 'rgba(235,230,222,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c), mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, fog: true }), parts = [], rnd = rngFrom(77);
  for (const [sx, sy, sz, k] of sources) for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(mat.clone()); s.userData = { sx, sy, sz, k, age: rnd() * 7 }; group.add(s); parts.push(s); }
  return {
    update(dt) {
      for (const s of parts) {
        const u = s.userData; u.age += dt; if (u.age > 7) u.age -= 7; const a = u.age / 7;
        s.position.set(u.sx + a * 3.5 + Math.sin(u.age * 1.3) * .3, u.sy + a * 9 * u.k + 1, u.sz + a * 1.2); s.scale.setScalar((.8 + a * 3.8) * u.k); s.material.opacity = Math.sin(a * Math.PI) * .55;
      }
    }
  };
}
