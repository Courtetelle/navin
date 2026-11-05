import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Scenario, Step } from '../types.ts';

const QUIET = { 'ldb.tipIdx': '6' };

// The React pages load lazily: their first opening can outlast the harness settle time.
const WAIT_FOR_SCREEN = `
  for (let tries = 0; tries < 300 && !document.querySelector('#view').firstElementChild; tries++) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }`;

/**
 * Differences that are not the screen's: legacy ticks its clock once before
 * opening the cruise, then every 10 s; the wake video goes last in both apps
 * (legacy appends it when the refused Wake Lock request comes back); the two
 * apps run on two ports, and the installation guide writes the address; the
 * automatic scroll of the harness can stop a pixel apart.
 */
const NORMALIZE: Step = {
  eval: `(async () => {
    ${WAIT_FOR_SCREEN}
    globalThis.tickClock?.();
    globalThis.scrollTo(0, 0);
    const wakeVideo = document.querySelector('body video, #root > video');
    if (wakeVideo) document.body.append(wakeVideo);
    const walker = document.createTreeWalker(document.querySelector('#view'), NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/localhost:430[12]/.test(node.nodeValue)) node.nodeValue = node.nodeValue.replace(/localhost:430[12]/, 'localhost');
    }
  })()`,
};

// Both clocks tick every 10 s: after a change of cruise, each one has seen it.
const CLOCK_TICKED: Step = { wait: 10_500 };

function snap(name: string): Step[] {
  return [NORMALIZE, { snapshot: name }];
}

function enter(view: string): Step[] {
  return [{ go: view }, { eval: `(async () => { ${WAIT_FOR_SCREEN} })()` }];
}

// Legacy only: keeps what its file builders produce, for the unit tests.
const LEGACY_FILES: Step = {
  eval: `if (!window.__parity) {
    localStorage.setItem('__csvEntries', csvEntries());
    localStorage.setItem('__csvDays', csvDays());
    localStorage.setItem('__cruiseBackup', JSON.stringify({ app: 'livre-de-bord', version: 2, cruise, track: loadTrack() }, null, 1));
    localStorage.setItem('__fileName', fileName('-entrees', 'csv'));
    localStorage.setItem('__backupAll', backupAll().json);
  }`,
};
// Legacy only: values the shared fixture lacks (tides, quotes in a note, a track).
const SEA_DETAILS: Step = {
  eval: `if (!window.__parity) {
    cruise.days['2026-07-14'].marees = [{ type: 'PM', h: '06:12', m: '4,2' }, { type: 'BM', h: '12:30' }, {}];
    cruise.entries[0].v.note = 'Dit "bonjour"; fin';
    saveCruise();
    saveTrack([[1784102400000, 43.5, 16.4], [1784106000000, 43.2, 16.5]]);
  }`,
};

