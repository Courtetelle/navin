import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import type { CardsDocument, CardsRow } from '../../features/publish/index.ts';
import { shareCards } from '../../features/publish/index.ts';
import type { MobLogRecord } from '../../features/safety/mobLog.ts';
import { bothTimes, fmtShortDate, hms } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import { state } from '../../state/index.ts';

/**
 * A man-overboard log as a document of the layout of Réglages.
 * @param log - The log.
 * @param cruiseName - Name of the open cruise, if any.
 * @returns The document.
 */
export function mobLogDocument(
  log: MobLogRecord,
  cruiseName: string | undefined,
): CardsDocument {
  const kind = log.kind === 'train' ? 'Entraînement' : 'Incident';
  const rows = log.events.map((event): [string, string] => [
    log.zone === 'lac' ? hms(new Date(event.t)) : bothTimes(event.t),
    `${event.what}${event.pos ? ` (${fmtPos(event.pos)})` : ''}`,
  ]);
  const minutes = log.end
    ? Math.round((Date.parse(log.end) - Date.parse(log.start)) / 60_000)
    : null;
  return {
    title: `${kind} homme à la mer`,
    kicker: 'Log',
    sub: `${fmtShortDate(new Date(log.start))}${cruiseName ? ` · ${cruiseName}` : ''}`,
    sections: [
      { title: 'Événements', rows },
      ...(minutes == null
        ? []
        : [{ title: '', rows: [['Durée', `${minutes} min`] as CardsRow] }]),
    ],
  };
}

/**
 * Share a man-overboard log as an image or a PDF.
 * @param log - The log.
 * @param format - Image or PDF.
 */
export function shareMobLog(log: MobLogRecord, format: ShareFormat): void {
  const start = log.start.slice(0, 16).replaceAll(/[:T]/g, '-');
  void shareCards(
    mobLogDocument(log, state.data.cruise.value?.info.name),
    `log-homme-a-la-mer-${start}`,
    format,
  );
}
