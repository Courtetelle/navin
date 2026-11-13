import { signal } from '@preact/signals-react';

import type { ShareFormat } from '../../components/shared/shareFormat.ts';

import type { ListKind } from './types.ts';

/** The list whose Partager window is open. */
export const openKind = signal<ListKind | null>(null);

/** The format chosen with « Partager » for the open window. */
export const openFormat = signal<ShareFormat>('image');

/** Close the Partager window. */
export function closeListPublish(): void {
  openKind.value = null;
}
