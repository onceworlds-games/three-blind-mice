// Inside the mousehole: a warm burrow (a matchbox bed, a thimble, a cotton-reel table, a candle stub) where the mice sit on
// the cheese they brought home. The results screen and the win poster.

import * as THREE from 'three';
import { createMouseModel, poseMouse, addMouse } from './mouse.js';
import { createWedge, createWheel } from './items.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });

function earthTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#5a3a24';
  g.fillRect(0, 0, 256, 256);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '30,18,10' : '140,96,60'},${0.15 + rnd() * 0.25})`;
    g.beginPath();
    g.arc(rnd() * 256, rnd() * 256, 1 + rnd() * 4, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.repeat.set(4, 2);
  return t;
}

export function createBurrow() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a0f0a);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  const earth = earthTexture();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), std(0xffffff, { map: earth, side: THREE.BackSide }));
  scene.add(dome);
  const floorTex = earth.clone();
  floorTex.repeat.set(3, 3);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 40).rotateX(-Math.PI / 2), std(0xc8a080, { map: floorTex }));
  floor.receiveShadow = true;
  scene.add(floor);
  // A cotton reel for a table.
  const reel = new THREE.Group();
  reel.position.set(-2.4, 0, -1.2);
  const wood = std(0xd8b483, { roughness: 0.6 });
  for (const y of [0.05, 1.05]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.1, 28), wood);
    disc.position.y = y;
    disc.castShadow = disc.receiveShadow = true;
    reel.add(disc);
  }
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.9, 28), std(0xb83a3a, { roughness: 1 }));
  thread.position.y = 0.55;
  thread.castShadow = true;
  reel.add(thread);
  scene.add(reel);
  // A thimble.
  const thimble = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.75, 22), std(0xb9bec6, { metalness: 0.9, roughness: 0.3 }));
  thimble.position.set(-1.1, 0.375, -2.0);
  thimble.castShadow = true;
  scene.add(thimble);
  // A matchbox bed with a scrap of quilt.
  const box = new THREE.Group();
  box.position.set(2.5, 0, -1.6);
  box.rotation.y = -0.35;
  const tray = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 1.3), std(0xe8d8b0));
  tray.position.y = 0.25;
  tray.castShadow = tray.receiveShadow = true;
  box.add(tray);
  const label = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.3, 1.32), std(0xc23a2a));
  label.position.y = 0.32;
  box.add(label);
  const cloth = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 1.1), std(0x5a6fa8, { roughness: 1 }));
  cloth.position.y = 0.55;
  box.add(cloth);
  scene.add(box);
  // A candle stub: the room's warm light.
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.5, 16), std(0xf3ead6));
  candle.position.set(-2.4, 1.35, -1.2);
  scene.add(candle);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd080, toneMapped: false }));
  flame.scale.set(1, 2, 1);
  flame.position.set(-2.4, 1.72, -1.2);
  scene.add(flame);
  const light = new THREE.PointLight(0xffa860, 40, 14, 1.6);
  light.position.set(-2.2, 2.2, -0.9);
  light.castShadow = true;
  light.shadow.mapSize.set(512, 512);
  scene.add(light);
  scene.add(new THREE.HemisphereLight(0xffc89a, 0x3a2414, 0.9));
  const fill = new THREE.PointLight(0xffd8a0, 12, 12, 1.6);
  fill.position.set(1.5, 3, 3);
  scene.add(fill);

  // The cheese pile and the mice on it.
  const pile = new THREE.Group();
  scene.add(pile);
  const wedges = [];
  for (let i = 0; i < 6; i++) {
    const w = createWedge();
    w.root.scale.setScalar(1.6);
    w.mat.emissiveIntensity = 0.25;
    pile.add(w.root);
    wedges.push(w);
  }
  const wheel = createWheel();
  wheel.root.scale.setScalar(1.3);
  wheel.root.position.set(0.4, 0, -1.6);
  wheel.root.rotation.y = 0.5;
  pile.add(wheel.root);
  const spots = [
    [-0.3, 0, 0.4, 0.3],
    [0.5, 0, 0.6, -0.5],
    [0.1, 0.45, 0.3, 1.2],
    [-0.9, 0, -0.1, 0.9],
    [1.1, 0, -0.2, -1.4],
    [0.4, 0.45, -0.1, 2.2],
  ];
  wedges.forEach((w, i) => {
    const [x, y, z, r] = spots[i];
    w.root.position.set(x, y, z);
    w.root.rotation.y = r;
  });
  const mice = [0, 1, 2].map((seat) => {
    const m = createMouseModel(seat);
    m.root.scale.setScalar(1.8);
    addMouse(scene, m);
    return m;
  });
  // Where each mouse sits and which way it looks (pi / 2 faces the camera).
  const seatsAt = [
    [-0.1, 0.5, 0.45, 1.75],
    [1.45, 0.0, 0.95, 1.0],
    [-1.5, 0.0, 0.95, 2.2],
  ];
  const pose = { x: 0, y: 0, z: 0, a: 0, speed: 0, st: 'hole', tail: 1, g: 0, carry: '', stun: 0, charge: 0, me: false, away: false };
  let t = 0;

  return {
    scene,
    camera,
    update(vm, dt, reduced) {
      t += dt;
      const b = vm.burrow ?? { wedges: 3, wheel: true, mice: [{ seat: 0, tail: 1, g: 0 }, { seat: 1, tail: 0, g: 2 }, { seat: 2, tail: 1, g: 4 }] };
      wedges.forEach((w, i) => (w.root.visible = i < b.wedges));
      wheel.root.visible = !!b.wheel;
      const top = b.wedges > 2 || b.wheel ? 0.5 : 0.05;
      mice.forEach((m, i) => {
        const info = b.mice.find((x) => x.seat === i);
        m.root.visible = m.tail.mesh.visible = !!info;
        if (!info) return;
        const [x, y, z, a] = seatsAt[i];
        pose.x = x;
        pose.z = z;
        pose.a = a;
        pose.y = i === 0 ? top : y;
        pose.tail = info.tail;
        pose.g = info.g ?? 0;
        pose.look = info.look ?? { g: info.g ?? 0, h: 0, f: 0, t: 0 };
        poseMouse(m, pose, t + i * 2, dt, reduced);
        m.halo.visible = false;
        m.shadow.visible = pose.y === 0;
      });
      flame.scale.set(1, 2 + (reduced ? 0 : Math.sin(t * 17) * 0.25), 1);
      light.intensity = 40 + (reduced ? 0 : Math.sin(t * 13) * 3 + Math.sin(t * 7) * 2);
      const aspect = camera.aspect;
      const d = aspect < 1 ? 11.5 : 7.2;
      const sway = reduced ? 0 : Math.sin(t * 0.3) * 0.25;
      camera.position.set(sway, aspect < 1 ? 4.2 : 3.2, d);
      camera.lookAt(0, aspect < 1 ? 0.2 : 0.9, -0.6);
    },
  };
}
