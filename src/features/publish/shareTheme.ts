import { state, updateSettings } from '../../state/index.ts';

import { LX_THEMES } from './themes.ts';
import type { LxTheme } from './types.ts';

const known = (value: unknown): value is LxTheme =>
  LX_THEMES.some(([id]) => id === value);

/**
 * The layout of every share, chosen once in Réglages. Before that choice,
 * the one last picked for the PréP report is kept.
 * @returns The layout.
 */
export function shareTheme(): LxTheme {
  const { shareTheme: chosen, repTheme } = state.preferences.settings.value;
  if (known(chosen)) return chosen;
  return known(repTheme) ? repTheme : 'cards';
}

/**
 * Choose the layout of every share.
 * @param theme - The layout.
 */
export function setShareTheme(theme: LxTheme): void {
  updateSettings((settings) => {
    settings.shareTheme = theme;
  });
}
