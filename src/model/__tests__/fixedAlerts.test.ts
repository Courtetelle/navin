import { expect, test } from 'vitest';

import {
  FIXED_ALERTS,
  FIXED_SEAS,
  fixedAlertById,
  fixedBand,
} from '../fixedAlerts.ts';

test('each fixed alert has its own id, a known sea and its texts', () => {
  const ids = FIXED_ALERTS.map((alert) => alert.id);
  expect(new Set(ids).size).toBe(ids.length);
  const seas = new Set(FIXED_SEAS.map(([sea]) => sea));
  for (const alert of FIXED_ALERTS) {
    expect(seas.has(alert.sea)).toBe(true);
    for (const text of [alert.name, alert.where, alert.what, alert.when]) {
      expect(text.length).toBeGreaterThan(3);
    }
    expect(alert.conduct.length).toBeGreaterThan(20);
  }
  // Every sea has its alerts.
  for (const sea of seas) {
    expect(FIXED_ALERTS.some((alert) => alert.sea === sea)).toBe(true);
  }
});

test('the zones lie in European waters, with a sensible radius', () => {
  for (const { zone, id } of FIXED_ALERTS) {
    if (!zone) continue;
    expect(zone.lat, id).toBeGreaterThan(30);
    expect(zone.lat, id).toBeLessThan(62);
    expect(zone.lon, id).toBeGreaterThan(-12);
    expect(zone.lon, id).toBeLessThan(30);
    expect(zone.km, id).toBeGreaterThan(0);
    expect(zone.km, id).toBeLessThanOrEqual(300);
  }
});

test('an alert by its id and its band in the list', () => {
  expect(fixedAlertById('raz-blanchard')?.sea).toBe('manche');
  expect(fixedAlertById('nowhere')).toBeUndefined();
  expect(fixedBand('raz-blanchard')).toBe('fixed:raz-blanchard');
});
