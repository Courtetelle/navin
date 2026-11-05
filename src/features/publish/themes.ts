import type { LxTheme } from './types.ts';

/** The three layouts offered for prints and images: id and button label. */
export const LX_THEMES: ReadonlyArray<readonly [LxTheme, string]> = [
  ['cards', '1 · Cartes NavIn'],
  ['carnet', '2 · Carnet marin'],
  ['mini', '3 · Minimaliste'],
];
