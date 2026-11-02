// Butter the cat, sculpted: a flexible spine that a fur tube is wrapped round every frame (a deep chest, a tucked waist,
// round haunches), a wide head with a muzzle, cheeks and cupped ears, legs with real joints solved onto the floor (elbows
// back, knees forward, a hock) and a tabby tail. She sleeps curled with her tail round her nose, wakes with a play-bow
// stretch and a yawn, sits up to listen with her ears turning, roams, stalks low with her shoulder blades rolling,
// gathers her back feet and wiggles before she pounces, stretches out in the air reaching with her front paws, and lands
// in a squash. Her eyes glow in the dark. No allocations in the frame.

import * as THREE from 'three';
import { patchEcho, ink, PALETTE } from './echo.js';
import { pawTexture } from './textures.js';
import { HUNTER } from '../core/hunters.js';
import { decal, glowTexture } from './mouse.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...o });
const SPH = new THREE.SphereGeometry(1, 16, 12);
const SPH_LO = new THREE.SphereGeometry(1, 10, 8);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u * u * (3 - 2 * u);

function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = shadow;
  return m;
}

// ---------------------------------------------------------------- fur

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

// The body and tail: u along, v round (0 the back, 0.5 the belly). Ginger with rust stripes over the back and sides, a
// dark line down the spine, a cream belly.
let bodyTex = null;
function bodyTexture() {
  if (bodyTex) return bodyTex;
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#d97f38';
  g.fillRect(0, 0, 512, 256);
  const belly = g.createLinearGradient(0, 0, 0, 256);
  belly.addColorStop(0.2, 'rgba(246,220,178,0)');
  belly.addColorStop(0.38, 'rgba(246,220,178,0.95)');
  belly.addColorStop(0.62, 'rgba(246,220,178,0.95)');
  belly.addColorStop(0.8, 'rgba(246,220,178,0)');
  g.fillStyle = belly;
  g.fillRect(0, 0, 512, 256);
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,226,180,0.12)' : 'rgba(110,44,8,0.1)';
    g.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 2, 3 + rnd() * 7);
  }
  // Stripes from the spine down each side, fading before the belly.
  g.lineCap = 'round';
  for (let x = 10; x < 512; x += 30 + rnd() * 10) {
    const w = 9 + rnd() * 7;
    for (const [y0, y1] of [[-4, 92], [260, 164]]) {
      const grad = g.createLinearGradient(0, y0, 0, y1);
      grad.addColorStop(0, 'rgba(128,48,12,0.75)');
      grad.addColorStop(0.75, 'rgba(128,48,12,0.4)');
      grad.addColorStop(1, 'rgba(128,48,12,0)');
      g.strokeStyle = grad;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x, y0);
      const dir = y1 > y0 ? 1 : -1;
      for (let k = 1; k <= 6; k++) g.lineTo(x + Math.sin(k * 1.3 + x) * 7 + k * 2, y0 + dir * k * 16);
      g.stroke();
    }
  }
  g.fillStyle = 'rgba(120,44,10,0.55)';
  g.fillRect(0, 0, 512, 10);
  g.fillRect(0, 246, 512, 10);
  bodyTex = tex(c);
  return bodyTex;
}

// The head, on a sphere's own UVs (u = 0.5 the face, v = 0 the crown): ginger, a cream muzzle and chin, the tabby M on
// the brow and stripes from the eyes back over the cheeks.
let headTex = null;
function headTexture() {
  if (headTex) return headTex;
  const [c, g] = canvas(512, 256);
  g.fillStyle = '#dd8640';
  g.fillRect(0, 0, 512, 256);
  let seed = 5;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,226,180,0.1)' : 'rgba(110,44,8,0.08)';
    g.fillRect(rnd() * 512, rnd() * 256, 1 + rnd() * 2, 2 + rnd() * 5);
  }
  const cream = (x, y, rx, ry) => {
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    gr.addColorStop(0, 'rgba(248,226,188,1)');
    gr.addColorStop(0.7, 'rgba(248,226,188,0.85)');
    gr.addColorStop(1, 'rgba(248,226,188,0)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  cream(256, 168, 62, 52);
  cream(256, 214, 70, 50);
  g.strokeStyle = 'rgba(120,42,10,0.9)';
  g.lineCap = 'round';
  // The M on the brow.
  g.lineWidth = 9;
  for (const [x0, y0, x1, y1] of [[256, 32, 256, 92], [236, 40, 242, 96], [276, 40, 270, 96], [214, 56, 228, 100], [298, 56, 284, 100]]) {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  // Cheek stripes from the outer corner of each eye.
  g.lineWidth = 7;
  for (const s of [-1, 1]) {
    for (const [dy, len] of [[0, 46], [16, 38]]) {
      g.beginPath();
      g.moveTo(256 + s * 74, 128 + dy);
      g.quadraticCurveTo(256 + s * 98, 124 + dy, 256 + s * (74 + len + 10), 132 + dy);
      g.stroke();
    }
  }
  // Rings round the back of the head.
  g.lineWidth = 10;
  for (const x of [40, 80, 432, 472]) {
    g.beginPath();
    g.moveTo(x, 10);
    g.lineTo(x + 6, 110);
    g.stroke();
  }
  headTex = tex(c);
  return headTex;
}

let zTex = null;
function zzzTexture() {
  if (zTex) return zTex;
  const [c, g] = canvas(64, 64);
  g.fillStyle = '#fff1d6';
  g.font = '900 48px "Alfa Slab One", Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('z', 32, 34);
  zTex = new THREE.CanvasTexture(c);
  zTex.colorSpace = THREE.SRGBColorSpace;
  return zTex;
}

// ---------------------------------------------------------------- shapes

// The head: a sphere pushed into a cat's: wider than tall, full cheeks, a short muzzle with whisker pads, a flat brow.
function headGeometry() {
  const g = new THREE.SphereGeometry(1, 30, 22);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const front = Math.max(0, x);
    // Cheeks: fuller low on the sides.
    const low = clamp01((0.25 - y) / 0.75);
    z *= 1 + 0.16 * low * Math.abs(z);
    // The muzzle: two whisker pads and a chin, forward and low.
    const pad = Math.exp(-((y + 0.36) ** 2) / 0.05) * (Math.exp(-((z - 0.2) ** 2) / 0.05) + Math.exp(-((z + 0.2) ** 2) / 0.05));
    const chin = Math.exp(-((y + 0.62) ** 2) / 0.04 - (z * z) / 0.08);
    x += front * (0.26 * pad + 0.12 * chin);
    // The brow flatter, the crown a little lower.
    if (y > 0 && x > 0) x *= 1 - 0.12 * y;
    if (y > 0.5) y = 0.5 + (y - 0.5) * 0.8;
    p.setXYZ(i, x * 0.27, y * 0.25, z * 0.3);
  }
  g.computeVertexNormals();
  return g;
}

// An ear: a rounded triangle, thin, cupped forward. Its base at the origin, its front facing +x.
function earGeometry(w, h, depth) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-w * 0.08, h * 0.92);
  s.quadraticCurveTo(0, h * 1.04, w * 0.08, h * 0.92);
  s.lineTo(w / 2, 0);
  s.quadraticCurveTo(0, -h * 0.08, -w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: depth * 0.4, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    p.setX(i, p.getX(i) + z * z * 3.2);
  }
  g.computeVertexNormals();
  return g;
}

