import { Injectable, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FRIENDS, TOTAL_FRIENDS } from './bubble-reef-data';

/**
 * Local-first progression for Bubble Reef: which sea friends live in your reef
 * (with a cuddle count each), lifetime pop stats and the best Bubble Rush
 * score. Signals drive the UI; every mutation persists to localStorage.
 */
const KEY = 'br_store_v1';

interface StoreState {
  v: number;
  /** friendId -> times rescued (1+ means it swims in your reef). */
  friends: Record<string, number>;
  /** friendId -> times fed/petted in the reef (pure affection, no economy). */
  cuddles: Record<string, number>;
  totalPops: number;
  bestRush: number;
  musicOn: boolean;
}

const DEFAULT_STATE: StoreState = {
  v: 1,
  friends: {},
  cuddles: {},
  totalPops: 0,
  bestRush: 0,
  musicOn: true,
};

@Injectable({ providedIn: 'root' })
export class BubbleReefStore {
  private platformId = inject(PLATFORM_ID);
  private state = signal<StoreState>(this.load());

  readonly friendCounts = computed(() => this.state().friends);
  readonly collectedIds = computed(() => new Set(Object.keys(this.state().friends)));
  readonly collectedCount = computed(() => Object.keys(this.state().friends).length);
  readonly totalFriends = TOTAL_FRIENDS;
  readonly totalPops = computed(() => this.state().totalPops);
  readonly bestRush = computed(() => this.state().bestRush);
  readonly musicOn = computed(() => this.state().musicOn);
  readonly collectedFriends = computed(() => {
    const owned = this.state().friends;
    return FRIENDS.filter(f => owned[f.id]);
  });

  owns(id: string): boolean {
    return !!this.state().friends[id];
  }

  countOf(id: string): number {
    return this.state().friends[id] ?? 0;
  }

  cuddlesOf(id: string): number {
    return this.state().cuddles[id] ?? 0;
  }

  /** Record a rescued friend; returns true if it's a brand-new species. */
  rescue(id: string): boolean {
    const isNew = !this.owns(id);
    this.patch(s => ({
      ...s,
      friends: { ...s.friends, [id]: (s.friends[id] ?? 0) + 1 },
    }));
    return isNew;
  }

  cuddle(id: string): void {
    if (!this.owns(id)) return;
    this.patch(s => ({
      ...s,
      cuddles: { ...s.cuddles, [id]: (s.cuddles[id] ?? 0) + 1 },
    }));
  }

  addPops(n: number): void {
    if (n <= 0) return;
    this.patch(s => ({ ...s, totalPops: s.totalPops + n }));
  }

  /** Returns true if this rush score is a new personal best. */
  recordRush(score: number): boolean {
    const isBest = score > this.state().bestRush;
    if (isBest) this.patch(s => ({ ...s, bestRush: score }));
    return isBest;
  }

  setMusic(on: boolean): void {
    this.patch(s => ({ ...s, musicOn: on }));
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
        friends: parsed.friends ?? {},
        cuddles: parsed.cuddles ?? {},
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
