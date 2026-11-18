import { expect, test } from 'vitest';

import type { AlertRecord } from '../alertLog.ts';
import { alertsIn, latestFirst } from '../alertLog.ts';

const at = (day: string, hour = 12) =>
  new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`).toISOString();

const ALERTS: AlertRecord[] = [
  {
    id: 'a',
    t: at('2026-11-01'),
    kind: 'vent',
    title: 'Alerte vent',
    text: '',
  },
  {
    id: 'b',
    t: at('2026-11-10'),
    kind: 'orage',
    title: 'Alerte orage',
    text: '',
  },
  {
    id: 'c',
    t: at('2026-11-18'),
    kind: 'vent',
    title: 'Alerte vent',
    text: '',
  },
];

function ids(list: AlertRecord[]): string[] {
  return list.map((alert) => alert.id);
}

test('the alerts of some kinds between two days, both counted', () => {
  expect(ids(alertsIn(ALERTS, new Set(['vent'])))).toStrictEqual(['a', 'c']);
  expect(
    ids(
      alertsIn(ALERTS, new Set(['vent', 'orage']), '2026-11-10', '2026-11-18'),
    ),
  ).toStrictEqual(['b', 'c']);
  expect(ids(latestFirst(ALERTS))).toStrictEqual(['c', 'b', 'a']);
});
