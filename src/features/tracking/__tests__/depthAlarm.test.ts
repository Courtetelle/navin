import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  blankCruise,
  setCruise,
  setZoneSim,
  state,
  updateCruise,
  updateSettings,
} from '../../../state/index.ts';
import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import {
  DEPTH_SCENARIOS,
  depthAlarmSet,
  depthMute,
  depthStart,
  depthTestStart,
  depthTestState,
  depthTestStop,
  startDepthWatch,
} from '../depthAlarm.ts';
import { depthOverlayState } from '../depthOverlayState.ts';
import { nmeaLink, nmeaSet } from '../nmeaLive.ts';

const audio = vi.hoisted(() => ({
  dangerBuzz: vi.fn(),
  depthBeep: vi.fn(),
  depthBuzz: vi.fn(),
  sirenOff: vi.fn(),
  sirenOn: vi.fn(),
}));
const contours = vi.hoisted(() => ({ isobathLoad: vi.fn() }));
const cells = vi.hoisted(() => ({ lemanDepthAt: vi.fn() }));

vi.mock('../depthAudio.ts', () => audio);
vi.mock('../depthOverlay.ts', () => ({ showDepthOverlay: vi.fn() }));
vi.mock('../trackerLink.ts', () => contours);
vi.mock('../../map/lemanDepth.ts', () => cells);

const NOW = Date.UTC(2026, 6, 15, 8);

beforeEach(() => {
  initState(createMemoryStorage());
  setCruise(blankCruise('Essai'));
  vi.useFakeTimers({ now: NOW });
  vi.clearAllMocks();
  contours.isobathLoad.mockResolvedValue([]);
  cells.lemanDepthAt.mockResolvedValue(undefined);
  nmeaLink.at = {};
  nmeaLink.live = {};
});

afterEach(() => {
  depthAlarmSet(0);
  vi.useRealTimers();
});

test('the alarm starts 1 m above the sounding unless set otherwise', () => {
  expect(depthStart()).toBe(1);
  updateSettings((settings) => {
    settings.depthStart = 1.5;
  });
  expect(depthStart()).toBe(1.5);
});

test('above the sounding the flash goes from yellow to red, with beeps and vibrations', () => {
  depthAlarmSet(0.5, 2.5, 2);
  expect(depthOverlayState.value).toMatchObject({
    on: true,
    danger: false,
    test: false,
    color: 'hsl(28, 100%, 50%)',
    opacity: '0.53',
    period: '0.72s',
    title: 'Fond ≈ 2,5 m',
    subtitle: 'Marge sous la sonde min. (2 m) : 0,5 m',
  });
  expect(audio.depthBeep).toHaveBeenCalledWith(0.5);
  expect(audio.depthBuzz).toHaveBeenCalledWith(0.5);
  expect(audio.sirenOn).not.toHaveBeenCalled();
  vi.advanceTimersByTime(625);
  expect(audio.depthBeep).toHaveBeenCalledTimes(2);
});

test('under the sounding the screen is red and the siren sounds', () => {
  depthAlarmSet(1, 1.5, 2, true);
  expect(depthOverlayState.value).toMatchObject({
    on: true,
    danger: true,
    test: true,
    color: 'hsl(0, 100%, 50%)',
    opacity: '0.9',
    period: '0.25s',
    title: 'TEST · Fond ≈ 1,5 m',
    subtitle: '⚠ SOUS la sonde min. (2 m) de 0,5 m',
  });
  expect(audio.sirenOn).toHaveBeenCalledTimes(1);
  expect(audio.dangerBuzz).toHaveBeenCalledTimes(1);
  expect(audio.depthBeep).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1100);
  expect(audio.dangerBuzz).toHaveBeenCalledTimes(2);
});

test('the sound is cut for a minute, the vibrations stay', () => {
  depthAlarmSet(1, 1.5, 2);
  depthMute();
  expect(audio.sirenOff).toHaveBeenCalled();
  expect(state.view.toast.value?.message).toBe(
    'Son coupé 1 min · le clignotement et les vibrations restent',
  );
  audio.sirenOn.mockClear();
  depthAlarmSet(1, 1.5, 2);
  expect(audio.sirenOn).not.toHaveBeenCalled();
  expect(audio.dangerBuzz).toHaveBeenCalled();
  vi.setSystemTime(NOW + 60_001);
  depthAlarmSet(1, 1.5, 2);
  expect(audio.sirenOn).toHaveBeenCalledTimes(1);
});

