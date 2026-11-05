import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeEach, expect, test } from 'vitest';

import { initState } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import { MOB_DEFAULT } from '../mobDefaults.ts';
import {
  initMobProcedures,
  mobKind,
  mobLake,
  mobSea,
  mobSections,
  mobZone,
  reloadMobProcedures,
  resetMobSections,
  updateMobSections,
} from '../mobProcedures.ts';

const fixture = JSON.parse(
  readFileSync(
    join(import.meta.dirname, '../../../../scripts/parity/fixtures/empty.json'),
    'utf8',
  ),
) as Record<string, unknown>;

beforeEach(() => {
  initState(createMemoryStorage({}));
  mobKind.value = 'real';
  mobZone.value = 'lac';
});

test('the first start writes the same procedures as legacy', () => {
  initMobProcedures();
  expect(store.raw('ldb.mob2')).toBe(JSON.stringify(fixture['ldb.mob2']));
  expect(store.raw('ldb.mob2mer')).toBe(JSON.stringify(fixture['ldb.mob2mer']));
});

test('a stored procedure gets the recovery sections once, before the last one', () => {
  initState(
    createMemoryStorage({
      'ldb.mob2': {
        real: [
          { title: 'Tout de suite', steps: [] },
          { title: 'Si on la perd de vue', steps: [] },
        ],
      },
    }),
  );
  initMobProcedures();
  const stored = store.get<typeof mobLake.value>('ldb.mob2', {});
  expect(stored.recupAdded).toBe(true);
  expect(
    stored.real?.map((section) => section.id ?? section.title),
  ).toStrictEqual(['Tout de suite', 'recup3', 'hypo', 'Si on la perd de vue']);
  expect(store.get('ldb.mob2mer', null)).toStrictEqual(stored);
});

test('a procedure already completed is not written again', () => {
  const lake = { real: [], recupAdded: true };
  const sea = { real: [], recupAdded: true, marker: 1 };
  initState(createMemoryStorage({ 'ldb.mob2': lake, 'ldb.mob2mer': sea }));
  initMobProcedures();
  expect(mobLake.value).toStrictEqual(lake);
  expect(mobSea.value).toStrictEqual(sea);
});

test('an edit changes only the zone shown and stamps the save', () => {
  initMobProcedures();
  mobZone.value = 'mer';
  updateMobSections((sections) => {
    sections.push({ title: 'Nouvelle', steps: [] });
  });
  expect(mobSections().at(-1)?.title).toBe('Nouvelle');
  expect(mobLake.value.real?.at(-1)?.title).toBe('Si on la perd de vue');
  expect(
    store.get<typeof mobSea.value>('ldb.mob2mer', {}).real?.at(-1)?.title,
  ).toBe('Nouvelle');
  expect(store.get('ldb.mob.at', '')).not.toBe('');
  resetMobSections();
  expect(mobSections()).toStrictEqual(MOB_DEFAULT.real);
});

test('a restored backup is read again', () => {
  initMobProcedures();
  store.set('ldb.mob2', { real: [{ title: 'Restaurée', steps: [] }] });
  reloadMobProcedures();
  expect(mobSections()).toStrictEqual([{ title: 'Restaurée', steps: [] }]);
});
