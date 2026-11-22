/* eslint-disable camelcase -- names in the API */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { forgetOpenMeteo } from '../../../lib/openMeteo.ts';
import {
  arrowSvg,
  barbOf,
  barbSvg,
  currentShown,
  fetchRainFrames,
  fetchSeaGrid,
  fetchWindGrid,
  gridPoints,
  hourRank,
  inMediterranean,
  localModel,
  rainFramesOf,
  rainTileUrl,
  seaGridOf,
  straitPoints,
  windColor,
  windGridOf,
} from '../mapWeather.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  forgetOpenMeteo();
});

describe('gridPoints', () => {
  const bay = { south: 48.4, west: -3.2, north: 48.9, east: -2.4 };

  it('takes the finest round spacing that fits', () => {
    const points = gridPoints(bay, 20);
    expect(points.length).toBeGreaterThan(4);
    expect(points.length).toBeLessThanOrEqual(20);
    for (const point of points) {
      expect(point.lat).toBeGreaterThanOrEqual(bay.south);
      expect(point.lat).toBeLessThanOrEqual(bay.north);
      expect(point.lon).toBeGreaterThanOrEqual(bay.west);
      expect(point.lon).toBeLessThanOrEqual(bay.east);
    }
  });

  it('gives the same points for a map moved a little: the same request', () => {
    const moved = { ...bay, south: 48.395, north: 48.905 };
    expect(gridPoints(moved, 20)).toEqual(gridPoints(bay, 20));
  });

  it('shifts the grid of the sea by half a spacing', () => {
    const wind = gridPoints(bay, 9);
    const sea = gridPoints(bay, 9, true);
    expect(sea.some((point) => wind.includes(point))).toBe(false);
    const lats = [...new Set(wind.map((point) => point.lat))];
    const seaLats = [...new Set(sea.map((point) => point.lat))];
    expect(Math.abs((seaLats[0] ?? 0) - (lats[0] ?? 0))).toBeGreaterThan(0);
  });

  it('falls back on the middle of a huge area', () => {
    const points = gridPoints({ south: 0, west: 0, north: 60, east: 60 }, 4);
    expect(points).toEqual([{ lat: 30, lon: 30 }]);
  });
});

describe('localModel', () => {
  it('takes MeteoSwiss on the Swiss lakes', () => {
    expect(localModel({ lat: 46.46, lon: 6.34 }).id).toBe(
      'meteoswiss_icon_ch1',
    );
  });

  it('takes AROME in the bay of Saint-Brieuc and at Porquerolles', () => {
    expect(localModel({ lat: 48.65, lon: -2.83 }).id).toBe(
      'meteofrance_arome_france_hd',
    );
    expect(localModel({ lat: 43, lon: 6.2 }).id).toBe(
      'meteofrance_arome_france_hd',
    );
  });

  it('takes the best model far away', () => {
    expect(localModel({ lat: 10, lon: -40 }).id).toBe('best_match');
  });
});

describe('currents shown', () => {
  it('shows the Channel and the Atlantic', () => {
    expect(inMediterranean({ lat: 48.65, lon: -2.83 })).toBe(false);
    expect(currentShown({ lat: 48.65, lon: -2.83 })).toBe(true);
    expect(currentShown({ lat: 45.5, lon: -1.5 })).toBe(true);
  });

  it('hides the open Mediterranean, shows its known straits', () => {
    expect(inMediterranean({ lat: 43, lon: 6.2 })).toBe(true);
    expect(currentShown({ lat: 43, lon: 6.2 })).toBe(false);
    expect(currentShown({ lat: 41.33, lon: 9.2 })).toBe(true);
    expect(currentShown({ lat: 35.95, lon: -5.6 })).toBe(true);
  });

  it('adds the middle of a strait in the area', () => {
    expect(
      straitPoints({ south: 41, west: 8.5, north: 41.6, east: 9.8 }),
    ).toEqual([{ lat: 41.325, lon: 9.175 }]);
    expect(
      straitPoints({ south: 42.9, west: 5.9, north: 43.2, east: 6.5 }),
    ).toEqual([]);
  });
});

describe('barbs', () => {
  it('rounds to 5 knots: pennants, feathers, half', () => {
    expect(barbOf(1)).toEqual({
      pennants: 0,
      full: 0,
      half: false,
      calm: true,
    });
    expect(barbOf(5)).toEqual({
      pennants: 0,
      full: 0,
      half: true,
      calm: false,
    });
    expect(barbOf(23)).toEqual({
      pennants: 0,
      full: 2,
      half: true,
      calm: false,
    });
    expect(barbOf(64)).toEqual({
      pennants: 1,
      full: 1,
      half: true,
      calm: false,
    });
  });

  it('draws a circle for a calm and turns the staff to the wind', () => {
    expect(barbSvg(0, 90, '#000')).toContain('<circle');
    const svg = barbSvg(15, 225, '#123456');
    expect(svg).toContain('rotate(225 28 28)');
    expect(svg).toContain('#123456');
  });

  it('colours the wind by Beaufort, red at the no-go', () => {
    expect(windColor(5)).toBe('#1e4f9c');
    expect(windColor(12)).toBe('#1f7a3a');
    expect(windColor(27)).toBe('#e05a00');
    expect(windColor(28)).toBe('#c8001e');
  });

  it('draws arrows, wavy for the waves', () => {
    expect(arrowSvg(90, 0.5, '#0a4c8c', true)).toContain('q');
    expect(arrowSvg(45, 2, '#a1006b', false)).toContain('rotate(45 30 30)');
  });
});

