// The player's progress (ow.save 'progress'): stars, best times and fewest squeaks per night, glasses, hints seen.

import { NIGHT_COUNT } from './core/levels.js';
import { starCount } from './core/night.js';

const KEY = 'progress';
const fresh = () => ({ v: 1, stars: Array(NIGHT_COUNT).fill(0), best: Array(NIGHT_COUNT).fill(0), fewest: Array(NIGHT_COUNT).fill(0), glasses: 0, hints: {} });

export function cleanProgress(raw) {
  const p = fresh();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return p;
  const nums = (a, lo, hi) => (Array.isArray(a) ? a.slice(0, NIGHT_COUNT).map((v) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : 0)) : []);
  nums(raw.stars, 0, 3).forEach((v, i) => (p.stars[i] = Math.floor(v)));
  nums(raw.best, 0, 3600).forEach((v, i) => (p.best[i] = v));
  nums(raw.fewest, 0, 9999).forEach((v, i) => (p.fewest[i] = Math.floor(v)));
  p.glasses = Number.isInteger(raw.glasses) && raw.glasses >= 0 && raw.glasses < 7 ? raw.glasses : 0;
  if (raw.hints && typeof raw.hints === 'object') for (const [k, v] of Object.entries(raw.hints).slice(0, 40)) if (typeof k === 'string' && k.length < 24 && v) p.hints[k] = 1;
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
    if (p.best[i] && (!into.best[i] || p.best[i] < into.best[i])) into.best[i] = p.best[i];
    if (p.fewest[i] && (!into.fewest[i] || p.fewest[i] < into.fewest[i])) into.fewest[i] = p.fewest[i];
  }
  if (!into.glasses) into.glasses = p.glasses;
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

// Night N+1 opens when night N has a star.
export function unlockedNights(p) {
  let n = 1;
  while (n < NIGHT_COUNT && p.stars[n - 1] > 0) n++;
  return n;
}

// A night's result into the progress: returns the stars this night earned.
export function recordNight(p, r, squeaks) {
  const i = r.night - 1;
  if (i < 0 || i >= NIGHT_COUNT) return 0;
  const got = starCount(r.stars);
  p.stars[i] = Math.max(p.stars[i], got);
  if (r.stars.all) {
    if (!p.best[i] || r.time < p.best[i]) p.best[i] = Math.round(r.time * 10) / 10;
    if (!p.fewest[i] || squeaks < p.fewest[i]) p.fewest[i] = squeaks;
  }
  return got;
}
