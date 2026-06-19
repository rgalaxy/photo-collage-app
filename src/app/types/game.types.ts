export type GameTag = 'single-player' | 'two-player' | 'arcade' | 'simulation' | 'strategy' | 'action';

export interface GameItem {
  id: string;
  title: string;
  description: string;
  tags: GameTag[];
  imageUrl: string;
  route: string;
  isComingSoon?: boolean;
}

export const GAMES: GameItem[] = [
  {
    id: 'mini-game-blacksmith',
    title: 'The Forge',
    description: 'A fun and interactive blacksmith simulation game where you craft weapons and armor.',
    tags: ['single-player', 'simulation'],
    imageUrl: '/assets/images/game-covers/blacksmith-cover.webp',
    route: '/mini-game-blacksmith'
  },
  {
    id: 'click-the-target-game',
    title: 'Click The Target',
    description: 'Fast-paced target clicking game with combo system. Test your reflexes and accuracy.',
    tags: ['single-player', 'arcade', 'action'],
    imageUrl: '/assets/images/game-covers/target-cover.webp',
    route: '/click-the-target-game'
  },
  {
    id: 'pong-game',
    title: 'Neon Pong',
    description: 'Classic pong game with modern graphics. Play against a friend or AI opponent.',
    tags: ['two-player', 'arcade'],
    imageUrl: '/assets/images/game-covers/pong-cover.webp',
    route: '/pong-game'
  },
  {
    id: 'perfect-harvest-game',
    title: 'Perfect Harvest',
    description: 'A 3D farming arcade game. Tap crops at peak ripeness, chain Perfects for huge combos, and climb the leaderboard.',
    tags: ['single-player', 'arcade', 'action'],
    imageUrl: '/assets/images/game-covers/perfect-harvest.webp',
    route: '/perfect-harvest-game'
  },
  {
    id: 'memory-match',
    title: 'Memory Match',
    description: 'Test your memory with this classic card matching game. Multiple difficulty levels.',
    tags: ['single-player', 'strategy'],
    imageUrl: 'https://via.placeholder.com/640x360?text=Memory+Match',
    route: '/memory-match',
    isComingSoon: true
  },
  {
    id: 'snake-game',
    title: 'Snake Game',
    description: 'The timeless snake game with smooth controls and increasing difficulty.',
    tags: ['single-player', 'arcade'],
    imageUrl: 'https://via.placeholder.com/640x360?text=Snake+Game',
    route: '/snake-game',
    isComingSoon: true
  },
  {
    id: 'tetris-blocks',
    title: 'Tetris Blocks',
    description: 'Classic block puzzle game. Clear lines and achieve high scores.',
    tags: ['single-player', 'strategy', 'arcade'],
    imageUrl: 'https://via.placeholder.com/640x360?text=Tetris+Blocks',
    route: '/tetris-blocks',
    isComingSoon: true
  }
];