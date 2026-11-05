import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Fixture, Scenario, Step } from '../types.ts';

const QUIET = { 'ldb.tipIdx': '6' };
const CRUISE_KEY = 'ldb.cruise.mrltkr40tkny6';
// Legacy computes the first clock before opening the cruise: with lake and sea
// cruises, its zone is only right after the next tick.
const CLOCK_TICK = 10_500;

/**
 * Same scroll position in both apps: the fixed bars are drawn where the page is
 * scrolled, and the harness scrolls by itself to reach what it clicks, sometimes
 * differently (it retries other positions when a bar covers the target).
 */
const SCROLL_TOP: Step = { eval: 'scrollTo(0, 0)' };

/** Write the stored cruise and draft in the page, to compare the saved data. */
const DUMP: Step = {
  eval: `let dump = document.getElementById('parity-dump');
  if (!dump) {
    dump = document.createElement('pre');
    dump.id = 'parity-dump';
    dump.hidden = true;
    document.body.append(dump);
  }
  dump.textContent = Object.keys(localStorage)
    .filter((key) => key.startsWith('ldb.cruise.') || key.startsWith('ldb.draft.'))
    .toSorted()
    .map((key) => key + '=' + localStorage.getItem(key))
    .join(' ; ');`,
};

function snap(name: string): Step[] {
  return [SCROLL_TOP, { snapshot: name }];
}

function snapData(name: string): Step[] {
  return [DUMP, SCROLL_TOP, { snapshot: name }];
}

function field(key: string, selector = ''): string {
  return `.field[data-key="${key}"] ${selector}`.trim();
}

