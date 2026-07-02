/**
 * Color Hide — pure data + colour maths (no Angular, no Three.js).
 *
 * Everything the game needs to reason about colour lives here as small, testable
 * functions: HSL↔RGB↔CIE-Lab conversions, a perceptual ΔE distance (so "close"
 * feels close to the human eye), the difficulty ladder, round generators and the
 * scoring rules shared by both modes.
 */

export type GameMode = 'mix' | 'seek';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'ohmyeyes';
export type Instrument = 'wheel' | 'bars';
export type Channels = 'hsl' | 'rgb';
export type Grade = 'perfect' | 'great' | 'good' | 'close' | 'off';

export interface HSL {
  h: number; // 0..360
  s: number; // 0..100
  l: number; // 0..100
}
export interface RGB {
  r: number; // 0..255
  g: number;
  b: number;
}
export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface DifficultyConfig {
  key: Difficulty;
  label: string;
  emoji: string;
  blurb: string;
  /** Which channels are randomised for the Mix target. Fixed ones use the values below. */
  vary: { h: boolean; s: boolean; l: boolean };
  fixedS: number;
  fixedL: number;
  /** How long the target colour is shown before it "hides" (ms). */
  revealMs: number;
  /** Muted / low-contrast palette — the "oh my eyes!" cruelty. */
  muted: boolean;
  /** Seek grid is grid×grid tiles. */
  grid: number;
  /** Perceptual gap (≈ ΔE) between the odd Seek tile and the rest. */
  seekGap: number;
  /** Score multiplier for the tier. */
  pointsMult: number;
}

export const DIFFICULTIES: DifficultyConfig[] = [
  {
    key: 'easy',
    label: 'Easy',
    emoji: '🟢',
    blurb: 'Hue only · 4s to memorise',
    vary: { h: true, s: false, l: false },
    fixedS: 72,
    fixedL: 56,
    revealMs: 4000, // memorise window in milliseconds (4s)
    muted: false,
    grid: 3,
    seekGap: 26,
    pointsMult: 1.0,
  },
  {
    key: 'medium',
    label: 'Medium',
    emoji: '🔵',
    blurb: 'Hue + saturation · 3s',
    vary: { h: true, s: true, l: false },
    fixedS: 72,
    fixedL: 56,
    revealMs: 3000,
    muted: false,
    grid: 4,
    seekGap: 15,
    pointsMult: 1.25,
  },
  {
    key: 'hard',
    label: 'Hard',
    emoji: '🟣',
    blurb: 'Hue + sat + light · 2s',
    vary: { h: true, s: true, l: true },
    fixedS: 72,
    fixedL: 56,
    revealMs: 2000,
    muted: false,
    grid: 5,
    seekGap: 9,
    pointsMult: 1.6,
  },
  {
    key: 'ohmyeyes',
    label: 'Oh my eyes!',
    emoji: '🔥',
    blurb: 'Muted palette · a 1.5s flash',
    vary: { h: true, s: true, l: true },
    fixedS: 72,
    fixedL: 56,
    revealMs: 1500,
    muted: true,
    grid: 6,
    seekGap: 5,
    pointsMult: 2.2,
  },
];

export function difficultyByKey(key: Difficulty): DifficultyConfig {
  return DIFFICULTIES.find(d => d.key === key) ?? DIFFICULTIES[0];
}

export const GAME_DURATION = 60; // seconds — a Color Hide run

export const GRADE_LABEL: Record<Grade, string> = {
  perfect: 'PERFECT!',
  great: 'GREAT!',
  good: 'GOOD',
  close: 'CLOSE',
  off: 'OFF',
};

/** Juice palettes per grade (brand-adjacent). */
export const GRADE_COLORS: Record<Grade, string[]> = {
  perfect: ['#c6f24e', '#22d3ee', '#7c3aed', '#fff7cc'],
  great: ['#22d3ee', '#5b5bf5', '#a9f7ff'],
  good: ['#5b5bf5', '#7c3aed', '#c9c7ff'],
  close: ['#fb7185', '#febc2e', '#ffd8a8'],
  off: ['#9aa0b5', '#6f6f8a', '#c9cede'],
};

// ---------------------------------------------------------------------------
// small maths helpers
// ---------------------------------------------------------------------------
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function mod360(h: number): number {
  return ((h % 360) + 360) % 360;
}

