import { useSignals } from '@preact/signals-react/runtime';
import type { LayerGroup } from 'leaflet';
import { useEffect } from 'react';

import { fixedOnMap, fixedOpened } from '../../features/map/fixedZone.ts';
import { leaflet } from '../../features/map/leaflet.ts';
import { tracker } from '../../features/map/trackerState.ts';
import { buzz } from '../../lib/dom.ts';
import { fixedAlertById, fixedBand } from '../../model/fixedAlerts.ts';
import { lightBand } from '../../shell/lightBand.ts';
import { go } from '../../shell/router.ts';

/** The map of NavIn is looked for this often until it is built. */
const WAIT_MS = 500;

/**
 * The zone of the fixed alert touched in its list, on the NavIn map: a
 * dashed orange circle with its name. A touch on it goes back to the list
 * of the fixed alerts, its band blinking three times (as a mark in its list),
 * and takes the zone off.
 * @returns Nothing: it draws on the map.
 */
export function FixedAlertsOnMap() {
  useSignals();
  const id = fixedOnMap.value;
  useEffect(() => {
    const alert = id ? fixedAlertById(id) : undefined;
    const zone = alert?.zone;
    if (!alert || !zone) return;
    let layer: LayerGroup | null = null;
    let wait: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    const back = () => {
      buzz();
      fixedOnMap.value = null;
      fixedOpened.value = alert.id;
      go('weather', 'fixed');
      lightBand(fixedBand(alert.id), true);
    };
    const draw = () => {
      if (closed) return;
      const map = tracker.current?.map;
      if (!map) {
        wait = setTimeout(draw, WAIT_MS);
        return;
      }
      const L = leaflet();
      layer = L.layerGroup().addTo(map);
      L.circle([zone.lat, zone.lon], {
        radius: zone.km * 1000,
        color: '#e8590c',
        weight: 3,
        dashArray: '8 6',
        fillColor: '#ffb84d',
        fillOpacity: 0.18,
        className: 'fixed-zone',
        bubblingMouseEvents: false,
      })
        .bindTooltip(`⚠ ${alert.name} · toucher : la fiche`, {
          permanent: true,
          direction: 'center',
          className: 'fixed-zone-tip',
        })
        .on('click', back)
        .addTo(layer);
    };
    draw();
    return () => {
      closed = true;
      clearTimeout(wait);
      layer?.remove();
    };
  }, [id]);
  return null;
}
