import {
  Component,
  AfterViewInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  NgZone,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { GameShellComponent } from '../../shared/game-shell/game-shell.component';
import { JuiceService } from '../../shared/juice/juice.service';
import { SupabaseService } from '../../services/supabase.service';
import { BubbleReefStore } from './bubble-reef-store.service';
import { BubbleReefEngine, PopEvent } from './bubble-reef-engine';
import { BrIconComponent } from './br-icon';
import { BrSpriteComponent } from './br-sprite';
import { loadCreatureSprites } from './sea-creatures';
import {
  BUBBLE_RUSH,
  COMBO_WINDOW_MS,
  FRIENDS,
  LITTLE_FINS,
  MUSIC_CREDIT,
  MUSIC_SRC,
  POINTS,
  RARITY,
  RARITY_ORDER,
  RESCUE_CHEERS,
  RUSH_DURATION,
  STAR_BONUS_SECONDS,
  SeaFriend,
  TOTAL_FRIENDS,
  comboMultiplier,
} from './bubble-reef-data';

type Screen = 'home' | 'playing' | 'rushEnd';
type Panel = 'none' | 'reef' | 'album' | 'board' | 'howto';
type Mode = 'fins' | 'rush';

interface RescueBanner {
  friend: SeaFriend;
  cheer: string;
  isNew: boolean;
}

interface SwimStyle {
  top: string;
  duration: string;
  delay: string;
  scale: number;
  reverse: boolean;
}

interface BRScore {
  player_name: string;
  score: number;
  bubbles_popped: number;
  friends_rescued: number;
  best_combo: number;
  created_at?: string;
}

const NAME_KEY = 'br_player_name';

/** Pentatonic pop scale — pops climb it as the combo grows. */
const POP_NOTES = [523, 587, 659, 784, 880, 1047, 1175];

@Component({
  selector: 'app-bubble-reef-game',
  standalone: true,
  imports: [CommonModule, FormsModule, GameShellComponent, BrIconComponent, BrSpriteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bubble-reef-game.component.html',
  styleUrl: './bubble-reef-game.component.scss',
})
export class BubbleReefGameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('field') fieldRef?: ElementRef<HTMLElement>;

  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);
  private juice = inject(JuiceService);
  private supabase = inject(SupabaseService);
  protected store = inject(BubbleReefStore);

  private engine = new BubbleReefEngine();
  /** The exact field element the engine is bound to — the @if around the
   *  playing screen recreates the div every session, so compare identity. */
  private attachedField: HTMLElement | null = null;

  // ---- static data for the template ----
  protected readonly allFriends = FRIENDS;
  protected readonly rarity = RARITY;
  protected readonly rarityOrder = RARITY_ORDER;
  protected readonly totalFriends = TOTAL_FRIENDS;
  protected readonly rushDuration = RUSH_DURATION;
  protected readonly musicCredit = MUSIC_CREDIT;

  // ---- screen state ----
  protected screen = signal<Screen>('home');
  protected panel = signal<Panel>('none');
  protected mode = signal<Mode>('fins');

  // ---- session state ----
  protected pops = signal(0);
  protected rescues = signal<SeaFriend[]>([]);
  protected score = signal(0);
  protected combo = signal(0);
  protected bestCombo = signal(0);
  protected timeLeft = signal(RUSH_DURATION);
  protected banner = signal<RescueBanner | null>(null);
  protected comboMult = computed(() => comboMultiplier(this.combo()));
  protected timePct = computed(() =>
    Math.max(0, Math.min(100, (this.timeLeft() / RUSH_DURATION) * 100)),
  );

  // ---- rush end / leaderboard ----
  protected playerName = signal('');
  protected isNewBest = signal(false);
  protected submitting = signal(false);
  protected submitted = signal(false);
  protected boardLoading = signal(false);
  protected boardScores = signal<BRScore[]>([]);

  // ---- reef panel ----
  protected cuddleFact = signal<{ friend: SeaFriend; text: string } | null>(null);

  // ---- baked 3D character sprites (id → PNG data-URL) ----
  protected sprites = signal<Map<string, string> | null>(null);
  private spritesLoading: Promise<Map<string, string>> | null = null;

  private lastPopAt = 0;
  private rushDeadline = 0;
  private rushTimer = 0;
  private bannerTimer = 0;
  private factTimer = 0;
  private audio: HTMLAudioElement | null = null;
  private swimStyles = new Map<string, SwimStyle>();

  // ------------------------------------------------------------- lifecycle
  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const saved = localStorage.getItem(NAME_KEY);
    if (saved) this.playerName.set(saved);
    this.loadBoard();
    this.ensureSprites();
  }

  /** Bake the 3D creatures to sprites (module-cached; instant on revisit). */
  private ensureSprites(): Promise<Map<string, string>> {
    if (!this.spritesLoading) {
      this.spritesLoading = this.zone.runOutsideAngular(() => loadCreatureSprites());
      this.spritesLoading.then(map => {
        this.zone.run(() => this.sprites.set(map));
        this.engine.setSprites(map);
      });
    }
    return this.spritesLoading;
  }

  protected spriteOf(id: string): string {
    return this.sprites()?.get(id) ?? '';
  }

  ngOnDestroy(): void {
    this.engine.destroy();
    this.stopRushTimer();
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    if (this.factTimer) clearTimeout(this.factTimer);
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
  }

  // ------------------------------------------------------------------ play
  protected startMode(mode: Mode): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.mode.set(mode);
    this.screen.set('playing');
    this.panel.set('none');
    this.pops.set(0);
    this.rescues.set([]);
    this.score.set(0);
    this.combo.set(0);
    this.bestCombo.set(0);
    this.submitted.set(false);
    this.isNewBest.set(false);
    this.banner.set(null);
    this.lastPopAt = 0;

    this.startMusic();
    this.juice.blip(660, { type: 'sine', duration: 0.12, gain: 0.05 });

    // The play-field renders on the next tick; attach + start outside the zone.
    // Sprites bake first so friend bubbles always have a passenger visual.
    setTimeout(async () => {
      await this.ensureSprites();
      const field = this.fieldRef?.nativeElement;
      if (!field || this.screen() !== 'playing') return;
      this.zone.runOutsideAngular(() => {
        if (this.attachedField !== field) {
          this.engine.destroy();
          this.engine.attach(field, {
            onPop: e => this.zone.run(() => this.handlePop(e)),
            onWaterTap: (x, y) => this.handleWaterTap(x, y),
          });
          this.attachedField = field;
        }
        this.engine.start(
          mode === 'fins' ? LITTLE_FINS : BUBBLE_RUSH,
          () => this.store.collectedIds(),
        );
      });
      if (mode === 'rush') this.startRushTimer();
    });
  }

  protected endRun(): void {
    this.engine.stop();
    this.stopRushTimer();
    if (this.mode() === 'rush') {
      this.finishRush();
    } else {
      this.screen.set('home');
      if (this.rescues().length) this.juice.confetti(50);
    }
  }

  private finishRush(): void {
    const score = this.score();
    this.isNewBest.set(this.store.recordRush(score));
    this.screen.set('rushEnd');
    if (this.isNewBest() && score > 0) {
      this.juice.confetti(110);
      this.playJingle([659, 784, 988, 1319]);
    }
  }

  // ------------------------------------------------------------------ pops
  private handlePop(e: PopEvent): void {
    const isRush = this.mode() === 'rush';
    this.pops.update(n => n + 1);
    this.store.addPops(1);

    // Combo bookkeeping (rush only, but track chain in fins for sound flavour).
    const now = performance.now();
    const chained = now - this.lastPopAt <= COMBO_WINDOW_MS;
    this.lastPopAt = now;

    if (e.kind === 'grump') {
      this.combo.set(0);
      this.juice.blip(140, { type: 'square', duration: 0.16, gain: 0.05 });
      this.juice.burst(e.clientX, e.clientY, {
        count: 10,
        colors: ['#5b5b7a', '#3c3c55', '#8a8ab0'],
        power: 5,
      });
      this.popupText(e.clientX, e.clientY, 'hmph!', '#c9c9e8');
      return;
    }

    const combo = (chained ? this.combo() : 0) + 1;
    this.combo.set(combo);
    if (combo > this.bestCombo()) this.bestCombo.set(combo);

    // Sound: pops climb a pentatonic scale with the chain.
    const note = POP_NOTES[Math.min(POP_NOTES.length - 1, Math.floor((combo - 1) / 2))];
    this.juice.blip(note, { type: 'triangle', duration: 0.08, gain: 0.045 });

    // Particles per kind.
    const burstColors =
      e.kind === 'golden'
        ? ['#ffd166', '#ffe8a3', '#fff6d8']
        : e.kind === 'rainbow'
          ? ['#ff8fa3', '#ffd166', '#7ce8b5', '#8fd8f2', '#c9a6ff']
          : ['#ffffff', '#bdeeff', '#8fd8f2'];
    this.juice.burst(e.clientX, e.clientY, {
      count: e.kind === 'normal' ? 12 : 22,
      colors: burstColors,
      power: e.kind === 'rainbow' ? 9 : 6,
      gravity: 0.12,
    });

    if (isRush) {
      const gained = POINTS[e.kind] * this.comboMult();
      this.score.update(s => s + gained);
      this.popupText(e.clientX, e.clientY, `+${gained}`, '#ffffff');
      if (e.kind === 'star') {
        this.rushDeadline += STAR_BONUS_SECONDS * 1000;
        this.popupText(e.clientX, e.clientY - 34, `+${STAR_BONUS_SECONDS}s`, '#ffd166');
        this.juice.blip(988, { type: 'sine', duration: 0.14, gain: 0.05 });
      }
    }

    if (e.kind === 'rainbow') this.juice.confetti(45);

    if (e.kind === 'friend' && e.friend) this.rescueFriend(e.friend, e.clientX, e.clientY);
  }

  private rescueFriend(friend: SeaFriend, x: number, y: number): void {
    const isNew = this.store.rescue(friend.id);
    this.rescues.update(list => [...list, friend]);
    const cheer = RESCUE_CHEERS[(Math.random() * RESCUE_CHEERS.length) | 0];
    this.banner.set({ friend, cheer, isNew });
    if (this.bannerTimer) clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => {
      this.zone.run(() => this.banner.set(null));
    }, 2400);

    this.juice.burst(x, y, {
      count: 26,
      colors: [RARITY[friend.rarity].color, '#ffffff', '#ffd1e3'],
      power: 8,
    });
    if (isNew) {
      this.playJingle(friend.rarity === 'legendary' ? [523, 659, 784, 1047, 1319] : [659, 831, 988]);
      if (friend.rarity === 'legendary' || friend.rarity === 'rare') this.juice.confetti(70);
    } else {
      this.playJingle([659, 784]);
    }
  }

  private handleWaterTap(x: number, y: number): void {
    // Little Fins: even a "missed" tap sparkles, so age 2 always gets feedback.
    if (this.mode() !== 'fins') return;
    this.juice.burst(x, y, {
      count: 6,
      colors: ['#dff6ff', '#ffffff'],
      power: 3,
      gravity: 0.05,
    });
    this.juice.blip(392 + Math.random() * 80, { type: 'sine', duration: 0.05, gain: 0.02 });
  }

  /** Floating "+N" text at the pop point (created outside Angular). */
  private popupText(x: number, y: number, text: string, color: string): void {
    const field = this.fieldRef?.nativeElement;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = 'br-popup';
    el.textContent = text;
    el.style.left = `${x - rect.left}px`;
    el.style.top = `${y - rect.top}px`;
    el.style.color = color;
    field.appendChild(el);
    window.setTimeout(() => el.remove(), 850);
  }

  // ----------------------------------------------------------------- timer
  private startRushTimer(): void {
    this.stopRushTimer();
    this.rushDeadline = performance.now() + RUSH_DURATION * 1000;
    this.timeLeft.set(RUSH_DURATION);
    this.zone.runOutsideAngular(() => {
      this.rushTimer = window.setInterval(() => {
        const left = Math.max(0, (this.rushDeadline - performance.now()) / 1000);
        this.zone.run(() => {
          this.timeLeft.set(left);
          // Zero the combo readout once the chain window lapses.
          if (this.combo() > 0 && performance.now() - this.lastPopAt > COMBO_WINDOW_MS) {
            this.combo.set(0);
          }
          if (left <= 0) this.endRun();
        });
      }, 200);
    });
  }

  private stopRushTimer(): void {
    if (this.rushTimer) clearInterval(this.rushTimer);
    this.rushTimer = 0;
  }

  // ------------------------------------------------------------------ reef
  protected swimStyle(friend: SeaFriend): SwimStyle {
    let s = this.swimStyles.get(friend.id);
    if (!s) {
      s = {
        top: `${8 + Math.random() * 70}%`,
        duration: `${14 + Math.random() * 18}s`,
        delay: `${-Math.random() * 20}s`,
        scale: 0.85 + Math.random() * 0.5,
        reverse: Math.random() < 0.5,
      };
      this.swimStyles.set(friend.id, s);
    }
    return s;
  }

  protected cuddle(friend: SeaFriend, ev: Event): void {
    this.store.cuddle(friend.id);
    const el = ev.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    this.juice.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, {
      count: 12,
      colors: ['#ff8fa3', '#ffd1e3', '#ffffff'],
      power: 4,
      gravity: -0.02,
    });
    this.juice.blip(784, { type: 'sine', duration: 0.1, gain: 0.04 });
    // WAAPI wiggle: composes with the CSS swim animation (which owns `left`),
    // so the friend shimmies in place without leaving its swim path.
    el.animate(
      [
        { rotate: '0deg' },
        { rotate: '-14deg' },
        { rotate: '12deg' },
        { rotate: '-8deg' },
        { rotate: '0deg' },
      ],
      { duration: 500, easing: 'ease-in-out' },
    );

    this.cuddleFact.set({ friend, text: friend.fact });
    if (this.factTimer) clearTimeout(this.factTimer);
    this.factTimer = window.setTimeout(() => {
      this.zone.run(() => this.cuddleFact.set(null));
    }, 3600);
  }

  // ----------------------------------------------------------------- panels
  protected openPanel(p: Panel): void {
    this.panel.set(this.panel() === p ? 'none' : p);
    this.cuddleFact.set(null);
    if (p === 'board') this.loadBoard();
    this.juice.blip(587, { type: 'sine', duration: 0.06, gain: 0.03 });
  }

  protected closePanel(): void {
    this.panel.set('none');
    this.cuddleFact.set(null);
  }

  // ------------------------------------------------------------ leaderboard
  protected async loadBoard(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.boardLoading.set(true);
    try {
      const data = await this.supabase.getBubbleReefHighScores(10);
      this.boardScores.set((data as BRScore[]) ?? []);
    } catch {
      this.boardScores.set([]);
    } finally {
      this.boardLoading.set(false);
    }
  }

  protected async submitScore(): Promise<void> {
    const name = this.playerName().trim();
    if (!name || this.submitting() || this.submitted()) return;
    this.submitting.set(true);
    try {
      localStorage.setItem(NAME_KEY, name);
      await this.supabase.insertBubbleReefScore({
        playerName: name,
        score: this.score(),
        bubblesPopped: this.pops(),
        friendsRescued: this.rescues().length,
        bestCombo: this.bestCombo(),
      });
      this.submitted.set(true);
      this.juice.confetti(40);
      await this.loadBoard();
    } catch {
      /* board offline — score stays local */
    } finally {
      this.submitting.set(false);
    }
  }

  protected goHome(): void {
    this.engine.stop();
    this.stopRushTimer();
    this.screen.set('home');
    this.panel.set('none');
  }

  // ------------------------------------------------------------------ music
  protected musicOn = computed(() => this.store.musicOn());

  protected toggleMusic(): void {
    const next = !this.store.musicOn();
    this.store.setMusic(next);
    if (!next) {
      this.audio?.pause();
    } else if (this.screen() === 'playing') {
      this.startMusic();
    }
  }

  private startMusic(): void {
    if (!this.store.musicOn() || !isPlatformBrowser(this.platformId)) return;
    if (!this.audio) {
      this.audio = new Audio(MUSIC_SRC);
      this.audio.loop = true;
      this.audio.volume = 0.3;
    }
    // Called from a tap handler, so autoplay policies are satisfied.
    this.audio.play().catch(() => undefined);
  }

  private playJingle(notes: number[]): void {
    notes.forEach((freq, i) => {
      window.setTimeout(
        () => this.juice.blip(freq, { type: 'sine', duration: 0.12, gain: 0.045 }),
        i * 90,
      );
    });
  }

  // ------------------------------------------------------------------ misc
  protected friendsByRarity(r: string): SeaFriend[] {
    return FRIENDS.filter(f => f.rarity === r);
  }

  protected trackFriend(_: number, f: SeaFriend): string {
    return f.id;
  }
}
