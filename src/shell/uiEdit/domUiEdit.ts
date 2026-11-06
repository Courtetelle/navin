import { state } from '../../state/index.ts';

import { editClasses } from './applyUiEdit.tsx';
import { rollText } from './roll.ts';
import { identityOf, uiEditKey } from './uiEditKey.ts';
import { uiEditMode } from './uiEditState.ts';

const FIRST_ROLL_MS = 400;

/**
 * Apply the stored label edits to the buttons of a part of the page that React
 * does not draw (legacy `uiApply`, ui-edit.js:41-62): Leaflet popups. Each
 * button is handled once.
 * @param root - Element holding the buttons.
 */
export function applyUiEditsIn(root: Element): void {
  for (const button of root.querySelectorAll<HTMLElement>('.btn, .tab')) {
    if (button.dataset.ueDone === '1') continue;
    button.dataset.ueDone = '1';
    applyToButton(button);
  }
}

function applyToButton(button: HTMLElement): void {
  const { scope, identity } = identityOf(button);
  const key = uiEditKey(scope, state.view.currentView.peek(), identity);
  const small = button.querySelector<HTMLElement>(':scope > small');
  button.dataset.ueKey = key;
  button.dataset.ueOrig = identity.text;
  if (small?.textContent) button.dataset.ueOrigSub = small.textContent;
  const edit = state.data.uiEdits.peek()[key];
  if (!edit) return;
  if (edit.label) writeLabel(button, edit.label, Boolean(small));
  if (edit.sub) writeSmall(button, small, edit.sub);
  button.classList.add(...editClasses(edit));
  if (edit.wrap === 'roll') {
    wrapInTrack(button);
    setTimeout(() => {
      rollText(button, uiEditMode.peek());
    }, FIRST_ROLL_MS);
  }
}

function writeLabel(
  button: HTMLElement,
  label: string,
  hasSmall: boolean,
): void {
  const [first, ...others] = labelNodes(button);
  if (!first) return;
  const text = first.textContent ?? '';
  const before = text.startsWith(' ') ? ' ' : '';
  const after = /\s$/.test(text) && hasSmall ? ' ' : '';
  first.textContent = `${before}${label}${after}`;
  for (const other of others) other.textContent = '';
}

function labelNodes(button: HTMLElement): ChildNode[] {
  const direct = [...button.childNodes].filter(
    (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
  );
  if (direct.length > 0) return direct;
  const span = [...button.children].find(
    (child) =>
      child.tagName === 'SPAN' &&
      child.children.length === 0 &&
      child.textContent?.trim(),
  );
  return span?.firstChild ? [span.firstChild] : [];
}

function writeSmall(
  button: HTMLElement,
  small: HTMLElement | null,
  text: string,
): void {
  const target = small ?? document.createElement('small');
  target.textContent = text;
  if (!small) button.append(target);
}

function wrapInTrack(button: HTMLElement): void {
  if (button.querySelector(':scope > .ue-track')) return;
  const track = document.createElement('span');
  track.className = 'ue-track';
  track.append(...button.childNodes);
  button.append(track);
}
