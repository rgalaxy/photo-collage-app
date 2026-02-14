import { Component, OnInit, OnDestroy, HostListener, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { NgIcon, provideIcons, NgIconComponent } from '@ng-icons/core';
import {
  radixHome,
  radixPerson,
  radixBackpack,
  radixRocket,
  radixFileText,
  radixSun,
  radixMoon,
  radixArrowRight,
  radixCross2,
  radixDesktop,
  radixGear,
  radixMobile,
  radixTable,
  radixEnvelopeClosed,
  radixLinkedinLogo,
  radixGithubLogo,
  radixInstagramLogo
} from '@ng-icons/radix-icons';
import { SeoService } from '../../services/seo.service';
import { ThemeService } from '../../services/theme.service';
import { GameFilterComponent } from '../../components/game-filter/game-filter.component';
import { HomeGameCardComponent } from '../../components/home-game-card/home-game-card.component';
import { GameItem, GAMES } from '../../types/game.types';
import gsap from 'gsap';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-home-new',
  standalone: true,
  imports: [NgIconComponent, GameFilterComponent, HomeGameCardComponent],
  providers: [provideIcons({
    radixHome,
    radixPerson,
    radixBackpack,
    radixRocket,
    radixFileText,
    radixSun,
    radixMoon,
    radixArrowRight,
    radixCross2,
    radixDesktop,
    radixGear,
    radixMobile,
    radixTable,
    radixEnvelopeClosed,
    radixLinkedinLogo,
    radixGithubLogo,
    radixInstagramLogo
  })],
  templateUrl: './home-new.component.html',
  styleUrl: './home-new.component.scss'
})
export class HomeNewComponent implements OnInit, OnDestroy {
  private seoService = inject(SeoService);
  private themeService = inject(ThemeService);
  private router = inject(Router);
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
  private hasInitializedHome = false;

  filter = signal('');
  focusedIndex = signal(0);

  filteredGames = computed(() => {
    const filterValue = this.filter().toLowerCase().trim();
    if (!filterValue) {
      return GAMES;
    }
    return GAMES.filter(game =>
      game.title.toLowerCase().includes(filterValue) ||
      game.description.toLowerCase().includes(filterValue)
    );
  });

  gridColumns = computed(() => {
    return window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
  });

  skills = [
    { name: 'Frontend Development', description: 'Angular, React, Vue, TypeScript.', icon: 'radixDesktop' },
    { name: 'Backend Development', description: 'Node.js, Python, RabbitMQ, GraphQL.', icon: 'radixGear' },
    { name: 'Mobile Development', description: 'Flutter, React Native, Swift.', icon: 'radixMobile' },
    { name: 'Databases', description: 'MySQL, PostgreSQL, MongoDB, SQLite.', icon: 'radixTable' }
  ];

  socialLinks = [
    { icon: 'radixGithubLogo', url: 'https://github.com/niconicolii', label: 'GitHub' },
    { icon: 'radixLinkedinLogo', url: 'https://linkedin.com/in/niconicolii', label: 'LinkedIn' },
    { icon: 'radixEnvelopeClosed', url: 'mailto:niconicolii0@gmail.com', label: 'Email' }
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
      
      setTimeout(() => {
        this.initAnimations();
        this.hasInitializedHome = true;
      }, 100);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      gsap.killTweensOf('*');
    }
  }

  private initAnimations(): void {
    // Hero text animation
    gsap.fromTo('.hero-title',
      { opacity: 0, x: 50 },
      { opacity: 1, x: 0, duration: 0.8, delay: 0.2 }
    );
    gsap.fromTo('.hero-subtitle',
      { opacity: 0, x: 50 },
      { opacity: 1, x: 0, duration: 0.8, delay: 0.4 }
    );
    gsap.fromTo('.hero-description',
      { opacity: 0, x: 50 },
      { opacity: 1, x: 0, duration: 0.8, delay: 0.6 }
    );
    gsap.fromTo('.hero-cta',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, delay: 0.8 }
    );

    // Hero image animation
    gsap.fromTo('.hero-image-container',
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 1, delay: 0.3 }
    );

    // Floating particles animation
    this.animateParticles();
  }

  private animateParticles(): void {
    const particles = document.querySelectorAll('.particle');
    particles.forEach((particle, index) => {
      gsap.to(particle, {
        y: -20 + Math.random() * 40,
        x: -10 + Math.random() * 20,
        duration: 2 + Math.random() * 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: index * 0.2
      });
    });
  }

  navigateTo(sectionId: string): void {
    if (this.isTransitioning() || this.activeSection() === sectionId) return;

    this.isTransitioning.set(true);

    const currentSection = document.querySelector('.section.active');
    const nextSection = document.querySelector(`#section-${sectionId}`);

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
                // Only run animations on first visit, not when navigating back
                if (sectionId === 'home' && !this.hasInitializedHome) {
                  this.initAnimations();
                  this.hasInitializedHome = true;
                }
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

  onFilterChange(filterValue: string): void {
    this.filter.set(filterValue);
    this.focusedIndex.set(0);
    this.announceFilterResults();
  }

  onGameSelect(game: GameItem): void {
    this.router.navigate([game.route]);
  }

  onCardKeydown(event: { game: GameItem; event: KeyboardEvent }): void {
    const { event: keyEvent } = event;

    switch (keyEvent.key) {
      case 'ArrowLeft':
        keyEvent.preventDefault();
        this.moveFocus(-1);
        break;
      case 'ArrowRight':
        keyEvent.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowUp':
        keyEvent.preventDefault();
        this.moveFocus(-this.gridColumns());
        break;
      case 'ArrowDown':
        keyEvent.preventDefault();
        this.moveFocus(this.gridColumns());
        break;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.gridColumns();
  }

  private moveFocus(direction: number): void {
    const currentIndex = this.focusedIndex();
    const maxIndex = this.filteredGames().length - 1;
    let newIndex = currentIndex + direction;

    newIndex = Math.max(0, Math.min(newIndex, maxIndex));
    this.focusedIndex.set(newIndex);
    this.focusCard(newIndex);
  }

  private focusCard(index: number): void {
    setTimeout(() => {
      const cards = document.querySelectorAll('.home-game-card');
      const targetCard = cards[index] as HTMLElement;
      if (targetCard) {
        targetCard.focus();
      }
    }, 0);
  }

  private announceFilterResults(): void {
    const count = this.filteredGames().length;
    const announcement = count === 1 ? '1 game shown' : `${count} games shown`;
    const liveRegion = document.getElementById('home-games-live-region');
    if (liveRegion) {
      liveRegion.textContent = announcement;
    }
  }

  getCardTabIndex(index: number): number {
    return index === this.focusedIndex() ? 0 : -1;
  }

  trackByGameId(index: number, game: GameItem): string {
    return game.id;
  }
}
