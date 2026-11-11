import { expect, test } from 'vitest';

import { LONG_MS, pressKind } from '../pressFeedback.ts';

test('a press held as long as a long press is a long one', () => {
  expect(pressKind(80)).toBe('short');
  expect(pressKind(LONG_MS - 1)).toBe('short');
  expect(pressKind(LONG_MS)).toBe('long');
});
