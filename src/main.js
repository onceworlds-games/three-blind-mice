// Three Blind Mice: the page. Joins the room as it loads, shows the title (the attract mode: three autopilot mice in the
// kitchen), then the night with friends through the session; or a poster, or an autoplay for the trailer.

import '@fontsource/alfa-slab-one/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import './style.css';
import { createMatch, createHost, t } from '@onceworlds/sdk/match';
import { createView } from './render/view.js';
import { loadProps } from './render/assets.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { createSession, viewFromSim, makeRing, STEP } from './core/session.js';
import { createSim } from './core/sim.js';
import { soloRoom } from './core/localroom.js';
import { NIGHT_COUNT } from './core/levels.js';
import { carrying } from './core/night.js';
import { createBrain, think } from './core/autopilot.js';
import { createRng } from './core/rng.js';
import { holeMouth } from './core/mouse.js';
import { RINGS, ringReachTime } from './core/rings.js';
import { SEAT_CSS } from './render/echo.js';
import { GLASSES } from './looks.js';
import { cleanProgress, loadProgress, mergeProgress, saveProgress, totalStars, unlockedNights, recordNight } from './progress.js';
import { createHints } from './hints.js';

const ow = window.onceworlds ?? null;
const q = new URLSearchParams(location.search);
const LOCAL = !ow || ow.mode !== 'platform' || /(^|\.)localhost$|^127\.0\.0\.1$|^\[::1\]$/.test(location.hostname);
const AUTO = LOCAL && (q.get('autoplay') === '1' || q.get('autoplay') === 'true' || !!import.meta.env?.VITE_AUTOPLAY);
const AUTO_TO = LOCAL ? q.get('autoplay-to') : null;
const ENV_NIGHT = Number(import.meta.env?.VITE_NIGHT) || 0;

const shown = new Set();
function showError(err) {
  console.error(err);
  const text = String(err?.stack || err).slice(0, 600);
  if (!LOCAL || shown.has(text) || shown.size > 3) return;
  shown.add(text);
  const d = document.createElement('pre');
  d.textContent = text;
  d.style.cssText = 'position:fixed;left:8px;right:8px;color:#f88;background:#000a;font:12px monospace;white-space:pre-wrap;z-index:99;pointer-events:none;top:' + (80 + shown.size * 90) + 'px';
  document.body.appendChild(d);
}
const safe = (fn) => {
  try {
    return fn();
  } catch (err) {
    showError(err);
    return undefined;
  }
};
const settings = () => ow?.settings ?? { quality: 'medium', reducedMotion: false, pixelRatio: (m) => Math.min(window.devicePixelRatio || 1, m) };

if (q.get('poster')) import('./poster.js').then((m) => m.runPoster(q.get('poster')));
else boot().catch(showError);

