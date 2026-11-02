// What's on the floor to take or to fear: cheese wedges with a rind and holes, the big wheel with its paper label, the
// spring traps (Poly Haven's mousetrap with a working kill bar and bait) and the crumbs only a squeak shows.

import * as THREE from 'three';
import { patchEcho, ink, PALETTE } from './echo.js';
import { cheeseTexture, stencilTexture } from './textures.js';
import { propParts } from './assets.js';
import { decal, glowTexture } from './mouse.js';

// The cheese keeps its yellow in any light: an orange rim and a dark rind line round it.
const CHEESE_RIM = 0xff9a1e;
const CHEESE_INK = 0x241004;
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });

let cheeseMats = null;
function cheese() {
  if (cheeseMats) return cheeseMats;
  const tex = cheeseTexture();
  cheeseMats = {
    paste: () => patchEcho(new THREE.MeshStandardMaterial({ color: 0xffffff, map: tex, bumpMap: tex, bumpScale: 2, roughness: 0.55, emissive: PALETTE.cheese, emissiveIntensity: 0.12 }), { rim: 0.45, fill: 0.7, cut: false, actor: CHEESE_RIM }),
    rind: () => patchEcho(std(0xe4a42c, { roughness: 0.5, emissive: PALETTE.cheese, emissiveIntensity: 0.1 }), { rim: 0.45, fill: 0.7, cut: false, actor: CHEESE_RIM }),
  };
  return cheeseMats;
}

// A wedge cut from a wheel: the paste on the cut faces, the rind round the curve. Its point faces +x.
export function createWedge() {
  const R = 0.62;
  const A = 0.62; // the angle of the cut
  const H = 0.32;
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(Math.cos(-A / 2) * R, Math.sin(-A / 2) * R);
  s.absarc(0, 0, R, -A / 2, A / 2, false);
  s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: H, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(-Math.PI / 2);
  g.translate(-R * 0.62, 0, 0);
  g.rotateY(Math.PI);
  const paste = cheese().paste();
  const rind = cheese().rind();
  const m = ink(new THREE.Mesh(g, paste), CHEESE_INK);
  m.castShadow = true;
  // The rind: a thin curved band on the round side.
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, H + 0.03, 12, 1, true, (Math.PI * 3) / 2 - A / 2, A), rind);
  band.position.set(R * 0.62, H / 2, 0);
  band.castShadow = true;
  band.material.side = THREE.DoubleSide;
  const body = new THREE.Group();
  body.add(m, band);
  body.scale.setScalar(0.95);
  const root = new THREE.Group();
  root.add(body);
  const glow = decal(glowTexture(), new THREE.Color(0x8a6a10), 1.9, 0.45, true);
  glow.position.y = 0.03;
  return { root, body, mesh: m, mat: paste, mat2: rind, glow, ping: 0, k: 'w', spin: 0, lx: NaN, lz: NaN, wob: 0 };
}

// The Daily Raid's golden wedge: the same wedge, gilded.
export function gild(model) {
  for (const m of [model.mat, model.mat2]) {
    m.color.setHex(0xffd54a);
    m.metalness = 0.4;
    m.roughness = 0.3;
    m.emissive.setHex(0x8a5a00);
    m.emissiveIntensity = 0.55;
    m.needsUpdate = true;
  }
  model.glow.material.color.setHex(0xc89a20);
  model.gold = true;
  return model;
}

// The wheel: rind round the sides, paste faces, a paper label on one face.
export function createWheel() {
  const rind = cheese().rind();
  const face = cheese().paste();
  const g = new THREE.CylinderGeometry(0.62, 0.62, 0.44, 36, 1, false);
  const m = ink(new THREE.Mesh(g, [rind, face, face]), CHEESE_INK);
  m.castShadow = true;
  m.rotation.x = Math.PI / 2;
  // Bevel rings at both edges.
  for (const y of [-0.22, 0.22]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 6, 36), rind);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    m.add(ring);
  }
  const label = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), patchEcho(new THREE.MeshStandardMaterial({ map: stencilTexture('CHEDDAR', '#7a2a1a'), color: 0xf4ead4, roughness: 0.9, transparent: true }), { rim: 0.1, cut: false, actor: CHEESE_RIM }));
  const roll = new THREE.Group();
  roll.position.y = 0.62;
  roll.add(m);
  m.add(label);
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.223, 0);
  const root = new THREE.Group();
  root.add(roll);
  const glow = decal(glowTexture(), new THREE.Color(0x8a6a10), 3.2, 0.4, true);
  glow.position.y = 0.03;
  return { root, roll, mesh: m, mat: rind, mat2: face, glow, ping: 0, k: 'W', spin: 0, lx: NaN, lz: NaN };
}

