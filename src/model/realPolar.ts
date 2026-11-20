/**
 * The real polar of a boat: what it made at sea, minute by minute, for each
 * set of sails, to set beside the polar of its certificate.
 */

import type { Polar } from './polars.ts';
import { foldAngle } from './polars.ts';

/** One box of the real polar: an angle to the wind and a wind speed. */
export interface RealBin {
  /** Minutes counted in it. */
  n: number;
  /** The best minutes, knots, fastest first. */
  best: number[];
}

/** What a boat made under one set of sails (`boat.realPolars[]`). */
export interface RealPolar {
  /** The sails: « GV haute · Génois », « GV 1 ris · Code 0 ». */
  sails: string;
  /** `"<twa>|<tws>"` → box. */
  bins: Record<string, RealBin>;
  /** First minute (ISO). */
  from: string;
  /** Last minute (ISO). */
  to: string;
}

/** The sails up, as the polar screen and the logbook give them. */
export interface SailsNow {
  /** Main sail: « Haute », « 1 ris »… */
  gv: string;
  /** Head sail or downwind sail: « Génois », « Code 0 »… */
  avant: string;
}

/** Best minutes kept in each box. */
const KEEP = 8;
/** Boxes of angles, degrees. */
export const REAL_TWA_STEP = 10;
/** Boxes of wind speeds, knots. */
export const REAL_TWS_STEP = 2;

/**
 * The name of a set of sails.
 * @param sails - The sails up.
 * @returns « GV haute · Génois ».
 */
export function sailsName(sails: SailsNow): string {
  const main = sails.gv.trim();
  const head = sails.avant.trim();
  return [main ? `GV ${main.toLowerCase()}` : '', head]
    .filter(Boolean)
    .join(' · ');
}

function down(value: string): boolean {
  return !value || /affal|aucune/i.test(value);
}

/**
 * Whether these sails make the boat sail: a main up or a head sail.
 * @param sails - The sails up.
 * @returns `false` under motor or bare poles.
 */
export function sailsSail(sails: SailsNow): boolean {
  return !down(sails.gv) || !down(sails.avant);
}

/**
 * The box of a minute.
 * @param twa - Angle to the wind, degrees (either side).
 * @param tws - Wind, knots.
 * @returns `"<twa>|<tws>"`, or `null` too close to the wind or with no wind.
 */
export function binKey(twa: number, tws: number): string | null {
  const angle = Math.round(foldAngle(twa) / REAL_TWA_STEP) * REAL_TWA_STEP;
  const wind = Math.round(tws / REAL_TWS_STEP) * REAL_TWS_STEP;
  if (angle < 30 || wind < 2 || wind > 40) return null;
  return `${angle}|${wind}`;
}

/**
 * Count one minute at sea in the real polar of its sails.
 * @param real - The real polar, or none yet.
 * @param sails - Its sails.
 * @param minute - Angle, wind, speed and time of the minute.
 * @returns The new real polar (the one given is not changed).
 */
export function addMinute(
  real: RealPolar | undefined,
  sails: string,
  minute: { twa: number; tws: number; kn: number; at: string },
): RealPolar {
  const base: RealPolar = real ?? {
    sails,
    bins: {},
    from: minute.at,
    to: minute.at,
  };
  const key = binKey(minute.twa, minute.tws);
  if (!key || !(minute.kn > 0) || minute.kn > 40) return base;
  const bin = base.bins[key] ?? { n: 0, best: [] };
  const best = [...bin.best, Math.round(minute.kn * 100) / 100]
    .toSorted((first, second) => second - first)
    .slice(0, KEEP);
  return {
    ...base,
    bins: { ...base.bins, [key]: { n: bin.n + 1, best } },
    from: [base.from, minute.at].toSorted()[0] as string,
    to: [base.to, minute.at].toSorted()[1] as string,
  };
}

/**
 * The speed of a box: the mean of its best minutes, the boat well trimmed.
 * @param bin - The box.
 * @returns Knots, 0 for an empty box.
 */
export function binSpeed(bin: RealBin | undefined): number {
  if (!bin || bin.best.length === 0) return 0;
  const sum = bin.best.reduce((total, value) => total + value, 0);
  return Math.round((sum / bin.best.length) * 100) / 100;
}

/**
 * The minutes counted in a real polar.
 * @param real - The real polar.
 * @returns Minutes.
 */
export function realMinutes(real: RealPolar): number {
  return Object.values(real.bins).reduce((sum, bin) => sum + bin.n, 0);
}

/**
 * The real polar as a table: the angles and winds met, 0 where the boat has
 * not sailed yet.
 * @param real - The real polar.
 * @returns The table.
 */
export function realToPolar(real: RealPolar): Polar {
  const keys = Object.keys(real.bins).map((key) => key.split('|').map(Number));
  const twa = [...new Set(keys.map(([angle]) => angle as number))].toSorted(
    (first, second) => first - second,
  );
  const tws = [...new Set(keys.map(([, wind]) => wind as number))].toSorted(
    (first, second) => first - second,
  );
  return {
    twa,
    tws,
    kn: twa.map((angle) =>
      tws.map((wind) => binSpeed(real.bins[`${angle}|${wind}`])),
    ),
  };
}

/**
 * Whether a value is a real polar as stored.
 * @param value - Anything.
 * @returns `true` for a {@link RealPolar}.
 */
export function isRealPolar(value: unknown): value is RealPolar {
  if (!value || typeof value !== 'object') return false;
  const { sails, bins } = value as Partial<RealPolar>;
  return typeof sails === 'string' && !!bins && typeof bins === 'object';
}

/**
 * The mean of angles, degrees, and how far they spread.
 * @param angles - Degrees.
 * @returns The mean (0–360) and the largest gap to it.
 */
export function angleMean(angles: readonly number[]): {
  mean: number;
  spread: number;
} {
  let x = 0;
  let y = 0;
  for (const angle of angles) {
    x += Math.cos((angle * Math.PI) / 180);
    y += Math.sin((angle * Math.PI) / 180);
  }
  const mean = ((((Math.atan2(y, x) * 180) / Math.PI) % 360) + 360) % 360;
  let spread = 0;
  for (const angle of angles) {
    const gap = Math.abs(((angle - mean + 540) % 360) - 180);
    spread = Math.max(spread, gap);
  }
  return { mean, spread };
}
