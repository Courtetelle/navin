import { tickClock } from '../../shell/topbar/clockState.ts';
import { resetTopTabs } from '../../shell/topbar/topMenuState.ts';
import {
  navZone,
  setZoneSim,
  state,
  toast,
  zoneSimGet,
} from '../../state/index.ts';
import type { SeaBasin } from '../map/seaCenter.ts';
import { seaBasin, setSeaBasin } from '../map/seaCenter.ts';

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
 * The cycle of the zone button of NavIn: the Atlantic, the Mediterranean,
 * the lakes. Both seas are the zone `mer`, each on its own place.
 */
export const BASIN_CYC = ['atl', 'med', 'lac'] as const;

/** A step of the zone button of NavIn. */
export type Basin = (typeof BASIN_CYC)[number];

/** The names of the steps, as written on the screen. */
export const BASIN_NAMES: Readonly<Record<Basin, string>> = {
  atl: 'Atlantique',
  med: 'Méditerranée',
  lac: 'Lacs',
};

/**
 * Where the zone button stands.
 * @param zone - The zone chosen (`'auto'` on the GPS).
 * @param sea - The sea chosen.
 * @param onGps - On the GPS, the zone where the boat is.
 * @returns The step.
 */
export function basinOf(
  zone: string,
  sea: SeaBasin,
  onGps: ZoneChoice = 'mer',
): Basin {
  const shown = zone === 'lac' || zone === 'mer' ? zone : onGps;
  return shown === 'lac' ? 'lac' : sea;
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
 * The step the zone button of NavIn shows now.
 * @returns The step.
 */
export function currentBasin(): Basin {
  return basinOf(zoneSimGet(), seaBasin(), navZone());
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
      : `Zone : ${zone === 'lac' ? 'Lacs' : BASIN_NAMES[seaBasin()]} · la flèche du bateau ramène au GPS`,
  );
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
