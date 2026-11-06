import { loadFixture } from '../browser.ts';
import type { Scenario, Step } from '../types.ts';

import { uiEditScenarios } from './uiEdits.ts';

/**
 * Compare the chrome alone: empty `#view` in both apps (legacy: its nav bar
 * observers then resync as for an empty page; React: the page is unmounted)
 * and drop the page-owned body classes. The wake video goes last in both:
 * legacy appends it when the refused Wake Lock request comes back, which races
 * with the loading of its last scripts.
 */
const CLEAR: Step = {
  eval: `if (window.__parity) {
    window.__parity.blankPage();
  } else {
    document.getElementById('view').replaceChildren();
    document.body.classList.remove('trk-mode', 'has-prep-fab');
  }
  const wakeVideo = document.querySelector('body video, #root > video');
  if (wakeVideo) document.body.append(wakeVideo);`,
};

/**
 * The boot tip lasts 6 s and the two apps open one after the other: reload
 * both together, so that the next tip shows in both at the same time.
 */
const NEXT_TIP: Step[] = [
  { wait: 2000 },
  { eval: 'setTimeout(() => location.reload(), 0)' },
  { wait: 3000 },
  CLEAR,
];

const QUIET = { 'ldb.tipIdx': '6' };

/** Shell scenarios: top bar, nav bar, tabs, clock, toast, theme, gear, translation. */
export const scenarios: Scenario[] = [
  {
    name: 'shell-boot-tip',
    fixture: 'empty',
    steps: [...NEXT_TIP, { snapshot: 'boot-tip' }],
  },
  {
    name: 'shell-boot-sos-tip',
    fixture: { 'ldb.tipIdx': '1' },
    steps: [...NEXT_TIP, { snapshot: 'sos-tip' }],
  },
  {
    name: 'shell-boot-tips',
    fixture: { 'ldb.tipIdx': '2' },
    steps: [...NEXT_TIP, { snapshot: 'gear-tip' }],
  },
  {
    name: 'shell-boot-clock-tip',
    fixture: { 'ldb.tipIdx': '3' },
    steps: [...NEXT_TIP, { snapshot: 'clock-tip' }],
  },
  {
    name: 'shell-boot-quiet',
    fixture: QUIET,
    steps: [CLEAR, { snapshot: 'boot' }],
  },
  {
    name: 'shell-sea-zone',
    fixture: { ...QUIET, 'ldb.zoneSim': 'mer' },
    steps: [
      CLEAR,
      { snapshot: 'boot-sea' },
      { go: 'vhf' },
      CLEAR,
      { snapshot: 'vhf-sea' },
    ],
  },
  {
    name: 'shell-lake-vhf',
    fixture: { ...QUIET, 'ldb.zoneSim': 'lac' },
    steps: [{ go: 'vhf' }, CLEAR, { snapshot: 'vhf-phone' }],
  },
  {
    name: 'shell-nav-views',
    fixture: QUIET,
    steps: [
      { go: 'boats' },
      CLEAR,
      { snapshot: 'boats' },
      { go: 'alpha' },
      CLEAR,
      { snapshot: 'alpha-from-boats' },
      { go: 'sos' },
      CLEAR,
      { go: 'alpha' },
      CLEAR,
      { snapshot: 'alpha-from-sos' },
      { go: 'day' },
      CLEAR,
      { snapshot: 'nonav-day' },
      { go: 'lists' },
      CLEAR,
      { snapshot: 'lists' },
    ],
  },
  {
    name: 'shell-history',
    fixture: QUIET,
    steps: [
      { go: 'more' },
      { go: 'boats' },
      { go: 'dossier' },
      CLEAR,
      { click: '#navBack' },
      CLEAR,
      { snapshot: 'back-to-boats' },
      { click: '#navBack' },
      CLEAR,
      { snapshot: 'back-to-more' },
      { go: 'people' },
      CLEAR,
      { click: '#navExit' },
      CLEAR,
      { snapshot: 'exit-to-more' },
    ],
  },
  {
    name: 'shell-gear',
    fixture: QUIET,
    steps: [
      { click: '#gearBtn' },
      CLEAR,
      { snapshot: 'settings-from-tracker' },
      { click: '#gearBtn' },
      CLEAR,
      { snapshot: 'back-to-tracker' },
      { go: 'boats' },
      { click: '#gearBtn' },
      CLEAR,
      { snapshot: 'settings-from-boats' },
    ],
  },
  {
    name: 'shell-night',
    fixture: QUIET,
    steps: [{ longpress: '#gearBtn', ms: 900 }, CLEAR, { snapshot: 'night' }],
  },
  {
    name: 'shell-clock',
    fixture: QUIET,
    steps: [{ click: '#clock' }, CLEAR, { snapshot: 'clock-utc' }],
  },
  {
    name: 'shell-tab-cycle',
    fixture: QUIET,
    steps: [
      { click: '.top-tab[data-view="tracker"]' },
      CLEAR,
      { snapshot: 'prep-choice' },
      { click: '.top-tab[data-view="tracker"]' },
      CLEAR,
      { snapshot: 'start-choice' },
    ],
  },
  {
    name: 'shell-cruise',
    fixture: { ...loadFixture('sample-sea'), ...QUIET },
    steps: [{ go: 'info' }, CLEAR, { snapshot: 'info-sea' }],
  },
  {
    name: 'shell-english',
    fixture: { ...QUIET, 'ldb.lang': 'en', 'ldb.lang2': 'en' },
    steps: [
      { go: 'more' },
      CLEAR,
      { snapshot: 'more-en' },
      { go: 'stats' },
      CLEAR,
      { snapshot: 'stats-en' },
    ],
  },
  {
    name: 'shell-remark',
    fixture: {
      ...QUIET,
      'ldb.remarks': [
        { t: '2026-07-14T08:00:00.000Z', text: 'Une\nremarque', sent: false },
        { t: '2026-07-14T09:00:00.000Z', text: 'Autre', sent: true },
      ],
    },
    steps: [
      CLEAR,
      { click: '#remPill' },
      { snapshot: 'window' },
      { click: '[data-rem="send"]' },
      { snapshot: 'empty-text' },
      { click: '[data-rem="list"]' },
      { snapshot: 'list' },
      { click: '[data-rl="clear"]' },
      { snapshot: 'hold-ask' },
      { longpress: '[data-rl="clear"]', ms: 800 },
      { wait: 400 },
      { snapshot: 'cleared' },
      { click: '[data-rl="close"]' },
      { snapshot: 'closed' },
    ],
  },
  {
    name: 'shell-lang-fab',
    // The remark pill sits on the language button by default.
    fixture: { ...QUIET, 'ldb.remPill': { x: 10, y: 300 } },
    steps: [
      { go: 'stats' },
      CLEAR,
      { click: '.lang-fab' },
      CLEAR,
      { snapshot: 'english' },
      { longpress: '.lang-fab', ms: 900 },
      // The apps replay one after the other: let the 2.5 s bubble end in both.
      { wait: 2500 },
      CLEAR,
      { snapshot: 'italian' },
      { click: '.lang-fab' },
      CLEAR,
      { snapshot: 'french' },
    ],
  },
  {
    name: 'shell-toast-drag',
    fixture: { ...QUIET, 'ldb.toastPos': { x: 10, y: -40 } },
    steps: [
      { click: '.top-tab[data-view="tracker"]' },
      CLEAR,
      { snapshot: 'moved-bubble' },
    ],
  },
  ...uiEditScenarios,
];
