import type { ComponentPropsWithRef } from 'react';
import { useRef } from 'react';

import { useMarquee } from '../../../components/shared/useMarquee.ts';

/**
 * An `<input>` whose text scrolls when longer than the field.
 * @param props - Input attributes.
 * @returns The input.
 */
export function MarqueeInput(props: ComponentPropsWithRef<'input'>) {
  const input = useRef<HTMLInputElement>(null);
  useMarquee(input);
  return <input {...props} ref={input} />;
}
