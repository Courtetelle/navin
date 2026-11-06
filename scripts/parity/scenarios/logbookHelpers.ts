import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Fixture, Step } from '../types.ts';

export const QUIET = { 'ldb.tipIdx': '6' };
const CRUISE_KEY = 'ldb.cruise.mrltkr40tkny6';
// Legacy computes the first clock before opening the cruise: with lake and sea
// cruises, its zone is only right after the next tick.
export const CLOCK_TICK = 10_500;
// Short settle for the scenarios that compare what lasts a few seconds (bubble,
// armed button, question of a chip), once the page is loaded.
export const QUICK_SETTLE = 200;
export const PAGE_LOADED = 1500;
// An armed button goes back to normal after 3 s.
export const ARMED_END = 3200;
// Long texts scroll once in their field, for at most 6 s and 1.4 s back.
export const MARQUEE_END = 8000;

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

export function snap(name: string): Step[] {
  return [SCROLL_TOP, { snapshot: name }];
}

export function snapData(name: string): Step[] {
  return [DUMP, SCROLL_TOP, { snapshot: name }];
}

export function field(key: string, selector = ''): string {
  return `.field[data-key="${key}"] ${selector}`.trim();
}

function fixtureOf(name: string): Fixture {
  const path = join(import.meta.dirname, '..', 'fixtures', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Fixture;
}

/** The sea fixture with an open cruise that has no entry yet. */
export function emptyJournal(): Fixture {
  const fixture = fixtureOf('sample-sea');
  const cruise = fixture[CRUISE_KEY] as Record<string, unknown>;
  return { ...fixture, [CRUISE_KEY]: { ...cruise, entries: [], days: {} } };
}
