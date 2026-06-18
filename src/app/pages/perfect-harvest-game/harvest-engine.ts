import * as THREE from 'three';

/**
 * Perfect Harvest — self-contained Three.js engine + game simulation.
 *
 * Responsibilities:
 *  - Owns the WebGL renderer, scene, camera, lights and a procedurally-built
 *    low-poly farm (4×3 plots) with cartoon crop models.
 *  - Runs the authoritative game loop (growth, difficulty ramp, spawning,
 *    scoring, combos, spoilage) on its own requestAnimationFrame.
 *  - Exposes a cheap snapshot the Angular component polls for the HUD, and
 *    fires callbacks (outside Angular's zone) for "juice" (particles/sound/shake).
 *
 * Performance notes: the RAF loop must be started from outside Angular's zone
 * (the component does this). Pixel ratio is capped, dt is clamped, geometries
 * are cached/shared, shadows are off, and rendering pauses when hidden.
 */

export type Grade = 'perfect' | 'great' | 'good' | 'poor' | 'miss';
export type CropTypeKey = 'carrot' | 'corn' | 'tomato' | 'pumpkin' | 'strawberry' | 'blueberry';

export interface HarvestFloater {
  id: number;
  x: number; // canvas-relative px
  y: number;
  text: string;
  grade: Grade;
}

export interface HarvestSnapshot {
  score: number;
  timeRemaining: number; // whole seconds (ceil)
  combo: number;
  comboMult: number;
  phase: 1 | 2 | 3;
  lastGrade: Grade | null;
  gradeId: number; // bumps on each harvest — drives the bottom feedback flash
  floaters: HarvestFloater[];
  running: boolean;
}

export interface HarvestSummary {
  score: number;
  perfect: number;
  great: number;
  good: number;
  miss: number; // poor + miss + spoiled, folded together for the summary
  highestCombo: number;
  harvests: number; // perfect + great + good + poor
}

export interface HarvestCallbacks {
  /** Fired the instant a crop is tapped. Coords are viewport px (for JuiceService). */
  onHarvest?: (info: {
    grade: Grade;
    points: number;
    combo: number;
    clientX: number;
    clientY: number;
  }) => void;
  /** A crop rotted (reached 100% un-harvested). Coords are viewport px. */
  onSpoil?: (info: { clientX: number; clientY: number }) => void;
  /** Combo crossed a multiple of 5. */
  onComboMilestone?: (combo: number) => void;
  /** The 3-minute clock expired. */
  onEnd?: (summary: HarvestSummary) => void;
}

interface Crop {
  id: number;
  type: CropTypeKey;
  plot: number;
  center: number; // perfect-moment position on the 0..100 meter
  widthMult: number; // multiplies the base perfect half-width (rarity)
  group: THREE.Group;
  hitbox: THREE.Mesh;
  bodyMats: THREE.MeshStandardMaterial[];
  meter: THREE.Group; // floating ripeness indicator (NOT a child of group, so it stays full-size)
  fill: THREE.Mesh;
  fillMat: THREE.MeshBasicMaterial;
  gloss: THREE.Mesh; // glassy sheen on the fill
  cap: THREE.Mesh; // bright "liquid surface" at the top of the fill
  capMat: THREE.MeshBasicMaterial;
  band: THREE.Mesh; // perfect-zone tolerance band
  bandMat: THREE.MeshBasicMaterial;
  chevL: THREE.Mesh; // target lock-on chevrons
  chevR: THREE.Mesh;
  chevMat: THREE.MeshBasicMaterial;
  haloMat: THREE.MeshBasicMaterial; // soft outer glow
  glow: THREE.Mesh; // ground glow disc
  glowMat: THREE.MeshBasicMaterial;
  ownMats: THREE.Material[]; // materials created per-crop, disposed on removal
  ownGeos: THREE.BufferGeometry[];
  growth: number; // 0..100
  state: 'growing' | 'leaving'; // leaving = playing exit anim then removed
  exitKind: 'pop' | 'wilt';
  exitT: number; // 0..1
  popT: number; // spawn pop-in 0..1
  sway: number;
  headY: number; // local height used to anchor floating score
}

const METER_H = 1.06; // world height of the ripeness bar

export const GAME_DURATION = 45; // seconds

const BASE_POINTS: Record<CropTypeKey, number> = {
  carrot: 10,
  corn: 12,
  tomato: 15,
  pumpkin: 20,
  strawberry: 25,
  blueberry: 30,
};

const GRADE_MULT: Record<Grade, number> = {
  perfect: 3,
  great: 2,
  good: 1,
  poor: 0.5,
  miss: 0,
};

// Weighted spawn table — cheaper crops show up more often.
const SPAWN_WEIGHTS: [CropTypeKey, number][] = [
  ['carrot', 24],
  ['corn', 22],
  ['tomato', 18],
  ['pumpkin', 14],
  ['strawberry', 12],
  ['blueberry', 10],
];