// A limb segment: a rounded, slightly tapered tube from 0 down to -1 along y, drawn between two joints.
const LIMB = (() => {
  const prof = [[0.001, -1.1], [0.58, -1.06], [0.84, -0.93], [0.93, -0.5], [1, -0.06], [0.88, 0.05], [0.55, 0.11], [0.001, 0.14]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 12);
  g.computeVertexNormals();
  return g;
})();

// ---------------------------------------------------------------- the spine and the fur round it

const SP = 6; // spine control points, rump to chest
const RING_S = [0, 0.012, 0.035, 0.07, 0.11, 0.16, 0.23, 0.31, 0.39, 0.47, 0.55, 0.63, 0.71, 0.78, 0.84, 0.89, 0.93, 0.965, 0.985, 1];
const RINGS = RING_S.length;
const SIDES = 18;
// The body's section along the spine: [s, height, width, drop (the chest hangs deeper than the waist)].
const PROFILE = [
  [0, 0.27, 0.25, 0.0],
  [0.12, 0.29, 0.27, -0.01],
  [0.26, 0.28, 0.25, -0.01],
  [0.44, 0.24, 0.21, 0.03],
  [0.6, 0.29, 0.24, -0.04],
  [0.76, 0.31, 0.25, -0.06],
  [0.9, 0.28, 0.23, -0.05],
  [1, 0.22, 0.19, -0.02],
];
const roundEnd = (u) => Math.sqrt(Math.max(0, 1 - (1 - clamp01(u)) ** 2));
const ringH = new Float32Array(RINGS);
const ringW = new Float32Array(RINGS);
const ringD = new Float32Array(RINGS);
for (let j = 0; j < RINGS; j++) {
  const s = RING_S[j];
  let k = 0;
  while (k < PROFILE.length - 2 && PROFILE[k + 1][0] < s) k++;
  const [s0, h0, w0, d0] = PROFILE[k];
  const [s1, h1, w1, d1] = PROFILE[k + 1];
  const u = smooth(clamp01((s - s0) / (s1 - s0)));
  const cap = roundEnd(s / 0.13) * roundEnd((1 - s) / 0.1);
  ringH[j] = lerp(h0, h1, u) * cap;
  ringW[j] = lerp(w0, w1, u) * cap;
  ringD[j] = lerp(d0, d1, u);
}

