import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { FoldSection } from '../../components/shared/FoldSection.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import { boatInfoRows, boatsByNav } from '../../features/boats/index.ts';
import { usePhotoUrl } from '../../features/onwater/index.ts';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import { useChapterEdit } from '../../features/voyages/useChapterEdit.tsx';
import {
  chooseVoyageBoat,
  voyageBoat,
} from '../../features/voyages/voyageBoat.ts';
import { shareSections } from '../../features/voyages/voyageShare.ts';
import { voyageBack } from '../../features/voyages/voyageWords.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { state, toast } from '../../state/index.ts';

function BoatPhoto({ photo }: { photo: string }) {
  const url = usePhotoUrl(photo);
  return url ? (
    <figure className="crew-photo">
      <img alt="Photo du bateau" src={url} />
    </figure>
  ) : null;
}

/**
 * Screen `vboat` (data › Croisières › Bateau): the boat of the cruise is one
 * of data › Bateaux, chosen with the pencil and edited from here in its
 * sheet of data › Bateaux.
 * @returns The screen content.
 */
export function VoyageBoatPage() {
  useSignals();
  const tr = useTr();
  const { editing, validate } = useChapterEdit();
  const voyage = state.data.voyages.value;
  const boat = voyageBoat(voyage);
  const boats = boatsByNav();
  if (!voyage.id) return <NoVoyage />;
  const sections = boat ? boatInfoRows(boat) : [];
  const thumb = boat?.thumb as string | undefined;
  return (
    <>
      <PageBack
        label={voyageBack()}
        data-go="voyage"
        onClick={() => {
          buzz();
          go('voyage');
        }}
      >
        {tr(voyageBack())}
      </PageBack>
      {validate}
      <PageTitle
        helps={[
          'Le bateau de la croisière est un des bateaux de data › Bateaux : touchez-le dans la liste. Une fois choisi, la liste disparaît ; le crayon en haut permet d’en changer ou de modifier sa fiche d’ici.',
        ]}
      >
        {`🚤 ${boat?.info.boat || tr('Bateau')}`}
      </PageTitle>
      {thumb ? <BoatPhoto photo={thumb} /> : null}
      {boat
        ? sections.map((section) => (
            <FoldSection
              key={section.title}
              title={section.title}
              titleText={`voy-boat-${section.title}`}
            >
              <dl className="voy-lines">
                {section.rows.map(([label, value]) => (
                  <div key={label} className="voy-line">
                    <dt>{tr(label)}</dt>
                    <dd>
                      <span className="voy-text">{value}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </FoldSection>
          ))
        : null}
      {boat && !editing ? null : (
        <>
          {boat && editing ? (
            <ButtonRow>
              <Button
                className="btn big"
                data-voyboatedit={boat.id}
                onClick={() => {
                  buzz();
                  go('boats', boat.id);
                }}
              >
                {tr('✏️ Modifier ce bateau')}
                <small>
                  {tr('sa fiche dans data › Bateaux · ◀ ramène à la croisière')}
                </small>
              </Button>
            </ButtonRow>
          ) : null}
          <h2 className="sub-h">{tr('Choisir un bateau')}</h2>
          {boats.length > 0 ? (
            <ButtonRow className="row c2 crew-pick">
              {boats.map((item) => {
                const on = item.id === boat?.id;
                const name = item.info.boat || 'Bateau sans nom';
                return (
                  <Button
                    key={item.id}
                    className={`btn big ${on ? 'on' : ''}`}
                    data-voyboatpick={item.id}
                    onClick={() => {
                      buzz();
                      chooseVoyageBoat(on ? undefined : item.id);
                      toast(
                        on
                          ? 'Plus de bateau pour cette croisière'
                          : `Bateau de la croisière : ${name}`,
                      );
                    }}
                  >
                    {`${on ? '✔ ' : '🚤 '}${name}`}
                  </Button>
                );
              })}
            </ButtonRow>
          ) : (
            <HelpText>Aucun bateau pour l’instant.</HelpText>
          )}
          <ButtonRow>
            <Button
              className="btn big act-add"
              data-go="boats"
              onClick={() => {
                buzz();
                go('boats');
              }}
            >
              {tr('＋ Nouveau bateau')}
              <small>
                {tr('à créer dans data › Bateaux, puis à choisir ici')}
              </small>
            </Button>
          </ButtonRow>
        </>
      )}
      <ShareButton
        data-voyshare="boat"
        onShare={(format) => {
          if (!boat) {
            toast('Aucun bateau choisi pour l’instant');
            return;
          }
          void shareSections(
            `Croisière · ${boat.info.boat || 'bateau'}`,
            sections,
            format,
          );
        }}
      />
    </>
  );
}
