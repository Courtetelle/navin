import { beforeEach, expect, test } from 'vitest';

import { initState, setPrep, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import {
  prepPathDrop,
  prepPathGet,
  prepPathSave,
  prepPathSub,
  prepPathValid,
} from '../prepPaths.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
});

test('only a lake path with a purpose is kept', () => {
  setPrep({ step: 2, type: 'mer' });
  prepPathSave();
  setPrep({ step: 2, type: 'lac' });
  prepPathSave();
  setPrep({ step: 2, type: 'lac', purpose: 'Location', fill: true });
  prepPathSave();
  expect(state.data.prepPaths.value).toStrictEqual({});
});

test('the path keeps its keys, nothing null, then the time', () => {
  setPrep({
    step: 2,
    type: 'lac',
    purpose: 'Location',
    duree: 'jour',
    boatId: null,
    reach: 2,
    sub: 'tarif',
  });
  prepPathSave();
  const stored = store.get<Record<string, Record<string, unknown>>>(
    'ldb.prepPaths',
    {},
  );
  expect(Object.keys(stored.Location ?? {})).toStrictEqual([
    'purpose',
    'duree',
    'step',
    'reach',
    't',
  ]);
});

test('a path whose cruise started is no longer valid', () => {
  store.set('ldb.cruise.c1', { id: 'c1', entries: [{ id: 'e1' }] });
  state.data.prepPaths.value = { Location: { cruiseId: 'c1', t: 'x' } };
  expect(prepPathValid('Location')).toBeNull();
  expect(state.data.prepPaths.value).toStrictEqual({
    Location: { cruiseId: 'c1', t: 'x' },
  });
  expect(prepPathGet('Location')).toBeNull();
  expect(state.data.prepPaths.value).toStrictEqual({});
});

test('a path whose cruise was removed is no longer valid', () => {
  state.data.prepPaths.value = { Location: { cruiseId: 'gone', t: 'x' } };
  expect(prepPathValid('Location')).toBeNull();
});

test('a path whose cruise has not started is resumed', () => {
  store.set('ldb.cruise.c1', { id: 'c1', entries: [] });
  state.data.prepPaths.value = { Location: { cruiseId: 'c1', t: 'x' } };
  expect(prepPathGet('Location')).toStrictEqual({ cruiseId: 'c1', t: 'x' });
});

test('dropping a path leaves the others', () => {
  state.data.prepPaths.value = { Location: { t: 'x' }, Invitation: { t: 'y' } };
  prepPathDrop('Location');
  expect(state.data.prepPaths.value).toStrictEqual({ Invitation: { t: 'y' } });
  expect(store.get('ldb.prepPaths', null)).toStrictEqual({
    Invitation: { t: 'y' },
  });
});

test('the reminder names the boat and the composition', () => {
  state.data.prepPaths.value = {
    Location: { boatId: 'savannah', crewSet: 'exc1', t: 'x' },
    Invitation: { boatName: 'Tiki', t: 'x' },
    Entraînement: { t: 'x' },
  };
  expect(prepPathSub('Location')).toBe('en cours : Savannah · Régate du jeudi');
  expect(prepPathSub('Invitation')).toBe('en cours : Tiki');
  expect(prepPathSub('Entraînement')).toBe('');
});
