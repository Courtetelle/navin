import { useSignals } from '@preact/signals-react/runtime';
import { useEffect } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import { membersByNav } from '../../features/boats/index.ts';
import { LongPressButton } from '../../features/crew/index.ts';
import { usePhotoUrl } from '../../features/onwater/index.ts';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import { DocImport, DocList } from '../../features/voyages/VoyageDocs.tsx';
import { useChapterEdit } from '../../features/voyages/useChapterEdit.tsx';
import {
  addNewVoyageMembers,
  crewSections,
  memberField,
  openVoyageFiche,
  saveVoyageCrewSet,
  toggleVoyageMember,
} from '../../features/voyages/voyageCrew.ts';
import {
  pickVoyagePhoto,
  removeVoyagePhoto,
} from '../../features/voyages/voyagePhotos.ts';
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
  patchVoyage,
  state,
  toast,
  updateVoyages,
} from '../../state/index.ts';

/**
 * The group photo of the cruise crew, its caption over its bottom; while
 * editing, the caption field and the buttons to change or remove it.
 * @param props - Cruise and mode.
 * @param props.id - Cruise id.
 * @param props.photo - Photo id.
 * @param props.caption - Its caption.
 * @param props.editing - The pencil is on.
 * @returns The photo.
 */
function GroupPhoto({
  id,
  photo,
  caption,
  editing,
}: {
  id: string;
  photo: string | undefined;
  caption: string | undefined;
  editing: boolean;
}) {
  const tr = useTr();
  const url = usePhotoUrl(photo ?? '');
  if (!photo && !editing) return null;
  return (
    <section className="field crew-photo-sec">
      <h3>{tr('Photo de groupe')}</h3>
      {photo ? (
        <figure className="crew-photo">
          <img
            data-voycrewphoto={photo}
            alt="Photo de groupe"
            src={url ?? undefined}
          />
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
      ) : null}
      {editing && photo ? (
        <input
          className="text"
          id="voyCrewCap"
          defaultValue={caption ?? ''}
          placeholder={tr.placeholder(
            'Légende (au centre, en bas de la photo)',
          )}
          autoComplete="off"
          onChange={(event) => {
            const text = event.target.value.trim();
            patchVoyage(id, (draft) => {
              if (text) draft.crewPhotoCap = text;
              else delete draft.crewPhotoCap;
            });
          }}
        />
      ) : null}
      {editing ? (
        <ButtonRow className={photo ? 'row c2' : undefined}>
          <Button
            className={photo ? 'btn' : 'btn big'}
            data-voycrewphoto="pick"
            onClick={() => {
              buzz();
              pickVoyagePhoto(id, 'crewPhoto');
            }}
          >
            {tr(photo ? '📷 Changer la photo' : '📷 + photo')}
            {photo ? null : (
              <small>
                {tr('photo de groupe : photothèque, fichier ou appareil photo')}
              </small>
            )}
          </Button>
          {photo ? (
            <HoldDeleteButton
              className="btn danger"
              data-voycrewphoto="del"
              onClick={buzz}
              onDelete={() => removeVoyagePhoto(id, 'crewPhoto')}
            >
              {tr('🗑 Retirer la photo')}
            </HoldDeleteButton>
          ) : null}
        </ButtonRow>
      ) : null}
    </section>
  );
}

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
  const { crew, id, crewPhoto, crewPhotoCap } = state.data.voyages.value;
  useEffect(() => {
    addNewVoyageMembers();
  }, []);
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
          'L’équipage de la croisière, propre à Croisières : il ne change pas celui de la navigation en cours. Le crayon en haut permet de choisir les personnes et leurs rôles, d’ajouter une photo de groupe, de créer un·e équipier·ère ou de reprendre un équipage enregistré. Un appui long sur un nom ouvre sa fiche.',
        ]}
      >
        {`👥 Équipage · ${crew.length}`}
      </PageTitle>
      <GroupPhoto
        id={id}
        photo={crewPhoto}
        caption={crewPhotoCap}
        editing={editing}
      />
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
                  <LongPressButton
                    key={member.id}
                    className={`btn big ${selected ? 'on' : ''}`}
                    data-voymember={member.id}
                    onClick={() => {
                      buzz();
                      toggleVoyageMember(member.id);
                    }}
                    onLongPress={() => openVoyageFiche(member.id)}
                  >
                    {selected ? '✔ ' : ''}
                    {memberName(member) || '…'}
                  </LongPressButton>
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
          <HelpText>Appui long sur un nom : sa fiche.</HelpText>
          <ButtonRow className="row c2">
            <Button
              className="btn big"
              data-voycrew-new
              onClick={() => {
                buzz();
                openVoyageFiche('new');
              }}
            >
              {tr('＋ Nouvel·le équipier·ère')}
              <small>{tr('sa fiche, puis dans l’équipage')}</small>
            </Button>
            <Button
              className="btn big"
              data-voycrew-save
              onClick={() => {
                buzz();
                const name = saveVoyageCrewSet();
                toast(
                  name
                    ? `Équipage enregistré dans data › Équipages : ${name}`
                    : 'Personne dans l’équipage pour l’instant',
                );
              }}
            >
              {tr('💾 Enregistrer comme équipage')}
              <small>{tr('à reprendre dans data › Équipages')}</small>
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
