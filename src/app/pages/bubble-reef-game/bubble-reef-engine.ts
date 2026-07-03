import {
  BubbleKind,
  ModeConfig,
  SeaFriend,
  rollFriend,
} from './bubble-reef-data';

export interface PopEvent {
  kind: BubbleKind;
  friend?: SeaFriend;
  /** Viewport coordinates of the pop (for particle bursts). */
  clientX: number;
  clientY: number;
}

export interface EngineCallbacks {
  onPop(e: PopEvent): void;
  /** Tap on open water (no bubble). Little Fins turns these into sparkles too. */
  onWaterTap(clientX: number, clientY: number): void;
}

interface Bubble {
  el: HTMLButtonElement;
  kind: BubbleKind;
  friend?: SeaFriend;
  x: number; // px, left edge
  y: number; // px, top edge (from field top)
  size: number;
  speed: number; // px/s upward
  wobbleAmp: number;
  wobbleFreq: number;
  wobblePhase: number;
  popped: boolean;
}

const POP_ANIM_MS = 280;

/** Inline SVG faces for the special (non-creature) bubbles. */
const KIND_SVGS: Partial<Record<BubbleKind, string>> = {
  golden: `<svg viewBox="0 0 24 24"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="#b8791a"/><path d="M12 4.4l1.7 5.9 5.9 1.7-5.9 1.7-1.7 5.9-1.7-5.9L4.4 12l5.9-1.7z" fill="#fff3cf"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><path d="M12 2.6l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 16.9l-5.6 2.9 1.1-6.2L2.9 9.2l6.3-.9z" fill="#2f9e6b" stroke="#2f9e6b" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 5.6l1.9 3.9 4.3.6-3.1 3 .7 4.2L12 15.3l-3.8 2 .7-4.2-3.1-3 4.3-.6z" fill="#d8ffe9"/></svg>`,
  rainbow: `<svg viewBox="0 0 24 24"><path d="M12 5.5A11 11 0 0 1 23 16.5h-3.2a7.8 7.8 0 0 0-15.6 0H1A11 11 0 0 1 12 5.5z" fill="#ff8fa3"/><path d="M12 9.2a7.3 7.3 0 0 1 7.3 7.3h-3a4.3 4.3 0 0 0-8.6 0h-3A7.3 7.3 0 0 1 12 9.2z" fill="#ffd166"/><path d="M12 12.9a3.6 3.6 0 0 1 3.6 3.6h-7.2A3.6 3.6 0 0 1 12 12.9z" fill="#7ce8b5"/></svg>`,
};

/**
 * DOM bubble field: spawns glossy bubble <button>s inside a container and
 * floats them upward on a rAF loop (run it outside Angular's zone). Pointer
 * pops are per-bubble listeners so hit targets stay exactly bubble-sized —
 * important for tiny fingers, so we also pad each hit box via CSS.
 *
 * All state callbacks fire from outside the zone; the component re-enters.
 */
export class BubbleReefEngine {
  private field: HTMLElement | null = null;
  private cb: EngineCallbacks | null = null;
  private config: ModeConfig | null = null;
  private collectedIds: () => Set<string> = () => new Set();
  private sprites: Map<string, string> = new Map();

  private bubbles: Bubble[] = [];
  private raf = 0;
  private lastT = 0;
  private elapsed = 0;
  private nextSpawnAt = 0;
  private popsSinceFriend = 0;
  private running = false;

  private onFieldTap = (ev: PointerEvent): void => {
    if (!this.running) return;
    if (ev.target === this.field) this.cb?.onWaterTap(ev.clientX, ev.clientY);
  };

  attach(field: HTMLElement, cb: EngineCallbacks): void {
    this.field = field;
    this.cb = cb;
    field.addEventListener('pointerdown', this.onFieldTap);
  }

  /** Baked creature sprites (id → PNG data-URL) used as bubble passengers. */
  setSprites(sprites: Map<string, string>): void {
    this.sprites = sprites;
  }

  /** collectedIds lets friend bubbles prefer species the player doesn't own. */
  start(config: ModeConfig, collectedIds: () => Set<string>): void {
    if (!this.field) return;
    this.stopLoop();
    this.clearBubbles();
    this.config = config;
    this.collectedIds = collectedIds;
    this.elapsed = 0;
    this.lastT = 0;
    this.nextSpawnAt = 0.15;
    // Pre-charge the friend counter so the session's FIRST friend bubble
    // shows up after only ~4 pops — the collection hook lands early.
    this.popsSinceFriend = Math.max(0, config.friendEvery - 4);
    this.running = true;
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    this.stopLoop();
    this.clearBubbles();
  }

  destroy(): void {
    this.stop();
    this.field?.removeEventListener('pointerdown', this.onFieldTap);
    this.field = null;
    this.cb = null;
  }

