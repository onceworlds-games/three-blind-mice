// One page's side of a night with friends: the room, the match (one night per match), the host's hunters and the night
// record, this page's own mouse, everyone's rings, and what the screens draw. No DOM, three.js or window: the tests drive it
// over a room kept in memory, and the game over an Onceworlds room.

import { buildWorld } from './world.js';
import { NIGHT_COUNT } from './levels.js';
import { stepMouse, stepNoise, inHole, speedFor, wheelPush, wheelSlot, MOUSE, holeMouth, spawnPoint } from './mouse.js';
import { createNight, addMouse, grab, drop, home, hit, snap, carrying, endCheck, restCheck, validNight, AWAY_DROP_SECONDS } from './night.js';
import { createHunters, tickHunters, strikeHits, packHunters, unpackHunters } from './hunters.js';
import { RINGS, masked, maskingBetween } from './rings.js';
import { createRng, hashSeed } from './rng.js';

export const STEP = 1 / 60;
const HUNT_STEP = 1 / 30;
const HUNT_EVERY = 0.1;
const DRAW_DELAY = 0.12;
const RING_KEEP = 9;
const NOISES = ['creak', 'crumbs', 'pan', 'rumble', 'snap'];
const STATES = ['play', 'hole', 'out', 'watch', 'join', 'lobby'];

const worlds = new Map();
export function worldFor(n) {
  const id = Math.max(1, Math.min(NIGHT_COUNT, Math.floor(n) || 1));
  if (!worlds.has(id)) worlds.set(id, buildWorld(id));
  return worlds.get(id);
}

const finite = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const r2 = (v) => Math.round(v * 100) / 100;
const angLerp = (a, b, u) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * u;

// A ring as every page keeps it. tint: 0 cream, 1-3 the seats, 4 moon, 5 lantern. pattern: 0 solid, 1 dashed, 2 dotted, 3 muffled.
export function makeRing(kind, x, z, t, { src = '', seat = -1, night = null, t0 = 0, strength } = {}) {
  const def = RINGS[kind] ?? RINGS.small;
  const muffled = def.heard && night ? masked(night, t - t0) : false;
  let tint = 0;
  let pattern = 0;
  if (seat >= 0) {
    tint = 1 + (seat % 3);
    pattern = seat % 3;
  }
  if (kind === 'chime' || kind === 'snore') {
    tint = 4;
    pattern = 3;
  } else if (kind === 'step' || kind === 'thud' || kind === 'purr') tint = 5;
  else if (kind === 'midnight') tint = 0;
  if (muffled) pattern = 3;
  const s = strength ?? (kind === 'step' ? 0.45 : kind === 'purr' ? 0.5 : kind === 'bump' ? 0.5 : kind === 'midnight' ? 1.1 : 1);
  return { kind, x, z, t, src, seat, muffled, tint, pattern, strength: s };
}

// Presence: what each page says about its own mouse, read back with care.
export function readPresence(p, world) {
  if (!p || typeof p !== 'object') return null;
  const st = STATES.includes(p.st) ? p.st : null;
  if (!st) return null;
  const out = { st, g: Number.isInteger(p.g) && p.g >= 0 && p.g < 8 ? p.g : 0, tl: p.tl === 0 ? 0 : 1, c: Number.isInteger(p.c) && p.c >= -1 && p.c < 12 ? p.c : -1 };
  if (world && finite(p.x, -1, world.W + 1) && finite(p.z, -1, world.D + 1)) {
    out.x = p.x;
    out.z = p.z;
    out.a = finite(p.a, -100, 100) ? p.a : 0;
    out.vx = finite(p.vx, -10, 10) ? p.vx : 0;
    out.vz = finite(p.vz, -10, 10) ? p.vz : 0;
  }
  if (Array.isArray(p.in) && finite(p.in[0], -1, 1) && finite(p.in[1], -1, 1)) out.in = [p.in[0], p.in[1]];
  if (world && finite(p.wx, -1, world.W + 1) && finite(p.wz, -1, world.D + 1)) {
    out.wx = p.wx;
    out.wz = p.wz;
    out.wa = finite(p.wa, -100, 100) ? p.wa : 0;
  }
  return out;
}

