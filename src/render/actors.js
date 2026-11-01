// Everyone who moves: the three mice in their sunglasses and scarves, the farmer's wife from the knees down with her lantern
// and knife, the farmer's boots and torch, Butter the cat, the cheese and the traps. Built once per night, posed each frame
// from the view model, with no allocations in the frame.

import * as THREE from 'three';
import { patchEcho, SEAT_COLORS, PALETTE } from './echo.js';
import { stockingTexture, apronTexture, cheeseTexture, knifeTexture, bootTexture } from './textures.js';
import { HUNTER, lanternOf } from '../core/hunters.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const echoed = (m, o) => patchEcho(m, o);
const UP = new THREE.Vector3(0, 1, 0);

const SPH = new THREE.SphereGeometry(1, 18, 12);
const SPH_LO = new THREE.SphereGeometry(1, 10, 7);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const SHIN = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
const BOXG = new THREE.BoxGeometry(1, 1, 1);

function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = shadow;
  return m;
}

function decal(tex, color, size, opacity = 1, additive = false) {
  const mat = new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !additive });
  const g = new THREE.PlaneGeometry(size, size);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.renderOrder = 3;
  return m;
}

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

let ringTex = null;
function ringTexture() {
  if (ringTex) return ringTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineWidth = 5;
  g.setLineDash([14, 10]);
  g.beginPath();
  g.arc(128, 128, 122, 0, Math.PI * 2);
  g.stroke();
  ringTex = new THREE.CanvasTexture(c);
  return ringTex;
}

let poolTex = null;
function poolTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 60, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.82, 'rgba(255,255,255,0.10)');
  grad.addColorStop(0.95, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  poolTex = new THREE.CanvasTexture(c);
  return poolTex;
}

// ---------------------------------------------------------------- glasses: seven styles, unlocked by stars

export const GLASSES = [
  { name: 'Round', stars: 0 },
  { name: 'Cat-eye', stars: 6 },
  { name: 'Aviators', stars: 12 },
  { name: 'Stars', stars: 18 },
  { name: 'Monocle', stars: 24 },
  { name: 'Hearts', stars: 30 },
  { name: 'Gold Rounds', stars: 36 },
];

function lensShape(style) {
  const s = new THREE.Shape();
  if (style === 3) {
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.032 : 0.075;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
  } else if (style === 5) {
    s.moveTo(0, -0.06);
    s.bezierCurveTo(-0.09, 0.0, -0.07, 0.08, 0, 0.035);
    s.bezierCurveTo(0.07, 0.08, 0.09, 0.0, 0, -0.06);
  } else if (style === 1) {
    s.moveTo(-0.07, -0.03);
    s.quadraticCurveTo(-0.08, 0.05, 0.0, 0.045);
    s.quadraticCurveTo(0.08, 0.06, 0.085, 0.02);
    s.quadraticCurveTo(0.04, -0.07, -0.07, -0.03);
  } else if (style === 2) {
    s.moveTo(-0.07, 0.04);
    s.lineTo(0.07, 0.04);
    s.quadraticCurveTo(0.07, -0.08, 0.0, -0.075);
    s.quadraticCurveTo(-0.075, -0.07, -0.07, 0.04);
  } else s.absarc(0, 0, 0.062, 0, Math.PI * 2, false);
  return s;
}

const lensGeos = new Map();
function lensGeo(style) {
  if (!lensGeos.has(style)) {
    const g = new THREE.ShapeGeometry(lensShape(style), 12);
    lensGeos.set(style, g);
  }
  return lensGeos.get(style);
}

function makeGlasses(style, mats) {
  const g = new THREE.Group();
  const rim = style === 6 || style === 4 ? mats.gold : mats.frame;
  const sides = style === 4 ? [-1] : [-1, 1];
  for (const side of sides) {
    const lens = new THREE.Mesh(lensGeo(style), mats.lens);
    lens.position.set(0, 0, side * 0.068);
    lens.rotation.y = Math.PI / 2;
    g.add(lens);
    const rimG = new THREE.Mesh(new THREE.TorusGeometry(style === 4 ? 0.07 : 0.064, 0.011, 5, 16), rim);
    rimG.position.copy(lens.position);
    rimG.position.x -= 0.002;
    rimG.rotation.y = Math.PI / 2;
    if (style === 0 || style === 4 || style === 6) g.add(rimG);
    const glint = new THREE.Mesh(SPH_LO, mats.glint);
    glint.scale.setScalar(0.014);
    glint.position.set(0.006, 0.025, side * 0.068 + 0.022);
    g.add(glint);
  }
  if (style !== 4) {
    const bridge = new THREE.Mesh(BOXG, rim);
    bridge.scale.set(0.012, 0.012, 0.05);
    bridge.position.set(0, 0.018, 0);
    g.add(bridge);
  } else {
    const chain = new THREE.Mesh(BOXG, mats.gold);
    chain.scale.set(0.006, 0.12, 0.006);
    chain.position.set(-0.02, -0.08, -0.07);
    g.add(chain);
  }
  return g;
}

