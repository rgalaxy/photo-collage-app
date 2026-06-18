import { Component, OnInit, OnDestroy, inject, PLATFORM_ID, signal, computed, NgZone, ChangeDetectionStrategy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons, NgIconComponent } from '@ng-icons/core';
import {
  radixHome,
  radixPerson,
  radixBackpack,
  radixRocket,
  radixFileText,
  radixSun,
  radixMoon,
  radixCross2,
  radixEnvelopeClosed,
  radixLinkedinLogo,
  radixGithubLogo
} from '@ng-icons/radix-icons';
import { SeoService } from '../../services/seo.service';
import { ThemeService } from '../../services/theme.service';
import { GameItem } from '../../types/game.types';
import gsap from 'gsap';
import { HomeHeroSectionComponent } from './sections/home-hero-section.component';
import { AboutSectionComponent } from './sections/about-section.component';
import { PortfolioSectionComponent } from './sections/portfolio-section.component';
import { GamesSectionComponent } from './sections/games-section.component';
import { BlogSectionComponent } from './sections/blog-section.component';
import { WebglBackgroundComponent } from '../../shared/webgl-background/webgl-background.component';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-home-new',
  standalone: true,
  imports: [
    NgIconComponent,
    HomeHeroSectionComponent,
    AboutSectionComponent,
    PortfolioSectionComponent,
    GamesSectionComponent,
    BlogSectionComponent,
    WebglBackgroundComponent
  ],
  providers: [provideIcons({
    radixHome,
    radixPerson,
    radixBackpack,
    radixRocket,
    radixFileText,
    radixSun,
    radixMoon,
    radixCross2,
    radixEnvelopeClosed,
    radixLinkedinLogo,
    radixGithubLogo
  })],
  templateUrl: './home-new.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './home-new.component.scss'
})
export class HomeNewComponent implements OnInit, OnDestroy {
  private seoService = inject(SeoService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);

  // deck-navigation state
  private wheelCooldownUntil = 0;
  private touchStartY = 0;
  // require a deliberate "overscroll" past the boundary before changing section,
  // so users can comfortably rest at the bottom/top of a section first
  private overscroll = 0;
  private overscrollDir = 0;
  private lastWheelAt = 0;
  private readonly OVERSCROLL_THRESHOLD = 600;

  navItems: NavItem[] = [
    { id: 'home', label: 'Home', icon: 'radixHome' },
    { id: 'about', label: 'About', icon: 'radixPerson' },
    { id: 'portfolio', label: 'Portfolio', icon: 'radixBackpack' },
    { id: 'games', label: 'Games', icon: 'radixRocket' },
    { id: 'blog', label: 'Blog', icon: 'radixFileText' }
  ];

  activeSection = signal<string>('home');
  isTransitioning = signal<boolean>(false);
  showAboutModal = signal<boolean>(false);
  isDarkMode = signal<boolean>(true);

  /** Drives the backdrop's palette: each section gets a different colour mood. */
  sectionShift = computed(() => {
    const idx = this.navItems.findIndex(i => i.id === this.activeSection());
    return idx < 0 ? 0 : idx * 1.25;
  });
  /** Backdrop calms down on the denser content sections for readability. */
  bgIntensity = computed(() => (this.activeSection() === 'home' ? 1 : 0.65));

  skills = [
    { name: 'Frontend Development', description: 'Angular, React, Vue, TypeScript.', icon: 'radixDesktop' },
    { name: 'Backend Development', description: 'Node.js, Python, RabbitMQ, GraphQL.', icon: 'radixGear' },
    { name: 'Mobile Development', description: 'Flutter, React Native, Swift.', icon: 'radixMobile' },
    { name: 'Databases', description: 'MySQL, PostgreSQL, MongoDB, SQLite.', icon: 'radixTable' }
  ];

