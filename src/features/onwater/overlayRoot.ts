import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { OnwaterOverlays } from './OnwaterOverlays.tsx';

let mounted = false;

/**
 * Mount the overlays legacy appended to `<body>` from anywhere (wind flash,
 * wind bubble, photo viewer). They outlive every screen, so they live in their
 * own React root; its host element stays out of the document and everything
 * it renders is a portal into `<body>`.
 */
export function showOverlays(): void {
  if (mounted) return;
  mounted = true;
  createRoot(document.createElement('div')).render(
    createElement(OnwaterOverlays),
  );
}
