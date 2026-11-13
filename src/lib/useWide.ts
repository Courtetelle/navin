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
