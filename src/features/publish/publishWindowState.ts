import { signal } from '@preact/signals-react';

import type { ListKind } from './types.ts';

/** The list whose Publier window is open. */
export const openKind = signal<ListKind | null>(null);

/** Close the Publier window. */
export function closeListPublish(): void {
  openKind.value = null;
}