// ---------------------------------------------------------------- the mouse

const MOUSE_SCALE = 1.3;

export function createMouseModel(seat = 0) {
  const color = SEAT_COLORS[seat % 3];
  const mats = {
    fur: echoed(std(0x7a7079, { roughness: 0.95 }), { rim: 0.6, fill: 1.4 }),
    belly: echoed(std(0x8c7f86, { roughness: 0.95 }), { rim: 0.4 }),
    pink: echoed(std(0xe59aa8, { roughness: 0.7 }), { rim: 0.3 }),
    scarf: echoed(std(color, { roughness: 0.95, emissive: color, emissiveIntensity: 0.35 }), { rim: 0.4 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x07070b, roughness: 0.15, metalness: 0.4, side: THREE.DoubleSide }),
    frame: std(0x111114, { roughness: 0.4 }),
    gold: std(0xd9a441, { roughness: 0.3, metalness: 0.9, emissive: 0x3a2200 }),
    glint: new THREE.MeshBasicMaterial({ color: PALETTE.cream, toneMapped: false }),
    white: echoed(std(0xf4efe4, { roughness: 0.9, emissive: 0x444038 })),
  };
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(MOUSE_SCALE);
  root.add(body);
  body.add(mesh(SPH, mats.fur, 0, 0.2, 0, 0.27, 0.2, 0.2));
  body.add(mesh(SPH, mats.belly, 0.06, 0.13, 0, 0.2, 0.12, 0.16, false));
  const head = new THREE.Group();
  head.position.set(0.25, 0.27, 0);
  body.add(head);
  head.add(mesh(SPH, mats.fur, 0, 0, 0, 0.16, 0.145, 0.145));
  head.add(mesh(SPH, mats.fur, 0.13, -0.03, 0, 0.1, 0.075, 0.08));
  head.add(mesh(SPH_LO, mats.pink, 0.225, -0.025, 0, 0.032, 0.03, 0.032, false));
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(-0.03, 0.13, side * 0.12);
    ear.rotation.set(side * -0.35, 0, side * 0.1);
    ear.add(mesh(CYL, mats.fur, 0, 0, 0, 0.11, 0.025, 0.11));
    const inner = mesh(CYL, mats.pink, 0.006, 0.0, 0, 0.075, 0.03, 0.075, false);
    ear.add(inner);
    ear.rotation.z += Math.PI / 2 - 0.25;
    head.add(ear);
  }
  const glassesSlot = new THREE.Group();
  glassesSlot.position.set(0.115, 0.035, 0);
  head.add(glassesSlot);
  // The scarf: a knitted loop and one hanging end, in the seat's colour.
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 6, 16), mats.scarf);
  scarf.position.set(0.17, 0.24, 0);
  scarf.rotation.set(0, Math.PI / 2, 0.5);
  scarf.castShadow = true;
  body.add(scarf);
  const scarfEnd = mesh(BOXG, mats.scarf, 0.08, 0.2, 0.12, 0.06, 0.14, 0.03);
  scarfEnd.rotation.z = 0.5;
  body.add(scarfEnd);
  // The tail: a chain of joints that sway; or a stub with a bandage.
  const tail = new THREE.Group();
  tail.position.set(-0.24, 0.13, 0);
  body.add(tail);
  const joints = [];
  let parent = tail;
  const SEG = 6;
  for (let i = 0; i < SEG; i++) {
    const j = new THREE.Group();
    j.position.x = i === 0 ? 0 : -0.085;
    const seg = mesh(CYL, mats.pink, -0.042, 0, 0, 0.018 - i * 0.002, 0.09, 0.018 - i * 0.002, false);
    seg.rotation.z = Math.PI / 2;
    j.add(seg);
    parent.add(j);
    joints.push(j);
    parent = j;
  }
  const stub = new THREE.Group();
  stub.position.copy(tail.position);
  stub.visible = false;
  body.add(stub);
  const stubSeg = mesh(CYL, mats.pink, -0.04, 0, 0, 0.02, 0.08, 0.02, false);
  stubSeg.rotation.z = Math.PI / 2;
  stub.add(stubSeg);
  const band = mesh(CYL, mats.white, -0.075, 0, 0, 0.03, 0.04, 0.03, false);
  band.rotation.z = Math.PI / 2;
  stub.add(band);
  for (const side of [-1, 1]) {
    const bow = mesh(BOXG, mats.white, -0.08, 0.035, side * 0.035, 0.03, 0.05, 0.05, false);
    bow.rotation.x = side * 0.7;
    stub.add(bow);
  }
  // The tail that flies off.
  const flyer = new THREE.Group();
  flyer.visible = false;
  const fseg = mesh(CYL, mats.pink, -0.25, 0, 0, 0.016, 0.5, 0.016, false);
  fseg.rotation.z = Math.PI / 2;
  flyer.add(fseg);
  // Stars round the head when knocked out.
  const stars = new THREE.Group();
  stars.position.set(0.2, 0.5, 0);
  stars.visible = false;
  for (let i = 0; i < 3; i++) {
    const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), mats.glint);
    stars.add(st);
  }
  body.add(stars);
  // The squeak charge: a dashed ring the size of the big squeak.
  const charge = decal(ringTexture(), new THREE.Color(PALETTE.cream), 2, 0.0, true);
  charge.visible = false;
  // A soft pool of the seat's colour under the mouse, so it's always found.
  const halo = decal(glowTexture(), new THREE.Color(color), 1.8, 0.35, true);
  halo.position.y = 0.02;
  return { root, body, head, glassesSlot, mats, joints, tail, stub, flyer, stars, charge, halo, seat, style: -1, glasses: null, fly: 0, squash: 0, lastSpeed: 0, hop: 0 };
}

