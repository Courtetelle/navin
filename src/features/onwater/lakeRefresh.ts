import { signal } from '@preact/signals-react';

/** Increases each time the « En navigation » box is rebuilt. */
export const lakeRefresh = signal(0);

/**
 * Rebuild the « En navigation » box from scratch, dropping the temporary state
 * of its buttons (legacy `renderLakeButtons` from outside the box).
 */
export function refreshLakeButtons(): void {
  lakeRefresh.value += 1;
}
