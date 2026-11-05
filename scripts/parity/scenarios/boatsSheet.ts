import type { Scenario } from '../types.ts';

import {
  BOOT,
  FIRST_LOAD,
  LAKE_ID,
  PIXEL,
  QUIET,
  TOAST_GONE,
  catchBlobs,
  cruiseWith,
  dump,
  dumpBlob,
  stubPrint,
} from './boatsSteps.ts';

/** The lake day sheet and the PréP report. */
export const sheetScenarios: Scenario[] = [
  {
    name: 'boats-sheet-lake',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      { go: 'sheet', arg: '2026-07-15' },
      FIRST_LOAD,
      { snapshot: 'sheet' },
      dump(`ldb.cruise.${LAKE_ID}`),
      { click: '[data-part="journalFull"]' },
      { snapshot: 'journal-full' },
      { click: '[data-part="info"]' },
      { click: '[data-part="trace"]' },
      { click: '[data-part="checks"]' },
      { click: '[data-part="obs"]' },
      { snapshot: 'reduced' },
      { click: '[data-fmt="pdf"]' },
      { snapshot: 'pdf' },
      { click: '[data-fmt="both"]' },
      dump('ldb.settings'),
      { snapshot: 'both' },
      { click: '[data-dayform]' },
      { wait: 500 },
      { snapshot: 'to-day' },
    ],
  },
  {
    name: 'boats-sheet-image',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      catchBlobs,
      { go: 'sheet', arg: '2026-07-15' },
      FIRST_LOAD,
      { click: '#shareImg' },
      { wait: 1500 },
      dumpBlob,
      { snapshot: 'sent' },
    ],
  },
  {
    name: 'boats-prep-report',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      stubPrint,
      catchBlobs,
      { go: 'checklist' },
      FIRST_LOAD,
      { click: '#prepPub' },
      { snapshot: 'dialog' },
      { click: '[data-pubth="carnet"]' },
      { click: '[data-pubph]' },
      { snapshot: 'choices' },
      dump('ldb.settings'),
      { click: '[data-pubimg]' },
      { wait: 1500 },
      dumpBlob,
      TOAST_GONE,
      { snapshot: 'image' },
      { click: '#prepPub' },
      { click: '[data-pubpdf]' },
      { wait: 500 },
      { snapshot: 'printing' },
    ],
  },
  {
    name: 'boats-sheet-location',
    fixture: 'sample-lake',
    overrides: {
      ...QUIET,
      ...cruiseWith('sample-lake', LAKE_ID, (cruise) => {
        cruise.purpose = 'Location';
        const info = cruise.info as Record<string, unknown>;
        info.tarifs =
          'Journée semaine : 300\nJournée WE : 350\nSoir (dès 17h) : 180';
        const days = cruise.days as Record<string, Record<string, unknown>>;
        const day = days['2026-07-15'] as Record<string, unknown>;
        delete day.typeSortie;
        day.diesel = 'Plein';
        day.moteurSoir = '1238';
        day.sigSkip = PIXEL;
        day.obsPrise = 'Taud déchiré';
        cruise.entries = [
          ...(cruise.entries as unknown[]),
          {
            id: 'lk-bain',
            t: '2026-07-15T08:10:00.000Z',
            v: { evt: ['Baignade'] },
          },
          {
            id: 'lk-noires',
            t: '2026-07-15T08:12:00.000Z',
            v: { evt: ['Eaux noires vidées'] },
          },
        ];
      }),
    },
    steps: [
      BOOT,
      { go: 'sheet', arg: '2026-07-15' },
      FIRST_LOAD,
      { snapshot: 'sheet' },
      dump(`ldb.cruise.${LAKE_ID}`),
      { snapshot: 'stored' },
    ],
  },
  {
    name: 'boats-sheet-other-day',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      { go: 'sheet', arg: '2026-07-10' },
      FIRST_LOAD,
      { snapshot: 'sheet' },
    ],
  },
  {
    name: 'boats-sheet-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      BOOT,
      { go: 'sheet', arg: '2026-07-14' },
      FIRST_LOAD,
      { snapshot: 'sheet' },
    ],
  },
];
