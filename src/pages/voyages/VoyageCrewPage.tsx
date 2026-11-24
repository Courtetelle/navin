import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import { usePhotoUrl } from '../../features/onwater/index.ts';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import { DocImport, DocList } from '../../features/voyages/VoyageDocs.tsx';
import { useChapterEdit } from '../../features/voyages/useChapterEdit.tsx';
import {
  chooseVoyageCrewSet,
  crewSections,
  editVoyageCrewSet,
  linkNewVoyageCrewSet,
  memberField,
  newVoyageCrewSet,
  saveVoyageCrewSet,
  voyageCrewLines,
  voyageCrewSet,
} from '../../features/voyages/voyageCrew.ts';
import { shareSections } from '../../features/voyages/voyageShare.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { roleLabel } from '../../model/crewFields.ts';
import { CREW_CAT } from '../../model/voyages.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import {
  crewSetName,
  crewSetPeople,
  memberName,
  state,
  toast,
} from '../../state/index.ts';

function GroupPhoto({ photo, caption }: { photo: string; caption?: string }) {
  const url = usePhotoUrl(photo);
  return (
    <figure className="crew-photo">
      <img alt="Photo de groupe" src={url ?? undefined} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

/**
 * Screen `vcrew` (data › Croisières › Équipage): the crew of the cruise is
 * one of the saved crews of data › Équipages, chosen with the pencil, and
 * edited from here in the editor of data › Équipages.
 * @returns The screen content.
 */
export function VoyageCrewPage() {
  useSignals();
  const tr = useTr();
  const { editing, validate } = useChapterEdit();
  const voyage = state.data.voyages.value;
  const { id, crew } = voyage;
  const members = state.data.members.value;
  const chosen = voyageCrewSet(voyage);
  const lines = voyageCrewLines(voyage);
  const sets = state.data.crewSets.value;
  useEffect(() => {
    linkNewVoyageCrewSet();
  }, []);
  if (!id) return <NoVoyage />;
  const photo = chosen?.photo as string | undefined;
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
          'L’équipage de la croisière est un des équipages de data › Équipages. Le crayon en haut permet de le choisir dans la liste, de le modifier d’ici ou d’en créer un nouveau.',
        ]}
      >
        {`👥 Équipage · ${lines.length}`}
      </PageTitle>
      {chosen ? (
        <h2 className="sub-h" data-voycrewset={chosen.id}>
          {crewSetName(chosen)}
        </h2>
      ) : null}
      {photo ? (
        <GroupPhoto
          photo={photo}
          caption={chosen?.photoCap as string | undefined}
        />
      ) : null}
      {lines.map((line, index) => {
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
              <span className="voy-role">
                {` · ${tr(roleLabel(line.fonction ?? '', member?.sexe))}`}
              </span>
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
          </div>
        );
      })}
      {lines.length === 0 && !editing ? (
        <HelpText>
          Aucun équipage choisi : touchez le crayon en haut pour en choisir un
          dans data › Équipages.
        </HelpText>
      ) : null}
      {editing ? (
        <>
          {chosen ? (
            <ButtonRow>
              <Button
                className="btn big"
                data-voycrewedit={chosen.id}
                onClick={() => {
                  buzz();
                  editVoyageCrewSet(chosen.id);
                }}
              >
                {tr('✏️ Modifier cet équipage')}
                <small>
                  {tr(
                    'personnes, rôles, photo de groupe · aussi dans data › Équipages',
                  )}
                </small>
              </Button>
            </ButtonRow>
          ) : null}
          {!chosen && crew.length > 0 ? (
            <ButtonRow>
              <Button
                className="btn big"
                data-voycrew-save
                onClick={() => {
                  buzz();
                  const name = saveVoyageCrewSet();
                  if (name)
                    {toast(
                      `Équipage enregistré dans data › Équipages : ${name}`,
                    );}
                }}
              >
                {tr('💾 Enregistrer comme équipage')}
                <small>
                  {tr('dans data › Équipages, puis le modifier d’ici')}
                </small>
              </Button>
            </ButtonRow>
          ) : null}
          <h2 className="sub-h">{tr('Choisir un équipage')}</h2>
          {sets.length > 0 ? (
            <ButtonRow className="row c2 crew-pick">
              {sets.map((set) => {
                const on = set.id === chosen?.id;
                return (
                  <Button
                    key={set.id}
                    className={`btn big ${on ? 'on' : ''}`}
                    data-voycrewpick={set.id}
                    onClick={() => {
                      buzz();
                      chooseVoyageCrewSet(on ? undefined : set.id);
                      toast(
                        on
                          ? 'Plus d’équipage pour cette croisière'
                          : `Équipage de la croisière : ${crewSetName(set)}`,
                      );
                    }}
                  >
                    {`${on ? '✔ ' : '👥 '}${crewSetName(set)}`}
                    <small>{crewSetPeople(set) || tr('vide')}</small>
                  </Button>
                );
              })}
            </ButtonRow>
          ) : (
            <HelpText>Aucun équipage enregistré pour l’instant.</HelpText>
          )}
          <ButtonRow>
            <Button
              className="btn big act-add"
              data-voycrew-new
              onClick={() => {
                buzz();
                newVoyageCrewSet();
              }}
            >
              {tr('＋ Nouvel équipage')}
              <small>{tr('créé dans data › Équipages, puis choisi ici')}</small>
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
          if (lines.length === 0) {
            toast('Personne dans l’équipage pour l’instant');
            return;
          }
          void shareSections('Croisière · équipage', crewSections(), format);
        }}
      />
    </>
  );
}
