import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import { boatById, initState, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import {
  addBoat,
  docCaption,
  keepSeaBoat,
  removeBoatDoc,
  saveBoatInfo,
  seaBoatsNotKept,
  setBoatDocCaption,
  toggleBoatThumb,
} from '../boatActions.ts';
import {
  boatDocs,
  boatThumbId,
  docKindLabel,
  docKindName,
} from '../boatDocs.ts';
import { boatInfoRows } from '../boatInfoRows.ts';
import { dayLine } from '../dayLine.ts';
import { versionValueText } from '../versionText.ts';
import { withKeys } from '../withKeys.ts';

const LAKE_ID = 'mrltkr40tkny6';

beforeEach(() => {
  useHarnessWorld();
  initState(createMemoryStorage(readFixture('sample-lake')));
});
afterEach(leaveHarnessWorld);

function seedDocuments(): void {
  state.data.boats.value = state.data.boats.value.map((boat) =>
    boat.id === 'exb1'
      ? {
          ...boat,
          thumb: 'a',
          docs: [
            { id: 'a', kind: 'permis', t: '2026-07-01T00:00:00.000Z' },
            { id: 'b', kind: '?', t: '2026-07-01T00:00:00.000Z', cap: 'Scan' },
          ],
        }
      : boat,
  );
}

test('document kinds', () => {
  expect(docKindLabel('permis')).toBe('🪪 Permis de navigation');
  expect(docKindName('permis')).toBe('Permis de navigation');
  expect(docKindLabel('other')).toBe('📎 Document');
});

test('the thumbnail must still be a document of the boat', () => {
  seedDocuments();
  const boat = boatById('exb1');
  expect(boat && boatThumbId(boat)).toBe('a');
  removeBoatDoc('a');
  const after = boatById('exb1');
  expect(after && boatThumbId(after)).toBeNull();
  expect(after && boatDocs(after).map((item) => item.id)).toStrictEqual(['b']);
});

test('a caption is trimmed, and removed when empty', () => {
  seedDocuments();
  setBoatDocCaption('a', ' Carte  ');
  let document = boatDocs(boatById('exb1') as never)[0];
  expect(document?.cap).toBe('Carte');
  expect(document && docCaption(document)).toBe('Carte');
  setBoatDocCaption('a', ' ');
  document = boatDocs(boatById('exb1') as never)[0];
  expect(document?.cap).toBeUndefined();
  expect(document && docCaption(document)).toBe('Permis de navigation');
});

test('the same photo chosen twice removes the thumbnail', () => {
  seedDocuments();
  toggleBoatThumb('exb1', 'b');
  expect(boatById('exb1')?.thumb).toBe('b');
  expect(state.view.toast.value?.message).toBe('Vignette du bateau choisie');
  toggleBoatThumb('exb1', 'b');
  expect(boatById('exb1')?.thumb).toBeNull();
  expect(state.view.toast.value?.message).toBe('Vignette retirée');
});

test('a new boat has the lake contacts and empty lists', () => {
  const id = addBoat();
  const boat = boatById(id);
  expect(Object.keys(boat ?? {})).toStrictEqual([
    'id',
    'info',
    'checklist',
    'checklistDep',
    'checklistX',
    'checklistDepX',
  ]);
  expect(boat?.info.contacts).toContain('Rega, sauvetage aérien : 1414');
});

test('a sheet change reaches the open outing of this boat', () => {
  const boat = boatById('savannah');
  saveBoatInfo('savannah', { ...boat?.info, boat: 'Savannah II' });
  expect(boatById('savannah')?.info.boat).toBe('Savannah II');
  expect(state.data.cruise.value?.info.boat).toBe('Savannah II');
  expect(state.data.cruise.value?.id).toBe(LAKE_ID);
});

test('sea boats not kept: once per name, lake outings excluded', () => {
  expect(seaBoatsNotKept()).toStrictEqual([]);
  initState(createMemoryStorage(readFixture('sample-sea')));
  expect(seaBoatsNotKept()).toStrictEqual([]);
  state.data.boats.value = state.data.boats.value.filter(
    (boat) => boat.id !== 'exb3',
  );
  expect(seaBoatsNotKept()).toStrictEqual([
    { name: 'Mistral', cruiseId: LAKE_ID, cruiseName: 'Croatie 2026' },
  ]);
  const id = keepSeaBoat(LAKE_ID);
  expect(boatById(id)?.sea).toBe(true);
  expect(boatById(id)?.info.model).toBe('Bavaria C42');
  expect(state.view.toast.value?.message).toBe('Mistral ajouté au recueil');
  expect(seaBoatsNotKept()).toStrictEqual([]);
  expect(keepSeaBoat('nothing')).toBeNull();
});

test('info rows: units, labels, no SOS numbers', () => {
  const boat = boatById('savannah');
  const rows = boat ? boatInfoRows(boat) : [];
  expect(rows.map((section) => section.title)).toStrictEqual([
    'Données techniques',
    'Informations',
  ]);
  const first = rows[0]?.rows ?? [];
  expect(first.slice(0, 3)).toStrictEqual([
    ['Nom du bateau', 'Savannah'],
    ['Navigue', 'en eaux intérieures'],
    ['Modèle', 'Hanse 325'],
  ]);
  expect(first.find(([label]) => label === 'Tirant d’eau')?.[1]).toBe('1,53 m');
});

test('a version value is cut on its HTML form', () => {
  expect(versionValueText('')).toBe('—');
  expect(versionValueText(null)).toBe('—');
  expect(versionValueText(12)).toBe('12');
  expect(versionValueText({ a: 1 })).toBe('{"a":1}');
  expect(versionValueText('x'.repeat(90))).toBe('x'.repeat(80));
  expect(versionValueText('a & b')).toBe('a & b');
  expect(versionValueText(`${'x'.repeat(78)}&b`)).toBe(`${'x'.repeat(78)}&a`);
});

test('repeated keys get a suffix', () => {
  expect(withKeys(['a', 'b', 'a'], String)).toStrictEqual([
    { key: 'a', item: 'a' },
    { key: 'b', item: 'b' },
    { key: 'a#1', item: 'a' },
  ]);
});

test('the line of a day: entries joined when there is no track', () => {
  const cruise = state.data.cruise.value;
  expect(dayLine('2026-07-15', cruise).line).toHaveLength(3);
  expect(dayLine('2026-07-10', cruise)).toStrictEqual({ line: [], nm: 0 });
  expect(dayLine('2026-07-15', null)).toStrictEqual({ line: [], nm: 0 });
});
