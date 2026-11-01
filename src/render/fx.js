// Particles: dust from feet and landings, sparks on a big squeak's front, splinters where the knife bites, crumbs, embers
// from the stove, motes drifting in the moonbeams, confetti, and the trails mice earn. Two pooled point clouds (one lit
// additively, one plain) drawn from a small atlas of shapes. No allocations in the frame.

import * as THREE from 'three';

export const CELL = { dot: 0, star: 1, heart: 2, note: 3, petal: 4, spark: 5, chip: 6, ring: 7 };
const CELLS = 8;

let atlas = null;
function atlasTexture() {
  if (atlas) return atlas;
  const S = 64;
  const c = document.createElement('canvas');
  c.width = S * CELLS;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  const at = (i) => i * S + S / 2;
  // dot
  let grad = g.createRadialGradient(at(0), 32, 0, at(0), 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#fff';
  // star
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? 11 : 27;
    const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(at(1) + Math.cos(a) * r, 33 + Math.sin(a) * r);
  }
  g.fill();
  // heart
  g.beginPath();
  g.moveTo(at(2), 52);
  g.bezierCurveTo(at(2) - 30, 30, at(2) - 18, 6, at(2), 20);
  g.bezierCurveTo(at(2) + 18, 6, at(2) + 30, 30, at(2), 52);
  g.fill();
  // note
  g.beginPath();
  g.ellipse(at(3) - 8, 46, 11, 8, -0.4, 0, Math.PI * 2);
  g.fill();
  g.fillRect(at(3) + 1, 12, 5, 35);
  g.beginPath();
  g.moveTo(at(3) + 1, 12);
  g.quadraticCurveTo(at(3) + 22, 18, at(3) + 16, 32);
  g.lineTo(at(3) + 6, 22);
  g.fill();
  // petal
  g.beginPath();
  g.ellipse(at(4), 32, 12, 24, 0.5, 0, Math.PI * 2);
  g.fill();
  // spark: a four-point glint
  grad = g.createRadialGradient(at(5), 32, 0, at(5), 32, 12);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(at(5) - 32, 0, S, S);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(at(5), 2);
  g.quadraticCurveTo(at(5) + 3, 29, at(5) + 30, 32);
  g.quadraticCurveTo(at(5) + 3, 35, at(5), 62);
  g.quadraticCurveTo(at(5) - 3, 35, at(5) - 30, 32);
  g.quadraticCurveTo(at(5) - 3, 29, at(5), 2);
  g.fill();
  // chip: an irregular splinter
  g.beginPath();
  g.moveTo(at(6) - 24, 36);
  g.lineTo(at(6) - 4, 24);
  g.lineTo(at(6) + 26, 26);
  g.lineTo(at(6) + 8, 40);
  g.closePath();
  g.fill();
  // ring
  g.lineWidth = 6;
  g.beginPath();
  g.arc(at(7), 32, 22, 0, Math.PI * 2);
  g.stroke();
  atlas = new THREE.CanvasTexture(c);
  return atlas;
}

const VERT = /* glsl */ `
  attribute float aSize;
  attribute vec4 aCol;
  attribute vec2 aCell;
  uniform float uScale;
  varying vec4 vCol;
  varying vec2 vCell;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 0.0, 256.0);
    vCol = aCol;
    vCell = aCell;
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  varying vec4 vCol;
  varying vec2 vCell;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vCell.y), s = sin(vCell.y);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) discard;
    vec4 t = texture2D(uMap, vec2((p.x + vCell.x) / ${CELLS}.0, 1.0 - p.y));
    float a = t.a * vCol.a;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vCol.rgb * t.rgb, a);
  }`;

function createCloud(max, additive) {
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 4);
  const size = new Float32Array(max);
  const cell = new Float32Array(max * 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aCol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aCell', new THREE.BufferAttribute(cell, 2).setUsage(THREE.DynamicDrawUsage));
  g.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: atlasTexture() }, uScale: { value: 600 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  points.renderOrder = additive ? 6 : 5;
  // Simulation state, structure of arrays.
  const S = {
    n: 0,
    max,
    p: new Float32Array(max * 3),
    v: new Float32Array(max * 3),
    life: new Float32Array(max),
    age: new Float32Array(max),
    s0: new Float32Array(max),
    s1: new Float32Array(max),
    rgb: new Float32Array(max * 3),
    a0: new Float32Array(max),
    grav: new Float32Array(max),
    drag: new Float32Array(max),
    cell: new Float32Array(max),
    rot: new Float32Array(max),
    vrot: new Float32Array(max),
    bounce: new Uint8Array(max),
    fadeIn: new Float32Array(max),
  };
  return { points, g, mat, S, pos, col, size, cellArr: cell };
}

