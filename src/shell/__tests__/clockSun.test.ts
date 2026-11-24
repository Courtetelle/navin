import { afterEach, expect, test, vi } from 'vitest';

import { placeTimeText } from '../../lib/placeZone.ts';
import { sunTimes } from '../../lib/sun.ts';
import { state, updateSettings } from '../../state/index.ts';
import {
  clockFace,
  endSunTimes,
  showSunTimes,
  sunPlace,
  tickClock,
  toggleClock,
} from '../topbar/clockState.ts';

const NOW = Date.parse('2026-06-21T12:00:00Z');
const hhmm = (at: number) => placeTimeText(new Date(at), 46.4, 6.5);

afterEach(() => {
  vi.useRealTimers();
  state.view.myPos.value = null;
  state.view.lastFix.value = null;
});

test('a fresh GPS position gives the place of the sun times', () => {
  state.view.myPos.value = {
    lat: 46.4,
    lon: 6.5,
    sog: null,
    cog: null,
    t: NOW,
  };
  expect(sunPlace(NOW)).toMatchObject({ lat: 46.4, lon: 6.5 });
  expect(sunPlace(NOW + 200_000)).not.toMatchObject({ lat: 46.4, lon: 6.5 });
});

test('a long press shows sunrise and sunset in legal time, four times each, 2 s at a time', () => {
  vi.useFakeTimers({ now: NOW });
  state.view.myPos.value = {
    lat: 46.4,
    lon: 6.5,
    sog: null,
    cog: null,
    t: NOW,
  };
  const times = sunTimes(NOW, 46.4, 6.5);
  if (!times) throw new Error('sun');
  clockFace.value = { local: false, time: '12:00', tick: 0 };
  showSunTimes(NOW);
  const seen: Array<[string | undefined, string]> = [];
  for (let step = 0; step < 8; step++) {
    seen.push([clockFace.value.sun, clockFace.value.time]);
    vi.advanceTimersByTime(1000);
    expect(clockFace.value.time).toBe(seen.at(-1)?.[1]);
    vi.advanceTimersByTime(1000);
  }
  const pair: Array<[string, string]> = [
    ['rise', hhmm(times.rise)],
    ['set', hhmm(times.set)],
  ];
  expect(seen).toStrictEqual([...pair, ...pair, ...pair, ...pair]);
  expect(clockFace.value.sun).toBeUndefined();
});

test('a tap during the sun times brings the time back, without switching', () => {
  vi.useFakeTimers({ now: NOW });
  clockFace.value = { local: false, time: '12:00', tick: 0 };
  showSunTimes(NOW);
  expect(clockFace.value.sun).toBe('rise');
  toggleClock();
  expect(clockFace.value.sun).toBeUndefined();
  vi.advanceTimersByTime(4000);
  expect(clockFace.value.sun).toBeUndefined();
});

test('another screen brings the time back', () => {
  vi.useFakeTimers({ now: NOW });
  clockFace.value = { local: false, time: '12:00', tick: 0 };
  showSunTimes(NOW);
  endSunTimes();
  expect(clockFace.value.sun).toBeUndefined();
  vi.advanceTimersByTime(4000);
  expect(clockFace.value.sun).toBeUndefined();
});

test('a tap switches UTC / legal time and stays; a change of zone brings back the time of the zone', () => {
  vi.useFakeTimers({ now: NOW });
  state.view.zoneSimV.value = 'mer';
  tickClock();
  expect(clockFace.value.local).toBe(false);
  toggleClock();
  expect(clockFace.value.local).toBe(true);
  vi.advanceTimersByTime(60_000);
  tickClock();
  expect(clockFace.value.local).toBe(true);
  toggleClock();
  expect(clockFace.value.local).toBe(false);
  toggleClock();
  state.view.zoneSimV.value = 'lac';
  tickClock();
  expect(clockFace.value.local).toBe(true);
  toggleClock();
  expect(clockFace.value.local).toBe(false);
  state.view.zoneSimV.value = 'mer';
  tickClock();
  expect(clockFace.value.local).toBe(false);
  state.view.zoneSimV.value = 'lac';
  tickClock();
  expect(clockFace.value.local).toBe(true);
  state.view.zoneSimV.value = '';
});

test('from the Atlantique in legal time to the Méditerranée, the clock starts again in UTC', () => {
  vi.useFakeTimers({ now: NOW });
  state.view.zoneSimV.value = 'mer';
  updateSettings((draft) => {
    draft.seaBasin = 'atl';
  });
  tickClock();
  toggleClock();
  expect(clockFace.value.local).toBe(true);
  updateSettings((draft) => {
    draft.seaBasin = 'med';
  });
  tickClock();
  expect(clockFace.value.local).toBe(false);
  toggleClock();
  updateSettings((draft) => {
    draft.seaBasin = 'atl';
  });
  tickClock();
  expect(clockFace.value.local).toBe(false);
  state.view.zoneSimV.value = '';
});
