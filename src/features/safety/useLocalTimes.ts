import { useLayoutEffect } from 'react';

import { state } from '../../state/index.ts';

/**
 * Show the times of the screen in local time only (lake procedures, legacy
 * `tzLocalOnly`). The router resets it at every navigation.
 * @param localOnly - Local time only.
 */
export function useLocalTimes(localOnly: boolean): void {
  useLayoutEffect(() => {
    state.view.tzLocalOnly.value = localOnly;
  }, [localOnly]);
}
