import { distKm } from '../../lib/geo.ts';
import type { Position } from '../../model/types.ts';
import { store } from '../../storage/store.ts';

import type { WindReading } from './windTypes.ts';

/** A wind station: network id, name, latitude, longitude. */
export type CoastStation = [id: string, name: string, lat: number, lon: number];

/** Networks of measured wind outside Switzerland. */
export const OPEN_WIND_MAP = 'OpenWindMap';
export const METEO_FRANCE = 'Météo-France';

const OWM_BASE = 'https://api.pioupiou.fr/v1/live/';
const MF_BASE = 'https://public-api.meteofrance.fr/public/DPObs/v1/';
const OWM_KEY = 'ldb.owm.stations';
const MF_KEY = 'ldb.mf.stations';
const OWM_LIST_MAX_AGE_MS = 86_400_000;
const MF_LIST_MAX_AGE_MS = 30 * 86_400_000;
/** A measurement older than this is not the wind of now. */
export const STATION_MAX_AGE_MS = 40 * 60_000;
const KMH_TO_KN = 1 / 1.852;
const MS_TO_KN = 3600 / 1852;
/** Stations read at each check, the closest first. */
const MAX_STATIONS = 12;

interface OwmLive {
  id?: number;
  meta?: { name?: string };
  location?: { latitude?: number | null; longitude?: number | null };
  measurements?: {
    date?: string | null;
    // eslint-disable-next-line @typescript-eslint/naming-convention -- name in the API
    wind_heading?: number | null;
    // eslint-disable-next-line @typescript-eslint/naming-convention -- name in the API
    wind_speed_avg?: number | null;
    // eslint-disable-next-line @typescript-eslint/naming-convention -- name in the API
    wind_speed_max?: number | null;
  };
}

interface MfRow {
  // eslint-disable-next-line @typescript-eslint/naming-convention -- name in the API
  validity_time?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention -- name in the API
  reference_time?: string;
  ff?: number | null;
  fxi10?: number | null;
  dd?: number | null;
}

/**
 * Stations of a list closer than a radius, the closest first.
 * @param stations - The list.
 * @param position - Boat position.
 * @param radius - Radius in km.
 * @returns The stations with their distance.
 */
export function nearCoastStations(
  stations: readonly CoastStation[],
  position: { lat: number; lon: number },
  radius: number,
): Array<{ station: CoastStation; km: number }> {
  return stations
    .map((station) => ({
      station,
      km: distKm(position.lat, position.lon, station[2], station[3]),
    }))
    .filter(({ km }) => km < radius)
    .toSorted((a, b) => a.km - b.km)
    .slice(0, MAX_STATIONS);
}

/**
 * The OpenWindMap beacons of the `live/all` reply.
 * @param reply - Parsed reply.
 * @returns The beacons with a place.
 */
export function owmStations(reply: unknown): CoastStation[] {
  const data = (reply as { data?: OwmLive[] } | null)?.data;
  if (!Array.isArray(data)) return [];
  const stations: CoastStation[] = [];
  for (const live of data) {
    const lat = live.location?.latitude;
    const lon = live.location?.longitude;
    if (live.id == null || lat == null || lon == null) continue;
    stations.push([String(live.id), live.meta?.name ?? '', lat, lon]);
  }
  return stations;
}

/**
 * The measurement of one OpenWindMap beacon (km/h in the reply).
 * @param live - The beacon.
 * @param km - Its distance.
 * @param now - Epoch milliseconds.
 * @returns The reading, null when old or empty.
 */
export function owmReading(
  live: OwmLive,
  km: number,
  now: number,
): WindReading | null {
  const measure = live.measurements;
  const t = measure?.date ? Date.parse(measure.date) : Number.NaN;
  if (measure?.wind_speed_avg == null || !(now - t < STATION_MAX_AGE_MS)) {
    return null;
  }
  return {
    name: live.meta?.name || `balise ${live.id}`,
    km,
    t,
    avg: measure.wind_speed_avg * KMH_TO_KN,
    gust:
      measure.wind_speed_max == null
        ? null
        : measure.wind_speed_max * KMH_TO_KN,
    dir: measure.wind_heading ?? null,
    net: OPEN_WIND_MAP,
  };
}

/**
 * The Météo-France stations of `liste-stations` (CSV `;` or JSON).
 * @param text - Reply.
 * @returns The stations with a place.
 */
