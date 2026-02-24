import { Component, OnInit, OnDestroy, inject, PLATFORM_ID, signal } from '@angular/core';
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
    BlogSectionComponent
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
  styleUrl: './home-new.component.scss'
})
export class HomeNewComponent implements OnInit, OnDestroy {
  private seoService = inject(SeoService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);

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
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      gsap.killTweensOf('*');
    }
  }

  navigateTo(sectionId: string): void {
    if (this.isTransitioning() || this.activeSection() === sectionId) return;

    this.isTransitioning.set(true);

    const currentSection = document.querySelector('.section.active');
    const nextSection = document.querySelector(`#section-${sectionId}`);

    // Update URL with fragment
    this.router.navigate([], { fragment: `section-${sectionId}` });

    if (currentSection && nextSection) {
      gsap.to(currentSection, {
        opacity: 0,
        x: -100,
        duration: 0.4,
        onComplete: () => {
          currentSection.classList.remove('active');
          this.activeSection.set(sectionId);
          nextSection.classList.add('active');

          gsap.fromTo(nextSection,
            { opacity: 0, x: 100 },
            {
              opacity: 1,
              x: 0,
              duration: 0.4,
              onComplete: () => {
                this.isTransitioning.set(false);
              }
            }
          );
        }
      });
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
