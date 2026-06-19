import * as THREE from 'three';
import { loadAnimalModel } from './safari-models';

/**
 * A tiny, self-contained Three.js viewer used by the Animal Album (a single
 * turntable model) and the Safari Parade (a looping walking line of models).
 * It shares the GLB cache with the board engine via loadAnimalModel(), runs its
 * own RAF on a transparent canvas, and is created/disposed as panels open/close.
 */
interface ShowItem {
  holder: THREE.Object3D;
  bob: number;
}

const SPREAD = 1.9; // horizontal spacing between paraders
const WALK_SPEED = 0.9; // units/sec the parade drifts left
const WALK_YAW = -Math.PI / 2; // side profile while walking (front faces -x)
const FOCUS_RANGE = 2.4; // within this distance of center, animals glance at the viewer

export class SafariShowcase {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private group = new THREE.Group();

  private raf = 0;
  private mode: 'single' | 'parade' = 'single';
  private items: ShowItem[] = [];
  private spanX = SPREAD; // total width of the parade loop
  private token = 0; // guards against overlapping async set* calls

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
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

  /** One model (by GLB key, e.g. 'animal-lion'), centered, slowly spinning. */
  async setSingle(modelKey: string): Promise<void> {
    this.mode = 'single';
    const my = ++this.token;
    this.clearItems();
    const holder = await loadAnimalModel(modelKey);
    if (my !== this.token) return; // superseded
    if (holder) {
      holder.position.set(0, -0.7, 0);
      this.group.add(holder);
      this.items = [{ holder, bob: 0 }];
    }
    this.camera.position.set(0, 0.35, 3.3);
    this.camera.lookAt(0, 0.15, 0);
    this.start();
  }

  /** A looping walking line of models (Safari Parade), by GLB keys. */
  async setParade(modelKeys: string[]): Promise<void> {
    this.mode = 'parade';
    const my = ++this.token;
    this.clearItems();
    const holders = await Promise.all(modelKeys.map(key => loadAnimalModel(key)));
    if (my !== this.token) return;

    const placed = holders.filter((h): h is THREE.Object3D => !!h);
    this.spanX = Math.max(1, placed.length) * SPREAD;
    placed.forEach((holder, i) => {
      holder.position.set(i * SPREAD - this.spanX / 2, -0.55, 0);
      holder.rotation.y = WALK_YAW; // profile, facing the walk direction (-x)
      this.group.add(holder);
      this.items.push({ holder, bob: i * 0.8 });
    });

    this.camera.position.set(0, 0.5, 6.4);
    this.camera.lookAt(0, 0.05, 0);
    this.start();
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
        it.holder.rotation.y += dt * 0.7; // turntable
        it.holder.position.y = -0.7 + Math.sin(t * 1.6) * 0.05;
      }
    } else {
      const left = -this.spanX / 2;
      for (const it of this.items) {
        it.holder.position.x -= WALK_SPEED * dt;
        if (it.holder.position.x < left) it.holder.position.x += this.spanX;
        const x = it.holder.position.x;
        // a little walking bounce
        it.holder.position.y = -0.55 + Math.abs(Math.sin(t * 5 + it.bob)) * 0.08;
        // glance at the viewer near the center: blend WALK_YAW → face-camera (0)
        const focus = Math.max(0, 1 - Math.abs(x) / FOCUS_RANGE);
        const eased = focus * focus * (3 - 2 * focus); // smoothstep
        it.holder.rotation.y = WALK_YAW * (1 - eased);
        it.holder.rotation.z = Math.sin(t * 5 + it.bob) * 0.04 * (1 - eased * 0.7);
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }

  private clearItems(): void {
    for (const it of this.items) this.group.remove(it.holder);
    // geometries/materials are shared with the cached source — do not dispose them
    this.items = [];
  }

  dispose(): void {
    this.token++;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.clearItems();
    this.renderer.dispose();
  }
}
