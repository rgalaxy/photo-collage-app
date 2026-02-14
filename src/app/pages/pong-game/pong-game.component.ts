import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { SupabaseService } from '../../services/supabase.service';

interface PongScore {
  id?: number;
  player1_name: string;
  player2_name: string;
  player1_score: number;
  player2_score: number;
  winner: string;
  game_duration: number;
  created_at: string;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface Paddle {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

type GameState = 'setup' | 'playing' | 'paused' | 'gameOver';

@Component({
    selector: 'app-pong-game',
    imports: [CommonModule, FormsModule],
    templateUrl: './pong-game.component.html',
    styleUrl: './pong-game.component.scss',
    animations: [
        trigger('fadeInOut', [
            transition(':enter', [
                style({ opacity: 0, transform: 'translateY(-10px)' }),
                animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
            ]),
            transition(':leave', [
                animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
            ])
        ]),
        trigger('slideIn', [
            transition(':enter', [
                style({ transform: 'translateX(-100%)' }),
                animate('400ms ease-out', style({ transform: 'translateX(0)' }))
            ])
        ])
    ]
})
export class PongGameComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('gameCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  // Game state
  gameState: GameState = 'setup';
  player1Name = '';
  player2Name = '';
  player1Score = 0;
  player2Score = 0;
  winner = '';
  maxScore = 5;
  gameStartTime = 0;
  
  // Canvas and game objects
  private ctx!: CanvasRenderingContext2D;
  private animationId!: number;
  private canvas!: HTMLCanvasElement;
  
  // Game objects
  ball!: Ball;
  paddle1!: Paddle;
  paddle2!: Paddle;
  particles: Particle[] = [];
  
  // Game settings
  private readonly CANVAS_WIDTH = 800;
  private readonly CANVAS_HEIGHT = 400;
  private readonly PADDLE_WIDTH = 12;
  private readonly PADDLE_HEIGHT = 80;
  private readonly BALL_RADIUS = 8;
  private readonly PADDLE_SPEED = 5;
  private readonly BALL_SPEED_INCREASE = 0.05;
  
  // Input handling
  private keys: Set<string> = new Set();
  
  // UI state
  showHowToPlay = false;
  showHighScores = false;
  showGameOverModal = false;
  highScores: PongScore[] = [];
  
  // Toast notifications
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' }[] = [];
  private toastIdCounter = 0;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit() {
    this.loadHighScores();
  }

  ngOnDestroy() {
    this.stopGame();
  }

  ngAfterViewInit() {
    if (this.canvasRef) {
      this.canvas = this.canvasRef.nativeElement;
      this.ctx = this.canvas.getContext('2d')!;
      this.initializeGame();
    }
  }

  private initializeGame() {
    // Set canvas size
    this.canvas.width = this.CANVAS_WIDTH;
    this.canvas.height = this.CANVAS_HEIGHT;
    
    // Initialize game objects
    this.resetGameObjects();
  }

  private resetGameObjects() {
    // Reset ball
    this.ball = {
      x: this.CANVAS_WIDTH / 2,
      y: this.CANVAS_HEIGHT / 2,
      vx: Math.random() > 0.5 ? 4 : -4,
      vy: (Math.random() - 0.5) * 4,
      radius: this.BALL_RADIUS
    };

    // Reset paddles
    this.paddle1 = {
      x: 20,
      y: this.CANVAS_HEIGHT / 2 - this.PADDLE_HEIGHT / 2,
      width: this.PADDLE_WIDTH,
      height: this.PADDLE_HEIGHT,
      vx: 0,
      vy: 0
    };

    this.paddle2 = {
      x: this.CANVAS_WIDTH - 20 - this.PADDLE_WIDTH,
      y: this.CANVAS_HEIGHT / 2 - this.PADDLE_HEIGHT / 2,
      width: this.PADDLE_WIDTH,
      height: this.PADDLE_HEIGHT,
      vx: 0,
      vy: 0
    };

    this.particles = [];
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    this.keys.add(event.key.toLowerCase());
    
    // Prevent default for game keys
    if (['w', 's', 'arrowup', 'arrowdown', ' '].includes(event.key.toLowerCase())) {
      event.preventDefault();
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    this.keys.delete(event.key.toLowerCase());
  }

  async loadHighScores() {
    try {
      this.highScores = await this.supabaseService.getPongHighScores(10);
      console.log('High scores loaded:', this.highScores);
    } catch (error) {
      console.error('Error loading high scores:', error);
      this.highScores = [];
      this.showToast('Failed to load high scores', 'error');
    }
  }

  startGame() {
    if (!this.player1Name.trim() || !this.player2Name.trim()) {
      this.showToast('Please enter both player names!', 'error');
      return;
    }

    this.gameState = 'playing';
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameStartTime = Date.now();
    this.resetGameObjects();
    
    // Ensure canvas is initialized
    setTimeout(() => {
      if (this.canvasRef) {
        this.canvas = this.canvasRef.nativeElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.initializeGame();
        this.gameLoop();
      }
    }, 100);
    
    this.showToast('Game started! Good luck!', 'success');
  }

  private gameLoop() {
    if (this.gameState !== 'playing' || !this.ctx || !this.canvas) return;

    this.update();
    this.render();
    
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  private update() {
    this.updatePaddles();
    this.updateBall();
    this.updateParticles();
    this.checkGameEnd();
  }

  private updatePaddles() {
    // Player 1 controls (W/S)
    if (this.keys.has('w')) {
      this.paddle1.y = Math.max(0, this.paddle1.y - this.PADDLE_SPEED);
    }
    if (this.keys.has('s')) {
      this.paddle1.y = Math.min(this.CANVAS_HEIGHT - this.PADDLE_HEIGHT, this.paddle1.y + this.PADDLE_SPEED);
    }

    // Player 2 controls (Arrow Up/Down)
    if (this.keys.has('arrowup')) {
      this.paddle2.y = Math.max(0, this.paddle2.y - this.PADDLE_SPEED);
    }
    if (this.keys.has('arrowdown')) {
      this.paddle2.y = Math.min(this.CANVAS_HEIGHT - this.PADDLE_HEIGHT, this.paddle2.y + this.PADDLE_SPEED);
    }
  }

  private updateBall() {
    // Move ball
    this.ball.x += this.ball.vx;
    this.ball.y += this.ball.vy;

    // Ball collision with top/bottom walls
    if (this.ball.y <= this.ball.radius || this.ball.y >= this.CANVAS_HEIGHT - this.ball.radius) {
      this.ball.vy = -this.ball.vy;
      this.createParticles(this.ball.x, this.ball.y, '#60a5fa');
    }

    // Ball collision with paddles
    this.checkPaddleCollision();

    // Ball out of bounds (scoring)
    if (this.ball.x < 0) {
      this.player2Score++;
      this.createParticles(this.ball.x, this.ball.y, '#ef4444');
      this.resetBall();
    } else if (this.ball.x > this.CANVAS_WIDTH) {
      this.player1Score++;
      this.createParticles(this.ball.x, this.ball.y, '#10b981');
      this.resetBall();
    }
  }

  private checkPaddleCollision() {
    // Paddle 1 collision
    if (this.ball.x - this.ball.radius <= this.paddle1.x + this.paddle1.width &&
        this.ball.x + this.ball.radius >= this.paddle1.x &&
        this.ball.y >= this.paddle1.y &&
        this.ball.y <= this.paddle1.y + this.paddle1.height &&
        this.ball.vx < 0) {
      
      this.ball.vx = -this.ball.vx * (1 + this.BALL_SPEED_INCREASE);
      this.ball.x = this.paddle1.x + this.paddle1.width + this.ball.radius;
      
      // Add vertical component based on where ball hits paddle
      const relativeIntersectY = (this.ball.y - (this.paddle1.y + this.paddle1.height / 2)) / (this.paddle1.height / 2);
      this.ball.vy = relativeIntersectY * 5;
      
      this.createParticles(this.ball.x, this.ball.y, '#fbbf24');
    }

    // Paddle 2 collision
    if (this.ball.x + this.ball.radius >= this.paddle2.x &&
        this.ball.x - this.ball.radius <= this.paddle2.x + this.paddle2.width &&
        this.ball.y >= this.paddle2.y &&
        this.ball.y <= this.paddle2.y + this.paddle2.height &&
        this.ball.vx > 0) {
      
      this.ball.vx = -this.ball.vx * (1 + this.BALL_SPEED_INCREASE);
      this.ball.x = this.paddle2.x - this.ball.radius;
      
      // Add vertical component based on where ball hits paddle
      const relativeIntersectY = (this.ball.y - (this.paddle2.y + this.paddle2.height / 2)) / (this.paddle2.height / 2);
      this.ball.vy = relativeIntersectY * 5;
      
      this.createParticles(this.ball.x, this.ball.y, '#fbbf24');
    }
  }

  private resetBall() {
    this.ball.x = this.CANVAS_WIDTH / 2;
    this.ball.y = this.CANVAS_HEIGHT / 2;
    this.ball.vx = Math.random() > 0.5 ? 4 : -4;
    this.ball.vy = (Math.random() - 0.5) * 4;
    
    // Brief pause before ball starts moving
    setTimeout(() => {
      // Ball movement will resume in next update
    }, 1000);
  }

  private createParticles(x: number, y: number, color: string) {
    for (let i = 0; i < 8; i++) {
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 30,
        maxLife: 30,
        size: Math.random() * 4 + 2,
        color: color
      });
    }
  }

  private updateParticles() {
    this.particles = this.particles.filter(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life--;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      return particle.life > 0;
    });
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    
    // Clear canvas
    this.ctx.fillStyle = '#0f172a';
    this.ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    // Draw center line
    this.ctx.setLineDash([10, 10]);
    this.ctx.strokeStyle = '#334155';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.CANVAS_WIDTH / 2, 0);
    this.ctx.lineTo(this.CANVAS_WIDTH / 2, this.CANVAS_HEIGHT);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Draw paddles
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.fillRect(this.paddle1.x, this.paddle1.y, this.paddle1.width, this.paddle1.height);
    this.ctx.fillRect(this.paddle2.x, this.paddle2.y, this.paddle2.width, this.paddle2.height);

    // Draw ball
    this.ctx.fillStyle = '#f8fafc';
    this.ctx.beginPath();
    this.ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw particles
    this.particles.forEach(particle => {
      const alpha = particle.life / particle.maxLife;
      this.ctx.fillStyle = particle.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, particle.size * alpha, 0, Math.PI * 2);
      this.ctx.fill();
    });

