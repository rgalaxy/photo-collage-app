import {
  Component,
  ElementRef,
  ViewChild,
  PLATFORM_ID,
  NgZone,
  inject,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationStart, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { Subscription } from 'rxjs';

/**
 * Awwwards-style gradient wipe between routes. On NavigationStart a brand
 * gradient panel sweeps up to cover the screen (with an "MH" mark); once the
 * next route has loaded it sweeps away. The reveal always waits for the cover
 * to finish, so fast (cached) navigations still feel deliberate.
 *
 * Uses the native Web Animations API (no animation library) so it adds nothing
 * to the initial bundle. The first page load is skipped so it never fights the
 * hero intro; reduced-motion users get no overlay at all.
 */
const EASE = 'cubic-bezier(0.83, 0, 0.17, 1)';
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

@Component({
  selector: 'app-route-transition',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rt-overlay" #overlay aria-hidden="true">
      <div class="rt-panel rt-panel-2" #panel2></div>
      <div class="rt-panel" #panel></div>
      <div class="rt-mark" #mark>MH</div>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 9998;
        pointer-events: none;
      }
      .rt-overlay {
        position: absolute;
        inset: 0;
        overflow: hidden;
        visibility: hidden;
      }
      .rt-panel {
        position: absolute;
        inset: -2px;
        transform: translateY(100%);
        background: var(--brand-gradient, linear-gradient(115deg, #7c3aed, #22d3ee, #fb7185));
      }
      .rt-panel-2 {
        background: #0b0b16;
        opacity: 0.92;
      }
      .rt-mark {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-family: var(--font-display, sans-serif);
        font-weight: 700;
        font-size: clamp(3rem, 12vw, 9rem);
        letter-spacing: -0.03em;
        color: rgba(255, 255, 255, 0.95);
        opacity: 0;
        mix-blend-mode: overlay;
      }
    `,
  ],
})
export class RouteTransitionComponent implements AfterViewInit {
  @ViewChild('overlay', { static: true }) overlayRef!: ElementRef<HTMLElement>;
  @ViewChild('panel', { static: true }) panelRef!: ElementRef<HTMLElement>;
  @ViewChild('panel2', { static: true }) panel2Ref!: ElementRef<HTMLElement>;
  @ViewChild('mark', { static: true }) markRef!: ElementRef<HTMLElement>;

  private router = inject(Router);
  private zone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);

  private sub?: Subscription;
  private ready = false;
  private active = false;
  private covered = false;
  private pendingReveal = false;
  private anims: Animation[] = [];
  private currentPath = '';

  private pathOf(url: string): string {
    return url.split('#')[0].split('?')[0];
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      this.currentPath = this.pathOf(this.router.url);
      this.sub = this.router.events.subscribe(e => {
        if (e instanceof NavigationStart) {
          // only wipe on real route (path) changes — not fragment/query-only nav
          if (this.ready && !this.active && this.pathOf(e.url) !== this.currentPath) {
            this.cover();
          }
        } else if (
          e instanceof NavigationEnd ||
          e instanceof NavigationCancel ||
          e instanceof NavigationError
        ) {
          this.currentPath = this.pathOf((e as NavigationEnd).urlAfterRedirects ?? e.url);
          if (!this.ready) {
            this.ready = true; // skip the very first (initial) navigation
            return;
          }
          if (this.active) this.onNavigationDone();
        }
      });
    });
  }

  private animate(el: HTMLElement, frames: Keyframe[], duration: number, delay = 0, easing = EASE): Animation {
    const a = el.animate(frames, { duration, delay, easing, fill: 'forwards' });
    this.anims.push(a);
    return a;
  }

  private cover(): void {
    this.active = true;
    this.covered = false;
    this.pendingReveal = false;

    const overlay = this.overlayRef.nativeElement;
    const panel = this.panelRef.nativeElement;
    const panel2 = this.panel2Ref.nativeElement;
    const mark = this.markRef.nativeElement;

    overlay.style.visibility = 'visible';
    overlay.style.pointerEvents = 'auto';
    panel.style.transform = 'translateY(100%)';
    panel2.style.transform = 'translateY(100%)';

    this.animate(panel2, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], 500);
    const lead = this.animate(panel, [{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], 560, 80);
    this.animate(
      mark,
      [
        { opacity: 0, transform: 'translateY(30px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      340,
      280,
      EASE_OUT
    );

    lead.finished
      .then(() => {
        this.covered = true;
        if (this.pendingReveal) this.reveal();
      })
      .catch(() => {});
  }

  private onNavigationDone(): void {
    if (this.covered) this.reveal();
    else this.pendingReveal = true;
  }

  private reveal(): void {
    this.pendingReveal = false;
    const overlay = this.overlayRef.nativeElement;
    const panel = this.panelRef.nativeElement;
    const panel2 = this.panel2Ref.nativeElement;
    const mark = this.markRef.nativeElement;

    this.animate(mark, [{ opacity: 1 }, { opacity: 0 }], 240);
    this.animate(panel, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], 600, 40);
    const last = this.animate(panel2, [{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }], 600, 120);

    last.finished
      .then(() => {
        overlay.style.visibility = 'hidden';
        overlay.style.pointerEvents = 'none';
        // safe to reset now that the overlay is hidden
        this.anims.forEach(a => a.cancel());
        this.anims = [];
        panel.style.transform = 'translateY(100%)';
        panel2.style.transform = 'translateY(100%)';
        mark.style.opacity = '0';
        this.active = false;
        this.covered = false;
      })
      .catch(() => {});
  }
}
