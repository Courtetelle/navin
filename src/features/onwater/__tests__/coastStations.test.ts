/* eslint-disable camelcase -- names in the APIs */
import { describe, expect, it } from 'vitest';

import {
  METEO_FRANCE,
  OPEN_WIND_MAP,
  mfReading,
  mfStations,
  nearCoastStations,
  owmReading,
  owmStations,
} from '../coastStations.ts';
import { checkText } from '../mfCheckText.ts';
import { windAlertNote } from '../windLogic.ts';
import { otherWind } from '../windWatch.ts';

const NOW = Date.parse('2026-11-10T12:00:00Z');

describe('OpenWindMap beacons', () => {
  it('lists the beacons with a place', () => {
    const list = owmStations({
      data: [
        {
          id: 7,
          meta: { name: 'Pointe du Grouin' },
          location: { latitude: 48.71, longitude: -1.84 },
        },
        {
          id: 8,
          meta: { name: 'Sans lieu' },
          location: { latitude: null, longitude: null },
        },
      ],
    });
    expect(list).toEqual([['7', 'Pointe du Grouin', 48.71, -1.84]]);
  });

  it('reads km/h in knots and drops old measurements', () => {
    const live = {
      id: 7,
      meta: { name: 'Pointe du Grouin' },
      measurements: {
        date: '2026-11-10T11:55:00Z',
        wind_heading: 270,
        wind_speed_avg: 37.04,
        wind_speed_max: 46.3,
      },
    };
    const reading = owmReading(live, 4, NOW);
    expect(reading?.avg).toBeCloseTo(20, 1);
    expect(reading?.gust).toBeCloseTo(25, 1);
    expect(reading?.net).toBe(OPEN_WIND_MAP);
    expect(owmReading(live, 4, NOW + 60 * 60_000)).toBeNull();
  });
});

describe('Météo-France stations', () => {
  it('reads the stations CSV', () => {
    const csv =
      'Id_station;Id_omm;Nom_usuel;Latitude;Longitude;Altitude\n35228001;07130;DINARD;48.5848;-2.0763;58\n';
    expect(mfStations(csv)).toEqual([['35228001', 'Dinard', 48.5848, -2.0763]]);
  });

  it('keeps the last 6-minute wind, m/s in knots', () => {
    const rows = [
      { validity_time: '2026-11-10T11:48:00Z', ff: 5, fxi10: 7, dd: 250 },
      {
        validity_time: '2026-11-10T11:54:00Z',
        ff: 10.29,
        fxi10: 12.86,
        dd: 260,
      },
    ];
    const reading = mfReading(rows, 'Dinard', 6, NOW);
    expect(reading?.avg).toBeCloseTo(20, 0);
    expect(reading?.gust).toBeCloseTo(25, 0);
    expect(reading?.dir).toBe(260);
    expect(reading?.net).toBe(METEO_FRANCE);
  });

  it('keeps the stations of the radius, the closest first', () => {
    const near = nearCoastStations(
      [
        ['a', 'Loin', 47, -2],
        ['b', 'Près', 48.65, -2.02],
      ],
      { lat: 48.6493, lon: -2.0257 },
      30,
    );
    expect(near.map(({ station }) => station[1])).toEqual(['Près']);
  });
});

describe('alert texts', () => {
  const top = {
    name: 'Dinard',
    t: NOW,
    avg: 18,
    gust: 26,
    dir: 260,
    km: 6,
    net: METEO_FRANCE,
  };

  it('says a station measured the wind', () => {
    const note = windAlertNote(top, { n: 2, src: 'stations' });
    expect(note).toContain('mesuré à Dinard (station Météo-France, 6 km)');
  });

  it('says loudly a forecast is not a measurement', () => {
    const note = windAlertNote(
      { name: 'AROME', t: NOW, avg: 18, gust: 26, dir: null },
      { n: 1, src: 'model', radius: 30 },
    );
    expect(note).toContain('PRÉVISION AROME');
    expect(note).toContain('pas une mesure');
  });

  it('shows the mean wind under the gusts, and the gusts under the mean wind', () => {
    const config = { on: true, radius: 30, mfKey: '' };
    expect(otherWind({ ...config, basis: 'gust' }, top)).toBe(
      'vent moyen 18 nd',
    );
    expect(otherWind({ ...config, basis: 'avg' }, top)).toBe('rafales 26 nd');
    expect(otherWind({ ...config, basis: 'avg' }, { ...top, gust: null })).toBe(
      '',
    );
  });
});

describe('Météo-France key check', () => {
  it('names the station and its wind when the key works', () => {
    const text = checkText({
      kind: 'ok',
      stations: 1100,
      reading: { name: 'Dinard', t: NOW, avg: 14, gust: 19, dir: 250, km: 6 },
    });
    expect(text).toContain(
      '✅ Clé Météo-France valide · 1100 stations · Dinard (6 km)',
    );
  });

  it('says a refused key', () => {
    expect(checkText({ kind: 'refused', status: 401 })).toContain(
      'Clé refusée',
    );
  });
});
