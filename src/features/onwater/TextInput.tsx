import type { ComponentPropsWithoutRef } from 'react';
import { useRef } from 'react';

import { useMarquee } from '../../components/shared/useMarquee.ts';

/**
 * A text input whose text scrolls when it is longer than the field.
 * @param props - Input attributes.
 * @returns The input.
 */
export function TextInput(props: ComponentPropsWithoutRef<'input'>) {
  const input = useRef<HTMLInputElement>(null);
  useMarquee(input);
  return <input {...props} ref={input} />;
}
