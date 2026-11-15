import { signal } from '@preact/signals-react';

import type { LiveStation } from '../../features/onwater/index.ts';

/**
 * The station whose whole card LiveMétéo opens (a long press on its badge
 * on the NavIn map): its ◀ comes back to the map. Taken by the page once.
 */
export const liveDetail = signal<LiveStation | null>(null);
