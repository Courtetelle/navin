import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { ckDefs } from '../../features/checklists/index.ts';
import { prepFromMenu } from '../../features/prep/index.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { BRIEF_NAME } from '../../model/checklistBases.ts';
import { go } from '../../shell/router.ts';
import { state, toast } from '../../state/index.ts';
import { showLiveOnMap } from '../tracker/liveOnMap.ts';

import { PrepForecast } from './PrepForecast.tsx';

function needOuting(): boolean {
  if (state.data.cruise.value) return true;
  toast('Choisissez d’abord le type de sortie, le bateau et l’équipage');
  prepFromMenu();
  return false;
}

/**
 * The PréP menu, opened by PréP in the row of NavIn: the weather,
 * the type of outing (up to the choice of the crew), the check-in and the
 * safety briefing.
 * @returns The screen content.
 */
export function PrepMenuPage() {
  useSignals();
  const tr = useTr();
  const [weather, setWeather] = useState(false);
  const [forecast, setForecast] = useState(false);
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
              () => setForecast((open) => !open),
            )}
            {forecast ? <PrepForecast /> : null}
            {entry(
              'wxlive',
              '🌬',
              'Stations LiveMétéo',
              'le vent mesuré dans 60 km, sur la carte',
              showLiveOnMap,
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
