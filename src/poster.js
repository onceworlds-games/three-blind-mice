// Store art drawn by the game itself: ?poster=cover | action | win | multi | icon | badge-<id>. Each scene is a seeded night
// of autopilot mice run to its best moment, rendered by the real view with a ring stopped mid-sweep; words in the game's type.

import * as THREE from 'three';
import { createView } from './render/view.js';
import { createSim } from './core/sim.js';
import { viewFromSim } from './core/session.js';
import { createMouseModel, poseMouse, addMouse } from './render/mouse.js';
import { createWedge, createWheel } from './render/items.js';
import { createCat, poseCat } from './render/cat.js';
import { createHuman } from './render/humans.js';
import { loadProps } from './render/assets.js';
import { SEAT_CSS, seatSvg, echo } from './render/echo.js';
import { starSvg } from './ui.js';

const W = innerWidth;
const H = innerHeight;

export async function runPoster(name) {
  try {
    document.body.classList.add('poster');
    addStyle();
    await loadProps();
    if (name.startsWith('badge-')) badge(name.slice(6));
    else if (name === 'icon') icon();
    else if (name === 'win') win();
    else scene(name);
    await Promise.all([document.fonts.load('400 64px "Alfa Slab One"'), document.fonts.load('700 32px Barlow')]).catch(() => {});
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  } catch (err) {
    console.error(err);
  }
  document.body.dataset.ready = '1';
}

// ------------------------------------------------------------ staging a night

// A night set by hand: mice at [x, z, heading, speed], one of them carrying item 0, the hunters placed by `hunters`.
function staged(night, { mice, carry = -1, hunters = null, now = 30 }) {
  const ids = ['m1', 'm2', 'm3'].slice(0, mice.length);
  const sim = createSim({ night, ids, seed: 1, brains: false });
  sim.now = now;
  mice.forEach(([x, z, a, speed], i) => Object.assign(sim.mice[i], { x, z, a, vx: Math.cos(a) * speed, vz: Math.sin(a) * speed, st: 'play' }));
  if (carry >= 0) sim.data.it[0].by = ids[carry];
  hunters?.(sim.hunters, sim);
  return sim;
}

function makeView() {
  const canvas = document.getElementById('gl');
  const view = createView(canvas, { quality: 'high', poster: true });
  view.reduced = true;
  view.resize(W, H, Math.min(2, Math.max(1, 2560 / W)));
  return view;
}

// The poster camera, kept over the room: centre (x, z), `span` u across the short side of the picture.
function aim(view, world, x, z, span, pitch, yaw = 0) {
  const halfX = (span / 2) * Math.max(1, W / H);
  x = world.W > halfX * 2 ? Math.max(halfX - 0.3, Math.min(world.W + 0.3 - halfX, x)) : world.W / 2;
  view.mode = 'poster';
  view.posterCam = { x, z, span, pitch, yaw };
}

function shoot(view, vm, frames = 8) {
  for (let i = 0; i < frames; i++) view.render(vm, 1 / 30);
}

// A ring from a mouse, stopped `age` seconds into its sweep.
function squeak(sim, kind, m, age) {
  sim.rings.push({ kind, x: m.x, z: m.z, t: sim.now - age, src: m.id, muffled: false });
}

