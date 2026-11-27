import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  CREW_CAT,
  OTHER_CAT,
  cleanVoyageStore,
  cleanVoyages,
  contractKindsOf,
  contractSections,
  defaultVoyages,
  docCategories,
  docCategoryOf,
  knownSections,
  mergedVoyages,
  voyageNavInfo,
  voyagePhotoIds,
} from '../../../model/voyages.ts';
import {
  activeVoyageId,
  allVoyageDocIds,
  blankCruise,
  createVoyage,
  mergeVoyages,
  patchVoyage,
  removeVoyage,
  renameVoyage,
  saveCruiseRecord,
  saveRoute,
  setActiveVoyage,
  state,
  syncVoyageNavigations,
  updateCrewSets,
  updateVoyages,
  voyageOfNavigation,
  voyagesChanged,
} from '../../../state/index.ts';
import { store } from '../../../storage/store.ts';
import { load, useHarnessClock } from '../../data/__tests__/fixtures.ts';
import { backupAll } from '../../data/backup.ts';
import { chooseVoyageBoat, voyageBoat } from '../voyageBoat.ts';
import {
  chooseVoyageCrewSet,
  crewSections,
  saveVoyageCrewSet,
  voyageCrewLines,
} from '../voyageCrew.ts';
import { cruiseSpan, dayText } from '../voyageDates.ts';
import { freeRecords, voyageRecords } from '../voyageRecords.ts';
import { voyageTiles } from '../voyageTiles.ts';
import { whatsappHref } from '../whatsapp.ts';

beforeEach(useHarnessClock);

afterEach(() => {
  vi.useRealTimers();
});

test('a cruise has four contracts: broker, charter, cancellation, deposit; an outing its owner', () => {
  const voyages = defaultVoyages();

  expect(voyages.categories.map((cat) => cat.name)).toStrictEqual([
    'Courtier (broker)',
    'Compagnie de location (charter)',
    'Assurance annulation',
    'Protection de caution',
    'Propriétaire',
  ]);
  expect(voyages.categories.every((cat) => cat.cards.length === 1)).toBe(true);
  expect(docCategories(voyages).map((cat) => cat.id)).toStrictEqual([
    'courtiers',
    'loueur',
    'annulation',
    'caution',
    CREW_CAT,
    OTHER_CAT,
  ]);
});

test('the contracts kept before go to their sheet, the others apart', () => {
  const clean = cleanVoyages({
    categories: [
      { id: 'agence', name: 'Agence', cards: [{ id: 'g', org: 'Agence X' }] },
      { id: 'loueur', name: 'Loueur', cards: [{ id: 'l', tel: '+33 2' }] },
      {
        id: 'assurances',
        name: 'Assurances',
        cards: [
          { id: 'a', title: 'Assurance annulation', ref: 'A-1' },
          { id: 'c', title: 'Rachat de caution', ref: 'C-2' },
        ],
      },
    ],
  });

  expect(clean?.categories.map((cat) => cat.id)).toStrictEqual([
    'courtiers',
    'loueur',
    'annulation',
    'caution',
    'proprio',
    'anciens',
  ]);
  expect(clean?.categories[1]?.cards[0]?.tel).toBe('+33 2');
  expect(clean?.categories[2]?.cards[0]?.ref).toBe('A-1');
  expect(clean?.categories[3]?.cards[0]?.ref).toBe('C-2');
  expect(clean?.categories[5]?.cards[0]?.org).toBe('Agence X');
  expect(cleanVoyages(clean)?.categories).toStrictEqual(clean?.categories);
});

