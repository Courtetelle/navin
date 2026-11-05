import type { Scenario } from '../types.ts';

const done = { at: '2026-07-01T10:00:00.000Z', ok: 1, n: 1, done: true };
/**
 * No boot tip, and the built-in lake maps already kept: their download starts
 * 6 s after the boot and would otherwise change `#mapOffSub` by timing.
 */
const quiet = {
  'ldb.tipIdx': '6',
  'ldb.lakesBase': { leman: done, neuch: done, vd2: done, toldDone: true },
};
/**
 * Default ignored attributes plus `name`: the radio group of the layer selector
 * is numbered by Leaflet's internal counter, which depends on the tiles loaded
 * by the maps shown before.
 */
const IGNORE_NAME =
  '^name$|^data-(?!(theme|view|frame|val|key|b|pick|fiche|prep|photo|m|k|id|cs|cem|base)$)';
const CRUISE = 'mrltkr40tkny6';
const START = Date.parse('2026-07-15T08:40:00+02:00');

/** A track of `count` points every 60 s, south-west of Morges. */
function track(count: number, from = START): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  for (let index = 0; index < count; index++) {
    points.push([
      from + index * 60_000,
      46.505 - index * 0.002,
      6.497 - index * 0.0025,
    ]);
  }
  return points;
}

