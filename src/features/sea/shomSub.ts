import { state } from '../../state/index.ts';

/** Setting of the key of the SHOM subscription (with the weather keys). */
export const SHOM_KEY_SETTING = 'shomKey';
/** Setting of its last day, `AAAA-MM-JJ`. */
export const SHOM_UNTIL_SETTING = 'shomUntil';

/** The shop of the SHOM: subscriptions and data. */
export const SHOM_SHOP_URL = 'https://diffusion.shom.fr/';
/** The SHOM data services: the keys of the tides and currents. */
export const SHOM_SERVICES_URL =
  'https://services.data.shom.fr/support/fr/services';

/** The SHOM subscription kept, or why none. */
export type ShomState =
  | { kind: 'none' }
  | { kind: 'active'; key: string; until: string }
  | { kind: 'ended'; until: string }
  | { kind: 'no-date'; key: string };

/**
 * The SHOM subscription on a day: active up to its last day included,
 * Copernicus otherwise.
 * @param key - The key typed.
 * @param until - Its last day, `AAAA-MM-JJ`.
 * @param now - The time, epoch ms.
 * @returns Its state.
 */
export function shomStateOf(
  key: string,
  until: string,
  now = Date.now(),
): ShomState {
  if (!key) return { kind: 'none' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return { kind: 'no-date', key };
  // The last day counts in full, in local time.
  const end = new Date(`${until}T23:59:59`).getTime();
  return now <= end ? { kind: 'active', key, until } : { kind: 'ended', until };
}

/**
 * The SHOM subscription of the settings.
 * @returns Its state.
 */
export function shomState(): ShomState {
  const keys = state.preferences.settings.value.windAlert ?? {};
  const key = keys[SHOM_KEY_SETTING];
  const until = keys[SHOM_UNTIL_SETTING];
  return shomStateOf(
    typeof key === 'string' ? key.trim() : '',
    typeof until === 'string' ? until : '',
  );
}
