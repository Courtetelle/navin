import { store } from '../../storage/store.ts';

import { nearStations } from './euStations.ts';
import type { WindReading } from './windTypes.ts';

/*
 * More networks of measured wind, read straight by the app, without key:
 * Portugal (IPMA), Denmark (DMI), Sweden (SMHI), Finland (FMI).
 */

export const IPMA = 'IPMA (Portugal)';
export const DMI = 'DMI (Danemark)';
export const SMHI = 'SMHI (Suède)';
export const FMI = 'FMI (Finlande)';

const MS_TO_KN = 3600 / 1852;
const WEEK_MS = 7 * 86_400_000;
/** A whole network read again after this long. */
const NETWORK_MS = 10 * 60_000;

interface Placed {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

/** Latitude and longitude box: south, west, north, east. */
type Box = readonly [number, number, number, number];

/**
 * Whether the circle searched touches a box.
 * @param center - The place searched around.
 * @param radius - Radius in km.
 * @param box - South, west, north, east.
 * @returns True when it may hold stations.
 */
export function touches(
  center: { lat: number; lon: number },
  radius: number,
  [south, west, north, east]: Box,
): boolean {
  const dLat = radius / 111;
  const dLon =
    radius / (111 * Math.max(0.2, Math.cos((center.lat * Math.PI) / 180)));
  return (
    center.lat + dLat >= south &&
    center.lat - dLat <= north &&
    center.lon + dLon >= west &&
    center.lon - dLon <= east
  );
}

function fresh(t: number, now: number, most: number): boolean {
  return Number.isFinite(t) && now - t < most && t - now < 10 * 60_000;
}

const knots = (metres: number | null | undefined): number | null =>
  metres == null || !Number.isFinite(metres) ? null : metres * MS_TO_KN;

async function jsonOf(url: string, timeout = 20_000): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
}

async function textOf(url: string, timeout = 20_000): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  if (!response.ok) throw new Error(`${response.status}`);
  return response.text();
}

async function keptList<T>(
  key: string,
  load: () => Promise<T[]>,
): Promise<T[]> {
  const kept = store.get<{ at: number; list: T[] } | null>(key, null);
  if (kept && Date.now() - kept.at < WEEK_MS) return kept.list;
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

/** A whole reply of a network, kept 10 minutes in memory. */
const replies = new Map<string, { at: number; value: Promise<unknown> }>();

function recent<T>(key: string, load: () => Promise<T>): Promise<T> {
  const kept = replies.get(key);
  if (kept && Date.now() - kept.at < NETWORK_MS) {
    return kept.value as Promise<T>;
  }
  const value = load();
  replies.set(key, { at: Date.now(), value });
  value.catch(() => replies.delete(key));
  return value;
}

/* ------------------------------------------------------------ Portugal */

/** Portugal, Madeira and the Azores. */
const PORTUGAL: Box = [30, -32, 42.3, -6];
const IPMA_DATA =
  'https://api.ipma.pt/open-data/observation/meteorology/stations';
/** IPMA publishes about two hours late. */
const IPMA_MAX_AGE_MS = 4 * 3_600_000;
/** The eight points of IPMA (1 = north … 8 = north-west; 0 calm, 9 variable). */
const IPMA_POINTS = [null, 0, 45, 90, 135, 180, 225, 270, 315, null] as const;

/** One hour of one IPMA station. */
export interface IpmaHour {
  intensidadeVento?: number;
  idDireccVento?: number;
  temperatura?: number;
  pressao?: number;
}

/**
 * The latest wind of an IPMA station.
 * @param hours - The observations by hour (`2026-11-15T12:00`, UTC).
 * @param station - The station.
 * @param km - Its distance.
 * @param now - Epoch milliseconds.
 * @returns The reading, null when old or without wind.
 */
export function ipmaReading(
  hours: Record<string, Record<string, IpmaHour | null> | undefined>,
  station: Placed,
  km: number,
  now: number,
): WindReading | null {
  for (const time of Object.keys(hours).toSorted().toReversed()) {
    const hour = hours[time]?.[station.id];
    const speed = hour?.intensidadeVento;
    if (!hour || speed == null || speed < 0) continue;
    const t = Date.parse(`${time}:00Z`);
    if (!fresh(t, now, IPMA_MAX_AGE_MS)) return null;
    const point = hour.idDireccVento ?? -1;
    return {
      name: station.name,
      km,
      t,
      avg: knots(speed) ?? 0,
      gust: null,
      dir: IPMA_POINTS[point] ?? null,
      air:
        hour.temperatura != null && hour.temperatura > -50
          ? hour.temperatura
          : null,
      baro: hour.pressao != null && hour.pressao > 800 ? hour.pressao : null,
      net: IPMA,
      id: station.id,
      lat: station.lat,
      lon: station.lon,
    };
  }
  return null;
}

/**
 * Measured wind of the IPMA stations (Portugal, Madeira, the Azores).
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @returns The readings, empty far from Portugal.
 */
export async function ipmaReadings(
  center: { lat: number; lon: number },
  radius: number,
  most: number,
): Promise<WindReading[]> {
  if (!touches(center, radius, PORTUGAL)) return [];
  const stations = await keptList<Placed>('ldb.ipma.stations', async () => {
    const reply = (await jsonOf(`${IPMA_DATA}/stations.json`)) as Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { idEstacao?: number; localEstacao?: string };
    }>;
    return reply.flatMap(({ geometry, properties }) => {
      const [lon, lat] = geometry?.coordinates ?? [];
      return properties?.idEstacao != null && lat != null && lon != null
        ? [
            {
              id: String(properties.idEstacao),
              name: properties.localEstacao ?? String(properties.idEstacao),
              lat,
              lon,
            },
          ]
        : [];
    });
  });
  const near = nearStations(stations, center, radius, most);
  if (near.length === 0) return [];
  const hours = await recent('ipma', () =>
    jsonOf(`${IPMA_DATA}/observations.json`, 30_000),
  );
  const now = Date.now();
  return near
    .map(({ station, km }) =>
      ipmaReading(
        hours as Record<string, Record<string, IpmaHour | null>>,
        station,
        km,
        now,
      ),
    )
    .filter((reading) => reading !== null);
}