const tmpC = new THREE.Color();

export function createFx() {
  const add = createCloud(1600, true);
  const plain = createCloud(1200, false);
  const group = new THREE.Group();
  group.add(plain.points, add.points);
  let seed = 12345;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const fx = { group, enabled: true, scale: 1 };

  function spawn(cloud, x, y, z, vx, vy, vz, o) {
    const S = cloud.S;
    if (S.n >= S.max) return;
    const i = S.n++;
    S.p[i * 3] = x;
    S.p[i * 3 + 1] = y;
    S.p[i * 3 + 2] = z;
    S.v[i * 3] = vx;
    S.v[i * 3 + 1] = vy;
    S.v[i * 3 + 2] = vz;
    S.life[i] = o.life;
    S.age[i] = 0;
    S.s0[i] = o.s0;
    S.s1[i] = o.s1 ?? o.s0;
    tmpC.setHex(o.color ?? 0xffffff);
    S.rgb[i * 3] = tmpC.r * (o.boost ?? 1);
    S.rgb[i * 3 + 1] = tmpC.g * (o.boost ?? 1);
    S.rgb[i * 3 + 2] = tmpC.b * (o.boost ?? 1);
    S.a0[i] = o.alpha ?? 1;
    S.grav[i] = o.grav ?? 0;
    S.drag[i] = o.drag ?? 0;
    S.cell[i] = o.cell ?? 0;
    S.rot[i] = o.rot ?? rnd() * 6.28;
    S.vrot[i] = o.vrot ?? 0;
    S.bounce[i] = o.bounce ? 1 : 0;
    S.fadeIn[i] = o.fadeIn ?? 0;
  }

  // ---- the kinds
  fx.dust = (x, z, n = 3, a = 0, scale = 1) => {
    if (!fx.enabled) return;
    for (let k = 0; k < n; k++) {
      const ang = a + Math.PI + (rnd() - 0.5) * 2.6;
      const sp = (0.4 + rnd() * 0.9) * scale;
      spawn(plain, x + (rnd() - 0.5) * 0.2, 0.06, z + (rnd() - 0.5) * 0.2, Math.cos(ang) * sp, 0.25 + rnd() * 0.5 * scale, Math.sin(ang) * sp, {
        life: 0.5 + rnd() * 0.5,
        s0: 0.18 * scale,
        s1: 0.55 * scale,
        color: 0x8a7a68,
        alpha: 0.35,
        grav: -0.2,
        drag: 3.5,
        cell: CELL.dot,
      });
    }
  };
  fx.sparks = (x, y, z, n = 8, color = 0xfff1d6, speed = 2.2) => {
    if (!fx.enabled) return;
    for (let k = 0; k < n; k++) {
      const ang = rnd() * Math.PI * 2;
      const up = rnd();
      const sp = speed * (0.5 + rnd() * 0.7);
      spawn(add, x, y, z, Math.cos(ang) * sp, 1 + up * 2.5, Math.sin(ang) * sp, { life: 0.35 + rnd() * 0.4, s0: 0.22, s1: 0.04, color, boost: 2.2, grav: 9, drag: 1.5, cell: CELL.spark, vrot: 6, bounce: true });
    }
  };
  fx.splinters = (x, z, n = 10, color = 0xc8a070) => {
    if (!fx.enabled) return;
    for (let k = 0; k < n; k++) {
      const ang = rnd() * Math.PI * 2;
      const sp = 1 + rnd() * 2.6;
      spawn(plain, x, 0.15, z, Math.cos(ang) * sp, 2 + rnd() * 3, Math.sin(ang) * sp, { life: 0.9 + rnd() * 0.6, s0: 0.16 + rnd() * 0.12, color, grav: 12, drag: 0.8, cell: CELL.chip, vrot: (rnd() - 0.5) * 20, bounce: true });
    }
  };
  fx.crumbs = (x, y, z, n = 6, color = 0xf2c14e) => {
    if (!fx.enabled) return;
    for (let k = 0; k < n; k++) {
      const ang = rnd() * Math.PI * 2;
      const sp = 0.5 + rnd() * 1.2;
      spawn(plain, x, y, z, Math.cos(ang) * sp, 1 + rnd() * 1.6, Math.sin(ang) * sp, { life: 0.6 + rnd() * 0.4, s0: 0.09 + rnd() * 0.06, color, grav: 9, drag: 0.6, cell: CELL.chip, vrot: (rnd() - 0.5) * 16, bounce: true });
    }
  };
  // A glint on something a ring just found.
  fx.glint = (x, y, z, color = 0xfff1d6, size = 0.7) => {
    if (!fx.enabled) return;
    spawn(add, x, y, z, 0, 0.1, 0, { life: 0.5, s0: size, s1: 0.05, color, boost: 2.5, cell: CELL.spark, vrot: 3 });
  };
  // Sparks thrown along a ring's front: they ride out with it and fall.
  fx.ringSparks = (x, z, r, dur, n = 24, color = 0xfff1d6) => {
    if (!fx.enabled) return;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 + rnd() * 0.2;
      const sp = (r / dur) * 1.9 * (0.85 + rnd() * 0.25);
      spawn(add, x + Math.cos(ang) * 0.3, 0.25 + rnd() * 0.3, z + Math.sin(ang) * 0.3, Math.cos(ang) * sp, 0.6 + rnd() * 1.2, Math.sin(ang) * sp, { life: dur * 1.1 + rnd() * 0.3, s0: 0.28, s1: 0.03, color, boost: 1.8, grav: 2, drag: 1.9 / dur, cell: CELL.spark, vrot: 4 });
    }
  };
  fx.confetti = (x, y, z, n = 40) => {
    if (!fx.enabled) return;
    const colors = [0xffd23f, 0xff7fa8, 0x7ea2ff, 0x6fe0b0, 0xf4a835, 0xfff1d6];
    for (let k = 0; k < n; k++) {
      const ang = rnd() * Math.PI * 2;
      const sp = 1 + rnd() * 3;
      spawn(plain, x, y, z, Math.cos(ang) * sp, 3 + rnd() * 4, Math.sin(ang) * sp, { life: 1.6 + rnd(), s0: 0.22, color: colors[k % colors.length], grav: 6, drag: 1.6, cell: k % 3 === 0 ? CELL.star : CELL.chip, vrot: (rnd() - 0.5) * 14, bounce: true });
    }
  };
  fx.ember = (x, y, z, w = 0.4) => {
    if (!fx.enabled) return;
    spawn(add, x + (rnd() - 0.5) * w, y, z + (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.3, 0.5 + rnd() * 0.7, (rnd() - 0.5) * 0.3, { life: 1.2 + rnd(), s0: 0.09, s1: 0.02, color: 0xff7a2a, boost: 2.5, grav: -0.2, drag: 0.5, cell: CELL.dot });
  };
  fx.mote = (x, y, z) => {
    if (!fx.enabled) return;
    spawn(add, x, y, z, (rnd() - 0.5) * 0.08, (rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.08, { life: 4 + rnd() * 3, s0: 0.05 + rnd() * 0.05, color: 0xb8c8ff, alpha: 0.7, boost: 1.2, cell: CELL.dot, fadeIn: 1 });
  };
  // A cosmetic trail behind a running mouse.
  const TRAIL = [null, { cell: CELL.spark, color: 0xfff1d6 }, { cell: CELL.star, color: 0xffd23f }, { cell: CELL.heart, color: 0xff7fa8 }, { cell: CELL.note, color: 0x9fd0ff }, { cell: CELL.petal, color: 0xffb0c8 }];
  fx.trail = (kind, x, z, a, tint) => {
    const t = TRAIL[kind];
    if (!fx.enabled || !t) return;
    spawn(kind === 1 ? add : plain, x - Math.cos(a) * 0.3 + (rnd() - 0.5) * 0.15, 0.2 + rnd() * 0.25, z - Math.sin(a) * 0.3 + (rnd() - 0.5) * 0.15, (rnd() - 0.5) * 0.3, 0.4 + rnd() * 0.4, (rnd() - 0.5) * 0.3, {
      life: 0.7 + rnd() * 0.4,
      s0: kind === 1 ? 0.22 : 0.2,
      s1: 0.04,
      color: kind === 1 ? tint ?? t.color : t.color,
      boost: kind === 1 ? 1.6 : 1,
      grav: kind === 5 ? 0.6 : -0.2,
      drag: 1.2,
      cell: t.cell,
      rot: kind === 2 || kind === 3 ? 0 : undefined,
      vrot: kind === 5 ? 3 : 0,
    });
  };

  function step(cloud, dt) {
    const S = cloud.S;
    let i = 0;
    while (i < S.n) {
      S.age[i] += dt;
      if (S.age[i] >= S.life[i]) {
        // Swap the last one into this slot.
        const j = --S.n;
        if (i !== j) copy(S, j, i);
        continue;
      }
      const d = Math.exp(-S.drag[i] * dt);
      S.v[i * 3] *= d;
      S.v[i * 3 + 1] = S.v[i * 3 + 1] * d - S.grav[i] * dt;
      S.v[i * 3 + 2] *= d;
      S.p[i * 3] += S.v[i * 3] * dt;
      S.p[i * 3 + 1] += S.v[i * 3 + 1] * dt;
      S.p[i * 3 + 2] += S.v[i * 3 + 2] * dt;
      if (S.p[i * 3 + 1] < 0.03) {
        S.p[i * 3 + 1] = 0.03;
        if (S.bounce[i] && S.v[i * 3 + 1] < -0.5) {
          S.v[i * 3 + 1] *= -0.35;
          S.v[i * 3] *= 0.6;
          S.v[i * 3 + 2] *= 0.6;
          S.vrot[i] *= 0.5;
        } else {
          S.v[i * 3 + 1] = 0;
          S.v[i * 3] *= 0.8;
          S.v[i * 3 + 2] *= 0.8;
          S.vrot[i] *= 0.8;
        }
      }
      S.rot[i] += S.vrot[i] * dt;
      i++;
    }
    // To the GPU.
    for (let k = 0; k < S.n; k++) {
      const u = S.age[k] / S.life[k];
      cloud.pos[k * 3] = S.p[k * 3];
      cloud.pos[k * 3 + 1] = S.p[k * 3 + 1];
      cloud.pos[k * 3 + 2] = S.p[k * 3 + 2];
      const fadeIn = S.fadeIn[k] > 0 ? Math.min(1, u * 5) : 1;
      const a = S.a0[k] * (1 - u * u) * fadeIn;
      cloud.col[k * 4] = S.rgb[k * 3];
      cloud.col[k * 4 + 1] = S.rgb[k * 3 + 1];
      cloud.col[k * 4 + 2] = S.rgb[k * 3 + 2];
      cloud.col[k * 4 + 3] = a;
      cloud.size[k] = (S.s0[k] + (S.s1[k] - S.s0[k]) * u) * fx.scale;
      cloud.cellArr[k * 2] = S.cell[k];
      cloud.cellArr[k * 2 + 1] = S.rot[k];
    }
    const g = cloud.g;
    g.setDrawRange(0, S.n);
    if (S.n) {
      for (const name of ['position', 'aCol', 'aSize', 'aCell']) {
        const at = g.attributes[name];
        at.clearUpdateRanges();
        at.addUpdateRange(0, S.n * at.itemSize);
        at.needsUpdate = true;
      }
    }
  }

  fx.update = (dt) => {
    step(add, dt);
    step(plain, dt);
  };
  fx.clear = () => {
    add.S.n = 0;
    plain.S.n = 0;
    add.g.setDrawRange(0, 0);
    plain.g.setDrawRange(0, 0);
  };
  fx.setScale = (s) => {
    add.mat.uniforms.uScale.value = s;
    plain.mat.uniforms.uScale.value = s;
  };
  return fx;
}

function copy(S, from, to) {
  for (let k = 0; k < 3; k++) {
    S.p[to * 3 + k] = S.p[from * 3 + k];
    S.v[to * 3 + k] = S.v[from * 3 + k];
    S.rgb[to * 3 + k] = S.rgb[from * 3 + k];
  }
  S.life[to] = S.life[from];
  S.age[to] = S.age[from];
  S.s0[to] = S.s0[from];
  S.s1[to] = S.s1[from];
  S.a0[to] = S.a0[from];
  S.grav[to] = S.grav[from];
  S.drag[to] = S.drag[from];
  S.cell[to] = S.cell[from];
  S.rot[to] = S.rot[from];
  S.vrot[to] = S.vrot[from];
  S.bounce[to] = S.bounce[from];
  S.fadeIn[to] = S.fadeIn[from];
}
