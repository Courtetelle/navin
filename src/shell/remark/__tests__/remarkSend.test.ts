import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { remarks, saveRemarks } from '../remarkContext.ts';
import { copyPendingRemarks } from '../remarkSend.ts';

const written = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  });
  written.mockReset();
  written.mockResolvedValue();
  vi.stubGlobal('navigator', { clipboard: { writeText: written } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const remark = (text: string, flags = {}) => ({
  t: '2026-11-06T10:00:00.000Z',
  text,
  sent: false,
  ...flags,
});

test('copies only the waiting remarks, then only the new ones', async () => {
  saveRemarks([
    remark('sent', { sent: true }),
    remark('first'),
    remark('second'),
  ]);
  await expect(copyPendingRemarks()).resolves.toBe(2);
  expect(written).toHaveBeenCalledWith('first\n\n――――\n\nsecond');
  expect(remarks().map((item) => item.copied)).toEqual([undefined, true, true]);

  written.mockClear();
  await expect(copyPendingRemarks()).resolves.toBe(0);
  expect(written).not.toHaveBeenCalled();
});

test('keeps the remarks waiting when the copy fails', async () => {
  saveRemarks([remark('first')]);
  written.mockRejectedValue(new Error('refused'));
  await expect(copyPendingRemarks()).rejects.toThrow('refused');
  expect(remarks()[0]?.copied).toBeUndefined();
});
