import type { ForecastRow } from '../../features/tracking/index.ts';

/** The evening, local time. */
export const EVENING_HOUR = 19;
/** Tomorrow morning, local time. */
export const MORNING_HOUR = 8;
/** « Dans 3 h ». */
const LATER_MS = 3 * 3_600_000;
/** A row of the forecast farther than this from a moment is not it. */
const NEAR_MS = 3_600_000;

/** One moment of the forecast of the PréP. */
export interface PrepMoment {
  /** `now`, `later`, `evening` or `morning`. */
  key: string;
  /** Words shown. */
  label: string;
  /** The hour of the forecast closest to the moment. */
  row: ForecastRow;
}

function closest(
  rows: readonly ForecastRow[],
  at: number,
): ForecastRow | undefined {
  let best: ForecastRow | undefined;
  for (const row of rows) {
    if (Math.abs(row.t - at) > NEAR_MS) continue;
    if (!best || Math.abs(row.t - at) < Math.abs(best.t - at)) best = row;
  }
  return best;
}

/**
 * The moments of the forecast before leaving: now, in 3 h, this evening
 * (only while it is more than 3 h away) and tomorrow morning.
 * @param rows - Hourly forecast.
 * @param now - Epoch milliseconds.
 * @returns The moments the forecast reaches.
 */
export function prepMoments(
  rows: readonly ForecastRow[],
  now: number,
): PrepMoment[] {
  const evening = new Date(now);
  evening.setHours(EVENING_HOUR, 0, 0, 0);
  const morning = new Date(now);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(MORNING_HOUR, 0, 0, 0);
  const wanted: Array<[string, string, number]> = [
    ['now', 'Maintenant', now],
    ['later', 'Dans 3 h', now + LATER_MS],
  ];
  if (evening.getTime() - now > LATER_MS) {
    wanted.push(['evening', 'Ce soir', evening.getTime()]);
  }
  wanted.push(['morning', 'Demain matin', morning.getTime()]);
  const moments: PrepMoment[] = [];
  for (const [key, label, at] of wanted) {
    const row = closest(rows, at);
    if (row) moments.push({ key, label, row });
  }
  return moments;
}
