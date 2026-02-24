import { Component, OnInit, Input, Output, EventEmitter, signal, computed, inject, PLATFORM_ID, HostListener, Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GameFilterComponent } from '../../../components/game-filter/game-filter.component';
import { HomeGameCardComponent } from '../../../components/home-game-card/home-game-card.component';
import { GameItem, GAMES } from '../../../types/game.types';

@Component({
  selector: 'app-games-section',
  standalone: true,
  imports: [GameFilterComponent, HomeGameCardComponent],
  templateUrl: './games-section.component.html',
  styleUrl: './games-section.component.scss'
})
export class GamesSectionComponent implements OnInit {
  @Input() activeSection: Signal<string> | undefined;
  @Output() gameSelected = new EventEmitter<GameItem>();

  private platformId = inject(PLATFORM_ID);

  filter = signal('');
  focusedIndex = signal(0);

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

  gridColumns = computed(() => {
    return window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1;
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.announceFilterResults();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.gridColumns();
  }

  onFilterChange(filterValue: string): void {
    this.filter.set(filterValue);
    this.focusedIndex.set(0);
    this.announceFilterResults();
  }

  onGameSelect(game: GameItem): void {
    this.gameSelected.emit(game);
  }

  onCardKeydown(event: { game: GameItem; event: KeyboardEvent }): void {
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

  private moveFocus(direction: number): void {
    const currentIndex = this.focusedIndex();
    const maxIndex = this.filteredGames().length - 1;
    let newIndex = currentIndex + direction;

    newIndex = Math.max(0, Math.min(newIndex, maxIndex));
    this.focusedIndex.set(newIndex);
    this.focusCard(newIndex);
  }

  private focusCard(index: number): void {
    setTimeout(() => {
      const cards = document.querySelectorAll('.home-game-card');
      const targetCard = cards[index] as HTMLElement;
      if (targetCard) {
        targetCard.focus();
      }
    }, 0);
  }

  private announceFilterResults(): void {
    if (isPlatformBrowser(this.platformId)) {
      const count = this.filteredGames().length;
      const announcement = count === 1 ? '1 game shown' : `${count} games shown`;
      const liveRegion = document.getElementById('games-live-region');
      if (liveRegion) {
        liveRegion.textContent = announcement;
      }
    }
  }

  getCardTabIndex(index: number): number {
    return index === this.focusedIndex() ? 0 : -1;
  }

  trackByGameId(index: number, game: GameItem): string {
    return game.id;
  }
}
