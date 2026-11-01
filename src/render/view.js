// The 3D view: renderer, lights, the camera, the night's room and everyone in it, fed by a view model (from the session or a
// headless sim). It keeps the echo uniforms (which rings show, the glows, the fading memory of what's been squeaked, the
// cut-away round your mouse), the moonlight through the windows, the particles, and the feel: shake, punch-ins, hit-stop,
// slow motion on the last wedge home.

import * as THREE from 'three';
import { buildLevel, disposeLevel } from './level.js';
import { echo, setRings, setGlows, createMemory, PALETTE } from './echo.js';
import { createPost } from './post.js';
import { createMouseModel, poseMouse, popTail, squeakPose, addMouse, glowTexture } from './mouse.js';
import { createHuman, poseHuman, addHuman } from './humans.js';
import { createCat, poseCat, addCat } from './cat.js';
import { createWedge, createWheel, createTrap, poseTrap, createCrumbs } from './items.js';
import { createFx } from './fx.js';
import { cookieTexture } from './textures.js';
import { setAnisotropy } from './assets.js';
import { createBurrow } from './burrow.js';
import { RINGS, ringReachTime, MAX_RINGS } from '../core/rings.js';

const SHADOW = { low: 0, medium: 1024, high: 2048 };
const PITCH = (56 * Math.PI) / 180;
const FOV = 38;
const MEMORY_KINDS = new Set(['small', 'big', 'creak', 'crumbs', 'pan', 'snap', 'rumble', 'chime', 'snore']);
const MOON_SPOTS = 2;
const SEAT_HEX = [0x7ea2ff, 0xff7fa8, 0x6fe0b0];

