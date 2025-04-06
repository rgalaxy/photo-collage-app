import { Component } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { BlogService } from '../../services/blog.service';
import { CommonModule } from '@angular/common';

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
          this.post = post;
        }
      }).catch(error => {
        console.error('Error fetching post:', error);
      });
    }
  }
}
