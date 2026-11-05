import { expect, test } from 'vitest';

import type { ChecklistBase, Mark, SosLog } from '../../../model/types.ts';
import {
  checklistBaseItems,
  markItems,
  sosLogItems,
  traceItems,
} from '../listRecordItems.ts';

const at = (hour: number, minute: number) =>
  new Date(2026, 6, 15, hour, minute).toISOString();

test('traceItems summarises each track', () => {
  const start = new Date(2026, 6, 15, 8, 40).getTime();
  const items = traceItems([
    {
      id: 't',
      name: 'Sortie',
      start,
      end: start + 95 * 60_000,
      nm: 7.26,
      max: 6.04,
    },
    { id: 'u', name: 'Calme', start, end: start, nm: 0, max: 0 },
  ]);
  expect(items[0]).toStrictEqual({
    id: 't',
    name: 'Sortie',
    sections: [
      {
        title: 'Sortie',
        rows: [
          ['Date', '15/07/2026'],
          ['Départ', '08:40'],
          ['Arrivée', '10:15'],
          ['Durée', '1 h 35'],
          ['Distance', '7,3 NM'],
          ['Vitesse max', '6,0 nd'],
        ],
      },
    ],
  });
  expect(items[1]?.sections[0]?.rows).toHaveLength(5);
});

test('markItems sorts by number and adds the note to the name', () => {
  const marks: Mark[] = [
    {
      id: 'b',
      n: 12,
      name: 'M012',
      at: at(9, 5),
      lat: 46.5,
      lon: 6.6,
      depth: '12 m',
      note: 'Bouée',
    },
    {
      id: 'a',
      n: 2,
      name: 'M002',
      at: '',
      lat: 46,
      lon: 6,
      depth: '',
      note: '',
    },
  ];
  const items = markItems(marks);
  expect(items.map((item) => item.name)).toStrictEqual([
    'M002',
    'M012 · Bouée',
  ]);
  expect(items[0]?.sections[0]?.rows[0]).toStrictEqual(['Date', ' ']);
  expect(items[1]?.sections[0]?.title).toBe('M012 · Bouée');
  const rows = items[1]?.sections[0]?.rows ?? [];
  expect(rows[0]).toStrictEqual(['Date', '15.07.2026 09:05']);
  expect(rows[1]?.[0]).toBe('Position');
  expect(rows[2]).toStrictEqual(['Profondeur', '12 m']);
});

test('checklistBaseItems lists the points with a box', () => {
  const bases = [
    {
      id: 'c',
      name: 'Brief',
      cats: ['Sécurité', 'Mer'],
      items: [{ label: 'Gilets' }, { text: 'Radio' }, 'Fusées', {}],
    },
    { id: 'd', name: 'Vide', items: [] },
  ] as unknown as ChecklistBase[];
  expect(checklistBaseItems(bases)).toStrictEqual([
    {
      id: 'c',
      name: 'Brief',
      sections: [
        {
          title: 'Brief',
          rows: [
            ['Catégorie', 'Sécurité, Mer'],
            ['4 points', '☐ Gilets\n☐ Radio\n☐ Fusées\n☐ '],
          ],
        },
      ],
    },
    {
      id: 'd',
      name: 'Vide',
      sections: [{ title: 'Vide', rows: [['0 points', '–']] }],
    },
  ]);
});

test('sosLogItems puts the latest first and writes the events', () => {
  const logs: SosLog[] = [
    {
      id: 'l1',
      start: at(8, 0),
      end: at(8, 30),
      zone: 'lac',
      nav: '',
      boat: 'Mistral',
      events: [
        { t: at(8, 0), what: 'Touche SOS' },
        { t: at(8, 5), what: 'Appel', pos: { lat: 46, lon: 6 } },
      ],
    },
    {
      id: 'l2',
      start: at(9, 0),
      zone: 'lac',
      nav: '',
      boat: '',
      events: [],
    },
  ];
  const items = sosLogItems(logs);
  expect(items.map((item) => item.id)).toStrictEqual(['l2', 'l1']);
  expect(items[0]).toStrictEqual({
    id: 'l2',
    name: '15.07.2026 09:00',
    sections: [
      {
        title: 'SOS 15.07.2026 09:00',
        rows: [
          ['Début', '15.07.2026 09:00'],
          ['Fin', 'en cours'],
          ['Actions', ''],
        ],
      },
    ],
  });
  const rows = items[1]?.sections[0]?.rows ?? [];
  expect(items[1]?.name).toBe('15.07.2026 08:00 · Mistral');
  expect(rows[1]).toStrictEqual(['Fin', '15.07.2026 08:30']);
  expect(rows[2]).toStrictEqual(['Bateau', 'Mistral']);
  expect(rows[3]?.[1]).toMatch(/^08:00 · Touche SOS\n08:05 · Appel \(.+\)$/);
});
