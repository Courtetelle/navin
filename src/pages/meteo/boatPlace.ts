import { contextPlace } from '../../features/map/contextPlace.ts';
import { shownMapCenter } from '../../features/map/shownMap.ts';

/** A place searched around. */
interface BoatPlace {
  lat: number;
  lon: number;
}

/**
 * The place of the menus: the zone chosen with NavIn (La Rochelle when the
 * sea is forced there), else the boat, else the map last shown.
 * @returns The place.
 */
export function boatPlace(): BoatPlace {
  const { lat, lon } = contextPlace();
  return { lat, lon };
}

/**
 * Where LiveMétéo opens: the place the NavIn map was showing (Saint-Malo
 * looked at on the map gives the stations of Saint-Malo), else the boat.
 * @returns The place.
 */
export function mapPlace(): BoatPlace {
  if (contextPlace().forced) return boatPlace();
  const shown = shownMapCenter();
  return shown ? { lat: shown.lat, lon: shown.lon } : boatPlace();
}
