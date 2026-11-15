import { signal } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';

/**
 * The live weather stations stand on the NavIn map: the time they were asked
 * for, 0 when they are off (asked again, they are read again for the map
 * shown then).
 */
export const liveOnMap = signal(0);

/**
 * Lay the live weather stations of the map shown on the NavIn map (long
 * press on Météo, or its menu).
 */
export function showLiveOnMap(): void {
  buzz();
  liveOnMap.value = Date.now();
  go('tracker');
}

/** Take the stations off the map. */
export function hideLiveOnMap(): void {
  buzz();
  liveOnMap.value = 0;
}
