import * as THREE from 'three';
import { initActors, makePerson, makeHorse } from './actors.js';
import { buildRegion } from './region.js';
import { setWindTime, disposeTree } from './lib.js';
import { createShell, locName, fmtDate } from './shell.js';
import { createSound } from './sound.js';
import { travel, loc, roadKm, travelDays, letterDays } from './places.js';
import { checkContinuity, correctionRequest } from './continuity.js';

/* Cabinet of War: the 3D world over the desk's engine. Views: room (walk), map (the desk's live map, reached by leaning
   over the map table), field (3D battlefield, reached by zooming the map into it), hall (conference chamber).
   The 3D layer shows and edits the desk's own state; it keeps no simulation of its own. */
const desk = window.__desk;
const KEY = 'cabinet-of-war:w3d-gfx', COURIER_KEY = 'cabinet-of-war:w3d-courier';
const PRESETS = {
  low: { scale: .6, shadows: 0, terrain: 4, trees: .6, grass: 6000 },
  medium: { scale: .8, shadows: 1024, terrain: 3, trees: .85, grass: 22000 },
  high: { scale: 1, shadows: 2048, terrain: 2.5, trees: 1, grass: 40000 },
};
let gfx = { preset: 'medium', scale: null, shadows: null, veg: null, fps: false, sound: true, auto: true };
try { Object.assign(gfx, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { }
const Q = () => { const p = PRESETS[gfx.veg || gfx.preset]; return { ...p, scale: gfx.scale ?? PRESETS[gfx.preset].scale, shadows: gfx.shadows ?? PRESETS[gfx.preset].shadows }; };
const saveGfx = () => { try { localStorage.setItem(KEY, JSON.stringify(gfx)); } catch { } };

/* ---------- DOM ---------- */
for (const id of ['w3d', 'w3d-float', 'w3d-shell', 'w3d-back']) document.getElementById(id)?.remove();
const root = document.createElement('div'); root.id = 'w3d';
root.innerHTML = `<canvas id="w3d-c" tabindex="0" aria-label="3D view. WASD to walk, drag to look, E to interact."></canvas>
<div class="w3d-prompt" id="w3d-prompt" hidden></div><div class="w3d-overheard" id="w3d-overheard"></div><div class="w3d-help" id="w3d-help"></div>`;
const float = document.createElement('div'); float.id = 'w3d-float';
float.innerHTML = `<div class="w3d-toast" id="w3d-toast" role="status" aria-live="polite"></div>
<div class="w3d-panel" id="w3d-gfx" hidden>
  <div class="eyebrow">Graphics &amp; sound</div>
  <label>Preset <select id="g-preset"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
  <label>Resolution <input type="range" id="g-scale" min="0.4" max="1" step="0.05"> <span id="g-scale-v"></span></label>
  <label>Shadows <select id="g-shadows"><option value="0">Off</option><option value="1024">Low</option><option value="2048">High</option><option value="4096">Ultra</option></select></label>
  <label>Vegetation <select id="g-veg"><option value="low">Sparse</option><option value="medium">Normal</option><option value="high">Dense</option></select></label>
  <label><input type="checkbox" id="g-auto"> Lower the resolution when it can’t keep up</label>
  <label><input type="checkbox" id="g-sound"> Ambient sound</label>
  <label><input type="checkbox" id="g-fps"> Show frame time</label>
  <div class="row"><button id="g-tools">Map tools</button><button id="g-layers">Map layers</button></div>
  <p class="w3d-note">Vegetation changes rebuild the scene.</p>
</div>
<button id="w3d-skip-opening" hidden>Continue to morning · Esc</button>
<div class="w3d-stats" id="w3d-stats" hidden></div>
<div class="w3d-loading" id="w3d-loading"><div><div class="brand">Cabinet of War</div><div class="eyebrow">Raising the country…</div></div></div>`;
document.body.append(root, float);
const $3 = id => document.getElementById(id);
const canvas = $3('w3d-c');
$3('w3d-skip-opening').onclick = () => morning();

/* ---------- renderer ---------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// the shadow map is redrawn only when its window moves or the scene changes (it was half the GPU's work when redrawn every
// frame); moving people and animals use ground blobs instead (actors.js). The field redraws its own a few times a second.
renderer.shadowMap.autoUpdate = false;
let shadowKey = '';
const shadowsDirty = () => { shadowKey = ''; renderer.shadowMap.needsUpdate = true; };
// automatic resolution: a multiplier on the chosen resolution that drops when frames run long and creeps back with headroom
const dyn = { k: 1, t: 0, n: 0, fast: 0, grace: 2 };
const pixelRatio = () => Math.min(devicePixelRatio, 2) * Q().scale * (gfx.auto ? dyn.k : 1);
function adaptResolution(dt) {
  if (!gfx.auto || mode === 'trans' || mode === 'loading') return;
  if (dyn.grace > 0) { dyn.grace -= dt; dyn.t = dyn.n = 0; return; }
  dyn.t += dt; dyn.n++; if (dyn.t < 1) return;
  const ms = dyn.t / dyn.n * 1000; dyn.t = dyn.n = 0;
  if (ms > 19 && dyn.k > .6) { dyn.k = Math.max(.6, dyn.k - .1); dyn.fast = -4; renderer.setPixelRatio(pixelRatio()); resize(); }
  else if (ms < 17.5 && dyn.k < 1) { if (++dyn.fast >= 4) { dyn.k = Math.min(1, dyn.k + .05); dyn.fast = 0; renderer.setPixelRatio(pixelRatio()); resize(); } }
  else if (ms >= 17.5) dyn.fast = Math.min(dyn.fast, 0);
}
function applyGfx() { const q = Q(); renderer.setPixelRatio(pixelRatio()); shadowsDirty(); renderer.shadowMap.enabled = q.shadows > 0; resize(); for (const s of [world, battle]) if (s && s.setShadows) s.setShadows(q.shadows); }
function resize() { renderer.setSize(innerWidth, innerHeight, false); for (const c of [camera, battle && battle.camera]) if (c) { c.aspect = innerWidth / innerHeight; c.updateProjectionMatrix(); } hall && hall.resize(); }
addEventListener('resize', resize);

export function makeSky(scene, sunDir, opts = {}) {
  const top = new THREE.Color(opts.top || 0x5b8fd6), hor = new THREE.Color(opts.horizon || 0xf3dcb4), sun = new THREE.Color(0xfff0d0);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: top }, hor: { value: hor }, sunC: { value: sun }, sunD: { value: sunDir } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top,hor,sunC,sunD; varying vec3 vD; void main(){ float h=vD.y; vec3 c=mix(hor,top,pow(clamp(h,0.,1.),.55)); c=mix(c,hor*.92,smoothstep(0.,-.2,h)); float s=max(dot(vD,normalize(sunD)),0.); c+=sunC*(pow(s,900.)*6.+pow(s,24.)*.28+pow(s,4.)*.12); gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), m); sky.frustumCulled = false; scene.add(sky); return sky;
}
export function makeLights(scene, sunDir, size, mapSize) {
  const hemi = new THREE.HemisphereLight(0xcfdcff, 0x7a6644, 1.25); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a8, 3.4); sun.castShadow = mapSize > 0;
  const s = sun.shadow; s.mapSize.set(mapSize || 1024, mapSize || 1024); s.camera.left = -size; s.camera.right = size; s.camera.top = size; s.camera.bottom = -size; s.camera.near = 10; s.camera.far = 600; s.bias = -.0004; s.normalBias = .5; s.radius = 3;
  scene.add(sun, sun.target);
  const follow = p => { sun.target.position.copy(p); sun.position.copy(p).addScaledVector(sunDir, 300); };
  const setShadows = n => { sun.castShadow = n > 0; if (n > 0 && s.mapSize.x !== n) { s.mapSize.set(n, n); if (s.map) { s.map.dispose(); s.map = null; } } };
  return { sun, hemi, follow, setShadows };
}
function clouds(scene, rnd) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 1, emissive: 0xd8cfc4, emissiveIntensity: .75, fog: false });
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group(), n = 4 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(18 + rnd() * 22, 0), mat); m.position.set(k * 26 - n * 13 + rnd() * 10, rnd() * 10, rnd() * 18); m.scale.set(1.3, .42, 1); c.add(m); }
    const a = rnd() * Math.PI * 2, d = 900 + rnd() * 1300; c.position.set(Math.cos(a) * d, 260 + rnd() * 220, Math.sin(a) * d); c.lookAt(0, c.position.y, 0); g.add(c);
  }
  scene.add(g); g.userData.mat = mat; return g;
}

/* ---------- world scene ---------- */
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .3, 6000);
const sunDir = new THREE.Vector3(.74, .36, .28).normalize();
const uTime = { value: 0 };
let world = null, actors = null, player, aide, steed, followTrail = [], lights, skyMesh, cloudG;
let mode = 'loading', mapFrom = 'room', battle = null, hall = null, builtFor = null, builtMode = null, builtCues = null, account = false, introOn = false;
// what the state says the world looks like where you are (the reply contract keeps state.world; defaults follow the date)
/* ---------- the hour: a turn is days you live through. Time passes as you walk (an hour every 40 s), and what you
   do takes time; letting the day pass brings the next morning's post. Light, people and the Conference follow it. ---------- */
const CLOCK_KEY = 'cabinet-of-war:w3d-clock';
let clockH = 9, clockTurn = null, lastWhole = 9;
function loadClock() { try { const c = JSON.parse(localStorage.getItem(CLOCK_KEY) || 'null'); if (c && c.turn === state.turn && c.day === shell.today) { clockH = c.h; return; } } catch { } clockH = 8.5; saveClock(); }
function saveClock() { try { localStorage.setItem(CLOCK_KEY, JSON.stringify({ turn: state.turn, day: shell.today, h: clockH })); } catch { } }
const timeWord = h => h < 5 ? 'night' : h < 7 ? 'dawn' : h < 11.5 ? 'morning' : h < 13.5 ? 'midday' : h < 17 ? 'afternoon' : h < 19.5 ? 'evening' : 'night';
const clock = { get hour() { return clockH; }, get word() { return timeWord(clockH); } };
function advanceClock(hours) {
  const before = clockH; clockH = Math.min(23.5, clockH + hours); saveClock();
  if (Math.floor(clockH) !== Math.floor(before)) { onHour(Math.floor(clockH)); }
  if (Math.abs(clockH - before) >= .25 || Math.floor(clockH * 4) !== Math.floor(before * 4)) applyAtmosphere();
}
function onHour(h) { world && world.region.setHour(clockH); if (mode === 'room' && h >= 6 && h <= 21) sound.cue('bell', h > 12 ? h - 12 : h); if (h === 20) toast('Evening. The Conference sits; the courtyard empties.'); if (h === 22) toast(shell.passDay ? 'Night. Let the day pass when you are ready for the morning post.' : 'Night.'); }
function newDay() { clockH = 8.5; saveClock(); world && world.region.setHour(clockH); applyAtmosphere(); }
function worldCues() {
  const W = state.world || {}, m = new Date(state.date + 'T12:00:00').getMonth(), here = travel.here();
  const men = (state.forces || []).filter(f => f.locationId === here).reduce((s, f) => s + (+f.men || 0), 0);
  return { season: m === 11 || m <= 1 ? 'winter' : 'open', mourning: W.mourning ?? (state.date >= '1740-10-20' && state.date < '1741-10-20'), pay: W.pay || 'paid', roads: W.roads || 'good',
    refugees: (W.refugees || []).includes(here), men: men || null, standing: (state.hidden || {}).standing || {}, dismissed: !!state.player.dismissed,
    overheard: (state.overheard || []).filter(o => !o.place || o.place === here), carried: carriedOrders(), rivalHere: rivalHere(here) };
}
// the rival's courier leaves at dawn wherever the rival is lodged (state.hidden.rival, kept by the adjudicator)
function rivalHere(here) { const r = (state.hidden || {}).rival, c = r && state.cast.find(x => x.id === r.id); return !!(c && c.place === here && !c.dead); }
// your last dispatch, as it is carried out: seen on the first day after the reply
function carriedOrders() {
  let sent = []; try { sent = JSON.parse(localStorage.getItem('cabinet-of-war:w3d-sent') || '[]'); } catch { }
  const last = sent.find(s => s.turn === state.turn - 1); if (!last || (shell && shell.today !== (state.reports.map(r => r.arrives || r.dated).sort()[0] || state.date))) return {};
  const all = last.orders.map(o => typeof o === 'string' ? o : o.line).join(' ').toLowerCase();
  return { march: /march|regiment|troops|battalion|reinforce|move .* to/.test(all), supply: /bread|wagon|stores|forage|boat|money|pay|magazine|suppl/.test(all), letters: /by letter|write|envoy|courier|send/.test(all) };
}

async function buildWorld() {
  const t0 = performance.now(); const q = Q();
  if (world) { scene.remove(world.region.group); disposeTree(world.region.group); }
  const here = loc(travel.here()) || { id: 'vienna', name: 'Vienna' }, pmode = travel.mode();
  const people = (state.cast || []).filter(c => c.place === here.id && !['maria_theresa', 'francis_stephen', 'own-forces', 'steward'].includes(c.id));
  const cues = worldCues(), region = buildRegion({ actors, quality: q, uTime, place: here, people, mode: pmode, cues });
  scene.add(region.group); builtFor = here.id; builtMode = pmode; builtCues = JSON.stringify(cues);
  region.setHour(clockH); region.onOverhear = o => { const names = (o.who || []).map(id => (state.cast.find(c => c.id === id) || {}).name || id).join(' and '); shell.overhear(o, names); const e = $3('w3d-overheard'); e.innerHTML = '“' + o.line.replace(/[<>&]/g, '') + '”<small>overheard · ' + names.replace(/[<>&]/g, '') + '</small>'; e.classList.add('on'); clearTimeout(e.t); e.t = setTimeout(() => e.classList.remove('on'), 7000); };
  region.setArchive && region.setArchive(shell.archivedCount()); activeTable = null; portableUp = false;
  world = { region, buildMs: Math.round(performance.now() - t0), setShadows: n => lights.setShadows(n) }; shadowsDirty(); dyn.grace = 2;
  const sp = pmode === 'field' ? region.spawnCamp : region.spawn; // with the army you live at the camp
  if (!player) { player = makePerson('commander'); aide = makePerson('aide'); steed = makeHorse(actors.hw, { saddle: true }); scene.add(player.obj, aide.obj, steed.obj); }
  pl.x = sp.x; pl.z = sp.z; pl.ry = sp.ry;
  aide.obj.position.set(sp.x + 2, 0, sp.z + 2.5); steed.obj.position.set(sp.x - 2.5, 0, sp.z + 5); followTrail = [[sp.x - 2, sp.z + 7], [sp.x, sp.z]];
  syncCourierOnBoot(); region.setLetters(shell ? shell.unread().length : 0);
  return world;
}

/* ---------- player, entourage, camera ---------- */
const pl = { x: 0, z: 0, ry: 0, v: 0 }, cam = { yaw: .73, pitch: .36, dist: 10, tgt: new THREE.Vector3() };
const keys = new Set();
const ray = new THREE.Raycaster(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
let nearest = null, camTween = null;

function stepPlayer(dt) {
  const R = world.region; let ix = 0, iz = 0;
  if (!shell.papersOpen) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) iz -= 1; if (keys.has('KeyS') || keys.has('ArrowDown')) iz += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1; if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  }
  const tired = ['tired', 'ill', 'gravely ill'].includes(state.player.health || (state.household || {}).health) || (travel.get() && travelDays(roadKm(loc(state.player.locationId) || loc('vienna'), loc(travel.here()) || loc('vienna'))) >= 5);
  const run = keys.has('ShiftLeft') || keys.has('ShiftRight'), want = (ix || iz) ? (run ? (tired ? 3.6 : 5.6) : (tired ? 1.6 : 2.1)) : 0;
  pl.v += (want - pl.v) * Math.min(1, dt * 8);
  if (ix || iz) {
    const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw), dx = ix * c + iz * s, dz = -ix * s + iz * c, L = Math.hypot(dx, dz), dir = Math.atan2(dx / L, dz / L);
    let d = ((dir - pl.ry + Math.PI * 3) % (Math.PI * 2)) - Math.PI; pl.ry += d * Math.min(1, dt * 10);
    const nx = pl.x + Math.sin(pl.ry) * pl.v * dt, nz = pl.z + Math.cos(pl.ry) * pl.v * dt;
    if (!R.blockedAt(nx, nz)) { pl.x = nx; pl.z = nz; } else if (!R.blockedAt(nx, pl.z)) pl.x = nx; else if (!R.blockedAt(pl.x, nz)) pl.z = nz;
  }
  player.obj.position.set(pl.x, R.heightAt(pl.x, pl.z), pl.z); player.obj.rotation.y = pl.ry;
  player.play(pl.v > 3.4 ? 'Jog_Fwd_Loop' : pl.v > .25 ? 'Walk_Loop' : 'Idle_Loop', .25, pl.v > 3.4 ? pl.v / 4.6 : pl.v > .25 ? Math.max(.6, pl.v / 1.9) : 1);
  player.mixer.update(dt);
  const last = followTrail[followTrail.length - 1];
  if (!last || Math.hypot(last[0] - pl.x, last[1] - pl.z) > .4) { followTrail.push([pl.x, pl.z]); if (followTrail.length > 60) followTrail.shift(); }
  follow(aide, trailPoint(3.2), 1.4, dt); follow(steed, trailPoint(7), 0, dt, true);
}
function trailPoint(back) { let acc = 0; for (let i = followTrail.length - 1; i > 0; i--) { acc += Math.hypot(followTrail[i][0] - followTrail[i - 1][0], followTrail[i][1] - followTrail[i - 1][1]); if (acc >= back) return followTrail[i - 1]; } return followTrail[0] || [pl.x, pl.z]; }
function follow(a, p, side, dt, horse) {
  const R = world.region, o = a.obj.position, tx = p[0] + Math.cos(pl.ry) * side * .6, tz = p[1] - Math.sin(pl.ry) * side * .6;
  const dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz);
  const v = d > .35 ? Math.min(d * 2.2, horse ? 7 : 6) : 0; a.v = (a.v || 0) + (v - (a.v || 0)) * Math.min(1, dt * 5);
  if (a.v > .05 && d > .05) { const nx = o.x + dx / d * a.v * dt, nz = o.z + dz / d * a.v * dt; if (!R.blockedAt(nx, nz)) { o.x = nx; o.z = nz; } else if (!R.blockedAt(nx, o.z)) o.x = nx; else if (!R.blockedAt(o.x, nz)) o.z = nz; else if (d > 12) { o.x = tx; o.z = tz; } const want = Math.atan2(dx, dz); let df = ((want - a.obj.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; a.obj.rotation.y += df * Math.min(1, dt * 6); }
  a.stuck = d > 20 ? (a.stuck || 0) + dt : 0; if (a.stuck > 1.5) { o.x = tx; o.z = tz; a.stuck = 0; } // rejoin if snagged or left behind
  o.y = R.heightAt(o.x, o.z);
  if (horse) a.play(a.v > 4 ? 'Gallop' : a.v > .3 ? 'Walk' : 'Idle', .3, a.v > 4 ? a.v / 8 : a.v > .3 ? Math.max(.5, a.v / 1.6) : 1);
  else a.play(a.v > 3.4 ? 'Jog_Fwd_Loop' : a.v > .3 ? 'Walk_Loop' : 'Idle_Loop', .3, a.v > 3.4 ? a.v / 4.6 : a.v > .3 ? Math.max(.6, a.v / 1.9) : 1);
  a.mixer.update(dt);
}
function followPose(dt, out) { // where the chase camera wants to be
  const R = world.region;
  cam.tgt.lerp(tmp.set(pl.x, player.obj.position.y + 1.55, pl.z), dt == null ? 1 : Math.min(1, dt * 9));
  const off = tmp2.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  let d = cam.dist; ray.set(cam.tgt, off); ray.far = d;
  const hit = ray.intersectObjects(R.solid, false)[0]; if (hit) d = Math.max(1.2, hit.distance - .4);
  out.position.copy(cam.tgt).addScaledVector(off, d);
  const gy = R.heightAt(out.position.x, out.position.z) + .6; if (out.position.y < gy) out.position.y = gy;
  out.up.set(0, 1, 0); out.lookAt(cam.tgt);
}
const poseCam = new THREE.PerspectiveCamera();
function stepCamera(dt) {
  if (cam.fixed) { camera.position.set(...cam.fixed[0]); camera.lookAt(...cam.fixed[1]); return; }
  if (camTween) {
    const w = camTween; w.t = Math.min(1, w.t + dt / w.dur); const e = w.t < .5 ? 4 * w.t ** 3 : 1 - (-2 * w.t + 2) ** 3 / 2;
    if (w.toFollow) { followPose(null, poseCam); w.p1.copy(poseCam.position); w.q1.copy(poseCam.quaternion); if (w.l1) w.l1.copy(cam.tgt); }
    camera.position.lerpVectors(w.p0, w.p1, e);
    if (w.l0) { const le = 1 - (1 - Math.min(1, w.t / .4)) ** 3; camera.up.lerpVectors(w.u0, w.u1, e).normalize(); camera.lookAt(tmp.lerpVectors(w.l0, w.l1, w.toFollow ? e : le)); } // turn to the table first, then bend over it // keep the table centred while leaning
    else camera.quaternion.slerpQuaternions(w.q0, w.q1, e);
    if (w.t >= 1) { camTween = null; camera.up.set(0, 1, 0); w.done && w.done(); } return;
  }
  followPose(dt, camera);
}
function tweenCamera(toPos, toQuat, dur, toFollow, look) { return new Promise(res => { camTween = { p0: camera.position.clone(), q0: camera.quaternion.clone(), p1: toPos.clone(), q1: toQuat.clone(), t: 0, dur, toFollow, done: res, ...(look || {}) }; }); }
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function stepInteract() {
  const R = world.region; let best = null, bd = 1e9;
  if (!shell.papersOpen) for (const it of R.interact) { if (it.who && it.who.off) continue; const d = Math.hypot(it.pos.x - pl.x, it.pos.z - pl.z); if (d < it.r && d < bd) { bd = d; best = it; } }
  if (best !== nearest) { nearest = best; const p = $3('w3d-prompt'); p.hidden = !best; if (best) p.innerHTML = '<kbd>E</kbd> ' + best.label + ' <small>' + best.hint + '</small>'; }
}

/* ---------- one world: views and the transitions between them ---------- */
const body = document.body, sleep = ms => new Promise(r => setTimeout(r, ms));
function setView(v) { mode = v; dyn.grace = 1.5; if (v === 'map') drawSightings(); body.classList.remove('w3d-room', 'w3d-map', 'w3d-field', 'w3d-hall'); body.classList.add('w3d-' + v); if (v !== 'room') { nearest = null; $3('w3d-prompt').hidden = true; } refreshHud(); if (v !== 'map') canvas.focus(); }
async function fadeCanvas(on, ms = 420) { root.style.transition = 'opacity ' + ms + 'ms ease'; root.style.opacity = on ? '1' : '0'; await sleep(ms + 20); }

// the map table: its sheet shows zoom-6 tiles x32–37, y20–23; lean over it, then cross-fade to the same view on the live map
const T6 = 64, lngOf = x => x / T6 * 360 - 180, latOf = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / T6))) * 180 / Math.PI;
let activeTable = null, portableUp = false;
function overheadPose(tp = activeTable || world.region.tablePose) {
  const a = innerWidth / innerHeight, tf = Math.tan(camera.fov * Math.PI / 360);
  const h = Math.min(tp.w / 2 / (tf * a), tp.h / 2 / tf) * .98;
  poseCam.position.set(tp.x, tp.y + h, tp.z); poseCam.up.set(0, 0, -1); poseCam.lookAt(tp.x, tp.y, tp.z);
  const visW = 2 * h * tf * a; // metres of sheet across the screen; every sheet shows 6 tiles across
  return { pos: poseCam.position.clone(), quat: poseCam.quaternion.clone(), zoom: 6 + Math.log2(innerWidth / (visW * (6 / tp.w) * 256)) };
}
async function roomToMap() {
  if (mode !== 'room') return; mapFrom = 'room'; mode = 'trans'; shell.closePanel();
  // the nearest map table within reach; otherwise the aide sets up the folding table with the field map
  const R = world.region; let tp = null, bd = 9;
  for (const tb of R.tables) { const d = Math.hypot(tb.x - pl.x, tb.z - pl.z); if (d < bd) { bd = d; tp = tb; } }
  if (!tp) { const x = pl.x + Math.sin(pl.ry) * 2.2, z = pl.z + Math.cos(pl.ry) * 2.2; tp = R.setUpTable(x, z, pl.ry); shadowsDirty(); portableUp = true; toast('Your aide sets up the folding table and unrolls the field map.'); await sleep(450); }
  activeTable = tp; const o = overheadPose(tp); await tweenCamera(o.pos, o.quat, 1.05, false, { l0: cam.tgt.clone(), l1: V3(tp.x, tp.y, tp.z), u0: V3(0, 1, 0), u1: V3(0, 0, -1) });
  const m = desk.map; m.invalidateSize(); m.setView([latOf(22), lngOf(35)], Math.round(o.zoom), { animate: false });
  await fadeCanvas(false, 380); setView('map'); camera.up.set(0, 1, 0);
}
async function mapToRoom() {
  if (mode !== 'map') return; mode = 'trans'; shell.hideCard();
  const o = overheadPose(); camera.position.copy(o.pos); camera.quaternion.copy(o.quat); root.style.opacity = '0';
  const tp = activeTable || world.region.tablePose; camera.up.set(0, 0, -1); const lift = tweenCamera(o.pos, o.quat, 1.2, true, { l0: V3(tp.x, tp.y, tp.z), l1: cam.tgt.clone(), u0: V3(0, 0, -1), u1: V3(0, 1, 0) }); setView('trans'); tick(0); await fadeCanvas(true, 380);
  await lift; setView('room');
}
const battleCentreIn = m => m.getBounds().contains(lo(state.battleDemo.center, 0, 0));
async function ensureBattle() {
  if (battle && battle.season !== worldCues().season) battle = null; // the ground is painted for the season
  if (battle) return battle; showLoading('Laying out the field…');
  const mod = await import('./battle3d.js'); battle = await mod.createBattle({ renderer, actors, quality: Q(), makeSky, makeLights, toast, onRise: (x, z) => fieldToMap(x, z), winter: worldCues().season === 'winter' }); battle.season = worldCues().season;
  hideLoading(); return battle;
}
async function mapToField() {
  if (mode !== 'map') return; mode = 'trans'; shell.hideCard();
  const b = await ensureBattle(), [e, n] = toMeters(desk.map.getCenter());
  b.enter(); b.descend(e, -n); root.style.opacity = '0'; body.classList.remove('w3d-map'); setView('field'); tick(0); await fadeCanvas(true, 500);
}
async function fieldToMap(x, z) {
  if (mode !== 'field') return; if (account) return fieldToRoom(); mode = 'trans'; mapFrom = 'field';
  await fadeCanvas(false, 380); battle.leave();
  const m = desk.map; m.invalidateSize(); m.setView(lo(state.battleDemo.center, x, -z), 13, { animate: false });
  setView('map');
}
async function roomToField() { if (mode !== 'room') return; mode = 'trans'; await fadeCanvas(false, 300); const b = await ensureBattle(); b.setReadOnly(account); body.classList.toggle('w3d-account', account); b.enter(); setView('field'); tick(0); await fadeCanvas(true, 400); }
async function fieldToRoom() { if (mode !== 'field') return; mode = 'trans'; await fadeCanvas(false, 300); battle.leave(); account = false; battle.setReadOnly(false); body.classList.remove('w3d-account'); setView('room'); tick(0); await fadeCanvas(true, 400); }
async function enterHall() {
  if (mode !== 'room') return; nearest = null; $3('w3d-prompt').hidden = true; mode = 'trans'; await fadeCanvas(false, 350);
  if (!hall) { const m = await import('./interior.js'); hall = m.createInterior({ renderer }); }
  setView('hall'); tick(0); await fadeCanvas(true, 450); shell.showPanel('council');
}
async function leaveHall() { if (mode !== 'hall') return; mode = 'trans'; shell.closePanel(); await fadeCanvas(false, 300); pl.x = -188.5; pl.z = -10; pl.ry = Math.PI / 2; setView('room'); tick(0); await fadeCanvas(true, 400); }

