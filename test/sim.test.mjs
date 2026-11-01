// Whole nights through the pure modules with autopilot mice: every night is solvable, nights end, noise matters, friends help.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, STEP } from '../src/core/sim.js';
import { createBrain, think } from '../src/core/autopilot.js';
import { createRng } from '../src/core/rng.js';
import { NIGHTS } from '../src/core/levels.js';
import { starCount } from '../src/core/night.js';

const finite = (...v) => v.every(Number.isFinite);

function play(night, { mice = 1, seed = 1, skill = 0.85, careless = false, noisy = false, rush = false } = {}) {
  const ids = ['m1', 'm2', 'm3'].slice(0, mice);
  const sim = createSim({ night: night.id, ids, seed, skill, careless, brains: !noisy, solo: mice === 1, rush });
  const brains = noisy ? ids.map((_, n) => createBrain({ skill, rng: createRng(seed * 31 + n) })) : null;
  let nextBig = 1;
  while (!sim.ended && sim.now < night.dawn + 2) {
    if (noisy) {
      const bodies = sim.mice.map((m) => ({ id: m.id, x: m.x, z: m.z, vx: m.vx, vz: m.vz, st: m.st }));
      sim.mice.forEach((m, n) => {
        m.input = think(brains[n], { world: sim.world, data: sim.data, now: sim.now, hunters: sim.hunters, mice: bodies, me: m, claims: sim.claims });
      });
      // A big squeak every second, whatever is near.
      if (sim.now >= nextBig) {
        nextBig += 1;
        for (const m of sim.mice) m.input = { ...m.input, squeak: 'big' };
      }
    }
    sim.step(STEP);
  }
  return sim;
}

for (const night of NIGHTS) {
  test(`night ${night.id}: autopilots clear it before dawn, alone and in threes, with nothing NaN`, () => {
    for (const mice of [1, 3]) {
      for (let seed = 1; seed <= 8; seed++) {
        const skill = 0.7 + (seed % 4) * 0.08;
        const sim = play(night, { mice, seed, skill });
        const where = `night ${night.id}, ${mice} mice, seed ${seed}`;
        assert.ok(sim.ended, `${where}: ended`);
        assert.ok(sim.now <= night.dawn + 0.1, `${where}: by dawn`);
        assert.equal(sim.data.it.filter((i) => i.home).length, sim.data.it.length, `${where}: all the cheese home (${sim.ended} at ${sim.now.toFixed(0)})`);
        for (const m of sim.mice) assert.ok(finite(m.x, m.z, m.vx, m.vz), `${where}: mouse finite`);
        for (const h of sim.hunters) assert.ok(finite(h.x, h.z, h.a), `${where}: ${h.k} finite`);
      }
    }
  });
}

test('at its best the autopilot beats par on every night (a speedrun: no crumbs, no tiptoe)', () => {
  for (const night of NIGHTS) {
    const sim = play(night, { mice: 1, seed: 3, skill: 1, rush: true });
    assert.ok(sim.ended === 'all' && sim.now < night.par, `night ${night.id}: ${sim.ended} at ${sim.now.toFixed(1)}, par ${night.par}`);
  }
});

test('noise matters: squeaking big every second gets you caught far more often', () => {
  let careful = 0;
  let noisy = 0;
  for (const night of NIGHTS.filter((n) => [2, 3, 5, 7, 9, 11].includes(n.id))) {
    for (let seed = 1; seed <= 2; seed++) {
      careful += play(night, { mice: 1, seed }).stats.hits;
      noisy += play(night, { mice: 1, seed, noisy: true }).stats.hits;
    }
  }
  assert.ok(noisy >= careful * 2 + 4, `careful ${careful} hits, noisy ${noisy}`);
});

test('a careless mouse loses tails and stars a careful one keeps', () => {
  let careful = 0;
  let careless = 0;
  for (const night of NIGHTS.slice(1)) {
    for (let seed = 1; seed <= 3; seed++) {
      careful += starCount(play(night, { mice: 1, seed, skill: 0.95 }).stars());
      careless += starCount(play(night, { mice: 1, seed, skill: 0.4, careless: true }).stars());
    }
  }
  assert.ok(careful > careless, `stars careful ${careful}, careless ${careless}`);
});

test('three mice clear the nights with more cheese faster than one', () => {
  for (const night of NIGHTS.filter((n) => n.id >= 6)) {
    let one = 0;
    let three = 0;
    for (let seed = 1; seed <= 3; seed++) {
      one += play(night, { mice: 1, seed }).now;
      three += play(night, { mice: 3, seed }).now;
    }
    assert.ok(three < one, `night ${night.id}: three ${three.toFixed(0)} s, one ${one.toFixed(0)} s`);
  }
});

test('the same seed plays the same night', () => {
  const a = play(NIGHTS[4], { mice: 3, seed: 5 });
  const b = play(NIGHTS[4], { mice: 3, seed: 5 });
  assert.equal(a.now, b.now);
  assert.deepEqual(a.stats, b.stats);
});