test('the alarm off hides the overlay and keeps its last texts', () => {
  depthAlarmSet(0.5, 2.5, 2);
  depthAlarmSet(0);
  expect(depthOverlayState.value).toMatchObject({
    on: false,
    danger: false,
    title: 'Fond ≈ 2,5 m',
  });
  audio.depthBeep.mockClear();
  vi.advanceTimersByTime(5000);
  expect(audio.depthBeep).not.toHaveBeenCalled();
});

test('the flash follows the setting', () => {
  updateSettings((settings) => {
    settings.depthFlash = false;
  });
  depthAlarmSet(0.5, 2.5, 2);
  expect(depthOverlayState.value.noFlash).toBe(true);
});

test('the scenarios go through the sounding and come back', () => {
  const { lent, vite } = DEPTH_SCENARIOS;
  expect(lent.depthAt(0, 2)).toBeCloseTo(3.6, 9);
  expect(lent.depthAt(30, 2)).toBeCloseTo(1.6, 9);
  expect(lent.depthAt(40, 2)).toBeCloseTo(3.6, 9);
  expect(vite.depthAt(0, 2)).toBeCloseTo(3.5, 9);
  expect(vite.depthAt(6, 2)).toBeCloseTo(1.2, 9);
  expect(vite.depthAt(13, 2)).toBeCloseTo(1.2, 9);
  expect(vite.depthAt(20, 2)).toBeCloseTo(3.5, 9);
});

test('a test without sounding uses 2,0 m and reports its progress', () => {
  depthTestStart('vite');
  expect(state.view.toast.value?.message).toBe(
    'Test : Remontée brutale du fond · l’alarme démarre à 3 m (sonde min. + 1 m)',
  );
  vi.advanceTimersByTime(8000);
  expect(depthTestState.value).toBe(
    'Remontée brutale du fond : 8 s / 20 s · fond 1,2 m · sonde min. 2 m',
  );
  expect(depthOverlayState.value).toMatchObject({
    on: true,
    danger: true,
    test: true,
  });
  depthTestStop(false);
  expect(depthTestState.value).toBe('Test arrêté.');
  expect(depthOverlayState.value.on).toBe(false);
});

test('a test ends by itself', () => {
  depthTestStart('vite');
  vi.advanceTimersByTime(20_250);
  expect(depthTestState.value).toBe('Test terminé.');
});

async function watchOnce(): Promise<void> {
  await vi.advanceTimersByTimeAsync(2000);
}

function shallowLake(): void {
  setZoneSim('lac');
  updateCruise((cruise) => {
    cruise.info.draftPilot = '2';
  });
  contours.isobathLoad.mockResolvedValue([
    {
      d: 1,
      bb: [46, 6, 47, 7],
      pts: [
        [46.4999, 6.5],
        [46.5001, 6.5],
      ],
    },
    {
      d: 3,
      bb: [46, 6, 47, 7],
      pts: [
        [46.4999, 6.501],
        [46.5001, 6.501],
      ],
    },
  ]);
  state.view.lastFix.value = {
    lat: 46.5,
    lon: 6.5005,
    at: new Date(NOW).toISOString(),
  };
}

test('the watch sounds on a lake, close to shallow contours', async () => {
  shallowLake();
  startDepthWatch();
  await watchOnce();
  expect(depthOverlayState.value).toMatchObject({
    on: true,
    danger: false,
    title: 'Fond ≈ 2 m',
  });
});

test('the watch stops with an old position, at sea, or when switched off', async () => {
  shallowLake();
  startDepthWatch();
  await watchOnce();
  vi.setSystemTime(NOW + 16_000);
  await watchOnce();
  expect(depthOverlayState.value.on).toBe(false);
  state.view.lastFix.value = {
    lat: 46.5,
    lon: 6.5005,
    at: new Date(NOW + 16_000).toISOString(),
  };
  await watchOnce();
  expect(depthOverlayState.value.on).toBe(true);
  setZoneSim('mer');
  await watchOnce();
  expect(depthOverlayState.value.on).toBe(false);
  setZoneSim('lac');
  updateSettings((settings) => {
    settings.depthAlarm = false;
  });
  await watchOnce();
  expect(depthOverlayState.value.on).toBe(false);
});