async function goView(v) {
  if (mode === v || mode === 'trans' || mode === 'loading') return;
  nearest = null; $3('w3d-prompt').hidden = true;
  if (v === 'map') { if (mode === 'room') return roomToMap(); if (mode === 'field') { const b = battle.debug.cam; return fieldToMap(b.tx, b.tz); } if (mode === 'hall') { await leaveHall(); return roomToMap(); } }
  if (v === 'room') { if (mode === 'map') { if (mapFrom === 'field') { setView('trans'); body.classList.remove('w3d-map'); setView('room'); tick(0); return fadeCanvas(true); } return mapToRoom(); } if (mode === 'field') return fieldToRoom(); if (mode === 'hall') return leaveHall(); }
  if (v === 'field' && travel.mode() !== 'field' && !account) { toast('You are not with the army. Battles reach you as accounts in your letters.'); return; }
  if (v === 'field') { if (mode === 'room') return roomToField(); if (mode === 'map') { if (!battleCentreIn(desk.map)) document.querySelector('[data-book=battle]')?.click(), await sleep(1100); return mapToField(); } if (mode === 'hall') { await leaveHall(); return roomToField(); } }
}
/* ---------- going somewhere in person: at once, with the journey in the orders for the adjudicator ---------- */
async function journey(to, pmode) {
  if (mode === 'loading' || mode === 'trans') return;
  if (mode !== 'room') await goView('room');
  const j = travel.get(), from = state.player.locationId, A = loc(from), B = loc(to); if (j) { shell.removeOrder(j.line); shell.dropItem('journey'); }
  let line = null;
  if (to === from && pmode === state.player.mode) travel.set(null);
  else {
    const km = to !== from ? roadKm(A, B) : 0;
    line = to !== from ? 'Journey: I leave ' + A.name + ' for ' + B.name + ' at once, riding post with a small household — about ' + km + ' km by road, some ' + travelDays(km) + ' day' + (travelDays(km) > 1 ? 's' : '') + '.' + (pmode === 'field' ? ' There I join the army in camp.' : '') + ' Letters are to follow me on the road.'
      : pmode === 'field' ? 'I leave court and join the army in camp near ' + A.name + ' at once.' : 'I leave the army and return to court at ' + A.name + ' at once.';
    shell.setItem({ id: 'journey', kind: 'journey', text: line }); travel.set({ turn: state.turn, to, mode: pmode, line });
  }
  const km = B && travel.here() !== builtFor ? roadKm(loc(builtFor), B) : 0;
  showLoading(km ? 'Riding post to ' + B.name + ' — some ' + travelDays(km) + ' days on the road…' : pmode === 'field' ? 'Riding out to the army’s camp…' : 'Returning to headquarters…');
  await sleep(900); await buildWorld(); hideLoading(); applyAtmosphere(); refreshHud(); shell.refresh();
  toast(line ? 'You are at ' + locName(travel.here()) + (travel.mode() === 'field' ? ', with the army' : '') + '. The journey is in the day’s dispatch.' : 'You stay where your papers place you; the journey is struck from the dispatch.');
}
function act(a) {
  if (a.startsWith('go:')) { const id = a.slice(3); return id === 'cancel' ? journey(state.player.locationId, state.player.mode) : journey(id, travel.mode()); }
  if (a.startsWith('join:')) return journey(travel.here(), a.slice(5));
  if (a === 'travel') return shell.showTravel();
  if (a.startsWith('talk:')) { const c = state.cast.find(x => x.id === a.slice(5)); if (c) shell.showTalk([c]); return; }
  if (a === 'chamberlain') return shell.showTalk(state.cast.filter(c => c.id === 'maria_theresa' || c.id === 'francis_stephen'), true);
  if (a.startsWith('inspect:')) return shell.showInspect(a.slice(8));
  if (a.startsWith('toast:')) return toast(a.slice(6));
  if (a === 'gfx') { const p = $3('w3d-gfx'); p.hidden = !p.hidden; return; }
  if (a === 'room' || a === 'map' || a === 'field') return goView(a);
  if (a === 'battle') return goView(mode === 'field' ? 'room' : 'field');
  if (a === 'account') { account = travel.mode() !== 'field'; return mode === 'room' ? roomToField() : goView('room').then(() => roomToField()); }
  if (a.startsWith('hours:')) return advanceClock(+a.slice(6));
  if (a.startsWith('sound:')) return sound.cue(a.slice(6));
  if (a === 'archive') return shell.showLetters(null, 'archive');
  if (a === 'heir') return beginAsHeir();
  if (a.startsWith('post:')) { const n = +a.slice(5); newDay(); if (n) sound.cue('letters'); pendingArrival = n > 0; shell.refresh(); world.region.setLetters(shell.unread().length); refreshHud(); if (n) toast(fmtDate(shell.today) + ' — the day passes.'); return; }
  if (a.startsWith('sighting:')) return showSighting(a.slice(9));
  if (a === 'hall') return enterHall();
  if (a === 'orders') return shell.toggleSheet();
  if (a === 'notebook') return shell.showNotebook();
  if (['council', 'record', 'staff', 'army', 'reports'].includes(a)) { shell.showPanel(a); if (a === 'reports') world && world.region.setLetters(shell.unread().length); }
}

