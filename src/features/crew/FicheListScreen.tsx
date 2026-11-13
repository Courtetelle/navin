import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import type { Member } from '../../model/types.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { memberLockMsg, memberName, state } from '../../state/index.ts';
import { membersByNav } from '../boats/index.ts';
import { SwipeRow } from '../prep/index.ts';
import { ListPublishRow, openListPublish } from '../publish/index.ts';

import { deleteMemberCard, openFiche } from './ficheNavigation.ts';
import { showCrewPick, showFiche } from './screen.ts';

/** Props of {@link FicheListScreen}. */
interface FicheListScreenProps {
  /** The title differs from the screen drawn before. */
  lead: boolean;
}

/**
 * List of the member cards (legacy `renderFicheList`, lake.js:2005): a tap opens
 * a card; 🗑 deletes it.
 * @param props - Drawing context.
 * @returns The screen.
 */
export function FicheListScreen({ lead }: FicheListScreenProps) {
  useSignals();
  const tr = useTr();
  const sorted = membersByNav();
  const toData = !state.data.cruise.value || state.view.ficheFromData.value;
  const backLabel = `◀ ${toData ? 'data' : 'Équipage'}`;
  return (
    <>
      <PageBack
        id="flBack"
        label={backLabel}
        onClick={() => {
          buzz();
          if (toData) go('more');
          else showCrewPick();
        }}
      >
        {tr(backLabel)}
      </PageBack>
      <PageTitle
        atTop={lead}
        helps={[
          'Touchez une fiche pour la compléter ou la modifier. 🗑 : la supprimer (avec confirmation).',
        ]}
      >
        Les coéquipiers·ères
      </PageTitle>
      <div className="checks">
        {sorted.length > 0 ? (
          sorted.map((member) => <CardButton key={member.id} member={member} />)
        ) : (
          <HelpText>Aucune fiche.</HelpText>
        )}
      </div>
      <ButtonRow style={{ marginTop: 12 }}>
        <Button
          className="btn big primary"
          id="mNew"
          onClick={() => {
            buzz();
            state.view.crewFicheBack.value = 'list';
            state.view.crewFiche.value = 'new';
            showFiche('new');
          }}
        >
          {tr('＋ Nouvelle fiche')}
        </Button>
      </ButtonRow>
      {state.view.currentView.value === 'people' && sorted.length > 0 ? (
        <ListPublishRow kind="people" />
      ) : null}
    </>
  );
}

function CardButton({ member }: { member: Member }) {
  const name = memberName(member) || '…';
  const contacts = [member.tel, member.email].filter(Boolean).join(' · ');
  return (
    <SwipeRow
      id={member.id}
      name={name}
      block={memberLockMsg}
      onDelete={deleteMemberCard}
      onShare={(format) => openListPublish('people', member.id, format)}
    >
      <Button
        className="btn"
        data-fiche={member.id}
        onClick={() => {
          buzz();
          openFiche(member.id, 'list');
        }}
      >
        {name}
        <small>{contacts}</small>
      </Button>
    </SwipeRow>
  );
}
