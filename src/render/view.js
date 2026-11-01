// The 3D view: renderer, lights, the camera, the night's room and everyone in it, fed by a view model (from the session or a
// headless sim). It also keeps the echo uniforms: which rings show, the glows, and the memory of what's been squeaked.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildLevel, disposeLevel } from './level.js';
import { echo, setRings, setGlows, createMemory, edgeMaterial, edgeMesh, PALETTE } from './echo.js';
import { createMouseModel, poseMouse, popTail, createHuman, poseHuman, createCat, poseCat, createWedge, createWheel, createTrap, poseTrap, glowTexture } from './actors.js';
import { createBurrow } from './burrow.js';
import { RINGS, ringReachTime } from '../core/rings.js';
import { MAX_RINGS } from '../core/rings.js';

const SHADOW = { low: 0, medium: 1024, high: 2048 };
const PITCH = (62 * Math.PI) / 180;
const FOV = 34;
const MEMORY_KINDS = new Set(['small', 'big', 'creak', 'crumbs', 'pan', 'snap', 'rumble', 'chime', 'snore']);

export function createView(canvas, { quality = 'medium', poster = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', preserveDrawingBuffer: poster, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // A GPU drawn in software (SwiftShader, llvmpipe) takes seconds per shader and can't keep up with bloom or shadows: it
  // always plays on low, whatever the setting says.
  let software = false;
  try {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    software = /swiftshader|llvmpipe|softpipe|software/i.test(String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
  } catch {
    /* unknown: trust the setting */
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.midnight);
  scene.fog = new THREE.Fog(PALETTE.midnight, 30, 70);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 300);
  const hemi = new THREE.HemisphereLight(0x51619c, 0x141522, 0.32);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.32);
  moon.position.set(-8, 20, -6);
  scene.add(moon);
  scene.add(moon.target);
  const whisker = new THREE.PointLight(PALETTE.cream, 1.6, 3.4, 1.4);
  scene.add(whisker);
  const holeLight = new THREE.PointLight(0xff9a3c, 3.5, 3.6, 1.5);
  scene.add(holeLight);
  const stoveLight = new THREE.PointLight(0xff5a1f, 0, 4, 1.5);
  scene.add(stoveLight);
  const edgeMat = edgeMaterial(1.7);
  const burrow = createBurrow();

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
    cam: { x: 0, z: 0, tx: 0, tz: 0, dist: 30, yaw: 0, introT: 0 },
    posterCam: { x: 0, z: 0, span: 13 },
    trauma: 0,
    w: 1,
    h: 1,
    composer: null,
    bloom: null,
    mice: [],
    humans: new Map(),
    cat: null,
    items: [],
    traps: [],
    memory: null,
    stamped: new WeakSet(),
    pinged: new WeakMap(),
    onPing: null,
    lastNow: 0,
    burrow,
    shownNight: 0,
  };
  const actorGroup = new THREE.Group();
  scene.add(actorGroup);

  function setupPost() {
    v.composer?.dispose?.();
    v.composer = null;
    if (v.quality === 'low') return;
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: v.quality === 'high' ? 4 : 0 });
    v.composer = new EffectComposer(renderer, target);
    v.renderPass = new RenderPass(scene, camera);
    v.composer.addPass(v.renderPass);
    v.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.55, 0.78);
    v.composer.addPass(v.bloom);
    v.composer.addPass(new OutputPass());
    v.composer.setSize(v.w, v.h);
  }

  v.setQuality = (q) => {
    v.quality = software && !poster ? 'low' : q;
    renderer.shadowMap.enabled = v.quality !== 'low';
    for (const [, hm] of v.humans) applyShadow(hm);
    scene.traverse((o) => {
      if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
    });
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
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    edgeMat.uniforms.uRes.value.set(w * pr, h * pr);
    edgeMat.uniforms.uWidth.value = Math.max(1.4, 1.6 * pr);
    v.composer?.setPixelRatio?.(pr);
    v.composer?.setSize(w, h);
    if (v.bloom) v.bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
    burrow.camera.aspect = w / h;
    burrow.camera.updateProjectionMatrix();
  };

  // ------------------------------------------------------------ a night's room
  v.setNight = (world) => {
    if (v.world === world) return;
    if (v.level) {
      scene.remove(v.level.group);
      scene.remove(v.edges);
      disposeLevel(v.level);
      v.edges.geometry.dispose();
    }
    actorGroup.clear();
    for (const [, hm] of v.humans) scene.remove(hm.light, hm.target);
    v.humans.clear();
    v.memory?.dispose();
    v.world = world;
    v.level = buildLevel(world);
    scene.add(v.level.group);
    // Trap squares join the edges: a square ping.
    const segs = v.level.segs.slice();
    for (const t of world.traps) {
      const s = 0.42;
      const c = [[t.x - s, t.z - s], [t.x + s, t.z - s], [t.x + s, t.z + s], [t.x - s, t.z + s]];
      for (let i = 0; i < 4; i++) segs.push(c[i][0], 0.06, c[i][1], c[(i + 1) % 4][0], 0.06, c[(i + 1) % 4][1]);
    }
    v.edges = edgeMesh(segs, edgeMat);
    scene.add(v.edges);
    v.memory = createMemory(world.W, world.D, 4);
    v.stamped = new WeakSet();
    v.pinged = new WeakMap();
    // Actors.
    v.mice = [0, 1, 2].map((seat) => {
      const m = createMouseModel(seat);
      actorGroup.add(m.root, m.flyer, m.charge, m.halo);
      return m;
    });
    for (const k of ['wife', 'farmer']) {
      if (!world[k]?.patrol?.length) continue;
      const hm = createHuman(k);
      actorGroup.add(hm.root, hm.knife, hm.strikeShadow, hm.strikeLine, hm.pool);
      if (hm.beam) actorGroup.add(hm.beam);
      scene.add(hm.light, hm.target);
      v.humans.set(k, hm);
      applyShadow(hm);
    }
    v.cat = null;
    if (world.cat) {
      v.cat = createCat();
      actorGroup.add(v.cat.root, v.cat.strikeLine);
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
      actorGroup.add(m.root);
      return m;
    });
    const h = world.hole;
    holeLight.position.set(h.cx + 0.5 + h.wx * 0.2, 0.6, h.cz + 0.5 + h.wz * 0.2);
    const stove = v.level.lights.find((l) => l.kind === 'stove');
    stoveLight.intensity = stove ? 3 : 0;
    if (stove) stoveLight.position.set(stove.x, 0.8, stove.z);
    moon.position.set(world.W * 0.3 - 6, 22, world.D * 0.2 - 6);
    moon.target.position.set(world.W / 2, 0, world.D / 2);
    renderer.shadowMap.needsUpdate = true;
    // Only the new hunters' shadows: rebuilding the composer here would throw its compiled programs away every night.
    for (const [, hm] of v.humans) applyShadow(hm);
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
    // Compiled for where it will be drawn: the composer's buffer (no tone mapping in the shader) or the screen.
    // Everything that will show later (actors hidden until their moment) compiles now too.
    renderer.setRenderTarget(v.composer ? v.composer.readBuffer : null);
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

  // ------------------------------------------------------------ the camera
  function viewDistance(span) {
    const aspect = v.w / v.h;
    const halfV = Math.tan(((FOV / 2) * Math.PI) / 180);
    const halfShort = aspect < 1 ? halfV * aspect : halfV;
    return span / (2 * halfShort);
  }

  v.addTrauma = (x) => {
    if (!v.reduced) v.trauma = Math.min(1, v.trauma + x);
  };

  function placeCamera(dt, vm) {
    const c = v.cam;
    const world = v.world;
    let span = 13;
    let pitch = PITCH;
    let yaw = 0;
    if (v.mode === 'orbit') {
      c.tx = world.W / 2;
      c.tz = world.D / 2;
      const aspect = v.w / v.h;
      span = Math.max(aspect < 1 ? world.W : world.D, aspect < 1 ? world.D * aspect : world.W / aspect) * 1.05;
      if (aspect < 1) span = Math.max(world.W * 1.02, world.D * aspect * 1.02) * 1.0;
      yaw = v.reduced ? 0 : Math.sin(vm.now * 0.12) * 0.12;
      pitch = PITCH + 0.12;
    } else if (v.mode === 'poster') {
      const p = v.posterCam;
      c.tx = p.x;
      c.tz = p.z;
      span = p.span;
      pitch = p.pitch ?? PITCH;
      yaw = p.yaw ?? 0;
    } else if (v.mode === 'overview') {
      c.tx = world.W / 2;
      c.tz = world.D / 2;
      const aspect = v.w / v.h;
      span = aspect < 1 ? Math.max(world.W, world.D * aspect) * 1.02 : Math.max(world.D, world.W / aspect) * 1.02;
    } else {
      const f = vm.focus;
      if (f) {
        const ahead = Math.min(1.2, (f.speed ?? 0) * 0.4);
        c.tx = f.x + Math.cos(f.a) * ahead;
        c.tz = f.z + Math.sin(f.a) * ahead;
      }
      span = (v.mode === 'attract' ? 16 : v.w < v.h ? 11.5 : 13) / v.zoom;
      // Keep the view on the room: no more of the dark outside than the room needs.
      const d0 = viewDistance(span);
      const halfV = Math.tan(((FOV / 2) * Math.PI) / 180);
      const halfX = d0 * halfV * (v.w / v.h);
      const halfZ = (d0 * halfV) / Math.sin(pitch);
      const clamp = (t, half, size) => (size + 1 <= half * 2 ? size / 2 : Math.max(half - 0.5, Math.min(size + 0.5 - half, t)));
      c.tx = clamp(c.tx, halfX, world.W);
      c.tz = clamp(c.tz, halfZ, world.D);
    }
    if (v.mode === 'intro') {
      // Drop from above the whole room onto the mousehole.
      const u = Math.min(1, c.introT / 2.4);
      const e = 1 - Math.pow(1 - u, 3);
      const aspect = v.w / v.h;
      const all = aspect < 1 ? Math.max(world.W, world.D * aspect) : Math.max(world.D, world.W / aspect);
      span = all * (1 - e) + 13 * e;
      const h = world.hole;
      c.tx = world.W / 2 + (h.cx + 0.5 - world.W / 2) * e;
      c.tz = world.D / 2 + (h.cz + 0.5 - world.D / 2) * e;
      c.introT += dt;
    }
    const dist = viewDistance(span);
    const k = v.mode === 'intro' || v.mode === 'overview' || v.mode === 'poster' ? 1 : 1 - Math.exp(-dt * 4);
    if (!c.ready || !Number.isFinite(c.x + c.z + c.dist)) {
      c.x = c.tx;
      c.z = c.tz;
      c.dist = dist;
      c.ready = true;
    }
    c.x += (c.tx - c.x) * k;
    c.z += (c.tz - c.z) * k;
    c.dist += (dist - c.dist) * (v.mode === 'intro' || v.mode === 'poster' ? 1 : 1 - Math.exp(-dt * 3));
    c.yaw = yaw;
    const sh = v.trauma * v.trauma;
    const t = vm.now * 31;
    const ox = sh * 0.6 * Math.sin(t * 1.3);
    const oz = sh * 0.6 * Math.sin(t * 1.7 + 2);
    v.trauma = Math.max(0, v.trauma - dt * 1.6);
    camera.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * c.dist + ox, Math.sin(pitch) * c.dist, c.z + Math.cos(yaw) * Math.cos(pitch) * c.dist + oz);
    camera.lookAt(c.x + ox, 0, c.z + oz);
    camera.far = c.dist * 3 + 50;
    camera.updateProjectionMatrix();
    scene.fog.near = c.dist * 0.95;
    scene.fog.far = c.dist * 2.2;
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
    // Remember what's been squeaked: a low floor of light stays on it.
    for (const r of vm.rings) {
      const def = RINGS[r.kind];
      if (!def || v.stamped.has(r) || now - r.t < def.dur) continue;
      v.stamped.add(r);
      if (r.kind === 'midnight') v.memory.stamp(v.world.W / 2, v.world.D / 2, 80, 120);
      else if (MEMORY_KINDS.has(r.kind) && (r.src || r.kind === 'chime' || r.kind === 'snore')) v.memory.stamp(r.x, r.z, def.r, 255);
    }
    // Glows: the mice, the hole, the cheese.
    let n = 0;
    for (const m of vm.mice) {
      if (n >= 3 || m.st === 'watch') continue;
      const g = glows[n++];
      g[0] = m.x;
      g[1] = m.z;
      g[2] = m.me ? 1.8 : 1.4;
      g[3] = m.me ? 0.55 : 0.35;
    }
    const h = v.world.hole;
    const hg = glows[n++];
    hg[0] = h.cx + 0.5;
    hg[1] = h.cz + 0.5;
    hg[2] = 2.6;
    hg[3] = 0.7;
    vm.items.forEach((it, i) => {
      const model = v.items[i];
      if (!model || it.home || n >= 10) return;
      const g = glows[n++];
      g[0] = it.x;
      g[1] = it.z;
      g[2] = it.k === 'W' ? 2.2 : 1.5;
      g[3] = 0.25 + 0.6 * Math.min(1, model.ping / 2);
    });
    setGlows(glows.slice(0, n));
    echo.uMemFloor.value = 0.2;
  }

  function importance(r, now) {
    const big = r.kind === 'midnight' ? 100 : r.kind === 'big' || r.kind === 'snap' || r.kind === 'chime' ? 4 : r.src ? 3 : 1;
    return big - (now - r.t) * 0.6;
  }

  // A ring's front reaching the cheese pings it (and a trap, square).
  function pings(vm, prev) {
    const now = vm.now;
    vm.items.forEach((it, i) => {
      const model = v.items[i];
      if (!model) return;
      model.ping = Math.max(0, model.ping - (now - prev));
      if (it.home) return;
      for (const r of vm.rings) {
        const def = RINGS[r.kind];
        if (!def || r.kind === 'step' || r.kind === 'purr' || r.kind === 'bump' || r.kind === 'thud') continue;
        const at = r.t + ringReachTime(r.kind, Math.hypot(r.x - it.x, r.z - it.z));
        if (at > prev && at <= now) {
          model.ping = 4;
          v.onPing?.({ k: it.k, x: it.x, z: it.z, d: Math.hypot(r.x - it.x, r.z - it.z), mine: !!r.src });
        }
      }
    });
    v.world.traps.forEach((t, i) => {
      if (vm.data?.tr?.[i]) return;
      for (const r of vm.rings) {
        if (!r.src || !RINGS[r.kind]?.heard) continue;
        const at = r.t + ringReachTime(r.kind, Math.hypot(r.x - t.x, r.z - t.z));
        if (at > prev && at <= now) v.onPing?.({ k: 't', x: t.x, z: t.z, d: Math.hypot(r.x - t.x, r.z - t.z), mine: true });
      }
    });
  }

  // ------------------------------------------------------------ the frame
  v.render = (vm, dt) => {
    if (v.mode === 'burrow') {
      burrow.update(vm, dt, v.reduced);
      if (!warmed.has(burrow.scene)) warm(burrow.scene, burrow.camera);
      if (compiling && performance.now() < compileUntil) return;
      echo.uRimScale.value = 0.25;
      if (v.bloom) {
        v.bloom.strength = 0.3;
        v.bloom.threshold = 0.9;
      }
      renderer.setRenderTarget(null);
      if (v.composer) {
        v.renderPass.scene = burrow.scene;
        v.renderPass.camera = burrow.camera;
        v.composer.render(dt);
      } else renderer.render(burrow.scene, burrow.camera);
      return;
    }
    if (v.composer) {
      v.renderPass.scene = scene;
      v.renderPass.camera = camera;
      v.bloom.strength = 0.6;
      v.bloom.threshold = 0.78;
    }
    echo.uRimScale.value = 1;
    if (!v.world || vm.world !== v.world) v.setNight(vm.world);
    const prev = v.lastNow > vm.now ? vm.now : v.lastNow;
    v.lastNow = vm.now;
    feedEcho(vm);
    pings(vm, prev);
    const t = vm.now;
    // Mice.
    v.mice.forEach((model, i) => {
      const m = vm.mice.find((mm) => mm.seat === i);
      model.root.visible = !!m;
      model.halo.visible = !!m;
      model.charge.visible = false;
      if (!m) return;
      if (model.hadTail === 1 && m.tail === 0) popTail(model, m);
      model.hadTail = m.tail;
      if (m.carry && !model.carried) model.hop = 1;
      model.carried = !!m.carry;
      poseMouse(model, m, t + i * 1.7, dt, v.reduced);
      model.halo.visible = m.st !== 'watch' && m.st !== 'out';
    });
    // Hunters.
    for (const [k, hm] of v.humans) {
      const h = vm.hunters.find((x) => x.k === k);
      hm.root.visible = !!h;
      if (hm.beam) hm.beam.visible = !!h;
      if (!h) {
        // Dark, not hidden: a light that comes and goes changes every shader's light count (a recompile of the room).
        hm.light.intensity = 0;
        hm.pool.visible = hm.knife.visible = hm.strikeShadow.visible = hm.strikeLine.visible = false;
        continue;
      }
      poseHuman(hm, h, vm.now, dt, v.reduced);
      if (h.ch && h.ch.at <= vm.now && hm.lastSeq !== h.ch.seq) {
        hm.lastSeq = h.ch.seq;
        if (vm.now - h.ch.at < 0.3) v.addTrauma(0.55);
      }
    }
    if (v.cat) {
      const h = vm.hunters.find((x) => x.k === 'cat');
      v.cat.root.visible = !!h;
      if (h) poseCat(v.cat, h, vm.now, dt, v.reduced);
      else v.cat.strikeLine.visible = false;
    }
    // Cheese.
    vm.items.forEach((it, i) => {
      const model = v.items[i];
      if (!model) return;
      model.root.visible = !it.home;
      model.glow.visible = !it.home;
      if (it.home) return;
      const carried = !!it.by;
      if (model.k === 'W') {
        const moved = Math.hypot(it.x - model.lx, it.z - model.lz);
        if (moved > 0.0001 && moved < 1) {
          model.heading = Math.atan2(it.z - model.lz, it.x - model.lx);
          model.spin += moved / 0.62;
        }
        model.lx = it.x;
        model.lz = it.z;
        model.root.position.set(it.x, 0, it.z);
        model.root.rotation.y = -(model.heading ?? 0) + Math.PI / 2;
        model.roll.rotation.x = model.spin;
      } else {
        const bob = carried ? 0.28 + Math.sin(t * 20) * 0.02 : 0.02 + (v.reduced ? 0 : Math.sin(t * 2 + i) * 0.02);
        model.root.position.set(it.x, bob, it.z);
        model.root.rotation.y = carried ? -(vm.mice.find((m) => m.id === it.by)?.a ?? 0) : t * (v.reduced ? 0 : 0.4) + i;
      }
      const glow = 0.12 + Math.min(1, model.ping / 1.5) * 0.45 + (carried ? 0.15 : 0);
      model.mat.emissiveIntensity = glow;
      if (model.mat2) model.mat2.emissiveIntensity = glow;
      model.glow.position.set(it.x, 0.03, it.z);
      model.glow.material.opacity = 0.3 + Math.min(1, model.ping / 2) * 0.55;
      model.glow.scale.setScalar(1 + Math.min(1, model.ping / 3) * 0.6);
    });
    v.traps.forEach((m, i) => poseTrap(m, !!vm.data?.tr?.[i], dt));
    // Lights that follow: whisker glow on the focused mouse; the hole's breathing warmth.
    const f = vm.focus;
    if (f && f.st !== 'watch') {
      whisker.position.set(f.x, 0.7, f.z);
      whisker.intensity = 1.6;
    } else whisker.intensity = 0;
    const carrying = vm.mice.some((m) => m.me && m.carry);
    holeLight.intensity = 3.2 + (carrying ? 1.5 + Math.sin(t * 6) * 1.2 : Math.sin(t * 1.5) * 0.4);
    v.level.holeInside.material.color.setHex(carrying ? 0xffb050 : 0xff9a3c);
    // Covers fade over the mouse you're watching.
    for (const top of v.level.tops) {
      const under = f && f.x > top.f.x0 - 0.3 && f.x < top.f.x1 + 0.3 && f.z > top.f.z0 - 0.3 && f.z < top.f.z1 + 0.3;
      top.fade += ((under ? 0.22 : 1) - top.fade) * Math.min(1, dt * 8);
      top.mesh.material.opacity = top.fade;
      top.mesh.material.depthWrite = top.fade > 0.95;
    }
    // Animated bits: the clock's pendulum, the door she comes in by.
    for (const a of v.level.animated) {
      if (a.kind === 'pendulum') a.mesh.position.x = a.x + Math.sin(t * Math.PI) * 0.25;
      if (a.kind === 'door') {
        const wife = vm.hunters.find((x) => x.k === 'wife');
        const open = wife && wife.m !== 'wait' ? 1 : 0;
        a.open = (a.open ?? 0) + (open - (a.open ?? 0)) * Math.min(1, dt * 2);
        a.mesh.rotation.y = a.open * 1.4;
        a.mesh.position.set(a.x + 0.4 - Math.sin(a.open * 1.4) * 1.1, a.mesh.position.y, a.z - 1.2 + (1 - Math.cos(a.open * 1.4)) * 1.1);
      }
    }
    placeCamera(dt, vm);
    if (compiling && performance.now() < compileUntil) return;
    if (v.composer) v.composer.render(dt);
    else renderer.render(scene, camera);
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
    renderer.dispose();
  };
  v.glowTexture = glowTexture;
  return v;
}
