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
import {
  HarvestEngine,
  Grade,
  HarvestFloater,
  HarvestSummary,
  GAME_DURATION,
} from './harvest-engine';

interface PHScore {
  player_name: string;
  score: number;
  perfect_count: number;
  highest_combo: number;
  created_at?: string;
}

const NAME_KEY = 'ph_player_name';
const BEST_KEY = 'ph_best_score';

const GRADE_LABEL: Record<Grade, string> = {
  perfect: 'PERFECT!',
  great: 'GREAT!',
  good: 'GOOD',
  poor: 'POOR',
  miss: 'MISS',
};

const GRADE_COLORS: Record<Grade, string[]> = {
  perfect: ['#ffd24a', '#ffae3a', '#fff7cc', '#7CF06E'],
  great: ['#7CF06E', '#39d98a', '#caffd0'],
  good: ['#a7e88f', '#7cc6ff', '#e6ffd9'],
  poor: ['#9aa0b5', '#c9cede', '#7c7f93'],
  miss: ['#fb7185', '#e0566b', '#9a9a9a'],
};

@Component({
  selector: 'app-perfect-harvest-game',
  standalone: true,
  imports: [CommonModule, FormsModule, GameShellComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './perfect-harvest-game.component.html',
  styleUrl: './perfect-harvest-game.component.scss',
})
export class PerfectHarvestGameComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  private zone = inject(NgZone);
  private supabase = inject(SupabaseService);
  private juice = inject(JuiceService);

  // screen flow
  screen: 'intro' | 'playing' | 'over' = 'intro';
  playerName = '';
  showHowTo = false;

  // HUD (mirrors the engine snapshot, updated ~12×/s)
  score = 0;
  timeRemaining = GAME_DURATION;
  combo = 0;
  comboMult = 1;
  phase: 1 | 2 | 3 = 1;
  floaters: HarvestFloater[] = [];
  gradeFlashes: { id: number; text: string; cls: Grade }[] = [];

  // results / leaderboard
  summary: HarvestSummary | null = null;
  highScores: PHScore[] = [];
  bestScore = 0;
  submitting = false;
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' }[] = [];

  private engine?: HarvestEngine;
  private resizeObs?: ResizeObserver;
  private sync?: ReturnType<typeof setInterval>;
  private prevTime = GAME_DURATION;
  private lastGradeId = 0;
  private flashId = 0;
  private toastId = 0;
  private onVisible = (): void => this.handleVisibility();

  get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  get timeLabel(): string {
    const t = Math.max(0, this.timeRemaining);
    const m = Math.floor(t / 60);
    const s = t % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  get timeProgress(): number {
    return Math.min(1, Math.max(0, (GAME_DURATION - this.timeRemaining) / GAME_DURATION));
  }
  get phaseLabel(): string {
    return this.phase === 1 ? 'Warming up' : this.phase === 2 ? 'Picking up' : 'Harvest rush';
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.playerName = localStorage.getItem(NAME_KEY) ?? '';
    this.bestScore = Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
    this.loadLeaderboard();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || !this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;

    // Everything Three.js runs OUTSIDE Angular's zone so the 60fps render loop
    // never triggers change detection. The HUD is synced separately (see startGame).
    this.zone.runOutsideAngular(() => {
      this.engine = new HarvestEngine(canvas, {
        onHarvest: info => this.onHarvest(info),
        onSpoil: info => this.onSpoil(info),
        onComboMilestone: combo => this.onComboMilestone(combo),
        onEnd: summary => this.zone.run(() => this.onGameEnd(summary)),
      });

      this.resizeObs = new ResizeObserver(() => this.engine?.resize());
      this.resizeObs.observe(canvas);
    });

    document.addEventListener('visibilitychange', this.onVisible);
  }

  ngOnDestroy(): void {
    this.stopSync();
    this.resizeObs?.disconnect();
    if (this.isBrowser) document.removeEventListener('visibilitychange', this.onVisible);
    this.engine?.dispose();
    this.engine = undefined;
  }

  // ============================================================ flow
  startGame(): void {
    if (!this.engine) return;
    const name = this.playerName.trim();
    if (!name) {
      this.toast('Enter your name first!', 'error');
      return;
    }
    localStorage.setItem(NAME_KEY, name);
    this.juice.blip(660, { type: 'triangle', duration: 0.12, gain: 0.05 });

    this.screen = 'playing';
    this.summary = null;
    this.floaters = [];
    this.gradeFlashes = [];
    this.score = 0;
    this.combo = 0;
    this.comboMult = 1;
    this.timeRemaining = GAME_DURATION;
    this.prevTime = GAME_DURATION;
    this.lastGradeId = 0;

    // engine drives itself outside the zone; the HUD is polled inside the zone
    this.zone.runOutsideAngular(() => this.engine!.start());
    this.startSync();
  }

  playAgain(): void {
    this.startGame();
  }

  quitToIntro(): void {
    this.engine?.pause();
    this.stopSync();
    this.screen = 'intro';
  }

  toggleHowTo(): void {
    this.showHowTo = !this.showHowTo;
  }

  // ============================================================ HUD sync
  private startSync(): void {
    this.stopSync();
    // inside the Angular zone → change detection runs on each tick (~12fps HUD)
    this.sync = setInterval(() => this.pull(), 80);
  }
  private stopSync(): void {
    if (this.sync) clearInterval(this.sync);
    this.sync = undefined;
  }

  private pull(): void {
    const e = this.engine;
    if (!e) return;
    const s = e.snapshot();
    this.score = s.score;
    this.combo = s.combo;
    this.comboMult = s.comboMult;
    this.phase = s.phase;
    this.floaters = s.floaters;

    if (s.timeRemaining !== this.timeRemaining) {
      // warning beeps in the final 10 seconds
      if (s.timeRemaining < this.prevTime && s.timeRemaining <= 10 && s.timeRemaining > 0) {
        this.juice.blip(680, { type: 'sine', duration: 0.06, gain: 0.03 });
      }
      this.prevTime = s.timeRemaining;
      this.timeRemaining = s.timeRemaining;
    }

    if (s.gradeId !== this.lastGradeId && s.lastGrade) {
      this.lastGradeId = s.gradeId;
      this.pushGrade(s.lastGrade);
    }
  }

  private pushGrade(grade: Grade): void {
    const id = ++this.flashId;
    this.gradeFlashes = [{ id, text: GRADE_LABEL[grade], cls: grade }];
    setTimeout(() => {
      this.gradeFlashes = this.gradeFlashes.filter(g => g.id !== id);
    }, 780);
  }

  // ============================================================ juice (outside zone)
  private onHarvest(info: { grade: Grade; points: number; combo: number; clientX: number; clientY: number }): void {
    const g = info.grade;
    const colors = GRADE_COLORS[g];
    const counts: Record<Grade, [number, number]> = {
      perfect: [30, 11],
      great: [18, 8],
      good: [12, 6],
      poor: [8, 5],
      miss: [14, 8],
    };
    const [count, power] = counts[g];
    this.juice.burst(info.clientX, info.clientY, { count, power, colors });

    if (g === 'perfect') {
      this.juice.blip(620 + Math.min(info.combo, 20) * 14, { type: 'square', duration: 0.06, gain: 0.045 });
      this.juice.blip(880 + Math.min(info.combo, 20) * 14, { type: 'triangle', duration: 0.1, gain: 0.04 });
      this.shakeStage(7, 280);
    } else if (g === 'great') {
      this.juice.blip(520, { type: 'square', duration: 0.06, gain: 0.04 });
    } else if (g === 'good') {
      this.juice.blip(420, { type: 'triangle', duration: 0.06, gain: 0.035 });
    } else if (g === 'poor') {
      this.juice.blip(240, { type: 'sawtooth', duration: 0.1, gain: 0.04 });
    } else {
      this.juice.blip(150, { type: 'sawtooth', duration: 0.16, gain: 0.05 });
      this.shakeStage(9, 300);
    }
  }

  private onSpoil(info: { clientX: number; clientY: number }): void {
    this.juice.burst(info.clientX, info.clientY, {
      count: 16,
      power: 7,
      colors: ['#6b5a3a', '#8a7a4a', '#4a3a22'],
      gravity: 0.3,
    });
    this.juice.blip(120, { type: 'sawtooth', duration: 0.22, gain: 0.05 });
    this.shakeStage(10, 320);
  }

  private onComboMilestone(combo: number): void {
    this.shakeStage(8, 300);
    for (const f of [660, 880, 1175]) {
      this.juice.blip(f, { type: 'triangle', duration: 0.1, gain: 0.045 });
    }
    if (combo >= 10) this.juice.confetti(40);
  }

  private shakeStage(strength: number, duration: number): void {
    this.juice.shake(document.querySelector('.ph-stage'), strength, duration);
  }

  // ============================================================ end of run
  private async onGameEnd(summary: HarvestSummary): Promise<void> {
    this.stopSync();
    this.screen = 'over';
    this.summary = summary;
    this.timeRemaining = 0;

    if (summary.score > this.bestScore) {
      this.bestScore = summary.score;
      localStorage.setItem(BEST_KEY, String(summary.score));
    }

    // celebration
    this.juice.confetti(110);
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.2, gain: 0.05 }), i * 110),
    );

    // one submission per completed run
    if (summary.score > 0) {
      this.submitting = true;
      try {
        await this.supabase.insertPerfectHarvestScore(
          this.playerName.trim(),
          summary.score,
          summary.perfect,
          summary.highestCombo,
        );
        await this.loadLeaderboard();
      } catch (e) {
        console.error('Perfect Harvest score submit failed', e);
        this.toast('Could not save your score (offline?)', 'error');
      } finally {
        this.submitting = false;
      }
    }
  }

  // ============================================================ data
  async loadLeaderboard(): Promise<void> {
    try {
      this.highScores = ((await this.supabase.getPerfectHarvestHighScores(8)) as PHScore[]) || [];
    } catch (e) {
      console.error('Perfect Harvest leaderboard load failed', e);
    }
  }

  // ============================================================ helpers used by the template
  isYou(row: PHScore): boolean {
    return (
      this.screen === 'over' &&
      !!this.summary &&
      row.player_name === this.playerName.trim() &&
      row.score === this.summary.score
    );
  }

  private toast(message: string, type: 'success' | 'error' | 'info'): void {
    const t = { id: this.toastId++, message, type };
    this.toasts.push(t);
    if (this.toasts.length > 3) this.toasts = this.toasts.slice(-3);
    setTimeout(() => (this.toasts = this.toasts.filter(x => x.id !== t.id)), 2000);
  }

  private handleVisibility(): void {
    if (document.hidden) {
      if (this.screen === 'playing') {
        this.engine?.pause();
        this.stopSync();
      }
    } else if (this.screen === 'playing') {
      this.zone.runOutsideAngular(() => this.engine?.resume());
      this.startSync();
    }
  }
}
