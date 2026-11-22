/**
 * The weather laid over the map of LiveMétéo: the wind forecast at the hour
 * chosen (barbs), the waves (an arrow and their height), the currents
 * (Atlantic, Channel and North Sea everywhere; the Mediterranean only in its
 * well-known straits) and the rain of the radar, live.
 *
 * Wind and sea come from Open-Meteo in one request each for a whole grid,
 * kept 30 minutes (see `openMeteoFetch`); the grid is snapped to round
 * coordinates so the same map asks the same request. The rain comes from the
 * radar mosaic of RainViewer (free, no key).
 */
import type { LatLon } from '../../lib/geo.ts';
import { openMeteoFetch } from '../../lib/openMeteo.ts';
import { degreeOfHeight, groupOfDegree } from '../../model/beaufortDouglas.ts';

import { windRegion } from './windModels.ts';

/** The south-west and north-east corners of the area shown. */
export interface Area {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** At most this many points are asked: one request, light on the quota. */
export const MOST_POINTS = 20;
/** Spacings the grid takes, in degrees: round, so the requests repeat. */
const STEPS = [
  0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1, 1.5, 2, 3,
];
/** Hours of forecast asked: today and tomorrow. */
export const FORECAST_HOURS = 48;

/**
 * The points of a grid over an area: a round spacing, the points inside it,
 * at most {@link MOST_POINTS}; the finest round spacing that fits.
 * @param area - The area.
 * @param most - At most this many points.
 * @param shifted - The grid moved by half a spacing: the sea between the
 * barbs of the wind.
 * @returns The points, west to east then south to north.
 */
export function gridPoints(
  area: Area,
  most = MOST_POINTS,
  shifted = false,
): LatLon[] {
  const lay = (step: number, shift: number) => {
    const lat0 = Math.ceil((area.south - shift) / step) * step + shift;
    const lon0 = Math.ceil((area.west - shift) / step) * step + shift;
    const rows = Math.floor((area.north - lat0) / step + 1e-9) + 1;
    const cols = Math.floor((area.east - lon0) / step + 1e-9) + 1;
    return { lat0, lon0, rows: Math.max(rows, 0), cols: Math.max(cols, 0) };
  };
  // The spacing of the grid itself; the shifted grid takes the same.
  const step = STEPS.find((each) => {
    const { rows, cols } = lay(each, 0);
    return rows > 0 && cols > 0 && rows * cols <= most;
  });
  if (step === undefined) {
    return [
      {
        lat: round((area.south + area.north) / 2),
        lon: round((area.west + area.east) / 2),
      },
    ];
  }
  const { lat0, lon0, rows, cols } = lay(step, shifted ? step / 2 : 0);
  const points: LatLon[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      points.push({
        lat: round(lat0 + row * step),
        lon: round(lon0 + col * step),
      });
    }
  }
  return points;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Switzerland and its lakes: the model of MeteoSwiss, 1 km. */
const SWISS: Area = { south: 45.8, north: 47.85, west: 5.9, east: 10.6 };

function inArea(point: LatLon, area: Area): boolean {
  return (
    point.lat >= area.south &&
    point.lat <= area.north &&
    point.lon >= area.west &&
    point.lon <= area.east
  );
}

/**
 * The local model of a place, as the wind alerts take it: MeteoSwiss in
 * Switzerland, the finest model of the region elsewhere, else the best
 * model of Open-Meteo.
 * @param place - The middle of the map.
 * @returns The Open-Meteo id (empty: best model) and its name.
 */
export function localModel(place: LatLon): { id: string; name: string } {
  if (inArea(place, SWISS)) {
    return { id: 'meteoswiss_icon_ch1', name: 'MeteoSwiss ICON-CH1 1 km' };
  }
  const first = windRegion(place)?.models[0];
  if (first) return { id: first[0], name: first[1] };
  return { id: 'best_match', name: 'meilleur modèle Open-Meteo' };
}

/** The wind of one point at each hour. */
export interface PointWind {
  lat: number;
  lon: number;
  /** Knots, per hour. */
  speed: number[];
  /** Gusts in knots, per hour. */
  gust: number[];
  /** Where it comes from, degrees, per hour. */
  from: number[];
}

/** The sea of one point at each hour. */
export interface PointSea {
  lat: number;
  lon: number;
  /** Significant height, metres, per hour (NaN over land). */
  height: number[];
  /** Where the waves come from, degrees, per hour. */
  from: number[];
  /** Surface current, knots, per hour. */
  current: number[];
  /** Where the current goes, degrees, per hour. */
  toward: number[];
}

/** A grid of forecasts, hour by hour. */
export interface Grid<T> {
  /** Epoch ms of each hour. */
  hours: number[];
  points: T[];
}

type Series = Array<number | null> | undefined;

interface Hourly {
  hourly?: Record<string, Series | number[]>;
  latitude?: number;
  longitude?: number;
}

function series(item: Hourly, name: string, count: number): number[] {
  const values = item.hourly?.[name];
  return Array.from({ length: count }, (_, rank) => {
    const value = values?.[rank];
    return value ?? Number.NaN;
  });
}

function replies(body: unknown): Hourly[] {
  if (Array.isArray(body)) return body as Hourly[];
  return body && typeof body === 'object' ? [body] : [];
}

function hoursOf(list: Hourly[]): number[] {
  const time = (list[0]?.hourly?.time ?? []) as number[];
  return time.map((value) => value * 1000);
}

/**
 * The wind grid of an Open-Meteo reply (one or many places).
 * @param body - The reply, parsed.
 * @param points - The points asked, in the same order.
 * @returns The grid, null when empty.
 */
export function windGridOf(
  body: unknown,
  points: readonly LatLon[],
): Grid<PointWind> | null {
  const list = replies(body);
  const hours = hoursOf(list);
  if (hours.length === 0) return null;
  return {
    hours,
    points: list.map((item, rank) => ({
      lat: points[rank]?.lat ?? item.latitude ?? 0,
      lon: points[rank]?.lon ?? item.longitude ?? 0,
      speed: series(item, 'wind_speed_10m', hours.length),
      gust: series(item, 'wind_gusts_10m', hours.length),
      from: series(item, 'wind_direction_10m', hours.length),
    })),
  };
}

/** Open-Meteo gives the current in km/h. */
const KMH_PER_KNOT = 1.852;

/**
 * The sea grid of an Open-Meteo marine reply.
 * @param body - The reply, parsed.
 * @param points - The points asked, in the same order.
 * @returns The grid, null when empty.
 */
export function seaGridOf(
  body: unknown,
  points: readonly LatLon[],
): Grid<PointSea> | null {
  const list = replies(body);
  const hours = hoursOf(list);
  if (hours.length === 0) return null;
  return {
    hours,
    points: list.map((item, rank) => ({
      lat: points[rank]?.lat ?? item.latitude ?? 0,
      lon: points[rank]?.lon ?? item.longitude ?? 0,
      height: series(item, 'wave_height', hours.length),
      from: series(item, 'wave_direction', hours.length),
      current: series(item, 'ocean_current_velocity', hours.length).map(
        (kmh) => kmh / KMH_PER_KNOT,
      ),
      toward: series(item, 'ocean_current_direction', hours.length),
    })),
  };
}

/** Why a layer has nothing: shown in the bar. */
export interface Failure {
  error: string;
}

function coords(points: readonly LatLon[]): string {
  const lat = points.map((point) => point.lat.toFixed(3)).join(',');
  const lon = points.map((point) => point.lon.toFixed(3)).join(',');
  return `latitude=${lat}&longitude=${lon}`;
}

async function ask(url: string): Promise<unknown> {
  let reply: Response;
  try {
    reply = await openMeteoFetch(url, { signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    throw new Error('Pas de réseau : la prévision ne se charge pas.', {
      cause: error,
    });
  }
  if (reply.status === 429) {
    throw new Error(
      'Open-Meteo refuse pour l’instant (limite du jour) : réessayez plus tard.',
    );
  }
  if (!reply.ok) throw new Error(`Open-Meteo répond ${reply.status}.`);
  return reply.json();
}

function failure(error: unknown): Failure {
  return {
    error: error instanceof Error ? error.message : 'Prévision indisponible.',
  };
}

/**
 * The wind forecast of a grid, from the local model, in one request.
 * @param points - The grid.
 * @param model - Open-Meteo id of the model.
 * @returns The grid, or why there is none.
 */
export async function fetchWindGrid(
  points: readonly LatLon[],
  model: string,
): Promise<Grid<PointWind> | Failure> {
  const url = `https://api.open-meteo.com/v1/forecast?${coords(points)}&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kn&timeformat=unixtime&forecast_hours=${FORECAST_HOURS}&past_hours=1&models=${model}&cell_selection=sea`;
  try {
    return (
      windGridOf(await ask(url), points) ?? {
        error: 'Prévision du vent vide pour ce modèle.',
      }
    );
  } catch (error) {
    return failure(error);
  }
}

/**
 * The waves and currents of a grid, in one request to the marine model.
 * @param points - The grid (and the middles of the straits shown).
 * @returns The grid, or why there is none.
 */
export async function fetchSeaGrid(
  points: readonly LatLon[],
): Promise<Grid<PointSea> | Failure> {
  const url = `https://marine-api.open-meteo.com/v1/marine?${coords(points)}&hourly=wave_height,wave_direction,ocean_current_velocity,ocean_current_direction&timeformat=unixtime&forecast_hours=${FORECAST_HOURS}&past_hours=1&cell_selection=sea`;
  try {
    return (
      seaGridOf(await ask(url), points) ?? { error: 'Prévision de mer vide.' }
    );
  } catch (error) {
    return failure(error);
  }
}

/**
 * The rank of the hour of a grid nearest to a time.
 * @param hours - Epoch ms of each hour.
 * @param ms - The time.
 * @returns The rank, -1 when there is no hour within 90 minutes.
 */
export function hourRank(hours: readonly number[], ms: number): number {
  let best = -1;
  let nearest = Infinity;
  for (const [rank, hour] of hours.entries()) {
    const away = Math.abs(hour - ms);
    if (away < nearest) {
      nearest = away;
      best = rank;
    }
  }
  return nearest <= 90 * 60_000 ? best : -1;
}

/** A strait of the Mediterranean known for its currents. */
export interface Strait {
  name: string;
  area: Area;
}

/**
 * The Mediterranean straits whose currents are well known: there only is the
 * current of the Mediterranean shown (elsewhere it is weak and the model
 * says little).
 */
export const MED_STRAITS: readonly Strait[] = [
  {
    name: 'Détroit de Gibraltar',
    area: { south: 35.75, north: 36.2, west: -6.05, east: -5.25 },
  },
  {
    name: 'Bouches de Bonifacio',
    area: { south: 41.2, north: 41.45, west: 8.9, east: 9.45 },
  },
  {
    name: 'Détroit de Messine',
    area: { south: 37.9, north: 38.3, west: 15.5, east: 15.75 },
  },
  {
    name: 'Canal de Piombino',
    area: { south: 42.8, north: 43, west: 10.3, east: 10.6 },
  },
  {
    name: 'Euripe (Chalcis)',
    area: { south: 38.38, north: 38.52, west: 23.52, east: 23.68 },
  },
  {
    name: 'Dardanelles',
    area: { south: 39.95, north: 40.45, west: 26.15, east: 26.75 },
  },
  {
    name: 'Bosphore',
    area: { south: 40.98, north: 41.25, west: 28.95, east: 29.15 },
  },
];

/**
 * Whether a place is in the Mediterranean (and the Black Sea), not in the
 * Atlantic, the Channel or the North Sea.
 * @param point - The place.
 * @returns In the Mediterranean.
 */
export function inMediterranean(point: LatLon): boolean {
  const { lat, lon } = point;
  if (lat < 30 || lat > 47 || lon < -5.6 || lon > 42) return false;
  // The Bay of Biscay and the Atlantic coast of Spain.
  if (lat > 42.2 && lon < 1.5) return false;
  return true;
}

/**
 * Whether the current of a place is shown: the Atlantic side everywhere, the
 * Mediterranean in its straits only.
 * @param point - The place.
 * @returns The current is shown.
 */
export function currentShown(point: LatLon): boolean {
  if (!inMediterranean(point)) return true;
  return MED_STRAITS.some(({ area }) => inArea(point, area));
}

function overlaps(a: Area, b: Area): boolean {
  return (
    a.south <= b.north &&
    a.north >= b.south &&
    a.west <= b.east &&
    a.east >= b.west
  );
}

/**
 * Points added in the straits of an area: their current is narrow, the
 * grid alone would miss it.
 * @param area - The area shown.
 * @returns The middles of the straits in it.
 */
export function straitPoints(area: Area): LatLon[] {
  return MED_STRAITS.filter((strait) => overlaps(strait.area, area)).map(
    ({ area: box }) => ({
      lat: round((box.south + box.north) / 2),
      lon: round((box.west + box.east) / 2),
    }),
  );
}

/** One barb of the wind: its staff and its feathers. */
export interface Barb {
  /** 50 kn pennants. */
  pennants: number;
  /** 10 kn feathers. */
  full: number;
  /** One 5 kn feather. */
  half: boolean;
  /** Under 2.5 kn: a circle, no staff. */
  calm: boolean;
}

/**
 * The feathers of a wind, rounded to 5 knots (WMO).
 * @param knots - The wind.
 * @returns The barb.
 */
export function barbOf(knots: number): Barb {
  const rounded = Math.round(knots / 5) * 5;
  if (!Number.isFinite(knots) || knots < 2.5) {
    return { pennants: 0, full: 0, half: false, calm: true };
  }
  const pennants = Math.floor(rounded / 50);
  const full = Math.floor((rounded % 50) / 10);
  const half = rounded % 10 === 5;
  return { pennants, full, half, calm: false };
}

/**
 * The SVG of a wind barb, the staff pointing where the wind comes from
 * (north up; the map turns it), the feathers clockwise of the staff as in
 * the northern hemisphere.
 * @param knots - The wind.
 * @param from - Where it comes from, degrees.
 * @param color - Colour of the barb.
 * @returns The SVG, 56 px square, the station in the middle.
 */
export function barbSvg(knots: number, from: number, color: string): string {
  const barb = barbOf(knots);
  const size = 56;
  const mid = size / 2;
  const halo = 'stroke="#fff" stroke-width="5" stroke-linecap="round"';
  if (barb.calm) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${mid}" cy="${mid}" r="5" fill="none" ${halo}/><circle cx="${mid}" cy="${mid}" r="5" fill="none" stroke="${color}" stroke-width="2"/></svg>`;
  }
  // Staff from the middle up (north), turned to where the wind comes from.
  const top = 3;
  const parts: string[] = [`M${mid} ${mid}V${top}`];
  let y = top;
  const tick = 12;
  const gap = 4.5;
  for (let rank = 0; rank < barb.pennants; rank++) {
    parts.push(`M${mid} ${y}l${tick} 3l-${tick} 3z`);
    y += 7.5;
  }
  for (let rank = 0; rank < barb.full; rank++) {
    parts.push(`M${mid} ${y}l${tick} -3`);
    y += gap;
  }
  if (barb.half) {
    // A lone 5 kn feather stands a little down the staff, as on charts.
    if (barb.pennants === 0 && barb.full === 0) y += gap;
    parts.push(`M${mid} ${y}l${tick / 2} -1.5`);
  }
  const path = parts.join('');
  const turn = `transform="rotate(${Math.round(from)} ${mid} ${mid})"`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g ${turn}><path d="${path}" fill="#fff" ${halo} stroke-linejoin="round"/><path d="${path}" fill="${color}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g><circle cx="${mid}" cy="${mid}" r="2.6" fill="${color}" stroke="#fff" stroke-width="1.2"/></svg>`;
}

/**
 * The SVG of an arrow going toward a bearing: waves (where they go, their
 * height in its length) or a current.
 * @param toward - Where it goes, degrees.
 * @param scale - 0 to 1: its length and width.
 * @param color - Its colour.
 * @param wavy - A wavy staff, for the waves.
 * @returns The SVG, 60 px square, the point in the middle.
 */
export function arrowSvg(
  toward: number,
  scale: number,
  color: string,
  wavy: boolean,
): string {
  const size = 60;
  const mid = size / 2;
  const fit = Math.max(0, Math.min(1, scale));
  const half = 9 + 17 * fit;
  const width = 2.5 + 3 * fit;
  const tail = mid + half;
  const head = mid - half;
  let staff: string;
  if (wavy) {
    const step = (2 * half) / 4;
    staff = `M${mid} ${tail}`;
    for (let rank = 0; rank < 4; rank++) {
      const side = rank % 2 === 0 ? 4 : -4;
      staff += `q${side} ${-step / 2} 0 ${-step}`;
    }
  } else {
    staff = `M${mid} ${tail}V${head + 4}`;
  }
  const tip = `M${mid - 6 - fit * 3} ${head + 9 + fit * 3}L${mid} ${head}L${mid + 6 + fit * 3} ${head + 9 + fit * 3}`;
  const turn = `transform="rotate(${Math.round(toward)} ${mid} ${mid})"`;
  const line = `fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><g ${turn} ${line}><path d="${staff}${tip}" stroke="#fff" stroke-width="${width + 3}"/><path d="${staff}${tip}" stroke="${color}" stroke-width="${width}"/></g></svg>`;
}

/**
 * The colour of a wind on the barbs, by Beaufort: calm blue, green, yellow
 * at 5 Bf, orange at 6, red at 7 (the no-go) and beyond.
 * @param knots - The wind.
 * @returns A CSS colour.
 */
export function windColor(knots: number): string {
  if (knots >= 27.5) return '#c8001e';
  if (knots >= 21.5) return '#e05a00';
  if (knots >= 16.5) return '#b88a00';
  if (knots >= 10.5) return '#1f7a3a';
  return '#1e4f9c';
}

/** The radar mosaic of RainViewer: the frames of the last two hours. */
export interface RainFrames {
  host: string;
  /** Newest last. */
  frames: Array<{ time: number; path: string }>;
}

/**
 * The frames of a RainViewer reply.
 * @param body - The reply, parsed.
 * @returns The frames, null when there are none.
 */
export function rainFramesOf(body: unknown): RainFrames | null {
  if (!body || typeof body !== 'object') return null;
  const { host, radar } = body as {
    host?: unknown;
    radar?: { past?: Array<{ time?: unknown; path?: unknown }> };
  };
  if (typeof host !== 'string') return null;
  const frames = (radar?.past ?? [])
    .filter(
      (frame): frame is { time: number; path: string } =>
        typeof frame.time === 'number' && typeof frame.path === 'string',
    )
    .map(({ time, path }) => ({ time: time * 1000, path }));
  return frames.length > 0 ? { host, frames } : null;
}

/** The list of the radar frames of RainViewer. */
export const RAIN_INDEX = 'https://api.rainviewer.com/public/weather-maps.json';

/**
 * The newest radar frames.
 * @returns The frames, or why there are none.
 */
export async function fetchRainFrames(): Promise<RainFrames | Failure> {
  try {
    const reply = await fetch(RAIN_INDEX, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!reply.ok) {
      return { error: `Radar : RainViewer répond ${reply.status}.` };
    }
    return (
      rainFramesOf(await reply.json()) ?? { error: 'Radar : aucune image.' }
    );
  } catch {
    return { error: 'Radar de pluie injoignable (réseau).' };
  }
}

/**
 * The tile address of a radar frame: the « Universal Blue » colours of
 * RainViewer (light blue for drizzle, deep blue, yellow, red, purple for the
 * heaviest), smoothed, snow shown.
 * @param rain - The frames.
 * @param path - The path of one frame.
 * @returns The Leaflet tile address.
 */
export function rainTileUrl(rain: RainFrames, path: string): string {
  return `${rain.host}${path}/256/{z}/{x}/{y}/2/1_1.png`;
}

/** The free radar tiles of RainViewer stop at this zoom; beyond, enlarged. */
export const RAIN_NATIVE_ZOOM = 7;

/**
 * The label of the waves: their significant height (Hs, the mean of the
 * highest third) and their Douglas degree on the colour of its group, as in
 * the Beaufort / Douglas table of NavIn.
 * @param height - Hs, metres.
 * @returns The HTML.
 */
export function waveLabelHtml(height: number): string {
  const degree = degreeOfHeight(height);
  const group = groupOfDegree(degree);
  const metres = height.toFixed(1).replace('.', ',');
  return `<span class="wx-lbl wx-wave" title="Hs ${metres} m, Douglas ${degree}">${metres} m<b class="wx-dg" style="background:${group.color};color:${group.ink}">${degree}</b></span>`;
}

/** Under this, the current is slack whatever the hours around. */
export const SLACK_KN = 0.3;
/** Under this, the current is slack when it is at its weakest of the hours around. */
const TURNING_KN = 0.6;

/**
 * Whether the current is slack at an hour: very weak, or weak and at its
 * weakest between the hour before and the hour after (the tide turns).
 * @param speeds - Knots, per hour.
 * @param rank - The hour.
 * @returns Slack water.
 */
export function isSlack(speeds: readonly number[], rank: number): boolean {
  const now = speeds[rank] ?? Number.NaN;
  if (!Number.isFinite(now)) return false;
  if (now < SLACK_KN) return true;
  if (now >= TURNING_KN) return false;
  const before = speeds[rank - 1] ?? Number.NaN;
  const after = speeds[rank + 1] ?? Number.NaN;
  return (
    Number.isFinite(before) &&
    Number.isFinite(after) &&
    now <= before &&
    now <= after
  );
}

/**
 * The mark of slack water: a ring with a wavy line, no arrow.
 * @param color - Its colour.
 * @returns The SVG, 60 px square, the point in the middle.
 */
export function slackSvg(color: string): string {
  const ring = `<circle cx="30" cy="30" r="9" fill="none"`;
  const wave = `<path d="M23 30q3.5-4 7 0t7 0" fill="none" stroke-linecap="round"`;
  return `<svg width="60" height="60" viewBox="0 0 60 60">${ring} stroke="#fff" stroke-width="5"/>${ring} stroke="${color}" stroke-width="2.5" stroke-dasharray="3 2.5"/>${wave} stroke="${color}" stroke-width="2.2"/></svg>`;
}
