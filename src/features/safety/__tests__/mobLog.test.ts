import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import * as actions from '../../../state/actions.ts';
import { state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import type { MobLogRecord } from '../mobLog.ts';
import {
  mobActive,
  mobLog,
  mobSetPos,
  mobStepDone,
  mobWatchFix,
} from '../mobLog.ts';
import { mobPrepare } from '../mobPrepare.ts';
import { initMobProcedures, mobKind, mobZone } from '../mobProcedures.ts';

beforeEach(() => {
  useHarnessWorld();
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
  initMobProcedures();
  mobKind.value = 'real';
  mobZone.value = 'lac';
});
afterEach(() => {
  leaveHarnessWorld();
  vi.unstubAllGlobals();
});

test('opening the page starts the SOS log, the MOB log and a journal entry', () => {
  mobPrepare(null);
  expect(
    actions.sosLogActive()?.events.map((event) => event.what),
  ).toStrictEqual(['Début du log SOS', 'Homme à la mer ouvert']);
  const log = mobActive();
  expect(log?.zone).toBe('lac');
  expect(log?.events.map((event) => [event.type, event.what])).toStrictEqual([
    ['start', 'Début de l’incident homme à la mer'],
    ['note', 'Log démarré'],
  ]);
  const entry = state.data.cruise.value?.entries.find(
    (item) => item.id === log?.entryId,
  );
  expect(entry?.v).toStrictEqual({
    evt: ['Homme à la mer'],
    note: 'Début du log de l’incident',
  });
  expect(state.view.tzLocalOnly.value).toBe(true);
});

test('a redraw or a change of procedure starts nothing', () => {
  mobPrepare();
  expect(actions.sosLogActive()).toBeNull();
  mobPrepare('train', true);
  expect(mobKind.value).toBe('train');
  expect(mobActive()).toBeNull();
});

test('a step can be done, cancelled and done again', () => {
  mobLog('1. Crier', { type: 'step', key: 'Tout de suite#0' });
  expect(mobStepDone(mobActive(), 'Tout de suite#0')?.what).toBe('1. Crier');
  mobLog('Annulé : 1. Crier', { type: 'undo', key: 'Tout de suite#0' });
  expect(mobStepDone(mobActive(), 'Tout de suite#0')).toBeNull();
  mobLog('1. Crier', { type: 'step', key: 'Tout de suite#0' });
  expect(mobStepDone(mobActive(), 'Tout de suite#0')).not.toBeNull();
  expect(mobStepDone(null, 'Tout de suite#0')).toBeNull();
});

test('the first position becomes the MOB position, the journal entry gets it', () => {
  mobLog('Log démarré', { type: 'note' });
  mobWatchFix({ lat: 46.47, lon: 6.62 });
  mobWatchFix({ lat: 46.48, lon: 6.63 });
  const log = mobActive() as MobLogRecord;
  expect(log.mobPos).toStrictEqual({
    lat: 46.47,
    lon: 6.62,
    t: '2026-07-15T08:30:00.000Z',
  });
  expect(log.lastPos).toMatchObject({ lat: 46.48, lon: 6.63 });
  expect(log.events.map((event) => event.type)).toStrictEqual([
    'start',
    'mobpos',
    'note',
  ]);
  const entry = state.data.cruise.value?.entries.find(
    (item) => item.id === log.entryId,
  );
  expect(entry?.v.pos).toStrictEqual({ lat: 46.47, lon: 6.62 });
  expect(state.view.sosPos.value).toMatchObject({ lat: 46.48, lon: 6.63 });
});

test('the GPS answer completes the event it was asked for', () => {
  const answers: PositionCallback[] = [];
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (answer: PositionCallback) => answers.push(answer),
    },
  });
  mobLog('Log démarré', { type: 'note' });
  mobLog('1. Crier', { type: 'step', key: 'a#0' });
  answers[0]?.(fix(46.4));
  answers[1]?.(fix(46.5));
  const log = mobActive() as MobLogRecord;
  expect(log.events.map((event) => [event.what, event.pos?.lat])).toStrictEqual(
    [
      ['Début de l’incident homme à la mer', undefined],
      ['📍 Position MOB enregistrée', 46.4],
      ['Log démarré', 46.4],
      ['1. Crier', 46.5],
    ],
  );
});

test('without a cruise the log stays on the phone', () => {
  actions.setCruise(null);
  mobLog('Log démarré', { type: 'note' });
  const [log] = store.get<MobLogRecord[]>('ldb.mobLogs', []);
  expect(log?.entryId).toBeUndefined();
  expect(log?.events).toHaveLength(2);
  expect(mobActive()?.id).toBe(log?.id);
});

test('a new position noted by hand does not move the MOB position', () => {
  const log: MobLogRecord = {
    id: 'x',
    kind: 'real',
    zone: 'mer',
    start: '2026-07-15T08:00:00.000Z',
    events: [{ t: '2026-07-15T08:00:00.000Z', type: 'start', what: 'Début' }],
    mobPos: { lat: 1, lon: 2, t: '2026-07-15T08:00:00.000Z' },
  };
  mobSetPos(log, { lat: 3, lon: 4 }, '2026-07-15T08:05:00.000Z');
  expect(log.mobPos?.lat).toBe(1);
  expect(log.lastPos?.lat).toBe(3);
  expect(log.events).toHaveLength(1);
});

function fix(latitude: number): GeolocationPosition {
  return { coords: { latitude, longitude: 6.6 } } as GeolocationPosition;
}
