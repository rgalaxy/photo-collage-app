// ============================================================================
// Bubble Reef — static game data
// ----------------------------------------------------------------------------
// A cozy, no-fail underwater bubble-popper for every age (2-year-olds
// included). Characters are procedural three.js models baked to sprites at
// runtime (see sea-creatures.ts) — no binary assets, no licensing.
// ============================================================================

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface RarityInfo {
  key: Rarity;
  label: string;
  color: string;
  /** Relative chance weight used when a friend bubble picks its passenger. */
  weight: number;
}

export const RARITY: Record<Rarity, RarityInfo> = {
  common: { key: 'common', label: 'Common', color: '#8fd8f2', weight: 100 },
  uncommon: { key: 'uncommon', label: 'Uncommon', color: '#7ce8b5', weight: 42 },
  rare: { key: 'rare', label: 'Rare', color: '#c9a6ff', weight: 14 },
  legendary: { key: 'legendary', label: 'Legendary', color: '#ffd166', weight: 4 },
};

export const RARITY_ORDER: Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

export interface SeaFriend {
  id: string;
  name: string;
  rarity: Rarity;
  /** One tiny read-aloud line for parents playing with little ones. */
  fact: string;
}

export const FRIENDS: SeaFriend[] = [
  // ---- common ----
  { id: 'coral', name: 'Coral', rarity: 'common', fact: 'Tropical fish wear the brightest pyjamas in the sea.' },
  { id: 'finn', name: 'Finn', rarity: 'common', fact: 'Fish sleep with their eyes open — they have no eyelids!' },
  { id: 'puffy', name: 'Puffy', rarity: 'common', fact: 'Pufferfish blow up like balloons when they feel shy.' },
  { id: 'pinchy', name: 'Pinchy', rarity: 'common', fact: 'Crabs walk sideways — try it, it is very silly.' },
  { id: 'peach', name: 'Peach', rarity: 'common', fact: 'Shrimp swim backwards with a flick of their tail.' },
  { id: 'gary', name: 'Gary', rarity: 'common', fact: 'Sea snails carry their cosy house everywhere they go.' },
  // ---- uncommon ----
  { id: 'tilly', name: 'Tilly', rarity: 'uncommon', fact: 'Sea turtles can hold their breath for hours while they nap.' },
  { id: 'ollie', name: 'Ollie', rarity: 'uncommon', fact: 'Octopuses have three hearts and love to play with toys.' },
  { id: 'inky', name: 'Inky', rarity: 'uncommon', fact: 'Squid can change colour faster than you can blink.' },
  { id: 'jelly', name: 'Jelly', rarity: 'uncommon', fact: 'Jellyfish just drift and wobble wherever the sea takes them.' },
  { id: 'stella', name: 'Stella', rarity: 'uncommon', fact: 'Starfish can grow a whole new arm if they lose one.' },
  { id: 'louie', name: 'Louie', rarity: 'uncommon', fact: 'Lobsters can live to be over 100 years old.' },
  // ---- rare ----
  { id: 'splash', name: 'Splash', rarity: 'rare', fact: 'Dolphins call each other by name with special whistles.' },
  { id: 'soso', name: 'Soso', rarity: 'rare', fact: 'Seals clap their flippers when they are happy.' },
  { id: 'pip', name: 'Pip', rarity: 'rare', fact: 'Penguins slide on their tummies because it is faster AND funnier.' },
  { id: 'chomp', name: 'Chomp', rarity: 'rare', fact: 'This shark only chomps hugs. Sharks are older than trees!' },
  { id: 'bloop', name: 'Bloop', rarity: 'rare', fact: 'A whale spout can shoot higher than your house.' },
  { id: 'axel', name: 'Axel', rarity: 'rare', fact: 'Axolotls can regrow legs, tails — even little bits of their heart!' },
  { id: 'ray', name: 'Ray', rarity: 'rare', fact: 'Manta rays do underwater somersaults when they find yummy plankton.' },
  // ---- legendary ----
  { id: 'bigblue', name: 'Big Blue', rarity: 'legendary', fact: 'The blue whale is the biggest animal that has EVER lived.' },
  { id: 'marina', name: 'Marina', rarity: 'legendary', fact: 'Mermaids only visit reefs where the bubbles are extra sparkly.' },
  { id: 'nessie', name: 'Nessie', rarity: 'legendary', fact: 'A very shy sea dino. You are one of the few who has ever seen her!' },
];

