import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

import { fitGoto, gotoBar, setGoto } from './goto.ts';

/**
 * Content of `#gotoBar`: distance, course and correction to the target.
 * @returns The texts, the button showing the whole route, the stop button.
 */
export function GotoBar() {
  useSignals();
  const bar = gotoBar.value;
  if (!bar) return null;
  return (
    <>
      <span>
        🎯 {bar.name} :{' '}
        {bar.waiting ? (
          'en attente du GPS…'
        ) : (
          <>
            <b>{bar.distance}</b> · <b>{bar.bearing}</b>
            {bar.tail}
          </>
        )}
      </span>
      <Button
        className="btn goto-fit"
        id="gotoFit"
        aria-label="Voir toute la route du Go to"
        onClick={() => {
          buzz();
          fitGoto();
        }}
      >
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="17" fill="#ff00aa" />
          <circle cx="20" cy="20" r="12" fill="#fff" />
          <circle cx="20" cy="20" r="7" fill="#ff00aa" />
          <circle cx="20" cy="20" r="2.5" fill="#fff" />
        </svg>
      </Button>
      <Button
        className="btn"
        id="gotoStop"
        onClick={() => {
          buzz();
          setGoto(null);
          toast('Go to arrêté');
        }}
      >
        ■
      </Button>
    </>
  );
}
