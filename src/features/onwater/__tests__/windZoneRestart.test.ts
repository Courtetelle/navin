import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { initState, setZoneSim } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';

const restart = vi.fn();
vi.mock('../windWatch.ts', () => ({
  windWatchRestart: restart,
  windWatchStart: () => undefined,
  windReminderTick: () => undefined,
}));
vi.mock('../liveRecorder.ts', () => ({ recordAround: () => undefined }));

// The watch listens to the touches of the page: a page with none here.
vi.stubGlobal('document', { addEventListener: () => undefined, hidden: false });

const { startWindWatch } = await import('../windStart.ts');

beforeEach(() => {
  initState(createMemoryStorage({}));
  vi.useFakeTimers();
  restart.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

test('a new zone of navigation starts the wind alerts again, once', async () => {
  startWindWatch();
  setZoneSim('lac');
  setZoneSim('mer');
  await vi.advanceTimersByTimeAsync(1000);
  expect(restart).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  expect(restart).toHaveBeenCalledTimes(1);
  setZoneSim('auto');
  await vi.advanceTimersByTimeAsync(2000);
  expect(restart).toHaveBeenCalledTimes(2);
});
