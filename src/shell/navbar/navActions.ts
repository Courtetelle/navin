import { buzz } from '../../lib/dom.ts';
import { setPrep, state, toast } from '../../state/index.ts';
import { hasBodyClass } from '../bodyClass.ts';
import { litTab } from '../litTab.ts';
import { clearHistory, go, goBackInHistory } from '../router.ts';

import {
  firstInDocument,
  navSteps,
  pageBackTarget,
  validateTargets,
} from './navBarState.ts';

function prepBar() {
  return hasBodyClass('prep-on') ? navSteps.value?.prepBar : undefined;
}

/**
 * `#navBack` (nav.js:87-93): the PréP bar ◀, else the page back button, else
 * the previous screen of the history.
 */
export function navBack(): void {
  const bar = prepBar();
  if (bar) {
    bar.onBack();
    return;
  }
  const back = pageBackTarget();
  if (back?.element()?.isConnected) {
    back.onClick();
    return;
  }
  buzz();
  goBackInHistory();
}

/** `#navNext` (nav.js:80): the PréP bar « Suivant », else the next step. */
export function navNext(): void {
  const next = prepBar()?.onNext;
  if (next) next();
  else navSteps.value?.onBrowseNext();
}

/** `#navExit` (nav.js:81-86): quit PréP, or go to the root of the lit tab. */
export function navExit(): void {
  buzz();
  clearHistory();
  if (state.view.currentView.value === 'prep' || hasBodyClass('prep-on')) {
    setPrep(null);
    go('tracker');
    return;
  }
  const tab = litTab();
  go(tab && ['tracker', 'more', 'sos'].includes(tab) ? tab : 'more');
}

/**
 * `#navOk`, the green ✔ (nav.js:1264-1275): the page « Valider » button, else
 * the PréP step validation, else « sheet validated » and back.
 */
export function navOk(): void {
  buzz();
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) active.blur();
  const validate = firstInDocument(validateTargets.value);
  if (validate?.element()?.isConnected) {
    validate.onClick();
    return;
  }
  const steps = navSteps.value;
  if (steps) {
    const next = prepBar()?.onNext;
    if (steps.onDepart) steps.onDepart();
    else if (next) next();
    else steps.onBrowseNext();
    return;
  }
  toast('✔ Fiche validée · enregistrée');
  setTimeout(navBack, 60);
}

/**
 * A click in the hidden `#navMid` pills (nav.js:76).
 * @param target - Clicked element.
 */
export function navPillClick(target: EventTarget): void {
  if (!(target instanceof Element)) return;
  const pill = target.closest<HTMLElement>('[data-ps]');
  if (pill) navSteps.value?.onPill?.(Number(pill.dataset.ps));
}
