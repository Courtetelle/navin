import { beforeEach, expect, test, vi } from 'vitest';

import { initState, setNavinSpot, setZoneSim } from '../../../state/actions.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';

const reads = vi.hoisted(() => {
  const places: Array<{ lat: number; lon: number }> = [];
  return {
    places,
    gps: 0,
    /** Where a wind reading was asked. */
    note: (_config: unknown, position: { lat: number; lon: number }) => {
      places.push({ lat: position.lat, lon: position.lon });
      return Promise.resolve(null);
    },
  };
});

vi.mock('../windReadings.ts', () => ({
  stationWind: reads.note,
  coastWind: reads.note,
  modelWind: reads.note,
}));
vi.mock('../lakeFix.ts', () => ({
  lakeFix: (done: (position: { lat: number; lon: number }) => void) => {
    reads.gps += 1;
    // The boat is at Le Bouveret, on Lake Geneva.
    done({ lat: 46.39, lon: 6.86 });
  },
}));

const { windCheck } = await import('../windWatch.ts');

const PORQUEROLLES = { lat: 43, lon: 6.2 };

beforeEach(() => {
  initState(createMemoryStorage());
  reads.places.length = 0;
  reads.gps = 0;
  Object.defineProperty(navigator, 'onLine', {
    value: true,
    configurable: true,
  });
});

test('with NavIn at sea, the wind is read where NavIn looks, not at the GPS', () => {
  setZoneSim('mer');
  setNavinSpot(PORQUEROLLES);
  windCheck();
  expect(reads.gps).toBe(0);
  expect(reads.places).toStrictEqual([PORQUEROLLES]);
});

test('on the GPS (after the boat arrow), the wind is read where the boat is', () => {
  setZoneSim('auto');
  windCheck();
  expect(reads.gps).toBe(1);
  expect(reads.places).toStrictEqual([{ lat: 46.39, lon: 6.86 }]);
});
