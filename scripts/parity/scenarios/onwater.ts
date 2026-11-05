import type { Scenario } from '../types.ts';

const quiet = { 'ldb.tipIdx': '6' };

// A full-page screenshot paints the fixed chrome at the scroll offset, and
// Playwright's scroll into view can differ by a pixel between the two apps.
const top = { eval: 'scrollTo(0, 0)' };

// Writes into today's sheet of the open cruise, then reloads the app.
function seedDay(values: Record<string, unknown>): string {
  return `(() => {
    const key = 'ldb.cruise.' + JSON.parse(localStorage.getItem('ldb.current'));
    const cruise = JSON.parse(localStorage.getItem(key));
    cruise.days['2026-07-15'] = { ...cruise.days['2026-07-15'], ...${JSON.stringify(values)} };
    localStorage.setItem(key, JSON.stringify(cruise));
    location.reload();
  })()`;
}

const NOW = Date.parse('2026-07-15T10:30:00+02:00');

const FORECAST = {
  src: 'Modèle MeteoSwiss ICON-CH1 (1 km)',
  rows: [
    {
      t: NOW - 3_600_000,
      tws: 8,
      twd: 40,
      gust: 12,
      air: 21,
      rain: 0,
      cape: 0,
    },
    { t: NOW, tws: 11.4, twd: 44.6, gust: 17.2, air: 22, rain: 0.4, cape: 350 },
    {
      t: NOW + 3_600_000,
      tws: 14,
      twd: 50,
      gust: null,
      air: 23,
      rain: 1.2,
      cape: 900,
    },
    {
      t: NOW + 7_200_000,
      tws: 16,
      twd: null,
      gust: 28,
      air: 23,
      rain: 0,
      cape: 1600,
    },
  ],
};

const WEATHER_LAKE = {
  wxNow: {
    at: NOW,
    meas: {
      tws: 12.4,
      gust: 18.9,
      twd: 45.2,
      baro: 1013.4,
      air: 21.34,
      rain: 0,
      at: NOW - 600_000,
      station: 'Bouveret',
      km: 3.2,
      src: 'Mesure MeteoSwiss, station Bouveret (3 km), 10:20',
    },
    fc: FORECAST,
  },
  windWatch: {
    at: NOW,
    top: {
      name: 'Bouveret',
      km: 3.2,
      t: NOW - 600_000,
      avg: 12.4,
      gust: 18.9,
      dir: 45,
    },
    basis: 'gust',
    n: 3,
    src: 'smn',
  },
};

const WEATHER_FORECAST_ONLY = {
  wxNow: { at: NOW, meas: null, fc: FORECAST },
  windWatch: {
    at: NOW,
    top: {
      name: 'Nyon / Changins',
      km: 12,
      t: NOW,
      avg: 9,
      gust: null,
      dir: null,
    },
    basis: 'gust',
    n: 1,
    src: 'smn',
  },
};

const WIND_MODEL = {
  windWatch: {
    at: NOW,
    top: {
      name: 'ECMWF IFS 9 km',
      model: 'ecmwf_ifs',
      t: NOW,
      avg: 18,
      gust: 26,
      dir: 310,
    },
    basis: 'gust',
    n: 2,
    src: 'model',
    region: 'Égée, Turquie',
    bias: 5,
    names: ['DWD ICON-EU 7 km', 'ECMWF IFS 9 km'],
    waveH: 1.3,
    douglas: 4,
  },
};

// A document kept in the app, written straight into the `ldb-docs` database.
const SEED_DOCUMENT = `new Promise((done) => {
  const open = indexedDB.open('ldb-docs', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('d');
  open.onsuccess = () => {
    const transaction = open.result.transaction('d', 'readwrite');
    transaction.objectStore('d').put({ name: 'permis.pdf', type: 'application/pdf', blob: new Blob(['x']), at: '2026-07-10T08:00:00.000Z' }, 'permis');
    transaction.oncomplete = () => { open.result.close(); done(); location.reload(); };
  };
})`;

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// Two stored photos and a third one missing from the phone, on a journal entry.
const SEED_PHOTOS = `new Promise((done) => {
  const key = 'ldb.cruise.' + JSON.parse(localStorage.getItem('ldb.current'));
  const cruise = JSON.parse(localStorage.getItem(key));
  const photo = (id, minute) => ({ id, t: '2026-07-15T08:' + minute + ':00.000Z', day: '2026-07-15', ctx: 'nav' });
  cruise.photos = [photo('ph1', '10'), photo('ph2', '15'), photo('ph3', '20')];
  cruise.entries.push({ id: 'ph-e', t: '2026-07-15T08:25:00.000Z', v: { evt: ['Photo'], photos: ['ph1', 'ph2', 'ph3'] } });
  localStorage.setItem(key, JSON.stringify(cruise));
  const open = indexedDB.open('ldb-photos', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('p');
  open.onsuccess = () => {
    const transaction = open.result.transaction('p', 'readwrite');
    transaction.objectStore('p').put('${PIXEL}', 'ph1');
    transaction.objectStore('p').put('${PIXEL}', 'ph2');
    transaction.oncomplete = () => { open.result.close(); done(); location.reload(); };
  };
})`;

