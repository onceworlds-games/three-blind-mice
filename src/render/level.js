// A night's room in 3D: a farmhouse at mouse height. Planked (or flagged, or earthen) floors, plastered walls with skirting
// and wainscot, windows that let the moon in, furniture built in code from real wood and cloth, Poly Haven props (barrels,
// churns, jugs, the grandfather clock) and the dressing on every table and shelf, the creaky boards and the spilt grain,
// the mousehole glowing in its wall. Static geometry is merged per material; repeated props are instanced.

import * as THREE from 'three';
import { patchEcho, PALETTE } from './echo.js';
import { createBuckets, roomMaterials, mat4, rboxGeo, turnedGeo, worldUV } from './build.js';
import { hasProp, propParts, propSize } from './assets.js';
import { skyTexture, beamTexture, creakTexture, grainTexture, stencilTexture, paintingTexture, doormatTexture } from './textures.js';

export const WALL_H = 3.0;
export const FRONT_H = 1.0;

function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A wall with the room behind it (north, away from the camera) is cut low, like a dollhouse, so it never hides the floor.
export function isFront(world, x, z) {
  const n = world.info(x, z - 1);
  return !n.wall && n.code !== 0;
}

function rects(world, test) {
  const { W, D } = world;
  const used = new Uint8Array(W * D);
  const ok = (x, z) => x >= 0 && z >= 0 && x < W && z < D && !used[z * W + x] && test(x, z);
  const out = [];
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (!ok(x, z)) continue;
      let x1 = x;
      while (ok(x1 + 1, z)) x1++;
      let z1 = z;
      outer: while (z1 + 1 < D) {
        for (let xx = x; xx <= x1; xx++) if (!ok(xx, z1 + 1)) break outer;
        z1++;
      }
      for (let zz = z; zz <= z1; zz++) for (let xx = x; xx <= x1; xx++) used[zz * W + xx] = 1;
      out.push([x, z, x1 + 1, z1 + 1]);
    }
  }
  return out;
}

// ---------------------------------------------------------------- props: placements, instanced at the end

const PROP_MATS = new WeakSet();
function prepPropMaterial(m) {
  if (PROP_MATS.has(m)) return m;
  PROP_MATS.add(m);
  const name = (m.name || '').toLowerCase();
  if (name.includes('glass')) {
    m.transparent = true;
    m.opacity = 0.28;
    m.depthWrite = false;
    m.roughness = 0.05;
    m.userData.noShadow = true;
  } else if (name.includes('flame')) {
    m.emissive = new THREE.Color(0xffa040);
    m.emissiveIntensity = 3;
    m.userData.noShadow = true;
  }
  if (m.map) m.map.anisotropy = 4;
  patchEcho(m, { fill: 1 });
  return m;
}

function createProps() {
  const place = new Map();
  return {
    // Place a prop: its base at (x, y, z), turned ry, scaled so `fit` (u) matches its widest footprint side ('w') or its
    // height ('h'). squash scales its height on top of that.
    add(id, x, y, z, ry = 0, fit = 1, by = 'w', squash = 1) {
      const size = propSize(id);
      if (!size) return false;
      const s = by === 'h' ? fit / size.y : fit / Math.max(size.x, size.z);
      if (!place.has(id)) place.set(id, []);
      place.get(id).push(mat4(x, y, z, ry, s, s * squash, s));
      return true;
    },
    build(group) {
      const out = [];
      for (const [id, list] of place) {
        const parts = propParts(id);
        if (!parts) continue;
        for (const part of parts) {
          const mat = prepPropMaterial(part.material);
          const inst = new THREE.InstancedMesh(part.geometry, mat, list.length);
          list.forEach((m, i) => inst.setMatrixAt(i, m));
          inst.instanceMatrix.needsUpdate = true;
          inst.computeBoundingSphere();
          inst.castShadow = !mat.userData.noShadow;
          inst.receiveShadow = true;
          inst.name = `${id}:${part.name}`;
          inst.userData.list = list;
          group.add(inst);
          out.push(inst);
        }
      }
      return out;
    },
  };
}

// ---------------------------------------------------------------- the room

