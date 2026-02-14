import { Component, OnInit, OnDestroy, HostListener, inject, signal, computed } from '@angular/core';

import { Router } from '@angular/router';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { GameCardComponent } from '../../components/game-card/game-card.component';
import { GameFilterComponent } from '../../components/game-filter/game-filter.component';
import { GameItem, GAMES } from '../../types/game.types';
import { SeoService } from '../../services/seo.service';

@Component({
    selector: 'app-my-games-page',
    imports: [GameCardComponent, GameFilterComponent],
    standalone: true,
    templateUrl: './my-games-page.component.html',
    styleUrls: ['./my-games-page.component.scss'],
    animations: [
        trigger('listAnimation', [
            transition('* => *', [
                query(':enter', [
                    style({ opacity: 0, transform: 'scale(0.8) translateY(20px)' }),
                    stagger(50, [
                        animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1) translateY(0)' }))
                    ])
                ], { optional: true })
            ])
        ]),
        trigger('cardAnimation', [
            transition(':enter', [
                style({ opacity: 0, transform: 'scale(0.8) translateY(20px)' }),
                animate('300ms ease-out', style({ opacity: 1, transform: 'scale(1) translateY(0)' }))
            ]),
            transition(':leave', [
                animate('200ms ease-in', style({ opacity: 0, transform: 'scale(0.8) translateY(-20px)' }))
            ])
        ])
    ]
})
export class MyGamesPageComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private seoService = inject(SeoService);

  // Signals for reactive data management
  filter = signal('');
  focusedIndex = signal(0);
  
  // Computed filtered games list
  filteredGames = computed(() => {
    const filterValue = this.filter().toLowerCase().trim();
    if (!filterValue) {
      return GAMES;
    }
    return GAMES.filter(game => 
      game.title.toLowerCase().includes(filterValue) ||
      game.description.toLowerCase().includes(filterValue)
    );
  });

  // Computed grid columns for keyboard navigation
  gridColumns = computed(() => {
    return window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
  });

  constructor() {}

  ngOnInit(): void {
    // Set SEO data for my games page
    this.seoService.updateSEO({
      title: 'My Games - Interactive Games Collection',
      description: 'Browse and play our collection of interactive games including Blacksmith, Pong, Click Target, and more.',
      keywords: 'games, interactive, blacksmith, pong, click target, online games'
    });
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  onFilterChange(filterValue: string): void {
    this.filter.set(filterValue);
    this.focusedIndex.set(0); // Reset focus to first item
    this.announceFilterResults();
  }

  onGameSelect(game: GameItem): void {
    this.router.navigate([game.route]);
  }

  onCardKeydown(event: {game: GameItem, event: KeyboardEvent}): void {
    const { event: keyEvent } = event;
    
    switch (keyEvent.key) {
      case 'ArrowLeft':
        keyEvent.preventDefault();
        this.moveFocus(-1);
        break;
      case 'ArrowRight':
        keyEvent.preventDefault();
        this.moveFocus(1);
        break;
      case 'ArrowUp':
        keyEvent.preventDefault();
        this.moveFocus(-this.gridColumns());
        break;
      case 'ArrowDown':
        keyEvent.preventDefault();
        this.moveFocus(this.gridColumns());
        break;
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    // Trigger recomputation of grid columns
    this.gridColumns();
  }

  private moveFocus(direction: number): void {
    const currentIndex = this.focusedIndex();
    const maxIndex = this.filteredGames().length - 1;
    let newIndex = currentIndex + direction;

    // Clamp to valid range
    newIndex = Math.max(0, Math.min(newIndex, maxIndex));
    
    this.focusedIndex.set(newIndex);
    this.focusCard(newIndex);
  }

  private focusCard(index: number): void {
    // Focus the card element
    setTimeout(() => {
      const cards = document.querySelectorAll('.game-card');
      const targetCard = cards[index] as HTMLElement;
      if (targetCard) {
        targetCard.focus();
      }
    }, 0);
  }

  private announceFilterResults(): void {
    const count = this.filteredGames().length;
    const announcement = count === 1 
      ? '1 game shown' 
      : `${count} games shown`;
    
    // Create announcement for screen readers
    const liveRegion = document.getElementById('games-live-region');
    if (liveRegion) {
      liveRegion.textContent = announcement;
    }
  }

  getCardTabIndex(index: number): number {
    return index === this.focusedIndex() ? 0 : -1;
  }

  trackByGameId(index: number, game: GameItem): string {
    return game.id;
  }
}