import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Scenario, Step } from '../types.ts';

// No boot tip, and the lake maps already downloaded: their download starts 6 s
// after the boot and shows in the settings, at a different moment in each app.
export const QUIET = {
  'ldb.tipIdx': '6',
  'ldb.lakesBase': {
    leman: { done: true },
    neuch: { done: true },
    vd2: { done: true },
    toldDone: true,
  },
};

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
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (/localhost:430[12]/.test(node.nodeValue)) node.nodeValue = node.nodeValue.replace(/localhost:430[12]/, 'localhost');
    }
  })()`,
};

// Both clocks tick every 10 s: after a change of cruise, each one has seen it.
export const CLOCK_TICKED: Step = { wait: 10_500 };

export function snap(name: string): Step[] {
  return [NORMALIZE, { snapshot: name }];
}

export function enter(view: string): Step[] {
  return [{ go: view }, { eval: `(async () => { ${WAIT_FOR_SCREEN} })()` }];
}

// Legacy only: keeps what its file builders produce, for the unit tests.
export const LEGACY_FILES: Step = {
  eval: `if (!window.__parity) {
    localStorage.setItem('__csvEntries', csvEntries());
    localStorage.setItem('__csvDays', csvDays());
    localStorage.setItem('__cruiseBackup', JSON.stringify({ app: 'livre-de-bord', version: 2, cruise, track: loadTrack() }, null, 1));
    localStorage.setItem('__fileName', fileName('-entrees', 'csv'));
    localStorage.setItem('__backupAll', backupAll().json);
  }`,
};
// Legacy only: values the shared fixture lacks (tides, quotes in a note, a track).
export const SEA_DETAILS: Step = {
  eval: `if (!window.__parity) {
    cruise.days['2026-07-14'].marees = [{ type: 'PM', h: '06:12', m: '4,2' }, { type: 'BM', h: '12:30' }, {}];
    cruise.entries[0].v.note = 'Dit "bonjour"; fin';
    saveCruise();
    saveTrack([[1784102400000, 43.5, 16.4], [1784106000000, 43.2, 16.5]]);
  }`,
};

export function fixtureOf(name: string): Record<string, unknown> {
  const path = join(import.meta.dirname, '../fixtures', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

export function fileOf(fixture: string, key: string): string {
  return JSON.stringify(fixtureOf(fixture)[key]);
}

// The sea sample with neither entries nor day sheets.
export function emptySeaCruise(): Record<string, unknown> {
  const key = 'ldb.cruise.mrltkr40tkny6';
  const seed = fixtureOf('sample-sea');
  return {
    ...seed,
    [key]: { ...(seed[key] as object), entries: [], days: {} },
  };
}

// Chooses a file in a hidden file input, as the picker would.
export function chooseFile(input: string, content: string): Step {
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
export const SHOW_STORAGE: Step = {
  eval: `{
    const keys = Object.keys(localStorage).filter((key) => !key.startsWith('__')).sort();
    const shown = document.createElement('pre');
    shown.id = 'parityStorage';
    shown.hidden = true;
    shown.textContent = keys.map((key) => key + ' = ' + localStorage.getItem(key)).join(' ### ');
    document.body.append(shown);
  }`,
};

export const SHOW_ICON_LINKS: Step = {
  eval: `{
    const shown = document.createElement('pre');
    shown.id = 'parityIcons';
    shown.hidden = true;
    shown.textContent = ['icon', 'manifest', 'apple-touch-icon']
      .map((rel) => document.querySelector('link[rel="' + rel + '"]').getAttribute('href').slice(0, 60))
      .join(' ### ');
    document.body.append(shown);
  }`,
};

/** Screens without an open cruise or with each kind of cruise. */
export const FIXTURES = ['empty', 'sample', 'sample-lake', 'sample-sea'];

export function screen(name: string, fixture: string, view: string): Scenario {
  return {
    name: `data-${name}-${fixture}`,
    fixture,
    overrides: QUIET,
    steps: [...enter(view), ...snap(view)],
  };
}

// A print stub: the holder stays in the page, where the DOM comparison sees it.
export const NO_PRINT: Step = { eval: 'globalThis.print = () => {};' };

export function open(section: string): Step {
  return { click: `details[data-sec="${section}"] > summary` };
}

export const BOOK_PAGES = '[data-sel-all]';

export const GPX_TRACK = `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>
  <trkpt lat="43.50" lon="16.40"><time>2026-07-15T06:00:00Z</time></trkpt>
  <trkpt lat="43.45" lon="16.45"><time>2026-07-15T07:00:00Z</time></trkpt>
  <trkpt lat="43.40" lon="16.50"><time>2026-07-15T08:00:00Z</time></trkpt>
</trkseg></trk></gpx>`;
