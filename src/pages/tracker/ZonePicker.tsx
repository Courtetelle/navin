import { useSignals } from '@preact/signals-react/runtime';
import type { LayerGroup } from 'leaflet';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { leaflet } from '../../features/map/leaflet.ts';
import { tracker } from '../../features/map/trackerState.ts';
import { onLake } from '../../features/onwater/onLake.ts';
import type { MeteoZone, ZoneBasin } from '../../features/zones/meteoZones.ts';
import {
  BASIN_NAMES,
  ZONE_SETS,
  meteoZones,
  zonesAt,
} from '../../features/zones/meteoZones.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { boatPlace } from '../meteo/boatPlace.ts';

import { liveZoneIds, setLiveZones, zonePickOpen } from './liveOnMap.ts';

const BASINS: readonly ZoneBasin[] = [
  'manche',
  'atlantique',
  'mediterranee',
  'lac',
];
const ON_COLOR = '#d35400';
const OFF_COLOR = '#1e5aa8';

/**
 * The ids a change starts from: those chosen, else those of the place.
 * @param zones - All the zones.
 * @returns The ids.
 */
function startIds(zones: readonly MeteoZone[]): string[] {
  const chosen = liveZoneIds();
  if (chosen.length > 0) return chosen;
  const place = boatPlace();
  return zonesAt(zones, place.lat, place.lon, onLake());
}

/**
 * Add a zone, or take it away.
 * @param zones - All the zones.
 * @param id - The zone touched.
 */
function toggleZone(zones: readonly MeteoZone[], id: string): void {
  buzz();
  const ids = startIds(zones);
  setLiveZones(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
}

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
  const chosen = liveZoneIds();
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
  const shown = new Set(
    chosen.length > 0 ? chosen : zones.length > 0 ? startIds(zones) : [],
  );
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
        <>
          <div className="zone-pick-sets">
            <Button
              type="button"
              noUiEdit
              className={chosen.length === 0 ? 'btn on' : 'btn'}
              onClick={() => {
                buzz();
                setLiveZones([]);
              }}
            >
              {tr('Où je suis')}
            </Button>
            {ZONE_SETS.map((set) => {
              const ids = set.ids(zones);
              const all = ids.length > 0 && ids.every((id) => shown.has(id));
              return (
                <Button
                  key={set.id}
                  type="button"
                  noUiEdit
                  className={all && chosen.length > 0 ? 'btn on' : 'btn'}
                  data-zone-set={set.id}
                  onClick={() => {
                    buzz();
                    const start = startIds(zones);
                    setLiveZones(
                      all
                        ? start.filter((id) => !ids.includes(id))
                        : [...start, ...ids],
                    );
                  }}
                >
                  {tr(set.label)}
                </Button>
              );
            })}
          </div>
          {BASINS.map((basin) => {
            const here = zones.filter((z) => z.basin === basin);
            if (here.length === 0) return null;
            return (
              <section key={basin} className="zone-pick-basin">
                <h4>{tr(BASIN_NAMES[basin])}</h4>
                <div className="zone-pick-list">
                  {here.map((zone) => (
                    <Button
                      key={zone.id}
                      type="button"
                      noUiEdit
                      className={shown.has(zone.id) ? 'btn on' : 'btn'}
                      data-zone={zone.id}
                      onClick={() => toggleZone(zones, zone.id)}
                    >
                      {tr(
                        zone.kind === 'cote'
                          ? `Côte · ${zone.name}`
                          : zone.kind === 'large'
                            ? `Large · ${zone.name}`
                            : zone.name,
                      )}
                    </Button>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
