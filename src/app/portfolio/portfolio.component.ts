import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
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
export class PortfolioComponent implements OnInit {
  
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

  constructor(
    private router: Router,
    private meta: import('@angular/platform-browser').Meta,
    private title: import('@angular/platform-browser').Title
  ) {}

  ngOnInit(): void {
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      this.title.setTitle('Portfolio | Martin Haryanto');
      this.meta.updateTag({ name: 'description', content: 'Portfolio of Martin Haryanto, Frontend Engineer. Explore web development projects, skills, and experience.' });
      this.meta.updateTag({ property: 'og:title', content: 'Portfolio | Martin Haryanto' });
      this.meta.updateTag({ property: 'og:description', content: 'Portfolio of Martin Haryanto, Frontend Engineer. Explore web development projects, skills, and experience.' });
      this.meta.updateTag({ property: 'og:image', content: 'https://martinharyanto.netlify.app/assets/photos/me.png' });
      this.meta.updateTag({ property: 'og:url', content: 'https://martinharyanto.netlify.app/portfolio' });
      this.meta.updateTag({ property: 'og:type', content: 'website' });
      this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
      this.meta.updateTag({ name: 'twitter:title', content: 'Portfolio | Martin Haryanto' });
      this.meta.updateTag({ name: 'twitter:description', content: 'Portfolio of Martin Haryanto, Frontend Engineer. Explore web development projects, skills, and experience.' });
      this.meta.updateTag({ name: 'twitter:image', content: 'https://martinharyanto.netlify.app/assets/photos/me.png' });
      this.meta.updateTag({ name: 'robots', content: 'index, follow' });
      this.meta.updateTag({ name: 'canonical', content: 'https://martinharyanto.netlify.app/portfolio' });
      // Add JSON-LD WebPage schema
      const webPage = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        'name': 'Portfolio',
        'url': 'https://martinharyanto.netlify.app/portfolio',
        'description': 'Portfolio of Martin Haryanto, Frontend Engineer. Explore web development projects, skills, and experience.'
      };
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.text = JSON.stringify(webPage);
      document.head.appendChild(script);
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
}
