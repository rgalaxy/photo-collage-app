import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  radixArrowRight,
  radixEnvelopeClosed,
  radixGithubLogo,
  radixLinkedinLogo,
  radixDownload,
} from '@ng-icons/radix-icons';
import { SeoService } from '../services/seo.service';
import { RevealDirective } from '../shared/directives/reveal.directive';
import { MagneticDirective } from '../shared/directives/magnetic.directive';

interface Role {
  company: string;
  role: string;
  period: string;
  points: string[];
  wins?: string[];
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [RouterLink, NgIconComponent, RevealDirective, MagneticDirective],
  providers: [
    provideIcons({
      radixArrowRight,
      radixEnvelopeClosed,
      radixGithubLogo,
      radixLinkedinLogo,
      radixDownload,
    }),
  ],
  templateUrl: './portfolio.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./portfolio.component.scss'],
})
export class PortfolioComponent implements OnInit {
  private seoService = inject(SeoService);

  cvUrl = 'assets/files/Martin%20CV%202026.pdf';

  profile = {
    name: 'Martin Haryanto',
    title: 'Fullstack Software Enthusiast',
    summary:
      'Software developer with a decade of experience across the web. Deep on both front-end and back-end, with a habit of bringing best practices to every development cycle — from TDD to system design and shipping AI-assisted features.',
    location: 'Cinere, Depok · Indonesia',
    email: 'hollandmakermh@gmail.com',
  };

  stats = [
    { value: '10+', label: 'years shipping' },
    { value: '8', label: 'companies & clients' },
    { value: '6', label: 'languages & frameworks' },
  ];

  experiences: Role[] = [
    {
      company: 'Gravion.AI',
      role: 'Senior Frontend Developer',
      period: 'Apr 2025 — Present',
      points: [
        'Lead frontend for a Fraud Detection System (v1) in Angular 17, and kickstarted v2 on Vite + React.',
        'Built a realtime chatbot interface over WebSocket with IndexedDB-backed history.',
        'Drove TDD across all frontend projects with Vitest, and custom data viz with ECharts, react-chart & D3.js.',
        'Orchestrate multiple AI agents (SDD) to turn business & tech requirements into shipped implementation.',
      ],
    },
    {
      company: 'Wifkain',
      role: 'Technical Lead',
      period: 'Nov 2023 — May 2025',
      points: [
        'Owned tech-stack strategy, infrastructure and team management across Marketing, Finance, Sales & Ops.',
        'Ran user interviews, monthly sprint reports and quarterly KPI reviews; led tech hiring.',
      ],
      wins: [
        'Built a KPI framework for a team of 6 (3 Dev, QA, PM, Designer).',
        '+200% product & tech documentation in 8 months.',
        '−30% infrastructure cost via SQL performance tuning & streamlined Cloud Build.',
      ],
    },
    {
      company: 'Wifkain',
      role: 'Front End Lead',
      period: 'Apr 2022 — Oct 2023',
      points: [
        'Led the dev team on frontend best practices with Next.js and React Native.',
        'Built an Airtable-powered dashboard for Marketing, Sales & Ops; reviewed all FE deployments.',
      ],
      wins: [
        '−60% cloud cost by trimming unused GCP / Cloud Run and right-sizing Cloud SQL.',
        'Migrated infra off Airtable to an in-house system (−30% overall tech cost).',
        'Team of 4, ~80 sprint points, 90% of sprint goals met; introduced Cypress E2E.',
      ],
    },
    {
      company: 'PT Achilles Advanced Systems',
      role: 'Senior Software Developer',
      period: 'Mar 2019 — Mar 2022',
      points: [
        'Team lead reporting to Tech Lead; built backend with NestJS and its best practices.',
        'Weekly TDD challenges with Indonesian & Australian devs; synced with Singapore & AU on Open API.',
        'Championed SOLID / KISS / FIRST and weekly knowledge sharing; Datadog & Sentry observability.',
      ],
    },
    {
      company: 'PT Achilles Advanced Systems',
      role: 'Front End Developer',
      period: 'Mar 2016 — Mar 2019',
      points: [
        'Sliced and built UI/UX for web apps; Vue 2 best practices and Drupal CMS landing pages.',
        'Set up Google Analytics, frontend automation with Selenium, and TDD across FE & BE.',
      ],
    },
    {
      company: 'Weekend Inc.',
      role: 'Interactive Developer',
      period: 'Oct 2014 — Mar 2015',
      points: [
        'Translated designs into responsive, cross-browser HTML & CSS with a pixel-perfect bar.',
      ],
    },
  ];

  freelance: Role[] = [
    {
      company: 'PT. Solusi Pintar Digital',
      role: 'React Native Developer (Freelance)',
      period: 'Jan 2024 — Jun 2024',
      points: [
        'Cross-platform inventory app: offline-first sync (redux-persist + AsyncStorage), QR scanning, multi-role Firebase auth, Expo push, REST + Supabase.',
      ],
    },
    {
      company: 'CV. Arta Karya Abadi',
      role: 'Flutter Developer (Freelance)',
      period: 'Oct 2022 — Jan 2023',
      points: [
        'Sales administration app with Google Sheets API sync, offline draft-saving via Hive, and REST + Supabase.',
      ],
    },
  ];

  education = [
    { school: 'Bina Nusantara University', detail: 'Bachelor of Computer Science', period: '2011 — 2014' },
    { school: 'IBM ASMI', detail: 'Business Analytics (Master) — did not finish', period: '2021 — 2022' },
  ];

  skillGroups = [
    { label: 'Frontend', items: ['Next.js', 'React', 'React Native', 'Flutter', 'Angular'] },
    { label: 'Backend', items: ['Golang', 'NestJS', 'Express', 'Python'] },
    { label: 'Databases', items: ['PostgreSQL', 'MongoDB', 'SQLite', 'Airtable'] },
    { label: 'CMS', items: ['Drupal', 'WordPress', 'Shopify', 'Strapi', 'Prismic'] },
    { label: 'Cloud · GCP', items: ['Cloud SQL', 'Cloud Build', 'Cloud Run', 'Cloud Logging', 'Storage API'] },
    { label: 'AI Tools', items: ['Copilot', 'ChatGPT', 'Gemini', 'Qwen', 'Aider'] },
  ];

  languages = ['English', 'Indonesian', 'Hokkien'];
  hobbies = ['Badminton', 'Online gaming', 'Movies', 'Brainstorming'];

  socials = [
    { icon: 'radixGithubLogo', label: 'GitHub', url: 'https://github.com/rgalaxy' },
    { icon: 'radixLinkedinLogo', label: 'LinkedIn', url: 'https://linkedin.com/in/martin-haryanto' },
    { icon: 'radixEnvelopeClosed', label: 'Email', url: 'mailto:hollandmakermh@gmail.com' },
  ];

  ngOnInit(): void {
    this.seoService.updateSEO({
      title: 'Martin Haryanto | Résumé',
      description: 'The résumé of Martin Haryanto — a fullstack software developer with a decade of experience.',
      keywords: 'Martin Haryanto, resume, cv, software developer, frontend',
      type: 'profile',
    });
  }
}
