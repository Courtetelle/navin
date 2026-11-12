import { buzz } from '../../lib/dom.ts';
import { hasBodyClass } from '../../shell/bodyClass.ts';
import { go } from '../../shell/router.ts';
import {
  crewSetName,
  navZone,
  noteUse,
  setPrep,
  state,
  toast,
} from '../../state/index.ts';

import { prepClose } from './prepClose.ts';
import { crewSetFromCruise } from './prepCrew.ts';
import { LAST_PREP_STEP } from './prepLine.ts';
import { prepPathDrop, prepPathSave } from './prepPaths.ts';
import type { PrepFlow } from './prepTypes.ts';
import { prepFlow, updatePrepFlow } from './prepTypes.ts';

/** Where the PréP was opened from: a second touch on PréP goes back there. */
let openedFrom: { view: string; arg: unknown } | null = null;

/**
 * Whether the sailor chose something in the PréP: then leaving it keeps it
 * (PréP blinks orange), else it is dropped.
 * @param prep - PréP flow.
 * @returns A choice was made.
 */
export function prepHasPicks(prep: PrepFlow | null): boolean {
  if (!prep) return false;
  return Boolean(
    prep.purpose ||
    prep.boatId ||
    prep.boatName ||
    prep.duree ||
    prep.crewSet ||
    prep.tarif ||
    prep.crewDraft?.crew.length,
  );
}

/**
 * The PréP button. Shown, the PréP is left: back where it was opened from,
 * kept when something was chosen (the button blinks orange), dropped
 * otherwise. Kept and not shown, it comes back where it was. Otherwise a
 * new PréP starts from nothing: the zone sailed in, then its first choice.
 */
export function prepStart(): void {
  buzz();
  const current = prepFlow();
  const view = state.view.currentView.value;
  if (current && (view === 'prep' || hasBodyClass('prep-on'))) {
    if (!prepHasPicks(current)) setPrep(null);
    const back = openedFrom ?? { view: 'tracker', arg: null };
    openedFrom = null;
    go(back.view, back.arg);
    return;
  }
  openedFrom = { view, arg: state.view.viewArg.value };
  if (current) {
    prepGo(current.step ?? 0, true);
    return;
  }
  const lake = navZone() === 'lac';
  const prep: PrepFlow = {
    step: lake ? 0 : 1,
    reach: lake ? 0 : 1,
    type: lake ? 'lac' : 'mer',
    sub: lake ? 'purpose' : null,
    duree: null,
    boatId: null,
    boatName: '',
    purpose: null,
    fresh: true,
  };
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
    prep.step = Math.max(0, Math.min(LAST_PREP_STEP, step));
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
  if (next > LAST_PREP_STEP) return;
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
  if (prep.step >= LAST_PREP_STEP) {
    prepClose();
    return;
  }
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
