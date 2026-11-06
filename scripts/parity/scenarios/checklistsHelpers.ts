import { loadFixture } from '../browser.ts';
import type { Fixture, Scenario } from '../types.ts';

export const quiet = { 'ldb.tipIdx': '6' };
/**
 * Taller than the longest list. Without scrolling, a step cannot depend on
 * `--topbar-h` (62 px in legacy, 63 px here), which sets where a click scrolls
 * to, and the fixed bars stay out of the middle of the full-page screenshots.
 */
export const tall = { width: 390, height: 6000 };
/** The bubble of the last gesture has gone: its end must not race the snapshot. */
export const expired = { wait: 3000 };
/** The lazy page of a first visit. */
export const loaded = { wait: 3000 };
const CRUISE_KEY = 'ldb.cruise.mrltkr40tkny6';
const TODAY = '2026-07-15';

/** Stores a one-pixel photo in the phone, under the given ids. */
export function storePhotos(ids: string[]): { eval: string } {
  return {
    eval: `new Promise((resolve) => {
      const open = indexedDB.open('ldb-photos', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('p');
      open.onsuccess = () => {
        const store = open.result.transaction('p', 'readwrite').objectStore('p');
        for (const id of ${JSON.stringify(ids)}) store.put('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', id);
        store.transaction.oncomplete = () => { open.result.close(); resolve(); };
      };
    })`,
  };
}

function lakeFixture(
  change: (
    day: Record<string, unknown>,
    cruise: Record<string, unknown>,
  ) => void,
): Fixture {
  const fixture = structuredClone(loadFixture('sample-lake'));
  const cruise = fixture[CRUISE_KEY] as {
    days: Record<string, Record<string, unknown>>;
  };
  change(cruise.days[TODAY] as Record<string, unknown>, cruise);
  return fixture;
}

export const allDeparture = lakeFixture((day) => {
  day.checkDone = [
    'd1',
    'd2',
    'd3',
    'rel-c',
    'rel-moteurDebut',
    'rel-carbPct',
    'rel-batt1',
    'rel-batt2',
    'rel-eauPct',
  ];
  delete day.ckOpen;
});

export const withPhotos = lakeFixture((day, cruise) => {
  day.obsPrise =
    'Griffure sur le bordé à tribord, déjà signalée au loueur lors de la remise des clés au port.';
  cruise.photos = [
    {
      id: 'ph1',
      t: '2026-07-15T08:00:00.000Z',
      day: TODAY,
      ctx: 'dep',
      item: 'd1',
    },
    {
      id: 'ph2',
      t: '2026-07-15T08:05:00.000Z',
      day: TODAY,
      ctx: 'dep',
      item: 'd1',
    },
    {
      id: 'ph3',
      t: '2026-07-15T08:06:00.000Z',
      day: TODAY,
      ctx: 'dep',
      item: 'd2',
    },
    { id: 'ph4', t: '2026-07-15T08:10:00.000Z', day: TODAY, ctx: 'dep' },
  ];
});

export const lake = (
  name: string,
  steps: Scenario['steps'],
  extra: Partial<Scenario> = {},
): Scenario => ({
  name,
  fixture: 'sample-lake',
  overrides: quiet,
  viewport: tall,
  steps: [{ go: 'checklist' }, loaded, ...steps],
  ...extra,
});
