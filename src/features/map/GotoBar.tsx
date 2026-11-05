import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';

import { gotoBar, setGoto } from './goto.ts';

/**
 * Content of `#gotoBar`: distance, course and correction to the target.
 * @returns The texts and the stop button.
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
