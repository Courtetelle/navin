import { fmtDur, fmtShortDate, fmtTime, fr, pad } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import type { ChecklistBase, Mark, SosLog } from '../../model/types.ts';

import type { PublishItem, PublishRowData } from './types.ts';

/** A track with its statistics. */
interface PublishableTrack {
  /** Id. */
  id: string;
  /** Name. */
  name: string;
  /** Start, in milliseconds. */
  start: number;
  /** End, in milliseconds. */
  end: number;
  /** Distance in nautical miles. */
  nm: number;
  /** Top speed in knots. */
  max: number;
}

/**
 * Elements of the track list.
 * @param tracks - Tracks with their statistics.
 * @returns The elements.
 */
export function traceItems(tracks: readonly PublishableTrack[]): PublishItem[] {
  return tracks.map((track) => {
    const start = new Date(track.start);
    const end = new Date(track.end);
    const rows: PublishRowData[] = [
      ['Date', fmtShortDate(start)],
      ['Départ', fmtTime(start)],
      ['Arrivée', fmtTime(end)],
      ['Durée', fmtDur(track.end - track.start)],
      ['Distance', `${fr(track.nm)} NM`],
    ];
    if (track.max) rows.push(['Vitesse max', `${fr(track.max)} nd`]);
    return {
      id: track.id,
      name: track.name,
      sections: [{ title: track.name, rows }],
    };
  });
}

/**
 * Elements of the mark list, by number.
 * @param marks - Marks.
 * @returns The elements.
 */
export function markItems(marks: readonly Mark[]): PublishItem[] {
  return marks
    .toSorted((first, second) => first.n - second.n)
    .map((mark) => {
      const name = mark.name + (mark.note ? ` · ${mark.note}` : '');
      const rows: PublishRowData[] = [
        ['Date', `${dayText(mark.at)} ${timeText(mark.at)}`],
        ['Position', fmtPos(mark)],
      ];
      if (mark.depth) rows.push(['Profondeur', mark.depth]);
      return { id: mark.id, name, sections: [{ title: name, rows }] };
    });
}

/**
 * Elements of the checklist base list.
 * @param bases - Checklist bases.
 * @returns The elements.
 */
export function checklistBaseItems(
  bases: readonly ChecklistBase[],
): PublishItem[] {
  return bases.map((base) => {
    const categories = base.cats ?? [];
    const lines = base.items.map((item) => `☐ ${itemLabel(item)}`);
    const rows: PublishRowData[] = [
      [`${base.items.length} points`, lines.join('\n') || '–'],
    ];
    if (categories.length > 0) {
      rows.unshift(['Catégorie', categories.join(', ')]);
    }
    return {
      id: base.id,
      name: base.name,
      sections: [{ title: base.name, rows }],
    };
  });
}

/**
 * Elements of the SOS log list, the latest first.
 * @param logs - SOS logs, in storage order.
 * @returns The elements.
 */
export function sosLogItems(logs: readonly SosLog[]): PublishItem[] {
  return logs.toReversed().map((log) => {
    const startText = `${dayText(log.start)} ${timeText(log.start)}`;
    const name = `${startText}${log.boat ? ` · ${log.boat}` : ''}`;
    const actions = log.events.map(
      (event) =>
        `${timeText(event.t)} · ${event.what}${event.pos ? ` (${fmtPos(event.pos)})` : ''}`,
    );
    const rows: PublishRowData[] = [
      ['Début', startText],
      [
        'Fin',
        log.end ? `${dayText(log.end)} ${timeText(log.end)}` : 'en cours',
      ],
    ];
    if (log.boat) rows.push(['Bateau', log.boat]);
    rows.push(['Actions', actions.join('\n')]);
    return { id: log.id, name, sections: [{ title: `SOS ${name}`, rows }] };
  });
}

function itemLabel(item: unknown): string {
  if (typeof item === 'string') return item;
  const { label, text } = item as { label?: string; text?: string };
  return label || text || '';
}

function dayText(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

function timeText(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : fmtTime(date);
}
