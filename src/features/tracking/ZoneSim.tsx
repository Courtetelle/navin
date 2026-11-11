import { useSignals } from '@preact/signals-react/runtime';
import type { ReactNode } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { state } from '../../state/index.ts';

import { cycleZone, nextZone } from './zone.ts';

/** Outline of Lake Geneva, north up (Natural Earth, public domain). */
function LemanIcon() {
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
 * Choice of the navigation zone in the settings (legacy `zoneSimHtml`): the
 * button says the action (the next zone) and the current zone in small.
 * @returns The section.
 */
export function ZoneSim() {
  useSignals();
  const tr = useTr();
  const zone = state.view.zoneSimV.value || 'auto';
  // Legacy translates text nodes: outside the lake icon, the prefix and the
  // zone are a single node, and that sentence is not in the dictionary.
  const text = (prefix: string, choice: string): ReactNode => {
    if (choice === 'lac') {
      return (
        <>
          {tr(prefix)}
          <LemanIcon />
          {tr(' En eaux intérieures')}
        </>
      );
    }
    const zoneName =
      choice === 'mer' ? '🌊 Maritime' : '🛰️ Automatique par GPS';
    return tr(`${prefix}${zoneName}`);
  };
  return (
    <section className="field zone-set">
      <ButtonRow className="row">
        <Button
          className="btn big on"
          data-zonesim="1"
          onClick={() => {
            buzz();
            cycleZone();
          }}
        >
          {text('Passer à : ', nextZone(zone))}
          <small>{text('zone de navigation actuelle : ', zone)}</small>
        </Button>
      </ButtonRow>
      <HelpText>
        Comme l’appui long sur NavIn : lac ou mer, sur le lieu choisi plus bas.
        Tout suit la zone choisie : heure (UTC d’abord en mer, Zone Time sur le
        lac), touche VHF / Téléphone, SOS, VHF, météo, rubriques et cartes. La
        flèche du bateau ramène tout sur la position GPS.
      </HelpText>
    </section>
  );
}
