import { signal } from '@preact/signals-react';

/**
 * The screen a « sortir vers Réglages » link was touched on: Réglages then
 * shows « Revenir » at the bottom, back there. Null when Réglages was
 * opened otherwise.
 */
export const exitOrigin = signal<string | null>(null);
