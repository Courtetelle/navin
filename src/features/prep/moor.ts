import { signal } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { state, toast } from '../../state/index.ts';
import { trkReset } from '../map/index.ts';
import { stopTracking } from '../tracking/index.ts';

/** Docking points ticked; kept until moored (legacy `dockDone`). */
export const dockDone = signal<Readonly<Record<number, boolean>>>({});

/**
 * Tick or untick a docking point.
 * @param position - Point.
 */
export function toggleDockPoint(position: number): void {
  dockDone.value = { ...dockDone.value, [position]: !dockDone.value[position] };
}

/** Moored: the track ends, then the check-out (legacy `moorNow`). */
export async function moorNow(): Promise<void> {
  buzz();
  dockDone.value = {};
  if (state.view.tracking.value) await stopTracking(true);
  trkReset();
  toast('🔒 Amarré : trace terminée');
  go('checklist', 'quit');
}
