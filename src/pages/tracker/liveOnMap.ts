import { signal } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';

/** The live weather stations stand on the NavIn map. */
export const liveOnMap = signal(false);

/** Lay the live weather stations within 60 km on the NavIn map. */
export function showLiveOnMap(): void {
  buzz();
  liveOnMap.value = true;
  go('tracker');
}

/** Take the stations off the map. */
export function hideLiveOnMap(): void {
  buzz();
  liveOnMap.value = false;
}
