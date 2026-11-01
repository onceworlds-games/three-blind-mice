// A whole night in one place, with autopilot mice: the title's attract mode, the trailer's autoplay and the balance tests.
// The live game splits the same steps between pages (each its own mouse, the host the hunters and the record).

import { buildWorld } from './world.js';
import { createRng } from './rng.js';
import { createMouse, stepMouse, stepNoise, inHole, speedFor, wheelPush, wheelSlot, MOUSE, holeMouth, spawnPoint } from './mouse.js';
import { createNight, grab, drop, home, hit, snap, carrying, endCheck, restCheck, stars } from './night.js';
import { createHunters, tickHunters, strikeHits } from './hunters.js';
import { RINGS, masked, maskingBetween } from './rings.js';
import { createBrain, think } from './autopilot.js';

export const STEP = 1 / 30;

export function createSim({ night, ids = ['m1'], seed = 1, skill = 0.8, careless = false, brains = true, solo } = {}) {
  const world = buildWorld(night);
  const rng = createRng(seed);
  const data = createNight(world, ids, 0);
  if (solo !== undefined) data.solo = solo ? 1 : 0;
  const hunters = createHunters(world, { script: world.night.script });
  const mice = ids.map((id, n) => ({
    ...createMouse(id, world, n),
    st: 'hole',
    stun: 0,
    seat: n,
    squeaks: 0,
    tail: 1,
    brain: brains ? createBrain({ skill: Array.isArray(skill) ? skill[n] ?? 0.8 : skill, careless: Array.isArray(careless) ? !!careless[n] : careless, rng: createRng(seed * 977 + n * 31 + 7) }) : null,
    input: { ix: 0, iz: 0, squeak: null, drop: false },
    wheelT: 0,
    closeShave: 0,
  }));
  const sim = { world, data, hunters, mice, rings: [], now: 0, events: [], ended: '', claims: {}, stats: { hits: 0, tails: 0, outs: 0, squeaks: 0, spotted: 0, heard: 0, snaps: 0 }, rng };

  sim.ring = (kind, x, z, src = '', t = sim.now) => {
    const ring = { kind, x, z, t, src, muffled: RINGS[kind]?.heard ? masked(world.night, t) : false };
    sim.rings.push(ring);
    sim.events.push({ type: 'ring', ring });
    return ring;
  };

  const strike = (h, ch) => {
    for (const m of mice) {
      if (m.st !== 'play') continue;
      if (!strikeHits(world, h, ch, m.x, m.z)) {
        if (Math.hypot(m.x - ch.x, m.z - ch.z) < 1.4) m.closeShave += 1;
        continue;
      }
      const what = hit(data, world, m.id, sim.now, m.x, m.z);
      if (!what) continue;
      sim.stats.hits += 1;
      if (what === 'tail') {
        sim.stats.tails += 1;
        m.stun = sim.now + MOUSE.stun;
        m.tail = 0;
      } else {
        sim.stats.outs += 1;
        m.st = 'out';
      }
      sim.events.push({ type: 'hit', id: m.id, what, by: h.k });
    }
  };

  sim.step = (dt = STEP) => {
    if (sim.ended) return;
    const prev = sim.now;
    const now = prev + dt;
    sim.now = now;
    for (const mk of maskingBetween(world.night, prev, now)) {
      const src = mk.kind === 'chime' ? world.clock ?? { x: world.W / 2, z: 1 } : world.snore ?? { x: world.W / 2, z: 2 };
      sim.ring(mk.kind, src.x, src.z, mk.kind, mk.t);
    }
    const bodies = mice.map((m) => ({ id: m.id, x: m.x, z: m.z, vx: m.vx, vz: m.vz, st: m.st }));

    // Wheels: the lead moves it along everyone's pushes.
    const wheelInputs = new Map();
    for (const m of mice) {
      const rec = data.mice[m.id];
      if (rec.out > now) {
        m.st = 'out';
        [m.x, m.z] = holeMouth(world);
        continue;
      }
      if (m.st === 'out') {
        m.st = 'hole';
        [m.x, m.z, m.a] = spawnPoint(world, m.seat);
        m.vx = 0;
        m.vz = 0;
      }
      if (m.brain) m.input = think(m.brain, { world, data, now, hunters, mice: bodies, me: m, claims: sim.claims });
      const inp = m.input;
      if (inp.drop) {
        const i = drop(data, world, m.id, m.x, m.z);
        if (i >= 0) {
          m.dropAt = now;
          sim.events.push({ type: 'drop', id: m.id, i });
        }
      }
      const stunned = now < m.stun;
      const ix = stunned ? 0 : inp.ix;
      const iz = stunned ? 0 : inp.iz;
      const ci = carrying(data, m.id);
      const it = ci >= 0 ? data.it[ci] : null;
      if (it && it.k === 'W') {
        if (!wheelInputs.has(ci)) wheelInputs.set(ci, []);
        wheelInputs.get(ci).push([ix, iz]);
        continue;
      }
      if (stepMouse(world, m, ix, iz, dt, speedFor(it?.k)) ) sim.events.push({ type: 'bump', id: m.id });
      if (it) {
        it.x = m.x + Math.cos(m.a) * 0.3;
        it.z = m.z + Math.sin(m.a) * 0.3;
      }
      afterMove(m, it, ci, dt, inp);
    }
    for (const [ci, inputs] of wheelInputs) {
      const it = data.it[ci];
      const push = wheelPush(inputs);
      const body = it._body ?? (it._body = { x: it.x, z: it.z, vx: 0, vz: 0, a: 0 });
      body.x = it.x;
      body.z = it.z;
      stepMouse(world, body, push.x, push.z, dt, speedFor('W', push.n), MOUSE.wheelR, 'wheel');
      it.x = body.x;
      it.z = body.z;
      const carriers = [it.by, ...it.h];
      carriers.forEach((id, slot) => {
        const m = mice.find((mm) => mm.id === id);
        if (!m) return;
        [m.x, m.z, m.a] = wheelSlot(it.x, it.z, body.a, slot);
        m.vx = body.vx;
        m.vz = body.vz;
        if (slot === 0) {
          const moving = Math.hypot(body.vx, body.vz) > 0.4;
          it._rumble = (it._rumble ?? 0) - dt;
          if (moving && it._rumble <= 0) {
            it._rumble = 0.5;
            sim.ring('rumble', it.x, it.z, m.id);
          }
        }
        afterMove(m, it, ci, dt, m.input);
      });
    }

    const evs = tickHunters(hunters, { world, mice: mice.map((m) => ({ id: m.id, x: m.x, z: m.z, vx: m.vx, vz: m.vz, hidden: m.st !== 'play' })), rings: sim.rings, prev, solo: !!data.solo, entered: !!data.g, rng }, now, dt);
    for (const e of evs) {
      sim.events.push(e);
      if (e.type === 'spot') sim.stats.spotted += 1;
      if (e.type === 'hear') sim.stats.heard += 1;
      if (e.type === 'chop' || e.type === 'pounce') {
        const h = hunters.find((hh) => hh.k === e.k);
        strike(h, { x: e.x, z: e.z, r: h.ch?.r ?? 0.85 });
        sim.ring('thud', e.x, e.z, e.k);
      }
    }

    const end = endCheck(data, now);
    const present = mice.map((m) => m.id);
    const inHoleIds = mice.filter((m) => m.st === 'hole' || m.st === 'out').map((m) => m.id);
    if (end || restCheck(data, now, present, inHoleIds)) {
      sim.ended = end || 'rest';
      data.end = sim.ended;
      data.endAt = now;
      sim.events.push({ type: 'end', why: sim.ended });
    }
    // Keep the last few seconds of rings (the renderer fades them).
    if (sim.rings.length > 80) sim.rings.splice(0, sim.rings.length - 80);
  };

  function afterMove(m, it, ci, dt, inp) {
    const noise = stepNoise(world, m, dt);
    if (noise) sim.ring(noise, m.x, m.z, m.id);
    if (inp.squeak && m.st !== 'out') {
      sim.ring(inp.squeak, m.x, m.z, m.id);
      m.squeaks += 1;
      sim.stats.squeaks += 1;
    }
    // Traps.
    world.traps.forEach((t, i) => {
      if (data.tr[i] || Math.hypot(t.x - m.x, t.z - m.z) > 0.42) return;
      snap(data, i);
      sim.stats.snaps += 1;
      sim.ring('snap', t.x, t.z, m.id);
      const what = hit(data, world, m.id, sim.now, m.x, m.z);
      if (what === 'tail') {
        m.stun = sim.now + MOUSE.stun;
        m.tail = 0;
      } else if (what === 'out') m.st = 'out';
      sim.events.push({ type: 'snap', id: m.id, i, what });
    });
    if (m.st === 'out') return;
    // Pick up what we touch.
    if (!it && sim.now - (m.dropAt ?? -9) > 1.5) {
      for (let i = 0; i < data.it.length; i++) {
        if (grab(data, world, i, m.id, m.x, m.z, sim.now) === '') {
          sim.events.push({ type: 'grab', id: m.id, i });
          break;
        }
      }
    }
    m.st = inHole(world, m.x, m.z) ? 'hole' : 'play';
    const now = carrying(data, m.id);
    if (now >= 0 && data.it[now].by === m.id) {
      const item = data.it[now];
      const x = item.k === 'W' ? item.x : m.x;
      const z = item.k === 'W' ? item.z : m.z;
      if (home(data, world, now, m.id, x, z) === '') sim.events.push({ type: 'home', id: m.id, i: now });
    }
    void ci;
  }

  sim.run = (seconds, onStep) => {
    const n = Math.ceil(seconds / STEP);
    for (let i = 0; i < n && !sim.ended; i++) {
      sim.step(STEP);
      onStep?.(sim);
    }
    return sim;
  };

  sim.stars = () => stars(data);
  return sim;
}