test('malformed content is dropped, the rest is kept', () => {
  expect(cleanVoyages(null)).toBeNull();
  expect(cleanVoyages({ categories: 'x' })).toBeNull();

  const clean = cleanVoyages({
    categories: [
      { id: 'loueur', name: 'Loueur', cards: [{ id: 'c', tel: 5 }, 3] },
      { name: 'sans id' },
    ],
    crew: [{ memberId: 'm1' }, { memberId: 'm1' }, {}],
    docs: [{ id: 'd', title: 'Contrat', cat: 'loueur' }, { title: 'x' }],
    mod: '2026-01-01',
  });

  expect(clean?.categories).toHaveLength(5);
  expect(clean?.categories[1]?.cards[0]?.id).toBe('c');
  expect(clean?.categories[1]?.cards[0]?.tel).toBe('');
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
    title: 'Courtier (broker)',
    rows: [['', 'à compléter']],
  });
  expect(sections[2]).toStrictEqual({
    title: 'Assurance annulation',
    rows: [
      ['Société', 'Assur Plus'],
      ['Urgence, assistance 24 h / 24', '+33 1 23 45 67 89'],
      ['Anne Martin', 'Conseillère · anne@example.org'],
    ],
  });
});

test('the newer content wins, the documents of both are kept', () => {
  const kept = {
    ...defaultVoyages(),
    mod: '2026-02-01',
    docs: [
      {
        id: 'a',
        cat: 'agence',
        title: 'A',
        name: '',
        type: '',
        at: '',
        note: '',
      },
    ],
  };
  const received = {
    ...defaultVoyages(),
    mod: '2026-03-01',
    crew: [],
    categories: [],
    docs: [
      {
        id: 'b',
        cat: 'other',
        title: 'B',
        name: '',
        type: '',
        at: '',
        note: '',
      },
    ],
  };

  const merged = mergedVoyages(kept, received);

  expect(merged.categories).toStrictEqual([]);
  expect(merged.docs.map((doc) => doc.id)).toStrictEqual(['b', 'a']);
});

test('the crew of the cruise is a saved crew, and goes to the backup', () => {
  load('sample-sea');
  const cruiseCrew = state.data.cruise.value?.crew.length;

  expect(voyagesChanged()).toBe(false);
  expect(backupAll().data.voyages).toBeUndefined();

  createVoyage(['crew', 'docs'], false);
  const [first, second] = state.data.members.value;
  updateCrewSets((sets) => {
    sets.push({
      id: 'set-bzh',
      name: 'Bretagne',
      crew: [
        { memberId: first?.id ?? '', fonction: 'Skipper' },
        { memberId: second?.id ?? '', fonction: 'Équipier' },
      ],
    });
  });
  chooseVoyageCrewSet('set-bzh');

  expect(
    voyageCrewLines(state.data.voyages.value).map((line) => line.fonction),
  ).toStrictEqual(['Skipper', 'Équipier']);
  expect(state.data.cruise.value?.crew.length).toBe(cruiseCrew);
  expect(crewSections()).toHaveLength(2);
  expect(voyageTiles().map((tile) => tile.key)).toStrictEqual([
    'vcrew',
    'vdocs',
    'vrecords',
  ]);
  expect(voyageTiles()[0]?.sub).toBe('Bretagne · 2 personnes');
  expect(
    store.get<{ list: Array<{ crewSet?: string }> } | null>('ldb.voyages', null)
      ?.list[0]?.crewSet,
  ).toBe('set-bzh');
  expect(backupAll().data.voyages).toStrictEqual(state.data.voyageStore.value);

  updateCrewSets((sets) => {
    sets.find((set) => set.id === 'set-bzh')?.crew.pop();
  });

  expect(crewSections()).toHaveLength(1);

  chooseVoyageCrewSet(undefined);

  expect(crewSections()).toHaveLength(0);
});

test('new cruises are numbered after the last one, with the year', () => {
  load('empty');
  const first = createVoyage(['crew', 'contracts', 'docs'], false);
  renameVoyage(first.id, '12 Croatie');
  updateVoyages((voyages) => {
    const card = voyages.categories[0]?.cards[0];
    if (card) card.tel = '+385 1 234';
  });
  const second = createVoyage(['contracts'], true);

  expect(second.name).toBe('13 Nouvelle croisière 2026');
  expect(second.sections).toStrictEqual(['contracts']);
  expect(second.categories.map((cat) => cat.id)).toStrictEqual([
    'courtiers',
    'loueur',
    'annulation',
    'caution',
    'proprio',
  ]);
  expect(second.categories[0]?.cards[0]?.tel).toBe('');
  expect(state.data.voyageStore.value.active).toBe(second.id);
  expect(knownSections(state.data.voyageStore.value.list)).toStrictEqual([
    'crew',
    'contracts',
    'docs',
  ]);
});

