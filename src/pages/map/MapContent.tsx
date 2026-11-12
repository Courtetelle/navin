import { useSignals } from '@preact/signals-react/runtime';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { mapData } from '../../features/map/mapData.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { isLake } from '../../state/index.ts';

import { DayNav } from './DayNav.tsx';
import { MapSvg } from './MapSvg.tsx';
import { useJournalMap } from './useJournalMap.ts';

/** Props of {@link MapContent}. */
interface MapContentProps {
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
  const box = useRef<HTMLDivElement>(null);
  const { journal, note, following, noMap } = useJournalMap(box, data);
  const lake = isLake();
  const empty = data.line.length === 0 && data.ents.length === 0;
  return (
    <>
      <DayNav
        day={day}
        nm={data.nm}
        entries={data.ents.length}
        onShowDay={onShowDay}
      />
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
    </>
  );
}