export function createSession({ room, createMatch, createHost, t, introSeconds = 2.5, unlocked = () => 1, glasses = () => 0, firstPick = 1 }) {
  const host = createHost(room);
  const s = {
    room,
    host,
    fx: [],
    world: worldFor(1),
    data: null,
    rings: [],
    hunters: [],
    mice: [],
    items: [],
    now: 0,
    nightT: 0,
    roundId: '',
    me: { id: room.me.id, x: 0, z: 0, a: 0, vx: 0, vz: 0, noiseT: 0, st: 'lobby', stun: 0, held: false, holdT: 0, charge: 0, smallReady: 0, bigReady: 0, dropAt: -9, pend: 0, joined: false, body: null, rumble: 0, tailGone: false },
    seat: -1,
    focus: null,
    paused: false,
    pausedByMe: false,
    autoStart: false,
    started: false,
  };
  const fx = (type, o = {}) => s.fx.push({ type, ...o });
  const now = () => room.matchNow() / 1000;

  // ------------------------------------------------------------ host state
  const huntState = host.state('hunt', { initial: null });
  const pickState = host.state('pick', { initial: { n: firstPick } });
  let H = null;
  let hostT = 0;
  let huntSent = -9;
  let hostRng = createRng(1);
  const awaySince = new Map();
  const lastSeen = new Map();

  // ------------------------------------------------------------ the match
  const match = createMatch(room, {
    rounds: 1,
    introSeconds,
    roundEndSeconds: 2,
    resultsSeconds: 0,
    startRound(m) {
      const n = s.pick();
      const world = worldFor(n);
      const ids = m.seats.map((x) => x.id);
      const tNow = now();
      const d = createNight(world, ids, tNow);
      H = createHunters(world, { script: world.night.script });
      hostT = tNow;
      huntSent = -9;
      hostRng = createRng(hashSeed(`${room.match.id}:${n}`));
      return d;
    },
    onTick(m) {
      const d = readData(m.data);
      if (!d) return;
      const tNow = now();
      const end = endCheck(d, tNow);
      const present = m.seats.filter((x) => !x.away && !x.left).map((x) => x.id);
      const inHoleIds = present.filter((id) => {
        const st = id === s.me.id ? s.me.st : readPresence(room.players.get(id)?.presence, s.world)?.st;
        return st === 'hole' || st === 'out';
      });
      const restBefore = d.rest;
      const rested = restCheck(d, tNow, present, inHoleIds);
      if (end || rested) {
        d.end = end || 'rest';
        d.endAt = tNow;
        m.setData(d);
        m.endRound();
      } else if (d.rest !== restBefore) m.setData(d);
    },
    resume() {
      H = null;
    },
  });
  s.match = match;

  let lastRaw = null;
  let lastData = null;
  function readData(raw) {
    if (raw === lastRaw) return lastData ? structuredClone(lastData) : null;
    const lv = raw && typeof raw === 'object' ? raw.lv : 0;
    if (!finite(lv, 1, NIGHT_COUNT)) return null;
    const d = validNight(raw, worldFor(lv));
    lastRaw = raw;
    lastData = d;
    return d ? structuredClone(d) : null;
  }

  // The host changes the record: a fresh copy, the change, then the write.
  function edit(fn) {
    if (!match.isHost || match.phase !== 'round') return false;
    const d = readData(match.data);
    if (!d) return false;
    const world = worldFor(d.lv);
    // A wheel on the move is where its lead says.
    d.it.forEach((it) => {
      if (it.k !== 'W' || !it.by) return;
      const p = it.by === s.me.id && s.me.body ? s.me.body : readPresence(room.players.get(it.by)?.presence, world);
      const wx = p?.wx ?? p?.x;
      const wz = p?.wz ?? p?.z;
      if (finite(wx, 0, world.W) && finite(wz, 0, world.D)) {
        it.x = wx;
        it.z = wz;
      }
    });
    if (!fn(d, world, now())) return false;
    match.setData(d);
    return true;
  }

  const posOf = (id) => {
    if (id === s.me.id) return s.me;
    return readPresence(room.players.get(id)?.presence, s.world);
  };
  const near = (id, x, z, slack = 3) => {
    const p = posOf(id);
    return !p || p.x === undefined || Math.hypot(p.x - x, p.z - z) <= slack;
  };
  const playing = (id) => match.phase === 'round' && room.isParticipant(id);
  const pos = { x: t.number(-1, 99), z: t.number(-1, 99) };

  const rpcGrab = host.rpc('grab', {
    args: { i: t.int(0, 11), ...pos },
    rate: 8,
    validate: (from, a) => (playing(from.id) && near(from.id, a.x, a.z)) || 'not now',
    run: (from, a) => edit((d, w, tNow) => grab(d, w, a.i, from.id, a.x, a.z, tNow) === ''),
  });
  const rpcDrop = host.rpc('drop', {
    args: { ...pos },
    rate: 8,
    validate: (from) => playing(from.id) || 'not now',
    run: (from, a) => edit((d, w) => drop(d, w, from.id, a.x, a.z) >= 0),
  });
  const rpcHome = host.rpc('home', {
    args: { i: t.int(0, 11), ...pos },
    rate: 8,
    validate: (from, a) => (playing(from.id) && near(from.id, a.x, a.z)) || 'not now',
    run: (from, a) => edit((d, w) => home(d, w, a.i, from.id, a.x, a.z) === ''),
  });
  const rpcHit = host.rpc('hit', {
    args: { ...pos },
    rate: 4,
    validate: (from) => playing(from.id) || 'not now',
    run: (from, a) => edit((d, w, tNow) => hit(d, w, from.id, tNow, a.x, a.z) !== ''),
  });
  const rpcSnap = host.rpc('snap', {
    args: { i: t.int(0, 31), ...pos },
    rate: 4,
    validate: (from, a) => {
      if (!playing(from.id)) return 'not now';
      const tr = s.world.traps[a.i];
      return (tr && Math.hypot(tr.x - a.x, tr.z - a.z) < 1.2) || 'too far';
    },
    run: (from, a) =>
      edit((d, w, tNow) => {
        if (!snap(d, a.i)) return false;
        hit(d, w, from.id, tNow, a.x, a.z);
        return true;
      }),
  });

  // ------------------------------------------------------------ the lobby's pick
  s.pick = () => {
    const v = pickState.get();
    const n = v && Number.isInteger(v.n) ? v.n : 1;
    return Math.max(1, Math.min(NIGHT_COUNT, n));
  };
  s.setPick = (n) => {
    if (!room.isHost || room.match.phase !== 'lobby') return false;
    const want = Math.max(1, Math.min(unlocked(), NIGHT_COUNT, Math.floor(n) || 1));
    if (want === s.pick()) return true;
    pickState.set({ n: want });
    room.clearReady?.();
    return true;
  };
  s.ready = (on) => room.setReady(on);
  s.start = () => {
    if (room.canStart) room.startMatch({ countdown: 0 });
  };
  // The title's one button, alone with nothing played yet: straight into Night 1.
  s.quickStart = (n = 1) => {
    if (room.match.phase !== 'lobby' || !room.isHost || room.online.length > 1) return false;
    pickState.set({ n: Math.max(1, Math.min(NIGHT_COUNT, n)) });
    room.startMatch({ countdown: 0 });
    return true;
  };
  // Results: the host picks what's next. Alone it also starts at once.
  s.next = (n) => {
    if (!room.isHost) return;
    const want = Math.max(1, Math.min(NIGHT_COUNT, n));
    pickState.set({ n: Math.min(want, Math.max(unlocked(), 1)) });
    s.autoStart = room.online.length <= 1;
    room.endMatch();
  };
  s.toMap = () => {
    if (!room.isHost) return;
    s.autoStart = false;
    room.endMatch();
  };
  s.joinIn = () => {
    if (room.spectating && match.phase === 'round') s.me.st = 'join';
  };
  s.setPaused = (on) => {
    if (on && (!room.isHost || room.online.length > 1 || room.match.phase !== 'playing')) return false;
    if (!on && !s.pausedByMe) return false;
    s.pausedByMe = !!on;
    room.pauseMatch?.(!!on);
    return true;
  };
  s.alone = () => room.online.length <= 1;

  // ------------------------------------------------------------ messages: squeaks and noises
  const bucket = new Map();
  room.on('message', (msg, from, at, matchTime) => {
    if (!msg || typeof msg !== 'object' || (msg.k !== 's' && msg.k !== 'n')) return;
    if (!from || !room.isParticipant(from.id) || match.phase !== 'round') return;
    const b = bucket.get(from.id) ?? { n: 0, t: 0 };
    const tNow = now();
    if (tNow - b.t > 1) {
      b.n = 0;
      b.t = tNow;
    }
    if (++b.n > 8) return;
    bucket.set(from.id, b);
    if (!finite(msg.x, 0, s.world.W) || !finite(msg.z, 0, s.world.D)) return;
    let kind;
    if (msg.k === 's') kind = msg.b ? 'big' : 'small';
    else if (NOISES.includes(msg.n)) kind = msg.n;
    else return;
    const seat = seatOf(from.id);
    const tt = Math.max(finite(matchTime, 0, 1e9) ? matchTime / 1000 : tNow, tNow - 0.05, match.isHost ? hostT : 0);
    addRing(kind, msg.x, msg.z, tt, from.id, seat);
    if (msg.k === 's') fx('squeak', { big: !!msg.b, seat, x: msg.x, z: msg.z, mine: false });
    else fx('noise', { kind, x: msg.x, z: msg.z, mine: false });
  });

  function seatOf(id) {
    const i = (room.match.participants ?? []).indexOf(id);
    return i < 0 ? -1 : i % 3;
  }

  function addRing(kind, x, z, tt, src = '', seat = -1, strength) {
    const r = makeRing(kind, x, z, tt, { src, seat, night: s.world.night, t0: s.data?.t0 ?? 0, strength });
    s.rings.push(r);
    if (s.rings.length > 90) s.rings.splice(0, s.rings.length - 90);
    return r;
  }

  // ------------------------------------------------------------ the round's life on this page
  const judged = new Set();
  const snapped = new Set();
  let prevNightT = 0;
  let prevModes = new Map();
  let snaps = [];
  let stepAcc = 0;
  let stepGap = new Map();
  let purrAt = new Map();
  let wasParticipant = false;
  let wasPhase = '';

  function beginRound(world, d) {
    s.world = world;
    s.rings = s.rings.filter((r) => r.kind === 'midnight');
    judged.clear();
    snapped.clear();
    snaps = [];
    prevModes = new Map();
    stepGap = new Map();
    purrAt = new Map();
    prevNightT = 0;
    s.me.body = null;
    s.me.stun = 0;
    s.me.held = false;
    s.me.charge = 0;
    s.me.tailGone = false;
    s.me.dropAt = -9;
    placeAtHole(world);
    // Back from a reload: keep the spot this page last said it was at.
    const p = readPresence(room.me?.presence, world);
    if (p && p.x !== undefined && (p.st === 'play' || p.st === 'hole') && room.isParticipant(s.me.id)) {
      s.me.x = p.x;
      s.me.z = p.z;
      s.me.a = p.a;
      s.me.st = p.st;
    }
    if (d?.mice[s.me.id] && !d.mice[s.me.id].tail) s.me.tailGone = true;
    fx('roundStart', { night: world.night.id });
  }

  function placeAtHole(world) {
    const seat = Math.max(0, seatOf(s.me.id));
    [s.me.x, s.me.z, s.me.a] = spawnPoint(world, seat);
    s.me.vx = 0;
    s.me.vz = 0;
    s.me.st = room.isParticipant(s.me.id) ? 'hole' : 'watch';
  }

  function syncData() {
    const d = readData(match.data);
    const before = s.data;
    if (d && before && d.lv === before.lv) {
      d.it.forEach((it, i) => {
        const b = before.it[i];
        if (!b) return;
        if (it.home && !b.home) fx('home', { i, k: it.k, mine: b.by === s.me.id || b.h.includes(s.me.id) });
        else if (it.by && !b.by) fx('grab', { i, k: it.k, mine: it.by === s.me.id, seat: seatOf(it.by) });
        else if (!it.by && b.by && !it.home) fx('drop', { i, k: it.k, mine: b.by === s.me.id });
      });
      for (const [id, m] of Object.entries(d.mice)) {
        const b = before.mice[id];
        if (!b) continue;
        if (m.hits > b.hits) fx('hit', { id, what: m.out > s.now ? 'out' : 'tail', mine: id === s.me.id, seat: seatOf(id) });
      }
      d.tr.forEach((v, i) => {
        if (v && !before.tr[i]) fx('snap', { i, mine: false });
      });
    }
    s.data = d;
  }

  // ------------------------------------------------------------ the frame
  s.update = (dt, input = {}) => {
    dt = Math.max(0, Math.min(0.1, dt || 0));
    const phase = match.phase;
    s.phase = phase;
    s.paused = match.paused;
    s.now = now();
    if (phase === 'lobby') {
      s.world = worldFor(s.pick());
      s.data = null;
      s.roundId = '';
      s.me.st = 'lobby';
      s.hunters = [];
      if (s.autoStart && room.isHost && room.canStart) {
        s.autoStart = false;
        room.startMatch({ countdown: 0 });
      }
      s.pausedByMe = false;
    }
    if (phase !== 'lobby' && phase !== 'countdown') {
      syncData();
      const d = s.data;
      const rid = match.roundId;
      if (d && rid && rid !== s.roundId) {
        s.roundId = rid;
        beginRound(worldFor(d.lv), d);
        wasParticipant = room.isParticipant(s.me.id);
      } else if (!d && phase === 'intro' && rid !== s.roundId && wasPhase !== 'intro') {
        // The intro: the night is picked but not begun. Show its room and strike midnight.
        s.world = worldFor(s.pick());
        s.rings = [];
        placeAtHole(s.world);
        const [hx, hz] = holeMouth(s.world);
        addRing('midnight', hx, hz, s.now);
        fx('midnight', { night: s.world.night.id });
      }
      if (d) s.world = worldFor(d.lv);
    }
    // Admitted while watching: out of the hole with a tail.
    const part = room.isParticipant(s.me.id);
    if (part && !wasParticipant && s.data) placeAtHole(s.world);
    wasParticipant = part;
    s.seat = seatOf(s.me.id);
    wasPhase = phase;

    // The host lifts a pause of its own once friends are here.
    if (s.pausedByMe && room.online.length > 1) s.setPaused(false);

    if (s.data) {
      s.nightT = s.now - s.data.t0;
      if (phase === 'round' && !s.paused) {
        // Sounds that hide yours: the clock's chime, the farmer's snore.
        for (const mk of maskingBetween(s.world.night, prevNightT, s.nightT)) {
          const src = mk.kind === 'chime' ? s.world.clock ?? { x: s.world.W / 2, z: 1 } : s.world.snore ?? { x: s.world.W / 2, z: 2 };
          addRing(mk.kind, src.x, src.z, s.data.t0 + mk.t);
          fx(mk.kind, {});
        }
        prevNightT = s.nightT;
        if (match.isHost) hostStep(s.now);
        stepAcc += dt;
        let n = 0;
        while (stepAcc >= STEP && n++ < 8) {
          stepAcc -= STEP;
          stepMe(STEP, input);
        }
        if (stepAcc > STEP) stepAcc = 0;
        judge();
      }
    }
    if (!room.isParticipant(s.me.id) && s.me.st !== 'join' && phase !== 'lobby') s.me.st = 'watch';
    if (phase !== 'round' && s.me.st === 'join') s.me.st = 'watch';
    input.squeakEdge = false;
    publish();
    drawHunters();
    drawMice();
    drawItems();
    s.rings = s.rings.filter((r) => r.t > s.now - RING_KEEP || r.kind === 'midnight');
  };

  // ------------------------------------------------------------ my mouse
  function stepMe(dt, input) {
    const d = s.data;
    const me = s.me;
    const world = s.world;
    const tNow = s.now;
    if (!room.isParticipant(me.id)) return;
    const rec = d.mice[me.id];
    if (!rec) return;
    if (rec.out > tNow) {
      if (me.st !== 'out') {
        me.st = 'out';
        [me.x, me.z] = holeMouth(world);
        me.held = false;
        me.charge = 0;
        me.body = null;
      }
      return;
    }
    if (me.st === 'out') {
      [me.x, me.z, me.a] = spawnPoint(world, Math.max(0, s.seat));
      me.vx = 0;
      me.vz = 0;
      me.st = 'hole';
    }
    // The squeak: tap for a small one, hold until full for a big one.
    const down = !!input.squeak;
    if (down && !me.held) {
      me.held = true;
      me.holdT = 0;
    }
    if (me.held) {
      me.holdT += dt;
      me.charge = me.holdT > MOUSE.bigHold ? Math.min(1, (me.holdT - MOUSE.bigHold) / (MOUSE.bigFull - MOUSE.bigHold)) : 0;
      if (!down) {
        const big = me.charge >= 1 && tNow >= me.bigReady;
        if (big || tNow >= me.smallReady) squeak(big);
        me.held = false;
        me.charge = 0;
      }
    }
    if (input.squeakNow) {
      const big = input.squeakNow === 'big' && tNow >= me.bigReady;
      if (big || tNow >= me.smallReady) squeak(big);
      input.squeakNow = null;
    }
    const ci = carrying(d, me.id);
    const it = ci >= 0 ? d.it[ci] : null;
    if (input.drop && it) {
      const x = it.k === 'W' && me.body ? me.body.x : me.x;
      const z = it.k === 'W' && me.body ? me.body.z : me.z;
      rpcDrop({ x: r2(x), z: r2(z) });
      me.dropAt = tNow;
      me.body = null;
      input.drop = false;
      return;
    }
    input.drop = false;
    const stunned = tNow < me.stun;
    let ix = stunned ? 0 : input.ix ?? 0;
    let iz = stunned ? 0 : input.iz ?? 0;
    me.in = [r2(ix), r2(iz)];
    if (it && it.k === 'W') {
      if (it.by === me.id) {
        if (!me.body) me.body = { x: it.x, z: it.z, vx: 0, vz: 0, a: me.a };
        const inputs = [[ix, iz]];
        for (const id of it.h) {
          const p = readPresence(room.players.get(id)?.presence, world);
          if (p?.in) inputs.push(p.in);
        }
        const push = wheelPush(inputs);
        const body = me.body;
        stepMouse(world, body, push.x, push.z, dt, speedFor('W', push.n), MOUSE.wheelR, 'wheel');
        [me.x, me.z, me.a] = wheelSlot(body.x, body.z, body.a, 0);
        me.vx = body.vx;
        me.vz = body.vz;
        me.rumble -= dt;
        if (Math.hypot(body.vx, body.vz) > 0.4 && me.rumble <= 0) {
          me.rumble = 0.5;
          noise('rumble', body.x, body.z);
        }
        if (inHole(world, body.x, body.z) || Math.hypot(body.x - holeMouth(world)[0], body.z - holeMouth(world)[1]) < MOUSE.homeR + MOUSE.wheelR + 0.5) tryHome(ci, body.x, body.z);
      } else {
        const lead = readPresence(room.players.get(it.by)?.presence, world);
        if (lead?.wx !== undefined) {
          const slot = 1 + Math.max(0, it.h.indexOf(me.id));
          [me.x, me.z, me.a] = wheelSlot(lead.wx, lead.wz, lead.wa, slot);
        }
        me.vx = 0;
        me.vz = 0;
      }
    } else {
      me.body = null;
      if (stepMouse(world, me, ix, iz, dt, speedFor(it?.k))) fx('bump', { x: me.x, z: me.z });
      const kind = stepNoise(world, me, dt);
      if (kind) noise(kind, me.x, me.z);
      if (it) tryHome(ci, me.x, me.z);
    }
    me.st = inHole(world, me.x, me.z) ? 'hole' : 'play';
    // Traps: a snap and a bonk.
    world.traps.forEach((tr, i) => {
      if (d.tr[i] || snapped.has(i) || Math.hypot(tr.x - me.x, tr.z - me.z) > 0.42) return;
      snapped.add(i);
      addRing('snap', tr.x, tr.z, tNow, me.id, s.seat);
      s.room.send({ k: 'n', x: r2(tr.x), z: r2(tr.z), n: 'snap' });
      rpcSnap({ i, x: r2(me.x), z: r2(me.z) });
      ouch(tNow, 'trap');
      fx('snap', { i, mine: true });
    });
    // Pick up what we touch.
    if (!it && tNow - me.dropAt > 1.5 && tNow > me.pend) {
      for (let i = 0; i < d.it.length; i++) {
        const o = d.it[i];
        if (o.home) continue;
        if (o.k === 'w') {
          if (o.by || Math.hypot(o.x - me.x, o.z - me.z) > MOUSE.grabR) continue;
        } else {
          if (o.by === me.id || o.h.length >= 2) continue;
          const lead = o.by ? readPresence(room.players.get(o.by)?.presence, world) : null;
          const wx = lead?.wx ?? o.x;
          const wz = lead?.wz ?? o.z;
          if (Math.hypot(wx - me.x, wz - me.z) > MOUSE.wheelR + MOUSE.r + 0.3) continue;
        }
        me.pend = tNow + 0.6;
        rpcGrab({ i, x: r2(me.x), z: r2(me.z) });
        break;
      }
    }
  }

  function tryHome(i, x, z) {
    if (s.now <= s.me.pend) return;
    const [mx, mz] = holeMouth(s.world);
    const it = s.data.it[i];
    const reach = it.k === 'W' ? MOUSE.homeR + MOUSE.wheelR + 0.5 : MOUSE.homeR + 0.3;
    if (Math.hypot(x - mx, z - mz) > reach) return;
    s.me.pend = s.now + 0.5;
    rpcHome({ i, x: r2(x), z: r2(z) });
  }

  function squeak(big) {
    const me = s.me;
    const tNow = s.now;
    if (big) me.bigReady = tNow + MOUSE.bigCool;
    me.smallReady = tNow + MOUSE.smallCool;
    addRing(big ? 'big' : 'small', me.x, me.z, tNow, me.id, s.seat);
    room.send({ k: 's', x: r2(me.x), z: r2(me.z), b: big ? 1 : 0 });
    fx('squeak', { big, seat: s.seat, x: me.x, z: me.z, mine: true });
  }

  function noise(kind, x, z) {
    addRing(kind, x, z, s.now, s.me.id, s.seat);
    room.send({ k: 'n', x: r2(x), z: r2(z), n: kind });
    fx('noise', { kind, x, z, mine: true });
  }

  // This page judges its own mouse: hit only if the strike lands where it is.
  function ouch(tNow, by) {
    const rec = s.data?.mice[s.me.id];
    if (!rec || tNow < rec.safe || rec.out > tNow) return false;
    s.me.stun = tNow + MOUSE.stun;
    s.me.held = false;
    s.me.charge = 0;
    s.me.body = null;
    const what = rec.tail ? 'tail' : 'out';
    if (what === 'tail') s.me.tailGone = true;
    rec.safe = tNow + MOUSE.safe;
    if (by !== 'trap') rpcHit({ x: r2(s.me.x), z: r2(s.me.z) });
    fx('ouch', { what, by });
    return true;
  }

  function judge() {
    const list = match.isHost && H ? H : latestHunters();
    for (const h of list) {
      const ch = h.ch;
      if (!ch) continue;
      const key = `${h.k}:${ch.seq}`;
      if (judged.has(key) || s.now < ch.at) continue;
      judged.add(key);
      if (s.now - ch.at > 1.5) continue;
      addRing('thud', ch.x, ch.z, ch.at);
      fx('chop', { k: h.k, x: ch.x, z: ch.z });
      if (s.me.st !== 'play' || !room.isParticipant(s.me.id)) continue;
      if (strikeHits(s.world, h, ch, s.me.x, s.me.z)) ouch(s.now, h.k);
      else if (Math.hypot(s.me.x - ch.x, s.me.z - ch.z) < 1.4) fx('closeShave', { k: h.k });
    }
  }

  // ------------------------------------------------------------ the host's hunters
  function hostStep(tNow) {
    const d = s.data;
    const world = s.world;
    if (!H) {
      const snap0 = huntState.get();
      const got = snap0 && snap0.r === s.roundId ? unpackHunters(snap0.h, world) : null;
      H = got ?? createHunters(world, { script: world.night.script });
      hostT = tNow;
    }
    // Every mouse in the match has a record; carriers who've been gone a while drop what they hold.
    const ids = (room.match.participants ?? []).slice(0, 3);
    let missing = ids.some((id) => !d.mice[id]);
    const solo = ids.length <= 1 ? 1 : 0;
    if (missing || solo !== d.solo)
      edit((dd) => {
        for (const id of ids) addMouse(dd, id);
        dd.solo = solo;
        return true;
      });
    for (const id of ids) {
      const p = room.players.get(id);
      if (!p || p.connected === false) {
        if (!awaySince.has(id)) awaySince.set(id, tNow);
        if (tNow - awaySince.get(id) >= AWAY_DROP_SECONDS && carrying(d, id) >= 0) {
          const last = lastSeen.get(id) ?? posOf(id);
          edit((dd, w) => drop(dd, w, id, last?.x ?? NaN, last?.z ?? NaN) >= 0);
        }
      } else awaySince.delete(id);
    }
    // Watchers who asked to join come out of the hole.
    const joiners = [...room.players.values()].filter((p) => !room.isParticipant(p.id) && p.connected !== false && readPresence(p.presence, null)?.st === 'join').map((p) => p.id);
    if (joiners.length && (room.match.participants ?? []).length < 3) room.admit(joiners.slice(0, 3 - (room.match.participants ?? []).length));

    const mice = ids.map((id) => {
      const p = posOf(id);
      const away = id !== s.me.id && room.players.get(id)?.connected === false;
      if (p?.x !== undefined) lastSeen.set(id, { x: p.x, z: p.z });
      return { id, x: p?.x ?? -50, z: p?.z ?? -50, vx: p?.vx ?? 0, vz: p?.vz ?? 0, hidden: !p || p.x === undefined || p.st !== 'play' || away || (d.mice[id]?.out ?? 0) > tNow };
    });
    let steps = 0;
    while (hostT + HUNT_STEP <= tNow && steps++ < 12) {
      const prev = hostT;
      hostT += HUNT_STEP;
      tickHunters(H, { world, mice, rings: s.rings, prev, solo: !!d.solo, entered: !!d.g, rng: hostRng }, hostT, HUNT_STEP);
    }
    if (tNow - hostT > 0.5) hostT = tNow;
    if (tNow - huntSent >= HUNT_EVERY) {
      huntSent = tNow;
      huntState.set({ r: s.roundId, t: r2(hostT), h: packHunters(H) });
    }
  }

  function latestHunters() {
    const v = huntState.get();
    if (!v || v.r !== s.roundId) return [];
    const last = snaps[snaps.length - 1];
    if (!last || last.raw !== v) {
      const h = unpackHunters(v.h, s.world);
      if (h && finite(v.t, 0, 1e7)) {
        snaps.push({ raw: v, t: v.t, h });
        if (snaps.length > 6) snaps.shift();
      }
    }
    return snaps.length ? snaps[snaps.length - 1].h : [];
  }

  // What the screen shows of the hunters: the host's own, or the snapshots 120 ms behind, between two.
  function drawHunters() {
    let list;
    if (!s.data) list = [];
    else if (match.isHost && H) list = H;
    else {
      latestHunters();
      const rt = s.now - DRAW_DELAY;
      let a = null;
      let b = null;
      for (let i = snaps.length - 1; i >= 0; i--) {
        if (snaps[i].t <= rt) {
          a = snaps[i];
          b = snaps[i + 1] ?? null;
          break;
        }
      }
      if (!a) list = snaps[0]?.h ?? [];
      else if (!b) list = a.h;
      else {
        const u = Math.max(0, Math.min(1, (rt - a.t) / Math.max(0.001, b.t - a.t)));
        list = a.h.map((h, i) => {
          const o = b.h[i];
          if (!o || o.k !== h.k) return h;
          return { ...(u < 0.5 ? h : o), x: h.x + (o.x - h.x) * u, z: h.z + (o.z - h.z) * u, a: angLerp(h.a, o.a, u) };
        });
      }
    }
    // What they did: heard, spotted, raised the knife, woke.
    for (const h of list) {
      const was = prevModes.get(h.k);
      if (was && was !== h.m) fx('mode', { k: h.k, m: h.m, was });
      prevModes.set(h.k, h.m);
      // Footsteps and purrs are rings too (nothing hears them).
      const last = stepGap.get(h.k) ?? { x: h.x, z: h.z, d: 0, side: 0 };
      last.d += Math.hypot(h.x - last.x, h.z - last.z);
      last.x = h.x;
      last.z = h.z;
      const stride = h.k === 'cat' ? 1.6 : 1.15;
      if (last.d > stride && s.phase === 'round') {
        last.d = 0;
        last.side ^= 1;
        const off = h.k === 'cat' ? 0 : (last.side ? 0.35 : -0.35);
        const sx = h.x + Math.cos(h.a + Math.PI / 2) * off;
        const sz = h.z + Math.sin(h.a + Math.PI / 2) * off;
        if (h.k !== 'cat') addRing('step', sx, sz, s.now);
        fx('step', { k: h.k, x: sx, z: sz });
      }
      stepGap.set(h.k, last);
      if (h.k === 'cat' && (h.m === 'sleep' || h.m === 'rest') && s.phase === 'round') {
        const p = purrAt.get('cat') ?? 0;
        if (s.now - p > 2) {
          purrAt.set('cat', s.now);
          addRing('purr', h.x, h.z, s.now);
          fx('purr', { x: h.x, z: h.z });
        }
      }
    }
    s.hunters = list;
  }

  function drawMice() {
    const out = [];
    const d = s.data;
    const lobby = room.match.phase === 'lobby' || !d;
    const ids = lobby ? [...room.players.keys()].filter((id) => room.players.get(id)?.connected !== false).slice(0, 3) : (room.match.participants ?? []).slice(0, 3);
    if (lobby) {
      // The party waits at the hole.
      s.mice = ids.map((id, seat) => {
        const [x, z, a] = spawnPoint(s.world, seat);
        const p = room.players.get(id);
        return { id, seat, name: p?.name ?? '', me: id === s.me.id, x, z, a, speed: 0, st: 'hole', tail: 1, g: id === s.me.id ? glasses() : readPresence(p?.presence, null)?.g ?? 0, carry: '', lead: false, away: false, stun: 0, charge: 0, out: 0, ready: !!p?.ready || id === room.host };
      });
      s.focus = s.mice[0] ?? null;
      return;
    }
    for (const id of ids) {
      const p = room.players.get(id);
      const mine = id === s.me.id;
      const seat = room.match.phase === 'lobby' ? ids.indexOf(id) : seatOf(id);
      const rec = d?.mice[id];
      const ci = d ? carrying(d, id) : -1;
      let st;
      let x;
      let z;
      let a;
      let vx = 0;
      let vz = 0;
      if (mine) {
        ({ st, x, z, a, vx, vz } = s.me);
      } else {
        const sp = readPresence(room.presenceAt?.(id, { angles: ['a', 'wa'], snap: 3 }) ?? p?.presence, s.world);
        if (!sp || sp.x === undefined) continue;
        ({ st, x, z, a, vx, vz } = sp);
        if (rec && rec.out > s.now) st = 'out';
      }
      out.push({
        id,
        seat,
        name: p?.name ?? '',
        me: mine,
        x,
        z,
        a,
        speed: Math.hypot(vx, vz),
        st,
        tail: rec ? rec.tail : 1,
        g: mine ? glasses() : readPresence(p?.presence, null)?.g ?? 0,
        carry: ci >= 0 ? d.it[ci].k : '',
        lead: ci >= 0 && d.it[ci].by === id,
        away: p?.connected === false,
        stun: mine ? Math.max(0, s.me.stun - s.now) : 0,
        charge: mine ? s.me.charge : 0,
        out: rec ? Math.max(0, rec.out - s.now) : 0,
      });
    }
    s.mice = out;
    const meDrawn = out.find((m) => m.me);
    if (meDrawn && meDrawn.st !== 'watch') s.focus = meDrawn;
    else s.focus = out.find((m) => m.id === room.host) ?? out[0] ?? null;
  }

  function drawItems() {
    const d = s.data;
    if (!d) {
      s.items = s.world.items.map((i) => ({ k: i.k, x: i.x, z: i.z, home: 0, by: '' }));
      return;
    }
    s.items = d.it.map((it) => {
      let x = it.x;
      let z = it.z;
      if (it.by && !it.home) {
        const carrier = s.mice.find((m) => m.id === it.by);
        if (it.k === 'W') {
          if (it.by === s.me.id && s.me.body) ({ x, z } = s.me.body);
          else {
            const lp = readPresence(room.presenceAt?.(it.by, { angles: ['a', 'wa'], snap: 3 }) ?? room.players.get(it.by)?.presence, s.world);
            if (lp?.wx !== undefined) {
              x = lp.wx;
              z = lp.wz;
            }
          }
        } else if (carrier) {
          x = carrier.x + Math.cos(carrier.a) * 0.32;
          z = carrier.z + Math.sin(carrier.a) * 0.32;
        }
      }
      return { k: it.k, x, z, home: it.home, by: it.by, wa: it.k === 'W' && it.by === s.me.id && s.me.body ? s.me.body.a : 0 };
    });
  }

  function publish() {
    const me = s.me;
    const p = { st: me.st, g: glasses() };
    if (s.data && room.isParticipant(me.id)) {
      Object.assign(p, { x: r2(me.x), z: r2(me.z), a: r2(me.a), vx: r2(me.vx), vz: r2(me.vz), tl: me.tailGone ? 0 : 1, c: carrying(s.data, me.id) });
      if (me.in) p.in = me.in;
      if (me.body) Object.assign(p, { wx: r2(me.body.x), wz: r2(me.body.z), wa: r2(me.body.a) });
    }
    room.setPresence?.(p);
  }

  // The night's result for this page: stars and who did what.
  s.result = () => {
    const d = s.data;
    if (!d) return null;
    const mice = Object.values(d.mice);
    const home = d.it.filter((i) => i.home).length;
    return {
      night: d.lv,
      end: d.end,
      time: Math.max(0, (d.endAt || s.now) - d.t0),
      home,
      total: d.it.length,
      stars: { home: home > 0, all: home === d.it.length && d.it.length > 0, tails: home > 0 && mice.length > 0 && mice.every((m) => m.tail === 1) },
      rows: Object.entries(d.mice).map(([id, m]) => ({ id, name: room.players.get(id)?.name ?? match.seats.find((x) => x.id === id)?.name ?? 'Mouse', seat: seatOf(id), home: m.home, tail: m.tail, me: id === s.me.id })),
    };
  };

  s.dispose = () => {
    match.dispose();
    host.dispose();
  };
  return s;
}

