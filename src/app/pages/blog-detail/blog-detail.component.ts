import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { SeoService } from '../../services/seo.service';
import { CommonModule } from '@angular/common';
import { documentToHtmlString, Options } from '@contentful/rich-text-html-renderer';
import { BLOCKS, Document } from '@contentful/rich-text-types';


@Component({
    selector: 'app-blog-detail',
    imports: [CommonModule, RouterModule],
    standalone: true,
    templateUrl: './blog-detail.component.html',
    styleUrl: './blog-detail.component.scss'
})
export class BlogDetailComponent {
  private route = inject(ActivatedRoute);
  private blogService = inject(BlogService);
  private seoService = inject(SeoService);

  post: any;
  notFound = false;
  htmlContent: string = '';
  content?: Document

  constructor() {}

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
                  return `<img src="https:${url}" alt="${description}" loading="lazy">`;
                }
                return '';
              },
            }
          };
          console.log(post)
          this.post = post;
          this.htmlContent = documentToHtmlString(post.fields['content'] as Document, options);
          
          // Update SEO for the specific blog post
          const title = post.fields['title'] as string;
          const description = (post.fields['description'] || post.fields['summary'] || `Read about ${title} on Martin Haryanto's blog`) as string;
          const publishedDate = (post.fields['publishedDate'] || post.sys?.createdAt) as string;
          
          this.seoService.updateSEO(this.seoService.getBlogPostSEO(title, description, slug, publishedDate));
        }
      }).catch(error => {
        console.error('Error fetching post:', error);
      });
    }
  }
}
