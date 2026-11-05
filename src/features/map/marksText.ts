import { fmtShortDate, fmtUtc } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import type { Mark } from '../../model/types.ts';

import { escapeHtml } from './escapeHtml.ts';

/**
 * The marks as a GPX file (legacy `marksGpx`).
 * @param marks - Marks, in file order.
 * @returns The GPX text.
 */
export function marksGpx(marks: readonly Mark[]): string {
  const points = marks.map((mark) => {
    const note = mark.note ? `<desc>${escapeHtml(mark.note)}</desc>` : '';
    return `<wpt lat="${mark.lat}" lon="${mark.lon}"><time>${mark.at}</time><name>${escapeHtml(mark.name)}</name>${note}</wpt>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="NavIn" xmlns="http://www.topografix.com/GPX/1/1">\n${points.join('\n')}\n</gpx>`;
}

/**
 * The marks as a text list, one per line.
 * @param marks - Marks, in list order.
 * @returns The text.
 */
export function marksText(marks: readonly Mark[]): string {
  return marks
    .map((mark) => {
      const moment = new Date(mark.at);
      const note = mark.note ? ` (${mark.note})` : '';
      const depth = mark.depth ? ` · ${mark.depth}` : '';
      return `${mark.name}${note} · ${fmtShortDate(moment)} ${fmtUtc(moment)} · ${fmtPos(mark)}${depth}`;
    })
    .join('\n');
}
