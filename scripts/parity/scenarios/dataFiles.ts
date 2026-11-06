import type { Scenario } from '../types.ts';

import {
  CLOCK_TICKED,
  LEGACY_FILES,
  QUIET,
  SEA_DETAILS,
  SHOW_ICON_LINKS,
  SHOW_STORAGE,
  chooseFile,
  enter,
  fileOf,
  snap,
} from './dataSteps.ts';

/** Restoration of legacy backups, app icon, translated screens, fixtures of the file builders. */
export const fileScenarios: Scenario[] = [
  // A backup made by legacy restored by both apps: same storage, same screen.
  {
    name: 'data-restore-full-empty',
    fixture: 'empty',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      chooseFile('#allFile', fileOf('data-files-lake', '__backupAll')),
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('restored'),
    ],
  },
  {
    name: 'data-restore-full-merge',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      chooseFile('#allFile', fileOf('data-files-lake', '__backupAll')),
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('merged'),
    ],
  },
  {
    name: 'data-restore-cruise',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...enter('export'),
      chooseFile('#importFile', fileOf('data-files-sea', '__cruiseBackup')),
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('restored'),
    ],
  },
  {
    name: 'data-restore-sheets-only',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      chooseFile(
        '#allFile',
        JSON.stringify({
          all: true,
          version: 4,
          cruises: [],
          boats: [{ id: 'b-new', info: { boat: 'Nouveau' } }],
        }),
      ),
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('restored'),
    ],
  },
  {
    name: 'data-restore-invalid',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...enter('export'),
      chooseFile('#importFile', '{"app":"autre"}'),
      { wait: 300 },
      ...snap('refused'),
    ],
  },
  // App icon on a fresh boot: `ldb.iconData` and the links of the page.
  {
    name: 'data-icon-fresh-boot',
    fixture: {},
    overrides: QUIET,
    steps: [
      ...enter('more'),
      { wait: 800 },
      SHOW_ICON_LINKS,
      SHOW_STORAGE,
      ...snap('more'),
    ],
  },
  // Translated screens: the data tab is lit.
  ...['en', 'it', 'es'].flatMap((language) =>
    ['more', 'cruises', 'print', 'export', 'info', 'settings'].map(
      (view): Scenario => ({
        name: `data-translated-${view}-${language}`,
        fixture: 'sample',
        overrides: { ...QUIET, 'ldb.lang': language, 'ldb.lang2': language },
        steps: [...enter(view), ...snap(view)],
      }),
    ),
  ),
  {
    name: 'data-translated-nonav-en',
    fixture: 'empty',
    overrides: { ...QUIET, 'ldb.lang': 'en', 'ldb.lang2': 'en' },
    steps: [...enter('print'), ...snap('nonav')],
  },
  // Fixtures of the file builders: run with --only <name> --dump <fixture>.
  {
    name: 'data-dump-files-lake',
    fixture: 'sample',
    overrides: QUIET,
    steps: [LEGACY_FILES],
  },
  {
    name: 'data-dump-files-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [SEA_DETAILS, LEGACY_FILES],
  },
];
