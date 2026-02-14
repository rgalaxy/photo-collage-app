import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { BlogService } from '../../services/blog.service';
import { RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { ThemeService } from '../../services/theme.service';
import { SeoService } from '../../services/seo.service';
import {
  radixExclamationTriangle
} from '@ng-icons/radix-icons';

@Component({
    selector: 'app-blog-list',
    imports: [CommonModule, RouterModule, NgIcon],
    standalone: true,
    providers: [provideIcons({
            radixExclamationTriangle
        })],
    templateUrl: './blog-list.component.html',
    styleUrl: './blog-list.component.scss'
})
export class BlogListComponent {
  private blogService = inject(BlogService);
  private themeService = inject(ThemeService);
  private seoService = inject(SeoService);

  posts: any[] = [];
  sidebarOpen = true; // Start with sidebar open on desktop
  isLoading = true;
  showMobileOverlay = false; // Toggle for mobile overlay content
  showDropdown = false; // Toggle for dropdown menu

  // Constants
  readonly LINES_PER_POST = 6; // Number of lines per blog post item
  readonly HEADER_LINES = 5; // Number of lines in the header comment

  constructor() {}

  ngOnInit(): void {
    // Set SEO data for blog list page
    this.seoService.updateSEO(this.seoService.getBlogListSEO());
    this.loadPosts();
  }

  async loadPosts(): Promise<void> {
    try {
      this.isLoading = true;
      // Simulate loading delay for skeleton effect
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.posts = await this.blogService.getAllPosts();
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      this.isLoading = false;
    }
  }

  getVariableName(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^[0-9]/, 'post_$&')
      .substring(0, 30);
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  toggleMobileOverlay(): void {
    this.showMobileOverlay = !this.showMobileOverlay;
    this.closeDropdown(); // Close dropdown after toggle
  }

  toggleDropdown(): void {
    this.showDropdown = !this.showDropdown;
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.closeDropdown(); // Close dropdown after theme change
  }

  get isDarkMode(): boolean {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  closeDropdown(): void {
    this.showDropdown = false;
  }

  scrollToPost(index: number): void {
    const element = document.getElementById(`post-${index}`);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
      
      // Close sidebar on mobile after scrolling
      if (window.innerWidth <= 480) {
        this.sidebarOpen = false;
      }
    }
  }

  getSkeletonLines(): number[] {
    return Array(this.LINES_PER_POST).fill(0).map((_, i) => i);
  }

  getLineNumber(postIndex: number, lineOffset: number): number {
    return postIndex * this.LINES_PER_POST + this.HEADER_LINES + 1 + lineOffset;
  }
}