export function mfStations(text: string): CoastStation[] {
  const rows = parseTable(text);
  const stations: CoastStation[] = [];
  for (const row of rows) {
    const id = pick(row, ['id_station', 'id', 'geo_id_insee']);
    const lat = Number(pick(row, ['latitude', 'lat']));
    const lon = Number(pick(row, ['longitude', 'lon']));
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    stations.push([
      id,
      titleCase(pick(row, ['nom_usuel', 'nom', 'name']) ?? id),
      lat,
      lon,
    ]);
  }
  return stations;
}

/**
 * The last measurement of a Météo-France station (m/s in the reply).
 * @param rows - Rows of `station/infrahoraire-6m`.
 * @param name - Station name.
 * @param km - Its distance.
 * @param now - Epoch milliseconds.
 * @returns The reading, null when old or without wind.
 */
export function mfReading(
  rows: readonly MfRow[],
  name: string,
  km: number,
  now: number,
): WindReading | null {
  let last: { row: MfRow; t: number } | null = null;
  for (const row of rows) {
    const t = Date.parse(row.validity_time ?? row.reference_time ?? '');
    if (row.ff == null || !Number.isFinite(t)) continue;
    if (!last || t > last.t) last = { row, t };
  }
  if (!last || !(now - last.t < STATION_MAX_AGE_MS)) return null;
  const { row, t } = last;
  return {
    name,
    km,
    t,
    avg: (row.ff ?? 0) * MS_TO_KN,
    gust: row.fxi10 == null ? null : row.fxi10 * MS_TO_KN,
    dir: row.dd ?? null,
    net: METEO_FRANCE,
  };
}

/**
 * Measured wind of the OpenWindMap beacons around the boat.
 * @param position - Boat position.
 * @param radius - Radius in km.
 * @returns The readings, empty without network.
 */
export async function owmReadings(
  position: Position,
  radius: number,
): Promise<WindReading[]> {
  const stations = await listOf(OWM_KEY, OWM_LIST_MAX_AGE_MS, async () => {
    const response = await fetch(`${OWM_BASE}all`);
    return response.ok ? owmStations(await response.json()) : [];
  });
  const near = nearCoastStations(stations, position, radius);
  const readings = await Promise.all(
    near.map(async ({ station, km }) => {
      try {
        const response = await fetch(`${OWM_BASE}${station[0]}`);
        if (!response.ok) return null;
        const reply = (await response.json()) as { data?: OwmLive };
        return reply.data ? owmReading(reply.data, km, Date.now()) : null;
      } catch {
        return null;
      }
    }),
  );
  return readings.filter((reading) => reading !== null);
}

/**
 * Measured wind of the Météo-France stations around the boat.
 * @param position - Boat position.
 * @param radius - Radius in km.
 * @param key - Météo-France API key; nothing is read without it.
 * @returns The readings, empty without key or network.
 */
export async function mfReadings(
  position: Position,
  radius: number,
  key: string,
): Promise<WindReading[]> {
  if (!key) return [];
  const stations = await listOf(MF_KEY, MF_LIST_MAX_AGE_MS, async () => {
    const response = await fetch(`${MF_BASE}liste-stations`, {
      headers: { apikey: key },
    });
    return response.ok ? mfStations(await response.text()) : [];
  });
  const near = nearCoastStations(stations, position, radius);
  /* eslint-disable no-await-in-loop -- Météo-France allows 50 requests a minute */
  const readings: WindReading[] = [];
  for (const { station, km } of near) {
    const { reading } = await mfStationWind(station, km, key);
    if (reading) readings.push(reading);
  }
  /* eslint-enable no-await-in-loop */
  return readings;
}

/** Result of {@link mfCheck}. */
export type MfCheck =
  | { kind: 'ok'; stations: number; reading: WindReading }
  | { kind: 'noWind'; stations: number; near: string; status: string }
  | { kind: 'refused'; status: number; apis: string[] | null }
  | { kind: 'empty'; status: number; sample: string }
  | { kind: 'offline' };

/**
 * Try a Météo-France key: the list of stations, then the wind of the closest
 * stations to a place.
 * @param key - The key.
 * @param position - Place near which a wind is read.
 * @returns What Météo-France answered.
 */
