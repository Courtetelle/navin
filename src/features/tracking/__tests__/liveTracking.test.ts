import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { TrackPoint } from '../../../state/index.ts';
import {
  lastTripKey,
  loadTrack,
  state,
  trackSegmentsKey,
  tripKey,
  updateCruise,
} from '../../../state/index.ts';
import { store } from '../../../storage/store.ts';
import { onFix } from '../fixHandler.ts';
import {
  autoResumeTrip,
  extendLastTrip,
  startTracking,
  stopTracking,
} from '../liveTracking.ts';
import type { LiveTrip } from '../tripState.ts';

import type { WatchCall } from './liveTrackingSetup.ts';
import {
  NOW,
  entryKinds,
  fix,
  setUpTracking,
  tearDownTracking,
  trip,
} from './liveTrackingSetup.ts';

vi.mock('../../../shell/wake.ts', () => ({ applyWake: vi.fn() }));
vi.mock('../trackerLink.ts', () => ({
  drawTrkButtons: vi.fn(),
  loadLinkedDomains: vi.fn(),
  trackerTick: vi.fn(),
  windMuteEnd: vi.fn(),
}));

let watchCalls: WatchCall[] = [];

beforeEach(() => {
  watchCalls = [];
  setUpTracking(watchCalls);
});

afterEach(tearDownTracking);

test('without geolocation the tracking does not start', () => {
  vi.stubGlobal('navigator', {});
  startTracking();
  expect(state.view.tracking.value).toBe(false);
  expect(state.view.toast.value?.message).toBe(
    'GPS non disponible sur cet appareil',
  );
});

test('a new recording stores its trip, starting at the end of the track', () => {
  const track: TrackPoint[] = [[NOW - 60_000, 46, 6]];
  store.set(`ldb.track.${state.data.cruise.value?.id}`, track);
  updateCruise((cruise) => {
    cruise.entries.push({
      id: 'a',
      t: new Date(NOW - 1000).toISOString(),
      v: { loch: 12 },
    });
  });
  startTracking();
  expect(state.view.tracking.value).toBe(true);
  expect(watchCalls).toHaveLength(1);
  expect(state.view.toast.value?.message).toBe(
    'Suivi démarré : l’entrée de départ sera créée au premier point GPS',
  );
  const stored = store.get<LiveTrip | null>(tripKey(), null);
  expect(stored?.start).toBe(NOW);
  expect(stored?.from).toBe(1);
  expect(stored?.lochBase).toBe(12);
  expect(stored?.det.turn).toBe(30);
  expect(stored?.det.every).toBe(10);
  expect(store.get(trackSegmentsKey(), [])).toStrictEqual([1]);
  expect(state.view.trackBuf.value).toStrictEqual(track);
});

test('the arrival writes the entries kept and allows extending the trip', async () => {
  startTracking();
  for (let minute = 0; minute <= 120; minute += 2) onFix(fix(minute));
  vi.setSystemTime(NOW + 120 * 60_000);
  await stopTracking(true);
  expect(entryKinds()).toStrictEqual([
    'Départ',
    undefined,
    undefined,
    'Arrivée',
  ]);
  expect(state.view.tracking.value).toBe(false);
  expect(state.view.trip.value).toBeNull();
  expect(store.get(tripKey(), null)).toBeNull();
  expect(store.get<LiveTrip | null>(lastTripKey(), null)?.end).toBe(
    NOW + 120 * 60_000,
  );
  expect(state.view.toast.value?.message).toMatch(
    /^Arrivée : Navigation 2 h 00 · 7,2 NM$/,
  );
  expect(loadTrack()).toHaveLength(61);
});

test('without a first point the arrival writes nothing', async () => {
  startTracking();
  await stopTracking(true);
  expect(entryKinds()).toStrictEqual([]);
  expect(store.get(tripKey(), null)).toBeNull();
  expect(store.get<LiveTrip | null>(lastTripKey(), null)?.dep).toBeNull();
});

test('a stop without arrival keeps the trip for later', async () => {
  startTracking();
  onFix(fix(0));
  await stopTracking(false);
  expect(state.view.trip.value).toBeNull();
  expect(store.get<LiveTrip | null>(tripKey(), null)?.start).toBe(NOW);
  expect(store.get(lastTripKey(), null)).toBeNull();
});

test('the app coming back resumes the stored recording by itself', async () => {
  startTracking();
  onFix(fix(0));
  store.set(tripKey(), trip());
  await stopTracking(false);
  autoResumeTrip();
  expect(state.view.tracking.value).toBe(true);
  expect(trip().det.buf).toStrictEqual([]);
  expect(trip().dep?.kind).toBe('Départ');
  expect(state.view.toast.value?.message).toBe(
    '🛰 Enregistrement de la trace repris',
  );
});

test('nothing resumes without stored trip or while tracking', () => {
  autoResumeTrip();
  expect(state.view.tracking.value).toBe(false);
  startTracking();
  watchCalls = [];
  autoResumeTrip();
  expect(watchCalls).toHaveLength(0);
});

test('extending takes the last trip back and notes it', async () => {
  startTracking();
  onFix(fix(0));
  await stopTracking(true);
  extendLastTrip();
  expect(state.view.tracking.value).toBe(true);
  expect(trip().end).toBeUndefined();
  expect(trip().cands).toStrictEqual([]);
  expect(store.get(lastTripKey(), null)).toBeNull();
  expect(state.data.cruise.value?.entries.at(-1)?.v.note).toBe(
    'Reprise de la trace précédente',
  );
  expect(state.view.toast.value?.message).toBe('Suivi repris');
});

test('without last trip, extending starts a new recording', () => {
  extendLastTrip();
  expect(state.view.tracking.value).toBe(true);
  expect(trip().det.dist).toBe(0);
});

test('a refused location stops the tracking and says so', () => {
  startTracking();
  watchCalls[0]?.failure({ code: 1 });
  expect(state.view.gpsDenied.value).toBe(true);
  expect(state.view.tracking.value).toBe(false);
  expect(state.view.toast.value?.message).toBe(
    '📍 Localisation refusée : trace impossible',
  );
  expect(store.get<LiveTrip | null>(tripKey(), null)?.start).toBe(NOW);
});

test('another GPS error changes nothing', () => {
  startTracking();
  watchCalls[0]?.failure({ code: 3 });
  expect(state.view.tracking.value).toBe(true);
});
