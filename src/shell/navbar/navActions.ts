import { buzz } from '../../lib/dom.ts';
import { setPrep, state, toast } from '../../state/index.ts';
import { hasBodyClass } from '../bodyClass.ts';
import { litTab } from '../litTab.ts';
import { clearHistory, go, goBackInHistory } from '../router.ts';

import {
  firstInDocument,
  navEdit,
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

/** Names of the roots the exit button leads to. */
const ROOT_NAMES: Readonly<Record<string, string>> = {
  tracker: 'NavIn',
  more: 'data',
  sos: 'SOS',
};

function inPrep(): boolean {
  return state.view.currentView.value === 'prep' || hasBodyClass('prep-on');
}

/**
 * Where the exit button leads: NavIn from PréP, else the root of the lit tab.
 * @returns The root view.
 */
export function navExitView(): string {
  if (inPrep()) return 'tracker';
  const tab = litTab();
  return tab && tab in ROOT_NAMES ? tab : 'more';
}

/**
 * The exit button says where it leads (« NavIn », « data », « SOS »).
 * @returns Its label.
 */
export function navExitLabel(): string {
  return ROOT_NAMES[navExitView()] ?? 'data';
}

/** `#navExit` (nav.js:81-86): quit PréP, or go to the root of the lit tab. */
export function navExit(): void {
  buzz();
  clearHistory();
  const target = navExitView();
  if (inPrep()) setPrep(null);
  go(target);
}

/**
 * `#navOk`, the green ✔ (nav.js:1264-1275): the page « Valider » button, else
 * the PréP step validation, else « sheet validated » and back.
 */
export function navOk(): void {
  buzz();
  const edit = navEdit.peek();
  if (edit) {
    edit();
    return;
  }
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
    if (next) next();
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
