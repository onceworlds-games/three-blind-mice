// Sound is the game: every squeak, echo, creak, slipper and knife is synthesized here, and a music box plays Three Blind
// Mice (public domain) from a small step sequencer: whole and soft in menus, in fragments while you sneak, minor and slow
// with a heartbeat when she's close. Nothing here throws into the game.

const MIDI = (n) => 440 * Math.pow(2, (n - 69) / 12);

// The tune in eighth notes (6/8): [note, eighths]. 0 is a rest.
const E4 = 64, D4 = 62, C4 = 60, G4 = 67, F4 = 65, C5 = 72, B4 = 71, A4 = 69;
const TUNE = [
  [E4, 3], [D4, 3], [C4, 6],
  [E4, 3], [D4, 3], [C4, 6],
  [G4, 3], [F4, 2], [F4, 1], [E4, 6],
  [G4, 3], [F4, 2], [F4, 1], [E4, 6],
  [G4, 1], [C5, 2], [C5, 1], [B4, 1], [A4, 1], [B4, 1], [C5, 2], [G4, 1], [G4, 2],
  [G4, 1], [C5, 1], [C5, 1], [C5, 1], [B4, 1], [A4, 1], [B4, 1], [C5, 2], [G4, 1], [G4, 2],
  [G4, 1], [C5, 2], [C5, 1], [B4, 1], [A4, 1], [B4, 1], [C5, 2], [G4, 1], [G4, 1], [F4, 1],
  [E4, 3], [D4, 3], [C4, 6],
];
const BASS = [36, 43, 36, 43, 43, 36, 43, 36, 36, 43, 36, 43, 36, 43, 41, 43, 36, 36];
// A chain of crumbs climbs this scale.
const PENTA = [76, 79, 81, 84, 86, 88, 91, 93, 96, 98, 100, 103];
const MINOR = new Map([[64, 63], [69, 68], [71, 70], [76, 75]]);

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuf = null;
  let muted = false;
  let volume = 1;
  const a = { ready: false };

  a.start = () => {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        master = ctx.createGain();
        master.gain.value = muted ? 0 : volume;
        master.connect(comp);
        comp.connect(ctx.destination);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.8;
        sfxBus.connect(master);
        musicBus = ctx.createGain();
        musicBus.gain.value = 0.32;
        musicBus.connect(master);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        a.ready = true;
        setInterval(schedule, 40);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch {
      /* no sound on this device */
    }
  };
  a.setVolume = (v, m) => {
    volume = v ?? volume;
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : volume;
  };
  a.suspend = (on) => {
    try {
      if (!ctx) return;
      if (on) ctx.suspend();
      else ctx.resume();
    } catch {
      /* ignore */
    }
  };

  // ---------------------------------------------------------------- building blocks
  const T = () => ctx.currentTime;
  function env(g, t, attack, peak, decay, end = 0.0001) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(end, t + attack + decay);
  }
  function tone(type, f0, f1, t, dur, peak, bus = sfxBus, attack = 0.005, pan = 0) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, attack, peak, dur);
    let out = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p);
      out = p;
    }
    o.connect(g);
    out.connect(bus);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
    return o;
  }
  function noise(t, dur, peak, type = 'bandpass', f0 = 1000, f1 = f0, q = 1, bus = sfxBus, attack = 0.005) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, attack, peak, dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + attack + dur + 0.05);
  }
  function bell(f, t, dur, peak, bus = sfxBus) {
    for (const [ratio, amp] of [[1, 1], [2.76, 0.45], [5.4, 0.25], [8.93, 0.12]]) tone('sine', f * ratio, f * ratio, t, dur / Math.sqrt(ratio), peak * amp, bus, 0.003);
  }
  function box(f, t, peak, bus = musicBus, dur = 1.2) {
    tone('sine', f, f, t, dur, peak, bus, 0.003);
    tone('sine', f * 4, f * 4, t, dur * 0.25, peak * 0.22, bus, 0.002);
    tone('triangle', f * 2, f * 2, t, dur * 0.4, peak * 0.15, bus, 0.002);
  }

  // ---------------------------------------------------------------- the sounds
  const S = {
    squeak({ big = false, far = 0 } = {}) {
      const t = T();
      const v = 0.28 * (1 - far * 0.6);
      tone('triangle', 2400, 3400, t, 0.07, v);
      tone('sine', 4800, 6400, t, 0.05, v * 0.25);
      if (big) {
        tone('triangle', 2600, 3900, t + 0.11, 0.09, v);
        noise(t, 0.6, v * 0.5, 'bandpass', 600, 3200, 2);
      }
    },
    charge() {
      const t = T();
      tone('sine', 900, 2200, t, 0.4, 0.05);
    },
    echo({ delay = 0, pitch = 1, gain = 1 } = {}) {
      const t = T() + Math.max(0, delay);
      const f = 520 * pitch;
      tone('sine', f, f * 0.94, t, 0.09, 0.09 * gain);
      noise(t, 0.02, 0.05 * gain, 'bandpass', f * 3, f * 3, 6);
    },
    cheese({ delay = 0 } = {}) {
      const t = T() + delay;
      box(MIDI(84), t, 0.18, sfxBus, 0.8);
      box(MIDI(91), t + 0.1, 0.16, sfxBus, 1.0);
    },
    trapPing({ delay = 0 } = {}) {
      const t = T() + delay;
      tone('square', 330, 330, t, 0.05, 0.05);
      tone('square', 247, 247, t + 0.07, 0.05, 0.04);
    },
    bump() {
      noise(T(), 0.03, 0.08, 'highpass', 3000, 3000, 1);
    },
    patter() {
      noise(T(), 0.025, 0.035, 'bandpass', 2500, 2500, 3);
    },
    creak() {
      const t = T();
      tone('sawtooth', 110, 190, t, 0.32, 0.08, sfxBus, 0.03);
      noise(t, 0.3, 0.12, 'bandpass', 400, 1100, 12, sfxBus, 0.03);
    },
    crumbs() {
      const t = T();
      for (let i = 0; i < 4; i++) noise(t + i * 0.03, 0.03, 0.1, 'highpass', 2500 + i * 400, 2500, 1);
    },
    pan() {
      const t = T();
      for (const f of [523, 1187, 1663, 2311]) tone('sine', f, f * 0.99, t, 0.9, 0.06, sfxBus, 0.002);
    },
    rumble() {
      noise(T(), 0.45, 0.14, 'lowpass', 180, 120, 1);
    },
    slipper({ near = 1 } = {}) {
      const t = T();
      tone('sine', 85, 55, t, 0.16, 0.22 * near);
      noise(t, 0.08, 0.08 * near, 'lowpass', 500, 300, 1);
    },
    boot({ near = 1 } = {}) {
      const t = T();
      tone('sine', 70, 45, t, 0.22, 0.3 * near);
      noise(t, 0.12, 0.12 * near, 'lowpass', 700, 300, 1);
    },
    hm() {
      const t = T();
      tone('sawtooth', 190, 175, t, 0.18, 0.05, sfxBus, 0.03);
      noise(t, 0.18, 0.04, 'bandpass', 500, 500, 6, sfxBus, 0.03);
      tone('sawtooth', 175, 240, t + 0.22, 0.22, 0.06, sfxBus, 0.02);
      noise(t + 0.22, 0.22, 0.05, 'bandpass', 700, 900, 6, sfxBus, 0.02);
    },
    gasp() {
      noise(T(), 0.35, 0.16, 'bandpass', 900, 2600, 3, sfxBus, 0.05);
    },
    whoosh({ dur = 0.8 } = {}) {
      noise(T(), dur, 0.12, 'bandpass', 300, 2800, 4, sfxBus, dur * 0.8);
    },
    thunk() {
      const t = T();
      tone('sine', 160, 60, t, 0.25, 0.4);
      noise(t, 0.07, 0.3, 'lowpass', 1800, 400, 1);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 196;
      lfo.frequency.value = 22;
      lg.gain.value = 9;
      lfo.connect(lg);
      lg.connect(o.frequency);
      env(g, t + 0.02, 0.003, 0.12, 0.7);
      o.connect(g);
      g.connect(sfxBus);
      o.start(t);
      lfo.start(t);
      o.stop(t + 0.8);
      lfo.stop(t + 0.8);
    },
    boing() {
      const t = T();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(300, t);
      o.frequency.exponentialRampToValueAtTime(520, t + 0.15);
      lfo.frequency.value = 14;
      lg.gain.value = 60;
      lfo.connect(lg);
      lg.connect(o.frequency);
      env(g, t, 0.005, 0.2, 0.45);
      o.connect(g);
      g.connect(sfxBus);
      o.start(t);
      lfo.start(t);
      o.stop(t + 0.5);
      lfo.stop(t + 0.5);
      tone('sine', 1400, 300, t + 0.3, 0.5, 0.08);
    },
    bonk() {
      const t = T();
      tone('sine', 700, 500, t, 0.08, 0.25);
      tone('square', 1400, 1000, t, 0.03, 0.05);
      [1568, 1976, 2349, 2637].forEach((f, i) => tone('sine', f, f, t + 0.15 + i * 0.08, 0.25, 0.05));
    },
    snap() {
      const t = T();
      noise(t, 0.05, 0.4, 'highpass', 1500, 1500, 1);
      tone('square', 900, 200, t, 0.06, 0.12);
      tone('sine', 300, 120, t + 0.03, 0.2, 0.15);
    },
    purr({ near = 1 } = {}) {
      const t = T();
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 220;
      const g = ctx.createGain();
      const am = ctx.createOscillator();
      const ag = ctx.createGain();
      am.frequency.value = 24;
      ag.gain.value = 0.05 * near;
      g.gain.value = 0.0;
      am.connect(ag);
      ag.connect(g.gain);
      s.connect(f);
      f.connect(g);
      g.connect(sfxBus);
      s.start(t);
      am.start(t);
      s.stop(t + 1.2);
      am.stop(t + 1.2);
    },
    meow() {
      const t = T();
      tone('sawtooth', 500, 760, t, 0.18, 0.06, sfxBus, 0.04);
      tone('sawtooth', 760, 420, t + 0.18, 0.35, 0.06, sfxBus, 0.01);
      noise(t, 0.5, 0.05, 'bandpass', 900, 1400, 5, sfxBus, 0.05);
    },
    hiss() {
      noise(T(), 0.45, 0.16, 'highpass', 3500, 5000, 1, sfxBus, 0.02);
    },
    tick() {
      noise(T(), 0.015, 0.05, 'bandpass', 3500, 3500, 8);
    },
    dong({ count = 1 } = {}) {
      const t = T();
      for (let i = 0; i < count; i++) bell(110, t + i * 1.1, 4, 0.35);
    },
    chime() {
      const t = T();
      [659, 523, 587, 392].forEach((f, i) => bell(f, t + i * 0.55, 2.2, 0.1));
    },
    snore() {
      const t = T();
      noise(t, 1.0, 0.16, 'lowpass', 140, 380, 2, sfxBus, 0.5);
      tone('sawtooth', 55, 65, t, 1.0, 0.04, sfxBus, 0.5);
    },
    nibble() {
      const t = T();
      tone('sine', 900, 1500, t, 0.06, 0.2);
      noise(t + 0.03, 0.04, 0.08, 'highpass', 4000, 4000, 1);
    },
    drop() {
      tone('sine', 600, 300, T(), 0.12, 0.12);
    },
    home() {
      const t = T();
      [72, 76, 79, 84, 88].forEach((n, i) => box(MIDI(n), t + i * 0.07, 0.16, sfxBus, 0.9));
    },
    door() {
      const t = T();
      tone('sawtooth', 140, 260, t, 0.9, 0.05, sfxBus, 0.2);
      noise(t, 0.9, 0.08, 'bandpass', 500, 1300, 14, sfxBus, 0.2);
    },
    click() {
      tone('square', 1800, 1800, T(), 0.02, 0.06);
    },
    tap() {
      tone('triangle', 1500, 2100, T(), 0.05, 0.08);
    },
    star({ n = 0 } = {}) {
      const t = T();
      box(MIDI(79 + n * 5), t, 0.2, sfxBus, 1.2);
      box(MIDI(86 + n * 5), t + 0.06, 0.12, sfxBus, 1.2);
    },
    morning() {
      const t = T();
      [60, 64, 67, 72, 76, 79, 84, 88, 91, 96].forEach((n, i) => box(MIDI(n), t + i * 0.06, 0.13, sfxBus, 1.0));
    },
    dawn() {
      const t = T();
      [72, 67, 64, 60].forEach((n, i) => box(MIDI(n), t + i * 0.22, 0.13, sfxBus, 1.4));
    },
    whistle() {
      tone('sine', 2200, 500, T(), 0.5, 0.07);
    },
    // A crumb: a tiny crunch and a plink that climbs the scale with the chain.
    crumb({ chain = 1, mult = 1 } = {}) {
      const t = T();
      const n = PENTA[Math.min(PENTA.length - 1, Math.max(0, chain - 1))];
      noise(t, 0.035, 0.07, 'highpass', 3500, 5000, 1);
      tone('sine', MIDI(n), MIDI(n) * 1.01, t + 0.01, 0.16, 0.11 + mult * 0.012);
      if (mult >= 3) tone('triangle', MIDI(n + 12), MIDI(n + 12), t + 0.03, 0.12, 0.05);
      if (mult >= 5) bell(MIDI(n + 7), t + 0.05, 0.5, 0.05);
    },
    // The chain lost: a soft falling blip.
    chainEnd() {
      tone('sine', 700, 380, T(), 0.12, 0.05);
    },
    shave() {
      const t = T();
      noise(t, 0.28, 0.12, 'bandpass', 3000, 900, 2);
      tone('triangle', MIDI(84), MIDI(91), t + 0.05, 0.22, 0.1);
    },
    tally() {
      const t = T();
      tone('square', 1300, 1300, t, 0.025, 0.04);
      tone('sine', 2600, 2600, t + 0.02, 0.05, 0.05);
    },
    bonus() {
      const t = T();
      box(MIDI(84), t, 0.14, sfxBus, 0.6);
      box(MIDI(91), t + 0.07, 0.12, sfxBus, 0.6);
    },
    medal({ n = 0 } = {}) {
      const t = T();
      if (!n) return tone('sine', 300, 200, t, 0.3, 0.08);
      const base = [0, 67, 72, 79][n];
      [0, 4, 7, 12].forEach((d, i) => bell(MIDI(base + d), t + i * 0.08, 1.4, 0.07 + n * 0.015));
      noise(t, 0.6, 0.04 * n, 'highpass', 6000, 9000, 1, sfxBus, 0.01);
    },
    levelup() {
      const t = T();
      [72, 76, 79, 84].forEach((n, i) => box(MIDI(n), t + i * 0.05, 0.15, sfxBus, 0.8));
      bell(MIDI(96), t + 0.22, 1.2, 0.06);
    },
    unlock() {
      const t = T();
      noise(t, 0.4, 0.06, 'bandpass', 2000, 8000, 3);
      [79, 83, 86, 91].forEach((n, i) => bell(MIDI(n), t + 0.1 + i * 0.06, 0.9, 0.05));
    },
    goal() {
      const t = T();
      box(MIDI(79), t, 0.16, sfxBus, 0.8);
      box(MIDI(84), t + 0.1, 0.16, sfxBus, 0.8);
      box(MIDI(88), t + 0.2, 0.18, sfxBus, 1.2);
    },
    golden() {
      const t = T();
      [84, 88, 91, 96, 100].forEach((n, i) => bell(MIDI(n), t + i * 0.05, 1.0, 0.05));
    },
  };

  a.play = (name, opts) => {
    if (!ctx || muted || !S[name]) return;
    try {
      S[name](opts);
    } catch {
      /* one sound failing never stops the game */
    }
  };

  // ---------------------------------------------------------------- the music box
  let mode = 'off';
  let danger = 0;
  let step = 0;
  let nextT = 0;
  let phraseOn = true;
  let beatT = 0;
  // How far the night has come (cheese home, time gone): the band joins in as it builds.
  let build = 0;
  a.build = (u) => {
    build = Math.max(0, Math.min(1, u));
  };
  const eighth = () => (60 / 84 / 2) * (danger > 0.5 ? 1.25 : 1);
  a.music = (m) => {
    if (m === mode) return;
    mode = m;
    step = 0;
    if (ctx) nextT = ctx.currentTime + 0.1;
  };
  a.danger = (d) => {
    danger = Math.max(0, Math.min(1, d));
  };

  function schedule() {
    if (!ctx || muted || mode === 'off' || mode === 'quiet') return;
    try {
      const ahead = ctx.currentTime + 0.25;
      if (nextT < ctx.currentTime - 0.5) nextT = ctx.currentTime + 0.05;
      while (nextT < ahead) {
        const [note, len] = TUNE[step % TUNE.length];
        if (step % TUNE.length === 0) phraseOn = true;
        const play = mode === 'menu' || (mode === 'play' && (danger > 0.5 || phraseOn));
        if (play && note) {
          const n = danger > 0.5 ? MINOR.get(note) ?? note : note;
          box(MIDI(n + 12), nextT, mode === 'menu' ? 0.16 : 0.11);
          if (mode === 'menu' && step % 3 === 0) {
            const b = BASS[Math.floor(step / 3) % BASS.length];
            tone('triangle', MIDI(b), MIDI(b), nextT, 0.5, 0.12, musicBus, 0.004);
          }
        }
        // As the night builds: a plucked bass, then a brushed shaker, then the tune whole.
        if (mode === 'play' && danger <= 0.5) {
          if (build > 0.2 && step % 3 === 0) {
            const b = BASS[Math.floor(step / 3) % BASS.length];
            tone('triangle', MIDI(b), MIDI(b) * 0.995, nextT, 0.28, 0.07 + build * 0.05, musicBus, 0.003);
          }
          if (build > 0.5 && step % 2 === 1) noise(nextT, 0.05, 0.018 + build * 0.012, 'highpass', 7000, 7000, 1, musicBus, 0.002);
          if (build > 0.75 && note && step % 6 === 0) box(MIDI(note + 19), nextT, 0.04, musicBus, 0.6);
        }
        // While playing: the tune comes and goes in fragments (more of it as the night builds).
        if (mode === 'play' && step % 12 === 11) phraseOn = Math.random() < 0.45 + build * 0.45;
        nextT += eighth() * len;
        step++;
      }
      // Danger: a cello drone and a heartbeat that quickens.
      if (mode === 'play' && danger > 0.15) {
        const gap = 0.9 - danger * 0.45;
        if (beatT < ctx.currentTime) beatT = ctx.currentTime + 0.02;
        while (beatT < ahead) {
          tone('sine', 62, 40, beatT, 0.14, 0.22 * danger, musicBus);
          tone('sine', 58, 38, beatT + 0.16, 0.12, 0.15 * danger, musicBus);
          beatT += gap;
        }
      }
    } catch {
      /* ignore */
    }
  }
  return a;
}
