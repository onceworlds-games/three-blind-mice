// A night's map as a world: terrain per cell, furniture blocks, table legs, the hole, items, hunters' routes, and the
// questions the rules ask of it (can a mouse or a hunter stand here, is this under cover, does the light reach, the way there).

import { nightById } from './levels.js';
import { placeCrumbs } from './crumbs.js';

export const VOID = 0;
export const WALL = 1;
export const FLOOR = 2;

// What each letter is. noise: the ring a mouse makes moving on it (u). cover: mice hide under it. solid: blocks mice.
// tall: blocks her light. hunter: hunters can walk it.
const T = {
  ' ': { code: 0, solid: true, tall: true },
  '#': { code: 1, solid: true, tall: true, wall: true },
  '.': { code: 2, floor: true },
  r: { code: 3, floor: true, rug: true },
  g: { code: 4, floor: true, straw: true },
  '~': { code: 5, floor: true, noise: 'creak' },
  ':': { code: 6, floor: true, noise: 'crumbs' },
  p: { code: 7, floor: true, noise: 'pan' },
  T: { code: 10, cover: true, furniture: 'table' },
  h: { code: 11, cover: true, furniture: 'chair' },
  B: { code: 12, cover: true, furniture: 'bed' },
  H: { code: 13, cover: true, furniture: 'shelf' },
  S: { code: 20, solid: true, tall: true, furniture: 'stove' },
  C: { code: 21, solid: true, tall: true, furniture: 'cupboard' },
  k: { code: 22, solid: true, tall: true, furniture: 'sack' },
  j: { code: 23, solid: true, furniture: 'jar' },
  x: { code: 24, solid: true, tall: true, furniture: 'crate' },
  m: { code: 25, solid: true, tall: true, furniture: 'churn' },
  b: { code: 26, solid: true, tall: true, furniture: 'barrel' },
  y: { code: 27, solid: true, tall: true, furniture: 'hay' },
  R: { code: 28, solid: true, tall: true, furniture: 'rack' },
  Q: { code: 29, solid: true, tall: true, furniture: 'clock' },
};
const OBJECTS = new Set(['o', 'w', 'O', 't', 'E', 'F', 'K', 'Z', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
const BY_CODE = [];
for (const [ch, t] of Object.entries(T)) BY_CODE[t.code] = { ...t, ch };

export const NOISE_RING = { creak: 3, crumbs: 2.5, pan: 4.5 };

// Nav lattice: nodes every half unit (node i sits at x = i / 2), so cell centres and the lines between cells are both nodes.
const RES = 2;
export const RADIUS = { mouse: 0.24, wheel: 0.72, hunter: 0.45, cat: 0.3 };

export function buildWorld(nightOrId) {
  const night = typeof nightOrId === 'object' ? nightOrId : nightById(nightOrId);
  const rows = night.map;
  const D = rows.length;
  const W = rows[0].length;
  const cells = new Uint8Array(W * D);
  const at = (x, z) => (x < 0 || z < 0 || x >= W || z >= D ? ' ' : rows[z][x]);
  const objects = [];
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      let ch = at(x, z);
      if (OBJECTS.has(ch)) {
        objects.push({ ch, x, z });
        // The terrain under an object: what most of its neighbours are (never a wall).
        const count = new Map();
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = at(x + dx, z + dz);
          if (OBJECTS.has(n) || !T[n] || T[n].wall || n === ' ') continue;
          count.set(n, (count.get(n) ?? 0) + 1);
        }
        let best = '.';
        let bestN = 1;
        for (const [n, c] of count) if (c > bestN || (c === bestN && T[n].cover)) { best = n; bestN = c; }
        if (ch === 'o' || ch === 'E' || ch === 'F' || /[1-9]/.test(ch)) best = T[best]?.floor ? best : '.';
        ch = best;
      }
      cells[z * W + x] = (T[ch] ?? T['.']).code;
    }
  }
  const info = (x, z) => (x < 0 || z < 0 || x >= W || z >= D ? BY_CODE[0] : BY_CODE[cells[z * W + x]]);

  // Furniture: each connected block of one letter, as a rectangle of cells.
  const seen = new Uint8Array(W * D);
  const furniture = [];
  for (let z = 0; z < D; z++) {
    for (let x = 0; x < W; x++) {
      const t = info(x, z);
      if (!t.furniture || seen[z * W + x]) continue;
      let x1 = x;
      while (x1 + 1 < W && info(x1 + 1, z).code === t.code && !seen[z * W + x1 + 1]) x1++;
      let z1 = z;
      outer: while (z1 + 1 < D) {
        for (let xx = x; xx <= x1; xx++) if (info(xx, z1 + 1).code !== t.code || seen[(z1 + 1) * W + xx]) break outer;
        z1++;
      }
      for (let zz = z; zz <= z1; zz++) for (let xx = x; xx <= x1; xx++) seen[zz * W + xx] = 1;
      furniture.push({ type: t.furniture, x0: x, z0: z, x1: x1 + 1, z1: z1 + 1, cover: !!t.cover, tall: !!t.tall });
    }
  }
  // Legs of covers: four posts inside each block's corners.
  const posts = [];
  for (const f of furniture) {
    if (!f.cover) continue;
    const r = f.type === 'chair' ? 0.1 : 0.14;
    const inset = f.type === 'bed' ? 0.3 : 0.22;
    for (const [px, pz] of [[f.x0 + inset, f.z0 + inset], [f.x1 - inset, f.z0 + inset], [f.x0 + inset, f.z1 - inset], [f.x1 - inset, f.z1 - inset]]) posts.push({ x: px, z: pz, r });
  }

  const world = {
    night,
    W,
    D,
    cells,
    info,
    furniture,
    posts,
    hole: null,
    items: [],
    traps: [],
    wife: null,
    farmer: null,
    cat: null,
    crumbs: [],
    snore: null,
    clock: null,
    door: null,
    nav: {},
  };

  const patrol = [];
  for (const o of objects) {
    const cx = o.x + 0.5;
    const cz = o.z + 0.5;
    if (o.ch === 'o') {
      let dir = [0, 1];
      for (const d of [[0, 1], [0, -1], [-1, 0], [1, 0]]) if (info(o.x + d[0], o.z + d[1]).wall) { dir = d; break; }
      world.hole = { x: cx + dir[0] * 0.25, z: cz + dir[1] * 0.25, wx: dir[0], wz: dir[1], cx: o.x, cz: o.z };
    } else if (o.ch === 'w') world.items.push({ k: 'w', x: cx, z: cz, gold: (night.golden ?? []).includes(world.items.length) ? 1 : 0 });
    else if (o.ch === 'O') world.items.push({ k: 'W', x: cx, z: cz });
    else if (o.ch === 't') world.traps.push({ x: cx, z: cz });
    else if (o.ch === 'E') world.wife = { x: cx, z: cz };
    else if (o.ch === 'F') world.farmer = { x: cx, z: cz };
    else if (o.ch === 'K') world.cat = { x: cx, z: cz, mode: night.cat ?? 'sleep' };
    else if (o.ch === 'Z') world.snore = { x: cx, z: cz };
    else patrol[Number(o.ch)] = [cx, cz, night.looks?.[o.ch] ?? 1.2];
  }
  const route = patrol.filter(Boolean);
  const clock = furniture.find((f) => f.type === 'clock');
  if (clock) world.clock = { x: (clock.x0 + clock.x1) / 2, z: (clock.z0 + clock.z1) / 2 };
  if (night.hunter === 'farmer') {
    world.farmer = { ...(world.farmer ?? { x: route[0][0], z: route[0][1] }), patrol: route };
  } else if (route.length) {
    world.wife = { ...(world.wife ?? { x: route[0][0], z: route[0][1] }), patrol: route };
    if (world.wife.x === world.W - 0.5 || world.wife.x === 0.5) world.door = { x: world.wife.x, z: world.wife.z };
  }
  if (night.farmer) {
    const pts = night.farmer.map(([x, z]) => [x + 0.5, z + 0.5, 1.6]);
    world.farmer = { x: pts[0][0], z: pts[0][1], patrol: pts };
  }
  if (world.snore === null && night.snore) world.snore = { x: W / 2, z: 2 };
  for (const mode of ['mouse', 'wheel', 'hunter', 'cat']) world.nav[mode] = buildNav(world, mode);
  world.crumbs = placeCrumbs(world, night.daily ?? 0, night.feast ?? 1);
  return world;
}