export const scenarios: Scenario[] = [
  {
    name: 'onwater-rules',
    fixture: 'empty',
    overrides: quiet,
    steps: [
      { go: 'rules' },
      { wait: 700 },
      { snapshot: 'rules' },
      { click: 'details.rules:nth-of-type(2) summary' },
      top,
      { snapshot: 'rules-open' },
    ],
  },
  {
    name: 'onwater-docs',
    fixture: 'empty',
    overrides: quiet,
    steps: [
      { go: 'docs' },
      { wait: 700 },
      { snapshot: 'docs' },
      { click: 'section[data-doc="rpp"] h2' },
      top,
      { snapshot: 'docs-open' },
      { click: '[data-keep="rpp"]' },
      top,
      { snapshot: 'docs-fetch-refused' },
    ],
  },
  {
    name: 'onwater-stats-empty',
    fixture: 'empty',
    overrides: quiet,
    steps: [
      // Legacy reads the zone before opening the cruise, until the next clock tick.
      { wait: 10_500 },
      { go: 'stats' },
      { wait: 700 },
      { snapshot: 'stats' },
    ],
  },
  {
    name: 'onwater-stats-lake',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { go: 'stats' },
      { wait: 700 },
      { snapshot: 'stats' },
      { click: '[data-sp="semaine"]' },
      top,
      { snapshot: 'stats-week' },
      { click: '[data-sp="annee"]' },
      top,
      { snapshot: 'stats-year' },
      { click: '[data-sb="savannah"]' },
      top,
      { snapshot: 'stats-boat' },
      { click: '[data-sb="exb1"]' },
      top,
      { snapshot: 'stats-boat-none-extra' },
      { click: '[data-sb="savannah"]' },
      top,
      { snapshot: 'stats-other-boat' },
      { click: '[data-sb=""]' },
      top,
      { snapshot: 'stats-all' },
    ],
  },
  {
    name: 'onwater-aboard-sea',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { go: 'aboard' },
      { wait: 700 },
      { snapshot: 'aboard' },
      { click: '.aboard-day.today h2' },
      top,
      { snapshot: 'today-open' },
      { click: '.aboard-day.today .aboard-done' },
      top,
      { snapshot: 'task-done' },
      { click: '.aboard-day.today .aboard-who' },
      top,
      { snapshot: 'pick' },
      { click: '[data-c="2"]' },
      top,
      { snapshot: 'picked' },
      { click: '[data-reset]' },
      top,
      { snapshot: 'reset-armed' },
      { click: '[data-reset]' },
      top,
      { snapshot: 'reset' },
      { click: '[data-edit]' },
      top,
      { snapshot: 'edit' },
      { click: '#ttDone' },
      top,
      { snapshot: 'back-to-plan' },
    ],
  },
  {
    name: 'onwater-aboard-unnamed',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      {
        eval: `(() => { const k = 'ldb.cruise.mrltkr40tkny6'; const c = JSON.parse(localStorage.getItem(k)); c.crew = []; c.info.du = '2026-07-20'; c.info.au = '2026-07-23'; localStorage.setItem(k, JSON.stringify(c)); location.reload(); })()`,
      },
      { wait: 2500 },
      { go: 'aboard' },
      { wait: 700 },
      { snapshot: 'future' },
      { click: 'section.field h2' },
      { click: '[data-n="1"]' },
      top,
      { snapshot: 'plus-one' },
      { click: '[data-n="-1"]' },
      top,
      { snapshot: 'minus-one' },
    ],
  },
  {
    name: 'onwater-tasktpl',
    fixture: 'empty',
    overrides: quiet,
    steps: [
      { go: 'tasktpl' },
      { wait: 700 },
      { snapshot: 'tasktpl' },
      { click: '.fold-h' },
      { fill: '#ttNew', value: 'Quart de nuit' },
      { click: '#ttAdd' },
      top,
      { snapshot: 'added' },
      { click: '[data-up="5"]' },
      top,
      { snapshot: 'moved-up' },
      { fill: '[data-tname="0"]', value: 'Café du matin' },
      top,
      { snapshot: 'renamed' },
      { click: '[data-del="1"]' },
      top,
      { snapshot: 'delete-armed' },
      { click: '[data-del="1"]' },
      top,
      { snapshot: 'deleted' },
      { click: '#ttDefault' },
      top,
      { snapshot: 'default-armed' },
      { click: '#ttDefault' },
      top,
      { snapshot: 'default' },
      { click: '#ttDone' },
      top,
      { snapshot: 'done-no-cruise' },
    ],
  },
  {
    name: 'onwater-lake-buttons-lake',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { go: 'new' },
      { wait: 700 },
      { snapshot: 'new' },
      { click: '[data-prop="sail"]' },
      top,
      { snapshot: 'sail-on' },
      { click: '[data-set="allure"][data-val="Largue"]' },
      top,
      { snapshot: 'allure' },
      { click: '[data-set="gv"][data-val="1 ris"]' },
      top,
      { snapshot: 'mainsail' },
      { click: '[data-set="gv"][data-val="1 ris"]' },
      top,
      { snapshot: 'already-noted' },
      { click: '[data-prop="motor"]' },
      top,
      { snapshot: 'sail-and-engine' },
      { click: '[data-prop="sail"]' },
      top,
      { snapshot: 'engine-only' },
      { click: '[data-prop="motor"]' },
      top,
      { snapshot: 'engine-off' },
      { click: '[data-lev="bain"]' },
      top,
      { snapshot: 'bathing' },
      { click: '[data-lev="bainFin"]' },
      top,
      { snapshot: 'bath-end' },
      { click: '[data-black]' },
      { click: '[data-black]' },
      top,
      { snapshot: 'black-noted' },
      { click: '[data-wx]' },
      top,
      { snapshot: 'weather-no-gps' },
    ],
  },
  {
    name: 'onwater-black-armed',
    fixture: 'sample-lake',
    overrides: quiet,
    settle: 30,
    steps: [
      { go: 'new' },
      { wait: 1200 },
      { click: '[data-black]' },
      { snapshot: 'armed' },
    ],
  },
  {
    name: 'onwater-lake-buttons-sea',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { go: 'new' },
      { wait: 700 },
      { snapshot: 'new' },
      { click: '[data-prop="sail"]' },
      top,
      { snapshot: 'sail-on' },
      { click: '[data-set="avant"][data-val="Foc"]' },
      top,
      { snapshot: 'headsail' },
    ],
  },
  {
    name: 'onwater-wind-alert',
    fixture: 'sample-lake',
    overrides: quiet,
    settle: 300,
    steps: [
      { go: 'new' },
      { wait: 700 },
      { click: '[data-walert="basis"]' },
      top,
      { snapshot: 'basis-mean' },
      { click: '[data-walert="basis"]' },
      { click: '[data-walert="mute"]' },
      top,
      { snapshot: 'mute-no-track' },
      { click: '[data-walert="toggle"]' },
      top,
      { snapshot: 'alerts-off' },
      { click: '[data-walert="toggle"]' },
      top,
      { snapshot: 'alerts-on' },
    ],
  },
  {
    name: 'onwater-wind-flash',
    fixture: 'sample-lake',
    overrides: quiet,
    settle: 30,
    steps: [
      { go: 'new' },
      { wait: 1200 },
      { click: '[data-walert="test"]' },
      { snapshot: 'flash' },
    ],
  },
  {
    name: 'onwater-wind-test',
    fixture: 'sample-lake',
    overrides: quiet,
    settle: 300,
    steps: [
      { go: 'new' },
      { wait: 700 },
      { click: '[data-walert="test"]' },
      { wait: 3000 },
      top,
      { snapshot: 'bubble-level-0' },
      { click: '#windPop' },
      { wait: 3200 },
      top,
      { snapshot: 'bubble-level-1' },
      { click: '.wp-stop' },
      top,
      { snapshot: 'stopped' },
      { click: '[data-walert="test"]' },
      { click: '[data-walert="test"]' },
      top,
      { snapshot: 'stopped-with-button' },
    ],
  },
  {
    name: 'onwater-weather-lake',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { eval: seedDay(WEATHER_LAKE) },
      { wait: 2500 },
      { go: 'new' },
      { wait: 700 },
      { snapshot: 'weather-and-stations' },
    ],
  },
  {
    name: 'onwater-weather-no-station',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { eval: seedDay(WEATHER_FORECAST_ONLY) },
      { wait: 2500 },
      { go: 'new' },
      { wait: 700 },
      { snapshot: 'forecast-only' },
    ],
  },
  {
    name: 'onwater-wind-model-sea',
    fixture: 'sample-sea',
    overrides: quiet,
    steps: [
      { eval: seedDay(WIND_MODEL) },
      { wait: 2500 },
      { go: 'new' },
      { wait: 700 },
      { snapshot: 'model-and-sea' },
    ],
  },
  {
    name: 'onwater-docs-kept',
    fixture: 'empty',
    overrides: quiet,
    steps: [
      { eval: SEED_DOCUMENT },
      { wait: 2500 },
      { go: 'docs' },
      { wait: 700 },
      { snapshot: 'kept' },
      { click: 'section[data-doc="permis"] h2' },
      top,
      { snapshot: 'kept-open' },
      { click: '[data-del="permis"]' },
      top,
      { snapshot: 'remove-armed' },
    ],
  },
  {
    name: 'onwater-translated',
    fixture: 'sample',
    overrides: { ...quiet, 'ldb.lang': 'en' },
    steps: [
      // Legacy reads the zone before opening the cruise, until the next clock tick.
      { wait: 10_500 },
      { go: 'rules' },
      { wait: 700 },
      { snapshot: 'rules' },
      { go: 'stats' },
      { wait: 700 },
      { snapshot: 'stats' },
      { go: 'docs' },
      { wait: 700 },
      { snapshot: 'docs' },
      { go: 'aboard' },
      { wait: 700 },
      { snapshot: 'aboard' },
      { go: 'tasktpl' },
      { wait: 700 },
      { snapshot: 'tasktpl' },
    ],
  },
  {
    name: 'onwater-stats-both',
    fixture: 'sample',
    overrides: quiet,
    steps: [
      // Legacy reads the zone before opening the cruise, until the next clock tick.
      { wait: 10_500 },
      { go: 'stats' },
      { wait: 700 },
      { snapshot: 'stats' },
    ],
  },
  {
    name: 'onwater-photos',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { eval: SEED_PHOTOS },
      { wait: 2500 },
      { go: 'log' },
      { wait: 700 },
      { snapshot: 'strip' },
      { click: '.photo-strip img' },
      { snapshot: 'viewer' },
      { click: '[data-pv="1"]' },
      { snapshot: 'viewer-next' },
      { click: '[data-pclose]' },
      top,
      { snapshot: 'closed' },
    ],
  },
  {
    name: 'onwater-boat-fields',
    fixture: 'sample-lake',
    overrides: quiet,
    steps: [
      { go: 'boats', arg: { fields: 'exb1' } },
      // Long labels scroll once in their field.
      { wait: 8000 },
      { snapshot: 'labels' },
      { fill: '#cNew', value: 'Code du cadenas' },
      { click: '#cAdd' },
      { wait: 8000 },
      { snapshot: 'added' },
      { click: '.lab-own [data-dir="-1"]' },
      { wait: 8000 },
      { snapshot: 'moved-up' },
      { fill: '.lab-std input', value: 'Nom du bateau' },
      { wait: 8000 },
      { snapshot: 'renamed' },
      { click: '.lab-own .danger' },
      { longpress: '.lab-own .danger', ms: 900 },
      { wait: 8000 },
      { snapshot: 'deleted' },
      { click: '#cBack' },
      { wait: 8000 },
      { snapshot: 'back' },
    ],
    // The fields of the boat sheet get random ids, drawn once per render.
    ignoreAttributes:
      '^(for|id)$|^data-(?!(theme|view|frame|val|key|b|pick|fiche|prep|photo|m|k|id|cs|cem|base)$)',
  },
];