/* ------------------------------------------------------------- Denmark */

const DENMARK: Box = [54, 7, 58.5, 16];
const DMI_API = 'https://opendataapi.dmi.dk/v2/metObs/collections';
const DMI_MAX_AGE_MS = 70 * 60_000;

/** One DMI observation. */
export interface DmiFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    stationId?: string;
    parameterId?: string;
    value?: number;
    observed?: string;
  };
}

/**
 * The latest wind of each DMI station from its observations.
 * @param features - Observations of wind_speed, wind_dir, wind_max.
 * @param names - Station names by id.
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @param now - Epoch milliseconds.
 * @returns The readings.
 */
export function dmiReadingsOf(
  features: readonly DmiFeature[],
  names: Readonly<Record<string, string>>,
  center: { lat: number; lon: number },
  radius: number,
  most: number,
  now: number,
): WindReading[] {
  const stations = new Map<
    string,
    Placed & { t: number; values: Record<string, number> }
  >();
  for (const { geometry, properties } of features) {
    const id = properties?.stationId;
    const [lon, lat] = geometry?.coordinates ?? [];
    const t = Date.parse(properties?.observed ?? '');
    if (!id || lat == null || lon == null || properties?.value == null) {
      continue;
    }
    const station = stations.get(id) ?? {
      id,
      name: names[id] ?? `DMI ${id}`,
      lat,
      lon,
      t,
      values: {},
    };
    const parameter = properties.parameterId ?? '';
    // The latest of each parameter.
    if (t >= station.t || station.values[parameter] == null) {
      station.values[parameter] = properties.value;
      station.t = Math.max(station.t, t);
    }
    stations.set(id, station);
  }
  return nearStations([...stations.values()], center, radius, most)
    .filter(
      ({ station }) =>
        station.values.wind_speed != null &&
        fresh(station.t, now, DMI_MAX_AGE_MS),
    )
    .map(({ station, km }) => ({
      name: station.name,
      km,
      t: station.t,
      avg: knots(station.values.wind_speed) ?? 0,
      gust: knots(station.values.wind_max),
      dir: station.values.wind_dir ?? null,
      net: DMI,
      id: station.id,
      lat: station.lat,
      lon: station.lon,
    }));
}

/**
 * Measured wind of the DMI stations (Denmark, its coasts and islands).
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @returns The readings, empty far from Denmark.
 */