function tubeGeometry(rings, sides) {
  const g = new THREE.BufferGeometry();
  const n = rings * (sides + 1);
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const uv = new Float32Array(n * 2);
  const idx = [];
  for (let j = 0; j < rings; j++) {
    for (let k = 0; k <= sides; k++) {
      uv[(j * (sides + 1) + k) * 2] = j / (rings - 1);
      uv[(j * (sides + 1) + k) * 2 + 1] = k / sides;
      if (j < rings - 1 && k < sides) {
        const a = j * (sides + 1) + k;
        const b = a + 1;
        const c = a + sides + 1;
        const d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
  return g;
}

const COS = new Float32Array(SIDES + 1);
const SIN = new Float32Array(SIDES + 1);
for (let k = 0; k <= SIDES; k++) {
  COS[k] = Math.cos((k / SIDES) * Math.PI * 2);
  SIN[k] = Math.sin((k / SIDES) * Math.PI * 2);
}

// ---------------------------------------------------------------- the pose

// A pose is a flat list of numbers, so poses blend by easing each one: the spine's six points, the head (position, yaw,
// pitch, roll), the four paws, the back legs' hocks, the tail, ears, eyes, jaw and how squashed the body is.
const P_SPINE = 0;
const P_HEAD = 18; // x y z yaw pitch roll
const P_FPAW = 24; // 2 x (x y z)
const P_BPAW = 30; // 2 x (x y z)
const P_HOCK = 36; // dx dy
const P_TAIL = 38; // base pitch, pitch per joint, base yaw (pi: straight back), yaw per joint, wave
const P_EAR = 43; // back, out
const P_EYE = 45; // open, pupil
const P_JAW = 47;
const P_SQUASH = 48;
const P_LEN = 49;

const TAIL_N = 14;
const TAIL_SEG = 0.088;
const TAIL_SIDES = 8;

export function createCat() {
  const mats = {
    fur: patchEcho(std(0xffffff, { map: bodyTexture() }), { rim: 0.45, fill: 1.15 }),
    head: patchEcho(std(0xffffff, { map: headTexture() }), { rim: 0.45, fill: 1.15 }),
    leg: patchEcho(std(0xd98a46), { rim: 0.4, fill: 1.15 }),
    pale: patchEcho(std(0xf6dcb4, { roughness: 0.95 }), { rim: 0.25 }),
    pink: patchEcho(std(0xe8909a, { roughness: 0.6 }), { rim: 0.2 }),
    inner: patchEcho(std(0xf0a8a8, { roughness: 0.8, emissive: 0x301010 }), { rim: 0.1 }),
    mouth: std(0x5a1a20, { roughness: 0.7 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xd8ff5a, toneMapped: false }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x050505 }),
    whisker: new THREE.LineBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.75 }),
  };
  const root = new THREE.Group();
  const lift = new THREE.Group();
  root.add(lift);
  // The body: a tube rewritten every frame round the spine.
  const bodyGeo = tubeGeometry(RINGS, SIDES);
  const body = ink(new THREE.Mesh(bodyGeo, mats.fur));
  body.castShadow = true;
  body.frustumCulled = false;
  lift.add(body);
  // The neck, thick with fur, and a pale ruff under the chin.
  const neck = ink(mesh(LIMB, mats.leg, 0, 0, 0, 0.2, 0.3, 0.19));
  lift.add(neck);
  const ruff = mesh(SPH, mats.pale, 0, 0, 0, 0.17, 0.2, 0.19, false);
  lift.add(ruff);
  // The head.
  const head = new THREE.Group();
  lift.add(head);
  head.add(ink(mesh(headGeometry(), mats.head)));
  head.add(mesh(SPH_LO, mats.pink, 0.305, -0.035, 0, 0.026, 0.022, 0.04, false));
  const jaw = new THREE.Group();
  jaw.position.set(0.1, -0.13, 0);
  jaw.add(mesh(SPH, mats.pale, 0.11, -0.012, 0, 0.12, 0.035, 0.1, false));
  jaw.add(mesh(SPH_LO, mats.mouth, 0.1, 0.02, 0, 0.1, 0.03, 0.08, false));
  head.add(jaw);
  const earGeo = earGeometry(0.21, 0.23, 0.03);
  const earInGeo = earGeometry(0.13, 0.15, 0.01);
  const ears = [];
  const eyes = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(-0.03, 0.17, side * 0.15);
    ear.add(ink(mesh(earGeo, mats.head)), mesh(earInGeo, mats.inner, 0.022, 0.02, 0, 1, 1, 1, false));
    head.add(ear);
    ears.push(ear);
    // An almond eye with a slit pupil, set into the face and tilted up at the outer corner.
    const eyeRig = new THREE.Group();
    eyeRig.position.set(0.215, 0.045, side * 0.105);
    eyeRig.rotation.set(side * -0.28, side * -0.45, 0);
    const eye = mesh(SPH_LO, mats.eye, 0, 0, 0, 0.03, 0.05, 0.062, false);
    const pupil = mesh(SPH_LO, mats.pupil, 0.55, 0, 0, 0.5, 0.92, 0.25, false);
    eye.add(pupil);
    eyeRig.add(eye);
    head.add(eyeRig);
    eyes.push({ eye, pupil });
  }
  const wpos = [];
  for (const side of [-1, 1]) for (let k = 0; k < 3; k++) wpos.push(0.29, -0.07 + (k - 1) * 0.012, side * 0.07, 0.52, -0.08 + (k - 1) * 0.07, side * (0.34 + k * 0.035));
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
  head.add(new THREE.LineSegments(wg, mats.whisker));
  const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xc8ff40, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  eyeGlow.scale.setScalar(0.9);
  eyeGlow.position.set(0.25, 0.05, 0);
  head.add(eyeGlow);
  // Legs: front (upper arm, forearm, paw) and back (thigh, shin, hock to paw).
  const legs = [];
  for (const [front, side] of [[1, -1], [1, 1], [0, -1], [0, 1]]) {
    const parts = front ? [ink(mesh(LIMB, mats.leg, 0, 0, 0, 0.1)), mesh(LIMB, mats.leg, 0, 0, 0, 0.072)] : [ink(mesh(LIMB, mats.leg, 0, 0, 0, 0.16)), mesh(LIMB, mats.leg, 0, 0, 0, 0.082), mesh(LIMB, mats.leg, 0, 0, 0, 0.062)];
    for (const p of parts) lift.add(p);
    const paw = mesh(SPH, mats.pale, 0, 0, 0, 0.1, 0.055, 0.085);
    lift.add(paw);
    legs.push({ front, side, parts, paw, r: parts.map((p) => p.scale.x) });
  }
  // The tail: a tube along a chain of joints.
  const tailGeo = tubeGeometry(TAIL_N + 1, TAIL_SIDES);
  const tailMesh = ink(new THREE.Mesh(tailGeo, mats.fur));
  tailMesh.castShadow = true;
  tailMesh.frustumCulled = false;
  lift.add(tailMesh);
  // Where she'll land: a paw print pulsing red.
  const strikeLine = decal(pawTexture(), new THREE.Color(PALETTE.knife), 1.6, 0, true);
  strikeLine.visible = false;
  const strikeGlow = decal(glowTexture(), new THREE.Color(PALETTE.knife), 2.4, 0, true);
  strikeGlow.visible = false;
  const contact = decal(glowTexture(), new THREE.Color(0x000000), 2.6, 0.5);
  contact.position.y = 0.011;
  const zs = [0, 1, 2].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zzzTexture(), transparent: true, depthWrite: false }));
    s.visible = false;
    return s;
  });
  return {
    root, lift, body, bodyGeo, neck, ruff, head, jaw, ears, eyes, legs, tailGeo, mats, strikeLine, strikeGlow, contact, eyeGlow, zs,
    cur: new Float32Array(P_LEN),
    tgt: new Float32Array(P_LEN),
    fresh: true,
    gait: 0, mv: 0, stride: 0.56, liftH: 0.1, stalkK: 0.4, tailFreq: 1.6, earSwivel: 0,
    mode: '', modeT: 0, px: NaN, pz: NaN, speed: 0, landedSeq: -1, wig: 0,
    // Scratch, so the frame allocates nothing.
    sp: new Float32Array(SP * 3),
    rc: new Float32Array(3),
    rt: new Float32Array(3),
    tp: new Float32Array((TAIL_N + 1) * 3),
  };
}