    // Draw scores
    this.ctx.fillStyle = '#e2e8f0';
    this.ctx.font = 'bold 36px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(this.player1Score.toString(), this.CANVAS_WIDTH / 4, 60);
    this.ctx.fillText(this.player2Score.toString(), (3 * this.CANVAS_WIDTH) / 4, 60);
  }

  private checkGameEnd() {
    if (this.player1Score >= this.maxScore || this.player2Score >= this.maxScore) {
      this.endGame();
    }
  }

  private async endGame() {
    this.stopGame();
    this.gameState = 'gameOver';
    this.winner = this.player1Score >= this.maxScore ? this.player1Name : this.player2Name;
    
    // Calculate game duration
    const gameDuration = Math.floor((Date.now() - this.gameStartTime) / 1000);
    
    // Save score to database
    try {
      await this.supabaseService.insertPongScore(
        this.player1Name,
        this.player2Name,
        this.player1Score,
        this.player2Score,
        this.winner,
        gameDuration
      );
      console.log('Game score saved successfully');
    } catch (error) {
      console.error('Error saving game score:', error);
      this.showToast('Failed to save game score', 'error');
    }
    
    this.showGameOverModal = true;
    this.showToast(`${this.winner} wins!`, 'success');
  }

  private stopGame() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  pauseGame() {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
      this.stopGame();
    } else if (this.gameState === 'paused') {
      this.gameState = 'playing';
      this.gameLoop();
    }
  }

  resetGame() {
    this.gameState = 'setup';
    this.player1Score = 0;
    this.player2Score = 0;
    this.winner = '';
    this.stopGame();
    this.resetGameObjects();
  }

  // Modal controls
  toggleHowToPlay() {
    this.showHowToPlay = !this.showHowToPlay;
  }

  toggleHighScores() {
    this.showHighScores = !this.showHighScores;
    if (this.showHighScores) {
      this.loadHighScores();
    }
  }

  closeGameOverModal() {
    this.showGameOverModal = false;
    this.resetGame();
  }

  startNewGame() {
    this.closeGameOverModal();
    this.startGame();
  }

  // Utility methods
  showToast(message: string, type: 'success' | 'error' | 'info') {
    const toast = {
      id: this.toastIdCounter++,
      message,
      type
    };
    this.toasts.push(toast);
    
    setTimeout(() => {
      this.removeToast(toast.id);
    }, 3000);
  }

  removeToast(id: number) {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
  }

  getToastClass(type: string): string {
    switch (type) {
      case 'success': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  }

  getGameDuration(): string {
    if (this.gameState === 'setup') return '0:00';
    const seconds = Math.floor((Date.now() - this.gameStartTime) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
