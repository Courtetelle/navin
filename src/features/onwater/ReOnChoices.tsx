import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import type { AlertKind } from './alertsOff.ts';
import {
  reOnRuleOf,
  reOnText,
  setReOnRule,
  sharedReOnRule,
} from './alertsOff.ts';
import { REON_CHOICES } from './windReOn.ts';

/**
 * When an alert switched off comes back on, in plain sight under its
 * switch: four buttons, the one chosen lit.
 * @param props - The alert, or `all` (the Alertes menu: every alert at once).
 * @param props.kind - The alert.
 * @returns The sentence and the buttons.
 */
export function ReOnChoices({ kind }: { kind: AlertKind | 'all' }) {
  useSignals();
  const tr = useTr();
  const rule = kind === 'all' ? sharedReOnRule() : reOnRuleOf(kind);
  return (
    <>
      <p className="keep-help nav-hint reon-said">
        {rule
          ? tr(reOnText(rule, kind === 'all'))
          : tr(
              'Les alertes ont des choix différents : un toucher les accorde.',
            )}
      </p>
      <ButtonRow className="row c2 reon-row">
        {REON_CHOICES.map(([key, label]) => (
          <Button
            key={key}
            type="button"
            className={key === rule ? 'btn on' : 'btn'}
            aria-pressed={key === rule}
            data-reon={key}
            onClick={() => {
              buzz();
              setReOnRule(kind, key);
            }}
          >
            {tr(label)}
          </Button>
        ))}
      </ButtonRow>
    </>
  );
}
