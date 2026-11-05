import { useEffect, useRef, useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { useMarquee } from '../../components/shared/useMarquee.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { LAKE_ROLES, roleLabel } from '../../model/crewFields.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { useNavFields } from '../../shell/navbar/navHooks.ts';
import { crewSetName, memberName, state, toast } from '../../state/index.ts';
import { membersByNav } from '../boats/index.ts';

import { CrewsChoice } from './CrewsChoice.tsx';
import { CrewsPhoto } from './CrewsPhoto.tsx';
import { LongPressButton } from './LongPressButton.tsx';
import {
  choicePending,
  crewSetById,
  patchCrewsEdit,
  saveCrewsEdit,
  setCrewsEditRole,
  toggleCrewsEditMember,
} from './crewsEdit.ts';
import { removeEditedCrewSet } from './crewsPhotoActions.ts';
import { openFiche } from './ficheNavigation.ts';
import { showCrews, showCrewsEdit, showFiche } from './screen.ts';

/**
 * Edition of a composition (legacy `renderCrewsEdit`, prep.js:791). Legacy
 * draws the screen once per action, so what is typed in the fields changes the
 * texts only at the next action: this component reads the state once, a new
 * draw remounts it.
 * @returns The screen.
 */
export function CrewsEditor() {
  useNavFields();
  const tr = useTr();
  const [{ edit, base, sorted }] = useState(() => {
    const current = state.view.crewsEdit.peek();
    return {
      edit: current ?? { id: null, name: '', crew: [] },
      base: crewSetById(current?.id ?? null),
      sorted: membersByNav(),
    };
  });
  const nameInput = useRef<HTMLInputElement>(null);
  useMarquee(nameInput);
  useEffect(() => {
    if (!state.view.crewsEdit.peek()?.addedNew) return;
    patchCrewsEdit({ addedNew: false });
    saveCrewsEdit();
  }, []);
  const pending = choicePending(edit, base);
  const leave = () => {
    buzz();
    const current = state.view.crewsEdit.peek();
    if (current && choicePending(current, crewSetById(current.id))) {
      toast('Choisissez : écraser, nouvel équipage ou annuler');
      const choice = document.querySelector('#ceChoice');
      choice?.scrollIntoView({ block: 'center' });
      choice?.classList.add('lab-flash');
      return;
    }
    if (edit.crew.length > 0) toast('Équipage enregistré');
    else if (!base) toast('Équipage vide : pas gardé');
    state.view.crewsEdit.value = null;
    showCrews();
  };
  return (
    <>
      <PageBack id="ceBack" label={tr('◀ Équipages')} onClick={leave} />
      <PageTitle>{base ? crewSetName(base) : 'Nouvel équipage'}</PageTitle>
      {pending && base ? <CrewsChoice base={base} /> : null}
      <FoldSection title="Nom de l’équipage">
        <input
          ref={nameInput}
          className="text"
          id="ceName"
          defaultValue={edit.name}
          placeholder={tr.placeholder(
            base?.ident ?? 'facultatif · sinon identifiant automatique (EQ…)',
          )}
          autoComplete="off"
          onChange={(event) => {
            patchCrewsEdit({ name: event.target.value });
            saveCrewsEdit();
          }}
        />
      </FoldSection>
      <CrewsPhoto base={base} />
      {edit.crew.map((line, index) => {
        const member = state.data.members
          .peek()
          .find((item) => item.id === line.memberId);
        return (
          <div key={line.memberId} className="crew-on">
            <div className="crew-on-name">
              <b>{`${index + 1}. ${member ? memberName(member) : '?'}`}</b>
            </div>
            <ButtonRow className="row c3">
              {LAKE_ROLES.map(([role]) => (
                <Button
                  key={role}
                  className={`btn ${line.fonction === role ? 'on' : ''}`}
                  data-cerole={index}
                  data-f={role}
                  onClick={() => {
                    buzz();
                    setCrewsEditRole(index, role);
                    showCrewsEdit();
                  }}
                >
                  {tr(roleLabel(role, member?.sexe))}
                </Button>
              ))}
            </ButtonRow>
          </div>
        );
      })}
      <h2 className="sub-h">{tr('Les coéquipiers·ères')}</h2>
      {sorted.length > 0 ? (
        <ButtonRow className="row c2 crew-pick">
          {sorted.map((member) => {
            const selected = edit.crew.some(
              (line) => line.memberId === member.id,
            );
            return (
              <LongPressButton
                key={member.id}
                className={`btn big ${selected ? 'on' : ''}`}
                data-cem={member.id}
                onClick={() => {
                  buzz();
                  toggleCrewsEditMember(member.id);
                  showCrewsEdit();
                }}
                onLongPress={() => openFiche(member.id, 'crews')}
              >
                {selected ? '✔ ' : ''}
                {memberName(member) || '…'}
              </LongPressButton>
            );
          })}
        </ButtonRow>
      ) : (
        <div className="row c2 crew-pick">
          <HelpText>Aucune fiche : créez d’abord les navigants.</HelpText>
        </div>
      )}
      <HelpText>Enregistrement automatique.</HelpText>
      <ButtonRow className="row c2" style={{ marginTop: 12 }}>
        <Button
          className="btn big"
          id="ceNewP"
          onClick={() => {
            buzz();
            const known = state.data.members.value.map((member) => member.id);
            patchCrewsEdit({ pendingNew: new Set(known) });
            state.view.ficheFromData.value = true;
            state.view.crewFicheBack.value = 'crews';
            state.view.crewFiche.value = 'new';
            showFiche('new');
          }}
        >
          {tr('＋ Nouveau coéquipier.ère')}
        </Button>
        {base ? (
          <HoldDeleteButton
            className="btn big danger"
            id="ceDel"
            onClick={buzz}
            onDelete={removeEditedCrewSet}
          >
            {tr('🗑 Supprimer')}
          </HoldDeleteButton>
        ) : null}
      </ButtonRow>
    </>
  );
}
