// Hints: 2-5 words, each shown once to a player (saved), one at a time, gone when done or after a few seconds.

export const HINTS = {
  squeak: 'Squeak to see',
  big: 'Hold for a big one',
  grab: 'Grab the cheese',
  home: 'Take it home',
  light: 'Stay out of her light',
  cover: 'Hide under things',
  drop: 'Drop it and run',
  creak: 'Creaky boards',
  trap: 'Square ping: trap',
  cat: "Don't wake the cat",
  wheel: 'Push it home',
  decoy: 'Lure her away',
  chime: 'Move on the chime',
  rest: 'Wait in the hole',
};
const LONG = { squeak: 9, home: 6, rest: 5 };

export function createHints(progress, save) {
  const h = { current: '', id: '', left: 0 };
  const queue = [];
  h.show = (id) => {
    if (!HINTS[id] || progress.hints[id] || h.id === id || queue.includes(id)) return;
    queue.push(id);
  };
  h.done = (id) => {
    if (!progress.hints[id]) {
      progress.hints[id] = 1;
      save();
    }
    const qi = queue.indexOf(id);
    if (qi >= 0) queue.splice(qi, 1);
    if (h.id === id) h.left = Math.min(h.left, 0.4);
  };
  h.tick = (dt) => {
    if (h.id) {
      h.left -= dt;
      if (h.left <= 0) {
        progress.hints[h.id] = 1;
        save();
        h.id = '';
        h.current = '';
        h.left = 0.8;
      }
      return;
    }
    if (h.left > 0) {
      h.left -= dt;
      return;
    }
    const id = queue.shift();
    if (!id) return;
    h.id = id;
    h.current = HINTS[id];
    h.left = LONG[id] ?? 4;
  };
  return h;
}
