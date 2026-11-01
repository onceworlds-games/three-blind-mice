// The mice: a sculpted body with fur shading, big pink ears, glowing whiskers, sunglasses, a knitted scarf in the seat's
// colour and a long verlet tail that trails and whips. Procedural animation: a four-legged scurry whose stride follows the
// speed, a lean into turns, squash and stretch on starts and stops, a skid, a sniffing idle, a rear-up on a squeak and a
// crouch while a big one charges. Hats and fur colours from the wardrobe. No allocations in the frame.

import * as THREE from 'three';
import { patchEcho, SEAT_COLORS, PALETTE } from './echo.js';
import { furTexture, knitTexture } from './textures.js';
import { FURS } from '../looks.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const SPH = new THREE.SphereGeometry(1, 20, 14);
const SPH_LO = new THREE.SphereGeometry(1, 10, 7);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const BOXG = new THREE.BoxGeometry(1, 1, 1);

function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = shadow;
  return m;
}

// A lathe along +x: profile [radius, x] pairs.
function latheX(profile, seg = 18) {
  const g = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(Math.max(0.0005, r), x)), seg);
  g.rotateZ(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

const BODY = latheX([[0.0, -0.3], [0.11, -0.29], [0.17, -0.25], [0.2, -0.18], [0.205, -0.1], [0.195, -0.02], [0.17, 0.06], [0.135, 0.12], [0.1, 0.16], [0.0, 0.18]]);
const HEAD = latheX([[0.0, -0.13], [0.1, -0.12], [0.14, -0.08], [0.15, -0.02], [0.14, 0.03], [0.115, 0.08], [0.085, 0.12], [0.055, 0.16], [0.03, 0.195], [0.0, 0.215]]);

// ---------------------------------------------------------------- glasses

function lensShape(style) {
  const s = new THREE.Shape();
  if (style === 3) {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.04 : 0.092;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
  } else if (style === 5) {
    s.moveTo(0, -0.072);
    s.bezierCurveTo(-0.11, 0.0, -0.085, 0.1, 0, 0.042);
    s.bezierCurveTo(0.085, 0.1, 0.11, 0.0, 0, -0.072);
  } else if (style === 1) {
    s.moveTo(-0.085, -0.035);
    s.quadraticCurveTo(-0.095, 0.06, 0.0, 0.055);
    s.quadraticCurveTo(0.095, 0.075, 0.1, 0.025);
    s.quadraticCurveTo(0.05, -0.085, -0.085, -0.035);
  } else if (style === 2) {
    s.moveTo(-0.085, 0.048);
    s.lineTo(0.085, 0.048);
    s.quadraticCurveTo(0.085, -0.095, 0.0, -0.09);
    s.quadraticCurveTo(-0.09, -0.085, -0.085, 0.048);
  } else s.absarc(0, 0, 0.074, 0, Math.PI * 2, false);
  return s;
}

const lensGeos = new Map();
function lensGeo(style) {
  if (!lensGeos.has(style)) lensGeos.set(style, new THREE.ShapeGeometry(lensShape(style), 14));
  return lensGeos.get(style);
}

function makeGlasses(style, mats) {
  const g = new THREE.Group();
  const rim = style === 6 || style === 4 ? mats.gold : mats.frame;
  const sides = style === 4 ? [-1] : [-1, 1];
  for (const side of sides) {
    const lens = new THREE.Mesh(lensGeo(style), mats.lens);
    lens.position.set(0, 0, side * 0.08);
    lens.rotation.y = Math.PI / 2;
    g.add(lens);
    if (style === 0 || style === 4 || style === 6) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(style === 4 ? 0.084 : 0.076, 0.013, 6, 18), rim);
      r.position.copy(lens.position);
      r.position.x -= 0.002;
      r.rotation.y = Math.PI / 2;
      g.add(r);
    }
    const glint = new THREE.Mesh(SPH_LO, mats.glint);
    glint.scale.setScalar(0.016);
    glint.position.set(0.008, 0.03, side * 0.08 + 0.026);
    g.add(glint);
  }
  if (style !== 4) {
    const bridge = new THREE.Mesh(BOXG, rim);
    bridge.scale.set(0.014, 0.014, 0.06);
    bridge.position.set(0, 0.022, 0);
    g.add(bridge);
  } else {
    const chain = new THREE.Mesh(BOXG, mats.gold);
    chain.scale.set(0.007, 0.14, 0.007);
    chain.position.set(-0.02, -0.09, -0.08);
    g.add(chain);
  }
  return g;
}

