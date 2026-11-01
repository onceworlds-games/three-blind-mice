// The autopilot: a mouse brain for the title's attract mode, the trailer and the balance tests. It knows the map (it has been
// here before), so it plays like a skilled player: quiet routes, waits in the dark while her light passes, dodges the knife,
// drops the cheese to run, and lures her away. `skill` (0..1) sets its reaction time and care; `careless` ignores the danger.

import { findPath, isCover, noiseAt, clearAt, navNode, nodeXZ } from './world.js';
import { holeMouth, MOUSE } from './mouse.js';
import { carrying } from './night.js';
import { HUNTER, lanternOf, strikeOf } from './hunters.js';
import { RINGS } from './rings.js';

export function createBrain({ skill = 0.8, careless = false, role = '', rng }) {
  return {
    skill,
    careless,
    role,
    rng,
    path: null,
    pathAt: -99,
    goalKey: '',
    nextSqueak: 0.8 + rng.next() * 1.5,
    waitSince: -1,
    decoyAt: -99,
    decoy: null,
    stuckAt: 0,
    lastX: 0,
    lastZ: 0,
  };
}

const humans = (hunters) => hunters.filter((h) => h.k !== 'cat');

// Is (x, z) lit right now by any hunter's light (with a margin)?
function lit(world, hunters, x, z, margin) {
  for (const h of hunters) {
    if (h.k === 'cat' || h.m === 'wait') continue;
    if (h.k === 'wife') {
      const [lx, lz] = lanternOf(h);
      if (Math.hypot(x - lx, z - lz) <= HUNTER.wife.pool + margin && !isCover(world, x, z)) return true;
    } else {
      const dx = x - h.x;
      const dz = z - h.z;
      const d = Math.hypot(dx, dz);
      if (d > HUNTER.farmer.cone + margin) continue;
      let diff = Math.atan2(dz, dx) - h.a;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if ((Math.abs(diff) <= HUNTER.farmer.half + 0.25 || d < 1.5 + margin) && !isCover(world, x, z)) return true;
    }
  }
  return false;
}

function costField(brain, ctx) {
  const { world, hunters, data } = ctx;
  const traps = world.traps.filter((_, i) => !data.tr[i]);
  const cat = hunters.find((h) => h.k === 'cat');
  const noiseCost = brain.careless ? 0 : 2 + brain.skill * 6;
  const lightCost = brain.careless ? 0 : 30;
  return (x, z) => {
    for (const t of traps) if (Math.hypot(x - t.x, z - t.z) < 0.7) return Infinity;
    let c = 0;
    if (noiseAt(world, x, z)) c += noiseCost;
    if (lightCost && lit(world, hunters, x, z, 1.2)) c += lightCost;
    if (!brain.careless) {
      for (const h of humans(hunters)) {
        const d = Math.hypot(x - h.x, z - h.z);
        if (d < 3) c += (3 - d) * 6;
      }
      if (cat && Math.hypot(x - cat.x, z - cat.z) < 3.5) c += 6;
    }
    return c;
  };
}

function follow(brain, me, ctx, gx, gz, key, mode = 'mouse', body = me) {
  const { now, world } = ctx;
  if (brain.goalKey !== key || !brain.path || now - brain.pathAt > 0.6) {
    brain.path = findPath(world, mode, body.x, body.z, gx, gz, costField(brain, ctx), 9000) ?? findPath(world, mode, body.x, body.z, gx, gz) ?? [];
    brain.pathAt = now;
    brain.goalKey = key;
  }
  while (brain.path.length && Math.hypot(brain.path[0][0] - body.x, brain.path[0][1] - body.z) < 0.3) brain.path.shift();
  const next = brain.path[0] ?? [gx, gz];
  const dx = next[0] - body.x;
  const dz = next[1] - body.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return [0, 0, next];
  const slow = Math.min(1, d / 0.4 + 0.35);
  return [(dx / d) * slow, (dz / d) * slow, next];
}

