import { sunTimes } from '../lib/sun.ts';
import { state, updateSettings } from '../state/index.ts';
import { store } from '../storage/store.ts';

import { sunPlace } from './topbar/clockState.ts';

/** Night starts this long after sunset and ends this long before sunrise. */
const MARGIN_MS = 20 * 60_000;
/** The phase of the last automatic switch, `'day'` or `'night'`. */
const PHASE_KEY = 'ldb.themeAuto';

/**
 * Whether it is night for the theme: from 20 min after sunset to 20 min
 * before sunrise, at the GPS position, else the map shown, else the last position.
 * @param now - Current time (ms).
 * @returns `'night'` or `'day'`, or `null` without sunrise.
 */
export function sunPhase(now = Date.now()): 'day' | 'night' | null {
  const place = sunPlace(now);
  const times = sunTimes(now, place.lat, place.lon);
  if (!times) return null;
  const night = now >= times.set + MARGIN_MS || now < times.rise - MARGIN_MS;
  return night ? 'night' : 'day';
}

/**
 * Switch to night or day when the phase changes. A switch by hand holds until
 * the next change of phase; on a first start, only the night is applied.
 * @param now - Current time (ms).
 */
export function autoNightTick(now = Date.now()): void {
  const phase = sunPhase(now);
  if (!phase) return;
  const last = store.get<string | null>(PHASE_KEY, null);
  if (phase === last) return;
  store.set(PHASE_KEY, phase);
  if (last === null && phase === 'day') return;
  if (state.preferences.settings.peek().theme === phase) return;
  updateSettings((settings) => {
    settings.theme = phase;
  });
}

/** Check the phase now, then every minute. */
export function followAutoNight(): void {
  autoNightTick();
  setInterval(autoNightTick, 60_000);
}
