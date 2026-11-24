import { useSignals } from '@preact/signals-react/runtime';
import type { LayerGroup } from 'leaflet';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { leaflet } from '../../features/map/leaflet.ts';
import { tracker } from '../../features/map/trackerState.ts';
import type { MeteoZone } from '../../features/zones/meteoZones.ts';
import { meteoZones } from '../../features/zones/meteoZones.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import { ZoneChoices } from './ZoneChoices.tsx';
import { liveZoneArea, zonePickOpen } from './liveOnMap.ts';
import { shownIds, toggleZone } from './zoneChoice.ts';
import { fitZones } from './zoneFit.ts';

const ON_COLOR = '#d35400';
const OFF_COLOR = '#1e5aa8';

/**
 * The chooser of the Météo-France zones of LiveMétéo, opened by a long press
 * on the button of the zone: every zone drawn on the map (a touch on one adds
 * it or takes it away), the list below by sea, coast and offshore, and groups
 * chosen with one touch (Manche, Atlantique, Méditerranée, all the coasts,
 * the Léman). « Où je suis » goes back to the zone of the boat.
 * @returns The chooser, or nothing when closed.
 */
export function ZonePicker() {
  useSignals();
  const tr = useTr();
  const open = zonePickOpen.value;
  const [zones, setZones] = useState<MeteoZone[]>([]);
  useEffect(() => {
    if (!open) return;
    let closed = false;
    void meteoZones().then((read) => {
      if (!closed) setZones(read);
    });
    return () => {
      closed = true;
    };
  }, [open]);
  const shown = shownIds(zones);
  const key = [...shown].toSorted().join(',');
  // Every zone on the map, the chosen ones coloured; a touch toggles one.
  useEffect(() => {
    if (!open || zones.length === 0) return undefined;
    const map = tracker.current?.map;
    if (!map) return undefined;
    const L = leaflet();
    const layer: LayerGroup = L.layerGroup().addTo(map);
    const on = new Set(key.split(','));
    for (const zone of zones) {
      const mine = on.has(zone.id);
      const color = mine ? ON_COLOR : OFF_COLOR;
      L.polygon(
        zone.polys.map((poly) =>
          poly.map((ring) =>
            ring.map(([lon, lat]) => [lat, lon] as [number, number]),
          ),
        ),
        {
          color,
          weight: mine ? 3 : 1.5,
          dashArray: zone.kind === 'large' ? '6 5' : undefined,
          fillColor: color,
          fillOpacity: mine ? 0.25 : 0.05,
        },
      )
        .bindTooltip(zone.name, { sticky: true })
        .on('click', () => toggleZone(zones, zone.id))
        .addTo(layer);
    }
    return () => {
      layer.remove();
    };
  }, [open, zones, key]);
  if (!open) return null;
  const close = () => {
    buzz();
    zonePickOpen.value = false;
    // The chooser gone: the zones chosen fill the map again.
    const map = tracker.current?.map;
    const box = liveZoneArea.peek();
    if (map && box) setTimeout(() => fitZones(map, box), 0);
  };
  return (
    <div
      className="zone-pick"
      role="dialog"
      aria-label={tr('Zones Météo-France de LiveMétéo')}
    >
      <div className="zone-pick-head">
        <b>{tr('Zones Météo-France')}</b>
        <Button type="button" noUiEdit className="btn on" onClick={close}>
          {tr('OK')}
        </Button>
      </div>
      <p className="zone-pick-help">
        {tr(
          'Toucher une zone, sur la carte ou ci-dessous, pour l’ajouter ou la retirer. Côte : bande de 20 NM des bulletins côte ; large : zones des bulletins large (tracé approché de la carte Météo-France). Stations à 500 m de la rive au plus (mer ou Léman).',
        )}
      </p>
      {zones.length === 0 ? (
        <p className="zone-pick-help">{tr('Lecture des zones…')}</p>
      ) : (
        <ZoneChoices zones={zones} />
      )}
    </div>
  );
}
