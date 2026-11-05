import { untracked } from '@preact/signals-react';

import { Button } from '../../components/shared/Button.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { sosLogActive } from '../../state/index.ts';

/**
 * Banner of the running SOS procedure (legacy `sosLogBanner`). Like legacy, it
 * shows the number of actions when the screen is drawn, not live.
 * @returns The button, or nothing when no procedure runs.
 */
export function SosLogBanner() {
  const log = untracked(sosLogActive);
  if (!log) return null;
  const count = log.events.length;
  const plural = count > 1 ? 's' : '';
  return (
    <Button
      className="btn big sos-log-on"
      data-go="soslogs"
      onClick={() => {
        buzz();
        go('soslogs');
      }}
    >
      {log.ex ? '🧪 Exercice · ' : ''}⏺ Procédure SOS en cours depuis{' '}
      <TzTime date={log.start} seconds />
      <small>
        {count} action{plural} notée{plural} · toucher pour voir le log
      </small>
    </Button>
  );
}
