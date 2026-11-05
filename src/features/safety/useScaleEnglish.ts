import { useSignals } from '@preact/signals-react/runtime';

import { state } from '../../state/index.ts';

/**
 * The Beaufort and Douglas scales are shown in English.
 * @returns `true` for English.
 */
export function useScaleEnglish(): boolean {
  useSignals();
  return state.preferences.settings.value.scaleLang === 'en';
}
