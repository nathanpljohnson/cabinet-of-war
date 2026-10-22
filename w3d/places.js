import * as THREE from 'three';
import { tint, merge, place, box } from './lib.js';
import { hipRoof, wing } from './props.js';

/* Where you can be in person. Each campaign location gets a town (or, for Vienna, the city on the skyline), its own
   landmark, river name and church. Buildings are illustrative silhouettes in the period manner, not surveys. */
export const PLACES = {
  vienna: { river: 'the Danube arm', town: false, skyline: 'vienna', lodging: 'Headquarters' },
  prague: { river: 'the Moldau', town: true, church: 'twinSpires', landmark: 'hradschin', lodging: 'Your lodging' },
  breslau: { river: 'the Oder', town: true, church: 'townHall', landmark: 'cathedral', lodging: 'Your lodging' },
  pressburg: { river: 'the Danube', town: true, church: 'spire', landmark: 'castle4', lodging: 'Your lodging' },
  linz: { river: 'the Danube', town: true, church: 'twinBaroque', landmark: 'hillPalace', lodging: 'Your lodging' },
  munich: { river: 'the Isar', town: true, church: 'frauenkirche', landmark: 'residenz', lodging: 'The envoy’s house' },
  dresden: { river: 'the Elbe', town: true, church: 'dome', landmark: 'schloss', lodging: 'The envoy’s house' },
  berlin: { river: 'the Spree', town: true, church: 'spire', landmark: 'stadtschloss', lodging: 'The envoy’s house' },
};
export const placeCfg = id => PLACES[id] || { river: 'the river', town: true, church: 'spire', landmark: null, lodging: 'Your lodging' };

/* ---------- distance: what being here costs in days ---------- */
const kmBetween = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r, s = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };
// by road ≈ 1.25 × the straight line; an express rider on post horses ~160 km a day, a commander travelling post with a small household ~100
export const roadKm = (a, b) => Math.round(kmBetween(a, b) * 1.25);
export const letterDays = km => Math.max(1, Math.round(km / 160));
export const travelDays = km => Math.max(1, Math.round(km / 100));
export const loc = id => state.locations.find(l => l.id === id);

/* ---------- travel: you go at once; the journey goes into the orders for the adjudicator ---------- */
const TRAVEL_KEY = 'cabinet-of-war:w3d-travel';
export const travel = {
  get() { try { const v = JSON.parse(localStorage.getItem(TRAVEL_KEY) || 'null'); return v && v.turn === state.turn ? v : null; } catch { return null; } },
  set(v) { try { v ? localStorage.setItem(TRAVEL_KEY, JSON.stringify(v)) : localStorage.removeItem(TRAVEL_KEY); } catch { } },
  here() { return this.get()?.to || state.player.locationId; },
  mode() { return this.get()?.mode || state.player.mode; },
};

/* ---------- buildings ---------- */
const WALLS = [0xe8d9b8, 0xdcb873, 0xd9b8a0, 0xe2cf96, 0xd8c8c0, 0xc8d0b8, 0xe6c8a0, 0xf0e8d6], ROOFS = [0x8e4a34, 0x7a4434, 0x9a5a3a, 0x6e4a3e, 0x8a5440];
const TRIM = 0xf1e9d8, GLASS = 0x34404c, DOOR = 0x4a3422, STONE = 0xb8ae98, COPPER = 0x5f8f78, SLATE = 0x4e5258, GOLD = 0xd4b24a;

