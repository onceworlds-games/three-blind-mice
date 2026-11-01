// The player's progress (ow.save 'progress'): stars, medals and best scores per night, mouse XP and level, the look they
// wear, today's goals and the Daily Raid, the streak of days played, lifetime totals, hints seen. Version 2; a version 1
// save (stars and glasses) carries over, its stars worth XP.

import { NIGHT_COUNT } from './core/levels.js';
import { starCount } from './core/night.js';
import { cleanLook, unlockedAt } from './looks.js';
import { prevDay, validDay, weekOf } from './core/daily.js';
import { GOALS, goalsFor, cleanGoals, WEEKLY, weeklyFor, WEEKLY_XP } from './goals.js';

const KEY = 'progress';
const TOTALS = ['crumbs', 'shaves', 'nights', 'unseen', 'raids', 'golds', 'goals'];
const fresh = () => ({
  v: 2,
  stars: Array(NIGHT_COUNT).fill(0),
  best: Array(NIGHT_COUNT).fill(0),
  fewest: Array(NIGHT_COUNT).fill(0),
  score: Array(NIGHT_COUNT).fill(0),
  medal: Array(NIGHT_COUNT).fill(0),
  xp: 0,
  look: { g: 0, h: 0, f: 0, t: 0 },
  daily: { day: 0, goals: [], raid: 0, all: 0 },
  weekly: { week: 0, id: '', need: 0, have: 0, done: 0 },
  streak: { n: 0, last: 0, best: 0 },
  totals: Object.fromEntries(TOTALS.map((k) => [k, 0])),
  hints: {},
});

const isNum = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const nums = (a, lo, hi) => (Array.isArray(a) ? a.slice(0, NIGHT_COUNT).map((v) => (isNum(v, lo, hi) ? v : 0)) : []);

// A look the player may wear at this level: anything not unlocked yet goes back to the first.
export function wearable(look, level) {
  const l = cleanLook(look);
  for (const [k, kind] of [['g', 'glasses'], ['h', 'hat'], ['f', 'fur'], ['t', 'trail']]) if (!unlockedAt(kind, l[k], level)) l[k] = 0;
  return l;
}

export function cleanProgress(raw) {
  const p = fresh();
  if (!raw || typeof raw !== 'object' || (raw.v !== 1 && raw.v !== 2)) return p;
  nums(raw.stars, 0, 3).forEach((v, i) => (p.stars[i] = Math.floor(v)));
  nums(raw.best, 0, 3600).forEach((v, i) => (p.best[i] = v));
  nums(raw.fewest, 0, 9999).forEach((v, i) => (p.fewest[i] = Math.floor(v)));
  if (raw.hints && typeof raw.hints === 'object') for (const [k, v] of Object.entries(raw.hints).slice(0, 40)) if (typeof k === 'string' && k.length < 24 && v) p.hints[k] = 1;
  if (raw.v === 1) {
    // The first build's stars become XP; its glasses carry over when the level they come to has them.
    p.xp = totalStars(p) * 150;
    p.look = wearable({ g: raw.glasses }, levelOf(p.xp).level);
    return p;
  }
  nums(raw.score, 0, 99999).forEach((v, i) => (p.score[i] = Math.floor(v)));
  nums(raw.medal, 0, 3).forEach((v, i) => (p.medal[i] = Math.floor(v)));
  p.xp = isNum(raw.xp, 0, 1e7) ? Math.floor(raw.xp) : 0;
  p.look = wearable(raw.look, levelOf(p.xp).level);
  const d = raw.daily && typeof raw.daily === 'object' ? raw.daily : {};
  if (validDay(d.day)) {
    p.daily.day = d.day;
    p.daily.goals = cleanGoals(d.goals);
    p.daily.raid = isNum(d.raid, 0, 99999) ? Math.floor(d.raid) : 0;
    p.daily.all = d.all ? 1 : 0;
  }
  const w = raw.weekly && typeof raw.weekly === 'object' ? raw.weekly : {};
  if (validDay(w.week) && WEEKLY[w.id]) {
    const need = WEEKLY[w.id].need;
    p.weekly = { week: w.week, id: w.id, need, have: isNum(w.have, 0, need) ? Math.floor(w.have) : 0, done: 0 };
    p.weekly.done = w.done && p.weekly.have >= need ? 1 : 0;
  }
  const s = raw.streak && typeof raw.streak === 'object' ? raw.streak : {};
  p.streak.n = isNum(s.n, 0, 9999) ? Math.floor(s.n) : 0;
  p.streak.last = validDay(s.last) ? s.last : 0;
  p.streak.best = isNum(s.best, 0, 9999) ? Math.max(Math.floor(s.best), p.streak.n) : p.streak.n;
  const t = raw.totals && typeof raw.totals === 'object' ? raw.totals : {};
  for (const k of TOTALS) p.totals[k] = isNum(t[k], 0, 1e8) ? Math.floor(t[k]) : 0;
  return p;
}