export function createView(canvas, { quality = 'medium', poster = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: poster, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // A GPU drawn in software (SwiftShader, llvmpipe) takes seconds per shader: it always plays on low.
  let software = false;
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    software = /swiftshader|llvmpipe|softpipe|software/i.test(String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
  } catch {
    /* unknown: trust the setting */
  }
  setAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.midnight);
  scene.fog = new THREE.Fog(PALETTE.midnight, 30, 70);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 300);
  // Light: a whisper of blue night everywhere, the moon through the windows, the lanterns, the hole's warmth, the stove.
  const hemi = new THREE.HemisphereLight(0x4a5a9c, 0x0c0d18, 0.6);
  scene.add(hemi);
  const cookie = cookieTexture();
  const moons = [];
  for (let i = 0; i < MOON_SPOTS; i++) {
    const s = new THREE.SpotLight(0x9ab4ff, 0, 0, 0.5, 0.25, 1);
    s.map = cookie;
    s.shadow.bias = -0.0006;
    s.shadow.normalBias = 0.04;
    s.shadow.mapSize.set(1024, 1024);
    s.shadow.camera.near = 2;
    s.shadow.camera.far = 20;
    scene.add(s, s.target);
    moons.push(s);
  }
  const whisker = new THREE.PointLight(PALETTE.cream, 1.4, 3.2, 1.4);
  scene.add(whisker);
  const holeLight = new THREE.PointLight(0xff9a3c, 3.5, 4.2, 1.4);
  scene.add(holeLight);
  const stoveLight = new THREE.PointLight(0xff5a1f, 0, 5, 1.4);
  scene.add(stoveLight);
  const burrow = createBurrow();
  const fx = createFx();
  scene.add(fx.group);

  const v = {
    renderer,
    scene,
    camera,
    quality,
    reduced: false,
    level: null,
    world: null,
    mode: 'follow',
    zoom: 1,
    cam: { x: 0, z: 0, vx: 0, vz: 0, tx: 0, tz: 0, dist: 30, span: 9, introT: 0, ready: false },
    posterCam: { x: 0, z: 0, span: 13 },
    trauma: 0,
    punch: 0,
    w: 1,
    h: 1,
    pr: 1,
    post: null,
    mice: [],
    humans: new Map(),
    cat: null,
    items: [],
    traps: [],
    crumbs: null,
    memory: null,
    stamped: new WeakSet(),
    seen: new WeakSet(),
    onPing: null,
    onCrumbGlint: null,
    lastNow: 0,
    burrow,
    fx,
    bigAt: -99,
    holdUntil: 0,
    slowUntil: 0,
    slowFrom: 0,
    time: 0,
    danger: 0,
  };
  const actorGroup = new THREE.Group();
  scene.add(actorGroup);

  function setupPost() {
    v.post?.dispose();
    v.post = createPost(renderer, scene, camera, v.quality);
    v.post.setSize(v.w, v.h, v.pr);
  }

  v.setQuality = (q) => {
    v.quality = software && !poster ? 'low' : q;
    renderer.shadowMap.enabled = v.quality !== 'low';
    for (const [, hm] of v.humans) applyShadow(hm);
    for (const s of moons) s.castShadow = v.quality === 'high';
    scene.traverse((o) => {
      if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
    });
    fx.enabled = v.quality !== 'low' || poster;
    setupPost();
  };

  function applyShadow(hm) {
    const first = [...v.humans.values()][0] === hm;
    const size = SHADOW[v.quality] ?? 0;
    hm.light.castShadow = size > 0 && (first || v.quality === 'high');
    if (hm.light.castShadow && hm.light.shadow.mapSize.x !== size) {
      hm.light.shadow.mapSize.set(size, size);
      hm.light.shadow.map?.dispose();
      hm.light.shadow.map = null;
    }
  }

  v.resize = (w, h, pr) => {
    // A hidden frame can measure 0 x 0: keep the last real size so the camera's sums stay finite.
    if (!(w > 0 && h > 0)) return;
    v.w = w;
    v.h = h;
    v.pr = pr;
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    v.post?.setSize(w, h, pr);
    fx.setScale((h * pr) / (2 * Math.tan(((FOV / 2) * Math.PI) / 180)));
    burrow.camera.aspect = w / h;
    burrow.camera.updateProjectionMatrix();
  };

  // ------------------------------------------------------------ a night's room
  v.setNight = (world) => {
    if (v.world === world) return;
    if (v.level) {
      scene.remove(v.level.group);
      disposeLevel(v.level);
    }
    actorGroup.clear();
    for (const [, hm] of v.humans) scene.remove(hm.light, hm.target);
    v.humans.clear();
    v.memory?.dispose();
    v.crumbs?.dispose();
    v.crumbs = null;
    fx.clear();
    v.world = world;
    v.level = buildLevel(world);
    scene.add(v.level.group);
    v.memory = createMemory(world.W, world.D, 4);
    v.stamped = new WeakSet();
    v.seen = new WeakSet();
    // Actors.
    v.mice = [0, 1, 2].map((seat) => {
      const m = createMouseModel(seat);
      addMouse(actorGroup, m);
      return m;
    });
    for (const k of ['wife', 'farmer']) {
      if (!world[k]?.patrol?.length) continue;
      const hm = createHuman(k);
      addHuman(actorGroup, scene, hm);
      v.humans.set(k, hm);
      applyShadow(hm);
    }
    v.cat = null;
    if (world.cat) {
      v.cat = createCat();
      addCat(actorGroup, v.cat);
    }
    v.items = world.items.map((it) => {
      const m = it.k === 'W' ? createWheel() : createWedge();
      actorGroup.add(m.root, m.glow);
      return m;
    });
    v.traps = world.traps.map((t) => {
      const m = createTrap();
      m.root.position.set(t.x, 0, t.z);
      m.root.rotation.y = ((t.x * 7 + t.z * 3) % 4) * 0.4;
      m.warn.position.set(t.x, 0.025, t.z);
      actorGroup.add(m.root, m.warn);
      return m;
    });
    if (world.crumbs?.length) {
      v.crumbs = createCrumbs(world.crumbs);
      actorGroup.add(v.crumbs.mesh);
    }
    const h = world.hole;
    holeLight.position.set(h.cx + 0.5 - h.wx * 0.3, 0.7, h.cz + 0.5 - h.wz * 0.3);
    const stove = v.level.lights.find((l) => l.kind === 'stove');
    stoveLight.intensity = stove ? 4 : 0;
    if (stove) stoveLight.position.set(stove.x, 0.9, stove.z);
    // The moon through each window: a spot from high outside, the window's panes as its cookie.
    moons.forEach((s, i) => {
      const w = v.level.windows[i];
      s.userData.base = 0;
      if (!w) {
        s.intensity = 0;
        return;
      }
      s.position.copy(w.light);
      s.target.position.copy(w.target);
      s.target.updateMatrixWorld();
      const dir = w.target.clone().sub(w.light).normalize();
      let ang = 0;
      for (const g of w.ground) ang = Math.max(ang, dir.angleTo(g.clone().sub(w.light)));
      s.angle = Math.min(1.2, ang * 1.18);
      s.penumbra = 0.2;
      s.userData.base = 55;
      s.intensity = 55;
    });
    renderer.shadowMap.needsUpdate = true;
    for (const [, hm] of v.humans) applyShadow(hm);
    v.cam.ready = false;
    warm(scene, camera);
  };

  // Shaders compile off the main thread where the browser can (KHR_parallel_shader_compile): a new room or the burrow draws
  // once its programs are ready, so a slow GPU never freezes the page (or its room's messages) for seconds.
  let compiling = 0;
  let compileUntil = 0;
  const warmed = new WeakSet();
  function warm(sc, cam) {
    if (poster || !renderer.compileAsync) return;
    warmed.add(sc);
    compiling++;
    compileUntil = performance.now() + 25000;
    renderer.setRenderTarget(v.post ? v.post.composer.readBuffer : null);
    const hidden = [];
    sc.traverse((o) => {
      if (!o.visible && !o.isLight) {
        hidden.push(o);
        o.visible = true;
      }
    });
    const ready = renderer.compileAsync(sc, cam);
    for (const o of hidden) o.visible = false;
    renderer.setRenderTarget(null);
    ready.catch(() => {}).finally(() => compiling--);
  }

  // ------------------------------------------------------------ the feel

  v.addTrauma = (x) => {
    if (!v.reduced) v.trauma = Math.min(1, v.trauma + x);
  };
  // A quick zoom toward the action (a close shave, a hit).
  v.punchIn = (x = 1) => {
    if (!v.reduced) v.punch = Math.min(1, Math.max(v.punch, x));
  };
  // Hold the frame (the knife lands, the trap snaps): nothing moves for a beat.
  v.hitStop = (ms = 90) => {
    if (!v.reduced) v.holdUntil = Math.max(v.holdUntil, performance.now() + ms);
  };
  // Slow motion for a moment (the last wedge home).
  v.slowMo = (seconds = 1.2) => {
    if (v.reduced) return;
    v.slowFrom = performance.now();
    v.slowUntil = v.slowFrom + seconds * 1000;
  };
  v.burst = (x, z, n = 60) => fx.confetti(x, 0.5, z, n);

  // ------------------------------------------------------------ the camera
  function viewDistance(span) {
    const aspect = v.w / v.h;
    const halfV = Math.tan(((FOV / 2) * Math.PI) / 180);
    const halfShort = aspect < 1 ? halfV * aspect : halfV;
    return span / (2 * halfShort);
  }

  const baseSpan = () => (v.w < v.h ? 8.2 : 9.6) / v.zoom;

  function placeCamera(dt, vm) {
    const c = v.cam;
    const world = v.world;
    let span = baseSpan();
    let pitch = PITCH;
    let yaw = 0;
    let follow = true;
    if (v.mode === 'orbit' || v.mode === 'overview') {
      follow = false;
      c.tx = world.W / 2;
      c.tz = world.D / 2;
      const aspect = v.w / v.h;
      span = aspect < 1 ? Math.max(world.W, world.D * aspect) * 1.02 : Math.max(world.D * 0.92, world.W / aspect) * 1.02;
      if (v.mode === 'orbit') {
        yaw = v.reduced ? 0 : Math.sin(vm.now * 0.12) * 0.1;
        pitch = PITCH + 0.1;
      }
    } else if (v.mode === 'poster') {
      follow = false;
      const p = v.posterCam;
      c.tx = p.x;
      c.tz = p.z;
      span = p.span;
      pitch = p.pitch ?? PITCH;
      yaw = p.yaw ?? 0;
    } else if (v.mode === 'intro') {
      follow = false;
      // Drop from above the whole room onto the mousehole.
      const u = Math.min(1, c.introT / 2.4);
      const e = 1 - Math.pow(1 - u, 3);
      const aspect = v.w / v.h;
      const all = aspect < 1 ? Math.max(world.W, world.D * aspect) : Math.max(world.D, world.W / aspect);
      span = all * (1 - e) + baseSpan() * e;
      const h = world.hole;
      c.tx = world.W / 2 + (h.cx + 0.5 - world.W / 2) * e;
      c.tz = world.D / 2 + (h.cz + 0.5 - world.D / 2) * e;
      c.introT += dt;
    } else {
      const f = vm.focus;
      let fx0 = c.tx;
      let fz0 = c.tz;
      if (f) {
        const ahead = Math.min(1.3, (f.speed ?? 0) * 0.42);
        fx0 = f.x + Math.cos(f.a) * ahead;
        fz0 = f.z + Math.sin(f.a) * ahead;
        if (f.carry) span *= 1.12;
        if (f.charge > 0) span += (13 - span) * Math.min(1, f.charge);
        if (vm.now - v.bigAt < 1.6 && vm.now >= v.bigAt) span = Math.max(span, 13.5);
        // A hunter close and coming: widen to keep both in the picture, and lean the view toward them.
        let near = null;
        let nd = 9;
        for (const h of vm.hunters) {
          if ((h.k === 'cat' && (h.m === 'sleep' || h.m === 'rest')) || h.m === 'wait') continue;
          const d = Math.hypot(h.x - f.x, h.z - f.z);
          if (d < nd) {
            nd = d;
            near = h;
          }
        }
        if (near) {
          const want = Math.min(15, nd * 1.25 + 3);
          const w = 1 - Math.max(0, (nd - 5) / 4);
          span = Math.max(span, span + (want - span) * w);
          fx0 += (near.x - f.x) * 0.22 * w;
          fz0 += (near.z - f.z) * 0.22 * w;
        }
      }
      if (v.mode === 'attract') span = 15;
      c.tx = fx0;
      c.tz = fz0;
      // Keep the view on the room: no more of the dark outside than the room needs (the floor seen nearer the camera
      // is shorter than the floor seen beyond the middle).
      const d0 = viewDistance(span);
      const aV = ((FOV / 2) * Math.PI) / 180;
      const halfX = d0 * Math.tan(aV) * (v.w / v.h);
      const camH = d0 * Math.sin(pitch);
      const back = d0 * Math.cos(pitch);
      const near = back - camH / Math.tan(pitch + aV);
      const far = pitch - aV > 0.05 ? camH / Math.tan(pitch - aV) - back : 99;
      const fit = (t, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, t)));
      c.tx = fit(c.tx, halfX - 0.4, world.W + 0.4 - halfX);
      c.tz = fit(c.tz, far - 0.6, world.D + 0.1 - near);
    }
    // Punch-in: a quick zoom toward the action.
    span *= 1 - 0.3 * v.punch;
    v.punch = Math.max(0, v.punch - dt * 1.8);
    if (!c.ready || !Number.isFinite(c.x + c.z + c.span) || !follow) {
      c.x = c.tx;
      c.z = c.tz;
      c.vx = c.vz = 0;
      c.span = span;
      c.ready = true;
    } else {
      // A critically damped spring: quick to follow, never overshooting.
      const w = 5.2;
      const st = Math.min(dt, 1 / 20);
      c.vx += ((c.tx - c.x) * w * w - 2 * w * c.vx) * st;
      c.vz += ((c.tz - c.z) * w * w - 2 * w * c.vz) * st;
      c.x += c.vx * st;
      c.z += c.vz * st;
      c.span += (span - c.span) * (1 - Math.exp(-dt * (span < c.span ? 6 : 2.6)));
    }
    c.dist = viewDistance(c.span);
    c.yaw = yaw;
    const sh = v.trauma * v.trauma;
    const t = performance.now() / 1000;
    const ox = sh * 0.5 * (Math.sin(t * 41) * 0.6 + Math.sin(t * 67) * 0.4);
    const oz = sh * 0.5 * (Math.sin(t * 53 + 2) * 0.6 + Math.sin(t * 29) * 0.4);
    const roll = sh * 0.035 * Math.sin(t * 37);
    v.trauma = Math.max(0, v.trauma - dt * 1.7);
    camera.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * c.dist + ox, Math.sin(pitch) * c.dist, c.z + Math.cos(yaw) * Math.cos(pitch) * c.dist + oz);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(c.x + ox, 0, c.z + oz);
    camera.near = Math.max(0.5, c.dist * 0.2);
    camera.far = c.dist * 3 + 40;
    camera.updateProjectionMatrix();
    scene.fog.near = c.dist * 1.1;
    scene.fog.far = c.dist * 2.6;
  }

  v.introStart = () => {
    v.cam.introT = 0;
  };
  v.snapCamera = () => {
    v.cam.ready = false;
  };

  // ------------------------------------------------------------ rings, glows, memory
  const ringList = [];
  const glows = [];
  for (let i = 0; i < 10; i++) glows.push([0, 0, 0, 0]);

  function feedEcho(vm) {
    const now = vm.now;
    ringList.length = 0;
    for (let i = vm.rings.length - 1; i >= 0; i--) {
      const r = vm.rings[i];
      const def = RINGS[r.kind];
      if (!def) continue;
      const age = now - r.t;
      if (age < -0.05 || age > def.dur + 3.2) continue;
      ringList.push(r);
    }
    ringList.sort((a, b) => importance(b, now) - importance(a, now));
    if (ringList.length > MAX_RINGS) ringList.length = MAX_RINGS;
    setRings(ringList, now);
    for (const r of vm.rings) {
      const def = RINGS[r.kind];
      if (!def) continue;
      // New: a squeak's pose, sparks on a big one's front.
      if (!v.seen.has(r) && now >= r.t) {
        v.seen.add(r);
        if (now - r.t < 0.5) onNewRing(vm, r, def);
      }
      // Remember what's been squeaked: a fading glow, and a faint trace that stays all night.
      if (v.stamped.has(r) || now - r.t < def.dur) continue;
      v.stamped.add(r);
      if (r.kind === 'midnight') v.memory.stamp(v.world.W / 2, v.world.D / 2, 80, 0.5, 0.6);
      else if (MEMORY_KINDS.has(r.kind) && (r.src || r.kind === 'chime' || r.kind === 'snore')) v.memory.stamp(r.x, r.z, def.r, 1, 1);
    }
    // Glows: the mice, the hole, the cheese.
    let n = 0;
    for (const m of vm.mice) {
      if (n >= 3 || m.st === 'watch') continue;
      const g = glows[n++];
      g[0] = m.x;
      g[1] = m.z;
      g[2] = m.me ? 1.6 : 1.2;
      g[3] = m.me ? 0.32 : 0.22;
    }
    const h = v.world.hole;
    const hg = glows[n++];
    hg[0] = h.cx + 0.5;
    hg[1] = h.cz + 0.5;
    hg[2] = 2.6;
    hg[3] = 0.6;
    vm.items.forEach((it, i) => {
      const model = v.items[i];
      if (!model || it.home || n >= 10) return;
      const g = glows[n++];
      g[0] = it.x;
      g[1] = it.z;
      g[2] = it.k === 'W' ? 2.2 : 1.5;
      g[3] = 0.2 + 0.6 * Math.min(1, model.ping / 2);
    });
    setGlows(glows, n);
  }

  function importance(r, now) {
    const big = r.kind === 'midnight' ? 100 : r.kind === 'big' || r.kind === 'snap' || r.kind === 'chime' ? 4 : r.src ? 3 : 1;
    return big - (now - r.t) * 0.6;
  }

  function onNewRing(vm, r, def) {
    const m = r.src ? vm.mice.find((mm) => mm.id === r.src) : null;
    if (m && (r.kind === 'small' || r.kind === 'big')) {
      const model = v.mice[m.seat];
      if (model) squeakPose(model, r.kind === 'big');
      if (r.kind === 'big') {
        fx.ringSparks(r.x, r.z, def.r, def.dur, 36, SEAT_HEX[m.seat] ?? PALETTE.cream);
        if (m.me) {
          v.bigAt = vm.now;
          v.addTrauma(0.18);
        }
      } else fx.ringSparks(r.x, r.z, def.r * 0.6, def.dur, 10, PALETTE.cream);
    }
    if (r.kind === 'snap') {
      fx.sparks(r.x, 0.2, r.z, 16, 0xfff1d6, 3);
      fx.splinters(r.x, r.z, 6, 0xb98a52);
    }
    if (r.kind === 'midnight' || r.kind === 'chime') fx.ringSparks(r.x, r.z, Math.min(def.r, 14), def.dur, 28, PALETTE.moon);
  }

  // A ring's front reaching the cheese pings it (a trap, a red glow; a crumb, a glint).
  function pings(vm, prev) {
    const now = vm.now;
    vm.items.forEach((it, i) => {
      const model = v.items[i];
      if (!model) return;
      model.ping = Math.max(0, model.ping - Math.max(0, now - prev));
      if (it.home) return;
      for (const r of vm.rings) {
        const def = RINGS[r.kind];
        if (!def || r.kind === 'step' || r.kind === 'purr' || r.kind === 'bump' || r.kind === 'thud') continue;
        const at = r.t + ringReachTime(r.kind, Math.hypot(r.x - it.x, r.z - it.z));
        if (at > prev && at <= now) {
          model.ping = 4;
          fx.glint(it.x, it.k === 'W' ? 1.3 : 0.5, it.z, PALETTE.cheese, 0.9);
          v.onPing?.({ k: it.k, x: it.x, z: it.z, d: Math.hypot(r.x - it.x, r.z - it.z), mine: !!r.src });
        }
      }
    });
    v.world.traps.forEach((t, i) => {
      if (vm.data?.tr?.[i]) return;
      for (const r of vm.rings) {
        if (!r.src || !RINGS[r.kind]?.heard) continue;
        const at = r.t + ringReachTime(r.kind, Math.hypot(r.x - t.x, r.z - t.z));
        if (at > prev && at <= now) {
          if (v.traps[i]) v.traps[i].ping = 2.5;
          v.onPing?.({ k: 't', x: t.x, z: t.z, d: Math.hypot(r.x - t.x, r.z - t.z), mine: true });
        }
      }
    });
    if (v.crumbs) {
      const list = v.crumbs.list;
      const got = vm.data?.cr;
      for (const r of vm.rings) {
        const def = RINGS[r.kind];
        if (!def?.heard || now - r.t > def.dur + 0.1) continue;
        for (let i = 0; i < list.length; i++) {
          if (got?.[i]) continue;
          const at = r.t + ringReachTime(r.kind, Math.hypot(r.x - list[i][0], r.z - list[i][1]));
          if (at > prev && at <= now) {
            v.crumbs.glints[i] = 1;
            fx.glint(list[i][0], 0.15, list[i][1], 0xffd23f, 0.45);
            v.onCrumbGlint?.(i);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------ the frame
  const hand = new THREE.Matrix4();
  const tmpM = new THREE.Matrix4();
  const pivotT = new THREE.Matrix4();
  const pivotI = new THREE.Matrix4();
  const mA = new THREE.Vector3();
  const mB = new THREE.Vector3();
  let moteT = 0;
  let emberT = 0;
  let memT = 0;

  v.render = (vm, dtIn) => {
    const wall = performance.now();
    if (wall < v.holdUntil) return; // hit-stop: the last frame stays on screen
    let dt = dtIn;
    if (wall < v.slowUntil) {
      const u = (wall - v.slowFrom) / Math.max(1, v.slowUntil - v.slowFrom);
      dt *= 0.25 + 0.75 * u * u;
    }
    v.time += dt;
    if (v.mode === 'burrow') {
      burrow.update(vm, dt, v.reduced);
      if (!warmed.has(burrow.scene)) warm(burrow.scene, burrow.camera);
      if (compiling && performance.now() < compileUntil) return;
      echo.uRimScale.value = 0.25;
      echo.uCut.value.set(0, 0, 0, 0);
      v.post.setScene(burrow.scene, burrow.camera);
      v.post.edges.enabled = false;
      if (v.post.bloom) {
        v.post.bloom.strength = 0.35;
        v.post.bloom.threshold = 0.9;
      }
      v.post.grade.material.uniforms.uDanger.value = 0;
      v.post.render(dt, v.time);
      return;
    }
    v.post.setScene(scene, camera);
    v.post.edges.enabled = true;
    if (v.post.bloom) {
      v.post.bloom.strength = 0.55;
      v.post.bloom.threshold = 0.82;
    }
    echo.uRimScale.value = 1;
    if (!v.world || vm.world !== v.world) v.setNight(vm.world);
    const prev = v.lastNow > vm.now ? vm.now : v.lastNow;
    v.lastNow = vm.now;
    feedEcho(vm);
    pings(vm, prev);
    memT += dt;
    if (memT > 0.1) {
      v.memory.decay(memT);
      memT = 0;
    }
    const t = vm.now;
    const f = vm.focus;
    // Mice.
    v.mice.forEach((model, i) => {
      const m = vm.mice.find((mm) => mm.seat === i);
      if (!m) {
        model.root.visible = model.tail.mesh.visible = model.halo.visible = model.shadow.visible = model.charge.visible = false;
        return;
      }
      if (model.hadTail === 1 && m.tail === 0) {
        popTail(model, m);
        fx.sparks(m.x, 0.3, m.z, 10, 0xff8090, 2);
      }
      model.hadTail = m.tail;
      if (m.carry && !model.carried) model.hop = 1;
      model.carried = !!m.carry;
      poseMouse(model, m, t + i * 1.7, dt, v.reduced, fx);
      if (m.look?.t && m.st === 'play' && m.speed > 1.2 && !v.reduced) {
        model.trailT = (model.trailT ?? 0) - dt;
        if (model.trailT <= 0) {
          model.trailT = 0.06;
          fx.trail(m.look.t, m.x, m.z, m.a, SEAT_HEX[i]);
        }
      }
    });
    // Hunters.
    let danger = 0;
    for (const [k, hm] of v.humans) {
      const h = vm.hunters.find((x) => x.k === k);
      const vis = !!h && h.m !== 'wait';
      hm.root.visible = hm.contact.visible = vis;
      if (hm.beam) hm.beam.visible = vis;
      if (!h) {
        // Dark, not hidden: a light that comes and goes changes every shader's light count (a recompile of the room).
        hm.light.intensity = 0;
        hm.pool.visible = hm.knife.visible = hm.strikeShadow.visible = hm.strikeLine.visible = hm.mark.visible = false;
        continue;
      }
      poseHuman(hm, h, vm.now, dt, v.reduced, fx);
      if (!vis) hm.mark.visible = false;
      if (h.ch && h.ch.at <= vm.now && hm.lastSeq !== h.ch.seq) {
        hm.lastSeq = h.ch.seq;
        if (vm.now - h.ch.at < 0.3) {
          const near = f ? Math.hypot(h.ch.x - f.x, h.ch.z - f.z) : 9;
          v.addTrauma(near < 3 ? 0.6 : 0.3);
          if (near < 2.2) {
            v.hitStop(near < 1.2 ? 110 : 70);
            v.punchIn(0.6);
          }
        }
      }
      if (f && (h.m === 'chase' || h.m === 'raise' || h.m === 'spot')) danger = Math.max(danger, 1 - Math.hypot(h.x - f.x, h.z - f.z) / 9);
    }
    if (v.cat) {
      const h = vm.hunters.find((x) => x.k === 'cat');
      v.cat.root.visible = v.cat.contact.visible = !!h;
      if (h) {
        poseCat(v.cat, h, vm.now, dt, v.reduced, fx);
        if (f && (h.m === 'crouch' || h.m === 'leap')) danger = Math.max(danger, 1 - Math.hypot(h.x - f.x, h.z - f.z) / 8);
      } else {
        v.cat.strikeLine.visible = v.cat.strikeGlow.visible = false;
        for (const z of v.cat.zs) z.visible = false;
      }
    }
    v.danger += (Math.max(0, danger) - v.danger) * Math.min(1, dt * 4);
    v.post.grade.material.uniforms.uDanger.value = v.reduced ? 0 : v.danger;
    // Cheese.
    vm.items.forEach((it, i) => {
      const model = v.items[i];
      if (!model) return;
      model.root.visible = !it.home;
      model.glow.visible = !it.home;
      if (it.home) return;
      const carried = !!it.by;
      if (model.k === 'W') {
        if (!Number.isFinite(model.lx)) {
          model.lx = it.x;
          model.lz = it.z;
        }
        const moved = Math.hypot(it.x - model.lx, it.z - model.lz);
        if (moved > 0.0001 && moved < 1) {
          model.heading = Math.atan2(it.z - model.lz, it.x - model.lx);
          model.spin += moved / 0.62;
          if (!v.reduced && Math.random() < moved * 3) fx.dust(it.x, it.z, 1, model.heading, 0.8);
        }
        model.lx = it.x;
        model.lz = it.z;
        model.root.position.set(it.x, 0, it.z);
        model.root.rotation.y = -(model.heading ?? 0) + Math.PI / 2;
        model.roll.rotation.x = model.spin;
      } else {
        const carrier = carried ? vm.mice.find((m) => m.id === it.by) : null;
        const bob = carried ? 0.3 + (v.reduced ? 0 : Math.abs(Math.sin(t * 13)) * 0.04) : 0.02 + (v.reduced ? 0 : Math.sin(t * 2 + i) * 0.02);
        model.root.position.set(it.x, bob, it.z);
        model.root.rotation.y = carried ? -(carrier?.a ?? 0) : (v.reduced ? 0 : t * 0.4) + i;
        model.body.rotation.z = carried && !v.reduced ? Math.sin(t * 13) * 0.08 : 0;
      }
      const glow = 0.1 + Math.min(1, model.ping / 1.5) * 0.5 + (carried ? 0.15 : 0);
      model.mat.emissiveIntensity = glow;
      if (model.mat2) model.mat2.emissiveIntensity = glow;
      model.glow.position.set(it.x, 0.03, it.z);
      model.glow.material.opacity = 0.25 + Math.min(1, model.ping / 2) * 0.55;
      model.glow.scale.setScalar(1 + Math.min(1, model.ping / 3) * 0.6);
    });
    v.traps.forEach((m, i) => {
      const sprung = !!vm.data?.tr?.[i];
      if (sprung && !m.sprung) {
        fx.sparks(m.root.position.x, 0.25, m.root.position.z, 12, 0xfff1d6, 2.5);
        const near = f ? Math.hypot(m.root.position.x - f.x, m.root.position.z - f.z) : 9;
        if (near < 4) v.addTrauma(0.35);
      }
      poseTrap(m, sprung, dt, v.reduced);
    });
    v.crumbs?.update(vm.data?.cr, dt);
    // Lights that follow: whisker glow on the focused mouse; the hole's breathing warmth; the stove's flicker.
    if (f && f.st !== 'watch') {
      whisker.position.set(f.x, 1.1, f.z);
      whisker.intensity = 0.55;
    } else whisker.intensity = 0;
    const carrying = vm.mice.some((m) => m.me && m.carry);
    holeLight.intensity = 3.2 + (carrying ? 1.6 + Math.sin(t * 6) * 1.2 : Math.sin(t * 1.5) * 0.4);
    v.level.holeInside.material.color.setHex(carrying ? 0xffb050 : 0xff9a3c);
    if (v.level.lights.some((l) => l.kind === 'stove')) stoveLight.intensity = 3.6 + (v.reduced ? 0 : Math.sin(t * 9) * 0.4 + Math.sin(t * 23) * 0.3);
    // The cut-away keeps your mouse in view through anything between it and the camera.
    if (f && f.st !== 'watch' && (v.mode === 'follow' || v.mode === 'attract')) echo.uCut.value.set(f.x, 0.3, f.z, 1.15);
    else echo.uCut.value.set(0, 0, 0, 0);
    // Animated bits: the door she comes in by, the clock's hands (one turn a minute), embers, motes in the moonbeams.
    for (const a of v.level.animated) {
      if (a.kind === 'door') {
        const wife = vm.hunters.find((x) => x.k === 'wife');
        const open = wife && wife.m !== 'wait' ? 1 : 0;
        a.open = (a.open ?? 0) + (open - (a.open ?? 0)) * Math.min(1, dt * 2);
        a.mesh.rotation.y = a.open * 1.4;
      } else if (a.kind === 'hand') {
        const list = a.mesh.userData.list;
        if (!list) continue;
        if (!a.pivot) {
          const hour = v.level.animated.find((x) => x.kind === 'hand' && !x.minute) ?? a;
          hour.mesh.geometry.computeBoundingBox();
          const b = hour.mesh.geometry.boundingBox;
          a.pivot = new THREE.Vector3(b.max.x - 0.003, b.min.y + 0.004, b.max.z);
        }
        const turn = -((t / 60) * Math.PI * 2) / (a.minute ? 1 : 12);
        pivotT.makeTranslation(a.pivot.x, a.pivot.y, a.pivot.z);
        pivotI.makeTranslation(-a.pivot.x, -a.pivot.y, -a.pivot.z);
        hand.makeRotationZ(turn);
        for (let k = 0; k < list.length; k++) {
          tmpM.copy(list[k]).multiply(pivotT).multiply(hand).multiply(pivotI);
          a.mesh.setMatrixAt(k, tmpM);
        }
        a.mesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (!v.reduced && fx.enabled) {
      emberT -= dt;
      if (emberT <= 0) {
        emberT = 0.18;
        for (const e of v.level.extra) if (e.kind === 'embers') fx.ember(e.x, e.y, e.z, e.w);
      }
      moteT -= dt;
      if (moteT <= 0) {
        moteT = 0.12;
        for (const w of v.level.windows) {
          const u = Math.random();
          const s = Math.random();
          const r = Math.random() * 0.9 + 0.05;
          mA.copy(w.corners[0]).lerp(w.corners[1], u);
          mB.copy(w.corners[3]).lerp(w.corners[2], u);
          mA.lerp(mB, s);
          const ax = mA.x;
          const ay = mA.y;
          const az = mA.z;
          mA.copy(w.ground[0]).lerp(w.ground[1], u);
          mB.copy(w.ground[3]).lerp(w.ground[2], u);
          mA.lerp(mB, s);
          fx.mote(ax + (mA.x - ax) * r, ay + (mA.y - ay) * r, az + (mA.z - az) * r);
        }
      }
    }
    for (const s of moons) if (s.userData.base) s.intensity = s.userData.base * (v.reduced ? 1 : 0.96 + Math.sin(t * 0.3) * 0.04);
    fx.update(dt);
    placeCamera(dt, vm);
    if (compiling && performance.now() < compileUntil) return;
    v.post.render(dt, v.time);
  };

  // World to page pixels (for name tags, arrows, the out counter).
  const pv = new THREE.Vector3();
  v.project = (x, y, z, out) => {
    pv.set(x, y, z).project(camera);
    out.x = (pv.x * 0.5 + 0.5) * v.w;
    out.y = (-pv.y * 0.5 + 0.5) * v.h;
    out.on = pv.z < 1 && out.x >= 0 && out.x <= v.w && out.y >= 0 && out.y <= v.h;
    return out;
  };

  v.dispose = () => {
    v.post?.dispose();
    renderer.dispose();
  };
  v.glowTexture = glowTexture;
  setupPost();
  return v;
}
