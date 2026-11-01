// Butter the cat: a ginger tabby who sleeps curled with her tail round her nose, wakes with a stretch, sits up to listen
// with her ears turning, slinks when she stalks, wiggles her rump before she pounces and lands in a squash. Her eyes glow
// in the dark. No allocations in the frame.

import * as THREE from 'three';
import { patchEcho, PALETTE } from './echo.js';
import { pawTexture } from './textures.js';
import { HUNTER } from '../core/hunters.js';
import { decal, glowTexture } from './mouse.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...o });
const SPH = new THREE.SphereGeometry(1, 22, 16);
const SPH_LO = new THREE.SphereGeometry(1, 10, 8);

function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = shadow;
  return m;
}

function latheX(profile, seg = 20) {
  const g = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(Math.max(0.0005, r), x)), seg);
  g.rotateZ(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

// Ginger tabby stripes running round the body (u along the body, v round it).
let tabbyTex = null;
function tabbyTexture() {
  if (tabbyTex) return tabbyTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e8944a';
  g.fillRect(0, 0, 256, 128);
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,220,170,0.10)' : 'rgba(120,50,10,0.08)';
    g.fillRect(rnd() * 256, rnd() * 128, 1 + rnd() * 2, 4 + rnd() * 6);
  }
  g.strokeStyle = 'rgba(150,62,18,0.85)';
  for (let x = 14; x < 256; x += 22 + rnd() * 6) {
    g.lineWidth = 6 + rnd() * 5;
    g.beginPath();
    g.moveTo(x, 0);
    for (let y = 0; y <= 128; y += 16) g.lineTo(x + Math.sin(y * 0.09 + x) * 6, y);
    g.stroke();
  }
  tabbyTex = new THREE.CanvasTexture(c);
  tabbyTex.colorSpace = THREE.SRGBColorSpace;
  tabbyTex.wrapS = tabbyTex.wrapT = THREE.RepeatWrapping;
  return tabbyTex;
}

let zTex = null;
function zzzTexture() {
  if (zTex) return zTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff1d6';
  g.font = '900 48px "Alfa Slab One", Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('z', 32, 34);
  zTex = new THREE.CanvasTexture(c);
  zTex.colorSpace = THREE.SRGBColorSpace;
  return zTex;
}

const BODY = latheX([[0.0, -0.78], [0.2, -0.76], [0.33, -0.66], [0.4, -0.48], [0.41, -0.2], [0.38, 0.1], [0.36, 0.34], [0.33, 0.52], [0.24, 0.66], [0.0, 0.72]]);
const HEAD = latheX([[0.0, -0.26], [0.2, -0.24], [0.29, -0.14], [0.31, 0.0], [0.28, 0.12], [0.21, 0.2], [0.13, 0.26], [0.0, 0.29]]);