let memory = null;
export async function loadProgress(ow) {
  if (!ow?.save?.get) return (memory ??= fresh());
  try {
    return cleanProgress(await ow.save.get(KEY));
  } catch {
    return fresh();
  }
}

// The saved progress arriving after the page has already played: keep the best of both.
export function mergeProgress(into, p) {
  for (let i = 0; i < NIGHT_COUNT; i++) {
    into.stars[i] = Math.max(into.stars[i], p.stars[i]);
    into.score[i] = Math.max(into.score[i], p.score[i]);
    into.medal[i] = Math.max(into.medal[i], p.medal[i]);
    if (p.best[i] && (!into.best[i] || p.best[i] < into.best[i])) into.best[i] = p.best[i];
    if (p.fewest[i] && (!into.fewest[i] || p.fewest[i] < into.fewest[i])) into.fewest[i] = p.fewest[i];
  }
  into.xp = Math.max(into.xp, p.xp);
  if (!into.look.g && !into.look.h && !into.look.f && !into.look.t) into.look = { ...p.look };
  if (p.daily.day > into.daily.day) into.daily = structuredClone(p.daily);
  else if (p.daily.day === into.daily.day) {
    into.daily.raid = Math.max(into.daily.raid, p.daily.raid);
    into.daily.all = into.daily.all || p.daily.all;
    into.daily.goals.forEach((g, i) => {
      const o = p.daily.goals[i];
      if (o && o.id === g.id) {
        g.have = Math.max(g.have, o.have);
        g.done = g.done || o.done;
      }
    });
  }
  if (p.weekly.week > into.weekly.week) into.weekly = { ...p.weekly };
  else if (p.weekly.week === into.weekly.week && p.weekly.id === into.weekly.id) {
    into.weekly.have = Math.max(into.weekly.have, p.weekly.have);
    into.weekly.done = into.weekly.done || p.weekly.done;
  }
  if (p.streak.last > into.streak.last) into.streak = { ...p.streak };
  into.streak.best = Math.max(into.streak.best, p.streak.best);
  for (const k of TOTALS) into.totals[k] = Math.max(into.totals[k], p.totals[k]);
  for (const k of Object.keys(p.hints)) into.hints[k] = 1;
  return into;
}

export function saveProgress(ow, p) {
  memory = p;
  try {
    ow?.save?.set?.(KEY, p)?.catch?.(() => {});
  } catch {
    /* saving is best effort */
  }
}

export const totalStars = (p) => p.stars.reduce((a, b) => a + b, 0);
export const medalCount = (p, m) => p.medal.filter((v) => v >= m).length;

// Night N+1 opens when night N has a star.
export function unlockedNights(p) {
  let n = 1;
  while (n < NIGHT_COUNT && p.stars[n - 1] > 0) n++;
  return n;
}

// ---------------------------------------------------------------- mouse level

// XP from level L to L+1: 200 for the first, 60 more each level after.
export const xpNeed = (level) => 200 + 60 * (level - 1);
export const MAX_LEVEL = 60;

export function levelOf(xp) {
  let level = 1;
  let left = Math.max(0, Math.floor(xp) || 0);
  while (level < MAX_LEVEL && left >= xpNeed(level)) {
    left -= xpNeed(level);
    level++;
  }
  return { level, into: left, need: xpNeed(level) };
}

// A night's XP: a tenth of the score, something for getting cheese home, more for a medal, half again on the Daily Raid.
export function nightXp(score, { raid = false } = {}) {
  const base = Math.round(score.total / 10) + (score.counts ? 50 : 10) + [0, 20, 40, 80][score.medal ?? 0];
  return Math.round(base * (raid ? 1.5 : 1));
}

// ---------------------------------------------------------------- days: goals and the streak

