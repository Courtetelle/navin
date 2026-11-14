import type { Settings } from '../../model/settings.ts';
import { state, updateSettings } from '../../state/index.ts';

import type { LatLngPair } from './constants.ts';

/** A place the sea map opens on (`settings.seaPlace`). */
interface SeaPlace {
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

/** The sea chosen with NavIn: the Atlantic coasts, or the Mediterranean. */
export type SeaBasin = 'atl' | 'med';

/** Where the Mediterranean map opens until another place is chosen. */
export const DEFAULT_MED_PLACE: Readonly<SeaPlace> = {
  name: 'Marseille',
  lat: 43.27,
  lon: 5.32,
};

/**
 * The sea chosen with NavIn (`settings.seaBasin`).
 * @param settings - The settings read.
 * @returns `atl` (the default) or `med`.
 */
export function seaBasin(
  settings: Settings = state.preferences.settings.peek(),
): SeaBasin {
  return settings.seaBasin === 'med' ? 'med' : 'atl';
}

/**
 * Keep the sea chosen with NavIn.
 * @param basin - `atl` or `med`.
 */
export function setSeaBasin(basin: SeaBasin): void {
  updateSettings((settings) => {
    settings.seaBasin = basin;
  });
}

/** Zoom of the sea map on that place: the bay and its approaches. */
export const SEA_ZOOM = 11;

/**
 * The place the sea map opens on, for the sea chosen with NavIn: chosen in
 * the settings, else Saint-Malo (Atlantic) or Marseille (Mediterranean).
 * @param settings - The settings read.
 * @param basin - The sea, the one chosen with NavIn when not given.
 * @returns The place.
 */
export function seaPlace(
  settings: Settings = state.preferences.settings.peek(),
  basin: SeaBasin = seaBasin(settings),
): SeaPlace {
  const med = basin === 'med';
  const place = (med ? settings.medPlace : settings.seaPlace) as
    Partial<SeaPlace> | undefined;
  if (
    place &&
    typeof place.name === 'string' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon)
  ) {
    return place as SeaPlace;
  }
  return med ? DEFAULT_MED_PLACE : DEFAULT_SEA_PLACE;
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
 * Keep a new place for the map of a sea.
 * @param place - The place found.
 * @param basin - The sea, the one chosen with NavIn when not given.
 */
export function setSeaPlace(
  place: SeaPlace,
  basin: SeaBasin = seaBasin(),
): void {
  const key = basin === 'med' ? 'medPlace' : 'seaPlace';
  updateSettings((settings) => {
    settings[key] = { name: place.name, lat: place.lat, lon: place.lon };
  });
}
