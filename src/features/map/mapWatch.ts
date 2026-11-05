let watchId: number | null = null;

/**
 * Whether the map or the tracker follows the position.
 * @returns `true` while a watch runs.
 */
export function mapWatchActive(): boolean {
  return watchId !== null;
}

/**
 * Keep the id of the watch of the map or of the tracker.
 * @param id - Result of `watchPosition`.
 */
export function setMapWatch(id: number): void {
  watchId = id;
}

/** Stop following the position (legacy `stopMapWatch`). */
export function stopMapWatch(): void {
  if (watchId !== null) navigator.geolocation?.clearWatch(watchId);
  watchId = null;
}