function fixtureOf(name: string): Record<string, unknown> {
  const path = join(import.meta.dirname, '../fixtures', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function fileOf(fixture: string, key: string): string {
  return JSON.stringify(fixtureOf(fixture)[key]);
}

// The sea sample with neither entries nor day sheets.
function emptySeaCruise(): Record<string, unknown> {
  const key = 'ldb.cruise.mrltkr40tkny6';
  const seed = fixtureOf('sample-sea');
  return {
    ...seed,
    [key]: { ...(seed[key] as object), entries: [], days: {} },
  };
}

// Chooses a file in a hidden file input, as the picker would.
function chooseFile(input: string, content: string): Step {
  return {
    eval: `{
      const transfer = new DataTransfer();
      transfer.items.add(new File([${JSON.stringify(content)}], 'sauvegarde.json', { type: 'application/json' }));
      const input = document.querySelector('${input}');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }`,
  };
}

// Shows the whole localStorage in the page, so that the DOM comparison covers it.
const SHOW_STORAGE: Step = {
  eval: `{
    const keys = Object.keys(localStorage).filter((key) => !key.startsWith('__')).sort();
    const shown = document.createElement('pre');
    shown.id = 'parityStorage';
    shown.hidden = true;
    shown.textContent = keys.map((key) => key + ' = ' + localStorage.getItem(key)).join(' ### ');
    document.body.append(shown);
  }`,
};

/** Screens without an open cruise or with each kind of cruise. */
const FIXTURES = ['empty', 'sample', 'sample-lake', 'sample-sea'];

function screen(name: string, fixture: string, view: string): Scenario {
  return {
    name: `data-${name}-${fixture}`,
    fixture,
    overrides: QUIET,
    steps: [...enter(view), ...snap(view)],
  };
}

// A print stub: the holder stays in the page, where the DOM comparison sees it.
const NO_PRINT: Step = { eval: 'globalThis.print = () => {};' };

function open(section: string): Step {
  return { click: `details[data-sec="${section}"] > summary` };
}

const BOOK_PAGES = '[data-sel-all]';

const GPX_TRACK = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>
  <trkpt lat="43.50" lon="16.40"><time>2026-07-15T06:00:00Z</time></trkpt>
  <trkpt lat="43.45" lon="16.45"><time>2026-07-15T07:00:00Z</time></trkpt>
  <trkpt lat="43.40" lon="16.50"><time>2026-07-15T08:00:00Z</time></trkpt>
</trkseg></trk></gpx>`;

/** Data domain scenarios: data menu, cruises, info, crew, print, files, no-cruise page, settings. */
export const scenarios: Scenario[] = [
  // Data menu.
  ...FIXTURES.map((fixture) => screen('more', fixture, 'more')),
  {
    name: 'data-more-order',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('more'),
      { click: '[data-tile="log"]' },
      ...enter('more'),
      { click: '[data-tile="log"]' },
      ...enter('more'),
      { click: '[data-tile="soslogs"]' },
      ...enter('more'),
      ...snap('bumped'),
    ],
  },
  // Cruises.
  ...FIXTURES.map((fixture) => screen('cruises', fixture, 'cruises')),
  {
    name: 'data-cruises-modes',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      ...snap('unfolded'),
      { click: '[data-type="mer"]' },
      ...snap('sea'),
      { click: 'section.field h2' },
      { click: '[data-zone="A"]' },
      ...snap('atlantic'),
      { click: '[data-type="lacc"]' },
      ...snap('lake-cruise'),
      { click: 'section.field h2' },
      { click: '[data-boat="exb2"]' },
      ...snap('other-boat'),
      { click: '[data-type="lacj"]' },
      { click: '[data-purpose="Location"]' },
      ...snap('rental'),
      ...enter('cruises'),
      ...snap('back'),
    ],
  },
  {
    name: 'data-cruises-fields',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      { fill: '#newPlace', value: ' Split ' },
      ...snap('place'),
      { click: '#keepBoat' },
      ...snap('without-boat'),
      { click: '#keepBoat' },
      ...snap('with-boat'),
      { click: '#keepCrew' },
      ...snap('with-crew'),
      { click: '[data-zone="N"]' },
      ...snap('redrawn'),
      { fill: '#newName', value: 'Ma croisière' },
      { click: '[data-zone="B"]' },
      ...snap('typed-name'),
      ...enter('more'),
      ...enter('cruises'),
      ...snap('name-gone'),
    ],
  },
  {
    name: 'data-cruises-gps',
    fixture: 'sample',
    overrides: QUIET,
    geolocation: { latitude: 46.507, longitude: 6.626 },
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      { wait: 4000 },
      ...snap('lake-port'),
    ],
  },
  {
    name: 'data-cruises-gps-sea',
    fixture: 'empty',
    overrides: QUIET,
    geolocation: { latitude: 49.6, longitude: -1.6 },
    steps: [...enter('cruises'), { wait: 300 }, ...snap('sea-zone')],
  },
  {
    name: 'data-cruises-create-lake',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      { click: '[data-boat="exb1"]' },
      { click: '[data-purpose="Invitation"]' },
      { fill: '#newPlace', value: 'Morges' },
      { click: '#keepCrew' },
      { click: '#createBtn' },
      ...enter('cruises'),
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('created'),
    ],
  },
  {
    name: 'data-cruises-create-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      { click: '[data-zone="A"]' },
      { click: '#keepCrew' },
      { click: '#createBtn' },
      { wait: 300 },
      ...enter('cruises'),
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('created'),
    ],
  },
  {
    name: 'data-cruises-create-empty',
    fixture: 'empty',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: 'section.field h2' },
      { fill: '#newName', value: 'Grèce 2027' },
      { click: '#createBtn' },
      { wait: 300 },
      CLOCK_TICKED,
      ...snap('info'),
      SHOW_STORAGE,
      ...snap('stored'),
    ],
  },
  {
    name: 'data-cruises-open',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: '[data-type="mer"]' },
      { click: '[data-act="open"]' },
      ...enter('cruises'),
      CLOCK_TICKED,
      ...snap('opened'),
      { click: '[data-act="info"]' },
      ...snap('info'),
    ],
  },
  {
    name: 'data-cruises-delete',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: '[data-act="del"]' },
      ...snap('armed'),
      { click: '[data-act="del"]' },
      ...snap('asked'),
      { longpress: '[data-act="del"]' },
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('deleted'),
    ],
  },
  {
    name: 'data-cruises-links',
    fixture: 'empty',
    overrides: QUIET,
    steps: [
      ...enter('cruises'),
      { click: '[data-go-settings]' },
      { wait: 200 },
      ...snap('settings'),
    ],
  },
  // Boat and cruise sheet.
  screen('info', 'sample-lake', 'info'),
  screen('info', 'sample-sea', 'info'),
  {
    name: 'data-info-edit',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      ...enter('info'),
      { fill: '#infoForm [data-k="name"]', value: 'Grèce 2026' },
      { wait: 200 },
      SHOW_STORAGE,
      ...snap('renamed'),
    ],
  },
  // Crew.
  screen('crew', 'empty', 'crew'),
  screen('crew', 'sample-lake', 'crew'),
  screen('crew', 'sample-sea', 'crew'),
  // Print.
  screen('print', 'sample-lake', 'print'),
  screen('print', 'sample-sea', 'print'),
  {
    name: 'data-print-choices',
    fixture: 'sample',
    overrides: QUIET,
    steps: [
      ...enter('print'),
      { click: '[data-p="tech"]' },
      ...snap('tech'),
      { click: '[data-p="title"]' },
      ...snap('no-title'),
      { click: BOOK_PAGES },
      ...snap('all'),
      { click: BOOK_PAGES },
      ...snap('none'),
      { click: '#doPrint' },
      ...snap('nothing-chosen'),
      { click: '[data-sel="days"]' },
      ...snap('days'),
      ...enter('more'),
      ...enter('print'),
      ...snap('kept'),
    ],
  },
  {
    name: 'data-print-book-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      NO_PRINT,
      ...enter('print'),
      { click: BOOK_PAGES },
      { click: '#doPrint' },
      { wait: 200 },
      ...snap('book'),
    ],
  },
  {
    name: 'data-print-book-lake',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      NO_PRINT,
      ...enter('print'),
      { click: BOOK_PAGES },
      { wait: 300 },
      { click: '#doPrint' },
      { wait: 200 },
      ...snap('book'),
    ],
  },
  // Files.
  screen('export', 'sample-lake', 'export'),
  screen('export', 'sample-sea', 'export'),
  {
    name: 'data-export-nothing',
    fixture: emptySeaCruise(),
    overrides: QUIET,
    steps: [
      ...enter('export'),
      ...snap('export'),
      { click: '#csvBtn' },
      ...snap('no-entry'),
      { click: '#csvDayBtn' },
      ...snap('no-day'),
    ],
  },
  {
    name: 'data-export-gpx',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      ...enter('export'),
      chooseFile('#gpxFile', GPX_TRACK),
      { wait: 300 },
      ...snap('plan'),
    ],
  },
  // No open cruise.
  {
    name: 'data-nonav-sea',
    fixture: 'empty',
    overrides: { ...QUIET, 'ldb.zoneSim': 'mer' },
    steps: [
      ...enter('new'),
      ...snap('new'),
      ...enter('day'),
      ...snap('day'),
      ...enter('log'),
      ...snap('log'),
      ...enter('print'),
      ...snap('print'),
      { click: '[data-newnav="mer"]' },
      ...snap('sea-form'),
    ],
  },
  {
    name: 'data-nonav-lake',
    fixture: 'empty',
    overrides: { ...QUIET, 'ldb.zoneSim': 'lac' },
    steps: [
      ...enter('new'),
      ...snap('new'),
      { click: '[data-newnav="lacc"]' },
      ...snap('lake-form'),
      ...enter('new'),
      { click: '[data-go="cruises"]' },
      ...snap('cruises'),
    ],
  },
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
      open('maps'),
      ...snap('two-open'),
      { click: '[data-s="mapRadius"][data-v="100"]' },
      ...snap('redrawn'),
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
  // A backup made by legacy restored by both apps: same storage, same screen.
  {
    name: 'data-restore-full-empty',
    fixture: 'empty',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      chooseFile('#allFile', fileOf('data-files-lake', '__backupAll')),
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('restored'),
    ],
  },
  {
    name: 'data-restore-full-merge',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      chooseFile('#allFile', fileOf('data-files-lake', '__backupAll')),
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('merged'),
    ],
  },
  {
    name: 'data-restore-cruise',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...enter('export'),
      chooseFile('#importFile', fileOf('data-files-sea', '__cruiseBackup')),
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('restored'),
    ],
  },
  {
    name: 'data-restore-sheets-only',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...enter('settings'),
      chooseFile(
        '#allFile',
        JSON.stringify({
          all: true,
          version: 4,
          cruises: [],
          boats: [{ id: 'b-new', info: { boat: 'Nouveau' } }],
        }),
      ),
      { wait: 500 },
      CLOCK_TICKED,
      SHOW_STORAGE,
      ...snap('restored'),
    ],
  },
  {
    name: 'data-restore-invalid',
    fixture: 'sample-lake',
    overrides: QUIET,
    steps: [
      ...enter('export'),
      chooseFile('#importFile', '{"app":"autre"}'),
      { wait: 300 },
      ...snap('refused'),
    ],
  },
  // Translated screens: the data tab is lit.
  ...['en', 'it', 'es'].flatMap((language) =>
    ['more', 'cruises', 'print', 'export', 'info', 'settings'].map(
      (view): Scenario => ({
        name: `data-translated-${view}-${language}`,
        fixture: 'sample',
        overrides: { ...QUIET, 'ldb.lang': language, 'ldb.lang2': language },
        steps: [...enter(view), ...snap(view)],
      }),
    ),
  ),
  {
    name: 'data-translated-nonav-en',
    fixture: 'empty',
    overrides: { ...QUIET, 'ldb.lang': 'en', 'ldb.lang2': 'en' },
    steps: [...enter('print'), ...snap('nonav')],
  },
  // Fixtures of the file builders: run with --only <name> --dump <fixture>.
  {
    name: 'data-dump-files-lake',
    fixture: 'sample',
    overrides: QUIET,
    steps: [LEGACY_FILES],
  },
  {
    name: 'data-dump-files-sea',
    fixture: 'sample-sea',
    overrides: QUIET,
    steps: [SEA_DETAILS, LEGACY_FILES],
  },
];
