import { signal } from '@preact/signals-react';

/** Where a « sortir vers Paramétrages » link was touched. */
export interface ExitOrigin {
  /** The screen. */
  view: string;
  /** Its argument (a page of a menu), if any. */
  arg?: string;
}

/**
 * The screen a « sortir vers Paramétrages » link was touched on:
 * Paramétrages then shows « Revenir » in its fixed line, back there. Null
 * when Paramétrages was opened otherwise.
 */
export const exitOrigin = signal<ExitOrigin | null>(null);
