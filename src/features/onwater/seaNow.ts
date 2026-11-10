/** One train of waves. */
export interface WaveTrain {
  /** Height in metres. */
  height: number;
  /** Direction the waves come from, in degrees, null when unknown. */
  dir: number | null;
  /** Period in seconds, null when unknown. */
  period: number | null;
}

/** The sea at a place now, from the Open-Meteo marine model. */
export interface SeaNow {
  /** The whole sea (significant height). */
  total: WaveTrain;
  /** The sea raised by the local wind. */
  windSea: WaveTrain | null;
  /** The swell, come from afar. */
  swell: WaveTrain | null;
  /** Water temperature in °C, null when unknown. */
  water: number | null;
  /** Epoch milliseconds of the model step. */
  t: number;
}

const FIELDS = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'wind_wave_height',
  'wind_wave_direction',
  'wind_wave_period',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'sea_surface_temperature',
];

/**
 * The sea now at a place; null on a lake or inland, where the model has none.
 * @param place - The place.
 * @param place.lat - Latitude.
 * @param place.lon - Longitude.
 * @returns The sea, or null.
 */
export async function seaNow(place: {
  lat: number;
  lon: number;
}): Promise<SeaNow | null> {
  const response = await fetch(
    `https://marine-api.open-meteo.com/v1/marine?latitude=${place.lat.toFixed(3)}&longitude=${place.lon.toFixed(3)}&current=${FIELDS.join(',')}&timezone=GMT`,
    { signal: AbortSignal.timeout(15_000) },
  );
  return response.ok ? seaOf(await response.json()) : null;
}

/**
 * The sea of an Open-Meteo marine reply (`current=`).
 * @param reply - The reply.
 * @returns The sea, null without wave height.
 */
export function seaOf(reply: unknown): SeaNow | null {
  const current = (reply as { current?: Record<string, unknown> } | null)
    ?.current;
  if (!current) return null;
  const total = train(current, '');
  if (!total) return null;
  const time = current.time;
  return {
    total,
    windSea: train(current, 'wind_'),
    swell: train(current, 'swell_'),
    water: numberOr(current.sea_surface_temperature),
    t: typeof time === 'string' ? Date.parse(`${time}Z`) : Date.now(),
  };
}

function train(
  current: Record<string, unknown>,
  prefix: string,
): WaveTrain | null {
  const height = numberOr(current[`${prefix}wave_height`]);
  if (height == null) return null;
  return {
    height,
    dir: numberOr(current[`${prefix}wave_direction`]),
    period: numberOr(current[`${prefix}wave_period`]),
  };
}

function numberOr(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
