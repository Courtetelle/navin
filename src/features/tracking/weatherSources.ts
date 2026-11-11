import { isLake } from '../../state/index.ts';

const WEATHER_SOURCES = {
  ch1: 'Prévision MeteoSwiss ICON-CH1 (via Open-Meteo)',
  ch2: 'Prévision MeteoSwiss ICON-CH2 (via Open-Meteo)',
  eu: 'Prévision modèle européen (Open-Meteo)',
} as const;

type WeatherModel = keyof typeof WEATHER_SOURCES;

/** Hourly values of one variable; `null` where the model has none. */
type HourlySeries = ReadonlyArray<number | null>;

/** Hourly series of Open-Meteo, as received: variable name → series, and `time`. */
export type HourlyWeather = Record<string, unknown>;

/** The hourly weather of one day at one place. */
interface DayWeather {
  /** Atmosphere. */
  a: HourlyWeather;
  /** Sea, null on a lake or when unavailable. */
  m: HourlyWeather | null;
  /** Source label shown in the logbook. */
  src: string;
}

/** One forecast hour of {@link wxNext}. */
export interface ForecastRow {
  /** Epoch milliseconds. */
  t: number;
  tws: number | null | undefined;
  twd: number | null | undefined;
  gust: number | null | undefined;
  air: number | null | undefined;
  rain: number | null | undefined;
  cape: number | null | undefined;
}

/** Forecast of the next hours. */
export interface Forecast {
  src: string;
  rows: ForecastRow[];
}

interface OpenMeteoAnswer {
  hourly?: HourlyWeather;
}

const dayCache = new Map<string, DayWeather>();

/**
 * Whether the MeteoSwiss models cover this position (legacy `inSwissModel`).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns `true` inside the model area.
 */
function inSwissModel(lat: number, lon: number): boolean {
  return lat > 45.6 && lat < 48 && lon > 5.8 && lon < 10.7;
}

/**
 * Hourly weather of a day, from the MeteoSwiss model first (CH1 about 1 km,
 * then CH2 about 2 km) on the lake and in Switzerland, else the European model,
 * with the sea state at sea (legacy `wxDay`). Results are cached.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param day - `YYYY-MM-DD` (UTC).
 * @returns The weather; rejects without network.
 */
export async function wxDay(
  lat: number,
  lon: number,
  day: string,
): Promise<DayWeather> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${day}`;
  const cached = dayCache.get(key);
  if (cached) return cached;
  const ageDays =
    (Date.now() - new Date(`${day}T00:00:00Z`).getTime()) / 86_400_000;
  const query = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start_date=${day}&end_date=${day}&timezone=GMT`;
  const variables =
    'hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,temperature_2m,precipitation,cape&wind_speed_unit=kn';
  let hourly: HourlyWeather | undefined;
  let source: WeatherModel = 'eu';
  if (ageDays < 30 && ageDays > -5 && inSwissModel(lat, lon)) {
    const swiss = await swissDay(`${query}&${variables}`);
    if (swiss) {
      hourly = swiss.hourly;
      source = swiss.model;
    }
  }
  if (!hourly) {
    const base =
      ageDays > 80
        ? 'https://archive-api.open-meteo.com/v1/archive'
        : 'https://api.open-meteo.com/v1/forecast';
    const answer = await fetchJson(`${base}?${query}&${variables}`);
    hourly = answer.hourly;
  }
  const sea = isLake() ? null : await marineDay(query);
  if (!hourly) throw new Error('no weather');
  const result = { a: hourly, m: sea, src: WEATHER_SOURCES[source] };
  dayCache.set(key, result);
  return result;
}

/**
 * Forecast of the next hours at a position, MeteoSwiss first, else the
 * European model (legacy `wxNext`).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param hours - Number of hours.
 * @returns The forecast, or `null` when no source answers.
 */
export async function wxNext(
  lat: number,
  lon: number,
  hours: number,
): Promise<Forecast | null> {
  const query = `latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&forecast_hours=${hours}&timezone=GMT&wind_speed_unit=kn&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,precipitation,cape`;
  const tries: Array<[WeatherModel, string]> = inSwissModel(lat, lon)
    ? [
        ['ch1', '&models=meteoswiss_icon_ch1'],
        ['ch2', '&models=meteoswiss_icon_ch2'],
        ['eu', ''],
      ]
    : [['eu', '']];
  /* eslint-disable no-await-in-loop -- each source is tried only when the previous one failed */
  for (const [model, parameter] of tries) {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?${query}${parameter}`,
      );
      if (!response.ok) continue;
      const { hourly } = (await response.json()) as OpenMeteoAnswer;
      if (!hourly || !hasWind(hourly)) continue;
      return { src: WEATHER_SOURCES[model], rows: forecastRows(hourly) };
    } catch {
      // Next source.
    }
  }
  /* eslint-enable no-await-in-loop */
  return null;
}

/**
 * One variable of an Open-Meteo answer.
 * @param hourly - The hourly series.
 * @param name - Open-Meteo variable name.
 * @returns The values, `undefined` when absent.
 */
export function hourlySeries(
  hourly: HourlyWeather,
  name: string,
): HourlySeries | undefined {
  return hourly[name] as HourlySeries | undefined;
}

async function swissDay(
  query: string,
): Promise<{ hourly: HourlyWeather; model: WeatherModel } | null> {
  const models: WeatherModel[] = ['ch1', 'ch2'];
  /* eslint-disable no-await-in-loop -- each model is tried only when the previous one failed */
  for (const model of models) {
    try {
      const { hourly } = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?${query}&models=meteoswiss_icon_${model}`,
      );
      if (hourly && hasWind(hourly)) return { hourly, model };
    } catch {
      // Next model.
    }
  }
  /* eslint-enable no-await-in-loop */
  return null;
}

async function marineDay(query: string): Promise<HourlyWeather | null> {
  try {
    const response = await fetch(
      `https://marine-api.open-meteo.com/v1/marine?${query}&hourly=wave_height,wave_direction`,
    );
    if (!response.ok) return null;
    const answer = (await response.json()) as OpenMeteoAnswer | null;
    return answer?.hourly ?? null;
  } catch {
    return null;
  }
}

async function fetchJson(url: string): Promise<OpenMeteoAnswer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as OpenMeteoAnswer;
}

function hasWind(hourly: HourlyWeather): boolean {
  const speeds = hourlySeries(hourly, 'wind_speed_10m') ?? [];
  for (let index = speeds.length - 1; index >= 0; index--) {
    if (speeds[index] != null) return true;
  }
  return false;
}

function forecastRows(hourly: HourlyWeather): ForecastRow[] {
  const rows: ForecastRow[] = [];
  const speeds = hourlySeries(hourly, 'wind_speed_10m');
  const directions = hourlySeries(hourly, 'wind_direction_10m');
  const gusts = hourlySeries(hourly, 'wind_gusts_10m');
  const temperatures = hourlySeries(hourly, 'temperature_2m');
  const rains = hourlySeries(hourly, 'precipitation');
  const capes = hourlySeries(hourly, 'cape');
  for (const [index, time] of (hourly.time as string[]).entries()) {
    rows.push({
      t: Date.parse(`${time}Z`),
      tws: speeds?.[index],
      twd: directions?.[index],
      gust: gusts?.[index],
      air: temperatures?.[index],
      rain: rains?.[index],
      cape: capes ? capes[index] : null,
    });
  }
  return rows;
}
