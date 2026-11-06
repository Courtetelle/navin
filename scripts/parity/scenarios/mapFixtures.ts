import type { Fixture } from '../types.ts';

const done = { at: '2026-07-01T10:00:00.000Z', ok: 1, n: 1, done: true };
/**
 * No boot tip, and the built-in lake maps already kept: their download starts
 * 6 s after the boot and would otherwise change `#mapOffSub` by timing.
 */
export const quiet = {
  'ldb.tipIdx': '6',
  'ldb.lakesBase': { leman: done, neuch: done, vd2: done, toldDone: true },
};
/**
 * Default ignored attributes plus `name`: the radio group of the layer selector
 * is numbered by Leaflet's internal counter, which depends on the tiles loaded
 * by the maps shown before.
 */
export const IGNORE_NAME =
  '^name$|^data-(?!(theme|view|frame|val|key|b|pick|fiche|prep|photo|m|k|id|cs|cem|base)$)';
/** Cruise of the fixture `sample-lake`. */
export const CRUISE = 'mrltkr40tkny6';
/** Start of the tracks. */
export const START = Date.parse('2026-07-15T08:40:00+02:00');
/** A position on the lake, for the scenarios with GPS. */
export const here = { latitude: 46.5, longitude: 6.5 };
/** A Go to target. */
export const goto = {
  lat: 46.45,
  lon: 6.55,
  name: 'M003 · Milieu du Grand-Lac',
};
/** The first top tab. */
export const NAVIN_TAB = '.top-tab[data-view="tracker"]';
/** French screens shown in English. */
export const english = { ...quiet, 'ldb.lang': 'en', 'ldb.lang2': 'en' };

/** A track of `count` points every 60 s, south-west of Morges. */
export function track(
  count: number,
  from = START,
): Array<[number, number, number]> {
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

/** Two tracks of one cruise: start `ldb.trkSegs` at 6. */
export const twoTracks = [...track(6), ...track(5, START + 3_600_000)];
/** Two offline zones. */
export const zones = [
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
/** A recording in progress. */
export const trip = {
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
/**
 * Sections open on a screen (they start folded).
 * @param view - Screen.
 * @param titles - Titles of the sections.
 * @returns The `ldb.folds2` entry.
 */
export function unfolded(view: string, ...titles: string[]): Fixture {
  const folds: Record<string, number> = {};
  for (const title of titles) folds[`${view}|${title}`] = 0;
  return { 'ldb.folds2': JSON.stringify(folds) };
}

export const swipeRow = `(() => {
  const row = document.querySelector('.trk-item');
  const at = (x) => ({ bubbles: true, clientX: x, clientY: 300, pointerId: 1 });
  row.dispatchEvent(new PointerEvent('pointerdown', at(300)));
  row.dispatchEvent(new PointerEvent('pointermove', at(280)));
  row.dispatchEvent(new PointerEvent('pointermove', at(200)));
  row.dispatchEvent(new PointerEvent('pointerup', at(200)));
})()`;
export function chooseFile(content: string): string {
  return `(() => {
    const input = document.querySelector('#mapAscFile');
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(content)}], 'courbes.json'));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`;
}
