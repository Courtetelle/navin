import { expect, test } from 'vitest';

import type { TopMenuActions, TopMenuContext } from '../topbar/topMenuModel.ts';
import { baseNav, phoneHtml, topMenu } from '../topbar/topMenuModel.ts';

const noop = () => undefined;
const actions: TopMenuActions = {
  go: noop,
  armStop: noop,
  prepStart: noop,
  quickStart: noop,
  pointNow: noop,
  moorNow: noop,
};
const idle: TopMenuContext = {
  currentView: 'tracker',
  prepActive: false,
  inPrep: false,
  tracking: false,
  zone: 'lac',
};

test('NavIn cycles Météo, PréP, START and the phone inland, the VHF at sea', () => {
  expect(
    topMenu('tracker', idle, actions).map((item) => item.label),
  ).toStrictEqual(['NavIn', 'Météo', 'PréP', 'START track', 'Téléphone']);
  expect(
    topMenu('tracker', { ...idle, zone: 'mer' }, actions).map(
      (item) => item.label,
    ),
  ).toStrictEqual(['NavIn', 'Météo', 'PréP', 'START track', 'VHF']);
});

test('during a track, FIN comes back after every choice', () => {
  const labels = topMenu('tracker', { ...idle, tracking: true }, actions).map(
    (item) => item.label,
  );
  expect(labels).toStrictEqual([
    'TRACK en cours',
    'Météo',
    'FIN',
    'Point',
    'FIN',
    'Téléphone',
    'FIN',
    'Amarrage',
    'FIN',
  ]);
});

test('the NavIn name follows VHF, PréP and tracking', () => {
  expect(baseNav({ ...idle, currentView: 'vhf', zone: 'mer' })).toStrictEqual({
    label: 'VHF',
    vhfOn: true,
  });
  expect(baseNav({ ...idle, prepActive: true, inPrep: false }).label).toBe(
    'PréP en cours (autre page)',
  );
  expect(baseNav({ ...idle, prepActive: true, inPrep: true }).label).toBe(
    'PréP en cours',
  );
  expect(baseNav(idle).html?.[0]).toContain('fill="#8fd0ff" fill-opacity="1"');
});

test('SOS offers the VHF at sea only', () => {
  expect(topMenu('sos', idle, actions).map((item) => item.label)).toStrictEqual(
    ['SOS', 'MOB', 'Alphabet'],
  );
  expect(topMenu('sos', { ...idle, zone: 'mer' }, actions)).toHaveLength(4);
});

test('the phone pictogram exists in a day and a night version', () => {
  const [day, night] = phoneHtml(true);
  expect(day?.startsWith('<svg class="tb-ico tb-phone tb-still ph-day"')).toBe(
    true,
  );
  expect(
    night?.startsWith('<svg class="tb-ico tb-phone tb-still ph-night"'),
  ).toBe(true);
});
