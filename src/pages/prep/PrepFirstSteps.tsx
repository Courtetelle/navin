import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { prepPathSub } from '../../features/prep/prepPaths.ts';
import { pickDuree, pickPurpose } from '../../features/prep/prepPicks.ts';
import type { PrepFlow } from '../../features/prep/prepTypes.ts';
import { PREP_PURPOSES } from '../../model/modes.ts';

import { PrepNav } from './PrepNav.tsx';

/** Props of the PréP steps. */
export interface PrepStepProps {
  /** PréP flow. */
  prep: PrepFlow;
}

/**
 * Lake outing: Entraînement, Location or Invitation, each with its own path.
 * @param props - PréP flow.
 * @returns The three choices.
 */
export function PrepPurposeStep({ prep }: PrepStepProps) {
  useSignals();
  return (
    <>
      <div className="row prep-col">
        {PREP_PURPOSES.map(([purpose, icon, sub]) => {
          const current = prepPathSub(purpose);
          return (
            <Button
              key={purpose}
              className={`btn big ${prep.purpose === purpose ? 'on' : ''}${current ? ' prep-path-on' : ''}`}
              data-pick="purpose"
              data-v={purpose}
              onClick={() => pickPurpose(purpose)}
            >
              {icon} {purpose}
              <small>{current || sub}</small>
            </Button>
          );
        })}
      </div>
      <PrepNav />
    </>
  );
}

/**
 * One day or a cruise.
 * @param props - PréP flow.
 * @returns The two choices.
 */
export function PrepDureeStep({ prep }: PrepStepProps) {
  return (
    <>
      <div className="row c2">
        <Button
          className={`btn big ${prep.duree === 'jour' ? 'on' : ''}`}
          data-pick="duree"
          data-v="jour"
          onClick={() => pickDuree('jour')}
        >
          ☀️ Un jour
          <small>
            {prep.type === 'mer' ? 'sortie à la journée' : 'sortie du jour'}
          </small>
        </Button>
        <Button
          className={`btn big ${prep.duree === 'croisiere' ? 'on' : ''}`}
          data-pick="duree"
          data-v="croisiere"
          onClick={() => pickDuree('croisiere')}
        >
          🌙 Croisière
          <small>plusieurs jours</small>
        </Button>
      </div>
      <PrepNav />
    </>
  );
}
