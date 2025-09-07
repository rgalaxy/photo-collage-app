import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameItem } from '../../types/game.types';

@Component({
  selector: 'app-game-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-card.component.html',
  styleUrls: ['./game-card.component.scss']
})
export class GameCardComponent {
  @Input() game!: GameItem;
  @Input() tabindex: number = -1;
  @Output() cardClick = new EventEmitter<GameItem>();
  @Output() cardKeydown = new EventEmitter<{game: GameItem, event: KeyboardEvent}>();

  onCardClick(): void {
    if (!this.game.isComingSoon) {
      this.cardClick.emit(this.game);
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.game.isComingSoon && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      this.cardClick.emit(this.game);
    } else if (!this.game.isComingSoon) {
      this.cardKeydown.emit({ game: this.game, event });
    }
  }
}