export async function dmiReadings(
  center: { lat: number; lon: number },
  radius: number,
  most: number,
): Promise<WindReading[]> {
  if (!touches(center, radius, DENMARK)) return [];
  const pairs = await keptList<[string, string]>(
    'ldb.dmi.stations',
    async () => {
      const reply = (await jsonOf(
        `${DMI_API}/station/items?bbox=${DENMARK[1]},${DENMARK[0]},${DENMARK[3]},${DENMARK[2]}&limit=10000`,
        30_000,
      )) as {
        features?: Array<{
          properties?: { stationId?: string; name?: string };
        }>;
      };
      return (reply.features ?? []).flatMap(({ properties }) =>
        properties?.stationId && properties.name
          ? [[properties.stationId, properties.name] as [string, string]]
          : [],
      );
    },
  );
  const names = Object.fromEntries(pairs);
  const box = `${DENMARK[1]},${DENMARK[0]},${DENMARK[3]},${DENMARK[2]}`;
  const lists = await Promise.all(
    ['wind_speed', 'wind_dir', 'wind_max'].map((parameter) =>
      recent(`dmi:${parameter}`, async () => {
        const reply = (await jsonOf(
          `${DMI_API}/observation/items?parameterId=${parameter}&bbox=${box}&period=latest-hour&limit=10000`,
        )) as { features?: DmiFeature[] };
        return reply.features ?? [];
      }).catch(() => [] as DmiFeature[]),
    ),
  );
  return dmiReadingsOf(lists.flat(), names, center, radius, most, Date.now());
}

/* -------------------------------------------------------------- Sweden */

const SWEDEN: Box = [55, 10.5, 69.5, 24.5];
const SMHI_API =
  'https://opendata-download-metobs.smhi.se/api/version/1.0/parameter';
const SMHI_MAX_AGE_MS = 2 * 3_600_000;

/** The stations of one SMHI parameter, the latest hour. */
export interface SmhiReply {
  station?: Array<{
    key?: string;
    name?: string;
    latitude?: number;
    longitude?: number;
    value?: Array<{ date?: number; value?: string }> | null;
  }>;
}

/**
 * The latest wind of the SMHI stations from their three parameters.
 * @param speed - Parameter 4, mean wind (m/s).
 * @param direction - Parameter 3, direction.
 * @param gust - Parameter 21, gusts (m/s).
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @param now - Epoch milliseconds.
 * @returns The readings.
 */
export function smhiReadingsOf(
  speed: SmhiReply,
  direction: SmhiReply,
  gust: SmhiReply,
  center: { lat: number; lon: number },
  radius: number,
  most: number,
  now: number,
): WindReading[] {
  const valueOf = (reply: SmhiReply) =>
    new Map(
      (reply.station ?? []).map((station) => {
        const last = station.value?.at(-1);
        return [station.key ?? '', last ? Number(last.value) : Number.NaN];
      }),
    );
  const directions = valueOf(direction);
  const gusts = valueOf(gust);
  const stations = (speed.station ?? []).flatMap((station) => {
    const last = station.value?.at(-1);
    const value = Number(last?.value);
    if (
      !station.key ||
      station.latitude == null ||
      station.longitude == null ||
      !Number.isFinite(value) ||
      !fresh(last?.date ?? Number.NaN, now, SMHI_MAX_AGE_MS)
    ) {
      return [];
    }
    return [
      {
        id: station.key,
        name: station.name ?? station.key,
        lat: station.latitude,
        lon: station.longitude,
        t: last?.date ?? now,
        value,
      },
    ];
  });
  return nearStations(stations, center, radius, most).map(({ station, km }) => {
    const dir = directions.get(station.id);
    const gustValue = gusts.get(station.id);
    return {
      name: station.name,
      km,
      t: station.t,
      avg: knots(station.value) ?? 0,
      gust:
        gustValue != null && Number.isFinite(gustValue)
          ? knots(gustValue)
          : null,
      dir: dir != null && Number.isFinite(dir) ? dir : null,
      net: SMHI,
      id: station.id,
      lat: station.lat,
      lon: station.lon,
    };
  });
}

/**
 * Measured wind of the SMHI stations (Sweden, the Baltic and its gulfs).
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @returns The readings, empty far from Sweden.
 */
