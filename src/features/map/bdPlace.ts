import { signal } from '@preact/signals-react';

/**
 * The point of the cross the Beaufort and Douglas page was opened from, taken
 * once by the page; null when opened otherwise.
 */
export const bdCrossPoint = signal<{ lat: number; lon: number } | null>(null);
