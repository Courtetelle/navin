import { beforeEach, expect, test } from 'vitest';

import {
  blankCruise,
  setCruise,
  setZoneSim,
  state,
  updateCruise,
} from '../../../state/index.ts';
import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import type { DepthContour } from '../depthEstimate.ts';
import {
  depthIntensity,
  estimateDepth,
  segmentDistance,
  sondeMin,
} from '../depthEstimate.ts';

const SAVANNAH_SOUNDING = 2.2;
const LAT = 46.5;
const LON = 6.6;
const METRES_PER_LON = 111_320 * Math.cos((LAT * Math.PI) / 180);

/** A north-south contour `metres` east of the test position. */
function contourAt(metres: number, depth: number): DepthContour {
  const lon = LON + metres / METRES_PER_LON;
  return {
    d: depth,
    bb: [LAT - 0.01, lon, LAT + 0.01, lon],
    pts: [
      [LAT - 0.01, lon],
      [LAT + 0.01, lon],
    ],
  };
}

beforeEach(() => {
  initState(createMemoryStorage());
});

test('the distance to a segment is the distance to its closest point', () => {
  expect(
    segmentDistance(
      LAT,
      LON,
      [LAT - 0.01, LON + 0.001],
      [LAT + 0.01, LON + 0.001],
    ),
  ).toBeCloseTo(0.001 * METRES_PER_LON, 6);
  expect(
    segmentDistance(LAT, LON, [LAT + 0.001, LON], [LAT + 0.002, LON]),
  ).toBeCloseTo(110.54, 6);
  expect(segmentDistance(LAT, LON, [LAT, LON], [LAT, LON])).toBe(0);
});

test('between two contours the depth is interpolated by distance', () => {
  expect(estimateDepth([contourAt(10, 2), contourAt(-30, 4)], LAT, LON)).toBe(
    2.5,
  );
  expect(estimateDepth([contourAt(20, 1), contourAt(-20, 5)], LAT, LON)).toBe(
    3,
  );
});

test('a single contour counts only when the boat is on it', () => {
  expect(estimateDepth([contourAt(10, 3)], LAT, LON)).toBe(3);
  expect(estimateDepth([contourAt(100, 3)], LAT, LON)).toBeNull();
});

test('contours beyond 250 m or missing give no estimate', () => {
  expect(estimateDepth([contourAt(300, 3)], LAT, LON)).toBeNull();
  expect(estimateDepth([], LAT, LON)).toBeNull();
});

test('the two closest contours of different levels are used', () => {
  expect(
    estimateDepth(
      [contourAt(10, 2), contourAt(40, 2), contourAt(-30, 4), contourAt(5, 2)],
      LAT,
      LON,
    ),
  ).toBe(2.3);
});

test('the alarm rises from the start margin down to the minimum sounding', () => {
  expect(depthIntensity(3, 2, 1)).toBe(0);
  expect(depthIntensity(3.5, 2, 1)).toBe(0);
  expect(depthIntensity(2.5, 2, 1)).toBe(0.5);
  expect(depthIntensity(2, 2, 1)).toBe(1);
  expect(depthIntensity(1, 2, 1)).toBe(1);
  expect(depthIntensity(2.75, 2, 2)).toBe(0.625);
  expect(depthIntensity(null, 2, 1)).toBe(0);
  expect(depthIntensity(2, null, 1)).toBe(0);
});

test('the minimum sounding is the boat value, else the draft plus the pilot foot', () => {
  setCruise(blankCruise('Essai'));
  updateCruise((cruise) => {
    cruise.info.draft = '1,5';
  });
  expect(sondeMin()).toBe(2.1);
  updateCruise((cruise) => {
    cruise.info.draftPilot = '2,8';
  });
  expect(sondeMin()).toBe(2.8);
});

test('without an outing, a lake uses the draft of Savannah', () => {
  const [first, ...others] = state.data.boats.value;
  const savannah = others.find((boat) => boat.id === 'savannah') ?? first;
  if (!first || !savannah) throw new Error('missing boats');
  state.data.boats.value = [
    { ...first, id: 'autre', info: { ...first.info, draftPilot: '9' } },
    { ...savannah, id: 'savannah', info: { draft: '1,53' } },
  ];
  setZoneSim('lac');
  expect(sondeMin()).toBe(SAVANNAH_SOUNDING);
  setZoneSim('mer');
  expect(sondeMin()).toBe(9);
  setZoneSim('lac');
  setCruise(blankCruise('Essai'));
  updateCruise((cruise) => {
    cruise.info.draftPilot = '2,8';
  });
  expect(sondeMin()).toBe(2.8);
});
