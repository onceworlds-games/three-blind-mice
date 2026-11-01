// A room kept in this page: the same surface as an Onceworlds room (players, presence, state with host-only keys, messages,
// ready flags, the match's lifecycle and clock, pausing, admitting). It stands in when the game runs outside Onceworlds
// (and for posters and autoplay), and several pages on one hub are the room in the tests.

const clone = (v) => (v === undefined || v === null ? v : JSON.parse(JSON.stringify(v)));

class LocalRoom {
  constructor(hub, id) {
    this.hub = hub;
    this.id = hub.roomId;
    this.kind = 'private';
    this.ranked = false;
    this.invite = null;
    this.teams = 0;
    this.open = true;
    this.kept = false;
    this.owner = null;
    this.handlers = {};
    this.closed = false;
    this.connected = true;
    this.pid = id;
    this.state = clone(hub.state);
    this.private = {};
    this.errors = [];
  }
  get me() {
    return this.hub.players.get(this.pid) ?? { id: this.pid, name: this.pid, presence: null, team: 0 };
  }
  get players() {
    return this.hub.players;
  }
  get host() {
    return this.hub.host;
  }
  get isHost() {
    return this.connected && !this.closed && this.hub.host === this.pid;
  }
  get match() {
    return this.hub.match;
  }
  get running() {
    return this.hub.match.phase === 'playing' && !this.hub.match.paused;
  }
  get participants() {
    return this.hub.match.phase === 'lobby' ? [] : this.hub.match.participants.map((id) => this.hub.players.get(id)).filter(Boolean);
  }
  get spectators() {
    return this.hub.match.phase === 'lobby' ? [] : [...this.hub.players.values()].filter((p) => !this.hub.match.participants.includes(p.id));
  }
  get spectating() {
    return this.hub.match.phase !== 'lobby' && !this.hub.match.participants.includes(this.pid);
  }
  get settings() {
    return {};
  }
  get online() {
    return [...this.hub.players.values()].filter((p) => p.connected !== false);
  }
  get canStart() {
    return this.isHost && this.hub.match.phase === 'lobby' && this.hub.allReady();
  }
  get allReady() {
    return this.hub.allReady();
  }
  get notReady() {
    return [...this.hub.players.values()].filter((p) => p.id !== this.hub.host && p.connected !== false && !p.ready);
  }
  get budget() {
    return { presenceHz: 20, messagesPerSecond: 60, bytesPerSecond: 128000 };
  }
  isParticipant(id = this.pid) {
    return this.hub.match.phase !== 'lobby' && this.hub.match.participants.includes(id);
  }
  matchNow() {
    return this.hub.matchNow();
  }
  presenceAt(id) {
    return this.hub.players.get(id)?.presence ?? null;
  }
  privateOf(id) {
    return id === this.pid ? this.private : {};
  }
  on(ev, fn) {
    (this.handlers[ev] ??= new Set()).add(fn);
    return () => this.handlers[ev]?.delete(fn);
  }
  emit(ev, ...args) {
    for (const fn of [...(this.handlers[ev] ?? [])]) {
      try {
        fn(...args);
      } catch (err) {
        this.errors.push(err);
        if (this.hub.loud) throw err;
      }
    }
  }
  send(data, opts = {}) {
    if (!this.closed && this.connected) this.hub.route(this.pid, clone(data), opts.to);
  }
  setPresence(data) {
    const p = this.hub.players.get(this.pid);
    if (!p || this.closed) return;
    p.presence = clone(data);
    this.hub.broadcast(this.pid, 'presence', p);
  }
  setState(k, v) {
    if (this.closed) return;
    if (k.startsWith('host:') && this.hub.host !== this.pid) {
      this.errors.push('not_host');
      return;
    }
    if (v === null || v === undefined) delete this.state[k];
    else this.state[k] = clone(v);
    this.hub.write(this.pid, k, v === undefined ? null : clone(v));
  }
  setReady(on = true) {
    const me = this.hub.players.get(this.pid);
    if (!me) return;
    me.ready = on !== false;
    this.hub.broadcast(this.pid, 'ready', me);
  }
  clearReady() {
    if (!this.isHost) return;
    for (const p of this.hub.players.values()) delete p.ready;
    this.hub.broadcast(null, 'ready', this.me);
  }
  startMatch() {
    this.hub.start(this.pid);
  }
  endMatch() {
    this.hub.end(this.pid);
  }
  pauseMatch(paused = true) {
    this.hub.pause(this.pid, paused);
  }
  admit(ids) {
    this.hub.admit(this.pid, [].concat(ids));
  }
  setOpen() {}
  hideLobby() {}
  reportResult() {}
  transferHost() {}
  kick() {}
  voteKick() {}
  setTeam() {}
  setSetting() {}
  setPrivate(k, v) {
    if (v === null) delete this.private[k];
    else this.private[k] = clone(v);
  }
  setPrivateFor() {}
  leave() {
    this.hub.leave(this.pid);
  }
}

