// Saved progress and hints: garbage cleaned, the first build's saves carried over, nights unlocking, best scores and medals
// kept, mouse levels and what they unlock, daily goals and the streak, each hint shown once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProgress, unlockedNights, recordNight, totalStars, loadProgress, mergeProgress, levelOf, xpNeed, nightXp, ensureDay, touchStreak, liveStreak, goalXp, wearable } from '../src/progress.js';
import { goalsFor, cleanGoals, GOALS } from '../src/goals.js';
import { UNLOCKS, unlockedAt, cleanLook, KINDS } from '../src/looks.js';
import { createHints, HINTS } from '../src/hints.js';

const score = (o = {}) => ({ total: 2000, counts: true, medal: 1, lines: [{ id: 'cheese', pts: 500 }], ...o });
const night = (n, o = {}) => ({ night: n, day: 0, time: 50, stars: { home: true, all: true, tails: true }, score: score(), mine: { crumbs: 12, chain: 4, shaves: 1, tail: 1, home: 1 }, ...o });

test('progress from storage is cleaned; a first-build save carries over as XP', () => {
  const p = cleanProgress({ v: 1, stars: [3, 9, -1, 'x', 2.6], best: [41.5, NaN, 1e9], fewest: [4], glasses: 3, hints: { squeak: 1, ['x'.repeat(40)]: 1 } });
  assert.deepEqual(p.stars.slice(0, 5), [3, 0, 0, 0, 2]);
  assert.equal(p.stars.length, 12);
  assert.deepEqual(p.best.slice(0, 3), [41.5, 0, 0]);
  assert.equal(p.xp, 5 * 150);
  assert.equal(p.v, 2);
  assert.deepEqual(Object.keys(p.hints), ['squeak']);
  assert.ok(unlockedAt('glasses', p.look.g, levelOf(p.xp).level), 'old glasses only if the level has them');
  for (const junk of [null, 'save', [], { v: 3, stars: [3] }, { v: 2, xp: -5, look: { g: 99 }, daily: { day: 'x' }, streak: { n: NaN } }]) {
    const q = cleanProgress(junk);
    assert.equal(totalStars(q), 0);
    assert.equal(q.xp, 0);
    assert.deepEqual(q.look, { g: 0, h: 0, f: 0, t: 0 });
    assert.equal(q.daily.day, 0);
    assert.equal(q.streak.n, 0);
  }
  // A forged look beyond the level is taken off.
  const hi = cleanProgress({ v: 2, xp: 0, look: { g: 6, h: 10, f: 7, t: 5 } });
  assert.deepEqual(hi.look, { g: 0, h: 0, f: 0, t: 0 });
  const ok = cleanProgress({ v: 2, xp: 1e6, look: { g: 6, h: 10, f: 7, t: 5 } });
  assert.deepEqual(ok.look, { g: 6, h: 10, f: 7, t: 5 });
});

test('a night with a star opens the next; Daily Raids give no stars', () => {
  const p = cleanProgress(null);
  assert.equal(unlockedNights(p), 1);
  recordNight(p, night(1, { stars: { home: true, all: false, tails: true } }));
  assert.equal(p.stars[0], 2);
  assert.equal(unlockedNights(p), 2);
  assert.equal(recordNight(p, night(2, { stars: { home: false, all: false, tails: true } })).stars, 0, 'no tails star without cheese home');
  assert.equal(unlockedNights(p), 2);
  recordNight(p, night(5, { day: 20261101 }), 3, 20261101);
  assert.equal(p.stars[4], 0);
  assert.equal(p.score[4], 0);
  assert.equal(p.daily.raid, 2000);
  assert.equal(p.totals.raids, 1);
});

test('best score, medal, time and fewest squeaks are kept', () => {
  const p = cleanProgress(null);
  let r = recordNight(p, night(3, { time: 80.04, score: score({ total: 3000, medal: 2 }) }), 12);
  assert.equal(r.firstScore, true);
  assert.equal(r.medalUp, 2);
  r = recordNight(p, night(3, { time: 95, score: score({ total: 2500, medal: 1 }) }), 7);
  assert.equal(r.newBest, false);
  assert.equal(r.medalUp, 0);
  r = recordNight(p, night(3, { time: 99, score: score({ total: 3400, medal: 3 }) }), 9);
  assert.equal(r.newBest, true);
  assert.equal(r.medalUp, 3);
  assert.equal(p.best[2], 80);
  assert.equal(p.fewest[2], 7);
  assert.equal(p.score[2], 3400);
  assert.equal(p.medal[2], 3);
  assert.equal(recordNight(p, night(99)).xp, 0);
});

