import { signal } from '@preact/signals-react';

/**
 * Asks the SOS screen to redraw itself (legacy `VIEWS.sos()` called from the
 * simulation, outside the page).
 */
export const sosRefresh = signal(0);

/**
 * Redraw the SOS screen.
 */
export function refreshSosPage(): void {
  sosRefresh.value += 1;
}

/** Ended log whose delete form is open (legacy `sosDelId`, kept between visits). */
export const sosDeleteId = signal<string | null>(null);
