import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  NgZone,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Scroll-reveal primitive for normal (scrolling) pages. Adds the global
 * `.reveal` class, then flips it to `.is-visible` the first time the element
 * enters the viewport. Optional stagger delay (ms):
 *
 *   <div appReveal></div>
 *   <div [appReveal]="120"></div>
 *
 * Reduced-motion users and SSR get the final state immediately.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements OnInit, OnDestroy {
  @Input('appReveal') delay: number | string = 0;

  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);
  private obs?: IntersectionObserver;

  ngOnInit(): void {
    const node = this.el.nativeElement;
    node.classList.add('reveal');

    const delayMs = Number(this.delay) || 0;
    if (delayMs) node.style.transitionDelay = `${delayMs}ms`;

    if (!isPlatformBrowser(this.platformId)) {
      node.classList.add('is-visible');
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.classList.add('is-visible');
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.obs = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              node.classList.add('is-visible');
              this.obs?.unobserve(node);
            }
          }
        },
        { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
      );
      this.obs.observe(node);
    });
  }

  ngOnDestroy(): void {
    this.obs?.disconnect();
  }
}
