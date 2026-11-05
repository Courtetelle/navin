import { beforeEach, expect, test } from 'vitest';

import type { Cruise } from '../../../model/types.ts';
import {
  boatById,
  initState,
  resetView,
  setCruise,
  state,
} from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import {
  lastBlackWater,
  noteBlackWater,
  noteLakeEvent,
} from '../lakeActions.ts';
import { lakeRefresh } from '../lakeRefresh.ts';
import { photosFor } from '../photos.ts';

function cruise(extra: Partial<Cruise> = {}): Cruise {
  return {
    id: 'c1',
    created: '2026-07-15T08:00:00.000Z',
    info: {},
    crew: [],
    entries: [],
    days: {},
    ...extra,
  };
}

beforeEach(() => {
  initState(createMemoryStorage({}));
  resetView();
});

test('noteLakeEvent uses the running track for position, speed and course', () => {
  setCruise(cruise());
  state.view.tracking.value = true;
  state.view.trip.value = {
    start: 0,
    lochBase: 0,
    dep: null,
    cands: [],
    det: {
      lastSog: 4.2,
      lastCog: 90,
      lastPt: { lat: 46.4, lon: 6.5, t: Date.now() },
    },
  };
  const refreshed = lakeRefresh.value;
  noteLakeEvent({ evt: ['Début moteur'] }, '⚙️ Moteur en marche');
  const entry = state.data.cruise.value?.entries[0];
  expect(entry?.v).toStrictEqual({
    evt: ['Début moteur'],
    pos: { lat: 46.4, lon: 6.5 },
    sog: 4.2,
    cog: 90,
  });
  expect(state.view.toast.value?.message).toBe('⚙️ Moteur en marche');
  expect(lakeRefresh.value).toBe(refreshed + 1);
});

test('noteLakeEvent without GPS notes the time alone', () => {
  setCruise(cruise());
  noteLakeEvent(
    { evt: ['Départ baignade'] },
    'noté',
    '2026-07-15T09:00:00.000Z',
  );
  expect(state.data.cruise.value?.entries[0]).toMatchObject({
    t: '2026-07-15T09:00:00.000Z',
    v: { evt: ['Départ baignade'] },
  });
});

test('at sea the black water is kept on the cruise', () => {
  setCruise(cruise());
  noteBlackWater();
  const current = state.data.cruise.value;
  expect(typeof current?.noirVid).toBe('string');
  expect(lastBlackWater()).toBe(current?.noirVid);
  expect(current?.entries[0]?.v.evt).toStrictEqual(['Eaux noires vidées']);
  expect(current?.entries[0]?.t).toBe(current?.noirVid);
  expect(Object.keys(current?.days ?? {})).toStrictEqual([]);
});

test('on the lake the black water is kept on the boat and in the sheet', () => {
  setCruise(cruise({ type: 'lac', duree: 'jour', boatId: 'savannah' }));
  noteBlackWater();
  const current = state.data.cruise.value;
  expect(current?.noirVid).toBeUndefined();
  const time = boatById('savannah')?.noirVid;
  expect(typeof time).toBe('string');
  expect(lastBlackWater()).toBe(time);
  const days = Object.values(current?.days ?? {});
  expect(days).toStrictEqual([{ eauxNoires: 'OK' }]);
});

test('photosFor filters by moment and day', () => {
  const photos = [
    { id: 'a', t: 't', day: '2026-07-14', ctx: 'dep' },
    { id: 'b', t: 't', day: '2026-07-15', ctx: 'nav' },
    { id: 'c', t: 't', day: '2026-07-15', ctx: 'quit' },
  ];
  const open = cruise({ photos });
  const ids = (context?: string | null, day?: string) =>
    photosFor(context, day, open).map((photo) => photo.id);
  expect(ids()).toStrictEqual(['a', 'b', 'c']);
  expect(ids('nav')).toStrictEqual(['b']);
  expect(ids(null, '2026-07-15')).toStrictEqual(['b', 'c']);
  expect(photosFor('nav', null, null)).toStrictEqual([]);
});
