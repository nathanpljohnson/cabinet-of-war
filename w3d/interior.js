import * as THREE from 'three';
import { stdMat, merge, box, place, tint } from './lib.js';
import { makePerson } from './actors.js';
import { flagTexture } from './props.js';

/* The Conference chamber inside the headquarters: a fixed vignette for council and scenes.
   Illustrative interior; not a reconstruction of a particular room. */
export function createInterior({ renderer }) {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, .1, 200);
  scene.background = new THREE.Color(0x2a1e16); scene.fog = new THREE.Fog(0x2a1e16, 18, 40);
  const W = 18, D = 11, H = 7, mat = stdMat({ roughness: .85 }), P = [];
  P.push(box(W, .1, D, 0x7a5232, 0, -.1, 0));                                                   // floor
  for (let x = -W / 2; x < W / 2; x += .6) P.push(box(.3, .012, D, x % 1.2 < .6 ? 0x8e6440 : 0x6e4a2c, x + .3, 0, 0)); // parquet
  P.push(box(W, .2, D, 0xe8dcc4, 0, H, 0));                                                       // ceiling
  P.push(box(W, H, .3, 0xe9dfc8, 0, 0, -D / 2)); P.push(box(.3, H, D, 0xe9dfc8, -W / 2, 0, 0)); P.push(box(.3, H, D, 0xe9dfc8, W / 2, 0, 0));
  P.push(box(W, H, .3, 0xe9dfc8, 0, 0, D / 2));
  for (const z of [-D / 2 + .2, D / 2 - .2]) for (let x = -W / 2 + 1.5; x < W / 2; x += 3) {     // pilasters and damask panels
    P.push(box(.5, H - .6, .2, 0xf4ecda, x, 0, z));
    if (x + 1.5 < W / 2) P.push(box(2.2, 3, .1, 0x8a2a24, x + 1.5, 1.2, z + (z < 0 ? .12 : -.12)));
  }
  P.push(box(W, .4, .5, 0xd8b45a, 0, H - .4, -D / 2 + .3)); P.push(box(W, .4, .5, 0xd8b45a, 0, H - .4, D / 2 - .3));
  // long table with green baize, chairs both sides
  P.push(box(8, .1, 2.2, 0x2f5a3a, 0, .78, 0)); P.push(box(8.1, .08, 2.3, 0x5a3a20, 0, .72, 0));
  for (const x of [-3.7, 3.7]) for (const z of [-.95, .95]) P.push(box(.12, .72, .12, 0x5a3a20, x, 0, z));
  const seats = [];
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
    const x = -3 + i * 1.5, z = s * 1.75; seats.push([x, z, s]);
    P.push(box(.55, .06, .55, 0x8a2a24, x, .45, z)); P.push(box(.55, .9, .08, 0x5a3a20, x, .45, z + s * .26));
    for (const [a, b] of [[-.22, -.22], [.22, -.22], [-.22, .22], [.22, .22]]) P.push(box(.05, .45, .05, 0x5a3a20, x + a, 0, z + b));
  }
  // papers, inkwells, candlesticks
  for (let i = 0; i < 9; i++) P.push(box(.3, .01, .22, 0xf3ecd8, -3.4 + i * .85, .84, (i % 2 ? .5 : -.5), i * .3));
  for (const x of [-2.4, 0, 2.4]) { P.push(place(tint(new THREE.CylinderGeometry(.05, .09, .5, 8), 0xd8b45a), x, 1.08, 0)); P.push(box(.04, .2, .04, 0xfaf6ea, x, 1.3, 0)); }
  // portrait frames and a great window on the far wall
  for (const x of [-6, 6]) { P.push(box(2, 2.6, .12, 0xc89a3a, x, 2.2, -D / 2 + .32)); P.push(box(1.7, 2.3, .14, 0x3a2e24, x, 2.35, -D / 2 + .34)); }
  for (const x of [-2.5, 2.5]) { P.push(box(1.8, 4, .12, 0xf4ecda, x, 1.6, D / 2 - .32)); P.push(box(1.5, 3.7, .14, 0xcfe0f0, x, 1.75, D / 2 - .34)); }
  const room = new THREE.Mesh(merge(P), mat); room.receiveShadow = true; scene.add(room);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshStandardMaterial({ map: flagTexture(), roughness: .9 })); banner.position.set(0, 3.6, -D / 2 + .36); scene.add(banner);
  // chandelier + light
  const ch = new THREE.Mesh(merge([place(tint(new THREE.TorusGeometry(.9, .05, 6, 18), 0xd8b45a), 0, 0, 0, 0, 1, 1, 1, Math.PI / 2), place(tint(new THREE.CylinderGeometry(.03, .03, 1.6, 6), 0xd8b45a), 0, .8, 0)]), mat);
  ch.position.set(0, 4.8, 0); scene.add(ch);
  const flames = new THREE.Mesh(new THREE.IcosahedronGeometry(.07, 0), new THREE.MeshBasicMaterial({ color: 0xffd080 }));
  for (let i = 0; i < 8; i++) { const f = flames.clone(); f.position.set(Math.cos(i / 8 * 6.28) * .9, 4.95, Math.sin(i / 8 * 6.28) * .9); scene.add(f); }
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x5a3a24, 1.1));
  const warm = new THREE.PointLight(0xffc890, 60, 18, 1.4); warm.position.set(0, 4.6, 0); scene.add(warm);
  const win = new THREE.DirectionalLight(0xfff2dc, 2.2); win.position.set(-3, 6, 14); win.target.position.set(0, 0, -2); win.castShadow = true; win.shadow.mapSize.set(1024, 1024); Object.assign(win.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 }); scene.add(win, win.target);

  // the council at table (illustrative advisers; the Council panel holds their actual advice)
  const people = [['adviser', 'Sitting_Talking_Loop'], ['clerk', 'Sitting_Idle_Loop'], ['aide', 'Sitting_Idle_Loop'], ['adviser', 'Sitting_Idle_Loop'], ['clerk', 'Sitting_Talking_Loop'], ['aide', 'Sitting_Talking_Loop']];
  const sat = [];
  people.forEach(([k, a], i) => { const [x, z, s] = seats[[0, 2, 4, 5, 7, 9][i]]; const p = makePerson(k); p.obj.position.set(x, .02, z); p.obj.rotation.y = s > 0 ? Math.PI : 0; p.play(a, 0); p.mixer.update(i * .7); scene.add(p.obj); sat.push(p); });
  let t = 0;
  return {
    scene, camera: cam,
    resize() { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); },
    frame(dt) {
      t += dt; const a = -.5 + Math.sin(t * .05) * .35;
      cam.position.set(Math.sin(a) * 7.5 - 1.5, 2.6, Math.cos(a) * 4.7); cam.lookAt(-1.4, 1.1, 0);
      for (const p of sat) p.mixer.update(dt);
      warm.intensity = 56 + Math.sin(t * 9) * 3;
      renderer.render(scene, cam);
    },
  };
}