/* ---------- the courier: sealed orders ride out; the reply brings him back ---------- */
const courierSaved = () => { try { return JSON.parse(localStorage.getItem(COURIER_KEY) || 'null'); } catch { return null; } };
const courierSave = v => { try { v ? localStorage.setItem(COURIER_KEY, JSON.stringify(v)) : localStorage.removeItem(COURIER_KEY); } catch { } };
function onSeal() {
  const c = world.region.courierRide; if (c.state === 'home') c.depart(mode !== 'room');
  courierSave({ away: true, turn: state.turn });
  toast('Your orders are sealed and copied. The courier rides with them; paste the reply on the order sheet when it comes.');
}
function syncCourierOnBoot() {
  const s = courierSaved(); if (!s || !s.away) return;
  if (state.turn > s.turn) { pendingArrival = true; world.region.courierRide.depart(true); } else world.region.courierRide.depart(true);
}
let pendingArrival = false, lastTurn = null;
async function onNewTurn() {
  loadClock(); applyAtmosphere();
  if (builtFor !== travel.here() || builtMode !== travel.mode() || builtCues !== JSON.stringify(worldCues())) { showLoading(builtFor !== travel.here() ? 'Riding to ' + locName(travel.here()) + '…' : travel.mode() === 'field' ? 'Joining the army in camp…' : 'Returning to headquarters…'); await sleep(40); await buildWorld(); hideLoading(); }
  if (courierSaved()?.away) pendingArrival = true;
  shell.refresh(); world.region.setLetters(shell.unread().length);
}
function stepCourierArrival() {
  if (!pendingArrival || mode !== 'room') return; pendingArrival = false; courierSave(null);
  const atGate = Math.hypot(pl.x + 157, pl.z + 10) < 45, n = shell.unread().length, h = loc(travel.here()), d = h && h.id !== 'vienna' ? letterDays(roadKm(loc('vienna'), h)) : 0;
  const msg = (d ? ', ' + d + ' day' + (d > 1 ? 's' : '') + ' on the road from Vienna' : '') + (n ? ': ' + n + ' new letter' + (n > 1 ? 's' : '') + ' (Letters, R).' : '.');
  if (atGate) world.region.courierRide.arrive(false, () => toast('A courier rides in with despatches' + msg));
  else world.region.courierRide.arriveAt(pl.x, pl.z, () => toast('The courier has found you on the road with despatches' + msg));
  sound.cue('hoof', 4);
  toast(state.world && (state.world.roads === 'heavy' || state.world.roads === 'impassable') ? 'Hoofbeats at last — the roads are heavy, and the courier is late.' : 'Hoofbeats: a courier is coming.');
}

