import type { ComponentPropsWithoutRef, RefObject } from 'react';
import { useEffect, useRef } from 'react';

import { useMarquee } from '../../components/shared/useMarquee.ts';

/** Props of {@link ChecklistInput}. */
export interface ChecklistInputProps extends ComponentPropsWithoutRef<'input'> {
  /**
   * Native `change` of the field, fired when it loses the focus (the React
   * `onChange` prop follows every keystroke).
   * @default undefined
   */
  onCommit?: (field: HTMLInputElement) => void;
  /**
   * Gives the caller access to the field.
   * @default undefined
   */
  fieldRef?: RefObject<HTMLInputElement | null>;
}

/**
 * A text field of the checklist screens: a text longer than the field scrolls.
 * @param props - Input attributes, commit callback and reference.
 * @returns The input.
 */
export function ChecklistInput({
  onCommit,
  fieldRef,
  ...rest
}: ChecklistInputProps) {
  const ownRef = useRef<HTMLInputElement>(null);
  const reference = fieldRef ?? ownRef;
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  useEffect(() => {
    const field = reference.current;
    if (!field) return undefined;
    const listener = () => commit.current?.(field);
    field.addEventListener('change', listener);
    return () => field.removeEventListener('change', listener);
  }, [reference]);
  useMarquee(reference);
  return <input {...rest} ref={reference} />;
}
