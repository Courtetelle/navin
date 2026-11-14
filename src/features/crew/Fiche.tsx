import { useSignals } from '@preact/signals-react/runtime';
import type { MouseEvent, PointerEvent } from 'react';
import { useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import { useIntroLead } from '../../components/shared/introLead.ts';
import { useReadingMarquee } from '../../components/shared/useReadingMarquee.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack, PageValidate } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { useNavEdit } from '../../shell/navbar/useNavEdit.ts';
import {
  crewFromMember,
  memberFieldsX,
  memberLockMsg,
  memberLocks,
  memberName,
  state,
  toast,
  updateCruise,
} from '../../state/index.ts';
import { isFilled } from '../logbook/compact/fieldChange.ts';
import { openListPublish } from '../publish/index.ts';

import { FicheAvatar } from './FicheAvatar.tsx';
import { FicheForm } from './FicheForm.tsx';
import { FicheIdentity } from './FicheIdentity.tsx';
import { FichePhotos } from './FichePhotos.tsx';
import { deleteFiche } from './ficheActions.ts';
import { ficheBackLabel, leaveFiche, showFiche, showLabels } from './screen.ts';
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
  // A card already validated opens read-only: « Modifier » edits it again.
  const [reading, setReading] = useState(!record.isNew);
  useNavEdit(reading, () => setReading(false));
  const sheet = useRef<HTMLDivElement>(null);
  useReadingMarquee(reading, sheet);
  const validate = () => {
    const card = record.persist();
    if (!card) {
      toast('Le prénom est obligatoire');
      record.prenomInput.current?.focus();
      return;
    }
    setReading(true);
    globalThis.scrollTo(0, 0);
    toast(`Fiche de ${memberName(card)} validée`);
  };
  const explain = (event: MouseEvent) => {
    if (!reading) return;
    const target = event.target as Element;
    if (!target.closest('.cf') || target.closest('.contact-on')) return;
    const field = target.closest('.cf')?.querySelector('input, textarea');
    // A text too long for its field scrolls instead.
    if (field && field.scrollWidth - field.clientWidth > 4) return;
    toast('Touchez le crayon en haut pour changer la fiche');
  };
  const holdContacts = (event: PointerEvent) => {
    // A long press would open a phone or mail field of a read-only card.
    if (reading) event.stopPropagation();
  };
  const cruise = state.data.cruise.value;
  const hasDetails = memberFieldsX().some(
    ({ key }) => key !== 'sexe' && isFilled(record.latest()[key]),
  );
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
      <PageBack id="fBack" label={ficheBackLabel()} onClick={leave}>
        {tr(ficheBackLabel())}
      </PageBack>
      {reading ? null : (
        <PageValidate label="Valider" onClick={validate} hidden>
          {tr('Valider')}
        </PageValidate>
      )}
      <div
        ref={sheet}
        className={reading ? 'fiche-reading' : undefined}
        onClick={explain}
        onPointerDownCapture={holdContacts}
      >
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
        <FicheIdentity record={record} reading={reading} />
        {reading && !hasDetails ? null : (
          <details className="section" open={reading || !record.isNew}>
            <summary>{tr('Informations complémentaires')}</summary>
            <FicheForm record={record} reading={reading} />
          </details>
        )}
        <FichePhotos record={record} />
        {record.isNew && cruise && !reading ? (
          <ButtonRow>
            <Button
              className="btn big primary"
              id="fBoard"
              onClick={putOnBoard}
            >
              {tr('＋ Mettre à bord')}
            </Button>
          </ButtonRow>
        ) : null}
        <ButtonRow
          className="row ck-pub-row"
          id="fImgRow"
          hidden={!record.recordId}
        >
          <ShareButton
            big
            className="no-navact"
            id="fImg"
            onShare={(format) => {
              record.persist();
              const savedId = record.latestId();
              if (savedId) openListPublish('people', savedId, format);
            }}
          />
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
      </div>
    </>
  );
}
