import type { Position } from '../../model/types.ts';

import { douglasOfH } from './windLogic.ts';
import type { SeaState, WindReading } from './windTypes.ts';

/** A forecast model: Open-Meteo id, label. */
type WindModel = readonly [string, string];

/** A region with its finest forecast models (legacy `WIND_REGIONS`). */
interface WindRegion {
  name: string;
  /** `[south, north, west, east]`. */
  box: readonly [number, number, number, number];
  models: readonly WindModel[];
  /**
   * Keep the strongest of two coarse models.
   * @default undefined
   */
  max?: boolean;
  /**
   * Knots added to the reading: coarse models miss the acceleration between islands.
   * @default undefined
   */
  bias?: number;
}

/** One row of the MeteoSwiss `t_now` file (parsed by the tracking domain). */
export interface StationRow {
  /** Epoch milliseconds. */
  t: number;
  /** Mean wind in km/h, as text. */
  fu3010z0?: string | null;
  /** Gusts in km/h, as text. */
  fu3010z1?: string | null;
  /** Direction in degrees, as text. */
  dkl010z0?: string | null;
  [key: string]: unknown;
}

/** Reply of the Open-Meteo forecast with `current=`. */
export interface ModelReply {
  /**
   * Current values, keyed by Open-Meteo variable (and `time`).
   * @default undefined
   */
  current?: Record<string, number | string | null | undefined>;
}

/** Reply of the Open-Meteo marine API. */
export interface MarineReply {
  /**
   * Hourly values, keyed by Open-Meteo variable (and `time`).
   * @default undefined
   */
  hourly?: Record<string, Array<number | string | null> | undefined>;
}

/** Models tried outside Switzerland, after those of the region. */
export const WIND_FALLBACK: readonly WindModel[] = [
  ['icon_eu', 'DWD ICON-EU 7 km'],
  ['', 'meilleur modèle Open-Meteo'],
];

const WIND_SPEED = 'wind_speed_10m';
const WIND_GUSTS = 'wind_gusts_10m';
const WIND_DIRECTION = 'wind_direction_10m';
const WAVE_HEIGHT = 'wave_height';

const WIND_REGIONS: readonly WindRegion[] = [
  {
    name: 'France',
    box: [41, 51.5, -6, 9.8],
    models: [
      ['meteofrance_arome_france_hd', 'Météo-France AROME HD 1,5 km'],
      ['meteofrance_arome_france', 'Météo-France AROME 2,5 km'],
    ],
  },
  {
    name: 'Italie, Adriatique, Ionienne',
    box: [35.5, 47, 9.8, 22],
    models: [['italia_meteo_arpae_icon_2i', 'ItaliaMeteo ICON-2I 2,2 km']],
  },
  {
    name: 'Royaume-Uni, Irlande',
    box: [49.5, 61, -11, 2],
    models: [['ukmo_uk_deterministic_2km', 'UK Met Office 2 km']],
  },
  {
    name: 'Allemagne, Benelux, Alpes',
    box: [45.5, 53, 2, 15],
    models: [['icon_d2', 'DWD ICON-D2 2 km']],
  },
  {
    name: 'Baltique, mer du Nord',
    box: [53, 60, 3, 30],
    models: [['dmi_harmonie_arome_europe', 'DMI HARMONIE 2 km']],
  },
  {
    name: 'Scandinavie',
    box: [60, 72, 4, 32],
    models: [['metno_nordic', 'MET Norway Nordic 1 km']],
  },
  {
    name: 'Égée, Turquie',
    box: [34, 41.5, 22, 30],
    max: true,
    bias: 5,
    models: [
      ['icon_eu', 'DWD ICON-EU 7 km'],
      ['ecmwf_ifs', 'ECMWF IFS 9 km'],
      ['ecmwf_ifs025', 'ECMWF IFS 25 km'],
    ],
  },
];

/**
 * Region of a position (legacy `windRegion`).
 * @param position - Position.
 * @returns The first region containing it, or null.
 */
export function windRegion(
  position: Pick<Position, 'lat' | 'lon'>,
): WindRegion | null {
  const { lat, lon } = position;
  return (
    WIND_REGIONS.find(
      ({ box }) =>
        lat >= box[0] && lat < box[1] && lon >= box[2] && lon < box[3],
    ) ?? null
  );
}

/**
 * Newest usable station reading: at most 40 minutes old, wind turned into knots
 * (legacy `windCheck`).
 * @param rows - Station rows, oldest first.
 * @param name - Station name.
 * @param km - Distance in km.
 * @param now - Epoch milliseconds.
 * @returns The reading, or null.
 */
export function stationReading(
  rows: readonly StationRow[],
  name: string,
  km: number,
  now: number,
): WindReading | null {
  const row = rows.findLast((item) => item.fu3010z0 != null);
  if (!row || now - row.t > 40 * 60_000) return null;
  return {
    name,
    km,
    t: row.t,
    avg: Number(row.fu3010z0) / 1.852,
    gust: row.fu3010z1 == null ? null : Number(row.fu3010z1) / 1.852,
    dir: row.dkl010z0 == null ? null : Number(row.dkl010z0),
  };
}

/**
 * Reading of a forecast model (legacy `windModelNow`).
 * @param reply - Open-Meteo reply.
 * @param model - Model id and label.
 * @param now - Epoch milliseconds, when the reply has no time.
 * @returns The reading, or null when the reply has no wind.
 */
export function modelReading(
  reply: ModelReply,
  [model, label]: WindModel,
  now: number,
): WindReading | null {
  const current = reply.current ?? {};
  if (current[WIND_SPEED] == null) return null;
  const { time } = current;
  return {
    name: label,
    model,
    t: time ? Date.parse(`${String(time)}Z`) : now,
    avg: Number(current[WIND_SPEED]),
    gust: current[WIND_GUSTS] == null ? null : Number(current[WIND_GUSTS]),
    dir:
      current[WIND_DIRECTION] == null ? null : Number(current[WIND_DIRECTION]),
  };
}

/**
 * Wave height of the hour closest to now (legacy `seaStateAt`).
 * @param reply - Marine API reply.
 * @param now - Epoch milliseconds.
 * @returns The sea state, or null.
 */
export function marineState(reply: MarineReply, now: number): SeaState | null {
  const times = reply.hourly?.time ?? [];
  const heights = reply.hourly?.[WAVE_HEIGHT] ?? [];
  let closest: number | null = null;
  let smallest = Infinity;
  for (const [index, time] of times.entries()) {
    const height = heights[index];
    const distance = Math.abs(Date.parse(`${String(time)}Z`) - now);
    if (height != null && distance < smallest) {
      smallest = distance;
      closest = Number(height);
    }
  }
  if (closest === null) return null;
  const waveH = Math.round(closest * 10) / 10;
  return { waveH, douglas: douglasOfH(waveH) };
}
