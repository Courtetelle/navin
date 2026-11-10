import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { loadTrack, state, tripKey } from '../../../state/index.ts';
import { store } from '../../../storage/store.ts';
import { onFix } from '../fixHandler.ts';
import { startTracking } from '../liveTracking.ts';
import { nmeaLink } from '../nmeaLive.ts';
import type { LiveTrip } from '../tripState.ts';

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

beforeEach(() => {
  setUpTracking([]);
});

afterEach(tearDownTracking);

test('the first fix writes the departure, the next ones the track', async () => {
  startTracking();
  onFix(fix(0));
  await Promise.resolve();
  expect(entryKinds()).toStrictEqual(['Départ']);
  expect(state.view.toast.value?.message).toBe('🛰 Départ enregistré');
  expect(trip().dep?.kind).toBe('Départ');
  expect(state.view.lastFix.value).toStrictEqual({
    cog: 222,
    sog: 5.1,
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

test('on pause the track does not grow, and grows again once resumed', () => {
  startTracking();
  onFix(fix(0));
  expect(state.view.trackBuf.value).toHaveLength(1);
  state.view.trackPaused.value = true;
  onFix(fix(1));
  expect(state.view.trackBuf.value).toHaveLength(1);
  state.view.trackPaused.value = false;
  onFix(fix(2));
  expect(state.view.trackBuf.value).toHaveLength(2);
});
