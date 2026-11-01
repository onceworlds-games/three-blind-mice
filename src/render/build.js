// Building blocks for the rooms: geometry helpers (rounded boxes, turned legs, world-space texture coordinates, merging by
// material) and each night's set of materials (floor, walls, woods, cloths, metals).

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbr } from './assets.js';
import { patchEcho } from './echo.js';
import { strawTexture } from './textures.js';

// ---------------------------------------------------------------- geometry

const V = new THREE.Vector3();
const Q = new THREE.Quaternion();
const S = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

export function mat4(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  const m = new THREE.Matrix4();
  const e = new THREE.Euler(rx, ry, rz, 'YXZ');
  Q.setFromEuler(e);
  V.set(x, y, z);
  S.set(sx, sy, sz);
  return m.compose(V, Q, S);
}

// Texture coordinates from world positions, projected along each face's main axis: textures keep their size whatever the
// piece. scale: world units per tile. grain: 'x' | 'y' | 'z', which way the texture's horizontal runs on side faces.
export function worldUV(g, scale = 2, { grain = 'h', offset = 0 } = {}) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    let u;
    let v;
    if (ay >= ax && ay >= az) {
      u = x;
      v = z;
      if (grain === 'z') [u, v] = [v, u];
    } else if (ax >= az) {
      u = z;
      v = y;
      if (grain === 'v') [u, v] = [v, u];
    } else {
      u = x;
      v = y;
      if (grain === 'v') [u, v] = [v, u];
    }
    uv[i * 2] = u / scale + offset;
    uv[i * 2 + 1] = v / scale + offset * 0.37;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

const RB = new Map();
// A unit-ish rounded box of a size and corner radius (cached by shape).
export function rboxGeo(w, h, d, r = 0.05, seg = 2) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const key = `${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}:${seg}`;
  if (!RB.has(key)) RB.set(key, new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, r)));
  return RB.get(key);
}

// A turned leg: a lathe from a profile of [radius, height] pairs (from the floor up), scaled to height h and radius r.
const LEG_PROFILE = [
  [0.55, 0], [0.62, 0.03], [0.5, 0.06], [0.42, 0.12], [0.5, 0.2], [0.62, 0.24], [0.5, 0.28], [0.36, 0.34], [0.32, 0.5], [0.36, 0.66], [0.48, 0.72], [0.58, 0.76], [0.48, 0.8], [0.62, 0.84], [0.62, 1],
];
const lathes = new Map();
export function turnedGeo(r, h, profile = LEG_PROFILE, seg = 10) {
  const key = `${r}:${h}:${profile.length}:${seg}`;
  if (!lathes.has(key)) {
    const pts = profile.map(([pr, py]) => new THREE.Vector2(Math.max(0.001, pr * r), py * h));
    const g = new THREE.LatheGeometry(pts, seg);
    g.computeVertexNormals();
    lathes.set(key, g);
  }
  return lathes.get(key);
}

// Collects geometry per material key in world space, merges at the end.
export function createBuckets() {
  const buckets = new Map();
  return {
    // Adds geo (shared, cloned here) placed by matrix. uv: { scale, grain } in world space, or null to keep the geo's own.
    add(key, geo, matrix, uv = { scale: 2 }) {
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(matrix);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (uv) worldUV(g, uv.scale, uv);
      else if (!g.attributes.uv) worldUV(g, 2);
      for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(g);
    },
    box(key, x0, y0, z0, x1, y1, z1, r = 0.04, uv) {
      this.add(key, rboxGeo(x1 - x0, y1 - y0, z1 - z0, r), mat4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), uv);
    },
    merge(mats, group, { cast = true } = {}) {
      const out = [];
      for (const [key, geos] of buckets) {
        const merged = mergeGeometries(geos, false);
        for (const g of geos) g.dispose();
        if (!merged || !mats[key]) continue;
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, mats[key]);
        mesh.castShadow = cast && !mats[key].userData.noShadow;
        mesh.receiveShadow = true;
        mesh.name = key;
        group.add(mesh);
        out.push(mesh);
      }
      buckets.clear();
      return out;
    },
  };
}

// ---------------------------------------------------------------- materials

