import * as THREE from 'three';
import { makeNoise, rngFrom, smooth, lerp, stdMat, tint, merge, place, box, setWindTime, disposeTree } from './lib.js';
import { axis, buildTerrain } from './terrain.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildForest, AUTUMN, FIRS } from './nature.js';
import * as P from './props.js';
import { infantryFrames, cavalryFrames, tinyFrames, tinyCavalryFrames, FramePool } from './figures.js';

/* The table battle in 3D. Everything shown comes from state.battleDemo and the desk's battle engine
   (battle.js / army.js): orders go through armyOrders()/selectUnits()/armyMapClick(), time through runPhase().
   World axes: x = east (e), z = −north (−n). The ground is state.battleDemo.ground (w3d/ground.js): its land cover is
   TER, its relief real (metres above the field's lowest point; level country is raised up to 2× so it reads). */
export async function createBattle({ renderer, actors, quality, makeSky, makeLights, toast, onRise, winter, ground }) {
  const N = makeNoise(1741), rnd = rngFrom(41), scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 2, 30000);
  const sunDir = new THREE.Vector3(-.55, .42, .5).normalize();
  scene.background = new THREE.Color(0xe8d4b2); scene.fog = new THREE.Fog(0xe6d3b2, 2500, 11000);
  const sky = makeSky(scene, sunDir); const lights = makeLights(scene, sunDir, 600, quality.shadows);
  lights.sun.shadow.camera.far = 5000;

  /* ---------- ground ---------- */
  const W = TER.w, H = TER.h, cell = TER.cell;
  const cellAt = (x, z) => terrainAt(x, -z);
  // drawn land cover: the same 30 m grid sampled through a gentle warp (≤ ~18 m) so edges look natural; the sim still uses cellAt
  const landAt = (x, z) => cellAt(x + 18 * N(x / 95, z / 95), z + 18 * N(x / 95 + 31, z / 95 - 17));
  const near = (r, c, t) => { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const row = TER.rows_str[r + dr]; if (row && +row[c + dc] === t) return true; } return false; };
  const outside = (x, z) => Math.hypot(Math.max(0, Math.abs(x) - W / 2), Math.max(0, Math.abs(z) - H / 2));
  // relief: metres above the field's lowest point, × EXAG (1 for hilly ground, up to 2 for a plain of a few metres)
  const G = ground || window.__ground;
  let lo = 0, hi = 0; if (G) { lo = Infinity; hi = -Infinity; for (const v of G.inner) { if (v < lo) lo = v; if (v > hi) hi = v; } }
  const EXAG = Math.min(2, Math.max(1, 30 / Math.max(1, hi - lo)));
  const elevAt = G ? (x, z) => (G.elev(x, -z) - lo) * EXAG : (x, z) => 7 + 5 * N.fbm(x / 1100, z / 1100, 3);
  // brooks narrower than a cell are water to the sim but drawn at their own width; broad water (rivers, ponds) fills cells
  const brook = new Set(), rivers = (G && G.rivers) || [];
  for (const rv of rivers) { if (rv.w >= 20) continue; const p = rv.p;
    for (let i = 1; i < p.length; i++) { const [x1, y1] = p[i - 1], [x2, y2] = p[i], k = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 10));
      for (let j = 0; j <= k; j++) { const c = Math.floor((x1 + (x2 - x1) * j / k + W / 2) / cell), r = Math.floor((H / 2 - (y1 + (y2 - y1) * j / k)) / cell); brook.add(r * 1000 + c); } } }
  const isBrook = (x, z) => brook.has(Math.floor((H / 2 + z) / cell) * 1000 + Math.floor((x + W / 2) / cell));
  const drawnAt = (x, z) => { const t = landAt(x, z); return t === 2 && isBrook(x + 18 * N(x / 95, z / 95), z + 18 * N(x / 95 + 31, z / 95 - 17)) ? 0 : t; };
  const frac = (x, z, t) => { let k = 0; for (const [dx, dz] of [[-12, -12], [12, -12], [-12, 12], [12, 12], [0, 0]]) if (drawnAt(x + dx, z + dz) === t) k++; return k / 5; };
  const height = (x, z) => elevAt(x, z) + .35 * N.fbm(x / 60, z / 60, 2) - (outside(x, z) > 0 ? 0 : frac(x, z, 2) * 3.5);
  // the battlefield's land cover is painted into a texture (~4.6 m per pixel) so edges are smooth whatever the mesh
  // resolution; vertex colours carry only the countryside outside the battle map
  const CW = 1600, CH = Math.round(CW * H / W), cvs = document.createElement('canvas'); cvs.width = CW; cvs.height = CH;
  { const ctx = cvs.getContext('2d'), img = ctx.createImageData(CW, CH), D = img.data;
    const hex = h => [h >> 16 & 255, h >> 8 & 255, h & 255], mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    const PASTURE = hex(0x7f9645), STUBBLE = hex(0xb7a463), FALLOW = hex(0x96974f), PLOUGH = hex(0x8a6e4c), WOOD = hex(0x4e6532), VILLAGE = hex(0x9c9670), WATER = hex(0x5c716a);
    const MARSH = hex(0x7d8752), REED = hex(0x9a8f5a), POOL = hex(0x66786c), SOIL = hex(0x8b7254), VINE = hex(0x6f7434);
    const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    for (let j = 0; j < CH; j++) for (let i = 0; i < CW; i++) {
      const x = -W / 2 + (i + .5) / CW * W, z = -H / 2 + (j + .5) / CH * H, lt = drawnAt(x, z); let c;
      if (lt === 1) c = WOOD; else if (lt === 2) c = WATER; else if (lt === 3) c = VILLAGE;
      else if (lt === 4) { const a = N(x / 40, z / 40), b = N.fbm(x / 150 + 4, z / 150, 2); c = mix(MARSH, REED, ss(-.2, .5, a)); if (b > .35) c = mix(c, POOL, ss(.35, .55, b)); }
      else if (lt === 5) { // vines in rows along the contour, ~11 m apart in the painting
        const gx = elevAt(x + 6, z) - elevAt(x - 6, z), gz = elevAt(x, z + 6) - elevAt(x, z - 6), gl = Math.hypot(gx, gz) || 1, s = gl > .02 ? (x * gx + z * gz) / gl : x;
        c = mix(SOIL, VINE, .5 + .5 * Math.sin(s / 11 * Math.PI * 2)); }
      else { // open country after harvest: pasture, stubble, fallow and a little ploughland in soft irregular patches, no straight lines
        const a = N.fbm(x / 900, z / 900, 3), b = N.fbm(x / 340 + 7, z / 340 - 3, 3), d = N(x / 140 - 11, z / 140 + 5);
        c = mix(PASTURE, STUBBLE, ss(-.1, .25, a + b * .35));
        c = mix(c, FALLOW, ss(.15, .45, b) * .7);
        c = mix(c, PLOUGH, ss(.35, .6, d * .6 + b * .5) * .35);
      }
      if (winter && lt !== 2) c = mix(c, [236, 240, 243], lt === 1 ? .35 : .72 + .2 * N(x / 60, z / 60));
      const k = 1 + N.fbm(x / 45, z / 45, 2) * .07, o = (j * CW + i) * 4; D[o] = c[0] * k; D[o + 1] = c[1] * k; D[o + 2] = c[2] * k; D[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0); ctx.filter = 'blur(2px)'; ctx.drawImage(cvs, 0, 0); ctx.filter = 'none'; // soft edges to woods, water and hamlets
    for (const [x, y, w, h] of [[0, 0, CW, 4], [0, CH - 4, CW, 4], [0, 0, 4, CH], [CW - 4, 0, 4, CH]]) ctx.putImageData(img, 0, 0, x, y, w, h); // the blur fades the rim
    const mpp = W / CW, px = ([e, n]) => [(e + W / 2) / mpp, (H / 2 - n) / mpp]; ctx.lineJoin = ctx.lineCap = 'round';
    // roads and tracks: worn earth, ~7 m with softer verges (ground roads, w3d/grounds)
    for (const rd of (G && G.roads) || []) for (const [col, wd] of [[winter ? 'rgba(170,160,140,.35)' : 'rgba(112,94,62,.35)', 11 / mpp], [winter ? 'rgba(214,206,190,.85)' : 'rgba(178,154,108,.88)', Math.max(1.4, 6 / mpp)]]) {
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); rd.p.forEach((q, i) => { const [a, b] = px(q); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke(); }
    // brooks and ditches at their own width, a darker bank either side
    for (const rv of rivers) { if (rv.w >= 20) continue;
      for (const [col, wd] of [[winter ? 'rgba(120,120,110,.45)' : 'rgba(70,84,52,.55)', (rv.w + 5) / mpp], [winter ? 'rgba(206,218,224,.95)' : 'rgba(84,112,118,.95)', Math.max(1.2, rv.w / mpp)]]) {
        ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath(); rv.p.forEach((q, i) => { const [a, b] = px(q); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke(); } }
  } // outside the field the shader leaves the texture out; vertex colours carry the country there
  const groundTex = new THREE.CanvasTexture(cvs); groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = 8;
  // close-up grain: a tiling noise multiplied over the painted cover so the ground never shows its texels
  const grain = document.createElement('canvas'); grain.width = grain.height = 256;
  { const gx = grain.getContext('2d'), gi = gx.createImageData(256, 256), Ng = makeNoise(77);
    for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const a = i / 256 * Math.PI * 2, b = j / 256 * Math.PI * 2; // periodic: sample on a torus
      const v = 128 + 70 * Ng.fbm(Math.cos(a) * 2 + 9, Math.sin(a) * 2 + Math.cos(b) * 2 + Math.sin(b) * 2, 4) + 30 * Ng(Math.cos(a) * 9 + Math.sin(b) * 9, Math.sin(a) * 9 + Math.cos(b) * 9), o = (j * 256 + i) * 4;
      gi.data[o] = gi.data[o + 1] = gi.data[o + 2] = Math.max(0, Math.min(255, v)); gi.data[o + 3] = 255; }
    gx.putImageData(gi, 0, 0); }
  const grainTex = new THREE.CanvasTexture(grain); grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping; grainTex.anisotropy = 8;
  const MEAD = new THREE.Color(0x7d9442), tmp = new THREE.Color();
  // the country round the field: the same patchwork of pasture, stubble and fallow, with its real woods, towns and water
  // (the 200 m cover of the ground, softened over four samples)
  const C_PAST = new THREE.Color(0x7f9645), C_STUB = new THREE.Color(0xb7a463), C_FALL = new THREE.Color(0x96974f), C_WOOD = new THREE.Color(0x4a6230), C_TOWN = new THREE.Color(0xa09878), C_WATER = new THREE.Color(0x5c716a), C_SNOW = new THREE.Color(0xeef1f4);
  const coverFrac = (x, z, t) => { if (!G) return 0; const r = outside(x, z) > 2900 ? 300 : 100; let k = 0; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .3; if (G.outerCover(x + Math.cos(a) * r, -(z + Math.sin(a) * r)) === t) k++; } return k / 8; };
  const country = (x, z, out) => {
    { const ss = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
      const a = N.fbm(x / 900, z / 900, 3), b = N.fbm(x / 340 + 7, z / 340 - 3, 3);
      out.copy(C_PAST).lerp(C_STUB, ss(-.1, .25, a + b * .35)).lerp(C_FALL, ss(.15, .45, b) * .7);
      const fw = coverFrac(x, z, 1), ft = coverFrac(x, z, 3), fa = coverFrac(x, z, 2);
      out.lerp(C_WOOD, fw * .9).lerp(C_TOWN, ft * .6).lerp(C_WATER, fa);
      if (winter && fa < .5) out.lerp(C_SNOW, .78 - fw * .38);
      return out; }
  };
  const color = (x, z, h, out) => out.setRGB(1, 1, 1);
  // mesh posts: fine over the field, 80 m for 3 km around it, coarse out to 12 km
  const axis3 = (lo, hi, fine) => { const a = []; for (let x = -12000; x < lo - 3000; x += 320) a.push(x); for (let x = lo - 3000; x < lo; x += 80) a.push(x);
    for (let x = lo; x < hi; x += fine) a.push(x); for (let x = hi; x < hi + 3000; x += 80) a.push(x); for (let x = hi + 3000; x <= 12000; x += 320) a.push(x); return a; };
  const g = quality.terrain <= 2.5 ? 18 : quality.terrain <= 3 ? 22 : 30;
  const T = buildTerrain({ xs: axis3(-W / 2 - 60, W / 2 + 60, g), zs: axis3(-H / 2 - 60, H / 2 + 60, g), height, color, steep: 0x7a7458, seed: 9, jitter: 0 });
  { const pos = T.mesh.geometry.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = (pos.getX(i) + W / 2) / W; uv[i * 2 + 1] = 1 - (pos.getZ(i) + H / 2) / H; }
    T.mesh.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); groundTex.wrapS = groundTex.wrapT = THREE.ClampToEdgeWrapping; T.mesh.material.map = groundTex;
    // the country colour of each corner, with the same steep-slope tint buildTerrain gives the vertex colours
    const cc = new Float32Array(pos.count * 3), steepC = new THREE.Color(0x7a7458), cv = new THREE.Color(), na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 3) {
      na.fromBufferAttribute(pos, i); nb.fromBufferAttribute(pos, i + 1); nc.fromBufferAttribute(pos, i + 2); nb.sub(na); nc.sub(na); nb.cross(nc).normalize();
      const st = Math.min(1, Math.max(0, (.86 - Math.abs(nb.y)) / .22));
      for (let k = 0; k < 3; k++) { const x = pos.getX(i + k), z = pos.getZ(i + k);
        if (outside(x, z) > 0 || Math.abs(x) > W / 2 - 200 || Math.abs(z) > H / 2 - 200) country(x, z, cv); else cv.setRGB(1, 1, 1);
        cv.lerp(steepC, st); cc[(i + k) * 3] = cv.r; cc[(i + k) * 3 + 1] = cv.g; cc[(i + k) * 3 + 2] = cv.b; } }
    T.mesh.geometry.setAttribute('country', new THREE.BufferAttribute(cc, 3));
    T.mesh.material.onBeforeCompile = sh => { sh.uniforms.grain = { value: grainTex }; sh.uniforms.grainRep = { value: new THREE.Vector2(W / 14, H / 14) };
      sh.vertexShader = 'attribute vec3 country; varying vec3 vCountry;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vCountry = country;');
      // on the painted field: texture × vertex colour (white, or the steep tint); off it: the country colour
      sh.fragmentShader = 'varying vec3 vCountry;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#if defined( USE_COLOR )\n diffuseColor.rgb *= mix(vCountry, vColor, inField);\n#endif');
      sh.fragmentShader = 'uniform sampler2D grain; uniform vec2 grainRep;\n' + sh.fragmentShader.replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = texture2D(map, vMapUv); float inField = step(.002, vMapUv.x) * step(vMapUv.x, .998) * step(.002, vMapUv.y) * step(vMapUv.y, .998);\n diffuseColor *= mix(vec4(1.), sampledDiffuseColor, inField);\n diffuseColor.rgb *= .8 + .4 * texture2D(grain, vMapUv * grainRep).r * (.6 + .4 * texture2D(grain, vMapUv * grainRep * .23).r);'); };
    T.mesh.material.needsUpdate = true; }
  scene.add(T.mesh); const hAt = T.heightAt;
  // water: one surface over the broad-water cells, each corner at the relief there (the tiles give the water's own level)
  // quads over the water cells and one cell beyond, so the shore is where the banks rise through the surface
  { const wet = (r, c) => r >= 0 && c >= 0 && r < TER.rows && c < TER.cols && +TER.rows_str[r][c] === 2 && !brook.has(r * 1000 + c);
    const L = new Map(), lvl = new Map(), pos = [], cells = new Set();
    for (let r = 0; r < TER.rows; r++) for (let c = 0; c < TER.cols; c++) if (wet(r, c)) { L.set(r * 1000 + c, elevAt(-W / 2 + (c + .5) * cell, -(H / 2 - (r + .5) * cell)) - 1.2); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) cells.add((r + dr) * 1000 + c + dc); }
    const node = (r, c) => { const k = r * 1000 + c; if (!lvl.has(k)) { let m = Infinity; for (let dr = -3; dr <= 2; dr++) for (let dc = -3; dc <= 2; dc++) { const v = L.get((r + dr) * 1000 + c + dc); if (v !== undefined && v < m) m = v; } lvl.set(k, m); } return lvl.get(k); };
    const P = (r, c) => [-W / 2 + c * cell, node(r, c), -(H / 2 - r * cell)];
    for (const k of cells) { const r = Math.floor(k / 1000), c = k - r * 1000; if (r < 0 || c < 0 || r >= TER.rows || c >= TER.cols) continue;
      const a = P(r, c), b = P(r, c + 1), d = P(r + 1, c), e = P(r + 1, c + 1); pos.push(...a, ...d, ...b, ...b, ...d, ...e); }
    if (pos.length) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
      scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: winter ? 0xc9d6dc : 0x78a8b4, roughness: winter ? .5 : .1, metalness: .1, transparent: true, opacity: .85 }))); } }

  // woods, villages and a church per large village (land cover from TER)
  const trees = { broadleaf: [], fir: [], poplar: [], bush: [] }, per = quality.trees >= 1 ? 3 : quality.trees >= .8 ? 2 : 1, vill = [];
  for (let r = 0; r < TER.rows; r++) for (let c = 0; c < TER.cols; c++) {
    const t = +TER.rows_str[r][c], x = -W / 2 + (c + .5) * cell, z = -(H / 2 - (r + .5) * cell);
    if (t === 1 || near(r, c, 1)) for (let k = 0; k < per; k++) { const px = x + (rnd() - .5) * 30, pz = z + (rnd() - .5) * 30, sp = rnd() < .3 ? 'fir' : 'broadleaf'; if (landAt(px, pz) !== 1) continue; trees[sp].push({ x: px, y: hAt(px, pz), z: pz, ry: rnd() * 6.28, s: 1.1 + rnd() * .6, col: sp === 'fir' ? FIRS[k % 4] : winter ? 0x6e5e4e : AUTUMN[Math.floor(rnd() * AUTUMN.length)] }); }
    if (t === 3) vill.push([r, c, x, z]);
    else if (near(r, c, 3)) vill.push([r, c, x, z, true]);
  }
  for (let i = 0; i < 900; i++) { const x = -W / 2 + rnd() * W, z = -H / 2 + rnd() * H; if (cellAt(x, z) === 0 && N(x / 400, z / 400) > .35) trees.broadleaf.push({ x, y: hAt(x, z), z, ry: rnd() * 6, s: 1 + rnd() * .5, col: winter ? 0x6e5e4e : AUTUMN[Math.floor(rnd() * AUTUMN.length)] }); }
  for (const [r, c] of [].concat(...TER.rows_str.map((row, r) => [...row].map((t, c) => t === '4' || t === '5' ? [r, c] : null).filter(Boolean)))) {
    const t = TER.rows_str[r][c]; if (rnd() > (t === '5' ? .5 : .25)) continue; const x = -W / 2 + (c + rnd()) * cell, z = -(H / 2 - (r + rnd()) * cell); if (drawnAt(x, z) + '' !== t) continue;
    trees.bush.push({ x, y: hAt(x, z), z, ry: rnd() * 6, s: t === '5' ? .45 + rnd() * .2 : .35 + rnd() * .3, col: t === '5' ? (winter ? 0x6e5e4e : 0x7d7a2e) : (winter ? 0x9a8f72 : 0x8f8a4a) }); }
  for (let i = 0, n = 0; i < 9000 && n < 2600; i++) { const a = rnd() * 6.28, d = Math.max(W, H) * .55 + rnd() * 6500, x = Math.cos(a) * d, z = Math.sin(a) * d * .8; if (G ? G.outerCover(x, -z) === 1 : N.fbm(x / 1500, z / 1500, 2) > -.05) { n++; trees[rnd() < .4 ? 'fir' : 'broadleaf'].push({ x, y: hAt(x, z), z, ry: rnd() * 6, s: 1.6 + rnd(), col: rnd() < .4 ? FIRS[0] : winter ? 0x6e5e4e : AUTUMN[Math.floor(rnd() * AUTUMN.length)] }); } }
  scene.add(buildForest(trees, { variants: 2, seed: 8, lod: true, shadows: quality.shadows >= 2048 }));
  const houseG = [merge([box(9, 4.5, 6, 0xeee6d2), place(tint(new THREE.CylinderGeometry(0, 1, 1, 4, 1), 0x8e4a34, .06), 0, 6.3, 0, Math.PI / 4, 7.4, 3.6, 5.2)]),
    merge([box(11, 3.8, 6.5, 0xd9c49a), box(.4, 3.8, 6.6, 0x5a4030, -3, 0, 0), box(.4, 3.8, 6.6, 0x5a4030, 3, 0, 0), place(tint(new THREE.CylinderGeometry(0, 1, 1, 4, 1), 0x8a7a52, .06), 0, 5.6, 0, Math.PI / 4, 8.8, 3.6, 5.6)])];
  const houses = [[], []], seen = new Set();
  for (const [r, c, x, z] of vill) if (rnd() < .45) { const hx = x + (rnd() - .5) * 26, hz = z + (rnd() - .5) * 26; if (landAt(hx, hz) === 3) houses[rnd() < .55 ? 0 : 1].push([hx, hz, rnd() < .5 ? 0 : Math.PI / 2]); }
  const dm = new THREE.Object3D(), propMat = stdMat();
  houseG.forEach((geo, i) => { const im = new THREE.InstancedMesh(geo, propMat, houses[i].length); houses[i].forEach(([x, z, ry], k) => { dm.position.set(x, hAt(x, z) - .2, z); dm.rotation.set(0, ry, 0); dm.scale.setScalar(1); dm.updateMatrix(); im.setMatrixAt(k, dm.matrix); }); im.castShadow = im.receiveShadow = true; scene.add(im); });
  const key = (r, c) => r * 1000 + c, vs = new Set(vill.filter(v => !v[4]).map(([r, c]) => key(r, c)));
  for (const [r0, c0, , , edge] of vill) { if (edge) continue; // flood-fill village clusters; a church tower marks the larger ones
    if (seen.has(key(r0, c0))) continue; const q = [[r0, c0]], cl = []; seen.add(key(r0, c0));
    while (q.length) { const [r, c] = q.pop(); cl.push([r, c]); for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = key(r + dr, c + dc); if (vs.has(k) && !seen.has(k)) { seen.add(k); q.push([r + dr, c + dc]); } } }
    if (cl.length < 40) continue;
    const mr = cl.reduce((s, a) => s + a[0], 0) / cl.length, mc = cl.reduce((s, a) => s + a[1], 0) / cl.length, x = -W / 2 + (mc + .5) * cell, z = -(H / 2 - (mr + .5) * cell);
    const ch = new THREE.Mesh(merge([box(12, 9, 24, 0xf0e8d6), place(tint(new THREE.CylinderGeometry(0, 1, 1, 4, 1), 0x8e4a34), 0, 12.5, 0, Math.PI / 4, 9.5, 7, 18), box(6, 26, 6, 0xf0e8d6, 0, 0, -14), place(tint(new THREE.CylinderGeometry(0, 1, 1, 4, 1), 0x3e4a44), 0, 31, -14, Math.PI / 4, 4.6, 10, 4.6)]), propMat);
    ch.position.set(x, hAt(x, z) - .3, z); ch.castShadow = ch.receiveShadow = true; scene.add(ch);
  }

  /* ---------- formations ---------- */
  const figMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .85 });
  // one figure per man (state.battleDemo units' men); three levels of detail by distance from the camera
  const mkPool = (frames, cap, shadow) => { const p = new FramePool(frames, cap, figMat); p.setShadow(shadow); scene.add(p.group); return p; };
  const pools = {};
  for (const s of 'AB') pools[s] = { near: mkPool(infantryFrames(s), 5000, true), mid: mkPool(infantryFrames(s, true), 16000, false), far: mkPool(tinyFrames(s), 16000, false), cavNear: mkPool(cavalryFrames(s === 'A' ? actors.hb : actors.hw, s), 900, true), cavFar: mkPool(tinyCavalryFrames(s), 1600, false) };
  const guns = mkPool([P.cannon(), P.limber()], 80, true);
  const layout = (u, d, n) => { // [ranks, files] for n men on the sim's footprint
    if (u.type === 'inf') { if (u.form === 'column') { const f = Math.max(4, Math.round(d.w / .8)); return [Math.ceil(n / f), f]; } return u.kind === 'lt' ? [2, Math.ceil(n / 2)] : [3, Math.ceil(n / 3)]; }
    if (u.form === 'column') { const f = Math.max(3, Math.round(d.w / 1.5)); return [Math.ceil(n / f), f]; }
    return [2, Math.ceil(n / 2)];
  };

  const plateGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), edgeGeo = new THREE.EdgesGeometry(plateGeo);
  const vis = {}, labels = document.createElement('div'); labels.className = 'w3d-blabels'; document.getElementById('w3d').append(labels);
  const card = document.createElement('div'); card.className = 'w3d-bcard'; card.hidden = true; document.getElementById('w3d').append(card);
  const shortName = u => u.name.split(' (')[0].replace(/^(Imperial|Opposing) /, '').replace('infantry battalion', 'Battalion').replace('cavalry squadron group', 'Horse').replace('battery', 'Battery').replace(/^./, c => c.toUpperCase());
  function visFor(u) {
    if (vis[u.id]) return vis[u.id];
    const col = u.side === 'A' ? 0xf2e6c8 : 0x7fa6ee;
    const plate = new THREE.Mesh(plateGeo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    const edge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: .9 })); plate.add(edge);
    plate.userData.id = u.id; plate.renderOrder = 2; scene.add(plate);
    const ghost = new THREE.LineSegments(edgeGeo, new THREE.LineDashedMaterial({ color: 0x7fa6ee, dashSize: .06, gapSize: .05, transparent: true, opacity: .8 })); ghost.computeLineDistances(); ghost.visible = false; scene.add(ghost);
    const lab = document.createElement('div'); lab.className = 'w3d-ulabel ' + u.side; labels.append(lab);
    const flag = u.type === 'inf' ? P.flagMesh(4.5, 3.2, u.side === 'A' ? flagTexA : flagTexB, uT) : null; if (flag) scene.add(flag);
    return vis[u.id] = { plate, edge, ghost, lab, flag, x: u.e, z: -u.n, f: u.facing, ammo: u.ammo, fireT: 0, moveT: 0, seed: rngFrom(u.id.charCodeAt(1) * 97 + (u.side === 'A' ? 1 : 5)) };
  }
  const uT = { value: 0 }, flagTexA = P.flagTexture(), flagTexB = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#f2f0ea'; x.fillRect(0, 0, 128, 96); x.fillStyle = '#1a1a1a'; x.beginPath(); x.ellipse(64, 48, 18, 22, 0, 0, 7); x.fill(); x.strokeStyle = '#1a1a1a'; x.lineWidth = 8; x.strokeRect(4, 4, 120, 88); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

  // smoke and muzzle flashes, pooled
  const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(240,238,232,.9)'); gr.addColorStop(1, 'rgba(240,238,232,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const puffs = []; for (let i = 0; i < 260; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); puffs.push({ s, life: 0, max: 1, v: new THREE.Vector3() }); }
  let puffI = 0; const puff = (x, y, z, size, life, flash) => { const p = puffs[puffI++ % puffs.length]; p.s.position.set(x, y, z); p.s.scale.setScalar(size); p.size = size; p.life = 0; p.max = life; p.s.visible = true; p.s.material.color.set(flash ? 0xffc070 : 0xffffff); p.flash = flash; p.v.set((rnd() - .5) * 2, 1.2 + rnd(), (rnd() - .5) * 2); };

  // order arrows and destination ghosts
  const arrowG = new THREE.Group(); scene.add(arrowG); let arrowKey = '';
  function buildArrows(scale) {
    while (arrowG.children.length) { const c = arrowG.children.pop(); c.geometry.dispose(); c.material.dispose(); }
    const ord = armyOrders();
    for (const id in ord) {
      const o = ord[id], u = unitById(id); if (!u || !alive(u)) continue; const v = vis[id], x0 = v ? v.x : u.e, z0 = v ? v.z : -u.n;
      if (o.dest) {
        const x1 = o.dest[0], z1 = -o.dest[1], col = o.mode === 'retire' ? 0x8a8a8a : o.mode === 'charge' ? 0xe0503a : 0xb8442f, L = Math.hypot(x1 - x0, z1 - z0), nx = (x1 - x0) / L, nz = (z1 - z0) / L, w = 3.2 * scale, pos = [];
        const n = Math.max(2, Math.ceil(L / 25)), y = (x, z) => hAt(x, z) + 1.5 + scale;
        for (let i = 0; i < n; i++) { if (i % 2 && o.mode !== 'charge') continue; const a = i / n * (L - 6 * w), b = Math.min(L - 6 * w, (i + 1) / n * (L - 6 * w)); if (b <= a) continue; const ax = x0 + nx * a, az = z0 + nz * a, bx = x0 + nx * b, bz = z0 + nz * b; pos.push(ax - nz * w, y(ax, az), az + nx * w, bx - nz * w, y(bx, bz), bz + nx * w, bx + nz * w, y(bx, bz), bz - nx * w, ax - nz * w, y(ax, az), az + nx * w, bx + nz * w, y(bx, bz), bz - nx * w, ax + nz * w, y(ax, az), az - nx * w); }
        const hx = x0 + nx * (L - 6 * w), hz = z0 + nz * (L - 6 * w); pos.push(hx - nz * w * 2.6, y(hx, hz), hz + nx * w * 2.6, x1, y(x1, z1), z1, hx + nz * w * 2.6, y(hx, hz), hz - nx * w * 2.6);
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false })); m.renderOrder = 3; arrowG.add(m);
        const d = dims(Object.assign({}, u, { form: o.form || u.form })), gh = new THREE.LineSegments(edgeGeo.clone(), new THREE.LineDashedMaterial({ color: col, dashSize: .05, gapSize: .05 }));
        gh.scale.set(d.w, 1, d.d); gh.position.set(x1, hAt(x1, z1) + 1, z1); gh.rotation.y = Math.PI - (o.facing != null ? o.facing : u.facing) * Math.PI / 180 + Math.PI; gh.computeLineDistances(); arrowG.add(gh);
      } else if (o.mode === 'hold' || o.facing != null || o.form) {
        const ring = new THREE.Mesh(new THREE.RingGeometry(1, 1.035, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: o.mode === 'hold' ? 0xffd45e : 0xe0a040, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }));
        const d = dims(u), r = Math.max(d.w, d.d) * .56 + 4; ring.scale.setScalar(r); ring.position.set(x0, hAt(x0, z0) + 1.2, z0); arrowG.add(ring);
        if (o.facing != null) { const f = o.facing * Math.PI / 180, fx = Math.sin(f), fz = -Math.cos(f), geo = new THREE.BufferGeometry(), y = hAt(x0, z0) + 2, a = r + 4, b = r + 30; geo.setAttribute('position', new THREE.Float32BufferAttribute([x0 + fx * a - fz * 8, y, z0 + fz * a + fx * 8, x0 + fx * b, y, z0 + fz * b, x0 + fx * a + fz * 8, y, z0 + fz * a - fx * 8], 3)); arrowG.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xb8442f, side: THREE.DoubleSide }))); }
      }
    }
  }

  /* ---------- the day after: what lies on the ground (state.battleDemo.aftermath, from the account or the table battle) ---------- */
  const lay = g => g.clone().rotateX(-Math.PI / 2).translate(0, .16, 0);
  const deadHorse = merge([box(.55, .5, 1.7, 0x5a3a22, 0, .25, 0), box(.3, .3, .6, 0x5a3a22, 0, .2, 1.05), box(.14, .14, .8, 0x2a1e14, .3, .1, .3, .3), box(.14, .14, .8, 0x2a1e14, .3, .1, -.4, -.3)]).rotateZ(Math.PI / 2).translate(0, .3, 0);
  const tipped = P.cannon().clone().rotateZ(.45).translate(0, -.15, 0);
  const after = new FramePool([lay(infantryFrames('A', true)[0]), lay(infantryFrames('B', true)[0]), deadHorse, tipped, infantryFrames('A', true)[0], P.wagon()], 6000, figMat);
  after.setShadow(true); after.group.visible = false; scene.add(after.group);
  let aftermathOn = false, afterKey = '', afterCentre = [0, 0];
  const AF_N = { light: 18, heavy: 55, destroyed: 120 };
  function buildAftermath() {
    const af = state.battleDemo.aftermath || {}, R = rngFrom(977); after.begin(); let best = 0; afterCentre = [0, 0];
    for (const u of state.battleDemo.units) {
      const w = (af.fallen || {})[u.id]; if (!w) continue;
      const d = dims(u), f = (u.facing || 0) * Math.PI / 180, fx = Math.sin(f), fz = -Math.cos(f), rx = Math.cos(f), rz = Math.sin(f), x0 = u.e, z0 = -u.n, cav = u.type === 'cav';
      const n = Math.round(AF_N[w] * (cav ? .6 : u.type === 'art' ? .3 : 1)); if (n > best) { best = n; afterCentre = [x0 + fx * 30, z0 + fz * 30]; } // the ride starts where the dead lie thickest
      for (let i = 0; i < n; i++) { const lx = (R() - .5) * d.w * 1.2, lz = (R() - .3) * (d.d + 40) * (w === 'destroyed' ? 1.8 : 1), x = x0 + rx * lx + fx * lz, z = z0 + rz * lx + fz * lz, a = R() * Math.PI * 2;
        after.put(cav && i % 3 === 0 ? 2 : u.side === 'A' ? 0 : 1, x, hAt(x, z), z, Math.cos(a), Math.sin(a), 1); }
      if (u.type === 'art' && (af.guns_taken || []).includes(u.id)) for (let g = 0; g < 4; g++) { const x = x0 + rx * (g - 1.5) * 9, z = z0 + rz * (g - 1.5) * 9, a = f + (R() - .5); after.put(3, x, hAt(x, z), z, Math.cos(a), Math.sin(a), 1); }
      // a burial party and its cart where the dead lie thickest
      if (w !== 'light') { const bx = x0 + fx * 12, bz = z0 + fz * 12; after.put(5, bx + 6, hAt(bx + 6, bz), bz, 1, 0, 1); for (let k = 0; k < 6; k++) { const x = bx + (k % 3) * 1.6, z = bz + Math.floor(k / 3) * 1.8, a = R() * 6; after.put(4, x, hAt(x, z), z, Math.cos(a), Math.sin(a), 1); }
        if (R() < .7) puff(bx, hAt(bx, bz) + 3, bz, 18, 20); }
    }
    after.end();
  }

  /* ---------- camera ---------- */
  const cam = { tx: -250, tz: 720, yaw: .12, pitch: .62, dist: 1500 };
  const tmpM = new THREE.Matrix4(), tq = new THREE.Quaternion(), tv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  let shadowView = '', shadowTick = 0;
  const keys = new Set(); let hover = null, inspected = null, prevBattleOn = false, lastCardKey = '', readOnly = false; // readOnly: an account of a battle he was not at
  // the camera (as in battle-atlas): an orbit with damping, left-drag to turn, right- or shift-drag to pan, wheel or pinch to
  // zoom. cam {tx, tz, dist, yaw, pitch} stays the shared state: anything that sets it (arrival, the ride, keys) moves the orbit.
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enabled: false, enableDamping: true, dampingFactor: .08, screenSpacePanning: false, minDistance: 50, maxDistance: 6000, minPolarAngle: Math.PI / 2 - 1.45, maxPolarAngle: Math.PI / 2 - .12, zoomSpeed: 1.2 });
  controls.addEventListener('start', () => { cam.tw = null; });
  let camSig = '';
  const sigOf = () => [cam.tx, cam.tz, cam.dist, cam.yaw, cam.pitch].map(v => v.toFixed(3)).join();
  function placeCamera() {
    const ty = hAt(cam.tx, cam.tz), o = tv.set(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    camera.position.set(cam.tx + o.x * cam.dist, ty + o.y * cam.dist, cam.tz + o.z * cam.dist);
    const gy = hAt(camera.position.x, camera.position.z) + 8; if (camera.position.y < gy) camera.position.y = gy;
    camera.lookAt(cam.tx, ty, cam.tz);
    const S = Math.min(1800, Math.max(260, cam.dist * .95)), sc = lights.sun.shadow.camera; if (Math.abs(sc.right - S) > 20) { sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S; sc.updateProjectionMatrix(); }
    lights.sun.target.position.set(cam.tx, ty, cam.tz); lights.sun.position.set(cam.tx, ty, cam.tz).addScaledVector(sunDir, 2400);
    sky.position.copy(camera.position);
  }

  /* ---------- per-frame drawing of the authoritative state ---------- */
  // a point s metres ahead of a column's centre (straight on) or behind it (back along its trail), and the way it faces there
  const alongOut = { x: 0, z: 0, dx: 0, dz: 0 };
  function along(v, s, fx, fz) {
    const o = alongOut;
    if (s >= 0) { o.x = v.x + fx * s; o.z = v.z + fz * s; o.dx = fx; o.dz = fz; return o; }
    let x = v.x, z = v.z, rem = -s, dx = fx, dz = fz; const T = v.trail;
    for (let i = T.length - 1; i >= 0; i--) {
      const px = T[i][0], pz = T[i][1], L = Math.hypot(x - px, z - pz); if (L < 1e-6) continue;
      dx = (x - px) / L; dz = (z - pz) / L;
      if (L >= rem) { o.x = x - dx * rem; o.z = z - dz * rem; o.dx = dx; o.dz = dz; return o; }
      rem -= L; x = px; z = pz;
    }
    o.x = x - dx * rem; o.z = z - dz * rem; o.dx = dx; o.dz = dz; return o;
  }
  function draw(dt, t) {
    const bd = state.battleDemo, us = rail.units() || bd.units, k = 1 - Math.exp(-dt * 5), figScale = 1; // true scale at every distance, so men, guns and houses keep their proportions
    for (const s of 'AB') for (const k in pools[s]) pools[s][k].begin(); guns.begin();
    const shown = new Set();
    if (aftermathOn) { const k = JSON.stringify(bd.aftermath || {}); if (k !== afterKey) { afterKey = k; buildAftermath(); } }
    for (const u of aftermathOn ? [] : us) {
      const v = visFor(u), A = u.side === 'A', live = alive(u) && u.st !== 'gone';
      const seenNow = A || u.vis;
      v.plate.visible = live && seenNow; v.ghost.visible = false; if (v.flag) v.flag.visible = false;
      if (!live) { v.lab.style.display = 'none'; continue; }
      if (!seenNow) { // fog of war: only a dashed outline where it was last reported
        if (u.seenE != null) { const d = dims(u); v.ghost.visible = true; v.ghost.scale.set(d.w, 1, d.d); v.ghost.position.set(u.seenE, hAt(u.seenE, -u.seenN) + 1, -u.seenN); v.ghost.rotation.y = -u.facing * Math.PI / 180; v.gx = u.seenE; v.gz = -u.seenN; shown.add(u.id); }
        else { v.lab.style.display = 'none'; }
        v.x = u.e; v.z = -u.n; v.f = u.facing; v.ammo = u.ammo; continue;
      }
      shown.add(u.id);
      const tx = u.e, tz = -u.n, mv = Math.hypot(tx - v.x, tz - v.z); if (mv > 1.5 || u.moved) v.moveT = .6; v.moveT -= dt;
      if (mv > 400) { v.x = tx; v.z = tz; } else { v.x += (tx - v.x) * k; v.z += (tz - v.z) * k; }
      let df = ((u.facing - v.f + 540) % 360) - 180; v.f = (v.f + df * k + 360) % 360;
      if (u.ammo < v.ammo - .5) { v.fireT = .7; v.fired = true; } v.ammo = u.ammo; v.fireT -= dt;
      const d = dims(u), f = v.f * Math.PI / 180, fx = Math.sin(f), fz = -Math.cos(f), rx = Math.cos(f), rz = Math.sin(f), cy = hAt(v.x, v.z);
      if (u.form === 'column') { const T = v.trail || (v.trail = [[v.x, v.z]]), last = T[T.length - 1];
        if (Math.hypot(v.x - last[0], v.z - last[1]) > 4) { T.push([v.x, v.z]); let L = 0; for (let i = T.length - 1; i > 0; i--) { L += Math.hypot(T[i][0] - T[i - 1][0], T[i][1] - T[i - 1][1]); if (L > d.d + 40) { T.splice(0, i - 1); break; } } } }
      else v.trail = null;
      v.plate.position.set(v.x, cy + .6, v.z); v.plate.scale.set(d.w, 1, d.d); v.plate.rotation.y = -f;
      const sel = selUnits.has(u.id) || inspected === u.id, rout = u.st === 'routing', wav = u.st === 'wavering';
      v.plate.material.opacity = sel ? .42 : hover === u.id ? .3 : .1; v.plate.material.color.set(sel ? 0xffd45e : rout ? 0xd06040 : A ? 0xf2e6c8 : 0x7fa6ee); v.edge.material.color.set(sel ? 0xffd45e : rout ? 0xd06040 : wav ? 0xe8c46a : A ? 0xf2e6c8 : 0x7fa6ee);
      const yaw = Math.PI - f + (rout ? Math.PI : 0); tq.setFromAxisAngle(up, yaw);
      const moving = v.moveT > 0 || rout, pool = pools[u.side], seedU = u.id.charCodeAt(1) * 7.31 + (A ? 0 : 3.7);
      const jit = i => { const x = Math.sin(i * 12.9898 + seedU) * 43758.5453; return x - Math.floor(x) - .5; };
      const n = Math.max(1, Math.round(u.men)), dist = camera.position.distanceTo(tv.set(v.x, cy, v.z)), lod = dist < 320 ? 0 : dist < 900 ? 1 : 2, S = figScale;
      // the ground under the unit as a plane: centre height plus slopes along frontage and depth
      const hw = Math.max(6, d.w / 2), hd = Math.max(6, d.d / 2), gx = (hAt(v.x + rx * hw, v.z + rz * hw) - hAt(v.x - rx * hw, v.z - rz * hw)) / (2 * hw), gz = (hAt(v.x + fx * hd, v.z + fz * hd) - hAt(v.x - fx * hd, v.z - fz * hd)) / (2 * hd);
      const yc = Math.cos(yaw), ys = Math.sin(yaw), put = (pl, frame, lx, lz) => pl.put(frame, v.x + rx * lx + fx * lz, cy + gx * lx + gz * lz, v.z + rz * lx + fz * lz, yc, ys, S);
      const cyc = t * (u.type === 'cav' ? (u.mode === 'charge' ? 2.2 : 1.4) : 1.6) + (u.id.charCodeAt(1) % 7) * .13, spread = rout ? 2.4 : wav ? 1.25 : 1;
      if (u.type === 'inf' || u.type === 'cav') {
        const inf = u.type === 'inf', [ranks, files] = layout(u, d, n), sx = d.w / files, open = u.kind === 'lt' && u.form !== 'column' ? 1 : 0, sz = u.form === 'column' ? d.d / ranks : open ? 6 : inf ? 1.1 : u.kind === 'lc' ? 4.2 : 3.2;
        // a column keeps to its track: the ranks behind the centre walk where the head has been (v.trail)
        const snake = u.form === 'column' && v.trail && v.trail.length > 1;
        const pl = inf ? (lod === 0 ? pool.near : lod === 1 ? pool.mid : pool.far) : (lod === 0 ? pool.cavNear : pool.cavFar);
        for (let i = 0; i < n; i++) {
          const fi = i % files, ri = (i / files) | 0, lx = (fi - (files - 1) / 2) * sx * spread + jit(i) * sx * (rout ? 4 : open ? .8 : .25), lz = ((ranks - 1) / 2 - ri) * sz * spread + jit(i + 7) * (rout ? 24 : open ? 3 : .3);
          let frame;
          if (inf) frame = lod === 2 ? (moving ? ((Math.floor(cyc * 4) + i) & 1) : 0) : rout ? 8 + Math.floor((cyc * 1.6 + i * .3) * 4) % 4 : moving ? 1 + Math.floor((cyc + (i % 2) * .04) * 6) % 6 : (v.fireT > 0 && ri === 0 ? 7 : 0);
          else frame = lod === 0 ? (moving ? (u.mode === 'charge' || rout ? 7 + Math.floor((cyc + i * .07) * 6) % 6 : 1 + Math.floor((cyc + i * .05) * 6) % 6) : 0) : (moving ? 1 + ((Math.floor(cyc * 5) + i) & 1) : 0);
          if (snake && !rout) { const q = along(v, lz, fx, fz), yw = Math.PI - Math.atan2(q.dx, -q.dz), x = q.x - q.dz * lx, z = q.z + q.dx * lx; pl.put(frame, x, hAt(x, z), z, Math.cos(yw), Math.sin(yw), S); }
          else put(pl, frame, lx, lz);
        }
        if (v.flag) { v.flag.visible = !rout; v.flag.position.set(v.x - fx * 2, cy + 3.4 * S, v.z - fz * 2); v.flag.rotation.y = yaw + Math.PI / 2; v.flag.scale.setScalar(Math.min(1.8, S * .7)); }
        if (v.fired && inf) { v.fired = false; for (let i = 0; i < 6; i++) { const lx = (rnd() - .5) * d.w, x = v.x + rx * lx + fx * 3, z = v.z + rz * lx + fz * 3; puff(x, hAt(x, z) + 1.6 * S, z, 6 * S, 2.6); } }
      } else if (u.type === 'art') { // the battery's guns and every gunner
        const g = u.gunLost ? 0 : (u.guns || 6), gs = Math.max(2.4, 2.6 * S), cpl = lod === 0 ? pool.near : lod === 1 ? pool.mid : pool.far, per = Math.ceil(n / Math.max(1, g));
        for (let gi = 0; gi < g; gi++) { const lx = (gi - (g - 1) / 2) * gs; guns.put(0, v.x + rx * lx, cy + gx * lx, v.z + rz * lx, yc, ys, S); if (gi % 2 === 0) { const lz = -9 * S; guns.put(1, v.x + rx * lx + fx * lz, cy + gx * lx + gz * lz, v.z + rz * lx + fz * lz, yc, ys, S); } }
        for (let i = 0; i < n; i++) { const gi = Math.min(Math.max(0, g - 1), (i / per) | 0), k = i % per, lx = (gi - (g - 1) / 2) * gs + ((k % 5) - 2) * .55 * S + jit(i) * .3, lz = (-2.4 - ((k / 5) | 0) * 1.1) * S + jit(i + 3) * .3; put(cpl, lod === 2 ? 0 : (v.fireT > 0 && k < 2 ? 7 : 0), lx, lz); }
        if (v.fired) { v.fired = false; for (let gi = 0; gi < g; gi++) { const lx = (gi - (g - 1) / 2) * gs, x = v.x + rx * lx + fx * 3 * S, z = v.z + rz * lx + fz * 3 * S; puff(x, hAt(x, z) + 1.4 * S, z, 4 * S, .25, true); puff(x + fx * 4, hAt(x, z) + 2 * S, z + fz * 4, 10 * S, 3.4); } }
      }
    }
    for (const s of 'AB') for (const k in pools[s]) pools[s][k].end(); guns.end();
    for (const p of puffs) { if (!p.s.visible) continue; p.life += dt; const a = p.life / p.max; if (a >= 1) { p.s.visible = false; continue; } p.s.position.addScaledVector(p.v, dt * (p.flash ? 0 : 3)); p.s.scale.setScalar(p.size * (p.flash ? 1 : 1 + a * 2.2)); p.s.material.opacity = p.flash ? 1 - a : Math.sin(Math.min(1, a * 3) * Math.PI / 2) * (1 - a) * .8; }
    // labels
    const W2 = innerWidth / 2, H2 = innerHeight / 2, showAll = cam.dist < 1150;
    for (const u of us) {
      const v = vis[u.id]; if (!v || !shown.has(u.id)) continue;
      const A = u.side === 'A', ghost = !A && !u.vis, sel = selUnits.has(u.id) || inspected === u.id;
      if (!(showAll || sel || hover === u.id)) { v.lab.style.display = 'none'; continue; }
      const x = ghost ? v.gx : v.x, z = ghost ? v.gz : v.z; tv.set(x, hAt(x, z) + 6 * figScale + 4, z).project(camera);
      if (tv.z > 1 || Math.abs(tv.x) > 1.1 || Math.abs(tv.y) > 1.1) { v.lab.style.display = 'none'; continue; }
      const word = moraleWord(u), cls = word === 'routing' ? 'r' : (word === 'wavering' || word === 'shaken') ? 'w' : '';
      const html = ghost ? shortName(u) + ' <i>· last seen phase ' + (u.seenT ?? '?') + '</i>' : A ? shortName(u) + ' <i>· ' + Math.round(u.men) + ' ·</i> <span class="' + cls + '">' + word + '</span>' + (armyOrders()[u.id] ? ' <i>✎</i>' : '') : shortName(u) + ' <i>· about ' + Math.round(u.men / 50) * 50 + ' ·</i> <span class="' + cls + '">' + word + '</span>';
      if (v.lab._h !== html) { v.lab.innerHTML = html; v.lab._h = html; }
      v.lab.className = 'w3d-ulabel ' + u.side + (sel ? ' sel' : '') + (ghost ? ' ghost' : '');
      v.lab.style.display = ''; v.lab.style.left = (tv.x * W2 + W2) + 'px'; v.lab.style.top = (-tv.y * H2 + H2) + 'px';
    }
    for (const id in vis) if (!shown.has(id)) { vis[id].lab.style.display = 'none'; if (aftermathOn) { vis[id].plate.visible = false; vis[id].ghost.visible = false; if (vis[id].flag) vis[id].flag.visible = false; } }
    arrowG.visible = !aftermathOn && !rail.viewing();
    const ak = JSON.stringify(armyOrders()) + Math.round(figScale * 4) + (BS.running ? Math.floor(t * 2) : '');
    if (ak !== arrowKey) { arrowKey = ak; buildArrows(figScale); }
    renderCard();
  }

  /* ---------- the inspection / status card ---------- */
  function renderCard() {
    const bd = state.battleDemo, id = inspected || [...selUnits][0], u = id && unitById(id), mA = armyMorale('A'), mB = armyMorale('B'), seen = bd.units.some(x => x.side === 'B' && x.vis);
    const k = [id, u && Math.round(u.men), u && u.st, u && u.form, u && Math.round(u.mor), selUnits.size, BS.phase, BS.running, BS.result, JSON.stringify(u && armyOrders()[u.id] || ''), seen, Math.round(mA * 100), Math.round(mB * 20)].join('|');
    if (k + readOnly + rail.at() + rail.viewing() === lastCardKey) return; lastCardKey = k + readOnly + rail.at() + rail.viewing(); card.hidden = false;
    if (rail.viewing() && !aftermathOn) { const p = rail.at(); card.innerHTML = '<h3>' + (p ? 'After ' + p * 15 + ' minutes' : 'The deployment') + '</h3><div class="m">The field as it stood ' + (p ? 'at the end of phase ' + p : 'before the first order') + '. Nothing can be ordered from here; <kbd>→</kbd> or ▶| goes on, and from the last phase runs the next.</div>'; return; }
    if (aftermathOn) { const af = bd.aftermath || {}; card.innerHTML = '<h3>The field, afterwards</h3><div class="m">' + (af.held_by === 'B' ? 'The enemy holds the ground; your officers ride over it under a flag of truce.' : 'Your army holds the ground.') + (af.date ? ' ' + new Date(af.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) + '.' : '') + '</div>' + (af.note ? '<div class="m">' + af.note.replace(/[<>&]/g, '') + '</div>' : '') + '<div class="m">WASD or right-drag to ride over it · drag to look · wheel to rise.</div><div class="row"><button data-b="leave">Ride back</button></div>'; return; }
    if (readOnly) { card.innerHTML = '<h3>The ground, as your staff describe it</h3><div class="m">You were not there. The positions are those given in the account; click a formation to read what is known of it.</div>' + (u ? '<h3>' + shortName(u) + '</h3><div class="m">' + ({ inf: 'Infantry', cav: 'Cavalry', art: 'Artillery' }[u.type]) + ' · ' + (u.form || 'line') + ' · about ' + Math.round(u.men / 50) * 50 + ' men · ' + moraleWord(u) + '</div>' : '') + '<div class="row"><button data-b="leave">Put the account down</button></div>'; return; }
    const h = []; const pct = x => Math.round(x * 100);
    h.push('<div class="m">Phase ' + BS.phase + ' of ' + BS.max + ' · ' + BS.phase * 15 + ' min' + (BS.running ? ' · <b>running…</b>' : '') + '</div>');
    h.push('<div class="m">Your army: steady ' + pct(mA) + '% · lost ' + pct(losses('A')) + '%</div><div class="bar"><i style="width:' + pct(mA) + '%;background:' + (mA < .4 ? '#b8442f' : '#8fb96a') + '"></i></div>');
    h.push('<div class="m">Enemy (as you see it): ' + (seen ? 'about ' + Math.round(mB * 20) * 5 + '%' : 'not in sight') + '</div><div class="bar"><i style="width:' + (seen ? pct(mB) : 0) + '%;background:#7fa6ee"></i></div>');
    if (u) {
      const A = u.side === 'A', o = armyOrders()[u.id];
      h.push('<h3>' + shortName(u) + '</h3><div class="m">' + ({ inf: 'Infantry', cav: 'Cavalry', art: 'Artillery' }[u.type]) + ' · ' + (u.form || 'line') + ' · facing ' + Math.round(u.facing) + '° · ' + (A ? Math.round(u.men) + ' men' : 'about ' + Math.round(u.men / 50) * 50 + ' men (estimate)') + (u.type === 'art' && A ? ' · ' + u.guns + ' guns' : '') + '</div>');
      if (A) h.push('<div class="m">Morale ' + Math.round(u.mor) + ' · order ' + Math.round(u.coh) + ' · ammunition ' + Math.round(u.ammo) + '% · ' + moraleWord(u) + '</div><div class="m">Drafted: ' + (o ? (o.mode || 'hold') + (o.dest ? ' → ' + Math.round(Math.hypot(o.dest[0] - u.e, o.dest[1] - u.n)) + ' m' : '') + (o.form ? ' · ' + o.form : '') + (o.facing != null ? ' · face ' + o.facing + '°' : '') : 'no new order') + '</div>');
      else h.push('<div class="m">' + moraleWord(u) + ' — as far as your officers can see.</div>');
      if (selUnits.size > 1) h.push('<div class="m">' + selUnits.size + ' formations selected</div>');
    } else h.push('<div class="m" style="margin-top:6px">Click one of your formations to select it (Shift-click to add). The bar at the bottom gives orders; they are carried out when you run the next 15 minutes.</div>');
    if (BS.result) { const [tt, dd] = OUTCOME[BS.result] || [BS.result, '']; h.push('<div class="res"><h3>' + tt + '</h3><div class="m">' + dd + ' You lost ' + BS.summary.lossesA + '%, the enemy about ' + BS.summary.lossesB + '%. The adjudicator decides what it means for the campaign.</div></div>'); }
    const last = BS.log[BS.log.length - 1]; if (last && !BS.running) h.push('<div class="res"><div class="m"><b>Last phase:</b> you lost ' + last.lostA + ', they lost about ' + last.lostB + '. ' + last.enemyMoved + '</div>' + last.events.slice(0, 3).map(e => '<div class="m">· ' + e + '</div>').join('') + '</div>');
    h.push('<div class="row">' + (BS.result ? '<button data-b="after">Ride over the field</button><button data-b="again">Fight it again</button>' : '<button data-b="run">Run 15 minutes ▶</button><button data-b="withdraw">Withdraw</button>') + '<button data-b="sheet">Order sheet</button><button data-b="army">Courses</button></div>');
    card.innerHTML = h.join('');
  }
  card.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const a = b.dataset.b; if (a === 'run') runPhase(1); else if (a === 'withdraw') withdrawBattle(); else if (a === 'again') newBattle(); else if (a === 'army') window.__w3d.act('notebook'); else if (a === 'sheet') window.__w3d.act('orders'); else if (a === 'leave') window.__w3d.act('room'); else if (a === 'after') window.__w3d.act('aftermathTable'); });

  /* ---------- the clock rail (battle-atlas): a stop at the start and after every phase; ◀ ▶ or ← → step back and on,
     Play runs on. Looking back shows the field as it stood, read-only. In the battle he commands, a step past the last stop
     is the next phase: his orders, then the moves. Stops are kept in the draft with the battle they belong to. ---------- */
  const rail = (() => {
    const el = document.createElement('div'); el.className = 'w3d-rail'; el.hidden = true; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'The battle, phase by phase');
    document.getElementById('w3d').append(el);
    const KEEP = ['id', 'side', 'type', 'kind', 'name', 'strength', 'e', 'n', 'facing', 'form', 'men', 'max', 'mor', 'coh', 'ammo', 'st', 'vis', 'seenE', 'seenN', 'seenT', 'guns', 'gunLost', 'mode', 'w', 'd'];
    const snap = () => ({ phase: BS.phase, units: state.battleDemo.units.map(u => Object.fromEntries(KEEP.filter(k => u[k] !== undefined).map(k => [k, u[k]]))) });
    let view = null, playing = false, wait = 0, shown = false, domKey = '', recAt = 0;
    const track = () => { const d = draft, id = state.battleDemo.id + '|' + (typeof state.battleDemo.ground === 'string' ? state.battleDemo.ground : JSON.stringify(state.battleDemo.ground || ''));
      if (!d.battleTrack || d.battleTrack.id !== id) d.battleTrack = { id, stops: [] }; return d.battleTrack; };
    const record = () => {
      if (BS.running) return; const T = track(), last = T.stops[T.stops.length - 1];
      if (!last || BS.phase === 0 || last.phase > BS.phase) { const fresh = !last || last.phase !== 0 || T.stops.length > 1; T.stops = [snap()]; view = null; if (fresh) saveDraft(); }
      else if (last.phase < BS.phase) { T.stops.push(snap()); saveDraft(); }
    };
    const canRun = () => !readOnly && !aftermathOn && !BS.result && !BS.running;
    const stops = () => track().stops;
    function step(d) {
      const n = stops().length, cur = view == null ? n - 1 : view;
      if (d < 0) { view = Math.max(0, cur - 1); if (view >= n - 1) view = null; }
      else if (view != null) { view = cur + 1 >= n - 1 ? null : cur + 1; }
      else if (canRun()) runPhase(1);
      lastCardKey = ''; arrowKey = '';
    }
    function render() {
      const S = stops(), n = S.length, cur = view == null ? n - 1 : view, more = canRun() || BS.running;
      const k = [n, view, playing, BS.phase, BS.running, BS.result, readOnly, aftermathOn].join('|'); if (k === domKey) return; domKey = k;
      const at = view != null ? S[view].phase : BS.phase, slots = n + (more ? 1 : 0);
      const dot = (i, cls, lab) => '<button class="stop ' + cls + '" data-i="' + i + '" style="left:' + (slots > 1 ? i / (slots - 1) * 100 : 50) + '%" aria-label="' + lab + '"><span></span></button>';
      el.innerHTML = '<button class="rb" data-a="prev" aria-label="Back one phase">◀</button>'
        + '<button class="rb play" data-a="play" aria-label="' + (playing ? 'Pause' : 'Play') + '">' + (playing ? '❚❚' : '▶') + '</button>'
        + '<button class="rb" data-a="next" aria-label="' + (view == null && more ? 'Run the next 15 minutes' : 'On one phase') + '">▶|</button>'
        + '<div class="track"><i style="width:' + (slots > 1 ? cur / (slots - 1) * 100 : 0) + '%"></i>'
        + S.map((st, i) => dot(i, (i === cur ? 'on' : '') + (i < cur ? ' past' : ''), st.phase ? 'Phase ' + st.phase + ', ' + st.phase * 15 + ' minutes' : 'The deployment')).join('')
        + (more ? dot(n, 'next' + (BS.running ? ' running' : ''), 'The next 15 minutes') : '') + '</div>'
        + '<div class="lab">' + (BS.running && view == null ? 'Phase ' + BS.phase + ' · on the march…' : (at ? 'Phase ' + at + ' · ' + Math.floor(at * 15 / 60) + ':' + String(at * 15 % 60).padStart(2, '0') : 'The deployment') + (view != null ? ' · looking back' : BS.result ? ' · the end' : '')) + '</div>';
    }
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; e.stopPropagation();
      if (b.dataset.a === 'prev') { stop(); step(-1); } else if (b.dataset.a === 'next') { stop(); step(1); } else if (b.dataset.a === 'play') { playing = !playing; wait = 1e9; }
      else if (b.dataset.i != null) { stop(); const i = +b.dataset.i, n = stops().length; if (i >= n) step(1); else { view = i >= n - 1 ? null : i; lastCardKey = ''; arrowKey = ''; } }
      domKey = ''; });
    function stop() { playing = false; domKey = ''; }
    return {
      step, stop, show(b) { shown = b; domKey = ''; },
      viewing: () => view != null, at: () => view != null ? stops()[view].phase : BS.phase,
      units: () => view != null ? stops()[view].units : null,
      tick(dt) {
        // a stop as soon as a phase ends; while still deploying, the first stop follows the deployment (once a second)
        const S = stops(), last = S[S.length - 1], now = performance.now();
        if (!BS.running && (!last || last.phase !== BS.phase || (BS.phase === 0 && now - recAt > 1000))) { record(); recAt = now; }
        if (playing) { if (BS.running) wait = 0; else if ((wait += dt) > 1.8) { wait = 0; if (view != null || canRun()) step(1); else stop(); } }
        el.hidden = !shown || (stops().length < 2 && !canRun() && !BS.running);
        if (!el.hidden) render();
      },
      remove() { el.remove(); },
    };
  })();

  /* ---------- input ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const setRay = e => { const r = renderer.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); };
  const pickUnit = e => { setRay(e); const plates = Object.values(vis).filter(v => v.plate.visible).map(v => v.plate); const h = ray.intersectObjects(plates, false)[0]; return h ? h.object.userData.id : null; };
  const pickGround = e => { setRay(e); const h = ray.intersectObject(T.mesh, false)[0]; return h ? h.point : null; };
  function click(e) {
    if (readOnly || rail.viewing()) { inspected = pickUnit(e); lastCardKey = ''; return; }
    if (armyTool) { const p = pickGround(e); if (p) armyMapClick({ latlng: L.latLng(...lo(state.battleDemo.center, p.x, -p.z)) }); return; }
    const id = pickUnit(e);
    if (id) { const u = unitById(id); if (u.side === 'A') { inspected = null; selectUnits([id], e.shiftKey || e.metaKey); } else { inspected = id; } }
    else if (!e.shiftKey) { inspected = null; selectUnits([]); }
    lastCardKey = '';
  }

  return {
    camera,
    setShadows: n => { lights.setShadows(n); },
    enter() { prevBattleOn = battleOn; if (!battleOn) showBattle(true); initSim(); resize(); placeCamera(); camSig = ''; controls.enabled = true; renderCard(); card.hidden = false; labels.hidden = false; rail.show(true); },
    leave() { controls.enabled = false; rail.show(false); rail.stop(); card.hidden = true; labels.hidden = true; if (armyTool) setArmyTool(armyTool); if (!prevBattleOn) showBattle(false); },
    refresh() { lastCardKey = ''; arrowKey = ''; },
    setReadOnly(b) { readOnly = b; inspected = null; lastCardKey = ''; if (b) selectUnits([]); },
    // ride over the ground the day after: the dead, the guns, the burial parties; the camera low, among them
    setAftermath(b) { aftermathOn = b; after.group.visible = b; arrowG.visible = !b; labels.hidden = b; afterKey = ''; lastCardKey = ''; if (b) { buildAftermath(); cam.tw = null; cam.tx = afterCentre[0]; cam.tz = afterCentre[1]; cam.dist = 70; cam.pitch = .26; } },
    // arrive from the map: start high over (x,z) and settle down onto the field
    descend(x, z) { cam.tx = Math.max(-W / 2, Math.min(W / 2, x)); cam.tz = Math.max(-H / 2, Math.min(H / 2, z)); cam.dist = 5800; cam.pitch = 1.2; cam.tw = { t: 0, d0: 5800, d1: 1300, p0: 1.2, p1: .66 }; },
    frame(dt, t) {
      uT.value = t; setWindTime(t);
      if (cam.tw) { const w = cam.tw; w.t = Math.min(1, w.t + dt / 1.4); const e = 1 - Math.pow(1 - w.t, 3); cam.dist = w.d0 + (w.d1 - w.d0) * e; cam.pitch = w.p0 + (w.p1 - w.p0) * e; if (w.t >= 1) cam.tw = null; }
      const sp = cam.dist * .7 * dt, s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
      if (keys.has('KeyW') || keys.has('ArrowUp')) { cam.tx -= s * sp; cam.tz -= c * sp; } if (keys.has('KeyS') || keys.has('ArrowDown')) { cam.tx += s * sp; cam.tz += c * sp; }
      if (keys.has('KeyA')) { cam.tx -= c * sp; cam.tz += s * sp; } if (keys.has('KeyD')) { cam.tx += c * sp; cam.tz -= s * sp; }
      if (keys.has('KeyQ')) cam.yaw += dt * 1.1; if (keys.has('KeyE')) cam.yaw -= dt * 1.1;
      if (sigOf() !== camSig) { // set from outside: put the orbit there
        cam.tx = Math.max(-W / 2, Math.min(W / 2, cam.tx)); cam.tz = Math.max(-H / 2, Math.min(H / 2, cam.tz)); placeCamera(); controls.target.set(cam.tx, hAt(cam.tx, cam.tz), cam.tz); controls.update(); }
      else if (controls.enabled) { // the orbit moved (or glides on): read it back, keep it over the field and above the ground
        controls.update(); const tg = controls.target, ox = camera.position.x - tg.x, oy = camera.position.y - tg.y, oz = camera.position.z - tg.z;
        cam.dist = Math.hypot(ox, oy, oz); cam.pitch = Math.asin(Math.max(-1, Math.min(1, oy / cam.dist))); cam.yaw = Math.atan2(ox, oz);
        cam.tx = Math.max(-W / 2, Math.min(W / 2, tg.x)); cam.tz = Math.max(-H / 2, Math.min(H / 2, tg.z)); placeCamera(); controls.target.set(cam.tx, hAt(cam.tx, cam.tz), cam.tz); }
      else placeCamera();
      camSig = sigOf();
      rail.tick(dt); draw(dt, t);
      // the shadow map (thousands of figures) is redrawn when the view moves and a few times a second while men move
      const ck = [cam.tx, cam.tz, cam.dist, cam.yaw, cam.pitch].map(v => Math.round(v * 10)).join();
      if (ck !== shadowView || ++shadowTick % (BS.running ? 2 : 6) === 0) { shadowView = ck; renderer.shadowMap.needsUpdate = true; }
      renderer.render(scene, camera);
    },
    key(e) {
      const k = e.code;
      if (k === 'ArrowLeft' || k === 'ArrowRight') { rail.stop(); rail.step(k === 'ArrowLeft' ? -1 : 1); return true; }
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown'].includes(k)) { keys.add(k); return true; }
      if (readOnly && ['KeyM', 'KeyF', 'KeyC', 'KeyH', 'Enter'].includes(k)) return true;
      if (k === 'KeyM') { setArmyTool('move'); return true; } if (k === 'KeyF') { setArmyTool('face'); return true; }
      if (k === 'KeyC') { armyForm(); return true; } if (k === 'KeyH') { armyHold(); return true; }
      if (k === 'Enter') { runPhase(1); return true; } if (k === 'KeyB') { window.__w3d.act('room'); return true; }
      if (k === 'KeyG') { window.__w3d.act('gfx'); return true; }
      if (k === 'KeyO' || k === 'KeyR') { window.__w3d.act(k === 'KeyO' ? 'orders' : 'reports'); return true; }
      if (k === 'Tab') { window.__w3d.act('map'); return true; }
      if (k === 'Escape') { if (armyTool) setArmyTool(armyTool); else { inspected = null; selectUnits([]); } lastCardKey = ''; return true; }
      return false;
    },
    keyUp(e) { keys.delete(e.code); },
    pointerDown() { },
    pointerMove(e, drag) {
      if (drag) return; // the orbit turns and pans
      const id = pickUnit(e); if (id !== hover) { hover = id; renderer.domElement.style.cursor = armyTool ? 'crosshair' : id ? 'pointer' : 'default'; } else if (armyTool) renderer.domElement.style.cursor = 'crosshair';
    },
    pointerUp(e, drag) { if (drag && drag.moved < 6 && drag.b === 0) click(e); },
    wheel(e) { if (e.deltaY > 0 && cam.dist >= 5900 && onRise) onRise(cam.tx, cam.tz); }, // the orbit zooms
    debug: { cam, vis, pools, guns, get inspected() { return inspected; }, ground: G, exag: EXAG, controls, rail },
    // the field's own geometry and painted textures; materials are shared with the rest of the world (nature.js, props.js)
    dispose() { controls.dispose(); rail.remove(); labels.remove(); card.remove(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); }); groundTex.dispose(); grainTex.dispose(); },
  };
  function resize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
}
