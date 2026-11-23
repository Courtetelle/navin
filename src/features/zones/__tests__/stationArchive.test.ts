import { expect, test, vi } from 'vitest';

import type { MeteoZone } from '../meteoZones.ts';
import type { ArchiveDay, ArchiveReading } from '../stationArchive.ts';
import {
  activeFromInput,
  addReadings,
  archiveIndex,
  dayOf,
  parseActive,
  parseIndex,
} from '../stationArchive.ts';
import { zonesOfPlace } from '../stationRecord.ts';
import { archiveZones, readArchiveIndex } from '../zoneArchiveSync.ts';

function square(
  id: string,
  west: number,
  south: number,
  east: number,
  north: number,
): MeteoZone {
  return {
    id,
    name: id,
    basin: 'manche',
    kind: 'cote',
    polys: [
      [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    ],
    reads: [[(south + north) / 2, (west + east) / 2, 30]],
  };
}

const T = Date.UTC(2026, 10, 23, 21, 30);

function zonesOf(): string[] {
  return ['hague-penmarch'];
}

function reading(id: string, t: number, avg = 12.34): ArchiveReading {
  return {
    id,
    net: 'OpenWindMap',
    name: `Balise ${id}`,
    lat: 48.6521,
    lon: -2.830_63,
    t,
    avg,
    gust: 18.06,
    dir: 271.4,
    air: null,
  };
}

test('the zones sent by NavIn: the ids known, each once', () => {
  const known = new Set(['leman', 'hague-penmarch']);
  expect(activeFromInput('leman, hague-penmarch,leman,bidon', known)).toEqual([
    'leman',
    'hague-penmarch',
  ]);
  expect(activeFromInput('aucune', known)).toEqual([]);
  expect(parseActive({ ids: ['leman', 3], at: 'x' })).toEqual({
    ids: ['leman'],
    at: 'x',
  });
  expect(parseActive(null)).toEqual({ ids: [], at: '' });
});

test('readings go in the day of their time, a time once per station', () => {
  const days = new Map<string, ArchiveDay>();
  expect(
    addReadings(
      days,
      [reading('a', T), reading('b', T), reading('a', T + 9e6)],
      zonesOf,
    ),
  ).toBe(3);
  expect(addReadings(days, [reading('a', T)], zonesOf)).toBe(0);
  expect([...days.keys()].toSorted()).toEqual(['2026-11-23', '2026-11-24']);
  const station = days.get('2026-11-23')?.stations['OpenWindMap:a'];
  expect(station?.points).toEqual([[T, 12.3, 18.1, 271, null, null]]);
  expect(station?.zones).toEqual(['hague-penmarch']);
  expect(dayOf(T)).toBe('2026-11-23');

  const index = archiveIndex(
    '2026-11-23T21:43:00Z',
    ['hague-penmarch'],
    [reading('a', T), reading('b', T)],
    days.values(),
  );
  expect(index.last).toEqual({ stations: 2, nets: { OpenWindMap: 2 } });
  expect(index.days).toEqual([
    { date: '2026-11-24', stations: 1, points: 1 },
    { date: '2026-11-23', stations: 2, points: 2 },
  ]);
  expect(parseIndex(structuredClone(index))).toEqual(index);
  expect(parseIndex({})).toBeNull();
});

test('the zones recorded: those chosen, else that of the boat', () => {
  const zones = [square('a', -3, 48, -2, 49), square('b', 0, 49, 1, 50)];
  const boat = { lat: 48.5, lon: -2.5 };
  expect(archiveZones(zones, ['b', 'a', 'x'], boat, false)).toBe('a,b');
  expect(archiveZones(zones, [], boat, false)).toBe('a');
  expect(archiveZones(zones, [], { lat: 40, lon: 10 }, false)).toBe('aucune');
  expect(zonesOfPlace(zones, 48.5, -2.5)).toEqual(['a']);
});

test('the index of the archive is read from GitHub', async () => {
  const fetcher = vi.fn<typeof fetch>(async () =>
    Response.json({
      at: '2026-11-23T21:43:00Z',
      zones: ['leman'],
      last: { stations: 4, nets: { MeteoSwiss: 4 } },
      days: [],
    }),
  );
  const index = await readArchiveIndex('key', fetcher);
  expect(index?.last.stations).toBe(4);
  expect(fetcher.mock.calls[0]?.[0]).toContain(
    'contents/index.json?ref=stations',
  );
  expect(
    await readArchiveIndex('', async () => new Response(null, { status: 404 })),
  ).toBeNull();
});