// Today's goals, fresh when the day changed.
export function ensureDay(p, day) {
  if (!validDay(day)) return false;
  const week = weekOf(day);
  let changed = false;
  if (p.weekly.week !== week) {
    p.weekly = { week, ...weeklyFor(week), have: 0, done: 0 };
    changed = true;
  }
  if (p.daily.day === day) return changed;
  p.daily = { day, goals: goalsFor(day, unlockedNights(p)).map((g) => ({ id: g.id, need: g.need, have: 0, done: 0 })), raid: 0, all: 0 };
  return true;
}

// A day with a night played keeps the streak going (yesterday's streak + 1), else it starts again at 1.
export function touchStreak(p, day) {
  if (!validDay(day) || p.streak.last === day) return false;
  p.streak.n = p.streak.last === prevDay(day) ? p.streak.n + 1 : 1;
  p.streak.last = day;
  p.streak.best = Math.max(p.streak.best, p.streak.n);
  return true;
}

// The streak as it stands today: gone when the last day played was before yesterday.
export const liveStreak = (p, day) => (p.streak.last === day || p.streak.last === prevDay(day) ? p.streak.n : 0);

// A goal's XP: 150, and 10% more for each day of the streak after the first (up to half again).
export const goalXp = (streak) => Math.round(150 * (1 + Math.min(5, Math.max(0, streak - 1)) * 0.1));

export function goalProgress(id, r) {
  const g = GOALS[id];
  return g ? Math.max(0, Math.floor(g.track(r) || 0)) : 0;
}

// ---------------------------------------------------------------- a night into the progress

// r: the session's result (with r.score); squeaks: this page's; day: today. Returns what changed, for the results screen.
export function recordNight(p, r, squeaks, day = 0) {
  const i = r.night - 1;
  const out = { stars: 0, newBest: false, firstScore: false, medalUp: 0, xp: 0, levelFrom: levelOf(p.xp).level, levelTo: 0, goals: [], allGoals: false, weekly: false, raidBest: false, streakUp: false };
  if (i < 0 || i >= NIGHT_COUNT) return out;
  const sc = r.score;
  const raid = !!r.day;
  if (day) ensureDay(p, day);
  if (!raid) {
    const got = starCount(r.stars);
    out.stars = got;
    p.stars[i] = Math.max(p.stars[i], got);
    if (r.stars.all) {
      if (!p.best[i] || r.time < p.best[i]) p.best[i] = Math.round(r.time * 10) / 10;
      if (!p.fewest[i] || squeaks < p.fewest[i]) p.fewest[i] = squeaks;
    }
    if (sc && sc.total > p.score[i]) {
      out.newBest = p.score[i] > 0;
      out.firstScore = p.score[i] === 0;
      p.score[i] = sc.total;
    }
    if (sc && sc.medal > p.medal[i]) {
      out.medalUp = sc.medal;
      p.medal[i] = sc.medal;
    }
  } else if (sc && r.day === p.daily.day && sc.total > p.daily.raid) {
    out.raidBest = true;
    p.daily.raid = sc.total;
  }
  const mine = r.mine ?? {};
  p.totals.crumbs += mine.crumbs ?? 0;
  p.totals.shaves += mine.shaves ?? 0;
  if (sc?.counts) p.totals.nights += 1;
  if (sc?.lines?.some((l) => l.id === 'unseen')) p.totals.unseen += 1;
  if (raid) p.totals.raids += 1;
  if (sc?.medal === 3) p.totals.golds += 1;
  if (sc) out.xp += nightXp(sc, { raid });
  if (day) {
    out.streakUp = touchStreak(p, day);
    for (const g of p.daily.goals) {
      if (g.done) continue;
      const add = goalProgress(g.id, r);
      if (!add) continue;
      g.have = Math.min(g.need, g.have + add);
      if (g.have >= g.need) {
        g.done = 1;
        p.totals.goals += 1;
        out.goals.push(g.id);
        out.xp += goalXp(liveStreak(p, day));
      }
    }
    if (!p.daily.all && p.daily.goals.length && p.daily.goals.every((g) => g.done)) {
      p.daily.all = 1;
      out.allGoals = true;
      out.xp += 250;
    }
    const w = p.weekly;
    if (w.id && !w.done) {
      const add = Math.max(0, Math.floor(WEEKLY[w.id]?.track(r) || 0));
      if (add) {
        w.have = Math.min(w.need, w.have + add);
        if (w.have >= w.need) {
          w.done = 1;
          out.weekly = true;
          out.xp += WEEKLY_XP;
        }
      }
    }
  }
  p.xp += out.xp;
  out.levelTo = levelOf(p.xp).level;
  return out;
}
