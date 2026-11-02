// A night's score: the cheese, the crumbs and their chains, and the style bonuses that turn a night into something to
// master (tails, unseen, quiet, close shaves, every crumb, speed), with a bronze, silver or gold medal. Pure: every page
// works it out from the same record, so everyone sees the same score.

import { crumbMax } from './crumbs.js';

export const SCORE = {
  wedge: 500,
  gold: 1500,
  wheel: 1500,
  tails: 600,
  unseen: 800,
  quiet: 400,
  shave: 100,
  shaveMax: 8,
  sweep: 500,
  speed: 1000,
};

export const MEDALS = ['', 'Bronze', 'Silver', 'Gold'];

const itemPts = (i) => (i.k === 'W' ? SCORE.wheel : i.gd || i.gold ? SCORE.gold : SCORE.wedge);
const round50 = (v) => Math.round(v / 50) * 50;

// Does this night have floor that makes noise? (Quiet feet counts only where there is some.)
const noisyCache = new WeakMap();
export function noisy(world) {
  if (!noisyCache.has(world)) {
    let n = false;
    for (let z = 0; z < world.D && !n; z++) for (let x = 0; x < world.W && !n; x++) if (world.info(x, z).noise) n = true;
    noisyCache.set(world, n);
  }
  return noisyCache.get(world);
}

// Every style bonus this night can give (not counting close shaves).
export const bonusMax = (world) => SCORE.tails + SCORE.unseen + (noisy(world) ? SCORE.quiet : 0) + SCORE.speed + (world.crumbs.length ? SCORE.sweep : 0);

// What a medal takes on this night: [bronze, silver, gold]. Bronze: most of the cheese home. Silver: all of it, some
// chains and most of the easy bonuses (a careful autopilot lands here). Gold: nine tenths of a perfect night (every crumb
// in long chains, every bonus at par), or close shaves to make up the gap: a stretch even for a mouse that knows the night.
export function medalsFor(world) {
  const cheese = world.items.reduce((s, i) => s + itemPts(i), 0);
  const cm = crumbMax(world.crumbs.length);
  const b = bonusMax(world);
  return [round50(cheese * 0.6), round50(cheese + cm * 0.35 + b * 0.6), round50((cheese + cm + b) * 0.9)];
}

export const medalOf = (total, m) => (total >= m[2] ? 3 : total >= m[1] ? 2 : total >= m[0] ? 1 : 0);

// The speed bonus: all of it at par or faster, none at twice par.
export function speedBonus(time, par) {
  if (!(par > 0)) return 0;
  const u = Math.max(0, Math.min(1, (2 * par - time) / par));
  return Math.round((u * SCORE.speed) / 10) * 10;
}

// The night's score from its record. time: seconds the night took. Returns { total, lines, medal, medals, ... }.
// Bonuses count only when something came home; a night with nothing home scores its crumbs.
export function scoreNight(data, world, time) {
  const mice = Object.values(data.mice);
  const home = data.it.filter((i) => i.home);
  const counts = home.length > 0;
  const all = home.length === data.it.length && data.it.length > 0;
  const crumbN = mice.reduce((s, m) => s + (m.cr ?? 0), 0);
  const crumbPts = mice.reduce((s, m) => s + (m.pt ?? 0), 0);
  const chain = mice.reduce((s, m) => Math.max(s, m.bc ?? 0), 0);
  const shaves = mice.reduce((s, m) => s + (m.cs ?? 0), 0);
  const lines = [
    { id: 'cheese', label: 'Cheese', n: home.length, of: data.it.length, pts: home.reduce((s, i) => s + itemPts(i), 0) },
    { id: 'crumbs', label: 'Crumbs', n: crumbN, of: data.cr.length, chain, pts: crumbPts },
  ];
  const bonus = (id, label, ok, pts) => {
    if (counts && ok && pts > 0) lines.push({ id, label, pts, bonus: true });
  };
  bonus('tails', 'Tails on', mice.length > 0 && mice.every((m) => m.tail === 1), SCORE.tails);
  bonus('unseen', 'Unseen', mice.every((m) => !m.sp), SCORE.unseen);
  bonus('quiet', 'Quiet feet', noisy(world) && mice.every((m) => !m.nz), SCORE.quiet);
  bonus('shaves', shaves === 1 ? 'Close shave' : `Close shaves ×${Math.min(shaves, SCORE.shaveMax)}`, shaves > 0, Math.min(shaves, SCORE.shaveMax) * SCORE.shave);
  bonus('sweep', 'Every crumb', data.cr.length > 0 && crumbN >= data.cr.length, SCORE.sweep);
  bonus('speed', 'Quick paws', all, speedBonus(time, world.night.par ?? 0));
  const total = lines.reduce((s, l) => s + l.pts, 0);
  const medals = medalsFor(world);
  return { total, lines, medal: counts ? medalOf(total, medals) : 0, medals, counts, all, crumbs: crumbN, chain, shaves };
}
