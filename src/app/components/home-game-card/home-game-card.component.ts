import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { radixArrowRight } from '@ng-icons/radix-icons';

import { GameItem } from '../../types/game.types';

@Component({
  selector: 'app-home-game-card',
  standalone: true,
  imports: [CommonModule, NgIconComponent],
  providers: [provideIcons({ radixArrowRight })],
  templateUrl: './home-game-card.component.html',
  styleUrls: ['./home-game-card.component.scss']
})
export class HomeGameCardComponent {
  @Input() game!: GameItem;
  @Input() tabindex = -1;
  @Output() cardClick = new EventEmitter<GameItem>();
  @Output() cardKeydown = new EventEmitter<{ game: GameItem; event: KeyboardEvent }>();

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
