// The hunters: the farmer's wife (a lantern), the farmer (a torch) and Butter the cat (ears only). The host's page runs them;
// everyone else draws the snapshots. Times are seconds on the match clock.

import { findPath, clearAt, isCover, lineOfLight, resolve, randomSpot, clearSegment } from './world.js';
import { RINGS, heardBetween } from './rings.js';

export const HUNTER = {
  wife: { walk: 1.6, search: 2.2, chase: 2.7, pool: 3.8, ahead: 1.2, reach: 2.4, tele: 0.8, hitR: 0.85, lead: 0.45, recover: 0.8, spot: 0.3, lose: 1.5, searchFor: 5, hearTurn: 0.6, r: 0.45, turn: 3.2 },
  farmer: { walk: 1.8, search: 2.3, chase: 2.6, cone: 9, half: 0.28, reach: 2.0, tele: 0.8, hitR: 1.0, lead: 0.4, recover: 0.9, spot: 0.35, lose: 1.2, searchFor: 5, hearTurn: 0.6, r: 0.5, turn: 3.0 },
  cat: { walk: 1.8, roam: 1.2, ears: 7, crouch: 0.4, leap: 12, hitR: 0.8, land: 0.6, yawn: 1.0, quiet: 10, r: 0.3 },
};

const HUMAN_MODES = ['wait', 'patrol', 'look', 'hear', 'go', 'search', 'spot', 'chase', 'raise', 'recover'];
const CAT_MODES = ['sleep', 'wake', 'listen', 'stalk', 'roam', 'rest', 'crouch', 'leap', 'land'];

export function createHunters(world, { script = '' } = {}) {
  const out = [];
  for (const k of ['wife', 'farmer']) {
    const src = world[k];
    if (!src?.patrol?.length) continue;
    const first = src.patrol[0];
    const a = Math.atan2(first[1] - src.z, first[0] - src.x) || 0;
    out.push(human(k, src.x, src.z, a, k === 'wife' && script === 'enter' ? 'wait' : 'patrol'));
  }
  if (world.cat) {
    out.push({ k: 'cat', x: world.cat.x, z: world.cat.z, a: Math.PI * 0.75, m: world.cat.mode === 'roam' ? 'roam' : 'sleep', t: 0, until: 0, tx: world.cat.x, tz: world.cat.z, quiet: 0, ch: null, seq: 0, sx: 0, sz: 0, path: null });
  }
  return out;
}

function human(k, x, z, a, m) {
  return { k, x, z, a, m, t: 0, until: 0, pi: 0, tx: x, tz: z, tgt: '', spot: 0, seen: 0, lx: x, lz: z, ch: null, seq: 0, cool: 0, base: a, path: null, pathT: 0 };
}

// Where her lantern's pool is centred.
export function lanternOf(h) {
  const c = HUNTER.wife;
  return [h.x + Math.cos(h.a) * c.ahead, h.z + Math.sin(h.a) * c.ahead];
}

// Can this hunter see a mouse at (x, z)? Only in the light: her lantern's pool or his torch's beam; never under cover.
export function canSee(world, h, x, z) {
  if (h.k === 'cat' || h.m === 'wait') return false;
  if (isCover(world, x, z)) return false;
  if (h.k === 'wife') {
    const [lx, lz] = lanternOf(h);
    if (Math.hypot(x - lx, z - lz) > HUNTER.wife.pool) return false;
    return lineOfLight(world, lx, lz, x, z);
  }
  const c = HUNTER.farmer;
  const dx = x - h.x;
  const dz = z - h.z;
  const d = Math.hypot(dx, dz);
  if (d > c.cone) return false;
  if (d > 0.9) {
    let diff = Math.atan2(dz, dx) - h.a;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > c.half) return false;
  }
  return lineOfLight(world, h.x, h.z, x, z);
}

function turnTo(h, angle, rate, dt) {
  let d = angle - h.a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const step = rate * dt;
  h.a += Math.abs(d) <= step ? d : Math.sign(d) * step;
}

function setPath(h, world, tx, tz, mode = 'hunter') {
  h.tx = tx;
  h.tz = tz;
  h.path = findPath(world, mode, h.x, h.z, tx, tz) ?? [];
}