function fixtureOf(name: string): Fixture {
  const path = join(import.meta.dirname, '..', 'fixtures', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Fixture;
}

/** The sea fixture with an open cruise that has no entry yet. */
function emptyJournal(): Fixture {
  const fixture = fixtureOf('sample-sea');
  const cruise = fixture[CRUISE_KEY] as Record<string, unknown>;
  return { ...fixture, [CRUISE_KEY]: { ...cruise, entries: [], days: {} } };
}

/** Logbook scenarios: hourly form, day sheet, journal. */
export const scenarios: Scenario[] = [
  {
    name: 'logbook-empty',
    fixture: 'empty',
    overrides: QUIET,
    steps: [
      { go: 'new' },
      ...snap('new-nonav'),
      { go: 'day' },
      ...snap('day-nonav'),
      { go: 'log' },
      ...snap('log-nonav'),
    ],
  },
  {
    name: 'logbook-new-lake',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [{ go: 'new' }, ...snapData('new')],
  },
  {
    name: 'logbook-new-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [{ go: 'new' }, ...snapData('new')],
  },
  {
    name: 'logbook-new-first',
    fixture: emptyJournal(),
    overrides: QUIET,
    steps: [{ go: 'new' }, ...snapData('new')],
  },
  {
    name: 'logbook-new-steppers',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'new' },
      { click: field('loch', '[data-step="10"]') },
      { click: field('sog', '[data-step="-0.1"]') },
      { click: field('hdg', '[data-step="-10"]') },
      { click: field('cog', '[data-step="1"]') },
      { click: field('awa', '[data-step="10"]') },
      { click: field('rpm', '[data-step="-500"]') },
      { click: field('baro', '[data-step="5"]') },
      { click: field('tws', '[data-step="5"]') },
      ...snapData('steps'),
      { click: field('twd', '[data-set="225"]') },
      { click: field('hdg', '[data-set="90"]') },
      ...snapData('rose'),
      { click: field('hdg', '.clear') },
      { click: field('loch', '.clear') },
      ...snapData('cleared'),
    ],
  },
  {
    name: 'logbook-new-typing',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'new' },
      { click: field('sog', '.value') },
      ...snap('typing'),
      { click: field('sog', '[data-step="1"]') },
      { click: field('sog', '.clear') },
      ...snapData('typing-other-buttons'),
      { fill: field('sog', 'input'), value: '99' },
      { press: field('sog', 'input'), key: 'Enter' },
      ...snap('out-of-range'),
      { fill: field('sog', 'input'), value: '12.34' },
      { click: field('sog', '[data-act="ok"]') },
      ...snapData('typed'),
      { click: field('rpm', '.value') },
      { fill: field('rpm', 'input'), value: '2500' },
      { press: field('rpm', 'input'), key: 'Enter' },
      { click: field('tws', '.value') },
      { fill: field('tws', 'input'), value: '18' },
      { press: field('tws', 'input'), key: 'Enter' },
      ...snapData('typed-wind'),
      { click: field('sog', '.value') },
      { fill: field('sog', 'input'), value: '' },
      { press: field('sog', 'input'), key: 'Enter' },
      ...snapData('typed-empty'),
    ],
  },
  {
    name: 'logbook-new-choices',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'new' },
      { click: field('quart', '[data-opt="Elena García"]') },
      { click: field('allure', '[data-opt="Près"]') },
      { click: field('mer', 'button:nth-child(4)') },
      { click: field('visi', 'button:nth-child(2)') },
      { click: field('gv', '[data-opt="1 ris"]') },
      { click: field('avant', '[data-opt="Foc"]') },
      { click: field('evt', '[data-opt="Virement"]') },
      { click: field('evt', '[data-opt="Prise de ris"]') },
      ...snapData('selected'),
      { click: field('allure', '[data-opt="Près"]') },
      { click: field('evt', '[data-opt="Virement"]') },
      ...snapData('deselected'),
      { click: field('evt', '[data-opt="Prise de ris"]') },
      ...snapData('multi-empty'),
    ],
  },
  {
    name: 'logbook-new-time',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'new' },
      { click: field('t', '[data-min="5"]') },
      { click: field('t', '[data-min="5"]') },
      { click: field('t', '[data-min="-5"]') },
      ...snapData('shifted'),
      { click: field('t', '[data-act="now"]') },
      ...snapData('now'),
      { fill: field('t', 'input'), value: '2026-07-14T21:45' },
      ...snapData('picked'),
      { go: 'log' },
      { go: 'new' },
      ...snapData('kept-after-leaving'),
    ],
  },
  {
    name: 'logbook-new-position-denied',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      { go: 'new' },
      { eval: 'scrollTo(0, 2000)' },
      { click: field('pos', '[data-act="gps"]') },
      ...snap('gps-denied'),
      { click: field('pos', '[data-act="wx"]') },
      ...snap('wx-without-position'),
      { fill: field('pos', 'input'), value: 'Port de Morges' },
      { press: field('pos', 'input'), key: 'Tab' },
      ...snapData('manual'),
      { click: field('pos', '[data-act="wx"]') },
      ...snap('wx-manual-position'),
    ],
  },
  {
    name: 'logbook-new-position-gps',
    fixture: 'sample-sea',
    overrides: QUIET,
    geolocation: { latitude: 43.1729, longitude: 16.4411 },
    steps: [
      { go: 'new' },
      { click: field('pos', '[data-act="gps"]') },
      { wait: 500 },
      ...snapData('gps'),
      { click: field('pos', '[data-act="wx"]') },
      { wait: 800 },
      ...snapData('wx-offline'),
    ],
  },
  {
    name: 'logbook-new-save',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'new' },
      { click: field('loch', '[data-step="1"]') },
      { fill: field('note', 'textarea'), value: 'Grain au large' },
      ...snapData('filled'),
      { click: '#saveBtn' },
      ...snapData('saved'),
      { go: 'log' },
      ...snapData('in-journal'),
    ],
  },
  {
    name: 'logbook-new-note',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'new' },
      { fill: field('note', 'textarea'), value: 'Note' },
      ...snapData('typed'),
      { go: 'tracker' },
      { go: 'new' },
      ...snapData('reopened'),
      { click: field('note', '.clear') },
      ...snapData('cleared'),
    ],
  },
  {
    name: 'logbook-new-reset',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'new' },
      { click: field('sog', '.value') },
      { click: '#resetBtn' },
      ...snap('armed'),
      { click: '#resetBtn' },
      ...snapData('reset'),
    ],
  },
  {
    name: 'logbook-edit-direct',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'log' },
      { click: 'article[data-id="sea-e3"] [data-act="edit"]' },
      ...snapData('edit'),
    ],
  },
  {
    name: 'logbook-edit-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'new' },
      { go: 'log' },
      { click: 'article[data-id="sea-e3"] [data-act="edit"]' },
      ...snapData('edit'),
      { click: field('loch', '[data-step="1"]') },
      { click: field('t', '[data-min="-5"]') },
      { click: '#saveBtn' },
      ...snapData('saved'),
      { click: 'article[data-id="sea-e2"] [data-act="edit"]' },
      { click: '#cancelBtn' },
      ...snapData('cancelled'),
      { click: 'article[data-id="sea-e5"] [data-act="edit"]' },
      ...snapData('complete-auto'),
      { click: '#saveBtn' },
      ...snapData('auto-kept'),
    ],
  },
  {
    name: 'logbook-edit-lake',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      { go: 'log' },
      { click: 'article[data-id="lk-e3"] [data-act="edit"]' },
      ...snapData('edit'),
    ],
  },
  {
    name: 'logbook-log-lake',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [{ go: 'log' }, ...snap('log')],
  },
  {
    name: 'logbook-log-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [{ go: 'log' }, ...snap('log')],
  },
  {
    name: 'logbook-log-both',
    fixture: 'sample',
    overrides: QUIET,
    steps: [{ wait: CLOCK_TICK }, { go: 'log' }, ...snap('log')],
  },
  {
    name: 'logbook-log-empty',
    fixture: emptyJournal(),
    overrides: QUIET,
    steps: [
      { go: 'log' },
      ...snap('log'),
      { click: '#goNew' },
      ...snap('first-entry'),
    ],
  },
  {
    name: 'logbook-log-actions',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'log' },
      { click: 'article[data-id="sea-e4"] [data-act="del"]' },
      ...snap('armed'),
      { click: 'article[data-id="sea-e4"] [data-act="del"]' },
      ...snapData('deleted'),
      { click: '.day-head [data-day="2026-07-14"]' },
      ...snap('day'),
      { go: 'log' },
      { click: '.day-head [data-map="2026-07-14"]' },
      { wait: 300 },
      { go: 'log' },
      ...snap('back'),
    ],
  },
  {
    name: 'logbook-log-english',
    fixture: 'sample-sea',
    overrides: { ...QUIET, 'ldb.lang': 'en' },
    steps: [{ go: 'log' }, { wait: 300 }, ...snap('log')],
  },
  {
    name: 'logbook-day-lake',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [{ go: 'day', arg: '2026-07-15' }, ...snapData('day')],
  },
  {
    name: 'logbook-day-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'day', arg: '2026-07-14' },
      ...snapData('day-14'),
      { go: 'day', arg: '2026-07-15' },
      ...snapData('day-15'),
      { click: '.daynav [data-d="-1"]' },
      ...snap('previous'),
      { click: '.daynav [data-d="-1"]' },
      ...snapData('empty-day'),
      { click: '[data-today]' },
      ...snap('today'),
    ],
  },
  {
    name: 'logbook-day-both',
    fixture: 'sample',
    overrides: QUIET,
    steps: [{ wait: CLOCK_TICK }, { go: 'day' }, ...snapData('day')],
  },
  {
    name: 'logbook-day-english',
    fixture: 'sample-sea',
    overrides: { ...QUIET, 'ldb.lang': 'en' },
    steps: [{ go: 'day', arg: '2026-07-14' }, { wait: 300 }, ...snap('day')],
  },
  {
    name: 'logbook-day-edit-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'day', arg: '2026-07-15' },
      { fill: '[data-k="de"]', value: 'Hvar' },
      { fill: '[data-k="fVentVit"]', value: '18.5' },
      { fill: '[data-k="moteurSoir"]', value: '1530' },
      { fill: '[data-k="plein"]', value: '20' },
      { fill: '[data-k="fuelInit"]', value: '120' },
      { fill: '[data-k="moteurInit"]', value: '1500' },
      { fill: '[data-k="vMoteur"]', value: '6' },
      ...snapData('typed'),
      { click: '[data-k="fVentTend"] button:nth-child(1)' },
      { click: '[data-k="ctrl"] button:nth-child(3)' },
      { click: '[data-k="ctrl"] button:nth-child(5)' },
      { click: '[data-k="navigateur"] button:nth-child(2)' },
      ...snapData('chips'),
      { click: '[data-k="fVentTend"] button:nth-child(1)' },
      { click: '[data-k="ctrl"] button:nth-child(3)' },
      ...snapData('chips-off'),
      { click: '.tide[data-i="1"] [data-tt="PM"]' },
      { fill: '.tide[data-i="1"] [data-tf="h"]', value: '06:15' },
      { fill: '.tide[data-i="1"] [data-tf="m"]', value: '1.2' },
      {
        fill: '[data-k="dysfonct"]',
        value: 'Ligne 1\nLigne 2\nLigne 3\nLigne 4',
      },
      ...snapData('tides'),
      { click: '.tide[data-i="1"] [data-tt="BM"]' },
      { click: '.tide[data-i="1"] [data-tt="BM"]' },
      { fill: '[data-k="de"]', value: '' },
      ...snapData('cleared'),
    ],
  },
  {
    name: 'logbook-day-loch',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'day', arg: '2026-07-15' },
      { click: '[data-use="nmJour"]' },
      ...snapData('loch-used'),
      { fill: '[data-k="dureeNav"]', value: '5 h 30' },
      ...snapData('hand-duration'),
    ],
  },
  {
    name: 'logbook-day-signature',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'day', arg: '2026-07-15' },
      { click: '.sig-preview[data-sigopen="sigNav"]' },
      ...snap('pad'),
      { click: '.sig-bar [data-a="ok"]' },
      ...snap('nothing-signed'),
      { click: '.sig-bar [data-a="back"]' },
      ...snap('closed'),
      { click: '.sig-preview[data-sigopen="sigNav"]' },
      { click: '.sig-overlay canvas' },
      { click: '.sig-bar [data-a="undo"]' },
      { click: '.sig-overlay canvas' },
      { click: '.sig-bar [data-a="clear"]' },
      { click: '.sig-overlay canvas' },
      { click: '.sig-bar [data-a="ok"]' },
      ...snap('signed'),
      { click: '[data-sigclear="sigNav"]' },
      ...snap('erase-armed'),
      { click: '[data-sigclear="sigNav"]' },
      ...snapData('erased'),
    ],
  },
  {
    name: 'logbook-day-edit-lake',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      { go: 'day', arg: '2026-07-15' },
      { click: '[data-k="typeSortie"] [data-opt="Location"]' },
      ...snapData('rental'),
      { click: '[data-k="skipper"] [data-opt="Camille Rochat"]' },
      ...snapData('skipper'),
      { click: '[data-k="skipper"] [data-opt="Camille Rochat"]' },
      ...snapData('skipper-off'),
      { fill: '[data-k="observations"]', value: 'RAS' },
      { fill: '[data-k="moteurDebut"]', value: '1234,5' },
      ...snapData('typed'),
      { click: 'details[data-s="2"] summary' },
      { fill: '[data-k="fVentVit"]', value: '22' },
      ...snapData('weather-open'),
      { click: '[data-crew]' },
      ...snap('crew'),
      { go: 'day' },
      { click: '[data-sheet]' },
      ...snap('sheet'),
    ],
  },
  {
    name: 'logbook-compact-cycle',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'info' },
      { click: '[data-k="waters"] .cyc' },
      ...snap('asking'),
      { longpress: '[data-k="waters"] .cyc' },
      ...snapData('confirmed'),
      { wait: 1300 },
      ...snapData('inland'),
      { click: '[data-k="pas"] .cyc' },
      ...snapData('first-choice'),
      { click: '[data-k="pas"] .cyc' },
      ...snap('second-tap'),
      { wait: 4200 },
      ...snap('ask-expired'),
    ],
  },
  {
    name: 'logbook-compact-lock',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'info' },
      { click: '[data-k="beam"]' },
      ...snap('explained'),
      { wait: 2600 },
      ...snap('explained-end'),
      { longpress: '[data-k="beam"]' },
      ...snap('opened'),
      { fill: '[data-k="beam"]', value: '4,5' },
      { press: '[data-k="beam"]', key: 'Tab' },
      ...snapData('locked-again'),
    ],
  },
  {
    name: 'logbook-compact-auto',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'info' },
      ...snap('computed'),
      { longpress: '[data-k="draftPilot"]' },
      { fill: '[data-k="draftPilot"]', value: '3,5' },
      { press: '[data-k="draftPilot"]', key: 'Tab' },
      ...snapData('typed'),
      { fill: '[data-k="loa"]', value: '' },
      { press: '[data-k="loa"]', key: 'Tab' },
      ...snapData('pair-emptied'),
    ],
  },
  {
    name: 'logbook-compact-more',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'info' },
      { click: '[data-reveal="fuelCap2"]' },
      ...snap('revealed'),
      { fill: '[data-k="fuelCap2"]', value: '120' },
      ...snapData('filled'),
      { fill: '[data-k="du"]', value: '2026-08-01' },
      ...snapData('end-date-follows'),
    ],
  },
  {
    name: 'logbook-compact-sails',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'info' },
      { fill: '.sail-name', value: 'Génois' },
      { fill: '.sail-list .sail-desc', value: 'bande bleue' },
      { click: '.sail-list .sail-col' },
      { click: '.sail-list .sail-col' },
      { fill: '[data-gv]', value: 'numéro 12' },
      { click: '[data-gvcol]' },
      ...snapData('first-sail'),
      { click: '.sail-add' },
      ...snap('row-added'),
      { click: '.sail-add' },
      ...snap('row-focused'),
      { press: '.sail-list .sail-row:nth-child(2) .sail-name', key: 'Tab' },
      { press: '.sail-list .sail-row:nth-child(2) .sail-col', key: 'Tab' },
      { press: '.sail-list .sail-row:nth-child(2) .sail-desc', key: 'Tab' },
      { wait: 300 },
      ...snapData('row-removed'),
    ],
  },
  {
    name: 'logbook-compact-desc',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'info' },
      { click: '.desc-say' },
      ...snap('french'),
      { wait: 3100 },
      ...snap('english'),
      { click: 'details.desc-edit summary' },
      { fill: '[data-k="desc"]', value: 'White yacht' },
      ...snapData('forced'),
      { fill: '[data-k="desc"]', value: '' },
      { press: '[data-k="desc"]', key: 'Tab' },
      ...snapData('automatic-again'),
    ],
  },
  {
    name: 'logbook-compact-member',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      { go: 'people' },
      { click: '#view [data-fiche="ex3"]' },
      ...snap('card'),
      { click: '.lab-cyc[data-val="Lieu de naissance"]' },
      ...snap('label-cycled'),
      { fill: '[data-k="expiration"]', value: '01.08.2026' },
      ...snap('expires-soon'),
      { fill: '[data-k="expiration"]', value: '01.01.2020' },
      ...snap('expired'),
      { fill: '[data-k="piece"]', value: 'X123' },
      { press: '[data-k="piece"]', key: 'Tab' },
      { click: '.lab-cyc[data-val="Passeport"]' },
      ...snap('label-asks'),
      { longpress: '.lab-cyc[data-val="Passeport"]' },
      ...snap('label-confirmed'),
    ],
  },
];
