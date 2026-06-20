import * as THREE from 'three';
import { loadAnimalModel } from './safari-models';

/**
 * A tiny, self-contained Three.js viewer used by the Animal Album (a single
 * turntable model) and the Safari Parade (3 lanes of models walking at
 * different speeds). It shares the GLB cache with the board engine via
 * loadAnimalModel(), runs its own RAF on a transparent canvas, and shows an
 * animated 3D "loading" placeholder per slot until each model arrives (so slow
 * connections never look empty). Created/disposed as panels open/close.
 */
interface ShowItem {
  holder: THREE.Object3D; // current visual (placeholder OR the real model)
  placeholder: boolean;
  modelKey: string;
  lane: number;
  bob: number;
  baseScale: number;
}

const WALK_SPEED = 0.95; // base units/sec a lane drifts left
const WALK_YAW = -Math.PI / 2; // side profile while walking (front faces -x)
const FOCUS_RANGE = 3.2; // within this distance of center, animals look toward the viewer
const GLANCE_MAX = 0.95; // how fully they turn to face the camera at the closest point

// 3 parade lanes at different depths, viewed from an isometric-ish angle so each
// lane reads as its own row. Each animal appears exactly once and re-enters from
// the right after it walks off the left (the loop is wider than the view).
const LANE_Z = [2.6, 0.0, -2.6];
const LANE_SCALE = [1.05, 0.93, 0.82];
const PARADE_Y = -0.5;
const STEP = 2.7; // spacing between paraders within a lane
const MIN_LOOP = 13; // min wrap width → sparse lanes get a gap + a re-entry

export class SafariShowcase {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private group = new THREE.Group();

  // shared placeholder assets (disposed once at teardown)
  private phGeo = new THREE.IcosahedronGeometry(0.6, 0);
  private phMat = new THREE.MeshStandardMaterial({
    color: '#ffd24a',
    emissive: '#7a4e00',
    emissiveIntensity: 0.35,
    roughness: 0.5,
    metalness: 0,
    flatShading: true,
  });

  private raf = 0;
  private mode: 'single' | 'parade' = 'single';
  private items: ShowItem[] = [];
  private laneSpeed = [WALK_SPEED, WALK_SPEED, WALK_SPEED];
  private laneSpan = [MIN_LOOP, MIN_LOOP, MIN_LOOP];
  private token = 0; // guards against overlapping async set* calls