export function buildLevel(world) {
  const night = world.night;
  const { mats, room } = roomMaterials(night);
  const B = createBuckets();
  const P = createProps();
  const rnd = seeded(night.id * 7919 + 13);
  const group = new THREE.Group();
  const animated = [];
  const lights = [];
  const windows = [];
  const extra = [];
  const info = world.info;
  const floorAt = (x, z) => !!info(x, z).floor;

  // ---- floor
  const fg = new THREE.PlaneGeometry(world.W, world.D, 1, 1);
  fg.rotateX(-Math.PI / 2);
  fg.translate(world.W / 2, 0, world.D / 2);
  worldUV(fg, room.fScale);
  const floor = new THREE.Mesh(fg, mats.floor);
  floor.receiveShadow = true;
  floor.name = 'floor';
  group.add(floor);

  // ---- walls: body and cap, then skirting and a wainscot on the faces that see the floor
  for (const front of [false, true]) {
    const H = front ? FRONT_H : WALL_H;
    for (const [x0, z0, x1, z1] of rects(world, (x, z) => info(x, z).wall && isFront(world, x, z) === front)) {
      B.box('wall', x0, 0, z0, x1, H, z1, 0.015, { scale: 4 });
      B.box('cap', x0 - 0.02, H, z0 - 0.02, x1 + 0.02, H + 0.06, z1 + 0.02, 0.02, null);
    }
  }
  for (let z = 0; z < world.D; z++) {
    for (let x = 0; x < world.W; x++) {
      if (!info(x, z).wall) continue;
      const H = isFront(world, x, z) ? FRONT_H : WALL_H;
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        if (!floorAt(x + dx, z + dz)) continue;
        const fx = dx === 0 ? [x, x + 1] : dx > 0 ? [x + 1, x + 1.05] : [x - 0.05, x];
        const fz = dz === 0 ? [z, z + 1] : dz > 0 ? [z + 1, z + 1.05] : [z - 0.05, z];
        B.box('skirting', fx[0], 0, fz[0], fx[1], 0.36, fz[1], 0.01, { scale: 2 });
        if (room.wainscot && H > 2) {
          const wx = dx === 0 ? fx : dx > 0 ? [x + 1, x + 1.025] : [x - 0.025, x];
          const wz = dz === 0 ? fz : dz > 0 ? [z + 1, z + 1.025] : [z - 0.025, z];
          B.box('wainscot', wx[0], 0.36, wz[0], wx[1], 1.25, wz[1], 0.005, { scale: 2, grain: 'v' });
          B.box('skirting', fx[0], 1.25, fz[0], fx[1], 1.33, fz[1], 0.01, { scale: 2 });
        }
      }
    }
  }

  // ---- windows in the back walls, with the moon coming in
  // A back wall: the room (floor or furniture) in front of it, toward the camera.
  const backWall = (x, z) => info(x, z).wall && !isFront(world, x, z) && !info(x, z + 1).wall && info(x, z + 1).code !== 0;
  // Under a window: open floor, or something low (a sack, a crate, a barrel) the moon can fall across.
  const LOW = new Set(['sack', 'jar', 'crate', 'churn', 'barrel', 'hay']);
  const clearBelow = (x, z) => {
    for (let dz = 1; dz <= 2; dz++) {
      const t = info(x, z + dz);
      if ((t.tall && !LOW.has(t.furniture)) || t.furniture === 'shelf' || t.furniture === 'bed') return false;
    }
    return true;
  };
  const openBelow = (x, z) => !info(x, z + 1).tall && !info(x, z + 2).tall;
  const spots = [];
  for (let z = 0; z < world.D; z++) {
    for (let x = 2; x < world.W - 2; x++) {
      if ([-1, 0, 1].every((d) => backWall(x + d, z) && clearBelow(x + d, z))) spots.push([x, z]);
    }
  }
  const wantWindows = Math.max(1, Math.min(2, Math.round(world.W / 14)));
  const chosen = [];
  const score = ([x, z]) => Math.abs(x - world.W * 0.42) - ([-1, 0, 1].every((d) => openBelow(x + d, z)) ? 6 : 0);
  spots.sort((a, b) => score(a) - score(b));
  for (const s of spots) {
    if (chosen.length >= wantWindows) break;
    if (chosen.every((c) => Math.abs(c[0] - s[0]) >= 8 || c[1] !== s[1])) chosen.push(s);
  }
  const paneMat = new THREE.MeshBasicMaterial({ map: skyTexture(true, night.id), color: 0x8a9acc });
  const paneMat2 = new THREE.MeshBasicMaterial({ map: skyTexture(false, night.id + 5), color: 0x8a9acc });
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0x6f86c8, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  chosen.forEach(([x, z], i) => {
    const cx = x + 0.5;
    const fz = z + 1;
    const y0 = 1.3;
    const y1 = 2.75;
    const hw = 1.05;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, y1 - y0), i === 0 ? paneMat : paneMat2);
    pane.position.set(cx, (y0 + y1) / 2, fz + 0.012);
    group.add(pane);
    const t = 0.1;
    B.box('frame', cx - hw - t, y0 - t, fz, cx + hw + t, y0, fz + 0.1, 0.02);
    B.box('frame', cx - hw - t, y1, fz, cx + hw + t, y1 + t, fz + 0.1, 0.02);
    B.box('frame', cx - hw - t, y0, fz, cx - hw, y1, fz + 0.1, 0.02);
    B.box('frame', cx + hw, y0, fz, cx + hw + t, y1, fz + 0.1, 0.02);
    B.box('frame', cx - 0.03, y0, fz, cx + 0.03, y1, fz + 0.07, 0.01);
    B.box('frame', cx - hw, (y0 + y1) / 2 - 0.03, fz, cx + hw, (y0 + y1) / 2 + 0.03, fz + 0.07, 0.01);
    B.box('frame', cx - hw - 0.25, y0 - 0.16, fz, cx + hw + 0.25, y0 - 0.06, fz + 0.32, 0.03);
    for (const side of [-1, 1]) {
      const H = y1 - y0 + 0.5;
      const g = new THREE.PlaneGeometry(0.62, H, 10, 6);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) {
        const u = p.getX(k);
        const v = p.getY(k);
        const gather = 0.5 + 0.5 * (1 - (v + H / 2) / H);
        p.setX(k, u * (0.7 + 0.3 * gather));
        p.setZ(k, Math.sin(u * 16 + side) * 0.05 + 0.03);
      }
      g.computeVertexNormals();
      g.translate(cx + side * (hw + 0.05), (y0 + y1) / 2 + 0.1, fz + 0.08);
      worldUV(g, 1.2);
      B.add('curtain', g, new THREE.Matrix4(), null);
    }
    // The moonlight: from high behind the window, down through it onto the floor (walls cast no shadows, so it passes).
    const L = new THREE.Vector3(cx + (i % 2 ? 1.4 : -1.4), 7.5, fz - 3.4);
    const corners = [[cx - hw, y0], [cx + hw, y0], [cx + hw, y1], [cx - hw, y1]].map(([px, py]) => new THREE.Vector3(px, py, fz));
    const ground = corners.map((c) => {
      const tt = L.y / (L.y - c.y);
      return new THREE.Vector3(L.x + (c.x - L.x) * tt, 0.02, L.z + (c.z - L.z) * tt);
    });
    const patch = ground.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(0.25);
    const beam = new THREE.BufferGeometry();
    const pos = [];
    const uv = [];
    for (let k = 0; k < 4; k++) {
      const a = corners[k];
      const b = corners[(k + 1) % 4];
      const c = ground[(k + 1) % 4];
      const d = ground[k];
      pos.push(a.x, a.y, a.z + 0.05, b.x, b.y, b.z + 0.05, c.x, c.y, c.z, a.x, a.y, a.z + 0.05, c.x, c.y, c.z, d.x, d.y, d.z);
      uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
    }
    beam.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    beam.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const shaft = new THREE.Mesh(beam, beamMat);
    shaft.renderOrder = 4;
    group.add(shaft);
    windows.push({ x: cx, z: fz, light: L, target: patch, corners, ground, shaft });
  });

  // ---- pictures, wall shelves and lanterns on the back walls between windows
  let pic = 0;
  const usedDecor = [];
  for (let z = 0; z < world.D; z++) {
    for (let x = 1; x < world.W - 1; x++) {
      if (!backWall(x, z) || !backWall(x - 1, z) || !backWall(x + 1, z)) continue;
      if (windows.some((w) => Math.abs(w.x - (x + 0.5)) < 2.8 && Math.abs(w.z - (z + 1)) < 0.5)) continue;
      if (usedDecor.some(([ux, uz]) => uz === z && Math.abs(ux - x) < 5)) continue;
      if (rnd() < 0.5) continue;
      usedDecor.push([x, z]);
      const cx = x + 0.5;
      const fz = z + 1;
      const kind = (x + z + night.id) % 3;
      if (kind === 0 && night.id !== 4 && night.id !== 10) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), patchEcho(new THREE.MeshStandardMaterial({ map: paintingTexture(pic++ + night.id), roughness: 0.7 })));
        p.position.set(cx, 2.1, fz + 0.07);
        group.add(p);
        B.box('frame', cx - 0.7, 1.58, fz, cx + 0.7, 1.66, fz + 0.09, 0.02);
        B.box('frame', cx - 0.7, 2.54, fz, cx + 0.7, 2.62, fz + 0.09, 0.02);
        B.box('frame', cx - 0.7, 1.66, fz, cx - 0.62, 2.54, fz + 0.09, 0.02);
        B.box('frame', cx + 0.62, 1.66, fz, cx + 0.7, 2.54, fz + 0.09, 0.02);
      } else if (kind === 1) {
        B.box('pine', cx - 1.1, 1.85, fz, cx + 1.1, 1.93, fz + 0.42, 0.02);
        for (const sx of [-0.85, 0.85]) B.box('pine', cx + sx - 0.04, 1.55, fz, cx + sx + 0.04, 1.85, fz + 0.32, 0.01);
        P.add('jug_01', cx + 0.5, 1.93, fz + 0.22, 0.4 + rnd(), 0.62, 'h');
        P.add('wooden_bowl_02', cx - 0.4, 1.93, fz + 0.22, rnd() * 6, 0.55, 'w');
      } else {
        B.box('iron', cx - 0.03, 2.55, fz, cx + 0.03, 2.62, fz + 0.32, 0.01, null);
        P.add('wooden_lantern_01', cx, 1.7, fz + 0.3, 0.3, 0.85, 'h');
      }
    }
  }

  // ---- rugs, creaky boards, spilt grain, pans
  rects(world, (x, z) => info(x, z).rug).forEach(([x0, z0, x1, z1]) => {
    B.box('rug', x0 + 0.08, 0.0, z0 + 0.08, x1 - 0.08, 0.035, z1 - 0.08, 0.015, { scale: 2.2 });
    const along = x1 - x0 >= z1 - z0;
    for (const end of [0, 1]) {
      const n = Math.round((along ? z1 - z0 : x1 - x0) / 0.14);
      for (let k = 0; k < n; k++) {
        const t = (along ? z0 : x0) + 0.15 + k * 0.14;
        if (t > (along ? z1 : x1) - 0.15) break;
        if (along) {
          const e = end ? x1 - 0.08 : x0 + 0.08;
          B.box('linen', end ? e : e - 0.16, 0.0, t - 0.02, end ? e + 0.16 : e, 0.015, t + 0.02, 0.005, null);
        } else {
          const e = end ? z1 - 0.08 : z0 + 0.08;
          B.box('linen', t - 0.02, 0.0, end ? e : e - 0.16, t + 0.02, 0.015, end ? e + 0.16 : e, 0.005, null);
        }
      }
    }
  });
  const decalMat = (map, fill) => {
    map.repeat.set(1, 1);
    const m = new THREE.MeshStandardMaterial({ map, transparent: true, depthWrite: false, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 });
    return patchEcho(m, { fill, front: 1.6 });
  };
  for (const [kind, map, fill, scale] of [
    ['creak', creakTexture(), 2.2, 2],
    ['crumbs', grainTexture(), 2.4, 2.5],
  ]) {
    const list = rects(world, (x, z) => info(x, z).noise === kind);
    if (!list.length) continue;
    const geos = list.map(([x0, z0, x1, z1]) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      g.rotateX(-Math.PI / 2);
      g.translate((x0 + x1) / 2, 0.012, (z0 + z1) / 2);
      worldUV(g, scale);
      return g;
    });
    const mesh = new THREE.Mesh(mergeAll(geos), decalMat(map, fill));
    mesh.receiveShadow = true;
    mesh.renderOrder = 1;
    group.add(mesh);
  }
  {
    const peas = [];
    for (let z = 0; z < world.D; z++) for (let x = 0; x < world.W; x++) {
      if (info(x, z).noise !== 'crumbs') continue;
      for (let k = 0; k < 5; k++) peas.push([x + rnd(), z + rnd(), 0.035 + rnd() * 0.03]);
    }
    if (peas.length) {
      const m = patchEcho(new THREE.MeshStandardMaterial({ color: 0x8fa64a, roughness: 0.6 }), { fill: 2 });
      const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), m, peas.length);
      peas.forEach(([x, z, r], i) => inst.setMatrixAt(i, mat4(x, r * 0.8, z, 0, r, r * 0.85, r)));
      inst.receiveShadow = true;
      group.add(inst);
    }
  }
  const PAN = [[0.1, 0], [0.95, 0], [1, 0.05], [1.04, 0.5], [1.12, 0.62], [1.1, 0.66], [1.0, 0.58], [0.96, 0.12], [0.1, 0.1]];
  for (const [x0, z0, x1, z1] of rects(world, (x, z) => info(x, z).noise === 'pan')) {
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      const ry = rnd() * 6;
      B.add('tin', turnedGeo(0.4, 0.3, PAN, 18), mat4(x + 0.5, 0, z + 0.5, ry), null);
      B.add('tin', rboxGeo(0.55, 0.05, 0.08, 0.02), mat4(x + 0.5 + Math.cos(ry) * 0.62, 0.2, z + 0.5 - Math.sin(ry) * 0.62, ry), null);
    }
  }

  // ---- furniture
  const nearestTable = (cx, cz) =>
    world.furniture
      .filter((t) => t.type === 'table')
      .sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - cx, (a.z0 + a.z1) / 2 - cz) - Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz))[0];
  const openSide = (f) => {
    const cx = Math.floor((f.x0 + f.x1) / 2);
    const cz = Math.floor((f.z0 + f.z1) / 2);
    if (floorAt(cx, f.z1)) return 's';
    if (floorAt(cx, f.z0 - 1)) return 'n';
    if (floorAt(f.x1, cz)) return 'e';
    return 'w';
  };
  const posts = (f, inset) => [[f.x0 + inset, f.z0 + inset], [f.x1 - inset, f.z0 + inset], [f.x0 + inset, f.z1 - inset], [f.x1 - inset, f.z1 - inset]];
  const dress = createDresser(P, rnd, night);

  for (const f of world.furniture) {
    const w = f.x1 - f.x0;
    const d = f.z1 - f.z0;
    const cx = (f.x0 + f.x1) / 2;
    const cz = (f.z0 + f.z1) / 2;
    switch (f.type) {
      case 'table': {
        for (const [px, pz] of posts(f, 0.22)) B.add('table', turnedGeo(0.3, 2.78), mat4(px, 0, pz), { scale: 1.6, grain: 'v' });
        B.box('table', f.x0 + 0.2, 2.45, f.z0 + 0.16, f.x1 - 0.2, 2.8, f.z0 + 0.26, 0.02, { scale: 2 });
        B.box('table', f.x0 + 0.2, 2.45, f.z1 - 0.26, f.x1 - 0.2, 2.8, f.z1 - 0.16, 0.02, { scale: 2 });
        B.box('table', f.x0 + 0.16, 2.45, f.z0 + 0.2, f.x0 + 0.26, 2.8, f.z1 - 0.2, 0.02, { scale: 2 });
        B.box('table', f.x1 - 0.26, 2.45, f.z0 + 0.2, f.x1 - 0.16, 2.8, f.z1 - 0.2, 0.02, { scale: 2 });
        const grain = w >= d ? 'x' : 'z';
        B.box('table', f.x0 - 0.14, 2.8, f.z0 - 0.14, f.x1 + 0.14, 3.02, f.z1 + 0.14, 0.06, { scale: 3, grain });
        let topY = 3.02;
        if (room.cloth && w * d > 8) {
          B.box('cloth', f.x0 - 0.2, 3.02, f.z0 - 0.2, f.x1 + 0.2, 3.05, f.z1 + 0.2, 0.012, { scale: 1.6 });
          for (const [a0, b0, a1, b1] of [[f.x0 - 0.2, f.z1 + 0.18, f.x1 + 0.2, f.z1 + 0.21], [f.x0 - 0.2, f.z0 - 0.21, f.x1 + 0.2, f.z0 - 0.18], [f.x0 - 0.21, f.z0 - 0.2, f.x0 - 0.18, f.z1 + 0.2], [f.x1 + 0.18, f.z0 - 0.2, f.x1 + 0.21, f.z1 + 0.2]])
            B.box('cloth', a0, 2.55, b0, a1, 3.05, b1, 0.01, { scale: 1.6 });
          topY = 3.05;
        }
        dress.table(f, topY);
        break;
      }
      case 'chair': {
        for (const [px, pz] of posts(f, 0.2)) B.add('dark', turnedGeo(0.2, 1.6), mat4(px, 0, pz), { scale: 1.4, grain: 'v' });
        B.box('dark', f.x0 + 0.08, 1.6, f.z0 + 0.08, f.x1 - 0.08, 1.76, f.z1 - 0.08, 0.05, { scale: 1.5 });
        const table = nearestTable(cx, cz);
        if (table) {
          const tx = (table.x0 + table.x1) / 2;
          const tz = (table.z0 + table.z1) / 2;
          const horiz = Math.abs(tz - cz) > Math.abs(tx - cx);
          if (horiz) {
            const zz = tz > cz ? f.z0 + 0.14 : f.z1 - 0.14;
            for (const xx of [f.x0 + 0.16, f.x1 - 0.16]) B.box('dark', xx - 0.07, 1.76, zz - 0.07, xx + 0.07, 3.3, zz + 0.07, 0.03, { scale: 1.4, grain: 'v' });
            B.box('dark', f.x0 + 0.1, 3.05, zz - 0.08, f.x1 - 0.1, 3.32, zz + 0.08, 0.04, { scale: 1.4 });
            for (let k = 1; k < 4; k++) {
              const xx = f.x0 + 0.16 + ((f.x1 - f.x0 - 0.32) * k) / 4;
              B.box('dark', xx - 0.035, 1.76, zz - 0.035, xx + 0.035, 3.05, zz + 0.035, 0.015, { scale: 1.4, grain: 'v' });
            }
          } else {
            const xx = tx > cx ? f.x0 + 0.14 : f.x1 - 0.14;
            for (const zz of [f.z0 + 0.16, f.z1 - 0.16]) B.box('dark', xx - 0.07, 1.76, zz - 0.07, xx + 0.07, 3.3, zz + 0.07, 0.03, { scale: 1.4, grain: 'v' });
            B.box('dark', xx - 0.08, 3.05, f.z0 + 0.1, xx + 0.08, 3.32, f.z1 - 0.1, 0.04, { scale: 1.4 });
            for (let k = 1; k < 4; k++) {
              const zz = f.z0 + 0.16 + ((f.z1 - f.z0 - 0.32) * k) / 4;
              B.box('dark', xx - 0.035, 1.76, zz - 0.035, xx + 0.035, 3.05, zz + 0.035, 0.015, { scale: 1.4, grain: 'v' });
            }
          }
        }
        break;
      }
      case 'bed': {
        for (const [px, pz] of posts(f, 0.3)) B.add('dark', turnedGeo(0.42, 1.0), mat4(px, 0, pz), { scale: 1.6, grain: 'v' });
        B.box('dark', f.x0 + 0.08, 0.95, f.z0 + 0.12, f.x1 - 0.08, 1.25, f.z1 - 0.08, 0.04, { scale: 2 });
        B.box('linen', f.x0 + 0.14, 1.2, f.z0 + 0.3, f.x1 - 0.14, 1.7, f.z1 - 0.14, 0.16, { scale: 2 });
        B.box('quilt', f.x0 + 0.02, 1.12, f.z0 + 1.6, f.x1 - 0.02, 1.9, f.z1 + 0.02, 0.22, { scale: 2.4 });
        B.box('linen', f.x0 + 0.5, 1.7, f.z0 + 0.4, cx - 0.1, 2.15, f.z0 + 1.45, 0.2, { scale: 2 });
        B.box('linen', cx + 0.1, 1.7, f.z0 + 0.4, f.x1 - 0.5, 2.15, f.z0 + 1.45, 0.2, { scale: 2 });
        B.box('dark', f.x0 + 0.02, 0, f.z0 + 0.02, f.x1 - 0.02, 3.4, f.z0 + 0.26, 0.06, { scale: 2.5, grain: 'v' });
        B.box('dark', f.x0 - 0.04, 3.3, f.z0 - 0.02, f.x1 + 0.04, 3.5, f.z0 + 0.3, 0.06, { scale: 2.5 });
        if (world.snore && world.snore.x > f.x0 && world.snore.x < f.x1 && world.snore.z > f.z0 && world.snore.z < f.z1) {
          // The farmer asleep: a mound under the quilt and a nightcap on the pillow.
          const s = world.snore;
          B.add('quilt', rboxGeo(2.4, 0.9, 3.4, 0.42), mat4(s.x, 1.9, s.z + 0.8), { scale: 2.4 });
          B.add('linen', new THREE.SphereGeometry(0.55, 14, 10), mat4(s.x, 2.2, f.z0 + 1.1, 0, 1, 0.8, 1), { scale: 1 });
          B.add('cloth', new THREE.ConeGeometry(0.45, 0.9, 12), mat4(s.x + 0.1, 2.6, f.z0 + 0.95, 0, 1, 1, 1, -0.9, 0.3), { scale: 1 });
        }
        break;
      }
      case 'shelf': {
        for (const [px, pz] of posts(f, 0.16)) B.box('pine', px - 0.1, 0, pz - 0.1, px + 0.1, 2.62, pz + 0.1, 0.03, { scale: 1.6, grain: 'v' });
        B.box('pine', f.x0 + 0.04, 0.85, f.z0 + 0.04, f.x1 - 0.04, 0.97, f.z1 - 0.04, 0.025, { scale: 2 });
        B.box('pine', f.x0 + 0.02, 2.0, f.z0 + 0.02, f.x1 - 0.02, 2.13, f.z1 - 0.02, 0.025, { scale: 2 });
        dress.shelf(f, 2.13);
        break;
      }
      case 'stove': {
        const side = openSide(f);
        B.box('iron', f.x0 + 0.08, 0.25, f.z0 + 0.08, f.x1 - 0.08, 2.35, f.z1 - 0.08, 0.1, null);
        for (const [px, pz] of posts(f, 0.2)) B.box('iron', px - 0.1, 0, pz - 0.1, px + 0.1, 0.3, pz + 0.1, 0.04, null);
        B.box('iron', f.x0 - 0.04, 2.35, f.z0 - 0.04, f.x1 + 0.04, 2.5, f.z1 + 0.04, 0.05, null);
        for (let k = 0; k < Math.max(1, Math.floor(w / 1.6)); k++) {
          const hx = f.x0 + 0.9 + k * 1.6;
          if (hx > f.x1 - 0.6) break;
          B.add('iron', new THREE.CylinderGeometry(0.42, 0.42, 0.06, 20), mat4(hx, 2.53, cz), null);
        }
        const fz = side === 'n' ? f.z0 + 0.05 : f.z1 - 0.05;
        const dir = side === 'n' ? -1 : 1;
        B.box('iron', cx - w * 0.38, 0.55, fz - 0.03, cx - 0.06, 1.95, fz + 0.06 * dir + 0.03, 0.05, null);
        B.box('brass', cx - w * 0.36, 1.7, fz + 0.1 * dir - 0.03, cx - w * 0.08, 1.78, fz + 0.1 * dir + 0.03, 0.02, null);
        B.box('fire', cx + 0.1, 0.6, fz + 0.02 * dir - 0.02, cx + w * 0.36, 1.3, fz + 0.02 * dir + 0.02, 0.01, null);
        for (let gx = cx + 0.18; gx < cx + w * 0.36; gx += 0.16) B.box('iron', gx - 0.025, 0.6, fz + 0.06 * dir - 0.02, gx + 0.025, 1.3, fz + 0.06 * dir + 0.02, 0.008, null);
        B.add('iron', new THREE.CylinderGeometry(0.28, 0.28, 5, 16, 1, true), mat4(f.x0 + 0.6, 4.9, f.z0 + 0.5), null);
        P.add('brass_pot_01', f.x1 - 0.9, 2.56, cz, rnd() * 6, 1.0, 'w');
        lights.push({ kind: 'stove', x: cx + w * 0.23, z: fz + dir * 0.6 });
        extra.push({ kind: 'embers', x: cx + w * 0.23, y: 0.95, z: fz + dir * 0.1, w: w * 0.3 });
        break;
      }
      case 'cupboard': {
        const mat = night.id % 3 === 1 ? 'painted' : 'cabinet';
        B.box(mat, f.x0 + 0.04, 0.12, f.z0 + 0.04, f.x1 - 0.04, 2.78, f.z1 - 0.04, 0.05, { scale: 2.5, grain: 'v' });
        B.box('dark', f.x0 + 0.08, 0, f.z0 + 0.08, f.x1 - 0.08, 0.14, f.z1 - 0.08, 0.02, { scale: 2 });
        B.box('dark', f.x0 - 0.06, 2.78, f.z0 - 0.06, f.x1 + 0.06, 2.96, f.z1 + 0.06, 0.04, { scale: 2.5 });
        const face = openSide(f);
        const along = face === 's' || face === 'n';
        const len = along ? w : d;
        const n = Math.max(1, Math.round(len / 1.1));
        const pw = len / n;
        for (let k = 0; k < n; k++) {
          const a0 = (along ? f.x0 : f.z0) + k * pw + 0.12;
          const a1 = a0 + pw - 0.24;
          const o = face === 's' ? f.z1 - 0.02 : face === 'n' ? f.z0 + 0.02 : face === 'e' ? f.x1 - 0.02 : f.x0 + 0.02;
          const out = face === 's' || face === 'e' ? 1 : -1;
          const [ya, yb] = k % 2 ? [0.35, 1.45] : [0.35, 2.55];
          if (along) {
            B.box('dark', a0, ya, Math.min(o, o + 0.06 * out), a1, yb, Math.max(o, o + 0.06 * out), 0.02, { scale: 2, grain: 'v' });
            B.add('brass', new THREE.SphereGeometry(0.07, 10, 8), mat4(a1 - 0.14, (ya + yb) / 2, o + 0.1 * out), null);
          } else {
            B.box('dark', Math.min(o, o + 0.06 * out), ya, a0, Math.max(o, o + 0.06 * out), yb, a1, 0.02, { scale: 2, grain: 'v' });
            B.add('brass', new THREE.SphereGeometry(0.07, 10, 8), mat4(o + 0.1 * out, (ya + yb) / 2, a1 - 0.14), null);
          }
        }
        dress.counter(f, 2.96);
        break;
      }
      case 'sack': {
        const r = Math.min(w, d) * 0.48;
        const hh = 1.75;
        const prof = [[0.05, 0], [0.82, 0.01], [0.98, 0.12], [1.0, 0.35], [0.95, 0.6], [0.78, 0.8], [0.42, 0.9], [0.26, 0.94], [0.3, 1.0], [0.42, 1.04], [0.05, 1.06]];
        B.add('hessian', turnedGeo(r, hh, prof, 18), mat4(cx, 0, cz, rnd() * 6, 1, 1, 0.92 + rnd() * 0.12), { scale: 1.6, grain: 'v' });
        B.add('iron', new THREE.TorusGeometry(r * 0.3, 0.035, 6, 16), mat4(cx, hh * 0.93, cz, 0, 1, 1, 1, Math.PI / 2), null);
        const word = ['FLOUR', 'OATS', 'SUGAR', 'BRAN', 'MEAL'][Math.floor(rnd() * 5)];
        const label = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.005, r * 1.005, 0.62, 16, 1, true, -0.65, 1.3), patchEcho(new THREE.MeshStandardMaterial({ map: stencilTexture(word), transparent: true, depthWrite: false, roughness: 1 })));
        label.position.set(cx, hh * 0.42, cz);
        label.renderOrder = 2;
        group.add(label);
        break;
      }
      case 'jar':
        for (let z = f.z0; z < f.z1; z++) for (let x = f.x0; x < f.x1; x++) {
          const pick = ['jug_01', 'pot_enamel_01', 'planter_pot_clay', 'ceramic_vase_01', 'brass_pot_01'][(x * 3 + z * 5 + night.id) % 5];
          if (!P.add(pick, x + 0.5, 0, z + 0.5, rnd() * 6, 0.86, 'w')) B.add('ceramic', new THREE.CylinderGeometry(0.38, 0.32, 0.85, 16), mat4(x + 0.5, 0.425, z + 0.5), null);
        }
        break;
      case 'crate': {
        const hh = 1.7;
        B.box('dark', f.x0 + 0.1, 0.05, f.z0 + 0.1, f.x1 - 0.1, hh - 0.05, f.z1 - 0.1, 0.02, null);
        for (const [px, pz] of posts(f, 0.1)) B.box('crate', px - 0.08, 0, pz - 0.08, px + 0.08, hh, pz + 0.08, 0.02, { scale: 1.5, grain: 'v' });
        for (let y = 0.08; y < hh - 0.1; y += 0.42) {
          B.box('crate', f.x0 + 0.03, y, f.z1 - 0.07, f.x1 - 0.03, y + 0.3, f.z1 - 0.02, 0.015, { scale: 1.5 });
          B.box('crate', f.x0 + 0.03, y, f.z0 + 0.02, f.x1 - 0.03, y + 0.3, f.z0 + 0.07, 0.015, { scale: 1.5 });
          B.box('crate', f.x0 + 0.02, y, f.z0 + 0.03, f.x0 + 0.07, y + 0.3, f.z1 - 0.03, 0.015, { scale: 1.5 });
          B.box('crate', f.x1 - 0.07, y, f.z0 + 0.03, f.x1 - 0.02, y + 0.3, f.z1 - 0.03, 0.015, { scale: 1.5 });
        }
        for (let x = f.x0 + 0.05; x < f.x1 - 0.1; x += 0.36) B.box('crate', x, hh - 0.06, f.z0 + 0.04, x + 0.3, hh, f.z1 - 0.04, 0.012, { scale: 1.5, grain: 'z' });
        const word = ['APPLES', 'CHEESE', 'TURNIPS', 'EGGS'][Math.floor(rnd() * 4)];
        const label = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.6, w - 0.3), 0.7), patchEcho(new THREE.MeshStandardMaterial({ map: stencilTexture(word, '#2a1a10'), transparent: true, depthWrite: false, roughness: 1 })));
        label.position.set(cx, hh * 0.5, f.z1 - 0.015);
        label.renderOrder = 2;
        group.add(label);
        dress.crate(f, hh);
        break;
      }
      case 'churn':
        for (let z = f.z0; z < f.z1; z++) for (let x = f.x0; x < f.x1; x++) {
          if (!P.add('metal_jug', x + 0.5, 0, z + 0.5, rnd() * 6, 0.9, 'w')) B.add('tin', new THREE.CylinderGeometry(0.42, 0.42, 1.3, 18), mat4(x + 0.5, 0.65, z + 0.5), null);
        }
        break;
      case 'barrel':
        for (let z = f.z0; z < f.z1; z++) for (let x = f.x0; x < f.x1; x++) {
          if (!P.add('wine_barrel_01', x + 0.5, 0, z + 0.5, rnd() * 6, 0.98, 'w')) B.add('dark', new THREE.CylinderGeometry(0.46, 0.46, 1.4, 18), mat4(x + 0.5, 0.7, z + 0.5), null);
        }
        break;
      case 'hay': {
        const nx = Math.max(1, Math.round(w / 1.6));
        const nz = Math.max(1, Math.round(d / 1.1));
        const bw = w / nx;
        const bd = d / nz;
        for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
          const x0 = f.x0 + i * bw;
          const z0 = f.z0 + k * bd;
          const hh = 1.35 + rnd() * 0.25;
          B.add('straw', rboxGeo(bw - 0.06, hh, bd - 0.06, 0.16), mat4(x0 + bw / 2, hh / 2, z0 + bd / 2, (rnd() - 0.5) * 0.06), { scale: 1.4 });
          for (const t of [0.3, 0.7]) B.box('iron', x0 + bw * t - 0.03, 0.02, z0, x0 + bw * t + 0.03, hh + 0.02, z0 + bd, 0.01, null);
        }
        dress.hay(f, 1.5);
        break;
      }
      case 'rack': {
        for (const [px, pz] of posts(f, 0.1)) B.box('dark', px - 0.08, 0, pz - 0.08, px + 0.08, 3.0, pz + 0.08, 0.02, { scale: 1.5, grain: 'v' });
        for (const y of [0.15, 1.15, 2.15]) {
          B.box('pine', f.x0 + 0.04, y, f.z0 + 0.04, f.x1 - 0.04, y + 0.1, f.z1 - 0.04, 0.02, { scale: 2 });
          for (let x = f.x0 + 0.55; x < f.x1 - 0.3; x += 0.95) {
            B.add('rind', new THREE.CylinderGeometry(0.4, 0.4, 0.42, 24), mat4(x, y + 0.31, cz + (rnd() - 0.5) * 0.15), null);
          }
        }
        if (rnd() < 0.6) P.add('CheeseBox_01', f.x1 - 0.9, 2.25, cz, rnd() * 0.4, 1.1, 'w');
        break;
      }
      case 'clock': {
        if (!P.add('vintage_grandfather_clock_01', cx, 0, cz + 0.05, 0, Math.min(w, 2) * 0.98, 'w', 0.72)) B.box('dark', f.x0 + 0.1, 0, f.z0 + 0.15, f.x1 - 0.1, 3.4, f.z1 - 0.05, 0.05, null);
        lights.push({ kind: 'clock', x: cx, z: cz });
        break;
      }
    }
  }

  // ---- the mousehole: an arch in the wall, warm inside, a framed doorway and a doormat
  const h = world.hole;
  const holeGroup = new THREE.Group();
  const faceX = h.cx + 0.5 + h.wx * 0.5;
  const faceZ = h.cz + 0.5 + h.wz * 0.5;
  holeGroup.position.set(faceX - h.wx * 0.005, 0, faceZ - h.wz * 0.005);
  holeGroup.rotation.y = Math.atan2(-h.wx, -h.wz);
  const archShape = new THREE.Shape();
  archShape.moveTo(-0.5, 0);
  archShape.lineTo(-0.5, 0.45);
  archShape.absarc(0, 0.45, 0.5, Math.PI, 0, true);
  archShape.lineTo(0.5, 0);
  archShape.lineTo(-0.5, 0);
  const inside = new THREE.Mesh(new THREE.ShapeGeometry(archShape, 20), new THREE.MeshBasicMaterial({ map: holeTexture(), color: 0xff9a3c, toneMapped: false }));
  inside.position.z = 0.012;
  holeGroup.add(inside);
  const arc = new THREE.Path();
  arc.absarc(0, 0.45, 0.57, Math.PI, 0, true);
  const pts = [new THREE.Vector3(-0.57, 0, 0), ...arc.getPoints(16).map((p) => new THREE.Vector3(p.x, p.y, 0)), new THREE.Vector3(0.57, 0, 0)];
  const frame = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 40, 0.075, 8, false), mats.pine);
  frame.position.z = 0.04;
  frame.castShadow = true;
  holeGroup.add(frame);
  group.add(holeGroup);
  const doormat = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62).rotateX(-Math.PI / 2), patchEcho(new THREE.MeshStandardMaterial({ map: doormatTexture(), roughness: 1 })));
  doormat.position.set(h.cx + 0.5 - h.wx * 0.15, 0.02, h.cz + 0.5 - h.wz * 0.15);
  doormat.rotation.y = Math.atan2(-h.wx, -h.wz);
  doormat.receiveShadow = true;
  group.add(doormat);

  // ---- the door the wife comes in by (night 1)
  if (world.door) {
    const dd = world.door;
    const door = new THREE.Group();
    const slab = new THREE.Mesh(rboxGeo(0.14, WALL_H + 0.4, 2.2, 0.03), mats.dark);
    slab.position.set(0, (WALL_H + 0.4) / 2, -1.1);
    slab.castShadow = true;
    door.add(slab);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mats.brass);
    knob.position.set(-0.12, 1.6, -1.9);
    door.add(knob);
    door.position.set(dd.x + 0.45, 0, dd.z + 1.1);
    group.add(door);
    animated.push({ kind: 'door', mesh: door, x: dd.x, z: dd.z });
  }

  // ---- merge, instance
  const statics = B.merge(mats, group);
  for (const s of statics) if (['wall', 'cap', 'skirting', 'wainscot', 'curtain', 'frame'].includes(s.name)) s.castShadow = false;
  const instanced = P.build(group);
  for (const m of instanced) if (/HourHand|MinuteHand/.test(m.name)) animated.push({ kind: 'hand', mesh: m, minute: /Minute/.test(m.name) });
  return { group, animated, lights, windows, extra, mats, floor, hole: holeGroup, holeInside: inside, statics, instanced };
}