export function setGlasses(model, style) {
  if (model.style === style) return;
  if (model.glasses) model.glassesSlot.remove(model.glasses);
  model.glasses = makeGlasses(style, model.mats);
  model.glassesSlot.add(model.glasses);
  model.style = style;
}

// Pose a mouse from the view model. t: seconds (for idle motion), dt: frame step.
export function poseMouse(model, m, t, dt, reduced = false) {
  model.root.visible = m.st !== 'watch';
  if (!model.root.visible) return;
  setGlasses(model, m.g ?? 0);
  model.root.position.set(m.x, 0, m.z);
  model.root.rotation.y = -m.a;
  const moving = m.speed > 0.3;
  // Squash on start and stop, a scurry bob while moving.
  if ((m.speed > 0.6) !== (model.lastSpeed > 0.6)) model.squash = 1;
  model.lastSpeed = m.speed;
  model.squash = Math.max(0, model.squash - dt * 5);
  const sq = reduced ? 0 : model.squash * 0.12;
  const bob = moving && !reduced ? Math.abs(Math.sin(t * 22)) * 0.035 : 0;
  model.hop = Math.max(0, model.hop - dt * 3);
  const hop = Math.sin(model.hop * Math.PI) * 0.18;
  model.body.position.y = bob + hop;
  model.body.scale.set(MOUSE_SCALE * (1 + sq), MOUSE_SCALE * (1 - sq), MOUSE_SCALE * (1 + sq * 0.5));
  model.head.rotation.z = moving ? -0.08 : Math.sin(t * 1.7 + model.seat) * 0.06;
  model.head.rotation.y = moving ? 0 : Math.sin(t * 0.9 + model.seat * 2) * 0.25;
  // Tail sway (or the stub).
  const tailOn = m.tail !== 0;
  model.tail.visible = tailOn;
  model.stub.visible = !tailOn;
  if (tailOn) {
    for (let i = 0; i < model.joints.length; i++) {
      const j = model.joints[i];
      j.rotation.y = Math.sin(t * (moving ? 9 : 2.4) - i * 0.7 + model.seat) * (moving ? 0.28 : 0.18);
      j.rotation.z = i === 0 ? 0.35 : -0.05;
    }
  }
  // Knocked out: lying on its side, stars circling.
  const out = m.st === 'out';
  model.stars.visible = out || m.stun > 0;
  if (model.stars.visible) {
    model.stars.children.forEach((s, i) => {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      s.position.set(Math.cos(a) * 0.16, Math.sin(t * 6 + i) * 0.02, Math.sin(a) * 0.16);
      s.rotation.y = t * 3;
    });
  }
  model.body.rotation.x = out ? 1.3 : m.stun > 0 ? Math.sin(t * 30) * 0.15 : 0;
  // The tail flying off.
  if (model.fly > 0) {
    model.fly = Math.max(0, model.fly - dt);
    const u = 1 - model.fly;
    model.flyer.visible = true;
    model.flyer.position.set(model.flyX + model.flyVX * u, 0.2 + u * 2.2 - u * u * 2.6, model.flyZ + model.flyVZ * u);
    model.flyer.rotation.set(u * 9, u * 5, u * 13);
  } else model.flyer.visible = false;
  // Charge preview.
  model.charge.visible = m.charge > 0.01;
  if (model.charge.visible) {
    const r = 0.6 + m.charge * 12.4;
    model.charge.position.set(m.x, 0.05, m.z);
    model.charge.scale.setScalar(r);
    model.charge.material.opacity = m.charge >= 1 ? 0.9 : 0.35 + m.charge * 0.3;
    model.charge.rotation.y = t * 0.6;
  }
  model.halo.position.set(m.x, 0.02, m.z);
  model.halo.material.opacity = (m.me ? 0.42 : 0.3) * (m.away ? 0.35 : 1);
  const ghost = m.away;
  model.mats.fur.transparent = ghost;
  model.mats.fur.opacity = ghost ? 0.4 : 1;
}

