// Crumbs: little trails of cheese crumbs on every night, along the ways to the cheese and into the risky places, invisible
// until a ring of sound glints them. Grab them quickly one after another for a chain (×1 up to ×5).
//
// Placement is seeded and uses only exact arithmetic (no trig, no hypot), so every browser places the same crumbs.

import { createRng, hashSeed } from './rng.js';
import { clearAt } from './world.js';

export const CRUMB = {
  reach: 0.62, // how close a mouse's centre must come
  gap: 2.5, // seconds between crumbs that keep a chain going
  pts: 10, // points per crumb, times the chain
  maxMult: 5,
  spacing: 0.72, // nearest two crumbs
  step: 0.95, // along a trail
};

export const chainMult = (n) => Math.max(1, Math.min(CRUMB.maxMult, n));

// The most a night's crumbs can be worth: all of them in one chain.
export function crumbMax(n) {
  let s = 0;
  for (let i = 1; i <= n; i++) s += CRUMB.pts * chainMult(i);
  return s;
}

const DIRS = [
  [1, 0],
  [0.7071, 0.7071],
  [0, 1],
  [-0.7071, 0.7071],
  [-1, 0],
  [-0.7071, -0.7071],
  [0, -1],
  [0.7071, -0.7071],
];

// Breadth-first steps over open cells from (x, z); Infinity where a mouse can't get.
export function flood(world, ok, x0, z0) {
  const { W, D } = world;
  const dist = new Float32Array(W * D).fill(Infinity);
  const q = [];
  const start = z0 * W + x0;
  if (!ok[start]) return dist;
  dist[start] = 0;
  q.push(start);
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    const x = c % W;
    const z = (c - x) / W;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
      const n = nz * W + nx;
      if (!ok[n] || dist[n] !== Infinity) continue;
      dist[n] = dist[c] + 1;
      q.push(n);
    }
  }
  return dist;
}

const d2 = (ax, az, bx, bz) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
const r2 = (v) => Math.round(v * 100) / 100;

// [[x, z], ...] for this world. extra: a multiplier on the count (the Daily Raid's "crumb feast").
// The cells a mouse can stand in the middle of: a 0/1 grid and how many.
export function openCells(world) {
  const { W, D } = world;
  const ok = new Uint8Array(W * D);
  let open = 0;
  for (let z = 1; z < D - 1; z++) {
    for (let x = 1; x < W - 1; x++) {
      const t = world.info(x, z);
      if (t.solid || !(t.floor || t.cover)) continue;
      if (!clearAt(world, x + 0.5, z + 0.5, 0.26, 'mouse')) continue;
      ok[z * W + x] = 1;
      open++;
    }
  }
  return { ok, open };
}

export function placeCrumbs(world, seed = 0, extra = 1) {
  const { W, D } = world;
  const rng = createRng(hashSeed(`crumbs:${world.night.id}:${seed}`));
  const { ok, open } = openCells(world);
  if (!world.hole) return [];
  const hx = world.hole.cx;
  const hz = world.hole.cz;
  const fromHole = flood(world, ok, hx, hz);
  const fromItems = world.items.map((it) => flood(world, ok, Math.floor(it.x), Math.floor(it.z)));
  const patrol = [...(world.wife?.patrol ?? []), ...(world.farmer?.patrol ?? [])];
  const avoid = [...world.traps.map((t) => [t.x, t.z, 1.0]), ...world.items.map((i) => [i.x, i.z, i.k === 'W' ? 1.4 : 0.9]), [hx + 0.5, hz + 0.5, 2.2]];
  if (world.cat) avoid.push([world.cat.x, world.cat.z, 1.2]);

  // How much a crumb wants to be in each open cell: on the ways from the hole to the cheese, under cover, where she walks.
  const weight = new Float32Array(W * D);
  const cells = [];
  for (let c = 0; c < W * D; c++) {
    if (!ok[c] || fromHole[c] === Infinity || fromHole[c] < 3) continue;
    const x = c % W;
    const z = (c - x) / W;
    let w = 1;
    for (let k = 0; k < fromItems.length; k++) {
      const via = fromHole[c] + fromItems[k][c];
      const direct = fromItems[k][hz * W + hx];
      if (via <= direct + 4) w += 2.5;
    }
    const t = world.info(x, z);
    if (t.cover) w += 1.2;
    if (t.noise) w += 0.8;
    for (const [px, pz] of patrol) if (d2(px, pz, x + 0.5, z + 0.5) < 9) w += 1.4;
    weight[c] = w;
    cells.push(c);
  }
  if (!cells.length) return [];

  const target = Math.round(Math.max(20, Math.min(40, open * 0.075)) * extra);
  const out = [];
  const free = (x, z) => {
    if (x < 1 || z < 1 || x > W - 1 || z > D - 1) return false;
    const c = Math.floor(z) * W + Math.floor(x);
    if (!ok[c] || fromHole[c] === Infinity) return false;
    if (!clearAt(world, x, z, 0.24, 'mouse')) return false;
    for (const [ax, az, r] of avoid) if (d2(ax, az, x, z) < r * r) return false;
    for (const [cx, cz] of out) if (d2(cx, cz, x, z) < CRUMB.spacing * CRUMB.spacing) return false;
    return true;
  };
  let total = 0;
  for (const c of cells) total += weight[c];
  let tries = 0;
  while (out.length < target && tries++ < 400) {
    // A weighted anchor.
    let pick = rng.next() * total;
    let c = cells[cells.length - 1];
    for (const cc of cells) {
      pick -= weight[cc];
      if (pick <= 0) {
        c = cc;
        break;
      }
    }
    const cx = c % W;
    const cz = (c - cx) / W;
    let x = cx + 0.3 + rng.next() * 0.4;
    let z = cz + 0.3 + rng.next() * 0.4;
    // Anchors keep away from other trails, so trails stay readable.
    if (out.some(([ax, az]) => d2(ax, az, x, z) < 1.6 * 1.6) || !free(x, z)) continue;
    out.push([x, z]);
    const len = rng.next() < 0.15 ? 1 : 3 + rng.int(4);
    let dir = rng.int(8);
    for (let k = 1; k < len && out.length < target; k++) {
      let placed = false;
      for (const turn of [0, rng.next() < 0.5 ? 1 : 7, rng.next() < 0.5 ? 7 : 1, 2, 6]) {
        const nd = (dir + turn) % 8;
        const [dx, dz] = DIRS[nd];
        const nx = x + dx * CRUMB.step + (rng.next() - 0.5) * 0.16;
        const nz = z + dz * CRUMB.step + (rng.next() - 0.5) * 0.16;
        if (!free(nx, nz)) continue;
        x = nx;
        z = nz;
        dir = nd;
        out.push([x, z]);
        placed = true;
        break;
      }
      if (!placed) break;
      // A gentle wander: trails curve.
      if (rng.next() < 0.3) dir = (dir + (rng.next() < 0.5 ? 1 : 7)) % 8;
    }
  }
  return out.map(([x, z]) => [r2(x), r2(z)]);
}
