import { useEffect, useRef, useState } from 'react';

import { loadLeaflet } from '../../features/map/leaflet.ts';
import { disposeMap } from '../../features/map/mapExtras.ts';
import { setShownMap } from '../../features/map/mapFull.ts';
import { stopMapWatch } from '../../features/map/mapWatch.ts';
import {
  drawTrkButtons,
  trackerOverlay,
} from '../../features/map/trackerButtons.ts';
import { updateTrkDash } from '../../features/map/trackerDash.ts';
import {
  newTracker,
  tracker,
  trackerTick,
} from '../../features/map/trackerState.ts';
import { useBodyClass } from '../../shell/bodyClass.ts';
import { state } from '../../state/index.ts';

import { LiveOnMap } from './LiveOnMap.tsx';
import { PhoneTrackButton } from './PhoneTrackButton.tsx';
import { TrackerDash } from './TrackerDash.tsx';
import { TrackerOverlay } from './TrackerOverlay.tsx';
import { buildTrackerMap } from './buildTrackerMap.ts';

/**
 * Screen `tracker`, the first screen of the app (legacy `VIEWS.tracker`):
 * full-screen map with the live track, dashboard and overlay.
 * @returns The screen content, rendered inside `<main id="view">`.
 */
export function TrackerPage() {
  useBodyClass('trk-mode');
  const box = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    stopMapWatch();
    const handle = newTracker();
    tracker.current = handle;
    // A question asked right after `go` may come before the page is mounted.
    if (trackerOverlay.value.kind !== 'choose') drawTrkButtons();
    updateTrkDash();
    let closed = false;
    loadLeaflet()
      .then(() => {
        if (!closed && box.current) buildTrackerMap(box.current, handle);
      })
      .catch(() => {
        if (!closed) setUnavailable(true);
      });
    // Every GPS point gives a new trip: the screen follows the recording.
    const stopTrip = state.view.trip.subscribe(() => trackerTick());
    const stopTracking = state.view.tracking.subscribe(() => trackerTick());
    const stopDenied = state.view.gpsDenied.subscribe((denied) => {
      if (denied) drawTrkButtons();
    });
    return () => {
      closed = true;
      stopTrip();
      stopTracking();
      stopDenied();
      if (handle.map) disposeMap(handle.map);
      setShownMap(null);
      if (tracker.current === handle) tracker.current = null;
    };
  }, []);
  return (
    <div className="trk-full">
      <div id="trkMap" className="map trk-map" ref={box}>
        {unavailable ? (
          <div className="empty-state">Carte indisponible.</div>
        ) : null}
      </div>
      <TrackerDash />
      <PhoneTrackButton />
      <TrackerOverlay />
      <LiveOnMap />
    </div>
  );
}
