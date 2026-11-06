import { Button } from '../../components/shared/Button.tsx';
import { exportTrace, showTrace } from '../../features/map/traceActions.ts';
import { drawTrkList } from '../../features/map/traceList.ts';
import type { LakeTrack } from '../../features/map/trackStats.ts';
import { allLakeTracks, trackStats } from '../../features/map/trackStats.ts';
import { SwipeRow, deleteTrace } from '../../features/prep/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtDur, fmtShortDate, fr } from '../../lib/format.ts';

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
        <div>
          <b>{track.name}</b>
          <small>
            {tr(
              `${fmtShortDate(new Date(start))} · ${fr(stats.nm)} NM · ${fmtDur(end - start)}${top}`,
            )}
          </small>
        </div>
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
    </SwipeRow>
  );
}