// Walk the path. Returns true on arrival.
function walk(h, world, speed, dt, mode = 'hunter', turnRate = 3) {
  if (!h.path) setPath(h, world, h.tx, h.tz, mode);
  let budget = speed * dt;
  while (budget > 1e-6 && h.path.length) {
    const [px, pz] = h.path[0];
    const dx = px - h.x;
    const dz = pz - h.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      h.path.shift();
      continue;
    }
    const step = Math.min(budget, d);
    h.x += (dx / d) * step;
    h.z += (dz / d) * step;
    budget -= step;
    turnTo(h, Math.atan2(dz, dx), turnRate, dt);
    if (step >= d - 1e-6) h.path.shift();
  }
  const r = mode === 'cat' ? HUNTER.cat.r : HUNTER[h.k]?.r ?? 0.45;
  [h.x, h.z] = resolve(world, h.x, h.z, r, mode);
  return h.path.length === 0 || Math.hypot(h.tx - h.x, h.tz - h.z) < 0.4;
}

function nearestWaypoint(route, x, z) {
  let best = 0;
  let bestD = Infinity;
  route.forEach((p, i) => {
    const d = Math.hypot(p[0] - x, p[1] - z);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

function setMode(h, m, now) {
  h.m = m;
  h.t = now;
}

// One tick of every hunter. ctx: { world, mice: [{ id, x, z, vx, vz, hidden }], rings, prev (last tick's time), solo, entered }.
// Returns the events that happened: [{ type, k, ... }].
export function tickHunters(hunters, ctx, now, dt) {
  const events = [];
  for (const h of hunters) {
    if (h.k === 'cat') tickCat(h, ctx, now, dt, events);
    else tickHuman(h, ctx, now, dt, events);
  }
  return events;
}

function loudest(list) {
  let best = null;
  for (const r of list) if (!best || RINGS[r.kind].r >= RINGS[best.kind].r) best = r;
  return best;
}

function tickHuman(h, ctx, now, dt, events) {
  const { world, solo } = ctx;
  const c = HUNTER[h.k];
  const route = world[h.k]?.patrol ?? [];
  const pace = (solo ? 0.9 : 1) * (h.k === 'wife' ? world.night.wifeSpeed ?? 1 : 1);
  const tele = c.tele + (solo ? 0.1 : 0);
  const listening = h.m === 'patrol' || h.m === 'look' || h.m === 'hear' || h.m === 'go' || h.m === 'search';

  if (h.m === 'wait') {
    if (ctx.entered) {
      setMode(h, 'patrol', now);
      h.path = null;
      h.pi = 0;
      if (route.length) { h.tx = route[0][0]; h.tz = route[0][1]; }
      events.push({ type: 'enter', k: h.k });
    }
    return;
  }

  // Sight: a mouse standing in the light for a moment is spotted.
  if (listening) {
    let seenMouse = null;
    let seenD = Infinity;
    for (const m of ctx.mice) {
      if (m.hidden || !canSee(world, h, m.x, m.z)) continue;
      const d = Math.hypot(m.x - h.x, m.z - h.z);
      if (d < seenD) { seenD = d; seenMouse = m; }
    }
    if (seenMouse) {
      h.spot += dt;
      if (h.spot >= c.spot) {
        h.tgt = seenMouse.id;
        h.lx = seenMouse.x;
        h.lz = seenMouse.z;
        h.seen = now;
        h.spot = 0;
        setMode(h, 'spot', now);
        events.push({ type: 'spot', k: h.k, id: seenMouse.id });
        return;
      }
    } else h.spot = Math.max(0, h.spot - dt * 0.5);
  }

  // Hearing: any ring that reaches her.
  if (listening) {
    const ring = loudest(heardBetween(ctx.rings, h.x, h.z, ctx.prev, now, h.k));
    if (ring) {
      h.tx = ring.x;
      h.tz = ring.z;
      if (h.m === 'go') setPath(h, world, ring.x, ring.z);
      else if (h.m !== 'hear') {
        h.path = null;
        events.push({ type: 'hear', k: h.k, x: ring.x, z: ring.z, src: ring.src });
        setMode(h, 'hear', now);
      }
    }
  }

  switch (h.m) {
    case 'patrol': {
      if (!route.length) break;
      const wp = route[h.pi % route.length];
      if (!h.path || h.tx !== wp[0] || h.tz !== wp[1]) setPath(h, world, wp[0], wp[1]);
      if (walk(h, world, c.walk * pace, dt, 'hunter', c.turn)) {
        setMode(h, 'look', now);
        h.until = now + wp[2];
        h.base = h.a;
      }
      break;
    }
    case 'look':
      h.a = h.base + Math.sin((now - h.t) * 2.0) * 0.6;
      if (now >= h.until) {
        h.pi = (h.pi + 1) % Math.max(1, route.length);
        h.path = null;
        setMode(h, 'patrol', now);
      }
      break;
    case 'hear':
      turnTo(h, Math.atan2(h.tz - h.z, h.tx - h.x), c.turn, dt);
      if (now - h.t >= c.hearTurn) {
        setMode(h, 'go', now);
        setPath(h, world, h.tx, h.tz);
      }
      break;
    case 'go':
      if (walk(h, world, c.search * pace, dt, 'hunter', c.turn) || Math.hypot(h.tx - h.x, h.tz - h.z) < 0.8) {
        setMode(h, 'search', now);
        h.until = now + c.searchFor;
        h.base = h.a;
        events.push({ type: 'search', k: h.k });
      }
      break;
    case 'search':
      h.a = h.base + Math.sin((now - h.t) * 2.4) * 1.1;
      if (now >= h.until) {
        h.pi = nearestWaypoint(route, h.x, h.z);
        h.path = null;
        setMode(h, 'patrol', now);
        events.push({ type: 'giveup', k: h.k });
      }
      break;
    case 'spot': {
      const m = ctx.mice.find((x) => x.id === h.tgt);
      if (m) turnTo(h, Math.atan2(m.z - h.z, m.x - h.x), c.turn * 2, dt);
      if (now - h.t >= 0.25) {
        setMode(h, 'chase', now);
        h.path = null;
        h.pathT = 0;
      }
      break;
    }
    case 'chase': {
      const m = ctx.mice.find((x) => x.id === h.tgt && !x.hidden);
      const visible = m && canSee(world, h, m.x, m.z);
      if (visible) {
        h.lx = m.x;
        h.lz = m.z;
        h.seen = now;
        const d = Math.hypot(m.x - h.x, m.z - h.z);
        if (d <= c.reach && now >= h.cool) {
          let px = m.x + m.vx * c.lead;
          let pz = m.z + m.vz * c.lead;
          if (!clearAt(world, px, pz, 0.2, 'mouse') || Math.hypot(px - h.x, pz - h.z) > c.reach + 1.5) {
            px = m.x;
            pz = m.z;
          }
          h.seq = (h.seq + 1) % 100000;
          h.ch = { x: px, z: pz, at: now + tele, seq: h.seq, r: c.hitR, by: h.tgt };
          setMode(h, 'raise', now);
          events.push({ type: 'raise', k: h.k, x: px, z: pz, at: h.ch.at, id: h.tgt });
          break;
        }
      } else if (now - h.seen > c.lose) {
        setMode(h, 'go', now);
        setPath(h, world, h.lx, h.lz);
        events.push({ type: 'lose', k: h.k });
        break;
      }
      const tx = h.lx;
      const tz = h.lz;
      if (clearSegment(world, h.x, h.z, tx, tz, c.r, 'hunter')) {
        h.path = [[tx, tz]];
        h.tx = tx;
        h.tz = tz;
      } else if (!h.path || now - h.pathT > 0.4) {
        setPath(h, world, tx, tz);
        h.pathT = now;
      }
      walk(h, world, c.chase * pace, dt, 'hunter', c.turn * 1.5);
      if (m) {
        // Face the mouse, not the path, when it's close.
        if (Math.hypot(m.x - h.x, m.z - h.z) < 3) turnTo(h, Math.atan2(m.z - h.z, m.x - h.x), c.turn * 2, dt);
      }
      break;
    }
    case 'raise':
      if (h.ch) turnTo(h, Math.atan2(h.ch.z - h.z, h.ch.x - h.x), c.turn, dt);
      if (!h.ch || now >= h.ch.at) {
        if (h.ch) events.push({ type: 'chop', k: h.k, x: h.ch.x, z: h.ch.z, seq: h.ch.seq });
        setMode(h, 'recover', now);
        h.until = now + c.recover;
        h.cool = now + c.recover + 0.3;
      }
      break;
    case 'recover':
      if (now >= h.until) {
        h.ch = null;
        let next = null;
        for (const m of ctx.mice) if (!m.hidden && canSee(world, h, m.x, m.z)) { next = m; break; }
        if (next) {
          h.tgt = next.id;
          h.seen = now;
          h.lx = next.x;
          h.lz = next.z;
          h.path = null;
          setMode(h, 'chase', now);
        } else {
          setMode(h, 'search', now);
          h.until = now + c.searchFor;
          h.base = h.a;
        }
      }
      break;
    default:
      setMode(h, 'patrol', now);
  }
}

function tickCat(h, ctx, now, dt, events) {
  const { world } = ctx;
  const c = HUNTER.cat;
  const roamer = world.cat?.mode === 'roam';
  const heard = h.m === 'crouch' || h.m === 'leap' ? null : loudest(heardBetween(ctx.rings, h.x, h.z, ctx.prev, now, 'cat'));

  const react = (ring) => {
    const d = Math.hypot(ring.x - h.x, ring.z - h.z);
    h.quiet = now + c.quiet;
    if (d <= c.ears) {
      h.seq = (h.seq + 1) % 100000;
      h.ch = { x: ring.x, z: ring.z, at: now + c.crouch + d / c.leap, seq: h.seq, r: c.hitR, by: ring.src ?? '' };
      h.sx = h.x;
      h.sz = h.z;
      h.a = Math.atan2(ring.z - h.z, ring.x - h.x);
      setMode(h, 'crouch', now);
      events.push({ type: 'crouch', k: 'cat', x: ring.x, z: ring.z, at: h.ch.at });
    } else {
      setMode(h, 'stalk', now);
      setPath(h, world, ring.x, ring.z, 'cat');
    }
  };

  switch (h.m) {
    case 'sleep':
      if (heard) {
        setMode(h, 'wake', now);
        h.until = now + c.yawn;
        h.tx = heard.x;
        h.tz = heard.z;
        events.push({ type: 'wake', k: 'cat' });
      }
      break;
    case 'wake':
      turnTo(h, Math.atan2(h.tz - h.z, h.tx - h.x), 3, dt);
      if (now >= h.until) {
        setMode(h, 'listen', now);
        h.quiet = now + c.quiet;
      }
      break;
    case 'listen':
    case 'rest':
    case 'stalk':
    case 'roam':
      if (heard) {
        react(heard);
        break;
      }
      if (h.m === 'stalk') {
        if (walk(h, world, c.walk, dt, 'cat', 4)) setMode(h, 'listen', now);
      } else if (h.m === 'roam') {
        if (!h.path || (h.path.length === 0 && Math.hypot(h.tx - h.x, h.tz - h.z) < 0.5)) {
          const rng = ctx.rng ?? { next: Math.random };
          const [x, z] = randomSpot(world, 'cat', world.cat.x, world.cat.z, 8, rng);
          setPath(h, world, x, z, 'cat');
        }
        if (walk(h, world, c.roam, dt, 'cat', 4)) {
          setMode(h, 'rest', now);
          h.until = now + 2;
        }
      } else if (h.m === 'rest') {
        if (now >= h.until) {
          h.path = null;
          setMode(h, 'roam', now);
        }
      } else if (now >= h.quiet) {
        if (roamer) {
          h.path = null;
          setMode(h, 'roam', now);
        } else {
          setMode(h, 'sleep', now);
          events.push({ type: 'sleep', k: 'cat' });
        }
      }
      break;
    case 'crouch':
      if (now >= h.t + c.crouch) {
        setMode(h, 'leap', now);
        events.push({ type: 'leap', k: 'cat' });
      }
      break;
    case 'leap': {
      const ch = h.ch;
      if (!ch) {
        setMode(h, 'listen', now);
        break;
      }
      const span = Math.max(0.01, ch.at - h.t);
      const u = Math.min(1, (now - h.t) / span);
      h.x = h.sx + (ch.x - h.sx) * u;
      h.z = h.sz + (ch.z - h.sz) * u;
      if (now >= ch.at) {
        [h.x, h.z] = resolve(world, ch.x, ch.z, c.r, 'cat');
        events.push({ type: 'pounce', k: 'cat', x: ch.x, z: ch.z, seq: ch.seq });
        setMode(h, 'land', now);
        h.until = now + c.land;
        h.quiet = now + c.quiet;
      }
      break;
    }
    case 'land':
      if (now >= h.until) {
        h.ch = null;
        setMode(h, 'listen', now);
      }
      break;
    default:
      setMode(h, roamer ? 'roam' : 'sleep', now);
  }
}

// The danger zone a hunter is about to strike, for the autopilot and the pages' own hit checks: { x, z, r, at } or null.
export function strikeOf(h) {
  if (!h.ch) return null;
  if (h.k === 'cat' ? h.m !== 'crouch' && h.m !== 'leap' : h.m !== 'raise') return null;
  return h.ch;
}

// Did a strike that landed at `ch` hit a mouse at (x, z)? The knife and the boot can't reach under furniture; the cat can.
export function strikeHits(world, h, ch, x, z) {
  if (!ch) return false;
  if (h.k !== 'cat' && isCover(world, x, z)) return false;
  return Math.hypot(x - ch.x, z - ch.z) <= ch.r;
}

// ---------------------------------------------------------------- snapshots for the room

const r2 = (v) => Math.round(v * 100) / 100;

export function packHunters(hunters) {
  return hunters.map((h) => {
    const base = { k: h.k, x: r2(h.x), z: r2(h.z), a: r2(h.a), m: h.m, t: r2(h.t), u: r2(h.until), tx: r2(h.tx), tz: r2(h.tz), sq: h.seq };
    if (h.ch) base.ch = [r2(h.ch.x), r2(h.ch.z), Math.round(h.ch.at * 1000) / 1000, h.ch.seq, h.ch.r, String(h.ch.by ?? '').slice(0, 64)];
    if (h.k === 'cat') Object.assign(base, { q: r2(h.quiet), sx: r2(h.sx), sz: r2(h.sz) });
    else Object.assign(base, { pi: h.pi, tg: String(h.tgt ?? '').slice(0, 64), sp: r2(h.spot), se: r2(h.seen), lx: r2(h.lx), lz: r2(h.lz), co: r2(h.cool), b: r2(h.base) });
    return base;
  });
}

const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

// Read hunters back from the room: anything that doesn't fit is refused (null).
export function unpackHunters(raw, world) {
  if (!Array.isArray(raw) || raw.length > 4) return null;
  const out = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') return null;
    const k = p.k;
    if (k !== 'wife' && k !== 'farmer' && k !== 'cat') return null;
    const x = num(p.x, -1, world.W + 1);
    const z = num(p.z, -1, world.D + 1);
    const a = num(p.a, -100, 100);
    if (x === null || z === null || a === null) return null;
    const modes = k === 'cat' ? CAT_MODES : HUMAN_MODES;
    if (!modes.includes(p.m)) return null;
    const t = num(p.t, -1e7, 1e7) ?? 0;
    let ch = null;
    if (Array.isArray(p.ch) && p.ch.length >= 5) {
      const cx = num(p.ch[0], -1, world.W + 1);
      const cz = num(p.ch[1], -1, world.D + 1);
      const at = num(p.ch[2], -1e7, 1e7);
      const seq = num(p.ch[3], 0, 1e6);
      const r = num(p.ch[4], 0.1, 2);
      if (cx !== null && cz !== null && at !== null && seq !== null && r !== null) ch = { x: cx, z: cz, at, seq, r, by: typeof p.ch[5] === 'string' ? p.ch[5] : '' };
    }
    const h = { k, x, z, a, m: p.m, t, until: num(p.u, -1e7, 1e7) ?? 0, tx: num(p.tx, -1, world.W + 1) ?? x, tz: num(p.tz, -1, world.D + 1) ?? z, ch, seq: num(p.sq, 0, 1e6) ?? 0, path: null, pathT: 0 };
    if (k === 'cat') Object.assign(h, { quiet: num(p.q, -1e7, 1e7) ?? 0, sx: num(p.sx, -1, world.W + 1) ?? x, sz: num(p.sz, -1, world.D + 1) ?? z });
    else {
      const route = world[k]?.patrol ?? [];
      Object.assign(h, {
        pi: Number.isInteger(p.pi) && p.pi >= 0 && p.pi < Math.max(1, route.length) ? p.pi : 0,
        tgt: typeof p.tg === 'string' ? p.tg.slice(0, 64) : '',
        spot: num(p.sp, 0, 10) ?? 0,
        seen: num(p.se, -1e7, 1e7) ?? 0,
        lx: num(p.lx, -1, world.W + 1) ?? x,
        lz: num(p.lz, -1, world.D + 1) ?? z,
        cool: num(p.co, -1e7, 1e7) ?? 0,
        base: num(p.b, -100, 100) ?? a,
      });
    }
    out.push(h);
  }
  return out;
}
