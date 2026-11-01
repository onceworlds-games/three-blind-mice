// After the scene: the echo outlines (from depth), bloom on what glows, ACES and sRGB, then a grade: a cool lift in the
// shadows, a vignette and a little film grain. Low quality keeps the outlines (they are the game) and skips the rest.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { EdgeShader } from './echo.js';

class EdgePass extends Pass {
  constructor(camera) {
    super();
    this.camera = camera;
    this.material = new THREE.ShaderMaterial({ uniforms: { ...EdgeShader.uniforms }, vertexShader: EdgeShader.vertexShader, fragmentShader: EdgeShader.fragmentShader, depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    const u = this.material.uniforms;
    u.tDiffuse.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.uNear.value = this.camera.near;
    u.uFar.value = this.camera.far;
    u.uProjInv.value.copy(this.camera.projectionMatrixInverse);
    u.uViewInv.value.copy(this.camera.matrixWorld);
    u.uTexel.value.set(1 / readBuffer.width, 1 / readBuffer.height);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.035 },
    uLift: { value: new THREE.Color(0.012, 0.016, 0.034) },
    uDanger: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform vec3 uLift;
    uniform float uDanger;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 7.13) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(uRes.x / uRes.y, 1.0)) / length(vec2(uRes.x / uRes.y, 1.0) * 0.5);
      vec3 col;
      if (uDanger > 0.001) {
        vec2 off = c * 0.006 * uDanger * r;
        col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      } else col = texture2D(tDiffuse, vUv).rgb;
      col = col + uLift * (1.0 - col);
      col *= 1.0 - uVignette * smoothstep(0.35, 1.05, r);
      col += (hash(floor(vUv * uRes)) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

class GradePass extends Pass {
  constructor() {
    super();
    this.material = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.clone(GradeShader.uniforms), vertexShader: GradeShader.vertexShader, fragmentShader: GradeShader.fragmentShader, depthTest: false, depthWrite: false });
    this.quad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.uRes.value.set(readBuffer.width, readBuffer.height);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() {
    this.material.dispose();
    this.quad.dispose();
  }
}

export function createPost(renderer, scene, camera, quality) {
  const samples = quality === 'high' ? 4 : 0;
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples });
  target.depthTexture = new THREE.DepthTexture(1, 1);
  target.depthTexture.type = THREE.FloatType;
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const edges = new EdgePass(camera);
  composer.addPass(edges);
  let bloom = null;
  if (quality !== 'low') {
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.85);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());
  const grade = new GradePass();
  if (quality === 'low') {
    grade.material.uniforms.uGrain.value = 0;
  }
  composer.addPass(grade);
  return {
    composer,
    renderPass,
    edges,
    bloom,
    grade,
    setScene(sc, cam) {
      renderPass.scene = sc;
      renderPass.camera = cam;
      edges.camera = cam;
    },
    setSize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      if (bloom) bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
      edges.material.uniforms.uSpread.value = Math.max(1, pr * 0.85);
    },
    render(dt, time) {
      grade.material.uniforms.uTime.value = time % 100;
      composer.render(dt);
    },
    dispose() {
      composer.dispose();
      target.dispose();
    },
  };
}
