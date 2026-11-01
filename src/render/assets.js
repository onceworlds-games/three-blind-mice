// The art on disk: Poly Haven texture sets (colour, normal, AO/roughness/metal) and the props file (one scene per model).
// Textures come back at once and fill in when loaded; props wait for one file. Anything that fails to load leaves the code-
// built stand-ins in place, so a missing file never breaks a night.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const BASE = new URL('./art/', document.baseURI).href;
const loader = new THREE.TextureLoader();
const sets = new Map();
let anisotropy = 4;

export function setAnisotropy(n) {
  anisotropy = Math.max(1, Math.min(8, n || 1));
}

function load(file, srgb) {
  const t = loader.load(BASE + 'tex/' + file, undefined, undefined, () => {});
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A texture set by its short name (see CREDITS.md): { map, normalMap, arm }, shared.
export function texSet(name) {
  if (!sets.has(name)) sets.set(name, { map: load(`${name}_c.webp`, true), normalMap: load(`${name}_n.webp`, false), arm: load(`${name}_r.webp`, false) });
  return sets.get(name);
}

// A standard material from a set. repeat: world units per texture tile are set by the geometry's UVs; this scales them.
export function pbr(name, { color = 0xffffff, repeat = 1, rough = 1, metal = 0, normal = 1, ...rest } = {}) {
  const s = texSet(name);
  const m = new THREE.MeshStandardMaterial({
    color,
    map: s.map,
    normalMap: s.normalMap,
    roughnessMap: s.arm,
    metalnessMap: metal > 0 ? s.arm : null,
    aoMap: s.arm,
    aoMapIntensity: 0.8,
    roughness: rough,
    metalness: metal,
    normalScale: new THREE.Vector2(normal, normal),
    ...rest,
  });
  if (repeat !== 1) {
    // Shared textures, so the repeat lives in the material's UV transform: a copy of each map with its own repeat.
    for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) {
      if (!m[k]) continue;
      const c = m[k].clone();
      c.repeat.set(repeat, repeat);
      c.needsUpdate = true;
      m[k] = c;
    }
  }
  return m;
}

// ---------------------------------------------------------------- props

let propsPromise = null;
const props = new Map();

export function loadProps() {
  if (propsPromise) return propsPromise;
  const gl = new GLTFLoader();
  gl.setMeshoptDecoder(MeshoptDecoder);
  propsPromise = new Promise((resolve) => {
    gl.load(
      BASE + 'props.glb',
      (gltf) => {
        for (const sc of gltf.scenes) {
          // Each model normalised: its origin at the middle of its base, sizes in metres as made.
          const box = new THREE.Box3().setFromObject(sc);
          const c = box.getCenter(new THREE.Vector3());
          const root = new THREE.Group();
          root.name = sc.name;
          const inner = new THREE.Group();
          inner.position.set(-c.x, -box.min.y, -c.z);
          for (const ch of [...sc.children]) inner.add(ch);
          root.add(inner);
          root.userData.size = box.getSize(new THREE.Vector3());
          root.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
              const m = o.material;
              if (m?.map) m.map.anisotropy = anisotropy;
            }
          });
          props.set(sc.name, root);
        }
        resolve(true);
      },
      undefined,
      (err) => {
        console.warn('props failed to load', err);
        resolve(false);
      },
    );
  });
  return propsPromise;
}

export const hasProp = (id) => props.has(id);
export const propSize = (id) => props.get(id)?.userData.size ?? null;

// A copy of a prop (sharing geometry and materials) scaled so its largest footprint side or its height fits, or null.
export function prop(id) {
  const src = props.get(id);
  if (!src) return null;
  const c = src.clone(true);
  c.userData.size = src.userData.size;
  return c;
}

// Each mesh of a prop as { geometry (baked into the prop's space), material }: for instancing many copies.
export function propParts(id) {
  const src = props.get(id);
  if (!src) return null;
  src.updateMatrixWorld(true);
  const parts = [];
  src.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    parts.push({ geometry: g, material: o.material, name: o.name });
  });
  return parts;
}
