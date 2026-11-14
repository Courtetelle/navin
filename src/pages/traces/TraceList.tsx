import { useState } from 'react';

import type { ShareFormat } from '../../components/shared/shareFormat.ts';
import { useLongPress } from '../../components/shared/useLongPress.ts';
import { exportTrace, showTrace } from '../../features/map/traceActions.ts';
import { drawTrkList } from '../../features/map/traceList.ts';
import type { LakeTrack } from '../../features/map/trackStats.ts';
import {
  allLakeTracks,
  renameTrace,
  traceSheet,
  trackStats,
} from '../../features/map/trackStats.ts';
import { SwipeRow, deleteTrace } from '../../features/prep/index.ts';
import { shareCards } from '../../features/publish/index.ts';
import { tracePlan } from '../../features/publish/planPhoto.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtDur, fmtShortDate, fmtTime, fr } from '../../lib/format.ts';

function deleteAndRefresh(id: string): boolean {
  const deleted = deleteTrace(id);
  if (deleted) drawTrkList();
  return deleted;
}

/**
 * The recorded tracks, read when mounted (legacy `drawTrkList`).
 * @returns `#trkList`.
 */
export function TraceList() {
  const tr = useTr();
  const tracks = allLakeTracks();
  return (
    <div id="trkList">
      {tracks.length > 0 ? (
        tracks.map((track) => <TraceItem key={track.id} track={track} />)
      ) : (
        <p className="help">
          {tr('Aucune trace enregistrée pour l’instant.', { help: true })}
        </p>
      )}
    </div>
  );
}

/**
 * One trace, a band as a mark: a touch shows it on the map, a long press
 * changes its text in place; swiped, 👁 Visualiser, Partager (Texte or GPX)
 * and Effacer.
 * @param props - The trace.
 * @param props.track - The trace.
 * @returns The band.
 */
function TraceItem({ track }: { track: LakeTrack }) {
  const tr = useTr();
  const [editing, setEditing] = useState<string | null>(null);
  const press = useLongPress(() => setEditing(track.name));
  const stats = trackStats(track.track);
  const start = stats.start ?? 0;
  const end = stats.end ?? 0;
  const top = stats.max ? ` · max ${fr(stats.max)} nd` : '';
  const save = (text: string) => {
    setEditing(null);
    if (text.trim() === track.name) return;
    renameTrace(track.id, text);
    drawTrkList();
  };
  return (
    <SwipeRow
      id={track.id}
      name={track.name}
      silent
      onDelete={deleteAndRefresh}
      onView={() => showTrace(track)}
      onShare={(format) => {
        void shareTrace(track, format);
      }}
      onGpx={() => exportTrace(track)}
    >
      <div className="section mark-item trk-band" data-trace={track.id}>
        {editing === null ? (
          <button
            type="button"
            className={`mark-head${press.hit ? ' lp-hit' : ''}`}
            aria-label={tr(
              `${track.name} · toucher : sur la carte · appui long : changer le texte`,
            )}
            onClick={() => {
              buzz();
              showTrace(track);
            }}
            {...press.handlers}
          >
            <span className="mk-pin" aria-hidden="true">
              🛰
            </span>
            <span className="mk-text">
              <b className="b-nm">{track.name}</b>
              <small>
                {tr(
                  `${fmtShortDate(new Date(start))} · ${fr(stats.nm)} NM · ${fmtDur(end - start)}${top}`,
                )}
              </small>
            </span>
          </button>
        ) : (
          <form
            className="mark-head mark-edit"
            onSubmit={(event) => {
              event.preventDefault();
              save(editing);
            }}
          >
            <span className="mk-pin" aria-hidden="true">
              🛰
            </span>
            <input
              className="text"
              data-trk="text"
              // Opened by a long press, to be written in at once.
              autoFocus
              enterKeyHint="done"
              value={editing}
              aria-label={tr(`Texte de ${track.name}`)}
              onChange={(event) => setEditing(event.target.value)}
              onBlur={() => save(editing)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditing(null);
              }}
            />
          </form>
        )}
      </div>
    </SwipeRow>
  );
}

function knots(value: number | null): string {
  return value === null ? 'non enregistré' : `${fr(value)} nd`;
}

/**
 * The figures of a trace, as its sheet shows them.
 * @param track - The trace.
 * @returns `[label, value]` pairs.
 */
function traceRows(track: LakeTrack): Array<[string, string]> {
  const sheet = traceSheet(track.track);
  return [
    ['Durée', fmtDur(sheet.duration)],
    ['Longueur', `${fr(sheet.nm)} NM`],
    ['Vitesse max', `${fr(sheet.maxSpeed)} nd`],
    ['Vitesse moyenne', `${fr(sheet.meanSpeed)} nd`],
    ['Vent réel max', knots(sheet.maxWind)],
    ['Vent réel moyen', knots(sheet.meanWind)],
    ['Vent apparent max', knots(sheet.maxApparent)],
    ['Vent apparent moyen', knots(sheet.meanApparent)],
    ...sheet.sun.map(({ kind, at }): [string, string] => [
      kind === 'rise' ? 'Lever du soleil' : 'Coucher du soleil',
      fmtTime(new Date(at)),
    ]),
  ];
}

/**
 * Share a trace: its sheet and its plan as an image or a PDF, in the layout
 * of Réglages.
 * @param track - The trace.
 * @param format - Image or PDF.
 */
async function shareTrace(
  track: LakeTrack,
  format: ShareFormat,
): Promise<void> {
  const start = trackStats(track.track).start ?? Date.now();
  // The plan of the trace under its figures, when the network allows it.
  const plan = await tracePlan(track).catch(() => null);
  await shareCards(
    {
      title: track.name,
      kicker: 'Trace',
      sub: fmtShortDate(new Date(start)),
      sections: [{ title: 'Trace', rows: traceRows(track) }],
      photos: plan ? [{ url: plan, cap: track.name }] : [],
      photosTitle: 'Plan',
    },
    `NavIn-trace-${track.name.replaceAll(/[^\w-]+/g, '-')}`,
    format,
  );
}
