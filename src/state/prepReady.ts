import { signal } from '@preact/signals-react';

import { store } from '../storage/store.ts';

/**
 * A PréP closed and waiting for START: `ok` every check-in item green, `part`
 * closed before the end; null with no PréP waiting.
 */
export type PrepReady = 'ok' | 'part' | null;

const KEY = 'ldb.prepReady';

/** The PréP closed and waiting for START (green or orange PréP button). */
export const prepReady = signal<PrepReady>(store.get<PrepReady>(KEY, null));

/**
 * Note a PréP closed, or START pressed.
 * @param value - How complete it was, or null once the track started.
 */
export function setPrepReady(value: PrepReady): void {
  prepReady.value = value;
  if (value) store.set(KEY, value);
  else store.del(KEY);
}
