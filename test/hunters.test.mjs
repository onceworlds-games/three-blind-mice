// The hunters on an open test floor: what her lantern sees, the knife, hearing, and the cat.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, isCover } from '../src/core/world.js';
import { createHunters, tickHunters, strikeHits, canSee, lanternOf, HUNTER } from '../src/core/hunters.js';
import { stepMouse, MOUSE } from '../src/core/mouse.js';
import { createRng } from '../src/core/rng.js';

const ARENA = {
  id: 90,
  name: 'Test floor',
  teach: 'test',
  dawn: 200,
  par: 60,
  map: [
    '################################',
    '#..............................#',
    '#..............................#',
    '#..1........................2..#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..........TTTT................#',
    '#..........TTTT.......K........#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#o..........w..................#',
    '################################',
  ],
};
const world = buildWorld(ARENA);
const DT = 1 / 30;

// Run her and one mouse for `seconds`; `move(m, wife, now)` gives the mouse's input. Returns chops and hits.
function chase({ x, z, wifeX, wifeZ, a = 0, seconds = 10, speed = MOUSE.speed, move }) {
  const hunters = createHunters(world, {}).filter((h) => h.k === 'wife');
  const wife = hunters[0];
  Object.assign(wife, { x: wifeX, z: wifeZ, a, m: 'patrol', tx: wifeX, tz: wifeZ, path: null });
  const m = { id: 'm', x, z, vx: 0, vz: 0, a: 0 };
  const rng = createRng(4);
  let now = 0;
  const out = { chops: 0, hits: 0, spotted: false };
  for (let i = 0; i < seconds / DT; i++) {
    now += DT;
    const evs = tickHunters(hunters, { world, mice: [{ id: 'm', x: m.x, z: m.z, vx: m.vx, vz: m.vz, hidden: false }], rings: [], prev: now - DT, solo: false, entered: true, rng }, now, DT);
    for (const e of evs) {
      if (e.type === 'spot') out.spotted = true;
      if (e.type === 'chop') {
        out.chops += 1;
        if (strikeHits(world, wife, wife.ch, m.x, m.z)) out.hits += 1;
      }
    }
    const [ix, iz] = move(m, wife, now);
    stepMouse(world, m, ix, iz, DT, speed);
  }
  return out;
}

test('her lantern sees a pool ahead of her, never under the table', () => {
  const [wife] = createHunters(world, {}).filter((h) => h.k === 'wife');
  Object.assign(wife, { x: 8, z: 5, a: 0, m: 'patrol' });
  const [lx, lz] = lanternOf(wife);
  assert.ok(Math.abs(lx - (8 + HUNTER.wife.ahead)) < 1e-9 && lz === 5);
  assert.ok(canSee(world, wife, lx + 2, lz));
  assert.ok(!canSee(world, wife, lx + HUNTER.wife.pool + 0.5, lz), 'beyond the pool');
  Object.assign(wife, { x: 9.5, z: 8, a: 0 });
  assert.ok(isCover(world, 12.5, 8));
  assert.ok(!canSee(world, wife, 12.5, 8), 'under the table');
  wife.m = 'wait';
  assert.ok(!canSee(world, wife, lx + 1, lz), 'not before she comes in');
});

test('the knife: a mouse frozen in her light is always hit', () => {
  for (const dx of [1.5, 2.2, 3]) {
    const r = chase({ x: 8 + dx, z: 5, wifeX: 8, wifeZ: 5, move: () => [0, 0], seconds: 6 });
    assert.ok(r.spotted && r.chops >= 1 && r.hits === r.chops, `frozen at ${dx}: ${JSON.stringify(r)}`);
  }
});

test('the knife: a mouse that keeps running and turning is never hit', () => {
  for (const turn of [0.5, 0.7, 0.9]) {
    const r = chase({
      x: 10.5,
      z: 6,
      wifeX: 8,
      wifeZ: 5,
      seconds: 8,
      move: (m, w, now) => {
        // Away from her, weaving.
        const away = Math.atan2(m.z - w.z, m.x - w.x);
        const a = away + (Math.floor(now / turn) % 2 ? 0.9 : -0.9);
        return [Math.cos(a), Math.sin(a)];
      },
    });
    assert.equal(r.hits, 0, `weaving every ${turn}s: ${JSON.stringify(r)}`);
  }
});

