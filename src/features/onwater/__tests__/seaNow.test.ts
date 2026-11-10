/* eslint-disable camelcase -- names in the API */
import { describe, expect, it } from 'vitest';

import { seaOf } from '../seaNow.ts';

describe('seaOf', () => {
  it('reads the whole sea, the wind sea and the swell', () => {
    const sea = seaOf({
      current: {
        time: '2026-11-10T16:30',
        wave_height: 1.2,
        wave_direction: 280,
        wave_period: 7.5,
        wind_wave_height: 0.6,
        wind_wave_direction: 250,
        wind_wave_period: 3.2,
        swell_wave_height: 1,
        swell_wave_direction: 290,
        swell_wave_period: 11,
        sea_surface_temperature: 13.7,
        ocean_current_velocity: 3.704,
        ocean_current_direction: 79,
      },
    });
    expect(sea?.total).toEqual({ height: 1.2, dir: 280, period: 7.5 });
    expect(sea?.windSea?.height).toBe(0.6);
    expect(sea?.swell?.period).toBe(11);
    expect(sea?.water).toBe(13.7);
    expect(sea?.current?.knots).toBeCloseTo(2);
    expect(sea?.current?.toward).toBe(79);
    expect(sea?.t).toBe(Date.parse('2026-11-10T16:30Z'));
  });

  it('is null on a lake', () => {
    expect(seaOf({ current: { wave_height: null } })).toBeNull();
    expect(seaOf(null)).toBeNull();
  });
});
