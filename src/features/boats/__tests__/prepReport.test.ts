import { afterEach, beforeEach, expect, test } from 'vitest';

import { fmtShortDate } from '../../../lib/format.ts';
import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import type { PrepState } from '../../../state/index.ts';
import {
  initState,
  setCruise,
  setPrep,
  updateDay,
} from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { cachedPrepReport, prepReportDocument } from '../prepReportData.ts';

const DAY = '2026-07-15';
const TODAY = fmtShortDate(new Date('2026-07-15T10:30:00+02:00'));

beforeEach(() => {
  useHarnessWorld();
  initState(createMemoryStorage(readFixture('sample-lake')));
});
afterEach(leaveHarnessWorld);

test('no report without an open cruise', async () => {
  setCruise(null);
  await expect(prepReportDocument(false)).resolves.toBeNull();
});

test('the report of a lake day: outing, crew, check-in', async () => {
  const report = await prepReportDocument(false);
  expect(report?.title).toBe('PréP · Entraînement du 15.07');
  expect(report?.kicker).toBe('PréP + check-in');
  expect(report?.sub).toBe(`Savannah · ${TODAY}`);
  expect(report?.photos).toStrictEqual([]);
  expect(report?.sections.slice(0, 2)).toStrictEqual([
    {
      title: 'Sortie',
      rows: [
        ['Sortie', 'Lac · Entraînement'],
        ['Bateau', 'Savannah'],
        ['Date', TODAY],
      ],
    },
    {
      title: 'Équipage · 3',
      rows: [
        ['Skipper', 'Thomas Keller'],
        ['Seconde', 'Camille Rochat'],
        ['Équipier', 'Noa Dubois'],
      ],
    },
  ]);
  const checkIn = report?.sections[2];
  expect(checkIn?.title).toBe('Check-in · 4/9');
  expect(checkIn?.rows.slice(3, 5)).toStrictEqual([
    ['✔ fait', 'Mettre le contact', []],
    [
      '✕ pas fait',
      'Allumer le moteur et relever les heures moteur : 1234,5 h',
      [],
    ],
  ]);
  expect(checkIn?.rows.at(-1)?.[0]).toBe('☐ à faire');
});

test('the PréP purpose wins, observations get their section', async () => {
  setPrep({ purpose: 'Location' } as unknown as PrepState);
  updateDay(DAY, (day) => {
    day.obsPrise = 'Taud déchiré';
  });
  const report = await prepReportDocument(false);
  expect(report?.sections[0]?.rows[0]).toStrictEqual([
    'Sortie',
    'Lac · Location',
  ]);
  expect(report?.sections.at(-1)).toStrictEqual({
    title: 'Observations',
    rows: [['', 'Taud déchiré', []]],
  });
});

test('nothing is prepared before the first request', () => {
  expect(cachedPrepReport()).toBeNull();
});
