import { Injectable, NgZone, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface JParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
  rect: boolean;
  spin: number;
  gravity: number;
}

interface BurstOpts {
  count?: number;
  colors?: string[];
  power?: number;
  gravity?: number;
  rect?: boolean;
}

/**
 * Lightweight "game feel" toolkit shared by the standalone games:
 *  - burst()/confetti(): particle effects on a single lazily-created full-screen
 *    canvas (no per-game setup, runs outside Angular's zone).
 *  - shake(): a quick screen-shake via the Web Animations API.
 *  - blip(): short WebAudio tones (muteable), created on first user gesture.
 *
 * Everything no-ops under prefers-reduced-motion / SSR.
 */
@Injectable({ providedIn: 'root' })
export class JuiceService {
  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);

  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D | null;
  private particles: JParticle[] = [];
  private raf = 0;
  private dpr = 1;
  private audioCtx?: AudioContext;

  muted = false;

  readonly brand = ['#7c3aed', '#5b5bf5', '#22d3ee', '#fb7185', '#c6f24e'];

  private get reduced(): boolean {
    return (
      !isPlatformBrowser(this.platformId) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  // ---------- Particles ----------
  burst(x: number, y: number, opts: BurstOpts = {}): void {
    if (this.reduced) return;
    this.ensureCanvas();
    const count = opts.count ?? 18;
    const colors = opts.colors ?? this.brand;
    const power = opts.power ?? 7;
    const gravity = opts.gravity ?? 0.18;
    const d = this.dpr;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = power * (0.35 + Math.random());
      this.particles.push({
        x: x * d,
        y: y * d,
        vx: Math.cos(a) * sp * d,
        vy: (Math.sin(a) * sp - power * 0.5) * d,
        life: 1,
        decay: 0.012 + Math.random() * 0.02,
        size: (1.5 + Math.random() * 3) * d,
        color: colors[(Math.random() * colors.length) | 0],
        rect: opts.rect ?? Math.random() < 0.5,
        spin: (Math.random() - 0.5) * 0.4,
        gravity: gravity * d,
      });
    }
    this.start();
  }

  /** Celebratory rain from the top of the screen. */
  confetti(count = 80): void {
    if (this.reduced || !isPlatformBrowser(this.platformId)) return;
    this.ensureCanvas();
    const d = this.dpr;
    const w = window.innerWidth;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * w * d,
        y: -20 * d,
        vx: (Math.random() - 0.5) * 4 * d,
        vy: (2 + Math.random() * 4) * d,
        life: 1,
        decay: 0.004 + Math.random() * 0.006,
        size: (2 + Math.random() * 3) * d,
        color: this.brand[(Math.random() * this.brand.length) | 0],
        rect: true,
        spin: (Math.random() - 0.5) * 0.5,
        gravity: 0.06 * d,
      });
    }
    this.start();
  }

  // ---------- Screen shake ----------
  shake(el: HTMLElement | null | undefined, strength = 8, duration = 350): void {
    if (!el || this.reduced) return;
    const steps = 8;
    const frames: Keyframe[] = [];
    for (let i = 0; i < steps; i++) {
      const f = 1 - i / steps;
      frames.push({
        transform: `translate(${(Math.random() * 2 - 1) * strength * f}px, ${
          (Math.random() * 2 - 1) * strength * f
        }px)`,
      });
    }
    frames.push({ transform: 'translate(0, 0)' });
    el.animate(frames, { duration, easing: 'cubic-bezier(0.36,0.07,0.19,0.97)' });
  }

  // ---------- Sound ----------
  blip(freq = 440, opts: { type?: OscillatorType; duration?: number; gain?: number } = {}): void {
    if (this.muted || !isPlatformBrowser(this.platformId)) return;
    try {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx ??= new Ctor();
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = opts.type ?? 'triangle';
      o.frequency.value = freq;
      const dur = opts.duration ?? 0.09;
      const peak = opts.gain ?? 0.05;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(peak, ctx.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch {
      /* audio not available — ignore */
    }
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  // ---------- internals ----------
  private ensureCanvas(): void {
    if (!isPlatformBrowser(this.platformId) || this.canvas) return;
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    Object.assign(c.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '9990',
    });
    document.body.appendChild(c);
    this.canvas = c;
    this.ctx = c.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    window.addEventListener('resize', this.resize, { passive: true });
  }

  private resize = (): void => {
    if (!this.canvas) return;
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
  };

  private start(): void {
    if (this.raf) return;
    this.zone.runOutsideAngular(() => {
      const loop = () => {
        const ctx = this.ctx;
        const c = this.canvas;
        if (!ctx || !c) {
          this.raf = 0;
          return;
        }
        ctx.clearRect(0, 0, c.width, c.height);
        for (let i = this.particles.length - 1; i >= 0; i--) {
          const p = this.particles[i];
          p.vx *= 0.985;
          p.vy += p.gravity;
          p.x += p.vx;
          p.y += p.vy;
          p.life -= p.decay;
          if (p.life <= 0 || p.y > c.height + 40) {
            this.particles.splice(i, 1);
            continue;
          }
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          if (p.rect) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.life * 8 * p.spin);
            ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
            ctx.restore();
          } else {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        if (this.particles.length) {
          this.raf = requestAnimationFrame(loop);
        } else {
          ctx.clearRect(0, 0, c.width, c.height);
          this.raf = 0;
        }
      };
      this.raf = requestAnimationFrame(loop);
    });
  }
}
