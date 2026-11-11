import { expect, test } from 'vitest';

import { FIRST_SCALE, SCALES_NM, nextScale, scaleText } from '../navinScale.ts';

test('on the map, each touch shows the next scale, then 2 NM again', () => {
  const seen = [0];
  for (let i = 0; i < 3; i++) seen.push(nextScale(seen.at(-1) ?? 0, true));
  expect(seen.map((rank) => SCALES_NM[rank])).toStrictEqual([2, 30, 58, 2]);
});

test('coming from another screen, the map opens at 2 NM', () => {
  expect(SCALES_NM[nextScale(2, false)]).toBe(2);
  expect(nextScale(1, false)).toBe(FIRST_SCALE);
});

test('the scales read in nautical miles', () => {
  expect(scaleText(0)).toBe('2 NM');
  expect(scaleText(2)).toBe('58 NM');
});
