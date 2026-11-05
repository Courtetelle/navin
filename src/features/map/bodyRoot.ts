import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

/** An element appended to `<body>` with its own React root. */
export interface BodyRoot {
  /** Remove the element. */
  remove: () => void;
}

/**
 * Render an element directly under `<body>`, outside the screen shown: legacy
 * appended these (Go to bar, Naviguer window), and they outlive the page.
 * @param element - The element, not yet in the document.
 * @param content - Its content.
 * @returns The handle.
 */
export function mountInBody(
  element: HTMLElement,
  content: ReactNode,
): BodyRoot {
  document.body.append(element);
  const root = createRoot(element);
  root.render(content);
  return {
    remove() {
      root.unmount();
      element.remove();
    },
  };
}
