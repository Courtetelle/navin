/**
 * Behaviour owned by a domain but triggered by a state action. Each domain
 * registers its function at module load (e.g. the tracking domain sets
 * `hooks.stopTracking`); an unregistered hook is skipped, like the legacy
 * `typeof fn === 'function'` guards.
 */
export const hooks: {
  /** Stop the GPS track (legacy `stopTracking(withArrival)`), called by `removeCruise`. */
  stopTracking: ((withArrival: boolean) => unknown) | null;
  /**
   * A whole navigation is about to be deleted: its stored keys go to the
   * Poubelle (`features/trash`), called by `removeCruise`.
   */
  cruiseGone: ((id: string, keys: Record<string, unknown>) => unknown) | null;
} = {
  stopTracking: null,
  cruiseGone: null,
};
