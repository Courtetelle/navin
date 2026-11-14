import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { navZone, state } from '../../state/index.ts';
import { seaBasin } from '../map/seaCenter.ts';

import type { Basin } from './zone.ts';
import { BASIN_NAMES, basinOf, cycleZone } from './zone.ts';

/** Outline of Lake Geneva, north up (Natural Earth, public domain). */
export function LemanIcon() {
  return (
    <svg className="zone-leman" viewBox="0 0 50 29.6" aria-hidden="true">
      <path
        d="M45.2 6.5 47.9 8.0 49.0 9.6 47.7 11.2 44.9 11.4 34.7 9.6 22.9 10.8 22.0 12.3 20.8 12.9 18.9 14.1 18.0 14.4 16.6 15.8 15.5 15.9 14.3 14.1 10.7 13.9 7.2 19.2 4.0 25.6 1.0 28.6 1.2 27.8 1.8 26.7 2.6 23.0 3.6 20.3 12.1 7.2 13.0 6.3 14.1 5.8 18.1 5.3 19.1 4.7 22.6 1.8 23.6 1.4 28.8 1.0 30.1 1.3 40.0 4.8 45.2 6.5Z"
        fill="#9fd8ff"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The logo of a step of the zone button: the long swell of the Atlantic, the
 * sun over the calm Mediterranean, the outline of a lake.
 * @param props - The step.
 * @param props.basin - `atl`, `med` or `lac`.
 * @returns The drawing.
 */
export function BasinIcon({ basin }: { basin: Basin }) {
  if (basin === 'lac') return <LemanIcon />;
  if (basin === 'med') {
    return (
      <svg className="zone-med" viewBox="0 0 50 30" aria-hidden="true">
        <circle cx="25" cy="11" r="7" fill="#ffb400" />
        <path
          d="M3 22c5-3 9 3 14 0s9 3 14 0 9 3 16 0"
          fill="none"
          stroke="#13b3c4"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg className="zone-atl" viewBox="0 0 50 30" aria-hidden="true">
      <path
        d="M2 12c6-6 10 6 16 0s10 6 16 0 10 6 14 0M2 21c6-6 10 6 16 0s10 6 16 0 10 6 14 0"
        fill="none"
        stroke="#1677ff"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Choice of the navigation zone in the settings (legacy `zoneSimHtml`): the
 * button says the action (the next zone) and the current zone in small.
 * @returns The section.
 */
export function ZoneSim() {
  useSignals();
  const tr = useTr();
  const zone = state.view.zoneSimV.value || 'auto';
  const here = basinOf(
    zone,
    seaBasin(state.preferences.settings.value),
    navZone(),
  );
  return (
    <section className="field zone-set">
      <ButtonRow className="row">
        <Button
          className={`btn big on zone-turn zone-${here}`}
          data-zonesim="1"
          data-basin={here}
          onClick={() => {
            buzz();
            cycleZone();
          }}
        >
          <span className="zone-turn-logo">
            <BasinIcon basin={here} />
          </span>
          <span>
            <b>{tr(BASIN_NAMES[here])}</b>
            <small>
              {tr(
                zone === 'auto'
                  ? 'sur la position GPS · toucher pour changer'
                  : 'zone de navigation · toucher pour changer',
              )}
            </small>
          </span>
        </Button>
      </ButtonRow>
      <HelpText>
        Le même bouton tournant qu’au bout de NavIn : Atlantique, Méditerranée,
        Lacs, chacun sur le lieu choisi plus bas. Tout suit la zone choisie :
        heure (UTC d’abord en mer, Zone Time sur le lac), touche VHF /
        Téléphone, SOS, VHF, météo, rubriques et cartes. La flèche du bateau
        ramène tout sur la position GPS.
      </HelpText>
    </section>
  );
}
