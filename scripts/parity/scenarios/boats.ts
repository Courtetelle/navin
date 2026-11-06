import type { Scenario, Step } from '../types.ts';

import { dossierScenarios } from './boatsDossier.ts';
import { sheetScenarios } from './boatsSheet.ts';
import {
  ARMED_GONE,
  BOOT,
  FIRST_LOAD,
  LAKE_ID,
  MARQUEE_DONE,
  QUIET,
  TOAST_GONE,
  boatsWith,
  docsBoat,
  dump,
  seedPhotos,
  swipe,
  swipeAndHold,
  versionBoat,
} from './boatsSteps.ts';

/** Mes bateaux. */
const listScenarios: Scenario[] = [
  {
    name: 'boats-list-empty',
    fixture: 'empty',
    overrides: QUIET,
    steps: [BOOT, { go: 'boats' }, FIRST_LOAD, { snapshot: 'list' }],
  },
  {
    name: 'boats-list-sample',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      { go: 'boats' },
      FIRST_LOAD,
      { snapshot: 'list' },
      { go: 'boats', arg: 'savannah' },
      { snapshot: 'open-savannah' },
      { click: 'details[data-b="exb1"] > summary' },
      { snapshot: 'open-two' },
    ],
  },
  {
    name: 'boats-edit',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      { go: 'boats', arg: 'savannah' },
      FIRST_LOAD,
      { fill: '[data-form="savannah"] [data-k="boat"]', value: 'Savannah II' },
      { fill: '[data-form="savannah"] [data-k="model"]', value: 'Hanse 345' },
      dump('ldb.boats', `ldb.cruise.${LAKE_ID}`),
      { snapshot: 'edited' },
      { go: 'boats' },
      { snapshot: 'list-after' },
    ],
  },
  {
    name: 'boats-add',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      { go: 'boats' },
      FIRST_LOAD,
      { click: '#addBoat' },
      { wait: 300 },
      { snapshot: 'added' },
      dump('ldb.boats'),
      { snapshot: 'added-stored' },
    ],
  },
  {
    name: 'boats-delete',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      { go: 'boats', arg: 'exb1' },
      FIRST_LOAD,
      { click: '[data-del="exb1"]' },
      { snapshot: 'asking' },
      { longpress: '[data-del="exb1"]' },
      { wait: 500 },
      dump('ldb.boats'),
      { snapshot: 'deleted' },
    ],
  },
  {
    name: 'boats-swipe',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      { go: 'boats' },
      FIRST_LOAD,
      swipe('details[data-b="exb1"] > summary'),
      { snapshot: 'confirm' },
      { wait: 5500 },
      { snapshot: 'closed' },
      swipeAndHold('details[data-b="exb1"] > summary'),
      TOAST_GONE,
      dump('ldb.boats'),
      { snapshot: 'deleted' },
    ],
  },
  {
    name: 'boats-publish',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      { go: 'boats', arg: 'savannah' },
      FIRST_LOAD,
      { click: '[data-bpub="savannah"]' },
      { snapshot: 'window' },
    ],
  },
  {
    name: 'boats-docs',
    fixture: 'sample-lake',
    overrides: {
      ...QUIET,
      'ldb.boats': boatsWith('sample-lake', { savannah: docsBoat }),
    },
    steps: [
      BOOT,
      seedPhotos,
      { go: 'boats' },
      FIRST_LOAD,
      { snapshot: 'thumb' },
      { go: 'boats', arg: 'savannah' },
      { snapshot: 'open' },
      { fill: '[data-dcap="doc1"]', value: 'Permis  ' },
      dump('ldb.boats'),
      { snapshot: 'caption' },
      { click: '[data-bpthumb="doc2"]' },
      TOAST_GONE,
      { snapshot: 'other-thumb' },
      { click: '[data-bpthumb="doc2"]' },
      TOAST_GONE,
      dump('ldb.boats'),
      { snapshot: 'no-thumb' },
      { click: '[data-bpdel="doc2"]' },
      { snapshot: 'asking' },
      { longpress: '[data-bpdel="doc2"]' },
      TOAST_GONE,
      dump('ldb.boats'),
      { snapshot: 'deleted' },
    ],
  },
  {
    name: 'boats-versions',
    fixture: 'sample-lake',
    overrides: {
      ...QUIET,
      'ldb.boats': boatsWith('sample-lake', { savannah: versionBoat }),
    },
    steps: [
      BOOT,
      { go: 'boats', arg: 'savannah' },
      FIRST_LOAD,
      { snapshot: 'button' },
      { click: '[data-vers="savannah"]' },
      { snapshot: 'versions' },
      { click: '[data-vput="0"]' },
      { snapshot: 'armed' },
      ARMED_GONE,
      { click: '[data-vput="0"]' },
      { click: '[data-vput="0"]' },
      TOAST_GONE,
      dump('ldb.boats', `ldb.cruise.${LAKE_ID}`),
      { snapshot: 'restored' },
    ],
  },
  {
    name: 'boats-fields',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      BOOT,
      { go: 'boats', arg: 'savannah' },
      FIRST_LOAD,
      { click: '[data-fields="savannah"]' },
      MARQUEE_DONE,
      { snapshot: 'fields' },
      { click: '#cBack' },
      { wait: 300 },
      { snapshot: 'back' },
    ],
  },
];

/**
 * Before each snapshot: the random suffix of the form ids is dropped (a React
 * render restarted on a first visit draws a second series of them), and the
 * scroll position is written in the DOM, so that a snapshot compares it. The
 * page then goes back to the top: a full-page capture does not always place
 * fixed elements at the scroll offset, whatever the app.
 */
const beforeSnapshot: Step = {
  eval: `(() => {
    for (const node of document.querySelectorAll('[id^="f_"]')) {
      node.id = node.id.replace(/_[a-z0-9]{1,4}$/, '');
    }
    for (const node of document.querySelectorAll('label[for^="f_"]')) {
      node.htmlFor = node.htmlFor.replace(/_[a-z0-9]{1,4}$/, '');
    }
    let scroll = document.getElementById('parity-scroll');
    if (!scroll) {
      scroll = document.createElement('pre');
      scroll.id = 'parity-scroll';
      scroll.hidden = true;
      document.body.append(scroll);
    }
    scroll.textContent = String(Math.round(globalThis.scrollY));
    globalThis.scrollTo(0, 0);
  })()`,
};

/** Back to where the page was, for the steps that follow. */
const afterSnapshot: Step = {
  eval: `globalThis.scrollTo(
    0,
    Number(document.getElementById('parity-scroll').textContent),
  )`,
};

function comparable(scenario: Scenario): Scenario {
  return {
    ...scenario,
    steps: scenario.steps.flatMap((step) =>
      'snapshot' in step ? [beforeSnapshot, step, afterSnapshot] : [step],
    ),
  };
}

/** Boats domain: Mes bateaux, the lake day sheet and the boats collection. */
export const scenarios: Scenario[] = [
  ...listScenarios,
  ...sheetScenarios,
  ...dossierScenarios,
].map((scenario) => comparable(scenario));
