import { vi } from 'vitest';

import type { Cruise } from '../../../model/types.ts';
import { blankCruise, setCruise, setZoneSim } from '../../../state/index.ts';
import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';

/** Frozen time of the tests. */
export const NOW = Date.UTC(2026, 6, 15, 8, 30);

function series(value: number): number[] {
  return Array.from({ length: 24 }, (_, hour) => value + hour);
}

/** Hourly answer of Open-Meteo: every value rises by one each hour. */
export const HOURLY = Object.fromEntries([
  ['time', ['2026-07-15T08:00', '2026-07-15T09:00']],
  ['wind_speed_10m', series(10)],
  ['wind_direction_10m', series(200)],
  ['wind_gusts_10m', series(20)],
  ['pressure_msl', series(1000)],
  ['temperature_2m', series(15)],
  ['precipitation', series(0)],
  ['cape', series(100)],
]);

/** Marine answer of Open-Meteo. */
export const MARINE = Object.fromEntries([
  ['wave_height', series(1)],
  ['wave_direction', series(90)],
]);

/**
 * A JSON answer holding hourly series.
 * @param hourly - The series.
 * @returns The response.
 */
export function answer(hourly: unknown): Response {
  return Response.json({ hourly });
}

/**
 * Replace `fetch`; a `null` answer is a network failure.
 * @param handler - Answers a URL.
 * @returns The URLs requested.
 */
export function stubFetch(handler: (url: string) => Response | null): string[] {
  const urls: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    urls.push(url);
    const response = handler(url);
    return response
      ? Promise.resolve(response)
      : Promise.reject(new Error('offline'));
  });
  return urls;
}

/**
 * Open a new cruise on a lake or at sea.
 * @param lake - On a lake.
 * @returns The cruise.
 */
export function openCruise(lake: boolean): Cruise {
  const cruise = blankCruise('Essai');
  setCruise(cruise);
  setZoneSim(lake ? 'lac' : 'mer');
  return cruise;
}

/** Fresh state, frozen clock, online. */
export function setUpWeather(): void {
  initState(createMemoryStorage());
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  vi.stubGlobal('navigator', { onLine: true });
}

/** Back to the real clock and globals. */
export function tearDownWeather(): void {
  vi.useRealTimers();
  vi.unstubAllGlobals();
}
