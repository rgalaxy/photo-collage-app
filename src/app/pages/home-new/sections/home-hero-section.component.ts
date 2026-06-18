import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Output,
  EventEmitter,
  inject,
  PLATFORM_ID,
  Input,
  Signal,
  ViewChild,
  ElementRef,
  NgZone,
  ChangeDetectionStrategy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { radixArrowRight, radixArrowDown } from '@ng-icons/radix-icons';
import gsap from 'gsap';
import { MagneticDirective } from '../../../shared/directives/magnetic.directive';

@Component({
  selector: 'app-home-hero-section',
  standalone: true,
  imports: [NgIconComponent, MagneticDirective],
  providers: [provideIcons({ radixArrowRight, radixArrowDown })],
  templateUrl: './home-hero-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './home-hero-section.component.scss',
})
export class HomeHeroSectionComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() activeSection: Signal<string> | undefined;
  @Output() aboutClick = new EventEmitter<void>();
  @Output() navigate = new EventEmitter<string>();

  @ViewChild('tilt') tiltRef?: ElementRef<HTMLElement>;
  @ViewChild('visual') visualRef?: ElementRef<HTMLElement>;

  /** Rotating identity words — showcases the dev / gamer / animator / designer story. */
  roles = [
    'a frontend engineer',
    'a game tinkerer',
    'a motion designer',
    'an interaction craftsman',
    'a problem solver',
  ];

  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);
  private rolesTl?: gsap.core.Timeline;
  private orbTweens: gsap.core.Tween[] = [];

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Defer to ensure fonts/layout are ready, then play the entrance.
    setTimeout(() => this.zone.runOutsideAngular(() => this.intro(reduced)), 60);

    if (!reduced) {
      const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (fine && this.visualRef && this.tiltRef) {
        this.zone.runOutsideAngular(() => {
          this.visualRef!.nativeElement.addEventListener('pointermove', this.onTilt);
          this.visualRef!.nativeElement.addEventListener('pointerleave', this.onTiltLeave);
        });
      }
    }
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.rolesTl?.kill();
    this.orbTweens.forEach(t => t.kill());
    gsap.killTweensOf('.hero-word, .hero-eyebrow, .hero-roles, .hero-desc, .hero-actions, .hero-stats, .photo-card, .scroll-hint');
    this.visualRef?.nativeElement.removeEventListener('pointermove', this.onTilt);
    this.visualRef?.nativeElement.removeEventListener('pointerleave', this.onTiltLeave);
  }

  private intro(reduced: boolean): void {
    if (reduced) {
      this.startRoles();
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.hero-eyebrow', { opacity: 0, y: 16, duration: 0.7 })
      .from(
        '.hero-word',
        { yPercent: 120, opacity: 0, duration: 1, stagger: 0.08 },
        '-=0.45'
      )
      .from('.hero-roles', { opacity: 0, y: 18, duration: 0.7 }, '-=0.5')
      .from('.hero-desc', { opacity: 0, y: 18, duration: 0.7 }, '-=0.55')
      .from('.hero-actions', { opacity: 0, y: 18, duration: 0.7 }, '-=0.55')
      .from('.hero-stats > *', { opacity: 0, y: 14, duration: 0.6, stagger: 0.08 }, '-=0.5')
      .from(
        '.photo-card',
        { opacity: 0, scale: 0.9, rotateY: -12, filter: 'blur(8px)', duration: 1.1 },
        '-=1.1'
      )
      .from('.orb', { opacity: 0, scale: 0, duration: 0.8, stagger: 0.1 }, '-=0.7')
      .from('.scroll-hint', { opacity: 0, duration: 0.6 }, '-=0.3');

    this.floatOrbs();
    this.startRoles();
  }

  private startRoles(): void {
    const items = gsap.utils.toArray<HTMLElement>('.role');
    if (!items.length) return;
    gsap.set(items, { yPercent: 110, opacity: 0 });
    gsap.set(items[0], { yPercent: 0, opacity: 1 });

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    this.rolesTl = gsap.timeline({ repeat: -1, delay: 1.4 });
    items.forEach((_, i) => {
      const next = items[(i + 1) % items.length];
      this.rolesTl!
        .to(items[i], { yPercent: -110, opacity: 0, duration: 0.6, ease: 'expo.inOut' }, '+=1.8')
        .fromTo(
          next,
          { yPercent: 110, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out' },
          '<'
        );
    });
  }

  private floatOrbs(): void {
    const orbs = gsap.utils.toArray<HTMLElement>('.orb');
    orbs.forEach((orb, i) => {
      this.orbTweens.push(
        gsap.to(orb, {
          y: gsap.utils.random(-26, 26),
          x: gsap.utils.random(-16, 16),
          duration: gsap.utils.random(3, 5),
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          delay: i * 0.25,
        })
      );
    });
  }

  private onTilt = (e: PointerEvent) => {
    const el = this.visualRef!.nativeElement;
    const tilt = this.tiltRef!.nativeElement;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    tilt.style.setProperty('--ry', `${px * 18}deg`);
    tilt.style.setProperty('--rx', `${-py * 18}deg`);
  };

  private onTiltLeave = () => {
    const tilt = this.tiltRef!.nativeElement;
    tilt.style.setProperty('--ry', '0deg');
    tilt.style.setProperty('--rx', '0deg');
  };

  openAboutModal(): void {
    this.aboutClick.emit();
  }

  goTo(section: string): void {
    this.navigate.emit(section);
  }
}
