import { vi } from 'vitest';

import {
  blankCruise,
  setCruise,
  setZoneSim,
  state,
} from '../../../state/index.ts';
import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import type { FixInput } from '../fixHandler.ts';
import { nmeaLink } from '../nmeaLive.ts';
import type { LiveTrip } from '../tripState.ts';
import { liveTrip } from '../tripState.ts';

/** Time of the first position of the tests. */
export const NOW = Date.UTC(2026, 6, 15, 8);

/** What `watchPosition` received. */
export interface WatchCall {
  success: (position: FixInput) => void;
  failure: (error: { code: number }) => void;
}

/**
 * A position, north of the first one by 0.001° a minute.
 * @param minutes - Minutes after {@link NOW}.
 * @param overrides - Coordinates to change.
 * @param timestamp - Time of the fix.
 * @returns The fix.
 */
export function fix(
  minutes: number,
  overrides: Partial<FixInput['coords']> = {},
  timestamp = NOW + minutes * 60_000,
): FixInput {
  return {
    timestamp,
    coords: {
      latitude: 46.5 + minutes * 0.001,
      longitude: 6.6,
      accuracy: 5,
      speed: 2.6,
      heading: 222,
      ...overrides,
    },
  };
}

/**
 * The recording in progress.
 * @returns The trip.
 */
export function trip(): LiveTrip {
  const current = liveTrip();
  if (!current) throw new Error('no trip');
  return current;
}

/**
 * Events of the entries of the open cruise.
 * @returns The first event of each entry.
 */
export function entryKinds(): Array<string | undefined> {
  return (state.data.cruise.value?.entries ?? []).map(
    (entry) => entry.v.evt?.[0],
  );
}

/**
 * Fresh state, frozen clock, offline, with a GPS kept in `calls`.
 * @param calls - Receives the `watchPosition` calls.
 */
export function setUpTracking(calls: WatchCall[]): void {
  initState(createMemoryStorage());
  setCruise(blankCruise('Essai'));
  setZoneSim('mer');
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  vi.stubGlobal('navigator', {
    onLine: false,
    geolocation: {
      watchPosition: (
        success: WatchCall['success'],
        failure: WatchCall['failure'],
      ) => {
        calls.push({ success, failure });
        return calls.length;
      },
      clearWatch: vi.fn(),
    },
  });
  nmeaLink.on = false;
  nmeaLink.at = {};
  nmeaLink.live = {};
}

/** Back to the real clock and globals. */
export function tearDownTracking(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
}
