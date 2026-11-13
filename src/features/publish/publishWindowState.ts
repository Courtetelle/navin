import { signal } from '@preact/signals-react';

import type { ListKind } from './types.ts';

/** The list whose Partager window is open. */
export const openKind = signal<ListKind | null>(null);

/** Close the Partager window. */
export function closeListPublish(): void {
  openKind.value = null;
}