export const FRIEND_BY_ID: Record<string, SeaFriend> = Object.fromEntries(
  FRIENDS.map(f => [f.id, f]),
);

export const TOTAL_FRIENDS = FRIENDS.length;

/** Weighted random friend, optionally excluding already-collected ids first. */
export function rollFriend(preferNewFrom?: Set<string>): SeaFriend {
  let pool = FRIENDS;
  // Nudge towards friends the player doesn't own yet (70% of the time).
  if (preferNewFrom && preferNewFrom.size < TOTAL_FRIENDS && Math.random() < 0.7) {
    pool = FRIENDS.filter(f => !preferNewFrom.has(f.id));
  }
  const total = pool.reduce((s, f) => s + RARITY[f.rarity].weight, 0);
  let r = Math.random() * total;
  for (const f of pool) {
    r -= RARITY[f.rarity].weight;
    if (r <= 0) return f;
  }
  return pool[pool.length - 1];
}

// ---------------------------------------------------------------------------
// Bubbles
// ---------------------------------------------------------------------------

export type BubbleKind = 'normal' | 'friend' | 'golden' | 'rainbow' | 'star' | 'grump';

export interface ModeConfig {
  /** ms between spawns (a range — the engine picks inside it). */
  spawnMs: [number, number];
  /** px/second rise speed range (scaled a little by field height). */
  speed: [number, number];
  /** bubble diameter range in px. */
  size: [number, number];
  /** Cap of simultaneously alive bubbles. */
  maxAlive: number;
  /** A friend bubble is guaranteed once every N pops (and never sooner than every 4). */
  friendEvery: number;
  /** Per-spawn special chances (checked in order). */
  goldenChance: number;
  rainbowChance: number;
  starChance: number;
  /** A grumpy bubble that breaks the combo (never spawns in Little Fins). */
  grumpChance: number;
}

/** Little Fins — toddler sandbox. Big, slow, generous, zero fail. */
export const LITTLE_FINS: ModeConfig = {
  spawnMs: [520, 950],
  speed: [38, 72],
  size: [78, 128],
  maxAlive: 9,
  friendEvery: 8,
  goldenChance: 0.05,
  rainbowChance: 0.02,
  starChance: 0,
  grumpChance: 0,
};

/** Bubble Rush — a relaxed 60s score chase. */
export const BUBBLE_RUSH: ModeConfig = {
  spawnMs: [300, 620],
  speed: [72, 145],
  size: [52, 96],
  maxAlive: 14,
  friendEvery: 12,
  goldenChance: 0.08,
  rainbowChance: 0.015,
  starChance: 0.045,
  grumpChance: 0.07,
};

export const RUSH_DURATION = 60; // seconds
export const STAR_BONUS_SECONDS = 3;

export const POINTS: Record<BubbleKind, number> = {
  normal: 10,
  friend: 25,
  golden: 50,
  rainbow: 100,
  star: 15,
  grump: 0,
};

/** Combo → multiplier: every 5 chained pops adds ×1, capped at ×5. */
export function comboMultiplier(combo: number): number {
  return Math.min(5, 1 + Math.floor(combo / 5));
}

/** How long (ms) a pop keeps the chain alive in Bubble Rush. */
export const COMBO_WINDOW_MS = 2600;

// ---------------------------------------------------------------------------
// Flavour
// ---------------------------------------------------------------------------

export const RESCUE_CHEERS = [
  'joined your reef!',
  'is your friend now!',
  'swam home with you!',
  'loves you already!',
  'blows you a bubble kiss!',
];

export const MUSIC_SRC = 'assets/musics/bubble-reef-theme.mp3';
export const MUSIC_CREDIT =
  'Music: "Carefree" — Kevin MacLeod (incompetech.com) · Licensed under CC BY 4.0';
