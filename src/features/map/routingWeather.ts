import type { LatLon } from '../../lib/geo.ts';
import { bearing, destination, distNM } from '../../lib/geo.ts';
import { openMeteoFetch } from '../../lib/openMeteo.ts';
import type { RoutePoint } from '../../model/routes.ts';
import type { Wind } from '../../model/sailRouting.ts';

/** The weather models a routing can take. */
export const ROUTING_MODELS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'best_match', name: 'Meilleur modèle du lieu (Open-Meteo)' },
  { id: 'ecmwf_ifs025', name: 'ECMWF IFS (CEPMMT, 25 km)' },
  { id: 'meteofrance_seamless', name: 'Météo-France AROME / ARPEGE' },
  { id: 'icon_seamless', name: 'DWD ICON' },
  { id: 'gfs_seamless', name: 'NOAA GFS' },
];

/** At most this many places along the route are asked: one request. */
const MOST_PLACES = 12;

/** The wind along a route, hour by hour, at a few places. */
export interface RouteWind {
  places: LatLon[];
  /** Epoch ms of each hour. */
  hours: number[];
  /** `[place][hour]` speed, knots. */
  speed: number[][];
  /** `[place][hour]` direction it comes from, degrees. */
  from: number[][];
  model: string;
}

/**
 * Places along a route, about evenly spaced, the points of the route among
 * them.
 * @param points - The route.
 * @returns At most {@link MOST_PLACES} places.
 */
export function windPlaces(points: readonly RoutePoint[]): LatLon[] {
  if (points.length === 0) return [];
  let total = 0;
  for (let rank = 1; rank < points.length; rank++) {
    total += distNM(points[rank - 1] as LatLon, points[rank] as LatLon);
  }
  const room = Math.max(MOST_PLACES - points.length, 0);
  const spacing = room > 0 && total > 0 ? total / (room + 1) : Infinity;
  const places: LatLon[] = [points[0] as LatLon];
  for (let rank = 1; rank < points.length; rank++) {
    const from = points[rank - 1] as LatLon;
    const to = points[rank] as LatLon;
    const legNm = distNM(from, to);
    const course = bearing(from, to);
    for (let along = spacing; along < legNm - spacing / 3; along += spacing) {
      places.push(destination(from, course, along));
    }
    places.push(to);
  }
  return places.slice(0, MOST_PLACES * 2);
}

interface HourlyReply {
  hourly?: {
    time?: number[];
    // eslint-disable-next-line @typescript-eslint/naming-convention -- name in the API
    wind_speed_10m?: Array<number | null>;
    // eslint-disable-next-line @typescript-eslint/naming-convention -- name in the API
    wind_direction_10m?: Array<number | null>;
  };
}

/**
 * The wind forecast along a route, in one request to Open-Meteo (kept 30
 * minutes for the same request).
 * @param points - The route.
 * @param model - One of {@link ROUTING_MODELS}.
 * @returns The wind, or why there is none.
 */
export async function fetchRouteWind(
  points: readonly RoutePoint[],
  model: string,
): Promise<RouteWind | { error: string }> {
  return askWind(
    windPlaces(points),
    'https://api.open-meteo.com/v1/forecast',
    `forecast_days=10&models=${model}`,
    model,
  );
}

/** Open-Meteo keeps its forecasts this many days back. */
const PAST_DAYS = 90;

/**
 * The wind of the models over a past navigation: the forecast kept by
 * Open-Meteo within 90 days, else its archive (ERA5, coarser).
 * @param points - Places of the navigation.
 * @param startMs - Its start.
 * @param endMs - Its end.
 * @returns The wind, or why there is none.
 */
