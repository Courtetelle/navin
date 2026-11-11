import { expect, test } from 'vitest';

import { LEMAN_BOX, SWISS_BOX, boxesMeet } from '../regionalLayers.ts';

const SAINT_MALO = { s: 48.5, n: 48.8, w: -2.2, e: -1.8 };
const LAUSANNE = { s: 46.45, n: 46.55, w: 6.55, e: 6.7 };
const BERN = { s: 46.9, n: 47, w: 7.4, e: 7.5 };

test('the Lake Geneva entries only when a part of the lake shows', () => {
  expect(boxesMeet(LAUSANNE, LEMAN_BOX)).toBe(true);
  expect(boxesMeet(SAINT_MALO, LEMAN_BOX)).toBe(false);
  expect(boxesMeet(BERN, LEMAN_BOX)).toBe(false);
});

test('the Swiss entries only over Switzerland', () => {
  expect(boxesMeet(BERN, SWISS_BOX)).toBe(true);
  expect(boxesMeet(SAINT_MALO, SWISS_BOX)).toBe(false);
});