/* ---------- the map shows what you have been told ---------- */
const sightLayer = L.layerGroup().addTo(desk.map);
function drawSightings() {
  sightLayer.clearLayers();
  for (const r of shell.seen()) { const g = r.sighting; if (!g || typeof g.lat !== 'number') continue;
    const who = (state.cast.find(c => c.id === r.from_id) || {}).name || 'a letter';
    L.circleMarker([g.lat, g.lon], { radius: 8, color: '#8a2f26', weight: 2, fillColor: '#b8453a', fillOpacity: .45 }).bindTooltip(g.what + ' — so ' + who + ' reports' + (r.source ? ' (from ' + r.source + ')' : ''), { direction: 'top' }).addTo(sightLayer).w3d = r.id; }
  const j = travel.get(), h = j && loc(travel.here()); if (h) L.circleMarker([h.lat, h.lon], { radius: 10, color: '#ece6da', weight: 2, fillColor: '#16181b', fillOpacity: .8 }).bindTooltip('You are here', { permanent: true, direction: 'right' }).addTo(sightLayer);
}
async function showSighting(id) {
  const r = state.reports.find(x => x.id === id); if (!r || !r.sighting) return;
  if (mode !== 'map') await goView('map'); await sleep(200); drawSightings();
  desk.map.setView([r.sighting.lat, r.sighting.lon], 7); sightLayer.eachLayer(m => { if (m.w3d === id) m.openTooltip(); });
}

