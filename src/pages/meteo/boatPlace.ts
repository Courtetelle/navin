import {
  defaultMapCenter,
  shownMapCenter,
} from '../../features/map/shownMap.ts';
import { windWatchPlace } from '../../features/onwater/index.ts';
import { isLake, lastKnownPos } from '../../state/index.ts';

/** A place searched around. */
export interface BoatPlace {
  lat: number;
  lon: number;
}

/**
 * Where the boat is, or was last seen, else the default place of the zone.
 * @returns The place.
 */
export function boatPlace(): BoatPlace {
  const known = lastKnownPos() ?? windWatchPlace.peek();
  if (known) return { lat: known.lat, lon: known.lon };
  return defaultMapCenter(isLake());
}

/**
 * Where Live météo opens: the place the NavIn map was showing (Saint-Malo
 * looked at on the map gives the stations of Saint-Malo), else the boat.
 * @returns The place.
 */
export function mapPlace(): BoatPlace {
  const shown = shownMapCenter();
  return shown ? { lat: shown.lat, lon: shown.lon } : boatPlace();
}

const BACK_LABELS: Readonly<Record<string, string>> = {
  tracker: '◀ NavIn',
  weather: '◀ Météo',
  more: '◀ data',
};

/**
 * Where the ◀ of Live météo leads: back to the screen it was opened from.
 * @param from - The screen left to open Live météo.
 * @returns The screen and the text of the button.
 */
export function liveBackFrom(from: string): { view: string; label: string } {
  const label = BACK_LABELS[from];
  return label && from !== 'meteo'
    ? { view: from, label }
    : { view: 'more', label: '◀ data' };
}
