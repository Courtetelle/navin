import type { Settings } from '../../model/settings.ts';
import { state, updateSettings } from '../../state/index.ts';

import type { LatLngPair } from './constants.ts';

/** A place the lake map opens on (`settings.lakePlace`). */
interface LakePlace {
  name: string;
  lat: number;
  lon: number;
  /** Zoom that shows the whole lake. */
  zoom: number;
}

/**
 * Navigable lakes offered in the settings: a point on the water of each,
 * from OpenStreetMap, and the zoom that shows the lake whole.
 */
export const LAKE_PLACES: readonly LakePlace[] = [
  { name: 'Léman', lat: 46.43, lon: 6.55, zoom: 10 },
  { name: 'Lac de Neuchâtel', lat: 46.8978, lon: 6.841, zoom: 10 },
  { name: 'Lac de Bienne', lat: 47.0861, lon: 7.1716, zoom: 11 },
  { name: 'Lac de Morat', lat: 46.9312, lon: 7.0819, zoom: 12 },
  { name: 'Lac de Thoune', lat: 46.7056, lon: 7.6914, zoom: 11 },
  { name: 'Lac de Brienz', lat: 46.723, lon: 7.965, zoom: 12 },
  { name: 'Lac des Quatre-Cantons', lat: 46.9854, lon: 8.4988, zoom: 11 },
  { name: 'Lac de Zurich', lat: 47.2791, lon: 8.5979, zoom: 11 },
  { name: 'Lac de Constance', lat: 47.6478, lon: 9.3472, zoom: 10 },
  { name: 'Lac Majeur', lat: 45.9511, lon: 8.6342, zoom: 10 },
  { name: 'Lac de Lugano', lat: 45.9697, lon: 8.9598, zoom: 11 },
  { name: 'Lac de Côme', lat: 45.9918, lon: 9.2649, zoom: 11 },
  { name: 'Lac de Garde', lat: 45.6624, lon: 10.6862, zoom: 10 },
  { name: 'Lac d’Annecy', lat: 45.8494, lon: 6.1713, zoom: 12 },
  { name: 'Lac du Bourget', lat: 45.7273, lon: 5.867, zoom: 11 },
  { name: 'Lac d’Aiguebelette', lat: 45.5575, lon: 5.8008, zoom: 13 },
  { name: 'Lac de Paladru', lat: 45.4529, lon: 5.5317, zoom: 13 },
  { name: 'Lac de Serre-Ponçon', lat: 44.5001, lon: 6.3168, zoom: 12 },
  { name: 'Lac de Vouglans', lat: 46.4877, lon: 5.6834, zoom: 12 },
  { name: 'Lac du Der-Chantecoq', lat: 48.5796, lon: 4.7449, zoom: 11 },
  { name: 'Lac d’Orient', lat: 48.2739, lon: 4.3384, zoom: 12 },
  { name: 'Lac de Vassivière', lat: 45.7979, lon: 1.9007, zoom: 12 },
  { name: 'Lac de Sainte-Croix', lat: 43.7673, lon: 6.1839, zoom: 12 },
  { name: 'Lac du Salagou', lat: 43.6565, lon: 3.3807, zoom: 13 },
  { name: 'Lac de Guerlédan', lat: 48.204, lon: -3.0441, zoom: 13 },
  { name: 'Balaton', lat: 46.8839, lon: 17.8477, zoom: 10 },
  { name: 'Lac de Neusiedl', lat: 47.8003, lon: 16.7367, zoom: 11 },
  { name: 'Chiemsee', lat: 47.8811, lon: 12.4744, zoom: 11 },
  { name: 'Lac de Starnberg', lat: 47.9093, lon: 11.3084, zoom: 11 },
  { name: 'Ammersee', lat: 48.0063, lon: 11.1197, zoom: 11 },
  { name: 'Attersee', lat: 47.8699, lon: 13.5446, zoom: 11 },
  { name: 'Wolfgangsee', lat: 47.7458, lon: 13.4033, zoom: 12 },
  { name: 'Müritz', lat: 53.4189, lon: 12.702, zoom: 11 },
  { name: 'Vänern', lat: 58.8867, lon: 13.5627, zoom: 8 },
  { name: 'Vättern', lat: 58.3228, lon: 14.4844, zoom: 9 },
  { name: 'Saimaa', lat: 61.8376, lon: 29.487, zoom: 8 },
  { name: 'IJsselmeer', lat: 52.8093, lon: 5.3748, zoom: 9 },
  { name: 'Lough Neagh', lat: 54.6187, lon: -6.4076, zoom: 10 },
  { name: 'Loch Lomond', lat: 56.1562, lon: -4.6564, zoom: 11 },
];

/** Where the lake map opens until another lake is chosen: Lake Geneva. */
export const DEFAULT_LAKE_PLACE: Readonly<LakePlace> =
  LAKE_PLACES[0] as LakePlace;

/** Zoom of a place found by its name, not in the list. */
const FOUND_ZOOM = 12;

/**
 * The place the lake map opens on: chosen in the settings, else Lake Geneva.
 * @param settings - The settings read.
 * @returns The place.
 */
export function lakePlace(
  settings: Settings = state.preferences.settings.peek(),
): LakePlace {
  const place = settings.lakePlace as Partial<LakePlace> | undefined;
  if (
    place &&
    typeof place.name === 'string' &&
    Number.isFinite(place.lat) &&
    Number.isFinite(place.lon)
  ) {
    return {
      name: place.name,
      lat: place.lat as number,
      lon: place.lon as number,
      zoom: Number.isFinite(place.zoom) ? (place.zoom as number) : FOUND_ZOOM,
    };
  }
  return DEFAULT_LAKE_PLACE;
}

/**
 * The centre of the lake map, as Leaflet takes it.
 * @returns Latitude and longitude.
 */
export function lakeCenter(): LatLngPair {
  const { lat, lon } = lakePlace();
  return [lat, lon];
}

/**
 * The zoom of the lake map on its place.
 * @returns The zoom.
 */
export function lakeZoom(): number {
  return lakePlace().zoom;
}

/**
 * Keep a new place for the lake map.
 * @param place - A lake of the list, or a place found by name.
 * @param place.name - Its name.
 * @param place.lat - Latitude.
 * @param place.lon - Longitude.
 * @param place.zoom - Zoom, that of a found place when not given.
 */
export function setLakePlace(place: {
  name: string;
  lat: number;
  lon: number;
  zoom?: number;
}): void {
  updateSettings((settings) => {
    settings.lakePlace = {
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      zoom: place.zoom ?? FOUND_ZOOM,
    };
  });
}
