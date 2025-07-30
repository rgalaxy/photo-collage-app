import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

interface Weapon {
  id: string;
  name: string;
  baseScore: number;
}

interface WeaponInstance {
  weapon: Weapon;
  refinement: number; // 0 to 15
  quality: string; // 'basic', 'mediocre', 'decent', 'well-made', 'exceptional'
  elements: string[]; // array of elements
}

@Component({
  selector: 'app-mini-game-blacksmith',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mini-game-blacksmith.component.html',
  styleUrl: './mini-game-blacksmith.component.scss'
})
export class MiniGameBlacksmithComponent implements OnInit {
  // Game state
  score = 0;
  playerName = '';
  gameActive = false;
  gameTime = 90;
  timeRemaining = 90;
  showFinishConfirmation = false;
  
  // Game over state
  gameOver = false;
  gameOverReason = '';
  showGameOverModal = false;
  
  // How to play modal
  showHowToPlayModal = false;
  
  // Cooldown timers
  qualityImproveLastUsed = 0;
  elementAddLastUsed: { [key: string]: number } = {};
  refinementLastUsed = 0;
  
  // Available weapons
  weapons: Weapon[] = [
    { id: 'dagger', name: 'Dagger', baseScore: 10 },
    { id: 'sword', name: 'Sword', baseScore: 20 },
    { id: 'axe', name: 'Axe', baseScore: 25 },
    { id: 'bow', name: 'Bow', baseScore: 15 },
    { id: 'staff', name: 'Staff', baseScore: 30 }
  ];

  // Current weapon being forged
  currentWeapon: WeaponInstance | null = null;
  selectedWeaponId = '';

  // Quality levels
  qualityLevels = ['basic', 'mediocre', 'decent', 'well-made', 'exceptional'];
  
  // Elements
  elements = ['fire', 'earth', 'water', 'wind'];
  selectedElement = '';

  // Configuration for success rates and scoring
  config = {
    refinement: {
      // Exponential decay formula: high chances 1-10, big punishment 11+
      scoreMultiplier: 10, // Score per refinement level
      safeRefinementCooldown: 3 // 3 seconds cooldown for safe zone (levels 1-8)
    },
    quality: {
      successRates: {
        basic: 80,
        mediocre: 65,
        decent: 50,
        'well-made': 30,
        exceptional: 15
      },
      scoreMultipliers: {
        basic: 1,
        mediocre: 2,
        decent: 4,
        'well-made': 8,
        exceptional: 16
      },
      cooldownSeconds: 30 // 30 seconds cooldown
    },
    element: {
      baseSuccessRate: 70, // Base 70% for first element
      decreaseRate: 15, // Decrease 15% per existing element
      scoreMultiplier: 25, // Score per element
      cooldownSeconds: 10 // 10 seconds cooldown per element
    }
  };
  
  // High scores
  showHighScores = false;
  highScores: any[] = [];
  
  // Game timer
  private gameTimer: any;

  // Last action result
  lastActionResult: { success: boolean; message: string } | null = null;

  // Toast notifications
  toasts: { id: number; message: string; success: boolean }[] = [];
  private toastIdCounter = 0;

  constructor(private supabaseService: SupabaseService) {}

  ngOnInit() {
    this.loadHighScores();
  }

  async loadHighScores() {
    const allHighScores = await this.supabaseService.getHighScores() || [];
    // Only show top 7 scores
    this.highScores = allHighScores.slice(0, 7);
  }

  startGame() {
    if (!this.playerName.trim()) {
      alert('Please enter your name first!');
      return;
    }
    
    this.gameActive = true;
    this.score = 0;
    this.timeRemaining = this.gameTime;
    this.currentWeapon = null;
    this.selectedWeaponId = '';
    this.selectedElement = '';
    this.lastActionResult = null;
    this.toasts = []; // Clear all toasts
    this.gameOver = false; // Reset game over state
    this.showFinishConfirmation = false; // Reset finish confirmation
    
    // Reset all cooldowns to ensure no disabled states
    this.qualityImproveLastUsed = 0;
    this.elementAddLastUsed = {};
    this.refinementLastUsed = 0;
    
    // Clear any existing timer
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }
    
