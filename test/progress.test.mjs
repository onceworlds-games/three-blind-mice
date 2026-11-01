// Saved progress and hints: garbage cleaned, nights unlocking, best times kept, each hint shown once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProgress, unlockedNights, recordNight, totalStars, loadProgress } from '../src/progress.js';
import { createHints, HINTS } from '../src/hints.js';

test('progress from storage is cleaned', () => {
  const p = cleanProgress({ v: 1, stars: [3, 9, -1, 'x', 2.6], best: [41.5, NaN, 1e9], fewest: [4], glasses: 3, hints: { squeak: 1, ['x'.repeat(40)]: 1 } });
  assert.deepEqual(p.stars.slice(0, 5), [3, 0, 0, 0, 2]);
  assert.equal(p.stars.length, 12);
  assert.deepEqual(p.best.slice(0, 3), [41.5, 0, 0]);
  assert.equal(p.glasses, 3);
  assert.deepEqual(Object.keys(p.hints), ['squeak']);
  for (const junk of [null, 'save', [], { v: 2, stars: [3] }, { v: 1, glasses: 99 }]) {
    const q = cleanProgress(junk);
    assert.equal(totalStars(q), 0);
    assert.equal(q.glasses, 0);
  }
});

test('a night with a star opens the next', () => {
  const p = cleanProgress(null);
  assert.equal(unlockedNights(p), 1);
  recordNight(p, { night: 1, time: 50, stars: { home: true, all: false, tails: true } }, 3);
  assert.equal(p.stars[0], 2);
  assert.equal(unlockedNights(p), 2);
  assert.equal(recordNight(p, { night: 2, time: 90, stars: { home: false, all: false, tails: true } }, 3), 0, 'no tails star without cheese home');
  assert.equal(unlockedNights(p), 2);
});

test('best time and fewest squeaks are kept from full clears only', () => {
  const p = cleanProgress(null);
  recordNight(p, { night: 3, time: 80.04, stars: { home: true, all: true, tails: false } }, 12);
  recordNight(p, { night: 3, time: 95, stars: { home: true, all: true, tails: true } }, 7);
  recordNight(p, { night: 3, time: 30, stars: { home: true, all: false, tails: true } }, 1);
  assert.equal(p.best[2], 80);
  assert.equal(p.fewest[2], 7);
  assert.equal(p.stars[2], 3);
  assert.equal(recordNight(p, { night: 99, time: 1, stars: { home: true, all: true, tails: true } }, 1), 0);
});

test('without the platform, progress lives in memory', async () => {
  const p = await loadProgress(null);
  assert.equal(totalStars(p), 0);
  const started = Date.now();
  const q = await loadProgress({ save: { get: async () => ({ v: 1, stars: [1] }) } });
  assert.equal(q.stars[0], 1);
  assert.ok(Date.now() - started < 1000);
});

test('hints: short, one at a time, each once, remembered', () => {
  for (const text of Object.values(HINTS)) {
    const words = text.split(/\s+/).length;
    assert.ok(words >= 2 && words <= 5, text);
  }
  const p = cleanProgress(null);
  let saves = 0;
  const h = createHints(p, () => saves++);
  h.show('squeak');
  h.show('big');
  h.show('squeak');
  h.tick(0.1);
  assert.equal(h.current, HINTS.squeak);
  h.done('squeak');
  for (let i = 0; i < 30; i++) h.tick(0.1);
  assert.equal(h.current, HINTS.big);
  assert.equal(p.hints.squeak, 1);
  assert.ok(saves >= 1);
  h.show('squeak');
  for (let i = 0; i < 100; i++) h.tick(0.1);
  assert.notEqual(h.current, HINTS.squeak, 'never again');
});
