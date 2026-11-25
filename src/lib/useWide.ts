import { useSyncExternalStore } from 'react';

/** A tablet in landscape (iPad, Sailproof SP10X): two panes side by side. */
export const WIDE_QUERY = '(orientation: landscape) and (min-width: 560px)';

function wideList(): MediaQueryList | null {
  return globalThis.matchMedia?.(WIDE_QUERY) ?? null;
}

function subscribe(changed: () => void): () => void {
  const list = wideList();
  list?.addEventListener('change', changed);
  return () => list?.removeEventListener('change', changed);
}

/**
 * Whether the screen is a tablet in landscape, following rotations.
 * @returns `true` on a wide screen.
 */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => wideList()?.matches ?? false,
    () => false,
  );
}

/**
 * The screens laid with the buttons of NavIn around the map: landscape (X,
 * the phone turned), a phone held upright (T) and the tablet held upright
 * (the places of T, the sizes of X).
 */
export const RAILS_QUERY = `${WIDE_QUERY}, (orientation: portrait)`;

function railsList(): MediaQueryList | null {
  return globalThis.matchMedia?.(RAILS_QUERY) ?? null;
}

function subscribeRails(changed: () => void): () => void {
  const list = railsList();
  list?.addEventListener('change', changed);
  return () => list?.removeEventListener('change', changed);
}

/**
 * Whether the screen lays the buttons around the map (X, T), following
 * rotations.
 * @returns `true` on such a screen.
 */
export function useRails(): boolean {
  return useSyncExternalStore(
    subscribeRails,
    () => railsList()?.matches ?? false,
    () => false,
  );
}

/**
 * Whether the screen lays the buttons around the map, now.
 * @returns `true` on such a screen.
 */
export function railsScreen(): boolean {
  return railsList()?.matches ?? false;
}

/**
 * The tablet sideways (X, SP10X), not the phone turned: one column of
 * buttons on the left, tall enough for Routes under START.
 */
export const TABLET_SIDEWAYS_QUERY = `${WIDE_QUERY} and (min-height: 640px)`;

function tabletList(): MediaQueryList | null {
  return globalThis.matchMedia?.(TABLET_SIDEWAYS_QUERY) ?? null;
}

function subscribeTablet(changed: () => void): () => void {
  const list = tabletList();
  list?.addEventListener('change', changed);
  return () => list?.removeEventListener('change', changed);
}

/**
 * Whether the screen is the tablet sideways, following rotations.
 * @returns `true` on such a screen.
 */
export function useTabletSideways(): boolean {
  return useSyncExternalStore(
    subscribeTablet,
    () => tabletList()?.matches ?? false,
    () => false,
  );
}