function scene(name) {
  const view = makeView();
  let sim;
  let vm;
  if (name === 'cover') {
    // The kitchen: a big squeak mid-sweep, a mouse running the cheese home, and the wife turning to the sound.
    sim = staged(1, {
      mice: [
        [15.6, 9.9, -2.2, 0],
        [12.6, 10.4, 2.92, 1.2],
        [17.4, 11.2, Math.PI + 0.4, 0.9],
      ],
      carry: 1,
      hunters: ([wife]) => Object.assign(wife, { x: 20.3, z: 7.0, a: 2.59, m: 'hear' }),
    });
    squeak(sim, 'big', sim.mice[0], 0.16);
    vm = viewFromSim(sim);
    vm.focus = null;
    aim(view, sim.world, 14.2, 9.6, 8.4, (60 * Math.PI) / 180);
    shoot(view, vm);
    overlay(`<div class="pt-cover"><div class="pt-name slab lit">Three<br>Blind Mice</div><div class="pt-tag">Squeak to see.</div></div>`);
    return;
  }
  if (name === 'action') {
    // A close shave in the hallway: the knife just landed a whisker behind a mouse running the cheese home.
    sim = staged(3, {
      mice: [
        [15.3, 5.9, Math.PI + 0.15, 1.4],
        [14.6, 2.3, 0.4, 0],
        [12.3, 6.6, -0.3, 0],
      ],
      carry: 0,
      hunters: ([wife], s) => Object.assign(wife, { x: 16.5, z: 3.3, a: Math.PI / 2, m: 'recover', ch: { x: 16.5, z: 5.5, at: s.now - 0.12, seq: 1, r: 0.85, by: 'm1' } }),
    });
    sim.rings.push({ kind: 'midnight', x: 1, z: 1, t: sim.now - 30, src: '' });
    squeak(sim, 'small', sim.mice[0], 0.28);
    vm = viewFromSim(sim);
    vm.focus = vm.mice[0];
    aim(view, sim.world, 15.4, 5.5, 5.6, (60 * Math.PI) / 180);
    shoot(view, vm);
    return;
  }
  if (name === 'multi') {
    // Three friends rolling the whole wheel home, each squeak in its own colour.
    const heading = 2.08;
    const dx = Math.cos(heading);
    const dz = Math.sin(heading);
    const wx = 16.5;
    const wz = 12.2;
    sim = staged(6, {
      mice: [
        [wx - dx * 1.05 + dz * 0.45, wz - dz * 1.05 - dx * 0.45, heading, 0.8],
        [wx - dx * 1.05 - dz * 0.45, wz - dz * 1.05 + dx * 0.45, heading, 0.8],
        [wx - dx * 2.3 + dz * 1.1, wz - dz * 2.3 - dx * 1.1, heading - 0.5, 0],
      ],
    });
    const wi = sim.data.it.findIndex((it) => it.k === 'W');
    Object.assign(sim.data.it[wi], { x: wx, z: wz, by: 'm1', h: ['m2'] });
    sim.rings.push({ kind: 'midnight', x: 1, z: 1, t: sim.now - 30, src: '' });
    squeak(sim, 'big', sim.mice[2], 0.2);
    squeak(sim, 'small', sim.mice[0], 0.3);
    squeak(sim, 'small', sim.mice[1], 0.12);
    vm = viewFromSim(sim);
    vm.focus = null;
    aim(view, sim.world, wx - 0.6, wz - 0.5, 6.2, (58 * Math.PI) / 180);
    view.render(vm, 1 / 30);
    const wheel = view.items.find((m) => m.k === 'W');
    if (wheel) wheel.heading = heading;
    shoot(view, vm);
    const names = ['Pip', 'Moss', 'Bean'];
    const p = { x: 0, y: 0, on: false };
    const tags = vm.mice
      .map((m, i) => {
        view.project(m.x, 1.0, m.z, p);
        return p.on ? `<div class="pt-tagname" style="left:${p.x}px;top:${p.y}px;color:${SEAT_CSS[m.seat]}">${seatSvg(m.seat, 22)} ${names[i]}</div>` : '';
      })
      .join('');
    overlay(`${tags}<div class="pt-cap"><div class="slab solid">Bring two friends</div></div>`);
    return;
  }
  throw new Error('no such poster: ' + name);
}

