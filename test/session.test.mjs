// The room flow through a fake room (the Hub): friends in the lobby, the night, squeaks crossing, a latecomer joining in
// at the hole, the host reloading, a carrier leaving, a lone player's quick start and pause, and garbage from a page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, createHost, t } from '@onceworlds/sdk/match';
import { Hub } from '../src/core/localroom.js';
import { createSession } from '../src/core/session.js';
import { holeMouth } from '../src/core/mouse.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function table() {
  const hub = new Hub();
  const pages = new Map();
  const add = (id, firstPick = 1) => {
    const room = hub.join(id, id.toUpperCase());
    const s = createSession({ room, createMatch, createHost, t, introSeconds: 0.2, firstPick, unlocked: () => 12 });
    s.input = {};
    // What the platform's strip does: ready, and the host's Start.
    s.ready = (on) => room.setReady(on);
    s.start = () => {
      if (room.canStart) room.startMatch();
    };
    pages.set(id, s);
    return s;
  };
  const frames = async (n) => {
    for (let i = 0; i < n; i++) {
      for (const s of pages.values()) s.update(1 / 60, s.input);
      await sleep(16);
    }
  };
  const until = async (fn, ms = 4000) => {
    const end = Date.now() + ms;
    while (!fn()) {
      if (Date.now() > end) return false;
      await frames(1);
    }
    return true;
  };
  const close = () => {
    for (const s of pages.values()) s.dispose();
    pages.clear();
  };
  return { hub, pages, add, frames, until, close };
}

test('two friends: ready, start, and the same night on both pages', async () => {
  const T = table();
  try {
    const a = T.add('a');
    const b = T.add('b');
    await T.frames(3);
    assert.equal(a.phase, 'lobby');
    assert.equal(b.setPick(5), false, 'only the host picks');
    assert.equal(a.setPick(2), true);
    await T.frames(2);
    assert.equal(b.pick(), 2, "the host's pick is everyone's");
    b.ready(true);
    await T.frames(2);
    a.start();
    assert.ok(await T.until(() => a.phase === 'round' && b.phase === 'round' && a.data && b.data));
    assert.equal(a.data.lv, 2);
    assert.deepEqual(Object.keys(a.data.mice).sort(), ['a', 'b']);
    assert.ok(await T.until(() => b.hunters.length > 0), 'the host runs the hunters and the friend sees them');
    assert.equal(b.hunters[0].k, a.hunters[0].k);
    // A squeak crosses as a ring with the squeaker's seat.
    b.input.squeakNow = 'small';
    assert.ok(await T.until(() => a.rings.some((r) => r.kind === 'small' && r.src === 'b')));
    // A friend walks to the cheese: the shared record says who has it.
    const it = a.world.items[0];
    a.me.x = it.x - 0.3;
    a.me.z = it.z;
    a.me.st = 'play';
    assert.ok(await T.until(() => b.data?.it[0].by === 'a'), 'grab reaches the friend');
  } finally {
    T.close();
  }
});

test('a latecomer watches, then Join in brings them out of the hole', async () => {
  const T = table();
  try {
    const a = T.add('a');
    const b = T.add('b');
    await T.frames(2);
    b.ready(true);
    await T.frames(2);
    a.start();
    assert.ok(await T.until(() => a.phase === 'round' && a.data));
    const c = T.add('c');
    assert.ok(await T.until(() => c.phase === 'round' && c.data));
    assert.equal(c.room.spectating, true);
    assert.equal(c.me.st, 'watch');
    c.joinIn();
    assert.ok(await T.until(() => c.room.isParticipant('c') && c.me.st !== 'watch' && c.me.st !== 'join'), 'admitted');
    const [hx, hz] = holeMouth(c.world);
    assert.ok(Math.hypot(c.me.x - hx, c.me.z - hz) < 2, 'at the hole');
    assert.ok(await T.until(() => a.data.mice.c), 'the host gave the latecomer a record');
  } finally {
    T.close();
  }
});

test('the host reloads mid-night: the friend takes over the hunters and the night goes on', async () => {
  const T = table();
  try {
    const a = T.add('a', 3);
    const b = T.add('b');
    await T.frames(2);
    b.ready(true);
    await T.frames(2);
    a.start();
    assert.ok(await T.until(() => b.phase === 'round' && b.hunters.length > 0));
    const spawn = b.world.wife;
    assert.ok(await T.until(() => Math.hypot(b.hunters[0].x - spawn.x, b.hunters[0].z - spawn.z) > 1.5, 8000), 'she sets off');
    const round = b.roundId;
    const before = b.hunters.map((h) => [h.k, h.x, h.z]);
    a.dispose();
    T.pages.delete('a');
    const room2 = T.hub.reload('a');
    const a2 = createSession({ room: room2, createMatch, createHost, t, introSeconds: 0.2, unlocked: () => 12 });
    a2.input = {};
    T.pages.set('a', a2);
    assert.ok(await T.until(() => b.room.isHost && b.match.isHost));
    await T.frames(2);
    const w = b.hunters[0];
    assert.ok(Math.hypot(w.x - before[0][1], w.z - before[0][2]) < 1.5, 'she carries on from where she was, not from the door');
    const moved = () => b.hunters.some((h, i) => Math.hypot(h.x - before[i][1], h.z - before[i][2]) > 0.3);
    assert.ok(await T.until(moved, 6000), 'the hunters keep moving on the new host');
    assert.equal(b.phase, 'round');
    assert.equal(b.roundId, round, 'the same night');
    assert.ok(await T.until(() => a2.phase === 'round' && a2.data && a2.room.isParticipant('a')), 'the reloaded page is back in');
  } finally {
    T.close();
  }
});

