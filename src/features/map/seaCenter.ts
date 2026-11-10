import type { Settings } from '../../model/settings.ts';
import { state, updateSettings } from '../../state/index.ts';

import type { LatLngPair } from './constants.ts';

/** A place the sea map opens on (`settings.seaPlace`). */
export interface SeaPlace {
  name: string;
  lat: number;
  lon: number;
}

/** Where the sea map opens until another place is chosen in the settings. */
export const DEFAULT_SEA_PLACE: Readonly<SeaPlace> = {
  name: 'Saint-Malo',
  lat: 48.6493,
  lon: -2.0257,
};

/** Zoom of the sea map on that place: the bay and its approaches. */
export const SEA_ZOOM = 11;

/**
 * The place the sea map opens on: chosen in the settings, else Saint-Malo.
 * @param settings - The settings read.
 * @returns The place.
 */
export function seaPlace(
  settings: Settings = state.preferences.settings.peek(),
): SeaPlace {
  const place = settings.seaPlace as Partial<SeaPlace> | undefined;
  if (
    place &&
    typeof place.name === 'string' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon)
  ) {
    return place as SeaPlace;
  }
  return DEFAULT_SEA_PLACE;
}

/**
 * The centre of the sea map, as Leaflet takes it.
 * @returns Latitude and longitude.
 */
export function seaCenter(): LatLngPair {
  const { lat, lon } = seaPlace();
  return [lat, lon];
}

/**
 * Keep a new place for the sea map.
 * @param place - The place found.
 */
export function setSeaPlace(place: SeaPlace): void {
  updateSettings((settings) => {
    settings.seaPlace = { name: place.name, lat: place.lat, lon: place.lon };
  });
}
