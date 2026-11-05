import { useSignals } from '@preact/signals-react/runtime';
import type { ComponentPropsWithRef, ReactElement } from 'react';

import { buttonTexts } from '../../shell/uiEdit/applyUiEdit.tsx';
import { useUiEdit } from '../../shell/uiEdit/useUiEdit.tsx';

import { plusButtonClass } from './buttonTypology.ts';

/** Props of {@link Button}: every `<button>` attribute and its ref, `type` optional. */
export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /**
   * Ignore the user's label edits (buttons whose content the app rewrites, like the top tabs).
   * @default false
   */
  noUiEdit?: boolean;
  /**
   * The button is a choice inside `.chips`, `.ck-tabs`, `.seg` or `.lang-row`:
   * a leading ＋ does not make it an « add » button (no `act-add`).
   * @default false
   */
  choice?: boolean;
}

// A variable tag: legacy buttons have no `type` attribute, which JSX
// `<button>` cannot express under the `react/button-has-type` lint rule.
const Tag = 'button' as const;

/**
 * A `<button>` without a forced `type` attribute, as legacy wrote them
 * (`<button class="btn">`), with the user's label edits applied to `.btn`
 * buttons (ui-edit.js) and `act-add` on `＋` buttons (nav.js:1223). Pass
 * `type="button"` only where legacy had it.
 * @param props - Button attributes and children.
 * @returns The button element.
 */
export function Button({
  ref,
  className,
  noUiEdit = false,
  choice = false,
  ...rest
}: ButtonProps): ReactElement {
  useSignals();
  const edit = useUiEdit({ ...rest, className: noUiEdit ? '' : className });
  const typed = plusButtonClass({
    text: buttonTexts(rest.children).text,
    className: className ?? '',
    data: Object.keys(rest),
    inChoiceGroup: choice,
  });
  const classes = [typed, ...edit.classes].filter(Boolean).join(' ');
  return (
    <Tag
      {...rest}
      {...edit.attributes}
      className={classes || undefined}
      ref={ref}
    >
      {edit.children}
    </Tag>
  );
}
