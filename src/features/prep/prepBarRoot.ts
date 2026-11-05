import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

import { PrepBarHost } from './PrepBarHost.tsx';

let mounted = false;

/**
 * Mount the PréP bar legacy appended to `<body>`: it follows the flow across
 * the crew and check-in screens, so it lives in its own React root, whose host
 * stays out of the document (the bar is a portal into `<body>`).
 */
export function mountPrepBar(): void {
  if (mounted) return;
  mounted = true;
  createRoot(document.createElement('div')).render(createElement(PrepBarHost));
}
