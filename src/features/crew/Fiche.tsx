import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { useIntroLead } from '../../components/shared/introLead.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import {
  crewFromMember,
  memberLockMsg,
  memberLocks,
  memberName,
  state,
  toast,
  updateCruise,
} from '../../state/index.ts';
import { openListPublish } from '../publish/index.ts';

import { FicheAvatar } from './FicheAvatar.tsx';
import { FicheForm } from './FicheForm.tsx';
import { FicheIdentity } from './FicheIdentity.tsx';
import { FichePhotos } from './FichePhotos.tsx';
import { deleteFiche } from './ficheActions.ts';
import { leaveFiche, showFiche, showLabels } from './screen.ts';
import { useFicheRecord } from './useFicheRecord.ts';

/** Props of {@link Fiche}. */
export interface FicheProps {
  /** Member id, or `new`. */
  id: string;
}

/**
 * A member card (legacy `renderFiche`, lake.js:2183): saved at each change.
 * @param props - Member id.
 * @returns The screen.
 */
export function Fiche({ id }: FicheProps) {
  useSignals();
  useNavFields();
  const tr = useTr();
  const record = useFicheRecord(id);
  useIntroLead(state.view.currentView.value, '');
  const [locked] = useState(() => !record.isNew && memberLocks(id).length > 0);
  const cruise = state.data.cruise.value;
  const leave = () => {
    buzz();
    const prenom = record.prenomInput.current?.value.trim() ?? '';
    const nom = record.nomInput.current?.value.trim() ?? '';
    const typed = Object.keys(record.latest()).length > 0 || nom;
    const savedId = record.latestId();
    const card = state.data.members.peek().find((item) => item.id === savedId);
    if (!prenom && (!record.isNew || typed)) {
      toast(
        record.isNew
          ? 'Sans prénom, la fiche n’est pas gardée'
          : 'Le prénom ne peut pas être vide : l’ancien est gardé',
      );
    } else if (card) {
      toast(`Fiche de ${memberName(card)} enregistrée`);
    }
    leaveFiche();
  };
  const putOnBoard = () => {
    buzz();
    const card = record.persist();
    if (!card) {
      toast('Le prénom est obligatoire');
      record.prenomInput.current?.focus();
      return;
    }
    updateCruise((draft) => {
      if (draft.crew.some((line) => line.memberId === card.id)) return;
      const skipper = draft.crew.some((line) => line.fonction === 'Skipper');
      draft.crew.push(crewFromMember(card, skipper ? 'Équipier' : 'Skipper'));
    });
    toast(`${memberName(card)} enregistré et à bord`);
    leaveFiche();
  };
  return (
    <>
      <PageBack id="fBack" label="◀ Retour" onClick={leave}>
        {tr('◀ Retour')}
      </PageBack>
      <div className="f-head">
        <h1>
          {record.isNew && !record.recordId ? tr(record.title) : record.title}
        </h1>
        <FicheAvatar record={record} />
        <Button
          type="button"
          className="btn ck-editbtn no-navact"
          id="fEdit"
          aria-label="Modifier les libellés"
          onClick={() => {
            buzz();
            record.persist();
            const back = state.view.crewFicheBack.value;
            showLabels(() => {
              state.view.crewFicheBack.value = back;
              showFiche(record.latestId() ?? 'new');
            });
          }}
        >
          ✎
        </Button>
      </div>
      <FicheIdentity record={record} />
      <details className="section" open={!record.isNew}>
        <summary>{tr('Informations complémentaires')}</summary>
        <FicheForm record={record} />
      </details>
      <FichePhotos record={record} />
      {record.isNew && cruise ? (
        <ButtonRow>
          <Button className="btn big primary" id="fBoard" onClick={putOnBoard}>
            {tr('＋ Mettre à bord')}
          </Button>
        </ButtonRow>
      ) : null}
      <ButtonRow
        className="row ck-pub-row"
        id="fImgRow"
        hidden={!record.recordId}
      >
        <Button
          className="btn big ck-pub no-navact"
          id="fImg"
          onClick={() => {
            buzz();
            record.persist();
            const savedId = record.latestId();
            if (savedId) openListPublish('people', savedId);
          }}
        >
          {tr('📤 Publier')}
          <small>
            {tr(
              'la fiche en image ou PDF, pour un dernier contrôle par la personne',
            )}
          </small>
        </Button>
      </ButtonRow>
      {locked ? (
        <HelpText className="fiche-lock">{`🔒 ${memberLockMsg(id)}`}</HelpText>
      ) : (
        <ButtonRow id="fDelRow" hidden={!record.recordId}>
          <HoldDeleteButton
            className="btn danger"
            id="fDel"
            onClick={buzz}
            onDelete={() => deleteFiche(record.latestId())}
          >
            {tr('Supprimer la fiche')}
          </HoldDeleteButton>
        </ButtonRow>
      )}
    </>
  );
}