test('the Lake Geneva cells give the depth, without any contour', async () => {
  shallowLake();
  contours.isobathLoad.mockResolvedValue([]);
  cells.lemanDepthAt.mockResolvedValue(1.5);
  startDepthWatch();
  await watchOnce();
  expect(depthOverlayState.value).toMatchObject({
    on: true,
    danger: true,
    title: 'Fond ≈ 1,5 m',
  });
});

test('over deep water the cells keep the alarm off', async () => {
  shallowLake();
  cells.lemanDepthAt.mockResolvedValue(null);
  contours.isobathLoad.mockResolvedValue([]);
  startDepthWatch();
  await watchOnce();
  expect(depthOverlayState.value.on).toBe(false);
});

test('unreadable cells fall back on the contours', async () => {
  shallowLake();
  cells.lemanDepthAt.mockRejectedValue(new Error('offline'));
  startDepthWatch();
  await watchOnce();
  expect(depthOverlayState.value).toMatchObject({
    on: true,
    title: 'Fond ≈ 2 m',
  });
});

test('with both sources the alarm follows the least water', async () => {
  shallowLake();
  cells.lemanDepthAt.mockResolvedValue(10);
  nmeaSet('depth', 1.5);
  startDepthWatch();
  await watchOnce();
  expect(depthOverlayState.value).toMatchObject({
    on: true,
    danger: true,
    title: 'Fond ≈ 1,5 m · sondeur',
  });
  cells.lemanDepthAt.mockResolvedValue(1.2);
  await watchOnce();
  expect(depthOverlayState.value).toMatchObject({
    on: true,
    title: 'Fond ≈ 1,2 m · carte',
  });
});

test('an old sounder value no longer counts', async () => {
  shallowLake();
  cells.lemanDepthAt.mockResolvedValue(null);
  nmeaSet('depth', 1.5);
  startDepthWatch();
  await watchOnce();
  expect(depthOverlayState.value.on).toBe(true);
  vi.setSystemTime(NOW + 16_000);
  await watchOnce();
  expect(depthOverlayState.value.on).toBe(false);
});

test('the sounder alarms at sea and without any position', async () => {
  shallowLake();
  setZoneSim('mer');
  state.view.lastFix.value = null;
  nmeaSet('depth', 1.5);
  startDepthWatch();
  await watchOnce();
  expect(depthOverlayState.value).toMatchObject({
    on: true,
    title: 'Fond ≈ 1,5 m · sondeur',
  });
});

test('the alarm follows the GPS by itself, without any recording', async () => {
  shallowLake();
  state.view.lastFix.value = null;
  cells.lemanDepthAt.mockResolvedValue(1.5);
  type OnFix = (fix: {
    coords: { latitude: number; longitude: number; accuracy: number };
  }) => void;
  const gps: { onFix?: OnFix } = {};
  const clearWatch = vi.fn();
  vi.stubGlobal('navigator', {
    geolocation: {
      clearWatch,
      watchPosition: vi.fn((success: OnFix) => {
        gps.onFix = success;
        return 7;
      }),
    },
  });
  startDepthWatch();
  await watchOnce();
  expect(depthOverlayState.value.on).toBe(false);
  const coords = { latitude: 46.5, longitude: 6.5 };
  gps.onFix?.({ coords: { ...coords, accuracy: 200 } });
  await watchOnce();
  expect(depthOverlayState.value.on).toBe(false);
  gps.onFix?.({ coords: { ...coords, accuracy: 8 } });
  await watchOnce();
  expect(depthOverlayState.value).toMatchObject({
    on: true,
    title: 'Fond ≈ 1,5 m',
  });
  vi.setSystemTime(NOW + 60_000);
  await watchOnce();
  expect(depthOverlayState.value.on).toBe(false);
  setZoneSim('mer');
  await watchOnce();
  expect(clearWatch).toHaveBeenCalledWith(7);
  vi.unstubAllGlobals();
});

test('the position of the boat serves the alarm too', async () => {
  shallowLake();
  state.view.lastFix.value = null;
  cells.lemanDepthAt.mockResolvedValue(1.5);
  nmeaSet('lat', 46.5);
  nmeaSet('lon', 6.5);
  startDepthWatch();
  await watchOnce();
  expect(cells.lemanDepthAt).toHaveBeenCalledWith(46.5, 6.5);
  expect(depthOverlayState.value.on).toBe(true);
});