const twoTracks = [...track(6), ...track(5, START + 3_600_000)];
const zones = [
  {
    id: 'z1',
    name: 'Split – Hvar',
    b: { s: 43.1, n: 43.5, w: 16.2, e: 16.8 },
    zmax: 13,
    at: '2026-07-01T10:00:00.000Z',
    ok: 1200,
    ko: 3,
  },
  {
    id: 'z2',
    name: 'Autour de moi · 50 km',
    b: { s: 46, n: 46.9, w: 6, e: 7.2 },
    zmax: 12,
    at: '2026-07-02T10:00:00.000Z',
    ok: 900,
    km: 50,
    center: [46.45, 6.6],
  },
];
const trip = {
  start: START,
  from: 0,
  lochBase: 0,
  det: {
    turn: 30,
    every: 10,
    buf: [],
    dist: 1.2,
    lastSog: 4.2,
    lastCog: 123,
    lastPt: { lat: 46.49, lon: 6.48 },
  },
  dep: null,
  cands: [],
};
const showControls = `(() => {
  const edge = document.querySelector('.ctl-edge');
  const at = (x) => ({ bubbles: true, clientX: x, clientY: 300, pointerId: 1 });
  edge.dispatchEvent(new PointerEvent('pointerdown', at(5)));
  edge.dispatchEvent(new PointerEvent('pointermove', at(60)));
  edge.dispatchEvent(new PointerEvent('pointerup', at(60)));
})()`;
const goto = { lat: 46.45, lon: 6.55, name: 'M003 · Milieu du Grand-Lac' };
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
const bathy = {
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
const english = { ...quiet, 'ldb.lang': 'en', 'ldb.lang2': 'en' };
const here = { latitude: 46.5, longitude: 6.5 };
const NAVIN_TAB = '.top-tab[data-view="tracker"]';
const lastTrack = {
  ...quiet,
  [`ldb.track.${CRUISE}`]: track(8),
  [`ldb.lastTrip.${CRUISE}`]: {
    start: START,
    end: START + 480_000,
    from: 0,
    lochBase: 0,
    det: {
      turn: 30,
      every: 10,
      buf: [],
      dist: 1.2,
      lastSog: 4.2,
      lastCog: 123,
      lastPt: { lat: 46.49, lon: 6.48 },
    },
    dep: null,
    cands: [],
  },
};

function fold(view: string, title: string): Record<string, string> {
  return { 'ldb.folds2': JSON.stringify({ [`${view}|${title}`]: 0 }) };
}

export const scenarios: Scenario[] = [
  {
    name: 'map-tracker-empty',
    fixture: 'empty',
    overrides: quiet,
    steps: [{ wait: 1500 }, { snapshot: 'boot' }],
  },
  {
    name: 'map-tracker-lake',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [{ wait: 1500 }, { snapshot: 'boot' }],
  },
  {
    name: 'map-tracker-sea',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [{ wait: 1500 }, { snapshot: 'boot' }],
  },
  {
    name: 'map-tracker-simsea',
    fixture: 'sample-lake',
    overrides: { ...quiet, 'ldb.zoneSim': 'mer' },
    steps: [{ wait: 1500 }, { snapshot: 'boot' }],
  },
  {
    name: 'map-tracker-gps',
    fixture: 'sample-lake',
    overrides: quiet,
    geolocation: here,
    steps: [{ wait: 1500 }, { snapshot: 'boot' }],
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
      { wait: 1500 },
      { snapshot: 'boot' },
      { click: '#gotoStop' },
      { wait: 500 },
      { snapshot: 'stopped' },
    ],
  },
  {
    name: 'map-tracker-longpress',
    fixture: 'sample-lake',
    overrides: quiet,
    geolocation: here,
    steps: [
      { wait: 1500 },
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
      { wait: 1500 },
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
      { wait: 1500 },
      { click: '.mark-ic' },
      { wait: 500 },
      { snapshot: 'popup' },
    ],
  },
  {
    name: 'map-tracker-choose',
    fixture: 'sample-lake',
    overrides: lastTrack,
    steps: [
      { wait: 1500 },
      { snapshot: 'boot' },
      { click: NAVIN_TAB },
      { wait: 200 },
      { click: NAVIN_TAB },
      { wait: 200 },
      { snapshot: 'start-staged' },
      { longpress: NAVIN_TAB, ms: 800 },
      { wait: 500 },
      { snapshot: 'choose' },
      { click: '#trkCancel' },
      { wait: 300 },
      { snapshot: 'cancelled' },
    ],
  },
  {
    name: 'map-tracker-choose-new',
    fixture: 'sample-lake',
    overrides: lastTrack,
    geolocation: here,
    steps: [
      { wait: 1500 },
      { click: NAVIN_TAB },
      { wait: 200 },
      { click: NAVIN_TAB },
      { wait: 200 },
      { longpress: NAVIN_TAB, ms: 800 },
      { wait: 500 },
      { click: '#trkNew' },
      { wait: 1000 },
      { snapshot: 'recording' },
    ],
  },
  {
    name: 'map-tracker-choose-extend',
    fixture: 'sample-lake',
    overrides: lastTrack,
    geolocation: here,
    steps: [
      { wait: 1500 },
      { click: NAVIN_TAB },
      { wait: 200 },
      { click: NAVIN_TAB },
      { wait: 200 },
      { longpress: NAVIN_TAB, ms: 800 },
      { wait: 500 },
      { click: '#trkExtend' },
      { wait: 1000 },
      { snapshot: 'recording' },
    ],
  },
  {
    name: 'map-tracker-denied',
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      [`ldb.track.${CRUISE}`]: track(8),
      [`ldb.trip.${CRUISE}`]: trip,
    },
    steps: [{ wait: 1500 }, { snapshot: 'denied' }],
  },
  {
    name: 'map-tracker-recording',
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      [`ldb.track.${CRUISE}`]: track(8),
      [`ldb.trip.${CRUISE}`]: trip,
    },
    geolocation: here,
    steps: [
      { wait: 2500 },
      { go: 'tracker' },
      { wait: 1500 },
      { snapshot: 'recording' },
      { click: NAVIN_TAB },
      { wait: 200 },
      { longpress: NAVIN_TAB, ms: 800 },
      { wait: 700 },
      { snapshot: 'point' },
    ],
  },
  {
    name: 'map-tracker-night',
    fixture: 'sample-lake',
    overrides: { ...quiet, 'ldb.settings': { theme: 'night' } },
    steps: [{ wait: 1500 }, { snapshot: 'night' }],
  },
  {
    name: 'map-tracker-controls',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 1500 },
      { eval: showControls },
      { wait: 300 },
      { snapshot: 'shown' },
      { click: '.map-locate-btn' },
      { wait: 700 },
      { snapshot: 'located' },
      { click: '.leaflet-control-zoom-in' },
      { wait: 700 },
      { snapshot: 'zoomed' },
      { click: '.ctl-hide-btn' },
      { wait: 300 },
      { snapshot: 'hidden' },
    ],
  },
  {
    name: 'map-tracker-fullscreen',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 1500 },
      { eval: showControls },
      { wait: 300 },
      { click: '.map-full-btn:not(.map-locate-btn):not(.ctl-hide-btn)' },
      { wait: 700 },
      { snapshot: 'full' },
      { click: '.map-full-btn:not(.map-locate-btn):not(.ctl-hide-btn)' },
      { wait: 700 },
      { snapshot: 'normal' },
    ],
  },
  {
    name: 'map-tracker-zone-cycle',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 1500 },
      { longpress: NAVIN_TAB, ms: 800 },
      { wait: 700 },
      { snapshot: 'next-zone' },
    ],
  },
  {
    name: 'map-chart-vector',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: { ...quiet, ...chartStorage },
    steps: [
      { wait: 2500 },
      { eval: seedChart },
      { eval: 'setTimeout(() => location.reload(), 50)' },
      { wait: 3500 },
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
  {
    name: 'map-traces-empty',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 2500 },
      { go: 'traces' },
      { wait: 300 },
      { snapshot: 'list' },
    ],
  },
  {
    name: 'map-traces-list',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: {
      ...quiet,
      [`ldb.track.${CRUISE}`]: twoTracks,
      [`ldb.trkSegs.${CRUISE}`]: [6],
    },
    steps: [
      { wait: 2500 },
      { go: 'traces' },
      { wait: 300 },
      { snapshot: 'list' },
      { click: '[data-show]' },
      { wait: 700 },
      { snapshot: 'shown' },
    ],
  },
  {
    name: 'map-traces-single',
    fixture: 'sample-lake',
    overrides: { ...quiet, [`ldb.track.${CRUISE}`]: track(9) },
    steps: [
      { wait: 2500 },
      { go: 'traces' },
      { wait: 300 },
      { snapshot: 'list' },
    ],
  },
  {
    name: 'map-map-lake',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { wait: 2500 },
      { go: 'map' },
      { wait: 1500 },
      { snapshot: 'all' },
      { click: '[data-md="1"]' },
      { wait: 1500 },
      { snapshot: 'day' },
      { click: '#mapFit' },
      { wait: 700 },
      { snapshot: 'fit' },
      { click: '[data-md="all"]' },
      { wait: 1500 },
      { snapshot: 'back-all' },
    ],
  },
  {
    name: 'map-map-sea',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { wait: 2500 },
      { go: 'map' },
      { wait: 1500 },
      { snapshot: 'all' },
      { click: '[data-md="-1"]' },
      { wait: 1500 },
      { snapshot: 'last-day' },
      { click: '[data-md="-1"]' },
      { wait: 1500 },
      { snapshot: 'first-day' },
    ],
  },
  {
    name: 'map-map-day-arg',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { wait: 2500 },
      { go: 'map', arg: '2026-07-14' },
      { wait: 1500 },
      { snapshot: 'day' },
    ],
  },
  {
    name: 'map-map-lakes-pending',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: { 'ldb.tipIdx': '6' },
    steps: [{ go: 'map' }, { wait: 300 }, { snapshot: 'note' }],
  },
  {
    name: 'map-map-track',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: { ...quiet, [`ldb.track.${CRUISE}`]: track(9) },
    steps: [
      { wait: 2500 },
      { go: 'map' },
      { wait: 1500 },
      { snapshot: 'track' },
    ],
  },
  {
    name: 'map-map-follow',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-lake',
    overrides: quiet,
    geolocation: here,
    steps: [
      { wait: 2500 },
      { go: 'map' },
      { wait: 1500 },
      { click: '#mapMe' },
      { wait: 1200 },
      { snapshot: 'following' },
      { click: '#mapMe' },
      { wait: 500 },
      { snapshot: 'stopped' },
    ],
  },
  {
    name: 'map-map-popup',
    ignoreAttributes: IGNORE_NAME,
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { wait: 2500 },
      { go: 'map' },
      { wait: 1500 },
      {
        eval: "document.querySelector('.leaflet-interactive')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))",
      },
      { wait: 500 },
      { snapshot: 'popup' },
    ],
  },
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
      { snapshot: 'shown' },
      { fill: '#zoneName', value: 'Ma zone' },
      { click: '[data-z="12"]' },
      { wait: 300 },
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
      'ldb.folds2': JSON.stringify({
        'cartes|Cartes enregistrées': 0,
        'cartes|🌐 Cartes en ligne': 0,
      }),
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
    overrides: { ...quiet, ...fold('marks', '📌 M011 · Large du cap Sicié') },
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
    overrides: { ...quiet, ...fold('marks', '📌 M011 · Large du cap Sicié') },
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
      'ldb.folds2': JSON.stringify({
        'cartes|Cartes enregistrées': 0,
        'cartes|🌐 Cartes en ligne': 0,
      }),
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
      ...fold('marks', '📌 M011 · Large du cap Sicié'),
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
