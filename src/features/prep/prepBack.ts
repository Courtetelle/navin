import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { setPrep } from '../../state/index.ts';

import { closeCrewDraft } from './prepCrewDraft.ts';
import { prepCreateOrFill } from './prepCruise.ts';
import { prepGo } from './prepFlow.ts';
import { prepFlow, updatePrepFlow } from './prepTypes.ts';

function quit(): void {
  setPrep(null);
  go('tracker');
}

/** « ◀ Retour » of a PréP step (prep.js:673). */
export function prepBack(): void {
  buzz();
  const prep = prepFlow();
  if (!prep) return;
  const { step, sub, type, fill } = prep;
  if (
    (step === 0 && sub === 'purpose' && !fill) ||
    (step === 1 && type === 'mer' && !fill)
  ) {
    quit();
    return;
  }
  if (step === 0 && sub === 'purpose') {
    updatePrepFlow((flow) => {
      flow.sub = null;
    });
    return;
  }
  if (step === 3 && sub === 'crewEdit') {
    closeCrewDraft();
    return;
  }
  if (step === 0) {
    quit();
    return;
  }
  if (step === 2 && sub === 'tarif') {
    updatePrepFlow((flow) => {
      flow.sub = null;
    });
    prepGo(2, true);
    return;
  }
  if (step === 2 && type === 'lac') {
    updatePrepFlow((flow) => {
      flow.sub = 'purpose';
    });
    prepGo(0);
    return;
  }
  prepGo(step === 5 ? 4 : step - 1);
}

/**
 * « Suivant ▶ » of a PréP step (prep.js:698): the fare can be skipped; the sea
 * boat name opens the navigation.
 * @param boatName - Text of the boat name field, on the sea boat step.
 */
export function prepNext(boatName?: string): void {
  buzz();
  const prep = prepFlow();
  if (!prep) return;
  if (prep.step === 2 && prep.sub === 'tarif') {
    updatePrepFlow((flow) => {
      flow.sub = null;
    });
    prepGo(3);
    return;
  }
  if (prep.step === 2) {
    if (prep.type === 'mer') {
      updatePrepFlow((flow) => {
        flow.boatName = (boatName ?? '').trim();
      });
    }
    prepCreateOrFill();
  }
  prepGo(prep.step + 1);
}