// ------------------------------------------------------------ the burrow, for the win
function win() {
  const view = makeView();
  view.mode = 'burrow';
  const vm = { burrow: { wedges: 6, wheel: true, mice: [{ seat: 0, tail: 1, g: 0 }, { seat: 1, tail: 0, g: 5 }, { seat: 2, tail: 1, g: 2 }] } };
  view.setQuality('high');
  shoot(view, vm, 4);
  overlay(`<div class="pt-win"><div class="pt-morning slab lit">Morning</div><div class="pt-stars">${starSvg(true, 64)}${starSvg(true, 64)}${starSvg(true, 64)}</div></div>`);
}

// ------------------------------------------------------------ the studio: the game's models on their own, for the icon and badges
function studio() {
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x000000, 0);
  echo.uRimScale.value = 0.35;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x2a2238, 1.5));
  const key = new THREE.DirectionalLight(0xffe2b0, 2.4);
  key.position.set(-2, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fa8ff, 2.2);
  rim.position.set(3, 2.5, -4);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  const st = {
    scene,
    look: new THREE.Vector3(0, 0.3, 0),
    distance: 3.6,
    pitch: 0.62,
    mouse(seat, x, z, a, extra = {}) {
      const model = createMouseModel(seat);
      poseMouse(model, { x, z, a, speed: 0, st: 'play', tail: 1, g: 0, carry: '', stun: 0, charge: 0, me: false, away: false, ...extra }, 1.2 + seat, 1 / 30, true);
      model.halo.visible = false;
      model.shadow.visible = false;
      addMouse(scene, model);
      return model;
    },
    wedge(x, y, z, ry, size = 1) {
      const w = createWedge();
      w.root.position.set(x, y, z);
      w.root.rotation.y = ry;
      w.root.scale.setScalar(size);
      w.mat.emissiveIntensity = 0.22;
      scene.add(w.root);
      return w;
    },
    render() {
      camera.position.set(st.look.x, st.look.y + Math.sin(st.pitch) * st.distance, st.look.z + Math.cos(st.pitch) * st.distance);
      camera.lookAt(st.look);
      renderer.render(scene, camera);
      renderer.render(scene, camera);
    },
  };
  return st;
}

const FACING = Math.PI / 2; // a = pi / 2 faces the camera

