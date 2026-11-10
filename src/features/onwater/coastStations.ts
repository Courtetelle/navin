import { distKm } from '../../lib/geo.ts';
import { store } from '../../storage/store.ts';

import type { WindReading } from './windTypes.ts';

/** A wind station: network id, name, latitude, longitude. */
export type CoastStation = [id: string, name: string, lat: number, lon: number];

/** Networks of measured wind outside Switzerland. */
export const OPEN_WIND_MAP = 'OpenWindMap';
export const METEO_FRANCE = 'Météo-France';

const OWM_BASE = 'https://api.pioupiou.fr/v1/live/';
const MF_HOST = 'https://public-api.meteofrance.fr';
const MF_CONTEXT = '/public/DPObs/v1';
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
    pressure?: number | null;
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
  [field: string]: unknown;
}

/** Names of the gusts in the Météo-France replies, the 10-minute one first. */
const GUST_FIELDS = ['fxi10', 'fxi', 'fxi3s', 'fxy', 'fx'];

/**
 * The gusts of a Météo-France row, whatever their name (`fx…`).
 * @param row - The row.
 * @returns Gusts in m/s, null when the station gives none.
 */
export function mfGust(row: Readonly<Record<string, unknown>>): number | null {
  const known = GUST_FIELDS.map((name) => row[name]).find(
    (value) => typeof value === 'number' && Number.isFinite(value),
  );
  if (typeof known === 'number') return known;
  for (const [name, value] of Object.entries(row)) {
    if (
      name.startsWith('fx') &&
      typeof value === 'number' &&
      Number.isFinite(value)
    ) {
      return value;
    }
  }
  return null;
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
  most = MAX_STATIONS,
): Array<{ station: CoastStation; km: number }> {
  return stations
    .map((station) => ({
      station,
      km: distKm(position.lat, position.lon, station[2], station[3]),
    }))
    .filter(({ km }) => km < radius)
    .toSorted((a, b) => a.km - b.km)
    .slice(0, most);
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
    baro: measure.pressure ?? null,
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
  const gust = mfGust(row);
  return {
    name,
    km,
    t,
    avg: (row.ff ?? 0) * MS_TO_KN,
    gust: gust == null ? null : gust * MS_TO_KN,
    dir: row.dd ?? null,
    air: typeof row.t === 'number' ? row.t - 273.15 : null,
    baro: typeof row.pmer === 'number' ? row.pmer / 100 : null,
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
  position: { lat: number; lon: number },
  radius: number,
  most = MAX_STATIONS,
): Promise<WindReading[]> {
  const stations = await listOf(OWM_KEY, OWM_LIST_MAX_AGE_MS, async () => {
    const response = await fetch(`${OWM_BASE}all`, {
      signal: AbortSignal.timeout(20_000),
    });
    return response.ok ? owmStations(await response.json()) : [];
  });
  const near = nearCoastStations(stations, position, radius, most);
  const readings = await Promise.all(
    near.map(async ({ station, km }) => {
      try {
        const response = await fetch(`${OWM_BASE}${station[0]}`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) return null;
        const reply = (await response.json()) as { data?: OwmLive };
        const reading = reply.data
          ? owmReading(reply.data, km, Date.now())
          : null;
        return reading && placed(reading, station);
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
  position: { lat: number; lon: number },
  radius: number,
  key: string,
  most = MAX_STATIONS,
): Promise<WindReading[]> {
  if (!key) return [];
  const stations = await listOf(MF_KEY, MF_LIST_MAX_AGE_MS, async () => {
    const response = await mfFetch(`${mfBase(key)}liste-stations`, key);
    return response.ok ? mfStations(await response.text()) : [];
  });
  const near = nearCoastStations(stations, position, radius, most);
  /* eslint-disable no-await-in-loop -- Météo-France allows 50 requests a minute */
  const readings: WindReading[] = [];
  for (const { station, km } of near) {
    const { reading } = await mfStationWind(station, km, key);
    if (reading) readings.push(placed(reading, station));
  }
  /* eslint-enable no-await-in-loop */
  return readings;
}

/** Result of {@link mfCheck}. */
export type MfCheck =
  | {
      kind: 'ok';
      stations: number;
      reading: WindReading;
      /** Fields of the last measurement, to know the names of the reply. */
      fields: string[];
      /** A second station, by the sea. */
      coast: { reading: WindReading; fields: string[] } | null;
    }
  | { kind: 'noWind'; stations: number; near: string; status: string }
  | {
      kind: 'refused';
      status: number;
      apis: string[] | null;
      /** Why, as Météo-France and the key say. */
      detail: string;
    }
  | { kind: 'empty'; status: number; sample: string }
  | { kind: 'timeout'; step: string }
  | { kind: 'offline' };

/** Longest wait of one Météo-France request. */
const MF_TIMEOUT_MS = 15_000;

function mfFetch(url: string, key: string): Promise<Response> {
  return fetch(url, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(MF_TIMEOUT_MS),
  });
}

function timedOut(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  );
}

/**
 * Try a Météo-France key: the list of stations, then the wind of the closest
 * stations to a place.
 * @param key - The key.
 * @param position - Place near which a wind is read.
 * @param coast - A place by the sea, where a second station is read.
 * @param onStep - Told each step, to show the progress.
 * @returns What Météo-France answered.
 */
export async function mfCheck(
  key: string,
  position: { lat: number; lon: number },
  coast: { lat: number; lon: number } | null = null,
  onStep: (step: string) => void = () => undefined,
): Promise<MfCheck> {
  let response: Response;
  let text: string;
  const step = 'liste des stations';
  onStep(`${step} (${mfBase(key).replace(MF_HOST, '')})`);
  try {
    response = await mfFetch(`${mfBase(key)}liste-stations`, key);
    if (response.status === 401 || response.status === 403) {
      return {
        kind: 'refused',
        status: response.status,
        apis: keyApis(key),
        detail: await refusalDetail(response, key),
      };
    }
    text = response.ok ? await response.text() : '';
  } catch (error) {
    return timedOut(error) ? { kind: 'timeout', step } : { kind: 'offline' };
  }
  const list = mfStations(text);
  if (list.length === 0) {
    return {
      kind: 'empty',
      status: response.status,
      sample: text.slice(0, 80),
    };
  }
  store.set(MF_KEY, { at: Date.now(), list });
  const near = nearCoastStations(list, position, 80).slice(0, 3);
  const codes: string[] = [];
  /* eslint-disable no-await-in-loop -- the next station only when the closer one has no wind */
  for (const { station, km } of near) {
    onStep(`${list.length} stations · vent de ${station[1]}`);
    const { reading, status, fields } = await mfStationWind(station, km, key);
    if (reading) {
      return {
        kind: 'ok',
        stations: list.length,
        reading,
        fields,
        coast: coast ? await coastCheck(list, coast, key, onStep) : null,
      };
    }
    codes.push(status === -1 ? 'délai dépassé' : String(status));
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
): Promise<{ reading: WindReading | null; status: number; fields: string[] }> {
  try {
    const response = await mfFetch(
      `${mfBase(key)}station/infrahoraire-6m?id_station=${encodeURIComponent(station[0])}&format=json`,
      key,
    );
    if (!response.ok) {
      return { reading: null, status: response.status, fields: [] };
    }
    const rows = (await response.json()) as MfRow[];
    const list = Array.isArray(rows) ? rows : [];
    const last = list.at(-1) ?? {};
    return {
      reading: mfReading(list, station[1], km, Date.now()),
      status: response.status,
      fields: Object.keys(last)
        .filter((name) => last[name] != null)
        .toSorted(),
    };
  } catch (error) {
    return { reading: null, status: timedOut(error) ? -1 : 0, fields: [] };
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
  const payload = keyPayload(key);
  if (!Array.isArray(payload?.subscribedAPIs)) return null;
  return payload.subscribedAPIs.map((api) => api.name ?? '?');
}

interface KeyPayload {
  subscribedAPIs?: Array<{ name?: string; context?: string; version?: string }>;
  permittedReferer?: string;
  permittedIP?: string;
}

function keyPayload(key: string): KeyPayload | null {
  try {
    const part = key.split('.', 2)[1] ?? '';
    const json = atob(part.replaceAll('-', '+').replaceAll('_', '/'));
    return JSON.parse(json) as KeyPayload;
  } catch {
    return null;
  }
}

/**
 * What the key holds that can refuse a call: the address of the observation
 * API, and the sites or addresses the key is limited to.
 * @param key - The key.
 * @returns The text, empty when there is nothing to say.
 */
export function keyLimits(key: string): string {
  const payload = keyPayload(key);
  if (!payload) return '';
  const parts: string[] = [];
  const api = payload.subscribedAPIs?.find(
    (item) => item.name === 'DonneesPubliquesObservation',
  );
  if (api) parts.push(`API ${api.context ?? '?'} ${api.version ?? ''}`.trim());
  if (payload.permittedReferer) {
    parts.push(`sites autorisés : ${payload.permittedReferer}`);
  }
  if (payload.permittedIP) parts.push(`IP autorisées : ${payload.permittedIP}`);
  return parts.join(' · ');
}

async function refusalDetail(response: Response, key: string): Promise<string> {
  let said = '';
  try {
    const body = (await response.json()) as {
      code?: string | number;
      message?: string;
      description?: string;
    };
    said = [body.code, body.message, body.description]
      .filter((part) => part != null && part !== '')
      .join(' ')
      .slice(0, 220);
  } catch {
    // No reason given.
  }
  // Another resource of the same API (Paris-Montsouris), to know if the whole API is closed.
  let probe = 'injoignable';
  try {
    const other = await mfFetch(
      `${mfBase(key)}station/infrahoraire-6m?id_station=75114001&format=json`,
      key,
    );
    probe = String(other.status);
  } catch {
    // Unreachable.
  }
  return [
    said && `Météo-France : ${said}`,
    `essai station Paris : ${probe}`,
    keyLimits(key),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Address of the observation API the key opens (its version changes over
 * time: v1, v2…), the v1 address when the key does not say.
 * @param key - The key.
 * @returns The base URL, ending with `/`.
 */
export function mfBase(key: string): string {
  const context = keyPayload(key)?.subscribedAPIs?.find(
    (api) => api.name === 'DonneesPubliquesObservation',
  )?.context;
  const safe = context && /^\/[\w/.-]+$/u.test(context) ? context : MF_CONTEXT;
  return `${MF_HOST}${safe.replace(/\/$/u, '')}/`;
}

async function coastCheck(
  list: readonly CoastStation[],
  coast: { lat: number; lon: number },
  key: string,
  onStep: (step: string) => void,
): Promise<{ reading: WindReading; fields: string[] } | null> {
  /* eslint-disable no-await-in-loop -- the next station only when the closer one has no wind */
  for (const { station, km } of nearCoastStations(list, coast, 40).slice(
    0,
    3,
  )) {
    onStep(`vent de ${station[1]}, en bord de mer`);
    const { reading, fields } = await mfStationWind(station, km, key);
    if (reading) return { reading, fields };
  }
  /* eslint-enable no-await-in-loop */
  return null;
}

function placed(reading: WindReading, station: CoastStation): WindReading {
  return { ...reading, id: station[0], lat: station[2], lon: station[3] };
}
