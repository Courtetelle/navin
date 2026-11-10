import { expect, test } from 'vitest';

import { FIRST_SCALE, SCALES_NM, nextScale, scaleText } from '../navinScale.ts';

test('on the map, each touch shows the next scale, then the detailed map again', () => {
  const seen = [0];
  for (let i = 0; i < 4; i++) seen.push(nextScale(seen.at(-1) ?? 0, true));
  expect(seen.map((rank) => SCALES_NM[rank])).toStrictEqual([
    0.5, 2, 30, 58, 0.5,
  ]);
});

test('coming from another screen, the map opens at 2 NM', () => {
  expect(SCALES_NM[nextScale(3, false)]).toBe(2);
  expect(nextScale(0, false)).toBe(FIRST_SCALE);
});

test('the scales read in nautical miles', () => {
  expect(scaleText(0)).toBe('Carte détaillée · 0,5 NM');
  expect(scaleText(2)).toBe('30 NM');
});