export function popTail(model, m) {
  model.fly = 1;
  model.flyX = m.x;
  model.flyZ = m.z;
  const a = m.a + Math.PI + 0.6;
  model.flyVX = Math.cos(a) * 1.6;
  model.flyVZ = Math.sin(a) * 1.6;
}

// ---------------------------------------------------------------- the farmer's wife (and the farmer)

function knifeGeometry() {
  const s = new THREE.Shape();
  // The heel at y = 0 (the handle meets it), the point at y = 2.6.
  s.moveTo(-0.08, 0);
  s.lineTo(0.32, 0);
  s.quadraticCurveTo(0.42, 1.7, 0, 2.6);
  s.quadraticCurveTo(-0.12, 1.4, -0.08, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 1 });
  g.translate(-0.12, 0, -0.02);
  return g;
}

export function createHuman(kind) {
  const farmer = kind === 'farmer';
  const mats = {
    slipper: echoed(std(farmer ? 0x3b2a1e : 0x7a2f33, { roughness: 1 }), { rim: 0.25 }),
    sole: echoed(std(0x2a1d16, { roughness: 1 })),
    leg: echoed(std(0xffffff, { roughness: 0.9, map: farmer ? null : stockingTexture(), color: farmer ? 0x4d4234 : 0xffffff }), { rim: 0.2 }),
    skirt: echoed(new THREE.MeshStandardMaterial({ color: farmer ? 0x3c4a5c : 0xffffff, map: farmer ? null : apronTexture(), roughness: 0.95, transparent: true, side: THREE.DoubleSide }), { rim: 0.15 }),
    brass: std(0xc08a2e, { roughness: 0.35, metalness: 0.85 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false }),
    glass: new THREE.MeshStandardMaterial({ color: 0xffb060, emissive: 0xff8a2a, emissiveIntensity: 2.2, transparent: true, opacity: 0.85, roughness: 0.2 }),
    steel: std(0xd9dee6, { roughness: 0.22, metalness: 0.45, emissive: 0x30343c }),
    handle: std(0x4a2c18, { roughness: 0.8 }),
  };
  // Seen from above she's a giant: shins and skirt fade out going up, so nothing cut off shows and the room stays in view.
  const fade = (solid, clear) => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#000');
    grad.addColorStop(clear, '#000');
    grad.addColorStop(solid, '#fff');
    grad.addColorStop(1, '#fff');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 64);
    return new THREE.CanvasTexture(c);
  };
  mats.shin = mats.leg.clone();
  mats.shin.onBeforeCompile = mats.leg.onBeforeCompile;
  mats.shin.userData = mats.leg.userData;
  mats.shin.transparent = true;
  mats.shin.alphaMap = fade(0.62, 0.22);
  const root = new THREE.Group();
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(0, 0, side * 0.55);
    const slipper = new THREE.Group();
    slipper.add(mesh(SPH, mats.slipper, 0.3, 0.28, 0, farmer ? 0.95 : 0.85, farmer ? 0.38 : 0.3, farmer ? 0.42 : 0.36));
    slipper.add(mesh(BOXG, mats.sole, 0.25, 0.05, 0, farmer ? 1.8 : 1.6, 0.1, farmer ? 0.8 : 0.66));
    if (!farmer) slipper.add(mesh(SPH_LO, mats.leg, 0.95, 0.42, 0, 0.16, 0.12, 0.16, false));
    leg.add(slipper);
    const shin = mesh(SHIN, mats.shin, -0.05, 2.0, 0, farmer ? 0.42 : 0.3, 3.4, farmer ? 0.42 : 0.3);
    leg.add(shin);
    root.add(leg);
    legs.push(leg);
  }
  // The skirt (or the farmer's coat), fading out above her knees.
  mats.skirt.alphaMap = fade(0.72, 0.18);
  mats.skirt.depthWrite = false;
  const skirtGeo = new THREE.CylinderGeometry(1.25, 1.75, 2.4, 22, 1, true);
  const skirt = mesh(skirtGeo, mats.skirt, -0.05, 4.0, 0, 1, 1, 1, false);
  root.add(skirt);
  // The lantern (or the torch), low in her hand.
  const hand = new THREE.Group();
  hand.position.set(0.9, 2.0, 0.95);
  root.add(hand);
  const lamp = new THREE.Group();
  hand.add(lamp);
  if (!farmer) {
    lamp.add(mesh(BOXG, mats.brass, 0, -0.55, 0, 0.42, 0.06, 0.42));
    lamp.add(mesh(BOXG, mats.brass, 0, 0.0, 0, 0.36, 0.05, 0.36));
    lamp.add(mesh(CYL, mats.glass, 0, -0.27, 0, 0.17, 0.5, 0.17, false));
    lamp.add(mesh(SPH_LO, mats.flame, 0, -0.3, 0, 0.06, 0.12, 0.06, false));
    lamp.add(mesh(CYL, mats.brass, 0, 0.12, 0, 0.12, 0.2, 0.12));
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 5, 12, Math.PI), mats.brass);
    handle.position.y = 0.2;
    lamp.add(handle);
    lamp.position.y = -0.2;
  } else {
    lamp.add(mesh(CYL, mats.steel, 0, 0, 0, 0.1, 0.6, 0.1));
    const lens = mesh(CYL, mats.flame, 0, 0, 0, 0.11, 0.02, 0.11, false);
    lens.position.set(0, 0.3, 0);
    lamp.add(lens);
    lamp.rotation.z = -Math.PI / 2;
  }
  // The light itself.
  const light = new THREE.SpotLight(farmer ? 0xfff2c8 : PALETTE.lantern, farmer ? 90 : 55, farmer ? 14 : 9, farmer ? HUNTER.farmer.half * 1.05 : 1.15, farmer ? 0.25 : 0.65, 1.6);
  light.castShadow = false;
  light.shadow.bias = -0.0006;
  light.shadow.normalBias = 0.03;
  light.shadow.radius = 4;
  const target = new THREE.Object3D();
  light.target = target;
  // A soft ring on the floor marking exactly where the light sees.
  const pool = decal(poolTexture(), new THREE.Color(farmer ? 0xfff0c0 : PALETTE.lantern), HUNTER.wife.pool * 2, 0.55, true);
  pool.position.y = 0.03;
  pool.visible = !farmer;
  // The torch's beam: a long flat wedge of light on the floor.
  let beam = null;
  if (farmer) {
    const c = HUNTER.farmer;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(Math.cos(c.half) * c.cone, Math.sin(c.half) * c.cone);
    shape.absarc(0, 0, c.cone, c.half, -c.half, true);
    shape.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(shape, 12);
    g.rotateX(Math.PI / 2);
    beam = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.09, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 0.04;
    beam.renderOrder = 3;
  }
  // The knife (or the boot) and its shadow on the floor.
  const knife = new THREE.Group();
  const blade = new THREE.Mesh(farmer ? new THREE.BoxGeometry(1.8, 0.6, 0.8) : knifeGeometry(), farmer ? mats.slipper : mats.steel);
  blade.castShadow = true;
  knife.add(blade);
  if (!farmer) {
    const handle = mesh(BOXG, mats.handle, 0.0, -0.45, 0, 0.18, 0.9, 0.12);
    knife.add(handle);
  }
  knife.visible = false;
  const shadowTex = farmer ? bootTexture(false) : knifeTexture(false);
  const outlineTex = farmer ? bootTexture(true) : knifeTexture(true);
  const strikeShadow = decal(shadowTex, new THREE.Color(0x000000), 1, 0.0);
  const strikeLine = decal(outlineTex, new THREE.Color(PALETTE.knife), 1, 0.0, true);
  strikeShadow.visible = strikeLine.visible = false;
  return { kind, farmer, root, legs, skirt, hand, lamp, light, target, pool, beam, knife, blade, strikeShadow, strikeLine, mats, walk: 0, stuck: 0, lastSeq: -1, lift: 0, hm: 0 };
}

