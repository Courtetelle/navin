/**
 * The archive of the stations of the LiveMétéo zones, kept by GitHub (the
 * workflow « Stations des zones LiveMétéo », branch `stations`): every
 * badge of the map, buoys and stations, of the zones active in NavIn, read
 * every half hour. One file per day (UTC), `releves/AAAA-MM-JJ.json`, and
 * `index.json` that says what was read last.
 */

/** The branch of the repository where the archive is kept. */
export const ARCHIVE_BRANCH = 'stations';
/** The workflow that keeps it. */
export const ARCHIVE_WORKFLOW = 'stations.yml';
/** The file of the zones active, in the archive. */
export const ACTIVE_FILE = 'zones-actives.json';
/** The folder of the days. */
export const DAYS_DIR = 'releves/';
/** Days listed in the index, newest first. */
const DAYS_LISTED = 62;

/** One measurement: time (epoch ms), mean, gust (kn), direction, air, pressure. */
export type ArchivePoint = [
  t: number,
  avg: number,
  gust: number | null,
  dir: number | null,
  air: number | null,
  baro: number | null,
];

/** A station of the archive. */
export interface ArchivedStation {
  name: string;
  net: string;
  lat: number;
  lon: number;
  /** The zones it stands in. */
  zones: string[];
  /** Its measurements, oldest first, each time once. */
  points: ArchivePoint[];
}

/** One day of the archive. */
export interface ArchiveDay {
  /** `AAAA-MM-JJ`, UTC. */
  date: string;
  /** By `net:id`. */
  stations: Record<string, ArchivedStation>;
}

/** The zones active, as NavIn sent them. */
export interface ActiveZones {
  ids: string[];
  /** When NavIn sent them (ISO). */
  at: string;
}

/** What the archive says of itself. */
export interface ArchiveIndex {
  /** Last reading (ISO). */
  at: string;
  /** The zones read. */
  zones: string[];
  /** Stations read last time, and by network. */
  last: { stations: number; nets: Record<string, number> };
  /** The days kept, newest first. */
  days: Array<{ date: string; stations: number; points: number }>;
}

/** A reading to archive (a badge of the map). */
export interface ArchiveReading {
  id: string;
  net: string;
  name: string;
  lat: number;
  lon: number;
  t: number;
  avg: number;
  gust: number | null;
  dir: number | null;
  air?: number | null;
  baro?: number | null;
}

/**
 * The day of a time, UTC.
 * @param t - Epoch milliseconds.
 * @returns `AAAA-MM-JJ`.
 */
export function dayOf(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * The zones active read from the archive, none when it is not one.
 * @param value - The file read.
 * @returns The zones.
 */
export function parseActive(value: unknown): ActiveZones {
  const ids = (value as { ids?: unknown } | null)?.ids;
  const at = (value as { at?: unknown } | null)?.at;
  return {
    ids: Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [],
    at: typeof at === 'string' ? at : '',
  };
}

/**
 * The zones NavIn sends, from the text of the workflow input: ids separated
 * by commas, « aucune » or empty for none; only the ids known are kept.
 * @param text - The input.
 * @param known - The ids of the zones.
 * @returns The ids, each once.
 */
export function activeFromInput(
  text: string,
  known: ReadonlySet<string>,
): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,;]+/u)
        .map((id) => id.trim())
        .filter((id) => known.has(id)),
    ),
  ];
}

function rounded(value: number | null | undefined, step = 10): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.round(value * step) / step;
}

/**
 * Add readings to the days of the archive: each in the day of its time,
 * a time already kept for a station not added twice.
 * @param days - The days read, by date (changed in place).
 * @param readings - What was read.
 * @param zonesOf - The zones a reading stands in.
 * @returns How many measurements were new.
 */
export function addReadings(
  days: Map<string, ArchiveDay>,
  readings: readonly ArchiveReading[],
  zonesOf: (reading: ArchiveReading) => string[],
): number {
  let added = 0;
  for (const reading of readings) {
    if (!Number.isFinite(reading.t) || !Number.isFinite(reading.avg)) continue;
    const date = dayOf(reading.t);
    let day = days.get(date);
    if (!day) {
      day = { date, stations: {} };
      days.set(date, day);
    }
    const key = `${reading.net}:${reading.id}`;
    day.stations[key] ??= {
      name: reading.name,
      net: reading.net,
      lat: Math.round(reading.lat * 1e5) / 1e5,
      lon: Math.round(reading.lon * 1e5) / 1e5,
      zones: [],
      points: [],
    };
    const station = day.stations[key];
    station.name = reading.name;
    station.zones = [...new Set([...station.zones, ...zonesOf(reading)])];
    if (station.points.some(([t]) => t === reading.t)) continue;
    station.points.push([
      reading.t,
      rounded(reading.avg) ?? 0,
      rounded(reading.gust),
      rounded(reading.dir, 1),
      rounded(reading.air),
      rounded(reading.baro),
    ]);
    station.points.sort((a, b) => a[0] - b[0]);
    added += 1;
  }
  return added;
}

/**
 * The index of the archive after a reading.
 * @param at - When it was read (ISO).
 * @param zones - The zones read.
 * @param readings - What was read.
 * @param days - Every day of the archive (newest kept first in the index).
 * @returns The index.
 */
export function archiveIndex(
  at: string,
  zones: readonly string[],
  readings: readonly ArchiveReading[],
  days: Iterable<ArchiveDay>,
): ArchiveIndex {
  const nets: Record<string, number> = {};
  const seen = new Set<string>();
  for (const reading of readings) {
    const key = `${reading.net}:${reading.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    nets[reading.net] = (nets[reading.net] ?? 0) + 1;
  }
  return {
    at,
    zones: [...zones],
    last: { stations: seen.size, nets },
    days: [...days]
      .map((day) => {
        const stations = Object.values(day.stations);
        return {
          date: day.date,
          stations: stations.length,
          points: stations.reduce((sum, s) => sum + s.points.length, 0),
        };
      })
      .toSorted((a, b) => b.date.localeCompare(a.date))
      .slice(0, DAYS_LISTED),
  };
}

/**
 * Read the index of the archive, `null` when it is not one.
 * @param value - The file read.
 * @returns The index.
 */
export function parseIndex(value: unknown): ArchiveIndex | null {
  if (!value || typeof value !== 'object') return null;
  const index = value as Partial<ArchiveIndex>;
  if (typeof index.at !== 'string' || !Array.isArray(index.zones)) return null;
  return {
    at: index.at,
    zones: index.zones.filter((id): id is string => typeof id === 'string'),
    last: {
      stations: Number(index.last?.stations) || 0,
      nets: index.last?.nets ?? {},
    },
    days: Array.isArray(index.days) ? index.days : [],
  };
}
