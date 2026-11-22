import { signal } from '@preact/signals-react';

import type {
  Failure,
  Grid,
  PointSea,
  PointWind,
  RainFrames,
} from '../../features/onwater/mapWeather.ts';
import { buzz } from '../../lib/dom.ts';
import { store } from '../../storage/store.ts';

/** The layers of the weather over the map, each on or off. */
export interface WeatherLayers {
  wind: boolean;
  waves: boolean;
  currents: boolean;
  rain: boolean;
}

const LAYERS_KEY = 'ldb.liveLayers';
const ALL_ON: WeatherLayers = {
  wind: true,
  waves: true,
  currents: true,
  rain: true,
};

/** The layers chosen, kept on the device; all on at first. */
export const weatherLayers = signal<WeatherLayers>({
  ...ALL_ON,
  ...store.get<Partial<WeatherLayers>>(LAYERS_KEY, {}),
});

/** Hours after now of the forecast shown: 0 for the hour now. */
export const forecastStep = signal(0);

/**
 * Turn a layer on or off, and keep the choice.
 * @param name - The layer.
 */
export function toggleLayer(name: keyof WeatherLayers): void {
  buzz();
  const next = { ...weatherLayers.value, [name]: !weatherLayers.value[name] };
  weatherLayers.value = next;
  store.set(LAYERS_KEY, next);
}

/** The grids read for the map. */
export interface WeatherRead {
  wind: Grid<PointWind> | Failure | null;
  sea: Grid<PointSea> | Failure | null;
}

/** What the map shows now: the grids, the radar, the hour, the model. */
export const weatherRead = signal<WeatherRead>({ wind: null, sea: null });
/** The radar frames read, or why none. */
export const rainRead = signal<RainFrames | Failure | null>(null);
/** The hour drawn, epoch ms, null out of the forecast. */
export const weatherShownAt = signal<number | null>(null);
/** The name of the local model of the wind. */
export const weatherModel = signal('');
/** When the panes of the map were made: 0 until the map is built. */
export const weatherMapReady = signal(0);