// Pose a human hunter. h: { x, z, a, m, ch, t, until }. now: match seconds.
export function poseHuman(model, h, now, dt, reduced = false) {
  const c = HUNTER[model.kind];
  model.root.position.set(h.x, 0, h.z);
  model.root.rotation.y = -h.a;
  const moving = ['patrol', 'go', 'chase', 'search'].includes(h.m);
  if (moving) model.walk += dt * (h.m === 'chase' ? 7.5 : 5.2);
  const sw = moving ? Math.sin(model.walk) : 0;
  model.legs[0].position.x = sw * 0.55;
  model.legs[1].position.x = -sw * 0.55;
  model.legs[0].position.y = Math.max(0, Math.cos(model.walk)) * 0.15 * (moving ? 1 : 0);
  model.legs[1].position.y = Math.max(0, -Math.cos(model.walk)) * 0.15 * (moving ? 1 : 0);
  model.skirt.rotation.y = sw * 0.05;
  // The lantern swings; lifted high when she hears something.
  const lifted = h.m === 'hear' || h.m === 'spot' || h.m === 'look';
  model.lift += ((lifted ? 1 : 0) - model.lift) * Math.min(1, dt * 6);
  model.hand.position.y = 2.0 + model.lift * 0.9;
  model.lamp.rotation.x = reduced ? 0 : Math.sin(model.walk * 0.5) * 0.18;
  model.lamp.rotation.z = (model.farmer ? -Math.PI / 2 : 0) + (reduced ? 0 : Math.cos(model.walk * 0.5) * 0.08);
  // The light: her pool is exactly where the rules say; his beam points where he faces.
  model.lamp.getWorldPosition(model.light.position);
  if (model.farmer) {
    model.target.position.set(h.x + Math.cos(h.a) * 6, 0, h.z + Math.sin(h.a) * 6);
    if (model.beam) {
      model.beam.position.set(h.x, 0.04, h.z);
      model.beam.rotation.y = -h.a;
    }
  } else {
    const [lx, lz] = lanternOf(h);
    model.target.position.set(lx, 0, lz);
    model.pool.position.set(lx, 0.03, lz);
    model.pool.visible = h.m !== 'wait';
  }
  model.target.updateMatrixWorld();
  const flicker = reduced ? 1 : 0.92 + Math.sin(now * 23) * 0.04 + Math.sin(now * 37) * 0.04;
  model.light.intensity = (model.farmer ? 90 : 55) * flicker * (h.m === 'wait' ? 0 : 1);
  // The strike: the shadow darkens and sharpens through the telegraph, then the blade lands and sticks.
  const ch = h.ch;
  const raising = h.m === 'raise' && ch && now < ch.at;
  const landed = ch && now >= ch.at && now < ch.at + c.recover + 0.2;
  model.strikeShadow.visible = model.strikeLine.visible = !!raising;
  model.knife.visible = !!(raising || landed);
  if (ch && (raising || landed)) {
    const u = raising ? Math.max(0, Math.min(1, 1 - (ch.at - now) / c.tele)) : 1;
    const size = model.farmer ? 2.4 : 2.0;
    const blur = 1.6 - 0.6 * u;
    model.strikeShadow.position.set(ch.x, 0.035, ch.z);
    model.strikeShadow.scale.setScalar(size * blur);
    model.strikeShadow.rotation.y = -h.a + Math.PI / 2;
    model.strikeShadow.material.opacity = 0.2 + 0.6 * u;
    model.strikeLine.position.set(ch.x, 0.04, ch.z);
    model.strikeLine.scale.setScalar(size);
    model.strikeLine.rotation.y = -h.a + Math.PI / 2;
    model.strikeLine.material.opacity = 0.5 + 0.5 * Math.abs(Math.sin(now * 14));
    if (raising) {
      model.knife.position.set(ch.x, 9 - u * 2.5, ch.z);
      model.knife.rotation.set(Math.PI, -h.a + Math.PI / 2, 0);
      model.knife.scale.setScalar(model.farmer ? 1 : 1.25);
    } else {
      const since = now - ch.at;
      const wob = reduced ? 0 : Math.sin(since * 40) * Math.exp(-since * 5) * 0.25;
      model.knife.position.set(ch.x, model.farmer ? 0.3 : 1.9, ch.z);
      model.knife.rotation.set(Math.PI + wob, -h.a + Math.PI / 2, 0.15);
    }
  }
}