// ---------------------------------------------------------------- hats

function makeHat(id, mats) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z, sx, sy, sz, rx = 0, rz = 0) => {
    const m = mesh(geo, mat, x, y, z, sx, sy, sz);
    m.rotation.set(rx, 0, rz);
    g.add(m);
    return m;
  };
  switch (id) {
    case 1: // beanie
      add(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mats.knitHat, 0, 0, 0, 0.13, 0.11, 0.13);
      add(new THREE.TorusGeometry(1, 0.28, 8, 18), mats.knitHat, 0, 0.005, 0, 0.125, 0.125, 0.125, Math.PI / 2);
      add(SPH, mats.knitHat2, 0, 0.12, 0, 0.04, 0.04, 0.04);
      break;
    case 2: // daisy
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        add(SPH_LO, mats.white, Math.cos(a) * 0.05, 0.025, Math.sin(a) * 0.05, 0.035, 0.012, 0.018, 0, 0).rotation.y = -a;
      }
      add(SPH_LO, mats.yolk, 0, 0.03, 0, 0.025, 0.016, 0.025);
      g.position.z = 0.06;
      g.rotation.x = 0.3;
      break;
    case 3: // acorn cap
      add(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.acorn, 0, 0, 0, 0.12, 0.08, 0.12);
      add(CYL, mats.acorn, 0, 0.09, 0, 0.012, 0.05, 0.012);
      break;
    case 4: // top hat
      add(CYL, mats.black, 0, 0.005, 0, 0.16, 0.012, 0.16);
      add(CYL, mats.black, 0, 0.1, 0, 0.1, 0.18, 0.1);
      add(CYL, mats.band, 0, 0.035, 0, 0.102, 0.035, 0.102);
      break;
    case 5: // chef
      add(CYL, mats.white, 0, 0.04, 0, 0.1, 0.08, 0.1);
      for (const [x, z] of [[0, 0], [0.05, 0.04], [-0.05, 0.04], [0.05, -0.04], [-0.05, -0.04]]) add(SPH_LO, mats.white, x, 0.12, z, 0.07, 0.06, 0.07);
      break;
    case 6: // party
      add(new THREE.ConeGeometry(1, 1, 16), mats.party, 0, 0.11, 0, 0.08, 0.22, 0.08);
      add(SPH_LO, mats.yolk, 0, 0.23, 0, 0.025, 0.025, 0.025);
      g.rotation.z = -0.25;
      break;
    case 7: // stetson
      add(CYL, mats.leather, 0, 0.005, 0, 0.2, 0.014, 0.17);
      add(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.leather, 0, 0.0, 0, 0.1, 0.13, 0.09);
      add(CYL, mats.band, 0, 0.03, 0, 0.102, 0.025, 0.092);
      break;
    case 8: // tricorn
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const p = add(BOXG, mats.black, Math.cos(a) * 0.09, 0.04, Math.sin(a) * 0.09, 0.03, 0.08, 0.17);
        p.rotation.y = -a;
      }
      add(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.black, 0, 0.0, 0, 0.1, 0.09, 0.1);
      add(SPH_LO, mats.gold, 0.1, 0.06, 0, 0.018, 0.018, 0.018);
      break;
    case 9: // wizard
      add(CYL, mats.wizard, 0, 0.005, 0, 0.17, 0.012, 0.17);
      add(new THREE.ConeGeometry(1, 1, 16), mats.wizard, 0, 0.16, 0, 0.1, 0.32, 0.1).rotation.z = -0.2;
      for (const [x, y, z] of [[0.05, 0.1, 0.05], [-0.02, 0.18, -0.04], [0.03, 0.06, -0.07]]) add(new THREE.OctahedronGeometry(1, 0), mats.gold, x, y, z, 0.015, 0.015, 0.015);
      break;
    case 10: // crown
      add(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), mats.gold, 0, 0.035, 0, 0.1, 0.07, 0.1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        add(new THREE.ConeGeometry(1, 1, 4), mats.gold, Math.cos(a) * 0.09, 0.095, Math.sin(a) * 0.09, 0.025, 0.06, 0.025);
        add(SPH_LO, i % 2 ? mats.ruby : mats.sapphire, Math.cos(a) * 0.1, 0.035, Math.sin(a) * 0.1, 0.014, 0.014, 0.014);
      }
      break;
  }
  return g;
}