// Think for one mouse. ctx: { world, data, now, hunters, mice (everyone's bodies: { id, x, z, vx, vz, st }), me (this body) }.
// Returns { ix, iz, squeak: null | 'small' | 'big', drop: boolean }.
export function think(brain, ctx) {
  const { world, data, now, hunters } = ctx;
  const me = ctx.me;
  const out = { ix: 0, iz: 0, squeak: null, drop: false };
  const holding = carrying(data, me.id);
  const item = holding >= 0 ? data.it[holding] : null;
  const lead = item && item.by === me.id;
  const react = brain.careless ? 0.55 : 0.32 - brain.skill * 0.14;

  // 1. Dodge a strike that's coming down near us.
  for (const h of hunters) {
    const ch = strikeOf(h);
    if (!ch) continue;
    const span = h.k === 'cat' ? ch.at - h.t : ch.at - h.t;
    if (now - h.t < react || span <= 0) continue;
    const d = Math.hypot(me.x - ch.x, me.z - ch.z);
    if (d > ch.r + 0.8) continue;
    if (h.k !== 'cat' && isCover(world, me.x, me.z)) continue;
    let ax = me.x - ch.x;
    let az = me.z - ch.z;
    if (Math.hypot(ax, az) < 0.05) {
      ax = -me.vz;
      az = me.vx;
    }
    // Pick the clear direction closest to "away".
    const base = Math.atan2(az, ax);
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
      const a = base + off;
      if (clearAt(world, me.x + Math.cos(a) * 0.6, me.z + Math.sin(a) * 0.6, MOUSE.r, 'mouse')) {
        out.ix = Math.cos(a);
        out.iz = Math.sin(a);
        break;
      }
    }
    if (item && !lead) out.drop = true;
    return out;
  }

  // 2. Spotted and chased: drop the cheese if she's close, and run for cover or the dark.
  const chaser = humans(hunters).find((h) => (h.m === 'chase' || h.m === 'spot' || h.m === 'raise') && h.tgt === me.id);
  if (chaser && !brain.careless) {
    const dh = Math.hypot(chaser.x - me.x, chaser.z - me.z);
    if (item && dh < 3.4) out.drop = true;
    const cover = nearestCover(world, me, chaser);
    if (cover) {
      const [ix, iz] = follow(brain, me, ctx, cover[0], cover[1], `flee:${cover[0]},${cover[1]}`);
      out.ix = ix;
      out.iz = iz;
      return out;
    }
  }

  // 3. The goal: home with the cheese, else the best piece of cheese, else home to end the night.
  let gx;
  let gz;
  let key;
  let mode = 'mouse';
  let body = me;
  if (item) {
    [gx, gz] = holeMouth(world);
    key = 'home';
    if (item.k === 'W') {
      mode = 'wheel';
      body = { x: item.x, z: item.z };
      key = 'wheelhome';
    }
  } else {
    const pick = chooseItem(brain, ctx);
    if (pick >= 0) {
      gx = data.it[pick].x;
      gz = data.it[pick].z;
      key = `item:${pick}`;
      // Guarded cheese: lure her away first.
      const d = maybeDecoy(brain, ctx, pick);
      if (d) {
        gx = d[0];
        gz = d[1];
        key = `decoy:${d[0]},${d[1]}`;
        if (Math.hypot(me.x - d[0], me.z - d[1]) < 0.6) {
          out.squeak = 'big';
          brain.decoy = null;
          brain.decoyAt = now;
          brain.nextSqueak = now + 4;
          return out;
        }
      }
    } else {
      [gx, gz] = holeMouth(world);
      key = 'rest';
    }
  }
  const [ix, iz, next] = follow(brain, me, ctx, gx, gz, key, mode, body);

  // 4. Wait in the dark while her light passes over the way ahead.
  if (!brain.careless && !lit(world, hunters, me.x, me.z, 0.3) && next && lit(world, hunters, next[0], next[1], 0.6) && Math.hypot(gx - me.x, gz - me.z) > 1) {
    if (brain.waitSince < 0) brain.waitSince = now;
    if (now - brain.waitSince < 6) {
      out.ix = 0;
      out.iz = 0;
      brain.path = null;
      return out;
    }
  } else brain.waitSince = -1;
  out.ix = ix;
  out.iz = iz;

  // 5. Squeak now and then, when nobody who'd mind is in reach.
  if (now >= brain.nextSqueak && !item) {
    const near = (r) => hunters.some((h) => h.m !== 'wait' && Math.hypot(h.x - me.x, h.z - me.z) < r);
    if (brain.careless) {
      out.squeak = brain.rng.next() < 0.5 ? 'big' : 'small';
      brain.nextSqueak = now + 1.2 + brain.rng.next();
    } else if (!near(RINGS.small.r + 1.5)) {
      out.squeak = !near(RINGS.big.r + 1.5) && brain.rng.next() < 0.35 ? 'big' : 'small';
      brain.nextSqueak = now + (3 + brain.rng.next() * 4) * (0.8 + brain.skill * 0.5);
    } else brain.nextSqueak = now + 1;
  }
  return out;
}

