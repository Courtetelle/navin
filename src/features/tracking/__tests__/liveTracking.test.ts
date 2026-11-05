import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { TrackPoint } from '../../../state/index.ts';
import {
  blankCruise,
  lastTripKey,
  loadTrack,
  setCruise,
  setZoneSim,
  state,
  trackSegmentsKey,
  tripKey,
  updateCruise,
} from '../../../state/index.ts';
import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import type { FixInput } from '../fixHandler.ts';
import { onFix } from '../fixHandler.ts';
import {
  autoResumeTrip,
  extendLastTrip,
  startTracking,
  stopTracking,
} from '../liveTracking.ts';
import { nmeaLink } from '../nmeaLive.ts';
import type { LiveTrip } from '../tripState.ts';
import { liveTrip } from '../tripState.ts';

vi.mock('../../../shell/wake.ts', () => ({ applyWake: vi.fn() }));
vi.mock('../trackerLink.ts', () => ({
  drawTrkButtons: vi.fn(),
  loadLinkedDomains: vi.fn(),
  trackerTick: vi.fn(),
  windMuteEnd: vi.fn(),
}));

const NOW = Date.UTC(2026, 6, 15, 8);

let watchCalls: Array<{
  success: (position: FixInput) => void;
  failure: (error: { code: number }) => void;
}> = [];

function fix(
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

function trip(): LiveTrip {
  const current = liveTrip();
  if (!current) throw new Error('no trip');
  return current;
}

function entryKinds(): Array<string | undefined> {
  return (state.data.cruise.value?.entries ?? []).map(
    (entry) => entry.v.evt?.[0],
  );
}

beforeEach(() => {
  initState(createMemoryStorage());
  setCruise(blankCruise('Essai'));
  setZoneSim('mer');
  watchCalls = [];
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  vi.stubGlobal('navigator', {
    onLine: false,
    geolocation: {
      watchPosition: (
        success: (position: FixInput) => void,
        failure: (error: { code: number }) => void,
      ) => {
        watchCalls.push({ success, failure });
        return watchCalls.length;
      },
      clearWatch: vi.fn(),
    },
  });
  nmeaLink.on = false;
  nmeaLink.at = {};
  nmeaLink.live = {};
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

test('the first fix writes the departure, the next ones the track', async () => {
  startTracking();
  onFix(fix(0));
  await Promise.resolve();
  expect(entryKinds()).toStrictEqual(['Départ']);
  expect(state.view.toast.value?.message).toBe('🛰 Départ enregistré');
  expect(trip().dep?.kind).toBe('Départ');
  expect(state.view.lastFix.value).toStrictEqual({
    lat: 46.5,
    lon: 6.6,
    at: new Date(NOW).toISOString(),
  });
  expect(state.view.trackBuf.value).toStrictEqual([[NOW, 46.5, 6.6]]);
  const entry = state.data.cruise.value?.entries[0];
  expect(entry?.v.sog).toBe(5.1);
  expect(entry?.v.cog).toBe(222);
});

test('a fix is ignored when not tracking or when too imprecise', () => {
  state.view.gpsDenied.value = true;
  onFix(fix(0));
  expect(state.view.gpsDenied.value).toBe(false);
  expect(state.view.lastFix.value).toBeNull();
  startTracking();
  onFix(fix(0, { accuracy: 61 }));
  expect(state.view.lastFix.value).toBeNull();
  onFix(fix(0, { accuracy: 60 }));
  expect(state.view.lastFix.value?.lat).toBe(46.5);
});

test('the course needs a boat moving above 0.5 m/s', () => {
  startTracking();
  onFix(fix(0, { speed: 0.5, heading: 100 }));
  const departure = trip().dep;
  expect(departure?.cog).toBeNull();
  expect(departure?.sog).toBe(1);
});

test('the track keeps a point every 10 s at most, rounded to 6 decimals', () => {
  startTracking();
  onFix(fix(0, { latitude: 46.123_456_789 }));
  onFix(fix(0, {}, NOW + 9000));
  onFix(fix(0, {}, NOW + 10_000));
  expect(state.view.trackBuf.value).toStrictEqual([
    [NOW, 46.123_457, 6.6],
    [NOW + 10_000, 46.5, 6.6],
  ]);
});

test('the track and the trip are stored every 6 points', () => {
  startTracking();
  for (let minute = 0; minute < 5; minute++) onFix(fix(minute));
  expect(loadTrack()).toHaveLength(0);
  onFix(fix(5));
  expect(loadTrack()).toHaveLength(6);
  expect(store.get<LiveTrip | null>(tripKey(), null)?.det.lastPt?.t).toBe(
    NOW + 5 * 60_000,
  );
});

test('every fix publishes a new trip reference, the detector being the same', () => {
  startTracking();
  const before = state.view.trip.value;
  onFix(fix(0));
  expect(state.view.trip.value).not.toBe(before);
  expect(state.view.trip.value?.det).toBe(before?.det);
});

test('a hole of more than 3 minutes is noted and joined by a straight line', () => {
  startTracking();
  onFix(fix(0));
  onFix(fix(4));
  expect(trip().gaps).toStrictEqual([
    { from: NOW, to: NOW + 240_000, nm: 0.24 },
  ]);
  const note = state.data.cruise.value?.entries.at(-1);
  expect(note?.auto).toBe(true);
  expect(note?.v.note).toMatch(
    /^Trace interrompue de \d\d:\d\d à \d\d:\d\d \(appli fermée ou en arrière-plan\) : 0,2 NM complétés en ligne droite\.$/,
  );
  expect(state.view.toast.value?.message).toBe(
    '🛰 Trace complétée : 0 h 04 sans GPS, 0,2 NM en ligne droite',
  );
});

test('the fresh position of the instruments takes over the phone GPS', () => {
  startTracking();
  nmeaLink.on = true;
  nmeaLink.at.lat = NOW;
  onFix(fix(0));
  expect(state.view.lastFix.value).toBeNull();
  onFix({ ...fix(0), nmea: true });
  expect(state.view.lastFix.value?.lat).toBe(46.5);
});

test('the true wind of the instruments is added to the points', () => {
  startTracking();
  nmeaLink.live.tws = 12.34;
  nmeaLink.live.twd = 359.6;
  nmeaLink.at.tws = NOW;
  nmeaLink.at.twd = NOW;
  onFix(fix(0));
  expect(trip().det.lastTwd).toBe(0);
  expect(trip().det.lastTws).toBe(12.3);
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
