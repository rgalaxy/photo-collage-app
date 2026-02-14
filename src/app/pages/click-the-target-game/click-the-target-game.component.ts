import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';
import { interval, Subscription, timer } from 'rxjs';
import { SupabaseService } from '../../services/supabase.service';

interface Target {
  id: number;
  x: number; // percentage from left
  y: number; // percentage from top
  size: number; // pixels
  timeLeft: number; // milliseconds
  isClicked: boolean;
}

interface FloatingScore {
  id: number;
  x: number; // percentage from left
  y: number; // percentage from top
  points: number;
}

interface HighScore {
  id?: number;
  screen_name: string;
  score: number;
  created_at: string;
  item_name: string;
}

interface ClickTargetScore {
  id?: number;
  player_name: string;
  scores: number;
  accuracy: number;
  max_combo: number;
  created_at: string;
}

type DifficultyLevel = 'easy' | 'medium' | 'hard';

interface DifficultyConfig {
  gameTime: number;
  targetLifetime: number;
  targetSpawnRate: number;
  targetSize: number;
  maxTargets: number;
}

@Component({
    selector: 'app-click-the-target-game',
    imports: [CommonModule, FormsModule],
    templateUrl: './click-the-target-game.component.html',
    styleUrl: './click-the-target-game.component.scss',
    animations: [
        trigger('targetAnimation', [
            state('appear', style({
                transform: 'scale(1)',
                opacity: 1
            })),
            state('disappear', style({
                transform: 'scale(0)',
                opacity: 0
            })),
            transition('void => appear', [
                style({ transform: 'scale(0)', opacity: 0 }),
                animate('200ms ease-out', style({ transform: 'scale(1.2)', opacity: 1 })),
                animate('100ms ease-in', style({ transform: 'scale(1)' }))
            ]),
            transition('appear => disappear', [
                animate('150ms ease-in', style({ transform: 'scale(0)', opacity: 0 }))
            ]),
            transition('* => clicked', [
                animate('200ms ease-out', keyframes([
                    style({ transform: 'scale(1.3)', background: '#10b981', offset: 0.5 }),
                    style({ transform: 'scale(0)', opacity: 0, offset: 1.0 })
                ]))
            ])
        ]),
        trigger('fadeInOut', [
            transition(':enter', [
                style({ opacity: 0, transform: 'translateY(-10px)' }),
                animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
            ]),
            transition(':leave', [
                animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
            ])
        ]),
        trigger('targetClick', [
            state('normal', style({
                transform: 'translate(-50%, -50%) scale(1)',
                opacity: 1
            })),
            state('clicked', style({
                transform: 'translate(-50%, -50%) scale(0)',
                opacity: 0
            })),
            transition('normal => clicked', [
                animate('300ms ease-out', keyframes([
                    style({ transform: 'translate(-50%, -50%) scale(1.5)', background: '#10b981', offset: 0.3 }),
                    style({ transform: 'translate(-50%, -50%) scale(1.8)', opacity: 0.8, offset: 0.6 }),
                    style({ transform: 'translate(-50%, -50%) scale(0)', opacity: 0, offset: 1.0 })
                ]))
            ])
        ]),
        trigger('floatingScore', [
            transition(':enter', [
                style({
                    transform: 'translate(-50%, -50%) scale(0.8)',
                    opacity: 1
                }),
                animate('1000ms ease-out', keyframes([
                    style({
                        transform: 'translate(-50%, -50%) scale(1.2)',
                        opacity: 1,
                        offset: 0.2
                    }),
                    style({
                        transform: 'translate(-50%, -100px) scale(1)',
                        opacity: 0.8,
                        offset: 0.7
                    }),
                    style({
                        transform: 'translate(-50%, -150px) scale(0.8)',
                        opacity: 0,
                        offset: 1.0
                    })
                ]))
            ])
        ])
    ]
})
export class ClickTheTargetGameComponent implements OnInit, OnDestroy {
  // Game state
  gameActive = false;
  gameOver = false;
  score = 0;
  hits = 0;
  misses = 0;
  timeRemaining = 30;
  playerName = '';
  
  // Game configuration
  difficulty: DifficultyLevel = 'medium';
  difficultyConfigs: Record<DifficultyLevel, DifficultyConfig> = {
    easy: {
      gameTime: 45,
      targetLifetime: 2000,
      targetSpawnRate: 1500,
      targetSize: 60,
      maxTargets: 3
    },
    medium: {
      gameTime: 30,
      targetLifetime: 1500,
      targetSpawnRate: 1000,
      targetSize: 50,
      maxTargets: 4
    },
    hard: {
      gameTime: 20,
      targetLifetime: 1400,
      targetSpawnRate: 300,
      targetSize: 50,
      maxTargets: 5
    }
  };
  
