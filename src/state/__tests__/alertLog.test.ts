import { beforeEach, expect, test } from 'vitest';

import {
  alertLog,
  eraseAlerts,
  eraseAlertsBetween,
  mergeAlerts,
  recordAlert,
} from '../alertLog.ts';

beforeEach(() => {
  alertLog.value = [];
});

test('an alert is written without a cruise, erased one by one or by period', () => {
  const first = recordAlert(
    'vent',
    'Alerte vent',
    '18 nd',
    '2026-11-01T10:00:00.000Z',
  );
  recordAlert(
    'orage',
    'Alerte orage',
    'Éclairs à 12 NM',
    '2026-11-10T10:00:00.000Z',
  );
  recordAlert(
    'profondeur',
    'Alerte de profondeur',
    'Fond ≈ 1.8 m',
    '2026-11-18T10:00:00.000Z',
  );
  expect(alertLog.value).toHaveLength(3);
  expect(first.cruise).toBeUndefined();
  eraseAlerts([first.id]);
  expect(alertLog.value).toHaveLength(2);
  expect(eraseAlertsBetween('2026-11-09', '2026-11-11')).toBe(1);
  expect(alertLog.value.map((alert) => alert.kind)).toStrictEqual([
    'profondeur',
  ]);
});

test('the alerts of a backup are added, never twice', () => {
  const kept = recordAlert(
    'vent',
    'Alerte vent',
    '18 nd',
    '2026-11-05T10:00:00.000Z',
  );
  mergeAlerts([
    kept,
    {
      id: 'x',
      t: '2026-11-01T10:00:00.000Z',
      kind: 'feux',
      title: 'Feux d’avis',
      text: 'Léman',
    },
  ]);
  expect(alertLog.value.map((alert) => alert.id)).toStrictEqual(['x', kept.id]);
  mergeAlerts('nothing');
  expect(alertLog.value).toHaveLength(2);
});
