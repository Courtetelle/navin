import { useLayoutEffect } from 'react';

import type { NavStepsConfig } from './navBarState.ts';
import { fieldOwners, navSteps, prepLineContent } from './navBarState.ts';

/**
 * Declare that the page shows form fields (text inputs, textareas): the nav
 * bar then shows the green ✔ that validates the sheet (nav.js:1255-1257).
 * Legacy counts every `input` (except hidden, file, search, checkbox, radio)
 * and `textarea` of `#view` that is not disabled, even inside a folded
 * section, but not inside a closed boat of `#boatList`.
 * @param hasFields - The page currently renders such fields.
 */
export function useNavFields(hasFields = true): void {
  useLayoutEffect(() => {
    if (!hasFields) return undefined;
    fieldOwners.value += 1;
    return () => {
      fieldOwners.value -= 1;
    };
  }, [hasFields]);
}

/**
 * Show the PréP steps in the nav bar (has-steps mode): ◀ ▶ ✔ ✖, the hidden
 * pills copy and the `#prepLine` of step titles. Pass `null` when the page
 * shows no `.prep-steps`.
 * @param config - Steps configuration, or null.
 */
export function useNavSteps(config: NavStepsConfig | null): void {
  useLayoutEffect(() => {
    if (!config) return undefined;
    navSteps.value = config;
    prepLineContent.value = config.line;
    return () => {
      if (navSteps.value === config) navSteps.value = null;
    };
  }, [config]);
}
