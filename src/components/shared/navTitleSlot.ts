import { signal } from '@preact/signals-react';

/**
 * Where the page title goes when the nav bar holds it (the screens with the
 * buttons around the map): the fixed title line, under the top buttons.
 * Null: the title stays at the top of the page.
 */
export const navTitleSlot = signal<HTMLElement | null>(null);
