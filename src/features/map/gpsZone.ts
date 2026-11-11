import { tickClock } from '../../shell/topbar/clockState.ts';
import { resetTopTabs } from '../../shell/topbar/topMenuState.ts';
import { setZoneSim, state } from '../../state/index.ts';

/**
 * The boat arrow brings everything back on the GPS: the place chosen with
 * NavIn is left, and the menus, the clock and the weather follow the boat
 * again.
 */
export function backToGps(): void {
  if (!state.view.zoneSimV.peek()) return;
  setZoneSim('auto');
  tickClock();
  resetTopTabs();
}
