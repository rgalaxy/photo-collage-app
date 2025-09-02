import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SEOData {
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonical?: string;
  type?: string;
  schema?: any;
}

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private titleService = inject(Title);
  private metaService = inject(Meta);

  updateSEO(data: SEOData): void {
    // Update title
    this.titleService.setTitle(data.title);

    // Update basic meta tags
    this.metaService.updateTag({ name: 'title', content: data.title });
    this.metaService.updateTag({ name: 'description', content: data.description });
    
    if (data.keywords) {
      this.metaService.updateTag({ name: 'keywords', content: data.keywords });
    }

    // Update Open Graph tags
    this.metaService.updateTag({ property: 'og:title', content: data.ogTitle || data.title });
    this.metaService.updateTag({ property: 'og:description', content: data.ogDescription || data.description });
    this.metaService.updateTag({ property: 'og:type', content: data.type || 'website' });
    
    if (data.ogImage) {
      this.metaService.updateTag({ property: 'og:image', content: data.ogImage });
    }
    
    if (data.ogUrl) {
      this.metaService.updateTag({ property: 'og:url', content: data.ogUrl });
    }

    // Update Twitter Card tags
    this.metaService.updateTag({ name: 'twitter:title', content: data.twitterTitle || data.title });
    this.metaService.updateTag({ name: 'twitter:description', content: data.twitterDescription || data.description });
    
    if (data.twitterImage) {
      this.metaService.updateTag({ name: 'twitter:image', content: data.twitterImage });
    }

    // Update canonical URL
    if (data.canonical) {
      this.updateCanonical(data.canonical);
    }

    // Add structured data if provided
    if (data.schema) {
      this.addStructuredData(data.schema);
    }
  }

  private updateCanonical(url: string): void {
    let link: HTMLLinkElement | null = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private addStructuredData(schema: any): void {
    // Remove existing structured data script if any
    const existingScript = document.querySelector('script[type="application/ld+json"]#dynamic-schema');
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'dynamic-schema';
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  // Predefined SEO data for common pages
  getHomePageSEO(): SEOData {
    return {
      title: 'Martin Haryanto - Software Engineer & Frontend Developer',
      description: 'Passionate software engineer with a decade of experience in building and maintaining web applications. Expertise in full-stack development, UI/UX design, and agile methodologies.',
      keywords: 'Martin Haryanto, Software Engineer, Frontend Developer, Full Stack Developer, Web Developer, JavaScript, Angular, React, TypeScript',
      ogImage: 'https://martinharyanto.netlify.app/assets/photos/me.png',
      ogUrl: 'https://martinharyanto.netlify.app/',
      canonical: 'https://martinharyanto.netlify.app/',
      type: 'website'
    };
  }

  getBlogListSEO(): SEOData {
    return {
      title: 'Blog - Martin Haryanto | Software Engineering & Development Insights',
      description: 'Explore technical articles, tutorials, and insights about software development, frontend frameworks, and web technologies by Martin Haryanto.',
      keywords: 'Martin Haryanto blog, software engineering blog, web development tutorials, JavaScript tutorials, Angular guides, React tips',
      ogUrl: 'https://martinharyanto.netlify.app/blog',
      canonical: 'https://martinharyanto.netlify.app/blog',
      type: 'website'
    };
  }

  getBlogPostSEO(title: string, description: string, slug: string, publishedDate?: string): SEOData {
    const schema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": title,
      "description": description,
      "author": {
        "@type": "Person",
        "name": "Martin Haryanto",
        "url": "https://martinharyanto.netlify.app/"
      },
      "publisher": {
        "@type": "Person",
        "name": "Martin Haryanto"
      },
      "url": `https://martinharyanto.netlify.app/blog/${slug}`,
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": `https://martinharyanto.netlify.app/blog/${slug}`
      }
    };

    if (publishedDate) {
      (schema as any).datePublished = publishedDate;
    }

    return {
      title: `${title} | Martin Haryanto Blog`,
      description: description,
      keywords: `${title}, Martin Haryanto, software engineering, web development, tutorial`,
      ogUrl: `https://martinharyanto.netlify.app/blog/${slug}`,
      canonical: `https://martinharyanto.netlify.app/blog/${slug}`,
      type: 'article',
      schema: schema
    };
  }
}