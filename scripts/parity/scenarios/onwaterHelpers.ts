import type { Scenario } from '../types.ts';

export const quiet = { 'ldb.tipIdx': '6' };

// A full-page screenshot paints the fixed chrome at the scroll offset, and
// Playwright's scroll into view can differ by a pixel between the two apps.
export const top = { eval: 'scrollTo(0, 0)' };

// Writes into today's sheet of the open cruise, then reloads the app.
export function seedDay(values: Record<string, unknown>): string {
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

export const WEATHER_LAKE = {
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

export const WEATHER_FORECAST_ONLY = {
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

export const WIND_MODEL = {
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
export const SEED_DOCUMENT = `new Promise((done) => {
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
export const SEED_PHOTOS = `new Promise((done) => {
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

export const everyView: Scenario[] = ['sample-lake', 'sample-sea'].flatMap(
  (fixture) =>
    ['rules', 'docs', 'stats', 'aboard', 'tasktpl'].map((view) => ({
      name: `onwater-view-${view}-${fixture}`,
      fixture,
      overrides: quiet,
      steps: [{ go: view }, { wait: 1500 }, { snapshot: view }],
    })),
);