/* ---------- weather and light follow the campaign date ---------- */
function applyAtmosphere(night) {
  const d = new Date(state.date + 'T12:00:00'), m = d.getMonth(), h = [...(state.campaignId + state.turn)].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 3);
  const weather = state.turn === 0 ? 'clear' : ['clear', 'haze', 'overcast', 'mist', 'clear'][Math.abs(h) % 5];
  const winter = m === 11 || m <= 1, summer = m >= 5 && m <= 7, elev = winter ? .22 : summer ? .55 : .36;
  const day = Math.max(0, Math.sin((clockH - 6.5) / 12.5 * Math.PI)), az = (clockH - 12.5) / 7 * 1.2; // the sun crosses from east to west
  sunDir.set(Math.cos(az) * .8 + .1, Math.max(.06, elev * (.35 + .65 * day)), Math.sin(az) * .8 + .2).normalize();
  if (!night && day < .1) night = true;
  const W = { clear: [3.4, 0xffd9a8, 1.25, 0x5b8fd6, 0xf3dcb4, 0xe8d4b2, 110, 1500], haze: [2.6, 0xffe2b8, 1.4, 0x7aa0d0, 0xf0dcc0, 0xe6d6bc, 60, 900], overcast: [1.1, 0xe8e4dc, 1.75, 0x8e98a6, 0xcfccc4, 0xc4c0b8, 80, 950], mist: [.9, 0xf0e8dc, 1.6, 0xb8bcc0, 0xdcdad2, 0xd6d4cc, 12, 280] }[weather];
  lights.sun.intensity = W[0] * (winter ? .8 : 1); lights.sun.color.set(winter ? 0xf2e6d8 : W[1]); lights.hemi.intensity = W[2];
  const u = skyMesh.material.uniforms; u.top.value.set(W[3]); u.hor.value.set(W[4]);
  scene.fog.color.set(W[5]); scene.fog.near = W[6]; scene.fog.far = W[7]; scene.background.set(W[5]);
  cloudG.userData.mat.emissiveIntensity = weather === 'overcast' || weather === 'mist' ? .45 : .75;
  atmos = weather; shadowsDirty();
  if (!night && day < .45) { const k = 1 - day / .45; lights.sun.intensity *= 1 - .55 * k; lights.sun.color.lerp(new THREE.Color(0xff9a5a), .6 * k); u.hor.value.lerp(new THREE.Color(0xf0a070), .5 * k); }
  world && world.region.setNight(night || clockH < 6.5 || clockH > 19.3);
  if (night) { lights.sun.intensity = .06; lights.sun.color.set(0x8aa0d0); lights.hemi.intensity = .14; u.top.value.set(0x02040a); u.hor.value.set(0x0c121c); scene.fog.color.set(0x0e131b); scene.fog.near = 25; scene.fog.far = 320; scene.background.set(0x0e131b); cloudG.userData.mat.emissiveIntensity = .05; }
}
let atmos = 'clear';

