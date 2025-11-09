import { Component, OnInit, AfterViewInit, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { 
  radixDesktop,
  radixGear,
  radixMobile,
  radixTable,
  radixEnvelopeClosed,
  radixMobile as radixPhone,
  radixGlobe,
  radixLinkedinLogo,
  radixGithubLogo,
  radixInstagramLogo
} from '@ng-icons/radix-icons';
import { SeoService } from '../services/seo.service';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [provideIcons({ 
    radixDesktop, 
    radixGear, 
    radixMobile, 
    radixTable,
    radixEnvelopeClosed,
    radixPhone,
    radixGlobe,
    radixLinkedinLogo,
    radixGithubLogo,
    radixInstagramLogo
  })],
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss']
})
export class PortfolioComponent implements OnInit, AfterViewInit {
  private seoService = inject(SeoService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  
  skills = [
    {
      name: 'Frontend Development',
      description: 'Angular, React, Vue, TypeScript.',
      icon: 'radixDesktop'
    },
    {
      name: 'Backend Development', 
      description: 'Node.js, Python, RabbitMQ, GraphQL.',
      icon: 'radixGear'
    },
    {
      name: 'Mobile Development',
      description: 'Flutter, React Native, Swift.',
      icon: 'radixMobile'
    },
    {
      name: 'Databases',
      description: 'MySQL, PostgreSQL, MongoDB, SQLite.',
      icon: 'radixTable'
    }
  ];

  projects = [
    {
      title: 'Web Automation Bot',
      description: 'A bot for automating web tasks for a expedition application',
      tech: ['Python', ' Selenium'],
      imageUrl: '',
    },
    {
      title: 'Blacksmith Mini Game',
      description: 'A fun and interactive blacksmith simulation game',
      tech: ['Angular', 'Node.js', 'Supabase'],
      imageUrl:'',
      redirectionUrl: '/mini-game-blacksmith'
    },
    {
      title: 'Click The Target Game',
      description: 'Fast-paced target clicking game with combo system',
      tech: ['Angular', 'RxJS', 'Animations'],
      imageUrl:'',
      redirectionUrl: '/click-the-target-game'
    },
    // {
    //   title: 'Photo Gallery',
    //   description: 'Beautiful photo sharing application',
    //   tech: ['Angular', 'Firebase', 'TypeScript']
    // }
  ];

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      gsap.registerPlugin(ScrollTrigger);
    }
  }

  ngOnInit(): void {
    // Set SEO data for home page
    this.seoService.updateSEO(this.seoService.getHomePageSEO());
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initScrollAnimations();
      this.initParallaxEffects();
      this.initScrollProgress();
    }
  }

  private initScrollProgress(): void {
    const progressBar = document.querySelector('.scroll-progress') as HTMLElement;
    
    if (progressBar) {
      window.addEventListener('scroll', () => {
        const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (window.scrollY / windowHeight) * 100;
        progressBar.style.width = scrolled + '%';
        progressBar.style.animation = 'none';
      });
    }
  }

  private initScrollAnimations(): void {
    // Animate sections on scroll
    const sections = document.querySelectorAll('section:not(#home)');
    
    sections.forEach((section) => {
      gsap.fromTo(
        section,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          scrollTrigger: {
            trigger: section,
            start: 'top 80%',
            end: 'top 30%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    });

    // Animate skill cards
    const skillCards = document.querySelectorAll('.skill-card');
    skillCards.forEach((card, index) => {
      gsap.fromTo(
        card,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          delay: index * 0.1,
          scrollTrigger: {
            trigger: card,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    });

    // Animate portfolio items
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    portfolioItems.forEach((item, index) => {
      gsap.fromTo(
        item,
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.5,
          delay: index * 0.1,
          scrollTrigger: {
            trigger: item,
            start: 'top 85%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    });
  }

  private initParallaxEffects(): void {
    // Parallax effect on hero section
    const heroContent = document.querySelector('.hero-content');
    const heroImage = document.querySelector('.hero-image');

    if (heroContent) {
      gsap.to(heroContent, {
        y: 100,
        opacity: 0.5,
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }

    if (heroImage) {
      gsap.to(heroImage, {
        y: 150,
        opacity: 0.3,
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });
    }

    // Add floating animation to decorative elements
    gsap.to('.orange-circle', {
      y: -20,
      duration: 2,
      repeat: -1,
      yoyo: true,
      ease: 'power1.inOut',
    });
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  downloadCV(): void {
    const link = document.createElement('a');
    link.href = 'assets/files/2024.pdf';
    link.download = 'Martin_Haryanto_CV_2024.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  navigateToProject(project: any): void {
    if (project.redirectionUrl) {
      this.router.navigate([project.redirectionUrl]);
    }
  }

  navigateToMyGames(): void {
    this.router.navigate(['/my-games']);
  }
}
