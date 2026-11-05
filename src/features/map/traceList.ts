import { signal } from '@preact/signals-react';

/** Increases when the list of « Mes traces » must be read again. */
export const traceListVersion = signal(0);

/** Refresh the list of « Mes traces » (legacy `drawTrkList`). */
export function drawTrkList(): void {
  traceListVersion.value += 1;
}
