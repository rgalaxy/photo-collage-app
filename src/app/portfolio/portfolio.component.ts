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

  constructor(private router: Router) { }

  ngOnInit(): void {
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
}
