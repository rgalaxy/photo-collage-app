import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  constructor(private router: Router) {}

  /**
   * Navigate to a blog post with proper SEO tracking
   */
  navigateToBlogPost(slug: string): void {
    this.router.navigate(['/blog', slug]);
  }

  /**
   * Navigate to blog list
   */
  navigateToBlog(): void {
    this.router.navigate(['/blog']);
  }

  /**
   * Navigate to home page
   */
  navigateHome(): void {
    this.router.navigate(['/']);
  }

  /**
   * Get internal link suggestions for blog posts (for future implementation)
   */
  getRelatedPosts(currentSlug: string, allPosts: any[]): any[] {
    // Simple related posts logic - could be enhanced with tags/categories
    return allPosts
      .filter(post => post.fields.slug !== currentSlug)
      .slice(0, 3);
  }

  /**
   * Generate breadcrumb data for SEO
   */
  generateBreadcrumbs(currentRoute: string): any {
    const breadcrumbs = [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://martinharyanto.netlify.app/"
      }
    ];

    if (currentRoute.startsWith('/blog/')) {
      breadcrumbs.push({
        "@type": "ListItem", 
        "position": 2,
        "name": "Blog",
        "item": "https://martinharyanto.netlify.app/blog"
      });

      const slug = currentRoute.replace('/blog/', '');
      if (slug) {
        breadcrumbs.push({
          "@type": "ListItem",
          "position": 3,
          "name": slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          "item": `https://martinharyanto.netlify.app${currentRoute}`
        });
      }
    } else if (currentRoute === '/blog') {
      breadcrumbs.push({
        "@type": "ListItem",
        "position": 2,
        "name": "Blog", 
        "item": "https://martinharyanto.netlify.app/blog"
      });
    }

    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs
    };
  }
}