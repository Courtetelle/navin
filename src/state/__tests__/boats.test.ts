import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { store } from '../../storage/store.ts';
import * as actions from '../actions.ts';
import { state } from '../index.ts';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from './parityHelpers.ts';

/** Marker of the first filled field of the m / ft pair. */
const PAIR_SOURCE = 'pairSrc_loa_loaFt';

beforeEach(() => {
  useHarnessWorld();
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
});
afterEach(leaveHarnessWorld);

test('a changed boat keeps its previous values as a version, once per 20 minutes', () => {
  const beams = () =>
    (actions.boatById('exb2')?.hist ?? []).map((version) => [
      version.at,
      version.from,
      version.info.beam,
    ]);
  actions.updateBoat('exb2', (boat) => {
    boat.info.beam = '2,60';
  });
  expect(beams()).toStrictEqual([
    ['2026-07-15T08:30:00.000Z', 'Avant modification', '2,50'],
  ]);
  vi.setSystemTime(new Date('2026-07-15T08:40:00.000Z'));
  actions.updateBoat('exb2', (boat) => {
    boat.info.beam = '2,70';
  });
  expect(beams()).toHaveLength(1);
  vi.setSystemTime(new Date('2026-07-15T08:55:00.000Z'));
  actions.updateBoat('exb2', (boat) => {
    boat.info.beam = '2,80';
  });
  expect(beams()).toStrictEqual([
    ['2026-07-15T08:55:00.000Z', 'Avant modification', '2,70'],
    ['2026-07-15T08:30:00.000Z', 'Avant modification', '2,50'],
  ]);
  expect(store.get('ldb.boats.at', '')).toBe('2026-07-15T08:55:00.000Z');
});

test('mergeBoats adds unknown boats and replaces only with a newer list', () => {
  actions.saveBoats();
  const received = [
    { id: 'exb1', info: { boat: 'Alizé 2' } },
    { id: 'new', info: { boat: 'Nouveau' } },
  ];
  actions.mergeBoats(received, '2000-01-01T00:00:00.000Z');
  expect([
    actions.boatById('exb1')?.info.boat,
    actions.boatById('new')?.info.boat,
  ]).toStrictEqual(['Alizé', 'Nouveau']);
  actions.mergeBoats(received, '2030-01-01T00:00:00.000Z');
  expect(actions.boatById('exb1')?.info.boat).toBe('Alizé 2');
  expect(store.get('ldb.boats.at', '')).toBe('2030-01-01T00:00:00.000Z');
});

test('an outing sheet and its boat exchange their values', () => {
  actions.updateCruise((cruise) => {
    cruise.info.beam = '3,35';
    cruise.info[PAIR_SOURCE] = 'loaFt';
  });
  actions.syncBoatFromCruise('beam');
  expect(actions.boatById('savannah')?.info).toMatchObject({
    beam: '3,35',
    [PAIR_SOURCE]: 'loaFt',
  });
  actions.syncBoatFromCruise('name');
  expect(actions.boatById('savannah')?.info.name).toBeUndefined();
  actions.updateBoat('savannah', (boat) => {
    boat.info.draft = '1,60';
  });
  actions.pullBoatIntoCruise();
  expect(state.data.cruise.value?.info.draft).toBe('1,60');
  actions.restoreBoatVersion('savannah', 0);
  expect(actions.boatById('savannah')?.hist?.[0]?.from).toBe(
    'Avant retour en arrière',
  );
});

test('blankOuting copies the boat and continues its engine counter', () => {
  actions.updateDay('2026-07-15', (day) => {
    day.moteurSoir = '1236';
  });
  const boat = actions.boatById('savannah');
  if (!boat) throw new Error('no Savannah');
  const outing = actions.blankOuting('Soirée', boat, 'jour');
  expect(outing).toMatchObject({
    type: 'lac',
    duree: 'jour',
    boatId: 'savannah',
  });
  expect(outing.info).toMatchObject({
    name: 'Soirée',
    du: '2026-07-15',
    au: '2026-07-15',
    boat: 'Savannah',
    moteurInit: '1236',
    model: 'Hanse 325',
  });
  expect(
    actions.blankOuting('Croisière', boat, 'croisiere').info.au,
  ).toBeUndefined();
  expect(actions.infoSections().map((section) => section.title)).toStrictEqual([
    'Croisière',
    'Données techniques',
    'Informations',
    'Numéros utiles (page SOS)',
  ]);
});

test('crew sets, member locks and usage order', () => {
  expect(
    state.data.crewSets.value.map((set) => actions.crewSetName(set)),
  ).toStrictEqual([
    'Régate du jeudi',
    'Croisière en Méditerranée',
    'Sortie découverte',
    'Équipe du mercredi',
  ]);
  expect(actions.crewSetDate(state.data.crewSets.value[0] ?? {})).toBe(
    'créé le 15.07.2026',
  );
  expect(actions.memberLocks('ex2')).toStrictEqual([
    'EQ001',
    'EQ002',
    'EQ004',
    'navigation en cours',
  ]);
  expect(actions.memberLockMsg('ex3')).toBe(
    'Fiche protégée : la personne fait partie de ces équipages EQ002, EQ003. Retirez-la d’abord de ces listes.',
  );
  expect(actions.memberLockMsg('m-lea')).toBe(
    'Fiche protégée : la personne fait partie de l’équipage EQ004. Retirez-la d’abord de cette liste.',
  );
  expect(actions.memberLockMsg('ex99')).toBe('');
  vi.setSystemTime(new Date('2026-07-16T08:30:00.000Z'));
  actions.updateCrewSets((sets) => {
    const set = sets[0];
    if (set) set.name = 'Régate du vendredi';
  });
  expect(actions.crewSetDate(state.data.crewSets.value[0] ?? {})).toBe(
    'modifié le 16.07.2026',
  );
  const boats = state.data.boats.value;
  expect(
    actions
      .byUse(boats, 'boat', 'Entraînement', (boat) => String(boat.info.boat))
      .map((boat) => boat.id),
  ).toStrictEqual(['savannah', 'exb1', 'exb2', 'inspiration', 'exb3']);
  actions.noteUse('boat', 'exb3', 'Location');
  expect(
    actions.byUse(boats, 'boat', 'Location', (boat) =>
      String(boat.info.boat),
    )[0]?.id,
  ).toBe('exb3');
  expect(
    store.get<{ boat: unknown[] }>('ldb.prepUse', { boat: [] }).boat,
  ).toHaveLength(2);
});
