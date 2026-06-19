import * as THREE from 'three';
import { Animal, RARITY, Rarity, Theme, THEMES } from './safari-data';
import { loadAnimalModel } from './safari-models';

/**
 * Animal Safari Match — self-contained Three.js board engine.
 *
 * Responsibilities:
 *  - Owns the WebGL renderer, scene, camera, lights and a procedurally-built
 *    low-poly safari field (ground, trees, drifting clouds), tinted per theme.
 *  - Builds a grid of "safari tents". Tapping a tent opens it (tent lifts away,
 *    the animal pops up with a bounce). It runs the authoritative memory-match
 *    state machine — reveal, compare, the 1.5 s "stay visible" on a mismatch,
 *    and the celebrate-then-walk-into-the-parade reward on a match.
 *  - Exposes a cheap snapshot the Angular HUD polls, and fires callbacks
 *    (outside Angular's zone) with viewport coordinates for particle "juice".
 *
 * There are NO fail states, timers or penalties — the board simply ends when
 * every pair is matched (PRD §2.1). The RAF loop must be started from outside
 * Angular's zone (the component does this).
 */

export interface SafariSnapshot {
  matched: number;
  total: number;
  moves: number;
  running: boolean;
}

export interface SafariCallbacks {
  /** A tent was opened. Coords are viewport px (for JuiceService / sound). */
  onReveal?: (info: { animalId: string; rarity: Rarity; x: number; y: number }) => void;
  /** A pair was resolved. matched=false ⇒ the two will close after the look-time. */
  onPair?: (info: {
    matched: boolean;
    animalId: string;
    otherId: string;
    rarity: Rarity;
    x: number;
    y: number;
  }) => void;
  /** Every pair matched — the board is complete. */
  onComplete?: (summary: { pairs: number; moves: number; durationSeconds: number }) => void;
}

type CardPhase = 'hidden' | 'revealing' | 'revealed' | 'mismatch' | 'matching' | 'matched';

interface Card {
  index: number;
  animal: Animal;
  pairKey: string;
  slot: THREE.Vector3;
  group: THREE.Group;
  tent: THREE.Mesh;
  tentMat: THREE.MeshStandardMaterial;
  flagMat: THREE.MeshStandardMaterial;
  pedestalMat: THREE.MeshStandardMaterial;
  animalMesh: THREE.Mesh; // emoji "card" billboard (fallback / shown until a model loads)
  animalMat: THREE.MeshBasicMaterial;
  animalTex: THREE.CanvasTexture;
  modelRoot?: THREE.Object3D; // real 3D model holder, once loaded (replaces the billboard)
  phase: CardPhase;
  phaseT: number; // seconds in the current phase
  bob: number; // per-card bob phase offset
}

// timings (seconds)
const REVEAL = 0.32;
const CLOSE = 0.3;
const CELEBRATE = 0.55;
const WALK = 0.75;
const MISMATCH_LOOK = 1.5; // PRD §3: animals stay visible 1.5 s on a mismatch
const MATCH_SETTLE = 0.4; // brief beat so both animals are seen before celebrating
const COMPLETE_DELAY = 1.1; // let the last celebration play before onComplete

