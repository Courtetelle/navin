import type { Basin } from '../../model/basins.ts';
import { BASIN_NAMES } from '../../model/basins.ts';
import { tickClock } from '../../shell/topbar/clockState.ts';
import { resetTopTabs } from '../../shell/topbar/topMenuState.ts';
import { currentBasin, setZoneSim, state, toast } from '../../state/index.ts';

import { seaBasin, setSeaBasin } from './seaCenter.ts';

/**
 * The boat arrow brings everything back on the GPS: the place chosen with
 * NavIn is left, and the menus, the clock and the weather follow the boat
 * again. The zone of NavIn where the GPS puts the boat (Lacs, Atlantique,
 * Méditerranée) becomes the zone active, and its name is said.
 */
export function backToGps(): void {
  if (!state.view.zoneSimV.peek()) return;
  setZoneSim('auto');
  const here = currentBasin();
  if (here !== 'lac' && seaBasin() !== here) setSeaBasin(here);
  tickClock();
  resetTopTabs();
  toast(
    state.view.gpsBasin.peek()
      ? `Zone : ${BASIN_NAMES[here]} · par le GPS`
      : 'Zone : GPS · en attente de la position',
  );
}

/**
 * The GPS puts the boat in one of the three zones of NavIn: on the GPS, that
 * zone is the one active (its sea kept as the sea of NavIn), and the clock
 * and the menus follow when the boat goes from one to another.
 * @param basin - The zone of the boat.
 */
export function followGpsZone(basin: Basin): void {
  const { view } = state;
  const before = view.gpsBasin.peek();
  if (before === basin) return;
  view.gpsBasin.value = basin;
  if (view.zoneSimV.peek()) return;
  if (basin !== 'lac' && seaBasin() !== basin) setSeaBasin(basin);
  tickClock();
  resetTopTabs();
  if (before) toast(`Zone : ${BASIN_NAMES[basin]} · par le GPS`);
}
