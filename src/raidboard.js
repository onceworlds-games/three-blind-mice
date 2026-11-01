// Today's Daily Raid board from the game's shared list ('raid' in onceworlds.json): entries are { value: { d, s, n }, by,
// at } pushed by players' pages, so anything odd is dropped. One line per player (their best today), best first.

export const RAID_MAX = 60000;

export function raidTop(list, day, meId = '', limit = 10) {
  const best = new Map();
  for (const e of Array.isArray(list) ? list : []) {
    const v = e?.value;
    const id = e?.by?.id;
    if (!v || typeof v !== 'object' || v.d !== day || typeof v.s !== 'number' || !Number.isFinite(v.s) || v.s < 0 || v.s > RAID_MAX) continue;
    if (typeof id !== 'string' || !id) continue;
    const score = Math.round(v.s);
    if ((best.get(id)?.score ?? -1) >= score) continue;
    const name = typeof e.by.name === 'string' && e.by.name.trim() ? e.by.name.trim().slice(0, 24) : 'Mouse';
    best.set(id, { name, score, me: id === meId });
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}
