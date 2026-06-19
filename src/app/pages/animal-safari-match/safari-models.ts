import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Optional 3D animal models for Animal Safari Match.
 *
 * Drop a low-poly `<animalId>.glb` into `src/assets/models/` and add its id to
 * `src/assets/models/manifest.json` (e.g. `["lion","zebra"]`). Any animal listed
 * there renders as a real 3D model on the board; everything else falls back to
 * the emoji "card" billboard automatically — so this is safe to ship empty.
 *
 * Why a manifest? It avoids a wall of 404s for animals that don't have a model
 * yet, and it's a single source of truth for "which animals are 3D".
 *
 * Pipeline (the recommended way to load/cache a prefab on the web):
 *   GLTFLoader → parse once → normalise (fit + drop to floor) → cache the source
 *   → SkeletonUtils.clone() a fresh instance per card (shares geometry/material,
 *   clones the node graph + any skeleton, so it's cheap and animation-safe).
 */

/** World height every model is normalised to (so any pack looks consistent). */
const TARGET_HEIGHT = 1.5;

const MODELS_BASE = '/assets/models';

const loader = new GLTFLoader();

let manifestPromise: Promise<Set<string>> | null = null;
const sourceCache = new Map<string, Promise<THREE.Object3D | null>>();

/** Fetched once: the set of animal ids that have a `.glb` available. */
function getManifest(): Promise<Set<string>> {
  if (!manifestPromise) {
    manifestPromise = fetch(`${MODELS_BASE}/manifest.json`)
      .then(r => (r.ok ? r.json() : []))
      .then((ids: unknown) => new Set(Array.isArray(ids) ? (ids as string[]) : []))
      .catch(() => new Set<string>());
  }
  return manifestPromise;
}

/** Center on X/Z, drop feet to local y=0, and scale to a consistent height. */
function normalize(root: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  root.scale.setScalar(TARGET_HEIGHT / maxDim);

  const box2 = new THREE.Box3().setFromObject(root);
  const center = box2.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box2.min.y; // feet on the ground
}

/** Load + normalise a model once; null (cached) if it's missing or fails. */
function loadSource(id: string): Promise<THREE.Object3D | null> {
  let p = sourceCache.get(id);
  if (!p) {
    p = loader
      .loadAsync(`${MODELS_BASE}/${id}.glb`)
      .then(gltf => {
        const scene = gltf.scene;
        scene.traverse(o => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.castShadow = false;
            m.receiveShadow = false;
          }
        });
        normalize(scene);
        return scene as THREE.Object3D;
      })
      .catch(() => null);
    sourceCache.set(id, p);
  }
  return p;
}

/**
 * Returns a fresh, normalised model instance wrapped in a holder Group (so the
 * caller can scale/move the holder for reveal/celebrate animations while the
 * model keeps its fitting transform), or null to fall back to the emoji card.
 */
export async function loadAnimalModel(id: string): Promise<THREE.Object3D | null> {
  const manifest = await getManifest();
  if (!manifest.has(id)) return null;
  const source = await loadSource(id);
  if (!source) return null;
  const holder = new THREE.Group();
  holder.add(cloneSkeleton(source));
  return holder;
}
