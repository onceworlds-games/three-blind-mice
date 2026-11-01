// The farmer's wife and the farmer, at mouse height: giants seen from the knees down. Feet that plant and step (her felt
// slippers with pompoms, his rubber boots), shins and a skirt that fade out going up, her brass lantern swinging on a
// pendulum, his torch, a "?" when they hear and a "!" when they see. Her carving knife comes down out of the dark with its
// shadow sharpening on the floor; he stamps. No allocations in the frame.

import * as THREE from 'three';
import { patchEcho, PALETTE } from './echo.js';
import { pbr, prop, propParts } from './assets.js';
import { stockingTexture, knifeTexture, bootTexture, furTexture } from './textures.js';
import { HUNTER, lanternOf } from '../core/hunters.js';
import { decal, glowTexture } from './mouse.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const SPH = new THREE.SphereGeometry(1, 20, 14);
const SPH_LO = new THREE.SphereGeometry(1, 10, 7);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const UP = new THREE.Vector3(0, 1, 0);

function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = shadow;
  return m;
}

// Black at the top, white below: what fades a shin or a skirt into the dark above.
const fades = new Map();
function fadeTexture(solid, clear) {
  const key = `${solid}:${clear}`;
  if (fades.has(key)) return fades.get(key);
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
  const t = new THREE.CanvasTexture(c);
  fades.set(key, t);
  return t;
}

let poolTex = null;
function poolTexture() {
  if (poolTex) return poolTex;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 40, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,0.0)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.08)');
  grad.addColorStop(0.95, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  poolTex = new THREE.CanvasTexture(c);
  return poolTex;
}

