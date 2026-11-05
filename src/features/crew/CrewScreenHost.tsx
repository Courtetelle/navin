import { useSignals } from '@preact/signals-react/runtime';

import { state } from '../../state/index.ts';

import { BlankArbitration } from './BlankArbitration.tsx';
import { CrewPickScreen } from './CrewPickScreen.tsx';
import { CrewsEditor } from './CrewsEditor.tsx';
import { CrewsList } from './CrewsList.tsx';
import { Fiche } from './Fiche.tsx';
import { FicheListScreen } from './FicheListScreen.tsx';
import { MemberLabels } from './MemberLabels.tsx';
import { shownCrewScreen } from './screen.ts';

/**
 * The sub-screen shown by the pages `people`, `crews` and `crew`; each draw
 * starts from scratch, like legacy rewriting `#view`.
 * @returns The sub-screen.
 */
export function CrewScreenHost() {
  useSignals();
  const { screen, serial, lead } = shownCrewScreen.value;
  if (screen.kind === 'pick') {
    return <CrewPickScreen key={serial} lead={lead} />;
  }
  if (screen.kind === 'list') {
    return <FicheListScreen key={serial} lead={lead} />;
  }
  if (screen.kind === 'fiche') return <Fiche key={serial} id={screen.id} />;
  if (screen.kind === 'labels') {
    return <MemberLabels key={serial} back={screen.back} lead={lead} />;
  }
  if (screen.kind === 'arbitration') {
    return (
      <BlankArbitration
        key={serial}
        received={screen.received}
        clones={screen.clones}
      />
    );
  }
  return state.view.crewsEdit.peek() ? (
    <CrewsEditor key={serial} />
  ) : (
    <CrewsList key={serial} />
  );
}
