// Three Blind Mice: the page. Joins the room as it loads, shows the title (the attract mode: three autopilot mice in the
// kitchen), then the night with friends through the session; or a poster, or an autoplay for the trailer.

import '@fontsource/alfa-slab-one/400.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow/700.css';
import './style.css';
import './meta.css';
import { createMatch, createHost, t } from '@onceworlds/sdk/match';
import { createView } from './render/view.js';
import { loadProps } from './render/assets.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { createSession, viewFromSim, makeRing, worldFor, STEP } from './core/session.js';
import { createSim } from './core/sim.js';
import { soloRoom } from './core/localroom.js';
import { NIGHT_COUNT } from './core/levels.js';
import { carrying } from './core/night.js';
import { createBrain, think } from './core/autopilot.js';
import { createRng } from './core/rng.js';
import { holeMouth, MOUSE } from './core/mouse.js';
import { CRUMB, chainMult } from './core/crumbs.js';
import { medalsFor, SCORE } from './core/score.js';
import { dayKey, dailyNight, dailyPlan, TWISTS } from './core/daily.js';
import { RINGS, ringReachTime } from './core/rings.js';
import { SEAT_CSS } from './render/echo.js';
import { UNLOCKS, unlockedAt, KINDS } from './looks.js';
import { cleanProgress, loadProgress, mergeProgress, saveProgress, totalStars, unlockedNights, recordNight, levelOf, ensureDay, liveStreak, wearable } from './progress.js';
import { goalLabel } from './goals.js';
import { raidTop } from './raidboard.js';
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
  // Today, by the platform's clock (the same day for everyone, UTC).
  // day=YYYYMMDD (local captures only): pretend it's that day.
  const FAKE_DAY = LOCAL ? Number(q.get('day')) || 0 : 0;
  const today = () => FAKE_DAY || dayKey(safe(() => ow?.now?.()) ?? Date.now());
  // Today's raid board (the game's shared list, filtered to today), read now and then.
  const raidBoard = { day: 0, top: [], raiders: 0, at: 0 };
  loadProgress(ow).then((p) => {
    const late = progressLoaded;
    mergeProgress(progress, p);
    progress.look = wearable(progress.look, levelOf(progress.xp).level);
    loaded();
    if (ensureDay(progress, today()) || late) persist();
    refreshTitle();
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
  let wantRaid = false;
  function makeSession() {
    session?.dispose();
    session = createSession({ room, createMatch, createHost, t, unlocked: () => Math.max(unlockedNights(progress), ENV_NIGHT), look: () => progress.look, firstPick: ENV_NIGHT || 1 });
    if (wantRaid) {
      wantRaid = false;
      if (!session.quickRaid(today())) session.setPick(0, today());
    }
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
    sfx: (n, o) => {
      audio.play(n, o);
      if ((n === 'medal' && o?.n) || n === 'levelup' || n === 'unlock') view.cheer();
    },
    reduced,
    onPlay: () => play(),
    onRaid: () => play(true),
    onPick: (n, raid) => (raid ? session?.setPick(0, today()) : session?.setPick(n)),
    onWardrobe: (on) => setWardrobe(on),
    onWear: (kind, id) => wear(kind, id),
    onTry: (kind, id) => tryOn(kind, id),
    onReady: () => session?.ready(!room.me?.ready),
    onStart: () => session?.start(),
    onInvite: () => safe(() => ow?.ui?.showInvite?.()),
    onNext: () => resultsAction('next'),
    onAgain: () => resultsAction('again'),
    onMap: () => resultsAction('map'),
    onJoinIn: () => session?.joinIn(),
  });
  refreshTitle();
  ui.show('title');
  document.body.dataset.flow = 'title';
  safe(() => ow?.ui?.setLook?.({ accent: '#F4A835', panel: '#14131F', text: '#FFF1D6' }));
  safe(() => ui.layout((ow && ow.ui && ow.ui.reserved) || null));
  safe(() => ow?.on?.('reserved', (a) => ui.layout(a)));

  // ------------------------------------------------------------ the wardrobe
  let dressing = false;
  // A locked item tried on in the wardrobe: only this page's picture wears it, never the save or the room.
  let trying = null;
  const LOOK_KEY = { glasses: 'g', hat: 'h', fur: 'f', trail: 't' };
  const drawWardrobe = () => ui.wardrobe(dressing ? { level: levelOf(progress.xp).level, look: progress.look, trying } : null);
  function setWardrobe(on) {
    dressing = !!on && screen === 'game' && session?.phase === 'lobby';
    trying = null;
    drawWardrobe();
    audio.play(dressing ? 'whistle' : 'click');
  }
  function wear(kind, id) {
    const key = LOOK_KEY[kind];
    if (!key || !unlockedAt(kind, id, levelOf(progress.xp).level)) return;
    progress.look = { ...progress.look, [key]: id };
    trying = null;
    persist();
    audio.play('nibble');
    view.punchIn?.(0.4);
    if (dressing) drawWardrobe();
  }
  function tryOn(kind, id) {
    if (!LOOK_KEY[kind] || !KINDS[kind]?.[id]) return;
    trying = trying?.kind === kind && trying.id === id ? null : { kind, id };
    audio.play('tap');
    drawWardrobe();
  }
  const lookShown = () => (trying ? { ...progress.look, [LOOK_KEY[trying.kind]]: trying.id } : progress.look);

  // ------------------------------------------------------------ the title's meta: level, streak, goals, today's raid
  function readRaidBoard(force = false) {
    const day = today();
    if (!ow?.data?.game?.get || (!force && raidBoard.day === day && performance.now() - raidBoard.at < 30000)) return;
    raidBoard.at = performance.now();
    Promise.resolve(safe(() => ow.data.game.get('raid')))
      .then((list) => {
        raidBoard.day = day;
        raidBoard.top = raidTop(list, day, room?.me?.id ?? '');
        refreshTitle();
        if (session?.phase === 'results' && session.result()?.day === day) ui.raidBoard(raidBoard.top);
      })
      .catch(() => {});
    Promise.resolve(safe(() => ow.data.game.get('raiders')))
      .then((n) => {
        if (Number.isFinite(n)) raidBoard.raiders = n;
      })
      .catch(() => {});
  }
  function raidInfo() {
    const day = today();
    const night = dailyNight(day);
    if (!night) return null;
    const plan = dailyPlan(day);
    return { day, name: night.name, night: night.id, twist: TWISTS[plan.twist].name, tip: TWISTS[plan.twist].tip, best: progress.daily.day === day ? progress.daily.raid : 0, top: raidBoard.day === day ? raidBoard.top : [], raiders: raidBoard.raiders };
  }
  const twistText = (night) => (night?.twist && TWISTS[night.twist] ? `${TWISTS[night.twist].name} · ${TWISTS[night.twist].tip}` : '');
  function goalsView(now = []) {
    return progress.daily.day === today() ? progress.daily.goals.map((g) => ({ label: goalLabel(g.id), have: g.have, need: g.need, done: g.done, now: now.includes(g.id) })) : [];
  }
  const weekView = (now = false) => (progress.weekly.id ? { label: goalLabel(progress.weekly.id), have: progress.weekly.have, need: progress.weekly.need, done: progress.weekly.done, now, week: true } : null);
  function refreshTitle() {
    ensureDay(progress, today());
    readRaidBoard();
    const lv = levelOf(progress.xp);
    ui.title({ level: lv.level, into: lv.into, need: lv.need, streak: liveStreak(progress, today()), daily: raidInfo(), goals: goalsView(), week: weekView(), allDone: !!progress.daily.all });
  }
  readRaidBoard(true);

  function play(raid = false) {
    audio.start();
    audio.music('menu');
    const r = (raid ? ui.raidButton : ui.playButton).getBoundingClientRect();
    ui.wipe(((r.left + r.width / 2) / window.innerWidth) * 100, ((r.top + r.height / 2) / window.innerHeight) * 100);
    screen = 'game';
    view.snapCamera();
    // The Daily Raid: alone, straight in; with friends, it's the lobby's pick.
    if (raid) {
      if (session && room.match.phase === 'lobby' && room.isHost && room.online.length <= 1) session.quickRaid(today());
      else if (session && room.isHost) session.setPick(0, today());
      else if (!session) wantRaid = true;
      return;
    }
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
    if (r.day && what !== 'map') session.next(r.night, r.day === today() ? r.day : today());
    else if (what === 'next' && r.home > 0 && r.night < NIGHT_COUNT) session.next(r.night + 1);
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
      if (k === 'd') play(true);
      return;
    }
    if (!session) return;
    const phase = session.phase;
    if (pausedBand) {
      if (k === 'Enter' || k === ' ' || k === 'p' || k === 'Escape') resume();
      return;
    }
    if (phase === 'lobby') {
      if (dressing) {
        if (k === 'Escape' || k === 'Enter' || k === 'g') setWardrobe(false);
        return;
      }
      if (k === 'Enter') room.isHost ? session.start() : session.ready(!room.me?.ready);
      if (k === 'g') setWardrobe(true);
      if (k === 'd' && room.isHost) session.setPick(0, today());
      if (room.isHost && (k === 'ArrowLeft' || k === 'ArrowRight')) session.setPick(session.pickDay() ? 1 : session.pick() + (k === 'ArrowLeft' ? -1 : 1));
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
    // Shift: tiptoe (slow enough to be silent).
    if (keys.has('Shift')) {
      ix *= MOUSE.creep;
      iz *= MOUSE.creep;
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
    nightStats.spotted = false;
    nightStats.myRings = [];
  }
  const awarded = new Set();
  const award = (id) => {
    if (awarded.has(id)) return;
    awarded.add(id);
    safe(() => ow?.badges?.award?.(id)?.catch?.(() => {}));
  };
  // What the last night did to this player's progress, for the results screen (kept per round).
  let lastRec = null;
  function onResults() {
    const r = session.result();
    if (!r || !room.isParticipant?.(room.me.id)) return;
    if (lastRec?.roundId === session.roundId) return;
    const mine = r.rows.find((x) => x.me);
    const day = today();
    const before = totalStars(progress);
    const xpBefore = levelOf(progress.xp);
    const firstRaid = !!r.day && (progress.daily.day !== day || progress.daily.raid === 0);
    const rec = recordNight(progress, r, nightStats.squeaks, day);
    const xpAfter = levelOf(progress.xp);
    persist();
    lastRec = {
      roundId: session.roundId,
      rec,
      level: { from: xpBefore.level, to: xpAfter.level, into: xpAfter.into, need: xpAfter.need, before: xpBefore.into / xpBefore.need },
      unlocked: UNLOCKS.filter((u) => u.level > xpBefore.level && u.level <= xpAfter.level).map((u) => ({ kind: u.kind, id: u.id })),
      goals: [...goalsView(rec.goals), ...(weekView(rec.weekly) ? [weekView(rec.weekly)] : [])],
    };
    const sc = r.score;
    // Badges.
    if (r.home > 0 && mine?.tail) award('still-got-it');
    if (r.stars.all && nightStats.squeaks <= 5) award('silent-run');
    if (r.night === 5 && r.home > 0 && !nightStats.catWoke && !r.day) award('let-sleeping-cats-lie');
    if (r.stars.all && r.rows.length >= 3) award('see-how-they-run');
    if (progress.stars.every((v) => v > 0)) award('farmhouse');
    if ((r.mine?.crumbs ?? 0) >= 30) award('crumb-hoover');
    if ((r.mine?.chain ?? 0) >= 10) award('chain-gang');
    if (sc?.lines?.some((l) => l.id === 'unseen')) award('ghost');
    if (sc?.lines?.some((l) => l.id === 'quiet')) award('quiet-feet');
    if (sc?.medal === 3) award('gold-medal');
    if (progress.medal.every((v) => v === 3)) award('all-gold');
    if (r.day && sc?.counts) award('daily-bread');
    if (liveStreak(progress, day) >= 7) award('week-streak');
    if (rec.allGoals) award('goal-getter');
    if (xpAfter.level >= 10) award('level-10');
    if (xpAfter.level >= 25) award('level-25');
    // Boards: each night's best score; the stars; today's raid on the game's shared list.
    if (!r.day && sc?.counts) safe(() => ow?.leaderboards?.submit?.(`score-${r.night}`, sc.total)?.catch?.(() => {}));
    if (totalStars(progress) > before) safe(() => ow?.leaderboards?.submit?.('stars', totalStars(progress))?.catch?.(() => {}));
    if (r.day && r.day === day && sc) {
      if (firstRaid) safe(() => ow?.data?.game?.add?.('raiders', 1)?.catch?.(() => {}));
      if (rec.raidBest && sc.total > 0) {
        Promise.resolve(safe(() => ow?.data?.game?.push?.('raid', { d: day, s: sc.total, n: r.night })))
          .then(() => readRaidBoard(true))
          .catch(() => {});
      }
    }
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
            if (session.data?.it[f.i]?.gd) {
              audio.play('golden');
              ui.call(`Golden wedge · ${SCORE.gold}`, 'gold');
            }
          }
          break;
        case 'drop':
          if (f.mine) audio.play('drop');
          break;
        case 'home': {
          audio.play('home');
          const it = session.data?.it[f.i];
          if (it) {
            const pts = it.k === 'W' ? SCORE.wheel : it.gd ? SCORE.gold : SCORE.wedge;
            const [hx, hz] = holeMouth(session.world);
            view.project(hx, 0.6, hz, proj);
            if (proj.on) ui.pop(proj.x, proj.y, `+${pts}`, 'x5');
            view.punchIn(0.35);
          }
          if (f.mine) {
            award('cheese-thief');
            hints.done('home');
            if (f.k === 'W') award('whole-wheel');
            const searching = hunters.some((h) => h.k !== 'cat' && (h.m === 'search' || h.m === 'go' || h.m === 'hear') && nightStats.myRings.some((r) => session.now - r.t < 25 && Math.hypot(r.x - h.tx, r.z - h.tz) < 3));
            if (searching) award('decoy');
          }
          break;
        }
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
          audio.play('shave');
          ui.call(`Close shave +${SCORE.shave}`);
          break;
        case 'crumb':
          if (f.mine) {
            audio.play('crumb', { chain: f.chain, mult: f.mult });
            view.crumbPop(f.x, f.z, f.mult);
            view.project(f.x, 0.35, f.z, proj);
            if (proj.on) ui.pop(proj.x, proj.y, `+${f.pts}`, f.mult >= 5 ? 'x5' : f.mult >= 3 ? 'x3' : '');
            if (f.chain === 1) hints.show('chain');
            if (f.chain >= 3) hints.done('chain');
            if (f.chain === 10) ui.call('Chain 10!', 'gold');
          } else view.crumbPop(f.x, f.z, 1, 0xd8b98a);
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
            if (f.m === 'spot') {
              audio.play('gasp');
              if (f.tgt === room.me.id && !nightStats.spotted) {
                nightStats.spotted = true;
                ui.call('Spotted', 'warn');
              }
            }
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
          ui.resetScore();
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
  let lastChain = 0;
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
    // The night's score as it stands: the cheese home and everyone's crumbs. The chain: this mouse's.
    let score = 0;
    let homeN = 0;
    if (d) {
      for (const it of d.it) if (it.home) {
        score += it.k === 'W' ? SCORE.wheel : it.gd ? SCORE.gold : SCORE.wedge;
        homeN++;
      }
      for (const id in d.mice) score += d.mice[id].pt || 0;
    }
    const chain = { n: 0, mult: 1, left: 0 };
    if (vm.me && vm.me.chain) {
      chain.n = vm.me.chain;
      chain.left = 1 - (vm.now - vm.me.chainT) / CRUMB.gap;
    } else if (me && d?.mice[me.id]) {
      chain.n = d.mice[me.id].ch;
      chain.left = 1 - (vm.now - d.mice[me.id].ct) / CRUMB.gap;
    }
    chain.mult = chainMult(chain.n);
    if (chain.left <= 0 && lastChain > 2) audio.play('chainEnd');
    lastChain = chain.left > 0 ? chain.n : 0;
    audio.build(d ? Math.max(frac * 0.8, d.it.length ? homeN / d.it.length : 0) : 0);
    const note = !watching && room?.spectators?.length ? `${room.spectators.map((p) => p.name).join(', ')} watching` : '';
    return { timeLeft, frac, items: d ? d.it : [], score, chain, tiptoe: me?.tiptoe ?? 0, tags, arrows, out, rest, chase, watching, canJoin, hint: hints.current, note };
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
    // day=YYYYMMDD: that day's Daily Raid instead.
    const raidNight = FAKE_DAY ? dailyNight(FAKE_DAY) : null;
    simGame = { sim: createSim({ night: raidNight ?? night, ids: ['m1', 'm2', 'm3'].slice(0, n), seed, skill: [0.95, 0.85, 0.8], careless, solo: n === 1 }), phase: 'intro', t: 0, acc: 0 };
    const [hx, hz] = holeMouth(simGame.sim.world);
    // ring0: the midnight ring already that far along (a capture that opens mid-sweep).
    simGame.sim.rings.push({ kind: 'midnight', x: hx, z: hz, t: -Math.min(2, Math.max(0, Number(q.get('ring0')) || 0)), src: '' });
    screen = 'sim';
    audio.start();
    view.mode = 'intro';
    view.introStart();
    ui.show('intro');
    ui.intro(simGame.sim.world.night, twistText(simGame.sim.world.night));
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
    if (AUTO && !SIM_MODE && AUTO_TO !== 'title' && performance.now() > 1500) play(!!q.get('raid'));
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
        view.mode = dressing ? 'wardrobe' : 'orbit';
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
      // dress=1 (local captures): the wardrobe opens once the lobby is up.
      if (LOCAL && q.get('dress') && !dressing && lobbyT > 0.5 && lobbyT < 0.6) {
        setWardrobe(true);
        const [k, id] = String(q.get('try') ?? '').split(':');
        if (k) tryOn(k, Number(id));
      }
      if (lobbyT >= nextLobbyRing) {
        const w = s.world;
        const [hx, hz] = holeMouth(w);
        lobbyRings.push(nextLobbyRing === 0 ? makeRing('midnight', hx, hz, lobbyT) : makeRing('big', 2 + Math.random() * (w.W - 4), 2 + Math.random() * (w.D - 4), lobbyT, { seat: (lobbyRings.length % 3) }));
        if (lobbyRings.length > 6) lobbyRings.shift();
        nextLobbyRing = lobbyT + 3.2;
      }
      if (view.world !== s.world) lobbyRings = lobbyRings.filter((r) => r.kind === 'midnight').map((r) => ({ ...r, t: lobbyT }));
      const mine = s.mice.find((m) => m.me) ?? null;
      let mice = s.mice;
      if (trying && mine) {
        const lk = lookShown();
        mice = s.mice.map((m) => (m.me ? { ...m, look: lk, g: lk.g } : m));
      }
      vm = { world: s.world, data: null, mice, items: s.items, rings: lobbyRings, hunters: [], now: lobbyT, focus: dressing ? mine : null };
      view.mode = dressing && mine ? 'wardrobe' : 'orbit';
      const players = [...room.players.values()].filter((p) => p.connected !== false).slice(0, 3);
      const pickDay = s.pickDay();
      const lv = levelOf(progress.xp);
      if (pickDay) readRaidBoard();
      const raid = pickDay ? raidInfo() : null;
      ui.lobby({
        pick: s.pick(),
        raid: raid ? { twist: `${raid.twist}: ${raid.tip}`, best: raid.best, top: raid.top } : null,
        raidOk: room.isHost || !!pickDay,
        unlocked: room.isHost ? unlockedNights(progress) : NIGHT_COUNT,
        stars: progress.stars,
        medals: progress.medal,
        scores: progress.score,
        thresholds: pickDay ? null : medalsFor(worldFor(s.pick(), 0)),
        level: lv.level,
        into: lv.into,
        need: lv.need,
        isHost: room.isHost,
        canStart: !!room.canStart,
        waitingFor: (room.notReady ?? []).map((p) => p.name),
        ready: !!room.me?.ready,
        hostName: room.players.get(room.host)?.name ?? 'the host',
        inviteable: !!ow?.ui?.showInvite && room.kind === 'private',
        seats: players.map((p) => ({ id: p.id, name: p.name, me: p.id === room.me.id, host: p.id === room.host, ready: !!p.ready, avatar: avatars.get(p.id) ?? null })),
      });
      players.forEach((p) => fetchAvatar(p.id));
      setControls(null);
    } else if (phase === 'intro') {
      if (shownPhase !== 'intro') {
        shownPhase = 'intro';
        if (dressing) setWardrobe(false);
        ui.show('intro');
        ui.intro(s.world.night, twistText(s.world.night));
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
        if (lastRec?.roundId !== s.roundId) onResults();
        const mineRec = lastRec?.roundId === s.roundId ? lastRec : null;
        ui.results({ ...r, board: r.day === today() ? raidBoard.top : null, nightName: s.world.night.name, rec: mineRec?.rec ?? null, level: mineRec?.level ?? null, unlocked: mineRec?.unlocked ?? [], goals: mineRec?.goals ?? [], isHost: room.isHost, next: r.night < NIGHT_COUNT, hostName: room.players.get(room.host)?.name ?? 'the host' });
        if (r.score?.medal === 3) view.addTrauma(0.25);
      }
      if (r) vm = { ...s, burrow: { wedges: s.data.it.filter((i) => i.home && i.k === 'w').length, wheel: s.data.it.some((i) => i.home && i.k === 'W'), mice: r.rows.map((row) => ({ seat: row.seat, tail: row.tail, g: row.look?.g ?? 0, look: row.look })) } };
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

  function simSounds(events, sim = simGame.sim) {
    for (const e of events) {
      if (e.type === 'ring') {
        const r = e.ring;
        if (r.kind === 'small' || r.kind === 'big') audio.play('squeak', { big: r.kind === 'big', far: 0.3 });
        else if (['creak', 'crumbs', 'pan', 'rumble'].includes(r.kind)) audio.play(r.kind);
        else if (r.kind === 'chime') audio.play('chime');
        else if (r.kind === 'snore') audio.play('snore');
      } else if (e.type === 'crumb') {
        const m = sim.mice.findIndex((x) => x.id === e.id);
        const c = sim.world.crumbs[e.i];
        if (m === simFocus && c) {
          const mult = chainMult(e.ch);
          audio.play('crumb', { chain: e.ch, mult });
          view.crumbPop(c[0], c[1], mult);
          view.project(c[0], 0.35, c[1], proj);
          if (proj.on) ui.pop(proj.x, proj.y, `+${CRUMB.pts * mult}`, mult >= 5 ? 'x5' : mult >= 3 ? 'x3' : '');
        } else if (c) view.crumbPop(c[0], c[1], 1, 0xd8b98a);
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
