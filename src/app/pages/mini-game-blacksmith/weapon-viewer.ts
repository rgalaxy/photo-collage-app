import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * The Forge — 3D weapon display.
 *
 * Renders the weapon-pack glTF models (src/assets/models/weapons/gltf) on the
 * anvil. Each evolution stage swaps to a grander model variant where the pack
 * has one AND re-tints the material scheme, so every evolution reads as a new
 * weapon even when the mesh repeats. Also owns the "juice" that happens in 3D:
 * a pop/flash on successful upgrades and a spin-up → white-out → reveal
 * sequence on evolution.
 *
 * The render loop must be started from outside Angular's zone (the component
 * does this) — same pattern as the other Three.js games in this repo.
 */

const MODELS_BASE = '/assets/models/weapons/gltf';

/** Which glTF file renders each evolution stage of a weapon line. */
const STAGE_MODELS: Record<string, string[]> = {
  dagger: ['dagger_A', 'dagger_B', 'dagger_B', 'dagger_B'],
  sword: ['sword_A', 'sword_B', 'sword_C', 'sword_E'],
  bow: ['bow_A_withString', 'bow_B_withString', 'bow_B_withString', 'bow_B_withString'],
  axe: ['axe_A', 'axe_B', 'axe_C', 'axe_C'],
  hammer: ['hammer_A', 'hammer_B', 'hammer_C', 'hammer_C'],
  spear: ['spear_A', 'spear_A', 'halberd', 'halberd'],
  staff: ['staff_A', 'staff_A', 'staff_B', 'staff_B'],
};

/**
 * Color scheme per evolution stage. `tint` multiplies the shared texture atlas,
 * `emissive` adds an inner glow, `glow` is exported for the DOM (anvil glow,
 * HUD name, evolve ring) so 2D chrome matches the 3D weapon.
 */
export interface StageTheme {
  tint: number;
  emissive: number;
  emissiveIntensity: number;
  glow: string;
}
export const STAGE_THEMES: StageTheme[] = [
  { tint: 0xffffff, emissive: 0x000000, emissiveIntensity: 0, glow: '#ffa955' }, // forge-fresh
  { tint: 0xc9e8ff, emissive: 0x0e4b5e, emissiveIntensity: 0.3, glow: '#22d3ee' }, // cold steel
  { tint: 0xe2d2ff, emissive: 0x3b1a78, emissiveIntensity: 0.42, glow: '#a78bfa' }, // arcane
  { tint: 0xffe6a0, emissive: 0x6e4206, emissiveIntensity: 0.55, glow: '#ffd63a' }, // legendary
];

const TARGET_SIZE = 1.7; // world units the largest model dimension is fitted to

const loader = new GLTFLoader();
/** Parsed + normalised sources, cached per file so re-plays are instant. */
const sourceCache = new Map<string, Promise<THREE.Object3D | null>>();

function loadSource(file: string): Promise<THREE.Object3D | null> {
  let p = sourceCache.get(file);
  if (!p) {
    p = loader
      .loadAsync(`${MODELS_BASE}/${file}.gltf`)
      .then(gltf => {
        const root = gltf.scene;
        // some pack models (bows) are authored lying flat — stand the longest axis up
        const pre = new THREE.Box3().setFromObject(root);
        const psize = pre.getSize(new THREE.Vector3());
        if (psize.x >= psize.y && psize.x >= psize.z) root.rotation.z = Math.PI / 2;
        else if (psize.z > psize.y) root.rotation.x = -Math.PI / 2;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        root.scale.setScalar(TARGET_SIZE / maxDim);
        const box2 = new THREE.Box3().setFromObject(root);
        const center = box2.getCenter(new THREE.Vector3());
        root.position.sub(center); // spin around the weapon's own middle
        return root as THREE.Object3D;
      })
      .catch(() => null);
    sourceCache.set(file, p);
  }
  return p;
}