// ---------------------------------------------------------------- Butter the cat

export function createCat() {
  const mats = {
    fur: echoed(std(0xc8742a, { roughness: 0.95 }), { rim: 0.35 }),
    pale: echoed(std(0xf0c890, { roughness: 0.95 }), { rim: 0.2 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xd8ff5a, toneMapped: false }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x050505 }),
  };
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const torso = mesh(SPH, mats.fur, 0, 0.42, 0, 0.62, 0.36, 0.34);
  body.add(torso);
  body.add(mesh(SPH, mats.pale, 0.15, 0.3, 0, 0.4, 0.22, 0.26, false));
  const head = new THREE.Group();
  head.position.set(0.62, 0.62, 0);
  body.add(head);
  head.add(mesh(SPH, mats.fur, 0, 0, 0, 0.27, 0.24, 0.27));
  head.add(mesh(SPH, mats.pale, 0.16, -0.07, 0, 0.13, 0.1, 0.15, false));
  const eyes = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), mats.fur);
    ear.position.set(-0.02, 0.24, side * 0.15);
    ear.rotation.set(side * -0.3, 0, 0);
    head.add(ear);
    const eye = mesh(SPH_LO, mats.eye, 0.21, 0.05, side * 0.11, 0.055, 0.06, 0.055, false);
    eye.add(mesh(SPH_LO, mats.pupil, 0.4, 0, 0, 0.5, 0.95, 0.25, false));
    head.add(eye);
    eyes.push(eye);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.58, 0.5, 0);
  body.add(tail);
  const tailSegs = [];
  let parent = tail;
  for (let i = 0; i < 4; i++) {
    const j = new THREE.Group();
    j.position.x = i === 0 ? 0 : -0.2;
    const seg = mesh(CYL, mats.fur, -0.1, 0, 0, 0.07, 0.22, 0.07, false);
    seg.rotation.z = Math.PI / 2;
    j.add(seg);
    parent.add(j);
    tailSegs.push(j);
    parent = j;
  }
  const strikeLine = decal(glowTexture(), new THREE.Color(PALETTE.knife), 1.8, 0, true);
  strikeLine.visible = false;
  return { root, body, head, eyes, tailSegs, torso, mats, strikeLine };
}

