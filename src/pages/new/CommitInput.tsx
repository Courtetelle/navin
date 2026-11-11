import type { ComponentPropsWithRef } from 'react';
import { useEffect, useRef } from 'react';

import { useMarquee } from '../../components/shared/useMarquee.ts';

/** Props of {@link CommitInput}. */
interface CommitInputProps extends ComponentPropsWithRef<'input'> {
  /** Native `change` event: the value was validated or the field left. */
  onCommit: (value: string) => void;
}

/**
 * An uncontrolled input reporting the native `change` event, which React does
 * not expose (its `onChange` is the `input` event). Give it a `key` that follows
 * the value: legacy redrew the input after each commit.
 * @param props - Input attributes and the commit handler.
 * @returns The input.
 */
export function CommitInput({ onCommit, ...rest }: CommitInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  useMarquee(input);
  useEffect(() => {
    const element = input.current;
    if (!element) return undefined;
    const listener = () => commit.current(element.value);
    element.addEventListener('change', listener);
    return () => element.removeEventListener('change', listener);
  }, []);
  return <input {...rest} ref={input} />;
}
