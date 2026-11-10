import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';

import { PrepPills } from '../../features/prep/PrepPills.tsx';
import { mountPrepBar } from '../../features/prep/prepBarRoot.ts';
import type { PrepFlow } from '../../features/prep/prepTypes.ts';
import { prepFlow } from '../../features/prep/prepTypes.ts';
import { usePrepSteps } from '../../features/prep/usePrepSteps.ts';
import { PREP_STEPS } from '../../model/modes.ts';
import { state } from '../../state/index.ts';

import { PrepBoatStep } from './PrepBoatStep.tsx';
import { PrepCrewEditStep } from './PrepCrewEditStep.tsx';
import { PrepCrewStep } from './PrepCrewStep.tsx';
import { PrepDepartStep } from './PrepDepartStep.tsx';
import { PrepDureeStep, PrepPurposeStep } from './PrepFirstSteps.tsx';
import { PrepNav } from './PrepNav.tsx';
import { PrepTarifStep } from './PrepTarifStep.tsx';

const NO_FLOW: PrepFlow = { step: 0 };

/**
 * Screen `prep`: the step by step preparation of a navigation (legacy
 * `VIEWS.prep`, prep.js:569).
 * @returns The step shown, under its pills and title.
 */
export function PrepPage() {
  useSignals();
  const prep = prepFlow() ?? NO_FLOW;
  const departure = prep.step === 5 && state.data.cruise.value !== null;
  const pills = usePrepSteps(prep, { depart: departure });
  useEffect(mountPrepBar, []);
  return (
    <>
      <div className="prep-steps steps-up">
        <PrepPills pills={pills} />
      </div>
      <div className="prep-title">
        <h1>{title(prep)}</h1>
      </div>
      <PrepStep prep={prep} />
    </>
  );
}

function title({ step, sub }: PrepFlow): string | undefined {
  if (step === 0) return 'Sortie de type';
  if (step === 2 && sub === 'tarif') return 'Tarif';
  if (step === 3 && sub === 'crewEdit') return 'Nouvel équipage';
  return PREP_STEPS[step];
}

function PrepStep({ prep }: { prep: PrepFlow }) {
  useSignals();
  const { step, sub, crewDraft } = prep;
  // Always the three choices first, never « Lac ou Mer ».
  if (step === 0) return <PrepPurposeStep prep={prep} />;
  if (step === 1) return <PrepDureeStep prep={prep} />;
  if (step === 2) {
    return sub === 'tarif' ? (
      <PrepTarifStep prep={prep} />
    ) : (
      <PrepBoatStep prep={prep} />
    );
  }
  if (step === 3) {
    return sub === 'crewEdit' && crewDraft ? (
      <PrepCrewEditStep prep={prep} draft={crewDraft} />
    ) : (
      <PrepCrewStep prep={prep} />
    );
  }
  if (step === 5 || (step === 4 && !state.data.cruise.value)) {
    return <PrepDepartStep />;
  }
  return step === 4 ? null : <PrepNav />;
}
