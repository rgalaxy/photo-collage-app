import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { CommonModule } from '@angular/common';
import { documentToHtmlString, Options } from '@contentful/rich-text-html-renderer';
import { BLOCKS, Document } from '@contentful/rich-text-types';
import { Meta, Title } from '@angular/platform-browser';


@Component({
  selector: 'app-blog-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './blog-detail.component.html',
  styleUrl: './blog-detail.component.scss'
})
export class BlogDetailComponent {
  post: any;
  notFound = false;
  htmlContent: string = '';
  content?: Document


  constructor(
    private route: ActivatedRoute,
    private blogService: BlogService,
    private meta: Meta,
    private title: Title
  ) {}

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.blogService.getPostBySlug(slug).then(post => {
        if(!post) {
          this.notFound = true
          console.error('Post not found');
          return;
        } else {
          const options: Options = {
            renderNode: {
              [BLOCKS.EMBEDDED_ASSET]: (node) => {
                const url = node.data['target'].fields?.file?.url;
                const description = node.data['target'].fields?.description || '';
                if (url) {
                  return `<img src=\"https:${url}\" alt=\"${description}\">`;
                }
                return '';
              },
            }
          };
          this.post = post;
          // Set SEO meta tags
          const title = (post.fields as any)['title'] + ' | Martin Haryanto Blog';
          const description = (post.fields as any)['summary'] || (post.fields as any)['title'];
          const coverImage = (post.fields as any)['coverImage'];
          const image = coverImage?.fields?.file?.url ? `https:${coverImage.fields.file.url}` : 'https://martinharyanto.netlify.app/assets/photos/me.png';
          const url = `https://martinharyanto.netlify.app/blog/${slug}`;
          this.title.setTitle(title);
          this.meta.updateTag({ name: 'description', content: description });
          this.meta.updateTag({ property: 'og:title', content: title });
          this.meta.updateTag({ property: 'og:description', content: description });
          this.meta.updateTag({ property: 'og:image', content: image });
          this.meta.updateTag({ property: 'og:url', content: url });
          this.meta.updateTag({ property: 'og:type', content: 'article' });
          this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
          this.meta.updateTag({ name: 'twitter:title', content: title });
          this.meta.updateTag({ name: 'twitter:description', content: description });
          this.meta.updateTag({ name: 'twitter:image', content: image });
          this.meta.updateTag({ name: 'robots', content: 'index, follow' });
          this.meta.updateTag({ name: 'canonical', content: url });
          // Add JSON-LD BlogPosting schema
          const blogPosting = {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            'headline': (post.fields as any)['title'],
            'image': [image],
            'author': {
              '@type': 'Person',
              'name': 'Martin Haryanto'
            },
            'datePublished': post.sys.createdAt,
            'dateModified': post.sys.updatedAt,
            'mainEntityOfPage': url,
            'description': description
          };
          const script = document.createElement('script');
          script.type = 'application/ld+json';
          script.text = JSON.stringify(blogPosting);
          document.head.appendChild(script);
          this.htmlContent = documentToHtmlString(post.fields['content'] as Document, options);
        }
      }).catch(error => {
        console.error('Error fetching post:', error);
      });
    }
  }
}
