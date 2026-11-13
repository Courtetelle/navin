import {
  METEO_FRANCE,
  OPEN_WIND_MAP,
  mfGust,
  mfRows,
} from './coastStations.ts';
import { smnNow } from './externals.ts';
import type { KeptReading, KeptStations } from './liveStore.ts';
import { readKept, readStation, writeKept } from './liveStore.ts';
import type { StationRow } from './windModels.ts';

/** One measurement of the trend. */
export interface WindPoint {
  /** Epoch milliseconds. */
  t: number;
  /** Mean wind in knots. */
  avg: number;
  /** Gusts in knots, null when the station gives none. */
  gust: number | null;
  /**
   * Direction in degrees.
   * @default undefined
   */
  dir?: number | null;
  /**
   * Air temperature in °C.
   * @default undefined
   */
  air?: number | null;
  /**
   * Sea-level pressure in hPa.
   * @default undefined
   */
  baro?: number | null;
}

/** Where the wind goes. */
export interface WindTrend {
  /** `up`, `down` or `flat`. */
  way: 'up' | 'down' | 'flat';
  /** Change of the mean wind, in knots. */
  change: number;
  /** Over how many minutes. */
  minutes: number;
}

/** Length of the trend shown first. */
export const HISTORY_MS = 3 * 3_600_000;
/** Lengths of trend offered, in hours. */
export const HISTORY_SPANS = [3, 12, 24] as const;
/** Measurements kept on the phone: a day. */
const KEEP_MS = 24 * 3_600_000;
/** Two points kept are at least this far apart. */
const KEEP_STEP_MS = 8 * 60_000;
/** A change smaller than this is "stable". */
const FLAT_KN = 3;
const KMH_TO_KN = 1 / 1.852;
const MS_TO_KN = 3600 / 1852;
const OWM_ARCHIVE = 'https://api.pioupiou.fr/v1/archive/';
/** Stations kept at most: every station within 60 km, with room to move. */
const SEEN_STATIONS = 400;
const SEEN_POINTS = Math.ceil(KEEP_MS / KEEP_STEP_MS) + 10;

/** A station whose past is asked. */
interface HistoryStation {
  id: string;
  net: string;
}

/**
 * The wind of a station over the last hours, oldest first: the past the
 * network keeps (MeteoSwiss, OpenWindMap, Météo-France when it gives it),
 * completed by the measurements this phone has already read.
 * @param station - The station.
 * @param mfKey - Météo-France key.
 * @param now - Epoch milliseconds.
 * @param span - Length asked, in milliseconds.
 * @returns The points, empty when nothing is known.
 */
export async function stationHistory(
  station: HistoryStation,
  mfKey: string,
  now: number,
  span = HISTORY_MS,
): Promise<WindPoint[]> {
  let points: WindPoint[] = [];
  try {
    points = await networkHistory(station, mfKey, now, span);
  } catch {
    points = [];
  }
  return mergePoints(points, await seenPoints(station), now, span);
}

async function networkHistory(
  station: HistoryStation,
  mfKey: string,
  now: number,
  span: number,
): Promise<WindPoint[]> {
  if (station.net === OPEN_WIND_MAP) {
    const start = new Date(now - span).toISOString();
    const response = await fetch(
      `${OWM_ARCHIVE}${encodeURIComponent(station.id)}?start=${start}&stop=now`,
      { signal: AbortSignal.timeout(15_000) },
    );
    return response.ok ? owmPoints(await response.json()) : [];
  }
  if (station.net === METEO_FRANCE) {
    return mfKey ? mfPoints(await mfRows(station.id, mfKey)) : [];
  }
  return smnPoints(await smnNow(station.id));
}

/**
 * Points of an OpenWindMap archive (km/h).
 * @param reply - The archive reply.
 * @returns The points.
 */
