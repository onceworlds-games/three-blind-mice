// Crumbs, chains, tiptoe, the score and its medals, and the Daily Raid's remix.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, clearAt } from '../src/core/world.js';
import { NIGHTS } from '../src/core/levels.js';
import { CRUMB, chainMult, crumbMax } from '../src/core/crumbs.js';
import { createNight, takeCrumb, validNight, noteSpot, noteShave, noteNoise, grab, home } from '../src/core/night.js';
import { scoreNight, medalsFor, speedBonus, SCORE } from '../src/core/score.js';
import { stepNoise, MOUSE, holeMouth } from '../src/core/mouse.js';
import { dayKey, prevDay, dailyPlan, dailyNight, validDay } from '../src/core/daily.js';
import { createSim } from '../src/core/sim.js';

test('every night has 20-40 crumbs on clear floor, apart, away from the hole, the same on every build', () => {
  for (const n of NIGHTS) {
    const w = buildWorld(n.id);
    const again = buildWorld(n.id);
    assert.deepEqual(w.crumbs, again.crumbs, `night ${n.id}: seeded`);
    assert.ok(w.crumbs.length >= 20 && w.crumbs.length <= 40, `night ${n.id}: ${w.crumbs.length} crumbs`);
    const [hx, hz] = holeMouth(w);
    for (const [i, [x, z]] of w.crumbs.entries()) {
      assert.ok(clearAt(w, x, z, 0.2, 'mouse'), `night ${n.id} crumb ${i} on clear floor`);
      assert.ok(Math.hypot(x - hx, z - hz) > 1.5, `night ${n.id} crumb ${i} not at the hole`);
      for (const t of w.traps) assert.ok(Math.hypot(x - t.x, z - t.z) >= 0.99, `night ${n.id} crumb ${i} not on a trap`);
      for (let j = i + 1; j < w.crumbs.length; j++) {
        const [x2, z2] = w.crumbs[j];
        assert.ok(Math.hypot(x - x2, z - z2) >= CRUMB.spacing - 1e-6, `night ${n.id}: crumbs ${i} and ${j} apart`);
      }
    }
  }
});

test('crumbs chain when taken within 2.5 s: ×1, ×2 ... up to ×5', () => {
  const w = buildWorld(2);
  const d = createNight(w, ['a', 'b'], 0);
  const at = (i) => w.crumbs[i];
  assert.equal(takeCrumb(d, w, 0, 'a', at(0)[0], at(0)[1], 1), '');
  assert.equal(takeCrumb(d, w, 0, 'b', at(0)[0], at(0)[1], 1.1), 'gone', 'one mouth per crumb');
  assert.equal(takeCrumb(d, w, 1, 'a', at(1)[0] + 3, at(1)[1], 1.5), 'too far');
  let t = 1;
  for (let i = 1; i <= 6; i++) {
    t += 1;
    assert.equal(takeCrumb(d, w, i, 'a', at(i)[0], at(i)[1], t), '');
  }
  const a = d.mice.a;
  assert.equal(a.cr, 7);
  assert.equal(a.ch, 7);
  assert.equal(a.bc, 7);
  assert.equal(a.pt, CRUMB.pts * (1 + 2 + 3 + 4 + 5 + 5 + 5));
  // A pause breaks the chain.
  assert.equal(takeCrumb(d, w, 7, 'a', at(7)[0], at(7)[1], t + CRUMB.gap + 0.1), '');
  assert.equal(a.ch, 1);
  assert.equal(chainMult(9), 5);
  assert.equal(crumbMax(6), 10 * (1 + 2 + 3 + 4 + 5 + 5));
  // The record survives the trip through the room, and a forged one doesn't.
  const back = validNight(JSON.parse(JSON.stringify(d)), w);
  assert.deepEqual(back.cr, d.cr);
  assert.equal(back.mice.a.pt, a.pt);
  assert.equal(validNight({ ...JSON.parse(JSON.stringify(d)), cr: 'x' }, w), null);
  assert.equal(validNight({ ...JSON.parse(JSON.stringify(d)), mice: { a: { ...a, pt: -5 } } }, w), null);
});

test('tiptoeing is silent on creaky boards; scurrying creaks', () => {
  const w = buildWorld(3);
  let cell = null;
  for (let z = 0; z < w.D && !cell; z++) for (let x = 0; x < w.W && !cell; x++) if (w.info(x, z).noise === 'creak') cell = [x + 0.5, z + 0.5];
  const fast = { x: cell[0], z: cell[1], vx: MOUSE.speed, vz: 0, noiseT: 0 };
  const slow = { x: cell[0], z: cell[1], vx: MOUSE.speed * MOUSE.creep, vz: 0, noiseT: 0 };
  let loud = 0;
  let quiet = 0;
  for (let i = 0; i < 120; i++) {
    if (stepNoise(w, fast, 1 / 60)) loud++;
    if (stepNoise(w, slow, 1 / 60)) quiet++;
  }
  assert.ok(loud >= 4, `scurrying: ${loud} creaks`);
  assert.equal(quiet, 0, 'tiptoe: no creak');
  assert.ok(MOUSE.speed * MOUSE.creep <= MOUSE.quiet);
  assert.ok(MOUSE.carry * MOUSE.creep <= MOUSE.quiet, 'tiptoe works with a wedge too');
});

