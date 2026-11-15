/* eslint-disable camelcase -- the fields as the services name them */
import { expect, test } from 'vitest';

import {
  FROST,
  RWS,
  frostReadingsOf,
  frostSourcesOf,
  rwsPlacesOf,
  rwsReadingsOf,
} from '../northStations.ts';

const NOW = Date.parse('2026-11-15T22:40:00Z');

test('the places of Rijkswaterstaat measuring wind', () => {
  const places = rwsPlacesOf({
    AquoMetadataLijst: [
      { AquoMetadata_MessageID: 194, Grootheid: { Code: 'WINDSHD' } },
      { AquoMetadata_MessageID: 7, Grootheid: { Code: 'WATHTE' } },
    ],
    AquoMetadataLocatieLijst: [
      { AquoMetaData_MessageID: 194, Locatie_MessageID: 1 },
      { AquoMetaData_MessageID: 7, Locatie_MessageID: 2 },
    ],
    LocatieLijst: [
      {
        Locatie_MessageID: 1,
        Code: 'hoekvanholland',
        Naam: 'Hoek van Holland',
        Lat: 51.98,
        Lon: 4.12,
      },
      { Locatie_MessageID: 2, Code: 'x', Naam: 'X', Lat: 52, Lon: 4 },
    ],
  });
  expect(places).toEqual([
    { id: 'hoekvanholland', name: 'Hoek van Holland', lat: 51.98, lon: 4.12 },
  ]);
});

function series(code: string, values: Array<[string, number]>) {
  return {
    Locatie: { Code: 'hoekvanholland' },
    AquoMetadata: { Grootheid: { Code: code } },
    MetingenLijst: values.map(([t, v]) => ({
      Tijdstip: t,
      Meetwaarde: { Waarde_Numeriek: v },
    })),
  };
}

test('the newest wind of Rijkswaterstaat, old series left out', () => {
  const station = { id: 'hoekvanholland', name: 'Hoek', lat: 51.98, lon: 4.12 };
  const readings = rwsReadingsOf(
    {
      WaarnemingenLijst: [
        series('WINDSHD', [['2026-11-15T23:20:00.000+01:00', 7.5]]),
        series('WINDSHD', [['2022-01-18T00:50:00.000+01:00', 2.09]]),
        series('WINDST', [['2026-11-15T23:20:00.000+01:00', 10]]),
        series('WINDRTG', [['2026-11-15T23:20:00.000+01:00', 197]]),
      ],
    },
    [{ station, km: 12 }],
    NOW,
  );
  expect(readings).toHaveLength(1);
  expect(readings[0]?.avg).toBeCloseTo(14.6, 1);
  expect(readings[0]?.gust).toBeCloseTo(19.4, 1);
  expect(readings[0]?.dir).toBe(197);
  expect(readings[0]?.net).toBe(RWS);
  expect(rwsReadingsOf({}, [{ station, km: 1 }], NOW)).toEqual([]);
});

test('the stations and the latest wind of Frost', () => {
  const places = frostSourcesOf({
    data: [
      {
        id: 'SN18700',
        name: 'OSLO - BLINDERN',
        shortName: 'Blindern',
        geometry: { coordinates: [10.72, 59.94] },
      },
      { id: 'SN1', name: 'NOWHERE' },
    ],
  });
  expect(places).toEqual([
    { id: 'SN18700', name: 'Blindern', lat: 59.94, lon: 10.72 },
  ]);
  const station = places[0] ?? { id: '', name: '', lat: 0, lon: 0 };
  const readings = frostReadingsOf(
    {
      data: [
        {
          sourceId: 'SN18700:0',
          referenceTime: '2026-11-15T22:30:00.000Z',
          observations: [
            { elementId: 'wind_speed', value: 5 },
            { elementId: 'wind_from_direction', value: 250 },
          ],
        },
        {
          sourceId: 'SN18700:0',
          referenceTime: '2026-11-15T22:30:00.000Z',
          observations: [
            { elementId: 'max(wind_speed_of_gust PT10M)', value: 8 },
          ],
        },
      ],
    },
    [{ station, km: 3 }],
    NOW,
  );
  expect(readings).toHaveLength(1);
  expect(readings[0]?.avg).toBeCloseTo(9.7, 1);
  expect(readings[0]?.gust).toBeCloseTo(15.6, 1);
  expect(readings[0]?.dir).toBe(250);
  expect(readings[0]?.net).toBe(FROST);
});