  // reused math scratch (avoid per-frame allocation)
  private _m = new THREE.Matrix4();
  private _qWalk = new THREE.Quaternion();
  private _qLook = new THREE.Quaternion();
  private _euler = new THREE.Euler();
  private readonly _up = new THREE.Vector3(0, 1, 0);
  private readonly _flipY = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));

  constructor(private canvas: HTMLCanvasElement) {
    const coarse =
      typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.scene.add(this.group);

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6f8f4a', 1.2));
    const key = new THREE.DirectionalLight('#fff3d6', 1.05);
    key.position.set(3, 6, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#bcd6ff', 0.4);
    rim.position.set(-4, 3, -4);
    this.scene.add(rim);

    this.loop = this.loop.bind(this);
    this.resize();
  }

  /** One model (by GLB key), centered, slowly spinning, with a loading placeholder. */
  async setSingle(modelKey: string): Promise<void> {
    this.mode = 'single';
    const my = ++this.token;
    this.clearItems();

    // show an animated placeholder immediately
    const ph = this.makePlaceholder();
    ph.position.set(0, -0.6, 0);
    this.group.add(ph);
    const item: ShowItem = { holder: ph, placeholder: true, modelKey, lane: 0, bob: 0, baseScale: 1 };
    this.items = [item];

    this.camera.position.set(0, 0.35, 3.3);
    this.camera.lookAt(0, 0.15, 0);
    this.start();

    const model = await loadAnimalModel(modelKey);
    if (my !== this.token) return; // superseded
    if (model) this.swapIn(item, model, new THREE.Vector3(0, -0.7, 0), 1);
  }

  /** Three lanes of models walking at different speeds (Safari Parade). */
  async setParade(modelKeys: string[]): Promise<void> {
    this.mode = 'parade';
    const my = ++this.token;
    this.clearItems();
    if (!modelKeys.length) return;

    // Distribute the UNIQUE animals across 3 lanes (round-robin) — each is shown
    // exactly once; it walks off the left and re-enters from the right.
    const lanes: string[][] = [[], [], []];
    modelKeys.forEach((key, i) => lanes[i % 3].push(key));

    for (let lane = 0; lane < 3; lane++) {
      const keys = lanes[lane];
      if (!keys.length) {
        this.laneSpan[lane] = MIN_LOOP;
        continue;
      }
      this.laneSpeed[lane] = WALK_SPEED * (0.65 + Math.random() * 0.7); // varied motion
      const span = Math.max(keys.length * STEP, MIN_LOOP);
      this.laneSpan[lane] = span;
      keys.forEach((key, j) => {
        const x = -span / 2 + (j + 0.5) * (span / keys.length); // evenly spread
        const ph = this.makePlaceholder();
        ph.position.set(x, PARADE_Y, LANE_Z[lane]);
        ph.scale.setScalar(LANE_SCALE[lane]);
        this.group.add(ph);
        this.items.push({
          holder: ph,
          placeholder: true,
          modelKey: key,
          lane,
          bob: j * 0.7 + lane * 0.5,
          baseScale: LANE_SCALE[lane],
        });
      });
    }

    // raised, slightly telephoto camera → isometric-ish; the 3 lanes separate
    // into distinct rows instead of occluding each other
    this.camera.fov = 34;
    this.camera.position.set(0, 4.8, 6.4);
    this.camera.lookAt(0, -0.3, -0.2);
    this.camera.updateProjectionMatrix();
    this.start();

    // Each slot loads its own clone (the underlying GLB is fetched+parsed once
    // and cached, so this only clones), swapping its placeholder when ready.
    await Promise.all(
      this.items.map(async item => {
        const model = await loadAnimalModel(item.modelKey);
        if (my !== this.token || !model || !item.placeholder) return;
        const at = new THREE.Vector3(item.holder.position.x, PARADE_Y, LANE_Z[item.lane]);
        this.swapIn(item, model, at, item.baseScale);
      }),
    );
  }

  /** Replace a slot's placeholder with the real (already-normalised) model holder. */
  private swapIn(item: ShowItem, model: THREE.Object3D, at: THREE.Vector3, scale: number): void {
    this.group.remove(item.holder); // placeholder is shared geo/mat → just detach
    model.position.copy(at);
    model.scale.setScalar(scale);
    model.rotation.set(0, this.mode === 'parade' ? WALK_YAW : 0, 0);
    this.group.add(model);
    item.holder = model;
    item.placeholder = false;
  }

  private makePlaceholder(): THREE.Object3D {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.phGeo, this.phMat));
    return g;
  }

  resize(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private start(): void {
    if (!this.raf) {
      this.clock.getDelta();
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  private loop(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    if (this.mode === 'single') {
      const it = this.items[0];
      if (it) {
        if (it.placeholder) {
          it.holder.rotation.y += dt * 2.0;
          it.holder.rotation.x += dt * 1.3;
          it.holder.scale.setScalar(1 + Math.sin(t * 4) * 0.08);
          it.holder.position.y = -0.6 + Math.sin(t * 2) * 0.06;
        } else {
          it.holder.rotation.y += dt * 0.7; // turntable
          it.holder.position.y = -0.7 + Math.sin(t * 1.6) * 0.05;
        }
      }
    } else {
      for (const it of this.items) {
        const span = this.laneSpan[it.lane];
        it.holder.position.x -= this.laneSpeed[it.lane] * dt;
        if (it.holder.position.x < -span / 2) it.holder.position.x += span;
        const x = it.holder.position.x;
        it.holder.position.y = PARADE_Y + Math.abs(Math.sin(t * 5 + it.bob)) * 0.08;

        if (it.placeholder) {
          // tumbling, pulsing "loading" cue
          it.holder.rotation.y += dt * 2.2;
          it.holder.rotation.x += dt * 1.4;
          it.holder.scale.setScalar(it.baseScale * (1 + Math.sin(t * 5 + it.bob) * 0.1));
        } else {
          // Near center, actually LOOK AT the camera (yaw + pitch up toward the
          // raised viewpoint), blended from the side-on walking pose.
          const focus = Math.max(0, 1 - Math.abs(x) / FOCUS_RANGE);
          const eased = focus * focus * (3 - 2 * focus); // smoothstep
          this._qWalk.setFromEuler(this._euler.set(0, WALK_YAW, Math.sin(t * 5 + it.bob) * 0.04));
          if (eased > 0.001) {
            // lookAt orients -z toward the camera; flip 180° so the model's
            // front (+z) faces it instead.
            this._m.lookAt(it.holder.position, this.camera.position, this._up);
            this._qLook.setFromRotationMatrix(this._m).multiply(this._flipY);
            this._qWalk.slerp(this._qLook, eased * GLANCE_MAX);
          }
          it.holder.quaternion.copy(this._qWalk);
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }

  private clearItems(): void {
    for (const it of this.items) this.group.remove(it.holder);
    // model geometries/materials are shared with the cached source — don't dispose
    this.items = [];
  }

  dispose(): void {
    this.token++;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.clearItems();
    this.phGeo.dispose();
    this.phMat.dispose();
    this.renderer.dispose();
  }
}
