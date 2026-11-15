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
 * In Réglages › Alertes: SOCIB changed its instruments (NavIn looks once a
 * week); the list of NavIn is to be put up to date, « Vu » hides it until
 * another change.
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
        <b>{tr('⚠️ SOCIB (Baléares) a changé ses instruments')}</b>
        <br />
        {tr(socibChangeText(watch))}
        <br />
        {tr(
          'La liste des instruments de NavIn est à mettre à jour : demander à Claude de la refaire.',
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