export function addCat(group, model) {
  group.add(model.root, model.strikeLine, model.strikeGlow, model.contact, ...model.zs);
}

// ---------------------------------------------------------------- target poses

function spine(t, pts) {
  for (let i = 0; i < SP * 3; i++) t[P_SPINE + i] = pts[i];
}
function setHead(t, x, y, z, yaw, pitch, roll = 0) {
  t[P_HEAD] = x;
  t[P_HEAD + 1] = y;
  t[P_HEAD + 2] = z;
  t[P_HEAD + 3] = yaw;
  t[P_HEAD + 4] = pitch;
  t[P_HEAD + 5] = roll;
}
function paws(t, fx, fz, bx, bz, fy = 0, by = 0) {
  t[P_FPAW] = fx;
  t[P_FPAW + 1] = fy;
  t[P_FPAW + 2] = -fz;
  t[P_FPAW + 3] = fx;
  t[P_FPAW + 4] = fy;
  t[P_FPAW + 5] = fz;
  t[P_BPAW] = bx;
  t[P_BPAW + 1] = by;
  t[P_BPAW + 2] = -bz;
  t[P_BPAW + 3] = bx;
  t[P_BPAW + 4] = by;
  t[P_BPAW + 5] = bz;
}
function rest(t, hdx, hdy, tp0, tdp, ty0, tdy, wave, earBack, earOut, open, pupil, jaw = 0, squash = 1) {
  t[P_HOCK] = hdx;
  t[P_HOCK + 1] = hdy;
  t[P_TAIL] = tp0;
  t[P_TAIL + 1] = tdp;
  t[P_TAIL + 2] = ty0;
  t[P_TAIL + 3] = tdy;
  t[P_TAIL + 4] = wave;
  t[P_EAR] = earBack;
  t[P_EAR + 1] = earOut;
  t[P_EYE] = open;
  t[P_EYE + 1] = pupil;
  t[P_JAW] = jaw;
  t[P_SQUASH] = squash;
}

const STAND = [-0.8, 0.66, 0, -0.56, 0.72, 0, -0.16, 0.73, 0, 0.2, 0.72, 0, 0.5, 0.77, 0, 0.7, 0.74, 0];
const STALK = [-0.8, 0.5, 0, -0.58, 0.54, 0, -0.2, 0.5, 0, 0.16, 0.45, 0, 0.46, 0.5, 0, 0.66, 0.44, 0];
const SIT = [-0.48, 0.24, 0, -0.38, 0.32, 0, -0.14, 0.48, 0, 0.08, 0.62, 0, 0.26, 0.74, 0, 0.38, 0.79, 0];
const LOAF = [-0.78, 0.3, 0, -0.56, 0.34, 0, -0.16, 0.34, 0, 0.2, 0.34, 0, 0.5, 0.38, 0, 0.7, 0.38, 0];
const BOW = [-0.74, 0.74, 0, -0.52, 0.78, 0, -0.14, 0.66, 0, 0.2, 0.48, 0, 0.48, 0.36, 0, 0.66, 0.31, 0];
const CROUCH = [-0.66, 0.44, 0, -0.48, 0.48, 0, -0.12, 0.38, 0, 0.2, 0.3, 0, 0.46, 0.3, 0, 0.66, 0.3, 0];
const LEAP = [-0.86, -0.62, -0.2, 0.22, 0.56, 0.8];
const POUNCE = [-0.76, 0.66, 0, -0.54, 0.66, 0, -0.16, 0.52, 0, 0.2, 0.38, 0, 0.48, 0.34, 0, 0.68, 0.3, 0];
const CURL = new Float32Array(SP * 3);
const CURL_R = 0.34;
const CURL_A0 = 1.1;
const CURL_DA = 0.8;
for (let i = 0; i < SP; i++) {
  const a = CURL_A0 + i * CURL_DA;
  CURL[i * 3] = Math.cos(a) * CURL_R;
  CURL[i * 3 + 1] = 0.25;
  CURL[i * 3 + 2] = Math.sin(a) * CURL_R;
}
const curlAt = (k, r, t, i) => {
  t[i] = Math.cos(CURL_A0 + k * CURL_DA) * r;
  t[i + 2] = Math.sin(CURL_A0 + k * CURL_DA) * r;
};

