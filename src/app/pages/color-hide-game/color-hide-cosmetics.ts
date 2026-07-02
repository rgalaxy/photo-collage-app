/**
 * Color Hide — collectible gem skins.
 *
 * A skin only changes how the crystal *looks* (finish, wireframe, twinkle,
 * shimmer) and the particle-burst palette — never its gameplay colour (the gem
 * still shows the white canvas → your live colour → the target). Bought with
 * "Sparkles" ✨ earned from play.
 */
export interface GemSkin {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  cost: number; // sparkles; 0 = free/default
  // material finish (all applied live on the gem's MeshStandardMaterial)
  metalness: number;
  roughness: number;
  emissiveIntensity: number;
  // faceted wireframe overlay
  wireColor: string;
  wireOpacity: number;
  // flair
  accent: string; // sparkle + accent colour
  palette: string[]; // particle-burst colours
  sparkle: boolean; // twinkling sprites around the gem
  shimmer: boolean; // animated iridescent emissive
}

export const DEFAULT_SKIN_ID = 'crystal';

export const GEM_SKINS: GemSkin[] = [
  {
    id: 'crystal',
    name: 'Crystal',
    emoji: '💎',
    blurb: 'The classic clear gem',
    cost: 0,
    metalness: 0.12,
    roughness: 0.28,
    emissiveIntensity: 0.6,
    wireColor: '#000000',
    wireOpacity: 0.14,
    accent: '#22d3ee',
    palette: ['#7c3aed', '#22d3ee', '#c6f24e', '#fb7185'],
    sparkle: false,
    shimmer: false,
  },
  {
    id: 'frost',
    name: 'Frost',
    emoji: '❄️',
    blurb: 'Icy and matte, with a chill twinkle',
    cost: 3000,
    metalness: 0.0,
    roughness: 0.72,
    emissiveIntensity: 0.4,
    wireColor: '#ffffff',
    wireOpacity: 0.22,
    accent: '#a9e8ff',
    palette: ['#bce8ff', '#e6f7ff', '#8fd4ff'],
    sparkle: true,
    shimmer: false,
  },
  {
    id: 'bubblegum',
    name: 'Bubblegum',
    emoji: '🍬',
    blurb: 'Glossy candy pop',
    cost: 4500,
    metalness: 0.05,
    roughness: 0.2,
    emissiveIntensity: 0.72,
    wireColor: '#ffffff',
    wireOpacity: 0.1,
    accent: '#ff8ad1',
    palette: ['#ff8ad1', '#8ad1ff', '#fff29a', '#c6f24e'],
    sparkle: false,
    shimmer: false,
  },
  {
    id: 'rose',
    name: 'Rose Quartz',
    emoji: '🌸',
    blurb: 'Soft pink pearl with sparkle',
    cost: 7500,
    metalness: 0.28,
    roughness: 0.34,
    emissiveIntensity: 0.6,
    wireColor: '#ffd6e8',
    wireOpacity: 0.18,
    accent: '#ff9ec4',
    palette: ['#ff9ec4', '#ffd1e6', '#ffb3c8'],
    sparkle: true,
    shimmer: false,
  },
  {
    id: 'mint',
    name: 'Mint',
    emoji: '🌿',
    blurb: 'Fresh minty pearl',
    cost: 7500,
    metalness: 0.22,
    roughness: 0.4,
    emissiveIntensity: 0.55,
    wireColor: '#d6fff0',
    wireOpacity: 0.16,
    accent: '#7ff0c8',
    palette: ['#7ff0c8', '#c6ffe9', '#a9ffd6'],
    sparkle: true,
    shimmer: false,
  },
  {
    id: 'gold',
    name: 'Gold',
    emoji: '🏆',
    blurb: 'Molten, luxurious metal',
    cost: 12000,
    metalness: 0.92,
    roughness: 0.3,
    emissiveIntensity: 0.4,
    wireColor: '#6b4e00',
    wireOpacity: 0.2,
    accent: '#ffd24a',
    palette: ['#ffd24a', '#ffae3a', '#fff3c0'],
    sparkle: false,
    shimmer: false,
  },
  {
    id: 'amethyst',
    name: 'Amethyst',
    emoji: '🔮',
    blurb: 'Deep purple jewel, sparkling',
    cost: 12000,
    metalness: 0.5,
    roughness: 0.25,
    emissiveIntensity: 0.7,
    wireColor: '#2a0a4a',
    wireOpacity: 0.2,
    accent: '#c78bff',
    palette: ['#b069e6', '#e3bdff', '#7c3aed'],
    sparkle: true,
    shimmer: false,
  },
  {
    id: 'neon',
    name: 'Neon',
    emoji: '⚡',
    blurb: 'Glows in the dark',
    cost: 15000,
    metalness: 0.0,
    roughness: 0.35,
    emissiveIntensity: 1.45,
    wireColor: '#00ffe0',
    wireOpacity: 0.25,
    accent: '#22d3ee',
    palette: ['#22d3ee', '#c6f24e', '#fb7185'],
    sparkle: false,
    shimmer: false,
  },
  {
    id: 'aurora',
    name: 'Aurora',
    emoji: '🌈',
    blurb: 'Iridescent shimmer that never sits still',
    cost: 21000,
    metalness: 0.4,
    roughness: 0.3,
    emissiveIntensity: 0.8,
    wireColor: '#ffffff',
    wireOpacity: 0.18,
    accent: '#7cf0e0',
    palette: ['#7c3aed', '#22d3ee', '#c6f24e', '#fb7185'],
    sparkle: true,
    shimmer: true,
  },
  {
    id: 'galaxy',
    name: 'Galaxy',
    emoji: '🌌',
    blurb: 'A pocket of starry night',
    cost: 24000,
    metalness: 0.72,
    roughness: 0.4,
    emissiveIntensity: 0.6,
    wireColor: '#9a8cff',
    wireOpacity: 0.22,
    accent: '#b9aeff',
    palette: ['#9a8cff', '#e0d9ff', '#6c5cff', '#ffffff'],
    sparkle: true,
    shimmer: false,
  },
  {
    id: 'unicorn',
    name: 'Unicorn',
    emoji: '🦄',
    blurb: 'Rainbow shimmer + sparkle — the dream',
    cost: 37500,
    metalness: 0.35,
    roughness: 0.28,
    emissiveIntensity: 0.9,
    wireColor: '#ffffff',
    wireOpacity: 0.16,
    accent: '#ff9ec4',
    palette: ['#ff9ec4', '#a9f7ff', '#c6f24e', '#ffd24a', '#b069e6'],
    sparkle: true,
    shimmer: true,
  },
];

export function getSkin(id: string): GemSkin {
  return GEM_SKINS.find(s => s.id === id) ?? GEM_SKINS[0];
}
