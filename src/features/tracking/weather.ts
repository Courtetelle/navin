import { angDiff } from '../../lib/geo.ts';
import type { EntryValues } from '../../model/types.ts';
import {
  isLake,
  saveCruise,
  state,
  toast,
  updateCruise,
} from '../../state/index.ts';

import { allureFromTwa, douglasFromHeight } from './seaState.ts';
import { smnMeasure } from './smn.ts';
import type { HourlyWeather } from './weatherSources.ts';
import { hourlySeries, wxDay } from './weatherSources.ts';

/** Weather at a place and time (each value keeps its source in `src`). */
export interface Weather {
  twd: number | null;
  tws: number | null;
  /** @default undefined */
  gust?: number | null;
  baro: number | null;
  /** @default undefined */
  air?: number | null;
  /** @default undefined */
  cape?: number | null;
  /** @default undefined */
  rain?: number | null;
  /** @default undefined */
  waveDir?: number | null;
  /** @default undefined */
  waveH?: number | null;
  /** @default undefined */
  src?: string;
}

const MEASURE_MAX_AGE_MS = 30 * 3_600_000;

/**
 * Weather for an entry: on a lake the real measurement of the nearest station
 * when it exists for that moment, else the model (legacy `fetchWeather`).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param date - Time of the entry.
 * @returns The weather; rejects without network.
 */
export async function fetchWeather(
  lat: number,
  lon: number,
  date: Date,
): Promise<Weather> {
  if (isLake() && Date.now() - date.getTime() < MEASURE_MAX_AGE_MS) {
    const measure = await smnMeasure(lat, lon, date).catch(() => null);
    if (measure) return { ...measure, waveDir: null, waveH: null };
  }
  const day = date.toISOString().slice(0, 10);
  const { a, m, src } = await wxDay(lat, lon, day);
  const hour = Math.min(
    23,
    Math.round(date.getUTCHours() + date.getUTCMinutes() / 60),
  );
  const pick = (hourly: HourlyWeather | null, name: string) =>
    (hourly && hourlySeries(hourly, name)?.[hour]) ?? null;
  return {
    twd: pick(a, 'wind_direction_10m'),
    tws: pick(a, 'wind_speed_10m'),
    gust: pick(a, 'wind_gusts_10m'),
    baro: pick(a, 'pressure_msl'),
    air: pick(a, 'temperature_2m'),
    cape: pick(a, 'cape'),
    waveDir: pick(m, 'wave_direction'),
    waveH: pick(m, 'wave_height'),
    src,
  };
}

/**
 * Complete entry values with the weather (legacy `applyWeather`); a value typed
 * by hand is never replaced. Writes into `values`: pass an immer draft.
 * @param values - Entry values.
 * @param weather - Weather received.
 */
export function applyWeather(values: EntryValues, weather: Weather): void {
  const lake = isLake();
  const waveDirection = lake ? null : weather.waveDir;
  const waveHeight = lake ? null : weather.waveH;
  if (weather.twd != null && values.twd == null) {
    values.twd = Math.round(weather.twd) % 360;
  }
  if (weather.tws != null && values.tws == null) {
    values.tws = Math.round(weather.tws);
  }
  if (weather.baro != null && values.baro == null) {
    values.baro = Math.round(weather.baro);
  }
  if (waveDirection != null && values.vagues == null) {
    values.vagues = Math.round(waveDirection) % 360;
  }
  if (waveHeight != null && values.mer == null) {
    values.mer = douglasFromHeight(waveHeight);
  }
  if (
    weather.src &&
    (weather.twd != null || weather.tws != null || weather.baro != null)
  ) {
    values.wxSrc = weather.src;
  }
  if (
    values.allure == null &&
    values.cog != null &&
    values.twd != null &&
    (values.sog == null || Number(values.sog) > 1)
  ) {
    values.allure = allureFromTwa(
      angDiff(Number(values.twd), Number(values.cog)),
    );
  }
}

/**
 * Fetch the weather of an entry of the open cruise and write it in memory
 * (legacy `enrichEntry`); the caller saves the cruise.
 * @param id - Entry id.
 * @returns `true` when the entry was completed; rejects without network.
 */
export async function enrichEntry(id: string): Promise<boolean> {
  const entry = state.data.cruise.value?.entries.find((item) => item.id === id);
  const position = entry?.v.pos;
  if (!entry || !position || position.text) return false;
  const weather = await fetchWeather(
    position.lat,
    position.lon,
    new Date(entry.t),
  );
  updateCruise(
    (cruise) => {
      const target = cruise.entries.find((item) => item.id === id);
      if (!target) return;
      applyWeather(target.v, weather);
      target.wx = true;
      delete target.needWx;
    },
    { save: false },
  );
  return true;
}

/**
 * Fill the weather of every entry waiting for it (legacy `fillPendingWeather`).
 * Legacy wrote the progress in the button and re-rendered the log: the caller
 * disables its button at the first `onProgress` and shows its label until the
 * promise resolves.
 * @param onProgress - Receives the label `⏳ Météo 1 / 3…` before each entry.
 */
export async function fillPendingWeather(
  onProgress?: (label: string) => void,
): Promise<void> {
  const pending = (state.data.cruise.value?.entries ?? []).filter(
    (entry) => entry.needWx,
  );
  if (!navigator.onLine) {
    toast('Pas de réseau pour le moment');
    return;
  }
  let completed = 0;
  /* eslint-disable no-await-in-loop -- one request at a time, with the progress shown */
  for (const [index, entry] of pending.entries()) {
    onProgress?.(`⏳ Météo ${index + 1} / ${pending.length}…`);
    try {
      if (await enrichEntry(entry.id)) completed++;
    } catch {
      // Next entry: the weather stays pending.
    }
  }
  /* eslint-enable no-await-in-loop */
  saveCruise();
  toast(`Météo ajoutée à ${completed} entrée${completed > 1 ? 's' : ''}`);
}
