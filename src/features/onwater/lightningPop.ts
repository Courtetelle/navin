import { signal } from '@preact/signals-react';

import type { LightningReport } from './lightning.ts';

/** What the big bubble of the lightning alert shows. */
export interface LightningPop {
  report: LightningReport;
  /** The radius of the alert, in NM. */
  radiusNm: number;
  /** Where NavIn looked: the map is shown around it. */
  place: { lat: number; lon: number };
  /** A test: said so on the bubble. */
  test?: boolean;
}

/** The bubble of the lightning alert, shown until touched. */
export const lightningPop = signal<LightningPop | null>(null);
