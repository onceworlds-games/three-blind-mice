// A night's rules: the record the host keeps (cheese, tails, traps, dawn), what a mouse may do with the cheese, hits, how the
// night ends and its stars. Pure functions on a plain record, so the room, the tests and the attract mode share them.

import { MOUSE, holeMouth } from './mouse.js';
import { clearAt } from './world.js';

export const REST_SECONDS = 4;
export const AWAY_DROP_SECONDS = 4;

const newMouse = () => ({ tail: 1, out: 0, safe: 0, home: 0, hits: 0 });

export function createNight(world, ids, now) {
  const mice = {};
  for (const id of ids) mice[id] = newMouse();
  return {
    v: 1,
    lv: world.night.id,
    t0: now,
    dawn: now + world.night.dawn,
    it: world.items.map((i) => ({ k: i.k, x: i.x, z: i.z, by: '', h: [], home: 0 })),
    mice,
    tr: world.traps.map(() => 0),
    g: 0,
    end: '',
    endAt: 0,
    rest: 0,
    solo: ids.length <= 1 ? 1 : 0,
  };
}

export function addMouse(data, id) {
  if (!data.mice[id]) data.mice[id] = newMouse();
}

export function carrying(data, id) {
  return data.it.findIndex((i) => !i.home && (i.by === id || i.h.includes(id)));
}

export const isOut = (data, id, now) => (data.mice[id]?.out ?? 0) > now;

// Pick up item i. Returns '' when it worked, or why not.
export function grab(data, world, i, id, x, z, now) {
  const it = data.it[i];
  const m = data.mice[id];
  if (!it || !m) return 'no such thing';
  if (it.home) return 'home already';
  if (m.out > now) return 'out';
  if (carrying(data, id) >= 0) return 'hands full';
  const reach = it.k === 'W' ? MOUSE.wheelR + MOUSE.r + 0.5 : MOUSE.grabR + 0.35;
  if (Math.hypot(x - it.x, z - it.z) > reach) return 'too far';
  if (it.k === 'w') {
    if (it.by) return 'taken';
    it.by = id;
  } else if (!it.by) it.by = id;
  else if (it.h.length < 2) it.h.push(id);
  else return 'full';
  data.g = 1;
  return '';
}

// Let go of whatever this mouse carries, here. A wedge or wheel lands on clear floor.
export function drop(data, world, id, x, z) {
  const i = carrying(data, id);
  if (i < 0) return -1;
  const it = data.it[i];
  if (it.by === id) {
    const r = it.k === 'W' ? MOUSE.wheelR : 0.2;
    if (Number.isFinite(x) && Number.isFinite(z) && x > 0 && z > 0 && x < world.W && z < world.D && clearAt(world, x, z, r * 0.8, it.k === 'W' ? 'wheel' : 'mouse')) {
      it.x = x;
      it.z = z;
    }
    it.by = '';
    it.h = [];
  } else it.h = it.h.filter((h) => h !== id);
  return i;
}

// Bring item i home: its carrier is at the hole.
export function home(data, world, i, id, x, z) {
  const it = data.it[i];
  if (!it || it.home || it.by !== id) return 'not yours';
  const [mx, mz] = holeMouth(world);
  const reach = it.k === 'W' ? MOUSE.homeR + MOUSE.wheelR + 0.7 : MOUSE.homeR + 0.5;
  if (Math.hypot(x - mx, z - mz) > reach) return 'not at the hole';
  it.home = 1;
  it.x = mx;
  it.z = mz;
  for (const who of [it.by, ...it.h]) if (data.mice[who]) data.mice[who].home += 1;
  it.by = '';
  it.h = [];
  return '';
}

// A mouse was hit. 'tail' the first time, 'out' after; '' if it can't be hit now.
export function hit(data, world, id, now, x, z) {
  const m = data.mice[id];
  if (!m || now < m.safe || m.out > now) return '';
  drop(data, world, id, x, z);
  m.hits += 1;
  if (m.tail) {
    m.tail = 0;
    m.safe = now + MOUSE.safe;
    return 'tail';
  }
  m.out = now + MOUSE.outFor;
  m.safe = m.out + MOUSE.safe;
  return 'out';
}

export function snap(data, i) {
  if (i < 0 || i >= data.tr.length || data.tr[i]) return false;
  data.tr[i] = 1;
  return true;
}

export const allHome = (data) => data.it.length > 0 && data.it.every((i) => i.home);
export const homeCount = (data) => data.it.filter((i) => i.home).length;

// Has the night ended by itself? 'all' (every piece home), 'dawn', or ''.
export function endCheck(data, now) {
  if (data.end) return data.end;
  if (allHome(data)) return 'all';
  if (now >= data.dawn) return 'dawn';
  return '';
}

// Everyone still playing in the hole, with something home, for 4 s: the night ends. Updates data.rest; returns true then.
export function restCheck(data, now, present, inHole) {
  const ok = present.length > 0 && homeCount(data) > 0 && present.every((id) => inHole.includes(id));
  if (!ok) {
    data.rest = 0;
    return false;
  }
  if (!data.rest) data.rest = now;
  return now - data.rest >= REST_SECONDS;
}

export function stars(data) {
  const mice = Object.values(data.mice);
  return {
    home: homeCount(data) > 0,
    all: allHome(data),
    tails: mice.length > 0 && mice.every((m) => m.tail === 1),
  };
}

export const starCount = (s) => (s.home ? 1 : 0) + (s.all ? 1 : 0) + (s.tails && s.home ? 1 : 0);

// ---------------------------------------------------------------- reading the record back from the room

const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const str = (v, max = 64) => typeof v === 'string' && v.length <= max;

export function validNight(raw, world) {
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
  if (!num(raw.lv, 1, 99) || !num(raw.t0, -1e9, 1e9) || !num(raw.dawn, -1e9, 1e9)) return null;
  if (!Array.isArray(raw.it) || raw.it.length > 12 || !Array.isArray(raw.tr) || raw.tr.length > 32) return null;
  if (!raw.mice || typeof raw.mice !== 'object' || Object.keys(raw.mice).length > 8) return null;
  const it = [];
  for (const i of raw.it) {
    if (!i || (i.k !== 'w' && i.k !== 'W') || !num(i.x, 0, world.W) || !num(i.z, 0, world.D) || !str(i.by) || !Array.isArray(i.h) || i.h.length > 2 || !i.h.every((h) => str(h))) return null;
    it.push({ k: i.k, x: i.x, z: i.z, by: i.by, h: [...i.h], home: i.home ? 1 : 0 });
  }
  const mice = {};
  for (const [id, m] of Object.entries(raw.mice)) {
    if (!str(id) || !m || typeof m !== 'object') return null;
    if (!num(m.out, -1e9, 1e9) || !num(m.safe, -1e9, 1e9) || !num(m.home, 0, 99) || !num(m.hits, 0, 999)) return null;
    mice[id] = { tail: m.tail ? 1 : 0, out: m.out, safe: m.safe, home: m.home, hits: m.hits };
  }
  return {
    v: 1,
    lv: raw.lv,
    t0: raw.t0,
    dawn: raw.dawn,
    it,
    mice,
    tr: raw.tr.map((t) => (t ? 1 : 0)),
    g: raw.g ? 1 : 0,
    end: ['all', 'dawn', 'rest'].includes(raw.end) ? raw.end : '',
    endAt: num(raw.endAt, -1e9, 1e9) ? raw.endAt : 0,
    rest: num(raw.rest, -1e9, 1e9) ? raw.rest : 0,
    solo: raw.solo ? 1 : 0,
  };
}
