import { buzz } from '../../lib/dom.ts';
import { PREP_STEPS } from '../../model/modes.ts';
import { go } from '../../shell/router.ts';
import {
  crewSetName,
  curMode,
  isLake,
  navZone,
  noteUse,
  setPrep,
  state,
  toast,
} from '../../state/index.ts';

import { crewSetFromCruise } from './prepCrew.ts';
import { prepPathDrop, prepPathSave } from './prepPaths.ts';
import type { PrepFlow } from './prepTypes.ts';
import { prepFlow, updatePrepFlow } from './prepTypes.ts';

/**
 * Open the PréP (legacy `prepStart`): the zone chooses lake or sea; a
 * navigation started by a long press is completed instead of a new one.
 */
export function prepStart(): void {
  buzz();
  const cruise = state.data.cruise.value;
  const fill = cruise?.quick;
  const prep: PrepFlow = fill
    ? {
        step: 0,
        reach: null,
        fill: Boolean(fill),
        type: isLake() ? 'lac' : 'mer',
        duree: curMode() === 'lacc' ? 'croisiere' : 'jour',
        boatId: cruise?.boatId,
        boatName: cruise?.info.boat || '',
        purpose: cruise?.purpose || null,
      }
    : {
        step: 0,
        reach: null,
        type: navZone() === 'lac' ? 'lac' : 'mer',
        duree: null,
        boatId: null,
        boatName: '',
        purpose: null,
      };
  // Never « Lac ou Mer » first: the zone sailed in, and the three choices.
  prep.type ??= navZone() === 'lac' ? 'lac' : 'mer';
  if (!fill) {
    if (prep.type === 'lac') prep.sub = 'purpose';
    else prep.step = 1;
  }
  prep.reach = prep.step;
  setPrep(prep);
  go('prep');
}

/**
 * Open a step (legacy `prepGo`): the crew page when a person is being added,
 * the check-in once a navigation is open, else the PréP page.
 * @param step - Step wanted.
 * @param browse - Consulting only: the step being filled does not move.
 */
export function prepGo(step: number, browse = false): void {
  updatePrepFlow((prep) => {
    prep.step = Math.max(0, Math.min(PREP_STEPS.length - 1, step));
    if (!browse) {
      prep.reach = Math.max(prep.reach ?? 0, prep.step);
    }
    if (prep.step !== 3) prep.newCrew = false;
  });
  setTimeout(prepPathSave, 0);
  const prep = prepFlow();
  if (prep?.step === 3 && prep.newCrew) {
    go('crew');
    return;
  }
  if (prep?.step === 4 && state.data.cruise.value) {
    go('checklist', 'dep');
    return;
  }
  go('prep');
}

/**
 * Consult a step from the step line or the pills (legacy `prepJump`).
 * @param step - Step wanted.
 */
export function prepJump(step: number): void {
  if (!prepFlow()) return;
  buzz();
  updatePrepFlow((prep) => {
    prep.sub = step === 0 ? 'purpose' : null;
    prep.crewDraft = null;
    prep.newCrew = false;
  });
  prepGo(step, true);
}

/**
 * A touch on an item of the step line (prep.js:561).
 * @param target - Step, `paths` for the choice of the path, `2t` for the fare.
 */
export function prepLineJump(target: number | 'paths' | '2t'): void {
  if (!prepFlow()) return;
  if (typeof target === 'number') {
    prepJump(target);
    return;
  }
  buzz();
  updatePrepFlow((prep) => {
    prep.crewDraft = null;
    prep.newCrew = false;
    if (target === 'paths') prep.sub = 'purpose';
    else prep.sub = prep.boatId ? 'tarif' : null;
  });
  prepGo(target === 'paths' ? 0 : 2, true);
}

/** ▶ of the nav bar: the next step, even when this one is not filled (legacy `prepBrowseNext`). */
export function prepBrowseNext(): void {
  const prep = prepFlow();
  if (!prep) return;
  let next = (prep.step || 0) + 1;
  if (prep.type !== 'mer' && next === 1) next = 2;
  if (next > 5) return;
  prepJump(next);
}

/**
 * Long press on ✖ (legacy `prepReset`): only the current path and the choices
 * of the PréP are forgotten, never boats, cards, the crew on board or the check-in.
 */
export function prepReset(): void {
  const current = prepFlow();
  const purpose = current?.purpose;
  const type = current?.type;
  prepPathDrop(purpose);
  const prep: PrepFlow = {
    step: 0,
    type: type ?? (navZone() === 'lac' ? 'lac' : 'mer'),
    sub: 'purpose',
    fresh: true,
  };
  if (prep.type === 'mer') {
    prep.step = 1;
    prep.sub = null;
  }
  setPrep(prep);
  buzz();
  toast(
    purpose
      ? `Chemin « ${purpose} » effacé · les autres chemins, bateaux et fiches sont conservés`
      : 'Sélections de PréP effacées · bateaux et fiches conservés',
    true,
  );
  go('prep');
}

/** « Suivant ▶ » of the PréP bar (prep.js:506): the crew on board is kept as a composition. */
export function prepBarNext(): void {
  const prep = prepFlow();
  if (!prep) return;
  buzz();
  if (prep.step === 3) {
    const set = crewSetFromCruise();
    if (set) {
      noteUse('crew', set.id, prep.purpose ?? undefined);
      toast(`Composition enregistrée : ${crewSetName(set)}`);
    }
    updatePrepFlow((flow) => {
      flow.newCrew = false;
    });
  }
  prepGo(prep.step + 1);
}

/** ◀ of the PréP bar (prep.js:507). */
export function prepBarBack(): void {
  const prep = prepFlow();
  if (!prep) return;
  buzz();
  if (prep.step === 3) {
    updatePrepFlow((flow) => {
      flow.newCrew = false;
    });
    prepGo(3);
    return;
  }
  prepGo(prep.step - 1);
}
