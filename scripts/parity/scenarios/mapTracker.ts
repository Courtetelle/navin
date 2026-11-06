import type { Scenario } from '../types.ts';

import { IGNORE_NAME, goto, here, quiet } from './mapFixtures.ts';

/** The tracker: boot in every state, Go to, long press menu. */
export const trackerScenarios: Scenario[] = [
  {
    name: 'map-tracker-empty',
    fixture: 'empty',
    overrides: quiet,
    steps: [{ wait: 3000 }, { snapshot: 'boot' }],
  },
  {
    name: 'map-tracker-lake',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [{ wait: 3000 }, { snapshot: 'boot' }],
  },
  {
    name: 'map-tracker-sea',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [{ wait: 3000 }, { snapshot: 'boot' }],
  },
  {
    name: 'map-tracker-simsea',
    fixture: 'sample-lake',
    overrides: { ...quiet, 'ldb.zoneSim': 'mer' },
    steps: [{ wait: 3000 }, { snapshot: 'boot' }],
  },
  {
    name: 'map-tracker-gps',
    fixture: 'sample-lake',
    overrides: quiet,
    geolocation: here,
    steps: [{ wait: 3000 }, { snapshot: 'boot' }],
  },
  {
    name: 'map-tracker-goto',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: { ...quiet, 'ldb.goto': goto },
    geolocation: here,
    steps: [
      { wait: 2500 },
      { go: 'tracker' },
      { wait: 1500 },
      { snapshot: 'redrawn' },
    ],
  },
  {
    name: 'map-tracker-goto-nogps',
    fixture: 'sample-lake',
    overrides: { ...quiet, 'ldb.goto': goto },
    steps: [
      { wait: 3000 },
      { snapshot: 'boot' },
      { click: '#gotoStop' },
      { snapshot: 'stopped' },
    ],
  },
  {
    name: 'map-tracker-longpress',
    fixture: 'sample-lake',
    overrides: quiet,
    geolocation: here,
    steps: [
      { wait: 3000 },
      { longpress: '#trkMap', ms: 900 },
      { wait: 400 },
      { snapshot: 'menu' },
      { click: '[data-lp="mark"]' },
      { wait: 500 },
      { snapshot: 'mark-saved' },
    ],
  },
  {
    name: 'map-tracker-longpress-goto',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 3000 },
      { longpress: '#trkMap', ms: 900 },
      { wait: 400 },
      { snapshot: 'menu-no-gps' },
      { click: '[data-lp="goto"]' },
      { wait: 500 },
      { snapshot: 'goto-set' },
    ],
  },
  {
    name: 'map-tracker-mark-popup',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 3000 },
      { click: '.mark-ic' },
      { wait: 500 },
      { snapshot: 'popup' },
    ],
  },
];
