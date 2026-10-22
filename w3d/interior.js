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
