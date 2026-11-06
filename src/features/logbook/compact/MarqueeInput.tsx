import type { ComponentPropsWithRef } from 'react';
import { useImperativeHandle, useRef } from 'react';

import { useMarquee } from '../../../components/shared/useMarquee.ts';

/**
 * A text input whose long text scrolls once, then at every touch.
 * @param props - Input attributes and its ref.
 * @returns The input.
 */
export function MarqueeInput({ ref, ...rest }: ComponentPropsWithRef<'input'>) {
  const input = useRef<HTMLInputElement>(null);
  useMarquee(input);
  useImperativeHandle(ref, () => input.current as HTMLInputElement);
  return <input {...rest} ref={input} />;
}
