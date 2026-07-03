import { Component, Input, ChangeDetectionStrategy, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Bubble Reef's chunky in-game icon set — small hand-drawn SVGs (filled,
 * `currentColor`) so the UI needs no emoji and inherits text color. Usage:
 *   <br-icon name="star" />
 */
const ICONS: Record<string, string> = {
  // a glossy bubble
  bubble: `<circle cx="12" cy="12" r="8.5" fill="currentColor" opacity=".28"/>
    <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/>
    <ellipse cx="9" cy="8.6" rx="2.4" ry="1.5" fill="currentColor" transform="rotate(-28 9 8.6)"/>`,
  // simple side-view fish
  fish: `<ellipse cx="10.5" cy="12" rx="7" ry="4.6" fill="currentColor"/>
    <path d="M16.5 12 L22 7.5 L20.5 12 L22 16.5 Z" fill="currentColor"/>
    <circle cx="6.8" cy="10.8" r="1.25" fill="#fff"/>`,
  // five-point rounded star
  star: `<path d="M12 2.6l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 16.9l-5.6 2.9 1.1-6.2L2.9 9.2l6.3-.9z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  // four-point sparkle
  sparkle: `<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor"/>`,
  trophy: `<path d="M7 3h10v2h4v3c0 2.6-2 4.7-4.5 5-1 1.7-2.5 2.8-3.5 3v2h3.5v3h-9v-3H11v-2c-1-.2-2.5-1.3-3.5-3C5 12.7 3 10.6 3 8V5h4V3zm-2 4v1c0 1.3.8 2.4 2 2.8V7H5zm14 0h-2v3.8c1.2-.4 2-1.5 2-2.8V7z" fill="currentColor"/>`,
  clock: `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/>
    <path d="M12 6.5V12l3.6 2.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`,
  heart: `<path d="M12 20.5S3.5 15.2 3.5 9.4C3.5 6.4 5.9 4 8.9 4c1.8 0 3.1 1.1 3.1 1.1S13.3 4 15.1 4c3 0 5.4 2.4 5.4 5.4 0 5.8-8.5 11.1-8.5 11.1z" fill="currentColor"/>`,
  music: `<path d="M9 4l11-2v13.1a3.2 3.2 0 1 1-2-3V6.3l-7 1.3v9.6a3.2 3.2 0 1 1-2-3z" fill="currentColor"/>`,
  musicOff: `<path d="M9 4l11-2v13.1a3.2 3.2 0 1 1-2-3V6.3l-7 1.3v9.6a3.2 3.2 0 1 1-2-3z" fill="currentColor" opacity=".45"/>
    <path d="M4 4l16 16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`,
  home: `<path d="M12 3.2 2.8 11h2.6v9h5.2v-5.6h2.8V20h5.2v-9h2.6z" fill="currentColor"/>`,
  book: `<path d="M4 4.5C4 3.7 4.7 3 5.5 3H11v16H5.5C4.7 19 4 18.3 4 17.5v-13zM13 3h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H13V3z" fill="currentColor"/>
    <path d="M4 20.5h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  question: `<path d="M12 3a6 6 0 0 1 6 6c0 2.4-1.5 3.6-2.7 4.5-1 .8-1.8 1.4-1.8 2.5h-3c0-2.3 1.4-3.4 2.6-4.3 1-.8 1.9-1.4 1.9-2.7a3 3 0 1 0-6 0H6a6 6 0 0 1 6-6z" fill="currentColor"/>
    <circle cx="12" cy="20" r="1.7" fill="currentColor"/>`,
  chain: `<path d="M10.6 13.4a4 4 0 0 1 0-5.6l3-3a4 4 0 1 1 5.6 5.6l-1.7 1.7a5.9 5.9 0 0 0-.7-2.1l1-1a2 2 0 1 0-2.8-2.8l-3 3a2 2 0 0 0 0 2.8z" fill="currentColor"/>
    <path d="M13.4 10.6a4 4 0 0 1 0 5.6l-3 3a4 4 0 1 1-5.6-5.6l1.7-1.7c.1.7.3 1.5.7 2.1l-1 1a2 2 0 1 0 2.8 2.8l3-3a2 2 0 0 0 0-2.8z" fill="currentColor"/>`,
  replay: `<path d="M12 5V1.8L7.5 5.4 12 9V6.5a5.5 5.5 0 1 1-5.5 5.5H4A8 8 0 1 0 12 5z" fill="currentColor" stroke="currentColor" stroke-width=".8"/>`,
  play: `<path d="M7.5 4.5 19 12 7.5 19.5z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`,
  check: `<path d="M4.5 12.5 10 18 19.5 6.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  wave: `<path d="M2 14c2.5 0 2.5-2.5 5-2.5S9.5 14 12 14s2.5-2.5 5-2.5S19.5 14 22 14v3.5c-2.5 0-2.5-2.5-5-2.5s-2.5 2.5-5 2.5-2.5-2.5-5-2.5-2.5 2.5-5 2.5z" fill="currentColor"/>
    <path d="M2 8c2.5 0 2.5-2.5 5-2.5S9.5 8 12 8s2.5-2.5 5-2.5S19.5 8 22 8v2c-2.5 0-2.5-2.5-5-2.5S14.5 10 12 10 9.5 7.5 7 7.5 4.5 10 2 10z" fill="currentColor" opacity=".55"/>`,
  medal: `<circle cx="12" cy="14.5" r="6" fill="currentColor"/>
    <circle cx="12" cy="14.5" r="3.4" fill="#fff" opacity=".35"/>
    <path d="M8 2h3l1.4 5.2L8.8 8.5zM16 2h-3l-1.4 5.2 3.6 1.3z" fill="currentColor" opacity=".75"/>`,
  rainbow: `<path d="M12 6a10 10 0 0 1 10 10h-3a7 7 0 0 0-14 0H2A10 10 0 0 1 12 6z" fill="currentColor"/>
    <path d="M12 11a5 5 0 0 1 5 5h-3a2 2 0 0 0-4 0H7a5 5 0 0 1 5-5z" fill="currentColor" opacity=".55"/>`,
};

@Component({
  selector: 'br-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 24 24" aria-hidden="true" [innerHTML]="svg"></svg>`,
  styles: [
    `
      :host {
        display: inline-flex;
        width: 1em;
        height: 1em;
        vertical-align: -0.12em;
      }
      svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class BrIconComponent {
  private sanitizer = inject(DomSanitizer);
  protected svg: SafeHtml = '';

  @Input({ required: true }) set name(value: string) {
    this.svg = this.sanitizer.bypassSecurityTrustHtml(ICONS[value] ?? '');
  }
}