test('the score: cheese, crumbs, style bonuses only when something came home, medals in order', () => {
  const w = buildWorld(3);
  const d = createNight(w, ['a'], 0);
  let s = scoreNight(d, w, 60);
  assert.equal(s.total, 0);
  assert.equal(s.medal, 0);
  takeCrumb(d, w, 0, 'a', w.crumbs[0][0], w.crumbs[0][1], 1);
  s = scoreNight(d, w, 60);
  assert.equal(s.total, CRUMB.pts, 'crumbs count without cheese, bonuses do not');
  assert.ok(!s.lines.some((l) => l.bonus));
  // Bring a wedge home.
  const i = d.it.findIndex((it) => it.k === 'w');
  assert.equal(grab(d, w, i, 'a', d.it[i].x, d.it[i].z, 2), '');
  const [mx, mz] = holeMouth(w);
  assert.equal(home(d, w, i, 'a', mx, mz), '');
  s = scoreNight(d, w, 60);
  const ids = s.lines.map((l) => l.id);
  for (const id of ['tails', 'unseen', 'quiet']) assert.ok(ids.includes(id), `${id} bonus`);
  assert.ok(!ids.includes('speed'), 'no speed bonus without all the cheese');
  noteSpot(d, 'a');
  noteNoise(d, 'a');
  noteShave(d, 'a');
  noteShave(d, 'a');
  s = scoreNight(d, w, 60);
  assert.ok(!s.lines.some((l) => l.id === 'unseen' || l.id === 'quiet'));
  assert.equal(s.lines.find((l) => l.id === 'shaves').pts, 2 * SCORE.shave);
  const m = medalsFor(w);
  assert.ok(m[0] < m[1] && m[1] < m[2]);
  assert.equal(speedBonus(10, 70), SCORE.speed);
  assert.equal(speedBonus(140, 70), 0);
  assert.ok(speedBonus(100, 70) > 0 && speedBonus(100, 70) < SCORE.speed);
  // Quiet feet only where there are noisy floors.
  const w1 = buildWorld(1);
  const d1 = createNight(w1, ['a'], 0);
  d1.it[0].home = 1;
  assert.ok(!scoreNight(d1, w1, 30).lines.some((l) => l.id === 'quiet'));
});

test('medals: bronze for cheese home, silver for a careful mouse, gold a stretch the autopilot misses', () => {
  let good = 0;
  let careless = 0;
  let bronze = 0;
  for (const id of [2, 4, 7, 9]) {
    for (const seed of [1, 2]) {
      good += createSim({ night: id, seed, skill: 0.95 }).run(400).score().medal >= 2 ? 1 : 0;
      const c = createSim({ night: id, seed, skill: 0.5, careless: true }).run(400).score().medal;
      careless += c === 3 ? 1 : 0;
      bronze += c >= 1 ? 1 : 0;
    }
  }
  assert.ok(good >= 6, `silver or better: ${good}/8`);
  assert.ok(careless === 0, `careless golds: ${careless}/8`);
  assert.ok(bronze >= 7, `careless bronze or better: ${bronze}/8`);
  // Night 1's autopilot gets every easy bonus but half the crumbs: silver, well short of gold.
  for (const seed of [1, 2, 3]) {
    const s = createSim({ night: 1, seed, skill: 0.95 }).run(400).score();
    assert.equal(s.medal, 2, `night 1 seed ${seed}: ${s.total} of ${s.medals}`);
    assert.ok(s.medals[2] - s.total >= 400, `night 1 gold is a stretch: ${s.total} vs ${s.medals[2]}`);
  }
  // Bronze: one wedge home on night 1 is enough.
  const w = buildWorld(1);
  assert.ok(medalsFor(w)[0] <= SCORE.wedge);
});

test('the Daily Raid: one remix per day, the same for everyone, cheese moved, still clearable', () => {
  assert.equal(dayKey(Date.UTC(2026, 10, 1, 23, 59)), 20261101);
  assert.equal(prevDay(20261101), 20261031);
  assert.equal(prevDay(20260301), 20260228);
  assert.ok(validDay(20261101) && !validDay(20261301) && !validDay(123));
  const seen = new Set();
  for (let i = 0; i < 14; i++) {
    const day = dayKey(Date.UTC(2026, 10, 1) + i * 86400000);
    const plan = dailyPlan(day);
    assert.deepEqual(dailyPlan(day), plan);
    seen.add(plan.twist);
    const night = dailyNight(day);
    assert.equal(night.id, plan.night);
    assert.equal(night.daily, day);
    const base = buildWorld(plan.night);
    const w = buildWorld(night);
    assert.equal(w.items.length, base.items.length, `${day}: same cheese`);
    assert.ok(w.items.some((it, k) => it.x !== base.items[k].x || it.z !== base.items[k].z) || w.items.every((it) => it.k === 'W'), `${day}: moved`);
    assert.notDeepEqual(w.crumbs, base.crumbs, `${day}: new crumbs`);
    if (plan.twist === 'golden') assert.equal(w.items.filter((it) => it.gold).length, 1);
    if (plan.twist === 'prowl') assert.ok(w.cat);
    const sim = createSim({ night, seed: 2, skill: 0.9 });
    sim.run(night.dawn + 5);
    assert.ok(sim.data.it.some((it) => it.home), `${day}: the autopilot gets cheese home`);
  }
  assert.ok(seen.size >= 3, 'twists vary');
});
