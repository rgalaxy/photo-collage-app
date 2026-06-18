import {
  Directive,
  ElementRef,
  Input,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  NgZone,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * 3D pointer-tilt for cards. The element rotates toward the pointer in
 * perspective and exposes `--mx` / `--my` (0..1) so children can react
 * (e.g. a moving glare/glow). Resets smoothly on leave.
 *
 *   <article appTilt [tiltMax]="12">…</article>
 *
 * No-ops on touch / reduced-motion so it never gets in the way.
 */
@Directive({
  selector: '[appTilt]',
  standalone: true,
})
export class TiltDirective implements AfterViewInit, OnDestroy {
  /** Maximum rotation in degrees on each axis. */
  @Input() tiltMax = 10;
  /** Z-translation applied while hovering, for a subtle "lift". */
  @Input() tiltLift = 14;

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);
  private active = false;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduced) return;

    this.active = true;
    const node = this.el.nativeElement;
    node.style.transformStyle = 'preserve-3d';
    node.style.willChange = 'transform';
    node.style.transition = 'transform 0.5s var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))';

    this.zone.runOutsideAngular(() => {
      node.addEventListener('pointerenter', this.onEnter);
      node.addEventListener('pointermove', this.onMove);
      node.addEventListener('pointerleave', this.onLeave);
    });
  }

  ngOnDestroy(): void {
    if (!this.active) return;
    const node = this.el.nativeElement;
    node.removeEventListener('pointerenter', this.onEnter);
    node.removeEventListener('pointermove', this.onMove);
    node.removeEventListener('pointerleave', this.onLeave);
  }

  private onEnter = () => {
    // snappier while tracking the pointer
    this.el.nativeElement.style.transition = 'transform 0.12s ease-out';
  };

  private onMove = (e: PointerEvent) => {
    const node = this.el.nativeElement;
    const rect = node.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * this.tiltMax * 2;
    const ry = (px - 0.5) * this.tiltMax * 2;
    node.style.setProperty('--mx', px.toFixed(3));
    node.style.setProperty('--my', py.toFixed(3));
    node.style.transform =
      `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(${this.tiltLift}px)`;
  };

  private onLeave = () => {
    const node = this.el.nativeElement;
    node.style.transition = 'transform 0.5s var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))';
    node.style.transform = 'perspective(900px) rotateX(0) rotateY(0) translateZ(0)';
  };
}
