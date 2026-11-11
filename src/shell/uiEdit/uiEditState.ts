import { signal } from '@preact/signals-react';

import { state } from '../../state/index.ts';

import { identityOf, uiEditKey } from './uiEditKey.ts';

/** Button being edited in the editor sheet. */
export interface EditorTarget {
  key: string;
  /** Original main text. */
  orig: string;
  /** Original small text, `undefined` when the button has none. */
  origSub: string | undefined;
}

/** The label edit mode is on (body class `ui-editing`). */
export const uiEditMode = signal(false);
/** In edit mode: a touch opens the editor (`true`) or the buttons work (`false`, body class `ui-edit-nav`). */
export const uiEditPick = signal(true);
/** Button open in the editor, or null. */
export const editorTarget = signal<EditorTarget | null>(null);
/** Turn the label edit mode on (settings › ✎ Activer le mode édition). */
export function startUiEditing(): void {
  uiEditPick.value = true;
  uiEditMode.value = true;
}

const CAUGHT = [
  'click',
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
  'mousedown',
  'mouseup',
];

/**
 * While editing, a touch on a button opens the editor instead of its action
 * (ui-edit.js:159-167).
 * @returns Removes the listeners.
 */
export function installUiEditCatch(): () => void {
  for (const type of CAUGHT) {
    document.addEventListener(type, catchButton, {
      capture: true,
      passive: false,
    });
  }
  return removeUiEditCatch;
}

function removeUiEditCatch(): void {
  for (const type of CAUGHT) {
    document.removeEventListener(type, catchButton, { capture: true });
  }
}

function catchButton(event: Event): void {
  if (!uiEditMode.value || !uiEditPick.value) return;
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>('.btn, .tab');
  if (!button || button.closest('#uiEditor, #uiEditBar')) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  if (event.type === 'click') editorTarget.value = targetOf(button);
}

/**
 * Key and original texts of a rendered button: declared by the shared
 * `Button` (`data-ue-key`, `data-ue-orig`, `data-ue-orig-sub`), else read from
 * the DOM like legacy.
 * @param button - The button element.
 * @returns The editor target.
 */
function targetOf(button: HTMLElement): EditorTarget {
  const declared = button.dataset.ueKey;
  if (declared) {
    return {
      key: declared,
      orig: button.dataset.ueOrig ?? '',
      origSub: button.dataset.ueOrigSub,
    };
  }
  const { scope, identity } = identityOf(button);
  const small = button.querySelector(':scope > small');
  return {
    key: uiEditKey(scope, state.view.currentView.value, identity),
    orig: identity.text,
    origSub: small?.textContent ?? undefined,
  };
}
