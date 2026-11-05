import type { Position } from '../../model/types.ts';
import { state } from '../../state/index.ts';

interface TripPoint {
  lat: number;
  lon: number;
  t: number;
}

/**
 * Position of the moment: the running GPS track when recent, else a quick
 * reading; without GPS the time alone is enough (legacy `lakeFix`).
 * @param done - Receives the position, or null.
 */
export function lakeFix(done: (position: Position | null) => void): void {
  const trip = state.view.trip.value;
  const lastPoint =
    trip && state.view.tracking.value
      ? (trip.det.lastPt as TripPoint | null | undefined)
      : null;
  if (lastPoint && Date.now() - lastPoint.t < 120_000) {
    done({ lat: lastPoint.lat, lon: lastPoint.lon });
    return;
  }
  if (!('geolocation' in navigator)) {
    done(null);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (fix) =>
      done({
        lat: fix.coords.latitude,
        lon: fix.coords.longitude,
        acc: fix.coords.accuracy,
      }),
    () => done(null),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
  );
}