/* The bedchamber where he lies while he keeps to his bed (places.js abedOn): a curtained bed, a window, a candle, the
   physician's table, and whoever has come to him that day standing round it. Illustrative interior.
   visitors: [{id, name, kind, look, away}] — `away` (they stand cool or hostile towards him) keeps them by the door.
   grave: he lies flat; otherwise he is propped up on his pillows. Returns pick(ndcX, ndcY) → visitor id. */
export function createSickroom({ renderer, visitors = [], grave = false, winter = false }) {
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .1, 60);
  const W = 8, D = 7, H = 4.2, mat = stdMat({ roughness: .88 }), P = [];
  scene.background = new THREE.Color(0x3a2c22);
  P.push(box(W, .1, D, 0x6e4c30, 0, -.1, 0));                                                     // floor
  for (let x = -W / 2; x < W / 2; x += .45) P.push(box(.22, .012, D, x % .9 < .45 ? 0x7e5a38 : 0x684628, x + .22, 0, 0)); // boards
  P.push(box(W, .15, D, 0xeee4cc, 0, H, 0));                                                      // ceiling
  const WALL = 0xe4d6b8, PANEL = 0xcdb894;
  P.push(box(W, H, .2, WALL, 0, 0, -D / 2)); P.push(box(.2, H, D, WALL, -W / 2, 0, 0)); P.push(box(.2, H, D, WALL, W / 2, 0, 0)); P.push(box(W, H, .2, WALL, 0, 0, D / 2));
  for (const [x0, z0, along] of [[0, -D / 2 + .12, 'x'], [0, D / 2 - .12, 'x'], [-W / 2 + .12, 0, 'z'], [W / 2 - .12, 0, 'z']]) // dado panelling
    P.push(along === 'x' ? box(W - .4, 1.05, .06, PANEL, x0, 0, z0) : box(.06, 1.05, D - .4, PANEL, x0, 0, z0));
  // the bed against the back wall: posts, tester, curtains, mattress, bolster and coverlet
  const BX = -.6, BZ = -D / 2 + 1.35, BW = 1.7, BL = 2.2;
  for (const [dx, dz] of [[-BW / 2, -BL / 2], [BW / 2, -BL / 2], [-BW / 2, BL / 2], [BW / 2, BL / 2]]) P.push(box(.1, 2.6, .1, 0x4a3020, BX + dx, 0, BZ + dz));
  P.push(box(BW + .2, .18, BL + .2, 0x6a2a24, BX, 2.55, BZ));                                     // tester
  P.push(box(BW + .1, 2.2, .04, 0x7a3029, BX, .35, BZ - BL / 2 - .02));                           // curtain at the head
  for (const s of [-1, 1]) P.push(box(.05, 2.1, .7, 0x7a3029, BX + s * (BW / 2 + .03), .45, BZ - BL / 2 + .45)); // curtains drawn back
  P.push(box(BW, .45, BL, 0x4a3020, BX, 0, BZ)); P.push(box(BW - .06, .22, BL - .06, 0xf2ece0, BX, .45, BZ));
  P.push(box(BW - .2, .2, .45, 0xfaf6ec, BX, .66, BZ - BL / 2 + .32));                           // bolster
  if (!grave) P.push(place(tint(new THREE.BoxGeometry(BW - .3, .5, .2), 0xf6f0e4), BX, .95, BZ - BL / 2 + .5, 0, 1, 1, 1, -.5)); // pillows heaped to prop him up
  P.push(box(BW + .02, grave ? .52 : .32, BL * .66, 0xb8a27a, BX, .6, BZ + BL * .16));            // the coverlet, drawn up over him (higher over a man lying flat)
  // a night table with physic, a basin and a candle; a chair; a chest; a stove; the window on the right wall
  P.push(box(.55, .7, .45, 0x5a3a24, BX + BW / 2 + .55, 0, BZ - .6));
  for (let i = 0; i < 3; i++) P.push(place(tint(new THREE.CylinderGeometry(.035, .04, .16, 8), [0x6a7a5a, 0x8a5a3a, 0x4a5a6a][i]), BX + BW / 2 + .4 + i * .12, .78, BZ - .66));
  P.push(place(tint(new THREE.CylinderGeometry(.16, .1, .07, 12), 0xe8e4dc), BX + BW / 2 + .66, .74, BZ - .5));
  P.push(place(tint(new THREE.CylinderGeometry(.03, .05, .12, 8), 0xd8b45a), BX + BW / 2 + .4, .76, BZ - .48)); P.push(box(.025, .12, .025, 0xfaf6ea, BX + BW / 2 + .4, .82, BZ - .48));
  P.push(box(.5, .05, .5, 0x8a2a24, BX + BW / 2 + .7, .46, BZ + .55)); P.push(box(.5, .6, .06, 0x5a3a20, BX + BW / 2 + .7, .46, BZ + .3));
  for (const [a, b] of [[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]]) P.push(box(.05, .46, .05, 0x5a3a20, BX + BW / 2 + .7 + a, 0, BZ + .55 + b));
  P.push(box(1.2, .6, .55, 0x6a4428, -W / 2 + .9, 0, D / 2 - .7));                               // chest by the door wall
  P.push(box(.9, 1.9, .7, 0xd8d0c0, -W / 2 + .6, 0, -.2)); P.push(box(.95, .12, .75, 0xc0b4a0, -W / 2 + .6, 1.9, -.2)); // tiled stove
  P.push(box(.06, 2.3, 1.1, 0x5a3a24, W / 2 - .14, 0, D / 2 - .9));                               // the door
  P.push(box(.08, 2.2, 1.6, 0xf2ecdc, W / 2 - .12, 1.1, -.6));                                    // window frame
  P.push(box(1.1, 1.6, .14, 0xa88a52, -2.6, 1.6, -D / 2 + .16)); P.push(box(.95, 1.45, .16, 0x5a4a3a, -2.6, 1.68, -D / 2 + .17)); // a picture
  P.push(box(.7, 1.8, .14, 0xc89a3a, 2.2, 1.3, -D / 2 + .16)); P.push(box(.6, 1.7, .16, 0x3a2e24, 2.2, 1.35, -D / 2 + .17)); // a crucifix's dark frame
  const room = new THREE.Mesh(merge(P), mat); room.receiveShadow = true; room.castShadow = true; scene.add(room);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2), new THREE.MeshBasicMaterial({ color: winter ? 0xdfe8f0 : 0xe8f0e0 }));
  glass.position.set(W / 2 - .17, 2.1, -.6); glass.rotation.y = -Math.PI / 2; scene.add(glass);
  const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(.025, 0), new THREE.MeshBasicMaterial({ color: 0xffd080 })); flame.position.set(BX + BW / 2 + .4, .92, BZ - .48); scene.add(flame);

  // he lies in the bed: flat when gravely ill, propped up on the pillows otherwise
  const me = makePerson('invalid'); me.play(grave ? 'Idle_Loop' : 'Sitting_Idle_Loop', 0);
  // (measured on the rig: lying, the feet are the origin and the head 1.6 m beyond; sitting, the hips stand 0.56 m behind it)
  if (grave) { me.obj.rotation.set(-Math.PI / 2, 0, 0); me.obj.position.set(BX, .74, BZ + BL / 2 - .3); }
  else { me.obj.rotation.set(-.55, 0, 0); me.obj.position.set(BX, .44, BZ - BL / 2 + .9); }
  scene.add(me.obj);
  // the physician (illustrative) at the night table; visitors round the bed, the cool ones by the door
  const doc = makePerson('mourner'); doc.obj.position.set(BX + BW / 2 + 1.2, 0, BZ - .9); doc.obj.rotation.y = -2.2; doc.play('Idle_Loop', 0); doc.mixer.update(1.3); scene.add(doc.obj);
  const NEAR = [[BX - BW / 2 - .65, BZ - .55], [BX - BW / 2 - .75, BZ + .45], [BX - BW / 2 - .7, BZ + 1.35], [BX - .4, BZ + BL / 2 + .75], [BX + BW / 2 + .6, BZ + 1.5], [BX + .5, BZ + BL / 2 + 1.1]];
  const DOOR = [[W / 2 - 1, D / 2 - 1.6], [W / 2 - 1.2, D / 2 - .7], [W / 2 - 1.9, D / 2 - 1.1]];
  const live = [me, doc], picks = []; let ni = 0, di = 0;
  for (const v of visitors) {
    const sp = v.away ? DOOR[di++] : NEAR[ni++]; if (!sp) continue;
    const p = makePerson(v.kind || 'courtier', v.look); p.obj.position.set(sp[0], 0, sp[1]);
    p.obj.rotation.y = Math.atan2(BX - sp[0], BZ - sp[1]); p.play(v.away ? 'Idle_Loop' : 'Idle_Talking_Loop', 0); p.mixer.update(ni * .9 + di * .5);
    scene.add(p.obj); live.push(p); picks.push({ id: v.id, name: v.name, obj: p.obj, pos: sp });
  }
  // light: the window by day, the candle and the stove's glow by night (setHour); never near-black (LIGHT_FLOOR)
  const hemi = new THREE.HemisphereLight(0xfff2dc, 0x6a4a30, 1.2); scene.add(hemi);
  const candle = new THREE.PointLight(0xffc080, 6, 6, 1.6); candle.position.set(BX + BW / 2 + .4, 1.05, BZ - .48); scene.add(candle);
  const win = new THREE.DirectionalLight(winter ? 0xe8eef6 : 0xfff2dc, 2); win.position.set(9, 4, -.6); win.target.position.set(BX, .5, BZ);
  win.castShadow = true; win.shadow.mapSize.set(1024, 1024); Object.assign(win.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 }); scene.add(win, win.target);
  let t = 0, hour = 10;
  const ray = new THREE.Raycaster();
  return {
    scene, camera: cam, visitors: picks, debug: { me, doc },
    resize() { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); },
    setHour(h) {
      hour = h; const day = h > 7 && h < 17.5, dusk = !day && (h >= 17.5 && h < 19.5 || h >= 6 && h <= 7);
      win.intensity = day ? 2.1 : dusk ? .9 : .25; glass.material.color.set(day ? (winter ? 0xdfe8f0 : 0xe8f0e0) : dusk ? 0xc8a890 : 0x3a4458);
      hemi.intensity = day ? 1.9 : dusk ? 1.3 : 1.05; hemi.color.set(day ? 0xfff2dc : 0xffd8a8); candle.intensity = day ? 3 : 12;
    },
    pick(nx, ny) { ray.setFromCamera(new THREE.Vector2(nx, ny), cam); for (const v of picks) if (ray.intersectObject(v.obj, true).length) return v.id; return null; },
    frame(dt) {
      t += dt; const a = Math.sin(t * .04) * .25; // from the window side, past the night table, drifting a little
      cam.position.set(2.75 + a * .4, 2.35, .9 + a); cam.lookAt(BX - .2, .85, BZ - .2);
      for (const p of live) p.mixer.update(dt);
      candle.intensity += (Math.sin(t * 11) + Math.sin(t * 7.3)) * .08; flame.scale.setScalar(1 + Math.sin(t * 13) * .15);
      renderer.render(scene, cam);
    },
    // people share cached geometry with the rest of the world: only the room's own meshes are freed
    dispose() { for (const m of [room, glass, flame]) { m.geometry.dispose(); m.material.dispose && m.material.dispose(); } win.shadow.map && win.shadow.map.dispose(); },
  };
}
