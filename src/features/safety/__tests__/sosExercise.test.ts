import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import * as actions from '../../../state/actions.ts';
import { state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import {
  simulationStep,
  sosExEnd,
  sosExOn,
  sosExStart,
  sosSimStart,
  sosSimToggle,
  sosSimulation,
  watchSosPage,
} from '../sosExercise.ts';
import { sosLogStart } from '../sosLogStart.ts';

const section = { open: false, scrollIntoView: vi.fn() };
const noFix = () => undefined;

beforeEach(() => {
  useHarnessWorld();
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
  state.view.currentView.value = 'settings';
  vi.stubGlobal('document', { querySelector: () => section });
});
afterEach(() => {
  leaveHarnessWorld();
  vi.unstubAllGlobals();
});

test('the simulation starts off Lausanne and moves away at 3 knots', () => {
  sosSimStart('ch');
  expect(sosSimulation()).toMatchObject({ lat: 46.47, lon: 6.62 });
  expect(state.view.sosLive.value?.lat).toBeCloseTo(46.47125, 5);
  expect(state.view.sosLive.value?.lon).toBeCloseTo(6.62314, 5);
  simulationStep();
  expect(actions.lastKnownPos()).toBe(state.view.sosLive.value);
});

test('a simulation button opens the SOS page, the same button there stops it', () => {
  sosSimToggle('mer');
  expect(state.view.currentView.value).toBe('sos');
  expect(sosSimulation()).toMatchObject({ lat: 43.06, lon: 5.98 });
  sosSimToggle('mer');
  expect(sosSimulation()).toBeNull();
  expect(state.view.sosLive.value).toBeNull();
});

test('leaving the SOS page stops a simulation, not an exercise', () => {
  sosSimToggle('ch');
  watchSosPage(noFix);
  state.view.currentView.value = 'more';
  watchSosPage(noFix);
  expect(sosSimulation()).toBeNull();
  sosExStart('ch');
  watchSosPage(noFix);
  state.view.currentView.value = 'more';
  watchSosPage(noFix);
  expect(sosSimulation()).not.toBeNull();
  sosExEnd();
});

test('an exercise is marked, ends in the settings and clears the simulation', () => {
  state.view.settingsFrom.value = 'tracker';
  sosExStart('fr');
  const log = actions.sosLogActive();
  expect(log?.ex).toBe(true);
  expect(log?.events[1]).toMatchObject({
    type: 'sos',
    what: '🧪 Exercice : touche SOS (vers Meillerie, eaux françaises)',
  });
  expect(sosExOn()).toBe(true);
  expect(state.view.currentView.value).toBe('sos');
  sosExEnd();
  expect(sosExOn()).toBe(false);
  expect(actions.sosLogActive()).toBeNull();
  expect(sosSimulation()).toBeNull();
  expect(state.view.currentView.value).toBe('settings');
  expect(state.view.settingsOpen.value).toBe('simu');
  expect(state.view.settingsFrom.value).toBe('tracker');
  expect(section.open).toBe(true);
  expect(section.scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
});

test('an exercise refuses to start during a real SOS', () => {
  sosLogStart('Touche SOS');
  sosExStart('ch');
  expect(actions.sosLogActive()?.ex).toBeUndefined();
  expect(sosSimulation()).toBeNull();
  expect(state.view.toast.value?.message).toBe(
    '⚠ Une vraie procédure SOS est en cours : terminez-la avant un exercice',
  );
});

test('the SOS start keeps a fallback position and notes the GPS answer once', () => {
  const answers: PositionCallback[] = [];
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (answer: PositionCallback) => answers.push(answer),
    },
  });
  state.view.sosPos.value = {
    lat: 46.5,
    lon: 6.5,
    at: '2026-07-15T08:29:00.000Z',
  };
  sosLogStart('Touche SOS');
  expect(actions.sosLogActive()?.pos0).toStrictEqual({
    lat: 46.5,
    lon: 6.5,
    at: '2026-07-15T08:29:00.000Z',
  });
  answers[0]?.({
    coords: { latitude: 46.51, longitude: 6.51 },
  } as GeolocationPosition);
  expect(actions.sosLogActive()?.events.at(-1)).toStrictEqual({
    t: '2026-07-15T08:30:00.000Z',
    what: '📍 Position GPS',
    type: 'pos',
    pos: { lat: 46.51, lon: 6.51 },
  });
  expect(state.view.sosPos.value?.lat).toBe(46.51);
});
