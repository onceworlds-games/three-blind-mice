// The rules on their own: rings, masking sounds, the night record, hits, stars, the end, and reading a record back.
import test from 'node:test';
import assert from 'node:assert/strict';
import { RINGS, ringRadius, ringReachTime, masked, maskingBetween, heardBetween } from '../src/core/rings.js';
import { buildWorld } from '../src/core/world.js';
import { createNight, grab, drop, home, hit, snap, carrying, endCheck, restCheck, stars, starCount, validNight, REST_SECONDS } from '../src/core/night.js';
import { holeMouth, MOUSE } from '../src/core/mouse.js';
import { NIGHTS } from '../src/core/levels.js';
import { createRng } from '../src/core/rng.js';

test('a ring grows eased out to its radius, and reach time is its inverse', () => {
  for (const [kind, def] of Object.entries(RINGS)) {
    assert.equal(ringRadius(kind, 0), 0);
    assert.equal(ringRadius(kind, def.dur * 2), def.r);
    let prev = 0;
    for (let a = 0.01; a <= def.dur; a += def.dur / 20) {
      const r = ringRadius(kind, a);
      assert.ok(r >= prev, `${kind} grows`);
      prev = r;
      assert.ok(Math.abs(ringReachTime(kind, r) - a) < 1e-6, `${kind} reach time at ${a}`);
    }
    assert.equal(ringReachTime(kind, def.r + 1), Infinity);
  }
  assert.ok(RINGS.big.r > RINGS.small.r * 2, 'a big squeak shows much more');
});

test('a hunter hears a ring once, when its front passes, unless it was muffled', () => {
  const rings = [{ kind: 'big', x: 0, z: 0, t: 1, src: 'a' }, { kind: 'small', x: 0, z: 0, t: 1, src: 'b', muffled: true }, { kind: 'step', x: 0, z: 0, t: 1 }];
  const at = 1 + ringReachTime('big', 5);
  assert.deepEqual(heardBetween(rings, 5, 0, 0, at - 0.01), []);
  assert.equal(heardBetween(rings, 5, 0, at - 0.01, at + 0.01).length, 1);
  assert.deepEqual(heardBetween(rings, 5, 0, at + 0.01, 10), []);
  assert.deepEqual(heardBetween(rings, 1, 0, 0, 10, 'a').filter((r) => r.src === 'a'), [], 'not its own');
});

test('the clock chime and the snore hide sounds for a moment, on time', () => {
  const study = NIGHTS.find((n) => n.chime);
  assert.ok(study, 'a night with a chime');
  const { every, dur, at = 0 } = study.chime;
  assert.ok(masked(study, at + 0.1));
  assert.ok(!masked(study, at + dur + 0.1));
  assert.ok(masked(study, at + every + 0.1));
  const list = maskingBetween(study, 0, at + every * 3 - 0.001);
  assert.equal(list.filter((m) => m.kind === 'chime').length, 3);
  const bedroom = NIGHTS.find((n) => n.snore);
  assert.ok(bedroom && masked(bedroom, (bedroom.snore.at ?? 0) + 0.05));
});

test('cheese: grab within reach, one wedge per mouse, drop, and home only at the hole', () => {
  const world = buildWorld(1);
  const d = createNight(world, ['a', 'b'], 0);
  const it = d.it[0];
  assert.equal(grab(d, world, 0, 'a', it.x + 3, it.z, 1), 'too far');
  assert.equal(grab(d, world, 0, 'a', it.x + 0.3, it.z, 1), '');
  assert.equal(carrying(d, 'a'), 0);
  assert.equal(grab(d, world, 0, 'b', it.x, it.z, 1), 'taken');
  assert.equal(d.g, 1, 'the first grab is remembered (the wife comes in)');
  assert.equal(home(d, world, 0, 'a', it.x, it.z), 'not at the hole');
  const [hx, hz] = holeMouth(world);
  assert.equal(home(d, world, 0, 'a', hx, hz), '');
  assert.equal(endCheck(d, 2), 'all');
  assert.deepEqual(stars(d), { home: true, all: true, tails: true });
  assert.equal(starCount(stars(d)), 3);
});

