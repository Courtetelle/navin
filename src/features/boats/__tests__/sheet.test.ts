import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import {
  initState,
  state,
  updateCruise,
  updateSettings,
} from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { reportKey, reportPhotos, reportTheme } from '../prepReportData.ts';
import { buildSheetData, sheetData } from '../sheetData.ts';
import { pickSheet, sheetParts, toggleSheetPart } from '../sheetParts.ts';

const DAY = '2026-07-15';

beforeEach(() => {
  useHarnessWorld();
  initState(createMemoryStorage(readFixture('sample-lake')));
});
afterEach(leaveHarnessWorld);

function rowsOf(key: string, title = '1 · Informations générales') {
  const sheet = sheetData(key);
  return Object.fromEntries(
    sheet.sections.find((section) => section.title === title)?.rows ?? [],
  );
}

test('the sheet of the day: title, rows without empty values, missing marks', () => {
  const sheet = sheetData(DAY);
  expect(sheet.title).toBe('NavIn · Savannah');
  expect(sheet.missing).toBe(true);
  expect(rowsOf(DAY)).toStrictEqual({
    Date: 'mercredi 15 juillet 2026',
    'Type de sortie': 'Entraînement',
    Skipper: 'Thomas Keller',
    Second: 'Camille Rochat',
    Équipage: 'Noa Dubois',
    'Départ · retour': '08:40 → 10:05 (06:40 UTC → 08:05 UTC) (1 h 25)',
    'Milles parcourus': '1,0 NM',
    'Heures moteur': 'début 1234,5 · fin …',
    'Relevés à l’arrivée':
      'carburant 80 % · batteries 12,6 V / 12,5 V · eau 60 %',
    'Niveau du diesel': '3/4',
    'Franchise CHF 500': 'partagée entre les membres présents',
  });
});

test('a location charges the excess to the renter and shows the prices', () => {
  updateCruise((cruise) => {
    cruise.purpose = 'Location';
    cruise.info.tarifs = 'Journée semaine : 300\nSans deux-points';
    const day = cruise.days[DAY];
    if (day) {
      delete day.typeSortie;
      delete day._auto;
    }
  });
  expect(rowsOf(DAY)['Franchise CHF 500']).toBe(
    'à charge du locataire (Thomas Keller)',
  );
  expect(rowsOf(DAY)['Montant location']).toBe('CHF 300');
  expect(rowsOf(DAY, 'Tarifs de location')).toStrictEqual({
    '': 'Sans deux-points',
    'Journée semaine': '300',
  });
});

test('the skipper alone can take the excess', () => {
  updateCruise((cruise) => {
    const day = cruise.days[DAY];
    if (day) day.respUnique = 'Oui, le skipper';
  });
  expect(rowsOf(DAY)['Franchise CHF 500']).toBe(
    'skipper seul responsable : Thomas Keller',
  );
});

test('building a sheet writes nothing, reading it fills the day', () => {
  const before = state.data.cruise.value;
  buildSheetData('2026-07-16');
  expect(state.data.cruise.value).toBe(before);
  sheetData('2026-07-16');
  expect(state.data.cruise.value?.days['2026-07-16']?.skipper).toBe(
    'Thomas Keller',
  );
});

test('observations gather the takeover, the day and the end', () => {
  updateCruise((cruise) => {
    const day = cruise.days[DAY];
    if (!day) return;
    day.obsPrise = 'Taud déchiré';
    day.observations = 'RAS';
    day.obsFin = 'Propre';
  });
  expect(sheetData(DAY).obs).toBe(
    'Constat à la prise du bateau : Taud déchiré\n\nRAS\n\nConstat de fin de journée : Propre',
  );
});

test('checklists: last list first, the quit list renamed, done items marked', () => {
  const { checks } = sheetData(DAY);
  expect(checks.map((list) => list.name)).toStrictEqual([
    'Briefing sécurité',
    'Avant de quitter le bateau',
    'Arrivée à bord',
  ]);
  expect(checks[2]?.items.filter((item) => item.ok)).toHaveLength(4);
});

test('the journal parts exclude each other and are remembered', () => {
  expect(sheetParts().journal).toBe(true);
  toggleSheetPart('journalFull');
  expect(sheetParts().journalFull).toBe(true);
  expect(sheetParts().journal).toBe(false);
  toggleSheetPart('journal');
  expect(sheetParts().journalFull).toBe(false);
  expect(state.preferences.settings.value.sheetParts).toStrictEqual({
    info: true,
    trace: true,
    journal: true,
    journalFull: false,
    obs: true,
    photos: true,
    checks: true,
    tarifs: true,
  });
});

test('picking a sheet keeps only the chosen parts', () => {
  const full = pickSheet(sheetData(DAY), DAY);
  expect(full.traceK).toBe(DAY);
  expect(full.extractTitle).toBe('Extrait du journal');
  expect(full.extract.map((row) => row.what)).toStrictEqual([
    'Départ',
    'Entrée',
    'Virement',
  ]);
  toggleSheetPart('info');
  toggleSheetPart('trace');
  toggleSheetPart('obs');
  toggleSheetPart('checks');
  toggleSheetPart('journalFull');
  const reduced = pickSheet(sheetData(DAY), DAY);
  expect(reduced.sections).toStrictEqual([]);
  expect(reduced.traceK).toBeNull();
  expect(reduced.showObs).toBe(false);
  expect(reduced.sig).toBeNull();
  expect(reduced.checks).toStrictEqual([]);
  expect(reduced.extractTitle).toBe('Journal complet');
});

test('report choices: known layout, photos unless switched off', () => {
  expect(reportTheme()).toBe('cards');
  expect(reportPhotos()).toBe(true);
  expect(reportKey()).toBe('cards+');
  updateSettings((settings) => {
    settings.repTheme = 'mini';
    settings.repPh = false;
  });
  expect(reportKey()).toBe('mini-');
  updateSettings((settings) => {
    settings.repTheme = 'other';
  });
  expect(reportTheme()).toBe('cards');
});