// ---------------------------------------------------------------- questions about a point

export const cellOf = (v) => Math.floor(v);

export function isCover(world, x, z) {
  return !!world.info(cellOf(x), cellOf(z)).cover;
}

export function noiseAt(world, x, z) {
  return world.info(cellOf(x), cellOf(z)).noise ?? null;
}

function blocks(t, mode) {
  if (mode === 'hunter' || mode === 'cat') return !t.floor && !(mode === 'cat' && t.cover);
  return !!t.solid;
}

// Is a circle of radius r at (x, z) clear of every blocking cell (and, for mice, of table legs)?
export function clearAt(world, x, z, r, mode = 'mouse', margin = 0) {
  const x0 = Math.floor(x - r);
  const x1 = Math.floor(x + r);
  const z0 = Math.floor(z - r);
  const z1 = Math.floor(z + r);
  for (let cz = z0; cz <= z1; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (!blocks(world.info(cx, cz), mode)) continue;
      const nx = Math.max(cx, Math.min(x, cx + 1));
      const nz = Math.max(cz, Math.min(z, cz + 1));
      if ((nx - x) ** 2 + (nz - z) ** 2 < r * r - 1e-9) return false;
    }
  }
  if (mode === 'mouse' || mode === 'wheel') {
    for (const p of world.posts) if ((p.x - x) ** 2 + (p.z - z) ** 2 < (p.r + r + margin) ** 2) return false;
  }
  return true;
}

