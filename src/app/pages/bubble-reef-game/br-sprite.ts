import { Component, Input, HostBinding, ChangeDetectionStrategy } from '@angular/core';
import { FRAME_COUNT } from './sea-creatures';

/**
 * Plays a baked creature flip-book (horizontal PNG strip from
 * sea-creatures.ts) as a CSS steps() animation — the characters visibly swim
 * with zero JS per frame. Each instance starts at a random phase so schools
 * of the same species don't move in lockstep.
 *
 *   <br-sprite [src]="spriteOf('tilly')" [size]="58" />
 */
@Component({
  selector: 'br-sprite',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  styles: [
    `
      :host {
        display: inline-block;
        background-repeat: no-repeat;
        /* 8 frames side by side */
        background-size: 800% 100%;
        animation: br-flip 0.9s steps(8) infinite;
      }

      /* 8/7 of the span → steps(8) lands exactly on each frame */
      @keyframes br-flip {
        from { background-position-x: 0%; }
        to { background-position-x: 114.2857%; }
      }

      @media (prefers-reduced-motion: reduce) {
        :host {
          animation: none;
        }
      }
    `,
  ],
})
export class BrSpriteComponent {
  static readonly frames = FRAME_COUNT;

  @Input({ required: true }) src = '';
  @Input() size = 48;

  @HostBinding('style.background-image') get bg(): string {
    return this.src ? `url(${this.src})` : 'none';
  }

  @HostBinding('style.width.px') get w(): number {
    return this.size;
  }

  @HostBinding('style.height.px') get h(): number {
    return this.size;
  }

  /** Random start phase (set once; only rendered in the browser). */
  @HostBinding('style.animation-delay') delay = `-${(Math.random() * 0.9).toFixed(2)}s`;
}