export class Hub {
  constructor({ now = () => Date.now(), loud = false } = {}) {
    this.roomId = 'local';
    this.clock = now;
    this.loud = loud;
    this.players = new Map();
    this.pages = new Map();
    this.state = {};
    this.host = '';
    this.counter = 0;
    this.match = { phase: 'lobby', n: 0, id: '', seed: 0, participants: [], min: 1, paused: false };
    this.played = 0;
    this.since = 0;
  }
  now() {
    return this.clock();
  }
  matchNow() {
    if (this.match.phase !== 'playing') return 0;
    return this.played + (this.match.paused ? 0 : this.now() - this.since);
  }
  allReady() {
    return [...this.players.values()].every((p) => p.id === this.host || p.connected === false || p.ready);
  }
  join(id, name = id) {
    const fresh = !this.players.has(id);
    if (fresh) this.players.set(id, { id, name, presence: null, team: 0 });
    else delete this.players.get(id).connected;
    if (!this.host) this.host = id;
    const page = new LocalRoom(this, id);
    this.pages.set(id, page);
    if (fresh) this.broadcast(id, 'join', this.players.get(id));
    else this.broadcast(id, 'back', this.players.get(id), true);
    return page;
  }
  // A page reloads: the old one is gone, a new one sees the room as it is.
  reload(id) {
    const old = this.pages.get(id);
    if (old) {
      old.closed = true;
      old.connected = false;
    }
    const p = this.players.get(id);
    if (p) p.connected = false;
    if (this.host === id) this.passHost(id);
    return this.join(id);
  }
  drop(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = false;
    const page = this.pages.get(id);
    if (page) page.connected = false;
    this.broadcast(id, 'away', p);
    if (this.host === id) this.passHost(id);
  }
  back(id) {
    const p = this.players.get(id);
    if (!p) return;
    delete p.connected;
    const page = this.pages.get(id);
    if (page) page.connected = true;
    this.broadcast(id, 'back', p, false);
  }
  passHost(from) {
    const next = [...this.players.values()].find((p) => p.id !== from && p.connected !== false);
    if (next) {
      this.host = next.id;
      this.broadcast(null, 'host', next.id);
    }
  }
  leave(id) {
    const p = this.players.get(id);
    if (!p) return;
    const page = this.pages.get(id);
    this.players.delete(id);
    this.pages.delete(id);
    if (page) {
      page.closed = true;
      page.connected = false;
    }
    if (this.host === id) this.passHost(id);
    this.broadcast(null, 'leave', p, false);
  }
  broadcast(from, ev, ...args) {
    for (const [pid, page] of [...this.pages]) {
      if (page.closed || !page.connected) continue;
      if (from && pid === from) continue;
      page.emit(ev, ...args);
    }
  }
  write(from, k, v) {
    if (v === null) delete this.state[k];
    else this.state[k] = v;
    for (const [pid, page] of [...this.pages]) {
      if (pid === from || page.closed) continue;
      if (v === null) delete page.state[k];
      else page.state[k] = clone(v);
      if (page.connected) page.emit('state', k, v === null ? undefined : clone(v), from);
    }
  }
  route(from, data, to) {
    const sender = this.players.get(from);
    if (!sender) return;
    const at = this.now();
    const mt = this.match.phase === 'playing' ? this.matchNow() : undefined;
    for (const [pid, page] of [...this.pages]) {
      if (pid === from || page.closed || !page.connected || (to && pid !== to)) continue;
      page.emit('message', clone(data), sender, at, mt);
    }
  }
  setMatch(next, ...events) {
    const previous = this.match;
    this.match = next;
    this.broadcast(null, 'match', next, previous);
    for (const ev of events) this.broadcast(null, ev, next, previous);
  }
  start(from) {
    if (from !== this.host || this.match.phase !== 'lobby' || !this.allReady()) return;
    const participants = [...this.players.values()].filter((p) => p.connected !== false && (p.id === this.host || p.ready)).map((p) => p.id);
    this.counter++;
    this.played = 0;
    this.since = this.now();
    for (const p of this.players.values()) delete p.ready;
    this.setMatch({ phase: 'playing', n: this.counter, id: `m${this.counter}`, seed: 1000 + this.counter, participants, min: 1, paused: false }, 'starting', 'matchstart');
  }
  end(from) {
    if (from !== this.host || this.match.phase === 'lobby') return;
    for (const p of this.players.values()) delete p.ready;
    this.setMatch({ phase: 'lobby', n: this.match.n, id: '', seed: 0, participants: [], min: 1, paused: false }, 'matchend');
  }
  pause(from, paused) {
    if (from !== this.host || this.match.phase !== 'playing' || !!this.match.paused === !!paused) return;
    if (paused) this.played += this.now() - this.since;
    else this.since = this.now();
    this.setMatch({ ...this.match, paused: !!paused }, paused ? 'matchpause' : 'matchresume');
  }
  admit(from, ids) {
    if (from !== this.host || this.match.phase !== 'playing') return;
    const add = ids.filter((id) => this.players.has(id) && !this.match.participants.includes(id));
    if (add.length) this.setMatch({ ...this.match, participants: [...this.match.participants, ...add] });
  }
}

// A one-player room for playing outside Onceworlds.
export function soloRoom(id = 'me', name = 'You', now) {
  const hub = new Hub({ now });
  return hub.join(id, name);
}
