/**
 * Color Hide — Daily Challenge.
 *
 * A deterministic 5-colour puzzle keyed to the date, so everyone plays the same
 * set. Relaxed (no clock), one scored attempt a day, with a Wordle-style emoji
 * share card and a streak. All local — no backend.
 */
import { HSL, DifficultyConfig, Grade, randomTarget } from './color-hide-data';

/** mulberry32 — tiny, fast, seedable PRNG (deterministic per seed). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Local 'YYYY-MM-DD'. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dateKey(new Date());
}

function seedFromDateKey(key: string): number {
  return Number(key.replace(/-/g, '')); // YYYYMMDD
}

/** True if prevKey is exactly the day before todayKeyStr. */
export function isYesterday(prevKey: string, todayKeyStr: string): boolean {
  const [py, pm, pd] = prevKey.split('-').map(Number);
  const [ty, tm, td] = todayKeyStr.split('-').map(Number);
  if (!py || !ty) return false;
  const prev = new Date(py, pm - 1, pd).getTime();
  const today = new Date(ty, tm - 1, td).getTime();
  return Math.round((today - prev) / 86400000) === 1;
}

export const DAILY_ROUNDS = 5;

/** Daily uses a fixed, all-channels, un-muted config (key satisfies the type only). */
export const DAILY_CONFIG: DifficultyConfig = {
  key: 'medium',
  label: 'Daily',
  emoji: '🗓️',
  blurb: "Today's five colours",
  vary: { h: true, s: true, l: true },
  fixedS: 72,
  fixedL: 56,
  revealMs: 3000,
  muted: false,
  grid: 4,
  seekGap: 14,
  pointsMult: 1,
};

/** The five hidden colours for a given day — identical for every player. */
export function dailyTargets(dateKeyStr: string): HSL[] {
  const rnd = mulberry32(seedFromDateKey(dateKeyStr));
  const out: HSL[] = [];
  for (let i = 0; i < DAILY_ROUNDS; i++) out.push(randomTarget(DAILY_CONFIG, rnd));
  return out;
}

export function gradeEmoji(grade: Grade): string {
  if (grade === 'perfect' || grade === 'great') return '🟩';
  if (grade === 'good') return '🟨';
  if (grade === 'close') return '🟧';
  return '⬜';
}

export function starsFor(avgAccuracy: number): number {
  if (avgAccuracy >= 95) return 3;
  if (avgAccuracy >= 85) return 2;
  if (avgAccuracy >= 70) return 1;
  return 0;
}

export function starString(n: number): string {
  return '⭐'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
}

export interface DailyResult {
  date: string;
  score: number;
  stars: number;
  avgAccuracy: number;
  perfect: number;
  grid: string; // e.g. '🟩🟩🟨🟩⬜'
}

export function buildShareText(r: DailyResult, streak: number, url: string): string {
  return [
    `🎨 Color Hide Daily · ${r.date}`,
    `Score ${r.score} · ${r.perfect}/${DAILY_ROUNDS} perfect · ${starString(r.stars)}`,
    `${r.grid}${streak > 1 ? `   🔥 ${streak}-day streak` : ''}`,
    url,
  ].join('\n');
}