test('the wheel takes up to three; dropping lets go', () => {
  const world = buildWorld(6);
  const d = createNight(world, ['a', 'b', 'c', 'e'], 0);
  const wi = d.it.findIndex((i) => i.k === 'W');
  const W = d.it[wi];
  for (const id of ['a', 'b', 'c']) assert.equal(grab(d, world, wi, id, W.x + 0.9, W.z, 1), '');
  assert.equal(grab(d, world, wi, 'e', W.x + 0.9, W.z, 1), 'full');
  assert.equal(W.by, 'a');
  assert.deepEqual(W.h, ['b', 'c']);
  assert.ok(drop(d, world, 'b', W.x, W.z) >= 0);
  assert.deepEqual(W.h, ['c']);
});

test('hits: the first takes your tail, then you are safe a moment, then the next puts you out', () => {
  const world = buildWorld(2);
  const d = createNight(world, ['a'], 0);
  const it = d.it[0];
  grab(d, world, 0, 'a', it.x, it.z, 0);
  assert.equal(hit(d, world, 'a', 1, it.x, it.z), 'tail');
  assert.equal(carrying(d, 'a'), -1, 'a hit drops the cheese');
  assert.equal(hit(d, world, 'a', 1 + MOUSE.safe / 2, it.x, it.z), '', 'safe for a moment');
  assert.equal(hit(d, world, 'a', 1 + MOUSE.safe + 0.1, it.x, it.z), 'out');
  assert.equal(stars(d).tails, false);
  assert.ok(snap(d, 0) === (d.tr.length > 0));
});

test('the night ends at dawn, or after everyone rests in the hole with something home', () => {
  const world = buildWorld(2);
  const d = createNight(world, ['a', 'b'], 10);
  assert.equal(endCheck(d, 10 + world.night.dawn - 0.1), '');
  assert.equal(endCheck(d, 10 + world.night.dawn), 'dawn');
  assert.equal(restCheck(d, 20, ['a', 'b'], ['a', 'b']), false, 'nothing home yet');
  d.it[0].home = 15;
  assert.equal(restCheck(d, 20, ['a', 'b'], ['a']), false);
  assert.equal(restCheck(d, 20, ['a', 'b'], ['a', 'b']), false);
  assert.equal(restCheck(d, 20 + REST_SECONDS - 0.1, ['a', 'b'], ['a', 'b']), false);
  assert.equal(restCheck(d, 20 + REST_SECONDS, ['a', 'b'], ['a', 'b']), true);
});

test('a record read back from the room: good ones survive, garbage is refused', () => {
  const world = buildWorld(3);
  const d = createNight(world, ['a', 'b'], 0);
  assert.deepEqual(validNight(structuredClone(d), world).it, d.it);
  const bad = [null, 7, 'x', [], { ...d, v: 2 }, { ...d, lv: NaN }, { ...d, it: 'no' }, { ...d, it: Array(40).fill(d.it[0]) }, { ...d, dawn: Infinity }, { ...d, mice: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`m${i}`, {}])) }];
  for (const b of bad) assert.equal(validNight(b, world), null, JSON.stringify(b)?.slice(0, 60));
  const rng = createRng(9);
  for (let i = 0; i < 300; i++) {
    const junk = structuredClone(d);
    const it = junk.it[rng.int(junk.it.length)];
    const k = ['x', 'z', 'by', 'h', 'home', 'k'][rng.int(6)];
    it[k] = [NaN, -5, 1e12, 'zz'.repeat(80), {}, null, [1, 2, 3, 4]][rng.int(7)];
    const v = validNight(junk, world);
    if (v) for (const x of v.it) assert.ok(Number.isFinite(x.x) && Number.isFinite(x.z) && typeof x.by === 'string' && Array.isArray(x.h));
  }
});