/**
 * Per-crop ripeness profile:
 *  - `center`  — where on the 0–100 meter the "perfect" moment sits (varies the
 *                timing per crop so they don't all peak at the same height).
 *  - `width`   — multiplies the difficulty-based perfect half-width. Rarer /
 *                higher-value crops get a NARROWER window (harder to nail).
 */
const CROP_CFG: Record<CropTypeKey, { center: number; width: number }> = {
  carrot: { center: 50, width: 1.3 },
  corn: { center: 44, width: 1.12 },
  tomato: { center: 56, width: 0.98 },
  pumpkin: { center: 47, width: 0.82 },
  strawberry: { center: 59, width: 0.7 },
  blueberry: { center: 41, width: 0.58 },
};

// High-contrast meter colours (bright against the dark track + sky backdrop).
const ZONE = {
  perfect: '#ffe14a',
  great: '#6dff4d',
  good: '#b6ff7a',
  under: '#19d3e0',
  over: '#ff5a3c',
};

const METER_W = 0.3; // world width of the ripeness bar
const WHITE = new THREE.Color('#ffffff');

export class HarvestEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private clock = new THREE.Clock();

  private plots: THREE.Vector3[] = [];
  private plotUsed: boolean[] = [];
  private crops: Crop[] = [];
  private hitboxes: THREE.Mesh[] = [];

  // shared, cached, disposed only at engine teardown
  private sharedGeo = new Map<string, THREE.BufferGeometry>();
  private sharedMat = new Map<string, THREE.Material>();
  private tex: { pill: THREE.Texture; glow: THREE.Texture; chev: THREE.Texture; gloss: THREE.Texture };
  private scratch = new THREE.Color();

  private raf = 0;
  private running = false;
  private cropId = 1;
  private floatId = 1;

  // simulation state
  private elapsed = 0;
  private spawnTimer = 0.6;
  private score = 0;
  private combo = 0;
  private highestCombo = 0;
  private counts = { perfect: 0, great: 0, good: 0, poor: 0, miss: 0 };
  private lastGrade: Grade | null = null;
  private gradeId = 0;
  private floaters: HarvestFloater[] = [];

  private clientW = 1;
  private clientH = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: HarvestCallbacks = {},
  ) {
    const isCoarse =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 760);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isCoarse, // skip MSAA on phones; rely on capped DPR instead
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color('#aee3f2');
    this.scene.fog = new THREE.Fog('#aee3f2', 16, 30);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

    this.tex = this.makeTextures();
    this.buildLights();
    this.buildBoard();
    this.resize();

    this.onPointerDown = this.onPointerDown.bind(this);
    this.loop = this.loop.bind(this);
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
  }

  // ----------------------------------------------------------------- lights
  private buildLights(): void {
    const hemi = new THREE.HemisphereLight('#ffffff', '#6b8f4e', 0.95);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight('#fff4d6', 1.15);
    key.position.set(5, 9, 4);
    this.scene.add(key);

    const rim = new THREE.DirectionalLight('#bcd6ff', 0.35);
    rim.position.set(-6, 4, -5);
    this.scene.add(rim);
  }

  // ------------------------------------------------------------------ board
  private geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.sharedGeo.get(key);
    if (!g) {
      g = make();
      this.sharedGeo.set(key, g);
    }
    return g;
  }
  private mat(key: string, make: () => THREE.Material): THREE.Material {
    let m = this.sharedMat.get(key);
    if (!m) {
      m = make();
      this.sharedMat.set(key, m);
    }
    return m;
  }
  private std(color: string, opts: { rough?: number; flat?: boolean } = {}): THREE.MeshStandardMaterial {
    const key = `std:${color}:${opts.rough ?? 0.85}:${opts.flat ?? true}`;
    return this.mat(key, () =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: opts.rough ?? 0.85,
        metalness: 0,
        flatShading: opts.flat ?? true,
      }),
    ) as THREE.MeshStandardMaterial;
  }

  // -------------------------------------------------------- shared textures
  /** Procedural sprite textures for the ripeness gauge — built once, shared. */
  private makeTextures(): { pill: THREE.Texture; glow: THREE.Texture; chev: THREE.Texture; gloss: THREE.Texture } {
    const cvs = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return [c, c.getContext('2d') as CanvasRenderingContext2D];
    };
    const make = (c: HTMLCanvasElement): THREE.CanvasTexture => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 2;
      return t;
    };

    // stadium / pill mask (white shape on transparent) — rounded ends
    const [pc, pg] = cvs(64, 192);
    pg.fillStyle = '#fff';
    this.roundRect(pg, 5, 5, 54, 182, 27);
    pg.fill();
    const pill = make(pc);

    // radial soft glow
    const [gc, gg] = cvs(128, 128);
    const rg = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(0.45, 'rgba(255,255,255,0.4)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    gg.fillStyle = rg;
    gg.fillRect(0, 0, 128, 128);
    const glow = make(gc);

    // chevron triangle (points right; flip via scale.x for the left side)
    const [cc, cg] = cvs(64, 64);
    cg.fillStyle = '#fff';
    cg.beginPath();
    cg.moveTo(16, 8);
    cg.lineTo(54, 32);
    cg.lineTo(16, 56);
    cg.lineTo(28, 32);
    cg.closePath();
    cg.fill();
    const chev = make(cc);

    // glassy vertical sheen (a bright streak ~1/3 from the left)
    const [sc, sg] = cvs(64, 8);
    const lg = sg.createLinearGradient(0, 0, 64, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.32, 'rgba(255,255,255,0.85)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = lg;
    sg.fillRect(0, 0, 64, 8);
    const gloss = make(sc);
    gloss.wrapT = THREE.RepeatWrapping;

    return { pill, glow, chev, gloss };
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  private buildBoard(): void {
    const cols = 4;
    const rows = 3;
    const sx = 1.85;
    const sz = 1.95;

    // grassy ground
    const ground = new THREE.Mesh(
      this.geo('ground', () => new THREE.CircleGeometry(20, 40).rotateX(-Math.PI / 2)),
      this.std('#84b85a', { rough: 1 }),
    );
    ground.position.y = -0.02;
    this.scene.add(ground);

    // raised field base
    const fieldW = cols * sx + 0.5;
    const fieldD = rows * sz + 0.5;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(fieldW, 0.5, fieldD),
      this.std('#7a5230', { rough: 1 }),
    );
    base.position.y = -0.18;
    this.scene.add(base);
    const rim = new THREE.Mesh(
      new THREE.BoxGeometry(fieldW + 0.22, 0.3, fieldD + 0.22),
      this.std('#5f3d22', { rough: 1 }),
    );
    rim.position.y = -0.3;
    this.scene.add(rim);

    const soilGeo = this.geo('soil', () => new THREE.CylinderGeometry(0.66, 0.74, 0.2, 14));
    const soilMat = this.std('#4a3220', { rough: 1 });

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * sx;
        const z = (r - (rows - 1) / 2) * sz;
        const soil = new THREE.Mesh(soilGeo, soilMat);
        soil.position.set(x, 0.04, z);
        this.scene.add(soil);
        this.plots.push(new THREE.Vector3(x, 0.14, z));
        this.plotUsed.push(false);
      }
    }
  }

  // ------------------------------------------------------------ crop models
  /** Build a low-poly cartoon crop. Returns the group + pulsable body mats. */
  private buildCrop(type: CropTypeKey): {
    group: THREE.Group;
    bodyMats: THREE.MeshStandardMaterial[];
    ownMats: THREE.Material[];
    ownGeos: THREE.BufferGeometry[];
    headY: number;
  } {
    const group = new THREE.Group();
    const bodyMats: THREE.MeshStandardMaterial[] = [];
    const ownMats: THREE.Material[] = [];
    const ownGeos: THREE.BufferGeometry[] = [];

    // a fresh standard material we are allowed to mutate (emissive pulse)
    const body = (color: string, rough = 0.7): THREE.MeshStandardMaterial => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, flatShading: true });
      bodyMats.push(m);
      ownMats.push(m);
      return m;
    };
    const leafMat = this.std('#4caf50', { rough: 0.8 });
    const stemMat = this.std('#6b4f2a', { rough: 0.9 });

    const addLeaves = (y: number, n = 3, h = 0.42, spread = 0.16) => {
      const lg = this.geo('leaf', () => new THREE.ConeGeometry(0.12, 0.42, 6));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const leaf = new THREE.Mesh(lg, leafMat);
        leaf.position.set(Math.cos(a) * spread, y, Math.sin(a) * spread);
        leaf.rotation.z = Math.cos(a) * 0.5;
        leaf.rotation.x = Math.sin(a) * 0.5;
        leaf.scale.setScalar(h / 0.42);
        group.add(leaf);
      }
    };

    let headY = 1.0;

    switch (type) {
      case 'carrot': {
        const g = new THREE.ConeGeometry(0.32, 0.95, 9);
        ownGeos.push(g);
        const m = new THREE.Mesh(g, body('#ff8a3d'));
        m.position.y = 0.48;
        group.add(m);
        addLeaves(0.98, 4, 0.5, 0.1);
        headY = 1.1;
        break;
      }
      case 'corn': {
        const g = new THREE.SphereGeometry(0.34, 12, 12);
        ownGeos.push(g);
        const m = new THREE.Mesh(g, body('#ffd23f'));
        m.scale.set(1, 1.7, 1);
        m.position.y = 0.62;
        group.add(m);
        const husk = new THREE.Mesh(this.geo('husk', () => new THREE.ConeGeometry(0.26, 0.7, 7)), leafMat);
        husk.position.y = 0.42;
        group.add(husk);
        headY = 1.25;
        break;
      }
      case 'tomato': {
        const g = new THREE.SphereGeometry(0.46, 14, 12);
        ownGeos.push(g);
        const m = new THREE.Mesh(g, body('#ef4d4d'));
        m.scale.set(1, 0.86, 1);
        m.position.y = 0.46;
        group.add(m);
        const calyx = new THREE.Mesh(this.geo('calyx', () => new THREE.ConeGeometry(0.2, 0.18, 6)), leafMat);
        calyx.position.y = 0.82;
        calyx.rotation.x = Math.PI;
        group.add(calyx);
        addLeaves(0.86, 5, 0.22, 0.18);
        headY = 0.98;
        break;
      }
      case 'pumpkin': {
        const g = new THREE.SphereGeometry(0.52, 14, 12);
        ownGeos.push(g);
        const m = new THREE.Mesh(g, body('#ef8b2b'));
        m.scale.set(1.12, 0.8, 1.12);
        m.position.y = 0.44;
        group.add(m);
        const stem = new THREE.Mesh(this.geo('pstem', () => new THREE.CylinderGeometry(0.07, 0.09, 0.26, 6)), stemMat);
        stem.position.y = 0.84;
        group.add(stem);
        headY = 1.0;
        break;
      }
      case 'strawberry': {
        const g = new THREE.ConeGeometry(0.42, 0.74, 12);
        ownGeos.push(g);
        const m = new THREE.Mesh(g, body('#f0394b'));
        m.rotation.x = Math.PI; // wide top, pointed bottom
        m.position.y = 0.5;
        group.add(m);
        addLeaves(0.84, 5, 0.26, 0.2);
        headY = 0.95;
        break;
      }
      case 'blueberry': {
        const positions = [
          [0, 0.34, 0],
          [0.22, 0.26, 0.05],
          [-0.2, 0.28, -0.04],
          [0.04, 0.18, 0.22],
        ];
        const bg = new THREE.SphereGeometry(0.24, 12, 10);
        ownGeos.push(bg);
        const bm = body('#5566d8');
        for (const p of positions) {
          const berry = new THREE.Mesh(bg, bm);
          berry.position.set(p[0], p[1], p[2]);
          group.add(berry);
        }
        addLeaves(0.5, 3, 0.24, 0.22);
        headY = 0.78;
        break;
      }
    }

    return { group, bodyMats, ownMats, ownGeos, headY };
  }

  // -------------------------------------------------------- ripeness meter
  /**
   * A floating, camera-facing ripeness bar. It is NOT parented to the crop, so
   * it stays full-size & crisp regardless of crop scale, and it renders on top
   * of everything (depthTest off + high renderOrder) so it's never hidden.
   * `center` places the bright target zone at this crop's perfect-moment height.
   */
  private buildMeter(center: number): {
    meter: THREE.Group;
    fill: THREE.Mesh;
    fillMat: THREE.MeshBasicMaterial;
    gloss: THREE.Mesh;
    cap: THREE.Mesh;
    capMat: THREE.MeshBasicMaterial;
    band: THREE.Mesh;
    bandMat: THREE.MeshBasicMaterial;
    chevL: THREE.Mesh;
    chevR: THREE.Mesh;
    chevMat: THREE.MeshBasicMaterial;
    haloMat: THREE.MeshBasicMaterial;
    glow: THREE.Mesh;
    glowMat: THREE.MeshBasicMaterial;
    ownMats: THREE.Material[];
  } {
    const ownMats: THREE.Material[] = [];
    const meter = new THREE.Group();
    const H = METER_H;
    const W = METER_W;
    const innerH = H - 0.07;
    const yAt = (g: number) => (g / 100 - 0.5) * innerH;

    // an unlit, always-on-top sprite material (optionally textured)
    const sprite = (
      color: string,
      opacity: number,
      _order: number,
      map?: THREE.Texture,
      blending: THREE.Blending = THREE.NormalBlending,
    ): THREE.MeshBasicMaterial => {
      const m = new THREE.MeshBasicMaterial({
        color,
        map,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
        blending,
      });
      ownMats.push(m);
      return m;
    };
    const mesh = (
      key: string,
      w: number,
      h: number,
      mat: THREE.MeshBasicMaterial,
      order: number,
      anchorBottom = false,
    ): THREE.Mesh => {
      const geo = this.geo(key, () => {
        const g = new THREE.PlaneGeometry(w, h);
        if (anchorBottom) g.translate(0, h / 2, 0);
        return g;
      });
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = order;
      meter.add(m);
      return m;
    };

    // soft outer halo
    const haloMat = sprite(ZONE.under, 0, 18, this.tex.glow);
    const halo = mesh('mHalo', W + 0.62, H + 0.62, haloMat, 18);
    halo.position.z = -0.01;

    // rounded dark frame + empty track
    mesh('mFrame', W + 0.12, H + 0.14, sprite('#06140c', 0.92, 19, this.tex.pill), 19);
    mesh('mTrack', W, H, sprite('#243a26', 0.96, 20, this.tex.pill), 20).position.z = 0.001;

    // fill (rises from the bottom)
    const fillMat = sprite(ZONE.under, 0.97, 21);
    const fill = mesh('mFill', W - 0.08, innerH, fillMat, 21, true);
    fill.position.set(0, -innerH / 2, 0.002);
    fill.scale.y = 0.001;

    // glassy sheen riding the fill
    const gloss = mesh('mGloss', W - 0.08, innerH, sprite('#ffffff', 0.22, 22, this.tex.gloss, THREE.AdditiveBlending), 22, true);
    gloss.position.set(0, -innerH / 2, 0.003);
    gloss.scale.y = 0.001;

    // bright "liquid surface" at the top of the fill
    const capMat = sprite('#ffffff', 0.9, 23);
    const cap = mesh('mCap', W - 0.05, 0.05, capMat, 23);
    cap.position.set(0, -innerH / 2, 0.004);
    cap.visible = false;

    // perfect-zone tolerance band (a glowing lozenge at the target)
    const bandMat = sprite(ZONE.perfect, 0.5, 24, this.tex.pill, THREE.AdditiveBlending);
    const band = mesh('mBand', W + 0.02, H, bandMat, 24);
    band.position.set(0, yAt(center), 0.005);

    // target lock-on chevrons + crisp centre line
    const chevMat = sprite(ZONE.perfect, 0.85, 26, this.tex.chev, THREE.AdditiveBlending);
    const chevL = mesh('mChev', 0.14, 0.14, chevMat, 26);
    chevL.position.set(-(W / 2 + 0.11), yAt(center), 0.006);
    const chevR = new THREE.Mesh(chevL.geometry, chevMat);
    chevR.renderOrder = 26;
    chevR.position.set(W / 2 + 0.11, yAt(center), 0.006);
    chevR.scale.x = -1; // mirror to point inward
    meter.add(chevR);

    mesh('mTick', W + 0.18, 0.022, sprite('#ffffff', 0.92, 27), 27).position.set(0, yAt(center), 0.006);

    meter.quaternion.copy(this.camera.quaternion); // billboard once (camera is fixed)

    // soft ground glow disc (parented to the crop group by the caller)
    const glowMat = new THREE.MeshBasicMaterial({ color: ZONE.under, transparent: true, opacity: 0, depthWrite: false });
    ownMats.push(glowMat);
    const glow = new THREE.Mesh(
      this.geo('glow', () => new THREE.CircleGeometry(0.72, 28).rotateX(-Math.PI / 2)),
      glowMat,
    );
    glow.position.y = 0.16;

    return { meter, fill, fillMat, gloss, cap, capMat, band, bandMat, chevL, chevR, chevMat, haloMat, glow, glowMat, ownMats };
  }

  // ------------------------------------------------------------- lifecycle
  start(): void {
    this.reset();
    this.running = true;
    this.clock.start();
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  reset(): void {
    for (const c of this.crops) this.disposeCrop(c);
    this.crops = [];
    this.hitboxes = [];
    this.plotUsed.fill(false);
    this.elapsed = 0;
    this.spawnTimer = 0.25; // first crops appear fast
    this.score = 0;
    this.combo = 0;
    this.highestCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, poor: 0, miss: 0 };
    this.lastGrade = null;
    this.gradeId = 0;
    this.floaters = [];
  }

  pause(): void {
    this.running = false;
  }
  resume(): void {
    if (this.elapsed >= GAME_DURATION) return;
    this.running = true;
    this.clock.getDelta(); // discard the gap so crops don't jump
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  dispose(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    for (const c of this.crops) this.disposeCrop(c);
    this.crops = [];
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry && !this.isShared(m.geometry)) m.geometry.dispose?.();
    });
    this.sharedGeo.forEach(g => g.dispose());
    this.sharedMat.forEach(m => m.dispose());
    this.sharedGeo.clear();
    this.sharedMat.clear();
    this.tex.pill.dispose();
    this.tex.glow.dispose();
    this.tex.chev.dispose();
    this.tex.gloss.dispose();
    this.renderer.dispose();
  }

  private isShared(g: THREE.BufferGeometry): boolean {
    for (const v of this.sharedGeo.values()) if (v === g) return true;
    return false;
  }

  // ------------------------------------------------------------------ size
  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.clientW = w;
    this.clientH = h;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // pull the camera back on portrait/narrow screens so the field always fits
    const portrait = aspect < 1 ? Math.min(1.85, 0.72 + 0.46 / aspect) : 1;
    const d = 10.6 * portrait;
    this.camera.position.set(0, d * 0.82, d * 0.64);
    this.camera.lookAt(0, 0.1, -0.2);
    this.camera.updateProjectionMatrix();
    // keep already-placed meters facing the (new) camera orientation
    for (const c of this.crops) c.meter.quaternion.copy(this.camera.quaternion);
    // when idle (intro / game-over) render a single frame so the farm is visible behind the UI
    if (!this.running) this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------ difficulty
  private get phase(): 1 | 2 | 3 {
    return this.elapsed < 15 ? 1 : this.elapsed < 30 ? 2 : 3;
  }
  private growthRate(): number {
    return 14 + 16 * (this.elapsed / GAME_DURATION); // 14 → 30 per second
  }
  /** Base perfect half-width before the per-crop rarity multiplier. */
  private basePerfectHalf(): number {
    return 5.5 - 3 * (this.elapsed / GAME_DURATION); // 5.5 → 2.5
  }
  /** This crop's perfect half-width — rarer crops get a tighter window. */
  private cropPerfectHalf(c: Crop): number {
    return Math.max(1.3, this.basePerfectHalf() * c.widthMult);
  }
  private maxConcurrent(): number {
    // start with 2 crops, ramp quickly to 3, then 4 in the closing stretch
    return this.elapsed < 5 ? 2 : this.elapsed < 26 ? 3 : 4;
  }
  private spawnInterval(): number {
    return 0.85 - 0.4 * (this.elapsed / GAME_DURATION); // 0.85 → 0.45s
  }

  private gradeForCrop(c: Crop): Grade {
    const d = Math.abs(c.growth - c.center);
    const pf = this.cropPerfectHalf(c);
    if (d <= pf) return 'perfect';
    if (d <= pf * 2.0) return 'great';
    if (d <= pf * 3.5) return 'good';
    if (d <= pf * 6) return 'poor';
    return 'miss';
  }

  private zoneColor(c: Crop): string {
    const g = this.gradeForCrop(c);
    if (g === 'perfect') return ZONE.perfect;
    if (g === 'great') return ZONE.great;
    if (g === 'good') return ZONE.good;
    return c.growth < c.center ? ZONE.under : ZONE.over;
  }

  // --------------------------------------------------------------- spawning
  private freePlot(): number {
    const free: number[] = [];
    for (let i = 0; i < this.plotUsed.length; i++) if (!this.plotUsed[i]) free.push(i);
    if (!free.length) return -1;
    return free[(Math.random() * free.length) | 0];
  }
  private pickType(): CropTypeKey {
    const total = SPAWN_WEIGHTS.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [t, w] of SPAWN_WEIGHTS) {
      r -= w;
      if (r <= 0) return t;
    }
    return 'carrot';
  }

  private spawn(): void {
    const plot = this.freePlot();
    if (plot < 0) return;
    const type = this.pickType();
    const cfg = CROP_CFG[type];
    const built = this.buildCrop(type);
    built.group.position.copy(this.plots[plot]);

    const crop: Crop = {
      id: this.cropId++,
      type,
      plot,
      center: cfg.center,
      widthMult: cfg.width,
      group: built.group,
      hitbox: null as unknown as THREE.Mesh,
      bodyMats: built.bodyMats,
      meter: null as unknown as THREE.Group,
      fill: null as unknown as THREE.Mesh,
      fillMat: null as unknown as THREE.MeshBasicMaterial,
      gloss: null as unknown as THREE.Mesh,
      cap: null as unknown as THREE.Mesh,
      capMat: null as unknown as THREE.MeshBasicMaterial,
      band: null as unknown as THREE.Mesh,
      bandMat: null as unknown as THREE.MeshBasicMaterial,
      chevL: null as unknown as THREE.Mesh,
      chevR: null as unknown as THREE.Mesh,
      chevMat: null as unknown as THREE.MeshBasicMaterial,
      haloMat: null as unknown as THREE.MeshBasicMaterial,
      glow: null as unknown as THREE.Mesh,
      glowMat: null as unknown as THREE.MeshBasicMaterial,
      ownMats: built.ownMats,
      ownGeos: built.ownGeos,
      growth: 0,
      state: 'growing',
      exitKind: 'pop',
      exitT: 0,
      popT: 0,
      sway: Math.random() * Math.PI * 2,
      headY: built.headY,
    };

    const meter = this.buildMeter(cfg.center);
    crop.meter = meter.meter;
    crop.fill = meter.fill;
    crop.fillMat = meter.fillMat;
    crop.gloss = meter.gloss;
    crop.cap = meter.cap;
    crop.capMat = meter.capMat;
    crop.band = meter.band;
    crop.bandMat = meter.bandMat;
    crop.chevL = meter.chevL;
    crop.chevR = meter.chevR;
    crop.chevMat = meter.chevMat;
    crop.haloMat = meter.haloMat;
    crop.glow = meter.glow;
    crop.glowMat = meter.glowMat;
    crop.ownMats.push(...meter.ownMats);
    crop.group.add(meter.glow);
    // the bar floats above the plot, full-size & independent of crop scale
    meter.meter.position.copy(this.plots[plot]);
    meter.meter.position.y += 1.95;
    this.scene.add(meter.meter);

    // generous invisible tap target (mobile-friendly)
    const hb = new THREE.Mesh(
      this.geo('hitbox', () => new THREE.SphereGeometry(0.95, 8, 6)),
      this.mat('hitbox', () => new THREE.MeshBasicMaterial({ visible: false })),
    );
    hb.position.y = 0.6;
    (hb.userData as { crop: Crop }).crop = crop;
    crop.group.add(hb);
    crop.hitbox = hb;
    this.hitboxes.push(hb);

    crop.group.scale.setScalar(0.001);
    this.scene.add(crop.group);
    this.plotUsed[plot] = true;
    this.crops.push(crop);
  }

  // ------------------------------------------------------------- the loop
  private loop(): void {
    this.raf = 0;
    if (!this.running) return;

    let dt = this.clock.getDelta();
    if (dt > 0.05) dt = 0.05; // clamp after stalls/tab switches

    this.elapsed += dt;
    const over = this.elapsed >= GAME_DURATION;

    // spawn scheduling
    if (!over) {
      this.spawnTimer -= dt;
      const aliveGrowing = this.crops.filter(c => c.state === 'growing').length;
      if (this.spawnTimer <= 0 && aliveGrowing < this.maxConcurrent()) {
        this.spawn();
        this.spawnTimer = this.spawnInterval() * (0.85 + Math.random() * 0.4);
      }
    }

    const rate = this.growthRate();
    const t = this.elapsed;
    const innerH = METER_H - 0.07;

    for (let i = this.crops.length - 1; i >= 0; i--) {
      const c = this.crops[i];

      if (c.state === 'growing') {
        c.growth += rate * dt;
        if (c.growth >= 100) {
          this.spoil(c);
          continue;
        }

        const pf = this.cropPerfectHalf(c);

        // pop-in
        if (c.popT < 1) c.popT = Math.min(1, c.popT + dt * 3.2);
        const pop = easeOutBack(c.popT);
        const gScale = 0.42 + 0.58 * (c.growth / 100);
        c.sway += dt;
        const wobble = 1 + Math.sin(t * 6 + c.sway) * 0.02 * (c.growth / 100);
        c.group.scale.setScalar(pop * gScale * wobble);
        c.group.rotation.z = Math.sin(t * 1.8 + c.sway) * 0.05;

        // ---- ripeness gauge ----
        const frac = Math.max(0.001, c.growth / 100);
        const col = this.zoneColor(c);
        const inPerfect = Math.abs(c.growth - c.center) <= pf;
        const inGood = Math.abs(c.growth - c.center) <= pf * 3.5;
        const pulse = 0.5 + 0.5 * Math.sin(t * 8);

        // fill + glassy sheen rise together
        c.fill.scale.y = frac;
        c.fillMat.color.set(col);
        c.gloss.scale.y = frac;

        // bright "liquid surface" tracks the top of the fill
        c.cap.position.y = -innerH / 2 + frac * innerH;
        c.cap.visible = c.growth > 1.5;
        c.capMat.color.copy(this.scratch.set(col).lerp(WHITE, 0.55));

        // target band, chevrons + halo
        c.band.scale.y = (2 * pf) / 100; // perfect-zone height tracks difficulty
        c.bandMat.opacity = inPerfect ? 0.75 + pulse * 0.25 : 0.34 + pulse * 0.16;
        const chevS = inPerfect ? 1 + pulse * 0.35 : 1;
        c.chevL.scale.set(chevS, chevS, 1);
        c.chevR.scale.set(-chevS, chevS, 1);
        c.chevMat.opacity = inPerfect ? 0.95 : inGood ? 0.7 : 0.45;
        c.haloMat.color.set(col);
        c.haloMat.opacity = inPerfect ? 0.5 + pulse * 0.22 : inGood ? 0.26 : 0.12;

        // shimmer on the crop body + ground glow
        const eAmt = inPerfect ? 0.6 + pulse * 0.4 : inGood ? 0.14 : 0;
        const eCol = inPerfect ? ZONE.perfect : ZONE.great;
        for (const m of c.bodyMats) m.emissive.set(eCol).multiplyScalar(eAmt);
        c.glowMat.color.set(col);
        c.glowMat.opacity = inPerfect ? 0.5 + pulse * 0.28 : inGood ? 0.18 : 0;
      } else {
        // exit animations
        c.exitT += dt / (c.exitKind === 'pop' ? 0.3 : 0.42);
        if (c.exitKind === 'pop') {
          const e = c.exitT;
          const s = e < 0.35 ? 1 + e * 0.8 : Math.max(0, 1.28 - (e - 0.35) * 2);
          c.group.scale.setScalar(s);
          c.group.position.y = this.plots[c.plot].y + e * 1.4;
          c.group.rotation.y += dt * 12;
        } else {
          const e = c.exitT;
          c.group.rotation.z = e * 0.9;
          c.group.scale.set(1 - e * 0.4, Math.max(0.05, 1 - e), 1 - e * 0.4);
          c.group.position.y = this.plots[c.plot].y - e * 0.25;
          for (const m of c.bodyMats) m.color.lerp(new THREE.Color('#6b5a3a'), Math.min(1, dt * 6));
        }
        if (c.exitT >= 1) {
          this.disposeCrop(c);
          this.crops.splice(i, 1);
        }
      }
    }

    // age floaters
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i] as HarvestFloater & { age?: number };
      f.age = (f.age ?? 0) + dt;
      if (f.age > 0.92) this.floaters.splice(i, 1);
    }

    this.renderer.render(this.scene, this.camera);

    if (over) {
      this.running = false;
      this.cb.onEnd?.(this.summary());
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------- harvesting
  private onPointerDown(ev: PointerEvent): void {
    if (!this.running) return;
    ev.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.hitboxes, false);
    if (!hits.length) return;
    const crop = (hits[0].object.userData as { crop: Crop }).crop;
    if (crop && crop.state === 'growing') this.harvest(crop, ev.clientX, ev.clientY);
  }

  private harvest(crop: Crop, clientX: number, clientY: number): void {
    const grade = this.gradeForCrop(crop);
    this.counts[grade]++;

    if (grade === 'perfect') {
      this.combo++;
      this.highestCombo = Math.max(this.highestCombo, this.combo);
      if (this.combo % 5 === 0) this.cb.onComboMilestone?.(this.combo);
    } else if (grade === 'poor' || grade === 'miss') {
      this.combo = 0;
    }
    // great/good preserve the combo without extending it

    const points = Math.round(BASE_POINTS[crop.type] * GRADE_MULT[grade] * this.comboMult());
    this.score += points;
    this.lastGrade = grade;
    this.gradeId++;

    // floating score anchored over the crop (canvas-relative px)
    const head = crop.group.position.clone();
    head.y += crop.headY;
    const ndc = head.project(this.camera);
    this.floaters.push({
      id: this.floatId++,
      x: (ndc.x * 0.5 + 0.5) * this.clientW,
      y: (-ndc.y * 0.5 + 0.5) * this.clientH,
      text: points > 0 ? `+${points}` : 'MISS',
      grade,
    });
    if (this.floaters.length > 8) this.floaters.shift();

    this.beginExit(crop, grade === 'miss' ? 'wilt' : 'pop');
    this.cb.onHarvest?.({ grade, points, combo: this.combo, clientX, clientY });
  }

  private spoil(crop: Crop): void {
    this.counts.miss++;
    this.combo = 0;
    this.lastGrade = 'miss';
    this.gradeId++;
    const head = crop.group.position.clone();
    head.y += crop.headY;
    const ndc = head.clone().project(this.camera);
    const cx = (ndc.x * 0.5 + 0.5) * this.clientW;
    const cy = (-ndc.y * 0.5 + 0.5) * this.clientH;
    this.floaters.push({ id: this.floatId++, x: cx, y: cy, text: 'ROTTEN', grade: 'miss' });
    const rect = this.canvas.getBoundingClientRect();
    this.cb.onSpoil?.({ clientX: rect.left + cx, clientY: rect.top + cy });
    this.beginExit(crop, 'wilt');
  }

  private beginExit(crop: Crop, kind: 'pop' | 'wilt'): void {
    if (crop.state === 'leaving') return;
    crop.state = 'leaving';
    crop.exitKind = kind;
    crop.exitT = 0;
    this.plotUsed[crop.plot] = false;
    // it's no longer tappable
    const idx = this.hitboxes.indexOf(crop.hitbox);
    if (idx >= 0) this.hitboxes.splice(idx, 1);
    crop.glowMat.opacity = 0;
    crop.meter.visible = false; // hide the ripeness bar immediately
  }

  private disposeCrop(crop: Crop): void {
    this.scene.remove(crop.group);
    this.scene.remove(crop.meter);
    const idx = this.hitboxes.indexOf(crop.hitbox);
    if (idx >= 0) this.hitboxes.splice(idx, 1);
    if (this.plotUsed[crop.plot]) this.plotUsed[crop.plot] = false;
    for (const m of crop.ownMats) m.dispose();
    for (const g of crop.ownGeos) g.dispose();
  }

  // --------------------------------------------------------------- readout
  private comboMult(): number {
    return Math.min(5, 1 + this.combo * 0.1);
  }
  private summary(): HarvestSummary {
    return {
      score: this.score,
      perfect: this.counts.perfect,
      great: this.counts.great,
      good: this.counts.good,
      miss: this.counts.poor + this.counts.miss,
      highestCombo: this.highestCombo,
      harvests: this.counts.perfect + this.counts.great + this.counts.good + this.counts.poor,
    };
  }

  snapshot(): HarvestSnapshot {
    return {
      score: this.score,
      timeRemaining: Math.max(0, Math.ceil(GAME_DURATION - this.elapsed)),
      combo: this.combo,
      comboMult: this.comboMult(),
      phase: this.phase,
      lastGrade: this.lastGrade,
      gradeId: this.gradeId,
      floaters: this.floaters.slice(),
      running: this.running,
    };
  }
}

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
