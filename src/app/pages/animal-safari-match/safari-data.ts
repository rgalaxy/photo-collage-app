/**
 * Animal Safari Match — static game data.
 *
 * This is the single source of truth the *gameplay* reads from (the Supabase
 * `safari_animals` table is a seeded mirror for the community counter — see the
 * migration). Everything here is pure data + tiny pure helpers, no Angular.
 *
 * The 24 animals map 1:1 to the low-poly GLB models in `src/assets/models/`
 * (`<model>.glb`). Each renders as a real 3D model on the board, falling back to
 * an emoji "card" if its model is missing (see safari-models.ts).
 */

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Theme = 'savanna' | 'farmyard' | 'riverside';

export interface Animal {
  id: string;
  name: string;
  rarity: Rarity;
  theme: Theme;
  emoji: string;
  /** GLB basename in src/assets/models (e.g. 'animal-lion' → animal-lion.glb). */
  model: string;
}

export interface RarityInfo {
  label: string;
  /** Card / ring tint. */
  color: string;
  /** Lighter accent used for gradients + glows. */
  glow: string;
  /** Coin bonus granted the first time the animal is discovered. */
  discoverBonus: number;
  /** Relative weight when rolling an egg. Rarer = smaller. */
  eggWeight: number;
}

export const RARITY: Record<Rarity, RarityInfo> = {
  common:    { label: 'Common',    color: '#7cc36a', glow: '#bff0a8', discoverBonus: 10,  eggWeight: 64 },
  rare:      { label: 'Rare',      color: '#4aa3e8', glow: '#a9d6ff', discoverBonus: 25,  eggWeight: 26 },
  epic:      { label: 'Epic',      color: '#b069e6', glow: '#e3bdff', discoverBonus: 60,  eggWeight: 9  },
  legendary: { label: 'Legendary', color: '#f0a93a', glow: '#ffe2a3', discoverBonus: 150, eggWeight: 1  },
};

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface ThemeInfo {
  id: Theme;
  label: string;
  emoji: string;
  /** Sky / ground tints for the 3D field. */
  sky: string;
  ground: string;
  /** Level count needed (cleared) before this theme unlocks. First = 0. */
  unlockAfterLevels: number;
}

export const THEMES: ThemeInfo[] = [
  { id: 'savanna',   label: 'Savanna',   emoji: '🦁', sky: '#ffe1a8', ground: '#cdc873', unlockAfterLevels: 0 },
  { id: 'farmyard',  label: 'Farmyard',  emoji: '🐮', sky: '#cdeafc', ground: '#9bd06a', unlockAfterLevels: 3 },
  { id: 'riverside', label: 'Riverside', emoji: '🦫', sky: '#bfe9e6', ground: '#7cc08a', unlockAfterLevels: 6 },
];

/** Themes a player can pick + play on a board. */
export const PLAYABLE_THEMES: Theme[] = ['savanna', 'farmyard', 'riverside'];

