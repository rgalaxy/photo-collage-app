import { Component, OnInit, OnDestroy, Output, EventEmitter, inject, PLATFORM_ID, Input, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  radixArrowRight
} from '@ng-icons/radix-icons';
import gsap from 'gsap';

@Component({
  selector: 'app-home-hero-section',
  standalone: true,
  imports: [NgIconComponent],
  providers: [provideIcons({
    radixArrowRight
  })],
  templateUrl: './home-hero-section.component.html',
  styleUrl: './home-hero-section.component.scss'
})
export class HomeHeroSectionComponent implements OnInit, OnDestroy {
  @Input() activeSection: Signal<string> | undefined;
  @Output() aboutClick = new EventEmitter<void>();

  private platformId = inject(PLATFORM_ID);
  private hasInitializedAnimations = false;

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.initAnimations();
        this.hasInitializedAnimations = true;
      }, 100);
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      gsap.killTweensOf('.hero-title, .hero-subtitle, .hero-description, .hero-cta, .hero-image-container, .particle');
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

  openAboutModal(): void {
    this.aboutClick.emit();
  }
}
