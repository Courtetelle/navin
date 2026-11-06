import { expect, test } from 'vitest';

import { sunEvents, sunTimes } from '../sun.ts';

const LAUSANNE = [46.52, 6.63] as const;
const local = (time: number) =>
  new Intl.DateTimeFormat('fr-CH', {
    timeZone: 'Europe/Zurich',
    hour: '2-digit',
    minute: '2-digit',
  }).format(time);
const minutes = (clock: string) => {
  const [hours, mins] = clock.split(':').map(Number);
  return (hours as number) * 60 + (mins as number);
};

test('sunrise and sunset at Lausanne at the solstices', () => {
  const june = sunTimes(Date.UTC(2026, 5, 21, 12), ...LAUSANNE);
  const december = sunTimes(Date.UTC(2026, 11, 21, 12), ...LAUSANNE);
  // Almanac values: 05:38 / 21:29 in June, 08:18 / 16:50 in December.
  expect(Math.abs(minutes(local(june?.rise ?? 0)) - 338)).toBeLessThan(6);
  expect(Math.abs(minutes(local(june?.set ?? 0)) - 1289)).toBeLessThan(6);
  expect(Math.abs(minutes(local(december?.rise ?? 0)) - 498)).toBeLessThan(6);
  expect(Math.abs(minutes(local(december?.set ?? 0)) - 1010)).toBeLessThan(6);
});

test('no sunrise in the polar summer', () => {
  expect(sunTimes(Date.UTC(2026, 5, 21, 12), 78, 15)).toBeNull();
});

test('only the events during the period count', () => {
  const noon = Date.UTC(2026, 5, 21, 12);
  const hour = 3_600_000;
  expect(sunEvents(noon - hour, noon + hour, ...LAUSANNE)).toStrictEqual([]);
  expect(
    sunEvents(noon, noon + 10 * hour, ...LAUSANNE).map((event) => event.kind),
  ).toStrictEqual(['set']);
  expect(
    sunEvents(noon, noon + 24 * hour, ...LAUSANNE).map((event) => event.kind),
  ).toStrictEqual(['set', 'rise']);
});
