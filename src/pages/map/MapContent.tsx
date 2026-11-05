import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { loadLeaflet } from '../../features/map/leaflet.ts';
import { mapData } from '../../features/map/mapData.ts';
import { stopMapWatch } from '../../features/map/mapWatch.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtDate, fr, keyToDate } from '../../lib/format.ts';
import { daysWithData, isLake, navLabel } from '../../state/index.ts';

import { MapExtras } from './MapExtras.tsx';
import { MapSvg } from './MapSvg.tsx';
import type { JournalMap } from './buildJournalMap.ts';
import { buildJournalMap } from './buildJournalMap.ts';

const OFFLINE_NOTE =
  'Hors ligne : seul le fond des zones déjà affichées avec du réseau est disponible.';

/** Props of {@link MapContent}. */
export interface MapContentProps {
  /** Day shown, `null` for the whole cruise. */
  day: string | null;
  /** Show another day, or `'all'`. */
  onShowDay: (day: string) => void;
}

/**
 * The map of a period and its controls.
 * @param props - Day shown.
 * @returns The content of the screen.
 */
export function MapContent({ day, onShowDay }: MapContentProps) {
  useSignals();
  const tr = useTr();
  const [data] = useState(() => mapData(day));
  const [note, setNote] = useState(navigator.onLine ? '' : OFFLINE_NOTE);
  const [following, setFollowing] = useState(false);
  const [noMap, setNoMap] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const journal = useRef<JournalMap | null>(null);
  const days = daysWithData();
  const lake = isLake();
  const { line, ents, nm } = data;

  useEffect(() => {
    stopMapWatch();
    let closed = false;
    loadLeaflet()
      .then(() => {
        if (closed || !box.current) return;
        journal.current = buildJournalMap(box.current, data, {
          onNote: setNote,
          onFollow: setFollowing,
        });
      })
      .catch(() => {
        if (closed) return;
        setNoMap(true);
        setNote(
          'Carte de fond indisponible sans réseau : la trace est affichée seule.',
        );
      });
    return () => {
      closed = true;
      journal.current?.dispose();
      journal.current = null;
    };
  }, [data]);

  const move = (step: number) => {
    buzz();
    if (days.length === 0) return;
    let from = day ? days.indexOf(day) : days.length;
    if (!day && step > 0) from = -1;
    const index = Math.min(days.length - 1, Math.max(0, from + step));
    const next = days[index];
    if (next) onShowDay(next);
  };
  const label = day ? navLabel(day) : '';
  const period = label ? ` · navigation ${label}` : '';
  const entries = `${ents.length} entrée${ents.length > 1 ? 's' : ''}`;
  const empty = line.length === 0 && ents.length === 0;
  return (
    <>
      <div className="daynav">
        <Button
          className="btn"
          data-md="-1"
          aria-label="Jour précédent"
          onClick={() => move(-1)}
        >
          ◀
        </Button>
        <div>
          <div className="dn-date">
            {day ? fmtDate(keyToDate(day)) : tr('Toute la croisière')}
          </div>
          <div className="dn-sub">
            {tr(`${fr(nm)} NM${period} · ${entries}`)}
          </div>
        </div>
        <Button
          className="btn"
          data-md="1"
          aria-label="Jour suivant"
          onClick={() => move(1)}
        >
          ▶
        </Button>
      </div>
      {day ? (
        <ButtonRow style={{ marginBottom: '10px' }}>
          <Button
            className="btn"
            data-md="all"
            onClick={() => {
              buzz();
              onShowDay('all');
            }}
          >
            {tr('Toute la croisière')}
          </Button>
        </ButtonRow>
      ) : null}
      <div id="map" className="map" ref={box}>
        {noMap ? <MapSvg {...data} /> : null}
        {noMap && empty && !lake ? (
          <div className="empty-state">
            {tr('Pas encore de trace ni de position pour cette période.')}
            <br />
            <br />
            {tr('Lancez le journal automatique ou importez une trace GPX.')}
          </div>
        ) : null}
      </div>
      <HelpText id="mapNote">{note}</HelpText>
      <ButtonRow className="row c2">
        <Button
          className="btn"
          id="mapFit"
          disabled={(noMap && !empty) || (empty && !lake)}
          onClick={() => {
            buzz();
            journal.current?.fit();
          }}
        >
          {tr('⤢ Recentrer')}
        </Button>
        <Button
          className="btn primary"
          id="mapMe"
          disabled={noMap && !empty}
          onClick={() => {
            buzz();
            journal.current?.toggleFollow();
          }}
        >
          {tr(following ? '⏹ Arrêter le suivi' : '📍 Suivre ma position')}
        </Button>
      </ButtonRow>
      <MapExtras day={day} onShowDay={onShowDay} />
    </>
  );
}