    this.gameTimer = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 0) {
        this.endGame();
      }
    }, 1000);
  }

  async endGame(reason: string = 'Time up!', penaltyForBreaking: boolean = false) {
    this.gameActive = false;
    this.gameOver = true;
    this.gameOverReason = reason;
    clearInterval(this.gameTimer);
    
    if (this.score > 0) {
      const itemName = this.currentWeapon ? this.getWeaponDisplayName() : 'No item forged';
      // Apply penalty only when weapon breaks during refinement
      const submittedScore = penaltyForBreaking ? Math.floor(this.score * 0.75) : this.score;
      await this.supabaseService.insertHighScore(this.playerName, submittedScore, itemName);
      await this.loadHighScores();
    }
    
    // Show game over modal immediately
    this.showGameOverModal = true;
  }

  closeGameOverModal() {
    this.showGameOverModal = false;
    // Reset game active state when closing modal to return to setup screen
    this.gameActive = false;
  }

  startNewGame() {
    this.showGameOverModal = false;
    this.gameOver = false;
    this.gameActive = false; // Will be set to true in startGame()
    this.gameOverReason = '';
    this.score = 0;
    this.currentWeapon = null;
    this.selectedWeaponId = '';
    this.selectedElement = '';
    this.lastActionResult = null;
    this.timeRemaining = this.gameTime;
    this.showFinishConfirmation = false;
    this.qualityImproveLastUsed = 0;
    this.elementAddLastUsed = {};
    this.refinementLastUsed = 0;
    this.toasts = []; // Clear all toasts
    
    // Clear any existing timer
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
    }
    
    this.startGame();
  }

  finishForging() {
    this.showFinishConfirmation = true;
  }

  confirmFinishForging() {
    this.showFinishConfirmation = false;
    this.endGame('Finished forging');
  }

  cancelFinishForging() {
    this.showFinishConfirmation = false;
  }

  toggleHighScores() {
    this.showHighScores = !this.showHighScores;
  }

  openHowToPlayModal() {
    this.showHowToPlayModal = true;
  }

  closeHowToPlayModal() {
    this.showHowToPlayModal = false;
  }

  selectWeapon() {
    if (!this.selectedWeaponId) return;
    
    const weapon = this.weapons.find(w => w.id === this.selectedWeaponId);
    if (weapon) {
      this.currentWeapon = {
        weapon,
        refinement: 0,
        quality: 'basic',
        elements: []
      };
      this.lastActionResult = null;
    }
  }

  refineWeapon() {
    if (!this.currentWeapon || this.currentWeapon.refinement >= 15) return;

    // Check if refinement is on cooldown (for safe refinement levels 1-8)
    const now = Date.now();
    const timeSinceLastUse = (now - this.refinementLastUsed) / 1000;
    if (this.currentWeapon.refinement <= 8 && timeSinceLastUse < this.config.refinement.safeRefinementCooldown) {
      const remainingTime = Math.ceil(this.config.refinement.safeRefinementCooldown - timeSinceLastUse);
      this.showToast(`Refinement on cooldown! Wait ${remainingTime} seconds.`, false);
      return;
    }

    // Exponential decay formula: high chances 1-10, big punishment 11+
    let successRate: number;
    if (this.currentWeapon.refinement <= 10) {
      // High success rate for levels 1-10: starts at 95% for +1, gradually decreases
      successRate = 95 - (this.currentWeapon.refinement * 3);
    } else {
      // Big punishment for 11+: exponential decay
      const punishmentLevel = this.currentWeapon.refinement - 10;
      successRate = Math.max(5, 65 - Math.pow(punishmentLevel, 2.5) * 10);
    }
    
    const success = Math.random() * 100 < successRate;
    
    if (success) {
      this.currentWeapon.refinement++;
      const scoreGained = this.config.refinement.scoreMultiplier * this.currentWeapon.refinement;
      this.score += scoreGained;
      this.showToast(`Success! Weapon refined to +${this.currentWeapon.refinement}! (+${scoreGained} points)`, true);
    } else {
      // Special handling for refinement levels 1-8: weapon cannot break, but goes on cooldown
      if (this.currentWeapon.refinement <= 8) {
        this.showToast(`Failed! Safe refinement (${this.currentWeapon.refinement}/8) - weapon did not break! 3s cooldown applied.`, false);
        this.refinementLastUsed = now;
      } else {
        // At +9 and above, weapon can break and end the game
        this.showToast('Failed! Weapon broke! Game ended!', false);
        
        // End game immediately when weapon breaks with penalty
        setTimeout(() => {
          this.endGame('Weapon broke during refinement!', true);
        }); // Give time to show the failure message
      }
    }
  }

  improveQuality() {
    if (!this.currentWeapon) return;

    const currentQualityIndex = this.qualityLevels.indexOf(this.currentWeapon.quality);
    if (currentQualityIndex >= this.qualityLevels.length - 1) return;

    // Check 30-second cooldown
    const now = Date.now();
    const timeSinceLastUse = (now - this.qualityImproveLastUsed) / 1000;
    if (timeSinceLastUse < this.config.quality.cooldownSeconds) {
      const remainingTime = Math.ceil(this.config.quality.cooldownSeconds - timeSinceLastUse);
      this.showToast(`Quality improvement on cooldown! Wait ${remainingTime} seconds.`, false);
      return;
    }

    const nextQuality = this.qualityLevels[currentQualityIndex + 1];
    const successRate = this.config.quality.successRates[nextQuality as keyof typeof this.config.quality.successRates];
    
    const success = Math.random() * 100 < successRate;
    
    // Update last used time regardless of success/failure
    this.qualityImproveLastUsed = now;
    
    if (success) {
      this.currentWeapon.quality = nextQuality;
      const scoreMultiplier = this.config.quality.scoreMultipliers[nextQuality as keyof typeof this.config.quality.scoreMultipliers];
      const scoreGained = this.currentWeapon.weapon.baseScore * scoreMultiplier;
      this.score += scoreGained;
      this.showToast(`Success! Quality improved to ${nextQuality}! (+${scoreGained} points)`, true);
    } else {
      this.showToast('Failed! Quality improvement failed!', false);
    }
  }

  addElement() {
    if (!this.currentWeapon || !this.selectedElement || this.currentWeapon.refinement < 5) return;
    
    if (this.currentWeapon.elements.includes(this.selectedElement)) {
      this.showToast('This element is already applied to the weapon!', false);
      return;
    }

    // Check 10-second cooldown per element
    const now = Date.now();
    const lastUsed = this.elementAddLastUsed[this.selectedElement] || 0;
    const timeSinceLastUse = (now - lastUsed) / 1000;
    if (timeSinceLastUse < this.config.element.cooldownSeconds) {
      const remainingTime = Math.ceil(this.config.element.cooldownSeconds - timeSinceLastUse);
      this.showToast(`${this.selectedElement} element on cooldown! Wait ${remainingTime} seconds.`, false);
      return;
    }

    const successRate = Math.max(
      10,
      this.config.element.baseSuccessRate - (this.currentWeapon.elements.length * this.config.element.decreaseRate)
    );
    
    const success = Math.random() * 100 < successRate;
    
    // Update last used time for this element regardless of success/failure
    this.elementAddLastUsed[this.selectedElement] = now;
    
    if (success) {
      this.currentWeapon.elements.push(this.selectedElement);
      const scoreGained = this.config.element.scoreMultiplier * this.currentWeapon.elements.length;
      this.score += scoreGained;
      this.showToast(`Success! ${this.selectedElement} element added! (+${scoreGained} points)`, true);
      this.selectedElement = '';
    } else {
      this.showToast(`Failed! ${this.selectedElement} element was not added!`, false);
    }
  }

  getWeaponDisplayName(): string {
    if (!this.currentWeapon) return '';
    
    let name = '';
    
    // Add quality prefix (except for basic)
    if (this.currentWeapon.quality !== 'basic') {
      name += this.currentWeapon.quality + ' ';
    }
    
    // Add weapon name
    name += this.currentWeapon.weapon.name.toLowerCase();
    
    
    // Add element suffix
    if (this.currentWeapon.elements.length > 0) {
      if (this.currentWeapon.elements.length === 4) {
        name += ' of elementalist';
      } else {
        name += ` of ${this.currentWeapon.elements.join(' & ')}`;
      }
    }


    // Add refinement
    if (this.currentWeapon.refinement > 0) {
      name += ` +${this.currentWeapon.refinement}`;
    }
    
    return name;
  }

  getAvailableElements(): string[] {
    if (!this.currentWeapon) return [];
    return this.elements.filter(e => !this.currentWeapon!.elements.includes(e));
  }

  getRefinementSuccessRate(): number {
    if (!this.currentWeapon || this.currentWeapon.refinement >= 15) return 0;
    
    // Use same exponential decay formula as refineWeapon
    let successRate: number;
    if (this.currentWeapon.refinement < 10) {
      // High success rate for levels 1-10
      successRate = 95 - ((this.currentWeapon.refinement + 1) * 3);
    } else {
      // Big punishment for 11+: exponential decay
      const punishmentLevel = (this.currentWeapon.refinement + 1) - 10;
      successRate = Math.max(5, 65 - Math.pow(punishmentLevel, 2.5) * 10);
    }
    
    return Math.round(successRate);
  }

  getQualitySuccessRate(): number {
    if (!this.currentWeapon) return 0;
    const currentQualityIndex = this.qualityLevels.indexOf(this.currentWeapon.quality);
    if (currentQualityIndex >= this.qualityLevels.length - 1) return 0;
    const nextQuality = this.qualityLevels[currentQualityIndex + 1];
    return this.config.quality.successRates[nextQuality as keyof typeof this.config.quality.successRates];
  }

  getElementSuccessRate(): number {
    if (!this.currentWeapon || this.currentWeapon.refinement < 5) return 0;
    return Math.max(
      10,
      this.config.element.baseSuccessRate - (this.currentWeapon.elements.length * this.config.element.decreaseRate)
    );
  }

  canRefine(): boolean {
    if (!this.currentWeapon || this.gameOver || this.currentWeapon.refinement >= 15) return false;
    
    // Check if refinement is on cooldown (for safe refinement levels 1-8)
    if (this.currentWeapon.refinement <= 8) {
      const now = Date.now();
      const timeSinceLastUse = (now - this.refinementLastUsed) / 1000;
      return timeSinceLastUse >= this.config.refinement.safeRefinementCooldown;
    }
    
    return true;
  }

  canImproveQuality(): boolean {
    if (!this.currentWeapon || this.gameOver) return false;
    const currentQualityIndex = this.qualityLevels.indexOf(this.currentWeapon.quality);
    return currentQualityIndex < this.qualityLevels.length - 1;
  }

  canAddElement(): boolean {
    return !this.gameOver && 
           this.currentWeapon !== null && 
           this.currentWeapon.refinement >= 5 && 
           this.currentWeapon.elements.length < 4 &&
           this.selectedElement !== '' &&
           !this.currentWeapon.elements.includes(this.selectedElement);
  }

  // Cooldown helper methods
  getRefinementCooldownRemaining(): number {
    const now = Date.now();
    const timeSinceLastUse = (now - this.refinementLastUsed) / 1000;
    return Math.max(0, this.config.refinement.safeRefinementCooldown - timeSinceLastUse);
  }

  getQualityCooldownRemaining(): number {
    const now = Date.now();
    const timeSinceLastUse = (now - this.qualityImproveLastUsed) / 1000;
    return Math.max(0, this.config.quality.cooldownSeconds - timeSinceLastUse);
  }

  getElementCooldownRemaining(element: string): number {
    const now = Date.now();
    const lastUsed = this.elementAddLastUsed[element] || 0;
    const timeSinceLastUse = (now - lastUsed) / 1000;
    return Math.max(0, this.config.element.cooldownSeconds - timeSinceLastUse);
  }

  isRefinementOnCooldown(): boolean {
    return this.getRefinementCooldownRemaining() > 0;
  }

  isQualityOnCooldown(): boolean {
    return this.getQualityCooldownRemaining() > 0;
  }

  isElementOnCooldown(element: string): boolean {
    return this.getElementCooldownRemaining(element) > 0;
  }

  // Helper methods for template
  getCeilRefinementCooldown(): number {
    return Math.ceil(this.getRefinementCooldownRemaining());
  }

  getCeilQualityCooldown(): number {
    return Math.ceil(this.getQualityCooldownRemaining());
  }

  getCeilElementCooldown(element: string): number {
    return Math.ceil(this.getElementCooldownRemaining(element));
  }

  showToast(message: string, success: boolean) {
    const toast = {
      id: this.toastIdCounter++,
      message,
      success
    };
    this.toasts.push(toast);
    
    setTimeout(() => {
      this.removeToast(toast.id);
    }, 2400);
  }

  removeToast(id: number) {
    this.toasts = this.toasts.filter(toast => toast.id !== id);
  }
}