// Per night: which floor, which walls, what tint, and whether there's a tablecloth.
export const ROOMS = {
  1: { floor: 'floor_oak', fScale: 5.5, wall: 'wall_plaster', tint: 0xd8c9a8, wainscot: 0x6e7f5e, cloth: 'cloth_gingham' },
  2: { floor: 'floor_worn', fScale: 5.5, wall: 'wall_smooth', tint: 0xc9c2a0, wainscot: 0x7a5a3c },
  3: { floor: 'floor_oak', fScale: 5, wall: 'wall_plaster', tint: 0xb9b0c8, wainscot: 0x5d6b7a },
  4: { floor: 'floor_stone', fScale: 6, wall: 'wall_stone', tint: 0xa8a49c, wainscot: null },
  5: { floor: 'floor_oak', fScale: 5.5, wall: 'wall_smooth', tint: 0xd7b7a5, wainscot: 0x8a4a3a, cloth: 'cloth_red' },
  6: { floor: 'floor_worn', fScale: 5.5, wall: 'wall_plaster', tint: 0xc8c6a6, wainscot: 0x6e7f5e },
  7: { floor: 'floor_oak', fScale: 5, wall: 'wall_smooth', tint: 0xc7b0b8, wainscot: 0x5a4060 },
  8: { floor: 'floor_worn', fScale: 5, wall: 'wall_smooth', tint: 0xa9b8a4, wainscot: 0x3f4a3a },
  9: { floor: 'floor_oak', fScale: 5.5, wall: 'wall_plaster', tint: 0xb6bfd2, wainscot: 0x46546e },
  10: { floor: 'floor_dirt', fScale: 7, wall: 'wall_planks', tint: 0xb8a088, wainscot: null },
  11: { floor: 'floor_stone', fScale: 6, wall: 'wall_white', tint: 0xdde3e6, wainscot: 0x5b7f8f },
  12: { floor: 'floor_tiles', fScale: 4, wall: 'wall_smooth', tint: 0xe2d2b0, wainscot: 0x2f5a46, cloth: 'cloth_gingham' },
};

const plain = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });

export function roomMaterials(night) {
  const room = ROOMS[night.id] ?? ROOMS[1];
  const m = {
    floor: pbr(room.floor, { normal: 1.2 }),
    wall: pbr(room.wall, { color: room.tint, normal: 1.1 }),
    wainscot: pbr('wood_painted', { color: room.wainscot ?? 0x6b5b4e }),
    skirting: pbr('wood_dark', { color: 0xb08a70 }),
    cap: plain(0x1a1720, { roughness: 1 }),
    table: pbr('wood_table', { color: 0xe8d2b8 }),
    dark: pbr('wood_dark', { color: 0xd8b8a0 }),
    pine: pbr('wood_pine', { color: 0xf0dcc4 }),
    cabinet: pbr('wood_cabinet', { color: 0xead6c0 }),
    painted: pbr('wood_painted', { color: room.wainscot ?? 0x7a8a6a }),
    crate: pbr('wood_kitchen', { color: 0xe0c8a8 }),
    hessian: pbr('cloth_hessian', { color: 0xe6d2b0 }),
    quilt: pbr(night.id === 9 ? 'cloth_plaid' : 'cloth_red', { color: 0xffffff }),
    linen: pbr('cloth_hessian', { color: 0xfaf4ea, normal: 0.4 }),
    cloth: pbr(room.cloth ?? 'cloth_gingham', { color: 0xffffff }),
    rug: pbr('cloth_rug', { color: night.id === 5 || night.id === 7 ? 0xd8a8a0 : 0xffffff }),
    curtain: pbr('cloth_gingham', { color: 0xd8e0ff, side: THREE.DoubleSide }),
    straw: pbr('cloth_hessian', { color: 0xffffff, normal: 1.6 }),
    iron: plain(0x2b2a30, { roughness: 0.55, metalness: 0.75 }),
    brass: plain(0xc7953a, { roughness: 0.32, metalness: 0.9 }),
    tin: plain(0xa8b0ba, { roughness: 0.35, metalness: 0.85 }),
    ceramic: plain(0xe8e0d0, { roughness: 0.25 }),
    cheese: plain(0xf2c14e, { roughness: 0.55 }),
    rind: plain(0xd99a2b, { roughness: 0.5 }),
    frame: pbr('wood_dark', { color: 0xa88870 }),
    fire: new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xff5a1f, emissiveIntensity: 2.2, roughness: 1 }),
    glass: new THREE.MeshBasicMaterial({ color: 0x9fb6ff, transparent: true, opacity: 0.18, depthWrite: false }),
  };
  m.straw.map = strawTexture();
  m.fire.userData.noShadow = true;
  m.glass.userData.noShadow = true;
  for (const [k, mat] of Object.entries(m)) {
    if (k === 'fire' || k === 'glass') continue;
    patchEcho(mat, { fill: k === 'cap' ? 0.3 : k === 'floor' ? 0.9 : 1 });
  }
  return { mats: m, room };
}