export function createCat() {
  const tex = tabbyTexture();
  const mats = {
    fur: patchEcho(std(0xffffff, { map: tex }), { rim: 0.45, fill: 1.2 }),
    pale: patchEcho(std(0xf6dcb4, { roughness: 0.95 }), { rim: 0.25 }),
    pink: patchEcho(std(0xe89a9a, { roughness: 0.6 }), { rim: 0.2 }),
    inner: patchEcho(std(0xf0a8a0, { roughness: 0.8, emissive: 0x301010, side: THREE.DoubleSide }), { rim: 0.1 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xd8ff5a, toneMapped: false }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    lid: patchEcho(std(0xd8823e, { roughness: 0.95 })),
    whisker: new THREE.LineBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.7 }),
  };
  const root = new THREE.Group();
  const lift = new THREE.Group(); // leap height
  root.add(lift);
  const hips = new THREE.Group(); // pitch about the back legs (sitting, the rump up in a crouch)
  hips.position.set(-0.55, 0.62, 0);
  lift.add(hips);
  const torso = new THREE.Group();
  torso.position.set(0.55, 0, 0);
  hips.add(torso);
  const body = mesh(BODY, mats.fur, 0, 0, 0, 1, 0.92, 0.92);
  torso.add(body);
  torso.add(mesh(SPH, mats.pale, 0.32, -0.12, 0, 0.36, 0.26, 0.3, false));
  // Shape over the tube: shoulder blades, a fluffy chest, and haunches on the hips so she reads as a cat from above.
  for (const side of [-1, 1]) torso.add(mesh(SPH, mats.fur, 0.4, 0.04, side * 0.16, 0.22, 0.27, 0.16));
  torso.add(mesh(SPH, mats.pale, 0.56, -0.08, 0, 0.2, 0.25, 0.25, false));
  // Head on a neck.
  const neck = new THREE.Group();
  neck.position.set(0.62, 0.22, 0);
  torso.add(neck);
  const head = new THREE.Group();
  head.position.set(0.16, 0.18, 0);
  neck.add(head);
  head.add(mesh(HEAD, mats.fur, 0, 0, 0, 1, 0.92, 1.05));
  for (const side of [-1, 1]) head.add(mesh(SPH, mats.fur, 0.06, -0.08, side * 0.15, 0.17, 0.13, 0.13, false));
  head.add(mesh(SPH, mats.pale, 0.21, -0.08, 0, 0.11, 0.08, 0.13, false));
  head.add(mesh(SPH_LO, mats.pink, 0.29, -0.03, 0, 0.035, 0.025, 0.04, false));
  const ears = [];
  const eyes = [];
  const lids = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(-0.04, 0.21, side * 0.15);
    const outer = mesh(new THREE.ConeGeometry(0.11, 0.24, 4, 1), mats.fur, 0, 0.1, 0, 1, 1, 0.45);
    outer.rotation.y = Math.PI / 4;
    const inner = mesh(new THREE.ConeGeometry(0.075, 0.17, 3, 1), mats.inner, 0.025, 0.08, 0, 1, 1, 0.3, false);
    ear.add(outer, inner);
    ear.rotation.set(side * -0.28, 0, -0.1);
    head.add(ear);
    ears.push(ear);
    const eye = mesh(SPH_LO, mats.eye, 0.23, 0.06, side * 0.11, 0.06, 0.065, 0.055, false);
    const pupil = mesh(SPH_LO, mats.pupil, 0.45, 0, 0, 0.45, 0.92, 0.22, false);
    eye.add(pupil);
    head.add(eye);
    eyes.push({ eye, pupil });
    const lid = mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.lid, 0.225, 0.065, side * 0.11, 0.068, 0.07, 0.062, false);
    head.add(lid);
    lids.push(lid);
  }
  const wpos = [];
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) wpos.push(0.27, -0.06, side * 0.05, 0.5, -0.1 + (k - 1) * 0.06, side * (0.32 + k * 0.03));
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  head.add(new THREE.LineSegments(wg, mats.whisker));
  // Legs: front ones hang from the shoulders (on the torso), back ones from the hips.
  const legGeo = new THREE.CylinderGeometry(0.075, 0.1, 1, 10);
  legGeo.translate(0, -0.5, 0);
  const legs = [];
  for (const [front, side] of [[1, -1], [1, 1], [0, -1], [0, 1]]) {
    const leg = new THREE.Group();
    if (front) {
      leg.position.set(0.45, -0.1, side * 0.19);
      torso.add(leg);
    } else {
      leg.position.set(0.05, 0, side * 0.22);
      hips.add(leg);
    }
    const len = front ? 0.5 : 0.62;
    if (!front) hips.add(mesh(SPH, mats.fur, 0.02, -0.06, side * 0.18, 0.3, 0.3, 0.16));
    const upper = mesh(legGeo, mats.fur, 0, 0, 0, front ? 1 : 1.5, len, front ? 1 : 1.4);
    leg.add(upper);
    const paw = mesh(SPH_LO, mats.pale, 0.05, -len, 0, 0.12, 0.07, 0.1, false);
    leg.add(paw);
    legs.push({ leg, front, side, len, paw });
  }
  // The tail: a chain of joints.
  const tail = new THREE.Group();
  tail.position.set(-0.72, 0.18, 0);
  torso.add(tail);
  const tailSegs = [];
  let parent = tail;
  const N = 8;
  for (let i = 0; i < N; i++) {
    const j = new THREE.Group();
    j.position.x = i === 0 ? 0 : -0.16;
    const r = 0.075 - i * 0.004;
    const seg = mesh(new THREE.CylinderGeometry(r * 0.9, r, 0.19, 10), mats.fur, -0.08, 0, 0, 1, 1, 1, i < 5);
    seg.rotation.z = Math.PI / 2;
    j.add(seg);
    if (i === N - 1) j.add(mesh(SPH_LO, mats.fur, -0.17, 0, 0, 0.06, 0.06, 0.06, false));
    parent.add(j);
    tailSegs.push(j);
    parent = j;
  }
  // Where she'll land: a paw print pulsing red.
  const strikeLine = decal(pawTexture(), new THREE.Color(PALETTE.knife), 1.6, 0, true);
  strikeLine.visible = false;
  const strikeGlow = decal(glowTexture(), new THREE.Color(PALETTE.knife), 2.4, 0, true);
  strikeGlow.visible = false;
  const contact = decal(glowTexture(), new THREE.Color(0x000000), 2.4, 0.5);
  contact.position.y = 0.011;
  const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xc8ff40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  eyeGlow.scale.setScalar(0.9);
  eyeGlow.position.set(0.24, 0.06, 0);
  head.add(eyeGlow);
  const zs = [0, 1, 2].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false }));
    s.visible = false;
    return s;
  });
  return { root, lift, hips, torso, body, neck, head, ears, eyes, lids, legs, tailSegs, mats, strikeLine, strikeGlow, contact, eyeGlow, zs, gait: 0, mode: '', modeT: 0, px: NaN, pz: NaN, speed: 0, landedSeq: -1, wig: 0 };
}