const HOURS = [1_800_000_000, 1_800_003_600];

describe('grids of the replies', () => {
  it('reads the wind of many places', () => {
    const grid = windGridOf(
      [
        {
          hourly: {
            time: HOURS,
            wind_speed_10m: [10, 12],
            wind_gusts_10m: [15, null],
            wind_direction_10m: [270, 280],
          },
        },
        { hourly: { time: HOURS, wind_speed_10m: [null, 3] } },
      ],
      [
        { lat: 48, lon: -3 },
        { lat: 48.5, lon: -3 },
      ],
    );
    expect(grid?.hours).toEqual(HOURS.map((time) => time * 1000));
    expect(grid?.points[0]?.speed).toEqual([10, 12]);
    expect(grid?.points[0]?.gust[1]).toBeNaN();
    expect(grid?.points[1]?.speed[0]).toBeNaN();
    expect(grid?.points[1]?.lat).toBe(48.5);
  });

  it('reads the sea of one place, the current in knots', () => {
    const grid = seaGridOf(
      {
        latitude: 48.7,
        longitude: -2.7,
        hourly: {
          time: HOURS,
          wave_height: [1.2, 1.4],
          wave_direction: [290, 295],
          ocean_current_velocity: [3.704, 1.852],
          ocean_current_direction: [80, 260],
        },
      },
      [],
    );
    expect(grid?.points[0]?.lat).toBe(48.7);
    expect(grid?.points[0]?.current[0]).toBeCloseTo(2);
    expect(grid?.points[0]?.toward).toEqual([80, 260]);
  });

  it('gives nothing for an empty reply', () => {
    expect(windGridOf({}, [])).toBeNull();
    expect(seaGridOf(null, [])).toBeNull();
  });

  it('finds the hour nearest to a time', () => {
    const hours = HOURS.map((time) => time * 1000);
    expect(hourRank(hours, hours[1] as number)).toBe(1);
    expect(hourRank(hours, (hours[0] as number) + 1000)).toBe(0);
    expect(hourRank(hours, (hours[1] as number) + 3 * 3_600_000)).toBe(-1);
  });
});

describe('requests', () => {
  it('asks the wind of the whole grid in one request', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json([
        { hourly: { time: HOURS, wind_speed_10m: [8, 9] } },
        { hourly: { time: HOURS, wind_speed_10m: [10, 11] } },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const grid = await fetchWindGrid(
      [
        { lat: 48, lon: -3 },
        { lat: 48.5, lon: -3 },
      ],
      'meteofrance_arome_france_hd',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String((fetchMock.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('latitude=48.000,48.500');
    expect(url).toContain('models=meteofrance_arome_france_hd');
    expect(url).toContain('wind_speed_unit=kn');
    expect('hours' in grid ? grid.points : []).toHaveLength(2);
  });

  it('says when Open-Meteo refuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 429 })),
    );
    const sea = await fetchSeaGrid([{ lat: 48, lon: -3 }]);
    expect('error' in sea && sea.error).toContain('limite du jour');
  });

  it('says when the network is gone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    const wind = await fetchWindGrid([{ lat: 48, lon: -3 }], 'best_match');
    expect('error' in wind && wind.error).toContain('Pas de réseau');
    const rain = await fetchRainFrames();
    expect('error' in rain && rain.error).toContain('injoignable');
  });
});

describe('rain radar', () => {
  const reply = {
    host: 'https://tilecache.rainviewer.com',
    radar: {
      past: [
        { time: 1_800_000_000, path: '/v2/radar/a' },
        { time: 1_800_000_600, path: '/v2/radar/b' },
        { time: 'bad' },
      ],
    },
  };

  it('reads the frames, newest last', () => {
    const rain = rainFramesOf(reply);
    expect(rain?.frames).toHaveLength(2);
    expect(rain?.frames.at(-1)?.time).toBe(1_800_000_600_000);
    expect(rainFramesOf({ host: 'x', radar: { past: [] } })).toBeNull();
    expect(rainFramesOf('nope')).toBeNull();
  });

  it('builds the tile address, coloured by intensity', () => {
    const rain = rainFramesOf(reply);
    expect(rain && rainTileUrl(rain, '/v2/radar/b')).toBe(
      'https://tilecache.rainviewer.com/v2/radar/b/256/{z}/{x}/{y}/2/1_1.png',
    );
  });

  it('reads the frames from RainViewer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(reply)),
    );
    const rain = await fetchRainFrames();
    expect('frames' in rain && rain.frames).toHaveLength(2);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503 })),
    );
    const down = await fetchRainFrames();
    expect('error' in down && down.error).toContain('503');
  });
});