export function owmPoints(reply: unknown): WindPoint[] {
  const data = (reply as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const points: WindPoint[] = [];
  for (const row of data as unknown[]) {
    if (!Array.isArray(row)) continue;
    const t = Date.parse(String(row[0]));
    const avg = row[4] as unknown;
    const max = row[5] as unknown;
    if (!Number.isFinite(t) || typeof avg !== 'number') continue;
    points.push({
      t,
      avg: avg * KMH_TO_KN,
      gust: typeof max === 'number' ? max * KMH_TO_KN : null,
    });
  }
  return points;
}

/**
 * Points of MeteoSwiss rows (km/h, as text).
 * @param rows - Rows of the `_t_now` file.
 * @returns The points.
 */
export function smnPoints(rows: readonly StationRow[]): WindPoint[] {
  const points: WindPoint[] = [];
  for (const row of rows) {
    const avg = Number(row.fu3010z0);
    if (row.fu3010z0 == null || !Number.isFinite(avg)) continue;
    const gust = Number(row.fu3010z1);
    points.push({
      t: row.t,
      avg: avg * KMH_TO_KN,
      gust:
        row.fu3010z1 == null || !Number.isFinite(gust)
          ? null
          : gust * KMH_TO_KN,
    });
  }
  return points;
}

/**
 * Points of Météo-France rows (m/s).
 * @param rows - Rows of `station/infrahoraire-6m`.
 * @returns The points.
 */
export function mfPoints(
  rows: ReadonlyArray<Readonly<Record<string, unknown>>>,
): WindPoint[] {
  const points: WindPoint[] = [];
  for (const row of rows) {
    const time = row.validity_time ?? row.reference_time;
    const t = typeof time === 'string' ? Date.parse(time) : Number.NaN;
    if (typeof row.ff !== 'number' || !Number.isFinite(t)) continue;
    const gust = mfGust(row);
    points.push({
      t,
      avg: row.ff * MS_TO_KN,
      gust: gust == null ? null : gust * MS_TO_KN,
    });
  }
  return points;
}

/**
 * Points of two sources together, within the hours shown, oldest first; a
 * point less than a minute from another is dropped.
 * @param a - Points.
 * @param b - Other points.
 * @param now - Epoch milliseconds.
 * @param span - Length kept, in milliseconds.
 * @returns The points.
 */
export function mergePoints(
  a: readonly WindPoint[],
  b: readonly WindPoint[],
  now: number,
  span = HISTORY_MS,
): WindPoint[] {
  const sorted = [...a, ...b]
    .filter((point) => point.t > now - span && point.t <= now + 60_000)
    .toSorted((x, y) => x.t - y.t);
  const kept: WindPoint[] = [];
  for (const point of sorted) {
    const last = kept.at(-1);
    if (!last || point.t - last.t >= 60_000) kept.push(point);
  }
  return kept;
}

/**
 * Where the mean wind goes: the last 20 minutes against about an hour before.
 * @param points - Points, oldest first.
 * @returns The trend, null without enough past.
 */
export function windTrend(points: readonly WindPoint[]): WindTrend | null {
  const last = points.at(-1);
  if (!last) return null;
  const recent = points.filter((point) => point.t > last.t - 20 * 60_000);
  const before = points.filter(
    (point) =>
      point.t <= last.t - 45 * 60_000 && point.t > last.t - 90 * 60_000,
  );
  const first = before[0];
  if (!first || recent.length === 0) return null;
  const change = mean(recent) - mean(before);
  const minutes = Math.round((last.t - first.t) / 60_000 / 5) * 5;
  const way = Math.abs(change) < FLAT_KN ? 'flat' : change > 0 ? 'up' : 'down';
  return { way, change, minutes };
}

function mean(points: readonly WindPoint[]): number {
  return points.reduce((sum, point) => sum + point.avg, 0) / points.length;
}

/**
 * Keep the measurements read for a day, one every 8 minutes at most, with
 * all a station gives (wind, gusts, direction, air, pressure), so that the
 * trend is there wherever the boat is, even when the network keeps no past.
 * @param stations - Stations just read.
 * @param now - Epoch milliseconds.
 * @returns Resolves when written.
 */
export async function rememberReadings(
  stations: ReadonlyArray<HistoryStation & WindPoint>,
  now: number,
): Promise<void> {
  if (stations.length === 0) return;
  const seen = await readKept().catch((): KeptStations => ({}));
  const changed: KeptStations = {};
  for (const station of stations) {
    const key = `${station.net}:${station.id}`;
    const list = (seen[key] ?? []).filter(([t]) => t > now - KEEP_MS);
    const last = list.at(-1);
    if (!last || station.t - last[0] >= KEEP_STEP_MS) {
      list.push([
        station.t,
        round(station.avg),
        station.gust == null ? null : round(station.gust),
        station.dir == null ? null : Math.round(station.dir),
        station.air == null ? null : round(station.air),
        station.baro == null ? null : round(station.baro),
      ]);
    }
    seen[key] = list.slice(-SEEN_POINTS);
    changed[key] = seen[key];
  }
  const ranked = Object.entries(seen)
    .filter(([, list]) => list.some(([t]) => t > now - KEEP_MS))
    .toSorted((x, y) => (y[1].at(-1)?.[0] ?? 0) - (x[1].at(-1)?.[0] ?? 0));
  const keep = new Set(ranked.slice(0, SEEN_STATIONS).map(([key]) => key));
  const gone = Object.keys(seen).filter((key) => !keep.has(key));
  await writeKept(changed, gone).catch(() => undefined);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

async function seenPoints(station: HistoryStation): Promise<WindPoint[]> {
  const list = await readStation(`${station.net}:${station.id}`);
  return list.map(([t, avg, gust, dir, air, baro]: KeptReading): WindPoint => ({
    t,
    avg,
    gust,
    dir,
    air,
    baro,
  }));
}
