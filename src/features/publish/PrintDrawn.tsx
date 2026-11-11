import type { ReactNode } from 'react';
import { useLayoutEffect } from 'react';

/** Props of {@link PrintDrawn}. */
interface PrintDrawnProps {
  /** Called once the content is in the page. */
  onDrawn: () => void;
  /** The document. */
  children: ReactNode;
}

/**
 * A printed document, which says when it is in the page.
 * @param props - Content and callback.
 * @returns The content.
 */
export function PrintDrawn({ onDrawn, children }: PrintDrawnProps) {
  useLayoutEffect(onDrawn, [onDrawn]);
  return children;
}