function prism(w, d, h, c) { // gabled roof on w×d, ridge along x
  const W = w / 2, D = d / 2, v = [[-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D], [-W, h, 0], [W, h, 0]];
  const f = [[0, 4, 5], [0, 5, 1], [3, 2, 5], [3, 5, 4], [0, 3, 4], [1, 5, 2]], pos = [];
  for (const t of f) for (const i of t) pos.push(...v[i]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return tint(g, c, .05);
}
// a burgher house: frontage w on local x, depth d, front facing +z; 2–4 storeys of ~3.2 m (a man is 1.75 m)
export function townHouse(w, d, storeys, rnd) {
  const P = [], wall = WALLS[Math.floor(rnd() * WALLS.length)], roof = ROOFS[Math.floor(rnd() * ROOFS.length)], H = storeys * 3.2 + .6, gableFront = rnd() < .5;
  P.push(box(w, .6, d + .1, STONE, 0, 0, 0)); P.push(box(w, H - .6, d, wall, 0, .6, 0)); P.push(box(w + .2, .25, d + .2, TRIM, 0, H - .25, 0));
  P.push(gableFront ? place(prism(d + .6, w + .2, w * .7, roof), 0, H, 0, Math.PI / 2) : place(prism(w + .3, d + .6, d * .42, roof), 0, H, 0));
  if (gableFront) P.push(place(prism(.04, w, w * .7, wall), 0, H, (d + .6) / 2 + .03, Math.PI / 2)); // the gable end shows the wall colour
  const bays = Math.max(2, Math.floor(w / 2.3)), step = w / bays;
  for (let s = 0; s < storeys; s++) for (let b = 0; b < bays; b++) {
    const x = -w / 2 + step * (b + .5);
    if (s === 0 && b === Math.floor(bays / 2)) { P.push(box(1.3, 2.5, .2, TRIM, x, .6, d / 2 + .02)); P.push(box(1.0, 2.3, .22, DOOR, x, .6, d / 2 + .04)); continue; }
    P.push(box(1.05, 1.6, .16, TRIM, x, 1.4 + s * 3.2, d / 2 + .02)); P.push(box(.8, 1.35, .18, GLASS, x, 1.5 + s * 3.2, d / 2 + .04));
  }
  P.push(box(.7, 1.6, .7, 0x8a6a5a, w * .25, H + (gableFront ? w * .35 : d * .2), -d * .15));
  return merge(P);
}
function tower(b, h, wall) { // square tower with a belfry band and clock
  return [box(b, h, b, wall, 0, 0, 0), box(b + .4, .5, b + .4, TRIM, 0, h * .72, 0), box(b + .4, .5, b + .4, TRIM, 0, h - .5, 0),
    ...[0, 1, 2, 3].map(k => place(box(b * .3, b * .5, .3, GLASS, 0, h * .8, b / 2 + .05), 0, 0, 0, k * Math.PI / 2)),
    place(tint(new THREE.CylinderGeometry(b * .2, b * .2, .2, 12), GOLD), 0, h * .6, b / 2 + .12, 0, 1, 1, 1, Math.PI / 2)];
}
const spireCap = (b, h, c) => place(tint(new THREE.CylinderGeometry(0, b * .62, h, 8), c, .04), 0, h / 2, 0, Math.PI / 8);
function onion(b, c) { // baroque bulb with lantern
  return [place(tint(new THREE.SphereGeometry(b * .48, 10, 8), c, .04), 0, b * .55, 0, 0, 1, 1.15, 1), place(tint(new THREE.CylinderGeometry(b * .1, b * .16, b * .6, 8), c), 0, b * 1.25, 0),
    place(tint(new THREE.SphereGeometry(b * .2, 8, 6), c), 0, b * 1.6, 0, 0, 1, 1.3, 1), place(tint(new THREE.CylinderGeometry(0, b * .07, b * .9, 6), GOLD), 0, b * 2.1, 0)];
}
function welscheHaube(b) { // Munich Frauenkirche: rounded copper caps on brick towers
  return [place(tint(new THREE.SphereGeometry(b * .52, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), COPPER, .04), 0, 0, 0, 0, 1, 1.6, 1), place(tint(new THREE.CylinderGeometry(b * .1, b * .1, b * .9, 8), COPPER), 0, b * .9, 0), place(tint(new THREE.SphereGeometry(b * .14, 8, 6), GOLD), 0, b * 1.4, 0)];
}
const at = (list, x, y, z, ry = 0) => list.map(g => place(g, x, y, z, ry));

// church and town landmarks: returned as geometry around the local origin, front facing +z
export function church(kind) {
  const P = [], wall = 0xf0e8d6;
  const nave = (L, w, h, roof = ROOFS[0]) => { P.push(box(w, h, L, wall, 0, 0, -L / 2 - 4)); P.push(place(prism(L + .6, w + 1, w * .55, roof), 0, h, -L / 2 - 4, Math.PI / 2)); };
  if (kind === 'twinSpires') { nave(40, 16, 18, SLATE); for (const s of [-1, 1]) { P.push(...at(tower(7, 42, 0xd8cfc0), s * 6, 0, 0)); P.push(...at([spireCap(7, 28, SLATE)], s * 6, 42, 0)); for (const k of [-1, 1]) P.push(...at([spireCap(2, 8, SLATE)], s * 6 + k * 3.2, 42, 3.2)); } }
  else if (kind === 'twinBaroque') { nave(36, 15, 16); for (const s of [-1, 1]) { P.push(...at(tower(6.5, 38, wall), s * 6.5, 0, 0)); P.push(...at(onion(6.5, COPPER), s * 6.5, 38, 0)); } }
  else if (kind === 'frauenkirche') { P.push(box(26, 26, 60, 0xa85a42, 0, 0, -34)); P.push(place(prism(61, 27, 22, 0x8a4434), 0, 26, -34, Math.PI / 2)); for (const s of [-1, 1]) { P.push(...at([box(11, 70, 11, 0xa85a42)], s * 6.5, 0, 0)); P.push(...at(welscheHaube(11), s * 6.5, 70, 0)); } }
  else if (kind === 'dome') { P.push(place(tint(new THREE.CylinderGeometry(15, 16, 26, 16), 0xe6dcc6), 0, 13, -14)); P.push(place(tint(new THREE.SphereGeometry(15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8ccb2, .03), 0, 26, -14, 0, 1, 1.5, 1)); P.push(place(tint(new THREE.CylinderGeometry(3, 3.4, 12, 10), 0xe6dcc6), 0, 54, -14)); P.push(place(tint(new THREE.CylinderGeometry(0, 2.4, 6, 10), COPPER), 0, 63, -14)); for (const [x, z] of [[-14, -2], [14, -2], [-14, -26], [14, -26]]) P.push(...at([place(tint(new THREE.CylinderGeometry(2.6, 2.6, 30, 8), 0xe6dcc6), 0, 15, 0), place(tint(new THREE.CylinderGeometry(0, 2.8, 5, 8), COPPER), 0, 32.5, 0)], x, 0, z)); }
  else if (kind === 'townHall') { P.push(box(30, 14, 18, 0xe0d2b4, 0, 0, -10)); P.push(place(prism(30.6, 19, 10, ROOFS[1]), 0, 14, -10)); for (const x of [-12, -4, 4, 12]) P.push(place(prism(4, 3, 5, ROOFS[1]), x, 14, -1, Math.PI / 2)); P.push(...at(tower(7, 46, 0xe0d2b4), 0, 0, -12)); P.push(...at(onion(7, COPPER), 0, 46, -12)); }
  else { nave(34, 14, 15); P.push(...tower(7.5, 40, wall)); P.push(...at([spireCap(7.5, 26, COPPER)], 0, 40, 0)); }
  return merge(P);
}
export function landmark(kind) {
  const P = [];
  const block = (L, D, storeys, wall = 0xf0e8d6, roof = ROOFS[1]) => place(wing(L, D, storeys, { wall, roof, roofH: D * .45 }), 0, 0, 0);
  if (kind === 'castle4') { // Pressburg: a square block with four corner towers above the river
    P.push(box(60, 24, 44, 0xf2ece0)); P.push(place(hipRoof(60, 44, 10, ROOFS[0]), 0, 24, 0));
    for (const [x, z] of [[-30, -22], [30, -22], [-30, 22], [30, 22]]) { P.push(box(11, 34, 11, 0xf2ece0, x, 0, z)); P.push(place(hipRoof(11, 11, 8, ROOFS[0], .4), x, 34, z)); }
  } else if (kind === 'hradschin') { // Prague castle: a long palace front with a cathedral behind
    P.push(place(block(150, 18, 4), 0, 0, 0)); P.push(...at(tower(12, 60, 0xd6ccb8), 20, 0, -40)); P.push(...at(onion(12, COPPER), 20, 60, -40));
    P.push(box(24, 34, 70, 0xd6ccb8, -10, 0, -60)); P.push(place(prism(71, 25, 18, SLATE), -10, 34, -60, Math.PI / 2));
  } else if (kind === 'cathedral') { P.push(...at([church('twinSpires')], 0, 0, 0)); }
  else if (kind === 'hillPalace') { P.push(place(block(110, 16, 3), 0, 0, 0)); P.push(...at(tower(9, 30, 0xf0e8d6), -50, 0, 0)); P.push(...at([spireCap(9, 12, ROOFS[0])], -50, 30, 0)); }
  else if (kind === 'residenz') { P.push(place(block(130, 18, 3, 0xe8dcc0), 0, 0, 0)); P.push(place(block(90, 18, 3, 0xe8dcc0), -55, 0, -50, Math.PI / 2)); P.push(...at(tower(9, 44, 0xe8dcc0), 40, 0, -10)); P.push(...at(onion(9, COPPER), 40, 44, -10)); }
  else if (kind === 'schloss') { P.push(place(block(110, 18, 4, 0xe0d6c0, SLATE), 0, 0, 0)); P.push(...at(tower(12, 70, 0xe0d6c0), 0, 0, -16)); P.push(...at(onion(12, COPPER), 0, 70, -16)); P.push(...at([church('dome')], 120, 0, 40)); }
  else if (kind === 'stadtschloss') { P.push(place(block(190, 22, 4, 0xe8e0cc, SLATE), 0, 0, 0)); P.push(place(block(110, 22, 4, 0xe8e0cc, SLATE), -95, 0, -55, Math.PI / 2)); P.push(...at([church('spire')], 110, 0, 60)); }
  return P.length ? merge(P) : null;
}
// Vienna from outside the walls: bastions, the roofs of the inner city, St Stephen's spire and the Karlskirche dome
export function viennaSkyline(rnd) {
  const P = [];
  for (let i = 0; i < 9; i++) { const a = -1 + i * .25, x = Math.sin(a) * 230, z = Math.cos(a) * 230; P.push(place(merge([box(90, 12, 22, 0xc4b896, 0, 0, 0), box(40, 3, 40, 0x8a9a5a, 0, 12, -16)]), x, 0, z, a)); }
  for (let i = 0; i < 160; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 210, x = Math.sin(a) * r, z = Math.cos(a) * r * .8 - 20, w = 14 + rnd() * 18, d = 12 + rnd() * 10, h = 12 + rnd() * 12;
    P.push(place(merge([box(w, h, d, WALLS[Math.floor(rnd() * WALLS.length)]), place(prism(w + .4, d + .4, d * .45, ROOFS[Math.floor(rnd() * ROOFS.length)]), 0, h, 0)]), x, 0, z, rnd() * .4)); }
  P.push(box(36, 34, 108, 0xb8ac94, 0, 0, -10)); // St Stephen's: nave, steep patterned roof, south tower ~136 m
  P.push(place(prism(110, 38, 34, 0x5a6a4a), 0, 34, -10, Math.PI / 2));
  P.push(box(18, 70, 18, 0xb0a48c, 22, 0, 10)); P.push(place(tint(new THREE.CylinderGeometry(0, 9, 66, 8), 0xb0a48c, .04), 22, 103, 10, Math.PI / 8));
  P.push(...at([church('dome')], 60, 0, 190)); P.push(...at([place(tint(new THREE.CylinderGeometry(3.4, 3.4, 40, 10), 0xe6dcc6), 0, 20, 0)], 38, 0, 200)); P.push(...at([place(tint(new THREE.CylinderGeometry(3.4, 3.4, 40, 10), 0xe6dcc6), 0, 20, 0)], 82, 0, 200));
  return merge(P);
}
// plague column (Mariensäule / Dreifaltigkeitssäule) for the market square
export function marianColumn() {
  return merge([box(5, 1, 5, STONE, 0, 0, 0), box(3.2, 3, 3.2, 0xe6dcc6, 0, 1, 0), place(tint(new THREE.CylinderGeometry(.7, .8, 9, 10), 0xe6dcc6), 0, 8.5, 0), place(tint(new THREE.IcosahedronGeometry(.9, 1), GOLD), 0, 13.6, 0, 0, .8, 1.4, .8)]);
}
export function stall(rnd) {
  const P = [box(3, .9, 1.6, 0x8a6440, 0, 0, 0)];
  for (const [x, z] of [[-1.4, -.75], [1.4, -.75], [-1.4, .75], [1.4, .75]]) P.push(box(.1, 2.4, .1, 0x6b4a2e, x, 0, z));
  P.push(place(prism(3.6, 2.2, .7, [0xb84a32, 0xe8dcc0, 0x4a6a8a][Math.floor(rnd() * 3)]), 0, 2.4, 0));
  for (let i = 0; i < 6; i++) P.push(box(.4, .25 + rnd() * .2, .35, [0xc8a050, 0x9a3a2a, 0x7a9a3a, 0xe8dcc0][i % 4], -1.1 + i * .44, .9, (rnd() - .5) * .6));
  return merge(P);
}