export function poseCat(model, h, now, dt, reduced = false) {
  model.root.position.set(h.x, 0, h.z);
  model.root.rotation.y = -h.a;
  const asleep = h.m === 'sleep' || h.m === 'rest';
  const crouch = h.m === 'crouch';
  const leap = h.m === 'leap';
  // Curled asleep, flat in a crouch, stretched mid-leap.
  const breathe = asleep && !reduced ? Math.sin(now * 2.2) * 0.04 : 0;
  model.body.scale.set(asleep ? 0.82 : leap ? 1.25 : 1, asleep ? 0.8 + breathe : crouch ? 0.65 : 1, asleep ? 1.15 : 1);
  model.body.position.y = leap ? 0.6 : 0;
  model.head.position.set(asleep ? 0.45 : 0.62, asleep ? 0.42 : crouch ? 0.48 : 0.62, asleep ? 0.18 : 0);
  model.head.rotation.z = asleep ? -0.3 : crouch ? -0.15 : 0;
  for (const e of model.eyes) e.scale.y = asleep ? 0.008 : h.m === 'wake' ? 0.03 : 0.06;
  for (let i = 0; i < model.tailSegs.length; i++) {
    const j = model.tailSegs[i];
    j.rotation.y = asleep ? 0.55 : Math.sin(now * (crouch ? 9 : 2) - i * 0.6) * (crouch ? 0.35 : 0.2);
    j.rotation.z = asleep ? 0 : 0.25;
  }
  const ch = h.ch;
  const show = (crouch || leap) && ch && now < ch.at + 0.1;
  model.strikeLine.visible = !!show;
  if (show) {
    model.strikeLine.position.set(ch.x, 0.04, ch.z);
    model.strikeLine.scale.setScalar(ch.r * 1.1);
    model.strikeLine.material.opacity = 0.4 + 0.4 * Math.abs(Math.sin(now * 16));
  }
}

