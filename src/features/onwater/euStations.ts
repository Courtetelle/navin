import { distKm } from '../../lib/geo.ts';
import { store } from '../../storage/store.ts';

import type { WindReading } from './windTypes.ts';

/** The networks of measured wind around Italy, Spain and Britain. */
export const ITALIA_METEO = 'ItaliaMeteo';
export const PUERTOS = 'Puertos del Estado';
export const SOCIB = 'SOCIB';
export const AEMET = 'AEMET';
export const MET_OFFICE = 'Met Office';

/** Networks of ItaliaMeteo kept by amateurs, not by an official service. */
const AMATEUR_NETS = new Set(['mnw', 'meteonetwork']);

const MS_TO_KN = 3600 / 1852;
/** A measurement older than this is not the wind of now. */
const MAX_AGE_MS = 70 * 60_000;
/** A whole network read again after this long. */
const NETWORK_MS = 10 * 60_000;
const WEEK_MS = 7 * 86_400_000;

/** A station of a network: id, name, place. */
interface PlacedStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/**
 * The closest stations of a list within a radius.
 * @param stations - The stations.
 * @param center - The place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @returns The stations with their distance, the closest first.
 */
export function nearStations<T extends { lat: number; lon: number }>(
  stations: readonly T[],
  center: { lat: number; lon: number },
  radius: number,
  most: number,
): Array<{ station: T; km: number }> {
  return stations
    .map((station) => ({
      station,
      km: distKm(center.lat, center.lon, station.lat, station.lon),
    }))
    .filter(({ km }) => km < radius)
    .toSorted((a, b) => a.km - b.km)
    .slice(0, most);
}

function fresh(t: number, now: number): boolean {
  return Number.isFinite(t) && now - t < MAX_AGE_MS && t - now < 10 * 60_000;
}

function knots(metres: number | null | undefined): number | null {
  return metres == null || !Number.isFinite(metres) ? null : metres * MS_TO_KN;
}

/* ---------------------------------------------------------------- Italy */

/** One value of a MeteoHub product. */
interface HubValue {
  val: number;
  ref: string;
}

/** One station of the MeteoHub reply. */
export interface HubStation {
  stat: {
    lat: number;
    lon: number;
    net: string;
    details?: Array<{ var: string; val: string }>;
  };
  prod: Array<{ var: string; val: HubValue[] }>;
}

/**
 * The latest value of a MeteoHub product of a station.
 * @param station - The station.
 * @param code - BUFR code of the product (`B11002` mean wind…).
 * @returns The value and its time, or null.
 */
function hubLatest(
  station: HubStation,
  code: string,
): { val: number; t: number } | null {
  const values = station.prod.find((one) => one.var === code)?.val ?? [];
  let latest: { val: number; t: number } | null = null;
  for (const value of values) {
    // The times of MeteoHub are UTC, without their zone.
    const t = Date.parse(`${value.ref}Z`);
    if (Number.isFinite(t) && (!latest || t > latest.t)) {
      latest = { val: value.val, t };
    }
  }
  return latest;
}

/**
 * The wind of one MeteoHub station.
 * @param station - The station of the reply.
 * @param km - Its distance.
 * @param now - Epoch milliseconds.
 * @returns The reading, null when old or without wind.
 */
export function hubReading(
  station: HubStation,
  km: number,
  now: number,
): WindReading | null {
  const avg = hubLatest(station, 'B11002');
  if (!avg || !fresh(avg.t, now)) return null;
  const gust = hubLatest(station, 'B11041');
  const dir = hubLatest(station, 'B11001');
  const label =
    station.stat.details?.find((one) => one.var === 'B01019')?.val ?? '';
  // « T0065 - SM Careser Diga »: the code of the network left out.
  const name = label.replace(/^[\w.-]+\s+-\s+/, '').trim() || 'station';
  const amateur = AMATEUR_NETS.has(station.stat.net);
  return {
    name,
    km,
    t: avg.t,
    avg: knots(avg.val) ?? 0,
    gust:
      gust && Math.abs(gust.t - avg.t) < MAX_AGE_MS ? knots(gust.val) : null,
    dir: dir ? dir.val : null,
    net: ITALIA_METEO,
    id: `${station.stat.net}:${station.stat.lat},${station.stat.lon}`,
    lat: station.stat.lat,
    lon: station.stat.lon,
    ...(amateur ? { amateur: true } : {}),
  };
}

let hubKept: { at: number; stations: HubStation[] } | null = null;