  // Targets
  targets: Target[] = [];
  private targetIdCounter = 0;
  
  // Floating scores
  floatingScores: FloatingScore[] = [];
  private scoreIdCounter = 0;
  
  // Combo system
  combo = 0;
  maxCombo = 0;
  comboMultiplier = 1;
  lastHitTime = 0;
  comboTimeout = 2000; // 2 seconds to maintain combo
  
  // Timers and subscriptions
  private gameTimer?: Subscription;
  private targetSpawner?: Subscription;
  private targetUpdater?: Subscription;
  
  // UI state
  showHowToPlay = false;
  showHighScores = false;
  showGameOverModal = false;
  showDifficultySelector = false;
  highScores: ClickTargetScore[] = [];
  
  // Toast notifications
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' }[] = [];
  private toastIdCounter = 0;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit() {
    this.loadHighScores();
    this.resetGameState();
  }

  ngOnDestroy() {
    this.stopGame();
  }

  resetGameState() {
    this.gameActive = false;
    this.gameOver = false;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboMultiplier = 1;
    this.timeRemaining = 30;
    this.targets = [];
    this.toasts = [];
    this.showGameOverModal = false;
    
    // Clear any existing timers
    this.gameTimer?.unsubscribe();
    this.targetSpawner?.unsubscribe();
    this.targetUpdater?.unsubscribe();
  }

