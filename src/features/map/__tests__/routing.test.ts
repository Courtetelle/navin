import { afterEach, describe, expect, it, vi } from 'vitest';

import { destination } from '../../../lib/geo.ts';
import { forgetOpenMeteo } from '../../../lib/openMeteo.ts';
import type { BoatPolar } from '../../../model/polars.ts';
import type { NavRoute } from '../../../model/routes.ts';
import { boatSailSpeed, runRouting } from '../routingRun.ts';
import { fetchRouteWind, windAt, windPlaces } from '../routingWeather.ts';

const START = { lat: 48.65, lon: -2.83 };
const END = destination(START, 0, 12);
const HOUR0 = Date.UTC(2027, 5, 12, 0);

const polar: BoatPolar = {
  polar: {
    twa: [40, 90, 180],
    tws: [6, 16],
    kn: [
      [4, 6],
      [6, 8],
      [4, 6],
    ],
  },
  from: 'hand',
  label: 'Essai',
  coef: 1,
  at: '',
};

const route: NavRoute = {
  id: 'r1',
  name: 'Portrieux – Bréhat',
  at: '',
  mod: '',
  points: [START, END],
  speed: 6,
};

function reply(places: number, twd: number, tws: number) {
  const time = Array.from(
    { length: 48 },
    (_, hour) => HOUR0 / 1000 + hour * 3600,
  );
  const one = {
    hourly: {
      time,
      // eslint-disable-next-line camelcase -- name in the API
      wind_speed_10m: time.map(() => tws),
      // eslint-disable-next-line camelcase -- name in the API
      wind_direction_10m: time.map(() => twd),
    },
  };
  return places === 1 ? one : Array.from({ length: places }, () => one);
}

afterEach(() => {
  vi.unstubAllGlobals();
  forgetOpenMeteo();
});

describe('windPlaces', () => {
  it('spaces places along the route, its points among them', () => {
    const places = windPlaces([START, END]);
    expect(places[0]).toStrictEqual(START);
    expect(places.at(-1)).toStrictEqual(END);
    expect(places.length).toBeGreaterThan(5);
    expect(places.length).toBeLessThanOrEqual(12);
    expect(windPlaces([])).toStrictEqual([]);
  });
});

describe('windAt', () => {
  const wind = {
    places: [START, END],
    hours: [HOUR0, HOUR0 + 3_600_000],
    speed: [
      [10, 10],
      [5, 5],
    ],
    from: [
      [350, 10],
      [90, 90],
    ],
    model: 'best_match',
  };
  it('reads the nearest place between its hours, the short way round', () => {
    const at = windAt(wind, START.lat, START.lon, HOUR0 + 1_800_000);
    expect(at?.tws).toBeCloseTo(10);
    expect(Math.min(at?.twd ?? 99, 360 - (at?.twd ?? 99))).toBeLessThan(1);
    expect(windAt(wind, END.lat, END.lon, HOUR0)?.twd).toBeCloseTo(90);
  });
  it('has no wind out of the forecast', () => {
    expect(windAt(wind, START.lat, START.lon, HOUR0 + 7_200_000)).toBeNull();
  });
});

describe('fetchRouteWind', () => {
  it('asks once for all the places', async () => {
    const fetcher = vi.fn((url: string) => {
      const count =
        new URL(url).searchParams.get('latitude')?.split(',').length ?? 1;
      return Promise.resolve(Response.json(reply(count, 270, 12)));
    });
    vi.stubGlobal('fetch', fetcher);
    const wind = await fetchRouteWind([START, END], 'ecmwf_ifs025');
    if ('error' in wind) throw new Error(wind.error);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain('models=ecmwf_ifs025');
    expect(wind.speed).toHaveLength(wind.places.length);
  });
  it('says when Open-Meteo refuses or there is no network', async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('', { status: 429 })),
    );
    const refused = await fetchRouteWind([START, END], 'best_match');
    expect('error' in refused && refused.error).toMatch(/limite/);
    forgetOpenMeteo();
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    const offline = await fetchRouteWind([START, END], 'best_match');
    expect('error' in offline && offline.error).toMatch(/réseau/);
  });
});

describe('boatSailSpeed', () => {
  it('takes the polar with its share, or a set of sails that did better', () => {
    const speed = boatSailSpeed({ ...polar, coef: 0.5 }, [
      {
        sails: 'GV haute · Code 0',
        from: '',
        to: '',
        bins: {
          '90|10': { n: 5, best: [7.5] },
          '90|6': { n: 1, best: [9] },
        },
      },
    ]);
    expect(speed(90, 10)).toStrictEqual({
      kn: 7.5,
      sails: 'GV haute · Code 0',
    });
    expect(speed(90, 6)).toStrictEqual({ kn: 3, sails: 'Polaire' });
    expect(speed(10, 6).kn).toBe(0);
  });
});

describe('runRouting', () => {
  it('routes the boat with the forecast', async () => {
    vi.stubGlobal('fetch', (url: string) => {
      const count =
        new URL(url).searchParams.get('latitude')?.split(',').length ?? 1;
      return Promise.resolve(Response.json(reply(count, 270, 12)));
    });
    const run = await runRouting(
      route,
      { id: 'b', info: {}, polar },
      HOUR0 + 6 * 3_600_000,
      { motorBelow: 5, motorKn: 6, model: 'best_match', boatId: 'b' },
    );
    if (run.kind !== 'result' || run.result.kind !== 'done') {
      throw new Error('no routing');
    }
    expect(run.result.nm).toBeCloseTo(12, 0);
    expect(run.result.motorMin).toBe(0);
  });
  it('needs two points and a polar', async () => {
    const prefs = {
      motorBelow: 5,
      motorKn: 6,
      model: 'best_match',
      boatId: '',
    };
    const short = await runRouting(
      { ...route, points: [START] },
      { id: 'b', info: {}, polar },
      0,
      prefs,
    );
    expect(short.kind).toBe('error');
    const bare = await runRouting(route, { id: 'b', info: {} }, 0, prefs);
    expect(bare.kind === 'error' && bare.error).toMatch(/polaire/);
  });
});
