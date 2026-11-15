import { expect, test } from 'vitest';

import { reOnDue } from '../windReOn.ts';

test('alerts switched off come back on as chosen', () => {
  expect(reOnDue('launch', 'launch', '2026-11-15', '2026-11-15')).toBe(true);
  expect(reOnDue('launch', 'tick', '2026-11-14', '2026-11-15')).toBe(false);
  expect(reOnDue('trace', 'trace', '2026-11-15', '2026-11-15')).toBe(true);
  expect(reOnDue('trace', 'launch', '2026-11-15', '2026-11-15')).toBe(false);
  expect(reOnDue('midnight', 'tick', '2026-11-15', '2026-11-15')).toBe(false);
  expect(reOnDue('midnight', 'tick', '2026-11-14', '2026-11-15')).toBe(true);
  expect(reOnDue('midnight', 'launch', '2026-11-14', '2026-11-15')).toBe(true);
  expect(reOnDue('never', 'launch', '2026-11-14', '2026-11-15')).toBe(false);
});
