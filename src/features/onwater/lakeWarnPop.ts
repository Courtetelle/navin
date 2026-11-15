import { signal } from '@preact/signals-react';

import type { LakeWarning } from './lakeWarnings.ts';

/** The big bubble of the warning lights, until touched. */
export interface LakeWarnPop {
  warnings: LakeWarning[];
  /** A test: said so. */
  test?: boolean;
}

/** The bubble of the warning lights. */
export const lakeWarnPop = signal<LakeWarnPop | null>(null);