// ---------------------------------------------------------------- cheese and traps

export function createWedge() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.62, 0);
  s.lineTo(0, 0.3);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
  g.translate(-0.24, 0, -0.2);
  const mat = echoed(new THREE.MeshStandardMaterial({ color: 0xffffff, map: cheeseTexture(), roughness: 0.55, emissive: PALETTE.cheese, emissiveIntensity: 0.12 }), { rim: 0.4 });
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  const root = new THREE.Group();
  root.add(m);
  const glow = decal(glowTexture(), new THREE.Color(0x8a6a10), 1.8, 0.45, true);
  glow.position.y = 0.03;
  return { root, mesh: m, mat, glow, ping: 0, k: 'w', spin: 0 };
}

export function createWheel() {
  const rind = echoed(std(0xe0a12e, { roughness: 0.6, emissive: PALETTE.cheese, emissiveIntensity: 0.1 }), { rim: 0.35 });
  const face = echoed(new THREE.MeshStandardMaterial({ color: 0xffffff, map: cheeseTexture(), roughness: 0.6, emissive: PALETTE.cheese, emissiveIntensity: 0.12 }), { rim: 0.2 });
  const g = new THREE.CylinderGeometry(0.62, 0.62, 0.42, 28);
  const m = new THREE.Mesh(g, [rind, face, face]);
  m.castShadow = true;
  m.rotation.x = Math.PI / 2;
  const roll = new THREE.Group();
  roll.position.y = 0.62;
  roll.add(m);
  const root = new THREE.Group();
  root.add(roll);
  const glow = decal(glowTexture(), new THREE.Color(0x8a6a10), 3.0, 0.4, true);
  glow.position.y = 0.03;
  return { root, roll, mesh: m, mat: rind, mat2: face, glow, ping: 0, k: 'W', spin: 0, lx: 0, lz: 0 };
}

export function createTrap() {
  const wood = echoed(std(0xb98a52, { roughness: 0.8 }), { rim: 0.2 });
  const metal = echoed(std(0xaab0b8, { roughness: 0.3, metalness: 0.9 }));
  const root = new THREE.Group();
  root.add(mesh(BOXG, wood, 0, 0.04, 0, 0.78, 0.08, 0.42));
  const bar = new THREE.Group();
  bar.position.set(0, 0.09, 0);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 4, 4, Math.PI), metal);
  loop.rotation.set(0, Math.PI / 2, 0);
  loop.scale.set(1, 1, 1.4);
  bar.add(loop);
  root.add(bar);
  const bait = mesh(BOXG, std(0xffd23f, { emissive: 0x5a4000 }), 0.22, 0.12, 0, 0.1, 0.06, 0.1, false);
  root.add(bait);
  root.add(mesh(CYL, metal, 0.0, 0.1, 0.16, 0.03, 0.04, 0.03, false));
  return { root, bar, bait, sprung: false, flip: 0 };
}

export function poseTrap(model, sprung, dt) {
  if (sprung && !model.sprung) model.flip = 0;
  model.sprung = sprung;
  if (sprung) model.flip = Math.min(1, model.flip + dt * 12);
  model.bar.rotation.z = sprung ? -Math.PI * 0.92 * model.flip : 0;
  model.bait.visible = !sprung;
}

export { UP };
