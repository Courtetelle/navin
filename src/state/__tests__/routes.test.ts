import { afterEach, beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { store } from '../../storage/store.ts';
import * as actions from '../actions.ts';
import { state } from '../index.ts';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from './parityHelpers.ts';

beforeEach(() => {
  useHarnessWorld();
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
});
afterEach(leaveHarnessWorld);

const A = { lat: 48.652_101_23, lon: -2.830_633_33 };
const B = { lat: 48.75, lon: -2.68 };

test('a new route takes a number, a known one is replaced', () => {
  const first = actions.saveRoute({ points: [A, B] });
  expect(first.name).toBe('Route 1');
  expect(first.speed).toBe(6.5);
  expect(first.points[0]).toStrictEqual({ lat: 48.652_101, lon: -2.830_633 });
  const second = actions.saveRoute({ points: [B, A], speed: 5 });
  expect(second.name).toBe('Route 2');
  const changed = actions.saveRoute({ ...first, points: [A, B, A] });
  expect(changed.id).toBe(first.id);
  expect(changed.at).toBe(first.at);
  expect(state.data.routes.value).toHaveLength(2);
  expect(store.arr('ldb.routes')).toHaveLength(2);
  actions.renameRoute(first.id, '  Portrieux – Bréhat ');
  expect(state.data.routes.value[0]?.name).toBe('Portrieux – Bréhat');
  actions.renameRoute(first.id, ' '.repeat(3));
  expect(state.data.routes.value[0]?.name).toBe('Portrieux – Bréhat');
  expect(actions.nextRouteName(state.data.routes.value)).toBe('Route 3');
  actions.removeRoute(second.id);
  expect(state.data.routes.value.map((route) => route.id)).toStrictEqual([
    first.id,
  ]);
});

test('routes of another device: new ones added, the newer change wins', () => {
  const kept = actions.saveRoute({ points: [A, B] });
  actions.mergeRoutes([
    { ...kept, name: 'Older', mod: '2000-01-01T00:00:00.000Z' },
    { id: 'other', name: 'Other', at: '', mod: '', points: [B], speed: 6 },
    { id: 'bad', points: 'no' },
  ]);
  expect(state.data.routes.value.map((route) => route.name)).toStrictEqual([
    'Route 1',
    'Other',
  ]);
  actions.mergeRoutes([
    { ...kept, name: 'Newer', mod: '2999-01-01T00:00:00.000Z' },
  ]);
  expect(state.data.routes.value[0]?.name).toBe('Newer');
  actions.mergeRoutes('nothing');
  expect(state.data.routes.value).toHaveLength(2);
});

test('routes kept on the device come back at the next start', () => {
  actions.saveRoute({ points: [A, B] });
  const saved = store.arr('ldb.routes');
  store.set('ldb.routes', [...saved, { id: '', points: [] }]);
  actions.loadRoutes();
  expect(state.data.routes.value).toHaveLength(1);
});