function hubTime(date: Date): string {
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

async function hubStations(now: number): Promise<HubStation[]> {
  if (hubKept && now - hubKept.at < NETWORK_MS) return hubKept.stations;
  const from = hubTime(new Date(now - MAX_AGE_MS));
  const to = hubTime(new Date(now));
  const query = `reftime:>=${from},<=${to};product:B11002 or B11001 or B11041;license:CCBY_COMPLIANT`;
  const response = await fetch(
    `https://meteohub.agenziaitaliameteo.it/api/observations?q=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(25_000) },
  );
  if (!response.ok) return hubKept?.stations ?? [];
  const reply = (await response.json()) as { data?: HubStation[] };
  const stations = Array.isArray(reply.data) ? reply.data : [];
  // eslint-disable-next-line require-atomic-updates -- the latest reply wins, any of them is right
  hubKept = { at: now, stations };
  return stations;
}

/**
 * Measured wind of the Italian stations (ItaliaMeteo, which gathers the
 * regional networks) around a place. The whole country is read at once,
 * every 10 minutes at most.
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @returns The readings, empty far from Italy or without network.
 */
export async function hubReadings(
  center: { lat: number; lon: number },
  radius: number,
  most: number,
): Promise<WindReading[]> {
  if (!nearItaly(center, radius)) return [];
  const now = Date.now();
  const stations = await hubStations(now);
  const near = nearStations(
    stations.map((station) => ({
      station,
      lat: station.stat.lat,
      lon: station.stat.lon,
    })),
    center,
    radius,
    most * 3,
  );
  const readings: WindReading[] = [];
  for (const { station, km } of near) {
    const reading = hubReading(station.station, km, now);
    if (reading) readings.push(reading);
    if (readings.length >= most) break;
  }
  return readings;
}

/**
 * Whether a circle reaches Italy and its islands (a box with a margin).
 * @param center - Its centre.
 * @param radius - Its radius in km.
 * @returns `true` when it may.
 */
export function nearItaly(
  center: { lat: number; lon: number },
  radius: number,
): boolean {
  const margin = radius / 100;
  return (
    center.lat > 35.2 - margin &&
    center.lat < 47.2 + margin &&
    center.lon > 6.5 - margin * 1.4 &&
    center.lon < 18.6 + margin * 1.4
  );
}

/* ---------------------------------------------------------------- Spain */

/** A station of Puertos del Estado. */
export interface PortusStation {
  id: number;
  nombre?: string;
  latitud?: number;
  longitud?: number;
}

/** The last data of a Puertos del Estado station. */
export interface PortusData {
  fecha?: string;
  datos?: Array<{ nombreColumna?: string; valor?: string; factor?: number }>;
}

/**
 * The wind of a Puertos del Estado station (buoy, tide gauge, port).
 * @param data - Its last data.
 * @param station - The station.
 * @param km - Its distance.
 * @param now - Epoch milliseconds.
 * @returns The reading, null when old or without wind.
 */
export function portusReading(
  data: PortusData,
  station: PlacedStation,
  km: number,
  now: number,
): WindReading | null {
  // « 2026-11-14 23:48:00.0 », UTC.
  const t = data.fecha
    ? Date.parse(`${data.fecha.replace(' ', 'T').replace(/\.\d+$/, '')}Z`)
    : Number.NaN;
  if (!fresh(t, now)) return null;
  const value = (column: string): number | null => {
    const row = data.datos?.find((one) => one.nombreColumna === column);
    const number = Number(row?.valor);
    if (row?.valor == null || !Number.isFinite(number)) return null;
    return number / (row.factor || 1);
  };
  const avg = value('vv_md');
  if (avg == null) return null;
  return {
    name: station.name,
    km,
    t,
    avg: knots(avg) ?? 0,
    gust: knots(value('vv_mx')),
    dir: value('dv_md'),
    net: PUERTOS,
    id: station.id,
    lat: station.lat,
    lon: station.lon,
  };
}

const PORTUS = 'https://portus.puertos.es/portussvr/api';
const PORTUS_LIST_KEY = 'ldb.portus.stations';

/**
 * The stations of Puertos del Estado that measure the wind.
 * @param reply - Reply of `estaciones/hist/WIND`.
 * @returns The stations with a place.
 */
export function portusStations(reply: unknown): PlacedStation[] {
  if (!Array.isArray(reply)) return [];
  const stations: PlacedStation[] = [];
  for (const one of reply as PortusStation[]) {
    if (one.latitud == null || one.longitud == null || one.id == null) continue;
    stations.push({
      id: String(one.id),
      name: (one.nombre ?? '').trim() || `station ${one.id}`,
      lat: one.latitud,
      lon: one.longitud,
    });
  }
  return stations;
}

/**
 * Measured wind of Puertos del Estado around a place: the buoys off the
 * Spanish coasts and the Balearics, the tide gauges and the ports.
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations read at most.
 * @returns The readings, empty without network.
 */
export async function portusReadings(
  center: { lat: number; lon: number },
  radius: number,
  most: number,
): Promise<WindReading[]> {
  const stations = await keptList(PORTUS_LIST_KEY, WEEK_MS, async () => {
    const response = await fetch(`${PORTUS}/estaciones/hist/WIND?locale=es`, {
      signal: AbortSignal.timeout(20_000),
    });
    return response.ok ? portusStations(await response.json()) : [];
  });
  const near = nearStations(stations, center, radius, most);
  const now = Date.now();
  const readings = await Promise.all(
    near.map(async ({ station, km }) => {
      try {
        const response = await fetch(
          `${PORTUS}/lastData/station/${station.id}?locale=es`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '["WIND"]',
            signal: AbortSignal.timeout(12_000),
          },
        );
        if (!response.ok) return null;
        return portusReading(
          (await response.json()) as PortusData,
          station,
          km,
          now,
        );
      } catch {
        return null;
      }
    }),
  );
  return readings.filter((reading) => reading !== null);
}

/* ------------------------------------------------------------ Balearics */

const SOCIB_THREDDS = 'https://thredds.socib.es/thredds';

/** A SOCIB station: its place and the data file of its instrument. */
interface SocibStation extends PlacedStation {
  /** OPeNDAP path of its latest file. */
  path: string;
}

/**
 * The values of an OPeNDAP ASCII reply, by variable name.
 * @param text - The reply.
 * @returns Numbers by variable, strings dropped.
 */
export function opendapValues(text: string): Record<string, number[]> {
  const data = text.split(/^-{10,}$/m, 2)[1] ?? '';
  const values: Record<string, number[]> = {};
  let current = '';
  for (const raw of data.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const head = /^(?<name>[A-Za-z_]\w*)(?:\[\d+\])?(?:,\s*(?<rest>.*))?$/.exec(
      line,
    )?.groups;
    if (head) {
      current = head.name ?? '';
      values[current] = [];
      if (head.rest !== undefined) {
        values[current]?.push(...numbers(head.rest));
      }
      continue;
    }
    if (current) values[current]?.push(...numbers(line));
  }
  return values;
}

function numbers(text: string): number[] {
  return text
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((number) => Number.isFinite(number));
}

/**
 * The wind of a SOCIB station from its last values.
 * @param values - Values of its OPeNDAP reply.
 * @param station - The station.
 * @param km - Its distance.
 * @param now - Epoch milliseconds.
 * @returns The reading, null when old or without wind.
 */
export function socibReading(
  values: Record<string, number[]>,
  station: PlacedStation,
  km: number,
  now: number,
): WindReading | null {
  const times = values.time ?? [];
  const index = times.length - 1;
  const seconds = times[index];
  const avg = values.WIN_SPE?.[index];
  if (seconds == null || avg == null) return null;
  const t = seconds * 1000;
  if (!fresh(t, now)) return null;
  return {
    name: station.name,
    km,
    t,
    avg: knots(avg) ?? 0,
    gust: knots(values.WIN_SPE_GUS?.[index]),
    dir: values.WIN_DIR?.[index] ?? null,
    baro: values.AIR_PRE?.[index] ?? null,
    air: values.AIR_TEM?.[index] ?? null,
    net: SOCIB,
    id: station.id,
    lat: station.lat,
    lon: station.lon,
  };
}

/** SOCIB answers better one request at a time. */
const BATCH = 1;

/**
 * Run a task on every item, a few at a time.
 * @param items - The items.
 * @param task - What to do with one.
 * @returns The results, in the order of the items.
 */
async function inBatches<T, R>(
  items: readonly T[],
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += BATCH) {
    // eslint-disable-next-line no-await-in-loop -- a few at a time, on purpose
    const batch = await Promise.all(
      items.slice(start, start + BATCH).map(task),
    );
    results.push(...batch);
  }
  return results;
}

async function textOf(url: string, timeout = 15_000): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.text();
}

/**
 * The SOCIB instruments measuring the wind (their path changes when an
 * instrument is replaced: read on 15.11.2026, the live ones only).
 */
const SOCIB_STATIONS: readonly SocibStation[] = (
  [
    [
      'station_parcbit-scb_met023',
      'dep0001_station-parcbit_scb-met023',
      'ParcBit (Palma)',
      39.635733,
      2.631877,
    ],
    [
      'station_lamola-scb_met018',
      'dep0001_station-lamola_scb-met018',
      'La Mola (Minorque)',
      39.870965,
      4.310051,
    ],
    [
      'station_galfi-scb_met013',
      'dep0002_station-galfi_scb-met013',
      'Galfi (Ibiza)',
      38.951869,
      1.219817,
    ],
    [
      'station_cabrera-scb_met027',
      'dep0001_station-cabrera_scb-met027',
      'Cabrera',
      39.15071,
      2.93101,
    ],
    [
      'station_barbaria-scb_met006',
      'dep0003_station-barbaria_scb-met006',
      'Barbaria (Formentera)',
      38.676944,
      1.392222,
    ],
    [
      'mobims_sonbou-scb_met021',
      'dep0001_mobims-sonbou_scb-met021',
      'Son Bou (Minorque)',
      39.898481,
      4.076663,
    ],
    [
      'mobims_muro-scb_met016',
      'dep0001_mobims-muro_scb-met016',
      'Muro (Majorque)',
      39.81221688,
      3.11656481,
    ],
    [
      'mobims_calamillor-scb_met012',
      'dep0004_mobims-calamillor_scb-met012',
      'Cala Millor (Majorque)',
      39.596277,
      3.383145,
    ],
    [
      'buoy_soller-scb_met024',
      'dep0005_buoy-soller_scb-met024',
      'Bouée de Sóller',
      39.865058,
      2.665055,
    ],
    [
      'buoy_portocolom-scb_met028',
      'dep0003_buoy-portocolom_scb-met028',
      'Bouée de Porto Colom',
      39.403056,
      3.286667,
    ],
    [
      'buoy_bahiadepalma-scb_met029',
      'dep0002_buoy-bahiadepalma_scb-met029',
      'Bouée de la baie de Palma',
      39.498883,
      2.702133,
    ],
  ] as const
).map(([folder, file, name, lat, lon]) => ({
  id: folder,
  name,
  lat,
  lon,
  path: `mooring/weather_station/${folder}/L1/${file}_L1_latest.nc`,
}));

const SOCIB_FIELDS = ['time', 'WIN_SPE', 'WIN_SPE_GUS', 'WIN_DIR', 'AIR_PRE'];

/**
 * Measured wind of the SOCIB stations and buoys around the Balearics.
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations read at most.
 * @returns The readings, empty far from the Balearics or without network.
 */
export async function socibReadings(
  center: { lat: number; lon: number },
  radius: number,
  most: number,
): Promise<WindReading[]> {
  if (distKm(center.lat, center.lon, 39.5, 2.9) > radius + 250) return [];
  const near = nearStations(SOCIB_STATIONS, center, radius, most);
  const now = Date.now();
  const readings = await inBatches(near, async ({ station, km }) => {
    try {
      const base = `${SOCIB_THREDDS}/dodsC/${station.path}`;
      const dds = await textOf(`${base}.dds`, 12_000);
      const size = Number(
        /time\[time = (?<size>\d+)\]/.exec(dds)?.groups?.size,
      );
      if (!Number.isFinite(size) || size < 1) return null;
      const last = `%5B${size - 1}%5D`;
      const query = SOCIB_FIELDS.filter(
        (field) => field === 'time' || dds.includes(` ${field}[`),
      )
        .map((field) => `${field}${last}`)
        .join(',');
      const text = await textOf(`${base}.ascii?${query}`, 12_000);
      return socibReading(opendapValues(text), station, km, now);
    } catch {
      return null;
    }
  });
  // One reading per place: the latest.
  const byPlace = new Map<string, WindReading>();
  for (const reading of readings) {
    if (!reading) continue;
    const place = `${reading.lat?.toFixed(3)},${reading.lon?.toFixed(3)}`;
    const kept = byPlace.get(place);
    if (!kept || reading.t > kept.t) byPlace.set(place, reading);
  }
  return [...byPlace.values()].slice(0, most);
}

/* ---------------------------------------------------------------- lists */

async function keptList<T>(
  key: string,
  maxAge: number,
  load: () => Promise<T[]>,
): Promise<T[]> {
  const kept = store.get<{ at: number; list: T[] } | null>(key, null);
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

/* ------------------------------------------------------------- together */

/**
 * Measured wind of the networks around Italy, Spain and the Balearics,
 * those that answer without a key; each network failing alone.
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations read per network at most.
 * @returns The readings.
 */
export async function euReadings(
  center: { lat: number; lon: number },
  radius: number,
  most: number,
): Promise<WindReading[]> {
  const lists = await Promise.all([
    hubReadings(center, radius, most).catch(() => []),
    portusReadings(center, radius, most).catch(() => []),
    socibReadings(center, radius, most).catch(() => []),
  ]);
  return lists.flat();
}
