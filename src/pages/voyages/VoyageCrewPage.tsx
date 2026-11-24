import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import { membersByNav } from '../../features/boats/index.ts';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import { DocImport, DocList } from '../../features/voyages/VoyageDocs.tsx';
import { useChapterEdit } from '../../features/voyages/useChapterEdit.tsx';
import {
  crewSections,
  memberField,
  toggleVoyageMember,
} from '../../features/voyages/voyageCrew.ts';
import { shareSections } from '../../features/voyages/voyageShare.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { roleLabel } from '../../model/crewFields.ts';
import { CREW_CAT, VOYAGE_ROLES } from '../../model/voyages.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import {
  crewSetName,
  memberName,
  state,
  toast,
  updateVoyages,
} from '../../state/index.ts';

/**
 * Screen `vcrew` (data › Croisières › Équipage): who leaves on the cruise,
 * picked among the cards of data › Équipiers·ères (or from a saved crew),
 * with their role; kept apart from the crew of the open navigation.
 * @returns The screen content.
 */
export function VoyageCrewPage() {
  useSignals();
  const tr = useTr();
  const { editing, validate } = useChapterEdit();
  const { crew, id } = state.data.voyages.value;
  const members = state.data.members.value;
  const sorted = membersByNav();
  const sets = state.data.crewSets.value.filter((set) => set.crew.length > 0);
  if (!id) return <NoVoyage />;
  return (
    <>
      <PageBack
        label="◀ Croisière"
        data-go="voyage"
        onClick={() => {
          buzz();
          go('voyage');
        }}
      >
        {tr('◀ Croisière')}
      </PageBack>
      {validate}
      <PageTitle
        helps={[
          'L’équipage de la croisière, propre à Croisières : il ne change pas celui de la navigation en cours. Le crayon en haut permet de choisir les personnes et leurs rôles ; les fiches se créent dans data › Équipiers·ères.',
        ]}
      >
        {`👥 Équipage · ${crew.length}`}
      </PageTitle>
      {crew.map((line, index) => {
        const member = members.find((item) => item.id === line.memberId);
        const tel = memberField(member, 'tel');
        const mail = memberField(member, 'email');
        return (
          <div
            key={line.memberId}
            className="crew-on"
            data-voycrew={line.memberId}
          >
            <div className="crew-on-name">
              <b>{`${index + 1}. ${member ? memberName(member) : '?'}`}</b>
              {editing ? null : (
                <span className="voy-role">
                  {` · ${tr(roleLabel(line.fonction, member?.sexe))}`}
                </span>
              )}
              {tel ? (
                <a
                  className="voy-link"
                  href={`tel:${tel.replaceAll(/[^\d+]/gu, '')}`}
                >
                  📞 {tel}
                </a>
              ) : null}
              {mail ? (
                <a className="voy-link" href={`mailto:${mail}`}>
                  ✉️ {mail}
                </a>
              ) : null}
            </div>
            {editing ? (
              <ButtonRow className="row c3">
                {VOYAGE_ROLES.map((role) => (
                  <Button
                    key={role}
                    className={`btn ${line.fonction === role ? 'on' : ''}`}
                    data-voyrole={index}
                    data-f={role}
                    onClick={() => {
                      buzz();
                      updateVoyages((voyages) => {
                        const found = voyages.crew[index];
                        if (found) found.fonction = role;
                      });
                    }}
                  >
                    {tr(roleLabel(role, member?.sexe))}
                  </Button>
                ))}
              </ButtonRow>
            ) : null}
          </div>
        );
      })}
      {crew.length === 0 && !editing ? (
        <HelpText>
          Personne pour l’instant : touchez le crayon en haut.
        </HelpText>
      ) : null}
      {editing ? (
        <>
          <h2 className="sub-h">{tr('Équipiers·ères')}</h2>
          {sorted.length > 0 ? (
            <ButtonRow className="row c2 crew-pick">
              {sorted.map((member) => {
                const selected = crew.some(
                  (line) => line.memberId === member.id,
                );
                return (
                  <Button
                    key={member.id}
                    className={`btn big ${selected ? 'on' : ''}`}
                    data-voymember={member.id}
                    onClick={() => {
                      buzz();
                      toggleVoyageMember(member.id);
                    }}
                  >
                    {selected ? '✔ ' : ''}
                    {memberName(member) || '…'}
                  </Button>
                );
              })}
            </ButtonRow>
          ) : (
            <HelpText>Aucune fiche : créez d’abord les navigants.</HelpText>
          )}
          {sets.length > 0 ? (
            <FoldSection title="Reprendre un équipage enregistré">
              <ButtonRow className="row c2">
                {sets.map((set) => (
                  <Button
                    key={set.id}
                    className="btn big"
                    data-voyset={set.id}
                    onClick={() => {
                      buzz();
                      updateVoyages((voyages) => {
                        voyages.crew = set.crew
                          .filter((line) =>
                            members.some(
                              (member) => member.id === line.memberId,
                            ),
                          )
                          .map((line) => ({
                            memberId: line.memberId,
                            fonction: line.fonction || 'Équipier',
                          }));
                      });
                      toast(`Équipage repris : ${crewSetName(set)}`);
                    }}
                  >
                    {crewSetName(set)}
                  </Button>
                ))}
              </ButtonRow>
            </FoldSection>
          ) : null}
          <ButtonRow>
            <Button
              className="btn big"
              data-go="people"
              onClick={() => {
                buzz();
                go('people');
              }}
            >
              {tr('🧭 Fiches des équipiers·ères')}
              <small>
                {tr('créer ou compléter une fiche (téléphone, courriel…)')}
              </small>
            </Button>
          </ButtonRow>
        </>
      ) : null}
      <FoldSection title="📎 Documents de l’équipage" titleText="voy-crew-docs">
        <DocList cat={CREW_CAT} editing={editing} />
        {editing ? <DocImport cat={CREW_CAT} /> : null}
      </FoldSection>
      <ShareButton
        data-voyshare="crew"
        onShare={(format) => {
          if (crew.length === 0) {
            toast('Personne dans l’équipage pour l’instant');
            return;
          }
          void shareSections('Croisière · équipage', crewSections(), format);
        }}
      />
    </>
  );
}