// The icon: one mouse in round dark glasses with a wedge, a ring of light behind it.
function icon() {
  const R = W * 0.5;
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<svg class="pt-medal" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#2b2742"/><stop offset="1" stop-color="#0c0d18"/></radialGradient>
    <radialGradient id="r" cx="50%" cy="50%" r="50%"><stop offset="0.78" stop-color="#F4A835" stop-opacity="0"/><stop offset="0.9" stop-color="#FFF1D6" stop-opacity="0.9"/><stop offset="1" stop-color="#F4A835" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <circle cx="${R}" cy="${H * 0.47}" r="${R * 0.86}" fill="url(#r)"/>
    <circle cx="${R}" cy="${H * 0.47}" r="${R * 0.62}" fill="none" stroke="#F4A835" stroke-opacity="0.35" stroke-width="${W * 0.012}"/></svg>`,
  );
  const st = studio();
  st.mouse(0, 0, 0, FACING - 0.35, { g: 0 });
  st.wedge(0.42, 0, 0.3, 2.6, 0.9);
  st.look.set(0.08, 0.32, 0.05);
  st.distance = 2.15;
  st.pitch = 0.42;
  st.render();
}

// ------------------------------------------------------------ badges: a medallion and the thing itself
const BADGES = {
  'first-squeak': { accent: '#FFF1D6', rings: 3 },
  'cheese-thief': { accent: '#FFD23F', rings: 1 },
  'still-got-it': { accent: '#FF7FA8', rings: 1 },
  'close-shave': { accent: '#E23D2E', rings: 1 },
  decoy: { accent: '#FF7B22', rings: 2, dashed: true },
  'silent-run': { accent: '#7EA2FF', rings: 1, dashed: true },
  'let-sleeping-cats-lie': { accent: '#D8FF5A', rings: 0, zzz: true },
  'whole-wheel': { accent: '#FFD23F', rings: 2 },
  'see-how-they-run': { accent: '#6FE0B0', rings: 2 },
  farmhouse: { accent: '#F4A835', rings: 0, stars: 12 },
};

function badge(id) {
  const b = BADGES[id];
  if (!b) throw new Error('no such badge: ' + id);
  const R = 0.46 * Math.min(W, H);
  const cx = W / 2;
  const cy = H / 2;
  let deco = '';
  for (let i = 0; i < b.rings; i++) {
    const r = R * (0.5 + i * 0.13);
    deco += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${b.accent}" stroke-opacity="${0.55 - i * 0.12}" stroke-width="${W * 0.016}" ${b.dashed ? `stroke-dasharray="${W * 0.03} ${W * 0.03}"` : ''}/>`;
  }
  if (b.stars) {
    for (let i = 0; i < b.stars; i++) {
      const a = (i / b.stars) * Math.PI * 2 - Math.PI / 2;
      const s = W * 0.075;
      deco += `<g transform="translate(${cx + Math.cos(a) * R * 0.8 - s / 2} ${cy + Math.sin(a) * R * 0.8 - s / 2}) scale(${s / 24})"><path d="M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill="#FFD23F"/></g>`;
    }
  }
  if (b.zzz) {
    deco += `<text x="${cx + R * 0.2}" y="${cy - R * 0.3}" font-family="Alfa Slab One" font-size="${W * 0.1}" fill="${b.accent}">z</text><text x="${cx + R * 0.38}" y="${cy - R * 0.48}" font-family="Alfa Slab One" font-size="${W * 0.14}" fill="${b.accent}">Z</text>`;
  }
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<svg class="pt-medal" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><radialGradient id="g" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#2a2540"/><stop offset="1" stop-color="#0c0d18"/></radialGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#g)" stroke="#F4A835" stroke-width="${W * 0.035}"/>
    <circle cx="${cx}" cy="${cy}" r="${R * 0.9}" fill="none" stroke="#FFF1D6" stroke-opacity="0.35" stroke-width="${W * 0.008}"/>${deco}</svg>`,
  );
  const st = studio();
  if (id === 'first-squeak') {
    st.mouse(0, 0, 0, FACING);
    st.distance = 2.5;
    st.look.set(0.02, 0.28, 0);
  } else if (id === 'cheese-thief') {
    st.mouse(1, -0.18, 0, FACING - 0.45);
    st.wedge(0.32, 0.1, 0.22, 0.7, 0.95);
    st.distance = 3.3;
    st.look.set(0.05, 0.25, 0.05);
  } else if (id === 'still-got-it') {
    st.mouse(2, 0.25, 0.05, FACING + 2.4);
    st.distance = 3.4;
    st.look.set(-0.05, 0.22, 0);
  } else if (id === 'close-shave') {
    st.mouse(0, -0.32, 0.12, FACING - 0.6, { stun: 1 });
    const hm = createHuman('wife');
    hm.knife.visible = true;
    hm.knife.scale.setScalar(0.34);
    hm.knife.position.set(0.3, 0.62, -0.1);
    hm.knife.rotation.set(Math.PI, 0.5, 0.12);
    st.scene.add(hm.knife);
    st.distance = 3.7;
    st.look.set(0, 0.42, 0);
  } else if (id === 'decoy') {
    st.mouse(1, 0.12, 0.1, -0.35);
    st.wedge(0.5, 0.2, -0.08, 0.3, 0.85);
    st.distance = 3.4;
    st.look.set(0.15, 0.25, 0);
  } else if (id === 'silent-run') {
    st.mouse(0, -0.1, 0, FACING - 1.0, { speed: 1 });
    st.wedge(0.3, 0.2, 0.18, -0.5, 0.85);
    st.distance = 3.3;
    st.look.set(0.05, 0.25, 0.05);
  } else if (id === 'let-sleeping-cats-lie') {
    const cat = createCat();
    poseCat(cat, { x: 0.1, z: 0, a: FACING - 0.7, m: 'sleep', ch: null }, 1, 1 / 30, true);
    st.scene.add(cat.root);
    st.look.set(0.1, 0.3, 0.05);
    st.distance = 4.6;
  } else if (id === 'whole-wheel') {
    const w = createWheel();
    w.root.position.set(0.25, 0, -0.1);
    w.root.rotation.y = 0.5;
    w.mat.emissiveIntensity = w.mat2.emissiveIntensity = 0.15;
    st.scene.add(w.root);
    st.mouse(2, -0.6, 0.35, -0.4, { speed: 1 });
    st.distance = 5.0;
    st.look.set(-0.05, 0.5, 0.05);
  } else if (id === 'see-how-they-run') {
    [0, 1, 2].forEach((seat) => st.mouse(seat, -0.55 + seat * 0.55, 0.22 - seat * 0.22, FACING - 1.2, { speed: 1, g: [0, 2, 5][seat] }));
    st.distance = 4.8;
    st.look.set(0, 0.25, 0);
  } else if (id === 'farmhouse') {
    const w = createWheel();
    w.root.scale.setScalar(0.7);
    w.root.position.set(0, 0, -0.15);
    w.root.rotation.y = 0;
    w.mat.emissiveIntensity = w.mat2.emissiveIntensity = 0.15;
    st.scene.add(w.root);
    st.wedge(-0.48, 0, 0.3, 0.4, 0.75);
    st.wedge(0.48, 0, 0.3, 2.6, 0.75);
    st.mouse(0, 0, -0.15, FACING, { g: 6 }).root.position.y = 0.86;
    st.distance = 5.6;
    st.look.set(0, 0.62, 0);
    st.pitch = 0.42;
  }
  st.render();
}

// ------------------------------------------------------------ words
function overlay(html) {
  const d = document.createElement('div');
  d.className = 'pt';
  d.innerHTML = html;
  document.body.appendChild(d);
}

function addStyle() {
  const s = document.createElement('style');
  s.textContent = `
  body.poster #ui { display: none; }
  .pt { position: fixed; inset: 0; pointer-events: none; }
  .pt-medal { position: fixed; inset: 0; }
  .pt .lit { --rr: 170%; --rx: 30%; }
  .pt-cover { position: absolute; left: 56px; bottom: 52px; }
  .pt-cover::before { content: ''; position: absolute; left: -56px; bottom: -52px; width: 760px; height: 420px; background: radial-gradient(ellipse at 0% 100%, rgba(8,8,16,0.85), rgba(8,8,16,0) 70%); z-index: -1; }
  .pt-name { font-size: 118px; line-height: 0.92; -webkit-text-stroke-width: 3px; }
  .pt-tag { margin-top: 18px; font: 700 36px var(--sans); color: var(--cream); text-shadow: 0 2px 10px #000; letter-spacing: 0.02em; }
  .pt-cap { position: absolute; left: 48px; bottom: 40px; font-size: 56px; }
  .pt-cap::before { content: ''; position: absolute; left: -48px; bottom: -40px; width: 620px; height: 220px; background: radial-gradient(ellipse at 0% 100%, rgba(8,8,16,0.8), rgba(8,8,16,0) 70%); z-index: -1; }
  .pt-tagname { position: absolute; transform: translate(-50%, -100%); font: 700 26px var(--sans); text-shadow: 0 2px 0 #000, 0 0 10px #000; white-space: nowrap; }
  .pt-win { position: absolute; left: 0; right: 0; top: 34px; text-align: center; }
  .pt-morning { font-size: 112px; -webkit-text-stroke-width: 3px; }
  .pt-stars { margin-top: 10px; display: flex; justify-content: center; gap: 14px; filter: drop-shadow(0 0 12px rgba(255,210,63,0.6)); }
  `;
  document.head.appendChild(s);
}
