import { useSignals } from '@preact/signals-react/runtime';
import { useState } from 'react';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { HoldDeleteButton } from '../../components/shared/HoldDeleteButton.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import { VoyageMedal } from '../../features/voyages/VoyageMedal.tsx';
import { useChapterEdit } from '../../features/voyages/useChapterEdit.tsx';
import {
  pickVoyagePhoto,
  removeVoyagePhoto,
} from '../../features/voyages/voyagePhotos.ts';
import { voyageTiles } from '../../features/voyages/voyageTiles.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { VOYAGE_SECTIONS } from '../../model/voyages.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import {
  patchVoyage,
  removeVoyage,
  renameVoyage,
  setActiveVoyage,
  state,
  toast,
} from '../../state/index.ts';

/**
 * Screen `voyage` (data › Croisières › a cruise): built like data, one tile
 * per section of the cruise; below, its name, whether it is the active one,
 * its sections and its deletion.
 * @returns The screen content.
 */
export function VoyagePage() {
  useSignals();
  const tr = useTr();
  const voyage = state.data.voyages.value;
  const isActive = state.data.voyageStore.value.active === voyage.id;
  const [name, setName] = useState(voyage.name);
  const { editing, validate } = useChapterEdit();
  const back = (
    <PageBack
      label="◀ Croisières"
      data-go="voyages"
      onClick={() => {
        buzz();
        go('voyages');
      }}
    >
      {tr('◀ Croisières')}
    </PageBack>
  );
  if (!voyage.id) {
    return (
      <>
        {back}
        <NoVoyage />
      </>
    );
  }
  return (
    <>
      {back}
      {validate}
      <PageTitle titleText={voyage.name}>
        <span className="voy-title">
          <VoyageMedal voyage={voyage} active={isActive} />
          {voyage.name}
        </span>
      </PageTitle>
      <div className="row more-grid data-tiles">
        {voyageTiles().map((tile) => (
          <Button
            key={tile.key}
            className="btn big"
            data-go={tile.key}
            data-tile={tile.key}
            onClick={() => {
              buzz();
              go(tile.key);
            }}
          >
            {tr(tile.title)}
            <small>{tr(tile.sub)}</small>
          </Button>
        ))}
      </div>
      <ButtonRow>
        <Button
          className={`btn big ${isActive ? 'on' : ''}`}
          data-voyactive={voyage.id}
          onClick={() => {
            buzz();
            setActiveVoyage(isActive ? null : voyage.id);
            toast(
              isActive
                ? 'Plus de croisière active'
                : `« ${voyage.name} » est la croisière active`,
            );
          }}
        >
          <span className="voy-tile-head">
            {voyage.photo ? (
              <VoyageMedal voyage={voyage} active={isActive} />
            ) : null}
            {tr(
              voyage.photo
                ? isActive
                  ? 'Croisière active'
                  : 'Rendre active'
                : isActive
                  ? '⭐ Croisière active'
                  : '☆ Rendre active',
            )}
          </span>
          <small>
            {tr(
              isActive
                ? 'les nouvelles navigations, routes et routages la rejoignent · toucher pour arrêter'
                : 'les nouvelles navigations, routes et routages la rejoindront',
            )}
          </small>
        </Button>
      </ButtonRow>
      {editing ? (
        <>
          <FoldSection title="Nom de la croisière" titleText="voy-name">
            <div className="cgrid">
              <div className="cf wide">
                <label htmlFor="voyName">{tr('Nom')}</label>
                <input
                  id="voyName"
                  className="text"
                  value={name}
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => {
                    if (name.trim() && name.trim() !== voyage.name) {
                      renameVoyage(voyage.id, name);
                      toast('Croisière renommée');
                    } else {
                      setName(voyage.name);
                    }
                  }}
                />
              </div>
            </div>
          </FoldSection>
          <FoldSection title="Médaillon de la croisière" titleText="voy-medal">
            <HelpText>
              Une photo ronde à la place de l’étoile, dans la liste et en haut
              de la croisière.
            </HelpText>
            <ButtonRow className={voyage.photo ? 'row c2' : undefined}>
              <Button
                className="btn big"
                data-voyphoto="pick"
                onClick={() => {
                  buzz();
                  pickVoyagePhoto(voyage.id, 'photo');
                }}
              >
                {tr(voyage.photo ? '📷 Changer la photo' : '📷 + photo')}
                <small>{tr('photothèque, fichier ou appareil photo')}</small>
              </Button>
              {voyage.photo ? (
                <HoldDeleteButton
                  className="btn big danger"
                  data-voyphoto="del"
                  onClick={buzz}
                  onDelete={() => removeVoyagePhoto(voyage.id, 'photo')}
                >
                  {tr('🗑 Retirer la photo')}
                </HoldDeleteButton>
              ) : null}
            </ButtonRow>
          </FoldSection>
          <FoldSection
            title="Sections de la croisière"
            titleText="voy-sections"
          >
            <HelpText>
              Toucher une section l’ajoute ou la retire ; une section retirée
              garde ses données.
            </HelpText>
            <ButtonRow className="row c3">
              {VOYAGE_SECTIONS.map((section) => {
                const on = voyage.sections.includes(section.key);
                return (
                  <Button
                    key={section.key}
                    className={`btn big ${on ? 'on' : ''}`}
                    data-voysec={section.key}
                    onClick={() => {
                      buzz();
                      patchVoyage(voyage.id, (draft) => {
                        draft.sections = on
                          ? draft.sections.filter((key) => key !== section.key)
                          : VOYAGE_SECTIONS.map((item) => item.key).filter(
                              (key) =>
                                key === section.key ||
                                draft.sections.includes(key),
                            );
                      });
                    }}
                  >
                    {on ? '☑ ' : '☐ '}
                    {tr(section.title)}
                  </Button>
                );
              })}
            </ButtonRow>
          </FoldSection>
          <ButtonRow>
            <HoldDeleteButton
              className="btn big danger"
              data-voydel={voyage.id}
              onClick={buzz}
              onDelete={() => {
                removeVoyage(voyage.id);
                toast('Croisière supprimée');
                go('voyages');
              }}
            >
              {tr('🗑 Supprimer la croisière')}
            </HoldDeleteButton>
          </ButtonRow>
        </>
      ) : null}
    </>
  );
}