function mergeAll(geos) {
  const g = new THREE.BufferGeometry();
  const parts = geos.map((x) => (x.index ? x.toNonIndexed() : x));
  const n = parts.reduce((a, p) => a + p.attributes.position.count, 0);
  for (const name of ['position', 'normal', 'uv']) {
    const size = parts[0].attributes[name].itemSize;
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const p of parts) {
      arr.set(p.attributes[name].array, o);
      o += p.attributes[name].array.length;
    }
    g.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return g;
}

let holeTex = null;
function holeTexture() {
  if (holeTex) return holeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 118, 4, 64, 96, 96);
  grad.addColorStop(0, '#fff3c0');
  grad.addColorStop(0.35, '#ffb040');
  grad.addColorStop(0.75, '#5a1c06');
  grad.addColorStop(1, '#1a0602');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  holeTex = new THREE.CanvasTexture(c);
  holeTex.colorSpace = THREE.SRGBColorSpace;
  return holeTex;
}

// ---------------------------------------------------------------- dressing: what sits on tables, shelves and counters

function createDresser(P, rnd, night) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const scatter = (x0, z0, x1, z1, y, items, gap = 1.2) => {
    const placed = [];
    for (const [id, fit, by] of items) {
      for (let tries = 0; tries < 10; tries++) {
        const x = x0 + 0.55 + rnd() * Math.max(0.01, x1 - x0 - 1.1);
        const z = z0 + 0.55 + rnd() * Math.max(0.01, z1 - z0 - 1.1);
        if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < gap)) continue;
        if (P.add(id, x, y, z, rnd() * Math.PI * 2, fit, by)) placed.push([x, z]);
        break;
      }
    }
  };
  return {
    table(f, y) {
      const big = (f.x1 - f.x0) * (f.z1 - f.z0) >= 16;
      const items = [];
      if (night.id === 12 || night.id === 11) {
        items.push(['CheeseBox_01', 1.5, 'w'], ['CheeseBox_01', 1.3, 'w'], ['wooden_cutting_board', 2.4, 'w'], ['wicker_basket_01', 2.0, 'w']);
      } else if (night.id === 10) {
        items.push(['wooden_bucket_01', 1.4, 'h'], ['watering_can_metal_01', 1.3, 'h'], ['wicker_basket_02', 1.6, 'w']);
      } else {
        items.push(['wooden_cutting_board', 2.6, 'w'], ['croissant', 1.2, 'w'], ['jug_01', 1.5, 'h'], ['wooden_bowl_01', 1.8, 'w'], ['wooden_candlestick', 1.3, 'h']);
        if (big) items.push(['food_apple_01', 0.55, 'w'], ['food_apple_01', 0.55, 'w'], ['yellow_onion', 0.5, 'w'], ['carved_wooden_plate', 1.7, 'w'], ['vintage_oil_lamp', 2.0, 'h']);
        if (night.id === 5) items.push(['carved_wooden_plate', 1.7, 'w'], ['carved_wooden_plate', 1.7, 'w'], ['wooden_spoon', 1.4, 'w']);
      }
      scatter(f.x0, f.z0, f.x1, f.z1, y, items, 1.3);
    },
    shelf(f, y) {
      const items = [];
      for (let x = f.x0 + 0.6; x < f.x1 - 0.4; x += 1.1) items.push([pick(['jug_01', 'pot_enamel_01', 'planter_pot_clay', 'ceramic_vase_01', 'brass_pot_01', 'wooden_bowl_02', 'wicker_basket_02']), 0.85, 'w']);
      scatter(f.x0, f.z0, f.x1, f.z1, y, items, 0.95);
    },
    counter(f, y) {
      const items = [];
      const n = Math.floor(((f.x1 - f.x0) * (f.z1 - f.z0)) / 4);
      for (let i = 0; i < n; i++) items.push(pick([['wicker_basket_01', 1.6, 'w'], ['jug_01', 1.2, 'h'], ['carved_wooden_plate', 1.4, 'w'], ['wooden_bowl_01', 1.4, 'w'], ['mantel_clock_01', 1.6, 'w'], ['pot_enamel_01', 1.3, 'w'], ['vintage_oil_lamp', 1.8, 'h']]));
      scatter(f.x0, f.z0, f.x1, f.z1, y, items, 1.2);
    },
    crate(f, y) {
      if (rnd() < 0.5) scatter(f.x0, f.z0, f.x1, f.z1, y, [[pick(['wicker_basket_02', 'wooden_bucket_01', 'wooden_lantern_01']), 1.0, 'h']], 1);
    },
    hay(f, y) {
      if (rnd() < 0.4) scatter(f.x0, f.z0, f.x1, f.z1, y, [[pick(['wooden_bucket_01', 'wicker_basket_01']), 1.1, 'h']], 1);
    },
  };
}

export function disposeLevel(level) {
  level.group.traverse((o) => {
    if (o.isInstancedMesh) {
      o.geometry.dispose?.();
      o.dispose?.();
      return;
    }
    if (o.geometry) o.geometry.dispose?.();
  });
  for (const m of Object.values(level.mats)) m.dispose?.();
}

export { PALETTE };
