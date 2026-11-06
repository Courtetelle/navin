import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { exportTrace, showTrace } from '../../features/map/traceActions.ts';
import { drawTrkList } from '../../features/map/traceList.ts';
import type { LakeTrack } from '../../features/map/trackStats.ts';
import {
  allLakeTracks,
  traceSheet,
  trackStats,
} from '../../features/map/trackStats.ts';
import { SwipeRow, deleteTrace } from '../../features/prep/index.ts';
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

function TraceItem({ track }: { track: LakeTrack }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const stats = trackStats(track.track);
  const start = stats.start ?? 0;
  const end = stats.end ?? 0;
  const top = stats.max ? ` · max ${fr(stats.max)} nd` : '';
  return (
    <SwipeRow
      id={track.id}
      name={track.name}
      silent
      onDelete={deleteAndRefresh}
    >
      <div className="trk-item">
        <button
          type="button"
          className="trk-open"
          aria-expanded={open}
          onClick={() => {
            buzz();
            setOpen((value) => !value);
          }}
        >
          <b>{track.name}</b>
          <small>
            {tr(
              `${fmtShortDate(new Date(start))} · ${fr(stats.nm)} NM · ${fmtDur(end - start)}${top}`,
            )}
          </small>
        </button>
        <Button
          className="btn"
          data-show={track.id}
          onClick={() => {
            buzz();
            showTrace(track);
          }}
        >
          🗺
        </Button>
        <Button
          className="btn"
          data-gpx={track.id}
          onClick={() => {
            buzz();
            exportTrace(track);
          }}
        >
          GPX
        </Button>
      </div>
      {open ? <TraceFiche track={track} /> : null}
    </SwipeRow>
  );
}

function knots(value: number | null): string {
  return value === null ? 'non enregistré' : `${fr(value)} nd`;
}

function TraceFiche({ track }: { track: LakeTrack }) {
  const tr = useTr();
  const sheet = traceSheet(track.track);
  const rows: Array<[string, string]> = [
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
  return (
    <dl className="trk-sheet">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{tr(label)}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
