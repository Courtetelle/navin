import type { Scenario } from '../types.ts';

import { IGNORE_NAME, quiet } from './mapFixtures.ts';

const AT = '2026-07-01T10:00:00.000Z';
const seamarkType = (type: string, extra: Record<string, string> = {}) => ({
  'seamark:type': type,
  ...extra,
});
/** One feature of each kind the vector chart draws. */
const vector = {
  at: AT,
  feats: [
    {
      k: 'light_minor',
      g: 'p',
      c: [46.44, 6.56],
      t: seamarkType('light_minor', {
        'seamark:light:colour': 'red',
        'seamark:light:character': 'Fl',
        name: 'Feu A',
      }),
    },
    {
      k: 'buoy_lateral',
      g: 'p',
      c: [46.42, 6.54],
      t: seamarkType('buoy_lateral', {
        'seamark:buoy_lateral:colour': 'green;white',
      }),
    },
    {
      k: 'harbour',
      g: 'a',
      c: [
        [46.45, 6.5],
        [46.45, 6.52],
        [46.47, 6.52],
        [46.45, 6.5],
      ],
      t: { name: 'Port test' },
    },
    {
      k: 'ferry',
      g: 'p',
      c: [46.46, 6.6],
      t: { name: 'CGN', operator: 'CGN' },
    },
    {
      k: 'pier',
      g: 'l',
      c: [
        [46.43, 6.6],
        [46.44, 6.61],
      ],
      t: {},
    },
    {
      k: 'restricted_area',
      g: 'a',
      c: [
        [46.4, 6.6],
        [46.4, 6.62],
        [46.42, 6.62],
        [46.4, 6.6],
      ],
      t: seamarkType('restricted_area'),
    },
    {
      k: 'cable_submarine',
      g: 'l',
      c: [
        [46.38, 6.5],
        [46.39, 6.6],
      ],
      t: seamarkType('cable_submarine'),
    },
    { k: 'mooring', g: 'p', c: [46.41, 6.52], t: seamarkType('mooring') },
    {
      k: 'small_craft_facility',
      g: 'p',
      c: [46.4, 6.5],
      t: seamarkType('small_craft_facility'),
    },
  ],
  shore: [
    [
      [46.4318, 6.3],
      [46.4318, 6.8],
      [46.2, 6.8],
      [46.2, 6.3],
      [46.4318, 6.3],
    ],
  ],
};
export const bathy = {
  at: AT,
  files: ['test.asc'],
  lines: [
    [2, 46.4295, 6.54, 46.4295, 6.55, 46.4295, 6.56, 46.4295, 6.57],
    [10, 46.4305, 6.54, 46.4305, 6.55, 46.4305, 6.56, 46.4305, 6.57],
  ],
};
const chartStorage = {
  'ldb.lemanVecAt': { at: AT, n: vector.feats.length },
  'ldb.bathyAscAt': { at: AT, n: bathy.lines.length, files: bathy.files },
};
/** Fill `ldb-docs` as a download and an import would. */
const seedChart = `new Promise((done) => {
  const open = indexedDB.open('ldb-docs', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('d');
  open.onsuccess = () => {
    const transaction = open.result.transaction('d', 'readwrite');
    const documents = transaction.objectStore('d');
    documents.put(${JSON.stringify(vector)}, 'leman-osm');
    documents.put(${JSON.stringify(bathy)}, 'bathy-asc');
    transaction.oncomplete = () => done();
  };
})`;

/** Lake Geneva vector chart and depth lines. */
export const chartScenarios: Scenario[] = [
  {
    name: 'map-chart-vector',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: { ...quiet, ...chartStorage },
    steps: [
      { wait: 2500 },
      { eval: seedChart },
      { eval: 'setTimeout(() => location.reload(), 50)' },
      { wait: 7000 },
      { snapshot: 'tracker' },
      { longpress: '#trkMap', ms: 900 },
      { wait: 400 },
      { snapshot: 'depth-menu' },
      { click: '.leaflet-popup-close-button' },
      { wait: 400 },
      { click: '#trkMap' },
      { wait: 500 },
      { snapshot: 'shore-popup' },
      { go: 'map' },
      { wait: 1500 },
      { snapshot: 'map-page' },
    ],
  },
  {
    name: 'map-chart-wms',
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      'ldb.vdIsobath': {
        at: Date.parse('2026-07-15T08:00:00+02:00'),
        layers: [{ name: 'isobathes', title: 'Isobathes' }],
      },
    },
    steps: [{ wait: 2000 }, { snapshot: 'tracker' }],
  },
];
