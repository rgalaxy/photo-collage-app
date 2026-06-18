import { Component, Input, Signal, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { radixArrowRight } from '@ng-icons/radix-icons';
import { MagneticDirective } from '../../../shared/directives/magnetic.directive';

interface Skill {
  name: string;
  /** 0–100 proficiency for tech skills. */
  level?: number;
  /** Emoji for "play" (sports) chips. */
  emoji?: string;
}

interface SkillCategory {
  id: string;
  label: string;
  blurb: string;
  kind: 'tech' | 'play';
  skills: Skill[];
}

@Component({
  selector: 'app-about-section',
  standalone: true,
  imports: [MagneticDirective, RouterLink, NgIconComponent],
  providers: [provideIcons({ radixArrowRight })],
  templateUrl: './about-section.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './about-section.component.scss',
})
export class AboutSectionComponent {
  /** Kept for backwards-compat with the parent binding (no longer rendered directly). */
  @Input() activeSection: Signal<string> | undefined;
  @Input() skills: Array<{ name: string; description: string; icon: string }> = [];

  activeCat = signal<string>('frontend');

  categories: SkillCategory[] = [
    {
      id: 'frontend',
      label: 'Frontend',
      kind: 'tech',
      blurb: 'Where I spend most of my time — building fast, accessible, delightful UIs.',
      skills: [
        { name: 'Angular', level: 95 },
        { name: 'TypeScript', level: 92 },
        { name: 'React', level: 88 },
        { name: 'Next.js', level: 85 },
        { name: 'Vue', level: 80 },
        { name: 'TanStack', level: 78 },
      ],
    },
    {
      id: 'backend',
      label: 'Backend',
      kind: 'tech',
      blurb: 'APIs, queues and the plumbing that keeps products running.',
      skills: [
        { name: 'Node.js', level: 90 },
        { name: 'Python', level: 82 },
        { name: 'GraphQL', level: 80 },
        { name: 'RabbitMQ', level: 75 },
      ],
    },
    {
      id: 'mobile',
      label: 'Mobile',
      kind: 'tech',
      blurb: 'Shipping to pockets with cross-platform and native toolkits.',
      skills: [
        { name: 'React Native', level: 82 },
        { name: 'Flutter', level: 78 },
        { name: 'Swift', level: 70 },
      ],
    },
    {
      id: 'databases',
      label: 'Databases',
      kind: 'tech',
      blurb: 'Modelling data so it stays fast and sane as products grow.',
      skills: [
        { name: 'PostgreSQL', level: 86 },
        { name: 'MySQL', level: 85 },
        { name: 'SQLite', level: 82 },
        { name: 'MongoDB', level: 80 },
      ],
    },
    {
      id: 'cms',
      label: 'CMS',
      kind: 'tech',
      blurb: 'Giving content teams superpowers without slowing the frontend down.',
      skills: [
        { name: 'Contentful', level: 86 },
        { name: 'Strapi', level: 82 },
        { name: 'WordPress', level: 80 },
        { name: 'Ghost', level: 75 },
        { name: 'Drupal', level: 70 },
      ],
    },
    {
      id: 'sports',
      label: 'Sports',
      kind: 'play',
      blurb: 'Off the keyboard, this is where the energy goes.',
      skills: [
        { name: 'Badminton', emoji: '🏸' },
        { name: 'Basketball', emoji: '🏀' },
        { name: 'Futsal', emoji: '⚽' },
        { name: 'Run', emoji: '🏃' },
        { name: 'Padel', emoji: '🏓' },
        { name: 'Tennis', emoji: '🎾' },
        { name: 'Racing', emoji: '🏎️' },
      ],
    },
  ];

  current = computed(
    () => this.categories.find(c => c.id === this.activeCat()) ?? this.categories[0]
  );

  setCat(id: string): void {
    this.activeCat.set(id);
  }

  /** True only while this is the visible deck section — drives entrance animations. */
  isAbout(): boolean {
    return this.activeSection ? this.activeSection() === 'about' : false;
  }

  /** Two-letter monogram tile for a tech skill (e.g. "Next.js" -> "Ne"). */
  mono(name: string): string {
    return name.replace(/[^a-zA-Z]/g, '').slice(0, 2);
  }

  levelScale(level: number | undefined): number {
    return (level ?? 0) / 100;
  }
}
