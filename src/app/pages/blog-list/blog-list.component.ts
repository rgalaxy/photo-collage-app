import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { ThemeService } from '../../services/theme.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './blog-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './blog-list.component.scss',
})
export class BlogListComponent implements OnInit {
  private blogService = inject(BlogService);
  private themeService = inject(ThemeService);
  private seoService = inject(SeoService);

  posts: any[] = [];
  isLoading = true;
  skeletons = [0, 1, 2, 3];

  ngOnInit(): void {
    this.seoService.updateSEO(this.seoService.getBlogListSEO());
    this.loadPosts();
  }

  async loadPosts(): Promise<void> {
    try {
      this.isLoading = true;
      this.posts = await this.blogService.getAllPosts();
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      this.isLoading = false;
    }
  }

  get isDarkMode(): boolean {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