// ---------------------------------------------------------------- the tail: a verlet rope drawn as a tube

const TAIL_N = 13;
const TAIL_SEG = 0.062;
const TAIL_RAD = 6;

function createTail(mat) {
  const verts = TAIL_N * TAIL_RAD;
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const idx = [];
  for (let i = 0; i < TAIL_N - 1; i++) {
    for (let k = 0; k < TAIL_RAD; k++) {
      const a = i * TAIL_RAD + k;
      const b = i * TAIL_RAD + ((k + 1) % TAIL_RAD);
      const c = (i + 1) * TAIL_RAD + k;
      const d = (i + 1) * TAIL_RAD + ((k + 1) % TAIL_RAD);
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(g, mat);
  m.frustumCulled = false;
  m.castShadow = true;
  const p = Array.from({ length: TAIL_N }, () => new THREE.Vector3());
  const q = Array.from({ length: TAIL_N }, () => new THREE.Vector3());
  return { mesh: m, p, q, ready: false };
}

const tv = new THREE.Vector3();
const tn = new THREE.Vector3();
const tb = new THREE.Vector3();
const tUp = new THREE.Vector3(0, 1, 0);

// Step the rope: the root pinned at (rx, ry, rz), pointing back along heading a; idle it curls, moving it trails and wags.
function stepTail(tail, rx, ry, rz, a, speed, t, dt, wag, scale = 1) {
  const { p, q } = tail;
  const SEG = TAIL_SEG * scale;
  const floor = 0.022 * scale + (tail.floorY ?? 0);
  const bx = -Math.cos(a);
  const bz = -Math.sin(a);
  if (!tail.ready) {
    for (let i = 0; i < TAIL_N; i++) {
      p[i].set(rx + bx * SEG * i, Math.max(floor, ry - i * 0.02 * scale), rz + bz * SEG * i);
      q[i].copy(p[i]);
    }
    tail.ready = true;
  }
  const damp = Math.pow(0.0008, dt);
  const sx = -bz;
  const sz = bx;
  for (let i = 1; i < TAIL_N; i++) {
    const v = p[i];
    const o = q[i];
    const vx = (v.x - o.x) * damp;
    const vy = (v.y - o.y) * damp;
    const vz = (v.z - o.z) * damp;
    o.copy(v);
    // Rest shape: back and down, curling to one side when still; a wag that travels down it.
    const u = i / (TAIL_N - 1);
    const curl = (1 - Math.min(1, speed / 1.5)) * 0.9 * u * u;
    const sway = Math.sin(t * (speed > 0.5 ? 10 : 2.6) - i * 0.55) * (speed > 0.5 ? 0.035 : 0.02) * u * wag;
    const restX = rx + bx * SEG * i * (1 - curl * 0.4) + sx * (curl * 0.35 + sway) * scale;
    const restZ = rz + bz * SEG * i * (1 - curl * 0.4) + sz * (curl * 0.35 + sway) * scale;
    const restY = Math.max(floor, ry + (0.05 * Math.sin(u * Math.PI) - u * 0.12) * scale);
    const k = (speed > 0.5 ? 9 : 16) * (1 - u * 0.5);
    v.x += vx + (restX - v.x) * k * dt * dt * 18;
    v.y += vy + (restY - v.y) * k * dt * dt * 18 - 4 * scale * dt * dt;
    v.z += vz + (restZ - v.z) * k * dt * dt * 18;
    if (v.y < floor) v.y = floor;
  }
  p[0].set(rx, ry, rz);
  for (let it = 0; it < 3; it++) {
    for (let i = 1; i < TAIL_N; i++) {
      const a0 = p[i - 1];
      const b0 = p[i];
      tv.subVectors(b0, a0);
      const d = tv.length() || 1e-5;
      const diff = (d - SEG) / d;
      if (i === 1) b0.addScaledVector(tv, -diff);
      else {
        a0.addScaledVector(tv, diff * 0.5);
        b0.addScaledVector(tv, -diff * 0.5);
      }
    }
    p[0].set(rx, ry, rz);
  }
  // The tube.
  const pos = tail.mesh.geometry.attributes.position.array;
  const nor = tail.mesh.geometry.attributes.normal.array;
  for (let i = 0; i < TAIL_N; i++) {
    const prev = p[Math.max(0, i - 1)];
    const next = p[Math.min(TAIL_N - 1, i + 1)];
    tv.subVectors(next, prev).normalize();
    tn.crossVectors(tv, tUp);
    if (tn.lengthSq() < 1e-6) tn.set(1, 0, 0);
    tn.normalize();
    tb.crossVectors(tn, tv).normalize();
    const r = 0.03 * scale * (1 - (i / (TAIL_N - 1)) * 0.78);
    for (let k = 0; k < TAIL_RAD; k++) {
      const ang = (k / TAIL_RAD) * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const nx = tn.x * c + tb.x * s;
      const ny = tn.y * c + tb.y * s;
      const nz = tn.z * c + tb.z * s;
      const o = (i * TAIL_RAD + k) * 3;
      pos[o] = p[i].x + nx * r;
      pos[o + 1] = p[i].y + ny * r;
      pos[o + 2] = p[i].z + nz * r;
      nor[o] = nx;
      nor[o + 1] = ny;
      nor[o + 2] = nz;
    }
  }
  tail.mesh.geometry.attributes.position.needsUpdate = true;
  tail.mesh.geometry.attributes.normal.needsUpdate = true;
}

// ---------------------------------------------------------------- the mouse

let furTex = null;
let knitTex = null;

export function createMouseModel(seat = 0) {
  furTex ??= furTexture();
  knitTex ??= knitTexture();
  const color = SEAT_COLORS[seat % 3];
  const mats = {
    fur: patchEcho(std(FURS[0].color, { map: furTex, roughness: 0.95 }), { rim: 0.5, fill: 1.0, cut: false }),
    belly: patchEcho(std(FURS[0].belly, { map: furTex, roughness: 0.95 }), { rim: 0.4, cut: false }),
    pink: patchEcho(std(0xeaa0ae, { roughness: 0.5 }), { rim: 0.35, cut: false }),
    inner: patchEcho(std(0xf2b4c0, { roughness: 0.6, emissive: 0x3a1018, emissiveIntensity: 0.6 }), { rim: 0.2, cut: false }),
    scarf: patchEcho(std(color, { map: knitTex, roughness: 0.95, emissive: color, emissiveIntensity: 0.28 }), { rim: 0.45, cut: false }),
    lens: new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.08, metalness: 0.5, side: THREE.DoubleSide }),
    frame: std(0x0e0e12, { roughness: 0.35 }),
    gold: std(0xf0bc4c, { roughness: 0.32, metalness: 0.35, emissive: 0x5a3a00 }),
    glint: new THREE.MeshBasicMaterial({ color: PALETTE.cream, toneMapped: false }),
    white: patchEcho(std(0xf6f2ea, { roughness: 0.9, emissive: 0x2a2826 }), { cut: false }),
    black: patchEcho(std(0x17151c, { roughness: 0.6 }), { rim: 0.3, cut: false }),
    band: std(0xb03040, { roughness: 0.6 }),
    yolk: std(0xffd23f, { roughness: 0.6, emissive: 0x403000 }),
    acorn: patchEcho(std(0x7a5430, { roughness: 0.9 }), { cut: false }),
    party: std(0x58b0e0, { roughness: 0.6, emissive: 0x0a2030 }),
    leather: patchEcho(std(0x8a5a34, { roughness: 0.7 }), { cut: false }),
    wizard: std(0x40308a, { roughness: 0.7, emissive: 0x0c0820 }),
    ruby: std(0xe0203a, { roughness: 0.2, emissive: 0x400008 }),
    sapphire: std(0x3050e0, { roughness: 0.2, emissive: 0x081040 }),
    knitHat: std(0xffffff, { map: knitTex, roughness: 0.95, color: 0xd04838 }),
    knitHat2: std(0xf4eee0, { roughness: 0.95 }),
    whisker: new THREE.LineBasicMaterial({ color: PALETTE.cream, transparent: true, opacity: 0.85, toneMapped: false }),
  };
  const root = new THREE.Group();
  const lean = new THREE.Group();
  root.add(lean);
  const body = new THREE.Group();
  lean.add(body);
  const torso = mesh(BODY, mats.fur, 0, 0.19, 0, 1, 0.85, 1);
  body.add(torso);
  body.add(mesh(SPH, mats.belly, 0.0, 0.12, 0, 0.19, 0.09, 0.14, false));
  // Head on a neck pivot: a teardrop with a pointed snout, round cheeks and big cupped ears.
  const head = new THREE.Group();
  head.position.set(0.2, 0.26, 0);
  body.add(head);
  head.add(mesh(HEAD, mats.fur, 0.0, 0, 0, 1, 0.9, 1));
  for (const side of [-1, 1]) head.add(mesh(SPH, mats.fur, 0.05, -0.04, side * 0.07, 0.075, 0.065, 0.065, false));
  const nose = mesh(SPH_LO, mats.pink, 0.215, -0.005, 0, 0.032, 0.028, 0.034, false);
  head.add(nose);
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(-0.03, 0.11, side * 0.095);
    const cup = new THREE.Group();
    cup.rotation.y = -side * 0.6;
    cup.add(mesh(SPH, mats.fur, 0, 0.1, 0, 0.032, 0.125, 0.115));
    cup.add(mesh(SPH, mats.inner, 0.02, 0.1, 0, 0.014, 0.095, 0.085, false));
    ear.add(cup);
    ear.rotation.set(side * 0.35, 0, 0.2);
    head.add(ear);
    ears.push(ear);
  }
  const glassesSlot = new THREE.Group();
  glassesSlot.position.set(0.125, 0.045, 0);
  glassesSlot.rotation.z = 0.45;
  glassesSlot.scale.setScalar(1.1);
  head.add(glassesSlot);
  const hatSlot = new THREE.Group();
  hatSlot.position.set(-0.02, 0.135, 0);
  head.add(hatSlot);
  // Whiskers: three a side, glowing.
  const wpos = [];
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const y = -0.01 + (k - 1) * 0.018;
      wpos.push(0.17, y, side * 0.035, 0.24 + k * 0.02, y + (k - 1) * 0.03, side * (0.2 + k * 0.025));
    }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  const whiskers = new THREE.LineSegments(wg, mats.whisker);
  head.add(whiskers);
  // Paws.
  const feet = [];
  for (const [fx, side] of [[0.15, -1], [0.15, 1], [-0.15, -1], [-0.15, 1]]) {
    const f = mesh(SPH_LO, mats.pink, fx, 0.025, side * 0.1, 0.05, 0.026, 0.038, false);
    body.add(f);
    feet.push({ mesh: f, x: fx, z: side * 0.1, front: fx > 0 });
  }
  // The scarf.
  const scarf = new THREE.Group();
  scarf.position.set(0.14, 0.24, 0);
  scarf.rotation.set(0, 0, 0.6);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.045, 8, 22), mats.scarf);
  loop.rotation.y = Math.PI / 2;
  loop.castShadow = true;
  scarf.add(loop);
  body.add(scarf);
  const scarfEnd = new THREE.Group();
  scarfEnd.position.set(0.06, 0.2, 0.12);
  const end1 = mesh(BOXG, mats.scarf, 0, -0.06, 0, 0.07, 0.13, 0.03);
  scarfEnd.add(end1);
  const end2 = new THREE.Group();
  end2.position.y = -0.12;
  end2.add(mesh(BOXG, mats.scarf, 0, -0.05, 0, 0.065, 0.11, 0.028));
  scarfEnd.add(end2);
  body.add(scarfEnd);
  // Stub and bandage, for after the knife.
  const stub = new THREE.Group();
  stub.position.set(-0.3, 0.12, 0);
  stub.visible = false;
  const stubSeg = mesh(CYL, mats.pink, -0.04, 0, 0, 0.025, 0.08, 0.025, false);
  stubSeg.rotation.z = Math.PI / 2;
  stub.add(stubSeg);
  const band = mesh(CYL, mats.white, -0.08, 0, 0, 0.036, 0.05, 0.036, false);
  band.rotation.z = Math.PI / 2;
  stub.add(band);
  for (const side of [-1, 1]) {
    const bow = mesh(BOXG, mats.white, -0.085, 0.04, side * 0.04, 0.035, 0.06, 0.06, false);
    bow.rotation.x = side * 0.7;
    stub.add(bow);
  }
  body.add(stub);
  // Stars round the head when knocked out.
  const stars = new THREE.Group();
  stars.position.set(0.2, 0.55, 0);
  stars.visible = false;
  for (let i = 0; i < 3; i++) stars.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), mats.glint));
  body.add(stars);
  // The tail (world space) and the one that flies off.
  const tail = createTail(mats.pink);
  const flyer = new THREE.Group();
  flyer.visible = false;
  const fcurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.2, 0.05, 0.08), new THREE.Vector3(-0.45, 0.02, 0.0), new THREE.Vector3(-0.65, 0.06, -0.1)]);
  const fm = new THREE.Mesh(new THREE.TubeGeometry(fcurve, 16, 0.02, 6, false), mats.pink);
  flyer.add(fm);
  // A soft pool of the seat's colour under the mouse, so it's always found, and a contact shadow.
  const halo = decal(glowTexture(), new THREE.Color(color), 1.6, 0.3, true);
  halo.position.y = 0.015;
  const shadow = decal(glowTexture(), new THREE.Color(0x000000), 0.9, 0.55, false);
  shadow.position.y = 0.012;
  const charge = decal(chargeTexture(), new THREE.Color(PALETTE.cream), 2, 0, true);
  charge.visible = false;
  return {
    root,
    lean,
    body,
    torso,
    head,
    ears,
    nose,
    whiskers,
    feet,
    scarf,
    scarfEnd,
    end2,
    glassesSlot,
    hatSlot,
    mats,
    tail,
    stub,
    flyer,
    stars,
    halo,
    shadow,
    charge,
    seat,
    style: -1,
    hat: -1,
    fur: -1,
    glasses: null,
    hatObj: null,
    phase: 0,
    leanA: 0,
    pitch: 0,
    lastA: 0,
    lastSpeed: 0,
    squash: 0,
    squashV: 0,
    hop: 0,
    squeakT: 9,
    squeakBig: false,
    earT: 0,
    earTwitch: 0,
    fly: 0,
    skid: 0,
    dustT: 0,
    hadTail: 1,
    carried: false,
  };
}

