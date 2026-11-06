import type { Scenario } from '../types.ts';

import {
  CRUISE,
  IGNORE_NAME,
  english,
  here,
  quiet,
  track,
  unfolded,
  zones,
} from './mapFixtures.ts';

/** Leaflet numbers its tooltips with the counter of `IGNORE_NAME`. */
const fixedTooltipIds = `(() => {
  for (const element of document.querySelectorAll('[id^="leaflet-tooltip-"]')) {
    element.id = 'leaflet-tooltip';
  }
  for (const element of document.querySelectorAll('[aria-describedby^="leaflet-tooltip-"]')) {
    element.setAttribute('aria-describedby', 'leaflet-tooltip');
  }
})()`;

/** Offline zones, « Mes cartes », marks, and these screens in English. */
export const listScenarios: Scenario[] = [
  {
    name: 'map-zones-empty',
    fixture: 'empty',
    overrides: quiet,
    steps: [
      { wait: 2500 },
      { go: 'zones' },
      { wait: 1200 },
      { snapshot: 'page' },
    ],
  },
  {
    name: 'map-zones-list',
    fixture: 'sample-lake',
    overrides: { ...quiet, 'ldb.zones': zones },
    steps: [
      { wait: 2500 },
      { go: 'zones' },
      { wait: 1200 },
      { snapshot: 'page' },
      { click: '[data-z="15"]' },
      { wait: 300 },
      { snapshot: 'detail' },
      { click: '[data-show]' },
      { wait: 800 },
      { eval: fixedTooltipIds },
      { snapshot: 'shown' },
      { fill: '#zoneName', value: 'Ma zone' },
      { click: '[data-z="12"]' },
      { wait: 300 },
      { eval: fixedTooltipIds },
      { snapshot: 'named' },
    ],
  },
  {
    name: 'map-zones-download-fails',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 2500 },
      { go: 'zones' },
      { wait: 1200 },
      { click: '[data-z="12"]' },
      { wait: 200 },
      { click: '#zoneGo' },
      { wait: 2500 },
      { snapshot: 'failed' },
    ],
  },
  {
    name: 'map-cartes-empty',
    fixture: 'empty',
    overrides: quiet,
    steps: [
      { wait: 2500 },
      { go: 'cartes' },
      { wait: 300 },
      { snapshot: 'page' },
    ],
  },
  {
    name: 'map-cartes-list',
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      'ldb.zones': zones,
      ...unfolded('cartes', 'Cartes enregistrées', '🌐 Cartes en ligne'),
    },
    steps: [
      { wait: 2500 },
      { go: 'cartes' },
      { wait: 300 },
      { snapshot: 'page' },
      { click: '[data-cdel]' },
      { wait: 300 },
      { snapshot: 'ask' },
    ],
  },
  {
    name: 'map-cartes-no-position',
    fixture: 'empty',
    overrides: quiet,
    steps: [
      { wait: 2500 },
      { go: 'cartes' },
      { wait: 300 },
      { click: '#cartesGo' },
      { wait: 800 },
      { snapshot: 'refused' },
    ],
  },
  {
    name: 'map-marks-list',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 2500 },
      { go: 'marks' },
      { wait: 300 },
      { snapshot: 'list' },
    ],
  },
  {
    name: 'map-marks-open',
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      ...unfolded('marks', '📌 M011 · Large du cap Sicié'),
    },
    geolocation: here,
    steps: [
      { wait: 2500 },
      { go: 'marks' },
      { wait: 500 },
      { snapshot: 'open' },
      { click: '.mark-item:not(.folded) [data-mk="goto"]' },
      { wait: 500 },
      { snapshot: 'goto' },
      { click: '[data-mk="stopgo"]' },
      { wait: 400 },
      { snapshot: 'stopped' },
      { click: '.mark-item:not(.folded) [data-mk="del"]' },
      { wait: 200 },
      { snapshot: 'armed' },
      { click: '.mark-item:not(.folded) [data-mk="del"]' },
      { wait: 400 },
      { snapshot: 'deleted' },
    ],
  },
  {
    name: 'map-marks-show',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      ...unfolded('marks', '📌 M011 · Large du cap Sicié'),
    },
    steps: [
      { wait: 2500 },
      { go: 'marks' },
      { wait: 300 },
      { click: '.mark-item:not(.folded) [data-mk="show"]' },
      { wait: 1500 },
      { snapshot: 'tracker' },
    ],
  },
  {
    name: 'map-english-cartes',
    fixture: 'sample-lake',
    overrides: {
      ...english,
      'ldb.zones': zones,
      ...unfolded('cartes', 'Cartes enregistrées', '🌐 Cartes en ligne'),
    },
    steps: [
      { wait: 2500 },
      { go: 'cartes' },
      { wait: 300 },
      { snapshot: 'page' },
    ],
  },
  {
    name: 'map-english-marks',
    fixture: 'sample-lake',
    overrides: {
      ...english,
      ...unfolded('marks', '📌 M011 · Large du cap Sicié'),
    },
    steps: [
      { wait: 2500 },
      { go: 'marks' },
      { wait: 300 },
      { snapshot: 'page' },
    ],
  },
  {
    name: 'map-english-traces',
    fixture: 'sample-lake',
    overrides: { ...english, [`ldb.track.${CRUISE}`]: track(9) },
    steps: [
      { wait: 2500 },
      { go: 'traces' },
      { wait: 300 },
      { snapshot: 'page' },
    ],
  },
  {
    name: 'map-english-zones',
    fixture: 'sample-lake',
    overrides: { ...english, 'ldb.zones': zones },
    steps: [
      { wait: 2500 },
      { go: 'zones' },
      { wait: 1200 },
      { snapshot: 'page' },
    ],
  },
  {
    name: 'map-english-map',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: english,
    steps: [
      { wait: 2500 },
      { go: 'map' },
      { wait: 1500 },
      { snapshot: 'page' },
    ],
  },
  {
    name: 'map-marks-none',
    fixture: 'empty',
    overrides: { ...quiet, 'ldb.marks': [] },
    steps: [
      { wait: 2500 },
      { go: 'marks' },
      { wait: 300 },
      { snapshot: 'none' },
    ],
  },
];
