import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { CommonModule } from '@angular/common';
import { documentToHtmlString, Options } from '@contentful/rich-text-html-renderer';
import { BLOCKS, Document } from '@contentful/rich-text-types';


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
    private blogService: BlogService
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
                  return `<img src="https:${url}" alt="${description}">`;
                }
                return '';
              },
            }
          };
          console.log(post)
          this.post = post;
          this.htmlContent = documentToHtmlString(post.fields['content'] as Document, options);
        }
      }).catch(error => {
        console.error('Error fetching post:', error);
      });
    }
  }
}