/* ---------- input: capture phase so the desk's own shortcuts don't fire under the 3D view ---------- */
const typing = e => e.target && (['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable);
addEventListener('keydown', e => {
  sound.gesture();
  if (mode === 'loading' || mode === 'trans') return;
  if (introOn && e.key === 'Escape') { e.stopImmediatePropagation(); morning(); return; }
  if (e.key === 'Escape' && !document.querySelector('dialog[open]')) {
    if (typing(e)) { e.target.blur(); }
    if (shell.closeTop()) { e.stopImmediatePropagation(); return; }
    if (mode === 'map') { if (typeof toolMode !== 'undefined' && toolMode) return; e.stopImmediatePropagation(); goView(mapFrom === 'field' ? 'field' : 'room'); return; }
    if (mode === 'hall') { e.stopImmediatePropagation(); goView('room'); return; }
  }
  if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
  if (mode === 'map') { if (e.code === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); goView(mapFrom === 'field' ? 'field' : 'room'); } return; } // desk map hotkeys stay live
  if (mode === 'field' && account && e.key === 'Escape') { e.stopImmediatePropagation(); goView('room'); return; }
  if (mode === 'field') { if (battle.key(e)) { e.stopImmediatePropagation(); e.preventDefault(); } return; }
  e.stopImmediatePropagation();
  const k = e.code; if (mode === 'room') keys.add(k);
  if (k === 'KeyE' && nearest && mode === 'room') act(nearest.act);
  else if (k === 'KeyM' || k === 'Tab') { e.preventDefault(); act('map'); } else if (k === 'KeyO') act('orders'); else if (k === 'KeyC') act('council'); else if (k === 'KeyR') act('reports'); else if (k === 'KeyN') act('notebook'); else if (k === 'KeyT') act('travel'); else if (k === 'KeyB') act('battle'); else if (k === 'KeyG') act('gfx');
  if (k.startsWith('Arrow') || k === 'Space') e.preventDefault();
}, true);
addEventListener('keyup', e => { keys.delete(e.code); if (mode === 'field' && battle) battle.keyUp(e); }, true);
addEventListener('blur', () => keys.clear());
addEventListener('pointerdown', () => sound.gesture(), true);

let drag = null;
canvas.addEventListener('pointerdown', e => { canvas.focus(); drag = { x: e.clientX, y: e.clientY, moved: 0, b: e.button }; canvas.setPointerCapture(e.pointerId); if (mode === 'field') battle.pointerDown(e); });
canvas.addEventListener('pointermove', e => {
  if (mode === 'field') { battle.pointerMove(e, drag); if (drag) drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY); return; }
  if (!drag || mode !== 'room') return; drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
  cam.yaw -= e.movementX * .005; cam.pitch = Math.min(1.25, Math.max(.05, cam.pitch + e.movementY * .004));
});
canvas.addEventListener('pointerup', e => { const d = drag; drag = null; if (mode === 'field') { battle.pointerUp(e, d); return; } if (d && d.moved < 6 && mode === 'room') clickWorld(e); });
canvas.addEventListener('wheel', e => { e.preventDefault(); if (mode === 'field') { battle.wheel(e); return; } if (mode !== 'room') return; cam.dist = Math.min(26, Math.max(3, cam.dist * (1 + Math.sign(e.deltaY) * .1))); }, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
function clickWorld(e) {
  const r = canvas.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera); ray.far = 60;
  for (const it of world.region.interact) {
    if (it.who && it.who.off) continue;
    if (!it.obj) continue; const h = ray.intersectObject(it.obj, true)[0];
    if (h) { if (Math.hypot(it.pos.x - pl.x, it.pos.z - pl.z) < 9) act(it.act); else toast('Walk closer: ' + it.label.toLowerCase() + '.'); return; }
  }
}
// on the map: scroll out past the table's extent to stand up; zoom into the battle ground to go down into the field
let outWheel = 0;
desk.map.getContainer().addEventListener('wheel', e => {
  if (mode !== 'map') return;
  if (e.deltaY > 0 && desk.map.getZoom() <= Math.max(4, desk.map.getMinZoom())) { if (++outWheel >= 2) { outWheel = 0; goView('room'); } } else outWheel = 0;
}, true);
desk.map.on('zoomend', () => { if (mode === 'map' && travel.mode() === 'field' && desk.map.getZoom() >= 14 && battleCentreIn(desk.map)) mapToField(); refreshHud(); });

/* ---------- HUD ---------- */
let toastT = 0;
function toast(m) { const t = $3('w3d-toast'); t.textContent = m; t.classList.add('on'); toastT = 5; }
new MutationObserver(() => { const s = $3('status').textContent; if (s && mode !== 'map') toast(s); }).observe($3('status'), { childList: true, characterData: true, subtree: true });
function refreshHud() {
  if (!shell) return; const S = state;
  const view = mode === 'map' ? 'map' : mode === 'field' ? 'field' : mode === 'trans' ? null : 'room';
  if (mode === 'field') shell.refresh('field', 'The field · ' + (S.battleDemo.place || '').split('—')[0].trim(), account ? 'An account of a battle you were not at · Esc to put it down' : travel.mode() === 'field' ? 'Your orders are the fight itself · scroll far out to rise onto the map' : 'At court this is a rehearsal on the table; the adjudicator decides · scroll far out to rise onto the map');
  else if (mode === 'map') shell.refresh('map', 'The map table', (battleCentreIn(desk.map) && desk.map.getZoom() >= 10 ? 'Zoom in on the battle ground to go down into the field · ' : '') + 'Right-click a place to add it to your orders · scroll out or Esc to stand up');
  else if (mode === 'hall') shell.refresh('room', 'The Conference chamber', 'The council in session · Esc to step back outside');
  else shell.refresh(view, world ? world.region.zoneName(pl.x, pl.z) : 'Headquarters', (worldCues().season === 'winter' ? 'Snow on the ground · ' : '') + { clear: 'fair weather', haze: 'a hazy day', overcast: 'grey skies', mist: 'mist on the fields' }[atmos].replace(/^./, c => worldCues().season === 'winter' ? c : c.toUpperCase()));
  $3('w3d-help').innerHTML = mode === 'field' && account ? 'Drag to turn · right-drag or <kbd>WASD</kbd> to pan · wheel to zoom · click a formation to read what is known of it · <kbd>Esc</kbd> put the account down'
    : mode === 'field'
    ? 'Click a formation · Shift-click to add · drag to rotate · right-drag or WASD to pan · wheel to zoom · <kbd>M</kbd>ove <kbd>F</kbd>ace <kbd>H</kbd>old then click the ground · <kbd>Enter</kbd> run 15 minutes · <kbd>Tab</kbd> map'
    : '<kbd>WASD</kbd> walk · drag to look · <kbd>E</kbd> act on what is in front of you · <kbd>M</kbd> map · <kbd>R</kbd> letters · <kbd>O</kbd> dispatch · <kbd>N</kbd> notebook · <kbd>T</kbd> travel';
}
function showLoading(t) { const l = $3('w3d-loading'); l.querySelector('.eyebrow').textContent = t; l.hidden = false; }
function hideLoading() { $3('w3d-loading').hidden = true; }