// The pose this mode wants now. look: the head's turn toward what she heard.
function targetPose(model, h, mt, now, reduced, look) {
  const t = model.tgt;
  const m = h.m;
  const live = !reduced;
  if (m === 'sleep') {
    spine(t, CURL);
    const breathe = live ? Math.sin(now * 2.1) * 0.012 : 0;
    for (let i = 0; i < SP; i++) t[P_SPINE + i * 3 + 1] += breathe;
    // Head tucked on the floor by her rump, nose to her tail.
    const ah = CURL_A0 + (SP - 1) * CURL_DA + 0.75;
    setHead(t, Math.cos(ah) * 0.4, 0.2, Math.sin(ah) * 0.4, Math.atan2(-Math.cos(ah), -Math.sin(ah)), 0.35, -0.45);
    paws(t, 0, 0, 0, 0, 0.04, 0.04);
    curlAt(4.3, 0.12, t, P_FPAW);
    curlAt(4.7, 0.18, t, P_FPAW + 3);
    curlAt(0.6, 0.1, t, P_BPAW);
    curlAt(1.1, 0.12, t, P_BPAW + 3);
    // The tail runs on round the outside of the curl to her nose.
    rest(t, -0.18, 0.05, -0.35, 0.18, Math.PI - 0.1, -0.17, 0, 0.35, 0.5, 0, 0.3, 0, 1);
    return;
  }
  if (m === 'rest') {
    spine(t, LOAF);
    setHead(t, 0.94, 0.66, 0, look * 0.4, 0.05);
    paws(t, 0.5, 0.1, -0.36, 0.17, 0.02, 0.02);
    rest(t, -0.24, 0.04, -0.9, 0.3, Math.PI + 0.3, 0.2, 0.05, 0.1, 0.2, 0.35 + (live ? 0.25 * Math.sin(now * 0.8) : 0), 0.3);
    return;
  }
  if (m === 'wake' && mt < 0.85) {
    // A play-bow stretch with a yawn, then up to sit.
    spine(t, BOW);
    setHead(t, 0.92, 0.5, 0, 0, -0.45);
    paws(t, 1.0, 0.12, -0.5, 0.15);
    const yawn = live ? Math.sin(clamp01((mt - 0.1) / 0.65) * Math.PI) : 0;
    rest(t, -0.08, 0.2, 1.25, -0.05, Math.PI, 0, 0, 0.25, 0.2, 0.25, 0.25, yawn * 0.7, 1);
    return;
  }
  if (m === 'listen' || m === 'wake') {
    spine(t, SIT);
    const swing = live ? Math.sin(now * 0.9) * 0.12 : 0;
    setHead(t, 0.56, 1.03, 0, Math.max(-0.9, Math.min(0.9, look)) * 0.75 + swing, -0.12, live ? Math.sin(now * 0.6) * 0.06 : 0);
    paws(t, 0.42, 0.1, -0.02, 0.17);
    rest(t, -0.27, 0.0, -1.35, 0.32, Math.PI - 0.5, 0.26, live ? 0.05 : 0, 0, 0, 1, 0.45);
    return;
  }
  if (m === 'crouch') {
    // Low, back feet gathered under her, the rump up and wiggling, eyes locked on.
    spine(t, CROUCH);
    const wig = live ? Math.sin(model.wig) * 0.07 : 0;
    t[P_SPINE + 2] = wig;
    t[P_SPINE + 5] = wig * 0.8;
    t[P_SPINE + 8] = wig * 0.3;
    setHead(t, 0.86, 0.38, 0, 0, 0.05);
    paws(t, 0.72, 0.12, -0.26, 0.17);
    rest(t, -0.2, 0.08, -0.05, 0, Math.PI, 0, 0.1, 0.55, 0.4, 1, 0.9, 0, 0.94);
    return;
  }
  if (m === 'leap' && h.ch) {
    const span = Math.max(0.05, h.ch.at - h.t);
    const u = clamp01((now - h.t) / span);
    // Stretched long, nose up off the floor and down onto the target, front paws reaching, back legs pushing off.
    const pitch = lerp(0.42, -0.5, smooth(u));
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    for (let i = 0; i < SP; i++) {
      t[P_SPINE + i * 3] = LEAP[i] * c;
      t[P_SPINE + i * 3 + 1] = 0.62 + LEAP[i] * s;
      t[P_SPINE + i * 3 + 2] = 0;
    }
    setHead(t, 1.06 * c - 0.1 * s, 0.62 + 1.06 * s + 0.1 * c, 0, 0, -pitch * 0.6);
    const r = lerp(1.25, 0.95, u);
    paws(t, r * c + 0.25 * s, 0.1, -1.05 * c + 0.2 * s, 0.15, 0.62 + r * s - 0.25 * c, 0.62 - 1.05 * s - 0.2 * c);
    rest(t, -0.3, 0.05, 0.1 - pitch * 0.3, -0.01, Math.PI, 0, 0, 0.75, 0.3, 1, 1, 0.35, 0.95);
    return;
  }
  if (m === 'land') {
    const u = clamp01(mt / HUNTER.cat.land);
    // Front paws pinned together on the spot, shoulders down, rump coming down after.
    spine(t, POUNCE);
    setHead(t, 0.86, 0.42, 0, 0, 0.35);
    paws(t, 0.72, 0.06, -0.42, 0.16);
    rest(t, -0.12, 0.18, 0.5, -0.1, Math.PI, 0, 0.35, 0.3, 0.2, 1, 0.8, 0, u < 0.25 ? 0.86 : 1);
    return;
  }
  // Walking or roaming (and standing).
  if (m === 'stalk') {
    spine(t, STALK);
    setHead(t, 0.92, 0.52, 0, look * 0.15, 0.12);
    paws(t, 0.6, 0.12, -0.48, 0.15);
    rest(t, -0.14, 0.12, -0.2, 0.02, Math.PI, 0, 0.18, 0.2, 0.15, 1, 0.65);
  } else {
    spine(t, STAND);
    setHead(t, 0.98, 1.05, 0, look * 0.35, 0.05);
    paws(t, 0.55, 0.13, -0.52, 0.15);
    rest(t, -0.06, 0.2, 1.05, -0.13, Math.PI, 0, 0.1, 0, 0, 1, 0.3);
  }
}

