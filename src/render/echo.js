// The signature: every sound is a ring of light. One set of uniforms (the live rings, the glows round mice, the hole and the
// cheese, the fading memory of what has been squeaked) is read by every surface, which lights up in amber as a ring passes,
// and by the outline pass, which draws the edge of everything a ring touches. A cut-away keeps your mouse in view.

import * as THREE from 'three';
import { RINGS, MAX_RINGS } from '../core/rings.js';

export const PALETTE = {
  midnight: 0x0c0d18,
  amber: 0xf4a835,
  cream: 0xfff1d6,
  lantern: 0xff7b22,
  cheese: 0xffd23f,
  knife: 0xe23d2e,
  moon: 0x7ea2ff,
};
export const SEAT_COLORS = [0x7ea2ff, 0xff7fa8, 0x6fe0b0];
export const SEAT_CSS = ['#7EA2FF', '#FF7FA8', '#6FE0B0'];
// Each seat's shape (circle, triangle, square), drawn, so it looks the same on every device: SVG paths centred on 0, 0 at
// radius 1.
export const SEAT_SHAPES = ['M1 0A1 1 0 1 1-1 0A1 1 0 1 1 1 0Z', 'M0-1.05L1.05 0.8L-1.05 0.8Z', 'M-0.85-0.85H0.85V0.85H-0.85Z'];
export const seatSvg = (seat, size = 14, color = SEAT_CSS[seat] ?? '#fff') =>
  `<svg class="shape" viewBox="-1.2 -1.2 2.4 2.4" width="${size}" height="${size}" style="vertical-align:-0.1em"><path d="${SEAT_SHAPES[seat] ?? SEAT_SHAPES[0]}" fill="${color}"/></svg>`;

const MAX_GLOWS = 10;

