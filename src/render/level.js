// A night's room in 3D: floor, cut-away walls, furniture made of simple solids, rugs, the creaky patches, the mousehole, and
// every edge as one mesh of lines the echoes light. Static geometry is merged per material.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { patchEcho, edgesOf, PALETTE } from './echo.js';
import { floorTextures, rugTexture, quiltTexture, patchTexture, doormatTexture } from './textures.js';

export const WALL_H = 3.0;

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...o });

function makeMaterials(night) {
  const painted = [0x6e7f5e, 0x8a5a44, 0x5d6b7a, 0x7a6a4e][night.id % 4];
  const plaster = [0x6b5b4e, 0x5e6455, 0x6d5f6a, 0x5f564b][night.id % 4];
  const m = {
    wood: std(0x7a4a2a),
    dark: std(0x45291a),
    light: std(0x9b7048),
    painted: std(painted, { roughness: 0.7 }),
    plaster: std(plaster, { roughness: 0.95 }),
    cap: std(0x17151d, { roughness: 1 }),
    iron: std(0x2d2c31, { roughness: 0.5, metalness: 0.55 }),
    brass: std(0xb8862b, { roughness: 0.35, metalness: 0.8 }),
    tin: std(0x9aa3ad, { roughness: 0.4, metalness: 0.7 }),
    burlap: std(0x9c7b4f, { roughness: 1 }),
    ceramic: std(0xd9d2c0, { roughness: 0.4 }),
    enamel: std(0x3e6da8, { roughness: 0.35 }),
    straw: std(0xc9a24a, { roughness: 1 }),
    cheese: std(0xf2c14e, { roughness: 0.6 }),
    rind: std(0xd99a2b, { roughness: 0.55 }),
    linen: std(0xe8e0cf, { roughness: 0.9 }),
    quilt: std(0xffffff, { roughness: 0.9, map: quiltTexture() }),
    cloth: std(0x8c2f2b, { roughness: 0.9 }),
    fire: new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff5a1f, emissiveIntensity: 1.6, roughness: 1 }),
    face: new THREE.MeshStandardMaterial({ color: 0xe8dcc0, emissive: 0xfff1d6, emissiveIntensity: 0.12, roughness: 0.6 }),
  };
  for (const [k, mat] of Object.entries(m)) if (k !== 'fire' && k !== 'face') patchEcho(mat, { fill: k === 'cap' ? 0.3 : 1 });
  return m;
}

// Greedy rectangles of wall cells.
function wallRects(world, front) {
  const { W, D } = world;
  const used = new Uint8Array(W * D);
  const isWall = (x, z) => world.info(x, z).wall && isFront(world, x, z) === front && !used[z * W + x];
  const rects = [];
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      if (!isWall(x, z)) continue;
      let x1 = x;
      while (x1 + 1 < W && isWall(x1 + 1, z)) x1++;
      let z1 = z;
      outer: while (z1 + 1 < D) {
        for (let xx = x; xx <= x1; xx++) if (!isWall(xx, z1 + 1)) break outer;
        z1++;
      }
      for (let zz = z; zz <= z1; zz++) for (let xx = x; xx <= x1; xx++) used[zz * W + xx] = 1;
      rects.push([x, z, x1 + 1, z1 + 1]);
    }
  }
  return rects;
}

// A wall with the room behind it (north, away from the camera) is cut low, like a dollhouse, so it never hides the floor.
function isFront(world, x, z) {
  const n = world.info(x, z - 1);
  return !n.wall && n.code !== 0;
}
export const FRONT_H = 1.0;

// Rectangles of cells of one noise kind.
function patchRects(world, kind) {
  const { W, D } = world;
  const used = new Uint8Array(W * D);
  const is = (x, z) => world.info(x, z).noise === kind && !used[z * W + x];
  const rects = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (!is(x, z)) continue;
    let x1 = x;
    while (x1 + 1 < W && is(x1 + 1, z)) x1++;
    let z1 = z;
    outer: while (z1 + 1 < D) {
      for (let xx = x; xx <= x1; xx++) if (!is(xx, z1 + 1)) break outer;
      z1++;
    }
    for (let zz = z; zz <= z1; zz++) for (let xx = x; xx <= x1; xx++) used[zz * W + xx] = 1;
    rects.push([x, z, x1 + 1, z1 + 1]);
  }
  return rects;
}

