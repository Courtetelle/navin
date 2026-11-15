import { expect, test } from 'vitest';

import { qrPath } from '../qrPath.ts';

test('a long key fits in one QR code, its quiet zone around it', () => {
  const { size, d } = qrPath(
    `https://courtetelle.github.io/navin/#cle=mf.${'a'.repeat(900)}`,
  );
  expect(size).toBeGreaterThan(100);
  expect(size).toBeLessThan(190);
  expect(d.startsWith('M4 4h1v1h-1z')).toBe(true);
});
