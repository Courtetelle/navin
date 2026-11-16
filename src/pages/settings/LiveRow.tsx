import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { updateSettings } from '../../state/index.ts';
import { LIVE_RADII_NM, liveRadiusNm } from '../tracker/liveOnMap.ts';

/**
 * Paramétrages › LiveMétéo: the radius of the stations shown on the map around
 * the zone chosen with NavIn (else the GPS position).
 * @returns The row.
 */
export function LiveRow() {
  useSignals();
  const tr = useTr();
  const radius = liveRadiusNm();
  return (
    <>
      <h3>{tr('Rayon autour de la zone')}</h3>
      <ButtonRow className="row c5">
        {LIVE_RADII_NM.map((value) => (
          <Button
            key={value}
            className={value === radius ? 'btn on' : 'btn'}
            data-live-radius={value}
            onClick={() => {
              buzz();
              updateSettings((settings) => {
                settings.liveRadiusNm = value;
              });
            }}
          >
            {tr(`${value} NM`)}
          </Button>
        ))}
      </ButtonRow>
      <HelpText>
        LiveMétéo montre sur la carte les stations de mesure dans ce rayon,
        autour de la zone choisie avec NavIn (Atlantique, Méditerranée ou Lacs),
        sinon autour de la position GPS. L’appui long sur Météo montre celles de
        la carte affichée.
      </HelpText>
    </>
  );
}