function rugRects(world) {
  const { W, D } = world;
  const used = new Uint8Array(W * D);
  const is = (x, z) => world.info(x, z).rug && !used[z * W + x];
  const rects = [];
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    if (!is(x, z)) continue;
    let x1 = x;
    while (x1 + 1 < W && is(x1 + 1, z)) x1++;
    let z1 = z;
    outer: while (z1 + 1 < D) {
      for (let xx = x; xx <= x1; xx++) if (!is(xx, z1 + 1)) break outer;
      z1++;
    }
    for (let zz = z; zz <= z1; zz++) for (let xx = x; xx <= x1; xx++) used[zz * W + xx] = 1;
    rects.push([x, z, x1 + 1, z1 + 1]);
  }
  return rects;
}

const M4 = () => new THREE.Matrix4();
const at = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) =>
  M4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const SPH = new THREE.SphereGeometry(1, 12, 9);
const TOR = new THREE.TorusGeometry(1, 0.06, 6, 18);

export function buildLevel(world) {
  const night = world.night;
  const mats = makeMaterials(night);
  const buckets = new Map();
  const segs = [];
  const group = new THREE.Group();
  const tops = [];
  const animated = [];
  const lights = [];

  const add = (matKey, geo, matrix, edges = true, threshold = 28) => {
    const g = geo.clone();
    g.applyMatrix4(matrix);
    if (g.index) {
      // Merge needs the same attributes everywhere: keep position, normal, uv.
    }
    if (!buckets.has(matKey)) buckets.set(matKey, []);
    buckets.get(matKey).push(g);
    if (edges) edgesOf(geo, matrix, segs, threshold);
  };
  const box = (mat, x0, y0, z0, x1, y1, z1, edges = true) => add(mat, BOX, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, x1 - x0, y1 - y0, z1 - z0), edges);
  const cyl = (mat, x, y0, z, r, h, edges = true, geo = CYL) => add(mat, geo, at(x, y0 + h / 2, z, 0, r, h, r), edges, 40);

  // ---- floor
  const style = { 4: 'stone', 10: 'barn', 11: 'stone', 12: 'tiles' }[night.id] ?? 'planks';
  const ft = floorTextures(style, night.id);
  ft.map.repeat.set(1, 1);
  const floorMat = patchEcho(new THREE.MeshStandardMaterial({ map: ft.map, roughness: 0.82, color: 0xffffff }), { seams: ft.seams, fill: 1 });
  const fg = new THREE.PlaneGeometry(world.W, world.D, 1, 1);
  fg.rotateX(-Math.PI / 2);
  fg.translate(world.W / 2, 0, world.D / 2);
  const uv = fg.attributes.uv;
  const pos = fg.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 8, -pos.getZ(i) / 8);
  const floor = new THREE.Mesh(fg, floorMat);
  floor.receiveShadow = true;
  group.add(floor);

  // ---- walls
  for (const front of [false, true]) {
    const H = front ? FRONT_H : WALL_H;
    for (const [x0, z0, x1, z1] of wallRects(world, front)) {
      box('dark', x0, 0, z0, x1, 0.45, z1, false);
      box('plaster', x0, 0.45, z0, x1, H, z1, false);
      box('cap', x0, H, z0, x1, H + 0.04, z1, false);
      edgesOf(BOX, at((x0 + x1) / 2, H / 2, (z0 + z1) / 2, 0, x1 - x0, H, z1 - z0), segs);
    }
  }

  // ---- rugs and patches
  const rugGroup = [];
  rugRects(world).forEach(([x0, z0, x1, z1], i) => {
    const mat = patchEcho(new THREE.MeshStandardMaterial({ map: rugTexture(night.id + i), roughness: 1 }), { fill: 1.2 });
    const g = new THREE.PlaneGeometry(x1 - x0 - 0.1, z1 - z0 - 0.1);
    g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set((x0 + x1) / 2, 0.025, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    rugGroup.push(mesh);
    group.add(mesh);
    edgesOf(new THREE.BoxGeometry(x1 - x0 - 0.1, 0.05, z1 - z0 - 0.1), at((x0 + x1) / 2, 0.02, (z0 + z1) / 2), segs);
  });
  for (const kind of ['creak', 'crumbs']) {
    const rects = patchRects(world, kind);
    if (!rects.length) continue;
    const t = patchTexture(kind);
    t.repeat.set(1, 1);
    const mat = patchEcho(new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, color: kind === 'creak' ? 0xffa070 : 0xffd090, roughness: 1, opacity: 0.9 }), { fill: 3.2, front: 1.5 });
    const geos = rects.map(([x0, z0, x1, z1]) => {
      const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
      g.rotateX(-Math.PI / 2);
      const u2 = g.attributes.uv;
      const p2 = g.attributes.position;
      for (let i = 0; i < u2.count; i++) u2.setXY(i, (p2.getX(i) + (x0 + x1) / 2) * 0.9, (p2.getZ(i) + (z0 + z1) / 2) * 0.9);
      g.translate((x0 + x1) / 2, 0.035, (z0 + z1) / 2);
      return g;
    });
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  for (const [x0, z0, x1, z1] of patchRects(world, 'pan')) {
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      cyl('tin', x + 0.5, 0, z + 0.5, 0.42, 0.18);
      add('dark', CYL8, at(x + 0.95, 0.12, z + 0.5, 0, 0.05, 0.05, 0.5).multiply(M4().makeRotationZ(Math.PI / 2)), false);
    }
  }

  // ---- furniture
  for (const f of world.furniture) {
    const w = f.x1 - f.x0;
    const d = f.z1 - f.z0;
    const cx = (f.x0 + f.x1) / 2;
    const cz = (f.z0 + f.z1) / 2;
    const legs = (h, mat = 'wood', size = 0.26) => {
      const inset = f.type === 'bed' ? 0.3 : 0.22;
      for (const [px, pz] of [[f.x0 + inset, f.z0 + inset], [f.x1 - inset, f.z0 + inset], [f.x0 + inset, f.z1 - inset], [f.x1 - inset, f.z1 - inset]]) box(mat, px - size / 2, 0, pz - size / 2, px + size / 2, h, pz + size / 2);
    };
    const top = (mat, y0, y1, inset = 0.02) => {
      // Tops of covers fade when a mouse is under them: their own meshes.
      const g = new THREE.BoxGeometry(w - inset * 2, y1 - y0, d - inset * 2);
      const material = mats[mat].clone();
      patchEcho(material);
      material.transparent = true;
      const mesh = new THREE.Mesh(g, material);
      mesh.position.set(cx, (y0 + y1) / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      tops.push({ mesh, f, fade: 1 });
      edgesOf(g, at(cx, (y0 + y1) / 2, cz), segs);
    };
    switch (f.type) {
      case 'table':
        legs(2.8, 'wood', 0.3);
        top('wood', 2.8, 3.0, -0.12);
        break;
      case 'chair': {
        legs(1.6, 'dark', 0.18);
        top('dark', 1.6, 1.75, 0.08);
        // A backrest on the side away from the nearest table.
        const table = world.furniture.filter((t) => t.type === 'table').sort((a, b) => Math.hypot((a.x0 + a.x1) / 2 - cx, (a.z0 + a.z1) / 2 - cz) - Math.hypot((b.x0 + b.x1) / 2 - cx, (b.z0 + b.z1) / 2 - cz))[0];
        if (table) {
          const tx = (table.x0 + table.x1) / 2;
          const tz = (table.z0 + table.z1) / 2;
          const horiz = Math.abs(tz - cz) > Math.abs(tx - cx);
          if (horiz) {
            const zz = tz > cz ? f.z0 + 0.12 : f.z1 - 0.12;
            box('dark', f.x0 + 0.12, 1.75, zz - 0.06, f.x1 - 0.12, 3.1, zz + 0.06);
          } else {
            const xx = tx > cx ? f.x0 + 0.12 : f.x1 - 0.12;
            box('dark', xx - 0.06, 1.75, f.z0 + 0.12, xx + 0.06, 3.1, f.z1 - 0.12);
          }
        }
        break;
      }
      case 'bed':
        legs(0.95, 'dark', 0.34);
        box('dark', f.x0 + 0.1, 0.95, f.z0 + 0.1, f.x1 - 0.1, 1.25, f.z1 - 0.1);
        top('quilt', 1.25, 1.9, 0.1);
        box('linen', f.x0 + 0.5, 1.9, f.z0 + 0.35, f.x1 - 0.5, 2.25, f.z0 + 1.3);
        box('dark', f.x0 + 0.05, 0, f.z0 + 0.02, f.x1 - 0.05, 3.2, f.z0 + 0.22);
        break;
      case 'shelf': {
        legs(2.6, 'wood', 0.2);
        top('light', 0.85, 0.98, 0.05);
        box('light', f.x0 + 0.05, 2.0, f.z0 + 0.05, f.x1 - 0.05, 2.12, f.z1 - 0.05);
        // Jars and tins on the upper board.
        let k = 0;
        for (let x = f.x0 + 0.5; x < f.x1 - 0.2; x += 0.8, k++) {
          const z = cz + ((k % 2) - 0.5) * 0.3;
          cyl(k % 3 === 0 ? 'enamel' : k % 3 === 1 ? 'ceramic' : 'tin', x, 2.12, z, 0.22, 0.45 + (k % 2) * 0.2, false);
        }
        break;
      }
      case 'stove':
        box('iron', f.x0 + 0.05, 0, f.z0 + 0.05, f.x1 - 0.05, 2.5, f.z1 - 0.05);
        box('iron', f.x0 - 0.02, 2.5, f.z0 - 0.02, f.x1 + 0.02, 2.62, f.z1 + 0.02);
        box('fire', cx - w * 0.22, 0.45, f.z1 - 0.04, cx + w * 0.22, 1.25, f.z1 + 0.01, false);
        cyl('iron', f.x0 + 0.7, 2.62, f.z0 + 0.6, 0.3, 1.2);
        lights.push({ kind: 'stove', x: cx, z: f.z1 + 0.4 });
        break;
      case 'cupboard': {
        const mat = night.id % 2 ? 'painted' : 'wood';
        box(mat, f.x0 + 0.03, 0, f.z0 + 0.03, f.x1 - 0.03, 2.9, f.z1 - 0.03);
        box('dark', f.x0 - 0.04, 2.9, f.z0 - 0.04, f.x1 + 0.04, 3.05, f.z1 + 0.04);
        // Door panels on the open sides.
        const faces = [];
        if (world.info(f.x0, f.z1).floor || world.info(Math.floor(cx), f.z1).floor) faces.push('s');
        if (world.info(Math.floor(cx), f.z0 - 1).floor) faces.push('n');
        for (const face of faces) {
          const zz = face === 's' ? f.z1 - 0.01 : f.z0 + 0.01;
          for (let x = f.x0 + 0.15; x < f.x1 - 0.5; x += 1.0) {
            box('dark', x + 0.05, 0.3, zz - 0.03, x + 0.85, 2.6, zz + 0.03);
          }
        }
        break;
      }
      case 'sack':
        for (let z = f.z0; z < f.z1; z++) for (let x = f.x0; x < f.x1; x++) {
          add('burlap', SPH, at(x + 0.5, 0.55, z + 0.5, (x * 7 + z) * 0.7, 0.5, 0.6, 0.46), true, 50);
          cyl('burlap', x + 0.5, 1.05, z + 0.5, 0.12, 0.3, false, CYL8);
        }
        break;
      case 'jar':
        for (let z = f.z0; z < f.z1; z++) for (let x = f.x0; x < f.x1; x++) {
          const mat = (x + z) % 2 ? 'enamel' : 'ceramic';
          cyl(mat, x + 0.5, 0, z + 0.5, 0.38, 0.85);
          cyl('dark', x + 0.5, 0.85, z + 0.5, 0.3, 0.12);
        }
        break;
      case 'crate':
        box('light', f.x0 + 0.05, 0, f.z0 + 0.05, f.x1 - 0.05, 1.7, f.z1 - 0.05);
        for (let y = 0.35; y < 1.7; y += 0.45) {
          segs.push(f.x0 + 0.05, y, f.z1 - 0.04, f.x1 - 0.05, y, f.z1 - 0.04);
          segs.push(f.x0 + 0.05, y, f.z0 + 0.04, f.x1 - 0.05, y, f.z0 + 0.04);
        }
        break;
      case 'churn':
        for (let z = f.z0; z < f.z1; z++) for (let x = f.x0; x < f.x1; x++) {
          cyl('tin', x + 0.5, 0, z + 0.5, 0.42, 1.3);
          cyl('tin', x + 0.5, 1.3, z + 0.5, 0.24, 0.35);
          cyl('tin', x + 0.5, 1.65, z + 0.5, 0.3, 0.1);
        }
        break;
      case 'barrel':
        for (let z = f.z0; z < f.z1; z++) for (let x = f.x0; x < f.x1; x++) {
          cyl('wood', x + 0.5, 0, z + 0.5, 0.46, 1.5);
          for (const y of [0.3, 1.2]) add('iron', TOR, at(x + 0.5, y, z + 0.5, 0, 0.47, 0.47, 0.47).multiply(M4().makeRotationX(Math.PI / 2)), false);
        }
        break;
      case 'hay':
        box('straw', f.x0 + 0.05, 0, f.z0 + 0.05, f.x1 - 0.05, 1.5, f.z1 - 0.05);
        for (let x = f.x0 + 0.6; x < f.x1 - 0.3; x += 1.2) box('burlap', x - 0.04, 1.5, f.z0 + 0.05, x + 0.04, 1.53, f.z1 - 0.05, false);
        break;
      case 'rack': {
        for (const [px, pz] of [[f.x0 + 0.1, f.z0 + 0.1], [f.x1 - 0.1, f.z0 + 0.1], [f.x0 + 0.1, f.z1 - 0.1], [f.x1 - 0.1, f.z1 - 0.1]]) box('dark', px - 0.08, 0, pz - 0.08, px + 0.08, 3.0, pz + 0.08);
        box('dark', f.x0 + 0.05, 0, f.z0 + 0.05, f.x1 - 0.05, 0.15, f.z1 - 0.05);
        for (const y of [0.15, 1.15, 2.15]) {
          box('wood', f.x0 + 0.05, y, f.z0 + 0.05, f.x1 - 0.05, y + 0.08, f.z1 - 0.05, y === 0.15);
          for (let x = f.x0 + 0.55; x < f.x1 - 0.3; x += 0.95) {
            add('rind', CYL, at(x, y + 0.08 + 0.32, cz, 0, 0.4, 0.64, 0.4).multiply(M4().makeRotationX(Math.PI / 2)), y === 2.15, 40);
          }
        }
        break;
      }
      case 'clock': {
        box('dark', f.x0 + 0.1, 0, f.z0 + 0.15, f.x1 - 0.1, 3.2, f.z1 - 0.05);
        const face = new THREE.Mesh(new THREE.CircleGeometry(Math.min(w, 1) * 0.36, 24), mats.face);
        face.rotation.x = -Math.PI / 2;
        face.position.set(cx, 3.22, cz);
        group.add(face);
        const pend = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), mats.brass);
        pend.rotation.x = Math.PI / 2;
        pend.position.set(cx, 1.0, f.z1 - 0.02);
        group.add(pend);
        animated.push({ kind: 'pendulum', mesh: pend, x: cx });
        break;
      }
    }
  }

  // ---- the mousehole: an arch in the wall, warm inside
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
  const inside = new THREE.Mesh(new THREE.ShapeGeometry(archShape, 16), new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
  inside.material.toneMapped = false;
  inside.position.z = 0.012;
  holeGroup.add(inside);
  const innerDark = new THREE.Mesh(new THREE.ShapeGeometry(archShape, 16), new THREE.MeshBasicMaterial({ color: 0x2a0f04 }));
  innerDark.scale.set(0.72, 0.8, 1);
  innerDark.position.set(0, 0.0, 0.016);
  holeGroup.add(innerDark);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.07, 6, 20, Math.PI), mats.light);
  frame.position.set(0, 0.45, 0.03);
  holeGroup.add(frame);
  for (const sx of [-0.56, 0.56]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.1), mats.light);
    post.position.set(sx, 0.225, 0.03);
    holeGroup.add(post);
  }
  group.add(holeGroup);
  // A doormat.
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.56).rotateX(-Math.PI / 2), patchEcho(new THREE.MeshStandardMaterial({ map: doormatTexture(), roughness: 1 })));
  mat.position.set(h.cx + 0.5 - h.wx * 0.1, 0.03, h.cz + 0.5 - h.wz * 0.1);
  mat.rotation.y = Math.atan2(-h.wx, -h.wz);
  group.add(mat);

  // ---- the door the wife comes in by (night 1)
  if (world.door) {
    const d = world.door;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, WALL_H, 2.2), mats.dark);
    door.position.set(d.x + 0.4, WALL_H / 2, d.z - 1.2);
    door.rotation.y = 0;
    group.add(door);
    animated.push({ kind: 'door', mesh: door, x: d.x, z: d.z });
  }

  // ---- merge static geometry
  const statics = [];
  for (const [key, geos] of buckets) {
    const merged = mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mats[key]);
    mesh.castShadow = key !== 'cap' && key !== 'fire';
    mesh.receiveShadow = true;
    group.add(mesh);
    statics.push(mesh);
  }

  return { group, segs, tops, animated, lights, mats, floor, hole: holeGroup, holeInside: inside, rugs: rugGroup, statics };
}

export function disposeLevel(level) {
  level.group.traverse((o) => {
    if (o.geometry && o.geometry !== BOX) o.geometry.dispose?.();
    if (o.material) {
      for (const m of [].concat(o.material)) {
        for (const k of ['map']) m[k]?.dispose?.();
        m.dispose?.();
      }
    }
  });
}

export { PALETTE };
