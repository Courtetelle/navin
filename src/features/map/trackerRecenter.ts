import { isLake, state } from '../../state/index.ts';

import { LEMAN_CENTER, inSwissArea } from './constants.ts';
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
 * Recentre the open tracker after a zone change: simulated sea on the place
 * chosen in the settings (Saint-Malo by default), inland waters on the lake (legacy `trkZoneRecenter`).
 * @param zone - `mer`, `lac`, or `auto`.
 */
export function trkZoneRecenter(zone: string): void {
  const map = tracker.current?.map;
  if (!map || !isMapLive(map)) return;
  const fix = state.view.lastFix.value;
  const swissFix = inSwissArea(fix);
  if (zone === 'mer') {
    setFollow(Boolean(fix && !swissFix));
    if (swissFix || !fix) map.setView(seaCenter(), SEA_ZOOM);
    else map.setView([fix.lat, fix.lon], 14);
  } else if (zone === 'lac') {
    if (swissFix && fix) {
      setFollow(true);
      map.setView([fix.lat, fix.lon], 14);
    } else {
      setFollow(false);
      map.setView(LEMAN_CENTER, 10);
    }
  } else if (fix) {
    setFollow(true);
    map.setView([fix.lat, fix.lon], 14);
  } else if (state.data.cruise.value && !isLake()) {
    map.setView(seaCenter(), SEA_ZOOM);
  } else {
    map.setView(LEMAN_CENTER, 10);
  }
}
