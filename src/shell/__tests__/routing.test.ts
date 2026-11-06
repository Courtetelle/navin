import { expect, test } from 'vitest';

import {
  VIEW_NAMES,
  activeTab,
  alphaBackFor,
  backFallback,
  resolveView,
  tabFor,
  tabOf,
} from '../routing.ts';

const sea = { cruiseOpen: true, alphaBack: 'more' };

test('there is one legacy view per page folder', () => {
  expect(VIEW_NAMES).toHaveLength(39);
});

test('the tab of a screen follows app.js:662', () => {
  expect(tabFor('prep', sea)).toBe('tracker');
  expect(tabFor('settings', sea)).toBe('more');
  expect(tabFor('vhf', sea)).toBe('tracker');
  expect(tabFor('nmea', sea)).toBe('nmea');
  expect(tabFor('mob', sea)).toBe('sos');
  expect(tabFor('mob', { ...sea, cruiseOpen: false })).toBe('more');
  expect(tabFor('alpha', { ...sea, alphaBack: 'sos' })).toBe('sos');
  expect(tabFor('alpha', { ...sea, alphaBack: 'lists' })).toBe('more');
});

test('tabOf lights data for nmea and nothing for unknown values', () => {
  expect(tabOf('nmea', sea)).toBe('more');
  expect(tabOf('settings', sea)).toBe('settings');
  expect(tabOf(null, sea)).toBeNull();
  expect(tabOf('day', sea)).toBe('more');
});

test('nonav lights the tab of the screen asked for, settings the tab left', () => {
  const context = { ...sea, settingsFrom: null };
  expect(activeTab('nonav', 'new', context)).toBe('tracker');
  expect(activeTab('nonav', 'log', context)).toBe('more');
  expect(activeTab('settings', null, context)).toBe('more');
  expect(activeTab('settings', null, { ...context, settingsFrom: 'sos' })).toBe(
    'sos',
  );
  expect(activeTab('settings', null, { ...context, settingsFrom: 'vhf' })).toBe(
    'tracker',
  );
  expect(
    activeTab('settings', null, { ...context, settingsFrom: 'settings' }),
  ).toBe('more');
});

test('screens needing a cruise redirect to nonav without one', () => {
  expect(resolveView('day', 3, false)).toStrictEqual({
    view: 'nonav',
    arg: 'day',
  });
  expect(resolveView('day', 3, true)).toStrictEqual({ view: 'day', arg: 3 });
  expect(resolveView('boats', 'b1', false)).toStrictEqual({
    view: 'boats',
    arg: 'b1',
  });
  expect(resolveView('checklist', { boatId: 'b1' }, false)).toStrictEqual({
    view: 'checklist',
    arg: { boatId: 'b1' },
  });
  expect(resolveView('checklist', 'dep', false)).toStrictEqual({
    view: 'nonav',
    arg: 'checklist',
  });
});

test('the alphabet goes back to the safety screen it was opened from', () => {
  expect(alphaBackFor('vhf')).toBe('vhf');
  expect(alphaBackFor('boats')).toBe('more');
});

test('the back button without history goes to the parent screen', () => {
  expect(backFallback('dossier')).toBe('more');
  expect(backFallback('settings')).toBe('more');
  expect(backFallback('douglas')).toBe('lists');
  expect(backFallback('mob')).toBe('tracker');
});
