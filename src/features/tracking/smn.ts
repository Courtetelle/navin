import { fmtTime } from '../../lib/format.ts';
import { distKm } from '../../lib/geo.ts';
import { store } from '../../storage/store.ts';

/** A SwissMetNet station: abbreviation, name, latitude, longitude, altitude. */
export type SmnStation = [string, string, number, number, number];

/** One measurement row: raw CSV columns, `t` being its time (epoch ms). */
export interface SmnRow {
  t: number;
  [column: string]: string | number | null | undefined;
}

/** The measurement of a station close to a position. */
export interface SmnMeasure {
  tws: number | null;
  gust: number | null;
  twd: number | null;
  baro: number | null;
  air: number | null;
  rain: number | null;
  /** Time of the measurement (epoch ms). */
  at: number;
  station: string;
  km: number;
  src: string;
}

const SMN_BASE = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/';
const STATIONS_KEY = 'ldb.smn.stations2';
const STATIONS_MAX_AGE_MS = 30 * 86_400_000;
const ROWS_MAX_AGE_MS = 5 * 60_000;
const MAX_DISTANCE_KM = 25;
const MAX_TIME_GAP_MS = 30 * 60_000;

// Stations on the shore of Lake Geneva, used until the MeteoSwiss list is available.
const LAKE_STATIONS: SmnStation[] = [
  ['CGI', 'Nyon / Changins', 46.401_053, 6.227_722, 458],
  ['GVE', 'Genève / Cointrin', 46.247_519, 6.127_742, 411],
  ['BOU', 'Bouveret', 46.393_447, 6.857_006, 374],
];

const rowsCache = new Map<string, { at: number; rows: SmnRow[] }>();

/**
 * MeteoSwiss stations, kept 30 days in `ldb.smn.stations2` (legacy `smnStations`).
 * @returns The list; the built-in shore stations without network.
 */
export async function smnStations(): Promise<SmnStation[]> {
  const kept = store.get<{ at: number; list: SmnStation[] } | null>(
    STATIONS_KEY,
    null,
  );
  if (kept && Date.now() - kept.at < STATIONS_MAX_AGE_MS) return kept.list;
  try {
    const text = await fetchText(`${SMN_BASE}ogd-smn_meta_stations.csv`);
    const list = parseStations(text);
    if (list.length > 0) {
      store.set(STATIONS_KEY, { at: Date.now(), list });
      return list;
    }
  } catch {
    // Built-in list.
  }
  return kept ? kept.list : LAKE_STATIONS;
}

/**
 * Latest measurements of a station, cached 5 minutes (legacy `smnNow`).
 * @param abbreviation - Station abbreviation.
 * @returns The rows; rejects without network.
 */
export async function smnNow(abbreviation: string): Promise<SmnRow[]> {
  const hit = rowsCache.get(abbreviation);
  if (hit && Date.now() - hit.at < ROWS_MAX_AGE_MS) return hit.rows;
  const lower = abbreviation.toLowerCase();
  const text = await fetchText(
    `${SMN_BASE}${lower}/ogd-smn_${lower}_t_now.csv`,
  );
  const rows = parseMeasures(text);
  rowsCache.set(abbreviation, { at: Date.now(), rows });
  return rows;
}

/**
 * Closest station (25 km at most) and its measurement closest to the time
 * asked (30 min at most); the three closest stations are tried (legacy `smnMeasure`).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param date - Time asked.
 * @returns The measurement, or `null`.
 */
export async function smnMeasure(
  lat: number,
  lon: number,
  date: Date,
): Promise<SmnMeasure | null> {
  const stations = await smnStations();
  const near = nearStations(stations, lat, lon);
  /* eslint-disable no-await-in-loop -- the next station is read only when the previous one has nothing */
  for (const { abbreviation, name, km } of near.slice(0, 3)) {
    try {
      const row = closestRow(await smnNow(abbreviation), date.getTime());
      if (row && Math.abs(row.t - date.getTime()) <= MAX_TIME_GAP_MS) {
        return measureOf(row, name, km);
      }
    } catch {
      // Next station.
    }
  }
  /* eslint-enable no-await-in-loop */
  return null;
}

/**
 * Parse the stations CSV (`;` separated, named columns).
 * @param text - File content.
 * @returns The valid stations.
 */
export function parseStations(text: string): SmnStation[] {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(';'));
  const header = rows.shift() ?? [];
  const column = (name: string) => header.indexOf(name);
  const stations: SmnStation[] = [];
  for (const row of rows) {
    const abbreviation = row[column('station_abbr')];
    const lat = Number(row[column('station_coordinates_wgs84_lat')]);
    if (!abbreviation || !Number.isFinite(lat)) continue;
    stations.push([
      abbreviation,
      row[column('station_name')] ?? '',
      lat,
      Number(row[column('station_coordinates_wgs84_lon')]),
      Number(row[column('station_height_masl')]) || 0,
    ]);
  }
  return stations;
}

/**
 * Parse a measurements CSV; `reference_timestamp` is `DD.MM.YYYY HH:MM`, UTC.
 * @param text - File content.
 * @returns The rows with a valid time.
 */
export function parseMeasures(text: string): SmnRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(';'));
  const header = lines.shift() ?? [];
  const rows: SmnRow[] = [];
  for (const line of lines) {
    const row: SmnRow = { t: Number.NaN };
    for (const [index, name] of header.entries()) {
      const value = line[index];
      row[name] = value === '' || value == null ? null : value;
    }
    const stamp = row.reference_timestamp;
    const parts = (typeof stamp === 'string' ? stamp : '')
      .split(/[. :]/)
      .map(Number);
    const [day, month, year, hours, minutes] = parts;
    row.t = Date.UTC(
      year ?? Number.NaN,
      (month ?? Number.NaN) - 1,
      day,
      hours,
      minutes,
    );
    if (Number.isFinite(row.t)) rows.push(row);
  }
  return rows;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  return new TextDecoder('windows-1252').decode(await response.arrayBuffer());
}

function nearStations(
  stations: readonly SmnStation[],
  lat: number,
  lon: number,
): Array<{ abbreviation: string; name: string; km: number }> {
  const near: Array<{ abbreviation: string; name: string; km: number }> = [];
  for (const [abbreviation, name, stationLat, stationLon] of stations) {
    const km = distKm(lat, lon, stationLat, stationLon);
    if (km < MAX_DISTANCE_KM) near.push({ abbreviation, name, km });
  }
  return near.toSorted((first, second) => first.km - second.km);
}

function closestRow(rows: readonly SmnRow[], time: number): SmnRow | undefined {
  let closest: SmnRow | undefined;
  for (const row of rows) {
    if (row.fu3010z0 == null) continue;
    if (!closest || Math.abs(row.t - time) < Math.abs(closest.t - time)) {
      closest = row;
    }
  }
  return closest;
}

function measureOf(row: SmnRow, station: string, km: number): SmnMeasure {
  const knots = (value: SmnRow[string]) =>
    value == null ? null : Number(value) / 1.852;
  const number = (value: SmnRow[string]) =>
    value == null ? null : Number(value);
  return {
    tws: knots(row.fu3010z0),
    gust: knots(row.fu3010z1),
    twd: number(row.dkl010z0),
    baro: number(row.pp0qffs0),
    air: number(row.tre200s0),
    rain: number(row.rre150z0),
    at: row.t,
    station,
    km,
    src: `Mesure MeteoSwiss, station ${station} (${Math.round(km)} km), ${fmtTime(new Date(row.t))}`,
  };
}