// The spring trap: the Poly Haven model as the base, our own kill bar and bait so it can snap.
let trapParts = null;
export function createTrap() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  trapParts ??= propParts('mousetrap');
  const metal = patchEcho(std(0xb8bec8, { roughness: 0.28, metalness: 0.9 }), { rim: 0.3 });
  let L = 1.0;
  let top = 0.1;
  if (trapParts?.length) {
    for (const p of trapParts) {
      p.geometry.computeBoundingBox();
      const b = p.geometry.boundingBox;
      const len = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);
      const s = 1.0 / len;
      const mat = p.material.clone();
      patchEcho(mat, { rim: 0.2 });
      const m = new THREE.Mesh(p.geometry, mat);
      m.scale.setScalar(s);
      if (b.max.z - b.min.z > b.max.x - b.min.x) m.rotation.y = Math.PI / 2;
      m.castShadow = true;
      m.receiveShadow = true;
      body.add(m);
      top = Math.max(top, b.max.y * s);
    }
  } else {
    body.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.5), patchEcho(std(0xb98a52, { roughness: 0.8 }))));
    top = 0.08;
  }
  // The kill bar: a wire loop hinged across the middle.
  const bar = new THREE.Group();
  bar.position.set(0, top + 0.01, 0);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 12, Math.PI), metal);
  loop.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
  loop.scale.set(1, 1.15, 1);
  loop.position.x = -0.0;
  bar.add(loop);
  bar.rotation.z = 0;
  body.add(bar);
  const bait = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), patchEcho(std(0xffd23f, { emissive: 0x5a4000, roughness: 0.5 }), { cut: false }));
  bait.position.set(0.28, top + 0.05, 0);
  bait.rotation.y = 0.4;
  bait.castShadow = true;
  body.add(bait);
  const warn = decal(glowTexture(), new THREE.Color(PALETTE.knife), 1.6, 0, true);
  warn.position.y = 0.025;
  return { root, body, bar, bait, warn, sprung: false, flip: 0, jump: 0, ping: 0, L };
}

export function poseTrap(model, sprung, dt, reduced = false) {
  if (sprung && !model.sprung) {
    model.flip = 0;
    model.jump = 1;
  }
  model.sprung = sprung;
  if (sprung) model.flip = Math.min(1, model.flip + dt * 14);
  model.bar.rotation.z = sprung ? -Math.PI * 0.95 * (1 - Math.pow(1 - model.flip, 3)) : 0;
  model.bait.visible = !sprung;
  model.jump = Math.max(0, model.jump - dt * 2.5);
  const j = reduced ? 0 : Math.sin((1 - model.jump) * Math.PI) * model.jump;
  model.body.position.y = j * 0.35;
  model.body.rotation.z = j * 0.25;
  model.ping = Math.max(0, model.ping - dt);
  model.warn.material.opacity = sprung ? 0 : Math.min(1, model.ping) * 0.5;
}

// ---------------------------------------------------------------- crumbs: invisible until a squeak's light finds them

const crumbGeo = (() => {
  const g = new THREE.DodecahedronGeometry(0.11, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 0.6);
  g.translate(0, 0.05, 0);
  g.computeVertexNormals();
  return g;
})();

export function createCrumbs(list) {
  const n = Math.max(1, list.length);
  const mat = patchEcho(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0xffc040, emissiveIntensity: 1 }), { rim: 0.2 });
  const mesh = new THREE.InstancedMesh(crumbGeo, mat, n * 3);
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  const color = new THREE.Color();
  let seed = 77;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const base = [];
  list.forEach(([x, z], i) => {
    for (let k = 0; k < 3; k++) {
      const ang = rnd() * 6.28;
      const r = k ? 0.08 + rnd() * 0.08 : 0;
      e.set(rnd(), rnd() * 6.28, rnd());
      q.setFromEuler(e);
      const sc = k ? 0.55 + rnd() * 0.3 : 1;
      v.set(x + Math.cos(ang) * r, 0, z + Math.sin(ang) * r);
      s.set(sc, sc, sc);
      m4.compose(v, q, s);
      mesh.setMatrixAt(i * 3 + k, m4);
      base.push(m4.clone());
      mesh.setColorAt(i * 3 + k, color.setRGB(0.05, 0.04, 0.02));
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  const glints = new Float32Array(list.length);
  const known = new Float32Array(list.length);
  const shown = new Float32Array(list.length);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    mesh,
    list,
    glints,
    known,
    taken: new Uint8Array(list.length),
    // got: which are gone; dt: frame step; (fx, fz): the focused mouse, whose whiskers find crumbs right under its nose.
    // A crumb a ring found flares, then stays faintly lit (remembered) for a while.
    update(got, dt, fx = -99, fz = -99) {
      let dirty = false;
      let cdirty = false;
      for (let i = 0; i < list.length; i++) {
        const gone = !!got?.[i];
        if (gone !== !!this.taken[i]) {
          this.taken[i] = gone ? 1 : 0;
          for (let k = 0; k < 3; k++) mesh.setMatrixAt(i * 3 + k, gone ? zero : base[i * 3 + k]);
          dirty = true;
        }
        if (gone) continue;
        if (glints[i] > 0) {
          glints[i] = Math.max(0, glints[i] - dt * 0.7);
          known[i] = 1;
        } else known[i] = Math.max(0, known[i] - dt / 14);
        const dx = list[i][0] - fx;
        const dz = list[i][1] - fz;
        const near = Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) / 1.9);
        const want = glints[i] * 0.9 + Math.max(known[i] * 0.4, near * 0.65);
        if (Math.abs(want - shown[i]) > 0.01) {
          shown[i] = want;
          const g = want;
          for (let k = 0; k < 3; k++) mesh.setColorAt(i * 3 + k, color.setRGB(0.05 + g * 1.3, 0.04 + g * 0.95, 0.02 + g * 0.32));
          cdirty = true;
        }
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true;
      if (cdirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    dispose() {
      mesh.dispose();
      mat.dispose();
    },
  };
}
