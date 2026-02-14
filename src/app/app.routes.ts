import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home-new/home-new.component').then(m => m.HomeNewComponent),
  },
  {
    path: 'old-portfolio',
    loadComponent: () =>
      import('./portfolio/portfolio.component').then(m => m.PortfolioComponent),
  },
  { path: 'blog', loadComponent: () => import('./pages/blog-list/blog-list.component').then(m => m.BlogListComponent) },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./pages/blog-detail/blog-detail.component').then(m => m.BlogDetailComponent),
  },
  {
    path: 'mini-game-blacksmith',
    loadComponent: () =>
      import('./pages/mini-game-blacksmith/mini-game-blacksmith.component').then(m => m.MiniGameBlacksmithComponent),
  },
  {
    path: 'click-the-target-game',
    loadComponent: () =>
      import('./pages/click-the-target-game/click-the-target-game.component').then(m => m.ClickTheTargetGameComponent),
  },
  {
    path: 'pong-game',
    loadComponent: () =>
      import('./pages/pong-game/pong-game.component').then(m => m.PongGameComponent),
  }
];
