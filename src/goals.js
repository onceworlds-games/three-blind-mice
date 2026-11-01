// Daily goals: three a day (an easy one, a middling one, a hard one), picked by the date from what the player has
// unlocked. Each counts something from a night's result. Pure data and functions: the page, the save and the tests share it.

import { createRng, hashSeed } from './core/rng.js';

const has = (r, id) => !!r.score?.lines?.some((l) => l.id === id);

// id: { tier, need, label (short, for the panel), track(result) -> how much this night adds, min: night unlocked first }
export const GOALS = {
  crumbs40: { tier: 0, need: 40, label: 'Eat 40 crumbs', track: (r) => r.mine?.crumbs },
  cheese3: { tier: 0, need: 3, label: 'Bring 3 cheeses home', track: (r) => r.mine?.home },
  tails2: { tier: 0, need: 2, label: 'Keep your tail twice', track: (r) => (r.score?.counts && r.mine?.tail ? 1 : 0) },
  raid: { tier: 0, need: 1, label: 'Play the Daily Raid', track: (r) => (r.day ? 1 : 0) },
  chain5: { tier: 1, need: 1, label: 'Chain ×5', track: (r) => ((r.mine?.chain ?? 0) >= 5 ? 1 : 0) },
  crumbs80: { tier: 1, need: 80, label: 'Eat 80 crumbs', track: (r) => r.mine?.crumbs },
  shaves2: { tier: 1, need: 2, label: '2 close shaves', track: (r) => r.mine?.shaves },
  quiet: { tier: 1, need: 1, label: 'Quiet feet on a creaky night', min: 3, track: (r) => (has(r, 'quiet') ? 1 : 0) },
  silver2: { tier: 1, need: 2, label: 'Silver or better twice', track: (r) => ((r.score?.medal ?? 0) >= 2 ? 1 : 0) },
  unseen: { tier: 2, need: 1, label: 'A night unseen', track: (r) => (has(r, 'unseen') ? 1 : 0) },
  gold: { tier: 2, need: 1, label: 'Win a gold medal', track: (r) => (r.score?.medal === 3 ? 1 : 0) },
  chain10: { tier: 2, need: 1, label: 'Chain 10 crumbs', track: (r) => ((r.mine?.chain ?? 0) >= 10 ? 1 : 0) },
  sweep: { tier: 2, need: 1, label: 'Every crumb in a night', track: (r) => (has(r, 'sweep') ? 1 : 0) },
  wheel: { tier: 2, need: 1, label: 'Roll a wheel home', min: 6, track: (r) => (r.mine?.wheel ? 1 : 0) },
  quick: { tier: 2, need: 1, label: 'Full Quick paws bonus', track: (r) => ((r.score?.lines?.find((l) => l.id === 'speed')?.pts ?? 0) >= 1000 ? 1 : 0) },
};

export const goalLabel = (id) => GOALS[id]?.label ?? '';

// The day's three goals for a player with `unlocked` nights open.
export function goalsFor(day, unlocked = 1) {
  const rng = createRng(hashSeed(`goals:${day}`));
  const out = [];
  for (const tier of [0, 1, 2]) {
    const pool = Object.entries(GOALS).filter(([, g]) => g.tier === tier && (g.min ?? 1) <= unlocked);
    const [id, g] = pool[rng.int(pool.length)];
    out.push({ id, need: g.need });
  }
  return out;
}

export function cleanGoals(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const g of raw.slice(0, 3)) {
    if (!g || typeof g !== 'object' || !GOALS[g.id]) continue;
    const need = GOALS[g.id].need;
    const have = typeof g.have === 'number' && Number.isFinite(g.have) ? Math.max(0, Math.min(need, Math.floor(g.have))) : 0;
    out.push({ id: g.id, need, have, done: g.done && have >= need ? 1 : 0 });
  }
  return out;
}
