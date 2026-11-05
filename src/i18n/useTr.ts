import { useSignals } from '@preact/signals-react/runtime';
import { useLayoutEffect } from 'react';

import { screenLanguage, sheetOwners } from './langState.ts';
import { translateOrKeep, translatePlaceholder } from './translate.ts';

/** Translation function a component calls on its French texts. */
export interface Tr {
  /**
   * Translate one text node of `#view` or `#navtop`.
   * @param text - French text, exactly as legacy rendered it (whitespace kept).
   * @param options - `help: true` inside `.help`, `small.rule`, `.exp-note`, `.fiche-lock`.
   * @returns The text in the language shown.
   */
  (text: string, options?: { help?: boolean }): string;
  /**
   * Translate a placeholder.
   * @param placeholder - French placeholder.
   * @returns The placeholder in the language shown.
   */
  placeholder: (placeholder: string) => string;
}

/**
 * The FR ⇄ EN / IT / ES translation of the screen texts (nav.js:945-1000).
 * Returns the identity while French is shown or the screen is not
 * translatable. The component re-renders when the language changes.
 * @returns The translation function.
 */
export function useTr(): Tr {
  useSignals();
  const language = screenLanguage.value;
  return Object.assign(
    (text: string, options?: { help?: boolean }) =>
      translateOrKeep(text, language, options?.help),
    {
      placeholder: (placeholder: string) =>
        translatePlaceholder(placeholder, language),
    },
  );
}

/**
 * Declare that the screen shows a sheet grid (`.cgrid`): the screen becomes
 * translatable and the language button appears (nav.js:984).
 * @param on - The grid is rendered now.
 */
export function useSheetTranslation(on = true): void {
  useLayoutEffect(() => {
    if (!on) return undefined;
    sheetOwners.value += 1;
    return () => {
      sheetOwners.value -= 1;
    };
  }, [on]);
}
