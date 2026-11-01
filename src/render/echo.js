// The signature: every sound is a ring of light. One set of uniforms (the live rings, the glows round mice, the hole and the
// cheese, the memory of what has been squeaked) is read by every surface and by the edge lines.

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
  uMemFloor: { value: 0.2 },
  uAmber: { value: new THREE.Color(PALETTE.amber) },
  uCream: { value: new THREE.Color(PALETTE.cream) },
  uTints: { value: [PALETTE.cream, ...SEAT_COLORS, PALETTE.moon, PALETTE.lantern].map((c) => new THREE.Color(c)) },
  uFill: { value: 0.22 },
  uRimScale: { value: 1 },
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
uniform float uMemFloor;
uniform vec3 uAmber;
uniform vec3 uCream;
uniform vec3 uTints[6];
uniform float uFill;
uniform float uRimScale;

// reveal: how lit by echoes (0..1+), front: the ring's leading edge right here, tint: that ring's colour.
void echoAt(vec2 p, out float reveal, out float front, out vec3 tint) {
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
    // The leading edge, while it travels.
    float band = exp(-pow((d - r) / (0.22 + maxR * 0.012), 2.0)) * (1.0 - u * u) * step(age, b.x + 0.05);
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
    // What it has passed lights up and fades: full for 0.4 s, a tenth by 2 s.
    if (d <= r) {
      float passAge = age - b.x * (1.0 - sqrt(max(0.0, 1.0 - d / maxR)));
      float fade = passAge < 0.4 ? 1.0 : exp(-(passAge - 0.4) * 1.4);
      fade *= 1.0 - 0.35 * (d / maxR);
      reveal = max(reveal, fade * strength);
    }
  }
  for (int i = 0; i < ${MAX_GLOWS}; i++) {
    if (i >= uGlowCount) break;
    vec4 g = uGlow[i];
    float d = length(p - g.xy);
    reveal = max(reveal, g.w * smoothstep(g.z, g.z * 0.25, d));
  }
  vec2 muv = (p - uMemInfo.xy) / uMemInfo.zw;
  if (muv.x > 0.0 && muv.y > 0.0 && muv.x < 1.0 && muv.y < 1.0) reveal = max(reveal, texture2D(uMem, muv).r * uMemFloor);
}
`;

// Surfaces: a faint fill where echoes pass, the ring's edge in its colour, everything else lit by real lights.
export function patchEcho(material, { fill = 1, front = 1, rim = 0, seams = null, glow = null } = {}) {
  material.userData.echoGlow = glow ?? { value: 0 };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, echo, { uFillScale: { value: fill }, uFrontScale: { value: front }, uRim: { value: rim }, uSeams: { value: seams }, uSelfGlow: material.userData.echoGlow });
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
      .replace('#include <common>', `#include <common>\nvarying vec3 vEchoPos;\nvarying vec3 vEchoN;\nuniform float uFillScale;\nuniform float uFrontScale;\nuniform float uRim;\nuniform float uSelfGlow;\n${seams ? 'uniform sampler2D uSeams;' : ''}\n${GLSL_ECHO}`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          float rv; float fr; vec3 tint;
          echoAt(vEchoPos.xz, rv, fr, tint);
          totalEmissiveRadiance += diffuseColor.rgb * uFill * uFillScale * rv + uAmber * 0.05 * rv * uFillScale + tint * fr * 0.55 * uFrontScale;
          totalEmissiveRadiance += diffuseColor.rgb * uSelfGlow;
          ${seams ? 'float sm = texture2D(uSeams, vEchoPos.xz / 8.0).r; totalEmissiveRadiance += uAmber * sm * (rv * 0.8 + fr * 1.3);' : ''}
          if (uRim > 0.0) {
            vec3 vd = normalize(cameraPosition - vEchoPos);
            float f = pow(1.0 - abs(dot(vd, normalize(vEchoN))), 2.5);
            totalEmissiveRadiance += uCream * f * uRim * uRimScale;
          }
        }`,
      );
  };
  // fill, front and rim are uniforms (each material keeps its own), so only the seams change the shader's text: fewer programs.
  material.customProgramCacheKey = () => `echo${seams ? '-s' : ''}`;
  return material;
}

// ---------------------------------------------------------------- edge lines: wide lines lit by echoes

const LINE_VERT = /* glsl */ `
attribute vec3 aA;
attribute vec3 aB;
attribute vec2 aC;
uniform vec2 uRes;
uniform float uWidth;
varying vec3 vW;
varying float vSide;
void main() {
  vec4 ca = projectionMatrix * viewMatrix * vec4(aA, 1.0);
  vec4 cb = projectionMatrix * viewMatrix * vec4(aB, 1.0);
  vec2 sa = ca.xy / ca.w;
  vec2 sb = cb.xy / cb.w;
  vec2 dir = (sb - sa) * uRes;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  vec4 c = mix(ca, cb, aC.x);
  c.xy += n * aC.y * uWidth / uRes * c.w;
  c.z -= 0.0012 * c.w;
  vW = mix(aA, aB, aC.x);
  vSide = aC.y;
  gl_Position = c;
}
`;

const LINE_FRAG = /* glsl */ `
${GLSL_ECHO}
varying vec3 vW;
varying float vSide;
uniform float uBoost;
void main() {
  float rv; float fr; vec3 tint;
  echoAt(vW.xz, rv, fr, tint);
  float soft = 1.0 - smoothstep(0.55, 1.0, abs(vSide));
  float i = rv * 0.95 + fr * 1.6;
  if (i < 0.004) discard;
  vec3 col = mix(uAmber, mix(uCream, tint, 0.35), clamp(fr * 1.4 + max(0.0, rv - 0.85) * 2.0, 0.0, 1.0));
  gl_FragColor = vec4(col * i * uBoost * soft, 1.0);
}
`;

export function edgeMaterial(width = 1.6) {
  return new THREE.ShaderMaterial({
    uniforms: { ...echo, uRes: { value: new THREE.Vector2(1, 1) }, uWidth: { value: width }, uBoost: { value: 1.25 } },
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

// Segments ([ax, ay, az, bx, by, bz] each) into one mesh of screen-wide quads.
export function edgeMesh(segments, material) {
  const n = segments.length / 6;
  const A = new Float32Array(n * 12);
  const B = new Float32Array(n * 12);
  const C = new Float32Array(n * 8);
  const idx = new Uint32Array(n * 6);
  const corners = [[0, -1], [0, 1], [1, 1], [1, -1]];
  for (let s = 0; s < n; s++) {
    for (let k = 0; k < 4; k++) {
      const v = s * 4 + k;
      for (let c = 0; c < 3; c++) {
        A[v * 3 + c] = segments[s * 6 + c];
        B[v * 3 + c] = segments[s * 6 + 3 + c];
      }
      C[v * 2] = corners[k][0];
      C[v * 2 + 1] = corners[k][1];
    }
    const b = s * 4;
    idx.set([b, b + 1, b + 2, b, b + 2, b + 3], s * 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('aA', new THREE.BufferAttribute(A, 3));
  g.setAttribute('aB', new THREE.BufferAttribute(B, 3));
  g.setAttribute('aC', new THREE.BufferAttribute(C, 2));
  // A position attribute so three can compute bounds; the shader doesn't read it.
  g.setAttribute('position', new THREE.BufferAttribute(A, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return mesh;
}

// The edges of a geometry (with a transform) as segments.
export function edgesOf(geometry, matrix, out, threshold = 28) {
  const e = new THREE.EdgesGeometry(geometry, threshold);
  const p = e.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(matrix);
    out.push(v.x, v.y, v.z);
  }
  e.dispose();
}

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

export function setGlows(glows) {
  const n = Math.min(MAX_GLOWS, glows.length);
  for (let i = 0; i < n; i++) echo.uGlow.value[i].set(glows[i][0], glows[i][1], glows[i][2], glows[i][3]);
  echo.uGlowCount.value = n;
}

// The memory of what's been squeaked: a small grid over the level, stamped as rings finish.
export function createMemory(W, D, perUnit = 4) {
  const w = W * perUnit;
  const h = D * perUnit;
  const data = new Uint8Array(w * h);
  const tex = new THREE.DataTexture(data, w, h, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  echo.uMem.value = tex;
  echo.uMemInfo.value.set(0, 0, W, D);
  return {
    tex,
    clear() {
      data.fill(0);
      tex.needsUpdate = true;
    },
    stamp(x, z, r, value = 255) {
      const x0 = Math.max(0, Math.floor((x - r) * perUnit));
      const x1 = Math.min(w - 1, Math.ceil((x + r) * perUnit));
      const z0 = Math.max(0, Math.floor((z - r) * perUnit));
      const z1 = Math.min(h - 1, Math.ceil((z + r) * perUnit));
      for (let j = z0; j <= z1; j++) {
        for (let i = x0; i <= x1; i++) {
          const d = Math.hypot((i + 0.5) / perUnit - x, (j + 0.5) / perUnit - z);
          if (d > r) continue;
          const v = Math.round(value * (1 - 0.3 * (d / r)));
          if (v > data[j * w + i]) data[j * w + i] = v;
        }
      }
      tex.needsUpdate = true;
    },
    dispose() {
      tex.dispose();
    },
  };
}