test('the active cruise gathers the new navigations and routes', () => {
  load('empty');
  const voyage = createVoyage(['crew'], true);

  expect(activeVoyageId()).toBe(voyage.id);
  expect(blankCruise('Sortie').voyage).toBe(voyage.id);

  const route = saveRoute({ points: [{ lat: 46, lon: 6 }] });

  expect(route.voyage).toBe(voyage.id);
  expect(voyageRecords(voyage.id).routes).toHaveLength(1);

  setActiveVoyage(null);

  expect(blankCruise('Autre').voyage).toBeUndefined();

  removeVoyage(voyage.id);

  expect(freeRecords().routes).toHaveLength(1);
});

test('the first version, one cruise only, becomes cruise 1', () => {
  const old = { ...defaultVoyages(), mod: '2026-11-24T10:00:00Z' };
  const store1 = cleanVoyageStore(old);

  expect(store1?.list.map((voyage) => voyage.name)).toStrictEqual([
    '1 Croisière 2026',
  ]);
  expect(cleanVoyageStore(defaultVoyages())?.list).toStrictEqual([]);
});

test('a restoration adds the cruises of another device', () => {
  load('empty');
  const here = createVoyage(['crew'], false);
  renameVoyage(here.id, 'Ici');
  const received = {
    list: [
      { ...state.data.voyages.value, name: 'Vieux', mod: '2000-01-01' },
      {
        ...defaultVoyages(),
        id: 'other',
        num: 2,
        name: '2 Là-bas',
        mod: '2999-01-01',
      },
    ],
    active: 'other',
    mod: '2999-01-01',
  };

  mergeVoyages(received);

  expect(
    state.data.voyageStore.value.list.map((voyage) => voyage.name),
  ).toStrictEqual(['Ici', '2 Là-bas']);
  expect(state.data.voyageStore.value.active).toBe('other');
});

test('the navigations of a cruise take its ports, VHF, weather and renter', () => {
  load('empty');
  const voyage = createVoyage(['info', 'contracts'], true);
  updateVoyages((draft) => {
    draft.info.ports = 'Saint-Quay-Portrieux';
    draft.info.vhfMarina = '9';
    const renter = draft.categories.find((cat) => cat.id === 'loueur');
    const card = renter?.cards[0];
    if (card) {
      card.org = 'Base';
      card.tel = '+33 2 96';
    }
  });
  const sortie = blankCruise('Sortie');

  expect(sortie.info.ports).toBe('Saint-Quay-Portrieux');
  expect(sortie.info.vhfMarina).toBe('9');
  expect(sortie.info.base).toBe('Base : +33 2 96');

  saveCruiseRecord(sortie);
  updateVoyages((draft) => {
    draft.info.coastStation = 'CROSS Corsen';
  });
  syncVoyageNavigations(voyage.id);

  expect(
    store.get<{ info: Record<string, string> }>(`ldb.cruise.${sortie.id}`, {
      info: {},
    }).info.coastStation,
  ).toBe('CROSS Corsen');
  expect(voyageOfNavigation(sortie.id)).toBe(voyage.id);
});

test('cruises kept before get the sections Croisière and Bateau and the four contracts', () => {
  const kept = cleanVoyageStore({
    list: [
      { ...defaultVoyages(), id: 'a', num: 1, name: '1 A', sections: ['crew'] },
    ],
    active: null,
    mod: '2026-11-24',
  });

  expect(kept?.list[0]?.sections).toStrictEqual(['info', 'boat', 'crew']);
  expect(kept?.list[0]?.categories.map((cat) => cat.id)).toContain('courtiers');
  expect(kept?.list[0]?.categories.map((cat) => cat.id)).toContain('caution');
});

