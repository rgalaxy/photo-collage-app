import { Component, Input, Signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { radixArrowRight } from '@ng-icons/radix-icons';
import { TiltDirective } from '../../../shared/directives/tilt.directive';
import { MagneticDirective } from '../../../shared/directives/magnetic.directive';

interface Project {
  n: string;
  title: string;
  category: string;
  year: string;
  tags: string[];
  featured?: boolean;
  /** Fill these in when ready — the card auto-upgrades from placeholder to live. */
  image?: string;
  link?: string;
}

@Component({
  selector: 'app-portfolio-section',
  standalone: true,
  imports: [NgIconComponent, TiltDirective, MagneticDirective, RouterLink],
  providers: [provideIcons({ radixArrowRight })],
  templateUrl: './portfolio-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './portfolio-section.component.scss',
})
export class PortfolioSectionComponent {
  @Input() activeSection: Signal<string> | undefined;

  /**
   * Placeholder projects. To go live, add `image` (16:10) + `link` to an item —
   * the card swaps its "case study soon" state for the real cover automatically.
   */
  projects: Project[] = [
    {
      n: '01',
      title: 'Fraud Detection System',
      category: 'Enterprise Web App',
      year: '2025',
      tags: ['Angular', 'RxJS', 'D3.js', 'WebSocket'],
      featured: true,
    },
    {
      n: '02',
      title: 'FDS v2 Platform',
      category: 'Frontend Architecture',
      year: '2025',
      tags: ['React', 'Vite', 'TDD'],
    },
    {
      n: '03',
      title: 'Realtime Chatbot UI',
      category: 'Product',
      year: '2025',
      tags: ['WebSocket', 'IndexedDB'],
    },
    {
      n: '04',
      title: 'Inventory Mobile App',
      category: 'Cross-platform Mobile',
      year: '2024',
      tags: ['React Native', 'Firebase', 'Offline-first'],
    },
    {
      n: '05',
      title: 'Sales Admin App',
      category: 'Mobile',
      year: '2023',
      tags: ['Flutter', 'Supabase'],
    },
    {
      n: '06',
      title: 'Your next project',
      category: 'Available',
      year: 'soon',
      tags: ["Let's build it"],
    },
  ];

  isPortfolio(): boolean {
    return this.activeSection ? this.activeSection() === 'portfolio' : false;
  }
}