export class WeaponViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private tiltRoot = new THREE.Group(); // fixed 45° presentation tilt + bob
  private holder = new THREE.Group(); // spun/scaled; model sits inside
  private forgeLight: THREE.PointLight;
  private mats: THREE.MeshStandardMaterial[] = [];
  private theme: StageTheme = STAGE_THEMES[0];

  private clock = new THREE.Clock();
  private raf = 0;
  private resizeObs: ResizeObserver;
  private loadToken = 0;
  private disposed = false;

  // animation state (driven every frame)
  private scale = 0.001; // springs toward 1
  private spinBoost = 0; // extra rad/s, decays — evolution spin-up
  private flare = 0; // emissive flash strength, decays
  private flareColor = new THREE.Color(0xffffff);
  private scratch = new THREE.Color();
  private heat = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.classList.add('wd-canvas');
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    this.camera.position.set(0, 0.35, 3.6);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xfff2e0, 0x241430, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2.2, 3, 3.5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x22d3ee, 0.8);
    rim.position.set(-3, 0.5, -2.5);
    this.scene.add(rim);
    this.forgeLight = new THREE.PointLight(0xff8c00, 0.6, 8);
    this.forgeLight.position.set(0, -1.4, 1);
    this.scene.add(this.forgeLight);

    // weapons sit at 45° and spin around their own long axis
    this.tiltRoot.rotation.z = -Math.PI / 4;
    this.tiltRoot.add(this.holder);
    this.scene.add(this.tiltRoot);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
  }

  /** Call from outside Angular's zone. */
  start(): void {
    this.clock.getDelta();
    const tick = () => {
      if (this.disposed) return;
      this.raf = requestAnimationFrame(tick);
      this.update(Math.min(this.clock.getDelta(), 0.05));
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  /** Swap to the model + color scheme for (weaponId, stage). Resolves true if a model rendered. */
  async setWeapon(weaponId: string, stage: number, opts: { entrance?: boolean } = {}): Promise<boolean> {
    const files = STAGE_MODELS[weaponId];
    if (!files?.length) return false;
    const file = files[Math.min(stage, files.length - 1)];
    const token = ++this.loadToken;
    const source = await loadSource(file);
    if (!source || token !== this.loadToken || this.disposed) return false;

    this.holder.clear();
    this.mats = [];
    const model = source.clone(true);
    // clone materials so per-stage tinting never leaks into the shared cache
    model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mesh.material = mat;
      this.mats.push(mat);
    });
    this.holder.add(model);
    this.applyTheme(stage);

    if (opts.entrance !== false) this.scale = 0.001; // grow-in
    return true;
  }

  /** Success/fail feedback on an upgrade attempt — pop + emissive flash. */
  strike(success: boolean): void {
    if (success) {
      this.scale = 1.24;
      this.flare = 0.9;
      this.flareColor.setHex(0xffc46b);
    } else {
      this.scale = 0.88;
      this.flare = 0.7;
      this.flareColor.setHex(0xfb3355);
    }
  }

  /**
   * Evolution: spin up + white-out, swap to the next stage's model/colors at
   * the flash peak, then a big reveal pop.
   */
  evolve(weaponId: string, stage: number): void {
    this.spinBoost = 22;
    this.flare = 1.6;
    this.flareColor.setHex(0xffffff);
    setTimeout(async () => {
      const ok = await this.setWeapon(weaponId, stage, { entrance: false });
      if (!ok || this.disposed) return;
      this.scale = 1.45; // reveal overshoot, springs back to 1
      this.flare = 1.2;
      this.flareColor.set(this.theme.glow);
    }, 430);
  }

  /** 0..1 refinement heat — drives the under-light like the CSS `--heat` glow. */
  setHeat(heat: number): void {
    this.heat = heat;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs.disconnect();
    this.holder.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ----- internals -----
  private applyTheme(stage: number): void {
    this.theme = STAGE_THEMES[Math.min(stage, STAGE_THEMES.length - 1)];
    for (const m of this.mats) m.color.setHex(this.theme.tint);
    this.applyThemeColors();
  }

  private applyThemeColors(): void {
    for (const m of this.mats) {
      m.emissive.setHex(this.theme.emissive);
      m.emissiveIntensity = this.theme.emissiveIntensity;
    }
  }

  private update(dt: number): void {
    const t = performance.now() / 1000;

    this.spinBoost = Math.max(0, this.spinBoost - this.spinBoost * 4.5 * dt);
    this.holder.rotation.y += dt * (0.7 + this.spinBoost);
    this.tiltRoot.position.y = Math.sin(t * 1.5) * 0.07;

    // critically-damped-ish spring back to scale 1
    this.scale += (1 - this.scale) * Math.min(1, dt * 9);
    this.holder.scale.setScalar(this.scale);

    if (this.flare > 0) {
      this.flare = Math.max(0, this.flare - dt * 2.4);
      if (this.flare === 0) {
        this.applyThemeColors(); // restore the exact stage scheme
      } else {
        const k = Math.min(1, this.flare);
        this.scratch.setHex(this.theme.emissive).lerp(this.flareColor, k);
        for (const m of this.mats) {
          m.emissive.copy(this.scratch);
          m.emissiveIntensity = this.theme.emissiveIntensity + k;
        }
      }
    }

    this.forgeLight.intensity = 0.6 + this.heat * 2.6 + this.flare * 2;
  }

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
