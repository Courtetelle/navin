import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { initState, setZoneSim } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';

vi.mock('../overlayRoot.ts', () => ({ showOverlays: () => undefined }));
vi.mock('../windAudio.ts', () => ({ playAlarm: () => undefined }));

const { replayWindAlert, showWindAlert, windPopup } =
  await import('../windOverlayState.ts');
const { windTestToggle, windTestRunning } = await import('../windTest.ts');
const { WIND_POP_DELAY } = await import('../windLogic.ts');
const { beaufortSea } = await import('../onLake.ts');

beforeEach(() => {
  initState(createMemoryStorage({}));
  vi.useFakeTimers();
});

afterEach(() => {
  if (windTestRunning.peek()) windTestToggle();
  vi.useRealTimers();
});

test('on a lake the test alert shows no waves, not even invented ones', () => {
  setZoneSim('lac');
  windTestToggle();
  vi.advanceTimersByTime(WIND_POP_DELAY + 10);
  const shown = windPopup.peek();
  expect(shown?.bf).toBe(4);
  expect(shown?.sea ?? '').toBe('');
  expect(shown?.omm ?? '').toBe('');
});

test('at sea the test alert keeps its sea state', () => {
  setZoneSim('mer');
  windTestToggle();
  vi.advanceTimersByTime(WIND_POP_DELAY + 10);
  expect(windPopup.peek()?.sea).toMatch(/vagues/u);
});

test('an alert kept with waves comes back without them on a lake', () => {
  setZoneSim('mer');
  showWindAlert({
    bf: 6,
    kn: '24 nd',
    where: 'mesuré à Pully',
    sea: 'modèle ici : mer 3 peu agitée, vagues 0,8 m',
    omm: 'théorique OMM : mer 4',
  });
  setZoneSim('lac');
  replayWindAlert();
  const shown = windPopup.peek();
  expect(shown?.kn).toBe('24 nd');
  expect(shown?.sea).toBe('');
  expect(shown?.omm).toBe('');
});

test('the bubble describes the sea of the force at sea only, never on a lake', () => {
  setZoneSim('mer');
  expect(beaufortSea(5)).toMatch(/[Vv]agues/u);
  setZoneSim('lac');
  expect(beaufortSea(5)).toBe('');
});