export function addCat(group, model) {
  group.add(model.root, model.strikeLine, model.strikeGlow, model.contact, ...model.zs);
}

const lerp = (a, b, u) => a + (b - a) * u;

// Pose the cat. h: { x, z, a, m, t, ch, sx, sz, tx, tz }.
export function poseCat(model, h, now, dt, reduced = false, fx = null) {
  const c = HUNTER.cat;
  if (h.m !== model.mode) {
    model.mode = h.m;
    model.modeT = 0;
  }
  model.modeT += dt;
  const mt = model.modeT;
  if (!Number.isFinite(model.px)) {
    model.px = h.x;
    model.pz = h.z;
  }
  const inst = dt > 0 ? Math.hypot(h.x - model.px, h.z - model.pz) / dt : 0;
  if (inst < 30) model.speed += (inst - model.speed) * Math.min(1, dt * 8);
  model.px = h.x;
  model.pz = h.z;
  const speed = model.speed;
  model.root.position.set(h.x, 0, h.z);
  model.root.rotation.y = -h.a;
  model.contact.position.set(h.x, 0.011, h.z);
  const asleep = h.m === 'sleep';
  const resting = h.m === 'rest';
  const crouch = h.m === 'crouch';
  const leap = h.m === 'leap';
  const land = h.m === 'land';
  const sitting = h.m === 'listen' || h.m === 'wake';
  const moving = speed > 0.2 && !leap;
  // Gait: a diagonal walk, low and slow when stalking.
  model.gait += dt * (moving ? 3 + speed * 3.2 : 0);
  const stalk = h.m === 'stalk';
  const low = stalk ? 0.18 : 0;
  // Leap: an arc from where she crouched to where she lands.
  let arc = 0;
  let pitch = 0;
  if (leap && h.ch) {
    const span = Math.max(0.05, h.ch.at - h.t);
    const u = Math.max(0, Math.min(1, (now - h.t) / span));
    arc = Math.sin(u * Math.PI) * Math.min(1.6, 0.5 + span * 2.2);
    pitch = lerp(0.55, -0.6, u);
  }
  model.lift.position.y = arc;
  // The rump: up and wiggling in a crouch; down when sitting; level otherwise.
  let hipPitch = 0;
  let hipY = 0.62 - low;
  if (sitting) hipPitch = lerp(0, 0.75, Math.min(1, mt * 4));
  if (h.m === 'wake' && !reduced) hipPitch = mt < 0.6 ? -0.35 * Math.sin((mt / 0.6) * Math.PI) : hipPitch; // the stretch
  if (crouch) {
    hipPitch = -0.28;
    hipY = 0.5;
    model.wig += dt * 22;
  }
  if (asleep || resting) {
    hipY = 0.3;
    hipPitch = 0;
  }
  if (land) {
    const u = Math.min(1, mt / c.land);
    hipY = 0.62 - Math.sin(Math.min(1, u * 3) * Math.PI) * 0.22;
  }
  model.hips.position.y = hipY;
  model.hips.rotation.z = hipPitch + pitch;
  model.hips.rotation.x = crouch && !reduced ? Math.sin(model.wig) * 0.12 : 0;
  model.torso.rotation.z = crouch ? 0.08 : 0;
  // Breathing, curled asleep.
  const breathe = (asleep || resting) && !reduced ? Math.sin(now * 2.1) * 0.04 : 0;
  model.body.scale.set(leap ? 1.12 : 1, 0.92 + breathe, 0.92 + breathe * 0.5);
  model.torso.rotation.y = asleep ? 0.25 : 0;
  // Head: tucked asleep, raised listening, low and still stalking, locked on in a crouch.
  const look = Math.atan2(h.tz - h.z, h.tx - h.x) - h.a;
  const turn = Math.atan2(Math.sin(look), Math.cos(look));
  if (asleep) {
    model.neck.rotation.set(0.0, 0.9, -0.55);
  } else if (sitting) {
    model.neck.rotation.set(0, reduced ? 0 : Math.max(-0.8, Math.min(0.8, turn)) * 0.6 + Math.sin(now * 0.9) * 0.15, -0.75 + Math.sin(now * 1.3) * 0.04);
  } else if (crouch) {
    model.neck.rotation.set(0, 0, 0.12);
  } else {
    model.neck.rotation.set(0, Math.sin(now * 0.7) * (stalk ? 0.05 : 0.2), stalk ? 0.15 : -0.15);
  }
  // Ears: flat in a crouch, swivelling while listening, relaxed asleep.
  model.ears.forEach((e, i) => {
    const side = i ? 1 : -1;
    const swivel = sitting && !reduced ? Math.sin(now * 2.3 + i * 1.7) * 0.35 : 0;
    e.rotation.set(side * (crouch ? -0.9 : asleep ? -0.5 : -0.28), swivel, crouch ? 0.5 : -0.1);
  });
  // Eyes: shut asleep, slow blinks resting, wide in a crouch (big pupils), slits otherwise.
  const blink = !reduced && (now % 4.3) < 0.12 ? 1 : 0;
  const shut = asleep ? 1 : resting ? 0.65 + 0.3 * Math.sin(now * 0.8) : h.m === 'wake' ? Math.max(0, 1 - mt * 2) : blink;
  model.lids.forEach((l) => (l.scale.y = 0.02 + 0.07 * shut));
  model.eyes.forEach(({ pupil }) => {
    pupil.scale.set(0.45, 0.92, crouch || leap ? 0.75 : sitting ? 0.35 : 0.2);
  });
  model.eyeGlow.material.opacity = (1 - shut) * (crouch || leap ? 0.9 : 0.45);
  // Legs.
  for (const L of model.legs) {
    const diag = (L.front ? 0 : Math.PI) + (L.side > 0 ? Math.PI : 0);
    const ph = model.gait + diag;
    let swing = moving && !reduced ? Math.sin(ph) * (stalk ? 0.35 : 0.55) : 0;
    let bend = 0;
    if (asleep || resting) {
      swing = L.front ? -1.4 : 1.4;
    } else if (sitting && !L.front) {
      swing = 1.3;
    } else if (sitting && L.front) {
      swing = -0.65;
    } else if (crouch) {
      swing = L.front ? -0.5 : 0.55;
    } else if (leap) {
      swing = L.front ? lerp(-1.3, 0.9, Math.max(0, Math.min(1, (now - h.t) / Math.max(0.05, (h.ch?.at ?? now) - h.t)))) : 1.2;
    }
    if (h.m === 'wake' && L.front && mt < 0.6 && !reduced) swing = -1.2 * Math.sin((mt / 0.6) * Math.PI);
    L.leg.rotation.z = swing - (L.front ? 0 : 0);
    L.leg.rotation.x = bend;
    L.paw.position.y = -L.len + (moving && !reduced ? Math.max(0, Math.cos(ph)) * 0.04 : 0);
  }
  // Tail: wrapped round her asleep, a question mark roaming, low stalking, flicking at the tip in a crouch.
  const segs = model.tailSegs;
  for (let i = 0; i < segs.length; i++) {
    const u = i / (segs.length - 1);
    const j = segs[i];
    if (asleep || resting) {
      j.rotation.set(0, 0.42, i === 0 ? -0.3 : 0.02);
    } else if (crouch) {
      j.rotation.set(0, reduced ? 0 : Math.sin(now * 16 - i * 0.8) * 0.25 * u * u, i === 0 ? 0.3 : -0.04);
    } else if (leap) {
      j.rotation.set(0, 0, i === 0 ? 0.25 : 0.02);
    } else if (stalk) {
      j.rotation.set(0, reduced ? 0 : Math.sin(now * 3 - i * 0.6) * 0.12, i === 0 ? 0.1 : -0.02 + (i > 5 ? 0.15 : 0));
    } else {
      j.rotation.set(0, reduced ? 0 : Math.sin(now * 1.8 - i * 0.5) * 0.15, i === 0 ? 1.0 : i < 5 ? 0.12 : -0.35);
    }
  }
  // The pounce's target, and the landing.
  const ch = h.ch;
  const show = (crouch || leap) && ch && now < ch.at + 0.1;
  model.strikeLine.visible = model.strikeGlow.visible = !!show;
  if (show) {
    const u = crouch ? Math.min(1, mt / c.crouch) : 1;
    model.strikeLine.position.set(ch.x, 0.045, ch.z);
    model.strikeLine.rotation.y = -h.a + Math.PI / 2;
    model.strikeLine.scale.setScalar(ch.r * 1.3 * (1.4 - 0.4 * u));
    model.strikeLine.material.opacity = 0.5 + 0.45 * Math.abs(Math.sin(now * 16));
    model.strikeGlow.position.set(ch.x, 0.04, ch.z);
    model.strikeGlow.scale.setScalar(ch.r * 1.1);
    model.strikeGlow.material.opacity = 0.25 + 0.3 * u;
  }
  if (land && ch && model.landedSeq !== ch.seq) {
    model.landedSeq = ch.seq;
    fx?.dust(h.x, h.z, 12, h.a, 1.3);
  }
  model.contact.scale.setScalar(1 - Math.min(0.5, arc * 0.3));
  model.contact.material.opacity = 0.5 - Math.min(0.3, arc * 0.2);
  // Zzz while she sleeps.
  model.zs.forEach((s, i) => {
    s.visible = asleep && !reduced;
    if (!s.visible) return;
    const u = ((now * 0.45 + i / 3) % 1 + 1) % 1;
    s.position.set(h.x + Math.cos(h.a) * 0.6 + Math.sin(u * 6 + i) * 0.15, 1.1 + u * 1.4, h.z + Math.sin(h.a) * 0.6);
    s.scale.setScalar(0.25 + u * 0.35);
    s.material.opacity = Math.sin(u * Math.PI) * 0.9;
  });
}
