import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { 
  radixDesktop,
  radixGear,
  radixMobile,
  radixTable
} from '@ng-icons/radix-icons';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, NgIcon],
  providers: [provideIcons({ radixDesktop, radixGear, radixMobile, radixTable })],
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
      imageUrl: ''
    },
    // {
    //   title: 'Task Management App',
    //   description: 'Collaborative project management tool',
    //   tech: ['React', 'Express', 'PostgreSQL']
    // },
    // {
    //   title: 'Photo Gallery',
    //   description: 'Beautiful photo sharing application',
    //   tech: ['Angular', 'Firebase', 'TypeScript']
    // }
  ];

  constructor() { }

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

  contactMe(): void {
    // Placeholder for contact functionality
    console.log('Opening contact...');
  }
}