  // ------------------------------------------------------------------ loop
  private tick = (t: number): void => {
    if (!this.running || !this.field || !this.config) return;
    if (!this.lastT) this.lastT = t;
    // Clamp dt so a backgrounded tab doesn't teleport bubbles on return.
    const dt = Math.min((t - this.lastT) / 1000, 0.05);
    this.lastT = t;
    this.elapsed += dt;

    const fieldH = this.field.clientHeight;

    if (this.elapsed >= this.nextSpawnAt) {
      this.spawn();
      const [a, b] = this.config.spawnMs;
      this.nextSpawnAt = this.elapsed + (a + Math.random() * (b - a)) / 1000;
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const bub = this.bubbles[i];
      if (bub.popped) continue;
      bub.y -= bub.speed * dt;
      if (bub.y + bub.size < -30) {
        // Drifted off the top — no penalty anywhere, bubbles are free spirits.
        bub.el.remove();
        this.bubbles.splice(i, 1);
        continue;
      }
      const wob = Math.sin(this.elapsed * bub.wobbleFreq + bub.wobblePhase) * bub.wobbleAmp;
      bub.el.style.transform = `translate3d(${bub.x + wob}px, ${bub.y}px, 0)`;
    }

    // Keep a lazy reference height fresh (cheap; avoids resize listeners).
    void fieldH;
    this.raf = requestAnimationFrame(this.tick);
  };

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lastT = 0;
  }

  private clearBubbles(): void {
    for (const b of this.bubbles) b.el.remove();
    this.bubbles = [];
  }

  // ----------------------------------------------------------------- spawn
  private spawn(): void {
    const field = this.field;
    const cfg = this.config;
    if (!field || !cfg) return;
    if (this.bubbles.length >= cfg.maxAlive) return;

    const kind = this.pickKind(cfg);
    const friend = kind === 'friend' ? rollFriend(this.collectedIds()) : undefined;

    const [sMin, sMax] = cfg.size;
    const size = sMin + Math.random() * (sMax - sMin);
    const fieldW = field.clientWidth;
    const x = 8 + Math.random() * Math.max(1, fieldW - size - 16);
    const y = field.clientHeight + size * 0.4;
    const [vMin, vMax] = cfg.speed;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = `br-bubble br-kind-${kind}`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.setAttribute(
      'aria-label',
      kind === 'friend' && friend ? `Bubble with ${friend.name} inside` : `${kind} bubble`,
    );

    const shine = document.createElement('span');
    shine.className = 'br-shine';
    el.appendChild(shine);

    const face = this.buildFace(kind, size, friend);
    if (face) el.appendChild(face);

    const bubble: Bubble = {
      el,
      kind,
      friend,
      x,
      y,
      size,
      speed: vMin + Math.random() * (vMax - vMin),
      wobbleAmp: 6 + Math.random() * 14,
      wobbleFreq: 0.8 + Math.random() * 1.4,
      wobblePhase: Math.random() * Math.PI * 2,
      popped: false,
    };
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;

    el.addEventListener(
      'pointerdown',
      ev => {
        ev.stopPropagation();
        this.pop(bubble, ev.clientX, ev.clientY);
      },
      { once: false },
    );

    field.appendChild(el);
    this.bubbles.push(bubble);
  }

  private pickKind(cfg: ModeConfig): BubbleKind {
    const friendAlive = this.bubbles.some(b => b.kind === 'friend' && !b.popped);
    if (!friendAlive && this.popsSinceFriend >= cfg.friendEvery) return 'friend';
    const r = Math.random();
    let acc = cfg.rainbowChance;
    if (r < acc) return 'rainbow';
    acc += cfg.goldenChance;
    if (r < acc) return 'golden';
    acc += cfg.starChance;
    if (r < acc) return 'star';
    acc += cfg.grumpChance;
    if (r < acc) return 'grump';
    // A small trickle of bonus friend bubbles beyond the guaranteed cadence.
    if (!friendAlive && r < acc + 0.03) return 'friend';
    return 'normal';
  }

  /** Passenger visual: baked flip-book for creatures, inline SVG for pickups. */
  private buildFace(kind: BubbleKind, size: number, friend?: SeaFriend): HTMLElement | null {
    if (kind === 'friend' || kind === 'grump') {
      const src = this.sprites.get(kind === 'grump' ? 'grump' : friend?.id ?? '');
      if (!src) return null;
      const el = document.createElement('span');
      el.className = 'br-face-anim';
      const px = Math.round(size * (kind === 'friend' ? 0.7 : 0.62));
      el.style.width = `${px}px`;
      el.style.height = `${px}px`;
      el.style.backgroundImage = `url(${src})`;
      el.style.animationDelay = `-${(Math.random() * 0.9).toFixed(2)}s`;
      return el;
    }
    const svg = KIND_SVGS[kind];
    if (!svg) return null;
    const span = document.createElement('span');
    span.className = 'br-face-svg';
    span.innerHTML = svg;
    const px = Math.round(size * 0.44);
    span.style.width = `${px}px`;
    span.style.height = `${px}px`;
    return span;
  }

  // ------------------------------------------------------------------- pop
  private pop(bubble: Bubble, clientX: number, clientY: number): void {
    if (bubble.popped || !this.running) return;
    bubble.popped = true;
    if (bubble.kind === 'friend') this.popsSinceFriend = 0;
    else this.popsSinceFriend++;

    bubble.el.classList.add('br-popping');
    bubble.el.disabled = true;
    window.setTimeout(() => {
      bubble.el.remove();
      const i = this.bubbles.indexOf(bubble);
      if (i >= 0) this.bubbles.splice(i, 1);
    }, POP_ANIM_MS);

    this.cb?.onPop({
      kind: bubble.kind,
      friend: bubble.friend,
      clientX,
      clientY,
    });
  }
}