test('mouse levels: quick at first, slower later; every unlock has a level, each kind starts free', () => {
  assert.equal(levelOf(0).level, 1);
  assert.equal(levelOf(xpNeed(1) - 1).level, 1);
  assert.equal(levelOf(xpNeed(1)).level, 2);
  let xp = 0;
  for (let l = 1; l < 10; l++) xp += xpNeed(l);
  assert.equal(levelOf(xp).level, 10);
  assert.ok(nightXp(score()) >= 200 * 0.8 && nightXp(score()) < xpNeed(1) * 1.5, 'about a level from a good first night');
  assert.ok(nightXp(score(), { raid: true }) > nightXp(score()));
  const seen = new Set();
  for (const u of UNLOCKS) {
    assert.ok(KINDS[u.kind]?.[u.id], `${u.kind} ${u.id} exists`);
    const key = `${u.kind}:${u.id}`;
    assert.ok(!seen.has(key), `${key} once`);
    seen.add(key);
    assert.ok(!unlockedAt(u.kind, u.id, u.level - 1) && unlockedAt(u.kind, u.id, u.level));
  }
  for (const [kind, list] of Object.entries(KINDS)) {
    assert.ok(unlockedAt(kind, 0, 1));
    for (let id = 1; id < list.length; id++) assert.ok(seen.has(`${kind}:${id}`), `${kind} ${id} can be earned`);
  }
  assert.deepEqual(cleanLook({ g: 2.5, h: -1, f: 'x', t: 99 }), { g: 0, h: 0, f: 0, t: 0 });
  assert.deepEqual(wearable({ g: 1, h: 1 }, 2), { g: 0, h: 1, f: 0, t: 0 });
});

test('daily goals: three a day by tier, the same for everyone with the same nights open, counted and paid once', () => {
  const day = 20261101;
  const g = goalsFor(day, 12);
  assert.equal(g.length, 3);
  assert.deepEqual(g.map((x) => GOALS[x.id].tier), [0, 1, 2]);
  assert.deepEqual(goalsFor(day, 12), g);
  for (let d = 1; d <= 28; d++) for (const x of goalsFor(20260200 + d, 1)) assert.ok((GOALS[x.id].min ?? 1) <= 1, 'nothing from nights not open');
  const p = cleanProgress(null);
  ensureDay(p, day);
  p.daily.goals = [{ id: 'crumbs40', need: 40, have: 0, done: 0 }, { id: 'chain5', need: 1, have: 0, done: 0 }, { id: 'gold', need: 1, have: 0, done: 0 }];
  const xp0 = p.xp;
  let r = recordNight(p, night(2, { mine: { crumbs: 30, chain: 5, shaves: 0, tail: 1, home: 1 } }), 3, day);
  assert.deepEqual(r.goals, ['chain5']);
  assert.equal(p.daily.goals[0].have, 30);
  r = recordNight(p, night(2, { mine: { crumbs: 30, chain: 2, shaves: 0, tail: 1, home: 1 }, score: score({ medal: 3 }) }), 3, day);
  assert.deepEqual(r.goals.sort(), ['crumbs40', 'gold']);
  assert.equal(r.allGoals, true);
  assert.ok(p.xp - xp0 >= 3 * 150 + 250);
  r = recordNight(p, night(2, { score: score({ medal: 3 }) }), 3, day);
  assert.deepEqual(r.goals, []);
  assert.equal(r.allGoals, false);
  assert.equal(cleanGoals([{ id: 'nope' }, { id: 'gold', have: 5, done: 1 }, 'x']).length, 1);
  assert.equal(cleanGoals([{ id: 'gold', have: 5, done: 1 }])[0].have, 1);
});

test('the streak: days in a row, broken by a missed day; goals pay more on a streak', () => {
  const p = cleanProgress(null);
  assert.equal(touchStreak(p, 20261030), true);
  assert.equal(touchStreak(p, 20261030), false, 'once a day');
  touchStreak(p, 20261031);
  touchStreak(p, 20261101);
  assert.equal(p.streak.n, 3);
  assert.equal(liveStreak(p, 20261102), 3, 'still alive the next day');
  assert.equal(liveStreak(p, 20261103), 0, 'gone after a missed day');
  touchStreak(p, 20261103);
  assert.equal(p.streak.n, 1);
  assert.equal(p.streak.best, 3);
  assert.ok(goalXp(5) > goalXp(1));
  assert.equal(goalXp(50), goalXp(6));
});

test('without the platform, progress lives in memory', async () => {
  const p = await loadProgress(null);
  assert.equal(totalStars(p), 0);
  const started = Date.now();
  const q = await loadProgress({ save: { get: async () => ({ v: 1, stars: [1] }) } });
  assert.equal(q.stars[0], 1);
  assert.ok(Date.now() - started < 1000);
});

test('a save that loads late is merged with what was played meanwhile, keeping the best of both', () => {
  const played = cleanProgress(null);
  played.stars[0] = 2;
  played.best[0] = 50;
  played.score[0] = 4000;
  played.xp = 300;
  const saved = cleanProgress({ v: 2, stars: [3, 1], best: [60, 90], fewest: [4], score: [3000, 2000], medal: [2, 1], xp: 5000, look: { g: 1 }, hints: { squeak: 1 }, streak: { n: 4, last: 20261031, best: 6 }, totals: { crumbs: 400 } });
  mergeProgress(played, saved);
  assert.deepEqual(played.stars.slice(0, 3), [3, 1, 0]);
  assert.deepEqual(played.best.slice(0, 2), [50, 90]);
  assert.deepEqual(played.score.slice(0, 2), [4000, 2000]);
  assert.deepEqual(played.medal.slice(0, 2), [2, 1]);
  assert.equal(played.fewest[0], 4);
  assert.equal(played.xp, 5000);
  assert.equal(played.look.g, 1);
  assert.equal(played.streak.n, 4);
  assert.equal(played.totals.crumbs, 400);
  assert.equal(played.hints.squeak, 1);
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
