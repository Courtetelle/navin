import type { Scenario } from '../types.ts';

import { QUIET, SHOW_STORAGE, enter, open, screen, snap } from './dataSteps.ts';

/** Settings: from each tab, sections, buttons, margins, night mode, installation. */
export const settingsScenarios: Scenario[] = [
  // Settings.
  screen('settings', 'empty', 'settings'),
  screen('settings', 'sample', 'settings'),
  screen('settings', 'sample-sea', 'settings'),
  ...['tracker', 'more', 'sos', 'prep', 'new', 'vhf', 'boats', 'cartes'].map(
    (view): Scenario => ({
      name: `data-settings-gear-${view}`,
      fixture: 'sample',
      overrides: QUIET,
      steps: [...enter(view), { click: '#gearBtn' }, ...snap('settings')],
    }),
  ),
  {
    name: 'data-settings-gear-back',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('more'),
      { click: '#gearBtn' },
      { click: '#gearBtn' },
      ...snap('back'),
    ],
  },
  {
    name: 'data-settings-sections',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      open('trace'),
      ...snap('trace'),
      open('boats'),
      ...snap('two-open'),
      ...enter('settings'),
      ...snap('kept'),
      ...enter('more'),
      ...enter('settings'),
      ...snap('closed'),
    ],
  },
  {
    name: 'data-settings-buttons',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      open('zone'),
      { click: '#wakeBtn' },
      { click: '#popBtn' },
      ...snap('zone'),
      { click: '#popBtn' },
      { wait: 100 },
      ...snap('help-back'),
      open('trace'),
      { click: '[data-s="autoPerHour"][data-v="2"]' },
      { click: '[data-s="autoTurn"][data-v="45"]' },
      { click: '[data-s="gotoArrive"][data-v="50"]' },
      { click: '#prefillBtn' },
      { click: '#wxBtn' },
      SHOW_STORAGE,
      ...snap('trace'),
    ],
  },
  {
    name: 'data-settings-margins',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      open('boats'),
      { fill: '#setPP', value: '0,8' },
      { fill: '#setMH', value: 'x' },
      { fill: '#setCP', value: '' },
      ...snap('typed'),
      { click: '[data-s="arrProf"][data-v="0.5"]' },
      SHOW_STORAGE,
      ...snap('redrawn'),
    ],
  },
  {
    name: 'data-settings-night',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('tracker'),
      { click: '#gearBtn' },
      open('zone'),
      { click: '#themeToggle' },
      ...snap('night'),
      { click: '#themeToggle' },
      ...snap('day'),
    ],
  },
  {
    name: 'data-settings-install',
    fixture: 'empty',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      open('install'),
      { click: '#installGuide h2' },
      { click: '[data-guide="android"]' },
      ...snap('android'),
      { click: '[data-guide="ios"]' },
      ...snap('ios'),
      { click: '#copyLink' },
      ...snap('copied'),
      {
        eval: `{
          const event = new Event('beforeinstallprompt', { cancelable: true });
          event.prompt = () => Promise.resolve();
          event.userChoice = Promise.resolve();
          globalThis.dispatchEvent(event);
        }`,
      },
      ...snap('prompt'),
      { click: '#installNow' },
      ...snap('prompted'),
    ],
  },
  {
    name: 'data-settings-simulation',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      open('simu'),
      { eval: `document.querySelector('[data-sosex="ch"]').click()` },
      { wait: 1500 },
      {
        eval: `document.querySelector('#exRibbon [data-sosex="end"]').click()`,
      },
      { wait: 800 },
      ...snap('back'),
    ],
  },
  {
    name: 'data-settings-sync',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      open('data'),
      { click: '#sync h2' },
      { click: '#syncPhotos' },
      SHOW_STORAGE,
      ...snap('no-photos'),
    ],
  },
];