// A speech-bubble mark: "?" (amber) or "!" (red).
const marks = new Map();
function markTexture(glyph, color) {
  if (marks.has(glyph)) return marks.get(glyph);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(12,13,24,0.86)';
  g.beginPath();
  g.arc(64, 58, 46, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(52, 98);
  g.lineTo(64, 122);
  g.lineTo(76, 98);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = color;
  g.beginPath();
  g.arc(64, 58, 46, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = color;
  g.font = `900 72px "Alfa Slab One", Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(glyph, 64, 62);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  marks.set(glyph, t);
  return t;
}

function knifeGeometry() {
  const s = new THREE.Shape();
  // The heel at y = 0 (the handle meets it), the point at y = 2.6.
  s.moveTo(-0.08, 0);
  s.lineTo(0.34, 0);
  s.quadraticCurveTo(0.44, 1.7, 0, 2.6);
  s.quadraticCurveTo(-0.12, 1.4, -0.08, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.025, bevelSegments: 2 });
  g.translate(-0.13, 0, -0.018);
  return g;
}

// A felt slipper: a soft upper over a sole, the toe rounded, a pompom on top. Points along +x, sole at y = 0.
function slipperParts(mats, B) {
  const g = new THREE.Group();
  const upper = new THREE.SphereGeometry(1, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.62);
  g.add(mesh(upper, mats.slipper, 0.18, 0.06, 0, 0.86, 0.5, 0.38));
  g.add(mesh(new THREE.CylinderGeometry(1, 1, 1, 22), mats.sole, 0.18, 0.06, 0, 0.88, 0.1, 0.4));
  // The cuff where her foot goes in, and the pompom.
  const cuff = mesh(new THREE.TorusGeometry(0.26, 0.07, 8, 18), mats.cuff, -0.2, 0.42, 0, 1, 1, 1);
  cuff.rotation.x = Math.PI / 2;
  g.add(cuff);
  g.add(mesh(SPH, mats.pompom, 0.62, 0.45, 0, 0.17 * B, 0.15 * B, 0.17 * B));
  return g;
}

// A rubber boot from the Poly Haven pair, centred on its own footprint, pointing along +x.
function bootParts(side) {
  const parts = propParts('rubber_boots');
  if (!parts) return null;
  const part = parts.find((p) => p.name.endsWith(side < 0 ? '_l' : '_r')) ?? parts[0];
  const g = part.geometry.clone();
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.rotateY(-Math.PI / 2);
  const mat = part.material.clone();
  patchEcho(mat, { rim: 0.25 });
  return { geometry: g, material: mat, size: new THREE.Vector3(b.max.z - b.min.z, b.max.y - b.min.y, b.max.x - b.min.x) };
}

export function createHuman(kind) {
  const farmer = kind === 'farmer';
  const c = HUNTER[kind];
  const mats = {
    slipper: patchEcho(pbr('cloth_plaid', { color: 0xb04050 }), { rim: 0.3 }),
    sole: patchEcho(std(0x2a1d16, { roughness: 1 })),
    cuff: patchEcho(pbr('cloth_plaid', { color: 0xf0e2c8 }), { rim: 0.2 }),
    pompom: patchEcho(std(0xfff4e0, { map: furTexture(), roughness: 1 }), { rim: 0.4 }),
    leg: patchEcho(std(0xffffff, { roughness: 0.9, map: farmer ? null : stockingTexture(), color: farmer ? 0x4a5468 : 0xffffff, transparent: true, alphaMap: fadeTexture(0.6, 0.15) }), { rim: 0.2 }),
    skirt: patchEcho(pbr(farmer ? 'cloth_hessian' : 'cloth_red', { color: farmer ? 0x5a6478 : 0xb05868, side: THREE.DoubleSide, transparent: true, depthWrite: false, alphaMap: fadeTexture(0.75, 0.3) }), { rim: 0.15 }),
    hem: patchEcho(std(0xf2e6cc, { roughness: 0.9, side: THREE.DoubleSide, transparent: true }), { rim: 0.3 }),
    brass: std(0xc08a2e, { roughness: 0.32, metalness: 0.9 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffd090, toneMapped: false }),
    glass: new THREE.MeshStandardMaterial({ color: 0xffc070, emissive: 0xff8a2a, emissiveIntensity: 2.4, transparent: true, opacity: 0.9, roughness: 0.2 }),
    steel: std(0xdfe4ec, { roughness: 0.18, metalness: 0.6, emissive: 0x2a2e36 }),
    handle: patchEcho(pbr('wood_dark', { color: 0x8a5a3a })),
    rivet: std(0xd8d0c0, { roughness: 0.3, metalness: 0.8 }),
    skin: patchEcho(std(0xe8b898, { roughness: 0.7, emissive: 0x3a1608 }), { rim: 0.2 }),
    sleeve: patchEcho(pbr('cloth_hessian', { color: farmer ? 0x6a7a5a : 0xe8dcc8, transparent: true, depthWrite: false, emissive: 0x2a1408, alphaMap: fadeTexture(0.55, 0.05) }), { rim: 0.2 }),
  };
  mats.leg.depthWrite = false;
  const root = new THREE.Group(); // feet and shins are in world space
  const body = new THREE.Group(); // the skirt, the hand: follows the hunter
  root.add(body);
  // ---- feet
  const feet = [];
  const boots = farmer ? [bootParts(-1), bootParts(1)] : null;
  for (const side of [-1, 1]) {
    const foot = new THREE.Group();
    const pivot = new THREE.Group(); // toe-off and heel-strike roll about the heel
    foot.add(pivot);
    const b = boots?.[side < 0 ? 0 : 1];
    if (b) {
      const s = 1.75 / b.size.x;
      const m = new THREE.Mesh(b.geometry, b.material);
      m.scale.setScalar(s);
      m.position.x = 0.15;
      m.castShadow = true;
      pivot.add(m);
    } else if (farmer) {
      pivot.add(mesh(SPH, mats.sole, 0.2, 0.35, 0, 0.95, 0.38, 0.42));
    } else pivot.add(slipperParts(mats, 1));
    root.add(foot);
    // The shin: a tapered tube from the ankle up into the skirt.
    const shinGeo = new THREE.CylinderGeometry(farmer ? 0.4 : 0.27, farmer ? 0.36 : 0.2, 1, 16, 1, true);
    shinGeo.translate(0, 0.5, 0);
    const shin = new THREE.Mesh(shinGeo, mats.leg);
    shin.castShadow = true;
    shin.renderOrder = 2;
    root.add(shin);
    feet.push({ side, foot, pivot, shin, x: 0, z: 0, y: 0, a: 0, sx: 0, sz: 0, sa: 0, step: -1, dur: 0.4, roll: 0 });
  }
  // ---- the skirt (or his coat tails): an open cone with a hem that sways
  const SK = 28;
  const skirtGeo = new THREE.CylinderGeometry(farmer ? 1.2 : 1.5, farmer ? 1.3 : 1.8, 1.5, SK, 3, true);
  skirtGeo.translate(0, 0.75, 0);
  const skirtBase = Float32Array.from(skirtGeo.attributes.position.array);
  const skirt = new THREE.Mesh(skirtGeo, mats.skirt);
  skirt.position.y = farmer ? 2.9 : 2.3;
  skirt.renderOrder = 2;
  skirt.visible = false; // seen from above a skirt reads as a glass jar: the legs and the lantern say enough
  body.add(skirt);
  const hem = null;
  // ---- the hand with the lantern (or the torch)
  const hand = new THREE.Group();
  body.add(hand);
  const sleeve = mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.9, 14, 1, true), mats.sleeve, -0.02, 0.5, 0, 1, 1, 1, false);
  hand.add(sleeve);
  hand.add(mesh(SPH, mats.skin, 0, 0.0, 0, 0.26, 0.22, 0.24, false));
  const lamp = new THREE.Group();
  hand.add(lamp);
  const lampLight = new THREE.Object3D(); // where the light comes from, inside the lamp
  lamp.add(lampLight);
  if (!farmer) {
    const lp = prop('Lantern_01');
    if (lp) {
      const s = 1.15 / lp.userData.size.y;
      lp.scale.setScalar(s);
      lp.position.y = -1.2;
      lp.traverse((o) => {
        if (!o.isMesh) return;
        if (/glass/i.test(o.material.name)) o.material = mats.glass;
        else {
          o.material = o.material.clone();
          patchEcho(o.material, { rim: 0.3 });
        }
        o.castShadow = false;
      });
      lamp.add(lp);
      lampLight.position.y = -1.2 + 1.15 * 0.33;
    } else {
      lamp.add(mesh(CYL, mats.glass, 0, -0.75, 0, 0.17, 0.5, 0.17, false));
      lampLight.position.y = -0.75;
    }
    lamp.add(mesh(SPH_LO, mats.flame, 0, lampLight.position.y, 0, 0.05, 0.1, 0.05, false));
  } else {
    const torch = new THREE.Group();
    torch.add(mesh(CYL, mats.steel, 0, 0, 0, 0.11, 0.8, 0.11));
    torch.add(mesh(new THREE.CylinderGeometry(1, 0.7, 1, 16), mats.steel, 0, 0.5, 0, 0.17, 0.22, 0.17));
    torch.add(mesh(CYL, mats.flame, 0, 0.62, 0, 0.15, 0.02, 0.15, false));
    torch.rotation.z = -Math.PI / 2;
    torch.position.set(0.3, -0.05, 0);
    lamp.add(torch);
    lampLight.position.set(0.95, -0.05, 0);
  }
  const flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: farmer ? 0xfff0c8 : 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  flare.scale.setScalar(farmer ? 1.2 : 1.6);
  lampLight.add(flare);
  // The light itself.
  const light = new THREE.SpotLight(farmer ? 0xfff2c8 : PALETTE.lantern, farmer ? 110 : 70, farmer ? 15 : 10, farmer ? c.half * 1.15 : 1.05, farmer ? 0.3 : 0.7, 1.5);
  light.castShadow = false;
  light.shadow.bias = -0.0008;
  light.shadow.normalBias = 0.04;
  light.shadow.radius = 5;
  light.shadow.camera.near = 0.3;
  const target = new THREE.Object3D();
  light.target = target;
  // A soft ring on the floor marking exactly where she sees.
  const pool = decal(poolTexture(), new THREE.Color(farmer ? 0xfff0c0 : PALETTE.lantern), HUNTER.wife.pool * 2, 0.5, true);
  pool.position.y = 0.03;
  pool.visible = !farmer;
  // His beam on the floor: a long wedge exactly the cone that sees.
  let beam = null;
  if (farmer) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(Math.cos(c.half) * c.cone, Math.sin(c.half) * c.cone);
    shape.absarc(0, 0, c.cone, c.half, -c.half, true);
    shape.lineTo(0, 0);
    const g = new THREE.ShapeGeometry(shape, 14);
    g.rotateX(Math.PI / 2);
    beam = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 0.04;
    beam.renderOrder = 3;
  }
  // ---- the knife and its shadow on the floor (his strike is his own boot)
  const knife = new THREE.Group();
  if (!farmer) {
    const blade = new THREE.Mesh(knifeGeometry(), mats.steel);
    blade.castShadow = true;
    knife.add(blade);
    const grip = new THREE.Group();
    grip.position.y = -0.62;
    grip.add(mesh(new THREE.CylinderGeometry(0.14, 0.12, 1.2, 12), mats.handle, 0, 0, 0, 1, 1, 0.75));
    for (const y of [-0.3, 0.05, 0.38]) grip.add(mesh(SPH_LO, mats.rivet, 0, y, 0.085, 0.035, 0.035, 0.02, false));
    grip.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 12), mats.steel, 0, 0.62, 0, 1.1, 1, 0.6));
    knife.add(grip);
    knife.scale.setScalar(1.25);
  }
  knife.visible = false;
  const strikeShadow = decal(farmer ? bootTexture(false) : knifeTexture(false), new THREE.Color(0x000000), 1, 0);
  const strikeLine = decal(farmer ? bootTexture(true) : knifeTexture(true), new THREE.Color(PALETTE.knife), 1, 0, true);
  strikeShadow.visible = strikeLine.visible = false;
  // ---- the mark over her head
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTexture('?', '#F4A835'), transparent: true, depthTest: false, depthWrite: false }));
  mark.renderOrder = 10;
  mark.visible = false;
  const contact = decal(glowTexture(), new THREE.Color(0x000000), 3.2, 0.45);
  contact.position.y = 0.011;
  return {
    kind,
    farmer,
    root,
    body,
    feet,
    skirt,
    skirtBase,
    hem,
    hand,
    lamp,
    lampLight,
    flare,
    light,
    target,
    pool,
    beam,
    knife,
    strikeShadow,
    strikeLine,
    mark,
    contact,
    mats,
    markGlyph: '',
    markT: 0,
    lastSeq: -1,
    lift: 0,
    swingX: 0,
    swingZ: 0,
    swingVX: 0,
    swingVZ: 0,
    lastHX: 0,
    lastHZ: 0,
    lastVX: 0,
    lastVZ: 0,
    vx: 0,
    vz: 0,
    px: NaN,
    pz: NaN,
    sway: 0,
    landed: -1,
    stamp: 0,
    ready: false,
  };
}

const tq = new THREE.Quaternion();
const tv = new THREE.Vector3();
const ease = (u) => u * u * (3 - 2 * u);

// The four places a foot rests relative to the hunter, and where it steps to next.
function homeOf(model, f, h, lead) {
  const ca = Math.cos(h.a);
  const sa = Math.sin(h.a);
  const off = model.farmer ? 0.6 : 0.5;
  return [h.x - sa * f.side * off + model.vx * lead, h.z + ca * f.side * off + model.vz * lead];
}

// Pose a human hunter. h: { x, z, a, m, ch, t, until }. now: match seconds. fx: particles. events: { landed(x, z, kind) }.
export function poseHuman(model, h, now, dt, reduced = false, fx = null) {
  const c = HUNTER[model.kind];
  // Velocity from the position (snapshots arrive interpolated, so this is smooth).
  if (!model.ready || !Number.isFinite(model.px)) {
    model.px = h.x;
    model.pz = h.z;
  }
  const k = dt > 0 ? Math.min(1, dt * 8) : 0;
  const ivx = dt > 0 ? (h.x - model.px) / dt : 0;
  const ivz = dt > 0 ? (h.z - model.pz) / dt : 0;
  if (Math.hypot(ivx, ivz) < 12) {
    model.vx += (ivx - model.vx) * k;
    model.vz += (ivz - model.vz) * k;
  }
  model.px = h.x;
  model.pz = h.z;
  const speed = Math.hypot(model.vx, model.vz);
  model.body.position.set(h.x, 0, h.z);
  model.body.rotation.y = -h.a;
  model.contact.position.set(h.x, 0.011, h.z);
  // ---- feet: plant, then step when the body has gone on without them
  const ch = h.ch;
  const stamping = model.farmer && ch && (h.m === 'raise' || (now >= ch.at && now < ch.at + c.recover + 0.2));
  const dur = Math.max(0.26, Math.min(0.45, 0.62 - speed * 0.12));
  if (!model.ready) {
    for (const f of model.feet) {
      [f.x, f.z] = homeOf(model, f, h, 0);
      f.a = h.a;
      f.step = -1;
    }
    model.ready = true;
  }
  const busy = model.feet.some((f) => f.step >= 0);
  let worst = null;
  let worstD = 0;
  for (const f of model.feet) {
    const [hx, hz] = homeOf(model, f, h, dur * 0.9);
    const d = Math.hypot(hx - f.x, hz - f.z);
    let turn = Math.abs(Math.atan2(Math.sin(h.a - f.a), Math.cos(h.a - f.a)));
    const need = d + turn * 0.6;
    if (f.step < 0 && need > worstD) {
      worstD = need;
      worst = f;
    }
  }
  if (!busy && worst && worstD > (speed > 0.3 ? 0.3 : 0.45) && !(stamping && worst.side > 0)) {
    worst.step = 0;
    worst.sx = worst.x;
    worst.sz = worst.z;
    worst.sa = worst.a;
    worst.dur = dur;
  }
  for (const f of model.feet) {
    const stomp = stamping && f.side > 0;
    if (stomp) {
      // His right boot over the spot, high through the telegraph, then down hard.
      const raising = now < ch.at;
      const u = raising ? Math.max(0, Math.min(1, 1 - (ch.at - now) / c.tele)) : 1;
      const tx = ch.x;
      const tz = ch.z;
      f.x += (tx - f.x) * Math.min(1, dt * 10);
      f.z += (tz - f.z) * Math.min(1, dt * 10);
      f.a = h.a;
      const shake = reduced ? 0 : Math.sin(now * 40) * 0.03 * u;
      f.y = raising ? 1.4 + u * 1.6 + shake : 0;
      f.roll = raising ? -0.3 * u : 0;
      if (!raising && model.stamp !== ch.seq) {
        model.stamp = ch.seq;
        f.x = tx;
        f.z = tz;
        fx?.dust(tx, tz, 14, h.a, 1.6);
        fx?.splinters?.(tx, tz, 6, 0x5a4636);
      }
      f.step = -1;
    } else if (f.step >= 0) {
      f.step += dt / f.dur;
      const u = Math.min(1, f.step);
      const [hx, hz] = homeOf(model, f, h, f.dur * (1 - u) * 0.9);
      const e = ease(u);
      f.x = f.sx + (hx - f.sx) * e;
      f.z = f.sz + (hz - f.sz) * e;
      let da = h.a - f.sa;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      f.a = f.sa + da * e;
      f.y = Math.sin(u * Math.PI) * (model.farmer ? 0.42 : 0.34);
      f.roll = reduced ? 0 : Math.sin(u * Math.PI * 2) * -0.22;
      if (u >= 1) {
        f.step = -1;
        f.y = 0;
        f.roll = 0;
        if (fx && !reduced) fx.dust(f.x + Math.cos(f.a) * 0.4, f.z + Math.sin(f.a) * 0.4, model.farmer ? 4 : 2, f.a, model.farmer ? 1.2 : 0.8);
      }
    } else {
      f.y += (0 - f.y) * Math.min(1, dt * 12);
      f.roll += (0 - f.roll) * Math.min(1, dt * 12);
    }
    f.foot.position.set(f.x, f.y, f.z);
    f.foot.rotation.y = -f.a;
    // Toe-off rolls about the toe, heel-strike about the heel.
    const at = f.roll < 0 ? 0.75 : -0.45;
    f.pivot.rotation.z = f.roll;
    f.pivot.position.x = at;
    f.pivot.children[0].position.x = -at + (model.farmer ? 0.15 : 0);
    // The shin: from the ankle up to the hip inside the skirt.
    const ankX = f.x - Math.cos(f.a) * 0.25;
    const ankZ = f.z - Math.sin(f.a) * 0.25;
    const ankY = f.y + (model.farmer ? 1.8 : 0.42);
    const ca = Math.cos(h.a);
    const sa = Math.sin(h.a);
    const hipX = h.x - sa * f.side * 0.42 - ca * 0.05;
    const hipZ = h.z + ca * f.side * 0.42 - sa * 0.05;
    const hipY = 5.2;
    tv.set(hipX - ankX, hipY - ankY, hipZ - ankZ);
    const len = tv.length();
    tv.divideScalar(len);
    tq.setFromUnitVectors(UP, tv);
    f.shin.position.set(ankX, ankY, ankZ);
    f.shin.quaternion.copy(tq);
    f.shin.scale.set(1, len, 1);
  }
  // ---- the skirt's hem sways after the legs and the turns
  const sw = model.feet[0].x - model.feet[1].x;
  model.sway += ((reduced ? 0 : Math.max(-1, Math.min(1, speed * 0.25))) - model.sway) * Math.min(1, dt * 4);
  const pos = model.skirt.geometry.attributes.position;
  const arr = model.skirt.visible ? pos.array : [];
  const base = model.skirtBase;
  const kick = reduced ? 0 : speed * 0.05;
  for (let i = 0; i < arr.length; i += 3) {
    const by = base[i + 1];
    if (by > 0.4) continue; // only the bottom ring moves
    const bx = base[i];
    const bz = base[i + 2];
    const ang = Math.atan2(bz, bx);
    const wave = Math.sin(ang * 6 + now * 3.2) * 0.04 + Math.sin(ang * 3 - now * 2.1) * kick;
    // Back of the hem trails behind as she walks (local -x is behind her).
    const trail = -model.sway * 0.18;
    arr[i] = bx * (1 + wave) + trail;
    arr[i + 2] = bz * (1 + wave) + (reduced ? 0 : sw * 0.02);
    arr[i + 1] = by + (reduced ? 0 : Math.sin(ang * 4 + now * 2.6) * 0.04);
  }
  if (model.skirt.visible) pos.needsUpdate = true;
  if (model.hem) {
    model.hem.rotation.y = reduced ? 0 : Math.sin(now * 1.7) * 0.03;
    model.hem.position.x = -model.sway * 0.18;
  }
  // ---- the lantern: lifted when she hears, swinging on its handle
  const lifted = h.m === 'hear' || h.m === 'spot' || h.m === 'look' || h.m === 'search';
  model.lift += ((lifted ? 1 : 0) - model.lift) * Math.min(1, dt * 5);
  if (model.farmer) model.hand.position.set(0.7 + model.lift * 0.3, 3.4 + model.lift * 0.3, 0.95);
  else model.hand.position.set(0.55 + model.lift * 0.5, 3.6 + model.lift * 0.8, 1.0);
  model.hand.rotation.set(0, 0, 0);
  // A pendulum driven by the hand's acceleration in its own frame.
  const hwx = h.x;
  const hwz = h.z;
  const avx = dt > 0 ? (model.vx - model.lastVX) / dt : 0;
  const avz = dt > 0 ? (model.vz - model.lastVZ) / dt : 0;
  model.lastVX = model.vx;
  model.lastVZ = model.vz;
  model.lastHX = hwx;
  model.lastHZ = hwz;
  const ca = Math.cos(h.a);
  const sa = Math.sin(h.a);
  const fwdAcc = avx * ca + avz * sa;
  const sideAcc = -avx * sa + avz * ca;
  if (!reduced && dt > 0) {
    const stiff = 22;
    const damp = 2.2;
    const step = Math.min(dt, 1 / 30);
    model.swingVZ += (-model.swingZ * stiff - model.swingVZ * damp + fwdAcc * 0.25 + Math.sin(now * 5.2) * speed * 0.6) * step;
    model.swingVX += (-model.swingX * stiff - model.swingVX * damp - sideAcc * 0.25) * step;
    model.swingZ = Math.max(-0.7, Math.min(0.7, model.swingZ + model.swingVZ * step));
    model.swingX = Math.max(-0.7, Math.min(0.7, model.swingX + model.swingVX * step));
  } else {
    model.swingX = model.swingZ = 0;
  }
  if (model.farmer) {
    model.lamp.rotation.set(0, (reduced ? 0 : Math.sin(now * 0.9) * 0.08), model.swingZ * 0.2);
  } else model.lamp.rotation.set(model.swingX, 0, model.swingZ);
  // ---- the light: her pool is exactly where the rules say; his beam points where he faces
  model.lampLight.getWorldPosition(model.light.position);
  if (model.farmer) {
    model.target.position.set(h.x + ca * 6, 0, h.z + sa * 6);
    if (model.beam) {
      model.beam.position.set(h.x, 0.04, h.z);
      model.beam.rotation.y = -h.a;
      model.beam.material.opacity = 0.06 + (h.m === 'spot' || h.m === 'chase' ? 0.05 : 0);
    }
  } else {
    const [lx, lz] = lanternOf(h);
    model.target.position.set(lx, 0, lz);
    model.pool.position.set(lx, 0.03, lz);
    model.pool.visible = h.m !== 'wait';
    model.pool.material.opacity = h.m === 'spot' || h.m === 'chase' || h.m === 'raise' ? 0.85 : 0.5;
  }
  model.target.updateMatrixWorld();
  const flicker = reduced ? 1 : 0.9 + Math.sin(now * 23) * 0.04 + Math.sin(now * 37.3) * 0.035 + Math.sin(now * 6.1) * 0.03;
  const on = h.m === 'wait' ? 0 : 1;
  model.light.intensity = (model.farmer ? 110 : 70) * flicker * on;
  model.flare.material.opacity = 0.75 * flicker * on;
  model.flare.scale.setScalar((model.farmer ? 1.2 : 1.6) * (0.95 + flicker * 0.05));
  // ---- "?" and "!"
  const glyph = h.m === 'spot' || h.m === 'chase' || h.m === 'raise' ? '!' : h.m === 'hear' || h.m === 'go' || h.m === 'search' || h.m === 'look' ? '?' : '';
  if (glyph !== model.markGlyph) {
    model.markGlyph = glyph;
    model.markT = 0;
    if (glyph) {
      model.mark.material.map = markTexture(glyph, glyph === '!' ? '#E23D2E' : '#F4A835');
      model.mark.material.needsUpdate = true;
    }
  }
  model.markT += dt;
  model.mark.visible = !!glyph;
  if (glyph) {
    const pop = reduced ? 1 : Math.min(1, model.markT * 6) * (1 + Math.sin(Math.min(1, model.markT * 4) * Math.PI) * 0.35);
    model.mark.position.set(h.x, 3.4 + (reduced ? 0 : Math.sin(now * 3) * 0.08), h.z);
    model.mark.scale.setScalar(1.35 * pop);
  }
  // ---- the strike: the shadow darkens and sharpens through the telegraph, then the blade lands and sticks
  const raising = h.m === 'raise' && ch && now < ch.at;
  const landed = ch && now >= ch.at && now < ch.at + c.recover + 0.2;
  model.strikeShadow.visible = model.strikeLine.visible = !!raising;
  model.knife.visible = !model.farmer && !!(raising || landed);
  if (ch && (raising || landed)) {
    const u = raising ? Math.max(0, Math.min(1, 1 - (ch.at - now) / c.tele)) : 1;
    const size = model.farmer ? 2.4 : 2.1;
    const blur = 1.7 - 0.7 * u;
    model.strikeShadow.position.set(ch.x, 0.035, ch.z);
    model.strikeShadow.scale.setScalar(size * blur);
    model.strikeShadow.rotation.y = -h.a + Math.PI / 2;
    model.strikeShadow.material.opacity = 0.15 + 0.65 * u * u;
    model.strikeLine.position.set(ch.x, 0.04, ch.z);
    model.strikeLine.scale.setScalar(size);
    model.strikeLine.rotation.y = -h.a + Math.PI / 2;
    model.strikeLine.material.opacity = 0.45 + 0.55 * Math.abs(Math.sin(now * (10 + u * 14)));
    if (!model.farmer) {
      if (raising) {
        // Rises a little as she winds up, then comes down fast in the last moment.
        const wind = u < 0.75 ? u / 0.75 : 1;
        const fall = u < 0.75 ? 0 : (u - 0.75) / 0.25;
        model.knife.position.set(ch.x, 6.5 + wind * 1.4 - fall * fall * 5, ch.z);
        model.knife.rotation.set(Math.PI + (reduced ? 0 : Math.sin(now * 30) * 0.04 * wind), -h.a + Math.PI / 2, 0.2 - wind * 0.2);
      } else {
        const since = now - ch.at;
        const wob = reduced ? 0 : Math.sin(since * 46) * Math.exp(-since * 5) * 0.22;
        model.knife.position.set(ch.x, 2.6, ch.z);
        model.knife.rotation.set(Math.PI + wob, -h.a + Math.PI / 2, 0.12);
        if (model.landed !== ch.seq) {
          model.landed = ch.seq;
          fx?.splinters?.(ch.x, ch.z, 14, 0xc8a070);
          fx?.dust(ch.x, ch.z, 10, h.a, 1.4);
          fx?.sparks?.(ch.x, 0.2, ch.z, 8, 0xfff1d6);
        }
      }
    }
  }
}

export function addHuman(group, scene, model) {
  group.add(model.root, model.knife, model.strikeShadow, model.strikeLine, model.pool, model.mark, model.contact);
  if (model.beam) group.add(model.beam);
  scene.add(model.light, model.target);
}

