import { useSignals } from '@preact/signals-react/runtime';
import type { ComponentPropsWithRef } from 'react';

import { useUiEdit } from '../../shell/uiEdit/useUiEdit.tsx';

/**
 * An `<a class="btn">`: a link drawn as a button, with the user's label edits
 * applied like on {@link Button}.
 * @param props - Link attributes and children.
 * @returns The link.
 */
export function LinkButton({
  className,
  children,
  ...rest
}: ComponentPropsWithRef<'a'>) {
  useSignals();
  const edit = useUiEdit({ ...rest, className, children });
  return (
    <a
      {...rest}
      {...edit.attributes}
      className={[className, ...edit.classes].join(' ')}
    >
      {edit.children}
    </a>
  );
}

/**
 * A `<label class="btn">` opening a file input, with the user's label edits
 * applied like on {@link Button}.
 * @param props - Label attributes and children.
 * @returns The label.
 */
export function LabelButton({
  className,
  children,
  ...rest
}: ComponentPropsWithRef<'label'>) {
  useSignals();
  const edit = useUiEdit({ ...rest, className, children });
  return (
    <label
      {...rest}
      {...edit.attributes}
      className={[className, ...edit.classes].join(' ')}
    >
      {edit.children}
    </label>
  );
}
