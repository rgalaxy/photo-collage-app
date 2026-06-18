import { Component, Input, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JuiceService } from '../juice/juice.service';

/**
 * Shared chrome for every standalone game, styled like an app **window**:
 * macOS-style traffic-light dots whose cluster is the "close → back to arcade"
 * control (with an "arcade" label + a hover ← glyph), a centered window title,
 * and window controls on the right (mute + a projected actions slot).
 *
 *   <app-game-shell title="🏓 2-Player Pong">
 *     <button shellActions (click)="...">How to Play</button>
 *   </app-game-shell>
 */
@Component({
  selector: 'app-game-shell',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="gs-bar">
      <a class="gs-exit" routerLink="/" fragment="section-games" aria-label="Close — back to the arcade">
        <span class="gs-dots" aria-hidden="true">
          <span class="gs-dot red"></span>
          <span class="gs-dot amber"></span>
          <span class="gs-dot green"></span>
        </span>
        <span class="gs-exit-label">arcade</span>
      </a>

      <h1 class="gs-title">{{ title }}</h1>

      <div class="gs-right">
        <button
          class="gs-ctl gs-mute"
          type="button"
          (click)="toggleMute()"
          [attr.aria-label]="muted() ? 'Unmute sound effects' : 'Mute sound effects'"
        >
          {{ muted() ? '🔇' : '🔊' }}
        </button>
        <div class="gs-actions">
          <ng-content select="[shellActions]"></ng-content>
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      :host {
        position: sticky;
        top: 0;
        z-index: 60;
        display: block;
      }
      .gs-bar {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 14px;
        padding: 9px clamp(12px, 2.4vw, 22px);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(7, 7, 13, 0.74));
        backdrop-filter: blur(16px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      /* ---- left: window controls = back ---- */
      .gs-exit {
        justify-self: start;
        display: inline-flex;
        align-items: center;
        gap: 11px;
        padding: 6px 8px;
        border-radius: 10px;
        text-decoration: none;
        transition: background 0.2s ease;
      }
      .gs-exit:hover {
        background: rgba(255, 255, 255, 0.05);
      }
      .gs-dots {
        display: inline-flex;
        gap: 7px;
      }
      .gs-dot {
        position: relative;
        width: 13px;
        height: 13px;
        border-radius: 50%;
      }
      .gs-dot.red { background: #ff5f57; }
      .gs-dot.amber { background: #febc2e; }
      .gs-dot.green { background: #28c840; }
      /* a ← glyph fades into the red "close" dot on hover/focus */
      .gs-dot.red::after {
        content: '←';
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-size: 10px;
        font-weight: 700;
        color: rgba(0, 0, 0, 0.55);
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .gs-exit:hover .gs-dot.red::after,
      .gs-exit:focus-visible .gs-dot.red::after {
        opacity: 1;
      }
      .gs-exit-label {
        font-family: var(--font-mono, monospace);
        font-size: 0.74rem;
        letter-spacing: 0.06em;
        text-transform: lowercase;
        color: var(--pg-text-faint, #6f6f8a);
        transition: color 0.2s ease;
      }
      .gs-exit:hover .gs-exit-label,
      .gs-exit:focus-visible .gs-exit-label {
        color: var(--pg-text, #f4f4fb);
      }
      .gs-exit:hover .gs-exit-label::before {
        content: '← ';
      }

      /* ---- center: window title ---- */
      .gs-title {
        justify-self: center;
        margin: 0;
        max-width: 52vw;
        font-family: var(--font-display, sans-serif);
        font-weight: 600;
        font-size: clamp(0.95rem, 0.85rem + 0.5vw, 1.3rem);
        line-height: 1;
        letter-spacing: 0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--pg-text, #f4f4fb);
        opacity: 0.92;
      }

      /* ---- right: window controls ---- */
      .gs-right {
        justify-self: end;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .gs-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .gs-ctl {
        flex: none;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        font-size: 0.9rem;
        line-height: 1;
        cursor: pointer;
        border-radius: 9px;
        color: #fff;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        transition: background 0.2s ease, transform 0.2s ease;
      }
      .gs-ctl:hover {
        background: rgba(255, 255, 255, 0.13);
        transform: translateY(-1px);
      }

      @media (max-width: 560px) {
        .gs-exit-label {
          display: none;
        }
        .gs-title {
          max-width: 42vw;
          font-size: 0.92rem;
        }
      }
    `,
  ],
})
export class GameShellComponent {
  @Input() title = '';

  private juice = inject(JuiceService);
  muted = signal(this.juice.muted);

  toggleMute(): void {
    this.muted.set(this.juice.toggleMute());
  }
}
