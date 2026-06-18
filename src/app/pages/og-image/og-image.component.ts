import { Component, ChangeDetectionStrategy } from '@angular/core';

/**
 * Open Graph image source. Renders a pixel-exact 1200×630 branded card at the
 * top-left of the page so it can be captured to a PNG:
 *
 *   - Manually: open /og-image, screenshot the card.
 *   - Headless: `npx puppeteer` / Playwright at viewport 1200×630, screenshot
 *     `#og-card`. (Snippet in NEXT-STEPS.md.)
 *
 * Save the result to `src/assets/photos/og-cover.png` and point index.html's
 * og:image / twitter:image at it.
 */
@Component({
  selector: 'app-og-image',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="og-stage">
      <div class="og-card" id="og-card">
        <div class="og-orb og-orb-1"></div>
        <div class="og-orb og-orb-2"></div>
        <div class="og-orb og-orb-3"></div>
        <div class="og-glow"></div>

        <div class="og-content">
          <p class="og-kicker"><span class="og-dot"></span> martinharyanto.netlify.app</p>
          <h1 class="og-name">Martin<br />Haryanto</h1>
          <p class="og-role">Software Developer — Frontend · Games · Motion</p>
          <div class="og-tags">
            <span>Angular</span>
            <span>TypeScript</span>
            <span>WebGL</span>
            <span>Creative Dev</span>
          </div>
        </div>

        <div class="og-badge">MH</div>
      </div>

      <p class="og-hint">
        1200 × 630 — capture <code>#og-card</code> for your Open Graph image (see NEXT-STEPS.md).
      </p>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .og-stage {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 18px;
        padding: 32px;
        background: #050509;
      }
      .og-card {
        position: relative;
        width: 1200px;
        height: 630px;
        flex: none;
        overflow: hidden;
        background:
          radial-gradient(120% 140% at 100% 0%, #1a0f3d 0%, transparent 55%),
          radial-gradient(120% 140% at 0% 100%, #07212b 0%, transparent 55%),
          #07070d;
        font-family: 'Clash Display', 'Space Grotesk', 'Poppins', system-ui, sans-serif;
        color: #f4f4fb;
      }
      .og-glow {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(40% 60% at 80% 30%, rgba(34, 211, 238, 0.22), transparent 60%),
          radial-gradient(45% 60% at 20% 80%, rgba(251, 113, 133, 0.18), transparent 60%);
      }
      .og-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(2px);
      }
      .og-orb-1 { width: 240px; height: 240px; top: -70px; right: 120px; background: radial-gradient(circle at 30% 30%, #22d3ee, #5b5bf5); opacity: 0.85; }
      .og-orb-2 { width: 130px; height: 130px; bottom: 40px; right: 320px; background: radial-gradient(circle at 30% 30%, #fb7185, #7c3aed); opacity: 0.8; }
      .og-orb-3 { width: 70px; height: 70px; top: 120px; right: 420px; background: radial-gradient(circle at 30% 30%, #c6f24e, #22d3ee); opacity: 0.9; }

      .og-content {
        position: absolute;
        left: 88px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 2;
      }
      .og-kicker {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        margin: 0 0 28px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 22px;
        letter-spacing: 0.06em;
        color: #a7a7c0;
      }
      .og-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #c6f24e;
        box-shadow: 0 0 16px #c6f24e;
      }
      .og-name {
        margin: 0;
        font-size: 150px;
        font-weight: 700;
        line-height: 0.92;
        letter-spacing: -0.03em;
        text-transform: uppercase;
        background: linear-gradient(115deg, #7c3aed 0%, #5b5bf5 28%, #22d3ee 60%, #fb7185 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .og-role {
        margin: 30px 0 0;
        font-size: 32px;
        font-weight: 500;
        color: #d6d6e6;
      }
      .og-tags {
        display: flex;
        gap: 12px;
        margin-top: 34px;
      }
      .og-tags span {
        padding: 10px 20px;
        border-radius: 100px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 20px;
        color: #f4f4fb;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.14);
      }
      .og-badge {
        position: absolute;
        right: 88px;
        bottom: 72px;
        width: 96px;
        height: 96px;
        display: grid;
        place-items: center;
        border-radius: 24px;
        font-size: 40px;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(135deg, #7c3aed, #22d3ee);
        box-shadow: 0 20px 50px -16px rgba(124, 58, 237, 0.8);
        z-index: 2;
      }
      .og-hint {
        margin: 0;
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        color: #6f6f8a;
      }
      .og-hint code {
        color: #22d3ee;
      }
    `,
  ],
})
export class OgImageComponent {}
