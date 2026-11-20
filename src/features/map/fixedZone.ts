import { signal } from '@preact/signals-react';

/**
 * The fixed alert whose zone is drawn on the map (touched in its list), or
 * null: a touch on the zone goes back to the list and takes it off.
 */
export const fixedOnMap = signal<string | null>(null);
