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
import { SafariStoreService, EggResult, DailyClaim } from '../../services/safari-store.service';
import { SafariEngine } from './safari-engine';
import { SafariShowcase } from './safari-showcase';
import {
  ANIMALS,
  ANIMAL_BY_ID,
  Animal,
  factFor,
  DAILY_REWARDS,
  DIFFICULTIES,
  EGGS,
  EggConfig,
  PLAYABLE_THEMES,
  RARITY,
  RARITY_ORDER,
  Rarity,
  STICKERS,
  Sticker,
  THEMES,
  TOTAL_ANIMALS,
  TOTAL_STICKERS,
  Theme,
  ThemeInfo,
  animalsForTheme,
} from './safari-data';

type Screen = 'home' | 'playing' | 'complete';
type Panel = 'none' | 'album' | 'parade' | 'eggs' | 'daily' | 'stats';

interface RunMatch {
  animal: Animal;
  isFirst: boolean;
}

interface LevelSummary {
  pairs: number;
  moves: number;
  durationSeconds: number;
  coins: number;
  baseCoins: number;
  bonusCoins: number;
  matches: RunMatch[];
  newAnimals: Animal[];
  stickers: Sticker[];
  theme: ThemeInfo;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-animal-safari-match',
  standalone: true,
  imports: [CommonModule, FormsModule, GameShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './animal-safari-match.component.html',
  styleUrl: './animal-safari-match.component.scss',
})
export class AnimalSafariMatchComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('paradeCanvas') paradeCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('albumCanvas') albumCanvasRef?: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);
  private juice = inject(JuiceService);
  private supabase = inject(SupabaseService);
  protected store = inject(SafariStoreService);

  // ---- static data for the template ----
  protected readonly themes = THEMES;
  protected readonly playableThemes = PLAYABLE_THEMES;
  protected readonly difficulties = DIFFICULTIES;
  protected readonly dailyRewards = DAILY_REWARDS;
  protected readonly eggs = EGGS;
  protected readonly rarity = RARITY;
  protected readonly rarityOrder = RARITY_ORDER;
  protected readonly allAnimals = ANIMALS;
  protected readonly allStickers = STICKERS;
  protected readonly totalAnimals = TOTAL_ANIMALS;
  protected readonly totalStickers = TOTAL_STICKERS;

  // ---- screen / panel state ----
  protected screen = signal<Screen>('home');
  protected panel = signal<Panel>('none');
  protected selectedTheme = signal<Theme>('savanna');
  protected selectedDifficulty = signal<number>(0);

  // ---- HUD (polled from the engine) ----
  protected hudMatched = signal(0);
  protected hudTotal = signal(0);
  protected hudMoves = signal(0);
  protected pairSlots = computed(() => Array.from({ length: this.hudTotal() }));

  // ---- results ----
  protected summary = signal<LevelSummary | null>(null);
  protected toasts = signal<Toast[]>([]);

  // ---- album ----
  protected albumTab = signal<'animals' | 'stickers'>('animals');
  protected albumFilter = signal<Theme | 'all'>('all');
  protected albumSelected = signal<Animal | null>(null);
  protected factFor = factFor;

  // ---- eggs ----
  protected eggOpening = signal(false);
  protected openingEggId = signal<EggConfig['id'] | null>(null);
  protected eggResult = signal<EggResult | null>(null);

  // ---- daily ----
  protected dailyResult = signal<DailyClaim | null>(null);
  protected dailyInfo = computed(() => this.store.dailyStatus());

  // ---- community ----
  private communityTotals = signal<Record<string, number>>({});
  protected communityLoaded = signal(false);
  protected communityList = computed(() =>
    Object.entries(this.communityTotals())
      .map(([id, total]) => ({ animal: ANIMAL_BY_ID[id], total }))
      .filter(x => !!x.animal)
      .sort((a, b) => b.total - a.total),
  );
  protected communityTotalAll = computed(() =>
    this.communityList().reduce((s, x) => s + x.total, 0),
  );

  // derived
  protected unlockedThemes = computed(() => this.store.unlockedThemes());
  protected albumAnimals = computed(() => {
    const f = this.albumFilter();
    return f === 'all' ? ANIMALS : ANIMALS.filter(a => a.theme === f);
  });
  protected nameDraft = signal('');
  /** Two-way bridge for the name <input> (signals don't bind to [(ngModel)] directly). */
  protected get nameDraftModel(): string {
    return this.nameDraft();
  }
  protected set nameDraftModel(v: string) {
    this.nameDraft.set(v);
  }

  private engine?: SafariEngine;
  private resizeObs?: ResizeObserver;
  private sync?: ReturnType<typeof setInterval>;
  private eggTimer?: ReturnType<typeof setTimeout>;
  private toastId = 0;
  private runMatches: RunMatch[] = [];
  private onVisible = (): void => this.handleVisibility();

  // mini 3D viewers for the parade + album detail
  private paradeShow?: SafariShowcase;
  private paradeRO?: ResizeObserver;
  private albumShow?: SafariShowcase;
  private albumRO?: ResizeObserver;

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  // =============================================================== lifecycle
  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.nameDraft.set(this.store.playerName());
    const canvas = this.canvasRef.nativeElement;

    // Three.js runs OUTSIDE Angular's zone — the render loop never trips CD.
    this.zone.runOutsideAngular(() => {
      this.engine = new SafariEngine(canvas, {
        onReveal: info => this.onReveal(info),
        onPair: info => this.onPair(info),
        onComplete: summary => this.zone.run(() => this.finishLevel(summary)),
      });
      this.resizeObs = new ResizeObserver(() => this.engine?.resize());
      this.resizeObs.observe(canvas);
      this.engine.idle();
    });

    document.addEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy(): void {
    this.stopSync();
    if (this.eggTimer) clearTimeout(this.eggTimer);
    this.resizeObs?.disconnect();
    if (this.isBrowser) document.removeEventListener('visibilitychange', this.onVisible);
    this.teardownParadeView();
    this.teardownAlbumView();
    this.engine?.dispose();
    this.engine = undefined;
  }

  // ================================================================ game flow
  protected pickTheme(theme: Theme): void {
    if (!this.store.isThemeUnlocked(theme)) {
      const info = THEMES.find(t => t.id === theme);
      this.toast(`Clear ${info?.unlockAfterLevels} levels to unlock ${info?.label}!`, 'info');
      this.juice.blip(180, { type: 'sine', duration: 0.12, gain: 0.03 });
      return;
    }
    this.selectedTheme.set(theme);
    this.juice.blip(560, { type: 'triangle', duration: 0.08, gain: 0.04 });
    // live-preview the world behind the home screen
    this.zone.runOutsideAngular(() => this.engine?.previewTheme(theme));
  }

  protected pickDifficulty(index: number): void {
    this.selectedDifficulty.set(index);
    this.juice.blip(620, { type: 'triangle', duration: 0.08, gain: 0.04 });
  }

  protected startGame(): void {
    if (!this.engine) return;
    const theme = this.selectedTheme();
    const diff = this.difficulties[this.selectedDifficulty()];
    const deck = this.buildDeck(theme, diff.pairs);

    this.runMatches = [];
    this.hudMatched.set(0);
    this.hudTotal.set(diff.pairs);
    this.hudMoves.set(0);
    this.summary.set(null);
    this.panel.set('none');
    this.screen.set('playing');

    this.juice.blip(660, { type: 'triangle', duration: 0.12, gain: 0.05 });
    this.zone.runOutsideAngular(() => this.engine!.start({ theme, deck }));
    this.startSync();
  }

  protected playAgain(): void {
    this.startGame();
  }

  protected quitToHome(): void {
    this.stopSync();
    this.zone.runOutsideAngular(() => this.engine?.clearBoard());
    this.screen.set('home');
  }

  protected backToHome(): void {
    this.summary.set(null);
    this.zone.runOutsideAngular(() => this.engine?.clearBoard());
    this.screen.set('home');
  }

  private buildDeck(theme: Theme, pairs: number): Animal[] {
    const pool = this.shuffle(animalsForTheme(theme)).slice(0, pairs);
    return this.shuffle(pool.flatMap(a => [a, a]));
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ============================================================ engine events
  // (these fire outside Angular's zone — keep them to juice + store writes)
  private onReveal(info: { animalId: string; rarity: Rarity; x: number; y: number }): void {
    const animal = ANIMAL_BY_ID[info.animalId];
    this.playAnimalVoice(animal);
    this.juice.burst(info.x, info.y, {
      count: 10,
      power: 5,
      colors: [RARITY[info.rarity].color, RARITY[info.rarity].glow, '#ffffff'],
    });
  }

  private onPair(info: {
    matched: boolean;
    animalId: string;
    otherId: string;
    rarity: Rarity;
    x: number;
    y: number;
  }): void {
    if (info.matched) {
      const isFirst = this.store.recordMatch(info.animalId);
      this.runMatches.push({ animal: ANIMAL_BY_ID[info.animalId], isFirst });

      const info2 = RARITY[info.rarity];
      this.juice.burst(info.x, info.y, {
        count: 26,
        power: 9,
        colors: [info2.color, info2.glow, '#ffffff', '#ffe14a'],
      });
      [523, 659, 784].forEach((f, i) =>
        setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.12, gain: 0.05 }), i * 70),
      );
      if (isFirst) this.juice.confetti(28);
      this.shakeStage(5, 240);
    } else {
      // no penalty — a soft, friendly "try again" cue
      this.juice.blip(300, { type: 'sine', duration: 0.14, gain: 0.03 });
      this.juice.burst(info.x, info.y, { count: 8, power: 4, colors: ['#cdd3e6', '#aab0c8'], gravity: 0.3 });
    }
  }

  private playAnimalVoice(animal: Animal | undefined): void {
    if (!animal) return;
    const base = 280 + (this.hashStr(animal.id) % 360);
    this.juice.blip(base, { type: 'triangle', duration: 0.13, gain: 0.05 });
    setTimeout(() => this.juice.blip(base * 1.5, { type: 'sine', duration: 0.11, gain: 0.04 }), 95);
  }

  private hashStr(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // ============================================================ level complete
  private finishLevel(engineSummary: { pairs: number; moves: number; durationSeconds: number }): void {
    this.stopSync();
    const diff = this.difficulties[this.selectedDifficulty()];
    const theme = THEMES.find(t => t.id === this.selectedTheme()) ?? THEMES[0];

    const newAnimals = this.runMatches.filter(m => m.isFirst).map(m => m.animal);
    const bonus = newAnimals.reduce((s, a) => s + RARITY[a.rarity].discoverBonus, 0);
    const base = diff.coins;
    const coins = base + bonus;

    // one sticker per cleared board, biased toward the animals just matched
    const sticker = this.store.grantRandomSticker(this.runMatches.map(m => m.animal.id));
    const stickers = sticker ? [sticker] : [];

    this.store.addCoins(coins);
    this.store.registerLevelCleared();

    this.summary.set({
      pairs: engineSummary.pairs,
      moves: engineSummary.moves,
      durationSeconds: engineSummary.durationSeconds,
      coins,
      baseCoins: base,
      bonusCoins: bonus,
      matches: this.runMatches,
      newAnimals,
      stickers,
      theme,
    });
    this.screen.set('complete');

    // celebration
    this.juice.confetti(130);
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.2, gain: 0.05 }), i * 110),
    );

    this.persistRun(engineSummary, coins);
  }

  private async persistRun(
    engineSummary: { pairs: number; moves: number; durationSeconds: number },
    coins: number,
  ): Promise<void> {
    const name = this.store.playerName();
    try {
      await this.supabase.insertSafariSession({
        playerName: name,
        theme: this.selectedTheme(),
        pairs: engineSummary.pairs,
        moves: engineSummary.moves,
        durationSeconds: engineSummary.durationSeconds,
        animalsFound: this.runMatches.length,
        coinsEarned: coins,
      });
      await this.supabase.recordSafariDiscoveries(
        name,
        this.runMatches.map(m => ({ animalId: m.animal.id, rarity: m.animal.rarity, isFirst: m.isFirst })),
      );
    } catch {
      /* offline / blocked — local progress already saved */
    }
  }

  // ================================================================== panels
  protected openPanel(p: Panel): void {
    this.panel.set(p);
    this.juice.blip(520, { type: 'triangle', duration: 0.07, gain: 0.04 });
    if (p === 'stats' && !this.communityLoaded()) this.loadCommunity();
    if (p === 'eggs') {
      this.eggResult.set(null);
      this.eggOpening.set(false);
    }
    if (p === 'daily') this.dailyResult.set(null);
    if (p === 'album') this.albumSelected.set(null);
    if (p === 'parade') this.scheduleParadeView();
  }

  protected closePanel(): void {
    this.panel.set('none');
    this.albumSelected.set(null);
    this.teardownParadeView();
    this.teardownAlbumView();
  }

  protected setAlbumFilter(f: Theme | 'all'): void {
    this.albumFilter.set(f);
  }

  // ----- album detail (3D model + fun fact) -----
  protected selectAlbumAnimal(a: Animal): void {
    if (!this.store.hasAnimal(a.id)) return;
    this.albumSelected.set(a);
    this.juice.blip(620, { type: 'triangle', duration: 0.08, gain: 0.04 });
    // wait one tick for the canvas to render, then spin up the viewer
    setTimeout(() => {
      const cv = this.albumCanvasRef?.nativeElement;
      if (!cv || this.albumSelected()?.id !== a.id) return;
      this.zone.runOutsideAngular(() => {
        this.albumShow ??= new SafariShowcase(cv);
        this.albumShow.setSingle(a.model);
        if (!this.albumRO) {
          this.albumRO = new ResizeObserver(() => this.albumShow?.resize());
          this.albumRO.observe(cv);
        }
        this.albumShow.resize();
      });
    }, 0);
  }

  protected backToAlbumGrid(): void {
    this.albumSelected.set(null);
    this.teardownAlbumView();
  }

  private teardownAlbumView(): void {
    this.albumRO?.disconnect();
    this.albumRO = undefined;
    this.albumShow?.dispose();
    this.albumShow = undefined;
  }

  // ----- parade (walking line of models) -----
  private scheduleParadeView(): void {
    const models = this.store.parade().map(a => a.model);
    if (!models.length) return;
    setTimeout(() => {
      const cv = this.paradeCanvasRef?.nativeElement;
      if (!cv || this.panel() !== 'parade') return;
      this.zone.runOutsideAngular(() => {
        this.paradeShow ??= new SafariShowcase(cv);
        this.paradeShow.setParade(models);
        if (!this.paradeRO) {
          this.paradeRO = new ResizeObserver(() => this.paradeShow?.resize());
          this.paradeRO.observe(cv);
        }
        this.paradeShow.resize();
      });
    }, 0);
  }

  private teardownParadeView(): void {
    this.paradeRO?.disconnect();
    this.paradeRO = undefined;
    this.paradeShow?.dispose();
    this.paradeShow = undefined;
  }

  // ==================================================================== eggs
  protected openEgg(eggId: EggConfig['id']): void {
    if (this.eggOpening()) return;
    if (!this.store.canAfford(eggId)) {
      this.toast('Not enough coins yet — play a level!', 'error');
      this.juice.blip(160, { type: 'sawtooth', duration: 0.18, gain: 0.04 });
      return;
    }
    this.eggResult.set(null);
    this.openingEggId.set(eggId);
    this.eggOpening.set(true);
    this.juice.blip(440, { type: 'triangle', duration: 0.1, gain: 0.04 });
    [0, 200, 400, 600].forEach(d =>
      setTimeout(() => this.juice.blip(360 + d, { type: 'sine', duration: 0.06, gain: 0.03 }), d),
    );

    this.eggTimer = setTimeout(() => {
      const res = this.store.openEgg(eggId);
      this.eggOpening.set(false);
      this.openingEggId.set(null);
      this.eggResult.set(res);
      if (res) {
        const big = res.animal.rarity === 'epic' || res.animal.rarity === 'legendary';
        this.juice.confetti(big ? 120 : 60);
        const notes = big ? [523, 659, 784, 1047, 1318] : [523, 659, 784];
        notes.forEach((f, i) =>
          setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.16, gain: 0.05 }), i * 90),
        );
      }
    }, 1100);
  }

  // =================================================================== daily
  protected claimDaily(): void {
    const status = this.dailyInfo();
    if (!status.claimable) return;
    const claim = this.store.claimDaily();
    if (!claim) return;
    this.dailyResult.set(claim);
    this.juice.confetti(70);
    [659, 784, 988].forEach((f, i) =>
      setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.16, gain: 0.05 }), i * 90),
    );
  }

  // =============================================================== community
  private async loadCommunity(): Promise<void> {
    try {
      const totals = await this.supabase.getSafariCommunityTotals();
      const map: Record<string, number> = {};
      for (const t of totals ?? []) map[t.animal_id] = Number(t.total_found) || 0;
      this.communityTotals.set(map);
    } catch {
      /* leaderboard is best-effort */
    } finally {
      this.communityLoaded.set(true);
    }
  }

  // ============================================================ name + reset
  protected saveName(): void {
    this.store.setPlayerName(this.nameDraft());
    this.nameDraft.set(this.store.playerName());
    this.toast('Name saved!', 'success');
    this.juice.blip(620, { type: 'triangle', duration: 0.08, gain: 0.04 });
  }

  protected resetProgress(): void {
    if (this.isBrowser && !window.confirm('Reset ALL Safari progress? This cannot be undone.')) return;
    this.store.resetAll();
    this.nameDraft.set(this.store.playerName());
    this.communityLoaded.set(false);
    this.toast('Progress reset.', 'info');
  }

  // ============================================================ HUD polling
  private startSync(): void {
    this.stopSync();
    this.sync = setInterval(() => this.pull(), 120);
  }
  private stopSync(): void {
    if (this.sync) clearInterval(this.sync);
    this.sync = undefined;
  }
  private pull(): void {
    const e = this.engine;
    if (!e) return;
    const s = e.snapshot();
    this.hudMatched.set(s.matched);
    this.hudTotal.set(s.total);
    this.hudMoves.set(s.moves);
  }

  // ============================================================== helpers
  protected themeInfo(id: Theme): ThemeInfo | undefined {
    return THEMES.find(t => t.id === id);
  }
  protected difficultyLabel(): string {
    return this.difficulties[this.selectedDifficulty()].label;
  }
  protected formatDate(iso: string | undefined): string {
    if (!iso) return '';
    return iso.slice(0, 10);
  }
  protected durationLabel(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }
  /** Naive pluralisation good enough for the community headline. */
  protected pluralName(name: string): string {
    return /[sxz]$/i.test(name) ? `${name}es` : `${name}s`;
  }

  private shakeStage(strength: number, duration: number): void {
    if (!this.isBrowser) return;
    this.juice.shake(document.querySelector('.asm-stage'), strength, duration);
  }

  private toast(message: string, type: Toast['type']): void {
    const t: Toast = { id: this.toastId++, message, type };
    this.toasts.update(list => [...list, t].slice(-3));
    setTimeout(() => this.toasts.update(list => list.filter(x => x.id !== t.id)), 2200);
  }

  private handleVisibility(): void {
    if (!this.engine) return;
    if (document.hidden) {
      this.engine.suspend();
      if (this.screen() === 'playing') this.stopSync();
    } else {
      this.zone.runOutsideAngular(() => this.engine?.wake());
      if (this.screen() === 'playing') this.startSync();
    }
  }
}
