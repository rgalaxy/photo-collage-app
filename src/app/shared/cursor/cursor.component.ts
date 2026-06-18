import {
  Component,
  OnDestroy,
  AfterViewInit,
  PLATFORM_ID,
  NgZone,
  ViewChild,
  ElementRef,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Custom "playground" cursor: a snappy dot + a trailing ring that swells over
 * interactive targets. Only active on precise pointers that don't ask for
 * reduced motion — everywhere else the native cursor is left untouched.
 */
@Component({
  selector: 'app-cursor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cursor-ring" #ring [class.is-hover]="hovering()" [class.is-down]="pressed()"></div>
    <div class="cursor-dot" #dot></div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 9999;
        pointer-events: none;
        display: none;
      }
      :host(.on) {
        display: block;
      }
      .cursor-dot,
      .cursor-ring {
        position: fixed;
        top: 0;
        left: 0;
        border-radius: 50%;
        transform: translate3d(-100px, -100px, 0) translate(-50%, -50%);
        will-change: transform;
        pointer-events: none;
      }
      .cursor-dot {
        width: 7px;
        height: 7px;
        background: #fff;
        mix-blend-mode: difference;
        z-index: 2;
      }
      .cursor-ring {
        width: 38px;
        height: 38px;
        border: 1.5px solid rgba(124, 58, 237, 0.9);
        box-shadow: 0 0 22px rgba(34, 211, 238, 0.35);
        transition:
          width 0.28s var(--ease-out-expo, ease),
          height 0.28s var(--ease-out-expo, ease),
          background 0.28s ease,
          border-color 0.28s ease;
        z-index: 1;
      }
      .cursor-ring.is-hover {
        width: 64px;
        height: 64px;
        background: rgba(124, 58, 237, 0.14);
        border-color: rgba(34, 211, 238, 0.9);
      }
      .cursor-ring.is-down {
        width: 26px;
        height: 26px;
      }
    `,
  ],
})
export class CursorComponent implements AfterViewInit, OnDestroy {
  hovering = signal(false);
  pressed = signal(false);

  @ViewChild('dot', { static: true }) dotRef!: ElementRef<HTMLElement>;
  @ViewChild('ring', { static: true }) ringRef!: ElementRef<HTMLElement>;

  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  private enabled = false;
  private raf = 0;
  private mouse = { x: -100, y: -100 };
  private ring2 = { x: -100, y: -100 };
  private hoverSel = 'a, button, [role="button"], input, textarea, select, summary, [data-cursor]';

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    this.enabled = true;
    this.host.nativeElement.classList.add('on');
    document.body.classList.add('has-custom-cursor');

    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onMove, { passive: true });
      window.addEventListener('pointerover', this.onOver, { passive: true });
      window.addEventListener('pointerout', this.onOut, { passive: true });
      window.addEventListener('pointerdown', this.onDown, { passive: true });
      window.addEventListener('pointerup', this.onUp, { passive: true });
      this.loop();
    });
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId) || !this.enabled) return;
    document.body.classList.remove('has-custom-cursor');
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerover', this.onOver);
    window.removeEventListener('pointerout', this.onOut);
    window.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointerup', this.onUp);
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  private onMove = (e: PointerEvent) => {
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.dotRef.nativeElement.style.transform =
      `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
  };
  private onOver = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest?.(this.hoverSel)) this.zone.run(() => this.hovering.set(true));
  };
  private onOut = (e: PointerEvent) => {
    if ((e.target as HTMLElement)?.closest?.(this.hoverSel)) this.zone.run(() => this.hovering.set(false));
  };
  private onDown = () => this.zone.run(() => this.pressed.set(true));
  private onUp = () => this.zone.run(() => this.pressed.set(false));

  private loop = () => {
    this.ring2.x += (this.mouse.x - this.ring2.x) * 0.18;
    this.ring2.y += (this.mouse.y - this.ring2.y) * 0.18;
    this.ringRef.nativeElement.style.transform =
      `translate3d(${this.ring2.x}px, ${this.ring2.y}px, 0) translate(-50%, -50%)`;
    this.raf = requestAnimationFrame(this.loop);
  };
}