// ------------------------------------------------------------ the same picture from a headless sim (title, autoplay, posters)

const simRings = new WeakMap();

export function viewFromSim(sim, { names = [] } = {}) {
  const { data, world } = sim;
  const mice = sim.mice.map((m, n) => {
    const ci = carrying(data, m.id);
    return {
      id: m.id,
      seat: n % 3,
      name: names[n] ?? '',
      me: n === 0,
      x: m.x,
      z: m.z,
      a: m.a,
      speed: Math.hypot(m.vx, m.vz),
      st: m.st,
      tail: data.mice[m.id]?.tail ?? 1,
      g: [0, 2, 4][n % 3],
      carry: ci >= 0 ? data.it[ci].k : '',
      lead: ci >= 0 && data.it[ci].by === m.id,
      away: false,
      stun: Math.max(0, m.stun - sim.now),
      charge: 0,
      out: Math.max(0, (data.mice[m.id]?.out ?? 0) - sim.now),
    };
  });
  const items = data.it.map((it) => {
    let x = it.x;
    let z = it.z;
    if (it.by && !it.home && it.k === 'w') {
      const c = mice.find((m) => m.id === it.by);
      if (c) {
        x = c.x + Math.cos(c.a) * 0.32;
        z = c.z + Math.sin(c.a) * 0.32;
      }
    }
    return { k: it.k, x, z, home: it.home, by: it.by, wa: it._body?.a ?? 0 };
  });
  // One view ring per sim ring, kept, so the view remembers each squeak once.
  const rings = sim.rings.map((r) => {
    let made = simRings.get(r);
    if (!made) {
      const n = sim.mice.findIndex((m) => m.id === r.src);
      made = makeRing(r.kind, r.x, r.z, r.t, { src: r.src, seat: n, night: world.night, t0: 0 });
      simRings.set(r, made);
    }
    return made;
  });
  return { world, data, mice, items, rings, hunters: sim.hunters, now: sim.now, nightT: sim.now, focus: mice[0] };
}
