/**
 * The steepness of the waves (H / L): whether a sea stays a long, round
 * swell or becomes a short, breaking one. L comes from the period, in deep
 * water: L ≈ 1.56 × T².
 */

/** A class of steepness, from gentle to breaking. */
export interface SteepClass {
  /** 0 gentle … 4 breaking. */
  level: number;
  /** In a word. */
  name: string;
  /** What it does to a boat. */
  text: string;
  /** Colour of the class. */
  color: string;
  /** Text on that colour. */
  ink: string;
  /** Lowest steepness of the class (H / L). */
  from: number;
}

/**
 * The classes, as the sailors' tables put them (3 m of waves: 14 s gentle,
 * 9 s formed, 6 s steep and choppy, 4.5 s critical) and the physical limit
 * of 1/7, where the crest breaks.
 */
export const STEEP_CLASSES: readonly SteepClass[] = [
  {
    level: 0,
    name: 'Houle douce',
    text: 'vague longue et arrondie : le bateau monte et descend en douceur (puissante près des côtes et des hauts-fonds)',
    color: '#4caf50',
    ink: '#000',
    from: 0,
  },
  {
    level: 1,
    name: 'Mer formée',
    text: 'mouvements amples, navigation active, sans choc brutal',
    color: '#cddc39',
    ink: '#000',
    from: 1 / 50,
  },
  {
    level: 2,
    name: 'Mer raide et hachée',
    text: 'le bateau tape dans les vagues, fatigue rapide de l’équipage et du matériel',
    color: '#ff9800',
    ink: '#000',
    from: 1 / 25,
  },
  {
    level: 3,
    name: 'Zone critique',
    text: 'vagues presque verticales, déferlantes fréquentes : danger majeur pour un petit bateau',
    color: '#e53935',
    ink: '#fff',
    from: 1 / 12,
  },
  {
    level: 4,
    name: 'Déferlante',
    text: 'au-delà de 1/7 la crête s’effondre : une déferlante de 30 à 50 % de la longueur du bateau peut le chavirer par le travers',
    color: '#6a1b9a',
    ink: '#fff',
    from: 1 / 7,
  },
];

/**
 * The length of a wave in deep water from its period.
 * @param period - Seconds.
 * @returns Metres.
 */
export function deepWavelength(period: number): number {
  return 1.56 * period * period;
}

/** The steepness of a train of waves. */
export interface Steepness {
  /** H / L. */
  ratio: number;
  /** L / H, rounded: « 1/18 ». */
  oneIn: number;
  /** Wavelength, metres. */
  length: number;
  /** Its class. */
  steep: SteepClass;
  /** Under 1 m: steep or not, discomfort rather than danger. */
  small: boolean;
}

/** Under this height (metres) steep waves are a discomfort, not a danger. */
export const SMALL_WAVES_M = 1;

/**
 * The steepness of waves of a height and a period.
 * @param height - Significant height, metres.
 * @param period - Period, seconds.
 * @returns The steepness, or null without a height or a period.
 */
export function steepnessOf(
  height: number | null | undefined,
  period: number | null | undefined,
): Steepness | null {
  if (height == null || period == null || height <= 0 || period <= 0) {
    return null;
  }
  const length = deepWavelength(period);
  const ratio = height / length;
  let steep = STEEP_CLASSES[0] as SteepClass;
  for (const one of STEEP_CLASSES) if (ratio >= one.from) steep = one;
  return {
    ratio,
    oneIn: Math.round(length / height),
    length,
    steep,
    small: height < SMALL_WAVES_M,
  };
}

/**
 * The sailors' rule without a calculator: the period in seconds against the
 * height in metres.
 * @param height - Significant height, metres.
 * @param period - Period, seconds.
 * @returns What it says, or null.
 */
export function periodRule(
  height: number | null | undefined,
  period: number | null | undefined,
): string | null {
  if (height == null || period == null || height <= 0 || period <= 0) {
    return null;
  }
  const times = period / height;
  if (times >= 3) return 'T ≥ 3 × H : mer maniable';
  if (times > 1.2) return 'T ≈ 2 × H : mer agitée, le bateau tape';
  return 'T ≤ H : mer « carrée », vagues serrées et dangereuses';
}

/**
 * Whether the current runs against the waves (it steepens them: shorter,
 * higher, breaking without more wind).
 * @param waveFrom - Where the waves come from, degrees.
 * @param currentToward - Where the current goes, degrees.
 * @returns Against, within 45°.
 */
export function currentAgainst(
  waveFrom: number | null | undefined,
  currentToward: number | null | undefined,
): boolean {
  if (waveFrom == null || currentToward == null) return false;
  // The waves go toward waveFrom + 180: against them, the current goes
  // toward waveFrom.
  const gap = Math.abs(
    ((((currentToward - waveFrom) % 360) + 540) % 360) - 180,
  );
  return gap <= 45;
}
