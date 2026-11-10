import { expect, test } from 'vitest';

import { rulerText } from '../rulerText.ts';

test('a short gap is also given in metres, the course on three digits', () => {
  expect(rulerText({ lat: 46.45, lon: 6.6 }, { lat: 46.4545, lon: 6.6 })).toBe(
    '0,27 NM (500 m) · cap 000°',
  );
});

test('a long one in nautical miles only', () => {
  expect(rulerText({ lat: 43, lon: 5 }, { lat: 43, lon: 6 })).toMatch(
    /^43,\d NM · cap 09[01]°$/u,
  );
});