export async function mfCheck(
  key: string,
  position: { lat: number; lon: number },
): Promise<MfCheck> {
  let response: Response;
  try {
    response = await fetch(`${MF_BASE}liste-stations`, {
      headers: { apikey: key },
    });
  } catch {
    return { kind: 'offline' };
  }
  if (response.status === 401 || response.status === 403) {
    return { kind: 'refused', status: response.status, apis: keyApis(key) };
  }
  const text = response.ok ? await response.text() : '';
  const list = mfStations(text);
  if (list.length === 0) {
    return {
      kind: 'empty',
      status: response.status,
      sample: text.slice(0, 80),
    };
  }
  store.set(MF_KEY, { at: Date.now(), list });
  const near = nearCoastStations(list, position, 80).slice(0, 5);
  const codes: string[] = [];
  /* eslint-disable no-await-in-loop -- the next station only when the closer one has no wind */
  for (const { station, km } of near) {
    const { reading, status } = await mfStationWind(station, km, key);
    if (reading) return { kind: 'ok', stations: list.length, reading };
    codes.push(String(status));
  }
  /* eslint-enable no-await-in-loop */
  return {
    kind: 'noWind',
    stations: list.length,
    near: near[0]?.station[1] ?? '',
    status: codes.join(', '),
  };
}

async function mfStationWind(
  station: CoastStation,
  km: number,
  key: string,
): Promise<{ reading: WindReading | null; status: number }> {
  try {
    const response = await fetch(
      `${MF_BASE}station/infrahoraire-6m?id_station=${encodeURIComponent(station[0])}&format=json`,
      { headers: { apikey: key } },
    );
    if (!response.ok) return { reading: null, status: response.status };
    const rows = (await response.json()) as MfRow[];
    return {
      reading: Array.isArray(rows)
        ? mfReading(rows, station[1], km, Date.now())
        : null,
      status: response.status,
    };
  } catch {
    return { reading: null, status: 0 };
  }
}

async function listOf(
  key: string,
  maxAge: number,
  load: () => Promise<CoastStation[]>,
): Promise<CoastStation[]> {
  const kept = store.get<{ at: number; list: CoastStation[] } | null>(
    key,
    null,
  );
  if (kept && Date.now() - kept.at < maxAge) return kept.list;
  try {
    const list = await load();
    if (list.length > 0) {
      store.set(key, { at: Date.now(), list });
      return list;
    }
  } catch {
    // The list kept, if any.
  }
  return kept?.list ?? [];
}

function parseTable(text: string): Array<Record<string, string>> {
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) {
    try {
      const rows = JSON.parse(trimmed) as Array<Record<string, unknown>>;
      return rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([name, value]) => [
            name.toLowerCase(),
            typeof value === 'string' || typeof value === 'number'
              ? String(value)
              : '',
          ]),
        ),
      );
    } catch {
      return [];
    }
  }
  const lines = trimmed.split(/\r?\n/).map((line) => line.split(';'));
  const header = (lines.shift() ?? []).map((name) => name.trim().toLowerCase());
  return lines.map((cells) =>
    Object.fromEntries(
      header.map((name, index) => [name, (cells[index] ?? '').trim()]),
    ),
  );
}

function pick(row: Record<string, string>, names: string[]): string | null {
  for (const name of names) {
    const value = row[name];
    if (value) return value;
  }
  return null;
}

function titleCase(name: string): string {
  if (name !== name.toUpperCase()) return name;
  return name
    .toLowerCase()
    .replaceAll(
      /(?<before>^|[\s'-])(?<letter>\p{L})/gu,
      (_match, before: string, letter: string) => before + letter.toUpperCase(),
    );
}

/**
 * The APIs a Météo-France "API Key" opens: the key is a JWT listing the
 * subscriptions of the moment it was generated.
 * @param key - The key.
 * @returns The API names, null when the key cannot be read.
 */
export function keyApis(key: string): string[] | null {
  try {
    const part = key.split('.', 2)[1] ?? '';
    const json = atob(part.replaceAll('-', '+').replaceAll('_', '/'));
    const payload = JSON.parse(json) as {
      subscribedAPIs?: Array<{ name?: string }>;
    };
    if (!Array.isArray(payload.subscribedAPIs)) return null;
    return payload.subscribedAPIs.map((api) => api.name ?? '?');
  } catch {
    return null;
  }
}
