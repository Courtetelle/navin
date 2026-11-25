import { expect, test } from 'vitest';

import {
  isRoute,
  midpoint,
  pointName,
  routeDuration,
  routeLabel,
  routeLegs,
  routeNm,
  routeTimes,
  routeToGpx,
} from '../routes.ts';

// Saint-Quay-Portrieux, then 6 NM due north, then 6 NM due east.
const PORTRIEUX = { lat: 48.6521, lon: -2.8306 };
const NORTH = { lat: 48.7521, lon: -2.8306 };
const EAST = { lat: 48.7521, lon: -2.6787 };

test('each leg has its course and distance, and the total adds up', () => {
  const legs = routeLegs([PORTRIEUX, NORTH, EAST]);
  expect(legs).toHaveLength(2);
  expect(legs[0]?.course).toBe(0);
  expect(legs[0]?.nm).toBeCloseTo(6, 1);
  expect(legs[1]?.course).toBe(90);
  expect(legs[1]?.nm).toBeCloseTo(6, 0);
  expect(routeNm([PORTRIEUX, NORTH, EAST])).toBeCloseTo(
    (legs[0]?.nm ?? 0) + (legs[1]?.nm ?? 0),
    6,
  );
  expect(routeLegs([PORTRIEUX])).toStrictEqual([]);
  expect(routeNm([])).toBe(0);
});

test('the times of passage follow the speed from the departure', () => {
  const route = {
    points: [PORTRIEUX, NORTH],
    speed: 6,
    depart: '2027-06-12T06:00:00.000Z',
  };
  const times = routeTimes(route);
  expect(times?.[0]).toBe(Date.parse('2027-06-12T06:00:00.000Z'));
  // 6 NM at 6 knots: about one hour later.
  expect(((times?.[1] ?? 0) - (times?.[0] ?? 0)) / 60_000).toBeCloseTo(60, 0);
  expect(routeTimes({ ...route, depart: null })).toBeNull();
  expect(routeTimes({ ...route, speed: 0 })).toBeNull();
  expect(routeDuration(route) / 60_000).toBeCloseTo(60, 0);
  expect(routeDuration({ ...route, speed: 0 })).toBe(0);
});

test('points are read by their name or their rank', () => {
  const points = [PORTRIEUX, { ...NORTH, name: ' Roches de Saint-Quay ' }];
  expect(pointName(points, 0)).toBe('P1');
  expect(pointName(points, 1)).toBe('Roches de Saint-Quay');
  expect(midpoint(PORTRIEUX, NORTH)).toStrictEqual({
    lat: 48.7021,
    lon: -2.8306,
  });
});

test('a route goes out as a GPX route, its texts escaped', () => {
  const gpx = routeToGpx({
    name: 'Portrieux & Bréhat',
    points: [PORTRIEUX, NORTH],
  });
  expect(gpx).toContain('<rte><name>Portrieux &amp; Bréhat</name>');
  expect(gpx).toContain(
    '<rtept lat="48.6521" lon="-2.8306"><name>P1</name></rtept>',
  );
  expect(gpx.match(/<rtept /g)).toHaveLength(2);
});

test('only usable routes are taken from another device', () => {
  const good = {
    id: 'r1',
    name: 'R',
    at: '',
    mod: '',
    points: [PORTRIEUX],
    speed: 6,
  };
  expect(isRoute(good)).toBe(true);
  expect(isRoute({ ...good, id: '' })).toBe(false);
  expect(isRoute({ ...good, points: [{ lat: 'x', lon: 2 }] })).toBe(false);
  expect(isRoute({ ...good, points: [{ lat: 91, lon: 2 }] })).toBe(false);
  expect(isRoute(null)).toBe(false);
});

function route(id: string, name: string): never {
  return { id, name, points: [], speed: 6 } as never;
}

test('routeLabel gives the number and the name of a route, no date', () => {
  const routes = [
    route('a', 'Route 1'),
    route('b', 'Portrieux → Bréhat'),
    route('c', 'Route 2 · routage 25/11/2026 19:00'),
  ];
  expect(routeLabel(routes[0] as never, routes)).toBe('Route 1');
  expect(routeLabel(routes[1] as never, routes)).toBe(
    'Route 2 · Portrieux → Bréhat',
  );
  expect(routeLabel(routes[2] as never, routes)).toBe('Route 2');
});
