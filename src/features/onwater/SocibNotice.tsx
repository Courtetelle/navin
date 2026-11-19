import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import {
  socibChangeText,
  socibSeen,
  socibToSay,
  socibWatch,
} from './socibWatch.ts';

/**
 * In Paramétrages › Alertes › Alerte vent: SOCIB changed its instruments and NavIn made
 * its list again by itself (once a week); « Vu » hides it until another
 * change.
 * @returns The notice, or nothing.
 */
export function SocibNotice() {
  useSignals();
  const tr = useTr();
  const watch = socibWatch.value;
  if (!socibToSay(watch)) return null;
  return (
    <div className="socib-notice" role="status">
      <p>
        <b>{tr('🔄 SOCIB (Baléares) : instruments mis à jour')}</b>
        <br />
        {tr(socibChangeText(watch))}
        <br />
        {tr(
          'SOCIB a changé ses instruments : NavIn a refait seul sa liste, LiveMétéo et les alertes lisent la nouvelle.',
        )}
      </p>
      <Button
        type="button"
        className="btn"
        onClick={() => {
          buzz();
          socibSeen();
        }}
      >
        {tr('Vu')}
      </Button>
    </div>
  );
}
