/* eslint-disable camelcase -- names in the API */
import { expect, test } from 'vitest';

import { thresholdsOf } from '../../../model/goNoGo.ts';
import {
  positionAt,
  routeBriefing,
  routeForecastOf,
  routePlaces,
  routePrompt,
} from '../routeBriefing.ts';

const DUFOUR = thresholdsOf({
  loa: 13.6,
  ce: 'A',
  kind: 'monocoque',
  smallCrew: false,
});

// Saint-Quay-Portrieux, then 20 NM due north, then 20 NM due east.
const START = { lat: 48 + 39.126 / 60, lon: -(2 + 49.838 / 60) };
const NORTH = { lat: START.lat + 20 / 60, lon: START.lon, name: 'Large' };
const EAST = {
  lat: NORTH.lat,
  lon: NORTH.lon + 20 / 60 / Math.cos((NORTH.lat * Math.PI) / 180),
};
const POINTS = [START, NORTH, EAST];

/** Saturday 23 November 2026, 00 h UTC (1 h in Saint-Quay). */
const DAY = Date.UTC(2026, 10, 23);

/**
 * A reply of Open-Meteo for one place: 48 hours of local time from DAY.
 * @param wind - Wind of each hour (knots), from the west.
 * @returns The reply.
 */
function weatherReply(wind: (hour: number) => number) {
  const time: string[] = [];
  const speeds: number[] = [];
  for (let hour = 0; hour < 48; hour++) {
    time.push(
      new Date(DAY + (hour + 1) * 3_600_000).toISOString().slice(0, 16),
    );
    speeds.push(wind(hour));
  }
  return {
    utc_offset_seconds: 3600,
    hourly: {
      time,
      wind_speed_10m: speeds,
      wind_direction_10m: speeds.map(() => 270),
      wind_gusts_10m: speeds.map((value) => value * 1.3),
      pressure_msl: speeds.map(() => 1015),
    },
  };
}

function seaReply(hs: number) {
  const time: string[] = [];
  for (let hour = 0; hour < 48; hour++) {
    time.push(
      new Date(DAY + (hour + 1) * 3_600_000).toISOString().slice(0, 16),
    );
  }
  return {
    hourly: {
      time,
      wave_height: time.map(() => hs),
      wave_period: time.map(() => 8),
    },
  };
}

test('places are spread along the route, start and end among them', () => {
  const places = routePlaces(POINTS);
  expect(places).toHaveLength(6);
  expect(places[0]?.lat).toBeCloseTo(START.lat, 5);
  expect(places.at(-1)?.lon).toBeCloseTo(EAST.lon, 3);
  expect(routePlaces([START])).toHaveLength(1);
  expect(routePlaces([])).toHaveLength(0);
});

test('the boat is on the leg its miles reach', () => {
  expect(positionAt(POINTS, 10).leg).toBe(0);
  expect(positionAt(POINTS, 10).course).toBe(0);
  expect(positionAt(POINTS, 30).leg).toBe(1);
  expect(positionAt(POINTS, 30).course).toBe(90);
  expect(positionAt(POINTS, 99).at.lon).toBeCloseTo(EAST.lon, 3);
});

test('a calm route is a go, the point of sail follows each leg', () => {
  const places = routePlaces(POINTS);
  const forecast = routeForecastOf(
    places,
    places.map(() => weatherReply(() => 12)),
    places.map(() => seaReply(1)),
    false,
  );
  expect(forecast).not.toBeNull();
  if (!forecast) return;
  // Departure at 8 h local, 40 NM at 5 kn: arrival at 16 h.
  const briefing = routeBriefing(
    { points: POINTS, speed: 5 },
    DAY + 7 * 3_600_000,
    forecast,
    DUFOUR,
    null,
  );
  if ('error' in briefing) throw new Error(briefing.error);
  expect(briefing.verdict.light).toBe('go');
  // 8 h to 16 h, the arrival hour included.
  expect(briefing.hours.length).toBeGreaterThanOrEqual(9);
  expect(briefing.hours.length).toBeLessThanOrEqual(10);
  expect(briefing.missing).toBe(0);
  // Wind from the west: north is across it, east runs before it.
  expect(briefing.legs[0]?.points).toStrictEqual(['travers']);
  expect(briefing.legs[1]?.points).toStrictEqual(['portant']);
  expect(briefing.lines[0]).toBe(
    'Départ lun. 23, 8 h de P1, arrivée vers lun. 23, 16 h à P3 : 40 NM en 8 h à 5 nd.',
  );
  expect(routePrompt('Essai', briefing)).toMatch(
    /Avis de NavIn sur la route : Go/u,
  );
});

test('wind rising on the second leg: a no-go there, under force 7', () => {
  const places = routePlaces(POINTS);
  const forecast = routeForecastOf(
    places,
    // From 13 h local (hour 12 of the reply), 28 knots.
    places.map(() => weatherReply((hour) => (hour >= 12 ? 28 : 12))),
    places.map(() => seaReply(1)),
    false,
  );
  if (!forecast) throw new Error('no forecast');
  const briefing = routeBriefing(
    { points: POINTS, speed: 5 },
    DAY + 7 * 3_600_000,
    forecast,
    DUFOUR,
    null,
  );
  if ('error' in briefing) throw new Error(briefing.error);
  expect(briefing.verdict.light).toBe('nogo');
  expect(briefing.verdict.reasons.join(' ')).toMatch(/vent moyen 28 nd ≥ 27/u);
  expect(briefing.legs[0]?.light).not.toBe('nogo');
  expect(briefing.legs[1]?.light).toBe('nogo');
});

test('a departure out of the forecast says so', () => {
  const places = routePlaces(POINTS);
  const forecast = routeForecastOf(
    places,
    places.map(() => weatherReply(() => 12)),
    null,
    false,
  );
  if (!forecast) throw new Error('no forecast');
  const late = routeBriefing(
    { points: POINTS, speed: 5 },
    DAY + 10 * 86_400_000,
    forecast,
    DUFOUR,
    null,
  );
  expect(late).toStrictEqual({
    error:
      'La route est hors de la prévision (7 jours au plus) : choisissez un départ plus proche.',
  });
  const half = routeBriefing(
    { points: POINTS, speed: 5 },
    DAY + 44 * 3_600_000,
    forecast,
    DUFOUR,
    null,
  );
  if ('error' in half) throw new Error(half.error);
  expect(half.missing).toBeGreaterThan(0);
  expect(half.lines.join(' ')).toMatch(/hors de la prévision/u);
  expect(half.lines.join(' ')).toMatch(/pas de prévision de vagues/u);
  expect(
    routeBriefing({ points: [START], speed: 5 }, DAY, forecast, DUFOUR, null),
  ).toHaveProperty('error');
  expect(
    routeBriefing({ points: POINTS, speed: 0 }, DAY, forecast, DUFOUR, null),
  ).toHaveProperty('error');
  expect(routeForecastOf(places, null, null, false)).toBeNull();
});