test('the medallion, the crew and the boat chosen are kept and synced', () => {
  load('sample-sea');
  const voyage = createVoyage(['boat', 'crew'], true);
  const boat = state.data.boats.value[0];
  chooseVoyageBoat(boat?.id);
  patchVoyage(voyage.id, (draft) => {
    draft.photo = 'pmedal';
    draft.crewSet = 'set-x';
  });
  const kept = state.data.voyageStore.value.list[0];
  const cleaned = cleanVoyages(structuredClone(kept));

  expect(cleaned?.photo).toBe('pmedal');
  expect(cleaned?.crewSet).toBe('set-x');
  expect(cleaned?.boat).toBe(boat?.id);
  expect(voyageBoat(state.data.voyages.value)?.id).toBe(boat?.id);
  expect(kept ? voyagePhotoIds(kept) : []).toStrictEqual(['pmedal']);
  expect(allVoyageDocIds()).toStrictEqual(['pmedal']);
});

test('a crew picked one by one becomes a saved crew of the cruise', () => {
  load('sample-sea');
  const before = state.data.crewSets.value.length;
  createVoyage(['crew'], false);

  expect(saveVoyageCrewSet()).toBeNull();

  const member = state.data.members.value[0];
  updateVoyages((voyages) => {
    voyages.crew = [{ memberId: member?.id ?? '', fonction: 'Skipper' }];
  });
  const name = saveVoyageCrewSet();
  const sets = state.data.crewSets.value;

  expect(name).toBe(state.data.voyages.value.name);
  expect(sets).toHaveLength(before + 1);
  expect(sets.at(-1)?.name).toBe(name);
  expect(state.data.voyages.value.crewSet).toBe(sets.at(-1)?.id);
  expect(state.data.voyages.value.crew).toHaveLength(0);
  expect(crewSections()[0]?.rows[0]).toStrictEqual(['Rôle', 'Skipper']);
});

test('the dates of the cruise are read with their day and hour', () => {
  expect(dayText('2027-06-12', '14:30')).toBe('Samedi 12/06/2027 · 14 h 30');
  expect(dayText('2027-06-13', '')).toBe('Dimanche 13/06/2027');
  expect(dayText('n.c.', '')).toBe('n.c.');
});

test('the remarks of the cruise stay in the cruise', () => {
  const info = voyageNavInfo({
    info: {
      ports: 'Saint-Quay',
      telMarina: '+33 2 96 70 81 30',
      meteo: 'clés au bureau',
    },
    categories: [],
  });

  expect(info).toStrictEqual({
    ports: 'Saint-Quay',
    telMarina: '+33 2 96 70 81 30',
  });
});

test('the label of a cruise gives its days once both dates are there', () => {
  expect(cruiseSpan({ du: '2027-06-12', au: '2027-06-19', duH: '14:30' })).toBe(
    'Croisière du Samedi 12/06/2027 au Samedi 19/06/2027',
  );
  expect(cruiseSpan({ du: '2027-06-12' })).toBe('');
});

test('WhatsApp needs a number with its country', () => {
  expect(whatsappHref('+33 6 23 82 11 68')).toBe('https://wa.me/33623821168');
  expect(whatsappHref('0041 79 000 00 00')).toBe('https://wa.me/41790000000');
  expect(whatsappHref('06 23 82 11 68')).toBeNull();
});

test('a document keeps its remarks', () => {
  const kept = cleanVoyages({
    ...defaultVoyages(),
    docs: [
      {
        id: 'd',
        cat: 'other',
        title: 'T',
        name: 'n.pdf',
        type: 'application/pdf',
        at: '',
        note: 'Caution 2 000 €',
      },
    ],
  });
  expect(kept?.docs[0]?.note).toBe('Caution 2 000 €');
});

test('a lake outing is numbered apart and shows its owner only', () => {
  const sea = createVoyage(['contracts'], false);
  const lake = createVoyage(['contracts', 'docs'], false, true);

  expect(sea.lake).toBeUndefined();
  expect(lake.lake).toBe(true);
  expect(lake.name).toMatch(/^1 Nouvelle sortie \d{4}$/u);
  expect(contractKindsOf(lake).map((kind) => kind.id)).toStrictEqual([
    'proprio',
  ]);
  expect(contractKindsOf(sea).map((kind) => kind.id)).toStrictEqual([
    'courtiers',
    'loueur',
    'annulation',
    'caution',
  ]);
  expect(docCategories(lake).map((cat) => cat.id)).toStrictEqual([
    'proprio',
    'crew',
    'other',
  ]);
});
