import { beforeEach, expect, test, vi } from 'vitest';

import { initState } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { lastWindAlertAt } from '../lastWindAlert.ts';

vi.mock('../overlayRoot.ts', () => ({ showOverlays: () => undefined }));

const { replayWindAlert, showWindAlert, windPopup } =
  await import('../windOverlayState.ts');

beforeEach(() => {
  initState(createMemoryStorage({}));
});

test('the last automatic alert can be shown again, with its time', () => {
  expect(replayWindAlert()).toBe(false);
  showWindAlert({ bf: 6, kn: '24 nd en rafales', where: 'mesuré à Pully' });
  expect(lastWindAlertAt()).not.toBe(null);
  windPopup.value = null;
  expect(replayWindAlert()).toBe(true);
  expect(windPopup.value?.kn).toBe('24 nd en rafales');
  expect(windPopup.value?.note).toMatch(/^🔁 Alerte de \d\d:\d\d$/u);
});