export const ANIMALS: Animal[] = [
  // ---- Savanna ----
  { id: 'lion',        name: 'Lion',        rarity: 'legendary', theme: 'savanna',   emoji: '🦁', model: 'animal-lion' },
  { id: 'tiger',       name: 'Tiger',       rarity: 'epic',      theme: 'savanna',   emoji: '🐯', model: 'animal-tiger' },
  { id: 'elephant',    name: 'Elephant',    rarity: 'rare',      theme: 'savanna',   emoji: '🐘', model: 'animal-elephant' },
  { id: 'giraffe',     name: 'Giraffe',     rarity: 'rare',      theme: 'savanna',   emoji: '🦒', model: 'animal-giraffe' },
  { id: 'fox',         name: 'Fox',         rarity: 'rare',      theme: 'savanna',   emoji: '🦊', model: 'animal-fox' },
  { id: 'monkey',      name: 'Monkey',      rarity: 'common',    theme: 'savanna',   emoji: '🐵', model: 'animal-monkey' },
  { id: 'deer',        name: 'Deer',        rarity: 'common',    theme: 'savanna',   emoji: '🦌', model: 'animal-deer' },
  { id: 'hog',         name: 'Hog',         rarity: 'common',    theme: 'savanna',   emoji: '🐗', model: 'animal-hog' },

  // ---- Farmyard ----
  { id: 'panda',       name: 'Panda',       rarity: 'legendary', theme: 'farmyard',  emoji: '🐼', model: 'animal-panda' },
  { id: 'koala',       name: 'Koala',       rarity: 'epic',      theme: 'farmyard',  emoji: '🐨', model: 'animal-koala' },
  { id: 'bunny',       name: 'Bunny',       rarity: 'rare',      theme: 'farmyard',  emoji: '🐰', model: 'animal-bunny' },
  { id: 'cow',         name: 'Cow',         rarity: 'common',    theme: 'farmyard',  emoji: '🐮', model: 'animal-cow' },
  { id: 'pig',         name: 'Pig',         rarity: 'common',    theme: 'farmyard',  emoji: '🐷', model: 'animal-pig' },
  { id: 'dog',         name: 'Dog',         rarity: 'common',    theme: 'farmyard',  emoji: '🐶', model: 'animal-dog' },
  { id: 'cat',         name: 'Cat',         rarity: 'common',    theme: 'farmyard',  emoji: '🐱', model: 'animal-cat' },
  { id: 'chick',       name: 'Chick',       rarity: 'common',    theme: 'farmyard',  emoji: '🐥', model: 'animal-chick' },

  // ---- Riverside ----
  { id: 'polar',       name: 'Polar Bear',  rarity: 'epic',      theme: 'riverside', emoji: '🐻‍❄️', model: 'animal-polar' },
  { id: 'penguin',     name: 'Penguin',     rarity: 'rare',      theme: 'riverside', emoji: '🐧', model: 'animal-penguin' },
  { id: 'beaver',      name: 'Beaver',      rarity: 'rare',      theme: 'riverside', emoji: '🦫', model: 'animal-beaver' },
  { id: 'parrot',      name: 'Parrot',      rarity: 'rare',      theme: 'riverside', emoji: '🦜', model: 'animal-parrot' },
  { id: 'fish',        name: 'Fish',        rarity: 'common',    theme: 'riverside', emoji: '🐟', model: 'animal-fish' },
  { id: 'crab',        name: 'Crab',        rarity: 'common',    theme: 'riverside', emoji: '🦀', model: 'animal-crab' },
  { id: 'bee',         name: 'Bee',         rarity: 'common',    theme: 'riverside', emoji: '🐝', model: 'animal-bee' },
  { id: 'caterpillar', name: 'Caterpillar', rarity: 'common',    theme: 'riverside', emoji: '🐛', model: 'animal-caterpillar' },
];

export const ANIMAL_BY_ID: Record<string, Animal> = Object.fromEntries(
  ANIMALS.map(a => [a.id, a]),
);

export const TOTAL_ANIMALS = ANIMALS.length;

export function animalsForTheme(theme: Theme): Animal[] {
  return ANIMALS.filter(a => a.theme === theme);
}

// ----------------------------------------------------------------- levels
export interface LevelConfig {
  pairs: number;
  /** Base coins for clearing the board. */
  coins: number;
  label: string;
}

/** Difficulty presets (PRD level 1–3). Level 4+ = "theme variations only". */
export const DIFFICULTIES: LevelConfig[] = [
  { pairs: 4, coins: 50,  label: 'Easy'   },
  { pairs: 6, coins: 75,  label: 'Medium' },
  { pairs: 8, coins: 100, label: 'Hard'   },
];

// ----------------------------------------------------------- daily rewards
export type DailyKind = 'coins' | 'egg' | 'epicEgg' | 'sticker';
export interface DailyReward {
  day: number;
  kind: DailyKind;
  amount?: number;
  label: string;
  emoji: string;
}

/** 7-day cycle from the PRD, then repeats. */
export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, kind: 'coins',    amount: 50,  label: '50 Coins',   emoji: '🪙' },
  { day: 2, kind: 'coins',    amount: 75,  label: '75 Coins',   emoji: '🪙' },
  { day: 3, kind: 'egg',                   label: 'Safari Egg', emoji: '🥚' },
  { day: 4, kind: 'coins',    amount: 100, label: '100 Coins',  emoji: '🪙' },
  { day: 5, kind: 'sticker',               label: 'Rare Sticker', emoji: '🌟' },
  { day: 6, kind: 'coins',    amount: 150, label: '150 Coins',  emoji: '🪙' },
  { day: 7, kind: 'epicEgg',               label: 'Epic Egg',   emoji: '🥚' },
];

// -------------------------------------------------------------- safari eggs
export interface EggConfig {
  id: 'safari' | 'epic';
  label: string;
  emoji: string;
  cost: number;
  /** Rarity roll weights for this egg. */
  weights: Record<Rarity, number>;
  /** Coins refunded when the rolled animal is a duplicate. */
  dupeRefund: Record<Rarity, number>;
}

