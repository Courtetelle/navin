import { afterEach, expect, test, vi } from 'vitest';

import { sunTimes } from '../../lib/sun.ts';
import { state } from '../../state/index.ts';
import { clockFace, showSunTimes, sunPlace } from '../topbar/clockState.ts';

const NOW = Date.parse('2026-06-21T12:00:00Z');
const hhmm = (at: number) => new Date(at).toISOString().slice(11, 16);

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

test('a long press shows sunrise and sunset in turn for 6 s', () => {
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
  for (let second = 0; second < 6; second++) {
    seen.push([clockFace.value.sun, clockFace.value.time]);
    vi.advanceTimersByTime(1000);
  }
  expect(seen).toStrictEqual([
    ['rise', hhmm(times.rise)],
    ['set', hhmm(times.set)],
    ['rise', hhmm(times.rise)],
    ['set', hhmm(times.set)],
    ['rise', hhmm(times.rise)],
    ['set', hhmm(times.set)],
  ]);
  expect(clockFace.value.sun).toBeUndefined();
});