  socialLinks = [
    { icon: 'radixGithubLogo', url: 'https://github.com/rgalaxy', label: 'GitHub' },
    { icon: 'radixLinkedinLogo', url: 'https://linkedin.com/in/martin-haryanto', label: 'LinkedIn' },
    { icon: 'radixEnvelopeClosed', url: 'mailto:hollandmakermh@gmail.com', label: 'Email' }
  ];

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'Martin Haryanto | Software Developer',
      description: 'Software Developer focused on crafting clean & user-friendly experiences.',
      keywords: 'software developer, web developer, angular, portfolio',
      type: 'website'
    });

    if (isPlatformBrowser(this.platformId)) {
      // Sync with current theme state
      const currentTheme = document.documentElement.getAttribute('data-theme');
      this.isDarkMode.set(currentTheme === 'dark');

      // Listen to route fragments for direct section navigation
      this.activatedRoute.fragment.subscribe(fragment => {
        if (fragment) {
          const sectionId = fragment.replace('section-', '');
          if (this.navItems.some(item => item.id === sectionId)) {
            setTimeout(() => this.navigateTo(sectionId), 100);
          }
        }
      });

      this.setupDeckNavigation();
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      gsap.killTweensOf('*');
      window.removeEventListener('wheel', this.onWheel);
      window.removeEventListener('touchstart', this.onTouchStart);
      window.removeEventListener('touchend', this.onTouchEnd);
      window.removeEventListener('keydown', this.onKeydown);
    }
  }

  /** Wheel / swipe / keyboard turn the section deck into a "scrollable" page,
   *  while still letting tall sections scroll their own content first. */
  private setupDeckNavigation(): void {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('wheel', this.onWheel, { passive: false });
      window.addEventListener('touchstart', this.onTouchStart, { passive: true });
      window.addEventListener('touchend', this.onTouchEnd, { passive: true });
      window.addEventListener('keydown', this.onKeydown);
    });
  }

  /** Returns true if the active section can still scroll its own content in `dir`. */
  private sectionCanAbsorb(dir: number): boolean {
    const active = document.querySelector('.section.active') as HTMLElement | null;
    if (!active) return false;
    if (active.scrollHeight <= active.clientHeight + 2) return false;
    const atTop = active.scrollTop <= 0;
    const atBottom = active.scrollTop + active.clientHeight >= active.scrollHeight - 2;
    return dir > 0 ? !atBottom : !atTop;
  }

  private navigateByDelta(dir: number): boolean {
    const ids = this.navItems.map(i => i.id);
    const next = ids.indexOf(this.activeSection()) + dir;
    if (next < 0 || next >= ids.length) return false;
    this.zone.run(() => this.navigateTo(ids[next]));
    return true;
  }

  private onWheel = (e: WheelEvent): void => {
    if (Math.abs(e.deltaY) < 4) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    if (this.sectionCanAbsorb(dir)) {
      // still scrolling within the section — reset any pending intent
      this.overscroll = 0;
      return;
    }

    const now = Date.now();
    if (now < this.wheelCooldownUntil || this.isTransitioning()) {
      e.preventDefault();
      return;
    }

    // reset the accumulator if the user paused or reversed direction
    if (now - this.lastWheelAt > 220 || dir !== this.overscrollDir) {
      this.overscroll = 0;
      this.overscrollDir = dir;
    }
    this.lastWheelAt = now;
    this.overscroll += Math.abs(e.deltaY);
    e.preventDefault(); // we're at the boundary — no native overscroll bounce

    if (this.overscroll >= this.OVERSCROLL_THRESHOLD && this.navigateByDelta(dir)) {
      this.overscroll = 0;
      this.wheelCooldownUntil = now + 700;
    }
  };

  private onTouchStart = (e: TouchEvent): void => {
    this.touchStartY = e.touches[0]?.clientY ?? 0;
  };

  private onTouchEnd = (e: TouchEvent): void => {
    const dy = this.touchStartY - (e.changedTouches[0]?.clientY ?? 0);
    if (Math.abs(dy) < 110) return; // deliberate swipe only
    const dir = dy > 0 ? 1 : -1;
    if (this.sectionCanAbsorb(dir)) return;
    if (this.isTransitioning()) return;
    this.navigateByDelta(dir);
  };

  private onKeydown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || this.showAboutModal()) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // PageDown/PageUp always jump; arrows only when the section can't scroll further
    if (e.key === 'PageDown') {
      if (this.navigateByDelta(1)) e.preventDefault();
    } else if (e.key === 'PageUp') {
      if (this.navigateByDelta(-1)) e.preventDefault();
    } else if (e.key === 'ArrowDown' && !this.sectionCanAbsorb(1)) {
      if (this.navigateByDelta(1)) e.preventDefault();
    } else if (e.key === 'ArrowUp' && !this.sectionCanAbsorb(-1)) {
      if (this.navigateByDelta(-1)) e.preventDefault();
    }
  };

  navigateTo(sectionId: string): void {
    if (this.isTransitioning() || this.activeSection() === sectionId) return;

    this.overscroll = 0;

    const currentSection = document.querySelector('.section.active') as HTMLElement | null;
    const nextSection = document.querySelector(`#section-${sectionId}`) as HTMLElement | null;

    // Update the URL hash WITHOUT a router navigation — a router nav here would
    // fire the route-transition wipe on every section change.
    if (isPlatformBrowser(this.platformId)) {
      history.replaceState(history.state, '', `#section-${sectionId}`);
    }

    if (currentSection && nextSection) {
      this.isTransitioning.set(true);
      // Activate the next section up front so the nav highlight + backdrop
      // palette respond instantly, then cross-fade the two.
      nextSection.scrollTop = 0;
      nextSection.classList.add('active');
      this.activeSection.set(sectionId);

      gsap.killTweensOf([currentSection, nextSection]);
      gsap.set(nextSection, { zIndex: 2, opacity: 0, y: 26 });
      gsap.set(currentSection, { zIndex: 1 });

      gsap.timeline({
        defaults: { ease: 'power3.out' },
        onComplete: () => {
          currentSection.classList.remove('active');
          gsap.set([currentSection, nextSection], { clearProps: 'zIndex,transform' });
          this.isTransitioning.set(false);
        },
      })
        .to(currentSection, { opacity: 0, y: -22, duration: 0.34, ease: 'power2.in' }, 0)
        .to(nextSection, { opacity: 1, y: 0, duration: 0.46 }, 0.06);
    } else {
      this.activeSection.set(sectionId);
      this.isTransitioning.set(false);
    }
  }

  openAboutModal(): void {
    this.showAboutModal.set(true);
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        gsap.fromTo('.modal-overlay',
          { opacity: 0 },
          { opacity: 1, duration: 0.3 }
        );
        gsap.fromTo('.modal-content',
          { opacity: 0, scale: 0.9, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.4, delay: 0.1 }
        );
      }, 10);
    }
  }

  closeAboutModal(): void {
    if (isPlatformBrowser(this.platformId)) {
      gsap.to('.modal-content', {
        opacity: 0,
        scale: 0.9,
        y: 20,
        duration: 0.3
      });
      gsap.to('.modal-overlay', {
        opacity: 0,
        duration: 0.3,
        onComplete: () => {
          this.showAboutModal.set(false);
          document.body.style.overflow = '';
        }
      });
    } else {
      this.showAboutModal.set(false);
    }
  }

  toggleTheme(): void {
    this.isDarkMode.set(!this.isDarkMode());
    this.themeService.toggleTheme();
  }

  onModalBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeAboutModal();
    }
  }

  onGameSelect(game: GameItem): void {
    this.router.navigate([game.route]);
  }
}
