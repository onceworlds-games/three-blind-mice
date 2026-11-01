// The twelve nights: each builds, teaches one thing, and everything in it can be reached.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NIGHTS, NIGHT_COUNT } from '../src/core/levels.js';
import { buildWorld, reachable, clearAt, isCover } from '../src/core/world.js';
import { holeMouth, spawnPoint, inHole, MOUSE } from '../src/core/mouse.js';

test('twelve nights, each with its own lesson, a dawn of 3-5 minutes and a par well inside it', () => {
  assert.equal(NIGHT_COUNT, 12);
  const lessons = new Set();
  NIGHTS.forEach((n, i) => {
    assert.equal(n.id, i + 1);
    assert.ok(n.name && n.teach, `night ${n.id} has a name and a lesson`);
    lessons.add(n.teach);
    assert.ok(n.dawn >= 180 && n.dawn <= 300, `night ${n.id} dawn ${n.dawn}`);
    assert.ok(n.par > 0 && n.par <= n.dawn * 0.6, `night ${n.id} par ${n.par}`);
    const w = n.map[0].length;
    for (const row of n.map) assert.equal(row.length, w, `night ${n.id} rows are one width`);
  });
  assert.ok(lessons.size >= 10, `lessons: ${[...lessons].join(', ')}`);
});

for (const night of NIGHTS) {
  test(`night ${night.id} (${night.name}): a hole, cheese and a hunter, all reachable`, () => {
    const world = buildWorld(night.id);
    assert.ok(world.hole, 'a mousehole');
    assert.ok(world.items.length >= 1 && world.items.length <= 12, 'cheese');
    assert.ok(world.wife || world.farmer || world.cat, 'someone hunting');
    const [hx, hz] = holeMouth(world);
    for (let n = 0; n < 3; n++) {
      const [x, z] = spawnPoint(world, n);
      assert.ok(clearAt(world, x, z, MOUSE.r, 'mouse'), `spawn ${n} is clear`);
    }
    for (const it of world.items) {
      assert.ok(reachable(world, 'mouse', hx, hz, it.x, it.z), `${it.k} at ${it.x},${it.z} reachable from the hole`);
      if (it.k === 'W') assert.ok(reachable(world, 'wheel', it.x, it.z, hx, hz), 'the wheel rolls home');
      assert.ok(!inHole(world, it.x, it.z), 'cheese starts outside the hole');
    }
    for (const k of ['wife', 'farmer']) {
      const route = world[k]?.patrol;
      if (!route) continue;
      for (let i = 0; i < route.length; i++) {
        const [ax, az] = route[i];
        const [bx, bz] = route[(i + 1) % route.length];
        assert.ok(reachable(world, 'hunter', ax, az, bx, bz), `${k} walks ${i} to ${(i + 1) % route.length}`);
      }
    }
    for (const t of world.traps) assert.ok(!isCover(world, t.x, t.z), 'traps sit in the open');
  });
}