// ---------------------------------------------------------------- building the frame

// Catmull-Rom through the spine points, by chord length: position and unit tangent at s in [0, 1].
const SEG = new Float32Array(SP);
function spineAt(sp, s, out, tan) {
  const d = s * SEG[SP - 1];
  let i = 0;
  while (i < SP - 2 && SEG[i + 1] < d) i++;
  const len = Math.max(1e-5, SEG[i + 1] - SEG[i]);
  const u = clamp01((d - SEG[i]) / len);
  const i0 = Math.max(0, i - 1);
  const i3 = Math.min(SP - 1, i + 2);
  const u2 = u * u;
  const u3 = u2 * u;
  for (let k = 0; k < 3; k++) {
    const p1 = sp[i * 3 + k];
    const p2 = sp[(i + 1) * 3 + k];
    const p0 = i0 === i ? 2 * p1 - p2 : sp[i0 * 3 + k];
    const p3 = i3 === i + 1 ? 2 * p2 - p1 : sp[i3 * 3 + k];
    out[k] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3);
    tan[k] = 0.5 * (-p0 + p2 + 2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * u + 3 * (-p0 + 3 * p1 - 3 * p2 + p3) * u2);
  }
  const l = Math.hypot(tan[0], tan[1], tan[2]) || 1;
  tan[0] /= l;
  tan[1] /= l;
  tan[2] /= l;
}

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const vS = new THREE.Vector3();
const vD = new THREE.Vector3();
const vE = new THREE.Vector3();
const jA = new THREE.Vector3();
const jB = new THREE.Vector3();
const jC = new THREE.Vector3();
const jD = new THREE.Vector3();
const jHint = new THREE.Vector3();
const cC = new THREE.Vector3();
const cT = new THREE.Vector3();
const cN = new THREE.Vector3();
const cB = new THREE.Vector3();

// A frame at spine parameter s: centre c, tangent t, up n, side b (+z when she faces +x).
function frameAt(model, s) {
  spineAt(model.sp, s, model.rc, model.rt);
  cC.set(model.rc[0], model.rc[1], model.rc[2]);
  cT.set(model.rt[0], model.rt[1], model.rt[2]);
  cN.copy(UP).addScaledVector(cT, -cT.y);
  if (cN.lengthSq() < 1e-4) cN.set(-cT.x, 0, -cT.z);
  cN.normalize();
  cB.crossVectors(cT, cN);
}

// Point a limb mesh from joint a to joint b.
function limb(m, a, b, r, rz = r) {
  vS.subVectors(b, a);
  const len = Math.max(0.02, vS.length());
  vS.divideScalar(len);
  m.position.copy(a);
  m.quaternion.setFromUnitVectors(DOWN, vS);
  m.scale.set(r, len, rz);
}

// Two-bone reach from a toward target, bone lengths l1 and l2, bending toward hint: the middle joint into mid, the end
// (the target, or as near as the bones reach) into end.
function reach(a, target, l1, l2, hint, mid, end) {
  vD.subVectors(target, a);
  let d = vD.length();
  if (d < 1e-5) vD.set(0, -1, 0);
  else vD.divideScalar(d);
  d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min((l1 + l2) * 0.998, d));
  vE.copy(hint).addScaledVector(vD, -hint.dot(vD));
  if (vE.lengthSq() < 1e-6) vE.set(0, 1, 0).addScaledVector(vD, -vD.y);
  vE.normalize();
  const x = (l1 * l1 + d * d - l2 * l2) / (2 * d);
  const y = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  mid.copy(a).addScaledVector(vD, x).addScaledVector(vE, y);
  end.copy(a).addScaledVector(vD, d);
}