// graphics panel
const gp = { auto: $3('g-auto'), preset: $3('g-preset'), scale: $3('g-scale'), shadows: $3('g-shadows'), veg: $3('g-veg'), fps: $3('g-fps'), sound: $3('g-sound') };
function syncGfxUi() { const q = Q(); gp.preset.value = gfx.preset; gp.scale.value = q.scale; $3('g-scale-v').textContent = Math.round(q.scale * 100) + '%'; gp.shadows.value = String(q.shadows); gp.veg.value = gfx.veg || gfx.preset; gp.fps.checked = gfx.fps; gp.auto.checked = gfx.auto; gp.sound.checked = gfx.sound; $3('w3d-stats').hidden = !gfx.fps; }
gp.preset.onchange = () => { const vegWas = gfx.veg || gfx.preset; gfx = { ...gfx, preset: gp.preset.value, scale: null, shadows: null, veg: null }; saveGfx(); syncGfxUi(); applyGfx(); if ((gfx.veg || gfx.preset) !== vegWas) rebuild(); };
gp.scale.oninput = () => { gfx.scale = +gp.scale.value; saveGfx(); syncGfxUi(); applyGfx(); };
gp.shadows.onchange = () => { gfx.shadows = +gp.shadows.value; saveGfx(); applyGfx(); };
gp.veg.onchange = () => { gfx.veg = gp.veg.value; saveGfx(); rebuild(); };
gp.auto.onchange = () => { gfx.auto = gp.auto.checked; dyn.k = 1; saveGfx(); applyGfx(); };
gp.fps.onchange = () => { gfx.fps = gp.fps.checked; saveGfx(); syncGfxUi(); };
gp.sound.onchange = () => { gfx.sound = gp.sound.checked; saveGfx(); sound.enabled = gfx.sound; };
$3('g-tools').onclick = () => $3('toggleT').click(); $3('g-layers').onclick = () => $3('toggleY').click();
async function rebuild() { showLoading('Replanting…'); await sleep(30); await buildWorld(); hideLoading(); }

/* ---------- loop ---------- */
const clk = new THREE.Clock(); let frames = 0, acc = 0, ftimes = [], shadowTick = 0, paperTick = 0;
const perf = { fps: 0, ms: 0, calls: 0, tris: 0 };
function loop() { requestAnimationFrame(loop); const dt = Math.min(.05, clk.getDelta()); if (mode === 'map' && state.turn !== lastTurn) { lastTurn = state.turn; onNewTurn(); } if (mode === 'loading' || mode === 'map' || document.hidden) { sound.update(dt, uTime.value, 1e9, 1e9, true); return; } tick(dt); }
function tick(dt) {
  const t0 = performance.now(); adaptResolution(dt);
  uTime.value += dt; setWindTime(uTime.value);
  if (toastT > 0 && (toastT -= dt) <= 0) $3('w3d-toast').classList.remove('on');
  if (state.turn !== lastTurn) { const first = lastTurn === null; lastTurn = state.turn; if (!first) onNewTurn(); }
  const room = mode === 'room' || (mode === 'trans' && !body.classList.contains('w3d-field') && !body.classList.contains('w3d-hall') && world);
  if (room) {
    stepPlayer(dt); stepCamera(dt); if (mode === 'room') stepInteract(); stepCourierArrival();
    if (mode === 'room' && !shell.papersOpen && !introOn && clockH < 23.5) { const b = clockH; clockH += dt / 40; if (Math.floor(clockH * 4) !== Math.floor(b * 4)) { saveClock(); applyAtmosphere(); } if (Math.floor(clockH) !== Math.floor(b)) onHour(Math.floor(clockH)); }
    world.region.update(dt, uTime.value, camera, pl);
    { const p = player.obj.position, sx = Math.round(p.x / 8) * 8, sz = Math.round(p.z / 8) * 8, k = sx + ',' + sz; // the shadow window moves in 8 m steps
      if (k !== shadowKey || ++shadowTick % 240 === 0) { shadowKey = k; lights.follow(tmp2.set(sx, p.y, sz)); renderer.shadowMap.needsUpdate = true; } }
    skyMesh.position.copy(camera.position); cloudG.rotation.y += dt * .002;
    if (portableUp && mode === 'room' && activeTable && Math.hypot(activeTable.x - pl.x, activeTable.z - pl.z) > 7) { world.region.packTable(); portableUp = false; activeTable = null; shadowsDirty(); } // the aide packs the folding table when you move on
    if (mode === 'room') { const z = world.region.zoneName(pl.x, pl.z); if ($3('sh-zone').textContent !== z) $3('sh-zone').textContent = z; }
    if (!shell.papersOpen || mode !== 'room' || ++paperTick % 8 === 0) renderer.render(scene, camera); // behind open papers the dimmed world needs few frames
    const R = world.region; sound.update(dt, uTime.value, Math.min(...R.fires.map(([x, z]) => Math.hypot(x - pl.x, z - pl.z))), Math.hypot(R.camp.x - pl.x, R.camp.z - pl.z), shell.papersOpen, { night: clockH < 6.5 || clockH > 19.5 || introOn });
  } else if (body.classList.contains('w3d-field')) { battle.frame(dt, uTime.value); sound.update(dt, uTime.value, 1e9, 120, shell.papersOpen); }
  else if (body.classList.contains('w3d-hall')) { renderer.shadowMap.needsUpdate = true; hall.frame(dt); sound.update(dt, uTime.value, 1e9, 1e9, true); }
  frames++; acc += dt; ftimes.push(performance.now() - t0); if (ftimes.length > 120) ftimes.shift();
  if (acc > .5) {
    perf.fps = Math.round(frames / acc); perf.ms = +(ftimes.reduce((a, b) => a + b, 0) / ftimes.length).toFixed(2); perf.calls = renderer.info.render.calls; perf.tris = renderer.info.render.triangles; frames = 0; acc = 0;
    if (gfx.fps) $3('w3d-stats').textContent = perf.fps + ' fps · cpu ' + perf.ms + ' ms · ' + perf.calls + ' draws · ' + Math.round(perf.tris / 1000) + 'k tris · ' + renderer.domElement.width + '×' + renderer.domElement.height;
    refreshHud();
  }
}

/* ---------- the first hour: the night of 20 October 1740, a courier, one letter ---------- */
const INTRO_KEY = 'cabinet-of-war:w3d-opening';
async function opening() {
  introOn = true; $3('w3d-skip-opening').hidden = false; body.classList.add('w3d-intro'); applyAtmosphere(true); world.region.setNight(true);
  pl.x = world.region.spawn.x; pl.z = world.region.spawn.z; pl.ry = Math.PI / 2; cam.yaw = -Math.PI / 2 - .25; cam.pitch = .22; cam.dist = 8;
  await sleep(2600); if (!introOn) return;
  world.region.courierRide.arrive(false, () => { if (!introOn) return;
    shell.showSingle({ id: 'opening', kind: 'opening', from: 'The Obersthofmeister’s office', place: 'vienna', dated: '1740-10-20', title: 'The Emperor is dead', claim: 'demo', via: 'courier',
      text: 'His Imperial and Catholic Majesty the Emperor Charles VI departed this life in the night, at the Favorita. Her Royal Highness the Archduchess Maria Theresa succeeds to all his hereditary lands. You will hold yourself ready to serve, and await Her Majesty’s commands, which will reach you in the morning.' }, 'Put out the candle', morning); });
}
async function morning() {
  if (!introOn) return; introOn = false; $3('w3d-skip-opening').hidden = true; shell.closeTop(); keys.clear(); try { localStorage.setItem(INTRO_KEY, '1'); } catch { }
  showLoading('The morning of 21 October 1740'); await sleep(1700);
  world.region.setNight(false); applyAtmosphere(); body.classList.remove('w3d-intro'); world.region.courierRide.arrive(true);
  pl.x = -176; pl.z = -16; pl.ry = Math.PI * .85; hideLoading(); world.region.setLetters(shell.unread().length); refreshHud();
  canvas.focus(); toast('Letters are waiting on your desk.');
}
async function mockReply(name) { // test replies in w3d/mocks: a patch over the current state, advanced one turn
  const m = await (await fetch('w3d/mocks/' + name + '.json', { cache: 'no-store' })).json(), s = Object.assign(JSON.parse(JSON.stringify(state)), m.patch);
  if (m.patch.hidden) s.hidden = Object.assign({}, state.hidden, m.patch.hidden);
  s.turn = state.turn + 1; s.parentTurn = state.turn; if (s.battleDemo) delete s.battleDemo._sim;
  reviewWorld(JSON.stringify(s)); await sleep(150); document.getElementById('accept').click(); await sleep(300); return state.turn;
}

