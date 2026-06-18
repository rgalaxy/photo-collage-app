import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { GameShellComponent } from '../../shared/game-shell/game-shell.component';
import { JuiceService } from '../../shared/juice/juice.service';

type TargetType = 'normal' | 'bonus' | 'bomb' | 'time';

interface Target {
  id: number;
  x: number; // %
  y: number; // %
  size: number; // px
  ttl: number; // remaining ms
  maxTtl: number;
  type: TargetType;
  popped: boolean;
}

interface FloatingScore {
  id: number;
  x: number;
  y: number;
  text: string;
  good: boolean;
}

interface ClickResult {
  score: number;
  accuracy: number;
  maxCombo: number;
  hits: number;
}

@Component({
  selector: 'app-click-the-target-game',
  standalone: true,
  imports: [CommonModule, FormsModule, GameShellComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './click-the-target-game.component.html',
  styleUrl: './click-the-target-game.component.scss',
})
export class ClickTheTargetGameComponent implements OnInit, OnDestroy {
  // ----- tunables -----
  readonly GAME_TIME = 45;
  private readonly TICK = 50;
  // [start, end] values interpolated over the run by progress() (0 → 1)
  private ramp = {
    spawn: [1100, 520], // ms between spawns
    ttl: [2300, 1150], // target lifetime ms
    size: [82, 50], // px
    maxTargets: [3, 6],
    bonusChance: [0.12, 0.16],
    timeChance: [0.07, 0.06],
    comboWindow: [2000, 1300], // ms to keep a combo alive
  };
  private basePoints: Record<TargetType, number> = { normal: 10, bonus: 25, time: 5, bomb: 0 };
  private readonly BOMB_PENALTY = 15;
  readonly TIME_BONUS = 2;

  // ----- state -----
  playerName = '';
  gameActive = false;
  gameOver = false;

  score = 0;
  hits = 0;
  misses = 0;
  combo = 0;
  maxCombo = 0;
  timeRemaining = this.GAME_TIME;

  targets: Target[] = [];
  floatingScores: FloatingScore[] = [];
  private targetId = 0;
  private floatId = 0;

  private comboLeft = 0; // ms left on the current combo
  private comboFull = 1; // window the combo was last refreshed to

  showHowToPlay = false;
  showGameOverModal = false;
  result: ClickResult | null = null;

  highScores: any[] = [];
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' }[] = [];
  private toastId = 0;

  private timer?: any;
  private loop?: any;
  private spawnAcc = 0;

  constructor(private supabaseService: SupabaseService, private juice: JuiceService) {}

  ngOnInit(): void {
    this.loadHighScores();
  }
  ngOnDestroy(): void {
    this.stopTimers();
  }

  async loadHighScores(): Promise<void> {
    try {
      this.highScores = (await this.supabaseService.getClickTargetHighScores(7)) || [];
    } catch (e) {
      console.error('high scores load failed', e);
    }
  }

  // ===================== flow =====================
  startGame(): void {
    if (!this.playerName.trim()) {
      this.showToast('Enter your name first!', 'error');
      return;
    }
    this.stopTimers();
    this.gameActive = true;
    this.gameOver = false;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboLeft = 0;
    this.timeRemaining = this.GAME_TIME;
    this.targets = [];
    this.floatingScores = [];
    this.toasts = [];
    this.result = null;
    this.showGameOverModal = false;
    this.spawnAcc = 600;

    this.timer = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 8 && this.timeRemaining > 0) {
        this.juice.blip(640, { type: 'sine', duration: 0.05, gain: 0.022 });
      }
      if (this.timeRemaining <= 0) this.endGame();
    }, 1000);

    this.loop = setInterval(() => this.tick(), this.TICK);
  }

  private stopTimers(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.loop) clearInterval(this.loop);
    this.timer = undefined;
    this.loop = undefined;
  }

  private tick(): void {
    const p = this.progress();

    // expire targets
    if (this.targets.length) {
      const survivors: Target[] = [];
      for (const t of this.targets) {
        if (t.popped) continue;
        t.ttl -= this.TICK;
        if (t.ttl <= 0) {
          if (t.type !== 'bomb') {
            this.misses++;
            this.breakCombo();
          }
          continue;
        }
        survivors.push(t);
      }
      this.targets = survivors;
    }

    // combo timer
    if (this.combo > 0) {
      this.comboLeft -= this.TICK;
      if (this.comboLeft <= 0) this.breakCombo();
    }

    // spawn
    this.spawnAcc -= this.TICK;
    if (this.spawnAcc <= 0 && this.targets.length < Math.round(this.lerp(this.ramp.maxTargets, p))) {
      this.spawnTarget(p);
      this.spawnAcc = this.lerp(this.ramp.spawn, p);
    }
  }

  private spawnTarget(p: number): void {
    const bombChance = p > 0.18 ? this.lerp([0, 0.2], (p - 0.18) / 0.82) : 0;
    const timeChance = this.lerp(this.ramp.timeChance, p);
    const bonusChance = this.lerp(this.ramp.bonusChance, p);
    const r = Math.random();
    let type: TargetType = 'normal';
    if (r < bombChance) type = 'bomb';
    else if (r < bombChance + timeChance) type = 'time';
    else if (r < bombChance + timeChance + bonusChance) type = 'bonus';

    const baseSize = this.lerp(this.ramp.size, p);
    const size = Math.round(baseSize * (type === 'bonus' ? 0.82 : type === 'time' ? 0.92 : 1));
    const baseTtl = this.lerp(this.ramp.ttl, p);
    const ttl = Math.round(baseTtl * (type === 'bonus' ? 0.8 : type === 'bomb' ? 1.15 : 1));
    const pad = 7;

    this.targets.push({
      id: this.targetId++,
      x: pad + Math.random() * (100 - pad * 2),
      y: pad + Math.random() * (100 - pad * 2),
      size,
      ttl,
      maxTtl: ttl,
      type,
      popped: false,
    });
  }

  // ===================== interaction =====================
  hitTarget(t: Target, event: MouseEvent): void {
    event.stopPropagation();
    if (!this.gameActive || t.popped) return;

    if (t.type === 'bomb') {
      t.popped = true;
      this.score = Math.max(0, this.score - this.BOMB_PENALTY);
      this.misses++;
      this.breakCombo();
      this.float(t.x, t.y, `-${this.BOMB_PENALTY}`, false);
      this.juice.shake(document.querySelector('.ct-field'), 12, 360);
      this.juice.blip(110, { type: 'sawtooth', duration: 0.22, gain: 0.06 });
      this.juice.burst(event.clientX, event.clientY, { count: 26, power: 10, colors: ['#fb7185', '#6b6b6b', '#9a9a9a'] });
      this.removeSoon(t.id);
      return;
    }

    // good hit
    t.popped = true;
    this.hits++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboFull = this.lerp(this.ramp.comboWindow, this.progress());
    this.comboLeft = this.comboFull;

    const mult = this.comboMult();
    let pts = Math.round(this.basePoints[t.type] * mult);
    this.score += pts;

    if (t.type === 'time') {
      this.timeRemaining += this.TIME_BONUS;
      this.float(t.x, t.y, `+${this.TIME_BONUS}s`, true);
      this.juice.blip(1175, { type: 'sine', duration: 0.14, gain: 0.05 });
    } else {
      this.float(t.x, t.y, `+${pts}`, true);
    }

    // juice scales with combo + target type
    const gold = t.type === 'bonus';
    this.juice.burst(event.clientX, event.clientY, {
      count: 12 + Math.min(this.combo, 14) + (gold ? 10 : 0),
      power: 6 + Math.min(this.combo, 9),
      colors: gold ? ['#ffd63a', '#ffa955', '#fff'] : ['#22d3ee', '#7c3aed', '#c6f24e'],
    });
    this.juice.blip(440 + this.combo * 14 + (gold ? 120 : 0), { type: 'square', duration: 0.05, gain: 0.04 });

    if (this.combo > 0 && this.combo % 10 === 0) {
      this.juice.shake(document.querySelector('.ct-field'), 9, 300);
      this.juice.blip(900, { type: 'triangle', duration: 0.16, gain: 0.05 });
    }

    this.removeSoon(t.id);
  }

  /** Clicking empty space — a miss that breaks the combo (precision matters). */
  fieldClick(event: MouseEvent): void {
    if (!this.gameActive) return;
    if (event.target === event.currentTarget) {
      this.misses++;
      this.breakCombo();
    }
  }

  private removeSoon(id: number): void {
    setTimeout(() => {
      this.targets = this.targets.filter(t => t.id !== id);
    }, 220);
  }

  private float(x: number, y: number, text: string, good: boolean): void {
    const f = { id: this.floatId++, x, y, text, good };
    this.floatingScores.push(f);
    setTimeout(() => {
      this.floatingScores = this.floatingScores.filter(s => s.id !== f.id);
    }, 850);
  }

  private breakCombo(): void {
    this.combo = 0;
    this.comboLeft = 0;
  }

  async endGame(): Promise<void> {
    if (this.gameOver) return;
    this.stopTimers();
    this.gameActive = false;
    this.gameOver = true;
    this.targets = [];

    this.result = { score: this.score, accuracy: this.getAccuracy(), maxCombo: this.maxCombo, hits: this.hits };

    if (this.score > 0) {
      this.juice.confetti(90);
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.18, gain: 0.05 }), i * 110)
      );
      try {
        await this.supabaseService.insertClickTargetScore(this.playerName, this.score, this.getAccuracy(), this.maxCombo);
        await this.loadHighScores();
      } catch (e) {
        console.error('score submit failed', e);
      }
    }
    this.showGameOverModal = true;
  }

  startNewGame(): void {
    this.showGameOverModal = false;
    this.gameOver = false;
    this.startGame();
  }
  closeGameOverModal(): void {
    this.showGameOverModal = false;
    this.gameOver = false;
    this.gameActive = false;
  }

  // ===================== helpers =====================
  private progress(): number {
    return Math.min(1, Math.max(0, 1 - this.timeRemaining / this.GAME_TIME));
  }
  private lerp(range: number[], p: number): number {
    return range[0] + (range[1] - range[0]) * p;
  }
  comboMult(): number {
    const c = this.combo;
    return c >= 30 ? 4 : c >= 20 ? 3 : c >= 10 ? 2 : c >= 5 ? 1.5 : 1;
  }
  comboFrac(): number {
    return this.combo > 0 && this.comboFull > 0 ? Math.max(0, this.comboLeft / this.comboFull) : 0;
  }
  getAccuracy(): number {
    const total = this.hits + this.misses;
    return total > 0 ? Math.round((this.hits / total) * 100) : 100;
  }
  targetIcon(type: TargetType): string {
    return type === 'bomb' ? '💣' : type === 'bonus' ? '⭐' : type === 'time' ? '⏱️' : '🎯';
  }

  toggleHowToPlay(): void {
    this.showHowToPlay = !this.showHowToPlay;
  }

  showToast(message: string, type: 'success' | 'error' | 'info'): void {
    const toast = { id: this.toastId++, message, type };
    this.toasts.push(toast);
    if (this.toasts.length > 3) this.toasts = this.toasts.slice(-3);
    setTimeout(() => (this.toasts = this.toasts.filter(t => t.id !== toast.id)), 1900);
  }
}
