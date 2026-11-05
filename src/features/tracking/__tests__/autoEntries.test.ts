import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  blankCruise,
  setCruise,
  setZoneSim,
  state,
  updateCruise,
  updateSettings,
} from '../../../state/index.ts';
import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { addAutoEntry, autoEntryFrom, lochBefore } from '../autoEntries.ts';
import type { TrackEvent } from '../detector.ts';

const NOW = Date.UTC(2026, 6, 15, 8);

function event(partial: Partial<TrackEvent> = {}): TrackEvent {
  return {
    kind: null,
    t: NOW,
    lat: 46.5,
    lon: 6.6,
    cog: 45,
    sog: 5.2,
    dist: 1.26,
    ...partial,
  };
}

beforeEach(() => {
  initState(createMemoryStorage());
  setCruise(blankCruise('Essai'));
  setZoneSim('mer');
  vi.stubGlobal('navigator', { onLine: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('the log before a time is the last reading of an entry at or before it', () => {
  updateCruise((cruise) => {
    cruise.entries.push(
      { id: 'a', t: '2026-07-15T08:00:00.000Z', v: { loch: '12,5' } },
      { id: 'b', t: '2026-07-15T09:00:00.000Z', v: {} },
      { id: 'c', t: '2026-07-15T10:00:00.000Z', v: { loch: 20 } },
    );
  });
  expect(lochBefore('2026-07-15T07:00:00.000Z')).toBe(0);
  expect(lochBefore('2026-07-15T08:00:00.000Z')).toBe(12.5);
  expect(lochBefore('2026-07-15T09:30:00.000Z')).toBe(12.5);
  expect(lochBefore('2026-07-15T10:00:00.000Z')).toBe(20);
});

test('a point becomes an entry waiting for its weather', () => {
  const entry = autoEntryFrom(event(), 10);
  expect(entry).toStrictEqual({
    id: entry.id,
    t: '2026-07-15T08:00:00.000Z',
    v: { pos: { lat: 46.5, lon: 6.6 }, sog: 5.2, cog: 45, loch: 11.3 },
    auto: true,
    needWx: true,
  });
});

test('the kind of a key point is its event, the arrival stops the boat', () => {
  const entry = autoEntryFrom(
    event({ kind: 'Arrivée', sog: 3, note: 'Navigation 1 h 00 · 5,0 NM' }),
    0,
  );
  expect(entry.v).toStrictEqual({
    pos: { lat: 46.5, lon: 6.6 },
    sog: 0,
    cog: 45,
    loch: 1.3,
    evt: ['Arrivée'],
    note: 'Navigation 1 h 00 · 5,0 NM',
  });
});

test('the wind of the instruments is kept and marked as coming from the trace', () => {
  const entry = autoEntryFrom(event({ twd: 120, tws: 11.6 }), 0);
  expect(entry.v.twd).toBe(120);
  expect(entry.v.tws).toBe(12);
  expect(entry.windSrc).toBe('trace');
});

test('the values of the last entry are carried, except the navigation ones', () => {
  updateCruise((cruise) => {
    cruise.entries.push({
      id: 'a',
      t: '2026-07-15T07:00:00.000Z',
      v: { quart: 'Lou', sog: 9, pos: { lat: 1, lon: 2 } },
    });
  });
  const { v: values } = autoEntryFrom(event({ sog: null, cog: null }), 0);
  expect(values).toStrictEqual({
    quart: 'Lou',
    pos: { lat: 46.5, lon: 6.6 },
    loch: 1.3,
  });
});

test('offline, the entry is added and stays pending', async () => {
  const entry = await addAutoEntry(event(), 0);
  const stored = state.data.cruise.value?.entries[0];
  expect(stored?.id).toBe(entry.id);
  expect(stored?.needWx).toBe(true);
});

test('with the network and the setting on, the weather failure leaves the entry pending', async () => {
  vi.stubGlobal('navigator', { onLine: true });
  const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
  vi.stubGlobal('fetch', fetchMock);
  await addAutoEntry(event({ lat: 43.1, lon: 16.1 }), 0);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(state.data.cruise.value?.entries[0]?.needWx).toBe(true);
});

test('the setting off asks nothing', async () => {
  vi.stubGlobal('navigator', { onLine: true });
  const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
  vi.stubGlobal('fetch', fetchMock);
  updateSettings((settings) => {
    settings.autoWeather = false;
  });
  await addAutoEntry(event(), 0);
  expect(fetchMock).not.toHaveBeenCalled();
});
