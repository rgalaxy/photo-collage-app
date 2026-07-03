import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ChangeDetectionStrategy,
  ElementRef,
  ViewChild,
  NgZone,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { GameShellComponent } from '../../shared/game-shell/game-shell.component';
import { JuiceService } from '../../shared/juice/juice.service';
import { ColorHideEngine } from './color-hide-engine';
import { ColorWheel } from './color-hide-wheel';
import { ColorHideStore } from './color-hide-store.service';
import { GEM_SKINS, getSkin, GemSkin } from './color-hide-cosmetics';
import {
  DAILY_CONFIG,
  DAILY_ROUNDS,
  dailyTargets,
  todayKey,
  gradeEmoji,
  starsFor,
  starString,
  buildShareText,
  DailyResult,
} from './color-hide-daily';
import {
  GameMode,
  Difficulty,
  Instrument,
  Channels,
  Grade,
  HSL,
  RGB,
  SeekBoard,
  DIFFICULTIES,
  DifficultyConfig,
  difficultyByKey,
  GAME_DURATION,
  GRADE_LABEL,
  GRADE_COLORS,
  ChannelDelta,
  MIX_CONFIG,
  PERFECT_THRESHOLD,
  COMBO_BREAK_BELOW,
  hslToRgb,
  rgbToHsl,
  hslCss,
  hslDeltaE,
  accuracyFromDelta,
  gradeForAccuracy,
  mixPoints,
  seekPoints,
  chainMultiplier,
  channelDeltas,
  encouragement,
  coachingTip,
  randomTarget,
  makeSeekBoard,
  roundHsl,
  clamp,
} from './color-hide-data';

interface CHScore {
  player_name: string;
  score: number;
  mode: string;
  difficulty: string;
  perfect_matches: number;
  attempts: number;
  best_combo: number;
  avg_accuracy: number;
  created_at?: string;
}

interface RunSummary {
  score: number;
  mode: GameMode;
  difficulty: Difficulty;
  perfectMatches: number;
  attempts: number;
  bestCombo: number;
  avgAccuracy: number;
}

interface SeekTile {
  index: number;
  hsl: HSL;
  css: string;
}

const NAME_KEY = 'ch_player_name';
const BEST_KEY = 'ch_best_score';
const INSTR_KEY = 'ch_instrument';
const CHAN_KEY = 'ch_channels';
const MODE_KEY = 'ch_last_mode';
const DIFF_KEY = 'ch_last_difficulty';

