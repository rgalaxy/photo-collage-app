import { Component, Input, Signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { radixArrowRight } from '@ng-icons/radix-icons';

interface DevlogTeaser {
  date: string;
  title: string;
  tags: string[];
  read: string;
}

@Component({
  selector: 'app-blog-section',
  standalone: true,
  imports: [NgIconComponent, RouterLink],
  providers: [provideIcons({ radixArrowRight })],
  templateUrl: './blog-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './blog-section.component.scss',
})
export class BlogSectionComponent {
  @Input() activeSection: Signal<string> | undefined;

  /** Placeholder teasers — swap for real posts from the blog service when ready. */
  posts: DevlogTeaser[] = [
    {
      date: '2026 · 05',
      title: 'Building a pointer-reactive WebGL backdrop in Angular',
      tags: ['WebGL', 'GSAP'],
      read: '6 min',
    },
    {
      date: '2026 · 03',
      title: 'Shipping FDS v2 — migrating from Angular to Vite + React',
      tags: ['React', 'Migration'],
      read: '8 min',
    },
    {
      date: '2026 · 01',
      title: 'TDD habits that actually stuck on my frontend team',
      tags: ['Testing', 'Process'],
      read: '5 min',
    },
  ];

  isBlog(): boolean {
    return this.activeSection ? this.activeSection() === 'blog' : false;
  }
}
