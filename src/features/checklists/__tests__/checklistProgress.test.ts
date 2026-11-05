import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import * as actions from '../../../state/actions.ts';
import { state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import {
  clearItem,
  markItemDone,
  markItemOpen,
  markItemTodo,
  saveCkVal,
  saveObservation,
  saveReading,
} from '../checklistActions.ts';
import {
  checkDone,
  checkItems,
  checkLeft,
  checklistSub,
  ckCurrent,
  ckLabelVal,
  ckOpen,
  ckVal,
  relevesSummary,
} from '../checklistProgress.ts';

const TODAY = '2026-07-15';

function today() {
  return actions.getDay(TODAY);
}

beforeEach(() => {
  useHarnessWorld();
});
afterEach(leaveHarnessWorld);

function openLake(): void {
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
}

function openSea(): void {
  actions.initState(createMemoryStorage(readFixture('sample-sea')));
}

test('without cruise there is nothing to do', () => {
  actions.initState(createMemoryStorage(readFixture('empty')));
  expect(checkItems()).toStrictEqual([]);
  expect(checkLeft('dep')).toStrictEqual([]);
  expect(checklistSub()).toBe('à préparer');
});

test('a lake day outing reads the lists of its boat and the checks of the day', () => {
  openLake();
  expect(checkItems('dep')).toHaveLength(9);
  expect(checkItems('quit')).toHaveLength(8);
  expect(checkItems()).toHaveLength(17);
  expect([...checkDone()]).toStrictEqual(['d1', 'd2', 'd3', 'rel-c']);
  expect([...ckOpen()]).toStrictEqual(['rel-moteurDebut']);
  expect(checkLeft('dep').map((item) => item.id)).toStrictEqual([
    'rel-moteurDebut',
    'rel-carbPct',
    'rel-batt1',
    'rel-batt2',
    'rel-eauPct',
  ]);
  expect(ckCurrent()).toBe('dep');
  expect(checklistSub()).toBe('Arrivée à bord : 5 points');
});

test('a sea cruise not opened yet reads the template', () => {
  openSea();
  expect(checkItems('dep')).toHaveLength(37);
  expect(checkItems('quit')).toHaveLength(8);
  expect(checklistSub()).toBe('Prise du bateau : 37 points');
});

test('the quit list is suggested once the arrival list is done', () => {
  openLake();
  for (const item of checkItems('dep')) markItemDone(item.id);
  expect(ckCurrent()).toBe('quit');
  expect(checklistSub()).toBe('Quitter le bateau : 8 points');
  for (const item of checkItems('quit')) markItemDone(item.id);
  expect(checklistSub()).toBe('tout est fait');
});

test('white, orange, green and back to white', () => {
  openLake();
  markItemOpen('rel-carbPct');
  expect(today().ckOpen).toStrictEqual(['rel-moteurDebut', 'rel-carbPct']);
  markItemDone('rel-carbPct');
  expect(today().ckOpen).toStrictEqual(['rel-moteurDebut']);
  expect(today().checkDone).toStrictEqual([
    'd1',
    'd2',
    'd3',
    'rel-c',
    'rel-carbPct',
  ]);
  markItemDone('rel-moteurDebut');
  expect(today().ckOpen).toBeUndefined();
  markItemTodo('d1');
  expect(today().checkDone).toStrictEqual([
    'd2',
    'd3',
    'rel-c',
    'rel-carbPct',
    'rel-moteurDebut',
  ]);
  const stored = store.get<{ days: Record<string, { checkDone: string[] }> }>(
    'ldb.cruise.mrltkr40tkny6',
    { days: {} },
  );
  expect(stored.days[TODAY]?.checkDone).toHaveLength(5);
});

test('the checks of a sea cruise are kept on the cruise', () => {
  openSea();
  markItemOpen('m1');
  markItemDone('m2');
  expect(state.data.cruise.value?.ckOpen).toStrictEqual(['m1']);
  expect(state.data.cruise.value?.checkDone).toStrictEqual(['m2']);
  expect(today().checkDone).toBeUndefined();
});

test('a value goes to the day sheet when the item has a key, otherwise with the checks', () => {
  openLake();
  const reading = {
    id: 'rel-carbPct',
    label: 'Carburant :',
    unit: '%',
    key: 'carbPct',
  };
  expect(ckVal(reading)).toBe('80');
  expect(ckLabelVal(reading)).toBe('Carburant : 80 %');
  saveCkVal(reading, '75');
  expect(today().carbPct).toBe('75');
  const free = { id: 'x1', label: 'Pression', unit: 'nb' };
  expect(ckLabelVal(free)).toBe('Pression');
  saveCkVal(free, '3');
  expect(today().ckVals).toStrictEqual({ x1: '3' });
  expect(ckLabelVal(free)).toBe('Pression : 3');
  clearItem(free);
  expect(today().ckVals).toStrictEqual({});
});

test('a reading typed by hand is no longer automatic', () => {
  openLake();
  actions.updateDay(TODAY, (day) => {
    day._auto = { batt1: true, batt2: true };
  });
  saveCkVal({ id: 'rel-batt1', label: 'Batterie', key: 'batt1' }, '12,9');
  saveReading('batt2', '12,8');
  expect(today()._auto).toStrictEqual({});
  expect([today().batt1, today().batt2]).toStrictEqual(['12,9', '12,8']);
});

test('observations stay with the day on a lake day outing, with the cruise otherwise', () => {
  openLake();
  saveObservation('obsPrise', 'Griffure');
  expect(today().obsPrise).toBe('Griffure');
  openSea();
  saveObservation('obsFin', 'Rien à signaler');
  expect(state.data.cruise.value?.obsFin).toBe('Rien à signaler');
});

test('summary of the readings', () => {
  expect(
    relevesSummary({
      moteurDebut: '1234,5',
      carbPct: '80',
      batt1: '12,6',
      batt2: '',
      eauPct: 60,
    }),
  ).toBe('moteur 1234,5 h · carburant 80 % · batteries 12,6 V · eau 60 %');
  expect(relevesSummary({})).toBe('');
});
