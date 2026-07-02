import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DEFAULT_SKIN_ID } from './color-hide-cosmetics';
import { DailyResult, isYesterday } from './color-hide-daily';

/**
 * Local-first progression for Color Hide: the Sparkles ✨ wallet, owned/equipped
 * gem skins, and the Daily Challenge record (streak, best, last result). Signals
 * drive the UI; every mutation persists to localStorage.
 */
const KEY = 'ch_store_v1';

interface StoreState {
  v: number;
  sparkles: number;
  unlocked: string[];
  equipped: string;
  daily: {
    lastDate: string | null;
    streak: number;
    best: number;
    last: DailyResult | null;
  };
}

const DEFAULT_STATE: StoreState = {
  v: 1,
  sparkles: 0,
  unlocked: [DEFAULT_SKIN_ID],
  equipped: DEFAULT_SKIN_ID,
  daily: { lastDate: null, streak: 0, best: 0, last: null },
};

@Injectable({ providedIn: 'root' })
export class ColorHideStore {
  private platformId = inject(PLATFORM_ID);
  private state = signal<StoreState>(this.load());

  readonly sparkles = computed(() => this.state().sparkles);
  readonly unlocked = computed(() => this.state().unlocked);
  readonly equipped = computed(() => this.state().equipped);
  readonly dailyStreak = computed(() => this.state().daily.streak);
  readonly dailyBest = computed(() => this.state().daily.best);
  readonly dailyLast = computed(() => this.state().daily.last);
  readonly dailyLastDate = computed(() => this.state().daily.lastDate);

  owns(id: string): boolean {
    return this.state().unlocked.includes(id);
  }

  addSparkles(n: number): void {
    if (n <= 0) return;
    this.patch(s => ({ ...s, sparkles: s.sparkles + Math.round(n) }));
  }

  /** Buy a skin if affordable; returns true on success. */
  buySkin(id: string, cost: number): boolean {
    const s = this.state();
    if (s.unlocked.includes(id)) return true;
    if (s.sparkles < cost) return false;
    this.patch(st => ({
      ...st,
      sparkles: st.sparkles - cost,
      unlocked: [...st.unlocked, id],
      equipped: id,
    }));
    return true;
  }

  equipSkin(id: string): void {
    if (!this.owns(id)) return;
    this.patch(s => ({ ...s, equipped: id }));
  }

  /** Record a completed daily run; advances the streak (breaks if a day was missed). */
  recordDaily(result: DailyResult): void {
    this.patch(s => {
      const prev = s.daily.lastDate;
      let streak = 1;
      if (prev === result.date) streak = s.daily.streak; // already recorded today
      else if (prev && isYesterday(prev, result.date)) streak = s.daily.streak + 1;
      return {
        ...s,
        daily: {
          lastDate: result.date,
          streak,
          best: Math.max(s.daily.best, result.score),
          last: result,
        },
      };
    });
  }

  // ------------------------------------------------------------ persistence
  private patch(fn: (s: StoreState) => StoreState): void {
    this.state.update(fn);
    this.persist();
  }

  private load(): StoreState {
    if (!isPlatformBrowser(this.platformId)) return { ...DEFAULT_STATE };
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(raw) as Partial<StoreState>;
      return {
        ...DEFAULT_STATE,
        ...parsed,
        unlocked: parsed.unlocked?.length ? parsed.unlocked : [DEFAULT_SKIN_ID],
        daily: { ...DEFAULT_STATE.daily, ...(parsed.daily ?? {}) },
      };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }

  private persist(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(this.state()));
    } catch {
      /* storage full — continue in-memory */
    }
  }
}