// Push a circle out of blocking cells and posts. Returns the new position.
export function resolve(world, x, z, r, mode = 'mouse') {
  for (let iter = 0; iter < 3; iter++) {
    let moved = false;
    const x0 = Math.floor(x - r);
    const x1 = Math.floor(x + r);
    const z0 = Math.floor(z - r);
    const z1 = Math.floor(z + r);
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!blocks(world.info(cx, cz), mode)) continue;
        const nx = Math.max(cx, Math.min(x, cx + 1));
        const nz = Math.max(cz, Math.min(z, cz + 1));
        const dx = x - nx;
        const dz = z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-12) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // The centre is inside the cell: out the nearest side.
          const left = x - cx;
          const right = cx + 1 - x;
          const top = z - cz;
          const bottom = cz + 1 - z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) x = cx - r;
          else if (m === right) x = cx + 1 + r;
          else if (m === top) z = cz - r;
          else z = cz + 1 + r;
        }
        moved = true;
      }
    }
    if (mode === 'mouse' || mode === 'wheel') {
      for (const p of world.posts) {
        const dx = x - p.x;
        const dz = z - p.z;
        const min = p.r + r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-6;
        x = p.x + (dx / d) * min;
        z = p.z + (dz / d) * min;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return [x, z];
}

// Does a straight line from a to b stay clear of tall things (walls, stoves, sacks...)? The light test.
export function lineOfLight(world, ax, az, bx, bz) {
  let cx = Math.floor(ax);
  let cz = Math.floor(az);
  const ex = Math.floor(bx);
  const ez = Math.floor(bz);
  const dx = bx - ax;
  const dz = bz - az;
  const sx = Math.sign(dx);
  const sz = Math.sign(dz);
  const tdx = sx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tdz = sz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tx = sx > 0 ? (cx + 1 - ax) * tdx : sx < 0 ? (ax - cx) * tdx : Infinity;
  let tz = sz > 0 ? (cz + 1 - az) * tdz : sz < 0 ? (az - cz) * tdz : Infinity;
  for (let i = 0; i < 200; i++) {
    if (cx === ex && cz === ez) return true;
    if (tx < tz) {
      cx += sx;
      tx += tdx;
    } else {
      cz += sz;
      tz += tdz;
    }
    if (cx === ex && cz === ez) return true;
    if (world.info(cx, cz).tall) return false;
  }
  return true;
}

// Can a body of radius r slide straight from a to b?
export function clearSegment(world, ax, az, bx, bz, r, mode) {
  const len = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(len / 0.2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!clearAt(world, ax + (bx - ax) * t, az + (bz - az) * t, r, mode, 0.06)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- navigation

function buildNav(world, mode) {
  const NW = world.W * RES + 1;
  const ND = world.D * RES + 1;
  const ok = new Uint8Array(NW * ND);
  const r = RADIUS[mode];
  for (let j = 0; j < ND; j++) for (let i = 0; i < NW; i++) ok[j * NW + i] = clearAt(world, i / RES, j / RES, r, mode, 0.1) ? 1 : 0;
  return { NW, ND, ok, r, mode };
}

export function navNode(world, mode, x, z) {
  const nav = world.nav[mode];
  let i = Math.round(x * RES);
  let j = Math.round(z * RES);
  if (i >= 0 && j >= 0 && i < nav.NW && j < nav.ND && nav.ok[j * nav.NW + i]) return j * nav.NW + i;
  // The nearest open node.
  let best = -1;
  let bestD = Infinity;
  for (let rad = 1; rad <= 6 && best < 0; rad++) {
    for (let dj = -rad; dj <= rad; dj++) {
      for (let di = -rad; di <= rad; di++) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nav.NW || jj >= nav.ND || !nav.ok[jj * nav.NW + ii]) continue;
        const d = (ii / RES - x) ** 2 + (jj / RES - z) ** 2;
        if (d < bestD) { bestD = d; best = jj * nav.NW + ii; }
      }
    }
  }
  return best;
}

export const nodeXZ = (world, mode, n) => [(n % world.nav[mode].NW) / RES, Math.floor(n / world.nav[mode].NW) / RES];

// A* over the lattice. cost(x, z) adds to stepping onto a node (Infinity: never). Returns [[x, z], ...] smoothed, or null.
export function findPath(world, mode, ax, az, bx, bz, cost = null, maxNodes = 12000) {
  const nav = world.nav[mode];
  const start = navNode(world, mode, ax, az);
  const goal = navNode(world, mode, bx, bz);
  if (start < 0 || goal < 0) return null;
  const { NW, ok } = nav;
  const N = ok.length;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = [];
  const push = (n, f) => {
    heap.push([f, n]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const gi = goal % NW;
  const gj = Math.floor(goal / NW);
  const h = (n) => {
    const dx = Math.abs((n % NW) - gi);
    const dz = Math.abs(Math.floor(n / NW) - gj);
    return (Math.max(dx, dz) + 0.4142 * Math.min(dx, dz)) / RES;
  };
  g[start] = 0;
  push(start, h(start));
  let expanded = 0;
  while (heap.length) {
    const [, n] = pop();
    if (closed[n]) continue;
    if (n === goal) break;
    closed[n] = 1;
    if (++expanded > maxNodes) return null;
    const i = n % NW;
    const j = Math.floor(n / NW);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= NW || jj * NW >= N) continue;
        const m = jj * NW + ii;
        if (!ok[m] || closed[m]) continue;
        if (di && dj && (!ok[j * NW + ii] || !ok[jj * NW + i])) continue;
        let step = (di && dj ? 1.4142 : 1) / RES;
        if (cost) {
          const c = cost(ii / RES, jj / RES);
          if (c === Infinity) continue;
          step *= 1 + c;
        }
        const ng = g[n] + step;
        if (ng < g[m]) {
          g[m] = ng;
          came[m] = n;
          push(m, ng + h(m));
        }
      }
    }
  }
  if (start !== goal && came[goal] < 0) return null;
  const nodes = [];
  for (let n = goal; n >= 0; n = n === start ? -1 : came[n]) nodes.push(n);
  nodes.reverse();
  const pts = nodes.map((n) => nodeXZ(world, mode, n));
  pts[pts.length - 1] = clearAt(world, bx, bz, nav.r, mode) ? [bx, bz] : pts[pts.length - 1];
  return smooth(world, mode, [[ax, az], ...pts], cost);
}

function smooth(world, mode, pts, cost) {
  if (pts.length <= 2) return pts.slice(1);
  const r = world.nav[mode].r;
  const out = [];
  let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    // With a cost field, only skip ahead a little: the cost shaped the path for a reason.
    if (cost) b = Math.min(b, a + 4);
    while (b > a + 1 && !clearSegment(world, pts[a][0], pts[a][1], pts[b][0], pts[b][1], r * 0.9, mode)) b--;
    out.push(pts[b]);
    a = b;
  }
  return out;
}

export function reachable(world, mode, ax, az, bx, bz) {
  return findPath(world, mode, ax, az, bx, bz, null, 100000) !== null;
}

// A random open spot near (x, z), for wandering.
export function randomSpot(world, mode, x, z, radius, rng) {
  for (let i = 0; i < 30; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = radius * (0.3 + 0.7 * rng.next());
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    if (px > 1 && pz > 1 && px < world.W - 1 && pz < world.D - 1 && clearAt(world, px, pz, world.nav[mode].r, mode)) return [px, pz];
  }
  return [x, z];
}
