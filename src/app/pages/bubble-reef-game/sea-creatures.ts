import * as THREE from 'three';
import { createCuteCreature as createMoldedCreature } from './cute-creature-v2';

/**
 * Bubble Reef's character ROSTER + sprite baker.
 *
 * The `builders` map is the single registry of who exists and how they're
 * made — every one of the 23 characters builds via the molded-v2 system
 * (cute-creature-v2.ts: fleshy high-segment ellipsoids + bezier-Shape
 * extrusions with heavy bevels).
 *
 * loadCreatureSprites() below bakes every builder to an 8-frame swim-cycle
 * flip-book once per app load; the DOM game (br-sprite.ts, the bubble
 * engine) plays those strips with CSS steps() — zero per-frame WebGL.
 *
 * All creatures face +X (right) — swimmers flip with CSS `scaleX(-1)`.
 */

// ------------------------------------------------------------- creatures

const builders: Record<string, () => THREE.Group> = {
  // ---- common ----
  coral: () =>
    createMoldedCreature({
      type: 'fish',
      bodyColor: '#FF9F53',
      bellyColor: '#FFE9CF',
      accentColor: '#F9863C',
      bands: true,
    }),

  finn: () =>
    createMoldedCreature({
      type: 'fish',
      bodyColor: '#F79BB0', // soft coral pink
      bellyColor: '#FFEDF2',
      accentColor: '#EF7D99',
    }),

  puffy: () => createMoldedCreature({ type: 'puffer' }),

  pinchy: () => createMoldedCreature({ type: 'crab' }),

  peach: () => createMoldedCreature({ type: 'shrimp' }),

  gary: () => createMoldedCreature({ type: 'snail' }),

  // ---- uncommon ----
  tilly: () => createMoldedCreature({ type: 'turtle' }),

  ollie: () => createMoldedCreature({ type: 'octopus' }),

  inky: () => createMoldedCreature({ type: 'squid' }),

  jelly: () => createMoldedCreature({ type: 'jellyfish' }),

  stella: () => createMoldedCreature({ type: 'starfish' }),

  louie: () => createMoldedCreature({ type: 'lobster' }),

  // ---- rare ----
  splash: () => createMoldedCreature({ type: 'dolphin' }),

  soso: () => createMoldedCreature({ type: 'seal' }),

  pip: () => createMoldedCreature({ type: 'penguin' }),

  chomp: () => createMoldedCreature({ type: 'shark' }),

  bloop: () => createMoldedCreature({ type: 'whale' }),

  // ---- v2 "molded vinyl" creatures (Shape + beveled ExtrudeGeometry) ----
  axel: () => createMoldedCreature({ type: 'axolotl' }),
  ray: () => createMoldedCreature({ type: 'manta' }),

  // ---- legendary ----
  bigblue: () => createMoldedCreature({ type: 'bluewhale' }),

  marina: () => createMoldedCreature({ type: 'mermaid' }),

  nessie: () => createMoldedCreature({ type: 'plesiosaur' }),

  // ---- the grump bubble hazard ----
  grump: () => createMoldedCreature({ type: 'grump' }),
};

// -------------------------------------------------------------- rendering

/** Frames per creature flip-book (one horizontal strip per creature). */
export const FRAME_COUNT = 8;

let spritePromise: Promise<Map<string, string>> | null = null;

/**
 * Bake every creature to an FRAME_COUNT-frame swim-cycle flip-book: a single
 * horizontal PNG strip per creature (cached for the app's lifetime). Each
 * frame applies a gentle whole-body rock, a squash-and-stretch "breath", and
 * a tail wiggle (any mesh in the rear third of the model), so characters feel
 * alive everywhere with zero per-frame WebGL cost. Play back with CSS
 * `steps(FRAME_COUNT)` on background-position.
 */
export function loadCreatureSprites(size = 224): Promise<Map<string, string>> {
  if (spritePromise) return spritePromise;
  spritePromise = new Promise(resolve => {
    const out = new Map<string, string>();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(1);
      renderer.setSize(size, size, false);
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight('#ffffff', '#9fd0e8', 2.1));
      const key = new THREE.DirectionalLight('#fff6e6', 2.2);
      key.position.set(2.5, 4, 3);
      scene.add(key);
      const rim = new THREE.DirectionalLight('#bfe8ff', 1.0);
      rim.position.set(-3, 1.5, -2);
      scene.add(rim);

      const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
      camera.position.set(1.15, 0.75, 3.35);
      camera.lookAt(0, 0, 0);

      const fitTo = 1.95; // world units that fill the frame (margin for wiggle)
      for (const [id, build] of Object.entries(builders)) {
        const model = build();
        // normalise: center on origin, uniform-fit the bounding sphere
        const box = new THREE.Box3().setFromObject(model);
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        const scale = fitTo / (sphere.radius * 2 || 1);
        model.scale.setScalar(scale);
        model.position.sub(sphere.center.multiplyScalar(scale));
        scene.add(model);
        model.updateMatrixWorld(true);

        // tail parts = meshes whose center sits in the rear ~third — they get
        // an extra wiggle so fins/tails/tentacles visibly swim
        const wbox = new THREE.Box3().setFromObject(model);
        const tailX = wbox.min.x + (wbox.max.x - wbox.min.x) * 0.32;
        const tails: { m: THREE.Object3D; rz: number }[] = [];
        const wp = new THREE.Vector3();
        model.traverse(o => {
          if ((o as THREE.Mesh).isMesh && !o.userData['noWiggle']) {
            o.getWorldPosition(wp);
            if (wp.x < tailX) tails.push({ m: o, rz: o.rotation.z });
          }
        });

        const strip = document.createElement('canvas');
        strip.width = size * FRAME_COUNT;
        strip.height = size;
        const ctx = strip.getContext('2d')!;
        const baseRotZ = model.rotation.z;

        for (let k = 0; k < FRAME_COUNT; k++) {
          const th = (k / FRAME_COUNT) * Math.PI * 2;
          model.rotation.z = baseRotZ + Math.sin(th) * 0.065; // gentle rock
          model.scale.set(
            scale * (1 - Math.sin(th) * 0.02), // squash…
            scale * (1 + Math.sin(th) * 0.035), // …and stretch
            scale,
          );
          for (const t of tails) t.m.rotation.z = t.rz + Math.sin(th + 1.1) * 0.22;
          renderer.render(scene, camera);
          ctx.drawImage(renderer.domElement, k * size, 0);
        }
        out.set(id, strip.toDataURL('image/png'));

        scene.remove(model);
        model.traverse(o => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
          }
        });
      }
      renderer.dispose();
    } catch {
      /* WebGL unavailable — sprites stay empty; the UI falls back gracefully */
    }
    resolve(out);
  });
  return spritePromise;
}
