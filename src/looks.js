// What a mouse can wear: glasses, hats, fur and a sparkle on its squeaks, each unlocked at a mouse level. Pure data: the
// page, the renderer, the save and the tests share it.

export const GLASSES = [
  { id: 0, name: 'Round' },
  { id: 1, name: 'Cat-eye' },
  { id: 2, name: 'Aviators' },
  { id: 3, name: 'Stars' },
  { id: 4, name: 'Monocle' },
  { id: 5, name: 'Hearts' },
  { id: 6, name: 'Gold Rounds' },
];

export const HATS = [
  { id: 0, name: 'No hat' },
  { id: 1, name: 'Beanie' },
  { id: 2, name: 'Daisy' },
  { id: 3, name: 'Acorn Cap' },
  { id: 4, name: 'Top Hat' },
  { id: 5, name: 'Chef' },
  { id: 6, name: 'Party Hat' },
  { id: 7, name: 'Stetson' },
  { id: 8, name: 'Tricorn' },
  { id: 9, name: 'Wizard' },
  { id: 10, name: 'Crown' },
];

export const FURS = [
  { id: 0, name: 'Grey', color: 0x8c828c, belly: 0xc4b6bc },
  { id: 1, name: 'Brown', color: 0x8a6446, belly: 0xd2b090 },
  { id: 2, name: 'Snow', color: 0xe6e0d6, belly: 0xfaf6ee },
  { id: 3, name: 'Soot', color: 0x3a343c, belly: 0x6a5e66 },
  { id: 4, name: 'Ginger', color: 0xc47a3e, belly: 0xeec894 },
  { id: 5, name: 'Golden', color: 0xd4aa58, belly: 0xf4e0a8 },
  { id: 6, name: 'Blue', color: 0x7a86a8, belly: 0xb8c0d8 },
  { id: 7, name: 'Rose', color: 0xc89aa6, belly: 0xf0d2d8 },
];

export const TRAILS = [
  { id: 0, name: 'Plain' },
  { id: 1, name: 'Sparks' },
  { id: 2, name: 'Stars' },
  { id: 3, name: 'Hearts' },
  { id: 4, name: 'Notes' },
  { id: 5, name: 'Petals' },
];

// One thing at every level (the first ones come quickly).
export const UNLOCKS = [
  { level: 2, kind: 'hat', id: 1 },
  { level: 3, kind: 'fur', id: 1 },
  { level: 4, kind: 'glasses', id: 1 },
  { level: 5, kind: 'trail', id: 1 },
  { level: 6, kind: 'hat', id: 2 },
  { level: 7, kind: 'fur', id: 2 },
  { level: 8, kind: 'glasses', id: 2 },
  { level: 9, kind: 'hat', id: 3 },
  { level: 10, kind: 'trail', id: 2 },
  { level: 11, kind: 'fur', id: 3 },
  { level: 12, kind: 'hat', id: 4 },
  { level: 13, kind: 'glasses', id: 3 },
  { level: 14, kind: 'fur', id: 4 },
  { level: 15, kind: 'hat', id: 5 },
  { level: 16, kind: 'trail', id: 3 },
  { level: 17, kind: 'glasses', id: 4 },
  { level: 18, kind: 'hat', id: 6 },
  { level: 19, kind: 'fur', id: 5 },
  { level: 20, kind: 'hat', id: 7 },
  { level: 22, kind: 'trail', id: 4 },
  { level: 24, kind: 'glasses', id: 5 },
  { level: 26, kind: 'hat', id: 8 },
  { level: 28, kind: 'fur', id: 6 },
  { level: 30, kind: 'trail', id: 5 },
  { level: 33, kind: 'hat', id: 9 },
  { level: 36, kind: 'fur', id: 7 },
  { level: 40, kind: 'glasses', id: 6 },
  { level: 45, kind: 'hat', id: 10 },
];

export const KINDS = { glasses: GLASSES, hat: HATS, fur: FURS, trail: TRAILS };

// Is this look unlocked at this level? (Each list's first entry always is.)
export function unlockedAt(kind, id, level) {
  if (id === 0) return true;
  const u = UNLOCKS.find((x) => x.kind === kind && x.id === id);
  return !!u && level >= u.level;
}

export const unlocksAt = (level) => UNLOCKS.filter((u) => u.level === level);
export const nextUnlock = (level) => UNLOCKS.find((u) => u.level > level) ?? null;
export const lookName = (kind, id) => KINDS[kind]?.[id]?.name ?? '';

// A look as four small numbers, checked (for saves and presence).
export function cleanLook(raw) {
  const n = (v, max) => (Number.isInteger(v) && v >= 0 && v < max ? v : 0);
  const r = raw && typeof raw === 'object' ? raw : {};
  return { g: n(r.g, GLASSES.length), h: n(r.h, HATS.length), f: n(r.f, FURS.length), t: n(r.t, TRAILS.length) };
}
