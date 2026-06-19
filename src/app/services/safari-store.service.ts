import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  ANIMAL_BY_ID,
  ANIMALS,
  Animal,
  DAILY_REWARDS,
  DailyReward,
  EGGS,
  EggConfig,
  PLAYABLE_THEMES,
  RARITY,
  RARITY_ORDER,
  Rarity,
  STICKERS,
  STICKER_BY_ID,
  Sticker,
  THEMES,
  TOTAL_ANIMALS,
  TOTAL_STICKERS,
  Theme,
  pickWeighted,
  stickersForAnimal,
} from '../pages/animal-safari-match/safari-data';

/** Per-animal collection entry (PRD "Animal Album"). */
interface CollectionEntry {
  firstDiscoveredAt: string; // ISO timestamp
  timesFound: number;
}

interface DailyState {
  lastClaimedDate: string | null; // YYYY-MM-DD (local)
  streak: number;
}

interface SaveState {
  v: number;
  playerName: string;
  coins: number;
  collection: Record<string, CollectionEntry>;
  stickers: string[];
  levelsCleared: number;
  gamesPlayed: number;
  daily: DailyState;
}

export interface EggResult {
  egg: EggConfig;
  animal: Animal;
  isDuplicate: boolean;
  /** Coins gained (first-discovery bonus, or duplicate refund). */
  coins: number;
}

export interface DailyClaim {
  reward: DailyReward;
  day: number;
  streak: number;
  coins: number;
  animal?: Animal;
  sticker?: Sticker;
}

const STORAGE_KEY = 'asm_v1_save';
const SCHEMA_VERSION = 1;

const DEFAULT_STATE: SaveState = {
  v: SCHEMA_VERSION,
  playerName: 'Safari Friend',
  coins: 100, // a little starter purse so eggs are reachable on day one
  collection: {},
  stickers: [],
  levelsCleared: 0,
  gamesPlayed: 0,
  daily: { lastClaimedDate: null, streak: 0 },
};

/**
 * Local-first progression store for Animal Safari Match.
 *
 * Everything the player *owns* (collection, coins, stickers, parade order,
 * daily streak, stats) lives here in signals + localStorage — this is the
 * "frontend only mechanic" half of the brief. Supabase only sees anonymous
 * session/discovery events (see SupabaseService + the migration).
 */
@Injectable({ providedIn: 'root' })
export class SafariStoreService {
  private platformId = inject(PLATFORM_ID);
  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private state = signal<SaveState>(this.load());

  // ---- public reactive selectors ----
  readonly playerName = computed(() => this.state().playerName);
  readonly coins = computed(() => this.state().coins);
  readonly levelsCleared = computed(() => this.state().levelsCleared);
  readonly gamesPlayed = computed(() => this.state().gamesPlayed);

  /** Animals collected, in discovery order (drives the Safari Parade). */
  readonly parade = computed<Animal[]>(() => {
    const col = this.state().collection;
    return Object.keys(col)
      .filter(id => ANIMAL_BY_ID[id])
      .sort((a, b) => col[a].firstDiscoveredAt.localeCompare(col[b].firstDiscoveredAt))
      .map(id => ANIMAL_BY_ID[id]);
  });

  readonly collectionCount = computed(() => this.parade().length);
  readonly collectionPct = computed(() =>
    Math.round((this.collectionCount() / TOTAL_ANIMALS) * 100),
  );

  readonly stickerCount = computed(() => this.state().stickers.length);
  readonly stickerPct = computed(() =>
    Math.round((this.stickerCount() / TOTAL_STICKERS) * 100),
  );

  /** Themes the player has unlocked through progression (safari is always on). */
  readonly unlockedThemes = computed<Theme[]>(() => {
    const cleared = this.state().levelsCleared;
    return THEMES.filter(t => cleared >= t.unlockAfterLevels).map(t => t.id);
  });

  // ---- queries ----
  hasAnimal(id: string): boolean {
    return !!this.state().collection[id];
  }

