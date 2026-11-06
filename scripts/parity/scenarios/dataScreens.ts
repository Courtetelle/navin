import type { Scenario } from '../types.ts';

import {
  BOOK_PAGES,
  GPX_TRACK,
  NO_PRINT,
  QUIET,
  SHOW_STORAGE,
  chooseFile,
  emptySeaCruise,
  enter,
  screen,
  snap,
} from './dataSteps.ts';

/** Boat sheet, crew, print, files and the screen without an open cruise. */
export const screenScenarios: Scenario[] = [
  // Boat and cruise sheet.
  screen('info', 'sample-lake', 'info'),
  screen('info', 'sample-sea', 'info'),
  {
    name: 'data-info-edit',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      ...enter('info'),
      { fill: '#infoForm [data-k="name"]', value: 'Grèce 2026' },
      { wait: 200 },
      SHOW_STORAGE,
      ...snap('renamed'),
    ],
  },
  // Crew.
  screen('crew', 'empty', 'crew'),
  screen('crew', 'sample-lake', 'crew'),
  screen('crew', 'sample-sea', 'crew'),
  // Print.
  screen('print', 'sample-lake', 'print'),
  screen('print', 'sample-sea', 'print'),
  {
    name: 'data-print-choices',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('print'),
      { click: '[data-p="tech"]' },
      ...snap('tech'),
      { click: '[data-p="title"]' },
      ...snap('no-title'),
      { click: BOOK_PAGES },
      ...snap('all'),
      { click: BOOK_PAGES },
      ...snap('none'),
      { click: '#doPrint' },
      ...snap('nothing-chosen'),
      { click: '[data-sel="days"]' },
      ...snap('days'),
      ...enter('more'),
      ...enter('print'),
      ...snap('kept'),
    ],
  },
  {
    name: 'data-print-book-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      NO_PRINT,
      ...enter('print'),
      { click: BOOK_PAGES },
      { click: '#doPrint' },
      { wait: 200 },
      ...snap('book'),
    ],
  },
  {
    name: 'data-print-book-lake',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      NO_PRINT,
      ...enter('print'),
      { click: BOOK_PAGES },
      { wait: 300 },
      { click: '#doPrint' },
      { wait: 200 },
      ...snap('book'),
    ],
  },
  // Files.
  screen('export', 'sample-lake', 'export'),
  screen('export', 'sample-sea', 'export'),
  {
    name: 'data-export-nothing',
    fixture: emptySeaCruise(),
    overrides: QUIET,
    steps: [
      ...enter('export'),
      ...snap('export'),
      { click: '#csvBtn' },
      ...snap('no-entry'),
      { click: '#csvDayBtn' },
      ...snap('no-day'),
    ],
  },
  {
    name: 'data-export-gpx',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      ...enter('export'),
      chooseFile('#gpxFile', GPX_TRACK),
      { wait: 300 },
      ...snap('plan'),
    ],
  },
  // No open cruise.
  {
    name: 'data-nonav-sea',
    fixture: 'empty',
    overrides: { ...QUIET, 'ldb.zoneSim': 'mer' },
    steps: [
      ...enter('new'),
      ...snap('new'),
      ...enter('day'),
      ...snap('day'),
      ...enter('log'),
      ...snap('log'),
      ...enter('print'),
      ...snap('print'),
      { click: '[data-newnav="mer"]' },
      ...snap('sea-form'),
    ],
  },
  {
    name: 'data-nonav-lake',
    fixture: 'empty',
    overrides: { ...QUIET, 'ldb.zoneSim': 'lac' },
    steps: [
      ...enter('new'),
      ...snap('new'),
      { click: '[data-newnav="lacc"]' },
      ...snap('lake-form'),
      ...enter('new'),
      { click: '[data-go="cruises"]' },
      ...snap('cruises'),
    ],
  },
];
