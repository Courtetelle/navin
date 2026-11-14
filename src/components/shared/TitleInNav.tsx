import { useSignals } from '@preact/signals-react/runtime';
import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';

import { navTitleSlot } from './navTitleSlot.ts';

/**
 * The title of a page that writes its own `h1`: in the fixed title line of
 * the nav bar when it is there (the screens with the buttons around the
 * map), else where it stands.
 * @param props - The title.
 * @param props.children - The `h1`.
 * @returns The title, in its place.
 */
export function TitleInNav({
  children,
}: {
  children: ReactElement;
}): ReactElement {
  useSignals();
  const slot = navTitleSlot.value;
  return slot ? createPortal(children, slot) : children;
}