  entry(id: string): CollectionEntry | null {
    return this.state().collection[id] ?? null;
  }

  hasSticker(id: string): boolean {
    return this.state().stickers.includes(id);
  }

  isThemeUnlocked(theme: Theme): boolean {
    return this.unlockedThemes().includes(theme);
  }

  // ---- mutations ----
  setPlayerName(name: string): void {
    const trimmed = name.trim().slice(0, 40) || 'Safari Friend';
    this.patch(s => ({ ...s, playerName: trimmed }));
  }

  addCoins(amount: number): void {
    if (amount <= 0) return;
    this.patch(s => ({ ...s, coins: s.coins + amount }));
  }

  spendCoins(amount: number): boolean {
    if (this.state().coins < amount) return false;
    this.patch(s => ({ ...s, coins: s.coins - amount }));
    return true;
  }

  /**
   * Record a successful board match. Increments times-found and stamps the
   * first-discovery date. Returns true when this was a brand-new animal.
   */
  recordMatch(animalId: string): boolean {
    let isFirst = false;
    this.patch(s => {
      const existing = s.collection[animalId];
      isFirst = !existing;
      const entry: CollectionEntry = {
        firstDiscoveredAt: existing?.firstDiscoveredAt ?? this.nowIso(),
        timesFound: (existing?.timesFound ?? 0) + 1,
      };
      return { ...s, collection: { ...s.collection, [animalId]: entry } };
    });
    return isFirst;
  }

  /** Unlock an animal without crediting a "match" (egg / daily reward path). */
  private markDiscovered(animalId: string): boolean {
    let isFirst = false;
    this.patch(s => {
      if (s.collection[animalId]) return s;
      isFirst = true;
      return {
        ...s,
        collection: {
          ...s.collection,
          [animalId]: { firstDiscoveredAt: this.nowIso(), timesFound: 0 },
        },
      };
    });
    return isFirst;
  }

  earnSticker(stickerId: string): boolean {
    if (!STICKER_BY_ID[stickerId] || this.hasSticker(stickerId)) return false;
    this.patch(s => ({ ...s, stickers: [...s.stickers, stickerId] }));
    return true;
  }

  registerLevelCleared(): void {
    this.patch(s => ({
      ...s,
      gamesPlayed: s.gamesPlayed + 1,
      levelsCleared: s.levelsCleared + 1,
    }));
  }

  /** Bump only the games-played counter (e.g. quitting / replaying). */
  registerGamePlayed(): void {
    this.patch(s => ({ ...s, gamesPlayed: s.gamesPlayed + 1 }));
  }

  // ---- stickers (random grant) ----
  /**
   * Grant a random not-yet-owned sticker, optionally biased toward a set of
   * animals (e.g. the ones just matched). Returns null if the player owns them
   * all.
   */
  grantRandomSticker(preferAnimalIds: string[] = []): Sticker | null {
    const owned = new Set(this.state().stickers);
    const preferred = preferAnimalIds
      .flatMap(id => stickersForAnimal(id))
      .filter(s => !owned.has(s.id));
    const pool = (preferred.length ? preferred : STICKERS.filter(s => !owned.has(s.id)));
    if (!pool.length) return null;
    const sticker = pool[Math.floor(Math.random() * pool.length)];
    this.earnSticker(sticker.id);
    return sticker;
  }

  // ---- safari eggs (gacha-lite) ----
  canAfford(eggId: EggConfig['id']): boolean {
    const egg = EGGS.find(e => e.id === eggId);
    return !!egg && this.state().coins >= egg.cost;
  }

