import { signal } from '@preact/signals-react';

import type { LightningReason, LightningReport } from './lightning.ts';

/** What the big bubble of the lightning alert shows. */
export interface LightningPop {
  report: LightningReport;
  /** The radius of the alert, in NM. */
  radiusNm: number;
  /** Where NavIn looked: the map is shown around it. */
  place: { lat: number; lon: number };
  /** A test: said so on the bubble. */
  test?: boolean;
  /** Why it sounds: the second alert says it is under half the distance. */
  reason?: LightningReason;
  /** The end of the alert: no flash for 30 minutes. */
  clear?: boolean;
  /** How the storm moves and when it is on the boat, at the alert. */
  lines?: string[];
  /**
   * The alert in the journal, shared by its 📤.
   * @default undefined
   */
  alertId?: string;
  /**
   * Shown again (back from a screen): the screen does not flash.
   * @default false
   */
  again?: boolean;
}

/** The bubble of the lightning alert, shown until touched. */
export const lightningPop = signal<LightningPop | null>(null);
