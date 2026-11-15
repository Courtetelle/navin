import { expect, test } from 'vitest';

import { flashColor, windColors, zoneColor } from '../windLogic.ts';
import type { WindReading } from '../windTypes.ts';

test('the zone of a forecast alert takes the colour of a station badge', () => {
  const reading = { avg: 14, gust: 22, zoneKm: 6 } as WindReading;
  expect(zoneColor(reading, 'gust')).toBe(windColors(22).color);
  expect(zoneColor(reading, 'gust')).toBe(flashColor(2));
  expect(zoneColor(reading, 'avg')).toBe(windColors(14).color);
  expect(zoneColor({ avg: 5, gust: 8 } as WindReading, 'gust')).toBe(
    windColors(8).color,
  );
});
