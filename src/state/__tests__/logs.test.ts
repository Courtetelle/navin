import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { store } from '../../storage/store.ts';
import * as actions from '../actions.ts';
import { state } from '../index.ts';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from './parityHelpers.ts';

beforeEach(() => {
  useHarnessWorld();
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
});
afterEach(leaveHarnessWorld);

test('the SOS log notes every action and ends the man-overboard logs', () => {
  expect(actions.sosLogsCount()).toBe('1 log SOS automatique');
  state.view.sosPos.value = {
    lat: 46.5,
    lon: 6.5,
    at: '2026-07-15T08:29:30.000Z',
  };
  const log = actions.sosLogAdd('🆘 Touche SOS', 'sos');
  expect(actions.sosLogsCount()).toBe('⏺ log SOS en cours');
  expect(log).toMatchObject({
    zone: 'lac',
    nav: 'Entraînement du 15.07',
    boat: 'Savannah',
  });
  expect(
    log.events.map((event) => [event.what, event.type, event.pos]),
  ).toStrictEqual([
    ['Début du log SOS', 'start', undefined],
    ['🆘 Touche SOS', 'sos', { lat: 46.5, lon: 6.5 }],
  ]);
  actions.saveMobLogs([
    { id: 'mob1', start: '2026-07-15T08:10:00.000Z', events: [] },
  ]);
  actions.sosLogEnd();
  expect(actions.sosLogActive()).toBeNull();
  expect(actions.mobLogs()[0]).toMatchObject({
    end: '2026-07-15T08:30:00.000Z',
    events: [{ type: 'end', what: 'Fin de procédure SOS' }],
  });
  expect(state.data.cruise.value?.entries.at(-1)?.v).toStrictEqual({
    evt: ['Homme à la mer'],
    note: 'Fin de procédure SOS (20 min)',
  });
  expect(store.get<unknown[]>('ldb.sosLogs', [])).toHaveLength(2);
});

test('without open cruise, man-overboard logs live on the phone', () => {
  actions.setCruise(null);
  expect(actions.mobLogs()).toStrictEqual([]);
  actions.saveMobLogs([
    { id: 'mob2', start: '2026-07-15T08:00:00.000Z', events: [] },
  ]);
  expect(store.get('ldb.mobLogs', [])).toStrictEqual([
    { id: 'mob2', start: '2026-07-15T08:00:00.000Z', events: [] },
  ]);
  expect(actions.mobLogs()).toHaveLength(1);
});

test('navigation zone: simulation, fresh position, open cruise, then the index', () => {
  expect(actions.navZone()).toBe('lac');
  actions.setZoneSim('mer');
  expect([
    actions.navZone(),
    actions.isLake(),
    actions.zoneSimGet(),
    store.raw('ldb.zoneSim'),
  ]).toStrictEqual(['mer', false, 'mer', 'mer']);
  actions.setZoneSim('auto');
  expect([actions.zoneSimGet(), store.raw('ldb.zoneSim')]).toStrictEqual([
    'auto',
    null,
  ]);
  state.view.lastFix.value = {
    lat: 43.1,
    lon: 5.9,
    at: '2026-07-15T08:00:00.000Z',
  };
  expect(actions.navZone()).toBe('mer');
  expect(actions.lastKnownPos()).toStrictEqual({
    lat: 43.1,
    lon: 5.9,
    at: '2026-07-15T08:00:00.000Z',
  });
  state.view.lastFix.value = {
    lat: 43.1,
    lon: 5.9,
    at: '2026-07-14T08:00:00.000Z',
  };
  expect(actions.navZone()).toBe('lac');
  state.view.lastFix.value = null;
  expect(actions.lastKnownPos()).toStrictEqual({
    lat: 46.4811,
    lon: 6.4655,
    at: '2026-07-15T08:05:00.000Z',
  });
  actions.setCruise(null);
  state.data.index.value = [];
  expect(actions.navZone()).toBe('lac');
  state.view.myPos.value = {
    lat: 1,
    lon: 2,
    sog: null,
    cog: null,
    t: Date.now() - 1000,
  };
  expect(actions.herePos()).toStrictEqual({
    lat: 1,
    lon: 2,
    sog: null,
    cog: null,
    t: Date.now() - 1000,
  });
});

test('toasts get a new id each time; a full memory shows a toast', () => {
  actions.toast('Bonjour');
  const first = state.view.toast.value?.id ?? 0;
  actions.toast('Bonjour', true);
  expect(state.view.toast.value).toStrictEqual({
    message: 'Bonjour',
    force: true,
    id: first + 1,
  });
  actions.initState(createMemoryStorage({}, { quota: 10 }));
  expect(state.view.toast.value?.message).toBe(
    '⚠ Mémoire pleine : exportez puis supprimez une ancienne croisière',
  );
  vi.useRealTimers();
});

test('track storage keys follow the open cruise', () => {
  const id = state.data.cruise.value?.id ?? '';
  expect([
    actions.trackKey(),
    actions.tripKey(),
    actions.lastTripKey(),
    actions.trackSegmentsKey(),
  ]).toStrictEqual([
    `ldb.track.${id}`,
    `ldb.trip.${id}`,
    `ldb.lastTrip.${id}`,
    `ldb.trkSegs.${id}`,
  ]);
  expect(actions.loadTrack()).toStrictEqual([]);
  actions.saveTrack([[1, 46.5, 6.5]]);
  expect(actions.loadTrack()).toStrictEqual([[1, 46.5, 6.5]]);
  state.view.trip.value = {
    start: 1,
    lochBase: 0,
    det: {},
    dep: null,
    cands: [],
  };
  actions.saveTrip();
  expect(store.get(actions.tripKey(), null)).toStrictEqual({
    start: 1,
    lochBase: 0,
    det: {},
    dep: null,
    cands: [],
  });
  expect(actions.fileName('-trace', 'gpx')).toBe(
    'entrainement-du-15-07-trace-20260715.gpx',
  );
});

test('SOS log text and GPX export', () => {
  const start = new Date(2026, 6, 15, 10, 30, 5).toISOString();
  const end = new Date(2026, 6, 15, 10, 42, 0).toISOString();
  const text = actions.sosLogText({
    id: 'log',
    start,
    end,
    zone: 'lac',
    nav: 'Sortie',
    boat: 'Savannah',
    events: [
      { t: start, what: 'Début du log SOS', type: 'start' },
      { t: end, what: '⏹ Fin de procédure SOS', pos: { lat: 46.5, lon: 6.5 } },
    ],
  });
  expect(text).toBe(
    "LOG SOS · 15/07/2026 · Savannah · Sortie\n10:30:05  Début du log SOS\n10:42:00  ⏹ Fin de procédure SOS  (46°30,000' N  006°30,000' E)\nDurée : 12 min",
  );
  expect(
    actions.trackToGpx([[Date.UTC(2026, 6, 15, 8, 0), 46.5, 6.5]], 'A & B'),
  ).toBe(
    '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NavIn" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>A &amp; B</name><trkseg>\n<trkpt lat="46.5" lon="6.5"><time>2026-07-15T08:00:00.000Z</time></trkpt>\n</trkseg></trk></gpx>',
  );
  expect(actions.constatTitle('dep')).toBe('Constat à la prise du bateau');
  expect(actions.constatTitle('quit')).toBe('Constat de fin de journée');
  state.view.settingsFrom.value = 'tracker';
  expect(actions.nightOK()).toBe(true);
  state.view.settingsFrom.value = 'more';
  expect(actions.nightOK()).toBe(false);
});
