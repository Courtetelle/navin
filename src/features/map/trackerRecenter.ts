import { isLake, state } from '../../state/index.ts';

import { lakeCenter, lakeZoom } from './lakeCenter.ts';
import { isMapLive } from './mapExtras.ts';
import { SEA_ZOOM, seaCenter } from './seaCenter.ts';
import { setFollow, tracker } from './trackerState.ts';

/**
 * Whether the zone simulation is at sea (legacy `simSeaMode`).
 * @returns `true` on a simulated sea.
 */
export function simSeaMode(): boolean {
  return state.view.zoneSimV.value === 'mer';
}

/**
 * Whether the lake zone is chosen with NavIn.
 * @returns `true` on a chosen lake.
 */
export function simLakeMode(): boolean {
  return state.view.zoneSimV.value === 'lac';
}

/**
 * Recentre the open tracker on a zone: a sea chosen with NavIn on its place
 * chosen in Zones (Saint-Malo by default), the lakes on the lake chosen
 * there, never following the boat (a zone of NavIn is not the GPS: only the
 * boat arrow brings the map back on the boat); the GPS on the boat
 * (legacy `trkZoneRecenter`).
 * @param zone - `mer`, `lac`, or `auto`.
 */
export function trkZoneRecenter(zone: string): void {
  const map = tracker.current?.map;
  if (!map || !isMapLive(map)) return;
  const fix = state.view.lastFix.value;
  if (zone === 'mer') {
    setFollow(false);
    map.setView(seaCenter(), SEA_ZOOM);
  } else if (zone === 'lac') {
    // The lake chosen with NavIn, even with a GPS position in Switzerland:
    // only the boat button brings the map back on the boat.
    setFollow(false);
    tracker.current?.addSwiss?.();
    map.setView(lakeCenter(), lakeZoom());
  } else if (fix) {
    setFollow(true);
    map.setView([fix.lat, fix.lon], 14);
  } else if (state.data.cruise.value && !isLake()) {
    map.setView(seaCenter(), SEA_ZOOM);
  } else {
    map.setView(lakeCenter(), lakeZoom());
  }
}
