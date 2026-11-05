import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { membersByNav } from '../../features/boats/index.ts';
import {
  addCrewDraftPerson,
  saveCrewDraftAs,
  setCrewDraftName,
  setCrewDraftRole,
  toggleCrewDraftMember,
  validateCrewDraft,
} from '../../features/prep/prepCrewDraft.ts';
import type { CrewDraft } from '../../features/prep/prepTypes.ts';
import { LAKE_ROLES, SEA_ROLES, roleLabel } from '../../model/crewFields.ts';
import { crewFull, memberName, state } from '../../state/index.ts';

import type { PrepStepProps } from './PrepFirstSteps.tsx';
import { PrepNav } from './PrepNav.tsx';

/** Props of {@link PrepCrewEditStep}. */
export interface PrepCrewEditStepProps extends PrepStepProps {
  /** Crew being composed. */
  draft: CrewDraft;
}

/**
 * « Nouvel équipage »: people on board and their roles; the roles belong to
 * the composition, not to the cards.
 * @param props - PréP flow and crew being composed.
 * @returns The composition form.
 */
export function PrepCrewEditStep({ prep, draft }: PrepCrewEditStepProps) {
  useSignals();
  const base = state.data.crewSets.value.find(
    (item) => item.id === draft.baseId,
  );
  const members = state.data.members.value;
  const roles = prep.type === 'mer' ? SEA_ROLES : LAKE_ROLES;
  const changed = !base || crewFull(base.crew) !== crewFull(draft.crew);
  let intro = '';
  if (base) {
    intro = changed
      ? `Modifiée : à la fin, écraser ${base.ident} (même numéro) ou enregistrer un nouvel équipage. `
      : `Composition ${base.ident}. `;
  }
  return (
    <>
      <HelpText>
        {`${intro}Touche les personnes à bord, puis choisis les rôles. L’équipage est gardé pour les prochaines fois.`}
      </HelpText>
      <label className="field">
        <h2>Nom de l’équipage</h2>
        <input
          className="text"
          id="crewSetName"
          value={draft.name}
          placeholder={
            changed
              ? 'facultatif · sinon identifiant automatique (EQ…)'
              : (base?.ident ?? '')
          }
          autoComplete="off"
          onChange={(event) => setCrewDraftName(event.target.value)}
        />
      </label>
      {draft.crew.map((line, position) => {
        const member = members.find((item) => item.id === line.memberId);
        return (
          <div className="crew-on" key={line.memberId}>
            <div className="crew-on-name">
              <b>
                {position + 1}. {member ? memberName(member) : '?'}
              </b>
            </div>
            <div className="row c3">
              {roles.map(([role]) => (
                <Button
                  key={role}
                  className={`btn ${line.fonction === role ? 'on' : ''}`}
                  data-crole={position}
                  data-f={role}
                  onClick={() => setCrewDraftRole(position, role)}
                >
                  {roleLabel(role, member?.sexe)}
                </Button>
              ))}
            </div>
          </div>
        );
      })}
      <h2 className="sub-h">Personnes</h2>
      <div className="row c2 crew-pick">
        {membersByNav().map((member) => {
          const on = draft.crew.some((line) => line.memberId === member.id);
          return (
            <Button
              key={member.id}
              className={`btn big ${on ? 'on' : ''}`}
              data-cm={member.id}
              onClick={() => toggleCrewDraftMember(member.id)}
            >
              {on ? '✔ ' : ''}
              {memberName(member) || '…'}
            </Button>
          );
        })}
      </div>
      <ButtonRow>
        <Button
          className="btn big"
          data-p="fiches"
          onClick={addCrewDraftPerson}
        >
          ＋ Ajouter une personne
        </Button>
      </ButtonRow>
      {base && changed && draft.crew.length > 0 ? (
        <>
          <div className="crew-choice">
            <p className="help">
              <b>Équipage {base.ident} modifié.</b> Que faire ?
            </p>
            <ButtonRow className="row c2">
              <Button
                className="btn big"
                data-p="crewOver"
                onClick={() => saveCrewDraftAs(true)}
              >
                ✎ Écraser {base.ident}
                <small>garder ce numéro</small>
              </Button>
              <Button
                className="btn big no-navact"
                data-p="crewNew"
                onClick={() => saveCrewDraftAs(false)}
              >
                ＋ Nouvel équipage
                <small>nouveau numéro</small>
              </Button>
            </ButtonRow>
          </div>
          <PrepNav />
        </>
      ) : (
        <PrepNav
          next={draft.crew.length > 0 ? 'Valider ▶' : ''}
          onNext={validateCrewDraft}
        />
      )}
    </>
  );
}
