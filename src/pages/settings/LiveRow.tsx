import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import type { MeteoZone } from '../../features/zones/meteoZones.ts';
import { meteoZones, zonesText } from '../../features/zones/meteoZones.ts';
import { useTr } from '../../i18n/useTr.ts';
import {
  liveZoneIds,
  setLiveZones,
  showLiveAround,
  zonePickOpen,
} from '../tracker/liveOnMap.ts';

/**
 * Paramétrages › Alertes › LiveMétéo: the Météo-France zones whose stations
 * are shown on the map (else the zone where the boat is).
 * @returns The row.
 */
export function LiveRow() {
  useSignals();
  const tr = useTr();
  const chosen = liveZoneIds();
  const [zones, setZones] = useState<MeteoZone[]>([]);
  useEffect(() => {
    let closed = false;
    void meteoZones().then((read) => {
      if (!closed) setZones(read);
    });
    return () => {
      closed = true;
    };
  }, []);
  const names = zones.filter((zone) => chosen.includes(zone.id));
  return (
    <>
      <h3>{tr('Zones Météo-France')}</h3>
      <p data-live-zones>
        {tr(
          chosen.length === 0
            ? 'Zone où se trouve le bateau (ou la zone choisie avec NavIn).'
            : zonesText(names),
        )}
      </p>
      <ButtonRow className="row c2">
        <Button
          className="btn on"
          onClick={() => {
            zonePickOpen.value = true;
            showLiveAround();
          }}
        >
          {tr('Choisir sur la carte')}
        </Button>
        <Button
          className={chosen.length === 0 ? 'btn on' : 'btn'}
          onClick={() => setLiveZones([])}
        >
          {tr('Où je suis')}
        </Button>
      </ButtonRow>
      <HelpText>
        LiveMétéo montre sur la carte les stations de mesure des zones des
        bulletins de Météo-France : bandes côtières de 20 NM et zones du large,
        une ou plusieurs (appui long sur le bouton de la zone). Seules les
        stations à moins de 500 m de la côte sont gardées (1 km pour le Léman).
        L’appui long sur Météo montre celles de la carte affichée.
      </HelpText>
    </>
  );
}
