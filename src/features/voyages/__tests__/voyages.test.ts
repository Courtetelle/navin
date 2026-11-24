import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  CREW_CAT,
  OTHER_CAT,
  cleanVoyages,
  contractSections,
  defaultVoyages,
  docCategories,
  docCategoryOf,
  mergedVoyages,
} from '../../../model/voyages.ts';
import {
  mergeVoyages,
  state,
  updateVoyages,
  voyagesChanged,
} from '../../../state/index.ts';
import { store } from '../../../storage/store.ts';
import { load, useHarnessClock } from '../../data/__tests__/fixtures.ts';
import { backupAll } from '../../data/backup.ts';
import { crewSections, toggleVoyageMember } from '../voyageCrew.ts';
import { voyageTiles } from '../voyageTiles.ts';

beforeEach(useHarnessClock);

afterEach(() => {
  vi.useRealTimers();
});

test('a new device has the agency, the renter and the two insurances', () => {
  const voyages = defaultVoyages();

  expect(voyages.categories.map((cat) => cat.name)).toStrictEqual([
    'Agence',
    'Loueur',
    'Assurances',
  ]);
  expect(voyages.categories[2]?.cards.map((card) => card.title)).toStrictEqual([
    'Assurance annulation',
    'Rachat de caution',
  ]);
  expect(docCategories(voyages).map((cat) => cat.id)).toStrictEqual([
    'agence',
    'loueur',
    'assurances',
    CREW_CAT,
    OTHER_CAT,
  ]);
});

test('malformed content is dropped, the rest is kept', () => {
  expect(cleanVoyages(null)).toBeNull();
  expect(cleanVoyages({ categories: 'x' })).toBeNull();

  const clean = cleanVoyages({
    categories: [
      { id: 'a', name: 'Agence', cards: [{ id: 'c', title: 'T', tel: 5 }, 3] },
      { name: 'sans id' },
    ],
    crew: [{ memberId: 'm1' }, { memberId: 'm1' }, {}],
    docs: [{ id: 'd', title: 'Contrat', cat: 'a' }, { title: 'x' }],
    mod: '2026-01-01',
  });

  expect(clean?.categories).toHaveLength(1);
  expect(clean?.categories[0]?.cards[0]?.tel).toBe('');
  expect(clean?.crew).toStrictEqual([{ memberId: 'm1', fonction: 'Équipier' }]);
  expect(clean?.docs.map((doc) => doc.id)).toStrictEqual(['d']);
});

test('a document of a deleted category goes to Autres', () => {
  const voyages = defaultVoyages();

  expect(docCategoryOf(voyages, { cat: 'loueur' })).toBe('loueur');
  expect(docCategoryOf(voyages, { cat: 'gone' })).toBe(OTHER_CAT);
});

test('the contracts are shared without their empty lines', () => {
  const voyages = defaultVoyages();
  const insurance = voyages.categories[2]?.cards[0];
  if (insurance) {
    insurance.org = 'Assur Plus';
    insurance.urgence = '+33 1 23 45 67 89';
    insurance.persons.push({
      id: 'p',
      nom: 'Anne Martin',
      role: 'Conseillère',
      tel: '',
      mail: 'anne@example.org',
    });
  }

  const sections = contractSections(voyages.categories);

  expect(sections[0]).toStrictEqual({
    title: 'Agence',
    rows: [['', 'à compléter']],
  });
  expect(sections[2]).toStrictEqual({
    title: 'Assurances · Assurance annulation',
    rows: [
      ['Société, agence', 'Assur Plus'],
      ['Urgence, assistance 24 h / 24', '+33 1 23 45 67 89'],
      ['Anne Martin', 'Conseillère · anne@example.org'],
    ],
  });
});

test('the newer content wins, the documents of both are kept', () => {
  const kept = {
    ...defaultVoyages(),
    mod: '2026-02-01',
    docs: [{ id: 'a', cat: 'agence', title: 'A', name: '', type: '', at: '' }],
  };
  const received = {
    ...defaultVoyages(),
    mod: '2026-03-01',
    crew: [],
    categories: [],
    docs: [{ id: 'b', cat: 'other', title: 'B', name: '', type: '', at: '' }],
  };

  const merged = mergedVoyages(kept, received);

  expect(merged.categories).toStrictEqual([]);
  expect(merged.docs.map((doc) => doc.id)).toStrictEqual(['b', 'a']);
});

test('the crew of the cruise is its own, and goes to the backup once changed', () => {
  load('sample-sea');
  const cruiseCrew = state.data.cruise.value?.crew.length;

  expect(voyagesChanged()).toBe(false);
  expect(backupAll().data.voyages).toBeUndefined();

  const [first, second] = state.data.members.value;
  toggleVoyageMember(first?.id ?? '');
  toggleVoyageMember(second?.id ?? '');

  expect(
    state.data.voyages.value.crew.map((line) => line.fonction),
  ).toStrictEqual(['Skipper', 'Équipier']);
  expect(state.data.cruise.value?.crew.length).toBe(cruiseCrew);
  expect(crewSections()).toHaveLength(2);
  expect(voyageTiles()[0]?.sub).toBe('2 personnes pour la croisière');
  expect(
    store.get<{ crew: unknown[] } | null>('ldb.voyages', null)?.crew,
  ).toHaveLength(2);
  expect(backupAll().data.voyages).toStrictEqual(state.data.voyages.value);

  toggleVoyageMember(first?.id ?? '');

  expect(state.data.voyages.value.crew).toHaveLength(1);
});

test('a restoration brings the content of another device', () => {
  load('empty');
  updateVoyages((voyages) => {
    const [first] = voyages.categories;
    if (first) first.name = 'Agence ici';
  });
  const older = { ...state.data.voyages.value, mod: '2000-01-01' };

  mergeVoyages({ ...older, categories: [] });

  expect(state.data.voyages.value.categories[0]?.name).toBe('Agence ici');

  mergeVoyages({ ...older, mod: '2999-01-01', categories: [] });

  expect(state.data.voyages.value.categories).toStrictEqual([]);
});