function chooseItem(brain, ctx) {
  const { data, world, me, hunters } = ctx;
  let best = -1;
  let bestScore = Infinity;
  const taken = ctx.claims ?? {};
  data.it.forEach((it, i) => {
    if (it.home) return;
    if (it.k === 'w' && it.by) return;
    if (it.k === 'W' && it.by && it.h.length >= 2) return;
    let score = Math.hypot(it.x - me.x, it.z - me.z);
    for (const [id, idx] of Object.entries(taken)) if (id !== me.id && idx === i && it.k === 'w') score += 25;
    if (it.k === 'W') score += it.by ? -4 : 6;
    if (!brain.careless && lit(world, hunters, it.x, it.z, 0)) score += 8;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  if (ctx.claims && best >= 0) ctx.claims[me.id] = best;
  return best;
}

function maybeDecoy(brain, ctx, pick) {
  const { world, data, now, hunters, me } = ctx;
  if (brain.careless || now - brain.decoyAt < 14) return null;
  const it = data.it[pick];
  const wife = hunters.find((h) => h.k === 'wife' && (h.m === 'look' || h.m === 'patrol'));
  if (!wife) return null;
  // Only when she guards it: her whole route stays near this cheese.
  const route = world.wife?.patrol ?? [];
  if (!route.length || route.some((p) => Math.hypot(p[0] - it.x, p[1] - it.z) > 6)) return null;
  if (Math.hypot(wife.x - it.x, wife.z - it.z) > 4.5) return null;
  if (brain.decoy) return brain.decoy;
  // A spot 8-12 u from her, far from the cheese, out of her light, that a mouse can reach.
  let best = null;
  let bestS = -Infinity;
  for (let i = 0; i < 60; i++) {
    const x = 1 + brain.rng.next() * (world.W - 2);
    const z = 1 + brain.rng.next() * (world.D - 2);
    const dw = Math.hypot(x - wife.x, z - wife.z);
    if (dw < 8 || dw > 12) continue;
    if (!clearAt(world, x, z, MOUSE.r, 'mouse') || lit(world, hunters, x, z, 1)) continue;
    const di = Math.hypot(x - it.x, z - it.z);
    const dm = Math.hypot(x - me.x, z - me.z);
    const s = di - dm * 0.5;
    if (di > 6 && s > bestS) { bestS = s; best = [x, z]; }
  }
  if (best) {
    const n = navNode(world, 'mouse', best[0], best[1]);
    if (n >= 0) best = nodeXZ(world, 'mouse', n);
  }
  brain.decoy = best;
  return best;
}

function nearestCover(world, me, from) {
  let best = null;
  let bestS = Infinity;
  for (const f of world.furniture) {
    if (!f.cover) continue;
    const x = Math.max(f.x0 + 0.5, Math.min(f.x1 - 0.5, me.x));
    const z = Math.max(f.z0 + 0.5, Math.min(f.z1 - 0.5, me.z));
    if (!clearAt(world, x, z, MOUSE.r, 'mouse')) continue;
    const dMe = Math.hypot(x - me.x, z - me.z);
    const dHer = Math.hypot(x - from.x, z - from.z);
    if (dHer < dMe * 0.6) continue;
    const s = dMe;
    if (s < bestS && dMe < 9) { bestS = s; best = [x, z]; }
  }
  if (best) return best;
  // No cover near: straight away from her.
  const a = Math.atan2(me.z - from.z, me.x - from.x);
  for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
    const x = me.x + Math.cos(a + off) * 4;
    const z = me.z + Math.sin(a + off) * 4;
    if (clearAt(world, x, z, MOUSE.r, 'mouse')) return [x, z];
  }
  return null;
}