// layout
const COLS = 4;
const CELL_X = 2.0;
const CELL_Z = 2.0;
const TENT_H = 0.96;
const TENT_R = 0.66;
const ANIMAL_Y = 0.92;
const ANIMAL_SIZE = 1.34;
const TENT_LIFT = 1.7;
const MODEL_BASE_Y = 0.18; // 3D model feet rest just above the pedestal
const MODEL_YAW = -0.4; // face the camera at a lively 3/4 angle (0 = straight at camera)

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export class SafariEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private boardGroup = new THREE.Group();
  private envGroup = new THREE.Group();
  private clouds: THREE.Group[] = [];

  private cards: Card[] = [];

  private sharedGeo = new Map<string, THREE.BufferGeometry>();

  private raf = 0;
  private running = false; // a board is in play
  private idleActive = false; // render the living field (home screen backdrop)
  private suspended = false; // tab hidden — halt the RAF entirely
  private time = 0;
  private elapsed = 0;

  // match state
  private flipped: Card[] = [];
  private locked = false;
  private resolveTimer = 0;
  private pendingMatch: boolean | null = null;
  private completeTimer = 0;
  private completeFired = false;
  private matchedPairs = 0;
  private totalPairs = 0;
  private moves = 0;

  private paradeTarget = new THREE.Vector3(-4.5, 1.6, -1.2);
  private gridSpan = 6;

  constructor(
    private canvas: HTMLCanvasElement,
    private cb: SafariCallbacks = {},
  ) {
    const isCoarse =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 760);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isCoarse,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isCoarse ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);

    this.scene.add(this.envGroup);
    this.scene.add(this.boardGroup);
    this.buildLights();
    this.applyTheme('savanna');

    this.onPointerDown = this.onPointerDown.bind(this);
    this.loop = this.loop.bind(this);
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: true });

    this.resize();
    this.renderOnce();
  }

  // -------------------------------------------------------------- lights/env
  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6f8f4a', 1.0));
    const key = new THREE.DirectionalLight('#fff3d6', 1.1);
    key.position.set(5, 10, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#bcd6ff', 0.32);
    rim.position.set(-6, 5, -5);
    this.scene.add(rim);
  }

  private geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
    let g = this.sharedGeo.get(key);
    if (!g) {
      g = make();
      this.sharedGeo.set(key, g);
    }
    return g;
  }

  private applyTheme(themeId: Theme): void {
    const theme = THEMES.find(t => t.id === themeId) ?? THEMES[0];
    this.scene.background = new THREE.Color(theme.sky);
    this.scene.fog = new THREE.Fog(theme.sky, 20, 42);

    // rebuild decorative field for the theme
    this.disposeGroup(this.envGroup);
    this.clouds = [];

    // ground
    const ground = new THREE.Mesh(
      this.geo('ground', () => new THREE.CircleGeometry(26, 48).rotateX(-Math.PI / 2)),
      new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1, flatShading: true }),
    );
    ground.position.y = -0.02;
    this.envGroup.add(ground);

    // a soft darker patch under the board so tents read clearly
    const pad = new THREE.Mesh(
      this.geo('pad', () => new THREE.CircleGeometry(7.4, 40).rotateX(-Math.PI / 2)),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(theme.ground).multiplyScalar(0.9),
        roughness: 1,
        transparent: true,
        opacity: 0.55,
      }),
    );
    pad.position.y = 0;
    this.envGroup.add(pad);

    // trees / props around the edge
    const foliage = themeId === 'riverside' ? '#2fab8f' : themeId === 'farmyard' ? '#4faa3a' : '#5a9a3a';
    const treeSpots: [number, number][] = [
      [-9, -7], [9, -7.5], [-10, 2], [10.5, 1.5], [-6.5, -9.5], [6.5, -9.5],
    ];
    for (const [x, z] of treeSpots) this.envGroup.add(this.makeTree(x, z, foliage));

    // drifting clouds
    for (let i = 0; i < 5; i++) {
      const c = this.makeCloud();
      c.position.set(-14 + i * 6.5, 7.5 + (i % 2) * 1.6, -12 - (i % 3) * 2);
      this.envGroup.add(c);
      this.clouds.push(c);
    }
  }

  private makeTree(x: number, z: number, foliage: string): THREE.Group {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
      this.geo('trunk', () => new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6)),
      new THREE.MeshStandardMaterial({ color: '#8a5a32', roughness: 1, flatShading: true }),
    );
    trunk.position.y = 0.8;
    g.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: foliage, roughness: 1, flatShading: true });
    const top = new THREE.Mesh(this.geo('leaf', () => new THREE.IcosahedronGeometry(1.15, 0)), leafMat);
    top.position.y = 2.0;
    g.add(top);
    const top2 = new THREE.Mesh(this.geo('leaf2', () => new THREE.IcosahedronGeometry(0.8, 0)), leafMat);
    top2.position.set(0.5, 1.55, 0.3);
    g.add(top2);
    g.position.set(x, 0, z);
    g.scale.setScalar(0.9 + ((x + z) % 3) * 0.12);
    return g;
  }

  private makeCloud(): THREE.Group {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true });
    const puffs: [number, number, number, number][] = [
      [0, 0, 0, 1], [1.1, -0.1, 0, 0.78], [-1.1, -0.05, 0.1, 0.72], [0.4, 0.4, -0.2, 0.66],
    ];
    for (const [px, py, pz, s] of puffs) {
      const m = new THREE.Mesh(this.geo('puff', () => new THREE.IcosahedronGeometry(1, 0)), mat);
      m.position.set(px, py, pz);
      m.scale.setScalar(s);
      g.add(m);
    }
    return g;
  }

  // ---------------------------------------------------------------- textures
  private makeAnimalTexture(animal: Animal): THREE.CanvasTexture {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const info = RARITY[animal.rarity];

    // soft drop shadow card
    this.roundRect(ctx, 18, 16, S - 36, S - 30, 34);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fill();

    // card body gradient
    const grad = ctx.createLinearGradient(0, 12, 0, S - 12);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, info.glow);
    this.roundRect(ctx, 14, 12, S - 32, S - 30, 32);
    ctx.fillStyle = grad;
    ctx.fill();

    // rarity ring
    ctx.lineWidth = 10;
    ctx.strokeStyle = info.color;
    this.roundRect(ctx, 19, 17, S - 42, S - 40, 28);
    ctx.stroke();

    // emoji
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '128px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.fillText(animal.emoji, S / 2, S / 2 - 18);

    // name
    ctx.fillStyle = '#3a3550';
    ctx.font = '700 30px "Inter", system-ui, sans-serif';
    ctx.fillText(animal.name, S / 2, S - 44);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
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

  // ------------------------------------------------------------------- board
  /** Build a fresh board from a pre-shuffled deck (each animal appears twice). */
  start(opts: { theme: Theme; deck: Animal[] }): void {
    this.disposeCards();
    this.applyTheme(opts.theme);

    const deck = opts.deck;
    this.totalPairs = deck.length / 2;
    this.matchedPairs = 0;
    this.moves = 0;
    this.flipped = [];
    this.locked = false;
    this.resolveTimer = 0;
    this.pendingMatch = null;
    this.completeTimer = 0;
    this.completeFired = false;
    this.elapsed = 0;

    const rows = Math.ceil(deck.length / COLS);
    const colsUsed = Math.min(COLS, deck.length);
    const xOffset = -((colsUsed - 1) * CELL_X) / 2;
    const zOffset = -((rows - 1) * CELL_Z) / 2;
    this.gridSpan = Math.max(colsUsed * CELL_X, rows * CELL_Z);
    this.paradeTarget.set(xOffset - 2.6, 1.7, zOffset - 0.4);

    for (let i = 0; i < deck.length; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      // last row may be short → center it
      const rowCount = Math.min(COLS, deck.length - row * COLS);
      const rowXOffset = -((rowCount - 1) * CELL_X) / 2;
      const x = col * CELL_X + rowXOffset;
      const z = row * CELL_Z + zOffset;
      this.cards.push(this.makeCard(i, deck[i], new THREE.Vector3(x, 0, z)));
    }

    this.resize();
    this.running = true;
    this.idleActive = true;
    this.clock.getDelta(); // discard any gap since the last frame
    this.kick();

    this.attachModels();
  }

  /**
   * Asynchronously swap each card's emoji billboard for its real 3D model when
   * available. The billboard is shown instantly and remains the fallback for any
   * animal without a `.glb` (see safari-models.ts).
   */
  private attachModels(): void {
    for (const card of this.cards) {
      loadAnimalModel(card.animal.model).then(holder => {
        // guard: the board may have been torn down (new game / dispose) meanwhile
        if (!holder || !this.cards.includes(card) || card.phase === 'matched') return;
        holder.position.y = MODEL_BASE_Y;
        holder.rotation.y = MODEL_YAW;
        holder.scale.setScalar(Math.max(0.0001, card.animalMesh.scale.x)); // continuity
        card.group.add(holder);
        card.animalMesh.visible = false; // hide the card; the model takes over
        card.modelRoot = holder;
      });
    }
  }

  private makeCard(index: number, animal: Animal, slot: THREE.Vector3): Card {
    const group = new THREE.Group();
    group.position.copy(slot);

    // pedestal
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: '#e7d3a8',
      roughness: 1,
      flatShading: true,
      transparent: true,
      opacity: 1,
    });
    const pedestal = new THREE.Mesh(
      this.geo('pedestal', () => new THREE.CylinderGeometry(0.82, 0.92, 0.16, 18)),
      pedestalMat,
    );
    pedestal.position.y = 0.08;
    group.add(pedestal);

    // tent (4-sided cone) — identical for every card so closed tents give nothing away
    const tentMat = new THREE.MeshStandardMaterial({
      color: '#e7674f',
      roughness: 0.85,
      flatShading: true,
      transparent: true,
      opacity: 1,
    });
    const tent = new THREE.Mesh(
      this.geo('tent', () => new THREE.ConeGeometry(TENT_R, TENT_H, 4).rotateY(Math.PI / 4)),
      tentMat,
    );
    tent.position.y = TENT_H / 2 + 0.14;
    group.add(tent);

    // little flag knob on top
    const flagMat = new THREE.MeshStandardMaterial({
      color: '#ffd24a',
      roughness: 0.8,
      flatShading: true,
      transparent: true,
      opacity: 1,
    });
    const flag = new THREE.Mesh(this.geo('flag', () => new THREE.SphereGeometry(0.12, 8, 6)), flagMat);
    flag.position.y = TENT_H / 2 + 0.06; // at the tent's tip (local to the cone)
    tent.add(flag);

    // animal billboard (hidden until revealed)
    const animalTex = this.makeAnimalTexture(animal);
    const animalMat = new THREE.MeshBasicMaterial({
      map: animalTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const animalMesh = new THREE.Mesh(
      this.geo('animalPlane', () => new THREE.PlaneGeometry(ANIMAL_SIZE, ANIMAL_SIZE)),
      animalMat,
    );
    animalMesh.position.y = ANIMAL_Y;
    animalMesh.scale.setScalar(0.001);
    animalMesh.renderOrder = 5;
    group.add(animalMesh);

    this.boardGroup.add(group);

    return {
      index,
      animal,
      pairKey: animal.id,
      slot: slot.clone(),
      group,
      tent,
      tentMat,
      flagMat,
      pedestalMat,
      animalMesh,
      animalMat,
      animalTex,
      phase: 'hidden',
      phaseT: 0,
      bob: (index % 7) * 0.9,
    };
  }

  // ------------------------------------------------------------- match logic
  private onPointerDown(ev: PointerEvent): void {
    if (!this.running || this.locked) return;
    // Pick the closest still-closed tent in *screen space*. Unlike a 3D raycast,
    // this can't be fooled by a front-row tent occluding the row behind it, and
    // it gives a generous, finger-friendly tap radius (≈ one grid cell).
    let best: Card | null = null;
    let bestD = Infinity;
    let radius = Infinity;
    for (const card of this.cards) {
      if (card.phase !== 'hidden') continue;
      const center = this.worldToScreen(card.group.position.clone().setY(0.55));
      const dx = center.x - ev.clientX;
      const dy = center.y - ev.clientY;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = card;
        const edge = this.worldToScreen(
          card.group.position.clone().add(new THREE.Vector3(CELL_X * 0.5, 0.55, 0)),
        );
        radius = Math.hypot(edge.x - center.x, edge.y - center.y);
      }
    }
    if (best && Math.sqrt(bestD) <= radius * 1.25) this.tapCard(best);
  }

  private tapCard(card: Card): void {
    if (!card || card.phase !== 'hidden' || this.flipped.length >= 2) return;

    card.phase = 'revealing';
    card.phaseT = 0;
    this.flipped.push(card);

    const p = this.worldToScreen(card.group.position.clone().setY(ANIMAL_Y));
    this.cb.onReveal?.({ animalId: card.animal.id, rarity: card.animal.rarity, x: p.x, y: p.y });

    if (this.flipped.length === 2) {
      this.moves++;
      this.locked = true;
      const [a, b] = this.flipped;
      this.pendingMatch = a.pairKey === b.pairKey;
      this.resolveTimer = this.pendingMatch ? REVEAL + MATCH_SETTLE : MISMATCH_LOOK;
    }
  }

  private resolvePair(): void {
    const [a, b] = this.flipped;
    if (!a || !b) {
      this.flipped = [];
      this.locked = false;
      this.pendingMatch = null;
      return;
    }
    const matched = this.pendingMatch === true;
    const mid = a.group.position.clone().add(b.group.position).multiplyScalar(0.5).setY(ANIMAL_Y + 0.4);
    const sp = this.worldToScreen(mid);
    this.cb.onPair?.({
      matched,
      animalId: a.animal.id,
      otherId: b.animal.id,
      rarity: a.animal.rarity,
      x: sp.x,
      y: sp.y,
    });

    if (matched) {
      a.phase = 'matching';
      a.phaseT = 0;
      b.phase = 'matching';
      b.phaseT = 0;
      this.matchedPairs++;
      if (this.matchedPairs >= this.totalPairs) {
        this.completeTimer = COMPLETE_DELAY;
      }
    } else {
      a.phase = 'mismatch';
      a.phaseT = 0;
      b.phase = 'mismatch';
      b.phaseT = 0;
    }
    this.flipped = [];
    this.locked = false;
    this.pendingMatch = null;
  }

  // -------------------------------------------------------------------- loop
  private loop(): void {
    if (this.suspended || (!this.running && !this.idleActive)) {
      this.raf = 0;
      return;
    }
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    if (this.running) {
      this.elapsed += dt;

      // resolve a pending pair after its look-time
      if (this.resolveTimer > 0) {
        this.resolveTimer -= dt;
        if (this.resolveTimer <= 0) this.resolvePair();
      }

      // fire completion once the final celebration has played
      if (this.completeTimer > 0 && !this.completeFired) {
        this.completeTimer -= dt;
        if (this.completeTimer <= 0) {
          this.completeFired = true;
          this.cb.onComplete?.({
            pairs: this.totalPairs,
            moves: this.moves,
            durationSeconds: Math.round(this.elapsed),
          });
        }
      }

      for (const card of this.cards) this.updateCard(card, dt);
    }

    this.updateEnv(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.loop);
  }

  private updateCard(card: Card, dt: number): void {
    card.phaseT += dt;
    // The "avatar" is the real 3D model once loaded, else the emoji billboard.
    const model = card.modelRoot;
    const av: THREE.Object3D = model ?? card.animalMesh;
    const baseY = model ? MODEL_BASE_Y : ANIMAL_Y;
    const setOpacity = (o: number): void => {
      if (!model) card.animalMat.opacity = clamp01(o); // models keep their textured materials
    };
    const face = (): void => {
      if (model) av.rotation.set(0, MODEL_YAW, 0); // upright, facing camera
      else av.quaternion.copy(this.camera.quaternion); // billboard
    };

    switch (card.phase) {
      case 'hidden': {
        // closed tent sways gently
        card.tent.rotation.z = Math.sin(this.time * 1.4 + card.bob) * 0.02;
        break;
      }
      case 'revealing': {
        const p = clamp01(card.phaseT / REVEAL);
        const lift = easeOutCubic(p);
        card.tent.position.y = TENT_H / 2 + 0.14 + lift * TENT_LIFT;
        card.tent.scale.setScalar(1 + lift * 0.2);
        this.setTentOpacity(card, 1 - lift);
        av.scale.setScalar(Math.max(0.001, easeOutBack(p)));
        setOpacity(p * 1.3);
        av.position.y = baseY + (1 - p) * -0.25;
        face();
        if (p >= 1) {
          card.phase = 'revealed';
          card.phaseT = 0;
          card.tent.visible = false;
        }
        break;
      }
      case 'revealed': {
        av.position.y = baseY + Math.sin(this.time * 3 + card.bob) * 0.05;
        av.scale.setScalar(1 + Math.sin(this.time * 3 + card.bob) * 0.02);
        face();
        break;
      }
      case 'mismatch': {
        const p = clamp01(card.phaseT / CLOSE);
        // animal shrinks away
        av.scale.setScalar(Math.max(0.001, 1 - easeOutCubic(p)));
        setOpacity(1 - p);
        // tent drops back down + fades in
        card.tent.visible = true;
        const lift = 1 - easeOutCubic(p);
        card.tent.position.y = TENT_H / 2 + 0.14 + lift * TENT_LIFT;
        card.tent.scale.setScalar(1 + lift * 0.2);
        this.setTentOpacity(card, p);
        face();
        if (p >= 1) {
          card.phase = 'hidden';
          card.phaseT = 0;
          av.scale.setScalar(0.001);
          av.position.y = baseY;
          setOpacity(0);
          card.tent.position.y = TENT_H / 2 + 0.14;
          card.tent.scale.setScalar(1);
          this.setTentOpacity(card, 1);
        }
        break;
      }
      case 'matching': {
        if (card.phaseT < CELEBRATE) {
          // two happy hops in place, with a little wiggle
          const j = card.phaseT / CELEBRATE;
          av.position.y = baseY + Math.abs(Math.sin(j * Math.PI * 2)) * 0.55;
          av.scale.setScalar(1);
          setOpacity(1);
          this.fadePedestal(card, 1 - j * 0.4);
          if (model) {
            av.rotation.set(0, MODEL_YAW + Math.sin(j * Math.PI * 6) * 0.22, 0);
          } else {
            av.quaternion.copy(this.camera.quaternion);
            av.rotateZ(Math.sin(j * Math.PI * 6) * 0.18);
          }
        } else {
          // walk into the parade: drift toward the parade point, rise, shrink, fade
          const w = clamp01((card.phaseT - CELEBRATE) / WALK);
          const e = easeOutCubic(w);
          const from = card.slot;
          card.group.position.x = from.x + (this.paradeTarget.x - from.x) * e;
          card.group.position.z = from.z + (this.paradeTarget.z - from.z) * e;
          av.position.y = baseY + e * 1.0 + Math.abs(Math.sin(w * Math.PI * 3)) * 0.16;
          av.scale.setScalar(Math.max(0.001, 1 - e * 0.7));
          setOpacity(1 - e);
          this.fadePedestal(card, 0.6 * (1 - e));
          face();
          if (w >= 1) {
            card.phase = 'matched';
            card.group.visible = false;
          }
        }
        break;
      }
      case 'matched':
        break;
    }
  }

  private setTentOpacity(card: Card, o: number): void {
    const v = clamp01(o);
    card.tentMat.opacity = v;
    card.flagMat.opacity = v;
  }

  private fadePedestal(card: Card, o: number): void {
    card.pedestalMat.opacity = clamp01(o);
  }

  private updateEnv(dt: number): void {
    for (const c of this.clouds) {
      c.position.x += dt * 0.35;
      if (c.position.x > 18) c.position.x = -18;
    }
  }

  // ----------------------------------------------------------- screen helper
  private worldToScreen(v: THREE.Vector3): { x: number; y: number } {
    const p = v.clone().project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + (p.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-p.y * 0.5 + 0.5) * rect.height,
    };
  }

  // -------------------------------------------------------------- lifecycle
  /** Render the living field as a backdrop (home screen) with no board. */
  idle(): void {
    this.idleActive = true;
    this.kick();
  }

  /** Recolour the idle backdrop to preview a theme (ignored while a board is live). */
  previewTheme(theme: Theme): void {
    if (this.running) return;
    this.applyTheme(theme);
  }

  /** Tear down the current board and return to the idle field. */
  clearBoard(): void {
    this.disposeCards();
    this.running = false;
    this.completeFired = false;
    this.flipped = [];
    this.locked = false;
    this.resolveTimer = 0;
    this.pendingMatch = null;
    this.completeTimer = 0;
    this.totalPairs = 0;
    this.matchedPairs = 0;
    this.moves = 0;
    this.idle();
  }

  /** Tab hidden / leaving — stop the RAF entirely to save battery. */
  suspend(): void {
    this.suspended = true;
  }
  /** Tab visible again — resume rendering if there's anything to show. */
  wake(): void {
    if (!this.suspended) return;
    this.suspended = false;
    this.clock.getDelta(); // discard the gap
    this.kick();
  }

  private kick(): void {
    if (!this.raf && !this.suspended && (this.running || this.idleActive)) {
      this.raf = requestAnimationFrame(this.loop);
    }
  }

  snapshot(): SafariSnapshot {
    return {
      matched: this.matchedPairs,
      total: this.totalPairs,
      moves: this.moves,
      running: this.running,
    };
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;

    // frame the board: pull back on narrow / portrait screens so it always fits
    const fit = this.gridSpan * 0.92 + 3.2;
    const portrait = aspect < 1 ? Math.min(2.0, 0.8 + 0.5 / aspect) : 1;
    const d = fit * portrait;
    this.camera.position.set(0, d * 0.86, d * 0.72);
    this.camera.lookAt(0, 0.2, -0.3);
    this.camera.updateProjectionMatrix();
    this.renderOnce();
  }

  private renderOnce(): void {
    if (!this.running) this.renderer.render(this.scene, this.camera);
  }

  // ----------------------------------------------------------------- dispose
  private disposeCards(): void {
    for (const card of this.cards) {
      this.boardGroup.remove(card.group);
      card.tentMat.dispose();
      card.flagMat.dispose();
      card.pedestalMat.dispose();
      card.animalMat.dispose();
      card.animalTex.dispose();
    }
    this.cards = [];
  }

  private disposeGroup(group: THREE.Group): void {
    for (let i = group.children.length - 1; i >= 0; i--) {
      const child = group.children[i];
      child.traverse(o => {
        const m = o as THREE.Mesh;
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) (Array.isArray(mat) ? mat : [mat]).forEach(x => x.dispose?.());
        // geometries are shared via this.geo() and disposed at teardown
      });
      group.remove(child);
    }
  }

  dispose(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.disposeCards();
    this.disposeGroup(this.envGroup);
    this.scene.traverse(o => {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat) (Array.isArray(mat) ? mat : [mat]).forEach(x => x.dispose?.());
    });
    this.sharedGeo.forEach(g => g.dispose());
    this.sharedGeo.clear();
    this.renderer.dispose();
  }
}