export async function fetchPastWind(
  points: readonly RoutePoint[],
  startMs: number,
  endMs: number,
): Promise<RouteWind | { error: string }> {
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const dates = `start_date=${day(startMs)}&end_date=${day(endMs)}`;
  const recent = Date.now() - startMs < PAST_DAYS * 86_400_000;
  return recent
    ? askWind(
        windPlaces(points),
        'https://api.open-meteo.com/v1/forecast',
        dates,
        'best_match',
      )
    : askWind(
        windPlaces(points),
        'https://archive-api.open-meteo.com/v1/archive',
        dates,
        'era5',
      );
}

async function askWind(
  places: LatLon[],
  base: string,
  extra: string,
  model: string,
): Promise<RouteWind | { error: string }> {
  if (places.length === 0) return { error: 'La route n’a pas de point.' };
  const lat = places.map((place) => place.lat.toFixed(3)).join(',');
  const lon = places.map((place) => place.lon.toFixed(3)).join(',');
  const url = `${base}?latitude=${lat}&longitude=${lon}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kn&timeformat=unixtime&${extra}`;
  let reply: Response;
  try {
    reply = await openMeteoFetch(url);
  } catch {
    return { error: 'Pas de réseau : la prévision ne se charge pas.' };
  }
  if (reply.status === 429) {
    return {
      error:
        'Open-Meteo refuse pour l’instant (limite du jour) : réessayez dans quelques minutes.',
    };
  }
  if (!reply.ok) return { error: `Open-Meteo répond ${reply.status}.` };
  const body = (await reply.json()) as HourlyReply | HourlyReply[];
  const list = Array.isArray(body) ? body : [body];
  const hours = (list[0]?.hourly?.time ?? []).map((time) => time * 1000);
  if (hours.length === 0) return { error: 'Prévision vide pour ce modèle.' };
  const clean = (values: Array<number | null> | undefined) =>
    hours.map((_, rank) => values?.[rank] ?? Number.NaN);
  return {
    places,
    hours,
    speed: list.map((item) => clean(item.hourly?.wind_speed_10m)),
    from: list.map((item) => clean(item.hourly?.wind_direction_10m)),
    model,
  };
}

/**
 * The wind at a place and time: the nearest place asked, between its hours
 * (the direction turned the short way).
 * @param wind - The wind along the route.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param ms - Time, epoch ms.
 * @returns The wind, `null` out of the forecast.
 */
export function windAt(
  wind: RouteWind,
  lat: number,
  lon: number,
  ms: number,
): Wind | null {
  const { hours, places, speed, from } = wind;
  const first = hours[0] as number;
  const last = hours.at(-1) as number;
  if (ms < first - 3_600_000 || ms > last) return null;
  let place = 0;
  let nearest = Infinity;
  for (const [rank, spot] of places.entries()) {
    const away = distNM(spot, { lat, lon });
    if (away < nearest) {
      nearest = away;
      place = rank;
    }
  }
  const span = hours.length > 1 ? (hours[1] as number) - first : 3_600_000;
  const at = Math.max(0, Math.min(hours.length - 1, (ms - first) / span));
  const low = Math.floor(at);
  const high = Math.min(low + 1, hours.length - 1);
  const share = at - low;
  const speeds = speed[place] ?? [];
  const froms = from[place] ?? [];
  const pick = (rank: number) => ({
    tws: speeds[rank] as number,
    twd: froms[rank] as number,
  });
  const a = pick(low);
  const b = pick(high);
  if (![a.tws, a.twd, b.tws, b.twd].every(Number.isFinite)) return null;
  // Mix as vectors, so that 350° and 10° give 0°.
  const x =
    a.tws * Math.cos((a.twd * Math.PI) / 180) * (1 - share) +
    b.tws * Math.cos((b.twd * Math.PI) / 180) * share;
  const y =
    a.tws * Math.sin((a.twd * Math.PI) / 180) * (1 - share) +
    b.tws * Math.sin((b.twd * Math.PI) / 180) * share;
  const tws = a.tws * (1 - share) + b.tws * share;
  const twd = ((((Math.atan2(y, x) * 180) / Math.PI) % 360) + 360) % 360;
  return { tws, twd };
}
