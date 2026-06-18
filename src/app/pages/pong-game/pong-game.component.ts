import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
  NgZone,
  ChangeDetectorRef,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { GameShellComponent } from '../../shared/game-shell/game-shell.component';
import { JuiceService } from '../../shared/juice/juice.service';

interface Ball { x: number; y: number; vx: number; vy: number; r: number; }
interface Paddle { x: number; y: number; w: number; h: number; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; }

type GameState = 'setup' | 'playing' | 'paused' | 'gameOver';
type Mode = 'ai' | 'local';
type AiLevel = 'chill' | 'normal' | 'sharp';

@Component({
  selector: 'app-pong-game',
  standalone: true,
  imports: [CommonModule, FormsModule, GameShellComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './pong-game.component.html',
  styleUrl: './pong-game.component.scss',
})
export class PongGameComponent implements OnInit, OnDestroy {
  @ViewChild('gameCanvas') canvasRef?: ElementRef<HTMLCanvasElement>;

  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  // ----- field -----
  private readonly W = 800;
  private readonly H = 450;
  private readonly PADDLE_W = 14;
  private readonly PADDLE_H = 88;
  private readonly BALL_R = 9;
  private readonly PADDLE_SPEED = 7;
  private readonly BASE_SPEED = 6;
  private readonly MAX_SPEED = 15;
  private readonly SPEEDUP = 1.045;
  private readonly MAX_VY = 7;
  readonly winTargets = [5, 7, 11];

  private aiConfig: Record<AiLevel, { speed: number; err: number }> = {
    chill: { speed: 4.6, err: 70 },
    normal: { speed: 6.2, err: 36 },
    sharp: { speed: 8.2, err: 14 },
  };

  // ----- state -----
  gameState: GameState = 'setup';
  mode: Mode = 'ai';
  aiLevel: AiLevel = 'normal';
  player1Name = '';
  player2Name = '';
  player1Score = 0;
  player2Score = 0;
  winner = '';
  maxScore = 7;
  serveCountdown = 0; // shown 3..1

  showHowToPlay = false;
  showGameOverModal = false;
  highScores: any[] = [];
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' }[] = [];
  private toastId = 0;

  // ----- engine -----
  private ctx?: CanvasRenderingContext2D | null;
  private canvas?: HTMLCanvasElement;
  private raf = 0;
  private ball!: Ball;
  private p1!: Paddle;
  private p2!: Paddle;
  private particles: Particle[] = [];
  private trail: { x: number; y: number }[] = [];
  private keys = new Set<string>();
  private serveAt = 0;
  private gameStartTime = 0;
  private aiTargetY = this.H / 2;
  private aiTick = 0;
  // touch: paddle -> target top-y (internal coords)
  private touchTarget: Record<1 | 2, number | null> = { 1: null, 2: null };
  private pointers = new Map<number, 1 | 2>();

  private supabaseService = inject(SupabaseService);
  private juice = inject(JuiceService);

  ngOnInit(): void {
    this.loadHighScores();
    this.resetObjects();
  }
  ngOnDestroy(): void {
    this.stopLoop();
  }

  async loadHighScores(): Promise<void> {
    try {
      this.highScores = (await this.supabaseService.getPongHighScores(8)) || [];
    } catch (e) {
      console.error('pong high scores failed', e);
      this.highScores = [];
    }
  }

  // ===================== setup =====================
  setMode(m: Mode): void {
    this.mode = m;
  }
  setAi(l: AiLevel): void {
    this.aiLevel = l;
  }

  startGame(): void {
    if (!this.player1Name.trim()) {
      this.showToast('Enter your name first!', 'error');
      return;
    }
    if (this.mode === 'local' && !this.player2Name.trim()) {
      this.showToast('Enter both player names!', 'error');
      return;
    }
    if (this.mode === 'ai') this.player2Name = 'CPU';

    this.player1Score = 0;
    this.player2Score = 0;
    this.winner = '';
    this.gameStartTime = Date.now();
    this.showGameOverModal = false;
    this.gameState = 'playing';
    this.resetObjects();

    // wait a tick for the canvas to render
    setTimeout(() => {
      const cv = this.canvasRef?.nativeElement;
      if (!cv) return;
      this.canvas = cv;
      this.canvas.width = this.W;
      this.canvas.height = this.H;
      this.ctx = this.canvas.getContext('2d');
      this.attachPointer();
      this.serve(Math.random() > 0.5 ? 1 : -1);
      this.zone.runOutsideAngular(() => this.loop());
    }, 60);
  }

  private resetObjects(): void {
    this.ball = { x: this.W / 2, y: this.H / 2, vx: 0, vy: 0, r: this.BALL_R };
    this.p1 = { x: 22, y: this.H / 2 - this.PADDLE_H / 2, w: this.PADDLE_W, h: this.PADDLE_H };
    this.p2 = { x: this.W - 22 - this.PADDLE_W, y: this.H / 2 - this.PADDLE_H / 2, w: this.PADDLE_W, h: this.PADDLE_H };
    this.particles = [];
    this.trail = [];
    this.touchTarget = { 1: null, 2: null };
  }

  /** Place the ball at center and launch toward `dir` (1 = right/P2, -1 = left/P1) after a countdown. */
  private serve(dir: number): void {
    this.ball.x = this.W / 2;
    this.ball.y = this.H / 2;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.trail = [];
    this.serveAt = performance.now() + 1100;
    const launch = () => {
      this.ball.vx = dir * this.BASE_SPEED;
      this.ball.vy = (Math.random() - 0.5) * 5;
    };
    // countdown for the HUD
    this.serveCountdown = 3;
    this.zone.run(() => this.cdr.detectChanges());
    const t1 = setTimeout(() => { this.serveCountdown = 2; this.zone.run(() => this.cdr.detectChanges()); }, 360);
    const t2 = setTimeout(() => { this.serveCountdown = 1; this.zone.run(() => this.cdr.detectChanges()); }, 720);
    const t3 = setTimeout(() => {
      this.serveCountdown = 0;
      launch();
      this.zone.run(() => this.cdr.detectChanges());
    }, 1100);
    // store for cleanup if needed
    this.serveTimers = [t1, t2, t3];
  }
  private serveTimers: any[] = [];

  // ===================== loop =====================
  private loop = (): void => {
    if (this.gameState !== 'playing' || !this.ctx) return;
    this.update();
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private stopLoop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.serveTimers.forEach(t => clearTimeout(t));
  }

  private update(): void {
    this.movePaddles();
    this.moveBall();
    this.updateParticles();
  }

  private movePaddles(): void {
    // Player 1 (left) — W/S, and in AI mode arrows too (so solo players can use either)
    const upP1 = this.keys.has('w') || (this.mode === 'ai' && this.keys.has('arrowup'));
    const downP1 = this.keys.has('s') || (this.mode === 'ai' && this.keys.has('arrowdown'));
    if (upP1) this.p1.y -= this.PADDLE_SPEED;
    if (downP1) this.p1.y += this.PADDLE_SPEED;
    if (this.touchTarget[1] != null) this.p1.y = this.touchTarget[1]!;
    this.p1.y = this.clampPaddle(this.p1.y);

    if (this.mode === 'ai') {
      this.moveAi();
    } else {
      if (this.keys.has('arrowup')) this.p2.y -= this.PADDLE_SPEED;
      if (this.keys.has('arrowdown')) this.p2.y += this.PADDLE_SPEED;
      if (this.touchTarget[2] != null) this.p2.y = this.touchTarget[2]!;
      this.p2.y = this.clampPaddle(this.p2.y);
    }
  }

  private moveAi(): void {
    const cfg = this.aiConfig[this.aiLevel];
    const center = this.p2.y + this.p2.h / 2;
    // only chase when the ball heads toward the AI; otherwise drift to centre
    if (this.ball.vx > 0) {
      if (--this.aiTick <= 0) {
        this.aiTargetY = this.ball.y + (Math.random() - 0.5) * cfg.err;
        this.aiTick = 8;
      }
    } else {
      this.aiTargetY = this.H / 2;
    }
    const diff = this.aiTargetY - center;
    if (Math.abs(diff) > 4) this.p2.y += Math.max(-cfg.speed, Math.min(cfg.speed, diff));
    this.p2.y = this.clampPaddle(this.p2.y);
  }

  private clampPaddle(y: number): number {
    return Math.max(0, Math.min(this.H - this.PADDLE_H, y));
  }

  private moveBall(): void {
    if (performance.now() < this.serveAt) return; // frozen during serve

    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;

    // trail
    this.trail.push({ x: this.ball.x, y: this.ball.y });
    if (this.trail.length > 12) this.trail.shift();

    // walls
    if (this.ball.y <= this.ball.r) { this.ball.y = this.ball.r; this.ball.vy = -this.ball.vy; this.wallHit(); }
    else if (this.ball.y >= this.H - this.ball.r) { this.ball.y = this.H - this.ball.r; this.ball.vy = -this.ball.vy; this.wallHit(); }

    this.paddleHit(this.p1, 1);
    this.paddleHit(this.p2, -1);

    // scoring
    if (this.ball.x < -10) this.score(2);
    else if (this.ball.x > this.W + 10) this.score(1);
  }

  private wallHit(): void {
    this.spawnParticles(this.ball.x, this.ball.y, '#22d3ee', 5);
  }

  /** dir 1 = left paddle (ball must travel left), -1 = right paddle. */
  private paddleHit(pad: Paddle, dir: number): void {
    const movingIntoPaddle = dir === 1 ? this.ball.vx < 0 : this.ball.vx > 0;
    if (!movingIntoPaddle) return;
    const withinX = dir === 1
      ? this.ball.x - this.ball.r <= pad.x + pad.w && this.ball.x >= pad.x
      : this.ball.x + this.ball.r >= pad.x && this.ball.x <= pad.x + pad.w;
    const withinY = this.ball.y >= pad.y - this.ball.r && this.ball.y <= pad.y + pad.h + this.ball.r;
    if (!withinX || !withinY) return;

    const speed = Math.min(Math.abs(this.ball.vx) * this.SPEEDUP, this.MAX_SPEED);
    this.ball.vx = dir === 1 ? speed : -speed;
    this.ball.x = dir === 1 ? pad.x + pad.w + this.ball.r : pad.x - this.ball.r;
    const rel = (this.ball.y - (pad.y + pad.h / 2)) / (pad.h / 2);
    this.ball.vy = Math.max(-this.MAX_VY, Math.min(this.MAX_VY, rel * 6));

    this.spawnParticles(this.ball.x, this.ball.y, dir === 1 ? '#22d3ee' : '#fb7185', 8);
    this.juice.blip(600 + Math.abs(this.ball.vx) * 14, { type: 'square', duration: 0.04, gain: 0.03 });
  }

  private score(player: 1 | 2): void {
    if (player === 1) this.player1Score++; else this.player2Score++;
    this.juiceGoal(player === 1 ? 'right' : 'left');
    if (this.player1Score >= this.maxScore || this.player2Score >= this.maxScore) {
      this.zone.run(() => this.endGame());
      return;
    }
    this.zone.run(() => this.cdr.detectChanges());
    this.serve(player === 1 ? 1 : -1); // serve toward whoever just conceded
  }

  private juiceGoal(side: 'left' | 'right'): void {
    const cv = this.canvas;
    this.juice.shake(cv, 9, 280);
    this.juice.blip(side === 'left' ? 300 : 520, { type: 'sawtooth', duration: 0.13, gain: 0.05 });
    if (cv) {
      const r = cv.getBoundingClientRect();
      const x = side === 'left' ? r.left + 10 : r.right - 10;
      this.juice.burst(x, r.top + r.height / 2, { count: 24, power: 9, colors: ['#22d3ee', '#7c3aed', '#fb7185'] });
    }
  }

  // ===================== particles + render =====================
  private spawnParticles(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 9,
        vy: (Math.random() - 0.5) * 9,
        life: 26, max: 26,
        size: Math.random() * 3 + 1.5,
        color,
      });
    }
  }
  private updateParticles(): void {
    this.particles = this.particles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.vx *= 0.96; p.vy *= 0.96; p.life--;
      return p.life > 0;
    });
  }

  private render(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, this.W, this.H);

    // center line
    ctx.setLineDash([6, 14]);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.W / 2, 0);
    ctx.lineTo(this.W / 2, this.H);
    ctx.stroke();
    ctx.setLineDash([]);

    // paddles (glowing)
    this.drawPaddle(this.p1, '#22d3ee');
    this.drawPaddle(this.p2, this.mode === 'ai' ? '#fb7185' : '#a78bfa');

    // ball trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const a = (i / this.trail.length) * 0.5;
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.ball.r * (0.4 + (i / this.trail.length) * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    // ball (glow)
    ctx.save();
    ctx.shadowBlur = 22;
    ctx.shadowColor = '#22d3ee';
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // particles
    for (const p of this.particles) {
      const a = p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawPaddle(p: Paddle, color: string): void {
    const ctx = this.ctx!;
    ctx.save();
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    const r = 7;
    ctx.beginPath();
    ctx.moveTo(p.x + r, p.y);
    ctx.arcTo(p.x + p.w, p.y, p.x + p.w, p.y + p.h, r);
    ctx.arcTo(p.x + p.w, p.y + p.h, p.x, p.y + p.h, r);
    ctx.arcTo(p.x, p.y + p.h, p.x, p.y, r);
    ctx.arcTo(p.x, p.y, p.x + p.w, p.y, r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ===================== flow =====================
  private async endGame(): Promise<void> {
    if (this.gameState === 'gameOver') return;
    this.stopLoop();
    this.gameState = 'gameOver';
    this.winner = this.player1Score > this.player2Score ? this.player1Name : this.player2Name;

    this.juice.confetti(100);
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.2, gain: 0.05 }), i * 120)
    );

    const duration = Math.floor((Date.now() - this.gameStartTime) / 1000);
    if (this.mode === 'local') {
      try {
        await this.supabaseService.insertPongScore(
          this.player1Name, this.player2Name, this.player1Score, this.player2Score, this.winner, duration
        );
        await this.loadHighScores();
      } catch (e) {
        console.error('pong score submit failed', e);
      }
    }
    this.showGameOverModal = true;
    this.cdr.detectChanges();
  }

  pauseGame(): void {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
      this.stopLoop();
    } else if (this.gameState === 'paused') {
      this.gameState = 'playing';
      this.zone.runOutsideAngular(() => this.loop());
    }
    this.cdr.detectChanges();
  }

  quitToSetup(): void {
    this.stopLoop();
    this.gameState = 'setup';
    this.showGameOverModal = false;
  }
  startNewGame(): void {
    this.showGameOverModal = false;
    this.startGame();
  }

  // ===================== input =====================
  @HostListener('window:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (['w', 's', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
    if (k === ' ' && (this.gameState === 'playing' || this.gameState === 'paused')) this.pauseGame();
  }
  @HostListener('window:keyup', ['$event'])
  onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key.toLowerCase());
  }

  private attachPointer(): void {
    const cv = this.canvas;
    if (!cv) return;
    this.zone.runOutsideAngular(() => {
      cv.addEventListener('pointerdown', this.onPointer, { passive: true });
      cv.addEventListener('pointermove', this.onPointer, { passive: true });
      cv.addEventListener('pointerup', this.onPointerUp, { passive: true });
      cv.addEventListener('pointercancel', this.onPointerUp, { passive: true });
    });
  }
  private onPointer = (e: PointerEvent): void => {
    const cv = this.canvas;
    if (!cv) return;
    // only a press grabs a paddle — plain mouse hover must not hijack the keyboard
    if (e.type === 'pointermove' && !this.pointers.has(e.pointerId)) return;
    const rect = cv.getBoundingClientRect();
    const ix = ((e.clientX - rect.left) / rect.width) * this.W;
    const iy = ((e.clientY - rect.top) / rect.height) * this.H;
    let paddle = this.pointers.get(e.pointerId);
    if (paddle == null) {
      if (e.type !== 'pointerdown') return;
      paddle = this.mode === 'ai' ? 1 : ix < this.W / 2 ? 1 : 2;
      this.pointers.set(e.pointerId, paddle);
    }
    this.touchTarget[paddle] = this.clampPaddle(iy - this.PADDLE_H / 2);
  };
  private onPointerUp = (e: PointerEvent): void => {
    const paddle = this.pointers.get(e.pointerId);
    if (paddle != null) {
      this.touchTarget[paddle] = null;
      this.pointers.delete(e.pointerId);
    }
  };

  // ===================== ui =====================
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
