import { expect, test } from 'vitest';

import { FIRST_SCALE, SCALES_NM, nextScale, scaleText } from '../navinScale.ts';

test('on the map, each touch shows the next scale, then 0,3 NM again', () => {
  const seen = [0];
  for (let i = 0; i < 4; i++) seen.push(nextScale(seen.at(-1) ?? 0, true));
  expect(seen.map((rank) => SCALES_NM[rank])).toStrictEqual([
    0.3, 3, 33, 99, 0.3,
  ]);
});

test('coming from another screen, the map opens at 3 NM', () => {
  expect(SCALES_NM[nextScale(3, false)]).toBe(3);
  expect(nextScale(1, false)).toBe(FIRST_SCALE);
});

test('the scales read in nautical miles', () => {
  expect(scaleText(0)).toBe('0,3 NM');
  expect(scaleText(3)).toBe('99 NM');
});
