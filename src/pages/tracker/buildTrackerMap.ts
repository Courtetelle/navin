import type { MapOptions } from 'leaflet';

import { addLemanVector } from '../../features/map/addLemanVector.ts';
import type { LatLngPair } from '../../features/map/constants.ts';
import {
  LEMAN_CENTER,
  OSM_TILES,
  SEAMARK_TILES,
  SWISS_BOUNDS,
  SWISS_TILES,
  inSwissArea,
} from '../../features/map/constants.ts';
import { nmeaPosFresh } from '../../features/map/external.ts';
import { createMap, leaflet } from '../../features/map/leaflet.ts';
import { addFullscreenControl } from '../../features/map/mapControls.ts';
import { whileMapLive } from '../../features/map/mapExtras.ts';
import { setShownMap } from '../../features/map/mapFull.ts';
import {
  TURNING_MAP_OPTIONS,
  addOrientationControl,
} from '../../features/map/mapOrientation.ts';
import { setMapWatch } from '../../features/map/mapWatch.ts';
import { swissWhenOffline } from '../../features/map/offlineBase.ts';
import { simChartWire, simSeaMode } from '../../features/map/simChart.ts';
import { SIM_MED_CENTER } from '../../features/map/simChartData.ts';
import {
  drawTrace,
  takePendingTrace,
} from '../../features/map/traceActions.ts';
import type { TrackerHandle } from '../../features/map/trackerState.ts';
import {
  currentTrackLine,
  setFollow,
  trkDrawPins,
  trkFix,
} from '../../features/map/trackerState.ts';
import { zoneLayer } from '../../features/map/zoneLayer.ts';
import { zoneAt } from '../../features/map/zoneStore.ts';
import { isLake, state } from '../../state/index.ts';

const KNOTS_PER_METRE_SECOND = 1.943_844;

/**
 * Create the map of the tracker (legacy `VIEWS.tracker`, map.js:534-570).
 * @param box - The `#trkMap` element.
 * @param handle - Tracker handle of the screen.
 */
export function buildTrackerMap(box: HTMLElement, handle: TrackerHandle): void {
  const L = leaflet();
  const map = createMap(box, {
    ...TURNING_MAP_OPTIONS,
    zoomControl: true,
    tap: true,
  } as MapOptions);
  handle.map = map;
  setShownMap(map);
  const tiles = { maxZoom: 19, maxNativeZoom: 18 };
  const swiss = L.tileLayer(SWISS_TILES, {
    ...tiles,
    crossOrigin: true,
    bounds: SWISS_BOUNDS,
    attribution: '© swisstopo',
  });
  const osm = L.tileLayer(OSM_TILES, {
    ...tiles,
    crossOrigin: true,
    attribution: '© OpenStreetMap',
  });
  const seamark = L.tileLayer(SEAMARK_TILES, {
    ...tiles,
    attribution: '© OpenSeaMap',
  });
  const zoneBase = zoneLayer();
  const simulatedSea = simSeaMode();
  const fix = state.view.lastFix.value;
  const cruise = state.data.cruise.value;
  let here: LatLngPair | null = fix ? [fix.lat, fix.lon] : null;
  // On a simulated sea, the real position in Switzerland no longer imposes the lake.
  if (simulatedSea && inSwissArea(fix)) here = null;
  const inSwissWaters = here ? inSwissArea(fix) : !cruise;
  const useSwiss = !simulatedSea && ((cruise && isLake()) || inSwissWaters);
  let base = osm;
  if (useSwiss) base = navigator.onLine ? osm : swiss;
  else if (zoneAt(here)) base = zoneBase;
  base.addTo(map);
  seamark.addTo(map);
  const layers = L.control
    .layers(
      {
        'Carte nationale suisse': swiss,
        'Plan OpenStreetMap': osm,
        'Plan des zones hors ligne': zoneBase,
      },
      { 'Balisage OpenSeaMap': seamark },
      { position: 'topright' },
    )
    .addTo(map);
  if (useSwiss) {
    swissWhenOffline(map, osm, swiss);
    void addLemanVector(map, layers);
  }
  simChartWire(map, layers, [swiss, osm, zoneBase]);
  addFullscreenControl(map);
  addOrientationControl(map);
  setFollow(!(simulatedSea && !here));
  let loaded = 0;
  let errors = 0;
  swiss.on('tileload', () => {
    loaded++;
  });
  swiss.on('tileerror', () => {
    errors++;
    if (errors === 6 && !loaded && navigator.onLine && map.hasLayer(swiss)) {
      map.removeLayer(swiss);
      osm.addTo(map);
    }
  });
  // Moving the map stops following the boat; the blue arrow brings it back.
  map.on('dragstart', () => setFollow(false));
  const live = L.polyline([], {
    color: '#d00000',
    weight: 5,
    opacity: 0.9,
  }).addTo(map);
  handle.live = live;
  const track = currentTrackLine();
  trkDrawPins();
  if (track.length > 1) {
    live.setLatLngs(track);
    map.fitBounds(live.getBounds(), { padding: [30, 30], maxZoom: 15 });
  } else if (here) {
    map.setView(here, 14);
  } else if (useSwiss) {
    map.setView(LEMAN_CENTER, 10);
  } else {
    map.setView(SIM_MED_CENTER, 9);
  }
  showPosition();
  whileMapLive(map, () => map.invalidateSize(), 100);
  const pending = takePendingTrace();
  if (pending) whileMapLive(map, () => drawTrace(pending), 200);
}

// The position shows even when nothing records.
function showPosition(): void {
  const fix = state.view.lastFix.value;
  if (!state.view.tracking.value && navigator.geolocation) {
    setMapWatch(
      navigator.geolocation.watchPosition(
        ({ coords }) => {
          if (nmeaPosFresh()) return;
          trkFix({
            lat: coords.latitude,
            lon: coords.longitude,
            acc: coords.accuracy,
            sog:
              coords.speed !== null && coords.speed >= 0
                ? coords.speed * KNOTS_PER_METRE_SECOND
                : null,
            cog: coords.heading,
          });
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 30_000 },
      ),
    );
  } else if (fix) {
    trkFix({ lat: fix.lat, lon: fix.lon });
  }
}
