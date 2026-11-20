import { signal } from '@preact/signals-react';

/**
 * The fixed alert whose zone is drawn on the map (touched in its list), or
 * null: a touch on the zone goes back to the list and takes it off.
 */
export const fixedOnMap = signal<string | null>(null);

/**
 * The fixed alert to open in its list (come back from its zone on the map),
 * taken once by the list.
 */
export const fixedOpened = signal<string | null>(null);