export const EGGS: EggConfig[] = [
  {
    id: 'safari',
    label: 'Safari Egg',
    emoji: '🥚',
    cost: 100,
    weights: { common: 60, rare: 28, epic: 10, legendary: 2 },
    dupeRefund: { common: 15, rare: 35, epic: 80, legendary: 200 },
  },
  {
    id: 'epic',
    label: 'Epic Egg',
    emoji: '🪺',
    cost: 250,
    weights: { common: 0, rare: 45, epic: 42, legendary: 13 },
    dupeRefund: { common: 15, rare: 35, epic: 80, legendary: 200 },
  },
];

// ----------------------------------------------------------------- stickers
// Stickers are cosmetic collectibles tied to an animal. Three "moods" per
// animal; unknown ones show as silhouettes in the album (PRD §7).
export interface StickerVariant {
  suffix: string; // appended to the id
  mood: string;   // shown in the album
  emoji: string;  // small badge over the animal
}

export const STICKER_VARIANTS: StickerVariant[] = [
  { suffix: 'smile', mood: 'Smiling', emoji: '😊' },
  { suffix: 'sleep', mood: 'Sleeping', emoji: '😴' },
  { suffix: 'dance', mood: 'Dancing', emoji: '🎉' },
];

export interface Sticker {
  id: string;        // `${animalId}:${suffix}`
  animalId: string;
  animalName: string;
  animalEmoji: string;
  mood: string;
  emoji: string;
  rarity: Rarity;
}

export const STICKERS: Sticker[] = ANIMALS.flatMap(a =>
  STICKER_VARIANTS.map(v => ({
    id: `${a.id}:${v.suffix}`,
    animalId: a.id,
    animalName: a.name,
    animalEmoji: a.emoji,
    mood: v.mood,
    emoji: v.emoji,
    rarity: a.rarity,
  })),
);

export const STICKER_BY_ID: Record<string, Sticker> = Object.fromEntries(
  STICKERS.map(s => [s.id, s]),
);

export const TOTAL_STICKERS = STICKERS.length;

export function stickersForAnimal(animalId: string): Sticker[] {
  return STICKERS.filter(s => s.animalId === animalId);
}

// ------------------------------------------------------------------- facts
/** A short, kid-friendly fun fact shown in the Animal Album detail view. */
export const FACTS: Record<string, string> = {
  lion: 'Lions can sleep up to 20 hours a day!',
  tiger: 'Every tiger has its very own stripe pattern.',
  elephant: 'Elephants say hello by touching trunks!',
  giraffe: "A giraffe's tongue can be half a metre long!",
  fox: 'Foxes use their fluffy tails as warm blankets.',
  monkey: 'Monkeys often peel bananas from the bottom!',
  deer: 'A baby deer can walk just minutes after it is born.',
  hog: 'Hogs roll in mud to stay cool and comfy.',
  panda: 'Pandas can munch bamboo for up to 14 hours a day!',
  koala: 'Koalas sleep for about 18 hours every day.',
  bunny: "A bunny's teeth never stop growing.",
  cow: 'Cows have best friends and feel sad when apart.',
  pig: 'Pigs are super smart — even smarter than many dogs!',
  dog: "A dog's nose print is unique, just like a fingerprint.",
  cat: 'Cats can make over 100 different sounds.',
  chick: 'Chicks can peep to their mum before they even hatch!',
  polar: 'Polar bears have black skin under their white fur.',
  penguin: "Penguins can't fly, but they are amazing swimmers!",
  beaver: 'Beavers build cosy homes called lodges.',
  parrot: 'Some parrots can learn hundreds of words!',
  fish: 'Fish chat with each other using pops and clicks.',
  crab: 'Crabs scuttle sideways along the beach!',
  bee: 'Bees do a wiggly dance to share directions.',
  caterpillar: 'A caterpillar grows up into a butterfly or moth!',
};

export function factFor(animalId: string): string {
  return FACTS[animalId] ?? 'A wonderful animal to discover!';
}

// --------------------------------------------------------- weighted picker
/** Deterministic given the supplied roll in [0,1). Pure → easy to reason about. */
export function pickWeighted<T>(items: T[], weightOf: (item: T) => number, roll: number): T {
  const total = items.reduce((sum, it) => sum + Math.max(0, weightOf(it)), 0);
  let acc = roll * total;
  for (const it of items) {
    acc -= Math.max(0, weightOf(it));
    if (acc < 0) return it;
  }
  return items[items.length - 1];
}
