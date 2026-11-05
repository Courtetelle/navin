import { outingTimes } from '../../features/onwater/externals.ts';
import { fmtDur, keyToDate, num, pad } from '../../lib/format.ts';
import type { Cruise, CruiseMeta } from '../../model/types.ts';
import { daysWithData, navForDay } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** One day of outing. */
export interface LakeDay {
  /** Day key. */
  k: string;
  boatId: string | undefined;
  /** Miles. */
  nm: number;
  /** Navigation milliseconds. */
  ms: number;
}

/** Totals of a period. */
export interface PeriodTotal {
  label: string;
  /** Outings. */
  n: number;
  nm: number;
  ms: number;
}

/**
 * One line per outing day of the lake outings: miles of the sheet, else of the
 * GPS track, and navigation time (legacy `lakeDays`).
 * @param index - Cruise index.
 * @returns The days.
 */
export function lakeDays(index: readonly CruiseMeta[]): LakeDay[] {
  const days: LakeDay[] = [];
  for (const meta of index) {
    if (meta.type !== 'lac') continue;
    const cruise = store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null);
    if (!cruise) continue;
    for (const key of daysWithData(cruise)) {
      const outing = outingTimes(key, cruise);
      const nm =
        num(cruise.days[key]?.nmJour) ?? (outing.nm > 0.05 ? outing.nm : 0);
      const ms =
        navForDay(key, cruise).ms ||
        (outing.t0 && outing.t1 ? outing.t1 - outing.t0 : 0);
      if (nm || ms) days.push({ k: key, boatId: cruise.boatId, nm, ms });
    }
  }
  return days;
}

/**
 * ISO week of a date (legacy `isoWeek`).
 * @param date - Date.
 * @returns ISO year and week number.
 */
export function isoWeek(date: Date): [number, number] {
  const thursday = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = thursday.getUTCDay() || 7;
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const year = thursday.getUTCFullYear();
  const days = (thursday.getTime() - Date.UTC(year, 0, 1)) / 86_400_000;
  return [year, Math.ceil((days + 1) / 7)];
}

/**
 * Group key and label of a day (legacy `periodOf`).
 * @param key - Day key.
 * @param period - `'annee'`, `'mois'` or `'semaine'`.
 * @returns Sort key and label.
 */
export function periodOf(key: string, period: string): [string, string] {
  const date = keyToDate(key);
  const year = date.getFullYear();
  if (period === 'annee') return [String(year), String(year)];
  if (period === 'mois') {
    return [
      `${year}-${pad(date.getMonth() + 1)}`,
      `${MONTHS[date.getMonth()]} ${year}`,
    ];
  }
  const [isoYear, week] = isoWeek(date);
  return [`${isoYear}-${pad(week)}`, `Semaine ${week} · ${isoYear}`];
}

/** What the screen shows for a choice of boats and period. */
export interface StatsSummary {
  /** Grand total. */
  total: Omit<PeriodTotal, 'label'>;
  /** Periods, newest first. */
  periods: Array<[string, PeriodTotal]>;
  /** Longest distance of a period, 1 at least. */
  max: number;
}

/**
 * Totals per period (legacy `VIEWS.stats`).
 * @param days - Outing days.
 * @param boats - Boats chosen, none meaning all.
 * @param period - `'annee'`, `'mois'` or `'semaine'`.
 * @returns The summary.
 */
export function statsSummary(
  days: readonly LakeDay[],
  boats: ReadonlySet<string>,
  period: string,
): StatsSummary {
  const groups = new Map<string, PeriodTotal>();
  const total = { n: 0, nm: 0, ms: 0 };
  for (const day of days) {
    if (boats.size > 0 && !boats.has(day.boatId as string)) continue;
    const [key, label] = periodOf(day.k, period);
    const group = groups.get(key) ?? { label, n: 0, nm: 0, ms: 0 };
    group.n++;
    group.nm += day.nm;
    group.ms += day.ms;
    groups.set(key, group);
    total.n++;
    total.nm += day.nm;
    total.ms += day.ms;
  }
  const periods = [...groups.entries()].toSorted((a, b) =>
    b[0].localeCompare(a[0]),
  );
  let max = 1;
  for (const [, group] of periods) max = Math.max(max, group.nm);
  return { total, periods, max };
}

/**
 * Hours shown on the screen (legacy `fmtHours`).
 * @param milliseconds - Duration.
 * @returns The text.
 */
export function fmtHours(milliseconds: number): string {
  return fmtDur(milliseconds);
}