export async function smhiReadings(
  center: { lat: number; lon: number },
  radius: number,
  most: number,
): Promise<WindReading[]> {
  if (!touches(center, radius, SWEDEN)) return [];
  const [speed, direction, gust] = await Promise.all(
    [4, 3, 21].map((parameter) =>
      recent(
        `smhi:${parameter}`,
        async () =>
          (await jsonOf(
            `${SMHI_API}/${parameter}/station-set/all/period/latest-hour/data.json`,
          )) as SmhiReply,
      ).catch(() => ({})),
    ),
  );
  return smhiReadingsOf(
    speed ?? {},
    direction ?? {},
    gust ?? {},
    center,
    radius,
    most,
    Date.now(),
  );
}

/* ------------------------------------------------------------- Finland */

const FINLAND: Box = [59.3, 19, 70.2, 31.6];
const FMI_WFS = 'https://opendata.fmi.fi/wfs';
const FMI_MAX_AGE_MS = 70 * 60_000;

/**
 * The latest wind of the FMI stations from a `timevaluepair` reply.
 * @param xml - The WFS reply.
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @param now - Epoch milliseconds.
 * @returns The readings.
 */
export function fmiReadingsOf(
  xml: string,
  center: { lat: number; lon: number },
  radius: number,
  most: number,
  now: number,
): WindReading[] {
  const stations = new Map<
    string,
    Placed & { t: number; values: Record<string, number> }
  >();
  for (const member of xml.split('<wfs:member>').slice(1)) {
    const name =
      /locationcode\/name">(?<name>[^<]+)</u.exec(member)?.groups?.name ?? '';
    const pos = /<gml:pos>(?<lat>[\d.-]+)\s+(?<lon>[\d.-]+)/u.exec(
      member,
    )?.groups;
    const parameter =
      /gml:id="obs-obs-\d+-\d+-(?<parameter>[a-z]+)"/u.exec(member)?.groups
        ?.parameter ?? '';
    if (!name || !pos || !parameter) continue;
    let t = Number.NaN;
    let value = Number.NaN;
    for (const point of member.matchAll(
      /<wml2:time>(?<time>[^<]+)<\/wml2:time>\s*<wml2:value>(?<value>[^<]+)<\/wml2:value>/gu,
    )) {
      const number = Number(point.groups?.value);
      if (Number.isFinite(number)) {
        t = Date.parse(point.groups?.time ?? '');
        value = number;
      }
    }
    if (!Number.isFinite(value)) continue;
    const id = `${pos.lat},${pos.lon}`;
    const station = stations.get(id) ?? {
      id,
      name,
      lat: Number(pos.lat),
      lon: Number(pos.lon),
      t,
      values: {},
    };
    station.values[parameter] = value;
    station.t = Number.isFinite(station.t) ? Math.max(station.t, t) : t;
    stations.set(id, station);
  }
  return nearStations([...stations.values()], center, radius, most)
    .filter(
      ({ station }) =>
        station.values.windspeedms != null &&
        fresh(station.t, now, FMI_MAX_AGE_MS),
    )
    .map(({ station, km }) => ({
      name: station.name,
      km,
      t: station.t,
      avg: knots(station.values.windspeedms) ?? 0,
      gust: knots(station.values.windgust),
      dir: station.values.winddirection ?? null,
      net: FMI,
      id: station.id,
      lat: station.lat,
      lon: station.lon,
    }));
}

/**
 * Measured wind of the FMI stations (Finland, the Åland islands, the gulfs).
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param most - Stations kept at most.
 * @returns The readings, empty far from Finland.
 */
export async function fmiReadings(
  center: { lat: number; lon: number },
  radius: number,
  most: number,
): Promise<WindReading[]> {
  if (!touches(center, radius, FINLAND)) return [];
  const dLat = radius / 111;
  const dLon = radius / (111 * Math.cos((center.lat * Math.PI) / 180));
  const box = [
    center.lon - dLon,
    center.lat - dLat,
    center.lon + dLon,
    center.lat + dLat,
  ]
    .map((value) => value.toFixed(2))
    .join(',');
  const start = new Date(Date.now() - 3_600_000).toISOString().slice(0, 16);
  const xml = await textOf(
    `${FMI_WFS}?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::observations::weather::timevaluepair&bbox=${box}&parameters=windspeedms,winddirection,windgust&starttime=${start}:00Z`,
    30_000,
  );
  return fmiReadingsOf(xml, center, radius, most, Date.now());
}