export const echo = {
  uTime: { value: 0 },
  uRingA: { value: Array.from({ length: MAX_RINGS }, () => new THREE.Vector4(0, 0, -99, 0)) },
  uRingB: { value: Array.from({ length: MAX_RINGS }, () => new THREE.Vector4(1, 0, 0, 0)) },
  uRingCount: { value: 0 },
  uGlow: { value: Array.from({ length: MAX_GLOWS }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uGlowCount: { value: 0 },
  uMem: { value: null },
  uMemInfo: { value: new THREE.Vector4(0, 0, 1, 1) },
  uAmber: { value: new THREE.Color(PALETTE.amber) },
  uCream: { value: new THREE.Color(PALETTE.cream) },
  uTints: { value: [PALETTE.cream, ...SEAT_COLORS, PALETTE.moon, PALETTE.lantern].map((c) => new THREE.Color(c)) },
  uFillGain: { value: 1 },
  uRimScale: { value: 1 },
  // The cut-away: the mouse you're watching (xyz) and the radius (w) cleared round the line from the camera to it.
  uCut: { value: new THREE.Vector4(0, 0, 0, 0) },
  // The ink line round the mice, the cat and the cheese: its width per unit of distance from the camera (so the same on
  // screen at any zoom).
  uInk: { value: 0.0021 },
  // What the characters write to alpha so the outline pass leaves them to their own ink and rim (1 where nothing reads it).
  uMark: { value: 1 },
};

// Tint index per ring: 0 cream, 1-3 the seats, 4 moon (masking sounds), 5 lantern (the hunters' steps).
export const TINT = { cream: 0, moon: 4, lantern: 5 };

const GLSL_ECHO = /* glsl */ `
uniform float uTime;
uniform vec4 uRingA[${MAX_RINGS}];
uniform vec4 uRingB[${MAX_RINGS}];
uniform int uRingCount;
uniform vec4 uGlow[${MAX_GLOWS}];
uniform int uGlowCount;
uniform sampler2D uMem;
uniform vec4 uMemInfo;
uniform vec3 uAmber;
uniform vec3 uCream;
uniform vec3 uTints[6];

// reveal: how lit by echoes (0..1+), front: the ring's leading edge right here, tint: that ring's colour,
// mem: the memory here (r: recent, fading; g: ever heard).
void echoAt(vec2 p, out float reveal, out float front, out vec3 tint, out vec2 mem) {
  reveal = 0.0;
  front = 0.0;
  tint = uCream;
  for (int i = 0; i < ${MAX_RINGS}; i++) {
    if (i >= uRingCount) break;
    vec4 a = uRingA[i];
    vec4 b = uRingB[i];
    float age = uTime - a.z;
    if (age < 0.0) continue;
    float maxR = a.w;
    float d = length(p - a.xy);
    if (d > maxR + 0.6) continue;
    float u = clamp(age / b.x, 0.0, 1.0);
    float r = maxR * (1.0 - (1.0 - u) * (1.0 - u));
    float strength = b.y;
    float band = exp(-pow((d - r) / (0.13 + maxR * 0.01), 2.0)) * (1.0 - u * u) * step(age, b.x + 0.05);
    float pat = b.w;
    if (pat > 0.5) {
      float ang = atan(p.y - a.y, p.x - a.x);
      float k = ang * max(6.0, r * 2.2);
      if (pat < 1.5) band *= step(0.0, sin(k));
      else if (pat < 2.5) band *= smoothstep(0.55, 0.95, sin(k * 1.6));
      else band *= 0.55 + 0.45 * step(0.3, sin(k * 2.5));
    }
    if (band * strength > front) {
      front = band * strength;
      tint = uTints[int(b.z + 0.5)];
    }
    if (d <= r) {
      float passAge = age - b.x * (1.0 - sqrt(max(0.0, 1.0 - d / maxR)));
      float fade = passAge < 0.35 ? 1.0 : exp(-(passAge - 0.35) * 1.5);
      fade *= 1.0 - 0.4 * (d / maxR);
      reveal = max(reveal, fade * strength);
    }
  }
  for (int i = 0; i < ${MAX_GLOWS}; i++) {
    if (i >= uGlowCount) break;
    vec4 g = uGlow[i];
    float d = length(p - g.xy);
    reveal = max(reveal, g.w * smoothstep(g.z, g.z * 0.2, d));
  }
  vec2 muv = (p - uMemInfo.xy) / uMemInfo.zw;
  mem = vec2(0.0);
  if (muv.x > 0.0 && muv.y > 0.0 && muv.x < 1.0 && muv.y < 1.0) mem = texture2D(uMem, muv).rg;
}
`;

const GLSL_CUT = /* glsl */ `
uniform vec4 uCut;
void echoCut(vec3 wp) {
  if (uCut.w <= 0.0 || wp.y < 0.32) return;
  vec3 rd = uCut.xyz - cameraPosition;
  float far = length(rd);
  rd /= far;
  vec3 op = wp - cameraPosition;
  float along = dot(op, rd);
  if (along > far - 0.25) return;
  // A clean edge: a dithered one leaves a depth edge at every other pixel, and the outline pass draws each as a speck.
  if (length(op - rd * along) < uCut.w * 0.86) discard;
}
`;

// Surfaces: lit amber where echoes pass (their own colour, warmed), the ring's edge in its colour, everything else lit by
// real lights. rim: a soft edge light for the characters. cut: cleared out of the way of your mouse. actor: the colour of
// a character's rim (the mice, the cat, the cheese): it keeps its own colour in any light, a little lit even in the dark,
// brighter where echoes pass but never washed out to cream, with a rim of that colour round its silhouette.
export function patchEcho(material, { fill = 1, front = 1, rim = 0, cut = true, glow = null, actor = null } = {}) {
  material.userData.echoGlow = glow ?? { value: 0 };
  material.userData.echoFill = { value: fill };
  material.userData.echoFront = { value: front };
  material.userData.echoRim = { value: rim };
  material.userData.echoRimColor = { value: new THREE.Color(actor ?? PALETTE.cream) };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, echo, { uFillScale: material.userData.echoFill, uFrontScale: material.userData.echoFront, uRim: material.userData.echoRim, uSelfGlow: material.userData.echoGlow, uRimColor: material.userData.echoRimColor });
    if (actor != null) {
      shader.defines = { ...shader.defines, ECHO_ACTOR: 1 };
      if (!material.transparent) shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = uMark;');
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEchoPos;\nvarying vec3 vEchoN;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 echoP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          echoP = instanceMatrix * echoP;
        #endif
        vEchoPos = (modelMatrix * echoP).xyz;
        vEchoN = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vEchoPos;\nvarying vec3 vEchoN;\nuniform float uFillScale;\nuniform float uFrontScale;\nuniform float uRim;\nuniform float uSelfGlow;\nuniform float uFillGain;\nuniform float uRimScale;\nuniform vec3 uRimColor;\nuniform float uMark;\n${GLSL_ECHO}\n${cut ? GLSL_CUT : ''}`)
      .replace('void main() {', `void main() {\n${cut ? 'echoCut(vEchoPos);' : ''}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float rv; float fr; vec3 tint; vec2 mem;
          echoAt(vEchoPos.xz, rv, fr, tint, mem);
          vec3 alb = diffuseColor.rgb;
          #ifdef ECHO_ACTOR
          float lit = min(0.8, max(rv, mem.r * mem.r * 0.16));
          totalEmissiveRadiance += alb * (0.14 + lit * 0.62) * uFillGain * uFillScale + tint * fr * 0.1 * uFrontScale;
          {
            vec3 vd = normalize(cameraPosition - vEchoPos);
            float f = pow(1.0 - abs(dot(vd, normalize(vEchoN))), 2.0);
            totalEmissiveRadiance += uRimColor * f * uRim * uRimScale * (0.9 + 0.5 * min(rv, 1.0));
          }
          #else
          float lit = max(rv, mem.r * mem.r * 0.16);
          totalEmissiveRadiance += (alb * 0.85 + 0.03) * uAmber * lit * uFillGain * uFillScale + tint * fr * 0.42 * uFrontScale;
          if (uRim > 0.0) {
            vec3 vd = normalize(cameraPosition - vEchoPos);
            float f = pow(1.0 - abs(dot(vd, normalize(vEchoN))), 2.4);
            totalEmissiveRadiance += uCream * f * uRim * uRimScale * (0.35 + rv);
          }
          #endif
          totalEmissiveRadiance += alb * uSelfGlow;
        }`,
      );
  };
  material.customProgramCacheKey = () => `echo${cut ? '-c' : ''}${actor != null ? '-a' : ''}`;
  return material;
}

// The ink line: a shell just outside the mesh, its back faces in a dark ink, the same width on screen at any distance.
// Characters wear it so they read against bright floors as well as dark ones (their rim does the dark ones).
const inkMats = new Map();
export function inkMaterial(color = 0x07060b) {
  if (inkMats.has(color)) return inkMats.get(color);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uInk = echo.uInk;
    shader.uniforms.uMark = echo.uMark;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uMark;').replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a = uMark;');
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uInk;').replace(
      '#include <project_vertex>',
      `vec4 inkP = modelMatrix * vec4(transformed, 1.0);
      vec3 inkN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
      inkP.xyz += inkN * uInk * distance(cameraPosition, inkP.xyz);
      vec4 mvPosition = viewMatrix * inkP;
      gl_Position = projectionMatrix * mvPosition;`,
    );
  };
  m.customProgramCacheKey = () => 'ink';
  inkMats.set(color, m);
  return m;
}

// Give a mesh its ink line (a child sharing its geometry). Returns the mesh.
export function ink(mesh, color) {
  const shell = new THREE.Mesh(mesh.geometry, inkMaterial(color));
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.userData.ink = true;
  mesh.add(shell);
  return mesh;
}

// ---------------------------------------------------------------- the outline pass

// Reads the scene's colour and depth: wherever depth jumps (a silhouette) or bends (a crease), draws a line lit by the
// echoes at that spot: cream-hot at a ring's front, amber behind it, a fading trace where rings have been.
export const EdgeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2(1, 1) },
    uSpread: { value: 1 },
    uNear: { value: 0.5 },
    uFar: { value: 100 },
    uProjInv: { value: new THREE.Matrix4() },
    uViewInv: { value: new THREE.Matrix4() },
    uLine: { value: 1 },
    uSil: { value: new THREE.Vector2(0.008, 0.03) },
    uCrease: { value: new THREE.Vector2(0.0025, 0.009) },
    ...echo,
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    ${GLSL_ECHO}
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uTexel;
    uniform float uSpread;
    uniform float uNear;
    uniform float uFar;
    uniform mat4 uProjInv;
    uniform mat4 uViewInv;
    uniform float uLine;
    uniform vec2 uSil;
    uniform vec2 uCrease;
    varying vec2 vUv;
    float dist(vec2 uv, out float raw) {
      raw = texture2D(tDepth, uv).x;
      return -perspectiveDepthToViewZ(raw, uNear, uFar);
    }
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float r0; float rl; float rr; float ru; float rd;
      vec2 o = uTexel * uSpread;
      float z0 = dist(vUv, r0);
      float zl = dist(vUv - vec2(o.x, 0.0), rl);
      float zr = dist(vUv + vec2(o.x, 0.0), rr);
      float zu = dist(vUv + vec2(0.0, o.y), ru);
      float zd = dist(vUv - vec2(0.0, o.y), rd);
      if (min(min(r0, rl), min(min(rr, ru), rd)) >= 0.99999) { gl_FragColor = vec4(col.rgb, 1.0); return; }
      float zn = min(z0, min(min(zl, zr), min(zu, zd)));
      float jump = max(max(abs(zl - z0), abs(zr - z0)), max(abs(zu - z0), abs(zd - z0))) / zn;
      float sil = smoothstep(uSil.x, uSil.y, jump);
      float w0 = 1.0 / z0;
      float lap = max(abs(1.0 / zl + 1.0 / zr - 2.0 * w0), abs(1.0 / zu + 1.0 / zd - 2.0 * w0)) / w0;
      float crease = smoothstep(uCrease.x, uCrease.y, lap) * (1.0 - sil);
      float e = max(sil, crease * 0.75);
      if (e < 0.02) { gl_FragColor = vec4(col.rgb, 1.0); return; }
      // The edge belongs to the nearer surface: find where that is in the world.
      vec2 uvn = vUv; float rn = r0;
      if (zl <= zn + 1e-4) { uvn = vUv - vec2(o.x, 0.0); rn = rl; }
      else if (zr <= zn + 1e-4) { uvn = vUv + vec2(o.x, 0.0); rn = rr; }
      else if (zu <= zn + 1e-4) { uvn = vUv + vec2(0.0, o.y); rn = ru; }
      else if (zd <= zn + 1e-4) { uvn = vUv - vec2(0.0, o.y); rn = rd; }
      // A character (marked in alpha) draws its own ink and rim.
      e *= smoothstep(0.62, 0.92, texture2D(tDiffuse, uvn).a);
      if (e < 0.02) { gl_FragColor = vec4(col.rgb, 1.0); return; }
      vec4 ndc = vec4(uvn * 2.0 - 1.0, rn * 2.0 - 1.0, 1.0);
      vec4 vp = uProjInv * ndc;
      vp /= vp.w;
      vec3 wp = (uViewInv * vp).xyz;
      float rv; float fr; vec3 tint; vec2 mem;
      echoAt(wp.xz, rv, fr, tint, mem);
      float lit = max(rv * (0.4 + 0.6 * rv), max(mem.r * 0.3, mem.g * 0.05));
      vec3 line = mix(uAmber, uCream, clamp((rv - 0.7) * 2.0, 0.0, 1.0)) * lit * 1.5 + mix(uCream, tint, 0.45) * fr * 4.0;
      gl_FragColor = vec4(col.rgb + line * e * uLine, 1.0);
    }`,
};

// ---------------------------------------------------------------- feeding the uniforms

// rings: [{ kind, x, z, t, tint, pattern, strength }] already chosen and ordered by importance.
export function setRings(rings, time) {
  echo.uTime.value = time;
  const n = Math.min(MAX_RINGS, rings.length);
  for (let i = 0; i < n; i++) {
    const r = rings[i];
    const def = RINGS[r.kind] ?? RINGS.small;
    echo.uRingA.value[i].set(r.x, r.z, r.t, def.r);
    echo.uRingB.value[i].set(def.dur, r.strength ?? 1, r.tint ?? 0, r.pattern ?? 0);
  }
  echo.uRingCount.value = n;
}

export function setGlows(glows, n = glows.length) {
  n = Math.min(MAX_GLOWS, n);
  for (let i = 0; i < n; i++) echo.uGlow.value[i].set(glows[i][0], glows[i][1], glows[i][2], glows[i][3]);
  echo.uGlowCount.value = n;
}

// The memory of what's been heard: a small grid over the level, stamped as rings finish. Red fades (a recent echo), green
// stays (it was heard once: a faint trace of the room's outlines).
export function createMemory(W, D, perUnit = 4) {
  const w = W * perUnit;
  const h = D * perUnit;
  const recent = new Float32Array(w * h);
  const data = new Uint8Array(w * h * 2);
  const tex = new THREE.DataTexture(data, w, h, THREE.RGFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  echo.uMem.value = tex;
  echo.uMemInfo.value.set(0, 0, W, D);
  let live = 0;
  return {
    tex,
    clear() {
      recent.fill(0);
      data.fill(0);
      tex.needsUpdate = true;
      live = 0;
    },
    stamp(x, z, r, value = 1, seen = 1) {
      const x0 = Math.max(0, Math.floor((x - r) * perUnit));
      const x1 = Math.min(w - 1, Math.ceil((x + r) * perUnit));
      const z0 = Math.max(0, Math.floor((z - r) * perUnit));
      const z1 = Math.min(h - 1, Math.ceil((z + r) * perUnit));
      for (let j = z0; j <= z1; j++) {
        for (let i = x0; i <= x1; i++) {
          const d = Math.hypot((i + 0.5) / perUnit - x, (j + 0.5) / perUnit - z);
          if (d > r) continue;
          const k = j * w + i;
          const v = value * (1 - 0.35 * (d / r));
          if (v > recent[k]) recent[k] = v;
          const s = Math.round(255 * seen * (1 - 0.3 * (d / r)));
          if (s > data[k * 2 + 1]) data[k * 2 + 1] = s;
        }
      }
      live = 1;
      tex.needsUpdate = true;
    },
    // Recent echoes fade (half-life about 9 s).
    decay(dt) {
      if (!live) return;
      const k = Math.exp(-dt / 13);
      let any = 0;
      for (let i = 0; i < recent.length; i++) {
        let v = recent[i];
        if (v <= 0) continue;
        v *= k;
        if (v < 0.01) v = 0;
        else any = 1;
        recent[i] = v;
        data[i * 2] = Math.round(v * 255);
      }
      live = any;
      tex.needsUpdate = true;
    },
    dispose() {
      tex.dispose();
    },
  };
}