function build(model, now, live) {
  const cur = model.cur;
  const sp = model.sp;
  for (let i = 0; i < SP * 3; i++) sp[i] = cur[P_SPINE + i];
  // A walking cat's spine: the shoulder blades roll up with each front step, the hips sway.
  const mv = model.mv;
  if (mv > 0.01 && live) {
    const g = model.gait * Math.PI * 2;
    sp[4 * 3 + 1] += Math.abs(Math.sin(g)) * 0.035 * mv * model.stalkK;
    sp[1 * 3 + 2] += Math.sin(g) * 0.025 * mv;
    sp[2] += Math.sin(g) * 0.035 * mv;
    sp[2 * 3 + 1] += Math.sin(g * 2) * 0.012 * mv;
  }
  SEG[0] = 0;
  for (let i = 1; i < SP; i++) SEG[i] = SEG[i - 1] + Math.hypot(sp[i * 3] - sp[i * 3 - 3], sp[i * 3 + 1] - sp[i * 3 - 2], sp[i * 3 + 2] - sp[i * 3 - 1]);
  // The body.
  const pos = model.bodyGeo.attributes.position.array;
  const nor = model.bodyGeo.attributes.normal.array;
  const sq = cur[P_SQUASH];
  const wide = sq < 1 ? 1 + (1 - sq) * 0.6 : 1;
  for (let j = 0; j < RINGS; j++) {
    frameAt(model, RING_S[j]);
    const hh = ringH[j] * sq;
    const ww = ringW[j] * wide;
    const ih = 1 / Math.max(0.05, hh);
    const iw = 1 / Math.max(0.05, ww);
    const cx = cC.x + cN.x * ringD[j];
    const cy = cC.y + cN.y * ringD[j];
    const cz = cC.z + cN.z * ringD[j];
    const endN = j === 0 ? -1 : j === RINGS - 1 ? 1 : 0;
    for (let k = 0; k <= SIDES; k++) {
      const co = COS[k];
      const si = SIN[k];
      const o = (j * (SIDES + 1) + k) * 3;
      pos[o] = cx + cN.x * hh * co + cB.x * ww * si;
      pos[o + 1] = cy + cN.y * hh * co + cB.y * ww * si;
      pos[o + 2] = cz + cN.z * hh * co + cB.z * ww * si;
      let nx = cN.x * co * ih + cB.x * si * iw;
      let ny = cN.y * co * ih + cB.y * si * iw;
      let nz = cN.z * co * ih + cB.z * si * iw;
      let l = Math.hypot(nx, ny, nz) || 1;
      if (endN) {
        nx = (nx / l) * 0.3 + cT.x * endN;
        ny = (ny / l) * 0.3 + cT.y * endN;
        nz = (nz / l) * 0.3 + cT.z * endN;
        l = Math.hypot(nx, ny, nz) || 1;
      }
      nor[o] = nx / l;
      nor[o + 1] = ny / l;
      nor[o + 2] = nz / l;
    }
  }
  model.bodyGeo.attributes.position.needsUpdate = true;
  model.bodyGeo.attributes.normal.needsUpdate = true;
  // Head, neck and ruff.
  const hx = cur[P_HEAD];
  const hy = cur[P_HEAD + 1];
  const hz = cur[P_HEAD + 2];
  model.head.position.set(hx, hy, hz);
  model.head.rotation.set(cur[P_HEAD + 5], cur[P_HEAD + 3], -cur[P_HEAD + 4], 'YZX');
  frameAt(model, 0.94);
  jA.copy(cC).addScaledVector(cN, 0.02);
  jB.set(hx, hy, hz).addScaledVector(cT, -0.1);
  limb(model.neck, jA, jB, 0.2, 0.19);
  model.ruff.position.copy(cC).addScaledVector(cN, -0.12).addScaledVector(cT, 0.1);
  // Legs.
  for (const L of model.legs) {
    const base = L.front ? P_FPAW : P_BPAW;
    const pi = L.side < 0 ? 0 : 3;
    let px = cur[base + pi];
    let py = cur[base + pi + 1];
    const pz = cur[base + pi + 2];
    // The walk: each paw plants and pushes back, then lifts and swings forward (left back, left front, right back, right
    // front), by distance so the paws never skate.
    if (mv > 0.01) {
      const ph = (model.gait + (L.front ? 0.25 : 0) + (L.side > 0 ? 0.5 : 0)) % 1;
      const stride = model.stride * mv;
      if (ph < 0.64) px += stride * (0.5 - ph / 0.64);
      else {
        const u = (ph - 0.64) / 0.36;
        px += stride * (u - 0.5);
        py += Math.sin(u * Math.PI) * model.liftH * mv;
      }
    }
    if (L.front) {
      frameAt(model, 0.8);
      jA.copy(cC).addScaledVector(cN, -0.12).addScaledVector(cB, L.side * 0.12);
      jD.set(px, py + 0.05, pz);
      jHint.copy(cT).negate().addScaledVector(cN, -0.2);
      reach(jA, jD, 0.3, 0.36, jHint, jB, jC);
      limb(L.parts[0], jA, jB, L.r[0]);
      limb(L.parts[1], jB, jC, L.r[1]);
    } else {
      frameAt(model, 0.15);
      jA.copy(cC).addScaledVector(cN, -0.07).addScaledVector(cB, L.side * 0.14);
      jD.set(px + cur[P_HOCK], py + 0.05 + cur[P_HOCK + 1], pz);
      jHint.copy(cT).addScaledVector(cN, 0.3);
      reach(jA, jD, 0.33, 0.3, jHint, jB, jC);
      limb(L.parts[0], jA, jB, L.r[0]);
      limb(L.parts[1], jB, jC, L.r[1]);
      jD.set(px, py + 0.05, pz);
      limb(L.parts[2], jC, jD, L.r[2]);
      jC.copy(jD);
    }
    L.paw.position.set(jC.x + 0.035, Math.max(0.05, jC.y - 0.005), jC.z);
  }
  // The tail: from the top of the rump, joint by joint. Its yaw is measured from straight back along her rump.
  frameAt(model, 0.03);
  const tp = model.tp;
  tp[0] = cC.x + cN.x * 0.13;
  tp[1] = cC.y + cN.y * 0.13;
  tp[2] = cC.z + cN.z * 0.13;
  const p0 = cur[P_TAIL];
  const dp = cur[P_TAIL + 1];
  const y0 = cur[P_TAIL + 2] + Math.atan2(cT.z, cT.x);
  const dy = cur[P_TAIL + 3];
  const wave = cur[P_TAIL + 4];
  const wf = model.tailFreq;
  for (let i = 1; i <= TAIL_N; i++) {
    const u = i / TAIL_N;
    let pitch = p0 + dp * (i - 1);
    if (p0 < 0 && pitch > 0.05) pitch = 0.05;
    const yaw = y0 + dy * (i - 1) + (live ? Math.sin(now * wf - i * 0.55) * wave * u * u * 2.2 : 0);
    const c = Math.cos(pitch);
    const o = i * 3;
    tp[o] = tp[o - 3] + Math.cos(yaw) * c * TAIL_SEG;
    tp[o + 1] = Math.max(0.06, tp[o - 2] + Math.sin(pitch) * TAIL_SEG);
    tp[o + 2] = tp[o - 1] + Math.sin(yaw) * c * TAIL_SEG;
  }
  tailTube(model);
  // Ears, eyes, jaw.
  const earBack = cur[P_EAR];
  const earOut = cur[P_EAR + 1];
  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const swivel = live ? model.earSwivel * Math.sin(now * 2.3 + i * 1.9) : 0;
    model.ears[i].rotation.set(side * (0.3 + earOut * 0.6), side * (swivel - earBack * 0.4), -0.05 + earBack * 0.9, 'YXZ');
  }
  const open = cur[P_EYE];
  const blink = live && open > 0.5 && now % 4.1 < 0.12 ? 0.1 : 1;
  const o = Math.max(0.08, open * blink);
  for (const { eye, pupil } of model.eyes) {
    eye.scale.y = 0.05 * o;
    pupil.scale.z = 0.18 + 0.6 * cur[P_EYE + 1];
  }
  const lit = clamp01((o - 0.08) * 4);
  model.mats.eye.color.setRGB(lerp(0.18, 0.85, lit), lerp(0.08, 1, lit), lerp(0.03, 0.35, lit));
  model.eyeGlow.material.opacity = clamp01((o - 0.15) * 1.2) * (0.35 + 0.55 * cur[P_EYE + 1]);
  model.jaw.rotation.z = -cur[P_JAW];
}

