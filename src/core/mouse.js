// A mouse's body: how it moves and what it touches. The same on every page, in the tests and in the attract mode.

import { resolve, noiseAt, NOISE_RING } from './world.js';

export const MOUSE = {
  speed: 3.0,
  carry: 2.0,
  wheel: [1.5, 2.3, 2.8],
  accel: 30,
  r: 0.22,
  stun: 0.8,
  safe: 2.0,
  outFor: 8,
  grabR: 0.75,
  wheelR: 0.72,
  homeR: 0.95,
  noiseEvery: 0.4,
  smallCool: 0.35,
  bigCool: 1.2,
  bigHold: 0.3,
  bigFull: 0.7,
  quiet: 1.5, // at or under this speed a mouse tiptoes: silent on creaky boards, crumbs and pans
  creep: 0.42, // the tiptoe key's share of full speed
};

export const holeMouth = (world) => [world.hole.cx + 0.5, world.hole.cz + 0.5];

// Where the n-th mouse comes out of the hole.
export function spawnPoint(world, n = 0) {
  const [mx, mz] = holeMouth(world);
  const h = world.hole;
  const side = [-h.wz, h.wx];
  const off = [0, 0.45, -0.45][n % 3];
  const [x, z] = resolve(world, mx - h.wx * 0.6 + side[0] * off, mz - h.wz * 0.6 + side[1] * off, MOUSE.r);
  return [x, z, Math.atan2(-h.wz, -h.wx)];
}

export function createMouse(id, world, n = 0) {
  const [x, z, a] = spawnPoint(world, n);
  return { id, x, z, vx: 0, vz: 0, a, noiseT: 0 };
}

// One step of movement toward the input (ix, iz: -1..1, length up to 1) at up to maxSpeed. Returns true when it bumped into
// something (a whisker tick).
export function stepMouse(world, m, ix, iz, dt, maxSpeed, r = MOUSE.r, mode = 'mouse') {
  let len = Math.hypot(ix, iz);
  if (len > 1) {
    ix /= len;
    iz /= len;
    len = 1;
  }
  const tx = ix * maxSpeed;
  const tz = iz * maxSpeed;
  const dvx = tx - m.vx;
  const dvz = tz - m.vz;
  const dv = Math.hypot(dvx, dvz);
  const max = MOUSE.accel * dt;
  if (dv > max) {
    m.vx += (dvx / dv) * max;
    m.vz += (dvz / dv) * max;
  } else {
    m.vx = tx;
    m.vz = tz;
  }
  const wantX = m.x + m.vx * dt;
  const wantZ = m.z + m.vz * dt;
  const [x, z] = resolve(world, wantX, wantZ, r, mode);
  const bumped = Math.hypot(x - wantX, z - wantZ) > 0.004 && Math.hypot(m.vx, m.vz) > 1;
  if (dt > 0) {
    // Lose the speed that went into the wall.
    m.vx = (x - m.x) / dt;
    m.vz = (z - m.z) / dt;
  }
  m.x = x;
  m.z = z;
  const sp = Math.hypot(m.vx, m.vz);
  if (sp > 0.25 && len > 0.05) {
    const want = Math.atan2(iz, ix);
    let d = want - m.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    m.a += d * Math.min(1, dt * 14);
  }
  return bumped;
}

// The noise a moving mouse makes on creaky boards, crumbs or pans: a ring kind every 0.4 s, or null. Tiptoeing (slower
// than MOUSE.quiet) makes none.
export const tiptoeing = (m) => Math.hypot(m.vx, m.vz) <= MOUSE.quiet;
export function stepNoise(world, m, dt) {
  const kind = noiseAt(world, m.x, m.z);
  const moving = !tiptoeing(m);
  if (!kind || !moving) {
    m.noiseT = Math.min(m.noiseT, 0.15);
    return null;
  }
  m.noiseT -= dt;
  if (m.noiseT > 0) return null;
  m.noiseT = MOUSE.noiseEvery;
  return kind;
}

export const noiseRadius = (kind) => NOISE_RING[kind] ?? 0;

export const inHole = (world, x, z) => {
  const [mx, mz] = holeMouth(world);
  return Math.hypot(x - mx, z - mz) <= MOUSE.homeR;
};

// The speed for a mouse carrying something: a wedge, or the wheel with this many pushing the same way.
export function speedFor(carrying, pushers = 1) {
  if (carrying === 'w') return MOUSE.carry;
  if (carrying === 'W') return MOUSE.wheel[Math.max(0, Math.min(2, pushers - 1))];
  return MOUSE.speed;
}

// Combine the wheel's pushers' inputs: the direction and how many push that way (a push against it cancels).
export function wheelPush(inputs) {
  let sx = 0;
  let sz = 0;
  for (const [x, z] of inputs) {
    const l = Math.hypot(x, z);
    if (l < 0.2) continue;
    sx += x / l;
    sz += z / l;
  }
  const l = Math.hypot(sx, sz);
  if (l < 0.5) return { x: 0, z: 0, n: 0 };
  const dx = sx / l;
  const dz = sz / l;
  let n = 0;
  for (const [x, z] of inputs) {
    const il = Math.hypot(x, z);
    if (il >= 0.2 && (x * dx + z * dz) / il > 0.5) n++;
  }
  return { x: dx, z: dz, n: Math.max(1, n) };
}

// The slots round a wheel where its pushers stand: the lead behind it (opposite the way it rolls), helpers at its sides.
export function wheelSlot(wx, wz, heading, slot) {
  const ang = heading + Math.PI + [0, 1.1, -1.1][slot % 3];
  const d = MOUSE.wheelR + MOUSE.r + 0.04;
  return [wx + Math.cos(ang) * d, wz + Math.sin(ang) * d, heading];
}