test('a carrier who leaves drops the cheese after a few seconds', async () => {
  const T = table();
  try {
    const a = T.add('a');
    const b = T.add('b');
    await T.frames(2);
    b.ready(true);
    await T.frames(2);
    a.start();
    assert.ok(await T.until(() => a.phase === 'round' && b.data));
    const it = b.world.items[0];
    b.me.x = it.x - 0.3;
    b.me.z = it.z;
    b.me.st = 'play';
    assert.ok(await T.until(() => a.data?.it[0].by === 'b'));
    T.hub.drop('b');
    b.dispose();
    T.pages.delete('b');
    assert.ok(await T.until(() => a.data.it[0].by === '', 6000), 'dropped');
    assert.equal(a.phase, 'round');
  } finally {
    T.close();
  }
});

test('alone: the quick start goes straight into the night, pause holds it, and a friend arriving lifts the pause', async () => {
  const T = table();
  try {
    const a = T.add('a');
    await T.frames(2);
    assert.equal(a.quickStart(1), true);
    assert.ok(await T.until(() => a.phase === 'round' && a.data));
    assert.equal(a.data.lv, 1);
    assert.equal(a.setPaused(true), true);
    await T.frames(3);
    assert.equal(a.paused, true);
    const b = T.add('b');
    assert.ok(await T.until(() => !a.paused), 'not stuck paused while a friend waits');
    assert.ok(await T.until(() => b.phase === 'round'));
    assert.equal(b.me.st, 'watch');
    b.joinIn();
    assert.ok(await T.until(() => b.room.isParticipant('b')), 'the friend is admitted at the hole');
    assert.equal(a.quickStart(1), false, 'no quick start with company');
  } finally {
    T.close();
  }
});

test('garbage from a page is ignored', async () => {
  const T = table();
  try {
    const a = T.add('a');
    const b = T.add('b');
    await T.frames(2);
    b.ready(true);
    await T.frames(2);
    a.start();
    assert.ok(await T.until(() => a.phase === 'round' && b.data));
    const rings = a.rings.length;
    const junk = [null, 7, 'squeak', [], { k: 's', x: NaN, z: 1 }, { k: 's', x: 1e9, z: 2 }, { k: 'n', n: 'explode', x: 2, z: 2 }, { k: 'n', n: 'creak', x: -4, z: 2 }, { k: 's', x: {}, z: [] }];
    for (const m of junk) b.room.send(m);
    for (let i = 0; i < 40; i++) b.room.send({ k: 's', x: 3, z: 3, b: 1 });
    b.room.setPresence({ x: NaN, z: 'far', st: 'boss', g: 99, a: Infinity });
    await T.frames(10);
    assert.ok(a.rings.length - rings <= 8, `rate limited (${a.rings.length - rings} new rings)`);
    for (const r of a.rings) assert.ok(Number.isFinite(r.x) && Number.isFinite(r.z));
    for (const m of a.mice) assert.ok(Number.isFinite(m.x) && Number.isFinite(m.z), JSON.stringify(m));
    assert.equal(a.phase, 'round');
  } finally {
    T.close();
  }
});

test('crumbs: one mouth per crumb, gone on both pages, counted in the shared record', async () => {
  const T = table();
  try {
    const a = T.add('a');
    const b = T.add('b');
    await T.frames(3);
    a.setPick(2);
    b.ready(true);
    await T.frames(2);
    a.start();
    assert.ok(await T.until(() => a.phase === 'round' && b.data && a.data));
    // Walk up to it (the host checks the page's last said position is near).
    const [cx, cz] = b.world.crumbs[0];
    const dir = b.world.crumbs[1][0] > cx ? -1 : 1;
    b.me.x = cx + dir * 0.9;
    b.me.z = cz;
    b.me.st = 'play';
    await T.frames(4);
    b.me.x = cx;
    assert.ok(await T.until(() => a.data?.cr[0] === 1 && b.data?.cr[0] === 1), 'the crumb is gone for everyone');
    assert.equal(a.data.mice.b.cr, 1);
    assert.equal(a.data.mice.b.pt, 10);
    assert.equal(a.result().score.lines.find((l) => l.id === 'crumbs').n, 1);
  } finally {
    T.close();
  }
});

test('the Daily Raid: the host picks today and every page plays the same remix', async () => {
  const T = table();
  try {
    const a = T.add('a');
    const b = T.add('b');
    await T.frames(3);
    const day = 20261101;
    assert.equal(a.setPick(0, day), true);
    await T.frames(2);
    assert.equal(b.pickDay(), day);
    b.ready(true);
    await T.frames(2);
    a.start();
    assert.ok(await T.until(() => a.phase === 'round' && a.data && b.data));
    assert.equal(b.data.dy, day);
    assert.equal(b.world.night.daily, day);
    assert.deepEqual(a.world.crumbs, b.world.crumbs);
    assert.equal(a.result().day, day);
  } finally {
    T.close();
  }
});
