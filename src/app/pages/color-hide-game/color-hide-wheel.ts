import { HSL, hslToRgb, clamp } from './color-hide-data';

/**
 * A crisp 2D HSL colour wheel picker drawn to a <canvas>.
 *  - Hue runs around the rim (angle), saturation by radius (centre = 0%).
 *  - Lightness is fixed by the component's separate slider (setLightness).
 *  - A draggable puck reports (h, s) changes via onChange; pointer + touch.
 *
 * The wheel bitmap is only recomputed when lightness or size changes; dragging
 * just re-blits the cached image and repaints the puck, so it stays smooth.
 */
export class ColorWheel {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private px = 0; // device-pixel size (square)
  private cx = 0;
  private cy = 0;
  private radius = 0;

  private image?: ImageData;
  private dragging = false;

  h = 0;
  s = 100;
  private lightness = 56;

  onChange?: (h: number, s: number) => void;

  private onDown = (e: PointerEvent): void => this.pointer(e, true);
  private onMove = (e: PointerEvent): void => {
    if (this.dragging) this.pointer(e, false);
  };
  private onUp = (e: PointerEvent): void => {
    this.dragging = false;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  constructor(
    private canvas: HTMLCanvasElement,
    opts: { lightness?: number; onChange?: (h: number, s: number) => void } = {},
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.lightness = opts.lightness ?? 56;
    this.onChange = opts.onChange;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    this.resize();
  }

  setLightness(l: number): void {
    this.lightness = clamp(l, 0, 100);
    this.buildImage();
    this.draw();
  }

  setHS(h: number, s: number): void {
    this.h = ((h % 360) + 360) % 360;
    this.s = clamp(s, 0, 100);
    this.draw();
  }

  get value(): HSL {
    return { h: this.h, s: this.s, l: this.lightness };
  }

  resize(): void {
    const css = this.canvas.clientWidth || 220;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.px = Math.max(2, Math.round(css * this.dpr));
    this.canvas.width = this.px;
    this.canvas.height = this.px;
    this.cx = this.px / 2;
    this.cy = this.px / 2;
    this.radius = (this.px / 2) * 0.95;
    this.buildImage();
    this.draw();
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
  }

  // -------------------------------------------------------------- internals
  private buildImage(): void {
    const img = this.ctx.createImageData(this.px, this.px);
    const data = img.data;
    const r = this.radius;
    for (let y = 0; y < this.px; y++) {
      for (let x = 0; x < this.px; x++) {
        const dx = x - this.cx;
        const dy = y - this.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * this.px + x) * 4;
        if (dist > r) {
          data[idx + 3] = 0;
          continue;
        }
        let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (hue < 0) hue += 360;
        const sat = Math.min(100, (dist / r) * 100);
        const rgb = hslToRgb({ h: hue, s: sat, l: this.lightness });
        data[idx] = rgb.r;
        data[idx + 1] = rgb.g;
        data[idx + 2] = rgb.b;
        // feather the outer 1.5px for a smooth rim
        data[idx + 3] = dist > r - 1.5 ? Math.round(255 * (r - dist) / 1.5) : 255;
      }
    }
    this.image = img;
  }

  private draw(): void {
    if (!this.image) return;
    this.ctx.clearRect(0, 0, this.px, this.px);
    this.ctx.putImageData(this.image, 0, 0);

    // puck
    const rad = (this.h * Math.PI) / 180;
    const rr = (this.s / 100) * this.radius;
    const pxp = this.cx + Math.cos(rad) * rr;
    const pyp = this.cy + Math.sin(rad) * rr;
    const rgb = hslToRgb(this.value);

    const ringR = Math.max(7, this.px * 0.038);
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(pxp, pyp, ringR, 0, Math.PI * 2);
    this.ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    this.ctx.fill();
    this.ctx.lineWidth = Math.max(2, this.px * 0.012);
    this.ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    this.ctx.stroke();
    this.ctx.lineWidth = Math.max(1.5, this.px * 0.008);
    this.ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    this.ctx.beginPath();
    this.ctx.arc(pxp, pyp, ringR, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private pointer(ev: PointerEvent, capture: boolean): void {
    const rect = this.canvas.getBoundingClientRect();
    const cssHalf = rect.width / 2;
    const dx = ev.clientX - rect.left - cssHalf;
    const dy = ev.clientY - rect.top - cssHalf;
    if (capture) {
      this.dragging = true;
      try {
        this.canvas.setPointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
    }
    let hue = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    const maxR = cssHalf * 0.95;
    const sat = clamp((Math.sqrt(dx * dx + dy * dy) / maxR) * 100, 0, 100);
    this.h = hue;
    this.s = sat;
    this.draw();
    this.onChange?.(this.h, this.s);
  }
}