// ---------------------------------------------------------------------------
// HSL ↔ RGB
// ---------------------------------------------------------------------------
export function hslToRgb(hsl: HSL): RGB {
  const h = mod360(hsl.h);
  const s = clamp(hsl.s, 0, 100) / 100;
  const l = clamp(hsl.l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function rgbToHsl(rgb: RGB): HSL {
  const r = clamp(rgb.r, 0, 255) / 255;
  const g = clamp(rgb.g, 0, 255) / 255;
  const b = clamp(rgb.b, 0, 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

// ---------------------------------------------------------------------------
// RGB ↔ CIE-Lab (D65) — used for perceptual distance
// ---------------------------------------------------------------------------
function srgbToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return clamp(Math.round(v * 255), 0, 255);
}

export function rgbToLab(rgb: RGB): Lab {
  const R = srgbToLinear(rgb.r);
  const G = srgbToLinear(rgb.g);
  const B = srgbToLinear(rgb.b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToRgb(lab: Lab): RGB {
  const fy = (lab.L + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;
  const fi = (t: number): number => {
    const t3 = t * t * t;
    return t3 > 0.008856 ? t3 : (t - 16 / 116) / 7.787;
  };
  const x = fi(fx) * 0.95047;
  const y = fi(fy);
  const z = fi(fz) * 1.08883;
  const R = x * 3.2406 + y * -1.5372 + z * -0.4986;
  const G = x * -0.9689 + y * 1.8758 + z * 0.0415;
  const B = x * 0.0557 + y * -0.204 + z * 1.057;
  return { r: linearToSrgb(R), g: linearToSrgb(G), b: linearToSrgb(B) };
}

/** CIE76 ΔE between two Lab colours. */
export function deltaE(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

export function hslDeltaE(a: HSL, b: HSL): number {
  return deltaE(rgbToLab(hslToRgb(a)), rgbToLab(hslToRgb(b)));
}

// ---------------------------------------------------------------------------
// accuracy, grades & scoring
// ---------------------------------------------------------------------------
/** ΔE that maps to 0% accuracy. ~90 covers "wildly wrong" while keeping the
 *  Perfect/Great bands meaningfully tight. */
export const DELTA_E_MAX = 90;

export function accuracyFromDelta(de: number): number {
  return clamp(100 * (1 - de / DELTA_E_MAX), 0, 100);
}

export function gradeForAccuracy(acc: number): Grade {
  if (acc >= 98) return 'perfect';
  if (acc >= 92) return 'great';
  if (acc >= 80) return 'good';
  if (acc >= 60) return 'close';
  return 'off';
}

/** Combo/streak multiplier — 1 + 0.1·n, capped at ×5 (mirrors the arcade games). */
export function chainMultiplier(chain: number): number {
  return 1 + Math.min(chain * 0.1, 4);
}

/** Points for a Mix match. */
export function mixPoints(accuracy: number, combo: number, tierMult: number): number {
  const base = 100 * (accuracy / 100);
  const perfectBonus = accuracy >= 98 ? 40 : 0;
  return Math.round((base + perfectBonus) * chainMultiplier(combo) * tierMult);
}

/** Points for a correct Seek find. */
export function seekPoints(streak: number, tierMult: number): number {
  return Math.round(60 * chainMultiplier(streak) * tierMult);
}

// ---------------------------------------------------------------------------
// round generators
// ---------------------------------------------------------------------------
type Rnd = () => number;

/** A pleasing, readable target colour for the given tier. */
export function randomTarget(cfg: DifficultyConfig, rnd: Rnd): HSL {
  const h = rnd() * 360;
  let s: number;
  let l: number;
  if (cfg.muted) {
    // low-contrast, desaturated band — genuinely hard to read
    s = 18 + rnd() * 26; // 18..44
    l = 40 + rnd() * 26; // 40..66
  } else {
    s = cfg.vary.s ? 42 + rnd() * 52 : cfg.fixedS; // 42..94
    l = cfg.vary.l ? 34 + rnd() * 44 : cfg.fixedL; // 34..78
  }
  return { h, s, l };
}

/** Nudge a colour by ~deltaETarget in Lab space in a random direction. */
export function nudgeHsl(base: HSL, deltaETarget: number, rnd: Rnd): HSL {
  const lab = rgbToLab(hslToRgb(base));
  const ang = rnd() * Math.PI * 2;
  const dir = { L: rnd() * 2 - 1, a: Math.cos(ang), b: Math.sin(ang) };
  const norm = Math.hypot(dir.L, dir.a, dir.b) || 1;
  const k = deltaETarget / norm;
  const nlab: Lab = {
    L: clamp(lab.L + dir.L * k, 6, 94),
    a: lab.a + dir.a * k,
    b: lab.b + dir.b * k,
  };
  return rgbToHsl(labToRgb(nlab));
}

export interface SeekBoard {
  base: HSL;
  odd: HSL;
  oddIndex: number;
  count: number;
}

export function makeSeekBoard(cfg: DifficultyConfig, rnd: Rnd): SeekBoard {
  const base = randomTarget(cfg, rnd);
  const count = cfg.grid * cfg.grid;
  const oddIndex = Math.floor(rnd() * count);
  const odd = nudgeHsl(base, cfg.seekGap, rnd);
  return { base, odd, oddIndex, count };
}

// ---------------------------------------------------------------------------
// css helpers
// ---------------------------------------------------------------------------
export function hslCss(hsl: HSL): string {
  return `hsl(${mod360(hsl.h).toFixed(1)} ${clamp(hsl.s, 0, 100).toFixed(1)}% ${clamp(
    hsl.l,
    0,
    100,
  ).toFixed(1)}%)`;
}

export function rgbCss(rgb: RGB): string {
  return `rgb(${rgb.r} ${rgb.g} ${rgb.b})`;
}

export function roundHsl(hsl: HSL): HSL {
  return { h: Math.round(mod360(hsl.h)), s: Math.round(hsl.s), l: Math.round(hsl.l) };
}

// ---------------------------------------------------------------------------
// teaching — signed channel deltas + friendly coaching
// ---------------------------------------------------------------------------
export interface ChannelDelta {
  dh: number; // target − guess hue, wrapped to −180..180
  ds: number; // target − guess saturation
  dl: number; // target − guess lightness
}

/** Shortest signed hue difference, −180..180. */
export function hueDelta(targetH: number, guessH: number): number {
  return (((targetH - guessH) % 360) + 540) % 360 - 180;
}

export function channelDeltas(target: HSL, guess: HSL): ChannelDelta {
  return {
    dh: Math.round(hueDelta(target.h, guess.h)),
    ds: Math.round(target.s - guess.s),
    dl: Math.round(target.l - guess.l),
  };
}

/** A short, kid-friendly reaction to a single match. */
export function encouragement(acc: number): string {
  if (acc >= 99) return 'Flawless! 🌟';
  if (acc >= 98) return 'Perfect eye! ✨';
  if (acc >= 92) return 'So close! 💫';
  if (acc >= 80) return 'Nice one! 👍';
  if (acc >= 60) return 'Getting warmer 🔥';
  return 'Keep going 💪';
}

/** A coaching tip from a run's worth of misses — names your biggest bias, gently. */
export function coachingTip(deltas: ChannelDelta[]): string {
  if (!deltas.length) return '';
  const avgAbs = (f: (d: ChannelDelta) => number): number =>
    deltas.reduce((s, d) => s + Math.abs(f(d)), 0) / deltas.length;
  const bias = (f: (d: ChannelDelta) => number): number =>
    deltas.reduce((s, d) => s + f(d), 0) / deltas.length;
  const ah = avgAbs(d => d.dh);
  const as = avgAbs(d => d.ds);
  const al = avgAbs(d => d.dl);
  const max = Math.max(ah, as, al);
  if (max < 4) return 'Incredible eye — hue, saturation and lightness all on point. 👑';
  if (max === al) {
    return bias(d => d.dl) > 0
      ? 'Tip: your colours lean a little dark — try nudging lightness up. 💡'
      : 'Tip: your colours lean a little bright — try nudging lightness down. 🌙';
  }
  if (max === as) {
    return bias(d => d.ds) > 0
      ? 'Tip: go a touch more vivid — push saturation up. 🌈'
      : 'Tip: ease the saturation down for a softer match. 🎨';
  }
  return 'Tip: watch the hue — a small turn of the wheel gets you there. 🎡';
}
