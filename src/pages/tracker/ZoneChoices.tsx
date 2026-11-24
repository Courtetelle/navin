import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import type { MeteoZone, ZoneBasin } from '../../features/zones/meteoZones.ts';
import { BASIN_NAMES, ZONE_SETS } from '../../features/zones/meteoZones.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import { liveZoneIds, setLiveZones } from './liveOnMap.ts';
import { shownIds, toggleZone } from './zoneChoice.ts';

const BASINS: readonly ZoneBasin[] = [
  'manche',
  'atlantique',
  'mediterranee',
  'lac',
];

/**
 * Every zone of LiveMétéo as buttons: « Où je suis », the groups chosen with
 * one touch, and the zones by sea, coast and offshore (a touch adds one or
 * takes it away). In the chooser over the map and in Paramétrages.
 * @param props - The props.
 * @param props.zones - All the zones.
 * @returns The buttons.
 */
export function ZoneChoices({ zones }: { zones: readonly MeteoZone[] }) {
  useSignals();
  const tr = useTr();
  const chosen = liveZoneIds();
  const shown = shownIds(zones);
  return (
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
                // From « Où je suis », a group replaces the zone of the
                // boat; else it is added to the zones chosen.
                const start = chosen.length > 0 ? chosen : [];
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
  );
}
