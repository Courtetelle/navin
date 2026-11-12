import { store } from '../../storage/store.ts';

/** Where the last automatic wind alert is kept on the device. */
export const LAST_ALERT_KEY = 'ldb.lastWindAlert';

/**
 * When the last automatic wind alert was given (light: no overlay loaded).
 * @returns Its time, null without alert.
 */
export function lastWindAlertAt(): number | null {
  return store.get<{ at: number } | null>(LAST_ALERT_KEY, null)?.at ?? null;
}
