import { signal } from '@preact/signals-react';

import { dayKey, fmtShortDate, keyToDate } from '../../lib/format.ts';
import type { Cruise } from '../../model/types.ts';
import { daysWithData, isLake } from '../../state/index.ts';

/** One page offered by the print screen. */
export interface PrintPageChoice {
  /** Page id, as `printBook` reads it. */
  id: string;
  /** Label of the checkbox. */
  label: string;
  /**
   * Small text after the label.
   * @default undefined
   */
  sub?: string;
  /**
   * A day page.
   * @default false
   */
  day?: boolean;
  /**
   * Not selected by default: the page would be empty.
   * @default false
   */
  off?: boolean;
}

/** Pages left unchecked at first. */
const UNCHECKED: ReadonlySet<string> = new Set(['blank', 'tech', 'prep']);

/** Pages checked, kept from one visit to the next (`null` before the first visit). */
export const printSelection = signal<ReadonlySet<string> | null>(null);

/**
 * Keep the first selection for the next visits.
 * @param selection - Pages checked on screen.
 */
export function keepPrintSelection(selection: ReadonlySet<string>): void {
  printSelection.value ??= selection;
}

/**
 * Change the pages checked.
 * @param selection - New selection.
 */
export function setPrintSelection(selection: ReadonlySet<string>): void {
  printSelection.value = selection;
}

/**
 * Pages of the log book of a cruise (legacy `printPages`).
 * @param cruise - Open cruise.
 * @returns The choices, in print order.
 */
export function printPages(cruise: Cruise): PrintPageChoice[] {
  const pages: PrintPageChoice[] = [
    { id: 'title', label: 'Page de titre : croisière et bateau' },
    { id: 'tech', label: 'Fiche technique du bateau' },
    { id: 'crew', label: 'Liste d’équipage', off: cruise.crew.length === 0 },
    { id: 'safety', label: 'Sécurité, secours et météo' },
    { id: 'radio', label: 'Messages radio (MAYDAY, PAN PAN, SÉCURITÉ…)' },
  ];
  for (const key of daysWithData(cruise)) {
    const count = cruise.entries.filter(
      (entry) => dayKey(new Date(entry.t)) === key,
    ).length;
    pages.push({
      id: `day:${key}`,
      label: `Journée du ${fmtShortDate(keyToDate(key))}`,
      sub: `${count} entrée${count > 1 ? 's' : ''}`,
      day: true,
    });
  }
  if (isLake(cruise)) {
    pages.push({ id: 'prep', label: 'PréP et check-in (avec photos)' });
  }
  pages.push({
    id: 'blank',
    label: 'Page vierge à remplir à la main (secours)',
  });
  return pages;
}

/**
 * Selection of the first visit: everything but the optional pages.
 * @param pages - Pages offered.
 * @returns The ids checked.
 */
export function defaultSelection(
  pages: readonly PrintPageChoice[],
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const page of pages) {
    if (!page.off && !UNCHECKED.has(page.id)) ids.add(page.id);
  }
  return ids;
}