test('the knife: a mouse carrying cheese straight away from her is caught', () => {
  const r = chase({ x: 10.5, z: 4, wifeX: 8, wifeZ: 4, speed: MOUSE.carry, seconds: 8, move: () => [1, 0] });
  assert.ok(r.hits >= 1, JSON.stringify(r));
});

test('she hears a squeak and goes to look where it was', () => {
  const hunters = createHunters(world, {}).filter((h) => h.k === 'wife');
  const wife = hunters[0];
  Object.assign(wife, { x: 5, z: 4, a: 0, m: 'patrol', tx: 5, tz: 4, path: null });
  const rings = [{ kind: 'big', x: 14, z: 10, t: 0.05, src: 'm' }];
  let now = 0;
  const seen = new Set();
  for (let i = 0; i < 6 / DT; i++) {
    now += DT;
    const evs = tickHunters(hunters, { world, mice: [], rings, prev: now - DT, solo: false, entered: true, rng: createRng(1) }, now, DT);
    for (const e of evs) seen.add(e.type);
  }
  assert.ok(seen.has('hear'), [...seen].join());
  assert.ok(Math.hypot(wife.x - 14, wife.z - 10) < Math.hypot(5 - 14, 4 - 10) - 3, 'she walked towards it');
});

// The cat, awake and listening, and a mouse that squeaks within her ears.
function pounce(stay) {
  const hunters = createHunters(world, {}).filter((h) => h.k === 'cat');
  const cat = hunters[0];
  Object.assign(cat, { m: 'listen', quiet: 99 });
  const m = { id: 'm', x: cat.x + 3, z: cat.z, vx: 0, vz: 0, a: 0 };
  const rings = [{ kind: 'small', x: m.x, z: m.z, t: 0.1, src: 'm' }];
  let now = 0;
  let hits = 0;
  let pounces = 0;
  for (let i = 0; i < 4 / DT; i++) {
    now += DT;
    const evs = tickHunters(hunters, { world, mice: [{ id: 'm', x: m.x, z: m.z, vx: m.vx, vz: m.vz, hidden: false }], rings, prev: now - DT, solo: false, entered: true, rng: createRng(2) }, now, DT);
    for (const e of evs)
      if (e.type === 'pounce') {
        pounces += 1;
        if (strikeHits(world, cat, cat.ch, m.x, m.z)) hits += 1;
      }
    if (!stay && now > 0.15) stepMouse(world, m, 0, 1, DT, MOUSE.speed);
  }
  return { hits, pounces };
}

test('the cat leaps at a squeak: a mouse that sits still is caught, one that moves on is not', () => {
  const still = pounce(true);
  assert.equal(still.pounces, 1);
  assert.equal(still.hits, 1);
  const moved = pounce(false);
  assert.equal(moved.pounces, 1);
  assert.equal(moved.hits, 0);
});

test('asleep, the cat wakes only when a ring reaches her', () => {
  const hunters = createHunters(world, {}).filter((h) => h.k === 'cat');
  const cat = hunters[0];
  assert.equal(cat.m, 'sleep');
  const far = [{ kind: 'small', x: cat.x - 9, z: cat.z, t: 0.1, src: 'm' }];
  let now = 0;
  for (let i = 0; i < 2 / DT; i++) {
    now += DT;
    tickHunters(hunters, { world, mice: [], rings: far, prev: now - DT, solo: false, entered: true }, now, DT);
  }
  assert.equal(cat.m, 'sleep', 'a squeak 9 u away does not reach her');
  const near = [{ kind: 'small', x: cat.x - 4, z: cat.z, t: now, src: 'm' }];
  for (let i = 0; i < 1 / DT; i++) {
    now += DT;
    tickHunters(hunters, { world, mice: [], rings: near, prev: now - DT, solo: false, entered: true }, now, DT);
  }
  assert.equal(cat.m, 'wake');
});