@Component({
  selector: 'app-color-hide-game',
  standalone: true,
  imports: [CommonModule, FormsModule, GameShellComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './color-hide-game.component.html',
  styleUrl: './color-hide-game.component.scss',
})
export class ColorHideGameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);
  private supabase = inject(SupabaseService);
  private juice = inject(JuiceService);
  private store = inject(ColorHideStore);

  // ---- catalog / settings ----
  readonly difficulties = DIFFICULTIES;
  readonly skins = GEM_SKINS;
  readonly DAILY_ROUNDS = DAILY_ROUNDS;
  readonly perfectThreshold = PERFECT_THRESHOLD;
  readonly comboBreakBelow = COMBO_BREAK_BELOW;
  screen: 'intro' | 'playing' | 'over' = 'intro';
  runKind: 'arcade' | 'daily' = 'arcade';
  mode: GameMode = 'mix';
  difficultyKey: Difficulty = 'easy';
  instrument: Instrument = 'wheel';
  channels: Channels = 'hsl';
  playerName = '';
  showHowTo = false;
  showCollection = false;

  // ---- teaching ----
  lastDelta: ChannelDelta = { dh: 0, ds: 0, dl: 0 };
  lastMsg = '';
  private roundResults: { accuracy: number; grade: Grade; delta: ChannelDelta }[] = [];
  report: { hue: number; sat: number; light: number; tip: string; best: number } | null = null;

  // ---- daily ----
  private dailyList: HSL[] = [];
  dailyResult: DailyResult | null = null;
  private dailyPractice = false;
  sparklesEarned = 0;
  private skinPalette: string[] = ['#7c3aed', '#22d3ee', '#c6f24e', '#fb7185'];
  fxColor = '#c6f24e'; // Perfect-celebration colour (follows the equipped gem)

  // ---- run HUD ----
  score = 0;
  timeRemaining = GAME_DURATION;
  combo = 0; // combo (mix) / streak (seek)
  private bestCombo = 0;
  private attempts = 0;
  private perfectMatches = 0;
  private accSum = 0;

  // ---- mix round ----
  phase: 'reveal' | 'guess' | 'result' = 'reveal';
  target: HSL = { h: 0, s: 72, l: 56 };
  guess: HSL = { h: 200, s: 50, l: 56 };
  lastAccuracy = 0;
  lastGrade: Grade = 'off';

  // reveal countdown (memorise window)
  revealMsLeft = 0;
  private revealEndAt = 0;
  private revealTotalMs = 0;

  // ---- seek round ----
  seekTiles: SeekTile[] = [];
  seekBoardId = 0; // bumps each board so the tiles re-key + re-animate in
  private seekBoard?: SeekBoard;

  // ---- flashes / toasts ----
  gradeFlashes: { id: number; text: string; cls: Grade }[] = [];
  perfectFx: { id: number }[] = []; // non-intrusive Perfect celebration (ring + edge glow)
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' }[] = [];
  private flashId = 0;
  private pfId = 0;
  private toastId = 0;

  // ---- results / leaderboard ----
  summary: RunSummary | null = null;
  highScores: CHScore[] = [];
  bestScore = 0;
  submitting = false;

  // ---- engine / picker ----
  private engine?: ColorHideEngine;
  private wheel?: ColorWheel;
  private resizeObs?: ResizeObserver;
  private timer?: ReturnType<typeof setInterval>;
  private roundTimer?: ReturnType<typeof setTimeout>;
  private endAt = 0;
  private prevWhole = GAME_DURATION;
  private onVisible = (): void => this.handleVisibility();

  // the wheel canvas comes and goes with the instrument/mode → init on demand
  @ViewChild('wheelCanvas')
  set wheelCanvas(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (ref?.nativeElement) {
      if (!this.wheel) this.initWheel(ref.nativeElement);
    } else if (this.wheel) {
      this.wheel.dispose();
      this.wheel = undefined;
    }
  }

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  get cfg(): DifficultyConfig {
    return difficultyByKey(this.difficultyKey);
  }

  /** Leaderboard scope: Mix is a single board; Seek is per-difficulty. */
  get boardDifficulty(): Difficulty {
    return this.mode === 'mix' ? 'medium' : this.difficultyKey;
  }

  // ---- store-backed views ----
  get sparkles(): number {
    return this.store.sparkles();
  }
  get dailyStreak(): number {
    return this.store.dailyStreak();
  }
  get dailyDoneToday(): boolean {
    return this.store.dailyLastDate() === todayKey();
  }
  get lastDailyResult(): DailyResult | null {
    return this.store.dailyLast();
  }
  get dailyDots(): boolean[] {
    return Array.from({ length: DAILY_ROUNDS }, (_, i) => i < this.roundResults.length);
  }
  get dailyRoundNumber(): number {
    return Math.min(this.roundResults.length + 1, DAILY_ROUNDS);
  }
  owns(id: string): boolean {
    return this.store.owns(id);
  }
  isEquipped(id: string): boolean {
    return this.store.equipped() === id;
  }
  canAfford(cost: number): boolean {
    return this.store.sparkles() >= cost;
  }
  starStr(n: number): string {
    return starString(n);
  }

  // -------------------------------------------------------------- lifecycle
  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.playerName = localStorage.getItem(NAME_KEY) ?? '';
    this.bestScore = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
    this.instrument = (localStorage.getItem(INSTR_KEY) as Instrument) || 'wheel';
    this.channels = (localStorage.getItem(CHAN_KEY) as Channels) || 'hsl';
    this.mode = (localStorage.getItem(MODE_KEY) as GameMode) || 'mix';
    this.difficultyKey = (localStorage.getItem(DIFF_KEY) as Difficulty) || 'easy';
    this.loadLeaderboard();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    this.zone.runOutsideAngular(() => {
      this.engine = new ColorHideEngine(canvas);
      this.engine.idle();
      this.applySkin();
      // the intro is a menu — keep the gem out from behind the text
      this.engine.setGemVisible(false);
      this.resizeObs = new ResizeObserver(() => this.engine?.resize());
      this.resizeObs.observe(canvas);
    });
    document.addEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy(): void {
    this.stopTimers();
    this.resizeObs?.disconnect();
    if (this.isBrowser) document.removeEventListener('visibilitychange', this.onVisible);
    this.wheel?.dispose();
    this.wheel = undefined;
    this.engine?.dispose();
    this.engine = undefined;
  }

  // -------------------------------------------------------------- settings (intro)
  selectMode(m: GameMode): void {
    if (this.mode === m) return;
    this.mode = m;
    localStorage.setItem(MODE_KEY, m);
    this.juice.blip(520, { type: 'sine', duration: 0.05, gain: 0.03 });
    this.loadLeaderboard();
  }

  selectDifficulty(key: Difficulty): void {
    if (this.difficultyKey === key) return;
    this.difficultyKey = key;
    localStorage.setItem(DIFF_KEY, key);
    this.juice.blip(600, { type: 'sine', duration: 0.05, gain: 0.03 });
    this.loadLeaderboard();
  }

  selectInstrument(i: Instrument): void {
    this.instrument = i;
    localStorage.setItem(INSTR_KEY, i);
  }

  selectChannels(c: Channels): void {
    this.channels = c;
    localStorage.setItem(CHAN_KEY, c);
  }

  toggleHowTo(): void {
    this.showHowTo = !this.showHowTo;
  }

  // -------------------------------------------------------------- cosmetics
  private applySkin(): void {
    const skin = getSkin(this.store.equipped());
    this.skinPalette = skin.palette;
    this.fxColor = skin.accent;
    this.engine?.setSkin(skin);
  }

  openCollection(): void {
    this.showCollection = true;
    this.juice.blip(560, { type: 'sine', duration: 0.05, gain: 0.03 });
  }
  closeCollection(): void {
    this.showCollection = false;
  }

  /** Tap a gem: equip it if owned, otherwise buy it (if you have the Sparkles). */
  tapSkin(skin: GemSkin): void {
    if (this.store.owns(skin.id)) {
      this.store.equipSkin(skin.id);
      this.applySkin();
      this.juice.blip(660, { type: 'triangle', duration: 0.08, gain: 0.04 });
      return;
    }
    if (this.store.buySkin(skin.id, skin.cost)) {
      this.applySkin();
      this.juice.confetti(60);
      [660, 880, 1175].forEach((f, i) =>
        setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.12, gain: 0.05 }), i * 90),
      );
      this.toast(`Unlocked ${skin.name}! ${skin.emoji}`, 'success');
    } else {
      this.toast('Not enough Sparkles yet ✨', 'error');
      this.juice.blip(160, { type: 'sawtooth', duration: 0.12, gain: 0.04 });
    }
  }

  // -------------------------------------------------------------- daily challenge
  startDaily(practice = false): void {
    if (!this.engine) return;
    this.runKind = 'daily';
    this.dailyPractice = practice;
    this.showCollection = false;
    this.juice.blip(660, { type: 'triangle', duration: 0.12, gain: 0.05 });

    this.screen = 'playing';
    this.mode = 'mix';
    this.summary = null;
    this.dailyResult = null;
    this.report = null;
    this.sparklesEarned = 0;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.attempts = 0;
    this.perfectMatches = 0;
    this.accSum = 0;
    this.roundResults = [];
    this.gradeFlashes = [];
    this.dailyList = dailyTargets(todayKey());

    this.startTimer(); // interval drives the reveal countdown (no clock in daily)
    this.nextDailyRound();
  }

  private nextDailyRound(): void {
    if (this.roundResults.length >= DAILY_ROUNDS) {
      this.endDaily();
      return;
    }
    this.beginMixReveal(this.dailyList[this.roundResults.length], DAILY_CONFIG.revealMs);
  }

  private endDaily(): void {
    if (this.screen === 'over') return;
    this.stopTimers();
    this.screen = 'over';
    this.zone.runOutsideAngular(() => this.engine?.setGemVisible(false));

    const n = this.roundResults.length || 1;
    const avg = Math.round(this.accSum / n);
    const stars = starsFor(avg);
    const result: DailyResult = {
      date: todayKey(),
      score: this.score,
      stars,
      avgAccuracy: avg,
      perfect: this.perfectMatches,
      grid: this.roundResults.map(r => gradeEmoji(r.grade)).join(''),
    };
    this.dailyResult = result;
    this.computeReport();

    const firstToday = this.store.dailyLastDate() !== todayKey();
    if (!this.dailyPractice && firstToday) {
      this.store.recordDaily(result);
      this.sparklesEarned = Math.round(this.score / 40) + this.perfectMatches * 5 + 30;
      this.store.addSparkles(this.sparklesEarned);
    } else {
      this.sparklesEarned = 0;
    }

    this.juice.confetti(120);
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.2, gain: 0.05 }), i * 110),
    );
  }

  async shareDaily(): Promise<void> {
    const r = this.dailyResult ?? this.lastDailyResult;
    if (!r) return;
    const url = typeof location !== 'undefined' ? location.origin + '/color-hide-game' : '';
    const text = buildShareText(r, this.store.dailyStreak(), url);
    try {
      await navigator.clipboard.writeText(text);
      this.toast('Result copied — go share it! 📋', 'success');
    } catch {
      this.toast('Copy failed — select & copy manually', 'error');
    }
  }

  private computeReport(): void {
    const rr = this.roundResults;
    if (!rr.length) {
      this.report = null;
      return;
    }
    const avgAbs = (f: (d: ChannelDelta) => number): number =>
      Math.round(rr.reduce((s, r) => s + Math.abs(f(r.delta)), 0) / rr.length);
    this.report = {
      hue: avgAbs(d => d.dh),
      sat: avgAbs(d => d.ds),
      light: avgAbs(d => d.dl),
      tip: coachingTip(rr.map(r => r.delta)),
      best: Math.round(Math.max(...rr.map(r => r.accuracy))),
    };
  }

  // -------------------------------------------------------------- flow
  startGame(): void {
    if (!this.engine) return;
    const name = this.playerName.trim();
    if (!name) {
      this.toast('Enter your name first!', 'error');
      return;
    }
    localStorage.setItem(NAME_KEY, name);
    this.juice.blip(660, { type: 'triangle', duration: 0.12, gain: 0.05 });

    this.runKind = 'arcade';
    this.screen = 'playing';
    this.summary = null;
    this.report = null;
    this.sparklesEarned = 0;
    this.roundResults = [];
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.attempts = 0;
    this.perfectMatches = 0;
    this.accSum = 0;
    this.gradeFlashes = [];
    this.timeRemaining = GAME_DURATION;
    this.prevWhole = GAME_DURATION;

    this.startTimer();
    if (this.mode === 'mix') {
      // nextMixRound hides the gem for the reveal, then startGuess brings it back white
      this.nextMixRound();
    } else {
      // Seek renders no sphere — it's distracting behind the tile grid.
      this.zone.runOutsideAngular(() => this.engine?.setGemVisible(false));
      this.nextSeekRound();
    }
  }

  playAgain(): void {
    this.startGame();
  }

  quitToIntro(): void {
    this.stopTimers();
    this.zone.runOutsideAngular(() => this.engine?.setGemVisible(false));
    this.screen = 'intro';
    this.loadLeaderboard();
  }

  // -------------------------------------------------------------- timer
  private startTimer(): void {
    this.stopTimers();
    this.endAt = performance.now() + GAME_DURATION * 1000;
    this.timer = setInterval(() => this.tick(), 90);
  }

  private stopTimers(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.roundTimer = undefined;
  }

  private tick(): void {
    if (this.mode === 'mix' && this.phase === 'reveal') {
      this.revealMsLeft = Math.max(0, this.revealEndAt - performance.now());
    }
    if (this.runKind === 'daily') return; // Daily has no clock — it ends after 5 rounds
    const remaining = Math.max(0, (this.endAt - performance.now()) / 1000);
    this.timeRemaining = remaining;
    const whole = Math.ceil(remaining);
    if (whole !== this.prevWhole) {
      if (whole <= 10 && whole > 0) {
        this.juice.blip(700, { type: 'sine', duration: 0.05, gain: 0.03 });
      }
      this.prevWhole = whole;
    }
    if (remaining <= 0) this.endRun();
  }

  /** Whole seconds left in the memorise window (shown on the target). */
  get revealSeconds(): number {
    return Math.max(1, Math.ceil(this.revealMsLeft / 1000));
  }
  /** 1 → 0 across the memorise window (drives the shrinking bar). */
  get revealBar(): number {
    return this.revealTotalMs > 0 ? clamp(this.revealMsLeft / this.revealTotalMs, 0, 1) : 0;
  }

  get timeLabel(): string {
    return Math.ceil(Math.max(0, this.timeRemaining)).toString();
  }
  get timeProgress(): number {
    return clamp(this.timeRemaining / GAME_DURATION, 0, 1);
  }
  /** SVG ring dash offset (circumference ≈ 2π·52). */
  get ringOffset(): number {
    const circ = 2 * Math.PI * 52;
    return circ * (1 - this.timeProgress);
  }
  readonly ringCirc = 2 * Math.PI * 52;

  get comboLabel(): string {
    return this.mode === 'mix' ? 'Combo' : 'Streak';
  }
  get comboMult(): number {
    return chainMultiplier(this.combo);
  }

  // -------------------------------------------------------------- MIX
  private nextMixRound(): void {
    if (this.timeRemaining <= 0) return;
    // Mix has no difficulty tiers — it always uses MIX_CONFIG.
    this.beginMixReveal(randomTarget(MIX_CONFIG, Math.random), MIX_CONFIG.revealMs);
  }

  /** Shared reveal setup for both arcade and daily Mix rounds. */
  private beginMixReveal(target: HSL, revealMs: number): void {
    this.phase = 'reveal';
    this.target = target;
    // reset the guess to a neutral start (grey — the wheel stays readable) so each match is honest
    this.guess = { h: Math.random() * 360, s: 0, l: 60 };
    this.syncWheel();
    this.revealTotalMs = revealMs;
    this.revealMsLeft = revealMs;
    this.revealEndAt = performance.now() + revealMs;
    // hide the 3D gem during the reveal so the flat target swatch reads true
    this.zone.runOutsideAngular(() => this.engine?.setGemVisible(false));

    this.roundTimer = setTimeout(() => {
      this.phase = 'guess';
      // the gem returns as a white canvas; it mirrors the player's colour once they adjust a control
      this.zone.runOutsideAngular(() => this.engine?.startGuess());
    }, revealMs);
  }

  private advanceRound(): void {
    if (this.runKind === 'daily') this.nextDailyRound();
    else this.nextMixRound();
  }

  submitMatch(): void {
    if (this.phase !== 'guess') return;
    const de = hslDeltaE(this.guess, this.target);
    const acc = accuracyFromDelta(de);
    const grade = gradeForAccuracy(acc);
    const delta = channelDeltas(this.target, this.guess);
    const pts =
      this.runKind === 'daily'
        ? Math.round(acc * 10) + (grade === 'perfect' ? 25 : 0)
        : mixPoints(acc, this.combo, MIX_CONFIG.pointsMult);

    this.attempts++;
    this.accSum += acc;
    this.lastAccuracy = acc;
    this.lastGrade = grade;
    this.lastDelta = delta;
    this.lastMsg = encouragement(acc);
    this.roundResults.push({ accuracy: acc, grade, delta });
    this.score += pts;

    if (grade === 'perfect') this.perfectMatches++;
    // Combo is forgiving: only a poor match (< 50%) breaks it; anything decent builds it.
    if (acc < COMBO_BREAK_BELOW) this.combo = 0;
    else this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);

    this.phase = 'result';
    this.zone.runOutsideAngular(() => this.engine?.showResult(this.target, grade === 'perfect'));
    this.pushGrade(grade);
    this.gradeJuice(grade);
    if (grade === 'perfect') this.firePerfectFx();

    // linger longer in Daily (relaxed) so the teaching lands; snappier in the arcade clock
    const dwell = this.runKind === 'daily' ? 1700 : 1050;
    this.roundTimer = setTimeout(() => this.advanceRound(), dwell);
  }

  private syncWheel(): void {
    if (this.wheel) {
      this.wheel.setHS(this.guess.h, this.guess.s);
      this.wheel.setLightness(this.guess.l);
    }
  }

  private initWheel(el: HTMLCanvasElement): void {
    this.wheel = new ColorWheel(el, {
      lightness: this.guess.l,
      onChange: (h, s) => {
        this.zone.run(() => {
          this.guess = { ...this.guess, h, s };
          this.pushGuessToGem();
        });
      },
    });
    this.wheel.setHS(this.guess.h, this.guess.s);
  }

  onLightness(l: number): void {
    this.guess = { ...this.guess, l: Number(l) };
    this.wheel?.setLightness(this.guess.l);
    this.pushGuessToGem();
  }

  onHslBar(ch: 'h' | 's' | 'l', v: number): void {
    this.guess = { ...this.guess, [ch]: Number(v) };
    this.pushGuessToGem();
  }

  /** Mirror the player's current colour onto the 3D gem (guess phase only). */
  private pushGuessToGem(): void {
    if (this.mode === 'mix' && this.phase === 'guess') {
      this.zone.runOutsideAngular(() => this.engine?.setGuess(this.guess));
    }
  }

  // RGB bar bindings (derive from the HSL master)
  get rgb(): RGB {
    return hslToRgb(this.guess);
  }
  private setRgb(channel: 'r' | 'g' | 'b', value: number): void {
    const cur = hslToRgb(this.guess);
    cur[channel] = clamp(Math.round(Number(value)), 0, 255);
    this.guess = rgbToHsl(cur);
    this.syncWheel();
    this.pushGuessToGem();
  }
  get rgbR(): number {
    return hslToRgb(this.guess).r;
  }
  set rgbR(v: number) {
    this.setRgb('r', v);
  }
  get rgbG(): number {
    return hslToRgb(this.guess).g;
  }
  set rgbG(v: number) {
    this.setRgb('g', v);
  }
  get rgbB(): number {
    return hslToRgb(this.guess).b;
  }
  set rgbB(v: number) {
    this.setRgb('b', v);
  }

  // live slider-track gradients
  readonly hueTrack = 'linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)';
  get satTrack(): string {
    return `linear-gradient(90deg, hsl(${this.guess.h} 0% ${this.guess.l}%), hsl(${this.guess.h} 100% ${this.guess.l}%))`;
  }
  get lightTrack(): string {
    return `linear-gradient(90deg, #000, hsl(${this.guess.h} ${this.guess.s}% 50%), #fff)`;
  }
  rgbTrack(ch: 'r' | 'g' | 'b'): string {
    const c = hslToRgb(this.guess);
    const lo = { ...c, [ch]: 0 } as RGB;
    const hi = { ...c, [ch]: 255 } as RGB;
    return `linear-gradient(90deg, rgb(${lo.r} ${lo.g} ${lo.b}), rgb(${hi.r} ${hi.g} ${hi.b}))`;
  }

  get guessCss(): string {
    return hslCss(this.guess);
  }
  get targetCss(): string {
    return hslCss(this.target);
  }
  get guessRounded(): HSL {
    return roundHsl(this.guess);
  }

  // -------------------------------------------------------------- SEEK
  private nextSeekRound(): void {
    if (this.timeRemaining <= 0) return;
    const board = makeSeekBoard(this.cfg, Math.random);
    this.seekBoard = board;
    this.seekBoardId++;
    const tiles: SeekTile[] = [];
    for (let i = 0; i < board.count; i++) {
      const hsl = i === board.oddIndex ? board.odd : board.base;
      tiles.push({ index: i, hsl, css: hslCss(hsl) });
    }
    this.seekTiles = tiles;
  }

  tapTile(tile: SeekTile, ev: MouseEvent): void {
    if (!this.seekBoard || this.timeRemaining <= 0) return;
    this.attempts++;
    const correct = tile.index === this.seekBoard.oddIndex;
    const x = ev.clientX;
    const y = ev.clientY;
    if (correct) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.perfectMatches++;
      this.score += seekPoints(this.combo, this.cfg);
      this.pushGrade('perfect', 'FOUND!');
      // sparkles in the equipped gem's colours
      this.juice.burst(x, y, { count: 26, power: 8, colors: this.skinPalette });
      this.juice.blip(560 + Math.min(this.combo, 18) * 16, { type: 'square', duration: 0.06, gain: 0.045 });
      if (this.combo > 0 && this.combo % 5 === 0) this.juice.confetti(36);
      this.nextSeekRound();
    } else {
      this.combo = 0;
      this.endAt -= 2000; // −2s penalty
      this.pushGrade('off', '−2s');
      this.juice.burst(x, y, { count: 10, power: 6, colors: GRADE_COLORS.off });
      this.juice.blip(140, { type: 'sawtooth', duration: 0.16, gain: 0.05 });
      this.shakeStage();
    }
  }

  // -------------------------------------------------------------- flashes / juice
  private pushGrade(grade: Grade, text?: string): void {
    const id = ++this.flashId;
    this.gradeFlashes = [{ id, text: text ?? GRADE_LABEL[grade], cls: grade }];
    setTimeout(() => {
      this.gradeFlashes = this.gradeFlashes.filter(g => g.id !== id);
    }, 850);
  }

  /** A non-intrusive Perfect celebration: an expanding ring + a soft edge glow
   *  (pointer-events: none, so it never blocks the controls). */
  private firePerfectFx(): void {
    const id = ++this.pfId;
    this.perfectFx = [{ id }];
    setTimeout(() => {
      this.perfectFx = this.perfectFx.filter(f => f.id !== id);
    }, 1000);
  }

  private gradeJuice(grade: Grade): void {
    const pos = this.engine?.gemScreenPos() ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    // Perfects celebrate in the equipped gem's colours; other grades keep their semantic colour.
    const colors = grade === 'perfect' ? this.skinPalette : GRADE_COLORS[grade];
    const counts: Record<Grade, [number, number]> = {
      perfect: [34, 11],
      great: [22, 9],
      good: [14, 7],
      close: [10, 6],
      off: [8, 5],
    };
    const [count, power] = counts[grade];
    this.juice.burst(pos.x, pos.y, { count, power, colors });

    if (grade === 'perfect') {
      // no screen-shake on Perfect — the ring/glow FX (firePerfectFx) hypes without jolting play
      this.juice.blip(620 + Math.min(this.combo, 20) * 14, { type: 'square', duration: 0.06, gain: 0.045 });
      this.juice.blip(920 + Math.min(this.combo, 20) * 14, { type: 'triangle', duration: 0.1, gain: 0.04 });
      if (this.combo > 0 && this.combo % 5 === 0) this.juice.confetti(40);
    } else if (grade === 'great') {
      this.juice.blip(520, { type: 'square', duration: 0.06, gain: 0.04 });
    } else if (grade === 'good') {
      this.juice.blip(430, { type: 'triangle', duration: 0.06, gain: 0.035 });
    } else if (grade === 'close') {
      this.juice.blip(300, { type: 'triangle', duration: 0.08, gain: 0.035 });
    } else {
      this.juice.blip(150, { type: 'sawtooth', duration: 0.16, gain: 0.05 });
      this.shakeStage(8, 280);
    }
  }

  private shakeStage(strength = 7, duration = 260): void {
    this.juice.shake(document.querySelector<HTMLElement>('.ch-stage'), strength, duration);
  }

  // -------------------------------------------------------------- end of run
  private async endRun(): Promise<void> {
    if (this.screen === 'over') return;
    this.stopTimers();
    this.timeRemaining = 0;
    this.screen = 'over';
    this.zone.runOutsideAngular(() => this.engine?.setGemVisible(false));

    const avg =
      this.mode === 'mix'
        ? this.attempts > 0
          ? this.accSum / this.attempts
          : 0
        : this.attempts > 0
          ? (this.perfectMatches / this.attempts) * 100
          : 0;

    const summary: RunSummary = {
      score: this.score,
      mode: this.mode,
      difficulty: this.boardDifficulty,
      perfectMatches: this.perfectMatches,
      attempts: this.attempts,
      bestCombo: this.bestCombo,
      avgAccuracy: Math.round(avg),
    };
    this.summary = summary;
    this.computeReport();

    if (summary.score > this.bestScore) {
      this.bestScore = summary.score;
      localStorage.setItem(BEST_KEY, String(summary.score));
    }

    // Reward Sparkles for the collection. The two modes score very differently
    // (Seek = many fast finds → high totals; Mix = few slow matches → low totals),
    // so each has its own rate tuned to give a similar payout per good run.
    //   Seek: score-based, boosted +210% (× 3.1) over the base score/80.
    //   Mix:  much smaller divisor (its totals are far lower) + a Perfect bonus.
    this.sparklesEarned =
      summary.mode === 'seek'
        ? Math.round((summary.score / 80) * 3.1)
        : Math.round(summary.score / 6) + summary.perfectMatches * 8;
    this.store.addSparkles(this.sparklesEarned);

    this.juice.confetti(110);
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.2, gain: 0.05 }), i * 110),
    );

    if (summary.score > 0) {
      this.submitting = true;
      try {
        await this.supabase.insertColorHideScore({
          playerName: this.playerName.trim(),
          score: summary.score,
          mode: summary.mode,
          difficulty: summary.difficulty,
          perfectMatches: summary.perfectMatches,
          attempts: summary.attempts,
          bestCombo: summary.bestCombo,
          avgAccuracy: summary.avgAccuracy,
        });
        await this.loadLeaderboard();
      } catch (e) {
        console.error('Color Hide score submit failed', e);
        this.toast('Could not save your score (offline?)', 'error');
      } finally {
        this.submitting = false;
      }
    }
  }

  // -------------------------------------------------------------- data
  async loadLeaderboard(): Promise<void> {
    try {
      const rows = await this.supabase.getColorHideHighScores(8, {
        mode: this.mode,
        difficulty: this.boardDifficulty,
      });
      this.highScores = (rows as CHScore[]) || [];
    } catch (e) {
      console.error('Color Hide leaderboard load failed', e);
    }
  }

  isYou(row: CHScore): boolean {
    return (
      this.screen === 'over' &&
      !!this.summary &&
      row.player_name === this.playerName.trim() &&
      row.score === this.summary.score
    );
  }

  gradeText(grade: string): string {
    return GRADE_LABEL[grade as Grade] ?? grade;
  }

  /** Teaching chip: direction to move a channel (▲ up / ▼ down), or "spot on". */
  deltaText(v: number, unit: string): string {
    const a = Math.abs(v);
    return a <= 1 ? 'spot on' : `${v > 0 ? '▲' : '▼'} ${a}${unit}`;
  }
  deltaOk(v: number): boolean {
    return Math.abs(v) <= 1;
  }

  // -------------------------------------------------------------- helpers
  private toast(message: string, type: 'success' | 'error' | 'info'): void {
    const t = { id: this.toastId++, message, type };
    this.toasts.push(t);
    if (this.toasts.length > 3) this.toasts = this.toasts.slice(-3);
    setTimeout(() => (this.toasts = this.toasts.filter(x => x.id !== t.id)), 2200);
  }

  private handleVisibility(): void {
    if (document.hidden) {
      if (this.screen === 'playing') {
        this.engine?.pause();
        this.stopTimers();
      }
    } else if (this.screen === 'playing') {
      this.zone.runOutsideAngular(() => this.engine?.resume());
      // resume the clock from where it left off
      this.endAt = performance.now() + this.timeRemaining * 1000;
      this.timer = setInterval(() => this.tick(), 90);
      // re-arm the mix round timer we lost on pause so the run never stalls
      if (this.mode === 'mix') {
        if (this.phase === 'reveal') {
          // restart the memorise window using this round's own duration
          const rem = this.revealTotalMs || MIX_CONFIG.revealMs;
          this.revealMsLeft = rem;
          this.revealEndAt = performance.now() + rem;
          this.roundTimer = setTimeout(() => {
            this.phase = 'guess';
            this.zone.runOutsideAngular(() => this.engine?.startGuess());
          }, rem);
        } else if (this.phase === 'result') {
          this.roundTimer = setTimeout(() => this.advanceRound(), 500);
        }
      }
    }
  }

  trackSeek(t: SeekTile): string {
    return this.seekBoardId + ':' + t.index;
  }
}