const tT = new THREE.Vector3();
const tN = new THREE.Vector3();
const tB = new THREE.Vector3();
function tailTube(model) {
  const tp = model.tp;
  const pos = model.tailGeo.attributes.position.array;
  const nor = model.tailGeo.attributes.normal.array;
  for (let i = 0; i <= TAIL_N; i++) {
    const a = Math.max(0, i - 1) * 3;
    const b = Math.min(TAIL_N, i + 1) * 3;
    tT.set(tp[b] - tp[a], tp[b + 1] - tp[a + 1], tp[b + 2] - tp[a + 2]).normalize();
    tN.crossVectors(tT, UP);
    if (tN.lengthSq() < 1e-4) tN.set(0, 0, 1);
    tN.normalize();
    tB.crossVectors(tN, tT);
    const u = i / TAIL_N;
    const r = (0.074 - 0.022 * u) * (i === TAIL_N ? 0.25 : i === TAIL_N - 1 ? 0.8 : 1) * (i === 0 ? 0.85 : 1);
    for (let k = 0; k <= TAIL_SIDES; k++) {
      const ang = (k / TAIL_SIDES) * Math.PI * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const nx = tB.x * c + tN.x * s;
      const ny = tB.y * c + tN.y * s;
      const nz = tB.z * c + tN.z * s;
      const o = (i * (TAIL_SIDES + 1) + k) * 3;
      pos[o] = tp[i * 3] + nx * r;
      pos[o + 1] = tp[i * 3 + 1] + ny * r;
      pos[o + 2] = tp[i * 3 + 2] + nz * r;
      nor[o] = nx;
      nor[o + 1] = ny;
      nor[o + 2] = nz;
    }
  }
  model.tailGeo.attributes.position.needsUpdate = true;
  model.tailGeo.attributes.normal.needsUpdate = true;
}

// ---------------------------------------------------------------- posing

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
  const leap = h.m === 'leap';
  const crouch = h.m === 'crouch';
  const land = h.m === 'land';
  const stalk = h.m === 'stalk';
  const walking = (stalk || h.m === 'roam') && speed > 0.15;
  model.mv += ((walking ? 1 : 0) - model.mv) * Math.min(1, dt * 6);
  model.stride = stalk ? 0.42 : 0.56;
  model.liftH = stalk ? 0.13 : 0.1;
  model.stalkK = stalk ? 1 : 0.4;
  model.gait = (model.gait + (walking ? (speed * dt) / (model.stride * 1.15) : 0)) % 1;
  model.tailFreq = crouch ? 15 : stalk ? 3.2 : land ? 5 : 1.6;
  model.earSwivel = h.m === 'listen' ? 0.35 : h.m === 'rest' ? 0.15 : 0;
  if (crouch) model.wig += dt * 24;
  // Leap: an arc from where she crouched to where she lands.
  let arc = 0;
  if (leap && h.ch) {
    const span = Math.max(0.05, h.ch.at - h.t);
    const u = clamp01((now - h.t) / span);
    arc = Math.sin(u * Math.PI) * Math.min(1.5, 0.45 + span * 2.2);
  }
  model.lift.position.y = arc;
  // What she's looking at, as a turn of her head.
  const d = Math.atan2(h.tz - h.z, h.tx - h.x) - h.a;
  const look = Number.isFinite(d) ? -Math.atan2(Math.sin(d), Math.cos(d)) : 0;
  targetPose(model, h, mt, now, reduced, look);
  // Ease toward it: quick into a crouch and through the air, slower into sleep.
  const rate = leap ? 26 : crouch ? 18 : land ? 14 : h.m === 'sleep' ? 3 : 7;
  const k = model.fresh || dt <= 0 ? 1 : 1 - Math.exp(-dt * rate);
  model.fresh = false;
  for (let i = 0; i < P_LEN; i++) model.cur[i] += (model.tgt[i] - model.cur[i]) * k;
  build(model, now, !reduced);
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
    fx?.dust(h.x, h.z, 14, h.a, 1.4);
  }
  model.contact.scale.setScalar(1 - Math.min(0.5, arc * 0.3));
  model.contact.material.opacity = 0.5 - Math.min(0.3, arc * 0.2);
  // Zzz while she sleeps.
  const asleep = h.m === 'sleep';
  model.zs.forEach((s, i) => {
    s.visible = asleep && !reduced;
    if (!s.visible) return;
    const u = ((now * 0.45 + i / 3) % 1 + 1) % 1;
    s.position.set(h.x + Math.sin(u * 6 + i) * 0.15, 0.8 + u * 1.4, h.z);
    s.scale.setScalar(0.25 + u * 0.35);
    s.material.opacity = Math.sin(u * Math.PI) * 0.9;
  });
}
