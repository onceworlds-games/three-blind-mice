// Every sound is a ring of light. A ring grows from where the sound was made, eased out, and anything it reaches can hear it.

export const RINGS = {
  small: { r: 6, dur: 0.5, heard: true },
  big: { r: 13, dur: 0.9, heard: true },
  creak: { r: 3, dur: 0.35, heard: true },
  crumbs: { r: 2.5, dur: 0.3, heard: true },
  pan: { r: 4.5, dur: 0.4, heard: true },
  snap: { r: 12, dur: 0.8, heard: true },
  rumble: { r: 2.5, dur: 0.35, heard: true },
  bump: { r: 1.2, dur: 0.25, heard: false },
  step: { r: 2.4, dur: 0.45, heard: false },
  purr: { r: 1.6, dur: 0.6, heard: false },
  thud: { r: 4.5, dur: 0.45, heard: false },
  chime: { r: 40, dur: 2.4, heard: false },
  snore: { r: 10, dur: 1.2, heard: false },
  midnight: { r: 60, dur: 2.6, heard: false },
};

export const MAX_RINGS = 12;

// The front's radius at time t after it began (0 before, r after it's done).
export function ringRadius(kind, age) {
  const def = RINGS[kind];
  if (!def || age <= 0) return 0;
  const u = Math.min(1, age / def.dur);
  return def.r * (1 - (1 - u) * (1 - u));
}

// How long after it began the front reaches distance d, or Infinity if it never does.
export function ringReachTime(kind, d) {
  const def = RINGS[kind];
  if (!def || d > def.r) return Infinity;
  return def.dur * (1 - Math.sqrt(Math.max(0, 1 - d / def.r)));
}

// Is the night's masking sound (the clock's chime, the farmer's snore) playing at night time t (seconds from the start)?
export function masked(night, t) {
  for (const m of [night.chime, night.snore]) {
    if (!m) continue;
    const at = m.at ?? 0;
    if (t < at) continue;
    if ((t - at) % m.every < m.dur) return true;
  }
  return false;
}

// The masking sounds that begin between t0 and t1: [{ kind, t }].
export function maskingBetween(night, t0, t1) {
  const out = [];
  if (night.chime) {
    const { every, at = 0 } = night.chime;
    for (let k = Math.max(0, Math.ceil((t0 - at) / every)); at + k * every < t1; k++) if (at + k * every >= t0) out.push({ kind: 'chime', t: at + k * every });
  }
  if (night.snore) {
    const { every, at = 0 } = night.snore;
    for (let k = Math.max(0, Math.ceil((t0 - at) / every)); at + k * every < t1; k++) if (at + k * every >= t0) out.push({ kind: 'snore', t: at + k * every });
  }
  return out;
}

// Rings a hunter at (x, z) hears between t0 and t1 (exclusive, inclusive): the front reached it in that window.
export function heardBetween(rings, x, z, t0, t1, self = '') {
  const out = [];
  for (const ring of rings) {
    const def = RINGS[ring.kind];
    if (!def?.heard || ring.muffled || (self && ring.src === self)) continue;
    const d = Math.hypot(ring.x - x, ring.z - z);
    const at = ring.t + ringReachTime(ring.kind, d);
    if (at > t0 && at <= t1) out.push(ring);
  }
  return out;
}
