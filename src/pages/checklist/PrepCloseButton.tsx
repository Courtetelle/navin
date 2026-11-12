import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { currentCheckIn, prepClose } from '../../features/prep/prepClose.ts';
import { useTr } from '../../i18n/useTr.ts';
import { state } from '../../state/index.ts';

/**
 * Under the Observations of the PréP check-in: shown once an item is green or
 * an observation written, it closes the PréP; its words say whether all is
 * done.
 * @returns The button, or nothing before the first item.
 */
export function PrepCloseButton() {
  useSignals();
  const tr = useTr();
  // The cruise read, so that the button follows each item and each word typed.
  const reached = state.data.cruise.value ? currentCheckIn() : 'none';
  if (reached === 'none') return null;
  return (
    <ButtonRow className="row ck-close-row">
      <Button
        className={`btn big ck-close ${reached === 'ok' ? 'ck-close-ok' : 'ck-close-part'}`}
        id="prepClose"
        onClick={prepClose}
      >
        {tr(
          reached === 'ok'
            ? '✅ Prép terminée, prêt au départ'
            : '🔒 Clore la Prép en cours',
        )}
      </Button>
    </ButtonRow>
  );
}