async function boot() {
  const canvas = document.getElementById('gl');
  const view = createView(canvas, { quality: settings().quality ?? 'medium' });
  view.reduced = !!settings().reducedMotion;
  const audio = createAudio();
  const progress = cleanProgress(null);
  // Nothing is saved until the saved progress has loaded and been merged in (or 15 s have gone by), so a slow load never
  // overwrites it; a load that arrives later still merges, and the best of both is saved.
  let progressLoaded = false;
  let saveWaiting = false;
  const persist = () => {
    if (progressLoaded) saveProgress(ow, progress);
    else saveWaiting = true;
  };
  const loaded = () => {
    if (progressLoaded) return;
    progressLoaded = true;
    if (saveWaiting) persist();
  };
  setTimeout(loaded, 15000);
  const hints = createHints(progress, persist);
  loadProgress(ow).then((p) => {
    const late = progressLoaded;
    mergeProgress(progress, p);
    loaded();
    if (late) persist();
    ui.title({ stars: totalStars(progress) });
  });
  const reduced = () => view.reduced;

  // ------------------------------------------------------------ the room, joined as the page loads
  const JOIN = { private: true, maxPlayers: 3, minPlayers: 1, lobby: 'game', countdown: 0 };
  async function join() {
    if (ow?.rooms?.join && !(AUTO && q.get('mice'))) {
      try {
        return await ow.rooms.join(JOIN);
      } catch (err) {
        console.warn('rooms.join failed', err);
      }
    }
    return soloRoom('me', 'You');
  }
  let room = null;
  let session = null;
  let wantQuick = 0;
  function makeSession() {
    session?.dispose();
    session = createSession({ room, createMatch, createHost, t, unlocked: () => Math.max(unlockedNights(progress), ENV_NIGHT), glasses: () => progress.glasses, firstPick: ENV_NIGHT || 1 });
    session.match.on('results', () => onResults());
    room.on('close', (reason) => onClosed(reason));
  }
  join()
    .then((r) => {
      room = r;
      makeSession();
      if (wantQuick) quick(wantQuick);
    })
    .catch(showError);

  // ------------------------------------------------------------ screens
  let screen = 'title';
  let shownPhase = '';
  const ui = createUI({
    sfx: (n) => audio.play(n),
    reduced,
    onPlay: () => play(),
    onPick: (n) => session?.setPick(n),
    onReady: () => session?.ready(!room.me?.ready),
    onStart: () => session?.start(),
    onInvite: () => safe(() => ow?.ui?.showInvite?.()),
    onGlasses: () => cycleGlasses(),
    onNext: () => resultsAction('next'),
    onAgain: () => resultsAction('again'),
    onMap: () => resultsAction('map'),
    onJoinIn: () => session?.joinIn(),
  });
  ui.title({ stars: totalStars(progress) });
  ui.show('title');
  document.body.dataset.flow = 'title';
  safe(() => ow?.ui?.setLook?.({ accent: '#F4A835', panel: '#14131F', text: '#FFF1D6' }));
  safe(() => ui.layout((ow && ow.ui && ow.ui.reserved) || null));
  safe(() => ow?.on?.('reserved', (a) => ui.layout(a)));

  function cycleGlasses() {
    const stars = totalStars(progress);
    const owned = GLASSES.map((g, i) => (stars >= i * 6 ? i : -1)).filter((i) => i >= 0);
    const at = owned.indexOf(progress.glasses);
    progress.glasses = owned[(at + 1) % owned.length] ?? 0;
    persist();
    audio.play('click');
  }

  function play() {
    audio.start();
    audio.music('menu');
    const r = ui.playButton.getBoundingClientRect();
    ui.wipe(((r.left + r.width / 2) / window.innerWidth) * 100, ((r.top + r.height / 2) / window.innerHeight) * 100);
    screen = 'game';
    view.snapCamera();
    // Alone with nothing played yet: straight into Night 1. Anyone else lands in the lobby (or watches a night under way).
    if (AUTO_TO === 'lobby') return;
    const want = AUTO ? Number(q.get('night')) || ENV_NIGHT || 1 : ENV_NIGHT || 1;
    if ((totalStars(progress) === 0 && !import.meta.env?.VITE_LOBBY) || AUTO) {
      if (session) quick(want);
      else wantQuick = want;
    }
  }
  function quick(n) {
    wantQuick = 0;
    if (room.match.phase === 'lobby' && room.isHost && room.online.length <= 1) session.quickStart(n);
  }

  function resultsAction(what) {
    if (!session || !room.isHost || session.phase !== 'results') return;
    const r = session.result();
    if (!r) return;
    // Next only after a night with cheese home (it's what opens the next one); otherwise it means Again, as the big button says.
    if (what === 'next' && r.home > 0 && r.night < NIGHT_COUNT) session.next(r.night + 1);
    else if (what === 'next') session.next(r.night);
    else if (what === 'again') session.next(r.night);
    else session.toMap();
  }

  // ------------------------------------------------------------ input
  const keys = new Set();
  const input = { ix: 0, iz: 0, squeak: false, drop: false, squeakNow: null };
  addEventListener('keydown', (e) => {
    if (e.repeat && e.key !== ' ') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    keys.add(k);
    if (k === ' ' || k.startsWith('Arrow')) e.preventDefault();
    onKey(k, e);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  addEventListener('blur', () => keys.clear());

  function onKey(k, e) {
    if (screen === 'title') {
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        play();
      }
      return;
    }
    if (!session) return;
    const phase = session.phase;
    if (pausedBand) {
      if (k === 'Enter' || k === ' ' || k === 'p' || k === 'Escape') resume();
      return;
    }
    if (phase === 'lobby') {
      if (k === 'Enter') room.isHost ? session.start() : session.ready(!room.me?.ready);
      if (k === 'g') cycleGlasses();
      if (room.isHost && (k === 'ArrowLeft' || k === 'ArrowRight')) session.setPick(session.pick() + (k === 'ArrowLeft' ? -1 : 1));
    } else if (phase === 'round' || phase === 'intro') {
      if (k === 'e') input.drop = true;
      if (k === 'p' || k === 'Escape') pause();
    } else if (phase === 'results') {
      if (k === 'n' || k === 'Enter') resultsAction('next');
      if (k === 'r') resultsAction('again');
      if (k === 'm') resultsAction('map');
    }
  }

  function readInput() {
    let ix = 0;
    let iz = 0;
    if (keys.has('a') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) ix += 1;
    if (keys.has('w') || keys.has('ArrowUp')) iz -= 1;
    if (keys.has('s') || keys.has('ArrowDown')) iz += 1;
    const st = safe(() => ow?.controls?.stick);
    if (st && (st.x || st.y)) {
      const m = Math.hypot(st.x, st.y);
      if (m > 0.12) {
        // Tilt sets the speed: a phone player can creep.
        const sp = Math.min(1, 0.3 + ((m - 0.12) / 0.68) * 0.7);
        ix += (st.x / m) * sp;
        iz += (st.y / m) * sp;
      }
    }
    const l = Math.hypot(ix, iz);
    if (l > 1) {
      ix /= l;
      iz /= l;
    }
    input.ix = ix;
    input.iz = iz;
    input.squeak = keys.has(' ') || !!safe(() => ow?.controls?.pressed?.('squeak'));
  }

  let controlsKey = '';
  function setControls(want) {
    const key = JSON.stringify(want);
    if (key === controlsKey) return;
    controlsKey = key;
    safe(() => ow?.controls?.set?.(want));
  }

  // ------------------------------------------------------------ pause (alone), room closed
  let pausedBand = false;
  function pause() {
    if (!session || !session.alone() || session.phase === 'results' || session.phase === 'lobby') return;
    if (!session.setPaused(true)) return;
    pausedBand = true;
    audio.music('quiet');
    ui.band('pause', {
      title: 'Paused',
      buttons: [
        { label: 'Map', fn: () => leavePause('map') },
        { label: 'Restart night', fn: () => leavePause('again') },
        { label: 'Resume', key: 'Enter', big: true, fn: () => resume() },
      ],
    });
  }
  function resume() {
    pausedBand = false;
    ui.band(null);
    session.setPaused(false);
    audio.music('play');
  }
  function leavePause(what) {
    const night = session.data?.lv ?? session.pick();
    pausedBand = false;
    ui.band(null);
    session.setPaused(false);
    if (what === 'again') session.next(night);
    else session.toMap();
  }
  safe(() => ow?.on?.('pause', () => screen === 'game' && pause()));
  document.addEventListener('visibilitychange', () => {
    audio.suspend(document.hidden);
    if (document.hidden && screen === 'game') pause();
  });

  function onClosed(reason) {
    if (reason === 'left') return;
    const msg = { kicked: ['You were removed', 'Play'], disconnected: ['Connection lost', 'Rejoin'], replaced: ['Playing in another tab', 'Play here'], moved: ['Moved to another server', 'Play'] }[reason] ?? ['Connection lost', 'Rejoin'];
    setControls(null);
    ui.band('closed', {
      title: msg[0],
      buttons: [
        {
          label: msg[1],
          big: true,
          fn: () => {
            ui.band(null);
            join()
              .then((r) => {
                room = r;
                makeSession();
              })
              .catch(showError);
          },
        },
      ],
    });
  }

  // ------------------------------------------------------------ results: stars, saves, badges, boards
  const nightStats = { squeaks: 0, catWoke: false, closeShave: false, decoy: false, wheel: false, myRings: [] };
  function resetNightStats() {
    nightStats.squeaks = 0;
    nightStats.catWoke = false;
    nightStats.myRings = [];
  }
  const awarded = new Set();
  const award = (id) => {
    if (awarded.has(id)) return;
    awarded.add(id);
    safe(() => ow?.badges?.award?.(id)?.catch?.(() => {}));
  };
  function onResults() {
    const r = session.result();
    if (!r || !room.isParticipant?.(room.me.id)) return;
    const mine = r.rows.find((x) => x.me);
    const before = totalStars(progress);
    recordNight(progress, r, nightStats.squeaks);
    persist();
    if (r.home > 0 && mine?.tail) award('still-got-it');
    if (r.stars.all && nightStats.squeaks <= 5) award('silent-run');
    if (r.night === 5 && r.home > 0 && !nightStats.catWoke) award('let-sleeping-cats-lie');
    if (r.stars.all && r.rows.length >= 3) award('see-how-they-run');
    if (progress.stars.every((s) => s > 0)) award('farmhouse');
    if (r.stars.all) safe(() => ow?.leaderboards?.submit?.(`night-${r.night}`, Math.round(r.time * 10) / 10, { lowerIsBetter: true })?.catch?.(() => {}));
    if (totalStars(progress) > before) safe(() => ow?.leaderboards?.submit?.('stars', totalStars(progress))?.catch?.(() => {}));
  }

  // ------------------------------------------------------------ sound and juice from what happened
  const pingFurniture = (x, z, kind) => {
    const r = RINGS[kind].r;
    const world = session ? session.world : null;
    if (!world) return;
    const hits = [];
    for (const f of world.furniture) {
      const cx = (f.x0 + f.x1) / 2;
      const cz = (f.z0 + f.z1) / 2;
      const d = Math.hypot(cx - x, cz - z);
      if (d < r) hits.push(d);
    }
    hits.sort((a, b) => a - b);
    hits.slice(0, 8).forEach((d) => audio.play('echo', { delay: ringReachTime(kind, d) + 0.04, pitch: 2.1 - (d / r) * 1.3, gain: 1 - (d / r) * 0.6 }));
  };
  view.onPing = (p) => {
    if (p.k === 't') audio.play('trapPing', { delay: 0.02 });
    else audio.play('cheese', { delay: 0.02 });
    if (p.k === 't') hints.show('trap');
  };

  function handleFx(list, me, hunters) {
    for (const f of list) {
      switch (f.type) {
        case 'squeak':
          audio.play('squeak', { big: f.big, far: f.mine ? 0 : Math.min(1, Math.hypot(f.x - me.x, f.z - me.z) / 14) });
          if (f.mine) {
            nightStats.squeaks++;
            nightStats.myRings.push({ x: f.x, z: f.z, t: session.now });
            pingFurniture(f.x, f.z, f.big ? 'big' : 'small');
            award('first-squeak');
            hints.done('squeak');
            if (f.big) hints.done('big');
          }
          break;
        case 'noise':
          audio.play(f.kind === 'snap' ? 'snap' : f.kind);
          if (f.mine && f.kind === 'creak') hints.show('creak');
          break;
        case 'bump':
          audio.play('bump');
          break;
        case 'grab':
          if (f.mine) {
            audio.play('nibble');
            hints.done('grab');
            if (f.k === 'W') hints.show('wheel');
          }
          break;
        case 'drop':
          if (f.mine) audio.play('drop');
          break;
        case 'home':
          audio.play('home');
          if (f.mine) {
            award('cheese-thief');
            hints.done('home');
            if (f.k === 'W') award('whole-wheel');
            const searching = hunters.some((h) => h.k !== 'cat' && (h.m === 'search' || h.m === 'go' || h.m === 'hear') && nightStats.myRings.some((r) => session.now - r.t < 25 && Math.hypot(r.x - h.tx, r.z - h.tz) < 3));
            if (searching) award('decoy');
          }
          break;
        case 'ouch':
          view.addTrauma(0.6);
          safe(() => navigator.vibrate?.(40));
          audio.play(f.what === 'tail' ? 'boing' : 'bonk');
          break;
        case 'hit':
          if (!f.mine) audio.play(f.what === 'tail' ? 'boing' : 'bonk');
          break;
        case 'snap':
          if (f.mine) audio.play('snap');
          break;
        case 'chop': {
          const near = Math.hypot(f.x - me.x, f.z - me.z);
          audio.play('thunk');
          view.addTrauma(near < 3 ? 0.5 : 0.2);
          break;
        }
        case 'closeShave':
          award('close-shave');
          break;
        case 'mode':
          if (f.k === 'cat') {
            if (f.m === 'wake') {
              audio.play('meow');
              nightStats.catWoke = true;
            }
            if (f.m === 'crouch') audio.play('hiss');
          } else {
            if (f.m === 'hear') audio.play('hm');
            if (f.m === 'spot') audio.play('gasp');
            if (f.m === 'raise') audio.play('whoosh', { dur: 0.8 });
            if (f.was === 'wait') {
              audio.play('door');
              hints.show('light');
            }
            if (f.m === 'spot' && session.data && carrying(session.data, room.me.id) >= 0) hints.show('drop');
          }
          break;
        case 'step': {
          const near = Math.max(0, 1 - Math.hypot(f.x - me.x, f.z - me.z) / 14);
          if (near > 0 && f.k !== 'cat') audio.play(f.k === 'farmer' ? 'boot' : 'slipper', { near });
          break;
        }
        case 'purr': {
          const near = Math.max(0, 1 - Math.hypot(f.x - me.x, f.z - me.z) / 8);
          if (near > 0) audio.play('purr', { near });
          break;
        }
        case 'chime':
          audio.play('chime');
          hints.show('chime');
          break;
        case 'snore':
          audio.play('snore');
          break;
        case 'midnight':
          audio.play('dong');
          break;
        case 'roundStart':
          resetNightStats();
          audio.music('play');
          break;
      }
    }
    list.length = 0;
  }

  // ------------------------------------------------------------ the HUD from the view model
  const proj = { x: 0, y: 0, on: false };
  function edgePoint(px, py, inset) {
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    const dx = px - cx;
    const dy = py - cy;
    const hx = cx - inset.side;
    const top = inset.top;
    const bottom = innerHeight - inset.bottom;
    const hy = dy < 0 ? cy - top : bottom - cy;
    const s = Math.min(hx / Math.max(1e-3, Math.abs(dx)), hy / Math.max(1e-3, Math.abs(dy)));
    return { x: cx + dx * s, y: cy + dy * s, ang: Math.atan2(dy, dx) };
  }
  function hudState(vm, { watching, canJoin }) {
    const d = vm.data;
    const me = vm.mice.find((m) => m.me);
    const timeLeft = d ? Math.max(0, d.dawn - vm.now) : 0;
    const frac = d ? (vm.now - d.t0) / Math.max(1, d.dawn - d.t0) : 0;
    const inset = { side: 34, top: ui.insets.top + 40, bottom: ui.insets.bot + 70 };
    const tags = [];
    const arrows = [];
    for (const m of vm.mice) {
      if (m.me || m.st === 'watch') continue;
      view.project(m.x, 0.95, m.z, proj);
      if (proj.on) tags.push({ x: proj.x, y: proj.y, text: m.name || 'Mouse', color: SEAT_CSS[m.seat] ?? '#fff' });
      else {
        const e = edgePoint(proj.x, proj.y, inset);
        arrows.push({ ...e, color: SEAT_CSS[m.seat], kind: 'friend', seat: m.seat });
      }
    }
    // The goal, pointed to when it's off screen: the cheese, then the hole.
    if (me && me.st !== 'out' && d) {
      let goal = null;
      if (me.carry) {
        const [hx, hz] = holeMouth(vm.world);
        goal = { x: hx, z: hz, kind: 'hole' };
      } else {
        let best = Infinity;
        for (const it of vm.items) {
          if (it.home || (it.by && it.k === 'w')) continue;
          const dd = Math.hypot(it.x - me.x, it.z - me.z);
          if (dd < best) {
            best = dd;
            goal = { x: it.x, z: it.z, kind: 'cheese' };
          }
        }
      }
      if (goal) {
        view.project(goal.x, 0.3, goal.z, proj);
        if (!proj.on || proj.y < inset.top - 20 || proj.y > innerHeight - inset.bottom + 30) {
          const e = edgePoint(proj.x, proj.y, inset);
          arrows.push({ ...e, color: goal.kind === 'hole' ? '#FF9A3C' : '#FFD23F', kind: goal.kind, seat: -1 });
        }
      }
    }
    let out = null;
    let rest = null;
    const [hx, hz] = holeMouth(vm.world);
    if (me && me.st === 'out' && me.out > 0) {
      view.project(hx, 1.4, hz, proj);
      out = { x: proj.x, y: proj.y, n: me.out };
    }
    if (d && d.rest > 0 && !d.end) {
      view.project(hx, 0.4, hz, proj);
      rest = { x: proj.x, y: proj.y, u: Math.min(1, (vm.now - d.rest) / 4) };
      hints.show('rest');
    }
    let chase = 0;
    let danger = 0;
    if (me && me.st === 'play') {
      for (const h of vm.hunters) {
        const dist = Math.hypot(h.x - me.x, h.z - me.z);
        if (h.k !== 'cat' && (h.m === 'chase' || h.m === 'raise' || h.m === 'spot') && (h.tgt === me.id || dist < 4)) chase = 0.75;
        if (h.k === 'cat' && (h.m === 'crouch' || h.m === 'leap') && dist < 5) chase = 0.6;
        danger = Math.max(danger, h.k === 'cat' && h.m === 'sleep' ? 0 : 1 - dist / 7, chase > 0 ? 1 : 0);
      }
    }
    audio.danger(danger);
    const note = !watching && room?.spectators?.length ? `${room.spectators.map((p) => p.name).join(', ')} watching` : '';
    return { timeLeft, frac, items: d ? d.it : [], tags, arrows, out, rest, chase, watching, canJoin, hint: hints.current, note };
  }

  // Hints: once each, saved; again only for a player who seems stuck.
  function hintTick(vm, dt) {
    const me = vm.mice.find((m) => m.me);
    const d = vm.data;
    if (!me || !d || me.st === 'watch') return;
    const t = vm.nightT;
    if (t > 1.5 && nightStats.squeaks === 0) hints.show('squeak');
    if (nightStats.squeaks >= 2) hints.show('big');
    if (me.carry) hints.show('home');
    else if (vm.items.some((it) => !it.home && !it.by && Math.hypot(it.x - me.x, it.z - me.z) < 6)) hints.show('grab');
    const night = d.lv;
    if (t > 2 && night === 2) hints.show('cover');
    if (t > 2 && night === 4) hints.show('trap');
    if (t > 2 && (night === 5 || night === 9)) hints.show('cat');
    if (t > 2 && night === 7) hints.show('decoy');
    hints.tick(dt);
  }

  // ------------------------------------------------------------ the attract mode: three autopilot mice in the kitchen
  let attract = null;
  let attractAcc = 0;
  function newAttract() {
    attract = createSim({ night: 1, ids: ['a1', 'a2', 'a3'], seed: (Math.random() * 1e6) | 0, skill: [0.95, 0.9, 0.85] });
    const [hx, hz] = holeMouth(attract.world);
    attract.rings.push({ kind: 'midnight', x: hx, z: hz, t: 0, src: '' });
  }
  newAttract();
  let titleSweep = 0;

  // ------------------------------------------------------------ the trailer's autoplay: the sim with every mouse on autopilot
  const SIM_MODE = AUTO && q.get('mice');
  let simGame = null;
  if (SIM_MODE) {
    const n = Math.max(1, Math.min(3, Number(q.get('mice')) || 3));
    const night = Math.max(1, Math.min(NIGHT_COUNT, Number(q.get('night')) || 1));
    const seed = Number(q.get('seed')) || 7;
    const careless = q.get('careless') ? [false, true, true] : false;
    view.zoom = Math.max(0.5, Math.min(3, Number(q.get('zoom')) || 1));
    simGame = { sim: createSim({ night, ids: ['m1', 'm2', 'm3'].slice(0, n), seed, skill: [0.95, 0.85, 0.8], careless, solo: n === 1 }), phase: 'intro', t: 0, acc: 0 };
    const [hx, hz] = holeMouth(simGame.sim.world);
    // ring0: the midnight ring already that far along (a capture that opens mid-sweep).
    simGame.sim.rings.push({ kind: 'midnight', x: hx, z: hz, t: -Math.min(2, Math.max(0, Number(q.get('ring0')) || 0)), src: '' });
    screen = 'sim';
    audio.start();
    view.mode = 'intro';
    view.introStart();
    ui.show('intro');
    ui.intro(simGame.sim.world.night);
    if (q.get('skipintro')) {
      simGame.phase = 'round';
      view.mode = q.get('cam') === 'wide' ? 'attract' : 'follow';
      ui.show('hud');
      audio.music('play');
    }
    // wait=1: hold the first frame until a capture says go (a 'tbm-go' event on window).
    if (q.get('wait')) {
      simGame.held = simGame.phase;
      simGame.phase = 'hold';
      addEventListener('tbm-go', () => {
        simGame.phase = simGame.held;
        simGame.t = 0;
      }, { once: true });
    }
  }

  // ------------------------------------------------------------ the frame
  let last = performance.now();
  let lobbyT = 0;
  let lobbyRings = [];
  let nextLobbyRing = 0;
  let autoBrain = null;
  let morningT = 0;
  let resultsShown = '';
  let lastQuality = settings().quality;
  let lastReduced = !!settings().reducedMotion;

  function sizeView() {
    const pr = safe(() => settings().pixelRatio(2)) ?? Math.min(devicePixelRatio || 1, 2);
    view.resize(innerWidth, innerHeight, pr);
  }
  sizeView();
  addEventListener('resize', sizeView);
  safe(() =>
    ow?.settings?.on?.('change', (s) => {
      view.reduced = !!s.reducedMotion;
      if (s.quality !== lastQuality) {
        lastQuality = s.quality;
        view.setQuality(s.quality);
      }
      sizeView();
    }),
  );
  view.setQuality(settings().quality ?? 'medium');

  // The props (barrels, jugs, the clock) load first: a room is built once, with them.
  let propsReady = false;
  Promise.race([loadProps(), new Promise((r) => setTimeout(r, 12000))]).then(() => (propsReady = true));
  function frame() {
    requestAnimationFrame(frame);
    // performance.now(), not the frame's timestamp: the same clock everywhere (a capture's virtual time moves only this one).
    const nowMs = performance.now();
    if (document.hidden || !propsReady) {
      last = nowMs;
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (nowMs - last) / 1000));
    last = nowMs;
    safe(() => tick(dt));
  }
  requestAnimationFrame(frame);

  function tick(dt) {
    const reducedNow = !!settings().reducedMotion;
    if (reducedNow !== lastReduced) {
      lastReduced = reducedNow;
      view.reduced = reducedNow;
    }
    if (screen === 'title') return titleTick(dt);
    if (screen === 'sim') return simTick(dt);
    gameTick(dt);
  }

  function titleTick(dt, waiting = false) {
    attractAcc += dt;
    while (attractAcc >= STEP * 2) {
      attractAcc -= STEP * 2;
      attract.step(STEP * 2);
      if (attract.ended || attract.now > 150) newAttract();
    }
    const vm = viewFromSim(attract);
    // The letters light up as each ring passes.
    const newest = attract.rings.filter((r) => r.src && (r.kind === 'big' || r.kind === 'small')).pop();
    titleSweep = newest ? (attract.now - newest.t) / RINGS[newest.kind].dur : 2;
    ui.lightTitle(50, titleSweep < 1.6 ? 20 + titleSweep * 110 : 160);
    view.mode = 'attract';
    view.render(vm, dt);
    setControls(null);
    if (waiting) return;
    // A match this page is part of began without the title's button (the platform started it): show it.
    if (session && room.match.phase === 'playing' && room.isParticipant(room.me.id)) {
      screen = 'game';
      return;
    }
    if (AUTO && !SIM_MODE && AUTO_TO !== 'title' && performance.now() > 1500) play();
    if (AUTO_TO === 'lobby' && performance.now() > 1200) play();
  }

  function gameTick(dt) {
    readInput();
    const s = session;
    if (!s) return titleTick(dt, true);
    // Autoplay: this page's mouse is driven by the autopilot.
    if (AUTO && s.phase === 'round' && s.data && room.isParticipant(room.me.id)) {
      autoBrain ??= createBrain({ skill: 0.9, rng: createRng(5) });
      const out = think(autoBrain, { world: s.world, data: s.data, now: s.now, hunters: s.hunters, mice: s.mice.map((m) => ({ id: m.id, x: m.x, z: m.z, vx: 0, vz: 0, st: m.st })), me: s.me, claims: {} });
      input.ix = out.ix;
      input.iz = out.iz;
      if (out.squeak) input.squeakNow = out.squeak;
      if (out.drop) input.drop = true;
    }
    s.update(dt, input);
    const phase = s.phase;
    document.body.dataset.flow = { lobby: 'lobby', countdown: 'countdown', intro: 'intro', round: 'playing', roundEnd: 'roundEnd', results: 'results' }[phase] ?? phase;
    const me = s.mice.find((m) => m.me) ?? s.me;
    handleFx(s.fx, me, s.hunters);
    const watching = room.spectating && phase !== 'lobby';
    let vm = s;
    if (phase === 'lobby' || phase === 'countdown') {
      if (shownPhase !== 'lobby') {
        shownPhase = 'lobby';
        ui.show('lobby');
        audio.music('menu');
        view.mode = 'orbit';
        view.snapCamera();
        lobbyRings = [];
        lobbyT = 0;
        nextLobbyRing = 0;
        resultsShown = '';
        if (pausedBand) {
          pausedBand = false;
          ui.band(null);
        }
      }
      lobbyT += dt;
      if (lobbyT >= nextLobbyRing) {
        const w = s.world;
        const [hx, hz] = holeMouth(w);
        lobbyRings.push(nextLobbyRing === 0 ? makeRing('midnight', hx, hz, lobbyT) : makeRing('big', 2 + Math.random() * (w.W - 4), 2 + Math.random() * (w.D - 4), lobbyT, { seat: (lobbyRings.length % 3) }));
        if (lobbyRings.length > 6) lobbyRings.shift();
        nextLobbyRing = lobbyT + 3.2;
      }
      if (view.world !== s.world) lobbyRings = lobbyRings.filter((r) => r.kind === 'midnight').map((r) => ({ ...r, t: lobbyT }));
      vm = { world: s.world, data: null, mice: s.mice, items: s.items, rings: lobbyRings, hunters: [], now: lobbyT, focus: null };
      const players = [...room.players.values()].filter((p) => p.connected !== false).slice(0, 3);
      ui.lobby({
        pick: s.pick(),
        unlocked: room.isHost ? unlockedNights(progress) : NIGHT_COUNT,
        stars: progress.stars,
        best: progress.best,
        isHost: room.isHost,
        canStart: !!room.canStart,
        waitingFor: (room.notReady ?? []).map((p) => p.name),
        ready: !!room.me?.ready,
        hostName: room.players.get(room.host)?.name ?? 'the host',
        inviteable: !!ow?.ui?.showInvite && room.kind === 'private',
        seats: players.map((p) => ({ id: p.id, name: p.name, me: p.id === room.me.id, host: p.id === room.host, ready: !!p.ready, g: p.id === room.me.id ? progress.glasses : (p.presence?.g ?? 0), avatar: avatars.get(p.id) ?? null })),
      });
      players.forEach((p) => fetchAvatar(p.id));
      setControls(null);
    } else if (phase === 'intro') {
      if (shownPhase !== 'intro') {
        shownPhase = 'intro';
        ui.show('intro');
        ui.intro(s.world.night);
        view.mode = 'intro';
        view.introStart();
        audio.music('quiet');
      }
      ui.lightIntro(Math.min(170, 10 + (s.now % 3) * 90));
      setControls(null);
    } else if (phase === 'round') {
      if (shownPhase !== 'round') {
        shownPhase = 'round';
        ui.show('hud');
        view.mode = 'follow';
        audio.music('play');
      }
      hintTick(s, dt);
      const carryingNow = s.data && carrying(s.data, room.me.id) >= 0;
      if (room.isParticipant(room.me.id) && s.me.st !== 'out') {
        const buttons = [{ id: 'squeak', label: 'Squeak', key: ' ' }];
        if (carryingNow) buttons.push({ id: 'drop', label: 'Drop', key: 'e' });
        setControls({ stick: 'analog', zone: 'wide', buttons });
      } else setControls(null);
      ui.hud(hudState(s, { watching, canJoin: watching && s.me.st !== 'join' }));
    } else if (phase === 'roundEnd') {
      if (shownPhase !== 'roundEnd') {
        shownPhase = 'roundEnd';
        const r = s.result();
        ui.show('morning');
        ui.morning(r && r.home > 0 ? 'Morning' : 'Dawn');
        audio.music('off');
        audio.play(r && r.home > 0 ? 'morning' : 'dawn');
        morningT = 0;
        setControls(null);
      }
      morningT += dt;
    } else if (phase === 'results') {
      const r = s.result();
      if (r && resultsShown !== s.roundId) {
        resultsShown = s.roundId;
        shownPhase = 'results';
        ui.show('results');
        view.mode = 'burrow';
        audio.music('menu');
        const best = progress.best[r.night - 1] || 0;
        ui.results({ ...r, all: r.stars.all, best, isHost: room.isHost, next: r.night < NIGHT_COUNT, hostName: room.players.get(room.host)?.name ?? 'the host' });
        const got = [r.stars.home, r.stars.all, r.stars.tails];
        got.forEach((on, i) =>
          setTimeout(() => {
            if (!on) return;
            ui.resultStar(i, true);
            audio.play('star', { n: i });
          }, 500 + i * 450),
        );
      }
      if (r) vm = { ...s, burrow: { wedges: s.data.it.filter((i) => i.home && i.k === 'w').length, wheel: s.data.it.some((i) => i.home && i.k === 'W'), mice: r.rows.map((row) => ({ seat: row.seat, tail: row.tail, g: row.me ? progress.glasses : 0 })) } };
      setControls(null);
    }
    if (phase !== 'results' && view.mode === 'burrow') view.mode = 'follow';
    view.render(vm, dt);
  }

  // Avatars for the lobby's seats.
  const avatars = new Map();
  const asked = new Set();
  function fetchAvatar(id) {
    if (asked.has(id) || !ow?.player?.avatarUrl) return;
    asked.add(id);
    Promise.resolve(safe(() => ow.player.avatarUrl(id, 'head')))
      .then((url) => url && avatars.set(id, url))
      .catch(() => {});
  }

  // focus=<n>: the camera follows that mouse (it is 'you' on the HUD).
  const simFocus = Math.max(0, Math.min(2, Number(q.get('focus')) || 0));
  function simView(sim) {
    const vm = viewFromSim(sim);
    if (vm.mice[simFocus]) {
      vm.mice.forEach((m, i) => (m.me = i === simFocus));
      vm.focus = vm.mice[simFocus];
    }
    return vm;
  }

  function simTick(dt) {
    const g = simGame;
    const sim = g.sim;
    g.t += dt;
    if (g.phase === 'hold') {
      view.snapCamera();
      return view.render(simView(sim), 0);
    }
    if (g.phase === 'intro') {
      sim.now += 0; // the world waits while the camera drops in
      if (g.t > 2.5) {
        g.phase = 'round';
        ui.show('hud');
        view.mode = q.get('cam') === 'wide' ? 'attract' : 'follow';
        audio.music('play');
      }
      ui.lightIntro(Math.min(170, 10 + g.t * 90));
      const vm = simView(sim);
      vm.now = g.t;
      view.render(vm, dt);
      if (g.t < dt * 2) audio.play('dong');
      return;
    }
    if (g.phase === 'round') {
      const before = sim.events.length;
      g.acc += dt;
      while (g.acc >= STEP) {
        g.acc -= STEP;
        sim.step(STEP);
      }
      simSounds(sim.events.slice(before));
      if (sim.ended) {
        g.phase = 'morning';
        g.t = 0;
        ui.show('morning');
        ui.morning(sim.data.it.some((i) => i.home) ? 'Morning' : 'Dawn');
        audio.play('morning');
        audio.music('off');
      }
      const vm = simView(sim);
      view.mode = q.get('cam') === 'wide' ? 'attract' : 'follow';
      ui.hud(hudState(vm, { watching: false, canJoin: false }));
      view.render(vm, dt);
      return;
    }
    if (g.phase === 'morning' && g.t > 2) {
      g.phase = 'results';
      view.mode = 'burrow';
      ui.show('');
    }
    const vm = simView(sim);
    vm.burrow = { wedges: sim.data.it.filter((i) => i.home && i.k === 'w').length, wheel: sim.data.it.some((i) => i.home && i.k === 'W'), mice: sim.mice.map((m, i) => ({ seat: i, tail: sim.data.mice[m.id].tail, g: [0, 2, 4][i] })) };
    view.render(vm, dt);
  }

  function simSounds(events) {
    for (const e of events) {
      if (e.type === 'ring') {
        const r = e.ring;
        if (r.kind === 'small' || r.kind === 'big') audio.play('squeak', { big: r.kind === 'big', far: 0.3 });
        else if (['creak', 'crumbs', 'pan', 'rumble'].includes(r.kind)) audio.play(r.kind);
        else if (r.kind === 'chime') audio.play('chime');
        else if (r.kind === 'snore') audio.play('snore');
      } else if (e.type === 'grab') audio.play('nibble');
      else if (e.type === 'home') audio.play('home');
      else if (e.type === 'hit') {
        audio.play(e.what === 'tail' ? 'boing' : 'bonk');
        view.addTrauma(0.5);
      } else if (e.type === 'chop' || e.type === 'pounce') {
        audio.play('thunk');
        view.addTrauma(0.4);
      } else if (e.type === 'hear') audio.play('hm');
      else if (e.type === 'spot') audio.play('gasp');
      else if (e.type === 'raise') audio.play('whoosh', { dur: 0.8 });
      else if (e.type === 'enter') audio.play('door');
      else if (e.type === 'wake') audio.play('meow');
      else if (e.type === 'snap') audio.play('snap');
    }
  }
}
