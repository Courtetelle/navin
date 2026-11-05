import { inInland } from '../model/contacts.ts';

import { data } from './data.ts';
import { isLake } from './mode.ts';
import type { LivePosition, TimedPosition } from './view.ts';
import { view } from './view.ts';

/**
 * Last known position: SOS simulation, SOS / VHF position, tracker fix, then
 * the last logbook position (legacy `lastKnownPos`).
 * @returns The position with its time (`at`), or `null`.
 */
export function lastKnownPos(): TimedPosition | null {
  if (view.sosSim.value && view.sosLive.value) return view.sosLive.value;
  if (view.sosPos.value) return view.sosPos.value;
  if (view.lastFix.value) return view.lastFix.value;
  const entries = data.cruise.value?.entries ?? [];
  for (let position = entries.length - 1; position >= 0; position--) {
    const entry = entries[position];
    const pos = entry?.v.pos;
    if (entry && pos) return { ...pos, at: entry.t };
  }
  return null;
}

/**
 * Navigation zone, lake or sea: simulation first, then a fresh position (12 h),
 * the open cruise, any position, and finally the kind of cruises in the index (legacy `navZone`).
 * @returns `'lac'` or `'mer'`.
 */
export function navZone(): 'lac' | 'mer' {
  const simulated = view.zoneSimV.value;
  if (simulated === 'lac' || simulated === 'mer') return simulated;
  const position = lastKnownPos();
  const fresh =
    position &&
    (!position.at || Date.now() - Date.parse(position.at) < 12 * 3600e3);
  if (fresh) return inInland(position) ? 'lac' : 'mer';
  if (data.cruise.value) return isLake() ? 'lac' : 'mer';
  if (position) return inInland(position) ? 'lac' : 'mer';
  return data.index.value.some((meta) => meta.type !== 'lac') ? 'mer' : 'lac';
}

/**
 * Position of the map menus: the live position when under 2 minutes old, else
 * the tracker fix (legacy `herePos`).
 * @returns The position, or `null`.
 */
export function herePos(): LivePosition | TimedPosition | null {
  const live = view.myPos.value;
  if (live && Date.now() - live.t < 120_000) return live;
  return view.lastFix.value ?? live;
}