  openEgg(eggId: EggConfig['id']): EggResult | null {
    const egg = EGGS.find(e => e.id === eggId);
    if (!egg || !this.spendCoins(egg.cost)) return null;

    const rarity = this.rollRarity(egg.weights);
    const pool = ANIMALS.filter(a => a.rarity === rarity);
    const animal = pool[Math.floor(Math.random() * pool.length)];

    if (this.hasAnimal(animal.id)) {
      const refund = egg.dupeRefund[rarity];
      this.addCoins(refund);
      return { egg, animal, isDuplicate: true, coins: refund };
    }

    this.markDiscovered(animal.id);
    const bonus = RARITY[rarity].discoverBonus;
    this.addCoins(bonus);
    return { egg, animal, isDuplicate: false, coins: bonus };
  }

  private rollRarity(weights: Record<Rarity, number>): Rarity {
    const usable = RARITY_ORDER.filter(r => weights[r] > 0);
    return pickWeighted(usable, r => weights[r], Math.random());
  }

  // ---- daily rewards ----
  /** What the player would receive if they claim right now, plus claimability. */
  dailyStatus(): { claimable: boolean; day: number; reward: DailyReward; streak: number } {
    const { daily } = this.state();
    const today = this.todayKey();
    const claimable = daily.lastClaimedDate !== today;
    const nextStreak =
      daily.lastClaimedDate === this.dayKeyOffset(-1) ? daily.streak + 1 : 1;
    const streakForDay = claimable ? nextStreak : daily.streak;
    const day = ((Math.max(1, streakForDay) - 1) % 7) + 1;
    return { claimable, day, reward: DAILY_REWARDS[day - 1], streak: daily.streak };
  }

  claimDaily(): DailyClaim | null {
    const status = this.dailyStatus();
    if (!status.claimable) return null;

    const today = this.todayKey();
    const newStreak =
      this.state().daily.lastClaimedDate === this.dayKeyOffset(-1)
        ? this.state().daily.streak + 1
        : 1;
    this.patch(s => ({ ...s, daily: { lastClaimedDate: today, streak: newStreak } }));

    const reward = status.reward;
    const claim: DailyClaim = { reward, day: status.day, streak: newStreak, coins: 0 };

    switch (reward.kind) {
      case 'coins':
        claim.coins = reward.amount ?? 0;
        this.addCoins(claim.coins);
        break;
      case 'egg': {
        // Fully fund a free Safari Egg from the reward (leaving existing coins
        // untouched), then immediately roll it so the prize feels tangible.
        this.addCoins(EGGS[0].cost);
        const res = this.openEgg('safari');
        if (res) {
          claim.animal = res.animal;
          claim.coins = res.coins;
        }
        break;
      }
      case 'epicEgg': {
        this.addCoins(EGGS[1].cost);
        const res = this.openEgg('epic');
        if (res) {
          claim.animal = res.animal;
          claim.coins = res.coins;
        }
        break;
      }
      case 'sticker': {
        const sticker = this.grantRandomSticker();
        if (sticker) claim.sticker = sticker;
        else {
          claim.coins = 50; // already have them all → small coin consolation
          this.addCoins(50);
        }
        break;
      }
    }
    return claim;
  }

  // ---- dev / reset ----
  resetAll(): void {
    this.state.set({ ...DEFAULT_STATE, collection: {}, stickers: [] });
    this.persist();
  }

  // ---- internals ----
  private patch(fn: (s: SaveState) => SaveState): void {
    this.state.update(fn);
    this.persist();
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private todayKey(): string {
    return this.dayKeyOffset(0);
  }

  private dayKeyOffset(deltaDays: number): string {
    const d = new Date();
    d.setDate(d.getDate() + deltaDays);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  }

  private load(): SaveState {
    if (!this.isBrowser) return { ...DEFAULT_STATE };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(raw) as Partial<SaveState>;
      // shallow-merge onto defaults so new fields are always present
      return {
        ...DEFAULT_STATE,
        ...parsed,
        daily: { ...DEFAULT_STATE.daily, ...(parsed.daily ?? {}) },
        collection: parsed.collection ?? {},
        stickers: parsed.stickers ?? [],
      };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  private persist(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state()));
    } catch {
      /* storage full / blocked — gameplay continues in-memory */
    }
  }
}
