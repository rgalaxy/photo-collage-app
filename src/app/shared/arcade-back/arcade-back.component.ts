import { Component, Input, booleanAttribute, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Themed "← Arcade" control that returns from a standalone game to the home
 * Games section (triggering the gradient route wipe). Two layouts:
 *   <app-arcade-back />            inline (drop into an existing header)
 *   <app-arcade-back floating />   fixed top-left (for full-bleed game pages)
 */
@Component({
  selector: 'app-arcade-back',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="arcade-back"
      [class.floating]="floating"
      routerLink="/"
      fragment="section-games"
      aria-label="Back to the arcade"
    >
      <span class="ab-arrow" aria-hidden="true">←</span>
      <span class="ab-text">Arcade</span>
    </a>
  `,
  styles: [
    `
      .arcade-back {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 17px;
        border-radius: 100px;
        font-family: var(--font-display, sans-serif);
        font-weight: 600;
        font-size: 0.85rem;
        letter-spacing: 0.01em;
        color: #fff;
        text-decoration: none;
        background: var(--brand-gradient, linear-gradient(115deg, #7c3aed, #22d3ee, #fb7185));
        box-shadow: 0 10px 26px -12px rgba(124, 58, 237, 0.7);
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease;
      }
      .arcade-back:hover {
        transform: translateY(-2px);
        box-shadow: 0 16px 38px -12px rgba(34, 211, 238, 0.6);
      }
      .arcade-back.floating {
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 200;
      }
      .ab-arrow {
        font-size: 1.1rem;
        line-height: 1;
        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .arcade-back:hover .ab-arrow {
        transform: translateX(-3px);
      }
      @media (max-width: 560px) {
        .ab-text {
          display: none;
        }
        .arcade-back {
          padding: 10px 12px;
        }
      }
    `,
  ],
})
export class ArcadeBackComponent {
  @Input({ transform: booleanAttribute }) floating = false;
}
