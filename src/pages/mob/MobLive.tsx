import { useEffect, useState } from 'react';

import { ArmedButton } from '../../components/shared/ArmedButton.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import type { MobLogRecord } from '../../features/safety/mobLog.ts';
import { mobLog } from '../../features/safety/mobLog.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { pad } from '../../lib/format.ts';

import { MobPosBox } from './MobPosBox.tsx';

/** Props of {@link MobLive}. */
interface MobLiveProps {
  /** Open log. */
  log: MobLogRecord;
  training: boolean;
  lake: boolean;
  onRedraw: () => void;
}

/**
 * The banner of the running incident: time since the start, position at sea
 * (the lake page shows it lower), « Personne récupérée ».
 * @param props - Log and context.
 * @returns The banner.
 */
export function MobLive({ log, training, lake, onRedraw }: MobLiveProps) {
  const tr = useTr();
  return (
    <div className="mob-live">
      <b>
        {tr(`⏱ ${training ? 'Entraînement' : 'Incident'} en cours depuis `)}
        <TzTime date={log.start} seconds />
        {' · '}
        <MobClock start={log.start} />
      </b>
      {lake ? null : <MobPosBox />}
      <ButtonRow>
        <ArmedButton
          className="btn big primary"
          id="mobSaved"
          armedLabel={tr('Toucher encore : récupérée')}
          onClick={buzz}
          onConfirm={() => {
            mobLog('✔ Personne récupérée', { type: 'saved' });
            onRedraw();
          }}
        >
          {tr('✔ Personne récupérée')}
        </ArmedButton>
      </ButtonRow>
    </div>
  );
}

function MobClock({ start }: { start: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.floor((now - new Date(start).getTime()) / 1000);
  return (
    <span id="mobClock">
      {`${Math.floor(seconds / 60)} min ${pad(seconds % 60)} s`}
    </span>
  );
}
