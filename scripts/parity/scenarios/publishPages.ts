import type { Scenario } from '../types.ts';

import {
  QUIET,
  ROW_STEPS,
  TRACK,
  TRACK_CRUISE,
  pageScenario,
} from './publishSteps.ts';

/** The Publier row and window reached from the real list pages. */
export const pageScenarios: Scenario[] = [
  pageScenario('people', ROW_STEPS),
  pageScenario('crews', ROW_STEPS),
  pageScenario('ckbases', ROW_STEPS),
  pageScenario('soslogs', ROW_STEPS),
  pageScenario('marks', ROW_STEPS),
  pageScenario('traces', ROW_STEPS, {
    [`ldb.track.${TRACK_CRUISE}`]: TRACK,
  }),
  pageScenario(
    'dossier',
    [
      { click: '#dosPub' },
      { snapshot: 'pub-modal' },
      { click: '[data-pmclose]' },
      { snapshot: 'closed' },
    ],
    {},
    'exb1',
  ),
  {
    name: 'publish-page-soslogs-share',
    fixture: 'sample-lake',
    overrides: QUIET,
    settle: 300,
    steps: [
      { go: 'soslogs' },
      { wait: 1200 },
      { click: 'details.section summary' },
      { click: '[data-share]' },
      { snapshot: 'window-one-log' },
    ],
  },
  {
    name: 'publish-page-fiche',
    fixture: 'sample-lake',
    overrides: QUIET,
    settle: 300,
    steps: [
      { go: 'people' },
      { wait: 1200 },
      { click: '[data-fiche="ex2"]' },
      { wait: 600 },
      { click: '#fImg' },
      { snapshot: 'window-one-card' },
    ],
  },
  {
    name: 'publish-page-boats',
    fixture: 'sample-lake',
    overrides: QUIET,
    settle: 300,
    steps: [
      { go: 'boats', arg: 'exb1' },
      { wait: 1200 },
      { click: '[data-bpub="exb1"]' },
      { snapshot: 'window-one-boat' },
    ],
  },
  {
    name: 'publish-page-people-english',
    fixture: 'sample-lake',
    overrides: { ...QUIET, 'ldb.lang': 'en' },
    settle: 300,
    steps: [{ go: 'people' }, { wait: 1200 }, { snapshot: 'row' }],
  },
  pageScenario('crew', [
    { click: '#crewPub' },
    { snapshot: 'pub-modal' },
    { click: '[data-pmclose]' },
    { snapshot: 'closed' },
  ]),
];
