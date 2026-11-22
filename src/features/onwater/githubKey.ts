import { GITHUB_KEY_SETTING } from '../../model/analysis.ts';
import { state, updateSettings } from '../../state/index.ts';

/** Where the key was kept before it joined the weather keys (21/11/2026). */
const OLD_KEY = 'navin-gh-token';

/**
 * The GitHub key of the analysis, from the weather keys (so in the full
 * backup and the synchronisation). A key pasted before, in the analysis
 * itself, moves there the first time it is read.
 * @returns The key, or ''.
 */
export function githubKey(): string {
  const kept =
    state.preferences.settings.peek().windAlert?.[GITHUB_KEY_SETTING];
  if (typeof kept === 'string' && kept) return kept;
  let old = '';
  try {
    old = localStorage.getItem(OLD_KEY)?.trim() ?? '';
    if (old) localStorage.removeItem(OLD_KEY);
  } catch {
    return '';
  }
  if (old) {
    updateSettings((settings) => {
      settings.windAlert = { ...settings.windAlert, [GITHUB_KEY_SETTING]: old };
    });
  }
  return old;
}
