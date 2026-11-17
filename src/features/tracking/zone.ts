import type { Basin } from '../../model/basins.ts';
import { BASIN_CYC, BASIN_NAMES } from '../../model/basins.ts';
import { tickClock } from '../../shell/topbar/clockState.ts';
import { resetTopTabs } from '../../shell/topbar/topMenuState.ts';
import {
  chosenSea,
  currentBasin,
  setZoneSim,
  state,
  toast,
} from '../../state/index.ts';
import { setSeaBasin } from '../map/seaCenter.ts';

import { trkZoneRecenter } from './trackerLink.ts';

/**
 * The cycle of NavIn and of the zone button: a place chosen, lake or sea.
 * The GPS comes back with the boat arrow only.
 */
export const ZONE_CYC = ['lac', 'mer'] as const;

/** A choice of the zone button. */
export type ZoneChoice = (typeof ZONE_CYC)[number];

/**
 * Choice after a zone in the cycle.
 * @param zone - Current choice (`'auto'` on the GPS).
 * @param onGps - On the GPS, the zone where the boat is.
 * @returns The next one; on the GPS the other zone than the boat's, so that
 *   a long press always changes the zone.
 */
export function nextZone(zone: string, onGps: ZoneChoice = 'mer'): ZoneChoice {
  const position = ZONE_CYC.indexOf(zone as ZoneChoice);
  if (position === -1) return onGps === 'lac' ? 'mer' : 'lac';
  return ZONE_CYC[(position + 1) % ZONE_CYC.length] ?? 'lac';
}

/**
 * The step after another one.
 * @param basin - The current step.
 * @returns The next one, the lakes back to the Atlantic.
 */
export function nextBasin(basin: Basin): Basin {
  const position = BASIN_CYC.indexOf(basin);
  return BASIN_CYC[(position + 1) % BASIN_CYC.length] ?? 'atl';
}

/**
 * Choose the navigation zone (legacy `zoneSet`): clock, top bar and everything
 * reading the zone follow.
 * @param zone - `'lac'`, `'mer'` or `'auto'`.
 */
export function zoneSet(zone: string): void {
  setZoneSim(zone);
  tickClock();
  resetTopTabs();
  if (state.view.currentView.peek() === 'tracker') trkZoneRecenter(zone);
  toast(
    zone === 'auto'
      ? 'Zone : automatique par GPS'
      : `Zone : ${zone === 'lac' ? 'Lacs' : BASIN_NAMES[chosenSea()]} · la flèche du bateau ramène au GPS`,
  );
}

/**
 * A short touch on NavIn, while its menu unrolls: the map comes back on the
 * place chosen in Zones (Morges, Portrieux, …). On the GPS, NavIn first goes
 * back to the zone where the GPS puts the boat: NavIn and the boat arrow
 * bring the map in turn on the place of the zone and on the boat.
 */
export function zoneTap(): void {
  if (state.view.currentView.peek() !== 'tracker') return;
  const zone = state.view.zoneSimV.peek();
  if (zone === 'lac' || zone === 'mer') {
    // Where the map was moved with the fingers is forgotten: NavIn looks
    // again from the place of the zone.
    setZoneSim(zone);
    trkZoneRecenter(zone);
    return;
  }
  const here = currentBasin();
  if (here !== 'lac') setSeaBasin(here);
  zoneSet(here === 'lac' ? 'lac' : 'mer');
}

/**
 * Next zone of the zone button of NavIn, of the top menu and of the settings
 * button: Atlantique, Méditerranée, Lacs.
 */
export function cycleZone(): void {
  const next = nextBasin(currentBasin());
  if (next !== 'lac') setSeaBasin(next);
  zoneSet(next === 'lac' ? 'lac' : 'mer');
}
