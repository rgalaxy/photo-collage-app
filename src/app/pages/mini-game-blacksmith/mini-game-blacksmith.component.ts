import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { GameShellComponent } from '../../shared/game-shell/game-shell.component';
import { JuiceService } from '../../shared/juice/juice.service';

interface Weapon {
  id: string;
  name: string;
  baseScore: number;
  icon: string;
  blurb: string;
}

interface WeaponInstance {
  weapon: Weapon;
  refinement: number; // 0..MAX_REFINE
  quality: string; // quality tier key
  elements: string[]; // element keys
  evolveStage: number; // index into the weapon's evolution chain
}

interface QualityTier {
  key: string;
  label: string;
  mult: number;
}

interface ElementDef {
  key: string;
  label: string;
  icon: string;
}

interface ForgeResult {
  name: string;
  score: number;
  submitted: number;
  shattered: boolean;
  breakdown: { base: number; refine: number; quality: number; element: number; synergy: number; evolve: number };
}

@Component({
  selector: 'app-mini-game-blacksmith',
  standalone: true,
  imports: [CommonModule, FormsModule, GameShellComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './mini-game-blacksmith.component.html',
  styleUrl: './mini-game-blacksmith.component.scss',
})
export class MiniGameBlacksmithComponent implements OnInit, OnDestroy {
  // ----- tunables -----
  readonly GAME_TIME = 105;
  readonly MAX_REFINE = 15;
  readonly DANGER_FROM = 10; // strikes past +10 can SHATTER; +10 and below only cost time
  readonly ELEMENT_UNLOCK = 4; // refinement needed before infusing elements
  readonly FAIL_TIME_PENALTY = 3; // seconds lost when the forge "cools" on a miss
  readonly SALVAGE = 0.5; // fraction of score kept on a shatter

  // ----- state -----
  playerName = '';
  gameActive = false;
  gameOver = false;
  score = 0;
  timeRemaining = this.GAME_TIME;
  currentWeapon: WeaponInstance | null = null;
  selectedElement = '';

  showFinishConfirmation = false;
  showGameOverModal = false;
  showHowToPlayModal = false;

  result: ForgeResult | null = null;
  private breakdown = { base: 0, refine: 0, quality: 0, element: 0, synergy: 0, evolve: 0 };

  highScores: any[] = [];
  toasts: { id: number; message: string; success: boolean }[] = [];
  private toastIdCounter = 0;
  private gameTimer: any;

  // ----- data -----
  weapons: Weapon[] = [
    { id: 'dagger', name: 'Dagger', baseScore: 12, icon: '🗡️', blurb: 'Fast & forgiving' },
    { id: 'sword', name: 'Sword', baseScore: 20, icon: '⚔️', blurb: 'Balanced classic' },
    { id: 'bow', name: 'Bow', baseScore: 16, icon: '🏹', blurb: 'Steady aim' },
    { id: 'axe', name: 'Battle Axe', baseScore: 26, icon: '🪓', blurb: 'Heavy hitter' },
    { id: 'hammer', name: 'Warhammer', baseScore: 32, icon: '🔨', blurb: 'High risk, high base' },
  ];

  qualityTiers: QualityTier[] = [
    { key: 'common', label: 'Common', mult: 0 },
    { key: 'fine', label: 'Fine', mult: 3 },
    { key: 'exquisite', label: 'Exquisite', mult: 7 },
    { key: 'masterwork', label: 'Masterwork', mult: 14 },
    { key: 'legendary', label: 'Legendary', mult: 28 },
  ];
  private qualitySuccess: Record<string, number> = {
    fine: 85,
    exquisite: 58,
    masterwork: 30,
    legendary: 12,
  };
  // extra punishment when a high-tier temper fails: seconds lost + chance to drop a tier
  private temperFail: Record<string, { time: number; drop: number }> = {
    fine: { time: 2, drop: 0 },
    exquisite: { time: 3, drop: 0 },
    masterwork: { time: 5, drop: 30 },
    legendary: { time: 7, drop: 45 },
  };

  elements: ElementDef[] = [
    { key: 'fire', label: 'Fire', icon: '🔥' },
    { key: 'earth', label: 'Earth', icon: '🪨' },
    { key: 'water', label: 'Water', icon: '💧' },
    { key: 'wind', label: 'Wind', icon: '🌪️' },
  ];

  // Evolution lifts the weapon to a grander form (new name + bigger base) but
  // resets refinement / quality / elements — a high-skill detour to a higher ceiling.
  evolutionChains: Record<string, string[]> = {
    dagger: ['Dagger', 'Kris', 'Rondel', 'Stiletto'],
    sword: ['Sword', 'Longsword', 'Claymore', 'Excalibur'],
    bow: ['Bow', 'Crossbow', 'Arbalest', 'Ballista'],
    axe: ['Battle Axe', 'Greataxe', 'War Cleaver', 'Ragnarök'],
    hammer: ['Warhammer', 'Maul', 'Earthshaker', 'Mjölnir'],
  };
  readonly EVOLVE_REFINE_REQ = 10;
  readonly EVOLVE_QUALITY_REQ = 3; // masterwork index

  constructor(private supabaseService: SupabaseService, private juice: JuiceService) {}

  ngOnInit(): void {
    this.loadHighScores();
  }

  ngOnDestroy(): void {
    if (this.gameTimer) clearInterval(this.gameTimer);
  }

  async loadHighScores(): Promise<void> {
    const all = (await this.supabaseService.getHighScores()) || [];
    this.highScores = all.slice(0, 7);
  }

  // ===================== flow =====================
  startGame(): void {
    if (!this.playerName.trim()) {
      this.showToast('Enter your blacksmith name first!', false);
      return;
    }
    this.gameActive = true;
    this.gameOver = false;
    this.score = 0;
    this.breakdown = { base: 0, refine: 0, quality: 0, element: 0, synergy: 0, evolve: 0 };
    this.timeRemaining = this.GAME_TIME;
    this.currentWeapon = null;
    this.selectedElement = '';
    this.result = null;
    this.toasts = [];
    this.showFinishConfirmation = false;
    this.showGameOverModal = false;

    if (this.gameTimer) clearInterval(this.gameTimer);
    this.gameTimer = setInterval(() => {
      this.timeRemaining--;
      if (this.timeRemaining <= 8 && this.timeRemaining > 0) {
        this.juice.blip(660, { type: 'sine', duration: 0.05, gain: 0.025 });
      }
      if (this.timeRemaining <= 0) this.endGame('Time up!');
    }, 1000);
  }

  selectWeapon(id: string): void {
    if (!this.gameActive || this.currentWeapon) return;
    const weapon = this.weapons.find(w => w.id === id);
    if (!weapon) return;
    // clone — Evolve mutates baseScore, and we must not corrupt the master list
    this.currentWeapon = { weapon: { ...weapon }, refinement: 0, quality: 'common', elements: [], evolveStage: 0 };
    this.score = weapon.baseScore;
    this.breakdown.base = weapon.baseScore;
    this.juice.blip(520, { type: 'triangle', duration: 0.08, gain: 0.04 });
  }

  finishForging(): void {
    if (this.currentWeapon) this.showFinishConfirmation = true;
  }
  confirmFinishForging(): void {
    this.showFinishConfirmation = false;
    this.endGame('Masterpiece banked!');
  }
  cancelFinishForging(): void {
    this.showFinishConfirmation = false;
  }

  private async endGame(reason: string, shattered = false): Promise<void> {
    if (this.gameOver) return;
    this.gameActive = false;
    this.gameOver = true;
    if (this.gameTimer) clearInterval(this.gameTimer);

    const submitted = shattered ? Math.floor(this.score * this.SALVAGE) : this.score;
    this.result = {
      name: this.currentWeapon ? this.getWeaponDisplayName() : 'No weapon forged',
      score: this.score,
      submitted,
      shattered,
      breakdown: { ...this.breakdown },
    };

    if (!shattered && submitted > 0) {
      this.juice.confetti(90);
      [523, 659, 784, 1047].forEach((f, i) =>
        setTimeout(() => this.juice.blip(f, { type: 'triangle', duration: 0.2, gain: 0.05 }), i * 120)
      );
    }

    if (submitted > 0 && this.currentWeapon) {
      try {
        await this.supabaseService.insertHighScore(this.playerName, submitted, this.result.name);
        await this.loadHighScores();
      } catch (e) {
        console.error('high score submit failed', e);
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
    this.currentWeapon = null;
  }

  // ===================== actions =====================
  refine(): void {
    if (!this.canRefine()) return;
    const lvl = this.currentWeapon!.refinement;
    const rate = this.refineRate(lvl);
    if (Math.random() * 100 < rate) {
      this.currentWeapon!.refinement++;
      const gain = this.refineGain(this.currentWeapon!.refinement);
      this.score += gain;
      this.breakdown.refine += gain;
      this.showToast(`Refined to +${this.currentWeapon!.refinement}!  +${gain}`, true);
      this.juiceForge(true);
    } else if (lvl >= this.DANGER_FROM) {
      this.showToast('The blade SHATTERED!', false);
      this.juiceForge(false);
      this.endGame('Your weapon shattered!', true);
    } else {
      this.timeRemaining = Math.max(1, this.timeRemaining - this.FAIL_TIME_PENALTY);
      this.showToast(`Missed — the forge cooled  −${this.FAIL_TIME_PENALTY}s`, false);
      this.juice.shake(document.querySelector('.weapon-display'), 5, 200);
      this.juice.blip(180, { type: 'sawtooth', duration: 0.12, gain: 0.04 });
    }
  }

  temper(): void {
    if (!this.canTemper()) return;
    const next = this.nextQuality()!;
    const rate = this.qualitySuccess[next.key];
    if (Math.random() * 100 < rate) {
      this.currentWeapon!.quality = next.key;
      const gain = this.currentWeapon!.weapon.baseScore * next.mult;
      this.score += gain;
      this.breakdown.quality += gain;
      this.showToast(`Tempered to ${next.label}!  +${gain}`, true);
      this.juiceForge(true);
    } else {
      // higher tiers: more time lost + a chance the temper cracks the current quality down a tier
      const pen = this.temperFail[next.key] ?? { time: this.FAIL_TIME_PENALTY, drop: 0 };
      this.timeRemaining = Math.max(1, this.timeRemaining - pen.time);
      const idx = this.qualityIndex();
      if (pen.drop > 0 && idx > 0 && Math.random() * 100 < pen.drop) {
        const dropped = this.qualityTiers[idx - 1];
        this.currentWeapon!.quality = dropped.key;
        this.showToast(`Temper cracked — dropped to ${dropped.label}!  −${pen.time}s`, false);
        this.juiceForge(false);
      } else {
        this.showToast(`Temper failed  −${pen.time}s`, false);
        this.juice.shake(document.querySelector('.weapon-display'), 5, 200);
        this.juice.blip(180, { type: 'sawtooth', duration: 0.12, gain: 0.04 });
      }
    }
  }

  infuse(element: string): void {
    if (!this.currentWeapon || !this.gameActive) return;
    this.selectedElement = element;
    if (!this.canInfuse()) return;
    const rate = this.elementRate(this.currentWeapon.elements.length);
    if (Math.random() * 100 < rate) {
      this.currentWeapon.elements.push(element);
      const gain = 40 * this.currentWeapon.elements.length;
      this.score += gain;
      this.breakdown.element += gain;
      let msg = `Infused ${this.elementLabel(element)}!  +${gain}`;
      if (this.currentWeapon.elements.length === 4) {
        this.score += 200;
        this.breakdown.synergy += 200;
        msg = `Elementalist synergy!  +${gain} +200`;
      }
      this.showToast(msg, true);
      this.selectedElement = '';
      this.juiceForge(true);
    } else {
      this.timeRemaining = Math.max(1, this.timeRemaining - this.FAIL_TIME_PENALTY);
      this.showToast(`${this.elementLabel(element)} fizzled  −${this.FAIL_TIME_PENALTY}s`, false);
      this.juice.shake(document.querySelector('.weapon-display'), 5, 200);
      this.juice.blip(180, { type: 'sawtooth', duration: 0.12, gain: 0.04 });
    }
  }

  evolve(): void {
    if (!this.canEvolve()) return;
    const w = this.currentWeapon!;
    w.evolveStage++;
    w.weapon.baseScore = Math.round(w.weapon.baseScore * 1.6);
    const bonus = 150 + w.weapon.baseScore * 4;
    this.score += bonus;
    this.breakdown.evolve += bonus;
    // a grander weapon — but the work resets
    w.refinement = 0;
    w.quality = 'common';
    w.elements = [];
    this.showToast(`Evolved into the ${this.weaponBaseName()}!  +${bonus}`, true);
    this.juiceForge(true);
    this.juice.confetti(40);
    this.juice.blip(1047, { type: 'triangle', duration: 0.22, gain: 0.055 });
  }

  // ===================== rules =====================
  refineRate(level: number): number {
    let r: number;
    if (level < 5) r = 92 - level * 4; // 0-4: 92,88,84,80,76
    else if (level < this.DANGER_FROM) r = 72 - (level - 5) * 6; // 5-9: 72,66,60,54,48 (safe — fail only costs time)
    else r = Math.max(12, 44 - (level - this.DANGER_FROM) * 8); // 10-14: 44,36,28,20,12 (shatter on fail)
    return Math.round(r);
  }
  /** Reward for reaching `newLevel`. Danger-zone strikes pay a premium so a
   *  push to +15 legendary is genuinely worth the shatter risk. */
  refineGain(newLevel: number): number {
    const danger = newLevel > this.DANGER_FROM ? (newLevel - this.DANGER_FROM) * 25 : 0;
    return 12 * newLevel + danger;
  }
  elementRate(count: number): number {
    return Math.max(15, 78 - count * 16);
  }

  canRefine(): boolean {
    return !!this.currentWeapon && this.gameActive && !this.gameOver && this.currentWeapon.refinement < this.MAX_REFINE;
  }
  canTemper(): boolean {
    return !!this.currentWeapon && this.gameActive && !this.gameOver && this.qualityIndex() < this.qualityTiers.length - 1;
  }
  canInfuse(): boolean {
    return (
      !!this.currentWeapon &&
      this.gameActive &&
      !this.gameOver &&
      this.currentWeapon.refinement >= this.ELEMENT_UNLOCK &&
      this.currentWeapon.elements.length < 4 &&
      !!this.selectedElement &&
      !this.currentWeapon.elements.includes(this.selectedElement)
    );
  }
  canEvolve(): boolean {
    const w = this.currentWeapon;
    if (!w || !this.gameActive || this.gameOver || this.evolveMaxed()) return false;
    return w.refinement >= this.EVOLVE_REFINE_REQ && this.qualityIndex() >= this.EVOLVE_QUALITY_REQ && w.elements.length === 4;
  }
  evolveMaxed(): boolean {
    const w = this.currentWeapon;
    if (!w) return true;
    const chain = this.evolutionChains[w.weapon.id];
    return !chain || w.evolveStage >= chain.length - 1;
  }
  weaponBaseName(): string {
    const w = this.currentWeapon;
    if (!w) return '';
    return this.evolutionChains[w.weapon.id]?.[w.evolveStage] ?? w.weapon.name;
  }
  evolveTargetName(): string {
    const w = this.currentWeapon;
    if (!w) return '';
    return this.evolutionChains[w.weapon.id]?.[w.evolveStage + 1] ?? '';
  }

  // ===================== view helpers =====================
  isDanger(): boolean {
    return !!this.currentWeapon && this.currentWeapon.refinement >= this.DANGER_FROM;
  }
  nextRefineRate(): number {
    return this.currentWeapon ? this.refineRate(this.currentWeapon.refinement) : 0;
  }
  nextRefineGain(): number {
    return this.currentWeapon ? this.refineGain(this.currentWeapon.refinement + 1) : 0;
  }
  heat(): number {
    return this.currentWeapon ? this.currentWeapon.refinement / this.MAX_REFINE : 0;
  }

  qualityIndex(): number {
    return this.currentWeapon ? this.qualityTiers.findIndex(q => q.key === this.currentWeapon!.quality) : 0;
  }
  qualityTier(key: string): QualityTier {
    return this.qualityTiers.find(q => q.key === key) ?? this.qualityTiers[0];
  }
  currentQualityLabel(): string {
    return this.currentWeapon ? this.qualityTier(this.currentWeapon.quality).label : '';
  }
  nextQuality(): QualityTier | null {
    const i = this.qualityIndex();
    return i < this.qualityTiers.length - 1 ? this.qualityTiers[i + 1] : null;
  }
  nextQualityRate(): number {
    const n = this.nextQuality();
    return n ? this.qualitySuccess[n.key] : 0;
  }
  nextQualityGain(): number {
    const n = this.nextQuality();
    return n && this.currentWeapon ? this.currentWeapon.weapon.baseScore * n.mult : 0;
  }

  elementLabel(key: string): string {
    return this.elements.find(e => e.key === key)?.label ?? key;
  }
  elementIcon(key: string): string {
    return this.elements.find(e => e.key === key)?.icon ?? '';
  }
  hasElement(key: string): boolean {
    return !!this.currentWeapon?.elements.includes(key);
  }
  nextElementRate(): number {
    return this.currentWeapon ? this.elementRate(this.currentWeapon.elements.length) : 0;
  }

  getWeaponDisplayName(): string {
    if (!this.currentWeapon) return '';
    const w = this.currentWeapon;
    const q = this.qualityTier(w.quality);
    let name = '';
    if (q.key !== 'common') name += q.label + ' ';
    name += this.weaponBaseName();
    if (w.elements.length === 4) name += ' of the Elements';
    else if (w.elements.length) name += ' of ' + w.elements.map(e => this.elementLabel(e)).join(' & ');
    if (w.refinement > 0) name += ` +${w.refinement}`;
    return name;
  }

  // ===================== ui plumbing =====================
  openHowToPlayModal(): void {
    this.showHowToPlayModal = true;
  }
  closeHowToPlayModal(): void {
    this.showHowToPlayModal = false;
  }

  showToast(message: string, success: boolean): void {
    const toast = { id: this.toastIdCounter++, message, success };
    this.toasts.push(toast);
    // keep the feedback stack small so it never obstructs play (esp. on mobile)
    if (this.toasts.length > 3) this.toasts = this.toasts.slice(-3);
    setTimeout(() => this.removeToast(toast.id), 1900);
  }
  removeToast(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  private juiceForge(success: boolean): void {
    const el = document.querySelector('.weapon-display') as HTMLElement | null;
    if (success) {
      this.juice.shake(el, 6, 220);
      this.juice.blip(720, { type: 'square', duration: 0.05, gain: 0.04 });
      if (el) {
        const r = el.getBoundingClientRect();
        this.juice.burst(r.left + r.width / 2, r.top + r.height * 0.42, {
          count: 22,
          power: 8,
          gravity: 0.3,
          colors: ['#ffd63a', '#ffa955', '#ff8c00', '#22d3ee'],
        });
      }
    } else {
      this.juice.shake(el, 12, 360);
      this.juice.blip(120, { type: 'sawtooth', duration: 0.22, gain: 0.06 });
      if (el) {
        const r = el.getBoundingClientRect();
        this.juice.burst(r.left + r.width / 2, r.top + r.height / 2, {
          count: 26,
          power: 9,
          colors: ['#6b6b6b', '#fb7185', '#9a9a9a'],
        });
      }
    }
  }
}
