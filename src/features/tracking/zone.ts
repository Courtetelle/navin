import { tickClock } from '../../shell/topbar/clockState.ts';
import { resetTopTabs } from '../../shell/topbar/topMenuState.ts';
import {
  navZone,
  setZoneSim,
  state,
  toast,
  zoneSimGet,
} from '../../state/index.ts';

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
      : `Zone : ${zone === 'lac' ? 'en eaux intérieures' : 'maritime'} · la flèche du bateau ramène au GPS`,
  );
}

/**
 * Next zone of the top menu and of the settings button.
 */
export function cycleZone(): void {
  zoneSet(nextZone(zoneSimGet(), navZone()));
}