export function setLook(model, look) {
  const g = look?.g ?? 0;
  const h = look?.h ?? 0;
  const f = look?.f ?? 0;
  if (model.style !== g) {
    if (model.glasses) model.glassesSlot.remove(model.glasses);
    model.glasses = makeGlasses(g, model.mats);
    model.glassesSlot.add(model.glasses);
    model.style = g;
  }
  if (model.hat !== h) {
    if (model.hatObj) model.hatSlot.remove(model.hatObj);
    model.hatObj = h ? makeHat(h, model.mats) : null;
    if (model.hatObj) model.hatSlot.add(model.hatObj);
    model.hat = h;
  }
  if (model.fur !== f) {
    const fur = FURS[f] ?? FURS[0];
    model.mats.fur.color.setHex(fur.color);
    model.mats.belly.color.setHex(fur.belly);
    model.fur = f;
  }
}

// The view says a squeak happened (a rear-up), or the mouse picked something up (a hop).
export function squeakPose(model, big) {
  model.squeakT = 0;
  model.squeakBig = big;
}

const wp = new THREE.Vector3();

// Pose a mouse from the view model. t: seconds (idle motion), dt: frame step. fx: particles (dust at the feet).
export function poseMouse(model, m, t, dt, reduced = false, fx = null) {
  const show = m.st !== 'watch';
  model.root.visible = show;
  model.tail.mesh.visible = show && m.tail !== 0 && m.st !== 'out';
  model.halo.visible = show && m.st !== 'out';
  model.shadow.visible = show;
  if (!show) {
    model.charge.visible = false;
    return;
  }
  setLook(model, m.look ?? { g: m.g ?? 0 });
  const out = m.st === 'out';
  const speed = out ? 0 : m.speed;
  model.root.position.set(m.x, m.y ?? 0, m.z);
  model.root.rotation.y = -m.a;
  model.tail.floorY = m.y ?? 0;
  // Turning rate (for the lean), with the angle unwrapped.
  let da = m.a - model.lastA;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  model.lastA = m.a;
  const omega = dt > 0 ? da / dt : 0;
  const k = Math.min(1, dt * 10);
  model.leanA += (Math.max(-0.4, Math.min(0.4, -omega * 0.06 * Math.min(1, speed / 2))) - model.leanA) * k;
  // Starts stretch, stops squash and skid: a spring kicked by the change in speed.
  const accel = dt > 0 ? (speed - model.lastSpeed) / dt : 0;
  model.lastSpeed = speed;
  model.squashV += (-model.squash * 260 - model.squashV * 14) * dt + accel * 0.006;
  model.squash = Math.max(-0.22, Math.min(0.22, model.squash + model.squashV * dt));
  if (accel < -18 && speed > 0.4) model.skid = 0.25;
  model.skid = Math.max(0, model.skid - dt);
  const pitchTarget = (accel > 8 ? 0.12 : accel < -8 ? -0.2 : 0) + (m.charge > 0 ? 0.12 * m.charge : 0);
  model.pitch += (pitchTarget - model.pitch) * Math.min(1, dt * 8);
  // Gait. Tiptoeing: low and long, slow high steps, ears flat (a cartoon sneak).
  const moving = speed > 0.15;
  model.tip = (model.tip ?? 0) + ((m.tiptoe ?? 0) - (model.tip ?? 0)) * Math.min(1, dt * 8);
  const tip = out ? 0 : model.tip;
  model.phase += dt * (moving ? (6 + speed * 5.5) * (1 - tip * 0.45) : 0);
  const stride = Math.min(1, speed / 2.6) + tip * 0.6;
  for (let i = 0; i < 4; i++) {
    const f = model.feet[i];
    const ph = model.phase + (i === 0 || i === 3 ? 0 : Math.PI);
    const sw = Math.sin(ph);
    const lift = Math.max(0, Math.cos(ph));
    f.mesh.position.set(f.x + (moving && !reduced ? sw * 0.07 * stride : 0), 0.025 + (moving && !reduced ? lift * (0.05 + tip * 0.05) * stride : 0), f.z);
  }
  const bob = moving && !reduced ? Math.abs(Math.sin(model.phase)) * 0.025 * (0.4 + stride) * (1 - tip * 0.6) : 0;
  // Squeak: rear up (small) or burst from a crouch (big).
  model.squeakT += dt;
  const sq = model.squeakT < 0.45 ? Math.sin((model.squeakT / 0.45) * Math.PI) : 0;
  const rear = sq * (model.squeakBig ? 0.55 : 0.35);
  model.hop = Math.max(0, model.hop - dt * 3.2);
  const hop = Math.sin(model.hop * Math.PI) * 0.16;
  const crouch = m.charge > 0 ? m.charge * 0.06 : 0;
  const shiver = m.charge >= 1 && !reduced ? Math.sin(t * 70) * 0.01 : 0;
  model.body.position.set(0, bob + hop - crouch + shiver - tip * 0.045, 0);
  const sqs = reduced ? 0 : model.squash;
  model.body.scale.set(1 + sqs + tip * 0.08, 1 - sqs * 0.9 - tip * 0.12, 1 - sqs * 0.3);
  model.lean.rotation.x = reduced ? 0 : model.leanA;
  model.body.rotation.z = -rear + (reduced ? 0 : -model.pitch * 0.6) + (moving ? -0.05 : 0);
  // Head: sniffing when still, forward when running, up when squeaking.
  const sniff = !moving && !reduced ? Math.sin(t * 13) * 0.025 * (0.5 + 0.5 * Math.sin(t * 0.7)) : 0;
  model.head.rotation.z = (moving ? -0.12 : Math.sin(t * 1.3 + model.seat) * 0.08) + rear * 0.7 + sniff - tip * 0.12;
  model.head.rotation.y = moving || reduced ? 0 : Math.sin(t * 0.8 + model.seat * 2) * 0.35;
  const ns = 1 + (sniff ? Math.abs(Math.sin(t * 26)) * 0.18 : 0);
  model.nose.scale.set(0.032 * ns, 0.028 * ns, 0.034 * ns);
  // Ears: back when running, twitch now and then.
  model.earT -= dt;
  if (model.earT <= 0) {
    model.earT = 1.2 + ((t * 7.3) % 2.5);
    model.earTwitch = 1;
  }
  model.earTwitch = Math.max(0, model.earTwitch - dt * 6);
  model.ears.forEach((e, i) => {
    const side = i ? 1 : -1;
    e.rotation.z = 0.2 + (moving ? 0.5 * Math.min(1, stride) : 0) + (i === 0 ? model.earTwitch * 0.35 : 0) - rear * 0.25 + tip * 0.45;
    e.rotation.x = side * (0.35 + (moving ? 0.15 * stride : 0));
  });
  model.whiskers.rotation.y = !reduced ? Math.sin(t * 9) * 0.06 : 0;
  // Scarf end swings behind.
  model.scarfEnd.rotation.z = Math.min(1.1, speed * 0.35) + (reduced ? 0 : Math.sin(t * 7) * 0.08 * (0.3 + stride));
  model.end2.rotation.z = Math.min(0.6, speed * 0.2) + (reduced ? 0 : Math.sin(t * 7 - 1) * 0.12 * (0.3 + stride));
  // Knocked out: on its side, stars circling.
  model.stars.visible = out || m.stun > 0;
  if (model.stars.visible) {
    model.stars.children.forEach((s, i) => {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      s.position.set(Math.cos(a) * 0.18, Math.sin(t * 6 + i) * 0.02, Math.sin(a) * 0.18);
      s.rotation.y = t * 3;
    });
  }
  if (out) model.lean.rotation.x = 1.35;
  else if (m.stun > 0 && !reduced) model.body.rotation.x = Math.sin(t * 30) * 0.15;
  else model.body.rotation.x = 0;
  // Tail.
  const tailOn = m.tail !== 0;
  model.stub.visible = !tailOn;
  if (tailOn && !out) {
    model.torso.updateWorldMatrix(true, false);
    wp.set(-0.29, 0.13, 0);
    model.body.localToWorld(wp);
    stepTail(model.tail, wp.x, wp.y, wp.z, m.a, speed, t + model.seat, Math.min(dt, 1 / 30), reduced ? 0.3 : 1, model.root.scale.x);
  } else model.tail.ready = false;
  if (model.fly > 0) {
    model.fly = Math.max(0, model.fly - dt);
    const u = 1 - model.fly;
    model.flyer.visible = true;
    model.flyer.position.set(model.flyX + model.flyVX * u, 0.2 + u * 2.6 - u * u * 2.9, model.flyZ + model.flyVZ * u);
    model.flyer.rotation.set(u * 9, u * 5, u * 13);
  } else model.flyer.visible = false;
  // Dust from the feet: at a skid, and now and then while running.
  if (fx && !reduced) {
    model.dustT -= dt;
    if ((model.skid > 0 || (speed > 2.2 && model.dustT <= 0)) && m.st === 'play') {
      model.dustT = 0.09;
      fx.dust(m.x - Math.cos(m.a) * 0.18, m.z - Math.sin(m.a) * 0.18, model.skid > 0 ? 3 : 1, m.a);
    }
  }
  // Charge preview.
  model.charge.visible = m.charge > 0.01;
  if (model.charge.visible) {
    const r = 0.6 + m.charge * 12.4;
    model.charge.position.set(m.x, 0.05, m.z);
    model.charge.scale.setScalar(r);
    model.charge.material.opacity = m.charge >= 1 ? 0.95 : 0.3 + m.charge * 0.35;
    model.charge.rotation.y = t * 0.6;
  }
  model.halo.position.set(m.x, 0.015, m.z);
  model.halo.material.opacity = (m.me ? 0.2 : 0.15) * (m.away ? 0.35 : 1);
  model.shadow.position.set(m.x, 0.012, m.z);
  model.shadow.scale.set(1, 1, 0.75);
  model.shadow.rotation.y = -m.a;
  const ghost = !!m.away;
  if (model.mats.fur.transparent !== ghost) {
    model.mats.fur.transparent = ghost;
    model.mats.fur.needsUpdate = true;
  }
  model.mats.fur.opacity = ghost ? 0.4 : 1;
}

export function popTail(model, m) {
  model.fly = 1;
  model.flyX = m.x - Math.cos(m.a) * 0.3;
  model.flyZ = m.z - Math.sin(m.a) * 0.3;
  const a = m.a + Math.PI + 0.6;
  model.flyVX = Math.cos(a) * 1.8;
  model.flyVZ = Math.sin(a) * 1.8;
  model.tail.ready = false;
}

// ---------------------------------------------------------------- shared little textures

function decal(tex, color, size, opacity = 1, additive = false) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !additive });
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 3;
  return m;
}
export { decal };

let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

let chargeTex = null;
function chargeTexture() {
  if (chargeTex) return chargeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineWidth = 5;
  g.setLineDash([14, 10]);
  g.beginPath();
  g.arc(128, 128, 122, 0, Math.PI * 2);
  g.stroke();
  chargeTex = new THREE.CanvasTexture(c);
  return chargeTex;
}

// Everything of a mouse that goes in the scene: the body, the tail (in world space), the flying tail, the pools under it.
export function addMouse(group, model) {
  group.add(model.root, model.tail.mesh, model.flyer, model.charge, model.halo, model.shadow);
}
