import { useSignals } from '@preact/signals-react/runtime';
import { createPortal } from 'react-dom';

import { Button } from '../../components/shared/Button.tsx';
import { useBodyClass } from '../../shell/bodyClass.ts';

import { sosExOn } from './sosExercise.ts';

/**
 * The orange ribbon shown on every screen during an SOS exercise (legacy
 * `sosExRibbon`), with `body.sos-ex`.
 * @returns The ribbon portal, or nothing.
 */
export function SafetyOverlay() {
  useSignals();
  const exercise = sosExOn();
  useBodyClass('sos-ex', exercise);
  if (!exercise) return null;
  return createPortal(
    <div id="exRibbon" className="no-print">
      <span>🧪 EXERCICE SOS · aucun appel réel</span>
      <Button type="button" className="btn" data-sosex="end">
        ⏹ Terminer l’exercice
      </Button>
    </div>,
    document.body,
  );
}
