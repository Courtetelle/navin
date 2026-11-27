import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { HelpText } from '../../components/shared/HelpText.tsx';
import { PageTitle } from '../../components/shared/PageTitle.tsx';
import { NoVoyage } from '../../features/voyages/NoVoyage.tsx';
import { RECORD_KINDS } from '../../features/voyages/recordKinds.ts';
import { voyageRecords } from '../../features/voyages/voyageRecords.ts';
import { voyageBack } from '../../features/voyages/voyageWords.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { PageBack } from '../../shell/navbar/PageBack.tsx';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

/**
 * Screen `vrecords` (a cruise or outing › Enregistrements): four tiles,
 * Traces, Routes, Routages and Marques, each with what belongs to it
 * (Corban, 27/11). What is made while it is active joins it by itself.
 * @returns The screen content.
 */
export function VoyageRecordsPage() {
  useSignals();
  const tr = useTr();
  const voyage = state.data.voyages.value;
  const back = (
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
  );
  if (!voyage.id) {
    return (
      <>
        {back}
        <NoVoyage />
      </>
    );
  }
  const mine = voyageRecords(voyage.id);
  const word = voyage.lake ? 'sortie' : 'croisière';
  const Word = voyage.lake ? 'Sortie' : 'Croisière';
  const isActive = state.data.voyageStore.value.active === voyage.id;
  return (
    <>
      {back}
      <PageTitle
        helps={[
          `Les traces (navigations avec leurs photos), routes, routages et marques créés pendant que la ${word} est active la rejoignent tout seuls. Dans chaque tuile, le crayon en haut permet de les déplacer dans une autre croisière ou sortie, de les renommer, de les effacer ou d’y ajouter ceux d’avant.`,
        ]}
      >
        🛰 Enregistrements
      </PageTitle>
      <HelpText>
        {isActive
          ? `⭐ ${Word} active : ce qui est créé maintenant la rejoint.`
          : `${Word} non active : rendez-la active pour qu’elle rassemble ce qui est créé.`}
      </HelpText>
      <div className="row more-grid data-tiles">
        {RECORD_KINDS.map((info) => {
          const count = mine[info.list].length;
          return (
            <Button
              key={info.kind}
              className="btn big"
              data-go="vrecs"
              data-tile={`rec-${info.kind}`}
              onClick={() => {
                buzz();
                go('vrecs', info.kind);
              }}
            >
              {tr(`${info.icon} ${info.title}`)}
              <small>
                {count > 0
                  ? `${count} ${tr(`${info.one}${count > 1 ? 's' : ''}`)}`
                  : tr('rien pour l’instant')}
              </small>
            </Button>
          );
        })}
      </div>
    </>
  );
}