/* ---------- disgrace is not the end: your heir inherits your letters, enemies and name ---------- */
function beginAsHeir() {
  const st = (state.hidden || {}).standing || {}, legacy = { from: state.player.name, ended: state.date, memoirs: (draft.w3d && draft.w3d.memoir) || '', friends: Object.keys(st).filter(k => st[k] === 'warm'), enemies: Object.keys(st).filter(k => st[k] === 'hostile'), dismissed: !!state.player.dismissed };
  try { snapshotLocal(); localStorage.setItem('cabinet-of-war:w3d-legacy', JSON.stringify(legacy)); localStorage.removeItem('cabinet-of-war:state8:' + state.campaignId); for (const k of ['opening', 'post', 'clock', 'sent', 'travel']) localStorage.removeItem('cabinet-of-war:w3d-' + k); } catch { }
  location.reload();
}

/* ---------- boot ---------- */
let shell = null; const sound = createSound();
(async function boot() {
  // original-desk bug: a persisted battleDemo._sim makes initSim() skip setting BS.mem, so runPhase() throws after a reload
  if (!BS.mem) BS.mem = battleMem();
  // a new campaign begun as the heir of the last one
  try { const lg = JSON.parse(localStorage.getItem('cabinet-of-war:w3d-legacy') || 'null'); if (lg && state.turn === 0 && !state.legacy) { state.legacy = lg; state.player.name = 'The heir of ' + lg.from; state.player.note = 'A new campaign as the heir of ' + lg.from + '; the adjudicator decides who that is. ' + (state.player.note || ''); persistState(); } } catch { }
  // older saves predate the open-ground deployment (see src/w3d_build.py); move an un-fought battle the same way
  { const bd = state.battleDemo, SHIFT = { A: [360, -690], B: [300, -360] };
    if (!bd.deployment && !BS.log.length && !draft.battleResult) {
      for (const u of bd.units) { const [de, dn] = SHIFT[u.side]; u.e += de; u.n += dn; if (u.seenE != null) { u.seenE += de; u.seenN += dn; } }
      for (const o of bd.options || []) for (const a of o.arrows || []) { const [de, dn] = SHIFT[a.side]; a.from = [a.from[0] + de, a.from[1] + dn]; a.to = [a.to[0] + de, a.to[1] + dn]; }
      bd.deployment = 'Armies moved as whole formations to open ground (older save).'; draft.armyOrders = {}; persistState(); saveDraft();
    } }
  body.classList.add('w3d-on', 'w3d-room');
  showLoading('Raising the country…'); syncGfxUi();
  shell = createShell({ act, onSeal, clock });
  // the commission, the world and the secretary's remarks came with the 3D page's opening state; older saves at turn 0 take them from it
  // a campaign still at its opening takes the researched opening (letters, counsel, people, household, rival, canon)
  if (state.turn === 0) { const init = JSON.parse(document.getElementById('initial-state').textContent);
    if ((state.openingVersion || 1) < (init.openingVersion || 1)) { for (const k of ['openingVersion', 'mandate', 'world', 'remarks', 'household', 'reports', 'decision', 'knowledge', 'forces', 'forcesNote', 'sourcesAppendix', 'cast', 'locations', 'player']) if (init[k] != null) state[k] = init[k]; state.hidden = Object.assign(state.hidden || {}, { standing: init.hidden.standing, rival: init.hidden.rival, memory: init.hidden.memory, canon: init.hidden.canon }); draft.option = ''; persistState(); saveDraft(); } }
  // this campaign's departures from history, drawn once and kept hidden: knowing the history helps, but is not a walkthrough
  if (!(state.hidden || {}).divergences) { const D = [['frederick_waits', .22, 'Frederick waits until spring 1741 before moving on Silesia.'], ['bavaria_first', .15, 'Bavaria moves on Upper Austria before Prussia moves on Silesia.'], ['saxony_early', .2, 'Saxony joins the coalition against the succession early.'], ['fleury_dies', .12, 'Cardinal Fleury dies in the winter of 1740–41, and French policy is decided by younger, bolder men.'], ['prussian_offer', .25, 'Frederick’s offer — support for the succession in return for Silesia — is sincere and could be negotiated down.']];
    const pick = D.filter(([, p]) => Math.random() < p).map(([id, , text]) => ({ id, text })); state.hidden = Object.assign(state.hidden || {}, { divergences: pick.length ? pick : [{ id: 'history', text: 'Events follow their historical course unless the player’s actions change them.' }] }); persistState(); }
  loadClock();
  // the keeper of continuity: a reply is checked against what is settled before you accept it
  { const review = window.reviewWorld; window.reviewWorld = text => { review(text); if (!candidate) return; const issues = checkContinuity(state, candidate); if (!issues.length) return;
    const b = $3('confirm-body'), box = document.createElement('div'); box.className = 'w3d-continuity'; box.innerHTML = '<b>' + (issues.some(i => i.level === 'error') ? 'This reply contradicts what is settled' : 'This reply may contradict what is settled') + '</b>' + issues.map(i => '<p class="' + i.level + '">' + i.text.replace(/[<>&]/g, '') + '</p>').join('');
    const c = document.createElement('button'); c.className = 'btn'; c.textContent = 'Copy a correction request for Claude'; c.onclick = () => { navigator.clipboard.writeText(correctionRequest(issues, candidate.turn)).then(() => toast('Correction request copied — paste it into the same chat.'), () => toast('Could not copy.')); }; box.append(c); b.append(box); }; }

  scene.background = new THREE.Color(0xf1d9b0); scene.fog = new THREE.Fog(0xe8d4b2, 110, 1500);
  skyMesh = makeSky(scene, sunDir); lights = makeLights(scene, sunDir, 75, Q().shadows); cloudG = clouds(scene, Math.random);
  applyAtmosphere();
  actors = await initActors();
  await buildWorld();
  applyGfx(); lastTurn = state.turn; hideLoading(); setView('room'); camera.position.set(pl.x + 6, 30, pl.z + 12); camera.lookAt(pl.x, 6, pl.z);
  tweenCamera(camera.position, camera.quaternion, 2.2, true);
  sound.enabled = gfx.sound;
  let opened = false; try { opened = !!localStorage.getItem(INTRO_KEY); } catch { }
  if (state.turn === 0 && !opened) opening();
  loop();
  window.__w3d = { get mode() { return mode; }, perf, get world() { return world; }, get battle() { return battle; }, get shell() { return shell; }, pl, cam, camera, renderer, act, goView, keys, mockReply, drawSightings, gfx: () => Q(), step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt); renderer.getContext().finish(); } };
})().catch(e => { console.error(e); showLoading('3D view failed to start: ' + e.message + ' — the desk below still works.'); setTimeout(() => { root.remove(); float.remove(); body.classList.remove('w3d-on', 'w3d-room'); }, 4000); });
