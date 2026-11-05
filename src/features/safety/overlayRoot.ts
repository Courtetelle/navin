import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { SafetyOverlay } from './SafetyOverlay.tsx';

/**
 * Mount the exercise ribbon. It outlives every screen, so it lives in its own
 * React root; the host element stays out of the document and the ribbon is a
 * portal into `<body>`.
 */
export function showSafetyOverlay(): void {
  createRoot(document.createElement('div')).render(
    createElement(SafetyOverlay),
  );
}
