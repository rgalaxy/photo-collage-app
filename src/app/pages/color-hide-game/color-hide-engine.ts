import * as THREE from 'three';
import { HSL, hslToRgb } from './color-hide-data';
import { GemSkin } from './color-hide-cosmetics';

/**
 * Color Hide — the 3D centrepiece.
 *
 * A faceted crystal "gem" floats at the centre of the stage. It blooms to the
 * round's target colour, then "hides" (desaturates + scrambles) so the player
 * must match from memory, and shatters in a burst of light on a Perfect. A soft
 * additive glow behind it bleeds the colour into the scene.
 *
 * The canvas is transparent — the component's CSS supplies the ambient gradient
 * (deliberately not the site's brand nebula, so the target colour reads true).
 *
 * Lifecycle mirrors the other games: the RAF loop is started from OUTSIDE
 * Angular's zone, DPR is capped, and dispose() frees every GPU resource.
 */

interface Shard {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  life: number; // 1 → 0
  active: boolean;
}

type GemState = 'idle' | 'revealed' | 'guess' | 'result';

const HIDDEN_COLOR: THREE.ColorRepresentation = '#3a3a48';
// lift the gem into the upper half of the stage so the control panel never covers it
const BASE_Y = 0.8;

export class ColorHideEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();

  private gem: THREE.Mesh;
  private gemMat: THREE.MeshStandardMaterial;
  private gemGeo: THREE.BufferGeometry;
  private glow: THREE.Sprite;
  private glowMat: THREE.SpriteMaterial;

  private shards: Shard[] = [];
  private shardGeo: THREE.BufferGeometry;
  private shardMat: THREE.MeshStandardMaterial;

  private raf = 0;
  private paused = false;
  private disposed = false;
  private reduced = false;

  private state: GemState = 'idle';
  private gemVisible = true;
  private time = 0;

  // animated properties (eased toward targets each frame)
  private curColor = new THREE.Color(HIDDEN_COLOR);
  private tgtColor = new THREE.Color(HIDDEN_COLOR);
  private curScale = 1;
  private tgtScale = 1;
  private pulse = 0; // decays to 0
  private spinSpeed = 0.5; // rad/s baseline
  private wobble = 0; // extra chaotic spin while hidden

  // skin
  private wireMat!: THREE.LineBasicMaterial;
  private skinEmissive = 0.6;
  private shimmer = false;
  private readonly shimmerColor = new THREE.Color();
  private sparkleOn = false;
  private skinSparkle = false;
  private sparkleGroup = new THREE.Group();
  private sparkles: THREE.Sprite[] = [];
  private sparkleMat!: THREE.SpriteMaterial;
  private sparklePhase: number[] = [];
  private sparkleBase: number[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    const coarse =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 760);
    this.reduced =
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !coarse,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    this.camera.position.set(0, 0, 5.4);
    this.camera.lookAt(0, 0, 0);

    this.buildLights();

    // ---- the gem ----
    this.gemGeo = new THREE.IcosahedronGeometry(0.92, 0);
    this.gemMat = new THREE.MeshStandardMaterial({
      color: this.curColor.clone(),
      roughness: 0.28,
      metalness: 0.12,
      flatShading: true,
      emissive: new THREE.Color('#000000'),
      emissiveIntensity: 0.6,
    });
    this.gem = new THREE.Mesh(this.gemGeo, this.gemMat);
    this.gem.position.y = BASE_Y;
    this.scene.add(this.gem);

    // subtle darker facets overlay (wireframe) for the "cut crystal" read (skinnable)
    this.wireMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14 });
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(this.gemGeo), this.wireMat);
    this.gem.add(wire);

    // ---- glow behind the gem ----
    this.glowMat = new THREE.SpriteMaterial({
      map: this.makeGlowTexture(),
      color: new THREE.Color(HIDDEN_COLOR),
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glow = new THREE.Sprite(this.glowMat);
    this.glow.scale.set(7.5, 7.5, 1);
    this.glow.position.set(0, BASE_Y, -1.5);
    this.scene.add(this.glow);

    // ---- shard pool (for shatter) ----
    this.shardGeo = new THREE.TetrahedronGeometry(0.32, 0);
    this.shardMat = new THREE.MeshStandardMaterial({
      color: this.curColor.clone(),
      roughness: 0.3,
      metalness: 0.1,
      flatShading: true,
    });
    for (let i = 0; i < 22; i++) {
      const mesh = new THREE.Mesh(this.shardGeo, this.shardMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.shards.push({
        mesh,
        vel: new THREE.Vector3(),
        spin: new THREE.Vector3(),
        life: 0,
        active: false,
      });
    }

    this.buildSparkles();

    this.loop = this.loop.bind(this);
    this.resize();
  }

  private buildSparkles(): void {
    this.sparkleMat = new THREE.SpriteMaterial({
      map: this.makeStarTexture(),
      color: new THREE.Color('#ffffff'),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sparkleGroup.position.set(0, BASE_Y, 0);
    this.sparkleGroup.visible = false;
    this.scene.add(this.sparkleGroup);
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(this.sparkleMat);
      const a = Math.random() * Math.PI * 2;
      const b = Math.acos(Math.random() * 2 - 1);
      const r = 1.35 + Math.random() * 0.95;
      sp.position.set(
        Math.sin(b) * Math.cos(a) * r,
        Math.cos(b) * r * 0.8,
        Math.sin(b) * Math.sin(a) * r * 0.35 - 0.2,
      );
      const base = 0.12 + Math.random() * 0.18;
      sp.scale.setScalar(base);
      this.sparkleBase.push(base);
      this.sparklePhase.push(Math.random() * Math.PI * 2);
      this.sparkles.push(sp);
      this.sparkleGroup.add(sp);
    }
  }

  private makeStarTexture(): THREE.Texture {
    const s = 64;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d')!;
    const cx = s / 2;
    const cy = s / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, 5);
    ctx.lineTo(cx, s - 5);
    ctx.moveTo(5, cy);
    ctx.lineTo(s - 5, cy);
    ctx.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Apply a collectible skin — finish, wireframe, sparkle + shimmer. */
  setSkin(skin: GemSkin): void {
    this.gemMat.metalness = skin.metalness;
    this.gemMat.roughness = skin.roughness;
    this.skinEmissive = skin.emissiveIntensity;
    this.shimmer = skin.shimmer;
    this.wireMat.color.set(skin.wireColor);
    this.wireMat.opacity = skin.wireOpacity;
    this.sparkleMat.color.set(skin.accent);
    this.skinSparkle = skin.sparkle;
    this.sparkleGroup.visible = skin.sparkle && this.gemVisible;
    this.sparkleOn = skin.sparkle && this.gemVisible && !this.reduced;
    this.start();
    if (!this.raf) this.renderOnce();
  }

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#2a2a3a', 1.0));
    const key = new THREE.DirectionalLight('#ffffff', 1.5);
    key.position.set(3, 5, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#8ea2ff', 0.5);
    rim.position.set(-5, -2, -3);
    this.scene.add(rim);
  }

  private makeGlowTexture(): THREE.Texture {
    const s = 256;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // ------------------------------------------------------------ public API
  /** Start the ambient loop (intro / backdrop). */
  idle(): void {
    this.setGemVisible(true);
    this.state = 'idle';
    this.setColor('#5b5bf5', 0.4);
    this.start();
  }

  /** Show/hide the gem + glow (Seek mode renders no sphere). */
  setGemVisible(v: boolean): void {
    this.gemVisible = v;
    this.gem.visible = v;
    this.glow.visible = v;
    this.sparkleGroup.visible = v && this.skinSparkle;
    this.sparkleOn = v && this.skinSparkle && !this.reduced;
    if (!v) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    this.renderOnce();
  }

  /**
   * Enter the guess phase. The gem resets to WHITE (a clear "blank canvas" — the
   * answer is hidden) and only starts mirroring the player's colour once they
   * move a control (see setGuess), so it's never confused with the target.
   */
  startGuess(): void {
    // the gem is hidden during the reveal — bring it back as the white canvas
    this.gemVisible = true;
    this.gem.visible = true;
    this.glow.visible = true;
    // restore the equipped skin's sparkles (they were switched off while hidden)
    this.sparkleGroup.visible = this.skinSparkle;
    this.sparkleOn = this.skinSparkle && !this.reduced;
    this.state = 'guess';
    this.setColor('#ffffff', 0.42);
    this.tgtScale = 1.0;
    this.pulse = 0.35;
    this.wobble = 0;
    this.spinSpeed = this.reduced ? 0 : 0.4;
    this.start();
  }

  /** Live-update the gem to the player's current colour (guess phase only). */
  setGuess(hsl: HSL): void {
    if (this.state !== 'guess') return;
    this.setColorHsl(hsl, 0.5);
    this.start();
  }

  /** Reveal the true colour again for the result; shatter on a Perfect. */
  showResult(hsl: HSL, perfect: boolean): void {
    this.state = 'result';
    this.setColorHsl(hsl, 0.9);
    this.tgtScale = 1.08;
    this.pulse = 1;
    this.wobble = 0;
    this.spinSpeed = this.reduced ? 0 : 0.5;
    if (perfect) this.shatter();
    this.start();
  }

  /** Where the gem sits on screen, in viewport px — for particle bursts. */
  gemScreenPos(): { x: number; y: number } {
    const v = new THREE.Vector3(0, BASE_Y, 0).project(this.camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: rect.left + ((v.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - v.y) / 2) * rect.height,
    };
  }

  resize(): void {
    const w = this.canvas.clientWidth || this.canvas.width || 1;
    const h = this.canvas.clientHeight || this.canvas.height || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // pull back a touch on portrait so the gem never crowds the frame
    this.camera.position.z = w / h < 0.85 ? 7.6 : 6.6;
    this.camera.updateProjectionMatrix();
    if (this.paused || !this.raf) this.renderOnce();
  }

  pause(): void {
    this.paused = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resume(): void {
    if (this.disposed) return;
    this.paused = false;
    this.clock.getDelta();
    this.start();
  }

  dispose(): void {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.gemGeo.dispose();
    this.gemMat.dispose();
    this.shardGeo.dispose();
    this.shardMat.dispose();
    this.glowMat.map?.dispose();
    this.glowMat.dispose();
    this.sparkleMat.map?.dispose();
    this.sparkleMat.dispose();
    this.gem.traverse(o => {
      const seg = o as THREE.LineSegments;
      if (seg.geometry) seg.geometry.dispose?.();
      const m = seg.material as THREE.Material | undefined;
      m?.dispose?.();
    });
    this.renderer.dispose();
  }

  // ------------------------------------------------------------ internals
  private setColorHsl(hsl: HSL, glow: number): void {
    const rgb = hslToRgb(hsl);
    this.tgtColor.setRGB(rgb.r / 255, rgb.g / 255, rgb.b / 255, THREE.SRGBColorSpace);
    this.glowTarget = glow;
  }
  private setColor(hex: THREE.ColorRepresentation, glow: number): void {
    this.tgtColor.set(hex);
    this.glowTarget = glow;
  }
  private glowTarget = 0;
  private glowCur = 0;

  private shatter(): void {
    if (this.reduced) return;
    let n = 0;
    for (const s of this.shards) {
      if (s.active) continue;
      s.active = true;
      s.life = 1;
      s.mesh.visible = true;
      s.mesh.position.set(0, BASE_Y, 0);
      s.mesh.material = this.shardMat;
      const dir = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize();
      s.vel.copy(dir).multiplyScalar(2.5 + Math.random() * 2.5);
      s.spin.set(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
      );
      if (++n >= 16) break;
    }
    // shards carry the gem's current colour
    this.shardMat.color.copy(this.tgtColor);
    // briefly collapse the gem, then it re-forms via the eased scale
    this.curScale = 0.2;
  }

  private start(): void {
    if (this.raf || this.paused || this.disposed) return;
    this.clock.getDelta();
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop(): void {
    if (this.paused || this.disposed) {
      this.raf = 0;
      return;
    }
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    // ease colour + glow
    this.curColor.lerp(this.tgtColor, 1 - Math.pow(0.001, dt));
    this.gemMat.color.copy(this.curColor);
    if (this.shimmer && !this.reduced) {
      // iridescent rainbow sheen (Aurora / Unicorn)
      this.shimmerColor.setHSL((this.time * 0.08) % 1, 0.8, 0.55);
      this.gemMat.emissive.copy(this.shimmerColor);
      this.gemMat.emissiveIntensity = this.skinEmissive * 0.55 + this.pulse * 0.9;
    } else {
      this.gemMat.emissive.copy(this.curColor);
      this.gemMat.emissiveIntensity = this.skinEmissive * 0.5 + this.pulse * 0.9;
    }
    this.glowCur += (this.glowTarget - this.glowCur) * (1 - Math.pow(0.002, dt));
    this.glowMat.color.copy(this.curColor);
    this.glowMat.opacity = this.glowCur * (0.55 + this.pulse * 0.35);

    // ease scale + pulse
    this.pulse *= Math.pow(0.02, dt);
    this.curScale += (this.tgtScale - this.curScale) * (1 - Math.pow(0.004, dt));
    const s = this.curScale * (1 + this.pulse * 0.14);
    this.gem.scale.setScalar(s);

    // spin / float
    if (!this.reduced) {
      this.gem.rotation.y += this.spinSpeed * dt;
      this.gem.rotation.x += (this.spinSpeed * 0.4 + this.wobble * 1.1) * dt;
      this.gem.rotation.z += this.wobble * 0.7 * dt;
      this.gem.position.y = BASE_Y + Math.sin(this.time * 1.3) * 0.06;
    }
    // wobble decays back to calm
    this.wobble *= Math.pow(0.2, dt);

    // sparkles — slow orbit + twinkle
    if (this.sparkleOn) {
      this.sparkleGroup.rotation.y += 0.25 * dt;
      for (let i = 0; i < this.sparkles.length; i++) {
        const tw = 0.55 + 0.45 * Math.sin(this.time * 3 + this.sparklePhase[i]);
        this.sparkles[i].scale.setScalar(this.sparkleBase[i] * tw);
      }
    }

    // shards
    let anyShard = false;
    for (const sh of this.shards) {
      if (!sh.active) continue;
      anyShard = true;
      sh.life -= dt * 1.3;
      if (sh.life <= 0) {
        sh.active = false;
        sh.mesh.visible = false;
        continue;
      }
      sh.vel.y -= 4.5 * dt; // gravity
      sh.mesh.position.addScaledVector(sh.vel, dt);
      sh.mesh.rotation.x += sh.spin.x * dt;
      sh.mesh.rotation.y += sh.spin.y * dt;
      sh.mesh.rotation.z += sh.spin.z * dt;
      sh.mesh.scale.setScalar(Math.max(0.01, sh.life));
    }

    this.renderer.render(this.scene, this.camera);

    // A living gem floats forever when motion is allowed; under reduced-motion we
    // only keep spinning while something is still settling (shatter / pulse).
    const settling =
      anyShard ||
      this.pulse > 0.01 ||
      Math.abs(this.tgtScale - this.curScale) > 0.002 ||
      this.wobble > 0.02 ||
      Math.abs(this.glowTarget - this.glowCur) > 0.01;
    if (!this.reduced || settling) {
      this.raf = requestAnimationFrame(this.loop);
    } else {
      this.raf = 0;
    }
  }

  private renderOnce(): void {
    this.gemMat.color.copy(this.curColor);
    this.renderer.render(this.scene, this.camera);
  }
}
