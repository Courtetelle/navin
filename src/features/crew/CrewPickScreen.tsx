import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { textOf } from '../../lib/format.ts';
import { MEMBER_KEYS } from '../../model/crewFields.ts';
import type { Member } from '../../model/types.ts';
import { isLake, memberName, state } from '../../state/index.ts';
import { membersByNav } from '../boats/index.ts';

import { CrewOnBoard } from './CrewOnBoard.tsx';
import { CrewPublish } from './CrewPublish.tsx';
import { LongPressButton } from './LongPressButton.tsx';
import { toggleAboard } from './aboard.ts';
import { openFiche } from './ficheNavigation.ts';
import { crewPickTitle, showCrewPick } from './screen.ts';

/** Props of {@link CrewPickScreen}. */
export interface CrewPickScreenProps {
  /** The title differs from the screen drawn before. */
  lead: boolean;
}

/**
 * Who is on board (legacy `renderCrewPick`, lake.js:1819): the real crew, a
 * tap puts a card on board or takes it off, a long press opens it.
 * @param props - Drawing context.
 * @returns The screen.
 */
export function CrewPickScreen({ lead }: CrewPickScreenProps) {
  useSignals();
  const tr = useTr();
  const [publishing, setPublishing] = useState(false);
  const cruise = state.data.cruise.value;
  if (!cruise) return null;
  const sorted = membersByNav();
  const extra = cruise.crew.filter((line) => !line.memberId);
  const place = isLake() ? 'sortie' : 'navigation';
  return (
    <>
      <PageTitle
        atTop={lead}
        helps={[
          `Équipage réel, modifiable à tout moment (absence de dernière minute, départ en cours de route) : touchez un nom pour le mettre à bord de cette ${place} ou l’en retirer ; une fois parti, c’est noté au journal. Les fiches restent enregistrées pour les prochaines fois, uniquement sur ce téléphone.`,
        ]}
      >
        {crewPickTitle()}
      </PageTitle>
      {cruise.crew.length > 0 ? (
        <>
          <h2 className="sub-h">{tr('À bord')}</h2>
          {cruise.crew.map((line, index) => (
            <CrewOnBoard
              // A line has no id and can be moved: the position is its identity.
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              line={line}
              index={index}
            />
          ))}
        </>
      ) : null}
      <h2 className="sub-h">{tr('Mettre à bord ou retirer')}</h2>
      {sorted.length > 0 ? (
        <ButtonRow className="row c2 crew-pick">
          {sorted.map((member) => (
            <PickButton
              key={member.id}
              className={`btn big ${isAboard(member) ? 'on' : ''}`}
              member={member}
            />
          ))}
        </ButtonRow>
      ) : (
        <HelpText>Aucune fiche pour l’instant.</HelpText>
      )}
      {extra.length > 0 ? (
        <HelpText>
          {`Aussi à bord (sans fiche) : ${extra.map((line) => line.nom).join(', ')}`}
        </HelpText>
      ) : null}
      <ButtonRow style={{ marginTop: 12 }}>
        <Button
          className="btn big primary"
          id="mNew"
          onClick={() => {
            buzz();
            state.view.crewFiche.value = 'new';
            showCrewPick();
          }}
        >
          {tr('＋ Nouveau coéquipier.ère')}
        </Button>
      </ButtonRow>
      {cruise.crew.length > 0 ? (
        <ButtonRow className="row ck-pub-row">
          <Button
            className="btn big ck-pub"
            id="crewPub"
            onClick={() => {
              buzz();
              setPublishing(true);
            }}
          >
            {tr('📤 Publier')}
            <small>{tr('liste d’équipage, image ou PDF')}</small>
          </Button>
        </ButtonRow>
      ) : null}
      {publishing ? <CrewPublish onClose={() => setPublishing(false)} /> : null}
    </>
  );
}

function isAboard(member: Member): boolean {
  return (state.data.cruise.value?.crew ?? []).some(
    (line) => line.memberId === member.id,
  );
}

interface PickButtonProps {
  member: Member;
  className: string;
}

function PickButton({ member, className }: PickButtonProps) {
  const tr = useTr();
  let filled = 0;
  for (const key of MEMBER_KEYS) if (member[key]) filled++;
  const details = filled > 1 ? tr(` · ${filled} infos`) : '';
  return (
    <LongPressButton
      className={className}
      data-m={member.id}
      onClick={() => {
        buzz();
        toggleAboard(member);
        showCrewPick();
      }}
      onLongPress={() => openFiche(member.id, null)}
    >
      {isAboard(member) ? '✔ ' : ''}
      {memberName(member) || '…'}
      <small>
        {textOf(member.tel)}
        {details}
      </small>
    </LongPressButton>
  );
}
