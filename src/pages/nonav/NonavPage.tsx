import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { MODES } from '../../model/modes.ts';
import { VIEW_LABELS } from '../../model/views.ts';
import type { PageProps } from '../../shell/pageTypes.ts';
import { go } from '../../shell/router.ts';
import { navZone, state } from '../../state/index.ts';

const SUBJECTS: Readonly<Record<string, string>> = {
  new: 'La saisie d’une entrée',
  day: 'La fiche de la journée',
  log: 'Le journal',
};

function startNavigation(type: string): void {
  buzz();
  state.view.newType.value = type;
  state.view.nameDirty.value = false;
  go('cruises');
}

/**
 * Screen `nonav` (legacy `VIEWS.nonav`): a screen that belongs to a navigation
 * was asked while none is open.
 * @param props - Page props; `arg` is the screen asked.
 * @returns The explanation and the ways to start or reopen a navigation.
 */
export function NonavPage({ arg }: PageProps) {
  useSignals();
  const tr = useTr();
  const want = typeof arg === 'string' ? arg : '';
  const count = state.data.index.value.length;
  const help = `${SUBJECTS[want] ?? 'Cette page'} appartient à une navigation. Aucune n’est ouverte pour l’instant : démarrez-en une ou rouvrez-en une.`;
  return (
    <>
      <PageTitle helps={[help]}>{VIEW_LABELS[want] ?? 'Navigation'}</PageTitle>
      {navZone() === 'lac' ? (
        <div className="row c2">
          <Button
            className="btn big"
            data-newnav="lacj"
            onClick={() => startNavigation('lacj')}
          >
            {tr(`${MODES.lacj.icon} Journée de nav`)}
            <small>{tr('lac')}</small>
          </Button>
          <Button
            className="btn big"
            data-newnav="lacc"
            onClick={() => startNavigation('lacc')}
          >
            {tr(`${MODES.lacc.icon} Croisière`)}
            <small>{tr('lac, plusieurs jours')}</small>
          </Button>
        </div>
      ) : (
        <div className="row">
          <Button
            className="btn big"
            data-newnav="mer"
            onClick={() => startNavigation('mer')}
          >
            {tr(`${MODES.mer.icon} Croisière`)}
            <small>{tr('mer')}</small>
          </Button>
        </div>
      )}
      <div className="row">
        <Button
          className="btn"
          data-go="cruises"
          onClick={() => {
            buzz();
            go('cruises');
          }}
        >
          {tr('⛵ Mes navigations')}
          <small>{tr(`${count} enregistrée${count > 1 ? 's' : ''}`)}</small>
        </Button>
      </div>
    </>
  );
}
