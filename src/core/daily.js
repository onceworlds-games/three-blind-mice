// The Daily Raid: one night a day, the same for everyone, remixed by the date: the cheese moved, new crumbs, and a twist
// (a prowling cat, extra creaky boards, a golden wedge, a crumb feast or an early dawn). Pure and seeded, so every page
// and every player builds the same night from the day's number.

import { NIGHTS, NIGHT_COUNT, nightById } from './levels.js';
import { buildWorld } from './world.js';
import { createRng, hashSeed } from './rng.js';
import { openCells, flood } from './crumbs.js';

export const TWISTS = {
  prowl: { name: 'Prowling cat', tip: 'A cat is out tonight' },
  creaky: { name: 'Creaky night', tip: 'More creaky boards' },
  golden: { name: 'Golden wedge', tip: 'One wedge is gold: 1500' },
  feast: { name: 'Crumb feast', tip: 'Crumbs everywhere' },
  early: { name: 'Early dawn', tip: 'Dawn comes early' },
};
const TWIST_IDS = Object.keys(TWISTS);

// A day's number from a time (ms): 20261101 for 1 November 2026, UTC.
export function dayKey(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

export const validDay = (day) => Number.isInteger(day) && day >= 20200101 && day <= 29991231 && day % 100 >= 1 && day % 100 <= 31 && Math.floor(day / 100) % 100 >= 1 && Math.floor(day / 100) % 100 <= 12;

// The day before (for streaks).
export function prevDay(day) {
  const y = Math.floor(day / 10000);
  const m = Math.floor(day / 100) % 100;
  const d = day % 100;
  return dayKey(Date.UTC(y, m - 1, d) - 86400000);
}

// Which night and twist a day gets. Nights 2-12 in a shuffled cycle, so a week rarely repeats one.
export function dailyPlan(day) {
  const rng = createRng(hashSeed(`raid:${day}`));
  const pool = NIGHTS.filter((n) => n.id >= 2).map((n) => n.id);
  const night = pool[rng.int(pool.length)];
  let twist = TWIST_IDS[rng.int(TWIST_IDS.length)];
  const base = nightById(night);
  if (twist === 'prowl' && (base.cat || base.hunter === 'farmer' || base.farmer)) twist = 'golden';
  return { day, night, twist };
}

const cache = new Map();

// The remixed night (a levels.js night with `daily` set), or null for a day that isn't one.
export function dailyNight(day) {
  if (!validDay(day)) return null;
  if (cache.has(day)) return cache.get(day);
  const plan = dailyPlan(day);
  const base = nightById(plan.night);
  const rng = createRng(hashSeed(`remix:${day}`));
  const world = buildWorld(base);
  const { W, D } = world;
  const rows = base.map.map((r) => r.split(''));
  const { ok } = openCells(world);
  const fromHole = flood(world, ok, world.hole.cx, world.hole.cz);
  let far = 0;
  for (const v of fromHole) if (v !== Infinity) far = Math.max(far, v);
  const cheb = (ax, az, bx, bz) => Math.max(Math.abs(ax - bx), Math.abs(az - bz));
  const keepAway = [];
  for (const t of world.traps) keepAway.push([Math.floor(t.x), Math.floor(t.z), 2]);
  for (const i of world.items) if (i.k === 'W') keepAway.push([Math.floor(i.x), Math.floor(i.z), 4]);
  for (const h of [world.wife, world.farmer, world.cat]) if (h) keepAway.push([Math.floor(h.x), Math.floor(h.z), 3]);
  const terrain = (x, z) => world.info(x, z).ch;

  // The cheese moves: every wedge to a new spot, far enough from the hole and from each other.
  const wedges = world.items.filter((i) => i.k === 'w');
  const placed = [];
  for (const w of wedges) {
    const ox = Math.floor(w.x);
    const oz = Math.floor(w.z);
    const cand = [];
    for (let z = 1; z < D - 1; z++) {
      for (let x = 1; x < W - 1; x++) {
        const c = z * W + x;
        if (!ok[c] || fromHole[c] === Infinity || fromHole[c] < Math.max(7, far * 0.4)) continue;
        const ch = rows[z][x];
        if (!'.rgTBH'.includes(ch)) continue;
        // Under furniture only well inside it, so the piece keeps its shape.
        if ('TBH'.includes(ch) && [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dz]) => rows[z + dz][x + dx] === ch).length < 3) continue;
        if (keepAway.some(([kx, kz, r]) => cheb(kx, kz, x, z) < r)) continue;
        if (placed.some(([px, pz]) => cheb(px, pz, x, z) < 5)) continue;
        if (cheb(ox, oz, x, z) < 4) continue;
        cand.push([x, z]);
      }
    }
    if (!cand.length) {
      placed.push([ox, oz]);
      continue;
    }
    const [nx, nz] = cand[rng.int(cand.length)];
    rows[oz][ox] = terrain(ox, oz);
    placed.push([nx, nz]);
  }
  for (const [x, z] of placed) rows[z][x] = 'w';

  const night = { ...base, daily: day, twist: plan.twist };
  if (plan.twist === 'creaky') {
    // Five patches of creaky boards on open floor.
    let made = 0;
    for (let tries = 0; tries < 200 && made < 5; tries++) {
      const x = 2 + rng.int(W - 5);
      const z = 2 + rng.int(D - 5);
      const [pw, pd] = rng.next() < 0.5 ? [3, 2] : [2, 3];
      if (cheb(world.hole.cx, world.hole.cz, x, z) < 4) continue;
      let all = true;
      for (let dz = 0; dz < pd; dz++) for (let dx = 0; dx < pw; dx++) if (rows[z + dz][x + dx] !== '.') all = false;
      if (!all) continue;
      for (let dz = 0; dz < pd; dz++) for (let dx = 0; dx < pw; dx++) rows[z + dz][x + dx] = '~';
      made++;
    }
  } else if (plan.twist === 'prowl') {
    const cand = [];
    for (let z = 1; z < D - 1; z++) for (let x = 1; x < W - 1; x++) if (rows[z][x] === '.' && fromHole[z * W + x] >= Math.min(12, far * 0.6) && fromHole[z * W + x] !== Infinity) cand.push([x, z]);
    if (cand.length) {
      const [x, z] = cand[rng.int(cand.length)];
      rows[z][x] = 'K';
      night.cat = 'roam';
    }
  } else if (plan.twist === 'feast') night.feast = 1.7;
  else if (plan.twist === 'early') night.dawn = Math.round(base.dawn * 0.65);
  night.map = rows.map((r) => r.join(''));
  if (plan.twist === 'golden') {
    // The wedge furthest from the hole is gold.
    const w2 = buildWorld(night);
    let best = -1;
    let bestD = -1;
    w2.items.forEach((it, i) => {
      if (it.k !== 'w') return;
      const d = fromHole[Math.floor(it.z) * W + Math.floor(it.x)];
      if (d !== Infinity && d > bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best >= 0) night.golden = [best];
  }
  if (cache.size > 8) cache.delete(cache.keys().next().value);
  cache.set(day, night);
  return night;
}

export const raidName = (day) => {
  const n = dailyNight(day);
  return n ? `${n.name}` : '';
};

export { NIGHT_COUNT };
