import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { initState, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { setStorageBackend, store } from '../../../storage/store.ts';
import { gotoBar, gotoTarget, gotoUpdate, setGoto } from '../goto.ts';
import {
  chooseCancel,
  drawTrkButtons,
  trackerOverlay,
  trkChooseStart,
} from '../trackerButtons.ts';
import { trackerDash, updateTrkDash } from '../trackerDash.ts';
import { newTracker, tracker, trkReset } from '../trackerState.ts';

beforeEach(() => {
  const storage = createMemoryStorage({});
  setStorageBackend(storage);
  initState(storage);
  gotoTarget.value = null;
  gotoBar.value = null;
  tracker.current = null;
  vi.stubGlobal('document', {
    documentElement: { classList: { contains: () => false } },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('setGoto stores the target and fills the bar', () => {
  setGoto({ lat: 46.5, lon: 6.5, name: 'M001' });
  expect(store.get('ldb.goto', null)).toStrictEqual({
    lat: 46.5,
    lon: 6.5,
    name: 'M001',
  });
  expect(gotoBar.value?.waiting).toBe(true);
  expect(state.view.toast.value?.message).toBe('Go to M001');
  setGoto(null);
  expect(gotoBar.value).toBeNull();
  expect(store.get('ldb.goto', 'kept')).toBeNull();
});

test('gotoUpdate signals the arrival once', () => {
  setGoto({ lat: 46.5, lon: 6.5, name: 'M001' });
  state.view.myPos.value = {
    lat: 46.5,
    lon: 6.5,
    sog: null,
    cog: null,
    t: Date.now(),
  };
  gotoUpdate();
  expect(state.view.toast.value?.message).toBe('Arrivé à M001');
  expect(gotoTarget.value?.arrived).toBe(true);
  state.view.toast.value = null;
  gotoUpdate();
  expect(state.view.toast.value).toBeNull();
});

test('updateTrkDash reads the recording in progress', () => {
  state.view.trip.value = {
    start: Date.now() - 3_900_000,
    lochBase: 0,
    det: { lastSog: 5, lastCog: 90, dist: 2.5 },
    dep: null,
    cands: [],
  };
  state.view.tracking.value = true;
  updateTrkDash();
  expect(trackerDash.value).toStrictEqual({
    speed: '5,0',
    speedUnit: 'nd · 9 km/h',
    course: '090°',
    distance: '2,5',
    duration: '1 h 05',
    durationLabel: '⏺ en route',
    top: '–',
  });
});

test('updateTrkDash shows the last fix without recording', () => {
  tracker.current = { ...newTracker(), lastSog: 3, lastCog: 10 };
  updateTrkDash();
  expect(trackerDash.value.speed).toBe('3,0');
  expect(trackerDash.value.course).toBe('010°');
  trkReset();
  updateTrkDash();
  expect(trackerDash.value.speed).toBe('–');
});

test('trkChooseStart needs the tracker on screen and a previous track', () => {
  state.data.cruise.value = { id: 'c1' } as never;
  store.set('ldb.lastTrip.c1', {
    end: Date.parse('2026-07-15T10:30:00+02:00'),
    det: { dist: 1.25 },
  });
  state.view.currentView.value = 'more';
  trkChooseStart();
  expect(trackerOverlay.value.kind).toBe('idle');
  state.view.currentView.value = 'tracker';
  trkChooseStart();
  expect(trackerOverlay.value).toStrictEqual({
    kind: 'choose',
    question:
      'Une trace a déjà été enregistrée (arrivée à 10:30, 1,3 NM). Que voulez-vous faire ?',
  });
  chooseCancel();
  expect(trackerOverlay.value.kind).toBe('idle');
});

test('drawTrkButtons shows the refusal unless a track is recording', () => {
  state.view.gpsDenied.value = true;
  drawTrkButtons();
  expect(trackerOverlay.value).toStrictEqual({
    kind: 'idle',
    denied: true,
    framed: false,
  });
  state.view.tracking.value = true;
  drawTrkButtons();
  expect(trackerOverlay.value).toStrictEqual({
    kind: 'idle',
    denied: false,
    framed: false,
  });
});
