import * as THREE from 'three';

/* The finish on the walking world: soft occlusion where things meet (ground under a wall, a barrel on the paving),
   a warm-light / cool-shadow grade and a light vignette. One full-screen pass over a multisampled render. */
export function createPost(renderer) {
  const depth = new THREE.DepthTexture(1, 1); depth.type = THREE.UnsignedIntType;
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, depthTexture: depth });
  const U = { tColor: { value: rt.texture }, tDepth: { value: depth }, proj: { value: new THREE.Matrix4() }, projInv: { value: new THREE.Matrix4() }, res: { value: new THREE.Vector2(1, 1) }, ao: { value: 1 }, grade: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, depthTest: false, depthWrite: false, toneMapped: true,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D tColor, tDepth; uniform mat4 proj, projInv; uniform vec2 res; uniform float ao, grade; varying vec2 vUv;
      vec3 viewPos(vec2 uv) { float z = texture2D(tDepth, uv).x; vec4 v = projInv * vec4(uv * 2. - 1., z * 2. - 1., 1.); return v.xyz / v.w; }
      void main() {
        vec4 col = texture2D(tColor, vUv); float z = texture2D(tDepth, vUv).x; float occ = 1.;
        if (ao > 0. && z < 1.) {
          vec3 p = viewPos(vUv), n = normalize(cross(dFdx(p), dFdy(p)));
          float R = 1.1, rpx = R * proj[1][1] * .5 * res.y / -p.z, sum = 0.;
          float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))) * 6.2832;
          for (int i = 0; i < 12; i++) {
            float f = (float(i) + .5) / 12., a = float(i) * 2.39996 + jit;
            vec2 o = vec2(cos(a), sin(a)) * f * min(rpx, 90.) / res;
            vec3 v = viewPos(vUv + o) - p; float d = length(v);
            sum += max(0., dot(n, v) / (d + .0001) - .15) * (1. - smoothstep(R * .6, R * 1.6, d));
          }
          occ = 1. - ao * .85 * clamp(sum / 12. * 1.8, 0., 1.) * (1. - smoothstep(60., 140., -p.z));
        }
        gl_FragColor = vec4(col.rgb * occ, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec3 c = gl_FragColor.rgb; float l = dot(c, vec3(.2126, .7152, .0722));
        vec3 g = c * mix(vec3(.97, .97, 1.02), vec3(1.05, 1., .9), smoothstep(.15, .75, l)); // cool shadows, warm light
        g = mix(vec3(dot(g, vec3(.2126, .7152, .0722))), g, 1.06);
        g = g * .96 + vec3(.035, .028, .02); // lift the blacks a touch, toward ochre
        vec2 q = vUv - .5; g *= 1. - .28 * smoothstep(.35, .85, length(q * vec2(1., .8)));
        gl_FragColor.rgb = mix(c, g, grade);
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const qScene = new THREE.Scene(); qScene.add(quad); const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const size = new THREE.Vector2();
  return {
    uniforms: U,
    setSize() { renderer.getDrawingBufferSize(size); rt.setSize(size.x, size.y); U.res.value.copy(size); },
    render(scene, camera) {
      U.proj.value.copy(camera.projectionMatrix); U.projInv.value.copy(camera.projectionMatrixInverse);
      renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(qScene, qCam);
    },
    dispose() { rt.dispose(); depth.dispose(); mat.dispose(); },
  };
}