  async loadHighScores() {
    try {
      const allHighScores = await this.supabaseService.getClickTargetHighScores(10) || [];
      this.highScores = allHighScores;
    } catch (error) {
      console.error('Error loading high scores:', error);
      // Don't show toast for auth lock errors, they're usually temporary
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('NavigatorLockAcquireTimeoutError')) {
        this.showToast('Failed to load high scores', 'error');
      }
    }
  }

  startGame() {
    if (!this.playerName.trim()) {
      this.showToast('Please enter your name first!', 'error');
      return;
    }

    console.log('Starting game with difficulty:', this.difficulty);
    const config = this.difficultyConfigs[this.difficulty];
    console.log('Game config:', config);
    
    // Clear any existing timers first (before setting game state)
    this.gameTimer?.unsubscribe();
    this.targetSpawner?.unsubscribe();
    this.targetUpdater?.unsubscribe();
    
    // Reset game state
    this.gameActive = true;
    this.gameOver = false;
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.comboMultiplier = 1;
    this.timeRemaining = config.gameTime;
    this.targets = [];
    this.toasts = [];
    
    console.log('Game state set - gameActive:', this.gameActive);
    console.log('Setting up timers...');
    
    // Wait for Angular to render the game area, then start the game mechanics
    setTimeout(() => {
      console.log('DOM updated, starting game mechanics...');
      console.log('Initial targets array:', this.targets);
      console.log('gameActive is still:', this.gameActive);
      
      // Start game timer
      this.gameTimer = interval(1000).subscribe(() => {
        this.timeRemaining--;
        console.log('Time remaining:', this.timeRemaining);
        if (this.timeRemaining <= 0) {
          this.endGame();
        }
      });
      
      // Start target spawner
      this.targetSpawner = interval(config.targetSpawnRate).subscribe(() => {
        console.log('Target spawner tick, current targets:', this.targets.length, 'max:', config.maxTargets);
        if (this.targets.length < config.maxTargets) {
          this.spawnTarget();
          console.log('After spawn - targets array:', this.targets);
        }
      });
      
      // Start target updater (checks for expired targets)
      this.targetUpdater = interval(50).subscribe(() => {
        this.updateTargets();
        this.updateCombo();
      });
      
      // Spawn first target immediately
      console.log('Spawning initial target...');
      this.spawnTarget();
      console.log('After initial spawn - targets array:', this.targets);
      
      this.showToast(`Game started on ${this.difficulty} difficulty!`, 'success');
    }, 200); // Increased timeout to ensure DOM is ready
  }

  stopGame() {
    // Only stop timers, don't change game state
    this.gameTimer?.unsubscribe();
    this.targetSpawner?.unsubscribe();
    this.targetUpdater?.unsubscribe();
  }

  async endGame() {
    this.stopGame();
    this.gameActive = false; // Now we properly set gameActive to false
    this.gameOver = true;
    
    // Submit score to Supabase
    if (this.score > 0) {
      try {
        await this.supabaseService.insertClickTargetScore(
          this.playerName,
          this.score,
          this.getAccuracy(),
          this.maxCombo
        );
        await this.loadHighScores();
        this.showToast('Score submitted successfully!', 'success');
      } catch (error) {
        console.error('Error submitting score:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('NavigatorLockAcquireTimeoutError')) {
          this.showToast('Failed to submit score', 'error');
        }
      }
    }
    
    this.showGameOverModal = true;
  }

  spawnTarget() {
    const config = this.difficultyConfigs[this.difficulty];
    
    console.log('Spawning target - current targets count:', this.targets.length);
    
    // Instead of querying DOM, use percentage-based positioning
    // This works because our CSS uses percentages for positioning
    const padding = 5; // Reduced padding to 5% from edges
    
    const target: Target = {
      id: this.targetIdCounter++,
      x: Math.random() * (100 - (padding * 2)) + padding, // 5% to 95%
      y: Math.random() * (100 - (padding * 2)) + padding, // 5% to 95%
      size: config.targetSize,
      timeLeft: config.targetLifetime,
      isClicked: false
    };
    
    console.log('Created target:', target);
    console.log(`Target position: x=${target.x}%, y=${target.y}%, size=${target.size}px`);
    this.targets.push(target);
    console.log('Targets after push:', this.targets.length);
    console.log('Current targets array:', this.targets);
  }

  updateTargets() {
    const now = Date.now();
    this.targets = this.targets.filter(target => {
      if (target.isClicked) return false;
      
      target.timeLeft -= 50;
      if (target.timeLeft <= 0) {
        this.misses++;
        this.resetCombo();
        return false;
      }
      return true;
    });
  }

  updateCombo() {
    const now = Date.now();
    if (this.combo > 0 && now - this.lastHitTime > this.comboTimeout) {
      this.resetCombo();
    }
  }

  clickTarget(target: Target, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    if (!this.gameActive || target.isClicked) return;
    
    target.isClicked = true;
    this.hits++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastHitTime = Date.now();
    
    // Calculate combo multiplier
    this.comboMultiplier = Math.min(1 + Math.floor(this.combo / 5) * 0.5, 3);
    const points = Math.floor(1 * this.comboMultiplier);
    this.score += points;
    
    // Create floating score text
    this.createFloatingScore(target.x, target.y, points);
    
    // Remove target after animation completes
    setTimeout(() => {
      this.targets = this.targets.filter(t => t.id !== target.id);
    }, 300);
  }

  createFloatingScore(x: number, y: number, points: number) {
    const floatingScore: FloatingScore = {
      id: this.scoreIdCounter++,
      x: x,
      y: y,
      points: points
    };
    
    this.floatingScores.push(floatingScore);
    
    // Remove floating score after animation completes
    setTimeout(() => {
      this.floatingScores = this.floatingScores.filter(s => s.id !== floatingScore.id);
    }, 1000);
  }

  resetCombo() {
    if (this.combo > 0) {
      this.combo = 0;
      this.comboMultiplier = 1;
    }
  }

  clickGameArea(event: MouseEvent) {
    // Only reset combo if clicking empty area during active game
    if (this.gameActive && event.target === event.currentTarget) {
      this.resetCombo();
    }
  }

  // Difficulty selection
  selectDifficulty(difficulty: DifficultyLevel) {
    this.difficulty = difficulty;
    this.showDifficultySelector = false;
    this.showToast(`Difficulty set to ${difficulty}`, 'info');
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
    this.gameOver = false; // Reset gameOver state to show setup screen
  }

  startNewGame() {
    this.closeGameOverModal();
    this.gameOver = false;
    this.startGame();
  }

  // Utility methods
  getAccuracy(): number {
    const totalClicks = this.hits + this.misses;
    return totalClicks > 0 ? Math.round((this.hits / totalClicks) * 100) : 0;
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getDifficultyColor(difficulty: string): string {
    switch (difficulty) {
      case 'easy': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'hard': return 'text-red-600';
      default: return 'text-gray-600';
    }
  }

  getDifficultyDescription(difficulty: DifficultyLevel): string {
    const config = this.difficultyConfigs[difficulty];
    return `${config.gameTime}s game, ${config.targetLifetime/1000}s target lifetime`;
  }

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

  trackByTargetId(index: number, target: Target): number {
    return target.id;
  }

  trackByScoreId(index: number, score: FloatingScore): number {
    return score.id;
  }

  // Helper method for template to properly type cast difficulty levels
  getDifficultyLevels(): DifficultyLevel[] {
    return ['easy', 'medium', 'hard'];
  }
}
