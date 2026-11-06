import { expect, test } from 'vitest';

import { BASE_LAKES, lakeTileUrls, vdWmsTiles } from '../lakes.ts';
import { trackerDashTexts } from '../trackerDash.ts';

test('lakeTileUrls keeps zoom 8 and above, buoyage from zoom 9', () => {
  const [leman] = BASE_LAKES;
  if (!leman) throw new Error('no lake');
  const jobs = lakeTileUrls(leman);
  const first = jobs[0];
  expect(first?.mode).toBe('cors');
  expect(first?.url.includes('/8/')).toBe(true);
  expect(jobs.some((job) => job.url.includes('seamark/8/'))).toBe(false);
  expect(jobs.some((job) => job.url.includes('seamark/9/'))).toBe(true);
});

test('vdWmsTiles covers the lake from zoom 10 to 15', () => {
  const tiles = vdWmsTiles('a,b');
  expect(tiles).toHaveLength(5006);
  expect(tiles[0]?.includes('layers=a%2Cb')).toBe(true);
});

test('trackerDashTexts shows dashes without values', () => {
  expect(
    trackerDashTexts({
      sog: null,
      cog: Number.NaN,
      distance: 0,
      duration: 0,
      top: 0,
      tracking: false,
    }),
  ).toStrictEqual({
    speed: '–',
    speedUnit: 'nd',
    course: '–',
    distance: '0,0',
    duration: '–',
    durationLabel: 'durée',
    top: '–',
  });
});

test('trackerDashTexts formats a recording', () => {
  expect(
    trackerDashTexts({
      sog: 5,
      cog: 359.6,
      distance: 1.26,
      duration: 3_900_000,
      top: 6.15,
      tracking: true,
    }),
  ).toStrictEqual({
    speed: '5,0',
    speedUnit: 'nd · 9 km/h',
    course: '000°',
    distance: '1,3',
    duration: '1 h 05',
    durationLabel: '⏺ en route',
    top: '6,2',
  });
});
