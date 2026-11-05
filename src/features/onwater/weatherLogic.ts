import { fmtTime, fr, pad } from '../../lib/format.ts';
import { windTxt } from '../../lib/wind.ts';
import type { Day } from '../../model/types.ts';

/** Measure of the closest MeteoSwiss station (legacy `smnMeasure`). */
export interface WeatherMeasure {
  /** Wind in knots. */
  tws: number | null;
  /** Gusts in knots. */
  gust: number | null;
  /** Wind direction in degrees. */
  twd: number | null;
  /** Pressure in hPa. */
  baro: number | null;
  /** Air temperature in °C. */
  air: number | null;
  /** Rain in mm. */
  rain: number | null;
  /** Epoch milliseconds of the measure. */
  at: number;
  /** Station name. */
  station: string;
  /** Distance in km. */
  km: number;
  /** Source sentence. */
  src: string;
}

/** One hour of the forecast (legacy `wxNext`). */
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

/** Forecast of the next hours at a position (legacy `wxNext`). */
export interface Forecast {
  src: string;
  rows: ForecastRow[];
}

/** Weather kept in a day sheet (`day.wxNow`). */
export interface WeatherNow {
  /** Epoch milliseconds of the update. */
  at: number;
  meas: WeatherMeasure | null;
  fc: Forecast | null;
}

/**
 * Thunderstorm risk from the convective energy (legacy `capeRisk`).
 * @param cape - CAPE in J/kg.
 * @returns The label, or `''`.
 */
export function capeRisk(cape: number | null | undefined): string {
  if (cape == null) return '';
  if (cape >= 1500) return '⚡⚡ orage fort';
  if (cape >= 800) return '⚡ orage';
  return cape >= 300 ? 'orage ?' : '';
}

/**
 * A direction as three digits with a degree sign, `…` when absent.
 * @param degrees - Direction.
 * @returns The text.
 */
export function directionText(degrees: number | null | undefined): string {
  return degrees == null ? '…' : `${pad(Math.round(degrees), 3)}°`;
}

/**
 * Weather in a sentence, for the day sheet (legacy `wxSummary`).
 * @param weather - Stored weather.
 * @returns The sentence, or `''`.
 */
export function wxSummary(weather: WeatherNow | null | undefined): string {
  if (!weather) return '';
  const measure = weather.meas;
  if (measure) {
    const air = measure.air == null ? '' : `, ${fr(measure.air)} °C`;
    return `vent ${windTxt(measure.tws)} du ${directionText(measure.twd)}, rafales ${windTxt(measure.gust) || '…'}${air} (${measure.src})`;
  }
  const next = weather.fc?.rows[0];
  if (!next) return '';
  return `vent ${windTxt(next.tws)} du ${pad(Math.round(next.twd ?? Number.NaN), 3)}°, rafales ${windTxt(next.gust) || '…'} (${weather.fc?.src})`;
}

/**
 * Rows of the forecast table: from half an hour before the update, eight at most.
 * @param weather - Stored weather.
 * @returns The rows.
 */
export function forecastRows(weather: WeatherNow): ForecastRow[] {
  return (weather.fc?.rows ?? [])
    .filter((row) => row.t > weather.at - 1_800_000)
    .slice(0, 8);
}

/**
 * Keep a new weather reading in a day sheet: the measure (or the forecast)
 * fills the wind fields without replacing what was typed by hand.
 * @param day - Day sheet (mutated).
 * @param weather - New reading, with at least a measure or a forecast.
 */
export function applyWeather(day: Day, weather: WeatherNow): void {
  day.wxNow = weather;
  const { meas: measure, fc: forecast } = weather;
  const source = measure ?? forecast?.rows[0];
  const fill = (key: string, value: number | null | undefined) => {
    if (value != null && (day[key] == null || day[key] === '')) {
      day[key] = String(Math.round(value));
    }
  };
  if (source) {
    fill('fVentDir', source.twd);
    fill('fVentVit', source.tws);
    fill('fRafales', source.gust);
    if (source.air != null && !day.fAir) day.fAir = fr(source.air);
  }
  day.wxSource = measure ? measure.src : forecast?.src;
}

/**
 * Time of a forecast row, local.
 * @param row - Forecast row.
 * @returns `HH:MM`.
 */
export function forecastTime(row: ForecastRow): string {
  return fmtTime(new Date(row.t));
}
