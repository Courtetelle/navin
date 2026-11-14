import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { ckDefs } from '../../features/checklists/index.ts';
import { prepFromMenu } from '../../features/prep/index.ts';
import { LemanIcon, cycleZone } from '../../features/tracking/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { BRIEF_NAME } from '../../model/checklistBases.ts';
import { go } from '../../shell/router.ts';
import { navZone, state, toast } from '../../state/index.ts';

/** Left on a zone this long, the zone is kept and the map comes back. */
const ZONE_KEEP_MS = 3000;

function SeaIcon() {
  return (
    <svg className="zone-sea" viewBox="0 0 50 30" aria-hidden="true">
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
 * The zone of navigation: its logo, Lac Léman or MER; each touch passes to
 * the next zone; 3 s without a touch keep it, and the map comes back.
 * @returns The button.
 */
function ZoneButton() {
  useSignals();
  const tr = useTr();
  const lake = navZone() === 'lac';
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <Button
      type="button"
      noUiEdit
      className="btn big prep-menu-btn prep-zone"
      data-pm="zone"
      aria-label={tr(
        lake
          ? 'Zone : Lac Léman · toucher pour la mer'
          : 'Zone : mer · toucher pour le lac',
      )}
      onClick={() => {
        buzz();
        cycleZone();
        clearTimeout(timer.current);
        timer.current = setTimeout(() => go('tracker'), ZONE_KEEP_MS);
      }}
    >
      <span className="prep-zone-logo">
        {lake ? <LemanIcon /> : <SeaIcon />}
      </span>
      <span>
        <b>{tr(lake ? 'Lac Léman' : 'MER')}</b>
        <small>{tr('Zone de navigation · toucher pour changer')}</small>
      </span>
    </Button>
  );
}

function needOuting(): boolean {
  if (state.data.cruise.value) return true;
  toast('Choisissez d’abord le type de sortie, le bateau et l’équipage');
  prepFromMenu();
  return false;
}

/**
 * The PréP menu, opened by PréP in the row of NavIn: the zone, the weather,
 * the type of outing (up to the choice of the crew), the check-in and the
 * safety briefing.
 * @returns The screen content.
 */
export function PrepMenuPage() {
  useSignals();
  const tr = useTr();
  const [weather, setWeather] = useState(false);
  const entry = (
    key: string,
    icon: string,
    title: string,
    sub: string,
    act: () => void,
  ) => (
    <Button
      type="button"
      noUiEdit
      className="btn big prep-menu-btn"
      data-pm={key}
      onClick={() => {
        buzz();
        act();
      }}
    >
      <span className="prep-menu-ico">{icon}</span>
      <span>
        <b>{tr(title)}</b>
        <small>{tr(sub)}</small>
      </span>
    </Button>
  );
  return (
    <>
      <PageTitle>PréP</PageTitle>
      <div className="prep-menu">
        <ZoneButton />
        {entry(
          'weather',
          '🌤',
          'Météo',
          'avant le départ, prévisions, stations',
          () => setWeather((open) => !open),
        )}
        {weather ? (
          <div className="prep-menu-sub">
            {entry(
              'wxcheck',
              '✅',
              'Check-list météo',
              'les points à consulter avant le départ',
              () => go('weather', 'forecast'),
            )}
            {entry(
              'wxforecast',
              '📈',
              'Prévision ici',
              'maintenant, dans 3 h, ce soir, demain matin',
              () => go('weather', 'forecast'),
            )}
            {entry(
              'wxlive',
              '🌬',
              'Stations Live météo',
              'le vent mesuré dans 60 km',
              () => go('meteo'),
            )}
          </div>
        ) : null}
        {entry(
          'type',
          '⛵',
          'Type de sortie',
          'type, bateau et équipage',
          prepFromMenu,
        )}
        {entry(
          'checkin',
          '✔️',
          'Check-in',
          'les listes avant le départ',
          () => {
            if (needOuting()) go('checklist', 'dep');
          },
        )}
        {entry(
          'brief',
          '🦺',
          'Briefing sécurité',
          'à faire avec l’équipage',
          () => {
            if (!needOuting()) return;
            const brief = ckDefs().find(([, , name]) => name === BRIEF_NAME);
            go('checklist', brief ? brief[0] : 'dep');
          },
        )}
      </div>
    </>
  );
}
