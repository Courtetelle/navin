import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { prepDepart } from '../../features/prep/prepPicks.ts';
import { MODES } from '../../model/modes.ts';
import { curMode, state } from '../../state/index.ts';

import { PrepNav } from './PrepNav.tsx';

/**
 * The last step: the departure, or a reminder to choose a boat first.
 * @returns The step.
 */
export function PrepDepartStep() {
  useSignals();
  const cruise = state.data.cruise.value;
  if (!cruise) {
    return (
      <>
        <HelpText nextIsRow>
          Choisis d’abord le bateau (pastille 2) : cette étape s’active ensuite.
        </HelpText>
        <PrepNav />
      </>
    );
  }
  return (
    <>
      <HelpText nextIsRow>
        {`${MODES[curMode()].icon} ${cruise.info.name}. Tout est prêt : la trace et le journal automatique démarrent au toucher.`}
      </HelpText>
      <div className="row">
        <Button
          className="btn big auto-start"
          data-p="depart"
          onClick={prepDepart}
        >
          ⏺ Départ
          <small>enregistrer la trace</small>
        </Button>
      </div>
      <PrepNav />
    </>
  );
}
