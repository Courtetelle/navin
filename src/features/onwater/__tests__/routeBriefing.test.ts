/* eslint-disable camelcase -- names in the API */
import { expect, test } from 'vitest';

import { thresholdsOf } from '../../../model/goNoGo.ts';
import type { Polar } from '../../../model/polars.ts';
import { polarSpeed } from '../../../model/polars.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { setStorageBackend } from '../../../storage/store.ts';
import {
  keepRoutePacket,
  keptRouteForecast,
  positionAt,
  routeBriefing,
  routeCurrentAt,
  routeForecastOf,
  routePlaces,
  routePrompt,
  routeTrack,
  speedTrack,
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

function seaReply(hs: number, current?: { kmh: number; toward: number }) {
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
      ...(current
        ? {
            ocean_current_velocity: time.map(() => current.kmh),
            ocean_current_direction: time.map(() => current.toward),
          }
        : {}),
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
    POINTS,
    speedTrack(POINTS, 5, DAY + 7 * 3_600_000),
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
    'Départ lun. 23, 8 h de P1, arrivée vers lun. 23, 16 h à P3 : 40 NM en 8 h à 5 nd (vitesse prévue).',
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
    POINTS,
    speedTrack(POINTS, 5, DAY + 7 * 3_600_000),
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
    POINTS,
    speedTrack(POINTS, 5, DAY + 10 * 86_400_000),
    forecast,
    DUFOUR,
    null,
  );
  expect(late).toStrictEqual({
    error:
      'La route est hors de la prévision (7 jours au plus) : choisissez un départ plus proche.',
  });
  const half = routeBriefing(
    POINTS,
    speedTrack(POINTS, 5, DAY + 44 * 3_600_000),
    forecast,
    DUFOUR,
    null,
  );
  if ('error' in half) throw new Error(half.error);
  expect(half.missing).toBeGreaterThan(0);
  expect(half.lines.join(' ')).toMatch(/hors de la prévision/u);
  expect(half.lines.join(' ')).toMatch(/pas de prévision de vagues/u);
  expect(
    routeBriefing([START], speedTrack([START], 5, DAY), forecast, DUFOUR, null),
  ).toHaveProperty('error');
  expect(
    routeBriefing(POINTS, speedTrack(POINTS, 0, DAY), forecast, DUFOUR, null),
  ).toHaveProperty('error');
  expect(routeForecastOf(places, null, null, false)).toBeNull();
});

const POLAR: Polar = {
  twa: [40, 60, 90, 120, 150, 180],
  tws: [6, 10, 16],
  kn: [
    [4, 5.5, 6.5],
    [5, 6.5, 7.2],
    [5.5, 7, 7.8],
    [5.3, 6.9, 8],
    [4.2, 5.8, 7.2],
    [3.5, 5, 6.5],
  ],
};
const BOAT = {
  polar: POLAR,
  sailSpeed: (twa: number, tws: number) => ({
    kn: polarSpeed(POLAR, twa, tws, 1),
    sails: 'Polaire',
  }),
  motorBelow: 3,
  motorKn: 6,
};

function forecastWith(current?: { kmh: number; toward: number }) {
  const places = routePlaces(POINTS);
  const forecast = routeForecastOf(
    places,
    places.map(() => weatherReply(() => 12)),
    places.map(() => seaReply(1, current)),
    false,
  );
  if (!forecast) throw new Error('no forecast');
  return forecast;
}

test('the times come from the polar routing, the currents in the light', () => {
  const depart = DAY + 7 * 3_600_000;
  const still = routeTrack(POINTS, depart, forecastWith(), BOAT, 5);
  expect(still.note).toBeNull();
  expect(still.track.routed).toBe(true);
  expect(still.track.how).toMatch(/^au routage polaire/u);
  // Across then before a wind of 12 kn: faster than 5 kn.
  expect(still.track.arriveMs).toBeLessThan(depart + 8 * 3_600_000);
  // A current of 1 kn (1,852 km/h) going north, with the first leg.
  const helped = routeTrack(
    POINTS,
    depart,
    forecastWith({ kmh: 1.852, toward: 0 }),
    BOAT,
    5,
  );
  const briefing = routeBriefing(
    POINTS,
    helped.track,
    forecastWith({ kmh: 1.852, toward: 0 }),
    DUFOUR,
    null,
  );
  if ('error' in briefing) throw new Error(briefing.error);
  expect(briefing.routed).toBe(true);
  expect(briefing.legs[0]?.currentMax).toBeCloseTo(1, 5);
  expect(briefing.lines.join(' ')).toMatch(/Courants : jusqu’à 1 nd porteur/u);
  // Without a polar, the planned speed, and why.
  const bySpeed = routeTrack(POINTS, depart, forecastWith(), null, 5);
  expect(bySpeed.track.routed).toBe(false);
  expect(bySpeed.note).toMatch(/pas de polaire/u);
  // Out of the forecast: the planned speed, and when.
  const late = routeTrack(
    POINTS,
    DAY + 47 * 3_600_000,
    forecastWith(),
    BOAT,
    5,
  );
  expect(late.note).toMatch(/sort de la prévision/u);
});

test('currents: the Atlantic yes, the Mediterranean out of its straits no', () => {
  const porquerolles = { lat: 43.0003, lon: 6.2023 };
  const forecast = routeForecastOf(
    [porquerolles],
    weatherReply(() => 10),
    seaReply(0.5, { kmh: 3, toward: 90 }),
    false,
  );
  if (!forecast) throw new Error('no forecast');
  expect(
    routeCurrentAt(forecast)(porquerolles.lat, porquerolles.lon, DAY),
  ).toBeNull();
  const brittany = forecastWith({ kmh: 3.704, toward: 180 });
  expect(routeCurrentAt(brittany)(START.lat, START.lon, DAY)).toStrictEqual({
    kn: 2,
    toward: 180,
  });
});

test('the forecast of a route is kept for offline, while its points stay', () => {
  setStorageBackend(createMemoryStorage({}));
  const forecast = forecastWith();
  expect(keepRoutePacket('r1', POINTS, forecast)).toBe(true);
  expect(keptRouteForecast('r1', POINTS)?.places).toHaveLength(6);
  expect(keptRouteForecast('r1', [START, EAST])).toBeNull();
  expect(keptRouteForecast('r2', POINTS)).toBeNull();
  for (const id of ['a', 'b', 'c', 'd']) keepRoutePacket(id, POINTS, forecast);
  // The newest four only.
  expect(keptRouteForecast('r1', POINTS)).toBeNull();
  expect(keptRouteForecast('d', POINTS)).not.toBeNull();
});
