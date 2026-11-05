import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Cruise } from '../../../model/types.ts';
import { navigation } from '../../../shell/router.ts';
import {
  blankCruise,
  initState,
  saveCruise,
  setCruise,
  setZoneSim,
  state,
} from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import { dockDone, moorNow, toggleDockPoint } from '../moor.ts';
import { newNavCruise, prepMode } from '../prepCruise.ts';
import { quickStart } from '../quickStart.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 15, 10, 30));
  initState(createMemoryStorage({}));
  setZoneSim('lac');
});

afterEach(() => {
  vi.useRealTimers();
});

function yesterdayCruise(fields: Partial<Cruise>): void {
  vi.setSystemTime(new Date(2026, 6, 14, 10, 30));
  const cruise = blankCruise('Hier', null);
  Object.assign(cruise, fields);
  setCruise(cruise);
  saveCruise();
  vi.setSystemTime(new Date(2026, 6, 15, 10, 30));
}

test('a track already recording only opens the tracker', () => {
  state.view.tracking.value = true;
  quickStart();
  expect(state.view.toast.value?.message).toBe('Trace déjà en cours');
  expect(state.data.cruise.value).toBeNull();
  expect(navigation.value.view).toBe('tracker');
});

test('the first track opens a quick outing on the first boat', () => {
  quickStart();
  const cruise = state.data.cruise.value;
  expect(cruise?.quick).toBe(true);
  expect(cruise?.type).toBe('lac');
  expect(cruise?.duree).toBe('jour');
  expect(cruise?.boatId).toBe(state.data.boats.value[0]?.id);
  expect(cruise?.purpose).toBe('Entraînement');
  expect(cruise?.info.name).toBe('2601L_Savannah ME 15/7');
});

test('the outing of the day goes on', () => {
  setCruise(blankCruise('Du jour', null));
  saveCruise();
  const { id } = state.data.cruise.value as Cruise;
  quickStart();
  expect(state.data.cruise.value?.id).toBe(id);
  expect(store.get('ldb.index', [])).toHaveLength(1);
});

test('the last track of the day can be extended', () => {
  setCruise(blankCruise('Du jour', null));
  saveCruise();
  store.set(`ldb.lastTrip.${state.data.cruise.value?.id}`, { det: {} });
  quickStart();
  expect(state.view.toast.value?.message).toBe(
    'Sortie du jour reprise : prolonger ou nouvelle trace ?',
  );
  expect(
    store.get(`ldb.lastTrip.${state.data.cruise.value?.id}`, null),
  ).toStrictEqual({ det: {} });
});

test('a cruise of several days goes on', () => {
  yesterdayCruise({ zone: 'M' });
  const { id } = state.data.cruise.value as Cruise;
  quickStart();
  expect(state.data.cruise.value?.id).toBe(id);
});

test('a day outing gives its boat, crew and purpose to a new one', () => {
  yesterdayCruise({
    type: 'lac',
    duree: 'jour',
    boatId: 'exb1',
    purpose: 'Invitation',
    crew: [{ memberId: 'ex1', nom: 'Camille Rochat', fonction: 'Skipper' }],
  });
  const { id } = state.data.cruise.value as Cruise;
  quickStart();
  const cruise = state.data.cruise.value;
  expect(cruise?.id).not.toBe(id);
  expect(cruise?.boatId).toBe('exb1');
  expect(cruise?.purpose).toBe('Invitation');
  expect(cruise?.quick).toBe(true);
  expect(cruise?.crew).toStrictEqual([
    { memberId: 'ex1', nom: 'Camille Rochat', fonction: 'Skipper' },
  ]);
});

test('a position abroad opens a sea cruise', () => {
  state.view.lastFix.value = {
    lat: 43,
    lon: 16,
    at: new Date().toISOString(),
  };
  quickStart();
  const cruise = state.data.cruise.value;
  expect(cruise?.type).toBeUndefined();
  expect(cruise?.zone).toBe('M');
  expect(cruise?.quick).toBe(true);
});

test('a lake outing without boat keeps a null boat and the lake contacts', () => {
  const cruise = newNavCruise('lacc', null, '', false);
  expect(cruise.boatId).toBeNull();
  expect(cruise.duree).toBe('croisiere');
  expect(cruise.purpose).toBeUndefined();
  expect(cruise.info.du).toBe('2026-07-15');
});

test('prepMode reads the type and the duration', () => {
  expect(prepMode({ type: 'mer', duree: 'jour' })).toBe('mer');
  expect(prepMode({ type: 'lac', duree: 'croisiere' })).toBe('lacc');
  expect(prepMode({ type: 'lac', duree: 'jour' })).toBe('lacj');
});

test('mooring forgets the docking points and opens the check-out', async () => {
  setCruise(blankCruise('Test', null));
  toggleDockPoint(2);
  expect(dockDone.value).toStrictEqual({ 2: true });
  toggleDockPoint(2);
  expect(dockDone.value).toStrictEqual({ 2: false });
  await moorNow();
  expect(dockDone.value).toStrictEqual({});
  expect(state.view.toast.value?.message).toBe('🔒 Amarré : trace terminée');
  expect(navigation.value.view).toBe('checklist');
  expect(navigation.value.arg).toBe('quit');
});
