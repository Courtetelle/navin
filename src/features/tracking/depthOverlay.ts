import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { DepthAlarmOverlay } from './DepthAlarmOverlay.tsx';
import { depthOverlayState } from './depthOverlayState.ts';

let rootCreated = false;

/**
 * Create the overlay at its first use (legacy `depthOverlay`). It outlives every
 * screen, so it has its own React root, whose host stays out of the document:
 * all it renders is a portal into `<body>`.
 */
export function showDepthOverlay(): void {
  if (rootCreated) return;
  rootCreated = true;
  depthOverlayState.value = { ...depthOverlayState.peek(), mounted: true };
  createRoot(document.createElement('div')).render(
    createElement(DepthAlarmOverlay),
  );
}
