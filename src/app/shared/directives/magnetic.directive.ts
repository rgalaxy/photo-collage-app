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
 * Magnetic hover: the element drifts toward the pointer while it hovers,
 * then springs back on leave. Pure transform + CSS easing, so it's cheap and
 * never blocks the main thread. No-ops on touch / reduced-motion.
 *
 *   <button appMagnetic [magneticStrength]="0.4">…</button>
 */
@Directive({
  selector: '[appMagnetic]',
  standalone: true,
})
export class MagneticDirective implements AfterViewInit, OnDestroy {
  /** 0 = none, 1 = follows pointer to the edge. */
  @Input() magneticStrength = 0.35;
  /** Extra hit-area around the element (px) where the pull begins. */
  @Input() magneticPadding = 24;

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
    node.style.transition = 'transform 0.35s var(--ease-out-expo, cubic-bezier(0.16,1,0.3,1))';
    node.style.willChange = 'transform';

    this.zone.runOutsideAngular(() => {
      node.addEventListener('pointermove', this.onMove);
      node.addEventListener('pointerleave', this.onLeave);
    });
  }

  ngOnDestroy(): void {
    if (!this.active) return;
    const node = this.el.nativeElement;
    node.removeEventListener('pointermove', this.onMove);
    node.removeEventListener('pointerleave', this.onLeave);
  }

  private onMove = (e: PointerEvent) => {
    const node = this.el.nativeElement;
    const rect = node.getBoundingClientRect();
    const relX = e.clientX - (rect.left + rect.width / 2);
    const relY = e.clientY - (rect.top + rect.height / 2);
    node.style.transform = `translate3d(${relX * this.magneticStrength}px, ${relY * this.magneticStrength}px, 0)`;
  };

  private onLeave = () => {
    this.el.nativeElement.style.transform = 'translate3d(0,0,0)';
  };
}
