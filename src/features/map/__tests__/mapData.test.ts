import { beforeEach, expect, test } from 'vitest';

import type { Cruise } from '../../../model/types.ts';
import { initState, setCruise, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { setStorageBackend, store } from '../../../storage/store.ts';
import { entryColor, entryPopup, mapData, segments } from '../mapData.ts';

const DAY = '2026-07-15';
const NOON = Date.parse('2026-07-15T12:00:00+02:00');

function cruise(): Cruise {
  return {
    id: 'c1',
    info: { name: 'Essai' },
    entries: [
      {
        id: 'e1',
        t: '2026-07-14T08:00:00.000Z',
        v: { pos: { lat: 46, lon: 6 } },
      },
      {
        id: 'e2',
        t: '2026-07-15T08:00:00.000Z',
        v: { pos: { lat: 46.1, lon: 6 } },
      },
      {
        id: 'e3',
        t: '2026-07-15T09:00:00.000Z',
        v: { pos: { lat: 0, lon: 0, text: 'Port' } },
      },
    ],
    days: {},
    crew: [],
  } as unknown as Cruise;
}

beforeEach(() => {
  const storage = createMemoryStorage({});
  setStorageBackend(storage);
  initState(storage);
  setCruise(cruise());
});

test('mapData joins the entries when no track is recorded', () => {
  const data = mapData(null);
  expect(data.ents.map((entry) => entry.id)).toStrictEqual(['e1', 'e2']);
  expect(data.line).toStrictEqual([
    { t: Date.parse('2026-07-14T08:00:00.000Z'), lat: 46, lon: 6 },
    { t: Date.parse('2026-07-15T08:00:00.000Z'), lat: 46.1, lon: 6 },
  ]);
  expect(data.nm).toBe(0);
});

test('mapData keeps the track of the day and sums legs under 45 minutes', () => {
  store.set('ldb.track.c1', [
    [NOON, 46, 6],
    [NOON + 60_000, 46.1, 6],
    [NOON + 46 * 60_000 + 60_000, 46.2, 6],
    [NOON - 864e5, 45, 6],
  ]);
  const data = mapData(DAY);
  expect(data.line).toHaveLength(3);
  expect(data.ents.map((entry) => entry.id)).toStrictEqual(['e2']);
  expect(data.nm).toBeCloseTo(6, 1);
});

test('segments cuts at the stopovers and drops lone points', () => {
  const line = [
    { t: 0, lat: 1, lon: 1 },
    { t: 60_000, lat: 2, lon: 2 },
    { t: 60_000 + 46 * 60_000, lat: 3, lon: 3 },
    { t: 200 * 60_000, lat: 4, lon: 4 },
    { t: 201 * 60_000, lat: 5, lon: 5 },
  ];
  expect(segments(line)).toStrictEqual([
    [
      [1, 1],
      [2, 2],
    ],
    [
      [4, 4],
      [5, 5],
    ],
  ]);
});

test('entryColor tells departures and arrivals', () => {
  expect(entryColor({ v: { evt: ['Départ'] } })).toBe('#00a040');
  expect(entryColor({ v: { evt: ['Arrivée'] } })).toBe('#d00000');
  expect(entryColor({ v: {} })).toBe('#0a2a5c');
});

test('entryPopup escapes the texts and joins the values', () => {
  expect(
    entryPopup({
      id: 'e',
      t: '2026-07-15T08:40:00.000Z',
      v: { cog: 45, sog: 4.5, evt: ['Départ'], note: 'a<b' },
    }),
  ).toBe(
    '<b>15/07/2026 10:40</b> Départ<br>COG 045° · 4,5 nd<br><i>a&lt;b</i>',
  );
  expect(state.data.cruise.value?.id).toBe('c1');
});
