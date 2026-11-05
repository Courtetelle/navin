import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Cruise } from '../../model/types.ts';
import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { store } from '../../storage/store.ts';
import * as actions from '../actions.ts';
import { state } from '../index.ts';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from './parityHelpers.ts';

const SEA_ID = 'mrltkr40tkny6';
const LAKE_ID = 'mrltkr405l9e4';

beforeEach(() => {
  useHarnessWorld();
  actions.initState(createMemoryStorage(readFixture('sample')));
});
afterEach(leaveHarnessWorld);

test('boot opens the current cruise with its draft', () => {
  expect(state.data.cruise.value?.id).toBe(LAKE_ID);
  expect(state.data.index.value.map((meta) => meta.id)).toStrictEqual([
    SEA_ID,
    LAKE_ID,
  ]);
  expect(actions.isLake()).toBe(true);
  expect(actions.curMode()).toBe('lacj');
  store.set(`ldb.draft.${SEA_ID}`, {
    t: '2026-07-15T08:00:00.000Z',
    v: { note: 'brouillon' },
  });
  expect(actions.openCruise(SEA_ID)).toBe(true);
  expect(state.data.draft.value).toStrictEqual({
    t: '2026-07-15T08:00:00.000Z',
    v: { note: 'brouillon' },
  });
  expect(store.get('ldb.current', null)).toBe(SEA_ID);
  expect(actions.openCruise('missing')).toBe(false);
});

test('saveCruise stamps the cruise and updates its index line', () => {
  vi.setSystemTime(new Date('2026-07-15T09:00:00.000Z'));
  actions.updateCruise((cruise) => {
    cruise.info.name = 'Renommée';
  });
  expect(state.data.cruise.value?.updated).toBe('2026-07-15T09:00:00.000Z');
  expect(store.get<Array<{ name: string }>>('ldb.index', [])[1]).toStrictEqual({
    id: LAKE_ID,
    name: 'Renommée',
    created: '2026-07-15T08:30:00.000Z',
    type: 'lac',
    duree: 'jour',
  });
  vi.setSystemTime(new Date('2026-07-15T09:30:00.000Z'));
  actions.updateCruise(
    (cruise) => {
      cruise.info.name = '';
    },
    { keepStamp: true },
  );
  expect(
    store.get<{ updated: string }>(`ldb.cruise.${LAKE_ID}`, { updated: '' })
      .updated,
  ).toBe('2026-07-15T09:00:00.000Z');
  expect(store.get<Array<{ name: string }>>('ldb.index', [])[1]?.name).toBe(
    'Sans nom',
  );
});

test('removing the open cruise deletes its data and opens the most recent one', () => {
  const stopTracking = vi.fn();
  actions.hooks.stopTracking = stopTracking;
  state.view.tracking.value = true;
  for (const prefix of actions.CRUISE_KEY_PREFIXES) {
    store.set(prefix + LAKE_ID, []);
  }
  actions.removeCruise(LAKE_ID);
  actions.hooks.stopTracking = null;
  expect(stopTracking.mock.calls).toStrictEqual([[false]]);
  expect(store.keys().filter((key) => key.includes(LAKE_ID))).toStrictEqual([]);
  expect(state.data.index.value.map((meta) => meta.id)).toStrictEqual([SEA_ID]);
  expect(state.data.cruise.value?.id).toBe(SEA_ID);
  actions.removeCruise(SEA_ID);
  expect(state.data.cruise.value).toBeNull();
  expect(store.get('ldb.current', 'none')).toBe('none');
});

test('blankCruise continues the engine counter of the previous cruise', () => {
  const sea = store.get(`ldb.cruise.${SEA_ID}`, null);
  const next = actions.blankCruise('Suite', sea);
  expect(next.info).toMatchObject({
    name: 'Suite',
    moteurInit: '1520,5',
    boat: 'Mistral',
    conso: 3,
  });
  expect(next.info.ports).toBeUndefined();
  expect([next.entries, next.crew, next.days]).toStrictEqual([[], [], {}]);
});

test('entries stay sorted and the day sheets are listed', () => {
  actions.openCruise(SEA_ID);
  actions.addEntry({
    id: 'early',
    t: '2026-07-13T20:00:00.000Z',
    v: { note: 'veille' },
  });
  expect(
    state.data.cruise.value?.entries.map((entry) => entry.id),
  ).toStrictEqual(['early', 'sea-e1', 'sea-e2', 'sea-e3', 'sea-e4', 'sea-e5']);
  expect(actions.daysWithData()).toStrictEqual([
    '2026-07-13',
    '2026-07-14',
    '2026-07-15',
  ]);
  actions.removeEntry('early');
  expect(state.data.cruise.value?.entries).toHaveLength(5);
  expect(actions.navForDay('2026-07-14').ms).toBe(6.5 * 3600e3);
  expect(actions.navLabel('2026-07-14')).toBe('6 h 30 · 24,3 NM');
  expect(actions.navLabel('2026-07-16')).toBe('');
  expect(actions.crewNames()).toStrictEqual([
    'Elena García',
    'Luca Bernasconi',
    'Sophie Martin',
    'Invité sans fiche',
  ]);
});

test('new drafts carry the previous values when the setting allows it', () => {
  actions.openCruise(SEA_ID);
  actions.updateSettings((settings) => {
    settings.prefill = true;
  });
  expect(actions.newDraft()).toStrictEqual({
    t: '2026-07-15T08:30:00.000Z',
    v: { loch: 37.1, sog: 6.2, cog: 245 },
    prefilled: true,
  });
  actions.updateSettings((settings) => {
    settings.prefill = false;
  });
  expect(actions.newDraft().prefilled).toBe(false);
  expect(
    store.get<{ prefill: boolean }>('ldb.settings', { prefill: true }).prefill,
  ).toBe(false);
});

test('updateDay creates the day; getDay never does', () => {
  expect(actions.getDay('2026-08-01')).toStrictEqual({});
  expect(state.data.cruise.value?.days['2026-08-01']).toBeUndefined();
  actions.updateDay('2026-08-01', (day) => {
    day.observations = 'RAS';
  });
  expect(
    store.get<{ days: Record<string, unknown> }>(`ldb.cruise.${LAKE_ID}`, {
      days: {},
    }).days['2026-08-01'],
  ).toStrictEqual({ observations: 'RAS' });
});

test('saveCruiseRecord saves another cruise without opening it', () => {
  const sea = store.get<Cruise | null>(`ldb.cruise.${SEA_ID}`, null);
  if (!sea) throw new Error('no sea cruise');
  vi.setSystemTime(new Date('2026-07-15T09:00:00.000Z'));
  const { cruise, written } = actions.saveCruiseRecord({
    ...sea,
    info: { ...sea.info, name: 'Croatie 2026 bis' },
  });
  expect([written, cruise.updated, state.data.cruise.value?.id]).toStrictEqual([
    true,
    '2026-07-15T09:00:00.000Z',
    LAKE_ID,
  ]);
  expect(state.data.index.value[0]?.name).toBe('Croatie 2026 bis');
  expect(store.get('ldb.current', '')).toBe(SEA_ID);
});
