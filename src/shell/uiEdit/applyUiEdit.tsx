import type { ReactElement, ReactNode } from 'react';
import { Children, cloneElement, isValidElement } from 'react';

import type { UiEdit } from '../../model/logTypes.ts';

import { normalizeLabel } from './uiEditKey.ts';

/** Main text and small text of a button's children (ui-edit.js:17-23). */
export interface ButtonTexts {
  /** Direct text, whitespace collapsed. */
  text: string;
  /** Text of the direct `<small>`, `undefined` without one. */
  sub: string | undefined;
}

/**
 * Read the texts legacy used as the button's original label.
 * @param children - Button children.
 * @returns Main text and small text.
 */
export function buttonTexts(children: ReactNode): ButtonTexts {
  const parts: string[] = [];
  let sub: string | undefined;
  for (const child of Children.toArray(children)) {
    if (typeof child === 'string' || typeof child === 'number') {
      if (String(child).trim()) parts.push(String(child));
    } else if (
      isValidElement<{ children?: ReactNode }>(child) &&
      child.type === 'small'
    ) {
      sub = textOf(child.props.children);
    }
  }
  if (parts.length === 0) {
    const span = labelSpan(children);
    if (span) parts.push(textOf(span.props.children));
  }
  return { text: normalizeLabel(parts.join(' ')), sub };
}

/**
 * Children of a button with its edit applied (legacy `uiApply`,
 * ui-edit.js:41-62): the new label replaces the direct text (a leading space
 * and the space before `<small>` are kept), the new small text replaces or
 * adds the `<small>`.
 * @param children - Original children.
 * @param edit - The stored edit.
 * @returns Edited children.
 */
export function editedChildren(children: ReactNode, edit: UiEdit): ReactNode[] {
  const list = Children.toArray(children);
  const hasSmall = list.some(
    (child) => isValidElement(child) && child.type === 'small',
  );
  let labelled = false;
  let smallDone = false;
  const output: ReactNode[] = [];
  for (const child of list) {
    if (
      (typeof child === 'string' || typeof child === 'number') &&
      String(child).trim()
    ) {
      const text = String(child);
      if (!edit.label) {
        output.push(text);
      } else if (!labelled) {
        labelled = true;
        const before = text.startsWith(' ') ? ' ' : '';
        const after = /\s$/.test(text) && hasSmall ? ' ' : '';
        output.push(`${before}${edit.label}${after}`);
      }
      continue;
    }
    if (
      edit.sub &&
      isValidElement<{ children?: ReactNode }>(child) &&
      child.type === 'small' &&
      !smallDone
    ) {
      smallDone = true;
      output.push(cloneElement(child, {}, edit.sub));
      continue;
    }
    output.push(child);
  }
  if (edit.sub && !smallDone) {
    output.push(<small key="ue-sub">{edit.sub}</small>);
  }
  const span = labelled ? undefined : labelSpan(children);
  if (!edit.label || !span) return output;
  return output.map((child) =>
    isValidElement(child) && child.key === span.key
      ? cloneElement(span, {}, edit.label)
      : child,
  );
}

/**
 * Classes an edit adds (`ue-s`, `ue-l`, `ue-xl`, `ue-clip`, `ue-roll`).
 * @param edit - The stored edit.
 * @returns Class names.
 */
export function editClasses(edit: UiEdit | undefined): string[] {
  if (!edit) return [];
  const { size: textSize, wrap } = edit;
  const classes: string[] = [];
  if (textSize && textSize !== 'm') classes.push(`ue-${textSize}`);
  if (wrap === 'clip' || wrap === 'roll') classes.push(`ue-${wrap}`);
  return classes;
}

type SpanElement = ReactElement<{ children?: ReactNode }, 'span'>;

// Without direct text, the label of a button is its first `<span>` holding only
// text (tab labels, the emoji of a call link).
function labelSpan(children: ReactNode): SpanElement | undefined {
  const list = Children.toArray(children);
  if (list.some((child) => typeof child === 'string' && child.trim())) {
    return undefined;
  }
  return list.find(
    (child): child is SpanElement =>
      isValidElement<{ children?: ReactNode }>(child) &&
      child.type === 'span' &&
      Boolean(textOf(child.props.children).trim()) &&
      Children.toArray(child.props.children).every(
        (node) => !isValidElement(node),
      ),
  );
}

function textOf(node: ReactNode): string {
  let text = '';
  for (const child of Children.toArray(node)) {
    if (typeof child === 'string' || typeof child === 'number') {
      text += String(child);
    }
  }
  return text;
}
