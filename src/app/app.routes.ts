import { Routes } from '@angular/router';
import { PhotoListComponent } from './photo-list/photo-list.component';

export const routes: Routes = [
  {
    path: 'photo-list',
    component: PhotoListComponent,
  },
  { path: 'blog', loadComponent: () => import('./pages/blog-list/blog-list.component').then(m => m.BlogListComponent) },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./pages/blog-detail/blog-detail.component').then(m => m.BlogDetailComponent),
  }
];
