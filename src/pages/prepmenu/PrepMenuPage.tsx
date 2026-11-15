import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { ckDefs } from '../../features/checklists/index.ts';
import { prepFromMenu } from '../../features/prep/index.ts';
import type { PrepListKind } from '../../features/prep/prepLists.ts';
import { PREP_SUBJECTS, prepListBase } from '../../features/prep/prepLists.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { BRIEF_NAME } from '../../model/checklistBases.ts';
import { go } from '../../shell/router.ts';
import { state, toast } from '../../state/index.ts';

function needOuting(): boolean {
  if (state.data.cruise.value) return true;
  toast('Choisissez d’abord le type de sortie, le bateau et l’équipage');
  prepFromMenu();
  return false;
}

/**
 * The PréP menu, opened by PréP in the row of NavIn, in three sections:
 * the programming of the outing (format, boat, crew), the check-in (the
 * list of the boat, the safety briefing, the ready lists by subject) and
 * the check-out (the same).
 * The weather has its own button, Météo.
 * @returns The screen content.
 */
export function PrepMenuPage() {
  useSignals();
  const tr = useTr();
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
  const subjects = (kind: PrepListKind) => (
    <div className="prep-lists">
      {PREP_SUBJECTS.map((subject) => (
        <Button
          key={subject}
          type="button"
          noUiEdit
          className="btn prep-list-btn"
          data-pl={`${kind}:${subject}`}
          onClick={() => {
            buzz();
            go('ckbases', prepListBase(kind, subject));
          }}
        >
          {tr(subject)}
        </Button>
      ))}
    </div>
  );
  return (
    <>
      <PageTitle>PréP</PageTitle>
      <div className="prep-menu">
        <h2 className="prep-menu-h">{tr('Programmation de la sortie')}</h2>
        {entry(
          'type',
          '⛵',
          'Format, bateau, équipage',
          'Entraînement, Location Savannah, Invitation ou Croisière',
          prepFromMenu,
        )}
        <h2 className="prep-menu-h">{tr('Check-in')}</h2>
        {entry(
          'checkin',
          '✔️',
          'Check-in de la sortie',
          'la liste du bateau, avant le départ',
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
        <p className="prep-lists-lead">
          {tr('Listes prêtes, à copier et à modifier ligne par ligne :')}
        </p>
        {subjects('in')}
        <h2 className="prep-menu-h">{tr('Check-out')}</h2>
        {entry(
          'checkout',
          '🔒',
          'Check-out de la sortie',
          'la liste du bateau, en le quittant',
          () => {
            if (needOuting()) go('checklist', 'quit');
          },
        )}
        <p className="prep-lists-lead">
          {tr('Listes prêtes, à copier et à modifier ligne par ligne :')}
        </p>
        {subjects('out')}
      </div>
    </>
  );
}
