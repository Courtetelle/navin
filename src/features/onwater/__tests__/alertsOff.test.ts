import { expect, test } from 'vitest';

import { state, updateSettings } from '../../../state/index.ts';
import {
  alertOn,
  applyReOn,
  reOnRuleOf,
  setReOnRule,
  sharedReOnRule,
} from '../alertsOff.ts';

test('each alert comes back on by its own rule, the wind keeping its old one', () => {
  updateSettings((settings) => {
    settings.windAlert = { on: false, reOn: 'never', offDay: '2020-01-01' };
    settings.lightning = { on: false, offDay: '2020-01-01' };
    settings.lakeWarn = { on: false, offDay: '2020-01-01' };
    settings.depthAlarm = false;
    settings.depthOffDay = '2020-01-01';
    settings.alertReOn = { lightning: 'midnight', lakeWarn: 'trace' };
  });

  expect(reOnRuleOf('wind')).toBe('never');
  expect(reOnRuleOf('depth')).toBe('launch');
  expect(sharedReOnRule()).toBeNull();
  // A minute passes the day after: only the alert « à minuit » is back.
  expect(applyReOn('tick')).toStrictEqual(['lightning']);
  expect(alertOn('lightning')).toBe(true);
  expect(alertOn('wind')).toBe(false);
  expect(applyReOn('trace')).toStrictEqual(['lakeWarn']);
  expect(applyReOn('launch')).toStrictEqual(['depth']);
  expect(state.preferences.settings.peek().depthAlarm).toBe(true);
});

test('one choice for every alert at once', () => {
  setReOnRule('all', 'midnight');

  expect(sharedReOnRule()).toBe('midnight');
  expect(reOnRuleOf('wind')).toBe('midnight');
});
