import type { ReactNode } from 'react';
import { useContext } from 'react';

import { state } from '../../state/index.ts';

import { RollTrack } from './RollTrack.tsx';
import { buttonTexts, editClasses, editedChildren } from './applyUiEdit.tsx';
import { UiEditScopeContext } from './scope.ts';
import { uiEditKey } from './uiEditKey.ts';

/** What a button renders once its label edit is applied. */
export interface UiEditResult {
  /** Classes to add (`ue-*`). */
  classes: string[];
  /** Children to render. */
  children: ReactNode;
  /** `data-ue-*` attributes for the editor. */
  attributes: Record<string, string | undefined>;
}

/**
 * Apply the stored label edit of a `.btn` (legacy ui-edit.js observer): key
 * from the screen, the id or the `data-*` attributes or the text; new label,
 * small text, size and long-text mode. The caller must call `useSignals()`.
 * @param props - Button props (id, className, data attributes, children).
 * @returns Classes, children and editor attributes.
 */
export function useUiEdit(
  props: Record<string, unknown> & { children?: ReactNode },
): UiEditResult {
  const scope = useContext(UiEditScopeContext);
  const className = typeof props.className === 'string' ? props.className : '';
  const editable = /(?:^|\s)(?:btn|tab)(?:\s|$)/.test(className);
  if (!editable) {
    return { classes: [], children: props.children, attributes: {} };
  }
  const texts = buttonTexts(props.children);
  const data: Array<[string, string]> = [];
  for (const [name, value] of Object.entries(props)) {
    if (!name.startsWith('data-')) continue;
    if (typeof value === 'string' || typeof value === 'number') {
      data.push([name, String(value)]);
    }
  }
  const key = uiEditKey(scope, state.view.currentView.value, {
    id: typeof props.id === 'string' ? props.id : undefined,
    data,
    text: texts.text,
  });
  const edit = state.data.uiEdits.value[key];
  const roll = edit?.wrap === 'roll';
  let children: ReactNode = edit
    ? editedChildren(props.children, edit)
    : props.children;
  if (roll) children = <RollTrack>{children}</RollTrack>;
  return {
    classes: editClasses(edit),
    children,
    attributes: {
      'data-ue-key': key,
      'data-ue-orig': texts.text,
      'data-ue-orig-sub': texts.sub,
    },
  };
}
